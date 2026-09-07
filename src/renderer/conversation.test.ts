/**
 * conversation reducer 的行为测试。
 *
 * 重点不是覆盖率，而是把三类容易出错的行为钉住：
 *   1. 流式增量的累积（长回复下最容易写成整条替换而卡顿）
 *   2. 终态对增量的校正（assistant_done 必须覆盖累积结果）
 *   3. 事件乱序 / 缺失时的兜底（不崩，也不静默丢内容）
 */

import { describe, expect, it } from "vitest";
import type { AssistantMessage, SessionEvent, SessionSnapshot, ToolCard } from "@shared/session-events.ts";
import { conversationReducer, initialConversation, type ConversationView } from "./conversation.ts";

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
				modeId: "ask",
				modelId: "m1",
				isStreaming: false,
			},
			entries: [{ id: "u1", role: "user", text: "你好", at: 1 }],
			availableModes: [{ id: "ask", label: "问答", description: "只读" }],
		};

		const view = conversationReducer(initialConversation, { type: "snapshot", snapshot });

		expect(view.state.sessionId).toBe("s1");
		expect(view.entries).toHaveLength(1);
		expect(view.availableModes[0]?.id).toBe("ask");
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

describe("run 生命周期", () => {
	it("run_started / run_finished 切换 isStreaming", () => {
		const running = apply([{ type: "run_started", runId: "r1" }]);
		expect(running.state.isStreaming).toBe(true);

		const stopped = conversationReducer(running, {
			type: "event",
			event: { type: "run_finished", runId: "r1" },
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
		expect(view.entries[0]).toMatchObject({ role: "assistant", text: "模型调用失败" });
	});
});
