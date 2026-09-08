/**
 * 可观测性聚合器：把 SessionEvent 流折叠成诊断页快照。
 *
 * 为什么单独一个模块而不是塞进 daemon/index.ts：
 * daemon/index.ts 的职责注释写明「只做帧循环和进程级诊断」，
 * 聚合逻辑有状态、有规则，放这里可以脱离 Electron 和 pi 单测
 * （core/ 不许 import pi / electron，AGENTS.md §1）。
 *
 * 数据源只有一条：daemon 的 emitSessionEvent 出口。
 * 聊天 UI 和诊断页消费的是同一条事件流，不会出现「两个口径」。
 *
 * 口径说明：所有累计值都是**进程内**的（daemon 启动至今），不做历史持久化。
 * 会话作废重开（新建任务/换空间）不清统计——那属于使用量，属于用户而不是某个会话。
 */

import {
	type ContextComposition,
	type ObservabilitySnapshot,
	type RunRecord,
	type TokenUsage,
	type ToolStat,
} from "../shared/observability.ts";
import type {
	ConversationEntry,
	SessionEvent,
	ToolOutcome,
} from "../shared/session-events.ts";

/** 保留的最近 run 数。再多对诊断页没有意义，还占内存。 */
const MAX_RUNS = 50;

/**
 * 把文本粗估成 token 数。
 *
 * pi 不提供按类别拆分的上下文用量，只有总数（getContextUsage）。
 * 成分估算用来回答「上下文是被对话、思考还是工具结果吃掉的」：
 * CJK 字符按约 1 token/字，其余按约 4 字符/token（现代 BPE 分词器的经验值）。
 * 诊断页必须标注「估算」——它是比例尺，不是账单。
 */
export function estimateTokens(text: string): number {
	let cjk = 0;
	let other = 0;
	for (const ch of text) {
		const code = ch.codePointAt(0) ?? 0;
		// CJK 统一表意文字 + 扩展 A + 兼容表意 + 全角符号/假名。
		if (
			(code >= 0x2e80 && code <= 0x9fff) ||
			(code >= 0xf900 && code <= 0xfaff) ||
			(code >= 0xff00 && code <= 0xffef)
		) {
			cjk += 1;
		} else {
			other += 1;
		}
	}
	return Math.ceil(cjk + other / 4);
}

/** 会话条目 → 上下文成分估算。system 由调用方给（daemon 在组装提示词时算好）。 */
export function estimateComposition(
	entries: readonly ConversationEntry[],
	systemPromptTokens: number,
): ContextComposition | undefined {
	if (entries.length === 0 && systemPromptTokens === 0) return undefined;
	const composition = {
		system: systemPromptTokens,
		user: 0,
		assistant: 0,
		thinking: 0,
		tools: 0,
	};
	for (const entry of entries) {
		if (entry.role === "user") {
			composition.user += estimateTokens(entry.text);
		} else if (entry.role === "assistant") {
			composition.assistant += estimateTokens(entry.text);
			composition.thinking += estimateTokens(entry.thinking ?? "");
		} else if (entry.role === "tool") {
			composition.tools += estimateTokens(
				`${entry.summary}\n${entry.detail ?? ""}`,
			);
		}
		// error 条目不在模型上下文里（纯 UI 历史，见 ErrorEntry 注释），不计入估算。
	}
	return composition;
}

/** 内部累计用的可变形态；对外只暴露 TokenUsage 快照副本。 */
type MutableUsage = { -readonly [K in keyof TokenUsage]: number };

function mutableUsage(): MutableUsage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: 0,
	};
}

function addUsage(total: MutableUsage, delta: TokenUsage): void {
	total.input += delta.input;
	total.output += delta.output;
	total.cacheRead += delta.cacheRead;
	total.cacheWrite += delta.cacheWrite;
	total.totalTokens += delta.totalTokens;
	total.cost += delta.cost;
}

interface MutableToolSpan {
	toolName: string;
	label: string;
	summary: string;
	startedAt: number;
	endedAt: number | undefined;
	outcome: ToolOutcome | undefined;
}

interface MutableRun {
	runId: string;
	startedAt: number;
	endedAt: number | undefined;
	status: "running" | "ok" | "error";
	error: string | undefined;
	modelId: string | undefined;
	sceneId: string;
	interactionId: string;
	usage: MutableUsage | undefined;
	toolCalls: number;
	toolErrors: number;
	/** 时间线数据。按 toolCallId 建索引，tool_finished 时回填终态。 */
	toolSpans: Map<string, MutableToolSpan>;
}

interface MutableToolStat {
	label: string;
	calls: number;
	errors: number;
	totalMs: number;
	finished: number;
}

export class ObservabilityStore {
	private readonly startedAt: number;
	private readonly now: () => number;
	/** 全进程累计用量。 */
	private readonly totalUsage = mutableUsage();
	private totalRuns = 0;
	private totalErrors = 0;
	/** 新的在前（unshift），快照直接截取。 */
	private readonly runs: MutableRun[] = [];
	/** runId → 进行中的 run，run_finished / run_error 时回填终态。 */
	private currentRun: MutableRun | undefined;
	private readonly tools = new Map<string, MutableToolStat>();
	/** toolCallId → 开始时间，tool_finished 时算耗时。 */
	private readonly openTools = new Map<string, number>();
	/** 最近一次 session_state 里的模型与两轴，作为下一条 run_started 的快照信息。 */
	private activeModelId: string | undefined;
	private activeSceneId = "";
	private activeInteractionId = "";

	constructor(now: () => number = Date.now) {
		this.startedAt = now();
		this.now = now;
	}

	record(event: SessionEvent): void {
		switch (event.type) {
			case "session_state": {
				this.activeModelId = event.state.modelId;
				this.activeSceneId = event.state.sceneId;
				this.activeInteractionId = event.state.interactionId;
				return;
			}

			case "run_started": {
				const run: MutableRun = {
					runId: event.runId,
					startedAt: this.now(),
					endedAt: undefined,
					status: "running",
					error: undefined,
					modelId: this.activeModelId,
					sceneId: this.activeSceneId,
					interactionId: this.activeInteractionId,
					usage: undefined,
					toolCalls: 0,
					toolErrors: 0,
					toolSpans: new Map(),
				};
				this.currentRun = run;
				this.runs.unshift(run);
				if (this.runs.length > MAX_RUNS) this.runs.pop();
				this.totalRuns += 1;
				return;
			}

			case "assistant_done": {
				const usage = event.message.usage;
				if (usage === undefined) return;
				addUsage(this.totalUsage, usage);
				const run = this.currentRun;
				if (run !== undefined) {
					if (run.usage === undefined) run.usage = mutableUsage();
					addUsage(run.usage, usage);
				}
				return;
			}

			case "tool_started": {
				this.openTools.set(event.card.id, event.card.at);
				const run = this.currentRun;
				if (run !== undefined) {
					run.toolCalls += 1;
					run.toolSpans.set(event.card.id, {
						toolName: event.card.toolName,
						label: event.card.label,
						summary: event.card.summary,
						startedAt: event.card.at,
						endedAt: undefined,
						outcome: undefined,
					});
				}
				const stat = this.toolStat(event.card.toolName, event.card.label);
				stat.calls += 1;
				return;
			}

			case "tool_finished": {
				const started = this.openTools.get(event.card.id);
				this.openTools.delete(event.card.id);
				const span = this.currentRun?.toolSpans.get(event.card.id);
				if (span !== undefined) {
					span.endedAt = this.now();
					span.outcome = event.card.outcome;
				}
				const stat = this.toolStat(event.card.toolName, event.card.label);
				if (event.card.outcome === "error") {
					stat.errors += 1;
					if (this.currentRun !== undefined) this.currentRun.toolErrors += 1;
				}
				if (started !== undefined) {
					stat.totalMs += this.now() - started;
					stat.finished += 1;
				}
				return;
			}

			case "run_finished": {
				this.finishRun("ok", undefined);
				return;
			}

			case "run_error": {
				this.finishRun("error", event.message);
				return;
			}

			default:
				return;
		}
	}

	private finishRun(status: "ok" | "error", error: string | undefined): void {
		const run = this.currentRun;
		if (run === undefined) return;
		// 只统计「从 running 转 error」的那一次：pi 的模型报错路径是
		// message_end 发 run_error、随后 agent_end 再发 run_finished，
		// 在这里计数保证一个 run 至多算一次错误。
		if (status === "error") this.totalErrors += 1;
		run.status = status;
		run.error = error;
		run.endedAt = this.now();
		this.currentRun = undefined;
	}

	private toolStat(toolName: string, label: string): MutableToolStat {
		let stat = this.tools.get(toolName);
		if (stat === undefined) {
			stat = { label, calls: 0, errors: 0, totalMs: 0, finished: 0 };
			this.tools.set(toolName, stat);
		}
		return stat;
	}

	snapshot(args: {
		readonly entries: readonly ConversationEntry[];
		readonly systemPromptTokens: number;
		readonly contextUsage:
			{ readonly usedTokens: number; readonly maxTokens: number } | undefined;
		readonly logDir: string;
	}): ObservabilitySnapshot {
		const tools: ToolStat[] = [...this.tools.entries()]
			.map(([toolName, s]) => ({
				toolName,
				label: s.label,
				calls: s.calls,
				errors: s.errors,
				avgMs: s.finished === 0 ? 0 : Math.round(s.totalMs / s.finished),
			}))
			.sort((a, b) => b.calls - a.calls);

		return {
			startedAt: this.startedAt,
			totalUsage: { ...this.totalUsage },
			totalRuns: this.totalRuns,
			totalErrors: this.totalErrors,
			runs: this.runs.map((r): RunRecord => {
				const { toolSpans, ...rest } = r;
				return {
					...rest,
					usage: r.usage === undefined ? undefined : { ...r.usage },
					toolSpans: [...toolSpans.values()].map((s) => ({ ...s })),
				};
			}),
			tools,
			composition: estimateComposition(args.entries, args.systemPromptTokens),
			contextUsage: args.contextUsage,
			logDir: args.logDir,
		};
	}
}
