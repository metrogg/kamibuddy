/**
 * 全局轻提示：点击了尚未实现的功能时给出「待做」反馈。
 *
 * WorkBuddy 的入口很全，而我们按纵切片推进（STATUS.md 的 D 计划），
 * 界面先铺满、能力后补齐。没有反馈的死按钮会让试用同事以为坏了，
 * 所以统一走这个 toast —— 比每个入口各写一套占位便宜得多。
 */

export interface ToastMessage {
	readonly id: number;
	readonly text: string;
}

export function Toast({ message }: { readonly message: ToastMessage | undefined }): React.JSX.Element | null {
	if (message === undefined) return null;
	return (
		<div className="toast" role="status">
			{message.text}
		</div>
	);
}
