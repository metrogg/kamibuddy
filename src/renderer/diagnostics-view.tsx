/**
 * 诊断页：可观测性面板。
 *
 * 数据只有一个来源：daemon 的 statsSnapshot（core/observability.ts 聚合）。
 * 本页不做任何二次计算——两端各算一份必然漂移（同 shared/conversation.ts 的理由）。
 *
 * 刷新策略：挂载时拉一次，之后跟随会话事件流增量刷新
 * （会话事件本身就是「统计变了」的信号，不另开推送通道，见 shared/ipc.ts）。
 *
 * 本页只 import @shared（AGENTS.md §1.3）。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
	DEFAULT_GLOBAL_SHORTCUT,
	type GlobalShortcutStatus,
	type RunLedgerResult,
} from "@shared/ipc.ts";
import type {
	CacheMissReason,
	LlmCallData,
	ObservabilitySnapshot,
	RequestSnapshotData,
	RunEndReason,
	RunRecord,
	TokenUsage,
} from "@shared/observability.ts";
import { cacheHitRate } from "@shared/observability.ts";
import { isStreamingEvent } from "@shared/session-events.ts";
import { IconBack, IconChart, IconRefresh } from "./icons.tsx";
import {
	foldRunLedger,
	indexRequestSnapshots,
	snapshotKey,
	type LedgerItem,
	type LedgerRun,
} from "./run-timeline.ts";
import { SnapshotBreakdown } from "./snapshot-breakdown.tsx";
import { EmptyState, ErrorState, LoadingState } from "./state-views.tsx";

/* ── 格式化小工具 ────────────────────────────────────────────────── */

/** 1234 → "1,234"；1234567 → "1.23M"。 */
function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	return n.toLocaleString("en-US");
}

/** 美元费用。分以下显示两位小数，再小显示四位（试用期单 run 常在几厘）。 */
function formatCost(usd: number): string {
	if (usd === 0) return "$0";
	return usd >= 0.01 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(4)}`;
}

function formatMs(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function formatClock(ts: number): string {
	const d = new Date(ts);
	const pad = (v: number): string => String(v).padStart(2, "0");
	return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function usageTotal(u: TokenUsage): number {
	return u.input + u.output + u.cacheRead + u.cacheWrite;
}

/* ── 概览卡片 ────────────────────────────────────────────────────── */

function StatCard(props: {
	label: string;
	value: string;
	hint?: string;
}): React.JSX.Element {
	return (
		<div className="stat-card">
			<div className="stat-value">{props.value}</div>
			<div className="stat-label">{props.label}</div>
			{props.hint !== undefined && (
				<div className="stat-hint">{props.hint}</div>
			)}
		</div>
	);
}

/* ── 上下文成分条 ────────────────────────────────────────────────── */

const COMPOSITION_PARTS = [
	{ key: "system", label: "系统提示词", className: "comp-system" },
	{ key: "user", label: "用户消息", className: "comp-user" },
	{ key: "assistant", label: "助手回复", className: "comp-assistant" },
	{ key: "thinking", label: "思考", className: "comp-thinking" },
	{ key: "tools", label: "工具结果", className: "comp-tools" },
] as const;

function CompositionBar({
	snapshot,
}: {
	snapshot: ObservabilitySnapshot;
}): React.JSX.Element {
	const composition = snapshot.composition;
	if (composition === undefined)
		return <EmptyState title="还没有会话内容。" />;

	const total = COMPOSITION_PARTS.reduce(
		(sum, p) => sum + composition[p.key],
		0,
	);
	if (total === 0) return <EmptyState title="还没有会话内容。" />;

	return (
		<>
			<div className="comp-bar" role="img" aria-label="上下文成分估算">
				{COMPOSITION_PARTS.filter((p) => composition[p.key] > 0).map((p) => (
					<div
						key={p.key}
						className={`comp-seg ${p.className}`}
						style={{ width: `${(composition[p.key] / total) * 100}%` }}
						title={`${p.label}：约 ${formatTokens(composition[p.key])} tokens`}
					/>
				))}
			</div>
			<ul className="comp-legend">
				{COMPOSITION_PARTS.map((p) => (
					<li key={p.key}>
						<span className={`comp-dot ${p.className}`} />
						{p.label} ≈ {formatTokens(composition[p.key])}
					</li>
				))}
			</ul>
			<p className="stat-hint">
				成分为按字符数的估算值（比例尺，不是账单）。
				{snapshot.contextUsage !== undefined &&
					`实际占用 ${formatTokens(snapshot.contextUsage.usedTokens)} / ${formatTokens(snapshot.contextUsage.maxTokens)} tokens。`}
			</p>
		</>
	);
}

/* ── run 时间线（泳道） ──────────────────────────────────────────── */

function RunTimeline({ run }: { run: RunRecord }): React.JSX.Element {
	if (run.toolSpans.length === 0) {
		return <EmptyState title="这个任务没有调用工具。" />;
	}
	// 时间轴范围：run 开始到结束（进行中的 run 用最后一个 span 的终点兜底）。
	const start = run.startedAt;
	const end =
		run.endedAt ??
		run.toolSpans.reduce(
			(max, s) => Math.max(max, s.endedAt ?? s.startedAt),
			start,
		);
	const span = Math.max(end - start, 1);

	return (
		<div className="timeline">
			{run.toolSpans.map((s, i) => {
				const left = ((s.startedAt - start) / span) * 100;
				const width = Math.max(
					(((s.endedAt ?? end) - s.startedAt) / span) * 100,
					0.5,
				);
				const cls =
					s.outcome === "error"
						? " err"
						: s.outcome === undefined
							? " running"
							: "";
				const dur =
					s.endedAt === undefined
						? "进行中"
						: formatMs(s.endedAt - s.startedAt);
				return (
					<div key={`${s.toolName}-${i}`} className="timeline-row">
						<span className="timeline-label" title={s.summary}>
							{s.label}
						</span>
						<div className="timeline-track">
							<div
								className={`timeline-span${cls}`}
								style={{ left: `${left}%`, width: `${width}%` }}
								title={`${s.label} ${dur}${s.summary === "" ? "" : `：${s.summary}`}`}
							/>
						</div>
						<span className="timeline-dur">{dur}</span>
					</div>
				);
			})}
		</div>
	);
}

/* ── 会话时间线（运行台账泳道） ──────────────────────────────────────
 *
 * 与上方 RunTimeline 同一套视觉语言（左标签 / 中轨道 / 右耗时），
 * 数据源从 statsSnapshot 的 toolSpans 换成台账 fold（run-timeline.ts）：
 * llm 调用 / 工具 / 重试（琥珀）/ 压缩 / 终态标记共轴。
 * 工具与重试行缩进一级 —— 它们挂在模型调用之下，不是平级步骤。
 */

const END_REASON_LABELS: Record<RunEndReason, string> = {
	completed: "完成",
	cancelled: "已取消",
	error: "失败",
	interrupted: "中断",
};

/** 台账行在 run 时间轴上的跨度（retry/compaction 是时刻标记，零宽按最小宽度画）。 */
function itemBounds(item: LedgerItem): { readonly s: number; readonly e: number } {
	switch (item.kind) {
		case "llm":
			return { s: item.data.startedAt, e: item.data.endedAt };
		case "tool":
			return { s: item.data.startedAt, e: item.data.endedAt };
		case "retry":
			return {
				s: item.at,
				e: item.at + (item.data.phase === "start" ? (item.data.delayMs ?? 0) : 0),
			};
		case "compaction":
			return { s: item.at, e: item.at };
	}
}

function spanStyle(
	axisStart: number,
	axisEnd: number,
	s: number,
	e: number,
): { readonly left: string; readonly width: string } {
	const span = Math.max(axisEnd - axisStart, 1);
	return {
		left: `${(((s - axisStart) / span) * 100).toFixed(2)}%`,
		width: `${Math.max(((e - s) / span) * 100, 0.5).toFixed(2)}%`,
	};
}

/** llm 行的悬停摘要：耗时/TTFT/token/cost/缓存命中/stopReason 一行看齐。 */
function llmTitle(d: LlmCallData, cacheReported: boolean): string {
	const parts = [`模型调用 ${formatMs(d.endedAt - d.startedAt)}`];
	if (d.ttftMs !== undefined) parts.push(`TTFT ${formatMs(d.ttftMs)}`);
	if (d.usage !== undefined) {
		parts.push(`tokens ${formatTokens(d.usage.totalTokens)}`);
		parts.push(`费用 ${formatCost(d.usage.cost)}`);
		const hit = cacheHitRate(d.usage, cacheReported);
		if (hit !== undefined) parts.push(`缓存命中 ${(hit * 100).toFixed(1)}%`);
	}
	if (d.stopReason !== undefined) parts.push(`停止 ${d.stopReason}`);
	if (d.errorMessage !== undefined) parts.push(`错误 ${d.errorMessage}`);
	return parts.join(" · ");
}

/** 选中一轮模型调用后的详情：计时五要素 + usage 五字段 + 请求快照拆分。 */
function LlmDetail({
	call,
	snapshot,
	cacheReported,
}: {
	call: LlmCallData;
	snapshot: RequestSnapshotData | undefined;
	/** provider 是否上报过缓存活动（会话级，见 LedgerRunView）。 */
	cacheReported: boolean;
}): React.JSX.Element {
	const u = call.usage;
	const hit = u === undefined ? undefined : cacheHitRate(u, cacheReported);
	return (
		<div className="timeline-detail">
			<div className="kv-grid">
				<span>
					耗时 <b>{formatMs(call.endedAt - call.startedAt)}</b>
				</span>
				{call.ttftMs !== undefined && (
					<span>
						TTFT <b>{formatMs(call.ttftMs)}</b>
					</span>
				)}
				{call.stopReason !== undefined && (
					<span>
						停止原因 <b>{call.stopReason}</b>
					</span>
				)}
				{call.errorMessage !== undefined && (
					<span className="stat-err">{call.errorMessage}</span>
				)}
			</div>
			{u !== undefined && (
				<div className="kv-grid">
					<span>
						输入 <b>{formatTokens(u.input)}</b>
					</span>
					<span>
						输出 <b>{formatTokens(u.output)}</b>
					</span>
					<span>
						缓存命中 <b>{formatTokens(u.cacheRead)}</b>
						{hit !== undefined && `（${(hit * 100).toFixed(1)}%）`}
					</span>
					<span>
						缓存写入 <b>{formatTokens(u.cacheWrite)}</b>
					</span>
					<span>
						合计 <b>{formatTokens(u.totalTokens)}</b>
					</span>
					<span>
						费用 <b>{formatCost(u.cost)}</b>
					</span>
				</div>
			)}
			{snapshot === undefined ? (
				<p className="stat-hint">该轮没有请求快照（无组装来源或旧台账）。</p>
			) : (
				<SnapshotBreakdown snapshot={snapshot} />
			)}
		</div>
	);
}

/** 一个 run 的泳道块：头部（边界/终态/用量/缓存命中率）+ 条目行 + 选中轮详情。 */
function LedgerRunView({
	run,
	snapshots,
	cacheReported,
	selectedLlm,
	onSelectLlm,
}: {
	run: LedgerRun;
	snapshots: ReadonlyMap<string, RequestSnapshotData>;
	/** provider 是否上报过缓存活动（会话级，取该会话的 SessionStatCard.cacheReported）。 */
	cacheReported: boolean;
	selectedLlm: { readonly runId: string; readonly turnIndex: number } | undefined;
	onSelectLlm: (sel: { readonly runId: string; readonly turnIndex: number }) => void;
}): React.JSX.Element {
	// 时间轴：run 边界；未闭合时用最后一个条目的终点兜底（同 RunTimeline）。
	const axisStart = run.startedAt;
	const axisEnd =
		run.endedAt ??
		run.items.reduce((max, item) => {
			const { e } = itemBounds(item);
			return Math.max(max, e);
		}, axisStart);
	const hit = run.usage === undefined ? undefined : cacheHitRate(run.usage, cacheReported);
	const selectedCall =
		selectedLlm === undefined || selectedLlm.runId !== run.runId
			? undefined
			: run.items.find(
					(item): item is Extract<LedgerItem, { kind: "llm" }> =>
						item.kind === "llm" && item.data.turnIndex === selectedLlm.turnIndex,
				);

	return (
		<div className="timeline-run">
			<div className="timeline-run-head">
				<span className="timeline-run-title">
					{run.runId === "" ? "run 外事件" : `${formatClock(run.startedAt)} 开始`}
				</span>
				{run.endedAt === undefined ? (
					<span>进行中</span>
				) : run.endReason === "completed" ? (
					<span className="stat-ok">成功</span>
				) : (
					<span
						className={run.endReason === "cancelled" ? undefined : "stat-err"}
						title={run.error}
					>
						{END_REASON_LABELS[run.endReason ?? "interrupted"]}
					</span>
				)}
				{run.modelId !== undefined && <span>{run.modelId}</span>}
				{run.endedAt !== undefined && (
					<span>耗时 {formatMs(run.endedAt - run.startedAt)}</span>
				)}
				{run.usage !== undefined && (
					<span>tokens {formatTokens(usageTotal(run.usage))}</span>
				)}
				{hit !== undefined && <span>缓存 {(hit * 100).toFixed(1)}%</span>}
			</div>
			{run.items.length === 0 ? (
				<EmptyState title="这个 run 没有泳道条目。" />
			) : (
				run.items.map((item, i) => {
					const { s, e } = itemBounds(item);
					const style = spanStyle(axisStart, axisEnd, s, e);
					if (item.kind === "llm") {
						const d = item.data;
						const selected =
							selectedLlm?.runId === run.runId && selectedLlm.turnIndex === d.turnIndex;
						return (
							<div
								key={`llm-${d.turnIndex}-${i}`}
								className={`timeline-row clickable${selected ? " selected" : ""}`}
								title={`${llmTitle(d, cacheReported)}（点击查看上下文拆分）`}
								onClick={() =>
									onSelectLlm({ runId: run.runId, turnIndex: d.turnIndex })
								}
							>
								<span className="timeline-label">模型 #{d.turnIndex + 1}</span>
								<div className="timeline-track">
									<div
										className={`timeline-span llm${d.errorMessage !== undefined ? " err" : ""}`}
										style={style}
									/>
								</div>
								<span className="timeline-dur">{formatMs(e - s)}</span>
							</div>
						);
					}
					if (item.kind === "tool") {
						const d = item.data;
						return (
							<div
								key={`tool-${d.toolCallId}-${i}`}
								className="timeline-row nested"
								title={`${d.toolName} ${formatMs(e - s)}${d.summary === "" ? "" : `：${d.summary}`}（${d.outcome}）`}
							>
								<span className="timeline-label">{d.toolName}</span>
								<div className="timeline-track">
									<div
										className={`timeline-span${d.outcome === "error" ? " err" : ""}`}
										style={style}
									/>
								</div>
								<span className="timeline-dur">{formatMs(e - s)}</span>
							</div>
						);
					}
					if (item.kind === "retry") {
						const d = item.data;
						const title =
							d.phase === "start"
								? `第 ${d.attempt}${d.maxAttempts === undefined ? "" : `/${d.maxAttempts}`} 次重试 · ${formatMs(d.delayMs ?? 0)} 后发起${d.errorMessage === undefined ? "" : ` · 上次失败：${d.errorMessage}`}`
								: d.success === true
									? "重试成功"
									: `重试耗尽${d.finalError === undefined ? "" : `：${d.finalError}`}`;
						return (
							<div key={`retry-${i}`} className="timeline-row nested" title={title}>
								<span className="timeline-label">重试</span>
								<div className="timeline-track">
									<div className="timeline-span retry" style={style} />
								</div>
								<span className="timeline-dur">
									{d.phase === "start" ? formatMs(d.delayMs ?? 0) : "—"}
								</span>
							</div>
						);
					}
					const d = item.data;
					const reasonLabel =
						d.reason === "manual" ? "手动" : d.reason === "threshold" ? "阈值" : "溢出";
					return (
						<div
							key={`compaction-${i}`}
							className="timeline-row nested"
							title={`上下文压缩（${reasonLabel}）${d.tokensBefore === undefined ? "" : ` · 压缩前 ${formatTokens(d.tokensBefore)} tokens`}${d.aborted ? " · 已中止" : ""}${d.errorMessage === undefined ? "" : ` · ${d.errorMessage}`}`}
						>
							<span className="timeline-label">压缩</span>
							<div className="timeline-track">
								<div className="timeline-span compaction" style={style} />
							</div>
							<span className="timeline-dur">—</span>
						</div>
					);
				})
			)}
			{run.endedAt !== undefined && (
				<div
					className="timeline-row nested"
					title={`run ${END_REASON_LABELS[run.endReason ?? "interrupted"]}${run.error === undefined ? "" : `：${run.error}`}`}
				>
					<span className="timeline-label">结束</span>
					<div className="timeline-track">
						<div
							className={`timeline-span end${
								run.endReason === "error" || run.endReason === "interrupted"
									? " err"
									: run.endReason === "completed"
										? " ok"
										: ""
							}`}
							style={spanStyle(axisStart, axisEnd, run.endedAt, run.endedAt)}
						/>
					</div>
					<span className="timeline-dur">—</span>
				</div>
			)}
			{selectedCall !== undefined && selectedLlm !== undefined && (
				<LlmDetail
					call={selectedCall.data}
					cacheReported={cacheReported}
					snapshot={snapshots.get(
						snapshotKey(
							selectedCall.data.runId ??
								(run.runId === "" ? undefined : run.runId),
							selectedLlm.turnIndex,
						),
					)}
				/>
			)}
		</div>
	);
}

/* ── 会话统计与缓存归因（statsSnapshot 的 sessions / cacheWaste） ──────
 *
 * 两块数据都是 daemon 从台账 fold 好的（core/observability.ts），本区只做展示。
 * 口径与「用量概览」不同：那边是进程内累计，这里是台账全历史（重启不清零、
 * 含被压缩历史，近 pi getSessionStats），头部标注防混。
 */

/** 缓存失效原因的中文标签（shared CacheMissReason 的展示映射）。 */
const MISS_REASON_LABELS: Record<CacheMissReason, string> = {
	idle_ttl: "空闲失效",
	model_change: "换模失效",
	other: "其他失效",
};

function SessionStatsSection({
	snapshot,
}: {
	snapshot: ObservabilitySnapshot;
}): React.JSX.Element {
	const sessions = snapshot.sessions;
	const waste = snapshot.cacheWaste;
	// 归因卡片只列有记录的原因（other 是兜底桶，常态为空不该占位）。
	const wasteByReason = (
		Object.keys(MISS_REASON_LABELS) as CacheMissReason[]
	)
		.map((reason) => {
			const misses = waste.misses.filter((m) => m.reason === reason);
			return {
				reason,
				count: misses.length,
				tokens: misses.reduce((sum, m) => sum + m.missedTokens, 0),
				cost: misses.reduce((sum, m) => sum + m.missedCost, 0),
			};
		})
		.filter((r) => r.count > 0);

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>会话统计与缓存归因</h2>
				<span className="stat-hint">台账全历史口径（含被压缩历史）</span>
			</header>
			{sessions.length === 0 ? (
				<EmptyState title="还没有会话统计（台账里跑过任务后可见）。" />
			) : (
				<table className="stat-table">
					<thead>
						<tr>
							<th>会话</th>
							<th>run</th>
							<th>轮次</th>
							<th>模型耗时</th>
							<th>工具耗时</th>
							<th>tokens</th>
							<th>费用</th>
							<th>缓存命中</th>
						</tr>
					</thead>
					<tbody>
						{sessions.slice(0, 10).map((s) => (
							<tr key={s.sessionId}>
								<td title={s.sessionId}>{s.sessionId.slice(0, 8)}</td>
								<td>{s.runs}</td>
								<td>{s.turns}</td>
								<td>{formatMs(s.llmMs)}</td>
								<td>{formatMs(s.toolMs)}</td>
								<td>{formatTokens(usageTotal(s.usage))}</td>
								<td>{formatCost(s.usage.cost)}</td>
								<td>
									{s.cacheHitRate === undefined
										? "—"
										: `${(s.cacheHitRate * 100).toFixed(1)}%`}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			{sessions.length > 10 && (
				<p className="stat-hint">只显示最近活跃的 10 个会话（共 {sessions.length} 个）。</p>
			)}
			{waste.missCount === 0 ? (
				<p className="stat-hint">缓存浪费归因：没有缓存失效记录。</p>
			) : (
				<>
					<p className="stat-hint">
						缓存浪费合计 {formatTokens(waste.missedTokens)} tokens（
						{formatCost(waste.missedCost)}，{waste.missCount} 次）——
						上次 prompt 已有、这次却没走缓存重计费的部分。
					</p>
					<div className="stat-grid">
						{wasteByReason.map((r) => (
							<StatCard
								key={r.reason}
								label={MISS_REASON_LABELS[r.reason]}
								value={`${formatTokens(r.tokens)} tokens`}
								hint={`${formatCost(r.cost)} · ${r.count} 次`}
							/>
						))}
					</div>
				</>
			)}
		</section>
	);
}

/* ── 全局唤起热键状态行 ──────────────────────────────────────────── */

/**
 * 全局唤起热键的注册状态（main 侧 globalShortcut.register 的真实结果，
 * 经 INVOKE.globalShortcutStatus 由 main 本地应答）。状态在启动注册后
 * 不再变化，挂载时查一次即可，不随会话事件刷新。
 */
function GlobalShortcutRow(): React.JSX.Element {
	const [status, setStatus] = useState<GlobalShortcutStatus | "error" | undefined>(undefined);

	useEffect(() => {
		window.kami
			.globalShortcutStatus()
			.then(setStatus)
			.catch(() => setStatus("error"));
	}, []);

	const accelerator =
		status !== undefined && status !== "error" ? status.accelerator : DEFAULT_GLOBAL_SHORTCUT;
	return (
		<p>
			全局唤起热键 {accelerator}：
			{status === undefined && <span className="stat-hint">查询中…</span>}
			{status === "error" && <span className="stat-err">状态查询失败</span>}
			{status !== undefined && status !== "error" && status.kind === "registered" && (
				<span className="stat-ok">已注册</span>
			)}
			{status !== undefined && status !== "error" && status.kind === "failed" && (
				<span className="stat-err">注册失败（可能被占用）</span>
			)}
		</p>
	);
}

/* ── docx 生成环境状态行 ─────────────────────────────────────────── */

/**
 * 这里**不再**显示 docx 引擎 venv 的四态（`DocxEnvRow` 已删）。
 *
 * 原因：spec: add-managed-runtimes 把运行时状态收进了设置页「内置运行时」
 * 一级分区（含开关 / 诊断 / 重置）。同一份状态在两个地方各显示一次，必然出现
 * 「一边说就绪、一边说未安装」的双份口径 —— 状态只有一个展示位，就是那里。
 * IPC 通道 `docxEnvStatus` 保留（阶段 1 的契约仍被 daemon 与测试引用），
 * 只是本页不再消费它。
 */

/* ── 主视图 ──────────────────────────────────────────────────────── */

export function DiagnosticsView({
	onClose,
}: {
	onClose: () => void;
}): React.JSX.Element {
	const [snapshot, setSnapshot] = useState<ObservabilitySnapshot | undefined>(
		undefined,
	);
	const [error, setError] = useState<string | undefined>(undefined);
	/** 时间线展示的 run。默认最新一条，点历史行可切换。 */
	const [selectedRunId, setSelectedRunId] = useState<string | undefined>(
		undefined,
	);
	/** 台账数据（会话时间线分区）。undefined = 还没拉回来。 */
	const [ledger, setLedger] = useState<RunLedgerResult | undefined>(undefined);
	/** 用户在选择器里挑的会话；undefined = 跟随 daemon 默认（当前活动会话）。 */
	const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(
		undefined,
	);
	/** 时间线里点中的模型调用（展开上下文真实拆分）。 */
	const [selectedLlm, setSelectedLlm] = useState<
		{ readonly runId: string; readonly turnIndex: number } | undefined
	>(undefined);

	const refresh = useCallback(() => {
		window.kami
			.statsSnapshot()
			.then((s) => {
				setSnapshot(s);
				setError(undefined);
			})
			.catch((e: unknown) => {
				setError(e instanceof Error ? e.message : String(e));
			});
	}, []);

	const refreshLedger = useCallback((sessionId?: string) => {
		window.kami
			.runLedger(sessionId)
			.then(setLedger)
			.catch((e: unknown) => {
				setError(e instanceof Error ? e.message : String(e));
			});
	}, []);

	useEffect(() => {
		refresh();
		refreshLedger(selectedSessionId);
		// 会话事件 = 统计变了的信号。流式与进度类事件不改变聚合结果，跳过免得
		// 空转（名单在 shared 的 isStreamingEvent，**唯一处** —— 此前三处各写
		// 一遍且都漏了 tool_stream_progress，实测一次 write 就能把本页拖进
		// 3000+ 次「重拉快照 + 重读全量台账」）。
		const off = window.kami.onSessionEvent(({ event }) => {
			if (isStreamingEvent(event)) return;
			refresh();
			refreshLedger(selectedSessionId);
		});
		return off;
	}, [refresh, refreshLedger, selectedSessionId]);

	/** 台账 fold 是渲染的一部分（口径见 run-timeline.ts），memo 住避免每帧重算。 */
	const ledgerRuns = useMemo(
		() => foldRunLedger(ledger?.entries ?? []),
		[ledger],
	);
	const ledgerSnapshots = useMemo(
		() => indexRequestSnapshots(ledger?.entries ?? []),
		[ledger],
	);
	/** 展示序：新的在前（与「最近任务」一致），最多画 20 个 run。 */
	const displayRuns = useMemo(
		() => [...ledgerRuns].reverse().slice(0, 20),
		[ledgerRuns],
	);

	// 进程级合计：只要有任何一个会话报过缓存，这个数字就有意义（没有就是「—」）。
	const processCacheReported = snapshot?.sessions.some((s) => s.cacheReported) ?? false;
	const hitRate =
		snapshot === undefined
			? undefined
			: cacheHitRate(snapshot.totalUsage, processCacheReported);
	/**
	 * 台账分区的缓存判定按**该会话**的卡片取（是否报缓存是会话级属性，不是进程级）。
	 * 卡片不在窗口里（很旧的会话）就按未知处理 —— 单步自己没有判别能力。
	 */
	const ledgerCacheReported =
		snapshot?.sessions.find((s) => s.sessionId === ledger?.sessionId)?.cacheReported ?? false;
	const selectedRun =
		snapshot?.runs.find((r) => r.runId === selectedRunId) ?? snapshot?.runs[0];

	return (
		<main className="settings">
			<header className="settings-head">
				<button
					type="button"
					className="bar-btn"
					aria-label="返回"
					onClick={onClose}
				>
					<IconBack size={17} />
				</button>
				<h1>诊断</h1>
				<span className="bar-spacer" />
				{snapshot !== undefined && (
					<button
						type="button"
						className="mini-btn"
						title="打开事件日志目录（JSONL，按日期分文件）"
						onClick={() => {
							window.kami.openArtifact(snapshot.logDir).catch((e: unknown) => {
								setError(e instanceof Error ? e.message : String(e));
							});
						}}
					>
						<IconChart size={13} />
						打开日志目录
					</button>
				)}
				<button
					type="button"
					className="mini-btn"
					title="重新拉取统计"
					onClick={() => {
						refresh();
						refreshLedger(selectedSessionId);
					}}
				>
					<IconRefresh size={13} />
					刷新
				</button>
			</header>

			<div className="settings-body">
				{error !== undefined && <ErrorState message={error} />}

				<section className="settings-section">
					<header className="settings-section-head">
						<h2>应用状态</h2>
					</header>
					<GlobalShortcutRow />
					<p className="stat-hint">内置运行时的状态、开关、诊断与重置在「设置 → 内置运行时」。</p>
				</section>

				{snapshot === undefined ? (
					<LoadingState text="正在读取统计…" />
				) : (
					<>
						<section className="settings-section">
							<header className="settings-section-head">
								<h2>用量概览</h2>
							<span className="stat-hint">台账全历史累计（重启不清零）</span>
							</header>
							<div className="stat-grid">
								<StatCard
									label="总 tokens"
									value={formatTokens(usageTotal(snapshot.totalUsage))}
								/>
								<StatCard
									label="估算费用"
									value={formatCost(snapshot.totalUsage.cost)}
								/>
								<StatCard
									label="缓存命中率"
									value={
										hitRate === undefined
											? "—"
											: `${(hitRate * 100).toFixed(1)}%`
									}
									hint={
										hitRate === undefined
											? "还没有模型响应"
											: `命中 ${formatTokens(snapshot.totalUsage.cacheRead)} / 未命中 ${formatTokens(snapshot.totalUsage.input)}`
									}
								/>
								<StatCard
									label="任务数"
									value={String(snapshot.totalRuns)}
									hint={
										snapshot.totalErrors === 0
											? "无失败"
											: `${snapshot.totalErrors} 次失败`
									}
								/>
							</div>
						</section>

						<SessionStatsSection snapshot={snapshot} />

						<section className="settings-section">
							<header className="settings-section-head">
								<h2>上下文组成</h2>
								{ledgerSnapshots.size > 0 && (
									<span className="stat-hint">
										该会话有真实快照：在下方会话时间线点一轮模型调用查看拆分
									</span>
								)}
							</header>
							<CompositionBar snapshot={snapshot} />
						</section>

						{snapshot.tools.length > 0 && (
							<section className="settings-section">
								<header className="settings-section-head">
									<h2>工具统计</h2>
								</header>
								<table className="stat-table">
									<thead>
										<tr>
											<th>工具</th>
											<th>调用</th>
											<th>失败</th>
											<th>平均耗时</th>
										</tr>
									</thead>
									<tbody>
										{snapshot.tools.map((t) => (
											<tr key={t.toolName}>
												<td>{t.label}</td>
												<td>{t.calls}</td>
												<td className={t.errors > 0 ? "stat-err" : undefined}>
													{t.errors}
												</td>
												<td>{formatMs(t.avgMs)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</section>
						)}

						<section className="settings-section">
							<header className="settings-section-head">
								<h2>最近任务</h2>
								<span className="stat-hint">点击行查看工具时间线</span>
							</header>
							{snapshot.runs.length === 0 ? (
								<EmptyState title="还没有跑过任务。" />
							) : (
								<>
									<table className="stat-table stat-table-clickable">
										<thead>
											<tr>
												<th>开始</th>
												<th>模型</th>
												<th>耗时</th>
												<th>tokens</th>
												<th>工具</th>
												<th>状态</th>
											</tr>
										</thead>
										<tbody>
											{snapshot.runs.slice(0, 10).map((r) => (
												<tr
													key={r.runId}
													className={
														r.runId === selectedRun?.runId
															? "selected"
															: undefined
													}
													onClick={() => setSelectedRunId(r.runId)}
												>
													<td>{formatClock(r.startedAt)}</td>
													<td>{r.modelId ?? "—"}</td>
													<td>
														{r.endedAt === undefined
															? "进行中"
															: formatMs(r.endedAt - r.startedAt)}
													</td>
													<td>
														{r.usage === undefined
															? "—"
															: formatTokens(usageTotal(r.usage))}
													</td>
													<td>
														{r.toolCalls}
														{r.toolErrors > 0 && (
															<span className="stat-err">
																（{r.toolErrors} 失败）
															</span>
														)}
													</td>
													<td>
														{r.status === "ok" && (
															<span className="stat-ok">成功</span>
														)}
														{r.status === "running" && <span>进行中</span>}
														{r.status === "error" && (
															<span className="stat-err" title={r.error}>
																失败
															</span>
														)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
									{selectedRun !== undefined && (
									<RunTimeline run={selectedRun} />
								)}
							</>
						)}
					</section>

					<section className="settings-section">
						<header className="settings-section-head">
							<h2>会话时间线</h2>
							{ledger !== undefined && ledger.sessions.length > 0 && (
								<select
									className="ledger-select"
									aria-label="选择会话"
									value={ledger.sessionId ?? ""}
									onChange={(e) => {
										const id = e.target.value;
										setSelectedSessionId(id);
										setSelectedLlm(undefined);
										refreshLedger(id);
									}}
								>
									{/*
									 * 选中项可能不在列表里（请求的会话还没记台账、
									 * 或 daemon 回退目标不在 mtime 列表内）——补一个选项
									 * 让 select 恒受控，不悄悄跳回第一项。
									 */}
									{ledger.sessionId !== undefined &&
										!ledger.sessions.includes(ledger.sessionId) && (
											<option value={ledger.sessionId}>
												{ledger.sessionId}
											</option>
										)}
									{ledger.sessions.map((id) => (
										<option key={id} value={id}>
											{id}
										</option>
									))}
								</select>
							)}
							<span className="stat-hint">点击模型调用行看上下文拆分</span>
						</header>
						{ledger === undefined ? (
							<LoadingState text="正在读取台账…" />
						) : ledger.sessionId === undefined ? (
							<EmptyState title="还没有台账数据（跑过任务后可见）。" />
						) : displayRuns.length === 0 ? (
							<EmptyState title="该会话的台账还没有泳道条目。" />
						) : (
							<>
								{displayRuns.map((run, i) => (
									<LedgerRunView
										key={`${run.runId}-${run.startedAt}-${i}`}
										run={run}
										snapshots={ledgerSnapshots}
										cacheReported={ledgerCacheReported}
										selectedLlm={selectedLlm}
										onSelectLlm={setSelectedLlm}
									/>
								))}
								{ledgerRuns.length > displayRuns.length && (
									<p className="stat-hint">
										只显示最近 {displayRuns.length} 个 run（共{" "}
										{ledgerRuns.length} 个）。
									</p>
								)}
							</>
						)}
					</section>
				</>
				)}
			</div>
		</main>
	);
}
