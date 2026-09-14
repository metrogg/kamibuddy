import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RunLedgerEntry } from "../shared/observability.ts";
import { RunLedger, ledgerFileName } from "./run-ledger.ts";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "kamibuddy-runledger-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

/** 读出某会话台账的全部条目（与台账同口径：坏行跳过）。 */
function readEntries(sessionId: string): RunLedgerEntry[] {
	const out: RunLedgerEntry[] = [];
	for (const line of readFileSync(join(dir, ledgerFileName(sessionId)), "utf8").split("\n")) {
		if (line.trim() === "") continue;
		try {
			out.push(JSON.parse(line) as RunLedgerEntry);
		} catch {
			// 与台账读侧同口径：坏行跳过。
		}
	}
	return out;
}

function silentReport(): { report: (m: string) => void; messages: string[] } {
	const messages: string[] = [];
	return { report: (m) => messages.push(m), messages };
}

describe("RunLedger append 与回放", () => {
	it("条目带 seq/at/kind/data，seq 单调自增", () => {
		const { report } = silentReport();
		const ledger = new RunLedger(dir, "s1", report, () => 1000);
		ledger.append("run_start", { runId: "run-1" });
		ledger.append("queue", { steering: ["催一下"], followUp: [] });
		ledger.append("run_end", { runId: "run-1", reason: "completed" });

		const entries = readEntries("s1");
		expect(entries.map((e) => e.seq)).toEqual([1, 2, 3]);
		expect(entries.map((e) => e.kind)).toEqual(["run_start", "queue", "run_end"]);
		expect(entries.every((e) => e.at === 1000)).toBe(true);
		expect(entries[1]?.data).toEqual({ steering: ["催一下"], followUp: [] });
	});

	it("新实例回放现有文件，seq 从 max+1 续号", () => {
		const { report } = silentReport();
		new RunLedger(dir, "s1", report).append("run_start", { runId: "run-1" });
		// 模拟进程重启：新实例打开同一文件。
		const reopened = new RunLedger(dir, "s1", report);
		reopened.append("run_end", { runId: "run-1", reason: "completed" });

		const entries = readEntries("s1");
		// 注意：重开时 run-1 未闭合，先补一条合成 interrupted，再写新条目。
		expect(entries.map((e) => e.kind)).toEqual(["run_start", "run_end", "run_end"]);
		expect(entries.map((e) => e.seq)).toEqual([1, 2, 3]);
		expect(entries[1]?.data).toMatchObject({ reason: "interrupted" });
		expect(entries[2]?.data).toMatchObject({ reason: "completed" });
	});

	it("回放容忍坏行（崩溃截断的半行），扫描结果不受影响", () => {
		const { report, messages } = silentReport();
		writeFileSync(
			join(dir, ledgerFileName("s1")),
			'{"seq":1,"at":1,"kind":"run_start","data":{"runId":"run-1"}}\n{"seq":2,"at":2,"kind":"run_end","data":',
			"utf8",
		);
		const ledger = new RunLedger(dir, "s1", report);
		ledger.append("run_end", { runId: "run-1", reason: "completed" });

		const entries = readEntries("s1");
		// 半行被截断修复隔离成独立坏行（解析失败跳过）：run-1 视作未闭合，
		// 构造时先补 interrupted，再写新条目 —— 且新条目没有与半行熔行。
		expect(entries.map((e) => e.kind)).toEqual(["run_start", "run_end", "run_end"]);
		expect(entries.map((e) => e.seq)).toEqual([1, 2, 3]);
		expect(entries.slice(1).map((e) => (e.data as { reason?: string }).reason)).toEqual([
			"interrupted",
			"completed",
		]);
		expect(messages).toHaveLength(0);
	});
});

describe("sealOrphans 中断合成闭合", () => {
	it("未闭合 run（有 run_start 无 run_end）构造时补合成 run_end", () => {
		const { report } = silentReport();
		writeFileSync(
			join(dir, ledgerFileName("s1")),
			'{"seq":1,"at":1,"kind":"run_start","data":{"runId":"run-7"}}\n' +
				'{"seq":2,"at":2,"kind":"llm_call","data":{"turnIndex":0,"startedAt":1,"endedAt":2}}\n',
			"utf8",
		);
		new RunLedger(dir, "s1", report);

		const entries = readEntries("s1");
		expect(entries).toHaveLength(3);
		expect(entries[2]).toMatchObject({
			seq: 3,
			kind: "run_end",
			data: { runId: "run-7", reason: "interrupted" },
		});
	});

	it("已闭合的 run 不补（run_start 后有 run_end）", () => {
		const { report } = silentReport();
		writeFileSync(
			join(dir, ledgerFileName("s1")),
			'{"seq":1,"at":1,"kind":"run_start","data":{"runId":"run-1"}}\n' +
				'{"seq":2,"at":2,"kind":"run_end","data":{"runId":"run-1","reason":"completed"}}\n',
			"utf8",
		);
		new RunLedger(dir, "s1", report);
		expect(readEntries("s1")).toHaveLength(2);
	});

	it("静态 sealOrphans 给冷会话的孤儿 run 补闭合，目录不存在秒退", () => {
		writeFileSync(
			join(dir, ledgerFileName("cold")),
			'{"seq":5,"at":1,"kind":"run_start","data":{"runId":"run-3"}}\n',
			"utf8",
		);
		const reports: string[] = [];
		RunLedger.sealOrphans(dir, (file, m) => reports.push(`${file}: ${m}`));
		RunLedger.sealOrphans(join(dir, "不存在的目录"), (file, m) => reports.push(`${file}: ${m}`));

		const entries = readEntries("cold");
		expect(entries).toHaveLength(2);
		expect(entries[1]).toMatchObject({ seq: 6, kind: "run_end", data: { reason: "interrupted" } });
		expect(reports).toHaveLength(0);
	});
});

describe("写入失败不炸 run", () => {
	it("data 不可序列化（循环引用）：上报并丢弃，不写盘不耗 seq", () => {
		const { report, messages } = silentReport();
		const ledger = new RunLedger(dir, "s1", report);
		const circular: Record<string, unknown> = {};
		circular.self = circular;

		expect(() =>
			ledger.append("queue", circular as unknown as { steering: string[]; followUp: string[] }),
		).not.toThrow();
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("序列化失败");

		ledger.append("run_start", { runId: "run-1" });
		const entries = readEntries("s1");
		// seq 未被失败条目消耗：成功条目仍是 seq 1（无空洞）。
		expect(entries).toHaveLength(1);
		expect(entries[0]?.seq).toBe(1);
	});

	it("写盘 IO 失败：上报并丢弃，append 不抛、后续成功写入不受影响", () => {
		const { report, messages } = silentReport();
		// 把台账文件路径先做成目录：appendFileSync 打上去必抛（EISDIR/EPERM）。
		mkdirSync(join(dir, ledgerFileName("s1")));
		const ledger = new RunLedger(dir, "s1", report);

		expect(() => ledger.append("run_start", { runId: "run-1" })).not.toThrow();
		expect(messages.some((m) => m.includes("写盘失败"))).toBe(true);
	});

	it("sessionId 文件名安全化：路径分隔符被压成下划线", () => {
		expect(ledgerFileName("abc-DEF_123")).toBe("abc-DEF_123.jsonl");
		expect(ledgerFileName("../etc/passwd")).toBe("___etc_passwd.jsonl");
		expect(ledgerFileName("a/b\\c:d")).toBe("a_b_c_d.jsonl");
	});
});
