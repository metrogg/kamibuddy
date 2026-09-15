/**
 * 轮折叠 + 终答锚点的纯函数层（机制对标 WorkBuddy MetaFold；
 * spec: .trae/specs/add-turn-fold-and-anchor）。
 *
 * 输入是**一个轮**的条目流——直接复用 shared/session-events.ts 的
 * ConversationEntry（即 shared/conversation.ts 折叠出的块模型，不发明第二套块）；
 * 输出渲染计划，chat-view（Task 2）只持有开合状态并照计划渲染。三个纯函数：
 *
 *   electAnchors      锚点选举：`trim 后最长的所有正文 ∪ 最后一条正文`
 *                     （空文本不参与，连「最后一条」都不算；并列最长全保留）。
 *                     锚点常显，永不折叠。
 *   groupToolBatches  工具分组：连续 ≥2 个工具块成一批（摘要 = 主工具名 + 总数
 *                     + shared/metafold 的归类文案）；孤立单块不成批。折叠段内部与
 *                     顶层（进行中轮）共用这一遍分组，规则只有一套。
 *   buildFoldPlan     轮折叠计划：条目流 + 轮终态 → 每条目的渲染归属。
 *
 * 块分类（WorkBuddy taxonomy 到本模型的映射）：
 *   assistant 正文（trim 非空）   → 锚点候选；非锚点正文是「过程文本」，可折叠
 *   assistant 空文本（纯思考）    → foldable。thinking 与正文同存于 AssistantMessage，
 *                                   没有独立的 thinking 条目，空文本条目即思考块
 *   tool（普通）                  → foldable，参与段折叠批次
 *   tool: show_widget/todo_write  → 豁免。内联产物/活面板折进折叠区就从消息流消失，
 *                                   与 shared/metafold 的处理同口径
 *   error / artifacts_presented   → 豁免。错误卡/产物卡折进折叠区就点不到
 *   user                          → 轮边界，恒 visible
 *   问卷卡在本模型里不是 entries 条目（pendingQuestionnaire 走 IPC 弹层，
 *   在消息流之外），天然处于折叠作用域外，无需豁免分支。
 *
 * 与 shared/metafold.buildRenderBlocks（v1 段折叠）的两点刻意差异：
 *   1. 连续性：这里只有正文/豁免/user 断批，纯思考块**不断批**——WorkBuddy
 *      机制清单里 breaker 只有「正文」，思考是被批次吸收的过程；metafold v1
 *      是任何 assistant 条目都断批。
 *   2. 孤立单块：这里不成批（单个工具调用就是一张卡，没有摘要可省）；
 *      metafold v1 把单卡也收成折叠单元。
 *   摘要文案与主工具名统计直接复用 metafold 的 summarizeToolRun/leadToolName，
 *   两套折叠共用一份词汇表，不各写一遍（AGENTS.md §4）。
 *
 * 轮折叠计划（finished / error）：
 *   首锚点之前的一切 foldable → turn-folded（「已完成 Xs」轮折叠区）；
 *   锚点 → anchor 常显；锚点之间的非锚点 foldable → process-fold（「过程消息」段）；
 *   末锚点之后的 foldable 同样是过程（终答后的 present_files 卡是常态——WorkBuddy
 *   产出 finalOutput 即终止，没有这种尾巴，我们的 harness 有）→ process-fold；
 *   豁免块位置不动（exempt），user 恒 visible。
 *   无正文轮（全工具）：无锚点，一切 foldable 进 turn-folded，头部仍可展开。
 *   无工具纯文本轮：没有过程可折 → 无折叠区（锚点照常标注）。
 * streaming 轮：无锚点、无轮折叠区；顶层照常按批次成组，但只有 shouldFold 为真的
 *   批次（其后出现过正文）才收进折叠容器，正在执行的尾批保持平铺 —— 折叠是墓碑，
 *   活的过程必须可见（判定见 streamingItems）。
 */

import type {
	AssistantMessage,
	ConversationEntry,
	MessageId,
	ToolCard,
} from "@shared/session-events.ts";
import { leadToolName, summarizeToolRun } from "@shared/metafold.ts";

/** 轮的进行/终态。streaming 不折叠；finished 与 error 折叠行为相同（错误卡靠豁免留出）。 */
export type TurnState = "streaming" | "finished" | "error";

/* ── 块分类 ──────────────────────────────────────────────────── */

type BlockClass = "text" | "foldable" | "exempt" | "user";

function classify(entry: ConversationEntry): BlockClass {
	switch (entry.role) {
		case "user":
			return "user";
		case "assistant":
			return entry.text.trim().length > 0 ? "text" : "foldable";
		case "tool":
			return entry.toolName === "show_widget" || entry.toolName === "todo_write"
				? "exempt"
				: "foldable";
		case "error":
		case "artifacts_presented":
			return "exempt";
	}
}

/** 正文块的文本（只有 assistant 的非空文本算 text）；断批点取「相邻正文」用。 */
function bodyText(entry: ConversationEntry): string | undefined {
	return entry.role === "assistant" && classify(entry) === "text" ? entry.text : undefined;
}

/* ── 锚点选举 ────────────────────────────────────────────────── */

/**
 * 锚点 = trim 后最长的所有正文 ∪ 最后一条正文。
 *
 * 没有 isFinal 标记时的启发式（WorkBuddy 同款）：终答通常是最长的一段，
 * 但过程说明可能比终答还长——那种「比终答还长的过程说明」也是用户要看
 * 的内容，并列最长全保留，所以锚点是集合而不是单条。空文本完全不参与
 * （纯思考块不该靠「最后一条」混成锚点）。
 */
export function electAnchors(blocks: readonly ConversationEntry[]): ReadonlySet<MessageId> {
	const lengths = new Map<MessageId, number>();
	let maxLen = 0;
	let lastId: MessageId | undefined;
	for (const entry of blocks) {
		if (entry.role !== "assistant") continue;
		const len = entry.text.trim().length;
		if (len === 0) continue;
		lengths.set(entry.id, len);
		if (len > maxLen) maxLen = len;
		lastId = entry.id;
	}
	const anchors = new Set<MessageId>();
	for (const [id, len] of lengths) {
		if (len === maxLen) anchors.add(id);
	}
	if (lastId !== undefined) anchors.add(lastId);
	return anchors;
}

/* ── 段折叠分组 ──────────────────────────────────────────────── */

/**
 * 一个工具组：连续 ≥2 个 foldable 单元的批次。折叠段内部的批次条与进行中轮的
 * 顶层组是同一件事（同一遍 groupToolBatches 产出），字段共用一份，不各写一遍。
 */
export interface ToolGroup {
	/** 组 id 取首卡 id：toolCallId 由 pi 保证唯一，天然稳定（metafold 同款）。 */
	readonly id: string;
	/** 组覆盖的原始条目序列（工具卡 + 夹在其中的思考块），展开时按此渲染。 */
	readonly entries: readonly ConversationEntry[];
	readonly cards: readonly ToolCard[];
	/** 组内调用次数最多的工具名；图标映射是渲染侧的事（shared 不装渲染资产）。 */
	readonly leadName: string;
	readonly totalCount: number;
	/** 组头文案（摘要 / 意图标题），措辞由 shared/metafold 的词汇表决定，这里不拼。 */
	readonly summary: string;
}

export type ToolBatchItem =
	| ({ readonly kind: "batch" } & ToolGroup)
	| { readonly kind: "block"; readonly entry: ConversationEntry };

/**
 * 连续 ≥2 个工具块成批；孤立单块与不足两块的尾巴按原序列平铺。
 *
 * 连续性：正文（text）/豁免/user 断批；纯思考块不断批——思考是夹在工具
 * 调用之间的过程，被批次吸收（批次 entries 里保留它，展开时原位可见）。
 *
 * 相邻正文：每一批把「紧邻的正文」交给 summarizeToolRun 当主题兜底
 * （入参字段取不到主题时才用得上，见 shared/metafold）。取值**批前优先，
 * 批后兜底**；两者都在同一次单遍扫描里顺手记下，不做任何回扫（这段在流式
 * 主渲染路径上，性能敏感）。
 *
 * 为什么批前优先：批间那句正文是**过渡句** —— 对上一批它是「结果/解释」，
 * 对**下一批**才是「引子/意图」。`[批1] 正文A [批2]` 里的正文A 正是读作
 * 「因为发现了 X，所以要 Y」，那就是批2 的意图；反之取批后取到的是**上一批
 * 的结果**，实测会把「依赖装好了」「没找到相关的配置文件」「看起来这个方案
 * 有性能问题」这类结果/评价句当成主题。本组头要的是**意图**标题（spec 的
 * Scenario），所以批前的那句更贴合语义。
 *
 * 这里**有意偏离** WorkBuddy：它取批后优先，证据
 * `docs/WorkBuddy-reference/extracted/renderer/assets/lib-chat-ui-ChIVprRk.js:227346`
 * —— `segmentBodyText(segments[i + 1]) ?? segmentBodyText(segments[i - 1])`
 * （同文件 :227006-227009 的 deriveTopic 是「入参对象 → 相邻正文」两级降级序，
 * 与前后侧的选择无关）。WorkBuddy 那侧疑似**实现便利**而非设计：它的 flush 是
 * 被 text 触发的，手边正好是刚遇到的那段正文，取批后最省事。
 *
 * 兜底保留：轮首的第一批前面没有正文（它前面是 user 消息，user 是轮边界、
 * 不在本轮的 blocks 里），此时退回批后的正文 —— 否则该批会丢掉唯一的线索。
 * 批后也没有（被豁免卡断批、或轮到批尾就结束了）时退回无主题形态。
 *
 * 注意：这里的「相邻」以**本次调用的入参切片**为准。顶层（streamingItems）
 * 传的是整轮 blocks，能看见全轮正文；折叠段内（chat-view 的
 * renderSegmentEntries）传的是段内条目，故段外紧邻的锚点正文看不见——
 * 这是有意的：锚点是终答/重点正文，不是过程叙述，不该当组头主题。
 */
export function groupToolBatches(blocks: readonly ConversationEntry[]): readonly ToolBatchItem[] {
	const items: ToolBatchItem[] = [];
	let runEntries: ConversationEntry[] = [];
	let runCards: ToolCard[] = [];
	/** 本批之前最近的一条正文（本批的主题首选；过渡句对下一批是引子/意图）。 */
	let beforeText: string | undefined;

	const flush = (afterText: string | undefined): void => {
		if (runCards.length >= 2) {
			items.push({
				kind: "batch",
				id: `batch-${runCards[0]?.id ?? "0"}`,
				entries: runEntries,
				cards: runCards,
				leadName: leadToolName(runCards),
				totalCount: runCards.length,
				summary: summarizeToolRun(runCards, beforeText ?? afterText),
			});
		} else {
			for (const entry of runEntries) items.push({ kind: "block", entry });
		}
		runEntries = [];
		runCards = [];
	};

	for (const entry of blocks) {
		if (classify(entry) === "foldable") {
			runEntries.push(entry);
			if (entry.role === "tool") runCards.push(entry);
			continue;
		}
		// 断批的这一条若正是正文，它是本批的批后正文（批前取不到时的兜底）。
		const body = bodyText(entry);
		flush(body);
		items.push({ kind: "block", entry });
		// 正文同时成为下一批的「批前相邻正文」。
		if (body !== undefined) beforeText = body;
	}
	flush(undefined);
	return items;
}

/* ── 轮折叠计划 ──────────────────────────────────────────────── */

export type FoldPlanItem =
	/**
	 * 顶层工具组：连续 ≥2 个 foldable 单元的批次，收成一行组头（与折叠段内部的
	 * 批次条共用同一张渲染外壳）。streaming 轮里只有 shouldFold 的批次是这个 kind。
	 */
	| ({ readonly kind: "tool-group" } & ToolGroup)
	/** 进「已完成 Xs」轮折叠区的一段连续 foldable 条目。 */
	| { readonly kind: "turn-folded"; readonly id: string; readonly entries: readonly ConversationEntry[] }
	/** 锚点之间的「过程消息」折叠段。 */
	| { readonly kind: "process-fold"; readonly id: string; readonly entries: readonly ConversationEntry[] }
	/** 锚点正文，常显。 */
	| { readonly kind: "anchor"; readonly entry: AssistantMessage }
	/** 豁免块（错误卡/产物卡/内联产物/活面板），位置不动。 */
	| { readonly kind: "exempt"; readonly entry: ConversationEntry }
	/** 常规可见（user、无折叠区轮里的条目、进行中轮里未成组的条目——含等正文的尾批）。 */
	| { readonly kind: "visible"; readonly entry: ConversationEntry };

export interface FoldPlan {
	readonly items: readonly FoldPlanItem[];
	/** 本轮选出的锚点（assistant 消息 id）。streaming 轮恒为空集——选举在流式中无意义。 */
	readonly anchors: ReadonlySet<MessageId>;
	/** 是否存在「已完成」轮折叠区（TurnHeader 是否可点击展开过程的依据）。 */
	readonly hasTurnFold: boolean;
}

/**
 * 进行中轮的顶层计划：顶层同样成组，但只有 shouldFold 的批次才进折叠容器。
 *
 * shouldFold = **其后出现过正文** || **整轮已结束**（WorkBuddy buildSegments
 * ~:227352 `seg.shouldFold = bodyTextAfter || turnFinished`）。流式轮的「整轮已结束」
 * 恒为假，只剩「其后出现过正文」一条 —— 从后往前判定等价于「组末条目在最后一条正文
 * 之前」，因为正文是唯一断组边界（classify 的 text），最后一条正文之后的一切都在等
 * 正文，正在执行的尾批自然落在里面。
 *
 * shouldFold 为假的批次（其后还没正文、轮未结束）**不进折叠容器**，按原序平铺：
 * WorkBuddy 的 applySummaryFolds 对 `!shouldFold` 的段直接 continue，段内单元留在
 * 顶层、没有组头。工具还在跑的时候，用户要看到的是逐条进度，不是一个还没到点的摘要。
 *
 * 组 id 与折叠段内的批次条同源（groupToolBatches 取首卡 id）：
 *   1. 组 id 只由 toolCallId 派生，流式增量（追加卡片/追加文本）不改 id ——
 *      手点展开态在组的整个生命周期内不会被刷新重置（foldOpen 按 id 记忆）；
 *   2. 轮结束转 finished 计划后，同一批在折叠段里仍是同一个 id，展开态自然延续；
 *   3. 新轮的 toolCallId 全新，旧 id 不会再出现 → 新轮的组天然是默认收起。
 */
function streamingItems(blocks: readonly ConversationEntry[]): FoldPlanItem[] {
	const items: FoldPlanItem[] = [];
	/** 本轮最后一条正文的位置；-1 = 还没有正文（一切批次都还在等正文）。 */
	const lastTextIndex = blocks.findLastIndex((entry) => classify(entry) === "text");
	const flatten = (entry: ConversationEntry): FoldPlanItem =>
		classify(entry) === "exempt" ? { kind: "exempt", entry } : { kind: "visible", entry };
	// 分组保序且覆盖全部条目，所以按消费长度推进游标即可换算「组末条目的下标」。
	let cursor = 0;
	for (const item of groupToolBatches(blocks)) {
		if (item.kind === "block") {
			cursor += 1;
			items.push(flatten(item.entry));
			continue;
		}
		const lastIndex = cursor + item.entries.length - 1;
		cursor += item.entries.length;
		if (lastIndex > lastTextIndex) {
			for (const entry of item.entries) items.push(flatten(entry));
			continue;
		}
		items.push({ ...item, kind: "tool-group" });
	}
	return items;
}

/**
 * 条目流 + 轮终态 → 渲染计划。
 *
 * 计划的形态完全由 turnState 与锚点位置决定，不持有任何开合状态——
 * 「默认折叠、点击展开」是渲染侧按 turn id / 组 id 记忆的视图态（Task 2），
 * 这一层只回答「每条目属于哪个渲染区」。
 */
export function buildFoldPlan(
	blocks: readonly ConversationEntry[],
	turnState: TurnState,
): FoldPlan {
	// 未结束轮：无锚点、无轮折叠区；顶层按批次成组，等正文的尾批保持平铺。
	if (turnState === "streaming") {
		return {
			items: streamingItems(blocks),
			anchors: new Set<MessageId>(),
			hasTurnFold: false,
		};
	}

	const anchors = electAnchors(blocks);
	/** 只有带正文的 assistant 可能是锚点（空文本进不了 anchors 集），窄化交给判别联合。 */
	const asAnchor = (entry: ConversationEntry): AssistantMessage | undefined =>
		entry.role === "assistant" && anchors.has(entry.id) ? entry : undefined;

	// 无工具轮（纯文本/纯思考）没有过程可折：锚点照常标注，但不产生折叠区。
	const hasFoldableTools = blocks.some((e) => e.role === "tool" && classify(e) === "foldable");
	if (!hasFoldableTools) {
		return {
			items: blocks.map((entry): FoldPlanItem => {
				const anchor = asAnchor(entry);
				if (anchor !== undefined) return { kind: "anchor", entry: anchor };
				return classify(entry) === "exempt"
					? { kind: "exempt", entry }
					: { kind: "visible", entry };
			}),
			anchors,
			hasTurnFold: false,
		};
	}

	const items: FoldPlanItem[] = [];
	let run: ConversationEntry[] = [];
	/** 是否已越过首锚点：之前的 foldable 归轮折叠区，之后的归过程消息段。 */
	let pastFirstAnchor = false;

	const flush = (): void => {
		const first = run[0];
		if (first === undefined) return;
		items.push(
			pastFirstAnchor
				? { kind: "process-fold", id: `process-${first.id}`, entries: run }
				: { kind: "turn-folded", id: `turnfold-${first.id}`, entries: run },
		);
		run = [];
	};

	for (const entry of blocks) {
		const anchor = asAnchor(entry);
		if (anchor !== undefined) {
			flush();
			pastFirstAnchor = true;
			items.push({ kind: "anchor", entry: anchor });
			continue;
		}
		const cls = classify(entry);
		if (cls === "user") {
			flush();
			items.push({ kind: "visible", entry });
			continue;
		}
		// 豁免块位置不动：打断折叠段，原位输出——折叠区被它隔开也不挪它。
		if (cls === "exempt") {
			flush();
			items.push({ kind: "exempt", entry });
			continue;
		}
		// foldable（工具/纯思考）与非锚点正文（过程文本）进当前折叠段。
		run.push(entry);
	}
	flush();

	return { items, anchors, hasTurnFold: items.some((item) => item.kind === "turn-folded") };
}
