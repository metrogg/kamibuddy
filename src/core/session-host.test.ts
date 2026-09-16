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

import { describe, expect, it, vi } from "vitest";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { ImagePart } from "../shared/image.ts";
import type { SessionEvent } from "../shared/session-events.ts";
import type { ModelCatalog } from "./model-catalog.ts";
import type { ModeResource } from "./resources.ts";
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
		// 本测试不触达两轴与风格资源；空列表即可（构造器不校验）。
		resources: { scenes: [], modes: [], styles: [], fragments: new Map() },
	};
	const Ctor = SessionHost as unknown as new (
		session: unknown,
		options: SessionHostOptions,
		sceneId: string,
		interactionId: string,
		expertId: string | undefined,
		skills: readonly unknown[],
	) => SessionHost;
	return new Ctor(session, options, "work", "craft", undefined, []);
}

/** translate 是私有的；测试经事件入口驱动，而不是戳内部状态。 */
function translate(host: SessionHost, event: AgentSessionEvent): void {
	(host as unknown as { translate(e: AgentSessionEvent): void }).translate(event);
}

/**
 * 专家与交互模式正交（spec: rework-expert-orthogonal-and-skills）：
 * setInteraction 只切模式轴、setExpert 只改绑定，二者互不影响。
 */
describe("专家与交互模式正交", () => {
	const MODES: readonly ModeResource[] = [
		{ id: "ask", label: "问答", description: "", ready: true, tools: ["read"], body: "问答段" },
		{ id: "craft", label: "执行", description: "", ready: true, tools: ["read", "write"], body: "执行段" },
		{ id: "plan", label: "计划", description: "", ready: true, tools: ["read"], body: "计划段" },
	];

	/** 带三模式白名单、可记录 setActiveToolsByName 的宿主（setInteraction 会换工具集）。 */
	function createAxesHost(
		interactionId: string,
		expertId: string | undefined,
	): SessionHost {
		const session = {
			sessionId: "test-session",
			model: undefined,
			isStreaming: false,
			getContextUsage: () => undefined,
			thinkingLevel: "off",
			getAvailableThinkingLevels: () => ["off"],
			setActiveToolsByName: (_tools: readonly string[]) => {},
		};
		const options: SessionHostOptions = {
			catalog: {} as unknown as ModelCatalog,
			modelKey: undefined,
			cwd: "C:\\test",
			isTempTask: false,
			sceneId: "work",
			interactionId,
			...(expertId === undefined ? {} : { expertId }),
			emit: () => {},
			resources: { scenes: [], modes: MODES, styles: [], fragments: new Map() },
		};
		const Ctor = SessionHost as unknown as new (
			session: unknown,
			options: SessionHostOptions,
			sceneId: string,
			interactionId: string,
			expertId: string | undefined,
			skills: readonly unknown[],
		) => SessionHost;
		return new Ctor(session, options, "work", interactionId, expertId, []);
	}

	it("切交互模式不改 expertId", () => {
		const host = createAxesHost("plan", "work-report");
		host.setInteraction("ask");
		expect(host.state.interactionId).toBe("ask");
		expect(host.state.expertId).toBe("work-report");
	});

	it("选专家不改 interactionId", () => {
		const host = createAxesHost("plan", undefined);
		host.setExpert("work-report");
		expect(host.state.interactionId).toBe("plan");
		expect(host.state.expertId).toBe("work-report");
	});

	it("plan + 专家取消后 interactionId 仍是 plan，expertId 键缺席", () => {
		const host = createAxesHost("plan", "work-report");
		host.setExpert(undefined);
		expect(host.state.interactionId).toBe("plan");
		expect("expertId" in host.state).toBe(false);
	});

	it("expert 不再是交互模式：切到它响亮报错（专家改为正交绑定）", () => {
		const host = createAxesHost("craft", undefined);
		expect(() => host.setInteraction("expert")).toThrow("未知的交互模式");
	});
});

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

describe("用户消息的技能块剥离", () => {
	it("pi 展开的「/skill:docx 写周报」：text 只留补充文本，skillNames 结构化下发", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		// pi 的展开形状（agent-session.js:995-996）：`<skill …>块</skill>` + `\n\n` + 用户补充文本。
		const expanded =
			'<skill name="docx" location="C:\\Users\\me\\.kamibuddy\\skills\\docx\\SKILL.md">\n' +
			"References are relative to C:\\Users\\me\\.kamibuddy\\skills\\docx.\n\n" +
			"做 Word 文档。\n</skill>\n\n写周报";

		translate(host, {
			type: "message_start",
			message: { role: "user", content: expanded, timestamp: 1725 },
		} as unknown as AgentSessionEvent);

		const message = events.find(
			(e): e is UserMessageEvent => e.type === "user_message",
		)?.message;
		expect(message?.text).toBe("写周报");
		expect(message?.skillNames).toEqual(["docx"]);
	});

	it("无技能块的用户消息不带 skillNames 字段", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		translate(host, {
			type: "message_start",
			message: { role: "user", content: "你好", timestamp: 1725 },
		} as unknown as AgentSessionEvent);

		const message = events.find(
			(e): e is UserMessageEvent => e.type === "user_message",
		)?.message;
		expect(message !== undefined && "skillNames" in message).toBe(false);
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

	it("流式缺省 = 排队（followUp）：补一句的常规意图是等它跑完，不是打断", async () => {
		const s = recordingSession(true);
		await createHost(s.session, () => { }).prompt("补一句");
		expect(s.calls.followUp).toEqual([["补一句", undefined]]);
		expect(s.calls.steer).toHaveLength(0);
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

	it("todo_write 也在生成期上屏，标签「任务列表」（清单全在参数里、执行瞬时，同 show_widget 道理）", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		streamToolCall(host, "todo_write");

		const card = events.find(
			(e): e is StreamStartedEvent => e.type === "tool_stream_started",
		)?.card;
		expect(card).toMatchObject({ toolName: "todo_write", label: "任务列表", generating: true });
	});
});

describe("todo_write 清单卡", () => {
	type ToolFinishedEvent = Extract<SessionEvent, { type: "tool_finished" }>;

	/** 驱动一次 todo_write 的 execution_start（带 args）→ execution_end。 */
	function runTodoWrite(host: SessionHost, args: unknown): void {
		translate(host, {
			type: "tool_execution_start",
			toolCallId: "c1",
			toolName: "todo_write",
			args,
		} as unknown as AgentSessionEvent);
		translate(host, {
			type: "tool_execution_end",
			toolCallId: "c1",
			toolName: "todo_write",
			isError: false,
			result: { content: [{ type: "text", text: "待办清单已更新。" }] },
		} as unknown as AgentSessionEvent);
	}

	function finishedCard(events: readonly SessionEvent[]): ToolFinishedEvent["card"] | undefined {
		return events.find((e): e is ToolFinishedEvent => e.type === "tool_finished")?.card;
	}

	it("终态卡从 args 解析出 todos（执行态卡携带，finished 从 started 继承）", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runTodoWrite(host, {
			todos: [
				{ content: "整理数据", status: "completed" },
				{ content: "写报告", activeForm: "正在写报告", status: "in_progress" },
				{ content: "交付产物", status: "pending" },
			],
		});

		const card = finishedCard(events);
		expect(card?.label).toBe("任务列表");
		expect(card?.todos).toEqual([
			{ content: "整理数据", status: "completed" },
			{ content: "写报告", activeForm: "正在写报告", status: "in_progress" },
			{ content: "交付产物", status: "pending" },
		]);
		// activeForm 缺省项键必须缺席（与 images/thinking 同口径：空值不占字段）。
		const first = card?.todos?.[0];
		expect(first !== undefined && "activeForm" in first).toBe(false);
	});

	it("空数组是收尾语义（清单关闭）：todos 落成 []，不是键缺席", () => {
		const events: SessionEvent[] = [];
		runTodoWrite(createHost(createFakeSession(), (e) => events.push(e)), { todos: [] });

		expect(finishedCard(events)?.todos).toEqual([]);
	});

	it("脏 args 不抛错：todos 非数组 → 键缺席，卡片照常落成", () => {
		const events: SessionEvent[] = [];
		runTodoWrite(createHost(createFakeSession(), (e) => events.push(e)), { todos: "手滑了" });

		const card = finishedCard(events);
		expect(card).toBeDefined();
		expect(card !== undefined && "todos" in card).toBe(false);
	});

	it("脏 args 不抛错：单项缺 content/status 或 status 非三态 → 剔除该项，activeForm 脏了丢字段不丢项", () => {
		const events: SessionEvent[] = [];
		runTodoWrite(createHost(createFakeSession(), (e) => events.push(e)), {
			todos: [
				{ content: "正常项", status: "pending" },
				{ content: "状态非法", status: "doing" },
				{ status: "pending" },
				"纯字符串垃圾",
				{ content: "activeForm 非法", status: "in_progress", activeForm: 42 },
			],
		});

		expect(finishedCard(events)?.todos).toEqual([
			{ content: "正常项", status: "pending" },
			{ content: "activeForm 非法", status: "in_progress" },
		]);
	});
});

describe("shell 卡头的模型自描述（WorkBuddy 口径）", () => {
	type ToolStartedEvent = Extract<SessionEvent, { type: "tool_started" }>;
	type ToolFinishedEvent = Extract<SessionEvent, { type: "tool_finished" }>;

	/** 驱动一次 powershell 的 execution_start（带 args）→ execution_end。 */
	function runPowershell(host: SessionHost, args: unknown): void {
		translate(host, {
			type: "tool_execution_start",
			toolCallId: "c1",
			toolName: "powershell",
			args,
		} as unknown as AgentSessionEvent);
		translate(host, {
			type: "tool_execution_end",
			toolCallId: "c1",
			toolName: "powershell",
			isError: false,
			result: { content: [{ type: "text", text: "命令执行完成，退出码 0。" }] },
		} as unknown as AgentSessionEvent);
	}

	function cards(events: readonly SessionEvent[]): {
		started: ToolStartedEvent["card"] | undefined;
		finished: ToolFinishedEvent["card"] | undefined;
	} {
		return {
			started: events.find((e): e is ToolStartedEvent => e.type === "tool_started")?.card,
			finished: events.find((e): e is ToolFinishedEvent => e.type === "tool_finished")?.card,
		};
	}

	it("有 description：卡头显示描述，命令本体退成 hover 提示（终态从执行态继承）", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runPowershell(host, {
			command: "Get-ChildItem -Recurse | Select-Object Name",
			description: "列出目录下的所有文件",
		});

		const { started, finished } = cards(events);
		expect(started).toMatchObject({
			summary: "列出目录下的所有文件",
			summaryTitle: "Get-ChildItem -Recurse | Select-Object Name",
		});
		expect(finished).toMatchObject({
			summary: "列出目录下的所有文件",
			summaryTitle: "Get-ChildItem -Recurse | Select-Object Name",
		});
	});

	it("无 description：摘要就是命令，summaryTitle 键缺席（不渲染 title 属性）", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runPowershell(host, { command: "node -v" });

		const { started, finished } = cards(events);
		expect(started?.summary).toBe("node -v");
		expect(started !== undefined && "summaryTitle" in started).toBe(false);
		expect(finished?.summary).toBe("node -v");
		expect(finished !== undefined && "summaryTitle" in finished).toBe(false);
	});

	it("description 为空串：退回命令，不产生空的 hover 提示", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runPowershell(host, { command: "node -v", description: "" });

		const { started } = cards(events);
		expect(started?.summary).toBe("node -v");
		expect(started !== undefined && "summaryTitle" in started).toBe(false);
	});
});

describe("web_search 来源卡", () => {
	type ToolFinishedEvent = Extract<SessionEvent, { type: "tool_finished" }>;

	/** 驱动一次 web_search 的 execution_start → execution_end（result 带 details）。 */
	function runWebSearch(host: SessionHost, result: unknown, toolName = "web_search"): void {
		translate(host, {
			type: "tool_execution_start",
			toolCallId: "c1",
			toolName,
			args: { query: "股价" },
		} as unknown as AgentSessionEvent);
		translate(host, {
			type: "tool_execution_end",
			toolCallId: "c1",
			toolName,
			isError: false,
			result,
		} as unknown as AgentSessionEvent);
	}

	function finishedCard(events: readonly SessionEvent[]): ToolFinishedEvent["card"] | undefined {
		return events.find((e): e is ToolFinishedEvent => e.type === "tool_finished")?.card;
	}

	it("result.details.results → 卡带 sources（snippet 映射、site 推导、内网项剔除）", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runWebSearch(host, {
			content: [{ type: "text", text: "「股价」的搜索结果：…" }],
			details: {
				count: 3,
				results: [
					{ title: "标题一", url: "https://www.a.com/p", description: "摘要一", publishedAt: "2026-09-01" },
					{ title: "标题二", url: "https://b.com", description: "摘要二" },
					// 脏项（内网 URL）：剔除，不拖垮整卡。
					{ title: "内网", url: "http://192.168.1.1/" },
				],
			},
		});

		const card = finishedCard(events);
		expect(card?.label).toBe("已搜索");
		expect(card?.sources).toEqual([
			{ title: "标题一", url: "https://www.a.com/p", snippet: "摘要一", site: "a.com" },
			{ title: "标题二", url: "https://b.com", snippet: "摘要二", site: "b.com" },
		]);
	});

	it("result.details 缺席（旧结果形状）→ sources 键缺席，卡片照常落成", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runWebSearch(host, { content: [{ type: "text", text: "「股价」的搜索结果：…" }] });

		const card = finishedCard(events);
		expect(card).toBeDefined();
		expect(card !== undefined && "sources" in card).toBe(false);
	});

	it("空 results → sources 落成 []（搜索无来源），不是键缺席", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runWebSearch(host, {
			content: [{ type: "text", text: "「x」没有找到相关结果" }],
			details: { count: 0, results: [] },
		});

		expect(finishedCard(events)?.sources).toEqual([]);
	});

	it("非 web_search 工具的 details 不填 sources（web_fetch 不计入来源）", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		runWebSearch(
			host,
			{
				content: [{ type: "text", text: "正文" }],
				details: { url: "https://a.com", title: "t" },
			},
			"web_fetch",
		);

		const card = finishedCard(events);
		expect(card?.toolName).toBe("web_fetch");
		expect(card !== undefined && "sources" in card).toBe(false);
	});
});

describe("task 子代理投影桥", () => {
	type ToolFinishedEvent = Extract<SessionEvent, { type: "tool_finished" }>;

	const RUNNING_PROJECTION = [
		{ agent: "scout", task: "查一下", status: "running", activity: "正在 read a.md", turns: 0 },
		{ agent: "worker", task: "写文档", status: "queued", activity: "", turns: 0 },
	] as const;
	const DONE_PROJECTION = [
		{ agent: "scout", task: "查一下", status: "done", activity: "", turns: 2, output: "侦察完毕" },
		{ agent: "worker", task: "写文档", status: "done", activity: "", turns: 1, output: "文档已成" },
	] as const;

	function startTask(host: SessionHost): void {
		translate(host, {
			type: "tool_execution_start",
			toolCallId: "c1",
			toolName: "task",
			args: { tasks: [{ agent: "scout", task: "查一下" }, { agent: "worker", task: "写文档" }] },
		} as unknown as AgentSessionEvent);
	}

	it("partialResult.details 带 subagents → 发 subagent_progress（整体替换），不发 tool_progress", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));
		startTask(host);
		translate(host, {
			type: "tool_execution_update",
			toolCallId: "c1",
			toolName: "task",
			// content.text 恒空（投影期口径）——若桥接判定落在空串早退之后，
			// 这条投影会被静默吞掉，本用例即回归那个坑。
			partialResult: {
				content: [{ type: "text", text: "" }],
				details: { mode: "parallel", results: [], subagents: RUNNING_PROJECTION },
			},
		} as unknown as AgentSessionEvent);

		const progress = events.filter((e) => e.type === "subagent_progress");
		expect(progress).toHaveLength(1);
		const first = progress[0];
		expect(first?.type === "subagent_progress" && first.id).toBe("c1");
		expect(first?.type === "subagent_progress" && first.agents).toEqual(RUNNING_PROJECTION);
		expect(events.some((e) => e.type === "tool_progress")).toBe(false);
	});

	it("details 无 subagents 的部分结果仍走 tool_progress 文本 delta（其他工具不受影响）", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));
		translate(host, {
			type: "tool_execution_update",
			toolCallId: "c1",
			toolName: "powershell",
			partialResult: { content: [{ type: "text", text: "半行输出" }] },
		} as unknown as AgentSessionEvent);

		const deltas = events.filter((e) => e.type === "tool_progress");
		expect(deltas).toHaveLength(1);
		expect(deltas[0]?.type === "tool_progress" && deltas[0].delta).toBe("半行输出");
		expect(events.some((e) => e.type === "subagent_progress")).toBe(false);
	});

	it("终态 result.details 带 subagents → 挂到 tool_finished 卡片的 subagents 字段", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));
		startTask(host);
		translate(host, {
			type: "tool_execution_end",
			toolCallId: "c1",
			toolName: "task",
			isError: false,
			result: {
				content: [{ type: "text", text: "并行执行 2 个子任务，成功 2 个：…" }],
				details: { mode: "parallel", results: [], subagents: DONE_PROJECTION },
			},
		} as unknown as AgentSessionEvent);

		const card = events.find((e): e is ToolFinishedEvent => e.type === "tool_finished")?.card;
		expect(card?.subagents).toEqual(DONE_PROJECTION);
	});

	it("终态 details 无 subagents → 卡片 subagents 键缺席，照常落成", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));
		translate(host, {
			type: "tool_execution_start",
			toolCallId: "c1",
			toolName: "read",
			args: { path: "a.md" },
		} as unknown as AgentSessionEvent);
		translate(host, {
			type: "tool_execution_end",
			toolCallId: "c1",
			toolName: "read",
			isError: false,
			result: { content: [{ type: "text", text: "文件内容" }] },
		} as unknown as AgentSessionEvent);

		const card = events.find((e): e is ToolFinishedEvent => e.type === "tool_finished")?.card;
		expect(card).toBeDefined();
		expect(card !== undefined && "subagents" in card).toBe(false);
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

/* ── 运行台账与事件转发（spec: add-observability-ledger Task 1）────────── */

import type { RunLedgerDataMap, RunLedgerEntryKind } from "../shared/observability.ts";
import type { RunLedger } from "./run-ledger.ts";

interface LedgerCall<K extends RunLedgerEntryKind = RunLedgerEntryKind> {
	readonly kind: K;
	readonly data: RunLedgerDataMap[K];
}

/** 捕获台账写入的假 RunLedger（只实现测试路径会碰到的成员）。 */
function createFakeLedger(): { ledger: RunLedger; calls: LedgerCall[]; failures: string[] } {
	const calls: LedgerCall[] = [];
	const failures: string[] = [];
	const ledger = {
		append: (kind: RunLedgerEntryKind, data: unknown) => {
			calls.push({ kind, data: data as never });
		},
		reportFailure: (message: string) => failures.push(message),
	} as unknown as RunLedger;
	return { ledger, calls, failures };
}

/** 带台账与 transformContext 的假会话（agent.transformContext 模拟 pi 的 emitContext 透传）。 */
function createLedgerSession(): {
	session: unknown;
	agent: { transformContext?: (m: unknown[], s?: AbortSignal) => Promise<unknown[]> };
} {
	const agent: {
		transformContext?: (m: unknown[], s?: AbortSignal) => Promise<unknown[]>;
	} = {
		transformContext: async (m) => m,
	};
	const session = {
		sessionId: "test-session",
		model: undefined,
		isStreaming: false,
		getContextUsage: () => undefined,
		thinkingLevel: "off",
		getAvailableThinkingLevels: () => ["off"],
		agent,
	};
	return { session, agent };
}

function createLedgerHost(
	session: unknown,
	emit: (event: SessionEvent) => void,
	ledger: RunLedger,
	segments?: readonly { source: string; chars: number }[],
	expertLabel?: string,
): SessionHost {
	const options: SessionHostOptions = {
		catalog: {} as unknown as ModelCatalog,
		modelKey: undefined,
		cwd: "C:\\test",
		isTempTask: false,
		sceneId: "work",
		interactionId: "craft",
		emit,
		resources: { scenes: [], modes: [], styles: [], fragments: new Map() },
		createLedger: () => ledger,
		...(segments === undefined ? {} : { getSystemPromptSegments: () => segments }),
		...(expertLabel === undefined ? {} : { getExpertLabel: () => expertLabel }),
	};
	const Ctor = SessionHost as unknown as new (
		session: unknown,
		options: SessionHostOptions,
		sceneId: string,
		interactionId: string,
		expertId: string | undefined,
		skills: readonly unknown[],
	) => SessionHost;
	return new Ctor(session, options, "work", "craft", undefined, []);
}

/** 全字段 usage（reasoning/cacheWrite1h 有值，cost 带分项）。 */
const FULL_USAGE = {
	input: 100,
	output: 20,
	cacheRead: 40,
	cacheWrite: 10,
	cacheWrite1h: 4,
	reasoning: 6,
	totalTokens: 170,
	cost: { input: 0.001, output: 0.002, cacheRead: 0.0004, cacheWrite: 0.0001, total: 0.0035 },
};

describe("auto_retry / queue_update 转发与台账", () => {
	it("auto_retry_start → run_retry(start) 转发 + 台账 retry(start)；end 补齐 start 的退避参数", () => {
		const events: SessionEvent[] = [];
		const { ledger, calls } = createFakeLedger();
		const { session } = createLedgerSession();
		const host = createLedgerHost(session, (e) => events.push(e), ledger);

		runStarted(host);
		agentEnd(host, true);
		translate(host, {
			type: "auto_retry_start",
			attempt: 1,
			maxAttempts: 3,
			delayMs: 2000,
			errorMessage: "Request timed out.",
		} as unknown as AgentSessionEvent);
		translate(host, {
			type: "auto_retry_end",
			success: false,
			attempt: 1,
			finalError: "Request timed out.",
		} as unknown as AgentSessionEvent);

		const retries = events.filter((e) => e.type === "run_retry");
		expect(retries).toEqual([
			{
				type: "run_retry",
				status: "start",
				attempt: 1,
				maxAttempts: 3,
				delayMs: 2000,
				errorMessage: "Request timed out.",
			},
			{
				type: "run_retry",
				status: "finalError",
				attempt: 1,
				maxAttempts: 3,
				delayMs: 2000,
				errorMessage: "Request timed out.",
			},
		]);

		const ledgerRetries = calls.filter((c) => c.kind === "retry");
		expect(ledgerRetries).toHaveLength(2);
		expect(ledgerRetries[0]?.data).toMatchObject({
			phase: "start",
			attempt: 1,
			maxAttempts: 3,
			delayMs: 2000,
			errorMessage: "Request timed out.",
		});
		expect(ledgerRetries[1]?.data).toMatchObject({
			phase: "end",
			attempt: 1,
			success: false,
			finalError: "Request timed out.",
		});
		// retry start 归属刚闭合的失败尝试（pi 事件序：agent_end(willRetry) 先于 auto_retry_start）。
		expect((ledgerRetries[0]?.data as { runId?: string }).runId).toBe("run-1");
	});

	it("重试链在台账里：失败尝试的 run 以 error 闭合，不留永不闭合的孤儿 run", () => {
		const { ledger, calls } = createFakeLedger();
		const { session } = createLedgerSession();
		const host = createLedgerHost(session, () => { }, ledger);

		runStarted(host);
		assistantStart(host);
		assistantEnd(host, "error", { errorMessage: "Request timed out." });
		agentEnd(host, true);
		runStarted(host);
		assistantStart(host);
		assistantEnd(host, "stop", { text: "好了" });
		agentEnd(host, false);

		const runs = calls.filter((c) => c.kind === "run_start" || c.kind === "run_end");
		expect(runs.map((c) => [c.kind, (c.data as { reason?: string }).reason ?? ""])).toEqual([
			["run_start", ""],
			["run_end", "error"],
			["run_start", ""],
			["run_end", "completed"],
		]);
	});

	it("queue_update → queue_changed 转发 + 台账 queue", () => {
		const events: SessionEvent[] = [];
		const { ledger, calls } = createFakeLedger();
		const { session } = createLedgerSession();
		const host = createLedgerHost(session, (e) => events.push(e), ledger);

		translate(host, {
			type: "queue_update",
			steering: ["先别写了"],
			followUp: ["之后总结一下"],
		} as unknown as AgentSessionEvent);

		expect(events).toEqual([
			{ type: "queue_changed", steering: ["先别写了"], followUp: ["之后总结一下"] },
		]);
		expect(calls.filter((c) => c.kind === "queue")[0]?.data).toEqual({
			steering: ["先别写了"],
			followUp: ["之后总结一下"],
		});
	});
});

describe("turn 边界 → 台账 llm_call", () => {
	function driveTurn(host: SessionHost): void {
		runStarted(host);
		translate(host, { type: "turn_start" } as unknown as AgentSessionEvent);
		assistantStart(host);
		translate(host, {
			type: "message_update",
			assistantMessageEvent: { type: "text_delta", delta: "你", partial: { content: [] } },
		} as unknown as AgentSessionEvent);
		translate(host, {
			type: "message_end",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "你好" }],
				stopReason: "stop",
				usage: FULL_USAGE,
				timestamp: 1,
			},
		} as unknown as AgentSessionEvent);
		translate(host, {
			type: "turn_end",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "你好" }],
				stopReason: "stop",
				usage: FULL_USAGE,
				timestamp: 1,
			},
			toolResults: [],
		} as unknown as AgentSessionEvent);
		agentEnd(host, false);
	}

	it("llm_call 条目：turn 边界/TTFT/usage 全字段/stopReason", () => {
		const { ledger, calls } = createFakeLedger();
		const { session } = createLedgerSession();
		driveTurn(createLedgerHost(session, () => { }, ledger));

		const call = calls.find((c) => c.kind === "llm_call");
		expect(call).toBeDefined();
		const data = call?.data as {
			turnIndex: number;
			startedAt: number;
			endedAt: number;
			ttftMs?: number;
			stopReason?: string;
			usage?: Record<string, unknown>;
			runId?: string;
		};
		expect(data.turnIndex).toBe(0);
		expect(data.runId).toBe("run-1");
		expect(data.endedAt).toBeGreaterThanOrEqual(data.startedAt);
		expect(typeof data.ttftMs).toBe("number");
		expect(data.stopReason).toBe("stop");
		expect(data.usage).toMatchObject({
			input: 100,
			reasoning: 6,
			cacheWrite1h: 4,
			costBreakdown: { input: 0.001, output: 0.002, cacheRead: 0.0004, cacheWrite: 0.0001 },
		});
	});

	it("assistant_done 的 usage 与台账同一份全字段翻译（reasoning/cacheWrite1h/costBreakdown）", () => {
		const events: SessionEvent[] = [];
		const { ledger } = createFakeLedger();
		const { session } = createLedgerSession();
		driveTurn(createLedgerHost(session, (e) => events.push(e), ledger));

		const done = events.find((e) => e.type === "assistant_done");
		expect(done?.type === "assistant_done" && done.message.usage).toMatchObject({
			reasoning: 6,
			cacheWrite1h: 4,
			cost: 0.0035,
			costBreakdown: { input: 0.001, output: 0.002, cacheRead: 0.0004, cacheWrite: 0.0001 },
		});
	});

	it("tool_call 条目是执行期口径（execution_start → end），不含参数生成期", () => {
		const { ledger, calls } = createFakeLedger();
		const { session } = createLedgerSession();
		const host = createLedgerHost(session, () => { }, ledger);

		runStarted(host);
		translate(host, {
			type: "tool_execution_start",
			toolCallId: "c1",
			toolName: "grep",
			args: { pattern: "foo" },
		} as unknown as AgentSessionEvent);
		translate(host, {
			type: "tool_execution_end",
			toolCallId: "c1",
			toolName: "grep",
			isError: false,
			result: { content: [{ type: "text", text: "命中 3 处" }] },
		} as unknown as AgentSessionEvent);

		const data = calls.find((c) => c.kind === "tool_call")?.data as {
			toolCallId: string;
			toolName: string;
			summary: string;
			startedAt: number;
			endedAt: number;
			outcome: string;
			runId?: string;
		};
		expect(data).toMatchObject({
			toolCallId: "c1",
			toolName: "grep",
			summary: "foo",
			outcome: "ok",
			runId: "run-1",
		});
		expect(data.endedAt).toBeGreaterThanOrEqual(data.startedAt);
	});

	it("compaction_end → 台账 compaction（reason/tokensBefore/aborted）", () => {
		const { ledger, calls } = createFakeLedger();
		const { session } = createLedgerSession();
		const host = createLedgerHost(session, () => { }, ledger);

		runStarted(host);
		translate(host, {
			type: "compaction_end",
			reason: "threshold",
			result: { tokensBefore: 12345 },
			aborted: false,
			willRetry: true,
		} as unknown as AgentSessionEvent);

		expect(calls.find((c) => c.kind === "compaction")?.data).toEqual({
			reason: "threshold",
			tokensBefore: 12345,
			aborted: false,
		});
	});
});

describe("压缩事件转发（会话流尾部状态行）", () => {
	it("run 内自动压缩：compaction_start → compaction_started；end → compaction_finished，且不发 run_finished", () => {
		const events: SessionEvent[] = [];
		const { ledger } = createFakeLedger();
		const { session } = createLedgerSession();
		const host = createLedgerHost(session, (e) => events.push(e), ledger);

		runStarted(host);
		translate(host, { type: "compaction_start", reason: "threshold" } as unknown as AgentSessionEvent);
		translate(host, {
			type: "compaction_end",
			reason: "threshold",
			aborted: false,
			willRetry: true,
		} as unknown as AgentSessionEvent);

		const started = events.find((e) => e.type === "compaction_started");
		expect(started).toMatchObject({ reason: "threshold" });
		const finished = events.find((e) => e.type === "compaction_finished");
		expect(finished).toMatchObject({ aborted: false });
		// run 内的流式态归原 run 管，压缩结束不落 run 终态。
		expect(events.some((e) => e.type === "run_finished")).toBe(false);
	});

	it("空闲手动压缩：既有 run 记账不回归，且 compaction_started 在 session_state 之后发", () => {
		const events: SessionEvent[] = [];
		const { ledger } = createFakeLedger();
		const { session } = createLedgerSession();
		const host = createLedgerHost(session, (e) => events.push(e), ledger);

		// 不先 runStarted：模拟空闲时的手动压缩（pi 的 compact()）。
		translate(host, { type: "compaction_start", reason: "manual" } as unknown as AgentSessionEvent);

		expect(events.some((e) => e.type === "run_started")).toBe(true);
		const stateIdx = events.findIndex((e) => e.type === "session_state");
		const startedIdx = events.findIndex((e) => e.type === "compaction_started");
		expect(stateIdx).toBeGreaterThanOrEqual(0);
		// 顺序口径（见 session-host.ts）：started 必须在 session_state 之后，
		// 否则会被紧随的 state 重推清掉（reducer 对 session_state 清瞬态压缩态）。
		expect(startedIdx).toBeGreaterThan(stateIdx);

		translate(host, {
			type: "compaction_end",
			reason: "manual",
			aborted: false,
			willRetry: false,
		} as unknown as AgentSessionEvent);

		expect(events.some((e) => e.type === "compaction_finished")).toBe(true);
		expect(events.some((e) => e.type === "run_finished")).toBe(true);
	});

	it("中断/失败的压缩：compaction_finished 带 aborted / errorMessage，run 落 run_error", () => {
		const events: SessionEvent[] = [];
		const { ledger } = createFakeLedger();
		const { session } = createLedgerSession();
		const host = createLedgerHost(session, (e) => events.push(e), ledger);

		translate(host, { type: "compaction_start", reason: "manual" } as unknown as AgentSessionEvent);
		translate(host, {
			type: "compaction_end",
			reason: "manual",
			aborted: false,
			errorMessage: "摘要生成失败",
			willRetry: false,
		} as unknown as AgentSessionEvent);

		expect(events.find((e) => e.type === "compaction_finished")).toMatchObject({
			aborted: false,
			errorMessage: "摘要生成失败",
		});
		expect(events.some((e) => e.type === "run_error")).toBe(true);
	});
});

describe("request_snapshot（transformContext 钩子）", () => {
	it("钩子原样透传不改写，台账记分段 provenance 与消息分类计数（不记正文）", async () => {
		const { ledger, calls } = createFakeLedger();
		const { session, agent } = createLedgerSession();
		createLedgerHost(session, () => { }, ledger, [
			{ source: "skeleton", chars: 500 },
			{ source: "mode:craft", chars: 120 },
		]);

		const messages = [
			{ role: "user", content: "写个月报", timestamp: 1 },
			{
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "想想" },
					{ type: "text", text: "好的" },
				],
				timestamp: 2,
			},
			{
				role: "toolResult",
				toolCallId: "c1",
				toolName: "read",
				content: [{ type: "text", text: "文件内容" }],
				isError: false,
				timestamp: 3,
			},
			{ role: "compactionSummary", summary: "早前压缩摘要", tokensBefore: 100, timestamp: 4 },
		];
		const hooked = agent.transformContext;
		expect(hooked).toBeDefined();
		const returned = await hooked?.(messages, undefined);

		// 透传：返回值就是传入的同一数组（pi 的 emitContext 透传形态），不做任何改写。
		expect(returned).toBe(messages);

		const snap = calls.find((c) => c.kind === "request_snapshot")?.data as {
			systemSegments?: readonly { source: string; chars: number }[];
			messages: Record<string, { count: number; chars: number }>;
		};
		expect(snap.systemSegments).toEqual([
			{ source: "skeleton", chars: 500 },
			{ source: "mode:craft", chars: 120 },
		]);
		expect(snap.messages["user"]).toEqual({ count: 1, chars: 4 });
		expect(snap.messages["assistant"]).toEqual({ count: 1, chars: 4 });
		expect(snap.messages["toolResult"]).toEqual({ count: 1, chars: 4 });
		expect(snap.messages["other"]).toEqual({ count: 1, chars: 6 });
		// 不记正文：快照里没有任何消息文本。
		expect(JSON.stringify(snap)).not.toContain("写个月报");
	});

	it("无组装来源（未注入 getSystemPromptSegments）→ systemSegments 键缺席", async () => {
		const { ledger, calls } = createFakeLedger();
		const { session, agent } = createLedgerSession();
		createLedgerHost(session, () => { }, ledger);

		await agent.transformContext?.([{ role: "user", content: "hi", timestamp: 1 }], undefined);

		const snap = calls.find((c) => c.kind === "request_snapshot")?.data as unknown as
			| Record<string, unknown>
			| undefined;
		expect(snap !== undefined && "systemSegments" in snap).toBe(false);
	});
});

/* ── 流式 delta 合批（spec: optimize-stream-rendering Task 2）───────────── */

type AssistantStartedEvent = Extract<SessionEvent, { type: "assistant_started" }>;
type TextDeltaEvent = Extract<SessionEvent, { type: "assistant_text_delta" }>;
type ThinkingDeltaEvent = Extract<SessionEvent, { type: "assistant_thinking_delta" }>;

/** 驱动一次 message_update 的正文/思考 delta（partial 内容对合批无意义，给空）。 */
function streamDelta(
	host: SessionHost,
	inner: { type: "text_delta" | "thinking_delta"; delta: string },
): void {
	translate(host, {
		type: "message_update",
		assistantMessageEvent: { ...inner, partial: { content: [] } },
	} as unknown as AgentSessionEvent);
}

/** 按到达顺序抽出 delta 事件（类型 + 拼接后的 delta），用于断言分界与顺序。 */
function deltaTrace(events: readonly SessionEvent[]): readonly (readonly [string, string])[] {
	return events
		.filter(
			(e): e is TextDeltaEvent | ThinkingDeltaEvent =>
				e.type === "assistant_text_delta" || e.type === "assistant_thinking_delta",
		)
		.map((e) => [e.type === "assistant_text_delta" ? "text" : "thinking", e.delta] as const);
}

/**
 * 合批正确性的三条不变量：
 * 1. 连续同类型 delta 合并为一条 emit，`delta` 为拼接结果；
 * 2. 类型切换 / message_end / turn 结束（含 abort）都必须 flush —— 不丢最后一批、不串序；
 * 3. 合批后的拼接结果与「逐个 emit」逐字一致（对拍）。
 */
describe("流式 delta 合批（16ms 窗口）", () => {
	/** 每个用例自带假定时器并在 finally 还原，避免污染同文件其它用例。 */
	function withFakeTimers(run: () => void): void {
		vi.useFakeTimers();
		try {
			run();
		} finally {
			vi.useRealTimers();
		}
	}

	it("连续同类型 delta 在窗口到期时合并为一条 emit，delta 为拼接结果", () => {
		withFakeTimers(() => {
			const events: SessionEvent[] = [];
			const host = createHost(createFakeSession(), (e) => events.push(e));
			assistantStart(host);
			const id = events.find((e): e is AssistantStartedEvent => e.type === "assistant_started")
				?.messageId;

			streamDelta(host, { type: "text_delta", delta: "你" });
			streamDelta(host, { type: "text_delta", delta: "好" });
			streamDelta(host, { type: "text_delta", delta: "呀" });

			// 窗口未到期：一条都不发（合批生效，不是逐 token 上屏）。
			expect(deltaTrace(events)).toEqual([]);

			vi.advanceTimersByTime(16);

			expect(deltaTrace(events)).toEqual([["text", "你好呀"]]);
			const emitted = events.find((e): e is TextDeltaEvent => e.type === "assistant_text_delta");
			// messageId 与 assistant_started 一致：合批不改定位契约。
			expect(emitted?.messageId).toBe(id);
		});
	});

	it("类型切换先 flush：思考与正文的到达顺序与内容边界不变", () => {
		withFakeTimers(() => {
			const events: SessionEvent[] = [];
			const host = createHost(createFakeSession(), (e) => events.push(e));
			assistantStart(host);

			streamDelta(host, { type: "thinking_delta", delta: "让我" });
			streamDelta(host, { type: "thinking_delta", delta: "想想" });
			streamDelta(host, { type: "text_delta", delta: "答案是" });
			streamDelta(host, { type: "text_delta", delta: " 42" });

			// 切到正文的那一刻，思考那批立即发出（不等窗口到期）。
			expect(deltaTrace(events)).toEqual([["thinking", "让我想想"]]);

			vi.advanceTimersByTime(16);
			expect(deltaTrace(events)).toEqual([
				["thinking", "让我想想"],
				["text", "答案是 42"],
			]);
		});
	});

	it("message_end 强制 flush：最后一批不丢，且在终态校正（assistant_done）之前", () => {
		withFakeTimers(() => {
			const events: SessionEvent[] = [];
			const host = createHost(createFakeSession(), (e) => events.push(e));
			assistantStart(host);
			streamDelta(host, { type: "text_delta", delta: "最后半句" });

			// 不推进定时器，直接收消息：必须由 message_end 把最后一批逼出来。
			assistantEnd(host, "stop", { text: "最后半句" });

			expect(deltaTrace(events)).toEqual([["text", "最后半句"]]);
			const deltaIdx = events.findIndex((e) => e.type === "assistant_text_delta");
			const doneIdx = events.findIndex((e) => e.type === "assistant_done");
			expect(deltaIdx).toBeGreaterThanOrEqual(0);
			expect(deltaIdx).toBeLessThan(doneIdx);
		});
	});

	it("中断路径 flush：aborted 收尾时已缓冲的 delta 仍送达（不丢半句）", () => {
		withFakeTimers(() => {
			const events: SessionEvent[] = [];
			const host = createHost(createFakeSession(), (e) => events.push(e));
			runStarted(host);
			assistantStart(host);
			streamDelta(host, { type: "thinking_delta", delta: "想了半句" });
			streamDelta(host, { type: "text_delta", delta: "答了半" });

			// pi 的 abort 收尾：message_end（stopReason=aborted）→ agent_end（判为 cancelled）。
			assistantEnd(host, "aborted", { errorMessage: "Request was aborted" });
			agentEnd(host, false, [{ role: "assistant", stopReason: "aborted" }]);

			expect(deltaTrace(events)).toEqual([
				["thinking", "想了半句"],
				["text", "答了半"],
			]);
			const deltaIdx = events.findIndex((e) => e.type === "assistant_text_delta");
			const doneIdx = events.findIndex((e) => e.type === "assistant_done");
			expect(deltaIdx).toBeLessThan(doneIdx);
			expect(events.find((e) => e.type === "run_finished")).toMatchObject({ outcome: "cancelled" });
		});
	});

	it("agent_end 强制 flush：没有配对 message_end 的收尾也不会丢已缓冲的 delta", () => {
		withFakeTimers(() => {
			const events: SessionEvent[] = [];
			const host = createHost(createFakeSession(), (e) => events.push(e));
			runStarted(host);
			assistantStart(host);
			streamDelta(host, { type: "text_delta", delta: "残留" });

			agentEnd(host, false, []);

			expect(deltaTrace(events)).toEqual([["text", "残留"]]);
		});
	});

	it("对拍：合批后按类型拼接的结果与未合批（逐字 delta）逐字一致", () => {
		const script: readonly { readonly type: "text_delta" | "thinking_delta"; readonly delta: string }[] = [
			{ type: "thinking_delta", delta: "先" },
			{ type: "thinking_delta", delta: "想" },
			{ type: "text_delta", delta: "你" },
			{ type: "text_delta", delta: "好" },
			{ type: "thinking_delta", delta: "再" },
			{ type: "text_delta", delta: "，" },
			{ type: "text_delta", delta: "世界" },
		];
		// 参照实现：逐个 delta 原样拼接（等价于未合批的逐个 emit 在 renderer 侧累积）。
		const reference = {
			text: script.filter((d) => d.type === "text_delta").map((d) => d.delta).join(""),
			thinking: script.filter((d) => d.type === "thinking_delta").map((d) => d.delta).join(""),
		};

		withFakeTimers(() => {
			const events: SessionEvent[] = [];
			const host = createHost(createFakeSession(), (e) => events.push(e));
			assistantStart(host);
			for (const d of script) streamDelta(host, d);
			assistantEnd(host, "stop", { text: reference.text });

			const actual = {
				text: events
					.filter((e): e is TextDeltaEvent => e.type === "assistant_text_delta")
					.map((e) => e.delta)
					.join(""),
				thinking: events
					.filter((e): e is ThinkingDeltaEvent => e.type === "assistant_thinking_delta")
					.map((e) => e.delta)
					.join(""),
			};
			expect(actual).toEqual(reference);

			// 7 个 delta 被压成 4 条事件（think/text/think/text 四次类型切换）。
			expect(deltaTrace(events)).toHaveLength(4);
			expect(deltaTrace(events).length).toBeLessThan(script.length);
		});
	});
});

describe("hidden context（transformContext 注入，F5）", () => {
	it("prompt 冻结注入块：workspace_context + 专家 + current_time 前置在最后一条 user 消息之前", async () => {
		const events: SessionEvent[] = [];
		const { ledger } = createFakeLedger();
		const { session, agent } = createLedgerSession();
		(session as { prompt?: () => Promise<void> }).prompt = async () => {};
		const host = createLedgerHost(session, (e) => events.push(e), ledger, undefined, "前端开发");
		await host.prompt("你好");

		const hooked = agent.transformContext;
		expect(hooked).toBeDefined();
		const out = (await hooked?.([
			{ role: "user", content: "早前的对话", timestamp: 1 },
			{ role: "assistant", content: "回复", timestamp: 2 },
			{ role: "user", content: "你好", timestamp: 3 },
		])) as { role: string; content: string }[];

		const last = out[out.length - 1];
		expect(last?.role).toBe("user");
		const content = String(last?.content);
		// 隐藏块前置在用户正文之前；三类段齐全
		expect(content.indexOf('data-role="user-context"')).toBeLessThan(content.indexOf("你好"));
		expect(content).toContain("工作目录：C:\\test");
		expect(content).toContain("专家：前端开发");
		expect(content).toContain("<current_time>");
		// 前面的消息不动（注入只落在最后一条 user 上）
		expect(out[0]?.content).toBe("早前的对话");
	});

	it("agent_end 清账：run 结束后同一钩子不再注入", async () => {
		const events: SessionEvent[] = [];
		const { ledger } = createFakeLedger();
		const { session, agent } = createLedgerSession();
		(session as { prompt?: () => Promise<void> }).prompt = async () => {};
		const host = createLedgerHost(session, (e) => events.push(e), ledger);
		await host.prompt("你好");
		runStarted(host);
		agentEnd(host, false);

		const out = (await agent.transformContext?.([
			{ role: "user", content: "你好", timestamp: 1 },
		])) as { role: string; content: string }[];
		expect(out[0]?.content).toBe("你好");
	});

	it("peekHiddenContext：run 结束后仍可读最近一次注入全文（展示语义，不随 pendingHidden 清账）", async () => {
		const events: SessionEvent[] = [];
		const { ledger } = createFakeLedger();
		const { session } = createLedgerSession();
		(session as { prompt?: () => Promise<void> }).prompt = async () => {};
		const host = createLedgerHost(session, (e) => events.push(e), ledger);
		// 还没跑过任何一轮：undefined
		expect(host.peekHiddenContext()).toBeUndefined();

		await host.prompt("你好");
		const frozen = host.peekHiddenContext();
		expect(frozen).toBeDefined();
		expect(frozen).toContain("workspace_context");

		runStarted(host);
		agentEnd(host, false);
		// pendingHidden 已清（transformContext 不再注入），但展示口仍在
		expect(host.peekHiddenContext()).toBe(frozen);
	});

	it("request_snapshot 带上 hiddenContextChars（注入后记快照，拆出来亮明）", async () => {
		const events: SessionEvent[] = [];
		const { ledger, calls } = createFakeLedger();
		const { session, agent } = createLedgerSession();
		(session as { prompt?: () => Promise<void> }).prompt = async () => {};
		const host = createLedgerHost(session, (e) => events.push(e), ledger, [
			{ source: "skeleton", chars: 10 },
		]);
		await host.prompt("你好");
		// run 进行中记快照（真实时序：transformContext 发生在 agent_start 之后）
		runStarted(host);
		await agent.transformContext?.([{ role: "user", content: "你好", timestamp: 1 }]);

		const snapshot = calls.find((c) => c.kind === "request_snapshot")?.data as
			| { hiddenContextChars?: number; messages?: unknown }
			| undefined;
		expect(snapshot).toBeDefined();
		// 注入块字符数 = 注入后 user 消息里多出来的那部分，面板成分视图靠它单列一行
		expect(snapshot?.hiddenContextChars).toBeGreaterThan(0);
	});
});

describe("专家 extraTools 工具面联动（spec: add-team-foundations）", () => {
	const MODES: readonly ModeResource[] = [
		{ id: "ask", label: "问答", description: "", ready: true, tools: ["read"], body: "" },
		{ id: "craft", label: "执行", description: "", ready: true, tools: ["read", "write"], body: "" },
	];

	function createExtraToolsHost(opts: {
		interactionId: string;
		expertId?: string;
		getExtra: () => readonly string[] | undefined;
	}): { host: SessionHost; toolCalls: readonly (readonly string[])[] } {
		const toolCalls: string[][] = [];
		const session = {
			sessionId: "test-session",
			model: undefined,
			isStreaming: false,
			getContextUsage: () => undefined,
			thinkingLevel: "off",
			getAvailableThinkingLevels: () => ["off"],
			setActiveToolsByName: (tools: readonly string[]) => {
				toolCalls.push([...tools]);
			},
		};
		const options: SessionHostOptions = {
			catalog: {} as unknown as ModelCatalog,
			modelKey: undefined,
			cwd: "C:\\test",
			isTempTask: false,
			sceneId: "work",
			interactionId: opts.interactionId,
			...(opts.expertId === undefined ? {} : { expertId: opts.expertId }),
			emit: () => {},
			resources: { scenes: [], modes: MODES, styles: [], fragments: new Map() },
			getExpertExtraTools: opts.getExtra,
		};
		const Ctor = SessionHost as unknown as new (
			session: unknown,
			options: SessionHostOptions,
			sceneId: string,
			interactionId: string,
			expertId: string | undefined,
			skills: readonly unknown[],
		) => SessionHost;
		const host = new Ctor(session, options, "work", opts.interactionId, opts.expertId ?? undefined, []);
		return { host, toolCalls };
	}

	it("setExpert 应用追加工具：模式白名单 ∪ extraTools，重复项去重", () => {
		const { host, toolCalls } = createExtraToolsHost({
			interactionId: "craft",
			getExtra: () => ["task", "write"],
		});
		host.setExpert("fin");
		expect(toolCalls.at(-1)).toEqual(["read", "write", "task"]);
	});

	it("清除专家 → resolver 已不返回追加集，回到纯模式白名单", () => {
		// 生产契约：INVOKE.setExpert 先 updateStateLocally（桶状态落新绑定），
		// 再调 host.setExpert —— resolver 读桶状态，此刻已看不到旧专家。
		let bound = true;
		const { host, toolCalls } = createExtraToolsHost({
			interactionId: "craft",
			expertId: "fin",
			getExtra: () => (bound ? ["task"] : undefined),
		});
		bound = false;
		host.setExpert(undefined);
		expect(toolCalls.at(-1)).toEqual(["read", "write"]);
	});

	it("切交互模式保留追加工具（切模式不清专家的 extraTools）", () => {
		const { host, toolCalls } = createExtraToolsHost({
			interactionId: "craft",
			getExtra: () => ["task"],
		});
		host.setInteraction("ask");
		expect(toolCalls.at(-1)).toEqual(["read", "task"]);
	});

	it("resolver 返回 undefined（未声明 extraTools）→ 纯模式白名单，与现状一致", () => {
		const { host, toolCalls } = createExtraToolsHost({
			interactionId: "ask",
			getExtra: () => undefined,
		});
		host.setExpert("fin");
		expect(toolCalls.at(-1)).toEqual(["read"]);
	});
});
