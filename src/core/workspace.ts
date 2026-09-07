/**
 * 工作空间的目录守卫与目录操作。
 *
 * 为什么这层必须是硬校验：权限门对工作空间内的写操作**直接放行**
 * （permission-policy.ts），所以「把哪个目录设为工作空间」本身就是安全边界。
 * 这里挡掉的每一类，都是「一旦放行就等于把钥匙交出去」的目录：
 *
 *   - 配置目录（~/.kamibuddy）：里面有 auth.json 密钥。
 *     其祖先也要拒——设为用户目录等于整个家目录都放行。
 *   - 应用所在目录（daemon 的 process.cwd()）：生产是安装目录（Program Files），
 *     开发是本项目仓库。让 AI 自由改写应用自身，两边都不可接受。
 *   - 文件系统根 / 相对路径：明显的误操作。
 *
 * 机制参考 WorkBuddy（workspace = 目录路径、默认根下建同名子目录），
 * 但校验规则是我们自己的：它只查可写性，我们把「不许指向哪」显式化。
 *
 * 纯 Node、不 import pi 与 electron（AGENTS.md §1），可脱离宿主单测。
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { isAbsolute, join, parse, resolve, sep } from "node:path";

export interface WorkspaceGuards {
	readonly configDir: string;
	readonly appDir: string;
}

/** child 是否等于 parent 或位于其内部。Windows 路径大小写不敏感。 */
function sameOrInside(parent: string, child: string): boolean {
	const normalize = (p: string): string => {
		const resolved = resolve(p);
		return process.platform === "win32" ? resolved.toLowerCase() : resolved;
	};
	const p = normalize(parent);
	const c = normalize(child);
	return c === p || c.startsWith(p.endsWith(sep) ? p : p + sep);
}

/**
 * 校验候选工作空间路径。返回 undefined 表示可用，否则返回给用户看的原因。
 * 返回原因而非抛错：调用方（daemon）要把它变成 IPC 错误消息。
 */
export function validateWorkspacePath(path: string, guards: WorkspaceGuards): string | undefined {
	if (!isAbsolute(path)) return "工作空间必须是绝对路径";
	if (parse(resolve(path)).root === resolve(path)) return "不能把文件系统根目录设为工作空间";
	if (sameOrInside(guards.configDir, path) || sameOrInside(path, guards.configDir)) {
		return "不能把配置目录（含密钥）或其上层目录设为工作空间";
	}
	if (sameOrInside(guards.appDir, path) || sameOrInside(path, guards.appDir)) {
		return "不能把应用目录设为工作空间";
	}
	return undefined;
}

/** Windows 文件名保留字符 + 控制字符。防创建失败与路径逃逸。 */
const ILLEGAL_NAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/;

/**
 * 在默认根下新建工作空间子目录（对标 WorkBuddy 的「为工作空间命名，
 * 本地将自动创建同名文件夹」）。返回创建的路径。
 * 名称即目录名，创建后不可改名（WorkBuddy 同样如此约束）。
 */
export function createWorkspace(root: string, name: string): string {
	const trimmed = name.trim();
	if (trimmed === "") throw new Error("工作空间名称不能为空");
	if (ILLEGAL_NAME_CHARS.test(trimmed) || trimmed === "." || trimmed === "..") {
		throw new Error(`工作空间名称含非法字符：${trimmed}`);
	}
	if (trimmed.length > 64) throw new Error("工作空间名称过长（最多 64 字符）");

	mkdirSync(root, { recursive: true });
	const target = join(root, trimmed);
	if (existsSync(target)) throw new Error(`工作空间「${trimmed}」已存在`);
	mkdirSync(target);
	return target;
}

/** 列出默认根下的已有工作空间（子目录），按名称排序。根目录不存在时返回空。 */
export function listWorkspaces(root: string): readonly string[] {
	if (!existsSync(root)) return [];
	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(root, entry.name))
		.sort((a, b) => a.localeCompare(b));
}
