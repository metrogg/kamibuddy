/**
 * 生成 doc-extract 的测试 fixtures（输出到 src/core/test-fixtures/docs/）。
 *
 * 为什么 fixtures 由脚本生成而不是手写/下载：
 *  1. 内容完全可控——测试断言依赖 fixture 里的原句，脚本即事实来源；
 *  2. 无外部依赖与版权问题——不引入来路不明的样本文件；
 *  3. 可复现——任何时候重跑本脚本都得到同构文件。
 *
 * 重生成方法：npx tsx scripts/gen-doc-fixtures.ts
 * 注意：cn-text.pdf 需要 Windows 黑体 C:\Windows\Fonts\simhei.ttf（单文件 TTF；
 * 微软雅黑/宋体是 TTC 合集，pdf-lib 的 fontkit 路径吃不了，这是 spike 实证的结论）。
 * fixture 文件本身要提交入库——vitest 直接读，不在测试时现生成。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import fontkit from "@pdf-lib/fontkit";
import JSZip from "jszip";
import { PDFDocument, rgb } from "pdf-lib";

const OUT_DIR = resolve("src/core/test-fixtures/docs");

// ---------------------------------------------------------------------------
// PDF fixtures
// ---------------------------------------------------------------------------

const FONT_PATH = "C:\\Windows\\Fonts\\simhei.ttf";

const PDF_P1_TITLE = "2026年第三季度经营分析报告";
const PDF_P1_BODY = "本季度营业收入同比增长百分之十二，主要得益于华东区新客户拓展。";
const PDF_P2_LINES = ["部门        预算(万元)    实际支出(万元)", "研发部      320           298", "市场部      150           171"];

/** cn-text.pdf：两页中文文字型 PDF（pdf-lib 内嵌字体子集，字号 14pt 内防越界丢字）。 */
async function buildChinesePdf(): Promise<Uint8Array> {
	if (!existsSync(FONT_PATH)) {
		throw new Error(`生成中文 PDF fixture 需要 Windows 黑体字体，未找到：${FONT_PATH}`);
	}
	const doc = await PDFDocument.create();
	doc.registerFontkit(fontkit);
	const font = await doc.embedFont(readFileSync(FONT_PATH), { subset: true });

	const p1 = doc.addPage([595, 842]);
	p1.drawText(PDF_P1_TITLE, { x: 50, y: 780, size: 18, font });
	p1.drawText(PDF_P1_BODY, { x: 50, y: 740, size: 12, font });

	const p2 = doc.addPage([595, 842]);
	PDF_P2_LINES.forEach((line, idx) => {
		p2.drawText(line, { x: 50, y: 780 - idx * 24, size: 12, font });
	});

	return doc.save();
}

// 手写最小 CID-keyed PDF：STSong-Light + UniGB-UCS2-H，不嵌入任何字体。
// 这是真实世界中文 PDF 的主流形态（Acrobat/国产软件导出），专门用来钉住
// "必须配 cMapUrl" 这条姿势——pdf-lib 生成的文件自带 ToUnicode，CMap 配错
// 也能蒙对，证明不了 cMapUrl 的必要性。UniGB-UCS2-H 的 CID 即 Unicode BMP
// 码位，内容流直接放文本的 UTF-16BE 十六进制。
const CID_TEXT = "中文乱码验证：独立字体不嵌入也能正确提取";

function buildCidKeyedPdf(text: string): Buffer {
	const hex = Array.from(text)
		.map((ch) => (ch.codePointAt(0) ?? 0xfffd).toString(16).padStart(4, "0"))
		.join("");
	const content = `BT /F1 14 Tf 72 760 Td <${hex}> Tj ET`;
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
		"<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [6 0 R] >>",
		`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
		"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 5 >> /FontDescriptor 7 0 R >>",
		"<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>",
	];
	// 手写 xref 需要精确字节偏移；全文只含 ASCII（中文以 hex 出现），latin1 长度即字节数。
	let pdf = "%PDF-1.4\n";
	const offsets: number[] = [];
	objects.forEach((body, i) => {
		offsets.push(Buffer.byteLength(pdf, "latin1"));
		pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
	});
	const xrefStart = Buffer.byteLength(pdf, "latin1");
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const off of offsets) {
		pdf += `${off.toString().padStart(10, "0")} 00000 n \n`;
	}
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
	return Buffer.from(pdf, "latin1");
}

/** scanned.pdf：只有图形没有任何文本的 PDF，模拟扫描件（无文本层）。 */
async function buildScannedPdf(): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	const page = doc.addPage([595, 842]);
	// 画几个矩形模拟扫描件里的图片区域；关键是一个 drawText 都不调。
	page.drawRectangle({ x: 50, y: 600, width: 495, height: 180, color: rgb(0.9, 0.9, 0.9) });
	page.drawRectangle({ x: 50, y: 350, width: 495, height: 200, color: rgb(0.85, 0.85, 0.85) });
	page.drawLine({
		start: { x: 50, y: 300 },
		end: { x: 545, y: 300 },
		thickness: 2,
		color: rgb(0.5, 0.5, 0.5),
	});
	return doc.save();
}

// ---------------------------------------------------------------------------
// Office fixtures（jszip 手搓最小 OOXML/ODF 结构）
//
// officeparser 的格式发现全部靠 zip 内路径正则（docx=word/document.xml、
// xlsx=xl/worksheets/sheetN.xml、pptx=ppt/slides/slideN.xml、odt=content.xml），
// 传文件路径时按扩展名 dispatch。fixture 仍带上 [Content_Types].xml 与 rels，
// 保持与真实文件同构，避免将来改传 Buffer（走 file-type 魔数检测）时返工。
// ---------------------------------------------------------------------------

const CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

const DOCX_TITLE = "中文标题：项目立项报告";
const DOCX_BODY = "本项目旨在验证办公文档文本提取能力，覆盖段落与表格两种结构。";
const DOCX_TABLE_CELLS = ["指标", "目标值", "提取准确率", "百分之九十五"];

function buildDocx(): Promise<Buffer> {
	const zip = new JSZip();
	zip.file(
		"[Content_Types].xml",
		`<Types xmlns="${CT_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
	);
	zip.file(
		"_rels/.rels",
		`<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
	);
	zip.file(
		"word/document.xml",
		`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
			`<w:p><w:r><w:t>${DOCX_TITLE}</w:t></w:r></w:p>` +
			`<w:p><w:r><w:t>${DOCX_BODY}</w:t></w:r></w:p>` +
			`<w:tbl><w:tr><w:tc><w:p><w:r><w:t>${DOCX_TABLE_CELLS[0]}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${DOCX_TABLE_CELLS[1]}</w:t></w:r></w:p></w:tc></w:tr>` +
			`<w:tr><w:tc><w:p><w:r><w:t>${DOCX_TABLE_CELLS[2]}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${DOCX_TABLE_CELLS[3]}</w:t></w:r></w:p></w:tc></w:tr></w:tbl>` +
			`</w:body></w:document>`,
	);
	return zip.generateAsync({ type: "nodebuffer" });
}

const XLSX_SHARED = ["部门", "预算(万元)", "研发部", "汇总表"];

function buildXlsx(): Promise<Buffer> {
	const zip = new JSZip();
	zip.file(
		"[Content_Types].xml",
		`<Types xmlns="${CT_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
			`<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
			`<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
			`<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
			`<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
	);
	zip.file(
		"_rels/.rels",
		`<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
	);
	zip.file(
		"xl/workbook.xml",
		`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
			`<sheet name="明细" sheetId="1" r:id="rId1"/><sheet name="汇总" sheetId="2" r:id="rId2"/></sheets></workbook>`,
	);
	zip.file(
		"xl/_rels/workbook.xml.rels",
		`<Relationships xmlns="${REL_NS}">` +
			`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
			`<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>` +
			`<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
	);
	zip.file(
		"xl/sharedStrings.xml",
		`<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">` +
			XLSX_SHARED.map((s) => `<si><t>${s}</t></si>`).join("") +
			`</sst>`,
	);
	zip.file(
		"xl/worksheets/sheet1.xml",
		`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` +
			`<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>` +
			`<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>320</v></c></row></sheetData></worksheet>`,
	);
	zip.file(
		"xl/worksheets/sheet2.xml",
		`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>` +
			`<row r="1"><c r="A1" t="s"><v>3</v></c><c r="B1"><v>999</v></c></row></sheetData></worksheet>`,
	);
	return zip.generateAsync({ type: "nodebuffer" });
}

const PPTX_S1 = "第一页：项目背景与目标";
const PPTX_S2 = "第二页：实施计划与里程碑";

function buildPptx(): Promise<Buffer> {
	const slideXml = (text: string): string =>
		`<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
		`<p:cSld><p:spTree><p:sp><p:txBody><a:bodyPr/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
	const zip = new JSZip();
	zip.file(
		"[Content_Types].xml",
		`<Types xmlns="${CT_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
			`<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
			`<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>` +
			`<Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`,
	);
	zip.file(
		"_rels/.rels",
		`<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
	);
	zip.file(
		"ppt/presentation.xml",
		`<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
			`<p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`,
	);
	zip.file(
		"ppt/_rels/presentation.xml.rels",
		`<Relationships xmlns="${REL_NS}">` +
			`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>` +
			`<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>`,
	);
	zip.file("ppt/slides/slide1.xml", slideXml(PPTX_S1));
	zip.file("ppt/slides/slide2.xml", slideXml(PPTX_S2));
	return zip.generateAsync({ type: "nodebuffer" });
}

const ODT_TITLE = "中文标题：开放文档测试";
const ODT_P1 = "正文第一段：验证开放文档格式的文本提取。";
const ODT_P2 = "正文第二段：包含第二个段落以验证多段落拼接。";

function buildOdt(): Promise<Buffer> {
	const zip = new JSZip();
	// ODF 规范：mimetype 必须是 zip 的第一个条目且不压缩（STORED）。
	// 这同时是 file-type 魔数检测 odt 的依据，压缩了就不算合法 odt。
	zip.file("mimetype", "application/vnd.oasis.opendocument.text", { compression: "STORE" });
	zip.file(
		"content.xml",
		`<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2">` +
			`<office:body><office:text>` +
			`<text:h text:outline-level="1">${ODT_TITLE}</text:h>` +
			`<text:p>${ODT_P1}</text:p><text:p>${ODT_P2}</text:p>` +
			`</office:text></office:body></office:document-content>`,
	);
	zip.file(
		"META-INF/manifest.xml",
		`<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">` +
			`<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>` +
			`<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`,
	);
	return zip.generateAsync({ type: "nodebuffer" });
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });

const outputs: Array<[string, () => Promise<Uint8Array | Buffer>]> = [
	["cn-text.pdf", buildChinesePdf],
	["cn-cid.pdf", () => Promise.resolve(buildCidKeyedPdf(CID_TEXT))],
	["scanned.pdf", buildScannedPdf],
	["cn.docx", buildDocx],
	["cn.xlsx", buildXlsx],
	["cn.pptx", buildPptx],
	["cn.odt", buildOdt],
	// legacy.doc 只用于验证"老格式报错"分支（按扩展名拦截，根本轮不到解析），
	// 给个 OLE2 魔数头装装样子即可，不需要真能解析。
	["legacy.doc", () => Promise.resolve(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]))],
];

for (const [name, build] of outputs) {
	const bytes = await build();
	writeFileSync(join(OUT_DIR, name), bytes);
	console.log(`生成 ${name}（${bytes.length} 字节）`);
}
console.log(`\n全部 fixtures 已写入 ${OUT_DIR}`);
