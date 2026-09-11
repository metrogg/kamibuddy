/**
 * conversation_search 工具的测试。
 *
 * 检索实现（JSONL 扫描）在 daemon 侧另有测试，这里钉工具本体：
 *   - schema 边界（query 非空、limit 1-50 可选）—— pi 执行前按 schema 校验入参
 *     （pi-ai 的 validateToolArguments），边界全在 schema 层、直接测 schema；
 *   - 无命中时的引导文案（要指挥得动模型：换关键词 / 当前对话直接答）；
 *   - 命中时的结果格式（标题 / 日期 / 片段逐段排）与 details.hitCount；
 *   - searchSessions 收到的 query/limit 与模型入参一致（limit 缺省补 20）。
 */

import { describe, expect, it } from "vitest";
import { Compile } from "typebox/compile";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ConversationSearchHit } from "../shared/session-events.ts";
import { conversationSearchExtensionFactory } from "./conversation-search-tool.ts";

interface FakeToolResult {
	readonly content: ReadonlyArray<{ type: "text"; text: string }>;
	readonly details: { readonly hitCount?: number } | undefined;
}

interface FakeToolDef {
	readonly name: string;
	readonly label: string;
	readonly parameters: unknown;
	readonly execute: (
		toolCallId: string,
		params: Record<string, unknown>,
	) => Promise<FakeToolResult>;
}

/** 装好扩展，返回注册到的工具定义与 searchSessions 调用记录。 */
function mount(answer: readonly ConversationSearchHit[]): {
	readonly tool: FakeToolDef;
	readonly calls: Array<{ query: string; limit: number }>;
} {
	const calls: Array<{ query: string; limit: number }> = [];
	let tool: FakeToolDef | undefined;
	const fakePi = {
		registerTool: (def: FakeToolDef) => {
			tool = def;
		},
	} as unknown as ExtensionAPI;

	conversationSearchExtensionFactory({
		searchSessions: async (query, limit) => {
			calls.push({ query, limit });
			return answer;
		},
	})(fakePi);

	if (tool === undefined) throw new Error("conversation_search 工具没有注册");
	return { tool, calls };
}

const HIT: ConversationSearchHit = {
	sessionId: "s-1",
	title: "季度汇报模板",
	modifiedAt: new Date("2026-09-08T14:32:00").getTime(),
	snippet: "…上次定的季度汇报模板用三段式：结论先行、数据对比、下一步计划…",
};

describe("schema 边界（pi 执行前校验，工具不再重复校验）", () => {
	const { tool } = mount([]);
	const check = Compile(tool.parameters as Parameters<typeof Compile>[0]);

	it("合法入参通过：只给 query，或 query + 边界 limit", () => {
		expect(check.Check({ query: "季度汇报" })).toBe(true);
		expect(check.Check({ query: "季度汇报", limit: 1 })).toBe(true);
		expect(check.Check({ query: "季度汇报", limit: 50 })).toBe(true);
	});

	it("空 query / 缺 query 拒", () => {
		expect(check.Check({ query: "" })).toBe(false);
		expect(check.Check({})).toBe(false);
	});

	it("limit 越界或非整数拒（1-50）", () => {
		expect(check.Check({ query: "x", limit: 0 })).toBe(false);
		expect(check.Check({ query: "x", limit: 51 })).toBe(false);
		expect(check.Check({ query: "x", limit: 1.5 })).toBe(false);
	});
});

describe("注册形态", () => {
	it("工具名与面向用户的标题", () => {
		const { tool } = mount([]);
		expect(tool.name).toBe("conversation_search");
		expect(tool.label).toBe("检索历史会话");
	});
});

describe("检索调用", () => {
	it("searchSessions 收到的 query 与入参一致，limit 缺省补 20", async () => {
		const { tool, calls } = mount([]);
		await tool.execute("t1", { query: "季度汇报" });
		expect(calls).toEqual([{ query: "季度汇报", limit: 20 }]);
	});

	it("limit 入参透传", async () => {
		const { tool, calls } = mount([]);
		await tool.execute("t1", { query: "季度汇报", limit: 5 });
		expect(calls).toEqual([{ query: "季度汇报", limit: 5 }]);
	});
});

describe("结果形态", () => {
	it("无命中 → 引导文案（换关键词 / 当前对话直接答），hitCount 为 0", async () => {
		const { tool } = mount([]);
		const result = await tool.execute("t1", { query: "不存在的东西" });

		expect(result.content[0]?.text).toContain("没有找到");
		expect(result.content[0]?.text).toContain("关键词");
		expect(result.content[0]?.text).toContain("当前");
		expect(result.details?.hitCount).toBe(0);
	});

	it("命中 → 每会话一段（标题 / 日期 / 片段），hitCount 为命中数", async () => {
		const { tool } = mount([HIT]);
		const result = await tool.execute("t1", { query: "季度汇报" });

		const text = result.content[0]?.text ?? "";
		expect(text).toContain("季度汇报模板");
		expect(text).toContain("2026-09-08 14:32");
		expect(text).toContain("结论先行");
		expect(result.details?.hitCount).toBe(1);
	});
});
