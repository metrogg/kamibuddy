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
 *
 * 过程透明（2026-09-16，参照 Trae 的 fromSubagent 事件回流）：Trae 把子代理的
 * 工具事件实时混进主消息流；我们保持隔离设计，折中是投影携带 timeline 动作行——
 * 每组可展开看到子代理做过什么（运行中看进展、终态后回看过程），失败时的
 * 部分输出也由此有了上下文。agent.model 声明了专用模型时名字旁挂模型徽标。
 *
 * 团队成员（kind:"team"，spec: add-team-foundations 批 8）：成员行带「查看」
 * 入口（聚焦成员实时对话）与实时计数行（轮数/工具/token/费用）。
 */

import { useState } from "react";
import type { SubagentStatus, ToolCard } from "@shared/session-events.ts";
import { IconCheck, IconChevronDown, IconClose } from "./icons.tsx";
import { LoadingState, Spinner } from "./state-views.tsx";

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
				<Spinner size={14} />
			</span>
		);
	}
	return (
		<span className="todo-glyph">
			<span className="todo-ring" />
		</span>
	);
}

/** 模型徽标显示文本：只取 modelId 段（`provider/model` 太长），完整 key 走 title。 */
function modelBadgeText(model: string): string {
	const slash = model.lastIndexOf("/");
	return slash === -1 ? model : model.slice(slash + 1);
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
 * 一个子代理的分组行：glyph + agent 名（+模型徽标）+ task 摘要 + 动作行。
 * 有时间线或输出时整行可点：展开盒先过程时间线、后成功输出（终态默认收起，
 * 运行中展开即实时进展——Trae 透明性的等价物）。
 * 团队成员（onFocusMember + sessionId 在）额外带「查看」入口：切到成员的
 * 实时会话（spec: add-team-foundations 批 8 焦点导航）。
 */
function AgentGroup({
	agent,
	onFocusMember,
}: {
	readonly agent: SubagentStatus;
	readonly onFocusMember?: (memberSessionId: string, memberName: string) => void;
}): React.JSX.Element {
	const [detailOpen, setDetailOpen] = useState(false);
	const row = deriveAgentRow(agent);
	const hasTimeline = (agent.timeline?.length ?? 0) > 0;
	const expandable = hasTimeline || row.output !== undefined;
	const metaLine = memberMetaLine(agent);
	const viewable = onFocusMember !== undefined && agent.sessionId !== undefined;

	const inner = (
		<>
			<AgentGlyph status={row.status} />
			<span className="task-agent-main">
				<span className="task-agent-title">
					<span className="task-agent-name">{agent.agent}</span>
					{agent.model !== undefined && (
						<span className="task-agent-model" title={agent.model}>
							{modelBadgeText(agent.model)}
						</span>
					)}
					{/* 过长截断 + title 兜底（与 tool-summary 同手法）。 */}
					<span className="task-agent-task" title={agent.task}>{agent.task}</span>
				</span>
				<span className={row.live ? "task-agent-action text-shimmer" : "task-agent-action"}>{row.action}</span>
				{metaLine !== undefined && <span className="task-agent-meta">{metaLine}</span>}
			</span>
			{viewable && (
				<span
					role="button"
					tabIndex={0}
					className="task-agent-view mini-btn"
					title="查看该成员的实时会话"
					onClick={(e) => {
						// 行本身是展开切换按钮：这里必须拦住冒泡，只做聚焦。
						e.stopPropagation();
						onFocusMember(agent.sessionId ?? "", agent.agent);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							e.stopPropagation();
							onFocusMember(agent.sessionId ?? "", agent.agent);
						}
					}}
				>
					查看
				</span>
			)}
			{expandable && <IconChevronDown size={12} className={detailOpen ? "tool-caret open" : "tool-caret"} />}
		</>
	);

	return (
		<div className="task-agent-group">
			{expandable ? (
				<button
					type="button"
					className="task-agent-row expandable"
					title={detailOpen ? "收起" : "展开过程与输出"}
					onClick={() => setDetailOpen((v) => !v)}
				>
					{inner}
				</button>
			) : (
				<div className="task-agent-row">{inner}</div>
			)}
			{expandable && detailOpen && (
				<div className="task-agent-detail">
					{hasTimeline && (
						<div className="task-agent-timeline">
							{agent.timeline?.map((line, i) => (
								<div key={`${i}#${line}`} className="task-agent-timeline-item">
									{line}
								</div>
							))}
						</div>
					)}
					{row.output !== undefined && <div className="task-agent-output">{row.output}</div>}
				</div>
			)}
		</div>
	);
}

export function TaskAgentCard({
	card,
	onFocusMember,
}: {
	readonly card: ToolCard;
	readonly onFocusMember?: (memberSessionId: string, memberName: string) => void;
}): React.JSX.Element {
	// 手动开合优先：点过一次卡头后不再跟随默认规则（TodoListCard 同款，
	// 那里是 defaultOpen 随消息流位置变化，这里是随 outcome 落定翻转）。
	const [override, setOverride] = useState<boolean | undefined>(undefined);
	const agents = card.subagents ?? [];
	// 活的状态面板（spec: add-team-foundations 批 7）：成员仍在跑/排队时
	// 团队卡默认展开——终态折叠的例外；全员收尾后自动收回折叠态。
	// 只对事后仍有投影更新的卡生效（team_member_progress），task 卡的
	// subagents 在终态后不再变化，行为与现状一致。
	const anyMemberActive = agents.some((a) => a.status === "running" || a.status === "queued");
	const defaultOpen = defaultOpenOf(card.outcome) || anyMemberActive;
	const open = override ?? defaultOpen;
	// 运行中标签扫光（对标 ToolEntry：进行中状态全靠呼吸点 + 扫光状态字）。
	const running = card.outcome === undefined;

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
					<LoadingState text="子任务执行中…" />
				) : (
					<div className="task-agent-list">
						{agents.map((agent, index) => (
						<AgentGroup key={`${agent.agent}#${index}`} agent={agent} onFocusMember={onFocusMember} />
					))}
					</div>
				)}
			</div>
		</div>
	);
}
