/**
 * 任务对话页：消息流 + 底部输入。
 *
 * 视觉延续首页的输入卡，保证「首页发一句话 → 进入对话页」过渡不突兀。
 * 消息渲染基于 shared/conversation.ts 折叠出的 entries 视图。
 */

import { useEffect, useRef, useState } from "react";
import type { ConversationView } from "@shared/conversation.ts";
import type { ModeDescriptor, ToolCard } from "@shared/session-events.ts";
import { collectArtifacts } from "@shared/artifacts.ts";
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
	/** 点击产物卡片（v1：外部打开；预览面板接入后改成打开面板）。 */
	readonly onOpenArtifact: (path: string) => void;
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
				<span className="tool-label">{card.label}</span>
				<span className="tool-summary">{card.summary}</span>
				{/* write/edit 成功后的增删行徽章（对标 WorkBuddy 的「创建 path +276 -0」）。 */}
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
	onOpenArtifact,
	onTodo,
}: ChatViewProps): React.JSX.Element {
	const [draft, setDraft] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const streaming = conversation.state.isStreaming;
	// 产物清单：从工具卡片推导（write 成功 = 产物），整会话聚合。
	// 我们一会话一任务，「本会话产物」就是「本任务产物」（WorkBuddy 的口径）。
	const artifacts = collectArtifacts(conversation.entries);
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
				{conversation.entries.map((entry) => {
					if (entry.role === "tool") return <ToolEntry key={entry.id} card={entry} />;
					return (
						<div key={entry.id} className={`entry ${entry.role}`}>
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
					);
				})}
				{streaming && <div className="stream-pending">正在思考…</div>}
				{/*
					产物卡片区：本会话 write 成功的文件（collectArtifacts 从工具卡片推导，
					规则见 shared/artifacts.ts）。流式期间不显示 —— 产物可能还没写完。
				*/}
				{!streaming && artifacts.length > 0 && (
					<section className="artifacts">
						<header className="artifacts-header">产物（{artifacts.length}）</header>
						{artifacts.map((a) => (
							<button
								key={a.path}
								type="button"
								className="artifact-card"
								title={`${a.path}（点击外部打开）`}
								onClick={() => onOpenArtifact(a.path)}
							>
								<IconDoc size={16} />
								<span className="artifact-name">{a.path.split(/[\\/]/).pop()}</span>
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
