/**
 * 可观测性聚合器：台账 fold 投影（spec: add-observability-ledger Task 3）。
 *
 * 为什么单独一个模块而不是塞进 daemon/index.ts：
 * daemon/index.ts 的职责注释写明「只做帧循环和进程级诊断」，
 * 聚合逻辑有状态、有规则，放这里可以脱离 Electron 和 pi 单测
 * （core/ 不许 import pi / electron，AGENTS.md §1）。
 *
 * 数据源两条，职责切分钉死（防双计）：
 *
 * 1. **实时 SessionEvent 流**（record()，daemon emitSessionEvent 出口）——
 *    只负责「本进程新产生的」run 卡片 / 工具统计 / 进程累计用量。
 *    聊天 UI 和诊断页消费的是同一条事件流，不会出现「两个口径」。
 * 2. **运行台账**（logs/runs/*.jsonl）——启动 replayLedgerDir() 全量回放
 *    重建历史聚合（重启不清零）；之后 RunLedger 的 onAppended 钩子把新条目
 *    喂给 foldLedgerEntry() 做增量 fold。台账路径负责：历史 run 卡片重建、
 *    会话级统计（turns/llmMs/toolMs/usage）、缓存浪费归因。
 *    实时路径产生的 run 卡片不走台账重复建（同一条 run 两边都建就双计了）；
 *    台账 llm_call 的 usage 只进会话级统计与回放期的进程累计，不进实时期
 *    的进程累计（实时期由 assistant_done 记账）。
 *
 * 窗口口径（dsh watermark 续 fold 的简化版）：台账是全量真相，每次启动完整
 * 重放（量小：每 run 几十条），不做 watermark 断点续 fold；「窗口」只作用于
 * 内存里的 run 卡片 —— 每会话保留最近 MAX_RUNS_PER_SESSION 条 + 快照只出
 * 近 RUN_CARD_WINDOW_MS 的卡片。计数器（total 系 / sessions / cacheWaste）不受
 * 窗口影响，是台账全历史累计。
 */

import { basename } from "node:path";
import {
	cacheHitRate,
	type CacheMissReason,
	type CacheMissRecord,
	type ContextComposition,
	type LlmCallData,
	type ObservabilitySnapshot,
	type RunEndData,
	type RunLedgerEntry,
	type RunRecord,
	type RunStartData,
	type SessionStatCard,
	type TokenUsage,
	type ToolCallData,
	type ToolStat,
} from "../shared/observability.ts";
import type {
	ConversationEntry,
	SessionEvent,
	ToolOutcome,
} from "../shared/session-events.ts";
import {
	listLedgerFiles,
	readLedgerEntries,
	type LedgerReport,
} from "./run-ledger.ts";

/**
 * 每会话保留的最近 run 卡片数。再多对诊断页没有意义，还占内存；
 * 被裁掉的 run 仍在 total 系 / sessions 计数器里（窗口只裁卡片不裁账）。
 */
const MAX_RUNS_PER_SESSION = 20;

/** run 卡片的全局时间窗：近 30 天。更早的 run 只留在计数器里。 */
const RUN_CARD_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * prompt 缓存 TTL：相邻两次请求的间隔超过它就按「空闲失效」归因。
 * Anthropic 默认缓存 TTL 5 分钟（同 pi cache-stats 的 CACHE_TTL_MS）。
 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/** 单次 miss 低于这个量按缓存断点粒度噪声处理，不计入（同 pi NOISE_FLOOR_TOKENS）。 */
const CACHE_MISS_NOISE_FLOOR_TOKENS = 1024;

/** 快照里保留的最近 miss 明细条数（合计不受此限）。 */
const MAX_CACHE_MISSES = 50;

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

/**
 * 内部累计用的可变形态；对外只暴露 TokenUsage 快照副本。
 * 细分字段（reasoning / cacheWrite1h / costBreakdown）用 undefined 表示
 * 「从未上报」——「没上报」与「累计为零」两回事（TokenUsage 注释），
 * 任何一个贡献者上报过，累计字段才出现（Task 3.1）。
 */
interface MutableCostBreakdown {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
}

interface MutableUsage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: number;
	reasoning: number | undefined;
	cacheWrite1h: number | undefined;
	costBreakdown: MutableCostBreakdown | undefined;
}

function mutableUsage(): MutableUsage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: 0,
		reasoning: undefined,
		cacheWrite1h: undefined,
		costBreakdown: undefined,
	};
}

function addUsage(total: MutableUsage, delta: TokenUsage): void {
	total.input += delta.input;
	total.output += delta.output;
	total.cacheRead += delta.cacheRead;
	total.cacheWrite += delta.cacheWrite;
	total.totalTokens += delta.totalTokens;
	total.cost += delta.cost;
	if (delta.reasoning !== undefined) {
		total.reasoning = (total.reasoning ?? 0) + delta.reasoning;
	}
	if (delta.cacheWrite1h !== undefined) {
		total.cacheWrite1h = (total.cacheWrite1h ?? 0) + delta.cacheWrite1h;
	}
	if (delta.costBreakdown !== undefined) {
		const bd = delta.costBreakdown;
		if (total.costBreakdown === undefined) {
			total.costBreakdown = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
		}
		total.costBreakdown.input += bd.input;
		total.costBreakdown.output += bd.output;
		total.costBreakdown.cacheRead += bd.cacheRead;
		total.costBreakdown.cacheWrite += bd.cacheWrite;
	}
}

/** 累计 → 快照副本；未上报过的细分字段键缺席（不补零，见 MutableUsage 注释）。 */
function freezeUsage(usage: MutableUsage): TokenUsage {
	return {
		input: usage.input,
		output: usage.output,
		cacheRead: usage.cacheRead,
		cacheWrite: usage.cacheWrite,
		totalTokens: usage.totalTokens,
		cost: usage.cost,
		...(usage.reasoning === undefined ? {} : { reasoning: usage.reasoning }),
		...(usage.cacheWrite1h === undefined ? {} : { cacheWrite1h: usage.cacheWrite1h }),
		...(usage.costBreakdown === undefined
			? {}
			: { costBreakdown: { ...usage.costBreakdown } }),
	};
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
	sessionId: string;
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

/** 缓存浪费 fold 的「上一次请求」状态（pi cache-stats 的 PreviousRequest 移植）。 */
interface PreviousRequest {
	/** 上次请求的 prompt 侧 token 总量（input + cacheRead + cacheWrite）。 */
	promptTokens: number;
	/** 上次请求时的模型（run_start 携带）；未知为 undefined（换模判定按未变处理）。 */
	modelKey: string | undefined;
	/** 上次请求的完成时刻（缓存写入完成的保守估计点）。 */
	endedAt: number;
	/**
	 * 粘性标记：本段扫描里曾有请求上报过缓存活动。区分「只读缓存的服务商
	 * 全 miss」与「服务商从不报缓存」（后者零缓存轮不计 miss，同 pi）。
	 */
	reportedCache: boolean;
}

/** 会话级统计的可变累计（台账 fold；快照时 freeze 成 SessionStatCard）。 */
interface MutableSessionStats {
	runs: number;
	turns: number;
	llmMs: number;
	toolMs: number;
	usage: MutableUsage;
	lastActiveAt: number;
	/** 缓存 fold 状态：当前 run 的模型（run_start 记账，llm_call 自身不带模型字段）。 */
	currentRunModel: string | undefined;
	prevRequest: PreviousRequest | undefined;
}

function mutableSessionStats(): MutableSessionStats {
	return {
		runs: 0,
		turns: 0,
		llmMs: 0,
		toolMs: 0,
		usage: mutableUsage(),
		lastActiveAt: 0,
		currentRunModel: undefined,
		prevRequest: undefined,
	};
}

/**
 * 单次 miss 的多花成本（pi detectMiss 的移植）。
 * 多花 = missed token 按实付价（input/cacheWrite 档，含写溢价）与缓存读价的差。
 * 与 pi 的差异：fold 侧没有定价表（cacheRead 为零时 pi 回查 models.dev 读价），
 * 读价未知按 0 计 —— 结果是 missedCost 偏保守（略高估），注释钉住防误改。
 * usage 无 costBreakdown 时定价整体未知，按 pi 同口径返回 0。
 */
function missedCost(usage: TokenUsage, missedTokens: number): number {
	const bd = usage.costBreakdown;
	if (bd === undefined) return 0;
	const paidTokens = usage.input + usage.cacheWrite;
	const paidPerToken =
		paidTokens > 0 ? (bd.input + bd.cacheWrite) / paidTokens : 0;
	const readPerToken = usage.cacheRead > 0 ? bd.cacheRead / usage.cacheRead : 0;
	return missedTokens * Math.max(0, paidPerToken - readPerToken);
}

export class ObservabilityStore {
	private readonly startedAt: number;
	private readonly now: () => number;
	/** 全进程累计用量（回放历史 + 实时增量）。 */
	private readonly totalUsage = mutableUsage();
	private totalRuns = 0;
	private totalErrors = 0;
	/** sessionId → run 卡片（新的在前 unshift，按 MAX_RUNS_PER_SESSION 截尾）。 */
	private readonly runsBySession = new Map<string, MutableRun[]>();
	/** runId → 进行中的 run，run_finished / run_error 时回填终态。 */
	private currentRun: MutableRun | undefined;
	private readonly tools = new Map<string, MutableToolStat>();
	/** toolCallId → 开始时间，tool_finished 时算耗时。 */
	private readonly openTools = new Map<string, number>();
	/** sessionId → 最近一次 session_state 的模型与两轴，作为该会话下一条 run_started 的快照信息。 */
	private readonly axesBySession = new Map<
		string,
		{ modelId: string | undefined; sceneId: string; interactionId: string }
	>();
	/** sessionId → 会话级统计累计（台账 fold，重启经回放续上）。 */
	private readonly sessions = new Map<string, MutableSessionStats>();
	/** 缓存浪费合计与明细（新的在前 unshift，按 MAX_CACHE_MISSES 截尾）。 */
	private readonly cacheWaste = { missedTokens: 0, missedCost: 0, missCount: 0 };
	private readonly cacheMisses: CacheMissRecord[] = [];

	constructor(now: () => number = Date.now) {
		this.startedAt = now();
		this.now = now;
	}

	/* ── 台账 fold（历史回放 + 增量共用同一条 fold）────────────────── */

	/**
	 * 启动回放：fold 目录下全部台账文件重建聚合。
	 * 只在启动时调一次（重复调用会把历史重复累计）；调用前必须先
	 * RunLedger.sealOrphans —— 否则中断的 run 没有合成闭合，回放会把它们
	 * 当成「至今仍在跑」。
	 */
	replayLedgerDir(dir: string, report: LedgerReport): void {
		for (const filePath of listLedgerFiles(dir)) {
			// 文件名即 sessionId（ledgerFileName 的安全化对 pi nanoid 是恒等映射）。
			const sessionId = basename(filePath, ".jsonl");
			this.replaySessionLedger(sessionId, readLedgerEntries(filePath, report));
		}
	}

	/** 回放单会话台账：run 卡片重建 + 会话级/缓存 fold（与增量共用 foldLedgerEntry）。 */
	private replaySessionLedger(
		sessionId: string,
		entries: readonly RunLedgerEntry[],
	): void {
		let open: MutableRun | undefined;
		for (const entry of entries) {
			this.foldLedgerEntry(sessionId, entry);
			switch (entry.kind) {
				case "run_start": {
					const data = entry.data as RunStartData;
					open = {
						runId: data.runId,
						sessionId,
						startedAt: entry.at,
						endedAt: undefined,
						status: "running",
						error: undefined,
						modelId: data.modelId,
						// 台账不记两轴（run_start 只有模型），回放卡片的两轴留空。
						sceneId: "",
						interactionId: "",
						usage: undefined,
						toolCalls: 0,
						toolErrors: 0,
						toolSpans: new Map(),
					};
					break;
				}
				case "llm_call": {
					const data = entry.data as LlmCallData;
					if (data.usage !== undefined) {
						addUsage(this.totalUsage, data.usage);
						if (open !== undefined) {
							if (open.usage === undefined) open.usage = mutableUsage();
							addUsage(open.usage, data.usage);
						}
					}
					break;
				}
				case "tool_call": {
					const data = entry.data as ToolCallData;
					const ms = Math.max(0, data.endedAt - data.startedAt);
					const stat = this.toolStat(data.toolName, data.toolName);
					stat.calls += 1;
					stat.totalMs += ms;
					stat.finished += 1;
					if (data.outcome === "error") stat.errors += 1;
					if (open !== undefined) {
						open.toolCalls += 1;
						if (data.outcome === "error") open.toolErrors += 1;
						// ToolCallData 无 label 字段（台账格式如此），回放泳道的标签回退工具名。
						open.toolSpans.set(data.toolCallId, {
							toolName: data.toolName,
							label: data.toolName,
							summary: data.summary,
							startedAt: data.startedAt,
							endedAt: data.endedAt,
							outcome: data.outcome,
						});
					}
					break;
				}
				case "run_end": {
					if (open === undefined) break;
					const data = entry.data as RunEndData;
					open.endedAt = entry.at;
					if (data.reason === "error") {
						open.status = "error";
						open.error = data.error;
						this.totalErrors += 1;
					} else if (data.reason === "interrupted") {
						// 中断（含合成闭合）不是正常结束，卡片显示 ok 会掩盖崩溃；
						// 但不计入 totalErrors —— 那个口径是「真实失败次数」。
						open.status = "error";
						open.error = "进程中断，台账合成闭合";
					} else {
						open.status = "ok";
					}
					this.pushRunCard(open);
					this.totalRuns += 1;
					open = undefined;
					break;
				}
				default:
					break;
			}
		}
		// 文件末尾仍开着的 run（不该发生——sealOrphans 先跑过）按中断卡片收尾，
		// 响亮留在诊断页而不是悄悄丢掉。
		if (open !== undefined) {
			open.status = "error";
			open.error = "台账缺少 run_end（疑似写入丢失）";
			this.pushRunCard(open);
			this.totalRuns += 1;
		}
	}

	/**
	 * 增量 fold：一条台账条目到账即投影（RunLedger onAppended 钩子喂入）。
	 * 只进会话级统计与缓存浪费 —— 实时 run 卡片由 record() 建，两边都建就双计了。
	 */
	foldLedgerEntry(sessionId: string, entry: RunLedgerEntry): void {
		const stats = this.sessionStats(sessionId);
		if (entry.at > stats.lastActiveAt) stats.lastActiveAt = entry.at;
		switch (entry.kind) {
			case "run_start": {
				stats.runs += 1;
				stats.currentRunModel = (entry.data as RunStartData).modelId;
				return;
			}
			case "run_end": {
				stats.currentRunModel = undefined;
				return;
			}
			case "llm_call": {
				this.foldLlmCall(sessionId, stats, entry.data as LlmCallData);
				return;
			}
			case "tool_call": {
				const data = entry.data as ToolCallData;
				stats.toolMs += Math.max(0, data.endedAt - data.startedAt);
				return;
			}
			case "compaction": {
				// 上下文合法变了：下一轮的 prompt 是新内容不是重计费内容，重置对比基线
				// （同 pi cache-stats 对 compaction/branch_summary 的处理；换模不豁免）。
				stats.prevRequest = undefined;
				return;
			}
			default:
				// retry / queue / request_snapshot 不进聚合（Task 4 直接从台账读明细）。
				return;
		}
	}

	/** llm_call 的会话级累计 + 缓存浪费归因（pi cache-stats 的 scan 移植）。 */
	private foldLlmCall(
		sessionId: string,
		stats: MutableSessionStats,
		data: LlmCallData,
	): void {
		stats.turns += 1;
		stats.llmMs += Math.max(0, data.endedAt - data.startedAt);
		const usage = data.usage;
		if (usage === undefined) return;
		addUsage(stats.usage, usage);

		const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
		// 零 prompt 轮（异常路径）不提供对比信息，基线不动（同 pi asPreviousRequest）。
		if (promptTokens <= 0) return;
		const prev = stats.prevRequest;
		const modelKey = stats.currentRunModel;
		if (
			prev !== undefined &&
			(usage.cacheRead + usage.cacheWrite > 0 || prev.reportedCache)
		) {
			const missedTokens =
				Math.min(prev.promptTokens, promptTokens) - usage.cacheRead;
			if (missedTokens > CACHE_MISS_NOISE_FLOOR_TOKENS) {
				const idleMs = Math.max(0, data.startedAt - prev.endedAt);
				const modelChanged =
					modelKey !== undefined &&
					prev.modelKey !== undefined &&
					modelKey !== prev.modelKey;
				const reason: CacheMissReason = modelChanged
					? "model_change"
					: idleMs >= CACHE_TTL_MS
						? "idle_ttl"
						: "other";
				const cost = missedCost(usage, missedTokens);
				this.cacheWaste.missedTokens += missedTokens;
				this.cacheWaste.missedCost += cost;
				this.cacheWaste.missCount += 1;
				this.cacheMisses.unshift({
					sessionId,
					at: data.startedAt,
					missedTokens,
					missedCost: cost,
					idleMs,
					reason,
				});
				if (this.cacheMisses.length > MAX_CACHE_MISSES) this.cacheMisses.pop();
			}
		}
		stats.prevRequest = {
			promptTokens,
			modelKey,
			endedAt: data.endedAt,
			reportedCache:
				(prev?.reportedCache ?? false) || usage.cacheRead + usage.cacheWrite > 0,
		};
	}

	private sessionStats(sessionId: string): MutableSessionStats {
		let stats = this.sessions.get(sessionId);
		if (stats === undefined) {
			stats = mutableSessionStats();
			this.sessions.set(sessionId, stats);
		}
		return stats;
	}

	private pushRunCard(run: MutableRun): void {
		let bucket = this.runsBySession.get(run.sessionId);
		if (bucket === undefined) {
			bucket = [];
			this.runsBySession.set(run.sessionId, bucket);
		}
		bucket.unshift(run);
		if (bucket.length > MAX_RUNS_PER_SESSION) bucket.pop();
	}

	/* ── 实时事件投影（本进程新产生的 run 卡片 / 工具统计 / 进程累计）─── */

	record(sessionId: string, event: SessionEvent): void {
		switch (event.type) {
			case "session_state": {
				this.axesBySession.set(sessionId, {
					modelId: event.state.modelId,
					sceneId: event.state.sceneId,
					interactionId: event.state.interactionId,
				});
				return;
			}

			case "run_started": {
				const axes = this.axesBySession.get(sessionId);
				const run: MutableRun = {
					runId: event.runId,
					sessionId,
					startedAt: this.now(),
					endedAt: undefined,
					status: "running",
					error: undefined,
					modelId: axes?.modelId,
					sceneId: axes?.sceneId ?? "",
					interactionId: axes?.interactionId ?? "",
					usage: undefined,
					toolCalls: 0,
					toolErrors: 0,
					toolSpans: new Map(),
				};
				this.currentRun = run;
				this.pushRunCard(run);
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
				// 台账回放建 stat 时用工具名兜底过 label；实时卡片到达后刷成中文标签。
				stat.label = event.card.label;
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

		// 全局时间窗过滤 + 跨会话按开始时间倒序（每会话桶内已是倒序，这里合并）。
		const windowStart = this.now() - RUN_CARD_WINDOW_MS;
		const runs: RunRecord[] = [...this.runsBySession.values()]
			.flat()
			.filter((r) => r.startedAt >= windowStart)
			.sort((a, b) => b.startedAt - a.startedAt)
			.map((r): RunRecord => {
				const { toolSpans, ...rest } = r;
				return {
					...rest,
					usage: r.usage === undefined ? undefined : freezeUsage(r.usage),
					toolSpans: [...toolSpans.values()].map((s) => ({ ...s })),
				};
			});

		const sessions: SessionStatCard[] = [...this.sessions.entries()]
			.map(([sessionId, s]): SessionStatCard => {
				const usage = freezeUsage(s.usage);
				return {
					sessionId,
					runs: s.runs,
					turns: s.turns,
					llmMs: s.llmMs,
					toolMs: s.toolMs,
					usage,
					cacheHitRate: cacheHitRate(usage),
					lastActiveAt: s.lastActiveAt,
				};
			})
			.sort((a, b) => b.lastActiveAt - a.lastActiveAt);

		return {
			startedAt: this.startedAt,
			totalUsage: freezeUsage(this.totalUsage),
			totalRuns: this.totalRuns,
			totalErrors: this.totalErrors,
			runs,
			tools,
			sessions,
			cacheWaste: {
				...this.cacheWaste,
				misses: this.cacheMisses.map((m) => ({ ...m })),
			},
			composition: estimateComposition(args.entries, args.systemPromptTokens),
			contextUsage: args.contextUsage,
			logDir: args.logDir,
		};
	}
}
