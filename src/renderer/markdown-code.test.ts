import { describe, expect, it } from "vitest";
import { codeLanguage, codeText } from "./markdown-code.ts";

describe("codeLanguage（围栏块语言显示名）", () => {
	it("language-ts → ts", () => {
		expect(codeLanguage("language-ts")).toBe("ts");
	});

	it("带高亮修饰类时只取 language-* 段", () => {
		expect(codeLanguage("language-js foo")).toBe("js");
	});

	it("language-* 不在首个类也能取到", () => {
		expect(codeLanguage("foo language-python")).toBe("python");
	});

	it("undefined → text", () => {
		expect(codeLanguage(undefined)).toBe("text");
	});

	it("无 language-* 类 → text", () => {
		expect(codeLanguage("hljs")).toBe("text");
	});

	it("空 language- 段 → text", () => {
		expect(codeLanguage("language-")).toBe("text");
	});
});

describe("codeText（复制用纯文本）", () => {
	it("string 原样返回", () => {
		expect(codeText("const a = 1;")).toBe("const a = 1;");
	});

	it("末尾单个换行是语法收尾，复制时不带", () => {
		expect(codeText("line1\nline2\n")).toBe("line1\nline2");
	});

	it("中间的换行保留", () => {
		expect(codeText("a\n\nb\n")).toBe("a\n\nb");
	});

	it("string 数组拼接", () => {
		expect(codeText(["const ", "a = 1;", "\n"])).toBe("const a = 1;");
	});

	it("嵌套元素节点递归取其 children", () => {
		const span = { props: { children: ["hello", " world"] } };
		expect(codeText(["x ", span, "\n"])).toBe("x hello world");
	});

	it("非文本节点（null / 数字）按空处理", () => {
		expect(codeText(null)).toBe("");
		expect(codeText(["a", null, 1, "b"])).toBe("ab");
	});
});
