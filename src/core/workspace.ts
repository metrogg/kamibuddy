/**
 * 工作空间的目录守卫与目录操作。
 *
 * 为什么这层必须是硬校验：权限门对工作空间内的写操作**直接放行**
 * （permission-policy.ts），所以「把哪个目录设为工作空间」本身就是安全边界。
 * 这里挡掉的每一类，都是「一旦放行就等于把钥匙交出去」的目录：
 *
 *   - 配置目录（~/.kamibuddy）：里面有 auth.json 密钥。
 *     其祖先也要拒——设为用户目录等于整个家目录都放行。
 *   - 应用所在目录（config-paths.ts 的 getAppDir()：由主进程用 app.getAppPath()
 *     精准传入，dev 是项目仓库、打包后是 app.asar）。让 AI 自由改写应用自身，
 *     两边都不可接受。**刻意不读 process.cwd()** —— daemon 的 cwd 是继承来的
 *     启动目录，值会漂（见 getAppDir 的注释），安全边界不能建在漂移值上。
 *   - 文件系统根 / 相对路径：明显的误操作。
 *
 * 机制参考 WorkBuddy（workspace = 目录路径、默认根下建同名子目录），
 * 但校验规则是我们自己的：它只查可写性，我们把「不许指向哪」显式化。
 *
 * 纯 Node、不 import pi 与 electron（AGENTS.md §1），可脱离宿主单测。
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { isAbsolute, join, parse, resolve, sep } from "node:path";
import { autoSessionDirName } from "../shared/workspace.ts";
import { isWorktreePath } from "./worktree.ts";

export interface WorkspaceGuards {
	readonly configDir: string;
	readonly appDir: string;
}

/** child 是否等于 parent 或位于其内部。Windows 路径大小写不敏感。 */
function sameOrInside(parent: string, child: string): boolean {
	const normalize = (p: string): string => {
		const resolved = resolve(p);
		return process.platform === "win32" ? resolved.toLowerCase() : resolved;
	};
	const p = normalize(parent);
	const c = normalize(child);
	return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}

/**
 * 校验候选工作空间路径。返回 undefined 表示可用，否则返回给用户看的原因。
 * 返回原因而非抛错：调用方（daemon）要把它变成 IPC 错误消息。
 */
export function validateWorkspacePath(path: string, guards: WorkspaceGuards): string | undefined {
	if (!isAbsolute(path)) return "工作空间必须是绝对路径";
	if (parse(resolve(path)).root === resolve(path)) return "不能把文件系统根目录设为工作空间";
	if (sameOrInside(guards.configDir, path) || sameOrInside(path, guards.configDir)) {
		/*
		 * 例外：worktree 副本根之下（`<配置目录>/worktrees/...`）。
		 *
		 * 副本里只有某个仓库的工作树快照，凭据不在其中（auth.json 在配置目录根，
		 * 不在 worktrees/ 子目录），而这是代码场景的**正常会话目录**
		 *（对齐清单 C22/L27）—— 不放行的话，副本会话 resume 一律报
		 *「会话的工作目录不可用」，功能直接不可用。
		 *
		 * 口子只开在副本根之内：配置目录本身、它的祖先、以及 worktrees 下的
		 * 非副本路径照旧拒绝（两向判定都还在，只是多了一个精确的例外）。
		 */
		if (!isWorktreePath(path)) {
			return "不能把配置目录（含密钥）或其上层目录设为工作空间";
		}
	}
	if (sameOrInside(guards.appDir, path) || sameOrInside(path, guards.appDir)) {
		return "不能把应用目录设为工作空间";
	}
	return undefined;
}

/** Windows 文件名保留字符 + 控制字符。防创建失败与路径逃逸。 */
const ILLEGAL_NAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/;

/**
 * 在默认根下新建工作空间子目录（对标 WorkBuddy 的「为工作空间命名，
 * 本地将自动创建同名文件夹」）。返回创建的路径。
 * 名称即目录名，创建后不可改名（WorkBuddy 同样如此约束）。
 */
export function createWorkspace(root: string, name: string): string {
	const trimmed = name.trim();
	if (trimmed === "") throw new Error("工作空间名称不能为空");
	if (ILLEGAL_NAME_CHARS.test(trimmed) || trimmed === "." || trimmed === "..") {
		throw new Error(`工作空间名称含非法字符：${trimmed}`);
	}
	if (trimmed.length > 64) throw new Error("工作空间名称过长（最多 64 字符）");

	mkdirSync(root, { recursive: true });
	const target = join(root, trimmed);
	if (existsSync(target)) throw new Error(`工作空间「${trimmed}」已存在`);
	mkdirSync(target);
	return target;
}

/** 列出默认根下的已有工作空间（子目录），按名称排序。根目录不存在时返回空。 */
export function listWorkspaces(root: string): readonly string[] {
	if (!existsSync(root)) return [];
	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(root, entry.name))
		.sort((a, b) => a.localeCompare(b));
}

/**
 * 自动会话目录创建时「同秒冲突按秒递增」的最大尝试次数。
 *
 * 来源（对齐 WorkBuddy）：docs/WorkBuddy/_analysis/extracted/main/server.js:160810-160819，
 * `for (let attempt = 0; attempt < 100; attempt += 1)`，候选 = 基准时间 + attempt 秒。
 * 100 次足以覆盖「同一秒内极高并发新建任务」这一真实场景；再超说明系统时钟冻结或磁盘
 * 异常，此时应当响亮报错——静默返回另一个名字会让调用方拿到它没预期的路径（会话 cwd
 * 与用户认知不一致），掩盖真正的故障。
 */
const MAX_SESSION_DIR_ATTEMPTS = 100;

/**
 * 在 root 下创建一个新的自动会话目录（`YYYY-MM-DD-HH-mm-ss`，本地时间），返回其绝对路径。
 * 未选工作空间的新任务在首次执行时用它作为会话 cwd（对齐 WorkBuddy 的 createDefaultCwd）。
 *
 * 为什么放 core/ 而不是 shared/：这里要落磁盘（mkdir），而 shared/ 是零运行时依赖层
 * （AGENTS.md §1），只承载纯函数契约——命名格式与形态判定已在 shared/workspace.ts，
 * 这里直接复用，两端不各写一遍。
 *
 * `now` 可注入，仅为让单测能确定性地构造同秒冲突与跨分钟边界；不传时用真实时钟。
 */
export function createSessionDir(root: string, now?: Date): string {
	// 根可能尚不存在（首次使用、或用户改了默认存储路径）。补建根这一步是递归的：
	// 这里允许造出中间层级，是「根」本身的语义，不需要非递归的竞态保护。
	mkdirSync(root, { recursive: true });
	const base = now ?? new Date();

	for (let attempt = 0; attempt < MAX_SESSION_DIR_ATTEMPTS; attempt += 1) {
		// 递增口径是「基准时间 + attempt 秒」，而不是「上一次候选 + 1 秒」。
		// 两者跨分钟/小时边界时结果不同。选前者：每一步都从同一基准换算，简单可预期；
		// 后者把偏移累积在候选上，任何一步的偏差都会整体漂移。注释写明，避免后人改错。
		const candidate = join(root, autoSessionDirName(new Date(base.getTime() + attempt * 1000)));
		if (existsSync(candidate)) continue;
		// 已判不存在，这里刻意用**非递归** mkdir：若路径在此刻被并发创建出来，
		// 非递归会抛 EEXIST 立刻暴露竞态（recursive 则可能静默吞掉、返回一个其实属于
		// 别人的目录）；同理权限错误也会在第一处就抛出，而非留下半截父目录。
		mkdirSync(candidate);
		return candidate;
	}

	// 连续 100 秒都被占用：不静默返回别的路径，响亮失败（本项目风格：不兜底掩盖上游问题）。
	throw new Error(
		`无法在 ${root} 下创建唯一的时间戳会话目录（${MAX_SESSION_DIR_ATTEMPTS} 次尝试均冲突）`,
	);
}
