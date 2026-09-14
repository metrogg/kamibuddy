import { describe, expect, it } from "vitest";

import {
	buildHeatmapWeeks,
	heatmapLevel,
	localDateKey,
	type UsageHeatmapDay,
} from "./usage-stats.ts";

describe("heatmapLevel", () => {
	it("无活动或全局最大为 0 时是空档", () => {
		expect(heatmapLevel(0, 80)).toBe(0);
		expect(heatmapLevel(0, 0)).toBe(0);
		expect(heatmapLevel(5, 0)).toBe(0);
	});

	it("阈值边界与 WorkBuddy 的 getActivityLevel 同口径", () => {
		expect(heatmapLevel(20, 80)).toBe(1); // .25 → 1 档（含边界）
		expect(heatmapLevel(21, 80)).toBe(2); // 略超 .25
		expect(heatmapLevel(40, 80)).toBe(2); // .5 → 2 档
		expect(heatmapLevel(60, 80)).toBe(3); // .75 → 3 档
		expect(heatmapLevel(61, 80)).toBe(4);
		expect(heatmapLevel(80, 80)).toBe(4);
	});

	it("等级是相对量：同样的条数在不同量级下可以同档", () => {
		expect(heatmapLevel(20, 200)).toBe(1); // .1
		expect(heatmapLevel(20, 80)).toBe(1); // .25
	});
});

describe("localDateKey", () => {
	it("按本地时间取日期，不因 UTC 偏移错一天", () => {
		// 本地 2026-09-14 00:30：toISOString 在东八区会落到 09-13，这里不能。
		expect(localDateKey(new Date(2026, 8, 14, 0, 30))).toBe("2026-09-14");
	});
});

describe("buildHeatmapWeeks", () => {
	/** 2026-09-14 是周一，所在周的周日是 09-13 —— 断言用的固定「今天」。 */
	const today = new Date(2026, 8, 14, 10, 0, 0);

	const daily: readonly UsageHeatmapDay[] = [
		{ date: "2026-09-13", count: 5 }, // 周日，末列第 0 行
		{ date: "2026-09-14", count: 10 }, // 周一，末列第 1 行
		{ date: "2026-09-07", count: 2 }, // 上一周的周一
	];

	/** noUncheckedIndexedAccess 下的取值助手：越界给 undefined，断言自己会失败。 */
	const level = (grid: ReturnType<typeof buildHeatmapWeeks>, day: number, week: number) =>
		grid.weeks[day]?.[week];
	const cellDate = (grid: ReturnType<typeof buildHeatmapWeeks>, day: number, week: number) =>
		grid.dates[day]?.[week];

	it("网格是 7 行 × clamp(width-8,10,52) 列", () => {
		const grid = buildHeatmapWeeks(daily, { today });
		expect(grid.weeks).toHaveLength(7);
		expect(grid.totalWeeks).toBe(48); // width 56 → 56-8
		for (const row of grid.weeks) expect(row).toHaveLength(48);
	});

	it("列数有上下界（窄容器不塌、宽容器不无限长）", () => {
		expect(buildHeatmapWeeks(daily, { today, width: 12 }).totalWeeks).toBe(10);
		expect(buildHeatmapWeeks(daily, { today, width: 200 }).totalWeeks).toBe(52);
	});

	it("末列对齐到今天所在的周，今天与周日各自落在正确的行", () => {
		const grid = buildHeatmapWeeks(daily, { today });
		expect(level(grid, 0, 47)).toBe(2); // 09-13 周日：5/10 = .5 → 2 档
		expect(level(grid, 1, 47)).toBe(4); // 09-14 周一：10/10 → 4 档
		expect(grid.maxCount).toBe(10);
	});

	it("未来日期不着色（今天是周一，末列周二起留空）", () => {
		const grid = buildHeatmapWeeks(daily, { today });
		for (let day = 2; day < 7; day++) expect(level(grid, day, 47)).toBe(0);
	});

	it("日期矩阵与网格同形，未来格为空串", () => {
		const grid = buildHeatmapWeeks(daily, { today });
		expect(grid.dates).toHaveLength(7);
		expect(cellDate(grid, 0, 47)).toBe("2026-09-13");
		expect(cellDate(grid, 1, 47)).toBe("2026-09-14");
		expect(cellDate(grid, 2, 47)).toBe("");
	});

	it("没有活动的日子是空档", () => {
		const grid = buildHeatmapWeeks([], { today });
		expect(grid.maxCount).toBe(0);
		for (const row of grid.weeks) for (const level of row) expect(level).toBe(0);
	});

	it("月度标签从首列开始单调、每周至多一个", () => {
		const grid = buildHeatmapWeeks(daily, { today });
		expect(grid.monthLabels.length).toBeGreaterThan(1);
		expect(grid.monthLabels[0]).toEqual({ month: 9, week: 0 }); // 2025-10-19 是周日
		const weeks = grid.monthLabels.map((label) => label.week);
		expect(weeks).toEqual([...weeks].sort((a, b) => a - b));
		expect(new Set(weeks).size).toBe(weeks.length);
	});
});
