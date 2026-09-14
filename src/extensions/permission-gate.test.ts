/**
 * 权限门的胶水层测试。
 *
 * permission-policy.test.ts 已经钉住了判定规则本身，这里测的是**接缝**：
 *   - 从 pi 的工具入参里取出路径（含 file_path 之类的别名）
 *   - allow / deny / ask 三条路各自返回什么给 pi
 *   - 「本次会话记住」是否真的不再询问，以及作用域是否隔离
 *
 * 这一层不需要模型也不需要 Electron —— 用一个假的 ExtensionAPI 捕获处理器即可。
 * 它正是「已测的策略」与「未测的真实运行」之间唯一的胶水，所以值得单独测。
 */

import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { appendPermissionRule } from "../core/permission-rules-store.ts";
import type { PermissionRequest, PermissionResponse } from "../shared/ipc.ts";
import { DEFAULT_PERMISSIONS, type PermissionSettings } from "../shared/permissions.ts";
import { createPermissionGate } from "./permission-gate.ts";
import { rememberRuleFromApproval, type PermissionRule } from "./permission-rules.ts";

const HOME = resolve(sep, "users", "someone");
const WORKSPACE = join(HOME, "KamiBuddy");
const CONFIG = join(HOME, ".kamibuddy");

/** pi 传给 tool_call 处理器的最小事件形状。 */
interface FakeToolCallEvent {
	readonly toolName: string;
	readonly input: Record<string, unknown>;
}

type Handler = (event: FakeToolCallEvent) => Promise<{ block?: boolean; reason?: string } | undefined>;

/**
 * 装好权限门，返回捕获到的 tool_call 处理器与审批调用记录。
 *
 * approve 决定每次审批的答复；undefined 表示拒绝。
 * 返回的 setSettings 可在运行中改权限档位 —— 镜像 daemon 的真实形态
 * （getSettings 读的是模块级变量，用户改预设后立即变），
 * 这样"切档后旧批准是否失效"才测得出来。
 * setRules 同理镜像 getRules 的 getter 形态：批准写回（appendRule）后，
 * 已装好的门下一次工具调用就该按新规则集判。
 */
function mount(options: {
	readonly approve?: (
		request: Omit<PermissionRequest, "id" | "sessionId">,
	) => PermissionResponse;
	readonly settings?: PermissionSettings;
	readonly rules?: readonly PermissionRule[];
}): {
	readonly call: Handler;
	readonly asked: Array<Omit<PermissionRequest, "id" | "sessionId">>;
	readonly setSettings: (next: PermissionSettings) => void;
	readonly setRules: (next: readonly PermissionRule[]) => void;
} {
	const asked: Array<Omit<PermissionRequest, "id" | "sessionId">> = [];
	let captured: Handler | undefined;
	let settings: PermissionSettings = options.settings ?? DEFAULT_PERMISSIONS;
	let rules: readonly PermissionRule[] = options.rules ?? [];

	const fakePi = {
		on: (event: string, handler: unknown) => {
			if (event === "tool_call") captured = handler as Handler;
		},
	} as unknown as ExtensionAPI;

	createPermissionGate({
		paths: { workspaceDir: WORKSPACE, configDir: CONFIG },
		cwd: WORKSPACE,
		getSettings: () => settings,
		getRules: () => rules,
		requestApproval: async (request) => {
			asked.push(request);
			return options.approve?.(request) ?? { id: "x", decision: "deny" };
		},
	})(fakePi);

	if (captured === undefined) throw new Error("权限门没有注册 tool_call 处理器");
	return {
		call: captured,
		asked,
		setSettings: (next) => {
			settings = next;
		},
		setRules: (next) => {
			rules = next;
		},
	};
}

describe("放行路径", () => {
	it("只读工具在工作目录内不询问，返回 undefined（不拦）", async () => {
		const { call, asked } = mount({});
		const result = await call({ toolName: "read", input: { path: join(WORKSPACE, "任意.txt") } });

		expect(result).toBeUndefined();
		expect(asked).toHaveLength(0);
	});

	it("只读工具出工作区要询问（用户允许后不拦）", async () => {
		/*
		 * 这条用例**翻转过**（2026-09-09）。原先区外读不询问直接放行；
		 * 当天事故证明读侧漫游是写越界的必经入口，判定链已把区外 read/find/grep/ls
		 * 改为低风险询问（详见 permission-policy.ts 文件头事故条目）。
		 */
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });
		const result = await call({ toolName: "read", input: { path: join(HOME, "任意.txt") } });

		expect(asked).toHaveLength(1);
		expect(asked[0]).toMatchObject({ toolName: "read", risk: "low" });
		expect(result).toBeUndefined();
	});

	it("写工作目录内不询问", async () => {
		const { call, asked } = mount({});
		const result = await call({ toolName: "write", input: { path: join(WORKSPACE, "周报.html") } });

		expect(result).toBeUndefined();
		expect(asked).toHaveLength(0);
	});
});

describe("拒绝路径", () => {
	it("写配置目录直接拦下，且不发起询问", async () => {
		// 关键：配置目录是 deny 而非 ask —— 连「允许」的机会都不给，
		// 因为 auth.json 存着 API Key，提示注入可能骗用户点允许。
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });
		const result = await call({ toolName: "write", input: { path: join(CONFIG, "auth.json") } });

		expect(result?.block).toBe(true);
		expect(asked).toHaveLength(0);
	});

	it("拦下时把原因回给模型，让它别重试同一件事", async () => {
		const { call } = mount({});
		const result = await call({ toolName: "write", input: { path: join(CONFIG, "auth.json") } });

		expect(result?.reason).toContain("配置");
	});

	it("用户拒绝时也拦下并附原因", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "deny" }) });
		const result = await call({ toolName: "write", input: { path: join(HOME, "Desktop", "x.txt") } });

		expect(asked).toHaveLength(1);
		expect(result?.block).toBe(true);
		expect(result?.reason).toContain("拒绝");
	});
});

describe("询问路径", () => {
	it("用户允许后不拦", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });
		const result = await call({ toolName: "write", input: { path: join(HOME, "Desktop", "x.txt") } });

		expect(asked).toHaveLength(1);
		expect(result).toBeUndefined();
	});

	it("询问内容带工具名、摘要、风险与解析后的绝对路径", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });
		await call({ toolName: "write", input: { path: "../隔壁/x.txt" } });

		expect(asked[0]).toMatchObject({
			toolName: "write",
			risk: "medium",
			// 给用户看「../x.txt」没有意义，必须显示它实际指向哪。
			details: resolve(HOME, "隔壁", "x.txt"),
		});
		expect(asked[0]?.summary).not.toBe("");
	});

	it("shell 命令按高风险询问，并把完整命令给用户看", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });
		await call({ toolName: "bash", input: { command: "git push --force" } });

		expect(asked[0]).toMatchObject({ risk: "high", details: "git push --force" });
	});
});

describe("入参别名", () => {
	// pi 内置工具用 path，自定义工具常用 file_path / filePath。
	// 取不到路径会让判定退化成「未知工具」，从而对本该放行的写入也弹窗。
	it("识别 file_path", async () => {
		const { call, asked } = mount({});
		const result = await call({ toolName: "write", input: { file_path: join(WORKSPACE, "a.md") } });

		expect(result).toBeUndefined();
		expect(asked).toHaveLength(0);
	});

	it("识别 filePath", async () => {
		const { call, asked } = mount({});
		const result = await call({ toolName: "write", input: { filePath: join(WORKSPACE, "a.md") } });

		expect(result).toBeUndefined();
		expect(asked).toHaveLength(0);
	});

	it("docx_convert 判定锚定 outputPath（产物在工作区内放行、不拿 htmlPath 判）", async () => {
		const { call, asked } = mount({});
		// htmlPath 故意给区外路径：产物才是写侧风险，锚错参数会误弹窗。
		const result = await call({
			toolName: "docx_convert",
			input: {
				htmlPath: join(HOME, "别处", "a.html"),
				outputPath: join(WORKSPACE, "a.docx"),
			},
		});

		expect(result).toBeUndefined();
		expect(asked).toHaveLength(0);
	});

	it("docx_convert 产物出工作区 → 询问", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });
		const result = await call({
			toolName: "docx_convert",
			input: { htmlPath: join(WORKSPACE, "a.html"), outputPath: join(HOME, "a.docx") },
		});

		expect(asked).toHaveLength(1);
		expect(asked[0]).toMatchObject({ toolName: "docx_convert", risk: "medium" });
		expect(result).toBeUndefined();
	});

	it("路径缺失时拒绝，而不是放行", async () => {
		const { call } = mount({});
		const result = await call({ toolName: "write", input: {} });

		expect(result?.block).toBe(true);
	});
});

describe("本次会话记住", () => {
	it("勾选后同目录不再询问", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow", remember: true }) });

		await call({ toolName: "write", input: { path: join(HOME, "Desktop", "a.txt") } });
		const second = await call({ toolName: "write", input: { path: join(HOME, "Desktop", "b.txt") } });

		expect(asked).toHaveLength(1);
		expect(second).toBeUndefined();
	});

	it("不勾选则每次都问", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });

		await call({ toolName: "write", input: { path: join(HOME, "Desktop", "a.txt") } });
		await call({ toolName: "write", input: { path: join(HOME, "Desktop", "b.txt") } });

		expect(asked).toHaveLength(2);
	});

	it("记住的作用域不跨目录 —— 批准写桌面不等于批准写系统目录", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow", remember: true }) });

		await call({ toolName: "write", input: { path: join(HOME, "Desktop", "a.txt") } });
		await call({ toolName: "write", input: { path: resolve(sep, "Windows", "evil.dll") } });

		expect(asked).toHaveLength(2);
	});

	it("记住的作用域不跨工具 —— 批准 write 不等于批准 bash", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow", remember: true }) });
		const target = join(HOME, "Desktop", "a.txt");

		await call({ toolName: "write", input: { path: target } });
		await call({ toolName: "edit", input: { path: target } });

		expect(asked).toHaveLength(2);
	});

	it("记住不会绕过配置目录的硬性拒绝", async () => {
		// 即便用户对某目录点过「记住」，配置目录仍然走 deny 分支 ——
		// 顺序上 decide() 先于 remembered 检查。
		const { call } = mount({ approve: () => ({ id: "x", decision: "allow", remember: true }) });

		await call({ toolName: "write", input: { path: join(HOME, "Desktop", "a.txt") } });
		const result = await call({ toolName: "write", input: { path: join(CONFIG, "auth.json") } });

		expect(result?.block).toBe(true);
	});

	it("高风险操作即使响应带 remember:true 也不记住 —— 每次都问", async () => {
		/*
		 * 双保险（permission-gate.ts ask 分支）：UI 已不对高风险提供「记住」选项，
		 * 但响应来自 IPC，不信任对端。shell 一旦可记住就是会话内免检，
		 * 没有危险命令分类器时等于把路径保护全部烧穿。
		 * 这里伪造一个带 remember:true 的高风险响应（UI 不会真的发这个），
		 * 钉住 gate 侧的忽略行为。
		 */
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow", remember: true }) });

		await call({ toolName: "bash", input: { command: "git status" } });
		const second = await call({ toolName: "bash", input: { command: "git status" } });

		expect(asked).toHaveLength(2);
		expect(second).toBeUndefined();
	});
});

/* ── 权限档位的运行时切换 ────────────────────────────────────────── */

describe("设置每次现读（getter 而非快照）", () => {
	const OUTSIDE = join(HOME, "Desktop", "报表.xlsx");

	it("切到更宽的档位后，原本要问的写入不再询问", async () => {
		const { call, asked, setSettings } = mount({
			approve: () => ({ id: "x", decision: "allow" }),
		});

		// 默认档：工作区外要问。
		await call({ toolName: "write", input: { path: OUTSIDE } });
		expect(asked).toHaveLength(1);

		// 用户在设置页切到「允许完全访问」——不该等到重开会话才生效。
		setSettings({ sandbox: "danger-full-access", approval: "never" });
		const result = await call({ toolName: "write", input: { path: OUTSIDE } });

		expect(result).toBeUndefined(); // 放行
		expect(asked).toHaveLength(1); // 没有新增询问
	});

	it("★ 切到更严的档位后，先前「记住」的批准立即失效", async () => {
		/*
		 * 这条是本文件最容易被无声破坏的行为，也是我在实现里声明过的语义：
		 * remembered 检查排在 decide() 之后，所以模式收紧时旧批准自然失效。
		 * 若哪天有人为了"少弹窗"把 remembered 提到 decide() 前面，
		 * 「切成只读」就会变成一句空话 —— 这个用例就是那道护栏。
		 */
		const { call, setSettings } = mount({
			approve: () => ({ id: "x", decision: "allow", remember: true }),
		});

		// 先在默认档批准并记住"写桌面"。
		const first = await call({ toolName: "write", input: { path: OUTSIDE } });
		expect(first).toBeUndefined();

		// 切成只读后，同一个操作必须被拒 —— 哪怕用户确实批准过。
		setSettings({ sandbox: "read-only", approval: "ask" });
		const after = await call({ toolName: "write", input: { path: OUTSIDE } });

		expect(after?.block).toBe(true);
		expect(after?.reason).toContain("只读");
	});

	it("审批策略切成 never 后，原本要问的操作变成拒绝而非放行", async () => {
		// never 的语义是「确定性拒绝」（照 dsh）：无人值守时"不问"等于"不做"。
		// 方向搞反就是个静默后门，所以单独钉一条。
		const { call, asked, setSettings } = mount({
			approve: () => ({ id: "x", decision: "allow" }),
		});

		setSettings({ sandbox: "workspace-write", approval: "never" });
		const result = await call({ toolName: "write", input: { path: OUTSIDE } });

		expect(result?.block).toBe(true);
		expect(asked).toHaveLength(0); // 没有弹窗
	});

	it("never 档位下，工作区内的正常写入不受影响", async () => {
		// 免得把「不打扰」做成「什么都干不了」。
		const { call, setSettings } = mount({});
		setSettings({ sandbox: "workspace-write", approval: "never" });

		const result = await call({
			toolName: "write",
			input: { path: join(WORKSPACE, "报告.md") },
		});

		expect(result).toBeUndefined();
	});

	it("不传 getSettings 时行为等于默认档（向后兼容）", async () => {
		// daemon 之外还有 smoke 脚本等调用方，省略该参数不能改变行为。
		const asked: Array<Omit<PermissionRequest, "id" | "sessionId">> = [];
		let captured: Handler | undefined;
		const fakePi = {
			on: (event: string, handler: unknown) => {
				if (event === "tool_call") captured = handler as Handler;
			},
		} as unknown as ExtensionAPI;

		createPermissionGate({
			paths: { workspaceDir: WORKSPACE, configDir: CONFIG },
			cwd: WORKSPACE,
			requestApproval: async (request) => {
				asked.push(request);
				return { id: "x", decision: "allow" };
			},
		})(fakePi);

		if (captured === undefined) throw new Error("未注册处理器");

		// 工作区内放行、区外询问 —— 与 DEFAULT_PERMISSIONS 一致。
		expect(await captured({ toolName: "write", input: { path: join(WORKSPACE, "a.md") } })).toBeUndefined();
		expect(await captured({ toolName: "write", input: { path: OUTSIDE } })).toBeUndefined();
		expect(asked).toHaveLength(1);
	});
});

/* ── powershell 持久前缀规则（getRules 透传，spec: add-permission-rules-engine） ── */

describe("powershell 前缀规则（getRules 透传）", () => {
	it("allow 规则命中：不弹窗直接放行", async () => {
		const { call, asked } = mount({ rules: [{ tool: "powershell", prefix: "git", action: "allow" }] });

		const result = await call({ toolName: "powershell", input: { command: "git status --short" } });

		expect(result).toBeUndefined();
		expect(asked).toHaveLength(0);
	});

	it("deny 规则命中：直拒不弹窗，原因（含规则来源）回给模型", async () => {
		const { call, asked } = mount({ rules: [{ tool: "powershell", prefix: "Remove-Item", action: "deny" }] });

		const result = await call({ toolName: "powershell", input: { command: "Remove-Item ./a" } });

		expect(result?.block).toBe(true);
		expect(result?.reason).toContain("Remove-Item");
		expect(asked).toHaveLength(0);
	});

	it("拆分最严获胜：git allow 下 `git status && Remove-Item ./dist` 仍高风险弹窗", async () => {
		// 第二段无命中 → 规则不表态 → 维持现状询问，不被 git 规则放行。
		const { call, asked } = mount({
			approve: () => ({ id: "x", decision: "allow" }),
			rules: [{ tool: "powershell", prefix: "git", action: "allow" }],
		});

		await call({ toolName: "powershell", input: { command: "git status && Remove-Item ./dist" } });

		expect(asked).toHaveLength(1);
		expect(asked[0]).toMatchObject({ toolName: "powershell", risk: "high" });
	});

	it("read-only 档下 allow 规则不生效（规则阶段在只读拒绝之后）", async () => {
		const { call, asked } = mount({
			settings: { sandbox: "read-only", approval: "ask" },
			rules: [{ tool: "powershell", prefix: "git", action: "allow" }],
		});

		const result = await call({ toolName: "powershell", input: { command: "git status" } });

		expect(result?.block).toBe(true);
		expect(asked).toHaveLength(0);
	});

	it("规则放行与「本次会话记住」互不相干：allow 规则命中不经过 remembered", async () => {
		// shell 询问是高风险，remembered 本来就不记它（gate 的双保险）；
		// 规则是 shell 唯一的免问通道 —— 钉住「规则 allow 后 bash 同类命令仍要问」
		// 的边界：免问效果来自规则本身，不是记住了什么。
		const { call, asked } = mount({ rules: [{ tool: "powershell", prefix: "git", action: "allow" }] });

		await call({ toolName: "powershell", input: { command: "git status" } });
		await call({ toolName: "bash", input: { command: "git status" } });

		expect(asked).toHaveLength(1); // 只有 bash 弹了窗
		expect(asked[0]).toMatchObject({ toolName: "bash", risk: "high" });
	});
});

/* ── 批准写回（rememberPrefix → 规则 → 免问，spec Task 3） ────────────── */

describe("批准写回（rememberPrefix → 规则 → 免问）", () => {
	/*
	 * daemon/index.ts 无法直接单测（模块顶层 requireParentPort 在非 utilityProcess
	 * 下即抛），所以这里用「门 + daemon 回程 handler 的同款纯函数」复现整条链路：
	 *   审批响应带 rememberPrefix → rememberRuleFromApproval 校验构造
	 *   → appendPermissionRule 幂等并入 → 门的 getRules 下一次调用即按新规则判。
	 * 校验本身的边界用例（解释器/分隔符/空白/非 powershell/deny）在
	 * permission-rules.test.ts 的 rememberRuleFromApproval 套件里。
	 */
	it("端到端链路：勾选写回并允许后，同类命令不再弹窗", async () => {
		const { call, asked, setRules } = mount({
			approve: () => ({ id: "x", decision: "allow", rememberPrefix: "git" }),
		});

		// 第一次：无规则，高风险弹窗；用户勾「以后都允许「git」开头的命令」并允许。
		const first = await call({ toolName: "powershell", input: { command: "git log --oneline" } });
		expect(first).toBeUndefined();
		expect(asked).toHaveLength(1);
		expect(asked[0]).toMatchObject({ toolName: "powershell", risk: "high" });

		// daemon 审批回程 handler 的同款路径：校验载荷 → 构造规则 → 幂等并入内存规则集。
		const rule = rememberRuleFromApproval("powershell", { decision: "allow", rememberPrefix: "git" });
		expect(rule).toEqual({ tool: "powershell", prefix: "git", action: "allow" });
		if (rule === undefined) throw new Error("应产出规则");
		setRules(appendPermissionRule(rule, []));

		// 后续同类命令命中 allow 规则，免弹窗 —— 「写回即刻生效」由 getRules getter 保证。
		const second = await call({ toolName: "powershell", input: { command: "git diff" } });
		expect(second).toBeUndefined();
		expect(asked).toHaveLength(1);
	});

	it("幂等：同一条规则重复写回，规则集引用不变（不落盘）", () => {
		const rule = rememberRuleFromApproval("powershell", { decision: "allow", rememberPrefix: "git" });
		if (rule === undefined) throw new Error("应产出规则");
		const once = appendPermissionRule(rule, []);
		expect(appendPermissionRule(rule, once)).toBe(once);
	});

	it("非法 rememberPrefix 载荷不产生规则，同类命令仍逐次询问", async () => {
		// 解释器前缀：写回它等于允许一切，daemon 侧必须忽略（弹窗本就不显示该选项，
		// 这里模拟的是被篡改的渲染进程硬发）。
		const { call, asked } = mount({
			approve: () => ({ id: "x", decision: "allow", rememberPrefix: "python" }),
		});

		await call({ toolName: "powershell", input: { command: "python script.py" } });
		const rule = rememberRuleFromApproval("powershell", { decision: "allow", rememberPrefix: "python" });
		expect(rule).toBeUndefined();
		// 规则集维持为空（setRules 从未被调），下一次同类命令照样弹窗。
		await call({ toolName: "powershell", input: { command: "python other.py" } });
		expect(asked).toHaveLength(2);
	});
});

/* ── 区外读弹窗的路径写回（writeBackPath，spec: extend-permission-rules-to-paths Task 2） ── */

describe("区外读弹窗的 writeBackPath（路径写回资格）", () => {
	it("区外读的低风险询问带 writeBackPath（= 解析后的绝对目标路径）", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });
		// 容器目录场景：工作区的父级，正是 spec 要免问的动机。
		const target = join(HOME, "KamiBuddy-other", "notes");

		await call({ toolName: "ls", input: { path: target } });

		expect(asked).toHaveLength(1);
		expect(asked[0]).toMatchObject({
			toolName: "ls",
			risk: "low",
			details: resolve(target),
			writeBackPath: resolve(target),
		});
	});

	it("powershell 询问不带 writeBackPath（命令写回走首词通道，与路径写回互斥）", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });

		await call({ toolName: "powershell", input: { command: "git status" } });

		expect(asked).toHaveLength(1);
		expect(asked[0]?.writeBackPath).toBeUndefined();
	});

	it("区外写的中风险询问不带 writeBackPath（写工具的路径规则是 spec 明确不做的部分）", async () => {
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });

		await call({ toolName: "write", input: { path: join(HOME, "Desktop", "x.txt") } });

		expect(asked).toHaveLength(1);
		expect(asked[0]?.writeBackPath).toBeUndefined();
	});

	it("读凭据/配置目录内的目标走不到弹窗 —— 阶段 1 直拒，禁区内路径永不出现在写回载荷里", async () => {
		/*
		 * writeBackPath 的禁区复核（readWriteBackTarget）是纵深防御：真实链路里
		 * 这类目标在 policy 阶段 1 就已 deny，根本到不了 ask。这里钉住的是
		 * 链路灯本身 —— 保证「禁区内目标不弹窗」这个前提不被将来改动悄悄破坏。
		 */
		const { call, asked } = mount({ approve: () => ({ id: "x", decision: "allow" }) });

		const denied = await call({ toolName: "read", input: { path: join(CONFIG, "auth.json") } });

		expect(denied?.block).toBe(true);
		expect(asked).toHaveLength(0);
	});

	it("写回链路：勾选并允许后产出 tool:read 规则，同目录树的后续读取（含换家族工具）免弹窗", async () => {
		/*
		 * daemon/index.ts 无法直接单测，这里复现其审批回程的同款纯函数链路：
		 *   弹窗载荷的 writeBackPath → renderer 原样回填 rememberPrefix
		 *   → rememberRuleFromApproval 带禁区复核构造规则 → appendPermissionRule
		 *   幂等并入 → 门的 getRules 下一次调用即按新规则判。
		 * 与 powershell 套件同构；钉的是 Task 2 特有的接缝：ls 上批准的写回
		 * 产出 tool:"read" 规则，对换用 grep 的同类读取同样免问（家族语义）。
		 */
		const target = join(HOME, "KamiBuddy-other", "notes");
		let writeBack = "";
		const { call, asked, setRules } = mount({
			approve: (request) => {
				writeBack = request.writeBackPath ?? "";
				return { id: "x", decision: "allow", rememberPrefix: writeBack };
			},
		});

		// 第一次：无规则，低风险弹窗；用户勾「以后都允许读取此路径（及子目录）」并允许。
		const first = await call({ toolName: "ls", input: { path: target } });
		expect(first).toBeUndefined();
		expect(asked).toHaveLength(1);
		expect(writeBack).toBe(resolve(target));

		// daemon 回程同款：禁区校验（configDir 必在其中）→ 构造规则 → 幂等并入内存规则集。
		const rule = rememberRuleFromApproval("ls", { decision: "allow", rememberPrefix: writeBack }, [CONFIG]);
		expect(rule).toEqual({ tool: "read", prefix: resolve(target), action: "allow" });
		if (rule === undefined) throw new Error("应产出规则");
		setRules(appendPermissionRule(rule, []));

		// 后续读同目录树免弹窗；换家族工具（grep）同样命中 tool:read 规则。
		expect(await call({ toolName: "read", input: { path: join(target, "a.md") } })).toBeUndefined();
		expect(await call({ toolName: "grep", input: { path: join(target, "sub") } })).toBeUndefined();
		expect(asked).toHaveLength(1);
	});
});
