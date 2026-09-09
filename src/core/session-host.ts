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
 *    turn_start / turn_end 在这里被吞掉，不往上传。
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
	ToolCard,
	ToolOutcome,
} from "../shared/session-events.ts";
import { generatingLabel } from "../shared/session-events.ts";
import type { ImagePart } from "../shared/image.ts";
import {
	changeFromEdit,
	changeFromWrite,
	writeStreamProgress,
	type FileChange,
} from "../shared/artifacts.ts";
import type { LoadedResources } from "./resources.ts";
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
 * 文档流水线本来就全走 Node 自定义工具（AGENTS.md §2），不需要 shell。
 *
 * D4-5 起由 resources/modes/<id>.md 的 frontmatter 驱动，届时本常量退化为兜底。
 */
const DEFAULT_TOOLS = ["read", "write", "edit", "find", "grep", "ls"] as const;

/**
 * playground 会话的工具集：**一个文件工具都不给，只留联网**。
 *
 * 为什么不只把 cwd 置空就算完事：pi 的内置工具支持绝对路径，
 * 模型给出绝对路径照样能写硬盘任意位置。所以 playground 的安全边界
 * 不是「没有目录」，而是「根本不注册这些工具」——工具不在模型可见的工具
 * 清单里，它连调用都发不出来。
 *
 * web_search / web_fetch 是仅有的例外：只读、无路径、不碰本地文件，
 * 且「不选工作空间的问答」正是联网能力的主场景（问新闻、查资料），
 * 不给它即砍掉产品最常用的入口。
 */
const PLAYGROUND_TOOLS = ["web_search", "web_fetch"] as const;

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
	ls: "列出中",
	grep: "搜索中",
	find: "查找中",
	bash: "执行中",
	powershell: "执行中",
	web_search: "搜索中",
	web_fetch: "抓取中",
	present_files: "交付中",
};

const TOOL_DONE_LABELS: Readonly<Record<string, string>> = {
	read: "已读取",
	ls: "已列出",
	grep: "已搜索",
	find: "已查找",
	bash: "已执行",
	powershell: "已执行",
	web_search: "已搜索",
	web_fetch: "已抓取",
	present_files: "已交付",
};

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
		// 其余工具复用 doneLabel 的非 ok 形态：词汇单一来源在 live 路径的
		// label 函数，这里只做分派，不另起映射表（见函数头注释）。
		return doneLabel(toolName, outcome);
	}
	if (toolName === "write") return writeDoneLabel("created", "ok");
	if (toolName === "edit") return writeDoneLabel("modified", "ok");
	return doneLabel(toolName, "ok");
}

/** 从工具入参里挑一个最能说明「在对什么东西操作」的值作为摘要。 */
function summarizeArgs(args: unknown): string {
	if (typeof args !== "object" || args === null) return "";
	const record = args as Record<string, unknown>;
	// 顺序即优先级：路径类最有信息量，其次是查询/命令。
	for (const key of [
		"path",
		"file_path",
		"filePath",
		"pattern",
		"query",
		"command",
		"dir",
	]) {
		const value = record[key];
		if (typeof value === "string" && value !== "") return value;
	}
	// present_files 的 files 是数组：摘要是数量而不是某个路径。
	const files = record.files;
	if (Array.isArray(files)) return `${files.length} 个文件`;
	return "";
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

export interface SessionHostOptions {
	readonly catalog: ModelCatalog;
	/** 选中的模型标识（`provider/model`）。undefined 表示让 pi 自己挑第一个可用的。 */
	readonly modelKey: string | undefined;
	/**
	 * 会话工作目录。playground（不使用工作空间）为 undefined：
	 * 不加载本地文件工具，模型只能做问答。pi 侧的技术 cwd 用配置目录下的
	 * playground 占位目录（资源发现需要真实目录，但绝不作为产物落点）。
	 */
	readonly cwd: string | undefined;
	readonly sceneId: string;
	readonly interactionId: string;
	/**
	 * 是否为 playground 会话（WorkBuddy 的「不使用工作空间」）。
	 * true 时 state.cwd 下发 undefined，且建会话时不注册任何本地文件工具
	 * （PLAYGROUND_TOOLS 为空）——安全边界是「工具不在模型可见清单里」，
	 * 而不是「没有目录」。缺省 false（正式工作空间）。
	 */
	readonly isPlayground?: boolean;
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
}

export class SessionHost {
	/** 自增 id 计数器。比 UUID 好在可预测、日志可读、测试可断言。 */
	private idSeq = 0;
	/** 当前正在流式输出的助手消息 id。message_start 时生成，message_end 时清空。 */
	private currentAssistantId: string | undefined;
	/** 当前 run 的 id，供 run_error / run_finished 关联。 */
	private currentRunId: string | undefined;
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
	 * 会话的技术 cwd（playground 时为配置目录下的占位目录）。
	 * 解析模型给的相对路径、读 write/edit 的旧内容都用它。
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

	private constructor(
		private readonly session: Awaited<
			ReturnType<typeof createAgentSession>
		>["session"],
		private readonly options: SessionHostOptions,
		private sceneId: string,
		private interactionId: string,
		private readonly skills: readonly SkillDescriptor[],
	) {}

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
		 * playground 的技术 cwd：pi 的 DefaultResourceLoader / SettingsManager /
		 * SessionManager 都需要一个真实存在的目录做资源发现，但 playground 语义上
		 * 不绑定任何用户目录。用配置目录下的 playground 占位目录 —— 它在配置目录内，
		 * 权限门本来就禁写，模型也拿不到文件工具，双保险。
		 * 正式工作空间则直接用用户选的目录。
		 */
		const playground = options.isPlayground === true;
		const cwd = playground ? join(agentDir, "playground") : options.cwd;
		if (cwd === undefined) throw new Error("正式工作空间会话必须提供 cwd");
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
		// cwd 用上面算好的值而不是 options.cwd：playground 时是占位目录。
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
		 */
		const mode = options.resources.modes.find((m) => m.id === options.interactionId);
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
			tools: playground
				? [...PLAYGROUND_TOOLS]
				: mode === undefined
					? [...DEFAULT_TOOLS]
					: [...mode.tools],
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
			// 默认 steer：用户追加的话通常是想纠偏当前这轮，而不是等它跑完。
			if (whileStreaming === "followUp") await this.session.followUp(text, piImages);
			else await this.session.steer(text, piImages);
			return;
		}
		await this.session.prompt(text, piImages === undefined ? undefined : { images: piImages });
	}

	async abort(): Promise<void> {
		await this.session.abort();
		// 压缩是独立的模型调用，abort() 管不到它；停止键在压缩期间也必须有效。
		// 无压缩进行时这是 no-op。
		this.session.abortCompaction();
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

	/**
	 * 当前会话文件名。daemon 用它标会话列表的 current、判定 rename/delete
	 * 的目标是不是这个活会话。in-memory 会话为 undefined —— 本应用的会话
	 * 都是持久化的，但 pi 的类型如此，调用方必须处理。
	 */
	get sessionFilePath(): string | undefined {
		return this.session.sessionManager.getSessionFile();
	}

	async setModel(modelKey: string): Promise<void> {
		const model = this.options.catalog.resolveModel(modelKey);
		if (model === undefined) throw new Error("该模型不可用");
		await this.session.setModel(model);
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

	setInteraction(interactionId: string): void {
		const mode = this.options.resources.modes.find(
			(m) => m.id === interactionId,
		);
		if (mode === undefined) throw new Error(`未知的交互模式：${interactionId}`);
		this.interactionId = interactionId;
		this.session.setActiveToolsByName([...mode.tools]);
		this.emitState();
	}

	/** 当前技能描述符，供 daemon 组装提示词的技能段。 */
	get skillDescriptors(): readonly SkillDescriptor[] {
		return this.skills;
	}

	get state(): SessionState {
		const usage = this.session.getContextUsage();
		const model = this.session.model;
		const playground = this.options.isPlayground === true;
		return {
			sessionId: this.session.sessionId,
			// playground 会话不绑定目录（shared/session-events.ts 的字段契约）。
			...(playground ? { cwd: undefined } : { cwd: this.options.cwd }),
			isPlayground: playground,
			sceneId: this.sceneId,
			interactionId: this.interactionId,
			modelId:
				model === undefined ? undefined : toModelKey(model.provider, model.id),
			// 不能透传 pi 的 session.isStreaming：pi 要到 finally 的 _emitAgentSettled
			// 才把它置 false（agent-session.ts:631/1113），agent_end 事件分发时它仍是 true。
			// 曾经透传导致 agent_end 处理中的 emitState 把 isStreaming:true 推给 renderer，
			// 覆盖 run_finished 刚置的 false —— UI 永久卡在「正在思考…」。
			// 用自家的 run 记账：agent_start 置、agent_end 清，时序完全由本文件控制。
			isStreaming: this.currentRunId !== undefined,
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
	 * pi 事件 → 领域事件。
	 *
	 * 用 pi 的真实类型 `AgentSessionEvent` 而不是宽松的 Record —— 这是有意的：
	 * 适配层的价值在于「pi 升级只塌这一个文件，而且响亮地塌」。
	 * 若用 Record + 字符串索引，pi 改字段名（如 toolCallId → toolCallID）
	 * 会照样编译通过，然后工具卡片静默不再渲染 —— 那是最难查的失败方式
	 * （AGENTS.md §7：不写防御性兜底掩盖上游问题）。
	 *
	 * 只处理 UI 真正需要的那几类；turn_start / turn_end / queue_update
	 * 等一概吞掉（UI 不呈现「轮」）。
	 * 不写 default 分支抛错：pi 会持续新增事件类型，未知类型忽略才是正确行为。
	 */
	private translate(event: AgentSessionEvent): void {
		const emit = this.options.emit;

		switch (event.type) {
			case "compaction_start": {
				// run 内的自动压缩（threshold/overflow）：流式态由原 run 覆盖，不动记账。
				if (this.currentRunId !== undefined) return;
				// 空闲时的压缩（手动）：压缩要调模型写摘要，复用 run 记账让 UI
				// 进入流式态（禁输入、出停止键），否则用户以为卡死了。
				const runId = this.nextId("run");
				this.currentRunId = runId;
				emit({ type: "run_started", runId });
				this.emitState();
				return;
			}

			case "compaction_end": {
				// willRetry 表示压缩后自动续跑被中断的那轮：流式态归原 run 与后续
				// agent 事件管，这里不动（同 agent_end 的 willRetry 处理）。
				if (event.willRetry) return;
				const runId = this.currentRunId;
				if (runId === undefined) return;
				this.currentRunId = undefined;
				if (!event.aborted && event.errorMessage === undefined) {
					emit({ type: "run_finished", runId, outcome: "completed" });
				} else {
					emit({
						type: "run_error",
						runId,
						message: event.errorMessage ?? "上下文压缩已中断",
					});
				}
				this.emitState();
				return;
			}

			case "agent_start": {
				const runId = this.nextId("run");
				this.currentRunId = runId;
				emit({ type: "run_started", runId });
				this.emitState();
				return;
			}

			case "agent_end": {
				// willRetry 表示 pi 正在自动重试，这一轮还没真结束。
				// 此时发 run_finished 会让 UI 提前解禁输入框、然后又被下一轮锁住。
				if (event.willRetry) return;
				const runId = this.currentRunId ?? this.nextId("run");
				this.currentRunId = undefined;
				this.currentAssistantId = undefined;
				this.streamToolCalls.clear();
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
				emit({ type: "run_finished", runId, outcome: cancelled ? "cancelled" : "completed" });
				this.emitState();
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
				emit({
					type: "user_message",
					message: {
						id: this.nextId("user"),
						role: "user",
						text,
						// 无图不带字段：UserMessage.images 是可选契约，UI 按缺省渲染。
						...(images === undefined ? {} : { images }),
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

				const id = this.currentAssistantId;
				if (id === undefined) return;

				if (inner.type === "text_delta") {
					emit({
						type: "assistant_text_delta",
						messageId: id,
						delta: inner.delta,
					});
				} else if (inner.type === "thinking_delta") {
					emit({
						type: "assistant_thinking_delta",
						messageId: id,
						delta: inner.delta,
					});
				}
				// 其余 inner 事件（text_start/end、thinking_start/end、done…）不上传：
				// 正文与思考靠 delta + assistant_done 终态校正，边界事件对 UI 无信息量。
				return;
			}

			case "message_end": {
				const message = event.message;
				if (message.role !== "assistant") return;

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
						// 聊天 UI 不展示。pi 的 Usage 止步于此，出口是 shared 的 TokenUsage。
						usage: {
							input: message.usage.input,
							output: message.usage.output,
							cacheRead: message.usage.cacheRead,
							cacheWrite: message.usage.cacheWrite,
							totalTokens: message.usage.totalTokens,
							cost: message.usage.cost.total,
						},
						at: message.timestamp,
					},
				});

				// 模型侧报错（超限、内容策略、网关故障）不会走 agent_end 的异常路径，
				// 只体现在消息的 errorMessage 上。不单独提示的话用户只会看到空回复。
				// stopReason "aborted" 除外：那是用户取消，pi 的收尾消息同样带
				// errorMessage（如 "Request was aborted"），但取消不是错误 ——
				// 终态由 agent_end 的 run_finished cancelled 表达，再发 run_error
				// 会多出一条吓人的错误气泡。
				if (
					message.errorMessage !== undefined &&
					message.errorMessage !== "" &&
					message.stopReason !== "aborted"
				) {
					emit({
						type: "run_error",
						runId: this.currentRunId ?? "unknown",
						message: message.errorMessage,
					});
				}
				return;
			}

			case "tool_execution_start": {
				// 生成阶段已上屏的同 id 卡片会被 reducer 原位翻转（upsert）；
				// at 沿用生成开始的时间 —— 卡片的寿命从「开始生成」算起，不是「开始执行」。
				const existing = this.toolCards.get(event.toolCallId);

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
					summary: summarizeArgs(event.args),
					outcome: undefined,
					detail: undefined,
					at: existing?.at ?? Date.now(),
				};
				this.toolCards.set(event.toolCallId, card);
				emit({ type: "tool_started", card });
				return;
			}

			case "tool_execution_update": {
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
						// 失败的写入不产生变更（文件可能只写了一半，统计会误导）。
						...(outcome === "ok" && stash?.change !== undefined ? { change: stash.change } : {}),
						at: started?.at ?? Date.now(),
					},
				});
				return;
			}

			case "thinking_level_changed":
			case "session_info_changed":
				this.emitState();
				return;
		}
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
	 * 只有 write/edit 有生成中卡片 —— 它们的参数里就是文件内容，生成阶段几十秒；
	 * 其余工具参数小（一个路径/一个词），生成转瞬即逝，卡片等执行态再上
	 * （WorkBuddy 同：listFile/readFile 的卡片只有 列出中/读取中 执行态标签）。
	 *
	 * write 额外发行数进度（「生成中 +N」的 N 从这里来）。edit 不发 ——
	 * 它的参数是嵌套的 edits 数组，流式数行要维护部分 JSON 解析状态机，
	 * 成本高收益低，生成中只显示卡片本身（event 注释里也是这个口径）。
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
		if (block.name !== "write" && block.name !== "edit") return;

		const emit = this.options.emit;
		if (track.emittedId === undefined) {
			track.emittedId = block.id;
			const card: ToolCard = {
				id: block.id,
				role: "tool",
				toolName: block.name,
				// path 还没解析出来，changeType 未知：先按新建给标签，
				// 进度事件到达时 reducer 会按真实 changeType 刷新（生成中→修改中）。
				label: generatingLabel(block.name, "created"),
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

/** 供 daemon 判断模型标识是否合法，避免把无效值传进会话。 */
export { parseModelKey };
