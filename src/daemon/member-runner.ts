/**
 * 团队成员会话执行器（spec: add-team-foundations 批 5）。
 *
 * 与 subagent-runner（子代理）的装配**共用** buildSubagentExtensions
 * （隔离语义一致），差异全在宿主生命周期，逐条对照：
 *   - **长会话**：无 10 分钟超时 —— 成员跑完一轮任务自然收尾，后续靠
 *     team_send 唤醒（WorkBuddy「已完成成员收消息自动重启」语义）；
 *   - **fire-and-forget**：spawn ack（宿主建好 + prompt 已起）即返回，
 *     领导 run 不等成员；一轮收尾经 onComplete/onFailed 回调回投领导
 *     （daemon 接线层把它折成 deliverSessionMessage）；
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

export interface MemberSpawnInput {
	/** 领导会话的工作目录（成员与领导同 cwd，产物落在用户看得见的地方）。 */
	readonly cwd: string;
	/** 成员人格与工具面来源（agents 库的定义，team 工具已校验存在）。 */
	readonly agent: AgentDefinition;
	/** 成员名（溯源标记与回调标注用）。 */
	readonly memberName: string;
	/** 初始任务。 */
	readonly task: string;
}

export interface MemberHooks {
	/** 进展一行（tool_started / 轮数），供 runtime.recordProgress 回填。 */
	readonly onProgress: (memberName: string, text: string) => void;
	/** 一轮收尾：最终输出（已 24k 截断 + 去毒）。 */
	readonly onComplete: (memberName: string, output: string, turns: number) => void;
	/** 失败/被中止：诊断文本。 */
	readonly onFailed: (memberName: string, message: string) => void;
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
	/** 用户在场审批通道（与主会话/子代理同一 requestApproval）。 */
	readonly requestApproval: (
		request: Omit<PermissionRequest, "id" | "sessionId">,
	) => Promise<PermissionResponse>;
}

export interface MemberHandle {
	/** 成员会话 id（宿主建好即有真值）。 */
	readonly sessionId: string;
	/** 向成员投一条消息（followUp 语义：idle 唤醒 / running 排队）。 */
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
	const modelKey = deps.getModelKey();
	if (modelKey === undefined) {
		throw new Error("还没有选择模型，请先在设置里配置 API Key 并选择模型");
	}
	if (!catalog.isUsable(modelKey)) {
		throw new Error("选中的模型当前不可用，请到设置里检查 API Key 或重新选择模型");
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
			hooks.onProgress(memberName, `已完成 ${turns} 轮`);
		}
		if (event.type === "tool_started") {
			const { toolName, summary } = event.card;
			hooks.onProgress(memberName, summary === "" ? `正在 ${toolName}` : `正在 ${toolName} ${summary}`);
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
				requestApproval: deps.requestApproval,
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

	// fire-and-forget：不 await。收尾回调把产出折回领导（接线层投递）。
	void host
		.prompt(input.task)
		.then(() => {
			if (runError !== undefined) {
				hooks.onFailed(memberName, runError);
				return;
			}
			if (cancelled) {
				hooks.onFailed(memberName, "已被中止");
				return;
			}
			hooks.onComplete(memberName, finalizeOutput(lastText), turns);
		})
		.catch((error: unknown) => {
			hooks.onFailed(memberName, error instanceof Error ? error.message : String(error));
		});

	return {
		sessionId,
		prompt: (text: string) => host.prompt(text, "followUp"),
		abort: () => host.abort(),
		dispose: () => host.dispose(),
	};
}

