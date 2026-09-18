/**
 * 刻度轨纯函数核心的测试（turn-nav.ts）。
 *
 * 这块是「可能算错」的地方，脱离 DOM 单测：几何换算、指针命中、当前轮判定。
 * 三条最值得钉住的：
 *   - 固定间距换算（刻度不按内容比例压缩，位置只由序号决定）；
 *   - 指针命中是**就近取整**且越界钳端点（否则轨道上下端的留白会点不动）；
 *   - 当前轮是「越过阅读线的最后一轮」而不是「最近的一轮」——
 *     一轮内容高过视口时，后者会在长回答中间把高亮漂到下一轮去。
 */

import { describe, expect, it } from "vitest";
import type { TurnView } from "./turn-fold.ts";
import {
	FADE_PX,
	RAIL_INSET_PX,
	TURN_PITCH_PX,
	activeIndex,
	buildTurnNavItems,
	indexAtPointer,
	markTop,
	naturalRailHeight,
	railScrollState,
	readingTop,
	sameRailScrollState,
} from "./turn-nav.ts";

/**
 * 轮视图桩：key + 是否由 user 开启（前缀轮为 false）+ 两段预览。
 * 只填 buildTurnNavItems 真正读的字段。
 */
function views(
	entries: readonly (string | { key: string; prompt?: string; response?: string })[],
): readonly TurnView[] {
	return entries.map((entry) => {
		const spec = typeof entry === "string" ? { key: entry } : entry;
		return {
			key: spec.key,
			startsWithUser: spec.key !== "turn-prefix",
			preview: { prompt: spec.prompt ?? "", response: spec.response ?? "" },
		} as unknown as TurnView;
	});
}

describe("几何换算", () => {
	it("自然高度 = 刻度梯按固定间距铺开（无刻度时为 0）", () => {
		expect(naturalRailHeight(0)).toBe(0);
		expect(naturalRailHeight(1)).toBe(2 * RAIL_INSET_PX);
		expect(naturalRailHeight(2)).toBe(TURN_PITCH_PX + 2 * RAIL_INSET_PX);
		expect(naturalRailHeight(10)).toBe(9 * TURN_PITCH_PX + 2 * RAIL_INSET_PX);
	});

	it("刻度位含首端留白，且严格等差（不随轮的内容长短变化）", () => {
		expect(markTop(0)).toBe(RAIL_INSET_PX);
		expect(markTop(1) - markTop(0)).toBe(TURN_PITCH_PX);
		expect(markTop(7) - markTop(6)).toBe(TURN_PITCH_PX);
	});
});

describe("指针命中", () => {
	const rectTop = 100;
	const count = 5;

	it("压在刻度中心：命中该刻度", () => {
		for (let index = 0; index < count; index++) {
			expect(indexAtPointer(rectTop + markTop(index), rectTop, 0, count)).toBe(index);
		}
	});

	it("就近取整：刻度上方 4px 仍算它，下方 6px 才让给下一格", () => {
		const center = rectTop + markTop(2);
		expect(indexAtPointer(center - 4, rectTop, 0, count)).toBe(2);
		expect(indexAtPointer(center + 6, rectTop, 0, count)).toBe(3);
	});

	it("越界钳到端点（轨道上下端的留白上也给得出最近的刻度）", () => {
		expect(indexAtPointer(rectTop - 500, rectTop, 0, count)).toBe(0);
		expect(indexAtPointer(rectTop + 5000, rectTop, 0, count)).toBe(count - 1);
	});

	it("轨道自身的滚动量参与换算（梯子滚过之后命中不能错位）", () => {
		// 轨道向下滚了 30px（= 3 格）：同一个 clientY 现在应命中 3 格之后的刻度。
		const y = rectTop + markTop(0);
		expect(indexAtPointer(y, rectTop, 0, count)).toBe(0);
		expect(indexAtPointer(y, rectTop, 30, count)).toBe(3);
	});

	it("没有刻度时返回 -1（调用方据此整块不渲染）", () => {
		expect(indexAtPointer(rectTop, rectTop, 0, 0)).toBe(-1);
	});
});

describe("当前轮判定", () => {
	it("空梯返回 -1", () => {
		expect(activeIndex([], 100)).toBe(-1);
	});

	it("一轮都没越过阅读线 → 第 0 轮（会话最顶端一个都不亮会让人以为导航坏了）", () => {
		expect(activeIndex([500, 900], 100)).toBe(0);
	});

	it("取越过阅读线的最后一轮", () => {
		expect(activeIndex([0, 300, 800], 400)).toBe(1);
		expect(activeIndex([0, 300, 800], 800)).toBe(2);
		expect(activeIndex([0, 300, 800], 9999)).toBe(2);
	});

	it("越过阅读线的是**顶端**：一轮高过视口时高亮停在它身上，不漂到下一轮", () => {
		// 第 1 轮从 0 开始、高 5000px，第 2 轮在 5000。读到第 1 轮中部（阅读线 3000）：
		const tops = [0, 5000];
		expect(activeIndex(tops, 3000)).toBe(0);
		// 再往下读到第 2 轮里，才翻到第 2 轮。
		expect(activeIndex(tops, 5000)).toBe(1);
	});

	it("单调：向下滚只会把高亮往后推，不会回跳", () => {
		const tops = [0, 200, 900, 1500];
		let last = -1;
		for (let reading = 0; reading <= 2000; reading += 50) {
			const current = activeIndex(tops, reading);
			expect(current).toBeGreaterThanOrEqual(last);
			last = current;
		}
	});
});

describe("阅读线", () => {
	it("取视口高的 20% 与 96px 的较小值", () => {
		expect(readingTop(0, 1000)).toBe(96);
		expect(readingTop(0, 300)).toBe(60);
		expect(readingTop(500, 300)).toBe(560);
	});
});

describe("轨道自身滚动状态", () => {
	it("未溢出：两端都不可滚", () => {
		expect(railScrollState(0, 100, 100)).toEqual({ top: 0, canScrollUp: false, canScrollDown: false });
	});

	it("溢出且停在顶部：只有下方可滚", () => {
		expect(railScrollState(0, 500, 100)).toEqual({ top: 0, canScrollUp: false, canScrollDown: true });
	});

	it("滚到底：只有上方可滚", () => {
		expect(railScrollState(400, 500, 100)).toEqual({ top: 400, canScrollUp: true, canScrollDown: false });
	});

	it("1px 死区：亚像素滚动不会让渐隐遮罩闪", () => {
		expect(railScrollState(0.5, 500, 100).canScrollUp).toBe(false);
		expect(railScrollState(399.5, 500, 100).canScrollDown).toBe(false);
	});

	it("浅比较：只差 top 视为变化，全同视为未变", () => {
		// 取停在顶部的那档：canScrollUp 为假，翻成真才测得出「某一维变了」。
		const base = railScrollState(0, 500, 100);
		expect(base).toEqual({ top: 0, canScrollUp: false, canScrollDown: true });
		expect(sameRailScrollState(base, { ...base })).toBe(true);
		expect(sameRailScrollState(base, { ...base, top: 1 })).toBe(false);
		expect(sameRailScrollState(base, { ...base, canScrollUp: true })).toBe(false);
		expect(sameRailScrollState(base, { ...base, canScrollDown: false })).toBe(false);
	});
});

describe("刻度项", () => {
	it("序号 1 基、key 与预览一起带出、顺序与轮序一致", () => {
		const items = buildTurnNavItems(
			views([
				{ key: "turn-a", prompt: "第一问", response: "第一答" },
				{ key: "turn-b", prompt: "第二问" },
			]),
		);
		expect(items).toEqual([
			{ key: "turn-a", ordinal: 1, prompt: "第一问", response: "第一答" },
			{ key: "turn-b", ordinal: 2, prompt: "第二问", response: "" },
		]);
	});

	it("前缀轮不给刻度，且不给它占号（序号必须从第一句提问起算）", () => {
		const items = buildTurnNavItems(views(["turn-prefix", "turn-a", "turn-b"]));
		expect(items.map((item) => [item.key, item.ordinal])).toEqual([
			["turn-a", 1],
			["turn-b", 2],
		]);
	});

	it("前缀轮夹在中间也只跳过它，不打断后面的序号", () => {
		const items = buildTurnNavItems(views(["turn-a", "turn-prefix", "turn-b"]));
		expect(items.map((item) => item.key)).toEqual(["turn-a", "turn-b"]);
		expect(items.map((item) => item.ordinal)).toEqual([1, 2]);
	});

	it("空输入给空数组（不返回 undefined，调用方直接 .length）", () => {
		expect(buildTurnNavItems([])).toEqual([]);
	});
});

describe("常量口径", () => {
	it("渐隐带不超过半个刻度间距的量级（否则两端刻度会被吃掉）", () => {
		expect(FADE_PX).toBeLessThan(TURN_PITCH_PX * 3);
	});
});
