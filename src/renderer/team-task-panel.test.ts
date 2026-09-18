/**
 * 任务面板纯函数测试（spec: add-team-ux-parity 批次 ③）。
 *
 * 面板本身是只读展示，易回归的是「分组顺序」与「哪些行该出现」——
 * 分组顺序直接决定用户先看到什么（能开工的必须排最前，否则面板就成了摆设）。
 */

import { describe, expect, it } from "vitest";
import type { TeamTaskView } from "@shared/ipc.ts";
import { groupTeamTasks, taskDependencyText } from "./team-task-panel.tsx";

function task(overrides: Partial<TeamTaskView> & { id: string }): TeamTaskView {
	return {
		title: "任务",
		detail: "",
		status: "ready",
		blockedBy: [],
		result: "",
		...overrides,
	};
}

describe("groupTeamTasks", () => {
	it("按「可开工 → 进行中 → 等上游 → 已完成 → 已取消」分组（能开工的排最前）", () => {
		const groups = groupTeamTasks([
			task({ id: "t1", status: "completed" }),
			task({ id: "t2", status: "pending" }),
			task({ id: "t3", status: "ready" }),
			task({ id: "t4", status: "in_progress" }),
			task({ id: "t5", status: "cancelled" }),
		]);
		expect(groups.map((group) => group.label)).toEqual(["可开工", "进行中", "等上游", "已完成", "已取消"]);
		expect(groups.map((group) => group.tasks.map((item) => item.id))).toEqual([["t3"], ["t4"], ["t2"], ["t1"], ["t5"]]);
	});

	it("空状态的组不出现（不渲染「已完成（0）」这种空标题）", () => {
		const groups = groupTeamTasks([task({ id: "t1", status: "ready" })]);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.label).toBe("可开工");
	});

	it("未知状态的任务被静默丢弃（多半是我们加了新状态没同步这里，靠测试提醒）", () => {
		const groups = groupTeamTasks([task({ id: "t1", status: "brand_new" })]);
		expect(groups).toEqual([]);
	});

	it("空板 → 空分组（调用方据此显示空态文案）", () => {
		expect(groupTeamTasks([])).toEqual([]);
	});
});

describe("taskDependencyText", () => {
	it("有依赖 → 列出 id；无依赖 → 空串（不显示「依赖 无」）", () => {
		expect(taskDependencyText(task({ id: "t1", blockedBy: ["t2", "t3"] }))).toBe("依赖 t2 · t3");
		expect(taskDependencyText(task({ id: "t1" }))).toBe("");
	});
});
