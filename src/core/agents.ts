/**
 * 子代理定义加载器：resources/agents/（内置）+ 用户级 getConfigDir()/agents/。
 *
 * 「能力即数据」（AGENTS.md §3）：加一个子代理 = agents/ 下加一个 .md 文件，
 * 零行代码改动。frontmatter 声明 name/description/tools 白名单，正文是提示片段，
 * 与 modes/ 同款「双面文件」机制。
 *
 * `model` 是可选字段（spec: add-subagent-task-tool 预留，2026-09-16 落地——
 * pi/opencode/codex/dsh/Trae 五家参照全是逐 agent 独立模型，唯独我们缺）：
 * 值为模型标识（`providerId/modelId`，与设置页同一格式），声明了就用它跑子代理，
 * 目录里不可用则响亮报错而不是静默回落主会话模型（回落会让「调研用便宜模型」
 * 的意图悄悄变成主模型费率）。内置四员不写 model——内置文件不知道用户的
 * 模型目录里有什么，写了必然对大多数用户失效；这个字段是给用户级定义用的。
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
import { optionalString, parseFrontmatter, requireString, requireStringArray } from "./frontmatter.ts";

export interface AgentDefinition {
	readonly name: string;
	readonly description: string;
	readonly tools: readonly string[];
	/**
	 * 子代理专用模型标识（`providerId/modelId`）。缺省 = 继承主会话当前模型；
	 * 声明了但目录不可用由执行器响亮报错（理由见文件头）。
	 */
	readonly model: string | undefined;
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
		model: optionalString(doc, "model", file),
		body: doc.body,
	};
}

/**
 * 按文件名序加载一个目录下的全部 .md 定义。
 *
 * 导出供 `experts.ts` 复用（专家私有成员人格 `<expert>/agents/*.md`，spec:
 * fix-team-expert-assets）：成员人格必须与本库**同源**——两边同一套解析与校验，
 * 才不会出现「专家说有这个成员、运行时说这个文件不合法」的错配。
 */
export function loadAgentsDir(dir: string): readonly AgentDefinition[] {
	return readdirSync(dir)
		.filter((name) => name.endsWith(".md") && !name.startsWith("."))
		.sort()
		.map((name) => loadAgentFile(join(dir, name), name));
}

/**
 * 合并「全局 agents 库」与「当前专家的私有成员人格」（spec: fix-team-expert-assets）。
 *
 * 顺序 = 全局在前、专家私有在后：前者是稳定基线（内置四员 + 用户覆盖），
 * 后者随绑定专家变化。重名时保留全局那一份——加载期已禁止重名（experts.ts
 * 对「私有成员名撞全局库」抛错），这里的去重只是防御第二道：真撞了也必须是
 * 同名同义的稳定定义优先，而不是让专家包悄悄改写全局人格。
 *
 * @param globalAgents 全局库（内置 + 用户级，已去重）
 * @param expertAgents 当前专家的私有成员人格；未绑定专家或专家无成员时为 `[]`
 */
export function mergeAgentPools(
	globalAgents: readonly AgentDefinition[],
	expertAgents: readonly AgentDefinition[],
): readonly AgentDefinition[] {
	if (expertAgents.length === 0) return globalAgents;
	const byName = new Map<string, AgentDefinition>();
	for (const def of globalAgents) byName.set(def.name, def);
	for (const def of expertAgents) {
		if (!byName.has(def.name)) byName.set(def.name, def);
	}
	return [...byName.values()];
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
