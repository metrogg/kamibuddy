import { describe, expect, it } from "vitest";
import type { ConversationEntry } from "./session-events.ts";
import {
	changeFromEdit,
	changeFromWrite,
	classifyPresentedFiles,
	collectChanges,
	computeLineDiff,
	diffLineStats,
	mergePresentedArtifacts,
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
		).toEqual({
			path: "a.html",
			added: 1,
			removed: 1,
			changeType: "modified",
			diff: "@@ -1,3 +1,3 @@\n l1\n-l2\n+NEW\n l3",
		});
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
		).toEqual({
			path: "a.ts",
			added: 2,
			removed: 1,
			changeType: "modified",
			diff: "@@ -1,3 +1,4 @@\n a\n-b\n+x\n+y\n c",
		});
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

describe("computeLineDiff", () => {
	it("改一行 → 统计 1/1 且产出 unified hunk（3 行上下文）", () => {
		const r = computeLineDiff("a\nb\nc", "a\nx\nc");
		expect(r.added).toBe(1);
		expect(r.removed).toBe(1);
		expect(r.diff).toBe("@@ -1,3 +1,3 @@\n a\n-b\n+x\n c");
	});

	it("两处改动相距超过上下文窗口 → 拆成两个 hunk", () => {
		const oldText = "l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9";
		const newText = "L1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nL9";
		const r = computeLineDiff(oldText, newText);
		expect(r.added).toBe(2);
		expect(r.removed).toBe(2);
		expect(r.diff?.match(/@@ -\d+,\d+ \+\d+,\d+ @@/g)).toHaveLength(2);
	});

	it("全量替换 → 一个 hunk 全删全增", () => {
		const r = computeLineDiff("a\nb", "x\ny");
		expect(r.diff).toBe("@@ -1,2 +1,2 @@\n-a\n-b\n+x\n+y");
	});

	it("超预算 → 有统计无 diff 文本（徽章照显，面板给回落文案）", () => {
		const oldText = Array.from({ length: 3000 }, (_, i) => `o${i}`).join("\n");
		const newText = Array.from({ length: 3000 }, (_, i) => `n${i}`).join("\n");
		const r = computeLineDiff(oldText, newText);
		expect(r.added).toBe(3000);
		expect(r.diff).toBeUndefined();
	});
});

describe("collectChanges", () => {
	const tool = (over: Partial<Extract<ConversationEntry, { role: "tool" }>>): ConversationEntry => ({
		id: Math.random().toString(36).slice(2),
		role: "tool",
		toolName: "write",
		label: "已生成",
		summary: "",
		outcome: "ok",
		detail: undefined,
		at: 1,
		...over,
	});

	it("write/edit 成功卡片按路径收成一条；生成中与失败的卡不算", () => {
		const r = collectChanges([
			tool({ change: { path: "a.html", added: 10, removed: 0, changeType: "created" }, at: 1 }),
			tool({ toolName: "edit", change: { path: "b.ts", added: 2, removed: 1, changeType: "modified" }, at: 2 }),
			tool({ outcome: undefined, generating: true, change: { path: "c.md", added: 5, removed: 0, changeType: "created" } }),
			tool({ outcome: "error", change: { path: "d.md", added: 1, removed: 0, changeType: "created" } }),
		]);
		expect(r.map((c) => c.path)).toEqual(["a.html", "b.ts"]);
	});

	it("同一路径多次改只留最后一次（变更列表是文件的当前状态）", () => {
		const r = collectChanges([
			tool({ change: { path: "a.html", added: 10, removed: 0, changeType: "created" }, at: 1 }),
			tool({ change: { path: "a.html", added: 3, removed: 2, changeType: "modified", diff: "@@ -1,1 +1,1 @@\n-x\n+y" }, at: 3 }),
		]);
		expect(r).toHaveLength(1);
		expect(r[0]).toMatchObject({ changeType: "modified", added: 3, removed: 2, at: 3 });
	});
});

describe("classifyPresentedFiles", () => {
	const sizeOf = (p: string) => (p.includes("big") ? 7460 : "outside" as const);

	it("绝对路径 → 产物卡；第一个本地文件成为 focusFile", () => {
		const r = classifyPresentedFiles(["E:/w/snake.html", "E:/w/readme.md"], sizeOf);
		expect(r.files).toEqual([
			{ path: "E:/w/snake.html", size: 0, html: true, kind: "local" },
			{ path: "E:/w/readme.md", size: 0, html: false, kind: "local" },
		]);
		expect(r.focusFile).toBe("E:/w/snake.html");
		expect(r.invalid).toEqual([]);
		expect(r.missing).toEqual([]);
	});

	it("http(s) URL → 只进列表不自动打开；URL 在前时 focus 落到后一个本地文件", () => {
		const r = classifyPresentedFiles(["https://example.com/x", "E:/w/a.md"], sizeOf);
		expect(r.files[0]).toEqual({ path: "https://example.com/x", size: 0, html: false, kind: "url" });
		expect(r.focusFile).toBe("E:/w/a.md");
		expect(r.missing).toEqual([]);
	});

	it("非绝对路径 → invalid（调用方整单报错）", () => {
		const r = classifyPresentedFiles(["readme.md", "E:/w/ok.md"], sizeOf);
		expect(r.invalid).toEqual(["readme.md"]);
		expect(r.files).toHaveLength(1);
	});

	it("file:// / javascript: / data: 都进 invalid（不匹配绝对路径/HTTP）", () => {
		const r = classifyPresentedFiles(
			["file:///E:/w/a.html", "javascript:alert(1)", "data:text/html,<h1>x</h1>"],
			sizeOf,
		);
		expect(r.invalid).toEqual(["file:///E:/w/a.html", "javascript:alert(1)", "data:text/html,<h1>x</h1>"]);
		expect(r.files).toHaveLength(0);
	});

	it("sizeOf 的结果进入 size；Windows 反斜杠路径同样认绝对", () => {
		const r = classifyPresentedFiles(["E:\\w\\big.html"], sizeOf);
		expect(r.files[0]).toEqual({ path: "E:\\w\\big.html", size: 7460, html: true, kind: "local" });
	});

	it("missing 只在 sizeOf 返回 missing 时产生；outside 与 URL 不算缺失", () => {
		const probe = (p: string) =>
			p.includes("gone") ? ("missing" as const) : p.includes("out") ? ("outside" as const) : 100;
		const r = classifyPresentedFiles(
			["E:/w/gone.md", "E:/w/out.md", "https://example.com/x"],
			probe,
		);
		expect(r.missing).toEqual(["E:/w/gone.md"]);
		expect(r.files.map((f) => f.size)).toEqual([0, 0, 0]);
	});
});

describe("mergePresentedArtifacts", () => {
	it("多次交付按路径去重，后交付的排到末尾", () => {
		const first = mergePresentedArtifacts([], [{ path: "a.html", size: 1, html: true, kind: "local" }], 100);
		const second = mergePresentedArtifacts(
			first,
			[
				{ path: "b.md", size: 2, html: false, kind: "local" },
				{ path: "a.html", size: 3, html: true, kind: "local" },
			],
			200,
		);
		expect(second).toEqual([
			{ path: "b.md", size: 2, at: 200 },
			{ path: "a.html", size: 3, at: 200 },
		]);
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
