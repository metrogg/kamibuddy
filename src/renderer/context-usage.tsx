/**
 * 上下文用量的两个展示位：
 *   - `ContextUsageRing`：输入条上的常驻圆环（对标 WorkBuddy 的 ContextUsageDisplay）；
 *   - `ContextUsageBreakdown`：分类读数 + 占比条 + 图例（圆环浮层与任务诊断面板共用）。
 *
 * 数据口径（shared/context-usage.ts 的注释是契约）：
 *   - 圆环与百分比用 used/total —— pi 的 getContextUsage() 精确值；
 *   - 分类拆分是**估算值**，每行数字前加 ~，底部固定标注「估算」。
 *
 * 圆环常驻但浮层按需：一次任务可能几十轮，用户多数时候只要一眼饱和度，
 * 分类只有「上下文怎么满了」时才需要看。任务诊断面板则相反 —— 它是诊断面，
 * 分类常驻可见，所以两处共用同一份 Breakdown 而不是各写一套。
 */

import { useEffect, useRef, useState } from "react";
import { formatTokenCount, type ContextUsageDetail } from "@shared/context-usage.ts";

/** 圆环几何：18px 视窗、半径 7、线宽 2。周长 = 2πr。 */
const R = 7;
const CIRCUMFERENCE = 2 * Math.PI * R;

interface CategoryRow {
	readonly key: string;
	readonly label: string;
	readonly value: number;
}

function buildRows(detail: ContextUsageDetail): readonly CategoryRow[] {
	return [
		{ key: "system", label: "系统提示词", value: detail.byCategory.systemPrompt },
		{ key: "skills", label: "技能", value: detail.byCategory.skills },
		{ key: "conversation", label: "对话消息", value: detail.byCategory.conversation },
		{ key: "tools", label: "工具结果", value: detail.byCategory.toolResults },
	];
}

/**
 * 占用百分比（0–100，钳位）。圆环的描边与拆分块的读数共用这一处 ——
 * 两处各写一遍，圆环画 87.5% 而文字写 88% 这类不一致迟早出现。
 */
export function contextUsagePercent(detail: ContextUsageDetail): number {
	if (detail.total <= 0) return 0;
	return Math.min(100, Math.max(0, (detail.used / detail.total) * 100));
}

/**
 * 上下文用量的拆分视图：占比读数 + 分类条 + 图例 + 估算标注。
 *
 * 为什么单独导出：圆环浮层（本文件下方）与任务诊断面板的「上下文占用」区是
 * 两个并列的展示位，展示的必须是同一份口径、同一套标注 —— 每行 `~` 前缀与
 * 「分类为估算值，总量为实际值」这句是口径的一部分，不是排版细节，
 * 抄一份到面板里就等于埋一个口径漂移点（同 shared/context-usage.ts 文件头的纪律）。
 * 圆环那侧的 `cu-popover` 只负责外壳（定位 / 标题 / 关闭），内容由这里提供。
 *
 * **它展示的是「现在」**：used/total 是最近一次请求后的实时值。面板里与它并列的
 * 「该轮入模拆分」（request_snapshot）是「当时」的快照，两者含义不同，
 * 不许互相替代（见 task-diagnostics-panel.tsx 中两个区的文案）。
 */
export function ContextUsageBreakdown({
	detail,
}: {
	readonly detail: ContextUsageDetail;
}): React.JSX.Element {
	const percent = contextUsagePercent(detail);
	const rows = buildRows(detail);
	const segTotal = rows.reduce((sum, r) => sum + r.value, 0);

	return (
		<>
			<div className="cu-stats">
				<span className="cu-percent">{percent.toFixed(1)}%</span>
				<span className="cu-used">
					已使用 {formatTokenCount(detail.used)} / {formatTokenCount(detail.total)}
				</span>
			</div>
			<div className="cu-bar" role="presentation">
				{rows.map((row) => (
					<span
						key={row.key}
						className={`cu-seg cu-seg-${row.key}`}
						style={{ width: `${segTotal > 0 ? (row.value / segTotal) * 100 : 0}%` }}
					/>
				))}
			</div>
			<div className="cu-legend">
				{rows.map((row) => (
					<div key={row.key} className="cu-row">
						<span className={`cu-swatch cu-swatch-${row.key}`} />
						<span className="cu-row-name">{row.label}</span>
						<span className="cu-row-value">~{formatTokenCount(row.value)}</span>
					</div>
				))}
			</div>
			<footer className="cu-note">分类占比为估算值，总量为实际值</footer>
		</>
	);
}

export function ContextUsageRing({
	detail,
}: {
	readonly detail: ContextUsageDetail;
}): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const wrapRef = useRef<HTMLSpanElement>(null);

	// 点击浮层外任意处关闭（浮层在按钮同级，contains 判断要把按钮也算作内）。
	useEffect(() => {
		if (!open) return;
		const handler = (event: MouseEvent): void => {
			const node = wrapRef.current;
			if (node !== null && event.target instanceof Node && !node.contains(event.target)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	// Esc 关闭浮层。上面只挂了 mousedown（外点），键盘用户没有关闭路径 —— 浮层有
	// 「关闭」按钮但 Tab 到它要穿过整个浮层内容。同 model-menu / permission-menu 写法。
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	const percent = contextUsagePercent(detail);
	const percentText = percent.toFixed(1);
	const tooltip = `${percentText}% · ${formatTokenCount(detail.used)} / ${formatTokenCount(detail.total)} 上下文已用`;

	return (
		<span className="cu-wrap" ref={wrapRef}>
			<button
				type="button"
				className={`cu-ring${percent >= 90 ? " danger" : ""}`}
				title={tooltip}
				aria-label={tooltip}
				onClick={() => setOpen((v) => !v)}
			>
				<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
					<circle className="cu-track" cx="9" cy="9" r={R} />
					<circle
						className="cu-fill"
						cx="9"
						cy="9"
						r={R}
						strokeDasharray={CIRCUMFERENCE}
						strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
					/>
				</svg>
			</button>
			{open && (
				<div className="cu-popover" role="dialog" aria-label="上下文用量">
					<header className="cu-header">
						<span className="cu-title">上下文用量</span>
						<button type="button" className="cu-close" aria-label="关闭" onClick={() => setOpen(false)}>
							×
						</button>
					</header>
					<ContextUsageBreakdown detail={detail} />
				</div>
			)}
		</span>
	);
}
