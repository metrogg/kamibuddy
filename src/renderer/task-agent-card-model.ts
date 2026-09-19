/**
 * task-agent-card 的展示模型（纯函数，可单测）。
 *
 * 为什么单拆一个模块：`@vitejs/plugin-react` 要求 `.tsx` 只导出 React 组件，
 * 否则该文件的热更会退化（Fast Refresh 警告 → 整页重载）。纯函数与它们的类型
 * 搬到这里，组件文件只导出组件；类型在运行期被擦除，放哪都不触发该警告。
 */

import type { SubagentStatus, ToolCard } from "@shared/session-events.ts";

/**
 * 分组行的展示模型（从 SubagentStatus 派生的纯数据）。
 *
 * 抽成纯函数的原因：renderer 没有组件测试基建（只有纯函数测试先例），
 * 「每行显示什么字、什么状态」是这张卡最易回归的逻辑，钉在单测里。
 */
export interface AgentRowView {
	readonly status: SubagentStatus["status"];
	/** 动作行文本：等待中 / 最新动作 / 已完成 N 轮 / 失败诊断。 */
	readonly action: string;
	/** 动作行是否扫光（仅 running —— 扫光是全局唯一「进行中」语言）。 */
	readonly live: boolean;
	/** done 组的可展开输出（非 done 或空输出为 undefined）。 */
	readonly output?: string;
}

/** 单个子代理状态 → 分组行展示模型。 */
export function deriveAgentRow(agent: SubagentStatus): AgentRowView {
	switch (agent.status) {
		case "queued":
			return { status: "queued", action: "等待中", live: false };
		case "running":
			// activity 无进展时为空串（契约），动作行不能留白。
			return { status: "running", action: agent.activity !== "" ? agent.activity : "执行中…", live: true };
		case "done":
			return {
				status: "done",
				action: `已完成 ${agent.turns} 轮`,
				live: false,
				// 空输出不挂展开入口（点了展开也是空盒，反而像坏了）。
				output: agent.output !== undefined && agent.output !== "" ? agent.output : undefined,
			};
		case "failed":
			// output 是失败诊断（契约）；类型上可选，缺席时交代一句不空行。
			return { status: "failed", action: agent.output ?? "执行失败", live: false };
	case "interrupted":
		// 中断（spec: add-team-interrupt-diagnostics 批次 ①）：动作行要说清
		// 三件事 —— 上次跑到哪、产出还在不在、下一步该做什么。只写「已中断」
		// 用户不知道要不要去捞产出，那就是把诊断信号浪费掉了。
		//
		// 拉模式（spec: add-team-pull-model 批次 ④）：判据从注册表的
		// `pendingDelivery` 标记换成**从会话文件派生的 `outputAvailable`** ——
		// 文件在就说明产出在，这比「上次登记过一个标记」可靠得多（标记会随
		// 进程一起没，文件不会）。
		if (agent.outputAvailable === true) {
			return {
				status: "interrupted",
				action: "上次那一轮已跑完、产出还在（在它的会话记录里）；可去取回，不必重跑",
				live: false,
			};
		}
		return {
			status: "interrupted",
			action:
				agent.turns > 0
					? `上次运行中随进程中断（已跑 ${agent.turns} 轮）`
					: "上次运行中随进程中断",
			live: false,
		};
	}
}

/** 默认展开判定：运行中（outcome 未落定）默认展开，终态默认折叠。 */
export function defaultOpenOf(outcome: ToolCard["outcome"]): boolean {
	return outcome === undefined;
}

/** 成员计数行：N 轮 · M 次工具 · X tok · $Y（成员投影才带计数键）。 */
function memberMetaLine(agent: SubagentStatus): string | undefined {
	if (agent.toolCalls === undefined && agent.tokens === undefined && agent.cost === undefined) {
		return undefined;
	}
	const parts = [`${agent.turns} 轮`];
	if (agent.toolCalls !== undefined) parts.push(`${agent.toolCalls} 次工具`);
	if (agent.tokens !== undefined) parts.push(`${Math.round(agent.tokens / 100) / 10}k tok`);
	if (agent.cost !== undefined && agent.cost > 0) parts.push(`$${agent.cost.toFixed(2)}`);
	return parts.join(" · ");
}

/**
 * 行的右对齐计数（纯函数，可单测）。
 *
 * 成员保持现状（轮/工具/tok/费用一起给）；普通子代理没有任何计数键，只给轮数
 * —— 且**只在非零时给**（`0 轮` 是噪音，与 teamBarRows 同口径：计数是「它真的
 * 在干活」的信号，不是占位符）。
 */
export function agentMetaLine(agent: SubagentStatus): string | undefined {
	const line = memberMetaLine(agent);
	if (line !== undefined) return line;
	return agent.turns > 0 ? `${agent.turns} 轮` : undefined;
}

/**
 * 动作行的落点（纯函数，可单测）。
 *
 * 为什么不再常驻行内第三行：动作行过去挤在名字下面，把行撑高三层。
 *
 * 落点按「这句话还有没有行动价值」分三档：
 *   - **运行中** → 行内第二行（带扫光）：「正在搜索 X」是「它在做什么」的唯一可见处，
 *     不能藏。
 *   - **失败 / 中断** → 也留行内第二行：`子代理超时（600s）`、`上次那一轮已跑完、
 *     产出还在…可去取回` 是**要用户/主代理动手**的诊断；把它们收进展开区等于把
 *     唯一的信号藏起来（这正是"整卡默认折叠"时代被抱怨过的那件事）。
 *   - **完成** → 收进展开区：`已完成 N 轮` 与右对齐的计数重复，而展开区里还有
 *     timeline 与输出，上下文更全。
 *
 * queued 的「等待中」与状态短词「启动中」同义，两处都不放（同一句话写两遍）。
 */
export function agentActionPlacement(row: AgentRowView): {
	/** 行内第二行（运行中 / 失败 / 中断）。 */
	readonly subline?: string;
	/** 展开区里的动作文本（仅完成态；空串表示不必为它挂展开入口）。 */
	readonly detail: string;
} {
	if (row.live || row.status === "failed" || row.status === "interrupted") {
		return { subline: row.action, detail: "" };
	}
	if (row.status === "queued") return { detail: "" };
	return { detail: row.action };
}
