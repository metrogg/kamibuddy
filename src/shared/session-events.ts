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

import type { SessionStatCard, TokenUsage } from "./observability.ts";
import type { ContextUsageDetail } from "./context-usage.ts";
import type { ArtifactRef, FileChange, PresentedFile } from "./artifacts.ts";
import type { ImagePart } from "./image.ts";
import type { WelcomePresets } from "./welcome.ts";
import type { WorktreeInfo } from "./worktree.ts";

/**
 * 一次用户提问到 agent 停止之间的完整过程。
 *
 * 也是**条目的 run 身份**（UserMessage / AssistantMessage / ToolCard 的
 * `runId`，可选）：reducer 在 `run_started` 之后追加的每条条目上盖上当时的
 * runId（shared/conversation.ts 的 activeRunId），页脚的「本轮」读数与指标
 * 挂点据此按 run 聚合，而不是按「最后一条 user 消息」猜边界 —— steer 会让
 * 一条 user 消息落在 run 中间，按它猜会把整轮切成两半。
 *
 * 可选：恢复路径重建的历史条目（core/session-rebuild.ts）没有 run 身份 ——
 * 会话文件里没有这个记录，不编一个假的身份出来。ErrorEntry 的 runId 必填，
 * 它是 run 的终态产物、身份来自 run_error 事件本身。
 */
export type RunId = string;

/** 助手消息或工具卡片在 UI 上的稳定标识。 */
export type MessageId = string;
export type ToolCallId = string;

/** 工具执行的最终状态。 */
export type ToolOutcome = "ok" | "error" | "blocked" | "aborted";

/**
 * 推理强度七档。与 pi 的 ThinkingLevel **平行定义**，不 import pi 类型 ——
 * 依赖方向规则（AGENTS.md §1.2）：pi 类型只允许出现在 core/ 与 extensions/，
 * 而本文件是 renderer 也 import 的契约层。档位集合与 pi 0.85.1 的
 * THINKING_LEVELS（agent-session.ts）逐一对应；pi 若加档，typecheck 会在
 * core/session-host.ts 的适配处响亮报错，而不是在这里静默漏档。
 */
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/** 全量档位列表（守卫与设置页下拉共用一份，不各写字面量）。 */
const THINKING_LEVELS: readonly ThinkingLevel[] = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
];

/**
 * 运行时守卫：偏好文件与 IPC 入参都是 unknown 进界，
 * 非法值按「未配置」处理（偏好可能被手编，同 webSearch 字段的防御口径）。
 */
export function isThinkingLevel(value: unknown): value is ThinkingLevel {
	return typeof value === "string" && (THINKING_LEVELS as readonly string[]).includes(value);
}

/**
 * 档位中文标签（renderer 的模型菜单 pill 与设置页下拉共用）。
 *
 * 集中一处的先例是工具卡片 label（core/session-host.ts 的 TOOL_*_LABELS）：
 * 词汇表若散在各 UI 组件里必然漂移。与工具卡不同的是归属层——工具卡 label
 * 由 daemon 下发（卡片是数据），档位标签放契约层是因为 SessionState 只携带
 * 档位 id（state 是事实），显示词是 UI 的恒定映射，不占事件流带宽。
 */
export const THINKING_LEVEL_LABELS: Readonly<Record<ThinkingLevel, string>> = {
	off: "关",
	minimal: "极低",
	low: "低",
	medium: "中",
	high: "高",
	xhigh: "极高",
	max: "最大",
};

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
	/**
	 * 本条消息里调用的技能名（`/skill:<name>` 被 pi 展开、由 shared/skill-block.ts
	 * 剥出的结果）。技能正文只进模型上下文、不进 UI —— 气泡按这里的名字渲染胶囊。
	 * 无技能时**不带该字段**，UI 按缺省渲染（口径同 images）。
	 */
	readonly skillNames?: readonly string[];
	/** 所属 run（reducer 盖章，语义见 RunId 注释）。恢复重建的历史条目缺席。 */
	readonly runId?: RunId;
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
	/** 所属 run（reducer 盖章，语义见 RunId 注释）。恢复重建的历史条目缺席。 */
	readonly runId?: RunId;
}

/**
 * todo_write 清单的一项（工具卡的结构化载荷）。
 *
 * 与 extensions/todo-tool.ts 的 TodoItem 同构、各自定义：那份是 pi 工具的
 * details 契约，这份是 UI 渲染契约 —— renderer 只许 import shared（AGENTS.md §1.3），
 * 两处无法共用一个 import 源。字段语义见 todo-tool.ts 的 schema 描述。
 */
export interface TodoItem {
	readonly content: string;
	readonly activeForm?: string;
	readonly status: "pending" | "in_progress" | "completed";
}

/**
 * 一条引用来源（web_search 工具卡的结构化载荷）。
 *
 * 与 core/web-search.ts 的 WebSearchResult 同构、各自定义：那份是搜索服务商的
 * 返回契约（core 层），这份是 UI 渲染契约 —— renderer 只许 import shared
 * （AGENTS.md §1.3），两处无法共用一个 import 源。snippet 由 description 映射而来，
 * publishedAt 不下发（UI 不展示，daemon 侧提取时已丢弃）。
 */
export interface SourceRef {
	readonly title: string;
	readonly url: string;
	readonly snippet?: string;
	/** 站点名（URL host 去 www. 前缀）。daemon 侧推导，UI 不自建推导逻辑。 */
	readonly site?: string;
}

/**
 * 一个子代理的运行状态（task 工具的分组活动投影项）。
 *
 * 契约语义是**整体投影替换**：每次 subagent_progress 事件携带全量数组，
 * 消费端整体替换、不做增量合并。原因：并行多代理各自推进，增量合并
 * 会逼出键控 diff（按 agent 名对账、处理消失项），而替换语义幂等、
 * 且天然解决旧 tool_progress 文本 delta 方案里多代理进度行交错的问题。
 */
export interface SubagentStatus {
	/** 子代理名（task 工具的 agent 参数）。 */
	readonly agent: string;
	/** 任务描述摘要。 */
	readonly task: string;
	/**
	 * 子代理种类（spec: add-team-foundations 批 4）：task 工具的隔离子会话 =
	 * "subagent"，未来的团队成员 = "team"。**缺省按 "subagent" 解释** ——
	 * task 工具不写、旧格式会话没有这个键，读方不得要求它存在。
	 */
	readonly kind?: "subagent" | "team";
	readonly status: "queued" | "running" | "done" | "failed";
	/** 最新动作行，如「正在 web_search xxx」「已完成 N 轮」；无进展时为空串。 */
	readonly activity: string;
	/** 已完成的 agent 轮数。 */
	readonly turns: number;
	/** 终态：成功输出或失败诊断；运行中缺省。 */
	readonly output?: string;
	/**
	 * 子代理生效的模型标识（agent 定义声明了 model 才有）。
	 * 卡片据此显示模型徽标——「调研用便宜模型」是否真的生效，用户要看得见。
	 */
	readonly model?: string;
	/**
	 * 过程动作行时间线（Trae fromSubagent 透明性的折中实现）：按发生序追加、
	 * 最新在末尾，与 activity 内容同源（activity 恒等于末元素或空串）。
	 * 生产方封顶保留最后 12 条，溢出在最前面补「前 N 条已省略」标记；
	 * 消费端不假设长度、不自行裁剪。旧格式会话缺席——卡片不渲染时间线入口。
	 */
	readonly timeline?: readonly string[];
	/**
	 * 以下四个键**只有团队成员投影（kind:"team"）填写**，task 卡的子代理
	 * 投影不写（缺省缺席，卡片不渲染对应元素）——实时计数与聚焦导航的
	 * 数据源（spec: add-team-foundations 批 8）。
	 */
	/** 成员会话 id（焦点导航的寻址键；spawning 阶段未定为 undefined）。 */
	readonly sessionId?: string;
	/** 累计工具调用次数。 */
	readonly toolCalls?: number;
	/** 累计 token 用量（各轮 totalTokens 之和）。 */
	readonly tokens?: number;
	/** 累计费用（美元，各轮 cost 之和）。 */
	readonly cost?: number;
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
	/**
	 * 生成期累积的原始参数文本（半截 JSON），随 tool_stream_progress.rawArgs 上屏。
	 *
	 * 只给「参数本体就是展示内容」的工具：show_widget 的 widget_code 在参数里
	 * 逐步变长，渲染层在工具结果返回前就拿这段做渐进解析（部分 JSON 提取），
	 * 流式期间即可渲染半成品 widget。write/edit 不填 —— 它们的进度表达是
	 * 行数统计（change），不需要把文件内容原文推给 UI。
	 * 执行期（tool_started）由 session-host 用完整 args 回填一次，
	 * tool_finished 后键缺席：终态内容以 detail（工具结果）为准。
	 */
	readonly streamArgs?: string;
	/**
	 * todo_write 的任务清单（结构化载荷）。仅 todo_write 卡填充：
	 * 来自工具 args（全量替换语义，每次调用都是完整清单），恢复历史会话时
	 * 由消息回放从落盘 args 重建（core/session-rebuild.ts）。
	 * 模型手滑的脏 args 解析不出时键缺席 —— 清单只是卡片的增强展示，
	 * 缺席不阻碍卡片照常落成。
	 */
	readonly todos?: readonly TodoItem[];
	/**
	 * web_search 的引用来源清单（结构化载荷）。仅 web_search 卡填充：
	 * 来自工具 result.details 的结构化结果（daemon 侧已过 URL 安全校验，
	 * core/source-parse.ts），恢复历史会话时由回放从落盘 details 重建
	 * （core/session-rebuild.ts），零新增持久化。
	 * result.details 缺席（旧会话/非搜索工具）时键缺席 —— 来源只是卡片的
	 * 增强展示，缺席不阻碍卡片照常落成。
	 */
	readonly sources?: readonly SourceRef[];
	/**
	 * task 工具卡的分组活动/结果投影（结构化载荷）。仅 task 卡填充：
	 * 运行中由 subagent_progress 事件实时整体替换，终态由 tool_finished
	 * 卡片携带（整体替换语义见 SubagentStatus 注释）。
	 * 缺省表示非 task 卡或旧格式会话 —— 渲染层回退普通工具卡渲染。
	 */
	readonly subagents?: readonly SubagentStatus[];
	/**
	 * 卡头摘要的 hover 提示（原生 title 属性），只在摘要不是入参原值时填充：
	 * 模型给 shell 工具写了 description 时，卡头显示描述、命令本体退到这里
	 * （WorkBuddy 的 primaryTitle 同款分工，见 core/session-rebuild.ts 的 summarizeArgs）。
	 * 缺省 = 摘要本身就是入参原值，无需提示 —— 渲染层不渲染 title 属性。
	 */
	readonly summaryTitle?: string;
	readonly at: number;
	/** 所属 run（reducer 盖章，语义见 RunId 注释）。恢复重建的历史条目缺席。 */
	readonly runId?: RunId;
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

/**
 * 一次进行中的模型自动重试（run_retry start 折叠而来，reducer 视图状态）。
 *
 * pi 的 auto_retry 语义：失败尝试之间静默等待 delayMs 再上 —— 没有这条状态行，
 * 这段窗口在 UI 上是一个无任何反馈的黑洞（对网关超时尤其常见）。
 * retryAt = 预定重试发起时刻（daemon 收到事件时按 delayMs 打点）—— 倒计时以
 * 它为准，不受两端折叠时间差影响。success/finalError 不落此结构：那是「离开
 * 重试中」的信号，reducer 直接清态，终态由后续 run_finished/run_error 表达。
 */
export interface RunRetryState {
	/** 即将发起的是第几次尝试（pi 的 attempt 口径：首次失败后的第一次重试为 1）。 */
	readonly attempt: number;
	readonly maxAttempts: number;
	/** 预定重试发起时刻（epoch ms）。倒计时 = retryAt − now。 */
	readonly retryAt: number;
	/** 上一次失败的原因（模型/网关错误原文，不含 stack）。 */
	readonly errorMessage?: string;
}

/** 上下文压缩的触发原因（与 pi compaction_start 的 reason 平行定义，见 agent-session.ts:154）。 */
export type CompactionReason = "manual" | "threshold" | "overflow";

/**
 * 触发原因的取值校验。
 *
 * 读侧用（台账回放）：`compaction_start` 条目的 reason 会被拿去补一条
 * 合成闭合的 `compaction`（core/run-ledger.ts），未校验就写会让 reason
 * 缺胳膊少腿地落进类型标明必填的记录里 —— 落盘 schema 宁缺条目不写坏值。
 * 与 permissions.ts 的 isApprovalPolicy / isSandboxMode 同款。
 */
export function isCompactionReason(value: unknown): value is CompactionReason {
	return value === "manual" || value === "threshold" || value === "overflow";
}

/**
 * 一次进行中的上下文压缩（compaction_started 折叠而来，reducer 视图状态）。
 *
 * 压缩要调模型写摘要，耗时与一轮对话相当 —— 没有这条状态行，这段窗口在 UI 上
 * 没有任何反馈，用户以为卡死了。compaction_finished（含中断/失败）到达即清态。
 */
export interface CompactionState {
	readonly reason: CompactionReason;
	/** 压缩开始时刻（事件到达时刻 epoch ms）——状态行据此显示已压缩时长。 */
	readonly startedAt: number;
}

/** 产物交付条目（artifacts_presented 折叠而来，恢复会话时由 custom 条目翻译）。 */
export interface ArtifactsPresentedEntry {
	readonly id: MessageId;
	readonly role: "artifacts_presented";
	readonly files: readonly PresentedFile[];
	readonly focusFile: string | undefined;
	readonly at: number;
	/**
	 * 所属 run（语义见 RunId 注释）。**总是缺席**：这类条目只由恢复路径
	 * （core/session-rebuild.ts 扫落盘 custom 条目）产出，落盘里没有 run 记录；
	 * 字段在这里是为了让 ConversationEntry 联合的成员形状一致（读 entry.runId
	 * 时不必窄化角色）。
	 */
	readonly runId?: RunId;
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
	 *
	 * rawArgs 是 show_widget 的通道：它的进度不是行数而是参数本体
	 * （widget_code 在参数里逐步累积，渲染层靠它做渐进渲染），path/added/
	 * changeType 对它无意义（发 path:undefined 占位，reducer 见到
	 * path===undefined 本就不动行数口径）。两个用途共用同一事件而不是
	 * 各起一个：都是「生成期卡片的增量现场」，消费方都是同一张卡。
	 */
	| {
		readonly type: "tool_stream_progress";
		readonly id: ToolCallId;
		readonly path: string | undefined;
		readonly added: number;
		readonly changeType: "created" | "modified";
		/** 生成期累积的原始参数文本（目前仅 show_widget 发，见 ToolCard.streamArgs）。 */
		readonly rawArgs?: string;
	}
	/** 工具开始执行（参数已生成完毕）。同 id 的生成中卡片原位翻转为执行态。 */
	| { readonly type: "tool_started"; readonly card: ToolCard }
	/** 工具流式输出（如命令 stdout）。 */
	| { readonly type: "tool_progress"; readonly id: ToolCallId; readonly delta: string }
	/**
	 * task 工具（子代理委派）的运行中分组活动投影。
	 * 由 session-host 从部分结果 details 的 subagents 数组桥接而来，
	 * 携带全量投影（整体替换语义，见 SubagentStatus 注释）；
	 * 恢复历史会话时由消息回放从落盘 details 经同路径还原。
	 */
	| { readonly type: "subagent_progress"; readonly id: ToolCallId; readonly agents: readonly SubagentStatus[] }
	/**
	 * 团队成员的实时状态投影（spec: add-team-foundations 批 7）。
	 * 与 subagent_progress 的差异：不带 toolCallId —— 成员是长会话，
	 * 产出（team_create 工具调用）早已终态，投影按「最近一张 team 卡」
	 * 归位（reducer 找 toolName === "team_create" 的最后一条工具条目，
	 * 整体替换其 subagents；找不到则 no-op，旧格式会话安全）。
	 * 携带全量投影（整体替换语义，kind 恒为 "team"）。
	 */
	| { readonly type: "team_member_progress"; readonly members: readonly SubagentStatus[] }
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
	| { readonly type: "context_usage"; readonly usage: ContextUsageDetail }
	/**
	 * 会话级统计的实时投影（对齐 dsh 的 sessionStats projection）。
	 *
	 * daemon 在**台账条目 fold 之后**推（只在 llm_call / run_end 两个时点：
	 * 前者改变轮次 / 耗时 / 首字 / 解码 / 用量，后者收束该 run 的工具耗时；
	 * tool_call 一个 run 有几十条，跟着推只会让 IPC 与事件日志膨胀）。
	 *
	 * 为什么不塞进 session_state：session_state 只在 pi 的元信息变化时发
	 *（模型 / 模式 / 上下文用量），一条 llm_call 结束并不触发它，指标条会
	 * 长期停在旧值。与 context_usage 同模式 —— daemon 才知道的聚合结果，
	 * 由 daemon 主动推一条独立事件。
	 *
	 * 消费方是聊天页底部的常驻指标条（renderer/session-stats-line.tsx）。
	 */
	| { readonly type: "session_stats"; readonly stats: SessionStatCard }
	/**
	 * 模型自动重试状态（等待 delayMs 后再次发起）。
	 *
	 * start 事件由 session-host 在收到 pi auto_retry_start 后转发（计数从 1 开始）；
	 * end（success / finalError）由 session-host 在 auto_retry_end 后转发， reducer
	 * 收到后清重试态。终态成功/失败由后续的 run_finished / run_error 表达。
	 */
	| {
		readonly type: "run_retry";
		readonly status: "start" | "success" | "finalError";
		readonly attempt: number;
		readonly maxAttempts: number;
		readonly delayMs: number;
		readonly errorMessage?: string;
	}
	/**
	 * steer / followUp 队列变化。daemon 在 pi queue_update 到达时直接转发。
	 * 数组**就是队列内容**（pi 的 _steeringMessages / _followUpMessages 快照）——
	 * 排队 chips 靠它渲染文本，删除/编辑靠它重排（session:queue-rewrite）。
	 */
	| { readonly type: "queue_changed"; readonly steering: readonly string[]; readonly followUp: readonly string[] }
	/**
	 * 上下文压缩开始（pi compaction_start 透传）。
	 *
	 * 压缩要调模型写摘要，耗时与一轮对话相当 —— 它在 UI 上必须有反馈
	 *（会话流尾部状态行），否则这段窗口对用户是黑洞。reason 区分手动 / 阈值 / 溢出。
	 * 不携带 startedAt：daemon 只在收到事件时透传，压缩时长以 reducer 侧事件
	 * 到达时刻为准（两端折叠同一个事件，时间基准天然一致）。
	 */
	| { readonly type: "compaction_started"; readonly reason: CompactionReason }
	/**
	 * 上下文压缩结束（pi compaction_end 透传，无论成功 / 中断 / 失败）。
	 *
	 * aborted / errorMessage 只用于终态区分语义，renderer 收到即清压缩态 ——
	 * 状态行在压缩结束后消失，失败细节由随后的 run_error 卡表达（contract 同理）。
	 */
	| {
		readonly type: "compaction_finished";
		readonly aborted: boolean;
		readonly errorMessage?: string;
	};

/**
 * 流式与进度类事件：逐字 / 逐块的增量，不携带新的聚合事实。
 *
 * **这份名单只有一处**（2026-09-15 抽出）。两个用途共用它：
 *   - daemon 的 `sanitizeForLog`：把其中的正文 / 累积参数收成长度后再落盘
 *   - renderer 的统计类界面（诊断页 / 统计页 / 任务诊断面板）：跳过它们，
 *     不做「重拉快照 / 重读台账」的无谓刷新
 *
 * 为什么必须共用：这两份名单此前各写一遍，而且**都漏了
 * `tool_stream_progress`**（只写了名字相近的 `tool_progress`）。实测单日
 * 3 万条的后果是双向的：落盘侧把 events-*.jsonl 撑到 26 MB，界面侧让诊断页
 * 与统计页在一次 write 期间空转 3000+ 次全量重算。名字只差一个 stream 的
 * 这对类型，是这套事件里最容易漏的地方 —— 下次加进度类事件时改这里。
 *
 * 判据是「会不会改变聚合结果」，不是「是不是增量小事件」：
 * `context_usage` 就是聚合结果本身，虽小也**不**在内。
 */
/** 流式与进度类事件的联合（`isStreamingEvent` 的窄化目标）。 */
export type StreamingEvent = Extract<
	SessionEvent,
	{
		readonly type:
			| "assistant_text_delta"
			| "assistant_thinking_delta"
			| "tool_progress"
			| "tool_stream_progress";
	}
>;

export function isStreamingEvent(event: SessionEvent): event is StreamingEvent {
	return (
		event.type === "assistant_text_delta" ||
		event.type === "assistant_thinking_delta" ||
		event.type === "tool_progress" ||
		event.type === "tool_stream_progress"
	);
}

/**
 * PUSH.sessionEvent 的信封：事件本体 + 路由键。
 *
 * sessionId 是**路由键，不是事件内容**：SessionEvent 表达的是会话内事实，
 * reducer 折叠它时不感知自己属于哪个会话（reducer 无侵入）；
 * 持有方（daemon 注册表 / renderer 的 Map<sessionId, ConversationView>）
 * 按信封上的 sessionId 把事件分桶进对应会话的视图——后台会话的流式事件
 * 因此不会污染当前视图，切回时现场完整。不给每个事件本体塞会话 id，
 * 是因为那是 16 个事件变体各加一个重复字段，而路由只需要一份。
 */
export interface SessionEventEnvelope {
	readonly sessionId: string;
	readonly event: SessionEvent;
}

/**
 * 会话的当前状态。变化时整体重发——字段少，不值得做差量。
 *
 * 模式是**两个正交的轴**，照 WorkBuddy 的结构来（其内置插件目录即证据）：
 *
 *   场景轴 welcomemode/  work / code / design      各带 agents/<name>.md 根代理
 *   交互轴 interactionmode/  ask / craft / plan     各带 fragments/*.md 提示片段
 *
 * expertId 是**与两轴平行的独立绑定**（正交），不是交互模式之一：选/取消
 * 专家不改交互模式，切交互模式也不清专家，两种轴可自由组合
 *（spec: rework-expert-orthogonal-and-skills）。
 *
 * 系统提示词是两轴共同的函数：场景模板 include 交互片段。
 * 所以两者都要存，不能压成一个 modeId —— 否则 D4-5 写提示词时必然返工。
 */
export interface SessionState {
	readonly sessionId: string;
	/**
	 * 会话工作目录。临时任务会话（isTempTask=true）的 cwd 为首次执行时分配的
	 * 每任务独立目录（<生效根>/YYYY-MM-DD-HH-mm-ss，见 spec: align-per-task-dirs），
	 * 历史会话可能是旧的共享「临时任务」目录。
	 * 待分配（新建任务尚未首次执行）时为空串。
	 * undefined 仅出现在会话尚未建立的初始瞬态。
	 *
	 * cwd = 生效根本身时**不是**临时任务（2026-09-15）：归空间区成组（对齐 WorkBuddy）。
	 * 【2026-09-15 订正】原注写「那只会来自用户显式选 picker 的『默认工作空间』」—— 该固定
	 * 项已删（WorkBuddy 的 picker 没有指向根的固定项），现在只来自「打开本地文件夹…」或旧会话。
	 */
	readonly cwd: string | undefined;
	/**
	 * 是否为临时任务会话（未绑定命名工作空间）。
	 *
	 * 每次新建任务默认即临时任务：首次执行时分配独立时间戳目录、加载完整工具集、
	 * 权限门照常 —— 不再存在「不绑定目录、无文件工具」的 playground 模式（那套「限制工具集」
	 * 是我们自己加的，WorkBuddy 的 playground 会话工具齐全）。
	 *
	 * 【2026-09-15 订正】WorkBuddy **确有** cwd="" 语义，之前「查无实据」的结论是错的：
	 * picker 的 `chatInput.workspacePicker.noWorkspace` 一项点击即 `store.api.setCwd("")`
	 *（lib-chat-ui-*.js:60867）。其新建任务的落点见 asar main/server.js 的
	 * createDefaultCwd/formatDefaultCwdTimestamp，即每任务独立时间戳目录。
	 */
	readonly isTempTask: boolean;
	/** 场景 id，对应 resources/scenes/<id>/。决定根代理与可用能力面。 */
	readonly sceneId: string;
	/** 交互模式 id，对应 resources/modes/<id>.md。决定工具白名单与行为片段。 */
	readonly interactionId: string;
	/**
	 * 绑定的专家 id（对应 resources/experts/<name>/ 的目录名）。
	 *
	 * 与 interactionId **正交**：选/取消专家只改本字段，切交互模式不动它
	 *（spec: rework-expert-orthogonal-and-skills）。缺省而非空串：
	 * 无专家是常态，不占字段。
	 */
	readonly expertId?: string;
	readonly modelId: string | undefined;
	readonly isStreaming: boolean;
	/**
	 * 当前推理强度档位。由宿主从 pi 的 session.thinkingLevel 现读
	 * （pi 恒 clamp 到模型能力内，非推理模型为 "off"）。
	 *
	 * 可选而非必填：不掀翻全部既有构造点（daemon freshConversation、
	 * session-rebuild、各测试的初始瞬态）。renderer 对 undefined 一律
	 * 不显示档位 —— 与非推理模型「不显示档位行/pill 后缀」同一口径。
	 */
	readonly thinkingLevel?: ThinkingLevel;
	/**
	 * 当前模型的可用档位（pi getAvailableThinkingLevels() 现读）。
	 * 非推理模型仅 ["off"]；切模型后随下次 session_state 联动更新，
	 * UI 的档位子菜单只列这里的值，不自建模型能力表。
	 */
	readonly availableThinkingLevels?: readonly ThinkingLevel[];
	/** 上下文占用。undefined 表示尚未有过一次请求。 */
	readonly contextUsage?: {
		readonly usedTokens: number;
		readonly maxTokens: number;
	};
	/**
	 * resume 降级打开时跳过的坏行数（spec: add-observability-ledger）。
	 *
	 * pi 的 loadEntriesFromFile 逐行跳过 JSON 解析失败的坏行但不暴露计数 ——
	 * daemon 预扫同口径计数后并入 session_state（仅 resume 出损坏会话的桶有值，
	 * 新建/完好会话键缺席），renderer 据此提示「会话文件有 N 行损坏已跳过」。
	 */
	readonly skippedLines?: number;
	/**
	 * 本会话跑在 worktree 副本里的信息（对齐清单 C22 / L27）。
	 *
	 * 缺省 = 「直接在所选目录里工作」，这是绝大多数会话的形态，不占字段。
	 * 只在代码场景下用户启用了副本、**且副本真的建成功**时才出现 ——
	 * 建失败会降级回原目录并把原因记日志，那时这里也是缺省（UI 不该显示
	 * 一份并不存在的隔离）。
	 */
	readonly worktree?: WorktreeInfo;
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

/**
 * steer / followUp 等待队列的快照（pi _steeringMessages / _followUpMessages 的直转）。
 * queue_changed 事件与 SessionSnapshot.queued 共用这一个形状 —— 队列内容只有一份口径。
 */
export interface QueuedMessages {
	readonly steering: readonly string[];
	readonly followUp: readonly string[];
}

/**
 * 渲染进程挂载或热重载后拉取的完整状态。
 *
 * 会话 id 不单独列字段：它在 state.sessionId（SessionState），
 * 多任务并发后按 id 缓存快照时以那个为准，这里不再复制一份制造两个口径。
 */
export interface SessionSnapshot {
	readonly state: SessionState;
	readonly entries: readonly ConversationEntry[];
	/** 可选场景，供首页页签渲染。 */
	readonly availableScenes: readonly ModeDescriptor[];
	/** 可选交互模式，供对话页切换器渲染。 */
	readonly availableModes: readonly ModeDescriptor[];
	/**
	 * 首页预设（能力胶囊 + 最佳实践案例）。与场景/模式清单同性质：静态资源，
	 * 不随会话变化，daemon 装配时一并带上。缺省 = 这份快照没带（如从事件流
	 * 拼出的桶种子），renderer 按「没有预设」处理。
	 */
	readonly welcome?: WelcomePresets;
	/** 最近的上下文用量明细。还没有过带用量的响应时为 undefined。 */
	readonly usageDetail?: ContextUsageDetail;
	/**
	 * 会话级统计（session_stats 事件折叠而来）。还没有跑过台账时为 undefined ——
	 * 聊天页指标条据此整行不渲染，而不是显示一排 0。
	 */
	readonly sessionStats?: SessionStatCard;
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
	/** 进行中的模型自动重试（run_retry 折叠而来）。没有重试窗口时为 undefined。 */
	readonly retry?: RunRetryState;
	/**
	 * steer / followUp 排队中的消息（queue_changed 折叠而来）。
	 * daemon 目前不回填本字段（队列是运行期瞬态，切会话即失）——
	 * 排队 chips 只活在「正在看的这个会话」里，与 queueCount 时代的口径一致。
	 */
	readonly queued?: QueuedMessages;
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

/**
 * conversation_search 工具的一条命中（spec: add-memory-system）。
 *
 * daemon 的检索实现与 extensions 的工具本体共用的契约：工具不认识会话文件
 * （pi 类型止步于 core/extensions 的规则同样不许 JSONL 解析进扩展），
 * 检索结果由 daemon 装配时以 searchSessions 回调注入。
 */
export interface ConversationSearchHit {
	readonly sessionId: string;
	/** 会话标题（命名优先，否则首条用户消息截断，与任务列表同口径）。 */
	readonly title: string;
	/** 会话最后活动时间（epoch ms），用于展示日期与新旧排序。 */
	readonly modifiedAt: number;
	/** 命中处的上下文片段（命中关键词前后各约 200 字符）。 */
	readonly snippet: string;
}
