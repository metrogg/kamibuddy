/**
 * 运行台账（run ledger）：每会话一份 append-only NDJSON
 * （logs/runs/<sessionId>.jsonl，与 event-log 的按日文件同级目录下的 runs/ 子目录）。
 *
 * 只记 pi 会话 JSONL 不记的东西：重试过程 / 单次调用计时与 TTFT / 请求快照 /
 * 队列 / run 与压缩边界。消息内容与 usage 明细在会话 JSONL 已有，不双写
 * （双写必漂移，spec: add-observability-ledger）。
 *
 * 写入纪律（dsh 轻量版，钉住勿改）：
 *
 * 1. **seq 单调自增**：构造时回放现有文件取 max+1 续号；只有写盘成功才消耗
 *    序号（文件内序号无空洞，回放方可以靠它检出丢行）。
 * 2. **写入点 JSON 校验**：data 必须可 JSON 序列化；序列化失败（循环引用、
 *    BigInt）记 event-log 并丢弃该条，不落半截文件。
 * 3. **写入失败记 event-log 但不炸 run** —— 台账是观测不是业务：任何
 *    IO/序列化问题都不许让对话失败。读侧同理：回放容忍坏行（崩溃截断的
 *    半行不该让台账再也打不开，dsh 同口径）。
 * 4. **中断合成闭合，不截断**：启动扫到未闭合 run（有 run_start 无 run_end）
 *    补一条合成 run_end{reason:"interrupted"}。合成条的 at 是「发现中断」的
 *    时刻 —— 原 run 的真实结束时刻不可知，不编造。
 *
 * 为什么同步写：与 event-log 同理由（崩溃前最后一条也要在盘上；事件量小，
 * 每 run 几十条，同步写不是瓶颈）。
 */

import {
	appendFileSync,
	closeSync,
	existsSync,
	fstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	readSync,
	readdirSync,
} from "node:fs";
import { join } from "node:path";
import type {
	RunLedgerDataMap,
	RunLedgerEntry,
	RunLedgerEntryKind,
} from "../shared/observability.ts";

/** 写入失败的上报通道（daemon 接到 event-log）。只进不出，绝不回抛。 */
export type LedgerReport = (message: string) => void;

/**
 * 台账回放读口（spec: add-observability-ledger Task 3 的投影重建用）。
 *
 * 与 scanLedgerFile 同一份读侧容忍：逐行解析、坏行跳过（崩溃截断的半行 /
 * 手滑编辑的坏行不该让投影再也建不起来）。返回按文件顺序（seq 序）的条目。
 * 读失败（文件不可读）按空台账处理并上报 —— 与 tryScan 同口径。
 */
export function readLedgerEntries(filePath: string, report?: LedgerReport): RunLedgerEntry[] {
	let text: string;
	try {
		text = readFileSync(filePath, "utf8");
	} catch (error) {
		report?.(
			`台账读取失败按空台账继续：${filePath} —— ${error instanceof Error ? error.message : String(error)}`,
		);
		return [];
	}
	const entries: RunLedgerEntry[] = [];
	for (const line of text.split("\n")) {
		if (line.trim() === "") continue;
		try {
			entries.push(JSON.parse(line) as RunLedgerEntry);
		} catch {
			// 坏行跳过（读侧容忍，见 scanLedgerFile 注释）。
		}
	}
	return entries;
}

/**
 * 列出台账目录下的全部文件（绝对路径）。目录不存在（从没记过台账）返回空 ——
 * 与 sealOrphans 同口径，是正常态不是错误。
 */
export function listLedgerFiles(dir: string): string[] {
	let files: string[];
	try {
		files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
	} catch {
		return [];
	}
	return files.map((f) => join(dir, f));
}

/**
 * sessionId → 文件名安全化。
 *
 * sessionId 可能来自会话文件 header（resume 路径）——那是磁盘数据不是可信
 * 标识，一个被改坏/恶意的 header 可能带路径分隔符。这里把一切非
 * [A-Za-z0-9_-] 字符压成下划线，从根上断了目录穿越；pi 正常产出的 id
 * （nanoid 字符集）经此映射是恒等。
 */
export function ledgerFileName(sessionId: string): string {
	return `${sessionId.replace(/[^a-zA-Z0-9_-]/g, "_")}.jsonl`;
}

interface LedgerScan {
	/** 现有条目里的最大 seq（无条目为 0）。 */
	readonly maxSeq: number;
	/** 最后一个未闭合 run 的 runId（有 run_start 无 run_end）；全闭合为 undefined。 */
	readonly openRunId: string | undefined;
}

/**
 * 回放扫描一份台账文件：取最大 seq、检出未闭合 run。
 *
 * 逐行解析、坏行跳过（读侧容忍：崩溃截断的半行 / 手滑编辑的坏行不该让
 * 台账再也打不开）。run 的闭合判定是位置性的 —— run_start 之后没有任何
 * run_end 即未闭合。不按 runId 配对：宿主的 runId 是进程内自增（run-N），
 * daemon 重启后新一轮从 run-1 重新计数，跨进程代际 runId 必然撞名，
 * 而同一时刻一个会话只可能有一个未闭合 run（单写者不变式），位置判定才可靠。
 */
function scanLedgerFile(filePath: string): LedgerScan {
	let maxSeq = 0;
	let openRunId: string | undefined;
	for (const line of readFileSync(filePath, "utf8").split("\n")) {
		if (line.trim() === "") continue;
		let entry: RunLedgerEntry;
		try {
			entry = JSON.parse(line) as RunLedgerEntry;
		} catch {
			continue;
		}
		if (typeof entry.seq === "number" && entry.seq > maxSeq) maxSeq = entry.seq;
		if (entry.kind === "run_start") {
			const runId = (entry.data as { runId?: unknown }).runId;
			openRunId = typeof runId === "string" ? runId : undefined;
		} else if (entry.kind === "run_end") {
			openRunId = undefined;
		}
	}
	return { maxSeq, openRunId };
}

/**
 * 崩溃截断修复：文件结尾没有换行时补一个。
 *
 * 同步写要么整行落盘、要么进程死在写半行 —— 死的那一刻最后一行就是没有
 * \n 的半行。不先补换行，下一次 append 会与半行首尾相接熔成一整行坏行
 * （连累新条目也丢）。pi 的 loadEntriesFromFile 是同款修复
 * （session-manager.js 的 pending 分支）。
 */
function repairTruncatedTail(filePath: string): void {
	const fd = openSync(filePath, "r");
	try {
		const size = fstatSync(fd).size;
		if (size === 0) return;
		const last = Buffer.alloc(1);
		readSync(fd, last, 0, 1, size - 1);
		if (last[0] !== 0x0a) appendFileSync(filePath, "\n", "utf8");
	} finally {
		closeSync(fd);
	}
}

/** 扫描失败时的空结果（读侧容忍的一部分：扫不动按空台账继续，问题记 event-log）。 */
function tryScan(filePath: string, report: LedgerReport): LedgerScan {
	try {
		return scanLedgerFile(filePath);
	} catch (error) {
		report(`台账回放失败按空台账继续：${filePath} —— ${error instanceof Error ? error.message : String(error)}`);
		return { maxSeq: 0, openRunId: undefined };
	}
}

export class RunLedger {
	private readonly filePathValue: string;
	private nextSeq: number;
	private readonly now: () => number;
	private readonly report: LedgerReport;
	/**
	 * 增量投影钩子：条目写盘成功后回调（observability 的台账 fold 靠它做到
	 * 「新事件到账即投影」，不必等下次启动回放）。只在写盘成功后触发 ——
	 * 没落盘的条目不该进投影（重启后它本来就不存在）。
	 */
	private readonly onAppended: ((entry: RunLedgerEntry) => void) | undefined;

	constructor(
		dir: string,
		sessionId: string,
		report: LedgerReport,
		now: () => number = Date.now,
		onAppended?: (entry: RunLedgerEntry) => void,
	) {
		mkdirSync(dir, { recursive: true });
		this.filePathValue = join(dir, ledgerFileName(sessionId));
		this.now = now;
		this.report = report;
		this.onAppended = onAppended;
		if (existsSync(this.filePathValue)) {
			try {
				repairTruncatedTail(this.filePathValue);
			} catch (error) {
				this.safeReport(`台账截断修复失败：${this.filePathValue} —— ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		const scan = existsSync(this.filePathValue)
			? tryScan(this.filePathValue, (m) => this.safeReport(m))
			: { maxSeq: 0, openRunId: undefined };
		this.nextSeq = scan.maxSeq + 1;
		// 中断合成闭合（dsh：闭合优于截断）——上次进程死在一个开着的 run 上，
		// 不补这条，投影回放会把那个 run 当成「至今仍在跑」。
		if (scan.openRunId !== undefined) {
			this.append("run_end", { runId: scan.openRunId, reason: "interrupted" });
		}
	}

	get filePath(): string {
		return this.filePathValue;
	}

	/**
	 * 上报通道的最后一公里：report（daemon 的 event-log 落盘）自己也会 IO 失败
	 * （磁盘满 / 权限），那一刻不能再把异常抛回 run —— 退到 console 留现场。
	 */
	private safeReport(message: string): void {
		try {
			this.report(message);
		} catch (error) {
			console.error(
				`[run-ledger] 上报通道失败：${message}（${error instanceof Error ? error.message : String(error)}）`,
			);
		}
	}

	/**
	 * 追加一条记录。写盘成功才消耗 seq（见文件头纪律 1）。
	 * 任何失败（序列化 / IO）都经 report 上报后正常返回 —— 台账是观测不是业务。
	 */
	append<K extends RunLedgerEntryKind>(kind: K, data: RunLedgerDataMap[K]): void {
		let line: string;
		try {
			line = JSON.stringify({ seq: this.nextSeq, at: this.now(), kind, data });
		} catch (error) {
			this.safeReport(
				`台账条目序列化失败已丢弃（${kind}）：${error instanceof Error ? error.message : String(error)}`,
			);
			return;
		}
		try {
			appendFileSync(this.filePathValue, `${line}\n`, "utf8");
		} catch (error) {
			this.safeReport(
				`台账写盘失败已丢弃（${kind}，${this.filePathValue}）：${error instanceof Error ? error.message : String(error)}`,
			);
			return;
		}
		this.nextSeq += 1;
		if (this.onAppended !== undefined) {
			try {
				this.onAppended(JSON.parse(line) as RunLedgerEntry);
			} catch (error) {
				// 投影侧的 bug 不许炸 run（台账是观测不是业务，同文件头纪律 3）。
				this.safeReport(
					`台账增量投影失败（${kind}）：${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}

	/**
	 * 台账链路之外、观测钩子自身的失败上报（如请求快照分类出错）。
	 * 与内部失败同一个出口：进 event-log，不回抛炸 run。
	 */
	reportFailure(message: string): void {
		this.safeReport(message);
	}

	/**
	 * 启动清扫：对目录下所有台账文件做中断合成闭合。
	 *
	 * 冷会话（崩溃后还没被 resume 的）的孤儿 run 也要补上 —— 否则投影回放
	 * （observability 的台账 fold）会把它们当成「至今仍在跑」。
	 * 目录不存在（从没记过台账）是正常态，秒退。
	 */
	static sealOrphans(dir: string, report: (file: string, message: string) => void): void {
		let files: string[];
		try {
			files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
		} catch {
			return;
		}
		for (const file of files) {
			const path = join(dir, file);
			try {
				repairTruncatedTail(path);
			} catch (error) {
				report(file, `台账截断修复失败：${error instanceof Error ? error.message : String(error)}`);
			}
			const scan = tryScan(path, (message) => report(file, message));
			if (scan.openRunId === undefined) continue;
			try {
				const line = JSON.stringify({
					seq: scan.maxSeq + 1,
					at: Date.now(),
					kind: "run_end",
					data: { runId: scan.openRunId, reason: "interrupted" },
				});
				appendFileSync(path, `${line}\n`, "utf8");
			} catch (error) {
				report(file, `台账合成闭合写盘失败：${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}
}
