/**
 * 上下文快照探针（spec: persist-context-snapshots 的 Task 7 验收）。
 *
 * 回答一个问题：**把「逐 run 可变事实」从「每请求现算的尾部注入块」改成
 * 「`before_agent_start` 返回的持久快照消息」之后，provider 真给的读数变了吗。**
 *
 * 两个判据（都来自 spec 的 ADDED Requirements）：
 *   ① 相邻两次调用 `prompt_{N-1} − cacheRead_N ≤ 128`（改动前实测恒为 2,423…2,615）；
 *   ② 会话级**加权**命中率 `ΣcacheRead / Σprompt` 相对基线 90.9% 的改善。
 *
 * 为什么必须真跑：`cacheRead` 是 provider 的读数，本地怎么算都不作数；
 * 而「快照有没有真的进历史、落在哪」也只有把真实会话文件与台账 dump 出来才知道。
 *
 * ## 走的是生产装配入口（不另搭测试旁路）
 *
 * - 会话：`SessionHost.create()`（与 daemon 建用户会话同一个入口），
 *   `sceneId=work` / `interactionId=craft`、真实 `resources/`、真实 `ModelCatalog`
 *   （真凭据 + 真网络请求）、真实 `~/.kamibuddy` 配置目录。
 * - 注入：**真实的 `createPromptSwitch`**，两条通道都接真源头 ——
 *   `composeRuntimeContext` 读真实的三层记忆与个性化（`formatRuntimeContext`，
 *   与 daemon 的 `buildRuntimeContext` 同函数），`composeHiddenContext` 取宿主
 *   真实的 `peekHiddenContext()`。**没有任何一处注入内容是本探针自拼的字符串**
 *   —— 那样测不到真实块的大小与去重行为（本探针存在的意义）。
 * - 提示词：`createSystemPromptComposerFromDefaults`（daemon 的同一个组装入口）。
 * - 台账：`RunLedger` 写进真实 `~/.kamibuddy/logs/runs/`（与 daemon 同一个目录与
 *   构造方式），读数由**台账 fold** 得出，不靠探针自己的计数器 ——
 *   「读数来自实际台账」这条纪律与基线对照（同一套 fold 复算 `01a0b2b3-…`）共用一份实现。
 *
 * ## 与真实 app 会话的差异（如实登记，别把探针读数当 app 读数）
 *
 * 1. **工具面更小**：探针只装 prompt-switch 一个扩展，所以工具面 = pi 内置工具 ∩
 *    craft 白名单（read/write/edit/find/grep/ls…）。真实 app 会话另有扩展注册的工具
 *    （web_search / powershell / present_files / docx_* / questionnaire /
 *    conversation_search / use_skill…）。工具 schema 是请求里的**常量前缀**，
 *    不参与 gap 判据（gap 比的是相邻两次请求的最长公共前缀），但会改变加权命中率的
 *    绝对值（分母里的常量项）—— 与基线对照时把这条差异计入。
 * 2. **没有权限门 / 沙箱 / present_files**：模型写文件走 pi 内置 write，直接执行。
 *    这与「写不进去导致 run 停不下来」无关，只影响真实 app 里的审批交互。
 * 3. **不绑专家**（expertId 恒 undefined），两轴恒 work/craft。
 *
 * ## 用法
 *
 *   npx tsx scripts/probe-context-snapshot.ts [--model=provider/model]
 *   npx tsx scripts/probe-context-snapshot.ts --replay=<台账.jsonl>   # 只跑 fold，不发请求
 *
 * `--replay` 是**对照组**入口：用同一套 fold 复算改动前的基线台账
 * （`~/.kamibuddy/logs/runs/01a0b2b3-….jsonl`），确认 2,423…2,615 / 90.9% 可复现
 * —— 没有这一步，上面的对比不成立。
 *
 * 前提不成立就响亮退出（无凭据 / 模型不可用 / 请求失败 / 调用数不足），
 * 绝不给出「看起来像个结论」的读数。
 *
 * 会发起真实模型请求（约 15 次，成本与基线那次同量级，历史基线约 $0.06）。
 * 会话 cwd 用临时目录（不碰用户工作区）；会话文件与台账落在真实配置目录
 * （这就是「真实会话形态」，也是事后可复核的证据）。
 *
 * 收尾纪律（同 probe-prompt-cache）：Windows TTY 上 stdout 异步，紧跟着 process.exit
 * 会截掉还没写完的输出 —— 退出前显式等一次写回调；关键读数各占一行、行内不夹长句。
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkills } from "@earendil-works/pi-coding-agent";
import {
	getBuiltinSkillDirs,
	getConfigDir,
	getResourcesDir,
	getSessionsDir,
} from "../src/core/config-paths.ts";
import { loadAgents } from "../src/core/agents.ts";
import { loadExperts } from "../src/core/experts.ts";
import { buildMemorySection } from "../src/core/memory.ts";
import { ModelCatalog } from "../src/core/model-catalog.ts";
import { getEffectiveWorkspaceRoot, readPreferences } from "../src/core/preferences.ts";
import {
	formatRuntimeContext,
	sessionSkillPaths,
	type PersonalizationSection,
	type PromptContextOptions,
	type SkillDescriptor,
} from "../src/core/prompt-composer.ts";
import { loadResources } from "../src/core/resources.ts";
import { RunLedger, ledgerFileName, readLedgerEntries } from "../src/core/run-ledger.ts";
import { collectRuntimeInventory } from "../src/core/runtime-inventory.ts";
import { SessionHost } from "../src/core/session-host.ts";
import { filterEnabledSkills } from "../src/core/skill-status.ts";
import { createSystemPromptComposerFromDefaults } from "../src/core/system-prompt-composer.ts";
import { createPromptSwitch } from "../src/extensions/prompt-switch.ts";
import {
	billedInputTokens,
	type LlmCallData,
	type RequestSnapshotData,
	type RunLedgerEntry,
	type SystemSegmentStat,
} from "../src/shared/observability.ts";

/* ── 前提：模型、凭据、资源 ─────────────────────────────────────── */

function die(message: string): never {
	console.error(`\n✗ 前提不成立，探针拒绝给出结论：\n  ${message}\n`);
	process.exit(1);
}

const MODEL_PREFIX = "--model=";
const REPLAY_PREFIX = "--replay=";
const argv = process.argv.slice(2);
const requestedModel = argv.find((a) => a.startsWith(MODEL_PREFIX))?.slice(MODEL_PREFIX.length);
const replayPath = argv.find((a) => a.startsWith(REPLAY_PREFIX))?.slice(REPLAY_PREFIX.length);

/* ── fold（唯一实现处：live 与 replay 共用，口径不许分家）────────────
 *
 * 口径：
 *   prompt_N    = input + cacheRead + cacheWrite（shared/observability.ts 的
 *                 billedInputTokens，与 UI / 基线同一口径）
 *   cacheRead_N = provider 上报的命中量
 *   gap_N       = prompt_{N-1} − cacheRead_N（spec 的判据；改动前恒 2,423…2,615）
 *
 * 未命中拆解是**恒等式**（不是估算）：
 *   prompt_N − cacheRead_N = (prompt_N − prompt_{N-1}) + gap_N
 *                          = 「本轮新增内容」+ 「上一轮前缀没被命中的那一截」
 * 所以冷启动 + Σ新增 + Σgap 必然等于实测未命中 —— 用它反过来校验读数自洽。
 */

interface CallReading {
	/** 会话内第几次模型调用（1 起）。 */
	readonly index: number;
	readonly runId: string;
	readonly turnIndex: number;
	readonly prompt: number;
	readonly input: number;
	readonly cacheRead: number;
	readonly cacheWrite: number;
	readonly output: number;
	/** prompt_{N-1} − cacheRead_N；首次调用为 undefined。 */
	gap: number | undefined;
}

interface SnapshotReading {
	readonly runId: string | undefined;
	readonly turnIndex: number | undefined;
	readonly hiddenContextChars: number | undefined;
	readonly listLength: number;
	/** messageList 里 role=other 的下标（快照条目的落位；改动前它们在**末尾**）。 */
	readonly otherAt: readonly number[];
	/** 系统提示词各分段的字符数 + 指纹（判断提示词字节在会话内是否稳定）。 */
	readonly systemSegments: readonly { readonly source: string; readonly chars: number; readonly fp: number | undefined }[];
}

interface Folded {
	readonly calls: readonly CallReading[];
	readonly snapshots: readonly SnapshotReading[];
}

function foldLedger(entries: readonly RunLedgerEntry[]): Folded {
	const calls: CallReading[] = [];
	const snapshots: SnapshotReading[] = [];
	for (const entry of entries) {
		if (entry.kind === "llm_call") {
			const data = entry.data as LlmCallData;
			if (data.usage === undefined) continue;
			calls.push({
				index: calls.length + 1,
				runId: data.runId ?? "(无 runId)",
				turnIndex: data.turnIndex,
				prompt: billedInputTokens(data.usage),
				input: data.usage.input,
				cacheRead: data.usage.cacheRead,
				cacheWrite: data.usage.cacheWrite,
				output: data.usage.output,
				gap: undefined,
			});
		} else if (entry.kind === "request_snapshot") {
			const data = entry.data as RequestSnapshotData;
			const list = data.messageList ?? [];
			snapshots.push({
				runId: data.runId,
				turnIndex: data.turnIndex,
				hiddenContextChars: data.hiddenContextChars,
				listLength: list.length,
				otherAt: list.map((ref, i) => (ref.role === "other" ? i : -1)).filter((i) => i >= 0),
				systemSegments: (data.systemSegments ?? []).map((seg) => ({
					source: seg.source,
					chars: seg.chars,
					fp: seg.fp,
				})),
			});
		}
	}
	for (let i = 1; i < calls.length; i += 1) {
		const prev = calls[i - 1];
		const cur = calls[i];
		if (prev === undefined || cur === undefined) continue;
		cur.gap = prev.prompt - cur.cacheRead;
	}
	return { calls, snapshots };
}

/** 相邻对的性质：`cold` 会话首调、`run-step` run 内相邻 step、`cross-run` 跨 run 首次调用。 */
function pairKind(prev: CallReading, cur: CallReading): "run-step" | "cross-run" {
	return prev.runId === cur.runId ? "run-step" : "cross-run";
}

/** spec 的判据阈值：provider 的块粒度裕度。 */
const GAP_LIMIT = 128;

function report(label: string, ledgerPath: string, folded: Folded): void {
	const { calls, snapshots } = folded;
	console.log(`\n\n===== 读数：${label} =====`);
	console.log(`  台账：${ledgerPath}`);
	if (calls.length === 0) {
		console.log("  （台账里没有任何带 usage 的 llm_call —— 没有读数可报）");
		return;
	}

	console.log("\n  逐次调用（prompt = input+cacheRead+cacheWrite；gap = 上一次 prompt − 本次 cacheRead）：");
	calls.forEach((call, i) => {
		const snapshot = snapshots[i];
		const gapText = call.gap === undefined ? "—（会话首调）" : String(call.gap);
		const kind =
			call.gap === undefined
				? "cold"
				: (() => {
						const prev = calls[i - 1];
						return prev === undefined ? "?" : pairKind(prev, call);
					})();
		const other = snapshot === undefined ? "（无 request_snapshot）" : `other@[${snapshot.otherAt.join(",")}]/${snapshot.listLength}`;
		const hidden = snapshot?.hiddenContextChars === undefined ? "—" : String(snapshot.hiddenContextChars);
		console.log(
			`   #${call.index} ${call.runId}/turn${call.turnIndex} prompt=${call.prompt} cacheRead=${call.cacheRead} gap=${gapText} [${kind}] hiddenChars=${hidden} ${other}`,
		);
	});

	/* ── gap 统计（run 内 / 跨 run 分开算，spec 的两条 Scenario）─── */

	const pairs: { index: number; gap: number; kind: "run-step" | "cross-run"; prompt: number; cacheRead: number }[] = [];
	for (let i = 1; i < calls.length; i += 1) {
		const prev = calls[i - 1];
		const cur = calls[i];
		if (prev === undefined || cur === undefined || cur.gap === undefined) continue;
		pairs.push({ index: i + 1, gap: cur.gap, kind: pairKind(prev, cur), prompt: prev.prompt, cacheRead: cur.cacheRead });
	}
	const runStep = pairs.filter((p) => p.kind === "run-step");
	const crossRun = pairs.filter((p) => p.kind === "cross-run");
	const gapsOf = (list: readonly { gap: number }[]): number[] => list.map((p) => p.gap);
	const stats = (list: readonly { gap: number }[]): string => {
		if (list.length === 0) return "（无相邻对）";
		const g = gapsOf(list);
		return `n=${g.length} min=${Math.min(...g)} max=${Math.max(...g)}`;
	};

	console.log("\n  ── gap 判据（prompt_{N-1} − cacheRead_N ≤ 128；改动前基线恒 2,423…2,615）");
	console.log(`     run 内相邻 step：${stats(runStep)}`);
	console.log(`     跨 run 首次调用：${stats(crossRun)}`);
	console.log(`     全部相邻对    ：${stats(pairs)}`);
	const violations = pairs.filter((p) => p.gap > GAP_LIMIT);
	console.log(`     超过 ${GAP_LIMIT} 的相邻对：${violations.length} 个`);
	for (const v of violations) {
		console.log(`       ✗ #${v.index}（${v.kind}）gap=${v.gap}（上一轮 prompt=${v.prompt}，本次 cacheRead=${v.cacheRead}）`);
	}
	const bucketLines = [
		["gap <= 0", (g: number) => g <= 0],
		["0 < gap <= 128", (g: number) => g > 0 && g <= 128],
		["128 < gap <= 1024", (g: number) => g > 128 && g <= 1024],
		["gap > 1024", (g: number) => g > 1024],
	] as const;
	console.log(
		`     gap 分布：${bucketLines
			.map(([name, test]) => `${name}: ${pairs.filter((p) => test(p.gap)).length}`)
			.join("　")}`,
	);
	// 系统提示词字节在会话内是否稳定：它若变了，gap 塌的成因要另查（不是本改动要测的那条）。
	const segmentShapes = new Set(
		snapshots.filter((s) => s.systemSegments.length > 0).map((s) => JSON.stringify(s.systemSegments)),
	);
	if (segmentShapes.size > 0) {
		console.log(
			`     系统提示词分段形态：${segmentShapes.size} 种${segmentShapes.size === 1 ? "（会话内逐字节稳定）" : "（✗ 有变化 —— gap 的成因要另查）"}`,
		);
	}

	/* ── 加权命中率与未命中拆解 ────────────────────────────────── */

	const sumPrompt = calls.reduce((acc, c) => acc + c.prompt, 0);
	const sumCacheRead = calls.reduce((acc, c) => acc + c.cacheRead, 0);
	const sumMiss = sumPrompt - sumCacheRead;
	const cold = calls[0] === undefined ? 0 : calls[0].prompt - calls[0].cacheRead;
	let growth = 0;
	for (let i = 1; i < calls.length; i += 1) {
		const prev = calls[i - 1];
		const cur = calls[i];
		if (prev === undefined || cur === undefined) continue;
		growth += cur.prompt - prev.prompt;
	}
	const gapSum = pairs.reduce((acc, p) => acc + p.gap, 0);

	console.log("\n  ── 会话级命中（加权：ΣcacheRead / Σprompt，不做简单平均）");
	console.log(`     模型调用 ${calls.length} 次，run ${new Set(calls.map((c) => c.runId)).size} 个`);
	console.log(`     Σprompt=${sumPrompt}　ΣcacheRead=${sumCacheRead}　未命中=${sumMiss}`);
	console.log(`     加权命中率=${((sumCacheRead / sumPrompt) * 100).toFixed(2)}%`);
	console.log("  ── 未命中拆解（恒等式，三项之和必然等于实测未命中）");
	console.log(`     冷启动（首调未命中）＝${cold}`);
	console.log(`     本轮新增内容（Σ prompt_N − prompt_{N-1}）＝${growth}`);
	console.log(`     上一次前缀未命中的残余（Σgap）＝${gapSum}`);
	console.log(
		`     合计 ${cold + growth + gapSum} vs 实测 ${sumMiss}：${cold + growth + gapSum === sumMiss ? "一致" : "✗ 不一致（口径有 bug）"}`,
	);
	console.log(
		`     其中「可避免的固定偏移」占比＝${((gapSum / sumPrompt) * 100).toFixed(2)}%（若 gap≈0，这一项就是 provider 的块粒度残值）`,
	);

	/* ── 关键读数：各占一行、行内不夹长句（长行会被终端中段省略）── */
	const allGaps = gapsOf(pairs);
	console.log("\n  ── 关键读数");
	console.log(`calls=${calls.length}`);
	console.log(`runs=${new Set(calls.map((c) => c.runId)).size}`);
	console.log(`pairs=${pairs.length}`);
	console.log(`gap.min=${allGaps.length === 0 ? "n/a" : Math.min(...allGaps)}`);
	console.log(`gap.max=${allGaps.length === 0 ? "n/a" : Math.max(...allGaps)}`);
	console.log(`gap.over128=${violations.length}`);
	console.log(`hit.weighted=${((sumCacheRead / sumPrompt) * 100).toFixed(2)}%`);
}

/* ── replay：只用 fold 复算任意台账（对照组）──────────────────── */

if (replayPath !== undefined) {
	if (!existsSync(replayPath)) die(`--replay 指的台账不存在：${replayPath}`);
	console.log("=== 上下文快照探针（replay：同一套 fold 复算既有台账）===");
	report("replay", replayPath, foldLedger(readLedgerEntries(replayPath, (m) => console.error(`⚠ ${m}`))));
	await new Promise<void>((resolve) => {
		process.stdout.write("", () => resolve());
	});
	process.exit(0);
}

/* ── live：真实会话 ───────────────────────────────────────────── */

console.log("=== 上下文快照探针（spec: persist-context-snapshots，Task 7）===");
console.log("（走 SessionHost.create + 真实 createPromptSwitch + 真实台账；注入内容全部来自真实读路径）\n");

const catalog = await ModelCatalog.create();
const modelKey = requestedModel ?? readPreferences().activeModelKey;
if (modelKey === undefined || modelKey === "") {
	die("没有可用模型：preferences.json 里没有 activeModelKey，也没有给 --model。");
}
if (!catalog.isUsable(modelKey)) {
	die(`模型「${modelKey}」不可用（models.json 里没有它，或该服务商没配凭据）。`);
}
const resolved = catalog.resolveModel(modelKey) as { baseUrl?: string; api?: string } | undefined;
const endpoint = (resolved?.baseUrl ?? "").replace(/(https?:\/\/[^/?#]+).*/, "$1");
console.log(`模型：${modelKey}（api=${resolved?.api ?? "?"}，端点=${endpoint === "" ? "(未知)" : endpoint}）`);

const resources = loadResources(getResourcesDir());
const SCENE_ID = "work";
const INTERACTION_ID = "craft";

/* 技能 / 专家 / 运行时：与 daemon 同源（同一份 loadSkills 参数、同一个过滤、同一个清单采集） */
function enabledSkillDescriptors(): readonly SkillDescriptor[] {
	const { skills } = loadSkills({
		cwd: getEffectiveWorkspaceRoot(),
		agentDir: getConfigDir(),
		skillPaths: sessionSkillPaths(getBuiltinSkillDirs(), undefined),
		includeDefaults: true,
	});
	return filterEnabledSkills(skills, readPreferences().skillOverrides).map((skill) => ({
		name: skill.name,
		description: skill.description,
		filePath: skill.filePath,
		disableModelInvocation: skill.disableModelInvocation === true,
	}));
}

const composeSystemPrompt = createSystemPromptComposerFromDefaults({
	resourcesDir: getResourcesDir(),
	// 专家库现载（同 daemon）：探针不绑专家，composer 对 expertId === undefined 短路，
	// 这条读路径不会被走到 —— 但传的是**真加载函数**而不是空数组，接线形态与 daemon 一致。
	loadExperts: () =>
		loadExperts(
			join(getResourcesDir(), "experts"),
			join(getConfigDir(), "experts"),
			[...getBuiltinSkillDirs()],
			loadAgents(join(getResourcesDir(), "agents"), join(getConfigDir(), "agents")),
		),
	enabledSkills: async () => enabledSkillDescriptors(),
	onStyleDrift: (drift) => {
		console.error(`⚠ 回复风格配置漂移：偏好要的是「${drift.requested}」，资源库没有，回落「${drift.fallback}」`);
	},
});

/** 与 daemon 的 readPersonalizationSection 同一字段集（注入面就是这四项）。 */
function readPersonalizationSection(): PersonalizationSection {
	const prefs = readPreferences();
	return {
		...(prefs.customInstructions === undefined ? {} : { customInstructions: prefs.customInstructions }),
		...(prefs.userNickname === undefined ? {} : { userNickname: prefs.userNickname }),
		...(prefs.assistantName === undefined ? {} : { assistantName: prefs.assistantName }),
		...(prefs.personaDescription === undefined ? {} : { personaDescription: prefs.personaDescription }),
	};
}

const runtimeInventory = collectRuntimeInventory();
const prefs = readPreferences();
const cwd = mkdtempSync(join(tmpdir(), "kami-probe-context-snapshot-"));
const ledgerDir = join(getConfigDir(), "logs", "runs");
console.log(`工作目录（临时）：${cwd}`);
console.log(`台账目录（真实）：${ledgerDir}`);
console.log(`已启用技能 ${enabledSkillDescriptors().length} 个；记忆段字节数 ${(buildMemorySection(cwd) ?? "").length}\n`);

/** 最近一次组装的系统提示词分段（台账 request_snapshot 的 system 部分，与 daemon 同口）。 */
let lastSegments: readonly SystemSegmentStat[] | undefined;

/** 与台账交叉核对的活口计数（emit 口径；两者不等说明有一条读数通道失真）。 */
let liveUsageCount = 0;

const hostRef: { current?: SessionHost } = {};

const host = await SessionHost.create({
	catalog,
	modelKey,
	cwd,
	isTempTask: false,
	sceneId: SCENE_ID,
	interactionId: INTERACTION_ID,
	emit: (event) => {
		if (event.type !== "assistant_done") return;
		const usage = event.message.usage;
		if (usage !== undefined) liveUsageCount += 1;
	},
	resources,
	getRuntimeInventory: () => runtimeInventory,
	// 系统提示词分段 provenance（daemon 同口）：用来交叉核对「提示词字节在会话内没变」
	// —— 它若变了，gap 会跟着塌，那是另一条原因（不是本改动要测的那条）。
	getSystemPromptSegments: () => lastSegments,
	// 推理强度与 daemon 同口（偏好现读）；resume 才不传，这里是新会话。
	...(prefs.thinkingLevel === undefined ? {} : { thinkingLevel: prefs.thinkingLevel }),
	// 真实台账：与 daemon 同一个目录、同一个构造方式（读数由它 fold 出来）。
	createLedger: (sessionId) => new RunLedger(ledgerDir, sessionId, (message) => console.error(`⚠ 台账：${message}`)),
	extensions: [
		createPromptSwitch({
			getCurrent: () => ({ sceneId: SCENE_ID, interactionId: INTERACTION_ID, expertId: undefined }),
			compose: async (sceneId, interactionId, expertId, piContext: PromptContextOptions) => {
				const composed = await composeSystemPrompt({ sceneId, interactionId, expertId, piContext });
				lastSegments = composed.segments;
				return composed.prompt;
			},
			// 真实读路径：三层记忆内容 + 个性化（与 daemon 的 buildRuntimeContext 同函数同来源）。
			composeRuntimeContext: () =>
				formatRuntimeContext({
					memoryContent: buildMemorySection(cwd),
					personalization: readPersonalizationSection(),
				}),
			// 真实读路径：宿主在 run 开始冻结的那份 hidden context（时序见 peekHiddenContext 注释）。
			composeHiddenContext: () => hostRef.current?.peekHiddenContext(),
			// 时间快照（`kamibuddy-run-time`）：同一次 freeze 的另一半，与上面那条分开去重
			// （spec: add-supersede-note-and-time-split）。
			composeRunTime: () => hostRef.current?.peekRunTime(),
			// 非团队会话：团队产出通道不接（探针会话没有团队注册表）。
			composeTeamOutput: () => undefined,
		}),
	],
});
hostRef.current = host;

const sessionId = host.state.sessionId;
const ledgerPath = join(ledgerDir, ledgerFileName(sessionId));
console.log(`会话 sessionId：${sessionId}`);
console.log(`本会话台账：${ledgerPath}\n`);

/* ── 驱动：5 个 run（工具调用把 run 内步数撑起来）──────────────── */

const QUESTIONS: readonly { readonly note: string; readonly text: string }[] = [
	{
		note: "run 1：从零写文件（多步 write → 后续 step）",
		text:
			"帮我用 HTML 做一份「人工智能发展历程」的幻灯片，保存为当前工作目录下的 ai-history.html，" +
			"大约 5 页，配色现代简洁。写完告诉我文件路径。",
	},
	{
		note: "run 2：改既有文件（read + edit）",
		text:
			"在 ai-history.html 的最后追加一页，讲 2020 年以后的大模型时代。直接改文件，改完告诉我新增了哪一页。",
	},
	{
		note: "run 3：只读（验证跨 run 首调与快照落位）",
		text: "读一下 ai-history.html，确认它现在有几页，把每页的标题列给我。",
	},
	{
		note: "run 4：再改一次（多步 edit）",
		text:
			"给 ai-history.html 的每页加上页码，并把主标题的字号调大一点。改完告诉我改了哪几处。",
	},
	{
		note: "run 5：只读收尾",
		text: "最后检查一遍 ai-history.html 的结构是否正常（标签闭合、没有明显错误），用一句话总结。",
	},
];

let promptFailure: string | undefined;
for (const [index, question] of QUESTIONS.entries()) {
	const runNo = index + 1;
	console.log(`── run ${runNo}/${QUESTIONS.length}　${question.note}`);
	console.log(`   发送：「${question.text}」`);
	const before = liveUsageCount;
	try {
		await host.prompt(question.text);
	} catch (error) {
		promptFailure = error instanceof Error ? error.message : String(error);
		console.error(`   ✗ run ${runNo} 失败：${promptFailure}`);
		break;
	}
	console.log(`   run ${runNo} 结束（本轮 ${liveUsageCount - before} 次带用量的助手消息）`);
}

/* ── 读数 ─────────────────────────────────────────────────────── */

hostRef.current = undefined;
const folded = foldLedger(readLedgerEntries(ledgerPath, (m) => console.error(`⚠ ${m}`)));
report(promptFailure === undefined ? "本会话（真实 provider）" : `本会话（中断：${promptFailure}）`, ledgerPath, folded);

/* ── 交叉核对：会话文件里的快照条目（落位 + 去重）────────────── */

function sessionFileOf(sessionIdValue: string): string | undefined {
	const dir = getSessionsDir();
	let names: string[];
	try {
		names = readdirSync(dir);
	} catch {
		return undefined;
	}
	const hit = names.find((name) => name.endsWith(`_${sessionIdValue}.jsonl`));
	return hit === undefined ? undefined : join(dir, hit);
}

interface SessionEntry {
	readonly type?: unknown;
	readonly customType?: unknown;
	readonly display?: unknown;
	readonly content?: unknown;
	readonly message?: { readonly role?: unknown };
}

function contentChars(content: unknown): number {
	if (typeof content === "string") return content.length;
	if (!Array.isArray(content)) return 0;
	let total = 0;
	for (const part of content) {
		if (typeof part === "object" && part !== null) {
			const text = (part as { text?: unknown }).text;
			if (typeof text === "string") total += text.length;
		}
	}
	return total;
}

const sessionFile = sessionFileOf(sessionId);
console.log("\n===== 会话文件里的快照条目（持久 + 去重 + 落位）=====");
if (sessionFile === undefined) {
	console.log(`  ⚠ 找不到会话文件（sessions 目录下以 _${sessionId}.jsonl 结尾者）—— 去重与落位无法核验`);
} else {
	console.log(`  会话文件：${sessionFile}`);
	const lines = readFileSync(sessionFile, "utf8")
		.split("\n")
		.filter((line) => line.trim() !== "");
	const entries: SessionEntry[] = [];
	for (const line of lines) {
		try {
			entries.push(JSON.parse(line) as SessionEntry);
		} catch {
			// 坏行跳过（会话文件读侧口径同 run-ledger）。
		}
	}
	const shapeOf = (entry: SessionEntry): string => {
		if (entry.type === "message") return `message:${String(entry.message?.role ?? "?")}`;
		if (entry.type === "custom_message") return `custom_message:${String(entry.customType ?? "?")}`;
		return String(entry.type ?? "?");
	};
	const snapshots = entries
		.map((entry, i) => ({ entry, lineNo: i + 1 }))
		.filter(({ entry }) => entry.type === "custom_message");
	console.log(`  文件行数 ${entries.length}，其中 custom_message ${snapshots.length} 条：`);
	for (const { entry, lineNo } of snapshots) {
		console.log(
			`   line ${lineNo}　${String(entry.customType)}　display=${String(entry.display)}　chars=${contentChars(entry.content)}`,
		);
	}
	// 各 customType 的条数（去重是否成立：runtime 通道内容稳定 ⇒ 全会话至多 1 条；
	// hidden 通道因 current_time 每 run 变 ⇒ 每 run 至多 1 条）。
	const byType = new Map<string, number>();
	for (const { entry } of snapshots) {
		const key = String(entry.customType);
		byType.set(key, (byType.get(key) ?? 0) + 1);
	}
	for (const [type, count] of byType) console.log(`   ${type} 条数=${count}（本会话 run 数=${new Set(folded.calls.map((c) => c.runId)).size}）`);
	const firstSnapshot = snapshots[0];
	if (firstSnapshot !== undefined) {
		const from = Math.max(0, firstSnapshot.lineNo - 4);
		const window = entries.slice(from, firstSnapshot.lineNo + 2);
		console.log(`  首条快照附近的条目序（落位证据）：${window.map(shapeOf).join(" → ")}`);
	}
}

console.log("\n===== 交叉核对 =====");
console.log(`  emit 里带用量的助手消息数=${liveUsageCount}，台账里带用量的 llm_call 数=${folded.calls.length}`);
console.log(
	liveUsageCount === folded.calls.length
		? "  两条读数通道一致"
		: "  ✗ 不一致 —— 读数通道失真，上面的数不能用",
);
if (promptFailure !== undefined) console.log(`  ✗ 会话中断：${promptFailure}`);

/* ── 达标判定（不足就响亮说，不粉饰）────────────────────────── */

const runs = new Set(folded.calls.map((c) => c.runId)).size;
const bar = runs >= 3 && folded.calls.length >= 10;
console.log("\n===== 达标判定 =====");
console.log(`  规模门槛（≥3 run、≥10 次调用）：${bar ? "达到" : `✗ 未达到（run=${runs}，调用=${folded.calls.length}）`}`);
const pairs = folded.calls.filter((c) => c.gap !== undefined);
const worst = pairs.reduce((acc, c) => (c.gap !== undefined && c.gap > acc ? c.gap : acc), 0);
console.log(`  gap ≤ ${GAP_LIMIT} 全对通过：${worst <= GAP_LIMIT ? "是" : `✗ 否（最大 ${worst}）`}`);

rmSync(cwd, { recursive: true, force: true });
console.log(`\n（临时工作目录已清理；会话文件与台账保留作证据）`);

// 等 stdout 把最后几段真正写完再退出（Windows TTY 上 stdout 异步，见文件头收尾纪律）。
await new Promise<void>((resolve) => {
	process.stdout.write("", () => resolve());
});
process.exit(bar && worst <= GAP_LIMIT && promptFailure === undefined ? 0 : 1);
