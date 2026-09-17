import { describe, expect, it } from "vitest";
import type {
	RunLedgerDataMap,
	RunLedgerEntry,
	RunLedgerEntryKind,
} from "@shared/observability.ts";
import { emptyUsage } from "@shared/observability.ts";
import {
	foldCachePrefixBreaks,
	foldRunLedger,
	foldRunSteps,
	indexRequestSnapshots,
	snapshotKey,
	type LedgerStep,
} from "./run-timeline.ts";

let seq = 0;
function entry<K extends RunLedgerEntryKind>(
	at: number,
	kind: K,
	data: RunLedgerDataMap[K],
): RunLedgerEntry {
	seq += 1;
	// RunLedgerEntry<K> 可赋给默认泛型形态（kind/data 各自协变），
	// fold 入口的可判别窄化见 run-timeline.ts 的 LedgerEntryUnion。
	return { seq, at, kind, data };
}

describe("foldRunLedger（台账条目 → run 泳道）", () => {
	it("空条目流折出零个 run", () => {
		expect(foldRunLedger([])).toEqual([]);
	});

	it("一个完整 run：边界 / llm / 工具 / 重试 / 压缩各就其位，usage 合计", () => {
		const usage1 = { ...emptyUsage(), input: 100, output: 20, totalTokens: 120, cost: 0.01 };
		const usage2 = { ...emptyUsage(), input: 50, cacheRead: 200, output: 10, totalTokens: 260, cost: 0.02 };
		const runs = foldRunLedger([
			entry(1000, "run_start", { runId: "run-1", modelId: "p/m" }),
			entry(1100, "llm_call", {
				turnIndex: 0,
				startedAt: 1050,
				endedAt: 1100,
				ttftMs: 30,
				stopReason: "toolUse",
				usage: usage1,
			}),
			entry(1300, "tool_call", {
				toolCallId: "t1",
				toolName: "read",
				summary: "a.ts",
				startedAt: 1200,
				endedAt: 1300,
				outcome: "ok",
			}),
			entry(1400, "retry", { phase: "start", attempt: 2, maxAttempts: 3, delayMs: 3000, errorMessage: "boom" }),
			entry(1500, "compaction", { reason: "threshold", tokensBefore: 9000, aborted: false }),
			entry(1600, "llm_call", {
				turnIndex: 1,
				startedAt: 1550,
				endedAt: 1600,
				stopReason: "stop",
				usage: usage2,
			}),
			entry(1700, "run_end", { runId: "run-1", reason: "completed" }),
		]);

		expect(runs).toHaveLength(1);
		const run = runs[0]!;
		expect(run.runId).toBe("run-1");
		expect(run.modelId).toBe("p/m");
		expect(run.startedAt).toBe(1000);
		expect(run.endedAt).toBe(1700);
		expect(run.endReason).toBe("completed");
		expect(run.items.map((i) => i.kind)).toEqual([
			"llm",
			"tool",
			"retry",
			"compaction",
			"llm",
		]);
		expect(run.usage).toMatchObject({
			input: 150,
			output: 30,
			cacheRead: 200,
			totalTokens: 380,
			cost: 0.03,
		});
	});

	it("未闭合 run：endedAt/endReason 缺省（合成闭合补上前的中间态）", () => {
		const runs = foldRunLedger([
			entry(1000, "run_start", { runId: "run-1" }),
			entry(1100, "llm_call", { turnIndex: 0, startedAt: 1050, endedAt: 1100 }),
		]);
		expect(runs[0]?.endedAt).toBeUndefined();
		expect(runs[0]?.endReason).toBeUndefined();
	});

	it("中断合成闭合：run_end{reason:interrupted} 正常收口", () => {
		const runs = foldRunLedger([
			entry(1000, "run_start", { runId: "run-1" }),
			entry(9000, "run_end", { runId: "run-1", reason: "interrupted" }),
		]);
		expect(runs[0]?.endReason).toBe("interrupted");
	});

	it("run 外事件落合成桶不丢（手动压缩），runId 为空串", () => {
		const runs = foldRunLedger([
			entry(500, "compaction", { reason: "manual", tokensBefore: 100, aborted: false }),
			entry(1000, "run_start", { runId: "run-1" }),
			entry(1700, "run_end", { runId: "run-1", reason: "completed" }),
		]);
		expect(runs).toHaveLength(2);
		expect(runs[0]?.runId).toBe("");
		expect(runs[0]?.startedAt).toBe(500);
		expect(runs[0]?.items.map((i) => i.kind)).toEqual(["compaction"]);
	});

	it("多个 run 顺序折出；跨进程代际撞 runId 也按位置分开", () => {
		const runs = foldRunLedger([
			entry(1000, "run_start", { runId: "run-1" }),
			entry(1500, "run_end", { runId: "run-1", reason: "completed" }),
			// daemon 重启后新一轮又从 run-1 计数 —— 位置性归属不看 id。
			entry(2000, "run_start", { runId: "run-1" }),
			entry(2500, "run_end", { runId: "run-1", reason: "error", error: "模型报错" }),
		]);
		expect(runs).toHaveLength(2);
		expect(runs[1]?.startedAt).toBe(2000);
		expect(runs[1]?.endReason).toBe("error");
		expect(runs[1]?.error).toBe("模型报错");
	});

	it("没有 usage 的 llm_call 不造出零用量（「没上报」与「是零」两回事）", () => {
		const runs = foldRunLedger([
			entry(1000, "run_start", { runId: "run-1" }),
			entry(1100, "llm_call", { turnIndex: 0, startedAt: 1050, endedAt: 1100 }),
			entry(1200, "run_end", { runId: "run-1", reason: "completed" }),
		]);
		expect(runs[0]?.usage).toBeUndefined();
	});

	it("截尾后的孤儿 run_end（没有开着的 run）丢弃不炸", () => {
		const runs = foldRunLedger([
			entry(1700, "run_end", { runId: "run-1", reason: "completed" }),
		]);
		expect(runs).toEqual([]);
	});

	it("queue / request_snapshot 不进泳道行", () => {
		const runs = foldRunLedger([
			entry(1000, "run_start", { runId: "run-1" }),
			entry(1050, "queue", { steering: ["a"], followUp: [] }),
			entry(1060, "request_snapshot", {
				runId: "run-1",
				turnIndex: 0,
				messages: {
					user: { count: 1, chars: 10 },
					assistant: { count: 0, chars: 0 },
					toolResult: { count: 0, chars: 0 },
					other: { count: 0, chars: 0 },
				},
			}),
			entry(1200, "run_end", { runId: "run-1", reason: "completed" }),
		]);
		expect(runs[0]?.items).toEqual([]);
	});
});

describe("foldRunSteps（一轮 → 按步归组）", () => {
	/** 直接喂「一轮的条目」，省掉 run 边界那两行噪音。 */
	function stepsOf(entries: readonly RunLedgerEntry[]): readonly LedgerStep[] {
		return foldRunSteps(foldRunLedger(entries)[0]?.items ?? []);
	}

	it("空条目 → 零步", () => {
		expect(foldRunSteps([])).toEqual([]);
	});

	it("工具归入它前面那次模型调用（位置性归属，台账不记这个关系）", () => {
		const steps = stepsOf([
			entry(1000, "run_start", { runId: "run-1" }),
			entry(1100, "llm_call", { turnIndex: 0, startedAt: 1050, endedAt: 1100 }),
			entry(1200, "tool_call", {
				toolCallId: "t1",
				toolName: "read",
				summary: "a.ts",
				startedAt: 1150,
				endedAt: 1200,
				outcome: "ok",
			}),
			entry(1300, "tool_call", {
				toolCallId: "t2",
				toolName: "grep",
				summary: "b",
				startedAt: 1250,
				endedAt: 1300,
				outcome: "ok",
			}),
			entry(1400, "llm_call", { turnIndex: 1, startedAt: 1350, endedAt: 1400 }),
		]);
		expect(steps).toHaveLength(2);
		expect(steps[0]?.call?.turnIndex).toBe(0);
		expect(steps[0]?.rest.map((i) => (i.kind === "tool" ? i.data.toolCallId : i.kind))).toEqual([
			"t1",
			"t2",
		]);
		expect(steps[1]?.call?.turnIndex).toBe(1);
		expect(steps[1]?.rest).toEqual([]);
	});

	it("尾随工具归最后一步（最后一批工具后面没有下一次调用了）", () => {
		const steps = stepsOf([
			entry(1000, "run_start", { runId: "run-1" }),
			entry(1100, "llm_call", { turnIndex: 0, startedAt: 1050, endedAt: 1100 }),
			entry(1200, "tool_call", {
				toolCallId: "t1",
				toolName: "read",
				summary: "a.ts",
				startedAt: 1150,
				endedAt: 1200,
				outcome: "ok",
			}),
			entry(1300, "run_end", { runId: "run-1", reason: "completed" }),
		]);
		expect(steps).toHaveLength(1);
		expect(steps[0]?.rest).toHaveLength(1);
	});

	it("重试 / 压缩跟着当前步走，不挪到轮级（否则先后顺序会乱）", () => {
		const steps = stepsOf([
			entry(1000, "run_start", { runId: "run-1" }),
			entry(1100, "llm_call", { turnIndex: 0, startedAt: 1050, endedAt: 1100 }),
			entry(1150, "retry", { phase: "start", attempt: 2, delayMs: 3000 }),
			entry(1200, "compaction", { reason: "threshold", tokensBefore: 9000, aborted: false }),
			entry(1300, "llm_call", { turnIndex: 1, startedAt: 1250, endedAt: 1300 }),
		]);
		expect(steps.map((s) => s.call?.turnIndex)).toEqual([0, 1]);
		expect(steps[0]?.rest.map((i) => i.kind)).toEqual(["retry", "compaction"]);
		expect(steps[1]?.rest).toEqual([]);
	});

	it("首个 llm 之前的工具（台账截尾）→ 无主前导组，不编造归属", () => {
		const steps = stepsOf([
			entry(1000, "run_start", { runId: "run-1" }),
			entry(1100, "tool_call", {
				toolCallId: "t1",
				toolName: "read",
				summary: "a.ts",
				startedAt: 1050,
				endedAt: 1100,
				outcome: "ok",
			}),
			entry(1200, "tool_call", {
				toolCallId: "t2",
				toolName: "grep",
				summary: "b",
				startedAt: 1150,
				endedAt: 1200,
				outcome: "error",
			}),
			entry(1300, "llm_call", { turnIndex: 0, startedAt: 1250, endedAt: 1300 }),
		]);
		expect(steps).toHaveLength(2);
		expect(steps[0]?.call).toBeUndefined();
		// 连续的无主条目合成一组，不是一条一组。
		expect(steps[0]?.rest).toHaveLength(2);
		expect(steps[1]?.call?.turnIndex).toBe(0);
	});
});

describe("indexRequestSnapshots（快照检索）", () => {
	it("按 runId+turnIndex 建索引，缺省段落落空串", () => {
		expect(snapshotKey("run-1", 2)).toBe("run-1#2");
		expect(snapshotKey(undefined, undefined)).toBe("#");

		const snap = {
			runId: "run-1",
			turnIndex: 0,
			systemSegments: [{ source: "skeleton", chars: 100 }],
			messages: {
				user: { count: 1, chars: 10 },
				assistant: { count: 2, chars: 200 },
				toolResult: { count: 3, chars: 3000 },
				other: { count: 0, chars: 0 },
			},
		} as const;
		const map = indexRequestSnapshots([
			entry(1000, "request_snapshot", snap),
			entry(1001, "llm_call", { turnIndex: 0, startedAt: 900, endedAt: 1001 }),
		]);
		expect(map.get(snapshotKey("run-1", 0))).toEqual(snap);
		expect(map.get(snapshotKey("run-1", 1))).toBeUndefined();
	});

	it("同键后者覆盖前者（同轮重发的快照以最新为准）", () => {
		const base = {
			runId: "run-1",
			turnIndex: 0,
			messages: {
				user: { count: 1, chars: 10 },
				assistant: { count: 0, chars: 0 },
				toolResult: { count: 0, chars: 0 },
				other: { count: 0, chars: 0 },
			},
		};
		const map = indexRequestSnapshots([
			entry(1000, "request_snapshot", base),
			entry(2000, "request_snapshot", { ...base, systemSegments: [{ source: "skills", chars: 5 }] }),
		]);
		expect(map.get(snapshotKey("run-1", 0))?.systemSegments).toEqual([
			{ source: "skills", chars: 5 },
		]);
	});
});

describe("foldCachePrefixBreaks（相邻两轮的缓存断点，CACHE6）", () => {
	const NO_MESSAGES = {
		user: { count: 0, chars: 0 },
		assistant: { count: 0, chars: 0 },
		toolResult: { count: 0, chars: 0 },
		other: { count: 0, chars: 0 },
	};
	const ref = (id: string, tokens: number, fp = 1) => ({
		id,
		role: "user" as const,
		chars: tokens * 4,
		tokens,
		fp,
	});

	it("相邻两轮配对：cacheRead 从本轮的 llm_call 取、上一轮 prompt 总量给它定标", () => {
		const breaks = foldCachePrefixBreaks([
			entry(1000, "request_snapshot", {
				runId: "run-1",
				turnIndex: 0,
				messages: NO_MESSAGES,
				messageList: [ref("A", 100), ref("B", 100)],
			}),
			// 第一轮真实 prompt 总量 = input 700 + cacheRead 100 = 800 → 前缀 600。
			entry(1010, "llm_call", {
				runId: "run-1",
				turnIndex: 0,
				startedAt: 900,
				endedAt: 1010,
				usage: { ...emptyUsage(), input: 700, cacheRead: 100 },
			}),
			entry(2000, "request_snapshot", {
				runId: "run-1",
				turnIndex: 1,
				messages: NO_MESSAGES,
				messageList: [ref("A", 100), ref("B", 100), ref("C", 100)],
			}),
			entry(2010, "llm_call", {
				runId: "run-1",
				turnIndex: 1,
				startedAt: 1900,
				endedAt: 2010,
				usage: { ...emptyUsage(), input: 200, cacheRead: 850 },
			}),
		]);

		// 第二轮：前缀 600 + A + B = 800 ≤ 850，再加 C(100) 就超了 → 断在 C（新增）。
		expect(breaks.get(snapshotKey("run-1", 1))).toMatchObject({
			kind: "message",
			hitCount: 2,
			change: "appended",
		});
		// 第一轮没有可比对的上一轮：只能给边界，变化原因如实 unknown。
		expect(breaks.get(snapshotKey("run-1", 0))).toMatchObject({
			kind: "message",
			hitCount: 1,
			change: "unknown",
		});
	});

	it("旧台账没有逐条明细（messageList 缺席）→ 如实返回不确定", () => {
		const breaks = foldCachePrefixBreaks([
			entry(1000, "request_snapshot", {
				runId: "run-1",
				turnIndex: 0,
				messages: NO_MESSAGES,
			}),
			entry(1010, "llm_call", {
				runId: "run-1",
				turnIndex: 0,
				startedAt: 900,
				endedAt: 1010,
				usage: { ...emptyUsage(), cacheRead: 100 },
			}),
		]);

		expect(breaks.get(snapshotKey("run-1", 0))?.kind).toBe("unknown");
	});
});
