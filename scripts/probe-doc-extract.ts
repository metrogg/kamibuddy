/**
 * 探针：文档文本提取姿势验证（read_document 工具前置 spike）。
 *
 * 回答的问题：
 *  1. pdfjs-dist 在纯 Node 下按页提取中文 PDF，怎么做才不乱码？
 *  2. officeparser v4 对 docx/xlsx/pptx/odt 的提取质量如何（中文、表格、多 sheet、多页）？
 *
 * 结论（2026-09-09，Windows 11 + Node v24.11.1，pdfjs-dist 6.3.289 / officeparser 4.2.0）：
 *  全部 PASS。pdfjs 按页提取两种形态中文 PDF（pdf-lib 内嵌字体子集、手写 CID-keyed
 *  不嵌字体）均逐字正确；officeparser 对手搓最小 docx（段落+表格）、xlsx（sharedStrings
 *  +双 sheet）、pptx（双页文本框）、odt（标题+多段落）提取齐全，中文均无乱码。
 *
 * 踩坑记录（现象 → 根因）：
 *  1. 中文乱码根因实证：不配 cMapUrl 提取 CID-keyed PDF，pdfjs 警告
 *     "loadFont - translateFont failed: Ensure that the `cMapUrl` API parameter is
 *     provided"，提取结果为**空串**。cMapUrl/cMapPacked/standardFontDataUrl 三个参数
 *     必须指向包内 cmaps/ 与 standard_fonts/（用 createRequire resolve 包路径拼绝对路径）。
 *  2. pdfjs v6 API 变更：`PDFDocumentProxy.destroy()` 已移除，destroy 挪到
 *     loadingTask 上（Proxy 只剩 cleanup）；`isEvalSupported` 参数被整体删除
 *     （v6 不再支持 PDF 内嵌 JS eval，传了直接 TS 报错）。
 *  3. "最后一字丢失"假象：fixture 用 28pt 排 20 个全角字，第 20 字整体越出
 *     MediaBox 右边界（595pt），pdfjs v6 的 getTextContent 会丢弃完全页外的字形。
 *     不是乱码也不是截断 bug，字号降到 14pt 即全量提取。
 *  4. @napi-rs/canvas 是 pdfjs v6 的 optionalDependency：Node 无全局 DOMMatrix，
 *     pdfjs 启动时尝试从它补（legacy/build/pdf.mjs 里 require）。npm 默认安装
 *     optional deps 故零配置可跑；但它是**本任务唯一新增的原生 .node**（skia，
 *     win32-x64 约几 MB），将来打包裁剪依赖时不能把它裁掉。
 *  5. pdf-lib 写中文必须 registerFontkit(@pdf-lib/fontkit) + embedFont 真实 CJK
 *     字体（标准 14 字体无 CJK 字形）；字体选 simhei.ttf 因它是单文件 TTF，
 *     微软雅黑/宋体是 TTC 合集 pdf-lib 吃不了。
 *  6. officeparser：传文件路径时按**扩展名** dispatch（file-type 魔数检测只用于
 *     Buffer 输入）；tempFilesLocation 必须预先存在且默认落在 cwd（officeParsertemp），
 *     不显式传会污染仓库目录。
 *
 * 用法：npx tsx scripts/probe-doc-extract.ts
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import fontkit from "@pdf-lib/fontkit";
import JSZip from "jszip";
import { parseOfficeAsync } from "officeparser";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// ---------------------------------------------------------------------------
// 公共判定：PDF/Office 提取器都会引入空白差异（换行、分词），比较前压平所有空白。
// ---------------------------------------------------------------------------

const squash = (s: string): string => s.replace(/\s+/g, "");

interface JudgeResult {
  name: string;
  ok: boolean;
  garbled: boolean;
  detail: string;
}

function judge(name: string, extracted: string, expectedSnippets: string[], previewLen: number): JudgeResult {
  const flat = squash(extracted);
  const missing = expectedSnippets.filter((snippet) => !flat.includes(squash(snippet)));
  // 乱码的工作定义：生成时写入的原句在提取结果里找不到。
  const garbled = missing.length > 0;
  console.log(`\n--- ${name} ---`);
  console.log(`提取结果前 ${previewLen} 字：\n${extracted.slice(0, previewLen)}`);
  console.log(`中文是否乱码：${garbled ? `是（缺失片段：${missing.join(" | ")}）` : "否"}`);
  return {
    name,
    ok: !garbled,
    garbled,
    detail: garbled ? `缺失：${missing.join(" | ")}` : "全部预期片段命中",
  };
}

// ---------------------------------------------------------------------------
// PDF 部分（pdfjs-dist）
// ---------------------------------------------------------------------------

// 中文防乱码的三个关键姿势全部集中在这一个函数里，缺一个真实文件就可能炸：
//  1. data 必须喂 Uint8Array（pdfjs 不再接受裸 Buffer 的类型声明，且字节语义更明确）；
//  2. cMapUrl / standardFontDataUrl 必须指向包内 cmaps/ 与 standard_fonts/ 目录——
//     真实中文 PDF 多用 CID-keyed 字体（如 STSong-Light + UniGB-UCS2-H）且不嵌字体，
//     没有 CMap 文件 pdfjs 无法把 CID 映射回 Unicode，输出即乱码；
//  3. 不配 worker：Node 下没有 Web Worker，pdfjs 自动落 fake worker 在主线程跑。
async function extractPdfText(pdfBytes: Uint8Array): Promise<{ pageCount: number; pages: string[] }> {
  const require = createRequire(import.meta.url);
  const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
  // destroy() 在 v6 挪到了 loadingTask 上（PDFDocumentProxy 只剩 cleanup），
  // 必须留住 loadingTask 引用才能释放 worker/字体缓存。
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    cMapUrl: `${join(pdfjsRoot, "cmaps")}/`,
    cMapPacked: true,
    standardFontDataUrl: `${join(pdfjsRoot, "standard_fonts")}/`,
  });
  const doc = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if ("str" in item) {
        text += item.str;
        if (item.hasEOL) text += "\n";
      }
    }
    pages.push(text);
  }
  await loadingTask.destroy();
  return { pageCount: doc.numPages, pages };
}

// pdf-lib 的标准 14 字体不含 CJK 字形，写中文必须嵌入真实中文字体；
// embedFont 又必须先 registerFontkit（pdf-lib 自身不做字体 shaping/subset）。
// 选 simhei.ttf（黑体）是因为它是单文件 TTF；微软雅黑/宋体是 TTC 合集，
// pdf-lib 不能直接吃 TTC。
const FONT_PATH = "C:\\Windows\\Fonts\\simhei.ttf";

const PDF_P1_TITLE = "2026年第三季度经营分析报告";
const PDF_P1_BODY = "本季度营业收入同比增长百分之十二，主要得益于华东区新客户拓展。";
const PDF_P2_LINES = ["部门        预算(万元)    实际支出(万元)", "研发部      320           298", "市场部      150           171"];

async function buildChinesePdfWithPdfLib(): Promise<Uint8Array> {
  if (!existsSync(FONT_PATH)) {
    throw new Error(`生成中文 PDF fixture 需要 Windows 黑体字体，未找到：${FONT_PATH}`);
  }
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(readFileSync(FONT_PATH), { subset: true });

  const p1 = doc.addPage([595, 842]);
  p1.drawText(PDF_P1_TITLE, { x: 50, y: 780, size: 20, font });
  p1.drawText(PDF_P1_BODY, { x: 50, y: 740, size: 12, font });

  const p2 = doc.addPage([595, 842]);
  PDF_P2_LINES.forEach((line, idx) => {
    p2.drawText(line, { x: 50, y: 780 - idx * 24, size: 12, font });
  });

  return doc.save();
}

// 手写最小 CID-keyed PDF：STSong-Light + UniGB-UCS2-H，不嵌入任何字体。
// 这才是真实世界中文 PDF 的主流形态（Acrobat/国产软件导出），也是
// "不配 cMapUrl 必乱码"的直接验证——pdf-lib 生成的文件自带 ToUnicode，
// 即使 CMap 配错也能蒙对，证明不了姿势有效。
// UniGB-UCS2-H 的 codespace 是 UCS-2 大端，CID 即 Unicode BMP 码位，
// 所以内容流直接放文本的 UTF-16BE 十六进制。
// 注意字号别贪大：实测 pdfjs v6 的 getTextContent 会丢弃完全落在 MediaBox
// 右边界之外的字形（28pt×20 字从 x=72 排，第 20 字整体越出 595pt 页宽即消失，
// 表现为"最后一个字丢了"的假象）。14pt 下 20 字全角仅 280pt，安全。
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

// ---------------------------------------------------------------------------
// Office fixture 生成（jszip 手搓最小 OOXML/ODF 结构）
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
  // 表格样文本：2x2，验证 officeparser 是否把 w:tbl 里的 w:t 也一并提出。
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
  // 这同时是 file-type 魔数检测 odt 的依据（文件头直接可读 mimetype 字符串），
  // 压缩了就不算合法 odt，走 Buffer 模式时会被拒识。
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

const workDir = mkdtempSync(join(tmpdir(), "kami-docextract-"));
// officeparser 解压临时目录必须预先存在（它的 config 校验），
// 且绝不能落在仓库 cwd（默认 officeParsertemp 会污染工作区）。
const officeTemp = join(workDir, "officeparser-temp");
mkdirSync(officeTemp);

const results: JudgeResult[] = [];

try {
  console.log(`临时目录：${workDir}`);
  console.log(`pdfjs-dist 版本：${createRequire(import.meta.url)("pdfjs-dist/package.json").version}`);

  // ---- PDF-A：pdf-lib 现场生成的两页中文 PDF（内嵌字体子集）----
  const pdfAPath = join(workDir, "probe-chinese.pdf");
  writeFileSync(pdfAPath, await buildChinesePdfWithPdfLib());
  const pdfA = await extractPdfText(new Uint8Array(readFileSync(pdfAPath)));
  console.log(`\n=== PDF-A（pdf-lib 生成，两页中文）页数：${pdfA.pageCount} ===`);
  pdfA.pages.forEach((text, idx) => {
    console.log(`第 ${idx + 1} 页前 200 字：\n${text.slice(0, 200)}`);
  });
  results.push(
    judge("PDF-A 综合", pdfA.pages.join("\n"), [PDF_P1_TITLE, "华东区新客户拓展", "研发部", "市场部"], 200),
  );

  // ---- PDF-B：手写 CID-keyed PDF（不嵌字体，专验 cMapUrl 姿势）----
  const CID_TEXT = "中文乱码验证：独立字体不嵌入也能正确提取";
  const cidBytes = buildCidKeyedPdf(CID_TEXT);
  writeFileSync(join(workDir, "probe-cid.pdf"), cidBytes);
  const pdfB = await extractPdfText(new Uint8Array(cidBytes));
  console.log(`\n=== PDF-B（CID-keyed STSong-Light / UniGB-UCS2-H，不嵌字体）页数：${pdfB.pageCount} ===`);
  console.log(`第 1 页提取内容：\n${pdfB.pages[0] ?? ""}`);
  results.push(judge("PDF-B CID 字体", pdfB.pages.join("\n"), [CID_TEXT], 200));

  // ---- PDF-B 负面对照：故意不配 cMapUrl，证明上面的姿势不是摆设 ----
  // 不参与 PASS/FAIL，只记录现象。预期：CMap 加载失败，CID 无法映射回 Unicode。
  {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(cidBytes) });
    const doc = await loadingTask.promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if ("str" in item) text += item.str;
    }
    console.log(`\n=== PDF-B 负面对照（不配 cMapUrl）===`);
    console.log(`提取内容：${JSON.stringify(text)}`);
    console.log(`未配 cMapUrl 时是否仍正确：${squash(text).includes(squash(CID_TEXT)) ? "是（姿势非必需）" : "否（证明 cMapUrl 是中文不乱码的必要条件）"}`);
    await loadingTask.destroy();
  }

  // ---- Office：docx / xlsx / pptx / odt ----
  const officeCases: Array<{ file: string; build: () => Promise<Buffer>; expected: string[] }> = [
    { file: "probe.docx", build: buildDocx, expected: [DOCX_TITLE, DOCX_BODY, ...DOCX_TABLE_CELLS] },
    { file: "probe.xlsx", build: buildXlsx, expected: ["部门", "研发部", "320", "汇总表", "999"] },
    { file: "probe.pptx", build: buildPptx, expected: [PPTX_S1, PPTX_S2] },
    { file: "probe.odt", build: buildOdt, expected: [ODT_TITLE, ODT_P1, ODT_P2] },
  ];
  for (const c of officeCases) {
    const path = join(workDir, c.file);
    writeFileSync(path, await c.build());
    const text = await parseOfficeAsync(path, { tempFilesLocation: officeTemp });
    results.push(judge(c.file, text, c.expected, 300));
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

console.log("\n========== 汇总 ==========");
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}：${r.detail}`);
}
const allPass = results.every((r) => r.ok);
console.log(`\n${allPass ? "PASS：全部格式中文提取无乱码" : "FAIL：存在乱码或内容缺失"}`);
if (!allPass) process.exitCode = 1;
