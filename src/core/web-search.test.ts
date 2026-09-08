/**
 * web-search 的 HTTP 契约测试。
 *
 * mock fetch 并只断言「请求长什么样 / 响应怎么映射」——
 * 覆盖四个服务商的契约差异（这正是最容易在升级服务商 API 时踩坑的地方）。
 */

import { describe, expect, it } from "vitest";
import { searchWeb, clampLimit } from "./web-search.ts";
import { isWebSearchProviderId, WEB_SEARCH_PROVIDERS } from "../shared/settings.ts";

/** 构造一个假 fetch：记录请求、返回指定响应。 */
function fakeFetch(
	body: unknown,
	status = 200,
	headers: Record<string, string> = {},
): { fetchImpl: typeof fetch; calls: RequestInit[]; urls: string[] } {
	const calls: RequestInit[] = [];
	const urls: string[] = [];
	const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
		urls.push(String(input));
		calls.push(init ?? {});
		return new Response(JSON.stringify(body), {
			status,
			headers: { "content-type": "application/json", ...headers },
		});
	}) as typeof fetch;
	return { fetchImpl, calls, urls };
}

const CONFIG = { providerId: "tavily", apiKey: "test-key" } as const;

describe("tavily", () => {
	it("POST /search，body 带 api_key/query/max_results", async () => {
		const { fetchImpl, calls } = fakeFetch({
			results: [{ title: "标题", url: "https://a.com", content: "内容", published_date: "2026-09-01" }],
		});
		const results = await searchWeb(CONFIG, " 测试查询 ", { fetchImpl, limit: 3 });

		expect(calls).toHaveLength(1);
		expect(calls[0]?.method).toBe("POST");
		expect(JSON.parse(String(calls[0]?.body))).toEqual({
			api_key: "test-key",
			query: "测试查询",
			search_depth: "basic",
			max_results: 3,
		});
		expect(results).toEqual([
			{ title: "标题", url: "https://a.com", description: "内容", publishedAt: "2026-09-01" },
		]);
	});

	it("缺 content 时用 snippet，都没有则描述为空串", async () => {
		const { fetchImpl } = fakeFetch({
			results: [{ title: "t", url: "u", snippet: "s", published_date: "" }],
		});
		const results = await searchWeb(CONFIG, "q", { fetchImpl });
		expect(results[0]?.description).toBe("s");
		expect(results[0]?.publishedAt).toBeUndefined();
	});
});

describe("bocha", () => {
	it("POST + Bearer 头；code !== 0 时报错", async () => {
		const { fetchImpl, calls } = fakeFetch({
			code: 0,
			data: { webPages: { value: [{ name: "n", url: "u", snippet: "s", datePublished: "2026-09-02" }] } },
		});
		const results = await searchWeb({ providerId: "bocha", apiKey: "bk" }, "q", { fetchImpl });
		expect(calls[0]?.headers).toMatchObject({ Authorization: "Bearer bk" });
		expect(results[0]).toMatchObject({ title: "n", url: "u", publishedAt: "2026-09-02" });
	});

	it("业务码失败给出可读错误", async () => {
		const { fetchImpl } = fakeFetch({ code: 4001, msg: "参数错误" });
		await expect(searchWeb({ providerId: "bocha", apiKey: "bk" }, "q", { fetchImpl })).rejects.toThrow(
			"博查搜索失败：参数错误",
		);
	});

	it("成功码是 200 不是 0（实测形状），msg 为 null 也能正常解析", async () => {
		// 关键回归：博查真实成功体 {"code":200,"msg":null,"data":{"webPages":{...}}}——
		// 只认 code:0 会把成功判成失败（用户实测踩到「错误码 200」）。
		const { fetchImpl } = fakeFetch({
			code: 200,
			log_id: "x",
			msg: null,
			data: { webPages: { value: [{ name: "n", url: "u", snippet: "s" }] } },
		});
		const results = await searchWeb({ providerId: "bocha", apiKey: "bk" }, "q", { fetchImpl });
		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({ title: "n", url: "u" });
	});

	it("博查 code 为字符串 '200' 同样成功", async () => {
		const { fetchImpl } = fakeFetch({
			code: "200",
			data: { webPages: { value: [{ name: "n", url: "u", snippet: "s" }] } },
		});
		const results = await searchWeb({ providerId: "bocha", apiKey: "bk" }, "q", { fetchImpl });
		expect(results).toHaveLength(1);
	});

	it("博查真实错误体只有 message 字段（实测形状），仍然给出可读错误", async () => {
		// 「未知错误」是这一形状读不到字段时的显示 —— 这是用户实测踩到的回归。
		const { fetchImpl } = fakeFetch(
			{ code: "4010", message: "无可用额度", log_id: "x" },
			200,
		);
		await expect(searchWeb({ providerId: "bocha", apiKey: "bk" }, "q", { fetchImpl })).rejects.toThrow(
			"博查搜索失败：无可用额度",
		);
	});

	it("博查业务码 401 与 HTTP 401 语义一致（key 无效），不显示未知错误", async () => {
		const { fetchImpl } = fakeFetch({ code: "401", message: "Invalid API KEY" }, 200);
		await expect(searchWeb({ providerId: "bocha", apiKey: "bk" }, "q", { fetchImpl })).rejects.toThrow(
			"API Key 无效",
		);
	});
});

describe("brave / bing", () => {
	it("brave GET + X-Subscription-Token", async () => {
		const { fetchImpl, urls, calls } = fakeFetch({
			web: { results: [{ title: "t", url: "u", description: "d" }] },
		});
		await searchWeb({ providerId: "brave", apiKey: "bk" }, "q 2026", { fetchImpl });
		expect(urls[0]).toContain("api.search.brave.com/res/v1/web/search");
		// URLSearchParams 对空格编码为 +（表单规则），这是各家的共同行为。
		expect(urls[0]).toContain("q=q+2026");
		expect(calls[0]?.headers).toMatchObject({ "X-Subscription-Token": "bk" });
	});

	it("bing GET + Ocp-Apim-Subscription-Key", async () => {
		const { fetchImpl, urls, calls } = fakeFetch({
			webPages: { value: [{ name: "n", url: "u", snippet: "s" }] },
		});
		await searchWeb({ providerId: "bing", apiKey: "bk" }, "q", { fetchImpl });
		expect(urls[0]).toContain("api.bing.microsoft.com/v7.0/search");
		expect(calls[0]?.headers).toMatchObject({ "Ocp-Apim-Subscription-Key": "bk" });
	});
});

describe("校验与错误", () => {
	it("空关键词报错", async () => {
		await expect(searchWeb(CONFIG, "  ", { fetchImpl: fakeFetch({}).fetchImpl })).rejects.toThrow(
			"搜索关键词不能为空",
		);
	});

	it("空 Key 报错并引导去设置页", async () => {
		await expect(
			searchWeb({ providerId: "tavily", apiKey: " " }, "q", { fetchImpl: fakeFetch({}).fetchImpl }),
		).rejects.toThrow("API Key");
	});

	it("未知服务商报错", async () => {
		await expect(
			searchWeb(
				{ providerId: "nope" as never, apiKey: "k" },
				"q",
				{ fetchImpl: fakeFetch({}).fetchImpl },
			),
		).rejects.toThrow("未知的搜索服务商");
	});

	it("401/403 报「Key 无效」", async () => {
		const { fetchImpl } = fakeFetch({}, 401);
		await expect(searchWeb(CONFIG, "q", { fetchImpl })).rejects.toThrow("API Key 无效");
	});

	it("429 报「过于频繁或额度用完」", async () => {
		const { fetchImpl } = fakeFetch({}, 429);
		await expect(searchWeb(CONFIG, "q", { fetchImpl })).rejects.toThrow("额度");
	});

	it("超时转中文错误", async () => {
		// 模拟真实 fetch 对 signal 的响应：abort 事件触发后抛 TimeoutError。
		const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
			await new Promise((_resolve, reject) => {
				const timer = setTimeout(() => reject(new Error("should have been aborted")), 500);
				init?.signal?.addEventListener("abort", () => {
					clearTimeout(timer);
					reject(new DOMException("The operation timed out", "TimeoutError"));
				});
			});
			throw new Error("unreachable");
		}) as unknown as typeof fetch;
		await expect(searchWeb(CONFIG, "q", { fetchImpl, timeoutMs: 1 })).rejects.toThrow("搜索请求超时");
	});

	it("limit 越界被钳制（0→1，100→10）", () => {
		expect(clampLimit(0)).toBe(1);
		expect(clampLimit(100)).toBe(10);
		expect(clampLimit(undefined)).toBe(5);
	});
});

describe("服务商表", () => {
	it("shared 表与 isWebSearchProviderId 一致（博查排首位：国内直连推荐）", () => {
		expect(WEB_SEARCH_PROVIDERS.map((p) => p.id)).toEqual(["bocha", "tavily", "brave", "bing"]);
		expect(isWebSearchProviderId("tavily")).toBe(true);
		expect(isWebSearchProviderId("google")).toBe(false);
	});
});
