/**
 * 任务诊断面板 —— 诊断对应任务（右侧栏第三态）。
 *
 * 信息架构（2026-09-15 重排）：
 *   - 本面板 = **单个任务**的微观诊断：这一轮、这一步到底发生了什么
 *   - 统计页 = 跨会话宏观：热力图、模型 / 工具排行、费用
 *   - 诊断页 = 机器级环境自检：热键、docx venv、观测健康
 * 在此之前这三件事挤在同一个「诊断」页里 —— 它那 7 个区块只有 1 个名副其实。
 *
 * **数据全部来自运行台账**（`runLedger(sessionId)` → `run-timeline` 的 fold），
 * 不新增采集：轮 / 步、耗时、TTFT、tokens、缓存、工具、重试、压缩都在台账里；
 * 会话级汇总复用 `conversation.sessionStats`（daemon 的 session_stats 事件）。
 *
 * 容器骨架复用 SourcesPanel 那套（preview-panel / preview-head / preview-view），
 * 与 ArtifactPanel、SourcesPanel 同位互斥。
 *
 * **跟随会话**（用户决策）：切会话不关面板，只换数据源 —— 它存在的意义就是
 * 「诊断对应任务」，关掉反而要用户重开。所以它由自己的开关控制，不参与
 * closePreviewPanel 的会话级清理。
 *
 * 本组件只 import @shared（AGENTS.md §1.3）。
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatTokenCount } from "@shared/context-usage.ts";
import type { RunLedgerResult } from "@shared/ipc.ts";
import {
	averageTtftMs,
	billedInputTokens,
	cacheHitRate,
	decodeTokensPerSecond,
	stepDecode,
	type LlmCallData,
	type RunEndReason,
	type SessionStatCard,
	type ToolCallData,
} from "@shared/observability.ts";
import { isStreamingEvent } from "@shared/session-events.ts";
import { IconClose } from "./icons.tsx";
import { formatCost, formatSpan, formatThroughput } from "./reading-format.ts";
import { foldRunLedger, type LedgerItem, type LedgerRun } from "./run-timeline.ts";
import { EmptyState, ErrorState, LoadingState } from "./state-views.tsx";

/** run 终态的中文标签（诊断页有同款私有映射，它瘦身后可合并到这里）。 */
const END_REASON_LABELS: Record<RunEndReason, string> = {
	completed: "成功",
	cancelled: "已取消",
	error: "失败",
	interrupted: "中断",
};

/** `14:23:45`（只到秒：台账面板看的是相对顺序，不是精确时刻）。 */
function formatClock(ts: number): string {
	const d = new Date(ts);
	const pad = (v: number): string => String(v).padStart(2, "0");
	return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ── ① 会话总览 ──────────────────────────────────────────────────── */

function SessionOverview({
	stats,
}: {
	readonly stats: SessionStatCard | undefined;
}): React.JSX.Element {
	if (stats === undefined) {
		return (
			<p className="task-diag-note">
				还没有跑过任何一轮 —— 会话读数会在第一轮结束后出现。
			</p>
		);
	}
	const hit = stats.cacheHitRate;
	const ttft = averageTtftMs(stats);
	const throughput = decodeTokensPerSecond(stats);

	return (
		<section className="task-diag-section">
			<h2 className="task-diag-heading">会话总览</h2>
			<dl className="task-diag-kv">
				<div>
					<dt>轮次 / 步数</dt>
					<dd>
						{stats.runs} / {stats.turns}
					</dd>
				</div>
				<div>
					<dt>模型耗时</dt>
					<dd>{formatSpan(stats.llmMs)}</dd>
				</div>
				<div>
					<dt>工具耗时</dt>
					<dd>{formatSpan(stats.toolMs)}</dd>
				</div>
				{ttft !== undefined && (
					<div>
						<dt>首 token 平均</dt>
						<dd>{formatSpan(ttft)}</dd>
					</div>
				)}
				{throughput !== undefined && (
					<div>
						<dt>生成速度</dt>
						<dd>{formatThroughput(throughput)} tok/s</dd>
					</div>
				)}
				{hit !== undefined && (
					<div>
						<dt>缓存命中</dt>
						<dd>{Math.round(hit * 100)}%</dd>
					</div>
				)}
				<div>
					<dt>输入 / 输出</dt>
					<dd>
						{formatTokenCount(billedInputTokens(stats.usage))} /{" "}
						{formatTokenCount(stats.usage.output)}
					</dd>
				</div>
				<div>
					<dt>费用</dt>
					<dd>{formatCost(stats.usage.cost)}</dd>
				</div>
			</dl>
		</section>
	);
}

/* ── ③ 轮 / 步台账 ───────────────────────────────────────────────── */

/** 一步（模型调用）行：耗时 / tokens / TTFT / 速度 / 缓存，一行看齐。 */
function StepRow({ data }: { readonly data: LlmCallData }): React.JSX.Element {
	const usage = data.usage;
	const hit = usage === undefined ? undefined : cacheHitRate(usage);
	// 解码速度与 daemon 的累加共用一处判定（shared 的 stepDecode）——
	// 两处各算一遍必然漂移，而 tok/s 的分子分母最经不起这个。
	const decode = stepDecode(data);
	const throughput =
		decode === undefined || decode.ms === 0 ? undefined : decode.tokens / (decode.ms / 1_000);

	return (
		<div className="task-diag-step" title={data.errorMessage}>
			<span className="task-diag-step-name">模型 #{data.turnIndex + 1}</span>
			<span className="task-diag-num">{formatSpan(data.endedAt - data.startedAt)}</span>
			{usage !== undefined && (
				<span className="task-diag-num">
					↑{formatTokenCount(billedInputTokens(usage))} ↓
					{formatTokenCount(usage.output)}
				</span>
			)}
			{data.ttftMs !== undefined && (
				<span className="task-diag-num">TTFT {formatSpan(data.ttftMs)}</span>
			)}
			{throughput !== undefined && (
				<span className="task-diag-num">{formatThroughput(throughput)} tok/s</span>
			)}
			{hit !== undefined && (
				<span className="task-diag-num">缓存 {Math.round(hit * 100)}%</span>
			)}
			{data.stopReason !== undefined && !isNormalStop(data.stopReason) && (
				<span className="stat-hint">{data.stopReason}</span>
			)}
			{data.errorMessage !== undefined && <span className="stat-err">失败</span>}
		</div>
	);
}

/** 正常收尾的 stopReason 不占位（`stop` / `toolUse` 是每步的常态）。 */
function isNormalStop(reason: string): boolean {
	return reason === "stop" || reason === "toolUse";
}

function ToolRow({ data }: { readonly data: ToolCallData }): React.JSX.Element {
	return (
		<div
			className={`task-diag-tool${data.outcome === "error" ? " stat-err" : ""}`}
			title={data.summary}
		>
			<span className="task-diag-tool-name">{data.toolName}</span>
			{data.summary !== "" && (
				<span className="task-diag-tool-summary">{data.summary}</span>
			)}
			<span className="task-diag-num">
				{formatSpan(Math.max(0, data.endedAt - data.startedAt))}
			</span>
		</div>
	);
}

/** 一条账目行（步 / 工具 / 重试 / 压缩）。 */
function ItemRow({ item }: { readonly item: LedgerItem }): React.JSX.Element {
	if (item.kind === "llm") return <StepRow data={item.data} />;
	if (item.kind === "tool") return <ToolRow data={item.data} />;
	if (item.kind === "retry") {
		const d = item.data;
		return (
			<div className="task-diag-note-line">
				{d.phase === "start"
					? `重试：第 ${d.attempt} 次，${formatSpan(d.delayMs ?? 0)} 后发起`
					: d.success === true
						? "重试成功"
						: "重试耗尽"}
			</div>
		);
	}
	const d = item.data;
	const reason = d.reason === "manual" ? "手动" : d.reason === "threshold" ? "阈值" : "溢出";
	return (
		<div className="task-diag-note-line">
			上下文压缩（{reason}）
			{d.tokensBefore === undefined
				? ""
				: ` · 压缩前 ${formatTokenCount(d.tokensBefore)} tok`}
		</div>
	);
}

/** 一个 run：边界行 + 条目行 + 收束行（对齐 dsh ledger 的轮边界语义）。 */
function RunBlock({ run }: { readonly run: LedgerRun }): React.JSX.Element {
	const hit = run.usage === undefined ? undefined : cacheHitRate(run.usage);
	return (
		<li className="task-diag-run">
			<div className="task-diag-run-head">
				<span className="task-diag-clock">{formatClock(run.startedAt)}</span>
				<span>开始</span>
				{run.modelId !== undefined && (
					<span className="task-diag-model">{run.modelId}</span>
				)}
			</div>
			{run.items.map((item, index) => (
				// 台账条目没有稳定 id（seq 在 fold 后不再保留），序号即其位置。
				<ItemRow key={`${item.kind}-${index}`} item={item} />
			))}
			<div className="task-diag-run-foot">
				{run.endedAt === undefined ? (
					<span className="task-diag-running">进行中</span>
				) : (
					<>
						<span
							className={run.endReason === "completed" ? "stat-ok" : "stat-err"}
							title={run.error}
						>
							{END_REASON_LABELS[run.endReason ?? "interrupted"]}
						</span>
						<span>共 {formatSpan(run.endedAt - run.startedAt)}</span>
					</>
				)}
				{run.usage !== undefined && (
					<span>{formatTokenCount(run.usage.totalTokens)} tok</span>
				)}
				{hit !== undefined && <span>缓存 {Math.round(hit * 100)}%</span>}
			</div>
		</li>
	);
}

/* ── 面板 ────────────────────────────────────────────────────────── */

export function TaskDiagnosticsPanel({
	sessionId,
	stats,
	width,
	onClose,
}: {
	/** 当前会话 id（`""` = 还没建会话，daemon 会回退到最近有台账的会话）。 */
	readonly sessionId: string;
	/** 会话级汇总（daemon 的 session_stats 投影，`conversation.sessionStats`）。 */
	readonly stats: SessionStatCard | undefined;
	/** 面板宽度（px）：与 ArtifactPanel / SourcesPanel 同一份 panelWidth。 */
	readonly width: number;
	readonly onClose: () => void;
}): React.JSX.Element {
	const [ledger, setLedger] = useState<RunLedgerResult | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	const refresh = useCallback(() => {
		window.kami
			.runLedger(sessionId === "" ? undefined : sessionId)
			.then((result) => {
				setLedger(result);
				setError(undefined);
			})
			.catch((e: unknown) => {
				setError(e instanceof Error ? e.message : String(e));
			});
	}, [sessionId]);

	useEffect(() => {
		// 换会话先复位：留着上一个任务的台账会让人以为数据串了（它此刻确实串了）。
		setLedger(undefined);
		refresh();
		// 台账只在台账条目变化时才变，流式增量与进度类事件跳过（名单在 shared）。
		const off = window.kami.onSessionEvent(({ event }) => {
			if (isStreamingEvent(event)) return;
			refresh();
		});
		return off;
	}, [refresh]);

	const runs = useMemo(() => foldRunLedger(ledger?.entries ?? []), [ledger]);

	return (
		<aside className="preview-panel task-diag-panel" style={{ width: `${width}px` }}>
			<header className="preview-head">
				<span className="task-diag-title">任务诊断</span>
				<button
					type="button"
					className="bar-btn"
					title="关闭"
					aria-label="关闭任务诊断"
					onClick={onClose}
				>
					<IconClose size={14} />
				</button>
			</header>
			<div className="preview-view task-diag-body">
				<SessionOverview stats={stats} />
				{error !== undefined && <ErrorState message={error} />}
				{ledger === undefined ? (
					<LoadingState text="正在读取台账…" />
				) : runs.length === 0 ? (
					<EmptyState title="这个任务还没有跑过任何一轮。" />
				) : (
					<section className="task-diag-section">
						<h2 className="task-diag-heading">轮 / 步台账</h2>
						<ol className="task-diag-runs">
							{/* 展示序：新的在前（与「最近任务」一致，最近发生的最该看见）。 */}
							{[...runs].reverse().map((run, index) => (
								<RunBlock key={`${run.runId}-${run.startedAt}-${index}`} run={run} />
							))}
						</ol>
					</section>
				)}
			</div>
		</aside>
	);
}
