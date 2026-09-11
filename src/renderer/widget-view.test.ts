/**
 * widget-view 纯函数测试：部分 JSON 提取（流式期 args 兜底）、结果解析、
 * 流式期脚本剥离、高度钳制、srcDoc/下载文档的结构钉住。
 *
 * iframe/postMessage 的宿主侧行为依赖 DOM，不进单测；这里钉的是
 * 「数据怎么来、内容怎么净化」，协议字段（消息名/source）由 srcDoc 结构断言覆盖。
 */

import { describe, expect, it } from "vitest";
import {
	buildStandaloneHtml,
	buildWidgetSrcDoc,
	clampWidgetHeight,
	extractPartialWidgetArgs,
	parseWidgetResult,
	stripScripts,
	unescapeJsonFragment,
	WIDGET_MAX_HEIGHT,
	WIDGET_MIN_HEIGHT,
} from "./widget-view.tsx";

describe("parseWidgetResult（工具结果 JSON）", () => {
	it("完整结果：字段全提取（含 success/title/widget_code/loading_messages）", () => {
		const detail = JSON.stringify({
			type: "visualizer_show_widget_result",
			success: true,
			title: "sales_chart",
			widget_code: "<div>chart</div>",
			loading_messages: ["正在构思", "正在绘图"],
			render_mode: "html",
		});
		expect(parseWidgetResult(detail)).toEqual({
			success: true,
			title: "sales_chart",
			widgetCode: "<div>chart</div>",
			loadingMessages: ["正在构思", "正在绘图"],
			message: undefined,
		});
	});

	it("校验失败结果：success:false + message 透出", () => {
		const detail = JSON.stringify({
			type: "visualizer_show_widget_result",
			success: false,
			title: "bad",
			widget_code: "",
			loading_messages: [],
			render_mode: "html",
			message: "SVG 必须恰好一个 <svg> 根元素",
		});
		const parsed = parseWidgetResult(detail);
		expect(parsed?.success).toBe(false);
		expect(parsed?.message).toBe("SVG 必须恰好一个 <svg> 根元素");
	});

	it("type 不符 / 非法 JSON / 非对象：返回 undefined（走 args 兜底）", () => {
		expect(parseWidgetResult(JSON.stringify({ type: "other", success: true }))).toBeUndefined();
		expect(parseWidgetResult("{not json")).toBeUndefined();
		expect(parseWidgetResult('"just a string"')).toBeUndefined();
	});

	it("success 缺失按失败处理（错误视图比白屏诚实）", () => {
		const detail = JSON.stringify({ type: "visualizer_show_widget_result", widget_code: "<svg/>" });
		expect(parseWidgetResult(detail)?.success).toBe(false);
	});
});

describe("unescapeJsonFragment", () => {
	it("常见转义：\\n \\t \\\" \\\\ \\/ \\uXXXX", () => {
		expect(unescapeJsonFragment("a\\nb\\t\\\"c\\\"\\\\d\\/e")).toBe('a\nb\t"c"\\d/e');
		expect(unescapeJsonFragment("\\u4e2d\\u6587")).toBe("中文");
	});

	it("流式末尾的半截转义直接丢弃（孤 \\ 与不足 4 位的 \\u）", () => {
		expect(unescapeJsonFragment("abc\\")).toBe("abc");
		expect(unescapeJsonFragment("abc\\u4e")).toBe("abc");
	});
});

describe("extractPartialWidgetArgs（半截参数 JSON 的容错提取）", () => {
	it("完整 args：三字段全取到", () => {
		const raw = JSON.stringify({
			title: "q1_chart",
			widget_code: "<svg viewBox=\"0 0 680 120\"></svg>",
			loading_messages: "[\"正在构思\",\"正在绘图\"]",
		});
		const partial = extractPartialWidgetArgs(raw);
		expect(partial.title).toBe("q1_chart");
		expect(partial.widgetCode).toBe('<svg viewBox="0 0 680 120"></svg>');
		expect(partial.loadingMessages).toEqual(["正在构思", "正在绘图"]);
	});

	it("widget_code 未闭合：取前缀并反转义（\\n 还原为真实换行）", () => {
		const raw = '{"title":"t","widget_code":"<div>\\n  <p>你好<\\/p>\\n';
		expect(extractPartialWidgetArgs(raw).widgetCode).toBe("<div>\n  <p>你好</p>\n");
	});

	it("widget_code 末尾半截转义不产出乱码", () => {
		const raw = '{"widget_code":"<p>\\u4e2';
		expect(extractPartialWidgetArgs(raw).widgetCode).toBe("<p>");
	});

	it("title 未闭合不上屏（半截标题像 bug）", () => {
		expect(extractPartialWidgetArgs('{"title":"sale').title).toBeUndefined();
		expect(extractPartialWidgetArgs('{"title":"sales"}').title).toBe("sales");
	});

	it("loading_messages 半截数组串：只抠已闭合的项", () => {
		const raw = '{"loading_messages":"[\\"正在构思\\",\\"正在绘"}';
		expect(extractPartialWidgetArgs(raw).loadingMessages).toEqual(["正在构思"]);
	});

	it("loading_messages 容错：模型直接给了数组形态", () => {
		const raw = '{"loading_messages":["a","b"]}';
		expect(extractPartialWidgetArgs(raw).loadingMessages).toEqual(["a", "b"]);
	});

	it("字段未出现：undefined / 空数组，不抛", () => {
		expect(extractPartialWidgetArgs("{}")).toEqual({
			title: undefined,
			widgetCode: undefined,
			loadingMessages: [],
		});
	});
});

describe("stripScripts（流式期脚本剥离）", () => {
	it("剥 <script> 标签（大小写不敏感、带属性），保留其余内容", () => {
		const html = '<div>a</div><SCRIPT src="https://cdnjs.cloudflare.com/x.js"></SCRIPT><p>b</p>';
		expect(stripScripts(html)).toBe("<div>a</div><p>b</p>");
	});

	it("剥未闭合的半截 <script>（流式末尾）", () => {
		expect(stripScripts('<div>a</div><script src="https://esm.sh/ch')).toBe("<div>a</div>");
	});

	it("剥 on* 事件属性：双引号 / 单引号 / 无引号 / 未闭合值", () => {
		expect(stripScripts('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
		expect(stripScripts("<div onclick='x()'>a</div>")).toBe("<div>a</div>");
		expect(stripScripts("<svg onload=alert(1)></svg>")).toBe("<svg></svg>");
		// 流式末尾的未闭合属性值：属性剥掉，标签本身还是半截（下一帧补全）。
		expect(stripScripts('<img src="x" onload="ale')).toBe('<img src="x"');
	});

	it("普通内容不动（含 JSON 里的 on 开头单词、标签内文本）", () => {
		expect(stripScripts('<p data-on="keep">online</p>')).toBe('<p data-on="keep">online</p>');
	});
});

describe("clampWidgetHeight", () => {
	it("钳到 [60, 2000]，非有限值回落最小值", () => {
		expect(clampWidgetHeight(10)).toBe(WIDGET_MIN_HEIGHT);
		expect(clampWidgetHeight(9999)).toBe(WIDGET_MAX_HEIGHT);
		expect(clampWidgetHeight(120.6)).toBe(121);
		expect(clampWidgetHeight(Number.NaN)).toBe(WIDGET_MIN_HEIGHT);
	});
});

describe("iframe 文档结构", () => {
	it("srcDoc：CSP 白名单 + #root + bootstrap 协议 + 明暗 token + 媒体查询", () => {
		const doc = buildWidgetSrcDoc();
		expect(doc).toContain("default-src 'none'");
		expect(doc).toContain("https://cdnjs.cloudflare.com");
		expect(doc).toContain("https://esm.sh");
		expect(doc).toContain("https://cdn.jsdelivr.net");
		expect(doc).toContain("https://unpkg.com");
		expect(doc).toContain('<div id="root"></div>');
		expect(doc).toContain('"kami-widget"');
		expect(doc).toContain('"kami-widget-host"');
		expect(doc).toContain("ResizeObserver");
		expect(doc).toContain("--kw-text");
		expect(doc).toContain("prefers-color-scheme: dark");
		expect(doc).toContain('data-theme="dark"');
	});

	it("下载文档：同一份 head，widget 代码内联（脚本自然执行，无 bootstrap）", () => {
		const doc = buildStandaloneHtml("我的图表", '<div onclick="x()">a</div><script>run()</script>');
		expect(doc).toContain("<title>我的图表</title>");
		expect(doc).toContain("default-src 'none'");
		expect(doc).toContain('<div id="root"><div onclick="x()">a</div><script>run()</script></div>');
		// finalize 语义：下载版保留脚本；bootstrap（ready/postMessage）只属于内联场景。
		expect(doc).not.toContain("kami-widget");
	});

	it("下载文档的 title 做 HTML 转义（流式期半截 title 兜底）", () => {
		expect(buildStandaloneHtml('a<b>"', "x")).toContain("<title>a&lt;b&gt;\"</title>");
	});
});
