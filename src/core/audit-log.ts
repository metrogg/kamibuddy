/**
 * 审计日志：三类记录（命令安全 / 沙箱 / 运行时）的**唯一落盘、查询与导出出口**。
 *
 * 落点与格式：`<configDir>/logs/audit/audit-YYYY-MM-DD.jsonl`，一行一个 JSON
 * （NDJSON + 按天分文件）。与 core/event-log.ts 同一套**格式口径**（同步写、
 * 一行一条、按天轮转），理由也相同：崩溃前最后一条也要在盘上，按天翻文件
 * 查问题最省事。这里不直接复用 `EventLog` 的原因只有一条：它的 `LogRecord`
 * 要求一个 `kind` 字段，而审计结构是「时间/类别/结论/详情」—— 硬套就要给
 * 每条审计记录塞一个与 `category` 重复的 `kind`，结构一旦有二义，
 * 「三类同构」就不再是可机械检查的事实。
 *
 * 为什么单独一个目录（不混进 events-*.jsonl）：审计要能被**独立清空**
 * （spec Scenario: 清空记录），而事件日志是排障现场，混在一起会连排障证据
 * 一起删掉；反过来，把审计写进事件日志也做不到「清空只删审计」。
 *
 * 写入纪律（与 run-ledger 同口径）：写盘失败**不回抛炸业务** —— 审计是观测，
 * 一次命令被拦的判定不该因为磁盘满了而变成执行异常。失败退到 console 留现场。
 *
 * 读侧容忍（与 readLedgerEntries 同口径）：坏行跳过、目录不存在按空处理 ——
 * 崩溃截断的半行或手删过的文件不该让审计中心再也打不开。
 */

import { appendFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	AUDIT_CATEGORY_LABELS,
	AUDIT_OUTCOME_LABELS,
	renderAuditRecords,
	type AuditCategory,
	type AuditRecord,
	type AuditRecordInput,
} from "../shared/audit.ts";
import { getConfigDir } from "./config-paths.ts";

/** 记录文件名：按天分文件（同日多个进程写入时靠 appendFileSync 的原子追加保序）。 */
const AUDIT_FILE_RE = /^audit-\d{4}-\d{2}-\d{2}\.jsonl$/;

/** 审计日志目录。清空与导出都作用于它。 */
export function auditLogDir(): string {
	return join(getConfigDir(), "logs", "audit");
}

/**
 * 追加一条审计记录。**三类来源唯一的写入入口**（调用点只给类别/结论/详情）。
 * 时间在这里统一打点：调用方各取一次 Date.now 会让同一件事在不同来源里有
 * 不同的时间语义（有的记「决定时刻」、有的记「写盘时刻」）。
 */
export function writeAuditRecord(input: AuditRecordInput, dir: string = auditLogDir()): void {
	const record: AuditRecord = { ts: Date.now(), ...input };
	try {
		mkdirSync(dir, { recursive: true });
		appendFileSync(recordFile(dir, record.ts), `${JSON.stringify(record)}\n`, "utf8");
	} catch (error) {
		// 审计写盘失败不许炸业务（见文件头写入纪律）：退到 console，现场仍在终端里。
		console.error(
			`[audit-log] 审计写盘失败（${input.category}/${input.outcome}）：` +
				`${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function recordFile(dir: string, ts: number): string {
	return join(dir, `audit-${new Date(ts).toISOString().slice(0, 10)}.jsonl`);
}

/** 全部审计记录文件（文件名升序 = 时间升序）。目录不存在（从没记过）返回空，是正常态。 */
function auditFiles(dir: string): string[] {
	try {
		return readdirSync(dir)
			.filter((name) => AUDIT_FILE_RE.test(name))
			.sort()
			.map((name) => join(dir, name));
	} catch {
		return [];
	}
}

/** 逐行解析一条记录；形状不符（手改过/半行）返回 undefined，由调用方跳过。 */
function parseRecord(line: string): AuditRecord | undefined {
	try {
		const parsed: unknown = JSON.parse(line);
		if (typeof parsed !== "object" || parsed === null) return undefined;
		const record = parsed as Record<string, unknown>;
		const { ts, category, outcome, detail } = record;
		if (typeof ts !== "number" || typeof detail !== "string") return undefined;
		if (typeof category !== "string" || !(category in AUDIT_CATEGORY_LABELS)) return undefined;
		if (typeof outcome !== "string" || !(outcome in AUDIT_OUTCOME_LABELS)) return undefined;
		return { ts, category: category as AuditCategory, outcome: outcome as AuditRecord["outcome"], detail };
	} catch {
		return undefined;
	}
}

export interface AuditQuery {
	/** 缺省 = 生产目录（仅测试显式指定）。 */
	readonly dir?: string;
	/** 只看某一类；缺省 = 全部（含审计管理动作）。 */
	readonly category?: AuditCategory;
	/** 只取最近 N 条（返回仍是时间正序）。缺省 = 全部 —— 导出走这条。 */
	readonly limit?: number;
}

export interface AuditQueryOutcome {
	/** 按时间**正序**（旧 → 新）。面板自行倒序展示，导出直接用这个顺序。 */
	readonly records: readonly AuditRecord[];
	/** 过滤后、截断前的总条数（面板据此说明「显示最近 N 条 / 共 M 条」）。 */
	readonly total: number;
}

/**
 * 查询审计记录。**面板与导出共用这一个函数**（spec: 导出内容与面板同源）——
 * 差别只有 `limit`：面板给 AUDIT_PANEL_LIMIT，导出不给（要全量历史）。
 */
export function readAuditRecords(query: AuditQuery = {}): AuditQueryOutcome {
	const dir = query.dir ?? auditLogDir();
	const all: AuditRecord[] = [];
	for (const file of auditFiles(dir)) {
		let text: string;
		try {
			text = readFileSync(file, "utf8");
		} catch {
			// 读失败（权限/被删）：跳过这个文件继续 —— 一份读不动不该让审计中心全空。
			continue;
		}
		for (const line of text.split("\n")) {
			if (line.trim() === "") continue;
			const record = parseRecord(line);
			if (record === undefined) continue;
			all.push(record);
		}
	}
	const filtered =
		query.category === undefined ? all : all.filter((record) => record.category === query.category);
	return {
		records: query.limit === undefined ? filtered : filtered.slice(-query.limit),
		total: filtered.length,
	};
}

/**
 * 清空审计记录：删掉全部记录文件，**然后**补一条「已清空」记录。
 *
 * 顺序不可换，这就是「清空动作本身也被记录」的实现方式：先写后删会把留痕
 * 一起删掉 —— 那正是本 spec 要禁止的状态（事后无法回答「记录去哪了、
 * 谁在什么时候清的」）。补写的记录落在新的一天文件里，于是清空后的面板
 * 恰好显示这一条痕迹，之后的记录照常追加（同一条路径，无第二套写入）。
 *
 * 返回值是本次清掉的条数（写进留痕的详情里，供事后对账）。
 */
export function clearAuditRecords(dir: string = auditLogDir()): number {
	const removed = readAuditRecords({ dir }).total;
	for (const file of auditFiles(dir)) {
		try {
			rmSync(file, { force: true });
		} catch (error) {
			console.error(
				`[audit-log] 审计记录删除失败：${file} —— ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	writeAuditRecord(
		{
			category: "audit",
			outcome: "cleared",
			detail: `已清空 ${removed} 条审计记录（本条是清空动作本身留下的痕迹）`,
		},
		dir,
	);
	return removed;
}

/**
 * 导出全部审计记录到 `<审计目录>/audit-export-<时间戳>.txt`，返回路径与条数。
 * 导出用**与面板同一个** readAuditRecords（不设 limit）+ 同一个 auditLine 渲染
 * （shared/audit.ts）：面板看到的每一行都在导出文件里逐字出现，用户按导出件
 * 与我们对话时，看到的不是另一份东西。
 *
 * 产物与记录分开放：清空只删 `audit-*.jsonl`，导出件（用户主动保存的证据）
 * 不被清空动作连坐。
 */
export function exportAuditRecords(dir: string = auditLogDir(), now: number = Date.now()): { path: string; count: number } {
	const { records } = readAuditRecords({ dir });
	const stamp = new Date(now).toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const path = join(dir, `audit-export-${stamp}.txt`);
	mkdirSync(dir, { recursive: true });
	writeFileSync(path, `${renderAuditRecords(records, now)}\n`, "utf8");
	return { path, count: records.length };
}
