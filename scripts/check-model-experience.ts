/**
 * 模型体验契约门禁 —— spec: adopt-dsh-disciplines Task 1.1 的机械执行。
 *
 * 形态照 dsh 的 `scripts/verify-package-readme-model-experience.ts`（一条纪律：
 * **豁免也必须写理由**，缺席不能与遗忘混淆），落点换成我们的**文件头注释块**
 * （我们模块没有 README）。
 *
 * 扫描范围 = 「注册工具」的模块 + 五个具名模块：
 *   - `src/extensions/` 下调用了 `registerTool(` 的非测试模块（注册工具即改变
 *     模型所见：工具定义与返回都进请求）；
 *   - 具名模块：`src/core/system-prompt-composer.ts`、`src/shared/hidden-context.ts`、
 *     `src/extensions/prompt-switch.ts`、`src/extensions/spill-hook.ts`、
 *     `src/extensions/team-output-hook.ts`（它们不注册工具，但一个改提示词、一个改
 *     每轮注入、一个改工具面装配，**两个**用 `tool_result` 改写工具结果 —— 后两个不
 *     registerTool 却比任何工具都更直接地改变模型所见，漏掉任何一个就是给「改写工具
 *     结果」留一条门禁外的路）。**改写工具结果的扩展现在不止一个**：`spill-hook`
 *     先做超长落盘截断，`team-output-hook` 再在末尾追加团队成员产出块；两者都以契约段
 *     声明各自给模型带来的增量。
 * 不扫 `src/extensions/` 下其余不注册工具的模块（command-guard / permission-* 等）：
 * 它们对模型所见的影响经对应工具的结果文本生效，由那个工具的契约覆盖。
 *
 * 每个被覆盖模块的文件头注释块必须给出三段（顺序固定）：
 *   `What the model sees` / `Token effect` / `KV Cache effect`
 * 确实与模型所见无关的模块可豁免，但必须写一句话理由：
 *   `模型体验豁免：<理由>`
 * 契约与豁免互斥（同时出现即失败 —— 那是自相矛盾的声明）。
 *
 * 用法：npm run check:model-experience（纳入 npm run check）
 */

import { readdirSync, readFileSync } from "node:fs";

const EXTENSIONS_DIR = "src/extensions";

/** 契约三段。顺序即语义：先说进了什么，再说花多少 token，最后说前缀缓存。 */
const FIELDS = ["What the model sees", "Token effect", "KV Cache effect"] as const;
type Field = (typeof FIELDS)[number];

/** 豁免标记（理由写在同行或紧随其后的续行）。 */
const EXEMPT_KEY = "模型体验豁免";

const FIELD_RE = /^\s*\*?\s*(What the model sees|Token effect|KV Cache effect)\s*[：:]\s*(.*)$/;
const EXEMPT_RE = /^\s*\*?\s*模型体验豁免\s*[：:]\s*(.*)$/;
/** 文件头注释块。`^` 锚定：契约落在文件第一个注释块里，不放扫描器去猜「哪块算头」。 */
const HEADER_RE = /^\s*\/\*([\s\S]*?)\*\//;

/** 具名模块：不注册工具、但改变模型所见（spec 点名 + 两个改写工具结果的钩子，见文件头）。 */
const NAMED_MODULES = [
	"src/core/system-prompt-composer.ts",
	"src/shared/hidden-context.ts",
	"src/extensions/prompt-switch.ts",
	"src/extensions/spill-hook.ts",
	"src/extensions/team-output-hook.ts",
] as const;

interface Failure {
	readonly file: string;
	readonly line: number;
	readonly message: string;
}

interface Section {
	readonly key: string;
	readonly line: number;
	readonly parts: string[];
}

/** 收集被覆盖模块：注册工具的扩展模块 + 具名模块（去重排序，报告可复现）。 */
function scannedModules(): string[] {
	const toolModules: string[] = [];
	for (const entry of readdirSync(EXTENSIONS_DIR, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
		const source = readFileSync(`${EXTENSIONS_DIR}/${entry.name}`, "utf8");
		if (/registerTool\s*\(/.test(source)) toolModules.push(`${EXTENSIONS_DIR}/${entry.name}`);
	}
	return [...new Set([...toolModules, ...NAMED_MODULES])].sort();
}

/**
 * 按标签切段：标签行开段，其后的续行并入该段；碰到下一个标签/豁免标记换段。
 * 只切这三种标签与豁免标记 —— 头部其余正文不属于任何段，不会被误吞。
 */
function parseSections(block: string, startLine: number): Section[] {
	const sections: Section[] = [];
	for (const [index, rawLine] of block.split("\n").entries()) {
		// CRLF：`.` 不匹配 `\r`，标签行的 `(.*)$` 会因行尾的 `\r` 整条匹配不上（踩过）。
		const raw = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
		const line = startLine + index;
		const exempt = EXEMPT_RE.exec(raw);
		if (exempt !== null) {
			sections.push({ key: EXEMPT_KEY, line, parts: [exempt[1] ?? ""] });
			continue;
		}
		const field = FIELD_RE.exec(raw);
		if (field !== null) {
			sections.push({ key: field[1] as string, line, parts: [field[2] ?? ""] });
			continue;
		}
		const text = raw.replace(/^\s*\*?/, "").trim();
		if (text === "" || text === "/") continue;
		sections.at(-1)?.parts.push(text);
	}
	return sections;
}

const failures: Failure[] = [];
const report: string[] = [];
let contracted = 0;
let exempted = 0;

for (const file of scannedModules()) {
	const source = readFileSync(file, "utf8");
	const header = HEADER_RE.exec(source);
	if (header === null) {
		failures.push({
			file,
			line: 1,
			message: "文件头没有注释块 —— 契约（或豁免理由）的落点不存在",
		});
		continue;
	}
	const startLine = source.slice(0, header.index).split("\n").length;
	const sections = parseSections(header[1] ?? "", startLine);
	const fields = sections.filter((section) => (FIELDS as readonly string[]).includes(section.key));
	const exemption = sections.find((section) => section.key === EXEMPT_KEY);

	if (exemption !== undefined && fields.length > 0) {
		failures.push({
			file,
			line: exemption.line,
			message: `同时声明了契约与豁免（二者互斥）：要么写全三段，要么只写「${EXEMPT_KEY}：<理由>」`,
		});
		continue;
	}

	if (exemption !== undefined) {
		if (exemption.parts.join(" ").trim() === "") {
			failures.push({ file, line: exemption.line, message: `豁免必须写理由：「${EXEMPT_KEY}：<为什么本模块与模型所见无关>」` });
			continue;
		}
		exempted += 1;
		report.push(`  豁免  ${file}`);
		continue;
	}

	if (fields.length === 0) {
		failures.push({
			file,
			line: startLine,
			message: `缺少模型体验契约（三段：${FIELDS.join(" / ")}）；确与模型所见无关就写「${EXEMPT_KEY}：<理由>」`,
		});
		continue;
	}

	const duplicates = fields.length !== new Set(fields.map((field) => field.key)).size;
	if (duplicates) {
		failures.push({ file, line: fields[0]?.line ?? startLine, message: "契约三段有重复" });
		continue;
	}

	// 顺序即语义（dsh 同款）：三段必须按 FIELDS 的顺序出现。
	const order = fields.map((field) => FIELDS.indexOf(field.key as Field));
	const ordered = order.every((value, index) => value === index);
	if (!ordered || fields.length !== FIELDS.length) {
		failures.push({
			file,
			line: fields[0]?.line ?? startLine,
			message: `契约三段必须齐全且按序：${FIELDS.join(" → ")}（现状：${fields.map((field) => field.key).join(" → ") || "无"}）`,
		});
		continue;
	}

	const empty = fields.find((field) => field.parts.join(" ").trim() === "");
	if (empty !== undefined) {
		failures.push({ file, line: empty.line, message: `\`${empty.key}\` 段为空 —— 空段与没写一样` });
		continue;
	}

	contracted += 1;
	report.push(`  契约  ${file}`);
}

if (failures.length === 0) {
	console.log(
		`check-model-experience: ${contracted + exempted} 个模块（契约 ${contracted} / 豁免 ${exempted}）全部符合。`,
	);
	for (const line of report) console.log(line);
	process.exit(0);
}

console.error("check-model-experience 失败：");
for (const failure of failures) {
	console.error(`  ${failure.file}:${failure.line}: ${failure.message}`);
}
console.error(`\n契约三段（文件头注释块，顺序固定）：${FIELDS.join(" / ")}`);
console.error(`与模型所见无关的模块写「${EXEMPT_KEY}：<理由>」—— 无理由的豁免同样失败。`);
process.exit(1);
