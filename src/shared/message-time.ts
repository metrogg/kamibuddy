/**
 * 用户消息气泡工具条的智能时间戳（对标 WorkBuddy 同位置的四档格式）。
 *
 * 纯函数放 shared 而非 renderer：档位判定全是日期边界逻辑（0 点跨天、
 * 跨月、跨年的「昨天」），是本模块最容易写错的地方，必须能脱离 DOM 单测。
 * 时区一律取本地时区 —— 气泡上的时间是给人对记忆用的，不是给机器对时用的。
 */

/** 两个时间戳是否落在本地同一个自然日。 */
function sameLocalDay(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function pad2(n: number): string {
	return n < 10 ? `0${n}` : `${n}`;
}

/**
 * 四档格式：
 * - 当天：HH:mm
 * - 昨天：昨天 HH:mm
 * - 当年：M月D日 HH:mm
 * - 跨年：YYYY年M月D日 HH:mm
 *
 * 「昨天」按自然日差一天判定（用本地日期构造 yesterday 再比 y/m/d），
 * 不能用 24h 差值 —— 今早 8 点看昨晚 10 点的消息只差 10 小时，但它是「昨天」。
 */
export function formatMessageTime(atMs: number, nowMs: number): string {
	const at = new Date(atMs);
	const now = new Date(nowMs);
	const hhmm = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;

	if (sameLocalDay(at, now)) return hhmm;

	// new Date(y, m, d - 1) 自动处理跨月/跨年回退（1 月 1 日的昨天是去年 12 月 31 日）。
	const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
	if (sameLocalDay(at, yesterday)) return `昨天 ${hhmm}`;

	if (at.getFullYear() === now.getFullYear()) return `${at.getMonth() + 1}月${at.getDate()}日 ${hhmm}`;

	return `${at.getFullYear()}年${at.getMonth() + 1}月${at.getDate()}日 ${hhmm}`;
}
