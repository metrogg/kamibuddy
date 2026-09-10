/**
 * 应用壳：持有 daemon 连接、会话状态与视图路由。
 *
 * 三个视图（首页 / 对话页 / 设置页）布局对标 WorkBuddy，
 * 能力按纵切片逐步点亮：未实现的入口统一 toast「待做」，已实现的直接可用。
 *
 * 权限弹窗不属于任何视图 —— 它是阻塞式的，daemon 侧的工具执行正等着应答，
 * 所以渲染在视图之外，任何页面下都必须可见可作答。
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type {
	AutomationEvent,
	PermissionRequest,
	PromptRequest,
	QuestionnaireRequest,
	QuestionnaireResponse,
	SessionSummary,
	WorkspaceGroupMeta,
} from "@shared/ipc.ts";
import type { ImagePart } from "@shared/image.ts";
import type { SessionEventEnvelope, SessionSnapshot } from "@shared/session-events.ts";
import {
	conversationReducer,
	initialConversation,
} from "@shared/conversation.ts";
import { Sidebar, type LinkState } from "./sidebar.tsx";
import { groupSessions } from "./session-groups.ts";
import { HomeView } from "./home-view.tsx";
import { ChatView } from "./chat-view.tsx";
import { ArtifactPanel, sameSelection, type PreviewSelection } from "./artifact-panel.tsx";
import { collectChanges } from "@shared/artifacts.ts";
import { PermissionDialog } from "./permission-dialog.tsx";
import { QuestionnaireDialog } from "./questionnaire-dialog.tsx";
import { SettingsView } from "./settings-view.tsx";
import { SkillsView } from "./skills-view.tsx";
import { DiagnosticsView } from "./diagnostics-view.tsx";
import { AutomationsView } from "./automations-view.tsx";
import { Toast, type ToastMessage, type ToastType } from "./toast.tsx";

type View = "home" | "chat" | "settings" | "skills" | "diagnostics" | "automations";

/** 侧栏任务历史与对话页标题共用的截断长度。 */
const TITLE_MAX = 24;

/** 产物面板开关图标（右侧栏隐喻：三条竖线，右条加粗表示面板）。随开关按钮从 chat-header 移到 App 层右上角。 */
function IconPanelRight({ size = 16 }: { readonly size?: number }): React.JSX.Element {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
			<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
			<path d="M10.5 2.5v11" />
		</svg>
	);
}

/** 侧栏开关图标（左侧栏隐喻：左条加粗表示侧栏）。随开关按钮从 chat-header 移到 App 层左上角。 */
function IconPanelLeft({ size = 16 }: { readonly size?: number }): React.JSX.Element {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
			<rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
			<path d="M5.5 2.5v11" />
		</svg>
	);
}

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
		undefined,
		() => initialConversation,
	);
	const [view, setView] = useState<View>("home");
	/** 「任务进行中」拒绝后的待恢复会话（二次确认「停止当前任务并切换」）。 */
	const [pendingResume, setPendingResume] = useState<
		{ readonly path: string; readonly message: string } | undefined
	>(undefined);
	/** 关闭设置页后要回到的视图。见下方 openSettings 的理由。 */
	const [returnView, setReturnView] = useState<"home" | "chat">("home");
	const [lastError, setLastError] = useState<string | undefined>(undefined);
	const [toasts, setToasts] = useState<readonly ToastMessage[]>([]);
	/**
	 * 待审批队列，而不是单个槽位。
	 *
	 * pi 默认**并行**执行工具（agent 包 README：parallel 是默认模式），
	 * 所以同一批里可能同时来好几条审批请求。用单槽会覆盖掉后来的，
	 * 那些工具就永久挂在 daemon 侧等应答 —— 表现为任务卡死。
	 */
	const [approvals, setApprovals] = useState<readonly PermissionRequest[]>([]);
	/**
	 * 问卷队列，与 approvals 同款语义：pi 并行工具可能同时来多条提问，
	 * 单槽会覆盖掉后来的，那些工具就永久挂在 daemon 侧等答。
	 */
	const [questionnaires, setQuestionnaires] = useState<readonly QuestionnaireRequest[]>([]);
	/** 侧栏「任务」区的历史会话列表（daemon 组装好 title/current，UI 不推导）。 */
	const [taskList, setTaskList] = useState<readonly SessionSummary[]>([]);
	/** 「空间」组的名称覆盖元数据（workspaces.json），组本身由会话派生。 */
	const [groupMetas, setGroupMetas] = useState<readonly WorkspaceGroupMeta[]>([]);
	/**
	 * 未读会话 path 集合（标题前绿点）。渲染进程内存态，重启清零 ——
	 * 持久化未读是规格书明确留后续的事，这里不兜底。
	 */
	const [unreadPaths, setUnreadPaths] = useState<ReadonlySet<string>>(new Set());
	/**
	 * run_finished 监听只注册一次，闭包里的 view/taskList 永远是初值，
	 * 未读判定需要的最新值必须走 ref（同 autocomplete.tsx 的 openRef 模式，
	 * 渲染期赋值换取事件回调里的当下值）。
	 */
	const viewRef = useRef(view);
	viewRef.current = view;
	const taskListRef = useRef(taskList);
	taskListRef.current = taskList;

	/**
	 * 历史会话列表刷新（同时重拉空间元数据）。
	 *
	 * 拉取失败静默吞掉：列表只是侧栏的导航入口，拿不到不影响会话本体
	 * （对话照常进行）。为辅助信息弹 toast 反而打扰，下一个触发点会再拉。
	 * metas 与 sessions 独立拉取（不 Promise.all）：一条失败不该拖死另一条，
	 * 组名回退 basename 后列表仍可用。
	 */
	const refreshTasks = useCallback(() => {
		window.kami.listSessions().then(setTaskList).catch(() => { });
		window.kami.listWorkspaceGroups().then(setGroupMetas).catch(() => { });
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
			// 预览服务 baseUrl 的初值（静态服务未起时为 undefined）。
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
		// 契约是 SessionEventEnvelope（sessionId 路由键 + 事件本体）——单视图
		// 今天只消费本体；信封不拆直接当事件 dispatch 的话，reducer 的 switch
		// 全部落空返回 undefined，React 把会话状态置空，下一帧整树白屏。
		// 按 sessionId 分桶是多会话视图的后续工作（另一边在途），这里不做。
		const offEvent = window.kami.onSessionEvent((envelope: SessionEventEnvelope) => {
			const { event } = envelope;
			dispatch({ type: "event", event });
			// present_files 交付：首个本地文件自动在预览面板打开，且面板自动展开
			//（WorkBuddy：第一个自动打开 + 交付时面板若收起则展开）。
			if (event.type === "artifacts_presented") {
				setPanelOpen(true);
				if (event.focusFile !== undefined) openPreview({ kind: "file", path: event.focusFile });
			}
			// 列表里的标题/时间/消息数只在 run 结束时才可能变，只在这个事件刷新。
			if (event.type === "run_finished") {
				refreshTasks();
				// 未读：用户不在对话页看着它完成时，给当前会话打绿点。
				// 单 daemon 单会话，run_finished 一定属于当前活动会话 ——
				// 取列表里的 current 项即可；极端竞态（列表还没刷出 current）
				// 取不到就不加，下一次 refreshTasks 后列表本身已是最新，不漏信息。
				if (viewRef.current !== "chat") {
					const currentPath = taskListRef.current.find((t) => t.current)?.path;
					if (currentPath !== undefined) {
						setUnreadPaths((prev) => {
							if (prev.has(currentPath)) return prev;
							const next = new Set(prev);
							next.add(currentPath);
							return next;
						});
					}
				}
			}
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
		// 问卷与审批同款的入队语义（理由见上）。
		const offQuestionnaire = window.kami.onQuestionnaireRequest(
			(request: QuestionnaireRequest) => {
				if (!disposed) setQuestionnaires((queue) => [...queue, request]);
			},
		);
		/*
		 * 定时任务推送。changed（任务增删改/启停）不需要 App 层动作 ——
		 * 管理页挂在时自己订阅了同一事件重拉列表（侧栏不展示任务数据）。
		 * runFinished 要在这里处理：toast 全局可见，且后台 run 的会话事件
		 * 不转发 renderer（见 daemon 的 run 执行器），下面的 run_finished
		 * 分支覆盖不到它 —— 侧栏列表刷新与未读标记都得在这条推送里补。
		 */
		const offAutomation = window.kami.onAutomationEvent(
			(event: AutomationEvent) => {
				if (disposed || event.kind !== "runFinished") return;
				showToast(
					event.success
						? `任务「${event.taskName}」已完成`
						: `任务「${event.taskName}」运行失败`,
					event.success ? "success" : "error",
				);
				// 让新产生的 run 会话出现在侧栏（标题/分组的真相在 daemon）。
				refreshTasks();
				// 装配失败的 run 没有会话（空串），无可标记对象。
				if (event.sessionId === "") return;
				// 未读与 run_finished 分支同口径：完成时用户没在看就标绿点。
				// 区别只是定位键 —— 这里是 sessionId，要经列表换成 path。
				window.kami
					.listSessions()
					.then((list) => {
						if (disposed) return;
						const hit = list.find((t) => t.id === event.sessionId);
						if (hit === undefined) return;
						if (viewRef.current === "chat" && hit.current) return;
						setUnreadPaths((prev) => {
							if (prev.has(hit.path)) return prev;
							const next = new Set(prev);
							next.add(hit.path);
							return next;
						});
					})
					.catch(() => {
						// 列表只是导航入口，标不上未读不掩盖主体事实（toast 已提示）。
					});
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
			offQuestionnaire();
			offAutomation();
		};
	}, []);

	/** 出队一条 toast（自动关闭或用户点掉都走这里）。 */
	const dismissToast = useCallback((id: number) => {
		setToasts((list) => list.filter((item) => item.id !== id));
	}, []);

	/**
	 * 轻提示的统一出口（区别于 showTodo 的「待做」语义，这里是真实的错误/状态反馈）。
	 * 顶部居中堆叠、上限 10 条（超出驱逐最旧）。同 type+text 去重由调用方决定，
	 * 这里只保证堆叠有界、每条 2.2s 自动关闭。
	 */
	const showToast = useCallback(
		(text: string, type: ToastType = "info") => {
			const id = Date.now() + Math.floor(Math.random() * 1_000);
			setToasts((list) => {
				const next = [...list, { id, text, type }];
				return next.length > 10 ? next.slice(next.length - 10) : next;
			});
			window.setTimeout(() => dismissToast(id), 2200);
		},
		[dismissToast],
	);

	const showTodo = useCallback((feature: string) => {
		showToast(`「${feature}」待做，随版本迭代开放`, "info");
	}, [showToast]);

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
	/** 静态服务 baseUrl，随工作空间快照刷新（服务未起为 undefined）。 */
	const [previewBaseUrl, setPreviewBaseUrl] = useState<string | undefined>(undefined);
	/** 面板宽度（px，WorkBuddy 默认 440、sash 拖拽 clamp [340, 800]）。 */
	const [panelWidth, setPanelWidth] = useState(440);
	/** 面板全屏态：absolute 覆盖主内容区。 */
	const [panelFullscreen, setPanelFullscreen] = useState(false);
	/** 产物面板展开/收起（收起 = 隐藏面板但保留 tab 状态，不是清空 tab）。默认关闭——用户进入对话后手动展开。 */
	const [panelOpen, setPanelOpen] = useState(false);
	/**
	 * 左侧栏展开/收起（收起 = 完全隐藏，消息流左移占满宽）。
	 * 默认展开：侧栏是全局导航锚（任务历史 / 空间 / 设置入口），首页与
	 * 对话页都常驻（WorkBuddy 同款）—— 收起后唯一的展开入口是窗口
	 * 左上角的悬浮开关，默认收起会让首页用户找不到历史与设置。
	 */
	const [sidebarOpen, setSidebarOpen] = useState(true);

	/**
	 * 单击预览（VSCode 语义，概览下拉与产物卡的统一入口）：
	 * 已有同 path tab 仅激活；否则保证全局唯一预览 tab——存在其他
	 * isPreview tab 时原位替换它（VSCode：新预览顶掉旧预览，位置不动），
	 * 没有则新建 isPreview tab。双击转正走 openFile。
	 */
	const openPreview = useCallback((sel: PreviewSelection) => {
		setPreviewTabs((tabs) => {
			if (tabs.some((t) => sameSelection(t, sel))) return tabs;
			const oldPreview = tabs.find((t) => t.isPreview === true);
			if (oldPreview !== undefined) {
				return tabs.map((t) => (sameSelection(t, oldPreview) ? { ...sel, isPreview: true } : t));
			}
			return [...tabs, { ...sel, isPreview: true }];
		});
		setPreviewActive(sel);
	}, []);

	/** 双击固定：已有同 path tab 激活并转正（isPreview=false），没有则新建固定 tab。 */
	const openFile = useCallback((sel: PreviewSelection) => {
		setPreviewTabs((tabs) =>
			tabs.some((t) => sameSelection(t, sel))
				? tabs.map((t) => (sameSelection(t, sel) ? { ...t, isPreview: false } : t))
				: [...tabs, { ...sel, isPreview: false }],
		);
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
		setPanelFullscreen(false);
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
	 * 应答问卷并出队（作答或整卡跳过都汇到这一个出口）。
	 *
	 * 与 decideApproval 同口径：无论应答成功与否都出队 —— 失败通常意味着
	 * daemon 已经不在了，把问卷卡留在屏幕上只会让用户反复点一个死按钮。
	 */
	const answerQuestionnaire = useCallback(
		(response: QuestionnaireResponse) => {
			setQuestionnaires((queue) => queue.filter((item) => item.id !== response.id));
			window.kami
				.questionnaireResponse(response)
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
	 *
	 * 旧会话的未读点保留：未读属于「那个会话完成了但你没看」的事实，
	 * 当前会话换了并不消灭这个事实 —— 点回那行时才清。
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
	 *
	 * 侧栏所有行点击（含当前行回对话页）都汇到这一个入口，所以未读
	 * 也只在这里清 —— 用户看到了，绿点就该消失。
	 */
	const resumeTask = useCallback(
		(path: string) => {
			window.kami
				.resumeSession(path)
				.then(() => {
					setUnreadPaths((prev) => {
						if (!prev.has(path)) return prev;
						const next = new Set(prev);
						next.delete(path);
						return next;
					});
					resyncSnapshot();
					refreshTasks();
					setView("chat");
				})
				.catch((error: unknown) => {
					const message = error instanceof Error ? error.message : String(error);
					// 「任务进行中」的拒绝：给「停止当前任务并切换」的二次确认按钮，
					// 而不是只 toast 一句死路（zombie run 场景：daemon 的 isStreaming
					// 滞留，用户无从停止——ErrorBoundary 重载只 reload renderer，daemon 原样存活）。
					if (message.includes("任务进行中")) {
						setPendingResume({ path, message });
						return;
					}
					showToast(message);
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
					showToast(`已导出：${outputPath}`, "success");
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
	 * 空间组「+」：先把工作空间切到该 cwd，再复用 newTask 开新会话。
	 * 顺序不能反 —— newTask 在当前 cwd 建会话，先建再切就会落错空间。
	 * 切空间失败则不新建：否则任务落在原空间，与用户在界面上点选的位置不符。
	 */
	const newTaskInSpace = useCallback(
		(cwd: string) => {
			window.kami
				.setWorkspace(cwd)
				.then(() => newTask())
				.catch((error: unknown) => {
					showToast(error instanceof Error ? error.message : String(error));
				});
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[newTask],
	);

	/** 重命名空间：仅改显示名覆盖（workspaces.json），成功刷列表重拉 metas。 */
	const renameWorkspace = useCallback(
		(cwd: string, name: string) => {
			window.kami
				.renameWorkspace(cwd, name)
				.then(() => refreshTasks())
				.catch((error: unknown) => {
					// daemon 的校验错误串（重名/未知空间等）直接透出。
					showToast(error instanceof Error ? error.message : String(error));
				});
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[refreshTasks],
	);

	/**
	 * 从列表移除空间：该 cwd 全部会话移入回收目录（可反悔），成功刷列表。
	 * 当前会话属于该空间时 daemon 侧已拒（错误串直接 toast），这里无需处理
	 * 视图切换 —— 能走到成功分支时，当前视图必然不属于被移除的空间。
	 */
	const removeWorkspace = useCallback(
		(cwd: string) => {
			window.kami
				.removeWorkspace(cwd)
				.then(() => refreshTasks())
				.catch((error: unknown) => {
					showToast(error instanceof Error ? error.message : String(error));
				});
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[refreshTasks],
	);

	/** 系统文件管理器打开空间目录（daemon 侧校验是已知工作空间，防任意路径）。 */
	const revealWorkspace = useCallback((cwd: string) => {
		window.kami.revealWorkspace(cwd).catch((error: unknown) => {
			showToast(error instanceof Error ? error.message : String(error));
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/**
	 * 临时任务转正：daemon 建目录、重写归组键并以新 cwd 重建当前会话。
	 * 成功后按 resume 同口径重拉快照（cwd/isTempTask 易位、预览根变了）
	 * 并刷列表（该任务从任务区挪进新空间组）。
	 *
	 * 失败不在这里 toast：promise 原样 reject 给对话页的命名弹层，
	 * 校验错误（重名/非法字符/保留名…）在输入框下原位显示，用户改完重试。
	 */
	const saveToWorkspace = useCallback(
		(name: string): Promise<void> =>
			window.kami.saveToWorkspace(name).then(() => {
				resyncSnapshot();
				refreshTasks();
				showToast("已保存到工作空间", "success");
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[resyncSnapshot, refreshTasks],
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

	/** 定时任务管理页同理：记住来路，关闭后回去。 */
	const openAutomations = useCallback(() => {
		setReturnView(view === "chat" ? "chat" : "home");
		setView("automations");
	}, [view]);

	/**
	 * 管理页点击运行记录：resume 链路的定位键是 path，运行记录给的是
	 * sessionId，要经会话列表换算。列表里没有（会话已被删除）时 resume
	 * 无从谈起 —— toast 说明，不假装切过去（与 resumeTask 失败同口径）。
	 */
	const resumeRunSession = useCallback(
		(sessionId: string) => {
			const hit = taskList.find((t) => t.id === sessionId);
			if (hit === undefined) {
				showToast("本次运行的会话已不在列表中（可能已删除）", "warning");
				return;
			}
			resumeTask(hit.path);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[taskList, resumeTask],
	);

	const firstUserText = conversation.entries.find(
		(e) => e.role === "user",
	)?.text;
	const title =
		firstUserText === undefined ? undefined : taskTitle(firstUserText);

	/**
	 * 侧栏两区分组：组由会话派生（session-groups.ts 头注释有理由），
	 * groupMetas 只承载显示名覆盖，回退目录 basename。
	 */
	const sidebarGroups = useMemo(
		() => groupSessions(taskList, groupMetas),
		[taskList, groupMetas],
	);
	/**
	 * 转圈行 = 当前会话行且流式中（单 daemon 单会话，两个条件本地可判，
	 * 无需新增状态）。
	 */
	const streamingPath = conversation.state.isStreaming
		? taskList.find((t) => t.current)?.path
		: undefined;
	/**
	 * 侧栏「待确认」badge 的驱动：审批或问卷任一 pending 即亮。
	 *
	 * 规格书原本设想复用 daemon 推送的 pending 计数，核查现状后 daemon 并没有
	 * 这个字段（审批/问卷请求只走各自的 PUSH 通道，不进 session_state），
	 * 所以改在 App 层用两条本地队列合成 —— 单 daemon 单会话下这两类请求
	 * 必然属于当前活动会话，本地合成与 daemon 计数等价，且改动最小。
	 */
	const pendingConfirm = approvals.length + questionnaires.length > 0;

	return (
		<div className="app">
			{/* 侧栏常驻、与视图无关（WorkBuddy 的真实布局）：首页与对话页都有，
		    收起后由窗口左上角的悬浮开关再展开（开关在 App 层，不随本组件卸载）。 */}
			{sidebarOpen && (
				<Sidebar
					link={link}
					groups={sidebarGroups}
					streamingPath={streamingPath}
					unreadPaths={unreadPaths}
					pendingConfirm={pendingConfirm}
					onNewTask={newTask}
					onResumeTask={resumeTask}
					onRenameTask={renameTask}
					onDeleteTask={deleteTask}
					onExportTask={exportTask}
					onNewTaskInSpace={newTaskInSpace}
					onRenameWorkspace={renameWorkspace}
					onRemoveWorkspace={removeWorkspace}
					onRevealWorkspace={revealWorkspace}
					onOpenSettings={openSettings}
					onOpenDiagnostics={openDiagnostics}
					onOpenSkills={() => setView("skills")}
					onOpenAutomations={openAutomations}
					onTodo={showTodo}
				/>
			)}
			{view === "home" && (
				<HomeView
					ready={link.kind === "ready"}
					scenes={conversation.availableScenes}
					sceneId={conversation.state.sceneId}
					modelId={conversation.state.modelId}
					cwd={conversation.state.cwd}
					interactions={conversation.availableModes}
					interactionId={conversation.state.interactionId}
					onInteractionChange={changeInteraction}
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
					onOpenPanelGroup={(_group) => {
						// 聚合入口：打开面板（无激活项时用第一个产物）。产物分组在
						// 面板概览视图里常驻展示，无需额外展开动作。
						const first = conversation.artifacts[0];
						if (first !== undefined) openPreview({ kind: "file", path: first.path });
					}}
					onOpenSettings={openSettings}
					onError={showToast}
					onSaveToWorkspace={saveToWorkspace}
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
			{view === "automations" && (
				<AutomationsView
					cwd={conversation.state.cwd}
					onClose={() => setView(returnView)}
					onResumeSession={resumeRunSession}
					onToast={showToast}
				/>
			)}
			{/* 产物预览面板：只在对话任务里出现（WorkBuddy：预览属于任务上下文），
		   首页是引导页，右侧没有面板。panelOpen 即渲染（无激活文件时显示空态）。 */}
			{view === "chat" && panelOpen && (
				<ArtifactPanel
					artifacts={conversation.artifacts}
					changes={collectChanges(conversation.entries)}
					cwd={conversation.state.cwd}
					previewBaseUrl={previewBaseUrl}
					tabs={previewTabs}
					active={previewActive}
					width={panelWidth}
					fullscreen={panelFullscreen}
					onWidthChange={setPanelWidth}
					onToggleFullscreen={() => setPanelFullscreen((v) => !v)}
					onOpen={openPreview}
					onPin={openFile}
					onCloseTab={closePreviewTab}
					onOpenExternal={openArtifact}
					onError={showToast}
				/>
			)}
			{/*
			左栏开关：App 层常驻、absolute 钉在窗口左上角（WorkBuddy 同款，
			独立于侧栏开合）。不能放进 Sidebar 组件内部 —— 侧栏收起时组件
			卸载，展开入口就没了。侧栏展开时它落在侧栏 brand 行左侧，
			brand 行已左让位（见 index.css .sidebar-brand）。
		*/}
			<button
				type="button"
				className={`bar-btn sidebar-toggle-btn${sidebarOpen ? " active" : ""}`}
				aria-label={sidebarOpen ? "收起侧栏" : "展开侧栏"}
				aria-pressed={sidebarOpen}
				title={sidebarOpen ? "收起侧栏" : "展开侧栏"}
				onClick={() => setSidebarOpen((v) => !v)}
			>
				<IconPanelLeft size={16} />
			</button>
			{/*
			右面板开关：App 层、absolute 钉在窗口右上角 —— 面板开合 /
			sash 拖拽 / 宽度过渡都不推移它（放 chat-header 行尾时会被面板
			「推着走」，面板全屏 z 30 还会盖住它）。渲染范围与 ArtifactPanel
			一致（只在对话任务里；按钮与面板共存亡，但必须在面板组件
			之外 —— 面板收起时要靠它再展开）。
		*/}
			{view === "chat" && (
				<button
					type="button"
					className={`bar-btn panel-toggle-btn${panelOpen ? " active" : ""}`}
					aria-label={panelOpen ? "收起产物面板" : "展开产物面板"}
					aria-pressed={panelOpen}
					title={panelOpen ? "收起产物面板" : "展开产物面板"}
					onClick={() => setPanelOpen((v) => !v)}
				>
					<IconPanelRight size={16} />
				</button>
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
			{/*
				问卷与审批一次只显示一个阻塞弹层，审批优先：审批是工具执行的
				安全闸（危险操作挂在它后面），问卷只是方向确认 —— 先把闸答完，
				再回答问题。两条队列各自排队，互不吞并。
			*/}
			{approvals[0] === undefined && questionnaires[0] !== undefined && (
				<QuestionnaireDialog
					key={questionnaires[0].id}
					request={questionnaires[0]}
					onSubmit={(answers) => {
						const head = questionnaires[0];
						if (head !== undefined) {
							answerQuestionnaire({ id: head.id, skipped: false, answers });
						}
					}}
					onSkip={() => {
						const head = questionnaires[0];
						if (head !== undefined) {
							answerQuestionnaire({ id: head.id, skipped: true, answers: [] });
						}
					}}
				/>
			)}
			{/* 「任务进行中」拒绝后的二次确认：先停止当前任务（abort），再重试恢复。 */}
			{pendingResume !== undefined && (
				<div className="modal-backdrop" onClick={() => setPendingResume(undefined)}>
					<div className="permission-card" onClick={(e) => e.stopPropagation()}>
						<h3 style={{ margin: 0, fontSize: 15 }}>停止当前任务并切换？</h3>
						<p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>
							{pendingResume.message}
						</p>
						<div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
							<button
								type="button"
								className="task-confirm-btn"
								onClick={() => setPendingResume(undefined)}
							>
								取消
							</button>
							<button
								type="button"
								className="task-confirm-btn task-confirm-yes"
								onClick={() => {
									const path = pendingResume.path;
									setPendingResume(undefined);
									// 先停止当前任务（abort 是幂等的，无 run 时 no-op），再重试恢复。
									window.kami
										.abort()
										.then(() => resumeTask(path))
										.catch((error: unknown) => {
											showToast(error instanceof Error ? error.message : String(error));
										});
								}}
							>
								停止并切换
							</button>
						</div>
					</div>
				</div>
			)}
			<Toast messages={toasts} />
		</div>
	);
}
