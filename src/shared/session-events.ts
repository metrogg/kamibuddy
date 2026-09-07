/**
 * 会话领域事件 —— 渲染进程唯一认识的事件类型。
 *
 * 这是 ARCHITECTURE.md §4.7 里「pi SDK 边界」那道缝的实体：
 * pi 的 AgentSessionEvent 在 core/adapter.ts 里被翻译成这里的类型，
 * 之后就不再有任何 pi 概念流向 UI。pi 升级只会塌 adapter 一个文件。
 *
 * 设计取向：这些事件是**给 UI 渲染用的**，不是 pi 事件的忠实转录。
 * pi 一次 prompt 会发 agent_start / turn_start / message_start / message_update /
 * message_end / turn_end / agent_end 一整套，其中 turn 级别的边界对 UI 没有意义
 * （用户看到的是一条条消息和工具卡片，不是"轮"），所以在 adapter 里被吞掉。
 */

import type { TokenUsage } from "./observability.ts";
import type { ContextUsageDetail } from "./context-usage.ts";
import type { FileChange } from "./artifacts.ts";

/** 一次用户提问到 agent 停止之间的完整过程。 */
export type RunId = string;

/** 助手消息或工具卡片在 UI 上的稳定标识。 */
export type MessageId = string;
export type ToolCallId = string;

/** 工具执行的最终状态。 */
export type ToolOutcome = "ok" | "error" | "blocked" | "aborted";

export interface UserMessage {
	readonly id: MessageId;
	readonly role: "user";
	readonly text: string;
	/** epoch ms。由 daemon 打点，UI 不自己取时间（保证重放时时间一致）。 */
	readonly at: number;
}

export interface AssistantMessage {
	readonly id: MessageId;
	readonly role: "assistant";
	readonly text: string;
	/** 思考内容。模型未输出思考时为 undefined，不要用空串代替。 */
	readonly thinking?: string;
	/**
	 * 本条消息对应的模型调用用量（pi 的 AssistantMessage.usage 翻译而来）。
	 * 聊天 UI 不展示它——它服务于诊断页的 run 级聚合（shared/observability.ts）。
	 * 出错中断等无完整响应的场景为 undefined。
	 */
	readonly usage?: TokenUsage;
	readonly at: number;
}

export interface ToolCard {
	readonly id: ToolCallId;
	readonly role: "tool";
	readonly toolName: string;
	/** 面向用户的短标题，如「读取文件」。由工具自己声明，不在 UI 里硬编码映射表。 */
	readonly label: string;
	/** 一行摘要，如文件路径或命令。折叠态只显示这个。 */
	readonly summary: string;
	readonly outcome: ToolOutcome | undefined;
	/** 展开态显示的正文。大输出已在 daemon 侧截断，UI 不做二次防御。 */
	readonly detail: string | undefined;
	/**
	 * 写文件工具（write/edit）的增删行统计，执行成功时由 session-host 从 args 算出。
	 * 产物清单（collectArtifacts）与 +/- 徽章都以此为唯一来源。
	 */
	readonly change?: FileChange;
	readonly at: number;
}

export type ConversationEntry = UserMessage | AssistantMessage | ToolCard;

/** daemon → renderer 的单向事件流。 */
export type SessionEvent =
	/** 一次 run 开始。UI 据此进入 streaming 态（禁用输入、显示中断按钮）。 */
	| { readonly type: "run_started"; readonly runId: RunId }
	/** 用户消息已落入会话历史。回显由 daemon 确认而非 UI 乐观插入，避免与队列/改写行为不一致。 */
	| { readonly type: "user_message"; readonly message: UserMessage }
	/** 助手开始一条新消息。UI 据此插入一个空气泡。 */
	| { readonly type: "assistant_started"; readonly messageId: MessageId; readonly at: number }
	/** 正文增量。UI 追加，不整条替换——整条替换在长回复下会导致明显卡顿。 */
	| { readonly type: "assistant_text_delta"; readonly messageId: MessageId; readonly delta: string }
	/** 思考增量。 */
	| { readonly type: "assistant_thinking_delta"; readonly messageId: MessageId; readonly delta: string }
	/** 助手消息完成，带终全文。UI 用它做一次校正，覆盖累积的增量。 */
	| { readonly type: "assistant_done"; readonly message: AssistantMessage }
	/** 工具开始执行。 */
	| { readonly type: "tool_started"; readonly card: ToolCard }
	/** 工具流式输出（如命令 stdout）。 */
	| { readonly type: "tool_progress"; readonly id: ToolCallId; readonly delta: string }
	/** 工具执行结束。 */
	| { readonly type: "tool_finished"; readonly card: ToolCard }
	/** run 正常结束。 */
	| { readonly type: "run_finished"; readonly runId: RunId }
	/**
	 * run 异常结束。message 是给用户看的，不要塞 stack。
	 * 诊断信息走 daemon 侧日志，不经 UI。
	 */
	| { readonly type: "run_error"; readonly runId: RunId; readonly message: string }
	/** 会话元信息变化（模型切换、模式切换、token 用量）。 */
	| { readonly type: "session_state"; readonly state: SessionState }
	/**
	 * 上下文用量明细（used/total 精确 + 分类估算）。在带用量的 session_state 之后
	 * 由 daemon 组装发出 —— 分类所需的系统提示词/技能段 token 只有 daemon 知道。
	 */
	| { readonly type: "context_usage"; readonly usage: ContextUsageDetail };

/**
 * 会话的当前状态。变化时整体重发——字段少，不值得做差量。
 *
 * 模式是**两个正交的轴**，照 WorkBuddy 的结构来（其内置插件目录即证据）：
 *
 *   场景轴 welcomemode/  work / code / design      各带 agents/<name>.md 根代理
 *   交互轴 interactionmode/  ask / craft / plan / expert   各带 fragments/*.md 提示片段
 *
 * 系统提示词是两轴共同的函数：场景模板 include 交互片段。
 * 所以两者都要存，不能压成一个 modeId —— 否则 D4-5 写提示词时必然返工。
 */
export interface SessionState {
	readonly sessionId: string;
	/**
	 * 会话工作目录。playground 会话（isPlayground=true）为 undefined：
	 * 不绑定任何本地目录，也不加载文件工具（WorkBuddy 的 cwd="" 同语义）。
	 */
	readonly cwd: string | undefined;
	/**
	 * 是否为 playground 会话（WorkBuddy 的「不使用工作空间」）。
	 * 每次新建任务默认进入 playground —— 不选空间时不该默认写进某个公共目录。
	 */
	readonly isPlayground: boolean;
	/** 场景 id，对应 resources/scenes/<id>/。决定根代理与可用能力面。 */
	readonly sceneId: string;
	/** 交互模式 id，对应 resources/modes/<id>.md。决定工具白名单与行为片段。 */
	readonly interactionId: string;
	readonly modelId: string | undefined;
	readonly isStreaming: boolean;
	/** 上下文占用。undefined 表示尚未有过一次请求。 */
	readonly contextUsage?: {
		readonly usedTokens: number;
		readonly maxTokens: number;
	};
}

/** 渲染进程挂载或热重载后拉取的完整状态。 */
export interface SessionSnapshot {
	readonly state: SessionState;
	readonly entries: readonly ConversationEntry[];
	/** 可选场景，供首页页签渲染。 */
	readonly availableScenes: readonly ModeDescriptor[];
	/** 可选交互模式，供对话页切换器渲染。 */
	readonly availableModes: readonly ModeDescriptor[];
	/** 最近的上下文用量明细。还没有过带用量的响应时为 undefined。 */
	readonly usageDetail?: ContextUsageDetail;
}

/**
 * 一个场景或交互模式的展示信息。
 * 工具白名单不下发到 UI —— 那是 daemon 的判定依据，UI 不需要也不该知道。
 */
export interface ModeDescriptor {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	/** 该项是否已实现。未实现的仍然显示（对齐 WorkBuddy 的能力面），点击给明确反馈。 */
	readonly ready: boolean;
}
