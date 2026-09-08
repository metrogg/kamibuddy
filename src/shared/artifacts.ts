/**
 * 产物与变更统计：从写文件工具的参数算 +/- 行数，从会话历史聚合产物清单。
 *
 * WorkBuddy 靠 CLI 内核的 checkpoint/fileChanges 记录 diff（07-artifact-preview.md §1），
 * pi 没有这层——但 pi 的 tool_execution_start 带完整 args（write 的 content、
 * edit 的 edits[{oldText,newText}]），行数直接算得出来，不需要文件系统历史。
 *
 * 产物采用**推导**而非 WorkBuddy 的 present_files 显式交付：
 * write 成功 = 产物。模型不需要多调一个工具，规则也没有歧义。
 *
 * 行数口径：split("\n") 的段数（"a\nb" = 2 行）。是展示用估算，不做 diff 级精确。
 */

import type { ConversationEntry } from "./session-events.ts";

/** 一次写文件操作的增删行统计。 */
export interface FileChange {
	readonly path: string;
	readonly added: number;
	readonly removed: number;
}

/** 一个产物（本会话内 write 成功的文件）。 */
export interface ArtifactRef {
	readonly path: string;
	readonly at: number;
}

function countLines(text: string): number {
	if (text === "") return 0;
	return text.split("\n").length;
}

/** JSON 字符串片段的反转义（只处理常见转义，路径场景够用）。 */
function unescapeJsonString(fragment: string): string {
	return fragment.replace(/\\(.)/g, (_m, ch: string) => {
		if (ch === "n") return "\n";
		if (ch === "t") return "\t";
		if (ch === "r") return "\r";
		return ch; // \" \\ \/ 等
	});
}

/**
 * write 工具调用参数**流式生成中**的进度：从累积的 partialJson 里
 * 抠出已完整的 path 和 content 片段的当前行数。
 *
 * 为什么能这么做：模型写文件时 content 是逐 token 流出的 JSON 字符串
 * （pi 的 toolcall_delta），真实换行在 JSON 里是 `\n` 两字符序列 ——
 * 数它就能实时给出「生成中 +N」的行数（WorkBuddy 的生成中计数同口径）。
 *
 * path 必须等到闭合引号才返回：半截路径显示出来既是错的也像 bug。
 */
export function writeStreamProgress(rawArgs: string): {
	readonly path: string | undefined;
	readonly added: number;
} {
	const pathMatch = /"path"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(rawArgs);
	const path = pathMatch?.[1] === undefined ? undefined : unescapeJsonString(pathMatch[1]);

	// content 不要求闭合：它通常还在流式中，抓到哪算哪。
	const contentMatch = /"content"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(rawArgs);
	const fragment = contentMatch?.[1] ?? "";
	// 数 JSON 里的字面 \n（两字符）：content 非空时行数 = \n 数 + 1。
	const newlines = (fragment.match(/\\n/g) ?? []).length;
	const added = fragment === "" ? 0 : newlines + 1;

	return { path, added };
}

/** write 工具参数 → 变更统计。形状不符返回 undefined（pi 的 args 是 any，窄化失败不猜）。 */
export function changeFromWriteArgs(args: unknown): FileChange | undefined {
	if (typeof args !== "object" || args === null) return undefined;
	const { path, content } = args as Record<string, unknown>;
	if (typeof path !== "string" || typeof content !== "string") return undefined;
	// write 是全量覆写：旧内容无从得知，removed 恒 0（编辑走 edit 工具，有 oldText 可算）。
	return { path, added: countLines(content), removed: 0 };
}

/** edit 工具参数 → 变更统计：added/removed 是各 edit 段 newText/oldText 的行数之和。 */
export function changeFromEditArgs(args: unknown): FileChange | undefined {
	if (typeof args !== "object" || args === null) return undefined;
	const { path, edits } = args as Record<string, unknown>;
	if (typeof path !== "string" || !Array.isArray(edits)) return undefined;

	let added = 0;
	let removed = 0;
	for (const edit of edits) {
		if (typeof edit !== "object" || edit === null) return undefined;
		const { oldText, newText } = edit as Record<string, unknown>;
		if (typeof oldText !== "string" || typeof newText !== "string") return undefined;
		removed += countLines(oldText);
		added += countLines(newText);
	}
	return { path, added, removed };
}

/**
 * 从会话历史聚合产物清单：write 且执行成功的工具卡片。
 * 同一路径多次写只保留最后一次（产物是文件的当前状态，不是写入历史）。
 * 返回按最后写入时间升序。
 */
export function collectArtifacts(entries: readonly ConversationEntry[]): ArtifactRef[] {
	const byPath = new Map<string, ArtifactRef>();
	for (const entry of entries) {
		if (entry.role !== "tool") continue;
		if (entry.toolName !== "write" || entry.outcome !== "ok" || entry.change === undefined) {
			continue;
		}
		byPath.set(entry.change.path, { path: entry.change.path, at: entry.at });
	}
	return [...byPath.values()].sort((a, b) => a.at - b.at);
}
