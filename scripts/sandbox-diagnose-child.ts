/**
 * 沙箱诊断（第 4 版）：「外来 SID」判别。
 *
 * 第 3 版矩阵的定案（别再回头测）：
 *   - SID 值量级无关（dsh 官方小值 S-1-4-9000-4 同样失败）
 *   - console 子系统无关（cmd / node 同样失败）
 *   - Job 无关（IsProcessInJob = 否）
 *   - lpDesktop / 默认 DACL / 环境块 / 提权 —— 均已排除
 *
 * 第 4 版定案：外来 SID **进列表**无辜（G 过）；用外来 SID 做**授权受托者**
 * （默认 DACL + 文件 ACE）致命（C/基线）；身份内受托者（logon/Everyone/
 * 用户 SID）全部安全（D/E/F）。
 *
 * 本版矩阵定位毒在哪条授权路径上——这决定修法是保完整设计还是退一档：
 *   H1：默认 DACL 用外来受托者，temp 用 logon SID → 死=①中毒（保完整设计：
 *       文件授权保留 per-workspace SID，默认 DACL 改 logon SID）
 *   H2：默认 DACL 用 Everyone，temp 用外来受托者 → 死=②中毒（文件授权也得
 *       换 logon SID，隔离退化为按登录会话，写进文档）
 *   H3：双外来（≈C，已知失败，作锚点）
 *
 * 用法：npm run smoke:sandbox -- --diagnose
 */

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { grantWrite } from "../src/sandbox/acl.ts";
import {
	allocBytes,
	allocUint32,
	decodePtrAt,
	decodeUint32,
	decodeUint32At,
	decodeUint8At,
	freeNative,
	loadWin32,
	type NativePtr,
} from "../src/sandbox/ffi.ts";
import { prepareSandbox, sandboxPrivateTempDir } from "../src/sandbox/index.ts";
import { drainPipe, spawnConfined, waitForChild } from "../src/sandbox/spawn.ts";
import {
	createRestrictedToken,
	findLogonSid,
	makeWellKnownSid,
	openCurrentProcessToken,
	setTokenDefaultDaclGrant,
	sidFromString,
} from "../src/sandbox/token.ts";
import { WinWorldSid } from "../src/sandbox/win32-abi.ts";
import * as abi from "../src/sandbox/win32-abi.ts";
import { tempWriteSid, workspaceWriteSid } from "../src/sandbox/workspace-sid.ts";

interface Result {
	readonly name: string;
	readonly ok: boolean;
	readonly detail: string;
}

const results: Result[] = [];
const SENTINEL = 7;
const STATUS_DLL_INIT_FAILED = 0xc0000142;

function post(): void {
	(process as unknown as { parentPort: { postMessage: (m: unknown) => void } }).parentPort.postMessage(
		{ results },
	);
}

/** koffi 的最小形状（诊断脚本自用，与生产 ffi.ts 的那份互不影响）。 */
interface KoffiLike {
	load(path: string): { func(convention: string, name: string, result: unknown, args: unknown[]): unknown };
	pointer(type: unknown): unknown;
	alloc(type: unknown, count: number): unknown;
}

/**
 * SID 指针 → 字符串。手工解析 SID 结构（Revision/Count/IdentifierAuthority/
 * SubAuthorities），不引 ConvertSidToStringSidW 绑定——诊断显示用，
 * 生产 ffi.ts 不需要这个能力。内存由生产 ffi 的 decode*At 逐字节读。
 */
function sidToString(sid: NativePtr): string {
	const revision = decodeUint8At(sid, 0);
	const count = decodeUint8At(sid, 1);
	if (count > abi.SID_MAX_SUB_AUTHORITIES) return "(畸形 SID)";
	// IdentifierAuthority：6 字节大端（首 2 字节几乎恒 0）。
	const authority =
		decodeUint8At(sid, 2) * 0x10000000000 +
		decodeUint8At(sid, 3) * 0x100000000 +
		decodeUint8At(sid, 4) * 0x1000000 +
		decodeUint8At(sid, 5) * 0x10000 +
		decodeUint8At(sid, 6) * 0x100 +
		decodeUint8At(sid, 7);
	const parts: string[] = [];
	for (let index = 0; index < count; index += 1) {
		parts.push(String(decodeUint32At(sid, 8 + index * 4)));
	}
	return `S-${revision}-${authority}${parts.length > 0 ? `-${parts.join("-")}` : ""}`;
}

/** 环境事实：提权、用户 SID、Job、控制台、窗口站/桌面、完整环境（脱敏）。 */
async function environmentFacts(api: Awaited<ReturnType<typeof loadWin32>>): Promise<string> {
	const lines: string[] = [];

	try {
		const token = openCurrentProcessToken(api);
		try {
			const buffer = Buffer.alloc(4);
			const needed = allocUint32();
			try {
				// TokenElevation = 20
				if (api.getTokenInformation(token, 20, buffer, buffer.length, needed) === 0) {
					lines.push(`令牌提权状态 = (读取失败 Win32 ${api.getLastError()})`);
				} else {
					lines.push(`令牌提权状态 = ${buffer.readUInt32LE(0) !== 0 ? "已提权" : "未提权"}`);
				}
			} finally {
				freeNative(needed);
			}
		} finally {
			api.closeHandle(token);
		}
	} catch (error) {
		lines.push(`令牌探查失败：${error instanceof Error ? error.message : String(error)}`);
	}

	// 控制台 / 窗口站 / 桌面。
	try {
		const mod = (await import("koffi")) as unknown as { default?: KoffiLike };
		const koffi = mod.default ?? (mod as unknown as KoffiLike);
		const PVOID = koffi.pointer("void");
		const k32 = koffi.load("kernel32.dll");
		const user32 = koffi.load("user32.dll");
		const bind = (
			lib: ReturnType<KoffiLike["load"]>,
			name: string,
			ret: unknown,
			args: unknown[],
		): unknown => lib.func("__stdcall", name, ret, args);

		const getConsoleWindow = bind(k32, "GetConsoleWindow", PVOID, []) as () => bigint | null;
		const consoleWindow = getConsoleWindow();
		lines.push(
			`GetConsoleWindow = ${String(consoleWindow ?? 0n)}（${consoleWindow === null || consoleWindow === 0n ? "无控制台" : "有控制台"}）`,
		);

		const UOI_NAME = 2;
		const getProcessWindowStation = bind(user32, "GetProcessWindowStation", PVOID, []) as () => bigint;
		const getCurrentThreadId = bind(k32, "GetCurrentThreadId", "uint32", []) as () => number;
		const getThreadDesktop = bind(user32, "GetThreadDesktop", PVOID, ["uint32"]) as (id: number) => bigint;
		const getUserObjectInformationW = bind(user32, "GetUserObjectInformationW", "int", [
			PVOID, "int", PVOID, "uint32", koffi.pointer("uint32"),
		]) as (h: bigint, index: number, buf: Buffer, len: number, needed: unknown) => number;

		const readName = (handle: bigint, label: string): void => {
			if (handle === 0n) {
				lines.push(`${label} = (句柄为空)`);
				return;
			}
			const buffer = Buffer.alloc(512);
			const neededSlot = koffi.alloc("uint32", 1);
			if (getUserObjectInformationW(handle, UOI_NAME, buffer, buffer.length, neededSlot) === 0) {
				lines.push(`${label} = (读取失败)`);
				return;
			}
			const text = buffer.toString("utf16le");
			const nul = text.indexOf("\0");
			lines.push(`${label} = ${nul === -1 ? text : text.slice(0, nul)}`);
		};
		readName(getProcessWindowStation(), "窗口站");
		readName(getThreadDesktop(getCurrentThreadId()), "线程桌面");
	} catch (error) {
		lines.push(`环境探查失败：${error instanceof Error ? error.message : String(error)}`);
	}

	// 完整环境转储（疑似敏感的变量脱敏——这个输出会被整段贴给人看）。
	const SENSITIVE = /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH/i;
	const envDump = Object.entries(process.env)
		.filter(([, value]) => value !== undefined)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) =>
			SENSITIVE.test(key) ? `${key}=***（已脱敏）` : `${key}=${(value ?? "").slice(0, 160)}`,
		)
		.join("\n");
	lines.push("---- 完整环境 ----", envDump);
	return lines.join("\n");
}

type EnvSpec = { readonly kind: "inherit" };

function resolveEnv(
	spec: EnvSpec,
	privateTemp: string,
): { readonly env: Record<string, string> } {
	// 第 3 版已证明环境块无关，只保留继承形态。
	if (spec.kind === "inherit") return { env: { TMP: privateTemp, TEMP: privateTemp } };
	throw new Error(`未知环境规格：${JSON.stringify(spec)}`);
}

interface Variant {
	readonly name: string;
	readonly mode: "read-only" | "workspace-write";
	/** 进受限列表的 capability SID。 */
	readonly sids: readonly NativePtr[];
	/** 默认 DACL 授予的 SID。 */
	readonly daclGrant: NativePtr;
	/** 需要额外授 ACE 的目录。 */
	readonly extraGrant?: { readonly dir: string; readonly sid: NativePtr };
	readonly child: "powershell";
}

function describeExit(
	exitCode: number | null | undefined,
	timedOut: boolean,
	stdout: string,
	stderr: string,
): string {
	if (timedOut) return "超时";
	if (exitCode === null || exitCode === undefined) return "被终止，无退出码";
	const unsigned = exitCode >>> 0;
	const hex = `0x${unsigned.toString(16).toUpperCase().padStart(8, "0")}`;
	if (unsigned === STATUS_DLL_INIT_FAILED) return `${hex} STATUS_DLL_INIT_FAILED（进程没起来）`;
	if (exitCode === SENTINEL) return `${exitCode} ✓ 正常启动`;
	const tail = [stdout.trim(), stderr.trim()].filter((s) => s !== "").join(" / ");
	return `${exitCode}（${hex}）${tail === "" ? "" : `：${tail.slice(0, 100)}`}`;
}

async function main(): Promise<void> {
	const api = await loadWin32();
	results.push({ name: "环境事实", ok: true, detail: await environmentFacts(api) });

	const scratch = mkdtempSync(join(tmpdir(), "kami-diag-"));
	const workspace = join(scratch, "ws");
	mkdirSync(workspace);
	await prepareSandbox({ workspaceDir: workspace, writableDirs: [workspace] });
	const tempDir = await sandboxPrivateTempDir(workspace);

	const full = openCurrentProcessToken(api);
	const logonSid = findLogonSid(api, full);
	const worldSid = makeWellKnownSid(api, WinWorldSid);
	const wsSid = sidFromString(api, workspaceWriteSid(workspace));
	const tmpSid = sidFromString(api, tempWriteSid(tempDir));
	const foreignSid = sidFromString(api, "S-1-4-9999-1"); // 全系统无任何 ACE 指名它

	// 令牌用户 SID（行 F 用）。
	let userSid: NativePtr | undefined;
	try {
		const needed = allocUint32();
		try {
			// TokenUser = 1：两段式查询。
			api.getTokenInformation(full, 1, null, 0, needed);
			const size = decodeUint32(needed);
			const info = Buffer.alloc(size);
			if (api.getTokenInformation(full, 1, info, info.length, needed) === 0) {
				throw new Error(`GetTokenInformation(TokenUser) 失败 Win32 ${api.getLastError()}`);
			}
			const sidPtr = decodePtrAt(info, 0);
			if (sidPtr === null) throw new Error("TokenUser 为空");
			const length = api.getLengthSid(sidPtr);
			const copy = allocBytes(length);
			if (api.copySid(length, copy, sidPtr) === 0) {
				throw new Error(`CopySid 失败 Win32 ${api.getLastError()}`);
			}
			userSid = copy;
		} finally {
			freeNative(needed);
		}
	} catch (error) {
		results.push({
			name: "令牌用户 SID",
			ok: false,
			detail: error instanceof Error ? error.message : String(error),
		});
	}
	if (userSid !== undefined) {
		results.push({
			name: "capability SID 值",
			ok: true,
			detail:
				`workspace SID = ${workspaceWriteSid(workspace)}\n` +
				`temp SID      = ${tempWriteSid(tempDir)}\n` +
				`用户 SID      = ${sidToString(userSid)}\n` +
				`（行 F 用用户 SID；行 G 用 S-1-4-9999-1，全系统无任何 ACE 指名它）`,
		});
	}

	// 桌面固定 Default、环境固定完整（已证明非成因）。
	const variants: readonly Variant[] = [
		{ name: "锚点   | read-only", mode: "read-only", sids: [], daclGrant: worldSid, child: "powershell" },
		{ name: "锚点   | ws-write 双外来授权（已知失败）", mode: "workspace-write", sids: [wsSid, tmpSid], daclGrant: wsSid, child: "powershell" },
		{ name: "锚点   | 全 logon 授权（已知通过）", mode: "workspace-write", sids: [logonSid], daclGrant: logonSid, extraGrant: { dir: tempDir, sid: logonSid }, child: "powershell" },
		{ name: "锚点   | 外来SID无授权（G，已知通过）", mode: "workspace-write", sids: [foreignSid], daclGrant: worldSid, extraGrant: { dir: tempDir, sid: logonSid }, child: "powershell" },
		{
			name: "判别H1 | 默认DACL外来 + temp用logon ← ①中毒？",
			mode: "workspace-write",
			sids: [foreignSid],
			daclGrant: foreignSid,
			extraGrant: { dir: tempDir, sid: logonSid },
			child: "powershell",
		},
		{
			name: "判别H2 | 默认DACL用Everyone + temp外来 ← ②中毒？",
			mode: "workspace-write",
			sids: [foreignSid],
			daclGrant: worldSid,
			extraGrant: { dir: tempDir, sid: foreignSid },
			child: "powershell",
		},
		{
			name: "锚点   | 双外来授权（H3，已知失败）",
			mode: "workspace-write",
			sids: [foreignSid],
			daclGrant: foreignSid,
			extraGrant: { dir: tempDir, sid: foreignSid },
			child: "powershell",
		},
	];

	try {
		for (const variant of variants) {
			let token: NativePtr | undefined;
			try {
				token = createRestrictedToken(api, full, logonSid, worldSid, variant.sids, variant.mode);
				setTokenDefaultDaclGrant(api, token, variant.daclGrant);
				if (variant.extraGrant !== undefined) {
					grantWrite(api, variant.extraGrant.dir, variant.extraGrant.sid);
				}
				const resolved = resolveEnv({ kind: "inherit" }, tempDir);
				const child = spawnConfined(api, {
					command: "powershell.exe",
					args: ["-NoProfile", "-NonInteractive", "-Command", `exit ${SENTINEL}`],
					cwd: workspace,
					token,
					env: resolved.env,
					desktop: "Winsta0\\Default",
				});
				const [out, err, waited] = await Promise.all([
					drainPipe(api, child.stdoutRead),
					drainPipe(api, child.stderrRead),
					waitForChild(api, child, 30_000),
				]);
				results.push({
					name: variant.name,
					ok: waited.exitCode === SENTINEL,
					detail: describeExit(waited.exitCode, waited.timedOut, out.toString("utf8"), err.toString("utf8")),
				});
			} catch (error) {
				results.push({
					name: variant.name,
					ok: false,
					detail: `抛错：${error instanceof Error ? error.message : String(error)}`,
				});
			} finally {
				if (token !== undefined) api.closeHandle(token);
			}
		}

		// 对照：完整令牌。
		try {
			const child = spawnConfined(api, {
				command: "powershell.exe",
				args: ["-NoProfile", "-NonInteractive", "-Command", `exit ${SENTINEL}`],
				cwd: workspace,
				token: full,
				env: { TMP: tempDir, TEMP: tempDir },
				desktop: "Winsta0\\Default",
			});
			const [out, err, waited] = await Promise.all([
				drainPipe(api, child.stdoutRead),
				drainPipe(api, child.stderrRead),
				waitForChild(api, child, 30_000),
			]);
			results.push({
				name: "对照：完整令牌（非受限）",
				ok: waited.exitCode === SENTINEL,
				detail: describeExit(waited.exitCode, waited.timedOut, out.toString("utf8"), err.toString("utf8")),
			});
		} catch (error) {
			results.push({
				name: "对照：完整令牌（非受限）",
				ok: false,
				detail: `抛错：${error instanceof Error ? error.message : String(error)}`,
			});
		}
	} finally {
		api.closeHandle(full);
		freeNative(foreignSid);
		freeNative(wsSid);
		freeNative(tmpSid);
		freeNative(worldSid);
		freeNative(logonSid);
		if (userSid !== undefined) freeNative(userSid);
		rmSync(scratch, { recursive: true, force: true });
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// 清理噪音不影响诊断结论。
		}
	}
}

main()
	.catch((error: unknown) => {
		results.push({
			name: "未预期异常",
			ok: false,
			detail: error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error),
		});
	})
	.finally(post);
