const require_chunk = require("./chunk.js");
const require_src$1 = require("./src.js");
const require_workbuddy_product_config = require("./workbuddy-product-config.js");
const require_workbuddy_paths = require("./workbuddy-paths.js");
const require_process_role = require("./process-role.js");
const require_persistent_log_writer = require("./persistent-log-writer.js");
let os = require("os");
os = require_chunk.__toESM(os);
let node_path = require("node:path");
//#region src/main/system/logging/logger.ts
/**
* Structured logging for the main process.
*
* Based on craft-agents-oss pattern:
* - Debug mode: JSON file + readable console
* - Production: file log only
*
* 两套独立日志：
* - main.log  主进程自身（scope: main/session/handler/window/sidecar/rpc）
* - renderer.log  渲染进程转发的 console.*
* 各自 5MB 轮转（到达上限把旧文件重命名为 *.old.log），
* 以免 renderer 的高频日志把主进程日志挤掉。
* 落盘走 PersistentLogWriter：常开 append fd + 异步 fs.write，禁止每条 writeFileSync(flag:a)。
*/
var import_src = /* @__PURE__ */ require_chunk.__toESM(require_src$1.require_src());
require_workbuddy_paths.init_workbuddy_paths();
require_workbuddy_product_config.init_workbuddy_product_config();
var IS_VITEST_PROCESS = Boolean(process.env.VITEST || process.env.VITEST_WORKER_ID);
if (IS_VITEST_PROCESS) {
	import_src.default.transports.file.level = false;
	import_src.default.transports.console.level = false;
	if (import_src.default.transports.ipc) import_src.default.transports.ipc.level = false;
}
var MAIN_LOG_MAX_SIZE = 5 * 1024 * 1024;
var RENDERER_LOG_MAX_SIZE = 5 * 1024 * 1024;
var RENDERER_FLUSH_INTERVAL_MS = 1e3;
var RENDERER_FLUSH_BATCH_SIZE = 200;
var RENDERER_MAX_BUFFER_SIZE = 5e3;
var RENDERER_MAX_LINE_LENGTH = 4096;
var RENDERER_TRUNCATE_SUFFIX = "…[truncated]";
/**
* fs-protection 报告的日志目录（基于 product.json applicationName）。
* main.log / renderer.log 已改用 getWorkbuddyLogsDir()（~/.workbuddy/logs/），
* 此函数仅供 flush-fs-protection-report 使用。
*
* - macOS:   ~/Library/Logs/{applicationName}/
* - Windows: %LOCALAPPDATA%/{applicationName}/logs/
* - Linux:   ~/.config/{applicationName}/logs/
*/
function getElectronLogDir() {
	const applicationName = require_workbuddy_product_config.tryGetWorkbuddyBaseProductConfiguration()?.applicationName || "workbuddy";
	switch (process.platform) {
		case "darwin": return (0, node_path.join)(os.homedir(), "Library", "Logs", applicationName);
		case "win32": return (0, node_path.join)(process.env.LOCALAPPDATA || (0, node_path.join)(os.homedir(), "AppData", "Local"), applicationName, "logs");
		default: return (0, node_path.join)(os.homedir(), ".config", applicationName, "logs");
	}
}
function resolveDebugMode() {
	if (process.argv.includes("--debug")) return true;
	const packagedEnv = process.env.WORKBUDDY_IS_PACKAGED;
	if (packagedEnv === "true") return false;
	if (packagedEnv === "false") return true;
	if (typeof process.versions?.electron === "string") {
		if (process.defaultApp) return true;
		return false;
	}
	return true;
}
var isDebugMode = resolveDebugMode();
function formatJsonLine({ message }) {
	return [JSON.stringify({
		timestamp: message.date.toISOString(),
		level: message.level,
		scope: message.scope,
		message: message.data
	})];
}
function formatReadableLine({ message }) {
	const scope = message.scope ? `[${message.scope}]` : "";
	const level = message.level.toUpperCase().padEnd(5);
	const data = message.data.map((d) => typeof d === "object" ? JSON.stringify(d) : String(d)).join(" ");
	return [`${message.date.toISOString()} ${level} ${scope} ${data}`];
}
var FILE_SAMPLER_WINDOW_MS = 1e3;
var FILE_SAMPLER_MAX_PER_WINDOW = 5;
function fingerprintOf(message) {
	const scope = typeof message.scope === "string" ? message.scope : "";
	const head = message.data?.[0];
	const key = typeof head === "string" ? head : typeof head;
	return `${scope}\u0000${message.level}\u0000${key}`;
}
function attachFileSampler(logger) {
	const sampler = new require_persistent_log_writer.LogSampler({
		windowMs: FILE_SAMPLER_WINDOW_MS,
		maxPerWindow: FILE_SAMPLER_MAX_PER_WINDOW
	});
	logger.hooks.push((message, transport) => {
		if (transport !== logger.transports.file) return message;
		if (message.level === "error" || message.level === "warn") return message;
		const decision = sampler.admit(fingerprintOf(message));
		if (!decision.admit) return false;
		if (decision.suppressedSinceLast > 0) message.data = [...message.data, { suppressed: decision.suppressedSinceLast }];
		return message;
	});
}
function getElectronAppForLogger() {
	if (typeof process.versions?.electron !== "string") return;
	try {
		if (typeof require !== "function") return;
		return require("electron").app;
	} catch {
		return;
	}
}
var IS_DAEMON_PROCESS = require_process_role.isDaemonProcess();
var rendererLogger;
var mainFileWriter;
var rendererFileWriter;
if (!IS_DAEMON_PROCESS && !IS_VITEST_PROCESS) {
	import_src.default.transports.file.format = formatJsonLine;
	import_src.default.transports.file.maxSize = MAIN_LOG_MAX_SIZE;
	import_src.default.transports.file.resolvePathFn = () => (0, node_path.join)(require_workbuddy_paths.getWorkbuddyLogsDir(), "main.log");
	import_src.default.transports.file.level = "info";
	const fileLevelOverride = process.env.WORKBUDDY_LOG_FILE_LEVEL;
	if (fileLevelOverride) import_src.default.transports.file.level = fileLevelOverride;
	if (isDebugMode) {
		import_src.default.transports.console.format = formatReadableLine;
		import_src.default.transports.console.level = "debug";
	} else import_src.default.transports.console.level = false;
	if (import_src.default.transports.ipc) import_src.default.transports.ipc.level = false;
	attachFileSampler(import_src.default);
	mainFileWriter = require_persistent_log_writer.createPersistentLogWriter({
		filePath: (0, node_path.join)(require_workbuddy_paths.getWorkbuddyLogsDir(), "main.log"),
		maxSize: MAIN_LOG_MAX_SIZE
	});
	require_persistent_log_writer.installPersistentFileTransport(import_src.default, mainFileWriter);
}
if (!IS_DAEMON_PROCESS && !IS_VITEST_PROCESS) {
	rendererLogger = import_src.default.create({ logId: "renderer" });
	rendererLogger.transports.file.format = formatJsonLine;
	rendererLogger.transports.file.maxSize = RENDERER_LOG_MAX_SIZE;
	rendererLogger.transports.file.fileName = "renderer.log";
	rendererLogger.transports.file.level = isDebugMode ? "debug" : "info";
	rendererLogger.transports.console.level = false;
	rendererLogger.transports.file.resolvePathFn = (variables) => {
		const mainFile = import_src.default.transports.file.getFile?.();
		return (0, node_path.join)(mainFile ? (0, node_path.dirname)(mainFile.path) : variables.libraryDefaultDir ?? variables.userData ?? "", variables.fileName ?? "renderer.log");
	};
	if (rendererLogger.transports.ipc) rendererLogger.transports.ipc.level = false;
	attachFileSampler(rendererLogger);
	rendererFileWriter = require_persistent_log_writer.createPersistentLogWriter({
		filePath: (0, node_path.join)(require_workbuddy_paths.getWorkbuddyLogsDir(), "renderer.log"),
		maxSize: RENDERER_LOG_MAX_SIZE
	});
	require_persistent_log_writer.installPersistentFileTransport(rendererLogger, rendererFileWriter);
}
if (isDebugMode && !IS_DAEMON_PROCESS && !IS_VITEST_PROCESS) Object.assign(console, import_src.default.functions);
if (!IS_DAEMON_PROCESS && !IS_VITEST_PROCESS) import_src.default.errorHandler.startCatching({ showDialog: false });
var mainLog = import_src.default.scope("main");
import_src.default.scope("session");
var handlerLog = import_src.default.scope("handler");
var windowLog = import_src.default.scope("window");
import_src.default.scope("sidecar");
import_src.default.scope("rpc");
var rendererLog = rendererLogger?.scope("renderer");
function getLogFilePath() {
	return mainFileWriter?.path ?? import_src.default.transports.file.getFile?.()?.path;
}
var rendererBuffer = [];
var rendererFlushTimer = null;
var rendererShutdownHooked = false;
var rendererDroppedCount = 0;
function flushRendererBufferSync() {
	if (rendererBuffer.length === 0) return;
	if (!rendererLog) {
		rendererBuffer = [];
		rendererDroppedCount = 0;
		return;
	}
	const batch = rendererBuffer;
	rendererBuffer = [];
	if (rendererDroppedCount > 0) {
		const dropped = rendererDroppedCount;
		rendererDroppedCount = 0;
		batch.push({
			level: "warn",
			payload: `[renderer-buffer] dropped ${dropped} messages due to backpressure (buffer > ${RENDERER_MAX_BUFFER_SIZE})`
		});
	}
	for (const record of batch) try {
		rendererLog[record.level](record.payload);
	} catch {}
}
function installLogWriterShutdownHooks() {
	if (rendererShutdownHooked) return;
	rendererShutdownHooked = true;
	try {
		const electronApp = getElectronAppForLogger();
		const shutdownLogs = () => {
			flushRendererBufferSync();
			rendererFileWriter?.close().catch(() => void 0);
			mainFileWriter?.close().catch(() => void 0);
		};
		electronApp?.on("before-quit", shutdownLogs);
		electronApp?.on("will-quit", shutdownLogs);
	} catch {}
}
if (!IS_DAEMON_PROCESS && !IS_VITEST_PROCESS) installLogWriterShutdownHooks();
function ensureRendererFlushTimer() {
	if (rendererFlushTimer) return;
	rendererFlushTimer = setInterval(flushRendererBufferSync, RENDERER_FLUSH_INTERVAL_MS);
	rendererFlushTimer?.unref?.();
}
/**
* 将一条渲染进程转发的日志放入内存缓冲。定时器会在 ≤1s 内统一 flush；
* 若缓冲累计到 RENDERER_FLUSH_BATCH_SIZE，立即同步 flush。
* 缓冲超过 RENDERER_MAX_BUFFER_SIZE 时丢弃最老的记录防止内存失控。
* 单条超过 RENDERER_MAX_LINE_LENGTH 会被截断，防止超长堆栈 / base64 / 大 JSON
* 把缓冲和磁盘撑爆。
*
* 过滤 electron-log 的 "自我产物"：像 `(renderer) ›` 这样的前缀是 renderer 侧
* electron-log 在 DevTools console 里打印自身转发内容时的特征。即使我们已经关掉
* main → renderer 的 IPC 反向广播，仍然做一道字符串防线，避免未来依赖变更或
* 代码误配置重新触发循环（防御性编程）。
*/
function bufferRendererLog(level, payload) {
	if (!rendererLog) return;
	if (payload.includes("(renderer) ›") || payload.startsWith("[renderer] [renderer]")) return;
	if (isNoisyRendererPayload(payload)) return;
	ensureRendererFlushTimer();
	let text = payload;
	if (text.length > RENDERER_MAX_LINE_LENGTH) {
		const originalLength = text.length;
		text = text.slice(0, RENDERER_MAX_LINE_LENGTH - 12) + RENDERER_TRUNCATE_SUFFIX + ` (original ${originalLength} chars)`;
	}
	if (rendererBuffer.length >= RENDERER_MAX_BUFFER_SIZE) {
		rendererBuffer.shift();
		rendererDroppedCount++;
	}
	rendererBuffer.push({
		level,
		payload: text
	});
	if (rendererBuffer.length >= RENDERER_FLUSH_BATCH_SIZE) flushRendererBufferSync();
}
function isNoisyRendererPayload(payload) {
	return [
		"[ArtifactContentRenderer] current artifact:",
		"[ArtifactContentRenderer] matched branch:",
		"[SystemPermissions] 当前状态:",
		"[ActivityBanner]",
		"[TaskStarter:",
		"[resolveModel]",
		"[useClawSessionManagement]",
		"[clear context]",
		"[InputDraft]",
		"[EXPERT_HISTORY_TRACE]",
		"[MainContentCore][Expert]",
		"[ArtifactsManager]",
		"[Message] new message added to currentConversation:",
		"[Message] render messages:",
		"[Message] ⚠️ MESSAGE OVERWRITTEN (same ID):",
		"[WorkbuddyAdapter] checkPathExists result:",
		"[WorkbuddyAdapter] listDirectory",
		"[useFileTreeManager]",
		"(queue-diag) ›",
		"(transcript-diag) ›",
		"editingIndex ",
		"isEditingTitle"
	].some((pattern) => payload.includes(pattern));
}
var logger_default = import_src.default;
//#endregion
Object.defineProperty(exports, "bufferRendererLog", {
	enumerable: true,
	get: function() {
		return bufferRendererLog;
	}
});
Object.defineProperty(exports, "getElectronLogDir", {
	enumerable: true,
	get: function() {
		return getElectronLogDir;
	}
});
Object.defineProperty(exports, "getLogFilePath", {
	enumerable: true,
	get: function() {
		return getLogFilePath;
	}
});
Object.defineProperty(exports, "handlerLog", {
	enumerable: true,
	get: function() {
		return handlerLog;
	}
});
Object.defineProperty(exports, "isDebugMode", {
	enumerable: true,
	get: function() {
		return isDebugMode;
	}
});
Object.defineProperty(exports, "logger_default", {
	enumerable: true,
	get: function() {
		return logger_default;
	}
});
Object.defineProperty(exports, "mainLog", {
	enumerable: true,
	get: function() {
		return mainLog;
	}
});
Object.defineProperty(exports, "windowLog", {
	enumerable: true,
	get: function() {
		return windowLog;
	}
});
