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

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { ImagePart } from "../shared/image.ts";
import type { SessionEvent } from "../shared/session-events.ts";
import type { ModelCatalog } from "./model-catalog.ts";
import { SessionHost, type SessionHostOptions } from "./session-host.ts";

/*
 * 「初始档位注入」要走 create() 的真实装配路径，断言对象是
 * 「传给 createAgentSession 的 options」而不是 pi 的行为，
 * 所以把 pi 模块的装配件全部换成空壳。
 */
const { createAgentSessionMock } = vi.hoisted(() => ({
	createAgentSessionMock: vi.fn(),
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
	createAgentSession: (options: unknown) => createAgentSessionMock(options),
	DefaultResourceLoader: class {
		async reload(): Promise<void> { }
		getSkills(): { skills: unknown[] } {
			return { skills: [] };
		}
	},
	SettingsManager: { create: () => ({}) },
	SessionManager: { create: () => ({}), open: () => ({}) },
}));

type SessionStateEvent = Extract<SessionEvent, { type: "session_state" }>;

/** 最小假会话：只实现测试路径会碰到的成员。isStreaming 恒 true，模拟 pi 在 agent_end 时的滞后值。 */
function createFakeSession(): unknown {
	return {
		sessionId: "test-session",
		model: undefined,
		isStreaming: true,
		getContextUsage: () => undefined,
		// state getter 对档位两字段是现读的，假会话必须提供（pi 会话恒有这两个成员）。
		thinkingLevel: "medium",
		getAvailableThinkingLevels: () => ["off", "medium"],
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

/*
 * 推理强度档位桥。钉住三件事：
 *   1. state 的 thinkingLevel / availableThinkingLevels 是对 pi getter 的现读
 *      （pi 的 thinking_level_changed 事件 payload 无 availableLevels，
 *      且 setModel 会联动 re-clamp —— 任何缓存副本都会漂移）；
 *   2. setThinkingLevel 转发 pi 并重推 state（pi 恒 clamp 不抛错，
 *      生效值以现读为准）；
 *   3. create() 只在 options.thinkingLevel 非 undefined 时传给 createAgentSession
 *      —— pi 的优先级是该选项高于会话文件的 thinking_level_change 条目
 *      （sdk.ts:226-238），resume 传了会覆盖逐会话还原值。
 */
describe("推理强度档位", () => {
	/** 档位可变的假会话：level/available 是「pi 侧真相」，set 记录转发并模拟生效。 */
	function thinkingSession(): {
		session: unknown;
		sets: string[];
		piState: { level: string; available: string[] };
	} {
		const piState = { level: "medium", available: ["off", "low", "medium", "high"] };
		const sets: string[] = [];
		const session = {
			sessionId: "test-session",
			model: undefined,
			isStreaming: false,
			getContextUsage: () => undefined,
			get thinkingLevel() {
				return piState.level;
			},
			getAvailableThinkingLevels: () => piState.available,
			setThinkingLevel: (level: string) => {
				sets.push(level);
				piState.level = level; // pi clamp 后生效；这里用透传值模拟
			},
		};
		return { session, sets, piState };
	}

	it("state 携带当前档位与可用档位（getter 现读）", () => {
		const { session, piState } = thinkingSession();
		const host = createHost(session, () => { });

		expect(host.state.thinkingLevel).toBe("medium");
		expect(host.state.availableThinkingLevels).toEqual(piState.available);
	});

	it("setThinkingLevel 转发给 pi，重推的 state 携带新档位与可用档位", () => {
		const events: SessionEvent[] = [];
		const { session, sets } = thinkingSession();
		const host = createHost(session, (e) => events.push(e));

		host.setThinkingLevel("high");

		expect(sets).toEqual(["high"]);
		const pushed = events
			.filter((e): e is SessionStateEvent => e.type === "session_state")
			.at(-1);
		expect(pushed?.state.thinkingLevel).toBe("high");
		expect(pushed?.state.availableThinkingLevels).toEqual(["off", "low", "medium", "high"]);
	});

	it("thinking_level_changed 事件后 state 现读更新（不落成员字段）", () => {
		const events: SessionEvent[] = [];
		const { session, piState } = thinkingSession();
		const host = createHost(session, (e) => events.push(e));

		// pi 侧先行变化（cycleThinkingLevel / setModel re-clamp），事件只是通知。
		piState.level = "low";
		translate(host, { type: "thinking_level_changed", level: "low" } as unknown as AgentSessionEvent);

		const pushed = events
			.filter((e): e is SessionStateEvent => e.type === "session_state")
			.at(-1);
		expect(pushed?.state.thinkingLevel).toBe("low");
	});
});

describe("初始档位注入（create → createAgentSession）", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "kami-host-"));
		// create() 会取 getConfigDir() 拼 agentDir，隔离到临时目录（mock 不读写，但路径别指向真实家目录）。
		process.env["KAMIBUDDY_CONFIG_DIR"] = dir;
		createAgentSessionMock.mockReset();
	});

	afterEach(() => {
		delete process.env["KAMIBUDDY_CONFIG_DIR"];
		rmSync(dir, { recursive: true, force: true });
	});

	function baseOptions(): SessionHostOptions {
		return {
			catalog: {} as unknown as ModelCatalog,
			modelKey: undefined,
			cwd: join(dir, "ws"),
			isTempTask: false,
			sceneId: "work",
			interactionId: "craft",
			emit: () => { },
			resources: { scenes: [], modes: [] },
		};
	}

	function fakePiSession(): unknown {
		return {
			sessionId: "s1",
			model: undefined,
			isStreaming: false,
			getContextUsage: () => undefined,
			thinkingLevel: "medium",
			getAvailableThinkingLevels: () => ["off", "medium"],
			setThinkingLevel: () => { },
			subscribe: () => { },
		};
	}

	it("options.thinkingLevel 非 undefined 时透传给 createAgentSession", async () => {
		createAgentSessionMock.mockResolvedValue({ session: fakePiSession() });

		await SessionHost.create({ ...baseOptions(), thinkingLevel: "high" });

		expect(createAgentSessionMock).toHaveBeenCalledTimes(1);
		expect(createAgentSessionMock.mock.calls[0]?.[0]).toMatchObject({ thinkingLevel: "high" });
	});

	it("options.thinkingLevel 为 undefined 时不带该键（resume 由 pi 从会话文件还原）", async () => {
		createAgentSessionMock.mockResolvedValue({ session: fakePiSession() });

		await SessionHost.create(baseOptions());

		expect(createAgentSessionMock).toHaveBeenCalledTimes(1);
		expect(createAgentSessionMock.mock.calls[0]?.[0]).not.toHaveProperty("thinkingLevel");
	});
});
