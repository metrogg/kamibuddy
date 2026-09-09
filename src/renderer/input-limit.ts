/**
 * composer 输入长度上限与余量显示判定（纯函数，不依赖 React/DOM）。
 *
 * 上限 10 万字符：足够装下粘贴的长文档，又能拦住「把整本书粘进输入框」
 * 的误操作 —— 那种 prompt 发出去必然超上下文，不如在输入侧就拦住。
 */

/** 输入字符数上限。 */
export const INPUT_CHAR_LIMIT = 100_000;

/** 剩余少于此值时开始显示余量（平时不占视觉）。 */
export const CHAR_REMAINING_SHOW_THRESHOLD = 1_000;

export interface CharCountState {
	/** 剩余可输入字符数（超限为负）。 */
	readonly remaining: number;
	/** 是否显示余量。 */
	readonly show: boolean;
	/** 是否已超限（UI 标红 + 禁发）。 */
	readonly over: boolean;
}

export function charCountState(length: number): CharCountState {
	const remaining = INPUT_CHAR_LIMIT - length;
	return {
		remaining,
		show: remaining < CHAR_REMAINING_SHOW_THRESHOLD,
		over: remaining < 0,
	};
}
