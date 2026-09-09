/**
 * 应用壳：持有 daemon 连接、会话状态与视图路由。
 *
 * 三个视图（首页 / 对话页 / 设置页）布局对标 WorkBuddy，
 * 能力按纵切片逐步点亮：未实现的入口统一 toast「待做」，已实现的直接可用。
 *
 * 权限弹窗不属于任何视图 —— 它是阻塞式的，daemon 侧的工具执行正等着应答，
 * 所以渲染在视图之外，任何页面下都必须可见可作答。
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { PermissionRequest, PromptRequest, SessionSummary } from "@shared/ipc.ts";
import type { ImagePart } from "@shared/image.ts";
import type { SessionEvent, SessionSnapshot } from "@shared/session-events.ts";
import {
	conversationReducer,
	initialConversation,
} from "@shared/conversation.ts";
import { Sidebar, type LinkState } from "./sidebar.tsx";
import { HomeView } from "./home-view.tsx";
import { ChatView } from "./chat-view.tsx";
import { ArtifactPanel, sameSelection, type PreviewSelection } from "./artifact-panel.tsx";
import { collectChanges } from "@shared/artifacts.ts";
import { PermissionDialog } from "./permission-dialog.tsx";
import { SettingsView } from "./settings-view.tsx";
import { SkillsView } from "./skills-view.tsx";
import { DiagnosticsView } from "./diagnostics-view.tsx";
import { Toast, type ToastMessage } from "./toast.tsx";

type View = "home" | "chat" | "settings" | "skills" | "diagnostics";

/** 侧栏任务历史与对话页标题共用的截断长度。 */
const TITLE_MAX = 24;

function taskTitle(text: string): string {
	const oneLine = text.replace(/\s+/g, " ").trim();
	return oneLine.length > TITLE_MAX
		? `${oneLine.slice(0, TITLE_MAX)}…`
		: oneLine;
}

export function App(): React.JSX.Element {
	const [link, setLink] = useState<LinkState>({ kind: "connecting" });
	const [conversation, dispatch] = useReducer(
		conversationReducer,
		initialConversation,
	);
	const [view, setView] = useState<View>("home");
	/** 关闭设置页后要回到的视图。见下方 openSettings 的理由。 */
	const [returnView, setReturnView] = useState<"home" | "chat">("home");
	const [lastError, setLastError] = useState<string | undefined>(undefined);
	const [toast, setToast] = useState<ToastMessage | undefined>(undefined);
	const toastTimer = useRef<number | undefined>(undefined);
	/**
	 * 待审批队列，而不是单个槽位。
	 *
	 * pi 默认**并行**执行工具（agent 包 README：parallel 是默认模式），
	 * 所以同一批里可能同时来好几条审批请求。用单槽会覆盖掉后来的，
	 * 那些工具就永久挂在 daemon 侧等应答 —— 表现为任务卡死。
	 */
	const [approvals, setApprovals] = useState<readonly PermissionRequest[]>([]);
	/** 侧栏「任务」区的历史会话列表（daemon 组装好 title/current，UI 不推导）。 */
	const [taskList, setTaskList] = useState<readonly SessionSummary[]>([]);

	/**
	 * 历史会话列表刷新。
	 *
	 * 拉取失败静默吞掉：列表只是侧栏的导航入口，拿不到不影响会话本体
	 * （对话照常进行）。为辅助信息弹 toast 反而打扰，下一个触发点会再拉。
	 */
	const refreshTasks = useCallback(() => {
		window.kami.listSessions().then(setTaskList).catch(() => {});
	}, []);

	useEffect(() => {
		// StrictMode 下 effect 会跑两遍，卸载后的异步回调必须能被丢弃。
		let disposed = false;
		/** ready 信号可能到两次（推送 + 主动查询），快照只拉一次。 */
		let activated = false;

		const fail = (error: unknown): void => {
			if (!disposed)
				setLastError(error instanceof Error ? error.message : String(error));
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
			refreshTasks();
			// 预览服务 baseUrl 的初值（playground 启动时为 undefined）。
			window.kami
				.workspaceSnapshot()
				.then((snap) => {
					if (!disposed) setPreviewBaseUrl(snap.previewBaseUrl);
				})
				.catch(() => {
					// 拿不到就是不可预览，面板会显示引导文案，不需要额外报错。
				});
		};

		// 先注册监听，再主动查状态：顺序反了会漏掉两者之间到达的事件。
		const offEvent = window.kami.onSessionEvent((event: SessionEvent) => {
			dispatch({ type: "event", event });
			// present_files 交付：首个本地文件自动在预览面板打开（WorkBuddy：第一个自动打开）。
			if (event.type === "artifacts_presented" && event.focusFile !== undefined) {
				openPreview({ kind: "file", path: event.focusFile });
			}
			// 列表里的标题/时间/消息数只在 run 结束时才可能变，只在这个事件刷新。
			if (event.type === "run_finished") refreshTasks();
		});
		const offDown = window.kami.onDaemonDown(({ reason }) => {
			if (!disposed) setLink({ kind: "down", reason });
		});
		const offReady = window.kami.onDaemonReady(activate);
		// 追加而非替换：并行工具可能同时来多条，覆盖会让后来的工具永久挂住。
		const offPermission = window.kami.onPermissionRequest(
			(request: PermissionRequest) => {
				if (!disposed) setApprovals((queue) => [...queue, request]);
			},
		);

		// 消除竞态：daemon 可能在监听器注册之前就已就绪，那条推送已经丢了。
		window.kami
			.daemonStatus()
			.then((status) => {
				if (disposed) return;
				if (status.kind === "ready") activate();
				else if (status.kind === "down")
					setLink({ kind: "down", reason: status.reason });
			})
			.catch(fail);

		return () => {
			disposed = true;
			offEvent();
			offDown();
			offReady();
			offPermission();
		};
	}, []);

	// 新 toast 顶掉旧的，计时器也重置 —— 连续点不同入口时提示不会闪没。
	useEffect(() => {
		if (toast === undefined) return;
		window.clearTimeout(toastTimer.current);
		toastTimer.current = window.setTimeout(() => setToast(undefined), 2200);
		return () => window.clearTimeout(toastTimer.current);
	}, [toast]);

	/** 轻提示的统一出口（区别于 showTodo 的「待做」语义，这里是真实的错误/状态反馈）。 */
	const showToast = useCallback((text: string) => {
		setToast({ id: Date.now(), text });
	}, []);

	const showTodo = useCallback((feature: string) => {
		setToast({ id: Date.now(), text: `「${feature}」待做，随版本迭代开放` });
	}, []);

	const submit = useCallback(
		(text: string, images?: readonly ImagePart[]): Promise<void> => {
			if (link.kind !== "ready") return Promise.resolve();
			setLastError(undefined);
			setView("chat");
			// 空数组与缺省同义：不带 images 字段，payload 与无图版本完全一致。
			const request: PromptRequest =
				images !== undefined && images.length > 0 ? { text, images } : { text };
			// 错误先落进消息流（错误卡）再 rethrow：调用方靠成败决定附件去留
			// （成功才 clear，见两个视图的 submit）。
			return window.kami.prompt(request).catch((error: unknown) => {
				setLastError(error instanceof Error ? error.message : String(error));
				throw error;
			});
		},
		[link.kind],
	);

	/**
	 * 切换场景（对标 WorkBuddy 的 welcomemode 轴）。
	 *
	 * 不在本地 useState 里存选中项：场景决定根代理与系统提示词，
	 * 权威状态必须在 daemon 侧，UI 只反映 session_state 事件推回来的结果。
	 * 否则 UI 显示的场景与实际生效的提示词会漂移。
	 */
	const changeScene = useCallback(
		(sceneId: string) => {
			if (link.kind !== "ready") return;
			window.kami.setScene(sceneId).catch((error: unknown) => {
				showToast(error instanceof Error ? error.message : String(error));
			});
		},
		[link.kind],
	);

	/** 中断当前生成。
	 *
	 * 失败只提示、不落进对话流：中断失败通常是「已经停了」这类无害情况，
	 * 没必要在消息流里留一条错误。
	 */
	const abort = useCallback(() => {
		window.kami.abort().catch((error: unknown) => {
			showToast(error instanceof Error ? error.message : String(error));
		});
	}, []);

	/** 产物卡片点击：外部打开（系统关联程序）。面板里的「外部打开」也走这里。 */
	const openArtifact = useCallback(
		(path: string) => {
			window.kami.openArtifact(path).catch((error: unknown) => {
				showToast(error instanceof Error ? error.message : String(error));
			});
		},
		[showToast],
	);

	/** 预览面板的 tab 集合与激活项（对标 WorkBuddy DetailPanel 的多 tab）。空数组 = 面板关闭。 */
	const [previewTabs, setPreviewTabs] = useState<readonly PreviewSelection[]>([]);
	const [previewActive, setPreviewActive] = useState<PreviewSelection | undefined>(undefined);
	/** 静态服务 baseUrl，随工作空间快照刷新（playground 为 undefined）。 */
	const [previewBaseUrl, setPreviewBaseUrl] = useState<string | undefined>(undefined);

	/** 打开/激活预览对象：不在 tab 集合里自动补 tab（概览下拉与产物卡的唯一入口）。 */
	const openPreview = useCallback((sel: PreviewSelection) => {
		setPreviewTabs((tabs) => (tabs.some((t) => sameSelection(t, sel)) ? tabs : [...tabs, sel]));
		setPreviewActive(sel);
	}, []);

	const closePreviewTab = useCallback(
		(sel: PreviewSelection) => {
			const next = previewTabs.filter((t) => !sameSelection(t, sel));
			setPreviewTabs(next);
			if (previewActive !== undefined && sameSelection(previewActive, sel)) {
				setPreviewActive(next[next.length - 1]);
			}
		},
		[previewTabs, previewActive],
	);

	const closePreviewPanel = useCallback(() => {
		setPreviewTabs([]);
		setPreviewActive(undefined);
	}, []);

	/** 切换交互模式（对标 WorkBuddy 的 interactionmode 轴）。权威状态同样在 daemon 侧。 */
	const changeInteraction = useCallback(
		(interactionId: string) => {
			if (link.kind !== "ready") return;
			window.kami.setInteraction(interactionId).catch((error: unknown) => {
				showToast(error instanceof Error ? error.message : String(error));
			});
		},
		[link.kind],
	);

	/**
	 * 应答审批并出队。
	 *
	 * 无论应答成功与否都出队：失败通常意味着 daemon 已经不在了（进程退出、
	 * 或该请求已被别处应答），把弹窗留在屏幕上只会让用户反复点击一个死按钮。
	 */
	const decideApproval = useCallback(
		(id: string, decision: "allow" | "deny", remember: boolean) => {
			setApprovals((queue) => queue.filter((item) => item.id !== id));
			window.kami
				.respondToPermission({ id, decision, remember })
				.catch((error: unknown) => {
					showToast(error instanceof Error ? error.message : String(error));
				});
		},
		[],
	);

	/**
	 * 工作空间切换后重拉快照。
	 *
	 * 换空间会让 daemon 作废旧会话并清空历史（cwd 与会话终身绑定），
	 * 本地 reducer 里的 entries 不会自己消失，必须以服务端快照为准重同步。
	 */
	const resyncSnapshot = useCallback(() => {
		window.kami
			.snapshot()
			.then((snapshot: SessionSnapshot) =>
				dispatch({ type: "snapshot", snapshot }),
			)
			.catch((error: unknown) => {
				showToast(error instanceof Error ? error.message : String(error));
			});
		// 预览服务的根随工作区变了：baseUrl 与面板里开着的文件都要刷新。
		window.kami
			.workspaceSnapshot()
			.then((snap) => setPreviewBaseUrl(snap.previewBaseUrl))
			.catch(() => setPreviewBaseUrl(undefined));
		closePreviewPanel();
		// showToast 是稳定的 useCallback（空依赖），不需列入依赖数组。
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/**
	 * 新建任务：让 daemon 作废旧会话、开全新会话，然后回首页 + 重拉快照。
	 *
	 * 不只是切页面 —— 旧会话的消息历史必须由 daemon 真正作废，
	 * 否则两个任务共享 pi 的上下文，正是要根治的「任务干扰」。
	 * 工作空间选择保留（在哪个空间就在哪个空间开新任务）。
	 */
	const newTask = useCallback(() => {
		if (link.kind !== "ready") {
			setView("home");
			return;
		}
		window.kami
			.newTask()
			.then(() => {
				resyncSnapshot();
				// 旧会话有了消息，新会话成为 current —— 两处都让列表变了。
				refreshTasks();
				setView("home");
			})
			.catch((error: unknown) => {
				showToast(error instanceof Error ? error.message : String(error));
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [link.kind, resyncSnapshot]);

	/**
	 * 恢复历史会话：成功后重拉快照（会话整体换新，以服务端为准）并刷新
	 * 列表（current 标记易位）。失败 toast 且留在原视图 —— 恢复失败时
	 * daemon 侧的活动会话没变，界面不应假装已经切过去了。
	 */
	const resumeTask = useCallback(
		(path: string) => {
			window.kami
				.resumeSession(path)
				.then(() => {
					resyncSnapshot();
					refreshTasks();
					setView("chat");
				})
				.catch((error: unknown) => {
					showToast(error instanceof Error ? error.message : String(error));
				});
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[resyncSnapshot, refreshTasks],
	);

	/** 重命名：成功只刷列表 —— 对话页标题来自消息流，不随命名变。 */
	const renameTask = useCallback(
		(path: string, name: string) => {
			window.kami
				.renameSession(path, name)
				.then(() => refreshTasks())
				.catch((error: unknown) => {
					showToast(error instanceof Error ? error.message : String(error));
				});
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[refreshTasks],
	);

	/** 删除：成功只刷列表。当前活动会话由 daemon 拒删，reason 直接 toast 出来。 */
	const deleteTask = useCallback(
		(path: string) => {
			window.kami
				.deleteSession(path)
				.then(() => refreshTasks())
				.catch((error: unknown) => {
					showToast(error instanceof Error ? error.message : String(error));
				});
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[refreshTasks],
	);

	/**
	 * 导出会话为单文件 HTML：成功 toast 出文件路径并用系统关联程序打开
	 * （openArtifact 失败只 toast，文件已生成，不算导出失败）。
	 *
	 * 分两条路：
	 * - 点的是当前会话行：daemon 直接导出，界面只 toast + 打开。
	 *   不做 resync —— 快照会被同内容整体替换一遍，纯属多余切换。
	 * - 点的是历史会话行：daemon 会先恢复该会话再导出（当前上下文被切走），
	 *   所以必须像 resumeTask 一样重拉快照、刷新列表（current 易位）并落到对话页。
	 */
	const exportTask = useCallback(
		(path: string) => {
			const isCurrent = taskList.some((t) => t.path === path && t.current);
			window.kami
				.exportSession(path)
				.then(({ outputPath }) => {
					showToast(`已导出：${outputPath}`);
					openArtifact(outputPath);
					if (!isCurrent) {
						resyncSnapshot();
						refreshTasks();
						setView("chat");
					}
				})
				.catch((error: unknown) => {
					showToast(error instanceof Error ? error.message : String(error));
				});
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[taskList, resyncSnapshot, refreshTasks, openArtifact],
	);

	/**
	 * 打开设置时记住来路：从对话页进设置，关闭后应回到对话页而不是首页
	 * —— 否则用户配完模型回来发现对话没了。
	 */
	const openSettings = useCallback(() => {
		setReturnView(view === "chat" ? "chat" : "home");
		setView("settings");
	}, [view]);

	/** 诊断页同理：记住来路，关闭后回去。 */
	const openDiagnostics = useCallback(() => {
		setReturnView(view === "chat" ? "chat" : "home");
		setView("diagnostics");
	}, [view]);

	const firstUserText = conversation.entries.find(
		(e) => e.role === "user",
	)?.text;
	const title =
		firstUserText === undefined ? undefined : taskTitle(firstUserText);

	return (
		<div className="app">
			<Sidebar
				link={link}
				taskList={taskList}
				onNewTask={newTask}
				onResumeTask={resumeTask}
				onRenameTask={renameTask}
				onDeleteTask={deleteTask}
				onExportTask={exportTask}
				onOpenSettings={openSettings}
				onOpenDiagnostics={openDiagnostics}
				onOpenSkills={() => setView("skills")}
				onTodo={showTodo}
			/>
			{view === "home" && (
				<HomeView
					ready={link.kind === "ready"}
					scenes={conversation.availableScenes}
					sceneId={conversation.state.sceneId}
					modelId={conversation.state.modelId}
					cwd={conversation.state.cwd}
					onSceneChange={changeScene}
					onOpenSettings={openSettings}
					onError={showToast}
					onSubmit={submit}
					onWorkspaceChanged={resyncSnapshot}
					onTodo={showTodo}
				/>
			)}
			{view === "chat" && (
				<ChatView
					conversation={conversation}
					ready={link.kind === "ready"}
					lastError={lastError}
					title={title ?? "新任务"}
					onBack={() => setView("home")}
					onSubmit={submit}
					onAbort={abort}
					onInteractionChange={changeInteraction}
					onPreviewArtifact={(path) => {
					// URL 产物走外部打开（系统浏览器），不进预览面板 ——
					// 面板只服务本地文件（静态服务根=工作区）。
					if (/^https?:\/\//i.test(path)) openArtifact(path);
					else openPreview({ kind: "file", path });
				}}
					onOpenSettings={openSettings}
					onError={showToast}
					onTodo={showTodo}
				/>
			)}
			{/* 设置页自持滚动与返回按钮，不复用对话页的框架。 */}
			{view === "skills" && (
				<SkillsView
					onClose={() => setView(returnView)}
					onTodo={showTodo}
					onToast={showToast}
				/>
			)}
			{view === "settings" && (
				<SettingsView onClose={() => setView(returnView)} />
			)}
			{view === "diagnostics" && (
				<DiagnosticsView onClose={() => setView(returnView)} />
			)}
			{/* 产物预览面板：右侧常驻，与视图并列（对标 WorkBuddy 的 DetailPanel）。 */}
			{previewActive !== undefined && (
				<ArtifactPanel
					artifacts={conversation.artifacts}
					changes={collectChanges(conversation.entries)}
					cwd={conversation.state.cwd}
					previewBaseUrl={previewBaseUrl}
					tabs={previewTabs}
					active={previewActive}
					onOpen={openPreview}
					onCloseTab={closePreviewTab}
					onOpenExternal={openArtifact}
					onError={showToast}
				/>
			)}
			{/*
				一次只展示队首那条：并行工具可能同时来好几条，
				全都堆在屏幕上用户无从判断哪条对应哪个操作。
				作答后自动出队，下一条接着弹。
			*/}
			{approvals[0] !== undefined && (
				<PermissionDialog
					key={approvals[0].id}
					request={approvals[0]}
					onDecide={(decision, remember) => {
						const head = approvals[0];
						if (head !== undefined) decideApproval(head.id, decision, remember);
					}}
				/>
			)}
			<Toast message={toast} />
		</div>
	);
}
