/**
 * todo_write 工具：模型维护会话待办清单的载体，UI 把每次调用渲染成任务清单卡。
 *
 * 全量替换语义：每次调用都传入完整清单，旧的被整体覆盖。工具本身无副作用 ——
 * 清单状态由 renderer 从消息流聚合（多次调用折叠成一张最新全量卡），
 * 历史恢复靠消息回放天然还原，不需要任何额外持久化，所以这里也没有注入依赖。
 *
 * schema 只钉硬边界（0-50 项、content 非空、status 三态）：pi 执行前按 schema
 * 校验入参（pi-ai 的 validateToolArguments），execute 不再重复校验。
 * 「任何时刻恰好一项 in_progress」是守则引导而非硬校验 —— 模型偶发违反不该
 * 变成工具错误打断 agent 循环，确认文本取第一个 in_progress 项展示即可。
 *
 * 空数组是收尾语义（清单关闭），不是入参错误，故不设 minItems。
 * 确认文本不复述清单内容：清单已在 UI 可见，复述是纯 token 开销。
 */

import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { declareReadOnlyTools } from "./permission-policy.ts";

/**
 * 待办清单的一项（details 契约，UI 结构化消费）。
 * shared 层另有一份同构定义 —— renderer 不许 import extensions，两处各自定义。
 */
export interface TodoItem {
	readonly content: string;
	readonly activeForm?: string;
	readonly status: "pending" | "in_progress" | "completed";
}

const TodoItemSchema = Type.Object({
	content: Type.String({ minLength: 1, description: "任务内容，一句话说清要做什么。" }),
	activeForm: Type.Optional(
		Type.String({
			minLength: 1,
			description: "进行时短语（如「正在整理数据」），执行期间展示给用户；仅进行中项需要。",
		}),
	),
	status: Type.Union(
		[Type.Literal("pending"), Type.Literal("in_progress"), Type.Literal("completed")],
		{ description: "pending 待办 / in_progress 进行中 / completed 已完成。" },
	),
});

/** 确认文本：只报计数与进行中项，不复述清单（理由见文件头）。 */
function confirmText(todos: readonly TodoItem[]): string {
	if (todos.length === 0) return "待办清单已清空。";
	const done = todos.filter((t) => t.status === "completed").length;
	const current = todos.find((t) => t.status === "in_progress");
	const doing = current === undefined ? "" : `（进行中：${current.content}）`;
	return `待办清单已更新：${done} 项已完成 / 共 ${todos.length} 项${doing}。`;
}

export function todoExtensionFactory(): ExtensionFactory {
	// 权限档自声明（permission-policy 批注：编排类、无本地路径、无副作用）——
	// 声明在注册处，写工具的人顺手登记，不再有中心清单要记得更新。
	declareReadOnlyTools(["todo_write"]);
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "todo_write",
			label: "任务列表",
			description:
				"维护会话待办清单，跟踪多步骤任务的执行进度，清单会实时展示给用户。" +
				"每次调用都传入完整清单（全量替换，不是增量修改），任务推进、完成或计划有变时就更新一次。" +
				"每项含内容 content 与状态 status（pending 待办 / in_progress 进行中 / completed 已完成）；" +
				"进行中的那一项用 activeForm 写一个进行时短语（如「正在整理数据」），执行期间界面上展示它。" +
				"长任务每完成 3-5 项，用一句话在回复里小结：做到了什么、还剩几项、接着做哪一项。" +
				"任务全部完成时传空数组，表示清单关闭。",
			promptSnippet:
				"todo_write: 多步任务维护待办清单（全量替换）——进行中项写 activeForm，完成立即标 completed，全部做完传空数组",
			promptGuidelines: [
				"少于 3 步的简单任务不要用这个工具——直接做，清单是纯开销。",
				"任何时刻恰好一项 in_progress；开始下一项前先把当前项标 completed。",
				"每次调用都返回完整清单（全量替换，不是增量）。",
				// 照 WorkBuddy 的 Mid-Session Checkpoints 条款（cli/product.json 的
				// tool-todowrite-description，原文是 CRITICAL/non-negotiable）：清单本身在
				// 界面上是折叠起来的，用户判断进度只能靠这几句小结。
				"长任务每完成 3-5 项，用一段小结点名进度：已完成的要点、还剩几项、接下来做哪一项。",
				"所有任务完成、传空数组收尾时，正文里明确说清做完了什么，不要静默收尾。",
			],
			parameters: Type.Object({
				todos: Type.Array(TodoItemSchema, {
					maxItems: 50,
					description: "完整待办清单（全量替换，最多 50 项）；全部完成时传空数组收尾。",
				}),
			}),
			async execute(_toolCallId, params) {
				return {
					content: [{ type: "text" as const, text: confirmText(params.todos) }],
					details: { todos: params.todos },
				};
			},
		});
	};
}
