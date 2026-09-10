const require_task_status = require("./task-status.js");
//#region ../../packages/workbuddy-server/src/session/document-lifecycle-port.ts
function createIsSessionStillProcessing(sessionManager) {
	return (sessionId) => {
		const view = sessionManager.getSession(sessionId);
		if (!view) return false;
		const status = view.status;
		if (status && require_task_status.isTerminalTaskStatus(status)) return false;
		return view.isProcessing === true || status === "working" || status === "planning";
	};
}
//#endregion
Object.defineProperty(exports, "createIsSessionStillProcessing", {
	enumerable: true,
	get: function() {
		return createIsSessionStillProcessing;
	}
});
