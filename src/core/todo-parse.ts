/**
 * todo_write 的 args → 干净的 TodoItem[]（ToolCard.todos 的唯一来源）。
 *
 * 放 core 而不放 shared 的取舍：shared 只承载类型契约（TodoItem 在
 * session-events.ts，renderer 也 import），「把不可信输入修成干净结构」
 * 是 daemon 侧的活，消费方只有 core 的两条路径 —— session-host
 * （live：tool_execution_start 的 args）与 session-rebuild（恢复：落盘
 * toolCall 的 arguments）。extensions/todo-tool.ts 用不上它（pi 执行前已按
 * typebox schema 校验入参），而 extensions 本就不许 import core（AGENTS.md §1）
 * —— 放 shared「给两边共享」实际上没有第二个消费端，反而让 renderer
 * 也背上这份它永不调用的代码。
 *
 * 防御口径（模型输出不可信；恢复路径读的落盘 JSONL 可能是旧版/半截写入）：
 * - args.todos 不是数组 → undefined（调用方让 todos 键缺席，卡片照常落成）；
 * - 单项缺 content / status、status 非三态 → 剔除该项，其余保留；
 * - activeForm 是装饰字段：脏了丢字段不丢项。
 * 永不抛错 —— 清单只是卡片的增强展示，不该被模型手滑打断卡片落成。
 */

import type { TodoItem } from "../shared/session-events.ts";

const TODO_STATUSES: readonly TodoItem["status"][] = ["pending", "in_progress", "completed"];

function isTodoStatus(value: unknown): value is TodoItem["status"] {
	return typeof value === "string" && (TODO_STATUSES as readonly string[]).includes(value);
}

/** 空数组原样返回 []（收尾语义：清单关闭），与「解析不出」的 undefined 区分。 */
export function parseTodoArgs(args: unknown): readonly TodoItem[] | undefined {
	if (typeof args !== "object" || args === null) return undefined;
	const { todos } = args as Record<string, unknown>;
	if (!Array.isArray(todos)) return undefined;
	const clean: TodoItem[] = [];
	for (const item of todos) {
		if (typeof item !== "object" || item === null) continue;
		const record = item as Record<string, unknown>;
		if (typeof record.content !== "string" || record.content === "") continue;
		if (!isTodoStatus(record.status)) continue;
		clean.push({
			content: record.content,
			...(typeof record.activeForm === "string" && record.activeForm !== ""
				? { activeForm: record.activeForm }
				: {}),
			status: record.status,
		});
	}
	return clean;
}
