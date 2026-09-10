const require_chunk = require("./chunk.js");
const require_runtime_context = require("./runtime-context.js");
const require_startup_context = require("./startup-context.js");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
//#region ../../packages/workbuddy-server/src/perf/logger.ts
/**
* Performance Logger
*
* Records performance marks to JSONL files for tracing flow durations.
*
* This logger is the single writer for perf log files. Main/app-server callers
* and renderer callers via RPC relay write through this module.
*/
var PerfFlow = {
	CONVERSATION_LIST: "conversation-list",
	SESSION_CREATION: "session-creation",
	CONVERSATION_TTFT: "conversation-ttft",
	SESSION_LOAD: "session-load",
	STARTUP: "startup"
};
var SDK_PERF_FLOWS = new Set([
	PerfFlow.CONVERSATION_LIST,
	PerfFlow.SESSION_CREATION,
	PerfFlow.CONVERSATION_TTFT,
	PerfFlow.SESSION_LOAD
]);
var DISABLED_PERF_FLOWS = new Set([PerfFlow.CONVERSATION_LIST]);
var WORKBUDDY_SDK_PERF_JSONL_ENABLED_ENV = "WORKBUDDY_SDK_PERF_JSONL_ENABLED";
function isSdkPerfFlow(flowType) {
	return SDK_PERF_FLOWS.has(flowType);
}
function isPerfFlowDisabled(flowType) {
	return DISABLED_PERF_FLOWS.has(flowType);
}
/** Conversation SDK 性能 JSONL 默认关闭，仅显式设置为 true/1/on/yes 时落盘。 */
function isSdkPerfJsonlEnabled() {
	const value = process.env[WORKBUDDY_SDK_PERF_JSONL_ENABLED_ENV]?.trim().toLowerCase();
	return value === "1" || value === "true" || value === "on" || value === "yes";
}
function formatDate(date) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
var WorkbuddyPerfLogger = class {
	constructor(flowType, traceId) {
		this.marks = [];
		this.phaseStartTimes = /* @__PURE__ */ new Map();
		this.summaryWritten = false;
		this.flowType = flowType;
		this.traceId = traceId;
		this.startTime = performance.now();
		this.lastMarkTime = this.startTime;
		this.startupCtx = flowType === PerfFlow.STARTUP ? require_startup_context.getStartupContext() : void 0;
		this.rawJsonLines = isSdkPerfFlow(flowType);
		this.logFilePath = this.resolveLogFilePath(flowType, this.startupCtx);
	}
	/**
	* 解析落盘路径。
	* - startup flow 且 context 就位：`logs/startup/<date>/<pid>-<time>.jsonl`
	*   —— **一次启动一个文件**（pid=main pid 天然隔离不同启动，time=HHmmss 便于人读/排序）。
	*   各进程（main 直写、daemon 直写、preload/renderer relay 到 daemon）都 append 到这同一个
	*   文件；每行自带 `proc`/`source` 字段区分来源，聚合按行内字段归类（见 startup-perf-aggregator）。
	*   pid/time 均取自跨进程一致的 StartupContext，保证四进程落到同一文件。
	*   跨进程并发 append 在本地 FS 上按行原子（每条 mark 一次 write），不会串行/损坏。
	* - conversation-list：性能打点已停用，不落本地文件。
	* - 其余 Conversation SDK flows：`logs/<YYYY-MM-DD>/sdk/perf/<YYYY-MM-DD>.jsonl`，
	*   所有 flow/trace 共享每日单文件，具体链路由每行的 flowType/traceId 区分。
	* - 其余（非 startup / context 未就位）：沿用 `logs/perf/<flowType>-<ts>.jsonl` 扁平命名。
	*/
	resolveLogFilePath(flowType, ctx) {
		if (ctx) {
			const dir = require_runtime_context.getWorkbuddyRuntimeLogsDir("startup", ctx.date);
			this.ensureDir(dir);
			return node_path.join(dir, `${ctx.pid}-${ctx.time}.jsonl`);
		}
		if (isPerfFlowDisabled(flowType)) return "";
		if (isSdkPerfFlow(flowType)) return this.resolveSdkPerfLogFilePath();
		const logDir = require_runtime_context.getWorkbuddyRuntimeLogsDir("perf");
		this.ensureDir(logDir);
		const ts = this.formatTimestamp(/* @__PURE__ */ new Date());
		return node_path.join(logDir, `${flowType}-${ts}.jsonl`);
	}
	/**
	* Get the log file path (used by renderer RPC relay to write to the same file)
	*/
	getLogFilePath() {
		if (isPerfFlowDisabled(this.flowType)) return "";
		return this.rawJsonLines ? this.resolveSdkPerfLogFilePath() : this.logFilePath;
	}
	/** Release this logger from the registry without writing a synthetic summary. */
	release() {
		releaseWorkbuddyPerfLogger(this.flowType, this.traceId);
	}
	/**
	* Record a performance mark
	*/
	mark(phase, data) {
		const now = performance.now();
		const epochMs = Date.now();
		const elapsed = now - this.startTime;
		const delta = now - this.lastMarkTime;
		this.lastMarkTime = now;
		const mark = {
			timestamp: now,
			epochMs,
			phase,
			elapsed: Math.round(elapsed * 100) / 100,
			delta: Math.round(delta * 100) / 100,
			source: this.startupCtx?.proc ?? "main",
			...this.startupCtx ? {
				pid: this.startupCtx.pid,
				proc: this.startupCtx.proc,
				timeOrigin: this.startupCtx.timeOrigin
			} : {},
			...data ? { data } : {}
		};
		this.marks.push(mark);
		this.appendLine(JSON.stringify({
			_type: "mark",
			...mark
		}));
	}
	/**
	* 记录一条「绝对时刻」mark：只带 `epochMs`（墙上时钟），**不带 timestamp/elapsed/delta**。
	*
	* 用于表达一个**过去的、已知 epoch 的时刻**（如进程创建 `process.getCreationTime()`），
	* 它不是"现在采样"的 (performance.now, Date.now) 对，因此若按普通 mark 写会污染对齐/段耗时：
	* - 不带 `timestamp` → 聚合器 `computeClockOffsets` 跳过它（不污染本进程 offset 中位数），
	*   `markAbsEpoch` 直接用它的 `epochMs` 作为绝对时间轴坐标；
	* - 不带 `elapsed` → 聚合器段内 max-min 跳过它（不扭曲段时长）；
	* - 不 push 进 `this.marks`（本进程 summary 用 timestamp 算，A0 无 timestamp 不参与）。
	*
	* 全程吞异常——绝不阻塞启动。
	*/
	markAbsolute(phase, epochMs, data) {
		const mark = {
			_type: "mark",
			epochMs,
			phase,
			source: this.startupCtx?.proc ?? "main",
			...this.startupCtx ? {
				pid: this.startupCtx.pid,
				proc: this.startupCtx.proc,
				timeOrigin: this.startupCtx.timeOrigin
			} : {},
			...data ? { data } : {}
		};
		this.appendLine(JSON.stringify(mark));
	}
	/**
	* Mark phase start
	*/
	startPhase(phaseName) {
		this.phaseStartTimes.set(phaseName, performance.now());
		this.mark(`${phaseName}_start`);
	}
	/**
	* Mark phase end, returns duration in ms
	*/
	endPhase(phaseName) {
		const start = this.phaseStartTimes.get(phaseName) ?? this.startTime;
		const duration = performance.now() - start;
		this.mark(`${phaseName}_end`, { durationMs: Math.round(duration) });
		this.phaseStartTimes.delete(phaseName);
		return duration;
	}
	/**
	* Append a raw JSONL line from renderer (RPC relay)
	*/
	appendRendererLine(jsonLine) {
		this.appendLine(jsonLine.trimEnd());
	}
	/**
	* Write summary and finalize the log file
	*/
	flush() {
		if (this.summaryWritten) return;
		const summary = this.getSummary();
		this.appendLine(JSON.stringify({
			_type: "summary",
			...summary
		}));
		this.summaryWritten = true;
	}
	getSummary() {
		const phases = {};
		const starts = /* @__PURE__ */ new Map();
		for (const m of this.marks) if (m.phase.endsWith("_start")) {
			const name = m.phase.slice(0, -6);
			starts.set(name, {
				time: m.timestamp,
				count: (starts.get(name)?.count ?? 0) + 1
			});
		} else if (m.phase.endsWith("_end")) {
			const name = m.phase.slice(0, -4);
			const s = starts.get(name);
			if (s) phases[name] = {
				durationMs: m.data?.durationMs ?? Math.round(m.timestamp - s.time),
				markCount: s.count + 1
			};
		}
		return {
			flowType: this.flowType,
			...this.traceId ? { traceId: this.traceId } : {},
			totalDurationMs: Math.round(performance.now() - this.startTime),
			totalMarks: this.marks.length,
			phases
		};
	}
	appendLine(line) {
		if (isPerfFlowDisabled(this.flowType)) return;
		if (this.rawJsonLines && !isSdkPerfJsonlEnabled()) return;
		try {
			const payload = this.rawJsonLines ? line : `[${(/* @__PURE__ */ new Date()).toISOString()}] ${line}`;
			const logFilePath = this.getLogFilePath();
			this.ensureDir(node_path.dirname(logFilePath));
			node_fs.appendFileSync(logFilePath, `${payload}\n`, "utf-8");
		} catch {}
	}
	resolveSdkPerfLogFilePath() {
		const date = formatDate(/* @__PURE__ */ new Date());
		return node_path.join(require_runtime_context.getWorkbuddyRuntimeLogsDir(date, "sdk", "perf"), `${date}.jsonl`);
	}
	ensureDir(dir) {
		try {
			if (!node_fs.existsSync(dir)) node_fs.mkdirSync(dir, { recursive: true });
		} catch {}
	}
	formatTimestamp(date) {
		const pad = (n) => String(n).padStart(2, "0");
		return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
	}
};
var perfLoggers = /* @__PURE__ */ new Map();
function perfLoggerKey(flowType, traceId) {
	return traceId ? `${flowType}:${traceId}` : String(flowType);
}
/**
* Get or create a perf logger for a specific flow type.
* Same flowType + traceId always returns the same instance.
*/
function getWorkbuddyPerfLogger(flowType, traceId) {
	const key = perfLoggerKey(flowType, traceId);
	if (!perfLoggers.has(key)) perfLoggers.set(key, new WorkbuddyPerfLogger(String(flowType), traceId));
	return perfLoggers.get(key);
}
/**
* Remove a logger without writing a summary. Use for raw per-trace SDK JSONL
* where each mark line already carries complete timing data.
*/
function releaseWorkbuddyPerfLogger(flowType, traceId) {
	perfLoggers.delete(perfLoggerKey(flowType, traceId));
}
/**
* 清理超过 keepDays 天的 startup 遥测日期目录（`logs/startup/<YYYY-MM-DD>/`）。
*
* 按**目录名日期**判定，不依赖 mtime——删整天目录连同其下所有 pid 分片。
* 只在 main 进程启动早期调一次即可（子进程不必重复）。全程吞异常，绝不阻塞启动。
*/
function cleanupOldStartupLogs(keepDays = 5) {
	try {
		const root = require_runtime_context.getWorkbuddyRuntimeLogsDir("startup");
		if (!node_fs.existsSync(root)) return;
		const cutoff = Date.now() - keepDays * 864e5;
		for (const dayDir of node_fs.readdirSync(root)) {
			const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayDir);
			if (!m) continue;
			const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
			if (Number.isFinite(t) && t < cutoff) node_fs.rmSync(node_path.join(root, dayDir), {
				recursive: true,
				force: true
			});
		}
	} catch {}
}
//#endregion
Object.defineProperty(exports, "PerfFlow", {
	enumerable: true,
	get: function() {
		return PerfFlow;
	}
});
Object.defineProperty(exports, "cleanupOldStartupLogs", {
	enumerable: true,
	get: function() {
		return cleanupOldStartupLogs;
	}
});
Object.defineProperty(exports, "getWorkbuddyPerfLogger", {
	enumerable: true,
	get: function() {
		return getWorkbuddyPerfLogger;
	}
});
Object.defineProperty(exports, "isSdkPerfFlow", {
	enumerable: true,
	get: function() {
		return isSdkPerfFlow;
	}
});
