/**
 * 回合指标 fold —— 把「当前回合」的 assistant 消息 usage 与回合计时折叠成
 * 指标条要的一组读数（spec: surface-run-metrics-in-chat Task 1）。
 *
 * 纯函数：只依赖 shared 契约，不 import electron / daemon，可脱离运行时单测
 * （AGENTS.md §1.3）。这里只出数据，不做格式化 —— token 显示由 UI 层调
 * shared/context-usage.ts 的 formatTokenCount（一处口径，避免两端各格式化一次）。
 *
 * 回合边界与 UI 同口径：renderer/turn-fold.ts 的 buildTurnViews 把 entries 按
 * user 消息切成轮，**当前回合 = 最后一条 user 消息之后（到下一条 user 之前）**
 * 的那一段；chat-view 正是以最后一条 user 消息的 id 定位当前轮（TurnHeader 的
 * active 判定 lastUserId）。这里取同一边界，保证指标条与回合头部说的是同一轮。
 * 没有 user 消息时整体视作前缀轮（同 buildTurnViews 的最后一段）。
 */

import { cacheHitRate, emptyUsage, reportsCacheActivity } from "@shared/observability.ts";
import type { ConversationEntry, TurnTiming } from "@shared/session-events.ts";

export interface TurnMetrics {
	readonly elapsedMs: number;
	readonly inputTokens?: number;
	readonly outputTokens?: number;
	readonly cacheReadTokens?: number;
	/** 缓存命中率（0-1）。无缓存字段时 undefined。 */
	readonly hitRate?: number;
}

/**
 * 本函数从 usage 里读的三个字段。
 *
 * 用可选字段视图而非直接读 TokenUsage：TokenUsage 的类型层字段是必填，但
 * 「上游没上报」与「真的是 0」是两回事（observability.ts 口径）。透过可选视图
 * 读取，缺字段时能返回 undefined 而不是被误当成 0。
 */
interface UsageFields {
	readonly input?: number;
	readonly output?: number;
	readonly cacheRead?: number;
	readonly cacheWrite?: number;
}

export function foldTurnMetrics(
	entries: readonly ConversationEntry[],
	turn: TurnTiming | undefined,
	now: number,
): TurnMetrics {
	// endedAt 缺省 = 流式中，用传入的 now 走表（见 session-events.ts TurnTiming 注释）；
	// 没有回合计时（如压缩 run / 尚未有过用户消息）就没有可信的起点，返回 0 而非造一个假值。
	const startedAt = turn?.startedAt;
	const elapsedMs =
		turn === undefined || startedAt === undefined ? 0 : (turn.endedAt ?? now) - startedAt;

	// 当前回合内容 = 最后一条 user 之后的条目（含其中的 assistant / 工具卡）。
	const lastUserIndex = entries.findLastIndex((e) => e.role === "user");

	let inputSum = 0;
	let outputSum = 0;
	let cacheReadSum = 0;
	let cacheWriteSum = 0;
	let hasInput = false;
	let hasOutput = false;
	let hasCacheRead = false;
	/**
	 * provider 能力判定：**整段对话**（不只是本轮）里出现过非零缓存活动才算它在报缓存
	 * —— 口径与 daemon 的会话卡（SessionStatCard.cacheReported）一致。只看本轮会把
	 * 「这一轮恰好全 miss」误判成「不支持缓存」，把真实数据藏掉。
	 */
	let cacheReported = false;

	for (const [index, entry] of entries.entries()) {
		if (entry.role !== "assistant" || entry.usage === undefined) continue;
		// 逐字段求和，同时记住「该字段是否至少出现过一次」—— 一处上报过就累加，
		// 全程没出现过则最终返回 undefined（绝不填 0）。
		const usage: UsageFields = entry.usage;
		if (reportsCacheActivity(usage)) cacheReported = true;
		if (index <= lastUserIndex) continue;
		if (usage.input !== undefined) {
			inputSum += usage.input;
			hasInput = true;
		}
		if (usage.output !== undefined) {
			outputSum += usage.output;
			hasOutput = true;
		}
		if (usage.cacheRead !== undefined) {
			cacheReadSum += usage.cacheRead;
			hasCacheRead = true;
		}
		if (usage.cacheWrite !== undefined) cacheWriteSum += usage.cacheWrite;
	}

	// 命中率复用 shared 的算法（不重写）：需 input 与 cacheRead 都在场才能算，
	// 否则缺的字段会被当成 0 而误显示成「命中 0%」（spec 明确要求无数据时留空）。
	// **cacheWrite 必须进分母**（2026-09-17 修正）—— 此前只传了 input + cacheRead，
	// 与 daemon 的会话卡（三桶之和）口径不一致，写缓存多的轮次命中率偏高。
	const hitRate =
		hasInput && hasCacheRead
			? cacheHitRate(
					{
						...emptyUsage(),
						input: inputSum,
						cacheRead: cacheReadSum,
						cacheWrite: cacheWriteSum,
					},
					cacheReported,
				)
			: undefined;

	return {
		elapsedMs,
		inputTokens: hasInput ? inputSum : undefined,
		outputTokens: hasOutput ? outputSum : undefined,
		cacheReadTokens: hasCacheRead ? cacheReadSum : undefined,
		hitRate,
	};
}
