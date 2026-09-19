/**
 * 子代理 / 团队成员共用的一行（列行表）。
 *
 * 为什么两处共用一行组件：同一个「成员」在两个位置出现 —— 消息流里的 task 活动卡
 * （`task-agent-card`）与输入区上方的常驻状态栏（`team-status-bar`）。此前两处各写
 * 一套行，头像、名字、右对齐计数、状态位、尾部箭头这五件事各实现一遍，改一处另一处
 * 就漂（这次的口径是「列行表」，见 add-team-ux-parity 之后的统一）。抽成一行后，
 * 「一行成员长什么样」只有这个文件说了算。
 *
 * 组件本身不做业务判断：显示什么字、什么状态、尾部放什么，全由调用方算好传进来
 * —— 两处的数据源根本不同（一个来自 task 卡的 subagents 投影，一个来自团队投影）。
 *
 * 状态词表在 `agent-row-status.ts`（纯数据不放 `.tsx`：混着导出会让本文件的热更退化，
 * 见那份文件的头注释）。本文件因此只导出组件与类型。
 */

import type { SubagentStatus } from "@shared/session-events.ts";
import { STATUS_MARK, STATUS_SHORT } from "./agent-row-status.ts";
import { ExpertAvatar } from "./expert-avatar.tsx";

/**
 * 状态位：给状态档名则走内部词表（符号 + 短词），给节点则原样渲染。
 *
 * 为什么要允许调用方传节点：两处的状态位不是同一套语言 —— 团队行用上面那张符号表，
 * 子代理行用 `AgentGlyph`（spinner / 空心环能表达「正在跑」，`●` 表达不了）。
 * 但它们占**同一个槽位**，行宽与对齐才一致。
 */
export type AgentRowStatus =
	| SubagentStatus["status"]
	| {
			/** 自定义状态节点（如子代理的 AgentGlyph）。 */
			readonly node: React.ReactNode;
			/** 与节点同显的短状态词；不需要就省略。 */
			readonly short?: string;
			/** 色档：驱动 `interrupted` 的名字高亮等行级样式（节点自带色时可不给）。 */
			readonly tone?: SubagentStatus["status"];
	  };

export interface AgentRowProps {
	/** 头像显示名（走 ExpertAvatar 的首字符 + 8 色 hash；尺寸由 .expert-avatar 的 16px 决定）。 */
	readonly avatarName: string;
	/** 主文字（名字）。 */
	readonly title: string;
	/** 名字后的徽标文本（如模型徽标）；不给则不占位。 */
	readonly badge?: string;
	/** 徽标的完整值（如 `provider/model`），进 title；缺省用 badge 本身。 */
	readonly badgeTitle?: string;
	/** 任务摘要：过长截断 + title 兜底。 */
	readonly summary?: string;
	/** 右对齐的计数摘要（轮数 / 工具 / token / 费用）。 */
	readonly meta?: string;
	/** meta 是否走告警色（如等待超阈值）。 */
	readonly metaAlert?: boolean;
	readonly status: AgentRowStatus;
	/** 可选第二行（子代理运行中的动作行）；不给就是单行。 */
	readonly subline?: string;
	/** 第二行是否扫光（仅「进行中」用）。 */
	readonly sublineShimmer?: boolean;
	/** 尾部槽：`›`（可钻取）或 caret（可展开）。**只允许一个** —— 两个一起放会挤掉计数。 */
	readonly trailing?: React.ReactNode;
	/** 行级 title（tooltip）；不给则不挂。 */
	readonly rowTitle?: string;
	/** 不可点（渲染成 button 时才有意义）。 */
	readonly disabled?: boolean;
	/** 当前正在查看的那一行。 */
	readonly active?: boolean;
	/** 给了就渲染成可点的 button，否则是纯 div（行本身不可交互时不该是按钮）。 */
	readonly onClick?: () => void;
}

export function AgentRow({
	avatarName,
	title,
	badge,
	badgeTitle,
	summary,
	meta,
	metaAlert,
	status,
	subline,
	sublineShimmer,
	trailing,
	rowTitle,
	disabled,
	active,
	onClick,
}: AgentRowProps): React.JSX.Element {
	const tone = typeof status === "string" ? status : status.tone;
	const state =
		typeof status === "string" ? (
			<>
				<span className={`agent-row-mark st-${status}`} aria-hidden="true">
					{STATUS_MARK[status]}
				</span>
				{STATUS_SHORT[status]}
			</>
		) : (
			<>
				{status.node}
				{status.short !== undefined && status.short !== "" ? status.short : null}
			</>
		);

	const className = `agent-row${active === true ? " active" : ""}${tone === "interrupted" ? " interrupted" : ""}`;
	const inner = (
		<>
			<ExpertAvatar displayName={avatarName} />
			{/* 文字列单独一层：有第二行（运行中的动作行）时它折行，
			    而右对齐的计数与状态位始终留在第一行上 —— 这正是这次重排的目的
			    （原来计数挤在名字下面当第三行）。 */}
			<span className="agent-row-body">
				<span className="agent-row-main">
					<span className="agent-row-name">{title}</span>
					{badge !== undefined && (
						<span className="agent-row-badge" title={badgeTitle ?? badge}>
							{badge}
						</span>
					)}
					{summary !== undefined && (
						<span className="agent-row-summary" title={summary}>
							{summary}
						</span>
					)}
					{meta !== undefined && meta !== "" && (
						<span className={metaAlert === true ? "agent-row-meta warn" : "agent-row-meta"}>{meta}</span>
					)}
					<span className="agent-row-status">{state}</span>
					{trailing}
				</span>
				{subline !== undefined && subline !== "" && (
					<span className={sublineShimmer === true ? "agent-row-subline text-shimmer" : "agent-row-subline"}>
						{subline}
					</span>
				)}
			</span>
		</>
	);

	if (onClick === undefined) {
		return (
			<div className={className} title={rowTitle}>
				{inner}
			</div>
		);
	}
	return (
		<button type="button" className={className} title={rowTitle} disabled={disabled} onClick={onClick}>
			{inner}
		</button>
	);
}
