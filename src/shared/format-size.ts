/**
 * 文件大小格式化（WorkBuddy 产物卡口径：7.3 KB）。
 *
 * 对话页产物卡与预览面板概览共用一份 —— 两处各写必然漂移（AGENTS.md §4）。
 * 纯函数放 shared 而非 renderer，同 message-time.ts 的理由：可脱离 DOM 单测。
 * 0（URL/不可 stat）不显示，由调用方判断。
 */
export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	return kb < 100 ? `${kb.toFixed(1)} KB` : `${Math.round(kb)} KB`;
}
