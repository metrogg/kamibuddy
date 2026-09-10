const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./automation-CSocvMdX.js","./ui-docs-viewer-C2jT2eXi.js","./rolldown-runtime-D5a2oYpF.js","./lib-chat-ui-ChIVprRk.js","./lib-chat-ui-Co_VI_pZ.css","./ui-ardot-DkNyoQ5N.js","./ui-docs-viewer-D8SBBSEE.css","./automation-CScSBdkh.css","./automation-panel-DhXq4pvG.js","./expert-selector-qU6eSd7G.js","./expert-selector-O8nx-TPT.css","./skill-selector-xP0oU-Iz.js","./use-skill-selector-D8Hc0tZS.js","./skill-selector-BNhFnKiA.css","./automation-panel-TLOWWMiC.css"])))=>i.map(i=>d[i]);
import { n as __esmMin, s as __toESM } from "./rolldown-runtime-D5a2oYpF.js";
import { Eb as init_use_sidebar_state, GL as useConversations, Il as init_common, It as init_app_core, Ll as init_input_providers, Mb as init_tab_registry, Qd as useHostWorkspaceInputCapabilities, RI as prefetchInputConnectorSnapshot, Rs as init_contexts, Rt as wb, SL as useNavigate, TM as useRouterContextSafe, XO as init_use_product_feature, ZO as useProductFeature, aM as init_router, bc as useAgentServices, cL as init_useI18n, ef as useWorkspaceInputHost, fL as InputRuntimeProvider, gL as useModuleHost, gf as useWbModelProvider, jb as CLAW_LOCAL_TAB_KEY, kb as writeClawSidebarActiveTabPreference, lL as useI18n, sM as buildClawLocalSessionPath, vL as init_dist, vc as init_app_providers, yL as useSearchParams, zL as useAdapter } from "./ui-docs-viewer-C2jT2eXi.js";
import { Mu as init_preload_helper, Ou as require_jsx_runtime, di as toast, ju as __vitePreload, ku as require_react, t as init_src } from "./lib-chat-ui-ChIVprRk.js";
//#region ../../packages/agent-ui/src/modules/automation/hooks/use-automation-route-runtime.ts
/**
* Builds the Automation route runtime from app-level wb/services wiring.
*
* 模型 / 专家 / 连接器 / 工作区数据已改由输入框内的共享 provider 层拉取
* （Issue #88473），此处只保留 `canSelectSkills` 能力位。
*
* 工作区「新建 / 打开本地文件夹」的宿主端口与弹窗改由共享的 `useWorkspaceInputHost`
* 在页面层直接注入 `InputRuntimeProvider`（Issue #91779），不再经由 `useTaskStarterConfig`
* 单独渲染——后者产出的弹窗未接入共享工作区 provider 的下拉动作，是丢失能力的根因。
*/
function useAutomationRouteRuntime() {
	const services = useAgentServices();
	return { automationEditorRuntime: (0, import_react$1.useMemo)(() => ({ canSelectSkills: () => Boolean(services?.personalSkills) }), [services]) };
}
var import_react$1;
var init_use_automation_route_runtime = __esmMin((() => {
	import_react$1 = /* @__PURE__ */ __toESM(require_react());
	init_app_providers();
}));
//#endregion
//#region ../../packages/agent-ui/src/pages/automation.tsx
function isClawWorkspace(path) {
	if (!path) return false;
	return /(?:^|[/\\])claw(?:[/\\]|$)/i.test(path);
}
function useOpenAutomationConversation() {
	const conversationsContext = useConversations();
	const router = useRouterContextSafe();
	const { t } = useI18n();
	return (0, import_react.useCallback)(async (conversationId, cwd, title) => {
		if (!conversationId) return;
		const isCurrentConversation = conversationsContext.currentConversation?.id === conversationId;
		const existingFullConversation = conversationsContext.conversations?.find((conv) => conv.id === conversationId);
		const engineConversation = await wb.conversations.get(conversationId).catch(() => void 0);
		if (!engineConversation) {
			toast({
				type: "error",
				message: t("automation.error.missingConversation")
			});
			throw new Error(`Automation conversation not found: ${conversationId}`);
		}
		const engineCwd = cwd || engineConversation.info.space.cwd || "";
		const targetListView = isClawWorkspace(engineCwd) ? "claw" : "tasks";
		const targetConversation = {
			id: conversationId,
			cwd: engineCwd,
			title: title || engineConversation.info.title || existingFullConversation?.title || conversationId,
			timestamp: new Date(engineConversation.info.lastActivityAt),
			status: "pending",
			messages: existingFullConversation?.messages || []
		};
		if (targetListView === "claw") {
			if (!isCurrentConversation) conversationsContext.setCurrentConversation?.(targetConversation);
			writeClawSidebarActiveTabPreference(CLAW_LOCAL_TAB_KEY);
			router?.navigateToPath?.(buildClawLocalSessionPath(conversationId), { replace: true });
			return;
		}
		conversationsContext.setJumpToConversationId?.(conversationId);
	}, [
		conversationsContext,
		router,
		t
	]);
}
function AutomationRoutePage(props) {
	return useProductFeature(AUTOMATION_WB_SDK_REFACTOR_FEATURE, {
		mode: "enable",
		defaultEnabled: true
	}) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewAutomationRoutePage, { ...props }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegacyAutomationRoutePage, { ...props });
}
function useAutomationRouteNavigationHandlers() {
	const navigate = useNavigate();
	return {
		handleSummonExpert: (0, import_react.useCallback)(() => {
			navigate("/experts");
		}, [navigate]),
		handleOpenConnectorSettings: (0, import_react.useCallback)(() => {
			navigate("/connectors");
		}, [navigate])
	};
}
function NewAutomationRoutePage({ initialEditId, onInitialEditHandled }) {
	const host = useModuleHost();
	const handleAutomationConversationOpen = useOpenAutomationConversation();
	const { handleSummonExpert } = useAutomationRouteNavigationHandlers();
	const { automationEditorRuntime } = useAutomationRouteRuntime();
	const { workspaceInput, workspaceModal } = useWorkspaceInputHost(useHostWorkspaceInputCapabilities());
	const inputRuntimeHost = (0, import_react.useMemo)(() => {
		const adapter = host.adapter;
		const searchFile = adapter.searchFile?.bind(adapter);
		const getAvailableCommands = adapter.getAvailableCommands?.bind(adapter);
		const getProductConfig = adapter.getProductConfig?.bind(adapter);
		const speechToText = adapter.speechToText?.bind(adapter);
		return {
			environmentType: host.environmentType,
			accountInfo: host.accountInfo,
			getProductConfig,
			speechToText,
			getAvailableCommands: getAvailableCommands ? (params) => getAvailableCommands(params) : void 0,
			searchFiles: searchFile ? (params) => searchFile(params) : void 0,
			useModelProvider: useWbModelProvider,
			workspaceInput
		};
	}, [
		host.accountInfo,
		host.adapter,
		host.environmentType,
		workspaceInput
	]);
	(0, import_react.useEffect)(() => {
		prefetchInputConnectorSnapshot(host.wb).catch(() => void 0);
	}, [host.wb]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InputRuntimeProvider, {
		wb: host.wb,
		host: inputRuntimeHost,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "main-content main-content--automation",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "automation-main-page",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
					fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "main-content__lazy-fallback" }),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LazyAutomationWorkspacePage, {
						editorRuntime: automationEditorRuntime,
						onOpenConversation: handleAutomationConversationOpen,
						initialEditId,
						onInitialEditHandled,
						onSummonExpert: handleSummonExpert
					})
				}), workspaceModal]
			})
		})
	});
}
function LegacyAutomationRoutePage({ initialEditId, onInitialEditHandled }) {
	const adapter = useAdapter();
	const handleAutomationConversationOpen = useOpenAutomationConversation();
	const { handleSummonExpert, handleOpenConnectorSettings } = useAutomationRouteNavigationHandlers();
	if (!adapter) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "main-content main-content--automation" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "main-content main-content--automation",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
			fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "main-content__lazy-fallback" }),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LazyLegacyAutomationPanel, {
				adapter,
				onOpenConversation: handleAutomationConversationOpen,
				initialEditId,
				onInitialEditHandled,
				onOpenConnectorSettings: handleOpenConnectorSettings,
				onSummonExpert: handleSummonExpert
			})
		})
	});
}
function AutomationPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AutomationRoutePage, {
		initialEditId: searchParams.get("editId") ?? void 0,
		onInitialEditHandled: (0, import_react.useCallback)(() => {
			const next = new URLSearchParams(searchParams);
			next.delete("editId");
			setSearchParams(next, { replace: true });
		}, [searchParams, setSearchParams])
	});
}
var import_react, import_jsx_runtime, LazyAutomationWorkspacePage, LazyLegacyAutomationPanel, AUTOMATION_WB_SDK_REFACTOR_FEATURE;
//#endregion
__esmMin((() => {
	init_src();
	import_react = /* @__PURE__ */ __toESM(require_react());
	init_dist();
	init_app_core();
	init_use_sidebar_state();
	init_tab_registry();
	init_contexts();
	init_use_product_feature();
	init_useI18n();
	init_use_automation_route_runtime();
	init_common();
	init_input_providers();
	init_router();
	import_jsx_runtime = require_jsx_runtime();
	init_preload_helper();
	LazyAutomationWorkspacePage = import_react.lazy(() => __vitePreload(() => import("./automation-CSocvMdX.js").then((module) => ({ default: module.AutomationWorkspacePage })), __vite__mapDeps([0,1,2,3,4,5,6,7]), import.meta.url));
	LazyLegacyAutomationPanel = import_react.lazy(() => __vitePreload(() => import("./automation-panel-DhXq4pvG.js").then((module) => ({ default: module.AutomationPanel })), __vite__mapDeps([8,1,2,3,4,5,6,9,10,11,12,13,14]), import.meta.url));
	AUTOMATION_WB_SDK_REFACTOR_FEATURE = "AutomationWbSdkRefactor";
}))();
export { AutomationPage };
