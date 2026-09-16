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

import { isAbsolute, resolve } from "node:path";
import { isPathContained } from "../core/path-containment.ts";
import {
	LOCAL_READ_TOOLS,
	firstTokenPrefix,
	parseRulesFile,
	splitCommand,
	type PermissionRule,
} from "../shared/permissions.ts";

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

/*
 * 归属判定委托给 `core/path-containment.ts`（与 permission-policy.ts 的 isInside
 * 同一个实现）。
 *
 * 这里原本抄了一份 policy 的 isInside，注释写的是「policy 已 import 本模块，
 * 反向 import 会构成循环依赖」，并留了一句「两处若将来要改语义必须一起改」——
 * 2026-09-16 加真实路径归一化时就是那个「将来」。与其同步两份，不如把实现
 * 移到两侧都能 import 的 core 层（extensions → core 是允许方向），
 * 重复就此消掉：语义只有一处，不会再漂移。
 */
const isInsidePath = isPathContained;

/**
 * 路径前缀规则判定（spec: extend-permission-rules-to-paths）。
 *
 * 与 evaluateCommand 的三态语义相同，但匹配维度从「命令前缀」换成「路径归属」：
 * 只匹配 rule.tool === "read" 的规则 —— "read" 代表整个本地只读家族
 * （read / read_document / find / grep / ls 语义相同，不逐工具区分，
 * 家族名单见 shared/permissions.ts 的 LOCAL_READ_TOOLS）。
 *
 * 命中语义：target 等于 prefix 或位于 prefix 目录之下。prefix 非绝对路径的
 * 规则无法做归属判定，忽略不生效（不炸 —— 规则文件是用户数据，与
 * parseRulesFile「坏行 = 该行不存在」的降级口径一致）。
 *
 * 最严获胜：deny 与 allow 同时命中时 deny 立即返回。target 调用方已
 * resolve，这里仍 resolve 一遍保证独立可用（resolve 幂等）。
 */
export function evaluatePathRules(target: string, rules: readonly PermissionRule[]): CommandRuleVerdict {
	const resolvedTarget = resolve(target);
	let allowed = false;
	for (const rule of rules) {
		if (rule.tool !== "read") continue;
		if (!isAbsolute(rule.prefix)) continue;
		if (!isInsidePath(rule.prefix, resolvedTarget)) continue;
		// deny 与 allow 都命中时 deny 立即获胜 —— 最严，无歧义（与 evaluateCommand 同口径）。
		if (rule.action === "deny") {
			return {
				kind: "deny",
				reason: `路径「${resolvedTarget}」命中拒绝规则「${rule.tool}: ${rule.prefix}」`,
			};
		}
		allowed = true;
	}
	return allowed ? { kind: "allow" } : { kind: "unmatched" };
}

/**
 * 批准写回的规则构造（spec: add-permission-rules-engine Task 3；
 * 路径写回：extend-permission-rules-to-paths Task 2）。
 *
 * 从审批响应里提炼要写回的 allow 规则；任何一种「不该写回」都返回 undefined。
 * 调用方是 daemon 的审批回程 handler（daemon/index.ts）—— **响应来自 IPC，
 * 不信任对端**：渲染层传来的东西不能成为规则文件的注入通道。所以这里按工具
 * 分流两套校验，把 rememberPrefix 当作候选值重新过一遍全套检查，非法载荷
 * 一律忽略，不炸不拒。
 *
 * - **powershell**（命令前缀）：把 rememberPrefix 当作一条候选命令重新过
 *   firstTokenPrefix 的校验，并要求它与提取出的首词**逐字相等** —— 含空白
 *   （"git status"）、含分隔符（"git && rm"）、解释器前缀（"python"、"IEX"）
 *   的载荷全部忽略。
 * - **read 家族**（路径前缀，写回的规则记 tool: "read"）：rememberPrefix
 *   必须是绝对路径，且不得落在 guardDirs（凭据/配置目录）之内 —— 那种规则
 *   是死规则（判定链阶段 1 永远先拒，规则无法越过），写进规则文件只会误导
 *   用户以为「这里已经免问了」。guardDirs 由 daemon 装配侧注入
 *   （[configDir, ...protectedDirs]）；**未传时保守不写** —— 没有禁区知识
 *   就不写路径规则。通过的 prefix 记 resolve 后的规范形，与
 *   evaluatePathRules 判定 target 前的解析口径一致。
 *
 * 两道共同闸门：决定必须是 allow（拒绝时附着 rememberPrefix 不该写出一条
 * allow 规则）；其余工具（write / bash / …）的审批上附着 prefix 不产生
 * 任何规则。
 */
export function rememberRuleFromApproval(
	toolName: string,
	response: { readonly decision: "allow" | "deny"; readonly rememberPrefix?: string },
	guardDirs?: readonly string[],
): PermissionRule | undefined {
	if (response.decision !== "allow") return undefined;
	const prefix: unknown = response.rememberPrefix;
	// typeof 兜底：IPC 对端可以发任何 JSON，类型声明挡不住运行时载荷。
	if (typeof prefix !== "string" || prefix === "") return undefined;

	if (toolName === "powershell") {
		if (firstTokenPrefix(prefix) !== prefix) return undefined;
		return { tool: "powershell", prefix, action: "allow" };
	}

	if (LOCAL_READ_TOOLS.has(toolName)) {
		// 规则匹配按绝对路径做归属判定（evaluatePathRules），相对路径写回去也匹配不到。
		if (!isAbsolute(prefix)) return undefined;
		// 没有禁区知识就不写路径规则：漏拦凭据目录比少一次写回糟得多。
		if (guardDirs === undefined) return undefined;
		for (const dir of guardDirs) {
			if (isInsidePath(dir, prefix)) return undefined;
		}
		return { tool: "read", prefix: resolve(prefix), action: "allow" };
	}

	return undefined;
}
