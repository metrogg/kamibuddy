/**
 * 跨会话使用统计的聚合实现（spec: add-usage-stats）。
 *
 * 数据源是 **pi 会话 JSONL**（`getSessionsDir()`），不是运行台账 ——
 * core/run-ledger.ts 文件头明文写着「消息内容与 usage 明细在会话 JSONL 已有，
 * 不双写」，台账里没有按条的模型与用量。会话 JSONL 还是**唯一覆盖全历史**
 * 的来源（早于台账存在的旧会话也在内），与 WorkBuddy 读 session store 同构。
 *
 * 为什么自己解析而不走 pi 的 SessionManager.listAll：同 daemon/conversation-search.ts
 * 的理由（listAll 会把全部会话读成 SessionInfo，含汇合后的大段文本，全库扫描
 * 只为拿几个计数不划算），而且统计只需要条目上的时间戳 / 模型 / usage / 工具名，
 * 汇合后的结构反而把边界丢了。
 *
 * 直接读会话文件是 daemon 读自己的数据，不经权限门（与 conversation-search、
 * AutomationStore 同例）。单个文件损坏跳过不抛：一个坏文件不该让统计页整页报错
 * （pi 的 buildSessionInfo 对坏文件同样返回 null），但记 event-log 留现场。
 *
 * 会计口径（与 WorkBuddy `StatsServiceImpl.calculateStats` 对齐，差异见 spec.md）：
 * - 子代理会话（文件里有 `subagent_run` custom 条目）**不计入会话维度**
 *   （会话数 / 消息数 / 热力图 / 工具统计 / 连续天数）
 * - 但它的 token 与费用**照常计入**模型明细与总量（真实花费不能漏账）
 * - 没有任何 assistant 消息带可识别模型的会话整体跳过（legacy 口径）：
 *   它的产物归不到任何模型上，计进总数只会让明细与总量对不上
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import {
	emptyUsageStats,
	localDateKey,
	type ModelUsageStat,
	type ToolUsageStat,
	type UsageHeatmapDay,
	type UsageStats,
} from "../shared/usage-stats.ts";

/** 写入失败/坏文件的上报通道（daemon 接到 event-log）。只进不出，绝不回抛。 */
export type UsageStatsReport = (message: string) => void;

/** 无法识别的模型标记（pi 正常路径不会产出，兼容被改坏的历史数据）。 */
const UNKNOWN_MODEL = "unknown";

/** 子代理会话的溯源标记（core/session-host.ts markSubagentRun 写入）。 */
const SUBAGENT_CUSTOM_TYPE = "subagent_run";

/** 并行读文件的并发上限：够快压住 IO 等待，又不至于一次开几百个 fd。 */
const READ_CONCURRENCY = 8;

/** 一次模型调用的用量（只取聚合要的字段，其余不碰）。 */
interface ParsedUsage {
	readonly input: number;
	readonly output: number;
	readonly cacheRead: number;
	readonly cacheWrite: number;
	readonly total: number;
	readonly cost: number;
}

interface ParsedMessage {
	/** epoch ms。 */
	readonly at: number;
	readonly role: string;
	/** 仅 assistant 有值。 */
	readonly model: string | undefined;
	readonly usage: ParsedUsage | undefined;
}

interface ParsedToolCall {
	readonly toolCallId: string;
	readonly toolName: string;
}

/** 一个会话文件解析出的、聚合需要的全部内容（纯数据，无 IO 残留）。 */
export interface ParsedSession {
	readonly sessionId: string;
	readonly isSubagent: boolean;
	readonly messages: readonly ParsedMessage[];
	readonly toolCalls: readonly ParsedToolCall[];
	/** isError 的 toolResult 的 toolCallId。 */
	readonly toolErrorIds: ReadonlySet<string>;
}

/* ── 解析 ──────────────────────────────────────────────────────────── */

function asNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * 条目的时刻（epoch ms）。优先条目自身的 `timestamp`（pi 落的是 ISO 串，
 * 见 core/session-rebuild.ts 的 `Date.parse(entry.timestamp)`），
 * 退回消息体内的 `timestamp`（pi 的 AssistantMessage 上是毫秒数）。
 * 两者都取不到返回 undefined —— 调用方跳过该条，不用 now() 造一个假时刻
 * （假时刻会污染热力图，比丢一条更糟）。
 */
function entryTimeMs(entry: Record<string, unknown>, message: Record<string, unknown>): number | undefined {
	const fromEntry = entry["timestamp"];
	if (typeof fromEntry === "number" && Number.isFinite(fromEntry)) return fromEntry;
	if (typeof fromEntry === "string") {
		const parsed = Date.parse(fromEntry);
		if (Number.isFinite(parsed)) return parsed;
	}
	const fromMessage = message["timestamp"];
	if (typeof fromMessage === "number" && Number.isFinite(fromMessage)) return fromMessage;
	return undefined;
}

/** pi Usage → 聚合用用量。cost 取 `cost.total`（pi 的 Usage.cost 是四项分项带 total）。 */
function parseUsage(value: unknown): ParsedUsage | undefined {
	if (value === null || typeof value !== "object") return undefined;
	const usage = value as Record<string, unknown>;
	const input = asNumber(usage["input"]);
	const output = asNumber(usage["output"]);
	const cacheRead = asNumber(usage["cacheRead"]);
	const cacheWrite = asNumber(usage["cacheWrite"]);
	const cost = usage["cost"];
	const costTotal =
		cost !== null && typeof cost === "object" ? asNumber((cost as Record<string, unknown>)["total"]) : 0;
	return {
		input,
		output,
		cacheRead,
		cacheWrite,
		total: asNumber(usage["totalTokens"]) || input + output + cacheRead + cacheWrite,
		cost: costTotal,
	};
}

/** 从 assistant 的 content 里挑出 toolCall 块（诊断页同款判定：`type === "toolCall"`）。 */
function collectToolCalls(content: unknown, into: ParsedToolCall[]): void {
	if (!Array.isArray(content)) return;
	for (const block of content) {
		if (block === null || typeof block !== "object") continue;
		const candidate = block as Record<string, unknown>;
		if (candidate["type"] !== "toolCall") continue;
		const id = candidate["id"];
		const name = candidate["name"];
		if (typeof id !== "string" || typeof name !== "string" || name === "") continue;
		into.push({ toolCallId: id, toolName: name });
	}
}

/**
 * 解析一个会话文件的内容。**不是会话文件返回 null**（首行不是
 * `type: "session"` 的头部）—— 调用方据此跳过并留痕。
 */
export function parseSessionFile(content: string): ParsedSession | null {
	let sessionId: string | undefined;
	let sawHeader = false;
	let isSubagent = false;
	const messages: ParsedMessage[] = [];
	const toolCalls: ParsedToolCall[] = [];
	const toolErrorIds = new Set<string>();

	for (const line of content.split("\n")) {
		if (line.trim() === "") continue;
		let entry: Record<string, unknown>;
		try {
			entry = JSON.parse(line) as Record<string, unknown>;
		} catch {
			// 流式落盘被中断会留半行（pi 的 appendFileSync 不保证行原子）——跳过该行。
			continue;
		}
		if (!sawHeader) {
			if (entry["type"] !== "session" || typeof entry["id"] !== "string") return null;
			sawHeader = true;
			sessionId = entry["id"];
			continue;
		}
		if (entry["type"] === "custom") {
			if (entry["customType"] === SUBAGENT_CUSTOM_TYPE) isSubagent = true;
			continue;
		}
		if (entry["type"] !== "message") continue;

		const message = entry["message"];
		if (message === null || typeof message !== "object") continue;
		const body = message as Record<string, unknown>;
		const role = body["role"];
		if (typeof role !== "string") continue;

		if (role === "toolResult") {
			const toolCallId = body["toolCallId"];
			if (typeof toolCallId === "string" && body["isError"] === true) toolErrorIds.add(toolCallId);
			continue;
		}

		// 只把 user / assistant 当「消息」计数（与会话视图同口径）：
		// toolResult 是副产物、bashExecution / compactionSummary 等不是对话内容。
		if (role !== "user" && role !== "assistant") continue;
		const at = entryTimeMs(entry, body);
		if (at === undefined) continue;

		const model = body["model"];
		messages.push({
			at,
			role,
			model: typeof model === "string" && model !== "" ? model : undefined,
			usage: parseUsage(body["usage"]),
		});
		if (role === "assistant") collectToolCalls(body["content"], toolCalls);
	}

	if (!sawHeader || sessionId === undefined) return null;
	return { sessionId, isSubagent, messages, toolCalls, toolErrorIds };
}

/* ── 聚合 ──────────────────────────────────────────────────────────── */

function isIdentifiedModel(model: string | undefined): model is string {
	return model !== undefined && model !== UNKNOWN_MODEL;
}

/**
 * legacy 会话：有 assistant 消息、但没有一条带可识别模型（WorkBuddy
 * `isLegacySession` 同口径）。这种会话的 token 归不到任何模型上。
 */
function isLegacySession(messages: readonly ParsedMessage[]): boolean {
	const assistants = messages.filter((m) => m.role === "assistant");
	if (assistants.length === 0) return false;
	return assistants.every((m) => !isIdentifiedModel(m.model));
}

interface ModelAccumulator {
	count: number;
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
}

interface DateAccumulator {
	count: number;
	tokens: number;
}

/**
 * 把解析好的会话聚合成统计。纯函数（无 IO、无时钟依赖以外的东西）——
 * 「今天」只在连续天数的计算里用到，且由 `now` 注入，测试可复现。
 */
export function aggregateUsageStats(
	sessions: readonly ParsedSession[],
	options: { readonly now?: Date } = {},
): UsageStats {
	const stats = {
		totalSessions: 0,
		totalMessages: 0,
		totalCost: 0,
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		tokenTotal: 0,
	};
	const byDate = new Map<string, DateAccumulator>();
	const byHour = new Map<number, number>();
	const byModel = new Map<string, ModelAccumulator>();
	const byTool = new Map<string, { count: number; errors: number }>();
	/** 主会话的时间跨度（非子代理）。 */
	let longestMs: number | undefined;
	let totalSpanMs = 0;
	let spanCount = 0;
	let firstAt: number | undefined;
	let lastAt: number | undefined;

	for (const session of sessions) {
		if (session.messages.length === 0) continue;
		if (isLegacySession(session.messages)) continue;

		if (!session.isSubagent) {
			// 会话维度：会话数、消息数、活动归日、峰值时段、工具统计、时间跨度。
			stats.totalSessions++;
			stats.totalMessages += session.messages.length;

			let sessionStart = Number.POSITIVE_INFINITY;
			let sessionEnd = Number.NEGATIVE_INFINITY;
			for (const message of session.messages) {
				if (message.at < sessionStart) sessionStart = message.at;
				if (message.at > sessionEnd) sessionEnd = message.at;
				const key = localDateKey(new Date(message.at));
				const bucket = byDate.get(key);
				if (bucket === undefined) byDate.set(key, { count: 1, tokens: 0 });
				else bucket.count++;

				const hour = new Date(message.at).getHours();
				byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
			}
			const span = sessionEnd - sessionStart;
			if (span > 0) {
				totalSpanMs += span;
				spanCount++;
				if (longestMs === undefined || span > longestMs) longestMs = span;
			}
			if (sessionStart < Number.POSITIVE_INFINITY) {
				if (firstAt === undefined || sessionStart < firstAt) firstAt = sessionStart;
				if (lastAt === undefined || sessionEnd > lastAt) lastAt = sessionEnd;
			}

			for (const call of session.toolCalls) {
				const bucket = byTool.get(call.toolName);
				const isError = session.toolErrorIds.has(call.toolCallId);
				if (bucket === undefined) byTool.set(call.toolName, { count: 1, errors: isError ? 1 : 0 });
				else {
					bucket.count++;
					if (isError) bucket.errors++;
				}
			}
		}

		// 用量维度：**子代理也算**（真实花费不能漏账，见文件头）。
		for (const message of session.messages) {
			if (message.role !== "assistant") continue;
			const model = message.model;
			const usage = message.usage;
			if (!isIdentifiedModel(model) || usage === undefined) continue;
			// token 取合计（含缓存读写）：长会话里 cacheRead 往往是大头，
			// 不含它会让「哪个模型最费」这个问题的答案明显失真（WorkBuddy
			// 的 per-model 统计只算 input+output，这里是有意的偏离，见 spec.md）。
			stats.totalCost += usage.cost;
			stats.input += usage.input;
			stats.output += usage.output;
			stats.cacheRead += usage.cacheRead;
			stats.cacheWrite += usage.cacheWrite;
			stats.tokenTotal += usage.total;

			let accumulator = byModel.get(model);
			if (accumulator === undefined) {
				accumulator = {
					count: 0,
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					cost: 0,
				};
				byModel.set(model, accumulator);
			}
			accumulator.count++;
			accumulator.input += usage.input;
			accumulator.output += usage.output;
			accumulator.cacheRead += usage.cacheRead;
			accumulator.cacheWrite += usage.cacheWrite;
			accumulator.cost += usage.cost;

			// 每日 token 与模型明细同源同口径：两侧相加必然一致。
			const key = localDateKey(new Date(message.at));
			const bucket = byDate.get(key);
			if (bucket === undefined) byDate.set(key, { count: 0, tokens: usage.total });
			else bucket.tokens += usage.total;
		}
	}

	if (stats.totalSessions === 0 && stats.tokenTotal === 0) return emptyUsageStats();

	const heatmap: UsageHeatmapDay[] = [];
	const dailyTokens: { date: string; tokens: number }[] = [];
	for (const [date, bucket] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
		// 只有 token 没有消息的日子（整日都是子代理在跑）不该进热力图：
		// 热力图的语义是「人哪天在用」，不是「哪天烧了钱」。
		if (bucket.count > 0) heatmap.push({ date, count: bucket.count });
		if (bucket.tokens > 0) dailyTokens.push({ date, tokens: bucket.tokens });
	}

	const modelUsage: ModelUsageStat[] = [...byModel.entries()]
		.map(([model, acc]) => ({
			model,
			count: acc.count,
			tokens: acc.input + acc.output + acc.cacheRead + acc.cacheWrite,
			cost: acc.cost,
		}))
		.sort((a, b) => b.tokens - a.tokens);

	const toolUsage: ToolUsageStat[] = [...byTool.entries()]
		.map(([tool, acc]) => ({ tool, count: acc.count, errors: acc.errors }))
		.sort((a, b) => b.count - a.count || a.tool.localeCompare(b.tool));

	const activeDates = heatmap.map((day) => day.date);
	const totalDays =
		firstAt === undefined || lastAt === undefined
			? 0
			: Math.ceil((lastAt - firstAt) / 86_400_000) + 1;

	let peakHour: number | undefined;
	let peakHourCount = 0;
	for (const [hour, count] of byHour) {
		if (count > peakHourCount || (count === peakHourCount && peakHour !== undefined && hour < peakHour)) {
			peakHour = hour;
			peakHourCount = count;
		}
	}

	const streaks = calculateStreaks(activeDates, options.now ?? new Date());

	return {
		totalSessions: stats.totalSessions,
		totalMessages: stats.totalMessages,
		activeDays: activeDates.length,
		totalDays,
		totalTokens: {
			input: stats.input,
			output: stats.output,
			cacheRead: stats.cacheRead,
			cacheWrite: stats.cacheWrite,
			total: stats.tokenTotal,
		},
		totalCost: stats.totalCost,
		streakDays: streaks.current,
		longestStreakDays: streaks.longest,
		peakHour,
		longestSessionMs: longestMs,
		averageSessionMs: spanCount === 0 ? 0 : totalSpanMs / spanCount,
		firstSessionAt: firstAt,
		lastSessionAt: lastAt,
		heatmap,
		dailyTokens,
		modelUsage,
		toolUsage,
	};
}

/**
 * 连续活跃天数。当前连续**从今天往回数**（今天没活动就是 0，不「顺延到昨天」）——
 * 与 WorkBuddy `calculateStreaks` 同口径：断一天就是断。最长连续按日期升序扫
 * 相邻相差 1 天。日期串是 `YYYY-MM-DD`，字典序即时间序，不必解析成 Date。
 */
export function calculateStreaks(
	dates: readonly string[],
	now: Date,
): { readonly current: number; readonly longest: number } {
	if (dates.length === 0) return { current: 0, longest: 0 };
	const unique = [...new Set(dates)].sort();

	const today = new Date(now);
	today.setHours(0, 0, 0, 0);
	let current = 0;
	const cursor = new Date(today);
	for (;;) {
		if (!unique.includes(localDateKey(cursor))) break;
		current++;
		cursor.setDate(cursor.getDate() - 1);
	}

	let longest = 1;
	let run = 1;
	for (let i = 1; i < unique.length; i++) {
		const prev = new Date(`${unique[i - 1]}T00:00:00`);
		const next = new Date(`${unique[i]}T00:00:00`);
		if (Math.round((next.getTime() - prev.getTime()) / 86_400_000) === 1) run++;
		else run = 1;
		if (run > longest) longest = run;
	}
	return { current, longest };
}

/* ── IO ────────────────────────────────────────────────────────────── */

/**
 * 解析结果缓存：键是文件绝对路径，值是 mtimeMs + 解析结果。
 *
 * 统计页跟随会话事件重拉（每次 `assistant_done` 都会来一次），全量重读
 * 几百个会话文件是明显的浪费。只重新解析 mtime 变过的文件；
 * 删除的会话在下一轮被顺带清出缓存。
 */
const parseCache = new Map<string, { mtimeMs: number; parsed: ParsedSession | null }>();

/** 清空解析缓存（测试用；也供「重扫」类操作复用）。 */
export function resetUsageStatsCache(): void {
	parseCache.clear();
}

export interface ReadUsageStatsOptions {
	/** 并行读文件的并发上限（默认见 READ_CONCURRENCY）。 */
	readonly concurrency?: number;
	/** 「今天」的注入点（测试用）。 */
	readonly now?: Date;
}

/**
 * 读会话目录并聚合。目录不存在（从没用过）返回空统计 —— 正常态不是错误
 * （与 conversation-search 同口径）。
 */
export async function readUsageStats(
	sessionsDir: string,
	report?: UsageStatsReport,
	options: ReadUsageStatsOptions = {},
): Promise<UsageStats> {
	let names: string[];
	try {
		names = await readdir(sessionsDir);
	} catch (error) {
		if ((error as { code?: unknown }).code === "ENOENT") return emptyUsageStats();
		throw error;
	}

	const files = names.filter((name) => name.toLowerCase().endsWith(".jsonl"));
	const sessions: ParsedSession[] = [];
	const alive = new Set<string>();

	let next = 0;
	const worker = async (): Promise<void> => {
		for (;;) {
			const index = next++;
			if (index >= files.length) return;
			const path = join(sessionsDir, files[index] as string);
			let mtimeMs: number;
			try {
				mtimeMs = (await stat(path)).mtimeMs;
			} catch {
				// 与目录列举之间文件被移走（删除会话进 trash）——不是错误，跳过。
				continue;
			}
			alive.add(path);
			const cached = parseCache.get(path);
			let parsed: ParsedSession | null;
			if (cached !== undefined && cached.mtimeMs === mtimeMs) {
				parsed = cached.parsed;
			} else {
				try {
					parsed = parseSessionFile(await readFile(path, "utf8"));
				} catch (error) {
					report?.(
						`会话文件读取失败已跳过：${path} —— ${error instanceof Error ? error.message : String(error)}`,
					);
					continue;
				}
				parseCache.set(path, { mtimeMs, parsed });
			}
			if (parsed === null) {
				report?.(`会话文件格式不识别已跳过：${path}`);
				continue;
			}
			sessions.push(parsed);
		}
	};

	const workers = Math.max(1, Math.min(options.concurrency ?? READ_CONCURRENCY, files.length || 1));
	await Promise.all(Array.from({ length: workers }, worker));

	for (const path of [...parseCache.keys()]) if (!alive.has(path)) parseCache.delete(path);

	return aggregateUsageStats(sessions, options.now === undefined ? {} : { now: options.now });
}
