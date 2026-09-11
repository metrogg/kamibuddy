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
 *   groupToolBatches  段折叠分组：连续 ≥2 个工具块成一批（摘要 = 主工具名 + 总数
 *                     + shared/metafold 的归类文案）；孤立单块不成批。
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
 * streaming 轮：全展开计划（visible/exempt）——折叠是墓碑，活的过程必须可见。
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

export type ToolBatchItem =
	| {
			readonly kind: "batch";
			/** 批次 id 取首卡 id：toolCallId 由 pi 保证唯一，天然稳定（metafold 同款）。 */
			readonly id: string;
			/** 批次覆盖的原始条目序列（工具卡 + 夹在其中的思考块），展开时按此渲染。 */
			readonly entries: readonly ConversationEntry[];
			readonly cards: readonly ToolCard[];
			/** 批次内调用次数最多的工具名；图标映射是渲染侧的事（shared 不装渲染资产）。 */
			readonly leadName: string;
			readonly totalCount: number;
			/** 归类摘要文案（「读取 3 个文件、写入 1 个文件」），复用 metafold 词汇表。 */
			readonly summary: string;
	  }
	| { readonly kind: "block"; readonly entry: ConversationEntry };

/**
 * 连续 ≥2 个工具块成批；孤立单块与不足两块的尾巴按原序列平铺。
 *
 * 连续性：正文（text）/豁免/user 断批；纯思考块不断批——思考是夹在工具
 * 调用之间的过程，被批次吸收（批次 entries 里保留它，展开时原位可见）。
 */
export function groupToolBatches(blocks: readonly ConversationEntry[]): readonly ToolBatchItem[] {
	const items: ToolBatchItem[] = [];
	let runEntries: ConversationEntry[] = [];
	let runCards: ToolCard[] = [];

	const flush = (): void => {
		if (runCards.length >= 2) {
			items.push({
				kind: "batch",
				id: `batch-${runCards[0]?.id ?? "0"}`,
				entries: runEntries,
				cards: runCards,
				leadName: leadToolName(runCards),
				totalCount: runCards.length,
				summary: summarizeToolRun(runCards),
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
		flush();
		items.push({ kind: "block", entry });
	}
	flush();
	return items;
}

/* ── 轮折叠计划 ──────────────────────────────────────────────── */

export type FoldPlanItem =
	/** 进「已完成 Xs」轮折叠区的一段连续 foldable 条目。 */
	| { readonly kind: "turn-folded"; readonly id: string; readonly entries: readonly ConversationEntry[] }
	/** 锚点之间的「过程消息」折叠段。 */
	| { readonly kind: "process-fold"; readonly id: string; readonly entries: readonly ConversationEntry[] }
	/** 锚点正文，常显。 */
	| { readonly kind: "anchor"; readonly entry: AssistantMessage }
	/** 豁免块（错误卡/产物卡/内联产物/活面板），位置不动。 */
	| { readonly kind: "exempt"; readonly entry: ConversationEntry }
	/** 常规可见（user、无折叠区轮里的条目、进行中轮的一切）。 */
	| { readonly kind: "visible"; readonly entry: ConversationEntry };

export interface FoldPlan {
	readonly items: readonly FoldPlanItem[];
	/** 本轮选出的锚点（assistant 消息 id）。streaming 轮恒为空集——选举在流式中无意义。 */
	readonly anchors: ReadonlySet<MessageId>;
	/** 是否存在「已完成」轮折叠区（TurnHeader 是否可点击展开过程的依据）。 */
	readonly hasTurnFold: boolean;
}

/**
 * 条目流 + 轮终态 → 渲染计划。
 *
 * 计划的形态完全由 turnState 与锚点位置决定，不持有任何开合状态——
 * 「默认折叠、点击展开」是渲染侧按 turn id 记忆的视图态（Task 2），
 * 这一层只回答「每条目属于哪个渲染区」。
 */
export function buildFoldPlan(
	blocks: readonly ConversationEntry[],
	turnState: TurnState,
): FoldPlan {
	// 未结束轮：全展开计划。折叠是墓碑，活的过程必须可见。
	if (turnState === "streaming") {
		return {
			items: blocks.map((entry): FoldPlanItem =>
				classify(entry) === "exempt" ? { kind: "exempt", entry } : { kind: "visible", entry },
			),
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
