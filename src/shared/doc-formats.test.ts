import { describe, expect, it } from "vitest";
import {
	LEGACY_DOC_EXTENSIONS,
	OFFICE_EXTENSIONS,
	PDF_EXTENSION,
	docBadgeOf,
	docKindOf,
} from "./doc-formats.ts";

describe("docKindOf", () => {
	it("pdf 归 pdf", () => {
		expect(docKindOf("报告.pdf")).toBe("pdf");
	});

	it("六种 office 扩展名归 office", () => {
		for (const name of ["a.docx", "a.xlsx", "a.pptx", "a.odt", "a.odp", "a.ods"]) {
			expect(docKindOf(name)).toBe("office");
		}
	});

	it(".doc/.xls/.ppt 归 legacy", () => {
		expect(docKindOf("a.doc")).toBe("legacy");
		expect(docKindOf("a.xls")).toBe("legacy");
		expect(docKindOf("a.ppt")).toBe("legacy");
	});

	it("大小写不敏感", () => {
		expect(docKindOf("报告.PDF")).toBe("pdf");
		expect(docKindOf("表格.DOCX")).toBe("office");
		expect(docKindOf("旧文档.DOC")).toBe("legacy");
	});

	it("无扩展名 / 其他扩展名归 unsupported", () => {
		expect(docKindOf("README")).toBe("unsupported");
		expect(docKindOf("README.md")).toBe("unsupported");
		expect(docKindOf("setup.exe")).toBe("unsupported");
	});

	it("带目录的路径只看最后一段（目录名里的点不算扩展名）", () => {
		expect(docKindOf("C:\\docs.name\\报表.xlsx")).toBe("office");
		expect(docKindOf("D:/dir.name/无扩展名")).toBe("unsupported");
	});

	it("段首的点不算扩展名（.hidden 按无扩展名处理）", () => {
		expect(docKindOf(".pdf")).toBe("unsupported");
	});

	it("导出的集合常量与判定结果自洽", () => {
		// 集合是三处消费方（renderer 分类 / main filters / doc-extract）共享的唯一来源，
		// 这里钉住"集合内容 == docKindOf 判定依据"，防两份真相。
		expect(docKindOf(`x${PDF_EXTENSION}`)).toBe("pdf");
		for (const ext of OFFICE_EXTENSIONS) expect(docKindOf(`x${ext}`)).toBe("office");
		for (const ext of LEGACY_DOC_EXTENSIONS) expect(docKindOf(`x${ext}`)).toBe("legacy");
	});
});

describe("docBadgeOf", () => {
	it("七种可收扩展名各归其族、各配其字标", () => {
		expect(docBadgeOf("报告.pdf")).toEqual({ family: "pdf", label: "PDF" });
		expect(docBadgeOf("文档.docx")).toEqual({ family: "word", label: "DOC" });
		expect(docBadgeOf("表格.xlsx")).toEqual({ family: "excel", label: "XLS" });
		expect(docBadgeOf("幻灯片.pptx")).toEqual({ family: "ppt", label: "PPT" });
		expect(docBadgeOf("文档.odt")).toEqual({ family: "word", label: "ODF" });
		expect(docBadgeOf("表格.ods")).toEqual({ family: "excel", label: "ODF" });
		expect(docBadgeOf("幻灯片.odp")).toEqual({ family: "ppt", label: "ODF" });
	});

	it("与 docKindOf 的口径自洽：收进来的（pdf/office）必有 badge", () => {
		// chip 条按 docKindOf 收文件、按 docBadgeOf 画图标——两者必须同集，
		// 否则会出现「收得进来但画不出」的chip。
		for (const name of ["a.pdf", "a.docx", "a.xlsx", "a.pptx", "a.odt", "a.odp", "a.ods"]) {
			expect(docBadgeOf(name), name).toBeDefined();
		}
		expect(docBadgeOf("a.doc")).toBeUndefined();
		expect(docBadgeOf("README.md")).toBeUndefined();
	});

	it("大小写与带目录路径不敏感（与 docKindOf 同一提取口径）", () => {
		expect(docBadgeOf("C:\\docs\\报表.XLSX")).toEqual({ family: "excel", label: "XLS" });
	});
});
