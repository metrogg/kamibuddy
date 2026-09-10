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
