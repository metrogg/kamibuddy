/**
 * 联网搜索：多服务商实现的 HTTP 客户端。
 *
 * 为什么放 core/：工具（extensions/）只做「把结果排成模型能读的文本」，
 * HTTP 契约、错误映射、参数拼装都在这层，纯 Node 无 pi 依赖，可单测。
 *
 * 支持的服务商（都是「填 Key 即用」型，注册表见 SEARCH_PROVIDERS）：
 *   - Tavily：面向 LLM 的搜索 API，有免费额度，结果带 AI 摘要与中文支持
 *   - Bocha（博查）：国内服务，中文搜索结果质量好
 *   - Brave：海外，隐私友好，免费额度低
 *   - Bing：微软官方 API，需 Azure 订阅 Key
 *
 * 错误全部收敛为**人类可读的中文消息**：这条错误会直接回给模型/用户，
 * 不该出现 HTTP 状态码裸字样。超时统一 10s（AbortSignal.timeout）。
 */

import {
	isWebSearchProviderId,
	WEB_SEARCH_PROVIDERS,
	type WebSearchProviderId,
} from "../shared/settings.ts";

export type { WebSearchProviderId };

export { isWebSearchProviderId };

export function providerName(id: WebSearchProviderId): string {
	return WEB_SEARCH_PROVIDERS.find((p) => p.id === id)?.name ?? id;
}

export interface WebSearchConfig {
	readonly providerId: WebSearchProviderId;
	readonly apiKey: string;
}

/** 一条搜索结果。 */
export interface WebSearchResult {
	readonly title: string;
	readonly url: string;
	readonly description: string;
	/** 原始数据里的发布时间，形如 2026-09-01；服务商没给就是 undefined。 */
	readonly publishedAt?: string;
}

export interface WebSearchOptions {
	/** 单次返回条数。默认 5，上限 10（搜索结果越多越贵，够用就好）。 */
	readonly limit?: number;
	/** 超时毫秒。默认 10s。 */
	readonly timeoutMs?: number;
	/** 测试注入。 */
	readonly fetchImpl?: typeof fetch;
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const DEFAULT_TIMEOUT_MS = 10_000;

/** 服务商的响应形状各不相同，这里把「调完服务商」与「统一映射」分开。 */
interface RawResult {
	readonly title: string;
	readonly url: string;
	readonly description: string;
	readonly publishedAt?: string;
}

interface ProviderEndpoints {
	readonly providerId: WebSearchProviderId;
	readonly call: (
		query: string,
		limit: number,
		apiKey: string,
		fetchImpl: typeof fetch,
	) => Promise<RawResult[]>;
}

/** 从任意形状里安全取字符串字段。 */
function asString(value: unknown): string | undefined {
	return typeof value === "string" && value !== "" ? value : undefined;
}

async function callTavily(
	query: string,
	limit: number,
	apiKey: string,
	fetchImpl: typeof fetch,
): Promise<RawResult[]> {
	const response = await fetchImpl("https://api.tavily.com/search", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ api_key: apiKey, query, search_depth: "basic", max_results: limit }),
	});
	if (!response.ok) failureFromStatus(response.status, "Tavily");
	const data = (await response.json()) as { results?: unknown };
	const results = Array.isArray(data.results) ? data.results : [];
	return results.map((item) => {
		const record = item as Record<string, unknown>;
		return {
			title: asString(record.title) ?? "(无标题)",
			url: asString(record.url) ?? "(无链接)",
			// Tavily 的 content 是页面/摘要文本，是描述信息最好的来源。
			description: asString(record.content) ?? asString(record.snippet) ?? "",
			publishedAt: asString(record.published_date),
		};
	});
}

async function callBocha(
	query: string,
	limit: number,
	apiKey: string,
	fetchImpl: typeof fetch,
): Promise<RawResult[]> {
	const response = await fetchImpl("https://api.bochaai.com/v1/web-search", {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
		body: JSON.stringify({ query, count: limit, freshness: "noLimit", summary: false }),
	});
	if (!response.ok) failureFromStatus(response.status, "博查");
	/**
	 * 博查的语义**与直觉相反**：成功返回 HTTP 200 + `code: 200`（msg 为 null！），
	 * 失败返回 HTTP 200 + 业务码（如无额度 4010），key 无效则 HTTP 401。
	 * 全部是实测确认的形状（此前只认 code:0，把成功判成了"错误码 200"）。
	 */
	const data = (await response.json()) as {
		code?: unknown;
		msg?: unknown;
		message?: unknown;
		data?: Record<string, unknown>;
	};
	const isSuccess =
		data.code === 0 || data.code === "0" || data.code === 200 || data.code === "200";
	if (!isSuccess) {
		const code = data.code === undefined ? "" : String(data.code);
		const reason =
			asString(data.message) ?? asString(data.msg) ?? (code === "" ? "未知错误" : `错误码 ${code}`);
		// 博查用 401/403 语义的业务码也表达 key 无效：口径与 HTTP 401 保持一致，
		// 用户不用查表。
		if (data.code === 401 || data.code === "401" || data.code === 403 || data.code === "403") {
			throw new Error("博查 的 API Key 无效或已过期，请到设置页检查「联网搜索」配置");
		}
		throw new Error(`博查搜索失败：${reason}`);
	}
	const value = data.data?.webPages as Record<string, unknown> | undefined;
	const pages = Array.isArray(value?.value) ? value.value : [];
	return (pages as Record<string, unknown>[]).map((item) => ({
		title: asString(item.name) ?? "(无标题)",
		url: asString(item.url) ?? "(无链接)",
		description: asString(item.snippet) ?? "",
		publishedAt: asString(item.datePublished),
	}));
}

async function callBrave(
	query: string,
	limit: number,
	apiKey: string,
	fetchImpl: typeof fetch,
): Promise<RawResult[]> {
	const url = new URL("https://api.search.brave.com/res/v1/web/search");
	url.searchParams.set("q", query);
	url.searchParams.set("count", String(limit));
	const response = await fetchImpl(url, { headers: { "X-Subscription-Token": apiKey } });
	if (!response.ok) failureFromStatus(response.status, "Brave");
	const data = (await response.json()) as { web?: { results?: unknown } };
	const results = Array.isArray(data.web?.results) ? data.web.results : [];
	return results.map((item) => {
		const record = item as Record<string, unknown>;
		return {
			title: asString(record.title) ?? "(无标题)",
			url: asString(record.url) ?? "(无链接)",
			description: asString(record.description) ?? "",
			publishedAt: asString(record.age) ?? asString(record.datePublished),
		};
	});
}

async function callBing(
	query: string,
	limit: number,
	apiKey: string,
	fetchImpl: typeof fetch,
): Promise<RawResult[]> {
	const url = new URL("https://api.bing.microsoft.com/v7.0/search");
	url.searchParams.set("q", query);
	url.searchParams.set("count", String(limit));
	const response = await fetchImpl(url, { headers: { "Ocp-Apim-Subscription-Key": apiKey } });
	if (!response.ok) failureFromStatus(response.status, "Bing");
	const data = (await response.json()) as { webPages?: { value?: unknown } };
	const pages = Array.isArray(data.webPages?.value) ? data.webPages.value : [];
	return (pages as Record<string, unknown>[]).map((item) => ({
		title: asString(item.name) ?? "(无标题)",
		url: asString(item.url) ?? "(无链接)",
		description: asString(item.snippet) ?? "",
		publishedAt: asString(item.datePublished) ?? asString(item.dateLastCrawled),
	}));
}

function failureFromStatus(status: number, provider: string): never {
	// 401/403 大概率是 Key 的问题——把这条信息直接告诉使用者，别让它猜。
	if (status === 401 || status === 403) {
		throw new Error(`${provider} 的 API Key 无效或已过期，请到设置页检查「联网搜索」配置`);
	}
	if (status === 429) {
		throw new Error(`${provider} 请求过于频繁或额度用完，稍后再试`);
	}
	throw new Error(`${provider} 搜索失败：HTTP ${status}`);
}

const ENDPOINTS: Record<WebSearchProviderId, ProviderEndpoints> = {
	tavily: { providerId: "tavily", call: callTavily },
	bocha: { providerId: "bocha", call: callBocha },
	brave: { providerId: "brave", call: callBrave },
	bing: { providerId: "bing", call: callBing },
};

/**
 * 执行一次搜索。
 *
 * 缺 Key / 网络失败 / 服务商报错都会抛 Error（中文消息），
 * 工具层负责把消息回给模型并说明需要配置 —— 不在这层吞错误。
 */
export async function searchWeb(
	config: WebSearchConfig,
	query: string,
	options: WebSearchOptions = {},
): Promise<WebSearchResult[]> {
	const trimmed = query.trim();
	if (trimmed === "") throw new Error("搜索关键词不能为空");
	if (config.apiKey.trim() === "") {
		throw new Error(
			`尚未配置「${providerName(config.providerId)}」的 API Key，请到设置页「联网搜索」里填写`,
		);
	}

	const rawLimit = options.limit ?? DEFAULT_LIMIT;
	const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(rawLimit)));
	const fetchImpl = options.fetchImpl ?? fetch;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	const endpoint = ENDPOINTS[config.providerId];
	if (endpoint === undefined) throw new Error(`未知的搜索服务商：${config.providerId}`);

	// 服务商的四个 call 里都传 fetchImpl 而不是用全局 fetch（测试注入点）；
	// fetchImpl 包一层超时（与调用方给的 signal 双保险）。
	try {
		const raw = await endpoint.call(
			trimmed,
			limit,
			config.apiKey,
			timedFetch(fetchImpl, timeoutMs),
		);
		return raw.map((item) => ({ ...item }));
	} catch (error) {
		if (error instanceof DOMException && error.name === "TimeoutError") {
			throw new Error("搜索请求超时（10 秒），稍后重试或换一个更具体的关键词");
		}
		throw error;
	}
}

/** 给 fetch 叠加超时信号。传入的 fetchImpl 上没有 signal 时用 AbortSignal.timeout。 */
function timedFetch(fetchImpl: typeof fetch, timeoutMs: number): typeof fetch {
	return async (input, init) => {
		const signals: AbortSignal[] = [AbortSignal.timeout(timeoutMs)];
		if (init?.signal !== undefined && init.signal !== null) signals.push(init.signal);
		return fetchImpl(input, {
			...init,
			signal: signals.length === 1 ? signals[0]! : AbortSignal.any(signals),
		});
	};
}


/** 用给定条数补全搜索参数里的默认值；供扩展层复用。 */
export function clampLimit(value: number | undefined): number {
	if (value === undefined) return DEFAULT_LIMIT;
	return Math.max(1, Math.min(MAX_LIMIT, Math.floor(value)));
}

/** 导出常量供扩展层的参数 schema 描述使用（避免两处魔数）。 */
export const SEARCH_LIMIT_MAX = MAX_LIMIT;
export const SEARCH_LIMIT_DEFAULT = DEFAULT_LIMIT;
