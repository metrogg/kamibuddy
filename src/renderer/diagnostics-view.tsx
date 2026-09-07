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

import { useCallback, useEffect, useState } from "react";
import type {
	ObservabilitySnapshot,
	RunRecord,
	TokenUsage,
} from "@shared/observability.ts";
import { cacheHitRate } from "@shared/observability.ts";
import { IconBack, IconChart, IconRefresh } from "./icons.tsx";

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
		return <p className="settings-empty">还没有会话内容。</p>;

	const total = COMPOSITION_PARTS.reduce(
		(sum, p) => sum + composition[p.key],
		0,
	);
	if (total === 0) return <p className="settings-empty">还没有会话内容。</p>;

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
		return <p className="settings-empty">这个任务没有调用工具。</p>;
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

	useEffect(() => {
		refresh();
		// 会话事件 = 统计变了的信号。delta 类事件不改变聚合结果，跳过免得空转。
		const off = window.kami.onSessionEvent((event) => {
			if (
				event.type === "assistant_text_delta" ||
				event.type === "assistant_thinking_delta" ||
				event.type === "tool_progress"
			) {
				return;
			}
			refresh();
		});
		return off;
	}, [refresh]);

	const hitRate =
		snapshot === undefined ? undefined : cacheHitRate(snapshot.totalUsage);
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
					onClick={refresh}
				>
					<IconRefresh size={13} />
					刷新
				</button>
			</header>

			<div className="settings-body">
				{error !== undefined && <div className="settings-error">{error}</div>}

				{snapshot === undefined ? (
					<p className="settings-empty">正在读取统计…</p>
				) : (
					<>
						<section className="settings-section">
							<header className="settings-section-head">
								<h2>用量概览</h2>
								<span className="stat-hint">本次启动至今累计</span>
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

						<section className="settings-section">
							<header className="settings-section-head">
								<h2>上下文组成</h2>
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
								<p className="settings-empty">还没有跑过任务。</p>
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
					</>
				)}
			</div>
		</main>
	);
}
