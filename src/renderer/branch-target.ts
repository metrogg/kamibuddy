/**
 * 用户消息上的分支入口（「重新开始」/「分支出新会话」）与「重试」共用的锚点计算。
 *
 * 为什么锚点是**用户消息序号**而不是条目 id：在线生成的用户消息在渲染层的 id 由
 * session-host 用 `nextId("user")` 现造，与落盘条目 id 不一致（恢复路径才相等）——
 * daemon 只能按序号用它自己那份可信列表（`getUserMessagesForForking()`）解析真实
 * 条目，两侧数量不一致时以 `no-such-entry` 拒绝（spec 的「实测修订」，
 * 见 shared/ipc.ts 的 session:restart 说明）。
 *
 * 为什么原文要在这里拼回 `/skill:<name>`：技能消息在气泡里是胶囊、不在 text 里，
 * 直接回填或重发都会把技能丢掉（与重试路径的既有注释同因）；技能消息在会话条目里
 * 就是普通 user 消息，拼回去 pi 会照旧展开，语义与首次发送一致。
 *
 * 纯函数、无 React / 无 IPC —— 序号口径可以在单测里逐条钉住（与 send-anchor /
 * thinking-fold 同一拆法）。
 */

import type { ConversationEntry } from "@shared/session-events.ts";
import { skillInvocationText } from "@shared/skill-block.ts";

/** 一条用户消息的分支锚点：daemon 要的序号 + 可回填输入框 / 可重发的原文。 */
export interface BranchTarget {
	/** 该消息在**当前会话用户消息序列**里的下标，0 基（只数 role === "user" 的条目）。 */
	readonly userIndex: number;
	/** 用户打过的话（技能按 `/skill:<name> ` 回拼，见 shared/skill-block.ts）。 */
	readonly text: string;
}

/**
 * 逐条构造用户消息的锚点表：Map<条目 id, BranchTarget>。
 *
 * 一次扫完供整列气泡查表（UserBubble 取自己的锚点、重试取末条的锚点）：
 * 把序号计算塞进气泡渲染里逐条重扫是 O(n²)，而这条路径在流式期间每个 delta
 * 都会重渲染（DESIGN.md §11 的性能口径）。
 *
 * 非用户条目不进表 —— 入口只出现在用户消息上（spec 的「入口 SHALL 只出现在
 * 用户消息上」）；查不到即不渲染入口，气泡本身不受影响。
 */
export function branchTargetsOf(entries: readonly ConversationEntry[]): ReadonlyMap<string, BranchTarget> {
	const targets = new Map<string, BranchTarget>();
	let userIndex = 0;
	for (const entry of entries) {
		if (entry.role !== "user") continue;
		targets.set(entry.id, { userIndex, text: skillInvocationText(entry.skillNames ?? [], entry.text) });
		userIndex += 1;
	}
	return targets;
}
