/**
 * 上下文快照落盘的端到端钉子（spec: persist-context-snapshots Task 5）。
 *
 * 为什么必须有这个文件：Task 1–4 的验证全是**签名级 / 形态级**（假 ExtensionAPI、
 * 假 sessionManager）—— 它们能证明「内容相同时 handler 不返回 message」，
 * 却证明不了我们真正要买的那件事：**pi 真的把快照写进会话文件了吗？落在本轮
 * 用户消息之后吗？一个 run 内 N 次模型调用真的只落 1 条吗？** AGENTS.md §8：
 * 证据要打真入口路径。所以这里走：
 *
 *   真实 createAgentSession（真 DefaultResourceLoader + 真 SettingsManager
 *   + 真 SessionManager（临时目录，真落盘））
 *   + 真实 createPromptSwitch（生产文件本身，不是镜像）
 *   + **唯一打桩处 = 模型端点**：本地 HTTP 服务器按脚本吐 OpenAI 兼容 SSE
 *     （与 scripts/probe-structured-output.ts 同一手法：不联网、不需要 key）。
 *
 * 于是「模型这一轮实际收到了什么」有原始证据（服务器收到的请求体），
 * 「会话里落了什么」也有原始证据（会话文件的行 + SessionManager 的条目）。
 *
 * ── 桩的边界（不许含糊）──────────────────────────────────────────────
 * 真：pi 的 AgentSession 装配、before_agent_start 的 emit 与 result.messages 的
 *     落地（agent-session.js 的 emitBeforeAgentStart → push role:"custom" →
 *     message_end → sessionManager.appendCustomMessageEntry）、SessionManager 的
 *     落盘与 buildContextEntries()、扩展本体（createPromptSwitch）。
 * 桩：① 模型端点（HTTP 层的假 OpenAI 兼容服务，返回脚本化 SSE）；
 *     ② 扩展的四个**输入**（compose / composeRuntimeContext / composeHiddenContext /
 *     composeRunTime）—— 生产里它们分别是 daemon 的提示词组装与宿主冻结的两份
 *     hidden context 正文，对「快照怎么投递、去不去重、落不落盘」而言是输入
 *     而不是被测对象（**输入本身仍用生产纯函数拼**：见 `productionInputs`，
 *     所以「时间被拼回环境块」这类形态变化照样能让本文件变红）。
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createAgentSession,
	DefaultResourceLoader,
	SessionManager,
	SettingsManager,
	type AgentSession,
} from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ModelCatalog } from "../core/model-catalog.ts";
import { formatRuntimeContext } from "../core/prompt-composer.ts";
import {
	composeHiddenBlock,
	formatRunTime,
	HIDDEN_CONTEXT_MARKER,
	SNAPSHOT_SUPERSEDE_NOTE,
	type HiddenSection,
} from "../shared/hidden-context.ts";
import {
	HIDDEN_CONTEXT_CUSTOM_TYPE,
	RUN_TIME_CUSTOM_TYPE,
	RUNTIME_CONTEXT_CUSTOM_TYPE,
} from "../shared/observability.ts";
import { createPromptSwitch } from "./prompt-switch.ts";

/* ── 假模型端点（唯一打桩处）────────────────────────────────────────── */

/** OpenAI 兼容 SSE 的一帧。格式与 scripts/probe-structured-output.ts 同源。 */
function sseChunk(delta: Record<string, unknown>, finishReason: string | null): string {
	return `data: ${JSON.stringify({
		id: "chatcmpl-snapshot",
		object: "chat.completion.chunk",
		created: 0,
		model: MODEL_ID,
		choices: [{ index: 0, delta, finish_reason: finishReason }],
		// 末块必须带 usage：pi 用它算上下文用量，缺了会被当成异常（探针实测）。
		...(finishReason === null
			? {}
			: {
					usage: {
						prompt_tokens: 10,
						completion_tokens: 5,
						prompt_tokens_details: { cached_tokens: 0 },
						completion_tokens_details: { reasoning_tokens: 0 },
					},
				}),
	})}\n\n`;
}

function sseToolCall(id: string, name: string, args: unknown): string {
	return (
		sseChunk(
			{
				role: "assistant",
				tool_calls: [
					{ index: 0, id, type: "function", function: { name, arguments: JSON.stringify(args) } },
				],
			},
			null,
		) +
		sseChunk({}, "tool_calls") +
		"data: [DONE]\n\n"
	);
}

function sseText(text: string): string {
	return sseChunk({ role: "assistant", content: text }, null) + sseChunk({}, "stop") + "data: [DONE]\n\n";
}

interface ModelEndpoint {
	readonly baseUrl: string;
	/** 每次模型调用的请求体 —— 「模型这一轮实际收到了什么」的原始证据。 */
	readonly requests: Record<string, unknown>[];
	setReply(reply: (callIndex: number) => string): void;
	close(): Promise<void>;
}

async function startModelEndpoint(): Promise<ModelEndpoint> {
	const requests: Record<string, unknown>[] = [];
	let reply: (callIndex: number) => string = () => sseText("（用例未准备脚本）");
	const server: Server = createServer((req, res) => {
		let raw = "";
		req.on("data", (chunk) => {
			raw += String(chunk);
		});
		req.on("end", () => {
			const index = requests.length;
			try {
				requests.push(JSON.parse(raw) as Record<string, unknown>);
			} catch {
				// 解析不了也照常记一条（空体），断言会因此失败并暴露。
				requests.push({});
			}
			res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
			res.end(reply(index));
		});
	});
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	const port = (server.address() as AddressInfo).port;
	return {
		baseUrl: `http://127.0.0.1:${port}/v1`,
		requests,
		setReply: (next) => {
			reply = next;
		},
		close: () =>
			new Promise<void>((done) => {
				server.close(() => done());
			}),
	};
}

/* ── 会话装配（真 pi，只有模型端点是桩）─────────────────────────────── */

const PROVIDER = "snapshot-probe";
const MODEL_ID = "snapshot-model";
const MODEL_KEY = `${PROVIDER}/${MODEL_ID}`;

/** 三条快照通道的输入（可变：跨 run 改内容就是改它）。 */
interface SnapshotInputs {
	runtimeContext: string;
	hiddenContext: string | undefined;
	runTime: string | undefined;
}

const RUNTIME_BLOCK = "## 长期记忆（用户级）\n\n报告一律用表格呈现数据。";
const HIDDEN_A =
	'<system-reminder data-role="user-context">\n<workspace_context>\n工作目录：D:\\proj\n</workspace_context>\n</system-reminder>';
/** 环境事实变了（换了工作目录）—— 去重用例拿它当「内容真的变了」的形态。 */
const HIDDEN_B =
	'<system-reminder data-role="user-context">\n<workspace_context>\n工作目录：D:\\proj2\n</workspace_context>\n</system-reminder>';
/** 时间块正文（`kamibuddy-run-time` 通道）。 */
const RUN_TIME_A =
	'<system-reminder data-role="additional-data">\n<current_time>\n2026-09-18 11:01（周五，GMT+8）\n</current_time>\n</system-reminder>';

/**
 * 与 `SessionHost.composeRunHiddenContext` **同一份 section 名单**的输入构造
 * （workspace_context + current_time，用生产的两个纯函数渲染）。
 *
 * 为什么输入也要走生产纯函数：本文件要钉的是「时间不再和环境块同一条消息」
 * （spec: add-supersede-note-and-time-split 的 B）。若输入是手写字符串，
 * 「把时间拼回环境块」这种形态回退就只改生产代码、测试照绿 —— 那正是 §8
 * 「护栏要先会红」要堵的洞。这里输入的形状由生产函数决定，回退立刻反映到
 * 会话文件里的字节上。
 */
function hiddenSections(cwd: string, at: Date): readonly HiddenSection[] {
	return [
		{ tag: "workspace_context", role: "user-context", body: `工作目录：${cwd}` },
		{ tag: "current_time", role: "additional-data", body: formatRunTime(at) },
	];
}

/** 由 section 名单产出三条通道的正文（时间块与环境块各一条）。 */
function productionInputs(opts: {
	readonly cwd: string;
	readonly at: Date;
	readonly memory: string | undefined;
}): SnapshotInputs {
	const sections = hiddenSections(opts.cwd, opts.at);
	return {
		runtimeContext: formatRuntimeContext({ memoryContent: opts.memory }),
		hiddenContext: composeHiddenBlock(sections, "user-context"),
		runTime: composeHiddenBlock(sections, "additional-data"),
	};
}

async function openSession(opts: {
	readonly cwd: string;
	readonly agentDir: string;
	readonly catalog: ModelCatalog;
	readonly sessionManager: SessionManager;
	readonly inputs: SnapshotInputs;
}): Promise<AgentSession> {
	const settingsManager = SettingsManager.create(opts.cwd, opts.agentDir);
	const resourceLoader = new DefaultResourceLoader({
		cwd: opts.cwd,
		agentDir: opts.agentDir,
		settingsManager,
		extensionFactories: [
			createPromptSwitch({
				getCurrent: () => ({ sceneId: "work", interactionId: "craft" }),
				// 组装本体（system-prompt-composer）不是本文件的被测对象：systemPrompt 通道
				// 的形态由 prompt-switch.test.ts 钉。这里只要求它返回一个稳定字符串。
				compose: async () => "系统提示词（本钉子不关心其内容）",
				composeRuntimeContext: () => opts.inputs.runtimeContext,
				composeHiddenContext: () => opts.inputs.hiddenContext,
				composeRunTime: () => opts.inputs.runTime,
			}),
		],
	});
	await resourceLoader.reload();

	const model = opts.catalog.resolveModel(MODEL_KEY);
	if (model === undefined) throw new Error(`模型 ${MODEL_KEY} 解析不出来（配置夹具坏了）`);

	const { session } = await createAgentSession({
		cwd: opts.cwd,
		agentDir: opts.agentDir,
		modelRuntime: opts.catalog.modelRuntime,
		model,
		sessionManager: opts.sessionManager,
		settingsManager,
		resourceLoader,
		// 只留 read：一个 run 内要产生第 2 次模型调用，必须有工具调用把 agent 循环
		// 推进到下一步（否则一个 run 恰好 1 次调用，就钉不住「N 次只落 1 条」）。
		tools: ["read"],
	});
	return session;
}

/* ── 会话文件的原始读数 ─────────────────────────────────────────────── */

interface SnapshotLine {
	/** 文件里的行号（0 = header）。位置断言与「既有那条没动过」都看它。 */
	readonly index: number;
	/** 原始 JSON 行 —— 逐字节比较用（不做任何归一化）。 */
	readonly raw: string;
	readonly content: string;
	readonly display: boolean;
}

function parseLine(raw: string): Record<string, unknown> | undefined {
	if (raw.trim() === "") return undefined;
	try {
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return undefined;
	}
}

/** 文件里某 `customType` 的快照条目（按文件顺序）。 */
function snapshotLines(file: string, customType: string): SnapshotLine[] {
	const out: SnapshotLine[] = [];
	readFileSync(file, "utf8")
		.split("\n")
		.forEach((raw, index) => {
			const parsed = parseLine(raw);
			if (parsed === undefined) return;
			if (parsed["type"] !== "custom_message" || parsed["customType"] !== customType) return;
			out.push({
				index,
				raw,
				content: typeof parsed["content"] === "string" ? parsed["content"] : "",
				display: parsed["display"] === true,
			});
		});
	return out;
}

/** 文件里每一行的类别标签（`message:user` / `custom_message:<type>` / …）—— 落位断言用。 */
function lineKinds(file: string): string[] {
	const kinds: string[] = [];
	for (const raw of readFileSync(file, "utf8").split("\n")) {
		const parsed = parseLine(raw);
		if (parsed === undefined) continue;
		const type = parsed["type"];
		if (type === "custom_message") {
			kinds.push(`custom_message:${String(parsed["customType"])}`);
			continue;
		}
		if (type === "message") {
			const message = parsed["message"];
			const role =
				typeof message === "object" && message !== null
					? (message as Record<string, unknown>)["role"]
					: undefined;
			kinds.push(`message:${String(role)}`);
			continue;
		}
		kinds.push(String(type));
	}
	return kinds;
}

/* ── 请求体的读数（模型实际收到什么）───────────────────────────────── */

function requestMessages(body: Record<string, unknown> | undefined): readonly Record<string, unknown>[] {
	const messages = body?.["messages"];
	if (!Array.isArray(messages)) return [];
	return messages.filter(
		(entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
	);
}

function messageText(message: Record<string, unknown>): string {
	const content = message["content"];
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	let text = "";
	for (const part of content) {
		if (typeof part !== "object" || part === null) continue;
		const value = (part as Record<string, unknown>)["text"];
		if (typeof value === "string") text += value;
	}
	return text;
}

function indexOfText(messages: readonly Record<string, unknown>[], needle: string): number {
	return messages.findIndex((message) => messageText(message).includes(needle));
}

/* ── 夹具 ───────────────────────────────────────────────────────────── */

let base: string;
let cwd: string;
let agentDir: string;
let sessionsDir: string;
let endpoint: ModelEndpoint;
let catalog: ModelCatalog;

beforeEach(async () => {
	base = mkdtempSync(join(tmpdir(), "kami-snapshot-session-"));
	process.env["KAMIBUDDY_CONFIG_DIR"] = join(base, "config");
	process.env["KAMIBUDDY_WORKSPACE_DIR"] = join(base, "workspace");
	cwd = join(base, "workspace");
	agentDir = join(base, "agent");
	sessionsDir = join(base, "sessions");
	for (const dir of [cwd, agentDir, sessionsDir]) mkdirSync(dir, { recursive: true });
	// read 工具的目标：本 run 用一次真实工具调用来制造第 2 次模型调用。
	writeFileSync(join(cwd, "note.txt"), "笔记正文：快照钉子的工具产物。\n", "utf8");

	endpoint = await startModelEndpoint();
	catalog = await ModelCatalog.create();
	await catalog.saveCustomProvider(
		{
			id: PROVIDER,
			name: "快照探针",
			baseUrl: endpoint.baseUrl,
			api: "openai-completions",
			models: [
				{
					id: MODEL_ID,
					name: "快照模型",
					contextWindow: 128000,
					maxTokens: 8192,
					reasoning: false,
					vision: false,
				},
			],
		},
		"sk-snapshot-not-a-real-key",
	);
});

afterEach(async () => {
	await endpoint.close();
	delete process.env["KAMIBUDDY_CONFIG_DIR"];
	delete process.env["KAMIBUDDY_WORKSPACE_DIR"];
	rmSync(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

function sessionFileOf(manager: SessionManager): string {
	const file = manager.getSessionFile();
	if (file === undefined) throw new Error("会话未落盘：getSessionFile() 返回 undefined");
	return file;
}

/* ── Task 5.1 / 5.2 / 5.3 ──────────────────────────────────────────── */

describe("上下文快照真的落进会话（真实 pi 会话 + 真实 createPromptSwitch）", () => {
	it(
		"5.1 一个 run 内两次模型调用：两通道各恰好 1 条，落在用户消息之后，且第 2 次调用读得到它（历史，不是尾巴）",
		async () => {
			endpoint.setReply((index) =>
				index === 0 ? sseToolCall("call_note", "read", { path: "note.txt" }) : sseText("读过了。"),
			);
			const inputs: SnapshotInputs = {
				runtimeContext: RUNTIME_BLOCK,
				hiddenContext: HIDDEN_A,
				runTime: RUN_TIME_A,
			};
			const manager = SessionManager.create(cwd, sessionsDir);
			const session = await openSession({ cwd, agentDir, catalog, sessionManager: manager, inputs });
			try {
				await session.prompt("看看笔记");

				// 前提守卫：本 run 真的发生了 ≥2 次模型调用（否则下面全是空谈）。
				expect(
					endpoint.requests.length,
					`模型调用次数 = ${endpoint.requests.length}（工具调用没生效就钉不住「N 次只落 1 条」）`,
				).toBeGreaterThanOrEqual(2);

				const file = sessionFileOf(manager);

				// ① 落盘 + 每通道恰好 1 条 + display:false + 正文逐字节
				const runtime = snapshotLines(file, RUNTIME_CONTEXT_CUSTOM_TYPE);
				const hidden = snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE);
				const runTime = snapshotLines(file, RUN_TIME_CUSTOM_TYPE);
				expect(runtime).toHaveLength(1);
				expect(hidden).toHaveLength(1);
				expect(runTime).toHaveLength(1);
				expect(runtime[0]?.content).toBe(RUNTIME_BLOCK);
				expect(hidden[0]?.content).toBe(HIDDEN_A);
				expect(runTime[0]?.content).toBe(RUN_TIME_A);
				expect(runtime[0]?.display).toBe(false);
				expect(hidden[0]?.display).toBe(false);
				expect(runTime[0]?.display).toBe(false);

				// ② 落位在**本轮用户消息之后**（按文件行序；失败信息里给出实际顺序）；
				//    三条通道的相对顺序由 handler 的注册顺序固定（runtime → hidden → run-time），
				//    跨调用稳定 —— 顺序一变就是位置变化，缓存前缀在那里断。
				const kinds = lineKinds(file);
				const userAt = kinds.indexOf("message:user");
				expect(userAt, `实际顺序：${kinds.join(" → ")}`).toBeGreaterThanOrEqual(0);
				expect(kinds.slice(userAt, userAt + 4), `实际顺序：${kinds.join(" → ")}`).toEqual([
					"message:user",
					`custom_message:${RUNTIME_CONTEXT_CUSTOM_TYPE}`,
					`custom_message:${HIDDEN_CONTEXT_CUSTOM_TYPE}`,
					`custom_message:${RUN_TIME_CUSTOM_TYPE}`,
				]);

				// ③ 第 2 次模型调用的消息数组里能读到它，且它不在尾巴上
				const first = requestMessages(endpoint.requests[0]);
				const second = requestMessages(endpoint.requests[1]);
				const runtimeAtFirst = indexOfText(first, RUNTIME_BLOCK);
				const hiddenAtFirst = indexOfText(first, HIDDEN_A);
				const runTimeAtFirst = indexOfText(first, RUN_TIME_A);
				expect(runtimeAtFirst, "第 1 次调用没看到 runtime-context 快照").toBeGreaterThan(0);
				expect(hiddenAtFirst, "第 1 次调用没看到 hidden-context 快照").toBeGreaterThan(0);
				expect(runTimeAtFirst, "第 1 次调用没看到 run-time 快照").toBeGreaterThan(0);
				// 三条快照在请求体里的相对顺序与注册顺序一致（runtime → hidden → run-time）。
				expect(hiddenAtFirst).toBeLessThan(runTimeAtFirst);

				const runtimeAtSecond = indexOfText(second, RUNTIME_BLOCK);
				const hiddenAtSecond = indexOfText(second, HIDDEN_A);
				const runTimeAtSecond = indexOfText(second, RUN_TIME_A);
				expect(runtimeAtSecond, "第 2 次调用没看到 runtime-context 快照").toBeGreaterThan(0);
				expect(hiddenAtSecond, "第 2 次调用没看到 hidden-context 快照").toBeGreaterThan(0);
				expect(runTimeAtSecond, "第 2 次调用没看到 run-time 快照").toBeGreaterThan(0);
				// 位置在相邻两次调用之间**逐位不变** —— 它不是「每轮新加在末尾的尾巴」，
				// 而是历史的一员（缓存前缀不变量的直接含义）。
				expect(runtimeAtSecond).toBe(runtimeAtFirst);
				expect(hiddenAtSecond).toBe(hiddenAtFirst);
				expect(runTimeAtSecond).toBe(runTimeAtFirst);
				// 后面还有本轮的工具调用与工具结果 ⇒ 它不是尾巴。
				expect(hiddenAtSecond).toBeLessThan(second.length - 1);
			} finally {
				session.dispose();
			}
		},
		60_000,
	);

	it(
		"5.2 跨 run：内容没变不追加；内容变了追加一条且既有那条逐字节/位置不变；再次相同（与末条相同、与首条不同）仍不追加",
		async () => {
			endpoint.setReply(() => sseText("收到。"));
			const inputs: SnapshotInputs = {
				runtimeContext: RUNTIME_BLOCK,
				hiddenContext: HIDDEN_A,
				runTime: RUN_TIME_A,
			};
			const manager = SessionManager.create(cwd, sessionsDir);
			const session = await openSession({ cwd, agentDir, catalog, sessionManager: manager, inputs });
			try {
				await session.prompt("第一轮");
				const file = sessionFileOf(manager);
				const after1 = snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE);
				expect(after1).toHaveLength(1);
				expect(after1[0]?.content).toBe(HIDDEN_A);

				// run 2：三条通道内容都逐字节相同 ⇒ 都不追加。
				await session.prompt("第二轮");
				expect(snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE)).toHaveLength(1);
				expect(snapshotLines(file, RUNTIME_CONTEXT_CUSTOM_TYPE)).toHaveLength(1);
				expect(snapshotLines(file, RUN_TIME_CUSTOM_TYPE)).toHaveLength(1);

				// run 3：hidden 变了 ⇒ 追加一条；既有那条的**原始 JSON 行与行号**逐字节不变。
				inputs.hiddenContext = HIDDEN_B;
				await session.prompt("第三轮");
				const after3 = snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE);
				expect(after3).toHaveLength(2);
				expect(after3[0], "追加不许动既有那条（append-only）").toEqual(after1[0]);
				expect(after3[1]?.content).toBe(HIDDEN_B);
				// runtime 与 run-time 通道都没变 ⇒ 各自仍只有一条（三条通道各自独立去重）。
				expect(snapshotLines(file, RUNTIME_CONTEXT_CUSTOM_TYPE)).toHaveLength(1);
				expect(snapshotLines(file, RUN_TIME_CUSTOM_TYPE)).toHaveLength(1);

				/*
				 * run 4：内容与**最后一条**相同、与第一条不同 ⇒ 仍不追加。
				 *
				 * 这一条专门钉「基线必须从后往前取末条」：读错成「从前往后取首条」的实现
				 * 会把 B 与首条 A 比出差异、多追一条 —— 这正是 Task 5.4 第三组要变红的形态。
				 */
				await session.prompt("第四轮");
				const after4 = snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE);
				expect(after4.map((line) => line.raw)).toEqual(after3.map((line) => line.raw));
			} finally {
				session.dispose();
			}
		},
		60_000,
	);

	it(
		"5.3 resume：会话文件已含快照条目，重建会话（SessionManager.open）后同内容不重复追加",
		async () => {
			endpoint.setReply(() => sseText("好。"));
			const inputs: SnapshotInputs = {
				runtimeContext: RUNTIME_BLOCK,
				hiddenContext: HIDDEN_A,
				runTime: RUN_TIME_A,
			};
			const manager = SessionManager.create(cwd, sessionsDir);
			const first = await openSession({ cwd, agentDir, catalog, sessionManager: manager, inputs });
			let file: string;
			try {
				await first.prompt("第一轮");
				file = sessionFileOf(manager);
				expect(snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE)).toHaveLength(1);
			} finally {
				first.dispose();
			}

			// 重建宿主（新 SessionManager 实例、同一个文件）—— resume 的真实形态。
			const reopened = SessionManager.open(file, sessionsDir);
			// 去重基线的口径先证一遍：它读的是 buildContextEntries()（compaction-aware），
			// 这条基线在 resume 后必须仍然读得到，否则「不重复追加」是假绿。
			const baseline = reopened
				.buildContextEntries()
				.filter(
					(entry) => entry.type === "custom_message" && entry.customType === HIDDEN_CONTEXT_CUSTOM_TYPE,
				);
			expect(baseline).toHaveLength(1);
			expect(baseline[0]?.type === "custom_message" ? baseline[0].content : undefined).toBe(HIDDEN_A);

			const resumed = await openSession({ cwd, agentDir, catalog, sessionManager: reopened, inputs });
			try {
				await resumed.prompt("resume 后的第一轮");
				expect(snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE)).toHaveLength(1);
				expect(snapshotLines(file, RUNTIME_CONTEXT_CUSTOM_TYPE)).toHaveLength(1);
				expect(snapshotLines(file, RUN_TIME_CUSTOM_TYPE)).toHaveLength(1);
			} finally {
				resumed.dispose();
			}
		},
		60_000,
	);
});

/* ── Task 6：上下文压缩的可见面（spec: persist-context-snapshots MODIFIED）──
 *
 * 这个夹具在钉什么、为什么它必须有牙齿：
 *
 * 5.1–5.3 三例的会话**从不压缩**，于是 `buildContextEntries()`、`getBranch()`、
 * `getEntries()` 三条读法返回的是同一份条目 —— 把 `prompt-switch.ts` 的去重基线
 * 从 `buildContextEntries()` 换成 `getBranch()` 或 `getEntries()`，那三例**全都不会
 * 变红**。也就是说「基线必须取自 compaction-aware 的活分支」这条判断此前**没有任何
 * 断言在守**（独立验证者实测：三条读法在本套件里不分叉）。
 *
 * 而这两条路在真实会话里会分叉：`getBranch()` / `getEntries()` 会连**被压缩遮蔽**的
 * 旧快照一起返回 ⇒ 拿它当基线 ⇒ 内容没变 ⇒ **漏追加** ⇒ 模型这一轮丢环境事实。
 * 所以本夹具必须真的让会话发生一次压缩，再发一个 run。
 *
 * 压缩走的是**真实链路**：`AgentSession.compact()`（pi 的手动压缩入口，= TUI 的 /compact）
 * → `prepareCompaction()` 算切点 → 默认摘要生成器 → `sessionManager.appendCompaction()`。
 * 唯一打桩处仍是本文件的假模型端点：摘要那一次 LLM 调用打到这里，喂一段固定文本
 * （不开真实网络）。切点由真实设置读取入口控制 —— `SettingsManager` 读
 * `<agentDir>/settings.json` 的 `compaction.keepRecentTokens`，不 mock settingsManager。
 */
describe("上下文压缩的可见面：被遮蔽的快照会被重新追加（真实 pi compact）", () => {
	it(
		"6.1 compact 遮蔽旧快照后，下一个 run 按需重新追加；旧条目逐字节不变、新条目落在压缩之后的活分支",
		async () => {
			/*
			 * keepRecentTokens 调小 ⇒ 切点落到会话尾部 ⇒ run 1 落的那条快照
			 * （它后面还有两轮对话）落在 firstKeptEntryId **之前** ⇒ 被摘要遮蔽。
			 * 走真实设置文件（不是 mock），顺带证明 `getCompactionSettings()` 这条
			 * 读法在本环境可用。
			 */
			writeFileSync(
				join(agentDir, "settings.json"),
				JSON.stringify({ compaction: { keepRecentTokens: 1 } }, null, 2),
				"utf8",
			);

			endpoint.setReply((index) => {
				// 压缩摘要的 LLM 调用也打到本桩（唯一打桩处是模型端点这件事不变）：
				// 认 pi 的 SUMMARIZATION_SYSTEM_PROMPT 作为标记，喂一段固定摘要。
				const serialized = JSON.stringify(endpoint.requests[index] ?? {});
				if (serialized.includes("context summarization assistant")) {
					return sseText("## Goal\n（桩摘要：本夹具不读它的内容，只要压缩真的落一条条目）");
				}
				return sseText("收到。");
			});

			const inputs: SnapshotInputs = {
				runtimeContext: RUNTIME_BLOCK,
				hiddenContext: HIDDEN_A,
				runTime: RUN_TIME_A,
			};
			const manager = SessionManager.create(cwd, sessionsDir);
			const session = await openSession({ cwd, agentDir, catalog, sessionManager: manager, inputs });
			try {
				await session.prompt("第一轮");
				await session.prompt("第二轮");
				await session.prompt("第三轮");

				const file = sessionFileOf(manager);
				const oldRuntime = snapshotLines(file, RUNTIME_CONTEXT_CUSTOM_TYPE);
				const oldHidden = snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE);
				const oldRunTime = snapshotLines(file, RUN_TIME_CUSTOM_TYPE);
				// 压缩之前三条通道各恰好 1 条（内容没变就不追加 —— 5.2 已钉）。
				expect(oldRuntime).toHaveLength(1);
				expect(oldHidden).toHaveLength(1);
				expect(oldRunTime).toHaveLength(1);

				// 压缩前记下三条通道的条数与请求数：下面要与压缩之后对照。
				const countsBeforeCompact = [
					oldRuntime.length,
					oldHidden.length,
					oldRunTime.length,
				];
				const requestsBeforeCompact = endpoint.requests.length;
				await session.compact();

				/* ── 压缩路径**不注入**快照（本次补的覆盖缺口）────────────────────────
				 * 此前「compact 不经 before_agent_start ⇒ 压缩期间不会注入时间块」只有静态
				 * 推理，这里把它升级成有牙齿的断言。pi 侧机制（可核）：
				 *   - `emitBeforeAgentStart` 只出现在 `session.prompt()` 内
				 *     （agent-session.js:915，grep -c = 1）；
				 *   - `compact()` → `_runDefaultCompaction` → 低层 `compact()` 自己
				 *     `convertToLlm` 后直接调 `streamFn`（compaction.js:609），既不 emit
				 *     before_agent_start，也不经 agent-loop 的 transformContext。
				 * 于是「压缩期间没有快照注入」是**结构性**保证；下面的断言把它钉在可观察
				 * 产物上（请求体 + 会话文件行），将来若有注入点挂到压缩路径上立刻变红。
				 *
				 * 口径（别读错）：压缩请求里**可以**出现时间快照 —— 那是**历史里被摘要的
				 * 那一条**（run 1 落的），不是压缩现场注入的。所以判据是「不超过压缩前最后
				 * 一次 run 请求里的条数」，而不是「一次都没有」。
				 */
				const timeBlocksIn = (body: Record<string, unknown> | undefined): number =>
					requestMessages(body)
						.map((message) => messageText(message))
						.join("\n")
						.split("<current_time>").length - 1;
				const requestsDuringCompact = endpoint.requests.slice(requestsBeforeCompact);
				expect(
					requestsDuringCompact.length,
					"夹具坏了：compact() 没产生模型请求（下面两条断言会空转通过）",
				).toBeGreaterThan(0);
				const blocksInLastRun = timeBlocksIn(endpoint.requests[requestsBeforeCompact - 1]);
				expect(
					blocksInLastRun,
					"夹具坏了：压缩前那次 run 请求里应当有且只有 1 条时间快照",
				).toBe(1);

				// ① 请求体：压缩期间的每个请求都没有多出「压缩现场注入」的时间块。
				requestsDuringCompact.forEach((body, index) => {
					expect(
						timeBlocksIn(body),
						`压缩期间第 ${index + 1} 个模型请求里多出了注入的时间块（压缩路径不该注入）`,
					).toBeLessThanOrEqual(blocksInLastRun);
				});
				// ② 会话文件：压缩本身不追加任何快照条目（三条通道条数不变），且它写下的最后
				//    一条就是那条 compaction —— 注入若挂在压缩路径上会落在它之后。
				expect(
					snapshotLines(file, RUNTIME_CONTEXT_CUSTOM_TYPE).length,
					"压缩本身追加了快照条目（runtime）",
				).toBe(countsBeforeCompact[0]);
				expect(
					snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE).length,
					"压缩本身追加了快照条目（hidden）",
				).toBe(countsBeforeCompact[1]);
				expect(
					snapshotLines(file, RUN_TIME_CUSTOM_TYPE).length,
					"压缩本身追加了 run-time 条目（该次压缩没有 run 期的注入读口）",
				).toBe(countsBeforeCompact[2]);
				expect(
					lineKinds(file).at(-1),
					"压缩后文件末行不是 compaction ⇒ 有东西在压缩路径上追加了条目",
				).toBe("compaction");

				/* ── 夹具前提守卫：压缩**真的**遮蔽了旧快照，且两条读法**真的**分叉 ──
				 * 少了这两条，下面的「重新追加」要么恒绿（没遮蔽）要么与实现选择无关。 */
				const activeHidden = manager
					.buildContextEntries()
					.filter(
						(entry) =>
							entry.type === "custom_message" && entry.customType === HIDDEN_CONTEXT_CUSTOM_TYPE,
					);
				expect(activeHidden, "压缩没遮蔽旧快照 ⇒ 本夹具钉不住任何东西").toHaveLength(0);
				const branchHidden = manager
					.getBranch()
					.filter(
						(entry) =>
							entry.type === "custom_message" && entry.customType === HIDDEN_CONTEXT_CUSTOM_TYPE,
					);
				expect(
					branchHidden.length,
					"getBranch() 也看不到旧快照 ⇒ 两条读法没分叉，夹具失效（压缩没切到快照之前）",
				).toBeGreaterThanOrEqual(1);
				expect(
					manager.getEntries().some((entry) => entry.type === "compaction"),
					"会话里没有 compaction 条目 ⇒ 压缩没真发生",
				).toBe(true);

				// 压缩之后的 run：快照在活分支上不见了 ⇒ 唯一让它重新可读的路是再追加一条。
				await session.prompt("压缩后第一轮");

				const afterRuntime = snapshotLines(file, RUNTIME_CONTEXT_CUSTOM_TYPE);
				const afterHidden = snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE);
				const afterRunTime = snapshotLines(file, RUN_TIME_CUSTOM_TYPE);
				expect(
					afterHidden,
					"被压缩遮蔽的快照没有重新追加 ⇒ 模型这一轮丢了环境事实（基线取错成 getBranch/getEntries）",
				).toHaveLength(2);
				expect(afterRuntime, "被压缩遮蔽的 runtime 快照没有重新追加").toHaveLength(2);
				expect(afterRunTime, "被压缩遮蔽的时间快照没有重新追加").toHaveLength(2);

				// ① 追加的那条正文逐字节等于渲染结果。
				expect(afterHidden[1]?.content).toBe(HIDDEN_A);
				expect(afterRuntime[1]?.content).toBe(RUNTIME_BLOCK);
				expect(afterRunTime[1]?.content).toBe(RUN_TIME_A);
				expect(afterHidden[1]?.display).toBe(false);

				// ② 被遮蔽的旧条目没有被改写（append-only）：原始 JSON 行与行号逐字节不变。
				expect(afterHidden[0]).toEqual(oldHidden[0]);
				expect(afterRuntime[0]).toEqual(oldRuntime[0]);
				expect(afterRunTime[0]).toEqual(oldRunTime[0]);

				// ③ 新条目落在**压缩之后的活分支**上：文件行序为
				//    … compaction → user → runtime → hidden → run-time → assistant
				const kinds = lineKinds(file);
				const compactionAt = kinds.lastIndexOf("compaction");
				expect(compactionAt, `实际顺序：${kinds.join(" → ")}`).toBeGreaterThan(-1);
				expect(kinds.slice(compactionAt, compactionAt + 6), `实际顺序：${kinds.join(" → ")}`).toEqual([
					"compaction",
					"message:user",
					`custom_message:${RUNTIME_CONTEXT_CUSTOM_TYPE}`,
					`custom_message:${HIDDEN_CONTEXT_CUSTOM_TYPE}`,
					`custom_message:${RUN_TIME_CUSTOM_TYPE}`,
					"message:assistant",
				]);
			} finally {
				session.dispose();
			}
		},
		60_000,
	);
});

/* ── 时间通道拆分 + 取代声明（spec: add-supersede-note-and-time-split）──────
 *
 * 本组钉的四件事，全部落在**会话文件的原始行**或**模型端点收到的请求体**上：
 *   7.1 环境块逐字节未变、仅 `current_time` 跨分钟 ⇒ 只追加一条 run-time；
 *       环境块那一条的原始 JSON 行与行号必须逐字节不变（append-only）。
 *   7.2 环境事实变了（工作目录）、时间未跨分钟 ⇒ 只追加一条环境块。
 *   7.3 三条通道各按自己的 customType 读基线，互不触发。
 *   7.4 每条快照正文都以取代声明开头（容器内第一行 / 正文第一行）。
 *
 * **输入由生产纯函数拼**（`productionInputs` → `composeHiddenBlock` /
 * `formatRunTime` / `formatRuntimeContext`，与 SessionHost.composeRunHiddenContext
 * 同一份 section 名单）：输入若是手写字符串，「时间被拼回环境块」这种形态回退就
 * 只改生产代码、本文件照绿 —— 那正是 AGENTS.md §8「护栏先会红」要堵的洞。
 */
describe("时间通道拆分与取代声明（真实 pi 会话 + 真实 createPromptSwitch）", () => {
	/** 一次 run 用的固定时刻（分钟粒度）：11:01 → 11:02 恰好跨一个分钟边界。 */
	const AT_11_01 = new Date(2026, 8, 18, 11, 1);
	const AT_11_02 = new Date(2026, 8, 18, 11, 2);

	/** 断言某条快照正文以取代声明开头（容器块：声明在开标签之后的**第一行**）。 */
	function expectNoteFirstLine(content: string, opener: string): void {
		const head = `${opener}\n${SNAPSHOT_SUPERSEDE_NOTE}\n`;
		expect(
			content.startsWith(head),
			`快照正文没有以取代声明开头（期望开头 ${JSON.stringify(head)}，实际 ${JSON.stringify(content.slice(0, 120))}）`,
		).toBe(true);
	}

	it(
		"7.1 仅 current_time 跨分钟：只追加一条 run-time；环境块不追加且旧行逐字节不变",
		async () => {
			endpoint.setReply(() => sseText("收到。"));
			const inputs = productionInputs({
				cwd: "C:\\proj",
				at: AT_11_01,
				memory: RUNTIME_BLOCK,
			});
			const manager = SessionManager.create(cwd, sessionsDir);
			const session = await openSession({ cwd, agentDir, catalog, sessionManager: manager, inputs });
			try {
				await session.prompt("第一轮");
				const file = sessionFileOf(manager);
				const envAfter1 = snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE);
				const timeAfter1 = snapshotLines(file, RUN_TIME_CUSTOM_TYPE);
				expect(envAfter1).toHaveLength(1);
				expect(timeAfter1).toHaveLength(1);
				expect(envAfter1[0]?.content).toContain("工作目录：C:\\proj");
				expect(timeAfter1[0]?.content).toContain("<current_time>");
				expect(timeAfter1[0]?.content).toContain(formatRunTime(AT_11_01));

				// run 2：环境事实逐字节未变，只是墙钟跨了分钟。两份正文都按生产的方式
				// **重新渲染一次**（session-host 每个 run 都从同一份 section 名单重算）——
				// 若时间被拼回了环境块，这里渲染出的环境块就会跟着分钟一起变，
				// 下面那条计数断言立刻红。
				const next = productionInputs({
					cwd: "C:\\proj",
					at: AT_11_02,
					memory: RUNTIME_BLOCK,
				});
				const nextRunTime = next.runTime;
				expect(nextRunTime, "夹具坏了：时间块渲染不出").toBeDefined();
				expect(nextRunTime).not.toBe(inputs.runTime);
				inputs.runTime = nextRunTime;
				inputs.hiddenContext = next.hiddenContext;
				await session.prompt("第二轮");

				const envAfter2 = snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE);
				expect(
					envAfter2,
					"环境块没变却追加了 ⇒ 时间被拼回了环境块（这正是本组要拦的回退）",
				).toHaveLength(1);
				// 既有那条的**原始 JSON 行与行号**逐字节不变（append-only）。
				expect(envAfter2.map((line) => line.raw)).toEqual(envAfter1.map((line) => line.raw));
				expect(envAfter2[0]).toEqual(envAfter1[0]);

				const timeAfter2 = snapshotLines(file, RUN_TIME_CUSTOM_TYPE);
				expect(timeAfter2, "时间跨分钟却没追加").toHaveLength(2);
				expect(timeAfter2[0], "追加不许动既有那条（append-only）").toEqual(timeAfter1[0]);
				expect(timeAfter2[1]?.content).toBe(nextRunTime);
				expect(timeAfter2[1]?.content).toContain(formatRunTime(AT_11_02));
				expect(timeAfter2[1]?.display).toBe(false);
				// runtime 通道与本例无关，两次 run 都一样 ⇒ 始终 1 条。
				expect(snapshotLines(file, RUNTIME_CONTEXT_CUSTOM_TYPE)).toHaveLength(1);

				// 夹具守卫（放在行为断言之后）：这一轮渲染出的环境块必须与上一轮逐字节相同
				// ——「环境事实没变」是上面结论的前提。放最后，本组自证时先红的才是
				// 「只追加时间那一条」。
				expect(next.hiddenContext, "夹具坏了：环境块两次渲染不一致").toBe(envAfter1[0]?.content);
				// 形状：时间只在时间块里 —— 环境块的正文里没有 `<current_time>`。
				expect(envAfter2[0]?.content, "环境块里还带着时间").not.toContain("<current_time>");
			} finally {
				session.dispose();
			}
		},
		60_000,
	);

	it(
		"7.2 环境事实变了（工作目录）、时间未跨分钟：只追加一条环境块；时间块不追加",
		async () => {
			endpoint.setReply(() => sseText("收到。"));
			const inputs = productionInputs({ cwd: "C:\\proj", at: AT_11_01, memory: RUNTIME_BLOCK });
			const manager = SessionManager.create(cwd, sessionsDir);
			const session = await openSession({ cwd, agentDir, catalog, sessionManager: manager, inputs });
			try {
				await session.prompt("第一轮");
				const file = sessionFileOf(manager);
				const envAfter1 = snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE);
				const timeAfter1 = snapshotLines(file, RUN_TIME_CUSTOM_TYPE);
				expect(envAfter1).toHaveLength(1);
				expect(timeAfter1).toHaveLength(1);

				// run 2：工作目录变了（环境事实），同一分钟（时间块逐字节相同）。
				const next = productionInputs({
					cwd: "C:\\proj\\sub",
					at: AT_11_01,
					memory: RUNTIME_BLOCK,
				});
				expect(next.runTime, "夹具坏了：同一分钟的时间块应当逐字节相同").toBe(inputs.runTime);
				const nextHidden = next.hiddenContext;
				expect(nextHidden, "夹具坏了：环境块渲染不出").toBeDefined();
				expect(nextHidden).not.toBe(inputs.hiddenContext);
				inputs.hiddenContext = nextHidden;
				await session.prompt("第二轮");

				const envAfter2 = snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE);
				expect(envAfter2, "环境事实变了却没追加").toHaveLength(2);
				expect(envAfter2[0], "追加不许动既有那条（append-only）").toEqual(envAfter1[0]);
				expect(envAfter2[1]?.content).toBe(nextHidden);
				expect(envAfter2[1]?.content).toContain("工作目录：C:\\proj\\sub");
				// 时间块没变 ⇒ 不追加（旧那条的原始行不变）。
				expect(snapshotLines(file, RUN_TIME_CUSTOM_TYPE).map((line) => line.raw)).toEqual(
					timeAfter1.map((line) => line.raw),
				);
			} finally {
				session.dispose();
			}
		},
		60_000,
	);

	it(
		"7.3 三条通道互不触发：三条 run 分别只让一条通道变化（各自按自己的 customType 读基线）",
		async () => {
			endpoint.setReply(() => sseText("收到。"));
			const inputs = productionInputs({ cwd: "C:\\proj", at: AT_11_01, memory: RUNTIME_BLOCK });
			const manager = SessionManager.create(cwd, sessionsDir);
			const session = await openSession({ cwd, agentDir, catalog, sessionManager: manager, inputs });
			try {
				const counts = (file: string): readonly number[] => [
					snapshotLines(file, RUNTIME_CONTEXT_CUSTOM_TYPE).length,
					snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE).length,
					snapshotLines(file, RUN_TIME_CUSTOM_TYPE).length,
				];

				await session.prompt("第一轮");
				const file = sessionFileOf(manager);
				expect(counts(file), "三条通道首次 run 各落一条").toEqual([1, 1, 1]);

				// run 2：只有画像变（记忆内容改了）。环境事实与时间逐字节相同。
				const run2 = productionInputs({
					cwd: "C:\\proj",
					at: AT_11_01,
					memory: `${RUNTIME_BLOCK}\n\n（本轮新增一条记忆）`,
				});
				expect(run2.hiddenContext, "夹具坏了：run 2 不该动环境块").toBe(inputs.hiddenContext);
				expect(run2.runTime, "夹具坏了：run 2 不该动时间块").toBe(inputs.runTime);
				expect(run2.runtimeContext).not.toBe(inputs.runtimeContext);
				inputs.runtimeContext = run2.runtimeContext;
				await session.prompt("第二轮");
				expect(counts(file), "只有画像变 ⇒ 只追加 runtime 那一条").toEqual([2, 1, 1]);

				// run 3：只有环境事实变（工作目录）。画像保持 run 2 那份，时间逐字节相同。
				inputs.hiddenContext = composeHiddenBlock(
					hiddenSections("C:\\proj\\sub", AT_11_01),
					"user-context",
				);
				await session.prompt("第三轮");
				expect(counts(file), "只有环境事实变 ⇒ 只追加 hidden 那一条").toEqual([2, 2, 1]);
			} finally {
				session.dispose();
			}
		},
		60_000,
	);

	it(
		"7.4 每一条快照正文都以取代声明开头（会话文件原始行 + 模型端点收到的请求体）",
		async () => {
			endpoint.setReply(() => sseText("收到。"));
			const inputs = productionInputs({ cwd: "C:\\proj", at: AT_11_01, memory: RUNTIME_BLOCK });
			const manager = SessionManager.create(cwd, sessionsDir);
			const session = await openSession({ cwd, agentDir, catalog, sessionManager: manager, inputs });
			try {
				await session.prompt("第一轮");
				const file = sessionFileOf(manager);

				// ① 会话文件：三条通道的正文都以声明开头（容器块的声明在开标签之后第一行）。
				const env = snapshotLines(file, HIDDEN_CONTEXT_CUSTOM_TYPE);
				const time = snapshotLines(file, RUN_TIME_CUSTOM_TYPE);
				const runtime = snapshotLines(file, RUNTIME_CONTEXT_CUSTOM_TYPE);
				expect(env).toHaveLength(1);
				expect(time).toHaveLength(1);
				expect(runtime).toHaveLength(1);
				expectNoteFirstLine(env[0]?.content ?? "", `${HIDDEN_CONTEXT_MARKER}user-context">`);
				expectNoteFirstLine(time[0]?.content ?? "", `${HIDDEN_CONTEXT_MARKER}additional-data">`);
				// 画像/个性化没有 XML 容器：声明就是正文第一行（不是「包含」，是开头）。
				expect(runtime[0]?.content.startsWith(`${SNAPSHOT_SUPERSEDE_NOTE}\n\n`)).toBe(true);
				expect(runtime[0]?.content).toContain(RUNTIME_BLOCK);

				// ② 模型真收到了它（请求体里逐字可查）——「落进会话文件」不等于「模型看见了」。
				const last = endpoint.requests.at(-1);
				const visible = requestMessages(last)
					.map((message) => messageText(message))
					.join("\n");
				expect(visible).toContain(SNAPSHOT_SUPERSEDE_NOTE);
				expect(visible).toContain(env[0]?.content ?? "（夹具坏了：环境块是空的）");
			} finally {
				session.dispose();
			}
		},
		60_000,
	);
});
