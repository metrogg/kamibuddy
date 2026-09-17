/**
 * 可观测性聚合器的行为测试。
 *
 * 这是诊断页唯一的数据源，聚合错了 UI 上每个数字都是错的，
 * 而且错得「看起来很像真的」——所以 run 生命周期、用量累计、
 * 工具统计、错误去重这几条路径都要有测试压着。
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CACHE_TTL_MS, estimateComposition, estimateTokens, ObservabilityStore } from "./observability.ts";
import { RunLedger } from "./run-ledger.ts";
import type { LlmCallData, TokenUsage } from "../shared/observability.ts";
import { averageTtftMs, decodeTokensPerSecond } from "../shared/observability.ts";
import type { AssistantMessage, SessionEvent, ToolCard } from "../shared/session-events.ts";

function usage(input: number, cacheRead: number): TokenUsage {
	return { input, output: 10, cacheRead, cacheWrite: 0, totalTokens: input + cacheRead + 10, cost: 0.001 };
}

function assistant(id: string, u?: TokenUsage): AssistantMessage {
	return { id, role: "assistant", text: "回复", at: 1000, ...(u === undefined ? {} : { usage: u }) };
}

function toolCard(id: string, name: string, outcome: ToolCard["outcome"] = undefined, at = 1000): ToolCard {
	return { id, role: "tool", toolName: name, label: "读取文件", summary: "a.ts", outcome, detail: undefined, at };
}

function stateEvent(): SessionEvent {
	return {
		type: "session_state",
		state: {
			sessionId: "s1",
			cwd: "/w",
			isTempTask: false,
			sceneId: "work",
			interactionId: "craft",
			modelId: "deepseek/chat",
			isStreaming: true,
		},
	};
}

describe("run 生命周期", () => {
	it("run_started 时快照 run 开始时的模型与两轴，run_finished 回填终态", () => {
		let now = 1000;
		const store = new ObservabilityStore(() => now);
		store.record("s1", stateEvent());
		store.record("s1", { type: "run_started", runId: "run-1" });
		now = 4500;
		store.record("s1", { type: "run_finished", runId: "run-1", outcome: "completed" });

		const snap = store.snapshot({ entries: [], systemPromptTokens: 0, contextUsage: undefined, logDir: "/l" });
		expect(snap.totalRuns).toBe(1);
		expect(snap.runs[0]).toMatchObject({
			runId: "run-1",
			status: "ok",
			modelId: "deepseek/chat",
			sceneId: "work",
			interactionId: "craft",
			startedAt: 1000,
			endedAt: 4500,
		});
	});

	it("run_error 后紧跟的 run_finished 不会覆盖 error 状态，且只计一次错误", () => {
		const store = new ObservabilityStore(() => 1000);
		store.record("s1", { type: "run_started", runId: "run-1" });
		store.record("s1", { type: "run_error", runId: "run-1", message: "上下文超限" });
		store.record("s1", { type: "run_finished", runId: "run-1", outcome: "completed" });

		const snap = store.snapshot({ entries: [], systemPromptTokens: 0, contextUsage: undefined, logDir: "/l" });
		expect(snap.totalErrors).toBe(1);
		expect(snap.runs[0]).toMatchObject({ status: "error", error: "上下文超限" });
	});
});

describe("用量聚合", () => {
	it("run 内多条助手消息的用量合计进 run 与全进程累计", () => {
		const store = new ObservabilityStore(() => 1000);
		store.record("s1", { type: "run_started", runId: "run-1" });
		store.record("s1", { type: "assistant_done", message: assistant("a1", usage(100, 900)) });
		store.record("s1", { type: "assistant_done", message: assistant("a2", usage(200, 800)) });
		store.record("s1", { type: "run_finished", runId: "run-1", outcome: "completed" });

		const snap = store.snapshot({ entries: [], systemPromptTokens: 0, contextUsage: undefined, logDir: "/l" });
		expect(snap.totalUsage.input).toBe(300);
		expect(snap.totalUsage.cacheRead).toBe(1700);
		expect(snap.runs[0]?.usage?.input).toBe(300);
	});

	it("新建任务（新 run）不清累计", () => {
		const store = new ObservabilityStore(() => 1000);
		store.record("s1", { type: "run_started", runId: "run-1" });
		store.record("s1", { type: "assistant_done", message: assistant("a1", usage(100, 0)) });
		store.record("s1", { type: "run_finished", runId: "run-1", outcome: "completed" });
		store.record("s1", { type: "run_started", runId: "run-2" });
		store.record("s1", { type: "assistant_done", message: assistant("a2", usage(50, 0)) });
		store.record("s1", { type: "run_finished", runId: "run-2", outcome: "completed" });

		const snap = store.snapshot({ entries: [], systemPromptTokens: 0, contextUsage: undefined, logDir: "/l" });
		expect(snap.totalRuns).toBe(2);
		expect(snap.totalUsage.input).toBe(150);
	});
});

describe("工具统计", () => {
	it("统计调用次数、失败数与平均耗时", () => {
		let now = 1000;
		const store = new ObservabilityStore(() => now);
		store.record("s1", { type: "run_started", runId: "run-1" });
		store.record("s1", { type: "tool_started", card: toolCard("t1", "read") });
		now = 1300;
		store.record("s1", { type: "tool_finished", card: toolCard("t1", "read", "ok") });
		store.record("s1", { type: "tool_started", card: toolCard("t2", "read", undefined, 1300) });
		now = 1800;
		store.record("s1", { type: "tool_finished", card: toolCard("t2", "read", "error") });
		store.record("s1", { type: "run_finished", runId: "run-1", outcome: "completed" });

		const snap = store.snapshot({ entries: [], systemPromptTokens: 0, contextUsage: undefined, logDir: "/l" });
		expect(snap.tools).toHaveLength(1);
		expect(snap.tools[0]).toMatchObject({ toolName: "read", calls: 2, errors: 1, avgMs: 400 });
		expect(snap.runs[0]).toMatchObject({ toolCalls: 2, toolErrors: 1 });
	});

	it("时间线跨度记录开始/结束/结果，供诊断页画泳道", () => {
		let now = 1000;
		const store = new ObservabilityStore(() => now);
		store.record("s1", { type: "run_started", runId: "run-1" });
		store.record("s1", { type: "tool_started", card: toolCard("t1", "read") });
		now = 1300;
		store.record("s1", { type: "tool_finished", card: toolCard("t1", "read", "error") });
		store.record("s1", { type: "run_finished", runId: "run-1", outcome: "completed" });

		const snap = store.snapshot({ entries: [], systemPromptTokens: 0, contextUsage: undefined, logDir: "/l" });
		expect(snap.runs[0]?.toolSpans).toEqual([
			{ toolName: "read", label: "读取文件", summary: "a.ts", startedAt: 1000, endedAt: 1300, outcome: "error" },
		]);
	});
});

describe("成分估算", () => {
	it("estimateTokens 区分 CJK 与西文", () => {
		// 4 个 CJK 字符 ≈ 4 token；8 个西文字符 ≈ 2 token。
		expect(estimateTokens("你好世界abcdefgh")).toBe(6);
	});

	it("按角色拆分上下文成分", () => {
		const composition = estimateComposition(
			[
				{ id: "u1", role: "user", text: "你好", at: 1 },
				{ id: "a1", role: "assistant", text: "你好", thinking: "想想", at: 2 },
				toolCard("t1", "read", "ok"),
			],
			100,
		);
		expect(composition).toEqual({ system: 100, user: 2, assistant: 2, thinking: 2, tools: 2 });
	});

	it("空会话返回 undefined（诊断页据此显示占位）", () => {
		expect(estimateComposition([], 0)).toBeUndefined();
	});
});

/* ── 台账 fold 投影（Task 3）────────────────────────────────────── */

function snapshotOf(store: ObservabilityStore) {
	return store.snapshot({ entries: [], systemPromptTokens: 0, contextUsage: undefined, logDir: "/l" });
}

/** 建一个测试用台账目录（每次用例独立，避免互相回放）。 */
function ledgerDir(): string {
	return mkdtempSync(join(tmpdir(), "observability-test-"));
}

function llmCall(
	turnIndex: number,
	startedAt: number,
	endedAt: number,
	u?: TokenUsage,
	ttftMs?: number,
): LlmCallData {
	return {
		turnIndex,
		startedAt,
		endedAt,
		...(u === undefined ? {} : { usage: u }),
		...(ttftMs === undefined ? {} : { ttftMs }),
	};
}

/** 带缓存活动的 usage：prompt 侧 input + cacheRead + cacheWrite。 */
function promptUsage(input: number, cacheRead: number, cacheWrite: number): TokenUsage {
	return {
		input,
		output: 10,
		cacheRead,
		cacheWrite,
		totalTokens: input + cacheRead + cacheWrite + 10,
		cost: 0.001,
	};
}

describe("启动回放（重启不清零）", () => {
	it("回放台账重建 run 卡片 / 进程累计 / 工具统计 / 会话级统计", () => {
		const dir = ledgerDir();
		let at = 10_000;
		const ledger = new RunLedger(dir, "s1", () => { }, () => at);
		ledger.append("run_start", { runId: "run-1", modelId: "deepseek/chat" });
		ledger.append("llm_call", llmCall(0, at, at + 800, promptUsage(100, 900, 0)));
		ledger.append("tool_call", {
			toolCallId: "t1",
			toolName: "read",
			summary: "a.ts",
			startedAt: at,
			endedAt: at + 300,
			outcome: "ok",
		});
		at += 1000;
		ledger.append("run_end", { runId: "run-1", reason: "completed" });

		const store = new ObservabilityStore(() => 1_000_000);
		store.replayLedgerDir(dir, () => { });
		const snap = snapshotOf(store);

		expect(snap.totalRuns).toBe(1);
		expect(snap.totalUsage.input).toBe(100);
		expect(snap.totalUsage.cacheRead).toBe(900);
		expect(snap.runs[0]).toMatchObject({
			runId: "run-1",
			sessionId: "s1",
			status: "ok",
			modelId: "deepseek/chat",
			toolCalls: 1,
		});
		// 台账 ToolCallData 无 label，回放泳道标签回退工具名。
		expect(snap.runs[0]?.toolSpans[0]).toMatchObject({ toolName: "read", label: "read" });
		expect(snap.tools[0]).toMatchObject({ toolName: "read", calls: 1, avgMs: 300 });
		expect(snap.sessions[0]).toMatchObject({
			sessionId: "s1",
			runs: 1,
			turns: 1,
			llmMs: 800,
			toolMs: 300,
			cacheHitRate: 0.9,
		});
		expect(snap.sessions[0]?.usage.input).toBe(100);
	});

	it("中断的 run（合成闭合）卡片标 error 但不计入 totalErrors", () => {
		const dir = ledgerDir();
		const at = 10_000;
		new RunLedger(dir, "s1", () => { }, () => at).append("run_start", { runId: "run-1" });
		// 重开触发孤儿合成闭合（reason: interrupted）。
		new RunLedger(dir, "s1", () => { }, () => at + 5000);

		const store = new ObservabilityStore(() => 1_000_000);
		store.replayLedgerDir(dir, () => { });
		const snap = snapshotOf(store);

		expect(snap.runs[0]).toMatchObject({ status: "error", error: "进程中断，台账合成闭合" });
		expect(snap.totalErrors).toBe(0);
		expect(snap.totalRuns).toBe(1);
	});

	it("超出全局时间窗（30 天）的历史 run 只进计数器、不出卡片", () => {
		const dir = ledgerDir();
		const now = 1_000_000_000_000;
		const old = now - 31 * 24 * 60 * 60 * 1000;
		const ledger = new RunLedger(dir, "s1", () => { }, () => old);
		ledger.append("run_start", { runId: "run-1" });
		ledger.append("run_end", { runId: "run-1", reason: "completed" });

		const store = new ObservabilityStore(() => now);
		store.replayLedgerDir(dir, () => { });
		const snap = snapshotOf(store);

		expect(snap.totalRuns).toBe(1);
		expect(snap.runs).toHaveLength(0);
		// 会话级统计是全历史口径，不受卡片窗口影响。
		expect(snap.sessions[0]?.runs).toBe(1);
	});

	it("每会话 run 卡片按条数窗口截尾，计数器不受影响", () => {
		let now = 1000;
		const store = new ObservabilityStore(() => now);
		for (let i = 1; i <= 25; i += 1) {
			store.record("s1", { type: "run_started", runId: `run-${i}` });
			now += 100;
			store.record("s1", { type: "run_finished", runId: `run-${i}`, outcome: "completed" });
		}
		const snap = snapshotOf(store);
		expect(snap.totalRuns).toBe(25);
		expect(snap.runs).toHaveLength(20);
		expect(snap.runs[0]?.runId).toBe("run-25");
	});
});

describe("细分字段聚合（reasoning / cacheWrite1h / costBreakdown）", () => {
	it("有上报就累计，从未上报的字段键缺席", () => {
		const store = new ObservabilityStore(() => 1000);
		store.record("s1", { type: "run_started", runId: "run-1" });
		store.record("s1", {
			type: "assistant_done",
			message: assistant("a1", {
				...usage(100, 0),
				reasoning: 5,
				costBreakdown: { input: 0.0005, output: 0.0004, cacheRead: 0, cacheWrite: 0.0001 },
			}),
		});
		store.record("s1", { type: "assistant_done", message: assistant("a2", usage(50, 0)) });
		store.record("s1", { type: "run_finished", runId: "run-1", outcome: "completed" });

		const snap = snapshotOf(store);
		// 只有 a1 上报了细分：累计值就是它（没上报的 a2 不补零稀释）。
		expect(snap.totalUsage.reasoning).toBe(5);
		expect(snap.totalUsage.costBreakdown).toEqual({
			input: 0.0005,
			output: 0.0004,
			cacheRead: 0,
			cacheWrite: 0.0001,
		});
		expect(snap.totalUsage.cacheWrite1h).toBeUndefined();
		// run 卡片上的 usage 同口径。
		expect(snap.runs[0]?.usage?.reasoning).toBe(5);
	});
});

describe("增量 fold（台账条目到账即投影）", () => {
	it("foldLedgerEntry 累计会话级统计，不碰 run 卡片与进程累计（防双计）", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		store.foldLedgerEntry("s1", { seq: 1, at: 100, kind: "run_start", data: { runId: "run-1" } });
		store.foldLedgerEntry("s1", {
			seq: 2,
			at: 200,
			kind: "llm_call",
			data: llmCall(0, 200, 700, promptUsage(100, 0, 0)),
		});
		store.foldLedgerEntry("s1", {
			seq: 3,
			at: 800,
			kind: "tool_call",
			data: { toolCallId: "t1", toolName: "read", summary: "a.ts", startedAt: 800, endedAt: 900, outcome: "ok" },
		});

		const snap = snapshotOf(store);
		expect(snap.sessions[0]).toMatchObject({ runs: 1, turns: 1, llmMs: 500, toolMs: 100, lastActiveAt: 800 });
		expect(snap.sessions[0]?.usage.input).toBe(100);
		// run 卡片与进程累计是 record() 的职责，fold 不动它们。
		expect(snap.runs).toHaveLength(0);
		expect(snap.totalUsage.input).toBe(0);
	});

	it("RunLedger onAppended 钩子端到端：写盘成功即进投影", () => {
		const dir = ledgerDir();
		const store = new ObservabilityStore(() => 1_000_000);
		const ledger = new RunLedger(dir, "s9", () => { }, () => 5000, (entry) =>
			store.foldLedgerEntry("s9", entry),
		);
		ledger.append("run_start", { runId: "run-1" });
		ledger.append("llm_call", llmCall(0, 5000, 5600, promptUsage(42, 0, 0)));

		const snap = snapshotOf(store);
		expect(snap.sessions[0]).toMatchObject({ sessionId: "s9", runs: 1, turns: 1, llmMs: 600 });
		expect(snap.sessions[0]?.usage.input).toBe(42);
	});
});

describe("首字延迟与解码速度（会话级，对齐 dsh sessionStats）", () => {
	/** fold 一组 llm_call（前面补一条 run_start，模拟一轮里的多步）。 */
	function foldCalls(store: ObservabilityStore, calls: readonly LlmCallData[]): void {
		store.foldLedgerEntry("s1", { seq: 1, at: 1000, kind: "run_start", data: { runId: "run-1" } });
		calls.forEach((data, i) => {
			store.foldLedgerEntry("s1", { seq: i + 2, at: data.endedAt, kind: "llm_call", data });
		});
	}

	it("按调用累加首字延迟并计数；缺 ttftMs 的调用不进平均", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		foldCalls(store, [
			llmCall(0, 1000, 2000, promptUsage(10, 0, 0), 400),
			llmCall(1, 2000, 3000, promptUsage(10, 0, 0), 600),
			llmCall(2, 3000, 4000, promptUsage(10, 0, 0)),
		]);

		const card = snapshotOf(store).sessions[0];
		if (card === undefined) throw new Error("会话卡缺失");
		expect(card).toMatchObject({ ttftMs: 1000, ttftCalls: 2 });
		expect(averageTtftMs(card)).toBe(500);
	});

	it("解码窗口 = 总耗时 − 首字延迟，token 取该次调用的 output", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		// 全程 2000ms，首字 500ms → 解码 1500ms；promptUsage 的 output 固定 10。
		foldCalls(store, [llmCall(0, 1000, 3000, promptUsage(10, 0, 0), 500)]);

		const card = snapshotOf(store).sessions[0];
		if (card === undefined) throw new Error("会话卡缺失");
		expect(card).toMatchObject({ decodeMs: 1500, decodeTokens: 10 });
		expect(decodeTokensPerSecond(card)).toBeCloseTo(10 / 1.5, 10);
	});

	it("缺 usage 的调用仍计首字延迟，但不进解码（TTFT 不依赖用量上报）", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		foldCalls(store, [llmCall(0, 1000, 2000, undefined, 300)]);

		expect(snapshotOf(store).sessions[0]).toMatchObject({
			ttftMs: 300,
			ttftCalls: 1,
			decodeMs: 0,
			decodeTokens: 0,
		});
	});

	it("会话卡的命中率含 cacheWrite（三桶之和作分母）", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		foldCalls(store, [llmCall(0, 1000, 2000, promptUsage(100, 900, 200), 100)]);

		// 900 / (100 + 900 + 200) = 0.75；旧口径（漏 cacheWrite）会算成 0.9。
		expect(snapshotOf(store).sessions[0]?.cacheHitRate).toBeCloseTo(0.75, 10);
	});

	it("provider 从未上报过缓存活动 → 命中率留空（不是 0%），并标记 cacheReported=false", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		// 无缓存能力的服务商：pi 把 cacheRead/cacheWrite 一律填 0，直接算就是
		// 误导性的「命中 0%」（2026-09-17 修正）。
		foldCalls(store, [llmCall(0, 1000, 2000, promptUsage(5000, 0, 0), 100)]);

		expect(snapshotOf(store).sessions[0]).toMatchObject({
			cacheReported: false,
			cacheHitRate: undefined,
		});
	});

	it("cacheWrite 也算缓存活动的证据：写缓存但本轮没命中 → 0%，不是留空", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		foldCalls(store, [llmCall(0, 1000, 2000, promptUsage(100, 0, 500), 100)]);

		expect(snapshotOf(store).sessions[0]).toMatchObject({
			cacheReported: true,
			cacheHitRate: 0,
		});
	});

	it("没跑过台账的会话，sessionCard 返回 undefined（调用方据此不推）", () => {
		const store = new ObservabilityStore(() => 1000);
		expect(store.sessionCard("nope")).toBeUndefined();
	});
});

describe("缓存浪费归因（pi cache-stats 口径）", () => {
	/** fold 一对相邻调用：第一次带 cacheWrite（建立 reportedCache），第二次零缓存。 */
	function foldPair(
		store: ObservabilityStore,
		gapMs: number,
		opts: { model2?: string; usage2?: TokenUsage } = {},
	): void {
		store.foldLedgerEntry("s1", { seq: 1, at: 1000, kind: "run_start", data: { runId: "run-1", modelId: "a/m1" } });
		store.foldLedgerEntry("s1", {
			seq: 2,
			at: 1000,
			kind: "llm_call",
			data: llmCall(0, 1000, 2000, promptUsage(100, 0, 5000)),
		});
		store.foldLedgerEntry("s1", { seq: 3, at: 2000, kind: "run_end", data: { runId: "run-1", reason: "completed" } });
		const start2 = 2000 + gapMs;
		store.foldLedgerEntry("s1", {
			seq: 4,
			at: start2,
			kind: "run_start",
			data: { runId: "run-2", ...(opts.model2 === undefined ? { modelId: "a/m1" } : { modelId: opts.model2 }) },
		});
		store.foldLedgerEntry("s1", {
			seq: 5,
			at: start2,
			kind: "llm_call",
			data: llmCall(0, start2, start2 + 1000, opts.usage2 ?? promptUsage(5100, 0, 0)),
		});
	}

	it("相邻调用间隔超过 5 分钟 TTL 的零缓存轮计为 idle_ttl miss", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		foldPair(store, CACHE_TTL_MS + 60_000);

		const snap = snapshotOf(store);
		expect(snap.cacheWaste.missCount).toBe(1);
		expect(snap.cacheWaste.missedTokens).toBe(5100);
		expect(snap.cacheWaste.misses[0]).toMatchObject({
			sessionId: "s1",
			missedTokens: 5100,
			idleMs: CACHE_TTL_MS + 60_000,
			reason: "idle_ttl",
		});
	});

	it("间隔小于 TTL 但换模的零缓存轮计为 model_change miss", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		foldPair(store, 60_000, { model2: "a/m2" });

		const snap = snapshotOf(store);
		expect(snap.cacheWaste.missCount).toBe(1);
		expect(snap.cacheWaste.misses[0]?.reason).toBe("model_change");
	});

	it("压缩后上下文合法变化，重置对比基线不计 miss", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		foldPair(store, CACHE_TTL_MS + 60_000);
		// 第二次调用已建立新基线；压缩后又一次零缓存轮 —— 基线已清，不计。
		store.foldLedgerEntry("s1", { seq: 6, at: 400_000, kind: "compaction", data: { reason: "threshold", aborted: false } });
		store.foldLedgerEntry("s1", {
			seq: 7,
			at: 400_000,
			kind: "run_start",
			data: { runId: "run-3", modelId: "a/m1" },
		});
		store.foldLedgerEntry("s1", {
			seq: 8,
			at: 400_000,
			kind: "llm_call",
			data: llmCall(0, 400_000, 401_000, promptUsage(5100, 0, 0)),
		});

		expect(snapshotOf(store).cacheWaste.missCount).toBe(1);
	});

	it("低于噪声底线（1024 token）的 miss 不计入", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		// 第二次大部分命中（cacheRead 4500），missed = 600 < 1024。
		foldPair(store, 60_000, { usage2: promptUsage(600, 4500, 0) });
		expect(snapshotOf(store).cacheWaste.missCount).toBe(0);
	});

	it("服务商从未上报缓存活动时，零缓存轮不计 miss", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		// 第一次也是零缓存（cacheWrite 0）→ reportedCache 不成立。
		store.foldLedgerEntry("s1", { seq: 1, at: 1000, kind: "run_start", data: { runId: "run-1", modelId: "a/m1" } });
		store.foldLedgerEntry("s1", {
			seq: 2,
			at: 1000,
			kind: "llm_call",
			data: llmCall(0, 1000, 2000, promptUsage(5000, 0, 0)),
		});
		store.foldLedgerEntry("s1", {
			seq: 3,
			at: 400_000,
			kind: "llm_call",
			data: llmCall(1, 400_000, 401_000, promptUsage(5100, 0, 0)),
		});
		expect(snapshotOf(store).cacheWaste.missCount).toBe(0);
	});

	it("missedCost 按实付价与缓存读价的差计算；无 costBreakdown 为 0", () => {
		const store = new ObservabilityStore(() => 1_000_000);
		const usage2: TokenUsage = {
			...promptUsage(5100, 0, 0),
			costBreakdown: { input: 0.051, output: 0, cacheRead: 0, cacheWrite: 0 },
		};
		foldPair(store, 60_000, { usage2 });
		// 5100 missed × (0.051/5100 − 0) = 0.051。
		expect(snapshotOf(store).cacheWaste.misses[0]?.missedCost).toBeCloseTo(0.051, 6);

		const noPricing = new ObservabilityStore(() => 1_000_000);
		foldPair(noPricing, 60_000);
		expect(snapshotOf(noPricing).cacheWaste.misses[0]?.missedCost).toBe(0);
	});
});
