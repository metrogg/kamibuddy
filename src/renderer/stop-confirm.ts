/**
 * 停止生成的二次确认状态机（机制对齐 WorkBuddy）。
 *
 * 误触保护：长任务跑一次可能几分钟，单击停止 / 误碰 Esc 就前功尽弃，
 * 所以首次触发只「武装」——按钮变 Esc 徽章给出 3s 窗口，窗口内再次触发
 * 才真正中断；超时自动复原，生成不受影响。
 *
 * 纯函数，不依赖 React：组件只负责持状态、挂定时器（超时复原）和
 * 在 confirmed 时调 onAbort。
 */

/** 待确认窗口时长（ms）。 */
export const STOP_CONFIRM_WINDOW_MS = 3_000;

export type StopConfirmState =
	| { readonly phase: "idle" }
	| { readonly phase: "pending"; readonly deadline: number };

export const stopConfirmIdle: StopConfirmState = { phase: "idle" };

export interface StopTrigger {
	readonly state: StopConfirmState;
	/** true = 本次触发确认中断（调用方此时调 onAbort）。 */
	readonly confirmed: boolean;
}

/**
 * 触发一次停止（点按钮或按 Esc）：
 * - idle → 武装为 pending（截止 now + 窗口）；
 * - pending 窗口内 → 确认，回到 idle；
 * - pending 已超时 → 视同 idle 重新武装（与「超时自动复原」同语义，
 *   不依赖 UI 的定时器先把状态收回去 —— 定时器晚到时状态机本身也是对的）。
 */
export function triggerStop(state: StopConfirmState, now: number): StopTrigger {
	if (state.phase === "pending" && now < state.deadline) {
		return { state: stopConfirmIdle, confirmed: true };
	}
	return {
		state: { phase: "pending", deadline: now + STOP_CONFIRM_WINDOW_MS },
		confirmed: false,
	};
}

/**
 * pending 是否已过截止时刻。UI 的复原定时器据此判定：
 * 只清「真的过期」的 pending —— 若用户在旧定时器到期前重新武装过一次，
 * 旧定时器到点时新 pending 尚未过期，不能被它误清。
 */
export function stopConfirmExpired(state: StopConfirmState, now: number): boolean {
	return state.phase === "pending" && now >= state.deadline;
}
