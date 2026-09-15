/**
 * ACL 编辑：给目录的 DACL 加/删一条 capability SID 的写授权。
 *
 * 两个必须守住的契约（写错都是内存破坏级别，而症状是随机崩溃）：
 *
 * **契约一：谁分配谁释放，两套分配器不能混。**
 * `GetNamedSecurityInfoW` 与 `SetEntriesInAclW` 的输出是 Windows 用 LocalAlloc
 * 分配的 → 必须 `LocalFree`；`allocPtrSlot`/`allocBytes` 是 koffi 分配的
 * → 必须 `freeNative`。搞反了就是堆破坏。
 *
 * **契约二：DACL 指针住在安全描述符的分配块内部。**
 * `GetNamedSecurityInfoW` 返回的 dacl 不是独立分配 —— 只能 LocalFree 那个
 * descriptor，而且必须等 `SetEntriesInAclW` 消费完之后。直接 free 那个 dacl
 * 指针会破坏堆（dsh 是踩过才写下这条的）。
 *
 * 并发：授权是「读—合并—写」，整个序列在 per-path 的 LockFileEx 独占锁里跑，
 * 否则两个 KamiBuddy 实例同时授权会互相覆盖 ACE。
 *
 * 移植自 dsh sandbox-windows-acl/src/acl.ts（MIT）。
 */

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import {
	allocOverlapped,
	allocPtrSlot,
	decodePtr,
	decodeUint16At,
	decodeUint32At,
	decodeUint8At,
	freeNative,
	getTempPath,
	isInvalidHandle,
	isNullPtr,
	ptrAddress,
	sameSidAt,
	throwLastError,
	throwWin32,
	type NativePtr,
	type Win32Bindings,
} from "./ffi.ts";
import * as abi from "./win32-abi.ts";

/**
 * 打包一条 EXPLICIT_ACCESS_W（48 字节，偏移经 ABI 探针实测）：
 * perms@0、mode@4、inheritance@8、Trustee@16{ …TrusteeForm@28、
 * TrusteeType@32、ptstrName@40 }。
 *
 * 手工按偏移打包而不是声明 koffi struct：这个结构里嵌了另一个结构（TRUSTEE_W），
 * 而我们只需要写 6 个字段、其余保持零 —— 声明完整嵌套布局的出错面比按偏移写更大。
 *
 * REVOKE_ACCESS 时 permissions 传 0：撤销是「移除该受托者的所有 ACE」，
 * 不看掩码。
 */
export function buildExplicitAccess(sid: NativePtr, mode: number, permissions: number): Buffer {
	const entry = Buffer.alloc(abi.EXPLICIT_ACCESS_W_SIZE);
	entry.writeUInt32LE(permissions, 0);
	entry.writeUInt32LE(mode, 4);
	entry.writeUInt32LE(abi.SUB_CONTAINERS_AND_OBJECTS_INHERIT, 8);
	entry.writeUInt32LE(abi.NO_MULTIPLE_TRUSTEE, 24);
	entry.writeUInt32LE(abi.TRUSTEE_IS_SID, 28);
	entry.writeUInt32LE(abi.TRUSTEE_IS_UNKNOWN, 32);
	entry.writeBigUInt64LE(ptrAddress(sid), 40);
	return entry;
}

/**
 * 每个受保护路径一个锁文件：`<系统 temp>\kamibuddy-acl-locks\<路径哈希>.lock`。
 *
 * 锁根取自 GetTempPathW 而不是工作区 —— 锁文件本身不该落在被授权的目录里
 * （会被沙箱内的子进程看见甚至改动）。路径小写后哈希，让 Windows 的
 * 大小写不敏感拼法映射到同一把锁。
 */
export function lockFilePath(api: Win32Bindings, path: string): string {
	const digest = createHash("sha256").update(path.toLowerCase()).digest("hex").slice(0, 16);
	return join(getTempPath(api), "kamibuddy-acl-locks", `${digest}.lock`);
}

/**
 * 持 per-path 独占锁执行 action。
 *
 * 不给 FILE_SHARE_DELETE 是有意的：可删的锁文件能被人删掉再重建，
 * 于是两个进程会各自「持有同一把锁」—— 锁就白做了。
 */
export function withPathLock<T>(api: Win32Bindings, path: string, action: () => T): T {
	const lockPath = lockFilePath(api, path);
	mkdirSync(dirname(lockPath), { recursive: true });
	const handle = api.createFileW(
		lockPath,
		abi.GENERIC_READ | abi.GENERIC_WRITE,
		abi.FILE_SHARE_READ | abi.FILE_SHARE_WRITE,
		null,
		abi.OPEN_ALWAYS,
		0,
		null,
	);
	if (isInvalidHandle(handle)) throwLastError(api, "CreateFileW", lockPath);

	// 全零 OVERLAPPED = 从偏移 0 开始、无事件；不传 NULL 的理由见 allocOverlapped。
	const overlapped = allocOverlapped();
	try {
		if (api.lockFileEx(handle, abi.LOCKFILE_EXCLUSIVE_LOCK, 0, 1, 0, overlapped) === 0) {
			const code = api.getLastError(); // 先取码，CloseHandle 会覆盖它
			api.closeHandle(handle);
			throwWin32(api, "LockFileEx", code, lockPath);
		}
		try {
			return action();
		} finally {
			// 解锁失败不该盖住 action 的结果（无论成功还是抛错）：
			// 句柄随即关闭，锁也就随之释放，所以这里尽力而为即可。
			api.unlockFileEx(handle, 0, 1, 0, overlapped);
		}
	} finally {
		api.closeHandle(handle);
		freeNative(overlapped);
	}
}

/** 当前 DACL 与拥有它的安全描述符（契约二：只能 free descriptor）。 */
interface CurrentDacl {
	readonly oldAcl: NativePtr | null;
	readonly descriptor: NativePtr | null;
}

function readCurrentDacl(api: Win32Bindings, path: string): CurrentDacl {
	const owner = allocPtrSlot();
	const group = allocPtrSlot();
	const dacl = allocPtrSlot();
	const sacl = allocPtrSlot();
	const descriptor = allocPtrSlot();
	try {
		const result = api.getNamedSecurityInfoW(
			path,
			abi.SE_FILE_OBJECT,
			abi.DACL_SECURITY_INFORMATION,
			owner,
			group,
			dacl,
			sacl,
			descriptor,
		);
		if (result !== abi.ERROR_SUCCESS) throwWin32(api, "GetNamedSecurityInfoW", result, path);
		return { oldAcl: decodePtr(dacl), descriptor: decodePtr(descriptor) };
	} finally {
		// 这五个是 koffi 分配的 out 参数槽，与 Windows 分配的描述符无关。
		for (const slot of [owner, group, dacl, sacl, descriptor]) freeNative(slot);
	}
}

/**
 * grantWrite / revokeWrite 的公共尾段：把 entry 合并进当前 DACL 再写回。
 *
 * oldAcl 为 null（目录没有显式 DACL）时 SetEntriesInAclW 会从零建一个 ——
 * 所以不需要特殊分支。合并后原描述符即死，先释放再写回，与上游同序。
 */
function mergeAndApply(
	api: Win32Bindings,
	path: string,
	entry: Buffer,
	current: CurrentDacl,
	label: string,
): void {
	const newAclSlot = allocPtrSlot();
	try {
		const merged = api.setEntriesInAclW(1, entry, current.oldAcl, newAclSlot);
		if (merged !== abi.ERROR_SUCCESS) {
			if (current.descriptor !== null) api.localFree(current.descriptor);
			throwWin32(api, "SetEntriesInAclW", merged, `${label}(${path})`);
		}
		const newAcl = decodePtr(newAclSlot);
		if (newAcl === null) {
			if (current.descriptor !== null) api.localFree(current.descriptor);
			throwWin32(api, "SetEntriesInAclW", api.getLastError(), `${label}(${path})：合并结果为空`);
		}

		// 描述符块（含 oldAcl）在合并之后就没用了，写回前释放。
		if (current.descriptor !== null) api.localFree(current.descriptor);
		const applied = api.setNamedSecurityInfoW(
			path,
			abi.SE_FILE_OBJECT,
			abi.DACL_SECURITY_INFORMATION,
			null,
			null,
			newAcl,
			null,
		);
		api.localFree(newAcl);
		if (applied !== abi.ERROR_SUCCESS) throwWin32(api, "SetNamedSecurityInfoW", applied, `${label}(${path})`);
	} finally {
		freeNative(newAclSlot);
	}
}

/**
 * 目录的显式 DACL 里是否已有**完全一致**的那条授权 ACE。
 *
 * 这是整层的性能命门：命中就跳过 SetNamedSecurityInfoW，否则会在整棵树上
 * 重新传播同一条 ACE（继承是即时展开的）。实测 5000 文件的树首次授权
 * 3134ms、幂等命中 1ms —— 而 ACE 是常驻的，所以只有「首次在该工作区运行」付钱。
 *
 * 头部字段畸形时返回 false（当作「没有」），让调用方回落到合并路径 ——
 * 那条路有完整的失败处理，比在这里猜要稳。
 */
function hasExactGrant(oldAcl: NativePtr, sid: NativePtr): boolean {
	const aclSize = decodeUint16At(oldAcl, 2);
	const aceCount = decodeUint16At(oldAcl, 4);
	if (aclSize < 8 || aclSize > 1_048_576) return false;
	let offset = 8; // 第一条 ACE 紧跟 8 字节 ACL 头
	for (let index = 0; index < aceCount; index += 1) {
		// ACE_HEADER: AceType@0 AceFlags@1 AceSize@2(WORD)；
		// ACCESS_ALLOWED_ACE: Mask@4，SID 从 @8 起**内联**（不是指针，见 sameSidAt）。
		const aceSize = decodeUint16At(oldAcl, offset + 2);
		if (aceSize < 8 || offset + aceSize > aclSize) return false;
		const shapeMatches =
			decodeUint8At(oldAcl, offset) === abi.ACCESS_ALLOWED_ACE_TYPE &&
			decodeUint8At(oldAcl, offset + 1) === abi.SUB_CONTAINERS_AND_OBJECTS_INHERIT &&
			decodeUint32At(oldAcl, offset + 4) === abi.GRANT_MASK;
		if (shapeMatches && sameSidAt(oldAcl, offset + 8, sid, 0)) return true;
		offset += aceSize;
	}
	return false;
}

/**
 * 给目录授写权（GRANT_MASK，继承到子容器与子对象）。
 *
 * 前置条件：目录必须由调用方**拥有** —— 所有者天然持有 WRITE_DAC，
 * 这正是「零安装、不需要 UAC」成立的原因。
 *
 * @returns true 表示走了幂等快路径（ACE 已存在，未触发传播）。
 */
export function grantWrite(api: Win32Bindings, path: string, sid: NativePtr): boolean {
	return withPathLock(api, path, () => {
		const current = readCurrentDacl(api, path);
		if (current.oldAcl !== null && hasExactGrant(current.oldAcl, sid)) {
			if (current.descriptor !== null) {
				const freed = api.localFree(current.descriptor);
				if (!isNullPtr(freed)) throwLastError(api, "LocalFree", `grantWrite(${path}) descriptor`);
			}
			return true;
		}
		mergeAndApply(api, path, buildExplicitAccess(sid, abi.GRANT_ACCESS, abi.GRANT_MASK), current, "grantWrite");
		return false;
	});
}

/**
 * 移除该 capability SID 的所有 ACE（其他受托者的条目保留）。
 *
 * @returns false 表示目录本来就没有显式 DACL（无事可做）。
 */
export function revokeWrite(api: Win32Bindings, path: string, sid: NativePtr): boolean {
	return withPathLock(api, path, () => {
		const current = readCurrentDacl(api, path);
		if (current.oldAcl === null) {
			if (current.descriptor !== null) {
				const freed = api.localFree(current.descriptor);
				if (!isNullPtr(freed)) throwLastError(api, "LocalFree", `revokeWrite(${path}) descriptor`);
			}
			return false;
		}
		mergeAndApply(api, path, buildExplicitAccess(sid, abi.REVOKE_ACCESS, 0), current, "revokeWrite");
		return true;
	});
}
