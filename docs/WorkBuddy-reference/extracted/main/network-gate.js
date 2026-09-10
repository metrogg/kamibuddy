const require_chunk = require("./chunk.js");
let fs = require("fs");
fs = require_chunk.__toESM(fs);
let path = require("path");
path = require_chunk.__toESM(path);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let node_util = require("node:util");
let child_process = require("child_process");
let http = require("http");
http = require_chunk.__toESM(http);
let https = require("https");
https = require_chunk.__toESM(https);
let node_dns = require("node:dns");
let net = require("net");
net = require_chunk.__toESM(net);
let dns = require("dns");
dns = require_chunk.__toESM(dns);
//#region ../../packages/workbuddy-server/src/network/wait-for-network-online.ts
/**
* 系统唤醒 / 启动后等待网络真正就绪的小工具。
*
* 背景：desktop host 的 resume 事件早于 macOS WiFi/DNS 重连。原实现是固定
* setTimeout(2_000) 后触发 refreshAndSync，但 2 秒在弱网/慢 WiFi 重连场景
* 往往不够，导致 token sync / connect 撞 ERR_NETWORK_CHANGED 或 fetch timeout。
*
* 在 daemon 架构下，workbuddy-server 不引入 Electron `net`。这里保留 main 的
* "最小等待 + DNS 探测 + 退避轮询 + 超时仍返回"语义，用 Node DNS 作为跨进程
* app-server 可用的网络就绪信号。
*/
var dnsLookupAsync = (0, node_util.promisify)(node_dns.lookup);
var DEFAULT_MIN_DELAY_MS = 1500;
var DEFAULT_MAX_WAIT_MS = 3e4;
var DEFAULT_PROBE_HOST = "copilot.tencent.com";
var PROBE_INTERVALS_MS = [
	500,
	1e3,
	2e3,
	3e3,
	5e3
];
function nextProbeDelay(attempt) {
	return PROBE_INTERVALS_MS[Math.min(attempt, PROBE_INTERVALS_MS.length - 1)];
}
function sleep(ms, signal) {
	if (ms <= 0) return Promise.resolve();
	return new Promise((resolve) => {
		if (signal?.aborted) {
			resolve();
			return;
		}
		const timer = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			resolve();
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}
async function probeOnce(probeHost, probe, signal) {
	if (probe) try {
		return await probe(signal);
	} catch {
		return false;
	}
	try {
		await dnsLookupAsync(probeHost);
		return true;
	} catch {
		return false;
	}
}
async function waitForNetworkOnline(options = {}) {
	const minDelay = Math.max(0, options.minDelay ?? DEFAULT_MIN_DELAY_MS);
	const maxWait = Math.max(minDelay, options.maxWait ?? DEFAULT_MAX_WAIT_MS);
	const probeHost = options.probeHost ?? DEFAULT_PROBE_HOST;
	const { logger, signal, probe } = options;
	const startedAt = Date.now();
	if (signal?.aborted) return {
		ready: false,
		waitedMs: 0,
		aborted: true
	};
	await sleep(minDelay, signal);
	if (signal?.aborted) return {
		ready: false,
		waitedMs: Date.now() - startedAt,
		aborted: true
	};
	if (await probeOnce(probeHost, probe, signal)) {
		const waitedMs = Date.now() - startedAt;
		logger?.info(`[waitForNetworkOnline] ready after ${waitedMs}ms (first probe)`);
		return {
			ready: true,
			waitedMs
		};
	}
	let attempt = 0;
	while (Date.now() - startedAt < maxWait) {
		if (signal?.aborted) return {
			ready: false,
			waitedMs: Date.now() - startedAt,
			aborted: true
		};
		const remaining = maxWait - (Date.now() - startedAt);
		const delay = Math.min(nextProbeDelay(attempt), remaining);
		attempt += 1;
		await sleep(delay, signal);
		if (signal?.aborted) return {
			ready: false,
			waitedMs: Date.now() - startedAt,
			aborted: true
		};
		if (await probeOnce(probeHost, probe, signal)) {
			const waitedMs = Date.now() - startedAt;
			logger?.info(`[waitForNetworkOnline] ready after ${waitedMs}ms (probe attempt ${attempt})`);
			return {
				ready: true,
				waitedMs
			};
		}
	}
	const waitedMs = Date.now() - startedAt;
	logger?.warn(`[waitForNetworkOnline] timed out after ${waitedMs}ms (host=${probeHost}); proceeding anyway`);
	return {
		ready: false,
		waitedMs
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/network/proxy-resolver.ts
function readProxyEnv() {
	const env = process.env;
	return {
		HTTP_PROXY: env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy,
		HTTPS_PROXY: env.HTTPS_PROXY || env.https_proxy,
		ALL_PROXY: env.ALL_PROXY || env.all_proxy,
		NO_PROXY: env.NO_PROXY || env.no_proxy
	};
}
/**
* NO_PROXY matching that mimics curl/node-fetch conventions:
*   - Comma-separated list
*   - "*" disables proxy for everything
*   - Leading "." or bare domain matches the host and all subdomains
*   - IP prefixes (e.g. "10.") match by prefix
*/
function matchesNoProxy(targetHost, noProxy) {
	if (!noProxy) return false;
	const host = targetHost.toLowerCase();
	const rules = noProxy.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
	for (const rule of rules) {
		if (rule === "*") return true;
		const bare = rule.startsWith(".") ? rule.slice(1) : rule;
		if (host === bare || host.endsWith(`.${bare}`) || host.startsWith(rule)) return true;
	}
	return false;
}
function pickProxyUrl(targetProtocol, env) {
	const isHttps = targetProtocol === "https:" || targetProtocol === "https";
	const e = process.env;
	if (isHttps) {
		if (e.HTTPS_PROXY) return {
			url: e.HTTPS_PROXY,
			variable: "HTTPS_PROXY"
		};
		if (e.https_proxy) return {
			url: e.https_proxy,
			variable: "https_proxy"
		};
	}
	if (e.HTTP_PROXY) return {
		url: e.HTTP_PROXY,
		variable: "HTTP_PROXY"
	};
	if (e.http_proxy) return {
		url: e.http_proxy,
		variable: "http_proxy"
	};
	if (e.ALL_PROXY) return {
		url: e.ALL_PROXY,
		variable: "ALL_PROXY"
	};
	if (e.all_proxy) return {
		url: e.all_proxy,
		variable: "all_proxy"
	};
	return {};
}
function isParsableProxyUrl(url) {
	try {
		const u = new URL(url);
		return !!u.hostname && !!u.protocol;
	} catch {
		return false;
	}
}
/**
* Resolve the effective proxy for a target URL using environment variables.
*
* The returned shape mirrors the VSCode fork's `ProxyResolutionInfo` so downstream
* diagnostics code can be shared verbatim.
*/
function resolveProxyFromEnv(targetUrl) {
	let targetHost = "";
	let targetProtocol = "https:";
	try {
		const parsed = new URL(targetUrl);
		targetHost = parsed.hostname;
		targetProtocol = parsed.protocol;
	} catch {}
	const env = readProxyEnv();
	if (matchesNoProxy(targetHost, env.NO_PROXY)) return {
		mode: "none",
		source: "NO_PROXY",
		valid: true,
		detail: "proxy-env-no-proxy-matched"
	};
	const picked = pickProxyUrl(targetProtocol, env);
	if (!picked.url) return {
		mode: "none",
		source: "env",
		valid: true,
		detail: "proxy-env-none-configured"
	};
	const trimmed = picked.url.trim();
	if (!isParsableProxyUrl(trimmed)) return {
		mode: "system",
		source: picked.variable ?? "env",
		valid: false,
		configuredUrl: trimmed,
		environmentVariable: picked.variable,
		detail: "proxy-env-invalid-url"
	};
	return {
		mode: "system",
		source: picked.variable ?? "env",
		valid: true,
		configuredUrl: trimmed,
		resolvedUrl: trimmed,
		environmentVariable: picked.variable,
		detail: "proxy-env-active"
	};
}
//#endregion
//#region ../../packages/workbuddy-server/src/network/diagnostics-service.ts
var NetworkDiagnosticsService = class {
	constructor(options) {
		this.options = options;
		this.reportDirectory = options.reportDirectory;
		this.latestResultFile = path.join(this.reportDirectory, "latest.json");
	}
	async runDiagnostics() {
		const runtimeConfig = await this.options.getRuntimeConfig();
		const endpointUrl = new URL(runtimeConfig.endpoint);
		const host = endpointUrl.hostname;
		const port = this.getDefaultPort(endpointUrl.protocol, endpointUrl.port);
		const hostsFilePath = this.getHostsFilePath();
		const proxyInfo = await this.resolveProxy(runtimeConfig.endpoint);
		const checkedAt = Date.now();
		const [proxy, hosts, service, tcp, packetLoss] = await Promise.all([
			this.runProxyDiagnostics(proxyInfo),
			this.runHostsDiagnostics(host, hostsFilePath),
			this.runServiceDiagnostics(runtimeConfig.endpoint),
			this.runTcpDiagnostics(host, port, proxyInfo),
			this.runPacketLossDiagnostics(host)
		]);
		const overallStatus = this.getOverallStatus([
			proxy,
			hosts,
			service,
			tcp,
			packetLoss
		]);
		const baseResult = {
			isSupported: true,
			checkedAt,
			overallStatus,
			overallSummary: this.getOverallSummary(overallStatus),
			target: {
				endpoint: runtimeConfig.endpoint,
				baseEndpoint: runtimeConfig.baseEndpoint,
				host,
				port,
				protocol: endpointUrl.protocol.replace(":", ""),
				prefixPath: runtimeConfig.prefixPath,
				platform: runtimeConfig.platform,
				proxyMode: this.getProxyModeLabel(proxyInfo),
				proxyUrl: proxyInfo.resolvedUrl ? this.sanitizeUrlForDisplay(proxyInfo.resolvedUrl) : void 0,
				hostsFilePath
			},
			proxy,
			hosts,
			service,
			tcp,
			packetLoss
		};
		const report = await this.generateReport(baseResult);
		const fullResult = {
			...baseResult,
			report
		};
		await this.persistLatestResult(fullResult);
		return fullResult;
	}
	/**
	* Read the most recently persisted diagnostics result from disk.
	*
	* Returns `null` when the file is missing, unreadable, or contains
	* something that doesn't look like a valid result payload — callers
	* should treat `null` as "no cached result, run fresh".
	*/
	async getLatestResult() {
		try {
			const raw = await fs.promises.readFile(this.latestResultFile, "utf-8");
			const parsed = JSON.parse(raw);
			if (!this.looksLikeResult(parsed)) return null;
			return parsed;
		} catch (error) {
			if (error?.code !== "ENOENT") this.options.logger.warn("[NetworkDiagnosticsService] Failed to read latest diagnostics result:", error);
			return null;
		}
	}
	async persistLatestResult(result) {
		try {
			await fs.promises.mkdir(this.reportDirectory, { recursive: true });
			await fs.promises.writeFile(this.latestResultFile, JSON.stringify(result, null, 2), "utf-8");
		} catch (error) {
			this.options.logger.warn("[NetworkDiagnosticsService] Failed to persist latest diagnostics result:", error);
		}
	}
	looksLikeResult(candidate) {
		if (!candidate || typeof candidate !== "object") return false;
		const obj = candidate;
		return typeof obj.checkedAt === "number" && typeof obj.overallStatus === "string" && !!obj.target && !!obj.report;
	}
	async runProxyDiagnostics(proxyInfo) {
		if (!proxyInfo.valid) return {
			status: proxyInfo.mode === "none" ? "success" : "warning",
			summary: proxyInfo.detail,
			detail: proxyInfo.configuredUrl ? `Configured value: ${this.sanitizeUrlForDisplay(proxyInfo.configuredUrl)}` : void 0,
			value: this.getProxyModeLabel(proxyInfo),
			errorType: proxyInfo.mode === "none" ? void 0 : "invalid-proxy-config"
		};
		if (!proxyInfo.resolvedUrl) return {
			status: "success",
			summary: proxyInfo.detail,
			value: this.getProxyModeLabel(proxyInfo)
		};
		try {
			const proxyUrl = new URL(proxyInfo.resolvedUrl);
			const proxyPort = this.getProxyPort(proxyUrl.protocol, proxyUrl.port);
			const tcpResult = await this.measureTcpConnection(proxyUrl.hostname, proxyPort, 3e3);
			if (tcpResult.ok) return {
				status: "success",
				summary: "proxy-reachable",
				detail: proxyInfo.detail,
				value: this.sanitizeUrlForDisplay(proxyInfo.resolvedUrl),
				durationMs: tcpResult.durationMs
			};
			return {
				status: "error",
				summary: "proxy-unreachable",
				detail: tcpResult.error,
				value: this.sanitizeUrlForDisplay(proxyInfo.resolvedUrl),
				errorType: "proxy-unreachable"
			};
		} catch (error) {
			return {
				status: "error",
				summary: "proxy-parse-failed",
				detail: this.getErrorMessage(error),
				value: this.sanitizeUrlForDisplay(proxyInfo.resolvedUrl),
				errorType: "proxy-parse-failed"
			};
		}
	}
	async runHostsDiagnostics(host, hostsFilePath) {
		const hostsEntries = await this.readHostsEntries(host, hostsFilePath);
		const resolvedAddresses = await this.lookupAddresses(host);
		const hostsValue = hostsEntries.length > 0 ? hostsEntries.join(", ") : "No explicit hosts entry";
		const resolvedValue = resolvedAddresses.length > 0 ? resolvedAddresses.join(", ") : "Unresolved";
		if (resolvedAddresses.length > 0) return {
			status: "success",
			summary: hostsEntries.length > 0 ? "hosts-mapped-resolved" : "no-hosts-dns-ok",
			detail: `Hosts: ${hostsValue}\nResolved: ${resolvedValue}`,
			value: hostsValue
		};
		if (hostsEntries.length > 0) return {
			status: "warning",
			summary: "hosts-mapped-unresolved",
			detail: `Hosts: ${hostsValue}`,
			value: hostsValue,
			errorType: "hosts-resolution-mismatch"
		};
		return {
			status: "error",
			summary: "dns-unresolved",
			detail: `Checked hosts file: ${hostsFilePath}`,
			value: host,
			errorType: "dns-unresolved"
		};
	}
	async runServiceDiagnostics(endpoint) {
		const start = Date.now();
		try {
			await this.probeService(endpoint);
			const durationMs = Date.now() - start;
			return {
				status: "success",
				summary: "service-reachable",
				detail: `Endpoint: ${endpoint}`,
				value: "HTTP OK",
				durationMs
			};
		} catch (error) {
			const durationMs = Date.now() - start;
			return {
				status: "error",
				summary: "service-unreachable",
				detail: this.getErrorMessage(error),
				value: "HTTP Failed",
				durationMs,
				errorType: this.getErrorType(error)
			};
		}
	}
	async runTcpDiagnostics(host, port, proxyInfo) {
		const tcpResult = await this.measureTcpConnection(host, port, 3e3);
		if (tcpResult.ok) return {
			status: "success",
			summary: "tcp-connected",
			value: `${host}:${port}`,
			durationMs: tcpResult.durationMs
		};
		if (proxyInfo.resolvedUrl) return {
			status: "warning",
			summary: "tcp-failed-with-proxy",
			detail: tcpResult.error,
			value: `${host}:${port}`,
			errorType: "direct-tcp-failed-with-proxy"
		};
		return {
			status: "error",
			summary: "tcp-connect-failed",
			detail: tcpResult.error,
			value: `${host}:${port}`,
			errorType: "tcp-connect-failed"
		};
	}
	async runPacketLossDiagnostics(host) {
		const result = await this.measurePacketLoss(host, 18, 3e4);
		const transmissionSummary = result.transmitted !== void 0 && result.received !== void 0 ? `Sent: ${result.transmitted} · Received: ${result.received}` : void 0;
		if (result.unsupported) return {
			status: "unsupported",
			summary: "packet-loss-unsupported",
			detail: result.error || transmissionSummary,
			value: "Ping unavailable",
			errorType: "packet-loss-unsupported"
		};
		if (typeof result.lossPercentage !== "number") return {
			status: "unsupported",
			summary: "packet-loss-unparsed",
			detail: result.error || transmissionSummary || result.rawOutput,
			value: "Packet loss unavailable",
			errorType: "packet-loss-unparsed"
		};
		if (result.lossPercentage === 0) return {
			status: "success",
			summary: "packet-loss-none",
			detail: transmissionSummary,
			value: `${result.lossPercentage}% loss`,
			durationMs: result.durationMs
		};
		return {
			status: "warning",
			summary: result.lossPercentage >= 100 ? "packet-loss-all" : "packet-loss-detected",
			detail: transmissionSummary,
			value: `${result.lossPercentage}% loss`,
			durationMs: result.durationMs,
			errorType: result.lossPercentage >= 100 ? "packet-loss-all" : "packet-loss-detected"
		};
	}
	async measureTcpConnection(host, port, timeoutMs) {
		return await new Promise((resolve) => {
			const startedAt = Date.now();
			const socket = net.connect({
				host,
				port
			});
			let settled = false;
			const finish = (result) => {
				if (settled) return;
				settled = true;
				socket.removeAllListeners();
				socket.destroy();
				resolve(result);
			};
			socket.setTimeout(timeoutMs);
			socket.once("connect", () => {
				finish({
					ok: true,
					durationMs: Date.now() - startedAt
				});
			});
			socket.once("timeout", () => {
				finish({
					ok: false,
					error: `Connection timed out after ${timeoutMs}ms.`
				});
			});
			socket.once("error", (error) => {
				finish({
					ok: false,
					error: this.getErrorMessage(error)
				});
			});
		});
	}
	async measurePacketLoss(host, count, timeoutMs) {
		const startedAt = Date.now();
		const isWindows = process.platform === "win32";
		const args = isWindows ? [
			"-n",
			String(count),
			host
		] : [
			"-c",
			String(count),
			"-n",
			host
		];
		const { output, error } = await this.runPing(args, timeoutMs, isWindows);
		const durationMs = Date.now() - startedAt;
		const parsed = this.parsePacketLossOutput(output);
		if (parsed) return {
			...parsed,
			durationMs,
			rawOutput: output
		};
		if (error && "code" in error && error.code === "ENOENT") return {
			unsupported: true,
			durationMs,
			error: "Ping command is not available in current environment.",
			rawOutput: output
		};
		return {
			durationMs,
			error: output || (error ? this.getErrorMessage(error) : "Failed to parse ping output."),
			rawOutput: output
		};
	}
	async runPing(args, timeoutMs, isWindows) {
		return new Promise((resolve) => {
			if (isWindows) (0, child_process.execFile)("ping", args, {
				timeout: timeoutMs,
				windowsHide: true,
				encoding: "buffer"
			}, (err, stdout, stderr) => {
				this.decodeWindowsOutput(stdout, stderr).then((output) => {
					resolve({
						output,
						error: err
					});
				});
			});
			else (0, child_process.execFile)("ping", args, {
				timeout: timeoutMs,
				windowsHide: true
			}, (err, stdout, stderr) => {
				resolve({
					output: `${stdout || ""}${stderr ? `\n${stderr}` : ""}`.trim(),
					error: err
				});
			});
		});
	}
	async decodeWindowsOutput(stdout, stderr) {
		try {
			const iconv = await Promise.resolve().then(() => /* @__PURE__ */ require_chunk.__toESM(require("./lib.js").default));
			let output = "";
			if (stdout && stdout.length > 0) output = iconv.decode(stdout, "cp936");
			if (stderr && stderr.length > 0) output += `\n${iconv.decode(stderr, "cp936")}`;
			return output.trim();
		} catch (err) {
			this.options.logger.warn("[NetworkDiagnosticsService] Failed to decode Windows ping output with iconv-lite:", err);
			return `${stdout?.toString("utf-8") || ""}${stderr ? `\n${stderr.toString("utf-8")}` : ""}`.trim();
		}
	}
	parsePacketLossOutput(output) {
		if (!output) return;
		const windowsMatch = /Sent\s*=\s*(\d+),\s*Received\s*=\s*(\d+),\s*Lost\s*=\s*(\d+)\s*\((\d+)%\s*loss\)/i.exec(output);
		if (windowsMatch) return {
			transmitted: Number(windowsMatch[1]),
			received: Number(windowsMatch[2]),
			lossPercentage: Number(windowsMatch[4])
		};
		const windowsChineseMatch = /\u5df2\u53d1\u9001\s*=\s*(\d+)[\uff0c,]\s*\u5df2\u63a5\u6536\s*=\s*(\d+)[\uff0c,]\s*\u4e22\u5931\s*=\s*(\d+)\s*\((\d+)%\s*\u4e22\u5931\)/i.exec(output);
		if (windowsChineseMatch) return {
			transmitted: Number(windowsChineseMatch[1]),
			received: Number(windowsChineseMatch[2]),
			lossPercentage: Number(windowsChineseMatch[4])
		};
		const unixDetailedMatch = /(\d+)\s+packets transmitted,\s*(\d+)\s+(?:packets )?received.*?(\d+(?:\.\d+)?)%\s+packet loss/i.exec(output);
		if (unixDetailedMatch) return {
			transmitted: Number(unixDetailedMatch[1]),
			received: Number(unixDetailedMatch[2]),
			lossPercentage: Number(unixDetailedMatch[3])
		};
		const genericLossMatch = /(\d+(?:\.\d+)?)%\s+packet loss/i.exec(output);
		if (genericLossMatch) return { lossPercentage: Number(genericLossMatch[1]) };
	}
	async lookupAddresses(host) {
		return await new Promise((resolve) => {
			dns.lookup(host, {
				all: true,
				verbatim: true
			}, (error, addresses) => {
				if (error || !addresses) {
					resolve([]);
					return;
				}
				resolve(addresses.map((address) => address.address));
			});
		});
	}
	async readHostsEntries(host, hostsFilePath) {
		try {
			const content = await fs.promises.readFile(hostsFilePath, "utf-8");
			const matches = [];
			const expectedHost = host.toLowerCase();
			for (const rawLine of content.split(/\r?\n/)) {
				const line = rawLine.replace(/#.*/, "").trim();
				if (!line) continue;
				const parts = line.split(/\s+/).filter(Boolean);
				if (parts.length < 2) continue;
				const [ip, ...aliases] = parts;
				if (aliases.some((alias) => alias.toLowerCase() === expectedHost)) matches.push(ip);
			}
			return matches;
		} catch (error) {
			this.options.logger.warn("[NetworkDiagnosticsService] Failed to read hosts file:", error);
			return [];
		}
	}
	async generateReport(result) {
		const fileName = `network-diagnostics-${this.formatTimestampForFileName(result.checkedAt)}.txt`;
		const filePath = path.join(this.reportDirectory, fileName);
		const content = this.buildReportContent(result, this.reportDirectory, fileName, filePath);
		try {
			await fs.promises.mkdir(this.reportDirectory, { recursive: true });
			await fs.promises.writeFile(filePath, content, "utf-8");
			return {
				directory: this.reportDirectory,
				filePath,
				fileName,
				content
			};
		} catch (error) {
			const message = this.getErrorMessage(error);
			this.options.logger.error("[NetworkDiagnosticsService] Failed to write diagnostics report:", message);
			return {
				directory: this.reportDirectory,
				filePath,
				fileName,
				content,
				error: message
			};
		}
	}
	buildReportContent(result, directory, fileName, filePath) {
		const lines = [
			`${this.options.productName} Network Diagnostics Report`,
			"==================================",
			`Generated At: ${new Date(result.checkedAt).toLocaleString()}`,
			`Report Directory: ${directory}`,
			`Report File: ${fileName}`,
			`Report File Path: ${filePath}`,
			"",
			`Overall Status: ${result.overallStatus}`,
			`Overall Summary: ${result.overallSummary}`,
			"",
			"[Target]",
			`Endpoint: ${result.target.endpoint}`,
			`Base Endpoint: ${result.target.baseEndpoint}`,
			`Target Host: ${result.target.host}:${result.target.port}`,
			`Protocol: ${result.target.protocol}`,
			`Prefix Path: ${result.target.prefixPath}`,
			`Platform: ${result.target.platform}`,
			`Proxy Mode: ${result.target.proxyMode}`,
			`Proxy URL: ${result.target.proxyUrl || "N/A"}`,
			`Hosts File: ${result.target.hostsFilePath}`,
			"",
			"[Checks]"
		];
		this.appendCheckLines(lines, "Proxy Detection", result.proxy);
		this.appendCheckLines(lines, "Hosts Resolution", result.hosts);
		this.appendCheckLines(lines, "Service Connectivity", result.service);
		this.appendCheckLines(lines, "TCP Connection Latency", result.tcp);
		this.appendCheckLines(lines, "Packet Loss", result.packetLoss);
		return lines.join("\n");
	}
	appendCheckLines(lines, title, item) {
		lines.push(`- ${title}`);
		lines.push(`  Status: ${item.status}`);
		lines.push(`  Summary: ${item.summary}`);
		if (item.value) lines.push(`  Value: ${item.value}`);
		if (typeof item.durationMs === "number") lines.push(`  Duration: ${item.durationMs} ms`);
		if (item.detail) lines.push(`  Detail: ${item.detail.replace(/\n/g, " | ")}`);
		if (item.errorType) lines.push(`  Error Type: ${item.errorType}`);
		lines.push("");
	}
	formatTimestampForFileName(timestamp) {
		const date = new Date(timestamp);
		const pad = (value, size = 2) => value.toString().padStart(size, "0");
		return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
	}
	getHostsFilePath() {
		if (process.platform === "win32") return `${process.env.SystemRoot || "C:\\Windows"}\\System32\\drivers\\etc\\hosts`;
		return "/etc/hosts";
	}
	getDefaultPort(protocol, explicitPort) {
		if (explicitPort) return Number(explicitPort);
		return protocol === "http:" ? 80 : 443;
	}
	getProxyPort(protocol, explicitPort) {
		if (explicitPort) return Number(explicitPort);
		switch (protocol) {
			case "http:": return 80;
			case "https:": return 443;
			case "socks:":
			case "socks4:":
			case "socks5:": return 1080;
			default: return 80;
		}
	}
	sanitizeUrlForDisplay(url) {
		try {
			const parsed = new URL(url);
			parsed.username = "";
			parsed.password = "";
			return parsed.toString();
		} catch {
			return url;
		}
	}
	getOverallStatus(items) {
		if (items.some((item) => item.status === "error")) return "error";
		if (items.some((item) => item.status === "warning")) return "warning";
		return "success";
	}
	getOverallSummary(status) {
		switch (status) {
			case "error": return "overall-error";
			case "warning": return "overall-warning";
			default: return "overall-success";
		}
	}
	getErrorMessage(error) {
		if (error instanceof Error) return error.message;
		return String(error);
	}
	getErrorType(error) {
		const message = this.getErrorMessage(error).toLowerCase();
		if (message.includes("timeout")) return "timeout";
		if (message.includes("enotfound")) return "dns-not-found";
		if (message.includes("econnrefused")) return "connection-refused";
		if (message.includes("proxy")) return "proxy-error";
		if (message.includes("certificate")) return "tls-certificate-error";
		return "network-error";
	}
	getProxyModeLabel(proxyInfo) {
		switch (proxyInfo.mode) {
			case "vscode": return "VS Code http.proxy";
			case "system": return "System Proxy";
			case "manual": return "Manual Proxy";
			default: return "No Proxy";
		}
	}
	async resolveProxy(targetUrl) {
		if (this.options.resolveProxy) return await this.options.resolveProxy(targetUrl);
		return resolveProxyFromEnv(targetUrl);
	}
	async probeService(endpoint) {
		if (this.options.probeService) return await this.options.probeService(endpoint);
		return await defaultHttpProbe(endpoint, 5e3);
	}
};
/**
* Default service connectivity probe: an HTTP(S) GET with a hard timeout.
* Resolves when the server responds with any status code (the service is
* "reachable"); rejects on network failure or timeout.
*/
function defaultHttpProbe(endpoint, timeoutMs) {
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (err) => {
			if (settled) return;
			settled = true;
			if (err) reject(err);
			else resolve();
		};
		let url;
		try {
			url = new URL(endpoint);
		} catch (error) {
			reject(error);
			return;
		}
		const req = (url.protocol === "http:" ? http : https).request({
			method: "GET",
			hostname: url.hostname,
			port: url.port || (url.protocol === "http:" ? 80 : 443),
			path: url.pathname + url.search,
			timeout: timeoutMs
		}, (response) => {
			response.resume();
			finish();
		});
		req.on("timeout", () => {
			req.destroy(/* @__PURE__ */ new Error(`Service probe timed out after ${timeoutMs}ms.`));
		});
		req.on("error", (err) => finish(err));
		req.end();
	});
}
//#endregion
//#region ../../packages/workbuddy-server/src/network/diagnostics-factory.ts
function createWorkbuddyNetworkDiagnosticsRuntimeConfigResolver(celljs) {
	return async () => {
		const resolved = celljs.coordinator.getResolvedSnapshot();
		const endpoint = resolved.endpoint ?? "";
		const attrs = resolved.authentication?.attributes;
		return {
			endpoint,
			baseEndpoint: endpoint,
			prefixPath: attrs?.prefixPath ?? "",
			platform: attrs?.platform ?? resolved.platform ?? ""
		};
	};
}
async function createWorkbuddyNetworkDiagnosticsService(options) {
	const celljs = await options.celljs;
	const fallback = typeof options.productNameFallback === "function" ? options.productNameFallback() : options.productNameFallback;
	return new NetworkDiagnosticsService({
		productName: celljs.productManager.configuration.getValue()?.productName ?? fallback ?? "WorkBuddy",
		reportDirectory: node_path.join(options.configDir, "logs", "network"),
		logger: options.logger,
		getRuntimeConfig: createWorkbuddyNetworkDiagnosticsRuntimeConfigResolver(celljs)
	});
}
//#endregion
//#region ../../packages/workbuddy-server/src/network/network-gate.ts
/**
* Network Gate — 网络就绪状态守门。
*
* daemon侧的轮询请求（marketplace updater、msgCenter、ima auth、expert market）
* 在发起前检查 gate 是否 open。suspend/离线时关闭 gate，resume + DNS probe 通过后
* 重新打开，避免网络不通时产生大量注定超时的无效请求。
*
* 接入方式：通过构造函数 deps 或 provider 函数注入（非全局单例）。
*/
var TAG = "[NetworkGate]";
var DEFAULT_MAX_PROBE_WAIT = 3e4;
var NetworkGate = class {
	constructor(opts) {
		this._open = true;
		this._probing = false;
		this._listeners = /* @__PURE__ */ new Set();
		this._maxProbeWait = opts?.maxProbeWait ?? DEFAULT_MAX_PROBE_WAIT;
		this._probeHost = opts?.probeHost;
		this._logger = opts?.logger;
	}
	/** 当前 gate 是否打开（网络就绪） */
	get isOpen() {
		return this._open;
	}
	/** 轮询回调中调用：gate 关闭时返回 true表示应跳过本次请求 */
	shouldSkip() {
		return !this._open;
	}
	/**
	* 关闭 gate（标记网络不可用）。
	* 用于 suspend /检测到网络断开时调用。
	*/
	close() {
		if (!this._open) return;
		this._open = false;
		this._logger?.info(`${TAG} gate closed (network unavailable)`);
		this._notifyListeners(false);
	}
	/**
	* 异步打开 gate：先DNS 探测，探测通过后才标记为 open。
	* 若探测超时仍强制打开（避免永久关闭）。
	*/
	async open() {
		if (this._probing) return {
			ready: this._open,
			waitedMs: 0
		};
		this._probing = true;
		this._logger?.info(`${TAG} probing network...`);
		try {
			const result = await waitForNetworkOnline({
				maxWait: this._maxProbeWait,
				probeHost: this._probeHost,
				logger: this._logger
			});
			this._open = true;
			this._logger?.info(`${TAG} gate opened (ready=${result.ready}, waited=${result.waitedMs}ms)`);
			this._notifyListeners(true);
			return result;
		} finally {
			this._probing = false;
		}
	}
	/** 监听 gate 状态变化 */
	onGateChange(listener) {
		this._listeners.add(listener);
		return () => {
			this._listeners.delete(listener);
		};
	}
	/** 等待 gate 打开（用于需要阻塞直到网络就绪的场景） */
	async waitUntilOpen(timeoutMs) {
		if (this._open) return true;
		const deadline = timeoutMs ?? this._maxProbeWait;
		return new Promise((resolve) => {
			const unsub = this.onGateChange((open) => {
				if (open) {
					clearTimeout(timer);
					unsub();
					resolve(true);
				}
			});
			const timer = setTimeout(() => {
				unsub();
				resolve(this._open);
			}, deadline);
			if (typeof timer.unref === "function") timer.unref();
		});
	}
	_notifyListeners(open) {
		for (const listener of this._listeners) try {
			listener(open);
		} catch {}
	}
};
//#endregion
Object.defineProperty(exports, "NetworkDiagnosticsService", {
	enumerable: true,
	get: function() {
		return NetworkDiagnosticsService;
	}
});
Object.defineProperty(exports, "NetworkGate", {
	enumerable: true,
	get: function() {
		return NetworkGate;
	}
});
Object.defineProperty(exports, "createWorkbuddyNetworkDiagnosticsRuntimeConfigResolver", {
	enumerable: true,
	get: function() {
		return createWorkbuddyNetworkDiagnosticsRuntimeConfigResolver;
	}
});
Object.defineProperty(exports, "createWorkbuddyNetworkDiagnosticsService", {
	enumerable: true,
	get: function() {
		return createWorkbuddyNetworkDiagnosticsService;
	}
});
Object.defineProperty(exports, "resolveProxyFromEnv", {
	enumerable: true,
	get: function() {
		return resolveProxyFromEnv;
	}
});
Object.defineProperty(exports, "waitForNetworkOnline", {
	enumerable: true,
	get: function() {
		return waitForNetworkOnline;
	}
});
