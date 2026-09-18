/**
 * 工作空间的目录守卫与目录操作。
 *
 * `validateWorkspacePath` 是「这个路径能不能当工作空间」的**唯一判定入口**，
 * 口径 = **绝对路径 + 存在时必须是可访问的目录**。不做任何目录黑名单。
 *
 * ## 为什么没有黑名单（2026-09-18 决策，推翻原先三项禁令）
 *
 * 原实现拒绝配置目录 / 应用目录 / 文件系统根，理由是「工作空间内的写操作被权限门
 * 直接放行，所以选目录就是选安全边界」。该理由本身成立，但**那三项不是边界、是
 * 一张没写完的清单**：它拦 `C:\`、配置目录、应用目录，却放行 `C:\Windows\System32`
 * 这类同样「模型无提示即可写」的目录 —— 拦的不是风险，是随手想到的三个例子。
 * 而**真正保护密钥的那一层根本不在这里**：
 * `extensions/permission-policy.ts` 阶段 1 对配置目录与凭据目录**禁读禁写、任何档位
 * 都不放行**，且它**按路径判定、先于工作区放行、与 cwd 无关** —— 所以工作空间指向
 * 配置目录，也不会让 read/write/edit 碰到 `auth.json`。
 *
 * 横向对照：codex / dsh / WorkBuddy **三家都不限制 cwd**，全部只校验
 * 「绝对路径 + 存在且可用」：
 *   - dsh：`docs/subsystems/persistence.md:98`「validated **absolute** cwd」；
 *     `docs/subsystems/workspace.md:56,74`（invalid cwd / 必须解析到存在的目录），
 *     且 `:122` 明写 cwd 无效的历史会话「stay **Ungrouped**」——不成组，**不拒绝**。
 *   - codex：`codex-rs/protocol/src/permissions.rs:2051`「cwd root must be an absolute
 *     path」；`app-server` 只拒**相对** cwd；`cli/src/doctor.rs:1604` 把「cwd does not
 *     exist」列为诊断项而非阻断。
 *   - WorkBuddy：`main/server.js:117508` 的 `assertSessionCwdUsable` 只查
 *     `stat` / `isDirectory` / `R_OK|X_OK`。
 *
 * 代价（知情接受）：cwd 同时是沙箱的写边界（`daemon/sandbox-runner.ts` 的
 * `writableDirs: [workspaceDir]`），这与 dsh 的「A session cwd is its
 * workspace-write boundary」（`docs/subsystems/sandbox.md:201-203`）是同一模型，
 * 不是我们独有的缺陷。黑名单给不了边界、只给用户添堵（症状：会话建得了打不开），
 * 故撤掉；要收紧就收紧**沙箱的授权范围**，那是完整规则，不是三项清单。
 *
 * 纯 Node、不 import pi 与 electron（AGENTS.md §1），可脱离宿主单测。
 */

import { accessSync, constants, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { autoSessionDirName } from "../shared/workspace.ts";

/**
 * 校验候选工作空间路径。返回 undefined 表示可用，否则返回给用户看的原因。
 * 返回原因而非抛错：调用方（daemon）要把它变成 IPC 错误消息。
 *
 * 只判三件事，不做目录黑名单（理由与横向对照见文件头）：
 *   1. 必须是绝对路径 —— 三家参照物共同的硬要求；
 *   2. 已经存在时必须是**目录** —— 指到一个文件上，随后的 mkdirSync 会以
 *      ENOTDIR/EEXIST 之类的原生错误冒出来，给一句人话比让用户猜好；
 *   3. 已经存在时必须可访问（R_OK|X_OK，对齐 WorkBuddy 的 `assertSessionCwdUsable`）。
 *
 * **不存在是合法的**：调用方随后 `mkdirSync(recursive)` 建出来（选工作空间、
 * 保存定时任务、恢复历史会话三处同口径 —— 历史目录被用户删掉后补建，不报错）。
 * 这也是本函数与 WorkBuddy 唯一的有意差异：它 `stat` 失败即抛，我们补建。
 */
export function validateWorkspacePath(path: string): string | undefined {
	if (!isAbsolute(path)) return "工作空间必须是绝对路径";

	let stats;
	try {
		stats = statSync(path);
	} catch {
		// 不存在（含父目录不存在）：合法，调用方 mkdir。真属权限问题会在下面
		// accessSync 或调用方的 mkdir 处响亮失败，不在这里吞掉。
		return undefined;
	}
	if (!stats.isDirectory()) return "该路径已存在且不是目录";
	try {
		accessSync(path, constants.R_OK | constants.X_OK);
	} catch {
		return "该路径不可访问（权限不足）";
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
