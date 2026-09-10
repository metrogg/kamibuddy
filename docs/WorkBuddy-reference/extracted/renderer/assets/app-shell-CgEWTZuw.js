import { n as __esmMin, s as __toESM } from "./rolldown-runtime-D5a2oYpF.js";
import { Dk as init_pending_session_select, FD as isDeepLinkRouteChange, GL as useConversations, Gg as InspirationShareCodeDetailHost, Gw as subscribeSpaceHostSender, Gx as init_use_tencent_lexiang_enabled, Hw as getSpaceHostSender, ID as resolveDeepLinkFromUrl, Kg as init_use_inspiration_share_code_detail_host, Kx as useTencentLexiangEnabled, LN as useConversationEngineFeature, M_ as setCurrentRoutePath, Ok as pendingSessionSelectStore, PD as init_deep_link_routes, Qx as useTencentDocsKnowledgeFeature, Rs as init_contexts, SL as useNavigate, SM as publishShellRouteGates, Ug as init_use_inspiration_share_code_receiver, Uw as init_space_open_in_library_store, Vw as useSpaceOpenInLibrary, WM as init_product_features, Wg as useInspirationShareCodeReceiver, Wx as useAgentMailFeature, XO as init_use_product_feature, Xx as init_use_tencent_docs_knowledge_feature, YO as useSettings, Yw as SpaceJsApiEvent, ZO as useProductFeature, Zw as init_space_jsapi_protocol, _M as matchShellRoute, _x as init_agent_mail, aM as init_router, aS as init_use_knowledge_base_feature, bE as openPurchaseModal, bM as init_brand_route_gates, cD as deepLinkConversationOpen$, cF as init_use_ima_enabled, cc as init_auth_context, gM as init_route_matchers, hE as init_purchase, hS as init_main_route_outlet, jD as subscribePendingDeepLinkUrl, j_ as init_route_path_tracker, kD as init_deeplink_pending_url, lF as useImaEnabled, mM as warmupRouteKeepAlive, nb as init_task_starter_store, oS as useKnowledgeBaseFeature, pD as taskStarterCwd$, qO as init_SettingsContext, rD as init_input_intents, uD as getConversationOpenDeepLinkId, uc as useAuth, vL as init_dist, xL as useLocation, xM as isShellViewAllowed, yM as BRAND_GATE_REDIRECT_EVENT, zL as useAdapter, zw as init_use_space_open_in_library } from "./ui-docs-viewer-C2jT2eXi.js";
import { Ou as require_jsx_runtime, di as toast, ku as require_react, t as init_src } from "./lib-chat-ui-ChIVprRk.js";
import { a as myFilesStore, n as init_store } from "./store-Ca5qZtFz.js";
//#region ../../packages/agent-ui/src/components/space-panel/use-space-open-storage-panel.ts
function useSpaceOpenStoragePanel() {
	const navigate = useNavigate();
	const { isAuthenticated } = useAuth();
	const spaceEnabled = useProductFeature("Space", { mode: "enable" });
	(0, import_react$4.useEffect)(() => {
		if (!spaceEnabled || !isAuthenticated) return;
		let pending = false;
		let pendingUnsub = null;
		const clearPending = () => {
			pending = false;
			if (pendingUnsub) {
				pendingUnsub();
				pendingUnsub = null;
			}
		};
		const armPending = () => {
			pending = true;
			if (pendingUnsub) return;
			pendingUnsub = subscribeSpaceHostSender((sender) => {
				if (sender && pending) {
					clearPending();
					sender.sendJsApiEvent(SpaceJsApiEvent.OpenStoragePanel);
				}
			});
		};
		const handler = (evt) => {
			evt.preventDefault();
			navigate("/space");
			const sender = getSpaceHostSender();
			if (sender) {
				sender.sendJsApiEvent(SpaceJsApiEvent.OpenStoragePanel);
				return;
			}
			warmupRouteKeepAlive("space");
			armPending();
		};
		window.addEventListener(SPACE_OPEN_STORAGE_PANEL_EVENT, handler);
		return () => {
			window.removeEventListener(SPACE_OPEN_STORAGE_PANEL_EVENT, handler);
			clearPending();
		};
	}, [
		spaceEnabled,
		isAuthenticated,
		navigate
	]);
}
var import_react$4, SPACE_OPEN_STORAGE_PANEL_EVENT;
var init_use_space_open_storage_panel = __esmMin((() => {
	import_react$4 = /* @__PURE__ */ __toESM(require_react());
	init_dist();
	init_auth_context();
	init_use_product_feature();
	init_router();
	init_space_jsapi_protocol();
	init_space_open_in_library_store();
	SPACE_OPEN_STORAGE_PANEL_EVENT = "workbuddy:open-space-storage-panel";
}));
//#endregion
//#region ../../packages/agent-ui/src/app-shell/effects/use-route-side-effects.ts
function isCurrentClawConversation(conversation) {
	return Boolean(conversation?.id) && /[/\\]Claw$/i.test(conversation?.cwd || "");
}
function shouldClearCurrentConversation(route, conversation) {
	if (!route.handle.clearCurrentConversation) return false;
	return route.handle.view === "claw" ? !isCurrentClawConversation(conversation) : true;
}
/** 执行 route 元数据声明的一次性副作用：清会话 / 复位 task starter cwd。 */
function applyRouteSideEffects(route, context) {
	if (route.handle.resetTaskStarterCwd) taskStarterCwd$.next("");
	if (shouldClearCurrentConversation(route, context.currentConversation)) context.setCurrentConversation(null);
}
/** route → 一次性状态复位；仅保留合法的 URL → state 单向复位。 */
function useRouteSideEffects(pathname, conversations) {
	const conversationsRef = (0, import_react$3.useRef)(conversations);
	(0, import_react$3.useEffect)(() => {
		conversationsRef.current = conversations;
	});
	(0, import_react$3.useLayoutEffect)(() => {
		const route = matchShellRoute(pathname);
		if (route) applyRouteSideEffects(route, conversationsRef.current);
	}, [pathname]);
}
var import_react$3;
var init_use_route_side_effects = __esmMin((() => {
	import_react$3 = /* @__PURE__ */ __toESM(require_react());
	init_task_starter_store();
	init_route_matchers();
}));
//#endregion
//#region ../../packages/agent-ui/src/navigation/deeplink/use-deep-link-navigation.ts
/**
* 订阅并消费 workbuddy:// deep-link。
*
* URL 解析是纯函数；本 hook 只处理 telemetry、brand gate、store 写入与 navigate 副作用。
*/
function useDeepLinkNavigation({ conversations, gates, pathname, adapter, navigate }) {
	const conversationsRef = (0, import_react$2.useRef)(conversations);
	const gatesRef = (0, import_react$2.useRef)(gates);
	const pathnameRef = (0, import_react$2.useRef)(pathname);
	const conversationRouteEnabled = useConversationEngineFeature() !== false;
	const { openSettings } = useSettings();
	const openSettingsRef = (0, import_react$2.useRef)(openSettings);
	(0, import_react$2.useEffect)(() => {
		conversationsRef.current = conversations;
		gatesRef.current = gates;
		pathnameRef.current = pathname;
		openSettingsRef.current = openSettings;
	});
	(0, import_react$2.useEffect)(() => {
		const handleDeepLink = (url) => {
			if (!url) return;
			const resolution = resolveDeepLinkFromUrl(url);
			if (resolution.kind === "invalid") {
				console.warn("[DeepLinkNavigation] deep link url parse failed:", url);
				return;
			}
			if (resolution.kind === "purchase") {
				openPurchaseModal({
					url: resolution.href,
					source: "deeplink"
				});
				return;
			}
			if (resolution.kind === "settings") {
				adapter.reportTelemetry(DEEP_LINK_ENTRY_EVENT, {
					source: "deeplink",
					page: resolution.host,
					pageURL: pathnameRef.current
				});
				openSettingsRef.current(resolution.tab, resolution.subRoute);
				return;
			}
			if (resolution.kind === "unknown") {
				console.warn("[DeepLinkNavigation] unknown deep link host, ignored:", resolution.host);
				return;
			}
			const { host, resolvedPath, replace, pendingTaskId, expertCenter, myFiles } = resolution;
			const targetPath = conversationRouteEnabled && pendingTaskId ? `/conversation/${encodeURIComponent(pendingTaskId)}` : resolvedPath;
			const targetRoute = matchShellRoute(targetPath);
			const routeChanged = isDeepLinkRouteChange(pathnameRef.current, targetPath);
			if (targetRoute && !isShellViewAllowed(targetRoute.handle.view, gatesRef.current)) {
				adapter.reportTelemetry(BRAND_GATE_REDIRECT_EVENT, {
					source: "deeplink",
					page: host.toLowerCase(),
					pageURL: targetPath,
					pageName: targetRoute.handle.view
				});
				if (pathnameRef.current !== "/") navigate("/", { replace: true });
				return;
			}
			adapter.reportTelemetry(DEEP_LINK_ENTRY_EVENT, {
				source: "deeplink",
				page: host.toLowerCase(),
				pageURL: targetPath
			});
			if (targetRoute && routeChanged) applyRouteSideEffects(targetRoute, conversationsRef.current);
			if (myFiles) {
				myFilesStore.getState().triggerCapacityRefresh();
				if (myFiles.activeTab === "cloudFiles") myFilesStore.getState().setActiveTab("cloudFiles");
			}
			if (routeChanged || expertCenter) navigate(targetPath, {
				replace,
				...expertCenter ? { state: expertCenter } : {}
			});
			if (pendingTaskId && !conversationRouteEnabled) pendingSessionSelectStore.getState().setPendingSession({ sessionId: pendingTaskId });
		};
		return subscribePendingDeepLinkUrl(handleDeepLink);
	}, [
		adapter,
		conversationRouteEnabled,
		navigate
	]);
}
var import_react$2, DEEP_LINK_ENTRY_EVENT;
var init_use_deep_link_navigation = __esmMin((() => {
	import_react$2 = /* @__PURE__ */ __toESM(require_react());
	init_use_route_side_effects();
	init_store();
	init_purchase();
	init_SettingsContext();
	init_product_features();
	init_brand_route_gates();
	init_route_matchers();
	init_pending_session_select();
	init_deep_link_routes();
	init_deeplink_pending_url();
	DEEP_LINK_ENTRY_EVENT = "workbuddy_deeplink_entry";
}));
//#endregion
//#region ../../packages/agent-ui/src/navigation/inspiration-share-code/index.ts
var init_inspiration_share_code = __esmMin((() => {
	init_use_inspiration_share_code_receiver();
	init_use_inspiration_share_code_detail_host();
}));
//#endregion
//#region ../../packages/agent-ui/src/router/use-shell-route-gates.ts
/**
* 组装 brand gate 判定所需的各功能开关（与 sidebar「更多」菜单入口隐藏逻辑同源）。
*
* 只应由常驻 RouterEffects 调用，并通过 `publishShellRouteGates()` 发布快照。
* BrandGate / MainRouteOutlet 等路由渲染路径必须读取 `useShellRouteGatesSnapshot()`，
* 避免路由激活时新建异步 feature hook 实例。
*/
function useShellRouteGates() {
	const { enabled: imaEnabled } = useImaEnabled();
	const knowledgeBaseEnabled = useKnowledgeBaseFeature();
	const tencentDocsEnabled = useTencentDocsKnowledgeFeature();
	const { enabled: lexiangEnabled } = useTencentLexiangEnabled();
	const agentMailEnabled = useAgentMailFeature();
	const inspirationEnabled = useProductFeature("Discover", {
		mode: "enable",
		defaultEnabled: true
	});
	const spaceEnabled = useProductFeature("Space", { mode: "enable" });
	return (0, import_react$1.useMemo)(() => ({
		"my-files": knowledgeBaseEnabled,
		"tencent-docs": tencentDocsEnabled,
		ima: imaEnabled,
		lexiang: lexiangEnabled,
		inspiration: inspirationEnabled,
		"agent-mail": agentMailEnabled,
		space: spaceEnabled
	}), [
		knowledgeBaseEnabled,
		tencentDocsEnabled,
		imaEnabled,
		lexiangEnabled,
		inspirationEnabled,
		agentMailEnabled,
		spaceEnabled
	]);
}
var import_react$1;
var init_use_shell_route_gates = __esmMin((() => {
	import_react$1 = /* @__PURE__ */ __toESM(require_react());
	init_use_ima_enabled();
	init_use_knowledge_base_feature();
	init_use_product_feature();
	init_use_tencent_docs_knowledge_feature();
	init_use_tencent_lexiang_enabled();
	init_agent_mail();
}));
//#endregion
//#region ../../packages/agent-ui/src/app-shell/effects/conversation-open-deep-link-navigation.ts
/**
* 本次 payload 是否应该执行导航副作用。
*
* 返回 true 表示这是一个尚未处理过的新意图（并就地登记）；重复投递 / 回放返回 false。
*/
function shouldNavigateForConversationOpenDeepLink(payload) {
	const deeplinkId = getConversationOpenDeepLinkId(payload);
	if (navigatedDeepLinkIds.has(deeplinkId)) return false;
	if (navigatedDeepLinkIds.size >= NAVIGATED_DEEP_LINK_ID_LIMIT) navigatedDeepLinkIds.clear();
	navigatedDeepLinkIds.add(deeplinkId);
	return true;
}
var navigatedDeepLinkIds, NAVIGATED_DEEP_LINK_ID_LIMIT;
var init_conversation_open_deep_link_navigation = __esmMin((() => {
	init_input_intents();
	navigatedDeepLinkIds = /* @__PURE__ */ new Set();
	NAVIGATED_DEEP_LINK_ID_LIMIT = 200;
}));
//#endregion
//#region ../../packages/agent-ui/src/app-shell/effects/router-effects.tsx
/** 挂载 router 相关全局副作用：route path tracker、route side effects 与 deep-link 桥。 */
function RouterEffects() {
	const location = useLocation();
	const navigate = useNavigate();
	const adapter = useAdapter();
	const conversations = useConversations();
	const gates = useShellRouteGates();
	const conversationsRef = (0, import_react.useRef)(conversations);
	(0, import_react.useEffect)(() => {
		conversationsRef.current = conversations;
	});
	(0, import_react.useEffect)(() => {
		publishShellRouteGates(gates);
	}, [gates]);
	(0, import_react.useEffect)(() => {
		setCurrentRoutePath(location.pathname);
	}, [location.pathname]);
	useRouteSideEffects(location.pathname, conversations);
	useDeepLinkNavigation({
		conversations,
		gates,
		pathname: location.pathname,
		adapter,
		navigate
	});
	useSpaceOpenInLibrary();
	useSpaceOpenStoragePanel();
	useInspirationShareCodeReceiver({ onError: (message) => toast.error(message) });
	const navigateRef = (0, import_react.useRef)(navigate);
	navigateRef.current = navigate;
	(0, import_react.useEffect)(() => {
		const subscription = deepLinkConversationOpen$.subscribe((payload) => {
			if (!payload || !shouldNavigateForConversationOpenDeepLink(payload)) return;
			navigateRef.current("/");
			conversationsRef.current.setCurrentConversation?.(null);
			taskStarterCwd$.next("");
		});
		return () => subscription.unsubscribe();
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InspirationShareCodeDetailHost, {});
}
var import_react, import_jsx_runtime;
var init_router_effects = __esmMin((() => {
	init_src();
	import_react = /* @__PURE__ */ __toESM(require_react());
	init_dist();
	init_task_starter_store();
	init_use_space_open_in_library();
	init_use_space_open_storage_panel();
	init_contexts();
	init_use_deep_link_navigation();
	init_inspiration_share_code();
	init_brand_route_gates();
	init_use_shell_route_gates();
	init_route_path_tracker();
	init_conversation_open_deep_link_navigation();
	init_use_route_side_effects();
	import_jsx_runtime = require_jsx_runtime();
}));
//#endregion
//#region ../../packages/agent-ui/src/app-shell/index.ts
var init_app_shell = __esmMin((() => {
	init_router_effects();
	init_main_route_outlet();
}));
//#endregion
export { RouterEffects as n, init_app_shell as t };
