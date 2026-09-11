/**
 * 内置「记忆整理」任务的 ensure 逻辑测试。
 *
 * 路径经 KAMIBUDDY_CONFIG_DIR 指到临时目录（与 preferences.test.ts 同一招），
 * 任务库用该目录下的 automations.json。
 */

import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AutomationStore } from "./automation-store.ts";
import { BUILTIN_MEMORY_TASK_ID, ensureBuiltinMemoryTask } from "./builtin-memory-task.ts";

let dir: string;
let store: AutomationStore;

const NOW = Date.parse("2026-09-11T10:00:00");

beforeEach(() => {
	dir = join(tmpdir(), `kbbm-test-${process.pid}-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	process.env["KAMIBUDDY_CONFIG_DIR"] = dir;
	store = new AutomationStore(join(dir, "automations.json"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	delete process.env["KAMIBUDDY_CONFIG_DIR"];
});

describe("ensureBuiltinMemoryTask", () => {
	it("库里没有 → 创建：固定 id / 名称 / daily 03:00 / cwd=配置目录 / builtin", () => {
		expect(ensureBuiltinMemoryTask(store, true, NOW)).toBe(true);

		const task = store.get(BUILTIN_MEMORY_TASK_ID);
		expect(task).toMatchObject({
			id: "builtin-memory-distill",
			name: "记忆整理",
			schedule: { type: "daily", time: "03:00" },
			cwd: dir,
			status: "active",
			builtin: true,
			runs: [],
		});
		// daily 03:00 相对当天上午 10 点的下一次是明天 03:00。
		expect(task?.nextRunAt).toBe(Date.parse("2026-09-12T03:00:00"));
	});

	it("memoryEnabled=false → 创建出来就是 paused", () => {
		expect(ensureBuiltinMemoryTask(store, false, NOW)).toBe(true);
		expect(store.get(BUILTIN_MEMORY_TASK_ID)?.status).toBe("paused");
	});

	it("prompt 给齐原料与产物路径，并钉住两节结构与「无新不改写」纪律", () => {
		ensureBuiltinMemoryTask(store, true, NOW);
		const prompt = store.get(BUILTIN_MEMORY_TASK_ID)?.prompt ?? "";
		expect(prompt).toContain(join(dir, "sessions"));
		expect(prompt).toContain(join(dir, "PROFILE.md"));
		expect(prompt).toContain("## 工作背景");
		expect(prompt).toContain("## 个人背景");
		expect(prompt).toContain("最近 3 天");
		expect(prompt).toContain("没有新信息时不改写文件");
	});

	it("已存在且状态一致 → 不动（幂等，不重复落盘）", () => {
		ensureBuiltinMemoryTask(store, true, NOW);
		const before = store.get(BUILTIN_MEMORY_TASK_ID);
		expect(ensureBuiltinMemoryTask(store, true, NOW)).toBe(false);
		expect(store.get(BUILTIN_MEMORY_TASK_ID)).toEqual(before);
	});

	it("toggle 是启停权威：用户手动停掉的任务会被拉回 memoryEnabled=true", () => {
		ensureBuiltinMemoryTask(store, true, NOW);
		const paused = { ...store.get(BUILTIN_MEMORY_TASK_ID)!, status: "paused" as const };
		store.upsert(paused);

		expect(ensureBuiltinMemoryTask(store, true, NOW)).toBe(true);
		const task = store.get(BUILTIN_MEMORY_TASK_ID);
		expect(task?.status).toBe("active");
		// 启用按当前时间重算下一次（与 toggleAutomation 同语义）。
		expect(task?.nextRunAt).toBe(Date.parse("2026-09-12T03:00:00"));
	});

	it("memoryEnabled=false → 已存在的 active 任务被停用，其余字段不覆盖", () => {
		ensureBuiltinMemoryTask(store, true, NOW);
		// 模拟用户编辑过 prompt（ensure 不许把它冲掉）。
		const edited = { ...store.get(BUILTIN_MEMORY_TASK_ID)!, prompt: "用户改过的内容" };
		store.upsert(edited);

		expect(ensureBuiltinMemoryTask(store, false, NOW)).toBe(true);
		const task = store.get(BUILTIN_MEMORY_TASK_ID);
		expect(task?.status).toBe("paused");
		expect(task?.prompt).toBe("用户改过的内容");
		// 停用保留 nextRunAt（与 toggleAutomation 同语义）。
		expect(task?.nextRunAt).toBe(edited.nextRunAt);
	});
});
