/**
 * 任务对话页：消息流 + 底部输入。
 *
 * 视觉延续首页的输入卡，保证「首页发一句话 → 进入对话页」过渡不突兀。
 * 消息渲染逻辑与原骨架一致（conversation.ts 的 entries 视图）。
 */

import { useEffect, useRef, useState } from "react";
import type { ConversationView } from "./conversation.ts";
import { IconBack, IconChevronDown, IconMic, IconPlus, IconSend } from "./icons.tsx";

interface ChatViewProps {
	readonly conversation: ConversationView;
	readonly ready: boolean;
	/** 提交失败的原因（D3 前 prompt 必然失败，显示出来才能确认桥路通了）。 */
	readonly lastError: string | undefined;
	readonly title: string;
	readonly modeLabel: string;
	readonly onBack: () => void;
	readonly onSubmit: (text: string) => void;
	readonly onTodo: (feature: string) => void;
}

export function ChatView({
	conversation,
	ready,
	lastError,
	title,
	modeLabel,
	onBack,
	onSubmit,
	onTodo,
}: ChatViewProps): React.JSX.Element {
	const [draft, setDraft] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);

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
				<button type="button" className="bar-btn bar-btn-text" onClick={() => onTodo("模式切换")}>
					{modeLabel}
					<IconChevronDown size={13} />
				</button>
			</header>

			<div className="stream" ref={scrollRef}>
				{conversation.entries.map((entry) => {
					if (entry.role === "tool") {
						return (
							<div key={entry.id} className="entry tool">
								<span className="tool-label">{entry.label}</span>
								<span className="tool-summary">{entry.summary}</span>
							</div>
						);
					}
					return (
						<div key={entry.id} className={`entry ${entry.role}`}>
							{entry.role === "assistant" && entry.thinking !== undefined && (
								<pre className="thinking">{entry.thinking}</pre>
							)}
							<div className="text">{entry.text}</div>
						</div>
					);
				})}
				{conversation.state.isStreaming && <div className="stream-pending">正在思考…</div>}
				{lastError !== undefined && <div className="entry error">{lastError}</div>}
			</div>

			<footer className="chat-composer">
				<div className="composer-card">
					<textarea
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								submit();
							}
						}}
						placeholder={ready ? "继续追问…" : "引擎启动中…"}
						disabled={!ready}
						rows={2}
					/>
					<div className="composer-bar">
						<button type="button" className="bar-btn" aria-label="添加附件" onClick={() => onTodo("附件引用")}>
							<IconPlus size={17} />
						</button>
						<span className="bar-spacer" />
						<button type="button" className="bar-btn" aria-label="语音输入" onClick={() => onTodo("语音输入")}>
							<IconMic size={16} />
						</button>
						<button
							type="button"
							className="send-btn"
							aria-label="发送"
							onClick={submit}
							disabled={!ready || draft.trim() === ""}
						>
							<IconSend size={16} />
						</button>
					</div>
				</div>
			</footer>
		</main>
	);
}
