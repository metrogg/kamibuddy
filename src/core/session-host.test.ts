/**
 * 回归测试：回复输出完后 UI 卡在「正在思考…」（isStreaming 永远为 true）。
 *
 * 根因（pi 源码实证）：
 * - pi 的 `session.isStreaming` 返回 `_isAgentRunActive`，在 `_runAgentPrompt`
 *   开头置 true（agent-session.ts:1107），但置 false 发生在 finally 的
 *   `_emitAgentSettled()`（agent-session.ts:631/1113-1118）——
 *   那时 `agent_end` 早已分发给监听器。
 * - SessionHost 原先在 `state` 里直接透传这个值。`agent_end` 处理中的
 *   `emitState()` 于是把 `isStreaming:true` 的 session_state 推给 renderer，
 *   覆盖了 reducer 里 run_finished 刚置的 false，且之后没有任何事件再纠正。
 *
 * 本测试用「isStreaming 恒为 true 的假会话」模拟 pi 的滞后值：
 * 只要 SessionHost 还透传 pi 的 isStreaming，测试必红。
 */

import { describe, expect, it } from "vitest";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { ImagePart } from "../shared/image.ts";
import type { SessionEvent } from "../shared/session-events.ts";
import type { ModelCatalog } from "./model-catalog.ts";
import { SessionHost, restoredToolLabel, type SessionHostOptions } from "./session-host.ts";

type SessionStateEvent = Extract<SessionEvent, { type: "session_state" }>;

/** 最小假会话：只实现测试路径会碰到的成员。isStreaming 恒 true，模拟 pi 在 agent_end 时的滞后值。 */
function createFakeSession(): unknown {
	return {
		sessionId: "test-session",
		model: undefined,
		isStreaming: true,
		getContextUsage: () => undefined,
		// thinking-level 落地后 getState 现读这两处（session-host.ts:678-679）；
		// 取非推理模型形态：恒 "off" / ["off"]。
		thinkingLevel: "off",
		getAvailableThinkingLevels: () => ["off"],
	};
}

/** 绕过私有构造器（TS private 只在编译期存在）；不碰 create() 里的真实 pi 装配。 */
function createHost(session: unknown, emit: (event: SessionEvent) => void): SessionHost {
	const options: SessionHostOptions = {
		catalog: {} as unknown as ModelCatalog,
		modelKey: undefined,
		cwd: "C:\\test",
		isTempTask: false,
		sceneId: "work",
		interactionId: "craft",
		emit,
		// 本测试不触达两轴资源；空列表即可（构造器不校验）。
		resources: { scenes: [], modes: [] },
	};
	const Ctor = SessionHost as unknown as new (
		session: unknown,
		options: SessionHostOptions,
		sceneId: string,
		interactionId: string,
		skills: readonly unknown[],
	) => SessionHost;
	return new Ctor(session, options, "work", "craft", []);
}

/** translate 是私有的；测试经事件入口驱动，而不是戳内部状态。 */
function translate(host: SessionHost, event: AgentSessionEvent): void {
	(host as unknown as { translate(e: AgentSessionEvent): void }).translate(event);
}

describe("agent_end 后的流式状态", () => {
	it("agent_end 之后 isStreaming 必须为 false（pi 的 isStreaming 此刻仍是滞后的 true）", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		translate(host, { type: "agent_start" } as unknown as AgentSessionEvent);
		translate(host, { type: "agent_end", messages: [], willRetry: false } as unknown as AgentSessionEvent);

		// renderer 实际消费的是 session_state 事件里的值
		const pushed = events
			.filter((e): e is SessionStateEvent => e.type === "session_state")
			.map((e) => e.state.isStreaming);
		expect(pushed.at(-1)).toBe(false);
		expect(host.state.isStreaming).toBe(false);
	});
});

type UserMessageEvent = Extract<SessionEvent, { type: "user_message" }>;

describe("用户消息的图片附件翻译", () => {
	it("带 image 块的 user message：text 拼接文本块，image 块转 ImagePart", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		translate(host, {
			type: "message_start",
			message: {
				role: "user",
				content: [
					{ type: "text", text: "看这张图" },
					{ type: "image", data: "aGk=", mimeType: "image/png" },
					{ type: "text", text: "，写个说明" },
				],
				timestamp: 1725,
			},
		} as unknown as AgentSessionEvent);

		const message = events.find(
			(e): e is UserMessageEvent => e.type === "user_message",
		)?.message;
		expect(message?.text).toBe("看这张图，写个说明");
		expect(message?.images).toEqual([{ type: "image", data: "aGk=", mimeType: "image/png" }]);
	});

	it("纯文本 user message 不带 images 字段", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		translate(host, {
			type: "message_start",
			message: { role: "user", content: "你好", timestamp: 1725 },
		} as unknown as AgentSessionEvent);

		const message = events.find(
			(e): e is UserMessageEvent => e.type === "user_message",
		)?.message;
		expect(message?.text).toBe("你好");
		expect(message !== undefined && "images" in message).toBe(false);
	});
});

describe("prompt 的图片透传", () => {
	/** 可记录调用的假会话。isStreaming 决定走 prompt 还是 steer/followUp 分支。 */
	function recordingSession(isStreaming: boolean): {
		session: unknown;
		calls: { prompt: unknown[][]; steer: unknown[][]; followUp: unknown[][] };
	} {
		const calls: { prompt: unknown[][]; steer: unknown[][]; followUp: unknown[][] } = {
			prompt: [],
			steer: [],
			followUp: [],
		};
		const session = {
			sessionId: "test-session",
			model: undefined,
			isStreaming,
			getContextUsage: () => undefined,
			prompt: (...args: unknown[]) => {
				calls.prompt.push(args);
			},
			steer: (...args: unknown[]) => {
				calls.steer.push(args);
			},
			followUp: (...args: unknown[]) => {
				calls.followUp.push(args);
			},
		};
		return { session, calls };
	}

	it("非流式：图片经 PromptOptions.images 传入，无图时不传 options", async () => {
		const { session, calls } = recordingSession(false);
		const host = createHost(session, () => { });

		await host.prompt("看图", undefined, [
			{ type: "image", data: "aGk=", mimeType: "image/png" },
		]);
		expect(calls.prompt).toEqual([
			["看图", { images: [{ type: "image", data: "aGk=", mimeType: "image/png" }] }],
		]);

		await host.prompt("没图");
		expect(calls.prompt).toHaveLength(2);
		expect(calls.prompt[1]).toEqual(["没图", undefined]);
	});

	it("流式：steer / followUp 的第二参数是图片数组，缺省归一为 undefined", async () => {
		const images: readonly ImagePart[] = [
			{ type: "image", data: "aGk=", mimeType: "image/jpeg" },
		];

		const steer = recordingSession(true);
		await createHost(steer.session, () => { }).prompt("纠偏", "steer", images);
		expect(steer.calls.steer).toEqual([["纠偏", images]]);

		const followUp = recordingSession(true);
		await createHost(followUp.session, () => { }).prompt("追问", "followUp");
		expect(followUp.calls.followUp).toEqual([["追问", undefined]]);
	});
});

type StreamStartedEvent = Extract<SessionEvent, { type: "tool_stream_started" }>;

/*
 * 2026-09-10 用户实测的回归护栏：启动后首发「你好」，先弹 Request timed out. 错误卡，
 * 几秒后回复照常到达 —— 错误卡与正常回复并存。
 * 根因：pi 有自动重试（agent_end 带 willRetry，auto_retry_start/end），失败尝试的
 * message_end 先到、终态后到；SessionHost 原先在 message_end 看到 errorMessage
 * 就发 run_error。修复：失败只记账（pendingRunError），agent_end（willRetry=false）
 * 确认重试耗尽/未开重试才发卡；成功的助手消息清账。
 */

const USAGE = {
	input: 1,
	output: 1,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 2,
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

function assistantStart(host: SessionHost): void {
	translate(host, {
		type: "message_start",
		message: { role: "assistant", content: "", timestamp: 1 },
	} as unknown as AgentSessionEvent);
}

function assistantEnd(
	host: SessionHost,
	stopReason: string,
	opts?: { errorMessage?: string; text?: string },
): void {
	translate(host, {
		type: "message_end",
		message: {
			role: "assistant",
			content: opts?.text ?? "",
			stopReason,
			...(opts?.errorMessage !== undefined ? { errorMessage: opts.errorMessage } : {}),
			usage: USAGE,
			timestamp: 1,
		},
	} as unknown as AgentSessionEvent);
}

function agentEnd(host: SessionHost, willRetry: boolean, messages: unknown[] = []): void {
	translate(host, { type: "agent_end", messages, willRetry } as unknown as AgentSessionEvent);
}

function runStarted(host: SessionHost): void {
	translate(host, { type: "agent_start" } as unknown as AgentSessionEvent);
}

describe("自动重试期的错误卡抑制（pendingRunError）", () => {
	it("失败尝试的 message_end 不立即发 run_error", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runStarted(host);
		assistantStart(host);
		assistantEnd(host, "error", { errorMessage: "Request timed out." });

		expect(events.some((e) => e.type === "run_error")).toBe(false);
	});

	it("先败后成：willRetry=true 后重试成功 → run_finished completed，无 run_error", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runStarted(host);
		assistantStart(host);
		assistantEnd(host, "error", { errorMessage: "Request timed out." });
		agentEnd(host, true);
		assistantStart(host);
		assistantEnd(host, "stop", { text: "你好！我是 KamiBuddy" });
		agentEnd(host, false);

		expect(events.some((e) => e.type === "run_error")).toBe(false);
		const finished = events.find((e) => e.type === "run_finished");
		expect(finished).toMatchObject({ outcome: "completed" });
	});

	it("重试未开/耗尽：agent_end(willRetry=false) 时才发 run_error，且只发一次", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runStarted(host);
		assistantStart(host);
		assistantEnd(host, "error", { errorMessage: "Request timed out." });
		agentEnd(host, false);

		const errors = events.filter((e) => e.type === "run_error");
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatchObject({ message: "Request timed out." });
		expect(events.some((e) => e.type === "run_finished")).toBe(false);
	});

	it("重试后仍失败：willRetry=true 不发卡，终态 agent_end 才发一次", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runStarted(host);
		assistantStart(host);
		assistantEnd(host, "error", { errorMessage: "Request timed out." });
		agentEnd(host, true);
		assistantStart(host);
		assistantEnd(host, "error", { errorMessage: "Request timed out." });
		agentEnd(host, false);

		expect(events.filter((e) => e.type === "run_error")).toHaveLength(1);
	});

	it("取消优先于错误记账：aborted 收尾 → run_finished cancelled，无 run_error", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runStarted(host);
		assistantStart(host);
		assistantEnd(host, "error", { errorMessage: "Request timed out." });
		assistantStart(host);
		assistantEnd(host, "aborted", { errorMessage: "Request was aborted" });
		agentEnd(host, false, [{ role: "assistant", stopReason: "aborted" }]);

		expect(events.some((e) => e.type === "run_error")).toBe(false);
		expect(events.find((e) => e.type === "run_finished")).toMatchObject({ outcome: "cancelled" });
	});
});

describe("工具卡片生成期上屏", () => {
	/** 驱动一次「toolcall_start → 首个 delta（id/name 已稳定）」的最小事件序列。 */
	function streamToolCall(host: SessionHost, name: string, id = "c1"): void {
		translate(host, {
			type: "message_update",
			assistantMessageEvent: {
				type: "toolcall_start",
				contentIndex: 0,
				partial: { content: [{ type: "toolCall", id: "", name: "" }] },
			},
		} as unknown as AgentSessionEvent);
		translate(host, {
			type: "message_update",
			assistantMessageEvent: {
				type: "toolcall_delta",
				contentIndex: 0,
				delta: "{}",
				partial: { content: [{ type: "toolCall", id, name }] },
			},
		} as unknown as AgentSessionEvent);
	}

	it("web_search/web_fetch 在参数生成期即上屏，标签用执行中词汇（搜索中/抓取中）", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		streamToolCall(host, "web_search");
		streamToolCall(host, "web_fetch", "c2");

		const cards = events
			.filter((e): e is StreamStartedEvent => e.type === "tool_stream_started")
			.map((e) => e.card);
		expect(cards.map((c) => [c.toolName, c.label])).toEqual([
			["web_search", "搜索中"],
			["web_fetch", "抓取中"],
		]);
		expect(cards.every((c) => c.generating === true)).toBe(true);
	});

	it("read/ls/grep/find 是本地快操作，不在生成期上屏（卡片等执行态再上）", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		for (const name of ["read", "ls", "grep", "find"]) streamToolCall(host, name);

		expect(events.some((e) => e.type === "tool_stream_started")).toBe(false);
	});

	it("write 仍在生成期上屏，标签按新建给「生成中」", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		streamToolCall(host, "write");

		const card = events.find(
			(e): e is StreamStartedEvent => e.type === "tool_stream_started",
		)?.card;
		expect(card).toMatchObject({ toolName: "write", label: "生成中", generating: true });
	});
});

describe("show_widget 流式通道", () => {
	type StreamProgressEvent = Extract<SessionEvent, { type: "tool_stream_progress" }>;

	/** 驱动一次 show_widget 的 toolcall_start + 两段 delta，返回累积的事件流。 */
	function streamWidget(host: SessionHost, deltas: readonly string[], id = "c1"): void {
		translate(host, {
			type: "message_update",
			assistantMessageEvent: {
				type: "toolcall_start",
				contentIndex: 0,
				partial: { content: [{ type: "toolCall", id: "", name: "" }] },
			},
		} as unknown as AgentSessionEvent);
		for (const delta of deltas) {
			translate(host, {
				type: "message_update",
				assistantMessageEvent: {
					type: "toolcall_delta",
					contentIndex: 0,
					delta,
					partial: { content: [{ type: "toolCall", id, name: "show_widget" }] },
				},
			} as unknown as AgentSessionEvent);
		}
	}

	it("参数生成期即上屏（标签「生成中」），且每个 delta 把累积 rawArgs 推给 renderer", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		streamWidget(host, ['{"title":"sales"', ',"widget_code":"<svg']);

		const card = events.find(
			(e): e is StreamStartedEvent => e.type === "tool_stream_started",
		)?.card;
		expect(card).toMatchObject({ toolName: "show_widget", label: "生成中", generating: true });

		const progress = events
			.filter((e): e is StreamProgressEvent => e.type === "tool_stream_progress")
			.map((e) => e.rawArgs);
		// rawArgs 是累积快照而不是增量：renderer 不做拼接，直接全量替换。
		expect(progress).toEqual(['{"title":"sales"', '{"title":"sales","widget_code":"<svg']);
	});

	it("执行开始（tool_started）用完整 args 回填 streamArgs：生成期累积随整卡替换会丢", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		streamWidget(host, ['{"title":"t"']);
		translate(host, {
			type: "tool_execution_start",
			toolCallId: "c1",
			toolName: "show_widget",
			args: { title: "t", widget_code: "<svg/>", loading_messages: "[]" },
		} as unknown as AgentSessionEvent);

		const started = events.find((e) => e.type === "tool_started");
		expect(started?.type === "tool_started" && started.card.streamArgs).toBe(
			JSON.stringify({ title: "t", widget_code: "<svg/>", loading_messages: "[]" }),
		);
		// 执行期沿用生成期标签（执行是毫秒级纯校验，词汇不跳变）。
		expect(started?.type === "tool_started" && started.card.label).toBe("生成中");
	});

	it("完成标签「已生成」，结果 JSON 经 detail 完整透传（不截断）", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		streamWidget(host, ['{"title":"t"']);
		translate(host, {
			type: "tool_execution_start",
			toolCallId: "c1",
			toolName: "show_widget",
			args: { title: "t", widget_code: "<svg/>" },
		} as unknown as AgentSessionEvent);
		const longCode = `<svg>${"x".repeat(8000)}</svg>`;
		const resultJson = JSON.stringify({
			type: "visualizer_show_widget_result",
			success: true,
			title: "t",
			widget_code: longCode,
			loading_messages: [],
			render_mode: "svg",
		});
		translate(host, {
			type: "tool_execution_end",
			toolCallId: "c1",
			toolName: "show_widget",
			isError: false,
			result: { content: [{ type: "text", text: resultJson }] },
		} as unknown as AgentSessionEvent);

		const finished = events.find((e) => e.type === "tool_finished");
		expect(finished?.type === "tool_finished" && finished.card.label).toBe("已生成");
		expect(finished?.type === "tool_finished" && finished.card.detail).toBe(resultJson);
	});

	it("read_me 是本地快操作：不在生成期上屏，但完成标签是「已读取」", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		// 与 read/ls 同口径：生成期不上屏（streamToolCall 的 name 换成 read_me）。
		translate(host, {
			type: "message_update",
			assistantMessageEvent: {
				type: "toolcall_start",
				contentIndex: 0,
				partial: { content: [{ type: "toolCall", id: "", name: "" }] },
			},
		} as unknown as AgentSessionEvent);
		translate(host, {
			type: "message_update",
			assistantMessageEvent: {
				type: "toolcall_delta",
				contentIndex: 0,
				delta: "{}",
				partial: { content: [{ type: "toolCall", id: "c9", name: "read_me" }] },
			},
		} as unknown as AgentSessionEvent);
		expect(events.some((e) => e.type === "tool_stream_started")).toBe(false);

		translate(host, {
			type: "tool_execution_start",
			toolCallId: "c9",
			toolName: "read_me",
			args: { modules: ["chart"] },
		} as unknown as AgentSessionEvent);
		translate(host, {
			type: "tool_execution_end",
			toolCallId: "c9",
			toolName: "read_me",
			isError: false,
			result: { content: [{ type: "text", text: "指南全文" }] },
		} as unknown as AgentSessionEvent);

		const labels = events
			.filter((e) => e.type === "tool_started" || e.type === "tool_finished")
			.map((e) => (e as { card: { label: string } }).card.label);
		expect(labels).toEqual(["读取中", "已读取"]);
	});
});

describe("restoredToolLabel 的 show_widget 词汇", () => {
	it("ok → 已生成；孤儿调用（aborted）→ 生成（未完成），与 write 同口径", () => {
		expect(restoredToolLabel("show_widget", "ok")).toBe("已生成");
		expect(restoredToolLabel("show_widget", "aborted")).toBe("生成（未完成）");
		expect(restoredToolLabel("show_widget", "error")).toBe("生成（未完成）");
		expect(restoredToolLabel("read_me", "ok")).toBe("已读取");
	});
});
