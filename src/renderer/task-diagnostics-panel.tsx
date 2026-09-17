/**
 * 任务诊断面板 —— 诊断对应任务（右侧栏第三态）。
 *
 * 信息架构（2026-09-15 重排，09-16 补齐 ②③④、② 升级为成分视图）：
 *   ① 会话总览     —— 这个任务一共多少轮 / 多少步 / 花了多少（会话级累计）
 *   ② 上下文       —— 完整的上下文组成，两个可折叠成分块：
 *                     「占用与分类」= **现在**（pi 精确值 + 分类估算）；
 *                     「最近一次入模拆分」= **当时**（台账最后一条快照，真实计数）
 *   ③ 轮 / 步台账  —— 时间序的条目流水，工具挂在自己那一步之下
 *   ④ 单步详情     —— 点开某一步：计时五要素 + token 全字段 + 该轮**当时**的入模拆分
 *                     + 缓存命中前缀断点（CACHE6：第几条起没命中、为什么）
 * 本面板是**单个任务**的微观诊断；统计页是跨会话宏观；诊断页是机器级环境自检。
 * 在此之前这三件事挤在同一个「诊断」页里 —— 它那 7 个区块只有 1 个名副其实。
 *（设置页的提示词预览只管系统提示词；完整上下文按任务走这里 —— 2026-09-16 用户定。）
 *
 * ② 与 ④ 里都出现「上下文」，含义不同，不许混（shared/context-usage.ts 文件头的纪律）：
 *   ② 是**现在**（`getContextUsage()` 的实时 used/total + 分类估算，随对话滚动）；
 *   ④ 是**当时**（`request_snapshot`，冻结在那一刻的真实入模拆分）。
 * 两处文案各自标了「实时」/「该轮（当时）」，别在后来的改动里把标注删掉。
 *
 * **数据全部来自运行台账**（`runLedger(sessionId)` → run-timeline 的两级 fold），
 * 不新增采集：轮 / 步、耗时、TTFT、tokens（含 reasoning）、缓存读写、工具、
 * 重试、压缩、每轮入模快照都在台账里；会话级汇总复用 `conversation.sessionStats`。
 *
 * 容器骨架复用 SourcesPanel 那套（preview-panel / preview-head / preview-view），
 * 与 ArtifactPanel、SourcesPanel 同位互斥。
 *
 * **跟随会话**（用户决策）：切会话不关面板，只换数据源 —— 它存在的意义就是
 * 「诊断对应任务」，关掉反而要用户重开。所以它由自己的开关控制，不参与
 * closePreviewPanel 的会话级清理。
 *
 * **④ 做成列表内联展开，而不是像 dsh 那样再开一个 inspector 面板**：右侧栏本身
 * 已经是窄栏（默认 440），再分一层双栏两边都不够用；内联还能保证答案紧贴被点的
 * 那一行（长 run 里一步可能挂十几个工具，另开面板会把问题和答案分开）。
 * 展开块排在**该步的工具行之前**：它是「这一步花了多少、看到了什么」的答案，
 * 直接接在被点的那行下面；工具行随后补上「它做了什么」。
 *
 * 本组件只 import @shared（AGENTS.md §1.3）。
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import type { CachePrefixBoundary } from "@shared/cache-prefix.ts";
import { formatTokenCount, type ContextUsageDetail } from "@shared/context-usage.ts";
import type { RunLedgerResult } from "@shared/ipc.ts";
import {
	averageTtftMs,
	billedInputTokens,
	cacheHitRate,
	decodeTokensPerSecond,
	stepDecode,
	type LlmCallData,
	type RequestSnapshotData,
	type RunEndReason,
	type SessionStatCard,
	type ToolCallData,
} from "@shared/observability.ts";
import { isStreamingEvent } from "@shared/session-events.ts";
import { ContextUsageBreakdown } from "./context-usage.tsx";
import { IconChevronDown, IconChevronRight, IconClose } from "./icons.tsx";
import { formatCost, formatSpan, formatThroughput } from "./reading-format.ts";
import {
	foldCachePrefixBreaks,
	foldRunLedger,
	foldRunSteps,
	indexRequestSnapshots,
	latestRequestSnapshot,
	snapshotKey,
	type LedgerRun,
	type LedgerStep,
	type LedgerStepItem,
} from "./run-timeline.ts";
import { MESSAGE_CLASS_LABELS, SnapshotBreakdown } from "./snapshot-breakdown.tsx";
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

/**
 * 一个 run 在「展开哪一步」这件事上的稳定身份。
 *
 * 单用 runId 不够：它是进程内自增（run-N），daemon 重启后跨代际撞名
 *（foldRunLedger 文件头已记），那样新老两轮的同一个步号会一起展开。
 * 带上 run 的 startedAt（毫秒级，实际不可能重复）即可唯一。
 */
function runKeyOf(run: LedgerRun): string {
	return `${run.runId}#${run.startedAt}`;
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

/* ── ② 上下文（现在） ────────────────────────────────────────────── */

/**
 * ② 的折叠块：默认收起（右栏是窄栏，全展开会把台账挤没），展开态不持久 ——
 * 诊断是即看即走的行为。两种形态二选一：
 *   - children：数据已在手（台账 / 会话 state 折叠而来）；
 *   - onLoad：惰性取全文（系统提示词 / hidden context 块），**每次展开都重拉** ——
 *     这些内容随 run 变化（注入块按 run 冻结、系统提示词随两轴变），缓存住
 *     第一次的结果就是陈旧数据（2026-09-16 实测：重启后先点开再跑任务，
 *     空结果被缓存住，跑了多少轮都显示「还没跑过」）。换会话由 resetKey 清态。
 */
function Fold({
	label,
	hint,
	emptyText,
	resetKey,
	onLoad,
	children,
}: {
	readonly label: string;
	readonly hint: string;
	/** onLoad 路径下取到空串时的占位（children 形态的空态由 children 自理）。 */
	readonly emptyText?: string;
	/** 换会话时清掉已取内容（面板跟随会话，onLoad 的结果不能跨会话残留）。 */
	readonly resetKey?: string;
	readonly onLoad?: () => Promise<string | undefined>;
	readonly children?: React.ReactNode;
}): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const [text, setText] = useState<string | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	// 换会话即作废：sessionId 变了，上次取的全文就是别的任务的。
	useEffect(() => {
		setText(undefined);
		setError(undefined);
	}, [resetKey]);

	const toggle = (): void => {
		const next = !open;
		setOpen(next);
		if (next && onLoad !== undefined) {
			setText(undefined);
			setError(undefined);
			// 过一层微任务：onLoad 若同步抛（如窗口里还没有新加的桥方法 ——
			// preload 不吃 HMR，改完必须重启进程），也会落进拒绝分支显示错误，
			// 而不是把面板永远钉在「正在读取」。
			Promise.resolve()
				.then(onLoad)
				.then(
					(value) => setText(value ?? ""),
					(e: unknown) => setError(e instanceof Error ? e.message : String(e)),
				);
		}
	};

	return (
		<div className="task-diag-fold">
			<button
				type="button"
				className="task-diag-fold-head"
				aria-expanded={open}
				onClick={toggle}
			>
				<span className={`seg-chevron${open ? " open" : ""}`}>
					<IconChevronRight size={12} />
				</span>
				<span>{label}</span>
				<span className="stat-hint">{hint}</span>
			</button>
			{open && (
				<div className="task-diag-fold-body">
					{onLoad === undefined ? (
						children
					) : error !== undefined ? (
						<p className="stat-err">{error}</p>
					) : text === undefined ? (
						<LoadingState text="正在读取…" />
					) : text === "" ? (
						<p className="task-diag-note">{emptyText}</p>
					) : (
						<pre className="seg-body">{text}</pre>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * ② 上下文：完整的上下文组成与实际内容（2026-09-16 用户定，从设置页挪过来 ——
 * 每个任务的上下文不一样，全局设置页放不下这个概念）。
 *
 * 四个成分块，两类口径不许混（shared/context-usage.ts 纪律）：
 *   - 「占用与分类」= **现在**：pi 精确 used/total + 分类估算（~ 前缀那套）；
 *   - 「最近一次入模拆分」= **当时**：台账最后一条 request_snapshot 的真实
 *     计数（系统分段 + 消息组成 + hidden context 注入量）；
 *   - 「系统提示词全文」= prompt:preview 同一条组装路径现算（不含 pi 上下文段，
 *     页脚口径同设置页预览）；
 *   - 「hidden context 注入块」= 宿主最近一次注入的全文（run 结束仍可看）。
 */
function ContextSection({
	detail,
	latestSnapshot,
	axes,
	sessionId,
}: {
	readonly detail: ContextUsageDetail | undefined;
	readonly latestSnapshot: RequestSnapshotData | undefined;
	readonly axes: { readonly sceneId: string; readonly interactionId: string; readonly expertId: string | undefined };
	/** 当前会话 id —— hidden 注入块的换会话清态键。 */
	readonly sessionId: string;
}): React.JSX.Element {
	return (
		<section className="task-diag-section">
			<h2 className="task-diag-heading">
				上下文
				<span className="stat-hint">实时</span>
			</h2>
			<Fold label="占用与分类" hint="现在 · 分类为估算">
				{detail === undefined ? (
					<p className="task-diag-note">
						还没有过带用量的响应 —— 占用读数会在第一轮结束后出现。
					</p>
				) : (
					// 与输入条上的圆环浮层是同一个组件：分类的「估算」标注只此一份。
					<ContextUsageBreakdown detail={detail} />
				)}
			</Fold>
			<Fold label="最近一次入模拆分" hint="当时 · 真实计数">
				{latestSnapshot === undefined ? (
					<p className="task-diag-note">
						还没有过模型调用 —— 拆分随第一轮出现。
					</p>
				) : (
					<SnapshotBreakdown snapshot={latestSnapshot} />
				)}
			</Fold>
			<Fold
				label="系统提示词全文"
				hint="按当前两轴现算 · 不含 pi 上下文段"
				emptyText="还没有内容。"
				resetKey={axes.sceneId + axes.interactionId + (axes.expertId ?? "")}
				onLoad={async () => {
					const preview = await window.kami.promptPreview({
						sceneId: axes.sceneId,
						modeId: axes.interactionId,
						...(axes.expertId === undefined ? {} : { expertId: axes.expertId }),
					});
					return preview.segments.map((s) => s.text).join("");
				}}
			/>
			<Fold
				label="hidden context 注入块"
				hint="最近一次 · 注入到最后一条用户消息之前"
				emptyText="还没有跑过任何一轮 —— 注入块随第一次发送出现。"
				resetKey={sessionId}
				onLoad={() => window.kami.hiddenContext()}
			/>
		</section>
	);
}

/* ── ④ 单步详情（内联展开） ──────────────────────────────────────── */

/**
 * 缓存命中前缀断点（CACHE6）的结论 —— 一行文字，不做卡片。
 *
 * 结论本身由 shared 的 inferCachePrefixBreak 定好（哪种形态对应哪种说法），
 * 这里只负责措辞与「第几条」的 1-based 换算：反推算法在 shared（可单测），
 * 台账配对在 run-timeline 的 foldCachePrefixBreaks，展示只此一处。
 * 结论本身是**估算对齐**出来的（token 是字符估算、前缀靠上一轮定标），
 * 所以 `uncertain` 有值时如实再补一行，绝不把估算说成账单。
 */
function CachePrefixNote({
	boundary,
}: {
	readonly boundary: CachePrefixBoundary;
}): React.JSX.Element {
	if (boundary.kind === "unknown") {
		return <p className="task-diag-note">缓存断点：{boundary.note}</p>;
	}
	if (boundary.kind === "before_messages") {
		return (
			<>
				<p className="task-diag-note">
					缓存断点：本轮前缀在消息列表之前就断了（系统提示词 / 工具定义变了，或缓存整体失效），消息一条都没命中。
				</p>
				{boundary.uncertain !== undefined && (
					<p className="task-diag-note">{boundary.uncertain}</p>
				)}
			</>
		);
	}
	if (boundary.kind === "all_hit") {
		return (
			<>
				<p className="task-diag-note">缓存断点：本轮 {boundary.hitCount} 条消息全部命中前缀。</p>
				{boundary.uncertain !== undefined && (
					<p className="task-diag-note">{boundary.uncertain}</p>
				)}
			</>
		);
	}
	const change =
		boundary.change === "appended"
			? "本轮新增的"
			: boundary.change === "changed"
				? "内容变了"
				: boundary.change === "moved"
					? "位置变了"
					: "与上一轮相同";
	return (
		<>
			<p className="task-diag-note">
				缓存断点：前缀在第 {boundary.hitCount + 1} 条消息（
				{MESSAGE_CLASS_LABELS[boundary.message.role]}）处断开 —— 该条是{change}
				，前 {boundary.hitCount} 条命中。
			</p>
			{boundary.uncertain !== undefined && <p className="task-diag-note">{boundary.uncertain}</p>}
		</>
	);
}

/** 点开某一步后的详情：计时五要素 + token 全字段 + 该轮当时的入模拆分。 */
function StepDetail({
	call,
	snapshot,
	boundary,
	cacheReported,
}: {
	readonly call: LlmCallData;
	readonly snapshot: RequestSnapshotData | undefined;
	/** 该轮的缓存命中前缀断点（台账里没有可比对的上一轮时为 undefined）。 */
	readonly boundary: CachePrefixBoundary | undefined;
	/** provider 是否上报过缓存活动（会话级，见 StepRow）。 */
	readonly cacheReported: boolean;
}): React.JSX.Element {
	const usage = call.usage;
	// 解码窗口与 daemon 的会话级累加共用一处判定（shared 的 stepDecode）——
	// 两处各算一遍必然漂移，而 tok/s 的分子分母最经不起这个。
	const decode = stepDecode(call);
	const throughput =
		decode === undefined || decode.ms === 0 ? undefined : decode.tokens / (decode.ms / 1_000);
	const hit = usage === undefined ? undefined : cacheHitRate(usage, cacheReported);

	return (
		<div className="task-diag-detail">
			<dl className="task-diag-kv">
				<div>
					<dt>开始</dt>
					<dd>{formatClock(call.startedAt)}</dd>
				</div>
				<div>
					<dt>耗时</dt>
					<dd>{formatSpan(Math.max(0, call.endedAt - call.startedAt))}</dd>
				</div>
				{call.ttftMs !== undefined && (
					<div title="首个 text/thinking delta 到达时刻 − 本轮开始">
						<dt>首 token</dt>
						<dd>{formatSpan(call.ttftMs)}</dd>
					</div>
				)}
				{decode !== undefined && (
					<div title="首字之后到消息完成的耗时（总耗时 − 首 token）">
						<dt>生成时长</dt>
						<dd>{formatSpan(decode.ms)}</dd>
					</div>
				)}
				{throughput !== undefined && (
					<div title="输出 token ÷ 生成时长">
						<dt>生成速度</dt>
						<dd>{formatThroughput(throughput)} tok/s</dd>
					</div>
				)}
				{call.stopReason !== undefined && (
					<div>
						<dt>停止原因</dt>
						<dd>{call.stopReason}</dd>
					</div>
				)}
			</dl>
			{usage === undefined ? (
				<p className="task-diag-note">这一轮没有 usage 上报（模型报错等无响应场景）。</p>
			) : (
				<dl className="task-diag-kv">
					<div title="input + cacheRead + cacheWrite（三个互不相交的计费桶之和）">
						<dt>输入</dt>
						<dd>{formatTokenCount(billedInputTokens(usage))} tok</dd>
					</div>
					<div>
						<dt>输出</dt>
						<dd>{formatTokenCount(usage.output)} tok</dd>
					</div>
					{/* reasoning ⊂ output（pi 对该子集关系有明确标注），所以它是「其中」，
					    不参与任何合计。provider 上报的真实值，不加 ~（~ 在本项目专指估算）。 */}
					{usage.reasoning !== undefined && (
						<div title="思考 token 是 output 的子集，已包含在上面的「输出」里">
							<dt>其中思考</dt>
							<dd>{formatTokenCount(usage.reasoning)} tok</dd>
						</div>
					)}
					<div>
						<dt>缓存读 / 写</dt>
						<dd>
							{formatTokenCount(usage.cacheRead)} / {formatTokenCount(usage.cacheWrite)}
						</dd>
					</div>
					<div>
						<dt>缓存命中</dt>
						<dd>{hit === undefined ? "—" : `${Math.round(hit * 100)}%`}</dd>
					</div>
					<div>
						<dt>合计</dt>
						<dd>{formatTokenCount(usage.totalTokens)} tok</dd>
					</div>
					<div>
						<dt>费用</dt>
						<dd>{formatCost(usage.cost)}</dd>
					</div>
				</dl>
			)}
			{call.errorMessage !== undefined && (
				<p className="task-diag-note stat-err">{call.errorMessage}</p>
			)}
			{boundary !== undefined && <CachePrefixNote boundary={boundary} />}
			<p className="stat-hint">该轮真实入模拆分（当时）</p>
			{snapshot === undefined ? (
				<p className="task-diag-note">该轮没有请求快照（无组装来源或旧台账）。</p>
			) : (
				<SnapshotBreakdown snapshot={snapshot} />
			)}
		</div>
	);
}

/* ── ③ 轮 / 步台账 ───────────────────────────────────────────────── */

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

/** 一条挂在该步之下的账目行（工具 / 重试 / 压缩）。 */
function RestRow({ item }: { readonly item: LedgerStepItem }): React.JSX.Element {
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

/** 一步：可点开的行（+ 展开的详情）+ 它之后的工具与状态行。 */
function StepBlock({
	step,
	stepKey,
	run,
	snapshots,
	breaks,
	cacheReported,
	expanded,
	onToggle,
}: {
	readonly step: LedgerStep;
	readonly stepKey: string;
	readonly run: LedgerRun;
	readonly snapshots: ReadonlyMap<string, RequestSnapshotData>;
	readonly breaks: ReadonlyMap<string, CachePrefixBoundary>;
	readonly cacheReported: boolean;
	readonly expanded: boolean;
	readonly onToggle: (key: string) => void;
}): React.JSX.Element {
	const call = step.call;
	// 该步的键：快照与缓存断点都用同一个（runId + turnIndex），三处检索不各写一遍。
	const key = call === undefined ? undefined : snapshotKey(run.runId, call.turnIndex);

	return (
		<div className="task-diag-step-group">
			{call === undefined ? (
				// 台账截尾（daemon 只留最新 N 条）后可能出现的无主条目：
				// 照常展示，只是不编造「它属于哪一步」。
				<div className="task-diag-note-line">
					以下条目在本窗口内没有对应的模型调用（台账截尾）
				</div>
			) : (
				<StepRow
					data={call}
					cacheReported={cacheReported}
					expanded={expanded}
					onToggle={() => onToggle(stepKey)}
				/>
			)}
			{expanded && call !== undefined && key !== undefined && (
				<StepDetail
					call={call}
					cacheReported={cacheReported}
					snapshot={snapshots.get(key)}
					boundary={breaks.get(key)}
				/>
			)}
			{step.rest.map((item, index) => (
				// 台账条目在 fold 后不再保留 seq，位置即其身份。
				<RestRow key={`${item.kind}-${index}`} item={item} />
			))}
		</div>
	);
}

/** 一步（模型调用）的可点开行：耗时 / tokens / TTFT / 速度 / 缓存，一行看齐。 */
function StepRow({
	data,
	cacheReported,
	expanded,
	onToggle,
}: {
	readonly data: LlmCallData;
	/**
	 * provider 是否上报过缓存活动。**来自会话卡**（SessionStatCard.cacheReported）
	 * 而不是这一步自己的 usage：单步看不出「0 命中」是「真的全 miss」还是
	 * 「这个 provider 不报缓存」，拿单步现算会把后者说成 0%。
	 */
	readonly cacheReported: boolean;
	readonly expanded: boolean;
	readonly onToggle: () => void;
}): React.JSX.Element {
	const usage = data.usage;
	const hit = usage === undefined ? undefined : cacheHitRate(usage, cacheReported);
	const decode = stepDecode(data);
	const throughput =
		decode === undefined || decode.ms === 0 ? undefined : decode.tokens / (decode.ms / 1_000);

	return (
		<button
			type="button"
			className="task-diag-step task-diag-step-btn"
			aria-expanded={expanded}
			title={data.errorMessage ?? "点开看这一步的计时、token 与该轮入模拆分"}
			onClick={onToggle}
		>
			<span className="task-diag-caret">
				{expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
			</span>
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
		</button>
	);
}

/** 正常收尾的 stopReason 不占位（`stop` / `toolUse` 是每步的常态）。 */
function isNormalStop(reason: string): boolean {
	return reason === "stop" || reason === "toolUse";
}

/** 一个 run：边界行 + 步（含各自挂着的工具/状态）+ 收束行。 */
function RunBlock({
	run,
	snapshots,
	breaks,
	cacheReported,
	expandedStep,
	onToggleStep,
}: {
	readonly run: LedgerRun;
	readonly snapshots: ReadonlyMap<string, RequestSnapshotData>;
	/** 每轮的缓存命中前缀断点（键同 snapshots，见 run-timeline 的 foldCachePrefixBreaks）。 */
	readonly breaks: ReadonlyMap<string, CachePrefixBoundary>;
	/** provider 是否上报过缓存活动（会话级，见 StepRow）。 */
	readonly cacheReported: boolean;
	readonly expandedStep: string | undefined;
	readonly onToggleStep: (key: string) => void;
}): React.JSX.Element {
	const hit = run.usage === undefined ? undefined : cacheHitRate(run.usage, cacheReported);
	// 工具属于「发出它的那次模型调用」——这个关系台账没记，按位置推（foldRunSteps）。
	const steps = useMemo(() => foldRunSteps(run.items), [run.items]);
	const base = runKeyOf(run);

	return (
		<li className="task-diag-run">
			<div className="task-diag-run-head">
				<span className="task-diag-clock">{formatClock(run.startedAt)}</span>
				<span>开始</span>
				{run.modelId !== undefined && (
					<span className="task-diag-model">{run.modelId}</span>
				)}
			</div>
			{steps.map((step, index) => {
				// turnIndex 在 run 内唯一；无主前导组用位置兜底（它本来就没有步号）。
				const stepKey = `${base}#${step.call?.turnIndex ?? `x${index}`}`;
				return (
					<StepBlock
						key={stepKey}
						step={step}
						stepKey={stepKey}
						run={run}
						snapshots={snapshots}
						breaks={breaks}
						cacheReported={cacheReported}
						expanded={expandedStep === stepKey}
						onToggle={onToggleStep}
					/>
				);
			})}
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
	usageDetail,
	axes,
	width,
	onClose,
}: {
	/** 当前会话 id（`""` = 还没建会话，daemon 会回退到最近有台账的会话）。 */
	readonly sessionId: string;
	/** 会话级汇总（daemon 的 session_stats 投影，`conversation.sessionStats`）。 */
	readonly stats: SessionStatCard | undefined;
	/** 当前上下文占用（`conversation.usageDetail`）—— ② 的数据源，就是「现在」。 */
	readonly usageDetail: ContextUsageDetail | undefined;
	/** 当前两轴 + 专家（② 「系统提示词全文」按它走 prompt:preview 现算）。 */
	readonly axes: {
		readonly sceneId: string;
		readonly interactionId: string;
		readonly expertId: string | undefined;
	};
	/** 面板宽度（px）：与 ArtifactPanel / SourcesPanel 同一份 panelWidth。 */
	readonly width: number;
	readonly onClose: () => void;
}): React.JSX.Element {
	const [ledger, setLedger] = useState<RunLedgerResult | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);
	/** 展开的步（runKey#turnIndex）。单个而非集合：诊断时一次只看一步。 */
	const [expandedStep, setExpandedStep] = useState<string | undefined>(undefined);

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
		// 换会话先复位：留着上一个任务的台账会让人以为数据串了（它此刻确实串了），
		// 展开态同理 —— 指针停在别的任务的步号上毫无意义。
		setLedger(undefined);
		setExpandedStep(undefined);
		refresh();
		// 台账只在台账条目变化时才变，流式增量与进度类事件跳过（名单在 shared）。
		const off = window.kami.onSessionEvent(({ event }) => {
			if (isStreamingEvent(event)) return;
			refresh();
		});
		return off;
	}, [refresh]);

	const runs = useMemo(() => foldRunLedger(ledger?.entries ?? []), [ledger]);
	/**
	 * provider 是否上报过缓存活动（会话级）。单步行/单轮收束行的「缓存 N%」按它决定
	 * 显示数字还是「—」—— 单步自己判别不了「全 miss」与「provider 不报缓存」，
	 * 所以判定只认会话卡这一处（AGENTS.md §1.3：renderer 不另算口径）。
	 * 卡片还没到就按「未知」处理（显示「—」），不拿 0% 冒充。
	 */
	const cacheReported = stats?.cacheReported ?? false;
	const snapshots = useMemo(
		() => indexRequestSnapshots(ledger?.entries ?? []),
		[ledger],
	);
	/**
	 * 每轮的缓存命中前缀断点（CACHE6）。与 snapshots 同一个键，单步详情里一对即可取。
	 * 台账侧配对在 run-timeline，反推算法在 shared（两侧都是纯函数，可单测）。
	 */
	const breaks = useMemo(() => foldCachePrefixBreaks(ledger?.entries ?? []), [ledger]);
	/** 最近一次入模拆分：② 的「当时的上下文组成」数据源（真实计数）。 */
	const latestSnapshot = useMemo(
		() => latestRequestSnapshot(ledger?.entries ?? []),
		[ledger],
	);

	// 再点同一行收起；点另一行换过去（不保留多个展开，避免面板被撑长）。
	const toggleStep = useCallback((key: string) => {
		setExpandedStep((current) => (current === key ? undefined : key));
	}, []);

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
				<ContextSection
					detail={usageDetail}
					latestSnapshot={latestSnapshot}
					axes={axes}
					sessionId={sessionId}
				/>
				{error !== undefined && <ErrorState message={error} />}
				{ledger === undefined ? (
					<LoadingState text="正在读取台账…" />
				) : runs.length === 0 ? (
					<EmptyState title="这个任务还没有跑过任何一轮。" />
				) : (
					<section className="task-diag-section">
						<h2 className="task-diag-heading">
							轮 / 步台账
							<span className="stat-hint">点开某一步看该轮详情</span>
						</h2>
						<ol className="task-diag-runs">
							{/* 展示序：新的在前（与「最近任务」一致，最近发生的最该看见）。 */}
							{[...runs].reverse().map((run, index) => (
								<RunBlock
									key={`${run.runId}-${run.startedAt}-${index}`}
									run={run}
									snapshots={snapshots}
									breaks={breaks}
									cacheReported={cacheReported}
									expandedStep={expandedStep}
									onToggleStep={toggleStep}
								/>
							))}
						</ol>
					</section>
				)}
			</div>
		</aside>
	);
}
