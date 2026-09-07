import { describe, expect, it } from "vitest";
import { buildContextUsage, formatTokenCount } from "./context-usage.ts";

describe("buildContextUsage", () => {
	it("技能段从系统提示词里拆出，对话 = 用户+助手+思考，工具结果单列", () => {
		const r = buildContextUsage({
			used: 5200,
			total: 128000,
			systemPromptTokens: 4000,
			skillsTokens: 500,
			composition: { system: 4000, user: 100, assistant: 200, thinking: 50, tools: 800 },
		});
		expect(r.used).toBe(5200);
		expect(r.total).toBe(128000);
		expect(r.byCategory).toEqual({
			systemPrompt: 3500,
			skills: 500,
			conversation: 350,
			toolResults: 800,
		});
	});

	it("技能段大于系统提示词总量时钳位（估算误差不该造出负数）", () => {
		const r = buildContextUsage({
			used: 100,
			total: 1000,
			systemPromptTokens: 300,
			skillsTokens: 400,
			composition: { system: 300, user: 0, assistant: 0, thinking: 0, tools: 0 },
		});
		expect(r.byCategory.systemPrompt).toBe(0);
		expect(r.byCategory.skills).toBe(300);
	});

	it("used/total 原样透传（它们来自 pi 的精确值，不做估算加工）", () => {
		const r = buildContextUsage({
			used: 0,
			total: 200000,
			systemPromptTokens: 0,
			skillsTokens: 0,
			composition: { system: 0, user: 0, assistant: 0, thinking: 0, tools: 0 },
		});
		expect(r.used).toBe(0);
		expect(r.total).toBe(200000);
	});
});

describe("formatTokenCount", () => {
	it("小于 1000 原样显示", () => {
		expect(formatTokenCount(0)).toBe("0");
		expect(formatTokenCount(999)).toBe("999");
	});

	it("大于等于 1000 按 K 显示一位小数", () => {
		expect(formatTokenCount(1000)).toBe("1.0K");
		expect(formatTokenCount(5200)).toBe("5.2K");
		expect(formatTokenCount(128000)).toBe("128.0K");
	});
});
