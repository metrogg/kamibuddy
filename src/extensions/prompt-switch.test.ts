/**
 * 提示词切换扩展的胶水测试（仿 permission-gate.test 的假 ExtensionAPI）。
 *
 * 策略本体在 prompt-composer / resources 里测过了，这里钉两类东西：
 *   1. 接缝：before_agent_start 被注册、每次触发都带「当时的两轴」去 compose、
 *      compose 的返回值原样成为 systemPrompt；以及逐轮可变事实的 context 注入
 *      （追加在消息末尾、不落盘、空串不注入）。
 *   2. 缓存前缀不变量：同一会话连续两轮、只推进墙钟时间，系统提示词必须逐字节
 *      相等 —— 组装**走生产入口**（core/system-prompt-composer.ts 的
 *      createSystemPromptComposerFromDefaults，与 daemon 同一个函数），用**真实
 *      resources/**（两个场景 × 三个模式全组合）来证（spec: stabilize-prompt-prefix）。
 *      「用同款输入自己镜像一遍」的旧写法已删：镜像测的不是生产组装，往生产那份里
 *      拼一处逐轮可变事实它不会红 —— 那正是这条门禁要堵的洞。
 */

import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkills, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getResourcesDir } from "../core/config-paths.ts";
import type { PromptContextOptions, SkillDescriptor } from "../core/prompt-composer.ts";
import {
	createSystemPromptComposerFromDefaults,
	type SystemPromptComposer,
	type SystemPromptComposerDefaults,
} from "../core/system-prompt-composer.ts";
import { RUNTIME_CONTEXT_CUSTOM_TYPE } from "../shared/observability.ts";
import { createPromptSwitch } from "./prompt-switch.ts";

type Handler = (event: {
	readonly systemPromptOptions: {
		contextFiles?: PromptContextOptions["contextFiles"];
		toolSnippets?: PromptContextOptions["toolSnippets"];
		promptGuidelines?: PromptContextOptions["promptGuidelines"];
	};
}) => Promise<{ systemPrompt?: string } | undefined>;

/** context 事件的最小形状：消息数组 + 返回值里的 messages。 */
interface InjectMessage {
	readonly role: string;
	readonly customType?: string;
	readonly content?: unknown;
	readonly display?: boolean;
}
type ContextHandler = (event: {
	readonly messages: readonly InjectMessage[];
}) => { readonly messages: readonly InjectMessage[] } | undefined;

interface Mounted {
	readonly handler: Handler;
	readonly context: ContextHandler;
}

const EMPTY_EVENT = { systemPromptOptions: {} } as Parameters<Handler>[0];
const USER_MESSAGE = { role: "user", content: "你好" };
/** 注入块样例：现在只有记忆内容 / 个性化走这条路径（时间走 hidden context）。 */
const RUNTIME_BLOCK = "## 长期记忆（用户级）\n\n报告一律用表格呈现数据。";

function mount(options: {
	readonly axes: { sceneId: string; interactionId: string; expertId?: string };
	readonly compose: (
		sceneId: string,
		interactionId: string,
		expertId: string | undefined,
		piContext: PromptContextOptions,
	) => Promise<string>;
	readonly runtimeContext?: () => string;
}): Mounted {
	let handler: Handler | undefined;
	let context: ContextHandler | undefined;
	const fakePi = {
		on: (event: string, value: unknown) => {
			if (event === "before_agent_start") handler = value as Handler;
			if (event === "context") context = value as ContextHandler;
		},
	} as unknown as ExtensionAPI;

	createPromptSwitch({
		getCurrent: () => options.axes,
		compose: options.compose,
		composeRuntimeContext: options.runtimeContext ?? (() => ""),
	})(fakePi);

	if (handler === undefined) throw new Error("没有注册 before_agent_start 处理器");
	if (context === undefined) throw new Error("没有注册 context 处理器");
	return { handler, context };
}

describe("before_agent_start 接缝", () => {
	it("返回值必须含 systemPrompt（forced 替换是既定路线，被关掉就漏出 pi 默认 coding 提示词）", async () => {
		/*
		 * 反向钉子（Task 5.1 的订正版）：断言的是「**必须**有 systemPrompt」，
		 * 不是「不该有」—— 早期的「不返回 systemPrompt」版本随探针结论作废。
		 *
		 * 路线判据（spec.md 末尾「探针结论（实测）」①）：发布依赖
		 * @earendil-works/pi-coding-agent@0.85.1 的 BuildSystemPromptOptions 没有
		 * sections / forceSystemPrompt，emitBeforeAgentStart 只认 handler 返回的
		 * systemPrompt 字符串（agent-session.js 把它整串写进 agent.state.systemPrompt）
		 * —— 发布版里根本没有声明式分段路径（那份带 sections 的是开源项目/pi 的
		 * 未发布源码），返回 systemPrompt 是当前唯一能接上自家提示词的接线。
		 *
		 * 所以有人「顺手」把它删掉 / 返回 undefined 时，pi 会退回它自带的
		 * coding 提示词 —— 产品身份错误且无声。这条钉子就是拦这个：
		 */
		const { handler } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "组装后的提示词",
		});
		const result = await handler(EMPTY_EVENT);
		expect(result).toBeDefined();
		expect(result).toHaveProperty("systemPrompt");
		expect(result?.systemPrompt).toBe("组装后的提示词");
	});

	it("每次触发都读当前两轴（模式切换后下一轮生效）", async () => {
		const axes = { sceneId: "work", interactionId: "craft" };
		const seen: string[] = [];
		const { handler } = mount({
			axes,
			compose: async (sceneId, interactionId) => {
				seen.push(`${sceneId}/${interactionId}`);
				return `${sceneId}/${interactionId}`;
			},
		});

		await handler(EMPTY_EVENT);
		axes.interactionId = "ask";
		const second = await handler(EMPTY_EVENT);

		expect(seen).toEqual(["work/craft", "work/ask"]);
		expect(second?.systemPrompt).toBe("work/ask");
	});

	it("expertId 与交互模式正交：各自独立透传给 compose（模式切换不清专家）", async () => {
		const axes: { sceneId: string; interactionId: string; expertId?: string } = {
			sceneId: "work",
			interactionId: "plan",
			expertId: "work-report",
		};
		const seen: Array<{ interactionId: string; expertId: string | undefined }> = [];
		const { handler } = mount({
			axes,
			compose: async (_sceneId, interactionId, expertId) => {
				seen.push({ interactionId, expertId });
				return "ok";
			},
		});

		await handler(EMPTY_EVENT);
		// 切模式不清专家：模式改成 ask，expertId 不动（state 权威在宿主，这里只验证透传不缓存）。
		axes.interactionId = "ask";
		await handler(EMPTY_EVENT);
		// 取消专家不改模式：expertId 清空，模式仍是 ask。
		axes.expertId = undefined;
		await handler(EMPTY_EVENT);

		expect(seen).toEqual([
			{ interactionId: "plan", expertId: "work-report" },
			{ interactionId: "ask", expertId: "work-report" },
			{ interactionId: "ask", expertId: undefined },
		]);
	});

	it("compose 抛错时向上传播，不静默回落到 pi 默认提示词", async () => {
		// 回落到 coding assistant 等于产品身份错误且无声 —— 必须响亮。
		const { handler } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => {
				throw new Error("资源坏了");
			},
		});
		await expect(handler(EMPTY_EVENT)).rejects.toThrow("资源坏了");
	});
});

describe("context 接缝：逐轮可变事实的消息注入", () => {
	it("注入块追加在消息数组末尾（落在对话历史之后，不会让前缀失配）", () => {
		const { context } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			runtimeContext: () => RUNTIME_BLOCK,
		});
		const result = context({ messages: [USER_MESSAGE] });
		expect(result?.messages).toHaveLength(2);
		// 原有消息原样在前（含本次的用户消息）——注入块只能在它们之后。
		expect(result?.messages[0]).toBe(USER_MESSAGE);
		expect(result?.messages[1]).toMatchObject({
			role: "custom",
			customType: RUNTIME_CONTEXT_CUSTOM_TYPE,
			content: RUNTIME_BLOCK,
			display: false,
		});
	});

	it("原消息顺序不变：注入只追加在末尾，历史逐条原样（含对象引用）", () => {
		// 「追加在末尾」是缓冲不变量的一半：注入块自己逐轮都变，但它落在历史之后，
		// 所以不可能让系统提示词与既有历史失配。重排、插到中间、就地改写任何一条
		// 原消息都会破坏这条 —— 所以这里钉的是「只追加」，不只是「注入存在」。
		const history = [
			{ role: "user", content: "第一轮提问" },
			{ role: "assistant", content: "第一轮回复" },
			{ role: "tool", content: "工具结果" },
			{ role: "user", content: "第二轮提问" },
		];
		const { context } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			runtimeContext: () => RUNTIME_BLOCK,
		});
		const result = context({ messages: history });
		expect(result?.messages).toHaveLength(history.length + 1);
		history.forEach((message, index) => {
			expect(result?.messages[index]).toBe(message);
		});
		expect(result?.messages.at(-1)).toMatchObject({
			role: "custom",
			customType: RUNTIME_CONTEXT_CUSTOM_TYPE,
		});
	});

	it("每次模型调用都现读注入块（run 内的后续回合也要拿到最新事实）", () => {
		let text = "第一版";
		const { context } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			runtimeContext: () => text,
		});
		const first = context({ messages: [USER_MESSAGE] });
		text = "第二版";
		const second = context({ messages: [USER_MESSAGE] });
		expect(first?.messages[1]?.content).toBe("第一版");
		expect(second?.messages[1]?.content).toBe("第二版");
	});

	it("注入块为空串 → 不注入（零 token 口径，消息原样返回）", () => {
		const { context } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			runtimeContext: () => "  \n ",
		});
		expect(context({ messages: [USER_MESSAGE] })).toBeUndefined();
	});
});

/**
 * 真资源只加载一次（六个组合用例共用）；技能加载指向临时 agentDir，不读用户配置目录
 * —— 用户级技能/开关是用户数据，不属这条不变量，读进来只会让结果随机器变。
 */
let realSkills: readonly SkillDescriptor[];
let skillsAgentDir: string;
/**
 * **生产组装入口**（与 daemon 用的同一个构造函数）。门禁钉的是它，不是镜像：
 * daemon 顶层要 process.parentPort（测试 import 不进来），把组装本体搬进
 * core/system-prompt-composer.ts 之后，两边跑的就是同一段代码路径。
 *
 * 与 daemon 的构造参数差异只有用户数据那三样（技能清单 / 专家库 / 偏好），
 * 且都是**注入值**而非另一段逻辑：测试给固定的内置技能、空专家库、无偏好。
 */
let compose: SystemPromptComposer;

/**
 * 门禁专用组装器：与上面那个同函数、同真资源，**只把技能清单置空**。
 *
 * 为什么单开一个而不是复用 `compose`：pi 的 formatSkillsForPrompt 会把每个技能的
 * 绝对 `<location>` 写进技能清单段（本机上就是本仓库 resources/skills 的路径），
 * 那是 pi 的形态、随**应用安装位置**变 —— 它属「机器相关路径」门禁的既定例外
 * （随安装位置变是事实，但拦它要动 pi 的清单格式，不在本改动范围）。把技能段算进
 * 门禁有两个坏处：① 项目恰好放在用户家目录下的机器会把门禁扫红（与改动质量无关）；
 * ② 真出问题时说不清是「我们塞了路径」还是「pi 的技能清单本来就这样」。
 * 置空后本门禁钉的东西是确定的：**我们自己的资源（骨架 / 片段 / 模式 / 风格 /
 * 记忆纪律段）里不许有任何机器相关绝对路径**。
 */
let composeWithoutSkills: SystemPromptComposer;

/**
 * 两个组装器共用的注入项（技能清单是唯一差异）。
 *   - 不绑专家：组装器对 expertId === undefined 短路，专家库不会被读到
 *     （这也是 daemon 侧的既定语义 —— 未绑定专家不走专家库那条从紧的读路径）。
 *   - 偏好是**用户数据**：注入固定值，免得测试机上的风格设置改变产物
 *     （与「真实 resources/」不冲突：资源是随应用分发的，偏好不是）。
 *   - 风格漂移落点在本用例不该被触发（偏好里没有 styleId）；生产里它写事件日志。
 */
const COMPOSER_DEFAULTS: Omit<SystemPromptComposerDefaults, "enabledSkills"> = {
	resourcesDir: getResourcesDir(),
	loadExperts: () => [],
	onStyleDrift: () => {},
	readPreferences: () => ({ activeModelKey: undefined }),
};

beforeAll(() => {
	skillsAgentDir = mkdtempSync(join(tmpdir(), "kami-prompt-stability-"));
	realSkills = loadSkills({
		cwd: skillsAgentDir,
		agentDir: skillsAgentDir,
		skillPaths: [join(getResourcesDir(), "skills")],
		includeDefaults: false,
	}).skills.map((skill) => ({
		name: skill.name,
		description: skill.description,
		filePath: skill.filePath,
		disableModelInvocation: skill.disableModelInvocation === true,
	}));
	compose = createSystemPromptComposerFromDefaults({
		...COMPOSER_DEFAULTS,
		enabledSkills: () => realSkills,
	});
	composeWithoutSkills = createSystemPromptComposerFromDefaults({
		...COMPOSER_DEFAULTS,
		enabledSkills: () => [],
	});
});

afterAll(() => {
	rmSync(skillsAgentDir, { recursive: true, force: true });
});

describe("同会话系统提示词字节稳定（缓存前缀不变量，Task 5.2）", () => {
	/*
	 * 为什么这条是缓存不变量：provider 的前缀缓存比的是**最长公共前缀**，而系统
	 * 提示词位于整段对话历史之前 —— 它内部任何一个字节的变化，都会让它**之后的
	 * 一切（含整段历史）**在缓存里失配，代价随会话长度放大。实测口径：提示词字节
	 * 一字未变的那一轮首调命中 93%，变更一处即掉到 62%（spec.md 探针结论②）。
	 * 所以「逐轮会变的事实一律走 append-only 注入」之外，还必须有这一条：**系统
	 * 提示词在同一会话内逐字节可复现**。
	 *
	 * 用真资源组装而不是注入桩：骨架 / 片段 / 模式 / 风格 / 记忆纪律段这些**文件
	 * 内容**本身就是前缀的一部分，文件里混进日期、版本号、「今天」之类的东西同样
	 * 会断前缀 —— 只有真资源能拦住这种事故。
	 */
	const SCENES = ["work", "code"] as const;
	const MODES = ["craft", "ask", "plan"] as const;

	/**
	 * 本会话的工作目录。它**不是**系统提示词的输入：唯一出口是 hidden context 的
	 * workspace_context（正侧断言在 core/session-host.test.ts）。这里用一条具体且
	 * 独特的路径 —— 空目录那种输入天然不出现在任何文本里，那样的断言证明不了东西。
	 */
	const SESSION_CWD = "C:\\Users\\kami\\KamiBuddy\\临时任务\\20260917-1200-report";

	/** 两轮之间只推进墙钟：权限 / 设置 / 记忆 / 技能一律不动（本用例只动时间这一维）。 */
	const FIRST_TURN_AT = new Date("2026-09-17T09:59:59");
	/** 跨过分钟、小时与日期边界 —— 任何按「现在」渲染的形态都会在这里变。 */
	const SECOND_TURN_AT = new Date("2026-09-18T11:01:00");

	/** pi 在事件里给好的上下文（真实会话同形）：它拼进系统提示词，同样必须稳定。 */
	const PI_CONTEXT_EVENT = {
		systemPromptOptions: {
			contextFiles: [{ path: "C:\\ws\\AGENTS.md", content: "项目约定：提交前跑 typecheck。" }],
			toolSnippets: { web_search: "需要实时信息时先搜索" },
			promptGuidelines: ["一次搜索失败可换措辞重试一次"],
		},
	} as Parameters<Handler>[0];

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	for (const sceneId of SCENES) {
		for (const modeId of MODES) {
			it(`${sceneId} × ${modeId}：只推进墙钟，两轮系统提示词严格相等`, async () => {
				// 组装走生产入口（与 daemon 同一个函数），透传 pi 事件里的真实上下文。
				const { handler } = mount({
					axes: { sceneId, interactionId: modeId },
					compose: async (scene, interaction, expertId, piContext) =>
						compose({ sceneId: scene, interactionId: interaction, expertId, piContext }).prompt,
				});

				vi.setSystemTime(FIRST_TURN_AT);
				const first = await handler(PI_CONTEXT_EVENT);

				vi.setSystemTime(SECOND_TURN_AT);
				// 时钟确实推进了 —— 否则「两轮相等」可能只是「时钟没动」的假绿。
				expect(Date.now()).toBeGreaterThan(FIRST_TURN_AT.getTime());
				const second = await handler(PI_CONTEXT_EVENT);

				// 非空守卫：两边都是空串也会「相等」。
				expect(first?.systemPrompt?.length ?? 0).toBeGreaterThan(1_000);
				// 组装是真的（piContext 拼回来了）—— 与下面的负向断言互为反证。
				expect(first?.systemPrompt).toContain("C:\\ws\\AGENTS.md");
				expect(second?.systemPrompt).toBe(first?.systemPrompt);

				const prompt = first?.systemPrompt ?? "";
				// cwd 单出口（负侧）：工作目录只经 hidden context 送达，进系统提示词
				// 就等于「换工作区即断前缀」（骨架曾有一行 `当前工作目录：{{cwd}}`，
				// 位于历史之前的最毒位置 —— spec: stabilize-prompt-prefix 的
				// REMOVED Requirements）。真写回来时 composer 会因未支持的槽位抛错，
				// 这里再钉一道文本层。
				expect(prompt).not.toContain(SESSION_CWD);
				expect(prompt).not.toContain("当前工作目录：");
				// 时间单出口（负侧）：任何时间/日期形态都不许进系统提示词（唯一出口是
				// hidden context 的 current_time）。
				expect(prompt).not.toMatch(/Current time:/);
				expect(prompt).not.toMatch(/\d{2}:\d{2}/);
				expect(prompt).not.toMatch(/\d{4}-\d{2}-\d{2}/);
			});
		}
	}

	it("生产组装入口的产物不含任何时间/日期形态（堵「有人往组装里塞现在几点」的洞）", () => {
		/*
		 * 这条是本次补的钉子，针对的洞很具体：组装本体若被人加一句
		 * `+ formatRunTime(new Date())`（哪怕只到日期粒度），系统提示词就会逐轮
		 * 变化 —— 而它位于整段对话历史之前，一处失配就是整段历史重算。
		 *
		 * 为什么上面那六条不够：它们的两个时刻跨了日期，能拦住这件事，但那是
		 * 巧合（换两个同一分钟/同一天的时刻就拦不住）。所以这里不看「两轮是否
		 * 相等」，直接对产物做**形态断言**：任何时间/日期形态都不许出现。
		 */
		vi.setSystemTime(FIRST_TURN_AT);
		const composed = compose({ sceneId: "work", interactionId: "craft", expertId: undefined });
		// 非空守卫：空串能通过任何「不含」断言。
		expect(composed.prompt.length).toBeGreaterThan(1_000);
		for (const pattern of [/Current time:/, /\d{4}-\d{2}-\d{2}/, /\d{2}:\d{2}/, /\b\d{10,}\b/]) {
			expect(composed.prompt).not.toMatch(pattern);
		}
		// 分段 provenance 同样不许出现曾经的时间段来源。
		for (const segment of composed.segments) {
			expect(segment.source).not.toBe("time");
		}
	});

	it("生产组装入口的产物不含任何机器相关的绝对路径形态（堵「有人把本机路径塞进提示词」的洞）", () => {
		/*
		 * 与上面那条同款、针对同一类事故的另一种载体：**随机器变的事实**。
		 * 托管 Python 解释器的绝对路径曾以 `{{pythonPath}}` 槽位拼进骨架片段
		 * （spec: 转换调用受控的 2026-09-17 修订），它随 homedir / 应用安装位置 /
		 * HTML_TO_DOCX_VENV 变 —— 而系统提示词位于整段对话历史之前，所以
		 * 「重建 venv / 换机器 / 私有化换个安装位置」会让该处之后的整段提示词与
		 * 整段历史一起在 provider 前缀缓存里失配。槽位与取值链已删、路径改走
		 * hidden context 的 `python_env` 段（spec: stabilize-prompt-prefix）。
		 * 本用例就是那条纪律的反向钉子：谁把机器路径写回资源里，这里红。
		 *
		 * **口径（为什么不是「任何盘符」）**：resources 里有**与本机无关的通用示例**
		 * —— windows-notes 的 `D:\work\报告.docx`、code 骨架禁区段的 `C:\`、
		 * skill 文档里的 `python3`。它们在任何机器上字节相同，不属「机器相关」；
		 * 把门禁写成「任何盘符 / 任何绝对路径」只会被白名单一项项放宽，那才是真
		 * 漏洞。这里钉的是**本机身份**的载体：
		 *   ① 用户家目录（`homedir()` 的字面量 + `%USERPROFILE%` + 盘符/POSIX
		 *      家目录链形态）：藏在提示词里的任何用户目录路径都会命中；
		 *   ② 托管 venv 的指纹（`.venv-html-to-docx` / `python.exe`）与那个槽位；
		 * 技能清单段不在扫描范围（pi 的 formatSkillsForPrompt 会写技能的绝对
		 * `<location>`，是 pi 的形态、随应用安装位置变 —— 见 composeWithoutSkills 注释）。
		 */
		vi.setSystemTime(FIRST_TURN_AT);
		const composed = composeWithoutSkills({
			sceneId: "work",
			interactionId: "craft",
			expertId: undefined,
		});
		// 非空守卫：空串能通过任何「不含」断言。
		expect(composed.prompt.length).toBeGreaterThan(1_000);
		expect(composed.prompt, "组装里出现了本机家目录").not.toContain(homedir());
		for (const pattern of [
			/[A-Za-z]:\\{1,2}(?:Users|用户)\\/i, // C:\Users\… / C:\用户\…
			/\/Users\/[^/\s]/,
			/\/home\/[^/\s]/,
			/%USERPROFILE%/i,
			/\.venv-html-to-docx/,
			/python\.exe/,
			/\{\{pythonPath\}\}/,
		]) {
			expect(composed.prompt).not.toMatch(pattern);
		}
		// 三个场景 × 三个模式的产物都过一遍（只有 work 之外的骨架漏了路径才是真事故）。
		for (const sceneId of SCENES) {
			for (const modeId of MODES) {
				const other = composeWithoutSkills({ sceneId, interactionId: modeId, expertId: undefined });
				expect(other.prompt.length, `${sceneId} × ${modeId} 组装为空`).toBeGreaterThan(1_000);
				expect(other.prompt, `${sceneId} × ${modeId} 含本机家目录`).not.toContain(homedir());
			}
		}
	});

	it("分段带内容指纹（CACHE6 段级归因的前提）：同输入同指纹、换模式指纹变", () => {
		/*
		 * 缓存断点落在消息列表之前时，「哪一段变了」只能靠相邻两轮的分段指纹 diff
		 * 指认（shared/cache-prefix.ts）。指纹必须**与消息指纹同一算法**（生产组装
		 * 出口调 shared 的 contentFingerprint），且同一份资源逐轮可复现 —— 否则
		 * 归因会把「没变」说成「变了」。
		 */
		vi.setSystemTime(FIRST_TURN_AT);
		const first = compose({ sceneId: "work", interactionId: "craft", expertId: undefined });
		const second = compose({ sceneId: "work", interactionId: "craft", expertId: undefined });
		expect(first.segments.length).toBeGreaterThan(0);
		expect(first.segments.every((s) => typeof s.fp === "number")).toBe(true);
		expect(first.segments.map((s) => [s.source, s.fp])).toEqual(
			second.segments.map((s) => [s.source, s.fp]),
		);

		// 换模式 → 模式段与骨架之后的内容变了 → 该段指纹必须不同（同长度不同内容也认得出）。
		const ask = compose({ sceneId: "work", interactionId: "ask", expertId: undefined });
		const craftMode = first.segments.find((s) => s.source === "mode:craft")?.fp;
		const askMode = ask.segments.find((s) => s.source === "mode:ask")?.fp;
		expect(craftMode).toBeDefined();
		expect(askMode).toBeDefined();
		expect(craftMode).not.toBe(askMode);
	});
});
