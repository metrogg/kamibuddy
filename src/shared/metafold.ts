/**
 * MetaFold 过程折叠（机制对标 WorkBuddy）：一轮对话结束后，中间的
 * 「过程消息」（连续工具调用序列）折叠成一行摘要 + chevron，点击展开、
 * 再点击收起。进行中的回合不折叠 —— 折叠是「墓碑」，活的过程必须可见。
 *
 * 纯函数层：chat-view 把 entries 过一遍 buildRenderBlocks 得到渲染块流，
 * 组件只做块的开关状态持有，分组/摘要逻辑全部可脱离 React 单测。
 *
 * 折叠口径：
 *   - 按 user 消息把 entries 切成「回合」（user 消息及其后直到下一条 user）。
 *   - 已完成回合内，**连续**的 tool 条目归为一个折叠单元；assistant 消息
 *     会打断连续性 —— 工具-文本-工具是两段，各自成一个折叠单元。
 *   - 进行中的回合（最后一条 user 消息所在回合且会话流式中）不折叠，
 *     工具卡原样平铺。
 *   - 思考块、产物卡区不属于 tool 条目，天然不参与折叠。
 *
 * 回合头部与「用户已取消」指示行的插入也一并纳入块流（turn-header /
 * cancelled 块）：它们的定位规则（user 之后、回合末尾）本来就要按回合
 * 边界判定，和折叠分组共享同一遍扫描，渲染侧就不必再开第二套下标推算。
 * 视觉位置与原实现一致：header 紧跟 user 消息之后，cancelled 在回合末尾。
 */

import type { ConversationEntry, ErrorEntry, MessageId, ToolCard } from "./session-events.ts";

/**
 * 渲染块：消息流的线性渲染单元。
 * entry       —— 原样渲染的单条消息（user / assistant / 进行中回合的 tool）。
 * fold        —— 一个折叠单元：一行摘要，展开后是 cards 原序列。
 *               leadIcon 是段内调用次数最多的**工具名**（不是图标本身）——
 *               shared 层不能 import 渲染资产，工具名→图标的映射在渲染侧做。
 * error       —— 错误卡（ErrorEntry 单列一块）：渲染料与消息不同（图标/runId/重试），
 *               不混进 entry 块让渲染侧逐条窄化。
 * turn-header —— 回合头部占位（agent 名 + 计时），userId 指向回合的 user 消息。
 * cancelled   —— 「用户已取消」指示行占位，userId 指向被取消回合的 user 消息。
 */
export type RenderBlock =
	// error 条目单列 error 块（见上），entry 块在类型上把它排除 ——
	// 渲染侧 user/tool 分流后剩的就是 AssistantMessage，窄化由类型保证而非注释。
	| { readonly kind: "entry"; readonly entry: Exclude<ConversationEntry, ErrorEntry> }
	| {
			readonly kind: "fold";
			readonly id: string;
			readonly summary: string;
			readonly leadIcon: string;
			readonly cards: readonly ToolCard[];
	  }
	| { readonly kind: "error"; readonly entry: ErrorEntry }
	| { readonly kind: "turn-header"; readonly userId: MessageId }
	| { readonly kind: "cancelled"; readonly userId: MessageId };

export interface MetaFoldOptions {
	/** 会话是否流式中：进行中的回合（最后一条 user 消息所在回合）不折叠。 */
	readonly streaming: boolean;
	/** 被取消回合的起始 user 消息 id：回合末尾补一个 cancelled 占位块。 */
	readonly cancelledTurns?: readonly MessageId[];
}

/* ── 摘要生成 ──────────────────────────────────────────────────── */

/**
 * 工具名 → 动作归类。verb 是面向用户的动作词（自创文案，合规红线见
 * AGENTS.md §6），unit 决定计数单位 —— 「读取 3 个命令」这种错配
 * 就是单位不分类型造成的。
 */
interface ActionSpec {
	readonly verb: string;
	readonly unit: "个文件" | "个目录" | "个命令" | "个网页" | "个产物" | "次";
}

/** 归类聚合按 spec 对象引用判等 —— 同 verb+unit 的工具必须共享同一个
    对象才能合并计数（bash/powershell 都是「运行 … 个命令」）。 */
const RUN_COMMAND: ActionSpec = { verb: "运行", unit: "个命令" };

const ACTIONS: Readonly<Record<string, ActionSpec>> = {
	read: { verb: "读取", unit: "个文件" },
	write: { verb: "写入", unit: "个文件" },
	edit: { verb: "修改", unit: "个文件" },
	ls: { verb: "列出", unit: "个目录" },
	grep: { verb: "搜索内容", unit: "次" },
	find: { verb: "查找文件", unit: "次" },
	bash: RUN_COMMAND,
	powershell: RUN_COMMAND,
	web_search: { verb: "搜索网页", unit: "次" },
	web_fetch: { verb: "读取", unit: "个网页" },
	present_files: { verb: "交付", unit: "个产物" },
};

/** 路径摘要取 basename（正/反斜杠都兼容），供「写入 snake.html 等 2 个文件」的主题位。 */
function basename(summary: string): string {
	return summary.split(/[\\/]/).pop() ?? summary;
}

interface ActionGroup {
	readonly spec: ActionSpec;
	count: number;
	/** 组内第一张带摘要的卡片的 basename，单一类型摘要的主题位。 */
	subject: string | undefined;
}

/**
 * 把一段连续工具卡归类成一行摘要。
 *
 * 规则：
 *   - 按 verb+unit 聚合（bash 与 powershell 同为「运行 … 个命令」，合并计数），
 *     组序按首次出现，形如「读取 3 个文件、写入 2 个文件」。
 *   - 整段只有**一个**已知归类且无未知工具时允许带主题（组内首卡的
 *     basename）：多张「写入 snake.html 等 2 个文件」，单张「写入 snake.html」。
 *     主题只对「个文件」单位生效 —— 「搜索内容 src/index.ts 等 3 次」读不通。
 *   - 未知工具：与已知归类混合时计作「使用工具 N 次」殿后；
 *     整段全是未知工具时兜底「N 个工具调用」。
 */
export function summarizeToolRun(cards: readonly ToolCard[]): string {
	const groups: ActionGroup[] = [];
	let unknownCount = 0;
	for (const card of cards) {
		const spec = ACTIONS[card.toolName];
		if (spec === undefined) {
			unknownCount += 1;
			continue;
		}
		let group = groups.find((g) => g.spec === spec);
		if (group === undefined) {
			group = { spec, count: 0, subject: undefined };
			groups.push(group);
		}
		group.count += 1;
		if (group.subject === undefined && card.summary !== "") {
			group.subject = basename(card.summary);
		}
	}

	if (groups.length === 0) return `${unknownCount} 个工具调用`;

	const single = groups.length === 1 && unknownCount === 0 ? groups[0] : undefined;
	const parts = groups.map((group) => {
		const { verb, unit } = group.spec;
		// 带主题只给「个文件」单位：路径 basename 只在文件语义下成立。
		if (group === single && unit === "个文件" && group.subject !== undefined) {
			return group.count === 1
				? `${verb} ${group.subject}`
				: `${verb} ${group.subject} 等 ${group.count} ${unit}`;
		}
		return `${verb} ${group.count} ${unit}`;
	});
	if (unknownCount > 0) parts.push(`使用工具 ${unknownCount} 次`);
	return parts.join("、");
}

/**
 * 段内调用次数最多的工具名，折叠行行首主导图标的依据（WorkBuddy
 * computeTopToolName 同思路）。返回值只是工具名 —— 图标映射是渲染侧的事。
 *
 * 平局保留先达到最高次数者（按段内出现序推进，结果稳定可测）。
 * bash/powershell 不像摘要那样合并计数：二者在渲染侧映射成同一个终端图标，
 * 这里拆开统计不影响最终视觉。
 */
export function leadToolName(cards: readonly ToolCard[]): string {
	const counts = new Map<string, number>();
	let lead = "";
	let max = 0;
	for (const card of cards) {
		const n = (counts.get(card.toolName) ?? 0) + 1;
		counts.set(card.toolName, n);
		if (n > max) {
			max = n;
			lead = card.toolName;
		}
	}
	return lead;
}

/* ── 分组与块流 ────────────────────────────────────────────────── */

/**
 * 把会话 entries 折叠成渲染块流。
 *
 * 扫描中维护一个 tool 缓冲区：遇到非 tool 条目（或回合边界）时 flush ——
 * 进行中回合原样倒出（entry 块），已完成回合归并为一个 fold 块。
 * 回合边界处同时处理 turn-header（user 之后）与 cancelled（回合末尾）占位。
 */
export function buildRenderBlocks(
	entries: readonly ConversationEntry[],
	options: MetaFoldOptions,
): RenderBlock[] {
	const { streaming, cancelledTurns = [] } = options;
	const lastUserIndex = entries.findLastIndex((e) => e.role === "user");
	const lastUserId = lastUserIndex >= 0 ? entries[lastUserIndex]?.id : undefined;

	const blocks: RenderBlock[] = [];
	let toolBuffer: ToolCard[] = [];
	/** 当前条目所属回合的 user 消息 id；首个 user 之前为 undefined（无前缀回合）。 */
	let turnUserId: MessageId | undefined;

	/** 进行中的回合 = 最后一条 user 消息所在回合且流式中。 */
	const inProgress = (): boolean =>
		streaming && turnUserId !== undefined && turnUserId === lastUserId;

	const flushTools = (): void => {
		if (toolBuffer.length === 0) return;
		if (inProgress()) {
			for (const card of toolBuffer) blocks.push({ kind: "entry", entry: card });
		} else {
			// 折叠单元 id 取首卡 id：toolCallId 由 pi 保证唯一，天然稳定。
			const first = toolBuffer[0];
			blocks.push({
				kind: "fold",
				id: `fold-${first?.id ?? "0"}`,
				summary: summarizeToolRun(toolBuffer),
				leadIcon: leadToolName(toolBuffer),
				cards: toolBuffer,
			});
		}
		toolBuffer = [];
	};

	/** 回合收尾：flush 工具缓冲，被取消的回合末尾补 cancelled 占位块。 */
	const closeTurn = (): void => {
		flushTools();
		if (turnUserId !== undefined && cancelledTurns.includes(turnUserId)) {
			blocks.push({ kind: "cancelled", userId: turnUserId });
		}
	};

	for (const entry of entries) {
		if (entry.role === "user") {
			closeTurn();
			blocks.push({ kind: "entry", entry });
			// 回合头部紧跟 user 消息之后 —— user 是最后一条时它自然落在流尾，
			// 与原实现的 headerHere/trailingHeader 两个插入点口径一致。
			blocks.push({ kind: "turn-header", userId: entry.id });
			turnUserId = entry.id;
			continue;
		}
		if (entry.role === "tool") {
			/*
			 * show_widget 是内联可视化块，不是「过程」：折进「读取 1 个文件、
			 * 使用工具 1 次」里图表就从消息流消失了，而它本身就是要给用户看的
			 * 产物 —— 与 assistant 消息同待遇：打断工具连续性并单独成块
			 * （渲染侧按 toolName 走 WidgetView，不走 ToolEntry）。
			 * todo_write 同待遇：渲染侧投影（renderer/todo-projection.ts）已把
			 * 多次调用合成一张「活」的清单卡，折进墓碑折叠单元后进度面板就从
			 * 消息流消失了（渲染侧走 TodoListCard，不走 ToolEntry）。
			 */
			if (entry.toolName === "show_widget" || entry.toolName === "todo_write") {
				flushTools();
				blocks.push({ kind: "entry", entry });
				continue;
			}
			toolBuffer.push(entry);
			continue;
		}
		flushTools();
		// 错误打断工具连续性（同 assistant）：留在出错位置，新回合开始后不挪位。
		if (entry.role === "error") {
			blocks.push({ kind: "error", entry });
			continue;
		}
		blocks.push({ kind: "entry", entry });
	}
	closeTurn();

	return blocks;
}
