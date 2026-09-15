/**
 * SID 构造与受限令牌派生。
 *
 * 这是「零安装」成立的地方：我们只复制**调用方自己的**令牌并收窄它，
 * 不建账号、不调 LogonUser、不需要 UAC —— 而授权目标是调用方自己拥有的目录，
 * 所有者天然持有 WRITE_DAC。codex 那套要专用账号 + DPAPI + 独立桌面，
 * 能多做读隔离与网络隔离，但写隔离的强度与这里完全等同。
 *
 * **fail-closed 是第一原则**：每个 Win32 调用都检返回值，任何失败都抛。
 * 上游 POC（huoyaoyuan/windows-acl-restrict-poc）漏检返回值，失败时
 * 拿**完整令牌**跑了子进程 —— 沙箱静默失效，比没有沙箱更糟（以为有保护）。
 *
 * 移植自 dsh sandbox-windows-acl/src/token.ts（MIT），SID 所有权模型有意改动，
 * 见 sidFromString。
 */

import { Buffer } from "node:buffer";

import { buildExplicitAccess } from "./acl.ts";
import {
	allocBytes,
	allocPtrSlot,
	allocUint32,
	decodePtr,
	decodePtrAt,
	decodeUint32,
	encodeUint32,
	freeNative,
	isNullPtr,
	ptrAddress,
	throwLastError,
	throwWin32,
	type NativePtr,
	type Win32Bindings,
} from "./ffi.ts";
import * as abi from "./win32-abi.ts";

/**
 * 打开当前进程的令牌，取 CreateRestrictedToken 所需的四项权限。
 *
 * 为什么绕一道 OpenProcess 而不用 GetCurrentProcess：后者返回的是**伪句柄**
 * （常量 -1），koffi 无法把它当指针传递。用真实句柄绕过这个限制，
 * 代价只是多一次调用与一次 CloseHandle。
 */
export function openCurrentProcessToken(api: Win32Bindings): NativePtr {
	const processHandle = api.openProcess(abi.PROCESS_QUERY_INFORMATION, 0, process.pid);
	if (isNullPtr(processHandle)) throwLastError(api, "OpenProcess", `pid ${process.pid}`);

	const tokenSlot = allocPtrSlot();
	try {
		const opened = api.openProcessToken(
			processHandle,
			abi.TOKEN_QUERY | abi.TOKEN_DUPLICATE | abi.TOKEN_ADJUST_DEFAULT | abi.TOKEN_ASSIGN_PRIMARY,
			tokenSlot,
		);
		if (opened === 0) {
			const code = api.getLastError(); // 先取码：CloseHandle 会覆盖 GetLastError
			api.closeHandle(processHandle);
			throwWin32(api, "OpenProcessToken", code, `pid ${process.pid}`);
		}
		api.closeHandle(processHandle);
		const token = decodePtr(tokenSlot);
		if (token === null) throwWin32(api, "OpenProcessToken", api.getLastError(), "令牌句柄为空");
		return token;
	} finally {
		freeNative(tokenSlot);
	}
}

/**
 * 找出并复制令牌的登录会话 SID（S-1-5-5-x-y，属性含 SE_GROUP_LOGON_ID）。
 *
 * 它必须进受限 SID 列表，否则子进程连 WinSta0/桌面这类 per-logon 对象都碰不到，
 * 表现为 DLL 早期初始化直接死在 0xC0000142。
 */
export function findLogonSid(api: Win32Bindings, token: NativePtr): NativePtr {
	const neededSlot = allocUint32();
	try {
		// 两段式调用：先问长度（这次预期失败于 ERROR_INSUFFICIENT_BUFFER），再分配。
		api.getTokenInformation(token, abi.TokenGroups, null, 0, neededSlot);
		const needed = decodeUint32(neededSlot);
		if (needed === 0) throwLastError(api, "GetTokenInformation", "TokenGroups 尺寸查询");
		if (needed < abi.TOKEN_GROUPS_OFFSET) {
			throwWin32(api, "GetTokenInformation", api.getLastError(), `TokenGroups 尺寸不合理：${needed}`);
		}

		const groups = Buffer.alloc(needed);
		if (api.getTokenInformation(token, abi.TokenGroups, groups, groups.length, neededSlot) === 0) {
			throwLastError(api, "GetTokenInformation", "TokenGroups");
		}
		const groupCount = groups.readUInt32LE(0);
		for (let index = 0; index < groupCount; index += 1) {
			const at = abi.TOKEN_GROUPS_OFFSET + index * abi.SID_AND_ATTRIBUTES_SIZE;
			const sidPtr = decodePtrAt(groups, at);
			const attributes = groups.readUInt32LE(at + 8);
			// 两边都 >>> 0：SE_GROUP_LOGON_ID 的第 31 位是 1，而 JS 位运算是
			// 有符号 32 位 —— 不转无符号永远匹配不上。
			const isLogonId = ((attributes & abi.SE_GROUP_LOGON_ID) >>> 0) === (abi.SE_GROUP_LOGON_ID >>> 0);
			if (sidPtr === null || !isLogonId) continue;

			// 必须复制：sidPtr 指向 groups 这个 Buffer 内部，函数返回后就悬空了。
			const length = api.getLengthSid(sidPtr);
			if (length === 0) throwLastError(api, "GetLengthSid", `登录 SID（组 ${index}）`);
			const copy = allocBytes(length);
			if (api.copySid(length, copy, sidPtr) === 0) throwLastError(api, "CopySid", `登录 SID（组 ${index}）`);
			return copy;
		}
		throw new Error(`受限令牌前置条件不满足：令牌的 ${groupCount} 个组里找不到登录 SID`);
	} finally {
		freeNative(neededSlot);
	}
}

/** 构造一个 well-known SID（如 Everyone）。返回的内存由 koffi 拥有。 */
export function makeWellKnownSid(api: Win32Bindings, type: number): NativePtr {
	const sid = allocBytes(abi.SECURITY_MAX_SID_SIZE);
	const sizeSlot = allocUint32();
	try {
		encodeUint32(sizeSlot, abi.SECURITY_MAX_SID_SIZE);
		if (api.createWellKnownSid(type, null, sid, sizeSlot) === 0) {
			throwLastError(api, "CreateWellKnownSid", `type ${type}`);
		}
		if (api.isValidSid(sid) === 0) throwLastError(api, "IsValidSid", `CreateWellKnownSid type ${type}`);
		return sid;
	} finally {
		freeNative(sizeSlot);
	}
}

/**
 * 解析 `S-1-4-…` 形式的 SID 字符串。
 *
 * **相对 dsh 的有意改动：把结果复制进 koffi 内存，立即释放 Windows 那块。**
 * ConvertStringSidToSidW 用 LocalAlloc 分配（须 LocalFree），而
 * makeWellKnownSid / findLogonSid 返回的是 koffi 内存（须 freeNative）——
 * 上游让这个差异一路暴露给调用方，于是「这个 SID 该用哪个释放函数」
 * 变成必须逐个记住的事，混用就是堆破坏。
 *
 * 在这里收敛掉之后，本层**所有** SID 一律 koffi 所有、一律 freeNative，
 * 调用方不需要知道它是从哪来的。多一次 CopySid 换掉一整类内存错误。
 */
export function sidFromString(api: Win32Bindings, text: string): NativePtr {
	const slot = allocPtrSlot();
	try {
		if (api.convertStringSidToSidW(text, slot) === 0) {
			throwLastError(api, "ConvertStringSidToSidW", text);
		}
		const localAllocated = decodePtr(slot);
		if (localAllocated === null) {
			throwWin32(api, "ConvertStringSidToSidW", api.getLastError(), `${text} 解析结果为空`);
		}
		try {
			const length = api.getLengthSid(localAllocated);
			if (length === 0) throwLastError(api, "GetLengthSid", text);
			const copy = allocBytes(length);
			if (api.copySid(length, copy, localAllocated) === 0) throwLastError(api, "CopySid", text);
			return copy;
		} finally {
			api.localFree(localAllocated);
		}
	} finally {
		freeNative(slot);
	}
}

/**
 * 给受限令牌的**默认 DACL** 并入一条全权 ACE。
 *
 * **这一步不能省，否��� piped stdio 全线失败。** 受限令牌原样继承用户的默认
 * DACL，而那里不含任何受限 SID；于是子进程新建匿名管道时，管道自身的 DACL
 * 过不了 WRITE_RESTRICTED 的第二次（写）检查 —— ERROR_ACCESS_DENIED，
 * Node 侧表现为 spawn EPERM。
 *
 * 并入的 ACE 指名一个**受限列表里有的** SID，所以新对象的 DACL 能过第二次
 * 检查；而「能不能在某个目录里创建对象」仍由父目录的 DACL 把关 ——
 * 授权范围之外照样建不出文件。
 *
 * **调用方必须传身份内 SID（登录 SID / Everyone），不能传 capability SID**
 * （2026-09-15 诊断结论，详见 sandbox/index.ts 的注释）：默认 DACL 的 ACE
 * 受托者为外来 SID 时，子进程在部分启动上下文下死于 DLL 初始化。
 */
export function setTokenDefaultDaclGrant(api: Win32Bindings, token: NativePtr, sid: NativePtr): void {
	const neededSlot = allocUint32();
	const newDaclSlot = allocPtrSlot();
	try {
		api.getTokenInformation(token, abi.TokenDefaultDacl, null, 0, neededSlot); // 预期 ERROR_INSUFFICIENT_BUFFER
		const needed = decodeUint32(neededSlot);
		if (needed === 0) throwLastError(api, "GetTokenInformation", "TokenDefaultDacl 尺寸查询");
		const buffer = Buffer.alloc(needed);
		if (api.getTokenInformation(token, abi.TokenDefaultDacl, buffer, buffer.length, neededSlot) === 0) {
			throwLastError(api, "GetTokenInformation", "TokenDefaultDacl");
		}
		const currentDacl = decodePtrAt(buffer, 0);
		if (currentDacl === null) throw new Error("setTokenDefaultDaclGrant：令牌没有默认 DACL 可扩展");

		const merged = api.setEntriesInAclW(
			1,
			buildExplicitAccess(sid, abi.GRANT_ACCESS, abi.FILE_ALL_ACCESS),
			currentDacl,
			newDaclSlot,
		);
		if (merged !== abi.ERROR_SUCCESS) throwWin32(api, "SetEntriesInAclW", merged, "默认 DACL 合并");
		const newDacl = decodePtr(newDaclSlot);
		if (newDacl === null) throwWin32(api, "SetEntriesInAclW", merged, "默认 DACL 合并结果为空");

		try {
			// TOKEN_DEFAULT_DACL 结构体就是那个指针本身；SetTokenInformation 会在
			// 返回前把 ACL 复制走，所以之后可以立即释放。
			const info = Buffer.alloc(8);
			info.writeBigUInt64LE(newDacl, 0);
			if (api.setTokenInformation(token, abi.TokenDefaultDacl, info, info.length) === 0) {
				throwLastError(api, "SetTokenInformation", "TokenDefaultDacl");
			}
		} finally {
			api.localFree(newDacl);
		}
	} finally {
		freeNative(newDaclSlot);
		freeNative(neededSlot);
	}
}

/** 打包 SID_AND_ATTRIBUTES[]（16 字节步长，Attributes 保持 0）。 */
function buildRestrictingSids(sids: readonly NativePtr[]): Buffer {
	const buffer = Buffer.alloc(abi.SID_AND_ATTRIBUTES_SIZE * sids.length);
	sids.forEach((sid, index) => {
		buffer.writeBigUInt64LE(ptrAddress(sid), abi.SID_AND_ATTRIBUTES_SIZE * index);
	});
	return buffer;
}

/** 受限令牌的档位。`danger-full-access` 不进沙箱，所以这里没有它。 */
export type ConfinementMode = "read-only" | "workspace-write";

/**
 * 派生 WRITE_RESTRICTED 受限令牌。
 *
 * 受限 SID 列表按档位（dsh 在 Win11 26200 上验证过，我们在 26100 上复验）：
 *   - `read-only`：      [登录 SID, EVERYONE]
 *   - `workspace-write`：[登录 SID, EVERYONE, 工作区 SID, temp SID]
 *
 * **登录 SID + EVERYONE 这一对在两档里都必须在**：少了它们，DLL 早期初始化
 * 死在 0xC0000142，CNG（`\Device\CNG` 需要写权限）让 pwsh 崩 0xE0434352。
 *
 * 写 SID **只进 workspace-write**。这带来一个好性质：早先
 * workspace-write 期间留下的常驻授权 ACE，在 read-only 档下自动**失效** ——
 * 因为第二次检查只认受限列表里有的 SID。所以降档不漏权，升档又不必重新传播 ACE。
 *
 * Authenticated Users 与 INTERACTIVE/LOCAL **有意不在列表里**（照 dsh）：
 * 宿主给 Public 树授了 INTERACTIVE 写权限，留着它就是一条逃逸路径；
 * 代价是 WMI/CIM 在受限模式下不可用。
 */
export function createRestrictedToken(
	api: Win32Bindings,
	currentToken: NativePtr,
	logonSid: NativePtr,
	worldSid: NativePtr,
	writeSids: readonly NativePtr[],
	mode: ConfinementMode,
): NativePtr {
	if (mode === "workspace-write" && writeSids.length === 0) {
		throw new Error("createRestrictedToken：workspace-write 至少需要一个写 SID");
	}
	const sids = mode === "read-only" ? [logonSid, worldSid] : [logonSid, worldSid, ...writeSids];
	const restrictingSids = buildRestrictingSids(sids);

	const tokenSlot = allocPtrSlot();
	try {
		const created = api.createRestrictedToken(
			currentToken,
			abi.DISABLE_MAX_PRIVILEGE | abi.LUA_TOKEN | abi.WRITE_RESTRICTED,
			0,
			null, // 不禁用任何 SID
			0,
			null, // 不删除任何特权
			sids.length,
			restrictingSids,
			tokenSlot,
		);
		if (created === 0) throwLastError(api, "CreateRestrictedToken", `${sids.length} 个受限 SID`);
		const token = decodePtr(tokenSlot);
		if (token === null) throwWin32(api, "CreateRestrictedToken", api.getLastError(), "令牌句柄为空");
		return token;
	} finally {
		freeNative(tokenSlot);
	}
}
