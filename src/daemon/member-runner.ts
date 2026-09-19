/**
 * 团队成员会话执行器（spec: add-team-foundations 批 5）。
 *
 * 与 subagent-runner（子代理）的装配**共用** buildSubagentExtensions
 * （隔离语义一致），差异全在宿主生命周期，逐条对照：
 *   - **长会话**：无 10 分钟超时 —— 成员跑完一轮任务自然收尾，后续靠
 *     team_send 唤醒（WorkBuddy「已完成成员收消息自动重启」语义）；
 *   - **fire-and-forget**：spawn ack（宿主建好 + prompt 已起）即返回，
 *     领导 run 不等成员；一轮收尾经 onComplete/onFailed 回调记账
 *     （**产出不回投** —— 拉模式下领导用 team_read 主动读成员会话，
 *     spec: add-team-pull-model 批次 ④）；
 *   - **不随领导 abort**：主会话停止键不杀成员（成员独立，WorkBuddy 同款），
 *     解散走 team_delete 的 abortAll；
 *   - 会话文件写 team_member 溯源标记（列表过滤）。
 *
 * 完成信号来源同 subagent-runner（核查过 pi 源码）：host.prompt() 在 agent
 * 循环收尾后才 resolve，run_error / run_finished 那时已收进收集器。
 */

import type { AgentDefinition } from "../core/agents.ts";
import type { ModelCatalog } from "../core/model-catalog.ts";
import type { LoadedResources } from "../core/resources.ts";
import { SessionHost } from "../core/session-host.ts";
import { sanitizeSubagentOutput } from "../core/subagent-sanitize.ts";
import type { ThinkingLevel } from "../shared/session-events.ts";
import type { SessionEvent } from "../shared/session-events.ts";
import type { PermissionSettings } from "../shared/permissions.ts";
import type { PermissionRequest, PermissionResponse } from "../shared/ipc.ts";
import { buildSubagentExtensions } from "./subagent-runner.ts";

/** 回传领导的输出上限（与子代理 24k 口径一致）。 */
const MEMBER_OUTPUT_MAX_CHARS = 24_000;

/**
 * 一个成员会话事件对应的**轮数增量**（`assistant_done` → 1，其余 → 0）。
 *
 * 抽成导出纯函数是为了**可测**：这条判据被写错过一次 —— 接线层把 `turnsDelta`
 * 恒传 0，于是长 run 期间团队注册表的 `turns` 停在 0，而同一条 `team_status` 的
 * 「最近」却写着「已完成 57 轮」，模型据此判断进度会被误导（2026-09-19 实测）。
 * 它内联在 emit 里也写得出来，但内联就单测不到 —— 而它正是出过事的那一处。
 */
export function turnsDeltaForEvent(event: SessionEvent): number {
	return event.type === "assistant_done" ? 1 : 0;
}

export interface MemberSpawnInput {
	/** 领导会话的工作目录（成员与领导同 cwd，产物落在用户看得见的地方）。 */
	readonly cwd: string;
	/** 成员人格与工具面来源（agents 库的定义，team 工具已校验存在）。 */
	readonly agent: AgentDefinition;
	/** 成员名（溯源标记与回调标注用）。 */
	readonly memberName: string;
	/** 初始任务。 */
	readonly task: string;
	/**
	 * 成员级模型覆盖（spec: add-team-collaboration-parity 批次 ⑥）：
	 * `providerId/modelId`。缺省 undefined 时按「agent 定义的 model → 领导当前模型」
	 * 回落（见 spawnMember 的解析链）。
	 */
	readonly modelKey?: string;
}

export interface MemberHooks {
	/**
	 * 进展一行（tool_started / 轮数），供 runtime.recordProgress 回填。
	 *
	 * 第三参 `turnsDelta` 是**本事件的轮数增量**（`assistant_done` → 1，其余 → 0）——
	 * 由本模块给，因为只有它看得见事件类型。接线层据此累加注册表的 `turns`：
	 * 少了它，注册表的轮数只能等整轮跑完由 `onComplete` 一次性赋值，
	 * 于是长 run 期间 `team_status` 会一直显示「已完成 0 轮」而 `最近：已完成 57 轮`
	 * —— 同一个数两个说法，模型据此判断进度就会被误导（2026-09-19 实测）。
	 * 两个来源的口径必须一致：本模块的 `turns` 与接线层的累加都只数 `assistant_done`，
	 * 收尾时 `onComplete` 再用绝对值对齐一次。
	 */
	readonly onProgress: (memberName: string, text: string, turnsDelta: number) => void;
	/**
	 * 一轮收尾：最终输出（已 24k 截断 + 去毒）。
	 *
	 * **返回值可以是 Promise，且会被 await**（spec: add-team-interrupt-diagnostics
	 * 批次 ③.2）。签名保留 async 能力是刻意的：拉模式（spec: add-team-pull-model
	 * 批次 ④）删掉了回投，接线层现在只需同步记账，但**钩子契约不该由当前调用方
	 * 的实现细节决定** —— 将来若有别的收尾工作（落盘、通知、清理），应当能在这里
	 * 直接返回 Promise 而不必再改签名与 `.then()` 结构。
	 *
	 * 反面纪律仍然成立：**接线层若返回了 Promise，就必须在这里 await 掉**，
	 * 不能再 `void`（2026-09-19 的教训）。
	 */
	readonly onComplete: (memberName: string, output: string, turns: number) => void | Promise<void>;
	/** 失败/被中止：诊断文本。 */
	readonly onFailed: (memberName: string, message: string) => void | Promise<void>;
	/**
	 * 成员会话事件转发（spec: add-team-foundations 批 8 焦点导航）：以成员
	 * sessionId 为信封键转发 renderer，用户可聚焦查看成员完整对话。首参在
	 * 宿主建成前为空串——建会话窗口期的零星事件没有消费者，直接丢弃。
	 */
	readonly onEvent?: (memberSessionId: string, event: SessionEvent) => void;
}

export interface MemberRunnerDeps {
	readonly getCatalog: () => Promise<ModelCatalog>;
	readonly getModelKey: () => string | undefined;
	readonly resources: LoadedResources;
	readonly getPermissions: () => PermissionSettings;
	readonly getThinkingLevel: () => ThinkingLevel | undefined;
	readonly protectedDirs: readonly string[];
	readonly isTempCwd: (cwd: string) => boolean;
	readonly isOwnWorkspace: (dir: string) => boolean;
	readonly getWebSearchConfig: () => import("../core/web-search.ts").WebSearchConfig | undefined;
	/**
	 * 用户在场审批通道（与主会话/子代理同一 requestApproval）。
	 *
	 * 第二参是成员自己的会话 id（spec: add-team-collaboration-parity 批次 ⑦）：
	 * 宿主建成前为空串（零星事件没有审批可发），建成后由本模块回填 ——
	 * daemon 侧据此反查团队注册表，把「哪个成员在请求」标注到审批卡上。
	 */
	readonly requestApproval: (
		request: Omit<PermissionRequest, "id" | "sessionId">,
		memberSessionId: string,
	) => Promise<PermissionResponse>;
}

export interface MemberHandle {
	/** 成员会话 id（宿主建好即有真值）。 */
	readonly sessionId: string;
	/**
	 * 实际使用的模型（`providerId/modelId`）：解析链的最终结果，
	 * 由接线层回填注册表供 `team_status` 展示（批次 ⑥）。
	 */
	readonly modelKey: string;
	/**
	 * 向成员投一条消息（followUp 语义：idle 唤醒 / running 排队）。
	 *
	 * 返回值是 `session-host.prompt` 的「是否仅入队」（批次 ③.3）。**投给成员
	 * 的这条路不需要它**（成员没有回投送达确认那套留痕），故签名这里收窄成
	 * `void`；实现返回对象也不影响（TS 允许返回更宽的值被当 void 用）。
	 */
	prompt: (text: string) => Promise<void>;
	/** 解散时中止成员当前轮。 */
	abort: () => Promise<void>;
	dispose: () => void;
}

/**
 * spawn 一个成员：建长会话宿主、写溯源标记、把初始任务**不 await** 地跑起来。
 * 返回时 spawn ack 成立（会话 id 已定、一轮已开跑），成员后续生死经 hooks 回调。
 */
export async function spawnMember(
	deps: MemberRunnerDeps,
	input: MemberSpawnInput,
	hooks: MemberHooks,
): Promise<MemberHandle> {
	const { agent, cwd, memberName } = input;
	const catalog = await deps.getCatalog();
	/*
	 * 模型解析链（spec: add-team-collaboration-parity 批次 ⑥，对齐 agents.ts 的既有立场）：
	 *   成员显式指定（team_create 的 members[].model）
	 *   → agent 定义里的 model（人格自带的偏好）
	 *   → 领导当前模型（现状行为）。
	 *
	 * 前两级不可用时**响亮报错**、绝不静默回落：回落会让「调研用便宜模型」的意图
	 * 悄悄变成主模型费率 —— 那正是 agents.ts 文件头立过的规矩（子代理同款）。
	 */
	const explicit = input.modelKey ?? agent.model;
	const modelKey = explicit ?? deps.getModelKey();
	if (modelKey === undefined) {
		throw new Error("还没有选择模型，请先在设置里配置 API Key 并选择模型");
	}
	if (!catalog.isUsable(modelKey)) {
		throw new Error(
			explicit === undefined
				? "选中的模型当前不可用，请到设置里检查 API Key 或重新选择模型"
				: `成员「${memberName}」指定的模型不可用：${explicit}（请确认它的服务商已配置 API Key）`,
		);
	}

	let turns = 0;
	let lastText = "";
	let runError: string | undefined;
	let cancelled = false;
	// 宿主建成前事件不可信（translate 尚未接线，实际不会触发）；建成即回填，
	// onEvent 转发的信封键从这一刻起有真值。
	let sessionIdRef = { current: "" };
	const emit = (event: SessionEvent): void => {
		if (event.type === "assistant_done") {
			turns += 1;
			lastText = event.message.text;
			hooks.onProgress(memberName, `已完成 ${turns} 轮`, turnsDeltaForEvent(event));
		}
		if (event.type === "tool_started") {
			const { toolName, summary } = event.card;
			hooks.onProgress(
				memberName,
				summary === "" ? `正在 ${toolName}` : `正在 ${toolName} ${summary}`,
				turnsDeltaForEvent(event),
			);
		}
		if (event.type === "run_error" && runError === undefined) runError = event.message;
		if (event.type === "run_finished" && event.outcome === "cancelled") cancelled = true;
		if (sessionIdRef.current !== "") hooks.onEvent?.(sessionIdRef.current, event);
	};

	const host = await SessionHost.create({
		catalog,
		modelKey,
		cwd,
		isTempTask: deps.isTempCwd(cwd),
		// 两轴只是占位：成员不切换场景/模式，提示词由 prompt-switch 从 agent.body 组装。
		sceneId: "work",
		interactionId: "craft",
		emit,
		resources: deps.resources,
		thinkingLevel: deps.getThinkingLevel(),
		toolsOverride: agent.tools,
		extensions: buildSubagentExtensions(
			{
				getCatalog: deps.getCatalog,
				getModelKey: deps.getModelKey,
				resources: deps.resources,
				getPermissions: deps.getPermissions,
				getThinkingLevel: deps.getThinkingLevel,
				protectedDirs: deps.protectedDirs,
				isTempCwd: deps.isTempCwd,
				isOwnWorkspace: deps.isOwnWorkspace,
				getWebSearchConfig: deps.getWebSearchConfig,
				// 审批带成员会话归属（批次 ⑦）：装配层只认单参，包一层把成员自己的
				// sessionId 补上（宿主建成前是空串，daemon 侧按「无归属」处理）。
				requestApproval: (request) => deps.requestApproval(request, sessionIdRef.current),
			},
			agent,
			cwd,
			() => host,
		),
	});
	host.markTeamMemberRun(memberName);

	const sessionId = host.state.sessionId;
	sessionIdRef.current = sessionId;
	const finalizeOutput = (text: string): string => {
		const truncated =
			text.length > MEMBER_OUTPUT_MAX_CHARS ? `${text.slice(0, MEMBER_OUTPUT_MAX_CHARS)}\n\n（内容过长，已截断）` : text;
		return sanitizeSubagentOutput(truncated);
	};

	/*
	 * fire-and-forget：不 await 整轮（领导不该等成员）。收尾回调的返回值仍然
	 * await 掉 —— 拉模式（spec: add-team-pull-model 批次 ④）删了回投之后接线层
	 * 已不返回 Promise，但这条 await 保留：钩子契约允许返回 Promise，那么
	 * 「返回了就必须被等」这条纪律不能因为当前实现恰好同步就悄悄失效。
	 */
	void host
		.prompt(input.task)
		.then(async () => {
			if (runError !== undefined) {
				await hooks.onFailed(memberName, runError);
				return;
			}
			if (cancelled) {
				await hooks.onFailed(memberName, "已被中止");
				return;
			}
			await hooks.onComplete(memberName, finalizeOutput(lastText), turns);
		})
		.catch(async (error: unknown) => {
			// 回调自身抛错也要兜住（否则 `.catch` 里再抛就成了游离 rejection）。
			try {
				await hooks.onFailed(memberName, error instanceof Error ? error.message : String(error));
			} catch {
				// 兜底回调都失败时无处可投，吞掉 —— 但绝不能让它冒泡成 unhandledRejection。
			}
		});

	return {
		sessionId,
		modelKey,
		// 丢弃 prompt 的「是否仅入队」返回值：成员侧没有回投留痕要确认。
		prompt: async (text: string) => {
			await host.prompt(text, "followUp");
		},
		abort: () => host.abort(),
		dispose: () => host.dispose(),
	};
}

