import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./index.css";

/**
 * 根部错误边界：渲染异常时显示错误卡 + 「重新加载」按钮，而不是裸白屏。
 *
 * 白屏无反馈本身也是体验缺陷——reducer 契约错位/状态毒化导致的整树卸载
 * 已发生两次（多会话信封未拆的事故链），ErrorBoundary 是最后一道防线。
 */
class ErrorBoundary extends Component<
	{ readonly children: ReactNode },
	{ readonly error: Error | undefined; readonly componentStack: string | undefined }
> {
	override state: { error: Error | undefined; componentStack: string | undefined } = {
		error: undefined,
		componentStack: undefined,
	};

	static getDerivedStateFromError(error: Error): { error: Error } {
		return { error };
	}

	override componentDidCatch(error: Error, info: { componentStack?: string }): void {
		// 「Maximum update depth exceeded」的金矿在 componentStack——复现一次就能
		// 直接看到是哪个组件在循环（turn-rail 的级联 effect 是第一嫌疑人）。
		this.setState({ componentStack: info.componentStack });
		console.error("[ErrorBoundary]", error, info.componentStack);
		// 「重新加载」按钮会销毁现场，而诊断这类错误全靠 componentStack ——
		// 落一份到 localStorage，重载后仍能从 devtools 取回（kamibuddy.lastRenderError）。
		try {
			localStorage.setItem(
				"kamibuddy.lastRenderError",
				JSON.stringify({
					message: error.message,
					componentStack: info.componentStack,
					at: new Date().toISOString(),
				}),
			);
		} catch {
			// localStorage 不可写（隐私模式等）不掩盖主错误。
		}
	}

	override render(): ReactNode {
		const { error, componentStack } = this.state;
		if (error !== undefined) {
			return (
				<div className="error-boundary">
					<div className="error-boundary-card">
						<h2>界面渲染出错</h2>
						<p className="error-boundary-message">{error.message}</p>
						{componentStack !== undefined && (
							<details className="error-boundary-stack">
								<summary>组件堆栈</summary>
								<pre>{componentStack}</pre>
							</details>
						)}
						<button type="button" onClick={() => window.location.reload()}>
							重新加载
						</button>
					</div>
				</div>
			);
		}
		return this.props.children;
	}
}

const root = document.getElementById("root");
if (root === null) throw new Error("#root 不存在");

createRoot(root).render(
	<StrictMode>
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	</StrictMode>,
);

/**
 * 开发期性能浮层（spec：optimize-stream-rendering Task 1）——FPS + 主线程 longtask 采集。
 *
 * 开关：`localStorage.kbPerf = "1"` 强制开、`"0"` 强制关。
 * 默认值按构建区分：DEV 开（开发者要的量尺默认就位）、生产关（浮层不是产品 UI）。
 * 生效条件：`kbPerf === "1"`（强开，生产亦然）或 DEV 下且 `kbPerf !== "0"`。
 *
 * 用动态 `import()` 而不是静态 import：模块与它的常驻代码（React 组件、rAF 循环、
 * PerformanceObserver）不落在入口 chunk 里，默认也不会被求值。
 * 注意：生产构建**仍会包含**该模块（约 4.9 kB 的独立 chunk）与这条动态 import 存根——
 * `import.meta.env.DEV` 在生产被折成 `false` 后，守卫只剩 `perfFlag === "1" || false`，
 * 结果取决于运行时 localStorage，rollup 判定不了该死分支，于是原样保留。
 * 默认行为仍是"不执行"（未设 `kbPerf` 时 `null === "1"` 为假），符合 spec 要求的"不加载"。
 * 留着生产强开入口是有意的：真机取证需要它，代价就是那 4.9 kB。
 * 若要彻底剔除该 chunk（同时失去生产强开取证的能力），需把 `import.meta.env.DEV` 提为
 * 唯一编译期闸门，写成 `if (import.meta.env.DEV && perfFlag !== "0")`。
 */
const perfFlag = localStorage.getItem("kbPerf");
if (perfFlag === "1" || (import.meta.env.DEV && perfFlag !== "0")) {
	void import("./perf-overlay.tsx").then((module) => module.mountPerfOverlay());
}
