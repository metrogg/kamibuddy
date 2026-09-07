/**
 * 把 SessionEvent 流折叠成可渲染的会话状态。
 *
 * 放在 renderer 里而不是 daemon 里，是有意的：daemon 发的是**增量**，
 * UI 才需要"当前完整视图"这个概念。daemon 不持有 UI 状态，
 * 也就不会出现两侧状态不一致的经典问题。
 *
 * 纯函数，无 React 依赖，可单测。
 */

import type {
	AssistantMessage,
	ConversationEntry,
	SessionEvent,
	SessionSnapshot,
	SessionState,
	ModeDescriptor,
	ToolCard,
} from "@shared/session-events.ts";

export interface ConversationView {
	readonly state: SessionState;
	readonly entries: readonly ConversationEntry[];
	readonly availableModes: readonly ModeDescriptor[];
}

export type ConversationAction =
	| { readonly type: "snapshot"; readonly snapshot: SessionSnapshot }
	| { readonly type: "event"; readonly event: SessionEvent };

export const initialConversation: ConversationView = {
	state: {
		sessionId: "",
		cwd: "",
		modeId: "craft",
		modelId: undefined,
		isStreaming: false,
	},
	entries: [],
	availableModes: [],
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

export function conversationReducer(view: ConversationView, action: ConversationAction): ConversationView {
	if (action.type === "snapshot") {
		return {
			state: action.snapshot.state,
			entries: action.snapshot.entries,
			availableModes: action.snapshot.availableModes,
		};
	}

	const event = action.event;
	switch (event.type) {
		case "run_started":
			return { ...view, state: { ...view.state, isStreaming: true } };

		case "run_finished":
			return { ...view, state: { ...view.state, isStreaming: false } };

		case "run_error":
			// 错误作为一条助手消息落进流里，用户能看到上下文位置。
			return {
				...view,
				state: { ...view.state, isStreaming: false },
				entries: [
					...view.entries,
					{ id: `error-${event.runId}`, role: "assistant", text: event.message, at: Date.now() },
				],
			};

		case "user_message":
			return { ...view, entries: [...view.entries, event.message] };

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

		case "tool_started":
			return { ...view, entries: [...view.entries, event.card] };

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
			return { ...view, state: event.state };
	}
}
