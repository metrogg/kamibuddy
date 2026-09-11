import { describe, expect, it } from "vitest";
import type { ConversationEntry, TodoItem, ToolCard } from "@shared/session-events.ts";
import { projectTodoList, windowTodos } from "./todo-projection.ts";

function todoCard(id: string, over: Partial<ToolCard> = {}): ToolCard {
	return {
		id,
		role: "tool",
		toolName: "todo_write",
		label: "任务列表",
		summary: "",
		outcome: "ok",
		detail: undefined,
		at: 1000,
		...over,
	};
}

function userEntry(id: string): ConversationEntry {
	return { id, role: "user", text: `消息 ${id}`, at: 1 };
}

function assistantEntry(id: string): ConversationEntry {
	return { id, role: "assistant", text: `回复 ${id}`, at: 2 };
}

const TODOS_A: readonly TodoItem[] = [
	{ content: "第一步", status: "completed" },
	{ content: "第二步", status: "in_progress", activeForm: "正在第二步" },
	{ content: "第三步", status: "pending" },
];

const TODOS_B: readonly TodoItem[] = [
	{ content: "第一步", status: "completed" },
	{ content: "第二步", status: "completed" },
];

describe("projectTodoList：无 todo_write 卡", () => {
	it("原样返回同一数组引用（零开销）", () => {
		const entries: ConversationEntry[] = [userEntry("u1"), assistantEntry("a1")];
		expect(projectTodoList(entries)).toBe(entries);
	});

	it("有其他工具卡时同样返回同一引用", () => {
		const entries: ConversationEntry[] = [
			userEntry("u1"),
			todoCard("t1", { toolName: "read", label: "已读取", summary: "a.ts" }),
		];
		expect(projectTodoList(entries)).toBe(entries);
	});
});

describe("projectTodoList：折叠语义", () => {
	it("单次调用：折叠为一张，内容不变（可以是新数组）", () => {
		const card = todoCard("t1", { todos: TODOS_A });
		const result = projectTodoList([userEntry("u1"), card]);
		expect(result).toHaveLength(2);
		// 生成标记被显式归一（覆盖语义），其余字段原样保留
		expect(result[1]).toEqual({ ...card, generating: false });
	});

	it("多次调用折叠成一张：todos 取最新全量，位置钉在首次出现处", () => {
		const first = todoCard("t1", { todos: TODOS_A, at: 10 });
		const second = todoCard("t2", { todos: TODOS_B, at: 20 });
		const third = todoCard("t3", { todos: [], at: 30 });
		const assistant = assistantEntry("a1");
		const result = projectTodoList([userEntry("u1"), first, assistant, second, third]);
		expect(result).toHaveLength(3);
		const synthetic = result[1];
		expect(synthetic).toMatchObject({ id: "t1", at: 10, role: "tool", toolName: "todo_write" });
		// 最新一次是空清单（收尾清空语义），空数组也是有效的全量
		expect(synthetic).toMatchObject({ todos: [] });
		expect(result[2]).toBe(assistant);
	});

	it("脏卡（todos 缺席的终态卡）不参与内容竞争", () => {
		const good = todoCard("t1", { todos: TODOS_A });
		const dirty = todoCard("t2", { outcome: "error" });
		const result = projectTodoList([good, dirty]);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ id: "t1", todos: TODOS_A, generating: false });
	});

	it("生成中卡收尾：generating 保留，todos 继承最近终态卡", () => {
		const terminal = todoCard("t1", { todos: TODOS_A });
		const streaming = todoCard("t2", { outcome: undefined, generating: true });
		const result = projectTodoList([userEntry("u1"), terminal, streaming]);
		expect(result).toHaveLength(2);
		expect(result[1]).toMatchObject({ id: "t1", todos: TODOS_A, generating: true });
	});

	it("仅有生成中卡：todos 缺席，generating 保留（渲染层显示「接收中…」）", () => {
		const streaming = todoCard("t1", { outcome: undefined, generating: true });
		const result = projectTodoList([streaming]);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(streaming);
	});

	it("非 todo 卡不受影响（引用原样保留）", () => {
		const user = userEntry("u1");
		const assistant = assistantEntry("a1");
		const readCard = todoCard("r1", { toolName: "read", label: "已读取" });
		const result = projectTodoList([user, todoCard("t1", { todos: TODOS_A }), assistant, readCard]);
		expect(result[0]).toBe(user);
		expect(result[2]).toBe(assistant);
		expect(result[3]).toBe(readCard);
	});

	it("不修改入参", () => {
		const card = todoCard("t1", { todos: TODOS_A });
		const entries: ConversationEntry[] = [card, todoCard("t2", { todos: TODOS_B })];
		projectTodoList(entries);
		expect(entries).toHaveLength(2);
		expect(entries[0]).toBe(card);
	});
});

describe("windowTodos：窗口化锚定", () => {
	const make = (statuses: readonly TodoItem["status"][]): readonly TodoItem[] =>
		statuses.map((status, i) => ({ content: `任务 ${i + 1}`, status }));

	it("不足 5 条原样返回（同一引用）", () => {
		const todos = make(["completed", "in_progress", "pending"]);
		expect(windowTodos(todos)).toBe(todos);
	});

	it("恰好 5 条原样返回", () => {
		const todos = make(["completed", "completed", "in_progress", "pending", "pending"]);
		expect(windowTodos(todos)).toBe(todos);
	});

	it("9 项锚定第 6 项 in_progress：窗口以锚居中", () => {
		const todos = make([
			"completed", "completed", "completed", "completed", "completed",
			"in_progress", "pending", "pending", "pending",
		]);
		const windowed = windowTodos(todos);
		expect(windowed).toHaveLength(5);
		expect(windowed.map((t) => t.content)).toEqual(["任务 4", "任务 5", "任务 6", "任务 7", "任务 8"]);
	});

	it("锚在头部/尾部时窗口贴边", () => {
		const headAnchor = make(["in_progress", "pending", "pending", "pending", "pending", "pending", "pending"]);
		expect(windowTodos(headAnchor)[0]?.content).toBe("任务 1");
		const tailAnchor = make(["pending", "pending", "pending", "pending", "pending", "pending", "in_progress"]);
		expect(windowTodos(tailAnchor).at(-1)?.content).toBe("任务 7");
	});

	it("无 in_progress：以最后一个 completed 为锚", () => {
		const todos = make(["completed", "completed", "pending", "pending", "pending", "pending", "pending"]);
		const windowed = windowTodos(todos);
		expect(windowed[0]?.content).toBe("任务 1");
		expect(windowed).toHaveLength(5);
	});

	it("全是 pending：显示前 5 条", () => {
		const todos = make(["pending", "pending", "pending", "pending", "pending", "pending", "pending"]);
		expect(windowTodos(todos).map((t) => t.content)).toEqual(["任务 1", "任务 2", "任务 3", "任务 4", "任务 5"]);
	});
});
