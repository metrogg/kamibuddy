/**
 * 模型连通性测试（设置-模型页「测试」按钮，spec: 用户直连需求）。
 *
 * 为什么不走 pi 的 streamSimple：那是为会话流式设计的整套装配（compat 探测、
 * 上下文转换、事件流），为「ping 一下」拉起它会拖进一堆与本意无关的失败面
 * （比如流式协议协商）。测试只要回答三件事：网络通不通、Key 认不认、模型
 * 在不在 —— 一个最小的非流式 HTTP 请求足够，且失败语义完全由我们掌控。
 *
 * 覆盖四个协议族（内置服务商 + 自定义 OpenAI 兼容的全部现实路径）；
 * 其余 api 类型（bedrock/vertex/oauth 系）明确报「暂不支持」而不是乱发请求。
 *
 * 不 import pi，纯 fetch，可单测（fetchImpl 注入）。
 */

import type { ModelProbeResult } from "../shared/settings.ts";

export type { ModelProbeResult };

export interface ModelProbeTarget {
	/** pi 的 api 协议族（Model.api）。 */
	readonly api: string;
	/** 解析后的基址（Model.baseUrl，已含协议合并）。 */
	readonly baseUrl: string;
	readonly modelId: string;
	/**
	 * 可省略：本地服务（Ollama、vLLM）常无鉴权，此时完全不带鉴权头 ——
	 * 发 `Bearer ` 空串反而会被一些服务端判成 malformed 请求。
	 */
	readonly apiKey?: string;
	/** pi Model.headers（服务商要求的额外头，如 anthropic-version 之外的特殊头）。 */
	readonly extraHeaders?: Record<string, string>;
	/**
	 * 仅 anthropic-messages：true = 认证走 `Authorization: Bearer <key>`
	 * （Claude 中转的 ANTHROPIC_AUTH_TOKEN 语义），false/省略 = `x-api-key`。
	 * 与 pi 的 provider `authHeader` 配置同义，探测必须与真实会话同头。
	 */
	readonly authHeader?: boolean;
}

const TIMEOUT_MS = 10_000;

/** 各协议族的最小探测请求（url/body/鉴权头）。返回 undefined = 不支持的协议族。 */
function buildRequest(target: ModelProbeTarget): { url: string; init: RequestInit } | undefined {
	const base = target.baseUrl.replace(/\/+$/, "");
	const headers: Record<string, string> = {
		"content-type": "application/json",
		...target.extraHeaders,
	};
	// 无 Key 时不带鉴权头（本地无鉴权服务）；有 Key 时按协议族选择头的形态。
	const key = target.apiKey;
	const bearer: Record<string, string> = key === undefined ? {} : { authorization: `Bearer ${key}` };

	if (target.api === "openai-completions") {
		return {
			url: `${base}/chat/completions`,
			init: {
				method: "POST",
				headers: { ...headers, ...bearer },
				body: JSON.stringify({
					model: target.modelId,
					messages: [{ role: "user", content: "ping" }],
					max_tokens: 1,
					stream: false,
				}),
			},
		};
	}
	if (target.api === "openai-responses" || target.api === "azure-openai-responses" || target.api === "openai-codex-responses") {
		return {
			url: `${base}/responses`,
			init: {
				method: "POST",
				headers: { ...headers, ...bearer },
				body: JSON.stringify({ model: target.modelId, input: "ping", max_output_tokens: 16 }),
			},
		};
	}
	if (target.api === "anthropic-messages") {
		/*
		 * URL 必须与 pi 真实会话一致：pi 走 Anthropic SDK（baseURL + /v1/messages）。
		 * 此前这里少了一层 /v1 —— 用户按 Claude Code 习惯填的基址（.../api/）
		 * 探测会打 .../api/messages 拿 404，而真实会话打 .../api/v1/messages，
		 * 测试按钮误报与真实行为脱节。
		 *
		 * 认证头按 authHeader 分叉，与 pi 运行时（withConfiguredAuth）同义：
		 * Bearer = Claude 中转的 ANTHROPIC_AUTH_TOKEN 语义。
		 */
		const auth: Record<string, string> =
			key === undefined
				? {}
				: target.authHeader === true
					? { authorization: `Bearer ${key}` }
					: { "x-api-key": key };
		return {
			url: `${base}/v1/messages`,
			init: {
				method: "POST",
				headers: {
					...headers,
					...auth,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify({
					model: target.modelId,
					max_tokens: 1,
					messages: [{ role: "user", content: "ping" }],
				}),
			},
		};
	}
	if (target.api === "google-generative-ai") {
		return {
			url: `${base}/models/${encodeURIComponent(target.modelId)}:generateContent`,
			init: {
				method: "POST",
				headers: { ...headers, ...(key === undefined ? {} : { "x-goog-api-key": key }) },
				body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
			},
		};
	}
	return undefined;
}

/** HTTP 状态 → 用户能懂的单行错误（对齐 web-search 的「不出现裸状态码」口径）。 */
function statusError(status: number): string {
	if (status === 401 || status === 403) return "API Key 无效或权限不足";
	if (status === 404) return "模型不存在或接口路径不对";
	if (status === 429) return "触发服务商限流，稍后再试";
	if (status >= 500) return "服务商接口异常，稍后再试";
	return `请求被拒绝（${status}）`;
}

export async function probeModel(
	target: ModelProbeTarget,
	fetchImpl: typeof fetch = fetch,
): Promise<ModelProbeResult> {
	const request = buildRequest(target);
	if (request === undefined) {
		return { ok: false, error: `该协议（${target.api}）暂不支持连通测试` };
	}

	const startedAt = Date.now();
	let response: Response;
	try {
		response = await fetchImpl(request.url, {
			...request.init,
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("abort") || message.includes("timeout") || message.includes("Timeout")) {
			return { ok: false, error: `连接超时（${TIMEOUT_MS / 1000} 秒无响应）` };
		}
		return { ok: false, error: "网络连接失败，请检查网络与接口地址" };
	}

	const latencyMs = Date.now() - startedAt;
	if (response.ok) return { ok: true, latencyMs };

	// 429 = 到达了服务商且鉴权通过，连通本身没问题——如实告知但不判失败。
	if (response.status === 429) return { ok: true, latencyMs, error: "连通正常，但正在限流" };
	return { ok: false, error: statusError(response.status) };
}
