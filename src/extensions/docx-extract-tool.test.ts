/**
 * docx_extract 工具的胶水层测试。
 *
 * CLI 契约与错误分类已在 documents/ 层钉住，这里测**接缝**：
 *   - 工具注册（名字必须与 craft.md 白名单一字不差、参数 schema 与必填形状）
 *   - 描述里必须写清与 read_document 的分工、以及不承诺 1:1 还原
 *   - 先 ensure 后 extract 的顺序与失败短路
 *   - 成功时 warnings / not_restorable 都必须进工具返回文本（不许吞）
 *   - 失败时原因与引擎已发出的警告如何变成模型可读的抛错
 */

import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DocxExtractError } from "../documents/docx-extract.ts";
import { createDocxExtractTool, type DocxExtractToolOptions } from "./docx-extract-tool.ts";

const HOME = resolve(sep, "users", "foo");
const ENGINE = resolve(sep, "app", "resources", "docx-engine");
const VENV_PY = join(HOME, ".venv-html-to-docx", "Scripts", "python.exe");

interface FakeToolDef {
	readonly name: string;
	readonly label: string;
	readonly description: string;
	readonly promptSnippet: string;
	readonly promptGuidelines: string[];
	readonly parameters: unknown;
	readonly execute: (
		toolCallId: string,
		params: Record<string, unknown>,
	) => Promise<{ content: Array<{ type: "text"; text: string }>; details: unknown }>;
}

function mount(options: Partial<DocxExtractToolOptions> = {}): { tools: Map<string, FakeToolDef> } {
	const tools = new Map<string, FakeToolDef>();
	const fakePi = {
		registerTool: (def: FakeToolDef) => {
			tools.set(def.name, def);
		},
	} as unknown as ExtensionAPI;
	createDocxExtractTool({ engineDir: ENGINE, homeDir: HOME, platform: "win32", ...options })(fakePi);
	return { tools };
}

const READY_ENV = { status: "ready" as const, python: VENV_PY, venvDir: join(HOME, ".venv-html-to-docx") };

const SUCCESS = {
	htmlPath: join("ws", "out", "doc.html"),
	assetsDir: join("ws", "out", "doc_assets"),
	images: [
		{
			src: "doc_assets/images/image1.png",
			file: join("ws", "out", "doc_assets", "images", "image1.png"),
			source: "word/media/image1.png",
		},
	],
	warnings: ["图片格式 .emf 浏览器不能直接显示"],
	notRestorable: ["页眉页脚", "页码"],
};

describe("注册", () => {
	it("docx_extract 在场，docxPath / outputPath 为必填参数、assetsDir 可选", () => {
		const { tools } = mount();
		const tool = tools.get("docx_extract");
		expect(tool).toBeDefined();
		const schema = tool?.parameters as {
			properties?: Record<string, unknown>;
			required?: string[];
		};
		expect(schema.properties?.["docxPath"]).toBeDefined();
		expect(schema.properties?.["outputPath"]).toBeDefined();
		expect(schema.properties?.["assetsDir"]).toBeDefined();
		expect(schema.required).toContain("docxPath");
		expect(schema.required).toContain("outputPath");
		expect(schema.required).not.toContain("assetsDir");
	});

	it("描述讲清与 read_document 的分工，并在 prompt 约束里写明不承诺 1:1 还原", () => {
		const { tools } = mount();
		const tool = tools.get("docx_extract");
		expect(tool?.label).toBe("提取文档版式");
		expect(tool?.description).toContain("read_document");
		expect(tool?.description).toContain("not_restorable");
		expect(tool?.promptGuidelines.join("\n")).toContain("1:1");
		expect(tool?.promptGuidelines.join("\n")).toContain("不要反复重试");
	});
});

describe("执行", () => {
	it("先 ensure 后 extract；成功返回 HTML/图片目录，且 warnings 与 not_restorable 进文本", async () => {
		const order: string[] = [];
		const { tools } = mount({
			ensure: () => {
				order.push("ensure");
				return Promise.resolve(READY_ENV);
			},
			extract: (req) => {
				order.push("extract");
				expect(req.python).toBe(VENV_PY);
				expect(req.engineDir).toBe(ENGINE);
				expect(req.docxPath).toBe(join("ws", "原文.docx"));
				expect(req.outputPath).toBe(join("ws", "out", "doc.html"));
				expect(req.assetsDir).toBeUndefined();
				return Promise.resolve(SUCCESS);
			},
		});
		const execute = tools.get("docx_extract")?.execute;
		const result = await execute!("t1", {
			docxPath: join("ws", "原文.docx"),
			outputPath: join("ws", "out", "doc.html"),
		});

		expect(order).toEqual(["ensure", "extract"]);
		const text = result.content[0]?.text ?? "";
		expect(text).toContain("doc.html");
		expect(text).toContain("doc_assets/images/image1.png");
		// 不许吞：引擎的警告与不可复原项都要让模型看得到
		expect(text).toContain(".emf");
		expect(text).toContain("页眉页脚");
		expect(text).toContain("页码");
	});

	it("assetsDir 给出时原样传给 documents 层", async () => {
		const { tools } = mount({
			ensure: () => Promise.resolve(READY_ENV),
			extract: (req) => {
				expect(req.assetsDir).toBe(join("ws", "pics"));
				return Promise.resolve(SUCCESS);
			},
		});
		const execute = tools.get("docx_extract")?.execute;
		await execute!("t1", {
			docxPath: join("ws", "原文.docx"),
			outputPath: join("ws", "out", "doc.html"),
			assetsDir: join("ws", "pics"),
		});
	});

	it("ensure 失败 → 抛 env-not-ready 文案，不发起 extract；并写一条运行时审计", async () => {
		let extractCalled = false;
		// 运行时失败要进审计中心（spec: add-managed-runtimes 阶段 4）：注入观测点，
		// 钉「环境未就绪时确实留痕」，且详情带相位与错误（否则事后查不出为什么）。
		const records: Array<{ category: string; outcome: string; detail: string }> = [];
		const { tools } = mount({
			ensure: () =>
				Promise.resolve({
					status: "failed" as const,
					phase: "probe-uv" as const,
					error: "未找到 uv",
				}),
			extract: () => {
				extractCalled = true;
				return Promise.resolve(SUCCESS);
			},
			onAudit: (record) => records.push(record),
		});
		const execute = tools.get("docx_extract")?.execute;

		await expect(
			execute!("t1", { docxPath: join("ws", "a.docx"), outputPath: join("ws", "a.html") }),
		).rejects.toThrow("未找到 uv");
		expect(extractCalled).toBe(false);
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({ category: "runtime", outcome: "failed" });
		expect(records[0]?.detail).toContain("probe-uv");
		expect(records[0]?.detail).toContain("未找到 uv");
	});

	it("提取失败带引擎警告 → 抛错文案同时含原因与警告（不静默丢）", async () => {
		const { tools } = mount({
			ensure: () => Promise.resolve(READY_ENV),
			extract: () =>
				Promise.reject(
					new DocxExtractError("input-invalid", "docx 提取失败（输入不可用）：不是 zip 容器", [
						"已读取 3 个段落",
					]),
				),
		});
		const execute = tools.get("docx_extract")?.execute;

		const error = await execute!("t1", {
			docxPath: join("ws", "a.docx"),
			outputPath: join("ws", "a.html"),
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(Error);
		const message = (error as Error).message;
		expect(message).toContain("不是 zip 容器");
		expect(message).toContain("已读取 3 个段落");
	});
});
