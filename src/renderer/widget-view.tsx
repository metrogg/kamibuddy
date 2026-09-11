/**
 * show_widget 的内联可视化块（机制对标 WorkBuddy 的 widget 卡）。
 *
 * 取数「result 优先、args 兜底」：
 *   - 卡片 detail（工具结果 JSON，visualizer_show_widget_result）是终态权威；
 *   - 结果未返回（流式/进行中）时从卡片 streamArgs（生成期累积的半截参数 JSON）
 *     做容错提取 —— widget_code 只要求前缀，抓到哪渲染哪。
 *
 * 沙箱模型：iframe sandbox="allow-scripts"（不加 allow-same-origin，
 * srcDoc 与宿主天然异源隔离）+ srcDoc 内置 CSP（default-src 'none' +
 * CDN 白名单）。宿主与 iframe 全靠 postMessage 通信，协议见文件尾注释。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ToolCard } from "@shared/session-events.ts";
import { useCopyWithTick } from "./copy-tick.ts";
import { IconAlert, IconCheck, IconCopy, IconDownload } from "./icons.tsx";

/* ── 取数：结果 JSON 与部分参数提取 ───────────────────────────── */

/** 工具结果 JSON 的解析产物（契约见 extensions/visualizer-tools 的钉死字段）。 */
export interface WidgetResultData {
	readonly success: boolean;
	readonly title: string | undefined;
	readonly widgetCode: string | undefined;
	readonly loadingMessages: readonly string[];
	readonly message: string | undefined;
}

/** 从半截参数 JSON 里容错提取的产物（流式期的兜底数据源）。 */
export interface PartialWidgetArgs {
	readonly title: string | undefined;
	readonly widgetCode: string | undefined;
	readonly loadingMessages: readonly string[];
}

const EMPTY_PARTIAL: PartialWidgetArgs = {
	title: undefined,
	widgetCode: undefined,
	loadingMessages: [],
};

/**
 * JSON 字符串片段的反转义，容忍流式末尾的半截转义（`\` 或 `\u12` 收尾）：
 * 半截转义直接丢弃 —— 下一帧 delta 到达后它自然补全，硬解只会产出乱码。
 */
export function unescapeJsonFragment(fragment: string): string {
	let out = "";
	for (let i = 0; i < fragment.length; i += 1) {
		const ch = fragment.charAt(i);
		if (ch !== "\\") {
			out += ch;
			continue;
		}
		const esc = fragment.charAt(i + 1);
		if (esc === "") break; // 末尾孤 `\`：丢弃
		switch (esc) {
			case "n": out += "\n"; i += 1; continue;
			case "t": out += "\t"; i += 1; continue;
			case "r": out += "\r"; i += 1; continue;
			case "b": out += "\b"; i += 1; continue;
			case "f": out += "\f"; i += 1; continue;
			case "u": {
				const hex = fragment.slice(i + 2, i + 6);
				// 不足 4 位只会出现在流式末尾：丢弃并终止。
				if (hex.length < 4) return out;
				if (/^[0-9a-fA-F]{4}$/.test(hex)) {
					out += String.fromCharCode(parseInt(hex, 16));
					i += 5;
					continue;
				}
				// 非法 \u 转义（模型输出异常）：原样保留，不猜。
				out += "\\";
				continue;
			}
			default:
				// \" \\ \/ 及未知转义：取字符本体。
				out += esc;
				i += 1;
		}
	}
	return out;
}

/**
 * 从（可能半截的）JSON 文本里提取字符串字段。
 * closed=true 要求收尾引号齐备（title 这类短字段：半截值上屏像 bug）；
 * closed=false 抓到哪算哪（widget_code 流式渐进渲染）。
 * 取首个匹配键：title 的取值经工具规范化（字母数字下划线），不会在值里
 * 藏一个假键；widget_code 的 HTML/SVG 内容也不会恰好出现 `"widget_code": "`。
 */
function extractJsonString(raw: string, key: string, closed: boolean): string | undefined {
	const open = new RegExp(`"${key}"\\s*:\\s*"`).exec(raw);
	if (open === null) return undefined;
	const start = open.index + open[0].length;
	// 按 JSON 字符串规则扫描：\\ 转义消费两字符，" 收尾。
	for (let i = start; i < raw.length; i += 1) {
		const ch = raw.charAt(i);
		if (ch === "\\") {
			i += 1;
			continue;
		}
		if (ch === '"') return unescapeJsonFragment(raw.slice(start, i));
	}
	return closed ? undefined : unescapeJsonFragment(raw.slice(start));
}

/** 宽松解析字符串数组：完整则 JSON.parse；半截（流式中）逐条抠已闭合的项，末条半成品丢弃。 */
function parseStringArrayLoose(text: string): readonly string[] {
	try {
		const parsed: unknown = JSON.parse(text);
		if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
		return [];
	} catch {
		const items: string[] = [];
		const re = /"((?:[^"\\]|\\.)*)"/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) {
			const item = m[1];
			if (item !== undefined) items.push(unescapeJsonFragment(item));
		}
		return items;
	}
}

/** loading_messages 的提取：契约形态是 JSON 数组串，模型偶发直接给数组时容错。 */
function parseLoadingMessages(raw: string): readonly string[] {
	const asString = extractJsonString(raw, "loading_messages", false);
	if (asString !== undefined) return parseStringArrayLoose(asString);
	const arrayStart = /"loading_messages"\s*:\s*\[/.exec(raw);
	if (arrayStart === null) return [];
	return parseStringArrayLoose(raw.slice(arrayStart.index + arrayStart[0].length - 1));
}

/** 工具结果 JSON（detail）的解析。type 不符或非法 JSON 返回 undefined（走 args 兜底）。 */
export function parseWidgetResult(detail: string): WidgetResultData | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(detail);
	} catch {
		return undefined;
	}
	if (typeof parsed !== "object" || parsed === null) return undefined;
	const record = parsed as Record<string, unknown>;
	if (record.type !== "visualizer_show_widget_result") return undefined;
	const loading = record.loading_messages;
	return {
		// 契约保证 success 是布尔；缺失按失败处理（错误视图比白屏诚实）。
		success: record.success === true,
		title: typeof record.title === "string" ? record.title : undefined,
		widgetCode: typeof record.widget_code === "string" ? record.widget_code : undefined,
		loadingMessages: Array.isArray(loading)
			? loading.filter((x): x is string => typeof x === "string")
			: typeof loading === "string"
				? parseStringArrayLoose(loading)
				: [],
		message: typeof record.message === "string" ? record.message : undefined,
	};
}

/** 半截参数 JSON（streamArgs）的容错提取：result 未返回时的兜底数据源。 */
export function extractPartialWidgetArgs(raw: string): PartialWidgetArgs {
	return {
		title: extractJsonString(raw, "title", true),
		widgetCode: extractJsonString(raw, "widget_code", false),
		loadingMessages: parseLoadingMessages(raw),
	};
}

/* ── 流式期内容净化 ────────────────────────────────────────────── */

/**
 * 流式期（update）内容的脚本剥离：<script> 标签（含未闭合的半截标签）与
 * on* 事件属性。innerHTML 注入的 <script> 按 HTML 规范本就不执行，但
 * on* 属性（<img onerror=…>）随解析立即触发 —— 半成品脚本一旦跑起来，
 * iframe 里就是不可控的异常现场。finalize 不经过这里（Chart.js 靠脚本执行）。
 */
export function stripScripts(html: string): string {
	return html
		.replace(/<script\b[\s\S]*?(?:<\/script\s*>|$)/gi, "")
		.replace(/\s+on[a-zA-Z][a-zA-Z0-9]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g, "");
}

/* ── iframe 文档（srcDoc）与下载文档 ──────────────────────────── */

export const WIDGET_MIN_HEIGHT = 60;
export const WIDGET_MAX_HEIGHT = 2000;

/** RO 上报值的钳制：[60, 2000]，防异常内容把消息流撑爆或压没。 */
export function clampWidgetHeight(height: number): number {
	if (!Number.isFinite(height)) return WIDGET_MIN_HEIGHT;
	return Math.min(WIDGET_MAX_HEIGHT, Math.max(WIDGET_MIN_HEIGHT, Math.round(height)));
}

/*
 * iframe 内文档的设计 token（与 visualizer 指南色板协调的一套语义变量）：
 * 文本三档 / 描边 / 两级表面 / 强调色 + 图表九色系。
 * 明暗两态：:root[data-theme] 由宿主 theme 消息驱动（宿主消息优先），
 * prefers-color-scheme 媒体查询是兜底一路（下载的 .html 独立打开时靠它）。
 */
const TOKENS_LIGHT = [
	"color-scheme: light",
	"--kw-text: #1a1a1a",
	"--kw-text-secondary: rgba(0, 0, 0, 0.7)",
	"--kw-text-dim: rgba(0, 0, 0, 0.5)",
	"--kw-border: #e6e6e6",
	"--kw-surface: #ffffff",
	"--kw-surface-raised: #f7f7f7",
	"--kw-accent: #2f6bff",
	"--kw-c1: #5470c6",
	"--kw-c2: #91cc75",
	"--kw-c3: #fac858",
	"--kw-c4: #ee6666",
	"--kw-c5: #73c0de",
	"--kw-c6: #3ba272",
	"--kw-c7: #fc8452",
	"--kw-c8: #9a60b4",
	"--kw-c9: #ea7ccc",
].join(";");

const TOKENS_DARK = [
	"color-scheme: dark",
	"--kw-text: rgba(255, 255, 255, 0.92)",
	"--kw-text-secondary: rgba(255, 255, 255, 0.65)",
	"--kw-text-dim: rgba(255, 255, 255, 0.45)",
	"--kw-border: rgba(255, 255, 255, 0.14)",
	"--kw-surface: #1c1c1e",
	"--kw-surface-raised: #2c2c2e",
	"--kw-accent: #6b93ff",
	"--kw-c1: #7c96e0",
	"--kw-c2: #a8d88f",
	"--kw-c3: #fbd97a",
	"--kw-c4: #f28585",
	"--kw-c5: #8fd1e8",
	"--kw-c6: #5cb88d",
	"--kw-c7: #fda374",
	"--kw-c8: #b182c8",
	"--kw-c9: #f096d1",
].join(";");

const WIDGET_CSS = [
	"* { box-sizing: border-box; }",
	"html, body { margin: 0; padding: 0; background: transparent; }",
	// 字体栈与宿主（index.css body）一致：widget 是消息流的一部分，不是外来页。
	'body { font: 14px/1.6 "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; color: var(--kw-text); }',
	`:root { ${TOKENS_LIGHT}; }`,
	`:root[data-theme="dark"] { ${TOKENS_DARK}; }`,
	`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${TOKENS_DARK}; } }`,
	// overflow:hidden 建 BFC：子元素 margin 不外溢，高度测量才准。
	"#root { width: 100%; overflow: hidden; }",
	"svg, img, canvas, video { max-width: 100%; }",
	// 滚动条美化：高度自适应后常态无滚动条，这里只兜流式期的瞬态溢出。
	"::-webkit-scrollbar { width: 8px; height: 8px; }",
	"::-webkit-scrollbar-thumb { background: var(--kw-border); border-radius: 4px; }",
	"::-webkit-scrollbar-track { background: transparent; }",
].join("\n");

// CSP：default-src 'none' 起底，脚本只放行内联 + eval + blob + 四家 CDN
//（Chart.js 走 cdnjs，ESM 依赖走 esm.sh/jsdelivr/unpkg），样式只放行内联。
const WIDGET_CSP =
	"default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: https://cdnjs.cloudflare.com https://esm.sh https://cdn.jsdelivr.net https://unpkg.com; style-src 'unsafe-inline'; img-src data: blob: https:; font-src https:";

const WIDGET_HEAD = [
	'<meta charset="utf-8">',
	`<meta http-equiv="Content-Security-Policy" content="${WIDGET_CSP}">`,
	`<style>${WIDGET_CSS}</style>`,
].join("\n");

/*
 * srcDoc 内置 bootstrap（iframe 侧协议实现）：
 * - 挂载即回 ready；ResizeObserver 观察 #root，高度变化即上报（宿主侧 clamp）。
 * - update / finalize：写 #root。finalize 额外克隆重建 <script> ——
 *   innerHTML 注入的脚本按规范不执行，Chart.js 等 CDN 脚本靠重建激活。
 * - theme：写 <html data-theme>，压过 prefers-color-scheme 媒体查询。
 * 用 ES5 写法：这份代码不进 TS 编译，越朴素越不挑 WebView。
 */
const WIDGET_BOOTSTRAP = [
	"(function () {",
	'	var root = document.getElementById("root");',
	"	var lastHeight = -1;",
	"	function reportHeight() {",
	"		if (!root) return;",
	"		var h = Math.ceil(root.getBoundingClientRect().height);",
	"		if (h === lastHeight) return;",
	"		lastHeight = h;",
	'		parent.postMessage({ source: "kami-widget", type: "resize", height: h }, "*");',
	"	}",
	"	function setContent(html, runScripts) {",
	"		if (!root) return;",
	"		root.innerHTML = html;",
	"		if (runScripts) {",
	"			activateScripts(root.querySelectorAll(\"script\"), 0);",
	"		}",
	"		reportHeight();",
	"	}",
	/*
	 * 脚本激活必须保持文档顺序：innerHTML 注入的脚本不执行，克隆重建来激活 ——
	 * 但动态插入的脚本默认 async，若一次性全部替换，内联脚本会抢在外链
	 * 脚本加载完成前执行（2026-09-11 实测：Chart.js CDN 未加载完，依赖它的
	 * 内联脚本已经跑 → Chart is not defined → 图表空白）。
	 * 所以外链/模块脚本串行激活：load/error 后才处理下一个；
	 * 内联经典脚本 replaceChild 即同步执行，天然有序。
	 */
	"	function activateScripts(scripts, i) {",
	"		if (i >= scripts.length) { reportHeight(); return; }",
	"		var old = scripts[i];",
	'		var s = document.createElement("script");',
	"		for (var j = 0; j < old.attributes.length; j++) {",
	"			var attr = old.attributes[j];",
	"			s.setAttribute(attr.name, attr.value);",
	"		}",
	"		s.textContent = old.textContent;",
	'		var isModule = s.type === "module";',
	"		if (s.src || isModule) {",
	"			s.onload = function () { activateScripts(scripts, i + 1); };",
	"			s.onerror = function () { activateScripts(scripts, i + 1); };",
	"			old.parentNode.replaceChild(s, old);",
	"		} else {",
	"			old.parentNode.replaceChild(s, old);",
	"			activateScripts(scripts, i + 1);",
	"		}",
	"	}",
	'	window.addEventListener("message", function (event) {',
	"		var data = event.data;",
	'		if (!data || data.source !== "kami-widget-host") return;',
	'		if (data.type === "update") setContent(String(data.html || ""), false);',
	'		else if (data.type === "finalize") setContent(String(data.html || ""), true);',
	'		else if (data.type === "theme") {',
	'			document.documentElement.setAttribute("data-theme", String(data.theme || "light"));',
	"		}",
	"	});",
	'	if (typeof ResizeObserver !== "undefined" && root) {',
	"		new ResizeObserver(reportHeight).observe(root);",
	"	}",
	'	parent.postMessage({ source: "kami-widget", type: "ready" }, "*");',
	"})();",
].join("\n");

/** iframe 的 srcDoc：完整 HTML（CSP + token 样式 + #root + bootstrap），模块级常量不变。 */
export function buildWidgetSrcDoc(): string {
	return [
		"<!DOCTYPE html>",
		"<html>",
		"<head>",
		WIDGET_HEAD,
		"</head>",
		"<body>",
		'<div id="root"></div>',
		`<script>${WIDGET_BOOTSTRAP}</script>`,
		"</body>",
		"</html>",
	].join("\n");
}

const WIDGET_SRCDOC = buildWidgetSrcDoc();

/** <title> 的文本转义（title 契约已规范化为字母数字下划线，这里只兜流式期的半截 title）。 */
function escapeHtmlText(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 「下载」的完整 HTML 文档：与 srcDoc 同一份 head（CSP + token），
 * widget 代码直接内联（脚本随文档解析自然执行，无需 bootstrap）。
 * 无 data-theme 预设 —— 独立打开时主题走 prefers-color-scheme 媒体查询一路。
 */
export function buildStandaloneHtml(title: string, widgetCode: string): string {
	return [
		"<!DOCTYPE html>",
		"<html>",
		"<head>",
		`<title>${escapeHtmlText(title)}</title>`,
		WIDGET_HEAD,
		"</head>",
		"<body>",
		`<div id="root">${widgetCode}</div>`,
		"</body>",
		"</html>",
	].join("\n");
}

/* ── postMessage 协议（宿主侧） ──────────────────────────────────
 *
 * 宿主 → iframe（source: "kami-widget-host"）：
 *   update    { html }   流式期内容（已剥离 script/on*，防半成品脚本执行）
 *   finalize  { html }   完成态内容（保留 script，iframe 克隆重建使其执行）
 *   theme     { theme }  "light" | "dark"，写 <html data-theme>
 * iframe → 宿主（source: "kami-widget"）：
 *   ready                bootstrap 挂载完成（宿主此后才发内容）
 *   resize   { height }  #root 高度变化（宿主 clamp 到 [60, 2000]）
 * targetOrigin 只能 "*"：srcDoc + 无 allow-same-origin 的 iframe 是 opaque origin。
 * 内容非机密（本来就要上屏），可接受。
 */
type HostMessage =
	| { readonly source: "kami-widget-host"; readonly type: "update"; readonly html: string }
	| { readonly source: "kami-widget-host"; readonly type: "finalize"; readonly html: string }
	| { readonly source: "kami-widget-host"; readonly type: "theme"; readonly theme: "light" | "dark" };

function postToFrame(frame: HTMLIFrameElement | null, message: HostMessage): void {
	frame?.contentWindow?.postMessage(message, "*");
}

/**
 * 宿主主题。应用当前只有浅色主题（index.css 的 color-scheme: light），
 * 暗色落地（D6 design token）时这里改读全局主题状态并随变化发 theme 消息。
 */
function hostTheme(): "light" | "dark" {
	return "light";
}

/** loading_messages 轮播间隔（WorkBuddy widget 加载文案同节奏）。 */
const LOADING_ROTATE_MS = 1_400;
/** 高度上报的尾沿防抖：RO 在流式增长时高频触发，收敛到「微增长」节奏。 */
const HEIGHT_DEBOUNCE_MS = 100;

/** Windows 文件名禁字符兜底（title 契约已规范化，这里防流式期半截 title）。 */
function sanitizeFileName(name: string): string {
	const cleaned = name.replace(/[\\/:*?"<>|]/g, "_").trim();
	return cleaned === "" ? "widget" : cleaned;
}

/* ── 组件 ─────────────────────────────────────────────────────── */

export function WidgetView({ card }: { readonly card: ToolCard }): React.JSX.Element {
	// result 优先：终态内容以工具结果 JSON 为准；args（streamArgs）是流式期的兜底。
	const result = card.detail === undefined ? undefined : parseWidgetResult(card.detail);
	const partial = useMemo(
		() => (card.streamArgs === undefined ? EMPTY_PARTIAL : extractPartialWidgetArgs(card.streamArgs)),
		[card.streamArgs],
	);

	const widgetCode =
		result?.widgetCode !== undefined && result.widgetCode !== ""
			? result.widgetCode
			: partial.widgetCode !== undefined && partial.widgetCode !== ""
				? partial.widgetCode
				: undefined;
	const title = result?.title ?? partial.title ?? "widget";
	const loadingMessages = result?.loadingMessages ?? partial.loadingMessages;
	const streaming = card.outcome === undefined;
	const failed = result !== undefined && !result.success;
	// finalize 的门槛：执行成功且结果非校验失败。中止/被拦的卡有半截内容也
	// 只走 update（剥脚本）—— 半成品脚本不能跑。
	const finalized = card.outcome === "ok" && !failed;

	const { copied, copy } = useCopyWithTick();

	/* loading_messages 轮播：仅在 loading 视图挂载期间计时（组件随视图切换卸载）。 */
	const [msgIndex, setMsgIndex] = useState(0);
	useEffect(() => {
		if (loadingMessages.length <= 1) return;
		const timer = window.setInterval(() => {
			setMsgIndex((i) => (i + 1) % loadingMessages.length);
		}, LOADING_ROTATE_MS);
		return () => window.clearInterval(timer);
	}, [loadingMessages.length]);
	const loadingText =
		loadingMessages.length === 0
			? "正在准备可视化…"
			: loadingMessages[msgIndex % loadingMessages.length];

	/* iframe 生命周期：ready 后才发内容；RO 高度经 clamp + 尾沿防抖上屏。 */
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [frameReady, setFrameReady] = useState(false);
	const [frameHeight, setFrameHeight] = useState(WIDGET_MIN_HEIGHT);
	const pendingHeightRef = useRef(WIDGET_MIN_HEIGHT);
	const heightTimerRef = useRef<number | undefined>(undefined);

	const scheduleHeight = useCallback((reported: number) => {
		pendingHeightRef.current = clampWidgetHeight(reported);
		window.clearTimeout(heightTimerRef.current);
		heightTimerRef.current = window.setTimeout(() => {
			setFrameHeight(pendingHeightRef.current);
		}, HEIGHT_DEBOUNCE_MS);
	}, []);

	useEffect(() => () => window.clearTimeout(heightTimerRef.current), []);

	useEffect(() => {
		const onMessage = (event: MessageEvent): void => {
			const frame = iframeRef.current;
			// 消息流里可能有多张 widget 卡：按 event.source 认窗，不认来源字符串。
			if (frame === null || event.source !== frame.contentWindow) return;
			const data: unknown = event.data;
			if (typeof data !== "object" || data === null) return;
			const msg = data as { source?: unknown; type?: unknown; height?: unknown };
			if (msg.source !== "kami-widget") return;
			if (msg.type === "ready") setFrameReady(true);
			else if (msg.type === "resize" && typeof msg.height === "number") scheduleHeight(msg.height);
		};
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [scheduleHeight]);

	const theme = hostTheme();
	useEffect(() => {
		if (!frameReady) return;
		postToFrame(iframeRef.current, { source: "kami-widget-host", type: "theme", theme });
	}, [frameReady, theme]);

	useEffect(() => {
		if (!frameReady || widgetCode === undefined) return;
		postToFrame(iframeRef.current, {
			source: "kami-widget-host",
			type: finalized ? "finalize" : "update",
			html: finalized ? widgetCode : stripScripts(widgetCode),
		});
	}, [frameReady, widgetCode, finalized]);

	const download = (): void => {
		if (widgetCode === undefined) return;
		const blob = new Blob([buildStandaloneHtml(title, widgetCode)], { type: "text/html" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `${sanitizeFileName(title)}.html`;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
	};

	const statusIcon = failed ? (
		<IconAlert size={14} className="widget-status bad" />
	) : streaming ? (
		<span className="task-spinner widget-status" aria-hidden="true" />
	) : card.outcome === "ok" ? (
		<IconCheck size={14} className="widget-status ok" />
	) : (
		// 中止/被拦：内容可能只有半截，标识降级为哑色警告而不是绿勾。
		<IconAlert size={14} className="widget-status dim" />
	);

	let body: React.JSX.Element;
	if (failed) {
		body = (
			<div className="widget-error">
				<IconAlert size={14} />
				<span>{result.message ?? "widget 校验失败"}</span>
			</div>
		);
	} else if (widgetCode !== undefined) {
		body = (
			<iframe
				ref={iframeRef}
				className="widget-frame"
				sandbox="allow-scripts"
				srcDoc={WIDGET_SRCDOC}
				style={{ height: frameHeight }}
				title={title}
			/>
		);
	} else if (streaming) {
		body = (
			<div className="widget-loading">
				<span className="task-spinner" aria-hidden="true" />
				<span>{loadingText}</span>
			</div>
		);
	} else {
		body = <div className="widget-missing">可视化内容缺失</div>;
	}

	return (
		<div className="widget-card">
			<div className="widget-head">
				{statusIcon}
				<span className="widget-title" title={title}>
					{title}
				</span>
				<div className="widget-actions">
					<button
						type="button"
						className="widget-action"
						aria-label="复制代码"
						title={copied ? "已复制" : "复制代码"}
						disabled={widgetCode === undefined}
						onClick={() => void copy(widgetCode ?? "")}
					>
						{copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
					</button>
					<button
						type="button"
						className="widget-action"
						aria-label="下载 HTML"
						title="下载 HTML"
						disabled={widgetCode === undefined}
						onClick={download}
					>
						<IconDownload size={13} />
					</button>
				</div>
			</div>
			<div className="widget-body">{body}</div>
		</div>
	);
}
