import { describe, expect, it } from "vitest";
import { thinkingOpen, toggleThinking } from "./thinking-fold.ts";

describe("thinkingOpen（无用户干预时跟随流式状态）", () => {
	it("流式中 → 展开（让用户看到推导过程）", () => {
		expect(thinkingOpen(true, undefined)).toBe(true);
	});

	it("流式结束 → 收起（完成态不占正文）", () => {
		expect(thinkingOpen(false, undefined)).toBe(false);
	});

	it("历史消息（非流式）默认收起", () => {
		expect(thinkingOpen(false, undefined)).toBe(false);
	});
});

describe("toggleThinking（用户手动干预优先）", () => {
	it("流式中点击 → 收起并记住偏好", () => {
		const override = toggleThinking(true, undefined);
		expect(thinkingOpen(true, override)).toBe(false);
	});

	it("流式中收起后，流式结束不再自动展开", () => {
		const override = toggleThinking(true, undefined);
		// streaming 翻转为 false，用户偏好不变 → 仍收起。
		expect(thinkingOpen(false, override)).toBe(false);
	});

	it("流式中连续点击两次 → 回到展开", () => {
		let override = toggleThinking(true, undefined);
		override = toggleThinking(true, override);
		expect(thinkingOpen(true, override)).toBe(true);
	});

	it("完成后手动展开 → 保持展开（不被自动行为覆盖）", () => {
		const override = toggleThinking(false, undefined);
		expect(thinkingOpen(false, override)).toBe(true);
	});

	it("完成后再点一次 → 收起", () => {
		let override = toggleThinking(false, undefined);
		override = toggleThinking(false, override);
		expect(thinkingOpen(false, override)).toBe(false);
	});
});
