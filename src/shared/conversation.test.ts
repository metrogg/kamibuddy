/**
 * conversation reducer 的行为测试。
 *
 * 重点不是覆盖率，而是把三类容易出错的行为钉住：
 *   1. 流式增量的累积（长回复下最容易写成整条替换而卡顿）
 *   2. 终态对增量的校正（assistant_done 必须覆盖累积结果）
 *   3. 事件乱序 / 缺失时的兜底（不崩，也不静默丢内容）
 */

import { describe, expect, it } from "vitest";
import type {
	AssistantMessage,
	ConversationEntry,
	SessionEvent,
	SessionSnapshot,
	SubagentStatus,
	ToolCard,
} from "./session-events.ts";
import type { PresentedFile } from "./artifacts.ts";
import {
	artifactsFromEntries,
	conversationReducer,
	initialConversation,
	removeQueuedMessage,
	type ConversationView,
} from "./conversation.ts";

/** 依次应用一串事件，返回最终视图。 */
function apply(events: readonly SessionEvent[], from: ConversationView = initialConversation): ConversationView {
	return events.reduce((view, event) => conversationReducer(view, { type: "event", event }), from);
}

function toolCard(overrides: Partial<ToolCard> = {}): ToolCard {
	return {
		id: "t1",
		role: "tool",
		toolName: "read",
		label: "读取文件",
		summary: "src/index.ts",
		outcome: undefined,
		detail: undefined,
		at: 1000,
		...overrides,
	};
}

describe("snapshot", () => {
	it("整体替换当前视图", () => {
		const snapshot: SessionSnapshot = {
			state: {
				sessionId: "s1",
				cwd: "E:/demo",
				isTempTask: false,
				sceneId: "work",
				interactionId: "ask",
				modelId: "m1",
				isStreaming: false,
			},
			entries: [{ id: "u1", role: "user", text: "你好", at: 1 }],
			availableScenes: [{ id: "work", label: "日常办公", description: "文档与汇报", ready: true }],
			availableModes: [{ id: "ask", label: "问答", description: "只读", ready: true }],
			artifacts: [],
		};

		const view = conversationReducer(initialConversation, { type: "snapshot", snapshot });

		expect(view.state.sessionId).toBe("s1");
		expect(view.entries).toHaveLength(1);
		// 两个轴各自独立传递（WorkBuddy 的 welcomemode / interactionmode 正交结构）。
		expect(view.state.sceneId).toBe("work");
		expect(view.state.interactionId).toBe("ask");
		expect(view.availableScenes[0]?.id).toBe("work");
		expect(view.availableModes[0]?.id).toBe("ask");
	});
});

describe("context_usage", () => {
	const usage = {
		used: 5200,
		total: 128000,
		byCategory: { systemPrompt: 3500, skills: 500, conversation: 350, toolResults: 800 },
	};

	it("context_usage 事件折叠进视图", () => {
		const view = apply([{ type: "context_usage", usage }]);
		expect(view.usageDetail).toEqual(usage);
	});

	it("snapshot 携带时一并恢复（渲染进程重挂载拿回完整状态）", () => {
		const snapshot: SessionSnapshot = {
			state: initialConversation.state,
			entries: [],
			availableScenes: [],
			availableModes: [],
			usageDetail: usage,
			artifacts: [],
		};
		const view = conversationReducer(initialConversation, { type: "snapshot", snapshot });
		expect(view.usageDetail).toEqual(usage);
	});

	it("session_state 不带 contextUsage 时清空明细（压缩后的空窗期，圆环不该停在旧值）", () => {
		const withUsage = apply([{ type: "context_usage", usage }]);
		const cleared = apply(
			[{ type: "session_state", state: { ...initialConversation.state, sessionId: "s1" } }],
			withUsage,
		);
		expect(cleared.usageDetail).toBeUndefined();
	});

	it("session_state 带 contextUsage 时保留明细（新明细随后由 context_usage 事件覆盖）", () => {
		const withUsage = apply([{ type: "context_usage", usage }]);
		const kept = apply(
			[
				{
					type: "session_state",
					state: { ...initialConversation.state, contextUsage: { usedTokens: 1, maxTokens: 100 } },
				},
			],
			withUsage,
		);
		expect(kept.usageDetail).toEqual(usage);
	});
});

describe("history_reset", () => {
	/*
	 * /new 内置命令的回归用例：daemon 清空历史后此前只发 session_state，
	 * 而 reducer 对 session_state 不动 entries —— renderer 一直显示幽灵历史。
	 * 现在 daemon 改发 history_reset，两端折叠同一个事件同步清零。
	 */
	it("清空 entries / turn / cancelledTurns / artifacts / usageDetail，复位 sessionId 与 isStreaming", () => {
		const dirty: ConversationView = {
			...apply([
				{ type: "run_started", runId: "r1" },
				{ type: "user_message", message: { id: "u1", role: "user", text: "帮我写周报", at: 1 } },
				{ type: "run_finished", runId: "r1", outcome: "cancelled" },
				{
					type: "context_usage",
					usage: {
						used: 100,
						total: 128000,
						byCategory: { systemPrompt: 50, skills: 0, conversation: 40, toolResults: 10 },
					},
				},
			]),
			state: { ...initialConversation.state, sessionId: "s1", cwd: "E:/demo", isStreaming: true },
		};
		// 前置断言：视图确实是「脏」的，否则下面的清零断言没有意义。
		expect(dirty.entries).not.toHaveLength(0);
		expect(dirty.cancelledTurns).toContain("u1");
		expect(dirty.usageDetail).toBeDefined();

		const view = conversationReducer(dirty, { type: "event", event: { type: "history_reset" } });

		expect(view.entries).toHaveLength(0);
		expect(view.turn).toBeUndefined();
		expect(view.cancelledTurns).toHaveLength(0);
		expect(view.artifacts).toHaveLength(0);
		expect(view.usageDetail).toBeUndefined();
		expect(view.state.sessionId).toBe("");
		expect(view.state.isStreaming).toBe(false);
		// cwd 与两轴选择保留：新建任务不换空间、不换模式（与 daemon resetSession 同口径）。
		expect(view.state.cwd).toBe("E:/demo");
	});
});

describe("流式增量", () => {
	it("正文增量按序累积，不互相覆盖", () => {
		const view = apply([
			{ type: "assistant_started", messageId: "a1", at: 10 },
			{ type: "assistant_text_delta", messageId: "a1", delta: "你" },
			{ type: "assistant_text_delta", messageId: "a1", delta: "好" },
			{ type: "assistant_text_delta", messageId: "a1", delta: "呀" },
		]);

		expect(view.entries).toHaveLength(1);
		expect(view.entries[0]).toMatchObject({ role: "assistant", text: "你好呀" });
	});

	it("思考增量与正文互不干扰", () => {
		const view = apply([
			{ type: "assistant_started", messageId: "a1", at: 10 },
			{ type: "assistant_thinking_delta", messageId: "a1", delta: "让我想想" },
			{ type: "assistant_text_delta", messageId: "a1", delta: "答案是 42" },
		]);

		expect(view.entries[0]).toMatchObject({ thinking: "让我想想", text: "答案是 42" });
	});

	it("未产生思考时 thinking 不是空串", () => {
		// UI 用 `thinking !== undefined` 决定是否渲染思考块，空串会渲染出一个空盒子。
		// 注意断言的是**取值**而非键存在：reducer 不创建该键，取值为 undefined 即符合语义。
		const view = apply([
			{ type: "assistant_started", messageId: "a1", at: 10 },
			{ type: "assistant_text_delta", messageId: "a1", delta: "直接回答" },
		]);

		const entry = view.entries[0];
		if (entry?.role !== "assistant") throw new Error("首条应为助手消息");
		expect(entry.thinking).toBeUndefined();
	});

	it("终态整条覆盖累积的增量", () => {
		const final: AssistantMessage = { id: "a1", role: "assistant", text: "校正后的完整回复", at: 10 };
		const view = apply([
			{ type: "assistant_started", messageId: "a1", at: 10 },
			{ type: "assistant_text_delta", messageId: "a1", delta: "累积的" },
			{ type: "assistant_done", message: final },
		]);

		expect(view.entries).toHaveLength(1);
		expect(view.entries[0]).toEqual(final);
	});
});

describe("事件乱序与缺失", () => {
	it("增量指向不存在的消息时原样返回，不崩也不造假数据", () => {
		const view = apply([{ type: "assistant_text_delta", messageId: "ghost", delta: "x" }]);
		expect(view.entries).toHaveLength(0);
	});

	it("assistant_done 缺少 started 时补插，不丢内容", () => {
		const final: AssistantMessage = { id: "a9", role: "assistant", text: "孤立的终态", at: 10 };
		const view = apply([{ type: "assistant_done", message: final }]);

		expect(view.entries).toEqual([final]);
	});

	it("tool_finished 缺少 started 时补插", () => {
		const done = toolCard({ outcome: "ok", detail: "文件内容" });
		const view = apply([{ type: "tool_finished", card: done }]);

		expect(view.entries).toEqual([done]);
	});
});

describe("工具卡片", () => {
	it("progress 累积到 detail，finished 覆盖为终态", () => {
		const mid = apply([
			{ type: "tool_started", card: toolCard() },
			{ type: "tool_progress", id: "t1", delta: "第一行\n" },
			{ type: "tool_progress", id: "t1", delta: "第二行\n" },
		]);
		expect(mid.entries[0]).toMatchObject({ detail: "第一行\n第二行\n" });

		const done = toolCard({ outcome: "ok", detail: "完整输出" });
		const view = conversationReducer(mid, { type: "event", event: { type: "tool_finished", card: done } });

		expect(view.entries).toHaveLength(1);
		expect(view.entries[0]).toEqual(done);
	});
});

describe("subagent_progress 子代理投影", () => {
	const agent = (name: string, overrides: Partial<SubagentStatus> = {}): SubagentStatus => ({
		agent: name,
		task: `${name} 的任务`,
		status: "running",
		activity: "正在 web_search 资料",
		turns: 1,
		...overrides,
	});

	it("投影落到对应 id 的工具卡上（全量替换语义）", () => {
		const view = apply([
			{ type: "tool_started", card: toolCard({ toolName: "task", label: "委派子代理" }) },
			{ type: "subagent_progress", id: "t1", agents: [agent("researcher"), agent("writer")] },
		]);

		expect(view.entries).toHaveLength(1);
		expect((view.entries[0] as ToolCard).subagents).toEqual([
			agent("researcher"),
			agent("writer"),
		]);
	});

	it("指向不存在的 id 时不编造卡片，原样返回", () => {
		const view = apply([{ type: "subagent_progress", id: "ghost", agents: [agent("researcher")] }]);
		expect(view.entries).toHaveLength(0);
	});

	it("指向非 tool 条目时不产生任何变化", () => {
		const view = apply([
			{ type: "assistant_started", messageId: "a1", at: 10 },
			{ type: "subagent_progress", id: "a1", agents: [agent("researcher")] },
		]);

		expect(view.entries).toHaveLength(1);
		expect(view.entries[0]).toMatchObject({ role: "assistant", text: "" });
		expect((view.entries[0] as ToolCard).subagents).toBeUndefined();
	});

	it("二次到达整体替换而不是合并（2 个代理 → 1 个代理，最终为 1 个）", () => {
		const view = apply([
			{ type: "tool_started", card: toolCard({ toolName: "task", label: "委派子代理" }) },
			{ type: "subagent_progress", id: "t1", agents: [agent("researcher"), agent("writer")] },
			{ type: "subagent_progress", id: "t1", agents: [agent("researcher", { turns: 3 })] },
		]);

		expect((view.entries[0] as ToolCard).subagents).toEqual([agent("researcher", { turns: 3 })]);
	});
});

describe("生成阶段的工具卡片", () => {
	it("stream_started 上屏生成中卡片，tool_started 同 id 原位翻转为执行态而非重复卡片", () => {
		const generating = toolCard({ toolName: "write", label: "写入文件", summary: "", generating: true });
		const executing = toolCard({ toolName: "write", label: "写入文件", summary: "snake.html" });
		const view = apply([
			{ type: "tool_stream_started", card: generating },
			{ type: "tool_started", card: executing },
		]);

		expect(view.entries).toHaveLength(1);
		expect(view.entries[0]).toEqual(executing);
	});

	it("tool_stream_progress 原位更新路径与行数，保留生成中标记", () => {
		const view = apply([
			{
				type: "tool_stream_started",
				card: toolCard({ toolName: "write", summary: "", generating: true }),
			},
			{ type: "tool_stream_progress", id: "t1", path: "snake.html", added: 42, changeType: "created" },
		]);

		expect(view.entries).toHaveLength(1);
		expect(view.entries[0]).toMatchObject({
			label: "生成中",
			summary: "snake.html",
			generating: true,
			change: { path: "snake.html", added: 42, removed: 0, changeType: "created" },
		});
	});

	it("覆盖已有文件（changeType modified）→ 标签从「生成中」刷成「修改中」", () => {
		const view = apply([
			{
				type: "tool_stream_started",
				card: toolCard({ toolName: "write", label: "生成中", summary: "", generating: true }),
			},
			{ type: "tool_stream_progress", id: "t1", path: "a.md", added: 3, changeType: "modified" },
		]);

		expect(view.entries[0]).toMatchObject({ label: "修改中" });
	});

	it("path 未完整时不落卡：summary 与 change 保持原样", () => {
		const view = apply([
			{
				type: "tool_stream_started",
				card: toolCard({ toolName: "write", summary: "", generating: true }),
			},
			{ type: "tool_stream_progress", id: "t1", path: undefined, added: 0, changeType: "created" },
		]);

		expect(view.entries[0]).toMatchObject({ summary: "" });
		expect((view.entries[0] as ToolCard).change).toBeUndefined();
	});

	it("rawArgs 落进卡片 streamArgs（show_widget 渐进渲染的数据源），不碰行数口径", () => {
		const view = apply([
			{
				type: "tool_stream_started",
				card: toolCard({ toolName: "show_widget", summary: "", generating: true }),
			},
			{
				type: "tool_stream_progress",
				id: "t1",
				path: undefined,
				added: 0,
				changeType: "created",
				rawArgs: '{"title":"sales"',
			},
			{
				type: "tool_stream_progress",
				id: "t1",
				path: undefined,
				added: 0,
				changeType: "created",
				rawArgs: '{"title":"sales","widget_code":"<svg',
			},
		]);

		// rawArgs 是累积快照：后一帧全量替换，reducer 不做拼接。
		const entry = view.entries[0] as ToolCard;
		expect(entry.streamArgs).toBe('{"title":"sales","widget_code":"<svg');
		expect(entry.summary).toBe("");
		expect(entry.change).toBeUndefined();
		expect(entry.generating).toBe(true);
	});

	it("tool_stream_progress 指向不存在的卡片时不造假", () => {
		const view = apply([
			{ type: "tool_stream_progress", id: "ghost", path: "a.md", added: 3, changeType: "created" },
		]);
		expect(view.entries).toHaveLength(0);
	});

	it("run 结束时仍滞留的生成中卡片标记为 aborted（生成被打断，不会执行了）", () => {
		const view = apply([
			{ type: "run_started", runId: "r1" },
			{ type: "tool_stream_started", card: toolCard({ generating: true }) },
			{ type: "run_finished", runId: "r1", outcome: "completed" },
		]);

		expect(view.entries[0]).toMatchObject({ outcome: "aborted" });
		expect((view.entries[0] as ToolCard).generating).toBeUndefined();
	});

	it("run_error 同样清理滞留的生成中卡片", () => {
		const view = apply([
			{ type: "run_started", runId: "r1" },
			{ type: "tool_stream_started", card: toolCard({ generating: true }) },
			{ type: "run_error", runId: "r1", message: "中断" },
		]);

		expect(view.entries[0]).toMatchObject({ outcome: "aborted" });
	});

	it("已完成的卡片不受 run 结束清理影响", () => {
		const view = apply([
			{ type: "run_started", runId: "r1" },
			{ type: "tool_started", card: toolCard() },
			{ type: "tool_finished", card: toolCard({ outcome: "ok" }) },
			{ type: "run_finished", runId: "r1", outcome: "completed" },
		]);

		expect(view.entries[0]).toMatchObject({ outcome: "ok" });
	});
});

describe("run 生命周期", () => {
	it("run_started / run_finished 切换 isStreaming", () => {
		const running = apply([{ type: "run_started", runId: "r1" }]);
		expect(running.state.isStreaming).toBe(true);

		const stopped = conversationReducer(running, {
			type: "event",
			event: { type: "run_finished", runId: "r1", outcome: "completed" },
		});
		expect(stopped.state.isStreaming).toBe(false);
	});

	it("run_error 结束流式并把错误落进会话流", () => {
		const view = apply([
			{ type: "run_started", runId: "r1" },
			{ type: "run_error", runId: "r1", message: "模型调用失败" },
		]);

		expect(view.state.isStreaming).toBe(false);
		expect(view.entries).toHaveLength(1);
		// 错误是独立的 error 条目（渲染为错误卡），不混进 assistant —— 见 ErrorEntry 注释。
		expect(view.entries[0]).toMatchObject({
			role: "error",
			message: "模型调用失败",
			runId: "r1",
		});
	});

	it("错误条目在新回合开始后保留在原位（错误卡是历史的一部分）", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "一", at: 1000 } },
			{ type: "run_error", runId: "r1", message: "模型调用失败" },
			{ type: "run_started", runId: "r2" },
			{ type: "user_message", message: { id: "u2", role: "user", text: "二", at: 2000 } },
		]);

		expect(view.entries.map((e) => e.role)).toEqual(["user", "error", "user"]);
		expect(view.entries[1]).toMatchObject({ runId: "r1" });
	});
});

describe("产物交付", () => {
	it("artifacts_presented 折叠进产物清单，同路径后交付的覆盖并排到末尾", () => {
		const view = apply([
			{
				type: "artifacts_presented",
				files: [{ path: "E:/w/a.html", size: 100, html: true, kind: "local" }],
				focusFile: "E:/w/a.html",
			},
			{
				type: "artifacts_presented",
				files: [
					{ path: "E:/w/b.md", size: 50, html: false, kind: "local" },
					{ path: "E:/w/a.html", size: 120, html: true, kind: "local" },
				],
				focusFile: "E:/w/b.md",
			},
		]);

		expect(view.artifacts).toEqual([
			{ path: "E:/w/b.md", size: 50, at: view.artifacts[0]?.at },
			{ path: "E:/w/a.html", size: 120, at: view.artifacts[1]?.at },
		]);
	});

	it("snapshot 恢复产物清单（渲染进程重挂载）", () => {
		const snapshot: SessionSnapshot = {
			state: initialConversation.state,
			entries: [],
			availableScenes: [],
			availableModes: [],
			artifacts: [{ path: "E:/w/a.html", size: 100, at: 7 }],
		};
		const view = conversationReducer(initialConversation, { type: "snapshot", snapshot });
		expect(view.artifacts).toEqual([{ path: "E:/w/a.html", size: 100, at: 7 }]);
	});
});

describe("artifactsFromEntries · resume 路径产物恢复", () => {
	const local = (path: string, size: number): PresentedFile => ({ path, size, html: false, kind: "local" });
	const presented = (id: string, files: readonly PresentedFile[], at: number): ConversationEntry => ({
		id,
		role: "artifacts_presented",
		files,
		focusFile: undefined,
		at,
	});

	it("空 entries 与无 artifacts_presented 条目都返回空清单", () => {
		expect(artifactsFromEntries([])).toEqual([]);
		expect(artifactsFromEntries([{ id: "u1", role: "user", text: "hi", at: 1 }])).toEqual([]);
	});

	it("单条 artifacts_presented 条目折叠为其 files（at 取条目落盘时间）", () => {
		const out = artifactsFromEntries([presented("p1", [local("E:/w/a.html", 100)], 7)]);
		expect(out).toEqual([{ path: "E:/w/a.html", size: 100, at: 7 }]);
	});

	it("多条交付按路径去重，后交付的覆盖并排到末尾（与 mergePresentedArtifacts 同语义）", () => {
		const out = artifactsFromEntries([
			presented("p1", [local("E:/w/a.html", 100)], 7),
			presented("p2", [local("E:/w/b.md", 50), local("E:/w/a.html", 120)], 9),
		]);
		expect(out).toEqual([
			{ path: "E:/w/b.md", size: 50, at: 9 },
			{ path: "E:/w/a.html", size: 120, at: 9 },
		]);
	});

	it("user / assistant / tool / error 条目不影响折叠结果", () => {
		const entries: ConversationEntry[] = [
			{ id: "u1", role: "user", text: "hi", at: 1 },
			{ id: "a1", role: "assistant", text: "ok", at: 2 },
			toolCard(),
			{ id: "e1", role: "error", message: "中断", runId: "r1", at: 3 },
			presented("p1", [local("E:/w/a.html", 100)], 7),
		];
		expect(artifactsFromEntries(entries)).toEqual([{ path: "E:/w/a.html", size: 100, at: 7 }]);
	});
});

describe("回合计时", () => {
	it("user_message 起表，run_finished 停表", () => {
		const running = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "hi", at: 1000 } },
			{ type: "run_finished", runId: "r1", outcome: "completed" },
		]);

		expect(running.turn?.startedAt).toBe(1000);
		expect(running.turn?.endedAt).toBeTypeOf("number");
	});

	it("新一条 user_message 重新起表（上一回合的 endedAt 不残留）", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "一", at: 1000 } },
			{ type: "run_finished", runId: "r1", outcome: "completed" },
			{ type: "user_message", message: { id: "u2", role: "user", text: "二", at: 2000 } },
		]);

		expect(view.turn).toEqual({ startedAt: 2000 });
	});

	it("run_error 同样停表", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "hi", at: 1000 } },
			{ type: "run_error", runId: "r1", message: "中断" },
		]);

		expect(view.turn?.endedAt).toBeTypeOf("number");
	});

	it("没有起过表的 run（如压缩）不造假回合", () => {
		const view = apply([{ type: "run_finished", runId: "r1", outcome: "completed" }]);
		expect(view.turn).toBeUndefined();
	});
});

describe("中断终态", () => {
	it("run_finished cancelled 停表并落 cancelled 标记", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "hi", at: 1000 } },
			{ type: "run_finished", runId: "r1", outcome: "cancelled" },
		]);

		expect(view.turn?.cancelled).toBe(true);
		expect(view.turn?.endedAt).toBeTypeOf("number");
	});

	it("cancelled 把当前回合（最后一条 user 消息）记入取消名单", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "一", at: 1000 } },
			{ type: "assistant_started", messageId: "a1", at: 1100 },
			{ type: "run_finished", runId: "r1", outcome: "cancelled" },
		]);

		expect(view.cancelledTurns).toEqual(["u1"]);
	});

	it("completed 不受影响：不落 cancelled 标记、不进取消名单", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "hi", at: 1000 } },
			{ type: "run_finished", runId: "r1", outcome: "completed" },
		]);

		expect(view.turn?.cancelled).toBeUndefined();
		expect(view.cancelledTurns).toEqual([]);
	});

	it("后续新回合正常开始：turn 重置不残留 cancelled，取消名单留在历史里", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "一", at: 1000 } },
			{ type: "run_finished", runId: "r1", outcome: "cancelled" },
			{ type: "run_started", runId: "r2" },
			{ type: "user_message", message: { id: "u2", role: "user", text: "二", at: 2000 } },
		]);

		expect(view.turn).toEqual({ startedAt: 2000 });
		expect(view.cancelledTurns).toEqual(["u1"]);
	});

	it("run_error 不是用户取消：停表但不落 cancelled、不进名单", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "hi", at: 1000 } },
			{ type: "run_error", runId: "r1", message: "模型调用失败" },
		]);

		expect(view.turn?.cancelled).toBeUndefined();
		expect(view.cancelledTurns).toEqual([]);
	});

	it("没有 user 消息的 run（如压缩）取消时不记录回合", () => {
		const view = apply([{ type: "run_finished", runId: "r1", outcome: "cancelled" }]);

		expect(view.turn).toBeUndefined();
		expect(view.cancelledTurns).toEqual([]);
	});

	it("snapshot 恢复取消名单（渲染进程重挂载后指示行不丢）", () => {
		const snapshot: SessionSnapshot = {
			state: initialConversation.state,
			entries: [{ id: "u1", role: "user", text: "hi", at: 1 }],
			availableScenes: [],
			availableModes: [],
			turn: { startedAt: 1, endedAt: 2, cancelled: true },
			cancelledTurns: ["u1"],
			artifacts: [],
		};

		const view = conversationReducer(initialConversation, { type: "snapshot", snapshot });

		expect(view.cancelledTurns).toEqual(["u1"]);
		expect(view.turn?.cancelled).toBe(true);
	});
});

describe("run_retry 重试态", () => {
	it("start 折叠为重试态：attempt/maxAttempts 透传，retryAt = 打点 + delayMs", () => {
		const before = Date.now();
		const view = apply([
			{ type: "run_started", runId: "r1" },
			{
				type: "run_retry",
				status: "start",
				attempt: 1,
				maxAttempts: 3,
				delayMs: 5000,
				errorMessage: "Request timed out.",
			},
		]);
		const after = Date.now();

		expect(view.retry?.attempt).toBe(1);
		expect(view.retry?.maxAttempts).toBe(3);
		expect(view.retry?.errorMessage).toBe("Request timed out.");
		// retryAt 由 reducer 打点（两端共用同一份折叠，UI 不自己取时间）。
		expect(view.retry?.retryAt).toBeGreaterThanOrEqual(before + 5000);
		expect(view.retry?.retryAt).toBeLessThanOrEqual(after + 5000);
	});

	it("errorMessage 缺省时键缺席（不造空串）", () => {
		const view = apply([
			{ type: "run_retry", status: "start", attempt: 2, maxAttempts: 3, delayMs: 1000 },
		]);
		expect(view.retry?.errorMessage).toBeUndefined();
	});

	it("success 清重试态（回落正常等待行，终态由后续流表达）", () => {
		const view = apply([
			{ type: "run_retry", status: "start", attempt: 1, maxAttempts: 3, delayMs: 5000 },
			{ type: "run_retry", status: "success", attempt: 1, maxAttempts: 3, delayMs: 0 },
		]);
		expect(view.retry).toBeUndefined();
	});

	it("finalError 清重试态（终态错误由随后的 run_error 落错误卡）", () => {
		const view = apply([
			{ type: "run_retry", status: "start", attempt: 3, maxAttempts: 3, delayMs: 5000 },
			{ type: "run_retry", status: "finalError", attempt: 3, maxAttempts: 3, delayMs: 0 },
			{ type: "run_error", runId: "r1", message: "重试耗尽" },
		]);
		expect(view.retry).toBeUndefined();
		expect(view.entries[0]).toMatchObject({ role: "error", message: "重试耗尽" });
	});

	it("run_finished / run_error / 新 user_message 都清重试态（不随回合穿越）", () => {
		const start = {
			type: "run_retry",
			status: "start",
			attempt: 1,
			maxAttempts: 3,
			delayMs: 5000,
		} as const;

		const finished = apply([start, { type: "run_finished", runId: "r1", outcome: "cancelled" }]);
		expect(finished.retry).toBeUndefined();

		const errored = apply([start, { type: "run_error", runId: "r1", message: "x" }]);
		expect(errored.retry).toBeUndefined();

		const newTurn = apply([
			start,
			{ type: "user_message", message: { id: "u2", role: "user", text: "追问", at: 2 } },
		]);
		expect(newTurn.retry).toBeUndefined();
	});

	it("连续 start 以后到者为准（多次失败的等待窗口原位刷新）", () => {
		const view = apply([
			{ type: "run_retry", status: "start", attempt: 1, maxAttempts: 3, delayMs: 5000 },
			{ type: "run_retry", status: "start", attempt: 2, maxAttempts: 3, delayMs: 10000 },
		]);
		expect(view.retry?.attempt).toBe(2);
	});

	it("history_reset 清重试态", () => {
		const dirty = apply([
			{ type: "run_retry", status: "start", attempt: 1, maxAttempts: 3, delayMs: 5000 },
		]);
		expect(dirty.retry).toBeDefined();
		const view = conversationReducer(dirty, { type: "event", event: { type: "history_reset" } });
		expect(view.retry).toBeUndefined();
	});

	it("snapshot 恢复重试态（重挂载后倒计时以 retryAt 为准继续走）", () => {
		const retry = { attempt: 1, maxAttempts: 3, retryAt: Date.now() + 5000 };
		const snapshot: SessionSnapshot = {
			state: initialConversation.state,
			entries: [],
			availableScenes: [],
			availableModes: [],
			artifacts: [],
			retry,
		};
		const view = conversationReducer(initialConversation, { type: "snapshot", snapshot });
		expect(view.retry).toEqual(retry);
	});
});

describe("queue_changed 排队内容", () => {
	it("steering / followUp 数组原样折叠进视图", () => {
		const view = apply([
			{ type: "queue_changed", steering: ["插一句"], followUp: ["排队一", "排队二"] },
		]);
		expect(view.queued).toEqual({ steering: ["插一句"], followUp: ["排队一", "排队二"] });
	});

	it("队列清空时回落 undefined（与「没有排队」同口径，chips 消失）", () => {
		const view = apply([
			{ type: "queue_changed", steering: ["插一句"], followUp: [] },
			{ type: "queue_changed", steering: [], followUp: [] },
		]);
		expect(view.queued).toBeUndefined();
	});

	it("snapshot 恢复排队内容", () => {
		const snapshot: SessionSnapshot = {
			state: initialConversation.state,
			entries: [],
			availableScenes: [],
			availableModes: [],
			artifacts: [],
			queued: { steering: ["一", "二"], followUp: [] },
		};
		const view = conversationReducer(initialConversation, { type: "snapshot", snapshot });
		expect(view.queued).toEqual({ steering: ["一", "二"], followUp: [] });
	});
});

describe("removeQueuedMessage（排队 chips 的删除/编辑底层）", () => {
	const queued = { steering: ["甲", "乙"], followUp: ["丙"] };

	it("摘掉 steering 里第一条匹配，其余原样", () => {
		expect(removeQueuedMessage(queued, "甲")).toEqual({ steering: ["乙"], followUp: ["丙"] });
	});

	it("steering 没有就摘 followUp 的", () => {
		expect(removeQueuedMessage(queued, "丙")).toEqual({ steering: ["甲", "乙"], followUp: [] });
	});

	it("同文本多条只摘第一条", () => {
		expect(removeQueuedMessage({ steering: ["甲", "甲"], followUp: [] }, "甲")).toEqual({
			steering: ["甲"],
			followUp: [],
		});
	});

	it("同文本跨两个队列时只摘 steering（不双重删除）", () => {
		expect(removeQueuedMessage({ steering: ["甲"], followUp: ["甲"] }, "甲")).toEqual({
			steering: [],
			followUp: ["甲"],
		});
	});

	it("没找到就原样返回（不造新数组，调用方可据此跳过重排）", () => {
		expect(removeQueuedMessage(queued, "不存在")).toBe(queued);
	});
});

describe("回合计时映射（历史轮持久化）", () => {
	it("连续两轮后，两轮计时都在映射里（第一轮不因第二轮开始而丢失）", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "一", at: 1000 } },
			{ type: "run_finished", runId: "r1", outcome: "completed" },
			{ type: "user_message", message: { id: "u2", role: "user", text: "二", at: 2000 } },
			{ type: "run_finished", runId: "r2", outcome: "completed" },
		]);

		expect(view.turnTimings?.u1).toMatchObject({ startedAt: 1000 });
		expect(view.turnTimings?.u1?.endedAt).toBeTypeOf("number");
		expect(view.turnTimings?.u2).toMatchObject({ startedAt: 2000 });
		expect(view.turnTimings?.u2?.endedAt).toBeTypeOf("number");
		// 键口径 = 开轮 user 消息 id（与 turn-fold.ts 的 TurnView.turnId 一致）。
		expect(Object.keys(view.turnTimings ?? {})).toEqual(["u1", "u2"]);
	});

	it("user_message 落地即录入 startedAt（run 尚未结束也能查到起点）", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "hi", at: 1000 } },
		]);
		expect(view.turnTimings?.u1).toEqual({ startedAt: 1000 });
	});

	it("取消的回合在映射里落 cancelled 标记并停表", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "hi", at: 1000 } },
			{ type: "run_finished", runId: "r1", outcome: "cancelled" },
		]);
		expect(view.turnTimings?.u1?.cancelled).toBe(true);
		expect(view.turnTimings?.u1?.endedAt).toBeTypeOf("number");
	});

	it("run_error 停表但不落 cancelled 标记", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "hi", at: 1000 } },
			{ type: "run_error", runId: "r1", message: "中断" },
		]);
		expect(view.turnTimings?.u1?.endedAt).toBeTypeOf("number");
		expect(view.turnTimings?.u1?.cancelled).toBeUndefined();
	});

	it("没有计时信息的 run（无 user 消息，如压缩）不写入映射", () => {
		const view = apply([
			{ type: "run_started", runId: "r1" },
			{ type: "run_finished", runId: "r1", outcome: "completed" },
		]);
		expect(Object.keys(view.turnTimings ?? {})).toEqual([]);
	});

	it("已有历史回合不被后续无回合的 run 结束覆盖", () => {
		const view = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "一", at: 1000 } },
			{ type: "run_finished", runId: "r1", outcome: "completed" },
			// 空闲手动压缩另起一个无 user 消息的 run，结束后不该动 u1。
			{ type: "run_started", runId: "r2" },
			{ type: "run_finished", runId: "r2", outcome: "completed" },
		]);
		expect(Object.keys(view.turnTimings ?? {})).toEqual(["u1"]);
		expect(view.turnTimings?.u1?.startedAt).toBe(1000);
	});

	it("超过上限时丢弃最早的回合（保留最近 100 轮）", () => {
		let view = initialConversation;
		for (let i = 1; i <= 101; i += 1) {
			view = apply(
				[
					{ type: "user_message", message: { id: `u${i}`, role: "user", text: `${i}`, at: i } },
					{ type: "run_finished", runId: `r${i}`, outcome: "completed" },
				],
				view,
			);
		}
		const ids = Object.keys(view.turnTimings ?? {});
		expect(ids).toHaveLength(100);
		expect(ids).not.toContain("u1");
		expect(ids[0]).toBe("u2");
		expect(ids.at(-1)).toBe("u101");
	});

	it("session_state 重推（恢复历史会话）整体替换 state 但不丢映射", () => {
		const withTurns = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "一", at: 1000 } },
			{ type: "run_finished", runId: "r1", outcome: "completed" },
			{ type: "user_message", message: { id: "u2", role: "user", text: "二", at: 2000 } },
			{ type: "run_finished", runId: "r2", outcome: "completed" },
		]);
		const view = apply(
			[{ type: "session_state", state: { ...initialConversation.state, sessionId: "s1" } }],
			withTurns,
		);
		expect(view.state.sessionId).toBe("s1");
		expect(Object.keys(view.turnTimings ?? {})).toEqual(["u1", "u2"]);
	});

	it("history_reset 清空映射（与 entries / turn 同步清零）", () => {
		const dirty = apply([
			{ type: "user_message", message: { id: "u1", role: "user", text: "一", at: 1000 } },
			{ type: "run_finished", runId: "r1", outcome: "completed" },
		]);
		expect(Object.keys(dirty.turnTimings ?? {})).toEqual(["u1"]);

		const view = conversationReducer(dirty, { type: "event", event: { type: "history_reset" } });
		expect(view.turnTimings).toEqual({});
	});
});

describe("压缩态（compaction_started / compaction_finished）", () => {
	it("started 设置压缩态（reason + startedAt 事件到达时刻）", () => {
		const view = apply([{ type: "compaction_started", reason: "threshold" }]);
		expect(view.compacting?.reason).toBe("threshold");
		expect(typeof view.compacting?.startedAt).toBe("number");
	});

	it("finished 清空压缩态", () => {
		const view = apply([
			{ type: "compaction_started", reason: "manual" },
			{ type: "compaction_finished", aborted: false },
		]);
		expect(view.compacting).toBeUndefined();
	});

	it("aborted 的 finished 也清空", () => {
		const view = apply([
			{ type: "compaction_started", reason: "threshold" },
			{ type: "compaction_finished", aborted: true },
		]);
		expect(view.compacting).toBeUndefined();
	});

	it("带 errorMessage 的 finished 也清空（失败细节留给随后的 run_error 卡）", () => {
		const view = apply([
			{ type: "compaction_started", reason: "overflow" },
			{ type: "compaction_finished", aborted: false, errorMessage: "摘要生成失败" },
		]);
		expect(view.compacting).toBeUndefined();
	});

	it("连续 started 以后到者为准（原位刷新 reason）", () => {
		const view = apply([
			{ type: "compaction_started", reason: "threshold" },
			{ type: "compaction_started", reason: "manual" },
		]);
		expect(view.compacting?.reason).toBe("manual");
	});

	it("history_reset 清空压缩态（不残留幽灵状态行）", () => {
		const dirty = apply([{ type: "compaction_started", reason: "threshold" }]);
		expect(dirty.compacting).toBeDefined();
		const view = conversationReducer(dirty, { type: "event", event: { type: "history_reset" } });
		expect(view.compacting).toBeUndefined();
	});

	it("session_state 重推不残留压缩态（权威 state 不含压缩，重推即清）", () => {
		const dirty = apply([{ type: "compaction_started", reason: "threshold" }]);
		const view = apply(
			[{ type: "session_state", state: { ...initialConversation.state, sessionId: "s1" } }],
			dirty,
		);
		expect(view.state.sessionId).toBe("s1");
		expect(view.compacting).toBeUndefined();
	});

	it("snapshot 恢复不残留压缩态（瞬态字段不随快照恢复）", () => {
		const dirty = apply([{ type: "compaction_started", reason: "manual" }]);
		const snapshot: SessionSnapshot = {
			state: initialConversation.state,
			entries: [],
			availableScenes: [],
			availableModes: [],
			artifacts: [],
		};
		const view = conversationReducer(dirty, { type: "snapshot", snapshot });
		expect(view.compacting).toBeUndefined();
	});
});
