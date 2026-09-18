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

import type { SubagentStatus } from "@shared/session-events.ts";

/** 一枚成员 chip 的展示模型。 */
export interface TeamBarRow {
	/** 成员名（团队投影里 `agent` 字段就是成员名，见 daemon 的 emitTeamProgress）。 */
	readonly name: string;
	/** 状态符：● 运行中 / ✓ 完成 / ✗ 失败 / … 启动中。 */
	readonly mark: string;
	/** 状态词（title 与无障碍文本用）。 */
	readonly statusText: string;
	/** 计数摘要，如「3 轮 · 12 工具」；没有计数时为空串。 */
	readonly count: string;
	/** 是否可点开聚焦（没有 sessionId 的成员还没建好会话）。 */
	readonly clickable: boolean;
	/** 状态色档（样式用；与 mark 同源，避免在 JSX 里反推符号）。 */
	readonly tone: SubagentStatus["status"];
	/** 是否运行中（样式强调用）。 */
	readonly live: boolean;
	/** 是否是当前正在查看的成员。 */
	readonly current: boolean;
	readonly sessionId?: string;
}

/**
 * 注意：投影只有 queued/running/done/failed 四态 —— WorkBuddy 状态栏的
 * 「— 已取消」我们没有对应态（团队投影把 closed 折成 done），故不造第五个符号。
 */
const MARKS: Record<SubagentStatus["status"], string> = {
	queued: "…",
	running: "●",
	done: "✓",
	failed: "✗",
};

const STATUS_TEXT: Record<SubagentStatus["status"], string> = {
	queued: "启动中",
	running: "运行中",
	done: "已完成",
	failed: "失败",
};

/**
 * 派生状态栏行（纯函数，可单测）。
 *
 * 计数只在有内容时出现：`0 轮 · 0 工具` 对刚起步的成员是噪音，
 * 而「3 轮」本身就是「它真的在干活」的信号。
 */
export function teamBarRows(
	members: readonly SubagentStatus[],
	currentName: string | undefined,
): readonly TeamBarRow[] {
	return members
		.filter((member) => (member.kind ?? "subagent") === "team")
		.map((member) => {
			const parts: string[] = [];
			if (member.turns > 0) parts.push(`${member.turns} 轮`);
			if (member.toolCalls !== undefined && member.toolCalls > 0) parts.push(`${member.toolCalls} 工具`);
			return {
				name: member.agent,
				mark: MARKS[member.status],
				statusText: STATUS_TEXT[member.status],
				count: parts.join(" · "),
				clickable: member.sessionId !== undefined,
				tone: member.status,
				live: member.status === "running",
				current: currentName === member.agent,
				...(member.sessionId === undefined ? {} : { sessionId: member.sessionId }),
			};
		});
}

/** ↓ 轮转的目标：主理人视图、某个成员，或「没得可切」。 */
export type MemberCycleTarget =
	| { readonly kind: "leader" }
	| { readonly kind: "member"; readonly sessionId: string; readonly name: string };

/**
 * 空输入框按 ↓ 时的下一个焦点（纯函数，可单测）。
 *
 * 轮转顺序：主理人视图 → 成员 1 → 成员 2 → … → 主理人视图（循环）。
 * 没有 sessionId 的成员（会话还没建好）**跳过** —— 聚焦一个空壳只会看到白屏，
 * 那是比「按了没反应」更糟的体验。没有任何可切目标时返回 undefined，
 * 调用方据此**不拦截**这个按键（保持原生光标移动）。
 */
export function nextMemberTarget(
	members: readonly SubagentStatus[],
	currentName: string | undefined,
): MemberCycleTarget | undefined {
	const ready = members
		.filter((member) => (member.kind ?? "subagent") === "team" && member.sessionId !== undefined)
		.map((member) => ({ sessionId: member.sessionId as string, name: member.agent }));
	const first = ready[0];
	if (first === undefined) return undefined;
	if (currentName === undefined) return { kind: "member", ...first };
	const index = ready.findIndex((member) => member.name === currentName);
	if (index === -1) return { kind: "member", ...first };
	const next = ready[index + 1];
	// 末尾 → 回主理人视图（WorkBuddy 的 Ctrl+O 语义在这里顺手也能得到）。
	return next === undefined ? { kind: "leader" } : { kind: "member", ...next };
}

export interface TeamStatusBarProps {
	readonly members: readonly SubagentStatus[];
	/** 当前正在查看的成员名（领导视图时为 undefined）。 */
	readonly currentName?: string;
	readonly onFocus: (sessionId: string, name: string) => void;
	/** 收起状态栏（本会话内隐藏；下次开会话重新出现）。 */
	readonly onClose: () => void;
}

export function TeamStatusBar({ members, currentName, onFocus, onClose }: TeamStatusBarProps): React.JSX.Element | null {
	const rows = teamBarRows(members, currentName);
	if (rows.length === 0) return null;
	const liveCount = rows.filter((row) => row.live).length;
	return (
		<div className="team-bar" role="status" aria-label="团队成员状态">
			<span className="team-bar-lead">
				{liveCount > 0 ? `${rows.length} 名成员 · ${liveCount} 人工作中` : `${rows.length} 名成员`}
			</span>
			<div className="team-bar-members">
				{rows.map((row) => (
					<button
						key={row.name}
						type="button"
						className={`team-bar-chip${row.live ? " live" : ""}${row.current ? " active" : ""}`}
						title={`${row.name}｜${row.statusText}${row.count === "" ? "" : `｜${row.count}`}`}
						disabled={!row.clickable}
						onClick={() => {
							if (row.sessionId !== undefined) onFocus(row.sessionId, row.name);
						}}
					>
						<span className={`team-bar-mark st-${row.tone}`} aria-hidden="true">
							{row.mark}
						</span>
						<span className="team-bar-name">{row.name}</span>
						{row.count !== "" && <span className="team-bar-count">{row.count}</span>}
					</button>
				))}
			</div>
			<button
				type="button"
				className="team-bar-close"
				title="隐藏状态栏（本次会话内）"
				aria-label="隐藏团队成员状态"
				onClick={onClose}
			>
				×
			</button>
		</div>
	);
}
