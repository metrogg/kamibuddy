/**
 * 权限规则引擎：三态前缀规则的纯函数判定（spec: add-permission-rules-engine）。
 *
 * 模型照 Codex/Claude Code 已收敛的答案：**前缀规则 + 命令拆分 + 最严获胜**。
 * 拆分防的是「允许了 git status，却把 `git status && rm -rf ./dist` 一并放过去」——
 * 链式命令逐段判定，任一段 deny → 整体 deny；全部段 allow → 整体 allow；
 * 否则 unmatched（调用方维持现状的高风险询问）。
 *
 * 规则类型（PermissionRule）、规则文件解析（parseRulesFile）、命令拆分
 * （splitCommand）与写回前缀提取（firstTokenPrefix）不住在这里 ——
 * 它们要同时被 core/ 的 store 与 renderer 的审批弹窗使用，依赖方向
 * （core/ 不许 import extensions/、renderer 只许 import shared/）
 * 只允许 shared/ 承载，见 shared/permissions.ts。
 * 这里 re-export 只是让「规则引擎」这个模块对外保持完整的 API 面。
 *
 * 本模块是纯函数：不读盘、不碰 pi、不碰 IPC，可脱离宿主单测。
 */

import { firstTokenPrefix, parseRulesFile, splitCommand, type PermissionRule } from "../shared/permissions.ts";

export { firstTokenPrefix, parseRulesFile, splitCommand };
export type { PermissionRule };

/**
 * 前缀匹配：segment（trim、连续空白折叠为单空格后）以 prefix 开头，
 * 且 prefix 后紧跟空白或正好结尾 —— `git` 命中 `git status` 与 `git`，
 * 不命中 `gitx`、`gitignore`。
 *
 * 大小写敏感是有意的：PowerShell 命令本身不区分大小写，但 v1 的规则
 * 按用户写回/手写的原文记（写回的首词是什么就记什么），保持
 * 「规则 = 字面前缀」这个简单可预期的语义。大小写归一是放宽方向，
 * 真要做得单独想清楚（GIT 与 git 该不该算同一条规则不是显然的）。
 *
 * 只对 segment 做空白折叠：规则由写回路径产出（首词，无空白）或用户手写，
 * prefix 保持原文比较 —— 折叠后 segment 内的连续空白已是单空格，
 * `prefix + " "` 的边界判定不受影响。
 */
export function matchesPrefix(segment: string, prefix: string): boolean {
	const normalized = segment.trim().replace(/\s+/g, " ");
	return normalized === prefix || normalized.startsWith(`${prefix} `);
}

/** 规则判定的三态结论。unmatched 表示「规则不表态」，由调用方维持原判定。 */
export type CommandRuleVerdict =
	| { readonly kind: "allow" }
	| { readonly kind: "deny"; readonly reason: string }
	| { readonly kind: "unmatched" };

/**
 * 对一条命令做规则判定（最严获胜）。
 *
 * 规则只作用于它声明的工具（rule.tool === tool）：powershell 的规则管不了
 * bash 调用 —— bash 没有危险命令检查器，规则面先不覆盖它
 * （permission-policy 的 SHELL 分支同一份理由）。
 */
export function evaluateCommand(
	command: string,
	tool: string,
	rules: readonly PermissionRule[],
): CommandRuleVerdict {
	const segments = splitCommand(command);
	if (segments.length === 0) return { kind: "unmatched" };
	let allAllowed = true;
	for (const segment of segments) {
		let segmentAllowed = false;
		for (const rule of rules) {
			if (rule.tool !== tool) continue;
			if (!matchesPrefix(segment, rule.prefix)) continue;
			// 同段内 allow 与 deny 都命中时 deny 立即获胜 —— 最严，无歧义。
			if (rule.action === "deny") {
				return {
					kind: "deny",
					reason: `命令段「${segment}」命中拒绝规则「${rule.tool}: ${rule.prefix}」`,
				};
			}
			segmentAllowed = true;
		}
		if (!segmentAllowed) allAllowed = false;
	}
	return allAllowed ? { kind: "allow" } : { kind: "unmatched" };
}

/**
 * 批准写回的规则构造（spec: add-permission-rules-engine Task 3）。
 *
 * 从审批响应里提炼要写回的 allow 规则；任何一种「不该写回」都返回 undefined。
 * 调用方是 daemon 的审批回程 handler（daemon/index.ts）—— **响应来自 IPC，
 * 不信任对端**：渲染层传来的东西不能成为规则文件的注入通道，所以这里把
 * rememberPrefix 当作一条候选命令重新过 firstTokenPrefix 的全套校验，
 * 并要求它与提取出的首词**逐字相等** —— 含空白（"git status"）、含分隔符
 * （"git && rm"）、解释器前缀（"python"、"IEX"）的载荷全部忽略，不炸不拒。
 *
 * 另外两道闸门：
 *   - 决定必须是 allow —— 拒绝时附着 rememberPrefix 不该写出一条 allow 规则；
 *   - 原始审批必须是 powershell —— v1 规则面只覆盖 powershell，
 *     给 write 审批附一个 prefix 不该产生任何规则。
 */
export function rememberRuleFromApproval(
	toolName: string,
	response: { readonly decision: "allow" | "deny"; readonly rememberPrefix?: string },
): PermissionRule | undefined {
	if (toolName !== "powershell") return undefined;
	if (response.decision !== "allow") return undefined;
	const prefix: unknown = response.rememberPrefix;
	// typeof 兜底：IPC 对端可以发任何 JSON，类型声明挡不住运行时载荷。
	if (typeof prefix !== "string" || prefix === "") return undefined;
	if (firstTokenPrefix(prefix) !== prefix) return undefined;
	return { tool: "powershell", prefix, action: "allow" };
}
