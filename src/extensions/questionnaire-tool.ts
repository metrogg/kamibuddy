/**
 * questionnaire 工具：动手前就关键选择向用户发起结构化提问，阻塞等答。
 *
 * 与权限审批同构（permission-gate.ts 文件头）：execute 挂起，直到 renderer
 * 把用户的作答经 IPC 送回。本文件不认识 IPC —— requestAnswers 回调由
 * daemon 装配时注入（用户会话接真实通道；定时任务 run 会话传 unattended，
 * 没有人在场作答，工具直接返回不可用文案，不阻塞调度器），
 * 于是扩展可脱离宿主单测。
 *
 * 入参边界（1-4 题、每题 2-6 个非空选项）只写在 schema 层：
 * pi 的 agent 循环在执行前按 schema 校验工具入参（pi-ai 的
 * validateToolArguments，校验失败作为工具错误回给模型重试），
 * execute 里不再重复校验 —— 重复一套规则只会漂移。
 *
 * 作答形态是与 renderer 的契约：每题单选一个选项，或选「其他」自由补充；
 * 整卡可跳过。跳过与作答的结果文案写给模型看，必须明确告诉它下一步怎么走。
 */

import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { QuestionnaireRequest, QuestionnaireResponse } from "../shared/ipc.ts";

export interface QuestionnaireToolOptions {
	/** 向宿主发起提问并阻塞等答（id 由工具生成后传入）。 */
	// sessionId 由注入方（daemon 接线闭包）补 —— 扩展不认识会话桶。
	readonly requestAnswers: (
		request: Omit<QuestionnaireRequest, "sessionId">,
	) => Promise<QuestionnaireResponse>;
	/**
	 * 无人值守模式（定时任务 run 会话）：直接返回不可用文案。
	 * 没有人在场作答，挂起等待等于把 run 卡死到超时（同 permission-gate 的
	 * unattended 语义）。
	 */
	readonly unattended?: boolean;
}

/**
 * 无人值守时的返回文案。写给模型看：说明为什么不可用、下一步怎么走 ——
 * 按现有信息继续，不要反复重试这个工具。
 */
const UNATTENDED_TEXT =
	"当前是无人值守运行（定时任务），没有人在场，无法向用户提问。" +
	"请按现有信息继续完成任务；确有绕不开的分歧，在最终结果中如实说明这一点。";

/** 用户整卡跳过时的返回文案。「不再追问」必须写明，否则模型常会换个问法再问一遍。 */
const SKIPPED_TEXT =
	"用户跳过了这次提问，没有选择任何答案。" +
	"按现有信息继续完成任务，不要就同一问题再向用户追问。";

export function questionnaireExtensionFactory(
	options: QuestionnaireToolOptions,
): ExtensionFactory {
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "questionnaire",
			label: "向用户提问",
			description:
				"动手前就关键选择向用户发起结构化提问，阻塞等待作答后返回答案。" +
				"一次提 1-4 个问题，每题给 2-6 个候选选项；用户逐题单选，每题也可以选「其他」自由补充，还可以整卡跳过。" +
				"只用在答案会改变执行方向的关键决策点（成果给谁看、要什么风格、按哪个方向改）；" +
				"能从工作区查到的信息、无关紧要的细节不要问。",
			promptSnippet:
				"questionnaire: 动手前就影响方向的关键选择向用户提问（1-4 题，每题 2-6 个互斥选项；用户可跳过，跳过就按现有信息继续、不再追问）",
			promptGuidelines: [
				"只在答案会改变执行方向时提问；能从文件或对话上下文推断的不要问——提问是一次打断，把真正影响方向的问题一次问清。",
				"选项之间要互斥、覆盖常见情况；覆盖不全没关系，用户可以用每题的「其他」自由补充，不要硬凑选项。",
				"被跳过后按现有信息继续，不要换个问法就同一问题再次提问。",
			],
			parameters: Type.Object({
				questions: Type.Array(
					Type.Object({
						question: Type.String({
							minLength: 1,
							description: "问题正文，一句话说清要用户定什么。",
						}),
						options: Type.Array(Type.String({ minLength: 1 }), {
							minItems: 2,
							maxItems: 6,
							description:
								"候选答案，2-6 个。互斥并覆盖常见情况；「其他」由界面固定提供，不要写进选项。",
						}),
					}),
					{
						minItems: 1,
						maxItems: 4,
						description: "要问的问题，1-4 个。只问真正影响方向的关键决策，一次问清。",
					},
				),
			}),
			async execute(_toolCallId, params) {
				// details 的形状在三个分支必须一致（pi 的 AgentToolResult<TDetails>
				// 按分支联合推断，形状不一会编不过）。
				if (options.unattended === true) {
					return {
						content: [{ type: "text" as const, text: UNATTENDED_TEXT }],
						details: { skipped: false },
					};
				}
				const response = await options.requestAnswers({
					id: randomUUID(),
					questions: params.questions,
				});
				if (response.skipped) {
					return {
						content: [{ type: "text" as const, text: SKIPPED_TEXT }],
						details: { skipped: true },
					};
				}
				// 逐题结算回给模型：作答按题目原文配对，没答的题明确标「未回答」
				// （分页弹层允许逐题跳过 —— 缺失不等于没问，模型据此决定要不要
				// 在结果里说明假设，而不是当成没问过）。
				const settled = params.questions.map((q) => {
					const hit = response.answers.find((a) => a.question === q.question);
					return { question: q.question, answer: hit?.answer ?? "（用户未回答此题）" };
				});
				// details 带 skipped 标记：工具卡的 已回答/已跳过 两态据此区分，
				// 不必反解析给模型看的文案。
				return {
					content: [{ type: "text" as const, text: JSON.stringify(settled, null, 2) }],
					details: { skipped: false },
				};
			},
		});
	};
}
