/**
 * worktree 任务隔离的契约与纯函数。
 *
 * 机制对标 WorkBuddy 桌面端的 `WorktreeTaskDomain`（证据：
 * `docs/WorkBuddy-reference/extracted/main/server.js` 的 createWorktreeTaskService，
 * 以及 renderer 侧 `sceneMode === "code" && cwd` 的芯片门控，见对齐清单 L27 / C22）。
 * 核心语义：代码场景下每个任务跑在一份独立的 git worktree 副本里，
 * **不直接改用户的主仓库**。
 *
 * 放 shared/ 的理由与 conversation.ts 相同：命名规则与校验两端都要用
 *（daemon 建副本、renderer 显示分支名），各写一份必然漂移，而症状是
 * 「界面显示的分支和实际建出来的不是同一个」—— 这种漂移不报错，只是悄悄错。
 *
 * 本文件是**纯函数与类型**，不碰 node:fs / node:child_process（AGENTS.md §1：
 * shared 零运行时依赖，谁都可以 import）。真正的 git 调用在 core/worktree.ts。
 */

/**
 * 副本根目录名（挂在用户配置目录下，与 sessions / memory 同级）。
 * 不放进工作空间目录内：副本是任务的临时产物，混进用户的项目目录会污染
 * 他们的 git status 与编辑器索引。
 */
export const WORKTREE_DIR_NAME = "worktrees";

/**
 * 任务分支前缀。清理逻辑只删这个前缀的分支 —— 用户自己建的分支
 * 即使出现在副本目录里也不动（副本内的分支不都是我们建的）。
 */
export const TASK_BRANCH_PREFIX = "workbuddy/";

/**
 * 副本信息。
 *
 * baseBranch / sourceCwd 可选的理由：resume 一个历史会话时，daemon 只能从
 * 会话 cwd（就是副本路径）反推身份，而副本目录名里的 slug 是**不可逆**的清洗
 * 结果（`origin/main` 与 `origin-main` 都变成 `origin-main`），原仓库路径更是
 * 完全不在里面。此时只还原得出版本路径与任务分支名，那两个字段留缺省 ——
 * 界面显示「这份副本在哪个分支上」不需要它们，硬凑一个假的基准分支才是错的。
 */
export interface WorktreeInfo {
	/** 副本目录绝对路径（会话 cwd 就是它）。 */
	readonly worktreePath: string;
	/** 任务分支名，形如 `workbuddy/<slug>-<uid8>`。可从目录名反推（＝前缀＋目录名）。 */
	readonly taskBranch: string;
	/** 基准分支（副本从它切出）。resume 重建的精简版缺省。 */
	readonly baseBranch?: string;
	/** 原仓库目录绝对路径。UI 用它显示「来自哪个仓库」。resume 重建的精简版缺省。 */
	readonly sourceCwd?: string;
}

/** 仓库状态。chip 用它决定显不显示、要不要提示脏工作区。 */
export interface WorktreeRepoStatus {
	readonly isGitRepo: boolean;
	/** 当前检出分支；detached HEAD 时为 undefined（不是错误，如实反映）。 */
	readonly currentBranch: string | undefined;
	/** 有无未提交改动。切分支与清理两道门的判据。 */
	readonly hasUncommittedChanges: boolean;
}

/** 分支列表。非 git 仓库时 branches 为空、isGitRepo 为 false（不是错误）。 */
export interface WorktreeBranchList {
	readonly isGitRepo: boolean;
	readonly branches: readonly string[];
	readonly currentBranch: string | undefined;
}

/** 本分支是否是我们建的任务分支（清理与展示的判据）。 */
export function isTaskBranch(branch: string): boolean {
	return branch.startsWith(TASK_BRANCH_PREFIX);
}

/**
 * 分支名 → 文件系统安全的 slug（`origin/main` → `origin-main`）。
 *
 * 与 WorkBuddy 的 slugifyBranch 同规则：小写化 → 非 `[a-z0-9]` 全转 `-`
 * → 去首尾 `-`。全被吃掉时回落 `worktree`：否则纯中文/纯符号的分支名会拼出
 * `workbuddy/-a1b2c3d4` 这种以 `-` 开头、git 直接拒收的退化名。
 */
export function slugifyBranch(branch: string): string {
	const slug = branch
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug === "" ? "worktree" : slug;
}

/**
 * 生成 8 位十六进制的短 id。
 *
 * 存在的理由：同一基准分支会并发建多个副本（用户连开几个任务都基于 main），
 * 纯 slug 必然撞名（目录与分支都会冲突）。WorkBuddy 用 randomUUID 截 8 位，
 * 我们用等长同形的生成方式，但把随机源做成参数 —— 这条规则要能被单测钉住。
 */
export function generateWorktreeUid(rand: () => number = Math.random): string {
	return Math.floor(rand() * 0x100000000)
		.toString(16)
		.padStart(8, "0")
		.slice(0, 8);
}

/** 分支 id：`<基准分支 slug>-<uid8>`。同时作副本的目录名（WorkBuddy 同构）。 */
export function buildBranchId(baseBranch: string, uid: string): string {
	return `${slugifyBranch(baseBranch)}-${uid}`;
}

/** 任务分支名：`workbuddy/<分支 id>`。 */
export function buildTaskBranch(baseBranch: string, uid: string): string {
	return `${TASK_BRANCH_PREFIX}${buildBranchId(baseBranch, uid)}`;
}

/**
 * 由副本目录名（它就是分支 id）反推任务分支名 —— 前缀拼目录名即可。
 * resume 重建副本身份时走这条（目录名是唯一还留在会话数据里的线索）。
 */
export function taskBranchFromBranchId(branchId: string): string {
	return `${TASK_BRANCH_PREFIX}${branchId}`;
}

/**
 * 取原仓库目录名并清洗为文件系统安全名（副本按仓库分目录的第一段）。
 *
 * 不复用 renderer/workspace-picker.tsx 的 baseName：那个只取末段、用于展示，
 * 这里还要清掉 Windows 非法字符（`< > : " / \ | ? *` 与控制字符），
 * 目标不同 —— 一个是给人看的，一个是给文件系统用的。
 */
export function repoDirName(repoCwd: string): string {
	const trimmed = repoCwd.replace(/[/\\]+$/, "");
	const at = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
	const base = at === -1 ? trimmed : trimmed.slice(at + 1);
	const safe = base.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
	return safe === "" ? "workspace" : safe;
}

/**
 * 校验并规范化 repoCwd 入参。非字符串、空串、相对路径一律抛错。
 *
 * 为什么必须绝对路径：副本目录由它派生，相对路径会随 daemon 的进程 cwd 漂移 ——
 * 同一份配置在不同启动方式下指向不同仓库，且不报错（WorkBuddy 的 handler 同样
 * 强制绝对路径，见 parseCreateWorktreeParams）。响亮拒绝好过静默错位。
 */
export function requireRepoCwd(value: unknown): string {
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error("repoCwd 必须是非空字符串");
	}
	if (!isAbsolutePath(value)) throw new Error(`repoCwd 必须是绝对路径：${value}`);
	return value;
}

/**
 * 校验基准分支名。空串、含 git 非法字符、以 `-` 开头一律抛错。
 *
 * 非法字符表按 git check-ref-format 的约束取常用子集（空格 ~ ^ : ? * [ \ 及
 * 控制字符）；不做全量实现 —— 漏网的会由 git 自己拒绝并原样回传错误，
 * 这里的职责是拦住**明显的注入形态**（如把 `; rm -rf` 塞进分支名）。
 */
export function requireBranchName(value: unknown): string {
	if (typeof value !== "string" || value.trim() === "") {
		throw new Error("分支名必须是非空字符串");
	}
	const name = value.trim();
	if (name.startsWith("-")) throw new Error(`分支名不能以 - 开头：${name}`);
	if (/[\s~^:?*[\\\u0000-\u001F]/.test(name)) {
		throw new Error(`分支名含非法字符：${name}`);
	}
	if (name.endsWith("/") || name.endsWith(".lock") || name.includes("..")) {
		throw new Error(`分支名形态非法：${name}`);
	}
	return name;
}

/**
 * 绝对路径判定（Windows 与 POSIX 都要认）。
 * 不用 node:path.isAbsolute：shared 不许引 node（renderer 也要跑这个文件）。
 */
export function isAbsolutePath(path: string): boolean {
	if (path.startsWith("/")) return true;
	// Windows 盘符绝对路径（C:\ 或 C:/）。只认单字母盘符 —— UNC 路径
	// （\\server\share）刻意不支持：副本建在网络盘上既慢又难清理。
	return /^[a-zA-Z]:[/\\]/.test(path);
}
