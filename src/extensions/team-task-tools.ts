/**
 * 团队共享任务板三工具（spec: add-team-collaboration-parity 批次 ①）：
 * team_task_create / team_task_update / team_task_list。
 *
 * 与 team-tools 同取向：编排与回传格式在本文件，执行本体（任务板）由 daemon
 * 装配时注入 —— 脱离宿主可单测。任务板的纯逻辑在 daemon/team-tasks.ts。
 *
 * 语义要点（对齐 WorkBuddy Agent Teams Task List，裁剪见 spec 的否决方案）：
 *   - 三态以上：pending（等依赖）→ ready（可开工）→ in_progress → completed /
 *     cancelled；**上游完成自动解锁下游**由板实现，工具只负责转述；
 *   - 依赖**只在创建时声明**且只能指向已存在的任务，因此无环、无运行期拓扑排序；
 *   - 与 `todo_write` 无关：那是主会话的私人待办投影，这是团队协调状态；
 *   - 开关：isEnabled 为 false 时工厂不注册任何工具（craft 白名单里的名字
 *     对 pi 静默忽略，同 team-tools）。
 *
 * ── 模型体验契约（scripts/check-model-experience.ts 机械校验；改行为必须同步改这里）──
 * What the model sees: 三个工具（team_task_create / team_task_update / team_task_list）
 * 的名称、description 与参数 schema；返回的任务清单文本（id、状态、owner、依赖）与
 * 错误文案（未知任务 id / 依赖不存在 / 空批次）。
 * Token effect: 定义常驻（**三条**定义）；返回是任务清单的紧凑文本，行数随任务数线性增长。
 * KV Cache effect: 定义字面量会话内恒定；`isEnabled` 为 false 时三个工具根本不注册 ——
 * 工具集本身是前缀的一部分，开关在会话间翻转会让改动点之后的整段前缀（含历史）失配
 * （判据同 mcp-client）。结果追加在历史之后，不动既有前缀。
 */

import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { TeamTask, TeamTaskInput, TeamTaskStatus } from "../core/team-tasks.ts";
import { declareReadOnlyTools } from "./permission-policy.ts";

export interface TeamTaskToolDeps {
	/** 团队开关（与 team-tools 同一开关：没有团队就没有共享任务）。 */
	readonly isEnabled: () => boolean;
	readonly createTasks: (inputs: readonly TeamTaskInput[]) => readonly TeamTask[];
	readonly updateTask: (
		taskId: string,
		patch: { status?: TeamTaskStatus; owner?: string; result?: string },
	) => TeamTask;
	readonly listTasks: () => readonly TeamTask[];
}

const TaskInputItem = Type.Object({
	title: Type.String({ minLength: 1, description: "任务标题（一句话，可判定完成）。" }),
	detail: Type.Optional(Type.String({ description: "任务说明（自包含：成员看不到本会话历史）。" })),
	owner: Type.Optional(Type.String({ description: "指派的成员名（@寻址键）；缺省 = 未指派。" })),
	blockedBy: Type.Optional(
		Type.Array(Type.String({ minLength: 1 }), {
			description: "依赖的任务 id（必须已创建）；上游全部完成后本任务自动变 ready。",
		}),
	),
});

/** 一条任务的单行渲染（给模型看的紧凑格式）。 */
function renderTask(task: TeamTask, all: readonly TeamTask[]): string {
	const byId = new Map(all.map((candidate) => [candidate.id, candidate]));
	const owner = task.owner === undefined ? "未指派" : task.owner;
	const deps =
		task.blockedBy.length === 0
			? ""
			: `｜依赖：${task.blockedBy.map((id) => `${id}(${byId.get(id)?.status ?? "?"})`).join("、")}`;
	const result = task.result === "" ? "" : `｜结果：${task.result}`;
	return `[${task.id}] ${task.status} · ${task.title}｜owner：${owner}${deps}${result}`;
}

/** 全量清单（按状态分组，模型一眼看出「现在能做什么」）。 */
function renderBoard(tasks: readonly TeamTask[]): string {
	if (tasks.length === 0) return "任务板是空的。用 team_task_create 建任务。";
	const order: readonly TeamTaskStatus[] = ["ready", "in_progress", "pending", "completed", "cancelled"];
	const lines: string[] = [];
	for (const status of order) {
		const group = tasks.filter((task) => task.status === status);
		if (group.length === 0) continue;
		lines.push(`## ${status}（${group.length}）`);
		for (const task of group) lines.push(renderTask(task, tasks));
	}
	return lines.join("\n");
}

export function teamTaskExtensionFactory(deps: TeamTaskToolDeps): ExtensionFactory {
	// 权限档自声明（编排类、无本地路径、无文件副作用）：与 team-tools 的四件套同款。
	declareReadOnlyTools(["team_task_create", "team_task_update", "team_task_list"]);
	return (pi: ExtensionAPI): void => {
		if (!deps.isEnabled()) return;

		pi.registerTool({
			name: "team_task_create",
			label: "建任务",
			description:
				"在团队共享任务板上建任务：支持一次建多条、指派 owner（成员名）、声明依赖。" +
				"依赖只能指向已创建的任务（含本批次里先写的）；上游全部完成后下游自动解锁为 ready。" +
				"建好任务后用 team_send 把对应任务说明发给成员，成员完成后用 team_task_update 标完成。",
			promptSnippet: "team_task_create: 建团队共享任务（可指派 owner 与依赖），是并行协调的账本",
			promptGuidelines: [
				"任务要可判定完成：标题写成「产出什么」，detail 写清验收要求。",
				"依赖只用于真实的先后关系（写作等调研），别为了排序造依赖。",
				"任务数就是并行度；1-2 个任务的小活直接做，不必上板。",
			],
			parameters: Type.Object({
				tasks: Type.Array(TaskInputItem, { minItems: 1, maxItems: 20, description: "要建的任务（1-20 条）。" }),
			}),
			async execute(_toolCallId, params): Promise<{ content: { type: "text"; text: string }[]; details: object }> {
				const created = deps.createTasks(
					params.tasks.map((task) => ({
						title: task.title,
						...(task.detail === undefined ? {} : { detail: task.detail }),
						...(task.owner === undefined ? {} : { owner: task.owner }),
						...(task.blockedBy === undefined ? {} : { blockedBy: task.blockedBy }),
					})),
				);
				const all = deps.listTasks();
				const summary = created
					.map((task) => `- [${task.id}] ${task.title}（${task.status}${task.owner === undefined ? "" : `，owner：${task.owner}`}）`)
					.join("\n");
				return {
					content: [{ type: "text", text: `已建 ${created.length} 条任务：\n${summary}\n\n当前任务板：\n${renderBoard(all)}` }],
					details: {},
				};
			},
		});

		pi.registerTool({
			name: "team_task_update",
			label: "更新任务",
			description:
				"更新任务：改状态（in_progress / completed / cancelled）、指派或改派 owner、写结果摘要。" +
				"标 completed 会**自动解锁**依赖它的任务；标 cancelled 会**级联取消**下游任务。",
			promptSnippet: "team_task_update: 标任务状态/改派 owner/写结果；完成上游会自动解锁下游",
			parameters: Type.Object({
				id: Type.String({ minLength: 1, description: "任务 id（如 t1）。" }),
				status: Type.Optional(
					Type.Union([
						Type.Literal("in_progress"),
						Type.Literal("completed"),
						Type.Literal("cancelled"),
						Type.Literal("ready"),
						Type.Literal("pending"),
					]),
				),
				owner: Type.Optional(Type.String({ description: "指派/改派的成员名。" })),
				result: Type.Optional(Type.String({ description: "结果摘要（完成时写，便于回溯）。" })),
			}),
			async execute(_toolCallId, params): Promise<{ content: { type: "text"; text: string }[]; details: object }> {
				const updated = deps.updateTask(params.id, {
					...(params.status === undefined ? {} : { status: params.status }),
					...(params.owner === undefined ? {} : { owner: params.owner }),
					...(params.result === undefined ? {} : { result: params.result }),
				});
				return {
					content: [
						{
							type: "text",
							text: `已更新：[${updated.id}] ${updated.title} → ${updated.status}\n\n当前任务板：\n${renderBoard(deps.listTasks())}`,
						},
					],
					details: {},
				};
			},
		});

		pi.registerTool({
			name: "team_task_list",
			label: "任务清单",
			description: "查看团队共享任务板：按状态分组列出任务、owner 与依赖，据此决定下一步派谁、还能开工什么。",
			promptSnippet: "team_task_list: 查任务板（ready 的可以开工、pending 的在等上游）",
			parameters: Type.Object({}),
			async execute(): Promise<{ content: { type: "text"; text: string }[]; details: object }> {
				return { content: [{ type: "text", text: renderBoard(deps.listTasks()) }], details: {} };
			},
		});
	};
}
