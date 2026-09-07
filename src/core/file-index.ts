/**
 * 输入框补全用的文件索引：扫描工作空间，返回相对路径列表。
 *
 * 纯 Node、可单测。刻意**不**做这几件事：
 *   - 不用 fd / 外部进程（AGENTS.md：一行 shell 都不许碰；pi-tui 那层因依赖
 *     fd 与本约定冲突，所以这里自写纯 JS）。
 *   - 不做模糊打分（那是 shared/autocomplete.ts 的 filterItems 的事，
 *     这里只负责把「有哪些文件」给全）。
 *   - 不递归进 node_modules / .git 这类目录（补全列表会被几万文件淹没）。
 *
 * 返回 posix 分隔的相对路径，方便和 `@` 插入的文本形式一致。
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** 不进入的目录名。 */
const SKIP_DIRS = new Set([
	"node_modules",
	".git",
	".hg",
	".svn",
	"out",
	"dist",
	"build",
	".next",
	".cache",
	"coverage",
]);

export interface IndexOptions {
	/** 最多返回多少条（防止超大目录撑爆 IPC 与下拉）。 */
	readonly maxEntries?: number;
	/** 递归深度上限。 */
	readonly maxDepth?: number;
}

/**
 * 扫描 root 下的文件，返回 posix 相对路径（已排序）。
 * root 不存在时返回空列表。
 */
export function indexFiles(root: string, options: IndexOptions = {}): readonly string[] {
	const maxEntries = options.maxEntries ?? 2000;
	const maxDepth = options.maxDepth ?? 8;

	let rootStat;
	try {
		rootStat = statSync(root);
	} catch {
		return [];
	}
	if (!rootStat.isDirectory()) return [];

	const out: string[] = [];
	const walk = (dir: string, depth: number): void => {
		if (out.length >= maxEntries || depth > maxDepth) return;
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return; // 无权限的目录跳过，不让单个坏目录毁掉整个索引
		}
		for (const entry of entries) {
			if (out.length >= maxEntries) return;
			if (entry.name.startsWith(".") && entry.name !== ".") continue;
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!SKIP_DIRS.has(entry.name)) walk(full, depth + 1);
			} else if (entry.isFile()) {
				out.push(relative(root, full).split("\\").join("/"));
			}
		}
	};
	walk(root, 0);
	return out.sort();
}
