/**
 * 权限判定的行为测试。
 *
 * 这不是覆盖率练习 —— 每个用例对应一个真实的安全边界。
 * 尤其是「配置目录一律禁写」那几条：pi 的 resolvePath 对绝对路径直接放行
 * （utils/paths.ts:102，工具目录里搜不到任何越界检查），
 * 所以模型给出绝对路径就能覆盖 auth.json 里的 API Key。
 * 这一层是唯一的拦截点，测试是它的护栏。
 */

import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { decide, rememberKey, type PolicyPaths, type ToolCallFacts } from "./permission-policy.ts";

/** 用 resolve 构造平台正确的绝对路径，避免在 Windows 上写死 /home/... 而失真。 */
const HOME = resolve(sep, "users", "someone");
const PATHS: PolicyPaths = {
	workspaceDir: join(HOME, "KamiBuddy"),
	configDir: join(HOME, ".kamibuddy"),
};
const CWD = PATHS.workspaceDir;

function facts(overrides: Partial<ToolCallFacts> = {}): ToolCallFacts {
	return { toolName: "write", path: undefined, command: undefined, ...overrides };
}

describe("只读工具", () => {
	it("read / find / grep / ls / web_search / web_fetch / present_files 一律放行", () => {
		for (const toolName of ["read", "find", "grep", "ls", "web_search", "web_fetch", "present_files"]) {
			expect(decide(facts({ toolName, path: join(HOME, "任意位置.txt") }), PATHS, CWD)).toEqual({ kind: "allow" });
		}
	});

	it("读取配置目录也放行 —— 拦的是写，不是读", () => {
		// 读 auth.json 确实能看到密钥，但拦读会让「列目录」这类正常操作处处报错；
		// 真正的防线是不让模型把内容发出去（无网络工具）+ 不让它改配置。
		const target = join(PATHS.configDir, "auth.json");
		expect(decide(facts({ toolName: "read", path: target }), PATHS, CWD)).toEqual({ kind: "allow" });
	});
});

describe("工作目录内的写入", () => {
	it("绝对路径在工作目录内 → 放行", () => {
		const target = join(PATHS.workspaceDir, "报告", "周报.html");
		expect(decide(facts({ path: target }), PATHS, CWD)).toEqual({ kind: "allow" });
	});

	it("相对路径按 cwd 解析后在工作目录内 → 放行", () => {
		expect(decide(facts({ path: "报告/周报.html" }), PATHS, CWD)).toEqual({ kind: "allow" });
	});

	it("工作目录本身 → 放行", () => {
		expect(decide(facts({ path: PATHS.workspaceDir }), PATHS, CWD)).toEqual({ kind: "allow" });
	});

	it("edit 与 write 同样对待", () => {
		const target = join(PATHS.workspaceDir, "a.md");
		expect(decide(facts({ toolName: "edit", path: target }), PATHS, CWD)).toEqual({ kind: "allow" });
	});
});

describe("配置目录：一律拒绝，且不给「允许」选项", () => {
	// 为什么是 deny 而不是 ask：auth.json 存着 API Key。
	// 若靠弹窗把关，提示注入可以编一个理由骗用户点「允许」。
	it("写 auth.json → 拒绝", () => {
		const result = decide(facts({ path: join(PATHS.configDir, "auth.json") }), PATHS, CWD);
		expect(result.kind).toBe("deny");
	});

	it("写配置目录下任意子路径 → 拒绝", () => {
		const result = decide(facts({ path: join(PATHS.configDir, "sessions", "x.jsonl") }), PATHS, CWD);
		expect(result.kind).toBe("deny");
	});

	it("edit 配置文件 → 拒绝", () => {
		const result = decide(facts({ toolName: "edit", path: join(PATHS.configDir, "models.json") }), PATHS, CWD);
		expect(result.kind).toBe("deny");
	});

	it("用 .. 穿越回配置目录 → 仍然拒绝", () => {
		// 关键用例：resolve 会先规范化路径，穿越攻击必须在这里被抓住。
		const sneaky = join(PATHS.workspaceDir, "..", ".kamibuddy", "auth.json");
		const result = decide(facts({ path: sneaky }), PATHS, CWD);
		expect(result.kind).toBe("deny");
	});

	it("相对路径穿越回配置目录 → 仍然拒绝", () => {
		const result = decide(facts({ path: "../.kamibuddy/auth.json" }), PATHS, CWD);
		expect(result.kind).toBe("deny");
	});
});

describe("工作目录之外的写入", () => {
	it("写家目录其他位置 → 询问", () => {
		const result = decide(facts({ path: join(HOME, "Desktop", "报表.xlsx") }), PATHS, CWD);
		expect(result).toMatchObject({ kind: "ask", risk: "medium" });
	});

	it("询问时把解析后的绝对路径给用户看", () => {
		// 给用户看「../x.txt」是没有意义的，必须显示它实际指向哪。
		const result = decide(facts({ path: "../隔壁/x.txt" }), PATHS, CWD);
		if (result.kind !== "ask") throw new Error("应为 ask");
		expect(result.details).toBe(resolve(HOME, "隔壁", "x.txt"));
	});

	it("与工作目录同名前缀的兄弟目录不算目录内", () => {
		// KamiBuddy 与 KamiBuddy-backup 是两个目录，仅靠字符串前缀判断会误放行。
		const sibling = `${PATHS.workspaceDir}-backup`;
		const result = decide(facts({ path: join(sibling, "x.md") }), PATHS, CWD);
		expect(result.kind).toBe("ask");
	});
});

describe("shell 工具", () => {
	it("bash / powershell 一律高风险询问", () => {
		for (const toolName of ["bash", "powershell"]) {
			const result = decide(facts({ toolName, command: "rm -rf /" }), PATHS, CWD);
			expect(result).toMatchObject({ kind: "ask", risk: "high" });
		}
	});

	it("把完整命令给用户看", () => {
		const result = decide(facts({ toolName: "bash", command: "git push --force" }), PATHS, CWD);
		if (result.kind !== "ask") throw new Error("应为 ask");
		expect(result.details).toBe("git push --force");
	});
});

describe("异常输入", () => {
	it("write 缺路径 → 拒绝，而不是放行", () => {
		expect(decide(facts({ path: undefined }), PATHS, CWD).kind).toBe("deny");
	});

	it("write 路径为空串 → 拒绝", () => {
		expect(decide(facts({ path: "" }), PATHS, CWD).kind).toBe("deny");
	});

	it("未登记的工具 → 询问（fail-safe，不静默放行也不静默阻断）", () => {
		const result = decide(facts({ toolName: "render_document", path: "a.html" }), PATHS, CWD);
		expect(result).toMatchObject({ kind: "ask" });
	});
});

describe("本次会话记住", () => {
	it("同目录下不同文件共用一个键", () => {
		const a = rememberKey(facts({ path: join(HOME, "Desktop", "a.txt") }), CWD);
		const b = rememberKey(facts({ path: join(HOME, "Desktop", "b.txt") }), CWD);
		expect(a).toBe(b);
	});

	it("不同目录不共用 —— 批准写桌面不等于批准写系统目录", () => {
		const desktop = rememberKey(facts({ path: join(HOME, "Desktop", "a.txt") }), CWD);
		const other = rememberKey(facts({ path: resolve(sep, "Windows", "a.txt") }), CWD);
		expect(desktop).not.toBe(other);
	});

	it("不同工具不共用 —— 批准 write 不等于批准 bash", () => {
		const target = join(HOME, "Desktop", "a.txt");
		const w = rememberKey(facts({ toolName: "write", path: target }), CWD);
		const e = rememberKey(facts({ toolName: "edit", path: target }), CWD);
		expect(w).not.toBe(e);
	});

	it("无路径时回落到工具名", () => {
		expect(rememberKey(facts({ toolName: "bash", command: "ls" }), CWD)).toBe("bash");
	});
});
