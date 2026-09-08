import { describe, expect, it } from "vitest";
import type { ConversationEntry } from "./session-events.ts";
import {
	changeFromEditArgs,
	changeFromWriteArgs,
	collectArtifacts,
	writeStreamProgress,
} from "./artifacts.ts";

describe("changeFromWriteArgs", () => {
	it("{path, content} → added = content 行数，removed = 0", () => {
		expect(changeFromWriteArgs({ path: "a.html", content: "l1\nl2\nl3" })).toEqual({
			path: "a.html",
			added: 3,
			removed: 0,
		});
	});

	it("空 content → added 0", () => {
		expect(changeFromWriteArgs({ path: "a.txt", content: "" })).toEqual({
			path: "a.txt",
			added: 0,
			removed: 0,
		});
	});

	it("参数形状不符 → undefined（不猜、不崩）", () => {
		expect(changeFromWriteArgs(undefined)).toBeUndefined();
		expect(changeFromWriteArgs({ path: 1 })).toBeUndefined();
		expect(changeFromWriteArgs({ path: "a", content: 2 })).toBeUndefined();
	});
});

describe("changeFromEditArgs", () => {
	it("{path, edits:[{oldText,newText}]} → added/removed 为各 edit 行数之和", () => {
		expect(
			changeFromEditArgs({
				path: "a.ts",
				edits: [
					{ oldText: "x", newText: "x\ny" },
					{ oldText: "p\nq\nr", newText: "" },
				],
			}),
		).toEqual({ path: "a.ts", added: 2, removed: 4 });
	});

	it("edits 为空数组 → 0/0；形状不符 → undefined", () => {
		expect(changeFromEditArgs({ path: "a", edits: [] })).toEqual({ path: "a", added: 0, removed: 0 });
		expect(changeFromEditArgs({ path: "a" })).toBeUndefined();
		expect(changeFromEditArgs({ edits: [] })).toBeUndefined();
	});
});

describe("collectArtifacts", () => {
	const tool = (over: Partial<Extract<ConversationEntry, { role: "tool" }>>): ConversationEntry => ({
		id: Math.random().toString(36).slice(2),
		role: "tool",
		toolName: "write",
		label: "写入文件",
		summary: "",
		outcome: "ok",
		detail: undefined,
		at: 1,
		...over,
	});

	it("只收 write 且成功的卡片；read、失败 write 都不算产物", () => {
		const r = collectArtifacts([
			tool({ change: { path: "a.html", added: 10, removed: 0 } }),
			tool({ toolName: "read", change: undefined }),
			tool({ outcome: "error", change: { path: "b.txt", added: 1, removed: 0 } }),
		]);
		expect(r.map((a) => a.path)).toEqual(["a.html"]);
	});

	it("同一路径多次写只留最后一次（产物是当前状态，不是历史）", () => {
		const r = collectArtifacts([
			tool({ change: { path: "a.html", added: 1, removed: 0 }, at: 1 }),
			tool({ change: { path: "b.md", added: 1, removed: 0 }, at: 2 }),
			tool({ change: { path: "a.html", added: 5, removed: 0 }, at: 3 }),
		]);
		expect(r.map((a) => a.path)).toEqual(["b.md", "a.html"]);
		expect(r.find((a) => a.path === "a.html")?.at).toBe(3);
	});

	it("非工具条目与无 change 的工具卡片被忽略", () => {
		const r = collectArtifacts([
			{ id: "u1", role: "user", text: "hi", at: 0 },
			tool({ toolName: "bash" }),
		]);
		expect(r).toEqual([]);
	});
});

describe("writeStreamProgress", () => {
	it("路径已完整、content 正在流式 → 返回 path 与当前行数", () => {
		const raw = '{"path": "game/snake.html", "content": "<html>\\n<body>\\n贪吃';
		expect(writeStreamProgress(raw)).toEqual({ path: "game/snake.html", added: 3 });
	});

	it("路径还没写完 → path undefined，行数 0（还不到显示卡片的时机）", () => {
		expect(writeStreamProgress('{"path": "gam')).toEqual({ path: undefined, added: 0 });
	});

	it("content 为空片段 → 0 行", () => {
		expect(writeStreamProgress('{"path": "a.md", "content": "')).toEqual({ path: "a.md", added: 0 });
	});

	it("路径含转义字符 → 反转义", () => {
		const raw = '{"path": "a\\"b\\\\c.html", "content": "x\\ny"}';
		// content 片段是 x\ny（JSON 转义的换行）→ 真实内容 2 行。
		expect(writeStreamProgress(raw)).toEqual({ path: 'a"b\\c.html', added: 2 });
	});

	it("非预期文本 → 安全兜底", () => {
		expect(writeStreamProgress("")).toEqual({ path: undefined, added: 0 });
		expect(writeStreamProgress('{"foo": 1}')).toEqual({ path: undefined, added: 0 });
	});
});
