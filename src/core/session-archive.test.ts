import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionArchive } from "./session-archive.ts";

let base: string;

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "kami-archive-"));
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

function archiveAt(file: string): SessionArchive {
	return new SessionArchive(file);
}

describe("SessionArchive", () => {
	it("无索引文件 = 空索引（isArchived false / archivedAt undefined）", () => {
		const store = archiveAt(join(base, "archive.json"));
		expect(store.isArchived("C:\\s\\a.jsonl")).toBe(false);
		expect(store.archivedAt("C:\\s\\a.jsonl")).toBeUndefined();
	});

	it("归档 / 查询 / 取消归档，落盘原子可重读", () => {
		const file = join(base, "archive.json");
		const store = archiveAt(file);
		store.setArchived("C:\\s\\a.jsonl", true, 1000);
		store.setArchived("C:\\s\\b.jsonl", true, 2000);
		expect(store.isArchived("C:\\s\\a.jsonl")).toBe(true);
		expect(store.archivedAt("C:\\s\\a.jsonl")).toBe(1000);

		// 新实例从盘上重读（独立进程视角）
		const reopened = archiveAt(file);
		expect(reopened.isArchived("C:\\s\\b.jsonl")).toBe(true);

		reopened.setArchived("C:\\s\\a.jsonl", false, 3000);
		expect(reopened.isArchived("C:\\s\\a.jsonl")).toBe(false);
		// 取消归档落盘：再开一个实例验证
		expect(archiveAt(file).isArchived("C:\\s\\a.jsonl")).toBe(false);
	});

	it("幂等：重复归档 / 取消不重复落盘（mtime 不变）", () => {
		const file = join(base, "archive.json");
		const store = archiveAt(file);
		store.setArchived("C:\\s\\a.jsonl", true, 1000);
		const first = fs_statMtime(file);
		store.setArchived("C:\\s\\a.jsonl", true, 2000);
		store.setArchived("C:\\s\\never.jsonl", false, 3000);
		expect(fs_statMtime(file)).toBe(first);
	});

	it("损坏 / 非对象索引当空（视图状态可重做，不炸会话列表）", () => {
		const file = join(base, "archive.json");
		writeFileSync(file, "not json{{{", "utf8");
		const store = archiveAt(file);
		expect(store.isArchived("C:\\s\\a.jsonl")).toBe(false);
		// 照常可用：写新状态会覆盖坏文件
		store.setArchived("C:\\s\\a.jsonl", true, 1000);
		expect(JSON.parse(readFileSync(file, "utf8"))["C:\\s\\a.jsonl"]).toBe(1000);
	});

	it("数组形态当空（防御手改出结构错误）", () => {
		const file = join(base, "archive.json");
		writeFileSync(file, "[]", "utf8");
		const store = archiveAt(file);
		expect(store.isArchived("C:\\s\\a.jsonl")).toBe(false);
	});
});

function fs_statMtime(file: string): number {
	return statSync(file).mtimeMs;
}
