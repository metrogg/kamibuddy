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
 *   6. 跨宿主代际（id 撞名）下页脚 = 台账按 run 聚合 —— 见「多步轮 / 工具调用 /
 *      宿主重建」那组的说明：这条缺陷出在 reducer 的折叠上，折叠修好页脚才作数
 *   7. **run 边界**（2026-09-17）：steer 落在 run 中间不切边界、空闲压缩不移动
 *      窗口 —— 见文件末尾两组；两者都钉「页脚 = 台账按 run 聚合」
 */

import { describe, expect, it } from "vitest";
import {
	conversationReducer,
	currentRunStartIndex,
	initialConversation,
	type ConversationView,
} from "@shared/conversation.ts";
import type {
	AssistantMessage,
	ConversationEntry,
	SessionEvent,
	ToolCard,
	UserMessage,
} from "@shared/session-events.ts";
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

/*
 * 回归门禁（2026-09-17）：**多步轮 + 工具调用 + 非 usage 条目 + 宿主重建**下，
 * 页脚读数必须等于「台账按 run 聚合的 Σbilled」。
 *
 * 为什么必须走真实 reducer 而不是手搓 entries：这条缺陷出在**折叠**上，不在求和上
 * —— 消息 id 是宿主进程内自增计数器的产物（core/session-host.ts 的 idSeq），
 * daemon 重启 / resume remount 会重建宿主、计数器从 1 重来，同一串
 * `assistant-3` 因此对应多条真实不同的消息。此前 reducer 的 `assistant_done`
 * 按「同 id 第一条」写入，于是新一代的 usage 被盖进上一代的老条目 —— 老条目的
 * 位置属于更早的轮，页脚的本轮读数既少算（本轮条目被空壳占住）又多算
 * （更早轮的窗口里冒出别轮的 usage）。手搓 entries 只能复现「求和」那一半，
 * 复现不了「usage 被搬到别的轮」这一半。
 *
 * 真值口径：台账每个 `message_end` 写一条 llm_call（core/run-ledger.ts），
 * 与这里的 `assistant_done` 一一对应 —— 所以「台账按 run 聚合」= 同一批
 * assistant_done 的 usage 按 run 求和（不是另一套算法，同一份事件源）。
 */
describe("多步轮 / 工具调用 / 宿主重建：页脚 = 台账按 run 聚合", () => {
	/** 三桶齐全（此处直接相加，不像 foldTurnMetrics 那样对缺字段做缺席处理）。 */
	function billed(u: TokenUsage): number {
		return u.input + u.cacheRead + u.cacheWrite;
	}

	/** 第 1 代宿主的轮（单步，无工具）。 */
	const RUN1 = usage({ input: 8_449, output: 580, cacheRead: 3_456, cacheWrite: 0 });
	/** 第 2 代宿主的三个步（多步轮，两次工具调用）。 */
	const STEP1 = usage({ input: 5_135, output: 4_714, cacheRead: 64_256, cacheWrite: 0 });
	const STEP2 = usage({ input: 1_322, output: 296, cacheRead: 12_672, cacheWrite: 0 });
	const STEP3 = usage({ input: 884, output: 861, cacheRead: 12_160, cacheWrite: 0 });

	function toolCardFixture(id: string, outcome: ToolCard["outcome"]): ToolCard {
		return {
			id,
			role: "tool",
			toolName: "powershell",
			label: "运行命令",
			summary: "npm test",
			outcome,
			detail: undefined,
			at: 30,
		};
	}

	/**
	 * 两代宿主的事件流（id 序列 user-2/assistant-3… 被两代复用，与真实会话
	 * 01a0ae75 的事件日志同形态）。第 2 代的轮多步、带两次工具调用，并夹了
	 * 一条无 usage 的 assistant 条目与一条产物条目（非 usage 条目不该影响求和）。
	 *
	 * **run id 两代不同**（run-g1-1 / run-g2-4）：run id 同样出自宿主的 nextId，
	 * 2026-09-17 起带宿主代际号，不可能跨代复用 —— 这里与真实形态保持一致，
	 * 否则窗口判据会把两代算成同一个 run（而本组要钉的正是「消息 id 撞名」）。
	 */
	function replay(): { readonly view: ConversationView; readonly runBilled: readonly number[] } {
		const events: readonly SessionEvent[] = [
			// ── 第 1 代宿主：轮 1 ──
			{ type: "run_started", runId: "run-g1-1" },
			{ type: "user_message", message: user("user-2") },
			{ type: "assistant_started", messageId: "assistant-3", at: 2 },
			{ type: "assistant_done", message: assistant("assistant-3", RUN1) },
			{ type: "run_finished", runId: "run-g1-1", outcome: "completed" },
			// ── 宿主重建（daemon 重启 / resume remount）：id 计数器回零 ──
			{ type: "session_state", state: { ...initialConversation.state, sessionId: "s1" } },
			// ── 第 2 代宿主：轮 2（3 步 / 2 次工具调用）──
			{ type: "run_started", runId: "run-g2-4" },
			{ type: "user_message", message: user("user-2") },
			{ type: "assistant_started", messageId: "assistant-3", at: 20 },
			{ type: "assistant_done", message: assistant("assistant-3", STEP1) },
			{ type: "tool_stream_started", card: toolCardFixture("call_a", undefined) },
			{ type: "tool_finished", card: toolCardFixture("call_a", "ok") },
			{ type: "assistant_started", messageId: "assistant-4", at: 21 },
			{ type: "assistant_done", message: assistant("assistant-4") },
			{ type: "artifacts_presented", files: [], focusFile: undefined },
			{ type: "assistant_started", messageId: "assistant-5", at: 22 },
			{ type: "assistant_done", message: assistant("assistant-5", STEP2) },
			{ type: "tool_started", card: toolCardFixture("call_b", undefined) },
			{ type: "tool_finished", card: toolCardFixture("call_b", "ok") },
			{ type: "assistant_started", messageId: "assistant-6", at: 23 },
			{ type: "assistant_done", message: assistant("assistant-6", STEP3) },
			{ type: "run_finished", runId: "run-g2-4", outcome: "completed" },
		];
		const view = events.reduce<ConversationView>(
			(acc, event) => conversationReducer(acc, { type: "event", event }),
			initialConversation,
		);
		return { view, runBilled: [billed(RUN1), billed(STEP1) + billed(STEP2) + billed(STEP3)] };
	}

	it("本轮 = 台账该 run 的 Σbilled（新一代的 usage 不许写进上一代的老条目）", () => {
		const { view, runBilled } = replay();
		const metrics = foldTurnMetrics(view.entries, { startedAt: 1, endedAt: 2 }, 2);
		expect(metrics.billedInputTokens).toBe(runBilled[1]);
		expect(metrics.outputTokens).toBe(STEP1.output + STEP2.output + STEP3.output);
		expect(metrics.cacheReadTokens).toBe(STEP1.cacheRead + STEP2.cacheRead + STEP3.cacheRead);
	});

	it("更早那轮不被后一代的 usage 污染（反方向的跨轮串账同样拦下）", () => {
		const { view, runBilled } = replay();
		// 第 1 轮的窗口 = 第一条 user（含）到第二条 user（不含）之间的那一段；
		// 按同一 fold 读它，读数必须是第 1 代那条 assistant 自己的 usage。
		const start = view.entries.findIndex((entry) => entry.role === "user");
		const nextUser = view.entries.findIndex((entry, index) => index > start && entry.role === "user");
		const firstTurn = view.entries.slice(start, nextUser);
		const metrics = foldTurnMetrics(firstTurn, { startedAt: 1, endedAt: 2 }, 2);
		expect(metrics.billedInputTokens).toBe(runBilled[0]);
	});
});

/* ── run 边界（steer / 压缩）────────────────────────────────────────── */

/** 三桶齐全的 Σbilled（同上：直接相加，缺字段语义由 foldTurnMetrics 自己处理）。 */
function billedTotal(u: TokenUsage): number {
	return u.input + u.cacheRead + u.cacheWrite;
}

function card(id: string, outcome: ToolCard["outcome"]): ToolCard {
	return {
		id,
		role: "tool",
		toolName: "powershell",
		label: "运行命令",
		summary: "npm test",
		outcome,
		detail: undefined,
		at: 30,
	};
}

function foldEvents(events: readonly SessionEvent[]): ConversationView {
	return events.reduce<ConversationView>(
		(acc, event) => conversationReducer(acc, { type: "event", event }),
		initialConversation,
	);
}

/**
 * 回归门禁（2026-09-17 修）：**steer 不切「本轮」边界**。
 *
 * 现场：pi 的 steer 把排队消息作为 user 消息插进**当前 run**（触发 user_message，
 * pi 不发新的 agent_start）。页脚原先按「最后一条 user 消息」猜轮边界 —— 于是
 * 只统计 steer 之后的步，而台账按 run 聚合是整轮，两者不等（steer 越早，页脚
 * 小得越多；这正是「页脚 < 面板」那条）。
 *
 * 修法：reducer 给 run 期间追加的条目盖 run 身份（shared/conversation.ts 的
 * activeRunId），页脚窗口 = currentRunStartIndex 起的那一段 —— 与 turn-fold 的
 * 活轮判定、chat-view 的指标挂点共用同一份实现（AGENTS.md §4）。真值口径同上一组：
 * 台账每条 message_end 写一条 llm_call，与 assistant_done 一一对应。
 */
describe("steer：页脚 = 台账按 run 聚合（steer 不切边界）", () => {
	const STEP1 = usage({ input: 5_135, output: 4_714, cacheRead: 64_256, cacheWrite: 0 });
	const STEP2 = usage({ input: 1_322, output: 296, cacheRead: 12_672, cacheWrite: 0 });
	/** steer 落地之后那一步 —— 旧口径下页脚只剩它。 */
	const STEP3 = usage({ input: 884, output: 861, cacheRead: 12_160, cacheWrite: 0 });

	/** 单 run / 三条 assistant（中间一次工具调用），第二条 user 是 steer。 */
	function replaySteer(): ConversationView {
		return foldEvents([
			{ type: "run_started", runId: "run-g1-1" },
			{ type: "user_message", message: user("user-g1-2") },
			{ type: "assistant_started", messageId: "assistant-g1-3", at: 2 },
			{ type: "assistant_done", message: assistant("assistant-g1-3", STEP1) },
			{ type: "tool_started", card: card("call_a", "ok") },
			{ type: "assistant_started", messageId: "assistant-g1-4", at: 3 },
			{ type: "assistant_done", message: assistant("assistant-g1-4", STEP2) },
			// steer：同一 run 内的 user 消息（没有新的 run_started）。
			{ type: "user_message", message: user("user-g1-5") },
			{ type: "assistant_started", messageId: "assistant-g1-6", at: 4 },
			{ type: "assistant_done", message: assistant("assistant-g1-6", STEP3) },
			{ type: "run_finished", runId: "run-g1-1", outcome: "completed" },
		]);
	}

	it("窗口从 run 的首条 user 起，而不是从 steer 那条 user 起", () => {
		const view = replaySteer();
		const ids = view.entries.map((entry) => entry.id);
		// 旧口径的切点 = 「最后一条 user」= user-g1-5（下标 4）之后 —— 页脚会只剩
		// assistant-g1-6 那一步。窗口若落在那里就是缺陷本身。
		expect(ids.indexOf("user-g1-5")).toBe(4);
		expect(currentRunStartIndex(view.entries)).toBe(0);
	});

	it("页脚读数 = 该 run 全部步的 Σ（steer 之前 + 之后的步一起算）", () => {
		const view = replaySteer();
		const metrics = foldTurnMetrics(view.entries, { startedAt: 1, endedAt: 2 }, 2);
		expect(metrics.billedInputTokens).toBe(
			billedTotal(STEP1) + billedTotal(STEP2) + billedTotal(STEP3),
		);
		expect(metrics.outputTokens).toBe(STEP1.output + STEP2.output + STEP3.output);
		expect(metrics.cacheReadTokens).toBe(STEP1.cacheRead + STEP2.cacheRead + STEP3.cacheRead);
	});
});

/**
 * 回归门禁（2026-09-17 测）：**空闲压缩不进页脚，也不移动本轮窗口**。
 *
 * 实测（把 agent.streamFunction 换成桩、跑真实的 `session.compact()`）：压缩的
 * 摘要调用走 streamFunction、**不进 agent 循环**，期间收到的 pi 事件只有
 * compaction_start 与 compaction_end —— 没有 message_start/message_end，因此
 * **不会有 assistant_done** 流到页脚，也不会有 llm_call 进台账。
 *
 * 于是「页脚 = 台账按 run 聚合」在压缩上是**天然成立**的（两边都没有数），本组
 * 钉住它的两条可观测后果：
 *   1. 压缩 run 不产生任何条目（页脚无处可计）；
 *   2. 页脚窗口不因压缩 run 移动 —— 读数仍是上一个有内容的 run 的聚合值。
 * 若哪天压缩改走 agent 循环，或 reducer 让「空 run」顶掉窗口，这两条会红。
 */
describe("空闲压缩：不进页脚，也不移动本轮窗口", () => {
	const STEP1 = usage({ input: 8_449, output: 580, cacheRead: 3_456, cacheWrite: 0 });

	function replayCompaction(): ConversationView {
		return foldEvents([
			{ type: "run_started", runId: "run-g1-1" },
			{ type: "user_message", message: user("user-g1-2") },
			{ type: "assistant_started", messageId: "assistant-g1-3", at: 2 },
			{ type: "assistant_done", message: assistant("assistant-g1-3", STEP1) },
			{ type: "run_finished", runId: "run-g1-1", outcome: "completed" },
			// 空闲手动压缩：session-host 复用 run 记账（run_started + compaction_started），
			// 但压缩的模型调用不发任何 message 事件（见上）。
			{ type: "run_started", runId: "run-g2-4" },
			{ type: "compaction_started", reason: "manual" },
			{ type: "compaction_finished", aborted: false },
			{ type: "run_finished", runId: "run-g2-4", outcome: "completed" },
		]);
	}

	it("压缩 run 不产生条目（页脚没有任何可计入的东西）", () => {
		const view = replayCompaction();
		expect(view.entries.map((entry) => entry.role)).toEqual(["user", "assistant"]);
		expect(view.entries.some((entry) => entry.runId === "run-g2-4")).toBe(false);
	});

	it("窗口不移动：读数仍是上一个有内容的 run（= 台账该 run 的聚合）", () => {
		const view = replayCompaction();
		expect(currentRunStartIndex(view.entries)).toBe(0);
		const metrics = foldTurnMetrics(view.entries, { startedAt: 1, endedAt: 2 }, 2);
		expect(metrics.billedInputTokens).toBe(billedTotal(STEP1));
		expect(metrics.outputTokens).toBe(STEP1.output);
	});
});
