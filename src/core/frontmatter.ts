/**
 * 极简 YAML frontmatter 解析。
 *
 * 为什么不引 js-yaml：我们只消费**自己写的**资源文件，格式完全可控 ——
 * 常态需要的仍是 `key: value`、`key: [a, b]`、布尔与数字四种。
 * 为此引一个通用 YAML 解析器（及其全部语法面）不划算（AGENTS.md §9 YAGNI）。
 *
 * 这是 WorkBuddy「双面文件」机制的地基：一份 .md 的 frontmatter 给加载器读
 * 工具白名单，正文给模板引擎读提示片段 —— 一份文件同时定义策略与内容，
 * 两者不会漂移。
 *
 * 2026-09 立场修订：新增块标量（`|` / `|-` / `>` / `>-`）支持。
 * 起因是从 WorkBuddy `equity-research` 专家包原样搬入的技能，其 `description`
 * 用 literal 块标量写了多行（AGENTS.md §6 要求逐字节保留、后续还要继续搬，
 * 改资源文件会破坏可追溯性；且多行是有语义的，折成单行就是改了值本身）。
 * 而真正加载技能的是 pi 的 `loadSkills`，它用真 yaml 包解析 frontmatter
 * （开源项目/pi/packages/coding-agent/src/utils/frontmatter.ts）——
 * 是我们的解析器比所依赖的加载器弱，这里补上差距而不是回去迁就解析器。
 *
 * 仍然刻意不支持的构造，遇到**报错**而非静默降级（AGENTS.md §7）：
 *   - 缩进列表 / 嵌套对象（即 `key:` 值为空、后跟缩进内容却无块标量指示符）；
 *   - 块标量的 keep 修饰符 `|+` / `>+`（会保留全部结尾空行，未实现，静默当 clip
 *     会悄悄改变值）；
 *   - 任何不是 `key: value` 形状的行。
 * 这些构造一旦真需要，就该换成真 YAML，而不是在这里长出半成品解析器。
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

/** 行首缩进宽度（空格与制表符都算），用于判断块标量的范围与去缩进基准。 */
function countIndent(line: string): number {
	return line.length - line.trimStart().length;
}

/** 块标量指示符全集：`|`/`>` 加 strip（`-`）与 keep（`+`）修饰符。 */
function isBlockScalarToken(rawValue: string): boolean {
	return /^[|>][+-]?$/.test(rawValue);
}

/**
 * 折叠块（`>`）的行变换：相邻非空行的换行折成空格，空行各折成一个换行。
 * 结尾空行不在此处理（由 chomping 统一管），故只累积不输出。
 */
function foldLines(content: readonly string[]): string {
	let out = "";
	let pendingBlanks = 0;
	let started = false;
	for (const line of content) {
		if (line === "") {
			pendingBlanks += 1;
			continue;
		}
		if (started) out += pendingBlanks === 0 ? " " : "\n".repeat(pendingBlanks);
		out += line;
		pendingBlanks = 0;
		started = true;
	}
	return out;
}

/**
 * 结尾换行处理（chomping）：
 * clip（无修饰符）保留一个换行；strip（`-`）全部去掉；纯空白内容归为空串。
 */
function chomp(text: string, strip: boolean): string {
	const trimmed = text.replace(/\n+$/, "");
	if (trimmed === "") return "";
	return strip ? trimmed : `${trimmed}\n`;
}

/**
 * 解析块标量。返回其值与块结束后应继续解析的行下标。
 *
 * 块内容 = 紧随其后、缩进深于 key 的行（空行也属于块）；遇到缩进回到
 * <= key 缩进的非空行即结束。去缩进基准取块内非空行的最小缩进。
 */
function parseBlockScalar(
	lines: readonly string[],
	keyIndex: number,
	keyIndent: number,
	indicator: string,
	key: string,
	label: string,
	keyLineNo: number,
): { value: string; nextIndex: number } {
	// keep 修饰符会保留全部结尾空行，我们没实现；静默当 clip 会改变值，故响亮报错。
	if (indicator.endsWith("+")) {
		throw new Error(
			`${label}:${keyLineNo}: 「${key}」的块标量用了 keep 修饰符「${indicator}」；本解析器只支持 |、|-、>、>-`,
		);
	}

	let end = keyIndex + 1;
	while (end < lines.length) {
		const candidate = lines[end] ?? "";
		if (candidate.trim() !== "" && countIndent(candidate) <= keyIndent) break;
		end += 1;
	}

	const blockLines = lines.slice(keyIndex + 1, end);
	const baseIndent = blockLines.reduce(
		(min, blockLine) => (blockLine.trim() === "" ? min : Math.min(min, countIndent(blockLine))),
		Number.POSITIVE_INFINITY,
	);
	const content = blockLines.map((blockLine) =>
		blockLine.trim() === "" ? "" : blockLine.slice(Number.isFinite(baseIndent) ? baseIndent : 0),
	);

	// 块内容天然以换行结尾（最后一行之后必有一个换行）。
	const raw = content.length === 0 ? "" : `${indicator.startsWith("|") ? content.join("\n") : foldLines(content)}\n`;
	return { value: chomp(raw, indicator.endsWith("-")), nextIndex: end };
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
	const lines = block.split("\n");

	for (let i = 0; i < lines.length; i += 1) {
		const rawLine = lines[i] ?? "";
		// 第 1 行是开头的 ---，故块内首行的行号是 2。
		const lineNo = i + 2;
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

		if (isBlockScalarToken(rawValue)) {
			const { value, nextIndex } = parseBlockScalar(lines, i, countIndent(rawLine), rawValue, key, label, lineNo);
			frontmatter[key] = value;
			i = nextIndex - 1; // 交给 for 的 i += 1 落到块结束后的第一行。
			continue;
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
