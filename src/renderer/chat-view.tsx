/**
 * 任务对话页：消息流 + 底部输入。
 *
 * 视觉延续首页的输入卡，保证「首页发一句话 → 进入对话页」过渡不突兀。
 * 消息渲染基于 shared/conversation.ts 折叠出的 entries 视图。
 */

import { Fragment, useEffect, useRef, useState } from "react";
import type { ConversationView } from "@shared/conversation.ts";
import type { ConversationEntry, ModeDescriptor, ToolCard, TurnTiming } from "@shared/session-events.ts";
import { WAITING_SOOTHED_TEXT, WAITING_TIPS } from "@shared/waiting-tips.ts";
import { IconBack, IconChevronDown, IconDoc, IconMic, IconPlus, IconSend, IconStop } from "./icons.tsx";
import { useAutocomplete } from "./autocomplete.tsx";
import { ContextUsageRing } from "./context-usage.tsx";
import { shouldSwallowEnter } from "./ime-guard.ts";
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
	readonly onSubmit: (text: string) => void;
	readonly onAbort: () => void;
	readonly onInteractionChange: (interactionId: string) => void;
	/** 点击产物卡片：在右侧面板预览（面板里有外部打开入口）。 */
	readonly onPreviewArtifact: (path: string) => void;
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
	// 等待 tips 的「× 关闭」：会话级（本组件存活期内）承诺，跨回合不复活。
	const [tipsDismissed, setTipsDismissed] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	// IME 状态走 ref 而非 state：guard 在 keydown 里同步读，不需要触发重渲染。
	const imeRef = useRef({ composing: false, lastCompositionEndAt: 0 });
	const streaming = conversation.state.isStreaming;
	// 产物清单：present_files 交付折叠而来（唯一来源，不再从 write 推导）。
	const artifacts = conversation.artifacts;
	// 最后一个 user 消息的位置：当前回合的分界（回合头部走表的唯一依据）。
	const lastUserIndex = conversation.entries.findLastIndex((e) => e.role === "user");
	// 等待首响应阶段：与 pendingText 返回「等待模型响应…」同口径（末尾是 user 或流为空）。
	// tips 轮播与 8s 安抚文案只在这个阶段计时，「正在写入文件…」等阶段不出现。
	const lastEntry = conversation.entries[conversation.entries.length - 1];
	const awaitingFirstResponse = streaming && (lastEntry === undefined || lastEntry.role === "user");
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

	// 渲染消息流时跟踪「当前条目属于哪个回合」（回合 = 最后一条 user 消息及其后条目），
	// 供「用户已取消」指示行定位。map 回调里就地更新，不开第二遍循环。
	let currentTurnUserId: string | undefined;

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
				if (entry.role === "user") currentTurnUserId = entry.id;
				const prev = conversation.entries[index - 1];
				const headerHere =
					prev?.role === "user" && entry.role !== "user" ? index - 1 : undefined;
				const trailingHeader = index === conversation.entries.length - 1 && entry.role === "user";
				const header = (userIndex: number) => (
					<TurnHeader
						key={`turn-${conversation.entries[userIndex]?.id ?? userIndex}`}
						active={streaming && userIndex === lastUserIndex}
						turn={userIndex === lastUserIndex ? conversation.turn : undefined}
					/>
				);
				/*
				 * 「用户已取消」指示行：回合末尾（下一条是 user 或已到流尾）且
				 * 该回合在取消名单里时渲染。取消名单由 reducer 维护，新回合开始后
				 * 指示行仍留在历史里对应回合的末尾。
				 */
				const turnEndsHere =
					index === conversation.entries.length - 1 ||
					conversation.entries[index + 1]?.role === "user";
				const cancelledHere =
					turnEndsHere &&
					currentTurnUserId !== undefined &&
					conversation.cancelledTurns.includes(currentTurnUserId);
				return (
					<Fragment key={entry.id}>
						{headerHere !== undefined && header(headerHere)}
						{entry.role === "tool" ? (
							<ToolEntry card={entry} />
						) : (
							<div className={`entry ${entry.role}`}>
								{/*
									thinking 的流式判定：该条是 entries 末尾的助手消息且会话在流式。
									assistant_done 后它不再是末尾（后续工具卡/新消息接上来）或
									isStreaming 翻 false，扫光与自动展开同时停止。
								*/}
								{entry.role === "assistant" && entry.thinking !== undefined && (
									<ThinkingBlock
										text={entry.thinking}
										streaming={streaming && index === conversation.entries.length - 1}
									/>
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
						{cancelledHere && <div className="user-cancelled">用户已取消</div>}
					</Fragment>
				);
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
							onCompositionStart={() => {
							imeRef.current.composing = true;
						}}
						onCompositionEnd={() => {
							// compositionend 先于它携带的那个 keydown 触发（React 合成事件顺序），
							// 所以宽限期必须靠时间戳判定，不能只靠 composing 布尔（见 ime-guard.ts）。
							imeRef.current.composing = false;
							imeRef.current.lastCompositionEndAt = Date.now();
						}}
						onKeyDown={(e) => {
							// ac 先行：补全打开时 Enter=选中（已 preventDefault），守卫不插手它的消费顺序。
							ac.bind.onKeyDown(e);
							if (e.key === "Enter" && !e.defaultPrevented) {
								// IME 守卫：选词确认的 Enter 发送与换行（含 Shift+Enter）都吞。
								if (shouldSwallowEnter({ ...imeRef.current, now: Date.now() })) {
									e.preventDefault();
									return;
								}
								if (!e.shiftKey) {
									e.preventDefault();
									submit();
								}
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
