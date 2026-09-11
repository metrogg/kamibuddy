/**
 * conversation_search 工具：按关键词检索本机历史会话（spec: add-memory-system）。
 *
 * 工具本体不认识会话文件：JSONL 目录扫描与条目解析都在 daemon
 * （pi 的落盘格式归 core/daemon 层，扩展只持有检索回调）——
 * 与 questionnaire 同构：回调由 daemon 装配时注入，扩展可脱离宿主单测。
 *
 * 无人值守的定时任务 run 会话不注册本工具（daemon 的注入点只在用户会话）：
 * 无人值守会话没有人可以追问「上次聊的是什么」，检索历史是有人值守的
 * 回忆动作，run 会话从简（v1）。
 *
 * 入参边界（query 非空、limit 1-50）只写在 schema 层：pi 的 agent 循环在
 * 执行前按 schema 校验工具入参（pi-ai 的 validateToolArguments），
 * execute 里不再重复校验 —— 重复一套规则只会漂移。
 */

import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ConversationSearchHit } from "../shared/session-events.ts";

export interface ConversationSearchToolDeps {
	/** 检索历史会话，返回按会话新旧排序的命中（由 daemon 注入实现）。 */
	readonly searchSessions: (
		query: string,
		limit: number,
	) => Promise<readonly ConversationSearchHit[]>;
}

/** limit 缺省值：spec 的「上限 20 条」。写在这层而不是 schema default——校验器只校验不填值。 */
const DEFAULT_LIMIT = 20;

/**
 * 无命中时的引导文案。写给模型看：说明下一步怎么走——换关键词重试，
 * 或者内容可能就在当前对话里（这个工具看不到当前对话，当前对话直接答）。
 */
const NO_HIT_TEXT =
	"没有找到包含这些关键词的历史会话。" +
	"可以换更核心的关键词（项目名、文件名、具体名词）或减少关键词数量再试一次；" +
	"如果要找的内容就在当前这场对话里，直接根据当前上下文回答即可，不需要检索。";

/** epoch ms → 「YYYY-MM-DD HH:mm」（本地时区，给用户看的会话时间）。 */
function formatWhen(ms: number): string {
	const d = new Date(ms);
	const pad = (n: number): string => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 命中列表排成给模型看的文本：每会话一段「标题 + 日期 + 片段」。
 * 片段里可能含换行（原文如此），用分隔线隔开各段，模型按段引用不易串。
 */
function formatHits(hits: readonly ConversationSearchHit[]): string {
	const sections = hits.map(
		(hit, i) => `【${i + 1}】${hit.title}（${formatWhen(hit.modifiedAt)}）\n${hit.snippet}`,
	);
	return `找到 ${hits.length} 个包含这些关键词的历史会话：\n\n${sections.join("\n\n---\n\n")}`;
}

export function conversationSearchExtensionFactory(
	deps: ConversationSearchToolDeps,
): ExtensionFactory {
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "conversation_search",
			label: "检索历史会话",
			description:
				"按关键词检索本机保存的历史会话，返回命中会话的标题、日期与命中处的上下文片段。" +
				"当用户提到「之前讨论过」「上次那个方案」这类过去对话里的内容、而当前上下文中没有时，用它回忆细节。" +
				"查询必须自包含：这个工具看不到当前对话，要把「刚才说的那个报告」换成「Q3 营收报告」这类具体关键词再查。" +
				"多个关键词是「并且」关系：只有全部包含的会话才会命中。",
			promptSnippet:
				"conversation_search: 按关键词检索历史会话（查询要自包含，工具看不到当前对话；用户提及过去的讨论而当前上下文没有时用）",
			promptGuidelines: [
				"查询写成自包含的关键词组：把用户话里的指代（这个、上次那个）替换成具体名词（项目名、文件名、主题）再查，否则大概率查不到。",
				"当前对话里就有的内容直接回答，不要检索——这个工具只查历史会话，查不到当前这场。",
				"没找到时换更核心的关键词或减少关键词数量重试一次；仍没有就如实告诉用户没找到，不要编造。",
			],
			parameters: Type.Object({
				query: Type.String({
					minLength: 1,
					description:
						"检索关键词，空格分隔多个词（全部命中才算匹配）。必须自包含：写具体名词，不写指代。",
				}),
				limit: Type.Optional(
					Type.Integer({
						minimum: 1,
						maximum: 50,
						description: `最多返回几个会话，缺省 ${DEFAULT_LIMIT}。`,
					}),
				),
			}),
			async execute(_toolCallId, params) {
				// details 形状在两个分支必须一致（pi 的 AgentToolResult<TDetails>
				// 按分支联合推断，形状不一会编不过）。
				const hits = await deps.searchSessions(params.query, params.limit ?? DEFAULT_LIMIT);
				if (hits.length === 0) {
					return {
						content: [{ type: "text" as const, text: NO_HIT_TEXT }],
						details: { hitCount: 0 },
					};
				}
				return {
					content: [{ type: "text" as const, text: formatHits(hits) }],
					details: { hitCount: hits.length },
				};
			},
		});
	};
}
