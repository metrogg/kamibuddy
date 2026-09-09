import { describe, expect, it } from "vitest";
import { INPUT_CHAR_LIMIT, charCountState } from "./input-limit.ts";

describe("charCountState（余量显示与超限判定）", () => {
	it("剩余 1000：还没到显示阈值", () => {
		const s = charCountState(INPUT_CHAR_LIMIT - 1000);
		expect(s.remaining).toBe(1000);
		expect(s.show).toBe(false);
		expect(s.over).toBe(false);
	});

	it("剩余 999：开始显示，未超限", () => {
		const s = charCountState(INPUT_CHAR_LIMIT - 999);
		expect(s.remaining).toBe(999);
		expect(s.show).toBe(true);
		expect(s.over).toBe(false);
	});

	it("剩余 0（正好到上限）：显示但未超限", () => {
		const s = charCountState(INPUT_CHAR_LIMIT);
		expect(s.remaining).toBe(0);
		expect(s.show).toBe(true);
		expect(s.over).toBe(false);
	});

	it("剩余 -1：超限，标红禁发", () => {
		const s = charCountState(INPUT_CHAR_LIMIT + 1);
		expect(s.remaining).toBe(-1);
		expect(s.show).toBe(true);
		expect(s.over).toBe(true);
	});
});
