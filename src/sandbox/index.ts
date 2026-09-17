/**
 * 沙箱层的**唯一**对外接口：可用性探测 + 受限执行。
 *
 * 其余模块（ffi / token / acl / spawn / workspace-sid）都是内部实现，
 * 调用方不该 import 它们 —— 那些文件里全是必须成对出现的 Win32 内存契约，
 * 散着用一定会漏。
 *
 * 能力边界（必须如实传达，不能让上层误以为这是完整隔离）：
 *   写 —— 由操作系统强制约束在授权目录内
 *   读 —— **完全不受约束**（WRITE_RESTRICTED 机制上只管写，已实测）
 *   网 —— 完全不受约束
 * 所以 `command-guard` 的凭据类拦截仍然是唯一防线，不得因「有沙箱了」而削弱。
 * 三层分工：权限门管问不问、检查器管能不能跑、沙箱管跑起来能碰到什么。
 */

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

import type { SandboxUnavailableReason } from "../shared/permissions.ts";
import { grantWrite } from "./acl.ts";
import {
	FfiUnavailableError,
	freeNative,
	getTempPath,
	loadWin32,
	type NativePtr,
	type Win32Bindings,
} from "./ffi.ts";
import { drainPipe, spawnConfined, waitForChild } from "./spawn.ts";
import {
	createRestrictedToken,
	findLogonSid,
	makeWellKnownSid,
	openCurrentProcessToken,
	setTokenDefaultDaclGrant,
	sidFromString,
	type ConfinementMode,
} from "./token.ts";
import * as abi from "./win32-abi.ts";
import { tempWriteSid, workspaceWriteSid } from "./workspace-sid.ts";

export type { ConfinementMode } from "./token.ts";

/** 探测结果。不可用时带原因，一路上报到设置页。 */
export type SandboxAvailability =
	| { readonly available: true }
	| { readonly available: false; readonly reason: SandboxUnavailableReason; readonly detail: string };

export interface SandboxRunRequest {
	readonly command: string;
	readonly args: readonly string[];
	/** 子进程工作目录。**可能不等于工作区**（子代理、临时任务会话就是如此）。 */
	readonly cwd: string;
	/**
	 * 私有 temp 的派生锚点，**必须与 `prepareSandbox` 传的是同一个值**。
	 *
	 * 单独立一个字段而不是复用 cwd：私有 temp 按这个值确定性派生，
	 * 而授权发生在 prepare 阶段 —— 两处若锚定不同的值，运行时用的 temp 目录
	 * 就从未被授权，PowerShell 写临时文件会被拒（潜伏 bug，形状很难查）。
	 * 显式同名字段让这个约束在类型上就看得见。
	 */
	readonly workspaceDir: string;
	/** 授写的目录。私有 temp 由本层自行管理，不必列进来。 */
	readonly writableDirs: readonly string[];
	readonly timeoutMs: number;
	readonly mode: ConfinementMode;
	/**
	 * 调用方的中断信号（用户按「停止」时由 pi 触发）。
	 *
	 * 必须由本层处理而不是让上层放弃等待：进程在**沙箱里**，只有这里握着
	 * Job 句柄，杀整棵树的唯一手段是关它（见 spawn.ts 的 waitForChild）。
	 * 上层不传信号时行为与今天完全一致。
	 */
	readonly signal?: AbortSignal;
}

/**
 * 执行结果。**字段与 `powershell-tool.ts` 的 `CommandOutcome` 逐一对应**
 * （含 `exitCode` 用 `null` 而不是 `undefined` 表示「被杀」），
 * 这样那边的 `formatOutcome` 一行都不用改。
 */
export interface SandboxRunOutcome {
	readonly stdout: string;
	readonly stderr: string;
	/** null 表示进程被杀（超时或中断路径）。 */
	readonly exitCode: number | null;
	readonly timedOut: boolean;
	/** 被中断而杀树（与超时区分：文案与详情不同）。 */
	readonly aborted: boolean;
}

/* ── 探测 ────────────────────────────────────────────────────────── */

/**
 * 启动自检的结论。**与工作区无关**，所以进程级缓存一次就够
 * （它在自建的临时目录里跑，见 selfCheck）。
 */
let cachedSelfCheck: SandboxAvailability | undefined;

/**
 * 文件系统结论，**按工作区缓存**。
 *
 * 【2026-09-16 修一个真 bug】原先整个探测结论存在一个进程级单值里，
 * 但探测包含一步**与工作区有关**的判断（卷的文件系统能不能承载 ACL）——
 * 而 daemon 的每个会话桶都用自己的 cwd 调本函数（切换工作区、临时任务会话、
 * 子代理都会产生不同的工作区）。于是第一个工作区的结论被后续所有工作区复用，
 * 两个方向都错：
 *
 *   NTFS 工作区探测过后切到 exFAT U 盘 → 仍报「可用」，而那里的授权毫无效果
 *     （**正是探测本该拦住的那个假边界**）；
 *   反过来先探到 exFAT → 整个进程里沙箱永久「不可用」，NTFS 工作区也被连坐。
 *
 * 当时的后果有限（exFAT 上授权无效 = 区内写也被拒，是 fail-closed 方向的
 * 功能故障）。但**审批放松要拿「沙箱可用」当依据** —— 那时一个跨工作区的陈旧
 * `available: true` 就直接等于「在没有写约束的工作区里免审批执行命令」。
 * 所以这条必须在放松之前修掉。
 *
 * 键按小写路径：Windows 路径大小写不敏感，不归一会让同一目录存成两份。
 * 条目数由用户行为界定（几个工作区），不需要淘汰策略。
 */
const cachedFileSystemByWorkspace = new Map<string, SandboxAvailability>();

/**
 * 探测沙箱是否可用。幂等且缓存 —— 反复问不会反复付 FFI 加载与卷查询的代价。
 *
 * **只做"环境够不够"的判断，不做授权**：授权是 prepare 的事（有传播开销，
 * 必须由调用方在会话建立阶段显式触发）。
 *
 * 缓存分两级，因为两部分的作用域不同（见上面两个缓存的注释）：
 * 与工作区无关的启动自检只跑一次（~40ms，为首响延迟优化过，别改成每工作区一次）；
 * 与工作区有关的文件系统判断按工作区各算一次（只是几次 Win32 调用，不起进程）。
 */
export async function probeSandbox(workspaceDir: string): Promise<SandboxAvailability> {
	if (process.platform !== "win32") {
		return { available: false, reason: "not-windows", detail: `当前平台是 ${process.platform}` };
	}
	let api: Win32Bindings;
	try {
		// loadWin32 自带缓存，重复调用只是一次 map 查找。
		api = await loadWin32();
	} catch (error) {
		// FfiUnavailableError 与其他异常都归到这里：对上层来说都是「FFI 用不了」。
		const detail = error instanceof Error ? error.message : String(error);
		return {
			available: false,
			reason: "ffi-load-failed",
			detail: error instanceof FfiUnavailableError ? detail : `未预期的加载失败：${detail}`,
		};
	}

	/*
	 * 先判文件系统（便宜、按工作区），再判启动自检（贵、进程级）。
	 * 这个顺序让「第一个工作区就在 exFAT 上」的情况完全不必付自检的钱。
	 */
	const fileSystem = probeFileSystem(api, workspaceDir);
	if (!fileSystem.available) return fileSystem;

	if (cachedSelfCheck === undefined) {
		// 真跑一次，确认受限令牌下进程起得来（理由见 selfCheck）。
		cachedSelfCheck = await selfCheck(api);
	}
	return cachedSelfCheck;
}

/** 工作区所在卷能不能承载 ACL。按工作区缓存，理由见 cachedFileSystemByWorkspace。 */
function probeFileSystem(api: Win32Bindings, workspaceDir: string): SandboxAvailability {
	const key = workspaceDir.toLowerCase();
	const cached = cachedFileSystemByWorkspace.get(key);
	if (cached !== undefined) return cached;
	const verdict = readFileSystemVerdict(api, workspaceDir);
	cachedFileSystemByWorkspace.set(key, verdict);
	return verdict;
}

function readFileSystemVerdict(api: Win32Bindings, workspaceDir: string): SandboxAvailability {
	// FAT/exFAT 没有 ACL，授权会"成功"但毫无效果 —— 这正是最该报出来的
	// 假边界，不能让界面显示沙箱生效。
	const fileSystem = readFileSystemName(api, workspaceDir);
	if (fileSystem !== undefined && !isAclCapableFileSystem(fileSystem)) {
		return {
			available: false,
			reason: "unsupported-filesystem",
			detail: `工作区所在卷的文件系统是 ${fileSystem}，不支持 ACL`,
		};
	}
	return { available: true };
}

/** 仅供测试：清掉两级探测缓存。 */
export function resetSandboxProbeForTest(): void {
	cachedSelfCheck = undefined;
	cachedFileSystemByWorkspace.clear();
}

/**
 * 自检用的哨兵退出码。
 *
 * **必须由我们选定，不能取自模型可影响的输入。** 这是整个自检安全性的支点，
 * 见 selfCheck 的注释。
 */
const SELF_CHECK_EXIT_CODE = 7;

/**
 * 启动自检：在受限令牌里真跑一条我们自己选的命令，确认进程起得来。
 *
 * **为什么必须有这一步**（2026-09-15 的真实故障）：受限令牌下 PowerShell 可能
 * 死在 DLL 早期初始化（退出码 `0xC0000142`），命令一行都没执行 —— 而这个失败
 * 会被当成「命令执行失败」原样报给模型。结果是沙箱静默废掉了**每一条命令**，
 * 用户撞上一堵没有解释的墙，比没有沙箱更糟（还以为有保护）。
 *
 * **为什么只能放在探测期，不能放在每条命令上**（这是安全支点，别挪）：
 * 退出码由子进程控制。若在命令执行后把「进程没起来」类退出码判定为沙箱故障
 * 并降级重跑，模型只要写
 *   `Set-Content C:\outside\x.txt "data"; exit 3221225794`
 * 就能伪造这个信号 —— 第一次写被沙箱拒、故意退出该码、我们判定「沙箱坏了」、
 * 降级后**不受约束地重跑同一条命令** → 写成功。那是真实的沙箱逃逸。
 * 放在探测期则命令与哨兵值都由我们决定，模型无从伪造。
 *
 * **金丝雀为什么用 cmd.exe 而不是 powershell.exe**：两者对这个失败类**同样
 * 忠实**——判别矩阵证明坏配置下 cmd 与 PowerShell 一样死在 0xC0000142；
 * 而 cmd 冷启动约 40ms、PowerShell 约 1.1s（实测，2026-09-15）。自检发生在
 * 会话建立的预热期，第一条命令会 await 它的余量——用 PowerShell 当金丝雀
 * 曾让首次任务多等约 1 秒（用户实测「第一次任务非常慢」）。
 *
 * 走**完整生产路径**（prepareSandbox + runSandboxed），不手写精简版：
 * 手写精简版漏一步就会得出错误结论（诊断这次故障时我漏了
 * setTokenDefaultDaclGrant，差点误判根因）。用自建的临时目录当工作区，
 * 所以既覆盖 workspace-write 这条真实档位，又不碰用户的目录。
 */
async function selfCheck(api: Win32Bindings): Promise<SandboxAvailability> {
	// 分成两个变量：dir 确定是 string（给下面的调用用），
	// scratch 只用于 finally 的清理追踪（建目录本身就可能抛错）。
	let scratch: string | undefined;
	try {
		const dir = mkdtempSync(join(getTempPath(api), "kamibuddy-selfcheck-"));
		scratch = dir;
		await prepareSandbox({ workspaceDir: dir, writableDirs: [dir] });
		const outcome = await runSandboxed({
			command: "cmd.exe",
			args: ["/c", `exit ${SELF_CHECK_EXIT_CODE}`],
			cwd: dir,
			workspaceDir: dir,
			writableDirs: [dir],
			timeoutMs: SELF_CHECK_TIMEOUT_MS,
			mode: "workspace-write",
		});
		if (outcome.exitCode === SELF_CHECK_EXIT_CODE) return { available: true };
		/*
		 * 任何其他结果都算不可用。退出码原样带上（含十六进制）——
		 * 这是下次定位根因的唯一线索，务必别在这里丢掉或归一化。
		 */
		return {
			available: false,
			reason: "process-start-failed",
			detail: describeSelfCheckFailure(outcome),
		};
	} catch (error) {
		return { available: false, reason: classifyFailure(error), detail: errorDetail(error) };
	} finally {
		if (scratch !== undefined) {
			try {
				rmSync(await sandboxPrivateTempDir(scratch), { recursive: true, force: true });
			} catch {
				// 清理失败不该让探测结论变成「不可用」—— 那是噪音，不是边界问题。
			}
			try {
				rmSync(scratch, { recursive: true, force: true });
			} catch {
				// 同上。
			}
		}
	}
}

/** 自检超时。cmd 金丝雀实测约 40ms，30 秒的余量只为容忍极端的磁盘/杀毒抖动。 */
const SELF_CHECK_TIMEOUT_MS = 30_000;

/**
 * 把自检的失败结果写成一句可诊断的话（**保留十六进制退出码**）。
 *
 * 导出是为了单测：这段文本是下次定位根因的唯一线索，退出码若被丢掉或归一化，
 * 自检就只剩「不可用」三个字，等于白做。所以它值得有测试盯着。
 */
export function describeSelfCheckFailure(outcome: SandboxRunOutcome): string {
	if (outcome.timedOut) return `自检命令 ${SELF_CHECK_TIMEOUT_MS} 毫秒未结束`;
	const code = outcome.exitCode;
	if (code === null) return "自检进程被终止，没有退出码";
	/*
	 * 先做符号归一再比较：NTSTATUS 的高位是 1，若某条路径回传带符号视图
	 * （PowerShell 的 $LASTEXITCODE 与 cmd 就是这么显示的，如 -1073741502），
	 * 不归一就会漏掉名称标注 —— 而这段文本是下次定位根因的唯一线索。
	 */
	const unsigned = code >>> 0;
	const hex = `0x${unsigned.toString(16).toUpperCase().padStart(8, "0")}`;
	const known =
		unsigned === 0xc0000142 ? "（STATUS_DLL_INIT_FAILED：进程在 DLL 初始化阶段就失败了）" : "";
	const tail = [outcome.stdout.trim(), outcome.stderr.trim()].filter((s) => s !== "").join(" / ");
	return (
		`受限令牌下的自检命令没有正常退出：期望 ${SELF_CHECK_EXIT_CODE}，` +
		`实际 ${code}（${hex}）${known}${tail === "" ? "" : `，输出：${tail.slice(0, 200)}`}`
	);
}

function errorDetail(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** 支持 ACL 的文件系统。其余（FAT32/exFAT/网络盘的某些实现）一律视为不支持。 */
const ACL_CAPABLE_FILE_SYSTEMS: ReadonlySet<string> = new Set(["NTFS", "REFS"]);

/**
 * 卷的文件系统名能不能承载 ACL。
 *
 * 大小写归一收在这里而不是留给调用方：名单是全大写的，
 * 而 `GetVolumeInformationW` 回的形态不由我们决定 —— 漏一次 `toUpperCase()`
 * 就等于把 exFAT 判成「支持」，那正是这道检查要拦的假边界。
 */
export function isAclCapableFileSystem(name: string): boolean {
	return ACL_CAPABLE_FILE_SYSTEMS.has(name.toUpperCase());
}

/**
 * 读取路径所在卷的文件系统名。查不到返回 undefined（**不当作失败**）——
 * 卷查询失败的原因可能只是路径尚不存在，不该据此否掉沙箱；
 * 真正的授权失败会在 prepare 阶段响亮报出来。
 */
function readFileSystemName(api: Win32Bindings, path: string): string | undefined {
	const rootBuffer = Buffer.alloc((abi.MAX_PATH + 1) * 2);
	if (api.getVolumePathNameW(path, rootBuffer, abi.MAX_PATH + 1) === 0) return undefined;
	const root = decodeWideString(rootBuffer);
	if (root === "") return undefined;
	const nameBuffer = Buffer.alloc((abi.MAX_PATH + 1) * 2);
	if (
		api.getVolumeInformationW(root, null, 0, null, null, null, nameBuffer, abi.MAX_PATH + 1) === 0
	) {
		return undefined;
	}
	const name = decodeWideString(nameBuffer);
	return name === "" ? undefined : name;
}

/** UTF-16LE 缓冲 → 字符串，截到第一个 NUL。 */
function decodeWideString(buffer: Buffer): string {
	const text = buffer.toString("utf16le");
	const nul = text.indexOf("\0");
	return (nul === -1 ? text : text.slice(0, nul)).trim();
}

/* ── 授权（会话建立时做一次） ───────────────────────────────────── */

/**
 * 授权结果。`fastPath` 为 true 表示全部命中幂等快路径（ACE 已存在）。
 *
 * 上报 `elapsedMs` 是给调用方决定要不要给用户反馈用的：实测首次授权
 * 随文件数略超线性（5000 文件 3134ms），外推几万文件即几十秒。
 */
export interface SandboxPrepareResult {
	readonly fastPath: boolean;
	readonly elapsedMs: number;
	/**
	 * 目录规模读数（文件 + 子目录），授权前的**有界**扫描（见
	 * daemon/sandbox-prepare-protocol.ts 的 ENTRY_SCAN_LIMIT）。
	 *
	 * 可选是有意的：只有走 worker 的授权路径才量规模（量它本身要几秒，
	 * 只能在别的线程上做），进程内直调 `prepareSandbox`（集成测试、冒烟）
	 * 没有这一项。它只服务于「为什么这次授权慢」的展示，不参与任何判定。
	 */
	readonly entries?: number;
	/** `entries` 达到扫描上限 → 它是下界而不是全量。 */
	readonly capped?: boolean;
}

/**
 * 给工作区与私有 temp 授写。**必须在会话建立阶段调用，不能懒加载到首次命令。**
 *
 * 理由是实测数据：首次授权在大工作区上要几秒到几十秒（ACE 继承是即时展开的）。
 * 若拖到模型第一次调 powershell 时才做，用户会看到一条命令莫名挂住几十秒。
 *
 * 反过来，ACE 是**常驻**的（跨会话留存），所以只有「KamiBuddy 在这个工作区上
 * 的第一次运行」付这个钱，之后每次都是 1ms 的幂等快路径。这也是为什么
 * `runSandboxed` **不撤销**授权 —— 与 dsh 的 runner 相反，它每跑完一次就撤，
 * 那对我们是纯亏：撤了下次就要重新传播。
 *
 * 代价写在明处：工作区上会留下用户无法干净移除的 ACE
 * （`icacls /remove` 报 ERROR_NONE_MAPPED）。工作区是我们自己建的 ~/KamiBuddy，
 * 可接受；这条已记入架构文档的已知边界。
 */
export async function prepareSandbox(request: {
	readonly workspaceDir: string;
	readonly writableDirs: readonly string[];
}): Promise<SandboxPrepareResult> {
	const api = await loadWin32();
	const started = Date.now();
	const tempDir = privateTempDir(api, request.workspaceDir);
	mkdirSync(tempDir, { recursive: true });

	let allFast = true;
	const sids: NativePtr[] = [];
	try {
		for (const dir of request.writableDirs) {
			const sid = sidFromString(api, workspaceWriteSid(dir));
			sids.push(sid);
			if (!grantWrite(api, dir, sid)) allFast = false;
		}
		const tempSid = sidFromString(api, tempWriteSid(tempDir));
		sids.push(tempSid);
		if (!grantWrite(api, tempDir, tempSid)) allFast = false;
	} finally {
		for (const sid of sids) freeNative(sid);
	}
	return { fastPath: allFast, elapsedMs: Date.now() - started };
}

/**
 * 工作区对应的私有 temp 目录，按工作区路径确定性派生。
 *
 * 放在系统 temp 下而不是工作区内：工作区内的 temp 会被模型看见并当成产物，
 * 也会进 present_files 的候选。确定性派生是为了让 ACE 复用生效
 * （每次 mkdtemp 一个新目录 = 每次都要重新授权）。
 */
function privateTempDir(api: Win32Bindings, workspaceDir: string): string {
	const digest = createHash("sha256").update(workspaceDir.toLowerCase()).digest("hex").slice(0, 16);
	return join(getTempPath(api), "kamibuddy-sandbox", digest);
}

/**
 * 某个工作区对应的私有 temp 目录。
 *
 * 导出的两个用途：daemon 需要知道它以便排除在产物列举之外（那里面是命令的
 * 临时文件，不是用户的交付物）；测试需要它来清理常驻 ACE。
 */
export async function sandboxPrivateTempDir(workspaceDir: string): Promise<string> {
	const api = await loadWin32();
	return privateTempDir(api, workspaceDir);
}

/* ── 执行 ────────────────────────────────────────────────────────── */

/**
 * 在受限令牌里执行一条命令并捕获输出。
 *
 * 生命周期：每次调用派生一枚新的受限令牌，用完即关。不缓存令牌是有意的 ——
 * 派生成本是几次 Win32 调用（亚毫秒级），与 spawn 本身比可忽略，
 * 而缓存内核句柄要处理档位变化、工作区切换、进程退出清理三类失效，
 * 复杂度换不来可观收益。
 *
 * **fail-closed**：任何环节失败都抛，绝不退回用完整令牌 spawn。
 * 调用方（powershell 工具）负责把「沙箱不可用」与「沙箱内执行失败」区分开：
 * 前者降级并如实说明，后者是真实的执行错误。
 */
export async function runSandboxed(request: SandboxRunRequest): Promise<SandboxRunOutcome> {
	const api = await loadWin32();
	// 锚定 workspaceDir 而不是 cwd —— 必须与 prepareSandbox 授权过的那个目录一致。
	const tempDir = privateTempDir(api, request.workspaceDir);
	mkdirSync(tempDir, { recursive: true });

	const owned: NativePtr[] = [];
	let processToken: NativePtr | undefined;
	let restricted: NativePtr | undefined;
	try {
		processToken = openCurrentProcessToken(api);
		const logonSid = findLogonSid(api, processToken);
		owned.push(logonSid);
		const worldSid = makeWellKnownSid(api, abi.WinWorldSid);
		owned.push(worldSid);

		const writeSids: NativePtr[] = [];
		if (request.mode === "workspace-write") {
			for (const dir of request.writableDirs) {
				const sid = sidFromString(api, workspaceWriteSid(dir));
				owned.push(sid);
				writeSids.push(sid);
			}
			const tempSid = sidFromString(api, tempWriteSid(tempDir));
			owned.push(tempSid);
			writeSids.push(tempSid);
		}

		restricted = createRestrictedToken(api, processToken, logonSid, worldSid, writeSids, request.mode);

		/*
		 * 默认 DACL 必须并入一个**受限列表里有的** SID，否则子进程新建匿名管道
		 * 就过不了第二次（写）检查，piped stdio 全线失败（详见 token.ts）。
		 *
		 * **受托者必须用登录 SID，不能用 capability SID**（2026-09-15 诊断结论）：
		 * 默认 DACL 的 ACE 受托者若是外来 SID（S-1-4-*），子进程在部分启动上下文
		 * 下死于 DLL 初始化（0xC0000142）—— dsh 官方探针的原班机制在本机复现。
		 * 判别矩阵（npm run smoke:sandbox -- --diagnose，Win11 26100）证明：
		 *   - 受限列表含外来 SID 无辜（无授权的外来 SID 行通过）
		 *   - 文件 ACE 用外来受托者无辜（temp 授权行通过）
		 *   - **唯独默认 DACL 用外来受托者必死**；身份内受托者（logon/Everyone/
		 *     用户 SID）全部安全
		 * 内核级机制未完全查明（同一台机器上随启动链路不同而不同，确定性复现），
		 * 但经验规则完整，且 logon SID 在两档受限列表里恒在，pass-2 必过。
		 */
		setTokenDefaultDaclGrant(api, restricted, logonSid);

		const child = spawnConfined(api, {
			command: request.command,
			args: request.args,
			cwd: request.cwd,
			token: restricted,
			// 只覆盖 TMP/TEMP，其余继承 —— 不改本进程环境（那会污染整个 daemon）。
			env: { TMP: tempDir, TEMP: tempDir },
		});

		// 必须与等待并发：管道缓冲填满时子进程会阻塞在写上，
		// 先等退出再读就会死锁。
		const [stdoutBuffer, stderrBuffer, waited] = await Promise.all([
			drainPipe(api, child.stdoutRead),
			drainPipe(api, child.stderrRead),
			waitForChild(api, child, request.timeoutMs, request.signal),
		]);

		return {
			stdout: stdoutBuffer.toString("utf8"),
			stderr: stderrBuffer.toString("utf8"),
			// undefined → null：对齐 powershell 工具的 CommandOutcome 形状。
			exitCode: waited.exitCode ?? null,
			timedOut: waited.timedOut,
			aborted: waited.aborted,
		};
	} finally {
		for (const sid of owned) freeNative(sid);
		for (const handle of [restricted, processToken]) {
			if (handle !== undefined) api.closeHandle(handle);
		}
	}
}

/**
 * prepare 阶段**原因已知**的失败。
 *
 * 存在理由：授权跑在 worker_thread 里（见 daemon/sandbox-prepare-client.ts），
 * 异常跨不了线程 —— 能回来的只有字符串。worker 侧先用 `classifyFailure`
 * 把原因定下来，主线程再用本类把它还原成「带原因的失败」，
 * 于是 `classifyFailure` 不必靠猜 message（那本该由 API 名判定，
 * 而 worker 崩溃的情形根本没有 API 名）。
 *
 * 不还原会怎样：`classifyFailure` 的兜底是 `token-creation-failed`，
 * 于是「授权组件起不来」会被设置页说成「受限令牌创建失败」——
 * 一个把排查方向指歪的错误原因，比没有原因更糟。
 */
export class SandboxPrepareFailure extends Error {
	readonly reason: SandboxUnavailableReason;

	constructor(reason: SandboxUnavailableReason, detail: string) {
		super(detail);
		this.name = "SandboxPrepareFailure";
		this.reason = reason;
	}
}

/** 供上层构造错误信息：把内部异常翻成原因枚举。 */
export function classifyFailure(error: unknown): SandboxUnavailableReason {
	if (error instanceof SandboxPrepareFailure) return error.reason;
	if (error instanceof FfiUnavailableError) return "ffi-load-failed";
	if (error instanceof Error) {
		// Win32Error 的 message 带 API 名，据此区分令牌与 ACL 两类失败 ——
		// 上报给用户的原因不同（前者是环境问题，后者通常是目录所有权问题）。
		if (/CreateRestrictedToken|OpenProcessToken|SetTokenInformation/.test(error.message)) {
			return "token-creation-failed";
		}
		if (/SetNamedSecurityInfoW|SetEntriesInAclW|GetNamedSecurityInfoW/.test(error.message)) {
			return "acl-grant-failed";
		}
	}
	return "token-creation-failed";
}
