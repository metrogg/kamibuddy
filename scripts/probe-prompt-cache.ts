/**
 * 提示词前缀缓存探针（spec: stabilize-prompt-prefix）。
 *
 * **本版测的是出货形态**：提示词由**生产组装入口**产出
 * （src/core/system-prompt-composer.ts 的 createSystemPromptComposerFromDefaults，
 * 与 src/daemon/index.ts 和门禁测试 extensions/prompt-switch.test.ts 是同一个函数），
 * 探针只负责把它交给 pi 并读数。
 *
 * 上一版（已作废）自己拼了一个「像系统提示词」的字符串：手抄骨架、自己展开片段、
 * 还留着 `replace("{{cwd}}", cwd)`（当时已是空操作）与自拼的 `Current time: …`
 * —— 那是**改造前**的形态。它的读数只能证明「字节稳定 ⇒ 缓存保住」这条机制，
 * 不能当出货形态的回归证据（独立验证者标记的形态漂移点）。现在两者不再可能分家：
 * 探针手上没有第二份组装逻辑。
 *
 * 三组，都在真实产物上做（同一条序列里可比的只有「无变化轮 vs 变更轮」）：
 *
 *   A 组：同一提示词连发三轮（要求第 2、3 轮字节逐字一致）→ 期望命中接近饱和。
 *        这是「生产提示词在同一会话内逐轮字节稳定」的直接回归证据：提示词一字未变
 *        时 pi 不发新的 system 消息，整个请求前缀（含全部历史）照旧命中。
 *
 *   B 组：真实提示词 +（**只**）在**第一行**改动一处（tools 一字不动）。
 *        对照组：证明 A 组的高命中不是「读数一直很高」的假象。
 *
 *   C 组：反过来只动 tools（把工具面摘掉一个），system 字节逐字冻结成 A 组轮 1 的产物。
 *        B、C 两次读数合起来用**差分**回答「命中的那一块落在 system 还是 tools」——
 *        单看 B 的百分比会得出错误结论：实测里 B 的改动落在第 0 字符（按「最长公共
 *        前缀」口径本该几乎不命中），命中却仍与 A 组同量级。原因见「断点归因」节：
 *        `payload` 里 messages 与 tools 是两个**平级字段**，探针打印的顺序（先 messages、
 *        末尾才报 tools 计数）只是**展示顺序**，不是 provider 侧的拼接 / 计费顺序 ——
 *        顺序只能靠差分测，不能靠打印猜。
 *        历史事故的改动点（骨架里的 cwd 行 ≈ 提示词的 25% 深度、记忆内容块 ≈ 85% 深度）
 *        介于 A 与 B 之间，实测取值见 spec.md 的「探针结论（实测）」②。
 *
 * 时钟**不再冻结**（上一版冻结了）：生产产物里本就不含时间（这正是要证的），
 * 冻结只会掩盖「有人把时间拼回提示词」这类事故 —— A 组的字节断言在真实时钟下成立
 * 才是出货纪律的回归证据（跨过分钟边界也不许变）。
 *
 * 为什么必须真跑：命中读数要 provider 真实 usage 才作数（口径复用
 * shared/observability.ts 的 billedInputTokens / cacheHitRate，不另写公式）；
 * 「请求里到底有几条 system 消息、落在哪」只有把实际 payload dump 出来才知道
 * —— 这是判断 pi 有没有 patch 路径的唯一直接证据（结论①：发布版
 * @earendil-works/pi-coding-agent@0.85.1 的 BuildSystemPromptOptions 没有
 * sections / forceSystemPrompt，emitBeforeAgentStart 只认 handler 返回的
 * systemPrompt 字符串，system 消息恒为 1 条 leading）。
 *
 * 前提不成立就响亮退出（无凭据 / 模型不可用 / 请求失败 / 一轮没跑出带用量的消息），
 * 绝不给出「看起来像个结论」的读数：探针的价值全在读数可信。
 *
 * 会发起真实模型请求（每轮一次，提问都很短），消耗极小额度。用真实配置目录
 * （~/.kamibuddy）以加载真实凭据与偏好（出货形态包含用户的风格/技能开关）；
 * cwd 用临时目录、会话走内存（SessionManager.inMemory），不往用户会话目录落盘，
 * 也不碰用户任务目录。
 *
 * 用法：npx tsx scripts/probe-prompt-cache.ts [--model=provider/model]
 *
 * 收尾纪律（2026-09-17）：stdout 在 Windows TTY 上是异步的，紧跟着 `process.exit`
 * 会把还没写完的输出截掉 —— 退出前显式等一次写回调。末段读数是本探针的全部价值，
 * 不能靠运气送达。关键读数另行各占一行、行内不夹长句（下游终端 / 采集工具长行
 * 截断时，被吃掉的就未必是数字）。
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
	ExtensionAPI,
	InlineExtension,
} from "@earendil-works/pi-coding-agent";
import { loadSkills, SessionManager } from "@earendil-works/pi-coding-agent";
import { getConfigDir, getResourcesDir } from "../src/core/config-paths.ts";
import { ModelCatalog } from "../src/core/model-catalog.ts";
import { estimateTokens } from "../src/core/observability.ts";
import { getEffectiveWorkspaceRoot, readPreferences } from "../src/core/preferences.ts";
import type { PromptContextOptions, SkillDescriptor } from "../src/core/prompt-composer.ts";
import { loadResources } from "../src/core/resources.ts";
import { filterEnabledSkills } from "../src/core/skill-status.ts";
import { SessionHost } from "../src/core/session-host.ts";
import { createSystemPromptComposerFromDefaults } from "../src/core/system-prompt-composer.ts";
import { collectRuntimeInventory } from "../src/core/runtime-inventory.ts";
import {
	billedInputTokens,
	cacheHitRate,
	reportsCacheActivity,
	type TokenUsage,
} from "../src/shared/observability.ts";

/* ── 结论能否成立的前提：模型、凭据、资源 ─────────────────────────── */

function die(message: string): never {
	console.error(`\n✗ 前提不成立，探针拒绝给出结论：\n  ${message}\n`);
	process.exit(1);
}

console.log("=== 提示词前缀缓存探针（spec: stabilize-prompt-prefix）===");
console.log("（本版测的是**出货形态**：提示词由生产组装入口产出，探针不自拼形态）\n");

const MODEL_PREFIX = "--model=";
const requestedModel = process.argv.slice(2).find((arg) => arg.startsWith(MODEL_PREFIX))?.slice(MODEL_PREFIX.length);

const catalog = await ModelCatalog.create();
const modelKey = requestedModel ?? readPreferences().activeModelKey;
if (modelKey === undefined || modelKey === "") {
	die(
		"没有可用模型：preferences.json 里没有 activeModelKey，也没有给 --model。\n" +
			"  复跑：npx tsx scripts/probe-prompt-cache.ts --model=<provider>/<model>",
	);
}
if (!catalog.isUsable(modelKey)) {
	die(
		`模型「${modelKey}」不可用（models.json 里没有它，或该服务商没配凭据）。\n` +
			"  先在应用设置里配好这个服务商，或用 --model= 指定另一个。",
	);
}

// 只取协议与主机（脱敏）：端点本身用于判断「同一台机器上的缓存是否可复用」，
// 完整 baseUrl 可能带查询串里的凭据。
const resolved = catalog.resolveModel(modelKey) as { baseUrl?: string; api?: string } | undefined;
const endpoint = (resolved?.baseUrl ?? "").replace(/(https?:\/\/[^/?#]+).*/, "$1");
console.log(`模型：${modelKey}（api=${resolved?.api ?? "?"}，端点=${endpoint === "" ? "(未知)" : endpoint}）`);

const resources = loadResources(getResourcesDir());

/* ── 生产组装入口（daemon / 门禁测试同一个函数）────────────────────── */

const SCENE_ID = "work";
const INTERACTION_ID = "craft";

/**
 * 已启用技能 → 提示词描述符。与 daemon 的 enabledSkills → toSkillDescriptors 同源
 * 同义（同一份 loadSkills 参数、同一个 filterEnabledSkills、同一份偏好里的开关）：
 * 技能清单段是出货产物的一部分，探针不该用空清单把提示词换个样。
 */
function enabledSkillDescriptors(): readonly SkillDescriptor[] {
	const { skills } = loadSkills({
		cwd: getEffectiveWorkspaceRoot(),
		agentDir: getConfigDir(),
		skillPaths: [join(getResourcesDir(), "skills")],
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
	// 探针不绑专家（两轴恒 work/craft、expertId 恒 undefined）：组装器对
	// expertId === undefined 短路，专家库这条读路径不会被走到。
	loadExperts: () => [],
	enabledSkills: async () => enabledSkillDescriptors(),
	// 风格漂移（偏好里存的 id 不在资源库）与 daemon 一致地响亮报出来，不静默。
	onStyleDrift: (drift) => {
		console.error(`⚠ 回复风格配置漂移：偏好要的是「${drift.requested}」，资源库没有，回落「${drift.fallback}」`);
	},
});

/**
 * 托管运行时清单 —— 与 daemon 的取值同一处（core/runtime-inventory.ts 的
 * collectRuntimeInventory）。它**不进系统提示词**（随机器与开关变，进去就是
 * 「换机 / 重建 venv 即断前缀」），而是作为 hidden context 的 `python_env` 段注入
 * —— 探针的请求要与出货形态一致，所以这条注入照给。
 */
const runtimeInventory = collectRuntimeInventory();

const skillCount = enabledSkillDescriptors().length;
console.log(`工作场景：${SCENE_ID} × ${INTERACTION_ID}，已启用技能 ${skillCount} 个（与出货同一份技能清单）`);

const cwd = mkdtempSync(join(tmpdir(), "kami-probe-prompt-cache-"));
console.log(`工作目录：${cwd}\n`);

/* ── 请求结构 dump（探针的唯一直接证据）─────────────────────────── */

function messageRoleOf(message: unknown): string {
	if (typeof message !== "object" || message === null) return "?";
	const role = (message as { role?: unknown }).role;
	return typeof role === "string" ? role : "?";
}

function textLengthOf(content: unknown): number {
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

/** transcript 层（context 事件）：role 序列 + 每条 system 消息的 replace 标记与 sections 键集合。 */
function describeTranscript(messages: readonly unknown[]): string[] {
	return messages.map((message, index) => {
		const role = messageRoleOf(message);
		if (role !== "system") return `${index}:${role}`;
		const replace = (message as { replace?: unknown }).replace === true;
		const sections = (message as { sections?: unknown }).sections;
		const keys = typeof sections === "object" && sections !== null ? Object.keys(sections) : [];
		const content = (message as { content?: unknown }).content;
		return `${index}:system(replace=${replace}, sections=[${keys.join(",")}], contentLen=${textLengthOf(content)})`;
	});
}

/** payload 层（before_provider_request）：真正发出去的 role 序列 + system 消息长度。 */
function describePayload(payload: unknown): string[] {
	if (typeof payload !== "object" || payload === null) return [`✗ payload 不是对象（${typeof payload}）`];
	const raw = (payload as { messages?: unknown }).messages;
	if (!Array.isArray(raw)) return ["✗ payload 没有 messages 数组 —— 结构 dump 失效"];
	// 显式收窄成 unknown[]：Array.isArray 会把它推成 any[]，不让 any 渗进后面的对象读取。
	const messages: unknown[] = raw;
	const lines = messages.map((message, index) => {
		const role = messageRoleOf(message);
		if (role !== "system" && role !== "developer") return `${index}:${role}`;
		const content = (message as { content?: unknown }).content;
		return `${index}:${role}(contentLen=${textLengthOf(content)})`;
	});
	const tools = (payload as { tools?: unknown }).tools;
	return [...lines, `(另有 ${describeTools(tools)})`];
}

/**
 * tools 块的体量（个数 + schema 字符数 + 估算 token）。
 *
 * 为什么单独量它：messages 与 tools 是 payload 上的两个**平级字段**，本探针先打印
 * messages、末尾才报 tools —— 那只是**展示顺序**，不代表 provider 侧的拼接 / 计费顺序。
 * 「命中的那一块落在哪一个字段」只能靠差分实验判定（见「断点归因」节），
 * 这里给出体量，供与命中量级交叉核对（口径同为 estimateTokens 的估算，不是真 tokenizer）。
 */
function describeTools(tools: unknown): string {
	if (!Array.isArray(tools) || tools.length === 0) return "0 个 tools";
	const json = JSON.stringify(tools);
	return `${tools.length} 个 tools，schema 共 ${json.length} 字符 ≈ ${estimateTokens(json)} tokens（估算）`;
}

/** payload 里 tools 的个数（C 组差分实验的前提自断言用）。 */
function toolCountOf(payload: unknown): number {
	if (typeof payload !== "object" || payload === null) return 0;
	const tools = (payload as { tools?: unknown }).tools;
	return Array.isArray(tools) ? tools.length : 0;
}

/** 对话中段是否出现 system 消息 —— 「patch 原地送达」的直接标志。 */
function hasMidConversationSystem(payloadLines: readonly string[]): boolean {
	return payloadLines.some((line, index) => index > 0 && line.includes(":system("));
}

/** 请求里的 system 消息条数（含 developer 角色）。恒 1 条 = 只有 leading，没有 patch。 */
function countSystems(lines: readonly string[]): number {
	return lines.filter((line) => line.includes(":system(") || line.includes(":developer(")).length;
}

/** 最早出现差异的字节位置；两份完全一致返回 -1。 */
function firstDifferenceOffset(left: string, right: string): number {
	const limit = Math.min(left.length, right.length);
	for (let i = 0; i < limit; i++) {
		if (left[i] !== right[i]) return i;
	}
	return left.length === right.length ? -1 : limit;
}

/* ── 会话记录 ──────────────────────────────────────────────────── */

interface StepRecord {
	readonly text: string;
	readonly usage: TokenUsage;
}

interface CallDump {
	readonly transcript: string[];
	payload: string[] | undefined;
	/** payload 里 tools 的个数（0 = 没抓到 / 没有 tools）。 */
	toolCount: number;
}

class SessionRecorder {
	readonly steps: StepRecord[] = [];
	readonly dumps: CallDump[] = [];

	onContext(messages: readonly unknown[]): void {
		this.dumps.push({ transcript: describeTranscript(messages), payload: undefined, toolCount: 0 });
	}

	onPayload(payload: unknown): void {
		const last = this.dumps.at(-1);
		if (last === undefined) {
			this.dumps.push({
				transcript: ["✗ 没有对应的 context 事件"],
				payload: describePayload(payload),
				toolCount: toolCountOf(payload),
			});
			return;
		}
		// 重试会复用同一份 payload，重复写同一个位置即可。
		last.payload = describePayload(payload);
		last.toolCount = toolCountOf(payload);
	}

	onAssistantDone(text: string, usage: TokenUsage): void {
		this.steps.push({ text, usage });
	}
}

/** 每次模型调用前现取 pi 已经加载好的上下文（与真实会话透传的是同一份）。 */
function piContextOf(event: BeforeAgentStartEvent): PromptContextOptions {
	return {
		contextFiles: event.systemPromptOptions.contextFiles ?? [],
		toolSnippets: event.systemPromptOptions.toolSnippets ?? {},
		promptGuidelines: event.systemPromptOptions.promptGuidelines ?? [],
	};
}

function createProbeExtension(
	recorder: SessionRecorder,
	beforeAgentStart: (
		event: BeforeAgentStartEvent,
	) => BeforeAgentStartEventResult | Promise<BeforeAgentStartEventResult>,
): InlineExtension {
	return (pi: ExtensionAPI): void => {
		pi.on("before_agent_start", async (event) => beforeAgentStart(event));
		pi.on("context", (event) => {
			recorder.onContext(event.messages);
			return undefined;
		});
		pi.on("before_provider_request", (event) => {
			recorder.onPayload(event.payload);
			return undefined;
		});
	};
}

async function createHost(
	recorder: SessionRecorder,
	extension: InlineExtension,
	toolsOverride?: readonly string[],
): Promise<SessionHost> {
	return SessionHost.create({
		catalog,
		modelKey,
		cwd,
		isTempTask: false,
		sceneId: SCENE_ID,
		interactionId: INTERACTION_ID,
		// C 组用：只把工具面换掉，其余一切照旧（初始工具集覆盖的既有入参，
		// 不是探针的私货 —— 子代理会话走的就是这条口）。
		...(toolsOverride === undefined ? {} : { toolsOverride }),
		emit: (event) => {
			if (event.type !== "assistant_done") return;
			// usage 在类型上是可选的（pi 的助手消息一定带，见 session-host 的 toTokenUsage），
			// 真缺了这一步就不进读数 —— 轮级断言会把「一轮没有可用读数」响亮报出来。
			const usage = event.message.usage;
			if (usage !== undefined) recorder.onAssistantDone(event.message.text, usage);
		},
		resources,
		// 与出货同一份 hidden context：运行时清单走注入（python_env 段），
		// 系统提示词里没有它（见上面 runtimeInventory 的注释）。
		getRuntimeInventory: () => runtimeInventory,
		// 内存会话：探针不需要落盘历史，也就不必往用户配置目录写会话文件
		//（写 ~/.kamibuddy/sessions 在受限终端里会被外部沙箱拦成 EPERM，与探针要测的东西无关）。
		sessionManager: SessionManager.inMemory(cwd),
		extensions: [extension],
	});
}

/** 首次 before_agent_start 时抓到的 systemPromptOptions 键集合（判断有没有 sections 的决定性证据）。 */
let optionsKeys: readonly string[] = [];

/* ── A 组：同一提示词连发三轮（字节稳定 ⇒ 命中接近饱和）────────── */

const recA = new SessionRecorder();
/** 每轮真实组装出来的提示词（用于「字节是否稳定」这个自断言）。 */
const promptsA: string[] = [];

const hostA = await createHost(
	recA,
	createProbeExtension(recA, async (event) => {
		if (optionsKeys.length === 0) optionsKeys = Object.keys(event.systemPromptOptions);
		const prompt = (
			await composeSystemPrompt({
				sceneId: SCENE_ID,
				interactionId: INTERACTION_ID,
				expertId: undefined,
				piContext: piContextOf(event),
			})
		).prompt;
		promptsA.push(prompt);
		return { systemPrompt: prompt };
	}),
);

/* ── B 组：真实提示词 + 只改动一处（最坏位置）──────────────────── */

/**
 * 本 run 的唯一标记（进制 36 的毫秒时间戳），**只进「被改动的那些轮」**。
 *
 * 为什么需要它（2026-09-17 实测，本探针最反直觉的一课）：provider 的前缀缓存在
 * **账号级**，而且是「同一串字节发过一次，下一次就命中」。改动轮的字节若是固定的
 *（真实产物 + 同一行改动），**复跑就会把「变更轮」变成「已缓存」**：实测同一份产物
 * 连跑两次，B 轮 2 从 27.1%（cacheRead 1664）跳到 95.8%（cacheRead 5888），
 * 读起来像「改动不再有代价」。
 *
 * A 组**不加**：那三轮是「出货产物逐轮字节稳定」的回归证据，必须逐字节就是产物本身。
 */
const RUN_NONCE = Date.now().toString(36);

const recB = new SessionRecorder();
/**
 * B 组的唯一自变量：往真实产物的**第一行之前**追加一行（含逐 run 的 nonce，理由见 RUN_NONCE）。
 */
const CHANGE_LINE = `[PROBE run=${RUN_NONCE}] 本轮新增的一处事实（对照组专用，真实产物里没有这一行）`;
const bState = { changed: false };
const promptsB: string[] = [];

const hostB = await createHost(
	recB,
	createProbeExtension(recB, async (event) => {
		const prompt = (
			await composeSystemPrompt({
				sceneId: SCENE_ID,
				interactionId: INTERACTION_ID,
				expertId: undefined,
				piContext: piContextOf(event),
			})
		).prompt;
		const shaped = bState.changed ? `${CHANGE_LINE}\n\n${prompt}` : prompt;
		promptsB.push(shaped);
		return { systemPrompt: shaped };
	}),
);

/* ── 驱动 ──────────────────────────────────────────────────────── */

interface RoundSpec {
	readonly question: string;
	readonly note: string;
	readonly apply: () => void;
}

interface RoundReading {
	readonly label: string;
	readonly round: number;
	readonly note: string;
	readonly firstStepPrompt: number;
	readonly firstStepCacheRead: number;
	readonly firstStepHit: number | undefined;
	readonly transcript: readonly string[];
	readonly payload: readonly string[];
	readonly toolCount: number;
	readonly text: string;
}

async function runGroup(
	label: string,
	host: SessionHost,
	recorder: SessionRecorder,
	rounds: readonly RoundSpec[],
): Promise<RoundReading[]> {
	let cacheReported = false;
	const readings: RoundReading[] = [];
	for (const [index, spec] of rounds.entries()) {
		const roundNo = index + 1;
		const stepFrom = recorder.steps.length;
		console.log(`\n── ${label} 轮 ${roundNo}　${spec.note}`);
		spec.apply();
		console.log(`   发送：「${spec.question}」`);
		await host.prompt(spec.question);

		const steps = recorder.steps.slice(stepFrom);
		if (steps.length === 0) {
			throw new Error(`${label} 轮 ${roundNo} 没有产生任何带用量的助手消息 —— 这一轮没真的跑模型，读数无效`);
		}
		if (recorder.dumps.length !== recorder.steps.length) {
			console.log(
				`   ⚠ 请求结构 dump 条数（${recorder.dumps.length}）与助手消息条数（${recorder.steps.length}）不一致 —— 下面的结构可能与步号错位`,
			);
		}

		steps.forEach((step, stepIndex) => {
			cacheReported = cacheReported || reportsCacheActivity(step.usage);
			const hit = cacheHitRate(step.usage, cacheReported);
			const hitText = hit === undefined ? "—（本次未上报缓存活动）" : `${(hit * 100).toFixed(1)}%`;
			console.log(
				`   轮 ${roundNo} 步 ${stepIndex + 1}: prompt=${billedInputTokens(step.usage)} cacheRead=${step.usage.cacheRead} hit=${hitText}`,
			);
			const dump = recorder.dumps[stepFrom + stepIndex];
			if (dump === undefined) {
				console.log("      transcript：（没抓到 context 事件）");
				console.log("      payload   ：（没抓到 before_provider_request 事件）");
			} else {
				console.log(`      transcript：${dump.transcript.join(" → ")}`);
				const payloadLines = dump.payload ?? ["（没抓到）"];
				console.log(`      payload   ：${payloadLines.join(" → ")}`);
				if (payloadLines.some((line) => line.startsWith("✗"))) {
					throw new Error(`payload 结构 dump 失效：${payloadLines.join(" ")}`);
				}
			}
			console.log(`      回复：${JSON.stringify(step.text.slice(0, 120))}`);
		});

		const first = steps[0];
		const firstHit = first === undefined ? undefined : cacheHitRate(first.usage, cacheReported);
		const dump = recorder.dumps[stepFrom];
		readings.push({
			label,
			round: roundNo,
			note: spec.note,
			firstStepPrompt: first === undefined ? 0 : billedInputTokens(first.usage),
			firstStepCacheRead: first?.usage.cacheRead ?? 0,
			firstStepHit: firstHit,
			transcript: dump?.transcript ?? [],
			payload: dump?.payload ?? [],
			toolCount: dump?.toolCount ?? 0,
			text: first?.text ?? "",
		});
	}
	return readings;
}

let readingsA: RoundReading[];
try {
	readingsA = await runGroup("A（字节稳定 / 出货形态）", hostA, recA, [
		{ question: "只回答两个字：收到", note: "新会话首调（缓存基线）", apply: () => {} },
		{ question: "只回答两个字：明白", note: "提示词无变化（要求字节逐字一致）", apply: () => {} },
		{ question: "只回答两个字：好的", note: "提示词无变化（要求字节逐字一致）", apply: () => {} },
	]);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	die(`A 组请求没跑通（模型不可达 / 凭据失效 / 端点拒收 / 无用量读数）：${message}`);
}

let readingsB: RoundReading[];
try {
	readingsB = await runGroup("B（对照 / 改动一处）", hostB, recB, [
		{ question: "只回答两个字：收到", note: "真实产物（控制轮）", apply: () => {} },
		{
			question: "只回答两个字：明白",
			note: `真实产物 + 第一行追加一处（最坏位置）`,
			apply: () => {
				bState.changed = true;
			},
		},
	]);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	die(`B 组请求没跑通（模型不可达 / 凭据失效 / 端点拒收 / 无用量读数）：${message}`);
}

/* ── 字节事实（自断言：产物是不是真的逐字一致 / 真的只改了一处）── */

const [promptA1, promptA2, promptA3] = promptsA;
if (promptA1 === undefined || promptA2 === undefined || promptA3 === undefined) {
	die(`A 组只组装出 ${promptsA.length} 次提示词（应为 3 次）—— before_agent_start 每轮一次，数目不对说明会话没按预期跑。`);
}
if (promptA1 !== promptA2 || promptA2 !== promptA3) {
	const offset = firstDifferenceOffset(promptA1, promptA2);
	die(
		`A 组三轮的提示词字节不一致（轮 1 vs 轮 2 首个差异在第 ${offset} 字符处）。\n` +
			"  这是缓存前缀不变量被破坏的**直接证据**：生产组装入口在同一会话内产出了不同的字节，\n" +
			"  先查谁把逐轮可变的事实拼进了系统提示词（时间 / 记忆内容 / 个性化 / cwd 都不许进）。",
	);
}
const [promptB1, promptB2] = promptsB;
if (promptB1 === undefined || promptB2 === undefined) {
	die(`B 组只组装出 ${promptsB.length} 次提示词（应为 2 次）—— 会话没按预期跑。`);
}
if (promptB1 !== promptA1) {
	die("B 组轮 1 的产物与 A 组不一致 —— 同一组装入口对同一输入应逐字节可复现，读数不可比。");
}
if (promptB2 === promptB1) {
	die("B 组轮 2 的提示词与轮 1 相同 —— 变更没生效，对照组什么都测不到。");
}

const changeOffset = firstDifferenceOffset(promptB1, promptB2);
const changeDepth = ((changeOffset / promptB2.length) * 100).toFixed(1);
console.log("\n===== 字节事实（探针自断言通过后才有下面这些读数）=====");
console.log(`  A 组三轮提示词逐字一致：${promptA1.length} 字符（真实时钟下跨轮比较，未冻结时钟）`);
const changedRound = readingsB[1];
console.log(`  B 组只改了一处：首个差异在第 ${changeOffset} 字符（占轮 2 提示词的 ${changeDepth}%）`);
console.log(
	`    改动落在第 0 字符，按「最长公共前缀」口径本该几乎不命中 —— 本轮实测 hit = ${changedRound === undefined ? "—" : hitTextOf(changedRound)}。` +
		"\n    「改动点的字符深度 = 代价」这条推法因此不成立：命中段到底在哪，只能靠差分判定（见「断点归因」）。",
);
console.log(
	"  读数的口径提醒（别拿绝对数字跨次比较）：命中率绝对值还受**账号级缓存**状态影响" +
		"\n    （上一次同前缀请求是否还在缓存窗口内），跨次运行不能直接比大小；" +
		"\n    可比的是同一条轮次序列里「无变化轮 vs 变更轮」的差（本探针的 A 轮 2/3 vs B 轮 2）。" +
		"\n    根因已实测：同一串字节发过一次，下一次就命中 —— 连「变更轮」的字节也一样（见「断点归因」），" +
		"\n    所以复跑前先看那一节，别把「已缓存」读成「改动没代价」。",
);
console.log(
	"  命中率的上界 = 「差异点之前的内容」+「与本次改动无关的稳定前缀（例如工具 schema）」二者占整个请求的比例" +
		"\n    —— 单看一个百分比**反推不出**改动代价：本轮 B 轮 2 = " +
		`${changedRound === undefined ? "—" : hitTextOf(changedRound)}，` +
		"\n    但同一个实验在别的运行里读到过与稳定轮同量级的值（见「断点归因」的账号级缓存复用），" +
		"\n    而量级对照（tools 块体量）也在那一节。",
);

/* ── C 组：断点归因（只改 tools，system 字节冻结）──────────────────
 * B 组「只改 system、tools 不动」已经测出「改在第 0 字符照样命中」；C 组把变量反过来：
 * system 逐字节冻结成 A 组轮 1 的产物，只把工具面摘掉一个。两次读数合起来用差分把
 * 「命中的那一块」定到 system 或 tools 一侧 —— 这是唯一能定的办法，payload 的打印
 * 顺序（先 messages、末尾报 tools 计数）只是展示顺序，推不出 provider 的拼接顺序。
 *
 * 冻结是必需品不是洁癖：工具面一变，pi 的 toolSnippets 就变，生产组装的产物跟着变
 *（下面的 promptsCNative 与原产物的差值就是举证）—— 不冻结就等于同时动了两个变量。
 * 冻结用的字节仍是**生产组装入口 A 组轮 1 的产物**，不是探针自拼的形态。
 */

const modeTools = resources.modes.find((m) => m.id === INTERACTION_ID)?.tools;
if (modeTools === undefined) {
	die(`资源库里的交互模式「${INTERACTION_ID}」没有工具白名单 —— C 组的差分无从构造。`);
}
/**
 * C 组唯一自变量：摘掉**若干**个工具（其余工具、顺序都不动）。
 *
 * 逐 run 轮换摘哪几个（理由同 RUN_NONCE）：固定摘同一个（组），复跑时这一串字节已经
 * 被上一次运行写过、命中会假性保住 —— 那样「tools 一变命中塌不塌」这个自变量直接被
 * 测废（更糟：会给出一条**错**的归因）。候选限定在 pi 自带、且必定在册的文件工具里。
 * 2^n − 1 种非空组合里取一种，跨 run 撞车的概率随之降到 1/(2^n − 1)。
 */
const DROP_CANDIDATES = ["grep", "find", "ls"] as const;
const droppable = DROP_CANDIDATES.filter((name) => modeTools.includes(name));
if (droppable.length === 0) {
	die(`模式「${INTERACTION_ID}」的工具面里没有 ${DROP_CANDIDATES.join("/")} —— C 组差分的前提（只改工具面）不成立。`);
}
const dropMask = 1 + (Number.parseInt(RUN_NONCE, 36) % (2 ** droppable.length - 1));
const droppedTools: readonly string[] = droppable.filter((_, index) => ((dropMask >>> index) & 1) === 1);
const subsetTools = modeTools.filter((name) => !droppedTools.includes(name));
if (subsetTools.length === modeTools.length) {
	die(`C 组的工具面没有真的变化（摘 ${droppedTools.join("/")} 前后都是 ${modeTools.length} 个）—— 差分前提不成立。`);
}

const recC = new SessionRecorder();
/** C 会话**不冻结**时会组装出的产物：用来举证「工具面一变、产物跟着变」，即冻结的必要性。 */
const promptsCNative: string[] = [];

const hostC = await createHost(
	recC,
	createProbeExtension(recC, async (event) => {
		promptsCNative.push(
			(
				await composeSystemPrompt({
					sceneId: SCENE_ID,
					interactionId: INTERACTION_ID,
					expertId: undefined,
					piContext: piContextOf(event),
				})
			).prompt,
		);
		return { systemPrompt: promptA1 };
	}),
	subsetTools,
);

let readingsC: RoundReading[];
try {
	readingsC = await runGroup("C（断点归因 / 只改 tools）", hostC, recC, [
		{
			question: "只回答两个字：收到",
			note: `system 字节冻结成 A 轮 1 的产物 + 工具面摘掉 ${droppedTools.join("、")}（其余同 A 轮 1）`,
			apply: () => {},
		},
	]);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	die(`C 组请求没跑通（模型不可达 / 凭据失效 / 端点拒收 / 无用量读数）：${message}`);
}

/* ── pi 的接线事实（运行时自断言）───────────────────────────── */

const sectionsSupported = optionsKeys.includes("sections") || optionsKeys.includes("forceSystemPrompt");
console.log("\n===== pi 的接线事实（运行时抓取）=====");
console.log(`  before_agent_start 的 systemPromptOptions 键：${optionsKeys.join(", ")}`);
console.log(
	sectionsSupported
		? "  ✗ 出乎意料：这个 pi 版本带了 sections/forceSystemPrompt —— 探针的版本判断要重做。"
		: "  → 没有 sections / forceSystemPrompt：这个 pi 版本**没有**分段 diff + patch 路径，on the wire 只能整体替换或原样复用。",
);
const payloadA1 = readingsA[0]?.payload ?? [];
const payloadA2 = readingsA[1]?.payload ?? [];
const payloadA3 = readingsA[2]?.payload ?? [];
console.log(
	`  A 组 transcript 里没有任何 system 消息：${(readingsA[2]?.transcript ?? []).join(" → ")}` +
		"\n    （发布版 pi 不把系统提示词放进消息数组：它挂在 agent.state.systemPrompt 上，每次请求作为 leading 送）",
);
console.log(
	`  A 组三次请求的 system 条数：轮 1 = ${countSystems(payloadA1)}，轮 2 = ${countSystems(payloadA2)}，轮 3 = ${countSystems(payloadA3)}（恒 1 条 = leading，没有 patch 消息、没有重放数组）`,
);
if (sectionsSupported || hasMidConversationSystem(payloadA2) || hasMidConversationSystem(payloadA3)) {
	die("结构 dump 显示请求里出现了对话中段的 system 消息 —— 与上面的版本判断冲突，请人工复核。");
}

/* ── 结论 ──────────────────────────────────────────────────────── */

function hitTextOf(reading: RoundReading): string {
	return reading.firstStepHit === undefined ? "—" : `${(reading.firstStepHit * 100).toFixed(1)}%`;
}

console.log("\n\n===== 对照表（每轮的**首步**读数）=====");
for (const reading of [...readingsA, ...readingsB, ...readingsC]) {
	console.log(
		`  ${reading.label}　轮 ${reading.round}　prompt=${reading.firstStepPrompt}　cacheRead=${reading.firstStepCacheRead}　hit=${hitTextOf(reading)}　tools=${reading.toolCount}　${reading.note}`,
	);
}

console.log("\n===== 结构证据 =====");
console.log(`A 轮 2 transcript：${(readingsA[1]?.transcript ?? []).join(" → ")}`);
console.log(`A 轮 2 payload   ：${payloadA2.join(" → ")}`);
console.log(`B 轮 2 payload   ：${(readingsB[1]?.payload ?? []).join(" → ")}`);
console.log(`C 轮 1 payload   ：${(readingsC[0]?.payload ?? []).join(" → ")}`);
console.log("（上面每行末尾的 tools 体量只是**展示**：messages 与 tools 是 payload 上的平级字段，本探针不按任何顺序推断 provider 的拼接顺序）");

/* ── 断点归因（差分：只改 system vs 只改 tools）──────────────────
 * 判定只用两个自变量各改一次的读数 + 基线，不引用任何「打印顺序」的推理：
 *   只改 system（B 轮 2，tools 不动）
 *   只改 tools （C 轮 1，system 字节逐字冻结）
 *   基线       （A 轮 1，两侧都没改）
 * 读数塌下去说明被改的那一侧就在命中段里；读数不塌说明不在一侧（那就要如实记「未解释」）。
 */

const baselineA1 = readingsA[0];
/** 无变化轮（A 轮 3）—— 差分实验的参照：它代表「什么都不改」时的命中长度。 */
const saturatedA = readingsA[2];
const systemSide = readingsB[1];
const toolsSide = readingsC[0];
const baselineCacheRead = baselineA1?.firstStepCacheRead ?? 0;
const systemSideCacheRead = systemSide?.firstStepCacheRead ?? 0;
const toolsSideCacheRead = toolsSide?.firstStepCacheRead ?? 0;
const baselineToolCount = baselineA1?.toolCount ?? 0;
const toolsSideToolCount = toolsSide?.toolCount ?? 0;

const nativeC = promptsCNative[0];
if (nativeC === undefined) {
	die("C 组没有组装出产物 —— 冻结必要性的举证缺失（before_agent_start 每轮一次）。");
}
const nativeDiff = firstDifferenceOffset(nativeC, promptA1);

/**
 * 归因判定：**只由读数算**（两侧各改一次的 cacheRead vs 「无变化轮」的 cacheRead），
 * 不写死任何与读数无关的因果。判据：某一侧改动后命中塌掉（不足无变化轮的一半）
 * ⇒ 被改的那一侧就在命中段里；两侧都不塌 / 都塌 ⇒ 未解释（如实登记，不给结论）。
 *
 * 为什么用「无变化轮」当参照而不是基线（A 轮 1）：A 轮 1 是本序列的第一发请求，
 * 它的命中来自**账号级缓存里的旧条目**，长度随旧条目内容漂移（本轮实测同内容的两发
 * 请求就差了 3840 vs 5632，见下面打印的噪声带）—— 拿它当参照会把漂移读成结论。
 */
function attributionVerdict(): string {
	const stableRead = saturatedA?.firstStepCacheRead ?? baselineCacheRead;
	if (stableRead === 0 || systemSide === undefined || toolsSide === undefined) {
		return "未判定（无变化轮 / 某一侧的读数缺失，差分没有参照 —— 重跑一次再看）";
	}
	if (baselineToolCount === toolsSideToolCount) {
		return `未判定（前提不成立：两组 tools 个数相同，都是 ${baselineToolCount}）`;
	}
	const collapsed = (value: number): boolean => value * 2 < stableRead;
	const systemCollapsed = collapsed(systemSideCacheRead);
	const toolsCollapsed = collapsed(toolsSideCacheRead);
	if (systemCollapsed && !toolsCollapsed) {
		return (
			`命中段在 **system / 消息一侧**：system 字节一改（第 0 字符）命中就塌（${systemSideCacheRead} 对无变化轮 ${stableRead}），` +
			`而只改 tools、system 字节冻结时命中基本保住（${toolsSideCacheRead}）—— 前缀匹配从请求的最前面算起，` +
			`把 tools 改掉不影响已命中的那一截，只可能是 tools **不在**命中段的起始位置（或被排在 system 之后）。` +
			`⇒ 把「命中的 5120」记到 tools 段上是不成立的。`
		);
	}
	if (!systemCollapsed && toolsCollapsed) {
		return (
			`命中段在 **tools 一侧**（system 之前）：只改 tools 命中就塌（${toolsSideCacheRead} 对无变化轮 ${stableRead}），` +
			`而 system 字节一改命中不动（${systemSideCacheRead}）—— 只有「tools 排在请求最前、system 在它之后」能同时解释两侧。`
		);
	}
	if (systemCollapsed && toolsCollapsed) {
		return (
			`**未解释**：两侧改动都让命中塌了（system 侧 ${systemSideCacheRead}、tools 侧 ${toolsSideCacheRead}，无变化轮 ${stableRead}）` +
			`—— 两个变量都动不了前缀匹配的解释不止一种，不给因果结论。`
		);
	}
	return (
		`**未解释**：两侧改动都没让命中塌（system 侧 ${systemSideCacheRead}、tools 侧 ${toolsSideCacheRead}，无变化轮 ${stableRead}）` +
		`—— 先看「账号级缓存复用」那条：这一串字节多半**此前已经被发过**（复跑必踩），` +
		`那样的读数证明不了任何一侧；重跑一次（nonce 让被改动的轮每次都是新字节）再判。`
	);
}

console.log("\n===== 断点归因（差分实验：只改 system vs 只改 tools）=====");
console.log("  自变量两侧各改一次，其余一律不动：");
console.log("  · 只改 system（B 轮 2：提示词首行追加一处，tools 不动）");
console.log(`      cacheRead = ${systemSideCacheRead}　hit = ${systemSide === undefined ? "—" : hitTextOf(systemSide)}`);
console.log(`  · 只改 tools （C 轮 1：system 字节 = A 轮 1 的产物，工具面 ${baselineToolCount} → ${toolsSideToolCount}）`);
console.log(`      cacheRead = ${toolsSideCacheRead}　hit = ${toolsSide === undefined ? "—" : hitTextOf(toolsSide)}`);
console.log("  · 参照「无变化轮」（A 轮 3：system 与 tools 都没改）");
console.log(`      cacheRead = ${saturatedA?.firstStepCacheRead ?? 0}　hit = ${saturatedA === undefined ? "—" : hitTextOf(saturatedA)}`);
console.log("  · 噪声带（**同一份内容**的两发请求，命中长度就不同 —— 精度别超过这条带子）：");
console.log(
	`      A 轮 1 = ${baselineCacheRead}　B 轮 1 = ${readingsB[0]?.firstStepCacheRead ?? 0}` +
		"（都是「真实产物 + 同一句提问」的新会话首调，差值即账号级缓存条目的漂移）",
);
console.log(`  · tools 块体量（A 轮 1 payload 末行）：${payloadA1.at(-1) ?? "（没抓到）"}`);
console.log(
	nativeDiff === -1
		? "  · C 会话若不冻结，产物与 A 轮 1 逐字相同（工具面变化没有进产物）—— 冻结是保险，不是必需。"
		: `  · C 会话若不冻结，产物会在第 ${nativeDiff} 字符起与 A 轮 1 分家（${nativeC.length} vs ${promptA1.length} 字符）` +
			"\n    —— 工具面确实会经 toolSnippets 进产物，冻结才把变量隔离在 tools 一侧。",
);
console.log(`  判定：${attributionVerdict()}`);
console.log(
	"  ⚠ C 组的前提：这一串字节（含工具面变体）**此前没有被发过** —— 复跑且工具组合撞车时会被" +
		"\n    账号级缓存复用污染（把「改了 tools」读成没代价）。判定里「命中没塌」只在 C 轮是新字节时才作数。",
);
console.log(
	"  账号级缓存复用（实测根因，解释「同一实验跨次读出互不相等的值」）：" +
		"\n    前缀缓存在账号级，而且「同一串字节发过一次，下一次就命中」—— 实测同一份产物连跑两次：" +
		"\n      A 轮 1（同内容、新会话首调）：27.2%（cacheRead 1664）→ 96.3%（cacheRead 5888）" +
		"\n      B 轮 2（改动轮，字节固定时）：27.1%（cacheRead 1664）→ 95.8%（cacheRead 5888）" +
		"\n    ⇒ **改动轮的读数只在「首次发出这一串字节」时有效**；复跑会把「变更轮」变成「已缓存」，读起来像没代价。" +
		"\n    本版因此给被改动的轮加了逐 run nonce（B 组的 CHANGE_LINE、C 组摘哪几个工具），A 组保持产物原字节不动。",
);
console.log(
	"  跨次记要（现象留档，不是结论）：B 轮 2 先后读到过 0.0%（cacheRead 0，上一版探针）/ 11.0%（640）/ 27.1%（1664）/" +
		"\n    93.2%（5120，另一次实跑，与稳定轮同量级、**没有**塌）/ 95.8%（5888，同一份产物连跑第二次）。" +
		"\n    这些数里「塌 / 不塌」的翻转已被上一条解释：字节是否已被发过；与改动点相对 tools 的位置无关。" +
		"\n    仍然没有解释的是**残值的大小**：0 / 640 / 1664 / 5120 / 5888 都出现过 —— 残值不许当精确代价用" +
		"\n    （同一份内容两发请求的漂移见上面的噪声带）。",
);

console.log("\n===== 路线判据 =====");
console.log(
	sectionsSupported
		? "  ① 分段 patch 路径：本 pi 版本带 sections —— 组装路线要重新评估。"
		: "  ① 分段 patch 路径：**本 pi 版本没有这条路径**（见上「pi 的接线事实」）—— 缓存只能靠「同一会话内提示词逐轮字节稳定」保住。",
);
if (saturatedA !== undefined) {
	console.log("  ② 字节稳定 ⇒ 缓存保住（A 轮 3：真实产物一字未变，请求里也没有新增 system 消息）");
	console.log(`     首步 hit = ${hitTextOf(saturatedA)}`);
	console.log(`     首步 cacheRead = ${saturatedA.firstStepCacheRead}`);
	if (baselineA1 !== undefined) {
		console.log(`     参考·A 轮 1（新会话首调）：hit = ${hitTextOf(baselineA1)}，cacheRead = ${baselineA1.firstStepCacheRead}`);
	}
}
if (systemSide !== undefined) {
	const stableRead = saturatedA?.firstStepCacheRead ?? baselineCacheRead;
	const systemCollapsed = systemSideCacheRead * 2 < stableRead;
	console.log("  ③ 对照组（真实产物首行追加一处，tools 不动）");
	console.log(`     首步 hit = ${hitTextOf(systemSide)}`);
	console.log(`     首步 cacheRead = ${systemSide.firstStepCacheRead}`);
	console.log(
		systemCollapsed
			? "     ⇒ 命中塌了：改动点的字符深度确实决定了还能命中的长度 —— 前提是这一段**确实在请求最前面**" +
				"\n       （本轮的差分判定指向 system / 消息一侧，见上「断点归因」）。"
			: "     ⇒ 命中没塌：改动在第 0 字符却仍与无变化轮同量级 ⇒ 被命中的那一截与被改动的 system 字节无关" +
				"\n       （归因与未解释项见上「断点归因」）。",
	);
	console.log("     ⚠ 不要读成「③ 与 ② 的差 = 一处逐轮可变事实的代价」：残值受账号级缓存条目漂移影响，" +
		"\n       同内容两发请求都能差上千 token（见「断点归因」的噪声带）。");
}
console.log(
	"  ⇒ 出货纪律：任何逐轮/逐 run 可能变的事实（运行时间、记忆内容、个性化、cwd）都必须走 append-only 消息注入，" +
		"\n    绝不进系统提示词；门禁在 extensions/prompt-switch.test.ts（透过同一个生产组装入口断言）。",
);

rmSync(cwd, { recursive: true, force: true });
// 等 stdout 把最后几段真正写完再退出：Windows TTY 上 stdout 是异步的，
// 裸 process.exit 会把没收到的输出截掉（见文件头的收尾纪律）。
await new Promise<void>((resolve) => {
	process.stdout.write("", () => resolve());
});
process.exit(0);
