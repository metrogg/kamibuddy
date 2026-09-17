import { describe, expect, it } from "vitest";
import {
	averageTtftMs,
	billedInputTokens,
	cacheHitRate,
	contentFingerprint,
	decodeTokensPerSecond,
	emptyUsage,
	reportsCacheActivity,
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
		cacheReported: true,
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
		expect(cacheHitRate(usage, true)).toBeCloseTo(900 / 1200, 10);
	});

	it("没有任何 prompt 侧 token 时为 undefined（UI 显示「—」而非 0%）", () => {
		expect(cacheHitRate({ ...emptyUsage(), output: 50 }, true)).toBeUndefined();
	});

	it("只有 cacheWrite（首次写缓存、本轮未命中）时为 0，不是 undefined", () => {
		// 修正前分母为 0 会返回 undefined，把「确实没命中」说成「没有数据」。
		expect(cacheHitRate({ ...emptyUsage(), cacheWrite: 500 }, true)).toBe(0);
	});

	it("全命中（无未缓存输入）时为 1", () => {
		expect(cacheHitRate({ ...emptyUsage(), cacheRead: 1000 }, true)).toBe(1);
	});

	it("provider 从未上报过缓存活动时为 undefined，而不是误导性的 0%", () => {
		// 不支持缓存的服务商，pi 把 cacheRead/cacheWrite 一律填 0，「全 miss」与
		// 「没有这个数据」在数字上完全一样 —— 后者必须留空（2026-09-17 修正）。
		const usage = { ...emptyUsage(), input: 5000, output: 10 };
		expect(cacheHitRate(usage, false)).toBeUndefined();
		expect(cacheHitRate(usage, true)).toBe(0);
	});
});

describe("reportsCacheActivity", () => {
	it("cacheRead / cacheWrite 任一非零即为 true", () => {
		expect(reportsCacheActivity({ ...emptyUsage(), cacheRead: 1 })).toBe(true);
		expect(reportsCacheActivity({ ...emptyUsage(), cacheWrite: 1 })).toBe(true);
	});

	it("两者都是 0（或字段缺席）为 false", () => {
		expect(reportsCacheActivity(emptyUsage())).toBe(false);
		expect(reportsCacheActivity({})).toBe(false);
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

describe("contentFingerprint（消息与系统提示词分段共用的内容指纹）", () => {
	it("同内容同指纹 —— 等值比较的前提", () => {
		expect(contentFingerprint("技能清单段")).toBe(contentFingerprint("技能清单段"));
		// 空串也是一个合法输入（空段压平后不会出现，但判据不该依赖它）。
		expect(contentFingerprint("")).toBe(contentFingerprint(""));
	});

	it("不同内容不同指纹（含同长度改一个字符）", () => {
		expect(contentFingerprint("技能清单A")).not.toBe(contentFingerprint("技能清单B"));
		// 长度相同、只差一个字符：字符数比不出来，只有指纹能。
		expect(contentFingerprint("abc")).not.toBe(contentFingerprint("abd"));
	});

	it("指纹是 32 位无符号整数 —— 只有等值比较这一种用法，带不出正文", () => {
		const fp = contentFingerprint("长期记忆：用户偏好简洁");
		expect(Number.isInteger(fp)).toBe(true);
		expect(fp).toBeGreaterThanOrEqual(0);
		expect(fp).toBeLessThanOrEqual(0xffffffff);
	});
});
