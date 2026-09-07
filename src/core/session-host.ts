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
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type {
	SessionEvent,
	SessionState,
	ToolCard,
	ToolOutcome,
} from "../shared/session-events.ts";
import type { LoadedResources } from "./resources.ts";
import type { SkillDescriptor } from "./prompt-composer.ts";
import { getConfigDir, getResourcesDir, getSessionsDir } from "./config-paths.ts";
import type { ModelCatalog } from "./model-catalog.ts";
import { parseModelKey, toModelKey } from "./model-catalog.ts";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

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
 * playground 会话的工具集：一个文件工具都不给。
 *
 * 为什么不只把 cwd 置空就算完事：pi 的内置工具支持绝对路径，
 * 模型给出绝对路径照样能写硬盘任意位置。所以 playground 的安全边界
 * 不是「没有目录」，而是「根本不注册这些工具」——工具不在模型可见的工具
 * 清单里，它连调用都发不出来。
 */
const PLAYGROUND_TOOLS = [] as const;

/**
 * 工具的中文标签与摘要取法。
 *
 * 放在适配层而不是 UI 里：ToolCard 的契约是「label 由上游给定，UI 不做映射」
 * （shared/session-events.ts）。pi 的内置工具没有中文名，这里补上。
 * 未登记的工具（含将来的自定义工具）回落到工具名本身。
 */
const TOOL_LABELS: Readonly<Record<string, string>> = {
	read: "读取文件",
	write: "写入文件",
	edit: "编辑文件",
	find: "查找文件",
	grep: "搜索内容",
	ls: "列出目录",
	bash: "执行命令",
	powershell: "执行命令",
};

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

		const { session } = await createAgentSession({
			cwd,
			agentDir,
			// 复用 ModelCatalog 已建好的 runtime，避免重复读 auth.json / models.json。
			modelRuntime: options.catalog.modelRuntime,
			...(model === undefined ? {} : { model }),
			sessionManager: SessionManager.create(cwd, getSessionsDir()),
			settingsManager,
			resourceLoader,
			tools: playground ? [...PLAYGROUND_TOOLS] : [...DEFAULT_TOOLS],
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
		session.subscribe((event) => host.translate(event));
		return host;
	}

	/* ── 对外操作 ────────────────────────────────────────────────── */

	async prompt(
		text: string,
		whileStreaming?: "steer" | "followUp",
	): Promise<void> {
		if (this.session.isStreaming) {
			// 流式期间直接 prompt 会被 pi 拒绝，必须显式选择排队方式。
			// 默认 steer：用户追加的话通常是想纠偏当前这轮，而不是等它跑完。
			if (whileStreaming === "followUp") await this.session.followUp(text);
			else await this.session.steer(text);
			return;
		}
		await this.session.prompt(text);
	}

	async abort(): Promise<void> {
		await this.session.abort();
	}

	/**
	 * 释放底层会话。切换工作空间时旧会话整个作废——
	 * cwd 在建会话时一次性注入工具集，不存在「换目录继续聊」。
	 */
	dispose(): void {
		this.session.dispose();
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
	 * 只处理 UI 真正需要的那几类；turn_start / turn_end / queue_update /
	 * compaction_* 等一概吞掉（UI 不呈现「轮」与压缩细节）。
	 * 不写 default 分支抛错：pi 会持续新增事件类型，未知类型忽略才是正确行为。
	 */
	private translate(event: AgentSessionEvent): void {
		const emit = this.options.emit;

		switch (event.type) {
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
				emit({ type: "run_finished", runId });
				this.emitState();
				return;
			}

			case "message_start": {
				const message = event.message;

				if (message.role === "user") {
					// 用户消息由 daemon 确认后回显，而不是 UI 乐观插入 ——
					// 排队（steer / followUp）时消息的实际落位与发送顺序可能不同。
					emit({
						type: "user_message",
						message: {
							id: this.nextId("user"),
							role: "user",
							text: textOf(message.content),
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
				const id = this.currentAssistantId;
				if (id === undefined) return;
				const inner = event.assistantMessageEvent;

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
				// toolcall_delta 不上传：工具卡片由 tool_execution_* 事件驱动，
				// 让 UI 只有一个来源，避免两套状态打架。
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
				if (message.errorMessage !== undefined && message.errorMessage !== "") {
					emit({
						type: "run_error",
						runId: this.currentRunId ?? "unknown",
						message: message.errorMessage,
					});
				}
				return;
			}

			case "tool_execution_start": {
				const card: ToolCard = {
					id: event.toolCallId,
					role: "tool",
					toolName: event.toolName,
					label: TOOL_LABELS[event.toolName] ?? event.toolName,
					summary: summarizeArgs(event.args),
					outcome: undefined,
					detail: undefined,
					at: Date.now(),
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
				const outcome: ToolOutcome = event.isError ? "error" : "ok";
				const detail = toolResultText(event.result);

				emit({
					type: "tool_finished",
					card: {
						id: event.toolCallId,
						role: "tool",
						toolName: event.toolName,
						// started 缺失说明漏了 start 事件（理论上不该发生），
						// 回落到工具名而不是编一个假标签。
						label:
							started?.label ?? TOOL_LABELS[event.toolName] ?? event.toolName,
						summary: started?.summary ?? "",
						outcome,
						detail: detail === "" ? undefined : detail,
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
