import { describe, expect, it } from "vitest";
import { computeTicks, nearestActiveTick } from "./turn-rail.ts";

describe("computeTicks（测量值 → 刻度比例）", () => {
	it("按 top / scrollHeight 换算比例", () => {
		expect(
			computeTicks(
				[
					{ id: "a", top: 100 },
					{ id: "b", top: 400 },
				],
				800,
			),
		).toEqual([
			{ id: "a", ratio: 0.125 },
			{ id: "b", ratio: 0.5 },
		]);
	});

	it("比例钳到 [0,1]：负偏移与超出总高都不越界", () => {
		expect(
			computeTicks(
				[
					{ id: "a", top: -10 },
					{ id: "b", top: 1200 },
				],
				800,
			),
		).toEqual([
			{ id: "a", ratio: 0 },
			{ id: "b", ratio: 1 },
		]);
	});

	it("scrollHeight <= 0（容器未布局）返回空数组", () => {
		expect(computeTicks([{ id: "a", top: 1 }], 0)).toEqual([]);
		expect(computeTicks([{ id: "a", top: 1 }], -5)).toEqual([]);
	});

	it("空测量列表返回空数组", () => {
		expect(computeTicks([], 800)).toEqual([]);
	});

	it("单刻度：位于内容顶端比例为 0", () => {
		expect(computeTicks([{ id: "only", top: 0 }], 500)).toEqual([{ id: "only", ratio: 0 }]);
	});
});

describe("nearestActiveTick（视口顶之上最近的高亮）", () => {
	const ticks = [
		{ id: "t1", ratio: 0.1 },
		{ id: "t2", ratio: 0.5 },
		{ id: "t3", ratio: 0.9 },
	];

	it("取视口顶之上最近的刻度", () => {
		expect(nearestActiveTick(ticks, 0.6)).toBe("t2");
	});

	it("边界命中：滚动比例恰好等于刻度比例时取该刻度", () => {
		expect(nearestActiveTick(ticks, 0.5)).toBe("t2");
	});

	it("越过最后一个刻度 → 最后一个高亮", () => {
		expect(nearestActiveTick(ticks, 1)).toBe("t3");
	});

	it("全部刻度都在视口顶之下 → 取第一个刻度", () => {
		expect(nearestActiveTick(ticks, 0.05)).toBe("t1");
	});

	it("单刻度任意位置都命中它", () => {
		expect(nearestActiveTick([{ id: "only", ratio: 0.4 }], 0)).toBe("only");
		expect(nearestActiveTick([{ id: "only", ratio: 0.4 }], 1)).toBe("only");
	});

	it("空刻度列表返回 undefined", () => {
		expect(nearestActiveTick([], 0.5)).toBeUndefined();
	});
});
