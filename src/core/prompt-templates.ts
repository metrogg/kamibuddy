/**
 * 提示词模板发现：为输入框 `/` 补全提供清单。
 *
 * pi 运行时在 prompt() 里会展开两类斜杠命令（agent-session.js:853-857）：
 *   - `/skill:name args`（技能）
 *   - `/模板名 args`（提示词模板，expandPromptTemplate）
 * 模板的发现规则在 pi 的 dist/core/prompt-templates.js：
 *   - 全局：agentDir/prompts/*.md
 *   - 项目：cwd/.pi/prompts/*.md（CONFIG_DIR_NAME 默认为 .pi）
 *   - 非递归；名字 = 文件名去 .md；description = frontmatter.description 或正文首行（60 字符截断）
 *
 * pi 没把 loadPromptTemplates 从包根导出（只有 dist 内部用），所以这里按同一规则
 * 用我们自己的 frontmatter 解析器镜像一份。**发现规则必须与 pi 保持一致** ——
 * 补全列表列出的命令，发出去 pi 必须真的能展开，否则就是骗用户。
 * pi 侧规则变了（升级时）这里要跟着改。
 */

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseFrontmatter } from "./frontmatter.ts";

export interface PromptTemplateItem {
	/** 模板名（文件名去 .md），斜杠命令就是 `/名字`。 */
	readonly name: string;
	readonly description: string;
}

/** pi 的项目级配置目录名（dist/config.js 的 CONFIG_DIR_NAME 默认值）。 */
const PROJECT_CONFIG_DIR = ".pi";

/** 从一个目录非递归地收集模板。目录不存在或无权限时返回空。 */
function scanDir(dir: string): PromptTemplateItem[] {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return [];
	}

	const out: PromptTemplateItem[] = [];
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
		const filePath = join(dir, entry.name);
		let raw;
		try {
			raw = readFileSync(filePath, "utf8");
		} catch {
			continue;
		}
		// 单个坏文件（frontmatter 写歪）跳过，不拖垮整个补全列表。
		// pi 自己的解析器更宽容，这里坏文件宁可不列，也不让 completions 整个报错。
		try {
			const doc = parseFrontmatter(raw, filePath);
			out.push({
				name: basename(entry.name, ".md"),
				description: pickDescription(doc.frontmatter["description"], doc.body),
			});
		} catch {
			continue;
		}
	}
	return out;
}

/** description：frontmatter 优先，否则正文首个非空行，超 60 字符截断加省略号（与 pi 同）。 */
function pickDescription(frontmatterValue: unknown, body: string): string {
	if (typeof frontmatterValue === "string" && frontmatterValue !== "") {
		return frontmatterValue;
	}
	const firstLine = body.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
	return firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine;
}

/**
 * 按 pi 的发现规则列出全部提示词模板（全局 + 项目）。
 * 同名去重：项目级优先（pi 的 expandPromptTemplate 用 find，先命中先生效，
 * 其加载顺序是全局在前 —— 但项目级覆盖全局是这类工具的通行语义，
 * 且此处只影响补全列表展示，不影响 pi 的实际展开）。
 */
export function listPromptTemplates(cwd: string, agentDir: string): PromptTemplateItem[] {
	const globalTemplates = scanDir(join(agentDir, "prompts"));
	const projectTemplates = scanDir(join(cwd, PROJECT_CONFIG_DIR, "prompts"));

	const byName = new Map<string, PromptTemplateItem>();
	for (const t of globalTemplates) byName.set(t.name, t);
	for (const t of projectTemplates) byName.set(t.name, t);
	return [...byName.values()];
}
