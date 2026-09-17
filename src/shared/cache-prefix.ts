/**
 * 命中前缀边界反推（CACHE6，依赖 LOG13 的逐条消息稳定标识）。
 *
 * provider 的前缀缓存按**最长公共前缀**匹配，API 只回一个 `cacheRead` 计数，
 * 不告诉你它断在哪一条上。能反推的依据有两层：
 *
 *   1. **token 对齐**：把本轮请求的逐条消息 token 估算累加（消息之前还有一段固定
 *      前缀：系统提示词 + 工具定义），与 `cacheRead` 对齐 —— 边界就落在某一条消息上
 *      （前 N 条命中、第 N+1 条起未命中）；
 *   2. **逐条 diff**：用消息的稳定 id + 内容指纹（MessageRef）与上一轮逐条比对，
 *      说出「为什么断」（第 N+1 条是新增 / 内容变了 / 位置变了）。
 *
 * **前提与局限（结论是方向性的，不是账单）**：
 *   - token 是**字符估算**（core/observability.ts 的 estimateTokens），不是真 tokenizer；
 *   - 消息之前那段前缀（系统提示词 / 工具定义）没有逐条 token 明细，只能拿**上一轮**
 *     的 `billedInputTokens` 减去上一轮消息估算总量来反推定标（previousPromptTokens）。
 *     上一轮的前缀与这一轮不一致时（改了两轴 / 换了工具集），定标本身就偏；
 *   - 因此对齐结果自带一个消息条数量级的误差。函数如实报告：与上一轮的**确定性**
 *     差异位置（id + 指纹比对，不含估算）对不上时收敛到差异点并给出 uncertain。
 *
 * 依赖方向：本文件零运行时依赖（不 import pi、不 import electron），
 * 供 renderer 的诊断面板直接消费（AGENTS.md §1.3：renderer 只 import shared）。
 */

import type { MessageRef } from "./observability.ts";

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
 * 反推结果：可判别联合，每种形态对应面板上一句能直说的话。
 * 边界无法确定时**不编数**——走 `unknown`，或给如实算出的边界配上 `uncertain` 说明。
 */
export type CachePrefixBoundary =
	/** 消息列表之前的固定前缀就没命中（系统提示词 / 工具定义变了，即 CACHE8 的情形）。 */
	| {
			readonly kind: "before_messages";
			/** 消息之前那段前缀的 token 估算（定标而来，见文件头）。 */
			readonly prefixTokens: number;
			readonly cacheRead: number;
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
 */
export function inferCachePrefixBreak(args: {
	readonly previous: readonly MessageRef[] | undefined;
	readonly previousPromptTokens: number | undefined;
	readonly current: readonly MessageRef[];
	readonly cacheRead: number | undefined;
}): CachePrefixBoundary {
	const { previous, previousPromptTokens, current, cacheRead } = args;
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
	// 差异位置是确定的（id + 指纹比对），估算对齐不是 —— 它既是归因依据，也是兜底。
	const divergedAt = firstDivergence(previous, current);

	// 定标「消息之前那段前缀」：上一轮的真实 prompt token 总量 − 上一轮消息的估算
	// 总量。差值里既有系统提示词与工具定义，也吸收了估算的系统性偏差，所以比
	// 单独估算系统提示词更接近 provider 看到的口径。
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
		return { kind: "before_messages", prefixTokens, cacheRead, uncertain: joinNotes(notes) };
	}

	let covered = 0;
	let consumed = 0;
	for (const message of current) {
		if (prefixTokens + consumed + message.tokens > cacheRead) break;
		consumed += message.tokens;
		covered += 1;
	}

	// 命中量不可能超过「与上一轮逐条相同的那段」：超出说明估算偏差，收敛到差异点。
	if (divergedAt !== undefined && covered > divergedAt) {
		covered = divergedAt;
		notes.push("按 cacheRead 对齐出的边界落在与上一轮相同的那段之后，已收敛到首个差异处（token 估算偏差）。");
	}

	if (covered >= current.length) {
		return { kind: "all_hit", hitCount: covered, uncertain: joinNotes(notes) };
	}

	const message = current[covered];
	if (message === undefined) {
		// 上面的 covered < current.length 已排除这种可能；留着是为了不用非空断言。
		return { kind: "unknown", note: "逐条清单在断点处意外缺失。" };
	}
	const change = changeAt(previous, current, covered);
	if (divergedAt === undefined) {
		notes.push("台账里没有更早的一轮快照，无法比对变化原因。");
	} else if (change === "unknown") {
		notes.push("断点这条与上一轮完全相同 —— 缓存没覆盖到这里的原因在更前面（内容已变或缓存被驱逐）。");
	}
	return { kind: "message", hitCount: covered, message, change, uncertain: joinNotes(notes) };
}
