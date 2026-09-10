/**
 * 消息导航刻度轨的纯函数核心：测量值 → 刻度比例、滚动位置 → 高亮刻度。
 *
 * 与 DOM 解耦是为了脱离 Electron/React 直接跑 vitest —— 比例换算与
 * 命中判定是这块唯一可能算错的地方，必须能被测试护栏罩住（与
 * documents/ 纯函数化同一理由，见 AGENTS.md §1）。
 */

/** 一条待换算的测量值：entry id + 其 DOM 顶端在滚动内容中的偏移（px）。 */
export interface TickMeasurement {
	readonly id: string;
	readonly top: number;
}

/** 一个刻度：entry id + 顶端偏移占滚动内容总高的比例（[0,1]）。 */
export interface Tick {
	readonly id: string;
	readonly ratio: number;
}

/**
 * 测量值 → 刻度。scrollHeight <= 0 说明容器还没布局，比例无从谈起，
 * 返回空数组（调用方此刻本就不该渲染刻度）。
 * 比例钳到 [0,1]：测量与渲染之间内容可能又长高（流式），top 超出
 * 当前 scrollHeight 时不能让刻度跑到轨道外。
 */
export function computeTicks(
	measurements: readonly TickMeasurement[],
	scrollHeight: number,
): readonly Tick[] {
	if (scrollHeight <= 0) return [];
	return measurements.map((m) => ({
		id: m.id,
		ratio: Math.min(1, Math.max(0, m.top / scrollHeight)),
	}));
}

/**
 * 高亮判定：取「视口顶之上最近」的刻度（ratio <= scrollRatio 中最大者）。
 * 全部刻度都在视口顶之下时取第一个刻度 —— 用户在会话最顶端时一个都不
 * 高亮，会让人误以为导航失效。空列表返回 undefined。
 */
export function nearestActiveTick(
	ticks: readonly Tick[],
	scrollRatio: number,
): string | undefined {
	let active: Tick | undefined;
	for (const tick of ticks) {
		if (tick.ratio <= scrollRatio && (active === undefined || tick.ratio > active.ratio)) {
			active = tick;
		}
	}
	return (active ?? ticks[0])?.id;
}
