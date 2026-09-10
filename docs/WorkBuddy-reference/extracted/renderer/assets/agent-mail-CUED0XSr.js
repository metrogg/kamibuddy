import { n as __esmMin, s as __toESM } from "./rolldown-runtime-D5a2oYpF.js";
import { GL as useConversations, Rs as init_contexts, _x as init_agent_mail$1, vx as AgentMailPage$1 } from "./ui-docs-viewer-C2jT2eXi.js";
import { Ou as require_jsx_runtime, ku as require_react } from "./lib-chat-ui-ChIVprRk.js";
//#region ../../packages/agent-ui/src/pages/agent-mail.tsx
function AgentMailPage() {
	const { setShowDetailPanel } = useConversations();
	(0, import_react.useEffect)(() => {
		setShowDetailPanel?.(false);
	}, [setShowDetailPanel]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AgentMailPage$1, { visible: true });
}
var import_react, import_jsx_runtime;
//#endregion
__esmMin((() => {
	import_react = /* @__PURE__ */ __toESM(require_react());
	init_contexts();
	init_agent_mail$1();
	import_jsx_runtime = require_jsx_runtime();
}))();
export { AgentMailPage };
