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
import { SessionHost, type SessionHostOptions } from "./session-host.ts";

type SessionStateEvent = Extract<SessionEvent, { type: "session_state" }>;

/** 最小假会话：只实现测试路径会碰到的成员。isStreaming 恒 true，模拟 pi 在 agent_end 时的滞后值。 */
function createFakeSession(): unknown {
	return {
		sessionId: "test-session",
		model: undefined,
		isStreaming: true,
		getContextUsage: () => undefined,
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
		const host = createHost(session, () => {});

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
		await createHost(steer.session, () => {}).prompt("纠偏", "steer", images);
		expect(steer.calls.steer).toEqual([["纠偏", images]]);

		const followUp = recordingSession(true);
		await createHost(followUp.session, () => {}).prompt("追问", "followUp");
		expect(followUp.calls.followUp).toEqual([["追问", undefined]]);
	});
});

type StreamStartedEvent = Extract<SessionEvent, { type: "tool_stream_started" }>;

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
