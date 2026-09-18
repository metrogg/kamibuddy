/**
 * 团队任务板三工具测试（spec: add-team-collaboration-parity 批次 ①）。
 *
 * 执行本体（任务板状态机）在 daemon/team-tasks.ts 且已单独测过；这里用内存 stub
 * 钉**工具编排与回传契约**：开关门、参数转述、清单渲染分组、错误透传。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import type { TeamTask, TeamTaskInput, TeamTaskStatus } from "../core/team-tasks.ts";
import { teamTaskExtensionFactory, type TeamTaskToolDeps } from "./team-task-tools.ts";

interface FakeToolResult {
	readonly content: ReadonlyArray<{ type: "text"; text: string }>;
	readonly details: object;
}

interface FakeToolDef {
	readonly name: string;
	execute: (toolCallId: string, params: Record<string, unknown>) => Promise<FakeToolResult>;
}

/** 内存 stub 板：只做最小状态迁移，够驱动工具的渲染与转述。 */
function stubBoard() {
	const tasks: TeamTask[] = [];
	let seq = 1;
	const create = (inputs: readonly TeamTaskInput[]): readonly TeamTask[] => {
		const created = inputs.map((input) => {
			const task: TeamTask = {
				id: `t${seq}`,
				title: input.title,
				detail: input.detail ?? "",
				owner: input.owner,
				blockedBy: [...(input.blockedBy ?? [])],
				status: (input.blockedBy ?? []).length > 0 ? "pending" : "ready",
				result: "",
				createdAt: 0,
				updatedAt: 0,
			};
			seq += 1;
			tasks.push(task);
			return task;
		});
		return created;
	};
	const update = (id: string, patch: { status?: TeamTaskStatus; owner?: string; result?: string }): TeamTask => {
		const task = tasks.find((candidate) => candidate.id === id);
		if (task === undefined) throw new Error(`任务「${id}」不存在（当前板上有：t1）`);
		if (patch.status !== undefined) task.status = patch.status;
		if (patch.owner !== undefined) task.owner = patch.owner;
		if (patch.result !== undefined) task.result = patch.result;
		return { ...task, blockedBy: [...task.blockedBy] };
	};
	return { create, update, list: () => tasks.map((task) => ({ ...task, blockedBy: [...task.blockedBy] })) };
}

function mount(deps: Partial<TeamTaskToolDeps> = {}): Map<string, FakeToolDef> {
	const tools = new Map<string, FakeToolDef>();
	const fakePi = {
		registerTool: (def: { name: string }) => {
			tools.set(def.name, def as unknown as FakeToolDef);
		},
	} as unknown as ExtensionAPI;
	const board = stubBoard();
	teamTaskExtensionFactory({
		isEnabled: () => true,
		createTasks: board.create,
		updateTask: board.update,
		listTasks: board.list,
		...deps,
	})(fakePi);
	return tools;
}

/** 取工具结果文本（content 只有一段 text）。 */
async function text(tool: FakeToolDef, params: Record<string, unknown> = {}): Promise<string> {
	const result = await tool.execute("call-1", params);
	return result.content.map((part) => part.text).join("");
}

describe("开关门与注册", () => {
	it("isEnabled=false → 一个工具都不注册", () => {
		expect(mount({ isEnabled: () => false }).size).toBe(0);
	});

	it("启用 → 注册三件套", () => {
		expect([...mount().keys()].sort()).toEqual(["team_task_create", "team_task_list", "team_task_update"]);
	});
});

describe("team_task_create", () => {
	it("建任务并回传 id、状态与整板清单", async () => {
		const tool = mount().get("team_task_create");
		expect(tool).toBeDefined();
		const out = await text(tool as FakeToolDef, {
			tasks: [
				{ title: "调研" },
				{ title: "写作", blockedBy: ["t1"], owner: "谭溯源", detail: "基于调研写 1500 字" },
			],
		});
		expect(out).toContain("已建 2 条任务");
		expect(out).toContain("[t1] 调研");
		expect(out).toContain("[t2] 写作");
		// 分组渲染：无依赖的 ready、有依赖的 pending 各自成组
		expect(out).toContain("## ready（1）");
		expect(out).toContain("## pending（1）");
		expect(out).toContain("依赖：t1(ready)");
	});

	it("板的报错原样透传（依赖不存在 / 空批次）", async () => {
		const failing = mount({
			createTasks: () => {
				throw new Error("任务「写作」依赖的「t9」不存在");
			},
		});
		await expect(text(failing.get("team_task_create") as FakeToolDef, { tasks: [{ title: "写作" }] })).rejects.toThrow(
			/依赖的「t9」不存在/,
		);
	});
});

describe("team_task_update", () => {
	it("改状态后回传新状态与整板", async () => {
		const tools = mount();
		await text(tools.get("team_task_create") as FakeToolDef, { tasks: [{ title: "调研" }] });
		const out = await text(tools.get("team_task_update") as FakeToolDef, {
			id: "t1",
			status: "completed",
			result: "找到 6 个来源",
		});
		expect(out).toContain("[t1] 调研 → completed");
		expect(out).toContain("## completed（1）");
		expect(out).toContain("结果：找到 6 个来源");
	});

	it("未知 id 的报错原样透传", async () => {
		const tools = mount();
		await expect(text(tools.get("team_task_update") as FakeToolDef, { id: "t7", status: "completed" })).rejects.toThrow(
			/任务「t7」不存在/,
		);
	});
});

describe("team_task_list", () => {
	it("空板给可操作的空态文案", async () => {
		expect(await text(mount().get("team_task_list") as FakeToolDef)).toContain("任务板是空的");
	});

	it("有任务时按状态分组（ready 组在最前，模型先看到能开工的）", async () => {
		const tools = mount();
		await text(tools.get("team_task_create") as FakeToolDef, { tasks: [{ title: "A" }, { title: "B", blockedBy: ["t1"] }] });
		const out = await text(tools.get("team_task_list") as FakeToolDef);
		expect(out.indexOf("## ready")).toBeLessThan(out.indexOf("## pending"));
	});
});
