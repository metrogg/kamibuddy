//#region src/main/system/logging/process-cpu-sampler.ts
/**
* 返回当前进程自上次采样以来的 CPU 百分比。
*
* process.cpuUsage() 是累计微秒值；用单调时钟的墙钟增量归一化后，
* 结果与 Electron ProcessMetric.cpu.percentCPUUsage 使用同一百分比口径。
*/
function createProcessCpuPercentSampler(options = {}) {
	const readUsage = options.readUsage ?? (() => process.cpuUsage());
	const nowNs = options.nowNs ?? (() => process.hrtime.bigint());
	let previousUsage = readUsage();
	let previousTimeNs = nowNs();
	return () => {
		const currentUsage = readUsage();
		const currentTimeNs = nowNs();
		const elapsedMicros = Number(currentTimeNs - previousTimeNs) / 1e3;
		const usedMicros = Math.max(0, currentUsage.user - previousUsage.user + currentUsage.system - previousUsage.system);
		previousUsage = currentUsage;
		previousTimeNs = currentTimeNs;
		return elapsedMicros > 0 ? usedMicros / elapsedMicros * 100 : 0;
	};
}
//#endregion
Object.defineProperty(exports, "createProcessCpuPercentSampler", {
	enumerable: true,
	get: function() {
		return createProcessCpuPercentSampler;
	}
});
