/**
 * 权限判定策略：纯函数，不碰 pi、不碰 IPC，可单测。
 *
 * 为什么必须有这一层：pi **没有内置权限系统**（README 自述），
 * 而且 `utils/paths.ts:102` 的 resolvePath 对绝对路径直接放行 ——
 * 工具目录里搜不到任何越界检查，`getCwdRelativePath` 只用于显示格式化。
 * 结论：模型只要给出绝对路径，write/edit 就能写到硬盘任何位置。
 *
 * 对办公产品这是不能接受的：试用同事会让它「整理我的文档」，
 * 一次路径失误就可能覆盖掉别的文件。
 *
 * 判定的主轴是**路径归属**而非工具种类：
 *   工作目录内   → 放行（生成文档本来就该在这儿，不该反复打扰）
 *   工作目录外   → 询问（用户可能真想改桌面上的某个文件）
 *   配置目录内   → 直接拒（auth.json 存着 API Key，
 *                  提示注入可能骗用户点「允许」，所以不给这个选项）
 */

import { isAbsolute, relative, resolve, sep } from "node:path";

/** 判定结果。ask 时需要弹窗，deny 时直接拒绝并把 reason 回给模型。 */
export type PermissionDecision =
	| { readonly kind: "allow" }
	| { readonly kind: "deny"; readonly reason: string }
	| {
			readonly kind: "ask";
			readonly risk: "low" | "medium" | "high";
			/** 面向用户的一句话，如「写入工作目录之外的文件」。 */
			readonly summary: string;
			/** 折叠展示的细节（路径、命令等）。 */
			readonly details: string;
	  };

/** 判定所需的输入。与 pi 的事件类型解耦，便于单测。 */
export interface ToolCallFacts {
	readonly toolName: string;
	/** 工具入参里的目标路径，没有则 undefined。 */
	readonly path: string | undefined;
	/** shell 命令（bash / powershell 专用）。 */
	readonly command: string | undefined;
}

export interface PolicyPaths {
	/** 会话工作目录（~/KamiBuddy）。目录内的改动免打扰。 */
	readonly workspaceDir: string;
	/** 配置目录（~/.kamibuddy）。存着 API Key，一律禁写。 */
	readonly configDir: string;
}

/**
 * 只读工具：不改变任何状态，放行。
 * present_files：stat 文件大小（限工作区）+ 发交付事件，不写盘。
 */
const READ_ONLY = new Set(["read", "find", "grep", "ls", "present_files"]);

/** 会改文件的内置工具。 */
const MUTATING = new Set(["write", "edit"]);

/** 会执行任意命令的工具。默认工具集里没有它们，但扩展或设置可能启用。 */
const SHELL = new Set(["bash", "powershell"]);

/** 判断 target 是否在 base 之内（含 base 本身）。 */
function isInside(base: string, target: string): boolean {
	const rel = relative(resolve(base), resolve(target));
	// 空串表示就是 base 自身；".." 开头或绝对路径都说明跑到外面去了。
	return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

/**
 * 判定一次工具调用。
 *
 * 不写「未知工具一律放行」也不写「一律拒绝」：
 * 未知工具（含我们后面自己注册的文档工具）按 ask 处理，
 * 让人来决定 —— 这是 fail-safe 的默认，且不会悄悄阻断新能力。
 */
export function decide(facts: ToolCallFacts, paths: PolicyPaths, cwd: string): PermissionDecision {
	const { toolName, path: rawPath, command } = facts;

	if (READ_ONLY.has(toolName)) return { kind: "allow" };

	if (SHELL.has(toolName)) {
		// shell 无法靠路径判断影响范围，一律询问，并把完整命令给用户看。
		return {
			kind: "ask",
			risk: "high",
			summary: "执行系统命令",
			details: command ?? "(命令为空)",
		};
	}

	if (MUTATING.has(toolName)) {
		if (rawPath === undefined || rawPath === "") {
			return { kind: "deny", reason: "工具调用缺少目标路径" };
		}

		// 相对路径按会话 cwd 解析，与 pi 的 resolveToCwd 行为一致。
		const target = isAbsolute(rawPath) ? resolve(rawPath) : resolve(cwd, rawPath);

		// 配置目录一律禁写，且**不给「允许」这个选项**：
		// auth.json 存着 API Key，若靠弹窗把关，提示注入可以编个理由骗用户点允许。
		// WorkBuddy 同样把配置文件写保护列为独立一层（防注入写 hook 逃逸）。
		if (isInside(paths.configDir, target)) {
			return { kind: "deny", reason: "禁止修改 KamiBuddy 的配置与凭据文件" };
		}

		if (isInside(paths.workspaceDir, target)) return { kind: "allow" };

		return {
			kind: "ask",
			risk: "medium",
			summary: toolName === "write" ? "写入工作目录之外的文件" : "修改工作目录之外的文件",
			details: target,
		};
	}

	// 未登记的工具（含将来自研的文档工具、MCP 工具）：交给人判断。
	return {
		kind: "ask",
		risk: "medium",
		summary: `使用工具「${toolName}」`,
		details: rawPath ?? command ?? "",
	};
}

/**
 * 「本次会话记住」的作用域键。
 *
 * 按工具 + 目标目录记，而不是只按工具名：
 * 用户批准了「写桌面的某个文件」，不该顺带批准「写 C:\Windows」。
 * 目录粒度而非文件粒度，是因为一个任务通常连续写同目录下多个文件，
 * 逐个弹窗会让人放弃使用。
 */
export function rememberKey(facts: ToolCallFacts, cwd: string): string {
	if (facts.path === undefined || facts.path === "") return facts.toolName;
	const target = isAbsolute(facts.path) ? resolve(facts.path) : resolve(cwd, facts.path);
	// 取父目录：resolve 后用 sep 切掉最后一段。
	const at = target.lastIndexOf(sep);
	const dir = at <= 0 ? target : target.slice(0, at);
	return `${facts.toolName}:${dir}`;
}
