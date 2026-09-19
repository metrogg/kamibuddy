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

import { existsSync, readFileSync } from "node:fs";
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

/** 会话文件路径（成员会话也是普通会话，同目录同命名）。 */
export function memberSessionPath(sessionId: string): string {
	return join(getSessionsDir(), `${sessionId}.jsonl`);
}

/** 安全读取，路径守卫失败或文件不存在都返回 undefined（调用方自行兜底）。 */
function readLinesSafely(path: string): readonly string[] | undefined {
	try {
		if (validateSessionFilePath(path, getSessionsDir()) !== undefined) return undefined;
		if (!existsSync(path)) return undefined;
		return readFileSync(path, "utf8").split("\n");
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
