/**
 * 文件类型图标映射：文件名 → 图标组件（目录树 / 列表行 / 正文路径 chip 用）。
 *
 * 映射思路对齐 WorkBuddy 的 FILE_TYPE_MAP（docs/workbuddy分析/07-artifact-preview.md），
 * 图标是我们自己的线性套（AGENTS.md §6：机制可学，素材不拿）。
 * PDF / Office 的分色徽标复用 shared/doc-formats.ts 的 docBadgeOf——
 * 扩展名到族/字标的映射只许有那一份（§4 防重复），这里不另写。
 *
 * 分色：线性套整体吃 currentColor，所以颜色不写死在图标组件里，而是按扩展名
 * 族挂 file-icon-<族> 类，由 index.css 出颜色（与 .doc-file-<族> 同一机制）。
 * 对齐 WorkBuddy 的彩色文件图标——整树一个灰跟不动「哪个是代码、哪个是图」。
 */

import { LEGACY_DOC_EXTENSIONS, docBadgeOf } from "@shared/doc-formats.ts";
import { IconCode, IconDoc, IconDocFile, IconFile, IconImage, IconMedia } from "./icons.tsx";

const MARKDOWN_EXTS: ReadonlySet<string> = new Set([".md", ".markdown"]);

const CODE_EXTS: ReadonlySet<string> = new Set([
	".js", ".mjs", ".ts", ".jsx", ".tsx", ".py", ".java", ".go", ".rs",
	".c", ".cpp", ".h", ".css", ".html", ".sh",
]);

/** 配置类单拎一族：扫读时「这是 json/yaml/toml」和「这是业务代码」的信息量不同。 */
const CONFIG_EXTS: ReadonlySet<string> = new Set([
	".json", ".yaml", ".yml", ".xml", ".toml", ".ini",
]);

const IMAGE_EXTS: ReadonlySet<string> = new Set([
	".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
]);

const MEDIA_EXTS: ReadonlySet<string> = new Set([".mp3", ".mp4", ".wav", ".ogg", ".webm"]);

const TEXT_EXTS: ReadonlySet<string> = new Set([".txt", ".log", ".csv"]);

/** 与 shared/doc-formats.ts 的 extensionOf 同口径：段首点不算扩展名（".gitignore"）。 */
function extOf(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot <= 0 ? "" : name.slice(dot).toLowerCase();
}

/** 分色族：与 index.css 的 .file-icon-<族> 一一对应，加族要两边一起加。 */
type FileIconFamily = "markdown" | "code" | "config" | "image" | "media";

function familyOf(ext: string): FileIconFamily | undefined {
	if (MARKDOWN_EXTS.has(ext)) return "markdown";
	if (CODE_EXTS.has(ext)) return "code";
	if (CONFIG_EXTS.has(ext)) return "config";
	if (IMAGE_EXTS.has(ext)) return "image";
	if (MEDIA_EXTS.has(ext)) return "media";
	return undefined;
}

/**
 * 族 → 字形。字形不跟着变色走（同一字形换个颜色即可分辨族：
 * 为 markdown / 配置各造一个新字形只会让图标套膨胀，线的风格还得重新对齐）。
 */
function iconOf(family: FileIconFamily): (p: { readonly size?: number; readonly className?: string }) => React.JSX.Element {
	switch (family) {
		case "markdown":
			return IconDoc;
		case "image":
			return IconImage;
		case "media":
			return IconMedia;
		case "code":
		case "config":
			return IconCode;
	}
}

/** 目录树行的文件图标：按扩展名分族上色，未知类型给通用文件轮廓（不分色，留中性）。 */
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
	const family = familyOf(ext);
	if (family !== undefined) {
		const Icon = iconOf(family);
		return <Icon size={size} className={`file-icon-${family}`} />;
	}
	if (TEXT_EXTS.has(ext)) return <IconDoc size={size} />;
	return <IconFile size={size} />;
}
