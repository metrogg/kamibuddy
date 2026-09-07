import { describe, expect, it } from "vitest";
import { applyCompletion, completionTrigger, filterItems, type CompletionItem } from "./autocomplete.ts";

const cur = (text: string, position = text.length) => ({ text, position });

describe("completionTrigger", () => {
	it("整段文本以 / 开头 → 命令补全，query 为命令名片段", () => {
		expect(completionTrigger(cur("/sk"))).toEqual({ kind: "command", query: "sk", start: 0 });
	});

	it("/ 后已输入空格（开始输参数）→ 不再补命令名", () => {
		expect(completionTrigger(cur("/skill:doc 参数"))).toBeUndefined();
	});

	it("/ 出现在文本中间 → 不是命令（是路径）", () => {
		expect(completionTrigger(cur("看看 src/main.ts"))).toBeUndefined();
		expect(completionTrigger(cur("路径 a/b"))).toBeUndefined();
	});

	it("@ 在行首 → 文件补全", () => {
		expect(completionTrigger(cur("@src"))).toEqual({ kind: "file", query: "src", start: 0 });
	});

	it("@ 前面是空格 → 文件补全", () => {
		expect(completionTrigger(cur("分析 @docs", 9))).toEqual({ kind: "file", query: "docs", start: 3 });
	});

	it("@ 前紧贴非空白（邮箱 / decorator）→ 不触发", () => {
		expect(completionTrigger(cur("a@b"))).toBeUndefined();
		expect(completionTrigger(cur("@Component".replace("@", "x@")))).toBeUndefined();
	});

	it("@ 后已输入空格 → 不再补全", () => {
		expect(completionTrigger(cur("@docs readme"))).toBeUndefined();
	});

	it("光标在文本中间时，只看光标前的内容", () => {
		// 光标在 @do 之后、c 之前：仍应识别 @do
		expect(completionTrigger({ text: "@doc c", position: 4 })).toEqual({ kind: "file", query: "doc", start: 0 });
	});

	it("普通文本 → undefined", () => {
		expect(completionTrigger(cur("你好"))).toBeUndefined();
		expect(completionTrigger(cur(""))).toBeUndefined();
	});
});

describe("applyCompletion", () => {
	it("替换触发片段并补空格，光标落在插入内容后", () => {
		const q = completionTrigger(cur("@src"))!;
		const next = applyCompletion(cur("@src"), q, { label: "src/main.ts", insert: "@src/main.ts" });
		expect(next.text).toBe("@src/main.ts ");
		expect(next.position).toBe(next.text.length);
	});

	it("保留触发片段之后已存在的文本", () => {
		const cursor = { text: "分析 @do 结尾", position: 6 };
		const q = completionTrigger(cursor)!;
		const next = applyCompletion(cursor, q, { label: "docs", insert: "@docs" });
		expect(next.text).toBe("分析 @docs  结尾");
	});

	it("命令补全：/ 替换为完整命令名", () => {
		const q = completionTrigger(cur("/sk"))!;
		const next = applyCompletion(cur("/sk"), q, { label: "skill:docx", insert: "/skill:docx" });
		expect(next.text).toBe("/skill:docx ");
	});
});

describe("filterItems", () => {
	const items: CompletionItem[] = [
		{ label: "src/main.ts", insert: "@src/main.ts" },
		{ label: "src/main-view.ts", insert: "@src/main-view.ts" },
		{ label: "docs/main.md", insert: "@docs/main.md" },
		{ label: "readme.md", insert: "@readme.md" },
	];

	it("空 query → 取前一页，不过滤", () => {
		expect(filterItems(items, "", 2)).toHaveLength(2);
	});

	it("子串过滤", () => {
		const r = filterItems(items, "main");
		expect(r.map((i) => i.label)).toContain("src/main.ts");
		expect(r.map((i) => i.label)).not.toContain("readme.md");
	});

	it("大小写不敏感", () => {
		expect(filterItems(items, "MAIN").length).toBeGreaterThan(0);
	});

	it("前缀命中排在中间命中之前", () => {
		const r = filterItems(items, "main");
		// docs/main.md 的 main 在第 5 位，src/main.ts 在第 4 位 —— src 更靠前
		expect(r[0]!.label).toBe("src/main.ts");
	});

	it("无命中 → 空数组", () => {
		expect(filterItems(items, "zzz")).toEqual([]);
	});

	it("limit 生效", () => {
		expect(filterItems(items, "main", 2)).toHaveLength(2);
	});
});
