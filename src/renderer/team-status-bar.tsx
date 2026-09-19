/**
 * 团队常驻状态栏（spec: add-team-ux-parity 批次 ②）。
 *
 * 与成员卡（task-agent-card 的 team 分组）的分工：
 *   - 成员卡 = **消息流里的一次性记录**，会随对话滚走；
 *   - 状态栏 = **常驻的实时汇总**，挂在输入区上方，团队在就一直在。
 * WorkBuddy 的 status bar 同位同语义（● 运行中 / ✓ 完成 / ✗ 失败 + 实时计数）。
 *
 * 数据源沿用 `team_member_progress` 投影（每轮全量替换，见 session-events 的
 * SubagentStatus 注释）—— 不新增事件、不新增 IPC。
 *
 * 展示模型抽成纯函数（`teamBarRows`）并单测：renderer 没有组件测试基建
 * （同 task-agent-card 的 AgentRowView 口径），「每枚 chip 显示什么」是最易回归
 * 的那层逻辑。
 */

import { useState } from "react";
import type { SubagentStatus } from "@shared/session-events.ts";
import { AgentRow } from "./agent-row.tsx";
import { ExpertAvatar } from "./expert-avatar.tsx";
import { IconChevronDown, IconClose } from "./icons.tsx";
import { teamBarRows, teamBarStats } from "./team-status-bar-model.ts";

export interface TeamStatusBarProps {
	readonly members: readonly SubagentStatus[];
	/** 当前正在查看的成员名（领导视图时为 undefined）。 */
	readonly currentName?: string;
	readonly onFocus: (sessionId: string, name: string) => void;
	/** 收起状态栏（本会话内隐藏；下次开会话重新出现）。 */
	readonly onClose: () => void;
}

export function TeamStatusBar({ members, currentName, onFocus, onClose }: TeamStatusBarProps): React.JSX.Element | null {
	/*
	 * 折叠/展开两态（2026-09-19 对齐 WorkBuddy 的成员区形态，见 add-team-ux-parity
	 * 的实施后修正）：折叠 = 头像堆叠 + 人数 + 只列异常的簇，一行 ≈28px 不抢输入区；
	 * 展开 = 列行表，行宽充裕，轮数/工具数/等待时长都能放下 —— 空间问题用**折叠**解决，
	 * 而不是靠削信息（上一版削掉完成态计数就是被空间逼的）。
	 * 本地 state：换会话重挂载即回到折叠态（与 teamBarHidden 同口径）。
	 */
	const [expanded, setExpanded] = useState(false);
	const rows = teamBarRows(members, currentName);
	if (rows.length === 0) return null;
	const stats = teamBarStats(rows);
	/*
	 * 头像堆叠最多 5 枚 + 「+N」：第 6 枚起只是重复「人数」这一个信息，
	 * 而每多一枚都在挤压文字区（WorkBuddy 折叠态同款做法）。
	 */
	const faces = rows.slice(0, 5);
	return (
		<div className="team-bar">
			{/* role="status" 只挂在头部：它是"实时摘要"，而展开的成员表是内容 ——
			    把整块放进 live region 会让读屏在每次投影刷新时念完整张表。 */}
			<div className="team-bar-head" role="status" aria-label="团队成员状态">
				<button
					type="button"
					className="team-bar-toggle"
					aria-expanded={expanded}
					title={expanded ? "收起成员列表" : "展开成员列表"}
					onClick={() => setExpanded((value) => !value)}
				>
					<span className="team-bar-facepile" aria-hidden="true">
						{faces.map((row) => (
							<ExpertAvatar key={row.name} displayName={row.name} className="team-bar-face" />
						))}
						{rows.length > faces.length && (
							/* 复用 expert-avatar 的 16px 圆盒（尺寸/圆角/居中都在它那），
							   只换底色与字色 —— 不另写一份尺寸值。 */
							<span className="expert-avatar team-bar-face team-bar-face-more" aria-hidden="true">
								+{rows.length - faces.length}
							</span>
						)}
					</span>
					<span className="team-bar-lead">{stats.total} 位成员</span>
					<IconChevronDown size={12} className={expanded ? "tool-caret open" : "tool-caret"} />
				</button>
				{/* 状态簇常驻（折叠态也显示）—— 这是我们比 WorkBuddy 多的那点价值：
				    它折叠时只看得到人数，把「谁在跑 / 谁中断了」一起藏了。 */}
				{stats.parts.map((part) => (
					<span key={part.text} className={`team-bar-stat ${part.tone}`}>
						{part.text}
					</span>
				))}
				<button
					type="button"
					className="team-bar-close"
					title="隐藏状态栏（本次会话内）"
					aria-label="隐藏团队成员状态"
					onClick={onClose}
				>
					<IconClose size={12} />
				</button>
			</div>
			{expanded && (
				<div className="team-bar-members">
					{rows.map((row) => (
						<AgentRow
							key={row.name}
							avatarName={row.name}
							title={row.name}
							meta={row.count === "" ? undefined : row.count}
							metaAlert={row.waitingAlert}
							status={row.tone}
							disabled={!row.clickable}
							active={row.current}
							rowTitle={`${row.name}｜${row.statusText}${row.count === "" ? "" : `｜${row.count}`}${
								row.outputAvailable ? "｜产出在它的会话记录里（点开可看）" : ""
							}`}
							onClick={() => {
								if (row.sessionId !== undefined) onFocus(row.sessionId, row.name);
							}}
							// 尾部槽只有一个：团队行给可钻取的 `›`（没有会话时不挂）。
							trailing={
								row.clickable ? (
									<span className="agent-row-caret" aria-hidden="true">
										›
									</span>
								) : undefined
							}
						/>
					))}
				</div>
			)}
		</div>
	);
}
