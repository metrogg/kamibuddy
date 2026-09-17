/**
 * 提示词前缀缓存探针（spec: stabilize-prompt-prefix，Task 1）。
 *
 * 要回答的问题：pi 的「分段 diff + patch」路线在 DeepSeek 上到底成不成立。
 *
 * 前提本身先被探针推翻了一半（这一条是本次最重要的发现，代码级证据在下面两条：
 *   `node_modules/@earendil-works/pi-coding-agent/dist/core/system-prompt.d.ts`：安装版
 *   0.85.1 的 `BuildSystemPromptOptions` **没有** `sections` / `forceSystemPrompt` /
 *   `toolGuidelines`，也没有 `buildSystemPromptSections` / `diffSystemPromptSections`；
 *   `dist/core/extensions/runner.js` 的 `emitBeforeAgentStart` 只认 handler 返回的
 *   `systemPrompt` 字符串，`agent-session.js` 把它整串塞进 `agent.state.systemPrompt`。
 *   而 `开源项目/pi`（git describe = v0.85.1-85-ge4c75a732，比 v0.85.1 标签新 85 个提交）
 *   才有 sections/`replace: true`/`diffSystemPromptSections` 那一整套 —— spec 与 tasks 里
 *   引用的「pi 0.85.1 的两条路」来自那份**未发布**的源码，不是我们实际依赖的运行时。
 *
 * 于是探针分两组，各自回答一个还能测的问题：
 *
 *   A 组（基线 = 当前生产行为，forced 整体替换）：同一会话三轮。
 *     轮 1→2 在提示词里制造一处逐轮变化的事实（模拟「模型自己写的记忆」——生产提示词里
 *     第一个会变的东西），看第二轮首步的缓存命中被砍到多少；
 *     轮 2→3 不制造任何变化（字节完全一致），验证「提示词字节稳定 ⇒ 前缀保住」这条路线。
 *
 *   B 组（模型契约，手写 delta）：同一会话两轮，第一轮的稳定段要求模型「每条回复以
 *     【KB】开头且用中文」。第二轮在 `before_provider_request` 里把请求**改写成
 *     pi 的 patch 路线会发出的形状**（leading system 保持不变 + 只含变化段的一条
 *     对话中段 system 消息），再问一个诱导模型说外语的问题：
 *       模型仍遵守稳定段 ⇒ 模型把中段 system 当增量（patch 语义成立）；
 *       稳定段被丢掉     ⇒ dsh 记的那条契约成立（latest system = 完整系统提示词），
 *                         也就意味着将来升级到带 patch 的 pi 时必须放弃这条路线。
 *     **这一段是手写 delta，不是 pi 的行为**（安装版 pi 根本没有 patch 路径）——
 *     它测的是模型契约，不是 pi 的接线。
 *
 * 为什么必须真跑：命中读数要 provider 真实 usage 才作数（口径复用
 * shared/observability.ts）；「请求里到底有几条 system 消息、在哪」只有把实际
 * payload dump 出来才知道 —— 这是判断「pi 有没有 patch 路径」的唯一直接证据。
 *
 * 会发起真实模型请求（每轮一次，提问都很短），消耗极小额度。用真实配置目录
 * （~/.kamibuddy）以加载真实凭据；cwd 用临时目录、会话走内存（SessionManager.inMemory），
 * 不往用户会话目录落盘，也不碰用户任务目录。
 * 时钟冻结（见 FROZEN_NOW）：本探针只留「变更块」一个自变量。
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
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { getResourcesDir } from "../src/core/config-paths.ts";
import { loadMemorySystemPrompt } from "../src/core/memory.ts";
import { ModelCatalog } from "../src/core/model-catalog.ts";
import { readPreferences } from "../src/core/preferences.ts";
import { DEFAULT_STYLE_ID, loadResources } from "../src/core/resources.ts";
import { SessionHost } from "../src/core/session-host.ts";
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

console.log("=== 提示词前缀缓存探针（spec: stabilize-prompt-prefix / Task 1）===\n");

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
function requireResource<T>(found: T | undefined, what: string): T {
	if (found === undefined) die(`仓库 resources/ 不完整：${what} 找不到。`);
	return found;
}
const scene = requireResource(
	resources.scenes.find((s) => s.id === "work"),
	"场景 work（resources/scenes/work/prompt.md）",
);
const mode = requireResource(
	resources.modes.find((m) => m.id === "craft"),
	"交互模式 craft（resources/modes/craft.md）",
);
const style = requireResource(
	resources.styles.find((s) => s.id === DEFAULT_STYLE_ID),
	`默认风格 ${DEFAULT_STYLE_ID}（resources/styles/）`,
);
const memorySystemBody = loadMemorySystemPrompt(getResourcesDir());

// 时钟冻结：生产的时间块是分钟级（同一分钟内字节不变），本探针连这一处抖动也不要，
// 好让「变更块」成为唯一的自变量。
const FROZEN_NOW = new Date();
console.log(`时钟冻结在：${FROZEN_NOW.toISOString()}（消除时间块抖动，只留一个自变量）`);

const cwd = mkdtempSync(join(tmpdir(), "kami-probe-prompt-cache-"));
console.log(`工作目录：${cwd}\n`);

/* ── 生产形态的提示词（本地重排，段序照 daemon 的 composeSystemPrompt）── */

/** 从 before_agent_start 事件里取出的 pi 侧上下文（与 prompt-switch 透传的那三块同源）。 */
interface PiContext {
	readonly contextFiles: ReadonlyArray<{ readonly path: string; readonly content: string }>;
	readonly toolSnippets: Readonly<Record<string, string>>;
	readonly promptGuidelines: readonly string[];
}

const INCLUDE = /\{\{>\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\}\}/g;

/** 片段展开：缺失即抛错（不静默留洞，同 composer 的纪律）。 */
function expandIncludes(body: string): string {
	return body.replace(INCLUDE, (_match, name: string) => {
		const fragment = resources.fragments.get(name);
		if (fragment === undefined) {
			throw new Error(`提示词片段「${name}」缺失（resources/prompts/fragments/）——探针不静默留洞`);
		}
		return fragment.replace(/^\n+/, "").replace(/\n+$/, "");
	});
}

function formatPiContext(piContext: PiContext): string {
	const sections: string[] = [];
	if (piContext.contextFiles.length > 0) {
		const blocks = piContext.contextFiles
			.map(({ path, content }) => `<project_instructions path="${path}">\n${content}\n</project_instructions>`)
			.join("\n\n");
		sections.push(`<project_context>\n\nProject-specific instructions and guidelines:\n\n${blocks}\n</project_context>`);
	}
	const snippets = Object.entries(piContext.toolSnippets).filter(([name, text]) => name !== "" && text !== "");
	if (snippets.length > 0) {
		sections.push(`Available tools:\n${snippets.map(([name, text]) => `- ${name}: ${text}`).join("\n")}`);
	}
	const guidelines = piContext.promptGuidelines.filter((line) => line.trim() !== "");
	if (guidelines.length > 0) {
		sections.push(`Guidelines:\n${guidelines.map((line) => `- ${line}`).join("\n")}`);
	}
	return sections.join("\n\n");
}

function piContextOf(event: BeforeAgentStartEvent): PiContext {
	return {
		contextFiles: event.systemPromptOptions.contextFiles ?? [],
		toolSnippets: event.systemPromptOptions.toolSnippets ?? {},
		promptGuidelines: event.systemPromptOptions.promptGuidelines ?? [],
	};
}

/**
 * 组装「当前生产形态」的系统提示词：骨架（含片段展开与槽位替换）→ 风格 →
 * 记忆纪律 → **变更块** → pi 上下文 → 时间。
 *
 * 变更块放记忆内容的位置：那正是生产提示词里第一个逐轮可变的事实
 * （模型往记忆里追加一条，下一轮组装就变了）。A 组用它，B 组的稳定段/标记段也用它。
 */
function buildShapedPrompt(input: { readonly variableBlock: string; readonly piContext: PiContext }): string {
	let skeleton = expandIncludes(scene.body);
	skeleton = skeleton.replace("{{interaction}}", mode.body.trim());
	// 技能清单段这里恒为空：探针不关心清单内容，只关心段序与字节稳定性。
	skeleton = skeleton.replace("{{skills}}", "");
	skeleton = skeleton.replace("{{cwd}}", cwd);

	const parts = [skeleton, style.body.trim(), memorySystemBody?.trim() ?? "", input.variableBlock];
	const piBlock = formatPiContext(input.piContext);
	if (piBlock !== "") parts.push(piBlock);
	parts.push(`Current time: ${FROZEN_NOW.toISOString().slice(0, 16).replace("T", " ")}`);
	return parts.filter((part) => part !== "").join("\n\n");
}

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
	/** 这份 payload 被探针改写过（B 组的手写 delta），打印时标出来免得误读成 pi 的行为。 */
	rewritten: boolean;
}

class SessionRecorder {
	readonly steps: StepRecord[] = [];
	readonly dumps: CallDump[] = [];

	onContext(messages: readonly unknown[]): void {
		this.dumps.push({ transcript: describeTranscript(messages), payload: undefined, rewritten: false });
	}

	onPayload(payload: unknown, rewritten: boolean): void {
		const last = this.dumps.at(-1);
		if (last === undefined) {
			this.dumps.push({ transcript: ["✗ 没有对应的 context 事件"], payload: describePayload(payload), rewritten });
			return;
		}
		// 重试会复用同一份 payload，重复写同一个位置即可。
		last.payload = describePayload(payload);
		last.rewritten = rewritten;
	}

	onAssistantDone(text: string, usage: TokenUsage): void {
		this.steps.push({ text, usage });
	}
}

function createProbeExtension(
	recorder: SessionRecorder,
	beforeAgentStart: (event: BeforeAgentStartEvent) => BeforeAgentStartEventResult | undefined,
	rewritePayload?: (payload: unknown) => unknown,
): InlineExtension {
	return (pi: ExtensionAPI): void => {
		pi.on("before_agent_start", (event) => beforeAgentStart(event));
		pi.on("context", (event) => {
			recorder.onContext(event.messages);
			return undefined;
		});
		pi.on("before_provider_request", (event) => {
			if (rewritePayload === undefined) {
				recorder.onPayload(event.payload, false);
				return undefined;
			}
			const rewritten = rewritePayload(event.payload);
			recorder.onPayload(rewritten, true);
			return rewritten;
		});
	};
}

async function createHost(recorder: SessionRecorder, extension: InlineExtension): Promise<SessionHost> {
	return SessionHost.create({
		catalog,
		modelKey,
		cwd,
		isTempTask: false,
		sceneId: "work",
		interactionId: "craft",
		emit: (event) => {
			if (event.type !== "assistant_done") return;
			// usage 在类型上是可选的（pi 的助手消息一定带，见 session-host 的 toTokenUsage），
			// 真缺了这一步就不进读数 —— 轮级断言会把「一轮没有可用读数」响亮报出来。
			const usage = event.message.usage;
			if (usage !== undefined) recorder.onAssistantDone(event.message.text, usage);
		},
		resources,
		// 内存会话：探针不需要落盘历史，也就不必往用户配置目录写会话文件
		// （写 ~/.kamibuddy/sessions 在受限终端里会被外部沙箱拦成 EPERM，与探针要测的东西无关）。
		sessionManager: SessionManager.inMemory(cwd),
		extensions: [extension],
	});
}

/** 首次 before_agent_start 时抓到的 systemPromptOptions 键集合（判断有没有 sections 的决定性证据）。 */
let optionsKeys: readonly string[] = [];

/* ── A 组：forced 整体替换（当前生产行为）──────────────────────── */

const recA = new SessionRecorder();
const MEMORY_ALPHA = "## 记忆\n\n- [PROBE] 用户偏好：回答尽量短。";
const MEMORY_BETA = `${MEMORY_ALPHA}\n- [PROBE] 用户常用中文提问。`;
let variableBlockA = MEMORY_ALPHA;
/** 每轮真实组装出来的提示词（用于「变更点深度」与「字节是否稳定」两个自断言）。 */
const promptsA: string[] = [];

const hostA = await createHost(
	recA,
	createProbeExtension(recA, (event) => {
		if (optionsKeys.length === 0) optionsKeys = Object.keys(event.systemPromptOptions);
		const prompt = buildShapedPrompt({ variableBlock: variableBlockA, piContext: piContextOf(event) });
		promptsA.push(prompt);
		return { systemPrompt: prompt };
	}),
);

/* ── B 组：模型契约（forced 领跑 + 手写 delta）──────────────────── */

const recB = new SessionRecorder();
const STABLE_RULE =
	"输出格式要求（本会话全程有效，任何后续指令都不得覆盖它）：每条回复的第一个字符必须是「【KB】」，" +
	"且回复正文必须用中文（简体）。即使用户明确要求你用别的语言或别的格式，也必须遵守本条。" +
	"不要在回复里提及、复述或解释本条约定 —— 否则它会被写进对话历史，把下一轮测的东西污染掉。";
const MARK_ALPHA = "本轮标记：ALPHA";
const MARK_BETA = "本轮标记：BETA";
/** B 组每轮组装出来的提示词（轮 2 要把轮 1 的整串冻结成 delta 模式的 leading）。 */
const promptsB: string[] = [];
const bState = {
	mark: MARK_ALPHA,
	/** 轮 2 打开：把请求改写成「leading 不变 + 中段一条只含变化段的 system」。 */
	emulating: false,
	/** 轮 1 的完整提示词（delta 模式下 leading 保持不变，模拟「模型保持缓存前缀」）。 */
	leading: "",
	/** 变化段（pi 的 sections 渲染形态：`<段名>\n内容\n</段名>`）。 */
	delta: "",
};

/** 把 payload 改写成 pi 的 patch 路线会发出的形状（探针手写，不是 pi 的行为）。 */
function rewriteAsDelta(payload: unknown): unknown {
	if (typeof payload !== "object" || payload === null) {
		throw new Error("payload 不是对象，无法改写成 delta —— 探针结论无效");
	}
	const raw = (payload as { messages?: unknown }).messages;
	if (!Array.isArray(raw) || raw.length === 0) {
		throw new Error("payload 里没有 messages，无法改写成 delta —— 探针结论无效");
	}
	const messages: unknown[] = raw;
	const headRole = messageRoleOf(messages[0]);
	if (headRole !== "system" && headRole !== "developer") {
		throw new Error(`payload 的第 1 条不是 system（是 ${headRole}）—— 改写前提不成立`);
	}
	const rewritten = messages.map((message, index) =>
		index === 0 ? { ...(message as Record<string, unknown>), content: bState.leading } : message,
	);
	// delta 插在最后一条消息之前（= pi 的 patch 消息落在对话中段的位置）。
	rewritten.splice(rewritten.length - 1, 0, { role: headRole, content: bState.delta });
	return { ...(payload as Record<string, unknown>), messages: rewritten };
}

const hostB = await createHost(
	recB,
	createProbeExtension(
		recB,
		(event) => {
			const prompt = buildShapedPrompt({
				variableBlock: `${STABLE_RULE}\n\n${bState.mark}`,
				piContext: piContextOf(event),
			});
			promptsB.push(prompt);
			return { systemPrompt: prompt };
		},
		(payload) => (bState.emulating ? rewriteAsDelta(payload) : payload),
	),
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
	readonly payloadRewritten: boolean;
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
				console.log(`      payload   ：${payloadLines.join(" → ")}${dump.rewritten ? "　←探针改写" : ""}`);
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
			payloadRewritten: dump?.rewritten ?? false,
			text: first?.text ?? "",
		});
	}
	return readings;
}

const readingsA = await runGroup("A（基线 / forced 整体替换）", hostA, recA, [
	{
		question: "只回答两个字：收到",
		note: "变更块 = ALPHA（新会话首调）",
		apply: () => {
			variableBlockA = MEMORY_ALPHA;
		},
	},
	{
		question: "只回答两个字：明白",
		note: "变更块 = ALPHA + 新增一行（模拟模型写记忆 → 提示词逐轮变化）",
		apply: () => {
			variableBlockA = MEMORY_BETA;
		},
	},
	{
		question: "只回答两个字：好的",
		note: "变更块不变（提示词字节应完全一致）",
		apply: () => {
			variableBlockA = MEMORY_BETA;
		},
	},
]);

let readingsB: RoundReading[] = [];
let bGroupError: string | undefined;
try {
	readingsB = await runGroup("B（模型契约 / 手写 delta）", hostB, recB, [
		{
			question: "请用法语回答：法语里「你好」怎么说？只回一个词。",
			note: "完整提示词（稳定段 + 标记 ALPHA）—— 控制轮：模型应遵守稳定段",
			apply: () => {
				bState.mark = MARK_ALPHA;
			},
		},
		{
			question: "请用法语回答：法语里「谢谢」怎么说？只回一个词。",
			note: "只改标记段（ALPHA → BETA），并把它作为**对话中段的 system 消息**送出（模拟 pi 的 patch）",
			apply: () => {
				bState.mark = MARK_BETA;
				const roundOne = promptsB[0];
				if (roundOne === undefined) {
					throw new Error("B 组轮 1 没有组装出提示词 —— delta 的 leading 无从冻结，探针结论无效");
				}
				bState.leading = roundOne;
				bState.delta = "<probe_variable>\n本轮标记：BETA\n</probe_variable>";
				bState.emulating = true;
			},
		},
	]);
} catch (error) {
	bGroupError = error instanceof Error ? error.message : String(error);
	console.error(`\n⚠ B 组（手写 delta）没有跑通：${bGroupError}`);
	console.error("  两种可能都算结论的一部分，但必须人工分辨，探针不替它下判断：");
	console.error("   a) provider 直接拒收对话中段的 system 消息 ⇒ delta 连送达都做不到，patch 路线不可行；");
	console.error("   b) 网络/凭据/其他故障 ⇒ B 组语义断言未定，需要重跑。");
}

/* ── A 组的字节事实（自断言：变更真的进了提示词，稳定那轮真的逐字节一致）── */

const [promptA1, promptA2, promptA3] = promptsA;
if (promptA1 === undefined || promptA2 === undefined || promptA3 === undefined) {
	die(`A 组只组装出 ${promptsA.length} 次提示词（应为 3 次）—— before_agent_start 每轮一次，数目不对说明会话没按预期跑。`);
}
if (promptA1 === promptA2) {
	die("A 轮 1 与轮 2 的提示词字节完全一致 —— 变更没进提示词，这一轮基线什么都测不到。");
}
if (promptA2 !== promptA3) {
	die("A 轮 2 与轮 3 的提示词字节不一致 —— 「无变化」那轮的前提不成立（时钟/上下文有抖动）。");
}
const diffOffset = firstDifferenceOffset(promptA1, promptA2);
const depth = ((diffOffset / promptA2.length) * 100).toFixed(1);
console.log("\n===== A 组的字节事实 =====");
console.log(`  提示词长度：轮 1 = ${promptA1.length} 字符，轮 2 = ${promptA2.length} 字符`);
console.log(`  首个差异字节：第 ${diffOffset} 字符（变更点之前的内容占轮 2 提示词的 ${depth}%）`);
console.log("  命中率的上限就是这一段：变更点之后的一切（含全部对话历史、工具声明）都要重算");
console.log(`  轮 2 与轮 3 字节完全一致（${promptA2.length} 字符）→ 请求里应当没有新增的 system 消息，前缀照旧命中`);
console.log(
	"  读数的口径提醒：决定命中率的是**变更点之前的内容占整个请求的比例**，不是「是否整体替换」。" +
		"\n    台账里 6 个会话首调只命中 1408-2816 / 12K-22K，是同一机制的另一处取值：断点落在 cwd 行" +
		"\n    （约 25% 字符深度）且其后还有约 20K 字符的 pi-context 全部作废；本探针的提示词更短、变更点更靠后，所以读数偏高。",
);
console.log(
	"  可复跑性提醒：命中率绝对值还受**账号级缓存**状态影响（上一次同前缀请求是否还在缓存窗口内），" +
		"\n    跨次运行不能直接比大小；可比的是同一条轮次序列里「变更轮 vs 无变化轮」的差。",
);

/* ── pi 的接线事实（运行时自断言）───────────────────────────── */

const sectionsSupported = optionsKeys.includes("sections") || optionsKeys.includes("forceSystemPrompt");
console.log("\n===== pi 的接线事实（运行时抓取）=====");
console.log(`  before_agent_start 的 systemPromptOptions 键：${optionsKeys.join(", ")}`);
console.log(
	sectionsSupported
		? "  ✗ 出乎意料：这个 pi 版本带了 sections/forceSystemPrompt —— 本探针的版本判断要重做。"
		: "  → 没有 sections / forceSystemPrompt：这个 pi 版本**没有**分段 diff + patch 路径，on the wire 只能整体替换或原样复用。",
);
const payloadA1 = readingsA[0]?.payload ?? [];
const payloadA2 = readingsA[1]?.payload ?? [];
const payloadA3 = readingsA[2]?.payload ?? [];
console.log(
	`  A 组 transcript 里没有任何 system 消息：${(readingsA[2]?.transcript ?? []).join(" → ")}` +
		"\n    （安装版 pi 不把系统提示词放进消息数组：它挂在 agent.state.systemPrompt 上，每次请求作为 leading 送）",
);
console.log(`  A 组三次请求的 system 条数：轮 1 = ${countSystems(payloadA1)}，轮 2 = ${countSystems(payloadA2)}，轮 3 = ${countSystems(payloadA3)}（恒 1 条 = leading，没有 patch 消息、没有重放数组）`);
if (sectionsSupported || hasMidConversationSystem(payloadA2) || hasMidConversationSystem(payloadA3)) {
	die("结构 dump 显示请求里出现了对话中段的 system 消息 —— 与上面的版本判断冲突，请人工复核。");
}

/* ── 语义断言：未变化的那一段还在不在 ───────────────────────────── */

const MARKER = "【KB】";
const baselineAnswer = readingsB[0]?.text ?? "";
const deltaAnswer = readingsB[1]?.text ?? "";
const baselineObeyed = baselineAnswer.includes(MARKER);
const deltaObeyed = deltaAnswer.includes(MARKER);
if (!baselineObeyed) {
	console.error(
		"\n⚠ B 组控制轮（完整提示词）的回复里没有稳定段的标记 —— 稳定段根本没被模型遵守，" +
			"\n  语义断言不可判（不是 patch/delta 的问题，是这条规则本身没生效）。请在结论里按「未定」计。",
	);
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
console.log(
	`B 轮 2 payload   ：${(readingsB[1]?.payload ?? []).join(" → ")}　←手写 delta${readingsB[1]?.payloadRewritten === true ? "（已改写）" : "（未改写/未跑到）"}`,
);
console.log(`B 轮 1 回复      ：${JSON.stringify(baselineAnswer)}`);
console.log(`B 轮 2 回复      ：${JSON.stringify(deltaAnswer)}`);

const noChangeA = readingsA[2];
const deltaVerdict =
	bGroupError !== undefined
		? "未定（B 组请求失败，见上方错误与两种可能的区分办法）"
		: !baselineObeyed
			? "未定（B 组控制轮模型就没遵守稳定段 —— 规则本身没生效）"
			: deltaObeyed
				? "模型仍遵守未变化的段（把对话中段的 system 当**增量**）—— patch 语义成立"
				: "未变化的段被丢掉（latest system = 完整系统提示词，dsh 记的契约成立）—— patch 语义不成立";

console.log("\n===== 路线判据 =====");
console.log(
	sectionsSupported
		? "  ① 分段 patch 路径：本 pi 版本带 sections —— 走 Task 4 的声明式路线。"
		: "  ① 分段 patch 路径：**本 pi 版本没有这条路径**（见上「pi 的接线事实」）——Task 4 的声明式分段在当前依赖上无处落脚，只能走字节稳定路线，或先把 pi 升到带 sections 的版本。",
);
if (noChangeA !== undefined) {
	console.log(
		`  ② 字节稳定路线：A 轮 3（提示词一字未变，请求里也没有新增 system 消息）首步 hit = ${hitTextOf(noChangeA)} —— 同一会话内只要提示词字节稳定，前缀就保得住。`,
	);
}
console.log(`  ③ 模型契约（假想的 patch 路线，手写 delta 测出）：${deltaVerdict}。`);
console.log(
	"     ⇒ 若有一天升级到带 patch 的 pi，先把这一条测清楚再决定路线；在当前依赖上它不是一个待决问题（没有 patch 路径可走）。",
);

rmSync(cwd, { recursive: true, force: true });
process.exit(0);
