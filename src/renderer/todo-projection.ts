/**
 * todo_write 清单卡的聚合投影（WorkBuddy projectTaskList 同口径）。
 *
 * todo_write 是全量替换语义：每次调用携带完整清单，消息流里散落的 N 张
 * todo_write 卡在渲染前折叠成**一张合成卡** —— 内容取最新一次调用的全量，
 * 位置钉在第一次出现处（进度面板是「活」的常驻物，不该随每次更新在流里
 * 往后挪），其余 todo 卡移除。
 *
 * 为什么放在渲染进程而不是 reducer：reducer 折叠的是会话事实流（daemon 与
 * renderer 两端共用同一份），合成卡是纯展示层的取舍；且 reducer 按事件
 * 增量折叠，跨调用回溯改旧卡会破坏「同 id 卡原位更新」的既有不变式。
 * 纯函数独立成文件：窗口化锚定等规则不挂 React 即可单测（§7 测试护栏）。
 */

import type { ConversationEntry, TodoItem, ToolCard } from "@shared/session-events.ts";

function isTodoCard(entry: ConversationEntry): entry is ToolCard {
	return entry.role === "tool" && entry.toolName === "todo_write";
}

/**
 * 把 entries 里所有 todo_write 卡折叠成一张合成卡。
 *
 * - 无 todo_write 卡：原样返回**同一数组引用**（零开销，不触发下游重渲染）。
 * - 合成卡 = 第一张 todo 卡展开覆盖 `{ todos, generating }`：保留首张的 id/at
 *   （id 稳定利于 React reconciliation），todos 取最后一张带 todos 的卡
 *   （全量替换语义，最新即全量；脏 args 解析不出的卡 todos 键缺席，自然跳过）。
 * - 生成中卡（generating 且 todos 缺席）是「最新进展」：它是最后一张 todo 卡
 *   时合成卡保留 generating 标记（渲染层据此显示「接收中…」），todos 继承
 *   它之前最近一张终态卡的 —— 流式期间清单不空白。
 */
export function projectTodoList(entries: readonly ConversationEntry[]): readonly ConversationEntry[] {
	let firstIndex = -1;
	let firstCard: ToolCard | undefined;
	let lastCard: ToolCard | undefined;
	let todos: readonly TodoItem[] | undefined;
	for (let i = 0; i < entries.length; i += 1) {
		const entry = entries[i];
		if (entry === undefined || !isTodoCard(entry)) continue;
		if (firstCard === undefined) {
			firstCard = entry;
			firstIndex = i;
		}
		lastCard = entry;
		if (entry.todos !== undefined) todos = entry.todos;
	}
	if (firstCard === undefined || lastCard === undefined) return entries;

	const generating = lastCard.generating === true && lastCard.todos === undefined;
	const synthetic: ToolCard = { ...firstCard, todos, generating };

	const next: ConversationEntry[] = [];
	for (let i = 0; i < entries.length; i += 1) {
		const entry = entries[i];
		if (entry === undefined) continue;
		if (isTodoCard(entry)) {
			if (i === firstIndex) next.push(synthetic);
			continue;
		}
		next.push(entry);
	}
	return next;
}

/**
 * 清单窗口化：超过 max 条时只显示一个以「当前进展」为锚的窗口。
 *
 * 锚定优先级（对齐 WorkBuddy）：in_progress 项 → 最后一个 completed 项 →
 * 全是 pending 时无前进展可言，显示前 max 条。窗口以锚为中心上下均分，
 * 边界处贴边（锚在头部则窗口从头起，在尾部则到尾止）。
 *
 * 不超过 max 条时返回同一数组引用。
 */
export function windowTodos(todos: readonly TodoItem[], max = 5): readonly TodoItem[] {
	if (todos.length <= max) return todos;
	let anchor = todos.findIndex((todo) => todo.status === "in_progress");
	if (anchor < 0) anchor = todos.findLastIndex((todo) => todo.status === "completed");
	if (anchor < 0) return todos.slice(0, max);
	const start = Math.max(0, Math.min(anchor - Math.floor((max - 1) / 2), todos.length - max));
	return todos.slice(start, start + max);
}
