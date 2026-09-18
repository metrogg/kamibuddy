/**
 * 团队任务板纯逻辑测试（spec: add-team-collaboration-parity 批次 ①）。
 *
 * 重点压在两条最容易写错的规则上：**依赖只能指向已存在的任务**
 * （否则任务会在依赖没做完时开工）与**自动解锁/级联取消**
 * （漏了它，主理人会反复追问「为什么还不开工」）。
 */

import { describe, expect, it } from "vitest";
import { TeamTaskBoard, type TeamTask, type TeamTaskStatus } from "./team-tasks.ts";

/** 可推进的假时钟：每调一次 now() 都把时间 +1，断言 updatedAt 变化用。 */
function tickingClock(start = 1000) {
	let current = start;
	return { now: () => (current += 1) };
}

function makeBoard() {
	return new TeamTaskBoard(tickingClock());
}

function errorMessage(fn: () => unknown): string {
	try {
		fn();
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
	throw new Error("期望抛错，但没有抛");
}

describe("建任务与初始状态", () => {
	it("无依赖 → ready（立即可开工）；有依赖 → pending（等解锁）", () => {
		const board = makeBoard();
		const [first, second] = board.createTasks("lead", [
			{ title: "调研" },
			{ title: "写作", blockedBy: ["t1"] },
		]);
		expect(first?.status).toBe("ready");
		expect(second?.status).toBe("pending");
	});

	it("id 按创建序分配，跨批次连续（t1、t2、t3…）", () => {
		const board = makeBoard();
		board.createTasks("lead", [{ title: "A" }]);
		const created = board.createTasks("lead", [{ title: "B" }, { title: "C" }]);
		expect(created.map((task) => task.id)).toEqual(["t2", "t3"]);
	});

	it("同批次里可依赖先前创建的任务（顺序即依赖方向）", () => {
		const board = makeBoard();
		const created = board.createTasks("lead", [
			{ title: "A" },
			{ title: "B", blockedBy: ["t1"] },
		]);
		expect(created[1]?.status).toBe("pending");
		expect(created[1]?.blockedBy).toEqual(["t1"]);
	});

	it("带 owner 与 detail 建任务", () => {
		const board = makeBoard();
		const [task] = board.createTasks("lead", [{ title: "调研", detail: "查 5 个来源", owner: "谭溯源" }]);
		expect(task).toMatchObject({ detail: "查 5 个来源", owner: "谭溯源" });
	});
});

describe("依赖校验（响亮失败）", () => {
	it("依赖不存在的 id → 抛错（静默当无依赖会让任务提前开工）", () => {
		const board = makeBoard();
		expect(errorMessage(() => board.createTasks("lead", [{ title: "写作", blockedBy: ["t9"] }]))).toContain(
			"依赖的「t9」不存在",
		);
	});

	it("依赖**未来**的同批次任务 → 抛错（依赖只能向后看）", () => {
		const board = makeBoard();
		expect(errorMessage(() =>
			board.createTasks("lead", [
				{ title: "A", blockedBy: ["t2"] },
				{ title: "B" },
			]),
		)).toContain("依赖的「t2」不存在");
	});

	it("空标题 / 空批次 / 空 leader → 抛错", () => {
		const board = makeBoard();
		expect(errorMessage(() => board.createTasks("lead", [{ title: "" }]))).toContain("任务标题");
		expect(errorMessage(() => board.createTasks("lead", []))).toContain("至少要有一个任务");
		expect(errorMessage(() => board.createTasks("", [{ title: "A" }]))).toContain("领导会话 id");
	});
});

describe("自动解锁与级联取消", () => {
	it("完成上游 → 下游翻 ready", () => {
		const board = makeBoard();
		board.createTasks("lead", [{ title: "调研" }, { title: "写作", blockedBy: ["t1"] }]);
		board.updateTask("lead", "t1", { status: "completed", result: "调研完成" });
		expect(board.listTasks("lead")[1]?.status).toBe("ready");
	});

	it("多级链：一次完成解锁整条链（连锁扫描到底）", () => {
		const board = makeBoard();
		board.createTasks("lead", [
			{ title: "A" },
			{ title: "B", blockedBy: ["t1"] },
			{ title: "C", blockedBy: ["t2"] },
		]);
		board.updateTask("lead", "t1", { status: "completed" });
		board.updateTask("lead", "t2", { status: "completed" });
		expect(board.listTasks("lead").map((task) => task.status)).toEqual(["completed", "completed", "ready"]);
	});

	it("依赖未全完成 → 不提前解锁（多依赖场景）", () => {
		const board = makeBoard();
		board.createTasks("lead", [
			{ title: "A" },
			{ title: "B" },
			{ title: "C", blockedBy: ["t1", "t2"] },
		]);
		board.updateTask("lead", "t1", { status: "completed" });
		expect(board.listTasks("lead")[2]?.status).toBe("pending");
		board.updateTask("lead", "t2", { status: "completed" });
		expect(board.listTasks("lead")[2]?.status).toBe("ready");
	});

	it("上游取消 → 下游级联取消并留下原因（不无限等一个永远不会完成的任务）", () => {
		const board = makeBoard();
		board.createTasks("lead", [{ title: "A" }, { title: "B", blockedBy: ["t1"] }]);
		board.updateTask("lead", "t1", { status: "cancelled" });
		const downstream = board.listTasks("lead")[1];
		expect(downstream?.status).toBe("cancelled");
		expect(downstream?.result).toContain("级联取消");
	});

	it("已开工的任务不受上游完成影响（状态不被扫描改写）", () => {
		const board = makeBoard();
		board.createTasks("lead", [{ title: "A" }, { title: "B", blockedBy: ["t1"] }]);
		board.updateTask("lead", "t2", { status: "in_progress", owner: "许清楚" });
		board.updateTask("lead", "t1", { status: "completed" });
		expect(board.listTasks("lead")[1]?.status).toBe("in_progress");
	});
});

describe("改任务", () => {
	it("指派 owner 与写结果", () => {
		const board = makeBoard();
		board.createTasks("lead", [{ title: "A" }]);
		const task = board.updateTask("lead", "t1", { status: "in_progress", owner: "闻问全", result: "进行中" });
		expect(task).toMatchObject({ status: "in_progress", owner: "闻问全", result: "进行中" });
	});

	it("未知 id → 抛错并列出板上现有 id", () => {
		const board = makeBoard();
		board.createTasks("lead", [{ title: "A" }]);
		expect(errorMessage(() => board.updateTask("lead", "t7", { status: "completed" }))).toContain("当前板上有：t1");
	});

	it("updatedAt 随更新推进（时钟注入）", () => {
		const board = makeBoard();
		const [created] = board.createTasks("lead", [{ title: "A" }]);
		const updated = board.updateTask("lead", "t1", { status: "in_progress" });
		expect(updated.updatedAt).toBeGreaterThan(created?.updatedAt ?? 0);
	});
});

describe("板隔离与清理", () => {
	it("两个领导各有一张板，互不可见", () => {
		const board = makeBoard();
		board.createTasks("lead-a", [{ title: "A" }]);
		expect(board.listTasks("lead-b")).toEqual([]);
		expect(board.listTasks("lead-a")).toHaveLength(1);
	});

	it("clear 后重新建从 t1 开始（id 不复用旧板）", () => {
		const board = makeBoard();
		board.createTasks("lead", [{ title: "A" }, { title: "B" }]);
		board.clear("lead");
		expect(board.listTasks("lead")).toEqual([]);
		const [fresh] = board.createTasks("lead", [{ title: "C" }]);
		expect(fresh?.id).toBe("t1");
	});
});

describe("从落盘恢复（spec: add-team-collaboration-parity 批次 ⑤）", () => {
	const task = (id: string, status: TeamTaskStatus, blockedBy: readonly string[] = []): TeamTask => ({
		id, title: id, detail: "", owner: undefined, blockedBy: [...blockedBy], status, result: "", createdAt: 0, updatedAt: 0,
	});

	it("恢复后任务与状态原样可见", () => {
		const board = makeBoard();
		board.restore("lead", [task("t1", "completed"), task("t2", "ready")]);
		expect(board.listTasks("lead").map((t) => t.status)).toEqual(["completed", "ready"]);
	});

	it("新任务 id 不复用历史号（撞车会静默改错对象）", () => {
		const board = makeBoard();
		board.restore("lead", [task("t1", "completed"), task("t5", "cancelled")]);
		const [next] = board.createTasks("lead", [{ title: "新活" }]);
		expect(next?.id).toBe("t6");
	});

	it("已有板时不覆盖运行态", () => {
		const board = makeBoard();
		board.createTasks("lead", [{ title: "运行中的活" }]);
		board.restore("lead", [task("t9", "ready")]);
		expect(board.listTasks("lead").map((t) => t.id)).toEqual(["t1"]);
	});
});
