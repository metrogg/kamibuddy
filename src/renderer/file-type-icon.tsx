/**
 * 文件类型图标映射：文件名 → 图标组件（目录树 / 列表行用）。
 *
 * 映射思路对齐 WorkBuddy 的 FILE_TYPE_MAP（docs/workbuddy分析/07-artifact-preview.md），
 * 图标是我们自己的线性套（AGENTS.md §6：机制可学，素材不拿）。
 * PDF / Office 的分色徽标复用 shared/doc-formats.ts 的 docBadgeOf——
 * 扩展名到族/字标的映射只许有那一份（§4 防重复），这里不另写。
 */

import { LEGACY_DOC_EXTENSIONS, docBadgeOf } from "@shared/doc-formats.ts";
import { IconCode, IconDoc, IconDocFile, IconFile, IconImage, IconMedia } from "./icons.tsx";

const CODE_EXTS: ReadonlySet<string> = new Set([
	".js", ".mjs", ".ts", ".jsx", ".tsx", ".py", ".java", ".go", ".rs",
	".c", ".cpp", ".h", ".css", ".html", ".json", ".yaml", ".yml", ".xml",
	".sh", ".toml", ".ini",
]);

const IMAGE_EXTS: ReadonlySet<string> = new Set([
	".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
]);

const MEDIA_EXTS: ReadonlySet<string> = new Set([".mp3", ".mp4", ".wav", ".ogg", ".webm"]);

const TEXT_EXTS: ReadonlySet<string> = new Set([".txt", ".md", ".log", ".csv"]);

/** 与 shared/doc-formats.ts 的 extensionOf 同口径：段首点不算扩展名（".gitignore"）。 */
function extOf(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot <= 0 ? "" : name.slice(dot).toLowerCase();
}

/** 目录树行的文件图标：按扩展名分族，未知类型给通用文件轮廓。 */
export function FileTypeIcon({
	name,
	size = 14,
}: {
	readonly name: string;
	readonly size?: number;
}): React.JSX.Element {
	// PDF / 新式 Office / ODF：分色徽标（pdf 红 / word 蓝 / excel 绿 / ppt 橙）。
	const badge = docBadgeOf(name);
	if (badge !== undefined) return <IconDocFile badge={badge} size={size} />;
	const ext = extOf(name);
	// 老格式（.doc/.xls/.ppt）docBadgeOf 不覆盖（角标只服务新格式族），
	// 用 IconDoc 的「带文字行文档」传达「这是文档」即可。
	if (LEGACY_DOC_EXTENSIONS.has(ext)) return <IconDoc size={size} />;
	if (CODE_EXTS.has(ext)) return <IconCode size={size} />;
	if (IMAGE_EXTS.has(ext)) return <IconImage size={size} />;
	if (MEDIA_EXTS.has(ext)) return <IconMedia size={size} />;
	if (TEXT_EXTS.has(ext)) return <IconDoc size={size} />;
	return <IconFile size={size} />;
}
