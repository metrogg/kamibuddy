/**
 * todo_write 工具的测试。
 *
 * 装配（daemon）与渲染（renderer 聚合投影、清单卡）各有归属，这里钉工具本体：
 *   - schema 边界（0-50 项、content 非空、status 三态）—— pi 执行前按 schema
 *     校验入参（pi-ai 的 validateToolArguments），边界全在 schema 层、直接测 schema；
 *   - 确认文本：完成/总计数、进行中项 content、空清单收尾文案、
 *     无 in_progress 时省略「进行中」段；
 *   - details.todos 原样携带入参（UI 结构化消费的契约）。
 */

import { describe, expect, it } from "vitest";
import { Compile } from "typebox/compile";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { todoExtensionFactory, type TodoItem } from "./todo-tool.ts";

interface FakeToolResult {
	readonly content: ReadonlyArray<{ type: "text"; text: string }>;
	readonly details: { readonly todos: readonly TodoItem[] };
}

interface FakeToolDef {
	readonly name: string;
	readonly label: string;
	readonly parameters: unknown;
	readonly execute: (toolCallId: string, params: Record<string, unknown>) => Promise<FakeToolResult>;
}

/** 装好扩展，返回注册到的 todo_write 工具定义。 */
function mount(): { tool: FakeToolDef } {
	let tool: FakeToolDef | undefined;
	const fakePi = {
		registerTool: (def: FakeToolDef) => {
			tool = def;
		},
	} as unknown as ExtensionAPI;

	todoExtensionFactory()(fakePi);

	if (tool === undefined) throw new Error("todo_write 工具没有注册");
	return { tool };
}

/** 5 项混合状态（completed×2、in_progress×1、pending×2）的合法入参。 */
function fiveTodos(): Record<string, unknown> {
	return {
		todos: [
			{ content: "读需求文档", status: "completed" },
			{ content: "写实现", status: "completed" },
			{ content: "写测试", activeForm: "正在写测试", status: "in_progress" },
			{ content: "跑测试", status: "pending" },
			{ content: "提交改动", status: "pending" },
		],
	};
}

describe("schema 边界（pi 执行前校验，工具不再重复校验）", () => {
	const { tool } = mount();
	// parameters 是 typebox 的 TSchema 对象，Compile 后即 JSON Schema 校验器。
	const check = Compile(tool.parameters as Parameters<typeof Compile>[0]);

	it("合法入参通过：混合三态、activeForm 可省", () => {
		expect(check.Check(fiveTodos())).toBe(true);
	});

	it("空数组通过（收尾语义，不是入参错误）", () => {
		expect(check.Check({ todos: [] })).toBe(true);
	});

	it("51 项拒（上限 50）", () => {
		const fiftyOne = Array.from({ length: 51 }, (_, i) => ({
			content: `任务 ${i + 1}`,
			status: "pending",
		}));
		expect(check.Check({ todos: fiftyOne })).toBe(false);
	});

	it("content 空串、status 越界或缺失、activeForm 空串都拒", () => {
		expect(check.Check({ todos: [{ content: "", status: "pending" }] })).toBe(false);
		expect(check.Check({ todos: [{ content: "做甲", status: "doing" }] })).toBe(false);
		expect(check.Check({ todos: [{ content: "做甲" }] })).toBe(false);
		expect(
			check.Check({ todos: [{ content: "做甲", activeForm: "", status: "in_progress" }] }),
		).toBe(false);
	});
});

describe("注册形态", () => {
	it("工具名与面向用户的标题", () => {
		const { tool } = mount();
		expect(tool.name).toBe("todo_write");
		expect(tool.label).toBe("任务列表");
	});
});

describe("确认文本与 details", () => {
	it("5 项混合状态：计数正确、含进行中项 content，details.todos 原样返回", async () => {
		const { tool } = mount();
		const params = fiveTodos();
		const result = await tool.execute("t1", params);

		expect(result.content[0]?.text).toBe("待办清单已更新：2 项已完成 / 共 5 项（进行中：写测试）。");
		expect(result.details.todos).toEqual(params.todos);
	});

	it("空数组：返回已清空文案，details.todos 为空", async () => {
		const { tool } = mount();
		const result = await tool.execute("t1", { todos: [] });

		expect(result.content[0]?.text).toBe("待办清单已清空。");
		expect(result.details.todos).toEqual([]);
	});

	it("无 in_progress：文本不含「进行中」段", async () => {
		const { tool } = mount();
		const result = await tool.execute("t1", {
			todos: [
				{ content: "做甲", status: "completed" },
				{ content: "做乙", status: "pending" },
				{ content: "做丙", status: "pending" },
			],
		});

		expect(result.content[0]?.text).toBe("待办清单已更新：1 项已完成 / 共 3 项。");
		expect(result.content[0]?.text).not.toContain("进行中");
	});

	it("确认文本不复述清单内容（清单已在 UI 可见，复述是重复 token）", async () => {
		const { tool } = mount();
		const result = await tool.execute("t1", fiveTodos());

		expect(result.content[0]?.text).not.toContain("读需求文档");
		expect(result.content[0]?.text).not.toContain("提交改动");
	});
});
