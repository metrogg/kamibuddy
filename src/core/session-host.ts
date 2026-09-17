/**
 * 会话宿主：持有 pi 的 AgentSession，把 pi 事件翻译成领域事件。
 *
 * 这是 ARCHITECTURE.md §4.7「pi SDK 边界」最主要的一道缝。
 * **pi 的 AgentSessionEvent / AssistantMessage / ToolCall 类型止步于本文件**，
 * 出口只有 shared/session-events.ts 的形状。pi 升级只塌这一个文件。
 *
 * 两处 pi 的实际约束，决定了本文件的写法：
 *
 * 1. **pi 的消息没有稳定 id** —— AssistantMessage / UserMessage 只有 timestamp。
 *    而 UI 的流式增量要靠 id 定位气泡，所以 id 由这里生成并在
 *    message_start → message_update → message_end 之间保持一致。
 *    工具卡片是例外：toolCallId 本身稳定，直接用。
 *
 * 2. **turn 级事件对 UI 无意义** —— 用户看到的是一条条消息和工具卡片，不是「轮」。
 *    turn_start / turn_end 仍不往上传，但不白吞：单次模型调用的边界进运行台账
 *    （llm_call 条目，spec: add-observability-ledger）。**边界取 turn_start →
 *    助手 message_end，不取 turn_end** —— pi 的 turn_end 在本轮工具跑完之后才发，
 *    用它会把工具耗时算进模型耗时（settleLlmCall 有完整根因）。
 */

import {
	type AgentSessionEvent,
	createAgentSession,
	DefaultResourceLoader,
	type InlineExtension,
	type PromptOptions,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type {
	SessionEvent,
	SessionState,
	ThinkingLevel,
	ToolCard,
	ToolOutcome,
} from "../shared/session-events.ts";
import { generatingLabel } from "../shared/session-events.ts";
import { childAgentsOf } from "../shared/child-agents.ts";
import type { ImagePart } from "../shared/image.ts";
import {
	composeHiddenContext,
	formatRunTime,
	prependHiddenContext,
	type HiddenSection,
} from "../shared/hidden-context.ts";
import { memoryReminder } from "./memory.ts";
import {
	changeFromEdit,
	changeFromWrite,
	writeStreamProgress,
	type FileChange,
} from "../shared/artifacts.ts";
import type { LoadedResources } from "./resources.ts";
import type { RunLedger } from "./run-ledger.ts";
// toTokenUsage / summarizeArgs 是 live 与恢复路径的共同出口，都住在
// session-rebuild.ts（本文件反向 import）：同一张卡的两条产出路径必须同源，
// 因而入参摘要字段表只有那一份（见 summarizeArgs 注释）。
import { summarizeArgs, toTokenUsage } from "./session-rebuild.ts";
import type { SystemSegmentStat } from "../shared/observability.ts";
import { parseTodoArgs } from "./todo-parse.ts";
import { parseSources } from "./source-parse.ts";
import { splitSkillBlocks } from "../shared/skill-block.ts";
import type { SkillDescriptor } from "./prompt-composer.ts";
import { getConfigDir, getResourcesDir, getSessionsDir } from "./config-paths.ts";
import type { ModelCatalog } from "./model-catalog.ts";
import { parseModelKey, toModelKey } from "./model-catalog.ts";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 默认工具集：**不含 bash / powershell**。
 *
 * 理由不是保守，是 pi 在 Windows 上找不到 bash 会直接抛异常（utils/shell.ts:100），
 * 而目标用户（行政 / 产品 / 销售）机器上不会装 Git for Windows。
 * 文档流水线的 Python venv 是进程内受控调用，不经 agent 的自由 shell 工具，
 * 见 ARCHITECTURE.md §4.4 —— 因此这里仍不把 bash/powershell 放进默认工具集。
 *
 * D4-5 起由 resources/modes/<id>.md 的 frontmatter 驱动，届时本常量退化为兜底。
 */
const DEFAULT_TOOLS = ["read", "write", "edit", "find", "grep", "ls"] as const;

/**
 * 流式 delta 的合批窗口（毫秒），约一帧。
 *
 * 一个 token 一次 IPC 会让 renderer 每 token 重跑一遍渲染，长会话线性放大。
 * 取 16ms：既能把事件数从「每 token」压到「每帧最多一次」，又不超过一帧，
 * 首 token 的可见延迟感知不到（spec: optimize-stream-rendering）。
 */
const DELTA_FLUSH_MS = 16;

/**
 * 工具卡片的状态标签（对齐 WorkBuddy 的 tool.* 词汇表，见 lib-chat-ui 的
 * tool.readFile/listFile/executeCommand 等条目）：每个工具一组「执行中 → 已完成」，
 * write/edit 另按新建/覆盖走 generatingLabel / writeDoneLabel。
 *
 * 放在适配层而不是 UI 里：ToolCard 的契约是「label 由上游给定，UI 不做映射」
 * （shared/session-events.ts）。pi 的内置工具没有中文名，这里补上。
 */
const TOOL_RUNNING_LABELS: Readonly<Record<string, string>> = {
	read: "读取中",
	read_document: "阅读文档",
	read_me: "读取中",
	ls: "列出中",
	grep: "搜索中",
	find: "查找中",
	bash: "执行中",
	powershell: "执行中",
	web_search: "搜索中",
	web_fetch: "抓取中",
	conversation_search: "检索中",
	present_files: "交付中",
	// show_widget 的执行是毫秒级纯校验，生命周期几乎全在参数生成期 ——
	// 与 write 同词汇（WorkBuddy tool.writeFile 的「生成中」）。
	show_widget: "生成中",
	// 等待用户作答期间卡片停在这个标题上（问卷弹层本身承载等待态）。
	questionnaire: "向用户提问",
	// 子代理委派：运行中的阶段性进展（哪个 agent 在干什么）走 tool_progress 增量。
	task: "子任务",
	// 清单卡标题全程稳定为「任务列表」（与工具注册的 label 一致，完成态同词
	// 见 TOOL_DONE_LABELS）：卡片本体就是清单渲染，进度由 todos 内容表达，
	// 标题不随 执行中/已完成 跳变。
	todo_write: "任务列表",
	// 与工具注册的 label 同词（WorkBuddy 的动作词：「正在加载技能 xxx」）。
	use_skill: "加载技能",
	// 与工具注册的 label 同词（动作词；执行态是本地读 docx → 落 HTML + 图片）。
	docx_extract: "提取文档版式",
};

const TOOL_DONE_LABELS: Readonly<Record<string, string>> = {
	read: "已读取",
	read_document: "已阅读",
	read_me: "已读取",
	ls: "已列出",
	grep: "已搜索",
	find: "已查找",
	bash: "已执行",
	powershell: "已执行",
	web_search: "已搜索",
	web_fetch: "已抓取",
	conversation_search: "已检索",
	present_files: "已交付",
	show_widget: "已生成",
	questionnaire: "已回答",
	task: "已完成",
	todo_write: "任务列表",
	use_skill: "已加载",
	docx_extract: "已提取",
};

/**
 * 参数生成期即上屏卡片（tool_stream_started）的工具白名单。
 * write/edit：参数里就是文件内容，生成几十秒、执行毫秒级，等执行态上屏
 * 等于整段生成不可见；web_search/web_fetch：网络请求长耗时，生成期即上屏
 * 消除执行前的空白窗；show_widget：widget_code 在参数里逐步累积，
 * 生成期上屏才能边生成边渲染（loading 轮播 → 半成品渐进渲染）。
 * todo_write：清单全在参数里、执行瞬时（无副作用），生命周期几乎全在
 * 参数生成期 —— 与 show_widget 同理，生成期上屏消除空白窗。
 * read/ls/grep/find/read_me 不在列：本地快操作几乎瞬时完成，
 * 参数又小（一个路径/一个词/一个模块名），生成期上屏反而闪一下，卡片等执行态再上
 * （WorkBuddy 同：listFile/readFile 的卡片只有 列出中/读取中 执行态标签）。
 * use_skill 同档（同一口径）：读一份本地 SKILL.md，入参只有一个短技能名，
 * 参数生成期上屏只会闪一下接执行态 —— 不进本表。
 * docx_extract 同档：本地快操作（读一份 docx + 落 HTML/图片），
 * 入参只有两个路径，参数生成期上屏同样只会闪一下。
 */
const STREAM_CARD_TOOLS: readonly string[] = [
	"write",
	"edit",
	"web_search",
	"web_fetch",
	"show_widget",
	"todo_write",
];

/** 执行中标签。write/edit 不走这里（它们的执行期沿用生成期标签）。 */
function runningLabel(toolName: string): string {
	return TOOL_RUNNING_LABELS[toolName] ?? toolName;
}

/** write/edit 完成标签（WorkBuddy：已生成/已修改、生成失败/修改失败）。 */
function writeDoneLabel(changeType: "created" | "modified", outcome: ToolOutcome): string {
	if (outcome === "ok") return changeType === "created" ? "已生成" : "已修改";
	return changeType === "created" ? "生成失败" : "修改失败";
}

/** 其余工具完成标签。 */
function doneLabel(toolName: string, outcome: ToolOutcome): string {
	if (outcome !== "ok") return "失败";
	return TOOL_DONE_LABELS[toolName] ?? toolName;
}

/**
 * 历史视图重建（session-rebuild.ts）的工具卡 label 解析器。
 *
 * 重建出的卡片不再是流式态，label 必须与 live 卡片同词汇 —— 同一张卡
 * 「活的时候叫 已搜索、刷新后叫 联网搜索」这种漂移比用词不准更难看。
 * 词汇的单一来源就是本文件的 label 函数，这里只做分派，不另起映射表。
 *
 * write/edit 的完成标签依赖新建/覆盖（writeDoneLabel 要 changeType），
 * 而执行前的文件存在性不落盘，重建时已无法知道 —— 取各自的典型语义：
 * write 的主场景是生成新文档，edit 语义上就是改已有文件。
 *
 * outcome 必须参与分派（2026-09-09 事故的根因）：两个区外 edit 在参数流式
 * 生成阶段被中断、执行从未发生，恢复视图却显示「已修改」，用户以为文件已被改。
 * 非 ok 的卡（绝大多数是孤儿 toolCall —— aborted）一律不许出现完成态词汇。
 * write/edit 不用 writeDoneLabel 的非 ok 形态（生成失败/修改失败）：「失败」
 * 仍暗示执行发生过，而 aborted 的语义是「从没跑过」，「未完成」才是实话。
 */
export function restoredToolLabel(toolName: string, outcome: ToolOutcome): string {
	if (outcome !== "ok") {
		if (toolName === "write") return "生成（未完成）";
		if (toolName === "edit") return "修改（未完成）";
		// show_widget 与 write 同生命周期（执行毫秒级，中断几乎总发生在参数
		// 生成期）：孤儿调用同样是「没生成完」，不是「生成失败」。
		if (toolName === "show_widget") return "生成（未完成）";
		// 其余工具复用 doneLabel 的非 ok 形态：词汇单一来源在 live 路径的
		// label 函数，这里只做分派，不另起映射表（见函数头注释）。
		return doneLabel(toolName, outcome);
	}
	if (toolName === "write") return writeDoneLabel("created", "ok");
	if (toolName === "edit") return writeDoneLabel("modified", "ok");
	return doneLabel(toolName, "ok");
}

/** pi 的消息内容可能是字符串或分块数组，统一取纯文本。 */
function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((part): part is { type: "text"; text: string } => {
			if (typeof part !== "object" || part === null) return false;
			const p = part as { type?: unknown; text?: unknown };
			return p.type === "text" && typeof p.text === "string";
		})
		.map((part) => part.text)
		.join("");
}

/**
 * pi 的图片块类型（agent-session.d.ts 的 PromptOptions.images 元素）。
 * 根包未直接导出 ImageContent（它来自 pi-ai/compat），经 PromptOptions 提取，
 * 避免本仓库直接依赖 pi 的嵌套子包。
 */
type PiImage = NonNullable<PromptOptions["images"]>[number];

/**
 * shared 的 ImagePart → pi 的图片块。两者结构相同但类型来源不同：
 * 依赖方向规则不许 pi 类型流进 shared（shared/image.ts 平行定义了一份），
 * 反向（shared 类型进 core）合法；pi 的参数是可变数组而 shared 契约是
 * readonly，拷贝一层完成转换。空/缺省归一成 undefined —— 无图请求不构造
 * options，与既有无图调用路径的行为完全一致。
 */
function toPiImages(images: readonly ImagePart[] | undefined): PiImage[] | undefined {
	if (images === undefined || images.length === 0) return undefined;
	return images.map((image) => ({
		type: "image" as const,
		data: image.data,
		mimeType: image.mimeType,
	}));
}

/**
 * pi 用户消息的 content → UI 的 { text, images }。
 *
 * 与 textOf 的分工：textOf 只取文本（assistant / 工具结果没有图片语义），
 * 用户消息是唯一携带图片附件的路径，两条路径不合并 —— textOf 若也带图，
 * assistant / tool 的翻译处就得各忽略一份它不该有的数据。
 */
function userContentOf(
	content: unknown,
): { readonly text: string; readonly images: readonly ImagePart[] | undefined } {
	if (typeof content === "string") return { text: content, images: undefined };
	if (!Array.isArray(content)) return { text: "", images: undefined };
	let text = "";
	const images: ImagePart[] = [];
	for (const part of content) {
		if (typeof part !== "object" || part === null) continue;
		const p = part as { type?: unknown; text?: unknown; data?: unknown; mimeType?: unknown };
		if (p.type === "text" && typeof p.text === "string") {
			text += p.text;
		} else if (
			p.type === "image" &&
			typeof p.data === "string" &&
			typeof p.mimeType === "string"
		) {
			images.push({ type: "image", data: p.data, mimeType: p.mimeType });
		}
	}
	return { text, images: images.length === 0 ? undefined : images };
}

/** 工具结果的正文。大输出已由 pi 侧处理，这里不再截断。 */
function toolResultText(result: unknown): string {
	if (typeof result !== "object" || result === null) return "";
	const content = (result as { content?: unknown }).content;
	return textOf(content);
}

/**
 * 工具结果的结构化 details（扩展工具挂在结果上的自定义元数据，pi AgentToolResult
 * 的 details 字段；内置工具/异常结果没有则为 undefined）。
 * web_search 的引用来源从这里取 —— 文本 content 与 details.results 同源，
 * 卡片正文照旧走 toolResultText，两者互不替代。
 */
function toolResultDetails(result: unknown): unknown {
	if (typeof result !== "object" || result === null) return undefined;
	return (result as { details?: unknown }).details;
}

export interface SessionHostOptions {
	readonly catalog: ModelCatalog;
	/** 选中的模型标识（`provider/model`）。undefined 表示让 pi 自己挑第一个可用的。 */
	readonly modelKey: string | undefined;
	/**
	 * 会话工作目录。**必有值**：本类只在会话宿主建立时创建，而宿主建立前
	 * daemon 已把「待分配」的临时任务分配到它自己的目录（生效根下的时间戳目录，
	 * 见 spec: align-per-task-dirs），所以这里拿到的永远是真实目录 ——
	 * 不再有「无目录」的会话形态，工具集、权限门、预览服务与正式工作空间同待遇。
	 */
	readonly cwd: string;
	readonly sceneId: string;
	readonly interactionId: string;
	/**
	 * 绑定的专家 id。与 interactionId **正交**（spec:
	 * rework-expert-orthogonal-and-skills）：只随 state 透传，任何交互模式下
	 * 都可有值、也可缺省。人格正文的解析与注入在 daemon 的 compose 链路
	 *（prompt-composer），宿主不读专家库。
	 */
	readonly expertId?: string;
	/**
	 * 是否临时任务会话（cwd 落在任务区：自动分配目录 / 历史共享临时目录 / 旧 playground
	 * 占位；生效根本身归空间区，2026-09-15）。
	 * 判定规则的唯一来源在 daemon（isTempCwd）——配置目录与旧占位目录的归类都是 daemon
	 * 的知识，本文件只负责透传，不在此处回推，免得两处规则漂移。
	 */
	readonly isTempTask: boolean;
	/** 领域事件出口。 */
	readonly emit: (event: SessionEvent) => void;
	/**
	 * 两轴资源（场景骨架 + 交互模式，含工具白名单）。
	 *
	 * 由调用方加载后传入：daemon 在启动时也要同一份来下发 UI 描述符与做
	 * requireReady 校验，两处各读一遍同一批不可变文件虽然结果一致，
	 * 但显式传递保证「daemon 校验用的」与「宿主切工具集用的」是同一份对象。
	 */
	readonly resources: LoadedResources;
	/**
	 * 要装载的 pi 扩展（权限门、提示词切换等）。
	 *
	 * 由调用方组装而非本文件自建：`core/` 不许 import `extensions/`
	 * （依赖方向是 extensions → core，见 AGENTS.md §1）。
	 * 权限门需要向宿主发起审批询问，提示词切换需要两轴与技能——都是 daemon 的职责。
	 */
	readonly extensions?: readonly InlineExtension[];
	/**
	 * 会话持久化管理器。缺省 `SessionManager.create(cwd, getSessionsDir())`（全新会话）；
	 * 恢复历史会话时传 `SessionManager.open(path, getSessionsDir())` 的结果。
	 * open 是同步的（dist 类型：static open(...) : SessionManager），
	 * 所以注入点是个值而不是 Promise。
	 */
	readonly sessionManager?: SessionManager;
	/**
	 * 初始工具集覆盖（子代理会话专用）。省略时按交互模式 frontmatter 的白名单。
	 *
	 * 子代理的工具面来自 agent 定义（resources/agents/<name>.md 的 tools），
	 * 与交互模式无关——白名单语义不变：未列出的工具被禁用，含扩展注册的工具。
	 * 子代理会话没有切换器，创建时一次注入即终身不变（同 cwd 的绑定语义）。
	 */
	readonly toolsOverride?: readonly string[];
	/**
	 * 初始推理强度（daemon 注入全局默认用）。**仅非 undefined 时**才传给
	 * createAgentSession：pi 的优先级是 options.thinkingLevel 高于会话文件里的
	 * thinking_level_change 条目（sdk.ts:226-238 —— 只有未传该选项时 pi 才从
	 * 既有会话还原），所以 resume 路径绝不传它，否则逐会话还原值会被全局默认覆盖。
	 */
	readonly thinkingLevel?: ThinkingLevel;
	/**
	 * 运行台账工厂（spec: add-observability-ledger）。按 sessionId 建台账 ——
	 * 台账文件名按真值 sessionId 落，所以由调用方给工厂而不是实例（真值要
	 * createAgentSession 返回后才有，构造器里即可拿到）。缺省 = 不记台账
	 * （子代理 / 定时任务 run 会话 v1 不接）。
	 */
	readonly createLedger?: (sessionId: string) => RunLedger;
	/**
	 * 最近一次组装的系统提示词分段 provenance（request_snapshot 的 system 部分）。
	 * daemon 在 prompt-switch 的 compose 里现记现取；返回 undefined = 无组装
	 * 来源（子代理提示词不走 compose），快照的 systemSegments 键缺席。
	 */
	readonly getSystemPromptSegments?: () => readonly SystemSegmentStat[] | undefined;
	/**
	 * 当前绑定专家的显示名（hidden context 的 expert 行用）。undefined = 未绑定
	 * 或解析不出（注入层回落到 expertId）。daemon 现载专家库后查表 —— 专家库
	 * 是 daemon 的知识（每次现载不缓存），宿主不重复持有。
	 */
	readonly getExpertLabel?: () => string | undefined;
	/**
	 * 当前绑定专家的追加工具白名单（spec: add-team-foundations）。
	 * 生效工具集 = mode.tools ∪ extraTools（专家只能增不能删）。undefined/空 =
	 * 不追加。与 getExpertLabel 同款注入口径：专家库是 daemon 的知识，宿主不持有；
	 * 每次调用现查（专家库用户可覆盖，编辑后新解析即生效）。
	 */
	readonly getExpertExtraTools?: () => readonly string[] | undefined;
}

export class SessionHost {
	/** 自增 id 计数器。比 UUID 好在可预测、日志可读、测试可断言。 */
	private idSeq = 0;
	/** 当前正在流式输出的助手消息 id。message_start 时生成，message_end 时清空。 */
	private currentAssistantId: string | undefined;
	/**
	 * 流式正文/思考 delta 的时间窗缓冲（spec: optimize-stream-rendering）。
	 *
	 * 原先每个 delta 直接 emit，一个 token 就走完整条 daemon → main → renderer 链路
	 * 并让 renderer 重跑渲染。这里把**连续同类型**的 delta 累积到约一帧再发一条。
	 *
	 * 缓冲成立的前提是「同一助手消息内、同类型连续」，所以类型切换、message_end、
	 * turn_end 与 agent_end（含 abort 收尾）都必须先 flush（见 flushDeltas 的调用点），
	 * 否则最后一批会丢或与终态校正串序。messageId 一并记下：flush 时
	 * currentAssistantId 可能已被清（agent_end 路径），不能现读。
	 */
	private pendingDeltas:
		| {
			readonly kind: "text" | "thinking";
			readonly messageId: string;
			text: string;
			readonly timer: ReturnType<typeof setTimeout>;
		}
		| undefined;
	/** 当前 run 的 id，供 run_error / run_finished 关联。 */
	private currentRunId: string | undefined;
	/**
	 * 本 run 最近一次失败的助手消息（stopReason "error"）的 errorMessage 记账。
	 * pi 自动重试期间失败的 message_end 先到、终态后到 —— run_error 不能随消息发，
	 * 必须等 agent_end（willRetry=false）确认重试耗尽/未开重试。成功的助手消息清账。
	 */
	private pendingRunError: string | undefined;
	/** 已发出的工具卡片，tool_execution_end 时要在原卡上补 outcome 与 detail。 */
	private readonly toolCards = new Map<string, ToolCard>();
	/**
	 * write/edit 执行前暂存的现场：真实 diff 所需的旧内容与变更统计。
	 * 执行成功才落到卡片上（失败不算产物）。changeType 在启动时查文件存在性得出，
	 * 即使 args 形状异常导致 change 算不出，完成标签也能区分 已生成/已修改。
	 */
	private readonly pendingChanges = new Map<
		string,
		{ change: FileChange | undefined; changeType: "created" | "modified" }
	>();
	/**
	 * 会话的技术 cwd（= options.cwd）。解析模型给的相对路径、读 write/edit 的旧内容都用它。
	 */
	private sessionCwd = "";
	/**
	 * 生成阶段的工具调用追踪（key = assistant 消息的 contentIndex）。
	 *
	 * rawArgs 自己按 delta 累积，而不是读 content block 上的暂存字段：
	 * 那个字段是各 provider 的私有草稿，名字都不统一（anthropic 叫 partialJson、
	 * openai-completions 叫 partialArgs），而 toolcall_delta.delta 是公开契约。
	 *
	 * 卡片（tool_stream_started）不在 toolcall_start 时立刻发，要等首个 delta
	 * 里读到稳定的 id 与 name —— openai 协议下 start 时 id 可能是空串、
	 * 后续才补上（openai-completions.ts 的 block.id 回填逻辑）。
	 */
	private readonly streamToolCalls = new Map<
		number,
		{
			emittedId?: string;
			rawArgs: string;
			/** path 完整时查出的文件存在性（新建/覆盖），查一次缓存住。 */
			changeType?: "created" | "modified";
		}
	>();

	/* ── 运行台账记账（spec: add-observability-ledger）──────────────────
	 * 台账与 UI 事件是两套独立账本：UI 的 currentRunId 跨 willRetry 保持
	 * （流式态不闪），台账的 run 按真实 agent 尝试闭合（agent_end 无论
	 * willRetry 都闭合 —— 一次失败的尝试就是一个 endedReason=error 的 run，
	 * 否则重试链会留一堆永不闭合的孤儿 run）。
	 */

	/** 运行台账。缺省（未注入 createLedger）= 不记 —— 所有写入点都要判空。 */
	private readonly ledger: RunLedger | undefined;
	/** 当前未闭合的台账 run id（agent_start / 空闲压缩开，agent_end / 压缩终态合）。 */
	private ledgerRunId: string | undefined;
	/**
	 * 最近闭合的台账 run id。retry 条目的归属靠它：pi 的事件序是
	 * agent_end(willRetry) → auto_retry_start（此刻当前 run 已闭合），
	 * start 条目归到刚失败的尝试上；end(success) 在新 run 内到达，归新 run。
	 */
	private lastClosedRunId: string | undefined;
	/** 台账 run 内的 turn 计数（llm_call 条目的 turnIndex）。 */
	private ledgerTurnIndex = 0;
	/** 当前 turn 的开始时刻（turn_start 记账，助手 message_end 结算 llm_call）。 */
	private turnStartedAt: number | undefined;
	/** 当前 turn 首个输出 delta 的到达时刻（TTFT 基准，见 markFirstOutput）。 */
	private turnFirstDeltaAt: number | undefined;
	/** 执行中的工具调用（toolCallId → 开始现场），tool_execution_end 结算 tool_call 条目。 */
	private readonly openLedgerTools = new Map<
		string,
		{ toolName: string; summary: string; startedAt: number }
	>();
	/** 最近一次 auto_retry_start 的退避参数（auto_retry_end 不携带，转发 run_retry 时补齐）。 */
	private pendingRetry: { maxAttempts: number; delayMs: number } | undefined;
	/**
	 * 本 run 的 hidden context（F5，对齐 WorkBuddy 的 composeUserPrompt）。
	 *
	 * **按 run 冻结**（prompt() 时算一次，agent_end 清）：transformContext 每次
	 * 模型调用都触发，注入内容若含每秒都变的时钟，每一跳都会从最后一条 user
	 * 消息处打断提示词缓存 —— 长任务的缓存命中全废。时间取 run 开始时刻。
	 *
	 * steer / followUp 不刷新本字段：排队消息落进的是**当前 run**，run 的
	 * 冻结内容理应保持不变。
	 */
	private pendingHidden: string | undefined;
	/**
	 * 最近一次注入的块全文（与 pendingHidden 同时写，但 agent_end **不清**）。
	 *
	 * pendingHidden 是 run 期的账（run 终即清，防压缩调用误注入）；
	 * 这个是「最近一次注入了什么」的展示语义 —— 任务诊断面板的
	 * 「hidden context 注入块」靠它：run 结束后用户仍该能看到刚才
	 * 注入的内容。下一次 freeze 覆盖。
	 */
	private lastHiddenContext: string | undefined;

	private constructor(
		private readonly session: Awaited<
			ReturnType<typeof createAgentSession>
		>["session"],
		private readonly options: SessionHostOptions,
		private sceneId: string,
		private interactionId: string,
		private expertId: string | undefined,
		private readonly skills: readonly SkillDescriptor[],
	) {
		this.ledger = options.createLedger?.(session.sessionId);
		// 注入层先装、快照层后装：快照包住注入后的结果，request_snapshot 记到的
		// 就是模型真正看到的上下文（含 hidden context），不是注入前的残影。
		this.installHiddenContext();
		if (this.ledger !== undefined) this.installRequestSnapshot();
	}

	static async create(options: SessionHostOptions): Promise<SessionHost> {
		const model =
			options.modelKey === undefined
				? undefined
				: options.catalog.resolveModel(options.modelKey);

		// 选了模型但解析不出来，说明配置变过（服务商被删、models.json 改过）。
		// 明确报错而不是静默回落 —— 静默回落会让用户以为在用自己选的模型。
		if (options.modelKey !== undefined && model === undefined) {
			throw new Error(
				`选中的模型「${options.modelKey}」已不可用，请到设置里重新选择`,
			);
		}

		// 让 pi 的 extensions / skills / settings 都从我们自己的目录读，
		// 不碰用户可能已有的 ~/.pi/agent（见 config-paths.ts）。
		const agentDir = getConfigDir();

		/*
		 * 临时任务就是普通 cwd 会话：调用方（daemon）直接给出真实目录
	 * （正式空间，或该任务首次执行时分配到的独立目录），本文件不做任何 cwd 推导。
		 * playground 时代的「configDir/playground 技术占位」已退役 —— 占位目录
		 * 存在的前提是「不注册文件工具就当安全」，权限门全量落地后这个前提消失，
		 * 会话需要一个真实产物落点（临时目录）而不是假目录。
		 */
		const cwd = options.cwd;
		mkdirSync(cwd, { recursive: true });

		/*
		 * SettingsManager 自己建、并同时交给 loader 与 createAgentSession。
		 *
		 * 照 pi 自己的做法（sdk.ts:182-188）：它把同一个实例传给两处。
		 * 若只给 createAgentSession、loader 自己再建一个，就会有两份设置状态，
		 * 症状是「改了设置一处生效一处不生效」，极难排查。
		 */
		const settingsManager = SettingsManager.create(cwd, agentDir);

		// 扩展要经 ResourceLoader 注入，且必须 reload 后才生效（同 sdk.ts:185-188）。
		// additionalSkillPaths：随应用内置的技能（resources/skills/）；
		// 用户的技能（agentDir/skills/）pi 会自动发现。
		const resourceLoader = new DefaultResourceLoader({
			cwd,
			agentDir,
			settingsManager,
			additionalSkillPaths: [join(getResourcesDir(), "skills")],
			extensionFactories: [...(options.extensions ?? [])],
		});
		await resourceLoader.reload();

		/*
		 * 初始工具集必须与 setInteraction 同源：取当前交互模式的 frontmatter。
		 * 曾经只传 DEFAULT_TOOLS、切换只发生在 setInteraction —— 新建任务后的
		 * 首次对话（没人点过切换器）工具集就没有 web_search，模型自称「没有联网
		 * 能力」。工具面是一等公民，创建的那一刻就该是模式的工具面。
		 * 专家 extraTools 在创建时同样生效（创建即绑定专家的会话不该等一次
		 * setExpert 才拿到追加工具）——与下方 effectiveToolNames 同一套合并语义。
		 */
		const initialMode = options.resources.modes.find((m) => m.id === options.interactionId);
		const initialBase =
			initialMode === undefined ? [...DEFAULT_TOOLS] : [...initialMode.tools];
		const initialExtra = options.getExpertExtraTools?.() ?? [];
		const { session } = await createAgentSession({
			cwd,
			agentDir,
			// 复用 ModelCatalog 已建好的 runtime，避免重复读 auth.json / models.json。
			modelRuntime: options.catalog.modelRuntime,
			...(model === undefined ? {} : { model }),
			// 恢复历史会话时由 daemon 注入 open 出来的 manager（含全部落盘条目）；
			// 缺省开全新会话文件。
			sessionManager: options.sessionManager ?? SessionManager.create(cwd, getSessionsDir()),
			settingsManager,
			resourceLoader,
			// 仅新会话注入全局默认档；resume 不传（pi 从会话文件还原，见 options 注释）。
			...(options.thinkingLevel === undefined
				? {}
				: { thinkingLevel: options.thinkingLevel }),
			tools:
				options.toolsOverride !== undefined
					? [...options.toolsOverride]
					: initialExtra.length === 0
						? initialBase
						: [...initialBase, ...initialExtra.filter((tool) => !initialBase.includes(tool))],
		});

		// 技能清单由 pi 的 loader 发现（agentDir 下的 skills 目录等）。
		// 提示词切换扩展整体替换 systemPrompt 后 pi 不再自动附加技能段，
		// 所以这里取出来、经 daemon 的 compose 拼进提示词（prompt-composer.ts）。
		// filePath 必须保留：模型按需加载全文靠它（渐进式披露）。
		const skills: SkillDescriptor[] = resourceLoader
			.getSkills()
			.skills.map((s) => ({
				name: String(s.name ?? ""),
				description: String(s.description ?? ""),
				filePath: String(s.filePath ?? ""),
			}));

		const host = new SessionHost(
			session,
			options,
			options.sceneId,
			options.interactionId,
			options.expertId,
			skills,
		);
		host.sessionCwd = cwd;
		session.subscribe((event) => host.translate(event));
		return host;
	}

	/* ── 对外操作 ────────────────────────────────────────────────── */

	async prompt(
		text: string,
		whileStreaming?: "steer" | "followUp",
		images?: readonly ImagePart[],
	): Promise<void> {
		// pi 的两个入口形态不同（agent-session.d.ts）：prompt 走 PromptOptions.images，
		// steer/followUp 的第二参直接是图片数组。这里统一先归一。
		const piImages = toPiImages(images);
		if (this.session.isStreaming) {
			// 流式期间直接 prompt 会被 pi 拒绝，必须显式选择排队方式。
			// **缺省是 followUp（排队）而不是 steer**：用户在跑长任务时补一句，
			// 绝大多数是「等它跑完再接着做」，不是「现在就打断它」（2026-09-16 用户定）。
			// 想立刻插进当前这轮必须显式带 "steer"（输入区的「立即插入」按钮）。
			if (whileStreaming === "steer") await this.session.steer(text, piImages);
			else await this.session.followUp(text, piImages);
			return;
		}
		if (whileStreaming !== undefined) {
			// daemon 旁路进来的排队意图撞上「run 恰好收尾」的竞态：消息不能丢，
			// 也不能裸调 prompt（pi 对流式会话无 streamingBehavior 会响亮拒绝）。
			// AgentSession.prompt 自带 streamingBehavior 选项，把排队意图原样交给 pi
			// —— run 真已结束就是普通发送，万一边缘并发也按同一语义排队。
			this.freezeHiddenContext();
			await this.session.prompt(text, {
				...(piImages === undefined ? {} : { images: piImages }),
				streamingBehavior: whileStreaming,
			});
			return;
		}
		this.freezeHiddenContext();
		await this.session.prompt(text, piImages === undefined ? undefined : { images: piImages });
	}

	/**
	 * 冻结本 run 的 hidden context（prompt 的两个非流式入口共用这一个写点）。
	 * steer / followUp（流式分支）不经过这里：排队消息落进的是当前 run，
	 * run 的冻结内容不变（见 pendingHidden 注释）。
	 */
	private freezeHiddenContext(): void {
		try {
			this.pendingHidden = this.composeRunHiddenContext();
			this.lastHiddenContext = this.pendingHidden;
		} catch (error) {
			// 组装失败 = 本 run 无注入（原始 prompt 直送）。与 installHiddenContext
			// 的 must-not-throw 同纪律：hidden context 是增强不是门槛。
			this.pendingHidden = undefined;
			this.ledger?.reportFailure(
				`hidden context 组装失败：${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * 最近一次注入的 hidden context 全文（任务诊断面板的展示口）。
	 * 还没有过 prompt（或组装一直失败）为 undefined。
	 */
	peekHiddenContext(): string | undefined {
		return this.lastHiddenContext;
	}

	/**
	 * 重排等待队列：删除 / 编辑排队消息的底层动作。
	 *
	 * pi 只有整队清空（AgentSession.clearQueue），没有按条删除 —— 这里用
	 * 「清空 + 按序重入队」合成按条语义：重入队的就是删除/编辑后剩下的条目。
	 * 两个代价，都有界：
	 *   - **图片丢失**：clearQueue 只回文字（pi 的 _steeringMessages 是 string[]），
	 *     带图排队一旦被删除/编辑过一次，重入队的就是纯文本；
	 *   - **清空 → 重入队之间有个无队列窗口**：若 run 恰在此间收尾，重入队的消息
	 *     会挂在队列上等下一次 run 才被消费（agent 循环只在 run 内清队列）——
	 *     chips 仍显示、不丢，只是晚一轮生效。
	 */
	async rewriteQueue(steering: readonly string[], followUp: readonly string[]): Promise<void> {
		this.session.clearQueue();
		for (const text of steering) await this.session.steer(text);
		for (const text of followUp) await this.session.followUp(text);
	}

	async abort(): Promise<void> {
		await this.session.abort();
		// 压缩是独立的模型调用，abort() 管不到它；停止键在压缩期间也必须有效。
		// 无压缩进行时这是 no-op。
		this.session.abortCompaction();
		// 中断路径也必须 flush（spec: optimize-stream-rendering「不丢半句」）。
		// pi 的 abort 收尾会照常走 message_end → turn_end → agent_end（见 agent_end 注释），
		// 那三处已覆盖；这里再主动 flush 一次，保证「已收到但未 flush 的 delta」
		// 在停止动作返回时就送达，不等 16ms 窗口，也不依赖 pi 的收尾时序。
		this.flushDeltas();
	}

	/**
	 * 手动压缩上下文（pi TUI 的 /compact 等价物）。
	 *
	 * pi 的 compact() 会先中断当前 agent 操作且**不续跑**（agent-session.d.ts:510），
	 * 所以调用方（daemon）在流式期间直接拒绝，而不是依赖 pi 的中断语义。
	 * 压缩本身要调模型写摘要，耗时与一轮对话相当 —— 期间的流式态与停止键
	 * 由 translate 的 compaction_start/end 分支维持（复用 run 记账）。
	 *
	 * @param customInstructions 用户对摘要的侧重要求（/compact 的参数文本）。
	 */
	async compact(customInstructions?: string): Promise<void> {
		await this.session.compact(customInstructions);
		this.emitState();
	}

	/**
	 * 把当前会话导出为单文件 HTML，返回导出文件的绝对路径。
	 *
	 * 空会话（还没有任何消息）时 pi 会抛 message 含 "Nothing to export" 的错误，
	 * 这里改抛中文文案 —— 这是面向用户的提示，daemon 会原样透传给 UI。
	 * 判断依赖 pi 的错误文案：pi 升级若改了文案，会落回原始英文错误，
	 * 不会误判其他错误 —— 可接受的耦合。其余错误原样重抛。
	 */
	async exportHtml(outputPath: string): Promise<string> {
		try {
			return await this.session.exportToHtml(outputPath);
		} catch (error) {
			if (error instanceof Error && error.message.includes("Nothing to export")) {
				throw new Error("该会话还没有内容可导出");
			}
			throw error;
		}
	}

	/**
	 * 释放底层会话。切换工作空间时旧会话整个作废——
	 * cwd 在建会话时一次性注入工具集，不存在「换目录继续聊」。
	 */
	dispose(): void {
		// 缓冲中的 delta 随会话一起作废：清定时器，免得销毁后仍 emit（定时器泄漏，
		// 且会向已关闭的通道写事件）。**不 flush** —— 会话已终止，补发最后一批
		// 只会把残句推到已废弃的会话上。
		if (this.pendingDeltas !== undefined) {
			clearTimeout(this.pendingDeltas.timer);
			this.pendingDeltas = undefined;
		}
		this.session.dispose();
	}

	/**
	 * 重命名当前会话（写入 pi 的 session_info 条目）。
	 *
	 * 必须走本实例持有的活 SessionManager：pi 的 SessionManager 各自缓存
	 * entries，同一文件出现两个活写者会互相覆盖。非当前会话的重命名
	 * 由 daemon 临时 open 一个实例完成（用完即弃，不注册到任何地方）。
	 */
	renameSession(name: string): void {
		this.session.sessionManager.appendSessionInfo(name);
	}

	/** 产物清单持久化（appendCustomEntry），恢复历史会话时重建产物卡。 */
	persistArtifacts(files: readonly unknown[], focusFile: string | undefined): void {
		this.session.sessionManager.appendCustomEntry("artifacts_presented", { files, focusFile });
	}

	/**
	 * 定时任务 run 的溯源标记（automation_run custom 条目，taskId 定位任务的运行会话）。
	 * 会话列表/导出链路经会话文件天然可追（spec：add-automation-scheduler）。
	 */
	markAutomationRun(taskId: string): void {
		this.session.sessionManager.appendCustomEntry("automation_run", { taskId });
	}

	/**
	 * 子代理 run 的溯源标记（subagent_run custom 条目，agent 名定位这次会话
	 * 是哪个子代理跑的）。子代理会话与主会话同落 sessions 目录，没有这条
	 * 条目就会在会话列表里混入一条看不出来历的「普通会话」。
	 */
	markSubagentRun(agentName: string): void {
		this.session.sessionManager.appendCustomEntry("subagent_run", { agent: agentName });
	}

	/**
	 * 团队成员会话的溯源标记（team_member custom 条目，spec:
	 * add-team-foundations 批 5）。与 subagent_run 同理：成员会话不该混进
	 * 会话列表；listSessions 的头部扫描按两个标记一起过滤。
	 */
	markTeamMemberRun(memberName: string): void {
		this.session.sessionManager.appendCustomEntry("team_member", { member: memberName });
	}

	/**
	 * 当前会话文件名。daemon 用它标会话列表的 current、判定 rename/delete
	 * 的目标是不是这个活会话。in-memory 会话为 undefined —— 本应用的会话
	 * 都是持久化的，但 pi 的类型如此，调用方必须处理。
	 */
	get sessionFilePath(): string | undefined {
		return this.session.sessionManager.getSessionFile();
	}

	/* ── 会话分支的窄出口（spec: add-session-branching）──────────────────
	 * 会话分支要「回退到某条用户消息之前」与「从那里派生新会话」，需要 pi 的
	 * 用户消息清单 / 条目树指针 / 叶子。**只开窄方法、不暴露 AgentSession 对象**：
	 * daemon 拿到的就是普通数据（字符串 id 与 parentId），pi 的类型仍然止步于
	 * 本文件（AGENTS.md §1.2 的适配层纪律）。
	 */

	/**
	 * 可分支的用户消息（用户消息序号 → 落盘条目 id 的桥接）。
	 *
	 * 为什么必须由宿主桥接（spec「实测修订」）：渲染层在线路径的 user 消息 id 是
	 * `nextId("user")` 造的（translate 的 message_start 分支），与落盘条目 id
	 * **不一致**，所以 IPC 只传用户消息序号，真 id 在这里现取。技能消息在条目里
	 * 就是普通 user 消息，不额外拆条（同一条只出现一次）。
	 */
	listForkableUserMessages(): readonly { entryId: string; text: string }[] {
		return this.session.getUserMessagesForForking();
	}

	/**
	 * 条目树指针（id / parentId）。会话分支的「分叉点之后是否还有内容」判定
	 * 与「分叉点的父条目」定位只用这两个字段，故不返回整条目。
	 */
	listEntryRefs(): readonly { id: string; parentId: string | null }[] {
		return this.session.sessionManager.getEntries().map((entry) => ({
			id: entry.id,
			parentId: entry.parentId ?? null,
		}));
	}

	/** 当前叶子条目 id（空会话为 null）—— 「重新开始」抽枝时抽到哪一条。 */
	currentLeafId(): string | null {
		return this.session.sessionManager.getLeafId();
	}

	async setModel(modelKey: string): Promise<void> {
		const model = this.options.catalog.resolveModel(modelKey);
		if (model === undefined) throw new Error("该模型不可用");
		await this.session.setModel(model);
		// availableThinkingLevels 随模型联动变化（pi 在 setModel 内 re-clamp），
		// state 两字段都从 getter 现读，这次 emitState 一并覆盖。
		this.emitState();
	}

	/**
	 * 切换当前会话的推理强度档位。
	 *
	 * pi 的 setThinkingLevel 恒 clamp 到当前模型可用档位、不抛错
	 * （agent-session.ts:1684），实际变化时才落 thinking_level_change 条目 ——
	 * 逐会话持久化与 resume 还原全由 pi 负责，我们不做第二份持久化。
	 * 生效值以 emitState 里 getter 现读为准（clamp 后的值可能与入参不同）。
	 */
	setThinkingLevel(level: ThinkingLevel): void {
		this.session.setThinkingLevel(level);
		this.emitState();
	}

	/**
	 * 切换场景 / 交互模式。
	 *
	 * 提示词的每轮重组在 prompt-switch 扩展里发生（before_agent_start），
	 * 这里只负责存轴 + 换工具集。工具白名单是模式 frontmatter 声明的
	 * （resources/modes/<id>.md），白名单语义：未列出的工具被禁用，
	 * 含扩展注册的自定义工具。
	 */
	setScene(sceneId: string): void {
		const scene = this.options.resources.scenes.find((s) => s.id === sceneId);
		if (scene === undefined) throw new Error(`未知的场景：${sceneId}`);
		this.sceneId = sceneId;
		this.emitState();
	}

	/**
	 * 切换交互模式。只切模式轴、换工具集 —— 专家绑定（expertId）与模式正交，
	 * 不在这里读也不在这里写（spec: rework-expert-orthogonal-and-skills）。
	 * 工具集经 effectiveToolNames 合并专家 extraTools（切模式不清专家的追加工具）。
	 */
	setInteraction(interactionId: string): void {
		const mode = this.options.resources.modes.find(
			(m) => m.id === interactionId,
		);
		if (mode === undefined) throw new Error(`未知的交互模式：${interactionId}`);
		this.interactionId = interactionId;
		this.session.setActiveToolsByName([...this.effectiveToolNames()]);
		this.emitState();
	}

	/**
	 * 绑定 / 清除专家。与交互模式正交：只改 expertId，不动模式轴。
	 * 工具集重新应用：extraTools 是专家的声明（spec: add-team-foundations），
	 * 绑定/清除都要即时生效 —— 与「创建即模式工具面」的既有纪律同源
	 * （工具面是一等公民，不该等下一次切模式才对上）。
	 */
	setExpert(expertId: string | undefined): void {
		this.expertId = expertId;
		// 子代理会话的工具面来自 agent 定义、终身不变（toolsOverride 契约，
		// 见 SessionHostOptions.toolsOverride 注释）——它们不会被调用到这里，
		// 但守卫让契约显式：有 override 就不参与专家联动。
		if (this.options.toolsOverride === undefined) {
			this.session.setActiveToolsByName([...this.effectiveToolNames()]);
		}
		this.emitState();
	}

	/**
	 * 生效工具集 = 当前模式白名单 ∪ 专家 extraTools（spec: add-team-foundations）。
	 * 专家只能增不能删：extraTools 不出现在白名单里就追加，出现了去重跳过。
	 */
	private effectiveToolNames(): readonly string[] {
		const mode = this.options.resources.modes.find((m) => m.id === this.interactionId);
		const base = mode === undefined ? [...DEFAULT_TOOLS] : [...mode.tools];
		const extra = this.options.getExpertExtraTools?.() ?? [];
		return extra.length === 0 ? base : [...base, ...extra.filter((tool) => !base.includes(tool))];
	}

	/** 当前技能描述符，供 daemon 组装提示词的技能段。 */
	get skillDescriptors(): readonly SkillDescriptor[] {
		return this.skills;
	}

	get state(): SessionState {
		const usage = this.session.getContextUsage();
		const model = this.session.model;
		return {
			sessionId: this.session.sessionId,
			// 临时任务也是真实 cwd（该任务自己的目录）——契约不再用 undefined 表达「无目录」。
			cwd: this.options.cwd,
			isTempTask: this.options.isTempTask,
			sceneId: this.sceneId,
			interactionId: this.interactionId,
			// 无专家时缺省（不占字段），与 SessionState.expertId 的可选契约一致。
			...(this.expertId === undefined ? {} : { expertId: this.expertId }),
			modelId:
				model === undefined ? undefined : toModelKey(model.provider, model.id),
			// 不能透传 pi 的 session.isStreaming：pi 要到 finally 的 _emitAgentSettled
			// 才把它置 false（agent-session.ts:631/1113），agent_end 事件分发时它仍是 true。
			// 曾经透传导致 agent_end 处理中的 emitState 把 isStreaming:true 推给 renderer，
			// 覆盖 run_finished 刚置的 false —— UI 永久卡在「正在思考…」。
			// 用自家的 run 记账：agent_start 置、agent_end 清，时序完全由本文件控制。
			isStreaming: this.currentRunId !== undefined,
			/*
			 * 档位两字段都从 getter 现读，不落成员字段：
			 * pi 的 thinking_level_changed 事件 payload 只有 level（无 availableLevels），
			 * 而 setModel 后可用档位会联动 re-clamp —— 任何一处缓存副本都会和
			 * pi 的真实状态漂移。非推理模型 getAvailableThinkingLevels 返回 ["off"]，
			 * UI 据此不显示档位行。
			 */
			thinkingLevel: this.session.thinkingLevel,
			availableThinkingLevels: this.session.getAvailableThinkingLevels(),
			// tokens 可能为 null（刚压缩完、还没下一次响应），此时不下发用量。
			...(usage === undefined || usage.tokens === null
				? {}
				: {
					contextUsage: {
						usedTokens: usage.tokens,
						maxTokens: usage.contextWindow,
					},
				}),
		};
	}

	/* ── 事件翻译 ────────────────────────────────────────────────── */

	private nextId(prefix: string): string {
		this.idSeq += 1;
		return `${prefix}-${this.idSeq}`;
	}

	private emitState(): void {
		this.options.emit({ type: "session_state", state: this.state });
	}

	/**
	 * 把一条流式 delta 并入缓冲；类型切换或换消息时先把上一批 flush 出去。
	 *
	 * 定时器到期是唯一「无外部事件驱动」的 flush 时机；另外三个（类型切换、
	 * message_end、turn/agent_end）由下面的调用点主动触发，缺一即丢内容。
	 */
	private bufferDelta(kind: "text" | "thinking", messageId: string, delta: string): void {
		const pending = this.pendingDeltas;
		if (pending !== undefined && (pending.kind !== kind || pending.messageId !== messageId)) {
			this.flushDeltas();
		}
		const current = this.pendingDeltas;
		if (current === undefined) {
			this.pendingDeltas = {
				kind,
				messageId,
				text: delta,
				timer: setTimeout(() => this.flushDeltas(), DELTA_FLUSH_MS),
			};
			return;
		}
		current.text += delta;
	}

	/**
	 * 立即把缓冲的 delta 按原事件类型发出去（无缓冲时 no-op）。
	 *
	 * `delta` 是拼接结果，事件类型与字段语义与未合批时完全一致 —— 下游零改动。
	 */
	private flushDeltas(): void {
		const pending = this.pendingDeltas;
		if (pending === undefined) return;
		this.pendingDeltas = undefined;
		clearTimeout(pending.timer);
		this.options.emit(
			pending.kind === "text"
				? { type: "assistant_text_delta", messageId: pending.messageId, delta: pending.text }
				: { type: "assistant_thinking_delta", messageId: pending.messageId, delta: pending.text },
		);
	}

	/**
	 * pi 事件 → 领域事件。
	 *
	 * 用 pi 的真实类型 `AgentSessionEvent` 而不是宽松的 Record —— 这是有意的：
	 * 适配层的价值在于「pi 升级只塌这一个文件，而且响亮地塌」。
	 * 若用 Record + 字符串索引，pi 改字段名（如 toolCallId → toolCallID）
	 * 会照样编译通过，然后工具卡片静默不再渲染 —— 那是最难查的失败方式
	 * （AGENTS.md §7：不写防御性兜底掩盖上游问题）。
	 *
	 * 只处理 UI 真正需要的那几类；turn_start / turn_end 不上传但进台账
	 * （llm_call 的起止，见 settleLlmCall），auto_retry / queue_update 台账与转发都做
	 * （renderer 的重试状态行 / 排队徽标）。其余未知类型忽略。
	 * 不写 default 分支抛错：pi 会持续新增事件类型，未知类型忽略才是正确行为。
	 */
	private translate(event: AgentSessionEvent): void {
		const emit = this.options.emit;

		switch (event.type) {
			case "compaction_start": {
				// 无论 run 内自动还是空闲手动，压缩过程都要上屏（会话流尾部状态行）
				// —— 压缩调模型写摘要，耗时与一轮对话相当，静默等于黑洞。
				// run 内的自动压缩（threshold/overflow）：流式态由原 run 覆盖，不动记账。
				if (this.currentRunId !== undefined) {
					emit({ type: "compaction_started", reason: event.reason });
					return;
				}
				// 空闲时的压缩（手动）：压缩要调模型写摘要，复用 run 记账让 UI
				// 进入流式态（禁输入、出停止键），否则用户以为卡死了。
				const runId = this.nextId("run");
				this.currentRunId = runId;
				this.ledgerRunId = runId;
				this.ledger?.append("run_start", { runId, ...this.modelIdForLedger() });
				emit({ type: "run_started", runId });
				this.emitState();
				// 压缩事件在 emitState 之后发：reducer 对 session_state 会清瞬态
				// 压缩态（口径见 shared/conversation.ts），先发会被紧随的 state 抹掉。
				emit({ type: "compaction_started", reason: event.reason });
				return;
			}

			case "compaction_end": {
				// 压缩事实进台账：无论它挂在哪个 run 上（run 内自动 / 空闲手动）。
				this.ledger?.append("compaction", {
					reason: event.reason,
					...(event.result?.tokensBefore === undefined
						? {}
						: { tokensBefore: event.result.tokensBefore }),
					aborted: event.aborted,
					...(event.errorMessage === undefined ? {} : { errorMessage: event.errorMessage }),
				});
				// 压缩结束一律清 renderer 的压缩态（无论成功/中断/失败），状态行随之消失。
				// 先于下面的 run 收尾事件发：reducer 先落定压缩终态，随后的 session_state
				// 重推不会留下幽灵状态行（口径见 shared/conversation.ts）。
				emit({
					type: "compaction_finished",
					aborted: event.aborted,
					...(event.errorMessage === undefined ? {} : { errorMessage: event.errorMessage }),
				});
				// willRetry 表示压缩后自动续跑被中断的那轮：流式态归原 run 与后续
				// agent 事件管，这里不动（同 agent_end 的 willRetry 处理）。
				if (event.willRetry) return;
				const runId = this.currentRunId;
				if (runId === undefined) return;
				this.currentRunId = undefined;
				if (!event.aborted && event.errorMessage === undefined) {
					this.closeLedgerRun("completed");
					emit({ type: "run_finished", runId, outcome: "completed" });
				} else {
					const message = event.errorMessage ?? "上下文压缩已中断";
					this.closeLedgerRun("error", message);
					emit({
						type: "run_error",
						runId,
						message,
					});
				}
				this.emitState();
				return;
			}

			case "agent_start": {
				const runId = this.nextId("run");
				this.currentRunId = runId;
				this.pendingRunError = undefined;
				this.ledgerRunId = runId;
				this.ledgerTurnIndex = 0;
				this.ledger?.append("run_start", { runId, ...this.modelIdForLedger() });
				emit({ type: "run_started", runId });
				this.emitState();
				return;
			}

			case "agent_end": {
				// run 终态（含用户 abort 的收尾）必须 flush：这是「不丢最后半句」的
				// 最后一道闸。放在 willRetry 分支之前，两条路径都覆盖。
				this.flushDeltas();
				/*
				 * 台账的 run 在**每个** agent_end 闭合（willRetry 也是一次真实
				 * 尝试的失败终态），与 UI 的 run 记账（跨 willRetry 保持流式态）
				 * 是两套口径 —— 否则重试链会在台账里留一串永不闭合的孤儿 run。
				 * 读 pendingRunError 但不清：那是 UI 的账，归下面的 willRetry 分支管。
				 */
				if (event.willRetry) {
					this.closeLedgerRun("error", this.pendingRunError);
					// willRetry 表示 pi 正在自动重试，这一轮还没真结束。
					// 此时发 run_finished 会让 UI 提前解禁输入框、然后又被下一轮锁住。
					return;
				}
			const runId = this.currentRunId ?? this.nextId("run");
			this.currentRunId = undefined;
			this.currentAssistantId = undefined;
			this.streamToolCalls.clear();
			// 本 run 的 hidden context 账清掉：transformContext 注入的是 run 期
			// 瞬态，run 已终就不该再出现在（可能的）压缩调用等后续模型请求里。
			this.pendingHidden = undefined;
				/*
				 * pi 没有独立的「已取消」事件：abort() 后 agent 循环照常走
				 * message_end → turn_end → agent_end 收尾（agent.ts handleRunFailure /
				 * agent-loop.ts:215），区别只在收尾消息里有一条 assistant 的
				 * stopReason === "aborted"。取消与正常结束在 UI 是两种终态
				 * （指示行、定格计时），所以在这里判定后随 run_finished 下发。
				 */
				const cancelled = event.messages.some(
					(m) => m.role === "assistant" && m.stopReason === "aborted",
				);
				/*
				 * 失败记账优先于完成态：pendingRunError 未清说明本 run 最后停在错误上
				 * （重试耗尽或未开重试）—— 这才是真的终态失败，此刻才发 run_error。
				 * 先败后成的 run 走到这里账已被成功消息清空，正常落 run_finished。
				 * 取消优先于错误：用户中断就是取消，不翻成错误卡。
				 */
				if (this.pendingRunError !== undefined && !cancelled) {
					const message = this.pendingRunError;
					this.pendingRunError = undefined;
					this.closeLedgerRun("error", message);
					emit({ type: "run_error", runId, message });
				} else {
					this.pendingRunError = undefined;
					this.closeLedgerRun(cancelled ? "cancelled" : "completed");
					emit({ type: "run_finished", runId, outcome: cancelled ? "cancelled" : "completed" });
				}
				this.emitState();
				return;
			}

			case "auto_retry_start": {
				// pi 的失败退避：等待 delayMs 后发起第 attempt 次重试。
				// 全量转发给 renderer（等待区状态行，替换「卡住」体感）+ 进台账。
				this.pendingRetry = { maxAttempts: event.maxAttempts, delayMs: event.delayMs };
				const runId = this.ledgerRunId ?? this.lastClosedRunId;
				this.ledger?.append("retry", {
					...(runId === undefined ? {} : { runId }),
					phase: "start",
					attempt: event.attempt,
					maxAttempts: event.maxAttempts,
					delayMs: event.delayMs,
					errorMessage: event.errorMessage,
				});
				emit({
					type: "run_retry",
					status: "start",
					attempt: event.attempt,
					maxAttempts: event.maxAttempts,
					delayMs: event.delayMs,
					errorMessage: event.errorMessage,
				});
				return;
			}

			case "auto_retry_end": {
				// auto_retry_end 不携带 maxAttempts/delayMs，从最近一次 start 记账补齐。
				const last = this.pendingRetry;
				this.pendingRetry = undefined;
				const runId = this.ledgerRunId ?? this.lastClosedRunId;
				this.ledger?.append("retry", {
					...(runId === undefined ? {} : { runId }),
					phase: "end",
					attempt: event.attempt,
					success: event.success,
					...(event.finalError === undefined ? {} : { finalError: event.finalError }),
				});
				emit({
					type: "run_retry",
					status: event.success ? "success" : "finalError",
					attempt: event.attempt,
					maxAttempts: last?.maxAttempts ?? event.attempt,
					delayMs: last?.delayMs ?? 0,
					...(event.finalError === undefined ? {} : { errorMessage: event.finalError }),
				});
				return;
			}

			case "queue_update": {
				// steer / followUp 排队变化：renderer 只渲染计数徽标，台账留全过程。
				this.ledger?.append("queue", {
					steering: event.steering,
					followUp: event.followUp,
				});
				emit({
					type: "queue_changed",
					steering: event.steering,
					followUp: event.followUp,
				});
				return;
			}

			case "turn_start": {
				// 单次模型调用的开始（llm_call 条目的起点）。turn 边界成对是
				// agent-loop 的契约，turn_end 必有 —— 这里只记账不防御。
				this.ledgerTurnIndex += 1;
				this.turnStartedAt = Date.now();
				this.turnFirstDeltaAt = undefined;
				return;
			}

			case "turn_end": {
				// turn 结束（含 abort 收尾）必须 flush：本 turn 最后一批 delta 不能拖到
				// 窗口到期才发，否则会落到终态之后（内容边界与顺序都错）。正常时序下
				// message_end 已先 flush，这里是幂等的兜底。
				//
				// **台账 llm_call 不在这里结算**（2026-09-17 修正）：pi 的 turn_end 是
				// 「这一轮全部结束」（工具结果都 append 完才 emit），挂在这里会把本轮
				// 工具耗时算进模型耗时。结算点已挪到助手 message_end，理由见 settleLlmCall。
				this.flushDeltas();
				return;
			}

			case "message_start": {
				const message = event.message;
				// contentIndex 每条消息重新计数，上一条消息的生成期追踪全部作废。
				this.streamToolCalls.clear();

				if (message.role === "user") {
					// 用户消息由 daemon 确认后回显，而不是 UI 乐观插入 ——
					// 排队（steer / followUp）时消息的实际落位与发送顺序可能不同。
					const { text, images } = userContentOf(message.content);
					// 技能正文（pi 展开的整篇 SKILL.md）只该进模型上下文，不该进用户气泡：
					// 剥成技能名 + 用户自己打的补充文本，两条产出路径同一个解析出口
					// （历史重建见 session-rebuild 的 userView）。
					const { skillNames, text: displayText } = splitSkillBlocks(text);
					emit({
						type: "user_message",
						message: {
							id: this.nextId("user"),
							role: "user",
							text: displayText,
							// 无图不带字段：UserMessage.images 是可选契约，UI 按缺省渲染。
							...(images === undefined ? {} : { images }),
							// 无技能同理，不带空数组（口径同 images）。
							...(skillNames.length === 0 ? {} : { skillNames }),
							at: message.timestamp,
						},
					});
					return;
				}

				if (message.role === "assistant") {
					const id = this.nextId("assistant");
					this.currentAssistantId = id;
					emit({
						type: "assistant_started",
						messageId: id,
						at: message.timestamp,
					});
				}
				return;
			}

			case "message_update": {
				const inner = event.assistantMessageEvent;

				/*
				 * 工具调用的生成阶段：卡片从「模型开始吐参数」就上屏（WorkBuddy 的
				 * 「生成中 +N」），而不是等 tool_execution_start —— 写文件时参数里
				 * 就是文件内容，生成几十秒、执行毫秒级，等执行才上屏等于整段不可见。
				 * 这条路径不依赖 currentAssistantId（卡片定位靠 toolCallId），放最前。
				 */
				if (inner.type === "toolcall_start") {
					// 工具调用参数也是模型输出：TTFT 基准同样认它（见 markFirstOutput）。
					this.markFirstOutput();
					this.streamToolCalls.set(inner.contentIndex, { rawArgs: "" });
					return;
				}
				if (inner.type === "toolcall_delta") {
					this.translateToolCallDelta(inner);
					return;
				}
				if (inner.type === "toolcall_end") {
					this.streamToolCalls.delete(inner.contentIndex);
					return;
				}

				if (inner.type === "text_delta" || inner.type === "thinking_delta") {
					// TTFT 基准：本 turn 首个输出 delta 的到达时刻（台账 llm_call）。
					// 必须在缓冲之前记录 —— 它量的是 pi 事件到达时刻，不是 flush 时刻。
					this.markFirstOutput();
				}

				const id = this.currentAssistantId;
				if (id === undefined) return;

				if (inner.type === "text_delta") {
					this.bufferDelta("text", id, inner.delta);
				} else if (inner.type === "thinking_delta") {
					this.bufferDelta("thinking", id, inner.delta);
				}
				// 其余 inner 事件（text_start/end、thinking_start/end、done…）不上传：
				// 正文与思考靠 delta + assistant_done 终态校正，边界事件对 UI 无信息量。
				return;
			}

			case "message_end": {
				// 必须在本消息的终态校正（assistant_done / run_error 记账）之前 flush：
				// 否则最后一批 delta 会晚于 assistant_done 到达，拼接结果与顺序都错。
				this.flushDeltas();
				const message = event.message;
				if (message.role !== "assistant") return;

				// 台账 llm_call 在助手消息完成这一刻结算（不是 turn_end）——
				// 详见 settleLlmCall：这一步之后才会跑本轮的工具。
				this.settleLlmCall(message);

				const id = this.currentAssistantId;
				this.currentAssistantId = undefined;
				if (id === undefined) return;

				const thinking = thinkingOf(message.content);
				emit({
					type: "assistant_done",
					message: {
						id,
						role: "assistant",
						text: textOf(message.content),
						...(thinking === "" ? {} : { thinking }),
						// usage 服务于诊断页的 run 级聚合（shared/observability.ts），
						// 聊天 UI 不展示。pi 的 Usage 止步于此，出口是 shared 的 TokenUsage
						//（全字段翻译函数与 session-rebuild 同源，两条路径不漂移）。
						usage: toTokenUsage(message.usage),
						at: message.timestamp,
					},
				});

				// 模型侧报错（超限、内容策略、网关超时）只体现在消息的 errorMessage 上，
				// 但**此刻不能发卡**：pi 有自动重试（agent_end 的 willRetry 标记 +
				// auto_retry_start/end 事件，agent-session.ts:166-167/637），失败尝试的
				// message_end 先到、agent_end(willRetry=true) 后到 —— 若在这里发 run_error，
				// 重试成功后错误卡与正常回复就会并存（2026-09-10 用户实测：启动后首发
				// 「你好」先弹 Request timed out. 错误卡，几秒后回复照常到达）。
				// 所以只记账：终态判定挪到 agent_end —— 重试耗尽或未开重试时才发卡。
				// stopReason "aborted" 不记：那是用户取消，终态由 run_finished cancelled 表达。
				if (
					message.errorMessage !== undefined &&
					message.errorMessage !== "" &&
					message.stopReason === "error"
				) {
					this.pendingRunError = message.errorMessage;
				} else if (message.stopReason !== "aborted") {
					// 成功的助手消息清账：同一 run 内先败后成（重试成功）不留错误残留。
					this.pendingRunError = undefined;
				}
				return;
			}

			case "tool_execution_start": {
				// 生成阶段已上屏的同 id 卡片会被 reducer 原位翻转（upsert）；
				// at 沿用生成开始的时间 —— 卡片的寿命从「开始生成」算起，不是「开始执行」。
				const existing = this.toolCards.get(event.toolCallId);
				const argSummary = summarizeArgs(event.args);

				// 台账 tool_call 记账（执行期口径的起点，注释见 ToolCallData）。
				this.openLedgerTools.set(event.toolCallId, {
					toolName: event.toolName,
					summary: argSummary.summary,
					startedAt: Date.now(),
				});

				// write/edit：执行前留下旧内容现场（WorkBuddy checkpoint 同思路），
				// changeType 与真实 diff 都靠它。此后文件被写掉，旧内容就再也拿不到了。
				let stash: { change: FileChange | undefined; changeType: "created" | "modified" } | undefined;
				if (event.toolName === "write" || event.toolName === "edit") {
					const oldContent = this.readOverwriteTarget(event.args);
					const changeType: "created" | "modified" = oldContent === undefined ? "created" : "modified";
					const change =
						event.toolName === "write"
							? changeFromWrite(event.args, oldContent)
							: changeFromEdit(event.args, oldContent);
					stash = { change, changeType };
					this.pendingChanges.set(event.toolCallId, stash);
				}

				// todo_write：清单随执行态卡上屏 —— pi 的事件序列里 args 只在
				// execution_start 完整出现（tool_execution_end 不携带 args，
				// pi agent/src/types.ts 的 AgentEvent），终态卡从本卡继承。
				// 模型手滑解析不出时键缺席：清单只是增强展示，卡片照常落成。
				const todos = event.toolName === "todo_write" ? parseTodoArgs(event.args) : undefined;

				const card: ToolCard = {
					id: event.toolCallId,
					role: "tool",
					toolName: event.toolName,
					// write/edit 执行期沿用生成期标签（WorkBuddy 词汇表没有「写入中」，
					// 生成中/修改中 一直显示到完成态翻成 已生成/已修改）。
					label:
						stash !== undefined
							? generatingLabel(event.toolName, stash.changeType)
							: runningLabel(event.toolName),
					summary: argSummary.summary,
					outcome: undefined,
					detail: undefined,
					// 摘要顶掉入参原值（shell 的描述顶掉命令）时把原值带上，卡头 hover 才看得到。
					...(argSummary.title === undefined ? {} : { summaryTitle: argSummary.title }),
					// show_widget：reducer 的 tool_started 是整卡替换，生成期累积的
					// streamArgs 会被丢掉，而执行结果（detail）还没回来 —— 渲染层在
					// 这个窗口仍靠 streamArgs 出图，用完整 args 回填一次。
					...(event.toolName === "show_widget"
						? { streamArgs: JSON.stringify(event.args) }
						: {}),
					...(todos === undefined ? {} : { todos }),
					at: existing?.at ?? Date.now(),
				};
				this.toolCards.set(event.toolCallId, card);
				emit({ type: "tool_started", card });
				return;
			}

			case "tool_execution_update": {
				// task 工具的结构化投影优先于文本 delta，且判定必须放在取文本之前：
				// 投影期 content.text 恒为空串（进度全走 details.subagents），
				// 落到下面的空串早退会把整段投影静默吞掉。
				const subagents = childAgentsOf(toolResultDetails(event.partialResult));
				if (subagents !== undefined) {
					emit({ type: "subagent_progress", id: event.toolCallId, agents: subagents });
					return;
				}
				const delta = toolResultText(event.partialResult);
				if (delta === "") return;
				emit({ type: "tool_progress", id: event.toolCallId, delta });
				return;
			}

			case "tool_execution_end": {
				const started = this.toolCards.get(event.toolCallId);
				this.toolCards.delete(event.toolCallId);
				const stash = this.pendingChanges.get(event.toolCallId);
				this.pendingChanges.delete(event.toolCallId);
				const outcome: ToolOutcome = event.isError ? "error" : "ok";
				const detail = toolResultText(event.result);

				// 台账 tool_call 结算。漏 start（pi 时序异常，理论不该发生）不编造
				// 零时长条目 —— 上报 event-log 后跳过，run 不受影响（台账纪律）。
				const ledgerTool = this.openLedgerTools.get(event.toolCallId);
				this.openLedgerTools.delete(event.toolCallId);
				if (ledgerTool === undefined) {
					this.ledger?.reportFailure(
						`tool_execution_end 缺少配对的 start（${event.toolName}/${event.toolCallId}），tool_call 条目未记`,
					);
				} else {
					this.ledger?.append("tool_call", {
						...(this.ledgerRunId === undefined ? {} : { runId: this.ledgerRunId }),
						toolCallId: event.toolCallId,
						toolName: ledgerTool.toolName,
						summary: ledgerTool.summary,
						startedAt: ledgerTool.startedAt,
						endedAt: Date.now(),
						outcome,
					});
				}

				// web_search 的引用来源：从 result.details 提取并过 URL 安全校验
				// （core/source-parse.ts）。与 todo_write 的 todos 不同源 —— todos 来自
				// args（execution_end 不携带 args，靠执行态卡继承），sources 来自
				// result（execution_end 才拿到执行结果），所以在这里解析而不是 start。
				// details 缺席 → 键缺席，卡片照常落成。
				const sources =
					event.toolName === "web_search" ? parseSources(toolResultDetails(event.result)) : undefined;

				// task 工具的子代理终态投影：与 sources 同源（result.details 只在
				// execution_end 拿到），挂上后终态卡自带完整分组结果，不依赖
				// 运行期 subagent_progress 是否到过（如恢复会话的回放路径）。
				const subagents = childAgentsOf(toolResultDetails(event.result));

				emit({
					type: "tool_finished",
					card: {
						id: event.toolCallId,
						role: "tool",
						toolName: event.toolName,
						// 完成标签：write/edit 按新建/覆盖分 已生成/已修改（WorkBuddy 词汇表），
						// 其余工具走 已读取/已列出…。started 缺失说明漏了 start 事件
						// （理论上不该发生），回落到工具名而不是编一个假标签。
						label:
							stash !== undefined
								? writeDoneLabel(stash.changeType, outcome)
								: started === undefined
									? event.toolName
									: doneLabel(event.toolName, outcome),
						summary: started?.summary ?? "",
						outcome,
						detail: detail === "" ? undefined : detail,
						// hover 提示从执行态卡继承（summarizeArgs 只在 start 拿到 args）。
						...(started?.summaryTitle === undefined ? {} : { summaryTitle: started.summaryTitle }),
						// 失败的写入不产生变更（文件可能只写了一半，统计会误导）。
						...(outcome === "ok" && stash?.change !== undefined ? { change: stash.change } : {}),
						// todo_write 的清单从执行态卡继承（args 在 execution_start 解析，
						// tool_execution_end 事件不携带 args，见该处注释）。
						...(started?.todos === undefined ? {} : { todos: started.todos }),
						...(sources === undefined ? {} : { sources }),
						// task 卡的终态投影（提取见上方 subagents 注释）。
						...(subagents === undefined ? {} : { subagents }),
						at: started?.at ?? Date.now(),
					},
				});
				return;
			}

			/*
			 * 档位/会话信息变化：不重造任何成员字段，直接重推权威 state。
			 * thinking_level_changed 的 payload 只有 level（无 availableLevels），
			 * 而 state 两字段都从 getter 现读（见 state 注释），一次 emitState
			 * 同时覆盖「切档位」与「切模型后档位联动 re-clamp」两种来源。
			 */
			case "thinking_level_changed":
			case "session_info_changed":
				this.emitState();
				return;
		}
	}

	/**
	 * 结算一次模型调用（台账 llm_call）。
	 *
	 * **挂在助手 message_end，不挂 turn_end**（2026-09-17 修正）：pi 的 turn_end 是
	 * 「这一轮全部结束」—— 助手消息与每个工具结果都 append 完才 emit
	 *（agent-session.js "A turn ends after its assistant message and every tool
	 * result has been appended"）。挂 turn_end 有三处后果，多 agent 场景尤其明显
	 *（一个 task 子代理工具就是几分钟）：
	 *   1. endedAt − startedAt 里混进本轮工具执行时间 → 解码窗口（shared 的
	 *      stepDecode）跟着虚高，tok/s 的分母被撑大（面板实测出现过 3 tok/s，
	 *      而同一步扣掉 task 工具后约 200 tok/s）；
	 *   2. llmMs 与 toolMs 相互重叠，「模型耗时 · 工具耗时」并列展示等于重复计时；
	 *   3. 写入顺序变成「先本轮工具、后本轮 llm_call」，而 renderer 的
	 *      foldRunSteps 按位置归属工具 → 每轮的工具都挂到上一步头上，每轮开头
	 *      还多出一个假的「台账截尾」组（2026-09-17 面板实测）。
	 *
	 * 失败路径也走这里：pi 的 abort / 报错收尾同样先发 message_end（带 errorMessage
	 * 与 stopReason），每次 attempt 各自成一条，语义比挂 turn_end 更细。
	 */
	private settleLlmCall(
		message: Extract<
			Extract<AgentSessionEvent, { type: "message_end" }>["message"],
			{ role: "assistant" }
		>,
	): void {
		const startedAt = this.turnStartedAt;
		// turn_start 缺失（理论上不发生，见 turn_start 注释）就不造条目 ——
		// 编一个 startedAt=endedAt 的假跨度比丢一条更难查。
		if (startedAt === undefined) return;
		// 先清态再写：这一轮的窗口已经用掉了，重复到达的 message_end 不会二次结算。
		this.turnStartedAt = undefined;
		const firstDeltaAt = this.turnFirstDeltaAt;
		this.turnFirstDeltaAt = undefined;
		this.ledger?.append("llm_call", {
			...(this.ledgerRunId === undefined ? {} : { runId: this.ledgerRunId }),
			turnIndex: this.ledgerTurnIndex - 1,
			startedAt,
			endedAt: Date.now(),
			...(firstDeltaAt === undefined ? {} : { ttftMs: firstDeltaAt - startedAt }),
			stopReason: message.stopReason,
			usage: toTokenUsage(message.usage),
			...(message.errorMessage === undefined ? {} : { errorMessage: message.errorMessage }),
		});
	}

	/**
	 * 首个模型输出到达的记账（TTFT 基准与解码窗口的左端点）。
	 *
	 * 正文 / 思考 / 工具调用参数任一先到都算首字：纯工具调用的轮次（模型直接吐一个
	 * write 的参数、不写正文）以前拿不到 ttftMs，于是那一轮既没有首字延迟读数、
	 * 也拿不到解码速度样本（stepDecode 要求 ttftMs 与 usage 兼备）—— 长任务里
	 * 这类轮次占比不低。
	 */
	private markFirstOutput(): void {
		if (this.turnStartedAt !== undefined && this.turnFirstDeltaAt === undefined) {
			this.turnFirstDeltaAt = Date.now();
		}
	}

	/** 台账 run_start 的模型快照（provider/model）；模型未选定（异常路径）键缺席。 */
	private modelIdForLedger(): { modelId?: string } {
		const model = this.session.model;
		return model === undefined ? {} : { modelId: toModelKey(model.provider, model.id) };
	}

	/**
	 * 闭合当前台账 run（无开着的是 no-op —— 空闲压缩的 compaction_end 在
	 * currentRunId 缺失时根本走不到这里，agent_end 的 runId 兜底分支同理）。
	 * 闭合后把 id 记入 lastClosedRunId：retry 条目的归属靠它（见该字段注释）。
	 */
	private closeLedgerRun(reason: "completed" | "cancelled" | "error", error?: string): void {
		const runId = this.ledgerRunId;
		this.ledgerRunId = undefined;
		if (runId === undefined) return;
		this.lastClosedRunId = runId;
		this.ledger?.append("run_end", {
			runId,
			reason,
			...(error === undefined ? {} : { error }),
		});
	}

	/**
	 * 挂 pi 的 transformContext 钩子注入 hidden context（F5）。
	 *
	 * transformContext 是 agent-loop 每次模型调用前的官方改写口，且**返回值
	 * 即入模内容、不落会话文件**（agent-loop.ts 局部变量，state.messages 不回写）
	 * —— 所以这里每次调用都注入（WorkBuddy 的 every_turn 同语义），run 结束
	 * 后自然消失，不需要任何卸载逻辑。工作目录/场景/专家这类常态内容也必须
	 * 每轮重注入：不落盘的东西不注入就等于模型看不见。
	 *
	 * 包一层而不是替换（同 installRequestSnapshot）：先调原钩子（含全部扩展
	 * 的改写），对改写结果注入。钩子契约 must-not-throw：注入失败经台账上报
	 * 通道进 event-log，消息原样入模 —— hidden context 是增强不是门槛。
	 */
	private installHiddenContext(): void {
		const agent = this.session.agent;
		// agent 对象缺席就没处挂钩子（生产路径不会发生；测试桩会话没有它）——
		// 跳过注入而不是炸构造：hidden context 是增强不是门槛。
		if (agent === undefined) return;
		const inner = agent.transformContext?.bind(agent);
		agent.transformContext = async (messages, signal) => {
			let transformed = inner === undefined ? messages : await inner(messages, signal);
			const block = this.pendingHidden;
			if (block !== undefined) {
				try {
					// spread 一次：pi 的钩子签名要可变数组，注入函数按纪律返回只读。
					transformed = [...prependHiddenContext(transformed, block)];
				} catch (error) {
					this.ledger?.reportFailure(
						`hidden context 注入失败：${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}
			return transformed;
		};
	}

	/**
	 * 组装本 run 的 hidden context：三个 section（对齐 WorkBuddy 逆向笔记 §6
	 * 第一批的范围，"first_turn + 变更重发"简化为每 run 重注入 —— 我们的注入
	 * 不落会话文件，不重注入就等于丢失）：
	 *
	 *   1. workspace_context（user-context）—— cwd + 场景 + 交互模式 + 专家。
	 *      **cwd 的唯一来源（用户会话）**：系统提示词里已经没有它了（骨架那行随 spec:
	 *      stabilize-prompt-prefix 删掉；pi 内置的那行 `cwd` 又被
	 *      before_agent_start 的整串替换换掉），中途切场景/换专家
	 *      （setScene/setExpert 不重组系统提示词）也只有这里跟得上。
	 *      （子代理/成员会话例外：composeSubagentPrompt 会把同一个 cwd 写进自己的
	 *      提示词，值同源同为 cwd，不产生两份漂移 —— 见 prompt-composer.ts 文件头。）
	 *   2. memory_and_skills_reminder（user-context）—— 记忆三层短指针
	 *      （core/memory.ts memoryReminder），全空则整段缺席。
	 *   3. current_time（additional-data）—— run 冻结时刻，一次性容器。
	 *      **时间的唯一来源**：逐轮注入块（prompt-switch 的 `context` 事件）
	 *      已不带时间，模型看「现在」只靠这一段。
	 *
	 * 全部段都空返回 undefined（新用户 + 无记忆 + 不可能：时间永远有 ——
	 * 实际上本函数恒有值，undefined 分支只是 composeHiddenContext 契约的如实透传）。
	 */
	private composeRunHiddenContext(): string | undefined {
		const scene = this.options.resources.scenes.find((s) => s.id === this.sceneId);
		const mode = this.options.resources.modes.find((m) => m.id === this.interactionId);
		// sessionCwd 是 string（不是 undefined）：create() 里必然赋值，但构造后
		// 理论上有空窗，空串回落到 options.cwd 才不失真。
		const cwd = this.sessionCwd === "" ? this.options.cwd : this.sessionCwd;
		// 专家显示名解析失败回落 expertId：钉子的职责是「指认身份」，id 也能指认。
		const expertLabel = this.options.getExpertLabel?.() ?? this.expertId;

		const workspaceLines = [`工作目录：${cwd}`];
		if (scene !== undefined) workspaceLines.push(`场景：${scene.label}（${scene.id}）`);
		if (mode !== undefined) workspaceLines.push(`交互模式：${mode.label}（${mode.id}）`);
		if (expertLabel !== undefined) workspaceLines.push(`专家：${expertLabel}`);

		const sections: HiddenSection[] = [
			{ tag: "workspace_context", role: "user-context", body: workspaceLines.join("\n") },
		];
		const memory = memoryReminder(cwd);
		if (memory !== undefined) {
			sections.push({ tag: "memory_and_skills_reminder", role: "user-context", body: memory });
		}
		sections.push({
			tag: "current_time",
			role: "additional-data",
			body: formatRunTime(new Date()),
		});
		return composeHiddenContext(sections);
	}

	/**
	 * 挂 pi 的 transformContext 钩子记请求快照（request_snapshot）。
	 *
	 * transformContext 是 agent-loop 每次模型调用前的官方观察口
	 * （agent-loop.ts streamAssistantResponse：transformContext → convertToLlm → LLM），
	 * pi 在 sdk.ts 已把它接到扩展链（emitContext）—— 这里**包一层而不是替换**：
	 * 先调原钩子（含全部扩展的改写），对改写结果记快照，然后原样透传返回，
	 * 不改写任何消息（快照是观测，不是新的改写点）。
	 *
	 * 钩子的 pi 侧契约是「must not throw」：记录出错经台账上报通道进 event-log，
	 * 绝不炸 run（台账纪律同 run-ledger.ts 文件头）。
	 */
	private installRequestSnapshot(): void {
		const agent = this.session.agent;
		// bind 一层防御 pi 未来把它改成实例方法；当前是箭头闭包，bind 是无害恒等。
		const inner = agent.transformContext?.bind(agent);
		agent.transformContext = async (messages, signal) => {
			const transformed = inner === undefined ? messages : await inner(messages, signal);
			try {
				this.recordRequestSnapshot(transformed);
			} catch (error) {
				this.ledger?.reportFailure(
					`request_snapshot 记录失败：${error instanceof Error ? error.message : String(error)}`,
				);
			}
			return transformed;
		};
	}

	/**
	 * 记一条 request_snapshot：system 分段 provenance + 消息分类计数。
	 *
	 * **不记正文**（口径钉住）：消息正文在会话 JSONL 已有，台账只记
	 * 「这轮往模型里送了什么结构」——分段来源与各类条数/字符数，
	 * 正文双写既膨胀又会与会话 JSONL 漂移。
	 */
	private recordRequestSnapshot(messages: readonly unknown[]): void {
		const user = { count: 0, chars: 0 };
		const assistant = { count: 0, chars: 0 };
		const toolResult = { count: 0, chars: 0 };
		const other = { count: 0, chars: 0 };
		for (const message of messages) {
			const role = (message as { role?: unknown }).role;
			if (role === "user") {
				user.count += 1;
				user.chars += textOf((message as { content?: unknown }).content).length;
			} else if (role === "assistant") {
				assistant.count += 1;
				const content = (message as { content?: unknown }).content;
				assistant.chars += textOf(content).length + thinkingOf(content).length;
			} else if (role === "toolResult") {
				toolResult.count += 1;
				toolResult.chars += textOf((message as { content?: unknown }).content).length;
			} else {
				// convertToLlm 之前的原始角色（bashExecution / custom /
				// branchSummary / compactionSummary）：pi 随后会转写或过滤，
				// 这里 best-effort 计数（summary/output 字符串或 content 文本）。
				other.count += 1;
				other.chars += customMessageChars(message);
			}
		}
		const segments = this.options.getSystemPromptSegments?.();
		this.ledger?.append("request_snapshot", {
			...(this.ledgerRunId === undefined ? {} : { runId: this.ledgerRunId }),
			turnIndex: this.ledgerTurnIndex - 1,
			...(segments === undefined ? {} : { systemSegments: segments }),
			// 快照在注入之后记录（钩子包装顺序见构造器），user 计数里已含
			// hidden context —— 这里把它的字符数单独亮出，成分视图好单列一行。
			...(this.pendingHidden === undefined
				? {}
				: { hiddenContextChars: this.pendingHidden.length }),
			messages: { user, assistant, toolResult, other },
		});
	}

	/**
	 * 读 write/edit 目标文件的旧内容（执行前调用，此后旧内容就被写掉了）。
	 * 返回 undefined 表示目标原本不存在（新建）；存在但不可读时按空串处理
	 * 不如让它响 —— 读盘失败说明环境有问题，掩成「新建」会把 diff 全算错。
	 */
	private readOverwriteTarget(args: unknown): string | undefined {
		if (typeof args !== "object" || args === null) return undefined;
		const { path } = args as Record<string, unknown>;
		if (typeof path !== "string" || path === "") return undefined;
		const abs = resolve(this.sessionCwd, path);
		if (!existsSync(abs)) return undefined;
		return readFileSync(abs, "utf8");
	}

	/**
	 * toolcall_delta 的处理：累积参数原文，并在 id/name 稳定后发出生成中卡片。
	 *
	 * 生成期上屏的工具范围见 STREAM_CARD_TOOLS：write/edit 生成期长，
	 * web_search/web_fetch 执行期长（网络请求），show_widget 的内容全在参数里，
	 * 都需要尽早占位消除空白窗；read/ls/grep/find/read_me 本地瞬时完成，
	 * 生成期上屏反而闪一下。
	 *
	 * write 额外发行数进度（「生成中 +N」的 N 从这里来）。edit 不发 ——
	 * 它的参数是嵌套的 edits 数组，流式数行要维护部分 JSON 解析状态机，
	 * 成本高收益低，生成中只显示卡片本身（event 注释里也是这个口径）。
	 * show_widget 发累积的参数原文（rawArgs）：widget_code 在参数里逐步变长，
	 * 渲染层拿半截 JSON 做渐进提取，流式期间即可渲染半成品 widget。
	 */
	private translateToolCallDelta(
		inner: Extract<
			Extract<AgentSessionEvent, { type: "message_update" }>["assistantMessageEvent"],
			{ type: "toolcall_delta" }
		>,
	): void {
		const track = this.streamToolCalls.get(inner.contentIndex);
		if (track === undefined) return;

		const block = inner.partial.content[inner.contentIndex];
		// id / name 可能迟到（openai 协议下 toolcall_start 时还是空串、后续回填）：
		// 不稳定就不发，等下一个 delta；整段生成都没等到则由 tool_execution_start 兜底上屏。
		if (block === undefined || block.type !== "toolCall") return;
		if (block.id === "" || block.name === "") return;
		if (!STREAM_CARD_TOOLS.includes(block.name)) return;

		const emit = this.options.emit;
		if (track.emittedId === undefined) {
			track.emittedId = block.id;
			const card: ToolCard = {
				id: block.id,
				role: "tool",
				toolName: block.name,
				// web_search/web_fetch 没有「生成中」语义（WorkBuddy 词汇表里它们
				// 只有执行态标签），直接给执行中标签 —— 执行开始的 tool_started
				// upsert 同一张卡，标签不跳变。write/edit 的 path 还没解析出来，
				// changeType 未知：先按新建给标签，进度事件到达时 reducer 会按
				// 真实 changeType 刷新（生成中→修改中）。
				label:
					block.name === "write" || block.name === "edit"
						? generatingLabel(block.name, "created")
						: runningLabel(block.name),
				summary: "",
				outcome: undefined,
				detail: undefined,
				generating: true,
				at: Date.now(),
			};
			this.toolCards.set(block.id, card);
			emit({ type: "tool_stream_started", card });
		}

		if (block.name === "write") {
			track.rawArgs += inner.delta;
			const progress = writeStreamProgress(track.rawArgs);
			// path 未完整时不发：半截路径上屏像 bug（reducer 端同口径，双保险）。
			if (progress.path !== undefined) {
				// changeType 查一次缓存住：生成期间文件存在性不会变。
				track.changeType ??= existsSync(resolve(this.sessionCwd, progress.path))
					? "modified"
					: "created";
				emit({
					type: "tool_stream_progress",
					id: block.id,
					path: progress.path,
					added: progress.added,
					changeType: track.changeType,
				});
			}
		}

		if (block.name === "show_widget") {
			track.rawArgs += inner.delta;
			emit({
				type: "tool_stream_progress",
				id: block.id,
				// path/added/changeType 是 write 的行数口径，对 show_widget 无意义；
				// 它的进度是参数本体（rawArgs），reducer 见 path===undefined 不动行数。
				path: undefined,
				added: 0,
				changeType: "created",
				rawArgs: track.rawArgs,
			});
		}
	}
}

/** 取消息里的思考内容。没有则返回空串，由调用方决定是否下发。 */
function thinkingOf(content: unknown): string {
	if (!Array.isArray(content)) return "";
	return content
		.filter((part): part is { type: "thinking"; thinking: string } => {
			if (typeof part !== "object" || part === null) return false;
			const p = part as { type?: unknown; thinking?: unknown };
			return p.type === "thinking" && typeof p.thinking === "string";
		})
		.map((part) => part.thinking)
		.join("");
}

/**
 * 非标准角色消息（bashExecution / custom / branchSummary / compactionSummary）
 * 的字符数估算：summary / output 字符串字段优先，退到 content 文本。
 * 只服务于 request_snapshot 的 other 类计数（best-effort，口径见其注释）。
 */
function customMessageChars(message: unknown): number {
	if (typeof message !== "object" || message === null) return 0;
	const m = message as { summary?: unknown; output?: unknown; content?: unknown };
	if (typeof m.summary === "string") return m.summary.length;
	if (typeof m.output === "string") return m.output.length;
	return textOf(m.content).length;
}

/** 供 daemon 判断模型标识是否合法，避免把无效值传进会话。 */
export { parseModelKey };
