/**
 * 文档文本提取纯函数层：PDF / Office → 纯文本。
 *
 * 为什么放 core/：pdfjs 与 officeparser 的调用姿势（CMap 路径、临时目录、
 * 错误映射）都是纯 Node 逻辑，不依赖 pi / electron，可脱离二者单测；
 * 工具层（extensions/）只负责把 DocExtractError 转成模型可读的消息。
 *
 * 关键姿势（spike scripts/probe-doc-extract.ts 实证，改动前先读它）：
 *  1. 中文不乱码三件套：cMapUrl / cMapPacked / standardFontDataUrl 必须指向
 *     pdfjs-dist 包内 cmaps/ 与 standard_fonts/——真实中文 PDF 多为 CID-keyed
 *     不嵌字体（STSong-Light + UniGB-UCS2-H），没有 CMap 文件 pdfjs 无法把
 *     CID 映射回 Unicode，提取结果是空串。
 *  2. destroy() 在 pdfjs v6 挪到了 loadingTask 上（PDFDocumentProxy 只剩
 *     cleanup），必须留住 loadingTask 引用才能释放字体与缓存。
 *  3. officeparser 传文件路径时按扩展名 dispatch；tempFilesLocation 指向的
 *     目录必须预先存在，且绝不能落 cwd（默认 officeParsertemp 会污染工作区）。
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";

/*
 * parseOfficeAsync / getDocument 为什么走首用时的动态 import（勿改回静态）：
 * 它们是本模块最重的两份装配 —— 实测热态 pdfjs 133~444ms、officeparser 223~241ms
 * （冷态更高）。而 daemon 的启动关键路径（post ready 之前）只做 loadResources /
 * 偏好 / 权限规则这类 ms 级读，一个文档都还没解析 —— 静态挂在这里，
 * 每次启动都要替「用户可能永远不读的 PDF / Office 文件」白付这笔钱。
 * 类型不丢：调用点的类型由 `await import(...)` 的返回类型直接推导，仍是 pi 之外
 * 这两个包自己的声明（没有 as any / 手写形状）。
 */

// 扩展名集合的唯一来源在 shared（renderer 附件分类、main 选择框 filters 也用同一份）。
import { LEGACY_DOC_EXTENSIONS, OFFICE_EXTENSIONS, PDF_EXTENSION } from "../shared/doc-formats.ts";

export type DocExtractErrorCode = "scanned" | "legacy" | "encrypted" | "corrupt" | "unsupported" | "not-found";

/** 提取层统一错误：code 供工具层分支，message 是模型可读、可行动的文案。 */
export class DocExtractError extends Error {
	readonly code: DocExtractErrorCode;

	constructor(code: DocExtractErrorCode, message: string) {
		super(message);
		this.name = "DocExtractError";
		this.code = code;
	}
}

/** 文档种类判定结果。 */
export type DocKind =
	| { readonly kind: "pdf" }
	| { readonly kind: "office" } // docx/xlsx/pptx/odt/odp/ods
	| { readonly kind: "legacy"; readonly ext: string } // .doc/.xls/.ppt
	| { readonly kind: "unsupported"; readonly ext: string };

const SUPPORTED_LIST = "pdf / docx / xlsx / pptx / odt / odp / ods";

export function detectDocKind(path: string): DocKind {
	// 大小写不敏感：Windows 上 .PDF / .DOCX 满地都是。
	const ext = extname(path).toLowerCase();
	if (ext === PDF_EXTENSION) return { kind: "pdf" };
	if (OFFICE_EXTENSIONS.has(ext)) return { kind: "office" };
	if (LEGACY_DOC_EXTENSIONS.has(ext)) return { kind: "legacy", ext };
	return { kind: "unsupported", ext };
}

export interface DocExtractResult {
	readonly text: string; // 截断后的正文（含页标/续读引导）
	readonly truncated: boolean;
	readonly nextOffset: number | undefined; // truncated 时给续读 offset（PDF=页码，Office=字符位）
	readonly totalPages: number | undefined; // PDF 专有
}

/**
 * 单次返回的最大字符数。对齐 spill 的 24k 口径（core/spill.ts）——
 * 但**刻意不交给 spill 层统一处理**：这里的停点固定在页边界、且必然带续读
 * offset（模型按 offset 再来一次就读到了），信息没有丢；换成「从头砍 + 落盘」
 * 反而会打断 offset/limit 这套分页契约（spec: adopt-dsh-disciplines Task 2.1
 * 把「无损的分页」与「有损的截断」分开：前者留在工具里，后者才归 spill）。
 */
const MAX_CHARS = 24_000;

/**
 * 无文本层判定阈值：整份 PDF 提取文本去空白后不足 20 字，视为扫描件。
 * 取 20 的理由：文字型 PDF 哪怕只有一页标题也远超 20 字；扫描件经 pdfjs
 * 提取通常是 0 字（个别带几个噪声字符），20 足以分开两族，又不会误伤
 * "只有一句话的 PDF"。
 */
const SCANNED_TEXT_THRESHOLD = 20;

/**
 * 提取入口：按 kind 分流。错误一律 throw DocExtractError（工具层转成模型可读错误）。
 *
 * offset / limit：PDF 以页为单位（1 起算）；Office 以字符为单位（1 起算）。
 * 不传则从开头读，单次最多返回 MAX_CHARS 字符，截断处附续读引导。
 */
export async function extractDocument(path: string, offset?: number, limit?: number): Promise<DocExtractResult> {
	const docKind = detectDocKind(path);
	// 老格式/不支持只看扩展名即可定论，先拦——文件存在与否不改变结论，
	// 也让"按扩展名拒绝"先于 IO 失败暴露（文案更可行动）。
	if (docKind.kind === "legacy") {
		throw new DocExtractError("legacy", `请另存为 .docx/.xlsx/.pptx 后重试（老格式 ${docKind.ext} 暂不支持）`);
	}
	if (docKind.kind === "unsupported") {
		const shown = docKind.ext === "" ? "（无扩展名）" : docKind.ext;
		throw new DocExtractError("unsupported", `不支持的文件格式 ${shown}。支持：${SUPPORTED_LIST}`);
	}
	if (!existsSync(path)) {
		throw new DocExtractError("not-found", `文件不存在：${path}`);
	}
	return docKind.kind === "pdf" ? extractPdf(path, offset, limit) : extractOffice(path, offset, limit);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

let pdfAssetUrls: { cMapUrl: string; standardFontDataUrl: string } | undefined;

let pdfWorkerReady: Promise<void> | undefined;

/**
 * 把 pdf.js 的 worker 模块挂到 `globalThis.pdfjsWorker`，让它走「主线程 worker」
 * 这条装配路径。
 *
 * 为什么必须自己挂（2026-09-17 用户实测的 PDF 读取失败根因）：
 * pdfjs 用 `isNodeJS` 决定是否给 `GlobalWorkerOptions.workerSrc` 填默认值
 * （pdf.mjs:6277），而那个判定把 Electron 的非 browser 进程排除在外 ——
 * daemon 跑在 utilityProcess（`process.versions.electron` 有值 + `type === "utility"`），
 * 于是 isNodeJS=false：既不填 workerSrc，又走「真 Worker」分支，第一句读
 * `PDFWorker.workerSrc` 就抛 `No "GlobalWorkerOptions.workerSrc" specified.`
 * （scripts/probe-pdf-worker.ts 等价复现）。
 * 挂上之后 `PDFWorker.#initialize` 命中 `#mainThreadWorkerMessageHandler` 分支
 * → `#setupFakeWorker()` 直接用它，既不建 Worker 也不动态 import 工作线程文件
 * （打包进 asar 后那条 import 更不可靠）——纯 Node 与 utilityProcess 同一路径。
 */
async function ensurePdfWorker(): Promise<void> {
	if (pdfWorkerReady === undefined) {
		pdfWorkerReady = (async (): Promise<void> => {
			const globals = globalThis as { pdfjsWorker?: unknown };
			if (globals.pdfjsWorker !== undefined) return;
			globals.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
		})();
	}
	await pdfWorkerReady;
}

/** pdfjs 中文防乱码三件套的路径（见文件头注释）；createRequire 定位包根拼绝对路径。 */
function getPdfAssetUrls(): { cMapUrl: string; standardFontDataUrl: string } {
	if (pdfAssetUrls === undefined) {
		const require = createRequire(import.meta.url);
		const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
		pdfAssetUrls = {
			cMapUrl: `${join(pdfjsRoot, "cmaps")}/`,
			standardFontDataUrl: `${join(pdfjsRoot, "standard_fonts")}/`,
		};
	}
	return pdfAssetUrls;
}

/** 逐页提取全部页文本。打开失败按 加密/损坏 映射；页级异常统一归 corrupt。 */
async function readPdfPages(path: string): Promise<string[]> {
	// 与 worker 并行装配（两者互不依赖）；worker 仍先于 getDocument 就位。
	const [{ getDocument }] = await Promise.all([
		import("pdfjs-dist/legacy/build/pdf.mjs"),
		// worker 必须在 getDocument 之前挂好：装配只发生一次（见 ensurePdfWorker）。
		ensurePdfWorker(),
	]);
	const { cMapUrl, standardFontDataUrl } = getPdfAssetUrls();
	// data 喂 Uint8Array 而不是裸 Buffer：pdfjs 类型声明如此，字节语义也更明确
	// （Buffer 的 .buffer 可能带内存池余量，直接传会读出垃圾）。
	const loadingTask = getDocument({
		data: new Uint8Array(readFileSync(path)),
		cMapUrl,
		cMapPacked: true,
		standardFontDataUrl,
	});
	let doc;
	try {
		doc = await loadingTask.promise;
	} catch (err) {
		throw mapPdfOpenError(err);
	}
	try {
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
		return pages;
	} catch (err) {
		const detail = err instanceof Error ? err.message : String(err);
		throw new DocExtractError("corrupt", `PDF 解析失败（文件可能已损坏）：${detail}`);
	} finally {
		await loadingTask.destroy();
	}
}

function mapPdfOpenError(err: unknown): DocExtractError {
	// 加密 PDF：pdfjs 以 name === "PasswordException" 的错误 reject（v6 仍是这个名字）。
	if (err instanceof Error && err.name === "PasswordException") {
		return new DocExtractError("encrypted", "文件已加密，无法读取");
	}
	const detail = err instanceof Error ? err.message : String(err);
	return new DocExtractError("corrupt", `PDF 解析失败（文件可能已损坏）：${detail}`);
}

async function extractPdf(path: string, offset: number | undefined, limit: number | undefined): Promise<DocExtractResult> {
	const pages = await readPdfPages(path);
	const totalPages = pages.length;

	// 无文本层检测必须看整份文档而非请求的页窗——只读一页空白页就喊
	// "扫描件"是误报；整份去空白后仍不足阈值才能断定没有文本层。
	const wholeText = pages.join("");
	if (wholeText.replace(/\s+/g, "").length < SCANNED_TEXT_THRESHOLD) {
		throw new DocExtractError("scanned", "该 PDF 没有文本层（可能是扫描件），暂无法读取");
	}

	const start = offset ?? 1;
	// 参数越界不是文档故障，不抛错——返回带有效范围的文案，模型读完可自行纠正重试。
	if (start < 1 || start > totalPages) {
		return {
			text: `offset=${start} 超出范围：该 PDF 共 ${totalPages} 页（offset 取值范围 1-${totalPages}）`,
			truncated: false,
			nextOffset: undefined,
			totalPages,
		};
	}
	if (limit !== undefined && limit < 1) {
		return {
			text: `limit=${limit} 无效：limit 必须 ≥ 1`,
			truncated: false,
			nextOffset: undefined,
			totalPages,
		};
	}

	const requestedEnd = limit === undefined ? totalPages : Math.min(start + limit - 1, totalPages);
	// 截断只发生在页边界，不截半页：加上下一页会超 24k 就停在前一页。
	// 模型拿到的每页都完整，续读从 nextOffset 整页继续，不会拼出残句。
	let body = "";
	let lastShown = start - 1;
	for (let i = start; i <= requestedEnd; i++) {
		const block = `--- 第 ${i} 页 ---\n${pages[i - 1] ?? ""}\n`;
		// 首页豁免：哪怕单页就超 24k 也完整给出——否则截断后 nextOffset 等于
		// 原 offset，模型按引导续读会原地死循环。
		if (body.length + block.length > MAX_CHARS && lastShown >= start) break;
		body += block;
		lastShown = i;
	}

	// truncated 语义 = "后面还有没读到的内容"（无论被 24k 还是 limit 截住），
	// 并附续读引导——模型需要知道文档没读完。
	const truncated = lastShown < totalPages;
	const text = truncated
		? `${body.trimEnd()}\n[共 ${totalPages} 页，已显示第 ${start}-${lastShown} 页。继续读请用 offset=${lastShown + 1}]`
		: body.trimEnd();
	return {
		text,
		truncated,
		nextOffset: truncated ? lastShown + 1 : undefined,
		totalPages,
	};
}

// ---------------------------------------------------------------------------
// Office
// ---------------------------------------------------------------------------

let officeTemp: string | undefined;

/** officeparser 解压临时目录：必须预先存在（它的 config 校验），钉在 os.tmpdir() 下。 */
function getOfficeTempDir(): string {
	if (officeTemp === undefined) {
		officeTemp = join(tmpdir(), "kamibuddy-officeparser");
		mkdirSync(officeTemp, { recursive: true });
	}
	return officeTemp;
}

async function extractOffice(path: string, offset: number | undefined, limit: number | undefined): Promise<DocExtractResult> {
	const { parseOfficeAsync } = await import("officeparser");
	let full: string;
	try {
		full = await parseOfficeAsync(path, { tempFilesLocation: getOfficeTempDir() });
	} catch (err) {
		throw mapOfficeError(err);
	}
	const total = full.length;
	if (total === 0) {
		// 空文档是合法形态（新建没写内容），不是错误。
		return { text: "", truncated: false, nextOffset: undefined, totalPages: undefined };
	}

	const start = offset ?? 1;
	if (start < 1 || start > total) {
		return {
			text: `offset=${start} 超出范围：全文共 ${total} 字符（offset 取值范围 1-${total}）`,
			truncated: false,
			nextOffset: undefined,
			totalPages: undefined,
		};
	}
	if (limit !== undefined && limit < 1) {
		return {
			text: `limit=${limit} 无效：limit 必须 ≥ 1`,
			truncated: false,
			nextOffset: undefined,
			totalPages: undefined,
		};
	}

	const budget = Math.min(limit ?? MAX_CHARS, MAX_CHARS);
	const shownLen = Math.min(budget, total - (start - 1));
	const lastCharPos = start + shownLen - 1;
	const truncated = lastCharPos < total;
	const shown = full.slice(start - 1, lastCharPos);
	const text = truncated
		? `${shown}\n[已显示第 ${start}-${lastCharPos} 字符。继续读请用 offset=${lastCharPos + 1}]`
		: shown;
	return {
		text,
		truncated,
		nextOffset: truncated ? lastCharPos + 1 : undefined,
		totalPages: undefined,
	};
}

function mapOfficeError(err: unknown): DocExtractError {
	const detail = err instanceof Error ? err.message : String(err);
	// officeparser 对加密 Office 没有专门错误类型，只能靠错误文案识别。
	if (/password|encrypt/i.test(detail)) {
		return new DocExtractError("encrypted", "文件已加密，无法读取");
	}
	return new DocExtractError("corrupt", `文档解析失败（文件可能已损坏）：${detail}`);
}
