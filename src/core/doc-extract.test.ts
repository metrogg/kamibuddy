/**
 * doc-extract 的测试。
 *
 * fixtures 由 scripts/gen-doc-fixtures.ts 生成并入库（重生成方法见脚本头注释），
 * 测试直接读库内文件；两个 24k 截断用例的长文档在测试时现生成（不入库，
 * 避免仓库里躺几十 KB 的 filler 文件）。
 *
 * 断言一律先压平空白再比对：pdfjs / officeparser 都会引入换行与分词差异，
 * 逐字相等是过度约束，"原句在提取结果里"才是要钉住的合同（中文无乱码）。
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it, vi } from "vitest";

import type { DocExtractErrorCode } from "./doc-extract.ts";
import { DocExtractError, detectDocKind, extractDocument } from "./doc-extract.ts";

// vi.mock 是文件级 hoisted：importOriginal 保留真实模块，只把 getDocument 包成
// vi.fn（默认仍调原实现）。加密/损坏两个用例用 mockReturnValueOnce 单次拦截，
// 其余走真实 pdfjs 的用例不受影响。
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", async (importOriginal) => {
	const original = await importOriginal<typeof import("pdfjs-dist/legacy/build/pdf.mjs")>();
	return { ...original, getDocument: vi.fn(original.getDocument) };
});

const mockedGetDocument = vi.mocked(getDocument);

/** 造一个 promise 拒绝的 loadingTask：readPdfPages 的打开失败分支只碰 promise 字段。 */
function rejectingLoadingTask(err: Error): ReturnType<typeof getDocument> {
	return { promise: Promise.reject(err) } as unknown as ReturnType<typeof getDocument>;
}

const FIXTURE_DIR = fileURLToPath(new URL("./test-fixtures/docs", import.meta.url));
const fixture = (name: string): string => `${FIXTURE_DIR}/${name}`;

const squash = (s: string): string => s.replace(/\s+/g, "");

/** 断言 extractDocument 抛出指定 code 的 DocExtractError，返回错误供进一步断言文案。 */
async function expectExtractError(path: string, code: DocExtractErrorCode): Promise<DocExtractError> {
	try {
		await extractDocument(path);
	} catch (err) {
		if (!(err instanceof DocExtractError)) throw err;
		expect(err.code).toBe(code);
		return err;
	}
	throw new Error(`预期 extractDocument(${path}) 抛出 DocExtractError(${code})，实际正常返回`);
}

describe("detectDocKind", () => {
	it("六种 office 扩展名归 office", () => {
		for (const name of ["a.docx", "a.xlsx", "a.pptx", "a.odt", "a.odp", "a.ods"]) {
			expect(detectDocKind(name)).toEqual({ kind: "office" });
		}
	});

	it("pdf 归 pdf", () => {
		expect(detectDocKind("报告.pdf")).toEqual({ kind: "pdf" });
	});

	it(".doc/.xls/.ppt 归 legacy 并带扩展名", () => {
		expect(detectDocKind("a.doc")).toEqual({ kind: "legacy", ext: ".doc" });
		expect(detectDocKind("a.xls")).toEqual({ kind: "legacy", ext: ".xls" });
		expect(detectDocKind("a.ppt")).toEqual({ kind: "legacy", ext: ".ppt" });
	});

	it(".md/.exe 等未知扩展名归 unsupported", () => {
		expect(detectDocKind("README.md")).toEqual({ kind: "unsupported", ext: ".md" });
		expect(detectDocKind("setup.exe")).toEqual({ kind: "unsupported", ext: ".exe" });
	});

	it("大小写不敏感", () => {
		expect(detectDocKind("报告.PDF")).toEqual({ kind: "pdf" });
		expect(detectDocKind("表格.DOCX")).toEqual({ kind: "office" });
		expect(detectDocKind("旧文档.DOC")).toEqual({ kind: "legacy", ext: ".doc" });
	});
});

describe("PDF 提取", () => {
	it("cn-text.pdf：中文无乱码，两页页标齐全", async () => {
		const result = await extractDocument(fixture("cn-text.pdf"));
		expect(result.totalPages).toBe(2);
		expect(result.truncated).toBe(false);
		expect(result.nextOffset).toBeUndefined();
		expect(result.text).toContain("--- 第 1 页 ---");
		expect(result.text).toContain("--- 第 2 页 ---");
		const flat = squash(result.text);
		expect(flat).toContain(squash("2026年第三季度经营分析报告"));
		expect(flat).toContain(squash("华东区新客户拓展"));
		expect(flat).toContain(squash("研发部"));
		expect(flat).toContain(squash("市场部"));
	});

	it("cn-cid.pdf：CID-keyed 不嵌字体中文正确提取（钉住 cMapUrl 姿势）", async () => {
		// 这是真实中文 PDF 的主流形态；不配 cMapUrl 时 pdfjs 输出空串（spike 负面对照实证）。
		const result = await extractDocument(fixture("cn-cid.pdf"));
		expect(squash(result.text)).toContain(squash("中文乱码验证：独立字体不嵌入也能正确提取"));
	});

	it("scanned.pdf：无文本层报 scanned", async () => {
		const err = await expectExtractError(fixture("scanned.pdf"), "scanned");
		expect(err.message).toContain("没有文本层");
	});

	it("offset=99 越界：返回带有效范围的文案，不抛错", async () => {
		const result = await extractDocument(fixture("cn-text.pdf"), 99);
		expect(result.text).toContain("超出范围");
		expect(result.text).toContain("共 2 页");
		expect(result.truncated).toBe(false);
		expect(result.totalPages).toBe(2);
	});

	it("limit=1 只出第 1 页，附续读引导", async () => {
		const result = await extractDocument(fixture("cn-text.pdf"), 1, 1);
		expect(result.text).toContain("--- 第 1 页 ---");
		expect(result.text).not.toContain("--- 第 2 页 ---");
		expect(squash(result.text)).toContain(squash("2026年第三季度经营分析报告"));
		expect(squash(result.text)).not.toContain(squash("研发部"));
		expect(result.truncated).toBe(true);
		expect(result.nextOffset).toBe(2);
		expect(result.text).toContain("[共 2 页，已显示第 1-1 页。继续读请用 offset=2]");
	});

	it("offset=2 从第 2 页开始读", async () => {
		const result = await extractDocument(fixture("cn-text.pdf"), 2);
		expect(squash(result.text)).toContain(squash("研发部"));
		expect(squash(result.text)).not.toContain(squash("2026年第三季度经营分析报告"));
		expect(result.truncated).toBe(false);
	});
});

describe("Office 提取", () => {
	it("cn.docx：标题、正文与表格单元格都提取到", async () => {
		const result = await extractDocument(fixture("cn.docx"));
		const flat = squash(result.text);
		expect(flat).toContain(squash("中文标题：项目立项报告"));
		expect(flat).toContain(squash("覆盖段落与表格两种结构"));
		expect(flat).toContain(squash("提取准确率"));
		expect(result.totalPages).toBeUndefined();
	});

	it("cn.xlsx：两个 sheet 的内容都在", async () => {
		const result = await extractDocument(fixture("cn.xlsx"));
		const flat = squash(result.text);
		expect(flat).toContain(squash("研发部"));
		expect(flat).toContain("320");
		expect(flat).toContain(squash("汇总表"));
		expect(flat).toContain("999");
	});

	it("cn.pptx：两页文本框都提取到", async () => {
		const result = await extractDocument(fixture("cn.pptx"));
		const flat = squash(result.text);
		expect(flat).toContain(squash("第一页：项目背景与目标"));
		expect(flat).toContain(squash("第二页：实施计划与里程碑"));
	});

	it("cn.odt：标题与多段落拼接", async () => {
		const result = await extractDocument(fixture("cn.odt"));
		const flat = squash(result.text);
		expect(flat).toContain(squash("中文标题：开放文档测试"));
		expect(flat).toContain(squash("正文第一段：验证开放文档格式的文本提取。"));
		expect(flat).toContain(squash("正文第二段：包含第二个段落以验证多段落拼接。"));
	});

	it("offset/limit 以字符为单位，续读位置精确衔接", async () => {
		const full = await extractDocument(fixture("cn.docx"));
		expect(full.truncated).toBe(false);

		const head = await extractDocument(fixture("cn.docx"), 1, 5);
		expect(head.truncated).toBe(true);
		expect(head.nextOffset).toBe(6);
		expect(head.text).toBe(`${full.text.slice(0, 5)}\n[已显示第 1-5 字符。继续读请用 offset=6]`);

		const cont = await extractDocument(fixture("cn.docx"), 6, 5);
		expect(cont.text.startsWith(full.text.slice(5, 10))).toBe(true);
	});
});

describe("错误协议", () => {
	it("legacy.doc：老格式引导另存新格式", async () => {
		const err = await expectExtractError(fixture("legacy.doc"), "legacy");
		expect(err.message).toContain("另存为 .docx/.xlsx/.pptx");
	});

	it("missing.pdf：文件不存在", async () => {
		await expectExtractError(fixture("missing.pdf"), "not-found");
	});

	it("fake.txt：不支持格式列出支持清单", async () => {
		const err = await expectExtractError(fixture("fake.txt"), "unsupported");
		expect(err.message).toContain("pdf / docx / xlsx / pptx / odt / odp / ods");
	});
});

describe("加密与损坏", () => {
	// extractDocument 在 getDocument 之前要过 existsSync / readFileSync，
	// 所以即使 getDocument 被 mock，路径也得指向真实存在的 fixture。
	it("getDocument 以 PasswordException 拒绝 → encrypted，文案明示已加密", async () => {
		// 判定看 err.name（doc-extract.ts mapPdfOpenError），pdfjs v6 仍用这个名字 reject。
		const passwordError = new Error("No password given");
		passwordError.name = "PasswordException";
		mockedGetDocument.mockReturnValueOnce(rejectingLoadingTask(passwordError));

		const err = await expectExtractError(fixture("cn-text.pdf"), "encrypted");
		expect(err.message).toContain("已加密");
	});

	it("getDocument 以普通错误拒绝 → corrupt，文案带原始 message", async () => {
		mockedGetDocument.mockReturnValueOnce(rejectingLoadingTask(new Error("Invalid PDF structure")));

		const err = await expectExtractError(fixture("cn-text.pdf"), "corrupt");
		expect(err.message).toContain("Invalid PDF structure");
	});
});

describe("24k 截断", () => {
	// 用标准字体写 ASCII 造长 PDF：不嵌字体、无 CJK  shaping，生成快。
	// 每页 ~1.2k 字符，30 页总量 ~36k，必然触发 24k 截断。
	// 每页首尾放哨兵字符串，用来钉"截断发生在页边界、不截半页"。
	async function buildLongPdf(pages: number): Promise<Uint8Array> {
		const doc = await PDFDocument.create();
		const font = await doc.embedFont(StandardFonts.Helvetica);
		for (let n = 1; n <= pages; n++) {
			const page = doc.addPage([595, 842]);
			page.drawText(`page-${n}-start`, { x: 50, y: 800, size: 12, font });
			for (let line = 0; line < 15; line++) {
				// 12pt Helvetica 下 80 个 x ≈ 480pt，安全落在 595pt 页宽内——
				// 完全越出 MediaBox 的字形会被 pdfjs 丢弃（spike 踩坑 #3）。
				page.drawText("x".repeat(80), { x: 50, y: 770 - line * 20, size: 12, font });
			}
			page.drawText(`page-${n}-end`, { x: 50, y: 470, size: 12, font });
		}
		return doc.save();
	}

	it("长 PDF 在页边界截断：nextOffset 与续读引导一致，不截半页", async () => {
		const dir = mkdtempSync(join(tmpdir(), "kami-doclong-"));
		try {
			const path = join(dir, "long.pdf");
			writeFileSync(path, await buildLongPdf(30));

			const result = await extractDocument(path);
			expect(result.truncated).toBe(true);
			expect(result.totalPages).toBe(30);
			expect(result.nextOffset).toBeDefined();
			const next = result.nextOffset ?? 0;
			expect(next).toBeGreaterThan(1);
			expect(next).toBeLessThanOrEqual(30);
			expect(result.text).toContain(`[共 30 页，已显示第 1-${next - 1} 页。继续读请用 offset=${next}]`);

			// 页边界完整性：最后展示页的结束哨兵在，下一页的开始哨兵不在。
			const flat = squash(result.text);
			expect(flat).toContain(`page-${next - 1}-end`);
			expect(flat).not.toContain(`page-${next}-start`);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("长 docx 按 24k 字符截断：nextOffset 与引导文案精确", async () => {
		const dir = mkdtempSync(join(tmpdir(), "kami-doclong-"));
		try {
			// 2000 段 × ~20 字 ≈ 40k 字符，必然超过 24k。
			const paragraphs = Array.from(
				{ length: 2000 },
				(_, i) => `<w:p><w:r><w:t>第${i + 1}段正文填充内容用于测试截断行为</w:t></w:r></w:p>`,
			).join("");
			const zip = new JSZip();
			zip.file(
				"word/document.xml",
				`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`,
			);
			const path = join(dir, "long.docx");
			writeFileSync(path, await zip.generateAsync({ type: "nodebuffer" }));

			const result = await extractDocument(path);
			expect(result.truncated).toBe(true);
			expect(result.nextOffset).toBe(24_001);
			expect(result.text).toContain("[已显示第 1-24000 字符。继续读请用 offset=24001]");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
