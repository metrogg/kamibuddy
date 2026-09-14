/**
 * task 工具：把可独立的子任务委派给子代理，在隔离上下文中执行后回传结果。
 *
 * 三模式（恰好选一种）：单发 { agent, task }；并行 { tasks: [...] }（1-8）；
 * 链式 { chain: [...] }（1-8，{previous} 占位符注入上一步输出，失败即停）。
 *
 * 执行本体不在这里：runSubagent / listAgents / checkBudget 由 daemon 装配时注入
 * （子代理执行器、agents 清单、每会话 spawn 预算），本文件只写编排与回传格式，
 * 于是可脱离宿主单测（同 questionnaire-tool 的做法）。
 *
 * 「恰好一种模式」放在 execute 判定而不是 Type.Union：pi 在 schema 校验前会先
 * 跑 Value.Convert（pi-ai 的 validateToolArguments），对 additionalProperties:false
 * 的联合分支，Convert 可能削掉多余键把混合入参静默归入某一支 —— 三选一的
 * 语义必须由我们自己判定，混合入参得到的是明确指导而不是被静默选边。
 * schema 仍负责各分支的形状边界（1-8 个、非空字符串）。
 *
 * 进度：execute 的 onUpdate 是 pi 提供的部分结果通道，但走的不是文本——
 * 每次子代理状态变化都发一份**全量投影**（details.subagents，整体替换语义，
 * 契约见 shared/session-events.ts 的 SubagentStatus 注释），由 SessionHost
 * 桥接成 subagent_progress 事件。并行多代理各自推进，文本 delta 会让进度行
 * 交错混在一行 detail 里，投影替换则幂等且天然分组；模型看到的回传
 * （content 文本）不受影响，只改 UI 进度通道。
 */

import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { AgentDefinition } from "../core/agents.ts";
import type { SubagentStatus } from "../shared/session-events.ts";

/** 委派给执行器的一次子代理运行（cwd 由 daemon 装配时补注入）。 */
export interface SubagentRunRequest {
	readonly agent: AgentDefinition;
	readonly task: string;
	readonly signal?: AbortSignal;
	readonly onProgress?: (text: string) => void;
}

export interface SubagentRunOutcome {
	/** 已截断 + 去毒的输出文本。 */
	readonly output: string;
	readonly turns: number;
}

export interface TaskToolOptions {
	readonly runSubagent: (request: SubagentRunRequest) => Promise<SubagentRunOutcome>;
	readonly listAgents: () => readonly AgentDefinition[];
	/**
	 * spawn 预算：每个子任务执行前调用一次，true = 已扣减一份预算、可以执行；
	 * false = 预算耗尽。注入计数器而非只读标志，是为了并行模式下扣减是原子的。
	 */
	readonly checkBudget: () => boolean;
}

/** 一个子任务的回传记录（details 契约，工具卡可据此渲染完整结构）。 */
interface SubtaskReport {
	readonly agent: string;
	readonly ok: boolean;
	/** ok：输出（截断 + 去毒）；失败：诊断文本。 */
	readonly text: string;
	readonly turns: number;
}

interface TaskToolDetails {
	readonly mode: "single" | "parallel" | "chain";
	readonly results: readonly SubtaskReport[];
	/**
	 * 子代理运行状态的全量投影（UI 进度通道，整体替换语义）。
	 * 部分结果与终态同形状：部分结果里 results 恒空、靠 subagents 表达进展；
	 * 终态两者皆全，subagents 与 results 一一对应（同下标）。
	 */
	readonly subagents: readonly SubagentStatus[];
}

const TaskItem = Type.Object({
	agent: Type.String({ minLength: 1, description: "要委派的子代理名。" }),
	task: Type.String({
		minLength: 1,
		description: "任务描述。子代理看不到这次对话，必须把背景、文件路径、要求写全。",
	}),
});

/** 预算耗尽文案：写给模型看，必须告诉它下一步怎么走（按现有信息继续，不要反复重试）。 */
const BUDGET_EXHAUSTED_TEXT =
	"本次会话的子代理调用预算已耗尽（每个会话最多 20 次，防止失控循环）。" +
	"请按现有信息继续完成任务；确有必要，告知用户新建任务后再委派。";

function availableAgentsText(agents: readonly AgentDefinition[]): string {
	if (agents.length === 0) return "当前没有可用的子代理。";
	return `可用子代理：\n${agents.map((a) => `- ${a.name}：${a.description}`).join("\n")}`;
}

/** 每个子任务一段：agent 名、输出（或诊断）、轮数。 */
function formatReport(report: SubtaskReport): string {
	if (report.ok) {
		return `子代理「${report.agent}」完成（${report.turns} 轮）：\n${report.text === "" ? "（无输出）" : report.text}`;
	}
	return `子代理「${report.agent}」失败：\n诊断：${report.text}`;
}

export function taskExtensionFactory(options: TaskToolOptions): ExtensionFactory {
	// 工具描述里的子代理简介动态生成：agents 是数据，用户可同名覆盖内置
	// （~/.kamibuddy/agents/），写死简介会与实际生效的定义漂移。
	const agentLines = options
		.listAgents()
		.map((a) => `- ${a.name}：${a.description}`)
		.join("\n");

	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "task",
			label: "子任务",
			description:
				"把可独立完成的子任务委派给子代理，在隔离上下文中执行，结果回传给你整合。" +
				"三种用法恰好选一种：单发 { agent, task }；并行 { tasks: [{ agent, task }, ...] }（1-8 个，同时执行）；" +
				"链式 { chain: [{ agent, task }, ...] }（1-8 步，顺序执行，task 里的 {previous} 会被替换为上一步输出）。" +
				"子代理看不到这次对话：任务描述必须自包含，把需要的文件路径、背景与验收要求都写全。\n" +
				`可用子代理：\n${agentLines}`,
			promptSnippet:
				"task: 把可独立的调研/汇总/执行委派给子代理（隔离上下文）——单发 agent+task、并行 tasks 数组、链式 chain 数组（{previous} 占位上一步输出）；任务描述必须自包含",
			promptGuidelines: [
				"子代理看不到这次对话，「这个」「刚才那份」这类指代会落空——任务描述里写全文件路径与背景。",
				"互相独立、可并行的事项用 tasks 一次发多个；后一步依赖前一步产出的用 chain 与 {previous} 占位符。",
				"琐碎的小事不要委派——委派的收益是隔离上下文与并行，一步能查完的直接自己查。",
			],
			parameters: Type.Object({
				agent: Type.Optional(
					Type.String({ minLength: 1, description: "单发模式：要委派的子代理名。" }),
				),
				task: Type.Optional(
					Type.String({ minLength: 1, description: "单发模式：任务描述（自包含）。" }),
				),
				tasks: Type.Optional(
					Type.Array(TaskItem, {
						minItems: 1,
						maxItems: 8,
						description: "并行模式：1-8 个 { agent, task }，同时执行。",
					}),
				),
				chain: Type.Optional(
					Type.Array(TaskItem, {
						minItems: 1,
						maxItems: 8,
						description: "链式模式：1-8 步顺序执行，task 里可用 {previous} 引用上一步输出。",
					}),
				),
			}),
			async execute(_toolCallId, params, signal, onUpdate): Promise<{
				content: Array<{ type: "text"; text: string }>;
				details: TaskToolDetails;
			}> {
				// 「恰好一种」的判定在这里（不用 Type.Union，理由见文件头注释）。
				// agent/task 只给一半是笔误，一并归入用法错误。
				const singleAgent = params.agent;
				const singleTask = params.task;
				const tasks = params.tasks;
				const chain = params.chain;
				const modeCount =
					Number(singleAgent !== undefined) +
					Number(tasks !== undefined) +
					Number(chain !== undefined);
				if ((singleAgent === undefined) !== (singleTask === undefined) || modeCount !== 1) {
					return {
						content: [
							{
								type: "text" as const,
								text:
									"task 工具需要且只能选择一种用法：" +
									"单发 { agent, task }、并行 { tasks: [...] } 或链式 { chain: [...] }。" +
									"请按其中一种重新调用。",
							},
						],
						details: { mode: "single", results: [], subagents: [] },
					};
				}
				const mode: TaskToolDetails["mode"] =
					tasks !== undefined ? "parallel" : chain !== undefined ? "chain" : "single";

				const agents = options.listAgents();

				/*
				 * 状态投影：按下标定位（同名 agent 在并行/链式里可同时出现多次，
				 * 名字不能当键）。每次变化发一份全量拷贝 —— 消费端整体替换，
				 * 发可变本体引用会让 UI 与后续突变纠缠。
				 * 初始化即发一次（全 queued）：工具卡从执行开始就能摆出全部
				 * 子任务的分组骨架，而不是等第一个子代理起跑才有内容。
				 */
				const plan: ReadonlyArray<{ agent: string; task: string }> =
					tasks ??
					chain ??
					// 走到这里三选一判定已保证单发两半齐全；写全条件让窄化自足。
					(singleAgent !== undefined && singleTask !== undefined
						? [{ agent: singleAgent, task: singleTask }]
						: []);
				const projection: SubagentStatus[] = plan.map((p) => ({
					agent: p.agent,
					task: p.task,
					status: "queued",
					activity: "",
					turns: 0,
				}));
				const emitProjection = (): void => {
					// content 文本恒空：进度全走 details.subagents，文本 delta 通道
					// 对多代理分组进度是负资产（交错混杂），details 形状与终态一致。
					onUpdate?.({
						content: [{ type: "text" as const, text: "" }],
						details: { mode, results: [], subagents: projection.map((s) => ({ ...s })) },
					});
				};
				const patchEntry = (index: number, patch: Partial<SubagentStatus>): void => {
					const current = projection[index];
					if (current === undefined) return;
					projection[index] = { ...current, ...patch };
					emitProjection();
				};
				emitProjection();

				// 执行器的进展文本带「agent名：」前缀（daemon/subagent-runner.ts 的口径），
				// 投影的 agent 字段已有名字，activity 只留动作部分，不重复显示。
				const stripPrefix = (agentName: string, text: string): string => {
					const prefix = `${agentName}：`;
					return text.startsWith(prefix) ? text.slice(prefix.length) : text;
				};

				const runOne = async (
					index: number,
					agentName: string,
					taskText: string,
				): Promise<SubtaskReport> => {
					const agent = agents.find((a) => a.name === agentName);
					// agent 不存在不消耗预算：这是入参错误，不是一次真实执行。
					if (agent === undefined) {
						const text = `没有名为「${agentName}」的子代理。${availableAgentsText(agents)}\n请改用上述之一重新委派。`;
						patchEntry(index, { status: "failed", output: text });
						return { agent: agentName, ok: false, text, turns: 0 };
					}
					if (!options.checkBudget()) {
						patchEntry(index, { status: "failed", output: BUDGET_EXHAUSTED_TEXT });
						return { agent: agentName, ok: false, text: BUDGET_EXHAUSTED_TEXT, turns: 0 };
					}
					patchEntry(index, { status: "running" });
					try {
						const { output, turns } = await options.runSubagent({
							agent,
							task: taskText,
							...(signal === undefined ? {} : { signal }),
							// 排队消息（并发上限超出的「排队等待空位」）也经此落到
							// activity：状态保持 running，等待原因对用户可见。
							onProgress: (text) =>
								patchEntry(index, { activity: stripPrefix(agent.name, text) }),
						});
						patchEntry(index, { status: "done", turns, output });
						return { agent: agentName, ok: true, text: output, turns };
					} catch (error) {
						// 子代理失败不是工具失败：诊断回给主代理，由它决定换路还是如实上报。
						const text = error instanceof Error ? error.message : String(error);
						patchEntry(index, { status: "failed", output: text });
						return { agent: agentName, ok: false, text, turns: 0 };
					}
				};

				/** 终态 details：results 给模型/回放，subagents 给 UI 终态卡（同投影拷贝语义）。 */
				const finalDetails = (results: readonly SubtaskReport[]): TaskToolDetails => ({
					mode,
					results,
					subagents: projection.map((s) => ({ ...s })),
				});

				if (singleAgent !== undefined && singleTask !== undefined) {
					const report = await runOne(0, singleAgent, singleTask);
					return {
						content: [{ type: "text" as const, text: formatReport(report) }],
						details: finalDetails([report]),
					};
				}

				if (tasks !== undefined) {
					// 并发派发，执行器内部的并发闸（4）负责排队，这里不需要再限流。
					const reports = await Promise.all(
						tasks.map((t, index) => runOne(index, t.agent, t.task)),
					);
					const okCount = reports.filter((r) => r.ok).length;
					return {
						content: [
							{
								type: "text" as const,
								text:
									`并行执行 ${reports.length} 个子任务，成功 ${okCount} 个：\n\n` +
									reports.map(formatReport).join("\n\n---\n\n"),
							},
						],
						details: finalDetails(reports),
					};
				}

				if (chain === undefined) {
					// 逻辑不可达（上面的三选一判定已保证），窄化所需 —— 真走到说明判定变了。
					throw new Error("task 工具模式判定失效：三种用法均未命中");
				}
				// 链式：顺序执行，{previous} 替换为上一步输出（首步无占位内容，替换为空串）；
				// 任一步失败即停，返回已完成步与失败步骤诊断。未执行的后续步在投影里
				// 保持 queued —— 如实表达「没轮到」，不编一个取消态。
				const reports: SubtaskReport[] = [];
				let previous = "";
				for (const [index, step] of chain.entries()) {
					const report = await runOne(index, step.agent, step.task.replaceAll("{previous}", previous));
					reports.push(report);
					if (!report.ok) {
						return {
							content: [
								{
									type: "text" as const,
									text:
										`链式执行在第 ${reports.length} 步（${step.agent}）中止，后续步骤未执行：\n\n` +
										reports.map(formatReport).join("\n\n---\n\n"),
								},
							],
							details: finalDetails(reports),
						};
					}
					previous = report.text;
				}
				return {
					content: [
						{
							type: "text" as const,
							text:
								`链式执行完成 ${reports.length} 步：\n\n` +
								reports.map(formatReport).join("\n\n---\n\n"),
						},
					],
					details: finalDetails(reports),
				};
			},
		});
	};
}
