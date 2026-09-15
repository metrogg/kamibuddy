/**
 * 读数格式化：会话级时长与生成速度的短文本。
 *
 * 为什么单独立一个文件：指标条（session-stats-line）与任务诊断面板是两个并列
 * 的消费方 —— 放在任何一个组件文件里都会让另一个反向 import 组件。
 *
 * token 数的格式化**不在**这里：那条口径在 shared/context-usage.ts 的
 * formatTokenCount，它同时被上下文圆环与单轮读数用，必须两端共用。
 */

/**
 * 会话级时长：45.2s / 2m42s（对齐 dsh 的 formatDuration）。
 *
 * 与诊断页的 formatMs 不是一回事：那个是毫秒级读数（1234 → "1.2s"），服务于
 * 单次调用；这个是会话与轮次级的时长，动辄几分钟，需要 m 档才读得出量级。
 */
export function formatSpan(ms: number): string {
	const seconds = ms / 1_000;
	if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`;
	const whole = Math.round(seconds);
	return `${Math.floor(whole / 60)}m${whole % 60}s`;
}

/** 生成速度：≥10 取整，<10 保留一位（对齐 dsh 的 formatTokensPerSecond）。 */
export function formatThroughput(tokensPerSecond: number): string {
	const clamped = Math.max(0, tokensPerSecond);
	return clamped >= 10
		? String(Math.round(clamped))
		: String(Math.round(clamped * 10) / 10);
}

/**
 * 美元费用：不足一分显示四位（试用期单次会话常在几厘），其余两位。
 *
 * 单位是美元不是 ¥：这是 provider 的 API 计价，与用户本币无关（dsh 与
 * WorkBuddy 的 `/cost` 同为美元）。
 */
export function formatCost(usd: number): string {
	if (usd === 0) return "$0";
	return usd >= 0.01 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(4)}`;
}
