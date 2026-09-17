/**
 * 命中前缀边界反推（CACHE6，依赖 LOG13 的逐条消息稳定标识）。
 *
 * provider 的前缀缓存按**最长公共前缀**匹配，API 只回一个 `cacheRead` 计数，
 * 不告诉你它断在哪一条上。能反推的依据有三层：
 *
 *   1. **token 对齐**：把本轮请求的逐条消息 token 估算累加（消息之前还有一段固定
 *      前缀：系统提示词 + 工具定义），与 `cacheRead` 对齐 —— 边界就落在某一条消息上
 *      （前 N 条命中、第 N+1 条起未命中）；
 *   2. **逐条 diff**：用消息的稳定 id + 内容指纹（MessageRef）与上一轮逐条比对，
 *      说出「为什么断」（第 N+1 条是新增 / 内容变了 / 位置变了）；
 *   3. **系统提示词内部分段 diff**：token 对齐判出断点在消息列表**之前**时
 *      （`before_messages`），用相邻两轮的 `systemSegments`（每段带内容指纹）比出
 *      到底是**哪一段**变了 / 新增 / 消失 —— 没有这一层，`before_messages` 只能
 *      说「系统提示词或工具定义变了」，指不出段。
 *
 * **前提与局限（结论是方向性的，不是账单）**：
 *   - token 是**字符估算**（core/observability.ts 的 estimateTokens），不是真 tokenizer；
 *   - 消息之前那段前缀（系统提示词 / 工具定义）没有逐条 token 明细，只能拿**上一轮**
 *     的 `billedInputTokens` 减去上一轮消息估算总量来反推定标（previousPromptTokens）。
 *     上一轮的前缀与这一轮不一致时（改了两轴 / 换了工具集），定标本身就偏；
 *   - 因此对齐结果自带一个消息条数量级的误差。函数如实报告：与上一轮的**确定性**
 *     差异位置（id + 指纹比对，不含估算）对不上时收敛到差异点并给出 uncertain；
 *   - 分段 diff 只比「变了 / 多了一段 / 少了一段 / 逐段一致」，**不回答工具集**
 *     （工具定义不在 systemSegments 里）—— 分段逐段一致时只能如实说断点在提示词之前；
 *   - 上一轮台账没有分段指纹（旧台账）时，只有字符数可对照，判不出就说判不出。
 *
 * **瞬态注入项**（`TRANSIENT_INJECTION_CUSTOM_TYPES`：prompt-switch 的 `context`
 * 事件与 session-host 的 hidden context，两条都每请求现算、不落会话）在归因前
 * 被剔除，理由见 `dropTransient`。
 *
 * 依赖方向：本文件零运行时依赖（不 import pi、不 import electron），
 * 供 renderer 的诊断面板直接消费（AGENTS.md §1.3：renderer 只 import shared）。
 */

import type { MessageRef, SystemSegmentStat } from "./observability.ts";

/**
 * 断点那条消息相对上一轮的变化原因。
 *
 * `unknown` 不是「没算」：它是「这条与上一轮完全相同（id 与指纹都没变），
 * 缓存没覆盖到这里的原因在更前面，或缓存被驱逐」——同样是结论，只是不能
 * 归因到这一条。
 */
export type CachePrefixChange =
	/** 上一轮的序列里没有这个 id —— 本轮新增。 */
	| "appended"
	/** 同一条消息（id 相同、位置相同）内容变了。 */
	| "changed"
	/** 同一条消息（id 相同）位置变了（如压缩后整体前移、中间插入了一条）。 */
	| "moved"
	/** 与上一轮完全相同，或没有上一轮可比 —— 不能归因到这一条。 */
	| "unknown";

/**
 * 系统提示词分段 diff 的结论（断点在消息列表之前时的段级归因）。
 *
 * `hitSegments` = 首个差异段的下标 = 它之前有几段与上一轮**逐段一致**（这些段
 * 仍可能命中缓存）。逐段一致的判据是 source + 内容指纹（缺指纹时只有字符数），
 * 不落正文。
 */
export type SystemPrefixChange =
	/** 某一段的内容变了（source 与位置相同，指纹不同）。 */
	| {
			readonly kind: "segment_changed";
			readonly source: string;
			/** 上一轮该段的字符数（与这一轮对比，给「变没变多」一个量）。 */
			readonly previousChars: number;
			readonly chars: number;
			readonly hitSegments: number;
	  }
	/** 本轮多了一段（上一轮没有这个 source）。 */
	| { readonly kind: "segment_appended"; readonly source: string; readonly hitSegments: number }
	/** 上一轮有的一段本轮没了。 */
	| { readonly kind: "segment_removed"; readonly source: string; readonly hitSegments: number }
	/**
	 * 两轮分段逐段一致 —— 系统提示词本身没变，所以断点在它**之前**
	 * （工具集 / 模型变了，或缓存整体失效）。这是结论，不是「没算」。
	 */
	| { readonly kind: "unchanged" }
	/**
	 * 判不出来，如实说（旧台账没有分段指纹、没有可比对的上一轮、两轮里有一轮
	 * 没有分段清单、或两轮分段集合相同但顺序不同）。`note` 说明是哪种。
	 */
	| { readonly kind: "undetermined"; readonly note: string };

/**
 * 反推结果：可判别联合，每种形态对应面板上一句能直说的话。
 * 边界无法确定时**不编数**——走 `unknown`，或给如实算出的边界配上 `uncertain` 说明。
 */
export type CachePrefixBoundary =
	/**
	 * 消息列表之前的固定前缀就没命中（系统提示词 / 工具定义变了，或缓存整体
	 * 失效，即 CACHE8 的情形）。`systemChange` 再往下指认是系统提示词的哪一段。
	 */
	| {
			readonly kind: "before_messages";
			/** 消息之前那段前缀的 token 估算（定标而来，见文件头）。 */
			readonly prefixTokens: number;
			readonly cacheRead: number;
			readonly systemChange: SystemPrefixChange;
			readonly uncertain: string | undefined;
	  }
	/** 断在某一条消息上：前 hitCount 条命中，这一条起未命中。 */
	| {
			readonly kind: "message";
			/** 命中的完整消息条数（消息清单里前 hitCount 条）。 */
			readonly hitCount: number;
			readonly message: MessageRef;
			readonly change: CachePrefixChange;
			readonly uncertain: string | undefined;
	  }
	/** 消息全部命中。 */
	| { readonly kind: "all_hit"; readonly hitCount: number; readonly uncertain: string | undefined }
	/** 数据不足，给不出边界（旧台账没有逐条明细 / 本轮没有 cacheRead 上报）。 */
	| { readonly kind: "unknown"; readonly note: string };

/**
 * 剔除「每请求现算、不落会话」的瞬态注入项（`TRANSIENT_INJECTION_CUSTOM_TYPES`）。
 *
 * 为什么必须剔除：这类消息按设计追加在消息数组末尾、不在会话文件里，**每一个**
 * 请求都会现算一条新的（id 由 `custom:<timestamp>` 生成，轮轮不同）。让它参与
 * 逐条 diff，它就会**每一轮**在尾部造出一个假差异（「上一轮尾部那条没了 / 换成
 * 了另一条」），把「其实历史全命中」的轮次误报成「断在最后一条」—— 每轮误报
 * 一次，比不报还糟。它是**有意设计**（落在历史之后、每请求现算），不是故障。
 *
 * 两种判据，按台账的新旧选：
 *   1. **新台账**（名册里出现过显式标记）：只认 `transient === true`
 *      （写入端按 customType 集合判定，见 core/session-host.ts 的 buildMessageRefs）。
 *      不掺启发式 —— 没有标记的条目就是真历史，别误伤。
 *   2. **旧台账**（整个名册都没有这个字段）：退到「role 归为 other 的**尾部**条目」
 *      这一可判定条件。瞬态注入项按设计只落在最后一个历史条目之后，所以它在名册
 *      里永远是最后一条；而 other 桶里会落盘的那些（branchSummary /
 *      compactionSummary）出现在历史的头部或中段，不会落在尾部。判据里的「尾部」
 *      是必要条件：缺标记时**只认最后一条**。这条启发式对「旧台账 + 尾条恰是
 *      other」有误伤可能，但比放它进 diff 导致的每轮误报更可接受（旧台账的
 *      降级口径同 MessageRef.transient 的注释）。
 */
function dropTransient(refs: readonly MessageRef[] | undefined): readonly MessageRef[] {
	if (refs === undefined) return [];
	if (refs.some((ref) => ref.transient !== undefined)) {
		return refs.filter((ref) => ref.transient !== true);
	}
	const last = refs.length - 1;
	return refs.filter((ref, index) => !(index === last && ref.role === "other"));
}

/**
 * 与上一轮逐条比对的**首个差异位置**（确定性，不含任何估算）：
 * 下标 i 之前（含 i-1）的消息 id 与内容指纹都相同，说明它们在缓存意义上
 * 与上一轮逐字节一致（可缓存的那段）；i 是本轮第一个「不一样」的位置。
 * 两轮从头到尾一致时返回较短者的长度（差异出现在更长那轮的尾巴上）。
 * previous 缺席 / 为空时返回 undefined（没有可比对的上一轮）。
 */
function firstDivergence(
	previous: readonly MessageRef[] | undefined,
	current: readonly MessageRef[],
): number | undefined {
	if (previous === undefined || previous.length === 0) return undefined;
	const shared = Math.min(previous.length, current.length);
	for (let i = 0; i < shared; i += 1) {
		const before = previous[i];
		const now = current[i];
		if (before === undefined || now === undefined) break;
		if (before.id !== now.id || before.fp !== now.fp) return i;
	}
	return shared;
}

/** 断点这条相对上一轮的变化原因（id 定身份、指纹定内容、下标定位置）。 */
function changeAt(
	previous: readonly MessageRef[] | undefined,
	current: readonly MessageRef[],
	index: number,
): CachePrefixChange {
	const message = current[index];
	if (message === undefined || previous === undefined || previous.length === 0) return "unknown";
	const prevIndex = previous.findIndex((ref) => ref.id === message.id);
	if (prevIndex === -1) return "appended";
	if (prevIndex !== index) return "moved";
	const before = previous[prevIndex];
	if (before === undefined) return "unknown";
	return before.fp === message.fp ? "unknown" : "changed";
}

/**
 * 相邻两轮的系统提示词分段 diff（CACHE6 的 before_messages 归因）。
 *
 * 逐段比对 source + 内容指纹（旧台账缺指纹时退到字符数），返回**首个确定差异**：
 * 内容变了 / 多了一段 / 少了一段。全程一致 → `unchanged`（断点在提示词之前）；
 * 比不出来 → `undetermined` 并说明是哪种（不编「大概是某段变了」）。
 *
 * 「集合相同但顺序不同」不算确定差异 —— 指认不出该归罪哪一段，如实说判不出来
 * （顺序在同一次会话内由组装器固定，实际不会变）。
 */
function diffSystemSegments(
	previous: readonly SystemSegmentStat[] | undefined,
	current: readonly SystemSegmentStat[] | undefined,
): SystemPrefixChange {
	if (
		previous === undefined ||
		current === undefined ||
		previous.length === 0 ||
		current.length === 0
	) {
		return {
			kind: "undetermined",
			note: "台账里没有可比对的系统提示词分段清单（旧台账，或这次调用不走组装），指认不出是哪一段变了。",
		};
	}
	const changed = (
		now: SystemSegmentStat,
		before: SystemSegmentStat,
		index: number,
	): SystemPrefixChange => ({
		kind: "segment_changed",
		source: now.source,
		previousChars: before.chars,
		chars: now.chars,
		hitSegments: index,
	});

	// 缺指纹的段（旧台账）：只记下「这里比不出内容」，不与后面真正的差异抢答。
	let incomparable: string | undefined;
	const shared = Math.min(previous.length, current.length);
	for (let i = 0; i < shared; i += 1) {
		const before = previous[i];
		const now = current[i];
		if (before === undefined || now === undefined) break;
		if (before.source === now.source) {
			if (before.fp !== undefined && now.fp !== undefined) {
				if (before.fp !== now.fp) return changed(now, before, i);
				continue;
			}
			// 没有指纹时字符数不同已足以说「内容变了」（同一段文本字符数不会变）。
			if (before.chars !== now.chars) return changed(now, before, i);
			incomparable ??= now.source;
			continue;
		}
		// source 对不上：区分「多了一段」「少了一段」与「集合相同但顺序变了」。
		if (!previous.some((s) => s.source === now.source)) {
			return { kind: "segment_appended", source: now.source, hitSegments: i };
		}
		if (!current.some((s) => s.source === before.source)) {
			return { kind: "segment_removed", source: before.source, hitSegments: i };
		}
		return {
			kind: "undetermined",
			note: `两轮分段集合相同但顺序不同（${before.source} / ${now.source}），指认不出是哪一段变了。`,
		};
	}
	const added = current[shared];
	if (current.length > previous.length && added !== undefined) {
		return { kind: "segment_appended", source: added.source, hitSegments: shared };
	}
	const removed = previous[shared];
	if (previous.length > current.length && removed !== undefined) {
		return { kind: "segment_removed", source: removed.source, hitSegments: shared };
	}
	if (incomparable !== undefined) {
		return {
			kind: "undetermined",
			note: `台账里没有分段指纹（如 ${incomparable} 段），只有字符数可对照，指认不出是哪一段变了。`,
		};
	}
	return { kind: "unchanged" };
}

/** 多条说明合成一个字段（面板只有一行位置，拼起来而不是丢一条）。 */
function joinNotes(notes: readonly string[]): string | undefined {
	return notes.length === 0 ? undefined : notes.join(" ");
}

/**
 * 反推本轮请求的缓存命中前缀边界。
 *
 * @param args.previous 上一轮的逐条消息（台账里紧邻的前一条 request_snapshot）；
 *   undefined = 没有可比对的上一轮（此时只能给出边界，给不出变化原因）。
 * @param args.previousPromptTokens 上一轮的 prompt 侧真实 token 总量
 *   （shared/observability.ts 的 billedInputTokens）—— 用来定标「消息之前那段前缀」。
 * @param args.current 本轮的逐条消息（request_snapshot.messageList）。
 * @param args.cacheRead 本轮 usage.cacheRead。
 * @param args.previousSegments 上一轮的系统提示词分段清单
 *   （request_snapshot.systemSegments）—— 断点在消息列表之前时靠它指认到段。
 * @param args.currentSegments 本轮的系统提示词分段清单。
 */
export function inferCachePrefixBreak(args: {
	readonly previous: readonly MessageRef[] | undefined;
	readonly previousPromptTokens: number | undefined;
	readonly current: readonly MessageRef[];
	readonly cacheRead: number | undefined;
	readonly previousSegments?: readonly SystemSegmentStat[] | undefined;
	readonly currentSegments?: readonly SystemSegmentStat[] | undefined;
}): CachePrefixBoundary {
	const { previous, previousPromptTokens, current, cacheRead, previousSegments, currentSegments } =
		args;
	if (current.length === 0) {
		// 旧台账（LOG13 之前）没有 messageList，逐条反推无从谈起 —— 如实说，不猜。
		return { kind: "unknown", note: "本轮没有逐条消息明细（旧台账或空请求），反推不了边界。" };
	}
	if (cacheRead === undefined) {
		return {
			kind: "unknown",
			note: "本轮没有 cacheRead 上报（该服务商不报缓存，或这一轮没有用量），无从对齐。",
		};
	}

	const notes: string[] = [];
	// 归因与命中遍历都在「去掉瞬态注入项」的名册上做（理由见 dropTransient）：
	// 那条幽灵条目每轮都在尾部换一条，留着它等于每轮误报一次。
	const previousReal = dropTransient(previous);
	const currentReal = dropTransient(current);
	// 差异位置是确定的（id + 指纹比对），估算对齐不是 —— 它既是归因依据，也是兜底。
	const divergedAt = firstDivergence(previousReal, currentReal);

	// 定标「消息之前那段前缀」：上一轮的真实 prompt token 总量 − 上一轮消息的估算
	// 总量。差值里既有系统提示词与工具定义，也吸收了估算的系统性偏差，所以比
	// 单独估算系统提示词更接近 provider 看到的口径。这里用**未剔除瞬态项**的上一轮
	// 名册：billedInputTokens 是含它的真实总量，减掉全部消息（含瞬态那条）才等于
	// 「消息之前」那段的量。
	let prefixTokens = 0;
	if (previous !== undefined && previousPromptTokens !== undefined) {
		const previousEstimated = previous.reduce((sum, ref) => sum + ref.tokens, 0);
		// 估算总量超过真实总量（消息字符数被高估）时差值会为负：前缀不可能为负，
		// 钳到 0（此时定标失效，下面的差异点兜底会兜住）。
		prefixTokens = Math.max(0, previousPromptTokens - previousEstimated);
	} else {
		notes.push("缺少上一轮的 prompt 总量，消息之前的前缀（系统提示词 / 工具定义）按 0 计，边界可能偏后。");
	}

	if (prefixTokens > 0 && prefixTokens >= cacheRead) {
		// cacheRead 连消息之前的前缀都没覆盖完 —— 断点在消息列表之前，不是某一条消息。
		return {
			kind: "before_messages",
			prefixTokens,
			cacheRead,
			systemChange: diffSystemSegments(previousSegments, currentSegments),
			uncertain: joinNotes(notes),
		};
	}

	let covered = 0;
	let consumed = 0;
	for (const message of currentReal) {
		if (prefixTokens + consumed + message.tokens > cacheRead) break;
		consumed += message.tokens;
		covered += 1;
	}

	// 命中量不可能超过「与上一轮逐条相同的那段」：超出说明估算偏差，收敛到差异点。
	if (divergedAt !== undefined && covered > divergedAt) {
		covered = divergedAt;
		notes.push("按 cacheRead 对齐出的边界落在与上一轮相同的那段之后，已收敛到首个差异处（token 估算偏差）。");
	}

	if (covered >= currentReal.length) {
		return { kind: "all_hit", hitCount: covered, uncertain: joinNotes(notes) };
	}

	const message = currentReal[covered];
	if (message === undefined) {
		// 上面的 covered < currentReal.length 已排除这种可能；留着是为了不用非空断言。
		return { kind: "unknown", note: "逐条清单在断点处意外缺失。" };
	}
	const change = changeAt(previousReal, currentReal, covered);
	if (divergedAt === undefined) {
		notes.push("台账里没有更早的一轮快照，无法比对变化原因。");
	} else if (change === "unknown") {
		notes.push("断点这条与上一轮完全相同 —— 缓存没覆盖到这里的原因在更前面（内容已变或缓存被驱逐）。");
	}
	return { kind: "message", hitCount: covered, message, change, uncertain: joinNotes(notes) };
}
