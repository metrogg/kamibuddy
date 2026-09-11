/**
 * MetaFold 摘要词汇表：一段连续工具卡 → 一行归类摘要（summarizeToolRun）
 * 与主导工具名（leadToolName），机制对标 WorkBuddy。
 *
 * 本文件原本还承载 v1 渲染块流（buildRenderBlocks：回合切分 + 段折叠 +
 * 回合头部/取消占位的块流定位）。轮折叠 + 终答锚点落地后（spec:
 * add-turn-fold-and-anchor），切轮/分段/豁免全部由 renderer/fold-view.ts
 * 的 fold plan 与 renderer/turn-fold.ts 的轮视图接管，v1 块流随之退役——
 * 分段规则只能有一套，两份并存必然漂移。这里保留的是两套折叠共用的
 * 词汇表（fold-view 的批次摘要同样调这两个函数，AGENTS.md §4）。
 */

import type { ToolCard } from "./session-events.ts";

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
