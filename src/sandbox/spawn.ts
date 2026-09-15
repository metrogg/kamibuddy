/**
 * 在受限令牌里拉起子进程，捕获输出，超时杀掉整棵进程树。
 *
 * 三处相对 dsh 的有意偏离，都源于「我们住在 daemon 里」这一个事实：
 *
 * 1. **等待必须异步轮询，不能用 WaitForSingleObject(INFINITE)。**
 *    dsh 的 waitForProcessExit 同步阻塞 —— 它跑在独立 runner 进程里，
 *    阻塞无所谓；我们在 daemon（utilityProcess，单线程 JS）里，
 *    阻塞 120 秒等于把所有会话连同 UI 事件一起冻住。
 *
 * 2. **piped 路径要有 Job Object。** dsh 只给 inherited 路径配了 Job
 *    （spawnInheritedJobProcess），piped 路径没有。我们的工具有超时约定，
 *    没 Job 就只杀得掉直接子进程 —— `powershell -Command "node x.js"` 超时后
 *    node 变孤儿继续跑。所以这里把两者合起来：piped stdio + kill-on-close Job。
 *
 * 3. **显式环境块**（见 win32-abi.ts 的 CREATE_UNICODE_ENVIRONMENT 注释）：
 *    不能像 dsh 那样改自己进程的 TMP/TEMP 让子进程继承 —— 那会污染整个 daemon。
 *
 * 移植自 dsh win32-process/src/process.ts 与 sandbox-windows-acl/src/spawn.ts（MIT）。
 */

import { Buffer } from "node:buffer";

import {
	allocProcessInfo,
	allocPtrSlot,
	allocStartupInfo,
	allocUint32,
	decodeProcessInfo,
	decodePtr,
	decodeUint32,
	encodeStartupInfo,
	freeNative,
	isNullPtr,
	throwLastError,
	throwWin32,
	type NativePtr,
	type Win32Bindings,
} from "./ffi.ts";
import * as abi from "./win32-abi.ts";

/**
 * 按 CommandLineToArgvW 的**真实**规则给单个参数加引号。
 *
 * 不能用朴素的「包一层双引号」：Windows 没有 argv 数组，
 * CreateProcess 收的是一整条字符串，由被调进程自己解析。反斜杠的规则很反直觉 ——
 * 只有紧邻结尾引号或内嵌引号的反斜杠才需要翻倍，其他位置原样保留。
 * 写错的后果是路径里带空格或引号时参数被切错，模型看到莫名其妙的失败。
 */
export function quoteArg(argument: string): string {
	if (argument === "") return '""';
	if (!/[\s"]/u.test(argument)) return argument;
	let quoted = '"';
	for (let index = 0; index < argument.length; index += 1) {
		let backslashes = 0;
		while (index < argument.length && argument.charAt(index) === "\\") {
			backslashes += 1;
			index += 1;
		}
		if (index === argument.length) {
			// 结尾的反斜杠会与我们补的收尾引号相邻 → 必须翻倍。
			quoted += "\\".repeat(backslashes * 2);
		} else if (argument.charAt(index) === '"') {
			// 内嵌引号：前面的反斜杠翻倍，再转义这个引号本身。
			quoted += `${"\\".repeat(backslashes * 2 + 1)}"`;
		} else {
			quoted += "\\".repeat(backslashes) + argument.charAt(index);
		}
	}
	return `${quoted}"`;
}

/** 拼出 CreateProcessAsUserW 要的命令行。 */
export function buildCommandLine(program: string, args: readonly string[]): string {
	return [program, ...args].map(quoteArg).join(" ");
}

/**
 * 构造 UTF-16LE 环境块：每项 `NAME=VALUE\0` 连排，末尾再一个 `\0`。
 *
 * **继承 process.env 后覆盖，不整体替换。** 整体替换会缺 SystemRoot 之类的
 * 基础变量，很多程序直接起不来（spike 里踩过：只传两个变量时必须手动补
 * SystemRoot）。我们只想改 TMP/TEMP，没理由动其余部分。
 */
export function buildEnvBlock(
	overrides: Readonly<Record<string, string>>,
	/** 环境块基底；缺省继承本进程的 process.env。诊断用自定义基底跑「最小环境」对照。 */
	base: Readonly<Record<string, string | undefined>> = process.env,
): Buffer {
	const merged: Record<string, string> = {};
	for (const [key, value] of Object.entries(base)) {
		if (value !== undefined) merged[key] = value;
	}
	for (const [key, value] of Object.entries(overrides)) merged[key] = value;
	const parts = Object.entries(merged).map(([key, value]) => `${key}=${value}\0`);
	return Buffer.from(`${parts.join("")}\0`, "utf16le");
}

interface PipePair {
	readonly read: NativePtr;
	readonly write: NativePtr;
}

function createPipe(api: Win32Bindings): PipePair {
	const readSlot = allocPtrSlot();
	const writeSlot = allocPtrSlot();
	try {
		if (api.createPipe(readSlot, writeSlot, null, 0) === 0) throwLastError(api, "CreatePipe");
		const read = decodePtr(readSlot);
		const write = decodePtr(writeSlot);
		if (read === null || write === null) {
			if (read !== null) api.closeHandle(read);
			if (write !== null) api.closeHandle(write);
			throwLastError(api, "CreatePipe", "管道句柄为空");
		}
		return { read, write };
	} finally {
		freeNative(writeSlot);
		freeNative(readSlot);
	}
}

/**
 * 建一个 kill-on-close 的 Job。
 *
 * kill-on-close 的语义：Job 的最后一个句柄关闭时，其**全部成员进程**被终止。
 * 我们持有唯一句柄，所以「关掉 Job 句柄」就是「杀掉整棵树」—— 超时与异常
 * 清理都走这一条路径，不需要逐个 TerminateProcess 去追孙进程。
 */
function createKillOnCloseJob(api: Win32Bindings): NativePtr {
	const job = api.createJobObjectW(null, null);
	if (isNullPtr(job)) throwLastError(api, "CreateJobObjectW");
	const information = Buffer.alloc(abi.JOBOBJECT_EXTENDED_LIMIT_SIZE);
	information.writeUInt32LE(abi.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, abi.JOBOBJECT_EXTENDED_LIMIT_FLAGS_OFFSET);
	if (
		api.setInformationJobObject(
			job,
			abi.JobObjectExtendedLimitInformation,
			information,
			information.length,
		) === 0
	) {
		const code = api.getLastError();
		api.closeHandle(job);
		throwWin32(api, "SetInformationJobObject", code, "kill-on-close");
	}
	return job;
}

/** 受限子进程：进程句柄、Job 句柄、两个输出管道读端，全部由调用方拥有。 */
export interface SpawnedChild {
	readonly pid: number;
	readonly process: NativePtr;
	readonly job: NativePtr;
	readonly stdoutRead: NativePtr;
	readonly stderrRead: NativePtr;
}

/**
 * 交互式窗口站的默认桌面。
 *
 * 受限令牌下 `lpDesktop` 必须有值，否则 PowerShell 死在 DLL 初始化
 * （`0xC0000142`）。codex 在不用私有桌面时也正是填这个值
 * （`windows-sandbox-rs/src/desktop.rs:210`）。
 *
 * 注意反斜杠：Win32 的桌面路径分隔符是 `\`，这里是 `Winsta0\Default`。
 */
export const DEFAULT_DESKTOP = "Winsta0\\Default";

export interface SpawnRequest {
	readonly command: string;
	readonly args: readonly string[];
	readonly cwd: string;
	readonly token: NativePtr;
	readonly env: Readonly<Record<string, string>>;
	/**
	 * 目标桌面。缺省 `Winsta0\Default`。
	 *
	 * **不要传空串或省略成 NULL** —— codex 记录受限令牌下不设它**可能**
	 * 死在 DLL 初始化（在我们的环境里实测设/不设无差别，见 StartupInfoFields）。
	 * 显式传 `null` 的能力只留给诊断脚本对照。
	 */
	readonly desktop?: string | null;
	/**
	 * 环境块基底；缺省（undefined）继承本进程的 process.env。
	 *
	 * 正常路径永远不传 —— 我们要的就是「继承后只覆盖 TMP/TEMP」。
	 * 诊断脚本用它跑「最小环境」对照：同一枚令牌、同一份代码，只差环境变量。
	 */
	readonly envBase?: Readonly<Record<string, string>>;
	/**
	 * 让子进程脱离调用方所在的 Job（Job 未禁止 breakaway 时才有效）。
	 *
	 * 诊断用：判别「调用链所在的 Job（可能带 UI 限制）是否为
	 * 受限子进程 DLL 初始化失败的成因」。正常路径不设。
	 */
	readonly breakawayFromJob?: boolean;
}

/**
 * 在受限令牌里拉起子进程：piped stdio + kill-on-close Job。
 *
 * 顺序是有讲究的：CREATE_SUSPENDED 起 → 入 Job → ResumeThread。
 * 先挂起是为了**堵住竞态** —— 若先跑起来再入 Job，子进程可能在这个空窗里
 * 已经 fork 出孙进程，那些孙进程不属于 Job，超时也杀不掉。
 *
 * stdin 给一个立即 EOF 的管道（写端随即关闭），这样交互式命令不会挂住等输入 ——
 * 与 powershell 工具 `-NonInteractive` 的取向一致：需要输入的命令直接失败。
 */
export function spawnConfined(api: Win32Bindings, request: SpawnRequest): SpawnedChild {
	const job = createKillOnCloseJob(api);
	let stdIn: PipePair | undefined;
	let stdOut: PipePair | undefined;
	let stdErr: PipePair | undefined;
	let startupInfo: NativePtr | undefined;
	let processInfo: NativePtr | undefined;

	/**
	 * 失败路径：关掉所有已开的句柄。关 Job 会连带杀掉可能已创建的进程。
	 *
	 * **幂等是必须的，不是保险**：Windows 句柄值会被回收复用，
	 * 二次关闭有可能关掉此刻恰好拿到同一数值的**别人的**句柄。
	 * 所以用标志位而不是「反正关两次没事」。
	 */
	let cleaned = false;
	const abandon = (): void => {
		if (cleaned) return;
		cleaned = true;
		for (const pair of [stdIn, stdOut, stdErr]) {
			if (pair === undefined) continue;
			api.closeHandle(pair.read);
			api.closeHandle(pair.write);
		}
		api.closeHandle(job);
	};

	try {
		stdIn = createPipe(api);
		stdOut = createPipe(api);
		stdErr = createPipe(api);

		// 只把子进程那一端标为可继承：读端留给我们，不能漏给子进程
		// （否则子进程持有 stdout 读端，我们永远等不到 EOF）。
		for (const [handle, label] of [
			[stdIn.read, "stdin 读端"],
			[stdOut.write, "stdout 写端"],
			[stdErr.write, "stderr 写端"],
		] as const) {
			if (api.setHandleInformation(handle, abi.HANDLE_FLAG_INHERIT, abi.HANDLE_FLAG_INHERIT) === 0) {
				throwLastError(api, "SetHandleInformation", label);
			}
		}

		startupInfo = allocStartupInfo();
		/*
		 * 显式给 lpDesktop，照 codex（windows-sandbox-rs/src/process.rs:121-124
		 * 记录：受限令牌下不设它时 PowerShell 可能死在 DLL 初始化 0xC0000142）。
		 *
		 * **诚实标注**：这不是 2026-09-15 那次回归的根因 —— 用生产代码做过四组
		 * 对照（read-only / workspace-write × 设 / 不设），在 utilityProcess 里
		 * 四组全部正常启动。所以这一行是照上游经验做的纵深防御，不是那次的解药，
		 * 真实根因另有其因，别把这行当成已解释该问题。
		 */
		const desktop = request.desktop === undefined ? DEFAULT_DESKTOP : request.desktop;
		encodeStartupInfo(startupInfo, {
			cb: abi.STARTUPINFOW_SIZE,
			dwFlags: abi.STARTF_USESTDHANDLES,
			hStdInput: stdIn.read,
			hStdOutput: stdOut.write,
			hStdError: stdErr.write,
			...(desktop === null ? {} : { lpDesktop: desktop }),
		});
		processInfo = allocProcessInfo();

		const created = api.createProcessAsUserW(
			request.token,
			null,
			buildCommandLine(request.command, request.args),
			null,
			null,
			1, // bInheritHandles
			// CREATE_UNICODE_ENVIRONMENT 与显式环境块配对，缺了就是 ERROR_INVALID_PARAMETER。
			abi.CREATE_SUSPENDED |
				abi.CREATE_UNICODE_ENVIRONMENT |
				// 不给子进程新建控制台：daemon 是 GUI 进程、没有宿主控制台可继承，
				// 不加这个标志时用户会看到「闪一下空终端」（理由与实测见 win32-abi.ts）。
				abi.CREATE_NO_WINDOW |
				// 诊断矩阵用：脱离调用链所在的 Job（Job 未禁止时才生效）。
				(request.breakawayFromJob === true ? abi.CREATE_BREAKAWAY_FROM_JOB : 0),
			// envBase 缺省时继承 process.env（正常路径）；诊断脚本可换基底。
			buildEnvBlock(request.env, request.envBase),
			request.cwd,
			startupInfo,
			processInfo,
		);
		if (created === 0) {
			const code = api.getLastError();
			abandon();
			throwWin32(api, "CreateProcessAsUserW", code, `${request.command} @ ${request.cwd}`);
		}

		const info = decodeProcessInfo(processInfo);
		if (info.hProcess === null || info.hThread === null) {
			if (info.hProcess !== null) api.terminateProcess(info.hProcess, 1);
			if (info.hThread !== null) api.closeHandle(info.hThread);
			if (info.hProcess !== null) api.closeHandle(info.hProcess);
			abandon();
			throw new Error(`CreateProcessAsUserW 成功但句柄为空（pid ${info.dwProcessId}）`);
		}

		// 入 Job 再恢复。失败要把已挂起的进程杀掉，不能留一个永远挂起的僵尸。
		const assigned = api.assignProcessToJobObject(job, info.hProcess);
		if (assigned === 0) {
			const code = api.getLastError();
			api.terminateProcess(info.hProcess, 1);
			api.closeHandle(info.hThread);
			api.closeHandle(info.hProcess);
			abandon();
			throwWin32(api, "AssignProcessToJobObject", code, `pid ${info.dwProcessId}`);
		}
		if (api.resumeThread(info.hThread) === abi.WAIT_FAILED) {
			const code = api.getLastError();
			api.closeHandle(info.hThread);
			api.closeHandle(info.hProcess);
			abandon();
			throwWin32(api, "ResumeThread", code, `pid ${info.dwProcessId}`);
		}
		api.closeHandle(info.hThread);

		/*
		 * 关掉父进程手里的写端与 stdin 两端。
		 * **这一步漏了就会挂死**：只要父进程还持有 stdout 写端的副本，
		 * 读端就永远收不到 EOF，drainPipe 会一直轮询到超时。
		 * stdin 两端都关 = 子进程读 stdin 立即 EOF。
		 */
		api.closeHandle(stdIn.read);
		api.closeHandle(stdIn.write);
		api.closeHandle(stdOut.write);
		api.closeHandle(stdErr.write);

		return {
			pid: info.dwProcessId,
			process: info.hProcess,
			job,
			stdoutRead: stdOut.read,
			stderrRead: stdErr.read,
		};
	} catch (error) {
		// createPipe / SetHandleInformation 抛出时走这里；CreateProcess 之后的
		// 失败分支已各自清理并抛出，不会重复关闭。
		if (processInfo === undefined) abandon();
		throw error;
	} finally {
		freeNative(processInfo);
		freeNative(startupInfo);
	}
}

/** 轮询间隔：从 1ms 起步，空闲时退避到 15ms。 */
const POLL_START_MS = 1;
const POLL_MAX_MS = 15;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 读干一个管道直到写端关闭；返回全部字节，句柄总是被关闭。
 *
 * 退避而不是固定 1ms 轮询（dsh 用固定 1ms）：一条 120 秒的命令会是 12 万次
 * 空转，而这是在 daemon 进程里，同一个事件循环还要服务 UI。
 * 有数据时立刻回到最小间隔，所以吞吐不受影响。
 */
export async function drainPipe(api: Win32Bindings, handle: NativePtr): Promise<Buffer> {
	const chunks: Buffer[] = [];
	const countSlot = allocUint32();
	let delay = POLL_START_MS;
	try {
		for (;;) {
			if (api.peekNamedPipe(handle, null, 0, null, countSlot, null) === 0) {
				const code = api.getLastError();
				// 这两个都是「写端没了」的正常终止，不是错误。
				if (code === abi.ERROR_BROKEN_PIPE || code === abi.ERROR_NO_DATA) break;
				throwWin32(api, "PeekNamedPipe", code, `已读 ${chunks.length} 块后失败`);
			}
			const available = decodeUint32(countSlot);
			if (available > 0) {
				const chunk = Buffer.alloc(available);
				if (api.readFile(handle, chunk, chunk.length, countSlot, null) === 0) {
					throwLastError(api, "ReadFile", `已读 ${chunks.length} 块后失败`);
				}
				chunks.push(chunk.subarray(0, decodeUint32(countSlot)));
				delay = POLL_START_MS;
			} else {
				delay = Math.min(delay * 2, POLL_MAX_MS);
			}
			await sleep(delay);
		}
		return Buffer.concat(chunks);
	} finally {
		freeNative(countSlot);
		api.closeHandle(handle);
	}
}

/** 进程是否已退出。用超时 0 的轮询，绝不阻塞 daemon 线程。 */
function hasExited(api: Win32Bindings, handle: NativePtr): boolean {
	const result = api.waitForSingleObject(handle, 0);
	if (result === abi.WAIT_OBJECT_0) return true;
	if (result === abi.WAIT_TIMEOUT) return false;
	throwLastError(api, "WaitForSingleObject");
}

/** 读退出码。进程句柄由调用方负责关闭。 */
function readExitCode(api: Win32Bindings, handle: NativePtr): number {
	const slot = allocUint32();
	try {
		if (api.getExitCodeProcess(handle, slot) === 0) throwLastError(api, "GetExitCodeProcess");
		return decodeUint32(slot);
	} finally {
		freeNative(slot);
	}
}

export interface WaitOutcome {
	/** 超时被杀时为 undefined —— 那时的退出码没有意义。 */
	readonly exitCode: number | undefined;
	readonly timedOut: boolean;
}

/**
 * 等子进程结束，超时则杀掉整棵树。
 *
 * 杀法是**关闭 Job 句柄**（kill-on-close）而不是 TerminateProcess：
 * 后者只杀直接子进程，`powershell -Command "node x.js"` 里的 node 会变孤儿。
 * 关 Job 之后管道随即 EOF，调用方的 drainPipe 自然收尾。
 */
export async function waitForChild(
	api: Win32Bindings,
	child: SpawnedChild,
	timeoutMs: number,
): Promise<WaitOutcome> {
	const deadline = Date.now() + timeoutMs;
	let delay = POLL_START_MS;
	// Job 句柄只能关一次：句柄值会被系统回收复用，二次关闭可能关掉此刻
	// 恰好拿到同一数值的别人的句柄。超时路径提前关（为了杀树），
	// 正常路径在 finally 里关（为了释放内核对象）—— 用标志区分。
	let jobClosed = false;
	const closeJobOnce = (): void => {
		if (jobClosed) return;
		jobClosed = true;
		api.closeHandle(child.job);
	};
	try {
		for (;;) {
			if (hasExited(api, child.process)) {
				return { exitCode: readExitCode(api, child.process), timedOut: false };
			}
			if (Date.now() >= deadline) {
				// 关 Job = 杀整棵树（见函数注释）；随后管道 EOF，drainPipe 自然收尾。
				closeJobOnce();
				return { exitCode: undefined, timedOut: true };
			}
			delay = Math.min(delay * 2, POLL_MAX_MS);
			await sleep(delay);
		}
	} finally {
		api.closeHandle(child.process);
		closeJobOnce();
	}
}
