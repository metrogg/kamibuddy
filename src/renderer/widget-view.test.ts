import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildStandaloneHtml, buildWidgetSrcDoc, rewriteChartCdn } from "./widget-view.tsx";

/**
 * 指南文件的路径从本测试文件推（不 import core/config-paths —— renderer 只许 import shared，
 * 见 AGENTS.md §1 与 check:deps）。指南就是 read_me 交给模型的那几份文件。
 */
function guide(name: string): string {
	return readFileSync(resolve(import.meta.dirname, "..", "..", "resources", "visualizer", name), "utf8");
}

/*
 * 「指南承诺 ↔ 宿主实现」的交叉校验。
 *
 * 为什么必须这么测：2026-09-17 的「SVG 全黑」不是一个函数写错，而是**契约断裂** ——
 * 指南（数据）承诺「宿主注入 7 个预置 class」和一组 CSS 变量名，宿主（代码）一个都没实现，
 * 模型严格照指南产出（`class="box"`、`var(--text)`）→ fill 落回 SVG 初值黑 → 整幅图变黑块。
 * 单测宿主、单测工具都测不出这种错，只有把两边对着读才拦得住。改任何一边，这里都要动。
 */
describe("指南与宿主的契约（预置 class / CSS 变量名）", () => {
	const srcDoc = buildWidgetSrcDoc();

	it("svg-setup 的「预置 class」表里每个类，宿主样式表都有对应规则", () => {
		const svgSetup = guide("svg-setup.md");
		const table = svgSetup.slice(
			svgSetup.indexOf("## 预置 class"),
			svgSetup.indexOf("### 色板类"),
		);
		// 表格首列的 `xxx` 就是类名（t / ts / th / box / node / arr / leader）
		const classes = [...table.matchAll(/^\|\s*`([a-z][a-z-]*)`\s*\|/gm)].map((m) => m[1]!);
		expect(classes).toEqual(["t", "ts", "th", "box", "node", "arr", "leader"]);
		for (const name of classes) {
			expect(srcDoc, `预置 class .${name} 没有对应规则`).toMatch(
				new RegExp(`\\.${name}[\\s,{]`),
			);
		}
	});

	it("svg-setup 的色板表里每个 `.c-*`，宿主都定义了亮/暗两态", () => {
		const svgSetup = guide("svg-setup.md");
		const tones = svgSetup.slice(svgSetup.indexOf("### 色板类"), svgSetup.indexOf("## 连线与箭头"));
		// 色板表是两列并排，首列与第三列都是类名
		const palettes = [...tones.matchAll(/`(c-[a-z]+)`/g)].map((m) => m[1]!);
		expect(palettes.length).toBeGreaterThanOrEqual(9);
		for (const name of new Set(palettes)) {
			expect(srcDoc, `${name} 亮色未定义`).toContain(`.${name} {`);
			expect(srcDoc, `${name} 暗色未定义`).toContain(`:root[data-theme="dark"] .${name}`);
		}
	});

	it("core.md 变量表里每个变量名，iframe 文档都真的定义了", () => {
		const core = guide("core.md");
		const table = core.slice(
			core.indexOf("## CSS 变量"),
			core.indexOf("## 排版：字号三档"),
		);
		const names = [...table.matchAll(/^\|\s*`(--[a-z-]+)`\s*\|/gm)].map((m) => m[1]!);
		// 表本身至少要覆盖这几个；漏了说明指南被改瘦了
		expect(names).toEqual(
			expect.arrayContaining(["--bg", "--text", "--text-secondary", "--text-faint", "--border"]),
		);
		for (const name of names) {
			expect(srcDoc, `指南承诺的 ${name} 在 iframe 里没有定义`).toContain(`${name}:`);
		}
	});

	it("下载的独立 HTML 与 iframe 用同一份宿主样式（否则下载版又会变黑块）", () => {
		const standalone = buildStandaloneHtml("t", "<svg></svg>");
		expect(standalone).toContain(".box, .node {");
		expect(standalone).toContain("--text: #000000");
	});
});

describe("rewriteChartCdn（Chart.js CDN → 内联 UMD）", () => {
	it("白名单 CDN 的 chart.umd script src 被整体替换为内联 UMD", () => {
		const hosts = [
			"https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js",
			"https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js",
			"https://unpkg.com/chart.js@4.4.0/dist/chart.umd.min.js",
		];
		for (const host of hosts) {
			const html = `<div><script src="${host}"></script><script>new Chart();</script></div>`;
			const out = rewriteChartCdn(html);
			// 外链没了，UMD 源码内联进来了（Chart.js UMD 的 UMD工厂特征串）
			expect(out).not.toContain(host);
			expect(out).toContain('!function(t,e){"object"==typeof exports');
			// 其余 script 原样保留（内联 Chart 在前、依赖它的内联在后，文档序即执行序）
			expect(out).toContain("new Chart();");
		}
	});

	it("幂等：重写后的输出不再被二次改写", () => {
		const once = rewriteChartCdn(
			'<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>',
		);
		const twice = rewriteChartCdn(once);
		expect(twice).toBe(once);
	});

	it("非 chart.umd 的 CDN 脚本与普通内容不动", () => {
		const html =
			'<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.0.0/react.min.js"></script><p>正文</p>';
		expect(rewriteChartCdn(html)).toBe(html);
	});

	it("esm.sh 是 ESM 语义，不内联 UMD（不误伤）", () => {
		const html = '<script src="https://esm.sh/chart.js@4.4.0/dist/chart.umd.js"></script>';
		expect(rewriteChartCdn(html)).toBe(html);
	});
});
