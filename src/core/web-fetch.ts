/**
 * 网页抓取：URL → 正文提取 → Markdown。
 *
 * 为什么放 core/：HTTP、安全校验、提取器都是纯 Node 逻辑，无 pi 依赖，可单测；
 * 工具层（extensions/）只负责把错误转成模型可读的消息。
 *
 * 安全边界（提示注入的入口之一）：
 *   1. 协议白名单 —— 只收 http/https，javascript:/data: 直接拒；
 *   2. 内网拦截 —— localhost / 字面内网 IP 拒绝抓取。这是诚实的第一版：
 *      只拦「字面 IP / localhost」，DNS 重绑定（域名解析到内网）需要抓取前
 *      事后两段校验仍可能被绕过，而我们在 Electron 里建 DNS 前置拦截的成本
 *      不划算 —— 办公场景模型抓的 URL 由用户提供或搜索结果产生，内网恶意
 *      目标极少见，但代价是明确的失败，不能静默。
 *   3. 大小上限 —— 原始 HTML 超 5MB 直接拒绝（防止把整个上下文撑爆）。
 *
 * 输出长度**不在这里限制**：正文原样返回，超过 24k 字符的部分由工具结果
 * spill 层落盘并把文件路径给模型（extensions/spill-hook.ts + core/spill.ts，
 * spec: adopt-dsh-disciplines Task 2.1）。本层若先截断，spill 层拿到的就是
 * 残缺文本，落盘也救不回来 —— 「谁能落盘谁才截断」。
 * 原始 HTML 的 5MB 硬上限保留（防止把一个几十 MB 的页面拉进内存）。
 */

import { isIP } from "node:net";
import { Readability } from "@mozilla/readability";
/*
 * linkedom / turndown 为什么走首用时的动态 import（勿改回静态）：
 * 实测热态 linkedom 241ms、turndown 55ms（冷态更高），而它们只在**真的抓一个网页**
 * 时才有用（daemon 的启动关键路径一个网页都不抓）—— 静态挂在这里，每次启动都要
 * 替「用户可能永远不点的网页」白付近 300ms。@mozilla/readability 实测只有 10ms，
 * 留在静态导入里（值不回那点收益，少一处动态形态少一处维护面）。
 */

export interface FetchedPage {
	readonly title: string;
	/** 重定向跟随后的最终 URL（redirect 后协议/主机仍须合法）。 */
	readonly url: string;
	readonly markdown: string;
}

export interface WebFetchOptions {
	/** 原始 HTML 最大值。默认 5MB。 */
	readonly maxRawBytes?: number;
	/** 抓取与整体超时。默认 15s。 */
	readonly timeoutMs?: number;
	/** 测试注入 fetch。 */
	readonly fetchImpl?: typeof fetch;
}

const DEFAULT_MAX_RAW_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * 字面 IP 是否为内网/回环/链路本地地址（第一版拦截范围，见文件头注释）。
 * 导出给 source-parse.ts 复用 —— 来源 URL 与抓取 URL 的内网口径必须一致，
 * 各写一份必然漂移（AGENTS.md §4）。
 */
export function isPrivateIpLiteral(hostname: string): boolean {
	const normalized = hostname.replace(/^\[|\]$/g, "");
	if (normalized === "") return false;

	// 域名不做解析 —— 见文件头「DNS 重绑定」注记，第一版只拦字面 IP。
	if (!isIP(normalized)) return false;

	const parts = normalized.split(".");
	if (parts.length === 4) {
		const [a, b, c, d] = parts.map((p) => Number(p));
		if (a === undefined || b === undefined || c === undefined || d === undefined) return false;
		if (a === 127 || a === 10) return true;
		if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		if (a === 169 && b === 254) return true;
		// 0.0.0.0 及 0/8 属「本机可达」网段，一并拒绝。
		if (a === 0) return true;
		return false;
	}

	// IPv6：回环 ::1 与私有 fc00::/7 按最简处理（::ffff: 前缀映射的 IPv4 同理）。
	const lower = normalized.toLowerCase();
	if (lower === "::1") return true;
	if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
	if (lower.startsWith("::ffff:127") || (lower.startsWith("::ffff:") && isPrivateIpBody(lower.slice(7)))) {
		return true;
	}
	return false;
}

function isPrivateIpBody(body: string): boolean {
	const parts = body.split(".");
	if (parts.length !== 4) return false;
	const [a, b] = parts.map((p) => Number(p));
	if (a === undefined || b === undefined) return false;
	if (a === 127 || a === 10) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 0) return true;
	if (a === 169 && b === 254) return true;
	return false;
}

/** 校验 URL 的协议与主机。返回中文错误或 undefined。 */
function verifyTarget(rawUrl: string): { url: URL; reason?: undefined } | { url?: undefined; reason: string } {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return { reason: `无法解析的网址：${rawUrl}` };
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return { reason: `只支持 http/https 链接（收到 ${parsed.protocol}）` };
	}
	const host = parsed.hostname.toLowerCase();
	if (
		host === "localhost" ||
		host.endsWith(".localhost") ||
		host === "127.0.0.1" ||
		isPrivateIpLiteral(host)
	) {
		return { reason: `出于安全考虑不抓取内网地址：${host}` };
	}
	return { url: parsed };
}

/**
 * 抓取并提取一个网页的正文。
 * 任何失败（网络、超时、非 HTML、无正文）都抛带中文消息的 Error。
 */
export async function fetchPage(
	rawUrl: string,
	options: WebFetchOptions = {},
): Promise<FetchedPage> {
	const maxRawBytes = options.maxRawBytes ?? DEFAULT_MAX_RAW_BYTES;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const fetchImpl = options.fetchImpl ?? fetch;

	const target = verifyTarget(rawUrl);
	if (target.reason !== undefined) throw new Error(target.reason);

	// 超时用 AbortSignal.timeout；fetch 默认跟随重定向，
	// 完成后用 response.url 校验「最终停留」的协议与主机（防重定向到内网/file）。
	const response = await fetchImpl(target.url, {
		redirect: "follow",
		signal: AbortSignal.timeout(timeoutMs),
		headers: {
			// 常规浏览器 UA：部分站点拒绝无 UA 请求。
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) KamiBuddy/0.1",
			accept: "text/html,application/xhtml+xml",
		},
	});

	const finalUrl = verifyTarget(response.url);
	if (finalUrl.reason !== undefined) throw new Error(finalUrl.reason);

	if (!response.ok) {
		throw new Error(`目标返回 HTTP ${response.status}`);
	}

	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
		throw new Error(`目标不是 HTML 页面（Content-Type: ${contentType}），无法提取正文`);
	}

	// 流式读取累计，超上限即中止 —— 一个响应体几十 MB 的页面对上下文毫无价值。
	const rawText = await readLimited(response.body, maxRawBytes);

	// 正文提取这一整步才装配两者：只要不是 HTML 正文提取，一个字节都别加载。
	const [{ parseHTML }, { default: TurndownService }] = await Promise.all([
		import("linkedom"),
		import("turndown"),
	]);
	const { document } = parseHTML(rawText);
	const reader = new Readability(document);
	const article = reader.parse();
	const finalName = finalUrl.url.hostname;

	const turndown = new TurndownService({
		headingStyle: "atx",
		codeBlockStyle: "fenced",
		bulletListMarker: "-",
		emDelimiter: "*",
	});
	// 辅助线与导航不要（页面噪声大）；外部链接保留完整 URL。
	// svg 不列入：turndown 对它们是稳定的 no-op，但类型上不属于元素名映射。
	turndown.remove(["hr", "script", "style", "noscript", "iframe", "nav", "footer"]);
	turndown.addRule("multiLink", {
		filter: "a",
		replacement: (_content, node) => {
			const href = (node.getAttribute("href") ?? "").trim();
			const text = node.textContent?.trim() ?? "";
			if (href === "" || href.startsWith("#") || href.startsWith("javascript:")) return text;
			return text === href ? href : `[${text}](${href})`;
		},
	});

	// Readability 提取不到正文时退化为整页转换（宁可有导航噪声，好过空结果）。
	// 传给 turndown 的必须是字符串或 lib.dom 节点 —— linkedom 的节点与
	// lib.dom 类型不兼容，统一走 outerHTML 字符串（也免掉两套 DOM 的形状差异）。
	// Article.content 的类型是 string | null | undefined（readability 自己的声明），
	// 强判空后仍是它 —— 统一转 String 兜底（null/undefined 时走整页分支）。
	const rawMarkdown =
		article !== null && typeof article.content === "string" && article.content !== ""
			? turndown.turndown(article.content)
			: turndown.turndown(String((document.body ?? document.documentElement).outerHTML));

	const markdown = normalizeWhitespace(rawMarkdown);
	// 阈值 20 字符：只剩一两个链接/短句的页面不叫「正文」
	//（比如纯表单页、加载页、被脚本占位的 SPA），报错让模型换个 URL 而不是读 3 个词。
	if (markdown.trim().length < 20) {
		throw new Error(`未能从 ${finalName === "" ? "该页面" : finalName} 提取到正文（可能需要登录，或不是 HTML 页面）`);
	}

	const articleTitle = article?.title;
	const title =
		articleTitle === undefined || articleTitle === null || articleTitle.trim() === ""
			? finalName
			: articleTitle.trim();
	return {
		title,
		url: response.url,
		markdown,
	};
}

/** 流式读响应体直到 maxBytes。超限抛错误（已取消读取，不把整个页面拉进内存）。 */
async function readLimited(
	body: ReadableStream<Uint8Array> | null,
	maxBytes: number,
): Promise<string> {
	if (body === null) throw new Error("响应没有内容体");
	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value === undefined) break;
		received += value.byteLength;
		if (received > maxBytes) {
			reader.cancel().catch(() => undefined);
			throw new Error(`页面超过 ${Math.round(maxBytes / 1024 / 1024)}MB，已拒绝抓取`);
		}
		chunks.push(value);
	}
	const buffer = new Uint8Array(received);
	let offset = 0;
	for (const chunk of chunks) {
		buffer.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder("utf-8").decode(buffer);
}

/** 合并多余空行与行尾空白，保留 <pre> 语义（单空格缩进 token 更少）。 */
function normalizeWhitespace(text: string): string {
	return text
		.replace(/\r\n?/g, "\n")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n");
}
