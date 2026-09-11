/**
 * 任务对话页：消息流 + 底部输入。
 *
 * 视觉延续首页的输入卡，保证「首页发一句话 → 进入对话页」过渡不突兀。
 * 消息渲染基于 shared/conversation.ts 折叠出的 entries 视图。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ConversationView } from "@shared/conversation.ts";
import { formatSize } from "@shared/format-size.ts";
import type { ImagePart } from "@shared/image.ts";
import type { ExpertListItem, QuestionnaireAnswer, QuestionnaireRequest } from "@shared/ipc.ts";
import { formatMessageTime } from "@shared/message-time.ts";
import { buildRenderBlocks } from "@shared/metafold.ts";
import type { RenderBlock } from "@shared/metafold.ts";
import type { ConversationEntry, ModeDescriptor, RunId, TodoItem, ToolCard, TurnTiming } from "@shared/session-events.ts";
import { WAITING_SOOTHED_TEXT, WAITING_TIPS } from "@shared/waiting-tips.ts";
import {
	IconAlert,
	IconBack,
	IconCheck,
	IconChevronDown,
	IconClipboard,
	IconCode,
	IconCopy,
	IconDoc,
	IconEdit,
	IconFolder,
	IconMic,
	IconResearch,
	IconSkill,
	IconAssistant,
	IconWeb,
} from "./icons.tsx";
import { Composer } from "./composer.tsx";
import type { ComposerHandle } from "./composer.tsx";
import { ContextUsageRing } from "./context-usage.tsx";
import { useCopyWithTick } from "./copy-tick.ts";
import { imageDataUrl } from "./image-attachments.tsx";
import { useImeGuard } from "./ime-guard.ts";
import { ModelMenu } from "./model-menu.tsx";
import { PermissionMenu } from "./permission-menu.tsx";
import { PlusMenu } from "./plus-menu.tsx";
import { QuestionnaireDialog } from "./questionnaire-dialog.tsx";
import { Markdown } from "./markdown.tsx";
import { activePendingAlign, decideScrollAction, groupTurnBlocks } from "./send-anchor.ts";
import type { PendingSentAlign } from "./send-anchor.ts";
import { thinkingOpen, toggleThinking } from "./thinking-fold.ts";
import { projectTodoList, windowTodos } from "./todo-projection.ts";
import { TurnRail } from "./turn-rail.tsx";
import type { ThinkingFoldOverride } from "./thinking-fold.ts";
import { FAILED_ICON, toolIconOf } from "./tool-icon-registry.ts";
import { WidgetView } from "./widget-view.tsx";

interface ChatViewProps {
	readonly conversation: ConversationView;
	readonly ready: boolean;
	/** 提交失败的原因（如未选模型），显示在消息流末尾。 */
	readonly lastError: string | undefined;
	readonly title: string;
	readonly onBack: () => void;
	/**
	 * 提交（文本 + 可选图片附件）。resolve 表示 daemon 已接收；
	 * 附件据此决定去留（失败保留在输入区，见 submit）。
	 */
	readonly onSubmit: (text: string, images?: readonly ImagePart[]) => Promise<void>;
	readonly onAbort: () => void;
	readonly onInteractionChange: (interactionId: string) => void;
	/** 专家列表（头部 ModeSwitch 的「专家 ▸」子菜单与当前专家显示的数据源，App 层统一下发）。 */
	readonly experts: readonly ExpertListItem[];
	readonly onSelectExpert: (expertId: string) => void;
	/** 点击产物卡片：在右侧面板预览（面板里有外部打开入口）。 */
	readonly onPreviewArtifact: (path: string) => void;
	/** 点击正文行内 code 的路径徽章：App 决定面板预览还是外部打开。 */
	readonly onPathClick: (path: string, kind: "file" | "directory") => void;
	/** 产物/变更聚合入口：打开预览面板并展开概览菜单对应分组。 */
	readonly onOpenPanelGroup: (group: "artifacts" | "changes") => void;
	/** 打开设置页（权限弹层的「打开设置…」入口，与 home-view 同语义）。 */
	readonly onOpenSettings: () => void;
	/** 就地轻提示（附件格式/大小被拒等），与 home-view 的 onError 同语义。 */
	readonly onError: (message: string) => void;
	/**
	 * 临时任务转正（保存到工作空间）。resolve = 转正完成（成功 toast 由 App 给）；
	 * reject 的 message 是 daemon 的校验原因，命名弹层原位透出。
	 */
	readonly onSaveToWorkspace: (name: string) => Promise<void>;
	readonly onTodo: (feature: string) => void;
	/**
	 * 当前会话的待答问卷（App 按 sessionId 路由后下发；undefined = 无）。
	 * WorkBuddy CBChat 的 hasQuestionFloating 语义：答题期间输入区让位，
	 * 问卷浮层渲染在 composer 位置。可选 —— App 侧接线落地前不传入，
	 * 维持只渲染 composer 的现状。
	 */
	readonly pendingQuestionnaire?: QuestionnaireRequest;
	readonly onQuestionnaireSubmit?: (answers: readonly QuestionnaireAnswer[]) => void;
	readonly onQuestionnaireSkip?: () => void;
}

/* ── 思考块 ────────────────────────────────────────────────────── */

/**
 * 思考内容块。对标 WorkBuddy 的「深度思考」形态：
 * 流式期间默认展开（标题扫光，chevron 隐藏），该条消息完成后自动收起
 * 成一行标题（停扫光、chevron 出现）；用户手动开合优先于自动行为。
 * 折叠状态机在 thinking-fold.ts（纯函数，可单测），这里只持有用户偏好。
 */
function ThinkingBlock({
	text,
	streaming,
}: {
	readonly text: string;
	/** 本条助手消息是否还在流式（assistant_done 后为 false）。 */
	readonly streaming: boolean;
}): React.JSX.Element {
	const [override, setOverride] = useState<ThinkingFoldOverride>(undefined);
	const open = thinkingOpen(streaming, override);

	return (
		<div className="thinking-block">
			<button
				type="button"
				className="thinking-head"
				onClick={() => setOverride((v) => toggleThinking(streaming, v))}
			>
				{/* WorkBuddy：进行中标题扫光，完成后 chevron 才出现 —— 扫光与 chevron 互斥。 */}
				{!streaming && (
					<IconChevronDown size={11} className={open ? "thinking-caret open" : "thinking-caret"} />
				)}
				<span className={streaming ? "text-shimmer" : ""}>深度思考</span>
			</button>
			{open && <pre className="thinking-body">{text}</pre>}
		</div>
	);
}

/* ── 用户消息气泡 ────────────────────────────────────────────────── */

/**
 * 用户消息气泡（对标 WorkBuddy）：右侧浅色气泡，hover 时下方浮现工具条
 * （时间戳 + 复制）。工具条常驻占位、只切透明度 —— 若 hover 才插入 DOM，
 * 每次划过都会推动下方消息流抖动，长对话里非常刺眼。
 */
function UserBubble({
	entryId,
	text,
	at,
	images,
}: {
	/** 刻度轨（TurnRail）的测量锚点：data-entry-id 落在根 div 上。 */
	readonly entryId: string;
	readonly text: string;
	readonly at: number;
	/** 本条消息携带的图片附件（仅 UI 展示；进模型的翻译在 daemon 侧）。 */
	readonly images?: readonly ImagePart[];
}): React.JSX.Element {
	const { copied, copy } = useCopyWithTick();
	// 点击放大的那张图；undefined = 预览关闭。MVP 不做轮播/缩放（YAGNI）。
	const [preview, setPreview] = useState<ImagePart | undefined>(undefined);

	return (
		<div className="entry user" data-entry-id={entryId}>
			<div className="user-bubble">
				{text}
				{images !== undefined && images.length > 0 && (
					// key 用下标与 AttachmentStrip 同口径：列表项无本地状态，src 是同步解码的 data URL。
					<div className="user-bubble-images">
						{images.map((part, index) => (
							<img
								key={index}
								src={imageDataUrl(part)}
								alt=""
								draggable={false}
								onClick={() => setPreview(part)}
							/>
						))}
					</div>
				)}
			</div>
			<div className="entry-toolbar entry-toolbar-right">
				<span className="user-time">{formatMessageTime(at, Date.now())}</span>
				<button
					type="button"
					className="entry-icon-btn"
					aria-label="复制消息内容"
					title={copied ? "已复制" : "复制"}
					onClick={() => void copy(text)}
				>
					{copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
				</button>
			</div>
			{preview !== undefined && (
				// 全屏遮罩显示大图，点击任意处（含大图本身）关闭。
				<div className="image-preview-overlay" onClick={() => setPreview(undefined)}>
					<img src={imageDataUrl(preview)} alt="" draggable={false} />
				</div>
			)}
		</div>
	);
}

/* ── 助手消息操作条 ──────────────────────────────────────────────── */

/**
 * 助手回答底部的操作条（对标 WorkBuddy 的 assistant 消息操作条）。
 * 与用户气泡工具条同款「常驻占位、hover 切透明度」模式（.entry-toolbar），理由相同：
 * hover 才插入 DOM 会推搡下方消息流。流式中的末条也渲染 —— 复制部分内容无害。
 *
 * 「执行计划」是 plan→craft 的衔接入口：plan 模式产出的计划只在末条
 * assistant 消息上给这个按钮（历史消息不给，否则满屏按钮）。
 */
function AssistantActions({
	text,
	showExecutePlan,
	onExecutePlan,
}: {
	readonly text: string;
	/** 是否显示「执行计划」（父组件按 plan 模式 + 非流式 + 末条判定）。 */
	readonly showExecutePlan: boolean;
	readonly onExecutePlan: () => void;
}): React.JSX.Element {
	const { copied, copy } = useCopyWithTick();

	return (
		<div className="entry-toolbar entry-toolbar-left">
			{showExecutePlan && (
				<button type="button" className="assistant-execute" onClick={onExecutePlan}>
					执行计划
				</button>
			)}
			<button
				type="button"
				className="entry-icon-btn"
				aria-label="复制回答"
				title={copied ? "已复制" : "复制回答"}
				onClick={() => void copy(text)}
			>
				{copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
			</button>
		</div>
	);
}

/* ── 错误卡 ────────────────────────────────────────────────────── */

/**
 * 结构化错误报告（复制内容）：排障时需要的一组字段一次带走，
 * 比让用户逐行手抄 runId 可靠。runId / 模型缺省时整行略去，
 * 时间缺省（提交失败未落库）时取复制当下。
 */
function buildErrorReport(message: string, runId: RunId | undefined, at: number, modelId: string | undefined): string {
	const lines = [`错误信息: ${message}`];
	if (runId !== undefined) lines.push(`runId: ${runId}`);
	lines.push(`时间: ${new Date(at).toISOString()}`);
	if (modelId !== undefined) lines.push(`模型: ${modelId}`);
	return lines.join("\n");
}

/**
 * 内嵌错误卡（机制对标 WorkBuddy）：run 异常结束或提交失败时落在消息流里，
 * 错误图标 + 可折行的标题 + runId 区（复制结构化报告）+ 重试实心按钮。
 * 重试 = 重发最后一条 user 消息；没有可重发的消息时按钮隐藏。
 * 卡片是历史的一部分：新回合开始后留在原位（ErrorEntry 不挪位）。
 */
function ErrorCard({
	message,
	runId,
	at,
	modelId,
	retryText,
	onRetry,
}: {
	readonly message: string;
	/** 出错的 run；提交失败（未进入 run）时没有，runId 区整块不渲染。 */
	readonly runId?: RunId;
	/** 错误落库时间；缺省时报告取复制当下的时间。 */
	readonly at?: number;
	readonly modelId: string | undefined;
	/** 最后一条 user 消息正文；undefined 时隐藏重试按钮。 */
	readonly retryText: string | undefined;
	readonly onRetry: () => void;
}): React.JSX.Element {
	const { copied, copy } = useCopyWithTick();

	return (
		<div className="error-card">
			<div className="error-card-head">
				<IconAlert size={16} className="error-card-icon" />
				<span className="error-card-title">{message}</span>
			</div>
			{runId !== undefined && (
				<div className="error-card-meta">
					<span className="error-card-runid">runId: {runId}</span>
					<button
						type="button"
						className="error-card-copy"
						aria-label="复制错误报告"
						title={copied ? "已复制" : "复制错误报告"}
						onClick={() => void copy(buildErrorReport(message, runId, at ?? Date.now(), modelId))}
					>
						{copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
					</button>
				</div>
			)}
			{retryText !== undefined && (
				<button type="button" className="error-card-retry" onClick={onRetry}>
					重试
				</button>
			)}
		</div>
	);
}

/* ── 工具卡片 ────────────────────────────────────────────────────── */

/** 执行状态 → 状态点样式类。undefined 表示还在跑。 */
function outcomeClass(outcome: ToolCard["outcome"]): string {
	if (outcome === undefined) return "running";
	return outcome === "ok" ? "ok" : "bad";
}

/**
 * 单张工具卡片，折叠态只显示一行摘要。
 *
 * 默认折叠：一次任务可能调十几次工具，全展开会把助手的结论冲掉，
 * 而用户真正要看的是结论。WorkBuddy 的主提示词里也明确写了
 * 「中间过程在 UI 被折叠」，是同一个考虑。
 */
function ToolEntry({ card }: { readonly card: ToolCard }): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const expandable = card.detail !== undefined && card.detail !== "";
	// 执行中（outcome 未落定）或生成中（write 参数还在流式输出）→ 状态字扫光；
	// 完成后摘类回归静态 —— 扫光是全局唯一「进行中」语言（对标 WorkBuddy）。
	const running = card.outcome === undefined || card.generating === true;
	// 失败与 tool-dot.bad 同口径（outcome 落定且非 ok，含被拦/被取消）：
	// 换成失败状态图标，不再显示工具类型图标（状态图标与类型图标分属两套，WorkBuddy 同构）。
	const failed = card.outcome !== undefined && card.outcome !== "ok";
	const ToolIcon = failed ? FAILED_ICON : toolIconOf(card.toolName);

	return (
		<div className="entry tool">
			<button
				type="button"
				className="tool-head"
				disabled={!expandable}
				title={expandable ? (open ? "收起" : "展开详情") : undefined}
				onClick={() => setOpen((v) => !v)}
			>
				<span className={`tool-dot ${outcomeClass(card.outcome)}`} />
				{/* 工具类型图标按 toolName 从 registry 解析；执行中隐藏 ——
				    进行中状态全靠呼吸点 + 扫光状态字表达（WorkBuddy 同款）。 */}
				{!running && <ToolIcon size={14} className={failed ? "tool-icon failed" : "tool-icon"} />}
				{/* 标签是状态词（生成中/已生成/读取中/已读取…），由适配层按
				    WorkBuddy 词汇表给出，UI 不做映射（契约见 session-events.ts）。 */}
				<span className={running ? "tool-label text-shimmer" : "tool-label"}>{card.label}</span>
				<span className="tool-summary">{card.summary}</span>
				{/* write/edit 的增删行徽章（对标 WorkBuddy 的「+276 -0」）。
				    生成中是流式实时计数，执行成功后是终值，同一个字段两个口径。 */}
				{card.change !== undefined && (
					<span className="tool-change">
						<span className="added">+{card.change.added}</span>
						<span className="removed">-{card.change.removed}</span>
					</span>
				)}
				{expandable && <IconChevronDown size={12} className={open ? "tool-caret open" : "tool-caret"} />}
			</button>
			{/* 详情盒常驻 DOM、open 类切换：条件挂载下元素挂载即终态，
			    CSS 过渡无从起跳，折叠展开动画必须有一个始终在树的元素。 */}
			{expandable && <pre className={open ? "tool-detail-box open" : "tool-detail-box"}>{card.detail}</pre>}
		</div>
	);
}

/* ── 任务清单卡（todo_write） ────────────────────────────────────── */

/**
 * 清单行：状态 glyph + 文字（WorkBuddy cr-tool-plan-task__row 同构）。
 * in_progress 显示 activeForm（进行态措辞）替代 content 且加粗；
 * completed 删除线灰化；pending 空心圆环。
 */
function TodoRow({ todo }: { readonly todo: TodoItem }): React.JSX.Element {
	if (todo.status === "completed") {
		return (
			<div className="todo-row">
				<span className="todo-glyph">
					<IconCheck size={14} className="todo-check" />
				</span>
				<span className="todo-text done">{todo.content}</span>
			</div>
		);
	}
	if (todo.status === "in_progress") {
		return (
			<div className="todo-row running">
				<span className="todo-glyph">
					<span className="todo-spinner" />
				</span>
				<span className="todo-text">{todo.activeForm ?? todo.content}</span>
			</div>
		);
	}
	return (
		<div className="todo-row">
			<span className="todo-glyph">
				<span className="todo-ring" />
			</span>
			<span className="todo-text">{todo.content}</span>
		</div>
	);
}

/**
 * todo_write 的任务清单卡（WorkBuddy cr-tool-plan-task 同构）。
 *
 * 与 ToolEntry 的定位差异：普通工具卡是「过程记录」，默认折叠成一行摘要；
 * 清单卡是「活的状态面板」—— 投影（todo-projection.ts）保证它恒为最新
 * 全量，所以它是消息流最新内容时默认展开、落在历史位置时默认折叠；
 * 用户手动开合优先于默认规则（点过一次就不再跟随 defaultOpen）。
 */
function TodoListCard({
	card,
	defaultOpen,
}: {
	readonly card: ToolCard;
	/** 该卡是消息流最后一条 entry 时默认展开（进度面板紧跟当前进展）。 */
	readonly defaultOpen: boolean;
}): React.JSX.Element {
	const [override, setOverride] = useState<boolean | undefined>(undefined);
	const open = override ?? defaultOpen;
	// 接收中 = 参数还在流式输出、todos 尚未解析出（投影保留 generating 的
	// 语义见 todo-projection.ts）：展开体只有一行占位，不解析半截 JSON。
	const receiving = card.generating === true && card.todos === undefined;
	const todos = card.todos;

	return (
		<div className="entry tool">
			<button
				type="button"
				className="tool-head"
				title={open ? "收起" : "展开"}
				onClick={() => setOverride((v) => !(v ?? defaultOpen))}
			>
				<IconClipboard size={14} className="tool-icon" />
				<span className={receiving ? "tool-label text-shimmer" : "tool-label"}>{card.label}</span>
				<IconChevronDown size={12} className={open ? "tool-caret open" : "tool-caret"} />
			</button>
			{/* 展开盒复用 tool-detail-box 的开合机制（常驻 DOM + 类切换，理由见
			    ToolEntry 注释）；todo-list-box 只覆盖排版与底色（清单是文本行，
			    不是等宽输出）。 */}
			<div className={open ? "tool-detail-box todo-list-box open" : "tool-detail-box todo-list-box"}>
				{receiving ? (
					<div className="todo-placeholder">接收中…</div>
				) : todos === undefined || todos.length === 0 ? (
					// 收尾清空（todos: []）也是有效全量：灰字一行交代，不留空盒。
					<div className="todo-placeholder">清单已清空</div>
				) : (
					<div className="todo-list">
						{windowTodos(todos).map((todo, index) => <TodoRow key={index} todo={todo} />)}
					</div>
				)}
			</div>
		</div>
	);
}

/* ── MetaFold 过程折叠 ───────────────────────────────────────────── */

/**
 * 折叠行行首主导图标的工具名 → 图标映射。fold.leadIcon 在 shared 层
 * （metafold.ts）只是工具名 —— 图标是渲染资产，不能逆流进 shared（§1）。
 * bash/powershell 在此汇合为同一终端图标（metafold 侧二者拆开计数，
 * 视觉仍一致）。未知工具（如 MCP 工具）兜底 IconSkill。
 */
const FOLD_LEAD_ICONS: Readonly<Record<string, typeof IconDoc>> = {
	read: IconDoc,
	write: IconEdit,
	edit: IconEdit,
	ls: IconFolder,
	grep: IconResearch,
	find: IconResearch,
	bash: IconCode,
	powershell: IconCode,
	web_search: IconWeb,
	web_fetch: IconWeb,
	present_files: IconDoc,
};

/**
 * 一个折叠单元：回合结束后连续工具卡折成的一行摘要（机制对标 WorkBuddy）。
 *
 * 长任务一次调十几次工具，平铺会把助手的最终回答顶出视野；折成一行后
 * 回答紧邻摘要可见。展开状态由父组件按折叠单元 id 记住（Map）——
 * 块流每次渲染由纯函数重算，组件若自持状态会随块重建丢失。
 * 展开后内容就是原 ToolEntry 列表，卡片自身的展开/详情行为不变。
 */
function MetaFoldBlock({
	leadIcon,
	summary,
	cards,
	open,
	onToggle,
}: {
	readonly leadIcon: string;
	readonly summary: string;
	readonly cards: readonly ToolCard[];
	readonly open: boolean;
	readonly onToggle: () => void;
}): React.JSX.Element {
	const LeadIcon = FOLD_LEAD_ICONS[leadIcon] ?? IconSkill;
	return (
		<div className="metafold">
			<button
				type="button"
				className={open ? "metafold-row open" : "metafold-row"}
				title={open ? "收起过程" : "展开过程"}
				onClick={onToggle}
			>
				<LeadIcon size={16} className="metafold-lead" />
				<span className="metafold-summary">{summary}</span>
				<IconChevronDown size={12} className="metafold-caret" />
			</button>
			{/* 折叠体常驻 DOM（理由同 ToolEntry 详情盒）。高度动画走
			    grid-template-rows 0fr↔1fr：卡片数不定、内层工具详情还会
			    再展开，max-height 的固定上限方案在这里必然裁内容。 */}
			<div className={open ? "metafold-body open" : "metafold-body"}>
				<div className="metafold-body-inner">
					{cards.map((card) => <ToolEntry key={card.id} card={card} />)}
				</div>
			</div>
		</div>
	);
}

/* ── 流式状态行 ──────────────────────────────────────────────────── */

/**
 * 流式期间底部状态行的文案（WorkBuddy 的 progress.phase 同位置）。
 *
 * 它的阶段机：model_requesting（等待模型响应）→ model_streaming（生成回复中，
 * 写文件时是 正在写入文件/正在编辑文件）→ tool_executing.<Tool>（正在读取文件…）。
 * 我们从 entries 末尾反推同样的阶段：最近一张未完成的工具卡决定工具阶段，
 * 否则按消息流位置区分「等响应」与「生成中」。
 */
function pendingText(entries: readonly ConversationEntry[]): string {
	for (let i = entries.length - 1; i >= 0; i -= 1) {
		const entry = entries[i];
		if (entry === undefined) break;
		if (entry.role === "tool") {
			if (entry.outcome !== undefined) return "生成回复中";
			// 未完成：生成阶段（generating）与执行阶段同文案（WorkBuddy 两边都是「正在写入文件」）。
			switch (entry.toolName) {
				case "write":
					return entry.summary === "" ? "正在写入文件…" : `正在写入文件 ${entry.summary}…`;
				case "edit":
					return entry.summary === "" ? "正在编辑文件…" : `正在编辑文件 ${entry.summary}…`;
				case "read":
					return "正在读取文件…";
				case "ls":
					return "正在列出目录…";
				case "grep":
					return "正在搜索内容…";
				case "find":
					return "正在查找文件…";
				case "bash":
				case "powershell":
					return "正在执行命令…";
				default:
					return "正在处理…";
			}
		}
		if (entry.role === "assistant") return "生成回复中";
		if (entry.role === "user") return "等待模型响应…";
	}
	return "等待模型响应…";
}

/* ── 等待首响应：安抚文案 + tips 轮播 ────────────────────────────── */

/** 等待 4s 后出现首条 tip；等待 8s 主文案切换安抚文案；tip 每 10s 轮换。 */
const TIP_SHOW_DELAY_MS = 4_000;
const SOOTHE_DELAY_MS = 8_000;
const TIP_ROTATE_MS = 10_000;

/**
 * 随机取下一条 tip 的下标，保证不与当前条重复（机制对齐 WorkBuddy）。
 * 在 size-1 个候选里均匀取偏移量再绕环，比「抽到重复就重抽」干净。
 */
function nextTipIndex(size: number, current: number | undefined): number {
	if (size <= 1 || current === undefined) return Math.floor(Math.random() * size);
	return (current + 1 + Math.floor(Math.random() * (size - 1))) % size;
}

/**
 * 等待模型首响应阶段的状态行（最后一条 entry 是 user 时才有意义）。
 *
 * 机制对齐 WorkBuddy：主文案扫光；4s 后右侧出现「| + 一条随机 tip」，
 * 每 10s 换一条（不重复），hover/focus 暂停轮换，× 关闭后本次会话不再出现；
 * 等待超过 8s 主文案切换安抚文案。模型开始响应后整条随状态行一起消失 ——
 * 本组件只在等待阶段挂载，无残留。
 *
 * dismissed 由父组件持有：同一回合内阶段切换（等待→生成→工具→等待）会
 * 重挂本组件，而「关闭后本次会话不再出现」是会话级承诺，不能随重挂复位。
 */
function WaitingPendingLine({
	dismissed,
	onDismiss,
}: {
	readonly dismissed: boolean;
	readonly onDismiss: () => void;
}): React.JSX.Element {
	const [tipShown, setTipShown] = useState(false);
	const [soothed, setSoothed] = useState(false);
	const [tipIndex, setTipIndex] = useState(() => nextTipIndex(WAITING_TIPS.length, undefined));
	const [paused, setPaused] = useState(false);

	// 一次性计时：4s 出首条 tip、8s 切安抚文案。只在等待阶段计时（组件随阶段挂载）。
	useEffect(() => {
		const tipTimer = window.setTimeout(() => setTipShown(true), TIP_SHOW_DELAY_MS);
		const sootheTimer = window.setTimeout(() => setSoothed(true), SOOTHE_DELAY_MS);
		return () => {
			window.clearTimeout(tipTimer);
			window.clearTimeout(sootheTimer);
		};
	}, []);

	// 轮换：恢复（hover 结束）后重新计满 10s，比补剩余时间简单且观感一致。
	useEffect(() => {
		if (!tipShown || dismissed || paused) return;
		const timer = window.setInterval(() => {
			setTipIndex((current) => nextTipIndex(WAITING_TIPS.length, current));
		}, TIP_ROTATE_MS);
		return () => window.clearInterval(timer);
	}, [tipShown, dismissed, paused]);

	const showTip = tipShown && !dismissed;
	return (
		<div className="stream-pending">
			<span className="text-shimmer">{soothed ? WAITING_SOOTHED_TEXT : "等待模型响应…"}</span>
			{showTip && (
				<span
					className="pending-tip"
					onMouseEnter={() => setPaused(true)}
					onMouseLeave={() => setPaused(false)}
					onFocus={() => setPaused(true)}
					onBlur={() => setPaused(false)}
				>
					<span className="pending-tip-sep" aria-hidden="true">
						|
					</span>
					{WAITING_TIPS[tipIndex]}
					<button
						type="button"
						className="pending-tip-close"
						aria-label="不再显示提示"
						title="不再显示提示"
						onClick={onDismiss}
					>
						×
					</button>
				</span>
			)}
		</div>
	);
}

/* ── 回合头部（已处理时长） ──────────────────────────────────────── */

/** 时长格式化：WorkBuddy「已处理 *m*s」口径（41s / 2m3s）。 */
function formatDuration(ms: number): string {
	const totalSec = Math.max(0, Math.floor(ms / 1000));
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return m === 0 ? `${s}s` : `${m}m${s}s`;
}

/**
 * 回合头部：agent 名 + 计时（WorkBuddy 同位置：名字下挂「已处理 41s」）。
 *
 * 进行中每 500ms 走表（与 WorkBuddy 的刷新精度一致）；回合结束或
 * 历史回合显示「已完成」。计时起点是用户消息落库时间，不是首个 token ——
 * 排队/检索的时间也计入，与其口径一致。
 *
 * turn 只传给当前回合的头部（历史回合没有计时数据）：被取消的当前回合
 * 定格「已取消 Ns」（endedAt - startedAt），与正常结束的「已完成」区分 ——
 * 中断是用户主动动作，UI 上必须看得出（机制对标 WorkBuddy 的取消终态）。
 */
function TurnHeader({
	active,
	turn,
}: {
	readonly active: boolean;
	readonly turn: TurnTiming | undefined;
}): React.JSX.Element {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		const timer = window.setInterval(() => setNow(Date.now()), 500);
		return () => window.clearInterval(timer);
	}, [active]);

	let duration = "已完成";
	if (active && turn?.startedAt !== undefined) {
		duration = `已处理 ${formatDuration(now - turn.startedAt)}`;
	} else if (turn?.cancelled === true && turn.endedAt !== undefined) {
		duration = `已取消 ${formatDuration(turn.endedAt - turn.startedAt)}`;
	}

	return (
		<div className="turn-header">
			<div className="turn-avatar" aria-hidden="true">
				<IconAssistant size={16} />
			</div>
			<div className="turn-meta">
				<span className="turn-agent">嘉立创Work</span>
				<span className="turn-duration">{duration}</span>
			</div>
		</div>
	);
}

/* ── 交互模式切换 ────────────────────────────────────────────────── */

interface ModeSwitchProps {
	readonly interactions: readonly ModeDescriptor[];
	readonly currentId: string;
	readonly onChange: (id: string) => void;
	/** 专家列表与当前专家（「专家 ▸」子菜单数据源），与 PlusMenu 同源（App 层统一下发）。 */
	readonly experts: readonly ExpertListItem[];
	readonly expertId: string | undefined;
	readonly onSelectExpert: (expertId: string) => void;
	readonly onTodo: (feature: string) => void;
}

/** 交互轴切换（ask / craft / plan / expert），对标 WorkBuddy 的 interactionmode。 */
function ModeSwitch({
	interactions,
	currentId,
	onChange,
	experts,
	expertId,
	onSelectExpert,
	onTodo,
}: ModeSwitchProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	// 「专家」子菜单的开合独立持有：hover 或点击都可达（触屏没有 hover，同 PlusMenu 约定）。
	const [expertsOpen, setExpertsOpen] = useState(false);
	const current = interactions.find((m) => m.id === currentId);
	const currentExpert = expertId === undefined ? undefined : experts.find((e) => e.name === expertId);

	const toggle = (): void => {
		setOpen((v) => !v);
		// 主菜单开合都复位子菜单：下次重开从「专家」行开始，而不是残留展开态（同 ModelMenu 约定）。
		setExpertsOpen(false);
	};

	// expert 不裸列（无专家的 expert 模式不可达，spec: add-expert-mode）——
	// 三模式平铺，「专家 ▸」行挂子菜单列具体专家，选中即进 expert 模式。
	const plainModes = interactions.filter((m) => m.id !== "expert");

	return (
		<div className="menu-zone">
			<button type="button" className="bar-btn bar-btn-text" onClick={toggle}>
				{current?.label ?? currentId}
				<IconChevronDown size={13} />
			</button>
			{open && (
				<div className="pop-menu mode-menu">
					{plainModes.map((mode) => (
						<button
							key={mode.id}
							type="button"
							className={`mode-menu-item${mode.id === currentId ? " active" : ""}`}
							onClick={() => {
								setOpen(false);
								// 未实现的模式仍然列出（对齐 WorkBuddy 的能力面），
								// 但点击给 toast 反馈，而不是发出去让 daemon 报错。
								if (mode.ready) onChange(mode.id);
								else onTodo(`「${mode.label}」模式`);
							}}
						>
							<span className="mode-menu-label">
								{mode.label}
								{!mode.ready && <span className="mode-menu-tag">待做</span>}
							</span>
							<span className="mode-menu-desc">{mode.description}</span>
						</button>
					))}
					<div
						className="mode-menu-sub-zone"
						onMouseEnter={() => setExpertsOpen(true)}
						onMouseLeave={() => setExpertsOpen(false)}
					>
						<button
							type="button"
							className={`mode-menu-item${currentId === "expert" ? " active" : ""}`}
							aria-expanded={expertsOpen}
							onClick={() => setExpertsOpen((v) => !v)}
						>
							<span className="mode-menu-label">
								专家
								<span className="mode-menu-caret" aria-hidden="true">
									▸
								</span>
							</span>
							{/* 当前专家名钉在行上（WorkBuddy 档同行右侧回显的同款语义）；
							    未进专家模式时退为引导文案。 */}
							<span className="mode-menu-desc">
								{currentExpert?.displayName ?? "选定专家后以它的身份与方法工作"}
							</span>
						</button>
						{expertsOpen && (
							<div className="pop-menu mode-menu-sub">
								{experts.map((expert) => (
									<button
										key={expert.name}
										type="button"
										className={`mode-menu-item${expert.name === expertId ? " active" : ""}`}
										onClick={() => {
											setOpen(false);
											setExpertsOpen(false);
											onSelectExpert(expert.name);
										}}
									>
										<span className="mode-menu-label">{expert.displayName}</span>
										<span className="mode-menu-desc">{expert.profession}</span>
										{expert.name === expertId && <IconCheck size={14} className="mode-menu-check" />}
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

/* ── 保存到工作空间（命名弹层） ──────────────────────────────────── */

/**
 * 临时任务转正的命名弹层。
 *
 * 命名即建真实目录（daemon 在生效根下创建同名目录并把当前会话切过去），
 * 所以名称校验的权威在 daemon（兄弟目录/空间组的知识只在那边）——
 * renderer 不另写一份规则，两份必漂移（AGENTS.md §4），校验错误串原位透出。
 * 中文名选词确认的 Enter 不能误提交，IME 守卫与输入框同一份接线（ime-guard.ts）。
 */
function SaveToWorkspaceDialog({
	onSave,
	onClose,
}: {
	/** resolve = 转正完成（弹层随之关闭）；reject 的 message 原位透出。 */
	readonly onSave: (name: string) => Promise<void>;
	/** 取消与成功共用同一个关法：成功后弹层没有留着的意义。 */
	readonly onClose: () => void;
}): React.JSX.Element {
	const [name, setName] = useState("");
	const [error, setError] = useState<string | undefined>(undefined);
	const [submitting, setSubmitting] = useState(false);
	const ime = useImeGuard();

	const submit = (): void => {
		const trimmed = name.trim();
		if (trimmed === "" || submitting) return;
		setSubmitting(true);
		setError(undefined);
		onSave(trimmed).then(
			() => onClose(),
			(saveError: unknown) => {
				setError(saveError instanceof Error ? saveError.message : String(saveError));
				setSubmitting(false);
			},
		);
	};

	// Esc 关闭（提交中不关：daemon 正在切换会话，弹层关了用户无从知道结果）。
	useEffect(() => {
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape" && !submitting) onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose, submitting]);

	return (
		<div className="modal-backdrop">
			<div className="save-space-card" role="dialog" aria-modal="true" aria-label="保存到工作空间">
				<p className="save-space-title">保存到工作空间</p>
				<p className="save-space-desc">
					会以该名称创建空间目录，当前任务迁入其中继续；之后的对话与产物都归到这个空间，
					随时可以从侧栏回来。
				</p>
				<input
					className="save-space-input"
					value={name}
					// 弹层里唯一的输入框，自动聚焦即预期（同侧栏重命名行）。
					autoFocus
					placeholder="空间名称"
					disabled={submitting}
					onChange={(e) => {
						setName(e.target.value);
						// 输入变了旧的错误就失效：留着会让用户以为新名字也有同样问题。
						setError(undefined);
					}}
					onCompositionStart={ime.bind.onCompositionStart}
					onCompositionEnd={ime.bind.onCompositionEnd}
					onKeyDown={(e) => {
						if (e.key !== "Enter" || e.defaultPrevented) return;
						e.preventDefault();
						if (ime.shouldSwallowNow()) return;
						submit();
					}}
				/>
				{error !== undefined && <p className="save-space-error">{error}</p>}
				<div className="save-space-actions">
					<button type="button" className="mini-btn" disabled={submitting} onClick={onClose}>
						取消
					</button>
					<button
						type="button"
						className="primary-btn"
						disabled={submitting || name.trim() === ""}
						onClick={submit}
					>
						保存
					</button>
				</div>
			</div>
		</div>
	);
}

/* ── 主体 ────────────────────────────────────────────────────────── */

/** 距底多少像素内算「在底部」：覆盖子像素与平滑滚动的末段抖动。 */
const BOTTOM_THRESHOLD_PX = 40;

export function ChatView({
	conversation,
	ready,
	lastError,
	title,
	onBack,
	onSubmit,
	onAbort,
	onInteractionChange,
	experts,
	onSelectExpert,
	onPreviewArtifact,
	onPathClick,
	onOpenPanelGroup,
	onOpenSettings,
	onError,
	onSaveToWorkspace,
	onTodo,
	pendingQuestionnaire,
	onQuestionnaireSubmit,
	onQuestionnaireSkip,
}: ChatViewProps): React.JSX.Element {
	// 等待 tips 的「× 关闭」：会话级（本组件存活期内）承诺，跨回合不复活。
	const [tipsDismissed, setTipsDismissed] = useState(false);
	// 「保存到工作空间」命名弹层的开合；输入态由弹层组件自持（关掉即重置）。
	const [saveOpen, setSaveOpen] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	// 「+」菜单的「添加文件」要打开 Composer 内部附件状态的选择框（命令式动作，经 ref 句柄触发）。
	const composerRef = useRef<ComposerHandle>(null);
	const streaming = conversation.state.isStreaming;
	const sessionId = conversation.state.sessionId;
	// 当前专家（仅 expert 模式有值）：头部显示与子菜单勾选共用这份查找。
	// 列表尚未拉回时退显原始 name —— expertId 是 session_state 的权威值，
	// 列表只是展示映射，缺映射不该把「有专家」这个事实藏起来。
	const expertId = conversation.state.expertId;
	const currentExpert = expertId === undefined ? undefined : experts.find((e) => e.name === expertId);
	// 产物清单：present_files 交付折叠而来（唯一来源，不再从 write 推导）。
	const artifacts = conversation.artifacts;
	// MetaFold 折叠单元的展开状态：按单元 id 记忆。块流每次渲染由纯函数
	// 重算（见 buildRenderBlocks），状态必须留在组件层，否则随块重建丢失。
	const [foldOpen, setFoldOpen] = useState<ReadonlyMap<string, boolean>>(new Map());
	// 渲染块流：MetaFold 折叠 + 回合头部/取消占位都在纯函数里定位（shared/metafold.ts）。
	// 先过 todo_write 聚合投影（todo-projection.ts）：多次调用折叠成一张合成
	// 清单卡（最新全量、钉在首次出现处）。渲染侧一切消费方（块流/刻度轨/
	// 状态行/滚动跟随）统一看投影后的视图 —— 刻度轨只测量 user 消息，
	// 投影从不动 user 条目（同引用同序），测量口径不受影响。
	// 无 todo 卡时投影返回同一引用；useMemo 让无关重渲染（如折叠开合）
	// 不产出新数组，滚动 effect 的依赖语义与直连 conversation.entries 等价。
	const entries = useMemo(() => projectTodoList(conversation.entries), [conversation.entries]);
	const blocks = buildRenderBlocks(entries, {
		streaming,
		cancelledTurns: conversation.cancelledTurns,
	});
	// 最后一个 user 消息：当前回合的分界（回合头部走表的唯一依据）。
	const lastUserEntry = entries.findLast((e) => e.role === "user");
	const lastUserId = lastUserEntry?.id;
	const retryText = lastUserEntry?.text;
	// 等待首响应阶段：与 pendingText 返回「等待模型响应…」同口径（末尾是 user 或流为空）。
	// tips 轮播与 8s 安抚文案只在这个阶段计时，「正在写入文件…」等阶段不出现。
	const lastEntry = entries[entries.length - 1];
	const awaitingFirstResponse = streaming && (lastEntry === undefined || lastEntry.role === "user");

	// 滚动跟随（对标 WorkBuddy）：在底部时新内容自动贴底；用户上滚离开底部
	// 即停止跟随，浮现「回到底部」按钮；回到底部后恢复跟随。
	// 跟随状态走 ref（scroll/effect 里同步读），按钮可见性走 state（要触发渲染）。
	const followRef = useRef(true);
	const [showJumpToBottom, setShowJumpToBottom] = useState(false);
	// 「本会话内新发送」的待吸顶记录（WorkBuddy useFirstMessageAlign 的
	// firstUserMessageAlignPendingRef 同款，机制与出处见 send-anchor.ts 头注）。
	// 走 state 不走 ref：anchor-space 的 min-height 要靠它参与渲染。
	const [pendingAlign, setPendingAlign] = useState<PendingSentAlign | undefined>(undefined);

	/*
		跟随判定只看「测量到的位置」（距底 < 阈值），不看事件来源（wheel/touch/程序）。
		为什么不用「程序滚动中」标记区分：跟随贴底本身就是程序滚动，标记方案要在
		每次程序写 scrollTop 前后维护时序，流式增量下极易漏一拍把跟随误关掉。
		位置是地面真值 —— 程序贴底后测量结果恒为「在底部」，天然不会误判；
		用户上滚离开底部（不管用什么输入设备）测量结果恒为「不在底部」。
	*/
	const handleStreamScroll = (): void => {
		const node = scrollRef.current;
		if (node === null) return;
		const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < BOTTOM_THRESHOLD_PX;
		followRef.current = atBottom;
		setShowJumpToBottom(!atBottom);
	};

	/*
		每次 entries 变化的滚动动作由 decideScrollAction 纯函数决定（决策表见
		send-anchor.ts）：本会话新发送的回显上屏 → 吸顶；否则跟随中贴底 /
		上翻中不动（既有语义）。贴底用 scrollHeight 而非 scrollIntoView，
		避免流式增量时抖动；吸顶用 scrollIntoView block:"start"（与 TurnRail
		跳转同口径）。anchor-space 的 min-height 让吸顶位置与贴底位置在内容
		不足一屏时收敛 —— 吸顶后跟随接管不会二次跳动（WorkBuddy 同款数学，
		见 send-anchor.ts 头注）。
	*/
	useEffect(() => {
		const node = scrollRef.current;
		if (node === null) return;
		const action = decideScrollAction({
			pending: pendingAlign,
			sessionId,
			lastUserEntryId: lastUserId,
			isFollowing: followRef.current,
		});
		if (action.kind === "align-top") {
			const el = node.querySelector(`[data-entry-id="${CSS.escape(action.entryId)}"]`);
			el?.scrollIntoView({ block: "start" });
			// 吸顶只发一次（WorkBuddy：scrollToIndex 发出后清 pending 标记）。
			// 记录本身保留到 streaming 接管锚定空间（见下方交接 effect）。
			setPendingAlign((current) => (current === undefined ? current : { ...current, aligned: true }));
			return;
		}
		if (action.kind === "stick-bottom") node.scrollTop = node.scrollHeight;
	}, [entries, pendingAlign, sessionId, lastUserId]);

	/*
		锚定空间交接：吸顶发出后，等 streaming 真正开始（或回合已终结）才清掉
		待吸顶记录。记录一清，anchor-space 的 min-height 就只剩 streaming 撑着；
		在「回显已到、run_started 未到」的间隙提前清掉，min-height 掉落会让
		浏览器 clamp 把刚吸顶的位置拉回底部。turn.endedAt 兜住「回合太快、
		streaming:true 没被渲染出来就过去了」的边角。
	*/
	useEffect(() => {
		if (pendingAlign?.aligned !== true) return;
		if (streaming || conversation.turn?.endedAt !== undefined) setPendingAlign(undefined);
	}, [pendingAlign, streaming, conversation.turn]);

	// 切会话后旧的待吸顶作废（decideScrollAction 内部也按 sessionId 忽略它，
	// 这里把状态清掉，anchor-space 不致残留到别的会话）。
	useEffect(() => {
		if (pendingAlign !== undefined && pendingAlign.sessionId !== sessionId) {
			setPendingAlign(undefined);
		}
	}, [pendingAlign, sessionId]);

	// 点「回到底部」：立即恢复跟随 + 平滑滚到底。跟随必须先于滚动恢复 ——
	// 否则平滑动画没走完时新内容到达，底部被推远，动画终点已不在底部。
	const jumpToBottom = (): void => {
		const node = scrollRef.current;
		if (node === null) return;
		followRef.current = true;
		setShowJumpToBottom(false);
		node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
	};

	/**
	 * 会话内新发送的统一入口（Composer 提交 / 错误卡重试 / 执行计划共用）：
	 * 恢复跟随 + 登记待吸顶 —— 新 user 消息回显上屏后由滚动 effect 吸顶，
	 * 回复 streaming 开始后自然转入既有吸底跟随。
	 * 提交被 daemon 拒绝（未选模型等，消息不会上屏）时撤销登记：锚定空间
	 * 不能为一条不存在的消息留着。catch 用对象同一性比对，不清掉后一次
	 * 发送的新登记。
	 */
	const submitWithAnchor = (submit: () => Promise<void>): Promise<void> => {
		followRef.current = true;
		setShowJumpToBottom(false);
		const mine: PendingSentAlign = { sessionId, baselineUserId: lastUserId, aligned: false };
		setPendingAlign(mine);
		const result = submit();
		result.catch(() => {
			setPendingAlign((current) => (current === mine ? undefined : current));
		});
		return result;
	};

	const handleComposerSubmit = (text: string, images?: readonly ImagePart[]): Promise<void> => {
		return submitWithAnchor(() => onSubmit(text, images));
	};

	/** 错误卡重试：纯文本重发（失败原因已由 App 落进错误卡，这里只消费 promise）。 */
	const retrySubmit = (text: string): void => {
		submitWithAnchor(() => onSubmit(text)).catch(() => { });
	};

	/**
	 * 「执行计划」：切回创作模式后以用户消息名义发起执行。
	 *
	 * 切换必须 await 落地后再发：setInteraction 与 prompt 走同一条 INVOKE
	 * 通道但不保证工具面即时生效，不先落地的话执行请求会撞上 plan 的
	 * 只读白名单（写工具调用被 daemon 拒掉）。
	 * 为什么不走 onInteractionChange：它是 fire-and-forget（内部 catch），
	 * 拿不到「切换已生效」的时机。
	 */
	const executePlan = (): void => {
		void window.kami.setInteraction("craft").then(
			() => {
				// 提交失败的原因 App 会落进错误卡（lastError），与手动发送同口径，不重复提示。
				submitWithAnchor(() => onSubmit("计划没问题，就按上面的计划开始执行吧。")).catch(() => { });
			},
			(error: unknown) => onError(error instanceof Error ? error.message : String(error)),
		);
	};

	const toggleFold = (id: string): void => {
		setFoldOpen((current) => {
			const next = new Map(current);
			next.set(id, !(current.get(id) ?? false));
			return next;
		});
	};

	/*
		渲染块流按回合分组（groupTurnBlocks，WorkBuddy groupedMessages 同构）：
		「本会话新发送的待吸顶」或 streaming 期间，由 user 开启的最后一组挂
		anchor-space 的 min-height —— 内容不足一屏时用户消息才够得到视口顶，
		且吸顶位置与吸底跟随收敛到同一 scrollTop（机制与出处见
		send-anchor.ts 头注）。组边界稳定：老回合的组永不重排，新回合只
		追加新组，卡片展开态等组件内部状态不随分组重建丢失。
	*/
	const turnGroups = groupTurnBlocks(blocks);
	const anchorSpace = streaming || activePendingAlign(pendingAlign, sessionId) !== undefined;

	/*
		渲染块流来自 buildRenderBlocks（shared/metafold.ts）：已完成回合的
		连续工具卡折成 fold 块；回合头部（turn-header）与「用户已取消」
		（cancelled）占位块的定位规则与折叠分组共享同一遍扫描，视觉位置
		与原实现一致（header 紧跟 user 之后，cancelled 在回合末尾）。
		只有最后一个 user 消息所在的回合是「当前回合」—— 它的头部走表，
		历史回合恒为已完成（computeTurnActive 同口径）。
	*/
	const renderBlock = (block: RenderBlock): React.JSX.Element | null => {
		switch (block.kind) {
			case "turn-header":
				return (
					<TurnHeader
						key={`turn-${block.userId}`}
						active={streaming && block.userId === lastUserId}
						turn={block.userId === lastUserId ? conversation.turn : undefined}
					/>
				);
			case "cancelled":
				return (
					<div key={`cancelled-${block.userId}`} className="user-cancelled">
						用户已取消
					</div>
				);
			case "fold":
				return (
					<MetaFoldBlock
						key={block.id}
						leadIcon={block.leadIcon}
						summary={block.summary}
						cards={block.cards}
						open={foldOpen.get(block.id) ?? false}
						onToggle={() => toggleFold(block.id)}
					/>
				);
			case "entry": {
				const { entry } = block;
				if (entry.role === "tool") {
					// show_widget 不走通用工具卡：渲染为内联可视化块
					// （sandbox iframe，见 widget-view.tsx）。其余卡片不变。
					if (entry.toolName === "show_widget") {
						return <WidgetView key={entry.id} card={entry} />;
					}
					// todo_write 走清单卡：投影已把多次调用合成一张（todo-projection.ts），
					// 是消息流最新内容时默认展开（活面板），历史位置默认折叠。
					if (entry.toolName === "todo_write") {
						return <TodoListCard key={entry.id} card={entry} defaultOpen={entry.id === lastEntry?.id} />;
					}
					// 进行中回合的工具卡不折叠，原样平铺（过程必须可见）。
					return <ToolEntry key={entry.id} card={entry} />;
				}
				// 用户消息走气泡（at 由 daemon 打点，UI 不自己取时间）。
				if (entry.role === "user") {
					return <UserBubble key={entry.id} entryId={entry.id} text={entry.text} at={entry.at} images={entry.images} />;
				}
				// artifacts_presented 条目不直接渲染（产物清单已由 reducer 折叠进
				// conversation.artifacts，产物卡在消息流底部统一展示）。
				if (entry.role === "artifacts_presented") {
					return null;
				}
				return (
					<div key={entry.id} data-entry-id={entry.id} className={`entry ${entry.role}`}>
						{/*
							thinking 的流式判定：该条是 entries 末尾的助手消息且会话在流式。
							assistant_done 后它不再是末尾（后续工具卡/新消息接上来）或
							isStreaming 翻 false，扫光与自动展开同时停止。
						*/}
						{entry.thinking !== undefined && (
							<ThinkingBlock
								text={entry.thinking}
								streaming={streaming && entry.id === lastEntry?.id}
							/>
						)}
						{/* 走到这里的只剩助手消息（user/tool 在上面已分流），走 Markdown 渲染。 */}
						<Markdown
							text={entry.text}
							cwd={conversation.state.cwd}
							onPathClick={onPathClick}
						/>
						{/*
							「执行计划」只钉在 plan 模式、非流式的末条 assistant 消息上：
							流式中计划可能还没写完，历史消息上的计划已被后续对话淹没。
						*/}
						<AssistantActions
							text={entry.text}
							showExecutePlan={conversation.state.interactionId === "plan" && !streaming && entry.id === lastEntry?.id}
							onExecutePlan={executePlan}
						/>
					</div>
				);
			}
			case "error": {
				const { entry } = block;
				return (
					<ErrorCard
						key={entry.id}
						message={entry.message}
						runId={entry.runId}
						at={entry.at}
						modelId={conversation.state.modelId}
						retryText={retryText}
						onRetry={() => {
							if (retryText === undefined) return;
							// 重试后旧错误卡保留为历史；重发最后一条 user 消息。
							retrySubmit(retryText);
						}}
					/>
				);
			}
		}
	};

	/*
		消息流尾部（流式状态行 / 产物区 / 提交错误卡）：渲染在最后一组之内 ——
		与 WorkBuddy 的组内 footer 同位。锚定空间生效期间，回显的用户消息与
		等待状态行在同一组里，吸顶后「等待模型响应…」就出现在消息下方视野内。
	*/
	const streamTail = (
		<>
			{/*
				状态行只在流式期间存在，主文案恒定扫光（全局唯一「进行中」语言）。
				等待首响应阶段（最后一条 entry 是 user）升级为 WaitingPendingLine：
				4s 出 tips、8s 切安抚文案；其余阶段维持单行扫光。
			*/}
			{streaming &&
				(awaitingFirstResponse ? (
					<WaitingPendingLine dismissed={tipsDismissed} onDismiss={() => setTipsDismissed(true)} />
				) : (
					<div className="stream-pending">
						<span className="text-shimmer">{pendingText(entries)}</span>
					</div>
				))}
			{/*
				产物卡片区：present_files 交付的文件（文件名 + 大小，对齐
				WorkBuddy 的 snake.html 7.3 KB 卡片）。流式期间不显示 ——
				交付一般发生在收尾，且流式中面板已被自动打开。
			*/}
			{!streaming && artifacts.length > 0 && (
				<section className="artifacts">
					<header className="artifacts-header">产物（{artifacts.length}）</header>
					<div className="artifacts-grid">
						{artifacts.map((a) => {
							const isUrl = /^https?:\/\//i.test(a.path);
							const isHtml = /\.html?$/i.test(a.path);
							return (
								<button
									key={a.path}
									type="button"
									className="artifact-card"
									title={isUrl ? `${a.path}（外部打开）` : `${a.path}（点击预览）`}
									onClick={() => onPreviewArtifact(a.path)}
								>
									<IconDoc size={16} />
									<span className="artifact-name">{a.path.split(/[\\/]/).pop()}</span>
									{a.size > 0 && <span className="artifact-size">{formatSize(a.size)}</span>}
									{isHtml && !isUrl && (
										<span
											className="artifact-preview-btn"
											role="button"
											title="在预览面板打开"
											onClick={(event) => {
												event.stopPropagation();
												onPreviewArtifact(a.path);
											}}
										>
											🌐
										</span>
									)}
								</button>
							);
						})}
					</div>
					<div className="artifacts-footer">
						<button type="button" className="artifacts-more" onClick={() => onOpenPanelGroup("artifacts")}>
							查看所有产物 ({artifacts.length}) ›
						</button>
						<button type="button" className="artifacts-more" onClick={() => onOpenPanelGroup("changes")}>
							查看所有变更 ›
						</button>
					</div>
				</section>
			)}
			{lastError !== undefined && (
				<ErrorCard
					message={lastError}
					modelId={conversation.state.modelId}
					retryText={retryText}
					onRetry={() => {
						if (retryText === undefined) return;
						retrySubmit(retryText);
					}}
				/>
			)}
		</>
	);

	return (
		<main className="chat">
			<header className="chat-header">
				<button type="button" className="bar-btn" aria-label="返回首页" onClick={onBack}>
					<IconBack size={17} />
				</button>
				<span className="chat-title" title={title}>
					{title}
				</span>
				{/*
				临时任务的转正入口（对标 WorkBuddy 头部「保存到工作空间」）。
				只有临时任务显示：命名空间的会话不需要再转一次。
				流式中禁用 —— daemon 也会拒，但按钮置灰比弹层里报错直观。
			*/}
				{conversation.state.isTempTask === true && (
					<button
						type="button"
						className="bar-btn bar-btn-text"
						disabled={!ready || streaming}
						title={streaming ? "任务进行中，停止后可保存" : "保存到工作空间"}
						onClick={() => setSaveOpen(true)}
					>
						保存到工作空间
					</button>
				)}
				<ModeSwitch
					interactions={conversation.availableModes}
					currentId={conversation.state.interactionId}
					onChange={onInteractionChange}
					experts={experts}
					expertId={expertId}
					onSelectExpert={onSelectExpert}
					onTodo={onTodo}
				/>
				{/*
				当前专家钉在头部（WorkBuddy 专家会话头部同款位置）：expert 模式下
				模式切换器只显示「专家」这个模式名，具体是哪位专家必须有常驻回显，
				否则对话进行到一半用户无从确认人格是否还是当初选的那位。
			*/}
				{expertId !== undefined && (
					<span className="chat-expert" title={`当前专家：${currentExpert?.displayName ?? expertId}`}>
						<IconAssistant size={13} />
						专家：{currentExpert?.displayName ?? expertId}
					</span>
				)}
			</header>

			{/*
				stream-wrap 只提供定位基准：「回到底部」按钮要钉在滚动视口底部，
				若直接放 .stream 里会随内容一起滚走（absolute 相对的是滚动内容盒）。
				滚动容器仍是 .stream 本身，监听器不挂在 wrap 上 —— 挂错元素收不到
				滚动事件，跟随判定会静默失效。
			*/}
			<div className="stream-wrap">
				<div className="stream" ref={scrollRef} onScroll={handleStreamScroll}>
					{/*
						回合分组渲染：每组一个 .turn-group 容器；「由 user 开启的最后一组」
						在 anchorSpace 期间加 anchor-space（min-height）—— 发送吸顶的
						滚动空间由它提供（WorkBuddy group min-height 同款，出处见
						send-anchor.ts 头注）。尾部（状态行/产物/错误卡）随最后一组走，
						没有组（全新会话还没有消息）时平铺，与历史行为一致。
					*/}
					{turnGroups.map((group, index) => {
						const isLast = index === turnGroups.length - 1;
						const anchored = isLast && anchorSpace && group.startsWithUser;
						return (
							<div key={group.key} className={anchored ? "turn-group anchor-space" : "turn-group"}>
								{group.blocks.map(renderBlock)}
								{isLast && streamTail}
							</div>
						);
					})}
					{turnGroups.length === 0 && streamTail}
				</div>
				{/*
				消息导航刻度轨：钉在 stream-wrap 视口左缘（与 stream-fade /
				jump-to-bottom 同一定位基准）。不能放 .stream 内 —— 滚动容器里
				absolute 子元素随内容滚走，且 .stream 挂载动画的 transform 期间
				会让它变成后代包含块，刻度轨会短暂错位。scrollRef 与 entries
				都是现成的，零新状态源。
			*/}
				<TurnRail entries={entries} scrollRef={scrollRef} />
				{/*
				底部渐隐（对标 WorkBuddy __bottom-mask）：渐变叠加层钉在
				stream-wrap 视口底部，不随内容滚动。与「回到底部」共用同一可见
				条件（不在底部才需要软收边）；常驻 DOM 只切 opacity，往返都有过渡。
			*/}
				<div className="stream-fade" data-visible={showJumpToBottom} />
				{/* 不在底部时浮现（跟随已停）；点击平滑回底并恢复跟随。 */}
				{showJumpToBottom && (
					<button
						type="button"
						className="jump-to-bottom"
						aria-label="回到底部"
						title="回到底部"
						onClick={jumpToBottom}
					>
						<IconChevronDown size={16} />
					</button>
				)}
			</div>

			<footer className="chat-composer">
				{pendingQuestionnaire !== undefined ? (
					/*
					问卷浮层替换输入区（WorkBuddy CBChat 的 hasQuestionFloating 语义：
					答题期间 composer 让位，答完/跳过后 composer 恢复）。key 按请求 id
					挂，新问卷即新挂载（作答状态随之重置，与全局弹层期同口径）。
				*/
					<QuestionnaireDialog
						key={pendingQuestionnaire.id}
						request={pendingQuestionnaire}
						onSubmit={(answers) => onQuestionnaireSubmit?.(answers)}
						onSkip={() => onQuestionnaireSkip?.()}
					/>
				) : (
					/*
					输入卡机制（拖放/附件/IME/补全/历史/草稿/字数闸/停止确认）
					全部在 Composer 内部；这里只注入 chat 的差异面。
					流式期间仍可输入：发出去会作为 steer 插进当前这轮（SessionHost.prompt）。
				*/
					<Composer
						ref={composerRef}
						ready={ready}
						placeholder={ready ? (streaming ? "补充说明会插入当前任务…" : "继续追问…") : "引擎启动中…"}
						rows={2}
						cwd={conversation.state.cwd}
						modelId={conversation.state.modelId}
						onSubmit={handleComposerSubmit}
						onError={onError}
						draftKey={sessionId}
						enableHistory
						streaming={streaming}
						onAbort={onAbort}
					>
						{/*
					「+」菜单：添加文件（原图片/文档选择流程挪进菜单项，经 composerRef
					触发 Composer 内部的附件选择框）+ 模式/专家子菜单（与头部 ModeSwitch
					同一数据源）+ 技能/连接器占位。
					弹层向上、左对齐，与下方 PermissionMenu 同一约定。
				*/}
						<PlusMenu
							modes={conversation.availableModes}
							currentId={conversation.state.interactionId}
							onInteractionChange={onInteractionChange}
							experts={experts}
							expertId={expertId}
							onSelectExpert={onSelectExpert}
							onPickFiles={() => void composerRef.current?.pickFiles()}
							onTodo={onTodo}
						/>
						{/*
					权限预设就地快切（与首页同一组件、同一数据源）：对话中撞权限
					时不必退回首页换档。弹层左对齐向上展开（300px），
					贴右放会溢出窗口右缘被裁掉。
				*/}
						<PermissionMenu onOpenSettings={onOpenSettings} onError={onError} />
						{/*
					模型快捷切换：与首页同一组件、同一数据源（setModel 后 daemon
					推 session_state 单向刷新，无本地回写）。紧跟 PermissionMenu ——
					两者都是切换器。弹层方向在 CSS 按 composer-bar 场景覆写为
					向上、左对齐（与 PermissionMenu 同一理由：贴右放溢出窗口右缘）。
				*/}
						<ModelMenu
							modelId={conversation.state.modelId}
							thinkingLevel={conversation.state.thinkingLevel}
							availableThinkingLevels={conversation.state.availableThinkingLevels}
							onOpenSettings={onOpenSettings}
							onError={onError}
						/>
						<button type="button" className="bar-btn" aria-label="语音输入" onClick={() => onTodo("语音输入")}>
							<IconMic size={16} />
						</button>
						{/* 上下文饱和度常驻指示（used/total 精确值），点击看分类估算。 */}
						{conversation.usageDetail !== undefined && <ContextUsageRing detail={conversation.usageDetail} />}
					</Composer>
				)}
			</footer>
			{saveOpen && (
				<SaveToWorkspaceDialog
					onSave={onSaveToWorkspace}
					onClose={() => setSaveOpen(false)}
				/>
			)}
		</main>
	);
}
