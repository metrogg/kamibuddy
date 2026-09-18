/**
 * 专家资产门禁 —— spec: fix-team-expert-assets 的机械执行。
 *
 * 起因（2026-09-18 对比分析）：两个团队型专家是照搬 WorkBuddy 专家团规范的产物，
 * 人设正文指挥 `TeamCreate` + `Agent(name, subagent_type)`，而本产品既没有这两个工具、
 * 也没有正文点名的那些成员人格——`team_create` 在 spawn 校验处必然失败并整队解散，
 * 模型退化为「自己模拟成员发言」。这类错配**看起来一切正常**：文件在、专家能选、
 * 提示词能注入，只有真跑到建团那一刻才炸。所以必须有门禁在静态期拦住它。
 *
 * 检查项（只对 `expertType: "team"` 的专家生效，单体专家不指挥团队）：
 *   1. 必须有非空 `agents/`（加载器已抛错，这里再给一条可读的诊断）；
 *   2. 正文里 `agent: "xxx"` 的每个 ID 必须真的在该专家的 `agents/` 里；
 *   3. 私有成员必须都被正文点名（没被点名的成员模型永远找不到它）；
 *   4. 正文不得出现 `TeamCreate` / `subagent_type` / `Agent(` —— 那是另一套运行时
 *      的工具名与参数，出现即说明资产没跟着运行时改写。
 *
 * 为什么走真实加载器（core/experts.ts + core/agents.ts）而不是自己扫目录：
 * 自己扫就会长出第二套规则，门禁绿的口径与运行时加载的口径可能不一致——
 * 「门禁说没问题、加载器说文件不合法」正是本门禁要消灭的那类错配。
 *
 * 用法：npm run check:expert-assets（纳入 npm run check）
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadAgents } from "../src/core/agents.ts";
import { getBuiltinSkillDirs, getConfigDir, getResourcesDir } from "../src/core/config-paths.ts";
import { loadExperts } from "../src/core/experts.ts";

/** 另一套运行时的工具名/参数：出现即资产没本地化。 */
const FORBIDDEN = ["TeamCreate", "subagent_type", "Agent("] as const;

/** 正文里引用成员人格的写法：`agent: "<id>"`。 */
const AGENT_REF_RE = /agent:\s*"([a-z0-9][a-z0-9_-]*)"/g;

interface Failure {
	readonly file: string;
	readonly message: string;
}

/** 专家目录下 expert.md 的相对路径（报告里定位用）。 */
function expertFile(expertName: string): string {
	return join("resources", "experts", expertName, "expert.md");
}

function main(): void {
	const resourcesDir = getResourcesDir();
	const expertsDir = join(resourcesDir, "experts");
	const experts = loadExperts(
		expertsDir,
		join(getConfigDir(), "experts"),
		[...getBuiltinSkillDirs()],
		loadAgents(join(resourcesDir, "agents"), join(getConfigDir(), "agents")),
	);

	const failures: Failure[] = [];
	const report: string[] = [];
	let teams = 0;

	for (const expert of experts) {
		if (expert.expertType !== "team") continue;
		teams += 1;
		const file = expertFile(expert.name);

		const agentNames = expert.agents.map((agent) => agent.name);
		if (agentNames.length === 0) {
			failures.push({ file, message: "声明了 expertType: team 但没有成员人格（agents/ 为空或缺失）" });
			continue;
		}

		const referenced = new Set<string>();
		for (const match of expert.body.matchAll(AGENT_REF_RE)) {
			const id = match[1];
			if (id !== undefined) referenced.add(id);
		}
		if (referenced.size === 0) {
			failures.push({
				file,
				message: `正文没有用 \`agent: "<id>"\` 点名任何成员，模型无从知道该 spawn 谁（成员：${agentNames.join("、")}）`,
			});
		}
		for (const id of [...referenced].sort()) {
			if (!agentNames.includes(id)) {
				failures.push({
					file,
					message: `正文引用的成员「${id}」不在本专家的 agents/ 里（可用：${agentNames.join("、")}）`,
				});
			}
		}
		for (const name of agentNames) {
			if (!referenced.has(name)) {
				failures.push({
					file,
					message: `成员「${name}」没有被正文点名，模型永远用不到它（要么写进成员表，要么删掉这个人格文件）`,
				});
			}
		}

		for (const token of FORBIDDEN) {
			const index = expert.body.indexOf(token);
			if (index >= 0) {
				const line = expert.body.slice(0, index).split("\n").length;
				failures.push({
					file,
					message: `正文第 ${line} 行出现「${token}」——那是别的运行时的工具名/参数，本产品没有它`,
				});
			}
		}

		report.push(`  团队专家  ${expert.name}（${agentNames.length} 名成员：${agentNames.join("、")}）`);
	}

	if (failures.length === 0) {
		console.log(`check-expert-assets: ${teams} 个团队型专家的成员人格与工具语义全部对得上。`);
		for (const line of report) console.log(line);
		process.exit(0);
	}

	console.error("check-expert-assets 失败：");
	for (const failure of failures) console.error(`  ${failure.file}: ${failure.message}`);
	console.error("\n团队型专家必须自带成员人格（<专家>/agents/<id>.md）并用本运行的工具语义调度：");
	console.error('  team_create { name, members: [{ name: "花名", agent: "<id>", task }] }');
	console.error(`正文禁止出现：${FORBIDDEN.join(" / ")}`);
	process.exit(1);
}

// getResourcesDir 依赖打包布局；缺目录时给一条明确诊断而不是堆栈。
if (!existsSync(join(getResourcesDir(), "experts"))) {
	console.error(`check-expert-assets: 找不到专家目录 ${join(getResourcesDir(), "experts")}`);
	process.exit(1);
}
if (readdirSync(join(getResourcesDir(), "experts")).length === 0) {
	console.error(`check-expert-assets: 专家目录为空 ${join(getResourcesDir(), "experts")}`);
	process.exit(1);
}
main();
