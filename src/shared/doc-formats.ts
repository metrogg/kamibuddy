/**
 * 文档格式判定：PDF / Office / 老格式 / 不支持。
 *
 * 为什么放 shared/：消费方分属三层——renderer 的附件分类
 * （image-attachments.tsx，不许 import core，AGENTS.md §1）、main 的
 * 文件选择框 filters、core 的 doc-extract。扩展名集合只许有一份，
 * 各写一份必然漂移（§4 防重复）。
 *
 * 本模块零运行时依赖（node:path 都不能用——renderer 也要 import），
 * 扩展名提取因此是自己写的。
 */

/** PDF 扩展名（含点，小写）。 */
export const PDF_EXTENSION = ".pdf";

/** read_document 能直接解析的新式 Office / ODF 扩展名（含点，小写）。 */
export const OFFICE_EXTENSIONS: ReadonlySet<string> = new Set([
	".docx",
	".xlsx",
	".pptx",
	".odt",
	".odp",
	".ods",
]);

/** 老格式：解析链不支持，入口统一提示另存为新格式（含点，小写）。 */
export const LEGACY_DOC_EXTENSIONS: ReadonlySet<string> = new Set([".doc", ".xls", ".ppt"]);

/** docKindOf 的判定结果。 */
export type DocKindName = "pdf" | "office" | "legacy" | "unsupported";

/**
 * 取扩展名（含点，小写；无扩展名归 ""）。口径与 node 的 extname 对齐：
 * 只看最后一段路径分隔符之后的部分（"dir.name/file" 不会误判出扩展名）；
 * 段首的点不算扩展名（".gitignore" 按无扩展名处理）。
 * 大小写不敏感是硬需求：Windows 上 .PDF/.DOCX 满地都是。
 */
function extensionOf(path: string): string {
	const base = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
	const dot = base.lastIndexOf(".");
	return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

/** 按扩展名判定文档种类；无扩展名归 unsupported。 */
export function docKindOf(path: string): DocKindName {
	const ext = extensionOf(path);
	if (ext === PDF_EXTENSION) return "pdf";
	if (OFFICE_EXTENSIONS.has(ext)) return "office";
	if (LEGACY_DOC_EXTENSIONS.has(ext)) return "legacy";
	return "unsupported";
}

/** chip 图标的分色族：ODF 归对应的 Office 族（odt→word、ods→excel、odp→ppt）。 */
export type DocFamily = "pdf" | "word" | "excel" | "ppt";

/** chip 图标右下角的小字标。 */
export type DocBadgeLabel = "PDF" | "DOC" | "XLS" | "PPT" | "ODF";

/** 文档 chip 图标需要的两件事：分色族 + 角标字。 */
export interface DocBadge {
	readonly family: DocFamily;
	readonly label: DocBadgeLabel;
}

/**
 * 展示层的文档细分：docKindOf 只回答「收不收」，附件 chip 的图标还需要
 * 「哪一族」（分色）与「写什么字」（角标）。三者同源于扩展名，映射只许
 * 有这一份（§4）：颜色与字标各写一份必然漂移。
 * 非文档扩展名返回 undefined——正常流程到不了这里（入口已按 docKindOf
 * 收过一轮），调用方落回通用文档图标。
 */
export function docBadgeOf(path: string): DocBadge | undefined {
	switch (extensionOf(path)) {
		case PDF_EXTENSION:
			return { family: "pdf", label: "PDF" };
		case ".docx":
			return { family: "word", label: "DOC" };
		case ".xlsx":
			return { family: "excel", label: "XLS" };
		case ".pptx":
			return { family: "ppt", label: "PPT" };
		case ".odt":
			return { family: "word", label: "ODF" };
		case ".ods":
			return { family: "excel", label: "ODF" };
		case ".odp":
			return { family: "ppt", label: "ODF" };
		default:
			return undefined;
	}
}
