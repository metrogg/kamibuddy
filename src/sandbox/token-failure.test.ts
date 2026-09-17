/**
 * 受限令牌派生的**失败路径**矩阵（桩绑定表，不碰真 Win32 调用）。
 *
 * 为什么需要这一层：token.ts 的第一原则是 fail-closed（每个 Win32 调用的返回值
 * 都检，任何失败都抛），而这条纪律此前**只在成功路径上有集成测试**
 * （confinement.win.test.ts 真起受限子进程）。失败路径在开发机上永远走不到 ——
 * 一旦有人删掉某个返回值检查，集成测试照样全绿，沙箱却会静默失效
 * （上游 POC huoyaoyuan/windows-acl-restrict-poc 正是这么漏的：失败时
 * 拿**完整令牌**跑了子进程）。
 *
 * 所以这里逐条制造失败，断言四件事：
 *   1. 抛的是 Win32Error 且点名了是哪个 API（原因码分类靠这个 API 名，见 index.ts 的 classifyFailure）；
 *   2. 错误码是**失败时**取的那个，没被清理动作（CloseHandle）覆盖；
 *   3. 已经拿到手的资源被关掉/释放（句柄、LocalAlloc 块）；
 *   4. 越界/畸形输入不会被当成成功（尺寸查询说谎、句柄为空、DACL 为空）。
 *
 * 对照物：dsh `packages/sandbox/sandbox-windows-acl/tests/token-failure-paths.spec.ts`。
 * 桩表只提供被测函数会走到的那几个调用；没有真实 Win32 调用，但仍要 koffi 内存
 * （ffi.ts 的 allocPtrSlot/allocBytes/decode 工具都要求绑定表已加载），故整组
 * 限定在 Windows —— 与 confinement.win.test.ts 同一取向。
 */

import { describe, expect, it, beforeAll, vi } from "vitest";
import * as koffiNamespace from "koffi";

import {
	allocBytes,
	encodeUint32,
	loadWin32,
	ptrAddress,
	Win32Error,
	type NativePtr,
	type Win32Bindings,
} from "./ffi.ts";
import {
	createRestrictedToken,
	findLogonSid,
	makeWellKnownSid,
	openCurrentProcessToken,
	setTokenDefaultDaclGrant,
	sidFromString,
} from "./token.ts";
import * as abi from "./win32-abi.ts";

const isWindows = process.platform === "win32";

/** koffi 是 CJS：运行时 default 与命名空间两种形态都可能出现（ffi.ts 里也这么兜）。 */
const koffi = (
	(koffiNamespace as unknown as { readonly default?: typeof koffiNamespace }).default ?? koffiNamespace
);
const PVOID = koffi.pointer("void");

/** 往 out 参数槽里写一个指针（`decodePtr` 的写侧；ffi.ts 没导出这个方向的工具）。 */
function writePtr(slot: NativePtr, value: bigint): void {
	koffi.encode(slot, PVOID, value);
}

/**
 * 只提供默认值的桩绑定表；被测函数走到哪条分支，就在用例里补哪个调用。
 *
 * formatMessageW 一律返回 0：错误文案为空串，于是断言只盯 API 名与错误码，
 * 不受系统文案影响。
 */
function stubApi(overrides: Partial<Win32Bindings>): Win32Bindings {
	return {
		getLastError: () => 5,
		formatMessageW: () => 0,
		closeHandle: () => 1,
		localFree: () => 0n as NativePtr,
		...overrides,
	} as unknown as Win32Bindings;
}

/**
 * 断言**抛了** Win32Error 且点名指定 API。
 *
 * 用「没抛就失败」而不是 `rejects.toThrow`：这些函数大多是同步的，
 * 而这里要同时钉住「异常类型」与「API 名」两件事（后者是原因码判别的唯一依据）。
 */
function expectWin32Error(action: () => unknown, api: string): Win32Error {
	let caught: unknown;
	try {
		action();
	} catch (error) {
		caught = error;
	}
	expect(caught, `${api} 的失败没有被抛出来（fail-closed 要求它必须抛）`).toBeInstanceOf(Win32Error);
	const error = caught as Win32Error;
	expect(error.api, "报出来的 API 名必须是失败的那个调用").toBe(api);
	return error;
}

describe.skipIf(!isWindows)("token.ts 失败路径", () => {
	beforeAll(async () => {
		// 用例要用 ffi.ts 的分配/解码工具（koffi 内存），先把绑定表加载起来。
		await loadWin32();
	});

	describe("openCurrentProcessToken", () => {
		it("OpenProcess 拿不到句柄时响亮失败", () => {
			const api = stubApi({ openProcess: () => 0n as NativePtr });
			expectWin32Error(() => openCurrentProcessToken(api), "OpenProcess");
		});

		it("OpenProcessToken 失败时关掉进程句柄，且错误码是失败那一刻的（没被 CloseHandle 覆盖）", () => {
			// CloseHandle 会覆盖 GetLastError —— 实现里先取码再清理。若顺序写反，
			// 报出来的是清理动作的结果，排查方向直接指歪。
			let lastError = 5;
			const closeHandle = vi.fn(() => {
				lastError = 6;
				return 1;
			});
			const api = stubApi({
				openProcess: () => 7n as NativePtr,
				openProcessToken: () => 0,
				closeHandle,
				getLastError: () => lastError,
			});
			const error = expectWin32Error(() => openCurrentProcessToken(api), "OpenProcessToken");
			expect(error.code).toBe(5);
			expect(closeHandle).toHaveBeenCalledWith(7n);
		});

		it("OpenProcessToken 报成功却写回空句柄时也算失败（不当成有效令牌）", () => {
			const api = stubApi({ openProcess: () => 7n as NativePtr, openProcessToken: () => 1 });
			expectWin32Error(() => openCurrentProcessToken(api), "OpenProcessToken");
		});
	});

	/** findLogonSid 需要的桩：两段式调用，第二段把 TOKEN_GROUPS 填进缓冲。 */
	function logonApi(state: {
		readonly needed: number;
		readonly groupCount: number;
		readonly sidPtr: bigint;
		readonly logon: boolean;
		readonly secondOk?: boolean;
		readonly sidLength?: number;
		readonly copyOk?: boolean;
	}): { readonly api: Win32Bindings; readonly copySid: ReturnType<typeof vi.fn> } {
		const copySid = vi.fn(() => (state.copyOk === false ? 0 : 1));
		const api = stubApi({
			getTokenInformation: (_token, cls, info, _length, needed) => {
				if (cls !== abi.TokenGroups) throw new Error(`非预期的信息类：${cls}`);
				if (info === null) {
					encodeUint32(needed, state.needed);
					return 0; // 尺寸查询预期就是「失败」
				}
				if (state.secondOk === false) return 0;
				info.writeUInt32LE(state.groupCount, 0);
				if (state.groupCount > 0) {
					info.writeBigUInt64LE(state.sidPtr, abi.TOKEN_GROUPS_OFFSET);
					info.writeUInt32LE(
						state.logon ? abi.SE_GROUP_LOGON_ID : 0,
						abi.TOKEN_GROUPS_OFFSET + 8,
					);
				}
				return 1;
			},
			getLengthSid: () => state.sidLength ?? 12,
			copySid,
		});
		return { api, copySid };
	}

	describe("findLogonSid", () => {
		const token = 9n as NativePtr;

		it("尺寸查询什么都没写时按失败处理", () => {
			const { api } = logonApi({ needed: 0, groupCount: 0, sidPtr: 0n, logon: false });
			expectWin32Error(() => findLogonSid(api, token), "GetTokenInformation");
		});

		it("尺寸小得不可能容纳 TOKEN_GROUPS 头时按失败处理（不拿它去分配）", () => {
			const { api } = logonApi({ needed: 4, groupCount: 0, sidPtr: 0n, logon: false });
			expectWin32Error(() => findLogonSid(api, token), "GetTokenInformation");
		});

		it("第二段读组信息失败时响亮失败", () => {
			const { api } = logonApi({
				needed: 24,
				groupCount: 1,
				sidPtr: 77n,
				logon: true,
				secondOk: false,
			});
			expectWin32Error(() => findLogonSid(api, token), "GetTokenInformation");
		});

		it("组里有空 SID 指针时跳过；一个登录 SID 都找不到就抛（不返回空令牌）", () => {
			const { api } = logonApi({ needed: 24, groupCount: 1, sidPtr: 0n, logon: true });
			expect(() => findLogonSid(api, token)).toThrow(/找不到登录 SID/u);
		});

		it("组属性不带登录 ID 标志时跳过", () => {
			const { api } = logonApi({ needed: 24, groupCount: 1, sidPtr: 77n, logon: false });
			expect(() => findLogonSid(api, token)).toThrow(/找不到登录 SID/u);
		});

		it("**位 31 置位的组属性（SE_GROUP_LOGON_ID）也认得出来** —— 两边都要 >>>0", () => {
			/*
			 * SE_GROUP_LOGON_ID = 0xC0000000，而 JS 的位运算是**有符号 32 位**：
			 * `attributes & SE_GROUP_LOGON_ID` 得到的是 -1073741824，
			 * 与 0xC0000000（3221225472）永远不相等。漏一次 >>>0 的后果是
			 * **每个真实令牌上都找不到登录 SID** —— 沙箱直接不可用（而非失效），
			 * 但排查方向会被引到「令牌组里没有登录 SID」这种不存在的现象上。
			 */
			const { api } = logonApi({ needed: 24, groupCount: 1, sidPtr: 77n, logon: true });
			expect(findLogonSid(api, token)).not.toBeNull();
		});

		it("拿到登录 SID 后复制一份再返回（不许返回指向组缓冲内部的悬空指针）", () => {
			const { api, copySid } = logonApi({ needed: 24, groupCount: 1, sidPtr: 77n, logon: true });
			const copy = findLogonSid(api, token);
			expect(copySid).toHaveBeenCalledWith(12, copy, 77n);
			expect(copy).not.toBe(77n);
		});

		it("SID 长度为 0 时按失败处理", () => {
			const { api } = logonApi({
				needed: 24,
				groupCount: 1,
				sidPtr: 77n,
				logon: true,
				sidLength: 0,
			});
			expectWin32Error(() => findLogonSid(api, token), "GetLengthSid");
		});

		it("CopySid 失败时响亮失败", () => {
			const { api } = logonApi({
				needed: 24,
				groupCount: 1,
				sidPtr: 77n,
				logon: true,
				copyOk: false,
			});
			expectWin32Error(() => findLogonSid(api, token), "CopySid");
		});
	});

	describe("makeWellKnownSid", () => {
		it("CreateWellKnownSid 失败时响亮失败", () => {
			const api = stubApi({ createWellKnownSid: () => 0 });
			expectWin32Error(() => makeWellKnownSid(api, abi.WinWorldSid), "CreateWellKnownSid");
		});

		it("造出来的 SID 通不过 IsValidSid 时更要失败（不许把垃圾当 SID 用）", () => {
			const api = stubApi({ createWellKnownSid: () => 1, isValidSid: () => 0 });
			expectWin32Error(() => makeWellKnownSid(api, abi.WinWorldSid), "IsValidSid");
		});
	});

	describe("sidFromString", () => {
		function stringApi(state: {
			readonly localAllocated: bigint;
			readonly convertOk?: boolean;
			readonly sidLength?: number;
			readonly copyOk?: boolean;
		}): {
			readonly api: Win32Bindings;
			readonly localFree: ReturnType<typeof vi.fn>;
			readonly copySid: ReturnType<typeof vi.fn>;
		} {
			const localFree = vi.fn(() => 0n as NativePtr);
			const copySid = vi.fn(() => (state.copyOk === false ? 0 : 1));
			const api = stubApi({
				convertStringSidToSidW: (_text, slot) => {
					if (state.convertOk === false) return 0;
					writePtr(slot, state.localAllocated);
					return 1;
				},
				getLengthSid: () => state.sidLength ?? 12,
				copySid,
				localFree,
			});
			return { api, localFree, copySid };
		}

		it("ConvertStringSidToSidW 失败时响亮失败", () => {
			const { api } = stringApi({ localAllocated: 0n, convertOk: false });
			expectWin32Error(() => sidFromString(api, "S-1-4-1-1"), "ConvertStringSidToSidW");
		});

		it("报成功却回空指针时也算失败", () => {
			const { api } = stringApi({ localAllocated: 0n });
			expectWin32Error(() => sidFromString(api, "S-1-4-1-1"), "ConvertStringSidToSidW");
		});

		it("SID 长度为 0 时按失败处理", () => {
			const { api } = stringApi({ localAllocated: 42n, sidLength: 0 });
			expectWin32Error(() => sidFromString(api, "S-1-4-1-1"), "GetLengthSid");
		});

		it("CopySid 失败时响亮失败", () => {
			const { api } = stringApi({ localAllocated: 42n, copyOk: false });
			expectWin32Error(() => sidFromString(api, "S-1-4-1-1"), "CopySid");
		});

		it("**所有权收敛**：返回的是本地副本，Windows 那块立刻 LocalFree（调用方只需 freeNative）", () => {
			/*
			 * 相对 dsh 的有意改动：上游把 LocalAlloc 那块直接返回给调用方，
			 * 于是「这个 SID 该用 LocalFree 还是 freeNative」变成必须逐个记住的事，
			 * 混用就是堆破坏。这里收敛成「一律 koffi 内存」——
			 * 漏掉 CopySid 或漏掉 LocalFree 都必须在测试里变红。
			 */
			const { api, localFree, copySid } = stringApi({ localAllocated: 42n });
			const copy = sidFromString(api, "S-1-4-1-1");
			expect(localFree).toHaveBeenCalledWith(42n);
			expect(copySid).toHaveBeenCalledWith(12, copy, 42n);
			expect(copy).not.toBe(42n);
		});
	});

	describe("setTokenDefaultDaclGrant", () => {
		const token = 9n as NativePtr;
		const sid = 77n as NativePtr;

		function daclApi(state: {
			readonly needed: number;
			readonly currentDacl: bigint;
			readonly newDacl: bigint;
			readonly secondOk?: boolean;
			readonly mergeResult?: number;
			readonly setTokenInfo?: number;
		}): { readonly api: Win32Bindings; readonly localFree: ReturnType<typeof vi.fn> } {
			const localFree = vi.fn(() => 0n as NativePtr);
			const api = stubApi({
				getTokenInformation: (_token, cls, info, _length, needed) => {
					if (cls !== abi.TokenDefaultDacl) throw new Error(`非预期的信息类：${cls}`);
					if (info === null) {
						encodeUint32(needed, state.needed);
						return 0; // 尺寸查询预期就是「失败」
					}
					if (state.secondOk === false) return 0;
					info.writeBigUInt64LE(state.currentDacl, 0);
					return 1;
				},
				setEntriesInAclW: (_count, _entries, _old, newAcl) => {
					if (state.mergeResult !== undefined && state.mergeResult !== abi.ERROR_SUCCESS) {
						return state.mergeResult;
					}
					writePtr(newAcl, state.newDacl);
					return abi.ERROR_SUCCESS;
				},
				setTokenInformation: () => state.setTokenInfo ?? 1,
				localFree,
			});
			return { api, localFree };
		}

		it("尺寸查询什么都没写时按失败处理", () => {
			const { api } = daclApi({ needed: 0, currentDacl: 0n, newDacl: 0n });
			expectWin32Error(() => setTokenDefaultDaclGrant(api, token, sid), "GetTokenInformation");
		});

		it("读默认 DACL 失败时响亮失败", () => {
			const { api } = daclApi({ needed: 8, currentDacl: 88n, newDacl: 0n, secondOk: false });
			expectWin32Error(() => setTokenDefaultDaclGrant(api, token, sid), "GetTokenInformation");
		});

		it("令牌没有默认 DACL 时抛（用户组策略把默认 DACL 抹掉的情形）", () => {
			const { api } = daclApi({ needed: 8, currentDacl: 0n, newDacl: 0n });
			expect(() => setTokenDefaultDaclGrant(api, token, sid)).toThrow(/没有默认 DACL/u);
		});

		it("SetEntriesInAclW 合并失败时响亮失败", () => {
			const { api } = daclApi({ needed: 8, currentDacl: 88n, newDacl: 0n, mergeResult: 5 });
			expectWin32Error(() => setTokenDefaultDaclGrant(api, token, sid), "SetEntriesInAclW");
		});

		it("合并结果为空指针时也算失败", () => {
			const { api } = daclApi({ needed: 8, currentDacl: 88n, newDacl: 0n });
			expectWin32Error(() => setTokenDefaultDaclGrant(api, token, sid), "SetEntriesInAclW");
		});

		it("SetTokenInformation 失败时**先释放合并出来的 DACL 再抛**（不漏堆）", () => {
			const { api, localFree } = daclApi({
				needed: 8,
				currentDacl: 88n,
				newDacl: 99n,
				setTokenInfo: 0,
			});
			expectWin32Error(() => setTokenDefaultDaclGrant(api, token, sid), "SetTokenInformation");
			expect(localFree).toHaveBeenCalledWith(99n);
		});

		it("成功路径也把合并出来的 DACL 释放掉（SetTokenInformation 会先复制走）", () => {
			const { api, localFree } = daclApi({ needed: 8, currentDacl: 88n, newDacl: 99n });
			setTokenDefaultDaclGrant(api, token, sid);
			expect(localFree).toHaveBeenCalledWith(99n);
		});
	});

	describe("createRestrictedToken", () => {
		/** 记录 createRestrictedToken 收到的受限 SID 列表。 */
		function capture(): {
			readonly api: Win32Bindings;
			readonly seen: { count?: number; packed?: Buffer };
		} {
			const seen: { count?: number; packed?: Buffer } = {};
			const api = stubApi({
				createRestrictedToken: (_existing, _flags, _dc, _ds, _pc, _pd, count, sids, slot) => {
					seen.count = count;
					seen.packed = sids;
					writePtr(slot, 9n);
					return 1;
				},
			});
			return { api, seen };
		}

		it("read-only 档只放登录 SID + Everyone（写 SID 不进列表 —— 降档不漏权靠这条）", () => {
			const { api, seen } = capture();
			const logon = allocBytes(12);
			const world = allocBytes(12);
			expect(createRestrictedToken(api, 1n as NativePtr, logon, world, [], "read-only")).toBe(9n);
			expect(seen.count).toBe(2);
		});

		it("workspace-write 档把写 SID 追加进列表，且打包的是 SID 的**地址**（16 字节步长、属性位为 0）", () => {
			const { api, seen } = capture();
			const logon = allocBytes(12);
			const world = allocBytes(12);
			const write = allocBytes(12);
			createRestrictedToken(api, 1n as NativePtr, logon, world, [write], "workspace-write");

			expect(seen.count).toBe(3);
			const packed = seen.packed as Buffer;
			expect(packed.readBigUInt64LE(0)).toBe(ptrAddress(logon));
			expect(packed.readBigUInt64LE(abi.SID_AND_ATTRIBUTES_SIZE)).toBe(ptrAddress(world));
			expect(packed.readBigUInt64LE(abi.SID_AND_ATTRIBUTES_SIZE * 2)).toBe(ptrAddress(write));
			// 属性位留 0：这些 SID 是「受限列表」，不是「禁用/只用于拒绝」的组。
			expect(packed.readBigUInt64LE(8)).toBe(0n);
		});

		it("workspace-write 却没有写 SID 时拒绝派生（不许静默降级成 read-only）", () => {
			const { api } = capture();
			expect(() =>
				createRestrictedToken(api, 1n as NativePtr, allocBytes(12), allocBytes(12), [], "workspace-write"),
			).toThrow(/至少需要一个写 SID/u);
		});

		it("CreateRestrictedToken 失败时响亮失败", () => {
			const api = stubApi({ createRestrictedToken: () => 0 });
			expectWin32Error(
				() => createRestrictedToken(api, 1n as NativePtr, allocBytes(12), allocBytes(12), [], "read-only"),
				"CreateRestrictedToken",
			);
		});

		it("报成功却写回空令牌句柄时也算失败", () => {
			const api = stubApi({ createRestrictedToken: () => 1 });
			expectWin32Error(
				() => createRestrictedToken(api, 1n as NativePtr, allocBytes(12), allocBytes(12), [], "read-only"),
				"CreateRestrictedToken",
			);
		});
	});
});
