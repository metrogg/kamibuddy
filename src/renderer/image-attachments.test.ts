import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES } from "@shared/image.ts";
import { classifyAttachment, foldDocumentRefsIntoText } from "./image-attachments.tsx";

/**
 * classifyAttachment 的用例。File 在 Node ≥20 有全局实现，
 * 分类是纯函数（不碰 window.kami），可脱离 Electron 单测。
 */

describe("classifyAttachment", () => {
	it("图片 MIME → image", () => {
		const file = new File(["x"], "截图.png", { type: "image/png" });
		expect(classifyAttachment(file)).toEqual({ kind: "image" });
	});

	it("空名剪贴板位图（截图）→ image，不误入文档流", () => {
		const file = new File(["x"], "", { type: "image/png" });
		expect(classifyAttachment(file)).toEqual({ kind: "image" });
	});

	it("图片 MIME 但超过 5MB → reject", () => {
		const file = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "big.png", { type: "image/png" });
		const cls = classifyAttachment(file);
		expect(cls.kind).toBe("reject");
		expect(cls).toMatchObject({ reason: expect.stringContaining("超过 5MB 上限") });
	});

	it("pdf / office 扩展名 → document（不读内容，只取路径）", () => {
		expect(classifyAttachment(new File(["x"], "报告.pdf", { type: "application/pdf" }))).toEqual({ kind: "document" });
		expect(classifyAttachment(new File(["x"], "数据.xlsx", { type: "" }))).toEqual({ kind: "document" });
		expect(classifyAttachment(new File(["x"], "幻灯片.PPTX", { type: "" }))).toEqual({ kind: "document" });
	});

	it("老格式 .doc/.xls/.ppt → reject 提示另存", () => {
		const cls = classifyAttachment(new File(["x"], "旧文档.doc", { type: "" }));
		expect(cls.kind).toBe("reject");
		expect(cls).toMatchObject({ reason: expect.stringContaining("另存为 .docx/.xlsx/.pptx") });
	});

	it("不支持的格式 → reject（文案同时列出图片与文档支持面）", () => {
		const cls = classifyAttachment(new File(["x"], "笔记.md", { type: "text/markdown" }));
		expect(cls.kind).toBe("reject");
		expect(cls).toMatchObject({ reason: expect.stringContaining("不支持的文件格式") });
	});

	it("svg：MIME 是 image/* 但不在白名单，扩展名也不支持 → reject", () => {
		const cls = classifyAttachment(new File(["x"], "图标.svg", { type: "image/svg+xml" }));
		expect(cls.kind).toBe("reject");
	});

	it("MIME 优先于扩展名：图片 MIME 的文件不会因扩展名误入文档流", () => {
		// 拖放源给的文件名未必可信；截图工具偶尔给出带扩展名的位图。
		const file = new File(["x"], "clip.pdf", { type: "image/png" });
		expect(classifyAttachment(file)).toEqual({ kind: "image" });
	});
});

describe("foldDocumentRefsIntoText", () => {
	it("refs 为空 → 原文返回（不添一个字符）", () => {
		expect(foldDocumentRefsIntoText("帮我看看", [])).toBe("帮我看看");
	});

	it("单个 ref：追加一行 @路径", () => {
		const out = foldDocumentRefsIntoText("分析这份报告", [{ path: "C:\\docs\\报告.pdf", name: "报告.pdf" }]);
		expect(out).toBe("分析这份报告\n@C:\\docs\\报告.pdf");
	});

	it("多个 refs：各占一行，保持入列顺序", () => {
		const out = foldDocumentRefsIntoText("对比一下", [
			{ path: "D:/data/一.xlsx", name: "一.xlsx" },
			{ path: "D:/data/二.xlsx", name: "二.xlsx" },
		]);
		expect(out).toBe("对比一下\n@D:/data/一.xlsx\n@D:/data/二.xlsx");
	});

	it("text 为空：不出前导换行", () => {
		const out = foldDocumentRefsIntoText("", [{ path: "C:\\a.pptx", name: "a.pptx" }]);
		expect(out).toBe("@C:\\a.pptx");
	});
});
