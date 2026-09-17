/**
 * 把 SessionEvent 流折叠成可渲染的会话状态。
 *
 * 放在 shared/ 而非任一端，是因为**两端都需要它**：
 *   - renderer 用它把增量事件折叠成当前视图；
 *   - daemon 用它维护同一份历史，供渲染进程重新挂载时经 snapshot 拉取。
 *
 * 各写一份必然漂移（同一个事件在两边折叠出不同结果，且症状是「刷新后内容变了」，
 * 极难排查），而 daemon 不许 import renderer（AGENTS.md §1）。
 * 这个 reducer 纯函数、零依赖，放 shared/ 两端共用是唯一不漂移的做法。
 *
 * 纯函数，无 React 依赖，可单测。
 */

import type {
	AssistantMessage,
	CompactionState,
	ConversationEntry,
	MessageId,
	QueuedMessages,
	RunRetryState,
	SessionEvent,
	SessionSnapshot,
	SessionState,
	ModeDescriptor,
	ToolCard,
	TurnTiming,
} from "./session-events.ts";
import { generatingLabel } from "./session-events.ts";
import { mergePresentedArtifacts, type ArtifactRef } from "./artifacts.ts";
import type { ContextUsageDetail } from "./context-usage.ts";
import type { SessionStatCard } from "./observability.ts";

export interface ConversationView {
	readonly state: SessionState;
	readonly entries: readonly ConversationEntry[];
	/** 场景轴选项（首页页签）。 */
	readonly availableScenes: readonly ModeDescriptor[];
	/** 交互轴选项（对话页切换器）。 */
	readonly availableModes: readonly ModeDescriptor[];
	/** 最近的上下文用量明细（context_usage 事件折叠而来）。 */
	readonly usageDetail?: ContextUsageDetail;
	/**
	 * 会话级统计（session_stats 事件折叠而来），聊天页底部常驻指标条的读数。
	 * 与 usageDetail 同性质：daemon 算好的投影，renderer 不二次计算。
	 */
	readonly sessionStats?: SessionStatCard;
	/** 当前回合计时（user_message 起表，run 结束停表）。 */
	readonly turn?: TurnTiming;
	/**
	 * 按回合 id 持久化的计时（`turn` 只留当前回合，历史回合的时长只在这里）。
	 *
	 * 键 = 开启该回合的 user 消息 id —— 与 renderer 的轮切分（turn-fold.ts 用
	 * user.id 作 turnId）同一口径，回合头部据此查得到任意历史轮的计时。
	 * 可选且缺省视作空映射：daemon 的 freshConversation 等既有构造点不强制填
	 * （与 `turn` 同样按可选契约处理，reducer 写入时自行兜底）。
	 */
	readonly turnTimings?: Readonly<Record<string, TurnTiming>>;
	/**
	 * 被取消回合的起始用户消息 id。「用户已取消」指示行按它定位到
	 * 历史里对应回合的末尾；新回合不重置它（取消痕迹是历史的一部分）。
	 */
	readonly cancelledTurns: readonly MessageId[];
	/** 本会话已交付的产物（artifacts_presented 折叠而来，唯一来源）。 */
	readonly artifacts: readonly ArtifactRef[];
	/**
	 * 进行中的模型自动重试（run_retry 折叠而来；协议见 session-events.ts）。
	 * run_finished / run_error / 新 user_message 到来时清空 —— 重试态只活在
	 * 一次 run 的等待窗口里，不随回合穿越。
	 */
	readonly retry?: RunRetryState;
	/**
	 * steer / followUp 排队中的消息（queue_changed 折叠而来，数组即 pi 的队列内容）。
	 * 排队 chips 据此渲染文本、删除/编辑据此重排（session:queue-rewrite）。
	 * 缺省 = 没有排队（含「队列被清空」——与「没收到过事件」在 UI 上同义）。
	 */
	readonly queued?: QueuedMessages;
	/**
	 * 进行中的上下文压缩（compaction_started 折叠而来；协议见 session-events.ts）。
	 *
	 * 压缩是**运行期瞬态**，不进 SessionState（不是会话元信息）、不随快照恢复：
	 * 它只活在 compaction_started → compaction_finished 之间。故除 finished 外，
	 * history_reset（历史清零）与 session_state（权威 state 重推）也一并清态 ——
	 * 压缩态不属于被重推的 state，重推后若还留着就是幽灵状态行（悬浮不消失）。
	 */
	readonly compacting?: CompactionState;
}

export type ConversationAction =
	| { readonly type: "snapshot"; readonly snapshot: SessionSnapshot }
	| { readonly type: "event"; readonly event: SessionEvent };

export const initialConversation: ConversationView = {
	state: {
		sessionId: "",
		cwd: undefined,
		isTempTask: true,
		sceneId: "work",
		interactionId: "craft",
		modelId: undefined,
		isStreaming: false,
	},
	entries: [],
	availableScenes: [],
	availableModes: [],
	turnTimings: {},
	cancelledTurns: [],
	artifacts: [],
	retry: undefined,
	queued: undefined,
	compacting: undefined,
};

/**
 * 从等待队列里摘掉**第一条**与 text 相同的消息（steering 优先）。
 *
 * 供排队 chips 的「删除 / 编辑」用：pi 只能整队清空（session:queue-rewrite
 * 的底层就是清空 + 按序重入队），所以删一条 = 先在本地算出剩下的队列，再把
 * 剩下的整体重排。只摘第一条 —— 同文本可以排队多条，按内容删必须一条一条来，
 * 否则一次会摘掉两根相同的 chip。
 */
/**
 * 从等待队列里摘掉**第一条**与 text 相同的消息（steering 优先）。
 *
 * 供排队 chips 的「删除 / 编辑」用：pi 只能整队清空（session:queue-rewrite
 * 的底层就是清空 + 按序重入队），所以删一条 = 先在本地算出剩下的队列，再把
 * 剩下的整体重排。只摘第一条 —— 同文本可以排队多条，按内容删必须一条一条来，
 * 否则一次会摘掉两根相同的 chip。
 *
 * 两边都没有时**原样返回**（同一对象），调用方可据此跳过这次重排。
 */
export function removeQueuedMessage(queued: QueuedMessages, text: string): QueuedMessages {
	// steering 命中就只动 steering：同一文本同时出现在两个队列时不双重删除。
	const steering = dropFirstMatch(queued.steering, text);
	if (steering !== undefined) return { steering, followUp: queued.followUp };
	const followUp = dropFirstMatch(queued.followUp, text);
	if (followUp !== undefined) return { steering: queued.steering, followUp };
	return queued;
}

/**
 * 把等待队列里的一条 follow-up **提升为立即插入**（挪进 steering 队尾）。
 *
 * 排队 chips 的「立即插入」用：先在 followUp 里摘掉它、再排到 steering 队尾 ——
 * 重排的底层仍是「清空 + 按序重入队」，重入队时它走的是 steer 通道，
 * 于是本轮下一个工具边界就生效（不必等当前 run 结束）。
 * 已在 steering 里 / 找不到时**原样返回**，调用方据此跳过重排。
 */
export function insertQueuedNow(queued: QueuedMessages, text: string): QueuedMessages {
	if (queued.steering.includes(text)) return queued;
	const followUp = dropFirstMatch(queued.followUp, text);
	if (followUp === undefined) return queued;
	return { steering: [...queued.steering, text], followUp };
}

/** 摘掉数组中第一条与 text 相同的元素；没命中返回 undefined（不造新数组）。 */
function dropFirstMatch(list: readonly string[], text: string): readonly string[] | undefined {
	const index = list.indexOf(text);
	return index === -1 ? undefined : [...list.slice(0, index), ...list.slice(index + 1)];
}

/**
 * 就地替换某条 entry；找不到则原样返回（事件乱序时不崩，但也不静默造一条假数据）。
 *
 * `match` 决定「同 id 在 entries 里出现多条」时改哪一条：
 *
 *   - `"first"`（缺省）：**id 全局唯一**的条用（工具卡的 id 是 provider 生成的
 *     toolCallId，天然不重；first/last 等价，保持既有语义）。
 *   - `"last"`：**assistant 消息条目必须用它**。消息 id 是宿主进程内自增计数器
 *     的产物（core/session-host.ts 的 idSeq），**宿主重建后计数器从 1 重来** ——
 *     daemon 重启 / resume 的 remountHostInBucket 都会重建宿主，于是同一串
 *     `assistant-3` 在同一个 entries 数组里对应**多条真实不同的消息**。
 *     这时只有「最后那条」是本次 `assistant_started` 开的气泡；写成 first 会把
 *     新消息的正文与 usage 盖进上一代的老条目上，而老条目在数组里的位置属于
 *     **更早的轮** —— usage 就此跨轮搬家：本轮的窗口被空壳占住（少算），
 *     更早那轮的窗口里冒出别轮的 usage（多算）。
 *
 *     实测（2026-09-17，会话 01a0ae75，6 轮 / 50 步，事件日志里宿主代际切换 4 次，
 *     id 序列 user-2/assistant-3… 被三代复用）：按 first 替换时，页脚给第 2 轮
 *     算出 ↑161.0K，而台账该轮 Σbilled = 69.4K（多算 132%）；第 3 轮页脚给 0
 *     （台账 18.0K，少算整轮）—— 页脚是派生显示，台账才是权威
 *     （AGENTS.md §1 依赖方向 / shared/observability.ts 文件头）。
 */
function replaceEntry(
	entries: readonly ConversationEntry[],
	id: string,
	update: (entry: ConversationEntry) => ConversationEntry,
	match: "first" | "last" = "first",
): readonly ConversationEntry[] {
	const index =
		match === "last"
			? entries.findLastIndex((e) => e.id === id)
			: entries.findIndex((e) => e.id === id);
	if (index === -1) return entries;
	const existing = entries[index];
	if (existing === undefined) return entries;
	const next = entries.slice();
	next[index] = update(existing);
	return next;
}

/**
 * run 结束时把仍滞留的「生成中」卡片标记为 aborted。
 *
 * 正常流程下卡片离开生成态只有一条路：tool_execution_start 把它翻转为执行态。
 * 生成被打断（用户中断、模型报错）时这条事件永远不会来 —— 不清理的话
 * 卡片上的呼吸动画会永远转下去，看起来像还在写文件。
 */
function abortOrphanedGenerating(
	entries: readonly ConversationEntry[],
): readonly ConversationEntry[] {
	if (!entries.some((e) => e.role === "tool" && e.generating === true)) return entries;
	return entries.map((e) =>
		e.role === "tool" && e.generating === true
			? { ...e, generating: undefined, outcome: "aborted" as const }
			: e,
	);
}

/** run 结束停表。没有起过表（如压缩 run）就不造一个假回合。 */
function stopTurn(turn: TurnTiming | undefined, cancelled: boolean): TurnTiming | undefined {
	if (turn === undefined || turn.endedAt !== undefined) return turn;
	// cancelled 只在为 true 时落键：正常结束的回合不该带这个标记取值。
	return cancelled
		? { ...turn, endedAt: Date.now(), cancelled: true }
		: { ...turn, endedAt: Date.now() };
}

/**
 * run 被取消时记录当前回合（最后一条 user 消息）的 id。
 * 没有 user 消息的 run（如手动压缩）不构成回合，不记录。
 */
function markTurnCancelled(
	entries: readonly ConversationEntry[],
	cancelledTurns: readonly MessageId[],
): readonly MessageId[] {
	const index = lastUserEntryIndex(entries);
	const lastUser = index === -1 ? undefined : entries[index];
	if (lastUser === undefined || cancelledTurns.includes(lastUser.id)) return cancelledTurns;
	return [...cancelledTurns, lastUser.id];
}

/**
 * 回合计时映射保留的最近回合数上限。
 *
 * 会话能跑几百轮，映射只增不减会无界增长（每轮一个小对象，且 reducer 每次都
 * 整体替换视图 —— 长会话下每来一个事件都要复制整张表）。UI 只回看有限历史，
 * 保留最近 100 轮足够；超出即丢最早的键。
 */
const MAX_TURN_TIMINGS = 100;

/**
 * 当前回合的起点下标 = **最后一条 user 消息**的下标；没有 user 消息时为 −1。
 *
 * **轮边界的唯一实现处**（2026-09-17 收拢）：它此前在五处各写一遍
 * （本文件的 lastTurnId / markTurnCancelled、renderer 的 turn-fold
 * buildTurnViews、turn-metrics foldTurnMetrics、chat-view 的 lastUserEntry 与
 * metricsAnchorId），五个地方写的都是 `findLast(role === "user")` 的同义改写 ——
 * 而页脚的「本轮」读数、回合头部的计时、回合折叠的切分全依赖这一条边界，
 * 任一处漂移都会让同屏两个读数说的是不同的轮（AGENTS.md §4 防重复）。
 *
 * 语义：最后一条 user 之后（到下一条 user 之前）为本轮；没有 user 消息时
 * 整体视作前缀轮（同 buildTurnViews 的最后一段）。
 */
export function lastUserEntryIndex(entries: readonly ConversationEntry[]): number {
	return entries.findLastIndex((e) => e.role === "user");
}

/** 当前回合 id = 最后一条 user 消息 id（即 lastUserEntryIndex 指的那条）。 */
export function lastTurnId(entries: readonly ConversationEntry[]): MessageId | undefined {
	const index = lastUserEntryIndex(entries);
	return index === -1 ? undefined : entries[index]?.id;
}

/**
 * 写入某回合计时，超出上限时丢最早的键。
 *
 * 键是 `user-N` 形态（core/session-host.ts 的 nextId），非整数样字符串 ——
 * JS 对象对这类键保持插入顺序，故 Object.keys 的前几个就是最早的回合，从头
 * 裁剪即丢最旧（若键变成整数样字符串会按数值排序，此假设失效）。更新已有键
 * 不改其插入位置，「回合结束补 endedAt」不会把它挪成最新。
 */
function recordTurnTiming(
	timings: Readonly<Record<string, TurnTiming>> | undefined,
	turnId: string,
	timing: TurnTiming,
): Readonly<Record<string, TurnTiming>> {
	const next: Record<string, TurnTiming> = { ...(timings ?? {}), [turnId]: timing };
	const keys = Object.keys(next);
	if (keys.length <= MAX_TURN_TIMINGS) return next;
	const trimmed: Record<string, TurnTiming> = {};
	for (const key of keys.slice(keys.length - MAX_TURN_TIMINGS)) {
		const value = next[key];
		if (value !== undefined) trimmed[key] = value;
	}
	return trimmed;
}

export function conversationReducer(view: ConversationView, action: ConversationAction): ConversationView {
	if (action.type === "snapshot") {
		return {
			state: action.snapshot.state,
			entries: action.snapshot.entries,
			availableScenes: action.snapshot.availableScenes,
			availableModes: action.snapshot.availableModes,
			usageDetail: action.snapshot.usageDetail,
			sessionStats: action.snapshot.sessionStats,
			turn: action.snapshot.turn,
			// snapshot 由 daemon 的 ConversationView（同一份 reducer，App 切会话时
			// 也直接拿缓存桶当快照）经 IPC 原样下发，运行期带 turnTimings；而
			// SessionSnapshot 类型（session-events.ts）暂未声明该字段，故按结构窄化
			// 读取，缺省回落空映射（历史计时不可见，但不阻塞其余状态恢复）。
			// SessionSnapshot 补齐该字段后可直接改为 action.snapshot.turnTimings。
			turnTimings:
				(action.snapshot as { readonly turnTimings?: Readonly<Record<string, TurnTiming>> })
					.turnTimings ?? {},
			cancelledTurns: action.snapshot.cancelledTurns ?? [],
			artifacts: action.snapshot.artifacts,
			retry: action.snapshot.retry,
			queued: action.snapshot.queued,
			// 压缩态**不随快照恢复**：它是运行期瞬态、不属于会话事实，重挂载后
			// 若快照没有在途压缩就不该凭空冒出一条状态行（幽灵态）。这里刻意不读
			// snapshot 的 compacting —— 新视图对象不列该键即回落 undefined。
			compacting: undefined,
		};
	}

	const event = action.event;
	switch (event.type) {
		case "history_reset":
			// 与 daemon resetSession 同口径：历史 / 计时 / 取消痕迹 / 产物 / 用量明细全清；
			// state 只复位 sessionId 与 isStreaming —— cwd、两轴、模型选择保留
			// （新建任务不换空间也不换模式）。重试/排队同属运行现场，一并清零。
			return {
				...view,
				state: { ...view.state, sessionId: "", isStreaming: false },
				entries: [],
				usageDetail: undefined,
				sessionStats: undefined,
				turn: undefined,
				turnTimings: {},
				cancelledTurns: [],
				artifacts: [],
				retry: undefined,
				queued: undefined,
				// 压缩态同属运行现场，一并清零（历史都清了，不该还挂着「正在压缩」）。
				compacting: undefined,
			};

		case "run_started": {
			// 新的 run 开始意味着上一轮的重试等待窗口已结束（retry 终态后 pi 才
			// 会发起新一轮尝试）。排队数不动 —— steer/followUp 的出队由
			// queue_changed 给出新值，run 边界不代表队列清空。
			//
			// 计时映射：当前回合的 startedAt 源自 user 消息落库时间，user_message
			// 到达时已记入映射；这里对仍计时的当前回合再盖一次章（值同源、幂等），
			// 兼容 run_started 先于/后于 user_message 两种到达序。已停表的回合
			// （endedAt 已定）不重写，避免把上一轮的终态盖成在跑。
			const turnId = lastTurnId(view.entries);
			const liveTurn = view.turn;
			return {
				...view,
				state: { ...view.state, isStreaming: true },
				turnTimings:
					liveTurn !== undefined && liveTurn.endedAt === undefined && turnId !== undefined
						? recordTurnTiming(view.turnTimings, turnId, liveTurn)
						: view.turnTimings,
				retry: undefined,
			};
		}

		case "run_finished": {
			const cancelled = event.outcome === "cancelled";
			const turn = stopTurn(view.turn, cancelled);
			const turnId = lastTurnId(view.entries);
			return {
				...view,
				state: { ...view.state, isStreaming: false },
				entries: abortOrphanedGenerating(view.entries),
				turn,
				// 停表结果同步进映射：键取最后一条 user 消息 id，无 user 消息则无从
				// 起键、跳过（不凭空造回合）。已停表回合 stopTurn 原样返回，写回值不变。
				turnTimings:
					turn === undefined || turnId === undefined
						? view.turnTimings
						: recordTurnTiming(view.turnTimings, turnId, turn),
				// 取消的回合记入名单：指示行要在新回合开始后仍留在历史里。
				cancelledTurns: cancelled
					? markTurnCancelled(view.entries, view.cancelledTurns)
					: view.cancelledTurns,
				// run 落定后重试态必须清掉，避免终态后还挂「N 秒后重试」。
				retry: undefined,
			};
		}

		case "run_error": {
			// 错误作为独立条目落进流里（渲染为错误卡，见 ErrorEntry），用户能看到上下文位置。
			// 错误不是用户取消：停表但不落 cancelled 标记。
			const turn = stopTurn(view.turn, false);
			const turnId = lastTurnId(view.entries);
			return {
				...view,
				state: { ...view.state, isStreaming: false },
				entries: [
					...abortOrphanedGenerating(view.entries),
					{
						id: `error-${event.runId}`,
						role: "error",
						message: event.message,
						runId: event.runId,
						at: Date.now(),
					},
				],
				turn,
				turnTimings:
					turn === undefined || turnId === undefined
						? view.turnTimings
						: recordTurnTiming(view.turnTimings, turnId, turn),
				retry: undefined,
			};
		}

		case "user_message":
			// 回合计时从用户消息落库起表（WorkBuddy：从 user 消息发出到当前）。
			// 新回合开始：清重试态（避免追问/steer 时上一 run 的重试残留）。排队数
			// 不由这里清 —— queue_changed 会给出新值，新消息可能只是进队而不是立即发出。
			return {
				...view,
				entries: [...view.entries, event.message],
				turn: { startedAt: event.message.at },
				// 以「开轮 user 消息 id」为键记入计时映射：与 renderer 的轮切分
				// （turn-fold.ts 用 user.id 作 turnId）同一口径，历史回合头部据此查回计时。
				turnTimings: recordTurnTiming(view.turnTimings, event.message.id, {
					startedAt: event.message.at,
				}),
				retry: undefined,
			};

		case "assistant_started":
			return {
				...view,
				entries: [...view.entries, { id: event.messageId, role: "assistant", text: "", at: event.at }],
			};

		case "assistant_text_delta":
			return {
				...view,
				entries: replaceEntry(
					view.entries,
					event.messageId,
					(entry) => (entry.role === "assistant" ? { ...entry, text: entry.text + event.delta } : entry),
					"last",
				),
			};

		case "assistant_thinking_delta":
			return {
				...view,
				entries: replaceEntry(
					view.entries,
					event.messageId,
					(entry) =>
						entry.role === "assistant"
							? { ...entry, thinking: (entry.thinking ?? "") + event.delta }
							: entry,
					"last",
				),
			};

		case "assistant_done": {
			// 用终态整条覆盖，校正累积增量可能的偏差。
			const done: AssistantMessage = event.message;
			// "last"：id 撞名时只认本次消息自己那条（根因见 replaceEntry 注释）。
			const replaced = replaceEntry(view.entries, done.id, () => done, "last");
			// 没找到说明漏了 assistant_started，补进去而不是丢掉内容。
			return { ...view, entries: replaced === view.entries ? [...view.entries, done] : replaced };
		}

		case "tool_stream_started":
		case "tool_started": {
			// upsert：tool_stream_started 在生成阶段上屏，tool_started 在进入执行时
			// 把同一张卡翻转为执行态 —— 一次工具调用始终只有一张卡（WorkBuddy 同构）。
			// 缺了 stream_started 的旧流程（或乱序）下找不到 id，退化为追加。
			const card = event.card;
			const replaced = replaceEntry(view.entries, card.id, () => card);
			return { ...view, entries: replaced === view.entries ? [...view.entries, card] : replaced };
		}

		case "tool_stream_progress":
			// path 未完整时不落卡（半截路径上屏像 bug）；行数随 path 一起进 change，
			// UI 的 +N 徽章读同一个字段，生成中与终态两个口径不用分开渲染。
			// 标签随 changeType 刷新：write 覆盖已有文件时从「生成中」变「修改中」。
			// rawArgs（show_widget）与行数口径正交：参数本体原文直接落 streamArgs，
			// 渲染层拿它做渐进解析，不碰 label/summary/change。
			return {
				...view,
				entries: replaceEntry(view.entries, event.id, (entry) => {
					if (entry.role !== "tool") return entry;
					const withArgs =
						event.rawArgs !== undefined ? { ...entry, streamArgs: event.rawArgs } : entry;
					if (event.path === undefined) return withArgs;
					return {
						...withArgs,
						label: generatingLabel(entry.toolName, event.changeType),
						summary: event.path,
						change: {
							path: event.path,
							added: event.added,
							removed: 0,
							changeType: event.changeType,
						},
					};
				}),
			};

		case "tool_progress":
			return {
				...view,
				entries: replaceEntry(view.entries, event.id, (entry) =>
					entry.role === "tool" ? { ...entry, detail: (entry.detail ?? "") + event.delta } : entry,
				),
			};

		case "subagent_progress":
			// 整体替换语义：每次携带全量投影直接覆盖，不做增量合并
			// （契约见 session-events.ts 的 SubagentStatus 注释）。
			return {
				...view,
				entries: replaceEntry(view.entries, event.id, (entry) =>
					entry.role === "tool" ? { ...entry, subagents: event.agents } : entry,
				),
			};

		case "team_member_progress": {
			// 成员实时投影（spec: add-team-foundations 批 7）：归位到最近一张
			// team 卡（toolName === "team_create"），整体替换其 subagents
			// （契约见 session-events.ts 的事件注释）。找不到归属卡（旧格式
			// 会话 / 卡被清）→ 原样返回，事件丢弃不算错。
			let teamCardIndex = -1;
			for (let i = view.entries.length - 1; i >= 0; i -= 1) {
				const entry = view.entries[i];
				if (entry !== undefined && entry.role === "tool" && entry.toolName === "team_create") {
					teamCardIndex = i;
					break;
				}
			}
			if (teamCardIndex === -1) return view;
			return {
				...view,
				entries: view.entries.map((entry, i) =>
					i === teamCardIndex && entry.role === "tool" ? { ...entry, subagents: event.members } : entry,
				),
			};
		}

		case "tool_finished": {
			const card: ToolCard = event.card;
			const replaced = replaceEntry(view.entries, card.id, () => card);
			return { ...view, entries: replaced === view.entries ? [...view.entries, card] : replaced };
		}

		case "session_state":
			// 压缩后 pi 的 getContextUsage() 会有一段 tokens=null 的空窗，
			// 此时 state.contextUsage 缺省 —— 明细一并清掉，否则圆环停在压缩前的旧值。
			//
			// 压缩态也一并清：session_state 是 daemon 的权威 state 重推
			//（切会话 / 重挂载恢复），压缩不在 SessionState 里，重推即意味着
			// 「以这份 state 为准」，留着的在途压缩态就是幽灵状态行。
			return {
				...view,
				state: event.state,
				usageDetail: event.state.contextUsage === undefined ? undefined : view.usageDetail,
				// 换了会话（新建 / 切换）时旧会话的统计对新会话是错的，清掉；
				// 同一会话则保留 —— 统计由 session_stats 事件独立更新（session_state
				// 不携带它），无条件清会让指标条在每次状态重推后闪空一下。
				sessionStats:
					event.state.sessionId === view.state.sessionId ? view.sessionStats : undefined,
				compacting: undefined,
			};

		case "context_usage":
			return { ...view, usageDetail: event.usage };

		case "session_stats":
			return { ...view, sessionStats: event.stats };

		case "artifacts_presented":
			return {
				...view,
				artifacts: mergePresentedArtifacts(view.artifacts, event.files, Date.now()),
			};

		case "run_retry":
			// start 把等待窗口折叠为 retryAt（倒计时基准）；success/finalError
			// 都清态 —— 成功由后续 assistant 流表达，finalError 由 run_error 表达，
			// 重试态只是等待窗口的占位，不该越过终态存活。
			if (event.status === "start") {
				return {
					...view,
					retry: {
						attempt: event.attempt,
						maxAttempts: event.maxAttempts,
						retryAt: Date.now() + event.delayMs,
						...(event.errorMessage === undefined ? {} : { errorMessage: event.errorMessage }),
					},
				};
			}
			return { ...view, retry: undefined };

		case "queue_changed": {
			// 队列全空时用 undefined 而不是空数组：「没有排队」与「队列是 0」在 UI 上
			// 同义，统一成缺省键让消费方只有一个判定口径（同 retry 字段的取舍）。
			const queued: QueuedMessages = { steering: event.steering, followUp: event.followUp };
			const empty = queued.steering.length === 0 && queued.followUp.length === 0;
			return { ...view, queued: empty ? undefined : queued };
		}

		case "compaction_started":
			// 起表用事件到达时刻：daemon 只透传 pi 的 reason，压缩时长两端同基准。
			// 连续 started（无 intervening finished）以后到者为准，原位刷新。
			return { ...view, compacting: { reason: event.reason, startedAt: Date.now() } };

		case "compaction_finished":
			// 结束/中断/失败一律清态（状态行在压缩结束后消失）。aborted / errorMessage
			// 不落视图：失败细节由随后的 run_error 卡表达，状态行不承载终态语义。
			return { ...view, compacting: undefined };

		default:
			// 未知事件一律忽略而不是返回 undefined——多会话落地后事件路由变复杂，
			// 信封未拆/契约错位时 reducer 返回 undefined 会把 conversation 毒化成空，
			// 下一帧渲染访问 conversation.entries 抛 TypeError 整树白屏（已发生两次）。
			return view;
	}
}

/**
 * 从重建 entries 折叠产物清单（resume 路径用：artifacts_presented 条目按序 fold）。
 * entry.at 是落盘时的交付时间，保序/去重语义与 live 路径一致 —— 两条路径都走
 * mergePresentedArtifacts，不在此重写合并逻辑（一处语义，两处复用，否则必然漂移）。
 */
export function artifactsFromEntries(entries: readonly ConversationEntry[]): readonly ArtifactRef[] {
	let acc: readonly ArtifactRef[] = [];
	for (const entry of entries) {
		if (entry.role !== "artifacts_presented") continue;
		acc = mergePresentedArtifacts(acc, entry.files, entry.at);
	}
	return acc;
}
