import { describe, expect, it } from "vitest";
import type { ConversationEntry, SourceRef, ToolCard } from "@shared/session-events.ts";
import { collectSources } from "./collect-sources.ts";

function searchCard(id: string, over: Partial<ToolCard> = {}): ToolCard {
	return {
		id,
		role: "tool",
		toolName: "web_search",
		label: "联网搜索",
		summary: "",
		outcome: "ok",
		detail: undefined,
		at: 1000,
		...over,
	};
}

function userEntry(id: string): ConversationEntry {
	return { id, role: "user", text: `消息 ${id}`, at: 1 };
}

const SRC_A1: SourceRef = { title: "甲站一", url: "https://a.example/1", snippet: "甲一摘要", site: "a.example" };
const SRC_B1: SourceRef = { title: "乙站一", url: "https://b.example/1", snippet: "乙一摘要", site: "b.example" };
const SRC_C1: SourceRef = { title: "丙站一", url: "https://c.example/1", site: "c.example" };

describe("collectSources：聚合与去重", () => {
	it("跨卡聚合：多张 web_search 卡的 sources 合并", () => {
		const entries: ConversationEntry[] = [
			userEntry("u1"),
			searchCard("s1", { sources: [SRC_A1, SRC_B1] }),
			searchCard("s2", { sources: [SRC_C1] }),
		];
		expect(collectSources(entries)).toEqual([SRC_A1, SRC_B1, SRC_C1]);
	});

	it("按 URL 去重：重复 URL 只保留首次出现的那条（引用原样）", () => {
		const dup: SourceRef = { ...SRC_B1, title: "乙站一（另一次搜索的重复）" };
		const entries: ConversationEntry[] = [
			searchCard("s1", { sources: [SRC_A1, SRC_B1] }),
			searchCard("s2", { sources: [dup, SRC_C1] }),
		];
		const result = collectSources(entries);
		expect(result).toEqual([SRC_A1, SRC_B1, SRC_C1]);
		expect(result[1]).toBe(SRC_B1);
	});

	it("保序：顺序 = 首次出现顺序（跨卡）", () => {
		const entries: ConversationEntry[] = [
			searchCard("s1", { sources: [SRC_C1, SRC_A1] }),
			searchCard("s2", { sources: [SRC_B1, SRC_C1] }),
		];
		expect(collectSources(entries).map((s) => s.url)).toEqual([
			"https://c.example/1",
			"https://a.example/1",
			"https://b.example/1",
		]);
	});
});

describe("collectSources：口径与边界", () => {
	it("web_fetch 卡不计入（即使带 sources 字段）", () => {
		const entries: ConversationEntry[] = [
			searchCard("s1", { sources: [SRC_A1] }),
			searchCard("f1", { toolName: "web_fetch", label: "抓取网页", sources: [SRC_B1] }),
		];
		expect(collectSources(entries)).toEqual([SRC_A1]);
	});

	it("空会话返回空数组", () => {
		expect(collectSources([])).toEqual([]);
	});

	it("无搜索卡的会话返回空数组", () => {
		expect(collectSources([userEntry("u1")])).toEqual([]);
	});

	it("sources 缺席的卡跳过，不影响其余卡", () => {
		const entries: ConversationEntry[] = [
			searchCard("s1"),
			searchCard("s2", { sources: [] }),
			searchCard("s3", { sources: [SRC_A1] }),
		];
		expect(collectSources(entries)).toEqual([SRC_A1]);
	});
});
