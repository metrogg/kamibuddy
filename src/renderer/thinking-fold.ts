/**
 * 深度思考块的折叠状态机（对标 WorkBuddy）。
 *
 * 自动行为：流式期间默认展开（让用户看到推导过程），该条消息完成后自动收起
 * （长推导平铺在正文里会冲掉最终回答）。用户手动开合优先于自动行为，
 * 同一条消息内记住用户选择 —— 状态由组件按消息实例持有，天然随消息隔离。
 *
 * 抽成纯函数是为了脱离 React 单测：chat-view 的 ThinkingBlock 只是它的薄壳。
 */

/**
 * 用户的手动开合偏好。
 * undefined = 未干预过，折叠跟随流式状态自动走；一旦点击过就恒为 boolean。
 */
export type ThinkingFoldOverride = boolean | undefined;

/**
 * 当前是否展开。
 * 用户干预过 → 听用户的；否则流式展开、完成收起。
 */
export function thinkingOpen(streaming: boolean, override: ThinkingFoldOverride): boolean {
	return override ?? streaming;
}

/**
 * 用户点击标题：从当前实际开合状态取反，并记录为偏好。
 * 此后流式状态翻转（assistant_done）也不再影响这块的开合。
 */
export function toggleThinking(streaming: boolean, override: ThinkingFoldOverride): boolean {
	return !thinkingOpen(streaming, override);
}
