/**
 * model-probe 的 HTTP 契约测试。
 *
 * mock fetch 并断言「请求长什么样 / 状态码怎么映射」——
 * 覆盖四个协议族的契约差异（鉴权头形态各异，是最容易写错的地方）。
 */

import { describe, expect, it } from "vitest";
import { probeModel, type ModelProbeTarget } from "./model-probe.ts";

/** 构造一个假 fetch：记录请求、返回指定状态。 */
function fakeFetch(status = 200): { fetchImpl: typeof fetch; calls: { url: string; init: RequestInit }[] } {
	const calls: { url: string; init: RequestInit }[] = [];
	const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ url: String(input), init: init ?? {} });
		return new Response("{}", { status });
	}) as typeof fetch;
	return { fetchImpl, calls };
}

const BASE: Omit<ModelProbeTarget, "api"> = {
	baseUrl: "https://api.example.com/v1/",
	modelId: "test-model",
	apiKey: "test-key",
};

describe("buildRequest 契约", () => {
	it("openai-completions：POST /chat/completions，Bearer 头，baseUrl 尾斜杠被去掉", async () => {
		const { fetchImpl, calls } = fakeFetch();
		const result = await probeModel({ ...BASE, api: "openai-completions" }, fetchImpl);

		expect(result.ok).toBe(true);
		expect(calls[0]?.url).toBe("https://api.example.com/v1/chat/completions");
		const headers = calls[0]?.init.headers as Record<string, string>;
		expect(headers.authorization).toBe("Bearer test-key");
		const body = JSON.parse(String(calls[0]?.init.body)) as { model: string; stream: boolean };
		expect(body.model).toBe("test-model");
		expect(body.stream).toBe(false);
	});

	it("anthropic-messages：x-api-key + anthropic-version，而不是 Bearer", async () => {
		const { fetchImpl, calls } = fakeFetch();
		await probeModel({ ...BASE, api: "anthropic-messages" }, fetchImpl);

		expect(calls[0]?.url).toBe("https://api.example.com/v1/messages");
		const headers = calls[0]?.init.headers as Record<string, string>;
		expect(headers["x-api-key"]).toBe("test-key");
		expect(headers["anthropic-version"]).toBe("2023-06-01");
		expect(headers.authorization).toBeUndefined();
	});

	it("google-generative-ai：模型 id 进 URL 并编码，x-goog-api-key 头", async () => {
		const { fetchImpl, calls } = fakeFetch();
		await probeModel({ ...BASE, api: "google-generative-ai", modelId: "gemini/2.0" }, fetchImpl);

		expect(calls[0]?.url).toBe("https://api.example.com/v1/models/gemini%2F2.0:generateContent");
		const headers = calls[0]?.init.headers as Record<string, string>;
		expect(headers["x-goog-api-key"]).toBe("test-key");
	});

	it("openai-responses：POST /responses，max_output_tokens", async () => {
		const { fetchImpl, calls } = fakeFetch();
		await probeModel({ ...BASE, api: "openai-responses" }, fetchImpl);

		expect(calls[0]?.url).toBe("https://api.example.com/v1/responses");
		const body = JSON.parse(String(calls[0]?.init.body)) as { max_output_tokens: number };
		expect(body.max_output_tokens).toBeGreaterThan(0);
	});

	it("无 apiKey（本地无鉴权服务）：完全不带鉴权头", async () => {
		const { fetchImpl, calls } = fakeFetch();
		const result = await probeModel({ ...BASE, api: "openai-completions", apiKey: undefined }, fetchImpl);

		expect(result.ok).toBe(true);
		const headers = calls[0]?.init.headers as Record<string, string>;
		expect(headers.authorization).toBeUndefined();
	});

	it("extraHeaders 透传（服务商自定义头）", async () => {
		const { fetchImpl, calls } = fakeFetch();
		await probeModel({ ...BASE, api: "openai-completions", extraHeaders: { "x-custom": "yes" } }, fetchImpl);

		const headers = calls[0]?.init.headers as Record<string, string>;
		expect(headers["x-custom"]).toBe("yes");
	});
});

describe("结果映射", () => {
	it("不支持的协议族：不发请求，明确报不支持", async () => {
		const { fetchImpl, calls } = fakeFetch();
		const result = await probeModel({ ...BASE, api: "bedrock-converse-stream" }, fetchImpl);

		expect(result.ok).toBe(false);
		expect(result.error).toContain("暂不支持");
		expect(calls).toHaveLength(0);
	});

	it("401 → Key 无效", async () => {
		const result = await probeModel({ ...BASE, api: "openai-completions" }, fakeFetch(401).fetchImpl);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("API Key");
	});

	it("404 → 模型不存在", async () => {
		const result = await probeModel({ ...BASE, api: "openai-completions" }, fakeFetch(404).fetchImpl);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("模型不存在");
	});

	it("429 → 连通正常但限流（到达了服务商且鉴权通过，不判失败）", async () => {
		const result = await probeModel({ ...BASE, api: "openai-completions" }, fakeFetch(429).fetchImpl);
		expect(result.ok).toBe(true);
		expect(result.error).toContain("限流");
	});

	it("网络异常 → 网络连接失败", async () => {
		const fetchImpl = (async () => {
			throw new TypeError("fetch failed");
		}) as typeof fetch;
		const result = await probeModel({ ...BASE, api: "openai-completions" }, fetchImpl);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("网络连接失败");
	});

	it("成功时带回 latencyMs", async () => {
		const result = await probeModel({ ...BASE, api: "openai-completions" }, fakeFetch(200).fetchImpl);
		expect(result.ok).toBe(true);
		expect(result.latencyMs).toBeTypeOf("number");
	});
});
