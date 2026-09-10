const require_common = require("./common.js");
const require_desktop_monitor_service = require("./desktop-monitor-service.js");
//#region src/main/features/telemetry/threat-database-galileo.ts
require_common.init_common$2();
var THREAT_DATABASE_GALILEO_EVENTS = new Set([require_common.SANDBOX_THREAT_DATABASE_UPDATE_CHECK_EVENT, require_common.SANDBOX_THREAT_DATABASE_STARTUP_AVAILABILITY_EVENT]);
/** daemon 侧威胁库事件需要改走伽利略 OTel logs，不能落默认的 aegis 自定义事件通道。 */
function isThreatDatabaseGalileoEvent(name) {
	return THREAT_DATABASE_GALILEO_EVENTS.has(name);
}
/**
* 把 daemon 的威胁库事件写进伽利略 OTel logs 通道。
*
* daemon 子进程拿不到 monitor 单例，事件经 monitor bridge 回传 main（同 startup.perf 的
* 处理方式）。这里必须转 reportOtelLog 而不是走默认的 reportAegisEvent：aegis 自定义事件
* 投的是 `/collect`，与 agent-cli 那些 `sandbox.*` 事件（GalileoExporter → `/v1/logs`）不
* 在同一个存储，落到那边就进不了 `{tags.module="sandbox"}` 的统一聚合口径。
*
* 事件名即 log message，ext 原样作为 attributes（`module=sandbox` 由 daemon 侧带上），
* 日志级别按 `status` 取——与 agent-cli `SandboxTelemetryReporter._emit` 的契约一致，
* failed / timeout 进 logError 告警通道。因此本函数不需要任何威胁库领域知识。
*/
function reportThreatDatabaseGalileoEvent(name, ext) {
	const attributes = { ...ext };
	const timestamp = Date.now();
	try {
		const monitor = require_desktop_monitor_service.DesktopMonitorService.getSharedInstance();
		if (!monitor) return;
		const record = {
			timestamp,
			level: attributes.status === "failed" || attributes.status === "timeout" ? "error" : "info",
			message: name,
			attributes
		};
		monitor.reportOtelLog(record).catch(() => {});
	} catch {}
}
//#endregion
Object.defineProperty(exports, "isThreatDatabaseGalileoEvent", {
	enumerable: true,
	get: function() {
		return isThreatDatabaseGalileoEvent;
	}
});
Object.defineProperty(exports, "reportThreatDatabaseGalileoEvent", {
	enumerable: true,
	get: function() {
		return reportThreatDatabaseGalileoEvent;
	}
});
