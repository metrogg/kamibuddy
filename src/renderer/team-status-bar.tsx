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
	/** 是否已中断（样式用；tone 之外的独立开关注解，便于 chip 加特殊视觉）。 */
	readonly interrupted: boolean;
	/**
	 * 「它的会话记录里有产出可读」（spec: add-team-pull-model 批次③）。
	 * 直接取投影字段，不做加工 —— 它本来就是布尔语义。
	 * 与 `tone`/`interrupted` 正交：中断态也可能带着产出。
	 */
	readonly outputAvailable: boolean;
	/**
	 * 「已等待 X」文案（spec: add-team-interrupt-diagnostics 批次 ②）；
	 * 不在等待中 / 不足 1 分钟时为空串。
	 */
	readonly waiting: string;
	/** 等待时长是否已超阈值（样式换告警色用）。 */
	readonly waitingAlert: boolean;
	readonly sessionId?: string;
}

/**
 * 注意：投影有 queued/running/done/failed/**interrupted** 五态。
 * interrupted 是团队投影独有的（spec: add-team-interrupt-diagnostics 批次 ①）——
 * 进程被杀时该成员正在跑一轮，重启后从落盘恢复成这一态。它既不是 done（活没交
 * 回来）也不是 failed（成员自己没出错），用 `!` 与「已中断」把区别写在脸上。
 */
const MARKS: Record<SubagentStatus["status"], string> = {
	queued: "…",
	running: "●",
	done: "✓",
	failed: "✗",
	interrupted: "!",
};

const STATUS_TEXT: Record<SubagentStatus["status"], string> = {
	queued: "启动中",
	running: "运行中",
	done: "已完成",
	failed: "失败",
	interrupted: "已中断（那一轮没有回音）",
};

/**
 * 等待告警阈值（spec: add-team-interrupt-diagnostics 批次 ②）。
 *
 * 选 5 分钟的理由：实测里成员的深挖轮跑了约 1.5 分钟（`16:54:39` 派活 →
 * `16:56:03` 交付），单轮搜索型任务极少超过 5 分钟。超过就该提示「可能断了」
 * 而不是无限期显示「运行中」—— 那正是用户实测时被误导的地方。
 */
export const WAITING_ALERT_MS = 5 * 60 * 1000;

/**
 * 把等待时长折成人读的短文案（纯函数，可单测）。
 *
 * 粒度刻意粗：<1 分钟不显示（「等了 0 分钟」是噪音），分钟级只到 59，
 * 之后进位到小时。用户要的是「大概等了多久」这个量级判断。
 */
export function formatWaiting(elapsedMs: number): string {
	if (elapsedMs < 60_000) return "";
	const minutes = Math.floor(elapsedMs / 60_000);
	if (minutes < 60) return `${minutes} 分钟`;
	const hours = Math.floor(minutes / 60);
	return `${hours} 小时`;
}

/**
 * 派生状态栏行（纯函数，可单测）。
 *
 * 计数只在有内容时出现：`0 轮 · 0 工具` 对刚起步的成员是噪音，
 * 而「3 轮」本身就是「它真的在干活」的信号。
 *
 * `now` 是注入的「现在」（epoch ms），缺省 `Date.now()` —— 等待时长要可测，
 * 就不能在函数体里直接读时钟。生产调用不传。
 */
export function teamBarRows(
	members: readonly SubagentStatus[],
	currentName: string | undefined,
	now?: number,
): readonly TeamBarRow[] {
	const at = now ?? Date.now();
	return members
		.filter((member) => (member.kind ?? "subagent") === "team")
		.map((member) => {
			const parts: string[] = [];
			if (member.turns > 0) parts.push(`${member.turns} 轮`);
			if (member.toolCalls !== undefined && member.toolCalls > 0) parts.push(`${member.toolCalls} 工具`);
			// 等待文案（批次 ②）：缺席 waitingSince = 不在等，不显示。
			const elapsed = member.waitingSince === undefined ? -1 : at - member.waitingSince;
			const waiting = elapsed < 0 ? "" : formatWaiting(elapsed);
			if (waiting !== "") parts.push(`已等 ${waiting}`);
			/*
			 * 产出可读（spec: add-team-pull-model 批次③）：**从文件派生**的信号，
			 * 与状态正交 —— 中断态也可能有产出（上次那一轮跑完了、只是进程没了）。
			 * 有它就说明「去取回」比「重跑」更划算，所以 statusText 优先说它。
			 */
			const outputAvailable = member.outputAvailable === true;
			// 状态词（批次 ③）：有产出可读时把「产出在、可去取」说进 statusText ——
			// title 与无障碍文本读到的就是这句，用户不必猜。
			const statusText = outputAvailable
				? `${STATUS_TEXT[member.status]}；产出还在它的会话记录里，可去取回（不必重跑）`
				: STATUS_TEXT[member.status];
			return {
				name: member.agent,
				mark: MARKS[member.status],
				statusText,
				count: parts.join(" · "),
				clickable: member.sessionId !== undefined,
				tone: member.status,
				live: member.status === "running",
				current: currentName === member.agent,
				interrupted: member.status === "interrupted",
				outputAvailable,
				waiting,
				waitingAlert: elapsed >= WAITING_ALERT_MS,
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
	const interruptedCount = rows.filter((row) => row.interrupted).length;
	const recoverableCount = rows.filter((row) => row.outputAvailable).length;
	/*
	 * 摘要行按「最需要用户注意」的事优先：
	 *   有产出可读 > 中断 > 工作中 > 平静。
	 *
	 * 「有产出可读」排最前（拉模式，spec: add-team-pull-model 批次 ④）是因为它是
	 * 四者里唯一**有救**的一条 —— 用户在它面前能立刻做对的事（把产出取回来），
	 * 而「中断/工作中」只能让他继续等或重跑。把它埋在后面等于浪费掉最有价值的信号。
	 */
	const summary =
		recoverableCount > 0
			? `${rows.length} 名成员 · ${recoverableCount} 人有产出可读（在各自会话记录里）`
			: interruptedCount > 0
				? `${rows.length} 名成员 · ${interruptedCount} 人中中断`
				: liveCount > 0
					? `${rows.length} 名成员 · ${liveCount} 人工作中`
					: `${rows.length} 名成员`;
	return (
		<div className="team-bar" role="status" aria-label="团队成员状态">
			<span className="team-bar-lead">{summary}</span>
			<div className="team-bar-members">
				{rows.map((row) => (
					<button
						key={row.name}
						type="button"
						className={`team-bar-chip${row.live ? " live" : ""}${row.current ? " active" : ""}${
							row.interrupted ? " interrupted" : ""
						}${row.outputAvailable ? " recoverable" : ""}${row.waitingAlert ? " waiting-alert" : ""}`}
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
						{row.count !== "" && (
							<span className={`team-bar-count${row.waitingAlert ? " warn" : ""}`}>{row.count}</span>
						)}
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
