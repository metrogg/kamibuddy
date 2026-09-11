/**
 * 定时任务库（~/.kamibuddy/automations.json）的读写。
 *
 * 内存缓存 + 变更即落盘：调度器 30s tick 频繁读写，每次重读文件没有必要；
 * 库规模（几十任务 × 每任务 50 条记录）全量重写也很便宜。落盘用
 * 「临时文件 + rename」原子替换 —— 写到一半进程被杀时，读者看到的要么是
 * 完整旧文件要么是完整新文件，不会是半个 JSON（半个 JSON 正是 load()
 * 抛错要防、却又最不该由用户手工收拾的事故）。
 *
 * 与 preferences.ts 的「坏了当空」刻意相反：这里坏了**抛错**。
 * 任务库是用户的业务数据，丢了就没了（不像偏好可重选），
 * 静默清空等于毁数据（spec：损坏时响亮报错不静默吞）。
 *
 * 合法性（调度参数、名称等）不在这里校验 —— 由调用方先过 validateSchedule，
 * 这层只管持久化，分工与 workspace-registry 一致。
 *
 * 不 import pi 与 electron，纯 fs + JSON，可单测（AGENTS.md §1）。
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AutomationRun, AutomationTask } from "../shared/automation.ts";
import { getAutomationsFile } from "./config-paths.ts";

/** 运行记录上限，超出修剪掉最旧的。管理页只看最近，无限增长只会让文件变肥。 */
const MAX_RUNS = 50;

const TASK_STATUSES: ReadonlySet<string> = new Set(["active", "paused", "missed"]);
const SCHEDULE_TYPES: ReadonlySet<string> = new Set(["once", "interval", "daily", "weekly"]);

export class AutomationStore {
	private readonly tasks = new Map<string, AutomationTask>();
	private loaded = false;

	constructor(private readonly filePath: string = getAutomationsFile()) {}

	/**
	 * 从磁盘加载。文件不存在 = 空库；JSON 损坏或结构不符抛错（响亮，不静默重置）。
	 *
	 * 幂等，且各方法会先确保已加载 —— 但 daemon 启动时仍应显式调一次：
	 * 损坏要暴露在启动时刻，而不是推迟到第一次读写才炸。
	 * 抛错后 loaded 不置位，修好文件再调会重读。
	 */
	load(): void {
		if (this.loaded) return;
		let raw: string;
		try {
			raw = readFileSync(this.filePath, "utf8");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				this.loaded = true;
				return;
			}
			throw error;
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch (error) {
			throw new Error(
				`${this.filePath} 不是合法 JSON，已停止加载以免覆盖你的任务库。` +
					`请修好或删除该文件后重试。原始错误：${error instanceof Error ? error.message : String(error)}`,
			);
		}
		if (!Array.isArray(parsed)) {
			throw new Error(
				`${this.filePath} 的顶层应为任务数组，实际是 ${parsed === null ? "null" : typeof parsed}`,
			);
		}
		for (const [index, value] of parsed.entries()) {
			const task = parseTask(value, index, this.filePath);
			this.tasks.set(task.id, task);
		}
		this.loaded = true;
	}

	/**
	 * 全部任务（按文件/插入顺序）。返回内部对象的引用 —— 改字段必须走
	 * upsert 落盘，直接改引用会造成内存与磁盘漂移。
	 */
	list(): AutomationTask[] {
		this.load();
		return [...this.tasks.values()];
	}

	get(id: string): AutomationTask | undefined {
		this.load();
		return this.tasks.get(id);
	}

	/**
	 * 新建或替换同 id 任务（整个对象以入参为准），随即落盘。
	 * updatedAt / nextRunAt 等字段由调用方维护 —— 这层不知道也不猜业务语义。
	 */
	upsert(task: AutomationTask): void {
		this.load();
		this.tasks.set(task.id, task);
		this.persist();
	}

	/**
	 * 删除任务。id 不存在幂等返回（与 removeDisplayName 一致）。
	 * 内置任务（builtin）拒删：它是功能的承载体（记忆蒸馏靠它跑），删掉后
	 * 设置页的开关就成了一具空壳 —— 想停用它请走 memoryEnabled 开关。
	 * 守卫收在这一层而不是 IPC 层：对话内 automation_delete 工具也走这里，
	 * 两条删除路径同一道闸。
	 */
	remove(id: string): void {
		this.load();
		const task = this.tasks.get(id);
		if (task === undefined) return;
		if (task.builtin === true) {
			throw new Error(`「${task.name}」是内置任务，不可删除（可在设置里停用）`);
		}
		this.tasks.delete(id);
		this.persist();
	}

	/**
	 * 追加一条运行记录并修剪至最新 MAX_RUNS 条，随即落盘，返回更新后的任务。
	 *
	 * 只碰 runs：lastRunAt / nextRunAt / updatedAt 的联动更新由调用方走 upsert。
	 * 一次 run 结束处的完整状态在调用方一处组装，免得两个写入口各改一半。
	 */
	appendRun(taskId: string, run: AutomationRun): AutomationTask {
		this.load();
		const task = this.tasks.get(taskId);
		if (task === undefined) throw new Error(`定时任务不存在：${taskId}`);
		const next: AutomationTask = { ...task, runs: [...task.runs, run].slice(-MAX_RUNS) };
		this.tasks.set(taskId, next);
		this.persist();
		return next;
	}

	/** 原子落盘：临时文件写全后 rename 替换（单写者，tmp 名固定即可）。 */
	private persist(): void {
		mkdirSync(dirname(this.filePath), { recursive: true });
		const tmp = `${this.filePath}.tmp`;
		writeFileSync(tmp, `${JSON.stringify([...this.tasks.values()], null, 2)}\n`, "utf8");
		renameSync(tmp, this.filePath);
	}
}

/**
 * 逐条窄化加载结果。我们自己是唯一写者，所以只查「键定位与枚举」层面的
 * 硬错误（id / status / schedule.type）；字段级深入校验不复制一份 schema
 * 在这里 —— 那种损坏会在使用时响亮暴露（如 nextRunAfter 对非法调度抛错）。
 */
function parseTask(value: unknown, index: number, filePath: string): AutomationTask {
	const bad = (reason: string): Error => new Error(`${filePath} 第 ${index + 1} 个任务${reason}`);
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw bad("不是对象");
	const record = value as Record<string, unknown>;
	const id = record["id"];
	if (typeof id !== "string" || id === "") throw bad("缺少 id");
	const status = record["status"];
	if (typeof status !== "string" || !TASK_STATUSES.has(status)) {
		throw bad(`的 status 非法：${String(status)}`);
	}
	const schedule = record["schedule"];
	if (typeof schedule !== "object" || schedule === null) throw bad("缺少 schedule");
	const type = (schedule as Record<string, unknown>)["type"];
	if (typeof type !== "string" || !SCHEDULE_TYPES.has(type)) {
		throw bad(`的 schedule.type 非法：${String(type)}`);
	}
	return value as AutomationTask;
}
