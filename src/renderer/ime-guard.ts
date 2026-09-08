/**
 * 中文输入法 Enter 守卫（机制对齐 WorkBuddy）。
 *
 * 拼音/五笔选词时按 Enter 是「确认候选」而不是「发送」，不拦就会误发。
 * compositionstart→end 期间的 Enter 靠 composing 布尔即可拦截；但 React 的
 * 合成事件顺序是 compositionend 先于它携带的那个 keydown 触发（候选上屏后
 * Enter 才落到 textarea），此刻 composing 已翻回 false —— 只靠布尔会漏掉
 * 恰恰最危险的那一下，所以必须再用时间戳留一段宽限期。
 */

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
