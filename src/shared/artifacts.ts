/**
 * 产物与变更统计：写文件工具的真实行级 diff + 流式生成进度 + 产物清单聚合。
 *
 * 变更统计对齐 WorkBuddy 的 checkpoint 口径：不是从工具 args 数行
 * （write 全量覆写时旧文件行数全丢，removed 恒 0 是失真），而是
 * **执行前留旧内容、执行后做行级 LCS diff**（其 FileHistorySnapshot 同思路，
 * 见 07-artifact-preview.md §1 与 08-builtin-tools-reference.md）。
 *
 * 产物采用**推导**而非 WorkBuddy 的 present_files 显式交付（历史决策，见
 * collectArtifacts 注释；显式交付工具落地后这里会切换口径）。
 *
 * 行数口径：split("\n") 的段数（"a\nb" = 2 行）。diff 用 LCS（最长公共子序列），
 * 与 Myers 最小编辑距离在行级增删计数上等价（added = 新行数 - LCS，removed = 旧行数 - LCS）。
 */

import type { ConversationEntry } from "./session-events.ts";

/** 一次写文件操作的增删行统计。 */
export interface FileChange {
	readonly path: string;
	readonly added: number;
	readonly removed: number;
	/**
	 * created = 新文件；modified = 覆盖/编辑已有文件（WorkBuddy fileChangeInfo.changeType）。
	 * 决定卡片标签（已生成/已修改）与「查看所有变更」的归类。
	 */
	readonly changeType: "created" | "modified";
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

/**
 * LCS 动态规划的计算预算（旧行数 × 新行数的上限）。
 * 2000×2000 = 4M 格在现代机器上毫秒级；超过就退化为全量口径，
 * 宁可数字变粗也不能让一次大文件覆写卡住事件流。
 */
const DIFF_CELL_BUDGET = 4_000_000;

/** 行级 LCS 长度（滚动数组，内存 O(min(m,n))）。 */
function lcsLength(oldLines: readonly string[], newLines: readonly string[]): number {
	// 让 b 始终是较短的那个，滚动数组长度 = b.length + 1。
	const [a, b] = oldLines.length >= newLines.length ? [oldLines, newLines] : [newLines, oldLines];
	let prev = new Array<number>(b.length + 1).fill(0);
	for (let i = 1; i <= a.length; i += 1) {
		const curr = new Array<number>(b.length + 1).fill(0);
		const ai = a[i - 1];
		for (let j = 1; j <= b.length; j += 1) {
			const diag = prev[j - 1] ?? 0;
			curr[j] = ai === b[j - 1] ? diag + 1 : Math.max(prev[j] ?? 0, curr[j - 1] ?? 0);
		}
		prev = curr;
	}
	return prev[b.length] ?? 0;
}

/**
 * 行级增删统计（WorkBuddy additions/deletions 口径）：
 * 公共行（LCS）不算增删；added = 新行数 - LCS，removed = 旧行数 - LCS。
 */
export function diffLineStats(
	oldText: string,
	newText: string,
): { readonly added: number; readonly removed: number } {
	const oldLines = oldText === "" ? [] : oldText.split("\n");
	const newLines = newText === "" ? [] : newText.split("\n");
	if (oldLines.length * newLines.length > DIFF_CELL_BUDGET) {
		return { added: newLines.length, removed: oldLines.length };
	}
	const common = lcsLength(oldLines, newLines);
	return { added: newLines.length - common, removed: oldLines.length - common };
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

/**
 * write 工具参数 + 执行前的旧内容 → 变更统计。
 * oldContent === undefined 表示目标文件原本不存在（新建）；
 * 形状不符返回 undefined（pi 的 args 是 any，窄化失败不猜）。
 */
export function changeFromWrite(args: unknown, oldContent: string | undefined): FileChange | undefined {
	if (typeof args !== "object" || args === null) return undefined;
	const { path, content } = args as Record<string, unknown>;
	if (typeof path !== "string" || typeof content !== "string") return undefined;
	if (oldContent === undefined) {
		return { path, added: countLines(content), removed: 0, changeType: "created" };
	}
	const { added, removed } = diffLineStats(oldContent, content);
	return { path, added, removed, changeType: "modified" };
}

/** 把 edit 的 edits 依次应用到旧内容上；任一 oldText 找不到则返回 undefined（对不上就不猜）。 */
function applyEdits(oldContent: string, edits: readonly { oldText: string; newText: string }[]): string | undefined {
	let content = oldContent;
	for (const { oldText, newText } of edits) {
		const at = content.indexOf(oldText);
		if (at === -1) return undefined;
		content = content.slice(0, at) + newText + content.slice(at + oldText.length);
	}
	return content;
}

/**
 * edit 工具参数 + 执行前的旧内容 → 变更统计（恒 modified）。
 * 旧内容可用且 edits 全部能对上 → 真实 diff；否则退化为 oldText/newText 行数求和。
 */
export function changeFromEdit(args: unknown, oldContent: string | undefined): FileChange | undefined {
	if (typeof args !== "object" || args === null) return undefined;
	const { path, edits } = args as Record<string, unknown>;
	if (typeof path !== "string" || !Array.isArray(edits)) return undefined;

	const pairs: { oldText: string; newText: string }[] = [];
	for (const edit of edits) {
		if (typeof edit !== "object" || edit === null) return undefined;
		const { oldText, newText } = edit as Record<string, unknown>;
		if (typeof oldText !== "string" || typeof newText !== "string") return undefined;
		pairs.push({ oldText, newText });
	}

	const applied = oldContent === undefined ? undefined : applyEdits(oldContent, pairs);
	if (applied !== undefined) {
		const { added, removed } = diffLineStats(oldContent as string, applied);
		return { path, added, removed, changeType: "modified" };
	}

	let added = 0;
	let removed = 0;
	for (const { oldText, newText } of pairs) {
		removed += countLines(oldText);
		added += countLines(newText);
	}
	return { path, added, removed, changeType: "modified" };
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
