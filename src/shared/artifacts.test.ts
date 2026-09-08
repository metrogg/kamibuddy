import { describe, expect, it } from "vitest";
import type { ConversationEntry } from "./session-events.ts";
import {
	changeFromEdit,
	changeFromWrite,
	collectArtifacts,
	diffLineStats,
	writeStreamProgress,
} from "./artifacts.ts";

describe("diffLineStats", () => {
	it("空旧内容（新文件）→ 全 added", () => {
		expect(diffLineStats("", "l1\nl2\nl3")).toEqual({ added: 3, removed: 0 });
	});

	it("内容相同 → 0/0", () => {
		expect(diffLineStats("a\nb", "a\nb")).toEqual({ added: 0, removed: 0 });
	});

	it("改一行 → 1/1（LCS 口径：公共行不算增删）", () => {
		expect(diffLineStats("a\nb\nc", "a\nx\nc")).toEqual({ added: 1, removed: 1 });
	});

	it("整体替换 → 全删全增", () => {
		expect(diffLineStats("a\nb", "x\ny\nz")).toEqual({ added: 3, removed: 2 });
	});

	it("中间插入 → 只算新增", () => {
		expect(diffLineStats("a\nc", "a\nb\nc")).toEqual({ added: 1, removed: 0 });
	});

	it("中间删除 → 只算删除", () => {
		expect(diffLineStats("a\nb\nc", "a\nc")).toEqual({ added: 0, removed: 1 });
	});

	it("超过 LCS 预算上限 → 退化为全量口径（不卡死 UI）", () => {
		const oldText = Array.from({ length: 3000 }, (_, i) => `o${i}`).join("\n");
		const newText = Array.from({ length: 3000 }, (_, i) => `n${i}`).join("\n");
		// 3000×3000 = 9M 格 > 上限，退化为 added=新行数 / removed=旧行数。
		expect(diffLineStats(oldText, newText)).toEqual({ added: 3000, removed: 3000 });
	});
});

describe("changeFromWrite", () => {
	it("旧内容 undefined（新文件）→ created，added = content 行数", () => {
		expect(changeFromWrite({ path: "a.html", content: "l1\nl2\nl3" }, undefined)).toEqual({
			path: "a.html",
			added: 3,
			removed: 0,
			changeType: "created",
		});
	});

	it("有旧内容（覆盖已有文件）→ modified，真实 diff（WorkBuddy checkpoint 同口径）", () => {
		// 旧 3 行改成 3 行但只动中间行：+1 -1 而不是 +3 -0（args 口径的失真点）。
		expect(
			changeFromWrite({ path: "a.html", content: "l1\nNEW\nl3" }, "l1\nl2\nl3"),
		).toEqual({ path: "a.html", added: 1, removed: 1, changeType: "modified" });
	});

	it("空 content 新文件 → created，0/0", () => {
		expect(changeFromWrite({ path: "a.txt", content: "" }, undefined)).toEqual({
			path: "a.txt",
			added: 0,
			removed: 0,
			changeType: "created",
		});
	});

	it("参数形状不符 → undefined（不猜、不崩）", () => {
		expect(changeFromWrite(undefined, undefined)).toBeUndefined();
		expect(changeFromWrite({ path: 1 }, undefined)).toBeUndefined();
		expect(changeFromWrite({ path: "a", content: 2 }, undefined)).toBeUndefined();
	});
});

describe("changeFromEdit", () => {
	it("恒 modified；旧内容可应用 edits → 真实 diff", () => {
		expect(
			changeFromEdit(
				{ path: "a.ts", edits: [{ oldText: "b", newText: "x\ny" }] },
				"a\nb\nc",
			),
		).toEqual({ path: "a.ts", added: 2, removed: 1, changeType: "modified" });
	});

	it("旧内容缺失或 oldText 对不上 → 退化为 oldText/newText 行数求和", () => {
		expect(
			changeFromEdit(
				{
					path: "a.ts",
					edits: [
						{ oldText: "x", newText: "x\ny" },
						{ oldText: "p\nq\nr", newText: "" },
					],
				},
				undefined,
			),
		).toEqual({ path: "a.ts", added: 2, removed: 4, changeType: "modified" });
	});

	it("edits 为空数组 → 0/0；形状不符 → undefined", () => {
		expect(changeFromEdit({ path: "a", edits: [] }, undefined)).toEqual({
			path: "a",
			added: 0,
			removed: 0,
			changeType: "modified",
		});
		expect(changeFromEdit({ path: "a" }, undefined)).toBeUndefined();
		expect(changeFromEdit({ edits: [] }, undefined)).toBeUndefined();
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
			tool({ change: { path: "a.html", added: 10, removed: 0, changeType: "created" } }),
			tool({ toolName: "read", change: undefined }),
			tool({ outcome: "error", change: { path: "b.txt", added: 1, removed: 0, changeType: "created" } }),
		]);
		expect(r.map((a) => a.path)).toEqual(["a.html"]);
	});

	it("同一路径多次写只留最后一次（产物是当前状态，不是历史）", () => {
		const r = collectArtifacts([
			tool({ change: { path: "a.html", added: 1, removed: 0, changeType: "created" }, at: 1 }),
			tool({ change: { path: "b.md", added: 1, removed: 0, changeType: "created" }, at: 2 }),
			tool({ change: { path: "a.html", added: 5, removed: 0, changeType: "modified" }, at: 3 }),
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
