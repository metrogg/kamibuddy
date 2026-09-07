/**
 * 极简 YAML frontmatter 解析。
 *
 * 为什么不引 js-yaml：我们只消费**自己写的**资源文件，格式完全可控 ——
 * 需要的就是 `key: value`、`key: [a, b]`、布尔与数字四种。
 * 为此引一个通用 YAML 解析器（及其全部语法面）不划算（AGENTS.md §9 YAGNI）。
 *
 * 这是 WorkBuddy「双面文件」机制的地基：一份 .md 的 frontmatter 给加载器读
 * 工具白名单，正文给模板引擎读提示片段 —— 一份文件同时定义策略与内容，
 * 两者不会漂移。
 *
 * 刻意不支持嵌套对象与多行值：一旦需要那些，说明该换成真 YAML 了，
 * 而不是在这里长出一个半成品解析器。遇到不认识的行会**报错**而非忽略，
 * 免得写错了却静默用了默认值（AGENTS.md §7）。
 */

export type FrontmatterValue = string | boolean | number | string[];

export interface ParsedDocument {
	readonly frontmatter: Readonly<Record<string, FrontmatterValue>>;
	/** 正文，已去掉 frontmatter 块与其后的空行。 */
	readonly body: string;
}

const FENCE = "---";

/** 解析标量：布尔、数字，其余按字符串（去掉可选的引号）。 */
function parseScalar(raw: string): FrontmatterValue {
	const text = raw.trim();
	if (text === "true") return true;
	if (text === "false") return false;

	// 只把「纯数字」当数字。像 "1.2.3"（版本号）这类必须留作字符串。
	if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);

	// 去引号：写 `label: "含: 冒号的值"` 时需要。
	if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
		return text.slice(1, -1);
	}
	return text;
}

/** 解析行内数组 `[a, b, c]`。空数组写 `[]`。 */
function parseInlineArray(raw: string): string[] {
	const inner = raw.trim().slice(1, -1).trim();
	if (inner === "") return [];
	return inner
		.split(",")
		.map((part) => {
			const value = parseScalar(part);
			// 数组元素一律当字符串：工具名、id 这类不该被误转成数字。
			return typeof value === "string" ? value : String(value);
		})
		.filter((part) => part !== "");
}

/**
 * 解析带 frontmatter 的 Markdown。
 *
 * 没有 frontmatter 时返回空对象与原文 —— 纯片段文件（fragments/）就是这种。
 *
 * @param source 文件全文
 * @param label 出错信息里用于定位的文件标识
 */
export function parseFrontmatter(source: string, label: string): ParsedDocument {
	// 统一换行，Windows 上编辑过的文件会带 \r。
	const text = source.replace(/\r\n/g, "\n").replace(/^﻿/, "");

	if (!text.startsWith(`${FENCE}\n`)) {
		return { frontmatter: {}, body: text.trim() };
	}

	const end = text.indexOf(`\n${FENCE}`, FENCE.length);
	if (end === -1) {
		throw new Error(`${label}: frontmatter 缺少结束的 --- 分隔线`);
	}

	const block = text.slice(FENCE.length + 1, end);
	const body = text.slice(end + FENCE.length + 1).trim();

	const frontmatter: Record<string, FrontmatterValue> = {};
	let lineNo = 1;

	for (const rawLine of block.split("\n")) {
		lineNo += 1;
		const line = rawLine.trim();
		// 允许空行与注释，便于在资源文件里写说明。
		if (line === "" || line.startsWith("#")) continue;

		const colon = line.indexOf(":");
		if (colon <= 0) {
			throw new Error(`${label}:${lineNo}: 无法解析的 frontmatter 行「${line}」，应为 key: value`);
		}

		const key = line.slice(0, colon).trim();
		const rawValue = line.slice(colon + 1).trim();

		if (rawValue === "") {
			// 多行值（YAML 的块标量或缩进列表）不支持。明确报错而不是当空串，
			// 否则工具白名单写成缩进列表会静默变成「没有工具」。
			throw new Error(`${label}:${lineNo}: 「${key}」的值为空；本解析器不支持多行值，请写成 key: [a, b] 形式`);
		}

		frontmatter[key] = rawValue.startsWith("[") && rawValue.endsWith("]")
			? parseInlineArray(rawValue)
			: parseScalar(rawValue);
	}

	return { frontmatter, body };
}

/* ── 取值辅助：缺失或类型不符时报错，不静默用默认值 ─────────────── */

export function requireString(doc: ParsedDocument, key: string, label: string): string {
	const value = doc.frontmatter[key];
	if (typeof value !== "string" || value === "") {
		throw new Error(`${label}: frontmatter 缺少字符串字段「${key}」`);
	}
	return value;
}

export function optionalBoolean(doc: ParsedDocument, key: string, fallback: boolean): boolean {
	const value = doc.frontmatter[key];
	return typeof value === "boolean" ? value : fallback;
}

export function requireStringArray(doc: ParsedDocument, key: string, label: string): string[] {
	const value = doc.frontmatter[key];
	if (!Array.isArray(value)) {
		throw new Error(`${label}: frontmatter 缺少数组字段「${key}」，应为 ${key}: [a, b]`);
	}
	return value;
}
