/**
 * 专家定义加载器：resources/experts/（内置）+ 用户级 getConfigDir()/experts/。
 *
 * 「能力即数据」（AGENTS.md §3）：加一个专家 = experts/ 下加一个 .md 文件，
 * 零行代码改动。与 agents.ts 同族，但专家是**主会话级人格**（spec:
 * add-expert-mode，WorkBuddy PluginAgentPrompt 的等价物），不是子代理——
 * 因此 frontmatter 没有 tools 字段：工具面由模式（expert 模式 = craft 同款
 * 全工具面）统一分配，专家文件只带身份（displayName/profession）与正文人格。
 *
 * 合并语义：用户级与内置按 name 对齐，同名用户级覆盖内置。项目级专家明确不做。
 *
 * 校验从紧（坏文件抛错而非忽略）：
 *   - frontmatter 的 name 必须与文件名一致（防改名漏改引用，与 agents/modes 同款）
 *   - name/description/displayName/profession/displayDescription/quickPrompts/tags 缺失 → 抛错
 *     （displayName/profession/displayDescription 是模式菜单与对话头部的展示字段，
 *     quickPrompts 是对话页起手 chips 的数据源，tags 是专家市场页卡片 chips
 *     与分类行的数据源，缺了 UI 无可显示）
 *   - quickPrompts 不是恰好 3 个字符串的数组 → 抛错（chips 固定 3 个，
 *     少了排不满、多了放不下，宽严都会让 UI 静默变形）
 *   - tags 不是恰好 3 个字符串的数组 → 抛错（与 quickPrompts 同理：
 *     卡片固定排 3 个 tag chip）
 *   - 内置目录缺失或为空 → 抛错：没有内置专家是打包错误，静默空跑等于
 *     专家菜单在真实会话里一片空白
 *   - 用户目录不存在 = 空（用户没有自定义是正常状态，不是错误）
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, requireString, requireStringArray } from "./frontmatter.ts";

export interface ExpertDefinition {
	readonly name: string;
	readonly description: string;
	readonly displayName: string;
	readonly profession: string;
	/** 一句话能力描述（专家菜单副行）。 */
	readonly displayDescription: string;
	/** 起手问题，恰好 3 个（对话页输入区上方的可点 chips）。 */
	readonly quickPrompts: readonly string[];
	/** 领域关键词，恰好 3 个（专家市场页卡片 tag chips 与分类行聚合的数据源）。 */
	readonly tags: readonly string[];
	/**
	 * 来源目录。加载器在合并时打点（加载单文件时来源未知，由目录级函数盖章）：
	 * 同名用户级覆盖内置后即为 "user" —— 专家市场页「我的专家」子页靠它筛选。
	 */
	readonly source: "builtin" | "user";
	readonly body: string;
}

function loadExpertFile(file: string, fileName: string): Omit<ExpertDefinition, "source"> {
	const doc = parseFrontmatter(readFileSync(file, "utf8"), file);
	const name = requireString(doc, "name", file);
	if (name !== fileName.replace(/\.md$/, "")) {
		throw new Error(`${file}: frontmatter name「${name}」与文件名不一致`);
	}
	// 字段校验按声明顺序逐个进行：坏文件报错时从前往后指，人与测试都好定位。
	const description = requireString(doc, "description", file);
	const displayName = requireString(doc, "displayName", file);
	const profession = requireString(doc, "profession", file);
	const displayDescription = requireString(doc, "displayDescription", file);
	const quickPrompts = requireStringArray(doc, "quickPrompts", file);
	if (quickPrompts.length !== 3) {
		throw new Error(`${file}: frontmatter「quickPrompts」必须恰好 3 个起手问题，当前 ${quickPrompts.length} 个`);
	}
	const tags = requireStringArray(doc, "tags", file);
	if (tags.length !== 3) {
		throw new Error(`${file}: frontmatter「tags」必须恰好 3 个关键词，当前 ${tags.length} 个`);
	}
	return {
		name,
		description,
		displayName,
		profession,
		displayDescription,
		quickPrompts,
		tags,
		body: doc.body,
	};
}

/** 按文件名序加载一个目录下的全部 .md 定义，并盖上来源章。 */
function loadExpertsDir(dir: string, source: "builtin" | "user"): ExpertDefinition[] {
	return readdirSync(dir)
		.filter((name) => name.endsWith(".md") && !name.startsWith("."))
		.sort()
		.map((name) => ({ ...loadExpertFile(join(dir, name), name), source }));
}

/**
 * 加载内置 + 用户级专家定义。
 *
 * @param resourcesExpertsDir 内置目录（resources/experts），缺失或为空抛错
 * @param userExpertsDir 用户级目录（getConfigDir()/experts），不存在视为空
 */
export function loadExperts(resourcesExpertsDir: string, userExpertsDir: string): readonly ExpertDefinition[] {
	if (!existsSync(resourcesExpertsDir)) {
		throw new Error(`内置专家目录缺失：${resourcesExpertsDir}。这是打包错误——没有内置专家，专家模式无可用人格`);
	}
	const builtin = loadExpertsDir(resourcesExpertsDir, "builtin");
	if (builtin.length === 0) {
		throw new Error(`内置专家目录为空：${resourcesExpertsDir}。这是打包错误`);
	}

	const user = existsSync(userExpertsDir) ? loadExpertsDir(userExpertsDir, "user") : [];

	// Map 保序：内置按文件名序先入，用户级同名覆盖（值替换、位置不变），
	// 用户独有的追加在后。目录内不会有重名——name 强制等于文件名，文件名本身唯一。
	const byName = new Map<string, ExpertDefinition>();
	for (const def of builtin) byName.set(def.name, def);
	for (const def of user) byName.set(def.name, def);
	return [...byName.values()];
}
