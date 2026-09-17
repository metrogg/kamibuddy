/**
 * 回合指标 fold —— 把「当前回合」的 assistant 消息 usage 与回合计时折叠成
 * 指标条要的一组读数（spec: surface-run-metrics-in-chat Task 1）。
 *
 * 纯函数：只依赖 shared 契约，不 import electron / daemon，可脱离运行时单测
 * （AGENTS.md §1.3）。这里只出数据，不做格式化 —— token 显示由 UI 层调
 * shared/context-usage.ts 的 formatTokenCount（一处口径，避免两端各格式化一次）。
 *
 * 回合边界与 UI 同口径：边界**只有一处实现** —— shared/conversation.ts 的
 * lastUserEntryIndex（renderer/turn-fold.ts 的 buildTurnViews、chat-view 的
 * lastUserEntry / metricsAnchorId 都走它）。当前回合 = 最后一条 user 消息之后
 * （到下一条 user 之前）的那一段；chat-view 正是以最后一条 user 消息的 id 定位
 * 当前轮（TurnHeader 的 active 判定 lastUserId）。这里取同一边界，保证指标条与
 * 回合头部说的是同一轮。没有 user 消息时整体视作前缀轮（同 buildTurnViews）。
 *
 * **本 fold 的正确性依赖一条上游不变式**（2026-09-17 定位并修复的跨轮串账）：
 * 同一条 assistant 消息的 **usage 必须留在它自己那条 entry 上**。此前 reducer 的
 * `assistant_done` 按「同 id 的第一条」写入，而消息 id 是宿主进程内自增计数器的
 * 产物（core/session-host.ts 的 idSeq）、**宿主重建后从 1 重来**（daemon 重启 /
 * resume 的 remountHostInBucket）—— 于是新消息的 usage 会被盖进上一代的老条目，
 * 而老条目的位置属于更早的轮：页脚的「本轮」读数既会少算（本轮条目被空壳占住）
 * 也会多算（更早轮的窗口里冒出别轮的 usage）。实测会话 01a0ae75（6 轮 / 50 步，
 * 代际切换 4 次）：第 2 轮页脚 ↑161.0K / 台账 69.4K（+132%），第 3 轮页脚 0 /
 * 台账 18.0K。reducer 已改为写「最后一条」（见 shared/conversation.ts 的
 * replaceEntry 注释），本 fold 的窗口才与「台账按 run 聚合」逐轮对齐。
 */

import {
	billedInputTokens,
	cacheHitRate,
	emptyUsage,
	reportsCacheActivity,
} from "@shared/observability.ts";
import { lastUserEntryIndex } from "@shared/conversation.ts";
import type { ConversationEntry, TurnTiming } from "@shared/session-events.ts";

export interface TurnMetrics {
	readonly elapsedMs: number;
	/**
	 * 页脚 `↑` 的取数：**prompt 侧三桶之和**（`billedInputTokens`），不是
	 * 「未缓存输入」（`usage.input`）。2026-09-17 统一口径的两条理由：
	 *
	 *   1. **与同屏其它读数同口径**：任务诊断面板的单步行（task-diagnostics-panel
	 *      的 StepRow）与输入卡下方的会话指标条（session-stats-line）都在读 billed。
	 *      同一个 `↑` 在页脚指「未缓存输入」、在面板指「三桶之和」，读的人会以为
	 *      两处对不上账（同一个箭头就不该指两个量）。
	 *   2. **与命中率同分母**：hitRate 的分母也是 billed（见 foldTurnMetrics），
	 *      统一后页脚自洽：`↑ × 命中 ≈ cacheRead`、`↑ × (1 − 命中) ≈ 未缓存输入`。
	 *
	 * 改回 inputSum 会同时破坏上面两条；要单独展示「未缓存输入」请另开字段并在
	 * 注释里写明它的范围。
	 */
	readonly billedInputTokens?: number;
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
	// 边界取自 shared 的唯一实现处，不在这里再写一遍 findLast（AGENTS.md §4）。
	const lastUserIndex = lastUserEntryIndex(entries);

	let inputSum = 0;
	let outputSum = 0;
	let cacheReadSum = 0;
	let cacheWriteSum = 0;
	let hasInput = false;
	let hasOutput = false;
	let hasCacheRead = false;
	let hasCacheWrite = false;
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
		if (usage.cacheWrite !== undefined) {
			cacheWriteSum += usage.cacheWrite;
			hasCacheWrite = true;
		}
	}

	// 命中率复用 shared 的算法（不重写）：需 input 与 cacheRead 都在场才能算，
	// 否则缺的字段会被当成 0 而误显示成「命中 0%」（spec 明确要求无数据时留空）。
	// **cacheWrite 必须进分母**（2026-09-17 修正）—— 此前只传了 input + cacheRead，
	// 与 daemon 的会话卡（三桶之和）口径不一致，写缓存多的轮次命中率偏高。
	// 这个三桶快照同时是页脚 `↑` 的取数（见 TurnMetrics.billedInputTokens 的两条理由）：
	// 两者共用一个分母对象，才保证 ↑ 与命中率是同一次求和。
	const billedUsage = {
		...emptyUsage(),
		input: inputSum,
		cacheRead: cacheReadSum,
		cacheWrite: cacheWriteSum,
	};
	const hitRate =
		hasInput && hasCacheRead ? cacheHitRate(billedUsage, cacheReported) : undefined;

	return {
		elapsedMs,
		// 三桶任一上报过才显示（缺字段与 0 是两回事，同本文件其余读数）；
		// 求和公式在 shared 的 billedInputTokens，此处不重写。
		billedInputTokens:
			hasInput || hasCacheRead || hasCacheWrite ? billedInputTokens(billedUsage) : undefined,
		outputTokens: hasOutput ? outputSum : undefined,
		cacheReadTokens: hasCacheRead ? cacheReadSum : undefined,
		hitRate,
	};
}
