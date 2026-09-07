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
