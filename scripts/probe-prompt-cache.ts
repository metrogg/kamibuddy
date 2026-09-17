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
 * 两组对照，都在真实产物上做（同一会话内可比的只有「变更轮 vs 无变化轮」）：
 *
 *   A 组：同一提示词连发三轮（要求第 2、3 轮字节逐字一致）→ 期望命中接近饱和。
 *        这是「生产提示词在同一会话内逐轮字节稳定」的直接回归证据：提示词一字未变
 *        时 pi 不发新的 system 消息，整个请求前缀（含全部历史）照旧命中。
 *
 *   B 组：真实提示词 +（**只**）改动一处 → 期望命中明显下降。
 *        对照组：证明 A 组的高命中不是「读数一直很高」的假象。改动放在提示词**第一行**
 *        （最坏位置）：系统提示词位于整个请求最前面，改动点之前的字节数就是还能命中的
 *        上界。历史事故的改动点（骨架里的 cwd 行 ≈ 提示词的 25% 深度、记忆内容块
 *        ≈ 85% 深度）介于 A 与 B 之间，实测取值见 spec.md 的「探针结论（实测）」②。
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
import { getEffectiveWorkspaceRoot, readPreferences } from "../src/core/preferences.ts";
import type { PromptContextOptions, SkillDescriptor } from "../src/core/prompt-composer.ts";
import { loadResources } from "../src/core/resources.ts";
import { filterEnabledSkills } from "../src/core/skill-status.ts";
import { SessionHost } from "../src/core/session-host.ts";
import { createSystemPromptComposerFromDefaults } from "../src/core/system-prompt-composer.ts";
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
	enabledSkills: () => enabledSkillDescriptors(),
	// 风格漂移（偏好里存的 id 不在资源库）与 daemon 一致地响亮报出来，不静默。
	onStyleDrift: (drift) => {
		console.error(`⚠ 回复风格配置漂移：偏好要的是「${drift.requested}」，资源库没有，回落「${drift.fallback}」`);
	},
});

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
	return [...lines, `(另有 ${Array.isArray(tools) ? tools.length : 0} 个 tools)`];
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
}

class SessionRecorder {
	readonly steps: StepRecord[] = [];
	readonly dumps: CallDump[] = [];

	onContext(messages: readonly unknown[]): void {
		this.dumps.push({ transcript: describeTranscript(messages), payload: undefined });
	}

	onPayload(payload: unknown): void {
		const last = this.dumps.at(-1);
		if (last === undefined) {
			this.dumps.push({ transcript: ["✗ 没有对应的 context 事件"], payload: describePayload(payload) });
			return;
		}
		// 重试会复用同一份 payload，重复写同一个位置即可。
		last.payload = describePayload(payload);
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
	beforeAgentStart: (event: BeforeAgentStartEvent) => BeforeAgentStartEventResult,
): InlineExtension {
	return (pi: ExtensionAPI): void => {
		pi.on("before_agent_start", (event) => beforeAgentStart(event));
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

async function createHost(recorder: SessionRecorder, extension: InlineExtension): Promise<SessionHost> {
	return SessionHost.create({
		catalog,
		modelKey,
		cwd,
		isTempTask: false,
		sceneId: SCENE_ID,
		interactionId: INTERACTION_ID,
		emit: (event) => {
			if (event.type !== "assistant_done") return;
			// usage 在类型上是可选的（pi 的助手消息一定带，见 session-host 的 toTokenUsage），
			// 真缺了这一步就不进读数 —— 轮级断言会把「一轮没有可用读数」响亮报出来。
			const usage = event.message.usage;
			if (usage !== undefined) recorder.onAssistantDone(event.message.text, usage);
		},
		resources,
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
	createProbeExtension(recA, (event) => {
		if (optionsKeys.length === 0) optionsKeys = Object.keys(event.systemPromptOptions);
		const prompt = composeSystemPrompt({
			sceneId: SCENE_ID,
			interactionId: INTERACTION_ID,
			expertId: undefined,
			piContext: piContextOf(event),
		}).prompt;
		promptsA.push(prompt);
		return { systemPrompt: prompt };
	}),
);

/* ── B 组：真实提示词 + 只改动一处（最坏位置）──────────────────── */

const recB = new SessionRecorder();
/**
 * B 组的唯一自变量：往真实产物的**第一行之前**追加一行。放最前面是最坏位置 ——
 * 系统提示词在整个请求的最前面，改动点之前的字节数就是本轮还能命中的上界。
 */
const CHANGE_LINE = "[PROBE] 本轮新增的一处事实（对照组专用，真实产物里没有这一行）";
const bState = { changed: false };
const promptsB: string[] = [];

const hostB = await createHost(
	recB,
	createProbeExtension(recB, (event) => {
		const prompt = composeSystemPrompt({
			sceneId: SCENE_ID,
			interactionId: INTERACTION_ID,
			expertId: undefined,
			piContext: piContextOf(event),
		}).prompt;
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
console.log(`  B 组只改了一处：首个差异在第 ${changeOffset} 字符（占轮 2 提示词的 ${changeDepth}% —— 越靠前代价越大）`);
console.log("  命中率的上界就是「差异点之前的内容占整个请求的比例」：B 组的改动在最坏位置，A 组没有改动点");
console.log(
	"  读数的口径提醒（别拿绝对数字跨次比较）：命中率绝对值还受**账号级缓存**状态影响" +
		"\n    （上一次同前缀请求是否还在缓存窗口内），跨次运行不能直接比大小；" +
		"\n    可比的是同一条轮次序列里「无变化轮 vs 变更轮」的差（本探针的 A 轮 2/3 vs B 轮 2）。",
);

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
for (const reading of [...readingsA, ...readingsB]) {
	console.log(
		`  ${reading.label}　轮 ${reading.round}　prompt=${reading.firstStepPrompt}　cacheRead=${reading.firstStepCacheRead}　hit=${hitTextOf(reading)}　${reading.note}`,
	);
}

console.log("\n===== 结构证据 =====");
console.log(`A 轮 2 transcript：${(readingsA[1]?.transcript ?? []).join(" → ")}`);
console.log(`A 轮 2 payload   ：${payloadA2.join(" → ")}`);
console.log(`B 轮 2 payload   ：${(readingsB[1]?.payload ?? []).join(" → ")}`);

const saturatedA = readingsA[2];
const baselineA = readingsA[0];
console.log("\n===== 路线判据 =====");
console.log(
	sectionsSupported
		? "  ① 分段 patch 路径：本 pi 版本带 sections —— 组装路线要重新评估。"
		: "  ① 分段 patch 路径：**本 pi 版本没有这条路径**（见上「pi 的接线事实」）—— 缓存只能靠「同一会话内提示词逐轮字节稳定」保住。",
);
if (saturatedA !== undefined) {
	console.log(
		`  ② 字节稳定 ⇒ 缓存保住：A 轮 3（真实产物一字未变，请求里也没有新增 system 消息）首步 hit = ${hitTextOf(saturatedA)}，` +
			`轮 1（新会话首调）hit = ${baselineA === undefined ? "—" : hitTextOf(baselineA)}。`,
	);
}
const changedB = readingsB[1];
if (changedB !== undefined) {
	console.log(
		`  ③ 对照组（只在真实产物前面加一行）首步 hit = ${hitTextOf(changedB)} —— 与 ② 的差就是「一处逐轮可变事实」的代价（越靠前越贵）。`,
	);
}
console.log(
	"  ⇒ 出货纪律：任何逐轮/逐 run 可能变的事实（运行时间、记忆内容、个性化、cwd）都必须走 append-only 消息注入，" +
		"\n    绝不进系统提示词；门禁在 extensions/prompt-switch.test.ts（透过同一个生产组装入口断言）。",
);

rmSync(cwd, { recursive: true, force: true });
process.exit(0);
