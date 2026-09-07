/**
 * 上下文用量圆环：输入条上的常驻指示器（对标 WorkBuddy 的 ContextUsageDisplay）。
 *
 * 数据口径（shared/context-usage.ts 的注释是契约）：
 *   - 圆环与百分比用 used/total —— pi 的 getContextUsage() 精确值；
 *   - 点击弹出的分类拆分是**估算值**，每行数字前加 ~，底部固定标注「估算」。
 *
 * 圆环常驻但浮层按需：一次任务可能几十轮，用户多数时候只要一眼饱和度，
 * 分类只有「上下文怎么满了」时才需要看。
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

	const percent = detail.total > 0 ? Math.min(100, Math.max(0, (detail.used / detail.total) * 100)) : 0;
	const percentText = percent.toFixed(1);
	const tooltip = `${percentText}% · ${formatTokenCount(detail.used)} / ${formatTokenCount(detail.total)} 上下文已用`;
	const rows = buildRows(detail);
	const segTotal = rows.reduce((sum, r) => sum + r.value, 0);

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
					<div className="cu-stats">
						<span className="cu-percent">{percentText}%</span>
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
				</div>
			)}
		</span>
	);
}
