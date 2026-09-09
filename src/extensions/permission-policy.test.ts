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
const APP_DIR = join(HOME, "app");
const PATHS: PolicyPaths = {
	workspaceDir: join(HOME, "KamiBuddy"),
	configDir: join(HOME, ".kamibuddy"),
	protectedDirs: defaultProtectedDirs(HOME),
	appDir: APP_DIR,
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
	it("read / find / grep / ls 在工作目录内（或无路径参数）照常放行", () => {
		for (const toolName of ["read", "find", "grep", "ls"]) {
			expect(decide(facts({ toolName, path: join(PATHS.workspaceDir, "a.md") }), PATHS, CWD)).toEqual({
				kind: "allow",
			});
		}
		// ls 不带路径参数 = 列 cwd，没有区外目标可判。
		expect(decide(facts({ toolName: "ls", path: undefined }), PATHS, CWD)).toEqual({ kind: "allow" });
	});

	it("read / find / grep / ls 出工作区 → 低风险询问", () => {
		/*
		 * 这条用例**翻转过**（2026-09-09）。原先一律放行，理由是「只读工具不改变任何状态」。
		 * 当天事故推翻了这个前提：默认工作区（空目录）+ 默认权限档下，模型经提示词里的
		 * 技能路径发现项目目录，自由读取项目源码与合规敏感素材后对工作区外文件发起 edit ——
		 * **读侧漫游是写越界的必经入口**。且 codex 不限读的前提是沙箱默认禁网，
		 * 我们有 web_fetch 外发通道（读任意文件 + 抓任意 URL = 数据外带），
		 * 前提不同结论就必须跟着改 —— 与上面 2026-09-08 凭据禁读的翻转同一条推理链。
		 */
		for (const toolName of ["read", "find", "grep", "ls"]) {
			const target = join(HOME, "任意位置.txt");
			expect(decide(facts({ toolName, path: target }), PATHS, CWD)).toEqual({
				kind: "ask",
				risk: "low",
				summary: "读取工作目录之外的文件或目录",
				details: target,
			});
		}
	});

	it("web_search / web_fetch / present_files 没有本地路径概念，区外也维持放行", () => {
		for (const toolName of ["web_search", "web_fetch", "present_files"]) {
			expect(decide(facts({ toolName, path: join(HOME, "任意位置.txt") }), PATHS, CWD)).toEqual({ kind: "allow" });
		}
	});

	it("完全访问档下区外读不设限（与写侧语义一致）", () => {
		// FULL 同时把 approval 设为 never，若这里仍判 ask 就会被转成 deny，
		// 断言 allow 才能证明「范围约束确实解除了」。
		for (const toolName of ["read", "find", "grep", "ls"]) {
			expect(decide(facts({ toolName, path: join(HOME, "任意位置.txt") }), PATHS, CWD, FULL)).toEqual({
				kind: "allow",
			});
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

describe("read_document（与 read 同语义：它只是换了解析方式，读的还是本地文件）", () => {
	it("工作区内的文档 → 放行", () => {
		const target = join(PATHS.workspaceDir, "报表.pdf");
		expect(decide(facts({ toolName: "read_document", path: target }), PATHS, CWD)).toEqual({ kind: "allow" });
	});

	it("工作区外的文档 → 低风险询问", () => {
		const target = join(HOME, "任意位置.pdf");
		expect(decide(facts({ toolName: "read_document", path: target }), PATHS, CWD)).toEqual({
			kind: "ask",
			risk: "low",
			summary: "读取工作目录之外的文件或目录",
			details: target,
		});
	});

	it("配置目录与凭据目录内的文档 → 直接拒绝（不给允许选项，与 read 同一层拦截）", () => {
		// 凭据目录对只读工具是「直接拒」而不是询问：提示注入可以骗用户点允许，
		// 这类内容一旦经 web_fetch 外发就是账号级损失（见 policy 阶段 1 注释）。
		expect(
			decide(facts({ toolName: "read_document", path: join(PATHS.configDir, "备份.pdf") }), PATHS, CWD).kind,
		).toBe("deny");
		expect(
			decide(facts({ toolName: "read_document", path: join(HOME, ".ssh", "说明.pdf") }), PATHS, CWD).kind,
		).toBe("deny");
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
		// 落进通用「区外读询问」而不是 deny，才证明没把它当成凭据目录。
		expect(decide(facts({ toolName: "read", path: target }), PATHS, CWD)).toMatchObject({ kind: "ask", risk: "low" });
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

describe("配置目录内的技能子目录：只读工具例外", () => {
	/*
	 * 这组用例钉住 2026-09-08 的第二个回归：configDir 从禁写升级为禁读时
	 * 一刀切误伤了 skills/ —— 渐进式披露靠模型用 read 工具加载 SKILL.md 全文，
	 * 全禁读后用户安装的技能全部变成「列表里有但永不可用」的死技能。
	 * 89 个权限测试里没有一条覆盖「被保护目录的合法消费者」，这组就是补位。
	 */
	const SKILLS_DIR = join(PATHS.configDir, "skills");
	const SKILL_MD = join(SKILLS_DIR, "meeting-notes", "SKILL.md");

	it("read 用户技能的 SKILL.md → 放行（渐进式披露的加载路径）", () => {
		expect(decide(facts({ toolName: "read", path: SKILL_MD }), PATHS, CWD)).toEqual({ kind: "allow" });
	});

	it("find / grep / ls 技能目录 → 放行（模型要枚举技能的 references/）", () => {
		for (const toolName of ["find", "grep", "ls"]) {
			expect(decide(facts({ toolName, path: SKILLS_DIR }), PATHS, CWD)).toEqual({ kind: "allow" });
		}
	});

	it("写技能目录仍然拒绝 —— 技能正文 = 提示词，篡改即提示注入（安装走 skill-install 校验通道）", () => {
		expect(decide(facts({ toolName: "write", path: SKILL_MD }), PATHS, CWD).kind).toBe("deny");
		expect(decide(facts({ toolName: "edit", path: SKILL_MD }), PATHS, CWD).kind).toBe("deny");
	});

	it("技能目录之外的配置目录仍然禁读（auth.json / sessions / preferences）", () => {
		for (const p of ["auth.json", join("sessions", "x.jsonl"), "preferences.json"]) {
			expect(decide(facts({ toolName: "read", path: join(PATHS.configDir, p) }), PATHS, CWD).kind).toBe("deny");
		}
	});

	it("同名前缀的兄弟目录不放行（skills-evil 不是 skills）", () => {
		const target = join(PATHS.configDir, "skills-evil", "SKILL.md");
		expect(decide(facts({ toolName: "read", path: target }), PATHS, CWD).kind).toBe("deny");
	});

	it("只读模式下读技能同样放行（read-only 拒的是改动，不是读）", () => {
		expect(decide(facts({ toolName: "read", path: SKILL_MD }), PATHS, CWD, READONLY)).toEqual({ kind: "allow" });
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

describe("automation 工具（读写 KamiBuddy 自身任务库，不涉及用户文件系统）", () => {
	it("automation_list → 放行（无本地路径概念，与 web_search 同类）", () => {
		expect(decide(facts({ toolName: "automation_list" }), PATHS, CWD)).toEqual({ kind: "allow" });
	});

	it("automation_create / automation_delete → 询问 medium（改变应用自身数据，默认从紧）", () => {
		// 显式登记，不依赖「未知工具」fail-safe —— 后者默认值若变动不该静默改这里的语义。
		for (const toolName of ["automation_create", "automation_delete"]) {
			expect(decide(facts({ toolName }), PATHS, CWD)).toMatchObject({ kind: "ask", risk: "medium" });
		}
	});

	it("询问摘要说明动作（创建 / 删除自动化任务）", () => {
		const create = decide(facts({ toolName: "automation_create" }), PATHS, CWD);
		if (create.kind !== "ask") throw new Error("应为 ask");
		expect(create.summary).toContain("创建");
		const del = decide(facts({ toolName: "automation_delete" }), PATHS, CWD);
		if (del.kind !== "ask") throw new Error("应为 ask");
		expect(del.summary).toContain("删除");
	});

	it("read-only 档下 automation_create → 拒绝（只读拒一切改动，含应用自身数据）", () => {
		expect(decide(facts({ toolName: "automation_create" }), PATHS, CWD, READONLY).kind).toBe("deny");
	});

	it("danger-full-access 下维持询问（与 fail-safe 现状一致；approval=never 即转为拒绝）", () => {
		// 这条钉住「完全访问档不为应用自身数据开口子」的保守选择：
		// 定时任务会在后台无人值守地跑，创建它始终要有人点头。
		expect(decide(facts({ toolName: "automation_create" }), PATHS, CWD, FULL).kind).toBe("deny");
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

	it("区外读取同样询问 —— 读的边界就是这个模式的全部语义", () => {
		const target = join(HOME, "任意位置.txt");
		expect(decide(facts({ toolName: "read", path: target }), PATHS, CWD, READONLY)).toEqual({
			kind: "ask",
			risk: "low",
			summary: "读取工作目录之外的文件或目录",
			details: target,
		});
	});
});

describe("应用目录写保护（写自身永远高风险，哪怕它就是工作区）", () => {
	const APP_FILE = join(APP_DIR, "src", "app.ts");

	it("写应用目录 → 高风险询问", () => {
		const result = decide(facts({ path: APP_FILE }), PATHS, CWD);
		expect(result).toMatchObject({ kind: "ask", risk: "high" });
		if (result.kind !== "ask") throw new Error("应为 ask");
		expect(result.summary).toContain("自身目录");
	});

	it("edit 同样对待", () => {
		expect(decide(facts({ toolName: "edit", path: APP_FILE }), PATHS, CWD)).toMatchObject({
			kind: "ask",
			risk: "high",
		});
	});

	it("应用目录在工作目录内时仍高风险 —— 判定先于「工作区内放行」", () => {
		// 开发时常态：appDir 与工作区重叠。写自己应用不该享受「目录内免打扰」。
		const paths: PolicyPaths = { ...PATHS, appDir: join(PATHS.workspaceDir, "app") };
		const target = join(PATHS.workspaceDir, "app", "index.ts");
		expect(decide(facts({ path: target }), paths, CWD)).toMatchObject({ kind: "ask", risk: "high" });
	});

	it("只读档写应用目录 → 拒绝（阶段 3 先生效，与是否 appDir 无关）", () => {
		expect(decide(facts({ path: APP_FILE }), PATHS, CWD, READONLY).kind).toBe("deny");
	});

	it("完全访问档写应用目录 → 放行（语义一致：完全不设限）", () => {
		// approval=never 下若仍判 ask 会被转成 deny，断言 allow 才证明确实放行。
		expect(decide(facts({ path: APP_FILE }), PATHS, CWD, FULL)).toEqual({ kind: "allow" });
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
		// 2026-09-09 起它落进通用「区外读询问」，而不是像旧行为那样静默放行。
		expect(decide(facts({ toolName: "read", path: join(HOME, ".ssh", "id_rsa") }), minimal, CWD)).toMatchObject({
			kind: "ask",
			risk: "low",
		});
	});

	it("不传 appDir 时应用目录规则不生效 —— 同路径落回区外询问（medium，不是 high）", () => {
		const minimal: PolicyPaths = { workspaceDir: PATHS.workspaceDir, configDir: PATHS.configDir };
		const result = decide(facts({ path: join(APP_DIR, "src", "app.ts") }), minimal, CWD);
		expect(result).toMatchObject({ kind: "ask", risk: "medium" });
	});
});
