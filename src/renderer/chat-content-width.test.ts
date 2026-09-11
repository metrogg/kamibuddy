import { describe, expect, it } from "vitest";
import { computeChatContentWidth } from "./chat-content-width.ts";

describe("computeChatContentWidth（WorkBuddy 分段口径）", () => {
	it("容器 ≤1200 固定 832", () => {
		expect(computeChatContentWidth(800)).toBe(832);
		expect(computeChatContentWidth(1200)).toBe(832);
	});

	it("1200 < 容器 ≤1600 取 65%", () => {
		expect(computeChatContentWidth(1400)).toBe(910);
		expect(computeChatContentWidth(1600)).toBe(1040);
	});

	it("1600 < 容器 ≤2000 取 60%", () => {
		expect(computeChatContentWidth(1800)).toBe(1080);
		expect(computeChatContentWidth(2000)).toBe(1200);
	});

	it("容器 >2000 取 55%，封顶 1400", () => {
		expect(computeChatContentWidth(2200)).toBe(1210);
		expect(computeChatContentWidth(4000)).toBe(1400);
	});
});
