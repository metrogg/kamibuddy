const require_chunk = require("./chunk.js");
const require_src$1 = require("./src.js");
const require_workbuddy_product_config = require("./workbuddy-product-config.js");
const require_logger = require("./logger2.js");
const require_runtime_context = require("./runtime-context.js");
const require_archive_artifact_sweep = require("./archive-artifact-sweep.js");
let path = require("path");
path = require_chunk.__toESM(path);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_os = require("node:os");
node_os = require_chunk.__toESM(node_os);
let node_worker_threads = require("node:worker_threads");
//#region ../../packages/workbuddy-server/src/perf/marks.ts
/**
* Startup Performance Marks — 单一真相 schema
*
* 定义桌面端首屏启动链路的 64 个标准打点，按 6 个 Phase 分组：
*   A 进程启动     （process spawn → app.whenReady）         A0~A9
*   B bootstrap   （平台/DB/daemon 桥接/wsRpc/后台服务）      B1~B15
*   C 窗口创建     （WindowManager → BrowserWindow → show）   C1~C7
*   D preload     （preload 注入 → __bootstrap → RPC 就绪）   D1~D5
*   E renderer    （renderer 加载 → adapter 就绪 → 首屏可交互）E1~E8
*   F daemon      （daemon 子进程 + main 观测 daemon RPC）    F1~F19（与 C/D/E 并行）
*
* A/B/C 段在主进程打点（index.ts + main-bootstrap.ts + window-manager.ts），
* D 段在 preload、E 段在 renderer，经 daemon perf RPC（perf:appendLine，
* flowType='startup'）写入同一条 startup JSONL。main 侧拿到 logFilePath 后重新聚合，
* 再输出 summary / per-mark log / metric / trace。
*
* ⚠️ 这是双端共享的单一真相（main / preload / renderer 都从这里取 id/phase/key）。
* 放在 workbuddy-server/perf 是因为它是 perf logger 基建所在地，且 desktop 与
* workbuddy-app 都依赖 workbuddy-server（依赖方向干净，避免 app 反向依赖 desktop）。
*
* 节点 id / phase 归属以本表为准，调用方一律引用这里的常量，不写裸字符串。
* schema 共建：jshzhang × zochen × stanwei × dicky。
*/
/** Phase 分组标识（与 summary 里的 phase key 对齐）。 */
var PerfPhase = {
	A: "A_process",
	B: "B_bootstrap",
	C: "C_window",
	D: "D_preload",
	E: "E_renderer",
	F: "F_daemon"
};
var STARTUP_MARKS = {
	A0: {
		id: "A0",
		phase: PerfPhase.A,
		key: "process_created"
	},
	A1: {
		id: "A1",
		phase: PerfPhase.A,
		key: "process_started"
	},
	A2: {
		id: "A2",
		phase: PerfPhase.A,
		key: "imports_completed"
	},
	A3: {
		id: "A3",
		phase: PerfPhase.A,
		key: "bundled_assets_root_set"
	},
	A4: {
		id: "A4",
		phase: PerfPhase.A,
		key: "logger_configured"
	},
	A5: {
		id: "A5",
		phase: PerfPhase.A,
		key: "crash_writer_installed"
	},
	A6: {
		id: "A6",
		phase: PerfPhase.A,
		key: "shell_env_loaded"
	},
	A7: {
		id: "A7",
		phase: PerfPhase.A,
		key: "electron_app_configured"
	},
	A8: {
		id: "A8",
		phase: PerfPhase.A,
		key: "single_instance_locked"
	},
	A9: {
		id: "A9",
		phase: PerfPhase.A,
		key: "app_ready"
	},
	B1: {
		id: "B1",
		phase: PerfPhase.B,
		key: "bootstrap_entered"
	},
	B2: {
		id: "B2",
		phase: PerfPhase.B,
		key: "platform_created"
	},
	B3: {
		id: "B3",
		phase: PerfPhase.B,
		key: "celljs_container_ready"
	},
	B4: {
		id: "B4",
		phase: PerfPhase.B,
		key: "database_initialized"
	},
	B5: {
		id: "B5",
		phase: PerfPhase.B,
		key: "migration_context_ready"
	},
	B6: {
		id: "B6",
		phase: PerfPhase.B,
		key: "daemon_bridge_handlers_registered"
	},
	B7: {
		id: "B7",
		phase: PerfPhase.B,
		key: "daemon_env_ready"
	},
	B8: {
		id: "B8",
		phase: PerfPhase.B,
		key: "daemon_process_started"
	},
	B9: {
		id: "B9",
		phase: PerfPhase.B,
		key: "daemon_connection_created"
	},
	B10: {
		id: "B10",
		phase: PerfPhase.B,
		key: "renderer_migration_bridge_ready"
	},
	B11: {
		id: "B11",
		phase: PerfPhase.B,
		key: "daemon_event_bridges_registered"
	},
	B12: {
		id: "B12",
		phase: PerfPhase.B,
		key: "desktop_host_rpc_registered"
	},
	B13: {
		id: "B13",
		phase: PerfPhase.B,
		key: "wsrpc_ready"
	},
	B14: {
		id: "B14",
		phase: PerfPhase.B,
		key: "background_services_kicked"
	},
	B15: {
		id: "B15",
		phase: PerfPhase.B,
		key: "bootstrap_complete"
	},
	C1: {
		id: "C1",
		phase: PerfPhase.C,
		key: "window_manager_created"
	},
	C2: {
		id: "C2",
		phase: PerfPhase.C,
		key: "splash_shown"
	},
	C3: {
		id: "C3",
		phase: PerfPhase.C,
		key: "vendor_ensured"
	},
	C4: {
		id: "C4",
		phase: PerfPhase.C,
		key: "main_window_creating"
	},
	C5: {
		id: "C5",
		phase: PerfPhase.C,
		key: "main_window_created"
	},
	C6: {
		id: "C6",
		phase: PerfPhase.C,
		key: "browser_window_load_url"
	},
	C7: {
		id: "C7",
		phase: PerfPhase.C,
		key: "index_html_load"
	},
	D1: {
		id: "D1",
		phase: PerfPhase.D,
		key: "preload_start"
	},
	D2: {
		id: "D2",
		phase: PerfPhase.D,
		key: "preload_bootstrap_requested"
	},
	D3: {
		id: "D3",
		phase: PerfPhase.D,
		key: "preload_bootstrap_resolved"
	},
	D4: {
		id: "D4",
		phase: PerfPhase.D,
		key: "preload_rpc_connected"
	},
	D5: {
		id: "D5",
		phase: PerfPhase.D,
		key: "preload_exposed"
	},
	E1: {
		id: "E1",
		phase: PerfPhase.E,
		key: "renderer_nav_start"
	},
	E2: {
		id: "E2",
		phase: PerfPhase.E,
		key: "renderer_response_end"
	},
	E3: {
		id: "E3",
		phase: PerfPhase.E,
		key: "renderer_dom_interactive"
	},
	E4: {
		id: "E4",
		phase: PerfPhase.E,
		key: "renderer_web_first_paint"
	},
	E5: {
		id: "E5",
		phase: PerfPhase.E,
		key: "renderer_dom_content_loaded"
	},
	E6: {
		id: "E6",
		phase: PerfPhase.E,
		key: "renderer_script_start"
	},
	E7: {
		id: "E7",
		phase: PerfPhase.E,
		key: "renderer_dom_ready"
	},
	E8: {
		id: "E8",
		phase: PerfPhase.E,
		key: "renderer_react_mounted"
	},
	E9: {
		id: "E9",
		phase: PerfPhase.E,
		key: "renderer_adapter_init_start"
	},
	E10: {
		id: "E10",
		phase: PerfPhase.E,
		key: "renderer_first_paint"
	},
	E11: {
		id: "E11",
		phase: PerfPhase.E,
		key: "renderer_web_first_contentful_paint"
	},
	E12: {
		id: "E12",
		phase: PerfPhase.E,
		key: "renderer_adapter_connected"
	},
	E13: {
		id: "E13",
		phase: PerfPhase.E,
		key: "renderer_skeleton_gone"
	},
	E14: {
		id: "E14",
		phase: PerfPhase.E,
		key: "renderer_app_ready"
	},
	F1: {
		id: "F1",
		phase: PerfPhase.F,
		key: "daemon_started"
	},
	F2: {
		id: "F2",
		phase: PerfPhase.F,
		key: "daemon_db_ready"
	},
	F3: {
		id: "F3",
		phase: PerfPhase.F,
		key: "daemon_celljs_deps_resolved"
	},
	F4: {
		id: "F4",
		phase: PerfPhase.F,
		key: "daemon_tencent_docs_ready"
	},
	F5: {
		id: "F5",
		phase: PerfPhase.F,
		key: "daemon_migration_service_ready"
	},
	F6: {
		id: "F6",
		phase: PerfPhase.F,
		key: "daemon_sidecar_manager_ready"
	},
	F7: {
		id: "F7",
		phase: PerfPhase.F,
		key: "daemon_rpc_ready"
	},
	F8: {
		id: "F8",
		phase: PerfPhase.F,
		key: "daemon_domain_ready"
	},
	F9: {
		id: "F9",
		phase: PerfPhase.F,
		key: "daemon_ready"
	},
	F10: {
		id: "F10",
		phase: PerfPhase.F,
		key: "daemon_startup_migration_done"
	},
	F11: {
		id: "F11",
		phase: PerfPhase.F,
		key: "daemon_mcp_apps_host_ready"
	},
	F12: {
		id: "F12",
		phase: PerfPhase.F,
		key: "daemon_services_kicked"
	},
	F13: {
		id: "F13",
		phase: PerfPhase.F,
		key: "daemon_background_completed"
	},
	F14: {
		id: "F14",
		phase: PerfPhase.F,
		key: "daemon_state_refresh_started"
	},
	F15: {
		id: "F15",
		phase: PerfPhase.F,
		key: "daemon_auth_account_ready"
	},
	F16: {
		id: "F16",
		phase: PerfPhase.F,
		key: "daemon_auth_token_ready"
	},
	F17: {
		id: "F17",
		phase: PerfPhase.F,
		key: "daemon_config_request_sent"
	},
	F18: {
		id: "F18",
		phase: PerfPhase.F,
		key: "daemon_config_response_received"
	},
	F19: {
		id: "F19",
		phase: PerfPhase.F,
		key: "daemon_state_ready"
	}
};
//#endregion
//#region src/main/features/logs/app-startup-logger.ts
var import_src = /* @__PURE__ */ require_chunk.__toESM(require_src$1.require_src());
require_workbuddy_product_config.init_workbuddy_product_config();
var APP_STARTUP_LOG_ID = "appstartup";
var APP_STARTUP_LOG_FILE = "AppStartup.log";
var cachedLogger;
var userIdProvider;
/**
* 注入 userId provider。设计成 lazy 函数而非静态值，是因为：
* - 用户可能登出再登入，userId 会变；
* - 启动早期 auth 没就绪，注入时机和首次取值时机往往是分离的。
*
* 任意时刻只保留最后一次注入的 provider；传 `undefined` 视为撤销。
*/
function setUserIdProvider(provider) {
	userIdProvider = provider;
}
/**
* 把 Date 格式化成 ISO 8601 本地时间字符串，带时区偏移。
*
* 例：上海 2026-05-08 16:24:31.123 → `"2026-05-08T16:24:31.123+08:00"`
*
* 为何不用 `Date.prototype.toISOString()`：
*   `toISOString()` 永远输出 UTC（`...Z` 后缀），用户排查问题时还要心算时差。
*
* 为何不用 `Intl.DateTimeFormat` / `toLocaleString`：
*   它们的输出格式不严格符合 ISO 8601（分隔符、零填充、毫秒、时区写法都因
*   locale 而异），不利于解析和稳定 grep。
*
* 这里手动拼字段，保证：
*   - 严格 ISO 8601：`YYYY-MM-DDTHH:mm:ss.SSS±HH:MM`
*   - 始终零填充
*   - 时区偏移用 `±HH:MM`（不是 `±HHMM`），与 RFC 3339 兼容
*   - 半小时偏移地区（印度 +05:30、纽芬兰 -03:30）也能正确表达
*/
function formatLocalIsoTimestamp(date) {
	const pad = (n, width = 2) => String(n).padStart(width, "0");
	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	const hour = pad(date.getHours());
	const minute = pad(date.getMinutes());
	const second = pad(date.getSeconds());
	const ms = pad(date.getMilliseconds(), 3);
	const tzOffsetMinutes = -date.getTimezoneOffset();
	const sign = tzOffsetMinutes >= 0 ? "+" : "-";
	const absMinutes = Math.abs(tzOffsetMinutes);
	return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}${sign}${pad(Math.floor(absMinutes / 60))}:${pad(absMinutes % 60)}`;
}
function createAppStartupLogger() {
	const appStartupLog = import_src.default.create({ logId: APP_STARTUP_LOG_ID });
	appStartupLog.transports.file.fileName = APP_STARTUP_LOG_FILE;
	appStartupLog.transports.file.resolvePathFn = () => path.join(require_runtime_context.getWorkbuddyRuntimeLogsDir(), APP_STARTUP_LOG_FILE);
	appStartupLog.transports.file.maxSize = 5 * 1024 * 1024;
	appStartupLog.transports.file.format = ({ message }) => {
		const body = message.data.map((d) => typeof d === "string" ? d : String(d)).join(" ");
		return [`${formatLocalIsoTimestamp(message.date instanceof Date ? message.date : /* @__PURE__ */ new Date())} ${body}`];
	};
	appStartupLog.transports.console.level = false;
	if (appStartupLog.transports.ipc) appStartupLog.transports.ipc.level = false;
	if (appStartupLog.transports.remote) appStartupLog.transports.remote.level = false;
	return appStartupLog;
}
function getLogger() {
	if (!cachedLogger) cachedLogger = createAppStartupLogger();
	return cachedLogger;
}
function safe(fn) {
	try {
		return fn();
	} catch {
		return;
	}
}
/**
* 采集当前进程的环境字段。所有取值失败时返回 'unknown'，保证日志永远可打印。
*
* 每次调用都会重新跑一遍 provider —— uptime / userId 等会随时间变化的字段
* 必须实时取，不能缓存。
*/
function collectEnvFields() {
	const product = safe(() => require_workbuddy_product_config.tryGetWorkbuddyBaseProductConfiguration());
	const channel = product?.networkEnvironment ?? "unknown";
	const productConfigType = product?.platform ?? "unknown";
	let userId = "unknown";
	if (userIdProvider) {
		const got = safe(() => userIdProvider());
		if (got && got.length > 0) userId = got;
	}
	return {
		appName: safe(() => require_runtime_context.getWorkbuddyRuntimeAppName()) ?? "unknown",
		appVersion: safe(() => require_runtime_context.getWorkbuddyRuntimeAppVersion()) ?? "unknown",
		build: safe(() => require_workbuddy_product_config.tryGetWorkbuddyProductCommit()) ?? "unknown",
		platform: process.platform,
		arch: process.arch,
		electron: process.versions.electron ?? "unknown",
		node: process.versions.node ?? "unknown",
		chrome: process.versions.chrome ?? "unknown",
		channel,
		productConfigType,
		userId,
		uptimeSec: Math.floor(process.uptime())
	};
}
/**
* 将字段按插入顺序序列化成 `k=v k=v` 单行。
*
* 值里如果出现空格 / `=` 会破坏 grep，这里用一份保守的转义：
* - 出现 ` `、`=`、`"`、换行时，包一层双引号并把内部双引号转义为 `\"`。
* - 简单值原样输出。
*
* 不覆盖 JSON 全部转义规则——这里输出的目标是日志而非反序列化。
*/
function formatLine(tag, fields) {
	const parts = [`[${tag}]`];
	for (const [key, raw] of Object.entries(fields)) {
		const value = String(raw);
		const escaped = /[\s="\n\r]/.test(value) ? `"${value.replace(/"/g, "\\\"").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"` : value;
		parts.push(`${key}=${escaped}`);
	}
	return parts.join(" ");
}
/**
* 打一条生命周期日志。
*
* - `tag` 直接作为方括号内的标签（不要带 `[]`）；常见取值：
*   `AppStartup`、`AppShutdown`、`AuthReady`、`WindowFocus`、`WindowBlur`、
*   `WindowHide`、`SessionSwitch`、`MenuSwitch`。
* - `extra` 会与 `collectEnvFields()` 合并，**extra 优先**。需要在标准字段
*   之外补充上下文（例如关闭原因 / 目标会话 ID）时通过它传入。
*
* 所有异常吞掉，永不阻塞调用方。
*/
function logLifecycleEvent(tag, extra) {
	try {
		const line = formatLine(tag, {
			...collectEnvFields(),
			...extra ?? {}
		});
		getLogger().info(line);
	} catch {}
}
/** 启动时调用一次，写入 AppStartup.log。所有异常吞掉，绝不阻塞启动。 */
function logAppStartup() {
	logLifecycleEvent("AppStartup", { source: "app_startup" });
}
/**
* 把一次启动性能 summary 以 `[Perf]` 行并入 AppStartup.log（通道 B 落点）。
*
* 复用 `logLifecycleEvent('Perf', ...)`，因此自动带上 appVersion / build / platform /
* arch / userId / ISO 本地时间等环境字段，无需重复采集。
*
* 输出形如：
*   `2026-06-14T17:51:00.123+08:00 [Perf] appVersion=... userId=... startup_type=cold
*    total_ms=4210 total_marks=37 phase_A_process_ms=820 phase_B_bootstrap_ms=1823 ...`
*
* 各 phase 展开成 `phase_<name>_ms=<n>`，CI / grep 友好。所有异常吞掉。
*/
function logStartupPerf(summary) {
	try {
		const extra = {
			startup_type: summary.startupType,
			flow_type: summary.flowType,
			total_ms: summary.totalMs,
			...typeof summary.firstInteractiveMs === "number" ? { first_interactive_ms: summary.firstInteractiveMs } : {},
			total_marks: summary.totalMarks
		};
		for (const [phase, durationMs] of Object.entries(summary.phases)) extra[`phase_${phase}_ms`] = durationMs;
		logLifecycleEvent("Perf", extra);
	} catch {}
}
//#endregion
//#region src/main/features/logs/archive-request-dedupe.ts
/**
* 归档请求去重（#87127）。
*
* 用户在会话期间点「打开日志文件夹」时，CPU 被 agent 流式输出占着，
* 首次归档比空闲时慢；用户以为没反应就反复点，而每次点击都会
* 新起一个 worker 全内存压缩近百兆日志，彼此抢 CPU 和内存，
* 于是全部撞上 60s 超时 —— 越点越打不开。
*
* 实测同一台机器：单次点击 2s 完成，连点 3 次后三个 worker 全部超时。
*
* 这里做进程内去重：同一份归档请求正在进行时，后续调用直接复用
* 同一个 Promise，不再新起 worker。
*/
/** 正在进行的归档，key 由请求参数决定。 */
var inflight = /* @__PURE__ */ new Map();
/**
* 包装一次归档请求，相同 key 的并发调用共享同一个底层任务。
*
* @param key   请求指纹，参数不同的归档（如 todayOnly）不应互相复用。
* @param start 真正执行归档的函数，仅在没有同 key 任务时被调用。
*/
async function dedupeArchiveRequest(key, start) {
	const running = inflight.get(key);
	if (running) {
		require_logger.mainLog.info("[packageLogs] Reusing in-flight archive, skipping duplicate worker", { key });
		return running;
	}
	const task = start();
	inflight.set(key, task);
	try {
		return await task;
	} finally {
		inflight.delete(key);
	}
}
/** 当前是否有归档在进行，仅用于测试与观测。 */
function inflightArchiveCount() {
	return inflight.size;
}
//#endregion
//#region src/main/features/logs/archive-worker-tracker.ts
/**
* 归档 worker 的后台占用追踪（#87127）。
*
* worker 在交付 zip 之后不会立刻退出：还要跑 sweep 与过期日志回收。
* 这段时间它持续占用**进程级共享**的 libuv 线程池（默认 4 线程），
* 会拖慢紧随其后的下一次归档 —— 实测归档选材从 11ms 恶化到 2128ms（193x）。
*
* 这正是本 issue 的核心机制，但当时的埋点完全看不到：dedupe 只覆盖
* 「同一请求并发」，而「上一次已交付、worker 仍在后台清理」是另一回事。
* 因此单独记账，让每次归档的日志都能回答「我启动时有几个前序 worker
* 还在跑」。
*/
/** 仍未退出的 worker：交付时刻 → 是否已完成清理。 */
var liveWorkers = /* @__PURE__ */ new Map();
var nextWorkerId = 1;
/** 登记一个新启动的 worker，返回其 id。 */
function trackWorkerStart() {
	const id = nextWorkerId++;
	liveWorkers.set(id, {
		startedAt: Date.now(),
		cleanupDone: false
	});
	return id;
}
/** 标记该 worker 已交付 zip，但可能仍在后台清理。 */
function trackWorkerDelivered(id) {
	const entry = liveWorkers.get(id);
	if (entry) entry.deliveredAt = Date.now();
}
/** 标记该 worker 的清理已结束。 */
function trackWorkerCleanupDone(id) {
	const entry = liveWorkers.get(id);
	if (entry) entry.cleanupDone = true;
}
/** 该 worker 已退出，不再占用线程池。 */
function trackWorkerExit(id) {
	liveWorkers.delete(id);
}
/**
* 快照当前后台占用情况。
*
* @param excludeId 排除自己，只看「别人」对我的干扰。
*/
function snapshotBackgroundWorkers(excludeId) {
	const now = Date.now();
	let live = 0;
	let cleaningUp = 0;
	let oldestAgeMs = 0;
	for (const [id, entry] of liveWorkers) {
		if (id === excludeId) continue;
		live++;
		if (entry.deliveredAt !== void 0 && !entry.cleanupDone) cleaningUp++;
		oldestAgeMs = Math.max(oldestAgeMs, now - entry.startedAt);
	}
	return {
		live,
		cleaningUp,
		oldestAgeMs
	};
}
//#endregion
//#region src/main/features/logs/package-and-show-log.ts
require_workbuddy_product_config.init_workbuddy_product_config();
/** Default: only include logs from the last N days. 与 cleanupOldLogFiles 的保留窗口一致。 */
var MAX_LOG_AGE_DAYS = 3;
/**
* 小型反馈包维持 15s fail-fast；200MB 手工诊断包给 60s，并预留 10s 写盘。
* 两者都把绝对 deadline 传入 worker，避免线程创建耗时重新获得一整段预算。
*/
var SMALL_ARCHIVE_TIMEOUT_MS = 15 * 1e3;
var LARGE_ARCHIVE_TIMEOUT_MS = 60 * 1e3;
var SMALL_ARCHIVE_MAX_BYTES = 50 * 1024 * 1024;
var SMALL_ARCHIVE_RESERVE_MS = 2 * 1e3;
var LARGE_ARCHIVE_RESERVE_MS = 10 * 1e3;
/** 超过此耗时视为异常慢，日志带上完整阶段时间线。实测正常约 1.8s。 */
var SLOW_ARCHIVE_MS = 5 * 1e3;
function resolveArchiveTiming(maxTotalBytes) {
	return maxTotalBytes !== void 0 && maxTotalBytes <= SMALL_ARCHIVE_MAX_BYTES ? {
		timeoutMs: SMALL_ARCHIVE_TIMEOUT_MS,
		writeReserveMs: SMALL_ARCHIVE_RESERVE_MS
	} : {
		timeoutMs: LARGE_ARCHIVE_TIMEOUT_MS,
		writeReserveMs: LARGE_ARCHIVE_RESERVE_MS
	};
}
/**
* 清理超过此耗时就升级为 warn。
*
* 清理跑在 zip 交付之后，不影响本次用户体验，但 worker 要等它结束才退出，
* 期间占用共享线程池会拖慢**下一次**归档（实测 193x）。所以它慢本身就是
* 一个需要主动暴露的信号（#87127）。
*/
var SLOW_CLEANUP_MS = 3 * 1e3;
/** 唤起文件管理器超过此耗时就记一笔（Windows explorer.exe 冷启动可能很慢）。 */
var SLOW_REVEAL_MS = 1e3;
/**
* 日志压缩包的默认输出目录（#85453）。
*
* 背景：#77974 把 main.log 统一迁到 ~/.workbuddy/logs 后，zip 跟着
* `dirname(logsDir)` 落进了 ~/.workbuddy —— 那里还有 cache / session /
* skills 等大量杂项，用户视角「下载的文件杂乱」（旧引擎时 zip 在
* C:\Users\<user>\AppData\Local\WorkBuddy）。按 #85453 的结论：
* 日志聚合仍以 .workbuddy/logs 为准，但打包产物放回旧引擎时期的落点。
*
* 旧 zip 落点 = 旧 main.log 所在目录（即 {@link getElectronLogDir}）的
* 父目录 —— getElectronLogDir 在 win/linux 是 <用户目录>/logs 带一层
* logs 子目录，mac 是 ~/Library/Logs/<app> 不带，统一取父目录后：
* - Windows: %LOCALAPPDATA%\WorkBuddy
* - macOS:   ~/Library/Logs
* - Linux:   ~/.config/WorkBuddy
*
* 注意不能写成 dirname(join(getElectronLogDir(), 'main.log')) ——
* 拼上文件名再取 dirname 恒等于 getElectronLogDir() 本身，三个平台
* 都会多嵌一层（评审必改项）。
*/
function resolveArchiveOutputDir() {
	return node_path.dirname(require_logger.getElectronLogDir());
}
/**
* Resolve the worker script path.
*
* In development the TS source lives next to this file; after compilation
* the JS output is emitted to the same relative location under dist/.
*/
function resolveWorkerScript() {
	return node_path.join(__dirname, "package-log-worker.js");
}
/**
* Package log directories into a zip archive and return the archive path.
*
* The CPU-intensive staging + zip compression runs in a **worker thread** so
* the Electron main process stays responsive.
*
* Unlike {@link packageAndShowLog}, this helper does *not* reveal the file in
* the OS file manager — callers that want to attach the archive programmatically
* (e.g. the user-feedback submission path) can use this directly.
*
* @param logsDir  Primary logs directory (electron-log output).
* @param options  Extra directories, age window, or todayOnly flag. Per-PID CLI
*                 memwatch logs are always added as a protected default root.
* @returns        Absolute path to the produced zip archive.
*/
async function packageLogs(logsDir, options = {}) {
	if (!logsDir) throw new Error("[packageLogs] Logs directory is empty");
	const { extraLogDirs, maxAgeDays = MAX_LOG_AGE_DAYS, todayOnly = false, archiveOutputDir = resolveArchiveOutputDir(), maxTotalBytes } = options;
	const resolvedMaxTotalBytes = maxTotalBytes ?? (todayOnly ? SMALL_ARCHIVE_MAX_BYTES : void 0);
	const archiveExtraLogDirs = [...new Set([
		...extraLogDirs ?? [],
		node_path.join(node_os.homedir(), ".codebuddy", "logs", "memwatch"),
		node_path.join(node_os.homedir(), ".codebuddy", "diagnostics")
	])];
	return dedupeArchiveRequest(JSON.stringify([
		logsDir,
		archiveExtraLogDirs,
		maxAgeDays,
		todayOnly,
		resolvedMaxTotalBytes,
		archiveOutputDir
	]), () => runArchiveWorker(logsDir, {
		extraLogDirs: archiveExtraLogDirs,
		maxAgeDays,
		todayOnly,
		maxTotalBytes: resolvedMaxTotalBytes,
		archiveOutputDir
	}));
}
async function runArchiveWorker(logsDir, options) {
	const { extraLogDirs, maxAgeDays, todayOnly, archiveOutputDir, maxTotalBytes } = options;
	require_logger.mainLog.info("[packageLogs] Starting log archive in worker thread", {
		logsDir,
		extraLogDirs,
		maxAgeDays,
		todayOnly,
		archiveOutputDir,
		inflight: inflightArchiveCount()
	});
	const workerScript = resolveWorkerScript();
	const spawnStartedAt = Date.now();
	const backgroundAtStart = snapshotBackgroundWorkers();
	const workerId = trackWorkerStart();
	const archiveTiming = resolveArchiveTiming(maxTotalBytes);
	const archiveDeadlineMs = Date.now() + archiveTiming.timeoutMs;
	return new Promise((resolve, reject) => {
		const product = require_workbuddy_product_config.tryGetWorkbuddyBaseProductConfiguration();
		const archivePrefix = product?.applicationName || "workbuddy-desktop";
		const darwinBundleIdentifier = product?.darwinBundleIdentifier;
		const worker = new node_worker_threads.Worker(workerScript, { workerData: {
			logsDir,
			extraLogDirs,
			maxAgeDays,
			todayOnly,
			archiveOutputDir,
			maxTotalBytes,
			archivePrefix,
			darwinBundleIdentifier: typeof darwinBundleIdentifier === "string" ? darwinBundleIdentifier : void 0,
			executablePath: process.execPath,
			archiveTimeoutMs: archiveTiming.timeoutMs,
			archiveWriteReserveMs: archiveTiming.writeReserveMs,
			archiveDeadlineMs
		} });
		const constructMs = Date.now() - spawnStartedAt;
		let artifacts = {};
		const stages = [];
		let lastStage;
		const startedAt = Date.now();
		let onlineMs;
		worker.on("online", () => {
			onlineMs = Date.now() - spawnStartedAt;
		});
		const timer = setTimeout(() => {
			require_logger.mainLog.error("[packageLogs] Archive timed out, terminating worker", {
				logsDir,
				timeoutMs: archiveTiming.timeoutMs,
				lastStage: lastStage ?? "(worker never reported any stage)",
				stalledForMs: Date.now() - startedAt - (lastStage?.elapsedMs ?? 0),
				stages,
				constructMs,
				onlineMs: onlineMs ?? "(worker never came online)",
				workerScript,
				backgroundAtStart,
				receivedPaths: artifacts.tmpZipPath !== void 0,
				uvThreadpoolSize: process.env.UV_THREADPOOL_SIZE ?? "(default 4)"
			});
			worker.terminate().catch(() => void 0);
			require_archive_artifact_sweep.removeArchiveArtifacts(artifacts).catch(() => void 0);
			reject(/* @__PURE__ */ new Error(`Log archive timed out after ${archiveTiming.timeoutMs}ms`));
		}, Math.max(1, archiveDeadlineMs - Date.now()));
		timer.unref();
		worker.on("message", (msg) => {
			if (msg.phase === "paths") {
				artifacts = {
					tmpZipPath: msg.tmpZipPath,
					stagingDir: msg.stagingDir
				};
				return;
			}
			if (msg.phase === "stage") {
				const detail = { ...msg };
				delete detail.phase;
				delete detail.step;
				delete detail.elapsedMs;
				const elapsedMs = msg.elapsedMs ?? 0;
				lastStage = {
					step: msg.step ?? "unknown",
					elapsedMs,
					detail: Object.keys(detail).length > 0 ? detail : void 0
				};
				stages.push({
					...lastStage,
					deltaMs: elapsedMs - (stages[stages.length - 1]?.elapsedMs ?? 0)
				});
				return;
			}
			if (msg.phase === "cleanup") {
				trackWorkerCleanupDone(workerId);
				const cleanupTotalMs = (msg.sweepStaleMs ?? 0) + (msg.sweepZipsMs ?? 0) + (msg.cleanupLogsMs ?? 0);
				const payload = {
					cleanup: msg.cleanup,
					staleArtifacts: msg.staleArtifacts,
					sweepStaleMs: msg.sweepStaleMs,
					removedOldZips: msg.removedOldZips,
					sweepZipsMs: msg.sweepZipsMs,
					cleanupLogsMs: msg.cleanupLogsMs,
					archiveDir: msg.archiveDir,
					archiveDirFellBack: msg.archiveDirFellBack,
					misplacedDirSwept: msg.misplacedDirSwept,
					workerElapsedMs: msg.elapsedMs
				};
				if (msg.archiveDirFellBack) {
					require_logger.mainLog.warn("[packageLogs] Archive output dir fell back to logs parent dir; misplaced-dir full sweep skipped", payload);
					return;
				}
				if (cleanupTotalMs >= SLOW_CLEANUP_MS) require_logger.mainLog.warn("[packageLogs] Old logs reclaimed, but cleanup was slow", payload);
				else require_logger.mainLog.info("[packageLogs] Old logs reclaimed", payload);
				return;
			}
			clearTimeout(timer);
			if (msg.ok && msg.zipPath) {
				const elapsedMs = Date.now() - startedAt;
				trackWorkerDelivered(workerId);
				require_logger.mainLog.info("[packageLogs] Archive completed", {
					zipPath: msg.zipPath,
					summary: msg.summary,
					elapsedMs,
					constructMs,
					onlineMs,
					lastStage,
					backgroundAtStart,
					stages: elapsedMs >= SLOW_ARCHIVE_MS ? stages : void 0
				});
				resolve(msg.zipPath);
			} else {
				require_logger.mainLog.error("[packageLogs] Archive failed", {
					error: msg.error,
					constructMs,
					onlineMs,
					backgroundAtStart,
					stages
				});
				require_archive_artifact_sweep.removeArchiveArtifacts(artifacts).catch(() => void 0);
				reject(new Error(msg.error ?? "Worker failed without error message"));
			}
		});
		worker.on("error", (error) => {
			clearTimeout(timer);
			require_logger.mainLog.error("[packageLogs] Worker thread error", error, { lastStage });
			require_archive_artifact_sweep.removeArchiveArtifacts(artifacts).catch(() => void 0);
			reject(error);
		});
		worker.on("exit", (code) => {
			clearTimeout(timer);
			const heldMs = Date.now() - spawnStartedAt;
			trackWorkerExit(workerId);
			if (code !== 0) {
				require_logger.mainLog.error("[packageLogs] Worker exited abnormally", {
					code,
					lastStage,
					heldMs,
					backgroundAtStart
				});
				require_archive_artifact_sweep.removeArchiveArtifacts(artifacts).catch(() => void 0);
				reject(/* @__PURE__ */ new Error(`Log archive worker exited with code ${code}`));
				return;
			}
			if (heldMs >= SLOW_ARCHIVE_MS) require_logger.mainLog.warn("[packageLogs] Worker held the thread pool for a long time", {
				heldMs,
				lastStage
			});
		});
	});
}
/**
* Package log directories into a zip archive and reveal it in the file manager.
*
* Normal flow: archive → reveal zip. Timeout/failure: open the logs directory
* directly so the user still sees their logs (#87127).
*
* @param logsDir       Primary logs directory (electron-log output).
* @param platform      Platform services for showItemInFolder / openPath.
* @param extraLogDirs  Additional log directories to include (e.g. CLI sidecar logs at ~/.workbuddy/logs).
*/
async function packageAndShowLog(logsDir, platform, extraLogDirs) {
	if (!logsDir) {
		require_logger.mainLog.warn("[packageAndShowLog] Logs directory is empty");
		return;
	}
	try {
		const zipPath = await packageLogs(logsDir, { extraLogDirs });
		require_logger.mainLog.info("[packageAndShowLog] Archive ready, revealing it", { zipPath });
		const revealStartedAt = Date.now();
		platform.showItemInFolder(zipPath);
		const revealMs = Date.now() - revealStartedAt;
		if (revealMs >= SLOW_REVEAL_MS) require_logger.mainLog.warn("[packageAndShowLog] Revealing in file manager was slow", { revealMs });
	} catch (error) {
		require_logger.mainLog.warn("[packageAndShowLog] Archive failed or timed out, opening logs dir instead", {
			logsDir,
			error: error instanceof Error ? error.message : String(error)
		});
		try {
			if (await platform.openPath(logsDir)) platform.showItemInFolder(logsDir);
		} catch {
			platform.showItemInFolder(logsDir);
		}
	}
}
//#endregion
Object.defineProperty(exports, "STARTUP_MARKS", {
	enumerable: true,
	get: function() {
		return STARTUP_MARKS;
	}
});
Object.defineProperty(exports, "logAppStartup", {
	enumerable: true,
	get: function() {
		return logAppStartup;
	}
});
Object.defineProperty(exports, "logLifecycleEvent", {
	enumerable: true,
	get: function() {
		return logLifecycleEvent;
	}
});
Object.defineProperty(exports, "logStartupPerf", {
	enumerable: true,
	get: function() {
		return logStartupPerf;
	}
});
Object.defineProperty(exports, "packageAndShowLog", {
	enumerable: true,
	get: function() {
		return packageAndShowLog;
	}
});
Object.defineProperty(exports, "packageLogs", {
	enumerable: true,
	get: function() {
		return packageLogs;
	}
});
Object.defineProperty(exports, "setUserIdProvider", {
	enumerable: true,
	get: function() {
		return setUserIdProvider;
	}
});
