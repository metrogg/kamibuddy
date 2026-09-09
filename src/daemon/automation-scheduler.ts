/**
 * 定时任务调度器：30s tick 扫到期任务 → 串行队列执行。
 *
 * 串行而不是并发：多个任务同期到期时一个 run 进行中其余顺延 FIFO
 * （spec：add-automation-scheduler，明确不做并发多 run）。
 *
 * 可测性切分：
 *   - 到期判定（dueTasks）与启动恢复（recoverTasks）是纯函数，单测不碰定时器；
 *   - 时间与 tick 间隔注入（now / tickMs），队列测试用手动 tick + whenIdle，
 *     不依赖真实 30s 等待。
 *
 * 失败语义：执行器约定不抛（各类失败折进 AutomationRunOutcome，见
 * automation-runner.ts）；它真违约抛了，这里记成失败 run 而不是让异常
 * 穿出队列 —— 一个任务失败不能杀掉整条队列，这是队列的韧性边界，
 * 不是防御性兜底（每种失败都落成了可见的运行记录）。
 */

import type { AutomationTask } from "../shared/automation.ts";
import { nextRunAfter } from "../shared/automation.ts";
import type { AutomationEvent } from "../shared/ipc.ts";
import type { AutomationStore } from "../core/automation-store.ts";

/** 一次 run 的结局（执行器把装配失败/模型错误/超时都折进这里，不抛）。 */
export interface AutomationRunOutcome {
	/** 运行会话 id。装配失败时为空串（没有会话可指）。 */
	readonly sessionId: string;
	readonly success: boolean;
	readonly error?: string;
}

export type AutomationRunExecutor = (task: AutomationTask) => Promise<AutomationRunOutcome>;

export interface AutomationSchedulerOptions {
	readonly store: AutomationStore;
	readonly execute: AutomationRunExecutor;
	/** 事件出口（daemon 接成 PUSH.automationEvent 推给 renderer）。 */
	readonly push: (event: AutomationEvent) => void;
	/** 时间源注入（测试用），缺省 Date.now。 */
	readonly now?: () => number;
	/** tick 间隔注入（测试用），缺省 30s。 */
	readonly tickMs?: number;
}

const DEFAULT_TICK_MS = 30_000;

/**
 * 到期任务：active 且 nextRunAt 已到，按 nextRunAt 升序（先到先得，FIFO 语义）。
 * paused / missed 不在列；nextRunAt 缺失（once 已跑完）也不在列。
 */
export function dueTasks(
	tasks: readonly AutomationTask[],
	now: number,
): (AutomationTask & { readonly nextRunAt: number })[] {
	return tasks
		.filter(
			(task): task is AutomationTask & { readonly nextRunAt: number } =>
				task.status === "active" && task.nextRunAt !== undefined && task.nextRunAt <= now,
		)
		.sort((a, b) => a.nextRunAt - b.nextRunAt);
}

/**
 * 启动恢复（纯函数）：返回需要落盘修正的任务。
 *
 * 应用关闭期间错过的任务**不补跑**（spec）：
 *   - once：从未自动跑过（lastRunAt 缺省 —— 它只由自动运行记账，手动运行不动它，
 *     见 execute）且预定时刻已过 → 标 missed；
 *   - 周期任务：按当前时间重算 nextRunAt，错过几轮就让它过去，下一次在将来。
 * paused / missed 不动：paused 重新启用时由 toggle 重算，missed 已是终态。
 */
export function recoverTasks(tasks: readonly AutomationTask[], now: number): AutomationTask[] {
	const recovered: AutomationTask[] = [];
	for (const task of tasks) {
		if (task.status !== "active") continue;
		if (task.schedule.type === "once") {
			if (task.lastRunAt !== undefined) continue; // 已自动跑过，nextRunAt 已无、保持原样
			if (task.nextRunAt !== undefined && task.nextRunAt > now) continue; // 还在未来
			recovered.push({ ...task, status: "missed", nextRunAt: undefined, updatedAt: now });
			continue;
		}
		// nextRunAfter 对非法调度抛错 —— 手改坏的库在启动时响亮暴露（store 契约同口径）。
		const nextRunAt = nextRunAfter(task.schedule, now);
		if (nextRunAt !== task.nextRunAt) {
			recovered.push({ ...task, nextRunAt, updatedAt: now });
		}
	}
	return recovered;
}

interface QueueEntry {
	readonly taskId: string;
	readonly taskName: string;
	/**
	 * 手动运行标记。手动 = 「额外执行一次」：只追加运行记录，
	 * 不动 status / nextRunAt / lastRunAt（理由见 execute 的注释）。
	 */
	readonly manual: boolean;
}

export class AutomationScheduler {
	private readonly queue: QueueEntry[] = [];
	private runningTaskId: string | undefined;
	private timer: ReturnType<typeof setInterval> | undefined;
	private readonly idleWaiters = new Set<() => void>();

	constructor(private readonly options: AutomationSchedulerOptions) {}

	private now(): number {
		return this.options.now?.() ?? Date.now();
	}

	/**
	 * 启动恢复 + 开始 tick。恢复结果有变更时推一次 changed（renderer 重拉列表）。
	 * store.load() 应由调用方（daemon 启动流程）先显式调过 —— 库损坏暴露在启动时刻。
	 */
	start(): void {
		const recovered = recoverTasks(this.options.store.list(), this.now());
		for (const task of recovered) this.options.store.upsert(task);
		if (recovered.length > 0) this.options.push({ kind: "changed" });

		this.timer = setInterval(() => this.tick(), this.options.tickMs ?? DEFAULT_TICK_MS);
		// 调度器不该是吊住进程的那个东西：daemon 的生命周期归父端口的消息监听管。
		this.timer.unref?.();
	}

	stop(): void {
		if (this.timer !== undefined) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}

	/** 扫一遍到期任务入队（幂等：已排队/进行中的不重复入）。tick 之外也可手动调。 */
	tick(): void {
		const now = this.now();
		for (const task of dueTasks(this.options.store.list(), now)) {
			this.enqueue({ taskId: task.id, taskName: task.name, manual: false });
		}
	}

	/**
	 * 手动运行一次，进同一串行队列。
	 * 校验存在与状态：missed 的一次性任务没有「再跑一次」的语义（要重跑先编辑调度）；
	 * paused 可以手动跑 —— 暂停只停自动触发，不剥夺用户显式执行的权利。
	 */
	runNow(taskId: string): void {
		const task = this.options.store.get(taskId);
		if (task === undefined) throw new Error("定时任务不存在");
		if (task.status === "missed") {
			throw new Error("这是一次性任务且已错过预定时刻，请先编辑调度或重新启用");
		}
		if (this.isBusy(taskId)) throw new Error("该任务已在运行队列中");
		this.enqueue({ taskId: task.id, taskName: task.name, manual: true });
	}

	/** 该任务是否正在运行或排队中（删除守卫用：运行中的任务拒删）。 */
	isBusy(taskId: string): boolean {
		return this.runningTaskId === taskId || this.queue.some((e) => e.taskId === taskId);
	}

	/** 等队列排空（测试用；将来优雅退出也用得上）。 */
	whenIdle(): Promise<void> {
		return new Promise((resolve) => {
			const check = (): void => {
				if (this.runningTaskId === undefined && this.queue.length === 0) {
					resolve();
				} else {
					this.idleWaiters.add(check);
				}
			};
			check();
		});
	}

	private signalIdle(): void {
		if (this.runningTaskId !== undefined || this.queue.length > 0) return;
		for (const waiter of this.idleWaiters) waiter();
		this.idleWaiters.clear();
	}

	private enqueue(entry: QueueEntry): void {
		// 同一任务一次一个 run：慢任务跨过下一个 tick 时不叠加，错过的那次
		// 由完成时的 nextRunAt 重算自然兜底（周期任务本来就是按序列找下一个点）。
		if (this.isBusy(entry.taskId)) return;
		this.queue.push(entry);
		this.pump();
	}

	private pump(): void {
		if (this.runningTaskId !== undefined) return;
		const entry = this.queue.shift();
		if (entry === undefined) {
			this.signalIdle();
			return;
		}
		this.runningTaskId = entry.taskId;
		void this.execute(entry)
			.catch((error: unknown) => {
				// execute 内部已把 run 级失败记成运行记录；能抛到这里的只剩
				// 记账路径自身的异常（如库被手改坏让 nextRunAfter 抛错）。
				// 让它响到终端，但队列必须继续走下一个任务。
				console.error(`定时任务「${entry.taskName}」的运行记账失败：`, error);
			})
			.finally(() => {
				this.runningTaskId = undefined;
				this.pump();
			});
	}

	private async execute(entry: QueueEntry): Promise<void> {
		// 入队后任务可能已被删（对话内 automation_delete 工具不经 IPC 的删除守卫）——
		// 队列与库之间没有事务，执行前再取一次，没了就跳过。
		const task = this.options.store.get(entry.taskId);
		if (task === undefined) return;

		const startedAt = this.now();
		let outcome: AutomationRunOutcome;
		try {
			outcome = await this.options.execute(task);
		} catch (error) {
			// 执行器约定不抛；真抛了记成失败 run（文件头注释：队列韧性边界）。
			outcome = {
				sessionId: "",
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
		const finishedAt = this.now();

		const withRun = this.options.store.appendRun(task.id, {
			sessionId: outcome.sessionId,
			startedAt,
			finishedAt,
			success: outcome.success,
			...(outcome.error === undefined ? {} : { error: outcome.error }),
		});

		if (!entry.manual) {
			/*
			 * 自动运行才推进调度语义：lastRunAt 记账、nextRunAt 走到调度序列里
			 * 严格晚于完成时刻的下一个点（once 再无下一次 → undefined，status 不动）。
			 * 手动运行不动这些字段 —— 它是「额外执行一次」，不该推迟既定调度：
			 * interval 是 epoch 锚、与运行时刻无关；once 手动跑过照样到点再触发。
			 * 以 withRun（库里的最新版）为基底：run 进行中用户可能编辑过任务，
			 * 调度与状态以新值为准，不被这次完成写回旧值。
			 */
			this.options.store.upsert({
				...withRun,
				lastRunAt: finishedAt,
				nextRunAt: nextRunAfter(withRun.schedule, finishedAt),
				updatedAt: finishedAt,
			});
		}

		this.options.push({
			kind: "runFinished",
			taskId: withRun.id,
			taskName: withRun.name,
			sessionId: outcome.sessionId,
			success: outcome.success,
		});
		// 运行记录本身就是任务数据变更（管理页列表要刷新最近运行）。
		this.options.push({ kind: "changed" });
	}
}
