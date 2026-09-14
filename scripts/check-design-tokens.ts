/**
 * 设计 token 机械校验 —— DESIGN.md §2（档位纪律）与 §6（禁止清单）的可执行版本。
 *
 * 扫两个范围：
 *   - src/renderer/index.css
 *   - src/renderer/ ** / *.tsx（含 settings/ 子目录；同时覆盖 tsx 里的 CSS 字符串与内联 style 对象）
 * 报出「没走 token 的硬编码视觉值」：颜色 / 字号 / 圆角 / 间距 / 阴影 / 时长 / z-index。
 *
 * 为什么不扫 tokens.css：它是 token 的唯一真源，里面的字面值就是定义本身。
 * 扫描范围不含它，就天然不需要豁免它的定义（也避免"自己报自己"）。
 *
 * 三类计数（输出里分开）：
 *   - 真违例    ：不在白名单、也没命中内置豁免 —— 需要收敛或登记白名单
 *   - 白名单命中：在 scripts/design-tokens-allowlist.json 里（每条必须带 reason）
 *   - 豁免      ：被下面的内置规则跳过（几何值 / WB 原值 / 亚间距 / 页面级留白 / 循环动画…）
 *
 * 粒度：同一行同一类只算一处（行内多值视为一处；一条 transition 里的多个时长同理）。
 *
 * 白名单匹配（刻意不锚行号——行号会因无关改动整体漂移，锚行号等于随时失效）：
 *   - `snippet` 是主匹配：命中「该行文本包含这段片段」即算命中，同一片段可覆盖多行；
 *   - `line`    只作辅助/兜底：snippet 没命中时才退回按行号比对；
 *   - 两者都不给 → file 级豁免（整文件的该类别）；
 *   - `rule` 可选，给了就只对该类别生效。
 * 一条条目谁都没命中 → 输出「白名单条目未命中」告警（写歪了 / 代码已变要能被发现）。
 * 该告警不阻断构建：通过与否只看真违例数（reason 缺失才是配置错误，非零退出）。
 *
 * 用法：npm run check:tokens（纳入 npm run check）
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/* ──────────────────────────── 内置豁免规则 ────────────────────────────
 * 下面每一条都对应 DESIGN.md / 设计 spec 里显式声明的例外，不是"为了让数字好看"的放水。
 * 写清理由是为了下一个人能判断"我想加的第 N 条例外"到底该不该加。
 *
 *   0                几何零值（没有视觉量；档位表里也没有 0）
 *   1px              1px 边框 / 发丝分隔线。设计上不计入间距与圆角档位；
 *                    报出来会淹没真实违例（现有 index.css 里 1px 绝大多数是 border/outline）。
 *                    代价：`padding: 1px` 这类真·1px 间距不会被拦——spec 的归档表已手工处理它。
 *   负值 (-Npx)      负 margin 是布局手段，归档到间距档位没有意义（spec「负值 保留」）。
 *   间距 2px         亚间距例外：图标贴合 / 角标等紧凑场景，归 4 会破坏布局（spec 间距表）。
 *   间距 ≥48px       页面级留白与固定高度（hero 留白、50/52/64/72/220px），非组件尺度（spec 间距表）。
 *   圆角 1–5px       微圆角例外：favicon / 进度 thumb / badge 标记（DESIGN.md §2.7）。
 *   圆角 22/24px     WB 原值例外：输入卡 24px / 首页槽 22px（DESIGN.md §2.7，代码里须带注释）。
 *   阴影 none        无阴影不是视觉值。
 *   时长 0 / 0.01ms  无动效；0.01ms 是 prefers-reduced-motion 的"关动效"写法（spec §C 明确豁免）。
 *   animation+infinite 循环动画（spin / pulse / shimmer）的周期是动画语义，不是交互动效时长
 *                    （spec 时长表：0.8s/1.1s/2s/2.2s 保留）。
 *
 * 另外这些值「天然不是候选」——它们没有 px 数值，正则不会命中，因此不需要豁免代码：
 *   50% / 100% / 100vh / 100vw / translate(-50%) / inset: 0 / currentColor / transparent。
 */
const EXEMPT_GEOMETRY = 0;
const EXEMPT_BORDER_HAIRLINE_PX = 1;
const EXEMPT_SUB_SPACING_PX = 2;
const EXEMPT_PAGE_GUTTER_PX = 48;
const EXEMPT_MICRO_RADIUS_MAX_PX = 5;
/** WB 原值例外（DESIGN.md §2.7）：输入卡 24 / 首页槽 22，不入档。 */
const EXEMPT_WB_RADIUS_PX = [22, 24];
/** reduced-motion 的关闭写法，以及零时长。 */
const EXEMPT_DURATIONS = ["0s", "0ms", "0.01ms", "0.01s"];

/* ──────────────────────────── 类型与常量 ──────────────────────────── */

const RULES = ["color", "font-size", "radius", "space", "shadow", "duration", "z-index"] as const;
type Rule = (typeof RULES)[number];

const RULE_LABEL: Record<Rule, string> = {
	color: "颜色",
	"font-size": "字号",
	radius: "圆角",
	space: "间距",
	shadow: "阴影",
	duration: "时长",
	"z-index": "z-index",
};

const CSS_FILE = resolve("src/renderer/index.css");
const RENDERER_DIR = resolve("src/renderer");
const ALLOWLIST_FILE = resolve("scripts/design-tokens-allowlist.json");

/** 间距类属性（含方向变体）：padding / margin / gap / row-gap / column-gap。 */
const SPACING_PROP = /^(?:padding|margin)(?:-[a-z]+)*$|^(?:row|column)?-?gap$/;
/** 圆角类属性（含方向变体）：border-radius / border-top-left-radius … */
const RADIUS_PROP = /^border(?:-[a-z]+)*-radius$/;

/** 一个候选值命中：文件:行号 + 类别。 */
interface Candidate {
	file: string;
	line: number;
	rule: Rule;
	severity: "violation" | "exempt";
}

interface KeyedHit extends Candidate {
	/** 该行同类的原文片段（用于输出，不参与判定）。 */
	snippet: string;
	/** 白名单命中时带上原因。 */
	reason?: string;
}

/* ──────────────────────────── 白名单 ──────────────────────────── */

interface AllowlistEntry {
	file: string;
	/** 主匹配：该行文本包含此片段即命中（不锚行号，代码挪行不失效）。 */
	snippet?: string;
	/** 辅助匹配：snippet 没命中时才退回按行号比对；file 级豁免时 snippet 与 line 都不给。 */
	line?: number;
	rule?: Rule;
	reason: string;
}

function loadAllowlist(): AllowlistEntry[] {
	if (!existsSync(ALLOWLIST_FILE)) {
		// 缺失是配置问题，不静默当作空表（AGENTS.md §7：失败要响亮）
		console.error(`✗ 白名单文件不存在：${relative(process.cwd(), ALLOWLIST_FILE)}`);
		process.exit(1);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(ALLOWLIST_FILE, "utf8"));
	} catch (error) {
		console.error(`✗ 白名单文件不是合法 JSON：${String(error)}`);
		process.exit(1);
	}

	const entries = (parsed as { entries?: unknown }).entries;
	if (!Array.isArray(entries)) {
		console.error('✗ 白名单文件结构错误：顶层必须是 { "entries": [...] }');
		process.exit(1);
	}

	const errors: string[] = [];
	const out: AllowlistEntry[] = [];
	entries.forEach((raw, index) => {
		const at = `entries[${index}]`;
		if (typeof raw !== "object" || raw === null) {
			errors.push(`${at} 不是对象`);
			return;
		}
		const entry = raw as Record<string, unknown>;
		if (typeof entry.file !== "string" || entry.file.trim() === "") {
			errors.push(`${at} 缺 file`);
			return;
		}
		// reason 必须写：白名单没有原因就会慢慢变成垃圾桶，例外要能被复核
		if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
			errors.push(`${at}（${entry.file}）缺 reason —— 例外必须写明为什么可以不归档`);
			return;
		}
		if (entry.line !== undefined && (typeof entry.line !== "number" || entry.line < 1)) {
			errors.push(`${at}（${entry.file}）line 必须是正整数`);
			return;
		}
		// 空串 snippet 会被当成「没给」而退化成 file 级豁免，语义完全不同 —— 直接报配置错误
		if (
			entry.snippet !== undefined &&
			(typeof entry.snippet !== "string" || entry.snippet.trim() === "")
		) {
			errors.push(`${at}（${entry.file}）snippet 必须是非空字符串（想要 file 级豁免就不写 snippet）`);
			return;
		}
		if (entry.rule !== undefined && !RULES.includes(entry.rule as Rule)) {
			errors.push(`${at}（${entry.file}）rule 非法：${String(entry.rule)}，可选 ${RULES.join(" / ")}`);
			return;
		}
		out.push({
			file: normalizePath(entry.file),
			snippet: entry.snippet as string | undefined,
			line: entry.line as number | undefined,
			rule: entry.rule as Rule | undefined,
			reason: entry.reason,
		});
	});

	if (errors.length > 0) {
		console.error("✗ 白名单配置错误：");
		for (const message of errors) console.error(`    ${message}`);
		process.exit(1);
	}
	return out;
}

/**
 * 白名单匹配：file 级 / file+rule / file+line / file+snippet（+rule）四种粒度。
 *
 * snippet 优先、line 兜底：snippet 是「该行文本片段」，代码挪行不影响；
 * line 只在 snippet 没命中时用一次，防止「行号对但文本被改」的条目彻底失效。
 */
function allowanceFor(entry: AllowlistEntry, hit: Candidate, lineText: string): string | undefined {
	if (entry.file !== hit.file) return undefined;
	if (entry.rule !== undefined && entry.rule !== hit.rule) return undefined;
	if (entry.snippet !== undefined) {
		if (lineText.includes(entry.snippet)) return entry.reason;
		if (entry.line !== undefined && entry.line === hit.line) return entry.reason;
		return undefined;
	}
	if (entry.line !== undefined) return entry.line === hit.line ? entry.reason : undefined;
	return entry.reason;
}

/* ──────────────────────────── 文本预处理 ──────────────────────────── */

function normalizePath(path: string): string {
	return path.split("\\").join("/");
}

/**
 * 把注释替换成等长空白（保留换行）——既不误报注释里的 `z-index: 1`，
 * 又不破坏 match.index → 行号的映射。
 */
function maskComments(source: string, lineComments: boolean): string {
	let out = source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "));
	if (lineComments) {
		out = out
			.split("\n")
			.map((line) => (line.trimStart().startsWith("//") ? " ".repeat(line.length) : line))
			.join("\n");
	}
	return out;
}

function lineStarts(source: string): number[] {
	const starts = [0];
	for (let i = 0; i < source.length; i++) if (source[i] === "\n") starts.push(i + 1);
	return starts;
}

function lineOf(starts: number[], offset: number): number {
	let lo = 0;
	let hi = starts.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (starts[mid]! <= offset) lo = mid;
		else hi = mid - 1;
	}
	return lo + 1;
}

/** 找出 balanced 调用的区间（用于排除 `color-mix()` 内部的颜色字面值）。 */
function balancedRanges(text: string, open: RegExp): Array<[number, number]> {
	const ranges: Array<[number, number]> = [];
	for (const match of text.matchAll(open)) {
		let depth = 1;
		let i = (match.index ?? 0) + match[0].length;
		while (i < text.length && depth > 0) {
			const ch = text[i];
			if (ch === "(") depth++;
			else if (ch === ")") depth--;
			i++;
		}
		ranges.push([match.index ?? 0, i]);
	}
	return ranges;
}

/* ──────────────────────────── 值判定 ──────────────────────────── */

/** 数字型 token（px 或 JS 裸数字）是否属于内置豁免。 */
function isExemptLength(rule: Rule, n: number): boolean {
	if (n === EXEMPT_GEOMETRY) return true;
	if (n === EXEMPT_BORDER_HAIRLINE_PX) return true;
	if (n < 0) return true;
	if (rule === "space") {
		if (n === EXEMPT_SUB_SPACING_PX) return true;
		if (n >= EXEMPT_PAGE_GUTTER_PX) return true;
	}
	if (rule === "radius") {
		if (n >= 1 && n <= EXEMPT_MICRO_RADIUS_MAX_PX) return true;
		if (EXEMPT_WB_RADIUS_PX.includes(n)) return true;
	}
	return false;
}

/**
 * 从属性值里抽「长度型」token。
 * JS 内联 style 的裸数字（`fontSize: 13`）等价于 px —— 只在值是纯数字时才当成 px，
 * 避免把 `${8 + depth * 12}px` 这类表达式里的数字误判成档位值。
 */
function lengthTokens(value: string, jsStyle: boolean): Array<{ text: string; n: number }> {
	const tokens: Array<{ text: string; n: number }> = [];
	// 必须带符号位：丢了负号会把 `-4px` 取成 `4px`，`isExemptLength` 的 `n < 0` 永不成立，
	// 「负 margin 豁免」形同虚设，负值全部落进真违例。
	for (const match of value.matchAll(/-?\d+(?:\.\d+)?px\b/g)) {
		tokens.push({ text: match[0], n: Number.parseFloat(match[0]) });
	}
	if (jsStyle && tokens.length === 0) {
		const trimmed = value.trim().replace(/^["']|["']$/g, "");
		if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
			tokens.push({ text: `${trimmed}px`, n: Number.parseFloat(trimmed) });
		}
	}
	return tokens;
}

/** 阴影：`none` / `var(--shadow-*)` / 纯变量组合不算字面值，其余字面值算。 */
function shadowIsLiteral(value: string): boolean {
	const stripped = value.replace(/!important/g, "").replace(/var\([^()]*\)/g, "").trim();
	if (stripped === "" || stripped === "none" || stripped === "inherit" || stripped === "unset") return false;
	return /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|\d/.test(stripped);
}

/** 时长的内置豁免：零时长、reduced-motion 的 0.01ms、循环动画（animation + infinite）。 */
function isExemptDuration(token: string, property: string, value: string): boolean {
	if (EXEMPT_DURATIONS.includes(token)) return true;
	if (property.startsWith("animation") && /\binfinite\b/.test(value)) return true;
	return false;
}

/* ──────────────────────────── 扫描 ──────────────────────────── */

/** 颜色：整文件扫字面值（颜色不出现在选择器里，无需属性上下文）。 */
function scanColors(file: string, masked: string, starts: number[]): Candidate[] {
	const out: Candidate[] = [];
	const mixed = balancedRanges(masked, /color-mix\(/g);
	const insideColorMix = (offset: number): boolean =>
		mixed.some(([from, to]) => offset >= from && offset < to);

	const patterns = [/#[0-9a-fA-F]{3,8}\b/g, /\b(?:rgba?|hsla?)\([^()]*\)/g];
	for (const pattern of patterns) {
		for (const match of masked.matchAll(pattern)) {
			const at = match.index ?? 0;
			if (insideColorMix(at)) continue;
			out.push({ file, line: lineOf(starts, at), rule: "color", severity: "violation" });
		}
	}
	return out;
}

/** 属性驱动：找 `属性: 值`，按类别判定值里的字面量。 */
function scanDeclarations(file: string, masked: string, starts: number[]): Candidate[] {
	const out: Candidate[] = [];
	// 前一个字符不能是标识符字符，避免把 `grid-gap` 里的 `gap`、`--kw-border` 里的片段当属性名
	const propertyRe = /(?<![A-Za-z-])([A-Za-z][A-Za-z-]*)\s*:\s*/g;

	for (const match of masked.matchAll(propertyRe)) {
		const rawName = match[1]!;
		const kebab = rawName.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
		const rule = ruleOfProperty(kebab);
		if (rule === undefined) continue;

		// 驼峰属性只可能出现在 JS 内联 style 里：值到 `,`/`}`/换行 结束；
		// 连字符属性是 CSS（含 tsx 里的 CSS 字符串），值到 `;`/`}` 结束（transition 常跨多行）。
		const jsStyle = /[A-Z]/.test(rawName);
		const value = readValue(masked, (match.index ?? 0) + match[0].length, jsStyle);
		const line = lineOf(starts, match.index ?? 0);

		if (rule === "shadow") {
			if (shadowIsLiteral(value)) out.push({ file, line, rule, severity: "violation" });
			continue;
		}

		if (rule === "duration") {
			let sawExempt = false;
			for (const duration of value.matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/g)) {
				if (isExemptDuration(duration[0], kebab, value)) sawExempt = true;
				else out.push({ file, line, rule, severity: "violation" });
			}
			if (sawExempt) out.push({ file, line, rule, severity: "exempt" });
			continue;
		}

		if (rule === "z-index") {
			const cleaned = value.replace(/!important/g, "").trim().replace(/^["']|["']$/g, "");
			if (!/^-?\d+$/.test(cleaned)) continue;
			const n = Number.parseInt(cleaned, 10);
			out.push({ file, line, rule, severity: n === 0 ? "exempt" : "violation" });
			continue;
		}

		// font-size / radius / space：按长度 token 逐个判定
		let sawExempt = false;
		for (const token of lengthTokens(value, jsStyle)) {
			if (isExemptLength(rule, token.n)) sawExempt = true;
			else out.push({ file, line, rule, severity: "violation" });
		}
		if (sawExempt) out.push({ file, line, rule, severity: "exempt" });
	}
	return out;
}

function ruleOfProperty(kebab: string): Rule | undefined {
	if (kebab === "font-size") return "font-size";
	if (RADIUS_PROP.test(kebab)) return "radius";
	if (SPACING_PROP.test(kebab)) return "space";
	if (kebab === "box-shadow") return "shadow";
	if (kebab === "z-index") return "z-index";
	if (
		kebab === "transition" ||
		kebab === "transition-duration" ||
		kebab === "animation" ||
		kebab === "animation-duration"
	) {
		return "duration";
	}
	return undefined;
}

function readValue(masked: string, from: number, jsStyle: boolean): string {
	const stops = jsStyle ? [";", ",", "}", "\n"] : [";", "}"];
	let i = from;
	while (i < masked.length && !stops.includes(masked[i]!)) i++;
	return masked.slice(from, i);
}

/* ──────────────────────────── 主流程 ──────────────────────────── */

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === "node_modules" || entry.startsWith(".")) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (entry.endsWith(".tsx")) out.push(full);
	}
	return out;
}

if (!existsSync(CSS_FILE)) {
	console.error(`✗ 找不到 ${relative(process.cwd(), CSS_FILE)}`);
	process.exit(1);
}

const allowlist = loadAllowlist();

const scanTargets: Array<{ abs: string; lineComments: boolean }> = [
	{ abs: CSS_FILE, lineComments: false },
	...walk(RENDERER_DIR).map((abs) => ({ abs, lineComments: true })),
];

const candidates: Candidate[] = [];
/** 展示用片段（截断），键含 rule。 */
const snippets = new Map<string, string>();
/** 匹配用整行原文（trim 后不截断），键只到行 —— 白名单 snippet 要比对它的包含关系。 */
const lineTexts = new Map<string, string>();

for (const { abs, lineComments } of scanTargets) {
	const raw = readFileSync(abs, "utf8");
	const masked = maskComments(raw, lineComments);
	const starts = lineStarts(raw);
	const lines = raw.split(/\r?\n/);
	const file = normalizePath(relative(process.cwd(), abs));

	const found = [...scanColors(file, masked, starts), ...scanDeclarations(file, masked, starts)];
	for (const hit of found) {
		candidates.push(hit);
		const text = (lines[hit.line - 1] ?? "").trim();
		snippets.set(`${hit.file}|${hit.line}|${hit.rule}`, text.slice(0, 120));
		lineTexts.set(`${hit.file}|${hit.line}`, text);
	}
}

// 同一行同类合并：只要有任一字面值是真违例，这一行就是这个类别的违例
const merged = new Map<string, Candidate>();
for (const hit of candidates) {
	const key = `${hit.file}|${hit.line}|${hit.rule}`;
	const existing = merged.get(key);
	if (existing === undefined || (existing.severity === "exempt" && hit.severity === "violation")) {
		merged.set(key, hit);
	}
}

const violations: KeyedHit[] = [];
const allowlisted: Array<KeyedHit & { reason: string }> = [];
const exemptCount = new Map<Rule, number>();
/** 命中了违例的白名单条目下标 —— 没命中的条目最后报「未命中」告警。 */
const hitEntries = new Set<number>();
for (const rule of RULES) exemptCount.set(rule, 0);

for (const hit of merged.values()) {
	const key = `${hit.file}|${hit.line}|${hit.rule}`;
	if (hit.severity === "exempt") {
		exemptCount.set(hit.rule, (exemptCount.get(hit.rule) ?? 0) + 1);
		continue;
	}
	const text = lineTexts.get(`${hit.file}|${hit.line}`) ?? "";
	let reason: string | undefined;
	for (let index = 0; index < allowlist.length; index++) {
		const found = allowanceFor(allowlist[index]!, hit, text);
		if (found !== undefined) {
			reason = found;
			hitEntries.add(index);
			break;
		}
	}
	if (reason !== undefined) {
		allowlisted.push({ ...hit, snippet: snippets.get(key) ?? "", reason });
	} else {
		violations.push({ ...hit, snippet: snippets.get(key) ?? "" });
	}
}

/* ──────────────────────────── 输出 ──────────────────────────── */

const exemptTotal = [...exemptCount.values()].reduce((sum, n) => sum + n, 0);
const cssName = normalizePath(relative(process.cwd(), CSS_FILE));
const tsxCount = scanTargets.length - 1;
const unmatched = allowlist
	.map((entry, index) => ({ entry, index }))
	.filter(({ index }) => !hitEntries.has(index));

console.log(`扫描 ${cssName} + ${tsxCount} 个 *.tsx 文件。`);
console.log(
	`真违例 ${violations.length} 处 / 白名单命中 ${allowlisted.length} 处 / 豁免 ${exemptTotal} 处。`,
);
if (unmatched.length > 0) {
	console.log(`⚠ 白名单条目未命中 ${unmatched.length} 条（见文末，需复核）。`);
}

function printGroup(rule: Rule, hits: KeyedHit[]): void {
	console.log(`\n[${RULE_LABEL[rule]}] ${hits.length} 处`);
	for (const hit of hits) {
		console.log(`  ${hit.file}:${hit.line}`);
		console.log(`    ${hit.snippet}`);
		if (hit.reason !== undefined) console.log(`    ↳ 白名单：${hit.reason}`);
	}
}

if (violations.length > 0) {
	console.log("\n── 真违例（需要收敛到 token，或登记白名单）──────────────");
	for (const rule of RULES) {
		const hits = violations.filter((hit) => hit.rule === rule);
		if (hits.length > 0) printGroup(rule, hits);
	}
}

if (allowlisted.length > 0) {
	console.log("\n── 白名单命中（已登记例外）─────────────────────────────");
	for (const rule of RULES) {
		const hits = allowlisted.filter((hit) => hit.rule === rule);
		if (hits.length > 0) printGroup(rule, hits);
	}
}

console.log("\n── 豁免计数（内置规则跳过，仅报数字）───────────────────");
for (const rule of RULES) console.log(`  ${RULE_LABEL[rule]}: ${exemptCount.get(rule) ?? 0}`);

if (unmatched.length > 0) {
	console.log("\n── ⚠ 白名单条目未命中（snippet 与 line 都对不上）────────");
	console.log("   可能写歪了、文件/类别改了名，或对应违例已被收敛 —— 请复核后订正或删除该条。");
	for (const { entry, index } of unmatched) {
		const rule = entry.rule === undefined ? "" : ` [${RULE_LABEL[entry.rule]}]`;
		const line = entry.line === undefined ? "" : `:${entry.line}`;
		console.log(`  entries[${index}] ${entry.file}${line}${rule}`);
		if (entry.snippet !== undefined) console.log(`    snippet: ${JSON.stringify(entry.snippet)}`);
		console.log(`    ↳ ${entry.reason}`);
	}
}

if (violations.length > 0) {
	console.log(`\n✗ 发现 ${violations.length} 处硬编码视觉值未走 token。`);
	process.exit(1);
}
const tail = unmatched.length > 0 ? `（另有 ${unmatched.length} 条白名单未命中，见上）` : "";
console.log(`\n✓ 硬编码视觉值检查通过（仅剩白名单例外与内置豁免）。${tail}`);
process.exit(0);
