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
 *
 * 行样式统一（2026-09-19）：成员行与团队状态栏的列行表共用 `AgentRow` ——
 * 原来计数挤在名字下面当第三行（行被撑高、扫视对不齐），现在计数右对齐，
 * 一行读完。两处行组件重复的问题一并消失。
 */

import { useState } from "react";
import type { SubagentStatus, ToolCard } from "@shared/session-events.ts";
import { AgentRow } from "./agent-row.tsx";
import { STATUS_SHORT } from "./agent-row-status.ts";
import { IconCheck, IconChevronDown, IconClose } from "./icons.tsx";
import { LoadingState, Spinner } from "./state-views.tsx";
import { agentActionPlacement, agentMetaLine, defaultOpenOf, deriveAgentRow } from "./task-agent-card-model.ts";

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
	// 中断沿用叉的容器，但走独立色档（spec: add-team-interrupt-diagnostics 批次 ①）：
	// 视觉上与失败同族（都不是成功），色上区分（琥珀 vs 红，成员自己没出错）。
	if (status === "interrupted") {
		return (
			<span className="todo-glyph">
				<IconClose size={14} className="task-agent-interrupted" />
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

/**
 * 一个子代理的分组行（共用 `AgentRow`）：头像 + 名字（+模型徽标）+ task 摘要 +
 * 右对齐计数 + 状态位（glyph + 短状态词）+ 尾部（可选「查看」与展开 caret）。
 *
 * 状态位保留 `AgentGlyph` 而不是换成团队行的 `●/✓` 符号：glyph 有 spinner 与
 * 空心环，「正在跑」这一态它表达得更准；两者占 `AgentRow` 的同一个槽位，行宽一致。
 *
 * 有可展开内容（timeline / 输出 / 终态动作文本）时整行可点：展开盒先终态动作文本、
 * 再过程时间线、最后成功输出（终态默认收起，运行中展开即实时进展——Trae 透明性的
 * 等价物）。团队成员（onFocusMember + sessionId 在）额外带「查看」入口：切到成员的
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
	const placement = agentActionPlacement(row);
	const expandable = hasTimeline || row.output !== undefined || placement.detail !== "";
	const metaLine = agentMetaLine(agent);
	const viewable = onFocusMember !== undefined && agent.sessionId !== undefined;

	return (
		<div>
			<AgentRow
				avatarName={agent.agent}
				title={agent.agent}
				badge={agent.model === undefined ? undefined : modelBadgeText(agent.model)}
				badgeTitle={agent.model}
				summary={agent.task}
				meta={metaLine}
				status={{ node: <AgentGlyph status={row.status} />, short: STATUS_SHORT[row.status], tone: row.status }}
				subline={placement.subline}
				// 扫光是全局唯一的「进行中」语言；subline 只在运行中出现，两者同进同出。
				sublineShimmer={placement.subline !== undefined}
				rowTitle={expandable ? (detailOpen ? "收起" : "展开过程与输出") : undefined}
				onClick={expandable ? () => setDetailOpen((v) => !v) : undefined}
				// 尾部槽只有一个：可展开时给 caret，成员行在它前面多一个「查看」。
				trailing={
					<>
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
						{expandable && (
							<IconChevronDown size={12} className={detailOpen ? "tool-caret open" : "tool-caret"} />
						)}
					</>
				}
			/>
			{expandable && detailOpen && (
				<div className="task-agent-detail">
					{/* 终态的动作文本（「已完成 N 轮」/失败诊断/中断文案）：行上放不下，
					    收进这里 —— 它仍要可达，所以也算可展开内容（见 agentActionPlacement）。 */}
					{placement.detail !== "" && <div className="agent-row-subline">{placement.detail}</div>}
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
