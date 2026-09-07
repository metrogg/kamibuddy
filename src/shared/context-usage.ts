/**
 * 上下文用量明细：圆环（精确值）+ 分类浮层（估算值）的数据形状与计算。
 *
 * 两个口径必须分开对待（WorkBuddy 同构）：
 *   - used / total 来自 pi 的 session.getContextUsage()，是**精确值** ——
 *     圆环百分比直接用它，不做任何加工。
 *   - byCategory 是**估算值**：pi 不给按类别拆分的上下文占用，
 *     系统提示词与技能段是 compose 时的字符数估算，对话与工具结果按
 *     会话内容字符数估算（core/observability.ts 的 estimateComposition）。
 *     UI 展示分类时必须带「估算」标注，数字前加 ~。
 */

import type { ContextComposition } from "./observability.ts";

/** 上下文占用的分类拆分（估算，token 数）。 */
export interface ContextUsageCategory {
	/** 系统提示词（已扣除技能段）。 */
	readonly systemPrompt: number;
	/** 技能清单段。 */
	readonly skills: number;
	/** 对话消息（用户 + 助手 + 思考）。 */
	readonly conversation: number;
	/** 工具结果。 */
	readonly toolResults: number;
}

/** 一份上下文用量明细：圆环用 used/total，浮层用 byCategory。 */
export interface ContextUsageDetail {
	readonly used: number;
	readonly total: number;
	readonly byCategory: ContextUsageCategory;
}

export function buildContextUsage(args: {
	readonly used: number;
	readonly total: number;
	/** 组装完成的完整系统提示词的 token 估算（含技能段）。 */
	readonly systemPromptTokens: number;
	/** 技能清单段的 token 估算。 */
	readonly skillsTokens: number;
	readonly composition: ContextComposition;
}): ContextUsageDetail {
	// 技能段是系统提示词的一部分，拆出来单列。
	// 两端都是估算值，误差可能让 skills > system，钳位而不是造出负数。
	const skills = Math.min(Math.max(args.skillsTokens, 0), Math.max(args.systemPromptTokens, 0));
	const systemPrompt = Math.max(args.systemPromptTokens, 0) - skills;

	return {
		used: args.used,
		total: args.total,
		byCategory: {
			systemPrompt,
			skills,
			conversation:
				args.composition.user + args.composition.assistant + args.composition.thinking,
			toolResults: args.composition.tools,
		},
	};
}

/** token 数 → 短文本：999 原样，1000 → 1.0K，128000 → 128.0K。 */
export function formatTokenCount(tokens: number): string {
	if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
	return String(tokens);
}
