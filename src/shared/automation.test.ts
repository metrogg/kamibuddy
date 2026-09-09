import { describe, expect, it } from "vitest";
import {
	nextRunAfter,
	scheduleSummary,
	validateSchedule,
	type Schedule,
} from "./automation.ts";

/** 本地时间构造，避免测试依赖固定时区。 */
function at(y: number, m: number, d: number, h: number, min: number): number {
	return new Date(y, m - 1, d, h, min).getTime();
}

describe("nextRunAfter · once", () => {
	it("未来时刻返回 at 本身", () => {
		expect(nextRunAfter({ type: "once", at: 1001 }, 1000)).toBe(1001);
	});

	it("过去时刻返回 undefined（不补跑）", () => {
		expect(nextRunAfter({ type: "once", at: 999 }, 1000)).toBeUndefined();
	});

	it("恰好等于 from 视为已错过（严格晚于）", () => {
		expect(nextRunAfter({ type: "once", at: 1000 }, 1000)).toBeUndefined();
	});
});

describe("nextRunAfter · interval", () => {
	// 锚语义：序列 0 点 = epoch 0，落点 = k * everyMinutes。
	// 用毫秒算术取序列点，与本地时区完全无关。
	const intervalMs = 30 * 60_000;
	const boundary = 41_000 * intervalMs;

	it("from 在序列点前一毫秒 → 取整到该序列点", () => {
		expect(nextRunAfter({ type: "interval", everyMinutes: 30 }, boundary - 1)).toBe(boundary);
	});

	it("from 恰在序列点上 → 下一个序列点（严格晚于）", () => {
		expect(nextRunAfter({ type: "interval", everyMinutes: 30 }, boundary)).toBe(
			boundary + intervalMs,
		);
	});

	it("from 在区间中段 → 向上取整到下一个序列点", () => {
		expect(nextRunAfter({ type: "interval", everyMinutes: 30 }, boundary + 1)).toBe(
			boundary + intervalMs,
		);
	});

	it("非法间隔抛错（合法性判定在 validateSchedule，这里响亮失败）", () => {
		expect(() => nextRunAfter({ type: "interval", everyMinutes: 0 }, 0)).toThrow(/非法间隔/);
	});
});

describe("nextRunAfter · daily", () => {
	it("当天时刻未到 → 今天", () => {
		expect(nextRunAfter({ type: "daily", time: "18:30" }, at(2026, 9, 9, 8, 0))).toBe(
			at(2026, 9, 9, 18, 30),
		);
	});

	it("跨日：时刻已过 → 明天", () => {
		expect(nextRunAfter({ type: "daily", time: "09:00" }, at(2026, 9, 9, 23, 0))).toBe(
			at(2026, 9, 10, 9, 0),
		);
	});

	it("跨日边界：恰好在触发时刻 → 明天（严格晚于）", () => {
		expect(nextRunAfter({ type: "daily", time: "18:30" }, at(2026, 9, 9, 18, 30))).toBe(
			at(2026, 9, 10, 18, 30),
		);
	});

	it("跨月：月末次日归一到次月 1 日", () => {
		expect(nextRunAfter({ type: "daily", time: "09:00" }, at(2026, 9, 30, 20, 0))).toBe(
			at(2026, 10, 1, 9, 0),
		);
	});

	it("非法时间格式抛错", () => {
		expect(() => nextRunAfter({ type: "daily", time: "9:00" }, 0)).toThrow(/非法时间格式/);
	});
});

describe("nextRunAfter · weekly", () => {
	it("当天时刻未到 → 今天", () => {
		const from = at(2026, 9, 4, 8, 0); // 2026-09-04 是周五
		expect(new Date(from).getDay()).toBe(5); // 前置校验：日期推错了这里先炸
		expect(nextRunAfter({ type: "weekly", time: "09:00", weekdays: [5] }, from)).toBe(
			at(2026, 9, 4, 9, 0),
		);
	});

	it("跨周：周五 10:00 + 工作日 09:00 → 下周一 09:00（spec 场景）", () => {
		const from = at(2026, 9, 4, 10, 0); // 周五，当天 09:00 已过
		expect(
			nextRunAfter({ type: "weekly", time: "09:00", weekdays: [1, 2, 3, 4, 5] }, from),
		).toBe(at(2026, 9, 7, 9, 0));
	});

	it("周末折返：周日 10:00 + [周六, 周日] 09:00 → 下周六", () => {
		const from = at(2026, 9, 6, 10, 0); // 2026-09-06 是周日，当天 09:00 已过
		expect(new Date(from).getDay()).toBe(0);
		expect(nextRunAfter({ type: "weekly", time: "09:00", weekdays: [6, 0] }, from)).toBe(
			at(2026, 9, 12, 9, 0),
		);
	});

	it("同一星期下周兜底：今天时刻已过且集合只含今天 → 7 天后", () => {
		const from = at(2026, 9, 4, 10, 0); // 周五
		expect(nextRunAfter({ type: "weekly", time: "09:00", weekdays: [5] }, from)).toBe(
			at(2026, 9, 11, 9, 0),
		);
	});

	it("空 weekdays → undefined", () => {
		expect(
			nextRunAfter({ type: "weekly", time: "09:00", weekdays: [] }, at(2026, 9, 4, 8, 0)),
		).toBeUndefined();
	});
});

describe("validateSchedule", () => {
	it("once 一律合法（过去的 at 由 missed 语义接管）", () => {
		expect(validateSchedule({ type: "once", at: 0 })).toBeUndefined();
		expect(validateSchedule({ type: "once", at: Date.now() + 60_000 })).toBeUndefined();
	});

	it.each([0, -5, 1.5])("interval 非法间隔：%s", (everyMinutes) => {
		expect(validateSchedule({ type: "interval", everyMinutes })).toBe(
			"间隔分钟数必须是正整数",
		);
	});

	it.each([1, 30, 24 * 60])("interval 合法间隔：%s", (everyMinutes) => {
		expect(validateSchedule({ type: "interval", everyMinutes })).toBeUndefined();
	});

	it.each(["9:00", "24:00", "12:60", "09:00:00", "ab:cd", ""])(
		"daily 非法时间：%j",
		(time) => {
			expect(validateSchedule({ type: "daily", time })).toBe(
				"时间格式应为 HH:mm（如 09:00）",
			);
		},
	);

	it.each(["09:00", "00:00", "23:59"])("daily 合法时间：%s", (time) => {
		expect(validateSchedule({ type: "daily", time })).toBeUndefined();
	});

	it("weekly 时间非法", () => {
		expect(validateSchedule({ type: "weekly", time: "9:00", weekdays: [1] })).toBe(
			"时间格式应为 HH:mm（如 09:00）",
		);
	});

	it("weekly 空 weekdays", () => {
		expect(validateSchedule({ type: "weekly", time: "09:00", weekdays: [] })).toBe(
			"请至少选择一个星期",
		);
	});

	it("weekly 合法", () => {
		expect(validateSchedule({ type: "weekly", time: "09:00", weekdays: [0, 6] })).toBeUndefined();
	});
});

describe("scheduleSummary", () => {
	it.each<[Schedule, string]>([
		[{ type: "once", at: at(2026, 9, 10, 9, 0) }, "一次性 · 2026/9/10 09:00"],
		[{ type: "once", at: at(2026, 12, 31, 23, 5) }, "一次性 · 2026/12/31 23:05"],
		[{ type: "interval", everyMinutes: 1 }, "每 1 分钟"],
		[{ type: "interval", everyMinutes: 30 }, "每 30 分钟"],
		[{ type: "daily", time: "09:00" }, "每天 09:00"],
		[{ type: "daily", time: "18:05" }, "每天 18:05"],
		[{ type: "weekly", time: "09:00", weekdays: [1, 3, 5] }, "每周一、三、五 09:00"],
		[{ type: "weekly", time: "09:00", weekdays: [0] }, "每周日 09:00"],
		// 乱序输入按周一开头的惯例周序展示
		[{ type: "weekly", time: "09:00", weekdays: [5, 1] }, "每周一、五 09:00"],
		[{ type: "weekly", time: "09:00", weekdays: [0, 6] }, "每周六、日 09:00"],
	])("%j → %s", (schedule, expected) => {
		expect(scheduleSummary(schedule)).toBe(expected);
	});
});
