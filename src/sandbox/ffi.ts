/**
 * koffi 绑定表与内存编解码工具。
 *
 * 三处相对 dsh 的有意偏离，都是因为运行环境不同：
 *
 * 1. **koffi 用动态 import，且加载失败必须可捕获。** dsh 那份跑在独立的 runner
 *    进程里，加载失败让进程崩掉即可；我们住在 daemon（utilityProcess）里，
 *    而 extensions/ 会无条件 import 本层 —— 顶层静态 import 一旦抛错，
 *    整个 daemon 连同所有会话一起挂。所以 koffi 只在 loadWin32() 内部动态加载，
 *    失败降级为 `ffi-load-failed` 上报，powershell 退回不经沙箱执行。
 *
 * 2. **两张绑定表合并成一张。** dsh 拆成 win32-process（通用进程）与
 *    sandbox-windows-acl（令牌/ACL）两个包，是为了让前者能被别处复用；
 *    我们只有一个消费者，拆包只剩 extendWin32ProcessBindings 那层间接。
 *
 * 3. **lpEnvironment 放宽为可接受 Buffer**（dsh 写死 null）。理由见
 *    win32-abi.ts 的 CREATE_UNICODE_ENVIRONMENT 注释 —— 我们不能用它那套
 *    「改自己进程的 TMP/TEMP 让子进程继承」的办法。
 *
 * 其余照搬 dsh（MIT），包括它踩坑注释里的事实。
 */

import { Buffer } from "node:buffer";
import {
	ERROR_INSUFFICIENT_BUFFER,
	FORMAT_MESSAGE_FROM_SYSTEM,
	FORMAT_MESSAGE_IGNORE_INSERTS,
	MAX_PATH,
	PROCESS_INFORMATION_SIZE,
	SID_MAX_SUB_AUTHORITIES,
	STARTUPINFOW_SIZE,
} from "./win32-abi.ts";

declare const nativePtrBrand: unique symbol;
/**
 * koffi 的原生指针。加品牌是为了防止和普通数字/bigint 混用 ——
 * 把地址当整数运算过一次就会得到无效指针，而症状是随机崩溃。
 */
export type NativePtr = bigint & { readonly [nativePtrBrand]: true };

/** Win32 调用失败。带上 API 名与错误码，便于直接对照 MSDN。 */
export class Win32Error extends Error {
	constructor(
		readonly api: string,
		readonly code: number,
		detail?: string,
	) {
		super(`${api} 失败（Win32 ${code}${detail === undefined || detail === "" ? "" : `：${detail}`}）`);
		this.name = "Win32Error";
	}
}

/** koffi 加载失败（非 Windows、缺预编译产物、或 Electron 环境不兼容）。 */
export class FfiUnavailableError extends Error {
	constructor(detail: string) {
		super(`无法加载 Win32 FFI：${detail}`);
		this.name = "FfiUnavailableError";
	}
}

/* ── 绑定表 ──────────────────────────────────────────────────────── */

/**
 * 本层用到的全部 Win32 调用。
 *
 * 参数类型用 koffi 的字符串/指针描述，这里的 TS 签名只是给调用方看的门面；
 * 真正的 ABI 正确性由 koffi 的绑定声明 + win32-abi.ts 的尺寸断言共同保证。
 */
export interface Win32Bindings {
	/* 句柄与错误 */
	closeHandle(handle: NativePtr): number;
	getLastError(): number;
	formatMessageW(
		flags: number,
		source: null,
		messageId: number,
		languageId: number,
		buffer: Buffer,
		size: number,
		args: null,
	): number;

	/* 令牌 */
	openProcess(desiredAccess: number, inheritHandle: number, pid: number): NativePtr;
	openProcessToken(process: NativePtr, desiredAccess: number, tokenHandle: NativePtr): number;
	getTokenInformation(
		token: NativePtr,
		cls: number,
		info: Buffer | null,
		length: number,
		needed: NativePtr,
	): number;
	setTokenInformation(token: NativePtr, cls: number, info: Buffer, length: number): number;
	createRestrictedToken(
		existing: NativePtr,
		flags: number,
		disableCount: number,
		disableSids: null,
		deletePrivilegeCount: number,
		privilegesToDelete: null,
		restrictCount: number,
		restrictingSids: Buffer,
		newToken: NativePtr,
	): number;

	/* SID */
	convertStringSidToSidW(stringSid: string, sid: NativePtr): number;
	createWellKnownSid(type: number, domainSid: null, sid: NativePtr, size: NativePtr): number;
	isValidSid(sid: NativePtr): number;
	getLengthSid(sid: NativePtr): number;
	copySid(length: number, destination: NativePtr, source: NativePtr): number;

	/* ACL */
	localAlloc(flags: number, bytes: number): NativePtr;
	localFree(memory: NativePtr): NativePtr;
	setEntriesInAclW(count: number, entries: Buffer, oldAcl: NativePtr | null, newAcl: NativePtr): number;
	getNamedSecurityInfoW(
		path: string,
		objectType: number,
		information: number,
		owner: NativePtr,
		group: NativePtr,
		dacl: NativePtr,
		sacl: NativePtr,
		descriptor: NativePtr,
	): number;
	setNamedSecurityInfoW(
		path: string,
		objectType: number,
		information: number,
		owner: null,
		group: null,
		dacl: NativePtr | null,
		sacl: null,
	): number;

	/* 文件锁（ACL 编辑的并发保护） */
	createFileW(
		fileName: string,
		desiredAccess: number,
		shareMode: number,
		attributes: null,
		creationDisposition: number,
		flagsAndAttributes: number,
		templateFile: null,
	): NativePtr;
	lockFileEx(
		file: NativePtr,
		flags: number,
		reserved: number,
		bytesLow: number,
		bytesHigh: number,
		overlapped: NativePtr,
	): number;
	unlockFileEx(
		file: NativePtr,
		reserved: number,
		bytesLow: number,
		bytesHigh: number,
		overlapped: NativePtr,
	): number;
	getTempPathW(length: number, buffer: Buffer): number;

	/* 卷信息（探测 FAT —— 那种卷没有 ACL，沙箱会静默无效） */
	getVolumePathNameW(fileName: string, volumePathName: Buffer, bufferLength: number): number;
	getVolumeInformationW(
		rootPathName: string,
		volumeNameBuffer: null,
		volumeNameSize: number,
		serialNumber: null,
		maxComponentLength: null,
		fileSystemFlags: null,
		fileSystemNameBuffer: Buffer,
		fileSystemNameSize: number,
	): number;

	/* 进程与 stdio */
	createPipe(readHandle: NativePtr, writeHandle: NativePtr, attributes: null, size: number): number;
	setHandleInformation(handle: NativePtr, mask: number, flags: number): number;
	/**
	 * environment 允许传 Buffer（**dsh 写死 null，这是有意偏离**）。
	 * 传 Buffer 时创建标志必须含 CREATE_UNICODE_ENVIRONMENT，否则 Win32 会按
	 * ANSI 解释 UTF-16 块并回 ERROR_INVALID_PARAMETER。
	 */
	createProcessAsUserW(
		token: NativePtr,
		applicationName: null,
		commandLine: string,
		processAttributes: null,
		threadAttributes: null,
		inheritHandles: number,
		creationFlags: number,
		environment: Buffer | null,
		currentDirectory: string | null,
		startupInfo: NativePtr,
		processInfo: NativePtr,
	): number;
	readFile(file: NativePtr, buffer: Buffer, count: number, bytesRead: NativePtr, overlapped: null): number;
	peekNamedPipe(
		pipe: NativePtr,
		buffer: null,
		size: number,
		bytesRead: NativePtr | null,
		totalAvail: NativePtr,
		leftThisMessage: NativePtr | null,
	): number;
	waitForSingleObject(handle: NativePtr, milliseconds: number): number;
	getExitCodeProcess(process: NativePtr, exitCode: NativePtr): number;
	terminateProcess(process: NativePtr, exitCode: number): number;
	resumeThread(thread: NativePtr): number;

	/* Job Object（超时杀进程树 + 环境检测） */
	createJobObjectW(attributes: null, name: null): NativePtr;
	setInformationJobObject(job: NativePtr, cls: number, information: Buffer, length: number): number;
	assignProcessToJobObject(job: NativePtr, process: NativePtr): number;
	/**
	 * 查询进程是否在某个 Job 里。job 传 null 表示「任意 Job」。
	 *
	 * 环境自检需要它：IDE/终端可能把进程树放进带 UI 限制的 Job，
	 * 受限令牌子进程被自动拉入后 USER32 初始化会失败 —— 这是
	 * 2026-09-15 那个 `0xC0000142` 只在某些启动环境出现的头号嫌疑。
	 */
	isProcessInJob(process: NativePtr, job: NativePtr | null, result: NativePtr): number;
	/**
	 * 查询 Job 的信息类。**job 传 null = 查调用进程自己所在的 Job**（MSDN 语义），
	 * 所以不需要拿到 Job 句柄就能读出 UI 限制。
	 */
	queryInformationJobObject(
		job: NativePtr | null,
		cls: number,
		information: Buffer,
		length: number,
		returnLength: NativePtr | null,
	): number;
}

/** koffi 模块的最小形状（只声明我们用到的部分，避免依赖它的完整类型）。 */
interface Koffi {
	load(path: string): { func(convention: string, name: string, result: unknown, args: unknown[]): unknown };
	pointer(type: unknown): unknown;
	struct(name: string, fields: Record<string, unknown>): { size: number };
	alloc(type: unknown, count: number): unknown;
	free(ptr: unknown): void;
	encode(target: unknown, ...rest: unknown[]): void;
	decode(source: unknown, ...rest: unknown[]): unknown;
	address(ptr: unknown): bigint;
}

interface Loaded {
	readonly koffi: Koffi;
	readonly api: Win32Bindings;
	readonly startupInfo: { size: number };
	readonly processInfo: { size: number };
	readonly pvoid: unknown;
}

let loaded: Loaded | undefined;

/**
 * 加载并缓存绑定表。幂等：重复调用返回同一张表。
 *
 * 失败抛 FfiUnavailableError（而不是让模块加载期崩掉）—— 调用方据此报
 * `ffi-load-failed` 并降级，见文件头理由 1。
 */
export async function loadWin32(): Promise<Win32Bindings> {
	if (loaded !== undefined) return loaded.api;
	loaded = await initialize();
	return loaded.api;
}

/**
 * 取已加载的绑定表。未加载过就抛 —— 这是编程错误（应先 await loadWin32），
 * 不是运行时环境问题，所以不用 FfiUnavailableError。
 */
function requireLoaded(): Loaded {
	if (loaded === undefined) {
		throw new Error("Win32 绑定尚未加载：请先 await loadWin32()");
	}
	return loaded;
}

async function initialize(): Promise<Loaded> {
	let koffi: Koffi;
	try {
		const mod = (await import("koffi")) as unknown as { default?: Koffi };
		const resolved = mod.default ?? (mod as unknown as Koffi);
		if (typeof resolved.load !== "function") {
			throw new Error("koffi 模块形状异常：没有 load 函数");
		}
		koffi = resolved;
	} catch (error) {
		throw new FfiUnavailableError(error instanceof Error ? error.message : String(error));
	}

	let kernel32: ReturnType<Koffi["load"]>;
	let advapi32: ReturnType<Koffi["load"]>;
	try {
		kernel32 = koffi.load("kernel32.dll");
		advapi32 = koffi.load("advapi32.dll");
	} catch (error) {
		// 非 Windows 走这条路（拿不到系统 DLL）。
		throw new FfiUnavailableError(error instanceof Error ? error.message : String(error));
	}

	const PVOID = koffi.pointer("void");
	const PPVOID = koffi.pointer(PVOID);
	const PUINT32 = koffi.pointer("uint32");

	const startupInfo = koffi.struct("KAMI_STARTUPINFOW", {
		cb: "uint32",
		lpReserved: "str16",
		lpDesktop: "str16",
		lpTitle: "str16",
		dwX: "uint32",
		dwY: "uint32",
		dwXSize: "uint32",
		dwYSize: "uint32",
		dwXCountChars: "uint32",
		dwYCountChars: "uint32",
		dwFillAttribute: "uint32",
		dwFlags: "uint32",
		wShowWindow: "uint16",
		cbReserved2: "uint16",
		lpReserved2: koffi.pointer("uint8"),
		hStdInput: PVOID,
		hStdOutput: PVOID,
		hStdError: PVOID,
	});
	const processInfo = koffi.struct("KAMI_PROCESS_INFORMATION", {
		hProcess: PVOID,
		hThread: PVOID,
		dwProcessId: "uint32",
		dwThreadId: "uint32",
	});

	/*
	 * 布局断言：koffi 算出的尺寸与 win32-abi.ts 的期望值必须一致。
	 * 不符说明 ABI 假设崩了（换架构、koffi 改了对齐规则），此时**必须响亮失败** ——
	 * 用错误布局调 CreateProcessAsUserW 是内存破坏级别的问题，
	 * 而症状会是难以归因的随机崩溃。
	 */
	if (startupInfo.size !== STARTUPINFOW_SIZE) {
		throw new FfiUnavailableError(
			`STARTUPINFOW 布局不符：koffi 算出 ${startupInfo.size} 字节，期望 ${STARTUPINFOW_SIZE}`,
		);
	}
	if (processInfo.size !== PROCESS_INFORMATION_SIZE) {
		throw new FfiUnavailableError(
			`PROCESS_INFORMATION 布局不符：koffi 算出 ${processInfo.size} 字节，期望 ${PROCESS_INFORMATION_SIZE}`,
		);
	}

	// __stdcall：x64 上虽然只有一种调用约定，但显式写出与 MSDN 的 WINAPI 对应，
	// 也这份绑定表在 ia32 上仍然正确。
	const bind = (
		lib: ReturnType<Koffi["load"]>,
		name: string,
		result: unknown,
		args: unknown[],
	): unknown => lib.func("__stdcall", name, result, args);

	const api = {
		closeHandle: bind(kernel32, "CloseHandle", "int", [PVOID]),
		getLastError: bind(kernel32, "GetLastError", "uint32", []),
		formatMessageW: bind(kernel32, "FormatMessageW", "uint32", [
			"uint32", PVOID, "uint32", "uint32", PVOID, "uint32", PVOID,
		]),

		openProcess: bind(kernel32, "OpenProcess", PVOID, ["uint32", "int", "uint32"]),
		openProcessToken: bind(advapi32, "OpenProcessToken", "int", [PVOID, "uint32", PPVOID]),
		getTokenInformation: bind(advapi32, "GetTokenInformation", "int", [
			PVOID, "int", PVOID, "uint32", PUINT32,
		]),
		setTokenInformation: bind(advapi32, "SetTokenInformation", "int", [PVOID, "int", PVOID, "uint32"]),
		createRestrictedToken: bind(advapi32, "CreateRestrictedToken", "int", [
			PVOID, "uint32", "uint32", PVOID, "uint32", PVOID, "uint32", PVOID, PPVOID,
		]),

		convertStringSidToSidW: bind(advapi32, "ConvertStringSidToSidW", "int", ["str16", PPVOID]),
		createWellKnownSid: bind(advapi32, "CreateWellKnownSid", "int", ["int", PVOID, PVOID, PUINT32]),
		isValidSid: bind(advapi32, "IsValidSid", "int", [PVOID]),
		getLengthSid: bind(advapi32, "GetLengthSid", "uint32", [PVOID]),
		copySid: bind(advapi32, "CopySid", "int", ["uint32", PVOID, PVOID]),

		localAlloc: bind(kernel32, "LocalAlloc", PVOID, ["uint32", "size_t"]),
		localFree: bind(kernel32, "LocalFree", PVOID, [PVOID]),
		setEntriesInAclW: bind(advapi32, "SetEntriesInAclW", "uint32", ["uint32", PVOID, PVOID, PPVOID]),
		getNamedSecurityInfoW: bind(advapi32, "GetNamedSecurityInfoW", "uint32", [
			"str16", "int", "uint32", PPVOID, PPVOID, PPVOID, PPVOID, PPVOID,
		]),
		setNamedSecurityInfoW: bind(advapi32, "SetNamedSecurityInfoW", "uint32", [
			"str16", "int", "uint32", PVOID, PVOID, PVOID, PVOID,
		]),

		createFileW: bind(kernel32, "CreateFileW", PVOID, [
			"str16", "uint32", "uint32", PVOID, "uint32", "uint32", PVOID,
		]),
		lockFileEx: bind(kernel32, "LockFileEx", "int", [PVOID, "uint32", "uint32", "uint32", "uint32", PVOID]),
		unlockFileEx: bind(kernel32, "UnlockFileEx", "int", [PVOID, "uint32", "uint32", "uint32", PVOID]),
		getTempPathW: bind(kernel32, "GetTempPathW", "uint32", ["uint32", PVOID]),

		getVolumePathNameW: bind(kernel32, "GetVolumePathNameW", "int", ["str16", PVOID, "uint32"]),
		getVolumeInformationW: bind(kernel32, "GetVolumeInformationW", "int", [
			"str16", PVOID, "uint32", PVOID, PVOID, PVOID, PVOID, "uint32",
		]),

		createPipe: bind(kernel32, "CreatePipe", "int", [PPVOID, PPVOID, PVOID, "uint32"]),
		setHandleInformation: bind(kernel32, "SetHandleInformation", "int", [PVOID, "uint32", "uint32"]),
		createProcessAsUserW: bind(advapi32, "CreateProcessAsUserW", "int", [
			PVOID, "str16", "str16", PVOID, PVOID, "int", "uint32", PVOID, "str16",
			koffi.pointer(startupInfo), koffi.pointer(processInfo),
		]),
		readFile: bind(kernel32, "ReadFile", "int", [PVOID, PVOID, "uint32", PUINT32, PVOID]),
		peekNamedPipe: bind(kernel32, "PeekNamedPipe", "int", [
			PVOID, PVOID, "uint32", PUINT32, PUINT32, PUINT32,
		]),
		waitForSingleObject: bind(kernel32, "WaitForSingleObject", "uint32", [PVOID, "uint32"]),
		getExitCodeProcess: bind(kernel32, "GetExitCodeProcess", "int", [PVOID, PUINT32]),
		terminateProcess: bind(kernel32, "TerminateProcess", "int", [PVOID, "uint32"]),
		resumeThread: bind(kernel32, "ResumeThread", "uint32", [PVOID]),

		createJobObjectW: bind(kernel32, "CreateJobObjectW", PVOID, [PVOID, "str16"]),
		setInformationJobObject: bind(kernel32, "SetInformationJobObject", "int", [
			PVOID, "int", PVOID, "uint32",
		]),
		assignProcessToJobObject: bind(kernel32, "AssignProcessToJobObject", "int", [PVOID, PVOID]),
		isProcessInJob: bind(kernel32, "IsProcessInJob", "int", [PVOID, PVOID, PUINT32]),
		queryInformationJobObject: bind(kernel32, "QueryInformationJobObject", "int", [
			PVOID, "int", PVOID, "uint32", PUINT32,
		]),
	} as unknown as Win32Bindings;

	return { koffi, api, startupInfo, processInfo, pvoid: PVOID };
}

/* ── 分配与编解码 ────────────────────────────────────────────────── */

export function isNullPtr(value: NativePtr | null | undefined): value is null | undefined {
	return value === null || value === undefined || (value as bigint) === 0n;
}

/**
 * CreateFileW 是否返回了 INVALID_HANDLE_VALUE。
 *
 * 它不是 0 而是全 1（-1），所以 isNullPtr 判不出来 —— 单独一个函数是因为
 * 这个特例只属于 CreateFileW 家族，混进 isNullPtr 会让别处误用。
 */
export function isInvalidHandle(handle: NativePtr | null | undefined): boolean {
	if (isNullPtr(handle)) return true;
	return (handle as bigint) === 0xffffffffffffffffn || (handle as bigint) === -1n;
}

/** 分配一个指针大小的 out 参数槽。 */
export function allocPtrSlot(): NativePtr {
	const { koffi, pvoid } = requireLoaded();
	return koffi.alloc(pvoid, 1) as NativePtr;
}

/** 分配一个 uint32 out 参数槽。 */
export function allocUint32(): NativePtr {
	const { koffi } = requireLoaded();
	return koffi.alloc("uint32", 1) as NativePtr;
}

/** 分配一块原始字节（SID 缓冲等）。 */
export function allocBytes(length: number): NativePtr {
	const { koffi } = requireLoaded();
	return koffi.alloc("uint8", length) as NativePtr;
}

/**
 * 分配一个清零的 x64 OVERLAPPED（32 字节）。
 *
 * 为什么不直接传 NULL：dsh 记录 koffi 3.1.1 在 LockFileEx/UnlockFileEx 收到 NULL
 * 时会崩。对同步句柄来说，全零的 OVERLAPPED 语义等价于「从偏移 0 开始、无事件」，
 * 所以给一块清零内存既绕开那个坑又不改语义。
 */
export function allocOverlapped(): NativePtr {
	return allocBytes(32);
}

/** 释放 koffi 分配的内存。 */
export function freeNative(ptr: NativePtr | null | undefined): void {
	if (ptr === null || ptr === undefined) return;
	requireLoaded().koffi.free(ptr);
}

export function encodeUint32(slot: NativePtr, value: number): void {
	requireLoaded().koffi.encode(slot, "uint32", value);
}

export function decodePtr(slot: NativePtr): NativePtr | null {
	const { koffi, pvoid } = requireLoaded();
	const value = koffi.decode(slot, pvoid) as NativePtr | null;
	return isNullPtr(value) ? null : value;
}

export function decodeUint32(slot: NativePtr): number {
	return requireLoaded().koffi.decode(slot, "uint32") as number;
}

/** 从 Buffer 的指定偏移解出一个指针（TOKEN_GROUPS 里逐条读 SID 指针用）。 */
export function decodePtrAt(buffer: Buffer, offset: number): NativePtr | null {
	const { koffi, pvoid } = requireLoaded();
	const value = koffi.decode(buffer, offset, pvoid) as NativePtr | null;
	return isNullPtr(value) ? null : value;
}

export function decodeUint8At(ptr: NativePtr, offset: number): number {
	return requireLoaded().koffi.decode(ptr, offset, "uint8") as number;
}

export function decodeUint16At(ptr: NativePtr, offset: number): number {
	return requireLoaded().koffi.decode(ptr, offset, "uint16") as number;
}

export function decodeUint32At(ptr: NativePtr, offset: number): number {
	return requireLoaded().koffi.decode(ptr, offset, "uint32") as number;
}

/** 取指针的数值地址（往结构体里打包指针字段时用）。 */
export function ptrAddress(ptr: NativePtr): bigint {
	return requireLoaded().koffi.address(ptr);
}

/* ── 结构体：STARTUPINFOW / PROCESS_INFORMATION ─────────────────── */

export interface StartupInfoFields {
	readonly cb: number;
	readonly dwFlags: number;
	readonly hStdInput: NativePtr;
	readonly hStdOutput: NativePtr;
	readonly hStdError: NativePtr;
	/**
	 * 目标桌面（`"Winsta0\\Default"` 或私有桌面名）。
	 *
	 * codex 在 `windows-sandbox-rs/src/process.rs:121-124` 记录：受限令牌下
	 * 不设它时 PowerShell **可能**死在 DLL 初始化（`0xC0000142`），
	 * 且它在不用私有桌面时也照样填 `Winsta0\Default`。我们照做，作为纵深防御。
	 *
	 * **但实测（2026-09-15，Win11 26100 + Electron 44 utilityProcess）：
	 * 设与不设都能正常启动 —— 在我们的环境里它不是决定性因素。**
	 * 真正让 PowerShell 起不来的是缺少 `setTokenDefaultDaclGrant`
	 * （诊断矩阵里唯一翻转结果的变量）。别把这个字段当成 `0xC0000142` 的解药。
	 *
	 * 留成可选是为了让诊断脚本能对照有/无两种情况。
	 */
	readonly lpDesktop?: string;
}

export interface ProcessInfoFields {
	readonly hProcess: NativePtr | null;
	readonly hThread: NativePtr | null;
	readonly dwProcessId: number;
	readonly dwThreadId: number;
}

export function allocStartupInfo(): NativePtr {
	const { koffi, startupInfo } = requireLoaded();
	return koffi.alloc(startupInfo, 1) as NativePtr;
}

export function encodeStartupInfo(slot: NativePtr, fields: StartupInfoFields): void {
	const { koffi, startupInfo } = requireLoaded();
	koffi.encode(slot, startupInfo, fields);
}

export function allocProcessInfo(): NativePtr {
	const { koffi, processInfo } = requireLoaded();
	return koffi.alloc(processInfo, 1) as NativePtr;
}

export function decodeProcessInfo(slot: NativePtr): ProcessInfoFields {
	const { koffi, processInfo } = requireLoaded();
	return koffi.decode(slot, processInfo) as ProcessInfoFields;
}

/* ── SID 比较 ────────────────────────────────────────────────────── */

/**
 * 逐字段比较两处内存里的 SID，不分配字符串。
 *
 * 为什么不用 EqualSid：ACE 里的 SID 是**内联**的（紧跟在 4 字节掩码之后），
 * 不是指针 —— 按指针读会拿到垃圾地址并让 EqualSid 崩掉（dsh 用 gdb 验过）。
 * 所以只能按偏移读字段：Revision@0、SubAuthorityCount@1、
 * IdentifierAuthority@2（6 字节）、SubAuthority[]@8（每个 4 字节）。
 */
export function sameSidAt(
	left: NativePtr,
	leftOffset: number,
	right: NativePtr,
	rightOffset: number,
): boolean {
	if (decodeUint8At(left, leftOffset) !== decodeUint8At(right, rightOffset)) return false;
	const leftCount = decodeUint8At(left, leftOffset + 1);
	const rightCount = decodeUint8At(right, rightOffset + 1);
	// 上限校验防止畸形数据让循环读到界外。
	if (leftCount !== rightCount || leftCount > SID_MAX_SUB_AUTHORITIES) return false;
	for (let index = 0; index < 6; index += 1) {
		if (decodeUint8At(left, leftOffset + 2 + index) !== decodeUint8At(right, rightOffset + 2 + index)) {
			return false;
		}
	}
	for (let index = 0; index < leftCount; index += 1) {
		if (
			decodeUint32At(left, leftOffset + 8 + index * 4) !==
			decodeUint32At(right, rightOffset + 8 + index * 4)
		) {
			return false;
		}
	}
	return true;
}

/* ── 错误报告 ────────────────────────────────────────────────────── */

/** 把 Win32 错误码翻成系统文案；拿不到就返回空串（不让格式化失败盖住原始错误）。 */
export function errorText(api: Win32Bindings, code: number): string {
	const buffer = Buffer.alloc(1024);
	const length = api.formatMessageW(
		FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS,
		null,
		code,
		0,
		buffer,
		buffer.length / 2,
		null,
	);
	return length === 0 ? "" : buffer.subarray(0, length * 2).toString("utf16le").trim();
}

/**
 * 抛出当前的 GetLastError。
 *
 * **每个 Win32 调用的返回值都必须检查并走到这里**：上游 POC
 * （huoyaoyuan/windows-acl-restrict-poc）漏检返回值，失败时**拿完整令牌
 * 跑了子进程** —— 沙箱静默失效。fail-closed 是这一层的第一原则。
 */
export function throwLastError(api: Win32Bindings, name: string, detail?: string): never {
	const code = api.getLastError();
	throw new Win32Error(name, code, detail ?? errorText(api, code));
}

/**
 * 抛出一个**已捕获**的错误码。
 *
 * 与 throwLastError 分开是因为清理动作（CloseHandle 等）会覆盖 GetLastError ——
 * 出错后要先把码存下来再清理，否则报出来的是清理动作的结果。
 */
export function throwWin32(api: Win32Bindings, name: string, code: number, detail?: string): never {
	throw new Win32Error(name, code, detail ?? errorText(api, code));
}

/** 读取当前的 Windows 临时目录（ACL 锁文件的存放位置）。 */
export function getTempPath(api: Win32Bindings): string {
	// MAX_PATH + 1：MSDN 要求给 GetTempPathW 留出尾部反斜杠与 NUL 的位置。
	const buffer = Buffer.alloc((MAX_PATH + 1) * 2);
	const length = api.getTempPathW(buffer.length / 2, buffer);
	if (length === 0) throwLastError(api, "GetTempPathW");
	if (length > buffer.length / 2) {
		throw new Win32Error(
			"GetTempPathW",
			ERROR_INSUFFICIENT_BUFFER,
			`需要 ${length} 字符，超过 ${buffer.length / 2} 字符的缓冲；什么都没写入`,
		);
	}
	return buffer.subarray(0, length * 2).toString("utf16le");
}
