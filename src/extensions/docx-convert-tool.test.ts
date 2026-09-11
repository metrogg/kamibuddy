/**
 * docx_convert 工具的胶水层测试。
 *
 * 状态机迁移与 JSON 契约已在 documents/ 层钉住，这里测**接缝**：
 *   - 工具注册（名字必须与 craft.md 白名单一字不差、参数 schema）
 *   - 先 ensure 后 convert 的顺序与失败短路
 *   - 环境失败 / 转换失败（含 markdown_fallback）如何变成模型可读的抛错
 */

import { join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DocxConvertError } from "../documents/docx-convert.ts";
import { createDocxConvertTool, type DocxConvertToolOptions } from "./docx-convert-tool.ts";

const HOME = resolve(sep, "users", "foo");
const ENGINE = resolve(sep, "app", "resources", "docx-engine");
const VENV_PY = join(HOME, ".venv-html-to-docx", "Scripts", "python.exe");

interface FakeToolDef {
	readonly name: string;
	readonly description: string;
	readonly parameters: unknown;
	readonly execute: (
		toolCallId: string,
		params: Record<string, unknown>,
	) => Promise<{ content: Array<{ type: "text"; text: string }>; details: unknown }>;
}

function mount(options: Partial<DocxConvertToolOptions> = {}): { tools: Map<string, FakeToolDef> } {
	const tools = new Map<string, FakeToolDef>();
	const fakePi = {
		registerTool: (def: FakeToolDef) => {
			tools.set(def.name, def);
		},
	} as unknown as ExtensionAPI;
	createDocxConvertTool({ engineDir: ENGINE, homeDir: HOME, platform: "win32", ...options })(fakePi);
	return { tools };
}

const READY_ENV = { status: "ready" as const, python: VENV_PY, venvDir: join(HOME, ".venv-html-to-docx") };

describe("注册", () => {
	it("docx_convert 在场，htmlPath / outputPath 为必填参数", () => {
		const { tools } = mount();
		const tool = tools.get("docx_convert");
		expect(tool).toBeDefined();
		const schema = tool?.parameters as {
			properties?: Record<string, unknown>;
			required?: string[];
		};
		expect(schema.properties?.["htmlPath"]).toBeDefined();
		expect(schema.properties?.["outputPath"]).toBeDefined();
		expect(schema.required).toContain("htmlPath");
		expect(schema.required).toContain("outputPath");
		// 页面参数是可选的（缺省由引擎默认接管）。
		expect(schema.required).not.toContain("pageSize");
		expect(schema.properties?.["pageSize"]).toBeDefined();
	});
});

describe("执行", () => {
	it("先 ensure 后 convert；成功返回 docx 路径与交付提示", async () => {
		const order: string[] = [];
		const { tools } = mount({
			ensure: () => {
				order.push("ensure");
				return Promise.resolve(READY_ENV);
			},
			convert: (req) => {
				order.push("convert");
				expect(req.python).toBe(VENV_PY);
				expect(req.engineDir).toBe(ENGINE);
				expect(req.inputPath).toBe(join("ws", "a.html"));
				expect(req.outputPath).toBe(join("ws", "a.docx"));
				expect(req.options).toEqual({ pageSize: "A3", orientation: "landscape" });
				return Promise.resolve({ docxPath: join("ws", "a.docx"), warnings: [] });
			},
		});
		const execute = tools.get("docx_convert")?.execute;
		const result = await execute!("t1", {
			htmlPath: join("ws", "a.html"),
			outputPath: join("ws", "a.docx"),
			pageSize: "A3",
			orientation: "landscape",
		});

		expect(order).toEqual(["ensure", "convert"]);
		const text = result.content[0]?.text ?? "";
		expect(text).toContain("a.docx");
		expect(text).toContain("present_files");
	});

	it("ensure 失败 → 抛 env-not-ready 文案（引导 + Markdown 降级建议），不发起 convert", async () => {
		let convertCalled = false;
		const { tools } = mount({
			ensure: () =>
				Promise.resolve({
					status: "failed" as const,
					phase: "probe-uv" as const,
					error: "未找到 uv",
				}),
			convert: () => {
				convertCalled = true;
				return Promise.resolve({ docxPath: "", warnings: [] });
			},
		});
		const execute = tools.get("docx_convert")?.execute;

		await expect(
			execute!("t1", { htmlPath: join("ws", "a.html"), outputPath: join("ws", "a.docx") }),
		).rejects.toThrow("未找到 uv");
		expect(convertCalled).toBe(false);
	});

	it("转换失败带 markdown_fallback → 抛错文案如实附降级内容（引导存 .md 交付）", async () => {
		const { tools } = mount({
			ensure: () => Promise.resolve(READY_ENV),
			convert: () =>
				Promise.reject(
					new DocxConvertError("convert-failed", "docx 转换失败：表格嵌套超限", "# 降级内容\n\n正文……"),
				),
		});
		const execute = tools.get("docx_convert")?.execute;

		const error = await execute!("t1", {
			htmlPath: join("ws", "a.html"),
			outputPath: join("ws", "a.docx"),
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(Error);
		const message = (error as Error).message;
		expect(message).toContain("表格嵌套超限");
		expect(message).toContain(".md");
		expect(message).toContain("# 降级内容");
	});

	it("转换失败不带 fallback（如 timeout）→ 原样抛分类文案，不附降级段", async () => {
		const { tools } = mount({
			ensure: () => Promise.resolve(READY_ENV),
			convert: () => Promise.reject(new DocxConvertError("timeout", "docx 转换超时（>120000ms）")),
		});
		const execute = tools.get("docx_convert")?.execute;

		const error = await execute!("t1", {
			htmlPath: join("ws", "a.html"),
			outputPath: join("ws", "a.docx"),
		}).catch((e: unknown) => e);
		const message = (error as Error).message;
		expect(message).toContain("超时");
		expect(message).not.toContain("降级内容如下");
	});
});
