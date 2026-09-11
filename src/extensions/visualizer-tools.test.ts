/**
 * visualizer 双工具（read_me / show_widget）的测试。
 *
 * 钉住的契约（spec：.trae/specs/add-inline-widgets/spec.md + tasks.md Task 1）：
 *   - show_widget 五类硬校验各自命中与放行（文档包裹标签 / *Storage /
 *     position:fixed / <form> / SVG 恰好一个且 viewBox 为 0 0 680 H）；
 *   - 必填与 loading_messages 边界（数组 / JSON 串 / 逗号串三形态，0 条 / 5 条拒）；
 *   - title 规范化各形态（空格连字符转下划线、非法字符剔除、兜底 widget）；
 *   - 成功 payload 形状与 render_mode 推断；失败 success:false + 中文 message；
 *   - read_me 模块拼装（core+colors 恒含，diagram 追加 svg-setup，chart 不追加）、
 *     非法模块丢弃、全非法兜底文案、指南缺失响亮抛错。
 *
 * resources 读取的 fs 隔离跟从 core/resources.test.ts 的既有模式：
 * mkdtemp 临时目录 + KAMIBUDDY_RESOURCES_DIR env 覆盖（getResourcesDir 每次调用
 * 动态读 env，无需 mock）；另有一节走真实 resources/ 的回归，防指南文件漏分发。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { visualizerExtensionFactory } from "./visualizer-tools.ts";

interface FakeToolResult {
	readonly content: ReadonlyArray<{ type: "text"; text: string }>;
	readonly details: unknown;
}

interface FakeToolDef {
	readonly name: string;
	readonly label: string;
	readonly parameters: unknown;
	readonly execute: (toolCallId: string, params: Record<string, unknown>) => Promise<FakeToolResult>;
}

/** 装好扩展，返回注册到的全部工具（read_me + show_widget）。 */
function mount(): Map<string, FakeToolDef> {
	const tools = new Map<string, FakeToolDef>();
	const fakePi = {
		registerTool: (def: FakeToolDef) => {
			tools.set(def.name, def);
		},
	} as unknown as ExtensionAPI;

	visualizerExtensionFactory()(fakePi);
	return tools;
}

function getTool(tools: Map<string, FakeToolDef>, name: string): FakeToolDef {
	const tool = tools.get(name);
	if (tool === undefined) throw new Error(`${name} 工具没有注册`);
	return tool;
}

/** 工具结果 content 文本即 JSON payload（与 renderer 取数同一条路径）。 */
function parsePayload(result: FakeToolResult): Record<string, unknown> {
	return JSON.parse(result.content[0]?.text ?? "") as Record<string, unknown>;
}

const VALID_SVG =
	'<svg viewBox="0 0 680 120" width="100%"><text class="t" x="60" y="70">示例</text></svg>';

function validParams(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		title: "季度销售对比",
		widget_code: VALID_SVG,
		loading_messages: '["正在整理数据","正在绘制图形"]',
		...overrides,
	};
}

// --- fs 隔离：临时 resources 目录 + env 覆盖 ------------------------------

const GUIDE_MARKERS: Record<string, string> = {
	"core.md": "CORE通用规则标记",
	"colors.md": "COLORS配色标记",
	"svg-setup.md": "SVGSETUP管线标记",
	"diagram.md": "DIAGRAM图型标记",
	"chart.md": "CHART图表标记",
};

let tempDir: string | undefined;
let savedResourcesDir: string | undefined;

beforeEach(() => {
	savedResourcesDir = process.env["KAMIBUDDY_RESOURCES_DIR"];
});

afterEach(() => {
	if (savedResourcesDir === undefined) delete process.env["KAMIBUDDY_RESOURCES_DIR"];
	else process.env["KAMIBUDDY_RESOURCES_DIR"] = savedResourcesDir;
	if (tempDir !== undefined) {
		rmSync(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

/** 建临时 resources 目录并写入指定指南文件，返回目录路径（同时完成 env 覆盖）。 */
function useTempResources(names: readonly string[] = Object.keys(GUIDE_MARKERS)): string {
	tempDir = mkdtempSync(join(tmpdir(), "kami-vis-"));
	mkdirSync(join(tempDir, "visualizer"), { recursive: true });
	for (const name of names) {
		writeFileSync(join(tempDir, "visualizer", name), `# ${name}\n\n${GUIDE_MARKERS[name]}\n`);
	}
	process.env["KAMIBUDDY_RESOURCES_DIR"] = tempDir;
	return tempDir;
}

describe("注册形态", () => {
	it("注册 read_me 与 show_widget 两个工具，中文 label", () => {
		const tools = mount();
		expect(getTool(tools, "read_me").label).toBe("读取设计指南");
		expect(getTool(tools, "show_widget").label).toBe("生成可视化");
	});
});

describe("show_widget 成功路径", () => {
	it("返回同构 payload：type/success/title/widget_code/loading_messages/render_mode", async () => {
		const tool = getTool(mount(), "show_widget");
		const result = await tool.execute("t1", validParams());

		const payload = parsePayload(result);
		expect(payload).toEqual({
			type: "visualizer_show_widget_result",
			success: true,
			title: "季度销售对比",
			widget_code: VALID_SVG,
			loading_messages: ["正在整理数据", "正在绘制图形"],
			render_mode: "svg",
		});
		// details 原样携带整个 payload —— renderer 的工具卡直接从 detail 取数渲染。
		expect(result.details).toEqual(payload);
	});

	it("widget_code 原样透传（不去空白），render_mode 按 trim 后内容推断", async () => {
		const tool = getTool(mount(), "show_widget");
		const padded = `\n  ${VALID_SVG}  \n`;
		const result = await tool.execute("t1", validParams({ widget_code: padded }));

		const payload = parsePayload(result);
		expect(payload["success"]).toBe(true);
		expect(payload["widget_code"]).toBe(padded);
		expect(payload["render_mode"]).toBe("svg");
	});

	it("HTML 片段 → render_mode 为 html", async () => {
		const tool = getTool(mount(), "show_widget");
		const html =
			'<div style="position:relative;height:260px">' +
			'<canvas id="chart-a" role="img" aria-label="销售额柱状图">销售额柱状图</canvas></div>' +
			'<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>' +
			'<script>new Chart(document.getElementById("chart-a"), { type: "bar", data: {}, options: {} });</script>';
		const result = await tool.execute("t1", validParams({ widget_code: html }));

		const payload = parsePayload(result);
		expect(payload["success"]).toBe(true);
		expect(payload["render_mode"]).toBe("html");
	});
});

describe("show_widget 硬校验：必填", () => {
	it("title 缺失或全空白 → success:false", async () => {
		const tool = getTool(mount(), "show_widget");
		for (const title of [undefined, "", "   "]) {
			const result = await tool.execute("t1", validParams({ title }));
			const payload = parsePayload(result);
			expect(payload["success"]).toBe(false);
			expect(String(payload["message"])).toContain("title");
		}
	});

	it("widget_code 缺失或全空白 → success:false", async () => {
		const tool = getTool(mount(), "show_widget");
		for (const code of [undefined, "", "  \n "]) {
			const result = await tool.execute("t1", validParams({ widget_code: code }));
			const payload = parsePayload(result);
			expect(payload["success"]).toBe(false);
			expect(String(payload["message"])).toContain("widget_code");
		}
	});
});

describe("show_widget 硬校验：五类内容禁令各自命中与放行", () => {
	it("禁文档包裹标签：<!DOCTYPE> / <html> / <head> / <body> 各命中", async () => {
		const tool = getTool(mount(), "show_widget");
		const cases = [
			`<!DOCTYPE html>${VALID_SVG}`,
			`<html>${VALID_SVG}</html>`,
			`<div><head><title>x</title></head></div>`,
			`<body><div>内容</div></body>`,
		];
		for (const code of cases) {
			const payload = parsePayload(await tool.execute("t1", validParams({ widget_code: code })));
			expect(payload["success"], code).toBe(false);
			expect(String(payload["message"])).toContain("文档包裹标签");
		}
		// 放行：<header> 不是 <head>，合法片段不受影响。
		const ok = parsePayload(
			await tool.execute("t1", validParams({ widget_code: `<div><header>标题</header></div>` })),
		);
		expect(ok["success"]).toBe(true);
	});

	it("禁 localStorage / sessionStorage", async () => {
		const tool = getTool(mount(), "show_widget");
		for (const code of [
			`<div></div><script>localStorage.setItem("a", "1");</script>`,
			`<div></div><script>sessionStorage.getItem("a");</script>`,
		]) {
			const payload = parsePayload(await tool.execute("t1", validParams({ widget_code: code })));
			expect(payload["success"], code).toBe(false);
			expect(String(payload["message"])).toContain("localStorage/sessionStorage");
		}
		// 放行：普通单词 storage 不误伤。
		const ok = parsePayload(
			await tool.execute("t1", validParams({ widget_code: `<div>本地 storage 说明</div>` })),
		);
		expect(ok["success"]).toBe(true);
	});

	it("禁 position:fixed（错误文案写明理由：高度靠文档流自适应）", async () => {
		const tool = getTool(mount(), "show_widget");
		for (const code of [
			`<div style="position:fixed;top:0">浮层</div>`,
			`<div style="position : fixed">浮层</div>`,
		]) {
			const payload = parsePayload(await tool.execute("t1", validParams({ widget_code: code })));
			expect(payload["success"], code).toBe(false);
			expect(String(payload["message"])).toContain("文档流");
		}
		// 放行：relative/absolute 不受影响。
		const ok = parsePayload(
			await tool.execute(
				"t1",
				validParams({ widget_code: `<div style="position:relative;height:100px"></div>` }),
			),
		);
		expect(ok["success"]).toBe(true);
	});

	it("禁 <form>（建议改用普通控件）", async () => {
		const tool = getTool(mount(), "show_widget");
		const payload = parsePayload(
			await tool.execute("t1", validParams({ widget_code: `<form><input type="text"></form>` })),
		);
		expect(payload["success"]).toBe(false);
		expect(String(payload["message"])).toContain("普通控件");
		// 放行：普通控件本身可以用。
		const ok = parsePayload(
			await tool.execute("t1", validParams({ widget_code: `<div><input type="range"><button>应用</button></div>` })),
		);
		expect(ok["success"]).toBe(true);
	});
});

describe("show_widget 硬校验：SVG 管线（以 <svg 开头时）", () => {
	it("viewBox 宽度非 680 → 拒", async () => {
		const tool = getTool(mount(), "show_widget");
		const payload = parsePayload(
			await tool.execute(
				"t1",
				validParams({ widget_code: '<svg viewBox="0 0 800 120" width="100%"></svg>' }),
			),
		);
		expect(payload["success"]).toBe(false);
		expect(String(payload["message"])).toContain("680");
	});

	it("两个 <svg> → 拒（恰好一个）", async () => {
		const tool = getTool(mount(), "show_widget");
		const payload = parsePayload(
			await tool.execute("t1", validParams({ widget_code: VALID_SVG + VALID_SVG })),
		);
		expect(payload["success"]).toBe(false);
		expect(String(payload["message"])).toContain("恰好包含一个");
	});

	it("缺 viewBox → 拒", async () => {
		const tool = getTool(mount(), "show_widget");
		const payload = parsePayload(
			await tool.execute("t1", validParams({ widget_code: '<svg width="100%"><text x="40" y="60">无</text></svg>' })),
		);
		expect(payload["success"]).toBe(false);
		expect(String(payload["message"])).toContain("viewBox");
	});

	it("合法形态放行：单引号 viewBox、空白容错、内嵌 svg 的 HTML 不走 SVG 校验", async () => {
		const tool = getTool(mount(), "show_widget");
		const singleQuote = parsePayload(
			await tool.execute("t1", validParams({ widget_code: `<svg viewBox='0 0 680 200' width='100%'></svg>` })),
		);
		expect(singleQuote["success"]).toBe(true);

		const looseSpaces = parsePayload(
			await tool.execute("t1", validParams({ widget_code: `<svg viewBox="0  0   680 200" width="100%"></svg>` })),
		);
		expect(looseSpaces["success"]).toBe(true);

		// HTML 片段里内嵌小 svg（图标等）不触发「680 管线」校验，render_mode 仍按 html。
		const htmlWithSvg = parsePayload(
			await tool.execute(
				"t1",
				validParams({ widget_code: `<div><svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg><span>说明</span></div>` }),
			),
		);
		expect(htmlWithSvg["success"]).toBe(true);
		expect(htmlWithSvg["render_mode"]).toBe("html");
	});
});

describe("title 规范化", () => {
	const tool = getTool(mount(), "show_widget");

	async function normalizedTitle(title: string): Promise<unknown> {
		const payload = parsePayload(await tool.execute("t1", validParams({ title })));
		expect(payload["success"]).toBe(true);
		return payload["title"];
	}

	it("空格与连字符转下划线", async () => {
		expect(await normalizedTitle("季度 销售-对比")).toBe("季度_销售_对比");
	});

	it("剔除 Unicode 字母数字下划线以外的字符", async () => {
		expect(await normalizedTitle("Q3 Report (final)!!")).toBe("Q3_Report_final");
	});

	it("压连续下划线、去首尾下划线", async () => {
		expect(await normalizedTitle("  --报告--  ")).toBe("报告");
		expect(await normalizedTitle("a__b")).toBe("a_b");
	});

	it("规范化后为空 → 兜底 widget", async () => {
		expect(await normalizedTitle("---")).toBe("widget");
		expect(await normalizedTitle("！！！")).toBe("widget");
	});
});

describe("loading_messages 三种入参形态与边界", () => {
	const tool = getTool(mount(), "show_widget");

	it("真实数组原样接受", async () => {
		const payload = parsePayload(
			await tool.execute("t1", validParams({ loading_messages: ["整理中", "绘制中", "收尾中"] })),
		);
		expect(payload["success"]).toBe(true);
		expect(payload["loading_messages"]).toEqual(["整理中", "绘制中", "收尾中"]);
	});

	it("JSON 数组串", async () => {
		const payload = parsePayload(
			await tool.execute("t1", validParams({ loading_messages: '["整理中","绘制中"]' })),
		);
		expect(payload["success"]).toBe(true);
		expect(payload["loading_messages"]).toEqual(["整理中", "绘制中"]);
	});

	it("逗号分隔串", async () => {
		const payload = parsePayload(
			await tool.execute("t1", validParams({ loading_messages: "整理数据,绘制图形" })),
		);
		expect(payload["success"]).toBe(true);
		expect(payload["loading_messages"]).toEqual(["整理数据", "绘制图形"]);
	});

	it("0 条拒（空 JSON 数组 / 空串）", async () => {
		for (const raw of ["[]", ""]) {
			const payload = parsePayload(await tool.execute("t1", validParams({ loading_messages: raw })));
			expect(payload["success"], JSON.stringify(raw)).toBe(false);
			expect(String(payload["message"])).toContain("1-4 条");
		}
	});

	it("5 条拒", async () => {
		const payload = parsePayload(
			await tool.execute("t1", validParams({ loading_messages: '["一","二","三","四","五"]' })),
		);
		expect(payload["success"]).toBe(false);
		expect(String(payload["message"])).toContain("1-4 条");
	});

	it("无法解析（坏 JSON）→ success:false 且不抛异常", async () => {
		const payload = parsePayload(await tool.execute("t1", validParams({ loading_messages: "[broken" })));
		expect(payload["success"]).toBe(false);
		expect(String(payload["message"])).toContain("无法解析");
	});

	it("缺失 loading_messages → success:false（必填校验在 schema 之外的执行层）", async () => {
		const payload = parsePayload(await tool.execute("t1", validParams({ loading_messages: undefined })));
		expect(payload["success"]).toBe(false);
	});
});

describe("read_me 模块拼装", () => {
	async function readMeContent(modules: unknown): Promise<string> {
		const tool = getTool(mount(), "read_me");
		const payload = parsePayload(await tool.execute("t1", { modules }));
		expect(payload["type"]).toBe("visualizer_read_me_result");
		return String(payload["content"]);
	}

	function markerOf(name: string): string {
		const marker = GUIDE_MARKERS[name];
		if (marker === undefined) throw new Error(`未知指南文件 ${name}`);
		return marker;
	}

	it("diagram：core + colors 恒含，追加 svg-setup + diagram，不含 chart", async () => {
		useTempResources();
		const content = await readMeContent(["diagram"]);

		for (const name of ["core.md", "colors.md", "svg-setup.md", "diagram.md"]) {
			expect(content).toContain(markerOf(name));
		}
		expect(content).not.toContain(markerOf("chart.md"));
	});

	it("chart：core + colors + chart，不含 svg-setup", async () => {
		useTempResources();
		const content = await readMeContent(["chart"]);

		for (const name of ["core.md", "colors.md", "chart.md"]) {
			expect(content).toContain(markerOf(name));
		}
		expect(content).not.toContain(markerOf("svg-setup.md"));
		expect(content).not.toContain(markerOf("diagram.md"));
	});

	it("逗号串与 JSON 串两种入参形态；两个模块同时给", async () => {
		useTempResources();
		const byComma = await readMeContent("diagram,chart");
		const byJson = await readMeContent('["diagram","chart"]');
		for (const content of [byComma, byJson]) {
			for (const name of Object.keys(GUIDE_MARKERS)) {
				expect(content).toContain(markerOf(name));
			}
		}
	});

	it("非法模块静默丢弃、重复模块去重", async () => {
		useTempResources();
		const content = await readMeContent(["diagram", "mockup", "diagram", "bogus"]);

		expect(content).toContain(markerOf("diagram.md"));
		expect(content).not.toContain(markerOf("chart.md"));
		// 去重：diagram.md 的标记只出现一次。
		expect(content.split(markerOf("diagram.md")).length - 1).toBe(1);
	});

	it("全非法 → 说明文案（写清合法模块），不读文件", async () => {
		useTempResources();
		const content = await readMeContent(["mockup", "art"]);

		expect(content).toContain("没有命中任何有效模块");
		expect(content).toContain("diagram");
		expect(content).toContain("chart");
		expect(content).not.toContain(markerOf("core.md"));
	});

	it("指南文件缺失 → 响亮抛错（不静默降级成空指南）", async () => {
		useTempResources(["core.md", "colors.md"]); // 缺 chart.md
		const tool = getTool(mount(), "read_me");

		await expect(tool.execute("t1", { modules: ["chart"] })).rejects.toThrow(/指南/);
	});
});

describe("真实 resources/ 回归", () => {
	it("仓库内置的五份指南能被 read_me 正常拼装（防漏分发）", async () => {
		// 清掉 env 覆盖，getResourcesDir 回落到仓库根的 resources/。
		delete process.env["KAMIBUDDY_RESOURCES_DIR"];
		const tool = getTool(mount(), "read_me");
		const payload = parsePayload(await tool.execute("t1", { modules: ["diagram", "chart"] }));
		const content = String(payload["content"]);

		expect(content).toContain("0 0 680");
		expect(content).toContain("chart.umd");
		expect(content).toContain("文字进响应");
	});
});
