/**
 * task 工具（子代理委派）的分组活动卡（spec: add-subagent-live-activity）。
 *
 * 与 ToolEntry 的定位差异同 TodoListCard：普通工具卡是「过程记录」默认折叠；
 * 本卡是「活的状态面板」—— 运行中（outcome 未落定）默认展开，按子代理分组
 * 实时显示状态与最新动作行；终态收敛为分组结果摘要、默认折叠。用户手动开合
 * 优先于默认规则（TodoListCard 同款语义）。
 *
 * 渲染数据是卡片携带的 subagents 整体投影（每次 subagent_progress 全量替换，
 * 契约语义见 session-events.ts SubagentStatus 注释）—— 组件不做增量合并，
 * 每次渲染直接用最新全量。
 */

import { useState } from "react";
import type { SubagentStatus, ToolCard } from "@shared/session-events.ts";
import { IconCheck, IconChevronDown, IconClose } from "./icons.tsx";

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
	}
}

/** 默认展开判定：运行中（outcome 未落定）默认展开，终态默认折叠。 */
export function defaultOpenOf(outcome: ToolCard["outcome"]): boolean {
	return outcome === undefined;
}

/** 执行状态 → 状态点样式类（与 chat-view.tsx ToolEntry 的 outcomeClass 同口径）。 */
function outcomeClass(outcome: ToolCard["outcome"]): string {
	if (outcome === undefined) return "running";
	return outcome === "ok" ? "ok" : "bad";
}

/** 状态 glyph：排队空心环 / 运行中 spinner / 成功绿勾 / 失败红叉（glyph 容器复用 todo 卡规格）。 */
function AgentGlyph({ status }: { readonly status: SubagentStatus["status"] }): React.JSX.Element {
	if (status === "done") {
		return (
			<span className="todo-glyph">
				<IconCheck size={14} className="task-agent-check" />
			</span>
		);
	}
	if (status === "failed") {
		return (
			<span className="todo-glyph">
				<IconClose size={14} className="task-agent-cross" />
			</span>
		);
	}
	if (status === "running") {
		return (
			<span className="todo-glyph">
				<span className="todo-spinner" />
			</span>
		);
	}
	return (
		<span className="todo-glyph">
			<span className="todo-ring" />
		</span>
	);
}

/**
 * 一个子代理的分组行：glyph + agent 名 + task 摘要 + 动作行。
 * done 且输出非空时整行可点，展开/收起输出盒（终态默认收起）。
 */
function AgentGroup({ agent }: { readonly agent: SubagentStatus }): React.JSX.Element {
	const [outputOpen, setOutputOpen] = useState(false);
	const row = deriveAgentRow(agent);
	const expandable = row.output !== undefined;

	const inner = (
		<>
			<AgentGlyph status={row.status} />
			<span className="task-agent-main">
				<span className="task-agent-title">
					<span className="task-agent-name">{agent.agent}</span>
					{/* 过长截断 + title 兜底（与 tool-summary 同手法）。 */}
					<span className="task-agent-task" title={agent.task}>{agent.task}</span>
				</span>
				<span className={row.live ? "task-agent-action text-shimmer" : "task-agent-action"}>{row.action}</span>
			</span>
			{expandable && <IconChevronDown size={12} className={outputOpen ? "tool-caret open" : "tool-caret"} />}
		</>
	);

	return (
		<div className="task-agent-group">
			{expandable ? (
				<button
					type="button"
					className="task-agent-row expandable"
					title={outputOpen ? "收起输出" : "展开输出"}
					onClick={() => setOutputOpen((v) => !v)}
				>
					{inner}
				</button>
			) : (
				<div className="task-agent-row">{inner}</div>
			)}
			{expandable && outputOpen && <div className="task-agent-output">{row.output}</div>}
		</div>
	);
}

export function TaskAgentCard({ card }: { readonly card: ToolCard }): React.JSX.Element {
	// 手动开合优先：点过一次卡头后不再跟随默认规则（TodoListCard 同款，
	// 那里是 defaultOpen 随消息流位置变化，这里是随 outcome 落定翻转）。
	const [override, setOverride] = useState<boolean | undefined>(undefined);
	const defaultOpen = defaultOpenOf(card.outcome);
	const open = override ?? defaultOpen;
	// 运行中标签扫光（对标 ToolEntry：进行中状态全靠呼吸点 + 扫光状态字）。
	const running = card.outcome === undefined;
	const agents = card.subagents ?? [];

	return (
		<div className="entry tool">
			<button
				type="button"
				className="tool-head"
				title={open ? "收起" : "展开"}
				onClick={() => setOverride((v) => !(v ?? defaultOpen))}
			>
				<span className={`tool-dot ${outcomeClass(card.outcome)}`} />
				<span className={running ? "tool-label text-shimmer" : "tool-label"}>{card.label}</span>
				<span className="tool-summary">{card.summary}</span>
				<IconChevronDown size={12} className={open ? "tool-caret open" : "tool-caret"} />
			</button>
			{/* 展开盒复用 tool-detail-box 的开合机制（常驻 DOM + 类切换，理由见
			    ToolEntry 注释）；task-agent-box 只覆盖排版与底色（清单是文本行，
			    不是等宽输出）。 */}
			<div className={open ? "tool-detail-box task-agent-box open" : "tool-detail-box task-agent-box"}>
				{agents.length === 0 ? (
					// 投影未到达的窗口期（卡已上屏、首个 subagent_progress 未达）。
					<div className="task-agent-placeholder">子任务执行中…</div>
				) : (
					<div className="task-agent-list">
						{agents.map((agent, index) => <AgentGroup key={`${agent.agent}#${index}`} agent={agent} />)}
					</div>
				)}
			</div>
		</div>
	);
}
