/**
 * 审计日志的口径测试（spec: add-managed-runtimes 阶段 4）。
 *
 * 钉的是三件事，都是「换个人重写就会悄悄改掉」的那种：
 *   1. **三类来源同构**：命令安全 / 沙箱 / 运行时写进同一份结构（时间/类别/结论/详情），
 *      读回来的字段一个不多一个不少；
 *   2. **查询是过滤 + 最近 N 条 + 总数**（面板与导出共用它，导出只用全量档）；
 *   3. **清空留痕**：清空先删后补、清空后新增记录照常。
 *
 * 用显式临时目录（不走 KAMIBUDDY_CONFIG_DIR）：本模块的 dir 是显式参数，
 * 测试直接给路径比改全局环境变量干净。
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auditLine, type AuditRecord } from "../shared/audit.ts";
import { clearAuditRecords, exportAuditRecords, readAuditRecords, writeAuditRecord } from "./audit-log.ts";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "kami-audit-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

/** 三类来源各写一条 —— 与生产写入点同一条函数（writeAuditRecord）。 */
function writeThreeSources(): void {
	writeAuditRecord(
		{
			category: "command",
			outcome: "blocked",
			detail: "危险命令检查器拦截（dynamic-execution）：iex 'Get-Date'",
		},
		dir,
	);
	writeAuditRecord(
		{ category: "sandbox", outcome: "blocked", detail: "沙箱不可用，命令未执行（系统调用组件加载失败）" },
		dir,
	);
	writeAuditRecord(
		{ category: "runtime", outcome: "failed", detail: "docx 运行时启动预热失败（probe-uv）：未找到 uv" },
		dir,
	);
}

describe("三类记录同构", () => {
	it("三类写进同一个目录、同一份结构（时间/类别/结论/详情，无第五个字段）", () => {
		writeThreeSources();
		const { records, total } = readAuditRecords({ dir });
		expect(total).toBe(3);
		expect(records.map((record) => record.category)).toEqual(["command", "sandbox", "runtime"]);
		expect(records.map((record) => record.outcome)).toEqual(["blocked", "blocked", "failed"]);
		for (const record of records) {
			expect(Object.keys(record).sort()).toEqual(["category", "detail", "outcome", "ts"]);
			expect(typeof record.ts).toBe("number");
			expect(record.detail.length).toBeGreaterThan(0);
		}
		// 三类都落在同一个按天文件里（不各写各的文件）。
		expect(readdirSync(dir).filter((name) => name.endsWith(".jsonl"))).toHaveLength(1);
	});

	it("按类别过滤 + 上限：只回该类，且 total 是过滤后的总数", () => {
		writeThreeSources();
		writeAuditRecord({ category: "command", outcome: "blocked", detail: "第二条命令拦截" }, dir);

		const onlyCommand = readAuditRecords({ dir, category: "command" });
		expect(onlyCommand.total).toBe(2);
		expect(onlyCommand.records.map((record) => record.detail)).toEqual([
			"危险命令检查器拦截（dynamic-execution）：iex 'Get-Date'",
			"第二条命令拦截",
		]);

		const limited = readAuditRecords({ dir, limit: 2 });
		expect(limited.total).toBe(4);
		expect(limited.records).toHaveLength(2);
		// limit 取的是**最近**两条（正序返回），不是最先两条。
		expect(limited.records.map((record) => record.detail)).toEqual([
			"docx 运行时启动预热失败（probe-uv）：未找到 uv",
			"第二条命令拦截",
		]);

		expect(readAuditRecords({ dir, category: "audit" })).toEqual({ records: [], total: 0 });
	});

	it("坏行与不存在的目录都按空/跳过处理（读侧容忍）", () => {
		writeAuditRecord({ category: "sandbox", outcome: "allowed", detail: "用户批准提权" }, dir);
		const file = join(dir, readdirSync(dir)[0] ?? "");
		writeFileSync(file, `${readFileSync(file, "utf8")}{ 这不是 JSON\n{"ts":1}\n`, "utf8");
		expect(readAuditRecords({ dir }).records).toHaveLength(1);
		expect(readAuditRecords({ dir: join(dir, "不存在") })).toEqual({ records: [], total: 0 });
	});
});

describe("清空留痕", () => {
	it("清空后只剩「已清空」一条，且条数与详情如实；清空后新增记录照常", () => {
		writeThreeSources();
		const removed = clearAuditRecords(dir);
		expect(removed).toBe(3);

		const afterClear = readAuditRecords({ dir });
		expect(afterClear.total).toBe(1);
		const [trace] = afterClear.records;
		expect(trace?.category).toBe("audit");
		expect(trace?.outcome).toBe("cleared");
		expect(trace?.detail).toContain("已清空 3 条");

		// 清空动作本身**必须**留痕：它不能是那条一起被删掉的记录。
		expect(readAuditRecords({ dir, category: "command" }).total).toBe(0);

		// 清空后新增照常（同一条写入路径，没有第二套状态）。
		writeAuditRecord({ category: "runtime", outcome: "disabled", detail: "用户禁用了 python 运行时" }, dir);
		expect(readAuditRecords({ dir }).total).toBe(2);
		expect(readAuditRecords({ dir, category: "runtime" }).records[0]?.outcome).toBe("disabled");
	});
});

describe("导出与面板同源", () => {
	it("导出 = 同一条查询的全量档 + 同一份渲染；面板截断不影响导出", () => {
		writeThreeSources();
		for (let index = 0; index < 5; index += 1) {
			writeAuditRecord({ category: "sandbox", outcome: "blocked", detail: `第 ${index} 条沙箱拒绝` }, dir);
		}

		// 面板：最近 2 条（readAuditRecords + limit）。
		const panel: readonly AuditRecord[] = readAuditRecords({ dir, limit: 2 }).records;
		const { path, count } = exportAuditRecords(dir);
		expect(count).toBe(8);

		const text = readFileSync(path, "utf8");
		// 面板看到的每一行都在导出文件里逐字出现（同一 auditLine）。
		for (const record of panel) expect(text).toContain(auditLine(record));
		// 导出是全量：被面板上限截掉的那些也在里面。
		expect(text).toContain(auditLine(readAuditRecords({ dir }).records[0] as AuditRecord));
		expect(text).toContain("KamiBuddy 审计日志");
		// 导出件是文本报告、不是记录文件：清空记录不连坐它（用户主动保存的证据仍在）。
		clearAuditRecords(dir);
		expect(readFileSync(path, "utf8")).toBe(text);
	});
});
