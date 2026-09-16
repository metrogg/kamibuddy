/**
 * 会话归档索引（~/.kamibuddy/archive.json）的读写。
 *
 * 归档是**纯元数据**：会话文件原地不动，只记「path → 归档时刻」。
 * 这样 resume / delete / 导出等既有路径零改动（同文件单写者不变式不碰），
 * 取消归档也只是删一行索引 —— WB 同语义「归档 ≠ 删除，历史仍可查」。
 *
 * 键用会话文件**绝对路径**（与 SessionSummary.path / byFile 的 resolve 口径
 * 一致）：列表按路径定位，重命名会话文件后路径变 —— 索引里旧键自然失配
 * （表现为该会话回到未归档态），可接受；rename 通道联动清理是过度设计。
 *
 * 手法与 automation-store 一致：内存缓存 + 原子落盘（tmp + rename）；
 * 但坏了**当空**而不是抛错 —— 归档是可重做的标记（重新归一次即可），
 * 抛错炸掉整个会话列表得不偿失（与 preferences 同口径，与 automation-store
 * 相反是有意的：那边是业务数据，这边是视图状态）。
 *
 * 不 import pi 与 electron，纯 fs + JSON，可单测（AGENTS.md §1）。
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { getArchiveFile } from "./config-paths.ts";

export class SessionArchive {
	private index: Map<string, number> = new Map();
	private loaded = false;

	constructor(private readonly filePath: string = getArchiveFile()) {}

	/** 加载。文件不存在 / JSON 损坏 / 结构不符一律当空索引（理由见文件头）。 */
	private ensureLoaded(): void {
		if (this.loaded) return;
		try {
			const raw = readFileSync(this.filePath, "utf8");
			const parsed: unknown = JSON.parse(raw);
			if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
				for (const [path, at] of Object.entries(parsed as Record<string, unknown>)) {
					if (typeof at === "number" && Number.isFinite(at)) this.index.set(path, at);
				}
			}
		} catch {
			this.index = new Map();
		}
		this.loaded = true;
	}

	/** 是否已归档（未归档 / 从未归档过都是 false）。 */
	isArchived(path: string): boolean {
		this.ensureLoaded();
		return this.index.has(path);
	}

	/** 归档时刻；未归档为 undefined（列表排序可用）。 */
	archivedAt(path: string): number | undefined {
		this.ensureLoaded();
		return this.index.get(path);
	}

	/** 归档 / 取消归档，随即原子落盘。幂等：状态不变时不落盘。 */
	setArchived(path: string, archived: boolean, now: number): void {
		this.ensureLoaded();
		if (archived) {
			if (this.index.has(path)) return;
			this.index.set(path, now);
		} else {
			if (!this.index.delete(path)) return;
		}
		this.persist();
	}

	private persist(): void {
		mkdirSync(dirname(this.filePath), { recursive: true });
		const tmp = `${this.filePath}.tmp`;
		writeFileSync(
			tmp,
			`${JSON.stringify(Object.fromEntries(this.index), null, 2)}\n`,
			"utf8",
		);
		renameSync(tmp, this.filePath);
	}
}
