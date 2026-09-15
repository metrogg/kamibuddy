/**
 * 从路径确定性派生 capability SID。
 *
 * 为什么要确定性（而不是像 codex 那样随机生成再落盘）：
 * 同一个工作区在任何一次运行里都得到同一个 SID，于是
 *   - 上一次会话留下的 ACE 这次**直接命中幂等快路径**（实测 1ms vs 首次几秒），
 *   - 不需要额外的状态文件来记住「这个目录用的是哪个 SID」，少一处可损坏的落盘。
 * 代价：SID 可由路径反推（不是秘密）。这不构成弱点 —— SID 只是 ACE 的标签，
 * 拿到它并不能授予自己权限（授权需要目录所有者的 WRITE_DAC）。
 *
 * 用 S-1-4-* 这个「未使用的权威」段（SECURITY_NON_UNIQUE_AUTHORITY）：
 * 它不与任何真实账号/组冲突，也不会被 Windows 解析成某个已知主体。
 */

import { createHash } from "node:crypto";

/**
 * 路径 → 32 位无符号子权限值。
 *
 * 小写化后再哈希：Windows 路径大小写不敏感，`C:\Users\X` 与 `c:\users\x`
 * 是同一个目录，必须映射到同一个 SID —— 否则换个大小写拼法就绕过了幂等，
 * 每次都重新传播 ACE。
 */
function pathDigest(path: string, salt: string): number {
	const digest = createHash("sha256").update(`${salt}:${path.toLowerCase()}`).digest();
	// 取前 4 字节。>>> 0 转无符号：SID 子权限是 uint32，
	// 而 readInt32BE 会把高位当符号位。
	return digest.readUInt32BE(0) >>> 0;
}

/**
 * 工作区写 SID。
 *
 * 两级子权限（`S-1-4-<hash>-<低位>`）而不是一级：单级时不同路径的碰撞概率
 * 就是 32 位生日问题，两级把它降到可忽略。碰撞的后果是两个工作区共享写权限
 * —— 属于安全问题，值得多这一级。
 */
export function workspaceWriteSid(workspaceDir: string): string {
	const high = pathDigest(workspaceDir, "workspace");
	const low = pathDigest(workspaceDir, "workspace-low") % 0x10000;
	return `S-1-4-${high}-${low}`;
}

/**
 * 私有 temp 写 SID。
 *
 * 与工作区**分开**是有意的：两块区域的授权可以独立撤销，
 * 而且 temp 目录常在 %TEMP% 下（与工作区不同的树），共用一个 SID 会让
 * 「撤销工作区授权」顺带影响 temp，或反之。
 */
export function tempWriteSid(tempDir: string): string {
	const high = pathDigest(tempDir, "temp");
	const low = pathDigest(tempDir, "temp-low") % 0x10000;
	return `S-1-4-${high}-${low}`;
}
