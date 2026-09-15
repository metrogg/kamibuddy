import { describe, expect, it } from "vitest";
import {
	averageTtftMs,
	billedInputTokens,
	cacheHitRate,
	decodeTokensPerSecond,
	emptyUsage,
	type SessionStatCard,
} from "./observability.ts";

/** 造一张会话卡：只给本文件关心的字段，其余按缺省。 */
function card(overrides: Partial<SessionStatCard> = {}): SessionStatCard {
	return {
		sessionId: "s1",
		runs: 0,
		turns: 0,
		llmMs: 0,
		toolMs: 0,
		ttftMs: 0,
		ttftCalls: 0,
		decodeMs: 0,
		decodeTokens: 0,
		usage: emptyUsage(),
		cacheHitRate: undefined,
		lastActiveAt: 0,
		...overrides,
	};
}

describe("billedInputTokens", () => {
	it("把 prompt 侧三个不相交的桶相加（含 cacheWrite）", () => {
		expect(
			billedInputTokens({ ...emptyUsage(), input: 100, cacheRead: 900, cacheWrite: 200 }),
		).toBe(1200);
	});

	it("全零时为 0", () => {
		expect(billedInputTokens(emptyUsage())).toBe(0);
	});
});

describe("cacheHitRate", () => {
	it("分母含 cacheWrite —— 修正前漏掉它会让命中率偏高", () => {
		// 旧口径 input + cacheRead = 100 + 900 = 1000 → 90%
		// 新口径三桶之和 1200 → 75%；cacheWrite 确实没命中，该占分母。
		const usage = { ...emptyUsage(), input: 100, cacheRead: 900, cacheWrite: 200 };
		expect(cacheHitRate(usage)).toBeCloseTo(900 / 1200, 10);
	});

	it("没有任何 prompt 侧 token 时为 undefined（UI 显示「—」而非 0%）", () => {
		expect(cacheHitRate({ ...emptyUsage(), output: 50 })).toBeUndefined();
	});

	it("只有 cacheWrite（首次写缓存、本轮未命中）时为 0，不是 undefined", () => {
		// 修正前分母为 0 会返回 undefined，把「确实没命中」说成「没有数据」。
		expect(cacheHitRate({ ...emptyUsage(), cacheWrite: 500 })).toBe(0);
	});

	it("全命中（无未缓存输入）时为 1", () => {
		expect(cacheHitRate({ ...emptyUsage(), cacheRead: 1000 })).toBe(1);
	});
});

describe("averageTtftMs", () => {
	it("按调用数取平均", () => {
		expect(averageTtftMs(card({ ttftMs: 3000, ttftCalls: 3 }))).toBe(1000);
	});

	it("没有带 TTFT 的调用时为 undefined（不给出 0，避免看起来像「首字即到」）", () => {
		expect(averageTtftMs(card({ ttftMs: 0, ttftCalls: 0 }))).toBeUndefined();
	});
});

describe("decodeTokensPerSecond", () => {
	it("按解码墙钟算速度", () => {
		// 2000 token / 4s = 500 tok/s
		expect(decodeTokensPerSecond(card({ decodeMs: 4000, decodeTokens: 2000 }))).toBe(500);
	});

	it("没有解码样本（decodeMs 为 0）时为 undefined", () => {
		expect(decodeTokensPerSecond(card({ decodeMs: 0, decodeTokens: 999 }))).toBeUndefined();
	});
});
