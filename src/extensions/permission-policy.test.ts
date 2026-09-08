/**
 * 权限判定的行为测试。
 *
 * 这不是覆盖率练习 —— 每个用例对应一个真实的安全边界。
 * 尤其是「凭据文件一律禁读禁写」那几条：pi 的 resolvePath 对绝对路径直接放行
 * （utils/paths.ts:102，工具目录里搜不到任何越界检查），
 * 所以模型给出绝对路径就能读写 auth.json 里的 API Key。
 * 这一层是唯一的拦截点，测试是它的护栏。
 */

import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
	decide,
	defaultProtectedDirs,
	rememberKey,
	type PolicyPaths,
	type ToolCallFacts,
} from "./permission-policy.ts";
import type { PermissionSettings } from "../shared/permissions.ts";

/** 用 resolve 构造平台正确的绝对路径，避免在 Windows 上写死 /home/... 而失真。 */
const HOME = resolve(sep, "users", "someone");
const PATHS: PolicyPaths = {
	workspaceDir: join(HOME, "KamiBuddy"),
	configDir: join(HOME, ".kamibuddy"),
	protectedDirs: defaultProtectedDirs(HOME),
};
const CWD = PATHS.workspaceDir;

/** 预设的三个档位，供模式相关的用例复用。 */
const READONLY: PermissionSettings = { sandbox: "read-only", approval: "ask" };
const FULL: PermissionSettings = { sandbox: "danger-full-access", approval: "never" };
const NO_ASK: PermissionSettings = { sandbox: "workspace-write", approval: "never" };

function facts(overrides: Partial<ToolCallFacts> = {}): ToolCallFacts {
	return { toolName: "write", path: undefined, command: undefined, ...overrides };
}

describe("只读工具", () => {
	it("read / find / grep / ls / web_search / web_fetch / present_files 一律放行", () => {
		for (const toolName of ["read", "find", "grep", "ls", "web_search", "web_fetch", "present_files"]) {
			expect(decide(facts({ toolName, path: join(HOME, "任意位置.txt") }), PATHS, CWD)).toEqual({ kind: "allow" });
		}
	});

	it("读取配置目录 → 拒绝（T3 加了联网工具后，「读到也带不走」的前提不成立了）", () => {
		/*
		 * 这条用例**翻转过**（2026-09-08）。原先放行，理由写的是
		 * "真正的防线是不让模型把内容发出去（无网络工具）"。
		 * T3 落地 web_search / web_fetch 之后外发通道已经存在，
		 * 提示注入可以诱导「读 auth.json 然后抓取某个 URL 把内容带上」。
		 * 前提消失，结论就必须跟着改 —— 留着旧用例等于把回归钉死成"正确行为"。
		 */
		const target = join(PATHS.configDir, "auth.json");
		expect(decide(facts({ toolName: "read", path: target }), PATHS, CWD).kind).toBe("deny");
	});
});

describe("受保护的凭据目录（读写都拒，任何模式都不能越过）", () => {
	const cases = [".ssh", ".gnupg", ".aws", ".kube", ".docker"];

	it("读取一律拒绝", () => {
		for (const dir of cases) {
			const target = join(HOME, dir, "some-secret");
			expect(decide(facts({ toolName: "read", path: target }), PATHS, CWD).kind).toBe("deny");
		}
	});

	it("写入一律拒绝", () => {
		for (const dir of cases) {
			const target = join(HOME, dir, "some-secret");
			expect(decide(facts({ toolName: "write", path: target }), PATHS, CWD).kind).toBe("deny");
		}
	});

	it("即使「允许完全访问」也拒绝 —— 这是独立的一层，不受模式影响", () => {
		const target = join(HOME, ".ssh", "id_rsa");
		expect(decide(facts({ toolName: "read", path: target }), PATHS, CWD, FULL).kind).toBe("deny");
		expect(decide(facts({ toolName: "write", path: target }), PATHS, CWD, FULL).kind).toBe("deny");
	});

	it("大小写变体同样拦住（Windows 上 path.relative 大小写不敏感，已实测）", () => {
		// 若判定对大小写敏感，`c:\users\...\.SSH` 就是一条现成的绕过路径。
		const target = join(HOME.toUpperCase(), ".SSH", "id_rsa");
		const decision = decide(facts({ toolName: "read", path: target }), PATHS, CWD);
		// 仅在 win32 上断言：POSIX 下大小写本就是不同目录，放行是正确行为。
		if (process.platform === "win32") expect(decision.kind).toBe("deny");
	});

	it("同名前缀的兄弟目录不误伤（.sshfoo 不是 .ssh）", () => {
		const target = join(HOME, ".sshfoo", "note.txt");
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

/* ── 沙箱模式（第一个旋钮） ──────────────────────────────────────── */

describe("沙箱模式：read-only", () => {
	it("写工作目录内也拒 —— 只读就是只读，不看路径", () => {
		const target = join(PATHS.workspaceDir, "报告.md");
		const decision = decide(facts({ path: target }), PATHS, CWD, READONLY);
		expect(decision.kind).toBe("deny");
		// 拒绝理由要告诉用户「怎么解开」，否则他只会觉得坏了。
		if (decision.kind !== "deny") throw new Error("应为 deny");
		expect(decision.reason).toContain("切换权限预设");
	});

	it("edit 同样拒", () => {
		const target = join(PATHS.workspaceDir, "a.md");
		expect(decide(facts({ toolName: "edit", path: target }), PATHS, CWD, READONLY).kind).toBe("deny");
	});

	it("shell 拒（只读模式下命令能绕开一切路径判定）", () => {
		expect(decide(facts({ toolName: "bash", command: "ls" }), PATHS, CWD, READONLY).kind).toBe("deny");
	});

	it("读取类工具照常放行 —— 否则这个模式毫无用处", () => {
		for (const toolName of ["read", "grep", "ls", "web_search"]) {
			expect(decide(facts({ toolName, path: join(PATHS.workspaceDir, "a.md") }), PATHS, CWD, READONLY)).toEqual({
				kind: "allow",
			});
		}
	});
});

describe("沙箱模式：danger-full-access", () => {
	it("写工作目录之外不再询问", () => {
		const target = join(HOME, "Desktop", "报表.xlsx");
		// 注意 FULL 同时把 approval 设为 never，若这里仍判 ask 就会被转成 deny，
		// 断言 allow 才能证明「范围约束确实解除了」。
		expect(decide(facts({ path: target }), PATHS, CWD, FULL)).toEqual({ kind: "allow" });
	});

	it("凭据目录仍然拒（已在受保护路径那组断言，这里守住模式不能越过这一点）", () => {
		expect(decide(facts({ path: join(HOME, ".ssh", "authorized_keys") }), PATHS, CWD, FULL).kind).toBe("deny");
	});

	it("shell 仍然拦 —— 没有危险命令分类器之前保持 fail-closed", () => {
		// approval=never 会把 ask 转成 deny：结果是拒绝，而不是放行。
		// 这条用例钉住「完全访问 ≠ 可以随便跑命令」这个有意的保守选择。
		expect(decide(facts({ toolName: "bash", command: "rm -rf /" }), PATHS, CWD, FULL).kind).toBe("deny");
	});
});

/* ── 审批策略（第二个旋钮） ──────────────────────────────────────── */

describe("审批策略：never = 确定性拒绝，不是静默放行", () => {
	it("原本要询问的写入 → 拒绝", () => {
		const target = join(HOME, "Desktop", "报表.xlsx");
		const withAsk = decide(facts({ path: target }), PATHS, CWD);
		expect(withAsk.kind).toBe("ask");

		const withNever = decide(facts({ path: target }), PATHS, CWD, NO_ASK);
		expect(withNever.kind).toBe("deny");
	});

	it("拒绝理由说明是策略所致，便于用户知道去哪改", () => {
		const decision = decide(facts({ path: join(HOME, "x.txt") }), PATHS, CWD, NO_ASK);
		if (decision.kind !== "deny") throw new Error("应为 deny");
		expect(decision.reason).toContain("不询问");
	});

	it("不影响已经放行的操作", () => {
		const target = join(PATHS.workspaceDir, "a.md");
		expect(decide(facts({ path: target }), PATHS, CWD, NO_ASK)).toEqual({ kind: "allow" });
	});

	it("不影响已经拒绝的操作（理由保持原样，不被策略文案覆盖）", () => {
		const decision = decide(facts({ path: join(PATHS.configDir, "auth.json") }), PATHS, CWD, NO_ASK);
		if (decision.kind !== "deny") throw new Error("应为 deny");
		expect(decision.reason).toContain("配置与凭据");
	});
});

describe("向后兼容", () => {
	it("省略 settings 等于 workspace-write + ask（引入模式前的行为）", () => {
		const outside = join(HOME, "Desktop", "a.txt");
		const inside = join(PATHS.workspaceDir, "a.txt");

		const explicit: PermissionSettings = { sandbox: "workspace-write", approval: "ask" };
		expect(decide(facts({ path: outside }), PATHS, CWD)).toEqual(decide(facts({ path: outside }), PATHS, CWD, explicit));
		expect(decide(facts({ path: inside }), PATHS, CWD)).toEqual(decide(facts({ path: inside }), PATHS, CWD, explicit));
	});

	it("不传 protectedDirs 时只保护配置目录（保守兜底，不崩）", () => {
		const minimal: PolicyPaths = { workspaceDir: PATHS.workspaceDir, configDir: PATHS.configDir };
		expect(decide(facts({ toolName: "read", path: join(PATHS.configDir, "auth.json") }), minimal, CWD).kind).toBe(
			"deny",
		);
		// 没登记就不保护 —— 这是显式契约（daemon 负责传全），不是遗漏。
		expect(decide(facts({ toolName: "read", path: join(HOME, ".ssh", "id_rsa") }), minimal, CWD)).toEqual({
			kind: "allow",
		});
	});
});
