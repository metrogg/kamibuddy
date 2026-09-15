/**
 * 开发期性能采集浮层（spec：optimize-stream-rendering Task 1）。
 *
 * 为什么需要它：本期（流式 delta 合批 / 折叠态跳过渲染 / 热点 memo）全是"让渲染变便宜"的
 * 改动，"变便宜了多少"必须能被同一把尺子前后量出来，否则只能靠主观感觉——
 * 主观感觉既无法验收也无法回归。FPS + longtask 是这把尺子的两个刻度：
 * 前者看持续帧率（卡不卡），后者抓主线程被单次任务占住超过 50ms 的现场（谁卡的）。
 *
 * 为什么默认不执行：采集本身有成本（常驻 rAF 循环 + PerformanceObserver），且右下角浮层不是
 * 产品 UI——它是**主动取证**时才用的量尺（改渲染性能时量一次），常驻只会遮挡界面、打扰正常开发，
 * 因此只在显式开启（`localStorage.kbPerf === "1"`）时执行，DEV 下也不再自动开。
 * 启用开关与动态 `import()` 都由 main.tsx 掌握。
 * 但本模块**仍会**作为独立 chunk 进生产包（rollup 判定不了运行时 localStorage 分支），
 * 只是默认不执行——生产要留 `kbPerf=1` 强开取证的入口，细节见 main.tsx 的守卫注释。
 *
 * 阈值与窗口的出处：50ms 是 longtask 的规范定义（超过一帧的 16.7ms 太多噪声，
 * 50ms 起才明显影响交互响应）；55 FPS 是本项目的告警线（60 上下波动属正常，
 * 持续低于 55 才说明已经掉帧）。
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

/** 低于此帧率告警（见文件头阈值出处）。 */
const LOW_FPS = 55;
/** longtask 的规范定义：主线程单次任务超过 50ms。 */
const LONG_TASK_MS = 50;
/** FPS 采样窗口：一秒一档，够快能看出瞬时卡顿，又不会让表格数字乱跳。 */
const SAMPLE_MS = 1000;
/** 窗口被切走后 rAF 会暂停，回到前台时 elapsed 是"挂起时长"而不是掉帧，超过此值就丢弃该档。 */
const STALE_MS = 2000;
/** longtask 滚动统计窗口：10 秒内的条数与最长时长，一次卡顿能被看见足够久。 */
const WINDOW_MS = 10_000;

interface LongTask {
	readonly duration: number;
	readonly name: string;
	readonly startTime: number;
}

export interface PerfSnapshot {
	/** 最近一个采样窗口的帧率。 */
	readonly fps: number;
	readonly recentLongTasks: number;
	readonly longestMs: number;
}

const EMPTY_SNAPSHOT: PerfSnapshot = { fps: 0, recentLongTasks: 0, longestMs: 0 };

/**
 * 订阅 longtask。不支持（`supportedEntryTypes` 里没有它）就静默跳过——
 * 这是环境能力差异，不是需要响亮失败的编程错误。
 */
function observeLongTasks(onLongTask: (task: LongTask) => void): PerformanceObserver | undefined {
	if (typeof PerformanceObserver === "undefined") return undefined;
	const supported: readonly string[] | undefined = PerformanceObserver.supportedEntryTypes;
	if (supported === undefined || !supported.includes("longtask")) return undefined;

	const observer = new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) {
			if (entry.duration <= LONG_TASK_MS) continue;
			onLongTask({ duration: entry.duration, name: entry.name, startTime: entry.startTime });
		}
	});
	try {
		observer.observe({ entryTypes: ["longtask"] });
	} catch (error) {
		// 有 supportedEntryTypes 却 observe 失败（策略禁用等）——同样属于环境能力差异，静默跳过。
		console.warn("[perf] longtask 采集不可用：", error);
		return undefined;
	}
	return observer;
}

/** 汇总一档采样：顺手把滑出窗口的 longtask 丢掉（保持数组只装最近 10s，条数即显示值）。 */
function takeSnapshot(fps: number, longTasks: LongTask[], now: number): PerfSnapshot {
	while (longTasks.length > 0 && now - longTasks[0]!.startTime > WINDOW_MS) longTasks.shift();

	let longestMs = 0;
	for (const task of longTasks) longestMs = Math.max(longestMs, task.duration);
	longestMs = Math.round(longestMs);

	if (fps < LOW_FPS) {
		// 告警要带上同一窗口的 longtask 明细——只看一个低 FPS 数字无法定位元凶。
		console.warn(
			`[perf] FPS ${fps}（低于 ${LOW_FPS}）｜最近 ${WINDOW_MS / 1000}s longtask ${longTasks.length} 条，最长 ${longestMs}ms`,
			longTasks,
		);
	}
	return { fps, recentLongTasks: longTasks.length, longestMs };
}

/**
 * 启动采集，返回幂等的停止函数（组件卸载与页面卸载走同一条回收路径）。
 *
 * FPS 用 rAF 循环数帧：rAF 本来就只在"要绘帧"时回调，它的调用频率就是实际渲染帧率，
 * 比 setInterval + 采样更贴近用户观感（掉帧时 rAF 自己就变慢）。
 */
function startPerfMonitor(onSample: (snapshot: PerfSnapshot) => void): () => void {
	let disposed = false;
	let frames = 0;
	let windowStart = performance.now();
	let rafId = 0;
	const longTasks: LongTask[] = [];

	const observer = observeLongTasks((task) => {
		longTasks.push(task);
		// 明细进控制台（浮层只放聚合值）：定位到具体是哪一段代码卡住，全靠 duration / name / startTime。
		console.warn(
			`[perf] longtask ${Math.round(task.duration)}ms（startTime ${Math.round(task.startTime)}ms）`,
			task.name,
		);
	});

	const tick = (now: number): void => {
		if (disposed) return;
		frames += 1;
		const elapsed = now - windowStart;
		if (elapsed >= SAMPLE_MS) {
			if (elapsed < STALE_MS) onSample(takeSnapshot(Math.round((frames * 1000) / elapsed), longTasks, now));
			frames = 0;
			windowStart = now;
		}
		rafId = requestAnimationFrame(tick);
	};
	rafId = requestAnimationFrame(tick);

	return () => {
		if (disposed) return;
		disposed = true;
		cancelAnimationFrame(rafId);
		observer?.disconnect();
	};
}

const CARD_STYLE: CSSProperties = {
	position: "fixed",
	right: "var(--space-5)",
	bottom: "var(--space-5)",
	zIndex: "var(--z-toast)",
	// 采集浮层不许抢业务界面的点击（右下角可能是输入区/按钮），因此只读不可交互。
	pointerEvents: "none",
	display: "grid",
	gap: "var(--space-1)",
	padding: "var(--space-3) var(--space-4)",
	background: "var(--bg)",
	border: "1px solid var(--border)",
	borderRadius: "var(--radius-md)",
	boxShadow: "var(--shadow-md)",
	fontFamily: "var(--font-mono)",
	fontSize: "var(--text-meta)",
	color: "var(--text-secondary)",
	whiteSpace: "nowrap",
};

const ROW_STYLE: CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	gap: "var(--space-4)",
};

const VALUE_STYLE: CSSProperties = {
	color: "var(--text)",
	fontVariantNumeric: "tabular-nums",
};

function PerfOverlay(): ReactNode {
	const [snapshot, setSnapshot] = useState<PerfSnapshot>(EMPTY_SNAPSHOT);

	useEffect(() => {
		const stop = startPerfMonitor(setSnapshot);
		window.addEventListener("pagehide", stop);
		return () => {
			window.removeEventListener("pagehide", stop);
			stop();
		};
	}, []);

	// fps 为 0 是"还没跑满一档"，不是掉帧，不标红。
	const lowFps = snapshot.fps > 0 && snapshot.fps < LOW_FPS;

	return (
		<div style={CARD_STYLE}>
			<div style={ROW_STYLE}>
				<span>FPS</span>
				<span style={{ ...VALUE_STYLE, color: lowFps ? "var(--danger)" : "var(--text)" }}>{snapshot.fps}</span>
			</div>
			<div style={ROW_STYLE}>
				<span>longtask {WINDOW_MS / 1000}s</span>
				<span style={VALUE_STYLE}>{snapshot.recentLongTasks}</span>
			</div>
			<div style={ROW_STYLE}>
				<span>最长</span>
				<span style={VALUE_STYLE}>{`${snapshot.longestMs}ms`}</span>
			</div>
		</div>
	);
}

/**
 * 挂载浮层。用独立的 React root 而不是塞进 App 树：
 * 浮层与业务渲染互不干扰（App 每轮重渲染都不该带上它），也不必去动 App.tsx。
 */
export function mountPerfOverlay(): void {
	const container = document.createElement("div");
	document.body.append(container);
	createRoot(container).render(<PerfOverlay />);
}
