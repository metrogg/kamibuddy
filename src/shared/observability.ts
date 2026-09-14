/**
 * 可观测性领域类型 —— 诊断页与 daemon 统计快照共用的形状。
 *
 * 与 session-events.ts 的分工：那边是「给聊天 UI 渲染用」的实时事件流，
 * 这里是「给诊断页看」的聚合结果。聚合发生在 daemon（core/observability.ts），
 * renderer 只拿快照、不做二次计算——两端各算一份必然漂移（同 conversation.ts 的理由）。
 */

import type { RunId, ToolOutcome } from "./session-events.ts";

/**
 * 一次或多次模型调用的 token 用量。cost 为美元总计。
 *
 * reasoning / cacheWrite1h / costBreakdown 是后补的可选细分（pi Usage 全字段
 * 透传，spec: add-observability-ledger）：旧事件流与旧落盘数据没有它们，
 * 消费方按缺省处理，不补零 —— 「没上报」与「是零」两回事（reasoning
 * 只有上报了细分的服务商才有值，cacheWrite1h 只有 Anthropic 1h 档才有值）。
 */
export interface TokenUsage {
	readonly input: number;
	readonly output: number;
	readonly cacheRead: number;
	readonly cacheWrite: number;
	readonly totalTokens: number;
	readonly cost: number;
	/** 思考 token 数（output 的子集，provider 上报细分才有值）。 */
	readonly reasoning?: number;
	/** cacheWrite 中 1 小时 TTL 档的量（cacheWrite 的子集，仅 Anthropic 上报）。 */
	readonly cacheWrite1h?: number;
	/** cost 的四项分项（美元），合计等于 cost。 */
	readonly costBreakdown?: {
		readonly input: number;
		readonly output: number;
		readonly cacheRead: number;
		readonly cacheWrite: number;
	};
}

export function emptyUsage(): TokenUsage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: 0,
	};
}

/**
 * 缓存命中率：cacheRead 占全部 prompt 侧 token（input + cacheRead）的比例。
 * undefined 表示还没有过一次带用量的响应，UI 显示「—」而不是误导性的 0%。
 */
export function cacheHitRate(usage: TokenUsage): number | undefined {
	const promptTokens = usage.input + usage.cacheRead;
	if (promptTokens === 0) return undefined;
	return usage.cacheRead / promptTokens;
}

export type RunStatus = "running" | "ok" | "error";

/** 一次工具执行的时间跨度，诊断页的 run 时间线（泳道）靠它画。 */
export interface ToolSpan {
	readonly toolName: string;
	/** 面向用户的中文标签，与 ToolCard.label 同源。 */
	readonly label: string;
	/** 一行摘要（如文件路径），时间线悬停提示用。 */
	readonly summary: string;
	readonly startedAt: number;
	/** 进行中为 undefined。 */
	readonly endedAt: number | undefined;
	readonly outcome: ToolOutcome | undefined;
}

/** 一次用户提问到 agent 停止的完整过程（与 SessionEvent 的 RunId 对应）。 */
export interface RunRecord {
	readonly runId: RunId;
	/**
	 * 该 run 所属的会话（多会话台账投影需要按会话分泳道，Task 4 的会话选择器
	 * 靠它过滤）。实时路径取事件信封的 sessionId；回放路径取台账文件名。
	 */
	readonly sessionId: string;
	readonly startedAt: number;
	/** 进行中为 undefined。 */
	readonly endedAt: number | undefined;
	readonly status: RunStatus;
	/** 出错时的用户可读信息（run_error 的 message），成功为 undefined。 */
	readonly error: string | undefined;
	/** run 开始时的模型与两轴，事后切换不影响历史记录。 */
	readonly modelId: string | undefined;
	readonly sceneId: string;
	readonly interactionId: string;
	/** 该 run 内所有助手消息的用量合计。模型报错等无响应场景为 undefined。 */
	readonly usage: TokenUsage | undefined;
	readonly toolCalls: number;
	readonly toolErrors: number;
	/** 该 run 内的工具执行时间线（开始顺序）。供诊断页画泳道。 */
	readonly toolSpans: readonly ToolSpan[];
}

/** 单个工具维度的聚合统计。 */
export interface ToolStat {
	readonly toolName: string;
	/** 面向用户的中文标签，与 ToolCard.label 同源。 */
	readonly label: string;
	readonly calls: number;
	readonly errors: number;
	/** 平均耗时毫秒。只统计已完成的调用。 */
	readonly avgMs: number;
}

/**
 * 上下文成分的**估算**（token 数）。
 *
 * pi 不提供按类别拆分的上下文用量，这里按会话内容字符数粗估
 * （core/observability.ts 里的换算系数是经验值），用来回答
 * 「上下文是被对话、思考还是工具结果吃掉的」。诊断页必须标注「估算」。
 */
export interface ContextComposition {
	readonly system: number;
	readonly user: number;
	readonly assistant: number;
	readonly thinking: number;
	readonly tools: number;
}

/**
 * 会话级统计卡片（spec: add-observability-ledger Task 3.2）。
 *
 * 从运行台账 fold：覆盖该会话**有史以来**记进台账的全部轮次，含早已被压缩
 * 出上下文的历史（口径近 pi getSessionStats —— 它聚合全部会话条目含压缩
 * 摘要）。与 run 级聚合的口径差异：RunRecord 是「诊断窗口内的 run 卡片」
 * （受窗口截断、usage 只含窗口内该 run 的助手消息合计），这里是会话全历史
 * 计数器，重启不清零。
 */
export interface SessionStatCard {
	readonly sessionId: string;
	/** run_start 条数。 */
	readonly runs: number;
	/** llm_call 条数（模型调用轮次）。 */
	readonly turns: number;
	/** 全部轮次的模型耗时合计（llm_call 的 endedAt − startedAt，毫秒）。 */
	readonly llmMs: number;
	/** 全部工具执行耗时合计（tool_call 执行期口径，毫秒）。 */
	readonly toolMs: number;
	/** 五字段 + cost 的累计；细分字段（reasoning 等）只在有上报时出现。 */
	readonly usage: TokenUsage;
	/** cacheRead / (input + cacheRead)；还没有过带用量的响应为 undefined。 */
	readonly cacheHitRate: number | undefined;
	/** 最新一条台账条目的时刻，卡片排序（最近活跃在前）用。 */
	readonly lastActiveAt: number;
}

/** 缓存失效的归因（spec: add-observability-ledger Task 3.3，算法借 pi cache-stats）。 */
export type CacheMissReason =
	/** 距上次请求超过 cache TTL（5 分钟），空闲期缓存自然失效。 */
	| "idle_ttl"
	/** 模型相对上次请求变了，新模型缓存为空，全量重计费。 */
	| "model_change"
	/** 两者都不是（缓存驱逐、TTL 档位差异等），只能确认「上次 prompt 这次没命中」。 */
	| "other";

/** 一次被计入的缓存浪费（超过噪声底线的 miss）。 */
export interface CacheMissRecord {
	readonly sessionId: string;
	/** 失效发生时刻（本次 llm_call 的开始时刻）。 */
	readonly at: number;
	/** 上次 prompt 里已有、这次却没走缓存重计费的 token 数。 */
	readonly missedTokens: number;
	/** 多花的美元（相对全命中）；定价未知（usage 无 costBreakdown）为 0。 */
	readonly missedCost: number;
	/** 距上次请求完成的空闲毫秒数。 */
	readonly idleMs: number;
	readonly reason: CacheMissReason;
}

/** 全进程缓存浪费合计 + 最近的 miss 明细（新的在前，条数上限见 core/observability.ts）。 */
export interface CacheWasteSummary {
	readonly missedTokens: number;
	readonly missedCost: number;
	readonly missCount: number;
	readonly misses: readonly CacheMissRecord[];
}

/** daemon 诊断页快照。statsSnapshot 通道的返回形状。 */
export interface ObservabilitySnapshot {
	/**
	 * daemon 进程启动时间。注意口径：total* 与 sessions 是**台账全历史**累计
	 * （重启不清零，spec: add-observability-ledger），startedAt 只是「本进程
	 * 何时起」的时间锚点，不再是累计口径的起点。
	 */
	readonly startedAt: number;
	/** 全进程累计用量（历史从台账回放，本会话作废重开也会带上之前任务的）。 */
	readonly totalUsage: TokenUsage;
	readonly totalRuns: number;
	readonly totalErrors: number;
	/** 最近的 run，新的在前。窗口口径（每会话条数 + 全局时间窗）见 core/observability.ts。 */
	readonly runs: readonly RunRecord[];
	readonly tools: readonly ToolStat[];
	/** 会话级统计卡片（台账全历史口径），最近活跃在前。 */
	readonly sessions: readonly SessionStatCard[];
	/** 缓存浪费归因（台账 fold，pi cache-stats 口径）。 */
	readonly cacheWaste: CacheWasteSummary;
	/** 上下文成分估算。还没有任何会话内容时为 undefined。 */
	readonly composition: ContextComposition | undefined;
	/** 当前上下文占用（同 SessionState.contextUsage）。 */
	readonly contextUsage:
		{ readonly usedTokens: number; readonly maxTokens: number } | undefined;
	/** 事件日志目录（JSONL 落盘位置），诊断页「打开日志目录」按钮用。 */
	readonly logDir: string;
}

/* ── 运行台账（run ledger，spec: add-observability-ledger）──────────────
 *
 * 每会话一份 append-only NDJSON（logs/runs/<sessionId>.jsonl），只记 pi 会话
 * JSONL 不记的东西（重试过程 / 调用计时 / 请求快照 / 队列 / run 边界）——
 * 消息内容与用量在会话 JSONL 已有，不双写（双写必漂移）。
 * 写入实现与纪律（seq 单调 / 写入点校验 / 中断合成闭合）见 core/run-ledger.ts。
 */

/** 台账条目种类。 */
export type RunLedgerEntryKind =
	| "run_start"
	| "run_end"
	| "llm_call"
	| "retry"
	| "tool_call"
	| "compaction"
	| "queue"
	| "request_snapshot";

/** run 的结束方式。interrupted 是合成闭合：daemon 重启后发现上次中断留下的未闭合 run。 */
export type RunEndReason = "completed" | "cancelled" | "error" | "interrupted";

export interface RunStartData {
	readonly runId: RunId;
	/** run 开始时的模型（provider/model）。模型未选定（异常路径）缺省。 */
	readonly modelId?: string;
}

export interface RunEndData {
	readonly runId: RunId;
	readonly reason: RunEndReason;
	/** reason === "error" 时的失败原因（给用户看过的同一份文案，不含 stack）。 */
	readonly error?: string;
}

/**
 * 单次模型调用的边界（映射 pi 的 turn_start/end；UI 不呈现「轮」，只进台账）。
 * 条目在调用完成时整条写入（startedAt 在 turn_start 时记账）——崩溃丢失的是
 * 这一次调用本身，由 run 级合成闭合兜底，不补半成品条目。
 */
export interface LlmCallData {
	readonly runId?: RunId;
	/** 本 run 内第几轮（宿主侧计数，run 内从 0 起）。 */
	readonly turnIndex: number;
	readonly startedAt: number;
	readonly endedAt: number;
	/** 首个 text/thinking delta 到达时刻 − startedAt（毫秒）。无 delta 的轮（纯工具调用）缺省。 */
	readonly ttftMs?: number;
	/** pi StopReason（stop/length/toolUse/error/aborted…）。 */
	readonly stopReason?: string;
	/** 本轮 usage 全字段（turn_end 的 assistant 消息携带）。 */
	readonly usage?: TokenUsage;
	readonly errorMessage?: string;
}

/**
 * 一次自动重试的过程记录（pi auto_retry_start/end 全量转发）。
 * start：第 attempt 次重试前的等待（delayMs 后发起，errorMessage 是上次失败原因）；
 * end：重试链终态（success=true 成功 / false 耗尽，finalError 为最终失败原因）。
 */
export interface RetryData {
	readonly runId?: RunId;
	readonly phase: "start" | "end";
	readonly attempt: number;
	readonly maxAttempts?: number;
	readonly delayMs?: number;
	readonly errorMessage?: string;
	readonly success?: boolean;
	readonly finalError?: string;
}

/**
 * 一次工具调用，**执行期口径**：startedAt = tool_execution_start，
 * endedAt = tool_execution_end。与流式卡片的口径差异在卡片「生成期上屏」
 * （write 等从参数生成期算起），这里统一不含参数生成期 —— 两套口径各有
 * 用途（卡片要消除空白窗，台账要真实执行耗时），注释钉住防混淆。
 */
export interface ToolCallData {
	readonly runId?: RunId;
	readonly toolCallId: string;
	readonly toolName: string;
	/** 参数摘要（与 ToolCard.summary 同一函数产出）。 */
	readonly summary: string;
	readonly startedAt: number;
	readonly endedAt: number;
	readonly outcome: ToolOutcome;
}

/** 一次上下文压缩（pi compaction_end 携带；reason 与 pi 词汇平行定义，同 ThinkingLevel 先例）。 */
export interface CompactionData {
	readonly reason: "manual" | "threshold" | "overflow";
	/** 压缩前的上下文 token 数；压缩失败/中断（无 result）时缺省。 */
	readonly tokensBefore?: number;
	readonly aborted: boolean;
	readonly errorMessage?: string;
}

/** steer / followUp 排队变化（pi queue_update 直转；内容数组，渲染端只用计数）。 */
export interface QueueData {
	readonly steering: readonly string[];
	readonly followUp: readonly string[];
}

/** 系统提示词一个分段的 provenance（source 来自 prompt-composer 的 PromptSegmentSource）。 */
export interface SystemSegmentStat {
	readonly source: string;
	readonly chars: number;
}

/** 一类消息的条数与字符数。 */
export interface MessageClassStat {
	readonly count: number;
	readonly chars: number;
}

/**
 * 每轮实际入模组成的快照（挂 pi transformContext 钩子——官方观察口）。
 *
 * **不记正文**：消息正文在会话 JSONL 已有，这里只记分段来源与分类计数
 * （口径钉在 core/session-host.ts 的钩子里）。other 是 convertToLlm 之前的
 * 原始角色合计（bashExecution / custom / branchSummary / compactionSummary ——
 * pi 会把它们转写或过滤，精确的入模形态是 pi 内部知识，字符数为 best-effort）。
 */
export interface RequestSnapshotData {
	readonly runId?: RunId;
	readonly turnIndex?: number;
	/** 系统提示词分段 provenance。无组装来源（子代理提示词不走 compose）时键缺席。 */
	readonly systemSegments?: readonly SystemSegmentStat[];
	readonly messages: {
		readonly user: MessageClassStat;
		readonly assistant: MessageClassStat;
		readonly toolResult: MessageClassStat;
		readonly other: MessageClassStat;
	};
}

/** kind → data 的分派表（append 的写入点类型校验靠它）。 */
export interface RunLedgerDataMap {
	readonly run_start: RunStartData;
	readonly run_end: RunEndData;
	readonly llm_call: LlmCallData;
	readonly retry: RetryData;
	readonly tool_call: ToolCallData;
	readonly compaction: CompactionData;
	readonly queue: QueueData;
	readonly request_snapshot: RequestSnapshotData;
}

/** 一条台账记录（NDJSON 一行的形状）。 */
export interface RunLedgerEntry<K extends RunLedgerEntryKind = RunLedgerEntryKind> {
	/** 会话内单调自增序号（启动回放现有文件取 max+1 续号）。 */
	readonly seq: number;
	/** epoch ms。 */
	readonly at: number;
	readonly kind: K;
	readonly data: RunLedgerDataMap[K];
}
