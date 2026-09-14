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
