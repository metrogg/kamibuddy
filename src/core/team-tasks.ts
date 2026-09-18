/**
 * 团队共享任务板（纯逻辑，spec: add-team-collaboration-parity 批次 ①）。
 *
 * 形状对齐 WorkBuddy 的 Agent Teams Task List：三态 + owner + 依赖，
 * **上游完成自动解锁下游**。差异有意为之：
 *   - 状态多一个 `ready`：WorkBuddy 把「依赖已满足」隐含在 pending 里，
 *     模型要靠自己推断哪些能开工；显式拆出 ready 后，`team_task_list` 的输出
 *     就是「现在能做什么」的直接答案（少一轮推理 = 少一轮 token）。
 *   - 依赖**只在创建时声明**：新任务的 blockedBy 只能引用已存在的任务
 *     （含同批次里先创建的那些），于是有向图天然无环——不需要运行期拓扑排序，
 *     也不存在「改依赖改出环」的操作面。真要改依赖就取消重建（明确且可追溯）。
 *   - 依赖被取消 → 下游**级联取消**：上游不会完成，下游永远等不到，
 *     留着 pending 只会让主理人反复追问「为什么还不开工」。
 *
 * 与 `todo_write` 的关系：**无关**。todo 是主会话的消息流投影（全量替换、
 * 不落盘、无 owner/依赖），这张板是团队协调状态（有依赖、会被多轮读写、
 * 批次 ⑤ 起落盘）。两者并存，互不覆盖。
 *
 * 时间与 id 生成可注入，单测拿确定性结果（同 mailbox.ts 取向）。
 */

/** 任务状态：pending 等依赖、ready 可开工、in_progress 有人在做、completed / cancelled 终态。 */
export type TeamTaskStatus = "pending" | "ready" | "in_progress" | "completed" | "cancelled";

export interface TeamTaskInput {
	readonly title: string;
	/** 任务说明（自我包含：成员看不到领导的历史）。 */
	readonly detail?: string;
	/** 指派的成员名（缺省 = 未指派，由后续 team_task_update 指派）。 */
	readonly owner?: string;
	/** 依赖的任务 id（必须已存在）。 */
	readonly blockedBy?: readonly string[];
}

export interface TeamTask {
	/** 板内唯一 id（`t1`、`t2`…，按创建序）。 */
	readonly id: string;
	readonly title: string;
	readonly detail: string;
	owner: string | undefined;
	readonly blockedBy: readonly string[];
	status: TeamTaskStatus;
	/** 完成说明 / 产出摘要（主理人写）。 */
	result: string;
	readonly createdAt: number;
	updatedAt: number;
}

export interface TeamTaskClock {
	now: () => number;
}

const defaultClock: TeamTaskClock = { now: () => Date.now() };

/** 单张板的内部状态：任务按创建序 + 已分配过的 id 计数。 */
interface Board {
	readonly tasks: TeamTask[];
	/** 下一个 id 序号（只增不减，取消任务后也不复用 id）。 */
	nextSeq: number;
}

function requireNonEmpty(value: string, label: string): string {
	if (value === "") throw new Error(`${label}不能为空`);
	return value;
}

/**
 * 对外一律给快照，不把板内的可变对象交出去。
 *
 * 起因是测试抓到的一类静默 bug：调用方（工具层、投影层）若持有板内对象的引用，
 * 后续任何一次状态迁移都会「隔空」改写它已经拿到的数据——序列化给模型的任务清单
 * 会变成调用之后的样子，而渲染层缓存的快照会被后来的更新污染。
 */
function snapshot(task: TeamTask): TeamTask {
	return { ...task, blockedBy: [...task.blockedBy] };
}

export class TeamTaskBoard {
	private readonly boardsByLeader = new Map<string, Board>();
	private readonly clock: TeamTaskClock;

	constructor(clock: TeamTaskClock = defaultClock) {
		this.clock = clock;
	}

	/**
	 * 批量建任务。blockedBy 只能引用**已存在**的 id（本板已有 + 本批先前创建），
	 * 因此图天然无环；引用未来/不存在的 id 响亮报错（静默当无依赖会让任务
	 * 在依赖没做完时就开工，那正是依赖要防的事）。
	 */
	createTasks(leaderSessionId: string, inputs: readonly TeamTaskInput[]): readonly TeamTask[] {
		requireNonEmpty(leaderSessionId, "领导会话 id");
		if (inputs.length === 0) throw new Error("至少要有一个任务");
		const board = this.boardOf(leaderSessionId);
		const known = new Set(board.tasks.map((task) => task.id));
		const created: TeamTask[] = [];
		const now = this.clock.now();
		for (const input of inputs) {
			const title = requireNonEmpty(input.title, "任务标题");
			const blockedBy = input.blockedBy ?? [];
			for (const dep of blockedBy) {
				if (!known.has(dep)) {
					throw new Error(
						`任务「${title}」依赖的「${dep}」不存在：依赖只能指向已创建的任务（同批次里先写的可以）`,
					);
				}
			}
			const id = `t${board.nextSeq}`;
			board.nextSeq += 1;
			const task: TeamTask = {
				id,
				title,
				detail: input.detail ?? "",
				owner: input.owner === undefined ? undefined : requireNonEmpty(input.owner, "任务 owner"),
				blockedBy: [...blockedBy],
				// 无依赖 → 直接可开工；有依赖 → 等解锁。
				status: blockedBy.length === 0 ? "ready" : "pending",
				result: "",
				createdAt: now,
				updatedAt: now,
			};
			board.tasks.push(task);
			known.add(id);
			created.push(snapshot(task));
		}
		return created;
	}

	/** 改状态 / 指派 / 写结果。改成 completed 会触发下游解锁。未知 id → 响亮报错。 */
	updateTask(
		leaderSessionId: string,
		taskId: string,
		patch: { status?: TeamTaskStatus; owner?: string; result?: string },
	): TeamTask {
		const task = this.requireTask(leaderSessionId, taskId);
		if (patch.status !== undefined) task.status = patch.status;
		if (patch.owner !== undefined) task.owner = requireNonEmpty(patch.owner, "任务 owner");
		if (patch.result !== undefined) task.result = patch.result;
		task.updatedAt = this.clock.now();
		if (patch.status === "completed" || patch.status === "cancelled") this.refreshUnlocks(leaderSessionId);
		return snapshot(task);
	}

	/** 当前板的全部任务（创建序，快照）。 */
	listTasks(leaderSessionId: string): readonly TeamTask[] {
		return this.boardOf(leaderSessionId).tasks.map(snapshot);
	}

	/**
	 * 解锁扫描：pending 且依赖全部 completed → ready；
	 * 依赖里出现 cancelled（上游永远不会完成）→ 级联 cancelled。
	 * 反复扫到不动为止（一次操作可能连锁解锁多层下游）。
	 */
	private refreshUnlocks(leaderSessionId: string): void {
		const board = this.boardOf(leaderSessionId);
		const byId = new Map(board.tasks.map((task) => [task.id, task]));
		let changed = true;
		while (changed) {
			changed = false;
			for (const task of board.tasks) {
				if (task.status !== "pending") continue;
				const deps = task.blockedBy.map((id) => byId.get(id));
				if (deps.some((dep) => dep?.status === "cancelled")) {
					task.status = "cancelled";
					task.result = task.result === "" ? "上游任务已取消，本任务级联取消" : task.result;
					task.updatedAt = this.clock.now();
					changed = true;
					continue;
				}
				if (deps.every((dep) => dep?.status === "completed")) {
					task.status = "ready";
					task.updatedAt = this.clock.now();
					changed = true;
				}
			}
		}
	}

	/** 板内任务（取消后 id 不复用，故按数组查找即可）。 */
	private requireTask(leaderSessionId: string, taskId: string): TeamTask {
		const task = this.boardOf(leaderSessionId).tasks.find((candidate) => candidate.id === taskId);
		if (task === undefined) {
			const known = this.boardOf(leaderSessionId)
				.tasks.map((candidate) => candidate.id)
				.join("、");
			throw new Error(`任务「${taskId}」不存在（当前板上有：${known === "" ? "空" : known}）`);
		}
		return task;
	}

	/** 领导的板；首次访问即建空板（一个会话一张，与单会话单团队同构）。 */
	private boardOf(leaderSessionId: string): Board {
		requireNonEmpty(leaderSessionId, "领导会话 id");
		const existing = this.boardsByLeader.get(leaderSessionId);
		if (existing !== undefined) return existing;
		const board: Board = { tasks: [], nextSeq: 1 };
		this.boardsByLeader.set(leaderSessionId, board);
		return board;
	}

	/**
	 * 从落盘快照恢复任务板（spec: add-team-collaboration-parity 批次 ⑤）。
	 *
	 * nextSeq 取「已有 id 的最大序号 + 1」：直接用任务数会与历史 id 撞车
	 * （取消过的任务也占过号），撞车后 `team_task_update t3` 会改到另一条任务上 ——
	 * 静默改错对象比报错难查得多。
	 */
	restore(leaderSessionId: string, tasks: readonly TeamTask[]): void {
		requireNonEmpty(leaderSessionId, "领导会话 id");
		if (this.boardsByLeader.has(leaderSessionId)) return; // 已有板 → 不覆盖运行态
		const maxSeq = tasks.reduce((max, task) => {
			const seq = Number.parseInt(task.id.replace(/^t/, ""), 10);
			return Number.isNaN(seq) ? max : Math.max(max, seq);
		}, 0);
		this.boardsByLeader.set(leaderSessionId, {
			tasks: tasks.map((task) => ({ ...task, blockedBy: [...task.blockedBy] })),
			nextSeq: maxSeq + 1,
		});
	}

	/** 解散时清板（团队没了，任务板不该留着——重启恢复由批次 ⑤ 的落盘负责）。 */
	clear(leaderSessionId: string): void {
		this.boardsByLeader.delete(leaderSessionId);
	}
}
