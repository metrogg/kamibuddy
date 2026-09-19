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
import { ExpertAvatar } from "./expert-avatar.tsx";
import { IconChevronDown } from "./icons.tsx";

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
	/**
	 * 短状态词（「已完成」「运行中」…）：展开后的列行表里与状态符同显。
	 *
	 * 与 `statusText` 的分工：那个是给 title / 无障碍读的**长句**（含
	 * 「产出还在会话记录里，可去取回」这类行动指引），这里是**行内一个词**。
	 */
	readonly statusShort: string;
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

/** 行内短状态词（展开的列行表用；长句留给 title，见 TeamBarRow.statusShort）。 */
const STATUS_SHORT: Record<SubagentStatus["status"], string> = {
	queued: "启动中",
	running: "运行中",
	done: "已完成",
	failed: "失败",
	interrupted: "已中断",
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
				statusShort: STATUS_SHORT[member.status],
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

/** 状态簇里的一枚（渲染用；「只显示非零」这条判据在纯函数里，才可单测）。 */
export interface TeamBarStat {
	readonly text: string;
	/** 样式档：live → `--primary`；warn → `--warning`。 */
	readonly tone: "live" | "warn";
}

/**
 * 状态栏头部的统计（纯函数，可单测）。
 *
 * 为什么从摘要句改成「总数 + 状态簇」：原来那句
 * 「6 名成员 · 6 人有产出可读（在各自会话记录里）」有 20 多个字，占了近半行宽，
 * 把 chip 挤成横向滚动；而它想传达的三件事（几人、谁在跑、谁出问题）恰恰是
 * **状态簇**能一眼给完的。总数之外只列**非零**项 —— 0 是噪音。
 *
 * 次序按「越需要动手越靠前」：运行中（要等）→ 中断（要决定重跑还是取产出）→
 * 等待超时（要去看一眼是不是断了）。**「有产出可读」不再进簇**：成员跑完有产出
 * 是常态（产出会随 `team_*` 工具结果自动送到领导），把它当告警会让强调失效 ——
 * 琥珀只留给「中断」与「等待超时」（见 CSS 里 recoverable 那条已被删掉的旧注释）。
 */
export function teamBarStats(rows: readonly TeamBarRow[]): {
	readonly total: number;
	readonly parts: readonly TeamBarStat[];
} {
	const parts: TeamBarStat[] = [];
	const running = rows.filter((row) => row.live).length;
	const interrupted = rows.filter((row) => row.interrupted).length;
	if (running > 0) parts.push({ text: `${running} 人工作中`, tone: "live" });
	if (interrupted > 0) parts.push({ text: `${interrupted} 人已中断`, tone: "warn" });
	/*
	 * 等待超时：多个人都在超时时只报最久的那个（`rows` 顺序即团队顺序，
	 * 这里显式取最长，避免"谁先来报谁"这种与数据顺序耦合的偶然行为）。
	 */
	const alertWaiting = rows
		.filter((row) => row.waitingAlert && row.waiting !== "")
		.map((row) => row.waiting)
		.sort((a, b) => waitingMs(b) - waitingMs(a))[0];
	if (alertWaiting !== undefined) parts.push({ text: `已等 ${alertWaiting}`, tone: "warn" });
	return { total: rows.length, parts };
}

/** 把 `formatWaiting` 的产物折回毫秒，只为上面那句排序（文案格式是「N 分钟」「N 小时」）。 */
function waitingMs(text: string): number {
	const match = /^(\d+) (分钟|小时)$/.exec(text);
	if (match === null) return 0;
	const value = Number(match[1]);
	return (match[2] === "小时" ? value * 60 : value) * 60_000;
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
					×
				</button>
			</div>
			{expanded && (
				<div className="team-bar-members">
					{rows.map((row) => (
						<button
							key={row.name}
							type="button"
							className={`team-bar-row${row.current ? " active" : ""}${row.interrupted ? " interrupted" : ""}`}
							title={`${row.name}｜${row.statusText}${row.count === "" ? "" : `｜${row.count}`}${
								row.outputAvailable ? "｜产出在它的会话记录里（点开可看）" : ""
							}`}
							disabled={!row.clickable}
							onClick={() => {
								if (row.sessionId !== undefined) onFocus(row.sessionId, row.name);
							}}
						>
							<ExpertAvatar displayName={row.name} />
							<span className="team-bar-row-name">{row.name}</span>
							{row.count !== "" && (
								<span className={`team-bar-row-meta${row.waitingAlert ? " warn" : ""}`}>{row.count}</span>
							)}
							<span className="team-bar-row-status">
								<span className={`team-bar-mark st-${row.tone}`} aria-hidden="true">
									{row.mark}
								</span>
								{row.statusShort}
							</span>
							{row.clickable && (
								<span className="team-bar-row-caret" aria-hidden="true">
									›
								</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
