/**
 * 任务对话页：消息流 + 底部输入。
 *
 * 视觉延续首页的输入卡，保证「首页发一句话 → 进入对话页」过渡不突兀。
 * 消息渲染基于 shared/conversation.ts 折叠出的 entries 视图。
 */

import { useEffect, useRef, useState } from "react";
import type { ConversationView } from "@shared/conversation.ts";
import type { ImagePart } from "@shared/image.ts";
import { formatMessageTime } from "@shared/message-time.ts";
import { buildRenderBlocks } from "@shared/metafold.ts";
import type { ConversationEntry, ModeDescriptor, RunId, ToolCard, TurnTiming } from "@shared/session-events.ts";
import { WAITING_SOOTHED_TEXT, WAITING_TIPS } from "@shared/waiting-tips.ts";
import {
	IconAlert,
	IconBack,
	IconCheck,
	IconChevronDown,
	IconCopy,
	IconDoc,
	IconMic,
	IconPlus,
	IconSend,
	IconStop,
} from "./icons.tsx";
import { useAutocomplete } from "./autocomplete.tsx";
import { ContextUsageRing } from "./context-usage.tsx";
import { useCopyWithTick } from "./copy-tick.ts";
import { AttachmentStrip, imageDataUrl, useImageAttachments } from "./image-attachments.tsx";
import { useImeGuard } from "./ime-guard.ts";
import { loadDraft, navigateHistory, recordSent, saveDraft, sentHistory } from "./input-history.ts";
import type { HistoryNavState } from "./input-history.ts";
import { charCountState } from "./input-limit.ts";
import { ModelMenu } from "./model-menu.tsx";
import { PermissionMenu } from "./permission-menu.tsx";
import { stopConfirmExpired, stopConfirmIdle, triggerStop } from "./stop-confirm.ts";
import type { StopConfirmState } from "./stop-confirm.ts";
import { useModelSupportsVision, VisionHint } from "./vision-hint.tsx";
import { Markdown } from "./markdown.tsx";
import { thinkingOpen, toggleThinking } from "./thinking-fold.ts";
import type { ThinkingFoldOverride } from "./thinking-fold.ts";

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
	/** 点击产物卡片：在右侧面板预览（面板里有外部打开入口）。 */
	readonly onPreviewArtifact: (path: string) => void;
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
	text,
	at,
	images,
}: {
	readonly text: string;
	readonly at: number;
	/** 本条消息携带的图片附件（仅 UI 展示；进模型的翻译在 daemon 侧）。 */
	readonly images?: readonly ImagePart[];
}): React.JSX.Element {
	const { copied, copy } = useCopyWithTick();
	// 点击放大的那张图；undefined = 预览关闭。MVP 不做轮播/缩放（YAGNI）。
	const [preview, setPreview] = useState<ImagePart | undefined>(undefined);

	return (
		<div className="entry user">
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
			<div className="user-toolbar">
				<span className="user-time">{formatMessageTime(at, Date.now())}</span>
				<button
					type="button"
					className="user-copy"
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
 * 助手回答底部的操作条（对标 WorkBuddy 的 assistant 消息操作条，只做复制）。
 * 与 user-toolbar 同款「常驻占位、hover 切透明度」模式，理由相同：
 * hover 才插入 DOM 会推搡下方消息流。流式中的末条也渲染 —— 复制部分内容无害。
 */
function AssistantActions({ text }: { readonly text: string }): React.JSX.Element {
	const { copied, copy } = useCopyWithTick();

	return (
		<div className="assistant-toolbar">
			<button
				type="button"
				className="assistant-copy"
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

	return (
		<div className={`entry tool${card.outcome === "error" ? " tool-error" : ""}`}>
			<button
				type="button"
				className="tool-head"
				disabled={!expandable}
				title={expandable ? (open ? "收起" : "展开详情") : undefined}
				onClick={() => setOpen((v) => !v)}
			>
				<span className={`tool-dot ${outcomeClass(card.outcome)}`} />
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
			{open && card.detail !== undefined && <pre className="tool-detail">{card.detail}</pre>}
		</div>
	);
}

/* ── MetaFold 过程折叠 ───────────────────────────────────────────── */

/**
 * 一个折叠单元：回合结束后连续工具卡折成的一行摘要（机制对标 WorkBuddy）。
 *
 * 长任务一次调十几次工具，平铺会把助手的最终回答顶出视野；折成一行后
 * 回答紧邻摘要可见。展开状态由父组件按折叠单元 id 记住（Map）——
 * 块流每次渲染由纯函数重算，组件若自持状态会随块重建丢失。
 * 展开后内容就是原 ToolEntry 列表，卡片自身的展开/详情行为不变。
 */
function MetaFoldBlock({
	summary,
	cards,
	open,
	onToggle,
}: {
	readonly summary: string;
	readonly cards: readonly ToolCard[];
	readonly open: boolean;
	readonly onToggle: () => void;
}): React.JSX.Element {
	return (
		<div className="metafold">
			<button
				type="button"
				className={open ? "metafold-row open" : "metafold-row"}
				title={open ? "收起过程" : "展开过程"}
				onClick={onToggle}
			>
				<span className="metafold-summary">{summary}</span>
				<IconChevronDown size={12} className="metafold-caret" />
			</button>
			{open && cards.map((card) => <ToolEntry key={card.id} card={card} />)}
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

/** 文件大小格式化：WorkBuddy 产物卡口径（7.3 KB）。0（URL/不可 stat）不显示。 */
function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	return kb < 100 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
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
			<span className="turn-agent">KamiBuddy</span>
			<span className="turn-duration">{duration}</span>
		</div>
	);
}

/* ── 交互模式切换 ────────────────────────────────────────────────── */

interface ModeSwitchProps {
	readonly interactions: readonly ModeDescriptor[];
	readonly currentId: string;
	readonly onChange: (id: string) => void;
	readonly onTodo: (feature: string) => void;
}

/** 交互轴切换（ask / craft / plan / expert），对标 WorkBuddy 的 interactionmode。 */
function ModeSwitch({ interactions, currentId, onChange, onTodo }: ModeSwitchProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const current = interactions.find((m) => m.id === currentId);

	return (
		<div className="mode-switch">
			<button type="button" className="bar-btn bar-btn-text" onClick={() => setOpen((v) => !v)}>
				{current?.label ?? currentId}
				<IconChevronDown size={13} />
			</button>
			{open && (
				<div className="mode-menu">
					{interactions.map((mode) => (
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
	onPreviewArtifact,
	onOpenPanelGroup,
	onOpenSettings,
	onError,
	onSaveToWorkspace,
	onTodo,
}: ChatViewProps): React.JSX.Element {
	// 草稿按 sessionId 存进模块级 Map（input-history.ts）：视图切换卸载组件后
	// 切回仍能还原。挂载时先还原一次，之后 sessionId 变化由下方 effect 接续。
	const [draft, setDraft] = useState(() => loadDraft(conversation.state.sessionId) ?? "");
	// 等待 tips 的「× 关闭」：会话级（本组件存活期内）承诺，跨回合不复活。
	const [tipsDismissed, setTipsDismissed] = useState(false);
	// 「保存到工作空间」命名弹层的开合；输入态由弹层组件自持（关掉即重置）。
	const [saveOpen, setSaveOpen] = useState(false);
	// 停止的二次确认状态（stop-confirm.ts 状态机）：idle → 首次触发武装 pending
	// → 窗口内再触发才 confirmed 调 onAbort。只持状态，计时与判定都在纯函数里。
	const [stopConfirm, setStopConfirm] = useState<StopConfirmState>(stopConfirmIdle);
	// Alt+↑/↓ 历史导航状态：undefined = 不在导航中（输入框是用户自己的草稿）。
	const [historyNav, setHistoryNav] = useState<HistoryNavState | undefined>(undefined);
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	// IME 守卫与 home-view 共用一份接线（useImeGuard）：选词确认的 Enter 不发送。
	const ime = useImeGuard();
	// 图片附件（粘贴/拖拽/选择三入口），与 home-view 共用同一份 hook。
	const img = useImageAttachments(onError);
	// 非视觉模型提示的数据源（模型目录 join，见 vision-hint.tsx）；未知不提示。
	const visionSupported = useModelSupportsVision(conversation.state.modelId);
	const streaming = conversation.state.isStreaming;
	const sessionId = conversation.state.sessionId;
	// 输入长度余量（input-limit.ts 纯函数判定）：接近上限才显示，超限禁发。
	const chars = charCountState(draft.length);

	// 会话切换（含挂载后 sessionId 才就位）时还原该会话的草稿；
	// 历史导航态一并复位 —— 旧会话翻到的位置对新会话没有意义。
	useEffect(() => {
		setDraft(loadDraft(sessionId) ?? "");
		setHistoryNav(undefined);
	}, [sessionId]);
	// 产物清单：present_files 交付折叠而来（唯一来源，不再从 write 推导）。
	const artifacts = conversation.artifacts;
	// MetaFold 折叠单元的展开状态：按单元 id 记忆。块流每次渲染由纯函数
	// 重算（见 buildRenderBlocks），状态必须留在组件层，否则随块重建丢失。
	const [foldOpen, setFoldOpen] = useState<ReadonlyMap<string, boolean>>(new Map());
	// 渲染块流：MetaFold 折叠 + 回合头部/取消占位都在纯函数里定位（shared/metafold.ts）。
	const blocks = buildRenderBlocks(conversation.entries, {
		streaming,
		cancelledTurns: conversation.cancelledTurns,
	});
	// 最后一个 user 消息：当前回合的分界（回合头部走表的唯一依据）。
	const lastUserEntry = conversation.entries.findLast((e) => e.role === "user");
	const lastUserId = lastUserEntry?.id;
	const retryText = lastUserEntry?.text;
	// 等待首响应阶段：与 pendingText 返回「等待模型响应…」同口径（末尾是 user 或流为空）。
	// tips 轮播与 8s 安抚文案只在这个阶段计时，「正在写入文件…」等阶段不出现。
	const lastEntry = conversation.entries[conversation.entries.length - 1];
	const awaitingFirstResponse = streaming && (lastEntry === undefined || lastEntry.role === "user");
	// @ / 补全：触发与选中逻辑全在 hook 里，这里只接管 ref 与值；cwd 变化时重拉数据源。
	const ac = useAutocomplete(draft, setDraft, textareaRef, conversation.state.cwd);

	// 滚动跟随（对标 WorkBuddy）：在底部时新内容自动贴底；用户上滚离开底部
	// 即停止跟随，浮现「回到底部」按钮；回到底部后恢复跟随。
	// 跟随状态走 ref（scroll/effect 里同步读），按钮可见性走 state（要触发渲染）。
	const followRef = useRef(true);
	const [showJumpToBottom, setShowJumpToBottom] = useState(false);

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

	// 新内容到达时若跟随中则贴底。用 scrollHeight 而非 scrollIntoView，避免流式增量时抖动。
	useEffect(() => {
		const node = scrollRef.current;
		if (node !== null && followRef.current) node.scrollTop = node.scrollHeight;
	}, [conversation.entries]);

	// 点「回到底部」：立即恢复跟随 + 平滑滚到底。跟随必须先于滚动恢复 ——
	// 否则平滑动画没走完时新内容到达，底部被推远，动画终点已不在底部。
	const jumpToBottom = (): void => {
		const node = scrollRef.current;
		if (node === null) return;
		followRef.current = true;
		setShowJumpToBottom(false);
		node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
	};

	/** 停止按钮与 Esc 共用的二次确认入口：只有 confirmed 那次才真正中断。 */
	const requestStop = (): void => {
		const result = triggerStop(stopConfirm, Date.now());
		setStopConfirm(result.state);
		if (result.confirmed) onAbort();
	};

	// 待确认窗口截止自动复原。定时器到点再用 stopConfirmExpired 复核：
	// 用户在旧定时器到期前重新武装过时，新 pending 尚未过期，不能被旧定时器误清。
	useEffect(() => {
		if (stopConfirm.phase !== "pending") return;
		const timer = window.setTimeout(
			() => {
				setStopConfirm((current) => (stopConfirmExpired(current, Date.now()) ? stopConfirmIdle : current));
			},
			Math.max(0, stopConfirm.deadline - Date.now()),
		);
		return () => window.clearTimeout(timer);
	}, [stopConfirm]);

	// 流式结束（完成/已中断）时若还挂着待确认，直接复原 —— 停止键随流式态消失，
	// 状态不收回去会卡在下一次流式开始时的按钮上。
	useEffect(() => {
		if (!streaming) setStopConfirm((current) => (current.phase === "pending" ? stopConfirmIdle : current));
	}, [streaming]);

	const submit = (): void => {
		const text = draft.trim();
		// 超限双闸之一：发送按钮已 disabled，这里拦快捷键（Enter）路径。
		if (charCountState(draft.length).over) return;
		if (text === "" || !ready) return;
		const images = img.attachments;
		setDraft("");
		// 发送即清掉该会话的暂存草稿（已发出不再是草稿），并退出历史导航态。
		saveDraft(sessionId, "");
		setHistoryNav(undefined);
		// 发新消息强制贴底（WorkBuddy 同行为）：回显经 daemon 确认后才进 entries，
		// 这里先把跟随打开，entries 变化的 effect 落地时自然贴底。
		followRef.current = true;
		setShowJumpToBottom(false);
		// 附件等 daemon 接收成功再清：失败时错误卡已落进消息流，图留在
		// 输入区（文本可从错误卡重试），补一句话重发即可，不必重挑文件。
		void onSubmit(text, images.length > 0 ? images : undefined).then(
			() => {
				img.clear();
				// 历史只记发送成功的：失败的文本留在错误卡里可重试，不该进翻页序列。
				recordSent(text);
			},
			() => {},
		);
	};

	/** 错误卡重试：纯文本重发（失败原因已由 App 落进错误卡，这里只消费 promise）。 */
	const retrySubmit = (text: string): void => {
		onSubmit(text).catch(() => {});
	};

	/**
	 * 输入框按键。ac 先行：补全打开时 Enter=选中、Esc=关闭补全（均 preventDefault），
	 * 之后的守卫一律不插手它的消费（e.defaultPrevented 直接 return）。
	 * IME 守卫与 home-view 共用一份接线（useImeGuard）：选词确认的 Enter 发送与换行（含 Shift+Enter）都吞。
	 */
	const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
		ac.bind.onKeyDown(e);
		if (e.defaultPrevented) return;
		// Esc 停止只在流式期间生效，且走二次确认（误碰一次不中断长任务）；
		// 非流式 Esc 无任何效果。
		if (e.key === "Escape") {
			if (streaming) {
				e.preventDefault();
				requestStop();
			}
			return;
		}
		if (e.key !== "Enter" && !(e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown"))) return;
		// IME 选词期间 Enter 是确认候选、方向键是移动候选条，都归输入法，守卫一律吞。
		if (ime.shouldSwallowNow()) {
			e.preventDefault();
			return;
		}
		if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
			e.preventDefault();
			const nav = navigateHistory(historyNav, sentHistory(), e.key === "ArrowUp" ? "up" : "down", draft);
			setHistoryNav(nav.state);
			setDraft(nav.text);
			// 导航结果同步进草稿 Map：导航中切走再切回，还原的就是离开前框里的内容。
			saveDraft(sessionId, nav.text);
			return;
		}
		if (!e.shiftKey) {
			e.preventDefault();
			submit();
		}
	};

	const toggleFold = (id: string): void => {
		setFoldOpen((current) => {
			const next = new Map(current);
			next.set(id, !(current.get(id) ?? false));
			return next;
		});
	};

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
					onTodo={onTodo}
				/>
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
			渲染块流来自 buildRenderBlocks（shared/metafold.ts）：已完成回合的
			连续工具卡折成 fold 块；回合头部（turn-header）与「用户已取消」
			（cancelled）占位块的定位规则与折叠分组共享同一遍扫描，视觉位置
			与原实现一致（header 紧跟 user 之后，cancelled 在回合末尾）。
			只有最后一个 user 消息所在的回合是「当前回合」—— 它的头部走表，
			历史回合恒为已完成（computeTurnActive 同口径）。
		*/}
		{blocks.map((block) => {
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
							summary={block.summary}
							cards={block.cards}
							open={foldOpen.get(block.id) ?? false}
							onToggle={() => toggleFold(block.id)}
						/>
					);
				case "entry": {
						const { entry } = block;
						if (entry.role === "tool") {
							// 进行中回合的工具卡不折叠，原样平铺（过程必须可见）。
							return <ToolEntry key={entry.id} card={entry} />;
						}
						// 用户消息走气泡（at 由 daemon 打点，UI 不自己取时间）。
						if (entry.role === "user") {
							return <UserBubble key={entry.id} text={entry.text} at={entry.at} images={entry.images} />;
						}
						// artifacts_presented 条目不直接渲染（产物清单已由 reducer 折叠进
						// conversation.artifacts，产物卡在消息流底部统一展示）。
						if (entry.role === "artifacts_presented") {
							return null;
						}
						return (
							<div key={entry.id} className={`entry ${entry.role}`}>
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
							<Markdown text={entry.text} />
							<AssistantActions text={entry.text} />
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
		})}
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
						<span className="text-shimmer">{pendingText(conversation.entries)}</span>
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
				</div>
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
				{/*
					拖放三件套（onDragOver/onDragLeave/onDrop）挂在输入卡而非 textarea 上：
					整个卡片（含按钮行）都是放置目标，命中区大得多。悬停高亮由
					img.dragOver 驱动（进 drag-over 类），拖文本片段不亮（见 hook 注释）。
				*/}
				<div
					className={`composer-card${img.dragOver ? " drag-over" : ""}`}
					onDrop={img.bind.onDrop}
					onDragOver={img.bind.onDragOver}
					onDragLeave={img.bind.onDragLeave}
				>
					<AttachmentStrip attachments={img.attachments} onRemove={img.removeAt} />
					<VisionHint visible={visionSupported === false && img.attachments.length > 0} />
					<div className="composer-input">
						{ac.menu}
						<textarea
							ref={textareaRef}
							value={draft}
							onChange={(e) => {
								ac.bind.onChange(e);
								saveDraft(sessionId, e.target.value);
							}}
							onSelect={ac.bind.onSelect}
							onBlur={ac.bind.onBlur}
							onPaste={img.bind.onPaste}
							onCompositionStart={ime.bind.onCompositionStart}
							onCompositionEnd={ime.bind.onCompositionEnd}
							onKeyDown={handleComposerKeyDown}
							// 流式期间仍可输入：发出去会作为 steer 插进当前这轮（SessionHost.prompt）。
							placeholder={ready ? (streaming ? "补充说明会插入当前任务…" : "继续追问…") : "引擎启动中…"}
							disabled={!ready}
							rows={2}
						/>
					</div>
					<div className="composer-bar">
						<button type="button" className="bar-btn" aria-label="添加附件" title="添加图片" onClick={() => void img.pickFromDialog()}>
							<IconPlus size={17} />
						</button>
						{/*
							权限预设就地快切（与首页同一组件、同一数据源）：对话中撞权限
							时不必退回首页换档。放左侧而非右侧语音钮旁 —— 弹层左对齐
							向上展开（300px），贴右放会溢出窗口右缘被裁掉。
						*/}
						<PermissionMenu onOpenSettings={onOpenSettings} onError={onError} />
						{/*
							模型快捷切换：与首页同一组件、同一数据源（setModel 后 daemon
							推 session_state 单向刷新，无本地回写）。紧跟 PermissionMenu ——
							两者都是切换器。弹层方向在 CSS 按 composer-bar 场景覆写为
							向上、左对齐（与 PermissionMenu 同一理由：贴右放溢出窗口右缘）。
						*/}
						<ModelMenu modelId={conversation.state.modelId} onOpenSettings={onOpenSettings} onError={onError} />
						<span className="bar-spacer" />
						<button type="button" className="bar-btn" aria-label="语音输入" onClick={() => onTodo("语音输入")}>
							<IconMic size={16} />
						</button>
						{/* 输入余量：接近上限才出现（等宽数字），超限变红。 */}
						{chars.show && (
							<span
								className={chars.over ? "char-remaining over" : "char-remaining"}
								title={chars.over ? "已超出输入长度上限" : "剩余可输入字符数"}
							>
								{chars.remaining}
							</span>
						)}
						{/* 上下文饱和度常驻指示（used/total 精确值），点击看分类估算。 */}
						{conversation.usageDetail !== undefined && <ContextUsageRing detail={conversation.usageDetail} />}
						{/*
							流式期间发送键变中断键。
							没有中断入口时，模型跑偏或长任务只能干等，甚至杀进程 —— 这是必须有的逃生门。
						*/}
						{streaming ? (
							// 二次确认：首次点击武装 3s 窗口（按钮内容换 Esc 徽章），
							// 窗口内再点（或再按 Esc）才真正中断，超时自动复原。
							<button
								type="button"
								className="send-btn stop"
								aria-label="停止"
								title={stopConfirm.phase === "pending" ? "再按一次确认停止" : "停止生成"}
								onClick={requestStop}
							>
								{stopConfirm.phase === "pending" ? <kbd className="stop-confirm-kbd">Esc</kbd> : <IconStop size={14} />}
							</button>
						) : (
							<button
								type="button"
								className="send-btn"
								aria-label="发送"
								onClick={submit}
								disabled={!ready || draft.trim() === "" || chars.over}
							>
								<IconSend size={16} />
							</button>
						)}
					</div>
				</div>
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
