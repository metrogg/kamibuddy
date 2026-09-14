/**
 * 统计页：跨会话使用统计（spec: add-usage-stats）。
 *
 * 对标 WorkBuddy 的 `/stats` —— 但它是 CLI 侧的 TUI tabbed 面板 + HTTP API，
 * 桌面渲染层没有对应界面（逆向结论见 spec.md 的证据表），所以这里按它的
 * 数据契约与信息结构在桌面重画一份，而不是照搬 TUI。
 *
 * 数据只有一个来源：daemon 的 stats:usage 通道（daemon/usage-stats.ts 聚合，
 * 读会话文件全历史）。本页**不做任何聚合二次计算** —— 热力图的网格布局是
 * 唯一的派生，且用的是 shared/usage-stats.ts 里那份纯函数（一处实现，两端不漂移）。
 *
 * 刷新策略与诊断页一致：挂载拉一次，之后跟随会话事件刷新；
 * delta 类事件（流式增量）不改变聚合结果，跳过免得空转 —— 但统计页
 * 挂着不动的概率高（用户不会一边打字一边看统计），这个信号足够。
 *
 * 本页只 import @shared（AGENTS.md §1.3）。
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import {
	buildHeatmapWeeks,
	type HeatmapGrid,
	type UsageStats,
} from "@shared/usage-stats.ts";
import { IconBack, IconRefresh } from "./icons.tsx";

/* ── 格式化 ──────────────────────────────────────────────────────── */

/** 1234 → "1,234"；1234567 → "1.23M"。与诊断页同口径。 */
function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	return n.toLocaleString("en-US");
}

/** 美元：分以下显示四位（试用期单次会话常在几厘）。 */
function formatCost(usd: number): string {
	if (usd === 0) return "$0";
	return usd >= 0.01 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(4)}`;
}

function formatDuration(ms: number): string {
	const minutes = ms / 60_000;
	if (minutes < 1) return `${Math.round(ms / 1000)}s`;
	if (minutes < 60) return `${Math.round(minutes)}min`;
	const hours = minutes / 60;
	return hours < 24 ? `${hours.toFixed(1)}h` : `${(hours / 24).toFixed(1)}d`;
}

/** `2026-09-14` → `9/14`。 */
function formatDay(date: string): string {
	const parts = date.split("-");
	return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : date;
}

const MONTH_NAMES = [
	"1月", "2月", "3月", "4月", "5月", "6月",
	"7月", "8月", "9月", "10月", "11月", "12月",
];

/** 行 0 = 周日。只给奇数行标字（WorkBuddy 同款，网格才不挤）。 */
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const HEATMAP_LEVELS = 5;

/* ── 概览卡片 ────────────────────────────────────────────────────── */

function StatCard(props: {
	readonly label: string;
	readonly value: string;
	readonly hint?: string;
}): React.JSX.Element {
	return (
		<div className="stat-card">
			<div className="stat-value">{props.value}</div>
			<div className="stat-label">{props.label}</div>
			{props.hint !== undefined && <div className="stat-hint">{props.hint}</div>}
		</div>
	);
}

/* ── 热力图 ──────────────────────────────────────────────────────── */

function HeatmapGrid_view({
	grid,
	countByDate,
}: {
	readonly grid: HeatmapGrid;
	readonly countByDate: ReadonlyMap<string, number>;
}): React.JSX.Element {
	/** 把月度标签摊到每一列上（没有标签的列留空占位，靠 flex 对齐）。 */
	const monthCells = Array.from({ length: grid.totalWeeks }, (_, week) => {
		const label = grid.monthLabels.find((m) => m.week === week);
		return label === undefined ? "" : MONTH_NAMES[label.month];
	});

	return (
		<>
			<div className="stats-heat-months">
				<span className="stats-heat-gutter" />
				{monthCells.map((label, week) => (
					<span key={week} className="stats-heat-month">
						{label}
					</span>
				))}
			</div>
			{grid.weeks.map((row, day) => {
				const dateRow = grid.dates[day] ?? [];
				return (
					<div className="stats-heat-row" key={day}>
						<span className="stats-heat-gutter">
							{day % 2 === 1 ? WEEKDAY_LABELS[day] : ""}
						</span>
						{row.map((level, week) => {
							const date = dateRow[week] ?? "";
							if (date === "") {
								// 未来的格子：留一个透明占位，保持列宽对齐。
								return <span key={week} className="stats-heat-cell future" />;
							}
							const count = countByDate.get(date) ?? 0;
							return (
								<span
									key={week}
									className={`stats-heat-cell l${level}`}
									title={`${date}　${count} 条消息`}
								/>
							);
						})}
					</div>
				);
			})}
			<div className="stats-heat-legend">
				<span>少</span>
				{Array.from({ length: HEATMAP_LEVELS }, (_, level) => (
					<span key={level} className={`stats-heat-cell l${level}`} />
				))}
				<span>多</span>
			</div>
		</>
	);
}

/* ── 每日 token 趋势 ─────────────────────────────────────────────── */

const TREND_VIEW_WIDTH = 100;
const TREND_VIEW_HEIGHT = 30;

function TokenTrend({ stats }: { readonly stats: UsageStats }): React.JSX.Element {
	const points = stats.dailyTokens;
	if (points.length === 0) return <p className="settings-empty">还没有 token 记录。</p>;

	const max = Math.max(...points.map((p) => p.tokens));
	const step = points.length === 1 ? 0 : TREND_VIEW_WIDTH / (points.length - 1);
	// max 为 0 时整条线贴底（不该出现，但除零要挡住）。
	const toY = (value: number): number =>
		max === 0 ? TREND_VIEW_HEIGHT : TREND_VIEW_HEIGHT - (value / max) * TREND_VIEW_HEIGHT;
	const coords = points.map((p, i) => `${(i * step).toFixed(2)},${toY(p.tokens).toFixed(2)}`);
	const lastX = ((points.length - 1) * step).toFixed(2);
	const first = points[0] as { date: string; tokens: number };
	const last = points[points.length - 1] as { date: string; tokens: number };
	const peak = points.reduce((a, b) => (b.tokens > a.tokens ? b : a));

	return (
		<>
			<svg
				className="stats-trend"
				viewBox={`0 0 ${TREND_VIEW_WIDTH} ${TREND_VIEW_HEIGHT}`}
				preserveAspectRatio="none"
				role="img"
				aria-label={`每日 token 趋势：${points.length} 天，峰值 ${formatTokens(peak.tokens)}`}
			>
				<polygon
					className="stats-trend-area"
					points={`0,${TREND_VIEW_HEIGHT} ${coords.join(" ")} ${lastX},${TREND_VIEW_HEIGHT}`}
				/>
				<polyline
					className="stats-trend-line"
					points={coords.join(" ")}
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
			<div className="stat-hint">
				{formatDay(first.date)} → {formatDay(last.date)} · 共 {points.length} 天 ·
				峰值 {formatTokens(peak.tokens)}（{formatDay(peak.date)}）
			</div>
		</>
	);
}

/* ── 页面 ────────────────────────────────────────────────────────── */

export function StatsView({ onClose }: { onClose: () => void }): React.JSX.Element {
	const [stats, setStats] = useState<UsageStats | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	const refresh = useCallback(() => {
		window.kami
			.usageStats()
			.then((s) => {
				setStats(s);
				setError(undefined);
			})
			.catch((e: unknown) => {
				setError(e instanceof Error ? e.message : String(e));
			});
	}, []);

	useEffect(() => {
		refresh();
		const off = window.kami.onSessionEvent(({ event }) => {
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

	const grid = useMemo(
		() => (stats === undefined ? undefined : buildHeatmapWeeks(stats.heatmap)),
		[stats],
	);
	const countByDate = useMemo(
		() => new Map((stats?.heatmap ?? []).map((day) => [day.date, day.count])),
		[stats],
	);

	const empty =
		stats !== undefined && stats.totalSessions === 0 && stats.totalTokens.total === 0;

	return (
		<main className="settings">
			<header className="settings-head">
				<button type="button" className="bar-btn" aria-label="返回" onClick={onClose}>
					<IconBack size={17} />
				</button>
				<h1>使用统计</h1>
				<span className="bar-spacer" />
				<button type="button" className="mini-btn" title="重新拉取统计" onClick={refresh}>
					<IconRefresh size={13} />
					刷新
				</button>
			</header>

			<div className="settings-body">
				{error !== undefined && <div className="settings-error">{error}</div>}

				{stats === undefined ? (
					<p className="settings-empty">正在读取统计…</p>
				) : empty ? (
					<p className="settings-empty">还没有任何会话，先用一次再回来看。</p>
				) : (
					<>
						<section className="settings-section">
							<header className="settings-section-head">
								<h2>概览</h2>
								<span className="stat-hint">全部会话历史累计</span>
							</header>
							<div className="stat-grid">
								<StatCard label="会话数" value={String(stats.totalSessions)} />
								<StatCard label="消息数" value={formatTokens(stats.totalMessages)} />
								<StatCard
									label="总 tokens"
									value={formatTokens(stats.totalTokens.total)}
									hint={`输入 ${formatTokens(stats.totalTokens.input + stats.totalTokens.cacheRead)} / 输出 ${formatTokens(stats.totalTokens.output)}`}
								/>
								<StatCard
									label="估算费用"
									value={formatCost(stats.totalCost)}
									hint={
										stats.totalTokens.cacheRead > 0
											? `缓存读 ${formatTokens(stats.totalTokens.cacheRead)}`
											: undefined
									}
								/>
							</div>
							<div className="stat-grid">
								<StatCard
									label="活跃天数"
									value={String(stats.activeDays)}
									hint={stats.totalDays === 0 ? undefined : `共 ${stats.totalDays} 天跨度`}
								/>
								<StatCard
									label="当前连续"
									value={`${stats.streakDays} 天`}
									hint={stats.streakDays === 0 ? "今天还没动" : "含今天"}
								/>
								<StatCard label="最长连续" value={`${stats.longestStreakDays} 天`} />
								<StatCard
									label="峰值时段"
									value={stats.peakHour === undefined ? "—" : `${stats.peakHour}:00`}
									hint="消息最密集的小时"
								/>
							</div>
							{stats.longestSessionMs !== undefined && (
								<p className="stat-hint">
									最长一次会话 {formatDuration(stats.longestSessionMs)} · 平均每次会话{" "}
									{formatDuration(stats.averageSessionMs)}
								</p>
							)}
						</section>

						<section className="settings-section">
							<header className="settings-section-head">
								<h2>用量热力图</h2>
								<span className="stat-hint">颜色越深当天消息越多</span>
							</header>
							{grid === undefined ? null : (
								<div className="stats-heat-wrap">
									<HeatmapGrid_view grid={grid} countByDate={countByDate} />
								</div>
							)}
						</section>

						<section className="settings-section">
							<header className="settings-section-head">
								<h2>每日 token</h2>
								<span className="stat-hint">含缓存读写</span>
							</header>
							<TokenTrend stats={stats} />
						</section>

						<section className="settings-section">
							<header className="settings-section-head">
								<h2>模型用量</h2>
								<span className="stat-hint">按 token 降序</span>
							</header>
							<table className="stat-table">
								<tbody>
									{stats.modelUsage.slice(0, 12).map((usage) => (
										<tr key={usage.model}>
											<td>{usage.model}</td>
											<td>{usage.count} 次</td>
											<td>{formatTokens(usage.tokens)}</td>
											<td>{formatCost(usage.cost)}</td>
										</tr>
									))}
								</tbody>
							</table>
							{stats.modelUsage.length > 12 && (
								<p className="stat-hint">仅显示前 12 个模型。</p>
							)}
						</section>

						<section className="settings-section">
							<header className="settings-section-head">
								<h2>工具排行</h2>
								<span className="stat-hint">按调用数降序</span>
							</header>
							<table className="stat-table">
								<tbody>
									{stats.toolUsage.slice(0, 12).map((usage) => (
										<tr key={usage.tool}>
											<td>{usage.tool}</td>
											<td>{usage.count} 次</td>
											<td className={usage.errors > 0 ? "stat-err" : undefined}>
												{usage.errors > 0 ? `${usage.errors} 次失败` : "无失败"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							{stats.toolUsage.length > 12 && (
								<p className="stat-hint">仅显示前 12 个工具。</p>
							)}
						</section>
					</>
				)}
			</div>
		</main>
	);
}
