/**
 * 提示词切换扩展的胶水测试（仿 permission-gate.test 的假 ExtensionAPI）。
 *
 * 策略本体在 prompt-composer / resources 里测过了，这里钉三类东西：
 *   1. 接缝：before_agent_start 被注册五个 handler（systemPrompt + 四条快照
 *      通道）、每次触发都带「当时的两轴」去 compose、compose 的返回值原样成为
 *      systemPrompt；
 *   2. 快照通道：四条通道各自按 `buildContextEntries()` 的活分支基线独立去重、
 *      独立追加（内容未变不返回 message ⇒ pi 不追加条目），空内容不注入
 *      （team-output 的增量语义与 `previous` 入参另有单独一组）；
 *   3. 缓存前缀不变量：同一会话连续两轮、只推进墙钟时间，系统提示词必须逐字节
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
import {
	HIDDEN_CONTEXT_CUSTOM_TYPE,
	RUN_TIME_CUSTOM_TYPE,
	RUNTIME_CONTEXT_CUSTOM_TYPE,
	TEAM_OUTPUT_CUSTOM_TYPE,
} from "../shared/observability.ts";
import { SNAPSHOT_SUPERSEDE_NOTE } from "../shared/hidden-context.ts";
import { createPromptSwitch } from "./prompt-switch.ts";

type HandlerEvent = {
	readonly systemPromptOptions: {
		contextFiles?: PromptContextOptions["contextFiles"];
		toolSnippets?: PromptContextOptions["toolSnippets"];
		promptGuidelines?: PromptContextOptions["promptGuidelines"];
	};
};

/** 快照 message 的形状（pi 的 CustomMessage 子集：customType / content / display）。 */
interface SnapshotMessage {
	readonly customType: string;
	readonly content: string;
	readonly display: boolean;
}

type HandlerResult = { readonly systemPrompt?: string; readonly message?: SnapshotMessage } | undefined;

/** 假 ExtensionContext：本扩展只用到 sessionManager.buildContextEntries()。 */
interface FakeCtx {
	readonly sessionManager: { readonly buildContextEntries: () => readonly unknown[] };
}

type Handler = (event: HandlerEvent, ctx?: FakeCtx) => Promise<HandlerResult> | HandlerResult;

interface Mounted {
	/** 第 1 个 handler：整串 systemPrompt。 */
	readonly handler: Handler;
	/** 第 2 个 handler：runtime-context 快照通道。 */
	readonly runtime: Handler;
	/** 第 3 个 handler：hidden-context（环境块）快照通道。 */
	readonly hidden: Handler;
	/** 第 4 个 handler：run-time（时间块）快照通道。 */
	readonly runTime: Handler;
	/** 第 5 个 handler：team-output（团队产出增量）快照通道。 */
	readonly teamOutput: Handler;
	/** 传给四条快照 handler 的假 ctx（buildContextEntries 由用例给定）。 */
	readonly ctx: FakeCtx;
}

const EMPTY_EVENT: HandlerEvent = { systemPromptOptions: {} };
/** 注入块样例：runtime-context 通道只有记忆内容 / 个性化（时间走 run-time 通道）。 */
const RUNTIME_BLOCK = "## 长期记忆（用户级）\n\n报告一律用表格呈现数据。";
const HIDDEN_BLOCK =
	'<system-reminder data-role="user-context">\n<workspace_context>\n工作目录：D:\\proj\n</workspace_context>\n</system-reminder>';
/** 时间块的正文形态与 `composeHiddenBlock(…, "additional-data")` 的产物一致。 */
const RUN_TIME_BLOCK =
	'<system-reminder data-role="additional-data">\n<current_time>\n2026-09-18 11:01（周五，GMT+8）\n</current_time>\n</system-reminder>';
/**
 * 团队产出快照的正文样例（第四条通道）。形态与 daemon 侧 composer 的产物一致：
 * 以增量语义开头，**不含**取代声明（旧产出不被新快照取代）。
 */
const TEAM_BLOCK = "## 团队产出增量（还没进过你上下文的成员产出）\n\n- 阿离（研究员）：已完成 1 轮\n\n### 阿离\n产出正文…";

/**
 * 假 ctx 的默认基线：没有同类型快照（新会话）。
 * `entries` 给出「会话活分支的条目列表」，用例据此模拟 resume / 去重。
 */
function ctxWith(entries: readonly unknown[]): FakeCtx {
	return { sessionManager: { buildContextEntries: () => entries } };
}

/** 造一条会话里的快照条目（pi 的 custom_message 形状）。 */
function snapshotEntry(customType: string, content: string): unknown {
	return { type: "custom_message", customType, content, display: false };
}

function mount(options: {
	readonly axes: { sceneId: string; interactionId: string; expertId?: string };
	readonly compose: (
		sceneId: string,
		interactionId: string,
		expertId: string | undefined,
		piContext: PromptContextOptions,
	) => Promise<string>;
	readonly runtimeContext?: () => string;
	readonly hiddenContext?: () => string | undefined;
	readonly runTime?: () => string | undefined;
	readonly teamOutput?: (previous: string | undefined) => string | undefined;
	readonly entries?: readonly unknown[];
}): Mounted {
	const handlers: Handler[] = [];
	const fakePi = {
		on: (event: string, value: unknown) => {
			if (event === "before_agent_start") handlers.push(value as Handler);
		},
	} as unknown as ExtensionAPI;

	createPromptSwitch({
		getCurrent: () => options.axes,
		compose: options.compose,
		composeRuntimeContext: options.runtimeContext ?? (() => ""),
		composeHiddenContext: options.hiddenContext ?? (() => undefined),
		composeRunTime: options.runTime ?? (() => undefined),
		composeTeamOutput: options.teamOutput ?? (() => undefined),
	})(fakePi);

	// 五个 handler 是编排契约的一部分（一个换提示词、四个各管一条快照通道）：
	// 少了任何一个都说明「通道被并进别的 handler」或「通道被删」—— 直接炸。
	const [handler, runtime, hidden, runTime, teamOutput] = handlers;
	if (
		handlers.length !== 5 ||
		handler === undefined ||
		runtime === undefined ||
		hidden === undefined ||
		runTime === undefined ||
		teamOutput === undefined
	) {
		throw new Error(`before_agent_start 处理器注册数不对：${handlers.length}（应为 5）`);
	}
	return { handler, runtime, hidden, runTime, teamOutput, ctx: ctxWith(options.entries ?? []) };
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

/**
 * 三条快照通道（spec: persist-context-snapshots Task 2 + spec:
 * add-supersede-note-and-time-split Task 2）。
 *
 * 形态级断言只有一条是关键的：**内容没变就不返回 message**。pi 的
 * emitBeforeAgentStart 只把返回了的 message 收进 messages 数组
 * （runner.js），所以「不返回」就等于「不追加条目」—— 这正是每 run 重付
 * 58,094 token 的止血点。去重基线取会话活分支（`buildContextEntries()`），
 * 不做进程内缓存，所以 resume / 新进程同样正确。
 *
 * 三条通道（runtime-context / hidden-context 环境块 / run-time 时间块）**各读
 * 各的基线**：时间按分钟变、环境事实几乎不变、画像偶尔变 —— 共用一个基线会让
 * 变化频率最低的那条被频率最高的那条拖着重发（本组最后两个用例钉这个）。
 */
describe("快照通道：三条通道各自独立去重、各自追加", () => {
	it("首次 run（活分支上没有同类型快照）→ 三条通道各返回一条 message，形态为持久 custom 消息", async () => {
		const { runtime, hidden, runTime, ctx } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			runtimeContext: () => RUNTIME_BLOCK,
			hiddenContext: () => HIDDEN_BLOCK,
			runTime: () => RUN_TIME_BLOCK,
		});

		const runtimeResult = await runtime(EMPTY_EVENT, ctx);
		const hiddenResult = await hidden(EMPTY_EVENT, ctx);
		const runTimeResult = await runTime(EMPTY_EVENT, ctx);

		expect(runtimeResult).toEqual({
			message: {
				customType: RUNTIME_CONTEXT_CUSTOM_TYPE,
				content: RUNTIME_BLOCK,
				display: false,
			},
		});
		// 三块正文各自成一条（不拼成一条）：合并会让逐字节没变的那部分跟着
		// 时间每 run 重发。
		expect(hiddenResult).toEqual({
			message: {
				customType: HIDDEN_CONTEXT_CUSTOM_TYPE,
				content: HIDDEN_BLOCK,
				display: false,
			},
		});
		expect(runTimeResult).toEqual({
			message: {
				customType: RUN_TIME_CUSTOM_TYPE,
				content: RUN_TIME_BLOCK,
				display: false,
			},
		});
	});

	it("三条通道各自读自己的基线：末条属于别的通道时不算基线（互不触发）", async () => {
		/*
		 * 三条通道的正文在活分支上**各有一条同内容的末条**，但它们彼此交错。
		 * 正确实现下三条都「内容没变 ⇒ 不追加」；任何形式的「共用一个基线」
		 * （读别的通道的 customType、或读末条 custom_message 不看类型）都会让
		 * 前两条读到**别人的**内容 ⇒ 误判为变了 ⇒ 多追加一条（本用例红）。
		 * 这正是 Task 3 第三组改坏要变红的断言。
		 */
		const { runtime, hidden, runTime, ctx } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			runtimeContext: () => RUNTIME_BLOCK,
			hiddenContext: () => HIDDEN_BLOCK,
			runTime: () => RUN_TIME_BLOCK,
			entries: [
				snapshotEntry(RUNTIME_CONTEXT_CUSTOM_TYPE, RUNTIME_BLOCK),
				snapshotEntry(HIDDEN_CONTEXT_CUSTOM_TYPE, HIDDEN_BLOCK),
				snapshotEntry(RUN_TIME_CUSTOM_TYPE, RUN_TIME_BLOCK),
			],
		});

		expect(await runtime(EMPTY_EVENT, ctx), "runtime 通道读到了别人的基线").toBeUndefined();
		expect(await hidden(EMPTY_EVENT, ctx), "hidden 通道读到了别人的基线").toBeUndefined();
		expect(await runTime(EMPTY_EVENT, ctx), "run-time 通道读到了别人的基线").toBeUndefined();
	});

	it("内容与活分支上最后一条同类型快照逐字节相同 → 不返回 message（run 2 不追加条目）", async () => {
		// resume / 第二个 run 的形态：上一条快照已经在会话文件里（同内容）。
		const { runtime, hidden, runTime, ctx } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			runtimeContext: () => RUNTIME_BLOCK,
			hiddenContext: () => HIDDEN_BLOCK,
			runTime: () => RUN_TIME_BLOCK,
			entries: [
				snapshotEntry(RUNTIME_CONTEXT_CUSTOM_TYPE, RUNTIME_BLOCK),
				{ type: "message", message: { role: "user", content: "上一轮提问" } },
				snapshotEntry(HIDDEN_CONTEXT_CUSTOM_TYPE, HIDDEN_BLOCK),
				snapshotEntry(RUN_TIME_CUSTOM_TYPE, RUN_TIME_BLOCK),
			],
		});

		expect(await runtime(EMPTY_EVENT, ctx)).toBeUndefined();
		expect(await hidden(EMPTY_EVENT, ctx)).toBeUndefined();
		expect(await runTime(EMPTY_EVENT, ctx)).toBeUndefined();
	});

	it("只变了一条时另两条照旧不追加（三条通道各自读自己的基线）", async () => {
		// 环境事实变了（换工作目录）、画像与时间逐字节没变。
		const changedHidden = HIDDEN_BLOCK.replace("D:\\proj", "D:\\proj\\sub");
		const { runtime, hidden, runTime, ctx } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			runtimeContext: () => RUNTIME_BLOCK,
			hiddenContext: () => changedHidden,
			runTime: () => RUN_TIME_BLOCK,
			entries: [
				snapshotEntry(RUNTIME_CONTEXT_CUSTOM_TYPE, RUNTIME_BLOCK),
				snapshotEntry(HIDDEN_CONTEXT_CUSTOM_TYPE, HIDDEN_BLOCK),
				snapshotEntry(RUN_TIME_CUSTOM_TYPE, RUN_TIME_BLOCK),
			],
		});

		expect(await runtime(EMPTY_EVENT, ctx)).toBeUndefined();
		expect(await hidden(EMPTY_EVENT, ctx)).toEqual({
			message: {
				customType: HIDDEN_CONTEXT_CUSTOM_TYPE,
				content: changedHidden,
				display: false,
			},
		});
		expect(await runTime(EMPTY_EVENT, ctx)).toBeUndefined();
	});

	it("仅时间跨分钟：只追加 run-time 一条，环境块不追加（拆通道的收益就在这条）", async () => {
		/*
		 * 上一版把 current_time 拼在环境块里，于是「分钟一变」= 整条 1,066 字符
		 * 重发（其中约 510 token 是逐字节没变的重复内容）。拆成两条通道后，
		 * 环境块（逐字节没变）不追加，只有时间块追加一条（**实测 150 字符 / 61 estTokens**，
		 * 其中真新信息只有时间戳 26 字符 ≈11 est）。
		 */
		const nextMinute =
			'<system-reminder data-role="additional-data">\n<current_time>\n2026-09-18 11:02（周五，GMT+8）\n</current_time>\n</system-reminder>';
		const { hidden, runTime, ctx } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			hiddenContext: () => HIDDEN_BLOCK,
			runTime: () => nextMinute,
			entries: [
				snapshotEntry(HIDDEN_CONTEXT_CUSTOM_TYPE, HIDDEN_BLOCK),
				snapshotEntry(RUN_TIME_CUSTOM_TYPE, RUN_TIME_BLOCK),
			],
		});

		expect(await hidden(EMPTY_EVENT, ctx), "环境块没变却追加了（时间被拼回了环境块）").toBeUndefined();
		expect(await runTime(EMPTY_EVENT, ctx)).toEqual({
			message: {
				customType: RUN_TIME_CUSTOM_TYPE,
				content: nextMinute,
				display: false,
			},
		});
	});

	it("基线只认同 customType 的条目：别的快照 / 真历史都不算基线", async () => {
		const { hidden, ctx } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			hiddenContext: () => HIDDEN_BLOCK,
			// 活分支上有一条 runtime-context 快照（内容恰好相同）+ 用户消息，
			// 但没有 hidden-context 快照 ⇒ 本通道必须追加。
			entries: [
				snapshotEntry(RUNTIME_CONTEXT_CUSTOM_TYPE, HIDDEN_BLOCK),
				{ type: "message", message: { role: "user", content: HIDDEN_BLOCK } },
			],
		});

		expect(await hidden(EMPTY_EVENT, ctx)).not.toBeUndefined();
	});

	it("内容非字符串的同类型末条按「没有基线」处理 ⇒ 追加（不静默丢掉环境事实）", async () => {
		const { hidden, ctx } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			hiddenContext: () => HIDDEN_BLOCK,
			entries: [
				snapshotEntry(HIDDEN_CONTEXT_CUSTOM_TYPE, HIDDEN_BLOCK),
				{
					type: "custom_message",
					customType: HIDDEN_CONTEXT_CUSTOM_TYPE,
					content: [{ type: "text", text: HIDDEN_BLOCK }],
					display: false,
				},
			],
		});

		expect(await hidden(EMPTY_EVENT, ctx)).not.toBeUndefined();
	});

	it("空内容不注入（runtime 空白串 / hidden 与 run-time undefined → 该通道不产生消息）", async () => {
		const { runtime, hidden, runTime, ctx } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			runtimeContext: () => "  \n ",
			hiddenContext: () => undefined,
			runTime: () => "   ",
		});

		expect(await runtime(EMPTY_EVENT, ctx)).toBeUndefined();
		expect(await hidden(EMPTY_EVENT, ctx)).toBeUndefined();
		expect(await runTime(EMPTY_EVENT, ctx)).toBeUndefined();
	});

	it("读会话失败 → 降级为「没有基线」⇒ 追加，且不抛错（pi 的 must-not-throw 契约）", async () => {
		const { runtime, hidden, runTime } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			runtimeContext: () => RUNTIME_BLOCK,
			hiddenContext: () => HIDDEN_BLOCK,
			runTime: () => RUN_TIME_BLOCK,
		});
		const broken: FakeCtx = {
			sessionManager: {
				buildContextEntries: () => {
					throw new Error("会话读不出来");
				},
			},
		};

		expect(await runtime(EMPTY_EVENT, broken)).not.toBeUndefined();
		expect(await hidden(EMPTY_EVENT, broken)).not.toBeUndefined();
		expect(await runTime(EMPTY_EVENT, broken)).not.toBeUndefined();
	});

	it("只读活分支：被压缩遮蔽掉的快照不算基线（下一次 run 按需重新追加）", async () => {
		// buildContextEntries 的返回值就是「compaction-aware 的活条目」——
		// 用例直接模拟它的结论：文件里有那条快照，但活分支上没有。
		const { hidden, ctx } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			hiddenContext: () => HIDDEN_BLOCK,
			entries: [{ type: "message", message: { role: "user", content: "你好" } }],
		});

		expect(await hidden(EMPTY_EVENT, ctx)).not.toBeUndefined();
	});
});

/**
 * 第四条快照通道：team-output（spec: inject-team-output-snapshot）。
 *
 * 与三条既有通道的两处差别在这里钉住：
 *   1. 正文由 composer 决定 —— 该通道语义是**增量**（旧产出不被新快照取代），
 *      故 prompt-switch 侧不许替它加取代声明；
 *   2. 去重基线要交给 composer（`previous`）—— 「哪些成员产出已注入过」的判据是
 *      产出指纹在不在上一条同通道快照里，而基线只有 handler 读得到 ctx。
 * 其余（逐字节相同不追加、空内容不注入、按 customType 各读各的基线）沿用同一机制。
 */
describe("快照通道：team-output 增量注入（第四条）", () => {
	it("回调返回非空文本 → 返回 custom 消息，正文原样、display:false 且不含取代声明", async () => {
		const { teamOutput, ctx } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			teamOutput: () => TEAM_BLOCK,
		});

		const result = await teamOutput(EMPTY_EVENT, ctx);
		expect(result).toEqual({
			message: { customType: TEAM_OUTPUT_CUSTOM_TYPE, content: TEAM_BLOCK, display: false },
		});
		// 增量语义：prompt-switch 不许替这条通道加取代声明（旧产出仍有效）。
		expect(result?.message?.content).not.toContain(SNAPSHOT_SUPERSEDE_NOTE);
	});

	it("上一条同通道快照正文与之逐字节相同 → 不返回 message（同一份产出不重复注入）", async () => {
		const { teamOutput, ctx } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			teamOutput: () => TEAM_BLOCK,
			entries: [
				snapshotEntry(RUNTIME_CONTEXT_CUSTOM_TYPE, RUNTIME_BLOCK),
				snapshotEntry(TEAM_OUTPUT_CUSTOM_TYPE, TEAM_BLOCK),
			],
		});

		expect(await teamOutput(EMPTY_EVENT, ctx)).toBeUndefined();
	});

	it("回调返回 undefined / 空白 → 不返回 message（无团队 / 没有新产出时零成本）", async () => {
		const none = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			teamOutput: () => undefined,
		});
		expect(await none.teamOutput(EMPTY_EVENT, none.ctx)).toBeUndefined();

		const blank = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			teamOutput: () => "  \n ",
		});
		expect(await blank.teamOutput(EMPTY_EVENT, blank.ctx)).toBeUndefined();
	});

	it("handler 把上一条同通道快照正文作为 previous 交给回调（去重基线在 handler 侧读出）", async () => {
		const seen: Array<string | undefined> = [];
		const { teamOutput, ctx } = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			teamOutput: (previous) => {
				seen.push(previous);
				return undefined;
			},
			entries: [
				snapshotEntry(TEAM_OUTPUT_CUSTOM_TYPE, "上一条团队产出快照"),
				{ type: "message", message: { role: "user", content: "本轮提问" } },
			],
		});

		await teamOutput(EMPTY_EVENT, ctx);
		expect(seen).toEqual(["上一条团队产出快照"]);

		// 没有基线（新会话）时同样把 undefined 交出去，让 composer 按「全部都是新的」处理。
		const fresh = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "提示词",
			teamOutput: (previous) => {
				seen.push(previous);
				return undefined;
			},
		});
		await fresh.teamOutput(EMPTY_EVENT, fresh.ctx);
		expect(seen).toEqual(["上一条团队产出快照", undefined]);
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
		enabledSkills: async () => realSkills,
	});
	composeWithoutSkills = createSystemPromptComposerFromDefaults({
		...COMPOSER_DEFAULTS,
		enabledSkills: async () => [],
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
						(await compose({ sceneId: scene, interactionId: interaction, expertId, piContext }))
							.prompt,
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

	it("生产组装入口的产物不含任何时间/日期形态（堵「有人往组装里塞现在几点」的洞）", async () => {
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
		const composed = await compose({ sceneId: "work", interactionId: "craft", expertId: undefined });
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

	it("生产组装入口的产物不含任何机器相关的绝对路径形态（堵「有人把本机路径塞进提示词」的洞）", async () => {
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
		const composed = await composeWithoutSkills({
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
				const other = await composeWithoutSkills({
					sceneId,
					interactionId: modeId,
					expertId: undefined,
				});
				expect(other.prompt.length, `${sceneId} × ${modeId} 组装为空`).toBeGreaterThan(1_000);
				expect(other.prompt, `${sceneId} × ${modeId} 含本机家目录`).not.toContain(homedir());
			}
		}
	});

	it("分段带内容指纹（CACHE6 段级归因的前提）：同输入同指纹、换模式指纹变", async () => {
		/*
		 * 缓存断点落在消息列表之前时，「哪一段变了」只能靠相邻两轮的分段指纹 diff
		 * 指认（shared/cache-prefix.ts）。指纹必须**与消息指纹同一算法**（生产组装
		 * 出口调 shared 的 contentFingerprint），且同一份资源逐轮可复现 —— 否则
		 * 归因会把「没变」说成「变了」。
		 */
		vi.setSystemTime(FIRST_TURN_AT);
		const first = await compose({ sceneId: "work", interactionId: "craft", expertId: undefined });
		const second = await compose({ sceneId: "work", interactionId: "craft", expertId: undefined });
		expect(first.segments.length).toBeGreaterThan(0);
		expect(first.segments.every((s) => typeof s.fp === "number")).toBe(true);
		expect(first.segments.map((s) => [s.source, s.fp])).toEqual(
			second.segments.map((s) => [s.source, s.fp]),
		);

		// 换模式 → 模式段与骨架之后的内容变了 → 该段指纹必须不同（同长度不同内容也认得出）。
		const ask = await compose({ sceneId: "work", interactionId: "ask", expertId: undefined });
		const craftMode = first.segments.find((s) => s.source === "mode:craft")?.fp;
		const askMode = ask.segments.find((s) => s.source === "mode:ask")?.fp;
		expect(craftMode).toBeDefined();
		expect(askMode).toBeDefined();
		expect(craftMode).not.toBe(askMode);
	});
});
