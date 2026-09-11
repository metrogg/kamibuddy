/**
 * 历史会话的视图重建：把 pi 落盘的 SessionEntry[] 翻译成渲染层的 ConversationEntry[]。
 *
 * 为什么输入是 buildContextEntries() 的输出而不是 session.messages：
 * pi 的 AssistantMessage / UserMessage 没有稳定 id（只有 timestamp），而 UI 的
 * 流式增量与卡片原位更新全靠 id 定位（session-host.ts 文件头的实测结论）。
 * SessionEntry 带稳定 8-char id 与 ISO timestamp，重放时 id/at 与落盘内容一致；
 * buildContextEntries 还顺带完成 compaction 裁剪 —— 被压缩掉的旧条目不在活动
 * 路径上，恢复出的视图与模型实际看到的上下文一致，不会出现「界面显示着已被
 * 压缩遗忘的内容」。
 *
 * 跳过项的理由（它们属于上下文机制，不是展示内容）：
 * - compaction / model_change / thinking_level_change / label / session_info /
 *   custom / custom_message 条目：压缩、切模型、书签、命名、扩展状态 ——
 *   影响发给模型的上下文，但聊天视图不渲染它们。
 * - role 为 toolResult / bashExecution / custom / branchSummary /
 *   compactionSummary 的 message 条目：toolResult 已被配对消费进 ToolCard.detail；
 *   bashExecution 是 pi CLI 的 ! 命令残留；branchSummary / compactionSummary
 *   是压缩机制的载体消息。
 *
 * 纯函数、只 import pi 的类型不碰运行时实例 —— 可脱离宿主单测（AGENTS.md §1）。
 */

import { isAbsolute, resolve, sep } from "node:path";
import type { SessionEntry, SessionMessageEntry } from "@earendil-works/pi-coding-agent";
import type {
	AssistantMessage,
	ConversationEntry,
	ToolCard,
	ToolOutcome,
	UserMessage,
} from "../shared/session-events.ts";
import type { PresentedFile } from "../shared/artifacts.ts";
import type { TokenUsage } from "../shared/observability.ts";
import type { ImagePart } from "../shared/image.ts";
import { parseTodoArgs } from "./todo-parse.ts";

/* pi 的具体消息类型不从包名直接 import（pi-ai 是 pi-coding-agent 的嵌套依赖，
 * 顶层 node_modules 不可达），而是从 SessionMessageEntry 结构推导 ——
 * 这样 import 面与 session-host.ts 一样只落在 pi-coding-agent 的公共出口上。 */
type PiMessage = SessionMessageEntry["message"];
type PiUserMessage = Extract<PiMessage, { role: "user" }>;
type PiAssistantMessage = Extract<PiMessage, { role: "assistant" }>;
type PiToolResultMessage = Extract<PiMessage, { role: "toolResult" }>;
type PiToolCall = Extract<PiAssistantMessage["content"][number], { type: "toolCall" }>;
type PiUsage = PiAssistantMessage["usage"];

/** ToolCard.detail 的截断阈值。大输出 pi 侧已处理过一轮，这里只兜底恢复视图的超长文本。 */
const DETAIL_LIMIT = 4000;
const TRUNCATED_MARK = "（已截断）";

/**
 * user 消息的展示载荷：text 只拼 text 块（口径与在线路径 session-host 的 textOf 一致），
 * image 块转成 images 附件（pi 的 ImageContent 与 shared 的 ImagePart 同构，直接映射）。
 * 图片不进文本占位 —— 占位混进 text 会让恢复与在线两路对同一条消息显示不同内容，
 * 图片本体由 UI 用 images 渲染缩略图。
 */
function userView(content: PiUserMessage["content"]): { text: string; images: ImagePart[] } {
	if (typeof content === "string") return { text: content, images: [] };
	let text = "";
	const images: ImagePart[] = [];
	for (const block of content) {
		if (block.type === "text") text += block.text;
		else images.push({ type: "image", data: block.data, mimeType: block.mimeType });
	}
	return { text, images };
}

/** 拼接 assistant content 的 text 块（块间无分隔，与 session-host 的 textOf 同口径）。 */
function textOf(content: PiAssistantMessage["content"]): string {
	let text = "";
	for (const block of content) if (block.type === "text") text += block.text;
	return text;
}

/** 拼接 thinking 块。 */
function thinkingOf(content: PiAssistantMessage["content"]): string {
	let thinking = "";
	for (const block of content) if (block.type === "thinking") thinking += block.thinking;
	return thinking;
}

/** pi Usage → shared TokenUsage，口径与 session-host.ts 的 assistant_done 一致（cost 取 total）。 */
function toTokenUsage(usage: PiUsage): TokenUsage {
	return {
		input: usage.input,
		output: usage.output,
		cacheRead: usage.cacheRead,
		cacheWrite: usage.cacheWrite,
		totalTokens: usage.totalTokens,
		cost: usage.cost.total,
	};
}

/** 工具卡的一行摘要：参数里的路径类字段最能说明「在对什么操作」，没有则退回工具名。 */
function summarizeCall(call: PiToolCall): string {
	const args: Record<string, unknown> = call.arguments;
	for (const key of ["path", "filePath"] as const) {
		const value = args[key];
		if (typeof value === "string" && value !== "") return value;
	}
	return call.name;
}

/**
 * toolResult 的正文（text 块拼接）。空串返回 undefined —— 与 session-host 的
 * detail 口径一致（空正文不上屏）。超长截断并标注，防止恢复视图把超长文本塞进 DOM。
 *
 * show_widget 豁免截断：它的 detail 就是 widget 本体（结果 JSON 内含
 * widget_code），截断即破坏 JSON，恢复出的卡片永远渲染失败 —— 而 spec 要求
 * 历史重放与实时产出同形态（内容全部来自落盘的工具记录）。live 路径
 * （session-host toolResultText）本就不截，pi 对扩展工具结果也不截
 * （截断是 bash/grep 内置工具各自的行为），两路口径在此对齐。
 */
function detailOf(result: PiToolResultMessage, toolName: string): string | undefined {
	let text = "";
	for (const block of result.content) if (block.type === "text") text += block.text;
	if (text === "") return undefined;
	if (toolName !== "show_widget" && text.length > DETAIL_LIMIT) {
		return text.slice(0, DETAIL_LIMIT) + TRUNCATED_MARK;
	}
	return text;
}

/**
 * 把 buildContextEntries() 的输出翻译成聊天视图条目。
 *
 * resolveToolLabel 把工具名与 outcome 翻成面向用户的标签（会话宿主的
 * restoredToolLabel：ok 给完成态词汇，非 ok 给未完成语义 —— 恢复视图里
 * 孤儿 toolCall 是 aborted，绝不能显示「已修改」这类完成态词汇），
 * 查不到时回落工具名原样 —— 本函数不内置映射表（标签的所有权在工具自己）。
 */
export function buildConversationEntries(
	entries: readonly SessionEntry[],
	resolveToolLabel?: (toolName: string, outcome: ToolOutcome) => string,
): ConversationEntry[] {
	/*
	 * toolResult 在 toolCall 之后的任意条目里（工具执行完才落盘），
	 * 配对按 toolCallId 全量先建索引，产出时直接查。
	 */
	const results = new Map<string, PiToolResultMessage>();
	for (const entry of entries) {
		if (entry.type !== "message") continue;
		if (entry.message.role === "toolResult") results.set(entry.message.toolCallId, entry.message);
	}

	const out: ConversationEntry[] = [];
	for (const entry of entries) {
		// 非 message 条目（含混入的 session 头）全是上下文机制，见文件头。跳过即防御。
		if (entry.type !== "message") continue;
		const message = entry.message;
		const at = Date.parse(entry.timestamp);

		if (message.role === "user") {
			const { text, images } = userView(message.content);
			const user: UserMessage = {
				id: entry.id,
				role: "user",
				text,
				// 没有图片时键必须缺席（thinking 键缺席同理）：空数组会让 UI 渲染一行空缩略图。
				...(images.length === 0 ? {} : { images }),
				at,
			};
			out.push(user);
			continue;
		}

		if (message.role === "assistant") {
			const thinking = thinkingOf(message.content);
			const assistant: AssistantMessage = {
				id: entry.id,
				role: "assistant",
				text: textOf(message.content),
				// 模型没输出思考时键必须缺席：空串会让 UI 渲染一个空思考折叠块。
				...(thinking === "" ? {} : { thinking }),
				// usage 在 pi 类型上必填，但 JSONL 是落盘数据（旧版本 / 中断写入可能缺），缺则不下发。
				...(message.usage === undefined ? {} : { usage: toTokenUsage(message.usage) }),
				at,
			};
			out.push(assistant);

			// 一条 assistant 先产出消息本体，再按 toolCall 出现顺序产出其工具卡。
			for (const block of message.content) {
				if (block.type !== "toolCall") continue;
				const result = results.get(block.id);
				// 孤儿 toolCall：模型吐了调用但结果没落盘（会话中断），不是 error ——
				// 执行从未发生，语义是 aborted。
				const outcome: ToolOutcome =
					result === undefined ? "aborted" : result.isError ? "error" : "ok";
				// todo_write：清单从落盘 args 重建（与 live 路径同一个解析函数，
				// core/todo-parse.ts），恢复出的清单卡与实时产出同形态；
				// 脏 args → 键缺席，卡片照常落成。
				const todos = block.name === "todo_write" ? parseTodoArgs(block.arguments) : undefined;
				const card: ToolCard = {
					id: block.id,
					role: "tool",
					toolName: block.name,
					label: resolveToolLabel?.(block.name, outcome) ?? block.name,
					summary: summarizeCall(block),
					outcome,
					detail: result === undefined ? undefined : detailOf(result, block.name),
					...(todos === undefined ? {} : { todos }),
					at,
				};
				out.push(card);
			}
			continue;
		}

		// 其余 message 角色（toolResult / bashExecution / custom / branchSummary /
		// compactionSummary）跳过：toolResult 已配对消费，其余不是本应用的展示内容。
	}

	/*
	 * 产物清单恢复：appendCustomEntry("artifacts_presented") 落盘的 custom 条目
	 * 不参与 message 遍历（上面 continue 掉了），单独扫一遍翻译成 artifacts_presented
	 * 事件，reducer 折叠后产物清单与交付时一致（多次交付按路径去重、后交付排末尾，
	 * 语义由 mergePresentedArtifacts 保证，不在此重复实现）。
	 */
	for (const entry of entries) {
		if (entry.type !== "custom") continue;
		if (entry.customType !== "artifacts_presented") continue;
		const data = entry.data as { files?: PresentedFile[]; focusFile?: string } | undefined;
		if (data?.files === undefined) continue;
		out.push({
			id: entry.id,
			role: "artifacts_presented",
			files: data.files,
			focusFile: data.focusFile,
			at: Date.parse(entry.timestamp),
		});
	}

	return out;
}

/**
 * resume / rename / delete 的路径守卫。
 *
 * 这三个通道的 path 来自 renderer（IPC 边界不可信）。没有这道守卫，
 * 一个 `../..` 穿越或任意绝对路径就越过了会话目录边界 —— rename/delete
 * 会改写任意文件，resume 会打开任意文件。
 *
 * 返回约定与 workspace.ts 的 validateWorkspacePath 保持一致：
 * undefined 表示合法，否则是给用户看的原因（调用方把它变成 IPC 错误消息）。
 *
 * 目录归属判定本地实现而不 import：extensions/permission-policy.ts 的
 * isPathInside 在 extensions 层（core 不许 import extensions，AGENTS.md §1），
 * workspace.ts 的 sameOrInside 是它的私实现。规则与二者对齐：
 * resolve 后比前缀，Windows 大小写不敏感。
 */
export function validateSessionFilePath(path: string, sessionsDir: string): string | undefined {
	if (!isAbsolute(path)) return "会话文件必须是绝对路径";
	const normalize = (p: string): string => {
		const resolved = resolve(p);
		return process.platform === "win32" ? resolved.toLowerCase() : resolved;
	};
	const dir = normalize(sessionsDir);
	const target = normalize(path);
	const prefix = dir.endsWith(sep) ? dir : dir + sep;
	if (!target.startsWith(prefix)) return "会话文件必须位于会话目录内";
	// 后缀大小写都放行：Windows 文件系统本身不敏感，pi 写出的总是小写。
	if (!target.toLowerCase().endsWith(".jsonl")) return "会话文件必须是 .jsonl 文件";
	return undefined;
}
