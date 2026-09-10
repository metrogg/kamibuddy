const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./agent-chat-pane-B_MWF8Xa.js","./ui-docs-viewer-C2jT2eXi.js","./rolldown-runtime-D5a2oYpF.js","./lib-chat-ui-ChIVprRk.js","./lib-chat-ui-Co_VI_pZ.css","./ui-ardot-DkNyoQ5N.js","./ui-docs-viewer-D8SBBSEE.css","./colleague-chat-page-DeUUfHD0.js","./browser-Cr7_zx63.js","./acp-message-accumulator-Xgfp3mfv.js","./telemetry-client-info-BOWiuM-o.js","./workspace-preparing-fT4ZdELa.js","./workspace-preparing-OwGXqoc6.css","./colleague-artifact-provider-BfJfUGJL.js","./use-colleague-document-preview-J9zpEQni.js","./codebuddy-icon-provider-DZ2Ul8Rh.js","./shared-CNhQOkwk.js","./file-utils-Dg_KyZ7n.js","./shared-CEZoH2WN.css","./cancel-barrier-Bh1DJw_w.js","./stale-conversation-status-writeback-Ak48nPdq.js","./compact-divider-utils-BYC4B2V4.js","./upload-utils-lqHfkCqU.js","./colleague-chat-page-7g3xpI3c.css","./enterprise-annotations-CX16MVgy.js","./enterprise-annotations-BH192BR7.css","./agent-chat-pane-CngfwAOA.css","./colleague-navigation-bus-fzu7FpJJ.js"])))=>i.map(i=>d[i]);
import { n as __esmMin, s as __toESM } from "./rolldown-runtime-D5a2oYpF.js";
import { $i as getDaysOnDuty, AB as DeleteIcon, AM as init_assistant_list_skeleton, Ab as CLAW_CLOUD_TRIAL_TAB_KEY, BA as reportAssistantCreateEntryClick, Bt as init_conversation, By as init_claw_session_filter, CL as useOutletContext, DM as init_assistant_chat_skeleton, Db as useSidebarSectionState, EM as AssistantChatSkeletonMessages, Eb as init_use_sidebar_state, FA as ClawWorkspaceTitle, FB as ChevronRightIcon, Fy as init_colleague_navigation_bus, GA as reportAssistantMoreMenuClick, GL as useConversations, Gt as ConversationEngineView, HA as reportAssistantListExpandClick, HO as init_use_floating_layer, IA as init_workspace_title, IC as ClawChannels, It as init_app_core, JA as reportAssistantMoreUnpinClick, Ji as formatProfileDateTime, KA as reportAssistantMorePinClick, LA as init_telemetry, LB as ChevronDownIcon, LC as init_claw_channels, LN as useConversationEngineFeature, Lt as isAppCoreReady, MM as init_claw_workspace$1, MR as init_src, Mb as init_tab_registry, My as colleagueAgentListChanged$, Nb as resolveAssistantChatIds, Ny as colleagueConversationPatches$, OM as init_empty_tab_pane$1, Ob as useSidebarState, Pa as ConversationTopbarFrame, Pt as getWb, Py as colleagueConversationsChanged$, Pz as WbPinIcon, QA as reportAssistantUnpinClick, Qb as useCloudAssistantEntitlement, Qi as getAgentTitle, RA as reportAssistantCardEditClick, Rs as init_contexts, Rt as wb, SL as useNavigate, UA as reportAssistantMoreDeleteClick, UB as AssistantIcon, UO as useFloatingLayer, VA as reportAssistantIntroEntryClick, Vy as isClawWorkspaceCwd, WA as reportAssistantMoreEditClick, WM as init_product_features, Wt as ConversationRouteHeader, XA as reportAssistantTrialClick, Xb as init_use_cloud_assistant_entitlement, Xi as getAgentManifest, YA as reportAssistantPinClick, Yi as getAgentDescription, ZA as reportAssistantTrialLoadingShow, Zb as invalidateCloudAssistantEntitlement, Zi as getAgentName, _k as init_services, aM as init_router, aV as Button, aj as reportProfileEditClick, az as Tooltip, bc as useAgentServices, bz as XCloseIcon, cL as init_useI18n, cM as init_claw_assistant_route, cc as init_auth_context, cl as ClawLocalEmptyView, dM as readClawOpenIntent, dT as persistLocalAssistantAnchorIfCurrent, dj as useClawWorkspaceChrome, eO as init_auth_expired_detector, ea as getHiredExpertLabel, fM as removeClawLocalSessionIdFromSearch, fT as readActiveClawConversationId, fl as CLAW_LOCAL_SCENARIO_ID, hB as NewTaskIcon, hv as useTopBarRootClassName, hz as Tag, ij as reportProfileChatClick, iz as Dropdown, jM as init_drawer_panel$1, jb as CLAW_LOCAL_TAB_KEY, kM as AssistantListSkeleton, lM as isExplicitClawAssistantIntent, lc as useAccountService, lj as ClawWorkspaceChromeProvider, mv as useDesktopWindowState, na as init_assistant_profile_detail_utils, oV as Avatar, oj as reportProfileTaskClick, pT as saveActiveClawConversationId, pv as init_workbuddy_topbar, pz as Loading, qA as reportAssistantMoreProfileClick, qi as buildTaskRows, sM as buildClawLocalSessionPath, sl as init_claw$1, sz as Modal, tO as notifyIfAuthExpired, ta as getWorkspaceRepoLabelKeys, uL as useTranslation, uM as readClawLocalSessionIdFromSearch, uT as clearActiveClawConversationId, uj as init_context, uv as SidebarExpandButton, vL as init_dist, xL as useLocation, yB as MoreDotsIcon, zA as reportAssistantCardProfileClick, zL as useAdapter, zR as message } from "./ui-docs-viewer-C2jT2eXi.js";
import { Du as require_react_dom, Mu as init_preload_helper, Ou as require_jsx_runtime, di as toast, ju as __vitePreload, ku as require_react, t as init_src$1 } from "./lib-chat-ui-ChIVprRk.js";
import { i as init_error_boundary, n as MainContentCore, r as ErrorBoundary, t as init_main_content_core } from "./main-content-core-DG_Qu1Pk.js";
import { o as init_chat_error, s as isColleagueChatNotFoundError } from "./colleague-chat-page-DeUUfHD0.js";
import { i as init_enterprise_annotations, o as init_claw_agent_chat_topbar, t as getEnterpriseAgentTitle } from "./enterprise-annotations-CX16MVgy.js";
import { a as init_use_my_colleague_conversations, c as useCloudAgentQuota, d as init_assistant_quota_utils, f as isAssistantQuotaExceeded, i as init_colleagues_panel, l as AssistantQuotaLimitModal, n as CreateColleagueDialog, o as useMyColleagueConversations, p as openAssistantPlanUpgrade, r as getAvatarImageUrl, s as init_use_cloud_agent_quota, u as init_assistant_quota_limit_modal } from "./colleagues-panel-gbhjAmil.js";
//#region ../../packages/agent-ui/src/components/claw-workspace/create-assistant-drawer/create-assistant-drawer.less
var init_create_assistant_drawer$2 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/create-assistant-drawer/create-assistant-avatar-scroll.less
var init_create_assistant_avatar_scroll = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/create-assistant-drawer/assistant-profile-detail.less
var init_assistant_profile_detail$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/create-assistant-drawer/tasks-pane.less
var init_tasks_pane = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/create-assistant-drawer/profile-pane.less
var init_profile_pane$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/create-assistant-drawer/profile-pane.tsx
/** 查看档案首页：展示助理身份、任务概览、状态与任务配置。 */
function ProfilePane({ agent, kind, taskRows, conversations, onStartChat, onEdit }) {
	const t = useTranslation();
	const name = getAgentName(agent);
	const title = getAgentTitle(agent);
	const description = getAgentDescription(agent);
	const manifest = getAgentManifest(agent);
	const repoLabels = getWorkspaceRepoLabelKeys(manifest).map((labelKey) => t(labelKey));
	const expertLabel = getHiredExpertLabel(manifest);
	const runningCount = taskRows.filter((task) => task.statusVariant === "working").length;
	const completedCount = taskRows.filter((task) => task.statusVariant === "completed").length;
	const lastActiveText = conversations[0]?.lastActivityAt || conversations[0]?.createdAt ? formatProfileDateTime(conversations[0].lastActivityAt ?? conversations[0].createdAt) : t("colleagues.detail.lastActiveFallback");
	return /* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)("div", {
		className: "claw-assistant-profile-detail__profile-pane",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)("section", {
				className: "claw-assistant-profile-detail__hero",
				"aria-labelledby": "claw-assistant-profile-name",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(Avatar, {
					size: 116,
					shape: "square",
					src: getAvatarImageUrl(agent.avatar) ?? agent.avatar,
					alt: "",
					className: "claw-assistant-profile-detail__avatar",
					children: name
				}), /* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)("div", {
					className: "claw-assistant-profile-detail__identity",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)("div", {
							className: "claw-assistant-profile-detail__name-row",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)("h3", {
								id: "claw-assistant-profile-name",
								children: name
							}), /* @__PURE__ */ (0, import_jsx_runtime$16.jsx)("span", { children: title })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)("p", { children: description }),
						/* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)("div", {
							className: "claw-assistant-profile-detail__actions",
							children: [/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(Button, {
								size: "small",
								variant: "primary",
								onClick: () => onStartChat(agent),
								children: t("colleagues.detail.startChat")
							}), kind !== "enterprise" && /* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(Button, {
								size: "small",
								variant: "secondary",
								onClick: () => onEdit(agent),
								children: t("colleagues.action.editProfile")
							})]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)("section", {
				className: "claw-assistant-profile-detail__section",
				"aria-labelledby": "claw-assistant-profile-overview",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)("h4", {
					id: "claw-assistant-profile-overview",
					children: t("colleagues.detail.taskOverviewV2")
				}), /* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)("div", {
					className: "claw-assistant-profile-detail__metrics",
					"aria-label": t("colleagues.detail.metricsLabel"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(MetricCard, {
							value: getDaysOnDuty(agent.createdAt),
							label: t("colleagues.detail.daysOnDuty")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(MetricCard, {
							value: runningCount,
							label: t("colleagues.detail.metric.inProgress")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(MetricCard, {
							value: completedCount,
							label: t("colleagues.detail.metric.completed")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(MetricCard, {
							value: taskRows.length,
							label: t("colleagues.detail.taskCount")
						})
					]
				})]
			}),
			kind !== "enterprise" && /* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)("div", {
				className: "claw-assistant-profile-detail__info-grid",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)(InfoCard, {
					title: t("colleagues.detail.statusTitle"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(InfoRow, {
							label: t("colleagues.detail.taskExecution"),
							value: runningCount > 0 ? t("colleagues.detail.status.inProgress") : t("colleagues.detail.idleNoTask")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(InfoRow, {
							label: t("colleagues.detail.imStatus"),
							value: t("colleagues.detail.notBound")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(InfoRow, {
							label: t("colleagues.detail.visibleScope"),
							value: t("colleagues.detail.personalVisible")
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(InfoRow, {
							label: t("colleagues.detail.lastActive"),
							value: lastActiveText
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)(InfoCard, {
					title: t("colleagues.detail.taskConfig"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(InfoRow, {
						label: t("colleagues.detail.selectRepo"),
						value: repoLabels.length > 0 ? repoLabels.join("、") : t("colleagues.detail.notConfigured"),
						tag: true
					}), /* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(InfoRow, {
						label: t("colleagues.detail.hiredExpert"),
						value: expertLabel ?? t("colleagues.detail.notConfigured"),
						tag: true
					})]
				})]
			})
		]
	});
}
function MetricCard({ value, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)("div", {
		className: "claw-assistant-profile-detail__metric",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)("strong", { children: value }), /* @__PURE__ */ (0, import_jsx_runtime$16.jsx)("span", { children: label })]
	});
}
function InfoCard({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)("section", {
		className: "claw-assistant-profile-detail__info-card",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)("h4", { children: title }), /* @__PURE__ */ (0, import_jsx_runtime$16.jsx)("div", { children })]
	});
}
function InfoRow({ label, value, tag, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$16.jsxs)("div", {
		className: "claw-assistant-profile-detail__info-row",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$16.jsx)("span", { children: label }), tag ? /* @__PURE__ */ (0, import_jsx_runtime$16.jsx)(Tag, {
			size: "small",
			tone: tone ?? "default",
			children: value
		}) : /* @__PURE__ */ (0, import_jsx_runtime$16.jsx)("strong", { children: value })]
	});
}
var import_jsx_runtime$16;
var init_profile_pane = __esmMin((() => {
	init_profile_pane$1();
	init_src();
	require_react();
	init_useI18n();
	init_colleagues_panel();
	init_assistant_profile_detail_utils();
	import_jsx_runtime$16 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/create-assistant-drawer/assistant-profile-detail.tsx
/** 查看档案抽屉内容：承接旧档案信息，按新设计稿改为顶部标签 + 详情/任务双页。 */
function AssistantProfileDetail({ agent, kind, rawAgents, onStartChat, onEdit, onOpenTask }) {
	const t = useTranslation();
	const adapter = useAdapter();
	const [activeTab, setActiveTab] = import_react$21.useState("profile");
	import_react$21.useEffect(() => {
		setActiveTab("profile");
	}, [agent?.id]);
	const conversations = useMyColleagueConversations({
		adapter,
		rawAgents,
		agentId: agent?.id,
		enabled: Boolean(agent)
	});
	const taskRows = import_react$21.useMemo(() => buildTaskRows(conversations.instances), [conversations.instances]);
	if (!agent) return /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("div", {
		className: "claw-assistant-profile-detail__empty",
		children: t("common.unknown")
	});
	return /* @__PURE__ */ (0, import_jsx_runtime$15.jsxs)("div", {
		className: "claw-assistant-profile-detail",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("nav", {
				className: "claw-assistant-profile-detail__tabs",
				"aria-label": t("colleagues.detail.tabs"),
				children: PROFILE_TABS.map((item) => {
					const active = activeTab === item.id;
					return /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("button", {
						type: "button",
						className: `claw-assistant-profile-detail__tab${active ? " is-active" : ""}`,
						"aria-current": active ? "page" : void 0,
						onClick: () => setActiveTab(item.id),
						children: t(item.labelKey)
					}, item.id);
				})
			}),
			conversations.error && /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("div", {
				className: "claw-assistant-profile-detail__error",
				children: conversations.error
			}),
			activeTab === "profile" ? /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(ProfilePane, {
				agent,
				kind,
				taskRows,
				conversations: conversations.instances,
				onStartChat,
				onEdit
			}) : /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(TasksPane, {
				name: agent.agentName || agent.agentId || agent.id,
				rows: taskRows,
				loading: conversations.isLoading,
				deleteSession: conversations.deleteSession,
				onOpenTask: (task) => onOpenTask(agent, task)
			})
		]
	});
}
function TasksPane(props) {
	const t = useTranslation();
	const [deletingTaskId, setDeletingTaskId] = import_react$21.useState(null);
	const handleDeleteTask = async (task) => {
		if (deletingTaskId) return false;
		setDeletingTaskId(task.id);
		try {
			if ((await props.deleteSession({
				instanceId: task.instanceId,
				sessionId: task.sessionId
			})).ok) {
				colleagueConversationPatches$.next({
					type: "remove-session",
					agentId: task.agentId,
					instanceId: task.instanceId,
					sessionId: task.sessionId,
					pendingUntil: Date.now() + 8e3
				});
				colleagueConversationsChanged$.next();
				message.success(t("delete.toast.success"));
				return true;
			}
			message.error(t("delete.toast.failed"));
			return false;
		} catch {
			message.error(t("delete.toast.failed"));
			return false;
		} finally {
			setDeletingTaskId(null);
		}
	};
	const handleDeleteTaskClick = (task) => {
		if (deletingTaskId) return;
		const taskTitle = task.title.trim() || t("colleagues.detail.taskTable.untitledName");
		Modal.confirm({
			title: t("colleagues.conversation.deleteConfirmTitle"),
			content: /* @__PURE__ */ (0, import_jsx_runtime$15.jsxs)(import_jsx_runtime$15.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("p", { children: t("colleagues.conversation.deleteConfirmQuestion", { title: taskTitle }) }), /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("p", { children: t("colleagues.conversation.deleteConfirmDescription") })] }),
			okText: t("delete.dialog.confirm"),
			cancelText: t("delete.dialog.cancel"),
			okType: "danger",
			onOk: async () => {
				return await handleDeleteTask(task) ? void 0 : false;
			}
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime$15.jsxs)("section", {
		className: "claw-assistant-profile-detail__tasks-pane",
		"aria-label": t("colleagues.detail.nav.tasks"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("p", { children: t("colleagues.detail.taskPageDesc", { name: props.name }) }),
			props.loading && /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(Loading, {
				size: "small",
				tip: t("common.loading"),
				className: "claw-assistant-profile-detail__task-loading"
			}),
			!props.loading && props.rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("div", {
				className: "claw-assistant-profile-detail__task-empty",
				children: t("colleagues.chat.sessionPicker.empty")
			}),
			!props.loading && props.rows.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime$15.jsxs)("div", {
				className: "claw-assistant-profile-detail__task-card",
				role: "list",
				"aria-label": t("colleagues.detail.nav.tasks"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime$15.jsxs)("div", {
					className: "claw-assistant-profile-detail__task-header",
					"aria-hidden": "true",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(TaskValueCell, {
							value: t("colleagues.detail.taskTable.id"),
							heading: true
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(TaskValueCell, {
							value: t("colleagues.detail.taskTable.name"),
							heading: true
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(TaskValueCell, {
							value: t("colleagues.detail.taskTable.source"),
							heading: true
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(TaskValueCell, {
							value: t("colleagues.detail.taskTable.status"),
							heading: true
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(TaskValueCell, {
							value: t("colleagues.detail.taskTable.createdAt"),
							heading: true
						}),
						/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(TaskValueCell, {
							value: t("colleagues.detail.taskTable.action"),
							heading: true
						})
					]
				}), props.rows.map((task) => {
					const taskTitle = task.title.trim() || t("colleagues.detail.taskTable.untitledName");
					return /* @__PURE__ */ (0, import_jsx_runtime$15.jsxs)("div", {
						className: "claw-assistant-profile-detail__task-row",
						role: "listitem",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$15.jsxs)("button", {
							type: "button",
							className: "claw-assistant-profile-detail__task-main",
							"aria-label": t("colleagues.detail.taskTable.openHistoryAria", { name: taskTitle }),
							onClick: () => props.onOpenTask(task),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(TaskValueCell, { value: task.shortId }),
								/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(TaskValueCell, { value: taskTitle }),
								/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(TaskValueCell, { value: /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(Tag, {
									size: "small",
									className: "claw-assistant-profile-detail__task-source-tag",
									children: t(task.source)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(TaskValueCell, { value: /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(Tag, {
									size: "small",
									dot: true,
									className: `claw-assistant-profile-detail__task-status-tag claw-assistant-profile-detail__task-status-tag--${task.statusVariant}`,
									children: t(task.statusTextKey)
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(TaskValueCell, { value: task.createdAtText })
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(Button, {
							size: "small",
							variant: "ghost",
							shape: "circle",
							iconOnly: true,
							leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)(DeleteIcon, { size: 16 }),
							"aria-label": t("colleagues.conversation.deleteAria"),
							disabled: deletingTaskId === task.id,
							onClick: (event) => {
								event.stopPropagation();
								handleDeleteTaskClick(task);
							}
						})]
					}, task.id);
				})]
			})
		]
	});
}
function TaskValueCell({ value, heading = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("span", {
		className: heading ? "claw-assistant-profile-detail__task-cell claw-assistant-profile-detail__task-cell--header" : "claw-assistant-profile-detail__task-cell",
		children: typeof value === "string" ? /* @__PURE__ */ (0, import_jsx_runtime$15.jsx)("span", { children: value }) : value
	});
}
var import_react$21, import_jsx_runtime$15, PROFILE_TABS;
var init_assistant_profile_detail = __esmMin((() => {
	init_assistant_profile_detail$1();
	init_tasks_pane();
	init_src();
	import_react$21 = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_useI18n();
	init_use_my_colleague_conversations();
	init_colleague_navigation_bus();
	init_assistant_profile_detail_utils();
	init_profile_pane();
	import_jsx_runtime$15 = require_jsx_runtime();
	PROFILE_TABS = [{
		id: "profile",
		labelKey: "colleagues.detail.nav.home"
	}, {
		id: "tasks",
		labelKey: "colleagues.detail.nav.tasks"
	}];
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/create-assistant-drawer/create-assistant-drawer.tsx
/** `/claw` 创建/编辑助理右侧抽屉：外壳走新视觉，内容复用旧创建同事流程。 */
function CreateAssistantDrawer({ open, onClose, onCreated, editingAgentId, checkQuotaBeforeCreate, onQuotaExceeded }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(CreateColleagueDialog, {
		open,
		presentation: "drawer",
		onClose,
		onCreated,
		editingAgentId,
		checkQuotaBeforeCreate,
		onQuotaExceeded
	});
}
/** 复用创建助理抽屉的壳，供查看档案在内容接入前保持同一视觉形态。 */
function AssistantShellDrawer({ open, title, closeLabel, titleId, className, onClose, children }) {
	const zIndex = useFloatingLayer(open, { base: 1200 });
	import_react$20.useEffect(() => {
		if (!open) return;
		const handleKeyDown = (event) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onClose, open]);
	if (!open || typeof document === "undefined") return null;
	return (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("div", {
		className: "create-colleague-overlay create-colleague-overlay--drawer",
		style: { zIndex },
		onMouseDown: onClose,
		children: /* @__PURE__ */ (0, import_jsx_runtime$14.jsxs)("section", {
			className: `create-colleague-modal create-colleague-modal--drawer ${className}`,
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": titleId,
			onMouseDown: (event) => event.stopPropagation(),
			children: [/* @__PURE__ */ (0, import_jsx_runtime$14.jsxs)("header", {
				className: "create-colleague-header",
				children: [/* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("div", {
					className: "create-colleague-title-row",
					children: /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("h2", {
						id: titleId,
						children: title
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("button", {
					type: "button",
					className: "create-colleague-close",
					"aria-label": closeLabel,
					onClick: onClose,
					children: /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(XCloseIcon, { size: 16 })
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)("div", {
				className: "create-colleague-body claw-assistant-shell-drawer__body",
				children
			})]
		})
	}), document.body);
}
/** `/claw` 查看档案右侧抽屉：复用旧档案数据，按新设计稿渲染档案与对话任务。 */
function ViewAssistantDrawer({ agent, kind, rawAgents, onStartChat, onEdit, onOpenTask, ...shellProps }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(AssistantShellDrawer, {
		...shellProps,
		titleId: "claw-view-assistant-drawer-title",
		className: "claw-view-assistant-drawer",
		children: /* @__PURE__ */ (0, import_jsx_runtime$14.jsx)(AssistantProfileDetail, {
			agent,
			kind,
			rawAgents,
			onStartChat,
			onEdit,
			onOpenTask
		})
	});
}
var import_react$20, import_react_dom, import_jsx_runtime$14;
var init_create_assistant_drawer$1 = __esmMin((() => {
	init_create_assistant_drawer$2();
	init_create_assistant_avatar_scroll();
	init_src();
	import_react$20 = /* @__PURE__ */ __toESM(require_react());
	import_react_dom = /* @__PURE__ */ __toESM(require_react_dom());
	init_use_floating_layer();
	init_colleagues_panel();
	init_assistant_profile_detail();
	import_jsx_runtime$14 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/create-assistant-drawer/index.ts
var init_create_assistant_drawer = __esmMin((() => {
	init_create_assistant_drawer$1();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/secondary-sidebar/secondary-sidebar.less
var init_secondary_sidebar$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/secondary-sidebar/assistant-list-empty.less
var init_assistant_list_empty$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/secondary-sidebar/assistant-list-empty.tsx
function AssistantListEmpty({ message }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$13.jsx)("div", {
		className: "claw-assistant-list-empty",
		role: "status",
		children: message
	});
}
var import_jsx_runtime$13;
var init_assistant_list_empty = __esmMin((() => {
	init_assistant_list_empty$1();
	require_react();
	import_jsx_runtime$13 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/secondary-sidebar/assistant-list-error.less
var init_assistant_list_error$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/secondary-sidebar/assistant-list-error.tsx
/** 助理列表加载失败态，不影响固定的本地助理 tab 使用。 */
function AssistantListError({ message, retryLabel, onRetry }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$12.jsxs)("div", {
		className: "claw-assistant-list-error",
		role: "status",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$12.jsx)("span", {
			className: "claw-assistant-list-error__message",
			children: message
		}), /* @__PURE__ */ (0, import_jsx_runtime$12.jsx)(Button, {
			type: "button",
			size: "small",
			variant: "ghost",
			onClick: onRetry,
			children: retryLabel
		})]
	});
}
var import_jsx_runtime$12;
var init_assistant_list_error = __esmMin((() => {
	init_assistant_list_error$1();
	init_src();
	require_react();
	import_jsx_runtime$12 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/secondary-sidebar/assistant-list-item.less
var init_assistant_list_item$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/secondary-sidebar/assistant-list-item.tsx
function getListItemClassName(active, modifier, menuOpen) {
	return [
		"claw-assistant-list-item",
		active && "claw-assistant-list-item--active",
		menuOpen && "claw-assistant-list-item--menu-open",
		modifier && `claw-assistant-list-item--${modifier}`
	].filter(Boolean).join(" ");
}
/** 助理抽屉中的单个 tab 项，负责头像、名称、状态标记和右侧操作入口展示。 */
function AssistantListItem({ tab, active, moreActionsLabel, viewProfileLabel, editProfileLabel, pinLabel, unpinLabel, deleteLabel, pinning, onSelect, onViewAssistant, onEditAssistant, onTogglePinAssistant, onDeleteAssistant, onPinEnterpriseAgent, onUnpinEnterpriseAgent, onMoreMenuOpen }) {
	const t = useTranslation();
	const showMore = tab.kind === "normal" || tab.kind === "enterprise";
	const isEnterprise = tab.kind === "enterprise";
	const hasAgent = Boolean(tab.rawAgent?.id);
	const isPinned = Boolean(tab.rawAgent?.pinned);
	const [menuOpen, setMenuOpen] = import_react$17.useState(false);
	const enforceMode = isEnterprise ? tab.rawAgent?.enforceMode : void 0;
	const enforceTag = enforceMode === "force_on" ? {
		modifier: "required",
		label: t("claw.workspace.enterprise.enforce.required"),
		tip: t("claw.workspace.enterprise.enforce.requiredTip")
	} : enforceMode === "default_off" ? {
		modifier: "optional",
		label: t("claw.workspace.enterprise.enforce.optional"),
		tip: t("claw.workspace.enterprise.enforce.optionalTip")
	} : null;
	const menuItems = import_react$17.useMemo(() => {
		if (isEnterprise) return [tab.rawAgent?.pinned ? {
			key: "unpin",
			label: unpinLabel,
			disabled: !hasAgent
		} : {
			key: "pin",
			label: pinLabel,
			disabled: !hasAgent
		}];
		return [
			{
				key: "view-profile",
				label: viewProfileLabel,
				disabled: !hasAgent
			},
			{
				key: "edit-profile",
				label: editProfileLabel,
				disabled: !hasAgent
			},
			{
				key: "toggle-pin",
				label: tab.rawAgent?.pinned ? unpinLabel : pinLabel,
				selected: Boolean(tab.rawAgent?.pinned),
				disabled: !hasAgent || pinning
			},
			{
				key: "delete",
				label: deleteLabel,
				danger: true,
				disabled: !hasAgent
			}
		];
	}, [
		deleteLabel,
		editProfileLabel,
		hasAgent,
		isEnterprise,
		isPinned,
		pinLabel,
		pinning,
		unpinLabel,
		viewProfileLabel
	]);
	const handleMenuSelect = import_react$17.useCallback((key) => {
		if (key === "pin") {
			onPinEnterpriseAgent(tab);
			return;
		}
		if (key === "unpin") {
			onUnpinEnterpriseAgent(tab);
			return;
		}
		if (key === "view-profile") {
			onViewAssistant(tab);
			return;
		}
		if (key === "edit-profile") {
			onEditAssistant(tab);
			return;
		}
		if (key === "toggle-pin") {
			onTogglePinAssistant(tab);
			return;
		}
		if (key === "delete") onDeleteAssistant(tab);
	}, [
		onDeleteAssistant,
		onEditAssistant,
		onPinEnterpriseAgent,
		onTogglePinAssistant,
		onUnpinEnterpriseAgent,
		onViewAssistant,
		tab
	]);
	const handlePinClick = import_react$17.useCallback((event) => {
		event.stopPropagation();
		if (isEnterprise) onUnpinEnterpriseAgent(tab);
		else onTogglePinAssistant(tab);
	}, [
		isEnterprise,
		onTogglePinAssistant,
		onUnpinEnterpriseAgent,
		tab
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime$11.jsxs)("div", {
		className: getListItemClassName(active, tab.kind, menuOpen),
		children: [/* @__PURE__ */ (0, import_jsx_runtime$11.jsxs)("button", {
			type: "button",
			role: "tab",
			"aria-selected": active,
			className: "claw-assistant-list-item__main",
			onClick: () => onSelect(tab.key),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(Avatar, {
					size: 32,
					shape: "square",
					src: tab.avatarUrl,
					alt: "",
					icon: tab.avatarNode || /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(AssistantIcon, { size: 18 }),
					className: "claw-assistant-list-item__avatar",
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$11.jsxs)("span", {
					className: "claw-assistant-list-item__text",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$11.jsxs)("span", {
						className: "claw-assistant-list-item__label-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$11.jsx)("span", {
							className: "claw-assistant-list-item__label",
							children: tab.label
						}), enforceTag && /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)("span", {
							className: `claw-assistant-list-item__enforce-tag claw-assistant-list-item__enforce-tag--${enforceTag.modifier}`,
							title: enforceTag.tip,
							children: enforceTag.label
						})]
					}), tab.subtitle && /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)("span", {
						className: "claw-assistant-list-item__subtitle",
						children: tab.subtitle
					})]
				}),
				tab.showChevron && /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(ChevronRightIcon, {
					className: "claw-assistant-list-item__chevron",
					size: 16,
					"aria-hidden": "true"
				})
			]
		}), showMore && /* @__PURE__ */ (0, import_jsx_runtime$11.jsxs)("div", {
			className: "claw-assistant-list-item__actions",
			children: [isPinned && /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)("button", {
				type: "button",
				className: "claw-assistant-list-item__pin-button",
				"aria-label": unpinLabel,
				onClick: handlePinClick,
				children: /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(WbPinIcon, {
					size: 16,
					"aria-hidden": "true"
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(Dropdown, {
				items: menuItems,
				placement: "top-start",
				offsetDistance: 4,
				portalRoot: "body",
				className: "claw-assistant-list-item__action-menu",
				open: menuOpen,
				onOpenChange: setMenuOpen,
				onSelect: handleMenuSelect,
				trigger: /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)("button", {
					type: "button",
					className: "claw-assistant-list-item__more-button",
					"aria-label": `${moreActionsLabel}: ${tab.label}`,
					onClick: (event) => {
						event.stopPropagation();
						onMoreMenuOpen?.(tab);
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime$11.jsx)(MoreDotsIcon, {
						className: "claw-assistant-list-item__more",
						size: 16,
						"aria-hidden": "true"
					})
				})
			})]
		})]
	});
}
var import_react$17, import_jsx_runtime$11;
var init_assistant_list_item = __esmMin((() => {
	init_assistant_list_item$1();
	init_src();
	import_react$17 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	import_jsx_runtime$11 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/secondary-sidebar/pin-button.less
var init_pin_button$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/secondary-sidebar/pin-button.tsx
/** 抽屉右上角常驻按钮：顶住态提示取消常驻，浮层态提示常驻。 */
function PinButton({ pinned, pinLabel, unpinLabel, ariaLabel, onToggle }) {
	return /* @__PURE__ */ (0, import_jsx_runtime$10.jsx)(Tooltip, {
		content: pinned ? unpinLabel : pinLabel,
		placement: "bottom",
		mouseEnterDelay: 200,
		offset: 3,
		className: "claw-sidebar-pin-tooltip",
		children: /* @__PURE__ */ (0, import_jsx_runtime$10.jsx)(Button, {
			type: "button",
			className: "claw-sidebar-pin-button",
			variant: "ghost",
			size: "medium",
			iconOnly: true,
			"aria-label": ariaLabel,
			leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$10.jsx)(WbPinIcon, { size: 16 }),
			onClick: onToggle
		})
	});
}
var import_jsx_runtime$10;
var init_pin_button = __esmMin((() => {
	init_pin_button$1();
	init_src();
	require_react();
	import_jsx_runtime$10 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/secondary-sidebar/drawer-panel.tsx
function isPinningTab(tab, pinningTarget) {
	if (!pinningTarget || tab.kind !== pinningTarget.kind) return false;
	return pinningTarget.id === tab.rawAgent?.id || pinningTarget.id === tab.rawAgent?.agentId;
}
function renderTabItems(tabs, activeTab, labels, actions, onSelectTab, pinningTarget) {
	return tabs.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(AssistantListItem, {
		tab,
		active: tab.key === activeTab,
		moreActionsLabel: labels.moreActionsLabel,
		viewProfileLabel: labels.viewProfileLabel,
		editProfileLabel: labels.editProfileLabel,
		pinLabel: labels.pinAssistantLabel,
		unpinLabel: labels.unpinAssistantLabel,
		deleteLabel: labels.deleteLabel,
		pinning: isPinningTab(tab, pinningTarget),
		onSelect: onSelectTab,
		onViewAssistant: actions.onViewAssistant,
		onEditAssistant: actions.onEditAssistant,
		onTogglePinAssistant: actions.onTogglePinAssistant,
		onDeleteAssistant: actions.onDeleteAssistant,
		onPinEnterpriseAgent: actions.onPinEnterpriseAgent,
		onUnpinEnterpriseAgent: actions.onUnpinEnterpriseAgent,
		onMoreMenuOpen: actions.onMoreMenuOpen
	}, tab.key));
}
/** 助理抽屉面板，pinned 与 floating 两态共用同一套内容结构。 */
function DrawerPanel({ mode, title, createAssistantLabel, assistantSectionLabel, moreActionsLabel, viewProfileLabel, editProfileLabel, pinAssistantLabel, unpinAssistantLabel, deleteLabel, enterprisePinLabel, enterpriseUnpinLabel, errorRetryLabel, pinLabel, unpinLabel, pinAriaLabel, enterpriseSectionLabel, cloudAssistantErrorLabel, assistantErrorLabel, enterpriseAgentErrorLabel, assistantEmptyLabel, enterpriseAgentEmptyLabel, tabs, enterpriseTabs, isEnterpriseUser, activeTab, cloudAssistantState, assistantState, enterpriseAgentState, canCreateAssistant, pinningTarget, assistantExpanded, enterpriseExpanded, onAssistantExpandedChange, onEnterpriseExpandedChange, onSelectTab, onCreateAssistant, onViewAssistant, onEditAssistant, onTogglePinAssistant, onDeleteAssistant, onPinEnterpriseAgent, onUnpinEnterpriseAgent, onMoreMenuOpen, onAssistantSectionToggle, onEnterpriseSectionToggle, onTogglePinned, onRetryGroup, hoverBindings }) {
	const primaryTabs = tabs.filter((tab) => tab.kind !== "normal");
	const assistantTabs = tabs.filter((tab) => tab.kind === "normal");
	const assistantLoading = assistantState.status === "loading" && !assistantState.hasSuccessfulSnapshot;
	const assistantError = assistantState.status === "error";
	const assistantEmpty = assistantState.status === "success" && assistantTabs.length === 0;
	const enterpriseAgentLoading = enterpriseAgentState.status === "loading" && !enterpriseAgentState.hasSuccessfulSnapshot;
	const enterpriseAgentError = enterpriseAgentState.status === "error";
	const enterpriseAgentEmpty = enterpriseAgentState.status === "success" && enterpriseTabs.length === 0;
	const cloudAssistantLoading = cloudAssistantState.status === "loading" && !cloudAssistantState.hasSuccessfulSnapshot;
	const cloudAssistantError = cloudAssistantState.status === "error";
	const showAssistantSection = canCreateAssistant || assistantState.status !== "idle" || assistantTabs.length > 0;
	const showEnterpriseSection = isEnterpriseUser && (enterpriseAgentState.status !== "idle" || enterpriseTabs.length > 0);
	const showSecondaryMenu = showAssistantSection || showEnterpriseSection;
	const actionLabels = {
		moreActionsLabel,
		viewProfileLabel,
		editProfileLabel,
		pinAssistantLabel,
		unpinAssistantLabel,
		deleteLabel,
		enterprisePinLabel,
		enterpriseUnpinLabel
	};
	const actionHandlers = {
		onViewAssistant,
		onEditAssistant,
		onTogglePinAssistant,
		onDeleteAssistant,
		onPinEnterpriseAgent,
		onUnpinEnterpriseAgent,
		onMoreMenuOpen
	};
	const handleAssistantSectionClick = () => {
		const next = !assistantExpanded;
		onAssistantExpandedChange(next);
		onAssistantSectionToggle?.(next);
	};
	const handleEnterpriseSectionClick = () => {
		const next = !enterpriseExpanded;
		onEnterpriseExpandedChange(next);
		onEnterpriseSectionToggle?.(next);
	};
	const { isDesktopMac, sidebarCollapsed, isFullscreen } = useDesktopWindowState();
	const needsMacOffset = isDesktopMac && sidebarCollapsed && !isFullscreen;
	return /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("aside", {
		className: `claw-sidebar-drawer claw-sidebar-drawer--${mode}`,
		"aria-label": title,
		...hoverBindings,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
				className: `claw-sidebar-drawer__titlebar${needsMacOffset ? " claw-sidebar-drawer__titlebar--mac-offset" : ""}`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("div", {
					className: "claw-sidebar-drawer__title",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
					className: "claw-sidebar-drawer__title-actions",
					children: [mode === "pinned" && /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(SidebarExpandButton, {}), /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(PinButton, {
						pinned: mode === "pinned",
						pinLabel,
						unpinLabel,
						ariaLabel: pinAriaLabel,
						onToggle: onTogglePinned
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
				className: "claw-sidebar-drawer__primary-tabs",
				children: [
					renderTabItems(primaryTabs, activeTab, actionLabels, actionHandlers, onSelectTab, pinningTarget),
					cloudAssistantLoading && /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(AssistantListSkeleton, {}),
					cloudAssistantError && /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(AssistantListError, {
						message: cloudAssistantErrorLabel,
						retryLabel: errorRetryLabel,
						onRetry: () => onRetryGroup("cloudAssistant")
					})
				]
			}),
			showSecondaryMenu && /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)(import_jsx_runtime$9.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("div", { className: "claw-sidebar-drawer__divider" }), /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
				className: "claw-sidebar-drawer__menu",
				role: "tablist",
				"aria-orientation": "vertical",
				children: [showAssistantSection && /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
					className: "claw-sidebar-drawer__normal-tabs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("button", {
						type: "button",
						className: "claw-sidebar-drawer__section-header claw-sidebar-drawer__section-header--clickable",
						"aria-expanded": assistantExpanded,
						onClick: handleAssistantSectionClick,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("span", {
								className: "claw-sidebar-drawer__section-title",
								children: [assistantSectionLabel, !assistantLoading && !assistantError && assistantTabs.length > 0 && ` (${assistantTabs.length})`]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(ChevronDownIcon, {
								size: 14,
								className: `claw-sidebar-drawer__section-chevron${assistantExpanded ? "" : " claw-sidebar-drawer__section-chevron--collapsed"}`
							}),
							!assistantLoading && !assistantError && canCreateAssistant && /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)("span", {
								role: "button",
								tabIndex: 0,
								className: "claw-sidebar-drawer__create-btn",
								"aria-label": createAssistantLabel,
								onClick: (e) => {
									e.stopPropagation();
									onCreateAssistant();
								},
								onKeyDown: (e) => {
									if (e.key === "Enter") {
										e.stopPropagation();
										onCreateAssistant();
									}
								},
								children: "+"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
						className: `claw-sidebar-drawer__section-body${assistantExpanded ? "" : " claw-sidebar-drawer__section-body--collapsed"}`,
						children: [
							assistantLoading && /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(AssistantListSkeleton, {}),
							renderTabItems(assistantTabs, activeTab, actionLabels, actionHandlers, onSelectTab, pinningTarget),
							assistantError && /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(AssistantListError, {
								message: assistantErrorLabel,
								retryLabel: errorRetryLabel,
								onRetry: () => onRetryGroup("assistant")
							}),
							assistantEmpty && /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(AssistantListEmpty, { message: assistantEmptyLabel })
						]
					})]
				}), showEnterpriseSection && /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
					className: "claw-sidebar-drawer__enterprise-tabs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("button", {
						type: "button",
						className: "claw-sidebar-drawer__section-header claw-sidebar-drawer__section-header--clickable",
						"aria-expanded": enterpriseExpanded,
						onClick: handleEnterpriseSectionClick,
						children: [/* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("span", {
							className: "claw-sidebar-drawer__section-title",
							children: [enterpriseSectionLabel, !enterpriseAgentLoading && !enterpriseAgentError && enterpriseTabs.length > 0 && ` (${enterpriseTabs.length})`]
						}), /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(ChevronDownIcon, {
							size: 14,
							className: `claw-sidebar-drawer__section-chevron${enterpriseExpanded ? "" : " claw-sidebar-drawer__section-chevron--collapsed"}`
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime$9.jsxs)("div", {
						className: `claw-sidebar-drawer__section-body${enterpriseExpanded ? "" : " claw-sidebar-drawer__section-body--collapsed"}`,
						children: [
							enterpriseAgentLoading && /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(AssistantListSkeleton, {}),
							renderTabItems(enterpriseTabs, activeTab, actionLabels, actionHandlers, onSelectTab, pinningTarget),
							enterpriseAgentError && /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(AssistantListError, {
								message: enterpriseAgentErrorLabel,
								retryLabel: errorRetryLabel,
								onRetry: () => onRetryGroup("enterpriseAgent")
							}),
							enterpriseAgentEmpty && /* @__PURE__ */ (0, import_jsx_runtime$9.jsx)(AssistantListEmpty, { message: enterpriseAgentEmptyLabel })
						]
					})]
				})]
			})] })
		]
	});
}
var import_jsx_runtime$9;
var init_drawer_panel = __esmMin((() => {
	init_drawer_panel$1();
	init_src();
	require_react();
	init_workbuddy_topbar();
	init_assistant_list_empty();
	init_assistant_list_error();
	init_assistant_list_item();
	init_assistant_list_skeleton();
	init_pin_button();
	import_jsx_runtime$9 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/secondary-sidebar/index.tsx
/** ClawWorkspace 左侧助理抽屉，负责常驻/收起/hover 浮出三态渲染。 */
function ClawSecondarySidebar({ tabs, enterpriseTabs, isEnterpriseUser, activeTab, pinned, hoverPeek, floatingBindings, cloudAssistantState, assistantState, enterpriseAgentState, canCreateAssistant, pinningTarget, onSelectTab, onViewAssistant, onEditAssistant, onTogglePinAssistant, onDeleteAssistant, onPinEnterpriseAgent, onUnpinEnterpriseAgent, onCreateAssistant, onPinnedChange, onClosePeek, onRetryGroup, onMoreMenuOpen, onAssistantSectionToggle, onEnterpriseSectionToggle }) {
	const t = useTranslation();
	const accountService = useAccountService();
	const { assistantExpanded, enterpriseExpanded, setAssistantExpanded, setEnterpriseExpanded } = useSidebarSectionState((0, import_react$14.useMemo)(() => {
		const account = accountService.account;
		return account?.uid ? `${account.enterpriseId ?? "default"}:${account.uid}` : "anonymous";
	}, [accountService.account?.enterpriseId, accountService.account?.uid]));
	const handleCreateAssistant = import_react$14.useCallback(() => {
		onCreateAssistant();
		onClosePeek();
	}, [onClosePeek, onCreateAssistant]);
	const drawerProps = (0, import_react$14.useMemo)(() => ({
		title: t("claw.workspace.title"),
		createAssistantLabel: t("colleagues.dashboard.createTitle"),
		assistantSectionLabel: t("claw.workspace.section.assistants"),
		moreActionsLabel: t("colleagues.moreActions"),
		viewProfileLabel: t("colleagues.action.viewProfile"),
		editProfileLabel: t("colleagues.action.editProfile"),
		pinAssistantLabel: t("colleagues.action.pin"),
		unpinAssistantLabel: t("colleagues.action.unpin"),
		deleteLabel: t("common.delete"),
		enterprisePinLabel: t("action.pin.tooltip"),
		enterpriseUnpinLabel: t("action.unpin.tooltip"),
		cloudAssistantErrorLabel: t("claw.workspace.list.cloudAssistantLoadFailed"),
		assistantErrorLabel: t("claw.workspace.list.loadFailed"),
		enterpriseAgentErrorLabel: t("claw.workspace.list.enterpriseAgentLoadFailed"),
		assistantEmptyLabel: t("claw.workspace.list.assistantEmpty"),
		enterpriseAgentEmptyLabel: t("claw.workspace.list.enterpriseAgentEmpty"),
		errorRetryLabel: t("claw.workspace.list.errorRetry"),
		pinLabel: t("claw.workspace.pin.tipsPin"),
		unpinLabel: t("claw.workspace.pin.tipsUnpin"),
		pinAriaLabel: t("claw.workspace.pin.ariaLabel"),
		enterpriseSectionLabel: t("claw.workspace.enterprise.sectionLabel"),
		tabs,
		enterpriseTabs,
		isEnterpriseUser,
		activeTab,
		cloudAssistantState,
		assistantState,
		enterpriseAgentState,
		canCreateAssistant,
		pinningTarget,
		assistantExpanded,
		enterpriseExpanded,
		onAssistantExpandedChange: setAssistantExpanded,
		onEnterpriseExpandedChange: setEnterpriseExpanded,
		onSelectTab,
		onCreateAssistant: handleCreateAssistant,
		onViewAssistant,
		onEditAssistant,
		onTogglePinAssistant,
		onDeleteAssistant,
		onPinEnterpriseAgent,
		onUnpinEnterpriseAgent,
		onMoreMenuOpen,
		onAssistantSectionToggle,
		onEnterpriseSectionToggle,
		onRetryGroup
	}), [
		activeTab,
		assistantExpanded,
		canCreateAssistant,
		cloudAssistantState,
		enterpriseExpanded,
		enterpriseAgentState,
		enterpriseTabs,
		handleCreateAssistant,
		isEnterpriseUser,
		assistantState,
		onAssistantSectionToggle,
		onDeleteAssistant,
		onEditAssistant,
		onEnterpriseSectionToggle,
		onMoreMenuOpen,
		onPinEnterpriseAgent,
		onRetryGroup,
		onSelectTab,
		onTogglePinAssistant,
		onUnpinEnterpriseAgent,
		onViewAssistant,
		pinningTarget,
		setAssistantExpanded,
		setEnterpriseExpanded,
		t,
		tabs
	]);
	const handleTogglePinned = () => {
		if (pinned) {
			onPinnedChange(false);
			onClosePeek();
		} else {
			onPinnedChange(true);
			onClosePeek();
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime$8.jsxs)("div", {
		className: [
			"claw-secondary-sidebar",
			pinned && "claw-secondary-sidebar--pinned",
			!pinned && hoverPeek && "claw-secondary-sidebar--floating"
		].filter(Boolean).join(" "),
		children: [pinned && /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(DrawerPanel, {
			mode: "pinned",
			...drawerProps,
			onTogglePinned: handleTogglePinned
		}), !pinned && hoverPeek && /* @__PURE__ */ (0, import_jsx_runtime$8.jsx)(DrawerPanel, {
			mode: "floating",
			...drawerProps,
			onTogglePinned: handleTogglePinned,
			hoverBindings: floatingBindings
		})]
	});
}
var import_react$14, import_jsx_runtime$8;
var init_secondary_sidebar = __esmMin((() => {
	init_secondary_sidebar$1();
	import_react$14 = /* @__PURE__ */ __toESM(require_react());
	init_auth_context();
	init_useI18n();
	init_drawer_panel();
	init_use_sidebar_state();
	import_jsx_runtime$8 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/secondary-sidebar/use-hover-peek.ts
/** 管理收起态抽屉的 hover 浮出时序：触发区离开给足到达浮层的缓冲，浮层进入立即保活。 */
function useHoverPeek(disabled) {
	const [hoverPeek, setHoverPeek] = (0, import_react$13.useState)(false);
	const enterTimerRef = (0, import_react$13.useRef)(null);
	const leaveTimerRef = (0, import_react$13.useRef)(null);
	const clearEnterTimer = (0, import_react$13.useCallback)(() => {
		if (enterTimerRef.current) {
			clearTimeout(enterTimerRef.current);
			enterTimerRef.current = null;
		}
	}, []);
	const clearLeaveTimer = (0, import_react$13.useCallback)(() => {
		if (leaveTimerRef.current) {
			clearTimeout(leaveTimerRef.current);
			leaveTimerRef.current = null;
		}
	}, []);
	const closePeek = (0, import_react$13.useCallback)(() => {
		clearEnterTimer();
		clearLeaveTimer();
		setHoverPeek(false);
	}, [clearEnterTimer, clearLeaveTimer]);
	const handleTriggerEnter = (0, import_react$13.useCallback)(() => {
		if (disabled) return;
		clearLeaveTimer();
		clearEnterTimer();
		enterTimerRef.current = setTimeout(() => {
			setHoverPeek(true);
			enterTimerRef.current = null;
		}, ENTER_DELAY_MS);
	}, [
		clearEnterTimer,
		clearLeaveTimer,
		disabled
	]);
	const handleFloatingEnter = (0, import_react$13.useCallback)(() => {
		if (disabled) return;
		clearEnterTimer();
		clearLeaveTimer();
		setHoverPeek(true);
	}, [
		clearEnterTimer,
		clearLeaveTimer,
		disabled
	]);
	const scheduleClose = (0, import_react$13.useCallback)((delay) => {
		clearEnterTimer();
		clearLeaveTimer();
		leaveTimerRef.current = setTimeout(() => {
			setHoverPeek(false);
			leaveTimerRef.current = null;
		}, delay);
	}, [clearEnterTimer, clearLeaveTimer]);
	const handleTriggerLeave = (0, import_react$13.useCallback)(() => {
		scheduleClose(TRIGGER_LEAVE_DELAY_MS);
	}, [scheduleClose]);
	const handleFloatingLeave = (0, import_react$13.useCallback)(() => {
		scheduleClose(FLOATING_LEAVE_DELAY_MS);
	}, [scheduleClose]);
	(0, import_react$13.useEffect)(() => {
		if (disabled) closePeek();
	}, [closePeek, disabled]);
	(0, import_react$13.useEffect)(() => {
		if (!hoverPeek) return;
		const handleKeyDown = (event) => {
			if (event.key === "Escape") closePeek();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [closePeek, hoverPeek]);
	(0, import_react$13.useEffect)(() => () => {
		clearEnterTimer();
		clearLeaveTimer();
	}, [clearEnterTimer, clearLeaveTimer]);
	return {
		hoverPeek,
		setHoverPeek,
		closePeek,
		triggerBindings: (0, import_react$13.useMemo)(() => ({
			onMouseEnter: handleTriggerEnter,
			onMouseLeave: handleTriggerLeave
		}), [handleTriggerEnter, handleTriggerLeave]),
		floatingBindings: (0, import_react$13.useMemo)(() => ({
			onMouseEnter: handleFloatingEnter,
			onMouseLeave: handleFloatingLeave
		}), [handleFloatingEnter, handleFloatingLeave])
	};
}
var import_react$13, ENTER_DELAY_MS, TRIGGER_LEAVE_DELAY_MS, FLOATING_LEAVE_DELAY_MS;
var init_use_hover_peek = __esmMin((() => {
	import_react$13 = /* @__PURE__ */ __toESM(require_react());
	ENTER_DELAY_MS = 100;
	TRIGGER_LEAVE_DELAY_MS = 300;
	FLOATING_LEAVE_DELAY_MS = 300;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tab-target-utils.ts
function getTabAgentId$1(tab) {
	return tab.rawAgent?.id;
}
function isTabAgentTarget$1(tab, targetAgentId) {
	return tab.rawAgent?.id === targetAgentId || tab.rawAgent?.agentId === targetAgentId || tab.key.endsWith(`-${targetAgentId}`);
}
var init_tab_target_utils = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/empty-tab-pane.tsx
/** 云助理和普通助理的轻量空态，也用于真实对话区动态加载 fallback。 */
function EmptyTabPane({ label, hint, actions }) {
	const t = useTranslation();
	return /* @__PURE__ */ (0, import_jsx_runtime$7.jsxs)("div", {
		className: "claw-empty-tab-pane",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$7.jsx)("div", {
			className: "claw-empty-tab-pane__topbar",
			children: /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(ClawWorkspaceTitle, {})
		}), /* @__PURE__ */ (0, import_jsx_runtime$7.jsxs)("div", {
			className: "claw-empty-tab-pane__content",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$7.jsx)("div", {
					className: "claw-empty-tab-pane__title",
					children: label
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$7.jsx)("div", {
					className: "claw-empty-tab-pane__hint",
					children: hint ?? t("claw.workspace.emptyPaneHint")
				}),
				actions && /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)("div", {
					className: "claw-empty-tab-pane__actions",
					children: actions
				})
			]
		})]
	});
}
/** 助理历史恢复期间的聊天区骨架屏；自动重试对用户静默，只呈现加载占位。 */
function AssistantChatSkeleton() {
	return /* @__PURE__ */ (0, import_jsx_runtime$7.jsxs)("div", {
		className: "claw-empty-tab-pane claw-assistant-chat-skeleton",
		"aria-busy": "true",
		"aria-live": "polite",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$7.jsx)("div", {
			className: "claw-empty-tab-pane__topbar",
			children: /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(ClawWorkspaceTitle, {})
		}), /* @__PURE__ */ (0, import_jsx_runtime$7.jsx)(AssistantChatSkeletonMessages, {})]
	});
}
var import_jsx_runtime$7;
var init_empty_tab_pane = __esmMin((() => {
	init_empty_tab_pane$1();
	require_react();
	init_useI18n();
	init_workspace_title();
	init_assistant_chat_skeleton();
	import_jsx_runtime$7 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/assistant-tab-content.tsx
/** 助理 tab 内容渲染网关：resolver 未完成/失败时禁止真实聊天页提前挂载。 */
function AssistantTabContent({ tab, activeTab, mainContentProps, assistantOpenTarget, resolvingAssistantTabKey, assistantTargetError, onAssistantChatTargetReady, onAssistantSessionDeleted, onRetryAssistantTarget, onOpenNewAssistantChatTarget }) {
	const t = useTranslation();
	const isResolving = resolvingAssistantTabKey === tab.key;
	const targetError = assistantTargetError?.tabKey === tab.key ? assistantTargetError : void 0;
	const hasTargetError = targetError !== void 0;
	const isActive = tab.key === activeTab;
	const hasRenderedActiveContentRef = import_react$11.useRef(false);
	const hasRenderedActiveContent = hasRenderedActiveContentRef.current;
	const shouldShowResolvingSkeleton = isResolving && !hasRenderedActiveContent;
	if (isActive && !isResolving && !hasTargetError) hasRenderedActiveContentRef.current = true;
	if (shouldShowResolvingSkeleton) return /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(AssistantChatSkeleton, {});
	if (targetError) return /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(EmptyTabPane, {
		label: tab.label,
		hint: targetError.message,
		actions: tab.rawAgent ? /* @__PURE__ */ (0, import_jsx_runtime$6.jsxs)(import_jsx_runtime$6.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Button, {
			size: "small",
			variant: "primary",
			onClick: () => onRetryAssistantTarget(tab),
			children: t("common.retry")
		}), /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(Button, {
			size: "small",
			variant: "secondary",
			onClick: () => onOpenNewAssistantChatTarget(tab),
			children: t("colleagues.chat.sessionPicker.newSession")
		})] }) : void 0
	});
	return /* @__PURE__ */ (0, import_jsx_runtime$6.jsx)(import_jsx_runtime$6.Fragment, { children: tab.renderContent({
		mainContentProps,
		isActive,
		assistantOpenTarget,
		onAssistantChatTargetReady,
		onAssistantSessionDeleted
	}) });
}
var import_react$11, import_jsx_runtime$6;
var init_assistant_tab_content = __esmMin((() => {
	init_src();
	import_react$11 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_empty_tab_pane();
	import_jsx_runtime$6 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/assistant-chat-history-resolver.ts
function isAssistantHistoryResolveTimeoutError(error) {
	return error instanceof AssistantHistoryResolveTimeoutError || typeof error === "object" && error !== null && error.code === "ASSISTANT_HISTORY_RESOLVE_TIMEOUT";
}
function isNonEmptyString$1(value) {
	return typeof value === "string" && value.trim().length > 0;
}
function getAssistantAgentIds(agent) {
	return Array.from(new Set([agent.id, agent.agentId].filter(isNonEmptyString$1)));
}
function getTimestamp(...values) {
	for (const value of values) {
		if (!value) continue;
		const timestamp = Date.parse(value);
		if (Number.isFinite(timestamp)) return timestamp;
	}
	return 0;
}
async function withTimeout(promise, timeoutMs, context) {
	let timer;
	const timeoutPromise = new Promise((_, reject) => {
		timer = setTimeout(() => {
			reject(new AssistantHistoryResolveAttemptTimeoutError(timeoutMs, context));
		}, timeoutMs);
	});
	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}
function conversationMatchesAgent(conversation, ids) {
	return (conversation.agent?.agentId ? ids.has(conversation.agent.agentId) : false) || (conversation.agent?.id ? ids.has(conversation.agent.id) : false) || (conversation.agentId ? ids.has(conversation.agentId) : false);
}
function isExcludedConversation(conversation, excludedSessionIds) {
	if (!excludedSessionIds) return false;
	return excludedSessionIds.has(conversation.id) || (conversation.sessionId ? excludedSessionIds.has(conversation.sessionId) : false);
}
function toCandidate(agentId, conversation) {
	return {
		agentId,
		conversation,
		timestamp: getTimestamp(conversation.lastActivityAt, conversation.updatedAt, conversation.createdAt)
	};
}
function getRetryTimeouts(options) {
	if (options.retryTimeoutsMs?.length) return options.retryTimeoutsMs;
	if (typeof options.timeoutMs === "number") return [options.timeoutMs];
	return RESOLVE_RETRY_TIMEOUTS_MS;
}
/** 查询指定助理最近一条真实历史会话；只读历史，不改变显式 target 和本地 last-opened 优先级。 */
async function resolveLatestAssistantChatTarget(options) {
	const retryTimeouts = getRetryTimeouts(options);
	let lastError;
	for (let index = 0; index < retryTimeouts.length; index += 1) {
		const timeoutMs = retryTimeouts[index];
		options.onResolveAttempt?.({
			attempt: index + 1,
			maxAttempts: retryTimeouts.length,
			timeoutMs
		});
		try {
			return await withTimeout(resolveLatestAssistantChatTargetInner(options), timeoutMs, {
				agentId: options.agent.id,
				tabKey: options.tabKey
			});
		} catch (error) {
			lastError = error;
			if (error instanceof AssistantHistoryResolveCapabilityError) throw error;
			if (index === retryTimeouts.length - 1) break;
		}
	}
	const lastTimeoutMs = retryTimeouts[retryTimeouts.length - 1] ?? 0;
	if (lastError instanceof AssistantHistoryResolveAttemptTimeoutError) throw new AssistantHistoryResolveTimeoutError(retryTimeouts.length, lastTimeoutMs, options.agent.id, options.tabKey);
	throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Assistant history resolver failed"));
}
async function resolveLatestAssistantChatTargetInner({ adapter, agent, excludedSessionIds }) {
	const listConversations = adapter?.listCloudAgentUserConversations?.bind(adapter);
	if (!listConversations) throw new AssistantHistoryResolveCapabilityError("Assistant history resolver requires listCloudAgentUserConversations");
	const queryAgentIds = getAssistantAgentIds(agent);
	if (queryAgentIds.length === 0) return null;
	const queryAgentIdSet = new Set(queryAgentIds);
	const candidates = [];
	let lastError;
	let hasSuccessfulQuery = false;
	for (const queryAgentId of queryAgentIds) try {
		const result = await listConversations({
			agentId: queryAgentId,
			page: 1,
			pageSize: RESOLVE_CONVERSATION_PAGE_SIZE
		});
		hasSuccessfulQuery = true;
		for (const conversation of result.items ?? []) {
			if (!conversationMatchesAgent(conversation, queryAgentIdSet) || isExcludedConversation(conversation, excludedSessionIds)) continue;
			candidates.push(toCandidate(agent.id, conversation));
		}
	} catch (error) {
		lastError = error;
	}
	if (candidates.length === 0) {
		if (!hasSuccessfulQuery && lastError) throw lastError;
		return null;
	}
	candidates.sort((a, b) => b.timestamp - a.timestamp);
	const { conversation, agentId } = candidates[0];
	return {
		agentId,
		instanceId: conversation.id,
		runtimeId: conversation.runtimeId ?? null,
		sessionId: conversation.id,
		sessionStatus: conversation.status ?? null,
		seq: `latest:${agentId}:${conversation.id}:${Date.now()}`
	};
}
var RESOLVE_CONVERSATION_PAGE_SIZE, RESOLVE_RETRY_TIMEOUTS_MS, AssistantHistoryResolveAttemptTimeoutError, AssistantHistoryResolveTimeoutError, AssistantHistoryResolveCapabilityError;
var init_assistant_chat_history_resolver = __esmMin((() => {
	RESOLVE_CONVERSATION_PAGE_SIZE = 10;
	RESOLVE_RETRY_TIMEOUTS_MS = [
		1e4,
		12e3,
		15e3
	];
	AssistantHistoryResolveAttemptTimeoutError = class extends Error {
		constructor(timeoutMs, context) {
			super(`Assistant history resolver attempt timed out after ${timeoutMs}ms for ${context.tabKey}/${context.agentId}`);
			this.name = "AssistantHistoryResolveAttemptTimeoutError";
		}
	};
	AssistantHistoryResolveTimeoutError = class extends Error {
		code = "ASSISTANT_HISTORY_RESOLVE_TIMEOUT";
		constructor(attempts, lastTimeoutMs, agentId, tabKey) {
			super(`Assistant history resolver timed out after ${lastTimeoutMs}ms for ${tabKey}/${agentId}`);
			this.attempts = attempts;
			this.lastTimeoutMs = lastTimeoutMs;
			this.agentId = agentId;
			this.tabKey = tabKey;
			this.name = "AssistantHistoryResolveTimeoutError";
		}
	};
	AssistantHistoryResolveCapabilityError = class extends Error {
		constructor(message) {
			super(message);
			this.name = "AssistantHistoryResolveCapabilityError";
		}
	};
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/assistant-chat-target-store.ts
function getStorageKey(accountKey, agentId) {
	return `${STORAGE_KEY_PREFIX}.${accountKey}.${agentId}`;
}
function getStoragePrefix(accountKey) {
	return `${STORAGE_KEY_PREFIX}.${accountKey}.`;
}
function getLegacyStorageKey(accountKey) {
	return `${LEGACY_STORAGE_KEY_PREFIX}.${accountKey}`;
}
function reportStorageError(operation, error, context) {
	console.warn("[ClawAssistantTargetStore] storage operation failed", {
		operation,
		...context
	}, error);
}
function getStorage() {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage ?? null;
	} catch (error) {
		reportStorageError("getStorage", error);
		return null;
	}
}
function safeRemoveItem(storage, key, context) {
	try {
		storage.removeItem(key);
	} catch (error) {
		reportStorageError("removeItem", error, {
			key,
			...context
		});
	}
}
function isNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0;
}
function normalizeSessionStatus(value) {
	if (value === null) return null;
	return isNonEmptyString(value) ? value : void 0;
}
function isExpired(updatedAt) {
	return Date.now() - updatedAt > TARGET_TTL_MS;
}
function parseTarget(value) {
	if (!value || typeof value !== "object") return null;
	const record = value;
	if (record.version !== STORE_VERSION || !isNonEmptyString(record.tabKey) || !isNonEmptyString(record.agentId) || !isNonEmptyString(record.instanceId) || !isNonEmptyString(record.sessionId)) return null;
	const updatedAt = record.updatedAt;
	if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || isExpired(updatedAt)) return null;
	return {
		version: STORE_VERSION,
		tabKey: record.tabKey,
		agentId: record.agentId,
		instanceId: record.instanceId,
		runtimeId: isNonEmptyString(record.runtimeId) ? record.runtimeId : null,
		sessionId: record.sessionId,
		sessionStatus: normalizeSessionStatus(record.sessionStatus),
		updatedAt
	};
}
function parseLegacyTarget(value) {
	if (!value || typeof value !== "object") return null;
	const record = value;
	if (record.version !== LEGACY_STORE_VERSION || !isNonEmptyString(record.tabKey) || !isNonEmptyString(record.agentId) || !isNonEmptyString(record.instanceId) || !isNonEmptyString(record.sessionId)) return null;
	const updatedAt = record.updatedAt;
	if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || isExpired(updatedAt)) return null;
	const legacy = record;
	return {
		version: STORE_VERSION,
		tabKey: legacy.tabKey,
		agentId: legacy.agentId,
		instanceId: legacy.instanceId,
		runtimeId: null,
		sessionId: legacy.sessionId,
		sessionStatus: normalizeSessionStatus(legacy.sessionStatus),
		updatedAt
	};
}
function readTargetByKey(storage, key) {
	try {
		const raw = storage.getItem(key);
		if (!raw) return null;
		const parsed = parseTarget(JSON.parse(raw));
		if (!parsed) safeRemoveItem(storage, key, { reason: "invalid-target" });
		return parsed;
	} catch (error) {
		reportStorageError("readTargetByKey", error, { key });
		safeRemoveItem(storage, key, { reason: "read-or-parse-failed" });
		return null;
	}
}
function readLegacyTarget(storage, accountKey) {
	const key = getLegacyStorageKey(accountKey);
	try {
		const raw = storage.getItem(key);
		if (!raw) return null;
		const parsed = parseLegacyTarget(JSON.parse(raw));
		if (!parsed) safeRemoveItem(storage, key, {
			accountKey,
			reason: "invalid-legacy-target"
		});
		return parsed;
	} catch (error) {
		reportStorageError("readLegacyTarget", error, {
			accountKey,
			key
		});
		safeRemoveItem(storage, key, {
			accountKey,
			reason: "legacy-read-or-parse-failed"
		});
		return null;
	}
}
function getAgentIds(agentIds) {
	return Array.from(new Set((agentIds ?? []).filter(isNonEmptyString)));
}
function matchesTarget(target, agentIds) {
	return agentIds.length === 0 || agentIds.includes(target.agentId) || agentIds.includes(target.tabKey);
}
function matchesSessionTarget(target, sessionIds) {
	return sessionIds.length > 0 && (sessionIds.includes(target.instanceId) || sessionIds.includes(target.sessionId));
}
/** 读取指定助理最近一次聊天目标；按 agent aliases 查 v2，并兼容读取账号级 v1 legacy target。 */
function readLastAssistantChatTarget(accountKey, agentIds) {
	const storage = getStorage();
	if (!storage) return null;
	const normalizedAgentIds = getAgentIds(agentIds);
	for (const agentId of normalizedAgentIds) {
		const parsed = readTargetByKey(storage, getStorageKey(accountKey, agentId));
		if (parsed) return parsed;
	}
	const legacy = readLegacyTarget(storage, accountKey);
	return legacy && matchesTarget(legacy, normalizedAgentIds) ? legacy : null;
}
/** 读取当前账号最近一次任意助理聊天目标，用于 /claw 无显式 target 时选择默认助理。 */
function readMostRecentAssistantChatTarget(accountKey) {
	const storage = getStorage();
	if (!storage) return null;
	const prefix = getStoragePrefix(accountKey);
	const targets = [];
	for (let index = 0; index < storage.length; index += 1) {
		const key = storage.key(index);
		if (!key?.startsWith(prefix)) continue;
		const parsed = readTargetByKey(storage, key);
		if (parsed) targets.push(parsed);
	}
	const legacy = readLegacyTarget(storage, accountKey);
	if (legacy) targets.push(legacy);
	targets.sort((a, b) => b.updatedAt - a.updatedAt);
	return targets[0] ?? null;
}
/** 写入指定助理最近一次聊天目标，仅保存 session 身份字段，不保存消息正文。 */
function writeLastAssistantChatTarget(accountKey, target) {
	if (!isNonEmptyString(target.tabKey) || !isNonEmptyString(target.agentId) || !isNonEmptyString(target.instanceId) || !isNonEmptyString(target.sessionId)) return;
	const storage = getStorage();
	if (!storage) return;
	const nextTarget = {
		version: STORE_VERSION,
		tabKey: target.tabKey,
		agentId: target.agentId,
		instanceId: target.instanceId,
		runtimeId: target.runtimeId ?? null,
		sessionId: target.sessionId,
		sessionStatus: target.sessionStatus,
		updatedAt: Date.now()
	};
	try {
		storage.setItem(getStorageKey(accountKey, target.agentId), JSON.stringify(nextTarget));
		storage.setItem(getLegacyStorageKey(accountKey), JSON.stringify({
			...nextTarget,
			version: LEGACY_STORE_VERSION
		}));
	} catch (error) {
		reportStorageError("writeLastAssistantChatTarget", error, {
			accountKey,
			agentId: target.agentId,
			tabKey: target.tabKey,
			instanceId: target.instanceId,
			sessionId: target.sessionId
		});
	}
}
/** 删除指定会话对应的最近目标，保留同一助理下其他会话的缓存。 */
function clearLastAssistantChatTargetForSession(accountKey, options) {
	const storage = getStorage();
	if (!storage) return;
	const normalizedAgentIds = getAgentIds(options.agentIds);
	const sessionIds = getAgentIds([options.instanceId, options.sessionId]);
	if (sessionIds.length === 0) return;
	try {
		const prefix = getStoragePrefix(accountKey);
		const keysToCheck = [];
		for (let index = 0; index < storage.length; index += 1) {
			const key = storage.key(index);
			if (key?.startsWith(prefix)) keysToCheck.push(key);
		}
		keysToCheck.forEach((key) => {
			const target = readTargetByKey(storage, key);
			if (target && matchesTarget(target, normalizedAgentIds) && matchesSessionTarget(target, sessionIds)) safeRemoveItem(storage, key, {
				accountKey,
				reason: "clear-session",
				sessionIds: sessionIds.join(",")
			});
		});
		const legacy = readLegacyTarget(storage, accountKey);
		if (legacy && matchesTarget(legacy, normalizedAgentIds) && matchesSessionTarget(legacy, sessionIds)) safeRemoveItem(storage, getLegacyStorageKey(accountKey), {
			accountKey,
			reason: "clear-session-legacy"
		});
	} catch (error) {
		reportStorageError("clearLastAssistantChatTargetForSession", error, {
			accountKey,
			agentIds: normalizedAgentIds.join(","),
			sessionIds: sessionIds.join(",")
		});
	}
}
function clearLastAssistantChatTarget(accountKey, agentIds) {
	const storage = getStorage();
	if (!storage) return;
	const normalizedAgentIds = getAgentIds(agentIds);
	try {
		if (normalizedAgentIds.length === 0) {
			const prefix = getStoragePrefix(accountKey);
			const keysToRemove = [];
			for (let index = 0; index < storage.length; index += 1) {
				const key = storage.key(index);
				if (key?.startsWith(prefix)) keysToRemove.push(key);
			}
			keysToRemove.forEach((key) => safeRemoveItem(storage, key, {
				accountKey,
				reason: "clear-all"
			}));
			safeRemoveItem(storage, getLegacyStorageKey(accountKey), {
				accountKey,
				reason: "clear-all-legacy"
			});
			return;
		}
		normalizedAgentIds.forEach((agentId) => safeRemoveItem(storage, getStorageKey(accountKey, agentId), {
			accountKey,
			agentId,
			reason: "clear-agent"
		}));
		const legacy = readLegacyTarget(storage, accountKey);
		if (!legacy || matchesTarget(legacy, normalizedAgentIds)) safeRemoveItem(storage, getLegacyStorageKey(accountKey), {
			accountKey,
			reason: "clear-matching-legacy"
		});
	} catch (error) {
		reportStorageError("clearLastAssistantChatTarget", error, {
			accountKey,
			agentIds: normalizedAgentIds.join(",")
		});
	}
}
var LEGACY_STORAGE_KEY_PREFIX, STORAGE_KEY_PREFIX, STORE_VERSION, LEGACY_STORE_VERSION, TARGET_TTL_MS;
var init_assistant_chat_target_store = __esmMin((() => {
	LEGACY_STORAGE_KEY_PREFIX = "claw-workspace.assistantChatTarget.v1";
	STORAGE_KEY_PREFIX = "claw-workspace.assistantChatTarget.v2";
	STORE_VERSION = 2;
	LEGACY_STORE_VERSION = 1;
	TARGET_TTL_MS = 720 * 60 * 60 * 1e3;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/assistant-chat-restore-utils.ts
function getTabAgentId(tab) {
	return tab.rawAgent?.id;
}
function getTabAgentAliases(tab) {
	return Array.from(new Set([
		tab.rawAgent?.id,
		tab.rawAgent?.agentId,
		tab.key
	].filter((value) => typeof value === "string" && value.length > 0)));
}
function isAssistantTab(tab) {
	return Boolean(tab?.rawAgent) && tab?.key !== "claw-local" && tab?.key !== "cloud-trial";
}
function isTabAgentTarget(tab, targetAgentId) {
	return tab.rawAgent?.id === targetAgentId || tab.rawAgent?.agentId === targetAgentId || tab.key.endsWith(`-${targetAgentId}`);
}
/**
* 把 /claw assistant-chat 路由目标收成 pane 的 openTarget。
*
* 待办「查看助理进度」在 listGrantedCloudAgents 拿不到 instance（后端已忽略 withInstances）时，
* 只会给出 `agentRole + sessionId`。必须用已加载的 tab 补齐 agentId，并用 sessionId 作为
* conversation/instance id 打开**该**会话；禁止回落到 tab 的「最近会话 / 新建」，
* 否则刚派发的 sessionId 会被丢掉，助理工作界面空白（issue #94720）。
*/
function resolveAssistantRouteOpenTarget(routeTarget, tab, seq) {
	if (routeTarget.intent === "new") return { kind: "new" };
	const agentId = routeTarget.agentId ?? getTabAgentId(tab);
	const chatIds = resolveAssistantChatIds(routeTarget);
	if (agentId && chatIds) return {
		kind: "open",
		target: {
			agentId,
			instanceId: chatIds.instanceId,
			runtimeId: routeTarget.runtimeId ?? null,
			sessionId: chatIds.sessionId,
			sessionStatus: routeTarget.sessionStatus ?? null,
			seq
		}
	};
	return { kind: "restore-tab" };
}
function findAssistantTargetTab(tabs, target) {
	const agentId = target.agentId;
	if (agentId) {
		const exactTab = tabs.find((tab) => isTabAgentTarget(tab, agentId));
		if (exactTab) return exactTab;
	}
	if (target.agentRole === "orchestrator") return tabs.find((tab) => tab.kind === "cloud" && tab.key !== "cloud-trial" && tab.rawAgent);
}
function findStoredTargetTab(tabs, target) {
	return tabs.find((tab) => isTabAgentTarget(tab, target.agentId)) ?? tabs.find((tab) => tab.key === target.tabKey);
}
function findDefaultAssistantTab(tabs, activeTab, accountKey) {
	const currentTab = tabs.find((tab) => tab.key === activeTab);
	if (isAssistantTab(currentTab)) return currentTab;
	const mostRecentTarget = readMostRecentAssistantChatTarget(accountKey);
	if (mostRecentTarget) {
		const recentTab = findStoredTargetTab(tabs, mostRecentTarget);
		if (isAssistantTab(recentTab)) return recentTab;
	}
	return tabs.find((tab) => tab.kind === "cloud" && tab.key !== "cloud-trial" && tab.rawAgent) ?? tabs.find((tab) => tab.kind === "normal" && tab.rawAgent) ?? tabs.find((tab) => tab.kind === "enterprise" && tab.rawAgent);
}
function getRestoreSeq(target) {
	return `restore:${target.updatedAt}:${target.sessionId}`;
}
/**
* 默认恢复在账号和 tab 生命周期内只消费一次；不包含 updatedAt，避免列表心跳
* 更新同一会话时生成新 seq 并重复触发 restart。
*/
function getDefaultRestoreConsumeKey(accountKey, tabKey) {
	return `${accountKey}:${tabKey}:default`;
}
function getSessionDeleteKey(instanceId, sessionId) {
	return `${instanceId ?? ""}:${sessionId}`;
}
/** 从 getConversationDetail 响应里安全提取非空 runtimeId。 */
function extractDetailRuntimeId(detail) {
	if (!detail || typeof detail !== "object") return;
	const runtimeId = detail.runtimeId;
	return typeof runtimeId === "string" && runtimeId.length > 0 ? runtimeId : void 0;
}
/**
* 校验本地缓存的历史会话是否仍存在（issue #82058）。
* - 'valid'：会话仍存在，可直接恢复（detail 携带的 runtimeId 一并返回供回填）
* - 'not-found'：明确 404/会话不存在，应清缓存并切到新建
* - 'unknown'：网络/超时等其他错误，保守按缓存恢复，不打断用户
*/
async function validateStoredAssistantTarget(getConversationDetail, conversationId) {
	try {
		return {
			status: "valid",
			runtimeId: extractDetailRuntimeId(await getConversationDetail({ conversationId }))
		};
	} catch (error) {
		return { status: isColleagueChatNotFoundError(error) ? "not-found" : "unknown" };
	}
}
var init_assistant_chat_restore_utils = __esmMin((() => {
	init_chat_error();
	init_assistant_chat_target_store();
	init_tab_registry();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/use-assistant-chat-restore.ts
/** 统一处理 /claw 显式路由目标与助理最近会话恢复，避免入口组件继续膨胀。 */
function useAssistantChatRestore({ accountKey, adapter, tabs, activeTab, canValidateActiveTab, setActiveTab, onOpenLocalClaw, onOpenEditAssistant }) {
	const t = useTranslation();
	const location = useLocation();
	const navigate = useNavigate();
	const [assistantOpenTarget, setAssistantOpenTarget] = import_react$10.useState(void 0);
	const [resolvingAssistantTabKey, setResolvingAssistantTabKey] = import_react$10.useState(void 0);
	const [assistantTargetError, setAssistantTargetError] = import_react$10.useState(void 0);
	const consumedRestoreRef = import_react$10.useRef(void 0);
	const activeTabRef = import_react$10.useRef(activeTab);
	const resolveSeqRef = import_react$10.useRef(0);
	const deletedSessionKeysRef = import_react$10.useRef(/* @__PURE__ */ new Set());
	const assistantOpenTargetRef = import_react$10.useRef(void 0);
	import_react$10.useEffect(() => {
		activeTabRef.current = activeTab;
	}, [activeTab]);
	import_react$10.useEffect(() => {
		consumedRestoreRef.current = void 0;
		deletedSessionKeysRef.current.clear();
	}, [accountKey]);
	import_react$10.useEffect(() => {
		assistantOpenTargetRef.current = assistantOpenTarget;
	}, [assistantOpenTarget]);
	import_react$10.useEffect(() => {
		const subscription = colleagueConversationPatches$.subscribe((patch) => {
			if (patch.type !== "remove-session") return;
			deletedSessionKeysRef.current.add(getSessionDeleteKey(patch.instanceId, patch.sessionId));
			clearLastAssistantChatTargetForSession(accountKey, {
				agentIds: patch.agentId ? [patch.agentId] : void 0,
				instanceId: patch.instanceId,
				sessionId: patch.sessionId
			});
		});
		return () => subscription.unsubscribe();
	}, [accountKey]);
	const clearAssistantChatTarget = import_react$10.useCallback((agentIds) => {
		clearLastAssistantChatTarget(accountKey, agentIds);
		setAssistantOpenTarget(void 0);
		consumedRestoreRef.current = void 0;
	}, [accountKey]);
	const openAssistantChatTarget = import_react$10.useCallback((target) => {
		resolveSeqRef.current += 1;
		setResolvingAssistantTabKey(void 0);
		setAssistantTargetError(void 0);
		setAssistantOpenTarget(target);
		const targetTab = tabs.find((tab) => isTabAgentTarget(tab, target.agentId));
		if (targetTab) consumedRestoreRef.current = getDefaultRestoreConsumeKey(accountKey, targetTab.key);
	}, [accountKey, tabs]);
	const openNewAssistantChatTarget = import_react$10.useCallback((tab) => {
		const agentId = getTabAgentId(tab);
		if (!agentId) return;
		resolveSeqRef.current += 1;
		setActiveTab(tab.key);
		consumedRestoreRef.current = getDefaultRestoreConsumeKey(accountKey, tab.key);
		setResolvingAssistantTabKey(void 0);
		setAssistantTargetError(void 0);
		setAssistantOpenTarget({
			agentId,
			seq: `new:${agentId}:${Date.now()}`
		});
	}, [accountKey, setActiveTab]);
	const requestOpenAssistantTab = import_react$10.useCallback(async (tab) => {
		if (tab.key === "claw-local") {
			if (isExplicitClawAssistantIntent(readClawOpenIntent(location.search, location.state))) navigate(location.pathname, {
				replace: true,
				state: null
			});
			resolveSeqRef.current += 1;
			consumedRestoreRef.current = getDefaultRestoreConsumeKey(accountKey, CLAW_LOCAL_TAB_KEY);
			setActiveTab(tab.key);
			setResolvingAssistantTabKey(void 0);
			setAssistantTargetError(void 0);
			setAssistantOpenTarget(void 0);
			if (activeTabRef.current !== "claw-local") onOpenLocalClaw();
			return;
		}
		if (readClawLocalSessionIdFromSearch(location.search)) {
			const nextSearch = removeClawLocalSessionIdFromSearch(location.search);
			navigate(`${location.pathname}${nextSearch}`, {
				replace: true,
				state: null
			});
		}
		const agent = tab.rawAgent;
		if (!agent) {
			setActiveTab(tab.key);
			return;
		}
		const requestSeq = ++resolveSeqRef.current;
		const agentAliases = getTabAgentAliases(tab);
		setActiveTab(tab.key);
		setAssistantTargetError(void 0);
		const storedTarget = readLastAssistantChatTarget(accountKey, agentAliases);
		if (storedTarget && !deletedSessionKeysRef.current.has(getSessionDeleteKey(storedTarget.instanceId, storedTarget.sessionId))) {
			const getConversationDetail = adapter?.getCloudAgentConversationDetail?.bind(adapter);
			let validation;
			if (getConversationDetail) {
				setResolvingAssistantTabKey(tab.key);
				validation = await validateStoredAssistantTarget(getConversationDetail, storedTarget.instanceId);
				if (resolveSeqRef.current !== requestSeq) return;
				if (validation.status === "not-found") {
					deletedSessionKeysRef.current.add(getSessionDeleteKey(storedTarget.instanceId, storedTarget.sessionId));
					clearLastAssistantChatTargetForSession(accountKey, {
						agentIds: agentAliases,
						instanceId: storedTarget.instanceId,
						sessionId: storedTarget.sessionId
					});
					setResolvingAssistantTabKey(void 0);
					message.warning(t("claw.workspace.assistantRestore.sessionExpired"));
					const targetTab = tabs.find((item) => isTabAgentTarget(item, storedTarget.agentId));
					if (targetTab) openNewAssistantChatTarget(targetTab);
					return;
				}
			}
			consumedRestoreRef.current = getDefaultRestoreConsumeKey(accountKey, tab.key);
			setResolvingAssistantTabKey(void 0);
			const restoredRuntimeId = storedTarget.runtimeId ?? validation?.runtimeId ?? null;
			setAssistantOpenTarget({
				agentId: storedTarget.agentId,
				instanceId: storedTarget.instanceId,
				runtimeId: restoredRuntimeId,
				sessionId: storedTarget.sessionId,
				sessionStatus: storedTarget.sessionStatus ?? null,
				seq: getRestoreSeq(storedTarget)
			});
			if (!storedTarget.runtimeId && validation?.runtimeId) writeLastAssistantChatTarget(accountKey, {
				tabKey: storedTarget.tabKey,
				agentId: storedTarget.agentId,
				instanceId: storedTarget.instanceId,
				runtimeId: validation.runtimeId,
				sessionId: storedTarget.sessionId,
				sessionStatus: storedTarget.sessionStatus ?? null
			});
			return;
		}
		setResolvingAssistantTabKey(tab.key);
		resolveLatestAssistantChatTarget({
			adapter,
			agent,
			tabKey: tab.key,
			excludedSessionIds: new Set(Array.from(deletedSessionKeysRef.current).map((key) => key.split(":").pop() ?? key))
		}).then((target) => {
			if (resolveSeqRef.current !== requestSeq) return;
			setResolvingAssistantTabKey(void 0);
			if (target) {
				setAssistantOpenTarget(target);
				writeLastAssistantChatTarget(accountKey, {
					tabKey: tab.key,
					agentId: target.agentId,
					instanceId: target.instanceId,
					runtimeId: target.runtimeId ?? null,
					sessionId: target.sessionId,
					sessionStatus: target.sessionStatus ?? null
				});
				return;
			}
			setAssistantOpenTarget({
				agentId: agent.id,
				seq: `new:${agent.id}:${Date.now()}`
			});
		}).catch((error) => {
			if (resolveSeqRef.current !== requestSeq) return;
			setResolvingAssistantTabKey(void 0);
			setAssistantTargetError({
				tabKey: tab.key,
				message: isAssistantHistoryResolveTimeoutError(error) ? t("claw.workspace.assistantRestore.timeout") : t("claw.workspace.assistantRestore.failed")
			});
		});
	}, [
		accountKey,
		adapter,
		location.pathname,
		location.search,
		location.state,
		navigate,
		onOpenLocalClaw,
		openNewAssistantChatTarget,
		setActiveTab,
		t,
		tabs
	]);
	const retryAssistantTarget = import_react$10.useCallback((tab) => {
		requestOpenAssistantTab(tab);
	}, [requestOpenAssistantTab]);
	const onAssistantChatTargetReady = import_react$10.useCallback((payload) => {
		if (payload.tabKey === "claw-local" || payload.tabKey !== activeTabRef.current || !payload.instanceId || !payload.sessionId) return;
		writeLastAssistantChatTarget(accountKey, {
			tabKey: payload.tabKey,
			agentId: payload.agentId,
			instanceId: payload.instanceId,
			runtimeId: payload.runtimeId ?? null,
			sessionId: payload.sessionId,
			sessionStatus: payload.sessionStatus
		});
	}, [accountKey]);
	const onAssistantSessionDeleted = import_react$10.useCallback((payload) => {
		deletedSessionKeysRef.current.add(getSessionDeleteKey(payload.instanceId, payload.sessionId));
		clearLastAssistantChatTarget(accountKey, [payload.agentId]);
		setAssistantOpenTarget(void 0);
	}, [accountKey]);
	import_react$10.useEffect(() => {
		const intent = readClawOpenIntent(location.search, location.state);
		if (intent.kind === "local-session") {
			if (activeTab !== "claw-local") setActiveTab(CLAW_LOCAL_TAB_KEY);
			consumedRestoreRef.current = getDefaultRestoreConsumeKey(accountKey, CLAW_LOCAL_TAB_KEY);
			return;
		}
		if (!canValidateActiveTab) return;
		if (intent.kind === "assistant-edit") {
			const targetTab = tabs.find((tab) => isTabAgentTarget(tab, intent.agentId));
			if (!targetTab) return;
			setActiveTab(targetTab.key);
			onOpenEditAssistant(getTabAgentId(targetTab) ?? intent.agentId);
			navigate(location.pathname, {
				replace: true,
				state: null
			});
			return;
		}
		if (intent.kind === "assistant-chat") {
			const { target } = intent;
			const targetTab = findAssistantTargetTab(tabs, target);
			if (!targetTab) return;
			const resolved = resolveAssistantRouteOpenTarget(target, targetTab, `${location.key}:${target.sessionId ?? target.instanceId ?? target.agentId ?? target.agentRole}`);
			if (resolved.kind === "open") {
				setActiveTab(targetTab.key);
				openAssistantChatTarget(resolved.target);
			} else if (resolved.kind === "new") openNewAssistantChatTarget(targetTab);
			else requestOpenAssistantTab(targetTab);
			navigate(location.pathname, {
				replace: true,
				state: null
			});
			return;
		}
		if (activeTab === "claw-local" && consumedRestoreRef.current === getDefaultRestoreConsumeKey(accountKey, "claw-local")) return;
		const targetTab = findDefaultAssistantTab(tabs, activeTab, accountKey);
		if (!targetTab) return;
		const consumeKey = getDefaultRestoreConsumeKey(accountKey, targetTab.key);
		if (consumedRestoreRef.current === consumeKey) return;
		consumedRestoreRef.current = consumeKey;
		requestOpenAssistantTab(targetTab);
	}, [
		accountKey,
		activeTab,
		canValidateActiveTab,
		location.key,
		location.pathname,
		location.search,
		navigate,
		onOpenEditAssistant,
		openAssistantChatTarget,
		openNewAssistantChatTarget,
		requestOpenAssistantTab,
		setActiveTab,
		tabs
	]);
	return {
		assistantOpenTarget,
		resolvingAssistantTabKey,
		assistantTargetError,
		openAssistantChatTarget,
		requestOpenAssistantTab,
		retryAssistantTarget,
		openNewAssistantChatTarget,
		onAssistantChatTargetReady,
		onAssistantSessionDeleted,
		clearAssistantChatTarget
	};
}
var import_react$10;
var init_use_assistant_chat_restore = __esmMin((() => {
	init_src();
	import_react$10 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_router();
	init_claw_assistant_route();
	init_colleague_navigation_bus();
	init_assistant_chat_history_resolver();
	init_assistant_chat_restore_utils();
	init_assistant_chat_target_store();
	init_tab_registry();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/assets/claw-cloud-assistant-avatar.png
var claw_cloud_assistant_avatar_default;
var init_claw_cloud_assistant_avatar = __esmMin((() => {
	claw_cloud_assistant_avatar_default = "" + new URL("assistant-avatar-C3supGLS.png", import.meta.url).href;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/assets/claw-local-assistant-avatar.png
var claw_local_assistant_avatar_default;
var init_claw_local_assistant_avatar = __esmMin((() => {
	claw_local_assistant_avatar_default = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAQRpQ0NQVEdGWAAAGJVjYGA8wwAELAYMDLl5JUVB7k4KEZFRCuwvGTgZxBnAIDG5uIABN2BkYPh2DUQyMFzWxaMOF+BMSS1OBtIfgFilCGg50EgRIFskHcLWALGTIGwbELu8pKAEyA4AsYtCgpyB7BQgWyMdiZ2ExE4uKAKp7wGyHXJzSpMR7mbgSc0LDQbSHEAsw1DMEMTgzuAE8j9ESf4iBgaLrwwMzBMQYkkzGRi2tzIwSNxCiKksYGDgb2Fg2HYeIYYIk4LEokSwEAsQM6WlMTB8Ws7AwBvJwCB8gYGBKxoWEDjcpgR2WwhDKkMeQzKYLGFQYPAE8/SALCMGAyA2ZWAAAPaCP+RXa/pgAAALDUlEQVR4nOWbfWgc5brAf+87MzvJJptNNkmTatrTYuHmYO0Ba6+txDZFQc692v6hXkROhUJBLmrusRUPR84fBwJRqGgvftQKuXgUREqxcAsqFzFXW2/VVtssNrTao6WNpx9JNrvJZrO7M++894911t00H20zSTX+YMlk5n3feZ5n3o/neWZewVUyNDRUY9v2v2qt24HfKKWagZjWugqwPM+zhBCG1loCAkBrLa72PgBCCP3joRZCeFprJaV0AAcYNwxjSAhxUWt9Vkp5UCl1IBqNJq7qHldSaHR09CHP8x5TSq1WSlVepR7zimEYOcMwjhuGsaeqqupvQghvuvLTGmBkZOTPruv+RSkVnnATTNNESln8CSGKP+CyvxOPp0Nrfdn//jn/WGuN53nFn+u6KKXK6hmGkQuFQi9WV1f/eap7TSpRJpNZks/njziO0+QLbts2oVAIy7KuWJH5RmuN67rkcjny+TyeV3j4pmkmw+HwOtu2T06sc5km4+PjG8bHx/9HKRUSQlBZWUllZeXPVump0FqTzWbJZDJorTEMw62oqPi3cDi8v7RcmVaZTKYlm83+XSkVMk2TSCSCYRjzK3nAeJ7HyMgIrusipVShUOh3kUjkhH9dlhbO5/NHfeWj0egvXnkAKSXRaBTLsvA8z3Bd9/+01kXFigYYGxv7i+M4TUIIIpHIL67LT4evk5QS13Vr0un0fxav+QeJRGJMKRUOh8OEw+HJW/qFk81mSafTGIbh1NXV1QghshIgnU5vUUqF/UlvoVJRUYGUEqWUNTY29kf4cQgopf4dwLbtBdX1J8O2bQCUUlvgJwPcChAKha6bYPOFbwDXdf8JQI6MjNQrpWwAy7Kuo2jzg2maCCHwPM9Ip9O3SCnlfVBwbxd69/cxTRMAIcR90vO89aUnfw34uiql1krgN8CCcHquFCkL7o/W+kaptW4qPTkXJJNJtmzZwpYtW+jt7Z2y3Pfff18s98MPP8yZPL6unuc1SM/zYnDloeq1EI1GSafTpFKpaRW7ePEiqVSKVCpFY2PjnMlT8rBrTKAS5tYAQghisRgDAwP09/eTTCbJ5/PF+F1KiWVZnDhRiFHq6+vndEn2dfU8r0IkEom0UqrKDxiCZnBwkI8//ph9+/YxNjZ2RXXC4TCbN29m/fr13HjjjYHLpJRieHgYwzAcMTw8nHVd166trQ10Jcjn83R3d/P+++/Pqp22tjYee+wxqqqqApKsECInEgmEEJ4YGhpyPc8z6urqAlsJLly4QGdnJ+fOnQMKXXzVqlXE43E8z2PNmjVs3ry52BWVUoyOjhZ/J0+epLe3F9d1AWhoaOCZZ55hxYoVgchXYgAthoaGlOd5MigDZLNZtm/fTn9/PwB33303W7duJRKJsHPnTg4ePIhpmuzcuZObbrpp2nbeeustDhw4AEBtbS27du0iFovNWkatNUNDQwAYTz/99F8BEQ6HA5kI3377bT777DMAtm3bxiOPPFL0v1esWMFHH31ELpfj008/xbZtUqkUfX19lxnDNE1Wr17NsmXLOHToENlslmQyybp162YtI8D4+DgwISM0WzzP44MPPgDg1ltvZdOmTWXXm5qa2L59O6Zpkk6nef311+ns7OTll1/m/Pnzk7a5bt067rnnHgA++eSTK55Ip6P0QcvJTl4rp06dIp1OA/Dggw9OWmbNmjXs2rWLlStXFifd2tpaTp68LGFb5P777wcKBj527Nis5SzFvNa3NpNx/PhxoLCMtba2Tllu6dKldHV14bouyWSShoaGadttbm5m8eLFnD9/nuPHj9PW1haUyMEOgUuXLgGwZMmSGSfUbDbLN998w4ULF4rjcTp8f2BwcHD2gpYQaAg4MjICQE1NzZRlXNflnXfeYd++fcUXF0II7r333rIJcyK+Zzg6OhqkyMH2AH+Cmi6p+sILL7B3796i8lBYlg4cOEBXV9eU9XwDXElvuRoCNcDEd3oTOXr0KIcOHQLgjjvu4NVXX2XPnj3cddddABw7doyenp5J6/pu+kz3uFrmLgaehC+//BKARYsW8dRTT9HS0sLixYvp6Ohg2bJlZWUmMtXQuFb8VW9eDeCv9cuXLy+LO4QQRTd3Kn9grqLVeTXAkiVLAPj222/J5XLF867rFv2AlpaW+RRpfg2wdu1aABKJBJ2dnXz99df09fXx7LPPFmOHmVzdoHqCP5cEugzOJNzNN9/Mxo0b6enpIR6PE4/Hy66vXr26aKSJBD35+cxrDzh48CCHDx+e8npvby/vvffepNd8AwSduwy0B/je38RPVQDeffdd3njjjWK5DRs2cMstt2AYBn19ffT09JDL5Xjttde4ePEiW7duLavvtxl09toUQuig4gHfA/Q9Qp94PM6bb74JFFzaHTt2lCU32tvb2bRpE88//zzfffcd+/fvp7W1tWw+8NuMRqNBiFqk2J+CGGO1tbVAIQ1eyu7du/E8j1gsxnPPPTdpZqelpYWuri6am5uLdfyMUGmb/j2CItABtXTpUgD6+/uLPns8Hi+mwh999NFpn2A4HObxxx8HCgp/8cUXQCG/ePr0aeCnpXQ2lD7s4hAIogfcdtttQCFuP3r0KBs3bqS+vp6HH36YM2fOcPvtt8/YxqpVq2hvb6e5uZkbbrgBKITZ+Xy+7B5BEXhStKOjgzNnztDY2MhLL700669NHMfhySef5OzZszQ2NtLd3T1rGUuTolIIoSC4ddbPBA0MDPDiiy+SzWavuS3Xddm9ezdnz54F4IEHHghERh8hhJaAC8EZ4M4772TDhg0AfP7553R0dHDkyJGyCW0mtNacOHGCHTt28OGHHwIFJ8nPDc4WX1chhBLDw8NJ13WjQb4ZchyH7u7uMqemqqqKlStX0tTURH19PbZtl/kNjuMwPDzM4OAg8Xi8bCVpa2vjiSeeCOz7JT8VJ6XMimQyed5xnOZIJBJ4yPnVV1/xyiuvMDAwcE31a2pq2LZtG+3t7YHK5TgOqVQK0zRTIpVK9eXz+d9WV1dTUVER6I2g0N1OnTrF4cOHOX36NIODgyQSibJoEArvAerq6mhoaGD58uWsXbu26CkGTS6XY3R0FMuyzplCiEvAb0tTVEEihKC1tXXaLPF8U6JrQgLnYHL/faHiG0BK+Q9pGMan8OsygL8iCSGOSOC/S0/+GvB19TzvPVlVVfUPwzAcKMyOCx2lFFprhBA6Go1+LgEMwzgBFP3thYy/+liW9R38GA1KKf+r9OJCxtdRCLEXftrWZg4PD48ppUJz5Q/8HPDXfyGEJ6WMxWKxlAQQQriWZe0ByGQyzJVPcD3RWpPJZACwbXtvLBZLQcmGCa21TCaTSdd1I5ZlBZ56ut6MjIyQz+cxDCOXz+frm5ubx6D8AwnPsqz1Ukrl+8oLoSdorYvKCyG0ZVn/4isPE1Ji1dXVx23bfkRK6TmOQzKZnFU8f73J5XLFjzKFENq27f+IRCIflZaZNBs8NjZ2Wy6X+1+lVBUUUtH+xsmf+1flSilyuRy5XK40lZ4LhUL3VldXfzix/JTpcK21PTo6usdxnD94nlcMyYQQmKaJaZoYhnHZttnJts/Olsm2zZZun1VKoZTCdd2yYSul9EKh0Lvj4+NbFy1alJ6s7RklvHTpUnVlZeWfPM97yHGcm2axE/yqyl9rhkoIoQ3DOGsYxj6tdddMu8mvWplMJnOHUur3nuf9s9b6Bq11DIhorW2ttaG1lkF+eFWKEEILIbwf85h5IcSolDIBnDcM40vDMN6vqKj4pGTb/Yz8Pz1sIkCR3nMsAAAAAElFTkSuQmCC";
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/claw-local-session-validation.ts
/** 缓存会话已不可访问：只认明确 404。探测失败（incomplete lookup / sqlite busy）不是丢失（#94620）。 */
function isMissingLocalClawSessionError(error) {
	return isColleagueChatNotFoundError(error);
}
async function validateLocalClawSession(getConversation, conversationId) {
	try {
		return await getConversation(conversationId) ? "valid" : "not-found";
	} catch (error) {
		return isMissingLocalClawSessionError(error) ? "not-found" : "unknown";
	}
}
var init_claw_local_session_validation = __esmMin((() => {
	init_chat_error();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/claw-local-tab.tsx
function isExplicitNewConversation(state) {
	return Boolean(state && typeof state === "object" && state[CLAW_NEW_CONVERSATION_ROUTE_STATE_KEY] === true);
}
function readConversationCwd(item) {
	if (!item || typeof item !== "object") return;
	const record = item;
	const candidates = [
		record.space?.cwd,
		record.cwd,
		record.info?.space?.cwd,
		record.info?.cwd
	];
	for (const value of candidates) if (typeof value === "string" && value) return value;
}
function readConversationId(item) {
	if (!item || typeof item !== "object") return;
	const record = item;
	if (typeof record.id === "string" && record.id) return record.id;
	if (typeof record.info?.id === "string" && record.info.id) return record.info.id;
}
/** Engine 首发不会走 MainContentCore 的 claw-session-ready，缓存缺失时回落最近 Claw 会话。 */
async function findLatestClawLocalSessionId() {
	try {
		const listed = await getWb().conversations.list({
			transport: "local",
			page: 1,
			size: 40
		});
		const items = Array.isArray(listed?.items) ? listed.items : [];
		for (const item of items) {
			const id = readConversationId(item);
			const cwd = readConversationCwd(item);
			const transport = item && typeof item === "object" ? item.transport : void 0;
			if (id && transport === "local" && isClawWorkspaceCwd(cwd)) return id;
		}
	} catch {}
}
function ClawLocalTopbar({ hasConversation, onCreateConversation }) {
	const t = useTranslation();
	const chrome = useClawWorkspaceChrome();
	const topbarRootClassName = useTopBarRootClassName();
	const { isDesktopMac, sidebarCollapsed, isFullscreen } = useDesktopWindowState();
	const showSidebarExpandInContent = !chrome?.showAssistantSwitcher || !chrome.pinned;
	const needsTitleOffset = showSidebarExpandInContent && isDesktopMac && sidebarCollapsed && !isFullscreen;
	const createConversationLabel = t("conversation.newTask");
	const sharedProps = {
		rootClassName: topbarRootClassName,
		workspaceClassName: needsTitleOffset ? "workbuddy-topbar-title--mac-offset" : void 0,
		workspaceSlot: /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)(import_jsx_runtime$5.Fragment, { children: [sidebarCollapsed && /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)(import_jsx_runtime$5.Fragment, { children: [showSidebarExpandInContent && /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(SidebarExpandButton, {}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(Tooltip, {
			content: createConversationLabel,
			placement: "bottom",
			children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(Button, {
				variant: "ghost",
				size: "medium",
				iconOnly: true,
				"aria-label": createConversationLabel,
				"data-track-id": "agent_new_task_button_clicked",
				"data-track-name": "新建任务-加号",
				"data-track-props": "{\"type\":\"plus_icon\"}",
				onClick: onCreateConversation,
				leftIcon: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(NewTaskIcon, {})
			})
		})] }), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(ClawWorkspaceTitle, {})] }),
		titleSlot: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(ClawChannels, {})
	};
	return hasConversation ? /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(ConversationRouteHeader, { ...sharedProps }) : /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(ConversationTopbarFrame, { ...sharedProps });
}
/**
* 本地助理 tab：新引擎的路由恢复、挂载和宿主上报都只在本 tab 激活时运行。
*
* 注意：透传 mainContentProps 时不要在这里显式补一个 projectPublicConnectorConfigs。
* MainContentCore 内部已经用模块级稳定空数组作为默认参数（避免行内 `= []`
* 每 render 新建引用触发的死循环，见 main-content-core.tsx 中
* EMPTY_PROJECT_PUBLIC_CONNECTOR_CONFIGS 注释）。调用方如果自己有实际配置，
* 会通过 `...mainContentProps` 传下来并覆盖默认值。
*/
function ClawLocalTab({ mainContentProps, isActive, onActiveConversationChange }) {
	const location = useLocation();
	const navigate = useNavigate();
	const engineEnabled = useConversationEngineFeature() !== false;
	const openIntent = readClawOpenIntent(location.search, location.state);
	const localSessionIntent = openIntent.kind === "local-session" ? openIntent : void 0;
	const startIntentToken = localSessionIntent?.startIntentToken;
	const explicitNewConversation = isExplicitNewConversation(location.state);
	const localSessionId = isActive ? localSessionIntent?.sessionId : void 0;
	const requestSeqRef = (0, import_react$9.useRef)(0);
	const [clawInputCwd, setClawInputCwd] = (0, import_react$9.useState)();
	const handleStartIntentClaimed = (0, import_react$9.useCallback)(() => {
		if (localSessionId) navigate(buildClawLocalSessionPath(localSessionId), { replace: true });
	}, [localSessionId, navigate]);
	const handleCreateConversation = (0, import_react$9.useCallback)(() => {
		navigate(buildClawLocalSessionPath(), { state: { [CLAW_NEW_CONVERSATION_ROUTE_STATE_KEY]: true } });
	}, [navigate]);
	const leaveToEmptyClawLocalSession = (0, import_react$9.useCallback)(() => {
		const latest = readActiveClawConversationId();
		if (latest && localSessionId && latest !== localSessionId) {
			navigate(buildClawLocalSessionPath(latest), { replace: true });
			return;
		}
		saveActiveClawConversationId("");
		onActiveConversationChange?.(null);
		navigate(buildClawLocalSessionPath(), {
			replace: true,
			state: { [CLAW_NEW_CONVERSATION_ROUTE_STATE_KEY]: true }
		});
	}, [
		localSessionId,
		navigate,
		onActiveConversationChange
	]);
	(0, import_react$9.useEffect)(() => {
		if (!isActive || !localSessionId) return;
		return wb.conversations.onConversationChanged("deleted", (deletedConversation) => {
			if (deletedConversation.id !== localSessionId) return;
			leaveToEmptyClawLocalSession();
		});
	}, [
		isActive,
		leaveToEmptyClawLocalSession,
		localSessionId
	]);
	(0, import_react$9.useEffect)(() => {
		if (!isActive || !engineEnabled) return;
		if (openIntent.kind !== "default" && openIntent.kind !== "local-session") return;
		let cancelled = false;
		const redirectToEmpty = (sessionId) => {
			const latest = readActiveClawConversationId();
			if (latest && latest !== sessionId) {
				navigate(buildClawLocalSessionPath(latest), { replace: true });
				return;
			}
			clearActiveClawConversationId(sessionId);
			navigate(buildClawLocalSessionPath(), { replace: true });
		};
		const ensureConversationExists = async (sessionId) => {
			if (!isAppCoreReady()) return null;
			const status = await validateLocalClawSession((id) => getWb().conversations.get(id), sessionId);
			if (status === "valid") return true;
			if (status === "not-found") return false;
			return null;
		};
		const waitUntilAppCoreReady = async () => {
			for (let i = 0; i < 40; i++) {
				if (cancelled) return false;
				if (isAppCoreReady()) return true;
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
			return isAppCoreReady();
		};
		const routeLocalSessionId = localSessionIntent?.sessionId;
		if (routeLocalSessionId) {
			(async () => {
				if (!await waitUntilAppCoreReady() || cancelled) return;
				const exists = await ensureConversationExists(routeLocalSessionId);
				if (cancelled || exists === null) return;
				if (!exists) {
					redirectToEmpty(routeLocalSessionId);
					return;
				}
				persistLocalAssistantAnchorIfCurrent(routeLocalSessionId);
			})().catch(() => void 0);
			return () => {
				cancelled = true;
			};
		}
		if (explicitNewConversation) return;
		(async () => {
			if (!await waitUntilAppCoreReady() || cancelled) return;
			let sessionId = readActiveClawConversationId();
			if (sessionId) {
				const exists = await ensureConversationExists(sessionId);
				if (cancelled) return;
				if (exists === false) {
					clearActiveClawConversationId(sessionId);
					sessionId = "";
				} else if (exists === null) return;
			}
			if (!sessionId) {
				sessionId = await findLatestClawLocalSessionId() || "";
				if (cancelled) return;
				if (sessionId) persistLocalAssistantAnchorIfCurrent(sessionId);
			}
			if (!sessionId || cancelled) return;
			navigate(buildClawLocalSessionPath(sessionId), { replace: true });
		})().catch(() => void 0);
		return () => {
			cancelled = true;
		};
	}, [
		engineEnabled,
		explicitNewConversation,
		isActive,
		localSessionIntent?.sessionId,
		navigate,
		openIntent.kind
	]);
	(0, import_react$9.useEffect)(() => {
		if (isActive && engineEnabled && localSessionId) persistLocalAssistantAnchorIfCurrent(localSessionId);
	}, [
		engineEnabled,
		isActive,
		localSessionId
	]);
	const onActiveConversationChangeRef = (0, import_react$9.useRef)(onActiveConversationChange);
	onActiveConversationChangeRef.current = onActiveConversationChange;
	(0, import_react$9.useEffect)(() => {
		onActiveConversationChangeRef.current?.(isActive && engineEnabled && localSessionId ? localSessionId : null);
	}, [
		engineEnabled,
		isActive,
		localSessionId
	]);
	(0, import_react$9.useEffect)(() => () => {
		onActiveConversationChangeRef.current?.(null);
	}, []);
	(0, import_react$9.useEffect)(() => {
		if (!isActive || !engineEnabled || localSessionId || !mainContentProps.adapter?.getClawCwd) return;
		let active = true;
		mainContentProps.adapter.getClawCwd().then((cwd) => {
			if (active) setClawInputCwd(cwd || void 0);
		}).catch(() => void 0);
		return () => {
			active = false;
		};
	}, [
		engineEnabled,
		isActive,
		localSessionId,
		mainContentProps.adapter
	]);
	(0, import_react$9.useEffect)(() => {
		if (!isActive || !engineEnabled || !localSessionId) return;
		const seq = ++requestSeqRef.current;
		let cancelled = false;
		validateLocalClawSession((id) => wb.conversations.get(id), localSessionId).then((status) => {
			if (cancelled || seq !== requestSeqRef.current) return;
			if (status === "not-found") leaveToEmptyClawLocalSession();
		}).catch(() => void 0);
		return () => {
			cancelled = true;
			requestSeqRef.current += 1;
		};
	}, [
		engineEnabled,
		isActive,
		leaveToEmptyClawLocalSession,
		localSessionId
	]);
	if (!engineEnabled) return /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(MainContentCore, {
		...mainContentProps,
		suppressCloudAssistantUpgradeBanner: true
	});
	if (!isActive) return /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(import_jsx_runtime$5.Fragment, {});
	if (localSessionId) return /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(ConversationEngineView, {
		conversationId: localSessionId,
		scenarioId: CLAW_LOCAL_SCENARIO_ID,
		startIntentToken,
		onStartIntentClaimed: handleStartIntentClaimed,
		header: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(ClawLocalTopbar, {
			hasConversation: true,
			onCreateConversation: handleCreateConversation
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime$5.jsxs)("div", {
		style: {
			height: "100%",
			minHeight: 0,
			display: "flex",
			flexDirection: "column"
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(ClawLocalTopbar, {
			hasConversation: false,
			onCreateConversation: handleCreateConversation
		}), /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)("div", {
			style: {
				flex: 1,
				minHeight: 0
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime$5.jsx)(ClawLocalEmptyView, { inputCwd: clawInputCwd })
		})]
	});
}
var import_react$9, import_jsx_runtime$5, CLAW_NEW_CONVERSATION_ROUTE_STATE_KEY;
var init_claw_local_tab = __esmMin((() => {
	init_src();
	import_react$9 = /* @__PURE__ */ __toESM(require_react());
	init_app_core();
	init_product_features();
	init_useI18n();
	init_claw$1();
	init_conversation();
	init_router();
	init_claw_session_filter();
	init_main_content_core();
	init_workbuddy_topbar();
	init_claw_channels();
	init_context();
	init_workspace_title();
	init_claw_local_session_validation();
	import_jsx_runtime$5 = require_jsx_runtime();
	CLAW_NEW_CONVERSATION_ROUTE_STATE_KEY = "createNewClawConversation";
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/use-lazy-activate.ts
/** tab 首次激活后保持挂载，避免切走后重建对话区和沙箱连接。 */
function useLazyActivate(isActive) {
	const [hasActivated, setHasActivated] = (0, import_react$8.useState)(isActive);
	(0, import_react$8.useEffect)(() => {
		if (isActive) setHasActivated(true);
	}, [isActive]);
	return hasActivated || isActive;
}
var import_react$8;
var init_use_lazy_activate = __esmMin((() => {
	import_react$8 = /* @__PURE__ */ __toESM(require_react());
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/lazy-agent-chat-pane.tsx
/** 首次激活后才加载真实对话区 chunk，避免 /claw 首屏加载同事对话重依赖。 */
function LazyMountedAgentChatPane(props) {
	const t = useTranslation();
	if (!useLazyActivate(props.isActive)) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(import_react$7.Suspense, {
		fallback: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(EmptyTabPane, {
			label: props.fallbackLabel,
			hint: t("claw.workspace.list.loading")
		}),
		children: /* @__PURE__ */ (0, import_jsx_runtime$4.jsx)(LazyAgentChatPane, {
			agent: props.agent,
			kind: props.kind,
			isActive: props.isActive,
			specialists: props.specialists,
			avatar: props.avatar,
			avatarVariant: props.avatarVariant,
			openTarget: props.openTarget,
			onChatTargetReady: props.onChatTargetReady,
			onSessionDeleted: props.onSessionDeleted,
			showModelSelector: props.showModelSelector
		})
	});
}
var import_react$7, import_jsx_runtime$4, LazyAgentChatPane;
var init_lazy_agent_chat_pane = __esmMin((() => {
	import_react$7 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	init_empty_tab_pane();
	init_use_lazy_activate();
	import_jsx_runtime$4 = require_jsx_runtime();
	init_preload_helper();
	LazyAgentChatPane = import_react$7.lazy(() => __vitePreload(() => import("./agent-chat-pane-B_MWF8Xa.js").then((module) => ({ default: module.AgentChatPane })), __vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26]), import.meta.url));
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/build-tabs.tsx
function getAgentKey(prefix, agent) {
	return `${prefix}-${agent.agentId || agent.id}`;
}
function asRecord(value) {
	return value && typeof value === "object" ? value : {};
}
function firstNonEmptyString(...values) {
	for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
}
function getAgentNickname(agent) {
	return firstNonEmptyString(agent.nickname, agent.nickName, agent.displayName, agent.agentName);
}
function getAgentLabel(agent, fallback) {
	return getAgentNickname(agent) || agent.agentId || agent.id || fallback;
}
function getAgentProfessionalTitle(agent) {
	const manifest = agent?.currentVersion?.manifest;
	const title = asRecord(asRecord(manifest).annotations)[AGENT_TITLE_ANNOTATION_KEY];
	return typeof title === "string" && title.trim() ? title.trim() : void 0;
}
function buildClawTabs(options) {
	const { labels, orchestrator, specialists, mentionSpecialists, trialContent, onActiveLocalConversationChange } = options;
	const tabs = [{
		key: CLAW_LOCAL_TAB_KEY,
		kind: "local",
		label: labels.local,
		avatarUrl: claw_local_assistant_avatar_default,
		renderContent: ({ mainContentProps, isActive }) => /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(ClawLocalTab, {
			mainContentProps,
			isActive,
			onActiveConversationChange: onActiveLocalConversationChange
		})
	}];
	if (trialContent) tabs.push({
		key: CLAW_CLOUD_TRIAL_TAB_KEY,
		kind: "cloud",
		label: labels.cloud,
		avatarUrl: claw_cloud_assistant_avatar_default,
		renderContent: () => trialContent
	});
	if (orchestrator) {
		const tabKey = `cloud-orchestrator-${orchestrator.id}`;
		tabs.push({
			key: tabKey,
			kind: "cloud",
			label: labels.cloud,
			avatarUrl: claw_cloud_assistant_avatar_default,
			subtitle: getAgentProfessionalTitle(orchestrator),
			rawAgent: orchestrator,
			renderContent: ({ isActive, assistantOpenTarget, onAssistantChatTargetReady, onAssistantSessionDeleted }) => /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(LazyMountedAgentChatPane, {
				agent: orchestrator,
				kind: "cloud",
				isActive,
				fallbackLabel: labels.cloud,
				specialists: mentionSpecialists ?? specialists,
				avatar: claw_cloud_assistant_avatar_default,
				avatarVariant: 1,
				openTarget: assistantOpenTarget,
				onChatTargetReady: (payload) => onAssistantChatTargetReady?.({
					...payload,
					tabKey
				}),
				onSessionDeleted: (payload) => onAssistantSessionDeleted?.({
					...payload,
					tabKey
				})
			})
		});
	}
	specialists.forEach((agent, index) => {
		const label = getAgentLabel(agent, labels.normalFallback);
		const tabKey = getAgentKey("specialist", agent);
		tabs.push({
			key: tabKey,
			kind: "normal",
			label,
			avatarUrl: agent.avatar,
			avatarNode: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(AssistantIcon, { size: 18 }),
			subtitle: getAgentProfessionalTitle(agent),
			showChevron: false,
			rawAgent: agent,
			renderContent: ({ isActive, assistantOpenTarget, onAssistantChatTargetReady, onAssistantSessionDeleted }) => /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(LazyMountedAgentChatPane, {
				agent,
				kind: "normal",
				isActive,
				fallbackLabel: label,
				avatarVariant: index + 2,
				openTarget: assistantOpenTarget,
				onChatTargetReady: (payload) => onAssistantChatTargetReady?.({
					...payload,
					tabKey
				}),
				onSessionDeleted: (payload) => onAssistantSessionDeleted?.({
					...payload,
					tabKey
				})
			})
		});
	});
	return tabs;
}
function buildEnterpriseAgentTabs(options) {
	const { agents, fallbackLabel } = options;
	return agents.map((agent, index) => {
		const label = getAgentLabel(agent, fallbackLabel);
		const tabKey = getAgentKey("enterprise", agent);
		return {
			key: tabKey,
			kind: "enterprise",
			label,
			avatarUrl: agent.avatar,
			avatarNode: /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(AssistantIcon, { size: 18 }),
			subtitle: getEnterpriseAgentTitle(agent) ?? getAgentProfessionalTitle(agent),
			showChevron: false,
			rawAgent: agent,
			renderContent: ({ isActive, assistantOpenTarget, onAssistantChatTargetReady, onAssistantSessionDeleted }) => /* @__PURE__ */ (0, import_jsx_runtime$3.jsx)(LazyMountedAgentChatPane, {
				agent,
				kind: "enterprise",
				isActive,
				fallbackLabel: label,
				avatar: agent.avatar,
				avatarVariant: index + 2,
				openTarget: assistantOpenTarget,
				showModelSelector: false,
				onChatTargetReady: (payload) => onAssistantChatTargetReady?.({
					...payload,
					tabKey
				}),
				onSessionDeleted: (payload) => onAssistantSessionDeleted?.({
					...payload,
					tabKey
				})
			})
		};
	});
}
var import_jsx_runtime$3, AGENT_TITLE_ANNOTATION_KEY;
var init_build_tabs = __esmMin((() => {
	init_src();
	require_react();
	init_claw_cloud_assistant_avatar();
	init_claw_local_assistant_avatar();
	init_claw_local_tab();
	init_enterprise_annotations();
	init_lazy_agent_chat_pane();
	init_tab_registry();
	import_jsx_runtime$3 = require_jsx_runtime();
	AGENT_TITLE_ANNOTATION_KEY = "agent-title";
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/claw-list-state.ts
function startClawListLoad(state) {
	return {
		...state,
		status: "loading",
		error: null,
		hasLoaded: false
	};
}
function succeedClawListLoad(state) {
	return {
		...state,
		status: "success",
		error: null,
		hasLoaded: true,
		hasSuccessfulSnapshot: true
	};
}
function failClawListLoad(state, error) {
	return {
		...state,
		status: "error",
		error,
		hasLoaded: true
	};
}
function skipClawListLoad() {
	return {
		status: "idle",
		error: null,
		hasLoaded: true,
		hasSuccessfulSnapshot: false
	};
}
var createClawListLoadState;
var init_claw_list_state = __esmMin((() => {
	createClawListLoadState = (status = "idle") => ({
		status,
		error: null,
		hasLoaded: status === "success" || status === "error",
		hasSuccessfulSnapshot: false
	});
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/tabs/use-claw-tabs.ts
/**
* 仅开发环境读取助理列表故障模拟开关：
* - `orchestrator` / `specialist` / `both`：每次刷新都失败
* - `once:orchestrator` / `once:specialist` / `once:both`：仅本次刷新失败，重试成功
*/
function readClawListFailureSimulation() {
	return {
		orchestrator: false,
		specialist: false
	};
}
/** 与 @ 助理入口保持一致：不可用的 specialist 不进入 Claw 助理列表。 */
function filterVisibleSpecialists(items) {
	return (items ?? []).filter((agent) => agent.enabled !== false);
}
/**
* 企业 Agent 下发列表合并（issue #56271 §5）。
* market 为服务端裁决后的权威可用集合（决定"哪些可见 + enforceMode"），
* published 仅用于补齐 avatar / manifest / model 等渲染富数据。
* 以 market 为准遍历，published 命中则增强，未命中则用 market 精简项兜底。
*/
function mergeEnterpriseAgents(marketItems, publishedItems) {
	const byKey = /* @__PURE__ */ new Map();
	for (const item of publishedItems ?? []) {
		if (item.id) byKey.set(item.id, item);
		if (item.agentId) byKey.set(item.agentId, item);
	}
	return (marketItems ?? []).map((market) => {
		return {
			...byKey.get(market.id) ?? (market.agentId ? byKey.get(market.agentId) : void 0) ?? {
				id: market.id,
				agentId: market.agentId,
				agentName: market.displayName,
				avatar: market.icon
			},
			enforceMode: market.enforceMode ?? ""
		};
	});
}
function isTargetAgent(agent, targetId) {
	return agent.id === targetId || agent.agentId === targetId;
}
function movePinnedAgentForOptimisticUpdate(agents, targetId, pinned) {
	const next = agents.map((agent) => isTargetAgent(agent, targetId) ? {
		...agent,
		pinned
	} : agent);
	const target = next.find((agent) => isTargetAgent(agent, targetId));
	if (!target) return next;
	const rest = next.filter((agent) => !isTargetAgent(agent, targetId));
	if (pinned) return [target, ...rest];
	const firstUnpinnedIndex = rest.findIndex((agent) => !agent.pinned);
	if (firstUnpinnedIndex < 0) return [...rest, target];
	return [
		...rest.slice(0, firstUnpinnedIndex),
		target,
		...rest.slice(firstUnpinnedIndex)
	];
}
/** 拉取助理 tab 数据：直接复用 adapter 数据源，不 import colleagues-panel 组件入口。 */
function useClawTabs({ enabled, installed, isEnterpriseUser, trialContent, onActiveLocalConversationChange }) {
	const adapter = useAdapter();
	const t = useTranslation();
	const [orchestrator, setOrchestrator] = (0, import_react$5.useState)(null);
	const [specialists, setSpecialists] = (0, import_react$5.useState)([]);
	const [pinningTarget, setPinningTarget] = (0, import_react$5.useState)(null);
	const [enterpriseAgents, setEnterpriseAgents] = (0, import_react$5.useState)([]);
	const [cloudAssistantState, setCloudAssistantState] = (0, import_react$5.useState)(() => createClawListLoadState());
	const [assistantState, setAssistantState] = (0, import_react$5.useState)(() => createClawListLoadState());
	const [enterpriseAgentState, setEnterpriseAgentState] = (0, import_react$5.useState)(() => createClawListLoadState());
	const requestIdsRef = (0, import_react$5.useRef)({
		cloudAssistant: 0,
		assistant: 0,
		enterpriseAgent: 0
	});
	const updateGroupState = (0, import_react$5.useCallback)((group, updater) => {
		switch (group) {
			case "cloudAssistant":
				setCloudAssistantState((prev) => updater(prev));
				break;
			case "assistant":
				setAssistantState((prev) => updater(prev));
				break;
			case "enterpriseAgent":
				setEnterpriseAgentState((prev) => updater(prev));
				break;
		}
	}, []);
	const refreshPersonalGroup = (0, import_react$5.useCallback)(async (group, failureSimulation = readClawListFailureSimulation()) => {
		const requestId = ++requestIdsRef.current[group];
		const listGrantedCloudAgents = adapter?.listGrantedCloudAgents?.bind(adapter);
		if (!(enabled && installed && Boolean(listGrantedCloudAgents))) {
			updateGroupState(group, () => skipClawListLoad());
			if (group === "cloudAssistant") setOrchestrator(null);
			else setSpecialists([]);
			return;
		}
		updateGroupState(group, startClawListLoad);
		const request = () => group === "cloudAssistant" ? failureSimulation.orchestrator ? Promise.reject(/* @__PURE__ */ new Error("simulated orchestrator list failure")) : listGrantedCloudAgents({
			page: 1,
			pageSize: 1,
			agentRole: "orchestrator",
			withInstances: false,
			withManifest: true
		}) : failureSimulation.specialist ? Promise.reject(/* @__PURE__ */ new Error("simulated specialist list failure")) : listGrantedCloudAgents({
			page: 1,
			pageSize: 100,
			agentRole: "specialist",
			withInstances: false,
			withManifest: true
		});
		const result = await Promise.allSettled([Promise.resolve().then(request)]);
		if (requestId !== requestIdsRef.current[group]) return;
		const settled = result[0];
		if (settled.status === "fulfilled") {
			if (group === "cloudAssistant") {
				const nextOrchestrator = settled.value.items?.[0];
				if (!nextOrchestrator) {
					updateGroupState(group, (state) => failClawListLoad(state, t("claw.workspace.list.cloudAssistantLoadFailed")));
					return;
				}
				setOrchestrator(nextOrchestrator);
			} else setSpecialists(filterVisibleSpecialists(settled.value.items));
			updateGroupState(group, succeedClawListLoad);
		} else {
			const errorKey = group === "cloudAssistant" ? "claw.workspace.list.cloudAssistantLoadFailed" : "claw.workspace.list.loadFailed";
			updateGroupState(group, (state) => failClawListLoad(state, t(errorKey)));
		}
	}, [
		adapter,
		enabled,
		installed,
		t,
		updateGroupState
	]);
	const refreshEnterpriseAgents = (0, import_react$5.useCallback)(async () => {
		const requestId = ++requestIdsRef.current.enterpriseAgent;
		if (!isEnterpriseUser || !adapter?.getEnterpriseAgentMarket) {
			setEnterpriseAgents([]);
			updateGroupState("enterpriseAgent", () => skipClawListLoad());
			return;
		}
		const getMarket = adapter.getEnterpriseAgentMarket.bind(adapter);
		const listPublished = adapter.listEnterprisePublishedCloudAgents?.bind(adapter);
		updateGroupState("enterpriseAgent", startClawListLoad);
		try {
			const marketRes = await getMarket();
			if (requestId !== requestIdsRef.current.enterpriseAgent) return;
			let publishedItems = [];
			if (listPublished) try {
				publishedItems = (await listPublished({
					page: 1,
					pageSize: 100
				})).items ?? [];
			} catch {
				publishedItems = [];
			}
			if (requestId !== requestIdsRef.current.enterpriseAgent) return;
			setEnterpriseAgents(mergeEnterpriseAgents(marketRes.items, publishedItems));
			updateGroupState("enterpriseAgent", succeedClawListLoad);
		} catch {
			if (requestId === requestIdsRef.current.enterpriseAgent) updateGroupState("enterpriseAgent", (state) => failClawListLoad(state, t("claw.workspace.list.enterpriseAgentLoadFailed")));
		}
	}, [
		adapter,
		isEnterpriseUser,
		t,
		updateGroupState
	]);
	const refresh = (0, import_react$5.useCallback)(async () => {
		const failureSimulation = readClawListFailureSimulation();
		await Promise.all([refreshPersonalGroup("cloudAssistant", failureSimulation), refreshPersonalGroup("assistant", failureSimulation)]);
	}, [refreshPersonalGroup]);
	const retryGroup = (0, import_react$5.useCallback)(async (group) => {
		if (group === "enterpriseAgent") {
			await refreshEnterpriseAgents();
			return;
		}
		await refreshPersonalGroup(group, readClawListFailureSimulation());
	}, [refreshEnterpriseAgents, refreshPersonalGroup]);
	const toggleSpecialistPin = (0, import_react$5.useCallback)(async (agent) => {
		const targetId = agent.id;
		const nextPinned = !agent.pinned;
		const togglePin = nextPinned ? adapter?.pinCloudAgent : adapter?.unpinCloudAgent;
		if (!targetId || !togglePin || pinningTarget) return;
		const previousSpecialists = specialists;
		setPinningTarget({
			kind: "normal",
			id: targetId
		});
		setSpecialists((prev) => movePinnedAgentForOptimisticUpdate(prev, targetId, nextPinned));
		try {
			await togglePin.call(adapter, { agentId: targetId });
			try {
				const res = await adapter?.listGrantedCloudAgents?.({
					page: 1,
					pageSize: 100,
					agentRole: "specialist",
					withInstances: false,
					withManifest: true
				});
				if (res?.items) {
					setSpecialists(filterVisibleSpecialists(res.items));
					updateGroupState("assistant", succeedClawListLoad);
				}
			} catch {}
		} catch (err) {
			setSpecialists(previousSpecialists);
			throw err;
		} finally {
			setPinningTarget(null);
		}
	}, [
		adapter,
		pinningTarget,
		specialists,
		updateGroupState
	]);
	const toggleEnterpriseAgentPin = (0, import_react$5.useCallback)(async (agent) => {
		const targetId = agent.id;
		const nextPinned = !agent.pinned;
		const togglePin = nextPinned ? adapter?.pinCloudAgent : adapter?.unpinCloudAgent;
		if (!targetId || !togglePin || pinningTarget) return;
		const previousEnterpriseAgents = enterpriseAgents;
		setPinningTarget({
			kind: "enterprise",
			id: targetId
		});
		setEnterpriseAgents((prev) => movePinnedAgentForOptimisticUpdate(prev, targetId, nextPinned));
		try {
			await togglePin.call(adapter, { agentId: targetId });
			try {
				const res = await adapter?.listEnterprisePublishedCloudAgents?.({
					page: 1,
					pageSize: 100
				});
				if (res?.items) {
					setEnterpriseAgents(filterVisibleSpecialists(res.items));
					updateGroupState("enterpriseAgent", succeedClawListLoad);
				}
			} catch {}
		} catch (err) {
			setEnterpriseAgents(previousEnterpriseAgents);
			throw err;
		} finally {
			setPinningTarget(null);
		}
	}, [
		adapter,
		enterpriseAgents,
		pinningTarget,
		updateGroupState
	]);
	(0, import_react$5.useEffect)(() => {
		refresh();
	}, [refresh]);
	(0, import_react$5.useEffect)(() => {
		refreshEnterpriseAgents().catch(() => void 0);
	}, [refreshEnterpriseAgents]);
	const refreshEnterpriseRef = (0, import_react$5.useRef)(refreshEnterpriseAgents);
	(0, import_react$5.useEffect)(() => {
		refreshEnterpriseRef.current = refreshEnterpriseAgents;
	}, [refreshEnterpriseAgents]);
	(0, import_react$5.useEffect)(() => {
		if (!isEnterpriseUser) return;
		const timer = setInterval(() => {
			refreshEnterpriseRef.current().catch(() => void 0);
		}, ENTERPRISE_AGENT_SYNC_INTERVAL_MS);
		return () => clearInterval(timer);
	}, [isEnterpriseUser]);
	const refreshRef = (0, import_react$5.useRef)(refresh);
	(0, import_react$5.useEffect)(() => {
		refreshRef.current = refresh;
	}, [refresh]);
	(0, import_react$5.useEffect)(() => {
		const sub = colleagueAgentListChanged$.subscribe(() => {
			refreshRef.current().catch(() => void 0);
		});
		return () => sub.unsubscribe();
	}, []);
	const labels = (0, import_react$5.useMemo)(() => ({
		local: t("claw.workspace.tabs.local"),
		cloud: t("claw.workspace.tabs.cloud"),
		normalFallback: t("claw.workspace.tabs.groupNormal"),
		enterpriseFallback: t("claw.workspace.tabs.groupEnterprise")
	}), [t]);
	const mentionSpecialists = (0, import_react$5.useMemo)(() => [...specialists, ...enterpriseAgents.slice(0, 10)], [specialists, enterpriseAgents]);
	const visibleOrchestrator = installed ? orchestrator : null;
	const visibleSpecialists = installed ? specialists : EMPTY_AGENTS;
	const visibleMentionSpecialists = installed ? mentionSpecialists : EMPTY_AGENTS;
	const visibleEnterpriseAgents = enterpriseAgents;
	return {
		tabs: (0, import_react$5.useMemo)(() => buildClawTabs({
			labels,
			orchestrator: visibleOrchestrator,
			specialists: visibleSpecialists,
			mentionSpecialists: visibleMentionSpecialists,
			trialContent: enabled && !installed ? trialContent : void 0,
			onActiveLocalConversationChange
		}), [
			enabled,
			installed,
			labels,
			onActiveLocalConversationChange,
			trialContent,
			visibleMentionSpecialists,
			visibleOrchestrator,
			visibleSpecialists
		]),
		enterpriseTabs: (0, import_react$5.useMemo)(() => buildEnterpriseAgentTabs({
			agents: visibleEnterpriseAgents,
			fallbackLabel: labels.enterpriseFallback
		}), [labels.enterpriseFallback, visibleEnterpriseAgents]),
		cloudAssistantState,
		assistantState,
		enterpriseAgentState,
		canCreateAssistant: enabled && installed,
		pinningTarget,
		refresh,
		retryGroup,
		toggleSpecialistPin,
		toggleEnterpriseAgentPin
	};
}
var import_react$5, EMPTY_AGENTS, ENTERPRISE_AGENT_SYNC_INTERVAL_MS;
var init_use_claw_tabs = __esmMin((() => {
	import_react$5 = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_useI18n();
	init_colleague_navigation_bus();
	init_build_tabs();
	init_claw_list_state();
	EMPTY_AGENTS = [];
	ENTERPRISE_AGENT_SYNC_INTERVAL_MS = 300 * 1e3;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/trial-experience/claw-trial-experience-page.less
var init_claw_trial_experience_page$1 = __esmMin((() => {}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/assets/claw-trial-team-visual.png
var claw_trial_team_visual_default;
var init_claw_trial_team_visual = __esmMin((() => {
	claw_trial_team_visual_default = "" + new URL("claw-trial-team-visual-CrBEkpgF.png", import.meta.url).href;
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/trial-experience/claw-trial-experience-page.tsx
/** 云助理未初始化时的限时体验页：只负责新视觉展示，创建动作由 ClawWorkspace 注入。 */
function ClawTrialExperiencePage({ loading, error, onStartTrial }) {
	const t = useTranslation();
	return /* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("section", {
		className: "claw-trial-experience-page",
		"aria-labelledby": "claw-trial-experience-title",
		children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
			className: "claw-trial-experience-page__content",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
					className: "claw-trial-experience-page__team-visual",
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("img", {
						src: claw_trial_team_visual_default,
						alt: "",
						draggable: false
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("div", {
					className: "claw-trial-experience-page__copy",
					children: [/* @__PURE__ */ (0, import_jsx_runtime$2.jsxs)("h2", {
						id: "claw-trial-experience-title",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("span", { children: t("cloudAssistantUpgrade.trial.titleLead") }),
							/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("em", { children: t("cloudAssistantUpgrade.trial.titleHighlight") }),
							/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("span", { children: t("cloudAssistantUpgrade.trial.titleTail") })
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("p", { children: t("cloudAssistantUpgrade.trial.subtitle") })]
				}),
				error && /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
					className: "claw-trial-experience-page__error",
					role: "alert",
					children: error
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
					className: "claw-trial-experience-page__action",
					children: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Button, {
						type: "button",
						variant: "primary",
						size: "medium",
						disabled: loading,
						"aria-busy": loading || void 0,
						className: "claw-trial-experience-page__button",
						onClick: onStartTrial,
						children: loading ? t("cloudAssistantUpgrade.openTeamLoading") : t("cloudAssistantUpgrade.banner.action")
					})
				})
			]
		}), loading && /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)("div", {
			className: "claw-trial-experience-page__loading",
			"aria-live": "polite",
			children: /* @__PURE__ */ (0, import_jsx_runtime$2.jsx)(Loading, {
				size: "large",
				tip: t("cloudAssistantUpgrade.openTeamLoading")
			})
		})]
	});
}
var import_jsx_runtime$2;
var init_claw_trial_experience_page = __esmMin((() => {
	init_claw_trial_experience_page$1();
	init_src();
	require_react();
	init_useI18n();
	init_claw_trial_team_visual();
	import_jsx_runtime$2 = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/trial-experience/index.ts
var init_trial_experience = __esmMin((() => {
	init_claw_trial_experience_page();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/use-assistant-quota-gate.ts
/** `/claw` 创建入口配额拦截编排：入口点击、提交前校验、升级跳转共用一套状态。 */
function useAssistantQuotaGate({ adapter, t }) {
	const cloudAgentQuota = useCloudAgentQuota();
	const [quotaLimitSnapshot, setQuotaLimitSnapshot] = import_react$3.useState(null);
	const [isQuotaLimitOpen, setIsQuotaLimitOpen] = import_react$3.useState(false);
	const handleQuotaExceeded = import_react$3.useCallback((quota) => {
		setQuotaLimitSnapshot(quota);
		setIsQuotaLimitOpen(true);
	}, []);
	const checkQuotaBeforeCreate = import_react$3.useCallback(async () => {
		return (await cloudAgentQuota.refresh()).quota;
	}, [cloudAgentQuota]);
	const guardCreateEntry = import_react$3.useCallback(async () => {
		const result = await cloudAgentQuota.refresh();
		if (isAssistantQuotaExceeded(result.quota)) {
			handleQuotaExceeded(result.quota);
			return false;
		}
		if (result.errorReason === "unsupported" || result.errorReason === "unauthorized") {
			message.error(t("colleagues.quotaLimit.unsupported"));
			return false;
		}
		return true;
	}, [
		cloudAgentQuota,
		handleQuotaExceeded,
		t
	]);
	return {
		quotaLimitSnapshot,
		isQuotaLimitOpen,
		closeQuotaLimit: () => setIsQuotaLimitOpen(false),
		handleQuotaExceeded,
		handleOpenPlanUpgrade: import_react$3.useCallback(() => {
			setIsQuotaLimitOpen(false);
			openAssistantPlanUpgrade({
				adapter,
				onSuccess: () => {
					cloudAgentQuota.refresh();
				}
			});
		}, [adapter, cloudAgentQuota]),
		checkQuotaBeforeCreate,
		guardCreateEntry,
		refreshQuota: import_react$3.useCallback(async () => {
			await cloudAgentQuota.refresh();
		}, [cloudAgentQuota])
	};
}
var import_react$3;
var init_use_assistant_quota_gate = __esmMin((() => {
	init_src();
	import_react$3 = /* @__PURE__ */ __toESM(require_react());
	init_assistant_quota_utils();
	init_use_cloud_agent_quota();
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/use-cloud-assistant-entitlement-error-toast.ts
function useCloudAssistantEntitlementErrorToast(error, retry) {
	const t = useTranslation();
	(0, import_react$2.useEffect)(() => {
		if (!error) return;
		toast.error(t("claw.workspace.entitlement.loadFailed"), {
			dedupKey: CLOUD_ASSISTANT_ENTITLEMENT_ERROR_TOAST_KEY,
			duration: 8e3,
			showClose: true,
			action: {
				label: t("common.retry"),
				onClick: retry
			}
		});
	}, [
		error,
		retry,
		t
	]);
}
var import_react$2, CLOUD_ASSISTANT_ENTITLEMENT_ERROR_TOAST_KEY;
var init_use_cloud_assistant_entitlement_error_toast = __esmMin((() => {
	init_src$1();
	import_react$2 = /* @__PURE__ */ __toESM(require_react());
	init_useI18n();
	CLOUD_ASSISTANT_ENTITLEMENT_ERROR_TOAST_KEY = "cloud-assistant-entitlement-error";
}));
//#endregion
//#region ../../packages/agent-ui/src/components/claw-workspace/index.tsx
/** `/claw` 新工作区外壳：左侧助理抽屉 + 右侧保活 tab 内容。 */
function ClawWorkspace({ mainContentProps, onActiveLocalConversationChange }) {
	const t = useTranslation();
	const adapter = useAdapter();
	const agentServices = useAgentServices();
	const accountService = useAccountService();
	const { setActiveCloudAssistantSession } = useConversations();
	const entitlement = useCloudAssistantEntitlement();
	const quotaGate = useAssistantQuotaGate({
		adapter,
		t
	});
	const accountKey = (0, import_react$1.useMemo)(() => {
		const account = accountService.account;
		return account?.uid ? `${account.enterpriseId ?? "default"}:${account.uid}` : "anonymous";
	}, [accountService.account?.enterpriseId, accountService.account?.uid]);
	const isEnterpriseUser = Boolean(accountService.account?.enterpriseId);
	const [deleteTarget, setDeleteTarget] = import_react$1.useState(null);
	const [deleting, setDeleting] = import_react$1.useState(false);
	const [createAssistantDrawerOpen, setCreateAssistantDrawerOpen] = import_react$1.useState(false);
	const [viewingAssistantId, setViewingAssistantId] = import_react$1.useState(null);
	const [editingAssistantId, setEditingAssistantId] = import_react$1.useState(null);
	const [isOpeningCloudAssistantTeam, setIsOpeningCloudAssistantTeam] = import_react$1.useState(false);
	const [trialError, setTrialError] = import_react$1.useState(null);
	const [optimisticInstalled, setOptimisticInstalled] = import_react$1.useState(false);
	const pendingSelectCloudTabRef = import_react$1.useRef(false);
	const pendingCloudRetryCountRef = import_react$1.useRef(0);
	const refreshClawTabsRef = import_react$1.useRef(async () => void 0);
	const assistantSwitcherAllowed = entitlement.loaded && entitlement.orchestratorEnabled || optimisticInstalled;
	const effectiveInstalled = entitlement.installed || optimisticInstalled;
	import_react$1.useEffect(() => {
		setOptimisticInstalled(false);
		pendingSelectCloudTabRef.current = false;
		pendingCloudRetryCountRef.current = 0;
	}, [accountKey]);
	import_react$1.useEffect(() => {
		if (!entitlement.loaded) return;
		setOptimisticInstalled(false);
	}, [entitlement.installed, entitlement.loaded]);
	useCloudAssistantEntitlementErrorToast(entitlement.error, entitlement.retry);
	const handleStartTrial = import_react$1.useCallback(async () => {
		if (isOpeningCloudAssistantTeam) return;
		reportAssistantTrialClick(adapter);
		if (!agentServices?.cloudAssistant?.initializeOrchestrator) {
			setTrialError(t("cloudAssistantUpgrade.openTeamError"));
			return;
		}
		reportAssistantTrialLoadingShow(adapter);
		setIsOpeningCloudAssistantTeam(true);
		setTrialError(null);
		try {
			await agentServices.cloudAssistant.initializeOrchestrator();
			setOptimisticInstalled(true);
			invalidateCloudAssistantEntitlement();
			pendingSelectCloudTabRef.current = true;
			pendingCloudRetryCountRef.current = 0;
			await refreshClawTabsRef.current();
		} catch (err) {
			if (!notifyIfAuthExpired(err)) setTrialError(t("cloudAssistantUpgrade.openTeamError"));
		} finally {
			setIsOpeningCloudAssistantTeam(false);
		}
	}, [
		agentServices,
		isOpeningCloudAssistantTeam,
		t
	]);
	const { tabs, enterpriseTabs, cloudAssistantState, assistantState, enterpriseAgentState, canCreateAssistant, pinningTarget, refresh, retryGroup, toggleSpecialistPin, toggleEnterpriseAgentPin } = useClawTabs({
		enabled: assistantSwitcherAllowed,
		installed: effectiveInstalled,
		isEnterpriseUser,
		trialContent: (0, import_react$1.useMemo)(() => /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(ClawTrialExperiencePage, {
			loading: isOpeningCloudAssistantTeam,
			error: trialError,
			onStartTrial: handleStartTrial
		}), [
			handleStartTrial,
			isOpeningCloudAssistantTeam,
			trialError
		]),
		onActiveLocalConversationChange
	});
	refreshClawTabsRef.current = refresh;
	const secondarySidebarAllowed = assistantSwitcherAllowed || isEnterpriseUser;
	const shouldReserveSecondarySidebar = !entitlement.loaded && !secondarySidebarAllowed;
	const allTabs = (0, import_react$1.useMemo)(() => [...tabs, ...enterpriseTabs], [tabs, enterpriseTabs]);
	const availableTabKeys = (0, import_react$1.useMemo)(() => allTabs.map((tab) => tab.key), [allTabs]);
	const canValidateActiveTab = entitlement.loaded && cloudAssistantState.hasLoaded && assistantState.hasLoaded && cloudAssistantState.status !== "loading" && assistantState.status !== "loading" && (!isEnterpriseUser || enterpriseAgentState.hasLoaded);
	const { pinned, activeTab, setPinned, setActiveTab } = useSidebarState(availableTabKeys, canValidateActiveTab, {
		enabled: secondarySidebarAllowed,
		defaultPinned: true
	});
	const effectivePinned = secondarySidebarAllowed ? pinned : false;
	const effectiveActiveTab = availableTabKeys.includes(activeTab) ? activeTab : CLAW_LOCAL_TAB_KEY;
	const { hoverPeek, closePeek, triggerBindings, floatingBindings } = useHoverPeek(effectivePinned || !secondarySidebarAllowed);
	const activeTabDefinition = allTabs.find((tab) => tab.key === effectiveActiveTab) ?? allTabs[0];
	const activeTitle = activeTabDefinition?.label || "";
	const showAssistantIcon = activeTabDefinition?.kind === "normal" || activeTabDefinition?.kind === "enterprise";
	const viewingAssistantTab = (0, import_react$1.useMemo)(() => viewingAssistantId ? allTabs.find((tab) => isTabAgentTarget$1(tab, viewingAssistantId)) ?? null : null, [allTabs, viewingAssistantId]);
	const rawAssistantAgents = (0, import_react$1.useMemo)(() => allTabs.map((tab) => tab.rawAgent).filter((agent) => Boolean(agent)), [allTabs]);
	const handleOpenEditAssistantTarget = import_react$1.useCallback((agentId) => {
		setViewingAssistantId(null);
		setEditingAssistantId(agentId);
		setCreateAssistantDrawerOpen(true);
	}, []);
	const { assistantOpenTarget, resolvingAssistantTabKey, assistantTargetError, openAssistantChatTarget, requestOpenAssistantTab, retryAssistantTarget, openNewAssistantChatTarget, onAssistantChatTargetReady, onAssistantSessionDeleted, clearAssistantChatTarget } = useAssistantChatRestore({
		accountKey,
		adapter,
		tabs: allTabs,
		activeTab,
		canValidateActiveTab,
		setActiveTab,
		onOpenLocalClaw: import_react$1.useCallback(() => {
			adapter?.emit("open-claw");
		}, [adapter]),
		onOpenEditAssistant: handleOpenEditAssistantTarget
	});
	import_react$1.useEffect(() => {
		if (assistantOpenTarget?.sessionId) {
			setActiveCloudAssistantSession({
				agentId: assistantOpenTarget.agentId,
				sessionId: assistantOpenTarget.sessionId
			});
			return;
		}
		setActiveCloudAssistantSession(null);
	}, [
		assistantOpenTarget?.agentId,
		assistantOpenTarget?.sessionId,
		setActiveCloudAssistantSession
	]);
	const handleAssistantChatTargetReady = import_react$1.useCallback((payload) => {
		onAssistantChatTargetReady(payload);
		if (payload.sessionId) setActiveCloudAssistantSession({
			agentId: payload.agentId,
			sessionId: payload.sessionId
		});
	}, [onAssistantChatTargetReady, setActiveCloudAssistantSession]);
	const handleSelectTab = import_react$1.useCallback((tabKey) => {
		if (tabKey === "cloud-trial") reportAssistantIntroEntryClick(adapter, { isFirstClick: true });
		const targetTab = allTabs.find((tab) => tab.key === tabKey);
		if (targetTab) {
			requestOpenAssistantTab(targetTab);
			return;
		}
		setActiveTab(tabKey);
	}, [
		adapter,
		allTabs,
		requestOpenAssistantTab,
		setActiveTab
	]);
	import_react$1.useEffect(() => {
		if (!pendingSelectCloudTabRef.current) {
			pendingCloudRetryCountRef.current = 0;
			return;
		}
		const realCloudTab = tabs.find((tab) => tab.kind === "cloud" && tab.key !== "cloud-trial" && tab.rawAgent);
		if (realCloudTab) {
			pendingSelectCloudTabRef.current = false;
			pendingCloudRetryCountRef.current = 0;
			requestOpenAssistantTab(realCloudTab);
			return;
		}
		if (cloudAssistantState.status !== "loading" && effectiveInstalled && pendingCloudRetryCountRef.current < 2) {
			const timer = window.setTimeout(() => {
				pendingCloudRetryCountRef.current += 1;
				refresh().catch(() => void 0);
			}, 800);
			return () => window.clearTimeout(timer);
		}
	}, [
		cloudAssistantState.status,
		effectiveInstalled,
		refresh,
		requestOpenAssistantTab,
		tabs
	]);
	const handleMoreMenuOpen = import_react$1.useCallback((tab) => {
		reportAssistantMoreMenuClick(adapter, { assistantId: getTabAgentId$1(tab) });
	}, [adapter]);
	const handleAssistantSectionToggle = import_react$1.useCallback((expanded) => {
		if (expanded) reportAssistantListExpandClick(adapter);
	}, [adapter]);
	const handleViewAssistant = import_react$1.useCallback((tab) => {
		const agentId = getTabAgentId$1(tab);
		if (!agentId) return;
		reportAssistantMoreProfileClick(adapter, { assistantId: agentId });
		closePeek();
		setEditingAssistantId(null);
		setViewingAssistantId(agentId);
	}, [adapter, closePeek]);
	const handleEditAssistant = import_react$1.useCallback((tab) => {
		const agentId = getTabAgentId$1(tab);
		if (!agentId) return;
		reportAssistantMoreEditClick(adapter, { assistantId: agentId });
		closePeek();
		setViewingAssistantId(null);
		setEditingAssistantId(agentId);
		setCreateAssistantDrawerOpen(true);
	}, [adapter, closePeek]);
	const handleDeleteAssistant = import_react$1.useCallback((tab) => {
		const agentId = getTabAgentId$1(tab);
		if (!agentId || !adapter?.deleteCloudAgent) return;
		reportAssistantMoreDeleteClick(adapter, { assistantId: agentId });
		closePeek();
		setDeleteTarget({
			id: agentId,
			name: tab.label
		});
	}, [adapter, closePeek]);
	const handleTogglePinAssistant = import_react$1.useCallback((tab) => {
		const agent = tab.rawAgent;
		if (!agent || tab.kind !== "normal") return;
		closePeek();
		const isPinned = agent.pinned;
		if (isPinned) reportAssistantMoreUnpinClick(adapter, { assistantId: agent.id });
		else reportAssistantMorePinClick(adapter, { assistantId: agent.id });
		toggleSpecialistPin(agent).catch(() => {
			message.error(t(isPinned ? "colleagues.action.unpinFailed" : "colleagues.action.pinFailed"));
		});
	}, [
		adapter,
		closePeek,
		t,
		toggleSpecialistPin
	]);
	const handleOpenCreateAssistantDrawer = import_react$1.useCallback(async () => {
		reportAssistantCreateEntryClick(adapter);
		closePeek();
		if (!await quotaGate.guardCreateEntry()) return;
		setViewingAssistantId(null);
		setEditingAssistantId(null);
		setCreateAssistantDrawerOpen(true);
	}, [
		adapter,
		closePeek,
		quotaGate
	]);
	const handlePinEnterpriseAgent = import_react$1.useCallback((tab) => {
		const agent = tab.rawAgent;
		if (!agent || tab.kind !== "enterprise") return;
		reportAssistantMorePinClick(adapter, { assistantId: agent.id });
		closePeek();
		toggleEnterpriseAgentPin(agent).catch(() => {
			message.error(t("colleagues.action.pinFailed"));
		});
	}, [
		adapter,
		closePeek,
		toggleEnterpriseAgentPin,
		t
	]);
	const handleUnpinEnterpriseAgent = import_react$1.useCallback((tab) => {
		const agent = tab.rawAgent;
		if (!agent || tab.kind !== "enterprise") return;
		reportAssistantMoreUnpinClick(adapter, { assistantId: agent.id });
		closePeek();
		toggleEnterpriseAgentPin(agent).catch(() => {
			message.error(t("colleagues.action.unpinFailed"));
		});
	}, [
		adapter,
		closePeek,
		toggleEnterpriseAgentPin,
		t
	]);
	const handlePanelPinnedChange = import_react$1.useCallback((nextPinned) => {
		if (nextPinned) reportAssistantPinClick(adapter);
		else reportAssistantUnpinClick(adapter);
		setPinned(nextPinned);
	}, [adapter, setPinned]);
	const handleCloseCreateAssistantDrawer = import_react$1.useCallback(() => {
		setCreateAssistantDrawerOpen(false);
		setEditingAssistantId(null);
	}, []);
	const handleCloseViewAssistantDrawer = import_react$1.useCallback(() => {
		setViewingAssistantId(null);
	}, []);
	const handleStartChatFromProfile = import_react$1.useCallback((agent) => {
		reportProfileChatClick(adapter, { assistantId: agent.id });
		const targetTab = allTabs.find((tab) => isTabAgentTarget$1(tab, agent.id));
		setViewingAssistantId(null);
		if (targetTab) requestOpenAssistantTab(targetTab);
	}, [
		adapter,
		allTabs,
		requestOpenAssistantTab
	]);
	const handleOpenTaskFromProfile = import_react$1.useCallback((agent, task) => {
		const targetTab = allTabs.find((tab) => isTabAgentTarget$1(tab, agent.id));
		if (!targetTab) {
			message.error(t("colleagues.detail.taskTable.openHistoryFailed"));
			return;
		}
		reportProfileTaskClick(adapter, {
			assistantId: agent.id,
			conversationId: task.sessionId
		});
		setActiveTab(targetTab.key);
		setViewingAssistantId(null);
		openAssistantChatTarget({
			agentId: agent.id,
			instanceId: task.instanceId,
			sessionId: task.sessionId,
			sessionStatus: task.sessionStatus ?? null,
			seq: `profile-task:${agent.id}:${task.sessionId}:${Date.now()}`
		});
	}, [
		adapter,
		allTabs,
		openAssistantChatTarget,
		setActiveTab,
		t
	]);
	const handleEditFromProfile = import_react$1.useCallback((agent) => {
		reportProfileEditClick(adapter, { assistantId: agent.id });
		setViewingAssistantId(null);
		setEditingAssistantId(agent.id);
		setCreateAssistantDrawerOpen(true);
	}, [adapter]);
	const handleAssistantCreated = import_react$1.useCallback(async () => {
		await refresh();
		await quotaGate.refreshQuota();
	}, [quotaGate, refresh]);
	const refreshAfterDeleteAssistant = import_react$1.useCallback(async () => {
		try {
			const { colleagueConversationsChanged$, colleagueAgentListChanged$ } = await __vitePreload(async () => {
				const { colleagueConversationsChanged$, colleagueAgentListChanged$ } = await import("./colleague-navigation-bus-fzu7FpJJ.js");
				return {
					colleagueConversationsChanged$,
					colleagueAgentListChanged$
				};
			}, __vite__mapDeps([27,1,2,3,4,5,6]), import.meta.url);
			colleagueConversationsChanged$.next();
			colleagueAgentListChanged$.next();
		} catch (error) {
			console.warn("[ClawWorkspace] notify colleague list changed after delete failed:", error);
		}
		await Promise.all([refresh().catch((err) => console.error("[ClawWorkspace] refresh after delete cloud assistant failed:", err)), quotaGate.refreshQuota().catch((err) => console.error("[ClawWorkspace] refresh quota after delete cloud assistant failed:", err))]);
	}, [quotaGate, refresh]);
	const handleConfirmDelete = import_react$1.useCallback(async () => {
		if (!deleteTarget || !adapter?.deleteCloudAgent) return;
		const target = deleteTarget;
		setDeleting(true);
		try {
			await adapter.deleteCloudAgent({ agentId: target.id });
			message.success(t("delete.toast.success"));
			const deletedTabKey = allTabs.find((tab) => isTabAgentTarget$1(tab, target.id))?.key;
			if (deletedTabKey && activeTab === deletedTabKey) {
				setActiveTab(CLAW_LOCAL_TAB_KEY);
				clearAssistantChatTarget();
			}
			setDeleteTarget(null);
			refreshAfterDeleteAssistant();
		} catch (err) {
			console.error("[ClawWorkspace] delete cloud assistant failed:", err);
			message.error(t("delete.toast.failed"));
			return false;
		} finally {
			setDeleting(false);
		}
	}, [
		adapter,
		allTabs,
		clearAssistantChatTarget,
		deleteTarget,
		activeTab,
		refreshAfterDeleteAssistant,
		setActiveTab,
		t
	]);
	const assistantCard = (0, import_react$1.useMemo)(() => {
		if (!activeTabDefinition?.rawAgent || activeTabDefinition.kind !== "normal" && activeTabDefinition.kind !== "enterprise") return;
		return {
			agent: activeTabDefinition.rawAgent,
			kind: activeTabDefinition.kind,
			name: activeTitle,
			title: activeTabDefinition.subtitle,
			description: activeTabDefinition.rawAgent.description,
			avatarUrl: activeTabDefinition.avatarUrl,
			onViewProfile: () => {
				const agentId = getTabAgentId$1(activeTabDefinition);
				if (!agentId) return;
				reportAssistantCardProfileClick(adapter, { assistantId: agentId });
				closePeek();
				setEditingAssistantId(null);
				setViewingAssistantId(agentId);
			},
			onEditConfig: () => {
				const agentId = getTabAgentId$1(activeTabDefinition);
				if (!agentId) return;
				reportAssistantCardEditClick(adapter, { assistantId: agentId });
				closePeek();
				setViewingAssistantId(null);
				setEditingAssistantId(agentId);
				setCreateAssistantDrawerOpen(true);
			}
		};
	}, [
		activeTabDefinition,
		activeTitle,
		adapter,
		closePeek
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(ClawWorkspaceChromeProvider, {
		value: (0, import_react$1.useMemo)(() => ({
			activeTitle,
			pinned: effectivePinned,
			hoverPeek,
			showAssistantIcon,
			showAssistantSwitcher: secondarySidebarAllowed,
			assistantCard,
			peekAriaLabel: t("claw.workspace.peek.ariaLabel"),
			triggerBindings
		}), [
			activeTitle,
			assistantCard,
			secondarySidebarAllowed,
			effectivePinned,
			hoverPeek,
			showAssistantIcon,
			t,
			triggerBindings
		]),
		children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
			className: "claw-workspace",
			children: [
				secondarySidebarAllowed && /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(ClawSecondarySidebar, {
					tabs,
					enterpriseTabs,
					isEnterpriseUser,
					activeTab: effectiveActiveTab,
					pinned: effectivePinned,
					hoverPeek,
					floatingBindings,
					cloudAssistantState,
					assistantState,
					enterpriseAgentState,
					canCreateAssistant,
					pinningTarget,
					onSelectTab: handleSelectTab,
					onViewAssistant: handleViewAssistant,
					onEditAssistant: handleEditAssistant,
					onTogglePinAssistant: handleTogglePinAssistant,
					onDeleteAssistant: handleDeleteAssistant,
					onPinEnterpriseAgent: handlePinEnterpriseAgent,
					onUnpinEnterpriseAgent: handleUnpinEnterpriseAgent,
					onCreateAssistant: handleOpenCreateAssistantDrawer,
					onPinnedChange: handlePanelPinnedChange,
					onClosePeek: closePeek,
					onRetryGroup: (group) => {
						retryGroup(group).catch(() => void 0);
					},
					onMoreMenuOpen: handleMoreMenuOpen,
					onAssistantSectionToggle: handleAssistantSectionToggle,
					onEnterpriseSectionToggle: handleAssistantSectionToggle
				}),
				shouldReserveSecondarySidebar && /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
					className: "claw-secondary-sidebar claw-secondary-sidebar--pinned",
					"aria-hidden": "true"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("main", {
					className: "claw-workspace__main",
					children: allTabs.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
						className: "claw-workspace__pane",
						hidden: tab.key !== effectiveActiveTab,
						"aria-hidden": tab.key !== effectiveActiveTab,
						children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(ErrorBoundary, {
							fallback: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
								className: "claw-workspace__tab-error",
								children: tab.label
							}),
							children: /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(AssistantTabContent, {
								tab,
								activeTab: effectiveActiveTab,
								mainContentProps,
								assistantOpenTarget,
								resolvingAssistantTabKey,
								assistantTargetError,
								onAssistantChatTargetReady: handleAssistantChatTargetReady,
								onAssistantSessionDeleted,
								onRetryAssistantTarget: retryAssistantTarget,
								onOpenNewAssistantChatTarget: openNewAssistantChatTarget
							})
						})
					}, tab.key))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(CreateAssistantDrawer, {
					open: createAssistantDrawerOpen,
					onClose: handleCloseCreateAssistantDrawer,
					onCreated: handleAssistantCreated,
					editingAgentId: editingAssistantId,
					checkQuotaBeforeCreate: quotaGate.checkQuotaBeforeCreate,
					onQuotaExceeded: quotaGate.handleQuotaExceeded
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(AssistantQuotaLimitModal, {
					open: quotaGate.isQuotaLimitOpen,
					quota: quotaGate.quotaLimitSnapshot,
					onClose: quotaGate.closeQuotaLimit,
					onUpgrade: quotaGate.handleOpenPlanUpgrade
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(ViewAssistantDrawer, {
					open: !!viewingAssistantId,
					title: t("colleagues.detail.profile"),
					closeLabel: t("common.close"),
					agent: viewingAssistantTab?.rawAgent ?? null,
					kind: viewingAssistantTab?.kind,
					rawAgents: rawAssistantAgents,
					onClose: handleCloseViewAssistantDrawer,
					onStartChat: handleStartChatFromProfile,
					onEdit: handleEditFromProfile,
					onOpenTask: handleOpenTaskFromProfile
				}),
				/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)(Modal, {
					open: !!deleteTarget,
					onOpenChange: (open) => {
						if (!open && !deleting) setDeleteTarget(null);
					},
					title: t("colleagues.action.deleteConfirmTitle"),
					centered: true,
					size: "small",
					wrapClassName: "claw-delete-assistant-overlay",
					okText: t("common.delete"),
					cancelText: t("common.cancel"),
					okType: "danger",
					confirmLoading: deleting,
					onOk: handleConfirmDelete,
					onCancel: () => setDeleteTarget(null),
					closeOnOverlayClick: false,
					children: deleteTarget && /* @__PURE__ */ (0, import_jsx_runtime$1.jsxs)("div", {
						className: "wb-modal__confirm-body wb-modal__confirm-body--confirm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("span", {
							className: "wb-modal__confirm-icon wb-modal__confirm-icon--confirm",
							"aria-hidden": true
						}), /* @__PURE__ */ (0, import_jsx_runtime$1.jsx)("div", {
							className: "wb-modal__confirm-content",
							children: t("colleagues.action.deleteConfirmDescription", { name: deleteTarget.name })
						})]
					})
				})
			]
		})
	});
}
var import_react$1, import_jsx_runtime$1;
var init_claw_workspace = __esmMin((() => {
	init_claw_workspace$1();
	init_src();
	import_react$1 = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_auth_context();
	init_useI18n();
	init_services();
	init_use_cloud_assistant_entitlement();
	init_auth_expired_detector();
	init_assistant_quota_limit_modal();
	init_telemetry();
	init_error_boundary();
	init_context();
	init_create_assistant_drawer();
	init_secondary_sidebar();
	init_use_hover_peek();
	init_use_sidebar_state();
	init_tab_target_utils();
	init_assistant_tab_content();
	init_tab_registry();
	init_use_assistant_chat_restore();
	init_use_claw_tabs();
	init_trial_experience();
	init_use_assistant_quota_gate();
	init_use_cloud_assistant_entitlement_error_toast();
	import_jsx_runtime$1 = require_jsx_runtime();
	init_claw_agent_chat_topbar();
	init_preload_helper();
}));
//#endregion
//#region ../../packages/agent-ui/src/pages/claw.tsx
/** `/claw` 页面只组合公共工作区；本地 Conversation Engine 生命周期由 ClawLocalTab 自治。 */
function ClawWorkspacePage() {
	const ctx = useOutletContext();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClawWorkspace, {
		mainContentProps: ctx,
		onActiveLocalConversationChange: ctx.onActiveClawLocalConversationChange
	});
}
var import_jsx_runtime;
//#endregion
__esmMin((() => {
	require_react();
	init_dist();
	init_claw_workspace();
	import_jsx_runtime = require_jsx_runtime();
}))();
export { ClawWorkspacePage };
