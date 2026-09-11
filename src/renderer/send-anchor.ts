/**
 * 「发送时消息吸顶」的决策与锚定结构 —— WorkBuddy 5.5.4 cb-chat-ui 的同款机制
 * 复刻（证据：5.5.4 解包 lib-chat-ui-ChIVprRk.js）：
 *
 *   - `useFirstMessageAlign`（packages/cb-chat-ui/.../use-first-message-align.ts）：
 *     会话空闲→活跃的同一批 render 里置 firstUserMessageAlignPendingRef，新 user
 *     消息上屏后对该消息组 scrollToIndex({ align: "start" })，发出即清标记。
 *     5.5.4 里 enableUserMessageTopAlignment 已是 `?? true` —— 开关被移除、
 *     固化为默认行为。我们同样不做设置项：Claude.ai / ChatGPT / WorkBuddy 都把
 *     「问题吸顶、答案在下方展开」当作唯一行为，多一个开关只是多一份测试面，
 *     没有用户价值。
 *   - `group-min-height.utils.ts` 的 shouldApplyGroupMinHeight：给进行中的最后
 *     一组加 min-height: containerHeight。没有它，内容不足一屏时滚动容器
 *     clamp，用户消息永远够不到视口顶；更关键的是它让「吸顶位置」与
 *     streaming 吸底跟随（useStreamingStick 的 align-end）收敛到同一个
 *     scrollTop —— 吸顶后跟随接管不打架、不二次跳动。
 *
 * 本模块是纯函数层（三态决策），chat-view 只做 DOM 执行
 * （scrollIntoView / scrollTop）与状态持有 —— 决策脱离 React 单测，
 * 与 thinking-fold / turn-rail 同一拆法。
 *
 * 这里原本还有回合分组（groupTurnBlocks，消费 metafold v1 的 RenderBlock
 * 块流）：轮折叠落地后块流退役，切轮由 turn-fold.ts 的 buildTurnViews
 * 一并完成（startsWithUser 语义原样保留），分组函数随之删除。
 */

/**
 * 「本会话内新发送」的待吸顶记录：发送动作时建立，新 user 消息回显上屏、
 * 吸顶发出后把 aligned 翻 true。
 */
export interface PendingSentAlign {
	/**
	 * 发送时所在会话：切会话后这条记录作废 —— 吸顶只对「本会话内新发送」
	 * 生效，恢复历史/加载旧消息/切换会话一律不触发（记录里不带消息 id，
	 * 是因为发送那一刻新消息还没有 id，只能靠 baseline 比对）。
	 */
	readonly sessionId: string;
	/**
	 * 发送那一刻的最后一条 user 消息 id（无可发送基线时为 undefined）。
	 * lastUserEntryId 变得与它不同 = 「新发送的那条消息上屏了」。
	 */
	readonly baselineUserId: string | undefined;
	/**
	 * 吸顶是否已发出：已发出的记录不再触发吸顶，只用于保住 anchor-space
	 * 的 min-height，直到 streaming 接管（见 chat-view 的交接 effect）。
	 */
	readonly aligned: boolean;
}

/** 滚动决策的三种结果。 */
export type ScrollAction =
	/** 把这条 user 消息吸到视口顶部（scrollIntoView block:"start"）。 */
	| { readonly kind: "align-top"; readonly entryId: string }
	/** 既有吸底跟随（scrollTop = scrollHeight）。 */
	| { readonly kind: "stick-bottom" }
	/** 不动：等回显中，或用户已上翻解除跟随。 */
	| { readonly kind: "none" };

/** 过滤出对当前会话仍有效的待吸顶记录；切会话后旧记录视为不存在。 */
export function activePendingAlign(
	pending: PendingSentAlign | undefined,
	sessionId: string,
): PendingSentAlign | undefined {
	return pending !== undefined && pending.sessionId === sessionId ? pending : undefined;
}

export interface ScrollDecisionInput {
	/** 发送时登记的待吸顶记录（可能属于别的会话，函数内部按 sessionId 过滤）。 */
	readonly pending: PendingSentAlign | undefined;
	/** 当前会话 id。 */
	readonly sessionId: string;
	/** 当前 entries 里最后一条 user 消息 id；还没有 user 消息时为 undefined。 */
	readonly lastUserEntryId: string | undefined;
	/** 是否吸底跟随中（用户上翻解除跟随后为 false）。 */
	readonly isFollowing: boolean;
}

/**
 * 每次 entries 变化时的滚动决策：
 *
 * | 条件 | 动作 |
 * |---|---|
 * | 有待吸顶且新 user 消息已上屏 | align-top（新发送→吸顶，只发一次） |
 * | 有待吸顶但新消息还没上屏 | none（保持发送时的视口，先吸底再吸顶会多跳一次） |
 * | 无待吸顶（或已吸过）且跟随中 | stick-bottom（streaming 吸底跟随，既有语义） |
 * | 无待吸顶且用户已上翻 | none（上翻解除跟随，既有语义） |
 * | 待吸顶属于别的会话 | 按「无待吸顶」走既有跟随语义（切会话不吸顶） |
 */
export function decideScrollAction(input: ScrollDecisionInput): ScrollAction {
	const pending = activePendingAlign(input.pending, input.sessionId);
	if (pending !== undefined && !pending.aligned) {
		if (input.lastUserEntryId !== undefined && input.lastUserEntryId !== pending.baselineUserId) {
			return { kind: "align-top", entryId: input.lastUserEntryId };
		}
		return { kind: "none" };
	}
	return input.isFollowing ? { kind: "stick-bottom" } : { kind: "none" };
}
