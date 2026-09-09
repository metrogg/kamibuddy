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
import type { ArtifactRef, FileChange, PresentedFile } from "./artifacts.ts";
import type { ImagePart } from "./image.ts";

/** 一次用户提问到 agent 停止之间的完整过程。 */
export type RunId = string;

/** 助手消息或工具卡片在 UI 上的稳定标识。 */
export type MessageId = string;
export type ToolCallId = string;

/** 工具执行的最终状态。 */
export type ToolOutcome = "ok" | "error" | "blocked" | "aborted";

/**
 * run 的结束方式。
 *
 * 中断与正常结束在 UI 上是两种终态：中断要留下「用户已取消」指示行、
 * 回合计时定格为「已取消 Ns」，而正常结束只显示「已完成」。
 * pi 侧没有独立的「已取消」事件（abort 后 agent 循环照常收尾，区别只在
 * 最后一条 assistant 消息的 stopReason），所以结束方式由适配层判定后随
 * run_finished 下发。
 */
export type RunOutcome = "completed" | "cancelled";

export interface UserMessage {
	readonly id: MessageId;
	readonly role: "user";
	readonly text: string;
	/** epoch ms。由 daemon 打点，UI 不自己取时间（保证重放时时间一致）。 */
	readonly at: number;
	/** 本条消息携带的图片附件（仅用于 UI 展示缩略图）。 */
	readonly images?: readonly ImagePart[];
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
	 * 写文件工具（write/edit）的增删行统计。
	 * 生成阶段（generating）是流式实时计数（writeStreamProgress 从半截 JSON 数行），
	 * 执行成功后是 session-host 从完整 args 算出的终值。
	 * 产物清单（collectArtifacts）以 outcome==="ok" 为门槛，两个口径不会混。
	 */
	readonly change?: FileChange;
	/**
	 * 生成中 = 模型还在流式输出本调用的参数。
	 *
	 * 写文件时文件内容全在参数里，这段是整个调用生命周期里最长的一段
	 * （几十秒），而执行（写盘）是毫秒级 —— 卡片必须在这段就上屏
	 * （WorkBuddy 的「生成中 +N」），否则生成过程在 UI 上是黑洞。
	 * tool_execution_start 到达时该标记消失（进入执行态）。
	 */
	readonly generating?: boolean;
	readonly at: number;
}

/**
 * run 异常结束的错误条目（run_error 折叠而来）。
 *
 * 错误是消息流的一部分：渲染为内嵌错误卡，新回合开始后仍留在历史原位
 * （与 WorkBuddy 的错误卡机制一致）。不落 assistant 角色的原因：错误文本
 * 不是模型输出，混进 assistant 会被 Markdown 渲染、被上下文估算当成
 * 模型回复计数 —— 两个口径都会失真。
 */
export interface ErrorEntry {
	readonly id: MessageId;
	readonly role: "error";
	/** 给用户看的错误信息（run_error.message，不含 stack）。 */
	readonly message: string;
	/** 出错的 run，错误卡上展示并随结构化报告复制。 */
	readonly runId: RunId;
	readonly at: number;
}

export type ConversationEntry = UserMessage | AssistantMessage | ToolCard | ErrorEntry | ArtifactsPresentedEntry;

/** 产物交付条目（artifacts_presented 折叠而来，恢复会话时由 custom 条目翻译）。 */
export interface ArtifactsPresentedEntry {
	readonly id: MessageId;
	readonly role: "artifacts_presented";
	readonly files: readonly PresentedFile[];
	readonly focusFile: string | undefined;
	readonly at: number;
}

/**
 * 生成中卡片的标签（WorkBuddy tool.writeFile 词汇表：生成中/修改中）。
 * write 分新建（生成中）与覆盖已有文件（修改中），edit 恒修改中。
 * 放在契约层而非某端：reducer（流式进度里随 changeType 更新）与
 * session-host（首发卡片）共用，两端不会漂。
 */
export function generatingLabel(toolName: string, changeType: "created" | "modified"): string {
	if (toolName === "edit") return "修改中";
	if (toolName === "write") return changeType === "created" ? "生成中" : "修改中";
	return toolName;
}

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
	/**
	 * 工具调用开始**生成**（模型正在流式输出参数）。卡片从这一刻上屏，
	 * 而不是等到执行 —— 写文件时参数里就是文件内容，生成阶段几十秒、
	 * 执行毫秒级，等执行才上屏等于整段生成不可见。
	 * 卡片 id 与 tool_started/tool_finished 相同（pi 的 toolCallId），
	 * 后续事件在同一张卡上原位更新。
	 */
	| { readonly type: "tool_stream_started"; readonly card: ToolCard }
	/**
	 * write 参数流式生成中的进度：path 完整后才出现（半截路径不该上屏），
	 * added 为当前已生成行数。只有 write 发这个事件 —— edit 的参数是
	 * 嵌套结构，流式数行成本高而收益低，生成中只显示卡片本身。
	 * changeType 由 daemon 在 path 完整时查文件是否存在得出（新建/覆盖），
	 * 与终态 FileChange.changeType 同口径。
	 */
	| {
			readonly type: "tool_stream_progress";
			readonly id: ToolCallId;
			readonly path: string | undefined;
			readonly added: number;
			readonly changeType: "created" | "modified";
	  }
	/** 工具开始执行（参数已生成完毕）。同 id 的生成中卡片原位翻转为执行态。 */
	| { readonly type: "tool_started"; readonly card: ToolCard }
	/** 工具流式输出（如命令 stdout）。 */
	| { readonly type: "tool_progress"; readonly id: ToolCallId; readonly delta: string }
	/** 工具执行结束。 */
	| { readonly type: "tool_finished"; readonly card: ToolCard }
	/** run 结束。outcome 区分正常完成与用户取消（取消语义见 RunOutcome 注释）。 */
	| { readonly type: "run_finished"; readonly runId: RunId; readonly outcome: RunOutcome }
	/**
	 * present_files 工具交付产物（唯一交付入口，WorkBuddy 同口径）。
	 * 由工具 execute 内发出（先于该工具卡的 finished）：产物清单即刻更新，
	 * focusFile（首个本地文件）由渲染进程自动在预览面板打开。
	 */
	| {
			readonly type: "artifacts_presented";
			readonly files: readonly PresentedFile[];
			readonly focusFile: string | undefined;
	  }
	/**
	 * run 异常结束。message 是给用户看的，不要塞 stack。
	 * 诊断信息走 daemon 侧日志，不经 UI。
	 */
	| { readonly type: "run_error"; readonly runId: RunId; readonly message: string }
	/** 会话元信息变化（模型切换、模式切换、token 用量）。 */
	| { readonly type: "session_state"; readonly state: SessionState }
	/**
	 * 会话历史已被 daemon 清空（新建任务 / 切换工作空间）。
	 *
	 * 不能靠 session_state 表达：reducer 对 session_state 只替换 state、
	 * 不动 entries —— daemon 清空历史后若只发 session_state，renderer 会
	 * 一直显示旧 entries（幽灵历史），后续流式事件继续追加在这份错误历史上。
	 * /new 内置命令正是这样漂移的（侧栏「新建任务」有 resyncSnapshot 补救，
	 * /new 没有）。走事件而不是让 renderer 重拉快照：两端共用同一个 reducer，
	 * 一次折叠两端同步清零，不存在只对齐一端的窗口。
	 */
	| { readonly type: "history_reset" }
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
	 * 会话工作目录。临时任务会话（isTempTask=true）的 cwd 为
	 * 「<生效根>/临时任务」共享临时目录（对齐 WorkBuddy 的 <root>/Claw），
	 * 或默认根本身（与临时目录同等待遇，都是「非命名空间」）。
	 * undefined 仅出现在会话尚未建立的初始瞬态。
	 */
	readonly cwd: string | undefined;
	/**
	 * 是否为临时任务会话（未绑定命名工作空间）。
	 *
	 * 每次新建任务默认即临时任务：落共享临时目录、加载完整工具集、权限门照常 ——
	 * 不再存在「不绑定目录、无文件工具」的 playground 模式（经全面取证，
	 * 那是我们自己的发明，WorkBuddy 并无 cwd="" 语义；其真实模型见 asar
	 * main/server.js 的 resolveDefaultWorkspaceRoot/Claw 目录与
	 * locale 的 workspaceStorage.description）。
	 */
	readonly isTempTask: boolean;
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

/**
 * 当前回合的计时（WorkBuddy 的「已处理 Ns」）。
 * startedAt = 用户消息落库时间（daemon 打点）；endedAt = run 结束时间。
 * endedAt 缺省表示回合还在跑 —— UI 每 500ms 走表，停表后显示「已完成」。
 */
export interface TurnTiming {
	readonly startedAt: number;
	readonly endedAt?: number;
	/**
	 * 本回合是否被用户取消。取消的回合头部定格「已取消 Ns」（endedAt - startedAt），
	 * 而不是「已完成」——中断与正常结束在 UI 终态不同（RunOutcome 注释）。
	 */
	readonly cancelled?: boolean;
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
	/** 当前回合计时。还没有用户消息时为 undefined。 */
	readonly turn?: TurnTiming;
	/**
	 * 被取消回合的起始用户消息 id（reducer 折叠 run_finished cancelled 而来）。
	 * 「用户已取消」指示行要在新回合开始后仍留在历史里该回合末尾，
	 * 单靠当前回合的 turn 做不到（user_message 会重置它），所以逐回合记录。
	 */
	readonly cancelledTurns?: readonly MessageId[];
	/** 本会话已交付的产物（artifacts_presented 折叠而来）。 */
	readonly artifacts: readonly ArtifactRef[];
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
