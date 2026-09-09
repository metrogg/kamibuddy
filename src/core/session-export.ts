/**
 * 会话导出 HTML 的路径构造。
 *
 * 输出目录固定为 `getWorkspaceDir()/exports/`（默认根，而非当前工作区）：
 * playground 会话没有工作区，若落在工作区下这部分会话就没有导出落点；
 * 用户也总能在一个固定地方找到自己的导出物，不用记「当时用的哪个工作区」。
 *
 * 本文件只负责拼路径，mkdir 由调用方负责 —— 纯函数才能脱离会话单独测。
 */

import { join } from "node:path";

/**
 * Windows 文件名非法字符 + 控制字符（\x00-\x1f、\x7f）。
 * 导出物首要归宿是 Windows 桌面，按最严口径清洗。
 * 空格不在其中 —— 空白走下面的压空格步骤，不换 `-`。
 */
const ILLEGAL_CHARS = /[<>:"/\\|?*\x00-\x1f\x7f]/g;

/** 标题进文件名的最大长度。过长标题会把时间戳挤出可视区，40 足够辨识。 */
const TITLE_MAX_LENGTH = 40;

/**
 * 会话标题 → 文件名安全片段。
 *
 * 清洗顺序有意如此：先压空白 + trim，再把非法字符与残留控制字符换成 `-`。
 * 反过来（先换 `-` 再压空白）会让 \t \n 变成 `-`，纯空白标题就得不到
 * 「session」回退而是一根孤零零的连字符。截断放最后，保证 41 字符的标题
 * 也得到满 40 字符而不是被前序步骤先削掉。
 */
export function sanitizeExportTitle(title: string): string {
	const cleaned = title
		.replace(/\s+/g, " ")
		.trim()
		.replace(ILLEGAL_CHARS, "-")
		.slice(0, TITLE_MAX_LENGTH);
	// 清洗后为空（空标题、纯空白）回退到通用名，不留裸时间戳文件名。
	return cleaned === "" ? "session" : cleaned;
}

/** 本地时区的 yyyyMMdd-HHmmss。导出物给用户看，本地时间比 UTC 直觉。 */
function formatTimestamp(now: Date): string {
	const pad = (n: number): string => String(n).padStart(2, "0");
	return (
		`${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
		`-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
	);
}

/**
 * 构造导出文件的绝对路径：`<exportsDir>/<清洗标题>-<yyyyMMdd-HHmmss>.html`。
 * exportsDir 结尾有无分隔符均可（join 归一）。
 */
export function buildExportPath(exportsDir: string, title: string, now: Date): string {
	return join(exportsDir, `${sanitizeExportTitle(title)}-${formatTimestamp(now)}.html`);
}
