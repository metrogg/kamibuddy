/**
 * 消息刻度轨（TurnNav）的纯函数核心：几何换算、指针命中、当前轮判定。
 *
 * 移植自 dsh 的 TurnNavigator（packages/client/ui-chat/src/client/chat/
 * TurnNavigator.tsx + turn-rail-items.ts，MIT）。与 dsh 的差异集中在这里，
 * 逐条写明以便日后回看：
 *
 *   1. **没有「未加载轮」**。dsh 的会话是分页加载的，刻度分 loaded（可跳）与
 *      unloaded（先翻历史再跳，要脉冲提示 + busy 态）两种锚点。我们的会话一次
 *      全量载入，整条刻度梯都是可跳的 —— 相关分支与 busy 态整体不移植。
 *   2. **没有 outline 合并**。dsh 的刻度来自「宿主投影的全量轮清单」+「已加载
 *      窗口」两处，故有 mergeTurnRailItems 这一层。我们的轮清单只有
 *      buildTurnViews 一个来源，那一层没有对应物。
 *   3. **当前轮由「已测量的轮顶端」推**，不照搬 dsh 的 turnAtLine（它按行高
 *      遍历 DOM）。我们的测量本来就要做（刻度的存在与内容无关），把结果缓存下来，
 *      滚动时只做一次数组比较即可，比每帧查 DOM 便宜。
 *
 * 与 DOM 解耦是为了脱离 Electron/React 直接跑 vitest —— 换算与命中判定是这块
 * 唯一可能算错的地方（与 turn-rail 原实现、documents/ 纯函数化同一理由，
 * AGENTS.md §1）。
 */

import type { TurnView } from "./turn-fold.ts";

/* ── 几何常量（dsh 同名常量的原值） ─────────────────────────────── */

/**
 * 相邻刻度的固定间距。刻度**不按内容比例压缩**，梯子太长时轨道自己滚动。
 * 与它成对的「轨道最大高度 420px」「上下各 64px 净空」只在 CSS 里用
 *（.turn-nav 的 height: min(...)），在这里没有消费方 —— 高度是容器的函数，
 * 由 CSS 拿 100% 算比 JS 里量一次再传进去更不容易过期。
 */
export const TURN_PITCH_PX = 10;
/** 首/末刻度与轨道两端的留白。 */
export const RAIL_INSET_PX = 6;
/** 轨道两端渐隐带宽度（可滚动时）。 */
export const FADE_PX = 24;
/** 「阅读线」距视口顶的最大值与占视口高的比例：判定「此刻在读哪一轮」。 */
export const READING_LINE_MAX_PX = 96;
export const READING_LINE_RATIO = 0.2;

/**
 * 一条刻度指向的轮（dsh TurnRailItem 的本土版）。
 *
 * 预览文本随项一起带出，而不是让消费方拿 ordinal 回查 views —— 两者是两份
 * 数组，一旦这里过滤掉前缀轮，按下标回查就会整体错位一格。带在一起，
 * 「第几个刻度」与「那是哪一轮」永远同源。
 */
export interface TurnNavItem {
	/** 刻度与轮容器共用的稳定 key（turn-group 的 data-turn-key）。 */
	readonly key: string;
	/** 1 基序号，只用于文案与 aria-label。 */
	readonly ordinal: number;
	/** 该轮的提问（截断后）。 */
	readonly prompt: string;
	/** 该轮最后一条回答（截断后）。 */
	readonly response: string;
}

/**
 * 轮视图 → 刻度项。
 *
 * **只收由 user 消息开启的轮**：buildTurnViews 在首条 user 之前还会产一个
 * 「前缀轮」（key = turn-prefix，装开场白/压缩残留那种无主的领头内容）。它不是
 * 「用户说过的话」，给它一格既无跳转价值，又会让所有序号整体错一位（第 1 格
 * 指向开场白而不是第一句提问）。轮切分的口径仍归 buildTurnViews 一处，这里
 * 只是按 startsWithUser 过一道。
 *
 * 空轮（连续两条 user 之间没有内容）照收：用户确实说了那句话，跳过去是对的。
 */
export function buildTurnNavItems(views: readonly TurnView[]): readonly TurnNavItem[] {
	const items: TurnNavItem[] = [];
	for (const view of views) {
		if (!view.startsWithUser) continue;
		items.push({
			key: view.key,
			ordinal: items.length + 1,
			prompt: view.preview.prompt,
			response: view.preview.response,
		});
	}
	return items;
}

/** 刻度梯按固定间距铺开的**自然高度**（不含轨道自身的滚动）。 */
export function naturalRailHeight(count: number): number {
	if (count <= 0) return 0;
	return (count - 1) * TURN_PITCH_PX + 2 * RAIL_INSET_PX;
}

/**
 * 第 index 个刻度在**轨道内容坐标**里的中心位置（含首端留白）。
 * 轨道内的 scroller 会滚动，所以用它算位置时要减去 scrollTop（见 indexAtPointer）。
 */
export function markTop(index: number): number {
	return index * TURN_PITCH_PX + RAIL_INSET_PX;
}

/**
 * 轨道两端的可滚动状态：渐隐遮罩挂哪一端由它决定。
 * 1px 死区：亚像素滚动在小数滚动位置下会让「刚好到底」永远差一点点。
 */
export interface RailScrollState {
	readonly top: number;
	readonly canScrollUp: boolean;
	readonly canScrollDown: boolean;
}

export const RAIL_AT_REST: RailScrollState = { top: 0, canScrollUp: false, canScrollDown: false };

export function railScrollState(scrollTop: number, scrollHeight: number, clientHeight: number): RailScrollState {
	return {
		top: scrollTop,
		canScrollUp: scrollTop > 1,
		canScrollDown: scrollTop < scrollHeight - clientHeight - 1,
	};
}

export function sameRailScrollState(left: RailScrollState, right: RailScrollState): boolean {
	return (
		left.top === right.top &&
		left.canScrollUp === right.canScrollUp &&
		left.canScrollDown === right.canScrollDown
	);
}

/**
 * 指针落在第几个刻度上。rectTop 是**轨道**的视口顶，clientY 是指针的视口纵坐标，
 * scrollTop 是轨道内 scroller 的滚动量 —— 三者一起把指针换算到轨道内容坐标，
 * 再按固定间距就近取整。
 *
 * 就近取整（round）而不是向下取整：刻度是 10px 间距的靶，取整让每个刻度拥有
 * ±5px 的命中区；向下取整会让指针必须移动到刻度**下方** 10px 才切换，手感偏半格。
 * 越界（指针在首尾刻度之外）钳到端点，不返回 undefined —— 悬停在轨道上下端的
 * 留白上时给出最近的刻度，比什么都不显示更符合预期。
 */
export function indexAtPointer(
	clientY: number,
	rectTop: number,
	scrollTop: number,
	count: number,
): number {
	if (count <= 0) return -1;
	const offset = clientY - rectTop + scrollTop - RAIL_INSET_PX;
	const raw = Math.round(offset / TURN_PITCH_PX);
	return Math.min(count - 1, Math.max(0, raw));
}

/** 阅读线在滚动内容坐标里的位置（判定「此刻在读哪一轮」的那条线）。 */
export function readingTop(scrollTop: number, clientHeight: number): number {
	return scrollTop + Math.min(READING_LINE_MAX_PX, clientHeight * READING_LINE_RATIO);
}

/**
 * 当前轮下标：**顶端在阅读线之上的最后一轮**。
 *
 * 一轮的内容可能高过整个视口，所以不能取「最近的一轮」——那样在长回答中间滚动时
 * 高亮会漂到下一轮去。取「已越过阅读线的最后一轮」等价于「此刻正在读的那一轮」，
 * 且单调：向下滚只会把高亮往后推。
 *
 * tops 必须是**升序**的轮顶端（滚动内容坐标）。一轮都没越过阅读线时取第 0 轮 ——
 * 会话最顶端一个刻度都不亮，会让人以为导航失效（与 turn-rail 原实现的取舍一致）。
 */
export function activeIndex(tops: readonly number[], reading: number): number {
	if (tops.length === 0) return -1;
	let active = 0;
	for (let i = 0; i < tops.length; i++) {
		const top = tops[i];
		if (top !== undefined && top <= reading) active = i;
	}
	return active;
}
