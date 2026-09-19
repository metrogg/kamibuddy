/**
 * 成员会话读取层 —— 团队「拉模式」的地基（spec: add-team-pull-model 批次①）。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  为什么有这个模块（对齐 WorkBuddy 的核心手法的落点）
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WorkBuddy（`docs/WorkBuddy-reference/extracted/main/server.js`）的成员状态
 * **不是「上报」的，是「派生」的**：它的 `ChildAgentProjection` 从不依赖
 * 「收到一条成员完成消息」，而是扫子会话记录算出来 ——
 *
 *   derivePersistedTranscriptStatus(items)：
 *     见 cancelled/killed/499  → killed
 *     见 failed/error/incomplete → failed
 *     见中间态（工具调用/reasoning）→ 清掉（不算终态证据）
 *     见「有正文的 assistant 消息」→ completed
 *
 * 它的注释明写「终态事件走 ACP 实时通道、**进程重启就丢**」—— 也就是说
 * WorkBuddy 明确接受「事件帧会丢」，靠冷启动 hydrate 后**回读文件重算**兜底。
 *
 * 本模块把这条思路落到 KamiBuddy：成员会话 JSONL（`~/.kamibuddy/sessions/`）
 * 是**唯一真源**，成员跑到哪一步、有没有产出，一律从文件读。注册表只做索引。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  与 WorkBuddy 的逐条对应（别凭印象改，改前先读那份源码）
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   WorkBuddy                              →  本模块
 *   ──────────────────────────────────────  ──────────────────────────────────
 *   readTranscript(childFiles, id, label)  →  readMemberTranscript(sessionId)
 *   derivePersistedTranscriptStatus(items) →  deriveMemberStatus(items)
 *   isCancellation / isFailure              →  同名私有判定（见下）
 *   isTranscriptProgress                    →  isInProgressRecord
 *   extractText                             →  extractAssistantText
 *   normalizeAgentOutput                    →  normalizeMemberOutput
 *   hasEquivalentAssistant(records, out)    →  hasEquivalentMemberOutput(...)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  为什么不复用 daemon 已有的会话读取（session-file.ts / usage-stats.ts）
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * - `session-file.ts` 读的是**原始行文本**（保 pi 演进面、供重写用），不解析
 *   message 内容；本模块要解析 message.role / content / stopReason，用途不同。
 * - `usage-stats.ts` 读同一批文件但目标是 token/费用统计，不判终态。
 * - 三者共用 `getSessionsDir()` 做路径来源，互不复制路径逻辑。
 *
 * 本模块只读不写（无路径穿越风险面），但路径仍经 `validateSessionFilePath`
 * 守卫 —— 与 session-file.ts 同一道防线，不重写第二份。
 */

import {
	closeSync,
	existsSync,
	openSync,
	readdirSync,
	readFileSync,
	readSync,
	statSync,
} from "node:fs";
import { join } from "node:path";
import { getSessionsDir } from "../core/config-paths.ts";
import { validateSessionFilePath } from "../core/session-rebuild.ts";

/** 从会话 JSONL 解析出的一条 message 记录（只取本模块要用的字段）。 */
export interface MemberTranscriptMessage {
	/** assistant / user / system。非 message 条目（model_change 等）不进这里。 */
	readonly role: string;
	/** 纯文本内容（content 数组里 type==="text" 的部分拼接）。 */
	readonly text: string;
	/** assistant 消息的停止原因：stop / length / aborted / error…；user 消息无此字段。 */
	readonly stopReason: string | undefined;
	/** 该条目是否携带实质正文（非空白）。 */
	readonly hasText: boolean;
}

/**
 * 成员终态判据的结果。
 *
 * 与 `TeamMemberStatus` 是**两个层面**：这里是「从文件读出来的事实」，
 * 那边是「注册表里的运行态」。批次②负责把二者合流。
 */
export type MemberTranscriptStatus = "completed" | "killed" | "failed" | undefined;

/**
 * 判定用的最小记录形状 —— 刻意不复用 `MemberTranscriptMessage`。
 *
 * 为什么分离：`deriveMemberStatus` 的价值在于它是**纯函数**（WorkBuddy 的
 * `derivePersistedTranscriptStatus` 同样是纯函数，97 个 spec 用例直接喂数组）。
 * 让测试能构造任意畸形输入（缺 stopReason、空 content、未知 role）是这份实现的
 * 一部分，不该被「读文件」的类型绑住。
 */
export interface MemberTranscriptRecord {
	readonly role: string;
	readonly text: string;
	readonly stopReason?: string | undefined;
}

/**
 * 成员会话文件路径解析（sessionId → 磁盘文件）。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  为什么不是直接拼 `<sessionsDir>/<sessionId>.jsonl`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * pi 的会话文件名是 **`<文件时间戳>_<sessionId>.jsonl`**
 * （`开源项目/pi/packages/coding-agent/src/core/session-manager.ts:953`），
 * sessionId 只是文件名的一部分。**2026-09-19 真机实测**：按 `<sessionId>.jsonl`
 * 拼出来的路径一律不存在（`pathExists: false`），于是整条「拉模式」在最底层
 * 静默失效 ——
 *   - `team_status` 永远不显示「有产出可读」；
 *   - `team_read` 永远回「暂无产出」；
 *   - `restoreTeam` 的派生永远回落，成员状态一律按落盘字面量算。
 * 领导因此判定「团队通道坏了」，改用子代理重做（现场会话 12:27~12:36 的
 * 原话就是「落盘没有生效」「两轮追加指示都没唤出正文」）。
 *
 * 单测当时没发现，是因为它**拿本函数自己算出的路径去造文件再读回来**
 * （自洽循环）—— 造的文件名与 pi 的真实命名无关。教训同 AGENTS.md：
 * **证据要打真入口路径**；本次给读文件层补了「按真实命名造文件」的回归用例。
 *
 * 解析顺序（两条都是真实存在的形态）：
 *   1. `<sessionId>.jsonl` —— 直命名（旧形态 / 单测直接落盘）；
 *   2. 目录索引里按 `<任意前缀>_<sessionId>.jsonl` 反查（pi 的真实命名）。
 *
 * 目录索引带 TTL 缓存（键含目录，配置目录切换即失效）：命中即返回，未命中
 * 才重建，避免「读不到」的调用每次都全目录扫一遍。找不到 → `undefined`
 * （调用方按「读不到」处理，不抛）。
 */
export function memberSessionPath(sessionId: string): string | undefined {
	if (sessionId === "") return undefined;
	const dir = getSessionsDir();
	const direct = join(dir, `${sessionId}.jsonl`);
	if (existsSync(direct)) return direct;

	const now = Date.now();
	let index = sessionFileIndex;
	if (index === undefined || index.dir !== dir || now - index.builtAt > SESSION_FILE_INDEX_TTL_MS) {
		index = { dir, builtAt: now, byId: buildSessionFileIndex(dir) };
		sessionFileIndex = index;
	}
	return index.byId.get(sessionId);
}

/** 目录索引缓存（见 memberSessionPath 的注释）。 */
let sessionFileIndex: { dir: string; builtAt: number; byId: Map<string, string> } | undefined;

/**
 * 索引重建的最短间隔。取 1s 是为了兼顾两端：成员会话文件在 spawn 时就已落盘，
 * 1s 的滞后对「领导读产出」这个秒级以上的动作没有影响；而它挡住了「文件确实
 * 不存在时每个成员事件都全目录扫一遍」的放大。
 */
const SESSION_FILE_INDEX_TTL_MS = 1_000;

/** 扫会话目录建 `sessionId → 文件路径` 索引（`<时间戳>_<id>.jsonl` 取 `_` 之后那段）。 */
function buildSessionFileIndex(dir: string): Map<string, string> {
	const byId = new Map<string, string>();
	let names: readonly string[];
	try {
		names = readdirSync(dir);
	} catch {
		return byId; // 目录还不存在（首次使用）：空索引，读侧照常按「读不到」处置。
	}
	for (const name of names) {
		if (!name.toLowerCase().endsWith(".jsonl")) continue;
		const base = name.slice(0, -".jsonl".length);
		const separator = base.indexOf("_");
		const id = separator === -1 ? base : base.slice(separator + 1);
		if (id !== "") byId.set(id, join(dir, name));
	}
	return byId;
}

/**
 * 尾部读取窗口。超过它的会话文件**只读最后这一段**。
 *
 * 为什么必须加上界（spec 里原本就有这条，实施时被推迟了，理由是「成员产出上限
 * 24k 字符、单轮规模可控」—— 那个前提是错的）：`emitTeamProgress` 在**成员每次
 * 工具调用**后都要算一遍 `outputAvailable`，于是每个成员事件 × 每个成员 × 整个
 * 文件都会被解析一次。真机会话里单个成员文件已到 1 MB（163 条消息），
 * 一次 run 上百个工具调用 ⇒ 上千次 MB 级 JSON.parse，全部落在 daemon 主线程上。
 * 而本模块的两个用途（最近的终态判定、最近一轮产出）**只需要文件尾部** ——
 * WorkBuddy 同样只读尾摘要（`loadTailSummary`），不整文件读。
 *
 * 512 KB 是个宽松上界：它足以装下若干条完整消息（含 24k 字符量级的产出），
 * 又让单次读的上界与文件长度无关。
 */
const TRANSCRIPT_TAIL_BYTES = 512 * 1024;

/**
 * 安全读取（尾部优先），路径守卫失败或文件不存在都返回 undefined（调用方自行兜底）。
 *
 * 超过窗口的文件从 `size - TRANSCRIPT_TAIL_BYTES` 处起读，并**丢掉首行** ——
 * 那多半是被截断的半行（JSON 解析必失败，留着只会白跑一次 parse）。
 */
function readLinesSafely(path: string | undefined): readonly string[] | undefined {
	if (path === undefined) return undefined;
	try {
		if (validateSessionFilePath(path, getSessionsDir()) !== undefined) return undefined;
		const size = statSync(path).size;
		if (size <= TRANSCRIPT_TAIL_BYTES) return readFileSync(path, "utf8").split("\n");
		const fd = openSync(path, "r");
		try {
			const buffer = Buffer.alloc(TRANSCRIPT_TAIL_BYTES);
			const bytes = readSync(fd, buffer, 0, TRANSCRIPT_TAIL_BYTES, size - TRANSCRIPT_TAIL_BYTES);
			const text = buffer.toString("utf8", 0, bytes);
			const firstBreak = text.indexOf("\n");
			return (firstBreak === -1 ? text : text.slice(firstBreak + 1)).split("\n");
		} finally {
			closeSync(fd);
		}
	} catch {
		return undefined;
	}
}

/** 从 pi 的 content（字符串或 block 数组）里取纯文本。 */
function extractTextFromContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const block of content) {
		if (typeof block !== "object" || block === null) continue;
		const record = block as Record<string, unknown>;
		// 只要 text block：thinking / tool_use 里也有 text 字段，混进来会污染正文。
		if (record["type"] !== "text") continue;
		const text = record["text"];
		if (typeof text === "string") parts.push(text);
	}
	return parts.join("");
}

/**
 * 读成员会话的 message 记录（按文件顺序，含 user 与 assistant）。
 *
 * **读的是文件尾部**（见 TRANSCRIPT_TAIL_BYTES）：调用方只关心「最近的终态」与
 * 「最近一轮产出」，超长会话没必要整文件解析。
 *
 * 容错口径与 WorkBuddy 的 `parseJsonl` 一致：坏行跳过不抛错；文件不存在
 * 返回空数组（**不抛**）—— 「读不到」与「读出来是空」在上层是同一处置
 * （派生不出终态 → 回落到注册表判据），区分它们只会让调用方多写一段 if。
 */
export function readMemberTranscript(sessionId: string): readonly MemberTranscriptMessage[] {
	const lines = readLinesSafely(memberSessionPath(sessionId));
	if (lines === undefined) return [];

	const out: MemberTranscriptMessage[] = [];
	for (const line of lines) {
		if (line.trim() === "") continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			continue;
		}
		if (typeof parsed !== "object" || parsed === null) continue;
		const record = parsed as Record<string, unknown>;
		// header 行（type:"session"）与 model_change / thinking_level_change / custom
		// 等非消息条目一律跳过 —— 它们不是「成员产出」的证据。
		if (record["type"] !== "message") continue;
		const message = record["message"];
		if (typeof message !== "object" || message === null) continue;
		const msg = message as Record<string, unknown>;
		const role = typeof msg["role"] === "string" ? msg["role"] : "";
		const text = extractTextFromContent(msg["content"]);
		const stopReason = typeof msg["stopReason"] === "string" ? msg["stopReason"] : undefined;
		out.push({ role, text, stopReason, hasText: text.trim() !== "" });
	}
	return out;
}

/**
 * 判定：这条 assistant 记录是否表示「中断/取消」。
 *
 * 对应 WorkBuddy 的 `isCancellation`：`status in {cancelled, canceled, killed}`
 * 或错误码 499（客户端主动断开的标准码）。我们的载体是 pi 的 `stopReason`。
 */
export function isCancellationRecord(record: MemberTranscriptRecord): boolean {
	return record.stopReason === "aborted" || record.stopReason === "cancelled";
}

/**
 * 判定：这条记录是否表示「失败」。
 *
 * 对应 WorkBuddy 的 `isFailure`：`status in {failed, error, incomplete}`。
 */
export function isFailureRecord(record: MemberTranscriptRecord): boolean {
	return record.stopReason === "error" || record.stopReason === "length";
}

/**
 * 判定：这条记录是否是「中间态」（工具调用 / reasoning 之类的过程证据）。
 *
 * 对应 WorkBuddy 的 `isTranscriptProgress` —— 它的语义是**把累积的终态清零**：
 * 一个子代理可能在轮次中间产出过文本，之后又继续调工具；那种文本不是「最终产出」。
 * 我们这边同样处理：只要后面还有 assistant 记录，前面的 completed 判据就该被清掉，
 * 由**最后一条**决定。
 */
export function isInProgressRecord(record: MemberTranscriptRecord): boolean {
	// pi 的中间轮次 stopReason 是 "toolUse"（要继续调工具）；带正文的空跑则按完成算。
	return record.stopReason === "toolUse" || record.stopReason === "tool_use";
}

/**
 * 从记录序列派生成员终态 —— **逐字对齐** WorkBuddy 的
 * `derivePersistedTranscriptStatus`：扫全序列，遇 cancelled/killed → killed，
 * 遇 failed/error/incomplete → failed，遇中间态 → **清掉之前的判定**，
 * 遇「有正文的 assistant 消息」→ completed。
 *
 * 关键在**顺序与「清掉」语义**：它扫全序列而非只看最后一条，遇到中间态会把
 * 之前的判定清零。这样「跑了一半、又继续跑、最后正常收尾」→ completed；
 * 「跑完一轮、又起一轮、那轮被 abort」→ killed。
 *
 * 返回 `undefined` = 派生不出终态（**不是**「还在跑」）—— 上层据此回落到
 * 注册表判据，见批次②。
 */
export function deriveMemberStatus(
	records: readonly MemberTranscriptRecord[],
): MemberTranscriptStatus {
	let terminal: MemberTranscriptStatus;
	for (const record of records) {
		if (record.role !== "assistant") continue;
		if (isCancellationRecord(record)) terminal = "killed";
		else if (isFailureRecord(record)) terminal = "failed";
		else if (isInProgressRecord(record)) terminal = undefined;
		else if (record.text.trim() !== "") terminal = "completed";
	}
	return terminal;
}

/**
 * 取成员最近一轮的产出正文（最后一条**有正文**的 assistant 消息）。
 *
 * 为什么要「最后一条有正文的」而不是「最后一条」：pi 会在收尾时补一条空的
 * assistant 记录（或纯 thinking），那种不该当成产出。WorkBuddy 的
 * `buildTeamMemberDTO` 同样是「读子文件尾部拿 assistant terminal record」。
 */
export function extractMemberOutput(
	records: readonly MemberTranscriptRecord[],
): string | undefined {
	for (let index = records.length - 1; index >= 0; index--) {
		const record = records[index];
		if (record === undefined) continue;
		if (record.role !== "assistant") continue;
		if (record.text.trim() === "") continue;
		return record.text;
	}
	return undefined;
}

/**
 * 剥掉正文里的 Agent ID 装饰 —— 对齐 WorkBuddy 的 `normalizeAgentOutput`：
 * 去掉**开头**的 `[Agent ID: ...]`、去掉**结尾**的 `[Agent ID: ...]`，再 trim。
 *
 * 用途是**幂等比对**：同一份产出可能带/不带这个前缀（不同注入路径），
 * 比对前必须归一化，否则会误判成「两份不同的产出」。
 */
export function normalizeMemberOutput(value: string): string {
	return value
		.replace(/^\s*\[Agent ID:[^\]]+\]\s*/i, "")
		.replace(/\s*\[Agent ID:[^\]]+\]\s*$/i, "")
		.trim();
}

/**
 * 幂等去重：这份产出是否已经在这个成员的会话里了 —— 对齐 WorkBuddy 的
 * `hasEquivalentAssistant`（它扫记录找「role 为 assistant 且正文与给定产出等价」
 * 的那条）。
 *
 * **这是拉模式相对推模式的核心优势**：判断「投递过没有」不再依赖任何
 * 「送达状态机」（那正是三次丢消息的根源），而是比内容 —— 同一份产出读两次
 * 内容一样，天然幂等，重复读不会产生重复记录。
 */
export function hasEquivalentMemberOutput(
	records: readonly MemberTranscriptRecord[],
	output: string,
): boolean {
	const target = normalizeMemberOutput(output);
	if (target === "") return false;
	return records.some(
		(record) =>
			record.role === "assistant" && normalizeMemberOutput(record.text) === target,
	);
}

/**
 * 一步到位：读成员会话 → 派生状态 + 取产出。
 *
 * 批次②/③ 的主要入口。文件读不到时返回
 * `{ status: undefined, output: undefined, messages: [] }`（不抛）。
 */
export interface MemberTranscriptView {
	readonly messages: readonly MemberTranscriptMessage[];
	/** 派生出的终态；`undefined` = 派生不出（上层回落注册表）。 */
	readonly status: MemberTranscriptStatus;
	/** 最近一轮产出正文；`undefined` = 还没有产出。 */
	readonly output: string | undefined;
}

export function readMemberTranscriptView(sessionId: string): MemberTranscriptView {
	const messages = readMemberTranscript(sessionId);
	return {
		messages,
		status: deriveMemberStatus(messages),
		output: extractMemberOutput(messages),
	};
}
