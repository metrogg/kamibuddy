/**
 * 权限判定的行为测试。
 *
 * 这不是覆盖率练习 —— 每个用例对应一个真实的安全边界。
 * 尤其是「凭据文件一律禁读禁写」那几条：pi 的 resolvePath 对绝对路径直接放行
 * （utils/paths.ts:102，工具目录里搜不到任何越界检查），
 * 所以模型给出绝对路径就能读写 auth.json 里的 API Key。
 * 这一层是唯一的拦截点，测试是它的护栏。
 */

import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	decide,
	declareReadOnlyTools,
	defaultProtectedDirs,
	rememberKey,
	type PolicyPaths,
	type ToolCallFacts,
} from "./permission-policy.ts";
import type { PermissionRule } from "./permission-rules.ts";
import type { PermissionSettings } from "../shared/permissions.ts";

// 自声明通道的测试桩：以下工具在各自工厂里自声明（本文件直接调 decide，
// 不经工厂装载），这里集中声明等价于工厂已运行的态。render_document 刻意
// 不声明 —— 「未登记 → 询问」的 fail-safe 测试要它保持未登记。
declareReadOnlyTools([
	"todo_write",
	"task",
	"team_create",
	"team_send",
	"team_status",
	"team_delete",
	"questionnaire",
	"read_me",
	"show_widget",
	"conversation_search",
	"automation_list",
	"web_search",
	"web_fetch",
	"present_files",
]);

/** 用 resolve 构造平台正确的绝对路径，避免在 Windows 上写死 /home/... 而失真。 */
const HOME = resolve(sep, "users", "someone");
const APP_DIR = join(HOME, "app");
const PATHS: PolicyPaths = {
	workspaceDir: join(HOME, "KamiBuddy"),
	configDir: join(HOME, ".kamibuddy"),
	protectedDirs: defaultProtectedDirs(HOME),
	appDir: APP_DIR,
	resourcesDir: join(APP_DIR, "resources"),
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

	it("read / find / grep / ls 出工作区 → 放行（2026-09-16 二次翻转：对齐水位）", () => {
		/*
		 * 这条用例翻转过**两次**。2026-09-09 事故后从放行改成询问（读侧漫游
		 * 是写越界的必经入口）。2026-09-16 翻回放行 —— 先跑后问放行了 shell
		 * （`Get-Content <区外路径>` 不问），询问已不构成边界只剩不一致；
		 * 三家（codex/dsh/WorkBuddy）读侧全部自由，用户明确齐平即可。
		 * 事故教训的对位防线已变：写越界由 OS 沙箱兜（当时没有），
		 * 外发由检查器兜；凭据/配置 deny（阶段 1）与用户 deny 规则保留。
		 */
		for (const toolName of ["read", "find", "grep", "ls"]) {
			const target = join(HOME, "任意位置.txt");
			expect(decide(facts({ toolName, path: target }), PATHS, CWD)).toEqual({
				kind: "allow",
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

	it("工作区外的文档 → 放行（2026-09-16 对齐水位，与 read 同）", () => {
		const target = join(HOME, "任意位置.pdf");
		expect(decide(facts({ toolName: "read_document", path: target }), PATHS, CWD)).toEqual({
			kind: "allow",
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
		// 判定为放行而不是 deny，才证明没把它当成凭据目录（区外读已放行）。
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

	it("技能目录之外的配置目录仍然禁读（auth.json / preferences）", () => {
		for (const p of ["auth.json", "preferences.json"]) {
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

describe("配置目录内的会话库：只读工具例外（spec: add-memory-system）", () => {
	/*
	 * 内置「记忆整理」蒸馏任务的 run 会话 cwd 就是配置目录，它靠 read/grep/ls
	 * 翻近 3 天的会话 JSONL 蒸馏画像。读自己的会话库不该撞配置目录禁读墙；
	 * 写仍拒 —— 会话文件的唯一写者是 SessionManager，工具层写等于篡改历史。
	 */
	const SESSIONS_DIR = join(PATHS.configDir, "sessions");
	const SESSION_FILE = join(SESSIONS_DIR, "2026-09-11-x.jsonl");

	it("read 会话文件 → 放行（蒸馏任务读原料的路径）", () => {
		expect(decide(facts({ toolName: "read", path: SESSION_FILE }), PATHS, CWD)).toEqual({
			kind: "allow",
		});
	});

	it("find / grep / ls 会话库目录 → 放行", () => {
		for (const toolName of ["find", "grep", "ls"]) {
			expect(decide(facts({ toolName, path: SESSIONS_DIR }), PATHS, CWD)).toEqual({
				kind: "allow",
			});
		}
	});

	it("写会话库仍然拒绝 —— 会话文件的唯一写者是 SessionManager", () => {
		expect(decide(facts({ toolName: "write", path: SESSION_FILE }), PATHS, CWD).kind).toBe("deny");
		expect(decide(facts({ toolName: "edit", path: SESSION_FILE }), PATHS, CWD).kind).toBe("deny");
	});

	it("同名前缀的兄弟目录不放行（sessions-evil 不是 sessions）", () => {
		const target = join(PATHS.configDir, "sessions-evil", "x.jsonl");
		expect(decide(facts({ toolName: "read", path: target }), PATHS, CWD).kind).toBe("deny");
	});
});

describe("记忆文件白名单（spec: add-memory-system）", () => {
	/*
	 * 三层记忆是纯数据（Markdown 笔记），模型用 write/edit 自己维护 ——
	 * 维护记忆就是功能本体。配置目录禁写防的是 preferences/auth/models
	 * 这类可执行配置被改（自毁），两组路径必须分开判。
	 */
	const MEMORY_MD = join(PATHS.configDir, "MEMORY.md");
	const PROFILE_MD = join(PATHS.configDir, "PROFILE.md");

	it("写配置目录下的 MEMORY.md / PROFILE.md → 放行（精确文件名）", () => {
		for (const toolName of ["write", "edit"]) {
			expect(decide(facts({ toolName, path: MEMORY_MD }), PATHS, CWD)).toEqual({ kind: "allow" });
			expect(decide(facts({ toolName, path: PROFILE_MD }), PATHS, CWD)).toEqual({ kind: "allow" });
		}
	});

	it("写 cwd 的 .kamibuddy/memory/ 下文件 → 放行（cwd 不在工作区时也放，钉住白名单本身）", () => {
		// 刻意让 cwd 与 paths.workspaceDir 不同：若落进「区外写询问」说明
		// 白名单没生效、是被工作区规则顺带覆盖的。
		const projectCwd = join(HOME, "projects", "demo");
		const logFile = join(projectCwd, ".kamibuddy", "memory", "2026-09-11.md");
		expect(decide(facts({ path: logFile }), PATHS, projectCwd)).toEqual({ kind: "allow" });
	});

	it("read-only 档下写三个记忆路径同样放行（先于阶段 3 的只读拒绝）", () => {
		// 写入纪律是系统提示词固定注入段，只读档拦写会让模型每轮撞墙。
		const projectCwd = join(HOME, "projects", "demo");
		for (const target of [
			MEMORY_MD,
			PROFILE_MD,
			join(CWD, ".kamibuddy", "memory", "2026-09-11.md"),
			join(projectCwd, ".kamibuddy", "memory", "MEMORY.md"),
		]) {
			const cwd = target.startsWith(projectCwd) ? projectCwd : CWD;
			expect(decide(facts({ path: target }), PATHS, cwd, READONLY)).toEqual({ kind: "allow" });
		}
	});

	it("cwd 就在配置目录下时，工作区记忆目录仍可写（两层规则覆盖的场景）", () => {
		const target = join(PATHS.configDir, ".kamibuddy", "memory", "2026-09-11.md");
		expect(decide(facts({ path: target }), PATHS, PATHS.configDir)).toEqual({ kind: "allow" });
	});

	it("配置目录其余文件维持禁写：preferences.json / auth.json / models.json", () => {
		for (const p of ["preferences.json", "auth.json", "models.json"]) {
			expect(decide(facts({ path: join(PATHS.configDir, p) }), PATHS, CWD).kind).toBe("deny");
		}
		// 精确文件名不等于前缀放行：MEMORY.md.bak 不是记忆文件。
		expect(decide(facts({ path: join(PATHS.configDir, "MEMORY.md.bak") }), PATHS, CWD).kind).toBe("deny");
	});

	it("读记忆文件同样放行（模型改 MEMORY.md 前要先 read 现状）", () => {
		expect(decide(facts({ toolName: "read", path: MEMORY_MD }), PATHS, CWD, READONLY)).toEqual({
			kind: "allow",
		});
	});

	it("shell 不借记忆路径放行：命令没有路径语义，白名单只限文件工具", () => {
		// powershell 带一个恰好指向 MEMORY.md 的 path 入参，也不能经白名单 allow ——
		// 阶段 0 只认文件工具。实际落进阶段 1 的配置目录拒绝（比询问更严），
		// 这里只钉「不放行」这个安全语义，不钉具体落哪条规则。
		const result = decide(
			facts({ toolName: "powershell", command: "Set-Content x y", path: MEMORY_MD }),
			PATHS,
			CWD,
		);
		expect(result.kind).not.toBe("allow");
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

describe("docx_convert（写工作区产物文件档，与 write 同语义）", () => {
	/*
	 * 判定锚定产物路径 outputPath（permission-gate 的 extractFacts 已把它
	 * 映射进 facts.path，这里喂的就是映射后的形态）。
	 */
	it("产物在工作区内 → 放行", () => {
		const target = join(PATHS.workspaceDir, "周报.docx");
		expect(decide(facts({ toolName: "docx_convert", path: target }), PATHS, CWD)).toEqual({
			kind: "allow",
		});
	});

	it("产物出工作区 → 中风险询问，文案按「写入」（产出新文件）", () => {
		const target = join(HOME, "Desktop", "周报.docx");
		expect(decide(facts({ toolName: "docx_convert", path: target }), PATHS, CWD)).toEqual({
			kind: "ask",
			risk: "medium",
			summary: "写入工作目录之外的文件",
			details: target,
		});
	});

	it("read-only 档 → 拒（它写产物文件，这是模式的全部含义）", () => {
		const target = join(PATHS.workspaceDir, "周报.docx");
		const result = decide(facts({ toolName: "docx_convert", path: target }), PATHS, CWD, READONLY);
		expect(result.kind).toBe("deny");
	});

	it("产物落在应用目录内 → 高风险询问（先于工作区放行判定）", () => {
		const target = join(APP_DIR, "out.docx");
		expect(decide(facts({ toolName: "docx_convert", path: target }), PATHS, CWD)).toMatchObject({
			kind: "ask",
			risk: "high",
		});
	});
});

describe("shell 工具", () => {
	it("bash 一律高风险询问", () => {
		const result = decide(facts({ toolName: "bash", command: "rm -rf /" }), PATHS, CWD);
		expect(result).toMatchObject({ kind: "ask", risk: "high" });
	});

	it("powershell 命令门不再审批（2026-09-16 对齐 dsh）：一律放行到执行层", () => {
		/*
		 * 能不能跑由执行层的沙箱决定（现场 confine，失败即拒），不由门预判——
		 * dsh 的结构：shell 无事前审批，confine 失败抛 SANDBOX_UNAVAILABLE。
		 * 唯一例外是配置文本闸（单独一组测试）。bash 不在此列：没配检查器、
		 * 也没法给它包沙箱执行器，维持高风险询问。
		 */
		expect(decide(facts({ toolName: "powershell", command: "Remove-Item x" }), PATHS, CWD)).toEqual({
			kind: "allow",
		});
		expect(decide(facts({ toolName: "powershell", command: "Get-Date" }), PATHS, CWD, READONLY)).toEqual({
			kind: "allow",
		});
		expect(decide(facts({ toolName: "powershell", command: "Get-Date" }), PATHS, CWD, FULL)).toEqual({
			kind: "allow",
		});
	});

	it("bash 在完全访问档仍然拦（没有为它配检查器，保持 fail-closed）", () => {
		// FULL 的 approval=never 会把 ask 转成 deny：结果是拒绝，而不是放行。
		expect(decide(facts({ toolName: "bash", command: "rm -rf /" }), PATHS, CWD, FULL).kind).toBe("deny");
	});

	it("把完整命令给用户看", () => {
		const result = decide(facts({ toolName: "bash", command: "git push --force" }), PATHS, CWD);
		if (result.kind !== "ask") throw new Error("应为 ask");
		expect(result.details).toBe("git push --force");
	});
});

describe("questionnaire（结构化提问）", () => {
	it("三档都放行 —— 不触文件系统，输入全部来自用户本人", () => {
		// read-only 档也放行：问用户一个问题不构成「修改文件或执行命令」，
		// READ_ONLY 分支先于阶段 3 的只读拒绝生效。
		for (const settings of [undefined, READONLY, FULL]) {
			expect(decide(facts({ toolName: "questionnaire" }), PATHS, CWD, settings)).toEqual({
				kind: "allow",
			});
		}
	});
});

describe("conversation_search（本地会话检索）", () => {
	it("三档都放行 —— 读 KamiBuddy 自己的会话库，与 automation_list 同档", () => {
		// 读盘发生在 daemon 内部（不经工具路径入参），没有路径可判；
		// 不落 fail-safe 弹窗（spec: add-memory-system）。
		for (const settings of [undefined, READONLY, FULL]) {
			expect(decide(facts({ toolName: "conversation_search" }), PATHS, CWD, settings)).toEqual({
				kind: "allow",
			});
		}
	});
});

describe("read_me / show_widget（内联可视化）", () => {
	it("三档都放行 —— 不触文件系统、无用户交互，与 questionnaire 同口径", () => {
		// read_me 读的是随应用分发的设计指南（resources/visualizer/），
		// show_widget 把片段交给 UI 渲染；两者都无本地路径概念，
		// READ_ONLY 分支先于阶段 3 的只读拒绝生效（spec: add-inline-widgets）。
		for (const toolName of ["read_me", "show_widget"]) {
			for (const settings of [undefined, READONLY, FULL]) {
				expect(decide(facts({ toolName }), PATHS, CWD, settings)).toEqual({
					kind: "allow",
				});
			}
		}
	});
});

describe("todo_write / task（编排类，无本地副作用）", () => {
	it("三档都放行 —— 不落 fail-safe 弹窗（2026-09-11 用户实测回归）", () => {
		// todo_write 只更新会话内待办清单展示状态；task 只做委派编排，
		// 子代理内部的敏感操作由 subagent-runner 自己的权限门逐次判定
		// （同一套 PermissionSettings，read-only 档内部写操作照样被拒）。
		for (const toolName of ["todo_write", "task"]) {
			for (const settings of [undefined, READONLY, FULL]) {
				expect(decide(facts({ toolName }), PATHS, CWD, settings)).toEqual({
					kind: "allow",
				});
			}
		}
	});
});

describe("team 工具（团队编排，无本地副作用）", () => {
	it("三档都放行 —— 不落 fail-safe 拒绝（2026-09-16 用户实测回归：不询问策略下 team_create 被拒）", () => {
		// team 四件套只做编排与注册表操作：成员是独立 SessionHost，敏感操作
		// 发生在成员内部，由成员自带的权限门（与子代理同一套装配）逐次判定；
		// team_delete 只中止自己建的成员会话，不碰用户数据。
		// 与 todo_write 的 2026-09-11 事故同型：新工具不登记 → 未知工具落
		// fail-safe，「不询问」策略直接拒绝，整条功能链路不可用。
		for (const toolName of ["team_create", "team_send", "team_status", "team_delete"]) {
			for (const settings of [undefined, READONLY, FULL]) {
				expect(decide(facts({ toolName }), PATHS, CWD, settings)).toEqual({
					kind: "allow",
				});
			}
		}
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

describe("MCP 工具（mcp__<server>__<tool> 前缀，默认人工审批）", () => {
	it("mcp__ 前缀工具 → 询问 medium（显式登记，不依赖「未知工具」fail-safe）", () => {
		// 与 automation_create/delete 同一条登记理由：fail-safe 默认值若变动，
		// 不该静默改变 MCP 的语义（见 policy 里 MCP 分支注释）。
		expect(decide(facts({ toolName: "mcp__filesystem__read_file" }), PATHS, CWD)).toMatchObject({
			kind: "ask",
			risk: "medium",
		});
	});

	it("询问摘要从工具名解析出服务器与工具（审批弹窗直接展示）", () => {
		const result = decide(facts({ toolName: "mcp__filesystem__read_file" }), PATHS, CWD);
		if (result.kind !== "ask") throw new Error("应为 ask");
		expect(result.summary).toContain("filesystem");
		expect(result.summary).toContain("read_file");
	});

	it("details 给出入参里的路径 —— 审批弹窗折叠详情展示的参数摘要", () => {
		const target = join(HOME, "任意位置.txt");
		const result = decide(facts({ toolName: "mcp__filesystem__read_file", path: target }), PATHS, CWD);
		if (result.kind !== "ask") throw new Error("应为 ask");
		expect(result.details).toBe(target);
	});

	it("目标路径在凭据目录内 → 拒绝（阶段 1 先于 MCP 登记，filesystem server 读的就是本机文件）", () => {
		// 这是 MCP 场景最重要的边界：server 进程的读文件能力不能变成凭据外带通道。
		expect(
			decide(facts({ toolName: "mcp__filesystem__read_file", path: join(HOME, ".ssh", "id_rsa") }), PATHS, CWD)
				.kind,
		).toBe("deny");
	});

	it("read-only 档下 → 拒绝（能力面由外部 server 定义，无法证明它不改状态）", () => {
		expect(decide(facts({ toolName: "mcp__filesystem__read_file" }), PATHS, CWD, READONLY).kind).toBe("deny");
	});

	it("danger-full-access 下维持询问（与 shell 同理：能力无法分类，fail-closed）", () => {
		// FULL 的 approval=never 会把 ask 转成 deny：结果是拒绝，而不是放行。
		// 钉住「完全访问档不为无法分类的外部能力开口子」这个保守选择。
		expect(decide(facts({ toolName: "mcp__filesystem__read_file" }), PATHS, CWD, FULL).kind).toBe("deny");
	});

	it("畸形的 mcp__ 名（缺工具段）不崩，摘要回落到完整工具名", () => {
		const result = decide(facts({ toolName: "mcp__filesystem" }), PATHS, CWD);
		if (result.kind !== "ask") throw new Error("应为 ask");
		expect(result.summary).toContain("mcp__filesystem");
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

	it("区外读取放行（读不构成「修改」；2026-09-16 对齐后与默认档一致）", () => {
		const target = join(HOME, "任意位置.txt");
		expect(decide(facts({ toolName: "read", path: target }), PATHS, CWD, READONLY)).toEqual({
			kind: "allow",
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
		// 区外读放行后它不再落进询问，直接放行（凭据 deny 只保护已登记的）。
		expect(decide(facts({ toolName: "read", path: join(HOME, ".ssh", "id_rsa") }), minimal, CWD)).toEqual({
			kind: "allow",
		});
	});

	it("不传 appDir 时应用目录规则不生效 —— 同路径落回区外询问（medium，不是 high）", () => {
		const minimal: PolicyPaths = { workspaceDir: PATHS.workspaceDir, configDir: PATHS.configDir };
		const result = decide(facts({ path: join(APP_DIR, "src", "app.ts") }), minimal, CWD);
		expect(result).toMatchObject({ kind: "ask", risk: "medium" });
	});
});

describe("内置资源目录（resourcesDir）只读放行", () => {
	const skillFile = join(APP_DIR, "resources", "skills", "docx", "SKILL.md");

	it("read / grep / find / ls / read_document 读 resources/ 一律放行（不问）", () => {
		for (const toolName of ["read", "grep", "find", "ls", "read_document"]) {
			expect(decide(facts({ toolName, path: skillFile }), PATHS, CWD).kind).toBe("allow");
		}
	});

	it("read-only 档下读 resources/ 同样放行（与工作区读同语义）", () => {
		expect(decide(facts({ toolName: "read", path: skillFile }), PATHS, CWD, READONLY).kind).toBe("allow");
	});

	it("写 resources/ 不因此放开 —— 仍在 appDir 之下，走高风险询问", () => {
		const result = decide(facts({ path: skillFile }), PATHS, CWD);
		expect(result).toMatchObject({ kind: "ask", risk: "high" });
	});

	it("resources 之外的区外路径也放行（2026-09-16 对齐后区外读不再询问）", () => {
		expect(decide(facts({ toolName: "read", path: join(HOME, "elsewhere", "x.txt") }), PATHS, CWD)).toEqual({
			kind: "allow",
		});
	});

	it("不传 resourcesDir 时读内置技能文件也放行（区外读已放行，resourcesDir 不再是放行的必要条件）", () => {
		const minimal: PolicyPaths = { workspaceDir: PATHS.workspaceDir, configDir: PATHS.configDir };
		expect(decide(facts({ toolName: "read", path: skillFile }), minimal, CWD)).toEqual({
			kind: "allow",
		});
	});
});

/* ── powershell 持久前缀规则（spec: add-permission-rules-engine） ── */

describe("powershell 前缀规则（判定链阶段 4 的规则阶段）", () => {
	const GIT_ALLOW: PermissionRule = { tool: "powershell", prefix: "git", action: "allow" };
	const RM_DENY: PermissionRule = { tool: "powershell", prefix: "Remove-Item", action: "deny" };

	it("allow 前缀免弹窗：默认档下 git status --short → 直接放行", () => {
		expect(
			decide(facts({ toolName: "powershell", command: "git status --short" }), PATHS, CWD, undefined, [GIT_ALLOW]),
		).toEqual({ kind: "allow" });
	});

	it("deny 直拒：Remove-Item ./a → 拒绝且 reason 带规则来源（不弹窗）", () => {
		const result = decide(
			facts({ toolName: "powershell", command: "Remove-Item ./a" }),
			PATHS,
			CWD,
			undefined,
			[RM_DENY],
		);
		expect(result.kind).toBe("deny");
		if (result.kind !== "deny") throw new Error("应为 deny");
		expect(result.reason).toContain("Remove-Item");
		expect(result.reason).toContain("拒绝规则");
	});

	it("拆分最严获胜：deny 段命中整条拒绝，allow 规则不再有放行意义（门不审命令后）", () => {
		/*
		 * 2026-09-16 对齐后门不再审 powershell 命令（一律放行到执行层），
		 * 规则引擎对 powershell 只剩 **deny 侧**有意义：链式命令任一段命中
		 * deny → 整条拒绝（最严获胜）。allow 规则冗余但无害。
		 */
		expect(
			decide(facts({ toolName: "powershell", command: "git status && rm -rf ./dist" }), PATHS, CWD, undefined, [
				GIT_ALLOW,
			]),
		).toEqual({ kind: "allow" });
		const CHAIN_DENY: PermissionRule = { tool: "powershell", prefix: "rm", action: "deny" };
		expect(
			decide(facts({ toolName: "powershell", command: "git status && rm -rf ./dist" }), PATHS, CWD, undefined, [
				GIT_ALLOW,
				CHAIN_DENY,
			]).kind,
		).toBe("deny");
	});

	it("read-only 档：**deny 规则仍赢过放行**（用户意图最强）", () => {
		const denyGit: PermissionRule = { tool: "powershell", prefix: "git", action: "deny" };
		expect(
			decide(facts({ toolName: "powershell", command: "git status" }), PATHS, CWD, READONLY, [denyGit]).kind,
		).toBe("deny");
	});

	it("danger-full-access 不受影响：该档本就直接放行，规则（含 deny）不参与", () => {
		// 规则阶段排在 danger-full-access 放行之后 —— 完全访问就是完全访问。
		expect(
			decide(facts({ toolName: "powershell", command: "Remove-Item ./a" }), PATHS, CWD, FULL, [RM_DENY]),
		).toEqual({ kind: "allow" });
	});

	it("bash 不受规则影响：powershell 的 allow 规则管不了 bash 调用", () => {
		// bash 没有危险命令检查器，规则面先不覆盖 —— 维持高风险询问的 fail-closed。
		expect(
			decide(facts({ toolName: "bash", command: "git status" }), PATHS, CWD, undefined, [GIT_ALLOW]),
		).toMatchObject({ kind: "ask", risk: "high" });
	});

	/*
	 * 样本命令用 `git push`（名单层已退役，门不再审命令——任何 powershell
	 * 命令都会放行，这两条测的是**规则匹配的归属**：deny 规则必须因
	 * rule.tool 不匹配而不到达）。
	 */
	it("其他工具的 deny 规则不匹配 powershell（rule.tool 必须等于调用工具）", () => {
		const bashRule: PermissionRule = { tool: "bash", prefix: "git", action: "deny" };
		expect(
			decide(facts({ toolName: "powershell", command: "git push" }), PATHS, CWD, undefined, [bashRule]),
		).toEqual({ kind: "allow" });
	});

	it("不传规则时 powershell 命令放行（门不审命令；向后兼容由执行层守住）", () => {
		expect(decide(facts({ toolName: "powershell", command: "git push" }), PATHS, CWD)).toEqual({
			kind: "allow",
		});
	});

	it("approval=never 下规则命中的 allow 仍放行（规则阶段产出的是终局 allow，不经审批策略）", () => {
		// 与「记住的批准」不同：规则 allow 在 decide 内部就是终局，
		// never 只把 ask 转 deny，碰不到它。
		expect(
			decide(facts({ toolName: "powershell", command: "git status" }), PATHS, CWD, NO_ASK, [GIT_ALLOW]),
		).toEqual({ kind: "allow" });
	});
});

/* ── read 家族路径前缀规则（spec: extend-permission-rules-to-paths） ── */

describe("read 家族路径前缀规则（判定链阶段 2 接线）", () => {
	// 工作区外、家目录下的「容器目录」：用户信任整棵树、不想每个会话都点一次的典型场景。
	const CONTAINER = join(HOME, "shared");
	const ALLOW_CONTAINER: PermissionRule = { tool: "read", prefix: CONTAINER, action: "allow" };

	it("allow 规则使命中目录树的区外读免询问：read 子孙文件放行", () => {
		expect(
			decide(facts({ toolName: "read", path: join(CONTAINER, "proj", "a.md") }), PATHS, CWD, undefined, [
				ALLOW_CONTAINER,
			]),
		).toEqual({ kind: "allow" });
	});

	it("同一条 read 规则对家族内其他工具同样生效：ls 目录自身放行（家族语义）", () => {
		// 「read」代表整个只读家族，不逐工具区分 —— ls 那个目录本身也该命中。
		expect(decide(facts({ toolName: "ls", path: CONTAINER }), PATHS, CWD, undefined, [ALLOW_CONTAINER])).toEqual({
			kind: "allow",
		});
	});

	it("无规则时同一路径也放行（区外读已放行；deny 规则仍是唯一收紧通道）", () => {
		expect(decide(facts({ toolName: "read", path: join(CONTAINER, "a.md") }), PATHS, CWD)).toEqual({
			kind: "allow",
		});
	});

	it("deny 规则先于工作区放行：工作区内被 deny 的目录直接拒（最严获胜）", () => {
		const SECRETS = join(PATHS.workspaceDir, "secrets");
		const DENY: PermissionRule = { tool: "read", prefix: SECRETS, action: "deny" };
		const result = decide(facts({ toolName: "read", path: join(SECRETS, "x.md") }), PATHS, CWD, undefined, [DENY]);
		expect(result.kind).toBe("deny");
		if (result.kind !== "deny") throw new Error("应为 deny");
		expect(result.reason).toContain("拒绝规则");
	});

	it("凭据目录不可被 allow 规则放行：.ssh 写 allow 也放不进（规则阶段在阶段 1 之后）", () => {
		const SSH_ALLOW: PermissionRule = { tool: "read", prefix: join(HOME, ".ssh"), action: "allow" };
		expect(
			decide(facts({ toolName: "read", path: join(HOME, ".ssh", "id_rsa") }), PATHS, CWD, undefined, [SSH_ALLOW])
				.kind,
		).toBe("deny");
	});

	it("非绝对路径 prefix 的规则不影响判定：区外读照常放行", () => {
		const RELATIVE: PermissionRule = { tool: "read", prefix: "shared", action: "allow" };
		expect(
			decide(facts({ toolName: "read", path: join(CONTAINER, "a.md") }), PATHS, CWD, undefined, [RELATIVE]),
		).toEqual({ kind: "allow" });
	});
});

/**
 * 审批放松：内置安全名单接进判定链（spec: 沙箱三期）。
 *
 * `safe-commands.test.ts` 已经把「哪条命令属于哪一层」逐条钉住了；这一组只管
 * **接线的位置语义** —— 名单与用户规则、与三个档位、与沙箱就绪度的相互关系。
 * 那些关系一旦接错，单看名单本身是发现不了的。
 */
describe("powershell 命令放行 + 配置文本闸（对齐 dsh 的最终形态）", () => {
	function shell(command: string): ToolCallFacts {
		return facts({ toolName: "powershell", command, path: undefined });
	}

	it("命令一律放行到执行层（就绪与否无关——dsh 同构：confine 是执行层的事）", () => {
		for (const command of ["Get-ChildItem", "npm run build", "Remove-Item x -Recurse", "node evil.js"]) {
			expect(decide(shell(command), PATHS, CWD), command).toEqual({
				kind: "allow",
			});
		}
	});

	it("结构（管道/链式/注入旗标）与单段同水位", () => {
		for (const command of [
			'git status | node -e "evil()"',
			"git -c core.fsmonitor=evil status",
			"git status && Remove-Item x",
			"git log > out.txt",
		]) {
			expect(decide(shell(command), PATHS, CWD), command).toEqual({
				kind: "allow",
			});
		}
	});

	it("配置文本闸是唯一例外：命令涉及配置路径 → 高风险询问", () => {
		for (const command of [
			'Set-Content .git\\config "[core]"',
			"Get-Content package.json",
			"Remove-Item .pi\\extensions\\x.ts",
		]) {
			expect(decide(shell(command), PATHS, CWD), command).toMatchObject({
				kind: "ask",
				risk: "high",
			});
		}
	});

	it("bash 不放行（没配检查器、无法包沙箱执行器，fail-closed）", () => {
		expect(
			decide(facts({ toolName: "bash", command: "git status", path: undefined }), PATHS, CWD),
		).toMatchObject({ kind: "ask", risk: "high" });
	});

	it("approval=never 时文本闸的询问转 deny（不问 = 不做）", () => {
		expect(
			decide(shell('Set-Content .git\\config x'), PATHS, CWD, NO_ASK).kind,
		).toBe("deny");
	});

	it("放行是 allow，穿过审批策略转换（无人值守的拦截在工具层 unattended 分支）", () => {
		expect(decide(shell("Get-Date"), PATHS, CWD, NO_ASK)).toEqual({ kind: "allow" });
	});
});

describe("配置即代码：写入需要审批", () => {
	/** 这些文件的内容会被自动执行 → 高风险询问（**不是** deny：加 script 是正常需求）。 */
	const EXECUTABLE_CONFIGS = [
		join(".pi", "extensions", "evil.ts"),
		join(".pi", "extensions", "nested", "deep.ts"),
		join(".pi", "settings.json"),
		join(".pi", "SYSTEM.md"),
		join(".agents", "skills", "x", "SKILL.md"),
		join(".git", "config"),
		join(".git", "hooks", "pre-commit"),
		join(".github", "workflows", "ci.yml"),
		join(".vscode", "tasks.json"),
		"package.json",
		join("packages", "sub", "package.json"),
		".npmrc",
		".envrc",
		"Makefile",
		join("node_modules", ".bin", "tsc"),
	];

	it("一律高风险询问（含 write 与 edit）", () => {
		for (const relative of EXECUTABLE_CONFIGS) {
			const target = join(PATHS.workspaceDir, relative);
			for (const toolName of ["write", "edit"]) {
				expect(decide(facts({ toolName, path: target }), PATHS, CWD), `${toolName} ${relative}`).toMatchObject(
					{ kind: "ask", risk: "high" },
				);
			}
		}
	});

	it("**不提供「本次会话记住」**（靠 high 实现，别降级成 medium）", () => {
		/*
		 * 这条依赖的是既有机制：审批弹窗对高风险不给「记住」选项，权限门回程
		 * 也忽略高风险的 remember。若把风险等级降成 medium，用户一次勾选就把
		 * 整个目录变成免检 —— 那等于这道保护不存在。
		 */
		const verdict = decide(
			facts({ path: join(PATHS.workspaceDir, ".git", "config") }),
			PATHS,
			CWD,
		);
		expect(verdict).toMatchObject({ kind: "ask", risk: "high" });
	});

	it("大小写不敏感（Windows 上 .GIT\\CONFIG 是同一个文件）", () => {
		if (process.platform !== "win32") return;
		const target = join(PATHS.workspaceDir, ".GIT", "CONFIG");
		expect(decide(facts({ path: target }), PATHS, CWD)).toMatchObject({ kind: "ask", risk: "high" });
	});

	it("精度：只拦真正被加载的子目录，不连坐兄弟目录", () => {
		/*
		 * pi 只加载 `.agents/skills`，而本仓库的 `.agents/notes/` 全是纯文档。
		 * 把它一并拦下会制造大量无意义弹窗 —— 而误报的代价是用户开始条件反射
		 * 点允许，那时真正危险的那次也会被放过去。
		 */
		expect(
			decide(facts({ path: join(PATHS.workspaceDir, ".agents", "notes", "x.md") }), PATHS, CWD),
		).toEqual({ kind: "allow" });
		// node_modules 里的普通文件同理：只有 .bin/ 会被 npm run 调起。
		expect(
			decide(
				facts({ path: join(PATHS.workspaceDir, "node_modules", "foo", "index.js") }),
				PATHS,
				CWD,
			),
		).toEqual({ kind: "allow" });
	});

	it("普通文件不受影响（免打扰仍是产品语义）", () => {
		for (const relative of ["报告.md", join("src", "index.ts"), "config.json", "readme.txt"]) {
			expect(
				decide(facts({ path: join(PATHS.workspaceDir, relative) }), PATHS, CWD),
				relative,
			).toEqual({ kind: "allow" });
		}
	});

	it("脚本文件**不在**名单里（判据的另一半：命令会点它的名）", () => {
		/*
		 * `powershell ./deploy.ps1` 把文件名摆在 shell 审批弹窗里，用户看得见；
		 * 而 `git status` 不点 `.git/config` 的名。所以脚本文件不需要在写入时
		 * 再拦一次 —— 拦了只是给正常的「写个脚本再跑」流程加一次弹窗。
		 */
		for (const relative of ["deploy.ps1", "build.sh", join("scripts", "task.js")]) {
			expect(
				decide(facts({ path: join(PATHS.workspaceDir, relative) }), PATHS, CWD),
				relative,
			).toEqual({ kind: "allow" });
		}
	});

	it("目录本身不算（那是 mkdir 语义，危险的是里面的文件）", () => {
		expect(decide(facts({ path: join(PATHS.workspaceDir, ".pi") }), PATHS, CWD)).toEqual({
			kind: "allow",
		});
	});

	it("完全访问档不受此限（用户明示「不再逐次询问」）", () => {
		const target = join(PATHS.workspaceDir, ".git", "config");
		expect(decide(facts({ path: target }), PATHS, CWD, FULL)).toEqual({ kind: "allow" });
	});

	it("只读档仍然拒（阶段 3 先于本判定，语义不变）", () => {
		const target = join(PATHS.workspaceDir, "package.json");
		expect(decide(facts({ path: target }), PATHS, CWD, READONLY).kind).toBe("deny");
	});

	it("凭据禁区仍然优先（阶段 1 先于本判定）", () => {
		// 配置目录里的 package.json 该走「禁止读写配置与凭据文件」，不是本分支。
		const verdict = decide(facts({ path: join(PATHS.configDir, "package.json") }), PATHS, CWD);
		expect(verdict.kind).toBe("deny");
	});
});

/**
 * 链接穿越（2026-09-16 实测缺口的回归护栏）。
 *
 * 上面所有用例都用**磁盘上不存在的**假路径 —— 那测不到链接语义，
 * 而缺口恰恰只在真实文件系统上存在：工作区内建一个指向区外的 junction，
 * 判定曾经返回 `allow`（写落到区外且不弹窗；指向凭据目录时读也放行）。
 *
 * `scripts/probe-junction-containment.ts` 是这个缺口的独立证据，但它是脚本、
 * 不进 `npm test` —— 接线若被改回纯词法判定，没有任何测试会报警。这一组就是
 * 那道护栏，所以它必须用真实目录与真实链接。
 *
 * 用 junction（Windows）/ 目录 symlink（POSIX）：junction **不需要管理员权限**
 * 就能创建，所以这是模型真的走得通的路径，不是理论威胁。
 */
describe("链接穿越", () => {
	const LINK_TYPE = process.platform === "win32" ? "junction" : "dir";

	let root: string;
	let workspace: string;
	let outside: string;
	let secrets: string;
	let escapeLink: string;
	let secretLink: string;
	let linkPaths: PolicyPaths;

	beforeAll(() => {
		/*
		 * realpathSync.native 展开 8.3 短名（Windows 的 os.tmpdir() 返回
		 * `C:\Users\WANGZH~1\...`）。用 node 原语搭布景而不是用被测函数自己：
		 * 拿被测对象给自己搭台子，它错了测试会跟着一起错。
		 */
		root = realpathSync.native(mkdtempSync(join(tmpdir(), "kami-policy-link-")));
		workspace = join(root, "workspace");
		outside = join(root, "outside");
		// 假凭据目录：不碰用户真实的 ~/.ssh，对 decide() 而言两者完全等价。
		secrets = join(root, "fake-ssh");
		for (const dir of [workspace, outside, secrets]) mkdirSync(dir);
		writeFileSync(join(secrets, "id_rsa"), "FAKE-KEY-NOT-A-REAL-SECRET\n");

		escapeLink = join(workspace, "escape");
		symlinkSync(outside, escapeLink, LINK_TYPE);
		secretLink = join(workspace, "keys");
		symlinkSync(secrets, secretLink, LINK_TYPE);

		linkPaths = {
			workspaceDir: workspace,
			configDir: join(root, "config"),
			protectedDirs: [secrets],
		};
	});

	afterAll(() => {
		/*
		 * 先拆链接再删树。顺序要紧：递归删一个含链接的目录，若实现跟随了链接
		 * 就会连**链接指向的真实目录**一起删掉。
		 */
		for (const link of [escapeLink, secretLink]) {
			try {
				unlinkSync(link);
			} catch {
				// 已经不在就算了，清理失败不该盖掉测试结论。
			}
		}
		rmSync(root, { recursive: true, force: true });
	});

	it("经链接写到工作区之外**不再**免打扰放行（缺口本体）", () => {
		expect(
			decide(facts({ toolName: "write", path: join(escapeLink, "x.txt") }), linkPaths, workspace),
		).toMatchObject({ kind: "ask", risk: "medium" });
	});

	it("经链接读凭据目录仍然被禁区拦住（曾经是 allow）", () => {
		const verdict = decide(
			facts({ toolName: "read", path: join(secretLink, "id_rsa") }),
			linkPaths,
			workspace,
		);
		expect(verdict.kind).toBe("deny");
	});

	it("弹窗展示的是**真实去处**，不是链接路径", () => {
		/*
		 * 这条是知情同意的前提：若只归一化判定而把链接原样展示，用户以为在批准
		 * 「写工作区里的某个文件」，实际批准的是写区外 —— 那比不归一化更糟。
		 */
		const verdict = decide(
			facts({ toolName: "write", path: join(escapeLink, "x.txt") }),
			linkPaths,
			workspace,
		);
		if (verdict.kind !== "ask") throw new Error("应为 ask");
		expect(verdict.details).toBe(join(outside, "x.txt"));
	});

	it("对照组：工作区内的普通路径仍然免打扰放行（证明布景没把一切都拦掉）", () => {
		expect(
			decide(facts({ toolName: "write", path: join(workspace, "正常.md") }), linkPaths, workspace),
		).toEqual({ kind: "allow" });
	});

	it("两个不同链接指向同一目录时共用一次批准（rememberKey 同口径归一化）", () => {
		/*
		 * rememberKey 与判定链必须用同一口径：键若按链接路径记，用户批准过的
		 * 目录换个链接名进来就又被问一遍。这条把两处的一致性钉住。
		 */
		const viaLink = rememberKey(
			{ toolName: "write", path: join(escapeLink, "x.txt"), command: undefined },
			workspace,
		);
		const viaReal = rememberKey(
			{ toolName: "write", path: join(outside, "x.txt"), command: undefined },
			workspace,
		);
		expect(viaLink).toBe(viaReal);
	});
});
