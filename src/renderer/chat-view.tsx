/**
 * 任务对话页：消息流 + 底部输入。
 *
 * 视觉延续首页的输入卡，保证「首页发一句话 → 进入对话页」过渡不突兀。
 * 消息渲染基于 shared/conversation.ts 折叠出的 entries 视图。
 */

import { Fragment, useEffect, useRef, useState } from "react";
import type { ConversationView } from "@shared/conversation.ts";
import type { ConversationEntry, ModeDescriptor, ToolCard } from "@shared/session-events.ts";
import { IconBack, IconChevronDown, IconDoc, IconMic, IconPlus, IconSend, IconStop } from "./icons.tsx";
import { useAutocomplete } from "./autocomplete.tsx";
import { ContextUsageRing } from "./context-usage.tsx";
import { Markdown } from "./markdown.tsx";

interface ChatViewProps {
	readonly conversation: ConversationView;
	readonly ready: boolean;
	/** 提交失败的原因（如未选模型），显示在消息流末尾。 */
	readonly lastError: string | undefined;
	readonly title: string;
	readonly onBack: () => void;
	readonly onSubmit: (text: string) => void;
	readonly onAbort: () => void;
	readonly onInteractionChange: (interactionId: string) => void;
	/** 点击产物卡片：在右侧面板预览（面板里有外部打开入口）。 */
	readonly onPreviewArtifact: (path: string) => void;
	readonly onTodo: (feature: string) => void;
}

/* ── 思考块 ────────────────────────────────────────────────────── */

/**
 * 思考内容块。对标 WorkBuddy 的「深度思考」形态：默认折叠成一行标题，
 * 点击展开全文 —— 模型长推导过程平铺在正文里会冲掉最终回答。
 * 流式期间 thinking 还在累积，先展开让用户看到过程；完成后收起。
 */
function ThinkingBlock({ text }: { readonly text: string }): React.JSX.Element {
	const [open, setOpen] = useState(false);

	return (
		<div className="thinking-block">
			<button type="button" className="thinking-head" onClick={() => setOpen((v) => !v)}>
				<IconChevronDown size={11} className={open ? "thinking-caret open" : "thinking-caret"} />
				深度思考
			</button>
			{open && <pre className="thinking-body">{text}</pre>}
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
				<span className="tool-label">{card.label}</span>
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
 */
function TurnHeader({
	active,
	startedAt,
}: {
	readonly active: boolean;
	readonly startedAt: number | undefined;
}): React.JSX.Element {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		const timer = window.setInterval(() => setNow(Date.now()), 500);
		return () => window.clearInterval(timer);
	}, [active]);

	return (
		<div className="turn-header">
			<span className="turn-agent">KamiBuddy</span>
			<span className="turn-duration">
				{active && startedAt !== undefined ? `已处理 ${formatDuration(now - startedAt)}` : "已完成"}
			</span>
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

/* ── 主体 ────────────────────────────────────────────────────────── */

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
	onTodo,
}: ChatViewProps): React.JSX.Element {
	const [draft, setDraft] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const streaming = conversation.state.isStreaming;
	// 产物清单：present_files 交付折叠而来（唯一来源，不再从 write 推导）。
	const artifacts = conversation.artifacts;
	// 最后一个 user 消息的位置：当前回合的分界（回合头部走表的唯一依据）。
	const lastUserIndex = conversation.entries.findLastIndex((e) => e.role === "user");
	// @ / 补全：触发与选中逻辑全在 hook 里，这里只接管 ref 与值；cwd 变化时重拉数据源。
	const ac = useAutocomplete(draft, setDraft, textareaRef, conversation.state.cwd);

	// 新内容到达时贴底。用 scrollHeight 而非 scrollIntoView，避免流式增量时抖动。
	useEffect(() => {
		const node = scrollRef.current;
		if (node !== null) node.scrollTop = node.scrollHeight;
	}, [conversation.entries]);

	const submit = (): void => {
		const text = draft.trim();
		if (text === "" || !ready) return;
		setDraft("");
		onSubmit(text);
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
				<ModeSwitch
					interactions={conversation.availableModes}
					currentId={conversation.state.interactionId}
					onChange={onInteractionChange}
					onTodo={onTodo}
				/>
			</header>

			<div className="stream" ref={scrollRef}>
				{/*
					回合头部的插入位置：每条 user 消息之后、助手回应之前；
					user 是最后一条（等响应）时补在末尾。只有最后一个 user 消息
					所在的回合是「当前回合」—— 它的头部走表，历史回合恒为已完成
					（computeTurnActive 同口径：最后 user 组及其之后共享当前回合）。
				*/}
				{conversation.entries.map((entry, index) => {
					const prev = conversation.entries[index - 1];
					const headerHere =
						prev?.role === "user" && entry.role !== "user" ? index - 1 : undefined;
					const trailingHeader = index === conversation.entries.length - 1 && entry.role === "user";
					const header = (userIndex: number) => (
						<TurnHeader
							key={`turn-${conversation.entries[userIndex]?.id ?? userIndex}`}
							active={streaming && userIndex === lastUserIndex}
							startedAt={conversation.turn?.startedAt}
						/>
					);
					return (
						<Fragment key={entry.id}>
							{headerHere !== undefined && header(headerHere)}
							{entry.role === "tool" ? (
								<ToolEntry card={entry} />
							) : (
								<div className={`entry ${entry.role}`}>
									{entry.role === "assistant" && entry.thinking !== undefined && (
										<ThinkingBlock text={entry.thinking} />
									)}
									{/* 助手消息走 Markdown 渲染；用户消息保持纯文本（聊天气泡，不排版）。 */}
									{entry.role === "assistant" ? (
										<Markdown text={entry.text} />
									) : (
										<div className="text">{entry.text}</div>
									)}
								</div>
							)}
							{trailingHeader && header(index)}
						</Fragment>
					);
				})}
				{streaming && <div className="stream-pending">{pendingText(conversation.entries)}</div>}
				{/*
					产物卡片区：present_files 交付的文件（文件名 + 大小，对齐
					WorkBuddy 的 snake.html 7.3 KB 卡片）。流式期间不显示 ——
					交付一般发生在收尾，且流式中面板已被自动打开。
				*/}
				{!streaming && artifacts.length > 0 && (
					<section className="artifacts">
						<header className="artifacts-header">产物（{artifacts.length}）</header>
						{artifacts.map((a) => (
							<button
								key={a.path}
								type="button"
								className="artifact-card"
								title={`${a.path}（点击预览）`}
								onClick={() => onPreviewArtifact(a.path)}
							>
								<IconDoc size={16} />
								<span className="artifact-name">{a.path.split(/[\\/]/).pop()}</span>
								{a.size > 0 && <span className="artifact-size">{formatSize(a.size)}</span>}
							</button>
						))}
					</section>
				)}
				{lastError !== undefined && <div className="entry error">{lastError}</div>}
			</div>

			<footer className="chat-composer">
				<div className="composer-card">
					<div className="composer-input">
						{ac.menu}
						<textarea
							ref={textareaRef}
							value={draft}
							onChange={ac.bind.onChange}
							onSelect={ac.bind.onSelect}
							onBlur={ac.bind.onBlur}
							onKeyDown={(e) => {
								ac.bind.onKeyDown(e);
								// ac 打开时已 preventDefault（Enter=选中），这里只对未被消费的 Enter 发送。
								if (e.key === "Enter" && !e.shiftKey && !e.defaultPrevented) {
									e.preventDefault();
									submit();
								}
							}}
							// 流式期间仍可输入：发出去会作为 steer 插进当前这轮（SessionHost.prompt）。
							placeholder={ready ? (streaming ? "补充说明会插入当前任务…" : "继续追问…") : "引擎启动中…"}
							disabled={!ready}
							rows={2}
						/>
					</div>
					<div className="composer-bar">
						<button type="button" className="bar-btn" aria-label="添加附件" onClick={() => onTodo("附件引用")}>
							<IconPlus size={17} />
						</button>
						<span className="bar-spacer" />
						<button type="button" className="bar-btn" aria-label="语音输入" onClick={() => onTodo("语音输入")}>
							<IconMic size={16} />
						</button>
						{/* 上下文饱和度常驻指示（used/total 精确值），点击看分类估算。 */}
						{conversation.usageDetail !== undefined && <ContextUsageRing detail={conversation.usageDetail} />}
						{/*
							流式期间发送键变中断键。
							没有中断入口时，模型跑偏或长任务只能干等，甚至杀进程 —— 这是必须有的逃生门。
						*/}
						{streaming ? (
							<button type="button" className="send-btn stop" aria-label="停止" title="停止生成" onClick={onAbort}>
								<IconStop size={14} />
							</button>
						) : (
							<button
								type="button"
								className="send-btn"
								aria-label="发送"
								onClick={submit}
								disabled={!ready || draft.trim() === ""}
							>
								<IconSend size={16} />
							</button>
						)}
					</div>
				</div>
			</footer>
		</main>
	);
}
