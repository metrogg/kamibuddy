/**
 * 全局轻提示（对标 WorkBuddy 的 toast）：success / info / warning / error /
 * loading 五型 + 顶部居中堆叠。
 *
 * WorkBuddy 的入口很全，而我们按纵切片推进（STATUS.md 的 D 计划），
 * 界面先铺满、能力后补齐。没有反馈的死按钮会让试用同事以为坏了，
 * 所以统一走这个 toast —— 比每个入口各写一套便宜得多。
 */

import { IconAlert, IconCheck } from "./icons.tsx";

export type ToastType = "success" | "info" | "warning" | "error" | "loading";

export interface ToastMessage {
	readonly id: number;
	readonly text: string;
	readonly type: ToastType;
}

export function Toast({ messages }: { readonly messages: readonly ToastMessage[] }): React.JSX.Element | null {
	if (messages.length === 0) return null;
	return (
		<div className="toast-stack" role="status">
			{messages.map((message) => (
				<div key={message.id} className={`toast toast-${message.type}`}>
					<span className="toast-icon" aria-hidden="true">
						{message.type === "success" ? (
							<IconCheck size={14} />
						) : message.type === "error" || message.type === "warning" ? (
							<IconAlert size={14} />
						) : message.type === "loading" ? (
							<span className="toast-spinner" />
						) : null}
					</span>
					<span className="toast-text">{message.text}</span>
				</div>
			))}
		</div>
	);
}
