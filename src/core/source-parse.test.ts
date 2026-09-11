/**
 * source-parse 的单元测试。
 *
 * 两条主线：
 * 1. 形状防御 —— details.results 非数组 → undefined；脏项剔除不抛错；
 *    空数组（含全剔除完）是合法「搜索无来源」，与 undefined 严格区分。
 * 2. URL 安全校验 —— 仅公网 http/https：凭据 / localhost / 内网各段 / 非 http(s)
 *    协议逐项剔除，普通域名与 http 放行（对齐 WorkBuddy isSafeWebSearchSourceUrl）。
 */

import { describe, expect, it } from "vitest";
import { parseSources } from "./source-parse.ts";

describe("parseSources · 正常提取", () => {
	it("results 映射成 SourceRef：description→snippet，site 按 host 推导，publishedAt 丢弃", () => {
		const out = parseSources({
			count: 2,
			results: [
				{
					title: "标题一",
					url: "https://a.com/p",
					description: "摘要一",
					publishedAt: "2026-09-01",
				},
				{ title: "标题二", url: "https://b.com", description: "摘要二" },
			],
		});
		expect(out).toEqual([
			{ title: "标题一", url: "https://a.com/p", snippet: "摘要一", site: "a.com" },
			{ title: "标题二", url: "https://b.com", snippet: "摘要二", site: "b.com" },
		]);
	});

	it("site 由 host 去 www. 前缀推导（www.example.com → example.com）", () => {
		const out = parseSources({
			results: [{ title: "t", url: "https://www.example.com/x", description: "d" }],
		});
		expect(out).toEqual([{ title: "t", url: "https://www.example.com/x", snippet: "d", site: "example.com" }]);
	});

	it("http 协议放行（不只认 https）", () => {
		const out = parseSources({
			results: [{ title: "t", url: "http://example.com/", description: "d" }],
		});
		expect(out).toHaveLength(1);
	});

	it("description 缺省/空串时 snippet 键缺席（空值不占字段）", () => {
		const out = parseSources({
			results: [
				{ title: "无摘要", url: "https://a.com" },
				{ title: "空摘要", url: "https://b.com", description: "" },
			],
		});
		expect(out).toEqual([
			{ title: "无摘要", url: "https://a.com", site: "a.com" },
			{ title: "空摘要", url: "https://b.com", site: "b.com" },
		]);
		for (const item of out ?? []) expect("snippet" in item).toBe(false);
	});
});

describe("parseSources · 形状防御", () => {
	it("details 不是对象 / results 不是数组 → undefined（sources 键缺席）", () => {
		expect(parseSources(undefined)).toBeUndefined();
		expect(parseSources(null)).toBeUndefined();
		expect(parseSources("手滑了")).toBeUndefined();
		expect(parseSources({ count: 3 })).toBeUndefined();
		expect(parseSources({ results: "手滑了" })).toBeUndefined();
	});

	it("缺 title/url 或为空串的项剔除，纯垃圾项剔除，其余保留", () => {
		const out = parseSources({
			results: [
				{ title: "正常", url: "https://a.com", description: "d" },
				{ url: "https://no-title.com" },
				{ title: "", url: "https://empty-title.com" },
				{ title: "无链接" },
				{ title: "空链接", url: "" },
				"纯字符串垃圾",
				42,
				null,
			],
		});
		expect(out).toEqual([{ title: "正常", url: "https://a.com", snippet: "d", site: "a.com" }]);
	});

	it("URL 解析失败的项剔除", () => {
		const out = parseSources({
			results: [
				{ title: "坏链接", url: "://不是网址" },
				{ title: "好链接", url: "https://a.com" },
			],
		});
		expect(out).toEqual([{ title: "好链接", url: "https://a.com", site: "a.com" }]);
	});

	it("空 results → []；全部剔除完也是 []（合法「搜索无来源」，不是 undefined）", () => {
		expect(parseSources({ count: 0, results: [] })).toEqual([]);
		expect(
			parseSources({ results: [{ title: "内网", url: "http://192.168.1.1/" }] }),
		).toEqual([]);
	});
});

describe("parseSources · URL 安全校验", () => {
	it("带 username/password 凭据的 URL 剔除（打开即泄露 Basic 凭据）", () => {
		const out = parseSources({
			results: [
				{ title: "凭据", url: "https://user:secret@example.com/" },
				{ title: "只有用户名也算凭据", url: "https://user@example.com/" },
				{ title: "正常", url: "https://example.com/" },
			],
		});
		expect(out).toEqual([{ title: "正常", url: "https://example.com/", site: "example.com" }]);
	});

	it("localhost / 127.x / ::1 剔除", () => {
		const out = parseSources({
			results: [
				{ title: "a", url: "http://localhost:8080/x" },
				{ title: "b", url: "https://api.localhost/" },
				{ title: "c", url: "http://127.0.0.1/admin" },
				{ title: "d", url: "http://127.5.6.7/" },
				{ title: "e", url: "http://[::1]:3000/" },
			],
		});
		expect(out).toEqual([]);
	});

	it("内网各段剔除：10.x / 172.16-31 / 192.168 / 169.254", () => {
		const out = parseSources({
			results: [
				{ title: "a", url: "http://10.0.0.8/" },
				{ title: "b", url: "http://172.16.0.1/" },
				{ title: "c", url: "http://172.31.255.254/" },
				{ title: "d", url: "http://192.168.1.100/" },
				{ title: "e", url: "http://169.254.1.1/" },
			],
		});
		expect(out).toEqual([]);
	});

	it("非内网的字面 IP 与 172 边界外（172.15/172.32）放行 —— 公网 IP 是合法来源", () => {
		const out = parseSources({
			results: [
				{ title: "公网 IP", url: "http://8.8.8.8/" },
				{ title: "172 下界外", url: "http://172.15.0.1/" },
				{ title: "172 上界外", url: "http://172.32.0.1/" },
			],
		});
		expect(out).toHaveLength(3);
	});

	it("非 http(s) 协议剔除（ftp / javascript / data / file）", () => {
		const out = parseSources({
			results: [
				{ title: "ftp", url: "ftp://example.com/f" },
				{ title: "js", url: "javascript:alert(1)" },
				{ title: "data", url: "data:text/html,<p>x</p>" },
				{ title: "file", url: "file:///etc/passwd" },
			],
		});
		expect(out).toEqual([]);
	});
});
