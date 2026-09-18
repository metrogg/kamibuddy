/**
 * 会话可见性判定（头部扫描）：哪些会话文件**不是用户的会话**，不进侧栏。
 *
 * 从 daemon/index.ts 抽出以便单测 —— 该文件顶层 `requireParentPort()` 在非
 * utilityProcess 环境 import 即抛（同 workspace-model.ts / conversation-search.ts
 * 的抽法）。这里承载「扫头部取标记 / 标记 → 可见性」两步纯逻辑，daemon 只接线。
 *
 * ## 两类被隐藏的会话
 *
 * 1. **子代理 / 成员 run**：`markSubagentRun` 写的 `subagent_run` custom 条目
 *    此前唯一消费方是 usage-stats，列表链路没接 —— 子代理会话混进侧栏曾是
 *    现行 bug（spec: add-team-foundations）。
 * 2. **内置任务的运行会话**（当前只有「记忆整理」）：它借自动化壳子跑，但
 *    **不是用户的任务**。
 *
 * ## 第 2 类为什么要隐藏（本模块存在的直接理由）
 *
 * 它此前同时混进用户可见的两处：
 *   - 「自动化」页的任务列表（带「内置」徽章、编辑/删除禁用）—— 已在
 *     renderer 侧过滤掉；
 *   - 侧栏**空间区的假工作空间**：其 cwd = 配置目录（`builtin-memory-task.ts`
 *     的 `cwd: getConfigDir()`），而配置目录**既不命中任何任务私有形态**
 *     （`isTaskPrivateCwd` 认的是自动目录 / 历史临时目录 / 旧 playground /
 *     worktree），于是 `isTempTask` 为假 → `listWorkspaceGroups` 把它当用户
 *     经营的空间收进去，**凭空长出一个叫 `.kamibuddy` 的空间组**，每晚多一条。
 *
 * 判定用会话文件里**已有**的 `automation_run` 溯源条目（写入点
 * automation-runner 的 `markAutomationRun`）与自动化库的 `builtin` 标记求交：
 * 读取侧过滤、**不改运行链路**，因此存量会话一并被收拾，不需要数据迁移。
 *
 * ## 横向对照（为什么不是别的做法）
 *
 * - **WorkBuddy 并没有这层隐藏**：它的自动化运行同样建成真会话、同样按 cwd
 *   进侧栏空间组（`isBackgroundAutomation` 不进侧栏过滤）。但它**永远不把 cwd
 *   设成配置目录** —— cwd 为空时自动建 `<默认工作空间根>/automation-<时间戳>`
 *   （`docs/WorkBuddy-reference/extracted/main/server.js:74697`），侧栏再把这类
 *   目录显示成友好名「自动化任务-{时间段}」（同包 renderer
 *   `ui-docs-viewer-*.js:113902` 的 `formatAutomationCwdLabel`）。
 *   我们的 `.kamibuddy` 假空间是「拿配置目录当自动化归属」的直接后果。
 * - 照它那套（给自动化一个真目录 + 友好显示名）是**另一条同样成立的路**，
 *   但那是改运行链路的落点、动的是数据，不解决存量会话；本模块走读取侧过滤，
 *   与内置任务「只该在设置里可见」的产品口径一致（见 docs/ARCHITECTURE.md
 *   决策段「记忆整理借壳自动化的分离」）。
 */

import { closeSync, openSync, readSync, statSync } from "node:fs";

/** 子代理/成员会话的溯源条目类型（写入点：session-host 的 mark*Run 系列）。 */
const CHILD_SESSION_CUSTOM_TYPES: ReadonlySet<string> = new Set(["subagent_run", "team_member"]);

/** 自动化运行会话的溯源条目类型（写入点：automation-runner 的 markAutomationRun）。 */
const AUTOMATION_RUN_CUSTOM_TYPE = "automation_run";

/**
 * 头部扫描窗口。标记在会话建立后、任何 message 之前写入（markSubagentRun /
 * markAutomationRun 紧跟 SessionHost.create，pi 只追加条目从不重写文件），
 * 所以首条 message 之前必然扫到或不复存在 —— 64KB 只是个宽松上界，不为
 * correctness 服务。
 *
 * 实测（真实会话文件）：两个「记忆整理」会话的 `automation_run` 条目都在
 * 文件第 4 行（索引 3）、首条 message 在第 5 行（索引 4）。
 */
const SESSION_HEAD_BYTES = 64 * 1024;

/**
 * 头部扫描的**原始标记**（不含「算不算内部」的判断）。
 *
 * 为什么只缓存原始标记、不缓存最终布尔值：最终判定要拿 automation taskId 与
 * 自动化库的 builtin 集合求交，而那个集合会随任务增删而变。若把布尔值按
 * (path, mtime, size) 缓存，用户在设置里停用/删除内置任务后缓存不会失效，
 * 判定就永久停在旧结论。原始标记只依赖文件自身，缓存是安全的。
 */
export interface SessionHeadMarkers {
	/** 命中子代理/成员溯源条目。 */
	readonly childSession: boolean;
	/** `automation_run` 条目里的 taskId（非自动化会话为 undefined）。 */
	readonly automationTaskId: string | undefined;
}

/** (path, mtimeMs, size) → 头部标记：列表刷新期间反复扫大文件是纯浪费。 */
const sessionHeadMemo = new Map<string, SessionHeadMarkers>();

/** 防长尾膨胀的缓存上界；超限整表清空（全量重扫代价可接受）。 */
const MEMO_LIMIT = 4096;

/** 无标记的常量值，避免每次新建对象（同时让「读不到」与「没有标记」同形）。 */
const NO_MARKERS: SessionHeadMarkers = { childSession: false, automationTaskId: undefined };

/**
 * 扫会话文件头部取标记。
 *
 * 文件读不到（已删除 / 无权限）一律按「无标记」处理：判定失败不该让会话从
 * 列表里消失 —— 那比混入更难排查（用户看到的是「历史丢了」）。
 */
export function readSessionHeadMarkers(filePath: string): SessionHeadMarkers {
	let mtimeMs = 0;
	let size = 0;
	try {
		const stats = statSync(filePath);
		mtimeMs = stats.mtimeMs;
		size = stats.size;
	} catch {
		return NO_MARKERS;
	}
	const memoKey = `${filePath}\u0000${mtimeMs}\u0000${size}`;
	const memoed = sessionHeadMemo.get(memoKey);
	if (memoed !== undefined) return memoed;

	const markers: { childSession: boolean; automationTaskId: string | undefined } = {
		childSession: false,
		automationTaskId: undefined,
	};
	const fd = openSync(filePath, "r");
	try {
		const buffer = Buffer.alloc(Math.min(SESSION_HEAD_BYTES, size));
		const bytes = readSync(fd, buffer, 0, buffer.length, 0);
		for (const line of buffer.toString("utf8", 0, bytes).split("\n")) {
			if (line.trim() === "") continue;
			let entry: unknown;
			try {
				entry = JSON.parse(line);
			} catch {
				continue; // 半行（窗口截断）/坏行跳过
			}
			if (typeof entry !== "object" || entry === null) continue;
			const record = entry as { type?: unknown; customType?: unknown; data?: unknown };
			if (record.type === "custom") {
				if (typeof record.customType === "string") {
					if (CHILD_SESSION_CUSTOM_TYPES.has(record.customType)) {
						markers.childSession = true;
					} else if (record.customType === AUTOMATION_RUN_CUSTOM_TYPE) {
						const data = record.data as { taskId?: unknown } | undefined;
						if (typeof data?.taskId === "string") markers.automationTaskId = data.taskId;
					}
				}
				continue; // 其他 custom 条目（如 artifacts_presented）不判定，继续扫
			}
			/*
			 * 首条 message 之后标记不可能再出现（写入时序不变量），短路 ——
			 * 「会话很长」因此不影响本函数的代价。注意这个短路对两类标记都
			 * 成立的前提是「标记先于首条 message 落盘」，见 SESSION_HEAD_BYTES。
			 */
			if (record.type === "message") break;
		}
	} finally {
		closeSync(fd);
	}
	if (sessionHeadMemo.size > MEMO_LIMIT) sessionHeadMemo.clear();
	sessionHeadMemo.set(memoKey, markers);
	return markers;
}

/**
 * 会话文件是否「内部会话」—— 不进侧栏（任务区与空间区都不进）。
 *
 * `builtinTaskIds` 由调用方从自动化库现读（`builtin` 标记的任务 id），
 * 本模块不 import 自动化库：库的装载时机归 daemon 装配，这里只收一个集合，
 * 于是「哪些任务算内置」的口径只有仓库一处（shared/automation.ts 的字段）。
 */
export function isInternalSessionFile(
	filePath: string,
	builtinTaskIds: ReadonlySet<string>,
): boolean {
	const markers = readSessionHeadMarkers(filePath);
	if (markers.childSession) return true;
	return markers.automationTaskId !== undefined && builtinTaskIds.has(markers.automationTaskId);
}
