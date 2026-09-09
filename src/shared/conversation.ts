/**
 * 把 SessionEvent 流折叠成可渲染的会话状态。
 *
 * 放在 shared/ 而非任一端，是因为**两端都需要它**：
 *   - renderer 用它把增量事件折叠成当前视图；
 *   - daemon 用它维护同一份历史，供渲染进程重新挂载时经 snapshot 拉取。
 *
 * 各写一份必然漂移（同一个事件在两边折叠出不同结果，且症状是「刷新后内容变了」，
 * 极难排查），而 daemon 不许 import renderer（AGENTS.md §1）。
 * 这个 reducer 纯函数、零依赖，放 shared/ 两端共用是唯一不漂移的做法。
 *
 * 纯函数，无 React 依赖，可单测。
 */

import type {
	AssistantMessage,
	ConversationEntry,
	MessageId,
	SessionEvent,
	SessionSnapshot,
	SessionState,
	ModeDescriptor,
	ToolCard,
	TurnTiming,
} from "./session-events.ts";
import { generatingLabel } from "./session-events.ts";
import { mergePresentedArtifacts, type ArtifactRef } from "./artifacts.ts";
import type { ContextUsageDetail } from "./context-usage.ts";

export interface ConversationView {
	readonly state: SessionState;
	readonly entries: readonly ConversationEntry[];
	/** 场景轴选项（首页页签）。 */
	readonly availableScenes: readonly ModeDescriptor[];
	/** 交互轴选项（对话页切换器）。 */
	readonly availableModes: readonly ModeDescriptor[];
	/** 最近的上下文用量明细（context_usage 事件折叠而来）。 */
	readonly usageDetail?: ContextUsageDetail;
	/** 当前回合计时（user_message 起表，run 结束停表）。 */
	readonly turn?: TurnTiming;
	/**
	 * 被取消回合的起始用户消息 id。「用户已取消」指示行按它定位到
	 * 历史里对应回合的末尾；新回合不重置它（取消痕迹是历史的一部分）。
	 */
	readonly cancelledTurns: readonly MessageId[];
	/** 本会话已交付的产物（artifacts_presented 折叠而来，唯一来源）。 */
	readonly artifacts: readonly ArtifactRef[];
}

export type ConversationAction =
	| { readonly type: "snapshot"; readonly snapshot: SessionSnapshot }
	| { readonly type: "event"; readonly event: SessionEvent };

export const initialConversation: ConversationView = {
	state: {
		sessionId: "",
		cwd: undefined,
		isPlayground: true,
		sceneId: "work",
		interactionId: "craft",
		modelId: undefined,
		isStreaming: false,
	},
	entries: [],
	availableScenes: [],
	availableModes: [],
	cancelledTurns: [],
	artifacts: [],
};

/** 就地替换某条 entry；找不到则原样返回（事件乱序时不崩，但也不静默造一条假数据）。 */
function replaceEntry(
	entries: readonly ConversationEntry[],
	id: string,
	update: (entry: ConversationEntry) => ConversationEntry,
): readonly ConversationEntry[] {
	const index = entries.findIndex((e) => e.id === id);
	if (index === -1) return entries;
	const existing = entries[index];
	if (existing === undefined) return entries;
	const next = entries.slice();
	next[index] = update(existing);
	return next;
}

/**
 * run 结束时把仍滞留的「生成中」卡片标记为 aborted。
 *
 * 正常流程下卡片离开生成态只有一条路：tool_execution_start 把它翻转为执行态。
 * 生成被打断（用户中断、模型报错）时这条事件永远不会来 —— 不清理的话
 * 卡片上的呼吸动画会永远转下去，看起来像还在写文件。
 */
function abortOrphanedGenerating(
	entries: readonly ConversationEntry[],
): readonly ConversationEntry[] {
	if (!entries.some((e) => e.role === "tool" && e.generating === true)) return entries;
	return entries.map((e) =>
		e.role === "tool" && e.generating === true
			? { ...e, generating: undefined, outcome: "aborted" as const }
			: e,
	);
}

/** run 结束停表。没有起过表（如压缩 run）就不造一个假回合。 */
function stopTurn(turn: TurnTiming | undefined, cancelled: boolean): TurnTiming | undefined {
	if (turn === undefined || turn.endedAt !== undefined) return turn;
	// cancelled 只在为 true 时落键：正常结束的回合不该带这个标记取值。
	return cancelled
		? { ...turn, endedAt: Date.now(), cancelled: true }
		: { ...turn, endedAt: Date.now() };
}

/**
 * run 被取消时记录当前回合（最后一条 user 消息）的 id。
 * 没有 user 消息的 run（如手动压缩）不构成回合，不记录。
 */
function markTurnCancelled(
	entries: readonly ConversationEntry[],
	cancelledTurns: readonly MessageId[],
): readonly MessageId[] {
	const lastUser = entries.findLast((e) => e.role === "user");
	if (lastUser === undefined || cancelledTurns.includes(lastUser.id)) return cancelledTurns;
	return [...cancelledTurns, lastUser.id];
}

export function conversationReducer(view: ConversationView, action: ConversationAction): ConversationView {
	if (action.type === "snapshot") {
		return {
			state: action.snapshot.state,
			entries: action.snapshot.entries,
			availableScenes: action.snapshot.availableScenes,
			availableModes: action.snapshot.availableModes,
			usageDetail: action.snapshot.usageDetail,
			turn: action.snapshot.turn,
			cancelledTurns: action.snapshot.cancelledTurns ?? [],
			artifacts: action.snapshot.artifacts,
		};
	}

	const event = action.event;
	switch (event.type) {
		case "history_reset":
			// 与 daemon resetSession 同口径：历史 / 计时 / 取消痕迹 / 产物 / 用量明细全清；
			// state 只复位 sessionId 与 isStreaming —— cwd、两轴、模型选择保留
			// （新建任务不换空间也不换模式）。
			return {
				...view,
				state: { ...view.state, sessionId: "", isStreaming: false },
				entries: [],
				usageDetail: undefined,
				turn: undefined,
				cancelledTurns: [],
				artifacts: [],
			};

		case "run_started":
			return { ...view, state: { ...view.state, isStreaming: true } };

		case "run_finished": {
			const cancelled = event.outcome === "cancelled";
			return {
				...view,
				state: { ...view.state, isStreaming: false },
				entries: abortOrphanedGenerating(view.entries),
				turn: stopTurn(view.turn, cancelled),
				// 取消的回合记入名单：指示行要在新回合开始后仍留在历史里。
				cancelledTurns: cancelled
					? markTurnCancelled(view.entries, view.cancelledTurns)
					: view.cancelledTurns,
			};
		}

		case "run_error":
			// 错误作为独立条目落进流里（渲染为错误卡，见 ErrorEntry），用户能看到上下文位置。
			// 错误不是用户取消：停表但不落 cancelled 标记。
			return {
				...view,
				state: { ...view.state, isStreaming: false },
				entries: [
					...abortOrphanedGenerating(view.entries),
					{
						id: `error-${event.runId}`,
						role: "error",
						message: event.message,
						runId: event.runId,
						at: Date.now(),
					},
				],
				turn: stopTurn(view.turn, false),
			};

		case "user_message":
			// 回合计时从用户消息落库起表（WorkBuddy：从 user 消息发出到当前）。
			return {
				...view,
				entries: [...view.entries, event.message],
				turn: { startedAt: event.message.at },
			};

		case "assistant_started":
			return {
				...view,
				entries: [...view.entries, { id: event.messageId, role: "assistant", text: "", at: event.at }],
			};

		case "assistant_text_delta":
			return {
				...view,
				entries: replaceEntry(view.entries, event.messageId, (entry) =>
					entry.role === "assistant" ? { ...entry, text: entry.text + event.delta } : entry,
				),
			};

		case "assistant_thinking_delta":
			return {
				...view,
				entries: replaceEntry(view.entries, event.messageId, (entry) =>
					entry.role === "assistant"
						? { ...entry, thinking: (entry.thinking ?? "") + event.delta }
						: entry,
				),
			};

		case "assistant_done": {
			// 用终态整条覆盖，校正累积增量可能的偏差。
			const done: AssistantMessage = event.message;
			const replaced = replaceEntry(view.entries, done.id, () => done);
			// 没找到说明漏了 assistant_started，补进去而不是丢掉内容。
			return { ...view, entries: replaced === view.entries ? [...view.entries, done] : replaced };
		}

		case "tool_stream_started":
		case "tool_started": {
			// upsert：tool_stream_started 在生成阶段上屏，tool_started 在进入执行时
			// 把同一张卡翻转为执行态 —— 一次工具调用始终只有一张卡（WorkBuddy 同构）。
			// 缺了 stream_started 的旧流程（或乱序）下找不到 id，退化为追加。
			const card = event.card;
			const replaced = replaceEntry(view.entries, card.id, () => card);
			return { ...view, entries: replaced === view.entries ? [...view.entries, card] : replaced };
		}

		case "tool_stream_progress":
			// path 未完整时不落卡（半截路径上屏像 bug）；行数随 path 一起进 change，
			// UI 的 +N 徽章读同一个字段，生成中与终态两个口径不用分开渲染。
			// 标签随 changeType 刷新：write 覆盖已有文件时从「生成中」变「修改中」。
			return {
				...view,
				entries: replaceEntry(view.entries, event.id, (entry) =>
					entry.role === "tool" && event.path !== undefined
						? {
								...entry,
								label: generatingLabel(entry.toolName, event.changeType),
								summary: event.path,
								change: {
									path: event.path,
									added: event.added,
									removed: 0,
									changeType: event.changeType,
								},
							}
						: entry,
				),
			};

		case "tool_progress":
			return {
				...view,
				entries: replaceEntry(view.entries, event.id, (entry) =>
					entry.role === "tool" ? { ...entry, detail: (entry.detail ?? "") + event.delta } : entry,
				),
			};

		case "tool_finished": {
			const card: ToolCard = event.card;
			const replaced = replaceEntry(view.entries, card.id, () => card);
			return { ...view, entries: replaced === view.entries ? [...view.entries, card] : replaced };
		}

		case "session_state":
			// 压缩后 pi 的 getContextUsage() 会有一段 tokens=null 的空窗，
			// 此时 state.contextUsage 缺省 —— 明细一并清掉，否则圆环停在压缩前的旧值。
			return {
				...view,
				state: event.state,
				usageDetail: event.state.contextUsage === undefined ? undefined : view.usageDetail,
			};

		case "context_usage":
			return { ...view, usageDetail: event.usage };

		case "artifacts_presented":
			return {
				...view,
				artifacts: mergePresentedArtifacts(view.artifacts, event.files, Date.now()),
			};
	}
}
