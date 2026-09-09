/**
 * 可观测性聚合器的行为测试。
 *
 * 这是诊断页唯一的数据源，聚合错了 UI 上每个数字都是错的，
 * 而且错得「看起来很像真的」——所以 run 生命周期、用量累计、
 * 工具统计、错误去重这几条路径都要有测试压着。
 */

import { describe, expect, it } from "vitest";
import { estimateComposition, estimateTokens, ObservabilityStore } from "./observability.ts";
import type { TokenUsage } from "../shared/observability.ts";
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
		store.record(stateEvent());
		store.record({ type: "run_started", runId: "run-1" });
		now = 4500;
		store.record({ type: "run_finished", runId: "run-1", outcome: "completed" });

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
		store.record({ type: "run_started", runId: "run-1" });
		store.record({ type: "run_error", runId: "run-1", message: "上下文超限" });
		store.record({ type: "run_finished", runId: "run-1", outcome: "completed" });

		const snap = store.snapshot({ entries: [], systemPromptTokens: 0, contextUsage: undefined, logDir: "/l" });
		expect(snap.totalErrors).toBe(1);
		expect(snap.runs[0]).toMatchObject({ status: "error", error: "上下文超限" });
	});
});

describe("用量聚合", () => {
	it("run 内多条助手消息的用量合计进 run 与全进程累计", () => {
		const store = new ObservabilityStore(() => 1000);
		store.record({ type: "run_started", runId: "run-1" });
		store.record({ type: "assistant_done", message: assistant("a1", usage(100, 900)) });
		store.record({ type: "assistant_done", message: assistant("a2", usage(200, 800)) });
		store.record({ type: "run_finished", runId: "run-1", outcome: "completed" });

		const snap = store.snapshot({ entries: [], systemPromptTokens: 0, contextUsage: undefined, logDir: "/l" });
		expect(snap.totalUsage.input).toBe(300);
		expect(snap.totalUsage.cacheRead).toBe(1700);
		expect(snap.runs[0]?.usage?.input).toBe(300);
	});

	it("新建任务（新 run）不清累计", () => {
		const store = new ObservabilityStore(() => 1000);
		store.record({ type: "run_started", runId: "run-1" });
		store.record({ type: "assistant_done", message: assistant("a1", usage(100, 0)) });
		store.record({ type: "run_finished", runId: "run-1", outcome: "completed" });
		store.record({ type: "run_started", runId: "run-2" });
		store.record({ type: "assistant_done", message: assistant("a2", usage(50, 0)) });
		store.record({ type: "run_finished", runId: "run-2", outcome: "completed" });

		const snap = store.snapshot({ entries: [], systemPromptTokens: 0, contextUsage: undefined, logDir: "/l" });
		expect(snap.totalRuns).toBe(2);
		expect(snap.totalUsage.input).toBe(150);
	});
});

describe("工具统计", () => {
	it("统计调用次数、失败数与平均耗时", () => {
		let now = 1000;
		const store = new ObservabilityStore(() => now);
		store.record({ type: "run_started", runId: "run-1" });
		store.record({ type: "tool_started", card: toolCard("t1", "read") });
		now = 1300;
		store.record({ type: "tool_finished", card: toolCard("t1", "read", "ok") });
		store.record({ type: "tool_started", card: toolCard("t2", "read", undefined, 1300) });
		now = 1800;
		store.record({ type: "tool_finished", card: toolCard("t2", "read", "error") });
		store.record({ type: "run_finished", runId: "run-1", outcome: "completed" });

		const snap = store.snapshot({ entries: [], systemPromptTokens: 0, contextUsage: undefined, logDir: "/l" });
		expect(snap.tools).toHaveLength(1);
		expect(snap.tools[0]).toMatchObject({ toolName: "read", calls: 2, errors: 1, avgMs: 400 });
		expect(snap.runs[0]).toMatchObject({ toolCalls: 2, toolErrors: 1 });
	});

	it("时间线跨度记录开始/结束/结果，供诊断页画泳道", () => {
		let now = 1000;
		const store = new ObservabilityStore(() => now);
		store.record({ type: "run_started", runId: "run-1" });
		store.record({ type: "tool_started", card: toolCard("t1", "read") });
		now = 1300;
		store.record({ type: "tool_finished", card: toolCard("t1", "read", "error") });
		store.record({ type: "run_finished", runId: "run-1", outcome: "completed" });

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
