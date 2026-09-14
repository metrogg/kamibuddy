import { describe, expect, it } from "vitest";
import { autoSessionDirName, isAutoSessionDirName } from "./workspace.ts";

/** 本地时间构造，避免测试依赖固定时区（与 message-time.test.ts 同惯例）。 */
function at(y: number, m: number, d: number, h: number, min: number, s: number): Date {
	// m 按人读的 1-12 传入，Date 构造器按 0-11 收，这里 -1。
	return new Date(y, m - 1, d, h, min, s);
}

describe("autoSessionDirName", () => {
	it("常用时刻：YYYY-MM-DD-HH-mm-ss", () => {
		expect(autoSessionDirName(at(2026, 9, 14, 17, 30, 45))).toBe("2026-09-14-17-30-45");
	});

	it("补零边界：个位月/日/时/分/秒都补成两位", () => {
		expect(autoSessionDirName(at(2026, 1, 2, 3, 4, 5))).toBe("2026-01-02-03-04-05");
	});

	it("月份 +1：1 月为 01（getMonth() 从 0 起算的坑）", () => {
		expect(autoSessionDirName(at(2026, 1, 15, 12, 0, 0))).toBe("2026-01-15-12-00-00");
	});

	it("12 月不越界为 13", () => {
		expect(autoSessionDirName(at(2026, 12, 31, 23, 59, 59))).toBe("2026-12-31-23-59-59");
	});
});

describe("isAutoSessionDirName", () => {
	it("命中标准格式", () => {
		expect(isAutoSessionDirName("2026-09-14-17-30-45")).toBe(true);
	});

	it("不命中未补零的 `2026-9-1-1-1-1`", () => {
		expect(isAutoSessionDirName("2026-9-1-1-1-1")).toBe(false);
	});

	it("不命中自动化目录 `automation-2026-09-14-17-30-45`", () => {
		expect(isAutoSessionDirName("automation-2026-09-14-17-30-45")).toBe(false);
	});

	it("不命中 WorkBuddy 历史纯数字格式 `20260407213401`（我们不复刻）", () => {
		expect(isAutoSessionDirName("20260407213401")).toBe(false);
	});

	it("不命中中文目录名 `临时任务`", () => {
		expect(isAutoSessionDirName("临时任务")).toBe(false);
	});

	it("不命中空串", () => {
		expect(isAutoSessionDirName("")).toBe(false);
	});

	it("不命中后缀多余的 `2026-09-14-17-30-45-extra`", () => {
		expect(isAutoSessionDirName("2026-09-14-17-30-45-extra")).toBe(false);
	});
});
