/**
 * 子代理定义加载器：resources/agents/（内置）+ 用户级 getConfigDir()/agents/。
 *
 * 「能力即数据」（AGENTS.md §3）：加一个子代理 = agents/ 下加一个 .md 文件，
 * 零行代码改动。frontmatter 声明 name/description/tools 白名单，正文是提示片段，
 * 与 modes/ 同款「双面文件」机制。
 *
 * 合并语义：用户级与内置按 name 对齐，同名用户级覆盖内置（pi 的 project 覆盖
 * user 同款语义，spec: add-subagent-task-tool）。项目级 agents 明确不做——
 * repo 可控提示词是注入面。
 *
 * 校验从紧（坏文件抛错而非忽略）：
 *   - frontmatter 的 name 必须与文件名一致（防改名漏改引用，与 modes 的 id 校验同款）
 *   - name/description 缺失、tools 缺失或为空数组 → 抛错（没有工具的子代理无法工作）
 *   - 内置目录缺失或为空 → 抛错：没有内置子代理是打包错误，静默空跑等于
 *     task 工具在真实会话里一个 agent 都看不到
 *   - 用户目录不存在 = 空（用户没有自定义是正常状态，不是错误）
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter, requireString, requireStringArray } from "./frontmatter.ts";

export interface AgentDefinition {
	readonly name: string;
	readonly description: string;
	readonly tools: readonly string[];
	readonly body: string;
}

function loadAgentFile(file: string, fileName: string): AgentDefinition {
	const doc = parseFrontmatter(readFileSync(file, "utf8"), file);
	const name = requireString(doc, "name", file);
	if (name !== fileName.replace(/\.md$/, "")) {
		throw new Error(`${file}: frontmatter name「${name}」与文件名不一致`);
	}
	const tools = requireStringArray(doc, "tools", file);
	if (tools.length === 0) {
		throw new Error(`${file}: tools 不能为空数组——没有任何工具的子代理无法工作`);
	}
	return {
		name,
		description: requireString(doc, "description", file),
		tools,
		body: doc.body,
	};
}

/** 按文件名序加载一个目录下的全部 .md 定义。 */
function loadAgentsDir(dir: string): AgentDefinition[] {
	return readdirSync(dir)
		.filter((name) => name.endsWith(".md") && !name.startsWith("."))
		.sort()
		.map((name) => loadAgentFile(join(dir, name), name));
}

/**
 * 加载内置 + 用户级子代理定义。
 *
 * @param resourcesAgentsDir 内置目录（resources/agents），缺失或为空抛错
 * @param userAgentsDir 用户级目录（getConfigDir()/agents），不存在视为空
 */
export function loadAgents(resourcesAgentsDir: string, userAgentsDir: string): readonly AgentDefinition[] {
	if (!existsSync(resourcesAgentsDir)) {
		throw new Error(`内置子代理目录缺失：${resourcesAgentsDir}。这是打包错误——没有内置子代理，task 工具无可用 agent`);
	}
	const builtin = loadAgentsDir(resourcesAgentsDir);
	if (builtin.length === 0) {
		throw new Error(`内置子代理目录为空：${resourcesAgentsDir}。这是打包错误`);
	}

	const user = existsSync(userAgentsDir) ? loadAgentsDir(userAgentsDir) : [];

	// Map 保序：内置按文件名序先入，用户级同名覆盖（值替换、位置不变），
	// 用户独有的追加在后。目录内不会有重名——name 强制等于文件名，文件名本身唯一。
	const byName = new Map<string, AgentDefinition>();
	for (const def of builtin) byName.set(def.name, def);
	for (const def of user) byName.set(def.name, def);
	return [...byName.values()];
}
