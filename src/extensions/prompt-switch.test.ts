/**
 * 提示词切换扩展的胶水测试（仿 permission-gate.test 的假 ExtensionAPI）。
 *
 * 策略本体在 prompt-composer / resources 里测过了，这里钉两类东西：
 *   1. 接缝：before_agent_start 被注册、每次触发都带「当时的两轴」去 compose、
 *      compose 的返回值原样成为 systemPrompt；以及逐轮可变事实的 context 注入
 *      （追加在消息末尾、不落盘、空串不注入）。
 *   2. 缓存前缀不变量：同一会话连续两轮、只推进墙钟时间，系统提示词必须逐字节
 *      相等 —— 用**真实 resources/** 组装（两个场景 × 三个模式全组合）来证
 *      （spec: stabilize-prompt-prefix 的 Task 5.2）。
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkills, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getResourcesDir } from "../core/config-paths.ts";
import { loadMemorySystemPrompt } from "../core/memory.ts";
import {
	composePromptWithMeta,
	skillsSectionForMode,
	type PromptContextOptions,
	type SkillDescriptor,
} from "../core/prompt-composer.ts";
import { loadResources, resolveStyle, type LoadedResources } from "../core/resources.ts";
import { createPromptSwitch, RUNTIME_CONTEXT_CUSTOM_TYPE } from "./prompt-switch.ts";

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
let realResources: LoadedResources;
let realSkills: readonly SkillDescriptor[];
let skillsAgentDir: string;

beforeAll(() => {
	realResources = loadResources(getResourcesDir());
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
});

afterAll(() => {
	rmSync(skillsAgentDir, { recursive: true, force: true });
});

/**
 * 与 daemon 的 composeSystemPrompt 同款输入的真实组装（真骨架 / 真模式 / 真片段库 /
 * 真风格 / 真记忆纪律段 / 真内置技能清单 / 透传 piContext）。
 *
 * 与 daemon 那份的差异只有一处，且与「字节稳定」无关：不读用户配置（专家库、技能
 * 开关、个性化偏好）—— 那些是**用户数据**，逐轮可变是设计的一部分，本来就走注入
 * 路径（见 core/prompt-composer.ts 文件头）。daemon 那份是这条口径的真源：往系统
 * 提示词里加会变的事实时必须同步回来，否则本用例护不住那条改动。
 */
function composeLikeDaemon(
	sceneId: string,
	interactionId: string,
	piContext: PromptContextOptions | undefined,
): string {
	const scene = realResources.scenes.find((s) => s.id === sceneId);
	const mode = realResources.modes.find((m) => m.id === interactionId);
	if (scene === undefined || mode === undefined) {
		throw new Error(`场景或交互模式不存在：${sceneId} / ${interactionId}`);
	}
	const style = resolveStyle(realResources.styles, undefined).style;
	const memorySystemBody = loadMemorySystemPrompt(getResourcesDir());
	return composePromptWithMeta({
		sceneBody: scene.body,
		modeBody: mode.body,
		skillsSection: skillsSectionForMode(mode.tools, realSkills),
		modeId: mode.id,
		resolveFragment: (name) => realResources.fragments.get(name),
		...(style === undefined ? {} : { style: { id: style.id, body: style.body } }),
		...(memorySystemBody === undefined ? {} : { memorySystemBody }),
		piContext,
	}).text;
}

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
				const { handler } = mount({
					axes: { sceneId, interactionId: modeId },
					compose: async (scene, interaction, _expertId, piContext) =>
						composeLikeDaemon(scene, interaction, piContext),
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
				// 时间单出口（负侧）：任何时间形态都不许进系统提示词（唯一出口是
				// hidden context 的 current_time）。
				expect(prompt).not.toMatch(/Current time:/);
				expect(prompt).not.toMatch(/\d{2}:\d{2}/);
			});
		}
	}
});
