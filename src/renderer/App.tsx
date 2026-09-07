/**
 * 应用壳：持有 daemon 连接、会话状态与视图路由。
 *
 * 视图只有「首页 / 对话页」两种 —— 布局对标 WorkBuddy，
 * 但能力按纵切片逐步点亮：未实现的入口统一 toast「待做」，
 * 已实现的（发消息、收事件）直接可用。
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { SessionEvent, SessionSnapshot } from "@shared/session-events.ts";
import { conversationReducer, initialConversation } from "./conversation.ts";
import { Sidebar, type LinkState } from "./sidebar.tsx";
import { HomeView } from "./home-view.tsx";
import { ChatView } from "./chat-view.tsx";
import { Toast, type ToastMessage } from "./toast.tsx";

type View = "home" | "chat";

/** 侧栏任务历史与对话页标题共用的截断长度。 */
const TITLE_MAX = 24;

function taskTitle(text: string): string {
	const oneLine = text.replace(/\s+/g, " ").trim();
	return oneLine.length > TITLE_MAX ? `${oneLine.slice(0, TITLE_MAX)}…` : oneLine;
}

export function App(): React.JSX.Element {
	const [link, setLink] = useState<LinkState>({ kind: "connecting" });
	const [conversation, dispatch] = useReducer(conversationReducer, initialConversation);
	const [view, setView] = useState<View>("home");
	const [lastError, setLastError] = useState<string | undefined>(undefined);
	const [toast, setToast] = useState<ToastMessage | undefined>(undefined);
	const toastTimer = useRef<number | undefined>(undefined);

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

	// 新 toast 顶掉旧的，计时器也重置 —— 连续点不同入口时提示不会闪没。
	useEffect(() => {
		if (toast === undefined) return;
		window.clearTimeout(toastTimer.current);
		toastTimer.current = window.setTimeout(() => setToast(undefined), 2200);
		return () => window.clearTimeout(toastTimer.current);
	}, [toast]);

	const showTodo = useCallback((feature: string) => {
		setToast({ id: Date.now(), text: `「${feature}」待做，随版本迭代开放` });
	}, []);

	const submit = useCallback(
		(text: string) => {
			if (link.kind !== "ready") return;
			setLastError(undefined);
			setView("chat");
			window.kami.prompt({ text }).catch((error: unknown) => {
				setLastError(error instanceof Error ? error.message : String(error));
			});
		},
		[link.kind],
	);

	const firstUserText = conversation.entries.find((e) => e.role === "user")?.text;
	const title = firstUserText === undefined ? undefined : taskTitle(firstUserText);
	const currentMode = conversation.availableModes.find((m) => m.id === conversation.state.modeId);

	return (
		<div className="app">
			<Sidebar
				link={link}
				currentTaskTitle={title}
				onNewTask={() => setView("home")}
				onOpenTask={() => setView("chat")}
				onTodo={showTodo}
			/>
			{view === "home" ? (
				<HomeView ready={link.kind === "ready"} onSubmit={submit} onTodo={showTodo} />
			) : (
				<ChatView
					conversation={conversation}
					ready={link.kind === "ready"}
					lastError={lastError}
					title={title ?? "新任务"}
					modeLabel={currentMode?.label ?? conversation.state.modeId}
					onBack={() => setView("home")}
					onSubmit={submit}
					onTodo={showTodo}
				/>
			)}
			<Toast message={toast} />
		</div>
	);
}
