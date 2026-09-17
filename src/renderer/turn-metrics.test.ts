/**
 * 回合指标 fold 的行为测试（spec: surface-run-metrics-in-chat Task 1）。
 *
 * 钉住五类行为：
 *   1. usage 聚合（单条 / 多条求和 / 缺字段不填 0）
 *   2. 回合计时（停表用 endedAt / 流式用 now / 无回合为 0）
 *   3. 命中率复用 cacheHitRate（数据不齐时留空，不误导成 0%）
 *   4. 回合边界（上一轮的 assistant 不计入本轮）
 *   5. 页脚 ↑ 的口径 = billedInputTokens（三桶之和，不是「未缓存输入」；
 *      与命中率同分母 —— 这是 2026-09-17 与面板/底栏统一的口径，不会静默改回去）
 */

import { describe, expect, it } from "vitest";
import type { AssistantMessage, ConversationEntry, UserMessage } from "@shared/session-events.ts";
import type { TokenUsage } from "@shared/observability.ts";
import { foldTurnMetrics } from "./turn-metrics.ts";

function user(id: string): UserMessage {
	return { id, role: "user", text: `消息 ${id}`, at: 1 };
}

/** 只放传入字段：类型层 TokenUsage 字段必填，但运行时缺字段是真实形态（observability.ts 口径）。 */
function usage(fields: {
	input?: number;
	output?: number;
	cacheRead?: number;
	cacheWrite?: number;
}): TokenUsage {
	return fields as TokenUsage;
}

function assistant(id: string, u?: TokenUsage): AssistantMessage {
	return u === undefined
		? { id, role: "assistant", text: "", at: 1 }
		: { id, role: "assistant", text: "", usage: u, at: 1 };
}

describe("usage 聚合", () => {
	it("单轮单条：各字段取自该条 usage", () => {
		const entries: readonly ConversationEntry[] = [user("u1"), assistant("a1", usage({ input: 100, output: 50, cacheRead: 900 }))];
		const m = foldTurnMetrics(entries, { startedAt: 1_000, endedAt: 5_000 }, 9_999);
		// ↑ 是三桶之和：100 + 900 + 0（cacheWrite 未上报即不参与）。
		expect(m.billedInputTokens).toBe(1_000);
		expect(m.outputTokens).toBe(50);
		expect(m.cacheReadTokens).toBe(900);
		expect(m.hitRate).toBeCloseTo(0.9, 10);
	});

	it("单轮多条：逐字段求和", () => {
		const entries: readonly ConversationEntry[] = [
			user("u1"),
			assistant("a1", usage({ input: 100, output: 50, cacheRead: 900 })),
			assistant("a2", usage({ input: 200, output: 60, cacheRead: 100 })),
		];
		const m = foldTurnMetrics(entries, { startedAt: 1_000, endedAt: 5_000 }, 5_000);
		expect(m.billedInputTokens).toBe(1_300);
		expect(m.outputTokens).toBe(110);
		expect(m.cacheReadTokens).toBe(1_000);
		expect(m.hitRate).toBeCloseTo(1_000 / 1_300, 10);
	});

	it("全无 usage：三个 token 字段与命中率均 undefined，耗时照常", () => {
		const entries: readonly ConversationEntry[] = [user("u1"), assistant("a1")];
		const m = foldTurnMetrics(entries, { startedAt: 1_000, endedAt: 3_000 }, 9_999);
		expect(m.billedInputTokens).toBeUndefined();
		expect(m.outputTokens).toBeUndefined();
		expect(m.cacheReadTokens).toBeUndefined();
		expect(m.hitRate).toBeUndefined();
		expect(m.elapsedMs).toBe(2_000);
	});

	it("部分字段缺失：cacheRead 未上报时留空且不算命中率，其余正常", () => {
		const entries: readonly ConversationEntry[] = [user("u1"), assistant("a1", usage({ input: 100, output: 20 }))];
		const m = foldTurnMetrics(entries, { startedAt: 1_000, endedAt: 2_000 }, 2_000);
		// 三桶里只上报了 input，仍按三桶之和口径显示（= 100），不是填 0 补另外两桶。
		expect(m.billedInputTokens).toBe(100);
		expect(m.outputTokens).toBe(20);
		expect(m.cacheReadTokens).toBeUndefined();
		expect(m.hitRate).toBeUndefined();
	});

	it("命中率分母含 cacheWrite（与 daemon 会话卡同一口径）", () => {
		const entries: readonly ConversationEntry[] = [
			user("u1"),
			assistant("a1", usage({ input: 100, output: 10, cacheRead: 900, cacheWrite: 200 })),
		];
		const m = foldTurnMetrics(entries, { startedAt: 1_000, endedAt: 2_000 }, 2_000);
		// 900 / (100 + 900 + 200) = 0.75；修正前只传 input + cacheRead 会算成 0.9。
		expect(m.hitRate).toBeCloseTo(0.75, 10);
		expect(m.billedInputTokens).toBe(1_200);
	});

	it("整段对话都没上报过缓存活动 → 留空（不是误导性的 0%）", () => {
		const entries: readonly ConversationEntry[] = [
			user("u1"),
			assistant("a1", usage({ input: 5_000, output: 20, cacheRead: 0 })),
		];
		const m = foldTurnMetrics(entries, { startedAt: 1_000, endedAt: 2_000 }, 2_000);
		expect(m.hitRate).toBeUndefined();
	});
});

describe("↑ 的口径（billed，不是未缓存输入）", () => {
	/** 真实台账 01a0ae43-… 的第 3 轮（页脚实拍：改前 ↑75.5K · ↓31.1K · 命中 94%）。 */
	it("三桶之和：|Σinput| 与 billed 在命中率高时相差一个量级", () => {
		const entries: readonly ConversationEntry[] = [
			user("u1"),
			assistant(
				"a1",
				usage({ input: 75_493, output: 31_055, cacheRead: 1_202_560, cacheWrite: 0 }),
			),
		];
		const m = foldTurnMetrics(entries, { startedAt: 1_000, endedAt: 2_000 }, 2_000);
		// 改前页脚显示的是未缓存输入 75_493（75.5K），改后是 1_278_053（1.3M）。
		expect(m.billedInputTokens).toBe(1_278_053);
		expect(m.hitRate).toBeCloseTo(1_202_560 / 1_278_053, 10);
	});

	it("与命中率同分母：billed × 命中 ≈ cacheRead、billed × (1−命中) ≈ 未缓存输入", () => {
		const entries: readonly ConversationEntry[] = [
			user("u1"),
			assistant(
				"a1",
				usage({ input: 75_493, output: 31_055, cacheRead: 1_202_560, cacheWrite: 0 }),
			),
		];
		const m = foldTurnMetrics(entries, { startedAt: 1_000, endedAt: 2_000 }, 2_000);
		const billed = m.billedInputTokens ?? 0;
		const hit = m.hitRate ?? 0;
		// 页脚三个读数的自洽性：显示的 ↑ × 显示的命中率 应还原出 cacheRead。
		expect(billed * hit).toBeCloseTo(1_202_560, 0);
		expect(billed * (1 - hit)).toBeCloseTo(75_493, 0);
	});

	it("cacheRead 单独上报（没有 input）也算 billed：不被门控藏掉", () => {
		const entries: readonly ConversationEntry[] = [
			user("u1"),
			assistant("a1", usage({ cacheRead: 900, output: 5 })),
		];
		const m = foldTurnMetrics(entries, { startedAt: 1_000, endedAt: 2_000 }, 2_000);
		expect(m.billedInputTokens).toBe(900);
	});
});

describe("回合计时", () => {
	it("流式中（endedAt 缺失）：用传入 now 计算耗时", () => {
		const entries: readonly ConversationEntry[] = [user("u1"), assistant("a1", usage({ input: 1, output: 1, cacheRead: 1 }))];
		const m = foldTurnMetrics(entries, { startedAt: 1_000 }, 3_500);
		expect(m.elapsedMs).toBe(2_500);
	});

	it("turn 为 undefined：耗时为 0 且不抛错，usage 仍照常聚合", () => {
		const entries: readonly ConversationEntry[] = [user("u1"), assistant("a1", usage({ input: 100, output: 1, cacheRead: 1 }))];
		const m = foldTurnMetrics(entries, undefined, 3_500);
		expect(m.elapsedMs).toBe(0);
		expect(m.billedInputTokens).toBe(101);
	});
});

describe("回合边界", () => {
	it("上一轮的 assistant 消息不计入本轮", () => {
		const entries: readonly ConversationEntry[] = [
			user("u1"),
			assistant("a1", usage({ input: 999, output: 999, cacheRead: 500 })),
			user("u2"),
			assistant("a2", usage({ input: 100, output: 10, cacheRead: 900 })),
		];
		const m = foldTurnMetrics(entries, { startedAt: 1_000, endedAt: 2_000 }, 2_000);
		expect(m.billedInputTokens).toBe(1_000);
		expect(m.outputTokens).toBe(10);
		expect(m.cacheReadTokens).toBe(900);
		expect(m.hitRate).toBeCloseTo(0.9, 10);
	});
});
