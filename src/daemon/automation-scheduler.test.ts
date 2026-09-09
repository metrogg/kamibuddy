/**
 * automation-scheduler 测试。
 *
 * 纯函数（dueTasks / recoverTasks）不碰定时器直接测；
 * 调度器用「真实 store（临时目录）+ 假执行器 + 注入时间」，
 * tick 手动触发、whenIdle 等队列排空，全程不依赖真实 30s。
 */

import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AutomationStore } from "../core/automation-store.ts";
import type { AutomationTask } from "../shared/automation.ts";
import { nextRunAfter } from "../shared/automation.ts";
import type { AutomationEvent } from "../shared/ipc.ts";
import {
	AutomationScheduler,
	dueTasks,
	recoverTasks,
	type AutomationRunOutcome,
} from "./automation-scheduler.ts";

const NOW = 1_800_000_000_000;

let dir: string;
let file: string;
let store: AutomationStore;
let pushes: AutomationEvent[];
let schedulers: AutomationScheduler[];

beforeEach(() => {
	dir = join(tmpdir(), `kbsched-test-${process.pid}-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	file = join(dir, "automations.json");
	store = new AutomationStore(file);
	store.load();
	pushes = [];
	schedulers = [];
});

afterEach(() => {
	for (const scheduler of schedulers) scheduler.stop();
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
		createdAt: NOW - 10_000,
		updatedAt: NOW - 10_000,
		...overrides,
	};
}

function makeScheduler(
	execute: (task: AutomationTask) => Promise<AutomationRunOutcome>,
	now: () => number = () => NOW,
): AutomationScheduler {
	const scheduler = new AutomationScheduler({
		store,
		execute,
		push: (event) => pushes.push(event),
		now,
		tickMs: 3_600_000, // 测试里不靠真实 tick，手动调 tick()
	});
	schedulers.push(scheduler);
	return scheduler;
}

const OK = (sessionId = "s-1"): AutomationRunOutcome => ({ sessionId, success: true });

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

/* ── dueTasks ─────────────────────────────────────────────────────── */

describe("dueTasks", () => {
	it("只挑 active 且 nextRunAt 到期的任务", () => {
		const tasks = [
			makeTask("due", { nextRunAt: NOW - 1 }),
			makeTask("future", { nextRunAt: NOW + 60_000 }),
			makeTask("paused", { status: "paused", nextRunAt: NOW - 1 }),
			makeTask("missed", { status: "missed", nextRunAt: NOW - 1 }),
			makeTask("no-next", { nextRunAt: undefined }),
		];
		expect(dueTasks(tasks, NOW).map((t) => t.id)).toEqual(["due"]);
	});

	it("nextRunAt 恰等于 now 算到期", () => {
		expect(dueTasks([makeTask("a", { nextRunAt: NOW })], NOW)).toHaveLength(1);
	});

	it("多个到期按 nextRunAt 升序（先到先得）", () => {
		const tasks = [
			makeTask("late", { nextRunAt: NOW - 100 }),
			makeTask("early", { nextRunAt: NOW - 500 }),
			makeTask("mid", { nextRunAt: NOW - 300 }),
		];
		expect(dueTasks(tasks, NOW).map((t) => t.id)).toEqual(["early", "mid", "late"]);
	});
});

/* ── recoverTasks ─────────────────────────────────────────────────── */

describe("recoverTasks", () => {
	it("过期 once 且从未跑过 → missed，nextRunAt 清空", () => {
		const task = makeTask("once", {
			schedule: { type: "once", at: NOW - 60_000 },
			nextRunAt: NOW - 60_000,
		});
		const recovered = recoverTasks([task], NOW);
		expect(recovered).toHaveLength(1);
		expect(recovered[0]).toMatchObject({ status: "missed", nextRunAt: undefined });
	});

	it("nextRunAt 缺失且从未跑过的 once → missed", () => {
		const task = makeTask("once", {
			schedule: { type: "once", at: NOW - 60_000 },
			nextRunAt: undefined,
		});
		expect(recoverTasks([task], NOW)).toHaveLength(1);
		expect(recoverTasks([task], NOW)[0]?.status).toBe("missed");
	});

	it("还在未来的 once 不动", () => {
		const task = makeTask("once", {
			schedule: { type: "once", at: NOW + 60_000 },
			nextRunAt: NOW + 60_000,
		});
		expect(recoverTasks([task], NOW)).toEqual([]);
	});

	it("已自动跑过的 once（lastRunAt 有值）不动", () => {
		const task = makeTask("once", {
			schedule: { type: "once", at: NOW - 60_000 },
			nextRunAt: undefined,
			lastRunAt: NOW - 60_000,
		});
		expect(recoverTasks([task], NOW)).toEqual([]);
	});

	it("周期任务重算 nextRunAt 到将来（关闭期间错过的不补跑）", () => {
		const schedule = { type: "daily", time: "09:00" } as const;
		const task = makeTask("daily", { schedule, nextRunAt: NOW - 86_400_000 });
		const recovered = recoverTasks([task], NOW);
		expect(recovered).toHaveLength(1);
		expect(recovered[0]?.nextRunAt).toBe(nextRunAfter(schedule, NOW));
		expect(recovered[0]?.nextRunAt).toBeGreaterThan(NOW);
		expect(recovered[0]?.status).toBe("active");
	});

	it("周期任务 nextRunAt 已正确时不列入（不产生多余落盘）", () => {
		const schedule = { type: "daily", time: "09:00" } as const;
		const task = makeTask("daily", { schedule, nextRunAt: nextRunAfter(schedule, NOW) });
		expect(recoverTasks([task], NOW)).toEqual([]);
	});

	it("paused / missed 任务一律不动", () => {
		const paused = makeTask("paused", { status: "paused", nextRunAt: NOW - 1000 });
		const missed = makeTask("missed", { status: "missed", nextRunAt: undefined });
		expect(recoverTasks([paused, missed], NOW)).toEqual([]);
	});
});

/* ── 调度器：启动恢复 ─────────────────────────────────────────────── */

describe("start 恢复", () => {
	it("恢复结果落盘并推一次 changed", () => {
		store.upsert(
			makeTask("expired", {
				schedule: { type: "once", at: NOW - 60_000 },
				nextRunAt: NOW - 60_000,
			}),
		);
		const scheduler = makeScheduler(async () => OK());
		scheduler.start();

		expect(store.get("expired")?.status).toBe("missed");
		expect(store.get("expired")?.nextRunAt).toBeUndefined();
		expect(pushes).toEqual([{ kind: "changed" }]);
	});

	it("没有需要恢复的任务时不推 changed", () => {
		// 「健康」= nextRunAt 与按当前时间重算的结果一致（恢复逻辑对它无事可做）。
		const schedule = { type: "daily", time: "09:00" } as const;
		store.upsert(makeTask("healthy", { schedule, nextRunAt: nextRunAfter(schedule, NOW) }));
		const scheduler = makeScheduler(async () => OK());
		scheduler.start();
		expect(pushes).toEqual([]);
	});
});

/* ── 调度器：到期执行与记账 ───────────────────────────────────────── */

describe("到期执行", () => {
	it("自动运行后记账：runs 追加、lastRunAt 落定、nextRunAt 推进，推 runFinished + changed", async () => {
		const schedule = { type: "interval", everyMinutes: 60 } as const;
		store.upsert(makeTask("a", { schedule, nextRunAt: NOW - 1 }));
		makeScheduler(async () => OK("sess-a")).tick();
		await whenIdleAll();

		const task = store.get("a");
		expect(task?.runs).toHaveLength(1);
		expect(task?.runs[0]).toMatchObject({
			sessionId: "sess-a",
			startedAt: NOW,
			finishedAt: NOW,
			success: true,
		});
		expect(task?.lastRunAt).toBe(NOW);
		expect(task?.nextRunAt).toBe(nextRunAfter(schedule, NOW));
		expect(task?.status).toBe("active");
		expect(pushes).toEqual([
			{ kind: "runFinished", taskId: "a", taskName: "任务 a", sessionId: "sess-a", success: true },
			{ kind: "changed" },
		]);
	});

	it("once 自动运行后 nextRunAt 清空、status 不动", async () => {
		store.upsert(
			makeTask("once", {
				schedule: { type: "once", at: NOW - 1 },
				nextRunAt: NOW - 1,
			}),
		);
		makeScheduler(async () => OK()).tick();
		await whenIdleAll();

		const task = store.get("once");
		expect(task?.nextRunAt).toBeUndefined();
		expect(task?.status).toBe("active");
		expect(task?.lastRunAt).toBe(NOW);
	});

	it("慢任务跨过下一个 tick 不叠加，队列串行 FIFO", async () => {
		const gate = deferred<AutomationRunOutcome>();
		const calls: string[] = [];
		store.upsert(makeTask("a", { nextRunAt: NOW - 100 }));
		store.upsert(makeTask("b", { nextRunAt: NOW - 50 }));

		const scheduler = makeScheduler((task) => {
			calls.push(task.id);
			return task.id === "a" ? gate.promise : Promise.resolve(OK());
		});
		scheduler.tick();
		// a 进行中时再 tick：a 不重复入队，b 已排过一次也不重复
		scheduler.tick();
		expect(calls).toEqual(["a"]);
		expect(scheduler.isBusy("a")).toBe(true);
		expect(scheduler.isBusy("b")).toBe(true);

		gate.resolve(OK());
		await scheduler.whenIdle();
		expect(calls).toEqual(["a", "b"]);
	});

	it("执行器违约抛错：记成失败 run，队列继续走下一个", async () => {
		const calls: string[] = [];
		store.upsert(makeTask("bad", { nextRunAt: NOW - 100 }));
		store.upsert(makeTask("good", { nextRunAt: NOW - 50 }));

		makeScheduler((task) => {
			calls.push(task.id);
			if (task.id === "bad") return Promise.reject(new Error("装配炸了"));
			return Promise.resolve(OK());
		}).tick();
		await whenIdleAll();

		expect(calls).toEqual(["bad", "good"]);
		const bad = store.get("bad");
		expect(bad?.runs[0]).toMatchObject({ success: false, error: "装配炸了", sessionId: "" });
		expect(pushes).toContainEqual({
			kind: "runFinished",
			taskId: "bad",
			taskName: "任务 bad",
			sessionId: "",
			success: false,
		});
	});
});

/* ── 调度器：手动运行 ─────────────────────────────────────────────── */

describe("runNow 手动运行", () => {
	it("只追加运行记录，不动 status / nextRunAt / lastRunAt", async () => {
		const futureNext = NOW + 60_000;
		store.upsert(makeTask("a", { nextRunAt: futureNext }));
		makeScheduler(async () => OK("sess-manual")).runNow("a");
		await whenIdleAll();

		const task = store.get("a");
		expect(task?.runs).toHaveLength(1);
		expect(task?.runs[0]).toMatchObject({ sessionId: "sess-manual", success: true });
		expect(task?.nextRunAt).toBe(futureNext);
		expect(task?.lastRunAt).toBeUndefined();
		expect(pushes).toContainEqual({
			kind: "runFinished",
			taskId: "a",
			taskName: "任务 a",
			sessionId: "sess-manual",
			success: true,
		});
	});

	it("paused 任务可以手动运行", async () => {
		store.upsert(makeTask("a", { status: "paused", nextRunAt: NOW + 60_000 }));
		makeScheduler(async () => OK()).runNow("a");
		await whenIdleAll();
		expect(store.get("a")?.runs).toHaveLength(1);
		expect(store.get("a")?.status).toBe("paused");
	});

	it("missed 的一次性任务拒绝手动运行", () => {
		store.upsert(makeTask("a", { status: "missed", nextRunAt: undefined }));
		const scheduler = makeScheduler(async () => OK());
		expect(() => scheduler.runNow("a")).toThrow(/错过预定时刻/);
	});

	it("不存在的任务报错", () => {
		const scheduler = makeScheduler(async () => OK());
		expect(() => scheduler.runNow("ghost")).toThrow(/不存在/);
	});

	it("已在队列中重复手动运行报错", async () => {
		const gate = deferred<AutomationRunOutcome>();
		store.upsert(makeTask("a", { nextRunAt: NOW + 60_000 }));
		const scheduler = makeScheduler(() => gate.promise);
		scheduler.runNow("a");
		expect(() => scheduler.runNow("a")).toThrow(/已在运行队列中/);
		gate.resolve(OK());
		await scheduler.whenIdle();
	});
});

async function whenIdleAll(): Promise<void> {
	await Promise.all(schedulers.map((s) => s.whenIdle()));
}
