/**
 * 回合指标 fold 的行为测试（spec: surface-run-metrics-in-chat Task 1）。
 *
 * 钉住四类行为：
 *   1. usage 聚合（单条 / 多条求和 / 缺字段不填 0）
 *   2. 回合计时（停表用 endedAt / 流式用 now / 无回合为 0）
 *   3. 命中率复用 cacheHitRate（数据不齐时留空，不误导成 0%）
 *   4. 回合边界（上一轮的 assistant 不计入本轮）
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
		expect(m.inputTokens).toBe(100);
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
		expect(m.inputTokens).toBe(300);
		expect(m.outputTokens).toBe(110);
		expect(m.cacheReadTokens).toBe(1_000);
		expect(m.hitRate).toBeCloseTo(1_000 / 1_300, 10);
	});

	it("全无 usage：三个 token 字段与命中率均 undefined，耗时照常", () => {
		const entries: readonly ConversationEntry[] = [user("u1"), assistant("a1")];
		const m = foldTurnMetrics(entries, { startedAt: 1_000, endedAt: 3_000 }, 9_999);
		expect(m.inputTokens).toBeUndefined();
		expect(m.outputTokens).toBeUndefined();
		expect(m.cacheReadTokens).toBeUndefined();
		expect(m.hitRate).toBeUndefined();
		expect(m.elapsedMs).toBe(2_000);
	});

	it("部分字段缺失：cacheRead 未上报时留空且不算命中率，其余正常", () => {
		const entries: readonly ConversationEntry[] = [user("u1"), assistant("a1", usage({ input: 100, output: 20 }))];
		const m = foldTurnMetrics(entries, { startedAt: 1_000, endedAt: 2_000 }, 2_000);
		expect(m.inputTokens).toBe(100);
		expect(m.outputTokens).toBe(20);
		expect(m.cacheReadTokens).toBeUndefined();
		expect(m.hitRate).toBeUndefined();
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
		expect(m.inputTokens).toBe(100);
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
		expect(m.inputTokens).toBe(100);
		expect(m.outputTokens).toBe(10);
		expect(m.cacheReadTokens).toBe(900);
		expect(m.hitRate).toBeCloseTo(0.9, 10);
	});
});
