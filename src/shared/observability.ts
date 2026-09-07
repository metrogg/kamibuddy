/**
 * 可观测性领域类型 —— 诊断页与 daemon 统计快照共用的形状。
 *
 * 与 session-events.ts 的分工：那边是「给聊天 UI 渲染用」的实时事件流，
 * 这里是「给诊断页看」的聚合结果。聚合发生在 daemon（core/observability.ts），
 * renderer 只拿快照、不做二次计算——两端各算一份必然漂移（同 conversation.ts 的理由）。
 */

import type { RunId } from "./session-events.ts";

/** 一次或多次模型调用的 token 用量。cost 为美元总计。 */
export interface TokenUsage {
	readonly input: number;
	readonly output: number;
	readonly cacheRead: number;
	readonly cacheWrite: number;
	readonly totalTokens: number;
	readonly cost: number;
}

export function emptyUsage(): TokenUsage {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0 };
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

/** 一次用户提问到 agent 停止的完整过程（与 SessionEvent 的 RunId 对应）。 */
export interface RunRecord {
	readonly runId: RunId;
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

/** daemon 诊断页快照。statsSnapshot 通道的返回形状。 */
export interface ObservabilitySnapshot {
	/** daemon 进程启动时间，用于区分「累计」的口径（进程内累计，非历史持久化）。 */
	readonly startedAt: number;
	/** 全进程累计用量（本会话作废重开也会带上之前任务的）。 */
	readonly totalUsage: TokenUsage;
	readonly totalRuns: number;
	readonly totalErrors: number;
	/** 最近的 run，新的在前。上限见 core/observability.ts。 */
	readonly runs: readonly RunRecord[];
	readonly tools: readonly ToolStat[];
	/** 上下文成分估算。还没有任何会话内容时为 undefined。 */
	readonly composition: ContextComposition | undefined;
	/** 当前上下文占用（同 SessionState.contextUsage）。 */
	readonly contextUsage: { readonly usedTokens: number; readonly maxTokens: number } | undefined;
	/** 事件日志目录（JSONL 落盘位置），诊断页「打开日志目录」按钮用。 */
	readonly logDir: string;
}
