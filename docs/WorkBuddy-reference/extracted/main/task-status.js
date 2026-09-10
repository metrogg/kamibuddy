//#region ../../packages/workbuddy-server/src/session/task-status.ts
function createInitialTaskState(sessionId, createdAt) {
	return {
		sessionId,
		runState: "idle",
		executionStage: null,
		terminalOutcome: null,
		lastTransitionAt: createdAt,
		turnSeq: 0
	};
}
function deriveTaskStatus(state) {
	if (state.archivedAt) return "archived";
	if (state.runState === "awaiting_input") return "pending";
	if (state.runState === "running" && state.executionStage === "planning") return "planning";
	if (state.runState === "running") return "working";
	if (state.runState === "terminated" || state.terminalOutcome === "terminated") return "terminated";
	if (state.runState === "errored" || state.terminalOutcome === "error") return "error";
	if (state.terminalOutcome === "failed") return "failed";
	if (state.terminalOutcome === "completed") return "completed";
	return state.turnSeq === 0 ? "pending" : "completed";
}
function isTaskTerminal(state) {
	return state.terminalOutcome !== null || state.runState === "errored" || state.runState === "terminated";
}
/**
* status 字段视角的终态判定（基于 `deriveTaskStatus` 的输出）。
*
* 与 `isTaskTerminal(state)` 区别：
* - `isTaskTerminal` 接受底层 `SessionTaskState`,内部读 terminalOutcome / runState
* - `isTerminalTaskStatus` 接受 deriveTaskStatus 已 derive 的 `TaskStatus` 字符串
*
* 用于 hydrate / synthetic PromptResponse 派发等只能拿到 `SessionInfo.status`
* 字段(已 derive)的场景。两个判定在语义上等价。
*
* 终态：
* - `completed`：正常完结
* - `failed` / `error`：错误终结
* - `terminated`：被外部终止(用户取消、系统 kill)
* - `archived`：归档(也是终态,UI 不再展示活跃状态)
*
* 非终态：
* - `planning` / `working`：执行中
* - `pending`：等待输入(包括从未发消息的新会话和 awaiting_input 中间态)
*   注意:pending 不是终态,见 `feedback_pending_is_not_idle.md`
*/
function isTerminalTaskStatus(status) {
	return status === "completed" || status === "failed" || status === "error" || status === "terminated" || status === "archived";
}
function reduceTaskStatus(state, signal) {
	const at = signal.timestamp ?? Date.now();
	if ((signal.type === "awaiting_input" || signal.type === "input_resolved") && isTaskTerminal(state)) return state;
	switch (signal.type) {
		case "turn_started": return {
			...state,
			runState: "running",
			executionStage: "planning",
			terminalOutcome: null,
			pendingInputKind: void 0,
			lastTransitionAt: at,
			lastActivityAt: at,
			turnSeq: state.turnSeq + 1,
			terminationReason: void 0
		};
		case "planning_started": return {
			...state,
			runState: "running",
			executionStage: "planning",
			terminalOutcome: null,
			pendingInputKind: void 0,
			lastTransitionAt: at
		};
		case "working_started": return {
			...state,
			runState: "running",
			executionStage: "working",
			terminalOutcome: null,
			pendingInputKind: void 0,
			lastTransitionAt: at
		};
		case "awaiting_input": return {
			...state,
			runState: "awaiting_input",
			pendingInputKind: signal.kind,
			lastTransitionAt: at,
			lastActivityAt: at
		};
		case "input_resolved":
			if (state.terminalOutcome !== null) return {
				...state,
				pendingInputKind: void 0,
				lastTransitionAt: at
			};
			return {
				...state,
				runState: "running",
				executionStage: state.executionStage ?? "working",
				pendingInputKind: void 0,
				lastTransitionAt: at
			};
		case "turn_completed": return {
			...state,
			runState: "idle",
			executionStage: null,
			terminalOutcome: "completed",
			pendingInputKind: void 0,
			lastTransitionAt: at,
			lastActivityAt: at
		};
		case "turn_failed": return {
			...state,
			runState: "idle",
			executionStage: null,
			terminalOutcome: "failed",
			pendingInputKind: void 0,
			lastTransitionAt: at
		};
		case "runtime_errored": return {
			...state,
			runState: "errored",
			executionStage: null,
			terminalOutcome: "error",
			pendingInputKind: void 0,
			lastTransitionAt: at
		};
		case "runtime_terminated": return {
			...state,
			runState: "terminated",
			executionStage: null,
			terminalOutcome: "terminated",
			pendingInputKind: void 0,
			lastTransitionAt: at,
			terminationReason: signal.reason
		};
		default: return state;
	}
}
function normalizeTaskStatus(rawStatus) {
	switch (rawStatus?.trim().toLowerCase().replace(/[\s-]+/g, "_")) {
		case "planning":
		case "preparing":
		case "connecting": return "planning";
		case "working":
		case "running":
		case "tool_start":
		case "tool_end":
		case "handoff":
		case "summarizing":
		case "waiting_team_members":
		case "model_requesting":
		case "model_streaming":
		case "model_done":
		case "tool_executing": return "working";
		case "pending":
		case "idle":
		case "await_input":
		case "awaitinput":
		case "waiting_input":
		case "waiting_user_input":
		case "connected": return "pending";
		case "completed":
		case "cancelled":
		case "canceled":
		case "done": return "completed";
		case "failed": return "failed";
		case "error": return "error";
		case "terminated": return "terminated";
		case "archived": return "archived";
		default: return "pending";
	}
}
function applyManualTaskStatus(state, status, timestamp = Date.now()) {
	if (status === "archived") return {
		...state,
		archivedAt: timestamp,
		lastTransitionAt: timestamp
	};
	const base = {
		...state,
		archivedAt: void 0,
		lastTransitionAt: timestamp
	};
	switch (status) {
		case "planning": return {
			...base,
			runState: "running",
			executionStage: "planning",
			terminalOutcome: null,
			pendingInputKind: void 0,
			turnSeq: Math.max(base.turnSeq, 1)
		};
		case "working": return {
			...base,
			runState: "running",
			executionStage: "working",
			terminalOutcome: null,
			pendingInputKind: void 0,
			turnSeq: Math.max(base.turnSeq, 1)
		};
		case "pending": return {
			...base,
			runState: "awaiting_input",
			executionStage: null,
			terminalOutcome: null,
			pendingInputKind: "user_input"
		};
		case "completed": return {
			...base,
			runState: "idle",
			executionStage: null,
			terminalOutcome: "completed",
			pendingInputKind: void 0,
			turnSeq: Math.max(base.turnSeq, 1)
		};
		case "failed": return {
			...base,
			runState: "idle",
			executionStage: null,
			terminalOutcome: "failed",
			pendingInputKind: void 0,
			turnSeq: Math.max(base.turnSeq, 1)
		};
		case "error": return {
			...base,
			runState: "errored",
			executionStage: null,
			terminalOutcome: "error",
			pendingInputKind: void 0,
			turnSeq: Math.max(base.turnSeq, 1)
		};
		case "terminated": return {
			...base,
			runState: "terminated",
			executionStage: null,
			terminalOutcome: "terminated",
			pendingInputKind: void 0,
			turnSeq: Math.max(base.turnSeq, 1)
		};
		default: return base;
	}
}
function restoreTaskStateFromStoredStatus(sessionId, createdAt, rawStatus, options) {
	const initial = createInitialTaskState(sessionId, createdAt);
	const normalized = normalizeTaskStatus(rawStatus);
	const onDecision = options?.onDecision;
	if (normalized === "archived" || normalized === "completed" || normalized === "failed" || normalized === "error" || normalized === "terminated") {
		onDecision?.({
			decision: "terminal-preserved",
			sessionId,
			rawStatus,
			normalized
		});
		return applyManualTaskStatus(initial, normalized, createdAt);
	}
	if (normalized === "planning" || normalized === "working") {
		const updatedAt = options?.updatedAt;
		const threshold = options?.staleThresholdMs ?? 18e5;
		const now = options?.now?.() ?? Date.now();
		if (typeof updatedAt === "number" && now - updatedAt > threshold) {
			onDecision?.({
				decision: "stale-inflight-to-terminated",
				sessionId,
				rawStatus,
				normalized,
				updatedAt,
				now,
				ageMs: now - updatedAt
			});
			return applyManualTaskStatus(initial, "terminated", updatedAt);
		}
		onDecision?.({
			decision: "fallback-to-initial",
			sessionId,
			rawStatus,
			normalized,
			updatedAt,
			now
		});
		return initial;
	}
	onDecision?.({
		decision: "fallback-to-initial",
		sessionId,
		rawStatus,
		normalized
	});
	return initial;
}
//#endregion
Object.defineProperty(exports, "applyManualTaskStatus", {
	enumerable: true,
	get: function() {
		return applyManualTaskStatus;
	}
});
Object.defineProperty(exports, "deriveTaskStatus", {
	enumerable: true,
	get: function() {
		return deriveTaskStatus;
	}
});
Object.defineProperty(exports, "isTaskTerminal", {
	enumerable: true,
	get: function() {
		return isTaskTerminal;
	}
});
Object.defineProperty(exports, "isTerminalTaskStatus", {
	enumerable: true,
	get: function() {
		return isTerminalTaskStatus;
	}
});
Object.defineProperty(exports, "normalizeTaskStatus", {
	enumerable: true,
	get: function() {
		return normalizeTaskStatus;
	}
});
Object.defineProperty(exports, "reduceTaskStatus", {
	enumerable: true,
	get: function() {
		return reduceTaskStatus;
	}
});
Object.defineProperty(exports, "restoreTaskStateFromStoredStatus", {
	enumerable: true,
	get: function() {
		return restoreTaskStateFromStoredStatus;
	}
});
