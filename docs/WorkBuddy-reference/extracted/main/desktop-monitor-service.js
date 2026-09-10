const require_chunk = require("./chunk.js");
const require_common$1 = require("./common.js");
const require_proxy_agents = require("./proxy-agents.js");
const require_src$1 = require("./src.js");
const require_workbuddy_paths = require("./workbuddy-paths.js");
const require_app_instance = require("./app-instance.js");
const require_logger$2 = require("./logger2.js");
const require_session_create_timing = require("./session-create-timing.js");
const require_startup_perf_exporters = require("./startup-perf-exporters.js");
let electron = require("electron");
let node_fs = require("node:fs");
node_fs = require_chunk.__toESM(node_fs);
let node_path = require("node:path");
node_path = require_chunk.__toESM(node_path);
let events = require("events");
//#region ../../packages/monitor/src/common/types/metrics.ts
/**
* 指标类型
*/
var MetricType = /* @__PURE__ */ function(MetricType) {
	/** 计数器：单调递增，用于请求总数、错误总数 */
	MetricType["Counter"] = "counter";
	/** 瞬时值：可增可减，用于内存使用、CPU使用、队列长度 */
	MetricType["Gauge"] = "gauge";
	/** 直方图：值分布统计，用于延迟分布、响应时间分布 */
	MetricType["Histogram"] = "histogram";
	/** 可增减计数器：可增可减的计数器，用于活跃连接数、并发请求数 */
	MetricType["UpDownCounter"] = "updowncounter";
	return MetricType;
}({});
//#endregion
//#region ../../packages/monitor/src/common/interfaces/exporter.ts
/**
* Abstract base class implementing common exporter functionality
* Uses Template Method Pattern with hooks for subclass customization
*
* Provides:
* - Error handling and retry support
* - Status tracking (success/failure counts, timing)
* - Lifecycle management (initialize/shutdown)
* - Connection state tracking
*
* Subclasses implement:
* - onInitialize(): Setup resources (connections, file handles, etc.)
* - onShutdown(): Cleanup resources
* - onExport(metrics): Actual export logic
* - onFlush(): Flush pending data (optional)
*/
var AbstractExporter = class {
	constructor(name, enabled = true) {
		this.name = name;
		this.enabled = enabled;
		this.connected = false;
		this.initialized = false;
		this.successCount = 0;
		this.failureCount = 0;
		this.queueSize = 0;
		this.config = { enabled };
	}
	/**
	* Initialize the exporter
	* Template method that calls onInitialize() hook
	*/
	async initialize() {
		if (this.initialized) {
			this.logger?.info(`[${this.name}] Exporter already initialized`);
			return;
		}
		if (!this.enabled) {
			this.logger?.info(`[${this.name}] Exporter is disabled, skipping initialization`);
			return;
		}
		try {
			await this.onInitialize();
			this.initialized = true;
			this.connected = true;
			this.logger?.info(`[${this.name}] Exporter initialized successfully`);
		} catch (error) {
			this.lastError = error;
			this.logger?.error(`[${this.name}] Initialization failed:`, error);
			throw error;
		}
	}
	/**
	* Shutdown the exporter gracefully
	* Template method that calls onShutdown() hook
	*/
	async shutdown() {
		if (!this.initialized) return;
		try {
			await this.flush();
			await this.onShutdown();
			this.connected = false;
			this.initialized = false;
			this.logger?.info(`[${this.name}] Exporter shutdown successfully`);
		} catch (error) {
			this.lastError = error;
			this.logger?.error(`[${this.name}] Shutdown error:`, error);
			throw error;
		}
	}
	/**
	* Export metrics with automatic error handling
	* Template method that calls onExport() hook
	* Re-throws errors for retry logic in upper layers
	*/
	async export(metrics) {
		this.logger?.info(`[${this.name}] export() called with ${metrics?.length || 0} metrics, enabled: ${this.enabled}, initialized: ${this.initialized}`);
		if (!this.enabled || !this.initialized) {
			this.logger?.warn(`[${this.name}] Exporter not ready, enabled: ${this.enabled}, initialized: ${this.initialized}`);
			return;
		}
		if (!metrics || metrics.length === 0) {
			this.logger?.info(`[${this.name}] No metrics to export`);
			return;
		}
		this.queueSize = metrics.length;
		try {
			this.logger?.info(`[${this.name}] Calling onExport() with ${metrics.length} metrics...`);
			await this.onExport(metrics);
			this.successCount++;
			this.lastExportTime = Date.now();
			this.queueSize = 0;
			this.logger?.info(`[${this.name}] onExport() completed successfully`);
		} catch (error) {
			this.failureCount++;
			this.lastError = error;
			this.queueSize = 0;
			this.logger?.error(`[${this.name}] Export failed:`, error);
			throw error;
		}
	}
	/**
	* Flush pending metrics
	* Template method that calls onFlush() hook
	*/
	async flush() {
		if (!this.enabled || !this.initialized) return;
		try {
			await this.onFlush();
		} catch (error) {
			this.lastError = error;
			this.logger?.error(`[${this.name}] Flush error:`, error);
		}
	}
	/**
	* Configure the exporter
	* Template method that calls onConfigure() hook
	*/
	configure(config) {
		this.config = config;
		this.onConfigure(config);
	}
	/**
	* Get current exporter status
	*/
	getStatus() {
		return {
			name: this.name,
			enabled: this.enabled,
			connected: this.connected,
			successCount: this.successCount,
			failureCount: this.failureCount,
			queueSize: this.queueSize,
			lastExportTime: this.lastExportTime,
			lastError: this.lastError
		};
	}
	/**
	* Check connection status
	*/
	isConnected() {
		return this.connected && this.initialized;
	}
	/**
	* Flush any pending/buffered data
	* Called during shutdown and manual flush operations
	* Default implementation is no-op (override if buffering is used)
	*/
	async onFlush() {}
	/**
	* Handle configuration updates
	* Called when configure() is invoked
	* Default implementation is no-op (override if needed)
	*/
	onConfigure(config) {}
};
//#endregion
//#region ../../packages/monitor/src/exporters/galileo/otel-mapper.ts
var OTelMapper = class {
	constructor(resourceConfig, options) {
		this.scopeName = "genie-monitor";
		this.scopeVersion = "1.0.0";
		this.histogramBounds = [
			1,
			2,
			5,
			10,
			20,
			50,
			100,
			200,
			500,
			1e3,
			2e3,
			5e3,
			1e4,
			2e4,
			3e4
		];
		this.useOtelJsonLogFields = options?.useOtelJsonLogFields === true;
		this.resource = { attributes: [
			{
				key: "target",
				value: { stringValue: resourceConfig.target }
			},
			{
				key: "type",
				value: { stringValue: "resource" }
			},
			{
				key: "env_name",
				value: { stringValue: resourceConfig.envName || "production" }
			},
			{
				key: "instance",
				value: { stringValue: resourceConfig.instance || this.generateInstanceId() }
			},
			{
				key: "namespace",
				value: { stringValue: resourceConfig.namespace || "Development" }
			},
			{
				key: "version",
				value: { stringValue: resourceConfig.version }
			},
			{
				key: "container_name",
				value: { stringValue: `genie.${resourceConfig.target}` }
			},
			{
				key: "ideType",
				value: { stringValue: resourceConfig.ideType }
			},
			{
				key: "ideVersion",
				value: { stringValue: resourceConfig.ideVersion }
			},
			{
				key: "os",
				value: { stringValue: resourceConfig.os }
			},
			{
				key: "ext1",
				value: { stringValue: resourceConfig.ext1 || "unknown" }
			}
		] };
	}
	/**
	* 转换指标批次为 OTel 格式（按 collector 分组）
	*/
	mapMetrics(metrics) {
		const metricsByCollector = this.groupMetricsByCollector(metrics);
		const scopeMetrics = [];
		for (const [collectorName, collectorMetrics] of metricsByCollector.entries()) {
			const scopeName = this.generateScopeName(collectorName);
			const groupedMetrics = this.groupMetricsByName(collectorMetrics);
			const otelMetrics = [];
			for (const [name, metricGroup] of groupedMetrics.entries()) {
				const otelMetric = this.mapMetricGroup(name, metricGroup);
				if (otelMetric) otelMetrics.push(otelMetric);
			}
			scopeMetrics.push({
				scope: {
					name: scopeName,
					version: this.scopeVersion
				},
				metrics: otelMetrics
			});
		}
		if (scopeMetrics.length === 0) scopeMetrics.push({
			scope: {
				name: this.scopeName,
				version: this.scopeVersion
			},
			metrics: []
		});
		return { resourceMetrics: [{
			resource: this.resource,
			scopeMetrics
		}] };
	}
	/**
	* 按 metadata.collector 分组
	*/
	groupMetricsByCollector(metrics) {
		const groups = /* @__PURE__ */ new Map();
		for (const metric of metrics) {
			let collectorName = metric.metadata?.collector;
			if (!collectorName) collectorName = this.inferCollectorFromMetricName(metric.name);
			if (!groups.has(collectorName)) groups.set(collectorName, []);
			groups.get(collectorName).push(metric);
		}
		return groups;
	}
	/**
	* 从指标名称推断 Collector
	* 用于 fallback，当 metadata.collector 不存在时
	*/
	inferCollectorFromMetricName(metricName) {
		for (const [prefix, collector] of Object.entries({
			"genie.auth.": "AuthCollector",
			"genie.request.": "ChatRequestCollector",
			"genie.checkpoint.": "CheckpointCollector",
			"genie.completion.": "CompletionCollector",
			"genie.file.": "FileOperationCollector",
			"genie.ipc.": "IPCCollector",
			"genie.mcp.": "MCPCollector",
			"genie.page.": "PagePerformanceCollector",
			"genie.tool.": "ToolExecutionCollector",
			"genie.system.": "SystemCollector"
		})) if (metricName.startsWith(prefix)) return collector;
		return "unknown";
	}
	/**
	* 根据 Collector 名称生成 scopeName
	* 直接使用 collector 名称作为 scopeName
	*/
	generateScopeName(collectorName) {
		if (collectorName === "unknown") return "Custom_" + this.scopeName;
		return "Custom_" + collectorName;
	}
	/**
	* 按指标名称分组
	*/
	groupMetricsByName(metrics) {
		const groups = /* @__PURE__ */ new Map();
		for (const metric of metrics) {
			if (!groups.has(metric.name)) groups.set(metric.name, []);
			groups.get(metric.name).push(metric);
		}
		return groups;
	}
	/**
	* 转换单个指标组
	*/
	mapMetricGroup(name, metrics) {
		if (metrics.length === 0) return null;
		switch (metrics[0].type) {
			case MetricType.Counter: return this.mapCounter(name, metrics);
			case MetricType.Gauge: return this.mapGauge(name, metrics);
			case MetricType.Histogram: return this.mapHistogram(name, metrics);
			case MetricType.UpDownCounter: return this.mapUpDownCounter(name, metrics);
			default: return null;
		}
	}
	/**
	* 转换 Counter 指标
	*/
	mapCounter(name, metrics) {
		const dataPoints = metrics.map((metric) => ({
			timeUnixNano: this.toNanoTimestamp(metric.timestamp),
			asDouble: metric.value,
			attributes: this.mapMetricAttributes(metric)
		}));
		return {
			name,
			description: this.getMetricDescription(name),
			unit: this.getMetricUnit(name),
			sum: {
				dataPoints,
				aggregationTemporality: 1,
				isMonotonic: true
			}
		};
	}
	/**
	* 转换 Gauge 指标
	*/
	mapGauge(name, metrics) {
		const dataPoints = metrics.map((metric) => ({
			timeUnixNano: this.toNanoTimestamp(metric.timestamp),
			asDouble: metric.value,
			attributes: this.mapMetricAttributes(metric)
		}));
		return {
			name,
			description: this.getMetricDescription(name),
			unit: this.getMetricUnit(name),
			gauge: { dataPoints }
		};
	}
	/**
	* 转换 Histogram 指标
	*/
	mapHistogram(name, metrics) {
		const dataPoints = this.aggregateHistogramData(metrics);
		return {
			name,
			description: this.getMetricDescription(name),
			unit: this.getMetricUnit(name),
			histogram: {
				dataPoints,
				aggregationTemporality: 1
			}
		};
	}
	/**
	* 转换 UpDownCounter 指标
	*/
	mapUpDownCounter(name, metrics) {
		const dataPoints = metrics.map((metric) => ({
			timeUnixNano: this.toNanoTimestamp(metric.timestamp),
			asDouble: metric.value,
			attributes: this.mapMetricAttributes(metric)
		}));
		return {
			name,
			description: this.getMetricDescription(name),
			unit: this.getMetricUnit(name),
			sum: {
				dataPoints,
				aggregationTemporality: 1,
				isMonotonic: false
			}
		};
	}
	/**
	* 聚合 Histogram 数据到桶中
	*/
	aggregateHistogramData(metrics) {
		const groups = /* @__PURE__ */ new Map();
		for (const metric of metrics) {
			const key = this.getLabelKey(metric.labels);
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(metric);
		}
		const dataPoints = [];
		for (const [, groupMetrics] of groups.entries()) {
			const bucketCounts = new Array(this.histogramBounds.length + 1).fill(0);
			let sum = 0;
			let count = 0;
			for (const metric of groupMetrics) {
				const value = metric.value;
				sum += value;
				count++;
				let bucketIndex = this.histogramBounds.findIndex((bound) => value <= bound);
				if (bucketIndex === -1) bucketIndex = this.histogramBounds.length;
				bucketCounts[bucketIndex]++;
			}
			const latestTimestamp = Math.max(...groupMetrics.map((m) => m.timestamp));
			dataPoints.push({
				timeUnixNano: this.toNanoTimestamp(latestTimestamp),
				count: count.toString(),
				sum,
				bucketCounts: bucketCounts.map((c) => c.toString()),
				explicitBounds: this.histogramBounds,
				attributes: this.mapMetricAttributes(groupMetrics[0])
			});
		}
		return dataPoints;
	}
	/**
	* 将 metric 的 labels 和 attributes 合并转换为 OTel attributes
	*/
	mapMetricAttributes(metric) {
		const result = [];
		if (metric.labels) Object.entries(metric.labels).forEach(([key, value]) => {
			result.push({
				key,
				value: { stringValue: typeof value === "string" ? value : String(value) }
			});
		});
		if (metric.attributes) Object.entries(metric.attributes).forEach(([key, value]) => {
			if (typeof value === "string") result.push({
				key,
				value: { stringValue: value }
			});
			else if (typeof value === "number") if (Number.isInteger(value)) result.push({
				key,
				value: { intValue: String(value) }
			});
			else result.push({
				key,
				value: { doubleValue: value }
			});
			else if (typeof value === "boolean") result.push({
				key,
				value: { boolValue: value }
			});
			else result.push({
				key,
				value: { stringValue: String(value) }
			});
		});
		return result;
	}
	/**
	* 获取 label 的唯一键（用于分组）
	*/
	getLabelKey(labels) {
		return JSON.stringify(labels);
	}
	/**
	* 转换时间戳为纳秒
	*/
	toNanoTimestamp(milliseconds) {
		return Math.round(milliseconds * 1e6).toString();
	}
	/**
	* 获取指标描述
	*/
	getMetricDescription(name) {
		return {
			"genie.request.ipc_request.duration": "IPC request duration (UI to Node)",
			"genie.request.node_receive.duration": "Node receive processing delay",
			"genie.request.http_send.duration": "HTTP send duration to model API",
			"genie.request.model_ttfb": "Model Time To First Byte",
			"genie.request.model_stream.duration": "Model streaming duration",
			"genie.request.first_tool.latency": "First tool execution latency",
			"genie.request.tools_execution.duration": "All tools execution duration",
			"genie.request.ipc_response.duration": "IPC response duration (Node to UI)",
			"genie.request.success.total": "Total successful requests",
			"genie.request.failure.total": "Total failed requests",
			"genie.request.total": "Total requests",
			"genie.request.tool.duration": "Tool execution duration",
			"genie.request.tool.success.total": "Total successful tool executions",
			"genie.request.tool.failure.total": "Total failed tool executions",
			"genie.ipc.call.duration": "IPC call duration",
			"genie.ipc.call.success.total": "Total successful IPC calls",
			"genie.ipc.call.failure.total": "Total failed IPC calls",
			"genie.ipc.queue_depth": "IPC queue depth"
		}[name] || "";
	}
	/**
	* 获取指标单位
	*/
	getMetricUnit(name) {
		if (name.includes("duration") || name.includes("latency") || name.includes("ttfb")) return "ms";
		if (name.includes(".total")) return "1";
		if (name.includes("queue_depth")) return "1";
		return "";
	}
	/**
	* 生成实例 ID
	*/
	generateInstanceId() {
		return `instance-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	}
	/**
	* 更新 Resource 配置
	*/
	updateResource(config) {
		this.resource = { attributes: [
			{
				key: "target",
				value: { stringValue: config.target }
			},
			{
				key: "type",
				value: { stringValue: "resource" }
			},
			{
				key: "env_name",
				value: { stringValue: config.envName || "production" }
			},
			{
				key: "instance",
				value: { stringValue: config.instance || this.getCurrentInstance() }
			},
			{
				key: "namespace",
				value: { stringValue: config.namespace || "Development" }
			},
			{
				key: "version",
				value: { stringValue: config.version }
			},
			{
				key: "container_name",
				value: { stringValue: `genie.${config.target}` }
			},
			{
				key: "ideType",
				value: { stringValue: config.ideType }
			},
			{
				key: "ideVersion",
				value: { stringValue: config.ideVersion }
			},
			{
				key: "os",
				value: { stringValue: config.os }
			},
			{
				key: "ext1",
				value: { stringValue: config.ext1 || "unknown" }
			}
		] };
	}
	/**
	* 获取当前实例 ID
	*/
	getCurrentInstance() {
		return this.resource.attributes.find((attr) => attr.key === "instance")?.value.stringValue || this.generateInstanceId();
	}
	/**
	* 转换 Traces 为 OTel 格式
	* @param spans - Span 数组
	* @returns OTel Trace Export Request
	*/
	mapTraces(spans, defaultUid) {
		const firstSpan = spans[0] || {};
		const sessionId = firstSpan.sessionId || firstSpan.attributes?.sessionId || "unknown";
		const uid = firstSpan.uid || firstSpan.attributes?.uid || defaultUid || "unknown";
		const resourceAttributeMap = new Map([
			["target", {
				key: "target",
				value: { stringValue: "TAMv2.codebuddy-web" }
			}],
			["session_id", {
				key: "session_id",
				value: { stringValue: sessionId }
			}],
			["type", {
				key: "type",
				value: { stringValue: "resource" }
			}],
			["uid", {
				key: "uid",
				value: { stringValue: uid }
			}],
			["ideType", {
				key: "ideType",
				value: { stringValue: "genie" }
			}],
			["ideVersion", {
				key: "ideVersion",
				value: { stringValue: "1.0.0" }
			}]
		]);
		for (const attr of this.resource.attributes) resourceAttributeMap.set(attr.key, {
			key: attr.key,
			value: { stringValue: attr.value.stringValue }
		});
		resourceAttributeMap.set("session_id", {
			key: "session_id",
			value: { stringValue: sessionId }
		});
		resourceAttributeMap.set("uid", {
			key: "uid",
			value: { stringValue: uid }
		});
		const resourceAttributes = [...resourceAttributeMap.values()];
		const otelSpans = spans.map((span) => {
			const startTimeUnixNano = this.toNanoTimestamp(span.startTime);
			const endTimeUnixNano = span.endTime ? this.toNanoTimestamp(span.endTime) : void 0;
			return {
				traceId: span.traceId,
				trace_id: span.traceId,
				spanId: span.spanId,
				span_id: span.spanId,
				parentSpanId: span.parentSpanId || void 0,
				parent_span_id: span.parentSpanId || void 0,
				name: span.name,
				kind: this.mapSpanKind(span.kind),
				startTimeUnixNano,
				start_time_unix_nano: startTimeUnixNano,
				endTimeUnixNano,
				end_time_unix_nano: endTimeUnixNano,
				attributes: this.mapSpanAttributes(span.attributes || {}),
				status: { code: span.status === "ok" ? 1 : span.status === "error" ? 2 : 0 },
				events: (span.events || []).map((event) => {
					const timeUnixNano = this.toNanoTimestamp(event.timestamp);
					return {
						name: event.name,
						timeUnixNano,
						time_unix_nano: timeUnixNano,
						attributes: this.mapSpanAttributes(event.attributes || {}),
						droppedAttributesCount: 0
					};
				}),
				links: span.links || [],
				droppedAttributesCount: 0,
				droppedEventsCount: 0,
				droppedLinksCount: 0
			};
		});
		return { resourceSpans: [{
			resource: {
				attributes: resourceAttributes,
				droppedAttributesCount: 0
			},
			scopeSpans: [{
				scope: {
					name: this.scopeName,
					version: this.scopeVersion
				},
				spans: otelSpans
			}]
		}] };
	}
	/**
	* 转换 Logs 为 OTel 格式
	* @param logs - Log 数组
	* @returns OTel Log Export Request
	*/
	mapLogs(logs, defaultUid) {
		const firstLog = logs[0] || {};
		const uid = firstLog.attributes?.uid || defaultUid || "unknown";
		const sessionId = firstLog.attributes?.sessionId || "unknown";
		const version = firstLog.attributes?.ideVersion || "unknown";
		const resourceAttributes = [
			{
				key: "telemetry.sdk.language",
				value: { stringValue: "javascript" }
			},
			{
				key: "telemetry.sdk.name",
				value: { stringValue: "galileo" }
			},
			{
				key: "telemetry.sdk.version",
				value: { stringValue: "0.0.1" }
			},
			{
				key: "ideType",
				value: { stringValue: firstLog.attributes?.ideType || "unknown" }
			},
			{
				key: "ideVersion",
				value: { stringValue: version }
			},
			{
				key: "uid",
				value: { stringValue: uid }
			},
			{
				key: "session_id",
				value: { stringValue: sessionId }
			},
			...this.resource.attributes.map((attr) => ({
				key: attr.key,
				value: { stringValue: attr.value.stringValue }
			}))
		];
		const logRecords = logs.map((log) => {
			const logRecord = log;
			const rawAttributes = logRecord.attributes || {};
			const rawTraceId = logRecord.traceId || logRecord.trace_id || rawAttributes.trace_id || rawAttributes.traceId;
			const rawSpanId = logRecord.spanId || logRecord.span_id || rawAttributes.span_id || rawAttributes.spanId;
			const traceId = rawTraceId || "00000000000000000000000000000000";
			const spanId = rawSpanId || "0000000000000000";
			const timeUnixNano = this.toNanoTimestamp(log.timestamp);
			const severityNumber = this.mapLogSeverity(logRecord.level || "info");
			const severityText = (logRecord.level || "info").toUpperCase();
			const attributes = this.useOtelJsonLogFields && rawTraceId && rawSpanId ? {
				...rawAttributes,
				trace_id: traceId,
				span_id: spanId,
				traceId,
				spanId
			} : rawAttributes;
			return {
				traceId,
				trace_id: traceId,
				traceID: traceId,
				spanId,
				span_id: spanId,
				spanID: spanId,
				timeUnixNano,
				time_unix_nano: timeUnixNano,
				severityNumber,
				severity_number: severityNumber,
				severityText,
				severity_text: severityText,
				body: { stringValue: logRecord.message || "" },
				attributes: this.mapLogAttributes(attributes),
				flags: 1
			};
		});
		if (!this.useOtelJsonLogFields) return { resource_logs: [{
			resource: { attributes: this.toLegacyAttributes(resourceAttributes) },
			instrumentation_library_logs: [{
				instrumentation_library: {
					name: this.scopeName,
					version: this.scopeVersion
				},
				log_records: logRecords.map((record) => ({
					trace_id: record.traceId,
					span_id: record.spanId,
					time_unix_nano: record.timeUnixNano,
					severity_number: record.severityNumber,
					severity_text: record.severityText,
					body: { string_value: record.body.stringValue },
					attributes: this.toLegacyAttributes(record.attributes),
					flags: record.flags
				}))
			}]
		}] };
		return { resourceLogs: [{
			resource: { attributes: resourceAttributes },
			scopeLogs: [{
				scope: {
					name: this.scopeName,
					version: this.scopeVersion
				},
				logRecords
			}]
		}] };
	}
	/**
	* 映射 Span Kind
	*/
	mapSpanKind(kind) {
		return {
			"internal": 1,
			"server": 2,
			"client": 3,
			"producer": 4,
			"consumer": 5
		}[kind || "internal"] || 1;
	}
	/**
	* 映射 Span Attributes
	*/
	mapSpanAttributes(attributes) {
		return Object.entries(attributes).map(([key, value]) => ({
			key,
			value: this.mapAttributeValue(value)
		}));
	}
	/**
	* 映射 Log Attributes
	*/
	toLegacyAttributes(attributes) {
		return attributes.map((attr) => ({
			key: attr.key,
			value: { string_value: String(attr.value.stringValue ?? attr.value.intValue ?? attr.value.doubleValue ?? attr.value.boolValue ?? "") }
		}));
	}
	mapLogAttributes(attributes) {
		return Object.entries(attributes).map(([key, value]) => ({
			key,
			value: this.mapAttributeValue(value)
		}));
	}
	/**
	* 映射 Attribute Value
	*/
	mapAttributeValue(value) {
		if (typeof value === "string") return { stringValue: value };
		else if (typeof value === "number") if (Number.isInteger(value)) return { intValue: String(value) };
		else return { doubleValue: value };
		else if (typeof value === "boolean") return { boolValue: value };
		else return { stringValue: String(value) };
	}
	/**
	* 映射 Log Severity
	*/
	mapLogSeverity(level) {
		return {
			"trace": "SEVERITY_NUMBER_TRACE",
			"debug": "SEVERITY_NUMBER_DEBUG",
			"info": "SEVERITY_NUMBER_INFO",
			"warn": "SEVERITY_NUMBER_WARN",
			"error": "SEVERITY_NUMBER_ERROR",
			"fatal": "SEVERITY_NUMBER_FATAL"
		}[level.toLowerCase()] || "SEVERITY_NUMBER_INFO";
	}
};
//#endregion
//#region ../../packages/monitor/src/exporters/galileo-exporter.ts
/**
* Galileo Exporter
*
* 将监控指标导出到 Galileo 平台（腾讯内部 OTel 平台）
*
* 功能：
* - OTel 格式转换（使用 OTelMapper）
* - HTTP 批量导出（50 metrics/batch）
* - 指数退避重试（1s → 2s → 4s → 8s → 16s → 30s）
* - 连接健康检查
* - 队列管理和限流
*
* Endpoint: http://otlp.j.woa.com
*/
/**
* Galileo Exporter Implementation
*/
var GalileoExporter = class extends AbstractExporter {
	constructor(config, contextProvider, httpClient, logger) {
		super("GalileoExporter", config.enabled);
		this.exportQueue = [];
		this.isExporting = false;
		this.traceQueue = [];
		this.isExportingTraces = false;
		this.maxRetries = 3;
		this.retryDelay = 1e3;
		this.backoffMultiplier = 2;
		this.maxRetryDelay = 3e4;
		this.consecutiveFailures = 0;
		this.config = config;
		let resourceConfig = config.resource || {};
		if (contextProvider?.getEnvironmentInfo) resourceConfig = {
			...resourceConfig,
			...contextProvider.getEnvironmentInfo()
		};
		if (contextProvider?.getSystemContext) resourceConfig = {
			...resourceConfig,
			...contextProvider.getSystemContext()
		};
		this.mapper = new OTelMapper(resourceConfig, { useOtelJsonLogFields: config.useOtelJsonLogFields === true });
		this.httpClient = httpClient || this.createDefaultHttpClient();
		config.resource = resourceConfig;
		this.config = config;
		this.onConfigure(config);
		if (logger) {
			this.logger = logger;
			this.logger?.setContext?.("GalileoExporter");
		}
	}
	async onInitialize() {
		this.logger?.info(`[GalileoExporter] Initializing with endpoint: ${this.config.endpoint}`);
		if (!this.config.endpoint) throw new Error("Galileo endpoint is required");
		try {
			const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(/* @__PURE__ */ new Error("Health check timeout after 3s")), 3e3));
			await Promise.race([this.healthCheck(), timeoutPromise]);
			this.logger?.info("[GalileoExporter] Health check passed");
		} catch (error) {
			this.logger?.warn("[GalileoExporter] Health check failed, will retry on export:", error);
		}
		this.startFlushTimer();
	}
	async onShutdown() {
		this.logger?.info("[GalileoExporter] Shutting down...");
		this.stopFlushTimer();
		if (this.exportQueue.length > 0) {
			this.logger?.info(`[GalileoExporter] Flushing ${this.exportQueue.length} remaining metrics...`);
			await this.flush();
		}
		this.logger?.info("[GalileoExporter] Shutdown complete");
	}
	async onExport(metrics) {
		this.logger?.info(`[GalileoExporter] onExport called with ${metrics.length} metrics`);
		this.exportQueue.push(...metrics);
		this.queueSize = this.exportQueue.length;
		this.logger?.info(`[GalileoExporter] Queue size: ${this.exportQueue.length}, batchSize: ${this.config.batchSize || 50}`);
		const batchSize = this.config.batchSize || 50;
		if (this.exportQueue.length >= batchSize && !this.isExporting) {
			this.logger?.info("[GalileoExporter] Queue reached batch size, flushing...");
			await this.flush();
		}
	}
	async onFlush() {
		if (this.exportQueue.length > 0 && !this.isExporting) {
			this.isExporting = true;
			try {
				const batchSize = this.config.batchSize || 50;
				while (this.exportQueue.length > 0) {
					const batch = this.exportQueue.splice(0, batchSize);
					this.queueSize = this.exportQueue.length;
					await this.exportBatch(batch);
				}
			} finally {
				this.isExporting = false;
			}
		}
		await this.flushTraces();
	}
	onConfigure(config) {
		const galileoConfig = config;
		this.maxRetries = galileoConfig.retryConfig?.maxRetries ?? 3;
		this.retryDelay = galileoConfig.retryConfig?.retryDelay ?? 1e3;
		this.backoffMultiplier = galileoConfig.retryConfig?.backoffMultiplier ?? 2;
		const calculatedMaxDelay = this.retryDelay * Math.pow(this.backoffMultiplier, this.maxRetries);
		this.maxRetryDelay = Math.min(calculatedMaxDelay, 3e4);
		if (galileoConfig.resource) this.mapper.updateResource(galileoConfig.resource);
		if (this.flushTimer) {
			this.stopFlushTimer();
			this.startFlushTimer();
		}
	}
	/**
	* 获取目标服务名称
	* 供 Collector 使用，避免硬编码服务名称
	*
	* ⚠️ 注意：不同运行模式的区分通过 mode 字段实现
	* - mode 通过 Aegis SDK 的 ext1 字段上报
	* - main → ext1: 'agents-web-app'
	* - widget → ext1: 'agent-manager'
	* - webview → ext1: 'vscode-chat'
	*
	* 在 Galileo 平台查询时可以通过 ext1 字段过滤不同来源的数据
	*/
	getTargetService() {
		return this.config.resource?.target || "TAMv2.codebuddy-web";
	}
	/**
	* 导出一批指标（带重试）
	*/
	async exportBatch(metrics) {
		let lastError;
		this.logger?.info(`[GalileoExporter] exportBatch called with ${metrics.length} metrics`);
		for (let attempt = 0; attempt <= this.maxRetries; attempt++) try {
			this.logger?.info(`[GalileoExporter] Converting ${metrics.length} metrics to OTel format...`);
			const otelData = this.mapper.mapMetrics(metrics);
			this.logger?.info(`[GalileoExporter] Converted to OTel format, resourceMetrics count: ${otelData.resourceMetrics?.length || 0}`);
			this.logger?.info("[GalileoExporter] Sending to Galileo...");
			await this.sendToGalileo(otelData);
			this.lastSuccessTime = Date.now();
			this.consecutiveFailures = 0;
			this.logger?.info(`[GalileoExporter] Successfully exported ${metrics.length} metrics`);
			return;
		} catch (error) {
			lastError = error;
			this.consecutiveFailures++;
			this.logger?.error(`[GalileoExporter] Export failed (attempt ${attempt + 1}/${this.maxRetries + 1}):`, error);
			if (attempt < this.maxRetries) {
				const delay = this.calculateRetryDelay(attempt);
				this.logger?.info(`[GalileoExporter] Retrying in ${delay}ms...`);
				await this.sleep(delay);
			}
		}
		throw lastError || /* @__PURE__ */ new Error("Export failed after all retries");
	}
	/**
	* 发送数据到 Galileo
	*/
	async sendToGalileo(data) {
		const url = `${this.config.endpoint}/v1/metrics`;
		const timeout = this.config.timeout || 3e4;
		this.logger?.info("[GalileoExporter] ✔️ sendToGalileo CALLED");
		this.logger?.info(`[GalileoExporter]   URL: ${url}`);
		this.logger?.info(`[GalileoExporter]   Timeout: ${timeout}ms`);
		const jsonData = JSON.stringify(data, null, 2);
		this.logger?.info(`[GalileoExporter]   FULL REQUEST DATA:\n${jsonData}`);
		try {
			this.logger?.info("[GalileoExporter] Making HTTP POST request...");
			const response = await this.httpClient.post(url, data, {
				headers: {
					"Content-Type": "application/json",
					"User-Agent": "genie-monitor/1.0.0"
				},
				timeout
			});
			this.logger?.info(`[GalileoExporter] Response status: ${response.status} ${response.statusText}`);
			if (response.status < 200 || response.status >= 300) throw new Error(`Galileo returned status ${response.status}: ${response.statusText}`);
		} catch (error) {
			const errorCode = error.code;
			if (errorCode === "ECONNREFUSED") throw new Error(`Cannot connect to Galileo at ${this.config.endpoint}`);
			else if (errorCode === "ETIMEDOUT") throw new Error(`Request to Galileo timed out after ${timeout}ms`);
			else throw error;
		}
	}
	/**
	* 健康检查
	*/
	async healthCheck() {
		const url = `${this.config.endpoint}/health`;
		try {
			this.logger?.info(`[GalileoExporter] Starting health check to ${url}`);
			const response = await this.httpClient.post(url, {}, { timeout: 3e3 });
			this.logger?.info(`[GalileoExporter] Health check response status: ${response.status}`);
			if (response.status !== 200) throw new Error(`Health check failed with status ${response.status}`);
		} catch (error) {
			this.logger?.warn("[GalileoExporter] Health endpoint not available, will test on first export:", error);
			throw error;
		}
	}
	/**
	* 计算重试延迟（指数退避）
	*/
	calculateRetryDelay(attempt) {
		const delay = this.retryDelay * Math.pow(this.backoffMultiplier, attempt);
		return Math.min(delay, this.maxRetryDelay);
	}
	/**
	* Sleep 工具方法
	*/
	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
	/**
	* 启动定时 flush
	*/
	startFlushTimer() {
		const interval = this.config.flushInterval || 1e4;
		this.flushTimer = setInterval(async () => {
			try {
				await this.flush();
			} catch (error) {
				this.logger?.error("[GalileoExporter] Flush error:", error);
			}
		}, interval);
		this.logger?.info(`[GalileoExporter] Flush timer started (interval: ${interval}ms)`);
	}
	/**
	* 停止定时 flush
	*/
	stopFlushTimer() {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = void 0;
			this.logger?.info("[GalileoExporter] Flush timer stopped");
		}
	}
	/**
	* 创建默认 HTTP Client（使用 fetch）
	*/
	createDefaultHttpClient() {
		return { async post(url, data, config) {
			const controller = new AbortController();
			const timeout = config?.timeout || 3e4;
			const timeoutId = setTimeout(() => {
				controller.abort();
			}, timeout);
			try {
				const response = await fetch(url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...config?.headers || {}
					},
					body: JSON.stringify(data),
					signal: controller.signal
				});
				const responseData = await response.json().catch(() => ({}));
				return {
					status: response.status,
					statusText: response.statusText,
					data: responseData
				};
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				const errorName = error instanceof Error ? error.name : void 0;
				console.error("[GalileoExporter] HTTP request failed:", errorMsg);
				if (errorName === "AbortError") throw new Error(`Request timeout after ${timeout}ms`);
				throw error;
			} finally {
				clearTimeout(timeoutId);
			}
		} };
	}
	/**
	* 获取健康状态
	*/
	getHealth() {
		return {
			connected: this.connected,
			lastSuccessTime: this.lastSuccessTime,
			consecutiveFailures: this.consecutiveFailures
		};
	}
	/**
	* 获取队列信息
	*/
	getQueueInfo() {
		return {
			size: this.exportQueue.length,
			isExporting: this.isExporting
		};
	}
	/**
	* 设置 HTTP Client（用于测试）
	*/
	setHttpClient(client) {
		this.httpClient = client;
	}
	/**
	* 手动触发健康检查
	*/
	async checkHealth() {
		await this.healthCheck();
	}
	/**
	* 导出 Traces 到 Galileo
	* @param spans - Span 数组
	*/
	async exportTraces(spans) {
		if (!this.enabled) {
			this.logger?.warn("[GalileoExporter] Not enabled, skipping trace export");
			return;
		}
		if (!spans || spans.length === 0) return;
		this.logger?.info(`[GalileoExporter] exportTraces called with ${spans.length} spans`);
		this.traceQueue.push(...spans);
		if (this.connected && !this.isExportingTraces) await this.flushTraces();
	}
	/**
	* Flush Traces
	*/
	async flushTraces() {
		if (this.traceQueue.length === 0 || this.isExportingTraces) return;
		this.isExportingTraces = true;
		try {
			const batchSize = this.config.batchSize || 50;
			while (this.traceQueue.length > 0) {
				const batch = this.traceQueue.splice(0, batchSize);
				await this.exportTraceBatch(batch);
			}
		} finally {
			this.isExportingTraces = false;
		}
	}
	/**
	* 导出一批 Traces（带重试）
	*/
	async exportTraceBatch(spans) {
		let lastError;
		this.logger?.info(`[GalileoExporter] exportTraceBatch called with ${spans.length} spans`);
		for (let attempt = 0; attempt <= this.maxRetries; attempt++) try {
			const otelTraceData = this.mapper.mapTraces(spans, this.getUserId());
			this.logger?.info("[GalileoExporter] Converted to OTel Trace format");
			await this.sendTracesToGalileo(otelTraceData);
			this.lastSuccessTime = Date.now();
			this.consecutiveFailures = 0;
			this.logger?.info(`[GalileoExporter] Successfully exported ${spans.length} traces`);
			return;
		} catch (error) {
			lastError = error;
			this.consecutiveFailures++;
			this.logger?.error(`[GalileoExporter] Trace export failed (attempt ${attempt + 1}/${this.maxRetries + 1}):`, error);
			if (attempt < this.maxRetries) {
				const delay = this.calculateRetryDelay(attempt);
				this.logger?.info(`[GalileoExporter] Retrying in ${delay}ms...`);
				await this.sleep(delay);
			}
		}
		throw lastError || /* @__PURE__ */ new Error("Trace export failed after all retries");
	}
	/**
	* 发送 Traces 数据到 Galileo
	*/
	async sendTracesToGalileo(data) {
		const url = `${this.config.endpoint}/v1/traces`;
		const timeout = this.config.timeout || 3e4;
		this.logger?.info("[GalileoExporter] ✔️ sendTracesToGalileo CALLED");
		this.logger?.info(`[GalileoExporter]   URL: ${url}`);
		const jsonData = JSON.stringify(data, null, 2);
		this.logger?.info(`[GalileoExporter]   TRACE REQUEST DATA:\n${jsonData}`);
		try {
			const response = await this.httpClient.post(url, data, {
				headers: {
					"Content-Type": "application/json",
					"User-Agent": "genie-monitor/1.0.0"
				},
				timeout
			});
			this.logger?.info(`[GalileoExporter] Response status: ${response.status} ${response.statusText}`);
			if (response.status < 200 || response.status >= 300) throw new Error(`Galileo returned status ${response.status}: ${response.statusText}`);
		} catch (error) {
			const errorCode = error.code;
			if (errorCode === "ECONNREFUSED") throw new Error(`Cannot connect to Galileo at ${this.config.endpoint}`);
			else if (errorCode === "ETIMEDOUT") throw new Error(`Request to Galileo timed out after ${timeout}ms`);
			else throw error;
		}
	}
	/**
	* 导出 Logs 到 Galileo
	* @param logs - Log 数组
	*/
	async exportLogs(logs) {
		if (!this.enabled || !this.connected) {
			if (logs && logs.length > 0) this.logger?.warn("[GalileoExporter] Not enabled or not connected, skipping log export");
			return;
		}
		if (!logs || logs.length === 0) return;
		this.logger?.info(`[GalileoExporter] Exporting ${logs.length} logs`);
		try {
			const otelLogData = this.mapper.mapLogs(logs, this.getUserId());
			const url = `${this.config.endpoint}/v1/logs`;
			const response = await this.httpClient.post(url, otelLogData, {
				headers: {
					"Content-Type": "application/json",
					"User-Agent": "genie-monitor/1.0.0"
				},
				timeout: this.config.timeout || 3e4
			});
			if (response.status < 200 || response.status >= 300) throw new Error(`Galileo returned status ${response.status}`);
			this.logger?.info(`[GalileoExporter] ✓ Exported ${logs.length} logs`);
		} catch (error) {
			this.logger?.error("[GalileoExporter] Log export failed:", error);
			throw error;
		}
	}
	/**
	* 获取用户 ID（从缓存）
	* 优先级：
	* 1. 缓存的 userId (由 AuthenticationManager 订阅自动更新)
	* 2. 'unknown' (默认值)
	*/
	getUserId() {
		return this.config.userId || "unknown";
	}
};
//#endregion
//#region src/main/system/install/pending-telemetry-cleaner.ts
require_common$1.init_common$3();
/**
* Pending telemetry file cleaner.
*
* Cleans up files older than RETENTION_DAYS in the pending-telemetry directory.
* Covers all file types: install-*.json.reported, install-*.json.invalid,
* repair-*.json, update-*.json.reported, etc.
*
* Called once during DesktopMonitorService.start(), runs asynchronously
* via setImmediate to avoid blocking startup.
*/
var import_src = /* @__PURE__ */ require_chunk.__toESM(require_src$1.require_src());
require_app_instance.init_app_instance();
var cleanerLog = import_src.default.scope("pending-telemetry-cleaner");
/** File retention period in days */
var RETENTION_DAYS = 10;
var RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1e3;
function getPendingDir() {
	return require_workbuddy_paths.getWorkbuddyPendingTelemetryDir();
}
/**
* Delete files whose mtime exceeds RETENTION_DAYS.
* Non-blocking, errors are logged but never thrown.
*/
function cleanStalePendingTelemetry() {
	setImmediate(() => {
		try {
			const dir = getPendingDir();
			if (!node_fs.existsSync(dir)) return;
			const now = Date.now();
			const entries = node_fs.readdirSync(dir);
			let cleaned = 0;
			for (const entry of entries) {
				const filePath = node_path.join(dir, entry);
				try {
					const stat = node_fs.statSync(filePath);
					if (!stat.isFile()) continue;
					if (now - stat.mtimeMs > RETENTION_MS) {
						node_fs.unlinkSync(filePath);
						cleaned++;
					}
				} catch {}
			}
			if (cleaned > 0) cleanerLog.info(`Cleaned ${cleaned} stale pending-telemetry file(s) older than ${RETENTION_DAYS} days`);
		} catch (err) {
			cleanerLog.warn("cleanStalePendingTelemetry failed:", err);
		}
	});
}
//#endregion
//#region ../../packages/monitor/src/common/interfaces/collector.ts
/**
* Abstract base collector implementation
* Provides common functionality for all collectors
*/
var AbstractCollector = class {
	constructor(name, enabled = true) {
		this.name = name;
		this.enabled = enabled;
		this.running = false;
		this.collectedCount = 0;
		this.errorCount = 0;
		this.config = { enabled };
	}
	async start() {
		if (this.running) return;
		if (!this.enabled) {
			this.logger?.info(`[${this.name}] Collector is disabled, skipping start`);
			return;
		}
		await this.onStart();
		this.running = true;
		this.logger?.info(`[${this.name}] Collector started`);
	}
	async stop() {
		if (!this.running) {
			await this.onStop();
			return;
		}
		await this.onStop();
		this.running = false;
		this.logger?.info(`[${this.name}] Collector stopped`);
	}
	async collect() {
		if (!this.enabled || !this.running) return [];
		try {
			const metrics = await this.onCollect();
			this.collectedCount += metrics.length;
			this.lastCollectTime = Date.now();
			return metrics;
		} catch (error) {
			this.errorCount++;
			this.lastError = error;
			this.logger?.error(`[${this.name}] Collection error:`, error);
			return [];
		}
	}
	configure(config) {
		this.config = config;
		this.onConfigure(config);
	}
	getStatus() {
		return {
			name: this.name,
			enabled: this.enabled,
			running: this.running,
			collectedCount: this.collectedCount,
			errorCount: this.errorCount,
			lastCollectTime: this.lastCollectTime,
			lastError: this.lastError
		};
	}
	isRunning() {
		return this.running;
	}
	/**
	* Hook: Called when configuration changes
	* Subclasses can override to handle config updates
	*/
	onConfigure(config) {}
	/**
	* Collect logs (default implementation returns empty array)
	* Subclasses can override to provide log collection functionality
	*/
	async collectLogs() {
		if (!this.enabled || !this.running) return [];
		try {
			return await this.onCollectLogs();
		} catch (error) {
			this.logger?.error(`[${this.name}] Log collection error:`, error);
			return [];
		}
	}
	/**
	* Hook: Called to collect logs
	* Subclasses can override to implement log collection logic
	* Default: returns empty array (no logs)
	*/
	async onCollectLogs() {
		return [];
	}
};
//#endregion
//#region ../../packages/monitor/src/common/types/ipc-metrics.ts
/**
* IPC通道类型
*/
var IPCChannelType = /* @__PURE__ */ function(IPCChannelType) {
	IPCChannelType["MainToExtHost"] = "main_to_exthost";
	IPCChannelType["ExtHostToMain"] = "exthost_to_main";
	IPCChannelType["ExtHostToWebview"] = "exthost_to_webview";
	IPCChannelType["WebviewToExtHost"] = "webview_to_exthost";
	IPCChannelType["ExtHostToExtHost"] = "exthost_to_exthost";
	return IPCChannelType;
}({});
/**
* IPC消息类型
*/
var IPCMessageType = /* @__PURE__ */ function(IPCMessageType) {
	IPCMessageType["Request"] = "request";
	IPCMessageType["Response"] = "response";
	IPCMessageType["Notification"] = "notification";
	IPCMessageType["Event"] = "event";
	IPCMessageType["Command"] = "command";
	return IPCMessageType;
}({});
IPCChannelType.MainToExtHost, IPCChannelType.ExtHostToMain, IPCChannelType.ExtHostToWebview, IPCChannelType.WebviewToExtHost, IPCMessageType.Request, IPCMessageType.Response, IPCMessageType.Command, IPCMessageType.Event;
//#endregion
//#region ../../packages/monitor/src/common/utils/monitor-logger.ts
/**
* Monitor Logger
*
* 统一的日志抽象层，替代 console.log
* 支持日志级别过滤和环境配置
*/
/**
* 日志级别
*/
var LogLevel = /* @__PURE__ */ function(LogLevel) {
	LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
	LogLevel[LogLevel["INFO"] = 1] = "INFO";
	LogLevel[LogLevel["WARN"] = 2] = "WARN";
	LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
	LogLevel[LogLevel["NONE"] = 4] = "NONE";
	return LogLevel;
}({});
/**
* Monitor Logger 实现
*/
var MonitorLogger = class MonitorLogger {
	constructor(config) {
		this.config = config;
		this.isProduction = (config.envName || process.env.NODE_ENV) === "production";
	}
	/**
	* 调试日志
	*/
	debug(message, ...args) {
		if (!this.shouldLog(LogLevel.DEBUG)) return;
		console.debug(`[${this.config.component}] ${message}`, ...args);
	}
	/**
	* 信息日志
	*/
	info(message, ...args) {
		if (!this.shouldLog(LogLevel.INFO)) return;
		console.log(`[${this.config.component}] ${message}`, ...args);
	}
	/**
	* 警告日志
	*/
	warn(message, ...args) {
		if (!this.shouldLog(LogLevel.WARN)) return;
		console.warn(`[${this.config.component}] ${message}`, ...args);
	}
	/**
	* 错误日志
	*/
	error(message, error, ...args) {
		if (!this.shouldLog(LogLevel.ERROR)) return;
		if (error instanceof Error) console.error(`[${this.config.component}] ${message}`, error.message, error.stack, ...args);
		else if (error) console.error(`[${this.config.component}] ${message}`, error, ...args);
		else console.error(`[${this.config.component}] ${message}`, ...args);
	}
	/**
	* 判断是否应该记录日志
	*/
	shouldLog(level) {
		if (!this.config.enabled) return false;
		if (this.isProduction && this.config.disableDebugInProduction && level === LogLevel.DEBUG) return false;
		return level >= this.config.minLevel;
	}
	/**
	* 更新配置
	*/
	updateConfig(config) {
		this.config = {
			...this.config,
			...config
		};
	}
	/**
	* 创建子日志记录器
	*/
	createChild(childName) {
		return new MonitorLogger({
			...this.config,
			component: `${this.config.component}:${childName}`
		});
	}
};
LogLevel.INFO;
//#endregion
//#region ../../packages/monitor/src/utils/event-bus.ts
/**
* Monitor Event Bus
*
* 全局事件总线，用于监控系统的事件发射和监听
*
* 特点：
* - 异步事件发射（不阻塞主流程）
* - 错误隔离（监听器错误不影响业务）
* - 类型安全（TypeScript 类型定义）
*/
/**
* 监控事件总线
*
* 扩展自 Node.js EventEmitter，提供类型安全的事件发射和监听
*/
var MonitorEventBus = class extends events.EventEmitter {
	constructor() {
		super();
		this.logger = new MonitorLogger({
			component: "MonitorEventBus",
			minLevel: LogLevel.INFO,
			enabled: false
		});
		this.setMaxListeners(100);
	}
	/**
	* 异步发射事件
	*
	* 使用 setImmediate 确保事件处理不阻塞当前执行流程
	* 错误会被捕获并记录，不会影响业务逻辑
	*
	* @param event - 事件名称
	* @param payload - 事件 payload
	*/
	emitAsync(event, payload) {
		this.logger.info(`emitAsync called, event: ${String(event)}, listeners: ${this.listenerCount(event)}`);
		setImmediate(() => {
			try {
				this.logger.info(`Emitting event: ${String(event)} to ${this.listenerCount(event)} listeners`);
				this.emit(event, payload);
				this.logger.info(`Event emitted successfully: ${String(event)}`);
			} catch (error) {
				this.logger.error(`Error emitting event ${event}:`, error);
			}
		});
	}
	/**
	* 类型安全的事件监听
	*
	* @param event - 事件名称
	* @param listener - 事件处理函数
	*/
	onMonitor(event, listener) {
		this.logger.info(`onMonitor called, event: ${String(event)}, total listeners after: ${this.listenerCount(event) + 1}`);
		return this.on(event, listener);
	}
	/**
	* 移除类型安全的事件监听
	*
	* @param event - 事件名称
	* @param listener - 事件处理函数
	*/
	offMonitor(event, listener) {
		return this.off(event, listener);
	}
	/**
	* 一次性事件监听
	*
	* @param event - 事件名称
	* @param listener - 事件处理函数
	*/
	onceMonitor(event, listener) {
		return this.once(event, listener);
	}
	/**
	* 获取事件统计信息
	*/
	getEventStats() {
		const stats = {};
		for (const event of this.eventNames()) stats[event] = this.listenerCount(event);
		return stats;
	}
	/**
	* 清理所有监听器
	*/
	clearAll() {
		this.removeAllListeners();
	}
};
/**
* 全局单例
*
* 整个应用共享同一个 EventBus 实例
*
* 使用 global 对象确保即使模块被重新加载（reload），也使用同一个实例
* 这解决了 VSCode reload 后事件监听器丢失的问题
*/
var GLOBAL_EVENT_BUS_KEY = "__GENIE_MONITOR_EVENT_BUS__";
function getOrCreateEventBus() {
	const globalObj = global;
	if (!globalObj[GLOBAL_EVENT_BUS_KEY]) globalObj[GLOBAL_EVENT_BUS_KEY] = new MonitorEventBus();
	return globalObj[GLOBAL_EVENT_BUS_KEY];
}
var monitorEventBus = getOrCreateEventBus();
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/prioritizeable.js
var require_prioritizeable = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Prioritizeable = void 0;
	var Prioritizeable;
	(function(Prioritizeable) {
		async function toPrioritizeable(rawValue, getPriority) {
			if (rawValue instanceof Array) return Promise.all(rawValue.map((v) => toPrioritizeable(v, getPriority)));
			const value = await rawValue;
			return {
				priority: await getPriority(value),
				value
			};
		}
		Prioritizeable.toPrioritizeable = toPrioritizeable;
		function toPrioritizeableSync(rawValue, getPriority = (value) => value.priority) {
			return rawValue.map((v) => ({
				value: v,
				priority: getPriority(v)
			}));
		}
		Prioritizeable.toPrioritizeableSync = toPrioritizeableSync;
		function prioritizeAllSync(values, getPriority) {
			return toPrioritizeableSync(values, getPriority).filter(isValid).sort(compare);
		}
		Prioritizeable.prioritizeAllSync = prioritizeAllSync;
		async function prioritizeAll(values, getPriority) {
			return (await toPrioritizeable(values, getPriority)).filter(isValid).sort(compare);
		}
		Prioritizeable.prioritizeAll = prioritizeAll;
		function isValid(p) {
			return p.priority > 0;
		}
		Prioritizeable.isValid = isValid;
		function compare(p, p2) {
			return p2.priority - p.priority;
		}
		Prioritizeable.compare = compare;
	})(Prioritizeable || (exports.Prioritizeable = Prioritizeable = {}));
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/promise-util.js
var require_promise_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Deferred = void 0;
	var Deferred = class {
		constructor() {
			this.promise = new Promise((resolve, reject) => {
				this.resolve = resolve;
				this.reject = reject;
			});
		}
	};
	exports.Deferred = Deferred;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/types.js
var require_types = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/class-util.js
var require_class_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getSuperClasses = getSuperClasses;
	exports.getPropertyNames = getPropertyNames;
	function getSuperClasses(constructor) {
		const constructors = [];
		let current = constructor;
		while (Object.getPrototypeOf(current)) {
			current = Object.getPrototypeOf(current);
			constructors.push(current);
		}
		return constructors;
	}
	function getPropertyNames(obj) {
		const propertyNames = [];
		do {
			propertyNames.push(...Object.getOwnPropertyNames(obj));
			obj = Object.getPrototypeOf(obj);
		} while (obj);
		return Array.from(new Set(propertyNames));
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/metadata-util.js
var require_metadata_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.getOwnMetadata = getOwnMetadata;
	var class_util_1 = require_class_util();
	function getOwnMetadata(metadataKey, constructor, propertyKey) {
		const constructors = [constructor, ...(0, class_util_1.getSuperClasses)(constructor)];
		let result = [];
		for (let index = 0; index < constructors.length; index++) {
			const c = constructors[constructors.length - index - 1];
			let metadata;
			if (propertyKey) metadata = Reflect.getOwnMetadata(metadataKey, c, propertyKey);
			else metadata = Reflect.getOwnMetadata(metadataKey, c);
			if (metadata) if (Array.isArray(metadata)) result = [...result, ...metadata];
			else return [metadata];
		}
		return result;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/event.js
var require_event = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.CallbackList = exports.Event = void 0;
	var Event;
	(function(Event) {
		const _disposable = { dispose() {} };
		Event.None = Object.assign(function() {
			return _disposable;
		}, {
			get maxListeners() {
				return 0;
			},
			set maxListeners(maxListeners) {}
		});
		/**
		* Given an event and a `map` function, returns another event which maps each element
		* through the mapping function.
		*/
		function map(event, mapFunc) {
			return Object.assign((listener, thisArgs, disposables) => event((i) => listener.call(thisArgs, mapFunc(i)), void 0, disposables), { maxListeners: 0 });
		}
		Event.map = map;
	})(Event || (exports.Event = Event = {}));
	var CallbackList = class {
		get length() {
			return this._callbacks && this._callbacks.length || 0;
		}
		add(callback, context = void 0, bucket) {
			if (!this._callbacks) {
				this._callbacks = [];
				this._contexts = [];
			}
			this._callbacks.push(callback);
			this._contexts.push(context);
			if (Array.isArray(bucket)) bucket.push({ dispose: () => this.remove(callback, context) });
		}
		remove(callback, context = void 0) {
			if (!this._callbacks) return;
			let foundCallbackWithDifferentContext = false;
			for (let i = 0; i < this._callbacks.length; i++) if (this._callbacks[i] === callback) if (this._contexts[i] === context) {
				this._callbacks.splice(i, 1);
				this._contexts.splice(i, 1);
				return;
			} else foundCallbackWithDifferentContext = true;
			if (foundCallbackWithDifferentContext) throw new Error("When adding a listener with a context, you should remove it with the same context");
		}
		[Symbol.iterator]() {
			if (!this._callbacks) return [][Symbol.iterator]();
			const callbacks = this._callbacks.slice(0);
			const contexts = this._contexts.slice(0);
			return callbacks.map((callback, i) => (...args) => callback.apply(contexts[i], args))[Symbol.iterator]();
		}
		invoke(...args) {
			const ret = [];
			for (const callback of this) try {
				ret.push(callback(...args));
			} catch (e) {
				console.error(e);
			}
			return ret;
		}
		isEmpty() {
			return !this._callbacks || this._callbacks.length === 0;
		}
		dispose() {
			this._callbacks = void 0;
			this._contexts = void 0;
		}
	};
	exports.CallbackList = CallbackList;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/cancellation.js
var require_cancellation = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.CancellationTokenSource = exports.CancellationToken = exports.CancellationError = void 0;
	exports.cancelled = cancelled;
	exports.isCancelled = isCancelled;
	exports.checkCancelled = checkCancelled;
	var event_1 = require_event();
	var emitter_1 = require_emitter();
	var CancellationError = class extends Error {
		constructor() {
			super("Canceled");
			this.name = this.message;
		}
	};
	exports.CancellationError = CancellationError;
	var shortcutEvent = Object.freeze(Object.assign(function(callback, context) {
		const handle = setTimeout(callback.bind(context), 0);
		return { dispose() {
			clearTimeout(handle);
		} };
	}, { maxListeners: 0 }));
	var CancellationToken;
	(function(CancellationToken) {
		CancellationToken.None = Object.freeze({
			isCancellationRequested: false,
			onCancellationRequested: event_1.Event.None
		});
		CancellationToken.Cancelled = Object.freeze({
			isCancellationRequested: true,
			onCancellationRequested: shortcutEvent
		});
	})(CancellationToken || (exports.CancellationToken = CancellationToken = {}));
	var MutableToken = class {
		constructor() {
			this._isCancelled = false;
		}
		cancel() {
			if (!this._isCancelled) {
				this._isCancelled = true;
				if (this._emitter) {
					this._emitter.fire(void 0);
					this._emitter = void 0;
				}
			}
		}
		get isCancellationRequested() {
			return this._isCancelled;
		}
		get onCancellationRequested() {
			if (this._isCancelled) return shortcutEvent;
			if (!this._emitter) this._emitter = new emitter_1.Emitter();
			return this._emitter.event;
		}
	};
	var CancellationTokenSource = class {
		get token() {
			if (!this._token) this._token = new MutableToken();
			return this._token;
		}
		cancel() {
			if (!this._token) this._token = CancellationToken.Cancelled;
			else if (this._token !== CancellationToken.Cancelled) this._token.cancel();
		}
		dispose() {
			this.cancel();
		}
	};
	exports.CancellationTokenSource = CancellationTokenSource;
	var cancelledMessage = "Cancelled";
	function cancelled() {
		return new Error(cancelledMessage);
	}
	function isCancelled(err) {
		return !!err && err.message === cancelledMessage;
	}
	function checkCancelled(token) {
		if (!!token && token.isCancellationRequested) throw cancelled();
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/emitter.js
var require_emitter = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.AsyncEmitter = exports.WaitUntilEvent = exports.Emitter = void 0;
	var event_1 = require_event();
	var Emitter = class Emitter {
		constructor(_options) {
			this._options = _options;
			this._disposed = false;
			this._leakWarnCountdown = 0;
		}
		/**
		* For the public to allow to subscribe
		* to events from this Emitter
		*/
		get event() {
			if (!this._event) this._event = Object.assign((listener, thisArgs, disposables) => {
				if (!this._callbacks) this._callbacks = new event_1.CallbackList();
				if (this._options && this._options.onFirstListenerAdd && this._callbacks.isEmpty()) this._options.onFirstListenerAdd(this);
				this._callbacks.add(listener, thisArgs);
				const removeMaxListenersCheck = this.checkMaxListeners(this._event.maxListeners);
				const result = { dispose: () => {
					if (removeMaxListenersCheck) removeMaxListenersCheck();
					result.dispose = Emitter._noop;
					if (!this._disposed) {
						this._callbacks.remove(listener, thisArgs);
						result.dispose = Emitter._noop;
						if (this._options && this._options.onLastListenerRemove && this._callbacks.isEmpty()) this._options.onLastListenerRemove(this);
					}
				} };
				if (Array.isArray(disposables)) disposables.push(result);
				return result;
			}, { maxListeners: Emitter.LEAK_WARNING_THRESHHOLD });
			return this._event;
		}
		checkMaxListeners(maxListeners) {
			if (maxListeners === 0 || !this._callbacks) return;
			const listenerCount = this._callbacks.length;
			if (listenerCount <= maxListeners) return;
			const popStack = this.pushLeakingStack();
			this._leakWarnCountdown -= 1;
			if (this._leakWarnCountdown <= 0) {
				this._leakWarnCountdown = maxListeners * .5;
				let topStack;
				let topCount = 0;
				this._leakingStacks.forEach((stackCount, stack) => {
					if (!topStack || topCount < stackCount) {
						topStack = stack;
						topCount = stackCount;
					}
				});
				console.warn(`Possible Emitter memory leak detected. ${listenerCount} listeners added. Use event.maxListeners to increase the limit (${maxListeners}). MOST frequent listener (${topCount}):`);
				console.warn(topStack);
			}
			return popStack;
		}
		pushLeakingStack() {
			if (!this._leakingStacks) this._leakingStacks = /* @__PURE__ */ new Map();
			const stack = (/* @__PURE__ */ new Error()).stack.split("\n").slice(3).join("\n");
			const count = this._leakingStacks.get(stack) || 0;
			this._leakingStacks.set(stack, count + 1);
			return () => this.popLeakingStack(stack);
		}
		popLeakingStack(stack) {
			if (!this._leakingStacks) return;
			const count = this._leakingStacks.get(stack) || 0;
			this._leakingStacks.set(stack, count - 1);
		}
		/**
		* To be kept private to fire an event to
		* subscribers
		*/
		fire(event) {
			if (this._callbacks) this._callbacks.invoke(event);
		}
		/**
		* Process each listener one by one.
		* Return `false` to stop iterating over the listeners, `true` to continue.
		*/
		async sequence(processor) {
			if (this._callbacks) {
				for (const listener of this._callbacks) if (!await processor(listener)) break;
			}
		}
		dispose() {
			if (this._leakingStacks) {
				this._leakingStacks.clear();
				this._leakingStacks = void 0;
			}
			if (this._callbacks) {
				this._callbacks.dispose();
				this._callbacks = void 0;
			}
			this._disposed = true;
		}
	};
	exports.Emitter = Emitter;
	Emitter.LEAK_WARNING_THRESHHOLD = 175;
	Emitter._noop = function() {};
	var WaitUntilEvent;
	(function(WaitUntilEvent) {
		/**
		* Fire all listeners in the same tick.
		*
		* Use `AsyncEmitter.fire` to fire listeners async one after another.
		*/
		async function fire(emitter, event, timeout = void 0) {
			const waitables = [];
			const asyncEvent = Object.assign(event, { waitUntil: (thenable) => {
				if (Object.isFrozen(waitables)) throw new Error("waitUntil cannot be called asynchronously.");
				waitables.push(thenable);
			} });
			try {
				emitter.fire(asyncEvent);
				Object.freeze(waitables);
			} finally {
				delete asyncEvent["waitUntil"];
			}
			if (!waitables.length) return;
			if (timeout !== void 0) await Promise.race([Promise.all(waitables), new Promise((resolve) => setTimeout(resolve, timeout))]);
			else await Promise.all(waitables);
		}
		WaitUntilEvent.fire = fire;
	})(WaitUntilEvent || (exports.WaitUntilEvent = WaitUntilEvent = {}));
	var cancellation_1 = require_cancellation();
	var AsyncEmitter = class extends Emitter {
		/**
		* Fire listeners async one after another.
		*/
		fire(event, token = cancellation_1.CancellationToken.None, promiseJoin) {
			const callbacks = this._callbacks;
			if (!callbacks) return Promise.resolve();
			const listeners = [...callbacks];
			if (this.deliveryQueue) return this.deliveryQueue = this.deliveryQueue.then(() => this.deliver(listeners, event, token, promiseJoin));
			return this.deliveryQueue = this.deliver(listeners, event, token, promiseJoin);
		}
		async deliver(listeners, event, token, promiseJoin) {
			for (const listener of listeners) {
				if (token.isCancellationRequested) return;
				const waitables = [];
				const asyncEvent = Object.assign(event, { waitUntil: (thenable) => {
					if (Object.isFrozen(waitables)) throw new Error("waitUntil cannot be called asynchronously.");
					if (promiseJoin) thenable = promiseJoin(thenable, listener);
					waitables.push(thenable);
				} });
				try {
					listener(event);
					Object.freeze(waitables);
				} catch (e) {
					console.error(e);
				} finally {
					delete asyncEvent["waitUntil"];
				}
				if (!waitables.length) return;
				try {
					await Promise.all(waitables);
				} catch (e) {
					console.error(e);
				}
			}
		}
	};
	exports.AsyncEmitter = AsyncEmitter;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/disposable.js
var require_disposable = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.DisposableCollection = exports.Disposable = void 0;
	var emitter_1 = require_emitter();
	var Disposable;
	(function(Disposable) {
		function is(arg) {
			return !!arg && typeof arg === "object" && "dispose" in arg && typeof arg["dispose"] === "function";
		}
		Disposable.is = is;
		function create(func) {
			return { dispose: func };
		}
		Disposable.create = create;
		Disposable.NULL = create(() => {});
	})(Disposable || (exports.Disposable = Disposable = {}));
	var DisposableCollection = class {
		constructor(...toDispose) {
			this.disposables = [];
			this.onDisposeEmitter = new emitter_1.Emitter();
			this.disposingElements = false;
			toDispose.forEach((d) => this.push(d));
		}
		/**
		* This event is fired only once
		* on first dispose of not empty collection.
		*/
		get onDispose() {
			return this.onDisposeEmitter.event;
		}
		checkDisposed() {
			if (this.disposed && !this.disposingElements) {
				this.onDisposeEmitter.fire(void 0);
				this.onDisposeEmitter.dispose();
			}
		}
		get disposed() {
			return this.disposables.length === 0;
		}
		dispose() {
			if (this.disposed || this.disposingElements) return;
			this.disposingElements = true;
			while (!this.disposed) try {
				this.disposables.pop().dispose();
			} catch (e) {
				console.error(e);
			}
			this.disposingElements = false;
			this.checkDisposed();
		}
		push(disposable) {
			const disposables = this.disposables;
			disposables.push(disposable);
			const originalDispose = disposable.dispose.bind(disposable);
			const toRemove = Disposable.create(() => {
				const index = disposables.indexOf(disposable);
				if (index !== -1) disposables.splice(index, 1);
				this.checkDisposed();
			});
			disposable.dispose = () => {
				toRemove.dispose();
				disposable.dispose = originalDispose;
				originalDispose();
			};
			return toRemove;
		}
		pushAll(disposables) {
			return disposables.map((disposable) => this.push(disposable));
		}
	};
	exports.DisposableCollection = DisposableCollection;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/os.js
var require_os = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.OS = exports.isOSX = exports.isWindows = void 0;
	exports.cmd = cmd;
	function is(userAgent, platform) {
		if (typeof navigator !== "undefined") {
			if (navigator.userAgent && navigator.userAgent.indexOf(userAgent) >= 0) return true;
		}
		if (typeof process !== "undefined") return process.platform === platform;
		return false;
	}
	exports.isWindows = is("Windows", "win32");
	exports.isOSX = is("Mac", "darwin");
	function cmd(command, ...args) {
		return [exports.isWindows ? "cmd" : command, exports.isWindows ? [
			"/c",
			command,
			...args
		] : args];
	}
	var OS;
	(function(OS) {
		/**
		* Enumeration of the supported operating systems.
		*/
		let Type;
		(function(Type) {
			Type["Windows"] = "Windows";
			Type["Linux"] = "Linux";
			Type["OSX"] = "OSX";
		})(Type = OS.Type || (OS.Type = {}));
		/**
		* Returns with the type of the operating system. If it is neither Windows nor OS X, then
		* it always returns with the `Linux` OS type.
		*/
		function type() {
			if (exports.isWindows) return Type.Windows;
			if (exports.isOSX) return Type.OSX;
			return Type.Linux;
		}
		OS.type = type;
	})(OS || (exports.OS = OS = {}));
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/proxy-util.js
var require_proxy_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.isResolveMode = isResolveMode;
	exports.getTargetClass = getTargetClass;
	exports.getTarget = getTarget;
	exports.isProxy = isProxy;
	var resolveMode = false;
	function isResolveMode() {
		return resolveMode;
	}
	function getTargetClass(obj) {
		try {
			resolveMode = true;
			const target = obj.target;
			return target ? target.constructor : obj.constructor;
		} finally {
			resolveMode = false;
		}
	}
	function getTarget(obj) {
		try {
			resolveMode = true;
			return obj.target || obj;
		} finally {
			resolveMode = false;
		}
	}
	function isProxy(obj) {
		try {
			resolveMode = true;
			return !!obj.target;
		} finally {
			resolveMode = false;
		}
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/annotation-util.js
var require_annotation_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.AnnotationUtil = void 0;
	var AnnotationUtil;
	(function(AnnotationUtil) {
		function getValueOrOption(valueOrOption, primaryProperty = "id") {
			let option = {};
			if (typeof valueOrOption === "object" && !Array.isArray(valueOrOption)) option = valueOrOption;
			else if (valueOrOption) option = { [primaryProperty]: valueOrOption };
			return option;
		}
		AnnotationUtil.getValueOrOption = getValueOrOption;
		function getType(target, targetKey, index) {
			if (index !== void 0) return Reflect.getMetadata("design:paramtypes", target, targetKey)[index];
			else return Reflect.getMetadata("design:type", target, targetKey);
		}
		AnnotationUtil.getType = getType;
	})(AnnotationUtil || (exports.AnnotationUtil = AnnotationUtil = {}));
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/global-util.js
var require_global_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.currentThis = void 0;
	function getGlobalThis() {
		if (typeof globalThis !== "undefined") return globalThis;
		if (typeof global !== "undefined") return global;
		if (typeof window !== "undefined") return window;
		if (typeof self !== "undefined") return self;
	}
	exports.currentThis = getGlobalThis();
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/async.js
var require_async = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Promises = exports.DeferredPromise = exports.IntervalCounter = exports.TaskSequentializer = exports.RunOnceWorker = exports.ProcessTimeRunOnceScheduler = exports.RunOnceScheduler = exports.IntervalTimer = exports.TimeoutTimer = exports.Queue = exports.Limiter = exports.AutoOpenBarrier = exports.Barrier = exports.ThrottledDelayer = exports.Delayer = exports.MicrotaskDelay = exports.SequencerByKey = exports.Sequencer = exports.Throttler = void 0;
	exports.isThenable = isThenable;
	exports.delay = delay;
	exports.wait = wait;
	exports.waitForEvent = waitForEvent;
	exports.createCancelablePromise = createCancelablePromise;
	exports.raceCancellation = raceCancellation;
	exports.raceCancellationError = raceCancellationError;
	exports.raceCancellablePromises = raceCancellablePromises;
	exports.raceTimeout = raceTimeout;
	exports.asPromise = asPromise;
	exports.timeout = timeout;
	exports.disposableTimeout = disposableTimeout;
	exports.sequence = sequence;
	exports.first = first;
	exports.firstParallel = firstParallel;
	exports.retry = retry;
	var cancellation_1 = require_cancellation();
	var disposable_1 = require_disposable();
	var emitter_1 = require_emitter();
	function isThenable(obj) {
		return !!obj && typeof obj.then === "function";
	}
	/**
	* A function to allow a promise resolution to be delayed by a number of milliseconds. Usage is as follows:
	*
	* `const stringValue = await myPromise.then(delay(600)).then(value => value.toString());`
	*
	* @param ms the number of millisecond to delay
	* @returns a function that returns a promise that returns the given value, but delayed
	*/
	function delay(ms) {
		return (value) => new Promise((resolve, reject) => {
			setTimeout(() => resolve(value), ms);
		});
	}
	/**
	* Constructs a promise that will resolve after a given delay.
	* @param ms the number of milliseconds to wait
	*/
	async function wait(ms) {
		await delay(ms)(void 0);
	}
	function waitForEvent(event, ms, thisArg, disposables) {
		return new Promise((resolve, reject) => {
			const registration = setTimeout(() => {
				listener.dispose();
				reject(new cancellation_1.CancellationError());
			}, ms);
			const listener = event((evt) => {
				clearTimeout(registration);
				listener.dispose();
				resolve(evt);
			}, thisArg, disposables);
		});
	}
	function createCancelablePromise(callback) {
		const source = new cancellation_1.CancellationTokenSource();
		const thenable = callback(source.token);
		const promise = new Promise((resolve, reject) => {
			const subscription = source.token.onCancellationRequested(() => {
				subscription.dispose();
				source.dispose();
				reject(new cancellation_1.CancellationError());
			});
			Promise.resolve(thenable).then((value) => {
				subscription.dispose();
				source.dispose();
				resolve(value);
			}, (err) => {
				subscription.dispose();
				source.dispose();
				reject(err);
			});
		});
		return new class {
			cancel() {
				source.cancel();
			}
			then(resolve, reject) {
				return promise.then(resolve, reject);
			}
			catch(reject) {
				return this.then(void 0, reject);
			}
			finally(onfinally) {
				return promise.finally(onfinally);
			}
		}();
	}
	function raceCancellation(promise, token, defaultValue) {
		return new Promise((resolve, reject) => {
			const ref = token.onCancellationRequested(() => {
				ref.dispose();
				resolve(defaultValue);
			});
			promise.then(resolve, reject).finally(() => ref.dispose());
		});
	}
	function raceCancellationError(promise, token) {
		return new Promise((resolve, reject) => {
			const ref = token.onCancellationRequested(() => {
				ref.dispose();
				reject(new cancellation_1.CancellationError());
			});
			promise.then(resolve, reject).finally(() => ref.dispose());
		});
	}
	async function raceCancellablePromises(cancellablePromises) {
		let resolvedPromiseIndex = -1;
		const promises = cancellablePromises.map((promise, index) => promise.then((result) => {
			resolvedPromiseIndex = index;
			return result;
		}));
		const result = await Promise.race(promises);
		cancellablePromises.forEach((cancellablePromise, index) => {
			if (index !== resolvedPromiseIndex) cancellablePromise.cancel();
		});
		return result;
	}
	function raceTimeout(promise, timeout, onTimeout) {
		let promiseResolve = void 0;
		const timer = setTimeout(() => {
			promiseResolve === null || promiseResolve === void 0 || promiseResolve(void 0);
			onTimeout === null || onTimeout === void 0 || onTimeout();
		}, timeout);
		return Promise.race([promise.finally(() => clearTimeout(timer)), new Promise((resolve) => promiseResolve = resolve)]);
	}
	function asPromise(callback) {
		return new Promise((resolve, reject) => {
			const item = callback();
			if (isThenable(item)) item.then(resolve, reject);
			else resolve(item);
		});
	}
	/**
	* A helper to prevent accumulation of sequential async tasks.
	*
	* Imagine a mail man with the sole task of delivering letters. As soon as
	* a letter submitted for delivery, he drives to the destination, delivers it
	* and returns to his base. Imagine that during the trip, N more letters were submitted.
	* When the mail man returns, he picks those N letters and delivers them all in a
	* single trip. Even though N+1 submissions occurred, only 2 deliveries were made.
	*
	* The throttler implements this via the queue() method, by providing it a task
	* factory. Following the example:
	*
	*         const throttler = new Throttler();
	*         const letters = [];
	*
	*         function deliver() {
	*             const lettersToDeliver = letters;
	*             letters = [];
	*             return makeTheTrip(lettersToDeliver);
	*         }
	*
	*         function onLetterReceived(l) {
	*             letters.push(l);
	*             throttler.queue(deliver);
	*         }
	*/
	var Throttler = class {
		constructor() {
			this.activePromise = void 0;
			this.queuedPromise = void 0;
			this.queuedPromiseFactory = void 0;
		}
		queue(promiseFactory) {
			if (this.activePromise) {
				this.queuedPromiseFactory = promiseFactory;
				if (!this.queuedPromise) {
					const onComplete = () => {
						this.queuedPromise = void 0;
						const result = this.queue(this.queuedPromiseFactory);
						this.queuedPromiseFactory = void 0;
						return result;
					};
					this.queuedPromise = new Promise((resolve) => {
						this.activePromise.then(onComplete, onComplete).then(resolve);
					});
				}
				return new Promise((resolve, reject) => {
					this.queuedPromise.then(resolve, reject);
				});
			}
			this.activePromise = promiseFactory();
			return new Promise((resolve, reject) => {
				this.activePromise.then((result) => {
					this.activePromise = void 0;
					resolve(result);
				}, (err) => {
					this.activePromise = void 0;
					reject(err);
				});
			});
		}
	};
	exports.Throttler = Throttler;
	var Sequencer = class {
		constructor() {
			this.current = Promise.resolve(void 0);
		}
		queue(promiseTask) {
			return this.current = this.current.then(() => promiseTask(), () => promiseTask());
		}
	};
	exports.Sequencer = Sequencer;
	var SequencerByKey = class {
		constructor() {
			this.promiseMap = /* @__PURE__ */ new Map();
		}
		queue(key, promiseTask) {
			var _a;
			const newPromise = ((_a = this.promiseMap.get(key)) !== null && _a !== void 0 ? _a : Promise.resolve()).catch(() => {}).then(promiseTask).finally(() => {
				if (this.promiseMap.get(key) === newPromise) this.promiseMap.delete(key);
			});
			this.promiseMap.set(key, newPromise);
			return newPromise;
		}
	};
	exports.SequencerByKey = SequencerByKey;
	var timeoutDeferred = (timeout, fn) => {
		let scheduled = true;
		const handle = setTimeout(() => {
			scheduled = false;
			fn();
		}, timeout);
		return {
			isTriggered: () => scheduled,
			dispose: () => {
				clearTimeout(handle);
				scheduled = false;
			}
		};
	};
	var microtaskDeferred = (fn) => {
		let scheduled = true;
		queueMicrotask(() => {
			if (scheduled) {
				scheduled = false;
				fn();
			}
		});
		return {
			isTriggered: () => scheduled,
			dispose: () => {
				scheduled = false;
			}
		};
	};
	/** Can be passed into the Delayed to defer using a microtask */
	exports.MicrotaskDelay = Symbol("MicrotaskDelay");
	/**
	* A helper to delay (debounce) execution of a task that is being requested often.
	*
	* Following the throttler, now imagine the mail man wants to optimize the number of
	* trips proactively. The trip itself can be long, so he decides not to make the trip
	* as soon as a letter is submitted. Instead he waits a while, in case more
	* letters are submitted. After said waiting period, if no letters were submitted, he
	* decides to make the trip. Imagine that N more letters were submitted after the first
	* one, all within a short period of time between each other. Even though N+1
	* submissions occurred, only 1 delivery was made.
	*
	* The delayer offers this behavior via the trigger() method, into which both the task
	* to be executed and the waiting period (delay) must be passed in as arguments. Following
	* the example:
	*
	*         const delayer = new Delayer(WAITING_PERIOD);
	*         const letters = [];
	*
	*         function letterReceived(l) {
	*             letters.push(l);
	*             delayer.trigger(() => { return makeTheTrip(); });
	*         }
	*/
	var Delayer = class {
		constructor(defaultDelay) {
			this.defaultDelay = defaultDelay;
			this.deferred = void 0;
			this.completionPromise = void 0;
			this.doResolve = void 0;
			this.doReject = void 0;
			this.task = void 0;
		}
		trigger(task, delay = this.defaultDelay) {
			this.task = task;
			this.cancelTimeout();
			if (!this.completionPromise) this.completionPromise = new Promise((resolve, reject) => {
				this.doResolve = resolve;
				this.doReject = reject;
			}).then(() => {
				this.completionPromise = void 0;
				this.doResolve = void 0;
				if (this.task) {
					const task = this.task;
					this.task = void 0;
					return task();
				}
			});
			const fn = () => {
				var _a;
				this.deferred = void 0;
				(_a = this.doResolve) === null || _a === void 0 || _a.call(this, void 0);
			};
			this.deferred = delay === exports.MicrotaskDelay ? microtaskDeferred(fn) : timeoutDeferred(delay, fn);
			return this.completionPromise;
		}
		isTriggered() {
			var _a;
			return !!((_a = this.deferred) === null || _a === void 0 ? void 0 : _a.isTriggered());
		}
		cancel() {
			this.cancelTimeout();
			if (this.completionPromise) {
				if (this.doReject) this.doReject(new cancellation_1.CancellationError());
				this.completionPromise = void 0;
			}
		}
		cancelTimeout() {
			var _a;
			(_a = this.deferred) === null || _a === void 0 || _a.dispose();
			this.deferred = void 0;
		}
		dispose() {
			this.cancel();
		}
	};
	exports.Delayer = Delayer;
	/**
	* A helper to delay execution of a task that is being requested often, while
	* preventing accumulation of consecutive executions, while the task runs.
	*
	* The mail man is clever and waits for a certain amount of time, before going
	* out to deliver letters. While the mail man is going out, more letters arrive
	* and can only be delivered once he is back. Once he is back the mail man will
	* do one more trip to deliver the letters that have accumulated while he was out.
	*/
	var ThrottledDelayer = class {
		constructor(defaultDelay) {
			this.delayer = new Delayer(defaultDelay);
			this.throttler = new Throttler();
		}
		trigger(promiseFactory, delay) {
			return this.delayer.trigger(() => this.throttler.queue(promiseFactory), delay);
		}
		isTriggered() {
			return this.delayer.isTriggered();
		}
		cancel() {
			this.delayer.cancel();
		}
		dispose() {
			this.delayer.dispose();
		}
	};
	exports.ThrottledDelayer = ThrottledDelayer;
	/**
	* A barrier that is initially closed and then becomes opened permanently.
	*/
	var Barrier = class {
		constructor() {
			this._isOpen = false;
			this._promise = new Promise((c, e) => {
				this._completePromise = c;
			});
		}
		isOpen() {
			return this._isOpen;
		}
		open() {
			this._isOpen = true;
			this._completePromise(true);
		}
		wait() {
			return this._promise;
		}
	};
	exports.Barrier = Barrier;
	/**
	* A barrier that is initially closed and then becomes opened permanently after a certain period of
	* time or when open is called explicitly
	*/
	var AutoOpenBarrier = class extends Barrier {
		constructor(autoOpenTimeMs) {
			super();
			this._timeout = setTimeout(() => this.open(), autoOpenTimeMs);
		}
		open() {
			clearTimeout(this._timeout);
			super.open();
		}
	};
	exports.AutoOpenBarrier = AutoOpenBarrier;
	function timeout(millis, token) {
		if (!token) return createCancelablePromise((token) => timeout(millis, token));
		return new Promise((resolve, reject) => {
			const handle = setTimeout(() => {
				disposable.dispose();
				resolve();
			}, millis);
			const disposable = token.onCancellationRequested(() => {
				clearTimeout(handle);
				disposable.dispose();
				reject(new cancellation_1.CancellationError());
			});
		});
	}
	function disposableTimeout(handler, timeout = 0) {
		const timer = setTimeout(handler, timeout);
		return disposable_1.Disposable.create(() => clearTimeout(timer));
	}
	/**
	* Runs the provided list of promise factories in sequential order. The returned
	* promise will complete to an array of results from each promise.
	*/
	function sequence(promiseFactories) {
		const results = [];
		let index = 0;
		const len = promiseFactories.length;
		function next() {
			return index < len ? promiseFactories[index++]() : void 0;
		}
		function thenHandler(result) {
			if (result !== void 0 && result !== void 0) results.push(result);
			const n = next();
			if (n) return n.then(thenHandler);
			return Promise.resolve(results);
		}
		return Promise.resolve(void 0).then(thenHandler);
	}
	function first(promiseFactories, shouldStop = (t) => !!t, defaultValue = void 0) {
		let index = 0;
		const len = promiseFactories.length;
		const loop = () => {
			if (index >= len) return Promise.resolve(defaultValue);
			const factory = promiseFactories[index++];
			return Promise.resolve(factory()).then((result) => {
				if (shouldStop(result)) return Promise.resolve(result);
				return loop();
			});
		};
		return loop();
	}
	function firstParallel(promiseList, shouldStop = (t) => !!t, defaultValue = void 0) {
		if (promiseList.length === 0) return Promise.resolve(defaultValue);
		let todo = promiseList.length;
		const finish = () => {
			var _a, _b;
			todo = -1;
			for (const promise of promiseList) (_b = (_a = promise).cancel) === null || _b === void 0 || _b.call(_a);
		};
		return new Promise((resolve, reject) => {
			for (const promise of promiseList) promise.then((result) => {
				if (--todo >= 0 && shouldStop(result)) {
					finish();
					resolve(result);
				} else if (todo === 0) resolve(defaultValue);
			}).catch((err) => {
				if (--todo >= 0) {
					finish();
					reject(err);
				}
			});
		});
	}
	/**
	* A helper to queue N promises and run them all with a max degree of parallelism. The helper
	* ensures that at any time no more than M promises are running at the same time.
	*/
	var Limiter = class {
		constructor(maxDegreeOfParalellism) {
			this._size = 0;
			this.maxDegreeOfParalellism = maxDegreeOfParalellism;
			this.outstandingPromises = [];
			this.runningPromises = 0;
			this._onDrained = new emitter_1.Emitter();
		}
		/**
		* An event that fires when every promise in the queue
		* has started to execute. In other words: no work is
		* pending to be scheduled.
		*
		* This is NOT an event that signals when all promises
		* have finished though.
		*/
		get onDrained() {
			return this._onDrained.event;
		}
		get size() {
			return this._size;
		}
		queue(factory) {
			this._size++;
			return new Promise((c, e) => {
				this.outstandingPromises.push({
					factory,
					c,
					e
				});
				this.consume();
			});
		}
		consume() {
			while (this.outstandingPromises.length && this.runningPromises < this.maxDegreeOfParalellism) {
				const iLimitedTask = this.outstandingPromises.shift();
				this.runningPromises++;
				const promise = iLimitedTask.factory();
				promise.then(iLimitedTask.c, iLimitedTask.e);
				promise.then(() => this.consumed(), () => this.consumed());
			}
		}
		consumed() {
			this._size--;
			this.runningPromises--;
			if (this.outstandingPromises.length > 0) this.consume();
			else this._onDrained.fire();
		}
		dispose() {
			this._onDrained.dispose();
		}
	};
	exports.Limiter = Limiter;
	/**
	* A queue is handles one promise at a time and guarantees that at any time only one promise is executing.
	*/
	var Queue = class extends Limiter {
		constructor() {
			super(1);
		}
	};
	exports.Queue = Queue;
	var TimeoutTimer = class {
		constructor(runner, timeout) {
			this._token = -1;
			if (typeof runner === "function" && typeof timeout === "number") this.setIfNotSet(runner, timeout);
		}
		dispose() {
			this.cancel();
		}
		cancel() {
			if (this._token !== -1) {
				clearTimeout(this._token);
				this._token = -1;
			}
		}
		cancelAndSet(runner, timeout) {
			this.cancel();
			this._token = setTimeout(() => {
				this._token = -1;
				runner();
			}, timeout);
		}
		setIfNotSet(runner, timeout) {
			if (this._token !== -1) return;
			this._token = setTimeout(() => {
				this._token = -1;
				runner();
			}, timeout);
		}
	};
	exports.TimeoutTimer = TimeoutTimer;
	var IntervalTimer = class {
		constructor() {
			this._token = -1;
		}
		dispose() {
			this.cancel();
		}
		cancel() {
			if (this._token !== -1) {
				clearInterval(this._token);
				this._token = -1;
			}
		}
		cancelAndSet(runner, interval) {
			this.cancel();
			this._token = setInterval(() => {
				runner();
			}, interval);
		}
	};
	exports.IntervalTimer = IntervalTimer;
	var RunOnceScheduler = class {
		constructor(runner, delay) {
			this.timeoutToken = -1;
			this.runner = runner;
			this.timeout = delay;
			this.timeoutHandler = this.onTimeout.bind(this);
		}
		/**
		* Dispose RunOnceScheduler
		*/
		dispose() {
			this.cancel();
			this.runner = void 0;
		}
		/**
		* Cancel current scheduled runner (if any).
		*/
		cancel() {
			if (this.isScheduled()) {
				clearTimeout(this.timeoutToken);
				this.timeoutToken = -1;
			}
		}
		/**
		* Cancel previous runner (if any) & schedule a new runner.
		*/
		schedule(delay = this.timeout) {
			this.cancel();
			this.timeoutToken = setTimeout(this.timeoutHandler, delay);
		}
		get delay() {
			return this.timeout;
		}
		set delay(value) {
			this.timeout = value;
		}
		/**
		* Returns true if scheduled.
		*/
		isScheduled() {
			return this.timeoutToken !== -1;
		}
		onTimeout() {
			this.timeoutToken = -1;
			if (this.runner) this.doRun();
		}
		doRun() {
			if (this.runner) this.runner();
		}
	};
	exports.RunOnceScheduler = RunOnceScheduler;
	/**
	* Same as `RunOnceScheduler`, but doesn't count the time spent in sleep mode.
	* > **NOTE**: Only offers 1s resolution.
	*
	* When calling `setTimeout` with 3hrs, and putting the computer immediately to sleep
	* for 8hrs, `setTimeout` will fire **as soon as the computer wakes from sleep**. But
	* this scheduler will execute 3hrs **after waking the computer from sleep**.
	*/
	var ProcessTimeRunOnceScheduler = class {
		constructor(runner, delay) {
			if (delay % 1e3 !== 0) console.warn(`ProcessTimeRunOnceScheduler resolution is 1s, ${delay}ms is not a multiple of 1000ms.`);
			this.runner = runner;
			this.timeout = delay;
			this.counter = 0;
			this.intervalToken = -1;
			this.intervalHandler = this.onInterval.bind(this);
		}
		dispose() {
			this.cancel();
			this.runner = void 0;
		}
		cancel() {
			if (this.isScheduled()) {
				clearInterval(this.intervalToken);
				this.intervalToken = -1;
			}
		}
		/**
		* Cancel previous runner (if any) & schedule a new runner.
		*/
		schedule(delay = this.timeout) {
			if (delay % 1e3 !== 0) console.warn(`ProcessTimeRunOnceScheduler resolution is 1s, ${delay}ms is not a multiple of 1000ms.`);
			this.cancel();
			this.counter = Math.ceil(delay / 1e3);
			this.intervalToken = setInterval(this.intervalHandler, 1e3);
		}
		/**
		* Returns true if scheduled.
		*/
		isScheduled() {
			return this.intervalToken !== -1;
		}
		onInterval() {
			this.counter--;
			if (this.counter > 0) return;
			clearInterval(this.intervalToken);
			this.intervalToken = -1;
			if (this.runner) this.runner();
		}
	};
	exports.ProcessTimeRunOnceScheduler = ProcessTimeRunOnceScheduler;
	var RunOnceWorker = class extends RunOnceScheduler {
		constructor(runner, timeout) {
			super(runner, timeout);
			this.units = [];
		}
		work(unit) {
			this.units.push(unit);
			if (!this.isScheduled()) this.schedule();
		}
		doRun() {
			const units = this.units;
			this.units = [];
			if (this.runner) this.runner(units);
		}
		dispose() {
			this.units = [];
			super.dispose();
		}
	};
	exports.RunOnceWorker = RunOnceWorker;
	async function retry(task, delay, retries) {
		let lastError;
		for (let i = 0; i < retries; i++) try {
			return await task();
		} catch (error) {
			lastError = error;
			await timeout(delay);
		}
		throw lastError;
	}
	var TaskSequentializer = class {
		hasPending(taskId) {
			if (!this._pending) return false;
			if (typeof taskId === "number") return this._pending.taskId === taskId;
			return !!this._pending;
		}
		get pending() {
			return this._pending ? this._pending.promise : void 0;
		}
		cancelPending() {
			var _a;
			(_a = this._pending) === null || _a === void 0 || _a.cancel();
		}
		setPending(taskId, promise, onCancel) {
			this._pending = {
				taskId,
				cancel: () => onCancel === null || onCancel === void 0 ? void 0 : onCancel(),
				promise
			};
			promise.then(() => this.donePending(taskId), () => this.donePending(taskId));
			return promise;
		}
		donePending(taskId) {
			if (this._pending && taskId === this._pending.taskId) {
				this._pending = void 0;
				this.triggerNext();
			}
		}
		triggerNext() {
			if (this._next) {
				const next = this._next;
				this._next = void 0;
				next.run().then(next.promiseResolve, next.promiseReject);
			}
		}
		setNext(run) {
			if (!this._next) {
				let promiseResolve;
				let promiseReject;
				this._next = {
					run,
					promise: new Promise((resolve, reject) => {
						promiseResolve = resolve;
						promiseReject = reject;
					}),
					promiseResolve,
					promiseReject
				};
			} else this._next.run = run;
			return this._next.promise;
		}
	};
	exports.TaskSequentializer = TaskSequentializer;
	/**
	* The `IntervalCounter` allows to count the number
	* of calls to `increment()` over a duration of
	* `interval`. This utility can be used to conditionally
	* throttle a frequent task when a certain threshold
	* is reached.
	*/
	var IntervalCounter = class {
		constructor(interval, nowFn = () => Date.now()) {
			this.interval = interval;
			this.nowFn = nowFn;
			this.lastIncrementTime = 0;
			this.value = 0;
		}
		increment() {
			const now = this.nowFn();
			if (now - this.lastIncrementTime > this.interval) {
				this.lastIncrementTime = now;
				this.value = 0;
			}
			this.value++;
			return this.value;
		}
	};
	exports.IntervalCounter = IntervalCounter;
	/**
	* Creates a promise whose resolution or rejection can be controlled imperatively.
	*/
	var DeferredPromise = class {
		get isRejected() {
			return this.rejected;
		}
		get isResolved() {
			return this.resolved;
		}
		get isSettled() {
			return this.rejected || this.resolved;
		}
		constructor() {
			this.rejected = false;
			this.resolved = false;
			this.p = new Promise((c, e) => {
				this.completeCallback = c;
				this.errorCallback = e;
			});
		}
		complete(value) {
			return new Promise((resolve) => {
				this.completeCallback(value);
				this.resolved = true;
				resolve();
			});
		}
		error(err) {
			return new Promise((resolve) => {
				this.errorCallback(err);
				this.rejected = true;
				resolve();
			});
		}
		cancel() {
			new Promise((resolve) => {
				this.errorCallback(new cancellation_1.CancellationError());
				this.rejected = true;
				resolve();
			});
		}
	};
	exports.DeferredPromise = DeferredPromise;
	var Promises;
	(function(Promises) {
		/**
		* A drop-in replacement for `Promise.all` with the only difference
		* that the method awaits every promise to either fulfill or reject.
		*
		* Similar to `Promise.all`, only the first error will be returned
		* if any.
		*/
		async function settled(promises) {
			let firstError = void 0;
			const result = await Promise.all(promises.map((promise) => promise.then((value) => value, (error) => {
				if (!firstError) firstError = error;
			})));
			if (typeof firstError !== "undefined") throw firstError;
			return result;
		}
		Promises.settled = settled;
		/**
		* A helper to create a new `Promise<T>` with a body that is a promise
		* itself. By default, an error that raises from the async body will
		* end up as a unhandled rejection, so this utility properly awaits the
		* body and rejects the promise as a normal promise does without async
		* body.
		*
		* This method should only be used in rare cases where otherwise `async`
		* cannot be used (e.g. when callbacks are involved that require this).
		*/
		function withAsyncBody(bodyFn) {
			return new Promise(async (resolve, reject) => {
				try {
					await bodyFn(resolve, reject);
				} catch (error) {
					reject(error);
				}
			});
		}
		Promises.withAsyncBody = withAsyncBody;
	})(Promises || (exports.Promises = Promises = {}));
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/url-util.js
var require_url_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.UrlUtil = void 0;
	var UrlUtil;
	(function(UrlUtil) {
		function join(...paths) {
			const resultArray = [];
			if (paths.length === 0) return "";
			if (typeof paths[0] !== "string") throw new TypeError("Url must be a string. Received " + paths[0]);
			if (paths[0].match(/^[^/:]+:\/*$/) && paths.length > 1) paths[0] = paths.shift() + paths[0];
			if (paths[0].match(/^file:\/\/\//)) paths[0] = paths[0].replace(/^([^/:]+):\/*/, "$1:///");
			else paths[0] = paths[0].replace(/^([^/:]+):\/*/, "$1://");
			for (let i = 0; i < paths.length; i++) {
				let component = paths[i];
				if (typeof component !== "string") throw new TypeError("Url must be a string. Received " + component);
				if (component === "") continue;
				if (i > 0) component = component.replace(/^[\/]+/, "");
				if (i < paths.length - 1) component = component.replace(/[\/]+$/, "");
				else component = component.replace(/[\/]+$/, "/");
				resultArray.push(component);
			}
			let str = resultArray.join("/");
			str = str.replace(/\/(\?|&|#[^!])/g, "$1");
			const parts = str.split("?");
			str = parts.shift() + (parts.length > 0 ? "?" : "") + parts.join("&");
			return str;
		}
		UrlUtil.join = join;
	})(UrlUtil || (exports.UrlUtil = UrlUtil = {}));
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/uuid.js
var require_uuid = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.generateUUUID = void 0;
	exports.isUUID = isUUID;
	var _UUIDPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	function isUUID(value) {
		return _UUIDPattern.test(value);
	}
	exports.generateUUUID = (function() {
		if (typeof crypto === "object" && typeof crypto.randomUUID === "function") return crypto.randomUUID.bind(crypto);
		let getRandomValues;
		if (typeof crypto === "object" && typeof crypto.getRandomValues === "function") getRandomValues = crypto.getRandomValues.bind(crypto);
		else getRandomValues = function(bucket) {
			for (let i = 0; i < bucket.length; i++) bucket[i] = Math.floor(Math.random() * 256);
			return bucket;
		};
		const _data = new Uint8Array(16);
		const _hex = [];
		for (let i = 0; i < 256; i++) _hex.push(i.toString(16).padStart(2, "0"));
		return function generateUuid() {
			getRandomValues(_data);
			_data[6] = _data[6] & 15 | 64;
			_data[8] = _data[8] & 63 | 128;
			let i = 0;
			let result = "";
			result += _hex[_data[i++]];
			result += _hex[_data[i++]];
			result += _hex[_data[i++]];
			result += _hex[_data[i++]];
			result += "-";
			result += _hex[_data[i++]];
			result += _hex[_data[i++]];
			result += "-";
			result += _hex[_data[i++]];
			result += _hex[_data[i++]];
			result += "-";
			result += _hex[_data[i++]];
			result += _hex[_data[i++]];
			result += "-";
			result += _hex[_data[i++]];
			result += _hex[_data[i++]];
			result += _hex[_data[i++]];
			result += _hex[_data[i++]];
			result += _hex[_data[i++]];
			result += _hex[_data[i++]];
			return result;
		};
	})();
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/error/custom-error.js
var require_custom_error = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.CustomError = void 0;
	var utils_1 = require_utils();
	/**
	* Allows to easily extend a base class to create custom applicative errors.
	*
	* example:
	* ```
	* class HttpError extends CustomError {
	*     public constructor(
	*         public code: number,
	*         message?: string,
	*      cause?: Error,
	*     ) {
	*         super(message, { cause })
	*     }
	* }
	*
	* new HttpError(404, 'Not found')
	* ```
	*/
	var CustomError = class extends Error {
		constructor(message, options) {
			super(message, options);
			Object.defineProperty(this, "name", {
				value: new.target.name,
				enumerable: false,
				configurable: true
			});
			utils_1.ErrorUtil.fixProto(this, new.target.prototype);
			utils_1.ErrorUtil.fixStack(this);
		}
	};
	exports.CustomError = CustomError;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/error/illegal-state-error.js
var require_illegal_state_error = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.IllegalStateError = void 0;
	var custom_error_1 = require_custom_error();
	var IllegalStateError = class extends custom_error_1.CustomError {};
	exports.IllegalStateError = IllegalStateError;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/assert.js
var require_assert = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Assert = void 0;
	var illegal_state_error_1 = require_illegal_state_error();
	var class_util_1 = require_class_util();
	var Assert = class {
		/**
		* Assert a boolean expression, throwing an `IllegalStateError`
		* if the expression evaluates to `false`.
		* @param expression a boolean expression
		* @param message the exception message to use if the assertion fails
		* @throws IllegalStateError if `expression` is `false`
		* @example
		* Assert.state(id === undefined, "The id property must not already be initialized");
		* Assert.state(entity.getId() === undefined,
		*     () => "ID for entity " + entity.getName() + " must not already be initialized");
		*/
		static state(expression, message) {
			if (!expression) throw new illegal_state_error_1.IllegalStateError(this.resolveMessage(message));
		}
		/**
		* Assert a boolean expression, throwing an `IllegalStateError`
		* if the expression evaluates to `false`.
		* @param expression a boolean expression
		* @param message the exception message to use if the assertion fails
		* @throws IllegalStateError if `expression` is `false`
		* @example
		* Assert.isTrue(i > 0, "The value must be greater than zero");
		* Assert.isTrue(i > 0, () => "The value '" + i + "' must be greater than zero");
		*/
		static isTrue(expression, message) {
			if (!expression) throw new illegal_state_error_1.IllegalStateError(this.resolveMessage(message));
		}
		/**
		* Assert that an object is `undefined`.
		* @param object the object to check
		* @param message the exception message to use if the assertion fails
		* @throws IllegalStateError if the object is not `undefined`
		* @example
		* Assert.isNull(value, "The value must be null");
		* Assert.isNull(value, () => "The value '" + value + "' must be null");
		*/
		static isNull(object, message) {
			if (object !== void 0 || object !== null) throw new illegal_state_error_1.IllegalStateError(this.resolveMessage(message));
		}
		/**
		* Assert that an object is not `undefined`.
		* @param object the object to check
		* @param message the exception message to use if the assertion fails
		* @throws IllegalStateError if the object is `undefined`
		* @example
		* Assert.notNull(clazz, "The class must not be null");
		* Assert.notNull(entity.getId(),
		*     () => "ID for entity " + entity.getName() + " must not be null");
		*/
		static notNull(object, message) {
			if (object === void 0 || object === null) throw new illegal_state_error_1.IllegalStateError(this.resolveMessage(message));
		}
		/**
		* Assert that the given String is not empty; that is,
		* it must not be `undefined` and not the empty String.
		* @param text the String to check
		* @param message the exception message to use if the assertion fails
		* @throws IllegalStateError if the text is empty
		* @example
		* Assert.hasLength(name, "Name must not be empty");
		* Assert.hasLength(name, () => "Name for account '" + account.getId() + "' must not be empty");
		*/
		static hasLength(text, message) {
			if (!text || text.length === 0) throw new illegal_state_error_1.IllegalStateError(this.resolveMessage(message));
		}
		/**
		* Assert that the given String contains valid text content; that is, it must not
		* be `undefined` and must contain at least one non-whitespace character.
		* @param text the String to check
		* @param message the exception message to use if the assertion fails
		* @throws IllegalStateError if the text does not contain valid text content
		* @example
		* Assert.hasText(account.getName(), "Name must not be empty");
		* Assert.hasText(account.getName(),
		*    () => "Name for account '" + account.getId() + "' must not be empty");
		*/
		static hasText(text, message) {
			if (!text || text.trim().length === 0) throw new illegal_state_error_1.IllegalStateError(this.resolveMessage(message));
		}
		/**
		* Assert that the given text does not contain the given substring.
		* @param textToSearch the text to search
		* @param substring the substring to find within the text
		* @param message the exception message to use if the assertion fails
		* @throws IllegalStateError if the text contains the substring
		* @example
		* Assert.doesNotContain(name, forbidden, "Name must not contain '" + forbidden + "'");
		* Assert.doesNotContain(name, forbidden,
		*    () => "Name must not contain '" + forbidden + "'");
		*/
		static doesNotContain(textToSearch, substring, message) {
			if (textToSearch && substring && textToSearch.includes(substring)) throw new illegal_state_error_1.IllegalStateError(this.resolveMessage(message));
		}
		/**
		* Assert that an array contains elements; that is, it must not be
		* `undefined` and must contain at least one element.
		* @param array the array to check
		* @param message the exception message to use if the assertion fails
		* @throws IllegalStateError if the object array is `undefined` or contains no elements
		* @example
		* Assert.notEmpty(array, "The array must contain elements");
		* Assert.notEmpty(array, () => "The " + arrayType + " array must contain elements");
		*/
		static notEmpty(array, message) {
			if (!array || array.length === 0) throw new illegal_state_error_1.IllegalStateError(this.resolveMessage(message));
		}
		/**
		* Assert that an array contains no `undefined` elements.
		* <p>Note: Does not complain if the array is empty!
		* @param array the array to check
		* @param message the exception message to use if the assertion fails
		* @throws IllegalStateError if the object array contains a `undefined` element
		* @example
		* Assert.noNullElements(array, "The array must contain non-null elements");
		* Assert.noNullElements(array, () => "The " + arrayType + " array must contain non-null elements");
		*/
		static noNullElements(array, message) {
			if (array) {
				for (const element of array) if (element === void 0 || element === null) throw new illegal_state_error_1.IllegalStateError(this.resolveMessage(message));
			}
		}
		/**
		* Assert that a collection contains elements; that is, it must not be
		* `undefined` and must contain at least one element.
		* @param collection the collection to check
		* @param message the exception message to use if the assertion fails
		* @throws IllegalStateError if the collection is `undefined` or
		* contains no elements
		* @example
		* Assert.notEmpty(collection, "Collection must contain elements");
		* Assert.notEmpty(collection, () => "The " + collectionType + " collection must contain elements");
		*/
		static notEmptyCollection(collection, message) {
			if (!collection || collection.length === 0) throw new illegal_state_error_1.IllegalStateError(this.resolveMessage(message));
		}
		/**
		* Assert that a collection contains no `undefined` elements.
		* <p>Note: Does not complain if the collection is empty!
		* @param collection the collection to check
		* @param message the exception message to use if the assertion fails
		* @throws IllegalStateError if the collection contains a `undefined`
		* @example
		* Assert.noNullElements(collection, "Collection must contain non-null elements");
		* Assert.noNullElements(collection, () => "The " + collectionName + " must contain non-null elements");
		*/
		static noNullElementsCollection(collection, message) {
			if (collection) {
				for (const element of collection) if (element === void 0 || element === null) throw new illegal_state_error_1.IllegalStateError(this.resolveMessage(message));
			}
		}
		/**
		* Assert that a Map contains entries; that is, it must not be `undefined`
		* and must contain at least one entry.
		* @param map the map to check
		* @param message the exception message to use if the assertion fails
		* @throws IllegalStateError if the map is `undefined` or contains no entries
		* @example
		* Assert.notEmpty(map, "The map must contain entries");
		* Assert.notEmpty(map, () => "The " + mapType + " map must contain entries");
		*/
		static notEmptyMap(map, message) {
			if (!map || map.size === 0) throw new illegal_state_error_1.IllegalStateError(this.resolveMessage(message));
		}
		/**
		* Assert that the provided object is an instance of the provided class.
		* @param type the type to check against
		* @param obj the object to check
		* @param message a message which will be prepended to provide further context.
		* If it is empty or ends in ":" or ";" or "," or ".", a full exception message
		* will be appended. If it ends in a space, the name of the offending object's
		* type will be appended. In any other case, a ":" with a space and the name
		* of the offending object's type will be appended.
		* @throws IllegalStateError if the object is not an instance of type
		* @example
		* Assert.instanceOf(Foo, foo, "Foo expected");
		* Assert.instanceOf(Foo, foo, () => "Processing " + Foo.name + ":");
		* Assert.instanceOf(Foo, foo);
		*/
		static isInstanceOf(type, obj, message) {
			this.notNull(type, "Type to check against must not be null");
			if (!(obj instanceof type)) this.instanceCheckFailed(type, obj, this.resolveMessage(message));
		}
		/**
		* Assert that `superType.isAssignableFrom(subType)` is `true`.
		* @param superType the supertype to check against
		* @param subType the subtype to check
		* @param message a message which will be prepended to provide further context.
		* If it is empty or ends in ":" or ";" or "," or ".", a full exception message
		* will be appended. If it ends in a space, the name of the offending subtype
		* will be appended. In any other case, a ":" with a space and the name of the
		* offending subtype will be appended.
		* @throws IllegalStateError if the classes are not assignable
		* @example
		* Assert.isAssignable(Number, myClass, "Number expected");
		* Assert.isAssignable(Number, myClass, () => "Processing " + myAttributeName + ":");
		*/
		static isAssignable(superType, subType, message) {
			this.notNull(superType, "Supertype to check against must not be null");
			if (subType === void 0 || !(0, class_util_1.getSuperClasses)(subType).includes(superType)) this.assignableCheckFailed(superType, subType, this.resolveMessage(message));
		}
		static instanceCheckFailed(type, obj, msg) {
			const className = obj !== void 0 ? obj.constructor.name : "undefined";
			let result = "";
			let defaultMessage = true;
			if (msg && msg.length > 0) if (this.endsWithSeparator(msg)) result = msg + " ";
			else {
				result = this.messageWithTypeName(msg, className);
				defaultMessage = false;
			}
			if (defaultMessage) result = result + `Object of class [${className}] must be an instance of ${type}`;
			throw new illegal_state_error_1.IllegalStateError(result);
		}
		static assignableCheckFailed(superType, subType, msg) {
			let result = "";
			let defaultMessage = true;
			if (msg && msg.length > 0) if (this.endsWithSeparator(msg)) result = msg + " ";
			else {
				result = this.messageWithTypeName(msg, subType);
				defaultMessage = false;
			}
			if (defaultMessage) result = result + `${subType} is not assignable to ${superType}`;
			throw new illegal_state_error_1.IllegalStateError(result);
		}
		static endsWithSeparator(msg) {
			return msg.endsWith(":") || msg.endsWith(";") || msg.endsWith(",") || msg.endsWith(".");
		}
		static messageWithTypeName(msg, typeName) {
			return msg + (msg.endsWith(" ") ? "" : ": ") + ("name" in typeName) ? typeName.name : typeName;
		}
		static resolveMessage(message) {
			return typeof message === "function" ? message() : message;
		}
	};
	exports.Assert = Assert;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/mime-type.js
var require_mime_type = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var _a;
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.MimeType = void 0;
	var assert_1 = require_assert();
	var mime_type_util_1 = require_mime_type_util();
	var MimeType = class {
		constructor(type, subtype = _a.WILDCARD_TYPE, parameters) {
			assert_1.Assert.hasLength(type, "\"type\" must not be empty");
			assert_1.Assert.hasLength(subtype, "\"subtype\" must not be empty");
			this.checkToken(type);
			this.checkToken(subtype);
			this.type = type.toLowerCase();
			this.subtype = subtype.toLowerCase();
			if (parameters) {
				const map = /* @__PURE__ */ new Map();
				for (const [key, value] of Object.entries(parameters)) {
					this.checkParameters(key, value);
					map.set(key.toLowerCase(), value);
				}
				this.parameters = map;
			} else this.parameters = /* @__PURE__ */ new Map();
		}
		checkToken(token) {
			for (let i = 0; i < token.length; i++) {
				const ch = token.charCodeAt(i);
				if (!_a.TOKEN.has(ch)) throw new Error(`Invalid token character "${String.fromCharCode(ch)}" in token "${token}"`);
			}
		}
		checkParameters(parameter, value) {
			assert_1.Assert.hasLength(parameter, "\"parameter\" must not be empty");
			assert_1.Assert.hasLength(value, "\"value\" must not be empty");
			this.checkToken(parameter);
			if (_a.PARAM_CHARSET === parameter) {
				if (!this.charset) this.charset = this.unquote(value);
			} else if (!this.isQuotedString(value)) this.checkToken(value);
		}
		isQuotedString(s) {
			if (s.length < 2) return false;
			else return s.startsWith("\"") && s.endsWith("\"") || s.startsWith("'") && s.endsWith("'");
		}
		unquote(s) {
			return this.isQuotedString(s) ? s.substring(1, s.length - 1) : s;
		}
		isWildcardType() {
			return _a.WILDCARD_TYPE === this.getType();
		}
		isWildcardSubtype() {
			const subtype = this.getSubtype();
			return _a.WILDCARD_TYPE === subtype || subtype.startsWith("*+");
		}
		isConcrete() {
			return !this.isWildcardType() && !this.isWildcardSubtype();
		}
		getType() {
			return this.type;
		}
		getSubtype() {
			return this.subtype;
		}
		getSubtypeSuffix() {
			const suffixIndex = this.subtype.lastIndexOf("+");
			if (suffixIndex !== -1 && this.subtype.length > suffixIndex) return this.subtype.substring(suffixIndex + 1);
		}
		getCharset() {
			return this.charset;
		}
		getParameter(name) {
			return this.parameters.get(name);
		}
		getParameters() {
			return this.parameters;
		}
		includes(other) {
			if (other === void 0) return false;
			if (this.isWildcardType()) return true;
			else if (this.getType() === other.getType()) {
				if (this.getSubtype() === other.getSubtype()) return true;
				if (this.isWildcardSubtype()) {
					const thisPlusIdx = this.getSubtype().lastIndexOf("+");
					if (thisPlusIdx === -1) return true;
					else {
						const otherPlusIdx = other.getSubtype().lastIndexOf("+");
						if (otherPlusIdx !== -1) {
							const thisSubtypeNoSuffix = this.getSubtype().substring(0, thisPlusIdx);
							if (this.getSubtype().substring(thisPlusIdx + 1) === other.getSubtype().substring(otherPlusIdx + 1) && _a.WILDCARD_TYPE === thisSubtypeNoSuffix) return true;
						}
					}
				}
			}
			return false;
		}
		isCompatibleWith(other) {
			if (other === void 0) return false;
			if (this.isWildcardType() || other.isWildcardType()) return true;
			else if (this.getType() === other.getType()) {
				if (this.getSubtype() === other.getSubtype()) return true;
				if (this.isWildcardSubtype() || other.isWildcardSubtype()) {
					const thisSuffix = this.getSubtypeSuffix();
					const otherSuffix = other.getSubtypeSuffix();
					if (this.getSubtype() === _a.WILDCARD_TYPE || other.getSubtype() === _a.WILDCARD_TYPE) return true;
					else if (this.isWildcardSubtype() && thisSuffix !== void 0) return thisSuffix === other.getSubtype() || thisSuffix === otherSuffix;
					else if (other.isWildcardSubtype() && otherSuffix !== void 0) return this.getSubtype() === otherSuffix || otherSuffix === thisSuffix;
				}
			}
			return false;
		}
		equalsTypeAndSubtype(other) {
			if (other === void 0) return false;
			return this.type.toLowerCase() === other.type.toLowerCase() && this.subtype.toLowerCase() === other.subtype.toLowerCase();
		}
		isPresentIn(mimeTypes) {
			for (const mimeType of mimeTypes) if (mimeType.equalsTypeAndSubtype(this)) return true;
			return false;
		}
		equals(other) {
			return this === other || other instanceof _a && this.type.toLowerCase() === other.type.toLowerCase() && this.subtype.toLowerCase() === other.subtype.toLowerCase() && this.parametersAreEqual(other);
		}
		parametersAreEqual(other) {
			if (this.parameters.size !== other.parameters.size) return false;
			for (const [key, value] of this.parameters) {
				if (!other.parameters.has(key)) return false;
				if (_a.PARAM_CHARSET === key) {
					if (this.getCharset() !== other.getCharset()) return false;
				} else if (value !== other.parameters.get(key)) return false;
			}
			return true;
		}
		isMoreSpecific(other) {
			assert_1.Assert.notNull(other, "Other must not be null");
			const thisWildcard = this.isWildcardType();
			const otherWildcard = other.isWildcardType();
			if (thisWildcard && !otherWildcard) return false;
			else if (!thisWildcard && otherWildcard) return true;
			else {
				const thisWildcardSubtype = this.isWildcardSubtype();
				const otherWildcardSubtype = other.isWildcardSubtype();
				if (thisWildcardSubtype && !otherWildcardSubtype) return false;
				else if (!thisWildcardSubtype && otherWildcardSubtype) return true;
				else if (this.getType() === other.getType() && this.getSubtype() === other.getSubtype()) return this.getParameters().size > other.getParameters().size;
				else return false;
			}
		}
		isLessSpecific(other) {
			assert_1.Assert.notNull(other, "Other must not be null");
			return other.isMoreSpecific(this);
		}
		static valueOf(value) {
			return mime_type_util_1.MimeTypeUtils.parseMimeType(value);
		}
		toString() {
			let value = this.toStringValue;
			if (!value) {
				value = this.buildString();
				this.toStringValue = value;
			}
			return value !== null && value !== void 0 ? value : "";
		}
		buildString() {
			let result = "";
			result += this.type;
			result += "/";
			result += this.subtype;
			result += this.buildParameters(this.parameters);
			return result;
		}
		buildParameters(params) {
			let result = "";
			params.forEach((val, key) => {
				result += ";";
				result += key;
				result += "=";
				result += val;
			});
			return result;
		}
	};
	exports.MimeType = MimeType;
	_a = MimeType;
	MimeType.WILDCARD_TYPE = "*";
	MimeType.PARAM_CHARSET = "charset";
	MimeType.TOKEN = /* @__PURE__ */ new Set();
	(() => {
		const ctl = /* @__PURE__ */ new Set();
		for (let i = 0; i <= 31; i++) ctl.add(i);
		ctl.add(127);
		const separators = /* @__PURE__ */ new Set();
		separators.add("(".charCodeAt(0));
		separators.add(")".charCodeAt(0));
		separators.add("<".charCodeAt(0));
		separators.add(">".charCodeAt(0));
		separators.add("@".charCodeAt(0));
		separators.add(",".charCodeAt(0));
		separators.add(";".charCodeAt(0));
		separators.add(":".charCodeAt(0));
		separators.add("\\".charCodeAt(0));
		separators.add("\"".charCodeAt(0));
		separators.add("/".charCodeAt(0));
		separators.add("[".charCodeAt(0));
		separators.add("]".charCodeAt(0));
		separators.add("?".charCodeAt(0));
		separators.add("=".charCodeAt(0));
		separators.add("{".charCodeAt(0));
		separators.add("}".charCodeAt(0));
		separators.add(" ".charCodeAt(0));
		separators.add("	".charCodeAt(0));
		for (let i = 0; i < 128; i++) if (!ctl.has(i) && !separators.has(i)) _a.TOKEN.add(i);
	})();
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/error/error-protocol.js
var require_error_protocol = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/error/illegal-argument-error.js
var require_illegal_argument_error = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.IllegalArgumentError = void 0;
	var custom_error_1 = require_custom_error();
	var IllegalArgumentError = class extends custom_error_1.CustomError {};
	exports.IllegalArgumentError = IllegalArgumentError;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/error/invalid-mime-type-error.js
var require_invalid_mime_type_error = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.InvalidMimeTypeError = void 0;
	var custom_error_1 = require_custom_error();
	var InvalidMimeTypeError = class extends custom_error_1.CustomError {
		constructor(mimeType, message) {
			super(`Invalid mime type "${mimeType}": ${message}`);
			this.mimeType = mimeType;
		}
	};
	exports.InvalidMimeTypeError = InvalidMimeTypeError;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/error/index.js
var require_error = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$11) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$11, p)) __createBinding(exports$11, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_error_protocol(), exports);
	__exportStar(require_custom_error(), exports);
	__exportStar(require_illegal_argument_error(), exports);
	__exportStar(require_illegal_state_error(), exports);
	__exportStar(require_invalid_mime_type_error(), exports);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/mime-type-util.js
var require_mime_type_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.MimeTypeUtils = void 0;
	var mime_type_1 = require_mime_type();
	var error_1 = require_error();
	var MimeTypeUtils = class {
		static parseMimeType(mimeType) {
			if (!mimeType) throw new error_1.InvalidMimeTypeError(mimeType, "\"mimeType\" must not be empty");
			if (mimeType.startsWith("multipart")) return this.parseMimeTypeInternal(mimeType);
			if (!this.cachedMimeTypes.has(mimeType)) this.cachedMimeTypes.set(mimeType, this.parseMimeTypeInternal(mimeType));
			return this.cachedMimeTypes.get(mimeType);
		}
		static parseMimeTypeInternal(mimeType) {
			let index = mimeType.indexOf(";");
			let fullType = (index >= 0 ? mimeType.substring(0, index) : mimeType).trim();
			if (fullType.length === 0) throw new error_1.InvalidMimeTypeError(mimeType, "\"mimeType\" must not be empty");
			if (fullType === "*") fullType = "*/*";
			const subIndex = fullType.indexOf("/");
			if (subIndex === -1) throw new error_1.InvalidMimeTypeError(mimeType, "does not contain \"/\"");
			if (subIndex === fullType.length - 1) throw new error_1.InvalidMimeTypeError(mimeType, "does not contain subtype after \"/\"");
			const type = fullType.substring(0, subIndex);
			const subtype = fullType.substring(subIndex + 1);
			if (type === "*" && subtype !== "*") throw new error_1.InvalidMimeTypeError(mimeType, "wildcard type is legal only in \"*/*\" (all mime types)");
			let parameters = void 0;
			do {
				let nextIndex = index + 1;
				let quoted = false;
				while (nextIndex < mimeType.length) {
					const ch = mimeType.charAt(nextIndex);
					if (ch === ";") {
						if (!quoted) break;
					} else if (ch === "\"") quoted = !quoted;
					nextIndex++;
				}
				const parameter = mimeType.substring(index + 1, nextIndex).trim();
				if (parameter.length > 0) {
					if (parameters === void 0) parameters = /* @__PURE__ */ new Map();
					const eqIndex = parameter.indexOf("=");
					if (eqIndex >= 0) {
						const attribute = parameter.substring(0, eqIndex).trim();
						const value = parameter.substring(eqIndex + 1).trim();
						parameters.set(attribute, value);
					}
				}
				index = nextIndex;
			} while (index < mimeType.length);
			try {
				return new mime_type_1.MimeType(type, subtype, parameters);
			} catch (ex) {
				throw new error_1.InvalidMimeTypeError(mimeType, ex.message);
			}
		}
		static parseMimeTypes(mimeTypes) {
			if (!mimeTypes) return [];
			return this.tokenize(mimeTypes).filter((mimeType) => !!mimeType).map(this.parseMimeType);
		}
		static tokenize(mimeTypes) {
			if (!mimeTypes) return [];
			const tokens = [];
			let inQuotes = false;
			let startIndex = 0;
			let i = 0;
			while (i < mimeTypes.length) {
				switch (mimeTypes.charAt(i)) {
					case "\"":
						inQuotes = !inQuotes;
						break;
					case ",":
						if (!inQuotes) {
							tokens.push(mimeTypes.substring(startIndex, i));
							startIndex = i + 1;
						}
						break;
					case "\\":
						i++;
						break;
				}
				i++;
			}
			tokens.push(mimeTypes.substring(startIndex));
			return tokens;
		}
		static toString(mimeTypes) {
			return mimeTypes.map((mimeType) => mimeType.toString()).join(", ");
		}
		static sortBySpecificity(mimeTypes) {
			if (mimeTypes.length > 50) throw new error_1.InvalidMimeTypeError(mimeTypes.toString(), "Too many elements");
			this.bubbleSort(mimeTypes, (a, b) => a.isLessSpecific(b));
		}
		static bubbleSort(list, swap) {
			const len = list.length;
			for (let i = 0; i < len; i++) for (let j = 1; j < len - i; j++) {
				const prev = list[j - 1];
				const cur = list[j];
				if (swap(prev, cur)) {
					list[j] = prev;
					list[j - 1] = cur;
				}
			}
		}
		static generateMultipartBoundary() {
			const boundary = new Uint8Array(Math.floor(Math.random() * 11) + 30);
			for (let i = 0; i < boundary.length; i++) boundary[i] = this.BOUNDARY_CHARS[Math.floor(Math.random() * this.BOUNDARY_CHARS.length)].charCodeAt(0);
			return boundary;
		}
		static generateMultipartBoundaryString() {
			return new TextDecoder("ascii").decode(this.generateMultipartBoundary());
		}
	};
	exports.MimeTypeUtils = MimeTypeUtils;
	MimeTypeUtils.BOUNDARY_CHARS = [
		"-",
		"_",
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"0",
		"a",
		"b",
		"c",
		"d",
		"e",
		"f",
		"g",
		"h",
		"i",
		"j",
		"k",
		"l",
		"m",
		"n",
		"o",
		"p",
		"q",
		"r",
		"s",
		"t",
		"u",
		"v",
		"w",
		"x",
		"y",
		"z",
		"A",
		"B",
		"C",
		"D",
		"E",
		"F",
		"G",
		"H",
		"I",
		"J",
		"K",
		"L",
		"M",
		"N",
		"O",
		"P",
		"Q",
		"R",
		"S",
		"T",
		"U",
		"V",
		"W",
		"X",
		"Y",
		"Z"
	];
	MimeTypeUtils.ALL = new mime_type_1.MimeType("*", "*");
	MimeTypeUtils.ALL_VALUE = "*/*";
	MimeTypeUtils.APPLICATION_GRAPHQL = new mime_type_1.MimeType("application", "graphql+json");
	MimeTypeUtils.APPLICATION_GRAPHQL_VALUE = "application/graphql+json";
	MimeTypeUtils.APPLICATION_JSON = new mime_type_1.MimeType("application", "json");
	MimeTypeUtils.APPLICATION_JSON_VALUE = "application/json";
	MimeTypeUtils.APPLICATION_OCTET_STREAM = new mime_type_1.MimeType("application", "octet-stream");
	MimeTypeUtils.APPLICATION_OCTET_STREAM_VALUE = "application/octet-stream";
	MimeTypeUtils.APPLICATION_XML = new mime_type_1.MimeType("application", "xml");
	MimeTypeUtils.APPLICATION_XML_VALUE = "application/xml";
	MimeTypeUtils.IMAGE_GIF = new mime_type_1.MimeType("image", "gif");
	MimeTypeUtils.IMAGE_GIF_VALUE = "image/gif";
	MimeTypeUtils.IMAGE_JPEG = new mime_type_1.MimeType("image", "jpeg");
	MimeTypeUtils.IMAGE_JPEG_VALUE = "image/jpeg";
	MimeTypeUtils.IMAGE_PNG = new mime_type_1.MimeType("image", "png");
	MimeTypeUtils.IMAGE_PNG_VALUE = "image/png";
	MimeTypeUtils.TEXT_HTML = new mime_type_1.MimeType("text", "html");
	MimeTypeUtils.TEXT_HTML_VALUE = "text/html";
	MimeTypeUtils.TEXT_PLAIN = new mime_type_1.MimeType("text", "plain");
	MimeTypeUtils.TEXT_PLAIN_VALUE = "text/plain";
	MimeTypeUtils.TEXT_XML = new mime_type_1.MimeType("text", "xml");
	MimeTypeUtils.TEXT_XML_VALUE = "text/xml";
	MimeTypeUtils.cachedMimeTypes = /* @__PURE__ */ new Map();
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/byte-util.js
var require_byte_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ByteUtil = void 0;
	var error_1 = require_error();
	/**
	* Byte utility class.
	*/
	var ByteUtil = class {
		static isNode() {
			return typeof Buffer !== "undefined";
		}
		static isBrowser() {
			return typeof TextDecoder !== "undefined";
		}
		static decode(bytes) {
			if (!bytes) return "";
			if (typeof bytes === "string") return bytes;
			if (this.isNode()) {
				if (bytes instanceof Buffer || bytes instanceof Uint8Array) return Buffer.from(bytes).toString("utf8");
				throw new error_1.IllegalArgumentError(`Unexpected type ${bytes.constructor.name} in Node environment.`);
			}
			if (this.isBrowser()) {
				if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) return new TextDecoder("utf8").decode(bytes);
				throw new error_1.IllegalArgumentError(`Unexpected type ${bytes.constructor.name} in Browser environment.`);
			}
			throw new error_1.IllegalArgumentError("Neither Buffer nor TextDecoder are available.");
		}
		static encodeBase64(bytes) {
			if (!bytes) return "";
			if (this.isNode()) {
				if (typeof bytes === "string") return Buffer.from(bytes, "utf8").toString("base64");
				if (bytes instanceof Buffer || bytes instanceof Uint8Array) return Buffer.from(bytes).toString("base64");
				throw new error_1.IllegalArgumentError(`Unexpected type ${bytes.constructor.name} in Node environment.`);
			}
			if (this.isBrowser()) {
				if (typeof bytes === "string") return btoa(new TextEncoder().encode(bytes).reduce((data, byte) => data + String.fromCharCode(byte), ""));
				if (bytes instanceof Uint8Array || bytes instanceof ArrayBuffer) return btoa(String.fromCharCode(...new Uint8Array(bytes)));
				throw new error_1.IllegalArgumentError(`Unexpected type ${bytes.constructor.name} in Browser environment.`);
			}
			throw new error_1.IllegalArgumentError("Neither Buffer nor TextEncoder are available.");
		}
		static decodeBase64(base64) {
			if (!base64) return new Uint8Array();
			if (this.isNode()) return Buffer.from(base64, "base64");
			if (this.isBrowser()) {
				const binary = atob(base64);
				const bytes = new Uint8Array(binary.length);
				for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
				return bytes;
			}
			throw new error_1.IllegalArgumentError("Neither Buffer nor TextEncoder are available.");
		}
	};
	exports.ByteUtil = ByteUtil;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/error-util.js
var require_error_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ErrorUtil = void 0;
	var ErrorUtil = class {
		/**
		* Fix the prototype chain of the error
		*
		* Use Object.setPrototypeOf
		* Support ES6 environments
		*
		* Fallback setting __proto__
		* Support IE11+, see https://docs.microsoft.com/en-us/scripting/javascript/reference/javascript-version-information
		*/
		static fixProto(target, prototype) {
			const setPrototypeOf = Object.setPrototypeOf;
			if (setPrototypeOf) setPrototypeOf(target, prototype);
			else target.__proto__ = prototype;
		}
		/**
		* Capture and fix the error stack when available
		*
		* Use Error.captureStackTrace
		* Support v8 environments
		*/
		static fixStack(target, fn = target.constructor) {
			const captureStackTrace = Error.captureStackTrace;
			if (captureStackTrace) captureStackTrace(target, fn);
		}
	};
	exports.ErrorUtil = ErrorUtil;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/utils/index.js
var require_utils = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$10) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$10, p)) __createBinding(exports$10, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_prioritizeable(), exports);
	__exportStar(require_promise_util(), exports);
	__exportStar(require_types(), exports);
	__exportStar(require_class_util(), exports);
	__exportStar(require_metadata_util(), exports);
	__exportStar(require_disposable(), exports);
	__exportStar(require_os(), exports);
	__exportStar(require_proxy_util(), exports);
	__exportStar(require_annotation_util(), exports);
	__exportStar(require_cancellation(), exports);
	__exportStar(require_event(), exports);
	__exportStar(require_emitter(), exports);
	__exportStar(require_global_util(), exports);
	__exportStar(require_async(), exports);
	__exportStar(require_url_util(), exports);
	__exportStar(require_uuid(), exports);
	__exportStar(require_assert(), exports);
	__exportStar(require_mime_type_util(), exports);
	__exportStar(require_mime_type(), exports);
	__exportStar(require_byte_util(), exports);
	__exportStar(require_error_util(), exports);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/container/container-provider.js
var require_container_provider = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ContainerProvider = void 0;
	var utils_1 = require_utils();
	var _container;
	var _containerDeferred = new utils_1.Deferred();
	var ContainerProvider;
	(function(ContainerProvider) {
		function set(container) {
			_container = container;
			_containerDeferred.resolve(container);
		}
		ContainerProvider.set = set;
		function provide() {
			if (!_container) throw new Error("Container is not ready yet, the timing is incorrect.");
			return _container;
		}
		ContainerProvider.provide = provide;
		function asyncProvide() {
			return _containerDeferred.promise;
		}
		ContainerProvider.asyncProvide = asyncProvide;
	})(ContainerProvider || (exports.ContainerProvider = ContainerProvider = {}));
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/constants.js
var require_constants = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.TENANT_ENABLED = exports.METADATA_KEY = void 0;
	exports.METADATA_KEY = {
		constantValue: "cell:constant-value",
		component: "cell:component"
	};
	exports.TENANT_ENABLED = "cell.tenant.enabled";
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/config/config-protocol.js
var require_config_protocol = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ConfigProvider = void 0;
	exports.ConfigProvider = Symbol("ConfigProvider");
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/config/dynamic-config.js
var require_dynamic_config = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.config = void 0;
	exports.config = {};
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/config/config-util.js
var require_config_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ConfigUtil = void 0;
	var config_protocol_1 = require_config_protocol();
	var container_1 = require_container();
	var dynamic_config_1 = require_dynamic_config();
	var utils_1 = require_utils();
	var ConfigUtil;
	(function(ConfigUtil) {
		function get(key, defaultValue) {
			return container_1.ContainerUtil.get(config_protocol_1.ConfigProvider).get(key, defaultValue);
		}
		ConfigUtil.get = get;
		function getRaw() {
			return utils_1.currentThis.cellProps || dynamic_config_1.config;
		}
		ConfigUtil.getRaw = getRaw;
	})(ConfigUtil || (exports.ConfigUtil = ConfigUtil = {}));
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/aop/aop-protocol.js
var require_aop_protocol = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.MethodMatcher = exports.ClassFilter = exports.AopProxyFactory = exports.AfterThrowsAdvice = exports.AfterReturningAdvice = exports.MethodBeforeAdvice = exports.AOP_TAG = void 0;
	exports.AOP_TAG = "AOP_TAG";
	exports.MethodBeforeAdvice = Symbol("MethodBeforeAdvice");
	exports.AfterReturningAdvice = Symbol("AfterReturningAdvice");
	exports.AfterThrowsAdvice = Symbol("AfterThrowsAdvice");
	exports.AopProxyFactory = Symbol("AopProxyFactory");
	exports.ClassFilter = Symbol("ClassFilter");
	exports.MethodMatcher = Symbol("MethodMatcher");
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/container/container-util.js
var require_container_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ContainerUtil = void 0;
	var container_provider_1 = require_container_provider();
	var ContainerUtil;
	(function(ContainerUtil) {
		function get(serviceIdentifier) {
			return container_provider_1.ContainerProvider.provide().get(serviceIdentifier);
		}
		ContainerUtil.get = get;
		function getAll(serviceIdentifier) {
			return container_provider_1.ContainerProvider.provide().getAll(serviceIdentifier);
		}
		ContainerUtil.getAll = getAll;
		function getAllNamed(serviceIdentifier, named) {
			return container_provider_1.ContainerProvider.provide().getAllNamed(serviceIdentifier, named);
		}
		ContainerUtil.getAllNamed = getAllNamed;
		function getNamed(serviceIdentifier, named) {
			return container_provider_1.ContainerProvider.provide().getNamed(serviceIdentifier, named);
		}
		ContainerUtil.getNamed = getNamed;
		function getAllTagged(serviceIdentifier, key, value) {
			return container_provider_1.ContainerProvider.provide().getAllTagged(serviceIdentifier, key, value);
		}
		ContainerUtil.getAllTagged = getAllTagged;
		function getTagged(serviceIdentifier, key, value) {
			return container_provider_1.ContainerProvider.provide().getTagged(serviceIdentifier, key, value);
		}
		ContainerUtil.getTagged = getTagged;
	})(ContainerUtil || (exports.ContainerUtil = ContainerUtil = {}));
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/container/scope.js
var require_scope = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Scope = void 0;
	var Scope;
	(function(Scope) {
		Scope[Scope["Request"] = 0] = "Request";
		Scope[Scope["Singleton"] = 1] = "Singleton";
		Scope[Scope["Transient"] = 2] = "Transient";
	})(Scope || (exports.Scope = Scope = {}));
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/container/auto-bind.js
var require_auto_bind = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.manualBind = manualBind;
	exports.autoBind = autoBind;
	var inversify_1 = require_common$1.require_inversify();
	var constants_1 = require_constants();
	var config_util_1 = require_config_util();
	var aop_protocol_1 = require_aop_protocol();
	var container_util_1 = require_container_util();
	var scope_1 = require_scope();
	function manualBind(registry) {
		return new inversify_1.ContainerModule((bind, unbind, isBound, rebind, ...rest) => {
			if (registry) registry(bind, unbind, isBound, rebind, ...rest);
		});
	}
	function autoBind(registry) {
		const metadatas = Reflect.getMetadata(constants_1.METADATA_KEY.component, Reflect) || [];
		const constantMetadata = Reflect.getMetadata(constants_1.METADATA_KEY.constantValue, Reflect) || [];
		Reflect.defineMetadata(constants_1.METADATA_KEY.component, [], Reflect);
		Reflect.defineMetadata(constants_1.METADATA_KEY.constantValue, [], Reflect);
		return new inversify_1.ContainerModule((bind, unbind, isBound, rebind, ...rest) => {
			for (let index = metadatas.length - 1; index >= 0; index--) {
				const metadata = metadatas[index];
				resolve(metadata, bind, rebind);
			}
			constantMetadata.map((metadata) => resolveConstant(metadata, bind, rebind));
			if (registry) registry(bind, unbind, isBound, rebind, ...rest);
		});
	}
	function doProxyIfNeed(metadata, target) {
		var _a, _b;
		if (((_b = (_a = config_util_1.ConfigUtil.getRaw().cell) === null || _a === void 0 ? void 0 : _a.aop) === null || _b === void 0 ? void 0 : _b.enabled) && metadata.proxy) {
			const classFilter = container_util_1.ContainerUtil.get(aop_protocol_1.ClassFilter);
			if (target.constructor && classFilter.matches(target.constructor, metadata)) return container_util_1.ContainerUtil.get(aop_protocol_1.AopProxyFactory).create({
				target,
				metadata
			}).getProxy();
		}
		return target;
	}
	function resolve(metadata, bind, rebind) {
		let mid;
		const { ids, scope, name, tag, when, proxy, onActivation, target } = metadata;
		const _ids = [...ids];
		const id = _ids.shift();
		if (metadata.rebind) mid = rebind(_ids.shift() || id).to(target);
		else mid = bind(id).to(target);
		if (scope === scope_1.Scope.Singleton) mid = mid.inSingletonScope();
		else if (scope === scope_1.Scope.Transient) mid = mid.inTransientScope();
		if (name) mid = mid.whenTargetNamed(name);
		else if (tag) mid = mid.whenTargetTagged(tag.tag, tag.value);
		else if (metadata.default) mid = mid.whenTargetIsDefault();
		else if (when) mid = mid.when(when);
		if (onActivation) mid.onActivation(onActivation);
		else if (proxy) mid.onActivation((context, t) => doProxyIfNeed(metadata, t));
		for (const item of _ids) bind(item).toService(id);
	}
	function resolveConstant(metadata, bind, rebind) {
		const ids = Array.isArray(metadata.id) ? [...metadata.id] : [metadata.id];
		const id = ids.shift();
		if (metadata.rebind) rebind(id).toConstantValue(metadata.constantValue);
		else bind(id).toConstantValue(metadata.constantValue);
		for (const item of ids) bind(item).toService(id);
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/container/container-factory.js
var require_container_factory = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ContainerFactory = void 0;
	var inversify_1 = require_common$1.require_inversify();
	var ContainerFactory = class {
		static create(...modules) {
			const container = new inversify_1.Container({ skipBaseClassChecks: true });
			container.load(...modules);
			return container;
		}
	};
	exports.ContainerFactory = ContainerFactory;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/container/index.js
var require_container = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$9) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$9, p)) __createBinding(exports$9, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_container_provider(), exports);
	__exportStar(require_auto_bind(), exports);
	__exportStar(require_container_util(), exports);
	__exportStar(require_scope(), exports);
	__exportStar(require_container_factory(), exports);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/autowired.js
var require_autowired = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Autowired = void 0;
	exports.parseAutowiredOption = parseAutowiredOption;
	exports.applyAutowiredDecorator = applyAutowiredDecorator;
	exports.createAutowiredProperty = createAutowiredProperty;
	var inversify_1 = require_common$1.require_inversify();
	var container_1 = require_container();
	var utils_1 = require_utils();
	var Autowired = function(idOrOption) {
		return (target, targetKey, index) => {
			applyAutowiredDecorator(parseAutowiredOption(target, targetKey, index, idOrOption), target, targetKey, index);
		};
	};
	exports.Autowired = Autowired;
	var defaultAutowiredOption = {
		multi: false,
		detached: false
	};
	function parseAutowiredOption(target, targetKey, index, idOrOption) {
		const option = utils_1.AnnotationUtil.getValueOrOption(idOrOption);
		const type = utils_1.AnnotationUtil.getType(target, targetKey, index);
		if (type === Array) option.multi = true;
		option.id = option.id || type;
		return {
			...defaultAutowiredOption,
			...option
		};
	}
	function applyAutowiredDecorator(option, target, targetKey, index, doInject = ({ id, multi }, t, k, i) => multi ? (0, inversify_1.multiInject)(id)(t, k, i) : (0, inversify_1.inject)(id)(t, k, i), doGetValue = ({ id, multi }, t, property) => multi ? container_1.ContainerUtil.getAll(id) : container_1.ContainerUtil.get(id)) {
		if (option.detached) {
			if (index !== void 0) throw new Error(`The ${target.constructor.name} itself is not injected into the container, so the parameter injection of the constructor is not supported.`);
			createAutowiredProperty(option, doGetValue, target, targetKey);
		} else doInject(option, target, targetKey, index);
		return option;
	}
	function createAutowiredProperty(option, doGetValue, target, property) {
		let value;
		Object.defineProperty(target, property, {
			enumerable: true,
			get() {
				if (value !== void 0) return value;
				value = doGetValue(option, target, property);
				return value;
			}
		});
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/component.js
var require_component = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var _a, _b;
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Component = exports.COMPONENT_TAG = void 0;
	exports.parseComponentOption = parseComponentOption;
	exports.applyComponentDecorator = applyComponentDecorator;
	var inversify_1 = require_common$1.require_inversify();
	var constants_1 = require_constants();
	var config_util_1 = require_config_util();
	var utils_1 = require_utils();
	var scope_1 = require_scope();
	exports.COMPONENT_TAG = "Component";
	exports.Component = function(...idOrOption) {
		return (t) => {
			applyComponentDecorator(parseComponentOption(t, idOrOption), t);
		};
	};
	var defaultComponentOption = {
		scope: scope_1.Scope.Singleton,
		rebind: false,
		proxy: false,
		...(_b = (_a = config_util_1.ConfigUtil.getRaw().cell) === null || _a === void 0 ? void 0 : _a.annotation) === null || _b === void 0 ? void 0 : _b.Component
	};
	function parseComponentOption(target, idOrOption) {
		if (Array.isArray(idOrOption)) {
			if (idOrOption.length === 1) idOrOption = idOrOption[0];
			else if (idOrOption.length === 0) idOrOption = void 0;
		}
		const option = utils_1.AnnotationUtil.getValueOrOption(idOrOption);
		const parsed = {
			...defaultComponentOption,
			...option
		};
		let ids;
		if (Array.isArray(parsed.id)) ids = Array.from(new Set([target, ...parsed.id]));
		else if (parsed.id && parsed.id !== target) ids = [target, parsed.id];
		else ids = [target];
		parsed.id = ids;
		parsed.sysTags = [...new Set([exports.COMPONENT_TAG, ...parsed.sysTags || []])];
		return parsed;
	}
	function applyComponentDecorator(option, target) {
		if (!Reflect.hasOwnMetadata(inversify_1.METADATA_KEY.PARAM_TYPES, target)) (0, inversify_1.decorate)((0, inversify_1.injectable)(), target);
		const metadata = {
			target,
			ids: Array.isArray(option.id) ? option.id : [option.id || target],
			sysTags: option.sysTags,
			rebind: option.rebind,
			proxy: option.proxy,
			scope: option.scope,
			name: option.name,
			tag: option.tag,
			default: option.default,
			when: option.when,
			onActivation: option.onActivation
		};
		let metadatas = Reflect.getMetadata(constants_1.METADATA_KEY.component, Reflect);
		if (!metadatas) {
			metadatas = [];
			Reflect.defineMetadata(constants_1.METADATA_KEY.component, metadatas, Reflect);
		}
		metadatas.push(metadata);
		return metadata;
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/value.js
var require_value = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Value = exports.VALUE = void 0;
	exports.parseValueOption = parseValueOption;
	exports.applyValueDecorator = applyValueDecorator;
	exports.createValueProperty = createValueProperty;
	exports.bindValue = bindValue;
	var inversify_1 = require_common$1.require_inversify();
	var config_util_1 = require_config_util();
	var utils_1 = require_utils();
	var config_protocol_1 = require_config_protocol();
	exports.VALUE = Symbol("Value");
	var Value = function(elOrOption) {
		return (target, targetKey, index) => {
			applyValueDecorator(parseValueOption(target, targetKey, index, elOrOption), target, targetKey, index);
		};
	};
	exports.Value = Value;
	var defaultValueOption = { detached: false };
	function parseValueOption(target, targetKey, index, elOrOption) {
		const option = utils_1.AnnotationUtil.getValueOrOption(elOrOption, "el");
		option.el = option.el || targetKey;
		return {
			...defaultValueOption,
			...option
		};
	}
	function applyValueDecorator(option, target, targetKey, index) {
		if (option.detached) {
			if (index !== void 0) throw new Error(`The ${target.constructor.name} itself is not injected into the container, so the parameter injection of the constructor is not supported.`);
			createValueProperty(option, target, targetKey);
			return;
		}
		const el = option.el;
		(0, inversify_1.inject)(exports.VALUE)(target, targetKey, index);
		(0, inversify_1.named)(el)(target, targetKey, index);
		return option;
	}
	function createValueProperty(option, target, property) {
		Object.defineProperty(target, property, {
			enumerable: true,
			get() {
				const el = option.el;
				return config_util_1.ConfigUtil.get(el);
			}
		});
	}
	function bindValue(bind) {
		bind(exports.VALUE).toDynamicValue((ctx) => {
			const el = ctx.currentRequest.target.getNamedTag().value.toString();
			return ctx.container.get(config_protocol_1.ConfigProvider).get(el);
		});
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/optional.js
var require_optional = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Optional = void 0;
	var inversify_1 = require_common$1.require_inversify();
	Object.defineProperty(exports, "Optional", {
		enumerable: true,
		get: function() {
			return inversify_1.optional;
		}
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/constant.js
var require_constant = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Constant = void 0;
	exports.applyConstantDecorator = applyConstantDecorator;
	var constants_1 = require_constants();
	var Constant = function(id, constantValue, rebind = false) {
		return (t) => {
			applyConstantDecorator({
				id,
				constantValue,
				rebind
			}, t);
		};
	};
	exports.Constant = Constant;
	function applyConstantDecorator(option, target) {
		const previousMetadata = Reflect.getMetadata(constants_1.METADATA_KEY.constantValue, Reflect) || [];
		const newMetadata = [option].concat(previousMetadata);
		Reflect.defineMetadata(constants_1.METADATA_KEY.constantValue, newMetadata, Reflect);
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/named.js
var require_named = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Named = void 0;
	var inversify_1 = require_common$1.require_inversify();
	Object.defineProperty(exports, "Named", {
		enumerable: true,
		get: function() {
			return inversify_1.named;
		}
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/tagged.js
var require_tagged = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Tagged = void 0;
	var inversify_1 = require_common$1.require_inversify();
	Object.defineProperty(exports, "Tagged", {
		enumerable: true,
		get: function() {
			return inversify_1.tagged;
		}
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/post-construct.js
var require_post_construct = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.PostConstruct = void 0;
	var inversify_1 = require_common$1.require_inversify();
	Object.defineProperty(exports, "PostConstruct", {
		enumerable: true,
		get: function() {
			return inversify_1.postConstruct;
		}
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/pre-destroy.js
var require_pre_destroy = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.PreDestroy = void 0;
	var inversify_1 = require_common$1.require_inversify();
	Object.defineProperty(exports, "PreDestroy", {
		enumerable: true,
		get: function() {
			return inversify_1.preDestroy;
		}
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/target-name.js
var require_target_name = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.TargetName = void 0;
	var inversify_1 = require_common$1.require_inversify();
	Object.defineProperty(exports, "TargetName", {
		enumerable: true,
		get: function() {
			return inversify_1.targetName;
		}
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/injectable.js
var require_injectable = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Injectable = void 0;
	var inversify_1 = require_common$1.require_inversify();
	Object.defineProperty(exports, "Injectable", {
		enumerable: true,
		get: function() {
			return inversify_1.injectable;
		}
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/inject.js
var require_inject = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Inject = void 0;
	var inversify_1 = require_common$1.require_inversify();
	Object.defineProperty(exports, "Inject", {
		enumerable: true,
		get: function() {
			return inversify_1.inject;
		}
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/aspect.js
var require_aspect = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Aspect = void 0;
	var aop_protocol_1 = require_aop_protocol();
	var component_1 = require_component();
	var Aspect = (adviceOrAspectOption) => (target) => {
		const option = (0, component_1.parseComponentOption)(target, adviceOrAspectOption);
		option.id = Array.isArray(option.id) ? option.id[1] : option.id;
		option.pointcut = option.pointcut || component_1.COMPONENT_TAG;
		option.tag = {
			tag: aop_protocol_1.AOP_TAG,
			value: option.pointcut
		};
		(0, component_1.applyComponentDecorator)({
			proxy: false,
			...option
		}, target);
	};
	exports.Aspect = Aspect;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/service.js
var require_service = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Service = exports.SERVICE_TAG = void 0;
	exports.applyServiceDecorator = applyServiceDecorator;
	var component_1 = require_component();
	exports.SERVICE_TAG = "Service";
	exports.Service = function(...idOrOption) {
		return (t) => {
			applyServiceDecorator((0, component_1.parseComponentOption)(t, idOrOption), t);
		};
	};
	function applyServiceDecorator(option, target) {
		var _a;
		option.sysTags = ((_a = option.sysTags) === null || _a === void 0 ? void 0 : _a.indexOf(exports.SERVICE_TAG)) ? option.sysTags : [exports.SERVICE_TAG, ...option.sysTags || []];
		return (0, component_1.applyComponentDecorator)(option, target);
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/unmanaged.js
var require_unmanaged = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.Unmanaged = void 0;
	var inversify_1 = require_common$1.require_inversify();
	Object.defineProperty(exports, "Unmanaged", {
		enumerable: true,
		get: function() {
			return inversify_1.unmanaged;
		}
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/decorate.js
var require_decorate = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.decorate = void 0;
	var inversify_1 = require_common$1.require_inversify();
	Object.defineProperty(exports, "decorate", {
		enumerable: true,
		get: function() {
			return inversify_1.decorate;
		}
	});
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/provider/provider-protocol.js
var require_provider_protocol = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ComponentFilterContribution = exports.ComponentFilterRegistry = exports.ComponentFilter = exports.ProviderCreator = void 0;
	exports.ProviderCreator = Symbol("ProviderCreator");
	exports.ComponentFilter = Symbol("ComponentFilter");
	exports.ComponentFilterRegistry = Symbol("ComponentFilterRegistry");
	exports.ComponentFilterContribution = Symbol("ComponentFilterContribution");
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/autowired-provider.js
var require_autowired_provider = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.doInjectForAutowiredProvider = exports.AutowiredProvider = exports.ID_KEY = exports.PROVIDER = void 0;
	exports.bindAutowiredProvider = bindAutowiredProvider;
	var autowired_1 = require_autowired();
	var inject_1 = require_inject();
	var tagged_1 = require_tagged();
	var provider_protocol_1 = require_provider_protocol();
	exports.PROVIDER = Symbol("PROVIDER");
	exports.ID_KEY = Symbol("ID_KEY");
	var AutowiredProvider = function(idOrOption) {
		return (target, targetKey, index) => {
			const option = (0, autowired_1.parseAutowiredOption)(target, targetKey, index, idOrOption);
			(0, autowired_1.applyAutowiredDecorator)(option, target, targetKey, index, exports.doInjectForAutowiredProvider);
		};
	};
	exports.AutowiredProvider = AutowiredProvider;
	var doInjectForAutowiredProvider = (option, t, k, i) => {
		(0, inject_1.Inject)(exports.PROVIDER)(t, k, i);
		(0, tagged_1.Tagged)(exports.ID_KEY, option.id)(t, k, i);
	};
	exports.doInjectForAutowiredProvider = doInjectForAutowiredProvider;
	function bindAutowiredProvider(bind) {
		bind(exports.PROVIDER).toDynamicValue((ctx) => {
			var _a;
			const id = (_a = ctx.currentRequest.target.getCustomTags()) === null || _a === void 0 ? void 0 : _a.find((m) => m.key === exports.ID_KEY).value;
			return ctx.container.get(provider_protocol_1.ProviderCreator).create(id, ctx.container);
		});
	}
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/annotation/index.js
var require_annotation = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$8) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$8, p)) __createBinding(exports$8, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_autowired(), exports);
	__exportStar(require_component(), exports);
	__exportStar(require_value(), exports);
	__exportStar(require_optional(), exports);
	__exportStar(require_constant(), exports);
	__exportStar(require_named(), exports);
	__exportStar(require_tagged(), exports);
	__exportStar(require_post_construct(), exports);
	__exportStar(require_pre_destroy(), exports);
	__exportStar(require_target_name(), exports);
	__exportStar(require_injectable(), exports);
	__exportStar(require_inject(), exports);
	__exportStar(require_aspect(), exports);
	__exportStar(require_service(), exports);
	__exportStar(require_unmanaged(), exports);
	__exportStar(require_decorate(), exports);
	__exportStar(require_autowired_provider(), exports);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/logger/logger-protocol.js
var require_logger_protocol = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.onLogEmitter = exports.LoggerService = exports.TraceIdProvider = exports.Logger = exports.LOGGER_LEVEL = exports.LOGGER_CONFIG = void 0;
	var utils_1 = require_utils();
	exports.LOGGER_CONFIG = "cell.logger";
	exports.LOGGER_LEVEL = `${exports.LOGGER_CONFIG}.level`;
	exports.Logger = Symbol("Logger");
	exports.TraceIdProvider = Symbol("TraceIdProvider");
	exports.LoggerService = Symbol("LoggerService");
	exports.onLogEmitter = new utils_1.Emitter();
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/application/application-protocol.js
var require_application_protocol = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	var __metadata = exports && exports.__metadata || function(k, v) {
		if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.AbstractApplicationStateService = exports.AbstractApplication = exports.ApplicationProps = exports.ApplicationStateService = exports.Application = exports.ApplicationLifecycle = void 0;
	var promise_util_1 = require_promise_util();
	var emitter_1 = require_emitter();
	var logger_protocol_1 = require_logger_protocol();
	var annotation_1 = require_annotation();
	exports.ApplicationLifecycle = Symbol("ApplicationLifecycle");
	exports.Application = Symbol("Application");
	exports.ApplicationStateService = Symbol("ApplicationStateService");
	exports.ApplicationProps = Symbol("ApplicationProps");
	var AbstractApplication = class {
		/**
		* Initialize and start the frontend application.
		*/
		async doStart() {
			for (const lifecycle of this.lifecycles) if (lifecycle.initialize) try {
				lifecycle.initialize();
			} catch (error) {
				this.logger.error("Could not initialize lifecycle", error);
			}
			for (const lifecycle of this.lifecycles) if (lifecycle.onStart) try {
				await lifecycle.onStart(this);
			} catch (error) {
				this.logger.error("Could not start lifecycle", error);
			}
		}
		/**
		* Stop the frontend application lifecycle.
		*/
		doStop() {
			for (const lifecycle of this.lifecycles) if (lifecycle.onStop) try {
				lifecycle.onStop(this);
			} catch (error) {
				this.logger.error("Could not stop lifecycle", error);
			}
		}
	};
	exports.AbstractApplication = AbstractApplication;
	__decorate([
		(0, annotation_1.Autowired)(exports.ApplicationLifecycle),
		(0, annotation_1.Optional)(),
		__metadata("design:type", Array)
	], AbstractApplication.prototype, "lifecycles", void 0);
	__decorate([(0, annotation_1.Autowired)(logger_protocol_1.Logger), __metadata("design:type", Object)], AbstractApplication.prototype, "logger", void 0);
	var AbstractApplicationStateService = class {
		constructor() {
			this._state = "init";
			this.deferred = {};
			this.stateChanged = new emitter_1.Emitter();
		}
		get state() {
			return this._state;
		}
		set state(state) {
			if (state !== this._state) {
				this.deferred[this._state] = new promise_util_1.Deferred();
				this._state = state;
				if (this.deferred[state] === void 0) this.deferred[state] = new promise_util_1.Deferred();
				this.deferred[state].resolve();
				this.stateChanged.fire(state);
			}
		}
		get onStateChanged() {
			return this.stateChanged.event;
		}
		reachedState(state) {
			if (this.deferred[state] === void 0) this.deferred[state] = new promise_util_1.Deferred();
			return this.deferred[state].promise;
		}
		reachedAnyState(...states) {
			return Promise.race(states.map((s) => this.reachedState(s)));
		}
	};
	exports.AbstractApplicationStateService = AbstractApplicationStateService;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/application/application-error.js
var require_application_error = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ApplicationError = void 0;
	var ApplicationError;
	(function(ApplicationError) {
		const codes = [];
		function declare(code, factory) {
			if (codes.indexOf(code) !== -1) throw new Error(`An application error for '${code}' code is already declared`);
			const constructorOpt = Object.assign((...args) => new Impl(code, factory(...args), constructorOpt), {
				code,
				is(arg) {
					return arg instanceof Impl && arg.code === code;
				}
			});
			return constructorOpt;
		}
		ApplicationError.declare = declare;
		function is(arg) {
			return arg instanceof Impl;
		}
		ApplicationError.is = is;
		function fromJson(code, raw) {
			return new Impl(code, raw);
		}
		ApplicationError.fromJson = fromJson;
		class Impl extends Error {
			constructor(code, raw, constructorOpt) {
				super(raw.message);
				this.code = code;
				this.data = raw.data;
				Object.setPrototypeOf(this, Impl.prototype);
				if (raw.stack) this.stack = raw.stack;
				else if (Error.captureStackTrace && constructorOpt) Error.captureStackTrace(this, constructorOpt);
			}
			toJson() {
				const { message, data, stack } = this;
				return {
					message,
					data,
					stack
				};
			}
		}
	})(ApplicationError || (exports.ApplicationError = ApplicationError = {}));
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/application/index.js
var require_application = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$7) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$7, p)) __createBinding(exports$7, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_application_protocol(), exports);
	__exportStar(require_application_error(), exports);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/logger/abstract-logger.js
var require_abstract_logger = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	var __metadata = exports && exports.__metadata || function(k, v) {
		if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.AbstractLogger = void 0;
	var annotation_1 = require_annotation();
	var logger_protocol_1 = require_logger_protocol();
	var AbstractLogger = class {
		constructor() {
			this.timeRecords = /* @__PURE__ */ new Map();
		}
		setContext(context) {
			this.context = context;
		}
		resolveContextString(context) {
			if (this.context) return context ? `[${this.context}] [${context}] ` : `[${this.context}] `;
			return context ? `[${context}] ` : "";
		}
		resolvePrefix() {
			return `${(/* @__PURE__ */ new Date()).toISOString()} [${this.level}]`;
		}
		log(message, context, logFn = console.info) {
			var _a;
			const traceId = (_a = this.traceIdProvider) === null || _a === void 0 ? void 0 : _a.provide();
			const traceStr = traceId ? ` [trace: ${traceId}]` : "";
			const contextStr = this.resolveContextString(context);
			logFn(`${this.resolvePrefix()}${traceStr}${contextStr}${message}`);
			logger_protocol_1.onLogEmitter.fire({
				level: this.level,
				traceId,
				rootContext: this.context,
				context,
				message
			});
		}
		time(label) {
			this.timeRecords.set(label, Date.now());
		}
		timeEnd(label, context) {
			const start = this.timeRecords.get(label);
			if (start !== void 0) {
				const duration = Date.now() - start;
				this.timeRecords.delete(label);
				this.log(`${label} [${duration}ms]`, context);
				return duration;
			} else {
				this.log(`No such label: ${label} for timeEnd`, context);
				return;
			}
		}
	};
	exports.AbstractLogger = AbstractLogger;
	__decorate([(0, annotation_1.Value)(`${logger_protocol_1.LOGGER_LEVEL} ?: 'info'`), __metadata("design:type", String)], AbstractLogger.prototype, "level", void 0);
	__decorate([
		(0, annotation_1.Autowired)(logger_protocol_1.TraceIdProvider),
		(0, annotation_1.Optional)(),
		__metadata("design:type", Object)
	], AbstractLogger.prototype, "traceIdProvider", void 0);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/logger/logger.js
var require_logger$1 = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.LoggerImpl = void 0;
	var annotation_1 = require_annotation();
	var container_1 = require_container();
	var abstract_logger_1 = require_abstract_logger();
	var logger_protocol_1 = require_logger_protocol();
	var LoggerImpl = class LoggerImpl extends abstract_logger_1.AbstractLogger {
		error(message, context) {
			this.log(message, context, console.error.bind(console));
		}
		info(message, context) {
			if (["info", "debug"].includes(this.level)) this.log(message, context);
		}
		warn(message, context) {
			if ([
				"info",
				"debug",
				"warn"
			].includes(this.level)) this.log(message, context, console.warn.bind(console));
		}
		debug(message, context) {
			if (this.level === "debug") this.log(message, context, console.debug.bind(console));
		}
	};
	exports.LoggerImpl = LoggerImpl;
	exports.LoggerImpl = LoggerImpl = __decorate([(0, annotation_1.Component)({
		id: logger_protocol_1.Logger,
		scope: container_1.Scope.Transient
	})], LoggerImpl);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/logger/logger-service.js
var require_logger_service = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.LoggerServiceImpl = void 0;
	var annotation_1 = require_annotation();
	var logger_protocol_1 = require_logger_protocol();
	var LoggerServiceImpl = class LoggerServiceImpl {
		constructor() {
			this.onLog = logger_protocol_1.onLogEmitter.event;
		}
	};
	exports.LoggerServiceImpl = LoggerServiceImpl;
	exports.LoggerServiceImpl = LoggerServiceImpl = __decorate([(0, annotation_1.Component)(logger_protocol_1.LoggerService)], LoggerServiceImpl);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/logger/index.js
var require_logger = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$6) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$6, p)) __createBinding(exports$6, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_logger_protocol(), exports);
	__exportStar(require_logger$1(), exports);
	__exportStar(require_abstract_logger(), exports);
	__exportStar(require_logger_service(), exports);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/aop/class-filter.js
var require_class_filter = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ClassFilterImpl = void 0;
	var container_1 = require_container();
	var aop_protocol_1 = require_aop_protocol();
	var annotation_1 = require_annotation();
	var ClassFilterImpl = class ClassFilterImpl {
		matches(clazz, metadata) {
			const container = container_1.ContainerProvider.provide();
			const tagKeys = metadata.sysTags;
			for (const tagValue of tagKeys) if (container.isBoundTagged(aop_protocol_1.MethodBeforeAdvice, aop_protocol_1.AOP_TAG, tagValue) || container.isBoundTagged(aop_protocol_1.AfterThrowsAdvice, aop_protocol_1.AOP_TAG, tagValue) || container.isBoundTagged(aop_protocol_1.AfterReturningAdvice, aop_protocol_1.AOP_TAG, tagValue)) return true;
			return false;
		}
	};
	exports.ClassFilterImpl = ClassFilterImpl;
	exports.ClassFilterImpl = ClassFilterImpl = __decorate([(0, annotation_1.Component)({
		id: aop_protocol_1.ClassFilter,
		proxy: false
	})], ClassFilterImpl);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/aop/aop-proxy-factory.js
var require_aop_proxy_factory = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.AopProxyFactoryImpl = void 0;
	var utils_1 = require_utils();
	var container_1 = require_container();
	var aop_protocol_1 = require_aop_protocol();
	var annotation_1 = require_annotation();
	var AopProxyFactoryImpl = class AopProxyFactoryImpl {
		getAdvices(id, tagValues) {
			const container = container_1.ContainerProvider.provide();
			const advices = [];
			for (const tagValue of tagValues) if (container.isBoundTagged(id, aop_protocol_1.AOP_TAG, tagValue)) advices.push(...container.getAllTagged(id, aop_protocol_1.AOP_TAG, tagValue));
			return advices;
		}
		create(config) {
			const { metadata: { sysTags } } = config;
			const proxy = new Proxy(config.target, { get: (target, method, receiver) => {
				if ((0, utils_1.isResolveMode)()) return target;
				const func = target[method];
				if (typeof func === "function") return async (...args) => {
					try {
						const beforeAdvices = this.getAdvices(aop_protocol_1.MethodBeforeAdvice, sysTags);
						for (const advice of beforeAdvices) await advice.before(method, args, target);
						const returnValue = await func.apply(target, args);
						const afterReturningAdvices = this.getAdvices(aop_protocol_1.AfterReturningAdvice, sysTags);
						for (const advice of afterReturningAdvices) await advice.afterReturning(returnValue, method, args, target);
						return returnValue;
					} catch (error) {
						const afterThrowsAdvices = this.getAdvices(aop_protocol_1.AfterThrowsAdvice, sysTags);
						for (const advice of afterThrowsAdvices) await advice.afterThrows(error, method, args, target);
						throw error;
					}
				};
				return func;
			} });
			return { getProxy() {
				return proxy;
			} };
		}
	};
	exports.AopProxyFactoryImpl = AopProxyFactoryImpl;
	exports.AopProxyFactoryImpl = AopProxyFactoryImpl = __decorate([(0, annotation_1.Component)({
		id: aop_protocol_1.AopProxyFactory,
		proxy: false
	})], AopProxyFactoryImpl);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/aop/index.js
var require_aop = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$5) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$5, p)) __createBinding(exports$5, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_aop_protocol(), exports);
	__exportStar(require_class_filter(), exports);
	__exportStar(require_aop_proxy_factory(), exports);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/el/expression-protocol.js
var require_expression_protocol = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.JexlEngineProvider = exports.ExpressionContextProvider = exports.ContextInitializer = exports.ExpressionHandler = exports.ExpressionCompiler = void 0;
	exports.ExpressionCompiler = Symbol("ExpressionCompiler");
	exports.ExpressionHandler = Symbol("ExpressionHandler");
	exports.ContextInitializer = Symbol("ContextInitializer");
	exports.ExpressionContextProvider = Symbol("ExpressionContextProvider");
	exports.JexlEngineProvider = Symbol("JexlEngineProvider");
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/el/expression-compiler.js
var require_expression_compiler = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	var __metadata = exports && exports.__metadata || function(k, v) {
		if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ExpressionCompilerImpl = void 0;
	var expression_protocol_1 = require_expression_protocol();
	var annotation_1 = require_annotation();
	var ExpressionCompilerImpl = class ExpressionCompilerImpl {
		constructor() {
			this.ESCAPE_CHAR = "\\";
			this.SPECIAL_CHAR = "$";
			this.BRACKET_BEGIN = "{";
			this.BRACKET_END = "}";
		}
		getSpecialChar(opitons) {
			if (opitons.ignoreSpecialChar) return "";
			return opitons.specialChar;
		}
		equalsSpecialChar(opitons, char) {
			if (opitons.ignoreSpecialChar) return false;
			return char === opitons.specialChar;
		}
		compileSections(text, options) {
			const merged = {
				escapeChar: this.ESCAPE_CHAR,
				specialChar: this.SPECIAL_CHAR,
				bracketBegin: this.BRACKET_BEGIN,
				bracketEnd: this.BRACKET_END,
				...options
			};
			if (!text || text.indexOf(`${this.getSpecialChar(merged)}${merged.bracketBegin}`) < 0) return [];
			const sections = [];
			let middleText = text;
			while (middleText) {
				const me = this.middleCompile(middleText, merged);
				if (!me) {
					sections.push(middleText);
					middleText = void 0;
				} else {
					sections.push(me.expression);
					middleText = me.nextText;
				}
			}
			return sections;
		}
		middleCompile(text, options) {
			let me;
			const prefix = `${this.getSpecialChar(options)}${options.bracketBegin}`;
			const prefix2 = `${prefix}${options.bracketBegin}`;
			if (text.startsWith(prefix2)) me = this.nextMiddleExpression(text.substring(prefix2.length), 2, options);
			else if (text.startsWith(prefix)) me = this.nextMiddleExpression(text.substring(prefix.length), void 0, options);
			else me = this.nextString(text, options);
			return me;
		}
		nextMiddleExpression(text, bracketBeginCharNum = 1, options) {
			let stringed = false;
			let escaped = false;
			let bracketBeginCharFound = 0;
			const section = [];
			for (let i = 0; i < text.length; i++) {
				const c = text[i];
				if (!escaped) {
					if ("'" === c || "\"" === c) {
						stringed = !stringed;
						section.push(c);
						continue;
					} else if (c === options.escapeChar) {
						escaped = true;
						continue;
					}
				}
				if (stringed) {
					section.push(c);
					escaped = false;
				} else if (escaped) {
					if (this.equalsSpecialChar(options, c) || options.bracketBegin === c || options.bracketEnd === c) section.push(c);
					else {
						section.push(options.escapeChar);
						section.push(c);
					}
					escaped = false;
				} else if (options.bracketBegin === c) {
					bracketBeginCharFound++;
					section.push(c);
				} else if (options.bracketEnd === c) if (bracketBeginCharFound === 0 && bracketBeginCharNum === 1) {
					const expression = this.jexlEngineProvider.provide().createExpression(section.join(""));
					let nextText;
					if (i !== text.length - 1) nextText = text.substring(i + 1);
					return {
						expression,
						nextText
					};
				} else if (bracketBeginCharFound > 0) {
					bracketBeginCharFound--;
					section.push(c);
				} else bracketBeginCharNum--;
				else section.push(c);
			}
		}
		nextString(text, options) {
			let escaped = false;
			let specialCharFound = false;
			const section = [];
			for (let i = 0; i < text.length; i++) {
				const c = text[i];
				if (!escaped) {
					if ("'" === c || "\"" === c) {
						section.push(c);
						continue;
					} else if (c === options.escapeChar) {
						escaped = true;
						continue;
					}
				}
				if (escaped) {
					if (this.equalsSpecialChar(options, c) || options.bracketBegin === c || options.bracketEnd === c) section.push(c);
					else {
						section.push(options.escapeChar);
						section.push(c);
					}
					escaped = false;
				} else if (specialCharFound || options.ignoreSpecialChar) if (options.bracketBegin === c) return {
					expression: section.join(""),
					nextText: options.ignoreSpecialChar ? text.substring(i) : text.substring(i - 1)
				};
				else {
					if (!options.ignoreSpecialChar) {
						specialCharFound = false;
						section.push(options.specialChar);
					}
					section.push(c);
				}
				else if (this.equalsSpecialChar(options, c)) specialCharFound = true;
				else section.push(c);
			}
			return { expression: section.join("") };
		}
	};
	exports.ExpressionCompilerImpl = ExpressionCompilerImpl;
	__decorate([(0, annotation_1.Autowired)(expression_protocol_1.JexlEngineProvider), __metadata("design:type", Object)], ExpressionCompilerImpl.prototype, "jexlEngineProvider", void 0);
	exports.ExpressionCompilerImpl = ExpressionCompilerImpl = __decorate([(0, annotation_1.Component)(expression_protocol_1.ExpressionCompiler)], ExpressionCompilerImpl);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/el/expression-context-provider.js
var require_expression_context_provider = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	var __metadata = exports && exports.__metadata || function(k, v) {
		if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
	};
	var __param = exports && exports.__param || function(paramIndex, decorator) {
		return function(target, key) {
			decorator(target, key, paramIndex);
		};
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ExpressionContextProviderImpl = void 0;
	var annotation_1 = require_annotation();
	var expression_protocol_1 = require_expression_protocol();
	var utils_1 = require_utils();
	var config_1 = require_config();
	var ExpressionContextProviderImpl = class ExpressionContextProviderImpl {
		constructor(contextInitializers) {
			this.contextInitializers = contextInitializers;
			this.initialized = false;
			this.ctx = config_1.ConfigUtil.getRaw();
		}
		provide() {
			if (!this.prioritized) this.prioritized = utils_1.Prioritizeable.prioritizeAllSync(this.contextInitializers).map((c) => c.value);
			if (!this.initialized) {
				this.initialized = true;
				for (const initializer of this.prioritized) initializer.initialize(this.ctx);
			}
			return this.ctx;
		}
	};
	exports.ExpressionContextProviderImpl = ExpressionContextProviderImpl;
	exports.ExpressionContextProviderImpl = ExpressionContextProviderImpl = __decorate([
		(0, annotation_1.Component)(expression_protocol_1.ExpressionContextProvider),
		__param(0, (0, annotation_1.Autowired)(expression_protocol_1.ContextInitializer)),
		__param(0, (0, annotation_1.Optional)()),
		__metadata("design:paramtypes", [Array])
	], ExpressionContextProviderImpl);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/el/expression-handler.js
var require_expression_handler = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	var __metadata = exports && exports.__metadata || function(k, v) {
		if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ExpressionHandlerImpl = void 0;
	var annotation_1 = require_annotation();
	var expression_protocol_1 = require_expression_protocol();
	var traverse = require_common$1.require_traverse();
	var ExpressionHandlerImpl = class ExpressionHandlerImpl {
		getContext(ctx, expressionCompilerOptions) {
			const c = ctx || this.expressionContextProvider.provide();
			if (!ctx && c !== this._ctx && !(expressionCompilerOptions === null || expressionCompilerOptions === void 0 ? void 0 : expressionCompilerOptions.ignoreContextExpression)) {
				this._ctx = c;
				this.handle(c, c);
			}
			return c;
		}
		handle(textOrObj, ctx, expressionCompilerOptions) {
			if (typeof textOrObj === "string") return this.doHandle(textOrObj, ctx, expressionCompilerOptions);
			else {
				const self = this;
				traverse(textOrObj).forEach(function(value) {
					if (typeof value === "string") this.update(self.handle(value, ctx, expressionCompilerOptions));
					else if (value && value._ignoreEl === true) this.update(value, true);
				});
				return textOrObj;
			}
		}
		doHandle(text, ctx, expressionCompilerOptions) {
			const sections = this.expressionCompiler.compileSections(text, expressionCompilerOptions);
			if (sections.length > 0) {
				if (this.hasExpression(sections)) {
					const c = this.getContext(ctx, expressionCompilerOptions);
					if (sections.length === 1) {
						let value = sections[0].evalSync(c);
						if (typeof value === "string") value = this.handle(value, c);
						return value;
					}
					const result = [];
					for (const section of sections) if (typeof section === "string") result.push(section);
					else {
						let value = section.evalSync(c);
						if (typeof value === "string") value = this.handle(value, c);
						result.push(value);
					}
					return result.join("");
				}
			}
			return text;
		}
		hasExpression(sections) {
			for (const section of sections) if (typeof section !== "string") return true;
			return false;
		}
	};
	exports.ExpressionHandlerImpl = ExpressionHandlerImpl;
	__decorate([(0, annotation_1.Autowired)(expression_protocol_1.JexlEngineProvider), __metadata("design:type", Object)], ExpressionHandlerImpl.prototype, "jexlEngineProvider", void 0);
	__decorate([(0, annotation_1.Autowired)(expression_protocol_1.ExpressionContextProvider), __metadata("design:type", Object)], ExpressionHandlerImpl.prototype, "expressionContextProvider", void 0);
	__decorate([(0, annotation_1.Autowired)(expression_protocol_1.ExpressionCompiler), __metadata("design:type", Object)], ExpressionHandlerImpl.prototype, "expressionCompiler", void 0);
	exports.ExpressionHandlerImpl = ExpressionHandlerImpl = __decorate([(0, annotation_1.Component)(expression_protocol_1.ExpressionHandler)], ExpressionHandlerImpl);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/el/jexl-engine-provider.js
var require_jexl_engine_provider = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.JexlEngineProviderImpl = void 0;
	var annotation_1 = require_annotation();
	var expression_protocol_1 = require_expression_protocol();
	var jexl_1 = require_common$1.require_Jexl();
	var JexlEngineProviderImpl = class JexlEngineProviderImpl {
		provide() {
			if (!this.jexlEngine) this.jexlEngine = new jexl_1.Jexl();
			return this.jexlEngine;
		}
	};
	exports.JexlEngineProviderImpl = JexlEngineProviderImpl;
	exports.JexlEngineProviderImpl = JexlEngineProviderImpl = __decorate([(0, annotation_1.Component)(expression_protocol_1.JexlEngineProvider)], JexlEngineProviderImpl);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/el/core-context-initializer.js
var require_core_context_initializer = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	var __metadata = exports && exports.__metadata || function(k, v) {
		if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.CoreContextInitializer = void 0;
	var annotation_1 = require_annotation();
	var container_1 = require_container();
	var expression_protocol_1 = require_expression_protocol();
	var CoreContextInitializer = class CoreContextInitializer {
		constructor() {
			this.priority = 500;
		}
		initialize(ctx) {
			if (typeof process !== "undefined") ctx.env = {
				...process.env,
				_ignoreEl: true
			};
			const jexlEngine = this.jexlEngineProvider.provide();
			jexlEngine.addTransform("replace", (val, searchValue, replaceValue) => val && val.replace(new RegExp(searchValue, "g"), replaceValue));
			jexlEngine.addTransform("regexp", (pattern, flags) => new RegExp(pattern, flags));
			const expressionHandler = container_1.ContainerUtil.get(expression_protocol_1.ExpressionHandler);
			jexlEngine.addTransform("eval", (text) => expressionHandler.handle(text));
		}
	};
	exports.CoreContextInitializer = CoreContextInitializer;
	__decorate([(0, annotation_1.Autowired)(expression_protocol_1.JexlEngineProvider), __metadata("design:type", Object)], CoreContextInitializer.prototype, "jexlEngineProvider", void 0);
	exports.CoreContextInitializer = CoreContextInitializer = __decorate([(0, annotation_1.Component)(expression_protocol_1.ContextInitializer)], CoreContextInitializer);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/el/index.js
var require_el = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$4) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$4, p)) __createBinding(exports$4, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_expression_protocol(), exports);
	__exportStar(require_expression_compiler(), exports);
	__exportStar(require_expression_context_provider(), exports);
	__exportStar(require_expression_handler(), exports);
	__exportStar(require_jexl_engine_provider(), exports);
	__exportStar(require_core_context_initializer(), exports);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/config/config-provider.js
var require_config_provider = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	var __metadata = exports && exports.__metadata || function(k, v) {
		if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ConfigProviderImpl = void 0;
	var config_protocol_1 = require_config_protocol();
	var annotation_1 = require_annotation();
	var el_1 = require_el();
	var ConfigProviderImpl = class ConfigProviderImpl {
		get(key, defaultValue) {
			return this.expressionHandler.handle(`\${${key}}`) || defaultValue;
		}
	};
	exports.ConfigProviderImpl = ConfigProviderImpl;
	__decorate([(0, annotation_1.Autowired)(el_1.ExpressionHandler), __metadata("design:type", Object)], ConfigProviderImpl.prototype, "expressionHandler", void 0);
	exports.ConfigProviderImpl = ConfigProviderImpl = __decorate([(0, annotation_1.Component)(config_protocol_1.ConfigProvider)], ConfigProviderImpl);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/config/index.js
var require_config = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$3) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$3, p)) __createBinding(exports$3, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_config_protocol(), exports);
	__exportStar(require_config_provider(), exports);
	__exportStar(require_config_util(), exports);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/provider/component-filter-registry.js
var require_component_filter_registry = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	var __metadata = exports && exports.__metadata || function(k, v) {
		if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
	};
	var __param = exports && exports.__param || function(paramIndex, decorator) {
		return function(target, key) {
			decorator(target, key, paramIndex);
		};
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ComponentFilterRegistryImpl = void 0;
	var provider_protocol_1 = require_provider_protocol();
	var annotation_1 = require_annotation();
	var ComponentFilterRegistryImpl = class ComponentFilterRegistryImpl {
		constructor(contributions = []) {
			this.initialized = false;
			this.genericFilters = [];
			this.typeToFilters = /* @__PURE__ */ new Map();
			for (const contribution of contributions) contribution.registerContributionFilters(this);
			this.initialized = true;
		}
		addFilters(types, filters) {
			if (this.initialized) throw new Error("cannot add filters after initialization is done.");
			else if (types === "*") this.genericFilters.push(...filters);
			else for (const type of types) this.getOrCreate(type).push(...filters);
		}
		applyFilters(toFilter, type) {
			const filters = this.getFilters(type);
			if (filters.length === 0) return toFilter;
			return toFilter.filter((object) => filters.every((filter) => filter(object)));
		}
		getOrCreate(type) {
			let value = this.typeToFilters.get(type);
			if (value === void 0) this.typeToFilters.set(type, value = []);
			return value;
		}
		getFilters(type) {
			return [...this.typeToFilters.get(type) || [], ...this.genericFilters];
		}
	};
	exports.ComponentFilterRegistryImpl = ComponentFilterRegistryImpl;
	exports.ComponentFilterRegistryImpl = ComponentFilterRegistryImpl = __decorate([
		(0, annotation_1.Component)(provider_protocol_1.ComponentFilterRegistry),
		__param(0, (0, annotation_1.Autowired)(provider_protocol_1.ComponentFilterContribution)),
		__param(0, (0, annotation_1.Optional)()),
		__metadata("design:paramtypes", [Array])
	], ComponentFilterRegistryImpl);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/provider/provider.js
var require_provider$1 = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ContainerBasedProvider = void 0;
	var provider_protocol_1 = require_provider_protocol();
	var utils_1 = require_utils();
	var DEFAULT_GET_PRIORITY = (value) => {
		if (value) {
			if ("priority" in value) return value.priority;
			else if ("order" in value) return value.order;
			return 0;
		}
	};
	var ContainerBasedProvider = class {
		constructor(componentId, container) {
			this.componentId = componentId;
			this.container = container;
		}
		get(recursive) {
			if (this.components === void 0) {
				const currentComponents = [];
				let filterRegistry;
				let currentContainer = this.container;
				while (currentContainer !== null) {
					if (currentContainer.isBound(this.componentId)) try {
						currentComponents.push(...currentContainer.getAll(this.componentId));
					} catch (error) {
						console.error(error);
					}
					if (filterRegistry === void 0 && currentContainer.isBound(provider_protocol_1.ComponentFilterRegistry)) filterRegistry = currentContainer.get(provider_protocol_1.ComponentFilterRegistry);
					currentContainer = recursive === true ? currentContainer.parent : null;
				}
				this.components = filterRegistry ? filterRegistry.applyFilters(currentComponents, this.componentId) : currentComponents;
			}
			return this.components;
		}
		sortSync(getPriority = DEFAULT_GET_PRIORITY, recursive) {
			this.components = utils_1.Prioritizeable.prioritizeAllSync(this.get(recursive), getPriority).map((c) => c.value);
			return this.components;
		}
		async sort(getPriority = DEFAULT_GET_PRIORITY, recursive) {
			this.components = (await utils_1.Prioritizeable.prioritizeAll(this.get(recursive), getPriority)).map((c) => c.value);
			return this.components;
		}
	};
	exports.ContainerBasedProvider = ContainerBasedProvider;
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/provider/provider-creator.js
var require_provider_creator = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
		var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ProviderCreatorImpl = void 0;
	var component_1 = require_component();
	var provider_protocol_1 = require_provider_protocol();
	var provider_1 = require_provider$1();
	var ProviderCreatorImpl = class ProviderCreatorImpl {
		create(id, container) {
			return new provider_1.ContainerBasedProvider(id, container);
		}
	};
	exports.ProviderCreatorImpl = ProviderCreatorImpl;
	exports.ProviderCreatorImpl = ProviderCreatorImpl = __decorate([(0, component_1.Component)(provider_protocol_1.ProviderCreator)], ProviderCreatorImpl);
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/provider/provider-util.js
var require_provider_util = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.ProviderUtil = void 0;
	var autowired_provider_1 = require_autowired_provider();
	var container_1 = require_container();
	var ProviderUtil;
	(function(ProviderUtil) {
		function get(componentId) {
			return container_1.ContainerUtil.getTagged(autowired_provider_1.PROVIDER, autowired_provider_1.ID_KEY, componentId);
		}
		ProviderUtil.get = get;
	})(ProviderUtil || (exports.ProviderUtil = ProviderUtil = {}));
}));
//#endregion
//#region ../../node_modules/.pnpm/@celljs+core@3.7.5/node_modules/@celljs/core/lib/common/provider/index.js
var require_provider = /* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$2) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$2, p)) __createBinding(exports$2, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	__exportStar(require_component_filter_registry(), exports);
	__exportStar(require_provider$1(), exports);
	__exportStar(require_provider_creator(), exports);
	__exportStar(require_provider_protocol(), exports);
	__exportStar(require_provider_util(), exports);
}));
//#endregion
//#region ../../packages/monitor/src/common/monitor-event-bridge.ts
var import_common = (/* @__PURE__ */ require_chunk.__commonJSMin(((exports) => {
	var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		var desc = Object.getOwnPropertyDescriptor(m, k);
		if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) desc = {
			enumerable: true,
			get: function() {
				return m[k];
			}
		};
		Object.defineProperty(o, k2, desc);
	}) : (function(o, m, k, k2) {
		if (k2 === void 0) k2 = k;
		o[k2] = m[k];
	}));
	var __exportStar = exports && exports.__exportStar || function(m, exports$1) {
		for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports$1, p)) __createBinding(exports$1, m, p);
	};
	Object.defineProperty(exports, "__esModule", { value: true });
	require_common$1.init_Reflect();
	__exportStar(require_utils(), exports);
	__exportStar(require_annotation(), exports);
	__exportStar(require_application(), exports);
	__exportStar(require_logger(), exports);
	__exportStar(require_container(), exports);
	__exportStar(require_aop(), exports);
	__exportStar(require_constants(), exports);
	__exportStar(require_config(), exports);
	__exportStar(require_error(), exports);
	__exportStar(require_el(), exports);
	__exportStar(require_provider(), exports);
})))();
require_common$1.init_common$2();
require_common$1.init_decorateMetadata();
require_common$1.init_decorate();
var _ref;
/**
* DI Token for MonitorEventBridgeService
*
* 注意: 为保持向后兼容，Token 名称仍为 'MonitorEventBridgeService'
* 业务代码使用 @Autowired(MonitorEventBridgeService) 注入
*/
var MonitorEventBridgeService = Symbol("MonitorEventBridgeService");
var MonitorEventBridge = class MonitorEventBridge {
	/**
	* Emit a monitoring event to the global event bus
	*
	* 事件流转:
	* Business Code → emit() → monitorEventBus → Collectors → Processors → Exporters
	*/
	emit(event, payload) {
		this.logger.debug(`[MonitorEventBridge] Forwarding event: ${String(event)}`);
		monitorEventBus.emitAsync(event, payload);
	}
};
require_common$1.__decorate([(0, import_common.Autowired)(require_common$1.Logger), require_common$1.__decorateMetadata("design:type", typeof (_ref = typeof require_common$1.Logger !== "undefined" && require_common$1.Logger) === "function" ? _ref : Object)], MonitorEventBridge.prototype, "logger", void 0);
MonitorEventBridge = require_common$1.__decorate([(0, import_common.Component)(MonitorEventBridgeService)], MonitorEventBridge);
Number.MAX_SAFE_INTEGER;
//#endregion
//#region src/main/features/monitor/collectors/chat-perf-collector.ts
/**
* ChatPerformanceCollector - 聊天性能监控（两个独立指标）
*
* 指标 1: chat.message_display — 发消息 → 用户消息呈现在屏幕上（首屏体验）
*   = sendMessage entry → api.prompt() RPC 发出（前置准备时间）
*   收集后立即上报（flushNow）
*   附带 main 进程 session 创建的详细耗时分解（从 session-create-timing store 获取）
*
* 指标 2: chat.first_response — 发消息 → 首个 assistant 回复上屏
*   包含指标1的时间 + 等待 LLM 首 token
*   60s 定时上报
*/
var MAX_PENDING_LOGS$3 = 200;
var ChatPerformanceCollector = class extends AbstractCollector {
	pendingLogs = [];
	/** 立即 flush 回调（由 DesktopMonitorService 注入） */
	onMessageDisplayRecorded;
	constructor() {
		super("ChatPerformanceCollector", true);
	}
	async onStart() {}
	async onStop() {
		this.pendingLogs = [];
	}
	async onCollect() {
		return [];
	}
	async onCollectLogs() {
		const logs = [...this.pendingLogs];
		this.pendingLogs = [];
		return logs;
	}
	/**
	* 指标 1: 用户消息上屏耗时（首屏体验）— 收集后立即上报
	*
	* 从 session-create-timing store 中查找并附加 main 进程各阶段的详细耗时:
	* - is_cold_start: 是否为冷启动（需要 spawn sidecar）
	* - main_total_ms: main 进程 session 创建总耗时
	* - find_port_ms: 寻找空闲端口
	* - prepare_ms: 解析 CLI 路径 + 构建环境变量 + 写入 system prompt
	* - sidecar_ms: sidecar 启动/重连 + PTY 创建
	* - wait_for_port_ms: 等待 CLI HTTP 端口可达
	* - acp_connect_ms: ACP WebSocket 连接（含重试）
	* - session_load_ms: CLI 中 loadSession / resumeSession
	* - renderer_overhead_ms: 端到端总耗时减去 main 耗时（daemon RPC + React state update）
	*/
	recordMessageDisplay(data) {
		const totalMs = data.displayTime - data.sendTime;
		if (totalMs < 0 || totalMs > 6e4) {
			require_logger$2.mainLog.warn(`[ChatPerfCollector] Invalid message_display: ${totalMs}ms, skipping`);
			return;
		}
		const breakdown = require_session_create_timing.consumeSessionCreateTiming(data.sessionId);
		const breakdownSummary = breakdown ? ` [main=${breakdown.totalMs}ms: prepare=${breakdown.prepareMs}ms(env=${breakdown.envResolveMs}ms,write=${breakdown.writePromptMs}ms), sidecar=${breakdown.sidecarMs}ms, waitPort=${breakdown.waitForPortMs}ms, acp=${breakdown.acpConnectMs}ms, mcp=${breakdown.mcpAssembleMs}ms, load=${breakdown.sessionLoadMs}ms, cold=${breakdown.isColdStart}]` : "";
		require_logger$2.mainLog.info(`[ChatPerfCollector] message_display: ${totalMs}ms${breakdownSummary}`);
		if (this.pendingLogs.length < MAX_PENDING_LOGS$3) {
			const attributes = {
				event: "workbuddy.chat.message_display",
				session_id: data.sessionId,
				total_ms: totalMs
			};
			if (data.modelId) attributes.model_id = data.modelId;
			if (data.modeId) attributes.mode_id = data.modeId;
			if (breakdown) {
				attributes.is_cold_start = breakdown.isColdStart;
				attributes.main_total_ms = breakdown.totalMs;
				attributes.find_port_ms = breakdown.findPortMs;
				attributes.prepare_ms = breakdown.prepareMs;
				attributes.env_resolve_ms = breakdown.envResolveMs;
				attributes.write_prompt_ms = breakdown.writePromptMs;
				attributes.sidecar_ms = breakdown.sidecarMs;
				attributes.wait_for_port_ms = breakdown.waitForPortMs;
				attributes.acp_connect_ms = breakdown.acpConnectMs;
				attributes.mcp_assemble_ms = breakdown.mcpAssembleMs;
				attributes.session_load_ms = breakdown.sessionLoadMs;
				const rendererOverheadMs = totalMs - breakdown.totalMs;
				if (rendererOverheadMs >= 0) attributes.renderer_overhead_ms = Math.round(rendererOverheadMs);
			}
			this.pendingLogs.push({
				timestamp: Date.now(),
				level: "info",
				message: "chat.message_display",
				attributes
			});
		}
		this.onMessageDisplayRecorded?.();
	}
	/**
	* 指标 2: 首个 assistant 回复上屏耗时（包含指标1的时间）
	*/
	recordFirstResponse(data) {
		const totalMs = data.firstTokenTime - data.sendTime;
		const preparationMs = data.promptSentTime - data.sendTime;
		const ttfbMs = data.firstTokenTime - data.promptSentTime;
		if (totalMs < 0 || totalMs > 3e5 || preparationMs < 0 || ttfbMs < 0) {
			require_logger$2.mainLog.warn(`[ChatPerfCollector] Invalid first_response: total=${totalMs}ms, prep=${preparationMs}ms, ttfb=${ttfbMs}ms, skipping`);
			return;
		}
		require_logger$2.mainLog.info(`[ChatPerfCollector] first_response: total=${totalMs}ms, prep=${preparationMs}ms, ttfb=${ttfbMs}ms`);
		if (this.pendingLogs.length < MAX_PENDING_LOGS$3) this.pendingLogs.push({
			timestamp: Date.now(),
			level: "info",
			message: "chat.first_response",
			attributes: {
				event: "workbuddy.chat.first_response",
				session_id: data.sessionId,
				total_ms: totalMs,
				preparation_ms: preparationMs,
				ttfb_ms: ttfbMs,
				...data.modelId ? { model_id: data.modelId } : {},
				...data.modeId ? { mode_id: data.modeId } : {}
			}
		});
	}
};
//#endregion
//#region src/main/features/monitor/collectors/cli-health-collector.ts
/**
* CliHealthCollector - CLI 进程健康监控收集器
*
* 继承 @genie/monitor 的 AbstractCollector，通过 onCollectLogs() 返回结构化日志。
*
* 日志 attributes：
* - event: workbuddy.cli
* - action: start / crash / restart
* - duration_ms: 启动耗时
* - exit_code: 退出码
* - signal: 退出信号
*/
var CliHealthCollector = class extends AbstractCollector {
	pendingLogs = [];
	constructor() {
		super("CliHealthCollector", true);
	}
	async onStart() {}
	async onStop() {
		this.pendingLogs = [];
	}
	async onCollect() {
		return [];
	}
	async onCollectLogs() {
		const logs = [...this.pendingLogs];
		this.pendingLogs = [];
		return logs;
	}
	recordCliStart(durationMs) {
		require_logger$2.mainLog.info(`[CliHealthCollector] CLI started${durationMs !== void 0 ? `, duration=${durationMs}ms` : ""}`);
		this.pendingLogs.push({
			timestamp: Date.now(),
			level: "info",
			message: "cli.start",
			attributes: {
				event: "workbuddy.cli",
				action: "start",
				...durationMs !== void 0 ? { duration_ms: durationMs } : {}
			}
		});
	}
	recordCliCrash(exitCode, signal) {
		require_logger$2.mainLog.warn(`[CliHealthCollector] CLI crashed, exitCode=${exitCode ?? "null"}, signal=${signal ?? "null"}`);
		this.pendingLogs.push({
			timestamp: Date.now(),
			level: "error",
			message: "cli.crash",
			attributes: {
				event: "workbuddy.cli",
				action: "crash",
				...exitCode != null ? { exit_code: String(exitCode) } : {},
				...signal ? { signal } : {}
			}
		});
	}
	recordCliRestart() {
		require_logger$2.mainLog.info("[CliHealthCollector] CLI restarted");
		this.pendingLogs.push({
			timestamp: Date.now(),
			level: "warn",
			message: "cli.restart",
			attributes: {
				event: "workbuddy.cli",
				action: "restart"
			}
		});
	}
};
//#endregion
//#region src/main/features/monitor/collectors/history-load-collector.ts
/**
* HistoryLoadCollector - 历史记录加载性能监控
*
* 继承 @genie/monitor 的 AbstractCollector，通过 onCollectLogs() 返回结构化日志。
*
* 3 段分时：
* - T1→T2: renderer_to_main_ms（渲染进程 → 主进程 IPC 开销）
* - T2→T3: load_and_render_ms（主进程加载 + CLI 回放 + 渲染完成）
* - T1→T3: total_ms（端到端总耗时）
*
* 日志 attributes：
* - event: workbuddy.history.load
* - session_id, request_id, total_ms, renderer_to_main_ms, load_and_render_ms
* - read_jsonl_ms, active_items, convert_ms, events, bytes, checkpoint_ms, main_push_ms, renderer_hydration_ms
* - renderer_get_session_ms, renderer_expert_hydration_ms, renderer_scene_template_ms
* - renderer_projection_replay_ms, renderer_store_switch_ms
* - renderer_replay_drain_ms, renderer_owner_rehydrate_ms, renderer_accumulator_reconcile_ms
* - renderer_team_runtime_ms, renderer_team_settle_ms, renderer_task_emit_ms, renderer_terminal_sweep_ms
* - message_count（可选）
*/
/** 最大待导出日志数 */
var MAX_PENDING_LOGS$2 = 100;
var HistoryLoadCollector = class extends AbstractCollector {
	pendingLogs = [];
	constructor() {
		super("HistoryLoadCollector", true);
	}
	async onStart() {}
	async onStop() {
		this.pendingLogs = [];
	}
	async onCollect() {
		return [];
	}
	async onCollectLogs() {
		const logs = [...this.pendingLogs];
		this.pendingLogs = [];
		return logs;
	}
	recordHistoryLoadTiming(data) {
		const totalMs = data.hydrationCompleteTime - data.rendererLoadTime;
		const rendererToMainMs = data.mainLoadTime - data.rendererLoadTime;
		const loadAndRenderMs = data.hydrationCompleteTime - data.mainLoadTime;
		if (totalMs < 0 || totalMs > 12e4 || rendererToMainMs < 0 || loadAndRenderMs < 0) {
			require_logger$2.mainLog.warn(`[HistoryLoadCollector] Invalid timing: total=${totalMs}ms, r2m=${rendererToMainMs}ms, load=${loadAndRenderMs}ms, skipping`);
			return;
		}
		const parts = [
			data.switchMode ? `mode=${data.switchMode}` : void 0,
			`total=${totalMs}ms`,
			`r2m=${rendererToMainMs}ms`,
			`load=${loadAndRenderMs}ms`,
			data.messageCount !== void 0 ? `msgs=${data.messageCount}` : void 0,
			data.readJsonlMs !== void 0 ? `readJsonl=${data.readJsonlMs}ms` : void 0,
			data.activeItems !== void 0 ? `activeItems=${data.activeItems}` : void 0,
			data.convertMs !== void 0 ? `convert=${data.convertMs}ms` : void 0,
			data.events !== void 0 ? `events=${data.events}` : void 0,
			data.bytes !== void 0 ? `bytes=${data.bytes}` : void 0,
			data.checkpointMs !== void 0 ? `checkpoint=${data.checkpointMs}ms` : void 0,
			data.mainPushMs !== void 0 ? `mainPush=${data.mainPushMs}ms` : void 0,
			data.rendererHydrationMs !== void 0 ? `rendererHydration=${data.rendererHydrationMs}ms` : void 0,
			data.rendererGetSessionMs !== void 0 ? `rendererGetSession=${data.rendererGetSessionMs}ms` : void 0,
			data.rendererExpertHydrationMs !== void 0 ? `rendererExpertHydration=${data.rendererExpertHydrationMs}ms` : void 0,
			data.rendererSceneTemplateMs !== void 0 ? `rendererSceneTemplate=${data.rendererSceneTemplateMs}ms` : void 0,
			data.rendererProjectionReplayMs !== void 0 ? `rendererProjectionReplay=${data.rendererProjectionReplayMs}ms` : void 0,
			data.rendererStoreSwitchMs !== void 0 ? `rendererStoreSwitch=${data.rendererStoreSwitchMs}ms` : void 0,
			data.rendererReplayDrainMs !== void 0 ? `rendererReplayDrain=${data.rendererReplayDrainMs}ms` : void 0,
			data.rendererOwnerRehydrateMs !== void 0 ? `rendererOwnerRehydrate=${data.rendererOwnerRehydrateMs}ms` : void 0,
			data.rendererAccumulatorReconcileMs !== void 0 ? `rendererAccumulatorReconcile=${data.rendererAccumulatorReconcileMs}ms` : void 0,
			data.rendererTeamRuntimeMs !== void 0 ? `rendererTeamRuntime=${data.rendererTeamRuntimeMs}ms` : void 0,
			data.rendererTeamSettleMs !== void 0 ? `rendererTeamSettle=${data.rendererTeamSettleMs}ms` : void 0,
			data.rendererTaskEmitMs !== void 0 ? `rendererTaskEmit=${data.rendererTaskEmitMs}ms` : void 0,
			data.rendererTerminalSweepMs !== void 0 ? `rendererTerminalSweep=${data.rendererTerminalSweepMs}ms` : void 0,
			data.requestId ? `requestId=${data.requestId}` : void 0
		].filter(Boolean);
		require_logger$2.mainLog.info(`[HistoryLoadCollector] ${parts.join(", ")}`);
		if (this.pendingLogs.length >= MAX_PENDING_LOGS$2) return;
		this.pendingLogs.push({
			timestamp: Date.now(),
			level: "info",
			message: "history.load",
			attributes: {
				event: "workbuddy.history.load",
				session_id: data.sessionId,
				...data.requestId ? { request_id: data.requestId } : {},
				...data.switchMode ? { switch_mode: data.switchMode } : {},
				total_ms: totalMs,
				renderer_to_main_ms: rendererToMainMs,
				load_and_render_ms: loadAndRenderMs,
				...data.messageCount !== void 0 ? { message_count: data.messageCount } : {},
				...data.readJsonlMs !== void 0 ? { read_jsonl_ms: data.readJsonlMs } : {},
				...data.activeItems !== void 0 ? { active_items: data.activeItems } : {},
				...data.convertMs !== void 0 ? { convert_ms: data.convertMs } : {},
				...data.events !== void 0 ? { events: data.events } : {},
				...data.bytes !== void 0 ? { bytes: data.bytes } : {},
				...data.checkpointMs !== void 0 ? { checkpoint_ms: data.checkpointMs } : {},
				...data.mainPushMs !== void 0 ? { main_push_ms: data.mainPushMs } : {},
				...data.rendererHydrationMs !== void 0 ? { renderer_hydration_ms: data.rendererHydrationMs } : {},
				...data.rendererGetSessionMs !== void 0 ? { renderer_get_session_ms: data.rendererGetSessionMs } : {},
				...data.rendererExpertHydrationMs !== void 0 ? { renderer_expert_hydration_ms: data.rendererExpertHydrationMs } : {},
				...data.rendererSceneTemplateMs !== void 0 ? { renderer_scene_template_ms: data.rendererSceneTemplateMs } : {},
				...data.rendererProjectionReplayMs !== void 0 ? { renderer_projection_replay_ms: data.rendererProjectionReplayMs } : {},
				...data.rendererStoreSwitchMs !== void 0 ? { renderer_store_switch_ms: data.rendererStoreSwitchMs } : {},
				...data.rendererReplayDrainMs !== void 0 ? { renderer_replay_drain_ms: data.rendererReplayDrainMs } : {},
				...data.rendererOwnerRehydrateMs !== void 0 ? { renderer_owner_rehydrate_ms: data.rendererOwnerRehydrateMs } : {},
				...data.rendererAccumulatorReconcileMs !== void 0 ? { renderer_accumulator_reconcile_ms: data.rendererAccumulatorReconcileMs } : {},
				...data.rendererTeamRuntimeMs !== void 0 ? { renderer_team_runtime_ms: data.rendererTeamRuntimeMs } : {},
				...data.rendererTeamSettleMs !== void 0 ? { renderer_team_settle_ms: data.rendererTeamSettleMs } : {},
				...data.rendererTaskEmitMs !== void 0 ? { renderer_task_emit_ms: data.rendererTaskEmitMs } : {},
				...data.rendererTerminalSweepMs !== void 0 ? { renderer_terminal_sweep_ms: data.rendererTerminalSweepMs } : {},
				...data.deferredDrainMs !== void 0 ? { deferred_drain_ms: data.deferredDrainMs } : {},
				...data.deferredBatchCount !== void 0 ? { deferred_batch_count: data.deferredBatchCount } : {},
				...data.deferredEventCount !== void 0 ? { deferred_event_count: data.deferredEventCount } : {}
			}
		});
	}
};
//#endregion
//#region src/main/features/monitor/collectors/migration-collector.ts
/**
* MigrationCollector - 历史记录迁移监控收集器
*
* 继承 @genie/monitor 的 AbstractCollector，通过 onCollectLogs() 返回结构化日志。
* 每个事件只上报一条日志，用 status 字段区分结果。
*
* 上报模式：
* - 每个子迁移上报 1 条：migration.{type}，status = success / failed / skipped
* - 整体汇总上报 1 条：migration.all，status = success / failed
*
* 日志 attributes：
* - event: workbuddy.migration
* - migration_type: all / history / automation / plan / ...
* - status: success / failed / skipped
* - duration_ms: 耗时
* - session_count: session 数量
* - is_incremental: 是否增量
* - error_message: 错误信息（截断 200 字符）
*/
var MigrationCollector = class extends AbstractCollector {
	pendingLogs = [];
	constructor() {
		super("MigrationCollector", true);
	}
	async onStart() {}
	async onStop() {
		this.pendingLogs = [];
	}
	async onCollect() {
		return [];
	}
	async onCollectLogs() {
		const logs = [...this.pendingLogs];
		this.pendingLogs = [];
		return logs;
	}
	/**
	* 记录一次迁移结果（子迁移或汇总）
	*/
	recordMigration(record) {
		require_logger$2.mainLog.info(`[MigrationCollector] ${record.type}: status=${record.status}, duration=${record.durationMs}ms${record.sessionCount ? ", sessions=" + record.sessionCount : ""}${record.error ? ", error=" + record.error.slice(0, 100) : ""}`);
		this.pendingLogs.push({
			timestamp: Date.now(),
			level: record.status === "failed" ? "error" : "info",
			message: `migration.${record.type}`,
			attributes: {
				event: "workbuddy.migration",
				migration_type: record.type,
				status: record.status,
				duration_ms: record.durationMs,
				is_incremental: String(record.isIncremental),
				...record.sessionCount !== void 0 ? { session_count: record.sessionCount } : {},
				...record.error ? { error_message: record.error.slice(0, 200) } : {}
			}
		});
	}
};
//#endregion
//#region src/main/features/monitor/collectors/safe-storage-probe-collector.ts
/**
* SafeStorageProbeCollector —— safeStorage 启动探针上报（伽利略）
*
* 接入方式与 `StartupPerfCollector` 一致：探针把结果 record 进来，本 collector 在
* `DesktopMonitorService.collectAndExportLogs()` 时交出去，无需触碰 exporter / OTLP 底层。
*
* 探针因此不需要感知伽利略是否就绪：录进来就算完成，exporter 没连上时这条记录
* 等下一次周期 collect 或 `stop()` 的收尾 flush，比原地丢弃更可靠。
*/
/** 每次启动至多一条；留 4 条余量纯粹是防御异常重复调用。 */
var MAX_PENDING_LOGS$1 = 4;
var SafeStorageProbeCollector = class extends AbstractCollector {
	pendingLogs = [];
	/** 立即 flush 回调（由 DesktopMonitorService 注入，可选） */
	onProbeRecorded;
	constructor() {
		super("SafeStorageProbeCollector", true);
	}
	async onStart() {}
	async onStop() {
		this.pendingLogs = [];
	}
	async onCollect() {
		return [];
	}
	async onCollectLogs() {
		const logs = [...this.pendingLogs];
		this.pendingLogs = [];
		return logs;
	}
	record(log) {
		if (this.pendingLogs.length >= MAX_PENDING_LOGS$1) return;
		this.pendingLogs.push(log);
		this.onProbeRecorded?.();
	}
};
//#endregion
//#region src/main/features/monitor/collectors/startup-perf-collector.ts
/**
* StartupPerfCollector — 启动性能上报（通道 A · 伽利略线上）
*
* 把启动性能 summary、原始 JSONL、per-mark 明细作为 `LogRecord`
* 推入伽利略上报管线。
*
* 接入方式与 `ChatPerformanceCollector` 完全一致：
*   pendingLogs(LogRecord[]) → onCollectLogs() → DesktopMonitorService
*   .collectAndExportLogs() → galileoExporter.exportLogs() / aegisExporter.exportLogs()
*
* 只要本 collector 被加进 `DesktopMonitorService.collectors[]`，就会被周期
* `collectAndExportLogs()` 自动收集并双通道上报，无需触碰 exporter / OTLP 底层。
*
* LogRecord → 伽利略平台映射：
*   - `message`        → 平台 message 列（这里固定 `startup.perf`）
*   - `attributes.*`   → 平台 `tags.*`（如 tags.startup_type / tags.total_ms / tags.phase_A_ms）
*/
var MAX_PENDING_LOGS = 100;
var MAX_STARTUP_JSONL_CHARS = 512 * 1024;
function buildTraceTags(traceId, _spanId) {
	return traceId ? { startup_trace_id: traceId } : {};
}
var StartupPerfCollector = class extends AbstractCollector {
	pendingLogs = [];
	/** 立即 flush 回调（由 DesktopMonitorService 注入，可选） */
	onStartupPerfRecorded;
	constructor() {
		super("StartupPerfCollector", true);
	}
	async onStart() {}
	async onStop() {
		this.pendingLogs = [];
	}
	async onCollect() {
		return [];
	}
	async onCollectLogs() {
		const logs = [...this.pendingLogs];
		this.pendingLogs = [];
		return logs;
	}
	/**
	* 记录一次启动性能 summary，等待下一次周期 collect 时上报伽利略。
	*
	* 由 desktop 侧 startup summary 计算接桥调用（与通道 B 的 `logStartupPerf` 共用同一份 summary）。
	*/
	recordStartupPerf(summary, traceId) {
		const spanId = traceId ? require_startup_perf_exporters.getStartupRootSpanId(traceId) : void 0;
		const attributes = {
			event: "workbuddy.startup.perf",
			...buildTraceTags(traceId, spanId),
			startup_type: summary.startupType,
			flow_type: summary.flowType,
			total_ms: summary.totalMs,
			...typeof summary.firstInteractiveMs === "number" ? { first_interactive_ms: summary.firstInteractiveMs } : {},
			total_marks: summary.totalMarks
		};
		for (const [phase, durationMs] of Object.entries(summary.phases)) attributes[`phase_${phase}_ms`] = durationMs;
		require_logger$2.mainLog.info(`[StartupPerfCollector] startup.perf: trace=${traceId ?? "-"} type=${summary.startupType} total=${summary.totalMs}ms firstInteractive=${summary.firstInteractiveMs ?? "-"}ms marks=${summary.totalMarks}`);
		if (this.pendingLogs.length < MAX_PENDING_LOGS) this.pendingLogs.push({
			timestamp: Date.now(),
			level: "info",
			message: "startup.perf",
			...traceId && spanId ? {
				traceId,
				spanId
			} : {},
			attributes
		});
		this.onStartupPerfRecorded?.();
	}
	/**
	* 记录原始 startup JSONL，供伽利略侧复制后直接丢进外部 startup-report.html 展示。
	*/
	recordStartupJsonl(jsonlText, summary, traceId) {
		if (this.pendingLogs.length >= MAX_PENDING_LOGS) return;
		const truncated = jsonlText.length > MAX_STARTUP_JSONL_CHARS;
		const jsonl = truncated ? jsonlText.slice(0, MAX_STARTUP_JSONL_CHARS) : jsonlText;
		const spanId = traceId ? require_startup_perf_exporters.getStartupRootSpanId(traceId) : void 0;
		this.pendingLogs.push({
			timestamp: Date.now(),
			level: "info",
			message: "startup.jsonl",
			...traceId && spanId ? {
				traceId,
				spanId
			} : {},
			attributes: {
				event: "workbuddy.startup.jsonl",
				...buildTraceTags(traceId, spanId),
				startup_type: summary.startupType,
				flow_type: summary.flowType,
				total_ms: summary.totalMs,
				...typeof summary.firstInteractiveMs === "number" ? { first_interactive_ms: summary.firstInteractiveMs } : {},
				total_marks: summary.totalMarks,
				jsonl_bytes: Buffer.byteLength(jsonlText, "utf-8"),
				jsonl_lines: jsonlText.split("\n").filter(Boolean).length,
				jsonl_truncated: truncated,
				jsonl
			}
		});
		this.onStartupPerfRecorded?.();
	}
	/**
	* 2.3-A · LogExporter：每条对齐后的 mark → 1 条 `startup.mark` LogRecord。
	*
	* 比 summary 行更细粒度，支持在伽利略按 `tags.mark_id` / `tags.phase` 下钻单点耗时。
	* 受 MAX_PENDING_LOGS 限额保护（超出丢弃，避免撑爆 buffer）；version/platform 等
	* 环境字段由 GalileoExporter.resource 注入，这里不重复带。
	*/
	recordStartupMarks(marks, summary, traceId) {
		const now = Date.now();
		const located = marks.filter((m) => typeof m.absEpoch === "number");
		const startAbsEpoch = located.length > 0 ? Math.min(...located.map((m) => m.absEpoch)) : void 0;
		const roundMs = (value) => Math.round(value * 100) / 100;
		for (const m of marks) {
			if (this.pendingLogs.length >= MAX_PENDING_LOGS) break;
			const offsetMs = typeof m.absEpoch === "number" && startAbsEpoch !== void 0 ? roundMs(m.absEpoch - startAbsEpoch) : void 0;
			const spanId = traceId ? require_startup_perf_exporters.getStartupMarkSpanId(traceId, m) : void 0;
			this.pendingLogs.push({
				timestamp: typeof m.absEpoch === "number" ? Math.round(m.absEpoch) : now,
				level: "info",
				message: "startup.mark",
				...traceId && spanId ? {
					traceId,
					spanId
				} : {},
				attributes: {
					...buildTraceTags(traceId, spanId),
					mark_id: m.id,
					mark_key: m.key,
					phase: m.phase,
					proc: m.proc,
					startup_type: summary.startupType,
					flow_type: summary.flowType,
					...offsetMs !== void 0 ? {
						abs_epoch: offsetMs,
						offset_ms: offsetMs
					} : {},
					...typeof m.absEpoch === "number" ? { absolute_epoch_ms: Math.round(m.absEpoch) } : {},
					...m.id === "E14" && offsetMs !== void 0 ? {
						first_interactive_ms: offsetMs,
						is_first_interactive: true
					} : {}
				}
			});
		}
		this.onStartupPerfRecorded?.();
	}
};
//#endregion
//#region src/main/features/monitor/aegis-config.ts
/** Aegis SDK 上报请求超时（毫秒）：默认 1s（默认 200ms 在弱网下经常误判） */
var AEGIS_REPORT_TIMEOUT_MS = 1e3;
//#endregion
//#region src/main/features/monitor/exporters/aegis-exporter.ts
function pickDefinedExt(ext) {
	if (!ext) return {};
	const out = {};
	for (const key of Object.keys(ext)) {
		const value = ext[key];
		if (value !== void 0) out[key] = value;
	}
	return out;
}
var AEGIS_EXT_MAX_LEN = 1024;
/**
* Sanity-log 前缀白名单：匹配的 metric name 会在 reportEvent / reportTime 成功后
* 打 info 日志（除失败 warn 之外）。
*
* 目的：为**低频高价值**上报提供"数据的确经过 SDK 送出"的证据链，供以下场景使用：
*   - 首次冷启动后到 `~/Library/Logs/CodeBuddy/main.log`（macOS）/ 对应 Windows
*     位置 grep `[AegisExporter] sent`，验证上报未被静默丢弃
*   - CI e2e（打包 app 冷启动）把日志作为 artifact 上传，反查伽利略捞不到数据时
*     的丢失点在客户端还是平台侧
*
* 不放全量白名单是因为热路径 metric（如 wb.api.duration 每次 HTTP 都上报）成功
* 日志会污染 main.log 日志量。仅低频事件值得打点。
*
* 新增前缀标准：调用频率 < 每分钟 5 次 + 单次上报有 sanity/审计价值。
*/
var AEGIS_SANITY_LOG_PREFIXES = [
	"startup.",
	"main_process_",
	"wb.desktop.crash.",
	"wb.startup."
];
function shouldSanityLog(name) {
	for (const prefix of AEGIS_SANITY_LOG_PREFIXES) if (name.startsWith(prefix)) return true;
	return false;
}
/**
* Pre-bootstrap buffer 容量上限。
*
* Aegis bootstrap() 在 monitorService.start() 中触发，而 start() 被推迟到
* daemon→main metric bridge 装配之后才调用（见 main-bootstrap.ts L692）。
* 中间窗口内（domain 注册的生命周期 metric / migration collector 等）
* 任何 reportEvent/reportTime/reportError/info 都会因 aegisInstance===null
* 而被静默丢弃。
*
* 这里把调用先暂存到内存 FIFO 队列，bootstrap 完成时 flush 一次：
*   - 200 条足够覆盖启动期所有业务 metric（实际观测 < 30 条）
*   - 超出 cap 时丢最旧（保留近期），避免泄漏内存
*   - 仅在 SDK 未就绪时累积；就绪后即直接 SDK 调用，不再入队
*/
var AEGIS_PENDING_BUFFER_CAP = 200;
function truncateJson(value, maxLen) {
	let json;
	try {
		json = JSON.stringify(value);
	} catch {
		return "";
	}
	if (!json) return "";
	return json.length <= maxLen ? json : `${json.slice(0, maxLen - 1)}…`;
}
var AegisExporter = class extends AbstractExporter {
	aegisInstance = null;
	bootstrapOptions;
	initPromise = null;
	/**
	* Renderer 推过来的 sessionId 暂存。
	*
	* 时序：renderer 的 Aegis 初始化结束后会把 sessionId IPC 给主进程，但此时主进程
	* Aegis 实例不一定就绪（initialize 异步、用户登录前可能未触发 bootstrap）。
	* 这里先暂存，onInitialize 完成后立即 apply 一次；后续如 renderer 重建 session
	* 再次 IPC 也会覆盖此字段并重新 apply。
	*/
	pendingRendererSessionId;
	/**
	* SDK 未就绪时的事件 FIFO 队列。bootstrap 完成时由 flushPendingCalls() 一次性 replay。
	* cap=AEGIS_PENDING_BUFFER_CAP，超出按先进先出丢弃最旧条目。
	*/
	pendingCalls = [];
	constructor() {
		super("AegisExporter", true);
	}
	/**
	* Aegis 通道初始化入口（与 base.initialize 不同，需传 options）。
	* - 重复调用幂等；并发调用合并到同一 promise
	* - 失败容忍：内部 try/catch，不抛错、不影响主进程启动
	*/
	async bootstrap(options) {
		if (this.connected) return;
		if (this.initPromise) return this.initPromise;
		if (options?.disabled) {
			require_logger$2.mainLog.info("[AegisExporter] disabled by options, skipping");
			return;
		}
		if (!electron.app.isReady()) {
			require_logger$2.mainLog.warn("[AegisExporter] app not ready yet, skipping initialize");
			return;
		}
		if (options) this.bootstrapOptions = options;
		this.initPromise = this.initialize().catch((error) => {
			require_logger$2.mainLog.warn("[AegisExporter] bootstrap failed (degraded to noop):", error);
		}).finally(() => {
			this.initPromise = null;
		});
		return this.initPromise;
	}
	async onInitialize() {
		const AegisCtor = await this.loadSdk();
		if (!AegisCtor) throw new Error("Aegis SDK not loaded");
		const options = this.bootstrapOptions;
		if (!options?.projectId || !options.reportUrl) throw new Error("Aegis projectId and reportUrl are required");
		const version = options.version ?? electron.app.getVersion();
		const environment = options.environment ?? (process.env.NODE_ENV === "development" ? "development" : "production");
		const processPerformanceEnabled = typeof options.processPerformanceIntervalMin === "number";
		const networkEnabled = typeof options.networkIntervalMin === "number";
		const processPerformanceIntervalMin = options.processPerformanceIntervalMin ?? 5;
		const networkIntervalMin = options.networkIntervalMin ?? 5;
		this.aegisInstance = new AegisCtor({
			id: options.projectId,
			version,
			uin: options.userId,
			uid: options.userId,
			hostUrl: options.reportUrl,
			compress: true,
			extField: {
				wb_process: "main",
				wb_version: version,
				appVersion: version,
				wb_env: environment,
				...options.patchName ? { wb_patch_name: options.patchName } : {}
			},
			env: environment,
			processPerformanceInterval: processPerformanceIntervalMin,
			networkInterval: networkIntervalMin,
			requestTimeout: AEGIS_REPORT_TIMEOUT_MS,
			plugin: {
				error: true,
				pv: true,
				processPerformance: processPerformanceEnabled,
				network: networkEnabled,
				crash: true,
				device: true,
				session: true
			}
		});
		require_logger$2.mainLog.info("[AegisExporter] initialized", {
			appId: options.projectId,
			version,
			environment,
			hasUid: !!options.userId
		});
		try {
			this.aegisInstance?.reportEvent({
				name: "main_process_start",
				ext1: version,
				ext2: environment
			});
		} catch (error) {
			require_logger$2.mainLog.warn("[AegisExporter] reportEvent main_process_start failed:", error);
		}
		if (this.pendingRendererSessionId) this.applySessionIdToInstance(this.pendingRendererSessionId);
		this.flushPendingCalls();
	}
	async onShutdown() {
		if (!this.aegisInstance) return;
		try {
			this.aegisInstance.destroy?.();
			require_logger$2.mainLog.info("[AegisExporter] destroyed");
		} catch (error) {
			require_logger$2.mainLog.warn("[AegisExporter] destroy failed:", error);
		} finally {
			this.aegisInstance = null;
		}
	}
	/**
	* AegisExporter 不消费 metrics 通道（SDK 已自动采集 Performance/Network/Crash/PV）。
	* 调用方应使用 reportEvent / reportTime / reportError 等事件式 API。
	*/
	async onExport(metrics) {
		if (metrics.length > 0) require_logger$2.mainLog.warn("[AegisExporter] metrics export not supported, use reportEvent/reportTime/reportError instead", { droppedCount: metrics.length });
	}
	/**
	* 把 renderer 端 Aegis 的 sessionId 同步到主进程 Aegis 实例。
	*
	* 让 main / renderer 两个 SDK 实例在同一次会话里上报相同的 session.id，
	* 便于在伽利略后台按 session 维度聚合"同一次启动"的全部上报。
	*
	* 幂等：同一 sessionId 多次 apply 不会副作用；不同 sessionId 会覆盖前值。
	* 注意：electron-sdk 的 session 插件 onNewAegis 内部会先写一次自己生成的 ID，
	* 所以本方法必须晚于 SDK 实例化才生效；未就绪时会暂存到 onInitialize 末尾再 apply。
	*/
	applyRendererSessionId(sessionId) {
		if (!sessionId) return;
		this.pendingRendererSessionId = sessionId;
		if (!this.aegisInstance) return;
		this.applySessionIdToInstance(sessionId);
	}
	applySessionIdToInstance(sessionId) {
		if (!this.aegisInstance) return;
		try {
			this.aegisInstance.updateSnapshootInfo?.({ session: { id: sessionId } });
			require_logger$2.mainLog.info("[AegisExporter] applyRendererSessionId", { sessionId });
		} catch (error) {
			require_logger$2.mainLog.warn("[AegisExporter] applyRendererSessionId failed:", error);
		}
	}
	setUserId(userId) {
		if (this.bootstrapOptions) this.bootstrapOptions = {
			...this.bootstrapOptions,
			userId
		};
		if (!this.aegisInstance) return;
		try {
			this.aegisInstance.setConfig?.({ uid: userId });
		} catch (error) {
			require_logger$2.mainLog.warn("[AegisExporter] setUserId failed:", error);
		}
	}
	reportEvent(name, ext) {
		if (!this.aegisInstance) {
			this.enqueuePending({
				kind: "event",
				name,
				ext
			});
			if (shouldSanityLog(name)) require_logger$2.mainLog.info(`[AegisExporter] queued event ${name} (pre-bootstrap, will flush after SDK ready)`);
			return;
		}
		try {
			this.aegisInstance.reportEvent({
				name,
				...pickDefinedExt(ext)
			});
			if (shouldSanityLog(name)) require_logger$2.mainLog.info(`[AegisExporter] sent event ${name}${ext ? " ext=" + JSON.stringify(pickDefinedExt(ext)) : ""}`);
		} catch (error) {
			require_logger$2.mainLog.warn(`[AegisExporter] reportEvent ${name} failed:`, error);
		}
	}
	reportTime(name, duration, ext) {
		if (!this.aegisInstance) {
			this.enqueuePending({
				kind: "time",
				name,
				duration,
				ext
			});
			if (shouldSanityLog(name)) require_logger$2.mainLog.info(`[AegisExporter] queued time ${name}=${duration}ms (pre-bootstrap, will flush after SDK ready)`);
			return;
		}
		try {
			this.aegisInstance.reportTime({
				name,
				duration,
				...pickDefinedExt(ext)
			});
			if (shouldSanityLog(name)) require_logger$2.mainLog.info(`[AegisExporter] sent time ${name}=${duration}ms${ext ? " ext=" + JSON.stringify(pickDefinedExt(ext)) : ""}`);
		} catch (error) {
			require_logger$2.mainLog.warn(`[AegisExporter] reportTime ${name} failed:`, error);
		}
	}
	reportError(err) {
		if (!this.aegisInstance) {
			this.enqueuePending({
				kind: "error",
				err
			});
			return;
		}
		try {
			this.aegisInstance.error(err);
		} catch (error) {
			require_logger$2.mainLog.warn("[AegisExporter] reportError failed:", error);
		}
	}
	info(msg) {
		if (!this.aegisInstance) {
			this.enqueuePending({
				kind: "info",
				msg
			});
			return;
		}
		try {
			this.aegisInstance.info(msg);
		} catch (error) {
			require_logger$2.mainLog.warn("[AegisExporter] info failed:", error);
		}
	}
	/**
	* 把调用塞进 pre-bootstrap 队列（FIFO，超 cap 丢最旧）。
	*
	* 不在这里检查 disabled / aegisEnabled：bootstrap 中如果走 disabled 分支
	* 不会 flushPendingCalls，队列里的条目随 GC 释放即可。
	*/
	enqueuePending(call) {
		if (this.pendingCalls.length >= AEGIS_PENDING_BUFFER_CAP) this.pendingCalls.shift();
		this.pendingCalls.push(call);
	}
	/**
	* SDK 就绪后回放 pre-bootstrap 队列。
	*
	* 注意：必须在 aegisInstance 赋值之后调用，否则 reportEvent/reportTime
	* 内部会因 aegisInstance===null 再次入队，形成无限循环。
	*/
	flushPendingCalls() {
		if (this.pendingCalls.length === 0 || !this.aegisInstance) return;
		const drained = this.pendingCalls.splice(0, this.pendingCalls.length);
		const sanityCount = drained.reduce((n, c) => (c.kind === "event" || c.kind === "time") && shouldSanityLog(c.name) ? n + 1 : n, 0);
		require_logger$2.mainLog.info(`[AegisExporter] flushing ${drained.length} pre-bootstrap calls${sanityCount > 0 ? ` (sanity=${sanityCount})` : ""}`);
		for (const call of drained) try {
			switch (call.kind) {
				case "event":
					this.aegisInstance.reportEvent({
						name: call.name,
						...pickDefinedExt(call.ext)
					});
					if (shouldSanityLog(call.name)) require_logger$2.mainLog.info(`[AegisExporter] sent event ${call.name} (flushed)`);
					break;
				case "time":
					this.aegisInstance.reportTime({
						name: call.name,
						duration: call.duration,
						...pickDefinedExt(call.ext)
					});
					if (shouldSanityLog(call.name)) require_logger$2.mainLog.info(`[AegisExporter] sent time ${call.name}=${call.duration}ms (flushed)`);
					break;
				case "error":
					this.aegisInstance.error(call.err);
					break;
				case "info":
					this.aegisInstance.info(call.msg);
					break;
			}
		} catch (error) {
			require_logger$2.mainLog.warn(`[AegisExporter] flushPendingCalls ${call.kind} failed:`, error);
		}
	}
	/** 供单测验证 buffer 状态（不要在业务代码中使用）。 */
	getPendingCallsCountForTest() {
		return this.pendingCalls.length;
	}
	/** OTel LogRecord[] 翻译为 Aegis 事件并发送，与 GalileoExporter 双发。 */
	async exportLogs(records) {
		if (!this.aegisInstance || records.length === 0) return;
		for (const record of records) try {
			this.dispatchLogRecord(record);
		} catch (error) {
			require_logger$2.mainLog.warn(`[AegisExporter] exportLogs item ${record.message} failed:`, error);
		}
	}
	dispatchLogRecord(record) {
		if (!this.aegisInstance) return;
		const attrs = record.attributes ?? {};
		const level = (record.level || "").toLowerCase();
		if (level === "error" || level === "fatal") {
			const payload = `${record.message} ${truncateJson(attrs, AEGIS_EXT_MAX_LEN)}`;
			this.aegisInstance.error(payload);
			return;
		}
		const traceFields = record.traceId && record.spanId ? {
			traceID: record.traceId,
			spanID: record.spanId,
			traceId: record.traceId,
			spanId: record.spanId,
			trace_id: record.traceId,
			span_id: record.spanId
		} : {};
		this.aegisInstance.reportEvent({
			name: record.message,
			ext1: String(attrs.status ?? attrs.event ?? ""),
			ext2: String(attrs.migration_type ?? attrs.type ?? ""),
			ext3: truncateJson(attrs, AEGIS_EXT_MAX_LEN),
			...traceFields,
			...attrs
		});
	}
	async loadSdk() {
		try {
			const sdkModule = await import("@tencent/aegis-electron-sdk-v2");
			const AegisCtor = sdkModule.default ?? sdkModule;
			if (typeof AegisCtor !== "function") {
				require_logger$2.mainLog.warn("[AegisExporter] unexpected SDK shape", { keys: Object.keys(sdkModule) });
				return null;
			}
			return AegisCtor;
		} catch (error) {
			require_logger$2.mainLog.error("[AegisExporter] load SDK failed:", error);
			return null;
		}
	}
};
//#endregion
//#region src/main/features/monitor/desktop-monitor-service.ts
/**
* 给 GalileoExporter 注入自定义 HTTPClient：通过 installUndiciProxyDispatcher() 走全局代理，
* 并打 [NetLog] 日志便于排查上报问题。
*/
function createDesktopGalileoHttpClient() {
	return { async post(url, data, config) {
		const controller = new AbortController();
		const timeout = config?.timeout || 3e4;
		const timeoutId = setTimeout(() => controller.abort(), timeout);
		const startedAt = Date.now();
		const proxyDesc = require_proxy_agents.describeProxyForLog(url);
		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...config?.headers || {}
				},
				body: JSON.stringify(data),
				signal: controller.signal
			});
			const responseData = await response.json().catch(() => ({}));
			require_proxy_agents.logNetRequest({
				method: "POST",
				url,
				proxy: proxyDesc,
				status: response.status,
				durationMs: Date.now() - startedAt,
				source: "GalileoExporter"
			});
			return {
				status: response.status,
				statusText: response.statusText,
				data: responseData
			};
		} catch (error) {
			const normalized = (error instanceof Error ? error.name : void 0) === "AbortError" ? /* @__PURE__ */ new Error(`Request timeout after ${timeout}ms`) : error;
			require_proxy_agents.logNetRequest({
				method: "POST",
				url,
				proxy: proxyDesc,
				durationMs: Date.now() - startedAt,
				error: normalized,
				source: "GalileoExporter"
			});
			throw normalized;
		} finally {
			clearTimeout(timeoutId);
		}
	} };
}
function isStartupTelemetryLog(_log) {
	return false;
}
var sharedInstance;
var DesktopMonitorService = class {
	galileoExporter;
	aegisExporter = new AegisExporter();
	galileoConfig = { enabled: false };
	resolvedGalileo = require_common$1.resolveGalileoConfig(void 0, { platform: "ElectronApp" });
	reconfigureQueue = Promise.resolve();
	requestedGeneration = 0;
	getUserId;
	appVersion;
	migrationCollector;
	cliHealthCollector;
	chatPerfCollector;
	historyLoadCollector;
	startupPerfCollector;
	safeStorageProbeCollector;
	collectors;
	/** loadSession 到达主进程的时间戳暂存。key 优先用 renderer 的 requestId，兼容旧调用退回 sessionId。 */
	mainLoadTimestamps = /* @__PURE__ */ new Map();
	enabled;
	aegisEnabled = false;
	patchName;
	collectTimer;
	started = false;
	collectInterval;
	processPerformanceIntervalMin;
	networkIntervalMin;
	constructor(config) {
		this.enabled = config?.enabled ?? true;
		this.collectInterval = config?.collectInterval ?? 6e4;
		this.getUserId = config?.getUserId;
		this.appVersion = config?.appVersion ?? electron.app.getVersion();
		this.applyGalileoConfig(config?.galileo ?? {
			enable: config?.enabled,
			endpoint: config?.galileoEndpoint,
			app: config?.app,
			server: config?.server,
			patchName: config?.patchName,
			processPerformanceIntervalMin: config?.processPerformanceIntervalMin,
			networkIntervalMin: config?.networkIntervalMin
		});
		this.migrationCollector = new MigrationCollector();
		this.cliHealthCollector = new CliHealthCollector();
		this.chatPerfCollector = new ChatPerformanceCollector();
		this.historyLoadCollector = new HistoryLoadCollector();
		this.startupPerfCollector = new StartupPerfCollector();
		this.safeStorageProbeCollector = new SafeStorageProbeCollector();
		this.chatPerfCollector.onMessageDisplayRecorded = () => {
			this.flushNow().catch((err) => {
				require_logger$2.mainLog.warn("[DesktopMonitor] flushNow on display recorded failed:", err);
			});
		};
		this.startupPerfCollector.onStartupPerfRecorded = () => {
			this.flushNow().catch((err) => {
				require_logger$2.mainLog.warn("[DesktopMonitor] flushNow on startup perf recorded failed:", err);
			});
		};
		this.safeStorageProbeCollector.onProbeRecorded = () => {
			if (!this.aegisEnabled) {
				require_logger$2.mainLog.info("[SafeStorageProbe] channel not ready, deferring to periodic collect");
				return;
			}
			this.flushNow().catch((err) => {
				require_logger$2.mainLog.warn("[DesktopMonitor] flushNow on safe storage probe recorded failed:", err);
			});
		};
		this.collectors = [
			this.migrationCollector,
			this.cliHealthCollector,
			this.chatPerfCollector,
			this.historyLoadCollector,
			this.startupPerfCollector,
			this.safeStorageProbeCollector
		];
	}
	reconfigureGalileo(config) {
		const next = require_common$1.resolveGalileoConfig(config, { platform: "ElectronApp" });
		const generation = ++this.requestedGeneration;
		this.reconfigureQueue = this.reconfigureQueue.then(async () => {
			if (generation !== this.requestedGeneration) return;
			if (next.fingerprint === this.resolvedGalileo.fingerprint) return;
			if (this.started) {
				this.aegisEnabled = false;
				await this.collectAndExportLogs().catch(() => void 0);
				await this.shutdownGalileoExporters();
			}
			if (generation !== this.requestedGeneration) return;
			this.applyGalileoConfig(config);
			if (this.started) await this.startGalileoExporters();
		});
		return this.reconfigureQueue;
	}
	applyGalileoConfig(config) {
		this.resolvedGalileo = require_common$1.resolveGalileoConfig(config, { platform: "ElectronApp" });
		this.patchName = config?.patchName;
		this.processPerformanceIntervalMin = config?.processPerformanceIntervalMin;
		this.networkIntervalMin = config?.networkIntervalMin;
		this.aegisEnabled = this.resolvedGalileo.canExportAegis;
		if (!this.resolvedGalileo.canExportOtlp) {
			this.galileoExporter = void 0;
			this.galileoConfig = {
				enabled: false,
				userId: this.getUserId?.()
			};
			if (this.resolvedGalileo.enabled) require_logger$2.mainLog.warn(`[DesktopMonitor] Invalid Galileo config: ${this.resolvedGalileo.issues.join(",")}`);
			return;
		}
		this.galileoConfig = {
			enabled: true,
			endpoint: this.resolvedGalileo.endpoint,
			batchSize: 50,
			flushInterval: 3e4,
			timeout: 1e4,
			userId: this.getUserId?.(),
			useOtelJsonLogFields: true,
			resource: {
				target: this.resolvedGalileo.target,
				envName: electron.app.isPackaged ? "formal" : "test",
				namespace: process.env.NODE_ENV === "development" ? "Development" : "Production",
				instance: `desktop-${Date.now()}`,
				version: this.appVersion,
				ideType: "workbuddy-desktop",
				ideVersion: this.appVersion,
				os: `${process.platform}-${process.arch}`,
				ext1: "desktop"
			}
		};
		this.galileoExporter = new GalileoExporter(this.galileoConfig, void 0, createDesktopGalileoHttpClient());
	}
	async startGalileoExporters() {
		if (this.aegisEnabled) await this.aegisExporter.bootstrap({
			projectId: this.resolvedGalileo.projectId,
			reportUrl: this.resolvedGalileo.collectUrl,
			version: this.appVersion,
			userId: this.getUserId?.(),
			patchName: this.patchName,
			processPerformanceIntervalMin: this.processPerformanceIntervalMin,
			networkIntervalMin: this.networkIntervalMin
		});
		await this.galileoExporter?.initialize();
	}
	async shutdownGalileoExporters() {
		const galileoExporter = this.galileoExporter;
		const aegisExporter = this.aegisExporter;
		this.galileoExporter = void 0;
		this.aegisExporter = new AegisExporter();
		await Promise.allSettled([galileoExporter?.shutdown(), aegisExporter.shutdown()]);
	}
	async start() {
		if (this.started || !this.enabled) return;
		this.startGalileoExporters().catch((error) => {
			require_logger$2.mainLog.error("[DesktopMonitor] Exporter init failed (non-fatal):", error instanceof Error ? error.message : String(error));
		});
		for (const collector of this.collectors) try {
			await collector.start();
		} catch (error) {
			require_logger$2.mainLog.error(`[DesktopMonitor] Collector ${collector.name} start failed:`, error instanceof Error ? error.message : String(error));
		}
		this.collectTimer = setInterval(() => {
			this.collectAndExportLogs().catch((err) => {
				require_logger$2.mainLog.error("[DesktopMonitor] Collect/export error:", err instanceof Error ? err.message : String(err));
			});
		}, this.collectInterval);
		this.started = true;
		require_logger$2.mainLog.info("[DesktopMonitor] Started");
		cleanStalePendingTelemetry();
	}
	async stop() {
		if (!this.started) return;
		if (this.collectTimer) {
			clearInterval(this.collectTimer);
			this.collectTimer = void 0;
		}
		try {
			await this.collectAndExportLogs();
			for (const collector of this.collectors) await collector.stop();
		} catch (error) {
			require_logger$2.mainLog.error("[DesktopMonitor] Error during stop:", error instanceof Error ? error.message : String(error));
		}
		await this.shutdownGalileoExporters();
		this.started = false;
		require_logger$2.mainLog.info("[DesktopMonitor] Stopped");
	}
	getMigrationCollector() {
		return this.migrationCollector;
	}
	getCliHealthCollector() {
		return this.cliHealthCollector;
	}
	getChatPerfCollector() {
		return this.chatPerfCollector;
	}
	getHistoryLoadCollector() {
		return this.historyLoadCollector;
	}
	getStartupPerfCollector() {
		return this.startupPerfCollector;
	}
	/** 上报 crash 日志到伽利略（供 CrashLogExporter transport 桥接） */
	async exportCrashLogs(logs) {
		if (this.galileoExporter && typeof this.galileoExporter.exportLogs === "function") await this.galileoExporter.exportLogs(logs);
	}
	/**
	* 轻量即时上报一条业务 OTel 日志到伽利略（POST /v1/logs，即时 http 推送）。
	*
	* 与 exportCrashLogs 底层同为 galileoExporter.exportLogs，但语义明确：用于「非
	* 崩溃的业务事件即时上报」（如 daemon give-up）。单列此方法是为了避免 exportCrashLogs
	* 的历史命名（Crash，原为 CrashLogExporter transport 桥接）误导调用方以为在做原生
	* 崩溃上报。上报失败不抛出，避免干扰业务主流程。
	*/
	async reportOtelLog(record) {
		if (this.galileoExporter && typeof this.galileoExporter.exportLogs === "function") await this.galileoExporter.exportLogs([record]);
	}
	/** galileo exporter 是否已连接就绪，供 repair flush 等需要感知 ready 状态的调用方使用 */
	isGalileoConnected() {
		return !!this.galileoExporter?.isConnected();
	}
	/**
	* 上报 trace spans 到伽利略（POST /v1/traces）。
	* 复用 GalileoExporter 通道，避免在 main 进程另接 galileo-node-sdk。
	*/
	async exportTraces(spans) {
		if (this.galileoExporter && typeof this.galileoExporter.exportTraces === "function") await this.galileoExporter.exportTraces(spans);
	}
	/** 当前伽利略上报 target（= galileoConfig.resource.target），供手动打 span 时填充 attribute */
	getGalileoTarget() {
		return this.resolvedGalileo.target ?? "";
	}
	/** 当前 WorkBuddy 版本，供启动测速等上报维度使用。 */
	getAppVersion() {
		return this.appVersion;
	}
	/** 把 wb.metrics.record 的数值指标交给现有 GalileoExporter 批量队列。 */
	async recordMetric(metric) {
		if (!this.enabled || !this.galileoExporter) return;
		const item = {
			name: metric.name,
			value: metric.value,
			type: metric.kind === "counter" ? MetricType.Counter : MetricType.Histogram,
			timestamp: Date.now(),
			labels: { ...metric.labels },
			metadata: {
				source: "wb.metrics",
				collector: "wb.metrics",
				version: "1"
			}
		};
		await this.galileoExporter.export([item]);
	}
	/** 记录时延样本（duration ms）。维度 value 必须 string，调用方自行 String() 转换。 */
	recordDuration(metric, durationMs, dimensions) {
		if (!this.enabled || !this.aegisEnabled) return;
		this.aegisExporter.reportTime(metric, durationMs, this.normalizeDimensions(dimensions));
	}
	/** Counter 增量上报。count <= 0 直接忽略（OTel 规范：Counter 必须单调递增）。 */
	addCounter(metric, count, dimensions) {
		if (!this.enabled || !this.aegisEnabled || count <= 0) return;
		this.aegisExporter.reportEvent(metric, {
			...this.normalizeDimensions(dimensions),
			count
		});
	}
	/** 维度归一化：number/boolean/null/undefined → string 或丢空，避免 SDK 序列化静默丢字段。 */
	normalizeDimensions(dimensions) {
		const out = {};
		if (dimensions) for (const [k, v] of Object.entries(dimensions)) {
			if (v == null) continue;
			out[k] = typeof v === "string" ? v : String(v);
		}
		return out;
	}
	recordMainLoadTime(key) {
		this.mainLoadTimestamps.set(key, Date.now());
	}
	getAndClearMainLoadTime(key) {
		const t = this.mainLoadTimestamps.get(key);
		if (t) this.mainLoadTimestamps.delete(key);
		return t;
	}
	/**
	* 记录一条 safeStorage 启动探针结果，等待 collect 周期（或本次 flushNow）上报。
	* 与 reportOtelLog 的区别：调用方无需关心伽利略是否已就绪，未就绪时记录留在队列里。
	*/
	recordSafeStorageProbe(record) {
		this.safeStorageProbeCollector.record(record);
	}
	/** 立即采集并导出（用于 crash 等紧急场景，避免日志丢失） */
	async flushNow() {
		if (!this.started) return;
		await this.collectAndExportLogs();
	}
	async collectAndExportLogs() {
		if (this.getUserId) {
			const uid = this.getUserId();
			if (uid) {
				this.galileoConfig.userId = uid;
				this.aegisExporter.setUserId(uid);
			}
		}
		const allLogs = [];
		for (const collector of this.collectors) {
			if (!collector.isRunning()) continue;
			try {
				const logs = await collector.collectLogs();
				allLogs.push(...logs);
			} catch (error) {
				require_logger$2.mainLog.error(`[DesktopMonitor] Collector ${collector.name} log collection error:`, error instanceof Error ? error.message : String(error));
			}
		}
		if (allLogs.length > 0) {
			if (this.patchName) for (const log of allLogs) {
				if (!log.attributes) log.attributes = {};
				log.attributes.patchName = this.patchName;
			}
			const aegisLogs = allLogs.filter((log) => !isStartupTelemetryLog(log));
			const [galileoResult, aegisResult] = await Promise.allSettled([this.galileoExporter?.exportLogs(allLogs) ?? Promise.resolve(), this.aegisEnabled && aegisLogs.length > 0 ? this.aegisExporter.exportLogs(aegisLogs) : Promise.resolve()]);
			if (galileoResult.status === "fulfilled") require_logger$2.mainLog.info(`[DesktopMonitor] Exported ${allLogs.length} logs to Galileo`);
			else {
				const err = galileoResult.reason;
				require_logger$2.mainLog.error(`[DesktopMonitor] Galileo export failed (${allLogs.length} logs):`, err instanceof Error ? err.message : String(err));
			}
			if (aegisResult.status === "rejected") {
				const err = aegisResult.reason;
				require_logger$2.mainLog.warn(`[DesktopMonitor] Aegis export failed (${allLogs.length} logs):`, err instanceof Error ? err.message : String(err));
			}
		}
	}
	static setSharedInstance(instance) {
		sharedInstance = instance;
	}
	static getSharedInstance() {
		return sharedInstance;
	}
	/**
	* 同步用户 ID 到两条上报通道。
	* collectAndExportLogs() 每次会用 getUserId() 重新覆盖 galileoConfig.userId，
	* 所以这里主要服务于"未配置 getUserId、但手动调用 setUserId"的场景。
	*/
	setUserId(userId) {
		if (this.aegisEnabled) this.aegisExporter.setUserId(userId);
		this.galileoConfig.userId = userId;
	}
	reportAegisEvent(name, ext) {
		if (this.aegisEnabled) this.aegisExporter.reportEvent(name, ext);
	}
	reportAegisTime(name, durationMs, ext) {
		if (this.aegisEnabled) this.aegisExporter.reportTime(name, durationMs, ext);
	}
	reportAegisError(err) {
		if (this.aegisEnabled) this.aegisExporter.reportError(err);
	}
	isAegisInitialized() {
		return this.aegisExporter.isConnected();
	}
	/**
	* 把 renderer 端 Aegis 的 sessionId 同步给主进程 Aegis 实例，
	* 让两端在同一个 Galileo session 维度聚合（IPC: monitor:syncRendererSessionId）。
	*/
	applyRendererSessionId(sessionId) {
		if (!this.enabled || !this.aegisEnabled) return;
		this.aegisExporter.applyRendererSessionId(sessionId);
	}
};
//#endregion
Object.defineProperty(exports, "DesktopMonitorService", {
	enumerable: true,
	get: function() {
		return DesktopMonitorService;
	}
});
