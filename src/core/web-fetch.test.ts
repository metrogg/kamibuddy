/**
 * web-fetch 的安全校验与提取测试。
 *
 * 安全类是重点：协议白名单、内网拦截直接决定「模型能给用户带来什么风险」，
 * 这两条的回归必须永远挂在测试里。
 */

import { describe, expect, it } from "vitest";
import { fetchPage } from "./web-fetch.ts";

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head><title>示例页面</title>
<meta name="description" content="测试用页面">
<style>body { color: red }</style>
</head>
<body>
<nav><a href="/">首页</a> <a href="/about">关于</a></nav>
<h1>深度学习入门</h1>
<article>
  <p>这是一段正文，介绍深度学习的基本概念。</p>
  <h2>嵌套标题</h2>
  <p>这是一段嵌套正文，包含一个
    <a href="https://example.com/ref">参考链接</a>和<strong>加粗内容</strong>。
  </p>
  <pre><code>const a = 1;</code></pre>
</article>
<footer>页脚噪声</footer>
</body>
</html>`;

/**
 * 在本地构造假 fetch（不走网络）。
 *
 * undici 的 Response.url 是原型 getter 且不可构造注入 —— 用 defineProperty
 * 在实例上覆盖，模拟真实 fetch 重定向后的最终地址（fetchPage 依赖 response.url
 * 做重定向后的协议/主机二次校验）。
 */
function fakeResponse(
	body: string,
	opts: { status?: number; contentType?: string; url?: string } = {},
): Response {
	const real = new Response(body, {
		status: opts.status ?? 200,
		headers: { "content-type": opts.contentType ?? "text/html; charset=utf-8" },
	});
	if (opts.url !== undefined) {
		Object.defineProperty(real, "url", { value: opts.url, configurable: true });
	}
	return real;
}

function htmlFetch(html: string, opts: { status?: number; contentType?: string; url?: string } = {}): typeof fetch {
	return (async (input: RequestInfo | URL) =>
		fakeResponse(html, { ...opts, url: opts.url ?? String(input) })) as typeof fetch;
}

describe("URL 校验", () => {
	it("非 http/https 拒绝", async () => {
		await expect(fetchPage("ftp://example.com/a", { fetchImpl: htmlFetch("") })).rejects.toThrow(
			"只支持 http/https",
		);
		await expect(fetchPage("file:///c:/x.html", { fetchImpl: htmlFetch("") })).rejects.toThrow(
			"只支持 http/https",
		);
	});

	it("javascript: / data: 拒绝（协议白名单）", async () => {
		await expect(
			fetchPage("javascript:alert(1)", { fetchImpl: htmlFetch("") }),
		).rejects.toThrow("只支持 http/https");
		await expect(
			fetchPage("data:text/html,<script>1</script>", { fetchImpl: htmlFetch("") }),
		).rejects.toThrow("只支持 http/https");
	});

	it("无效 URL 拒绝", async () => {
		await expect(fetchPage("not a url", { fetchImpl: htmlFetch("") })).rejects.toThrow(
			"无法解析的网址",
		);
	});

	it("localhost / 内网字面 IP 拒绝（SSRF 防线）", async () => {
		for (const target of [
			"http://localhost:8080",
			"http://127.0.0.1",
			"http://10.0.0.5/x",
			"http://172.16.9.9",
			"http://192.168.1.1",
			"http://169.254.169.254/latest/meta-data", // 云元数据端点
			"http://[::1]/",
			"http://0.0.0.0",
		]) {
			await expect(fetchPage(target, { fetchImpl: htmlFetch("") })).rejects.toThrow(
				"内网地址",
			);
		}
	});

	it("重定向到内网的结果页被拒绝", async () => {
		const fetchImpl: typeof fetch = (async () =>
			fakeResponse(SAMPLE_HTML, { url: "http://192.168.1.1/sneaky" })) as typeof fetch;
		await expect(fetchPage("https://public.example.com", { fetchImpl })).rejects.toThrow("内网地址");
	});

	it("非 HTML 页面拒绝", async () => {
		await expect(
			fetchPage("https://example.com/a.pdf", {
				fetchImpl: htmlFetch("not html", { contentType: "application/pdf" }),
			}),
		).rejects.toThrow("不是 HTML");
	});

	it("HTTP 4xx/5xx 报状态码", async () => {
		await expect(
			fetchPage("https://example.com/404", { fetchImpl: htmlFetch("nf", { status: 404 }) }),
		).rejects.toThrow("HTTP 404");
	});
});

describe("提取与截断", () => {
	it("readability 提取正文、turndown 转 Markdown", async () => {
		const page = await fetchPage("https://example.com/post", { fetchImpl: htmlFetch(SAMPLE_HTML) });
		expect(page.title).toBe("示例页面");
		expect(page.markdown).toContain("深度学习入门");
		expect(page.markdown).toContain("这是一段正文");
		expect(page.markdown).toContain("[参考链接](https://example.com/ref)");
		// 页脚的导航/样式不应进正文
		expect(page.markdown).not.toContain("首页");
		expect(page.markdown).not.toContain("color: red");
		// 链接保留在正文里（引用来源是模型回答的义务）
		expect(page.truncated).toBe(false);
	});

	it("超 maxChars 截断并注明", async () => {
		const page = await fetchPage("https://example.com/post", {
			fetchImpl: htmlFetch(SAMPLE_HTML),
			maxChars: 60,
		});
		expect(page.truncated).toBe(true);
		expect(page.markdown).toContain("已截断");
	});

	it("纯噪声页面报无正文", async () => {
		const noise = `<!DOCTYPE html><html><head><title>x</title></head><body><script>var a=1</script><a href="#" onclick="alert(1)">y</a></body></html>`;
		await expect(fetchPage("https://example.com/noise", { fetchImpl: htmlFetch(noise) })).rejects.toThrow(
			"提取到正文",
		);
	});
});
