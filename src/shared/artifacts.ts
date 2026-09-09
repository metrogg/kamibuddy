/**
 * 产物与变更统计：写文件工具的真实行级 diff + 流式生成进度 + present_files 交付分类。
 *
 * 变更统计对齐 WorkBuddy 的 checkpoint 口径：不是从工具 args 数行
 * （write 全量覆写时旧文件行数全丢，removed 恒 0 是失真），而是
 * **执行前留旧内容、执行后做行级 LCS diff**（其 FileHistorySnapshot 同思路，
 * 见 07-artifact-preview.md §1 与 08-builtin-tools-reference.md）。
 *
 * 产物交付对齐 present_files 口径：模型显式调用工具交付产物，
 * UI 不从「write 成功」推导（交付意图与写盘动作是两回事 ——
 * 草稿、中间产物不该出现在产物清单里）。
 *
 * 行数口径：split("\n") 的段数（"a\nb" = 2 行）。diff 用 LCS（最长公共子序列），
 * 与 Myers 最小编辑距离在行级增删计数上等价（added = 新行数 - LCS，removed = 旧行数 - LCS）。
 */

import type { ConversationEntry } from "./session-events.ts";

/**
 * 预览面板的超大文件阈值（与 WorkBuddy 一致）：≥10MB 不预览，给占位 + 下载引导。
 * 只在整读进内存的文本分支强制执行（artifact-panel.tsx TextPreview）；
 * 图/视/音经静态服务流式加载，浏览器自己扛大文件，不重复设限。
 */
export const ARTIFACT_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;

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
	/**
	 * unified 风格的 hunk 文本（3 行上下文），只在 modified 且预算内产出 ——
	 * created 的 diff 就是全文（看文件本身更直接），超预算只有统计。
	 */
	readonly diff?: string;
}

/** 一个产物（本会话内经 present_files 交付的文件）。 */
export interface ArtifactRef {
	readonly path: string;
	/** 字节数。URL 或工作区外无法 stat 的路径为 0（不探测区外文件）。 */
	readonly size: number;
	readonly at: number;
}

/** present_files 交付清单里的一项（WorkBuddy present_files_result 的分类口径）。 */
export interface PresentedFile {
	/** 绝对路径或 http(s) URL。 */
	readonly path: string;
	/** 字节数；URL 与无法 stat 的为 0。 */
	readonly size: number;
	/** .html/.htm：产物卡 + 预览双路（其余只进产物卡）。 */
	readonly html: boolean;
	/** 分类标签：本地文件 / URL。 */
	readonly kind: "local" | "url";
}

/** 绝对路径判定（Windows 盘符 / UNC / posix）。hand-rolled：shared 会被 renderer 打包，不能 import node:path。 */
const ABSOLUTE_PATH = /^([a-zA-Z]:[\\/]|\\\\|\/)/;
const HTTP_URL = /^https?:\/\//i;
const HTML_FILE = /\.html?$/i;

/** sizeOf 的三态返回：不探测（区外/playground）→ "outside"；stat 失败（不存在/不可读）→ "missing"；成功 → 字节数。 */
export type SizeProbe = "outside" | "missing" | number;

/**
 * present_files 入参分类（WorkBuddy handler 同口径）：
 *   http(s) URL → kind "url"，size 恒 0；
 *   绝对路径    → kind "local"，sizeOf 探测；第一个本地文件自动打开预览（focusFile）；
 *   非绝对路径  → invalid，整单报错（"all entries must be absolute"）。
 * sizeOf 由调用方注入（daemon 用 statSync 并限定工作区），本函数保持纯。
 * missing：只有 sizeOf 返回 "missing"（工作区内 stat 失败）的本地文件进此列 ——
 * "outside"（不探测）与 URL 都不算缺失，避免误报误导模型。
 */
export function classifyPresentedFiles(
	input: readonly string[],
	sizeOf: (absPath: string) => SizeProbe,
): {
	readonly files: readonly PresentedFile[];
	readonly focusFile: string | undefined;
	readonly invalid: readonly string[];
	readonly missing: readonly string[];
} {
	const invalid: string[] = [];
	const missing: string[] = [];
	const files: PresentedFile[] = [];
	let focusFile: string | undefined;

	for (const raw of input) {
		if (HTTP_URL.test(raw)) {
			files.push({ path: raw, size: 0, html: false, kind: "url" });
			continue;
		}
		if (!ABSOLUTE_PATH.test(raw)) {
			invalid.push(raw);
			continue;
		}
		const probe = sizeOf(raw);
		if (probe === "missing") missing.push(raw);
		files.push({
			path: raw,
			size: probe === "outside" || probe === "missing" ? 0 : probe,
			html: HTML_FILE.test(raw),
			kind: "local",
		});
		// 顺序即推荐观看顺序，第一个本地文件自动打开（WorkBuddy：首位 = focusFile）。
		if (focusFile === undefined) focusFile = raw;
	}

	return { files, focusFile, invalid, missing };
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
	const r = computeLineDiff(oldText, newText);
	return { added: r.added, removed: r.removed };
}

export interface LineDiff {
	readonly added: number;
	readonly removed: number;
	/**
	 * unified 风格的 hunk 文本（3 行上下文）。超预算时为 undefined ——
	 * 统计照显，diff 视图给回落文案（WorkBuddy 的 diffStatus 同思路）。
	 */
	readonly diff?: string;
}

/** diff 视图的上下文行数（unified diff 惯例）。 */
const DIFF_CONTEXT = 3;

/**
 * 行级 diff：统计 + hunk 文本。
 * 统计用滚动数组（内存 O(min)）；hunk 需要回溯时才建全量表 ——
 * 同一预算上限，超过就只给统计（见 DIFF_CELL_BUDGET）。
 */
export function computeLineDiff(oldText: string, newText: string): LineDiff {
	const oldLines = oldText === "" ? [] : oldText.split("\n");
	const newLines = newText === "" ? [] : newText.split("\n");
	if (oldLines.length * newLines.length > DIFF_CELL_BUDGET) {
		return { added: newLines.length, removed: oldLines.length };
	}
	const common = lcsLength(oldLines, newLines);
	return {
		added: newLines.length - common,
		removed: oldLines.length - common,
		diff: buildHunks(oldLines, newLines),
	};
}

/** 全量 DP 回溯出操作序列（" "/" - "/"+"），再按上下文窗口收成 hunk。 */
function buildHunks(oldLines: readonly string[], newLines: readonly string[]): string {
	const m = oldLines.length;
	const n = newLines.length;
	// dp[i][j] = oldLines[i:] 与 newLines[j:] 的 LCS 长度（从右下角往左上填）。
	const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
	for (let i = m - 1; i >= 0; i -= 1) {
		for (let j = n - 1; j >= 0; j -= 1) {
			const skipOld = dp[i + 1]?.[j] ?? 0;
			const skipNew = dp[i]?.[j + 1] ?? 0;
			const both = dp[i + 1]?.[j + 1] ?? 0;
			const row = dp[i];
			if (row !== undefined) {
				row[j] = oldLines[i] === newLines[j] ? both + 1 : Math.max(skipOld, skipNew);
			}
		}
	}

	// 回溯：每个元素是 [行内容, 前缀]；前缀 " " 上下文、"-" 删除、"+" 新增。
	const ops: [string, " " | "-" | "+"][] = [];
	let i = 0;
	let j = 0;
	while (i < m && j < n) {
		if (oldLines[i] === newLines[j]) {
			ops.push([oldLines[i] ?? "", " "]);
			i += 1;
			j += 1;
		} else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
			ops.push([oldLines[i] ?? "", "-"]);
			i += 1;
		} else {
			ops.push([newLines[j] ?? "", "+"]);
			j += 1;
		}
	}
	while (i < m) {
		ops.push([oldLines[i] ?? "", "-"]);
		i += 1;
	}
	while (j < n) {
		ops.push([newLines[j] ?? "", "+"]);
		j += 1;
	}

	// 改动位置按间隔 > 2×上下文分组，每组前后各扩 DIFF_CONTEXT 行。
	const changeIdx: number[] = [];
	for (let k = 0; k < ops.length; k += 1) {
		if (ops[k]?.[1] !== " ") changeIdx.push(k);
	}
	if (changeIdx.length === 0) return ""; // 无改动（统计 0/0）
	const blocks: [number, number][] = [];
	let bs = changeIdx[0] ?? 0;
	let prev = bs;
	for (const idx of changeIdx) {
		if (idx - prev > DIFF_CONTEXT * 2) {
			blocks.push([bs, prev]);
			bs = idx;
		}
		prev = idx;
	}
	blocks.push([bs, prev]);

	const hunks: string[] = [];
	for (const [cs, ce] of blocks) {
		const start = Math.max(0, cs - DIFF_CONTEXT);
		const end = Math.min(ops.length - 1, ce + DIFF_CONTEXT);
		const slice = ops.slice(start, end + 1);
		const oldCount = slice.filter(([, p]) => p !== "+").length;
		const newCount = slice.filter(([, p]) => p !== "-").length;
		// 旧起始行号 = start 之前非 "+" 的行数 + 1；新起始行号同理。
		const oldStart = ops.slice(0, start).filter(([, p]) => p !== "+").length + 1;
		const newStart = ops.slice(0, start).filter(([, p]) => p !== "-").length + 1;
		hunks.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
		for (const [line, prefix] of slice) hunks.push(`${prefix}${line}`);
	}
	return hunks.join("\n");
}

/** 一次会话内的文件变更（按路径收拢后的展示记录）。 */
export interface ChangeRef extends FileChange {
	readonly at: number;
}

/**
 * 会话级「查看所有变更」：write/edit 成功卡片按路径收成一条
 * （WorkBuddy：Change 是 request 粒度，多轮改同一文件不能再展平）。
 * 生成中与失败的卡不算；同一路径多次改只留最后一次（文件的当前状态）。
 */
export function collectChanges(entries: readonly ConversationEntry[]): ChangeRef[] {
	const byPath = new Map<string, ChangeRef>();
	for (const entry of entries) {
		if (entry.role !== "tool") continue;
		if (entry.toolName !== "write" && entry.toolName !== "edit") continue;
		if (entry.outcome !== "ok" || entry.change === undefined) continue;
		byPath.set(entry.change.path, { ...entry.change, at: entry.at });
	}
	return [...byPath.values()].sort((a, b) => a.at - b.at);
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
 * diff 文本只在 modified 时产出：created 的 diff 就是全文，看文件本身更直接。
 */
export function changeFromWrite(args: unknown, oldContent: string | undefined): FileChange | undefined {
	if (typeof args !== "object" || args === null) return undefined;
	const { path, content } = args as Record<string, unknown>;
	if (typeof path !== "string" || typeof content !== "string") return undefined;
	if (oldContent === undefined) {
		return { path, added: countLines(content), removed: 0, changeType: "created" };
	}
	const { added, removed, diff } = computeLineDiff(oldContent, content);
	return { path, added, removed, changeType: "modified", ...(diff === "" ? {} : { diff }) };
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
		const { added, removed, diff } = computeLineDiff(oldContent as string, applied);
		return { path, added, removed, changeType: "modified", ...(diff === "" ? {} : { diff }) };
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
 * 产物清单折叠：present_files 是**唯一交付入口**（WorkBuddy 同口径，
 * UI 不猜、不扫目录）。多次调用按路径去重合并，后交付的排到末尾
 * （顺序 = 推荐观看顺序）。
 */
export function mergePresentedArtifacts(
	current: readonly ArtifactRef[],
	files: readonly PresentedFile[],
	at: number,
): ArtifactRef[] {
	const fresh = new Set(files.map((f) => f.path));
	const kept = current.filter((a) => !fresh.has(a.path));
	return [...kept, ...files.map((f) => ({ path: f.path, size: f.size, at }))];
}
