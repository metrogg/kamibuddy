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
 * 开关：单一 key `localStorage.kbPerf`——只有 `"1"` 才开，其余（未设置 / `"0"`）都不开。
 *
 * 为什么不再按构建区分默认值：原先 DEV 默认开，理由是"开发者要的量尺默认就位"，但实测打扰正常开发
 * （右下角常驻浮层遮挡界面）。浮层是**主动取证**时才需要的工具——改渲染性能时才量一次，
 * 平时就该收起来，所以改成只在显式开启时启用，DEV 下亦然。
 * 仍保留 `"1"` 在生产强开的能力：真机取证要用。
 *
 * 用动态 `import()` 而不是静态 import：模块与它的常驻代码（React 组件、rAF 循环、
 * PerformanceObserver）不落在入口 chunk 里，默认也不会被求值。
 * 注意：生产构建**仍会包含**该模块（约 4.9 kB 的独立 chunk）与这条动态 import 存根——
 * 守卫读的是运行时 `localStorage`，rollup 判定不了该死分支，于是原样保留。
 * 默认行为仍是"不执行"（未设 `kbPerf` 时 `null === "1"` 为假），符合 spec 要求的"不加载"。
 * 留着生产强开入口是有意的：真机取证需要它，代价就是那 4.9 kB。
 * 若要彻底剔除该 chunk（同时失去生产强开取证的能力），得让守卫成为编译期常量
 * （如 `import.meta.env.DEV` 作闸门）——但这与"生产可强开"直接冲突，故不采用。
 */
const perfFlag = localStorage.getItem("kbPerf");
if (perfFlag === "1") {
	void import("./perf-overlay.tsx").then((module) => module.mountPerfOverlay());
}
