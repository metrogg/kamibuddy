/**
 * read_document 工具扩展的胶水层测试。
 *
 * doc-extract.ts 已钉住各格式的提取与错误协议，这里测**接缝**（同 web-tools.test.ts）：
 *   - 工具注册时的 schema（名字、必填 path、可选 offset/limit）
 *   - 提取结果如何排成模型可读的文本（含空文档的说明）
 *   - DocExtractError → 模型可读 Error；其他异常原样上抛
 *   - 缺省实现与注入实现的分流（测试里只注入 fake，不做真实解析）
 */

import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DocExtractError } from "../core/doc-extract.ts";
import { createDocReadTool } from "./doc-read-tool.ts";

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
function mount(options: Parameters<typeof createDocReadTool>[0] = {}): { tools: Map<string, FakeToolDef> } {
	const tools = new Map<string, FakeToolDef>();
	const fakePi = {
		registerTool: (def: FakeToolDef) => {
			tools.set(def.name, def);
		},
	} as unknown as ExtensionAPI;
	createDocReadTool(options)(fakePi);
	return { tools };
}

describe("注册", () => {
	it("read_document 在场，schema 里 path 必填、offset/limit 可选", () => {
		const { tools } = mount();
		const tool = tools.get("read_document");
		expect(tool).toBeDefined();
		const schema = tool?.parameters as {
			properties?: Record<string, unknown>;
			required?: string[];
		};
		expect(schema.properties?.path).toBeDefined();
		expect(schema.properties?.offset).toBeDefined();
		expect(schema.properties?.limit).toBeDefined();
		expect(schema.required).toEqual(["path"]);
	});

	it("工具描述写明与 read 的分工和支持格式清单", () => {
		const { tools } = mount();
		const description = tools.get("read_document")?.description ?? "";
		expect(description).toContain("`read`");
		expect(description).toContain("pdf");
		expect(description).toContain("docx");
		expect(description).toContain("ods");
	});
});

describe("execute", () => {
	it("path / offset / limit 透传给提取层，结果排成文本并带 details", async () => {
		let received: [string, number | undefined, number | undefined] | undefined;
		const { tools } = mount({
			extract: async (path, offset, limit) => {
				received = [path, offset, limit];
				return {
					text: "--- 第 1 页 ---\n正文。",
					truncated: true,
					nextOffset: 2,
					totalPages: 10,
				};
			},
		});
		const result = await tools.get("read_document")?.execute!("t1", { path: "报表.pdf", offset: 1, limit: 5 });
		expect(received).toEqual(["报表.pdf", 1, 5]);
		expect(result?.content[0]?.text).toContain("正文。");
		expect(result?.details).toEqual({ truncated: true, nextOffset: 2, totalPages: 10 });
	});

	it("空文档给出明确说明，而不是空串（防模型误判提取失败反复重试）", async () => {
		const { tools } = mount({
			extract: async () => ({ text: "", truncated: false, nextOffset: undefined, totalPages: undefined }),
		});
		const result = await tools.get("read_document")?.execute!("t1", { path: "空.docx" });
		expect(result?.content[0]?.text).toContain("没有可提取的文本内容");
	});

	it("DocExtractError 转成模型可读的 Error（pi 视为工具失败回给模型）", async () => {
		const { tools } = mount({
			extract: async () => {
				throw new DocExtractError("scanned", "该 PDF 没有文本层（可能是扫描件），暂无法读取");
			},
		});
		await expect(tools.get("read_document")?.execute!("t1", { path: "扫描.pdf" })).rejects.toThrow("没有文本层");
	});

	it("提取层抛出的其他异常原样上抛，不包装", async () => {
		const boom = new Error("磁盘故障");
		const { tools } = mount({
			extract: async () => {
				throw boom;
			},
		});
		await expect(tools.get("read_document")?.execute!("t1", { path: "a.pdf" })).rejects.toBe(boom);
	});
});
