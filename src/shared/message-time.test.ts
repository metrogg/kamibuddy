import { describe, expect, it } from "vitest";
import { formatMessageTime } from "./message-time.ts";

/** 本地时间构造，避免测试依赖固定时区。 */
function at(y: number, m: number, d: number, h: number, min: number): number {
	return new Date(y, m - 1, d, h, min).getTime();
}

describe("formatMessageTime", () => {
	it("当天：只显示 HH:mm", () => {
		expect(formatMessageTime(at(2026, 9, 8, 9, 5), at(2026, 9, 8, 15, 30))).toBe("09:05");
	});

	it("时分补零（0 点 3 分 → 00:03）", () => {
		expect(formatMessageTime(at(2026, 9, 8, 0, 3), at(2026, 9, 8, 12, 0))).toBe("00:03");
	});

	it("昨天：昨天 HH:mm", () => {
		expect(formatMessageTime(at(2026, 9, 7, 22, 10), at(2026, 9, 8, 9, 0))).toBe("昨天 22:10");
	});

	it("0 点跨天边界：昨晚 23:59 是「昨天」，今天 0:00 是「当天」", () => {
		const now = at(2026, 9, 8, 0, 1);
		expect(formatMessageTime(at(2026, 9, 7, 23, 59), now)).toBe("昨天 23:59");
		expect(formatMessageTime(at(2026, 9, 8, 0, 0), now)).toBe("00:00");
	});

	it("「昨天」跨月回退：3 月 1 日看 2 月 28 日", () => {
		expect(formatMessageTime(at(2026, 2, 28, 18, 45), at(2026, 3, 1, 8, 0))).toBe("昨天 18:45");
	});

	it("「昨天」跨年回退：1 月 1 日看去年 12 月 31 日", () => {
		expect(formatMessageTime(at(2025, 12, 31, 23, 30), at(2026, 1, 1, 0, 30))).toBe("昨天 23:30");
	});

	it("当年更早：M月D日 HH:mm（不补零）", () => {
		expect(formatMessageTime(at(2026, 3, 5, 7, 8), at(2026, 9, 8, 12, 0))).toBe("3月5日 07:08");
	});

	it("跨年：YYYY年M月D日 HH:mm", () => {
		expect(formatMessageTime(at(2025, 3, 5, 7, 8), at(2026, 9, 8, 12, 0))).toBe("2025年3月5日 07:08");
	});
});
