/**
 * 中文输入法 Enter 守卫（机制对齐 WorkBuddy）。
 *
 * 拼音/五笔选词时按 Enter 是「确认候选」而不是「发送」，不拦就会误发。
 * compositionstart→end 期间的 Enter 靠 composing 布尔即可拦截；但 React 的
 * 合成事件顺序是 compositionend 先于它携带的那个 keydown 触发（候选上屏后
 * Enter 才落到 textarea），此刻 composing 已翻回 false —— 只靠布尔会漏掉
 * 恰恰最危险的那一下，所以必须再用时间戳留一段宽限期。
 */

import { useCallback, useRef } from "react";

/** compositionend 之后吞 Enter 的宽限期（ms）。 */
export const IME_ENTER_GRACE_MS = 100;

export interface ImeGuardSnapshot {
	/** 是否处于 compositionstart→compositionend 之间。 */
	readonly composing: boolean;
	/** 最近一次 compositionend 的时间戳（epoch ms）；从未结束过 composition 时为 0。 */
	readonly lastCompositionEndAt: number;
	/** 判定时刻（epoch ms）。 */
	readonly now: number;
}

/**
 * 这个 Enter 是否应被吞掉：composition 期间，或 compositionend 后的宽限期内。
 * 吞掉的语义是「既不发送也不换行」——选词确认的 Enter 对 textarea 没有任何含义。
 */
export function shouldSwallowEnter({ composing, lastCompositionEndAt, now }: ImeGuardSnapshot): boolean {
	if (composing) return true;
	return now - lastCompositionEndAt < IME_ENTER_GRACE_MS;
}

/* ── React 接线（home-view 与 chat-view 共用） ─────────────────────── */

export interface ImeGuard {
	/** textarea 的 composition 事件接线，直接展开挂上即可。 */
	readonly bind: {
		readonly onCompositionStart: () => void;
		readonly onCompositionEnd: () => void;
	};
	/** keydown 里判定当前这个 Enter 是否应被吞掉。 */
	readonly shouldSwallowNow: () => boolean;
}

/**
 * textarea 的 IME 守卫 hook。
 *
 * 为什么必须抽成一份：守卫的坑（compositionend 先于其携带的 keydown，
 * 只靠 composing 布尔会漏掉最危险的那一下）在 chat-view 踩过并修好，
 * 而 home-view 各写一份时漏掉了 —— 中文输入选词 Enter 直接误发消息。
 * 两处同一份接线，以后修也只修一处（AGENTS.md §4 防重复）。
 */
export function useImeGuard(): ImeGuard {
	const state = useRef({ composing: false, lastCompositionEndAt: 0 });
	const onCompositionStart = useCallback(() => {
		state.current.composing = true;
	}, []);
	const onCompositionEnd = useCallback(() => {
		// compositionend 先于它携带的那个 keydown 触发（React 合成事件顺序），
		// 所以宽限期必须靠时间戳判定，不能只靠 composing 布尔（见上方 shouldSwallowEnter）。
		state.current.composing = false;
		state.current.lastCompositionEndAt = Date.now();
	}, []);
	const shouldSwallowNow = useCallback(() => shouldSwallowEnter({ ...state.current, now: Date.now() }), []);
	return { bind: { onCompositionStart, onCompositionEnd }, shouldSwallowNow };
}
