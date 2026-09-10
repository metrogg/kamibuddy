/**
 * 任务列表推送的纯函数判读（Task 3.2）。
 *
 * taskListChanged 是全量推送（SessionSummary.running 由 daemon 权威组装），
 * renderer 的「run 结束」判定 = 前后两份列表间 running 标志的 true→false 翻转。
 * 为什么不用会话事件流判：automation run 的会话事件不转发 renderer，
 * 事件流覆盖不到它；推送翻转对任何来源的 run 都成立。
 * 纯函数抽出以便单测（同 session-groups 的惯例），App 里只剩副作用接线。
 */

import type { SessionSummary } from "@shared/ipc.ts";

/**
 * 找出 running 由 true 翻转为 false 的会话（返回新列表中的项）。
 * 新出现/消失的项不算翻转：判不出「之前在跑」，不补打未读。
 */
export function detectFinishedRuns(
	prev: readonly SessionSummary[],
	next: readonly SessionSummary[],
): readonly SessionSummary[] {
	if (prev.length === 0 || next.length === 0) return [];
	const wasRunning = new Map(prev.map((s) => [s.id, s.running]));
	return next.filter((s) => !s.running && wasRunning.get(s.id) === true);
}
