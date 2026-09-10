import { n as __esmMin, s as __toESM } from "./rolldown-runtime-D5a2oYpF.js";
import { CL as useOutletContext, GL as useConversations, Rs as init_contexts, bc as useAgentServices, vL as init_dist, vc as init_app_providers } from "./ui-docs-viewer-C2jT2eXi.js";
import { Ou as require_jsx_runtime, ku as require_react } from "./lib-chat-ui-ChIVprRk.js";
import { n as MainContentCore, t as init_main_content_core } from "./main-content-core-DG_Qu1Pk.js";
import { i as useProjectLocalChatConfig, m as useProjectInputResources } from "./use-project-local-chat-config-C8Va-TIL.js";
import { n as init_collab } from "./collab-Ce2Csm-3.js";
//#region ../../packages/agent-ui/src/pages/chat.tsx
/**
* 主聊天页：迁移期承载 `/home` 与 `/task/:taskId` 的主内容区。
*
* = MainContentCore + 项目连接器资源接线。其余 shell 页面由 pages/* 各自的 route 页承载，
* 不再经这里分发（历史上叫 MainRouteOutlet / LegacyMainRoute，已正名并入本页）。
*
* `/home` 当前仍委托 MainContentCore 渲染旧 welcome，后续由 modules/home 的独立页面替换；
* 这里保留该桥接，确保路由迁移与输入编排迁移可以分批落地。
*/
function ChatPage() {
	const props = useOutletContext();
	const agentServices = useAgentServices();
	const conversationsContext = useConversations();
	const activeConversation = props?.currentConversation ?? conversationsContext.currentConversation;
	const currentProjectId = activeConversation?.projectId || activeConversation?.session?.projectId;
	const connectorFacade = agentServices?.connector;
	const listProjectConnectors = (0, import_react.useCallback)((projectId) => connectorFacade.listProjectConnectors(projectId), [connectorFacade]);
	const { projectPublicConnectorConfigs } = useProjectInputResources({
		projectId: currentProjectId,
		listProjectConnectors: connectorFacade ? listProjectConnectors : void 0
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MainContentCore, {
		...props,
		projectPublicConnectorConfigs,
		useProjectLocalChatConfig
	});
}
var import_react, import_jsx_runtime;
//#endregion
__esmMin((() => {
	import_react = /* @__PURE__ */ __toESM(require_react());
	init_dist();
	init_main_content_core();
	init_contexts();
	init_collab();
	init_app_providers();
	import_jsx_runtime = require_jsx_runtime();
}))();
export { ChatPage };
