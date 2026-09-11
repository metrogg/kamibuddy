/**
 * conversation_search 的检索实现：扫 sessions 目录的 JSONL 找关键词命中
 *（spec: add-memory-system）。
 *
 * 为什么自己解析而不走 pi 的 SessionManager.listAll：
 * listAll 会读完**全部**会话文件来构造 SessionInfo（含汇合的 allMessagesText），
 * 会话库一大就是每次检索全库扫描；而且命中定位需要条目边界（要取最早命中的
 * 那条消息），listAll 汇合后的文本已经把边界丢了。这里先按文件 mtime 倒序
 * 截断到最近 SCAN_LIMIT 个再解析，检索成本有硬顶。
 *
 * 直接读会话文件是 daemon 读自己的数据，不经权限门（与 AutomationStore 同例）。
 * 单个会话文件损坏跳过不抛：一个坏文件不该让整个检索工具不可用
 * （pi 的 buildSessionInfo 对坏文件同样返回 null），但记日志留现场。
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ConversationSearchHit } from "../shared/session-events.ts";

/** 扫描上限：只查最近这么多个会话文件（按 mtime 倒序截断），防止大会话库卡检索。 */
const SCAN_LIMIT = 200;

/** 片段半径：命中处前后各取约这么多字符。 */
const SNIPPET_RADIUS = 200;

/**
 * 列表标题的截断上限。renderer 的 taskTitle 另有 24 字符的展示截断，
 * 这里截的是数据上限：首条消息原文可能整段上千字，不能原样进契约。
 * 任务列表（daemon/index.ts 的 listSessions）与检索命中共用本函数 ——
 * 同一个会话在两个地方标题必须一致。
 */
const SESSION_TITLE_MAX = 40;

/** 会话标题：命名优先，否则首条消息压单行截断。空会话给占位，不留空白行。 */
export function deriveSessionTitle(name: string | undefined, firstMessage: string): string {
	if (name !== undefined && name !== "") return name;
	const oneLine = firstMessage.replace(/\s+/g, " ").trim();
	if (oneLine === "") return "（空会话）";
	return oneLine.length > SESSION_TITLE_MAX
		? `${oneLine.slice(0, SESSION_TITLE_MAX)}…`
		: oneLine;
}

export interface SearchSessionFilesOptions {
	/** 会话文件目录（~/.kamibuddy/sessions）。 */
	readonly sessionsDir: string;
	/**
	 * 跳过这个会话 id（当前会话）：当前对话内容模型自己上下文里就有，
	 * 检索命中它只会把已有上下文抄一遍回来，还浪费一个命中名额。
	 */
	readonly excludeSessionId?: string;
}

/** JSONL 一行解析出的最小结构（只取检索要的字段，其余不碰）。 */
interface RawEntry {
	readonly type?: unknown;
	readonly timestamp?: unknown;
	readonly id?: unknown;
	readonly name?: unknown;
	readonly message?: {
		readonly role?: unknown;
		readonly content?: unknown;
	};
}

/**
 * 取一条 message 条目的可检索文本：user / assistant 的 text 块。
 * thinking 块不算——那是模型的内部推理，不是用户记得的「讨论内容」；
 * toolResult 等其他角色同理跳过。返回 undefined 表示该条目不参与检索。
 */
function entryText(entry: RawEntry): string | undefined {
	if (entry.type !== "message") return undefined;
	const message = entry.message;
	if (message === undefined) return undefined;
	if (message.role !== "user" && message.role !== "assistant") return undefined;
	const content = message.content;
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return undefined;
	let text = "";
	for (const block of content as readonly { type?: unknown; text?: unknown }[]) {
		if (block.type === "text" && typeof block.text === "string") text += block.text;
	}
	return text === "" ? undefined : text;
}

/** 从命中处向前后各取 SNIPPET_RADIUS 字符，越界侧不加省略号。 */
function extractSnippet(text: string, matchStart: number, matchEnd: number): string {
	const start = Math.max(0, matchStart - SNIPPET_RADIUS);
	const end = Math.min(text.length, matchEnd + SNIPPET_RADIUS);
	// 压平换行：片段最终排进给模型看的单段文本，原文换行只会把段落切碎。
	const body = text.slice(start, end).replace(/\s+/g, " ").trim();
	return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}

interface SessionFileHit {
	readonly sessionId: string;
	readonly title: string;
	/** 最早命中条目的文本与命中区间（用来截片段）。 */
	readonly text: string;
	readonly matchStart: number;
	readonly matchEnd: number;
}

/**
 * 在单个会话文件里找命中：全部关键词都出现（AND）的最早一条
 * user/assistant 文本条目。一个会话最多报一条命中——报的是「这个会话
 * 聊过这件事」，同一会话多个命中对模型是重复信息。
 * 找不到返回 null；文件损坏（非 JSONL / 缺头部）也返回 null（调用方记日志）。
 */
function searchOneFile(content: string, terms: readonly string[]): SessionFileHit | null {
	const lines = content.split("\n");
	let sessionId: string | undefined;
	let sawHeader = false;
	let name: string | undefined;
	let firstUserText = "";
	let hit: { text: string; matchStart: number; matchEnd: number } | undefined;

	for (const line of lines) {
		if (line.trim() === "") continue;
		let entry: RawEntry;
		try {
			entry = JSON.parse(line) as RawEntry;
		} catch {
			// 流式落盘被中断会留半行（pi 的 appendFileSync 不保证行原子）——跳过该行。
			continue;
		}
		if (!sawHeader) {
			// 首行必须是会话头（type: "session"），否则不是会话文件。
			if (entry.type !== "session" || typeof entry.id !== "string") return null;
			sawHeader = true;
			sessionId = entry.id;
			continue;
		}
		// 命名取最新一条 session_info（与 pi 的 SessionManager / 任务列表同口径）。
		if (entry.type === "session_info") {
			if (typeof entry.name === "string" && entry.name.trim() !== "") {
				name = entry.name.trim();
			} else {
				name = undefined;
			}
			continue;
		}
		const text = entryText(entry);
		if (text === undefined) continue;
		if (firstUserText === "" && entry.message?.role === "user") firstUserText = text;

		if (hit === undefined) {
			const lower = text.toLowerCase();
			let matchStart = Number.POSITIVE_INFINITY;
			let matchEnd = 0;
			let allFound = true;
			for (const term of terms) {
				const at = lower.indexOf(term);
				if (at === -1) {
					allFound = false;
					break;
				}
				matchStart = Math.min(matchStart, at);
				matchEnd = Math.max(matchEnd, at + term.length);
			}
			if (allFound) hit = { text, matchStart, matchEnd };
		}
	}

	if (!sawHeader || sessionId === undefined || hit === undefined) return null;
	return {
		sessionId,
		title: deriveSessionTitle(name, firstUserText),
		text: hit.text,
		matchStart: hit.matchStart,
		matchEnd: hit.matchEnd,
	};
}

/**
 * 检索会话库：按文件 mtime 倒序扫描最近 SCAN_LIMIT 个会话文件，
 * 返回最多 limit 条命中（顺序即新旧顺序）。
 *
 * 同步逐文件处理而不是并发：检索是有人值守会话里的一次性动作，
 * 早退（够 limit 就停）比并发吞吐重要 —— 排在前面的新会话命中最相关。
 */
export async function searchSessionFiles(
	query: string,
	limit: number,
	options: SearchSessionFilesOptions,
): Promise<ConversationSearchHit[]> {
	const terms = query.toLowerCase().split(/\s+/).filter((t) => t !== "");
	if (terms.length === 0 || limit <= 0) return [];

	// 只容忍「目录不存在」：首次使用还没有 sessions 目录是正常情况，检索为空。
	let fileNames: string[];
	try {
		fileNames = await readdir(options.sessionsDir);
	} catch (error) {
		if ((error as { code?: unknown }).code === "ENOENT") return [];
		throw error;
	}

	const candidates: { path: string; mtimeMs: number }[] = [];
	for (const name of fileNames) {
		if (!name.toLowerCase().endsWith(".jsonl")) continue;
		const path = join(options.sessionsDir, name);
		try {
			candidates.push({ path, mtimeMs: (await stat(path)).mtimeMs });
		} catch {
			// 与目录列举之间文件被移走（删除会话进 trash）——不是错误，跳过。
		}
	}
	candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);

	const hits: ConversationSearchHit[] = [];
	for (const candidate of candidates.slice(0, SCAN_LIMIT)) {
		if (hits.length >= limit) break;
		let content: string;
		try {
			content = await readFile(candidate.path, "utf8");
		} catch {
			// 扫描窗口内文件被移走/不可读：跳过这一个，检索不该为它整个失败。
			continue;
		}
		const found = searchOneFile(content, terms);
		if (found === null) continue;
		if (options.excludeSessionId !== undefined && found.sessionId === options.excludeSessionId) {
			continue;
		}
		hits.push({
			sessionId: found.sessionId,
			title: found.title,
			modifiedAt: candidate.mtimeMs,
			snippet: extractSnippet(found.text, found.matchStart, found.matchEnd),
		});
	}
	return hits;
}
