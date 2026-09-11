/**
 * 轮折叠的视图态与轮切分（spec: add-turn-fold-and-anchor Task 2）。
 *
 * 两块纯函数，chat-view 只持有状态并照结果渲染：
 *
 *   TurnFoldMap 状态机 —— 开合状态 = Map<turnId, expanded>，**缺省即折叠**：
 *   完成/取消轮、历史轮一律默认折叠，不需要任何「折叠写入」；Map 里只可能
 *   出现「用户手点」留下的记录。sticky 由此天然成立：渲染路径从不自动写
 *   展开，新 run 开始时 collapseAllTurnFolds 把手点展开全部收回，之后任何
 *   状态抖动（snapshot 重同步、流式增量）都不会让它们闪回展开。
 *
 *   buildTurnViews —— entries → 轮视图序列：按 user 消息切轮、推导轮终态
 *   （streaming/finished/error）、逐轮调 fold-view 的 buildFoldPlan、接线
 *   取消占位。它取代了 metafold v1 的 buildRenderBlocks + send-anchor 的
 *   groupTurnBlocks（块流与分组本属同一遍扫描，轮切分后两份都退役——
 *   折叠只许有一套，见 fold-view.ts 头注）。
 *
 * 状态按会话隔离（多桶）：App 持有 Map<sessionId, TurnFoldMap> 缓存
 * （viewCacheRef 同款机制），chat-view 挂载/切会话按桶存取；不落盘。
 */

import type { ConversationEntry, MessageId, UserMessage } from "@shared/session-events.ts";
import { buildFoldPlan } from "./fold-view.ts";
import type { FoldPlan, TurnState } from "./fold-view.ts";

/* ── 开合状态机 ──────────────────────────────────────────────── */

/** turnId → 是否已展开。缺省（无记录）= 折叠。 */
export type TurnFoldMap = ReadonlyMap<string, boolean>;

export const EMPTY_TURN_FOLDS: TurnFoldMap = new Map<string, boolean>();

export function turnFoldExpanded(map: TurnFoldMap, turnId: string): boolean {
	return map.get(turnId) ?? false;
}

/** 手点切换：唯一会产生「展开」记录的路径。 */
export function toggleTurnFold(map: TurnFoldMap, turnId: string): TurnFoldMap {
	const next = new Map(map);
	next.set(turnId, !turnFoldExpanded(map, turnId));
	return next;
}

/**
 * 新 run 开始（追问/steer）的折叠迁移：手点展开全部收回。
 * 收回即回到缺省折叠；此后没有自动展开路径（sticky）。
 */
export function collapseAllTurnFolds(map: TurnFoldMap): TurnFoldMap {
	return map.size === 0 ? map : new Map<string, boolean>();
}

/* ── 轮切分 ──────────────────────────────────────────────────── */

export interface TurnView {
	/** 稳定 key：开启本轮的 user 消息 id；首个 user 之前的前缀轮用固定串。 */
	readonly key: string;
	/** 本轮是否由 user 消息开启（anchor-space 只挂「由 user 开启的最后一组」）。 */
	readonly startsWithUser: boolean;
	/** 轮 id = 开启本轮的 user 消息 id；前缀轮为 undefined（无回合头部，不可折叠开合）。 */
	readonly turnId: MessageId | undefined;
	readonly userEntry: UserMessage | undefined;
	readonly state: TurnState;
	/** 本轮内容条目（user 之后、下一条 user 之前）的折叠计划。 */
	readonly plan: FoldPlan;
	/** 被取消的轮：轮末补「用户已取消」指示行（在折叠区外）。 */
	readonly cancelled: boolean;
}

export interface TurnViewOptions {
	/** 会话是否流式中：最后一条 user 所在轮不折叠（活的过程必须可见）。 */
	readonly streaming: boolean;
	/** 被取消轮的起始 user 消息 id。 */
	readonly cancelledTurns?: readonly MessageId[];
}

/**
 * entries → 轮视图序列。
 *
 * 轮终态推导：流式中且是最后一条 user 所在轮 → streaming；内容含错误条目
 * → error（折叠行为与 finished 相同，错误卡靠豁免留出，语义单列）；其余
 * → finished（含被取消轮与历史轮）。没有 user 消息的前缀轮跟随「是否连
 * 最后一条 user 都不存在」判定流式——连轮边界都没有时它就是活的那一段。
 */
export function buildTurnViews(
	entries: readonly ConversationEntry[],
	options: TurnViewOptions,
): readonly TurnView[] {
	const { streaming, cancelledTurns = [] } = options;
	const lastUserId = entries.findLast((e) => e.role === "user")?.id;

	const views: TurnView[] = [];
	let user: UserMessage | undefined;
	let content: ConversationEntry[] = [];

	const flush = (): void => {
		// 空前缀（entries 以 user 开头或为空）不产轮；空轮（连续 user）保留——
		// 回合头部要照常落位（metafold v1「连续 user 各有头部」同口径）。
		if (user === undefined && content.length === 0) return;
		const isLive = user === undefined ? lastUserId === undefined : user.id === lastUserId;
		const state: TurnState = streaming && isLive
			? "streaming"
			: content.some((e) => e.role === "error")
				? "error"
				: "finished";
		views.push({
			key: user === undefined ? "turn-prefix" : `turn-${user.id}`,
			startsWithUser: user !== undefined,
			turnId: user?.id,
			userEntry: user,
			state,
			plan: buildFoldPlan(content, state),
			cancelled: user !== undefined && cancelledTurns.includes(user.id),
		});
	};

	for (const entry of entries) {
		if (entry.role === "user") {
			flush();
			user = entry;
			content = [];
			continue;
		}
		content.push(entry);
	}
	flush();
	return views;
}
