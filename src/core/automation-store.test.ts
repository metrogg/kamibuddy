/**
 * automation-store 测试。
 *
 * store 构造直接收文件路径，测试用临时目录隔离即可，
 * 不需要像 preferences.test.ts 那样借 KAMIBUDDY_CONFIG_DIR 绕。
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AutomationRun, AutomationTask } from "../shared/automation.ts";
import { AutomationStore } from "./automation-store.ts";

let dir: string;
let file: string;

beforeEach(() => {
	dir = join(tmpdir(), `kbaut-test-${process.pid}-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	file = join(dir, "automations.json");
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

function makeTask(id: string, overrides: Partial<AutomationTask> = {}): AutomationTask {
	return {
		id,
		name: `任务 ${id}`,
		prompt: "整理昨天的会议纪要",
		schedule: { type: "daily", time: "09:00" },
		status: "active",
		cwd: "D:\\work",
		runs: [],
		createdAt: 1000,
		updatedAt: 1000,
		...overrides,
	};
}

function makeRun(sessionId: string, startedAt: number): AutomationRun {
	return { sessionId, startedAt, finishedAt: startedAt + 100, success: true };
}

describe("加载", () => {
	it("文件不存在 = 空库", () => {
		const store = new AutomationStore(file);
		store.load();
		expect(store.list()).toEqual([]);
	});

	it("损坏 JSON 抛错（响亮，不静默重置）", () => {
		writeFileSync(file, "{ this is not json", "utf8");
		expect(() => new AutomationStore(file).load()).toThrow(/不是合法 JSON/);
	});

	it("顶层非数组抛错", () => {
		writeFileSync(file, '{"a": 1}', "utf8");
		expect(() => new AutomationStore(file).load()).toThrow(/顶层应为任务数组/);
	});

	it("任务缺 id 抛错", () => {
		writeFileSync(file, JSON.stringify([{ name: "没有 id" }]), "utf8");
		expect(() => new AutomationStore(file).load()).toThrow(/缺少 id/);
	});

	it("status 非法抛错", () => {
		writeFileSync(
			file,
			JSON.stringify([{ id: "a", status: "running", schedule: { type: "daily" } }]),
			"utf8",
		);
		expect(() => new AutomationStore(file).load()).toThrow(/status 非法/);
	});

	it("抛错后可重试：修好文件再 load 正常", () => {
		writeFileSync(file, "{ bad", "utf8");
		const store = new AutomationStore(file);
		expect(() => store.load()).toThrow(/不是合法 JSON/);
		writeFileSync(file, "[]", "utf8");
		store.load();
		expect(store.list()).toEqual([]);
	});
});

describe("CRUD", () => {
	it("upsert 后跨实例读回（变更即落盘）", () => {
		const store = new AutomationStore(file);
		store.upsert(makeTask("a"));
		store.upsert(makeTask("b"));

		const reread = new AutomationStore(file);
		expect(reread.list().map((t) => t.id)).toEqual(["a", "b"]);
		expect(reread.get("a")).toEqual(makeTask("a"));
		expect(reread.get("nonexistent")).toBeUndefined();
	});

	it("upsert 同 id 整体替换，不产生重复", () => {
		const store = new AutomationStore(file);
		store.upsert(makeTask("a"));
		store.upsert(makeTask("a", { name: "改名后", updatedAt: 2000 }));

		const reread = new AutomationStore(file);
		expect(reread.list()).toHaveLength(1);
		expect(reread.get("a")?.name).toBe("改名后");
		expect(reread.get("a")?.updatedAt).toBe(2000);
	});

	it("remove 删除并落盘", () => {
		const store = new AutomationStore(file);
		store.upsert(makeTask("a"));
		store.upsert(makeTask("b"));
		store.remove("a");

		const reread = new AutomationStore(file);
		expect(reread.list().map((t) => t.id)).toEqual(["b"]);
	});

	it("remove 不存在的 id 幂等返回", () => {
		const store = new AutomationStore(file);
		store.upsert(makeTask("a"));
		store.remove("nonexistent");
		expect(store.list()).toHaveLength(1);
	});
});

describe("builtin 内置任务（spec: add-memory-system）", () => {
	it("builtin 字段序列化往返不丢", () => {
		const store = new AutomationStore(file);
		store.upsert(makeTask("a", { builtin: true }));

		const reread = new AutomationStore(file);
		expect(reread.get("a")?.builtin).toBe(true);
	});

	it("旧格式兼容：文件里没有 builtin 字段读出为 undefined，删除不受拒", () => {
		// 手写一份没有 builtin 键的旧格式文件（不经过 upsert，upsert 会把
		// 内存里的字段落进去，模拟不了「旧版本应用写出的文件」）。
		writeFileSync(file, `${JSON.stringify([makeTask("a")], null, 2)}\n`, "utf8");

		const store = new AutomationStore(file);
		expect(store.get("a")?.builtin).toBeUndefined();
		store.remove("a");
		expect(store.list()).toEqual([]);
	});

	it("builtin 任务拒绝删除（响亮报错，库内容不变）", () => {
		const store = new AutomationStore(file);
		store.upsert(makeTask("a", { name: "记忆整理", builtin: true }));
		expect(() => store.remove("a")).toThrow(/内置任务，不可删除/);

		const reread = new AutomationStore(file);
		expect(reread.get("a")?.builtin).toBe(true);
	});
});

describe("appendRun", () => {
	it("追加记录并跨实例读回", () => {
		const store = new AutomationStore(file);
		store.upsert(makeTask("a"));
		store.appendRun("a", makeRun("s1", 10_000));
		const updated = store.appendRun("a", makeRun("s2", 20_000));
		expect(updated.runs.map((r) => r.sessionId)).toEqual(["s1", "s2"]);

		const reread = new AutomationStore(file);
		expect(reread.get("a")?.runs.map((r) => r.sessionId)).toEqual(["s1", "s2"]);
	});

	it("修剪至最新 50 条（最旧的先丢）", () => {
		const store = new AutomationStore(file);
		store.upsert(makeTask("a"));
		for (let i = 0; i < 55; i++) {
			store.appendRun("a", makeRun(`s${i}`, i * 1000));
		}
		const runs = store.get("a")?.runs;
		expect(runs).toHaveLength(50);
		expect(runs?.[0]?.sessionId).toBe("s5");
		expect(runs?.[49]?.sessionId).toBe("s54");

		const reread = new AutomationStore(file);
		expect(reread.get("a")?.runs).toHaveLength(50);
	});

	it("不动 runs 之外的字段（lastRunAt 联动是调用方的事）", () => {
		const store = new AutomationStore(file);
		store.upsert(makeTask("a", { lastRunAt: 123 }));
		const updated = store.appendRun("a", makeRun("s1", 10_000));
		expect(updated.lastRunAt).toBe(123);
	});

	it("任务不存在抛错", () => {
		const store = new AutomationStore(file);
		expect(() => store.appendRun("nonexistent", makeRun("s1", 10_000))).toThrow(
			/定时任务不存在/,
		);
	});
});
