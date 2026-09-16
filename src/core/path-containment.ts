/**
 * 目录归属判定的**唯一**实现：真实路径归一化 + 包含判断。
 *
 * 为什么单独立一个模块（而不是继续各处一份副本）：
 * `permission-rules.ts` 原本抄了一份 `isInside`，注释里写明了理由 ——
 * 「policy 已 import 本模块（evaluateCommand），反向 import 会构成循环依赖」，
 * 并留了一句「两处若将来要改语义必须一起改」。本模块要改的正是那个语义，
 * 所以它必须住在两边都能到的地方：extensions → core 是允许的方向
 * （scripts/check-dependency-rules.ts 机械校验），core 又不许 import extensions，
 * 于是 core 的叶子模块是唯一同时服务两侧的位置。
 * 不放 shared/：那一层会被 renderer 打包，不许 import `node:fs`
 * （见 shared/artifacts.ts、shared/worktree.ts 的同款说明）。
 *
 * ## 为什么必须归一化（2026-09-16 实测的缺口）
 *
 * 纯词法判定（只 `resolve()`，不解析链接）可以被 NTFS junction 绕过。
 * `scripts/probe-junction-containment.ts` 在真实文件系统上证明了两条：
 *
 *   工作区内建 junction 指向区外 → `write 工作区\escape\x.txt` 判定 **allow**
 *     → 文件落在工作区外，用户连问都不会被问；
 *   工作区内建 junction 指向凭据目录 → `read 工作区\keys\id_rsa` 判定 **allow**
 *     → 凭据禁区（本该「任何模式都不放行」）被完全绕过。
 *
 * 而 junction **不需要管理员权限**就能创建（symlink 才需要），所以这是模型
 * 真的走得通的路径，不是理论威胁。
 *
 * ## 这不是内核边界（必须如实传达）
 *
 * 我们是**门**，不是写入方：判定完到 pi 的 fs 工具真正写入之间存在时间窗口，
 * 攻击者可以在其间把 junction 换掉（TOCTOU）。dsh 的 fs-sandbox 紧贴写入前
 * 重新归一化来收窄这个窗口，并明确声明自己是 containment 而非 security
 * boundary；我们的窗口比它更宽（判定在扩展里，写入在 pi 内部）。
 * 所以：本模块把「模型误用 junction」和「随手的路径穿越」挡在门外，
 * **写侧真正的内核边界仍然只有沙箱本身**（src/sandbox/，OS 强制的写约束）。
 * 别把这里的加固当成「那条链已彻底封死」。
 */

import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/**
 * 把路径归一化到**真实位置**（解析掉 junction / symlink）。
 *
 * 算法是「归一化最深的存在祖先」，而不是直接 `realpathSync(target)`：
 * 判定发生在**写入之前**，目标文件通常还不存在（write 新建文件是常态），
 * 直接 realpath 会抛 ENOENT。所以从目标往上走到第一个存在的路径，
 * 对它取真实路径，再把剩下的段拼回去 —— 链接只可能出现在已存在的那一段里。
 *
 * **纯大小写差异（以及仅大小写不同的形态）一律丢弃，保留词法形式**。
 * 这一条是有意的，理由有两层：
 *   1. 正确性：Windows 的 `path.relative` 本来就大小写不敏感（本仓库已实测，
 *      见 permission-policy.ts 阶段 1 的注释），归一化大小写对判定毫无增益；
 *   2. 稳定性：`realpathSync.native` 会把路径改写成磁盘上的规范大小写。
 *      而 `details` 字段同时是审批弹窗的展示文本、`writeBackPath` 的候选值与
 *      `rememberKey` 的输入 —— 让它随「祖先目录恰好存在与否」变形，会让
 *      同一个目标在两次调用间得到不同的会话记忆键（用户批准过的目录第二次
 *      又被问）。真实的链接穿越改变的远不止大小写，所以丢弃这一类不损强度：
 *      junction 指向的是**另一个**目录，若两者只差大小写，在大小写不敏感的
 *      文件系统上它们本就是同一个目录。
 *
 * 任何一步失败都退回 `resolve()` 的词法结果，**不抛**：本函数在权限判定链的
 * 热路径上，为一次 stat 失败炸掉整个判定等于把「路径查不到」变成「工具不可用」。
 * 退回词法形式的方向是安全的 —— 那正是加固之前的行为，不会比原来更松。
 */
export function canonicalizePath(path: string): string {
	const absolute = resolve(path);
	let existing = absolute;
	// 向上找第一个存在的祖先。盘符根 / UNC 根的 dirname 等于自身，据此终止。
	while (!existsSync(existing)) {
		const parent = dirname(existing);
		if (parent === existing) return absolute;
		existing = parent;
	}
	let real: string;
	try {
		// .native 而非 realpathSync：后者在 Windows 上不解析 8.3 短名
		// （os.tmpdir() 返回的就是 `WANGZH~1` 这种形态，实测）。
		real = realpathSync.native(existing);
	} catch {
		return absolute;
	}
	// 只差大小写 = 没穿过任何链接，保留词法形式（理由见上）。
	if (real.toLowerCase() === existing.toLowerCase()) return absolute;
	// 用 relative 取剩余段，不手工切字符串：盘符根自带尾分隔符，
	// 按长度切会吃掉一个字符（写这段时真的踩到了：`E:\` + slice → `E:\\sers`）。
	const tail = relative(existing, absolute);
	return tail === "" ? real : join(real, tail);
}

/**
 * `target` 是否在 `base` 之内（含 `base` 自身）—— **两侧都先归一化到真实位置**。
 *
 * 归一化两侧而不只归一化 target：base 自己也可能经由链接给出
 * （工作区路径由用户在设置里选，`~/KamiBuddy` 完全可以是个 junction）。
 * 只归一化一侧会让「工作区内的文件」被判成区外 —— 那是反方向的误伤，
 * 用户会看到自己工作区里的每次写入都弹窗。
 */
export function isPathContained(base: string, target: string): boolean {
	const rel = relative(canonicalizePath(base), canonicalizePath(target));
	// 空串表示就是 base 自身；".." 开头或绝对路径都说明跑到外面去了。
	return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}
