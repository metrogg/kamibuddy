/**
 * 「引用来源」聚合（spec: add-search-sources-panel）：扫描会话里的 web_search
 * 工具卡，把各卡的 sources 按 URL 去重汇成一份清单（保留首次出现顺序）。
 * 纯函数模块：操作行「来源」按钮（chat-view.tsx）与 SourcesPanel 共用同一份
 * 聚合结果与 URL 推导，两个 UI 入口不会出现口径漂移。
 *
 * 只认 web_search 卡（WorkBuddy 同口径）：web_fetch 抓取的是模型主动点开的
 * 页面，不属于「调研来源」语义——即便卡上带了 sources 字段也不计入。
 */

import type { ConversationEntry, SourceRef } from "@shared/session-events.ts";

/**
 * 会话级来源清单：按 URL 去重（key=url），保留首次出现顺序。
 * 无来源返回空数组（调用方据此不渲染入口）。
 */
export function collectSources(entries: readonly ConversationEntry[]): readonly SourceRef[] {
	const seen = new Set<string>();
	const out: SourceRef[] = [];
	for (const entry of entries) {
		if (entry.role !== "tool" || entry.toolName !== "web_search") continue;
		// sources 缺席的卡（旧会话/提取失败）跳过——来源只是卡片的增强载荷。
		for (const source of entry.sources ?? []) {
			if (seen.has(source.url)) continue;
			seen.add(source.url);
			out.push(source);
		}
	}
	return out;
}

/**
 * 来源 URL 的派生信息：favicon 地址（`${origin}/favicon.ico`，WorkBuddy
 * 内联卡同款，不做本地缓存/不用第三方 favicon 服务）与 host
 * （site 字段缺席时的回退显示名）。按钮头像组与面板列表项共用。
 * URL 构造失败返回 undefined —— 调用方跳过该项（脏 URL 不上屏、不抛错）。
 */
export function sourceUrlMeta(url: string): { readonly favicon: string; readonly host: string } | undefined {
	try {
		const parsed = new URL(url);
		return { favicon: `${parsed.origin}/favicon.ico`, host: parsed.host };
	} catch {
		return undefined;
	}
}
