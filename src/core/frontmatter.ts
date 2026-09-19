/**
 * frontmatter 解析：**委托给 pi 的解析器**（其内部是 `yaml@2.9.0`）。
 *
 * 2026-09-19 第三次修订，起因是同一类 bug 被撞了三次 —— 真正加载资源与技能的是 pi，
 * 我们自己另写一个「够用的子集解析器」，等于让**校验器比被校验的加载器更弱**：
 *   1. 2026-09 搬入 WorkBuddy `equity-research` 技能：`description: |` 块标量读不了
 *      → 补了 `|` / `|-` / `>` / `>-`（当时的判断原文：是我们比所依赖的加载器弱）；
 *   2. 2026-09-19 导入官方 `easyeda-api` 技能：`metadata:` 是嵌套 map
 *      （`metadata.openclaw.requires.bins`）→ 报「值为空；本解析器不支持多行值」；
 *   3. 同日导入用户的 `ppt-master`：`metadata:` 下既有嵌套 map 又有嵌套数组
 *      （`sponsors: [SPONSORS.md, …]`）→ 同一条报错。
 * 三次症状一样：**技能页导入被拒**，而 pi 那条自动加载路径反而是正常降级的。
 * 不再补第四个特例 —— 直接复用 pi 导出的 `parseFrontmatter`，
 * 「我们的解析器」与「加载器的解析器」从此是**同一份实现**，这类偏差结构性消失。
 *
 * 保留的两处自有行为（有意与 pi 的取舍不同）：
 *   - **缺结束分隔线要报错**。pi 那边静默当「没有 frontmatter」，还把开头的 `---` 留在正文里；
 *     对 modes / scenes 这类策略文件，症状会退化成「缺少字段 name」，定位信息全丢。
 *   - **frontmatter 必须是映射、且键名非空**。真 YAML 下 `: 值` 会解析出空串键、
 *     裸标量文档会解析成一个字符串 —— 两者都是写坏了的策略文件，响亮报错（AGENTS.md §7）。
 *
 * 由此带来的**行为变化**（SKILL.md 与资源文件都要遵守）：
 *   - 值里出现未加引号的 `: ` → 报错；要写冒号就加引号（原来按第一个冒号宽容切分）；
 *   - 数组元素保真：`[1, 2]` 得到数字，不再一律转字符串。白名单类数组因此会被
 *     `requireStringArray` 响亮拒绝，而不是悄悄变成 `["1","2"]`；
 *   - `|+` / `>+`（keep）与缩进列表现在都能读（原来报错）；
 *   - 块内各行的缩进必须对齐（原来宽容地取最小缩进为基准）。
 * 变化清单、实测记录与被否掉的两条路线见 docs/ARCHITECTURE.md §4.26。
 *
 * 「双面文件」机制照旧：一份 .md 的 frontmatter 给加载器读工具白名单，
 * 正文给模板引擎读提示片段 —— 一份文件同时定义策略与内容，两者不会漂移。
 */

import { parseFrontmatter as piParseFrontmatter } from "@earendil-works/pi-coding-agent";

/**
 * frontmatter 的值类型：**不设窄类型**。
 *
 * 原先是 `string | boolean | number | string[]` —— 那是自研解析器所能产出的全部形态。
 * 换成真 YAML 之后，值可以是任意嵌套结构（`metadata` 就是典型），硬塞进旧联合类型
 * 只会让类型说谎。形状判定的职责下移到取值辅助（requireString / requireStringArray / …）：
 * 它们本来就在做 `typeof` 判断并按 AGENTS.md §7 响亮报错，那里才是唯一该判定形状的地方。
 */
export type FrontmatterValue = unknown;

export interface ParsedDocument {
	readonly frontmatter: Readonly<Record<string, FrontmatterValue>>;
	/** 正文，已去掉 frontmatter 块与其后的空行。 */
	readonly body: string;
}

const FENCE = "---";

/** 错误信息用；非 Error 的值退化为 String()，不编造。 */
function reasonOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * 把 YAML 错误里的**块内行号**换算成**文件内行号**，返回 `:N` 或空串。
 * yaml 的 `linePos[0].line` 相对 frontmatter 块（块内第 1 行即文件第 2 行），故 +1。
 * 实测：`---\nid: craft\n坏行\n---` 报 line 2，对应文件第 3 行。
 * 形状不认识时返回空串 —— 宁可少一个行号，也不编一个假的定位让人白跳。
 */
function fileLineSuffix(error: unknown): string {
	if (typeof error !== "object" || error === null || !("linePos" in error)) return "";
	const linePos = (error as { linePos?: unknown }).linePos;
	if (!Array.isArray(linePos)) return "";
	const first = linePos[0];
	if (typeof first !== "object" || first === null) return "";
	const line = (first as { line?: unknown }).line;
	return typeof line === "number" && Number.isInteger(line) && line >= 1 ? `:${line + 1}` : "";
}

/** 形状的名字（给报错用）：区分 null / 数组 / 原始类型，别把 null 说成 object。 */
function shapeName(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "数组";
	return typeof value;
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
	// 统一换行（Windows 上编辑过的文件带 \r）；BOM 写成转义而非字面量，避免文件里藏不可见字符。
	const text = source.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

	if (!text.startsWith(`${FENCE}\n`)) {
		return { frontmatter: {}, body: text.trim() };
	}
	if (text.indexOf(`\n${FENCE}`, FENCE.length) === -1) {
		throw new Error(`${label}: frontmatter 缺少结束的 --- 分隔线`);
	}

	let frontmatter: Record<string, unknown>;
	let body: string;
	try {
		const parsed = piParseFrontmatter(text);
		frontmatter = parsed.frontmatter;
		body = parsed.body;
	} catch (error) {
		// 保留 label 定位（pi 的错误里只有块内坐标，且是人读的英文散文）。
		throw new Error(`${label}${fileLineSuffix(error)}: frontmatter 不是合法 YAML：${reasonOf(error)}`);
	}

	/*
	 * 形状守卫按**运行时真值**判，不看类型标注：pi 把 `parse()` 的返回值断言成了
	 * `Record<string, unknown>`，而裸标量文档（如整块只有一行「这行没有冒号」）
	 * 在那里实际是个字符串 —— 那份标注在运行时是假话。
	 */
	const runtimeValue: unknown = frontmatter;
	if (typeof runtimeValue !== "object" || runtimeValue === null || Array.isArray(runtimeValue)) {
		throw new Error(
			`${label}: frontmatter 必须是 key: value 形式，实际解析出 ${shapeName(runtimeValue)}`,
		);
	}
	for (const key of Object.keys(runtimeValue)) {
		// `: 值` 这种空键会被 YAML 解析成空串键；它是写坏了的策略文件，不能当合法字段放过。
		if (key === "") throw new Error(`${label}: frontmatter 有空的键名，应为 key: value 形式`);
	}

	return { frontmatter, body };
}

/* ── 取值辅助：缺失或类型不符时报错，不静默用默认值 ─────────────── */

/** 数组元素是否**全是**字符串（含空数组）。真 YAML 会让 `[1, 2]` 保持数字，这里据此响亮拒绝。 */
function isStringArray(value: readonly unknown[]): value is readonly string[] {
	return value.every((item) => typeof item === "string");
}

export function requireString(doc: ParsedDocument, key: string, label: string): string {
	const value = doc.frontmatter[key];
	if (typeof value !== "string" || value === "") {
		throw new Error(`${label}: frontmatter 缺少字符串字段「${key}」`);
	}
	return value;
}

/** 可选字符串字段：缺席返回 undefined，写了但类型不符/为空则报错（不静默吞）。 */
export function optionalString(doc: ParsedDocument, key: string, label: string): string | undefined {
	const value = doc.frontmatter[key];
	if (value === undefined) return undefined;
	if (typeof value !== "string" || value === "") {
		throw new Error(`${label}: frontmatter 字段「${key}」应为非空字符串`);
	}
	return value;
}

export function optionalBoolean(doc: ParsedDocument, key: string, fallback: boolean): boolean {
	const value = doc.frontmatter[key];
	return typeof value === "boolean" ? value : fallback;
}

export function requireStringArray(doc: ParsedDocument, key: string, label: string): string[] {
	const value = doc.frontmatter[key];
	if (!Array.isArray(value) || !isStringArray(value)) {
		throw new Error(
			`${label}: frontmatter 缺少数组字段「${key}」，应为 ${key}: [a, b]（元素必须都是字符串）`,
		);
	}
	return [...value];
}

/**
 * 可选字符串数组字段：缺席返回 undefined；写了但形状不对响亮报错；
 * 空数组归一为 undefined（追加一个空集没有语义，留 undefined 让消费方少一层分支）。
 */
export function optionalStringArray(
	doc: ParsedDocument,
	key: string,
	label: string,
): readonly string[] | undefined {
	const value = doc.frontmatter[key];
	if (value === undefined) return undefined;
	if (!Array.isArray(value) || !isStringArray(value)) {
		throw new Error(
			`${label}: frontmatter 字段「${key}」应为字符串数组，写法 ${key}: [a, b]（元素必须都是字符串）`,
		);
	}
	return value.length === 0 ? undefined : value;
}
