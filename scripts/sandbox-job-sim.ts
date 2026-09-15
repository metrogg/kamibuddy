/**
 * Job 成员关系模拟：在本机复现「调用链处于 Job 中」的启动环境。
 *
 * 动机：诊断矩阵证明 `0xC0000142` 只在特定启动上下文出现，而上下文的
 * 头号嫌疑是 Job——IDE 终端可能把进程树放进 Job，受限子进程会被自动拉入。
 * 我的 utilityProcess 实测「不在任何 Job 中」（IsProcessInJob = 否），
 * 无法本地复现；这个驱动把整条 smoke 链塞进一个 Job，看矩阵是否翻红。
 *
 * 结构：本驱动（node）→ CreateProcessW(CREATE_SUSPENDED) 拉起 node/tsx
 * → AssignProcessToJobObject → ResumeThread。Job 成员随进程树自动继承，
 * 所以 electron → utilityProcess → 受限子进程 全部落在 Job 里。
 *
 * 可调（环境变量）：
 *   JOB_UI=1  额外加 JOB_OBJECT_UILIMIT_HANDLES（可能把 electron 本身打死——
 *             那本身也是有效数据）
 *
 * 用法：npx tsx scripts/sandbox-job-sim.ts [--diagnose]
 */

import koffi from "koffi";
import { join, resolve } from "node:path";

const PVOID = koffi.pointer("void");
const PUINT32 = koffi.pointer("uint32");

const STARTUPINFOW = koffi.struct("JS_STARTUPINFOW", {
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
const PROCESS_INFORMATION = koffi.struct("JS_PROCESS_INFORMATION", {
	hProcess: PVOID,
	hThread: PVOID,
	dwProcessId: "uint32",
	dwThreadId: "uint32",
});

const k32 = koffi.load("kernel32.dll");
const bind = (name: string, ret: unknown, args: unknown[]): unknown =>
	k32.func("__stdcall", name, ret as never, args as never);

const createJobObjectW = bind("CreateJobObjectW", PVOID, [PVOID, "str16"]) as (
	a: null,
	b: null,
) => bigint | null;
const setInformationJobObject = bind("SetInformationJobObject", "int", [
	PVOID, "int", PVOID, "uint32",
]) as (job: bigint, cls: number, info: Buffer, len: number) => number;
const createProcessW = bind("CreateProcessW", "int", [
	"str16", "str16", PVOID, PVOID, "int", "uint32", PVOID, "str16",
	koffi.pointer(STARTUPINFOW), koffi.pointer(PROCESS_INFORMATION),
]) as (
	app: null, cmd: string, pa: null, ta: null, inherit: number, flags: number,
	env: null, cwd: string | null, si: unknown, pi: unknown,
) => number;
const assignProcessToJobObject = bind("AssignProcessToJobObject", "int", [PVOID, PVOID]) as (
	job: bigint,
	process: bigint,
) => number;
const resumeThread = bind("ResumeThread", "uint32", [PVOID]) as (thread: bigint) => number;
const waitForSingleObject = bind("WaitForSingleObject", "uint32", [PVOID, "uint32"]) as (
	handle: bigint,
	ms: number,
) => number;
const getExitCodeProcess = bind("GetExitCodeProcess", "int", [PVOID, PUINT32]) as (
	handle: bigint,
	slot: unknown,
) => number;
const closeHandle = bind("CloseHandle", "int", [PVOID]) as (handle: bigint) => number;
const getLastError = bind("GetLastError", "uint32", []) as () => number;
const getStdHandle = bind("GetStdHandle", PVOID, ["int"]) as (which: number) => bigint | null;
const getCurrentProcess = bind("GetCurrentProcess", PVOID, []) as () => bigint;
const duplicateHandle = bind("DuplicateHandle", "int", [
	PVOID, PVOID, PVOID, koffi.pointer(PVOID), "uint32", "int", "uint32",
]) as (src1: bigint, src: bigint, dst1: bigint, target: unknown, access: number, inherit: number, options: number) => number;

/**
 * 复制出可继承的 stdio 句柄副本。
 *
 * Node 的 stdio 管道句柄默认**不可继承**——直接塞进 STARTUPINFOW 等于传空气，
 * 子进程拿无效句柄、输出全部丢失（本驱动第一次跑就是静默退出，踩过）。
 */
function inheritable(stdWhich: number): bigint | null {
	const handle = getStdHandle(stdWhich);
	if (handle === null || handle === 0n) return null;
	const target = koffi.alloc(PVOID, 1);
	const ok = duplicateHandle(
		getCurrentProcess(), handle, getCurrentProcess(), target,
		0, 1 /* bInheritHandle */, 2 /* DUPLICATE_SAME_ACCESS */,
	);
	if (ok === 0) return null;
	const duplicated = koffi.decode(target, PVOID) as bigint | null;
	return duplicated ?? null;
}

const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION = 9;
const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
const JOB_OBJECT_BASIC_UI_RESTRICTIONS = 4;
const JOB_OBJECT_UILIMIT_HANDLES = 0x1;
const CREATE_SUSPENDED = 0x4;
const STARTUPINFOW_SIZE = 104;

function fail(message: string): never {
	console.error(`[job-sim] ${message}（Win32 ${getLastError()}）`);
	process.exit(1);
}

const ROOT = resolve(import.meta.dirname, "..");
const jobUi = process.env["JOB_UI"] === "1";

/* ── 建 Job ────────────────────────────────────────────────────── */

const job = createJobObjectW(null, null);
if (job === null || job === 0n) fail("CreateJobObjectW 失败");

// 扩展限制：kill-on-close（驱动退出时把整棵链带走）。
const limits = Buffer.alloc(144);
limits.writeUInt32LE(JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, 16);
if (setInformationJobObject(job, JOB_OBJECT_EXTENDED_LIMIT_INFORMATION, limits, limits.length) === 0) {
	fail("SetInformationJobObject(extended) 失败");
}

if (jobUi) {
	const ui = Buffer.alloc(4);
	ui.writeUInt32LE(JOB_OBJECT_UILIMIT_HANDLES, 0);
	if (setInformationJobObject(job, JOB_OBJECT_BASIC_UI_RESTRICTIONS, ui, ui.length) === 0) {
		fail("SetInformationJobObject(UI) 失败");
	}
}

/* ── 挂起启动 smoke 链 ─────────────────────────────────────────── */

const node = process.execPath;
const commandLine =
	`"${node}" "${join(ROOT, "node_modules", "tsx", "dist", "cli.mjs")}" ` +
	`"${join(ROOT, "scripts", "smoke-sandbox.ts")}" ${process.argv.slice(2).join(" ")}`;

const si = koffi.alloc(STARTUPINFOW as never, 1);
/*
 * 显式传可继承的 stdio 句柄（STARTF_USESTDHANDLES）。
 *
 * 驱动跑在管道化的 shell 里（没有真实控制台），不传的话 console 子进程
 * 会去开一个**新的隐藏控制台**——输出全部消失、smoke 的 stdio inherit
 * 拿到无效句柄，整条链静默退出（踩过）。
 */
const STD_INPUT_HANDLE = -10;
const STD_OUTPUT_HANDLE = -11;
const STD_ERROR_HANDLE = -12;
koffi.encode(si, STARTUPINFOW, {
	cb: STARTUPINFOW_SIZE,
	dwFlags: 0x100, // STARTF_USESTDHANDLES
	hStdInput: inheritable(STD_INPUT_HANDLE),
	hStdOutput: inheritable(STD_OUTPUT_HANDLE),
	hStdError: inheritable(STD_ERROR_HANDLE),
});
const pi = koffi.alloc(PROCESS_INFORMATION as never, 1);

// CREATE_SUSPENDED：先挂起再入 Job，杜绝「子进程已跑起来还没入 Job」的竞态。
const created = createProcessW(null, commandLine, null, null, 1, CREATE_SUSPENDED, null, ROOT, si, pi);
if (created === 0) fail(`CreateProcessW 失败：${commandLine}`);

const info = koffi.decode(pi, PROCESS_INFORMATION);
if (info.hProcess === null || info.hThread === null) fail("进程句柄为空");

if (assignProcessToJobObject(job, info.hProcess) === 0) {
	const code = getLastError();
	closeHandle(info.hThread);
	closeHandle(info.hProcess);
	fail(`AssignProcessToJobObject 失败（Win32 ${code}）`);
}
resumeThread(info.hThread);
closeHandle(info.hThread);

console.log(
	`[job-sim] smoke 链已在 Job 中启动（pid ${info.dwProcessId}，UI限制=${jobUi ? "HANDLES" : "无"}）。输出：\n`,
);

waitForSingleObject(info.hProcess, 600_000);
const slot = koffi.alloc("uint32", 1);
getExitCodeProcess(info.hProcess, slot);
const exitCode = koffi.decode(slot, "uint32") as number;
closeHandle(info.hProcess);
closeHandle(job);

console.log(`\n[job-sim] 链退出码 ${exitCode}`);
process.exit(exitCode === 0 ? 0 : 1);
