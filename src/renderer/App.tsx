import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { SessionEvent, SessionSnapshot } from "@shared/session-events.ts";
import { conversationReducer, initialConversation } from "./conversation.ts";

/** daemon 连接状态。UI 据此决定输入框可用性与提示文案。 */
type Link = { readonly kind: "connecting" } | { readonly kind: "ready" } | { readonly kind: "down"; readonly reason: string };

export function App(): React.JSX.Element {
	const [link, setLink] = useState<Link>({ kind: "connecting" });
	const [conversation, dispatch] = useReducer(conversationReducer, initialConversation);
	const [draft, setDraft] = useState("");
	/** 最近一次操作失败的原因。D2 阶段 prompt 必然失败，把它显示出来才能确认桥路通了。 */
	const [lastError, setLastError] = useState<string | undefined>(undefined);
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// StrictMode 下 effect 会跑两遍，卸载后的异步回调必须能被丢弃。
		let disposed = false;
		/** ready 信号可能到两次（推送 + 主动查询），快照只拉一次。 */
		let activated = false;

		const fail = (error: unknown): void => {
			if (!disposed) setLastError(error instanceof Error ? error.message : String(error));
		};

		const activate = (): void => {
			if (disposed || activated) return;
			activated = true;
			setLink({ kind: "ready" });
			window.kami
				.snapshot()
				.then((snapshot: SessionSnapshot) => {
					if (!disposed) dispatch({ type: "snapshot", snapshot });
				})
				.catch(fail);
		};

		// 先注册监听，再主动查状态：顺序反了会漏掉两者之间到达的事件。
		const offEvent = window.kami.onSessionEvent((event: SessionEvent) => dispatch({ type: "event", event }));
		const offDown = window.kami.onDaemonDown(({ reason }) => {
			if (!disposed) setLink({ kind: "down", reason });
		});
		const offReady = window.kami.onDaemonReady(activate);

		// 消除竞态：daemon 可能在监听器注册之前就已就绪，那条推送已经丢了。
		window.kami
			.daemonStatus()
			.then((status) => {
				if (disposed) return;
				if (status.kind === "ready") activate();
				else if (status.kind === "down") setLink({ kind: "down", reason: status.reason });
			})
			.catch(fail);

		return () => {
			disposed = true;
			offEvent();
			offDown();
			offReady();
		};
	}, []);

	// 新内容到达时贴底。用 scrollHeight 而非 scrollIntoView，避免流式增量时抖动。
	useEffect(() => {
		const node = scrollRef.current;
		if (node !== null) node.scrollTop = node.scrollHeight;
	}, [conversation.entries]);

	const submit = useCallback(() => {
		const text = draft.trim();
		if (text === "" || link.kind !== "ready") return;
		setDraft("");
		setLastError(undefined);
		window.kami.prompt({ text }).catch((error: unknown) => {
			setLastError(error instanceof Error ? error.message : String(error));
		});
	}, [draft, link.kind]);

	const currentMode = conversation.availableModes.find((m) => m.id === conversation.state.modeId);

	return (
		<div className="app">
			<header className="bar">
				<span className="brand">KamiBuddy</span>
				<span className={`link link-${link.kind}`}>
					{link.kind === "connecting" && "正在启动…"}
					{link.kind === "ready" && (currentMode?.label ?? conversation.state.modeId)}
					{link.kind === "down" && `已断开：${link.reason}`}
				</span>
			</header>

			<div className="stream" ref={scrollRef}>
				{conversation.entries.length === 0 && link.kind === "ready" && (
					<p className="hint">骨架已就绪。会话接入在 D3。</p>
				)}
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
				{lastError !== undefined && <div className="entry error">{lastError}</div>}
			</div>

			<footer className="composer">
				<textarea
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						// Enter 发送，Shift+Enter 换行 —— 与聊天类应用的通行约定一致。
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							submit();
						}
					}}
					placeholder={link.kind === "ready" ? "说点什么…" : "等待 daemon…"}
					disabled={link.kind !== "ready"}
					rows={3}
				/>
				<button type="button" onClick={submit} disabled={link.kind !== "ready" || draft.trim() === ""}>
					发送
				</button>
			</footer>
		</div>
	);
}
