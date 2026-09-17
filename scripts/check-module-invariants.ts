/**
 * 模块不变量登记门禁 —— spec: adopt-dsh-disciplines Task 1.3（缩小版）。
 *
 * 形态（有意**不**照搬 Cordis 的 `./invariant` 伴随插件）：登记表是一张**集中表**
 * （下面的 INVARIANTS / EXEMPT），机械校验扫 `SCOPE` 圈定的模块 —— 每个模块都要回答
 * 同一个问题「有没有可**独立分叉观测**的关系」：
 *   - 有 → 写进 INVARIANTS：`relationship`（那条关系）+ `observation`（在哪儿能独立观测到分歧）；
 *   - 没有 → 写进 EXEMPT：**必须写理由**（无理由的豁免与没登记一样失败）。
 *
 * 首轮只覆盖**有明确不变量的**四个域（不追求覆盖 shared/core/daemon 全部）：
 *   会话事件折叠 / 提示词字节稳定 / 权限判定 / 台账口径。
 * 判据是「可独立观测」：同一份输入在两条独立路径上走，能不能分叉出不同结果 ——
 * 能，就值得钉；不能（如纯类型与常量模块），就写理由豁免。
 *
 * 【2026-09-17 修】SCOPE 原先只有 shared / core / extensions 三处，**没有 daemon 域**
 * —— 而 spec 要求首轮覆盖 `shared/`、`core/`、`daemon/`。于是 daemon 侧两个
 * 「结论要能追溯到另一条路径」的产出（统计聚合口径、提示词预览）不会被门禁要求登记，
 * 改动让它们与真实来源分叉时没有任何东西变红。补上这两个域 + 首轮登记。
 *
 * 与 `scripts/check-model-experience.ts` 的分工：那个管「模型看到什么」，这个管
 * 「模块之间的哪个关系不许分叉」。两者都不替代测试 —— 表里 `observation` 指的就是
 * 那条关系现在由哪个测试钉着；改动让断言失效时，登记表也会在评审里被看见。
 *
 * 用法：npm run check:invariants（纳入 npm run check）
 */

import { existsSync, readdirSync } from "node:fs";

/** 首轮扫描范围。每个 pattern 是一个「域」：域内新增模块必须登记或写理由豁免。 */
const SCOPE: readonly { readonly dir: string; readonly file: RegExp; readonly why: string }[] = [
	{ dir: "src/shared", file: /^conversation\.ts$/, why: "会话事件折叠" },
	{ dir: "src/shared", file: /^observability\.ts$/, why: "台账 / 统计的口径与形状" },
	{ dir: "src/core", file: /^(system-)?prompt-composer\.ts$/, why: "提示词组装（字节稳定的产出侧）" },
	{ dir: "src/core", file: /^run-ledger\.ts$/, why: "运行台账（写入纪律与闭合）" },
	{ dir: "src/extensions", file: /^prompt-switch\.ts$/, why: "提示词与注入的装配点" },
	{ dir: "src/extensions", file: /^permission-[a-z-]+\.ts$/, why: "权限判定链与规则引擎" },
	{ dir: "src/daemon", file: /^usage-stats\.ts$/, why: "台账口径（跨会话统计的聚合产出侧）" },
	{ dir: "src/daemon", file: /^prompt-preview\.ts$/, why: "提示词字节稳定（预览与真实组装同源）" },
];

/** 首轮必须出现的四个域（删掉某个域的登记即失败）。 */
const REQUIRED_CONCERNS = [
	"会话事件折叠",
	"提示词字节稳定",
	"权限判定",
	"台账口径",
] as const;

interface InvariantEntry {
	/** 所属域（必须在 REQUIRED_CONCERNS 里）。 */
	readonly concern: string;
	/** 仓库相对路径。 */
	readonly module: string;
	/** 可独立分叉观测的关系：谁与谁必须一致 / 必须有序 / 必须闭合。 */
	readonly relationship: string;
	/** 这条关系现在由哪儿独立观测（测试文件或纯函数入口）。 */
	readonly observation: string;
}

/** 有明确不变量的模块 —— 首轮四个域。 */
const INVARIANTS: readonly InvariantEntry[] = [
	{
		concern: "会话事件折叠",
		module: "src/shared/conversation.ts",
		relationship:
			"同一事件流折叠出的视图，必须与「按同一顺序逐事件应用」的增量结果一致 —— daemon 与 renderer 共用这一个 reducer，两端各自折叠必然分叉（症状是「刷新后内容变了」）",
		observation: "src/shared/conversation.test.ts",
	},
	{
		concern: "提示词字节稳定",
		module: "src/core/prompt-composer.ts",
		relationship:
			"同一输入（骨架 / 片段 / 模式 / 风格 / 人格 / piContext）产出的 systemPrompt 逐字节相同；产物的任何差异都必须能追溯到输入的差异",
		observation:
			"src/core/prompt-composer.test.ts（段序与槽位）+ src/extensions/prompt-switch.test.ts（会话内字节稳定）",
	},
	{
		concern: "提示词字节稳定",
		module: "src/core/system-prompt-composer.ts",
		relationship:
			"会话内两次组装逐字节相等：逐轮事实（时间 / 记忆内容 / 个性化 / cwd）与随机器变的事实（托管 Python 解释器路径）绝不出现在产物里",
		observation: "src/extensions/prompt-switch.test.ts 的字节稳定用例（work × code × 三种模式）",
	},
	{
		concern: "提示词字节稳定",
		module: "src/extensions/prompt-switch.ts",
		relationship:
			"before_agent_start 必须返回整串 systemPrompt；context 注入只在消息数组末尾追加，不改动任何既有消息（逐条引用与字节都不变）",
		observation: "src/extensions/prompt-switch.test.ts",
	},
	{
		concern: "权限判定",
		module: "src/extensions/permission-policy.ts",
		relationship:
			"判定链有序：靠后的阶段不能放行靠前阶段已拒的动作；同输入同输出（纯函数，无隐藏状态）",
		observation: "src/extensions/permission-policy.test.ts",
	},
	{
		concern: "权限判定",
		module: "src/extensions/permission-rules.ts",
		relationship:
			"最严获胜：链式命令拆分后任一段 deny ⇒ 整体 deny；全部段 allow ⇒ allow；否则 unmatched（调用方维持高风险询问）",
		observation: "src/extensions/permission-rules.test.ts",
	},
	{
		concern: "权限判定",
		module: "src/extensions/permission-gate.ts",
		relationship:
			"门只翻译不决策：拦 / 不拦的结论必须与 permission-policy.decide 一致；unattended 下 ask 一律转拒（fail-closed）",
		observation: "src/extensions/permission-gate.test.ts",
	},
	{
		concern: "台账口径",
		module: "src/core/run-ledger.ts",
		relationship:
			"seq 单调无空洞（写盘成功才消耗序号）+ run 闭合（读到未闭合 run 必须补合成 run_end{interrupted}，不截断历史）",
		observation: "src/core/run-ledger.test.ts",
	},
	{
		concern: "台账口径",
		module: "src/daemon/usage-stats.ts",
		relationship:
			"同一批会话的三个视图必须同源同口径：总量四桶之和 = 模型明细 tokens 之和 = 每日 tokens 之和（都含缓存读写）；子代理的用量照计入 token 与费用，但不进会话维度（会话数 / 消息数 / 热力图 / 工具排行）—— 两侧口径各自独立累加，改一处不会连累另一处",
		observation:
			"src/daemon/usage-stats.test.ts（「模型明细含缓存读写，token 合计与总量一致」钉视图一致；「会话维度排除子代理，但 token 与费用照算」钉两个维度的进出）",
	},
	{
		concern: "提示词字节稳定",
		module: "src/daemon/prompt-preview.ts",
		relationship:
			"预览的分段与字数必须来自与真实会话**同一个** assembleSystemPrompt（同段序、同 read/bash/use_skill 技能段门控、同专家人格路径）；允许的差异只有文件头列出的两条（无活会话 ⇒ piContext 置空、styleId 三态），不得在 daemon 侧另写一份镜像组装",
		observation:
			"src/daemon/prompt-preview.test.ts（技能段门控与真实组装同一条规则 / 专家人格同一条路径），被删掉的镜像门控是这条关系的由来",
	},
];

/** 回答了「没有可独立分叉观测的关系」的模块 —— 理由必填。 */
const EXEMPT: readonly { readonly module: string; readonly reason: string }[] = [
	{
		module: "src/shared/observability.ts",
		reason:
			"只定义台账 / 统计的数据形状、常量与纯派生函数（三桶计费口径、内容指纹、tok/s）：自身没有状态、不写盘，没有可独立分叉的观测关系 —— 这些口径的一致性由消费方（run-ledger / cache-prefix / 会话统计）的测试观测。",
	},
];

interface Failure {
	readonly subject: string;
	readonly message: string;
}

const failures: Failure[] = [];

for (const concern of REQUIRED_CONCERNS) {
	if (!INVARIANTS.some((entry) => entry.concern === concern)) {
		failures.push({ subject: concern, message: "登记表里没有任何该域的不变量条目" });
	}
}

for (const entry of INVARIANTS) {
	const subject = entry.module;
	if (!REQUIRED_CONCERNS.includes(entry.concern as (typeof REQUIRED_CONCERNS)[number])) {
		failures.push({ subject, message: `concern「${entry.concern}」不在首轮四域里（${REQUIRED_CONCERNS.join(" / ")}）` });
	}
	if (!existsSync(entry.module)) {
		failures.push({ subject, message: "登记条目指向不存在的模块（陈旧条目）" });
	}
	for (const [field, value] of Object.entries({ relationship: entry.relationship, observation: entry.observation })) {
		if (value.trim() === "") failures.push({ subject, message: `${field} 为空 —— 空条目与没登记一样` });
	}
	if (EXEMPT.some((exempt) => exempt.module === entry.module)) {
		failures.push({ subject, message: "同一模块不能既登记不变量又声明豁免" });
	}
}

for (const entry of EXEMPT) {
	if (!existsSync(entry.module)) {
		failures.push({ subject: entry.module, message: "豁免条目指向不存在的模块（陈旧条目）" });
	}
	if (entry.reason.trim() === "") {
		failures.push({ subject: entry.module, message: "豁免必须写理由：说明为什么本模块没有可独立分叉观测的关系" });
	}
}

/** 扫描范围内应被覆盖的模块（去重排序）。 */
function inScope(): string[] {
	const files = new Set<string>();
	for (const pattern of SCOPE) {
		for (const entry of readdirSync(pattern.dir, { withFileTypes: true })) {
			if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
			if (pattern.file.test(entry.name)) files.add(`${pattern.dir}/${entry.name}`);
		}
	}
	return [...files].sort();
}

const scope = inScope();
for (const file of scope) {
	const registered = INVARIANTS.some((entry) => entry.module === file);
	const exempt = EXEMPT.some((entry) => entry.module === file);
	if (!registered && !exempt) {
		failures.push({
			subject: file,
			message: "缺登记且无理由：要么在 INVARIANTS 里写清那条可独立分叉观测的关系，要么在 EXEMPT 里写清为什么没有",
		});
	}
}

if (failures.length === 0) {
	console.log(
		`check-module-invariants: ${scope.length} 个在范围模块（不变量 ${INVARIANTS.length} / 豁免 ${EXEMPT.length}）全部有登记。`,
	);
	for (const entry of INVARIANTS) console.log(`  不变量  [${entry.concern}] ${entry.module} ← ${entry.observation}`);
	for (const entry of EXEMPT) console.log(`  豁免    ${entry.module}`);
	process.exit(0);
}

console.error("check-module-invariants 失败：");
for (const failure of failures) {
	console.error(`  ${failure.subject}: ${failure.message}`);
}
console.error("\n登记表形态：每个模块回答「有没有可独立分叉观测的关系」——");
console.error(`  有 → INVARIANTS（concern / module / relationship / observation），首轮四域：${REQUIRED_CONCERNS.join(" / ")}`);
console.error("  没有 → EXEMPT（module / reason），理由必填。");
process.exit(1);
