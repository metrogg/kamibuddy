/**
 * ACL 授权链路的**失败路径**矩阵（桩绑定表，不碰真 Win32 调用）。
 *
 * 为什么需要这一层：prepareSandbox 的每一次授权都是「读 DACL → 合并 → 写回」，
 * 而这条链路上任何一步被静默忽略都等于**假边界**（目录看起来授过权、实际没有）。
 * 集成测试（confinement.win.test.ts）只在**能真起受限子进程**的环境里覆盖成功路径，
 * 失败路径在开发机上永远走不到 —— 于是「删掉某个返回值检查」这类回归
 * 只有这里能拦住。
 *
 * 覆盖三类：
 *   1. 锁（withPathLock）：拿不到锁文件、锁不上、以及「解锁失败不许盖住结果」；
 *   2. 授权（grantWrite/revokeWrite）：合并/写回失败必须抛且释放已分配的内存，
 *      快路径（ACE 已存在）命中与**落空**的分界（落空 = 每次会话重新传播整棵树）；
 *   3. 内存契约：descriptor（LocalAlloc 块）、合并后的 ACL、out 参数槽各自的
 *      释放责任 —— 漏一处是堆破坏，多释放一次也是堆破坏。
 *
 * 对照物：dsh `packages/sandbox/sandbox-windows-acl/tests/acl-failure-paths.spec.ts`。
 * 依赖 koffi 内存（ffi.ts 的 allocBytes/decode 工具），故限定在 Windows。
 */

import { tmpdir } from "node:os";
import { describe, expect, it, beforeAll, vi } from "vitest";
import * as koffiNamespace from "koffi";

import {
	buildExplicitAccess,
	grantWrite,
	lockFilePath,
	revokeWrite,
	withPathLock,
} from "./acl.ts";
import { allocBytes, loadWin32, ptrAddress, Win32Error, type NativePtr, type Win32Bindings } from "./ffi.ts";
import * as abi from "./win32-abi.ts";

const isWindows = process.platform === "win32";

/** 一个待授权的目录路径（不真访问磁盘，全部经桩返回）。 */
const GRANTED = "C:\\Users\\foo\\KamiBuddy";

/** koffi 是 CJS：运行时 default 与命名空间两种形态都可能出现（ffi.ts 里也这么兜）。 */
const koffi = (
	(koffiNamespace as unknown as { readonly default?: typeof koffiNamespace }).default ?? koffiNamespace
);
const PVOID = koffi.pointer("void");

/** 往 out 参数槽里写一个指针（`decodePtr` 的写侧）。 */
function writePtr(slot: NativePtr, value: bigint): void {
	koffi.encode(slot, PVOID, value);
}

/**
 * 桩绑定表 + 默认成功路径：目录**没有显式 DACL**（于是合并路径会从零建一个），
 * 合并得到一个假 ACL 指针 9n，写回成功。每个用例按需覆盖其中一处制造失败。
 *
 * getTempPathW 指向真实系统 temp：锁文件目录的 mkdirSync 是真的（路径判定那几条
 * 断言才有意义），但锁文件本身从不由桩真正锁定。
 */
function baseApi(overrides: Partial<Win32Bindings> = {}): Win32Bindings {
	/** 类型写成 Partial<Win32Bindings>，箭头参数才有上下文类型。 */
	const defaults: Partial<Win32Bindings> = {
		getTempPathW: (_length, buffer) => {
			const temp = tmpdir();
			buffer.write(temp, "utf16le");
			return temp.length;
		},
		createFileW: () => 7n as NativePtr,
		lockFileEx: () => 1,
		unlockFileEx: () => 1,
		closeHandle: () => 1,
		getNamedSecurityInfoW: (_path, _type, _info, _owner, _group, dacl, _sacl, descriptor) => {
			writePtr(dacl, 0n);
			writePtr(descriptor, 0n);
			return abi.ERROR_SUCCESS;
		},
		setEntriesInAclW: (_count, _entries, _old, newAcl) => {
			writePtr(newAcl, 9n);
			return abi.ERROR_SUCCESS;
		},
		setNamedSecurityInfoW: () => abi.ERROR_SUCCESS,
		localFree: () => 0n as NativePtr,
		getLastError: () => 5,
		formatMessageW: () => 0,
	};
	return { ...defaults, ...overrides } as Win32Bindings;
}

/** 把「目录当前的 DACL」换成指定内存对象（bigint 表示裸指针，0 表示没有 DACL）与描述符。 */
function withStandingDacl(acl: NativePtr | bigint, descriptor: bigint): Partial<Win32Bindings> {
	return {
		getNamedSecurityInfoW: (_path, _type, _info, _owner, _group, daclSlot, _sacl, descriptorSlot) => {
			writePtr(daclSlot, typeof acl === "bigint" ? acl : ptrAddress(acl));
			writePtr(descriptorSlot, descriptor);
			return abi.ERROR_SUCCESS;
		},
	};
}

/** SID 字节：Revision@0、SubAuthorityCount@1、IdentifierAuthority@2（6 字节）、SubAuthority[]@8。 */
function sidBytes(subs: readonly number[]): number[] {
	const bytes = [1, subs.length, 0, 0, 0, 0, 0, 5];
	for (const sub of subs) {
		bytes.push(sub & 0xff, (sub >>> 8) & 0xff, (sub >>> 16) & 0xff, (sub >>> 24) & 0xff);
	}
	return bytes;
}

/** 分配一枚 SID（与 ACE 内联 SID 用同一份字节源，才好构造「完全一致」那条 ACE）。 */
function allocSid(subs: readonly number[]): NativePtr {
	const bytes = sidBytes(subs);
	const sid = allocBytes(bytes.length);
	bytes.forEach((byte, index) => koffi.encode(sid, index, "uint8", byte));
	return sid;
}

interface AceShape {
	/** 内联 SID 的字节。 */
	readonly inlineSid: readonly number[];
	/** AclSize（默认 8 字节头 + 一条 ACE）。改小它 = 说谎的头部。 */
	readonly aclSize?: number;
	readonly aceSize?: number;
	readonly aceType?: number;
	readonly aceFlags?: number;
	readonly mask?: number;
}

/**
 * 内存里造一条 ACL：8 字节头 + 一条 ACCESS_ALLOWED_ACE
 * （AceType@0、AceFlags@1、AceSize@2、Mask@4，SID 从 @8 起**内联**）。
 * 每个字段都能改坏，用它驱动「幂等跳过」的形态判据。
 */
function craftAcl(shape: AceShape): NativePtr {
	const aceSize = shape.aceSize ?? 8 + shape.inlineSid.length;
	// 分配得比声明的大，才能在 aclSize 说谎时也把畸形字节写进去。
	const acl = allocBytes(Math.max(8 + aceSize, 8 + shape.inlineSid.length, shape.aclSize ?? 0));
	koffi.encode(acl, 0, "uint8", 2); // AclRevision
	koffi.encode(acl, 2, "uint16", shape.aclSize ?? 8 + aceSize);
	koffi.encode(acl, 4, "uint16", 1); // AceCount
	koffi.encode(acl, 8, "uint8", shape.aceType ?? abi.ACCESS_ALLOWED_ACE_TYPE);
	koffi.encode(acl, 9, "uint8", shape.aceFlags ?? abi.SUB_CONTAINERS_AND_OBJECTS_INHERIT);
	koffi.encode(acl, 10, "uint16", aceSize);
	koffi.encode(acl, 12, "uint32", shape.mask ?? abi.GRANT_MASK);
	shape.inlineSid.forEach((byte, index) => koffi.encode(acl, 16 + index, "uint8", byte));
	return acl;
}

/** 断言抛了 Win32Error 且点名指定 API（原因码分类只认这个 API 名）。 */
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

describe.skipIf(!isWindows)("acl.ts 失败路径", () => {
	beforeAll(async () => {
		await loadWin32();
	});

	describe("buildExplicitAccess（EXPLICIT_ACCESS_W 的按偏移打包）", () => {
		it("字段落在实测的偏移上：perms@0 mode@4 继承@8 Trustee@16{form@28 type@32 name@40}", () => {
			/*
			 * 手工按偏移打包（而不是声明 koffi 嵌套结构）的代价就是这张表 ——
			 * 偏移写错不会崩，只会静默变成另一条授权：写错 TrusteeForm 会让
			 * SetEntriesInAclW 返回错误（还算响亮），但写错继承标志就是
			 * 「只在目录本层授权、子项全不继承」—— 一个查不出来的假边界。
			 */
			const sid = allocSid([0x1234]);
			const entry = buildExplicitAccess(sid, abi.GRANT_ACCESS, abi.GRANT_MASK);
			expect(entry.length).toBe(abi.EXPLICIT_ACCESS_W_SIZE);
			expect(entry.readUInt32LE(0)).toBe(abi.GRANT_MASK);
			expect(entry.readUInt32LE(4)).toBe(abi.GRANT_ACCESS);
			expect(entry.readUInt32LE(8)).toBe(abi.SUB_CONTAINERS_AND_OBJECTS_INHERIT);
			expect(entry.readUInt32LE(24)).toBe(abi.NO_MULTIPLE_TRUSTEE);
			expect(entry.readUInt32LE(28)).toBe(abi.TRUSTEE_IS_SID);
			expect(entry.readUInt32LE(32)).toBe(abi.TRUSTEE_IS_UNKNOWN);
			expect(entry.readBigUInt64LE(40)).toBe(ptrAddress(sid));
		});

		it("撤销条目：模式是 REVOKE_ACCESS 且**掩码为 0**（撤销不看掩码，写错会变成「缩小授权」）", () => {
			const sid = allocSid([0x1234]);
			const entry = buildExplicitAccess(sid, abi.REVOKE_ACCESS, 0);
			expect(entry.readUInt32LE(0)).toBe(0);
			expect(entry.readUInt32LE(4)).toBe(abi.REVOKE_ACCESS);
		});

		it("授权掩码不含 WRITE_DAC / WRITE_OWNER（含了就是一步逃逸出授权范围）", () => {
			// 与 dsh 的 acl.spec「never WRITE_DAC/WRITE_OWNER」同一条纪律：
			// 受限子进程若能改工作区自己的 DACL 或夺取所有权，这层就是假边界。
			expect(abi.GRANT_MASK & abi.STANDARD_RIGHTS_WRITE).toBe(0);
			expect(abi.GRANT_MASK & abi.DELETE).not.toBe(0);
			expect(abi.GRANT_MASK & abi.FILE_DELETE_CHILD).not.toBe(0);
		});
	});

	describe("lockFilePath（per-path 锁的键）", () => {
		it("同一路径恒定、大小写不同也映射到同一把锁（否则两个实例会互相覆盖 ACE）", () => {
			const api = baseApi();
			expect(lockFilePath(api, GRANTED)).toBe(lockFilePath(api, GRANTED));
			expect(lockFilePath(api, GRANTED.toLowerCase())).toBe(lockFilePath(api, GRANTED));
			expect(lockFilePath(api, "C:\\Users\\foo\\Other")).not.toBe(lockFilePath(api, GRANTED));
		});

		it("锁文件落在系统 temp 的专用目录下，不在被授权的目录里（子进程看不见也改不了）", () => {
			const path = lockFilePath(baseApi(), GRANTED);
			expect(path).toContain("kamibuddy-acl-locks");
			expect(path.endsWith(".lock")).toBe(true);
			expect(path.toLowerCase().startsWith(tmpdir().toLowerCase())).toBe(true);
		});
	});

	describe("withPathLock", () => {
		it("拿不到锁文件时响亮失败（不许「锁不上就当没锁」直接改 DACL）", () => {
			// CreateFileW 的失败句柄是 INVALID_HANDLE_VALUE（全 1），不是 NULL ——
			// 只判 null 的实现会把失败当成功，拿垃圾句柄去 LockFileEx。
			const api = baseApi({ createFileW: () => 0xffffffffffffffffn as NativePtr });
			expectWin32Error(() => withPathLock(api, GRANTED, () => "x"), "CreateFileW");
		});

		it("锁不上时关掉句柄，且错误码是失败那一刻的（没被 CloseHandle 覆盖）", () => {
			let lastError = 33; // ERROR_LOCK_VIOLATION
			const closeHandle = vi.fn(() => {
				lastError = 6;
				return 1;
			});
			const api = baseApi({ lockFileEx: () => 0, closeHandle, getLastError: () => lastError });
			const error = expectWin32Error(() => withPathLock(api, GRANTED, () => "x"), "LockFileEx");
			expect(error.code).toBe(33);
			expect(closeHandle).toHaveBeenCalledWith(7n);
		});

		it("action 抛错时锁照样释放，异常原样传出", () => {
			const unlockFileEx = vi.fn(() => 1);
			const closeHandle = vi.fn(() => 1);
			const api = baseApi({ unlockFileEx, closeHandle });
			expect(() =>
				withPathLock(api, GRANTED, () => {
					throw new Error("授权中途炸了");
				}),
			).toThrow(/授权中途炸了/u);
			expect(unlockFileEx).toHaveBeenCalled();
			expect(closeHandle).toHaveBeenCalledWith(7n);
		});

		it("解锁失败不许盖住 action 的结果（句柄随即关闭，锁自然释放）", () => {
			// 实现里 unlockFileEx 的返回值有意不检：检了会让「解锁失败」盖住
			// 授权本来的结论（成功或失败），而关句柄已经释放了锁。
			const api = baseApi({ unlockFileEx: () => 0 });
			expect(withPathLock(api, GRANTED, () => "done")).toBe("done");
		});
	});

	describe("grantWrite", () => {
		it("**幂等快路径**：已有的 ACE 完全一致时直接返回 true，不写回（否则整棵树重新传播 ACE）", () => {
			// 这是整层的性能命门：5000 文件的树首次授权 3134ms、命中 1ms。
			const sid = allocSid([0x1234]);
			const setNamedSecurityInfoW = vi.fn(() => abi.ERROR_SUCCESS);
			const localFree = vi.fn(() => 0n as NativePtr);
			const api = baseApi({
				...withStandingDacl(craftAcl({ inlineSid: sidBytes([0x1234]) }), 6n),
				setNamedSecurityInfoW,
				localFree,
			});
			expect(grantWrite(api, GRANTED, sid)).toBe(true);
			expect(setNamedSecurityInfoW).not.toHaveBeenCalled();
			expect(localFree).toHaveBeenCalledWith(6n);
		});

		it("快路径上释放描述符失败要抛（不许假装授权成功）", () => {
			const sid = allocSid([0x1234]);
			const api = baseApi({
				...withStandingDacl(craftAcl({ inlineSid: sidBytes([0x1234]) }), 6n),
				localFree: () => 1n as NativePtr, // LocalFree 非 NULL = 失败
			});
			expectWin32Error(() => grantWrite(api, GRANTED, sid), "LocalFree");
		});

		it("没有描述符时只释放合并出来的 ACL，不去 free 那个 NULL 描述符（无效释放也是堆破坏）", () => {
			const sid = allocSid([0x1234]);
			const localFree = vi.fn(() => 0n as NativePtr);
			const api = baseApi({ localFree });
			expect(grantWrite(api, GRANTED, sid)).toBe(false);
			expect(localFree).toHaveBeenCalledTimes(1);
			expect(localFree).toHaveBeenCalledWith(9n);
		});

		it("合并路径写回的 entry 是 GRANT_ACCESS + GRANT_MASK + 继承", () => {
			const sid = allocSid([0x1234]);
			let entry: Buffer | undefined;
			const api = baseApi({
				setEntriesInAclW: (_count, entries, _old, newAcl) => {
					entry = entries;
					writePtr(newAcl, 9n);
					return abi.ERROR_SUCCESS;
				},
			});
			grantWrite(api, GRANTED, sid);
			expect(entry?.readUInt32LE(0)).toBe(abi.GRANT_MASK);
			expect(entry?.readUInt32LE(4)).toBe(abi.GRANT_ACCESS);
			expect(entry?.readUInt32LE(8)).toBe(abi.SUB_CONTAINERS_AND_OBJECTS_INHERIT);
		});

		it.each([
			{ label: "ACL 头声明的尺寸小于头本身", ace: { aclSize: 4 } },
			{ label: "ACE 声明的尺寸冲出 ACL 之外", ace: { aceSize: 100, aclSize: 8 } },
			{ label: "ACE 类型不是允许型", ace: { aceType: 1 } },
			{ label: "继承标志不含子容器/子对象", ace: { aceFlags: 0 } },
			{ label: "掩码与授权掩码不同", ace: { mask: 0 } },
		])("形态不符的 ACE 视同「没有授权」，回落到合并路径：$label", ({ ace }) => {
			/*
			 * hasExactGrant 面对畸形数据必须**保守**：判成「已有」会跳过写回、
			 * 目录实际没有授权（假边界）；判成「没有」最坏只是多传播一次 ACE。
			 * 所以这里每一条畸形数据都必须走合并路径。
			 */
			const sid = allocSid([0x1234]);
			const setNamedSecurityInfoW = vi.fn(() => abi.ERROR_SUCCESS);
			const api = baseApi({
				...withStandingDacl(craftAcl({ inlineSid: sidBytes([0x1234]), ...ace }), 6n),
				setNamedSecurityInfoW,
			});
			expect(grantWrite(api, GRANTED, sid)).toBe(false);
			expect(setNamedSecurityInfoW).toHaveBeenCalledTimes(1);
		});

		it("站着的 ACE 是**别的** SID 时回落到合并路径（不能把别人的授权当成自己的）", () => {
			const sid = allocSid([0x1234]);
			const setNamedSecurityInfoW = vi.fn(() => abi.ERROR_SUCCESS);
			const api = baseApi({
				...withStandingDacl(craftAcl({ inlineSid: sidBytes([0x9999]) }), 6n),
				setNamedSecurityInfoW,
			});
			expect(grantWrite(api, GRANTED, sid)).toBe(false);
			expect(setNamedSecurityInfoW).toHaveBeenCalledTimes(1);
		});

		it("SetEntriesInAclW 合并失败时抛，并释放已读到的描述符（不泄漏 LocalAlloc 块）", () => {
			const sid = allocSid([0x1234]);
			const localFree = vi.fn(() => 0n as NativePtr);
			const api = baseApi({
				...withStandingDacl(0n, 6n),
				setEntriesInAclW: () => 5,
				localFree,
			});
			expectWin32Error(() => grantWrite(api, GRANTED, sid), "SetEntriesInAclW");
			expect(localFree).toHaveBeenCalledWith(6n);
		});

		it("合并结果为空指针时抛，同样释放描述符", () => {
			const sid = allocSid([0x1234]);
			const localFree = vi.fn(() => 0n as NativePtr);
			const api = baseApi({
				...withStandingDacl(0n, 6n),
				setEntriesInAclW: () => abi.ERROR_SUCCESS, // 报成功却没写 out 槽
				localFree,
			});
			expectWin32Error(() => grantWrite(api, GRANTED, sid), "SetEntriesInAclW");
			expect(localFree).toHaveBeenCalledWith(6n);
		});

		it("SetNamedSecurityInfoW 写回失败时抛，且**合并出来的 ACL 已被释放**（漏了就是堆破坏）", () => {
			const sid = allocSid([0x1234]);
			const localFree = vi.fn(() => 0n as NativePtr);
			const api = baseApi({ setNamedSecurityInfoW: () => 5, localFree });
			expectWin32Error(() => grantWrite(api, GRANTED, sid), "SetNamedSecurityInfoW");
			expect(localFree).toHaveBeenCalledWith(9n);
		});
	});

	describe("revokeWrite", () => {
		it("目录本来就没有显式 DACL：返回 false（无事可做），有描述符就释放掉", () => {
			const sid = allocSid([0x1234]);
			const localFree = vi.fn(() => 0n as NativePtr);
			const api = baseApi({ ...withStandingDacl(0n, 6n), localFree });
			expect(revokeWrite(api, GRANTED, sid)).toBe(false);
			expect(localFree).toHaveBeenCalledWith(6n);
		});

		it("没有 DACL 也没有描述符时什么都不释放", () => {
			const sid = allocSid([0x1234]);
			const localFree = vi.fn(() => 0n as NativePtr);
			const api = baseApi({ localFree });
			expect(revokeWrite(api, GRANTED, sid)).toBe(false);
			expect(localFree).not.toHaveBeenCalled();
		});

		it("有 DACL 时按 REVOKE_ACCESS + 掩码 0 撤销，返回 true", () => {
			const sid = allocSid([0x1234]);
			let entry: Buffer | undefined;
			const api = baseApi({
				...withStandingDacl(craftAcl({ inlineSid: sidBytes([0x1234]) }), 6n),
				setEntriesInAclW: (_count, entries, _old, newAcl) => {
					entry = entries;
					writePtr(newAcl, 9n);
					return abi.ERROR_SUCCESS;
				},
			});
			expect(revokeWrite(api, GRANTED, sid)).toBe(true);
			expect(entry?.readUInt32LE(0)).toBe(0);
			expect(entry?.readUInt32LE(4)).toBe(abi.REVOKE_ACCESS);
		});

		it("no-DACL 路径上释放描述符失败要抛（清理失败不该静默）", () => {
			const sid = allocSid([0x1234]);
			const api = baseApi({
				...withStandingDacl(0n, 6n),
				localFree: () => 1n as NativePtr,
			});
			expectWin32Error(() => revokeWrite(api, GRANTED, sid), "LocalFree");
		});
	});
});
