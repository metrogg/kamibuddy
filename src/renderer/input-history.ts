/**
 * 输入历史与按会话草稿（composer 的纯状态模块，不依赖 React/DOM）。
 *
 * 为什么模块级存储：视图切换（chat ↔ home ↔ settings）会卸载 ChatView，
 * 组件 state 随之丢失，而「本进程内已发送的消息」与「各会话未发出的草稿」
 * 都要在切回来后还原 —— 所以活在模块里。进程退出即弃，不落盘。
 */

/** 历史翻阅方向。 */
export type HistoryDirection = "up" | "down";

/**
 * 历史导航状态。undefined 表示不在导航中（输入框里是用户自己的草稿）。
 * index 指向 history 的下标；stash 是进入导航时暂存的草稿原文。
 */
export interface HistoryNavState {
	readonly index: number;
	readonly stash: string;
}

export interface HistoryNavResult {
	/** undefined = 已退出导航（恢复暂存草稿，或本来就没在导航）。 */
	readonly state: HistoryNavState | undefined;
	readonly text: string;
}

/* ── 已发送历史 ─────────────────────────────────────────────────── */

const sent: string[] = [];

/** 发送成功后记录一条。与最后一条相同则不记 —— 连发/重试不该把历史灌满重复项。 */
export function recordSent(text: string): void {
	if (sent[sent.length - 1] === text) return;
	sent.push(text);
}

/** 当前历史（只读视图，导航按它翻页）。 */
export function sentHistory(): readonly string[] {
	return sent;
}

/**
 * 翻一页历史。语义取最简一致的一版：
 * - 未导航时首次 up：暂存当前草稿，定位到最近一条；历史为空则原地不动。
 * - 导航中 up：往更早翻，到顶（第 0 条）停住。
 * - 导航中 down：往更新翻；翻过最新一条后退出导航，恢复暂存的草稿。
 * - 未导航时 down：无意义，原地不动。
 * - 导航期间新消息发送（recordSent 追加到 history 末尾）不中断导航：
 *   index 仍指向原条目，继续 down 会经过新追加的这条再退出 ——
 *   发送动作不没收用户正在翻的位置。
 */
export function navigateHistory(
	state: HistoryNavState | undefined,
	history: readonly string[],
	direction: HistoryDirection,
	currentDraft: string,
): HistoryNavResult {
	if (state === undefined) {
		if (direction === "down" || history.length === 0) {
			return { state: undefined, text: currentDraft };
		}
		const index = history.length - 1;
		return { state: { index, stash: currentDraft }, text: history[index] ?? currentDraft };
	}
	if (direction === "up") {
		const index = Math.max(0, state.index - 1);
		return { state: { ...state, index }, text: history[index] ?? state.stash };
	}
	const next = state.index + 1;
	if (next >= history.length) {
		return { state: undefined, text: state.stash };
	}
	return { state: { ...state, index: next }, text: history[next] ?? state.stash };
}

/* ── 按会话草稿 ─────────────────────────────────────────────────── */

const drafts = new Map<string, string>();

/** 输入变化即存（含空串：清空输入框也是该会话的草稿状态）。 */
export function saveDraft(sessionId: string, text: string): void {
	drafts.set(sessionId, text);
}

/** 还原该会话的草稿；从未存过返回 undefined。 */
export function loadDraft(sessionId: string): string | undefined {
	return drafts.get(sessionId);
}
