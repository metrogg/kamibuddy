const require_chunk = require("./chunk.js");
const require_workbuddy_product_config = require("./workbuddy-product-config.js");
const require_workbuddy_paths = require("./workbuddy-paths.js");
const require_app_instance = require("./app-instance.js");
let node_child_process = require("node:child_process");
let node_fs = require("node:fs");
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_os = require("node:os");
node_os = require_chunk.__toESM(node_os);
let node_util = require("node:util");
//#region src/main/self-check/report.ts
require_workbuddy_product_config.init_workbuddy_product_config();
require_app_instance.init_app_instance();
/** 报告文件名前缀 */
var REPORT_PREFIX = "diagnostics-";
/** 网络大类名（与 controller 侧 CheckResult.category 取值一致） */
var NETWORK_CATEGORY = "网络";
/** 网络诊断整体状态的中文标签 */
var NETWORK_STATUS_LABEL = {
	success: "正常",
	warning: "警告",
	error: "异常",
	unsupported: "不支持"
};
/**
* 生成报告时间戳文件名（与网络检查命名规则一致）。
* 格式：diagnostics-YYYYMMDD-HHmmss-mmm.txt
*/
function formatTimestampForFileName(time) {
	const d = new Date(time);
	const pad = (n, l = 2) => String(n).padStart(l, "0");
	return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`;
}
/** 匹配 IPv4 地址 */
var IPV4_REGEX = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;
/** 判断是否为内网 IP */
function isPrivateIp(a, b) {
	return a === 10 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
}
/** 脱敏单个 IP 地址 */
function sanitizeIp(ip) {
	const parts = ip.split(".").map(Number);
	if (parts.length !== 4 || parts.some(isNaN)) return ip;
	if (isPrivateIp(parts[0], parts[1])) return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
	return `${parts[0]}.${parts[1]}.***.***`;
}
/** 对文本中的所有 IP 地址做脱敏 */
function sanitizeIps(text) {
	return text.replace(IPV4_REGEX, (match) => sanitizeIp(match));
}
/** 对文本中的用户名做脱敏 */
function sanitizeUsername(text) {
	const home = node_os.homedir();
	if (!home) return text;
	const sanitizedHome = home.replace(/[^/\\]+$/, "***");
	return text.replace(new RegExp(escapeRegExp$2(home), "g"), sanitizedHome);
}
/** 对文本中的代理地址做脱敏（只保留启用状态和类型，不输出具体地址） */
function sanitizeProxyUrls(text) {
	return text.replace(/(?:https?|socks[45]?):\/\/[^\s,;]+/gi, (match) => {
		return `(${match.split("://")[0].toUpperCase()})`;
	});
}
/** 综合脱敏：对一段文本应用所有脱敏规则 */
function sanitizeText(text) {
	if (!text) return "";
	let result = text;
	result = sanitizeIps(result);
	result = sanitizeUsername(result);
	result = sanitizeProxyUrls(result);
	return result;
}
/**
* 脱敏但**保留 URL 本身**，用于「服务端点」这类字段。
*
* {@link sanitizeProxyUrls} 是全文正则，会把任意 `http(s)://…` 收敛成协议名。
* 服务端点是公开的产品域名，若走完整脱敏会被打成 `(HTTPS)`，报告就无法自证
* 在诊断哪个端点，失去价值（原网络检查报告里该字段本就是明文）。
* 因此这里只做 IP / 用户名脱敏，不做代理 URL 收敛。代理地址仍须用
* {@link sanitizeText}。
*/
function sanitizeTextKeepUrl(text) {
	if (!text) return "";
	return sanitizeUsername(sanitizeIps(text));
}
function escapeRegExp$2(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
* 生成纯文本报告内容（含全量脱敏）。
*
* @param network 完整网络诊断结果。传入时会在【网络】大类补充「当前目标」上下文
*   （服务端点 / 目标主机 / 代理模式 / Hosts 文件 / 整体结论），对齐原网络检查
*   报告的 `[Target]` 段——只列各检测项而不给出目标信息，报告无法自证是在
*   诊断哪个端点。详见 #88173。
*/
function generateReportText(results, meta, network) {
	const lines = [];
	lines.push("⚠️ 本报告由 WorkBuddy 诊断工具生成，包含环境诊断信息（网络、磁盘、安全软件等）。");
	lines.push("   分享前请确认内容不含您不愿公开的信息。敏感字段已做脱敏处理。");
	lines.push("");
	lines.push("=".repeat(60));
	lines.push("");
	lines.push(`客户端版本: ${meta.clientVersion}`);
	lines.push(`操作系统: ${meta.osInfo}`);
	lines.push(`检测时间: ${meta.checkTime}`);
	lines.push(`检测耗时: ${(meta.duration / 1e3).toFixed(1)}s`);
	lines.push("");
	const grouped = groupByCategory(results);
	for (const [category, items] of Object.entries(grouped)) {
		lines.push("-".repeat(60));
		lines.push(`【${category}】`);
		lines.push("-".repeat(60));
		if (category === NETWORK_CATEGORY && network) lines.push(...formatNetworkTargetSection(network));
		for (const item of items) {
			const icon = getStatusIcon(item.status);
			lines.push("");
			lines.push(`  ${icon} ${item.title}`);
			if (item.summary) lines.push(`    状态: ${sanitizeText(item.summary)}`);
			if (item.detail) lines.push(`    详情: ${sanitizeText(item.detail)}`);
			if (item.advice) lines.push(`    建议: ${sanitizeText(item.advice)}`);
			lines.push(`    耗时: ${item.costMs}ms`);
		}
		lines.push("");
	}
	lines.push("=".repeat(60));
	const passed = results.filter((r) => r.status === "pass").length;
	const warned = results.filter((r) => r.status === "warning").length;
	const failed = results.filter((r) => r.status === "fail").length;
	const info = results.filter((r) => r.status === "info").length;
	lines.push(`汇总: ${passed} 通过 / ${warned} 警告 / ${failed} 失败 / ${info} 信息（共 ${results.length} 项）`);
	lines.push("");
	return lines.join("\n");
}
/**
* 保存报告到指定目录，返回文件路径。
*/
async function saveReport(reportDir, results, meta, network) {
	await node_fs.promises.mkdir(reportDir, { recursive: true });
	const fileName = `${REPORT_PREFIX}${formatTimestampForFileName(Date.now())}.txt`;
	const filePath = node_path.join(reportDir, fileName);
	const content = generateReportText(results, meta, network);
	await node_fs.promises.writeFile(filePath, content, "utf-8");
	return filePath;
}
/**
* 清理旧报告，保留最近 MAX_REPORTS 份。
*/
async function cleanupOldReports(reportDir, maxReports = 10) {
	try {
		const reports = (await node_fs.promises.readdir(reportDir)).filter((f) => f.startsWith("diagnostics-") && f.endsWith(".txt")).sort().reverse();
		if (reports.length <= maxReports) return;
		const toDelete = reports.slice(maxReports);
		await Promise.all(toDelete.map((f) => node_fs.promises.unlink(node_path.join(reportDir, f)).catch(() => void 0)));
	} catch {}
}
/**
* 获取最新报告文件信息。
*/
async function getLatestReport(reportDir) {
	try {
		const reports = (await node_fs.promises.readdir(reportDir)).filter((f) => f.startsWith("diagnostics-") && f.endsWith(".txt")).sort().reverse();
		if (reports.length === 0) return null;
		return {
			name: reports[0],
			path: node_path.join(reportDir, reports[0])
		};
	} catch {
		return null;
	}
}
function groupByCategory(results) {
	return results.reduce((acc, item) => {
		(acc[item.category] = acc[item.category] || []).push(item);
		return acc;
	}, {});
}
/**
* 输出网络大类的「当前目标」上下文，对齐原网络检查报告的 `[Target]` 段。
* 代理地址交由 sanitizeProxyUrls 收敛为协议名，不落具体地址。
*/
function formatNetworkTargetSection(network) {
	const t = network.target;
	const lines = [];
	lines.push("");
	lines.push("  ▸ 当前目标");
	lines.push(`    服务端点: ${sanitizeTextKeepUrl(t.endpoint)}`);
	lines.push(`    目标主机: ${sanitizeText(t.host)}:${t.port}（${t.protocol}）`);
	lines.push(`    代理模式: ${sanitizeText(t.proxyMode)}`);
	if (t.proxyUrl) lines.push(`    代理地址: ${sanitizeText(t.proxyUrl)}`);
	lines.push(`    Hosts 文件: ${sanitizeText(t.hostsFilePath)}`);
	lines.push(`    整体结论: ${NETWORK_STATUS_LABEL[network.overallStatus] ?? network.overallStatus} — ${sanitizeText(network.overallSummary)}`);
	return lines;
}
function getStatusIcon(status) {
	switch (status) {
		case "pass": return "✅";
		case "warning": return "⚠️";
		case "fail": return "❌";
		case "info": return "ℹ️";
		default: return "❓";
	}
}
//#endregion
//#region src/main/self-check/controller.ts
/**
* SelfCheckController — 自检控制器。
*
* 职责：
* 1. 编排 SelfCheckItem 检查项（同类并行，类间串行）
* 2. **单独**编排网络诊断（完整结果附加到 RunResult.network，UI 层直接渲染）
* 3. 汇总结果，支持导出报告
* 4. 维护运行状态（用于弹窗关闭后恢复）
*
* @see 客户端自检工具需求文档.md §3.2 / §3.5
*/
/** 检查项默认超时时间（ms）。个别慢项可通过 `SelfCheckItem.timeoutMs` 单独放宽 */
var ITEM_TIMEOUT_MS = 1e4;
/**
* 网络诊断超时时间（ms）。
*
* ⚠️ 必须显著大于网络诊断自身的最坏耗时，否则在正常环境下也会误报超时：
* `NetworkDiagnosticsService.runPacketLossDiagnostics` 用 `ping -n 18` 且
* execFile timeout 固定 30_000ms（见 network/diagnostics-service.ts）。
* Windows 上 ICMP 常被 iOA / 杀软 / 防火墙拦截，18 次全部“请求超时”后
* ping 会被这 30s timeout 强杀；而 runDiagnostics 内部是 Promise.all 并行，
* 总耗时由 packetLoss 主导 ≈ 30.0~30.1s。
*
* 曾设为 30_000，与上述耗时几乎相等 → 在 ICMP 被拦的机器上**结构性必然超时**
* （实测连续 6 次全部落在 30.07~30.11s，仅差数十毫秒被击穿），导致
* `state.network` 恒为 null：弹窗子项永远停在“等待中”、报告里网络大类只剩
* 一行“网络诊断失败”。详见 #88173。
*
* 这里只作为“卡死兜底”，不承担限时职责——各子检查已有自己的超时。
* ICMP 可达的环境下网络诊断只需数秒，不会等到这个上限。
*/
var NETWORK_TIMEOUT_MS = 6e4;
/**
* 网络诊断的 5 个子项定义（单一事实来源）。
*
* id / title 同时被三方消费：弹窗子项骨架、文本报告的网络段、失败兜底，
* 因此成功与失败路径必须共用这份定义，避免出现某一路径缺项。
* key 指向 {@link NetworkDiagnosticsFullResult} 上对应的 payload 字段。
*/
var NETWORK_SUB_CHECKS = [
	{
		id: "network.api_connectivity",
		title: "API 连通性",
		key: "service"
	},
	{
		id: "network.dns_resolution",
		title: "DNS 解析",
		key: "hosts"
	},
	{
		id: "network.tcp_connectivity",
		title: "TCP 端口连通性",
		key: "tcp"
	},
	{
		id: "network.proxy_detection",
		title: "代理检测",
		key: "proxy"
	},
	{
		id: "network.packet_loss",
		title: "丢包率",
		key: "packetLoss"
	}
];
var SelfCheckController = class {
	registry;
	networkRunner;
	/** 派生当前登录身份键（见 visibility.resolveDiagnosticsIdentity），未注入则不做失效检查 */
	getIdentity;
	/** 当前 state 所属的身份键 */
	stateIdentity;
	/** stateIdentity 是否已同步过（区分「未登录」与「从未同步」，两者都是 undefined） */
	identitySynced = false;
	state = {
		phase: "idle",
		results: [],
		progress: {
			current: 0,
			total: 0
		},
		latestReportPath: null,
		network: null
	};
	constructor(registry, networkRunner, getIdentity) {
		this.registry = registry;
		this.networkRunner = networkRunner;
		this.getIdentity = getIdentity;
	}
	/**
	* 校验当前 state 是否仍属于登录中的账号，账号已切换则丢弃。
	*
	* 主进程单例 + 切号不重启，使得 state 会跨账号存活；`state.showFull` 与
	* `state.results` 都是**上一账号权限下**的产物，必须随账号失效，否则：
	* 企业账号 → 个人账号后 `get-state` 仍返回 showFull=true（`??` 短路，读不到实时值），
	* 弹窗照旧渲染全部大类，且暴露上一账号的检查结果。详见 #88173。
	*
	* 在每个对外读写入口（getState / runAll）调用，避免依赖 auth 事件订阅的时序。
	*/
	syncIdentity() {
		if (!this.getIdentity) return;
		const current = this.getIdentity();
		const changed = this.identitySynced && current !== this.stateIdentity;
		this.stateIdentity = current;
		this.identitySynced = true;
		if (changed) this.reset();
	}
	/**
	* 执行全部检查（同类并行，类间串行）。
	*
	* 特殊处理：网络大类**不**作为若干 SelfCheckItem 运行，而是通过 networkRunner
	* 单独执行一次完整诊断，把结果附加到 state.network 交给 UI 层用 network-check
	* 的 group 组件渲染。同时也把 5 个子项摘要出来作为 CheckResult 加入 results
	* 数组（供文本报告和进度使用）。
	*/
	async runAll(showFull, onProgress) {
		this.syncIdentity();
		const items = this.registry.getByVisibility(showFull);
		this.state = {
			phase: "running",
			results: [],
			progress: {
				current: 0,
				total: items.length + (this.networkRunner ? 5 : 0)
			},
			latestReportPath: null,
			network: null,
			showFull,
			finishedAt: null,
			duration: null
		};
		const pushResult = (result) => {
			this.state.results.push(result);
			this.state.progress.current = this.state.results.length;
			onProgress?.(this.state.progress.current, this.state.progress.total, result);
		};
		const tasks = [];
		if (this.networkRunner) tasks.push(this.runNetworkDiagnostics().then((list) => {
			for (const r of list) pushResult(r);
			return list;
		}));
		const grouped = this.groupByCategory(items);
		for (const categoryItems of Object.values(grouped)) tasks.push(Promise.all(categoryItems.map((item) => this.runItemWithTimeout(item).then((r) => {
			pushResult(r);
			return r;
		}))));
		const results = (await Promise.all(tasks)).flat();
		this.state.phase = "done";
		this.state.finishedAt = Date.now();
		return results;
	}
	/**
	* 单独执行网络诊断，返回 5 个 CheckResult 摘要（供报告用）。
	* 完整结果保存到 state.network。
	*
	* 失败/超时时同样返回全部 5 个子项（标记为 fail），不能只返回一条总体失败：
	* 弹窗的网络大类按固定子项骨架渲染，缺失的子项会一直停在“等待中”，
	* 出现“徽章显示 N 失败但列表里找不到失败项”的矛盾（#88173）。
	*/
	async runNetworkDiagnostics() {
		if (!this.networkRunner) return [];
		const t0 = Date.now();
		try {
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(/* @__PURE__ */ new Error(`网络诊断超时（超过 ${Math.round(NETWORK_TIMEOUT_MS / 1e3)}s）`)), NETWORK_TIMEOUT_MS);
			});
			const result = await Promise.race([this.networkRunner.runDiagnostics(), timeoutPromise]);
			this.state.network = result;
			return NETWORK_SUB_CHECKS.map(({ id, title, key }) => buildNetworkCheckResult(id, title, result[key], t0));
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const costMs = Date.now() - t0;
			return [{
				id: "network.overall",
				title: "网络诊断",
				category: "网络",
				status: "fail",
				summary: `网络诊断失败: ${message}`,
				advice: "请检查网络连接后重试",
				costMs
			}, ...NETWORK_SUB_CHECKS.map(({ id, title }) => ({
				id,
				title,
				category: "网络",
				status: "fail",
				summary: `未获取到结果（${message}）`,
				costMs
			}))];
		}
	}
	async runItemWithTimeout(item) {
		const timeoutMs = item.timeoutMs ?? ITEM_TIMEOUT_MS;
		try {
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(/* @__PURE__ */ new Error("检查超时")), timeoutMs);
			});
			return await Promise.race([item.run(), timeoutPromise]);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return {
				id: item.id,
				title: item.title,
				category: item.category,
				status: "fail",
				summary: `检测异常: ${message}`,
				advice: "请重试或联系技术支持",
				costMs: timeoutMs
			};
		}
	}
	groupByCategory(items) {
		return items.reduce((acc, item) => {
			(acc[item.category] = acc[item.category] || []).push(item);
			return acc;
		}, {});
	}
	getState() {
		this.syncIdentity();
		return {
			...this.state,
			results: [...this.state.results]
		};
	}
	reset() {
		this.state = {
			phase: "idle",
			results: [],
			progress: {
				current: 0,
				total: 0
			},
			latestReportPath: null,
			network: null
		};
	}
	setLatestReportPath(path) {
		this.state.latestReportPath = path;
	}
	/** 记录本次检测总耗时（handler 层在 saveReport 后调用，值与报告 meta.duration 同源） */
	setDuration(ms) {
		this.state.duration = ms;
	}
	exportReport(results, meta) {
		return generateReportText(results, meta, this.state.network ?? null);
	}
};
function buildNetworkCheckResult(id, title, payload, t0) {
	if (!payload) return {
		id,
		title,
		category: "网络",
		status: "info",
		summary: "未执行",
		costMs: Date.now() - t0
	};
	const status = payload.status === "success" ? "pass" : payload.status === "warning" ? "warning" : payload.status === "error" ? "fail" : "info";
	const detailParts = [];
	if (payload.value && !payload.summary.includes(payload.value)) detailParts.push(`值: ${payload.value}`);
	if (payload.errorType) detailParts.push(`错误类型: ${payload.errorType}`);
	if (payload.detail) detailParts.push(payload.detail);
	const duration = payload.durationMs != null ? ` · ${Math.round(payload.durationMs)}ms` : "";
	return {
		id,
		title,
		category: "网络",
		status,
		summary: `${payload.summary}${duration}`,
		detail: detailParts.length > 0 ? detailParts.join("\n") : void 0,
		costMs: payload.durationMs ?? Date.now() - t0
	};
}
//#endregion
//#region src/main/self-check/items/crash-log-check.ts
/**
* 客户端崩溃日志采集检查项。
*
* 采集范围：**workbuddy 客户端自身**的崩溃日志（**不是**系统崩溃日志）。
* 数据来源：`{workbuddy logs dir}/Crash-Log/*.json` 由 `@genie/monitor` 的
* `installCrashWriter()` 落盘的 JSON 报告文件。
*
* 文件结构（`CrashReportFile`）：
* ```json
* {
*   "launchedAt": "2026-05-11T00:01:56.924+08:00",
*   "pid": 12345,
*   "processName": "main",
*   "entries": [
*     {
*       "timestamp": "2026-05-11T00:02:03.456+08:00",
*       "type": "renderer_crash",
*       "errorName": "RendererCrash",
*       "errorMessage": "renderer gone: reason=crashed",
*       "stack": "..."
*     }
*   ]
* }
* ```
*
* 触发场景：
* - `uncaughtException` / `unhandledRejection`（主进程 JS 异常）
* - `renderer_crash`（webContents 渲染进程崩溃）
* - `gpu_crash` / `child_process_crash`（Electron 工具子进程崩溃）
* - `renderer_js_error`（renderer 里 window.onerror）
*
* @see 客户端自检工具需求文档.md §2.2 ⑥
* @see packages/monitor/src/node/crash-reporter/crash-writer.ts
*/
/** 只统计最近 7 天的 crash */
var SEVEN_DAYS_MS = 10080 * 60 * 1e3;
/** detail 里最多展示的 crash 条数 */
var MAX_RECENT_ENTRIES = 5;
/** 每条 crash 里 stack / message 最多截取的字符数 */
var MAX_MESSAGE_LENGTH = 200;
/**
* Electron renderer/gpu/child-process 的「确定异常」reason 集合。
* 只有命中这些 reason 的进程崩溃才告警；clean-exit / killed / oom-allocated 等不告警。
* 参考：https://www.electronjs.org/docs/latest/api/structures/cpu-crash
*/
var ABNORMAL_PROCESS_REASONS = new Set([
	"crashed",
	"oom",
	"launch-failed",
	"integrity-failure"
]);
/**
* 确定异常的信号（数值 + 名称）。
* SIGSEGV(11)=段错误, SIGABRT(6)=abort(), SIGFPE(8)=浮点异常, SIGBUS(7)=总线错误。
* SIGTERM/SIGINT/SIGHUP/SIGBREAK 均视为主动终止，不在此集合。
* SIGKILL(9) 歧义较大（见下方 SIGKILL 处理），不在此集合。
*/
var ABNORMAL_SIGNALS = new Set([
	"SIGSEGV",
	"SIGABRT",
	"SIGFPE",
	"SIGBUS",
	"SIGILL",
	"6",
	"7",
	"8",
	"10",
	"11"
]);
/**
* 我们自己 spawn 的子进程名，SIGKILL 时视为 pool 主动清理（良性）。
* 非 spawn 进程的 SIGKILL 可能是系统 OOM killer，应告警。
*/
var OWN_SPAWNED_PROCESS_NAMES = new Set([
	"cli",
	"sidecar",
	"daemon",
	"crash-test-child"
]);
/**
* uncaught_exception / unhandled_rejection 里的良性错误模式。
*
* 共性：**"资源已关闭 / 已销毁后的残留操作"** —— 都是进程/连接/流关闭阶段
* 的时序竞争产生的，无任何功能影响，不应告警。
*
* 分三类：
* 1. 管道/socket 关闭后残留 I/O：EPIPE、ECONNRESET、EOF
*    （sidecar/cli 退出时主进程已关掉其管道，但还有 buffer 在 flush）
* 2. Node 流已结束/销毁后继续操作：ERR_STREAM_WRITE_AFTER_END、ERR_STREAM_DESTROYED
* 3. Electron 对象已销毁后继续访问：Object has been destroyed、
*    Render frame was disposed（窗口/webContents 关闭时 IPC 仍在途）
*
* ⚠️ 有歧义的错误（如 ECONNREFUSED=服务没起、socket hang up=请求中断）**不**加入，
* 因为它们可能是真实故障，保持告警。新增模式前需确认无歧义。
*/
var BENIGN_EXCEPTION_PATTERNS = [
	/\bEPIPE\b/,
	/\bECONNRESET\b/,
	/\bEOF\b/,
	/ERR_STREAM_WRITE_AFTER_END/,
	/ERR_STREAM_DESTROYED/,
	/write after end/i,
	/Object has been destroyed/i,
	/Render frame was disposed/i
];
/** 判断错误消息是否命中良性异常模式 */
function isBenignExceptionMessage(msg) {
	return BENIGN_EXCEPTION_PATTERNS.some((re) => re.test(msg));
}
/**
* 白名单判定：一条 crash 记录是否为「确定异常，应告警」。
*
* 设计思路：**默认不告警**，只有命中以下明确异常条件之一才告警。
* 这样系统演进时新出现的未知 crash 模式不会误报，需人工确认后加入白名单。
*
* 判定规则：
* 1. uncaught_exception / unhandled_rejection → 异常，但排除管道关闭类良性 I/O
*    错误（EPIPE/ECONNRESET，进程退出时序竞争产生）
* 2. renderer_crash / gpu_crash → reason 命中 ABNORMAL_PROCESS_REASONS 才异常
* 3. child_process_crash → 满足以下之一才异常：
*    a. spawn-error:* （进程启动失败）
*    b. signal 命中 ABNORMAL_SIGNALS（段错误 / abort 等）
*    c. SIGKILL 且非自己 spawn 的进程（可能是系统 OOM killer）
*    d. exitCode 非零且非优雅信号（如 exit:1 但非 SIGTERM）
* 4. renderer_js_error → 排除 BENIGN_RENDERER_JS_MESSAGES（首启 IPC clone 失败）
* 5. 未知 crash 类型 → 保守视为异常（不漏报）
*/
function isActionableCrash(r) {
	switch (r.type) {
		case "uncaught_exception":
		case "unhandled_rejection": return !isBenignExceptionMessage(r.errorMessage);
		case "renderer_js_error": return !BENIGN_RENDERER_JS_MESSAGES.has(r.errorMessage);
		case "renderer_crash":
		case "gpu_crash": {
			const reason = r.childProcess?.reason ?? r.errorMessage ?? "";
			const reasonMatch = reason.match(/reason=(\S+)/);
			const reasonVal = reasonMatch ? reasonMatch[1] : reason;
			return ABNORMAL_PROCESS_REASONS.has(reasonVal);
		}
		case "child_process_crash": {
			const cp = r.childProcess;
			if (!cp) return true;
			const { reason } = cp;
			if (reason.startsWith("spawn-error:")) return true;
			const signalMatch = reason.match(/^signal:(.+)$/);
			if (signalMatch) {
				const sig = signalMatch[1];
				if (sig === "0") return false;
				if (sig === "SIGKILL" || sig === "9") {
					const procName = r.childProcess?.name ?? r.processName;
					return !OWN_SPAWNED_PROCESS_NAMES.has(procName);
				}
				return ABNORMAL_SIGNALS.has(sig);
			}
			const exitMatch = reason.match(/^exit:(.+)$/);
			if (exitMatch) {
				const code = Number(exitMatch[1]);
				return !Number.isNaN(code) && code !== 0;
			}
			return ABNORMAL_PROCESS_REASONS.has(reason);
		}
		default: return true;
	}
}
/**
* renderer_js_error 内的良性消息集合。
* "An object could not be cloned" 是首启 IPC structured clone 时序竞争的固定症状，
* Electron 的 webContents.send 在 renderer 还没完全 ready 时发不可克隆对象会偶发。
* 实际数据看：几乎所有用户的 crash 报告都包含至少 1 条这种错误，但没有任何
* 真实功能影响，不应告警。
*/
var BENIGN_RENDERER_JS_MESSAGES = new Set(["An object could not be cloned."]);
var CrashLogCheck = class {
	id = "env.crash_log";
	title = "崩溃日志采集";
	category = "环境信息";
	severity = "critical";
	visibleTo = "b";
	constructor(deps) {
		this.deps = deps;
	}
	async run() {
		const t0 = Date.now();
		let records;
		try {
			records = await this.readAllCrashRecords();
		} catch {
			return {
				id: this.id,
				title: this.title,
				category: this.category,
				status: "info",
				summary: "无法读取崩溃日志目录",
				costMs: Date.now() - t0
			};
		}
		const now = Date.now();
		const recentRaw = records.filter((r) => now - r.timestampMs <= SEVEN_DAYS_MS);
		const actionable = recentRaw.filter((r) => isActionableCrash(r));
		const benign = recentRaw.filter((r) => !isActionableCrash(r));
		const recent = actionable;
		if (recent.length === 0) {
			const note = benign.length > 0 ? `（已过滤 ${benign.length} 条良性/未知记录）` : "";
			return {
				id: this.id,
				title: this.title,
				category: this.category,
				status: "pass",
				summary: `最近 7 天无可确认的崩溃记录${note}`,
				costMs: Date.now() - t0
			};
		}
		const typeCount = /* @__PURE__ */ new Map();
		for (const r of recent) typeCount.set(r.type, (typeCount.get(r.type) ?? 0) + 1);
		const typeSummary = [...typeCount.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => `${formatCrashType(type)} ${count} 次`).join("，");
		const sorted = recent.sort((a, b) => b.timestampMs - a.timestampMs);
		const shown = sorted.slice(0, MAX_RECENT_ENTRIES);
		const detailLines = [];
		for (const r of shown) {
			const time = formatTime(r.timestampIso);
			const proc = r.processName ? ` (${r.processName})` : "";
			const msg = truncate(r.errorMessage || r.errorName || "(no message)", MAX_MESSAGE_LENGTH);
			detailLines.push(`[${time}] ${formatCrashType(r.type)}${proc}: ${msg}`);
		}
		if (sorted.length > shown.length) detailLines.push(`… 另有 ${sorted.length - shown.length} 条更早的崩溃未展示`);
		const lastCrashTime = formatTime(sorted[0].timestampIso);
		const summary = `最近 7 天共 ${recent.length} 次崩溃（${typeSummary}），最近：${lastCrashTime}`;
		const advice = generateAdvice(typeCount);
		return {
			id: this.id,
			title: this.title,
			category: this.category,
			status: "warning",
			summary,
			detail: detailLines.join("\n"),
			advice,
			costMs: Date.now() - t0
		};
	}
	/** 遍历 Crash-Log 目录，读取并解析所有 crash JSON 文件 */
	async readAllCrashRecords() {
		let files;
		try {
			files = await node_fs.promises.readdir(this.deps.crashLogDir);
		} catch {
			return [];
		}
		const records = [];
		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			try {
				const content = await node_fs.promises.readFile(node_path.join(this.deps.crashLogDir, file), "utf-8");
				records.push(...parseCrashReportFile(content));
			} catch {}
		}
		return records;
	}
};
/**
* 解析单个 crash 报告文件。
* 文件结构见 `CrashReportFile`：entries: CrashReportEntry[]。
*/
function parseCrashReportFile(content) {
	let data;
	try {
		data = JSON.parse(content);
	} catch {
		return [];
	}
	if (!data || typeof data !== "object") return [];
	const file = data;
	const processName = typeof file.processName === "string" ? file.processName : "";
	const entries = Array.isArray(file.entries) ? file.entries : [];
	const records = [];
	for (const raw of entries) {
		if (!raw || typeof raw !== "object") continue;
		const entry = raw;
		const timestampIso = typeof entry.timestamp === "string" ? entry.timestamp : "";
		const ts = timestampIso ? Date.parse(timestampIso) : NaN;
		if (Number.isNaN(ts)) continue;
		records.push({
			timestampIso,
			timestampMs: ts,
			type: typeof entry.type === "string" ? entry.type : "unknown",
			errorName: typeof entry.errorName === "string" ? entry.errorName : "",
			errorMessage: typeof entry.errorMessage === "string" ? entry.errorMessage : "",
			processName,
			childProcess: parseChildProcess(entry.childProcess)
		});
	}
	return records;
}
/** 从 crash entry 的 childProcess 字段提取 reason/exitCode/signal */
function parseChildProcess(raw) {
	if (!raw || typeof raw !== "object") return;
	const cp = raw;
	const reason = typeof cp.reason === "string" ? cp.reason : "";
	const exitCode = typeof cp.exitCode === "number" ? cp.exitCode : -1;
	const signal = typeof cp.signal === "string" ? cp.signal : void 0;
	const name = typeof cp.name === "string" ? cp.name : void 0;
	if (!reason && exitCode === -1) return;
	return {
		reason,
		exitCode,
		signal,
		name
	};
}
function formatCrashType(type) {
	return {
		"uncaught_exception": "主进程异常",
		"unhandled_rejection": "Promise 异常",
		"renderer_crash": "Renderer 崩溃",
		"gpu_crash": "GPU 进程崩溃",
		"child_process_crash": "子进程崩溃",
		"renderer_js_error": "Renderer JS 错误",
		"unknown": "未知类型"
	}[type] ?? type;
}
function formatTime(iso) {
	if (!iso) return "未知时间";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleString();
}
function truncate(s, max) {
	if (s.length <= max) return s;
	return s.substring(0, max - 1) + "…";
}
function generateAdvice(typeCount) {
	const parts = [];
	if ((typeCount.get("renderer_crash") ?? 0) >= 2) parts.push("Renderer 崩溃频发，建议重启客户端；反复出现请联系技术支持");
	if ((typeCount.get("gpu_crash") ?? 0) >= 1) parts.push("GPU 进程崩溃：请先完全退出并重新启动客户端；若问题仍反复出现，请联系技术支持。");
	if ((typeCount.get("uncaught_exception") ?? 0) >= 1) parts.push("主进程存在未捕获异常，建议重启或重装客户端；如反复出现请联系技术支持");
	if ((typeCount.get("renderer_js_error") ?? 0) >= 3) parts.push("Renderer JS 错误频发，建议重启客户端或清理配置；如反复出现请联系技术支持");
	return parts.length > 0 ? parts.join("\n") : "建议重启客户端；如反复出现请联系技术支持并提供崩溃日志";
}
//#endregion
//#region src/main/self-check/items/disk-space-check.ts
/**
* 磁盘空间检查项。
*
* 检测安装目录、用户数据目录、临时目录的剩余空间。
* 取三个目录所在磁盘的最小剩余空间作为整体判断依据。
*
* ⚠️ **只统计客户端实际会写入的磁盘**，不做全盘汇总 —— 其他盘再空也救不了
* 客户端所在盘写满。因此文案必须标明卷标（如 Windows 的 `C:`），否则用户会拿
* 结果去和「此电脑」里 C+D 的总和对比，误判数据不准（#88173）。
*
* 阈值从 product.json 的 productFeatures.SelfCheckDiskThresholds 读取，
* 未配置时使用默认值，支持后续包体积变化时调整。
*
* @see 客户端自检工具需求文档.md §2.2 ②
*/
/** 默认阈值（未配置时使用） */
var DEFAULT_THRESHOLDS = {
	warning: 3 * 1024,
	critical: 1 * 1024
};
/** 将字节转为 MB（向下取整） */
function bytesToMb(bytes) {
	return Math.floor(bytes / 1024 / 1024);
}
/**
* 提取路径所属卷的展示名。
*
* Windows: `C:\Users\x`        → `C:`（用户在资源管理器里认的就是盘符）
* UNC:     `\\server\share\x`  → `\\server\share`
* POSIX:   `/Users/x`          → `/`（单一根卷，标注根路径即可）
*
* 用于在结论里明确「说的是哪个盘」，避免用户拿去和多盘总容量对比。
*
* ⚠️ 刻意不用 `path.parse().root`：它按**运行平台**语义解析，在 macOS 上跑
* `path.parse('C:\\Users\\x').root` 会得到空串，既无法跨平台复用也无法单测。
* 这里改为纯字符串模式判定，结果只取决于入参本身。
*/
function resolveVolumeLabel(dirPath) {
	if (!dirPath) return "";
	const unc = dirPath.match(/^[\\/]{2}([^\\/]+)[\\/]+([^\\/]+)/);
	if (unc) return `\\\\${unc[1]}\\${unc[2]}`;
	const drive = dirPath.match(/^([a-zA-Z]):/);
	if (drive) return `${drive[1].toUpperCase()}:`;
	if (dirPath.startsWith("/")) return "/";
	return "";
}
/** 获取路径所在磁盘的剩余空间（字节）。
*
* 不可用时返回 `Number.POSITIVE_INFINITY`（"未知"语义），由上游
* `DiskSpaceCheck.run()` 检测后把该项标为 `status: 'info'`，
* 不参与 warning/critical 阈值判断，避免误导用户。
*/
async function getDiskFreeSpace(dirPath) {
	try {
		const stat = await node_fs.promises.statfs(dirPath);
		return stat.bavail * stat.bsize;
	} catch {
		return Number.POSITIVE_INFINITY;
	}
}
/** 从 product 配置读取磁盘阈值 */
function resolveDiskThresholds(productConfig) {
	const custom = (productConfig?.productFeatures)?.SelfCheckDiskThresholds;
	if (custom && typeof custom.warning === "number" && typeof custom.critical === "number") return {
		warning: custom.warning,
		critical: custom.critical
	};
	return DEFAULT_THRESHOLDS;
}
var DiskSpaceCheck = class {
	id = "system.disk.free_space";
	title = "磁盘剩余空间";
	category = "系统资源";
	severity = "critical";
	visibleTo = "b";
	constructor(paths, thresholds = DEFAULT_THRESHOLDS) {
		this.paths = paths;
		this.thresholds = thresholds;
	}
	async run() {
		const t0 = Date.now();
		const NAME_LABELS = {
			install: "安装目录",
			userData: "用户数据目录",
			temp: "临时目录"
		};
		const entries = [];
		let minFreeMb = Infinity;
		let minLabel = "";
		let minVolume = "";
		let hasUnknown = false;
		for (const [key, dir] of Object.entries(this.paths)) {
			const freeBytes = await getDiskFreeSpace(dir);
			const label = NAME_LABELS[key] ?? key;
			const volume = resolveVolumeLabel(dir);
			if (freeBytes === Number.POSITIVE_INFINITY) {
				hasUnknown = true;
				entries.push({
					label,
					volume,
					freeMb: Number.POSITIVE_INFINITY
				});
				continue;
			}
			const freeMb = bytesToMb(freeBytes);
			entries.push({
				label,
				volume,
				freeMb
			});
			if (freeMb < minFreeMb) {
				minFreeMb = freeMb;
				minLabel = label;
				minVolume = volume;
			}
		}
		if (hasUnknown && minFreeMb === Infinity) return {
			id: this.id,
			title: this.title,
			category: this.category,
			status: "info",
			summary: "当前平台不支持 fs.statfs，磁盘空间检测不可用",
			detail: entries.map((e) => `${e.label}: 检测不可用`).join("\n"),
			costMs: Date.now() - t0
		};
		const status = minFreeMb < this.thresholds.critical ? "fail" : minFreeMb < this.thresholds.warning ? "warning" : "pass";
		const minGb = (minFreeMb / 1024).toFixed(1);
		const volumePrefix = minVolume ? `${minVolume} ` : "";
		const summary = status === "pass" ? `${volumePrefix}剩余 ${minGb}GB，磁盘空间充足${hasUnknown ? "（部分路径未检测）" : ""}` : `${minLabel}（${minVolume || "未知卷"}）剩余 ${minGb}GB，${status === "fail" ? "空间严重不足" : "空间偏低"}`;
		const detail = [...entries.map((e) => e.freeMb === Number.POSITIVE_INFINITY ? `${e.label}（${e.volume || "未知卷"}）: 检测不可用` : `${e.label}（${e.volume || "未知卷"}）: 剩余 ${(e.freeMb / 1024).toFixed(1)}GB`), `判定口径: 取上述目录所在磁盘的最小剩余空间（告警线 ${(this.thresholds.warning / 1024).toFixed(0)}GB），不统计客户端未使用的其他磁盘`].join("\n");
		const advice = status !== "pass" ? `${minLabel}所在磁盘（${minVolume || "未知卷"}）剩余 ${minGb}GB，建议清理不常用文件或卸载软件以释放空间` : void 0;
		return {
			id: this.id,
			title: this.title,
			category: this.category,
			status,
			summary,
			detail,
			advice,
			costMs: Date.now() - t0
		};
	}
};
//#endregion
//#region src/main/self-check/items/edr-check.ts
/**
* EDR / 杀毒软件识别检查项。
*
* 扫描系统进程列表，匹配已知安全软件进程名特征库。
* 只匹配不记录：进程列表仅内存匹配，不缓存不落盘，报告只输出结论。
*
* 匹配策略：**精确进程名匹配**（basename 完全相等，忽略 .exe 后缀 + 大小写）。
* 之前用 `includes` 子串匹配会导致误命中（如 "Rav" 命中 macOS 上任意包含 rav
* 的进程），改为精确匹配后误报率大幅下降。
*
* @see 客户端自检工具需求文档.md §2.2 ③
*/
var execFileAsync$1 = (0, node_util.promisify)(node_child_process.execFile);
/**
* 进程枚举子进程超时（ms）。
*
* ⚠️ 必须显著大于常规耗时，且 ≤ {@link EdrCheck.timeoutMs}（外层裁剪线），
* 否则外层先杀掉，下面的错误分类逻辑永远走不到。
*
* 曾设为 5_000 —— 在装有安全软件的机器上**结构性必然超时**：EDR / 杀软会 hook
* 进程枚举 API，把 `tasklist` 从常态 1~2s 拖到 5s+（实测同一台机器连续三次检测
* 耗时 5213 / 5279 / 5823ms，全部紧贴 5000ms 上界被 execFile 强杀），结果恒为
* 「无法获取进程列表」。最讽刺的是：**正因为装了安全软件才超时，而这个检查项
* 的目的恰恰是识别安全软件** —— 越该报出来的机器越报不出来。详见 #88173。
*/
var PROCESS_LIST_TIMEOUT_MS = 12e3;
/** 该检查项的整体超时预算（ms），需 > PROCESS_LIST_TIMEOUT_MS 以便内部错误分类生效 */
var EDR_CHECK_TIMEOUT_MS = 15e3;
/**
* 判定进程枚举失败的成因。
*
* `execFile` 的超时是通过**发信号杀子进程**实现的，因此表现为 `killed=true`
* 且 `signal` 为 SIGTERM，而**不是** `code==='ETIMEDOUT'`（这点极易误判）。
*/
function classifyProcessListError(err) {
	const e = err;
	if (!e) return "unknown";
	if (e.killed || e.signal === "SIGTERM" || e.code === "ETIMEDOUT") return "timeout";
	if (e.code === "EACCES" || e.code === "EPERM") return "permission";
	if (e.code === "ENOENT") return "not-found";
	const message = String(e.message ?? "");
	if (/access is denied|拒绝访问|权限不足|not authorized/i.test(message)) return "permission";
	return "unknown";
}
/** 各失败成因对应的 summary / advice —— 与 {@link ProcessListErrorKind} 一一对应 */
var ERROR_MESSAGES = {
	timeout: {
		summary: `进程枚举超时（超过 ${Math.round(PROCESS_LIST_TIMEOUT_MS / 1e3)}s）`,
		advice: [
			"进程枚举耗时异常，通常是安全软件（EDR / 杀毒软件）拦截或 hook 了进程枚举操作导致。",
			"这本身即说明本机很可能装有安全软件，建议：",
			"  • 将客户端安装目录与用户数据目录加入安全软件白名单",
			"  • 或在任务管理器中手动确认正在运行的安全软件"
		].join("\n")
	},
	permission: {
		summary: "无权限获取进程列表",
		advice: "系统拒绝了进程枚举请求，请尝试以管理员身份重新启动客户端后重新检测。"
	},
	"not-found": {
		summary: "系统进程枚举命令不可用",
		advice: process.platform === "win32" ? "未找到系统命令 tasklist，请确认系统目录（如 C:\\Windows\\System32）完整且已在 PATH 中。" : "未找到系统命令 ps，请确认系统环境完整。"
	},
	unknown: {
		summary: "无法获取进程列表",
		advice: "请重新检测，或在任务管理器中手动确认是否有安全软件运行。"
	}
};
var SIGNATURES = [
	{
		processes: [
			"360Tray",
			"360sd",
			"360Safe",
			"360rp",
			"ZhuDongFangYu"
		],
		name: "360 安全卫士"
	},
	{
		processes: [
			"QMTray",
			"QQPCTray",
			"QQPCRTP"
		],
		name: "腾讯电脑管家"
	},
	{
		processes: [
			"HipsTray",
			"HipsDaemon",
			"wsctrl"
		],
		name: "火绒安全"
	},
	{
		processes: [
			"iOAClient",
			"iOATray",
			"iOADaemon"
		],
		name: "腾讯 iOA"
	},
	{
		processes: [
			"MsMpEng",
			"MsSense",
			"NisSrv"
		],
		name: "Windows Defender"
	},
	{
		processes: ["EDRAgent", "edragent"],
		name: "企业 EDR"
	},
	{
		processes: [
			"kavfs",
			"kavtray",
			"avp",
			"avpsus"
		],
		name: "卡巴斯基"
	},
	{
		processes: [
			"McAfee",
			"masvc",
			"mfeann",
			"mcshield"
		],
		name: "McAfee"
	},
	{
		processes: [
			"Norton",
			"navapsvc",
			"ccSvcHst"
		],
		name: "诺顿"
	},
	{
		processes: [
			"CDGClient",
			"CDGSvr",
			"SecospaceAgent",
			"DocGuard",
			"THooks",
			"ESafeNet"
		],
		name: "亿赛通 DocGuard"
	},
	{
		processes: [
			"asSecGuard",
			"asSecServer",
			"assecagent",
			"OfficeScanNT",
			"PccNT",
			"TmListen",
			"TmCCSF",
			"TmProxy"
		],
		name: "亚信安全"
	},
	{
		processes: [
			"OControl3",
			"OUpdate3",
			"OMailRpt",
			"OGuard3",
			"OServer3",
			"ipguard"
		],
		name: "IP-Guard"
	},
	{
		processes: ["Ping32", "PingGuard"],
		name: "Ping32"
	},
	{
		processes: [
			"TQClient",
			"TDSecService",
			"EntClient"
		],
		name: "奇安信天擎"
	},
	{
		processes: [
			"sangfor",
			"edr_monitor",
			"eaio",
			"EasyConnect"
		],
		name: "深信服 EDR / VPN"
	},
	{
		processes: [
			"uniAccessAgent",
			"uniRemoteServer",
			"uniAccessAgentTray",
			"UniAccessAgentDaemon",
			"UniSensitive"
		],
		name: "联软科技 UniAccess"
	},
	{
		processes: [
			"vrvrf_c",
			"vrvedp_m",
			"vrvsafec",
			"watchclient"
		],
		name: "北信源 VRV"
	},
	{
		processes: ["tipray", "LvDun"],
		name: "天锐绿盾"
	},
	{
		processes: [
			"MPSVC2",
			"MPActive",
			"MicroPoint"
		],
		name: "微点主动防御"
	},
	{
		processes: [
			"RavMonD",
			"RavMon",
			"RsMgrSvc",
			"RsAgent",
			"RavCheck",
			"RsMon",
			"rfwmain",
			"rfwsrv"
		],
		name: "瑞星杀毒"
	},
	{
		processes: [
			"KMService",
			"kxescore",
			"KSafesvc",
			"KSafe",
			"kxetray"
		],
		name: "金山毒霸"
	},
	{
		processes: [
			"kvxp",
			"KVMonXP",
			"KVSrvXP"
		],
		name: "江民杀毒"
	},
	{
		processes: ["Venustech"],
		name: "启明星辰"
	},
	{
		processes: ["DBAPPSecurity", "dbapp"],
		name: "安恒信息"
	},
	{
		processes: ["NSFocus", "NSFC"],
		name: "绿盟科技"
	}
];
/** 获取系统进程列表（返回不含扩展名的 basename） */
async function getProcessList() {
	if (process.platform === "win32") {
		const { stdout } = await execFileAsync$1("tasklist", [
			"/FO",
			"CSV",
			"/NH"
		], {
			encoding: "utf8",
			timeout: PROCESS_LIST_TIMEOUT_MS,
			maxBuffer: 10 * 1024 * 1024
		});
		return stdout.split("\n").map((line) => {
			const match = line.match(/^"([^"]+)"/);
			if (!match) return "";
			return match[1].replace(/\.(exe|EXE)$/, "");
		}).filter(Boolean);
	}
	const { stdout } = await execFileAsync$1("ps", [
		"ax",
		"-o",
		"comm="
	], {
		encoding: "utf8",
		timeout: PROCESS_LIST_TIMEOUT_MS,
		maxBuffer: 10 * 1024 * 1024
	});
	return stdout.split("\n").map((line) => node_path.basename(line.trim())).filter(Boolean);
}
/**
* 在进程列表中匹配安全软件（精确匹配 basename，忽略大小写）。
*/
function matchSecuritySoftware(processList) {
	const matched = /* @__PURE__ */ new Set();
	const processSet = new Set(processList.map((p) => p.toLowerCase()));
	for (const sig of SIGNATURES) for (const procName of sig.processes) if (processSet.has(procName.toLowerCase())) {
		matched.add(sig.name);
		break;
	}
	return [...matched];
}
var EdrCheck = class {
	id = "security.edr_detection";
	title = "EDR / 杀毒软件识别";
	category = "安全软件";
	severity = "major";
	visibleTo = "b";
	/** 进程枚举在装有安全软件的机器上天生慢，需比默认 10s 更宽的预算 */
	timeoutMs = EDR_CHECK_TIMEOUT_MS;
	constructor(deps) {
		this.deps = deps;
	}
	async run() {
		const t0 = Date.now();
		let detected = [];
		try {
			detected = matchSecuritySoftware(await getProcessList());
		} catch (err) {
			const { summary, advice } = ERROR_MESSAGES[classifyProcessListError(err)];
			return {
				id: this.id,
				title: this.title,
				category: this.category,
				status: "warning",
				summary,
				advice,
				costMs: Date.now() - t0
			};
		}
		if (detected.length === 0) return {
			id: this.id,
			title: this.title,
			category: this.category,
			status: "pass",
			summary: "未检测到会影响客户端的安全软件",
			costMs: Date.now() - t0
		};
		const sanitizedInstall = sanitizePath$1(this.deps.installDir);
		const sanitizedUserData = sanitizePath$1(this.deps.userDataDir);
		const advice = [
			`检测到 ${detected.join("、")} 正在运行，可能影响客户端性能。`,
			"",
			"建议将以下路径加入白名单：",
			`  • 安装目录：${sanitizedInstall}`,
			`  • 用户数据目录：${sanitizedUserData}`
		].join("\n");
		return {
			id: this.id,
			title: this.title,
			category: this.category,
			status: "warning",
			summary: `检测到 ${detected.join("、")}`,
			detail: void 0,
			advice,
			costMs: Date.now() - t0
		};
	}
};
/** 路径脱敏：用户名替换为 *** */
function sanitizePath$1(dirPath) {
	const home = node_os.homedir();
	return dirPath.replace(new RegExp(escapeRegExp$1(home), "g"), home.replace(/[^/\\]+$/, "***"));
}
function escapeRegExp$1(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//#endregion
//#region src/main/self-check/items/env-info-check.ts
/**
* 环境信息收集检查项。
*
* 收集 OS 版本、CPU 架构、物理内存、客户端版本、安装方式、安装时间等信息。
* 不做通过/失败判断（status 固定为 info），仅在配置目录不可写时才标 fail。
*
* @see 客户端自检工具需求文档.md §2.2 ⑤
*/
var EnvInfoCheck = class {
	id = "env.system_info";
	title = "环境信息";
	category = "环境信息";
	severity = "info";
	visibleTo = "b";
	constructor(deps) {
		this.deps = deps;
	}
	async run() {
		const t0 = Date.now();
		const osInfo = `${node_os.type()} ${node_os.release()} (${node_os.arch()})`;
		const cpuCores = String(node_os.cpus().length);
		const totalMemGb = (node_os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
		const hostname = node_os.hostname().substring(0, 2) + "***";
		const installMethod = this.deps.isPackaged ? "安装包" : "开发环境";
		const installTime = this.deps.isPackaged ? await this.getInstallTime() : "不适用（开发环境）";
		let configDirWritable = true;
		try {
			await node_fs.promises.access(this.deps.configDir, node_fs.promises.constants.W_OK);
		} catch {
			configDirWritable = false;
		}
		const detailLines = [
			`操作系统: ${osInfo}`,
			`CPU: ${cpuCores} 核`,
			`内存: ${totalMemGb}GB`,
			`主机名: ${hostname}`,
			`客户端版本: ${this.deps.clientVersion}`,
			`安装方式: ${installMethod}`,
			`安装时间: ${installTime}`,
			`配置目录: ${sanitizePath(this.deps.configDir)}`
		];
		const status = configDirWritable ? "info" : "fail";
		const summary = configDirWritable ? void 0 : "配置目录无写入权限";
		const advice = !configDirWritable ? "配置目录无写入权限，可能导致客户端无法正常运行，请检查目录权限" : void 0;
		return {
			id: this.id,
			title: this.title,
			category: this.category,
			status,
			summary,
			detail: detailLines.join("\n"),
			advice,
			costMs: Date.now() - t0
		};
	}
	/** 获取安装时间（取可执行文件的 birthtime 或 mtime） */
	async getInstallTime() {
		try {
			const stat = await node_fs.promises.stat(process.execPath);
			return (stat.birthtimeMs > 0 ? stat.birthtime : stat.mtime).toLocaleDateString("zh-CN", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit"
			});
		} catch {
			return "未知";
		}
	}
};
/** 路径脱敏：用户名替换为 *** */
function sanitizePath(dirPath) {
	const home = node_os.homedir();
	return dirPath.replace(new RegExp(escapeRegExp(home), "g"), home.replace(/[^/\\]+$/, "***"));
}
function escapeRegExp(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//#endregion
//#region src/main/self-check/items/file-monitor-check.ts
/**
* 文件读写监控检测检查项。
*
* 目的：间接检测系统是否有安全软件（杀软 / EDR）在实时扫描客户端文件。
*
* 测试策略：
*   在**客户端安装目录**和**用户数据目录**下各创建一个隐藏的 32KB 测试子文件，
*   进行 write + fsync + read + unlink 完整流程，测量平均耗时。
*   两个目录分别测，取 max 值作为判定依据（任一被扫都算异常）。
*
* 之所以测这两个目录（不测 tmpdir）：
*   - 安装目录是**杀软实时监控的重点区域**（防止篡改可执行文件）
*   - 用户数据目录也会被扫（客户端配置/缓存所在地）
*   - 临时目录很多杀软会白名单过滤，无法体现监控开销
*
* 兜底：如果某个目录不可写（权限问题），单独降级为 warning 但不中断另一个目录测试。
*
* @see 客户端自检工具需求文档.md §2.2 ④
*/
/** 每次读取次数（取平均） */
var READ_COUNT = 5;
/** 测试文件大小（约 32KB） */
var TEST_FILE_SIZE = 32 * 1024;
/** 正常阈值（ms）—— 平均耗时小于此值判定通过 */
var NORMAL_THRESHOLD_MS = 5;
/** 可疑阈值（ms）—— 大于此值判定为被监控 */
var SUSPICIOUS_THRESHOLD_MS = 50;
var FileMonitorCheck = class {
	id = "security.file_monitor";
	title = "文件读写监控检测";
	category = "安全软件";
	severity = "major";
	visibleTo = "b";
	constructor(deps) {
		this.deps = deps;
	}
	async run() {
		const t0 = Date.now();
		const targets = [{
			label: "安装目录",
			dir: this.deps.installDir
		}, {
			label: "用户数据目录",
			dir: this.deps.userDataDir
		}];
		const results = await Promise.all(targets.map((t) => this.probeDirectory(t.label, t.dir)));
		const successList = results.filter((r) => r.avgMs !== null);
		const failedList = results.filter((r) => r.avgMs === null);
		if (successList.length === 0) return {
			id: this.id,
			title: this.title,
			category: this.category,
			status: "warning",
			summary: "文件读写测试失败",
			detail: failedList.map((r) => `${r.label}: ${r.error}`).join("\n"),
			advice: "请检查客户端安装目录和用户数据目录的读写权限",
			costMs: Date.now() - t0
		};
		const maxAvgMs = Math.max(...successList.map((r) => r.avgMs));
		const maxTarget = successList.find((r) => r.avgMs === maxAvgMs);
		const status = maxAvgMs > SUSPICIOUS_THRESHOLD_MS ? "fail" : maxAvgMs > NORMAL_THRESHOLD_MS ? "warning" : "pass";
		const summary = status === "pass" ? `平均 ${maxAvgMs.toFixed(1)}ms，文件读写正常` : status === "warning" ? `${maxTarget.label}平均 ${maxAvgMs.toFixed(1)}ms，读写响应偏慢` : `${maxTarget.label}平均 ${maxAvgMs.toFixed(1)}ms，疑似被实时监控`;
		const detail = status === "pass" ? void 0 : [...successList.map((r) => `${r.label}: 平均 ${r.avgMs.toFixed(1)}ms`), ...failedList.map((r) => `${r.label}: ${r.error}`)].join("\n");
		const advice = status === "fail" ? "文件读写耗时异常，疑似被安全软件实时扫描。建议在安全软件中将客户端安装目录和用户数据目录加入排除规则" : status === "warning" ? "文件读写耗时偏高，如客户端运行卡顿建议将客户端目录加入安全软件白名单" : void 0;
		return {
			id: this.id,
			title: this.title,
			category: this.category,
			status,
			summary,
			detail,
			advice,
			costMs: Date.now() - t0
		};
	}
	/**
	* 对单个目录做文件读写探测：
	*   预热一次 → 连续 N 次读取 → 计算平均耗时。
	*
	* 每次探测创建独立测试文件，测完立即清理，不残留。
	* 使用点前缀 (`.`) 隐藏文件，避免污染用户目录展示。
	*/
	async probeDirectory(label, dir) {
		const testFile = node_path.join(dir, `.workbuddy-fm-probe-${process.pid}-${Date.now()}.tmp`);
		const content = Buffer.alloc(TEST_FILE_SIZE, "a");
		try {
			const fh = await node_fs.promises.open(testFile, "w");
			try {
				await fh.write(content, 0, content.length, 0);
				await fh.sync();
			} finally {
				await fh.close();
			}
			await node_fs.promises.readFile(testFile);
			const times = [];
			for (let i = 0; i < READ_COUNT; i++) {
				const start = performance.now();
				await node_fs.promises.readFile(testFile);
				times.push(performance.now() - start);
			}
			return {
				label,
				dir,
				avgMs: times.reduce((a, b) => a + b, 0) / times.length
			};
		} catch (err) {
			return {
				label,
				dir,
				avgMs: null,
				error: err instanceof Error ? err.message : String(err)
			};
		} finally {
			try {
				await node_fs.promises.unlink(testFile);
			} catch {}
		}
	}
};
//#endregion
//#region src/main/self-check/items/memory-check.ts
/**
* 内存使用检查项。
*
* 检测：
* 1. **系统可用内存**（与用户体感一致，非 Node `os.freemem()` 的裸 free 值）
* 2. **客户端全部进程占用** —— Electron 是多进程架构，必须聚合而非只看主进程
*
* ⚠️ 关键点：与活动监视器 / 任务管理器"已使用内存"完全对齐的口径。
* - macOS: 已用 = Anonymous + Wired + CompressorOccupied
*   （对应活动监视器：App 内存 + 联动内存 + 被压缩）
* - Linux: 已用 = MemTotal - MemAvailable（与 `free -h` 的 used 列一致）
* - Windows: 已用 = totalmem - freemem（Windows 的 freemem 语义本来就正确）
*
* @see 客户端自检工具需求文档.md §2.2 ⑦
*/
var execFileAsync = (0, node_util.promisify)(node_child_process.execFile);
var DEFAULT_MEMORY_THRESHOLDS = {
	appWarningGb: 4,
	appCriticalGb: 6,
	systemAvailableWarningGb: 2,
	systemAvailableCriticalGb: .5
};
/** 从 product 配置读取内存阈值（与磁盘阈值同一套约定，便于按形态调优） */
function resolveMemoryThresholds(productConfig) {
	const custom = (productConfig?.productFeatures)?.SelfCheckMemoryThresholds;
	if (!custom) return DEFAULT_MEMORY_THRESHOLDS;
	const pick = (key) => {
		const value = custom[key];
		return typeof value === "number" && value > 0 ? value : DEFAULT_MEMORY_THRESHOLDS[key];
	};
	return {
		appWarningGb: pick("appWarningGb"),
		appCriticalGb: pick("appCriticalGb"),
		systemAvailableWarningGb: pick("systemAvailableWarningGb"),
		systemAvailableCriticalGb: pick("systemAvailableCriticalGb")
	};
}
/**
* 聚合客户端全部进程的内存占用。
*
* `app.getAppMetrics()` 覆盖 Electron 侧全部进程（Browser / Renderer / GPU / Utility）；
* `memory.workingSetSize` 单位是 **KB**（Electron 的历史遗留，不是字节，极易算错 1024 倍）。
*
* ⚠️ 已知口径边界：daemon 与 agent-cli 是 `child_process.spawn` 出来的**独立 node 进程**，
* 不属于 Electron 进程树，因此**不在**该聚合内。这是当前实现的已知缺口，
* 报告文案必须限定为「客户端进程」而不能暗示是 WorkBuddy 全部内存开销。
*/
function collectAppMemoryUsage(getAppMetrics) {
	const fallback = {
		totalBytes: process.memoryUsage().rss,
		processCount: 1,
		aggregated: false
	};
	if (!getAppMetrics) return fallback;
	try {
		const metrics = getAppMetrics();
		if (!Array.isArray(metrics) || metrics.length === 0) return fallback;
		let totalBytes = 0;
		let processCount = 0;
		for (const metric of metrics) {
			const workingSetKb = metric?.memory?.workingSetSize;
			if (typeof workingSetKb !== "number" || !Number.isFinite(workingSetKb) || workingSetKb < 0) continue;
			totalBytes += workingSetKb * 1024;
			processCount += 1;
		}
		if (processCount === 0) return fallback;
		return {
			totalBytes,
			processCount,
			aggregated: true
		};
	} catch {
		return fallback;
	}
}
var BYTES_PER_GB = 1024 * 1024 * 1024;
var MemoryCheck = class {
	id = "system.memory.usage";
	title = "内存使用";
	category = "系统资源";
	severity = "minor";
	visibleTo = "b";
	constructor(thresholds = DEFAULT_MEMORY_THRESHOLDS, getAppMetrics) {
		this.thresholds = thresholds;
		this.getAppMetrics = getAppMetrics;
	}
	async run() {
		const t0 = Date.now();
		const appUsage = collectAppMemoryUsage(this.getAppMetrics);
		const appGb = appUsage.totalBytes / BYTES_PER_GB;
		const totalBytes = node_os.totalmem();
		const totalGb = totalBytes / BYTES_PER_GB;
		const { usedBytes, availableBytes } = await getMemoryUsageBytes(totalBytes);
		const availableGb = availableBytes / BYTES_PER_GB;
		const usedGb = usedBytes / BYTES_PER_GB;
		const usagePercent = totalBytes > 0 ? usedBytes / totalBytes * 100 : 0;
		const status = appGb >= this.thresholds.appCriticalGb ? "fail" : appGb >= this.thresholds.appWarningGb ? "warning" : availableGb < this.thresholds.systemAvailableCriticalGb ? "fail" : availableGb < this.thresholds.systemAvailableWarningGb ? "warning" : "pass";
		const appLabel = appUsage.aggregated ? `客户端 ${appGb.toFixed(2)}GB` : `客户端主进程 ${appGb.toFixed(2)}GB`;
		const verdict = status === "pass" ? "内存充足" : status === "warning" ? "内存偏紧" : "内存严重不足";
		const summary = `系统已用 ${usedGb.toFixed(1)}GB / ${totalGb.toFixed(1)}GB（${usagePercent.toFixed(0)}%）· 可用 ${availableGb.toFixed(1)}GB · ${appLabel} · ${verdict}`;
		const detail = [
			`系统总内存: ${totalGb.toFixed(1)}GB`,
			`系统已使用: ${usedGb.toFixed(1)}GB（${usagePercent.toFixed(0)}%）`,
			`系统可用: ${availableGb.toFixed(1)}GB（告警线 ${this.thresholds.systemAvailableWarningGb}GB）`,
			appUsage.aggregated ? `客户端进程占用: ${appGb.toFixed(2)}GB（共 ${appUsage.processCount} 个进程，含主进程 / 窗口 / GPU，不含后台服务进程）` : `客户端主进程占用: ${appGb.toFixed(2)}GB（多进程聚合不可用，仅统计主进程）`
		].join("\n");
		const advice = status === "pass" ? void 0 : appGb >= this.thresholds.appWarningGb ? appGb >= this.thresholds.appCriticalGb ? "客户端内存占用过高，建议重启客户端或联系技术支持" : "客户端内存占用偏高，如运行卡顿可考虑重启客户端" : status === "fail" ? "系统可用内存严重不足，建议关闭其他程序释放内存" : "系统内存偏紧，如客户端卡顿建议关闭部分程序";
		return {
			id: this.id,
			title: this.title,
			category: this.category,
			status,
			summary,
			detail,
			advice,
			costMs: Date.now() - t0
		};
	}
};
/**
* 获取系统内存使用情况。
* 各平台原生接口失败时兜底为 `os.freemem()` 语义（不够准但可用）。
*/
async function getMemoryUsageBytes(totalBytes) {
	try {
		switch (process.platform) {
			case "darwin": return await getMacOsMemoryUsage(totalBytes);
			case "linux": return await getLinuxMemoryUsage(totalBytes);
			default: {
				const availableBytes = node_os.freemem();
				return {
					usedBytes: totalBytes - availableBytes,
					availableBytes
				};
			}
		}
	} catch {
		const availableBytes = node_os.freemem();
		return {
			usedBytes: totalBytes - availableBytes,
			availableBytes
		};
	}
}
/**
* macOS: 解析 `vm_stat`，计算与活动监视器"已使用内存"一致的口径。
*
* 活动监视器"已使用内存" = App 内存 + 联动内存 + 被压缩：
*   - **App 内存** ≈ `Anonymous pages`（匿名脏页，进程 malloc/栈等分配）
*     ⚠️ 不是 `Pages active`（active 只表示"最近访问过"，语义不同，会偏低几个 GB）
*   - **联动内存** = `Pages wired down`
*   - **被压缩** = `Pages occupied by compressor`（压缩后实际占用的物理页）
*
* 其他页面（free / inactive / purgeable / speculative / file-backed）算作"可用"。
* 其中 File-backed 是文件缓存，虽然 active 里有一部分是它，但活动监视器把它算作"已缓存文件"
* 不计入"已使用"，所以我们也不能用 active，而要用 anonymous 排除掉文件缓存部分。
*/
async function getMacOsMemoryUsage(totalBytes) {
	const { stdout } = await execFileAsync("vm_stat", [], {
		encoding: "utf8",
		timeout: 3e3
	});
	const pageSizeMatch = stdout.match(/page size of (\d+) bytes/);
	const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384;
	const readPages = (label) => {
		const re = new RegExp(`${label}:\\s+(\\d+)`);
		const m = stdout.match(re);
		return m ? parseInt(m[1], 10) : 0;
	};
	const anonymousPages = readPages("Anonymous pages");
	const wiredPages = readPages("Pages wired down");
	const compressorPages = readPages("Pages occupied by compressor");
	const usedBytes = (anonymousPages + wiredPages + compressorPages) * pageSize;
	return {
		usedBytes,
		availableBytes: Math.max(0, totalBytes - usedBytes)
	};
}
/**
* Linux: 读 `/proc/meminfo`，已用 = total - MemAvailable（与 `free -h` 显示的 used 列一致）。
* 老内核无 MemAvailable 时回退到 total - (MemFree + Buffers + Cached)。
*/
async function getLinuxMemoryUsage(totalBytes) {
	const content = await node_fs.promises.readFile("/proc/meminfo", "utf-8");
	const readKb = (label) => {
		const re = new RegExp(`^${label}:\\s+(\\d+)\\s+kB`, "m");
		const m = content.match(re);
		return m ? parseInt(m[1], 10) : 0;
	};
	let availableBytes;
	const memAvailable = readKb("MemAvailable");
	if (memAvailable > 0) availableBytes = memAvailable * 1024;
	else {
		const memFree = readKb("MemFree");
		const buffers = readKb("Buffers");
		const cached = readKb("Cached");
		availableBytes = (memFree + buffers + cached) * 1024;
	}
	return {
		usedBytes: Math.max(0, totalBytes - availableBytes),
		availableBytes
	};
}
//#endregion
//#region src/main/self-check/registry.ts
var SelfCheckRegistryImpl = class {
	items = [];
	register(item) {
		if (this.items.some((existing) => existing.id === item.id)) return;
		this.items.push(item);
	}
	getAll() {
		return [...this.items];
	}
	getByCategory(category) {
		return this.items.filter((item) => item.category === category);
	}
	/**
	* 按可见性过滤检查项。
	*
	* @param showFull 是否展示全部检查项（B 端 / 企业账号）
	* - true：返回全部（visibleTo 为 'b' 或 'both'）
	* - false：只返回 'both'（C 端可见的公共项）
	*
	* 注：`visibleTo` 只有两种取值 —— 'both'（公共）和 'b'（仅 B 端）。
	* C 端不需要 'c' 单独可见项，因为公共项即为 C 端能看到的全部。
	*/
	getByVisibility(showFull) {
		const allowed = showFull ? ["b", "both"] : ["both"];
		return this.items.filter((item) => allowed.includes(item.visibleTo));
	}
};
//#endregion
//#region src/main/self-check/visibility.ts
/**
* 检查项可见性判断逻辑。
*
* 优先级：
* 1. `productFeatures.EnableDiagnosticsFull` 开关（读取 bootstrap 合并后的 product）
* 2. 非海外版 && 企业 / IOA 账号登录（enterpriseId 或 tenantId 任一非空）
* 3. 默认：不展示（只保留网络分组）
*
* @see 客户端自检工具需求文档.md §2.1.3 分级判断逻辑
* @see workbuddy-product-config.ts#getWorkbuddyBootstrapProductConfiguration
*/
/**
* 读取当前生效的（bootstrap resolved）product 配置。
*
* 失败时返回 undefined，让调用方走 fallback 逻辑。
*/
function tryGetResolvedProductConfiguration() {
	try {
		return require_workbuddy_product_config.getWorkbuddyBootstrapProductConfiguration();
	} catch {
		return;
	}
}
/**
* 判断是否展示全部检查项（含系统资源 / 安全软件 / 环境信息 / 崩溃日志）。
*
* @param getAuthSession 获取当前认证会话的函数（注入，避免硬依赖 auth 模块）
*/
function shouldShowFullDiagnostics(getAuthSession) {
	const product = tryGetResolvedProductConfiguration();
	const enableFlag = (product?.productFeatures)?.EnableDiagnosticsFull;
	if (typeof enableFlag === "boolean") return enableFlag;
	if (product?.isOversea === true) return false;
	if (!getAuthSession) return false;
	const account = getAuthSession()?.account;
	return !!account?.enterpriseId || !!account?.tenantId;
}
/**
* 派生「当前登录身份键」—— 用于判定自检状态是否仍属于当前账号。
*
* 为什么需要它：{@link shouldShowFullDiagnostics} 的结果是**账号权限**，随登录态实时变化；
* 而 SelfCheckController 是主进程单例，切换账号**不会重启进程**，上一账号跑出的
* `state.showFull` / `state.results` 会原样残留，导致：
* - 企业账号跑过检测后切个人微信号，弹窗仍按 `showFull=true` 渲染全部大类；
* - 个人账号还能看到上一个企业账号在本机的 EDR / 环境信息等检查结果。
*
* 因此把 uid + enterpriseId + tenantId 拼成身份键，交给 controller 比对：
* 键变化即认为状态过期并清空。三者都参与是必要的 ——
* uid 区分账号本身，enterpriseId / tenantId 直接决定 showFull，
* 同一 uid 切换所属企业时同样必须失效。
*
* @returns 已登录返回稳定身份键；未登录 / 未注入取数函数返回 undefined
*/
function resolveDiagnosticsIdentity(getAuthSession) {
	if (!getAuthSession) return;
	const account = getAuthSession()?.account;
	if (!account) return;
	const { uid = "", enterpriseId = "", tenantId = "" } = account;
	if (!uid && !enterpriseId && !tenantId) return;
	return `${uid}|${enterpriseId}|${tenantId}`;
}
//#endregion
//#region src/main/self-check/handlers.ts
/** IPC 通道名 */
var SELF_CHECK_RUN_CHANNEL = "self-check:run";
var SELF_CHECK_EXPORT_CHANNEL = "self-check:export";
var SELF_CHECK_OPEN_DIR_CHANNEL = "self-check:open-dir";
var SELF_CHECK_LOCATE_FILE_CHANNEL = "self-check:locate-file";
var SELF_CHECK_GET_LATEST_CHANNEL = "self-check:get-latest";
var SELF_CHECK_GET_STATE_CHANNEL = "self-check:get-state";
/** IPC 事件通道（Main → Renderer 进度推送） */
var SELF_CHECK_PROGRESS_EVENT = "self-check:progress";
function registerSelfCheckHandlers(registry, deps) {
	const { controller, reportDir, dialog, shell, getReportMeta, getShowFull, broadcast } = deps;
	registry.handle(SELF_CHECK_RUN_CHANNEL, async () => {
		const t0 = Date.now();
		const showFull = getShowFull();
		console.info(`[SelfCheck] run start showFull=${showFull}`);
		try {
			const results = await controller.runAll(showFull, (current, total, result) => {
				broadcast?.(SELF_CHECK_PROGRESS_EVENT, {
					current,
					total,
					result
				});
			});
			const meta = await getReportMeta();
			meta.duration = Date.now() - t0;
			const network = controller.getState().network ?? null;
			const reportPath = await saveReport(reportDir, results, meta, network);
			controller.setLatestReportPath(reportPath);
			controller.setDuration(meta.duration);
			await cleanupOldReports(reportDir);
			console.info(`[SelfCheck] run done items=${results.length} network=${!!network} reportPath=${reportPath} elapsed=${meta.duration}ms`);
			return {
				results,
				reportPath,
				showFull,
				network,
				duration: meta.duration
			};
		} catch (err) {
			console.error(`[SelfCheck] run failed elapsed=${Date.now() - t0}ms error=${err instanceof Error ? err.stack : String(err)}`);
			throw err;
		}
	});
	registry.handle(SELF_CHECK_EXPORT_CHANNEL, async (payload) => {
		const defaultFileName = payload?.defaultFileName || "diagnostics-report.txt";
		let content = payload?.content ?? "";
		if (!content) {
			const latest = await getLatestReport(reportDir);
			if (!latest) throw new Error("尚无可导出的报告，请先执行检测");
			const { promises: fs } = await import("node:fs");
			content = await fs.readFile(latest.path, "utf-8");
		}
		const dialogResult = await dialog.showSaveDialog({
			title: "导出自检报告",
			defaultPath: defaultFileName,
			filters: [{
				name: "Text Report",
				extensions: ["txt"]
			}]
		});
		if (dialogResult.canceled || !dialogResult.filePath) return null;
		await (deps.writeFile ?? (async (fp, c) => {
			const { promises: fs } = await import("node:fs");
			await fs.writeFile(fp, c, "utf-8");
		}))(dialogResult.filePath, content);
		return { filePath: dialogResult.filePath };
	});
	registry.handle(SELF_CHECK_OPEN_DIR_CHANNEL, async () => {
		const { promises: fs } = await import("node:fs");
		await fs.mkdir(reportDir, { recursive: true });
		await shell.openPath(reportDir);
		return true;
	});
	registry.handle(SELF_CHECK_LOCATE_FILE_CHANNEL, async (filePath) => {
		if (!filePath || typeof filePath !== "string") return;
		await shell.showItemInFolder(filePath);
	});
	registry.handle(SELF_CHECK_GET_LATEST_CHANNEL, async () => getLatestReport(reportDir));
	registry.handle(SELF_CHECK_GET_STATE_CHANNEL, async () => {
		const state = controller.getState();
		const showFull = state.showFull ?? getShowFull();
		console.info(`[SelfCheck] get-state phase=${state.phase} items=${state.results.length} showFull=${showFull} (cached=${state.showFull})`);
		return {
			...state,
			showFull
		};
	});
}
//#endregion
//#region src/main/self-check/index.ts
/**
* 自检模块入口 — 组装控制器、注册检查项、注册 IPC handler。
*
* 网络大类特殊处理：不再注册为 SelfCheckItem，而是通过 `networkRunner` 传给
* controller，controller 内部独立编排一次完整网络诊断，把结果附加到 state.network。
* UI 层可用 network-check 的 group 组件直接渲染，保留原有丰富结构。
*
* @see 客户端自检工具需求文档.md §3.1 整体架构
*/
require_workbuddy_product_config.init_workbuddy_product_config();
/**
* 创建并组装自检控制器。
*
* 网络大类由 controller 内部通过 networkRunner 独立编排，不作为 SelfCheckItem 注册。
* 其它大类（系统资源、安全软件、环境信息）保持原有 registry 模式。
*/
function createSelfCheckController(options) {
	const registry = new SelfCheckRegistryImpl();
	const installDir = require_workbuddy_paths.getWorkbuddyInstallDir();
	const configDir = require_workbuddy_paths.getWorkbuddyConfigDir();
	const userDataDir = require_workbuddy_paths.getWorkbuddyUserDataDir();
	const crashLogDir = require_workbuddy_paths.getWorkbuddyLogsDir("Crash-Log");
	const productConfig = require_workbuddy_product_config.tryGetWorkbuddyBaseProductConfiguration();
	registry.register(new DiskSpaceCheck({
		install: installDir,
		userData: userDataDir,
		temp: node_os.tmpdir()
	}, resolveDiskThresholds(productConfig)));
	registry.register(new MemoryCheck(resolveMemoryThresholds(productConfig), options.getAppMetrics));
	registry.register(new EdrCheck({
		installDir,
		userDataDir
	}));
	registry.register(new FileMonitorCheck({
		installDir,
		userDataDir
	}));
	registry.register(new EnvInfoCheck({
		configDir,
		clientVersion: options.clientVersion,
		isPackaged: options.isPackaged ?? true
	}));
	registry.register(new CrashLogCheck({ crashLogDir }));
	return new SelfCheckController(registry, options.networkRunner, () => resolveDiagnosticsIdentity(options.getAuthSession));
}
function getReportMeta(clientVersion) {
	return {
		clientVersion,
		osInfo: `${node_os.type()} ${node_os.release()} (${node_os.arch()})`,
		checkTime: (/* @__PURE__ */ new Date()).toISOString(),
		duration: 0
	};
}
function getShowFull(getAuthSession) {
	return shouldShowFullDiagnostics(getAuthSession);
}
//#endregion
exports.createSelfCheckController = createSelfCheckController;
exports.getReportMeta = getReportMeta;
exports.getShowFull = getShowFull;
exports.registerSelfCheckHandlers = registerSelfCheckHandlers;
