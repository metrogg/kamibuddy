/**
 * 联网工具扩展的胶水层测试。
 *
 * web-search.ts / web-fetch.ts 已钉住 HTTP 契约与安全校验，这里测**接缝**：
 *   - 两个工具注册时的 schema（名字、参数、提示词片段）
 *   - 未配置时给模型的中文引导消息
 *   - 结果如何排成模型可读的文本（外部内容标记必须带上）
 *   - 缺省实现与注入实现的分流（测试里只注入 fake，绝不联网）
 */

import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createWebTools } from "./web-tools.ts";

interface FakeToolDef {
	readonly name: string;
	readonly description: string;
	readonly parameters: unknown;
	readonly execute: (
		toolCallId: string,
		params: Record<string, unknown>,
	) => Promise<{ content: Array<{ type: "text"; text: string }>; details: unknown }>;
}

/** 装好扩展，返回按名称索引的工具定义表。 */
function mount(options: Parameters<typeof createWebTools>[0]): { tools: Map<string, FakeToolDef> } {
	const tools = new Map<string, FakeToolDef>();
	const fakePi = {
		registerTool: (def: FakeToolDef) => {
			tools.set(def.name, def);
		},
	} as unknown as ExtensionAPI;
	createWebTools(options)(fakePi);
	return { tools };
}

describe("注册", () => {
	it("web_search / web_fetch 都在场，schema 里有必填 query / url", () => {
		const { tools } = mount({ getSearchConfig: () => undefined });
		expect(tools.has("web_search")).toBe(true);
		expect(tools.has("web_fetch")).toBe(true);
		const search = tools.get("web_search");
		const fetch = tools.get("web_fetch");
		// schema 是 typebox 的 TSchema 对象：属性在 properties 里能取到。
		const searchSchema = search?.parameters as { properties?: Record<string, unknown> };
		const fetchSchema = fetch?.parameters as { properties?: Record<string, unknown> };
		expect(searchSchema.properties?.query).toBeDefined();
		expect(fetchSchema.properties?.url).toBeDefined();
	});
});

describe("web_search", () => {
	it("未配置时抛出引导性中文错误（pi 视为工具失败回给模型）", async () => {
		const { tools } = mount({ getSearchConfig: () => undefined });
		const execute = tools.get("web_search")?.execute;
		expect(execute).toBeDefined();
		await expect(execute!("t1", { query: "今天天气" })).rejects.toThrow("设置页「联网搜索」");
	});

	it("有配置时走注入的 search 实现，结果排成编号列表", async () => {
		const { tools } = mount({
			getSearchConfig: () => ({ providerId: "tavily", apiKey: "k" }),
			search: async (config, query) => {
				expect(config.apiKey).toBe("k");
				expect(query).toBe("股价");
				return [
					{ title: "标题一", url: "https://a.com", description: "摘要一", publishedAt: "2026-09-01" },
					{ title: "标题二", url: "https://b.com", description: "摘要二" },
				];
			},
		});
		const execute = tools.get("web_search")?.execute;
		const result = await execute!("t1", { query: "股价" });
		const text = result.content[0]?.text ?? "";
		expect(text).toContain("1. 标题一（https://a.com）");
		expect(text).toContain("摘要一");
		expect(text).toContain("发布时间：2026-09-01");
		expect(text).toContain("2. 标题二（https://b.com）");
		// details 带结构化结果数组（与文本同源）：给 UI 的「引用来源」用。
		expect(result.details).toEqual({
			count: 2,
			results: [
				{ title: "标题一", url: "https://a.com", description: "摘要一", publishedAt: "2026-09-01" },
				{ title: "标题二", url: "https://b.com", description: "摘要二" },
			],
		});
	});

	it("零结果返回换关键词提示，details.results 为空数组", async () => {
		const { tools } = mount({
			getSearchConfig: () => ({ providerId: "tavily", apiKey: "k" }),
			search: async () => [],
		});
		const result = await tools.get("web_search")?.execute!("t1", { query: "x" });
		expect(result?.content[0]?.text).toContain("换关键词");
		expect(result?.details).toEqual({ count: 0, results: [] });
	});

	it("搜索层抛错原样上抛（成为 isError）", async () => {
		const { tools } = mount({
			getSearchConfig: () => ({ providerId: "tavily", apiKey: "k" }),
			search: async () => {
				throw new Error("Tavily 的 API Key 无效或已过期");
			},
		});
		await expect(tools.get("web_search")?.execute!("t1", { query: "x" })).rejects.toThrow(
			"API Key 无效",
		);
	});
});

describe("web_fetch", () => {
	it("结果带不可信标记、来源与标题", async () => {
		let received = "";
		const { tools } = mount({
			getSearchConfig: () => undefined,
			fetchPage: async (url) => {
				received = url;
				return {
					title: "页面标题",
					url: "https://example.com/p",
					markdown: "正文内容。",
					truncated: false,
				};
			},
		});
		const result = await tools.get("web_fetch")?.execute!("t2", { url: "https://example.com/p" });
		expect(received).toBe("https://example.com/p");
		const text = result?.content[0]?.text ?? "";
		expect(text).toContain("【注意】"); // 外部内容不可信标记
		expect(text).toContain("来源：https://example.com/p");
		expect(text).toContain("标题：页面标题");
		expect(text).toContain("正文内容。");
	});

	it("抓取层抛错原样上抛", async () => {
		const { tools } = mount({
			getSearchConfig: () => undefined,
			fetchPage: async () => {
				throw new Error("未能从 example.com 提取到正文");
			},
		});
		await expect(tools.get("web_fetch")?.execute!("t2", { url: "https://e.com" })).rejects.toThrow(
			"提取到正文",
		);
	});
});
