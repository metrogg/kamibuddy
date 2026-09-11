/**
 * web_search 的 result.details → 干净的 SourceRef[]（ToolCard.sources 的唯一来源）。
 *
 * 放 core 的理由与 todo-parse.ts 相同：「把不可信输入修成干净结构」是 daemon 侧
 * 的活，消费方只有 core 的两条路径 —— session-host（live：tool_execution_end
 * 的 result.details）与 session-rebuild（恢复：落盘 toolResult 的 details）。
 * renderer 只消费 shared 的 SourceRef 类型，永不调用本文件。
 *
 * 安全口径（对齐 WorkBuddy 的 isSafeWebSearchSourceUrl）：来源 URL 会进 UI 并可被
 * 点击外部打开，必须是公网 http/https —— 带凭据的 URL（打开即泄露 Basic 凭据）、
 * localhost / 内网 IP（本机/内网服务不该出现在搜索来源里）逐项剔除。
 * 内网 IP 判定复用 web-fetch.ts 的 isPrivateIpLiteral：来源与抓取同一口径。
 *
 * 防御口径（落盘 JSONL 可能是旧版/半截写入，details 形状不可信）：
 * - details.results 不是数组 → undefined（调用方让 sources 键缺席，卡片照常落成）；
 * - 单项缺 title/url、URL 解析失败、URL 不过安全校验 → 剔除该项，其余保留；
 * - 全部剔除完返回 [] —— 空数组是合法的「搜索无来源」，与「没有 details」的
 *   undefined 区分（同 parseTodoArgs 的空数组收尾语义）。
 * 永不抛错 —— 来源只是卡片的增强展示，不该被脏数据打断卡片落成。
 */

import type { SourceRef } from "../shared/session-events.ts";
import { isPrivateIpLiteral } from "./web-fetch.ts";

/**
 * 来源 URL 安全校验：通过则返回解析后的 URL（调用方取 host 推导 site），否则 undefined。
 * 规则：仅 http/https；拒绝带 username/password 凭据；拒绝 localhost 与内网字面 IP。
 * host 是普通域名时放行（不做 DNS 解析，与 web-fetch 的第一版口径一致）。
 */
function safeSourceUrl(rawUrl: string): URL | undefined {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return undefined;
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
	if (parsed.username !== "" || parsed.password !== "") return undefined;
	const host = parsed.hostname.toLowerCase();
	if (host === "" || host === "localhost" || host.endsWith(".localhost")) return undefined;
	if (isPrivateIpLiteral(host)) return undefined;
	return parsed;
}

export function parseSources(details: unknown): readonly SourceRef[] | undefined {
	if (typeof details !== "object" || details === null) return undefined;
	const { results } = details as Record<string, unknown>;
	if (!Array.isArray(results)) return undefined;
	const clean: SourceRef[] = [];
	for (const item of results) {
		if (typeof item !== "object" || item === null) continue;
		const record = item as Record<string, unknown>;
		if (typeof record.title !== "string" || record.title === "") continue;
		if (typeof record.url !== "string" || record.url === "") continue;
		const parsed = safeSourceUrl(record.url);
		if (parsed === undefined) continue;
		clean.push({
			title: record.title,
			url: record.url,
			// WebSearchResult.description → SourceRef.snippet；空串不占字段
			// （与 activeForm/images 的「空值键缺席」口径一致）。
			...(typeof record.description === "string" && record.description !== ""
				? { snippet: record.description }
				: {}),
			// publishedAt 不下发：SourceRef 没有该字段，UI 不展示。
			site: parsed.hostname.toLowerCase().replace(/^www\./, ""),
		});
	}
	return clean;
}
