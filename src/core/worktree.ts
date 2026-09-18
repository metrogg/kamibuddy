/**
 * git worktree 副本的创建、删除与清理。
 *
 * 机制对标 WorkBuddy 的 `WorktreeTaskDomain`（证据：
 * `docs/WorkBuddy-reference/extracted/main/server.js` 的 createWorktreeTaskService）。
 * 语义是「每个任务跑在自己的副本里，不碰用户的主仓库」——代码场景下
 * 这是让 agent 敢于动手改文件的前提。
 *
 * 为什么直调 git CLI 而不是引一个 git 库：我们只用到 worktree add/remove/list
 * 与 status 四条命令，语料简单、无跨版本兼容需求（AGENTS.md §1 的「能借力就
 * 借力」在这里的最优解是借 git 自己 —— 它才是唯一权威实现）。引 nodegit /
 * simple-git 反而要背原生模块 ABI 与依赖升级的账。
 *
 * **不 import pi / electron**（AGENTS.md §1），纯 Node，可脱离宿主单测
 * （测试用临时目录建真仓库跑真命令，不 mock git）。
 */

import { execFile } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { getConfigDir } from "./config-paths.ts";
import {
	buildBranchId,
	buildTaskBranch,
	generateWorktreeUid,
	isTaskBranch,
	repoDirName,
	taskBranchFromBranchId,
	WORKTREE_DIR_NAME,
	type WorktreeBranchList,
	type WorktreeInfo,
	type WorktreeRepoStatus,
} from "../shared/worktree.ts";

/** 单条 git 命令的 stdout 缓冲上限。worktree list 在副本极多时才可能变大。 */
const MAX_BUFFER = 8 * 1024 * 1024;

/** 一天毫秒数（清理的年龄判据）。 */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 副本根目录：`<配置目录>/worktrees`。
 *
 * 不放进工作空间目录：副本是任务临时产物，混进用户项目会被他们的编辑器索引
 * 与 `git status` 看见（虽然 git 会忽略 worktree 内部，但目录本身会被工具扫到）。
 * 与 sessions / memory 同级，则「配置目录即应用私有数据」这条线保持一致。
 */
export function getWorktreeRoot(): string {
	return join(getConfigDir(), WORKTREE_DIR_NAME);
}

interface GitOutcome {
	readonly ok: boolean;
	readonly stdout: string;
	readonly stderr: string;
}

/**
 * 跑一条 git 命令，**不抛错**：返回 ok 让调用方自己决定。
 *
 * 必须有不抛错的形态：`isGitRepo` 在非仓库目录上失败是**正常路径**
 * （用户选了个普通文件夹），把它变成异常会让 chip 每次打开都弹一个错。
 * 真正异常的命令（add / remove）用下面的 runGit 抛。
 *
 * 固定 `-c core.quotepath=false`：中文路径默认会被 git 转义成 `\344\275...`。
 * 与编码无关（那要另设 i18n.logOutputEncoding），但不清掉的话
 * 分支名/路径里的非 ASCII 一律是乱码，界面直接不可用。
 */
function gitOutcome(args: readonly string[], cwd: string): Promise<GitOutcome> {
	return new Promise((resolve) => {
		execFile(
			"git",
			["-c", "core.quotepath=false", ...args],
			{ cwd, windowsHide: true, maxBuffer: MAX_BUFFER, encoding: "utf8" },
			(error, stdout, stderr) => {
				if (error !== null) {
					resolve({ ok: false, stdout: "", stderr: stderr === "" ? error.message : stderr });
					return;
				}
				resolve({ ok: true, stdout, stderr });
			},
		);
	});
}

/**
 * 跑一条 git 命令，失败即抛错，错因带 git 自己的 stderr。
 *
 * 为什么把 stderr 原样带进 message：git 的错误信息本身可执行
 *（「fatal: a branch named 'x' already exists」直接告诉用户下一步），
 * 而我们自己的包装文案做不到这一点。WorkBuddy 的 handler 同样透传。
 */
async function runGit(args: readonly string[], cwd: string): Promise<string> {
	const outcome = await gitOutcome(args, cwd);
	if (!outcome.ok) {
		const detail = outcome.stderr.trim() === "" ? "" : `：${outcome.stderr.trim()}`;
		throw new Error(`git ${args.join(" ")} 失败${detail}`);
	}
	return outcome.stdout;
}

/** cwd 是否在某个 git 工作树内（含子目录）。 */
export async function isGitRepo(cwd: string): Promise<boolean> {
	if (cwd === "") return false;
	const outcome = await gitOutcome(["rev-parse", "--is-inside-work-tree"], cwd);
	return outcome.ok && outcome.stdout.trim() === "true";
}

/**
 * 仓库根绝对路径。用户选的可能只是仓库里的一个子目录，
 * 而 worktree 必须建在根上（建在子目录会得到嵌套副本）。
 * 非仓库返回 undefined。
 */
export async function resolveRepoRoot(cwd: string): Promise<string | undefined> {
	const outcome = await gitOutcome(["rev-parse", "--show-toplevel"], cwd);
	if (!outcome.ok) return undefined;
	const root = outcome.stdout.trim();
	return root === "" ? undefined : root;
}

/**
 * 当前检出分支。detached HEAD 时 git 回 `HEAD`，这里转 undefined ——
 * 界面显示「HEAD」会让用户以为那是分支名。
 */
export async function getCurrentBranch(cwd: string): Promise<string | undefined> {
	const outcome = await gitOutcome(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
	if (!outcome.ok) return undefined;
	const branch = outcome.stdout.trim();
	return branch === "" || branch === "HEAD" ? undefined : branch;
}

/**
 * 本地分支列表（不含远端跟踪分支）。
 *
 * 用 `for-each-ref` 而不是 `git branch`：后者的输出带 `*` 前缀与颜色转义，
 * 要额外解析；前者是稳定的机器格式。
 */
export async function listLocalBranches(cwd: string): Promise<readonly string[]> {
	const outcome = await gitOutcome(
		["for-each-ref", "--format=%(refname:short)", "--sort=refname", "refs/heads"],
		cwd,
	);
	if (!outcome.ok) return [];
	return outcome.stdout
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "");
}

/** 仓库状态。非 git 仓库时 isGitRepo=false、其余字段取安全缺省。 */
export async function getRepoStatus(cwd: string): Promise<WorktreeRepoStatus> {
	if (!(await isGitRepo(cwd))) {
		return { isGitRepo: false, currentBranch: undefined, hasUncommittedChanges: false };
	}
	const currentBranch = await getCurrentBranch(cwd);
	const outcome = await gitOutcome(["status", "--porcelain"], cwd);
	// status 失败（仓库损坏等）时按「无改动」处理：脏只是提示，不是安全闸，
	// 拿不到就少提示一句，不该让整个 chip 打不开。
	const hasUncommittedChanges = outcome.ok && outcome.stdout.trim() !== "";
	return { isGitRepo: true, currentBranch, hasUncommittedChanges };
}

/** 分支列表查询（含是否 git 仓库的一次性判定，避免 chip 连发两次 IPC）。 */
export async function getBranchList(cwd: string): Promise<WorktreeBranchList> {
	if (!(await isGitRepo(cwd))) {
		return { isGitRepo: false, branches: [], currentBranch: undefined };
	}
	const [branches, currentBranch] = await Promise.all([
		listLocalBranches(cwd),
		getCurrentBranch(cwd),
	]);
	return { isGitRepo: true, branches, currentBranch };
}

/**
 * 从会话 cwd 反推副本身份（resume 路径用）。
 *
 * 副本路径形态固定是 `<副本根>/<仓库目录名>/<分支 id>` **两层**，所以要求恰好
 * 两层：只判「在副本根下」的话，`<副本根>/repo` 这个仓库分组目录会被误判成
 * 一个副本。baseBranch / sourceCwd 反推不出（见 shared/worktree.ts 的类型注释），
 * 按缺省留空。
 */
export function worktreeInfoFromCwd(cwd: string): WorktreeInfo | undefined {
	if (!isWorktreePath(cwd)) return undefined;
	const root = normalize(getWorktreeRoot()).replace(/\\/g, "/").replace(/\/+$/, "");
	const target = normalize(cwd).replace(/\\/g, "/").replace(/\/+$/, "");

	const parts = target
		.slice(root.length + 1)
		.split("/")
		.filter((part) => part !== "");
	// 严格两层 = <仓库目录名>/<分支 id>。只判前缀的话，仓库分组目录
	//（<副本根>/repo）会被误判成一个副本。
	if (parts.length !== 2) return undefined;
	const branchId = parts[1];
	if (branchId === undefined || branchId === "") return undefined;

	return { worktreePath: cwd, taskBranch: taskBranchFromBranchId(branchId) };
}

/**
 * cwd 是否落在副本根下（任意深度）。
 *
 * 两处消费它，语义都是「这不是用户经营的工作目录」：
 *   - daemon 的归区判定（workspace-model.ts 的 isTaskPrivateCwd）：副本会话归任务区
 *     （否则会以 `main-a1b2c3d4` 这种目录名在空间区成组）；
 *   - renderer 判断当前会话是否已在副本里（chip 的展示态）。
 *
 * 统一成正斜杠再比：git 回报的路径与 path.join 给的斜杠方向在 Windows 上不一致。
 */
export function isWorktreePath(cwd: string): boolean {
	if (cwd === "") return false;
	const root = normalize(getWorktreeRoot()).replace(/\\/g, "/").replace(/\/+$/, "");
	const target = normalize(cwd).replace(/\\/g, "/").replace(/\/+$/, "");
	return target.startsWith(`${root}/`);
}

export interface CreateWorktreeOptions {
	/** 原仓库目录（绝对路径；可以是仓库内子目录，内部会归到仓库根）。 */
	readonly repoCwd: string;
	/** 基准分支，副本从它切出。 */
	readonly baseBranch: string;
	/** 副本根目录覆盖（测试注入；缺省 <配置目录>/worktrees）。 */
	readonly rootDir?: string;
	/** uid 覆盖（测试注入；缺省生成 8 位随机）。 */
	readonly uid?: string;
}

/**
 * 创建副本：
 *   `git worktree add -b workbuddy/<slug>-<uid> <副本根>/<仓库名>/<分支 id> <基准分支>`
 *
 * 失败**必须回滚**：git 在建分支后、写 worktree 元数据前失败时，
 * 会留下一个已创建的分支与半拉目录，下一次同基准分支重试就可能撞上
 * 那半个残骸。回滚顺序照 WorkBuddy：先 `worktree remove --force`（成功路径要
 * 清元数据），再 `rm -rf` 兜底目录（remove 对没登记成功的目录无能为力）。
 *
 * 副本来不及清理就抛错 —— 响亮失败好过留下一个状态不明的工作目录给后续命令用。
 */
export async function createWorktree(options: CreateWorktreeOptions): Promise<WorktreeInfo> {
	const repoRoot = (await resolveRepoRoot(options.repoCwd)) ?? options.repoCwd;
	const uid = options.uid ?? generateWorktreeUid();
	const branchId = buildBranchId(options.baseBranch, uid);
	const taskBranch = buildTaskBranch(options.baseBranch, uid);
	const root = options.rootDir ?? getWorktreeRoot();
	const worktreePath = join(root, repoDirName(repoRoot), branchId);

	await mkdir(dirname(worktreePath), { recursive: true });

	try {
		await runGit(
			["worktree", "add", "-b", taskBranch, worktreePath, options.baseBranch],
			repoRoot,
		);
	} catch (error) {
		await removeWorktree(repoRoot, worktreePath).catch(() => undefined);
		// maxRetries：git 刚释放目录句柄，Windows 上立刻 rm 会 EBUSY。
		await rm(worktreePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(
			() => undefined,
		);
		throw error instanceof Error ? error : new Error(String(error));
	}

	return { worktreePath, taskBranch, baseBranch: options.baseBranch, sourceCwd: repoRoot };
}

/**
 * 删除副本。`--force` 是必需的：副本里通常有 agent 改过的文件（正是它存在的
 * 意义），不带 force 时 git 会以「有修改」为由拒绝删除。删完 `worktree prune`
 * 清掉指向已消失目录的元数据条目。
 *
 * 不删分支：任务分支留着让用户自己决定要不要合/删（我们只清理自己建的
 * worktree 目录，分支属于用户的仓库资产）。
 */
export async function removeWorktree(repoCwd: string, worktreePath: string): Promise<void> {
	await runGit(["worktree", "remove", "--force", worktreePath], repoCwd);
	await gitOutcome(["worktree", "prune"], repoCwd);
}

/** 已登记的副本（含主工作树本身 —— 调用方按需过滤）。 */
export interface LinkedWorktree {
	readonly path: string;
	/** 分支名；detached 时 undefined。 */
	readonly branch: string | undefined;
}

/**
 * 列出仓库登记的全部工作树。
 *
 * 解析 `git worktree list --porcelain`：块与块之间空行分隔，
 * 每块含 `worktree <path>` / `HEAD <sha>` / `branch refs/heads/<name>` 行
 * （detached 时是 `detached` 而非 branch）。用 porcelain 而不是默认的
 * 对齐表格输出 —— 后者列宽随路径长度变化，解析必碎。
 *
 * **路径必须 normalize**：git 在 Windows 上回的是正斜杠（`C:/Users/...`），
 * 而 createWorktree 用 path.join 给出的是反斜杠。不归一化的话，
 * 调用方拿 cleanedPaths 与 WorktreeInfo.worktreePath 比对会「看起来相等却不等」——
 * 实测踩过：清理功能确实删对了文件，但断言与 UI 里所有路径比对全部失配。
 */
export async function listLinkedWorktrees(repoCwd: string): Promise<readonly LinkedWorktree[]> {
	const outcome = await gitOutcome(["worktree", "list", "--porcelain"], repoCwd);
	if (!outcome.ok) return [];

	const result: LinkedWorktree[] = [];
	let path: string | undefined;
	let branch: string | undefined;

	const flush = (): void => {
		if (path !== undefined) result.push({ path, branch });
		path = undefined;
		branch = undefined;
	};

	for (const line of outcome.stdout.split("\n")) {
		if (line === "") {
			flush();
			continue;
		}
		if (line.startsWith("worktree ")) path = normalize(line.slice("worktree ".length).trim());
		else if (line.startsWith("branch refs/heads/")) {
			branch = line.slice("branch refs/heads/".length).trim();
		} else if (line === "detached") branch = undefined;
	}
	flush();
	return result;
}

export interface CleanupWorktreesOptions {
	readonly repoCwd: string;
	/** 只清理创建时间早于「现在 - 这个天数」的副本。 */
	readonly olderThanDays: number;
	/** 副本根目录覆盖（测试注入；缺省 <配置目录>/worktrees）。 */
	readonly rootDir?: string;
	/** 当前时刻（测试注入）。 */
	readonly now?: number;
}

export interface CleanupWorktreesResult {
	readonly cleanedCount: number;
	readonly cleanedPaths: readonly string[];
	readonly skippedDirtyCount: number;
	readonly skippedRecentCount: number;
	readonly failedCount: number;
}

/**
 * 清理陈旧副本。两道判据缺一不可（照 WorkBuddy 的 cleanupWorktrees）：
 *
 *   1. **脏的不清** —— 副本里有未提交改动就是还没收工的任务产物，
 *      删掉等于静默销毁用户的工作；
 *   2. **两类归属都要对上** —— 路径必须在我们的副本根下，**且**分支带
 *      `workbuddy/` 前缀。只判路径不够：用户完全可能自己 `git worktree add`
 *      到同一个根目录下（那是他的东西）；只判分支也不够：分支名可被复制。
 *
 * 返回五项计数器而不是只回成功数：跳过多少、失败多少是判断「要不要继续清」
 * 与「是不是出问题了」的依据，吞掉它们等于让调用方瞎猜。
 */
export async function cleanupWorktrees(
	options: CleanupWorktreesOptions,
): Promise<CleanupWorktreesResult> {
	const root = options.rootDir ?? getWorktreeRoot();
	const now = options.now ?? Date.now();
	const cutoff = now - options.olderThanDays * DAY_MS;

	const cleanedPaths: string[] = [];
	let skippedDirtyCount = 0;
	let skippedRecentCount = 0;
	let failedCount = 0;

	// 主工作树也在 list 里，先排除：它的路径必然不在副本根下，
	// 由下面的 rootDir 归属检查一并挡掉，这里不额外特判。
	const worktrees = await listLinkedWorktrees(options.repoCwd);

	for (const worktree of worktrees) {
		if (!isUnderRoot(root, worktree.path)) continue;
		if (worktree.branch === undefined || !isTaskBranch(worktree.branch)) continue;
		try {
			const info = await stat(worktree.path);
			if (info.mtimeMs > cutoff) {
				skippedRecentCount += 1;
				continue;
			}
			const status = await getRepoStatus(worktree.path);
			if (status.hasUncommittedChanges) {
				skippedDirtyCount += 1;
				continue;
			}
			await removeWorktree(options.repoCwd, worktree.path);
			cleanedPaths.push(worktree.path);
		} catch {
			// 单个副本失败不中断整轮清理：目录被外部删掉、权限不足都可能发生，
			// 其余副本照清。失败的算在 failedCount 里如实上报。
			failedCount += 1;
		}
	}

	return {
		cleanedCount: cleanedPaths.length,
		cleanedPaths,
		skippedDirtyCount,
		skippedRecentCount,
		failedCount,
	};
}

/**
 * child 是否位于 parent 之下（用于副本归属判定）。
 *
 * 不用 core/workspace.ts 的 sameOrInside：那个是私有的，且语义是
 * 「等于或在其内」—— 这里副本**必须**在 root 内（等于 root 本身不算）。
 * 路径两端都先归一化分隔符，因 git 在 Windows 上回的是正斜杠。
 */
function isUnderRoot(parent: string, child: string): boolean {
	const normalize = (p: string): string => {
		const unified = p.replace(/\\/g, "/").replace(/\/+$/, "");
		return process.platform === "win32" ? unified.toLowerCase() : unified;
	};
	const p = `${normalize(parent)}/`;
	const c = normalize(child);
	return c.startsWith(p);
}
