/**
 * 会话时间线的台账 fold（spec: add-observability-ledger Task 4）。
 *
 * 诊断页从 stats:run-ledger 拿到的是 append-only 的 RunLedgerEntry 流，
 * 泳道需要「按 run 分组的条目序列」——这个 fold 是渲染的一部分
 * （诊断页不做统计二次计算的铁律管的是 statsSnapshot 的聚合口径，
 * 而泳道形状天然是 fold 出来的，与 statsSnapshot 无重叠、不漂移）。
 *
 * fold 纪律与 run-ledger 的读侧对齐：
 *
 * - **位置性归属**：runId 是进程内自增（run-N），daemon 重启后跨代际撞名，
 *   条目归属不看 runId 而看位置（run_start 与 run_end 之间）——
 *   与 core/run-ledger.ts scanLedgerFile 的闭合判定同一理由。
 * - **run 外事件不丢**：手动 /compact、无 run 期间的条目落进一个合成
 *   「run 外事件」桶（runId 为空串），时刻用第一条孤儿条目的 at，不编造归属。
 * - queue 条目不进时间线（排队是指示不是泳道步骤），由 fold 丢弃。
 *
 * 两级 fold，服务两个粒度：`foldRunLedger` 出「轮」（run），
 * `foldRunSteps` 再把一轮的条目切成「步」（一次模型调用 + 它之后的条目）。
 * 后者也按位置推归属，理由同上（台账没记「这个工具属于哪一步」）。
 */

import type {
	CompactionData,
	LlmCallData,
	RequestSnapshotData,
	RetryData,
	RunEndReason,
	RunLedgerEntry,
	RunLedgerEntryKind,
	TokenUsage,
	ToolCallData,
} from "@shared/observability.ts";
import { emptyUsage } from "@shared/observability.ts";

/**
 * 台账条目的可判别联合形态：RunLedgerEntry 的默认泛型形参（K = 全 kind 联合）
 * 让 kind 与 data 失去判别联动，switch entry.kind 收窄不了 entry.data。
 * 磁盘 JSONL 的每行都经 append 的写入点校验（kind→data 一致），所以 fold
 * 入口处做一次窄化断言即可，断言点集中在这一个类型上。
 */
type LedgerEntryUnion = {
	[K in RunLedgerEntryKind]: RunLedgerEntry<K>;
}[RunLedgerEntryKind];

/** 一条泳道行。llm / tool 自带起止时刻；retry / compaction 是时刻标记。 */
export type LedgerItem =
	| { readonly kind: "llm"; readonly data: LlmCallData }
	| { readonly kind: "tool"; readonly data: ToolCallData }
	| { readonly kind: "retry"; readonly at: number; readonly data: RetryData }
	| { readonly kind: "compaction"; readonly at: number; readonly data: CompactionData };

/** 一个 run 的泳道视图（fold 产物）。 */
export interface LedgerRun {
	readonly runId: string;
	readonly startedAt: number;
	/** 无 run_end（进程死在 run 中、合成闭合还没补上）为 undefined。 */
	readonly endedAt: number | undefined;
	readonly endReason: RunEndReason | undefined;
	readonly error: string | undefined;
	readonly modelId: string | undefined;
	readonly items: readonly LedgerItem[];
	/** run 内 llm_call 的 usage 合计（六基字段）；一次带用量的调用都没有为 undefined。 */
	readonly usage: TokenUsage | undefined;
}

interface MutableRun {
	runId: string;
	startedAt: number;
	endedAt: number | undefined;
	endReason: RunEndReason | undefined;
	error: string | undefined;
	modelId: string | undefined;
	items: LedgerItem[];
	usage: TokenUsage | undefined;
}

function addUsage(total: TokenUsage, delta: TokenUsage): void {
	// TokenUsage 是 readonly 快照形状；这里是 fold 内部的可变累加器，
	// 出 fold 前不再被改写（mutableUsage 同款手法，见 core/observability.ts）。
	const mutable = total as { -readonly [K in keyof TokenUsage]: TokenUsage[K] };
	mutable.input += delta.input;
	mutable.output += delta.output;
	mutable.cacheRead += delta.cacheRead;
	mutable.cacheWrite += delta.cacheWrite;
	mutable.totalTokens += delta.totalTokens;
	mutable.cost += delta.cost;
}

/** 台账条目流 → run 泳道序列（时间序，旧→新；展示侧自行反转）。 */
export function foldRunLedger(entries: readonly RunLedgerEntry[]): LedgerRun[] {
	const runs: MutableRun[] = [];
	let current: MutableRun | undefined;
	/** run 外事件的合成桶（runId 空串）。 */
	let orphan: MutableRun | undefined;

	const home = (at: number): MutableRun => {
		if (current !== undefined) return current;
		if (orphan === undefined) {
			orphan = {
				runId: "",
				startedAt: at,
				endedAt: undefined,
				endReason: undefined,
				error: undefined,
				modelId: undefined,
				items: [],
				usage: undefined,
			};
			runs.push(orphan);
		}
		return orphan;
	};

	for (const raw of entries) {
		const entry = raw as LedgerEntryUnion;
		switch (entry.kind) {
			case "run_start": {
				current = {
					runId: entry.data.runId,
					startedAt: entry.at,
					endedAt: undefined,
					endReason: undefined,
					error: undefined,
					modelId: entry.data.modelId,
					items: [],
					usage: undefined,
				};
				runs.push(current);
				break;
			}
			case "run_end": {
				// 位置性闭合：run_end 收的是「当前开着的」那个 run。
				// 没有开着的 run（截尾后只剩 end）丢弃 —— 半段历史画不出泳道。
				if (current === undefined) break;
				current.endedAt = entry.at;
				current.endReason = entry.data.reason;
				current.error = entry.data.error;
				current = undefined;
				break;
			}
			case "llm_call": {
				const run = home(entry.at);
				run.items.push({ kind: "llm", data: entry.data });
				if (entry.data.usage !== undefined) {
					if (run.usage === undefined) run.usage = emptyUsage();
					addUsage(run.usage, entry.data.usage);
				}
				break;
			}
			case "tool_call": {
				home(entry.at).items.push({ kind: "tool", data: entry.data });
				break;
			}
			case "retry": {
				home(entry.at).items.push({ kind: "retry", at: entry.at, data: entry.data });
				break;
			}
			case "compaction": {
				home(entry.at).items.push({
					kind: "compaction",
					at: entry.at,
					data: entry.data,
				});
				break;
			}
			default:
				// queue / request_snapshot：不是泳道行（快照走 indexRequestSnapshots）。
				break;
		}
	}
	return runs;
}

/**
 * 挂在某一步之下的条目（工具 / 重试 / 压缩）——**不含 llm**。
 *
 * 这个排除不是修饰：`foldRunSteps` 用「遇到 llm 就开新组」的规则切分，
 * 所以 rest 里结构上不可能出现 llm；把保证写进类型，消费方（面板的 RestRow）
 * 才不用在渲染时再判一次、也就不会有人顺手在 rest 里塞一个 llm 行。
 */
export type LedgerStepItem = Exclude<LedgerItem, { readonly kind: "llm" }>;

/**
 * 一步（一次模型调用）及其后随条目。
 *
 * 为什么不直接用 `LedgerRun.items` 平铺：工具属于「发出它的那次模型调用」，
 * 平铺后 27 步的 run 里工具行会在步与步之间飘着，看不出归属。
 */
export interface LedgerStep {
	/**
	 * 该步的模型调用。undefined = 台账截尾（daemon 只保留最新 N 条）后，
	 * 工具行前面没有对应的 llm_call —— 无主条目照常展示，不编造归属
	 *（同 foldRunLedger 的「run 外事件不丢」纪律）。
	 */
	readonly call: LlmCallData | undefined;
	/** call 之后、下一步之前的条目（工具 / 重试 / 压缩），保持台账顺序。 */
	readonly rest: readonly LedgerStepItem[];
}

/**
 * 一条泳道行 → 按步归组。
 *
 * **归属按位置推**：台账里 `tool_call` 只带工具自己的 `toolCallId`，不带它属于
 * 哪一轮模型调用 —— pi 的工具执行总发生在某次模型调用之后、下一次之前，所以
 * 「前一个 llm_call」是唯一可推的归属。这与 foldRunLedger 判定 run 归属的手法
 * 同源（runId 是进程内自增、跨 daemon 代际会撞名，只能看位置）。
 *
 * 重试 / 压缩跟着「当前步」走：它们的时刻本来就在该步之后、下一步之前，
 * 挪到轮级展示会打乱先后顺序（一次重试发生在第 3 步失败之后，
 * 就该出现在第 3 步之后）。
 */
export function foldRunSteps(items: readonly LedgerItem[]): readonly LedgerStep[] {
	const steps: { call: LlmCallData | undefined; rest: LedgerStepItem[] }[] = [];

	for (const item of items) {
		if (item.kind === "llm") {
			steps.push({ call: item.data, rest: [] });
			continue;
		}
		const last = steps[steps.length - 1];
		if (last === undefined) steps.push({ call: undefined, rest: [item] });
		else last.rest.push(item);
	}

	return steps;
}

/**
 * request_snapshot 的检索键：runId + turnIndex。
 * 快照的 runId/turnIndex 均可缺省（子代理等无 run 上下文的路径），
 * 键里缺省段落落为空串 —— 与 llm_call 侧取值同规则才能对上。
 */
export function snapshotKey(
	runId: string | undefined,
	turnIndex: number | undefined,
): string {
	return `${runId ?? ""}#${turnIndex ?? ""}`;
}

/** 台账条目流 → 请求快照索引（同键后者覆盖前者：快照按轮唯一，覆盖即最新）。 */
export function indexRequestSnapshots(
	entries: readonly RunLedgerEntry[],
): ReadonlyMap<string, RequestSnapshotData> {
	const map = new Map<string, RequestSnapshotData>();
	for (const raw of entries) {
		const entry = raw as LedgerEntryUnion;
		if (entry.kind !== "request_snapshot") continue;
		map.set(snapshotKey(entry.data.runId, entry.data.turnIndex), entry.data);
	}
	return map;
}

/**
 * 最近一次入模拆分（条目流里最后一条 request_snapshot）。
 *
 * 任务诊断面板 ② 的「最近一次入模拆分」数据源：模型最近一次调用实际收到的
 * 上下文就是「当前的上下文组成」—— 比任何估算都真。entries 倒序找第一条，
 * 没有返回 undefined（还没跑过模型调用）。
 */
export function latestRequestSnapshot(
	entries: readonly RunLedgerEntry[],
): RequestSnapshotData | undefined {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i] as LedgerEntryUnion;
		if (entry.kind === "request_snapshot") return entry.data;
	}
	return undefined;
}
