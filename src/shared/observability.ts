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
 * prompt 侧计费的三桶之和（三桶互不相交）。
 *
 * 为什么必须三桶相加：pi 的 `Usage` 里 `input` 直接采自 provider 的
 * `input_tokens`，而 `cacheRead` / `cacheWrite` 各采自 provider 的独立字段
 * （`pi/packages/ai/src/api/anthropic-messages.ts`：
 * `usage.input = input_tokens` / `cacheRead = cache_read_input_tokens` /
 * `cacheWrite = cache_creation_input_tokens`）—— 三者并列而非包含关系
 * （同文件对 `reasoning` ⊂ `output`、`cacheWrite1h` ⊂ `cacheWrite` 都明确标注了
 * 子集关系，`input` 没有这样的标注）。漏掉 cacheWrite 会让「本轮 prompt 一共
 * 花了多少输入」被低估。
 *
 * 口径与 dsh `StatsLine.tsx` 的同名函数一致（它注释为 "three disjoint
 * prompt-side billing buckets"）。
 */
export function billedInputTokens(usage: TokenUsage): number {
	return usage.input + usage.cacheRead + usage.cacheWrite;
}

/**
 * 一次调用是否上报了缓存活动（cacheRead / cacheWrite 任一非零）。
 *
 * 字段收成可选视图：调用方可能只持有 usage 的一部分（renderer 的 turn-metrics
 * 按「字段有没有上报」fold，缺字段与 0 是两回事），判定规则只此一处。
 */
export function reportsCacheActivity(usage: {
	readonly cacheRead?: number;
	readonly cacheWrite?: number;
}): boolean {
	return (usage.cacheRead ?? 0) > 0 || (usage.cacheWrite ?? 0) > 0;
}

/**
 * 缓存命中率：cacheRead 占全部 prompt 侧计费 token 的比例。
 * undefined 表示「这个数字不可信」，UI 显示「—」而不是误导性的 0%，两种情况：
 *
 *   1. prompt 侧三桶全为 0（还没有过一次带用量的响应）；
 *   2. `cacheReported` 为 false —— 这个 provider 至今没有上报过任何缓存活动。
 *
 * **`cacheReported` 必须由调用方给**（2026-09-17 修正）：pi 的 Usage 字段是必填
 * 数字，没有缓存能力的服务商被一律填 0，于是「真的全 miss（0%）」与「压根没有
 * 这个数据」在数字上完全一样。判定口径同 pi cache-stats 的 reportedCache：
 * 序列里出现过非零 cacheRead/cacheWrite 才算它在报缓存。会话级由
 * `core/observability.ts` 的 fold 判定并落进 `SessionStatCard.cacheReported`，
 * renderer 一律从会话卡取（不许各端自己现算一份）。
 *
 * **分母用 billedInputTokens（三桶之和），不是 input + cacheRead**
 *（2026-09-15 修正）：cacheWrite 是「本轮新写入缓存、本轮并未命中」的那部分，
 * 本就该占分母；漏掉它会让命中率系统性偏高，且写缓存越多的轮次偏得越狠。
 * 修正后口径与 dsh `cacheHitPercent` 一致。
 */
export function cacheHitRate(usage: TokenUsage, cacheReported: boolean): number | undefined {
	if (!cacheReported) return undefined;
	const promptTokens = billedInputTokens(usage);
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
/**
 * 单个会话的统计卡。
 *
 * **命名注意（容易搞错）**：本项目的 `turns` 是 llm_call 条数（模型调用轮次），
 * 与外部术语「一轮对话」（= 用户发一次请求，即本卡的 `runs`）不是一回事。
 * dsh 的 sessionStats 投影里对应关系是 `steps → 我们的 turns`、
 * `turns → 我们的 runs`，两边比对时勿混。
 */
export interface SessionStatCard {
	readonly sessionId: string;
	/** run_start 条数（用户每发一次请求一个 run）。 */
	readonly runs: number;
	/** llm_call 条数（模型调用轮次）。 */
	readonly turns: number;
	/** 全部轮次的模型耗时合计（llm_call 的 endedAt − startedAt，毫秒）。 */
	readonly llmMs: number;
	/** 全部工具执行耗时合计（tool_call 执行期口径，毫秒）。 */
	readonly toolMs: number;
	/** 带 TTFT 记录的调用的首字延迟合计（毫秒）。 */
	readonly ttftMs: number;
	/**
	 * 有 TTFT 记录的调用数（llm_call 里 ttftMs 有值的条数）。
	 * 平均首字延迟 = ttftMs / ttftCalls —— 缺了它算不出平均。
	 * dsh 叫 `ttftSteps`：它的一「步」在台账里就是一条 llm_call。
	 */
	readonly ttftCalls: number;
	/** 「首字 → 消息完成」耗时合计（毫秒），只累计 ttftMs 与 output 兼备的调用。 */
	readonly decodeMs: number;
	/** 与 decodeMs 同一批调用的 provider 上报 output token 合计。 */
	readonly decodeTokens: number;
	/** 五字段 + cost 的累计；细分字段（reasoning 等）只在有上报时出现。 */
	readonly usage: TokenUsage;
	/** cacheRead 占 prompt 侧三桶之和（billedInputTokens）的比例；还没有过带用量的响应为 undefined。 */
	readonly cacheHitRate: number | undefined;
	/**
	 * 这个会话的 provider 是否上报过缓存活动（判定口径见 `cacheHitRate`）。
	 * 从未上报过时命中率整体不显示 —— 「不支持缓存」与「命中 0%」不是一回事。
	 * 与 cacheHitRate 分开存：renderer 的单步行要按同一个判定显示「—」，
	 * 而单步自己没有足够信息判断 provider 是否支持缓存。
	 */
	readonly cacheReported: boolean;
	/** 最新一条台账条目的时刻，卡片排序（最近活跃在前）用。 */
	readonly lastActiveAt: number;
}

/** 平均首字延迟（毫秒）：ttftMs / ttftCalls。没有带 TTFT 的调用时为 undefined。 */
export function averageTtftMs(stats: SessionStatCard): number | undefined {
	return stats.ttftCalls === 0 ? undefined : stats.ttftMs / stats.ttftCalls;
}

/**
 * 解码速度（tok/s）：decodeTokens / (decodeMs / 1000)。
 * 只统计「既有首字延迟、又有 output 上报」的调用（dsh 同口径）——
 * 没有这样的样本时返回 undefined，UI 整项不显示，而不是显示一个 0。
 */
export function decodeTokensPerSecond(stats: SessionStatCard): number | undefined {
	if (stats.decodeMs <= 0) return undefined;
	return stats.decodeTokens / (stats.decodeMs / 1000);
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
 * 单次模型调用的边界（映射 pi 的 turn_start → 助手 message_end；UI 不呈现「轮」，
 * 只进台账）。条目在助手消息完成时整条写入 —— 崩溃丢失的是这一次调用本身，
 * 由 run 级合成闭合兜底，不补半成品条目。
 *
 * **endedAt 取 message_end 而不是 pi 的 turn_end**（2026-09-17 修正）：pi 的
 * turn_end 是「这一轮全部结束」——工具结果都 append 完才 emit（agent-session.js
 * "A turn ends after its assistant message and every tool result has been
 * appended"）。挂在 turn_end 会把本轮工具执行时间算进模型耗时：tok/s 的分母
 * 虚高（多 agent 场景一个 task 工具就是几分钟，面板上的 3 tok/s 即由此来）、
 * llmMs 与 toolMs 相互重叠，而且台账顺序会变成「先工具后 llm_call」—— renderer
 * 的 foldRunSteps 按位置归属工具，于是每轮的工具都挂到上一步头上。
 */
export interface LlmCallData {
	readonly runId?: RunId;
	/** 本 run 内第几轮（宿主侧计数，run 内从 0 起）。 */
	readonly turnIndex: number;
	readonly startedAt: number;
	readonly endedAt: number;
	/**
	 * 首个模型输出到达时刻 − startedAt（毫秒）。正文 / 思考 / 工具调用参数
	 * 任一先到都算（纯工具调用的轮次也有首字）。整轮没有任何输出 delta 时缺省
	 * —— 缺它就取不到解码窗口样本（stepDecode 返回 undefined），不拿全程耗时
	 * 冒充解码时长。
	 */
	readonly ttftMs?: number;
	/** pi StopReason（stop/length/toolUse/error/aborted…）。 */
	readonly stopReason?: string;
	/** 本轮 usage 全字段（助手 message_end 携带）。 */
	readonly usage?: TokenUsage;
	readonly errorMessage?: string;
}

/**
 * 单步的解码窗口与其中的输出 token。
 *
 * **口径唯一处**：daemon 的会话级累加（`core/observability.ts` 的 foldLlmCall）
 * 与侧栏的单步显示都调它 —— 两处各算一遍必然漂移，而这个数字（tok/s 的分子
 * 分母）最容易在两处写得不一样。
 *
 * 只有 `ttftMs` 与 `usage` 兼备时才有样本（同 dsh「仅统计 ttftMs 与 output
 * 兼备的步」）：缺任一项就返回 undefined，而不是拿全程耗时当分母 ——
 * 那会把没有首字记录的轮次算成极慢。
 *
 * 分母的纯度由 `LlmCallData.endedAt` 的取值保证（助手 message_end，不含本轮
 * 工具执行）—— 见该类型的注释，改那边等于改这里。
 */
export function stepDecode(
	data: LlmCallData,
): { readonly ms: number; readonly tokens: number } | undefined {
	if (data.ttftMs === undefined || data.usage === undefined) return undefined;
	const elapsed = Math.max(0, data.endedAt - data.startedAt);
	return {
		ms: Math.max(0, elapsed - Math.max(0, data.ttftMs)),
		tokens: data.usage.output,
	};
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
	/**
	 * hidden context（F5）注入块的字符数。快照在**注入之后**记录（钩子包装
	 * 顺序见 session-host），所以这部分字符已含在最后一条 user 消息的计数里
	 * —— 这个字段把它拆出来亮明，面板的成分视图据此单列一行。
	 * 缺席 = 该次调用没有注入（run 已清账后的压缩调用等）。
	 */
	readonly hiddenContextChars?: number;
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
