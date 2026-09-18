/**
 * 冒烟：会话分支（「重新开始」/「分支出新会话」）在 daemon 里的两条流程
 *（spec: .trae/specs/add-session-branching Task 5）。
 *
 * 为什么必须在这层冒烟：Task 1 的探针只验了 pi 的语义，Task 2/3 只验了纯函数与文件层。
 * 真正会丢数据的是**接线顺序**——「先写分支文件、再截断母文件」「写入前必须已 dispose
 * 宿主」「history_reset 之后要同步填回重建结果」，这三条都不是类型能守住的。
 *
 * 手法：本脚本把**自己**伪装成 Electron utilityProcess —— daemon 在 import 时就要
 * `process.parentPort`（拿不到直接抛错），所以先塞一个假端口：postMessage 收帧，
 * on 拿到的监听器用来把 DaemonRequest 喂进去。等于在进程内跑一个真 daemon，
 * 全程走真实 IPC 通道（不联网：假服务商指向 127.0.0.1:9 或本脚本起的「永不应答」
 * HTTP 服务，只在验证 running 拒绝时发一次 prompt，不产生任何模型调用成功）。
 *
 * 用法：npx tsx scripts/smoke-session-branch.ts
 *
 * ── 实测结论（2026-09-17，Windows，全部断言通过）──────────────────────
 *
 * 1. 「重新开始」（母会话就地回退 + 抽枝）
 *    a. 母文件被物理截断为「header + root→分叉点父条目」：条目 id 逐条等于前缀，
 *       且**没有多出的宿主机条目**（thinking_level_change 在分叉点之前，重开时
 *       pi 的 hasThinkingEntry 为真 → 不再追加）。
 *    b. 截断后 `SessionManager.open` 可正常读，`getLeafId()` = 前缀末条。
 *    c. 分支文件存在、header.parentSession = 母文件绝对路径、含 session_info 标题
 *       「<母标题> · 分支」；master 的后续条目（u2/a2）在分支里，母文件里没有。
 *    d. 桶的 scene/mode/expert 未随重建漂移，sessionId 未变，entries 只剩前缀。
 *    e. 重建后的宿主仍**绑定在母文件上**（改名写进母文件、不写进分支文件）——
 *       这条同时守住「抽枝不能劫持活宿主的管理器」：pi 的 createBranchedSession 会
 *       把管理器自身的 sessionFile 换成新文件，若在活宿主的管理器上调用，
 *       母会话的后续落盘会全部写进分支文件。
 *    f. 「分叉点之后没有内容」时返回 ok 且**不带** branchPath（不产生噪声会话）。
 *
 * 2. 「分支出新会话」
 *    a. 母文件字节**完全不变**（抽枝是另写一个新文件）。
 *    b. 新桶的两轴/专家/记忆与母桶一致（显式拷贝，不靠「沿用当前会话」），
 *       cwd 与母会话相同（不分配新目录），当前桶已切到新会话。
 *    c. 新会话历史 = 分叉点之前的前缀；分叉点是首条用户消息时为新会话文件
 *       （只有 header + session_info）且历史为空、来源标记正确。
 *
 * 3. 拒绝路径（都返回对应 reason 且不留任何写入痕迹）
 *    - running → busy（链外先判，不排队干等）：sessions 目录不新增任何文件
 *      （会话文件本身可能被 run 写入，那不是分支操作干的，故按文件数判定）；
 *    - 序号越界 → no-such-entry：母文件字节不变、目录不新增文件；
 *    - 路径无会话文件 → no-file（restart / branch 都是）。
 *
 * ── 踩坑（写在这里备查）───────────────────────────────────────────────
 *
 * - `session:prompt` 的响应**不能等**：假服务商永不应答时（pi 的请求 300s 才超时、
 *   还会自动重试），这条 IPC 的响应在 run 结束前不会回来。所以验证 running 拒绝时改成
 *   fire-and-forget + 轮询 `session:list` 的 running 标志 —— 断言对象是「会话是否在
 *   流式中」，不是那条 IPC 的返回时机。C5 用例从反面兜住：中断收尾后同一通道不再 busy。
 * - 夹具会话的根上要预置一条 `thinking_level_change`：pi 构造 AgentSession 时，会话里
 *   没有该条目就会**补一条**（dist/core/sdk.js 的 hasThinkingEntry 分支），
 *   会让「母文件行数 = 前缀」的断言随无关因素漂。预置后 resume 与回退重建都不再追加。
 * - 分支文件里的条目比母会话多一条 `session_info`（标题），断言前缀时要按前 N 条比。
 * - 抽枝用**一次性 manager**（core/session-file.ts 的 createBranchedSessionFile）：
 *   在活宿主的管理器上直接调 pi 的 createBranchedSession 会把管理器的 sessionFile
 *   换成分支文件，母会话后续落盘会全部写进分支文件（脚本的 D1 用例专门守这条）。
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { SessionMessageEntry } from "@earendil-works/pi-coding-agent";

export {};

// 必须在导入我们的模块之前设好：配置/工作空间路径由 env 决定（同 smoke-session.ts）。
const workDir = mkdtempSync(join(tmpdir(), "kami-smoke-branch-"));
process.env["KAMIBUDDY_CONFIG_DIR"] = join(workDir, "config");
process.env["KAMIBUDDY_WORKSPACE_DIR"] = join(workDir, "workspace");

const { SessionManager } = await import("@earendil-works/pi-coding-agent");
const { ModelCatalog } = await import("../src/core/model-catalog.ts");
const { getConfigDir, getSessionsDir, getWorkspaceDir } = await import("../src/core/config-paths.ts");
const { INVOKE } = await import("../src/shared/ipc.ts");
type SessionSummary = import("../src/shared/ipc.ts").SessionSummary;
type SessionBranchResult = import("../src/shared/ipc.ts").SessionBranchResult;
type SessionSnapshot = import("../src/shared/session-events.ts").SessionSnapshot;

const results: { readonly name: string; readonly ok: boolean; readonly detail: string }[] = [];
function check(name: string, ok: boolean, detail: string): void {
	results.push({ name, ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

/* ── 假 daemon 端口（把本进程变成 daemon 的宿主）────────────────────── */

interface Frame {
	readonly kind: string;
	readonly [key: string]: unknown;
}

const outbound: Frame[] = [];
let feed: ((message: { data: unknown }) => void) | undefined;
const waiters = new Map<string, (frame: Frame) => void>();

(process as unknown as { parentPort: unknown }).parentPort = {
	postMessage: (raw: unknown) => {
		const frame = raw as Frame;
		const id = frame["id"];
		if (frame.kind === "response" && typeof id === "string") {
			const waiter = waiters.get(id);
			if (waiter !== undefined) {
				waiters.delete(id);
				waiter(frame);
				return;
			}
		}
		outbound.push(frame);
	},
	on: (_event: "message", listener: (message: { data: unknown }) => void) => {
		feed = listener;
	},
};

let requestSeq = 0;
async function invoke<T>(channel: string, args: readonly unknown[]): Promise<T> {
	if (feed === undefined) throw new Error("daemon 没拿到消息端口（parentPort.on 未被调用）");
	const id = `smoke-${++requestSeq}`;
	const settled = new Promise<Frame>((resolveFrame) => {
		waiters.set(id, resolveFrame);
	});
	feed({ data: { kind: "request", id, channel, args } });
	const frame = await settled;
	if (frame["ok"] !== true) throw new Error(`${channel} 失败：${String(frame["error"])}`);
	return frame["value"] as T;
}

async function waitUntil(
	predicate: () => Promise<boolean>,
	timeoutMs: number,
	label: string,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await predicate()) return;
		await new Promise((done) => setTimeout(done, 50));
	}
	throw new Error(`等待超时：${label}`);
}

/* ── 假服务商 ────────────────────────────────────────────────────────── */

const PROVIDER = "smoke-branch";
const MODEL_KEY = `${PROVIDER}/probe-model`;

// 「永不应答」的 HTTP 服务：只用于验证 running 拒绝（发一次 prompt 让会话进入
// 流式），不需要模型真的回话 —— 它答应了连接就再也不写响应，pi 的 run 便停在
// 请求上，直到我们 abort。放在 127.0.0.1，不联网。
const hangServer = createServer(() => {
	/* 刻意不应答：run 保持流式，直到 abort */
});
await new Promise<void>((done) => hangServer.listen(0, "127.0.0.1", done));
const hangPort = (hangServer.address() as { port: number }).port;

const catalog = await ModelCatalog.create();
await catalog.saveCustomProvider(
	{
		id: PROVIDER,
		name: "分支冒烟探针",
		baseUrl: `http://127.0.0.1:${hangPort}/v1`,
		api: "openai-completions",
		models: [
			{
				id: "probe-model",
				name: "探针模型",
				contextWindow: 128000,
				maxTokens: 8192,
				reasoning: false,
				vision: false,
			},
		],
	},
	"sk-smoke-not-a-real-key",
);
check("自定义服务商可用（含凭据）", catalog.isUsable(MODEL_KEY), `isUsable(${MODEL_KEY}) = ${catalog.isUsable(MODEL_KEY)}`);

/* ── 造会话文件（u1 → a1 → u2 → a2，根上带一条 thinking_level_change）── */

const sessionsDir = getSessionsDir();
const cwd = join(getWorkspaceDir(), "space");
mkdirSync(sessionsDir, { recursive: true });
mkdirSync(join(getConfigDir(), "logs"), { recursive: true });
mkdirSync(cwd, { recursive: true });

type PiMessage = SessionMessageEntry["message"];
type PiUserMessage = Extract<PiMessage, { role: "user" }>;
type PiAssistantMessage = Extract<PiMessage, { role: "assistant" }>;

function userMsg(text: string, at: number): PiUserMessage {
	return { role: "user", content: text, timestamp: at };
}

function assistantMsg(text: string, at: number): PiAssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-completions",
		provider: PROVIDER,
		model: "probe-model",
		usage: {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: at,
	};
}

/**
 * 造一条线性会话文件：thinking_level_change(t0) → u1 → a1 → u2 →（可选 a2）。
 *
 * 为什么根上先放一条 thinking_level_change：pi 构造 AgentSession 时，若会话里
 * **没有** thinking_level_change 条目就会补一条（dist/core/sdk.js 的 hasThinkingEntry
 * 分支）—— 那会让「母文件行数 = 前缀」的断言随无关因素漂。预置一条，resume 与
 * 回退后重建都不会再追加，文件内容因此完全确定。
 *
 * withSecondReply=false 时最后一条是用户消息（u2 没有任何后代）—— 「分叉点之后
 * 没有内容」的形态（该消息自己会回到输入框，不产生分支会话）。
 */
function buildSession(
	tag: string,
	withSecondReply = true,
): {
	readonly file: string;
	readonly t0: string;
	readonly u1: string;
	readonly a1: string;
	readonly u2: string;
	readonly a2: string | undefined;
} {
	const manager = SessionManager.create(cwd, sessionsDir);
	const t0 = manager.appendThinkingLevelChange("medium");
	const base = Date.UTC(2026, 0, 1, 0, 0, 0);
	const u1 = manager.appendMessage(userMsg(`${tag} 第一轮问题`, base));
	const a1 = manager.appendMessage(assistantMsg(`${tag} 第一轮回答`, base + 1000));
	const u2 = manager.appendMessage(userMsg(`${tag} 第二轮问题`, base + 2000));
	const a2 = withSecondReply
		? manager.appendMessage(assistantMsg(`${tag} 第二轮回答`, base + 3000))
		: undefined;
	const file = manager.getSessionFile();
	if (file === undefined) throw new Error("会话未落盘：getSessionFile() 返回 undefined");
	return { file, t0, u1, a1, u2, a2 };
}

const sessionA = buildSession("甲");
const sessionB = buildSession("乙");
const sessionC = buildSession("丙", false);
check(
	"会话夹具落盘（甲/乙 各 2 轮，丙 停在末条用户消息上）",
	existsSync(sessionA.file) && existsSync(sessionB.file) && existsSync(sessionC.file),
	`甲：${sessionA.file}；乙：${sessionB.file}；丙：${sessionC.file}`,
);

/* ── 文件工具（断言用）──────────────────────────────────────────────── */

function readEntries(file: string): Record<string, unknown>[] {
	return readFileSync(file, "utf8")
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => JSON.parse(line) as Record<string, unknown>);
}

function entryIds(file: string): string[] {
	return readEntries(file)
		.filter((entry) => entry["type"] !== "session")
		.map((entry) => String(entry["id"]));
}

function headerOf(file: string): Record<string, unknown> {
	return readEntries(file)[0] ?? {};
}

function sessionInfoNames(file: string): string[] {
	return readEntries(file)
		.filter((entry) => entry["type"] === "session_info")
		.map((entry) => String(entry["name"]));
}

function jsonlFiles(): string[] {
	return readdirSync(sessionsDir)
		.filter((name) => name.endsWith(".jsonl"))
		.sort();
}

/* ── 启 daemon（import 即 start）──────────────────────────────────────── */

await import("../src/daemon/index.ts");
check("daemon 在进程内启动（假 parentPort 生效）", feed !== undefined, `收到 ${outbound.length} 帧（含 ready）`);

// 选模型：activeModelKey 是模块级变量，import 时从偏好读（临时配置里为空），
// 必须经通道写进去，否则 createHost 会以「还没有选择模型」拒绝建宿主。
await invoke<void>(INVOKE.setModel, [MODEL_KEY]);

/* ── 流程 A：重新开始 ───────────────────────────────────────────────── */

const snapshot = (): Promise<SessionSnapshot> => invoke<SessionSnapshot>(INVOKE.snapshot, []);
const listSessions = (): Promise<SessionSummary[]> => invoke<SessionSummary[]>(INVOKE.sessionList, []);

await invoke<void>(INVOKE.sessionResume, [sessionA.file]);
check(
	"resumeSession 注册会话 A 为当前会话",
	(await listSessions()).some(
		(session) => resolve(session.path) === resolve(sessionA.file) && session.current,
	),
	`列表里的当前会话 = ${(await listSessions()).find((s) => s.current)?.title ?? "(无)"}`,
);

// 会话级状态换成非缺省值：重启后必须原地不动（这三项不落会话文件，最容易被重建弄丢）。
await invoke<void>(INVOKE.setScene, ["code"]);
await invoke<void>(INVOKE.setInteraction, ["ask"]);
await invoke<void>(INVOKE.setExpert, ["ui-designer"]);
const beforeRestart = await snapshot();
check(
	"回退前：两轴/专家已切到非缺省值且历史 = 4 条消息",
	beforeRestart.state.sceneId === "code" &&
		beforeRestart.state.interactionId === "ask" &&
		beforeRestart.state.expertId === "ui-designer" &&
		beforeRestart.entries.length === 4,
	`${beforeRestart.state.sceneId}/${beforeRestart.state.interactionId}/${beforeRestart.state.expertId}，` +
		`历史 ${beforeRestart.entries.length} 条，sessionId=${beforeRestart.state.sessionId || "(空)"}`,
);
const motherSessionId = beforeRestart.state.sessionId;

const restart = await invoke<SessionBranchResult>(INVOKE.sessionRestart, [sessionA.file, 1]);
const branchPath = restart.ok ? restart.branchPath : undefined;
const branchTitle = restart.ok ? restart.branchTitle : undefined;

check(
	"A1 重新开始返回成功且带分支会话（分叉点之后确有内容）",
	restart.ok && branchPath !== undefined && branchTitle !== undefined,
	`ok=${restart.ok}，branchPath=${branchPath ?? "(无)"}，branchTitle=${branchTitle ?? "(无)"}`,
);

check(
	"A2 母文件被截断为「header + root→分叉点父条目」",
	branchPath !== undefined &&
		JSON.stringify(entryIds(sessionA.file)) === JSON.stringify([sessionA.t0, sessionA.u1, sessionA.a1]),
	`母文件条目 = [${entryIds(sessionA.file).join(", ")}]，期望 [t0, u1, a1]`,
);

{
	const reopened = SessionManager.open(sessionA.file, sessionsDir);
	check(
		"A3 截断后 SessionManager.open 可正常读，叶子 = 前缀末条",
		reopened.getLeafId() === sessionA.a1 &&
			reopened.buildContextEntries().length === 3,
		`getLeafId()=${String(reopened.getLeafId())}，buildContextEntries().length=${reopened.buildContextEntries().length}`,
	);
}

check(
	"A4 分支文件 = 母会话全量（含被放弃的 u2/a2）+ 自己的 session_info",
	branchPath !== undefined &&
		existsSync(branchPath) &&
		entryIds(branchPath).slice(0, 5).join(",") ===
			[sessionA.t0, sessionA.u1, sessionA.a1, sessionA.u2, sessionA.a2].join(",") &&
		entryIds(branchPath).length === 6,
	`分支条目 = [${branchPath === undefined ? "" : entryIds(branchPath).join(", ")}]，` +
		`期望 [t0, u1, a1, u2, a2] + session_info`,
);

check(
	"A5 分支文件 header.parentSession = 母文件绝对路径",
	branchPath !== undefined && headerOf(branchPath)["parentSession"] === resolve(sessionA.file),
	`parentSession = ${String(branchPath === undefined ? "" : headerOf(branchPath)["parentSession"])}`,
);

check(
	"A6 分支文件写入 session_info 标题「<母标题> · 分支」",
	branchPath !== undefined &&
		branchTitle === "甲 第一轮问题 · 分支" &&
		sessionInfoNames(branchPath).includes(branchTitle),
	`标题 = ${branchTitle ?? "(无)"}，文件里的 session_info = [${branchPath === undefined ? "" : sessionInfoNames(branchPath).join(", ")}]`,
);

{
	const afterRestart = await snapshot();
	check(
		"A7 回退后：历史只剩第 1 轮，两轴/专家/sessionId 未变",
		afterRestart.entries.length === 2 &&
			afterRestart.entries[0]?.role === "user" &&
			afterRestart.entries[1]?.role === "assistant" &&
			afterRestart.state.sceneId === "code" &&
			afterRestart.state.interactionId === "ask" &&
			afterRestart.state.expertId === "ui-designer" &&
			afterRestart.state.sessionId === motherSessionId &&
			afterRestart.state.isStreaming === false,
		`历史 ${afterRestart.entries.length} 条（${afterRestart.entries.map((e) => e.role).join("/")}），` +
			`${afterRestart.state.sceneId}/${afterRestart.state.interactionId}/${afterRestart.state.expertId}，` +
			`sessionId 不变=${afterRestart.state.sessionId === motherSessionId}`,
	);
}

{
	const sessions = await listSessions();
	const mother = sessions.find((session) => resolve(session.path) === resolve(sessionA.file));
	check(
		"A8 列表：母会话仍 current 且被回退后条目数下降，分支会话带 parentSession",
		mother !== undefined &&
			mother.current &&
			mother.parentSession === undefined &&
			mother.messageCount < 4 &&
			sessions.some(
				(session) =>
					resolve(session.path) === resolve(branchPath ?? "") &&
					session.parentSession === resolve(sessionA.file),
			),
		`母 messageCount=${mother?.messageCount ?? "?"}（回退前 4）、current=${String(mother?.current)}；` +
			`分支 parentSession=${String(sessions.find((s) => resolve(s.path) === resolve(branchPath ?? ""))?.parentSession)}`,
	);
}

/* ── 流程 B：分支出新会话 ───────────────────────────────────────────── */

await invoke<void>(INVOKE.sessionResume, [sessionB.file]);
const bytesB = readFileSync(sessionB.file);
const filesBeforeFork = jsonlFiles();

const fork = await invoke<SessionBranchResult>(INVOKE.sessionBranch, [sessionB.file, 1]);
const forkPath = fork.ok ? fork.branchPath : undefined;
const forkTitle = fork.ok ? fork.branchTitle : undefined;

check(
	"B1 分支返回成功且带新会话（分叉点 = 第 2 条用户消息）",
	fork.ok && forkPath !== undefined && forkTitle !== undefined,
	`ok=${fork.ok}，path=${forkPath ?? "(无)"}，title=${forkTitle ?? "(无)"}`,
);

check(
	"B2 母文件字节完全不变",
	readFileSync(sessionB.file).equals(bytesB),
	`${bytesB.length} → ${readFileSync(sessionB.file).length} 字节；目录新增 ${
		jsonlFiles().length - filesBeforeFork.length
	} 个文件`,
);

check(
	"B3 新会话历史 = 分叉点之前的前缀（t0/u1/a1）+ session_info",
	forkPath !== undefined &&
		entryIds(forkPath).slice(0, 3).join(",") ===
			[sessionB.t0, sessionB.u1, sessionB.a1].join(",") &&
		entryIds(forkPath).length === 4,
	`新会话条目 = [${forkPath === undefined ? "" : entryIds(forkPath).join(", ")}]，前缀 = [t0, u1, a1] + session_info`,
);

check(
	"B4 新会话 header.parentSession = 母文件绝对路径，标题带「· 分支」",
	forkPath !== undefined &&
		headerOf(forkPath)["parentSession"] === resolve(sessionB.file) &&
		sessionInfoNames(forkPath).includes(forkTitle ?? "?"),
	`parentSession=${String(forkPath === undefined ? "" : headerOf(forkPath)["parentSession"])}，` +
		`session_info=[${forkPath === undefined ? "" : sessionInfoNames(forkPath).join(", ")}]`,
);

{
	const afterFork = await snapshot();
	const sessions = await listSessions();
	const mother = sessions.find((session) => resolve(session.path) === resolve(sessionB.file));
	check(
		"B5 已切到新会话，且新桶两轴/专家/cwd 与母会话一致",
		afterFork.state.sessionId !== motherSessionId &&
			afterFork.state.sceneId === "code" &&
			afterFork.state.interactionId === "ask" &&
			afterFork.state.expertId === "ui-designer" &&
			afterFork.state.cwd === cwd &&
			afterFork.entries.length === 2 &&
			mother !== undefined &&
			!mother.current,
		`新会话 cwd=${afterFork.state.cwd}（母 cwd=${cwd}），` +
			`${afterFork.state.sceneId}/${afterFork.state.interactionId}/${afterFork.state.expertId}，` +
			`历史 ${afterFork.entries.length} 条，母会话 current=${String(mother?.current)}`,
	);
}

// 分叉点是首条用户消息 → 新会话为空历史（pi 的 createBranchedSession(null) 无效，
// 必须走 createEmptySessionFile）。
const forkFirst = await invoke<SessionBranchResult>(INVOKE.sessionBranch, [sessionB.file, 0]);
const forkFirstPath = forkFirst.ok ? forkFirst.branchPath : undefined;
const forkFirstTitle = forkFirst.ok ? forkFirst.branchTitle : undefined;
check(
	"B6 分叉点是首条用户消息：新会话为空历史、来源标记正确、标题递增去重",
	forkFirst.ok &&
		forkFirstPath !== undefined &&
		existsSync(forkFirstPath) &&
		headerOf(forkFirstPath)["parentSession"] === resolve(sessionB.file) &&
		forkFirstTitle === "乙 第一轮问题 · 分支 2" &&
		readFileSync(sessionB.file).equals(bytesB) &&
		(await snapshot()).entries.length === 0,
	`path=${forkFirstPath ?? "(无)"}，title=${forkFirstTitle ?? "(无)"}，` +
		`新会话历史 = ${(await snapshot()).entries.length} 条，母文件字节不变=${readFileSync(sessionB.file).equals(bytesB)}`,
);

/* ── 回答操作条的分支：includeTurn（复制到这条回答为止）────────────── */

{
	// 会话丙是「u1 → a1 → u2（无回答）」的形态，另造一个完整两轮的会话丁来验：
	// includeTurn 的分支应当**带上本轮**（含 u2/a2），而不是只带前缀。
	const sessionD = buildSession("丁");
	await invoke<void>(INVOKE.sessionResume, [sessionD.file]);
	const bytesD = readFileSync(sessionD.file);

	const included = await invoke<SessionBranchResult>(INVOKE.sessionBranch, [
		sessionD.file,
		1,
		{ includeTurn: true },
	]);
	const includedPath = included.ok ? included.branchPath : undefined;

	check(
		"G1 includeTurn 分支：新会话 = 前缀 + 本轮问答 + session_info",
		included.ok &&
			includedPath !== undefined &&
			entryIds(includedPath).slice(0, 5).join(",") ===
				[sessionD.t0, sessionD.u1, sessionD.a1, sessionD.u2, sessionD.a2].join(",") &&
			entryIds(includedPath).length === 6,
		`新会话条目 = [${includedPath === undefined ? "" : entryIds(includedPath).join(", ")}]，期望 [t0,u1,a1,u2,a2] + session_info`,
	);

	check(
		"G2 母会话字节完全不变（分支不动母会话）",
		readFileSync(sessionD.file).equals(bytesD),
		`${bytesD.length} → ${readFileSync(sessionD.file).length} 字节`,
	);

	check(
		"G3 includeTurn 与缺省模式的分叉点确实不同（缺省只到本轮之前）",
		includedPath !== undefined &&
			entryIds(includedPath).includes(sessionD.u2) &&
			forkPath !== undefined &&
			!entryIds(forkPath).includes(sessionB.u2),
		`includeTurn 含 u2=${includedPath !== undefined && entryIds(includedPath).includes(sessionD.u2)}；` +
			`缺省分支含 u2=${forkPath !== undefined && entryIds(forkPath).includes(sessionB.u2)}`,
	);
}

/* ── 新建任务在首响应前就应出现在列表里（pi 未落盘 → 列表补合成条目）──── */

{
	// pi 在「会话里还没有助手消息」之前不写文件（session-manager.js 的 _persist 守卫：
	// 首条 assistant 到达时才一次性写出）。列表是磁盘扫描，于是新建任务的第一条消息
	// 发出后、首响应到达前会在侧栏缺席（2026-09-17 用户实测「任务已经在跑了，
	// 过一会才出现」）。daemon 侧用桶里的信息补一条合成摘要，本节钉住它。
	await invoke<void>(INVOKE.newTask, []);
	void invoke<void>(INVOKE.prompt, [{ text: "新建任务的首条消息（应立刻出现在列表）" }]).catch(() => {
		/* run 的结局不是本用例的断言对象（模型永不应答） */
	});
	let running = true;
	try {
		await waitUntil(async () => (await listSessions()).some((s) => s.current && s.running), 20_000, "新任务进入流式");
	} catch {
		running = false;
	}
	const listed = (await listSessions()).find((s) => s.current);
	check(
		"H1 首响应前：新任务已在列表里且 running=true，标题取首条用户消息",
		running && listed !== undefined && listed.title.includes("首条消息"),
		`current=${String(listed?.title)}，running=${String(listed?.running)}`,
	);
	check(
		"H2 该会话文件此刻确实还没落盘（证明 H1 不是靠落盘才有的）",
		listed !== undefined && !existsSync(listed.path),
		`path=${listed?.path ?? "(无)"}，exists=${listed === undefined ? "?" : String(existsSync(listed.path))}`,
	);
	await invoke<void>(INVOKE.abort, []);
	await waitUntil(
		async () => (await listSessions()).every((s) => !s.current || !s.running),
		15_000,
		"run 收尾（aborted）",
	);
}

/* ── 拒绝路径 ───────────────────────────────────────────────────────── */

{
	const outOfRange = await invoke<SessionBranchResult>(INVOKE.sessionRestart, [sessionB.file, 99]);
	check(
		"C1 序号越界 → no-such-entry，母文件与目录均无写入",
		outOfRange.ok === false &&
			outOfRange.reason === "no-such-entry" &&
			readFileSync(sessionB.file).equals(bytesB),
		`reason=${outOfRange.ok ? "(ok)" : outOfRange.reason}，bytes 不变=${readFileSync(sessionB.file).equals(bytesB)}`,
	);
}

{
	const missing = join(sessionsDir, "不存在的会话.jsonl");
	const restartMissing = await invoke<SessionBranchResult>(INVOKE.sessionRestart, [missing, 0]);
	const forkMissing = await invoke<SessionBranchResult>(INVOKE.sessionBranch, [missing, 0]);
	check(
		"C2 路径无会话文件 → no-file（两条通道一致）",
		restartMissing.ok === false &&
			restartMissing.reason === "no-file" &&
			forkMissing.ok === false &&
			forkMissing.reason === "no-file" &&
			!existsSync(missing),
		`restart=${restartMissing.ok ? "(ok)" : restartMissing.reason}，fork=${forkMissing.ok ? "(ok)" : forkMissing.reason}`,
	);
}

{
	// running 拒绝：发一次 prompt（假服务商永不应答）让会话进入流式，再发起分支。
	// 关键断言是「链外先判」—— 若排进互斥链，这条请求会等 run 收尾才返回，
	// 那不叫拒绝，界面会一直挂着。
	await invoke<void>(INVOKE.sessionResume, [sessionB.file]);
	/*
	 * 不等 prompt 的响应：假服务商永不应答，run 会一直挂在请求上（pi 的请求超时
	 * 是 300s，还会自动重试），而「受理即回」那条契约只保证 run_started 后 resolve
	 * —— 这里要判的是「会话是否已进入流式」，用列表轮询更贴合本用例要证的事，
	 * 也免得把断言挂在那条 IPC 的返回时序上。
	 */
	void invoke<void>(INVOKE.prompt, [{ text: "触发一次 run（假服务商不应答）" }]).catch(() => {
		/* run 的结局不是本用例的断言对象 */
	});
	let streamed = true;
	try {
		await waitUntil(
			async () =>
				(await listSessions()).some(
					(session) => resolve(session.path) === resolve(sessionB.file) && session.running,
				),
			20_000,
			"会话进入流式（running=true）",
		);
	} catch {
		streamed = false;
	}
	check("C3 前置：会话确实进入了流式（否则 busy 断言是空的）", streamed, `running=${String(streamed)}`);
	const filesBeforeBusy = jsonlFiles();
	const busyRestart = await invoke<SessionBranchResult>(INVOKE.sessionRestart, [sessionB.file, 0]);
	const busyFork = await invoke<SessionBranchResult>(INVOKE.sessionBranch, [sessionB.file, 0]);
	await invoke<void>(INVOKE.abort, []);
	await waitUntil(
		async () =>
			(await listSessions()).every(
				(session) => resolve(session.path) !== resolve(sessionB.file) || !session.running,
			),
		15_000,
		"run 收尾（aborted）",
	);
	check(
		"C4 流式中 → busy（且不排队干等），不留任何分支文件",
		busyRestart.ok === false &&
			busyRestart.reason === "busy" &&
			busyFork.ok === false &&
			busyFork.reason === "busy" &&
			jsonlFiles().length === filesBeforeBusy.length,
		`restart=${busyRestart.ok ? "(ok)" : busyRestart.reason}，fork=${busyFork.ok ? "(ok)" : busyFork.reason}，` +
			`文件数 ${filesBeforeBusy.length} → ${jsonlFiles().length}`,
	);
	// 反面：run 收尾后同一条通道必须不再 busy —— 否则上面那个 busy 可能只是
	// 「标志卡死」，而不是真的在流式。
	const afterAbort = await invoke<SessionBranchResult>(INVOKE.sessionBranch, [sessionB.file, 0]);
	check(
		"C5 中断收尾后同一条通道不再 busy（证明 C4 的 busy 与流式态绑定）",
		afterAbort.ok === true,
		`afterAbort=${afterAbort.ok ? "ok" : afterAbort.reason}`,
	);
}

/* ── 重试路径：saveBranch=false（2026-09-17 修订：重新生成不抽枝）────── */

{
	// 重试 = 就地回退 + 立即重发（重发由渲染层做）：daemon 侧只回退，**不抽枝**。
	// 会话乙此刻有完整两轮（C5 只 fork 过它，母文件未动）—— 回退第 2 轮明知有
	// 「未来」可存，但 saveBranch=false 时不得产生任何新文件、结果里不得带分支。
	const filesBefore = jsonlFiles().length;
	const retry = await invoke<SessionBranchResult>(INVOKE.sessionRestart, [
		sessionB.file,
		1,
		{ saveBranch: false },
	]);
	check(
		"F1 重试（saveBranch:false）返回 ok 且不带 branchPath/branchTitle",
		retry.ok === true && retry.branchPath === undefined && retry.branchTitle === undefined,
		`ok=${String(retry.ok)}，${retry.ok ? `branchPath=${String(retry.branchPath)}` : `reason=${retry.reason}`}`,
	);
	check(
		"F2 不产生分支文件，母文件截断为第 1 轮",
		jsonlFiles().length === filesBefore &&
			entryIds(sessionB.file).join(",") === [sessionB.t0, sessionB.u1, sessionB.a1].join(","),
		`文件数 ${filesBefore} → ${jsonlFiles().length}，母条目 = [${entryIds(sessionB.file).join(", ")}]`,
	);
	// C5 的 fork 已把「当前会话」切到分支桶 —— 这里必须按 sessionId 显式取乙桶的
	// 快照，否则拿到的是那个空分支桶的历史（0 条），断言就变成假的。
	const bSessionId =
		(await listSessions()).find((session) => resolve(session.path) === resolve(sessionB.file))?.id;
	const bAfter = await invoke<SessionSnapshot>(INVOKE.snapshot, [bSessionId]);
	check(
		"F3 回退后可见历史 = 第 1 轮两条消息（按乙桶 sessionId 显式取）",
		bAfter.entries.length === 2,
		`历史 ${bAfter.entries.length} 条，sessionId=${bSessionId ?? "(无)"}`,
	);
}

/* ── 分叉点之后没有内容：可执行但不产生分支会话 ───────────────────────── */

{
	// 会话丙的最后一条是用户消息（没有任何后代）—— 回退它时不需要保存「未来」，
	// 该消息自己会回到输入框，所以不该往侧栏塞一条只含前缀的会话。
	await invoke<void>(INVOKE.sessionResume, [sessionC.file]);
	const filesBefore = jsonlFiles().length;
	const noFuture = await invoke<SessionBranchResult>(INVOKE.sessionRestart, [sessionC.file, 1]);
	const noFuturePath = noFuture.ok ? noFuture.branchPath : undefined;
	check(
		"E1 分叉点之后没有内容：返回 ok 但不带 branchPath，也不产生分支文件",
		noFuture.ok === true &&
			noFuturePath === undefined &&
			noFuture.branchTitle === undefined &&
			jsonlFiles().length === filesBefore,
		`ok=${String(noFuture.ok)}，branchPath=${String(noFuturePath)}，文件数 ${filesBefore} → ${jsonlFiles().length}`,
	);
	check(
		"E2 母文件被截断到分叉点的父条目（u2 自己回到输入框，不留在历史里）",
		entryIds(sessionC.file).join(",") === [sessionC.t0, sessionC.u1, sessionC.a1].join(","),
		`母文件条目 = [${entryIds(sessionC.file).join(", ")}]，期望 [t0, u1, a1]`,
	);
	check(
		"E3 回退后可见历史 = 第 1 轮两条消息",
		(await snapshot()).entries.length === 2,
		`历史 ${(await snapshot()).entries.length} 条`,
	);
}

/* ── 宿主绑定：抽枝没有劫持活宿主的管理器 ─────────────────────────────── */

{
	// 改名走已注册桶的活宿主（sessionRename 的注释）。若抽枝时误在活宿主的管理器上
	// 调了 createBranchedSession，母会话的管理器会指向分支文件 —— 这条写入就会
	// 落到分支文件上（而母文件反倒没有）。
	await invoke<void>(INVOKE.sessionResume, [sessionB.file]);
	await invoke<void>(INVOKE.sessionRename, [sessionB.file, "母会话改名"]);
	check(
		"D1 母会话的活宿主仍绑定在母文件上（改名写母文件、不写分支文件）",
		sessionInfoNames(sessionB.file).includes("母会话改名") &&
			forkPath !== undefined &&
			!sessionInfoNames(forkPath).includes("母会话改名"),
		`母文件 session_info = [${sessionInfoNames(sessionB.file).join(", ")}]；` +
			`分支文件 session_info = [${forkPath === undefined ? "" : sessionInfoNames(forkPath).join(", ")}]`,
	);
}

/* ── 汇总 ────────────────────────────────────────────────────────────── */

hangServer.close();
rmSync(workDir, { recursive: true, force: true });

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length > 0) {
	console.log("失败项：");
	for (const item of failed) console.log(`  - ${item.name}: ${item.detail}`);
	process.exitCode = 1;
}
// 显式退出：daemon 的启动钩子（docx 预热 / 预览服务）可能还挂着句柄，
// 让事件循环自然排空会把冒烟脚本吊在后台（它的结论与这些句柄无关）。
process.exit(process.exitCode ?? 0);
