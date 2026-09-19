/**
 * team-status-bar 的展示模型（纯函数，可单测）。
 *
 * 为什么单拆一个模块：`@vitejs/plugin-react` 要求 `.tsx` 只导出 React 组件，
 * 否则该文件的热更会退化（Fast Refresh 警告 → 整页重载）。纯函数与它们的类型
 * 搬到这里，组件文件只导出组件；类型在运行期被擦除，放哪都不触发该警告。
 */

import type { SubagentStatus } from "@shared/session-events.ts";
import { STATUS_TEXT } from "./agent-row-status.ts";

/** 一枚成员行的展示模型（渲染成 `AgentRow`）。 */
export interface TeamBarRow {
	/** 成员名（团队投影里 `agent` 字段就是成员名，见 daemon 的 emitTeamProgress）。 */
	readonly name: string;
	/**
	 * 状态长句（title 与无障碍文本用）。
	 *
	 * 行内的**状态符与短词不在这里**：它们由 `AgentRow` 按 `tone` 查共享词表渲染 ——
	 * 两处（团队行 / 子代理行）共用一份词表，本行的 mark/short 是**派生值而非字段**，
	 * 留字段就会多出第二份来源（2026-09-19 抽 `agent-row` 时收掉的）。
	 */
	readonly statusText: string;
	/** 计数摘要，如「3 轮 · 12 工具」；没有计数时为空串。 */
	readonly count: string;
	/** 是否可点开聚焦（没有 sessionId 的成员还没建好会话）。 */
	readonly clickable: boolean;
	/** 状态色档（`AgentRow` 按它查状态符与短词）。 */
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

/*
 * 状态词表（符号 / 短词 / 长句）已迁到 agent-row.tsx —— 那是「一行里怎么描述状态」的
 * 唯一定义，子代理卡与状态栏都从那儿取，不允许任何一处再抄一份。
 */

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
