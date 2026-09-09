/**
 * 上下文用量明细的组装口：pi 的精确 used/total + 会话条目估算 → ContextUsageDetail。
 *
 * 为什么单独一个文件而不是写在 daemon/index.ts 里：index.ts 在 import 时就有
 * 重副作用（requireParentPort 会直接抛错、资源加载、EventLog 落盘全部启动），
 * 测试根本 import 不进来；而这份组装逻辑恰恰需要测试压着 —— daemon 有两条
 * 路径共用它（agent_end 后的 emitContextUsageDetail、resumeSession 的恢复派生），
 * 各写一份必然漂移出两套口径，症状是圆环与恢复后的分类明细对不上、且两条
 * 路径错的方式不一样，极难排查。
 */

import { estimateComposition } from "../core/observability.ts";
import { buildContextUsage, type ContextUsageDetail } from "../shared/context-usage.ts";
import type { ConversationEntry } from "../shared/session-events.ts";

/**
 * 派生一份完整的上下文用量明细。两种 undefined 都是「圆环该隐藏」的语义，
 * 不是缺数据：
 *   - contextUsage 缺失：pi 在「压缩后还没有下一次响应」的空窗里给不出用量
 *     （tokens: null，session-host 的 state getter 因此不下发 contextUsage），
 *     此时显示任何旧值都比不显示更糟；
 *   - 没有可估的东西（空会话且无系统提示词估算，estimateComposition 的口径）。
 */
export function deriveContextUsageDetail(args: {
	readonly entries: readonly ConversationEntry[];
	readonly contextUsage:
		| { readonly usedTokens: number; readonly maxTokens: number }
		| undefined;
	readonly systemPromptTokens: number;
	readonly skillsTokens: number;
}): ContextUsageDetail | undefined {
	if (args.contextUsage === undefined) return undefined;
	const composition = estimateComposition(args.entries, args.systemPromptTokens);
	if (composition === undefined) return undefined;
	return buildContextUsage({
		used: args.contextUsage.usedTokens,
		total: args.contextUsage.maxTokens,
		systemPromptTokens: args.systemPromptTokens,
		skillsTokens: args.skillsTokens,
		composition,
	});
}
