/**
 * 对话内容列宽的动态口径（WorkBuddy use-dynamic-chat-content-width.ts 逐段同源）。
 *
 * 固定 832px 的教训（2026-09-11 用户实测）：窗口最大化后 832 列居中，
 * 两侧留白比例过大 —— WorkBuddy 的列宽不是常量，是容器宽度的分段函数：
 *   容器 ≤ 1200 → 固定 832
 *   1200 < 容器 ≤ 1600 → 容器 × 65%
 *   1600 < 容器 ≤ 2000 → 容器 × 60%
 *   容器 > 2000 → min(容器 × 55%, 1400)
 * （注意 1200→832 与 1201→780 之间存在小幅回跳，这是 WorkBuddy 原函数的
 * 固有形态，对齐优先不做平滑。）
 */
export function computeChatContentWidth(containerWidth: number): number {
	if (containerWidth <= 1200) return 832;
	if (containerWidth <= 1600) return containerWidth * 0.65;
	if (containerWidth <= 2000) return containerWidth * 0.6;
	return Math.min(containerWidth * 0.55, 1400);
}
