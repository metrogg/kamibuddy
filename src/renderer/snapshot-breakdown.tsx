/**
 * 一轮请求的真实入模拆分（request_snapshot 的展示）。
 *
 * 这是「**当时**」的口径：某一次模型调用实际发出去的东西 —— 系统提示词的分段
 * provenance + 四类消息的条数与字符数。与 `ContextUsageBreakdown` 的「现在」
 * （`getContextUsage()` 的实时 used/total + 分类估算）是两件事，展示位并列时
 * 文案必须各自标明，不许互相替代。
 *
 * 为什么单独立文件：任务诊断面板（单步详情）与诊断页（会话时间线）都要展示它。
 * 措辞本身就是口径的一部分，不能抄第二份：
 *   - 系统提示词分段是**真实计数**（compose 时逐段记账），所以只写「共 N 字符」，
 *     不带 ~；
 *   - 消息组成是字符数统计，占比按字符算 —— 不是 token，标签里写清是「字符」。
 *
 * 配色循环复用上下文成分条的既有五色（`--cat-*` 那套），不新增色值。
 * 本组件只 import @shared（AGENTS.md §1.3）。
 */

import type { RequestSnapshotData } from "@shared/observability.ts";

/** 分段占条的配色：循环复用上下文成分条的既有五色，不新增色值。 */
const SEG_PALETTE = [
	"comp-system",
	"comp-user",
	"comp-assistant",
	"comp-thinking",
	"comp-tools",
] as const;

export function SnapshotBreakdown({
	snapshot,
}: {
	readonly snapshot: RequestSnapshotData;
}): React.JSX.Element {
	const segs = snapshot.systemSegments ?? [];
	const segTotal = segs.reduce((sum, s) => sum + s.chars, 0);
	const msg = snapshot.messages;
	const msgParts = [
		{ key: "user", label: "用户消息", stat: msg.user },
		{ key: "assistant", label: "助手回复", stat: msg.assistant },
		{ key: "toolResult", label: "工具结果", stat: msg.toolResult },
		{ key: "other", label: "其他", stat: msg.other },
	];
	const msgTotal = msgParts.reduce((sum, p) => sum + p.stat.chars, 0);

	return (
		<div className="snap-detail">
			{segs.length > 0 && segTotal > 0 && (
				<>
					<p className="stat-hint">
						系统提示词分段（真实计数，共 {segTotal.toLocaleString("en-US")} 字符）
					</p>
					<div className="comp-bar" role="img" aria-label="系统提示词分段占比">
						{segs.map((s, i) => (
							<div
								key={`${s.source}-${i}`}
								className={`comp-seg ${SEG_PALETTE[i % SEG_PALETTE.length]}`}
								style={{ width: `${(s.chars / segTotal) * 100}%` }}
								title={`${s.source}：${s.chars.toLocaleString("en-US")} 字符（${((s.chars / segTotal) * 100).toFixed(1)}%）`}
							/>
						))}
					</div>
					<ul className="comp-legend">
						{segs.map((s, i) => (
							<li key={`${s.source}-${i}`}>
								<span className={`comp-dot ${SEG_PALETTE[i % SEG_PALETTE.length]}`} />
								{s.source} {((s.chars / segTotal) * 100).toFixed(1)}%
							</li>
						))}
					</ul>
				</>
			)}
			<p className="stat-hint">消息组成（条数 / 字符数 / 字符占比）</p>
			<table className="stat-table">
				<tbody>
					{msgParts.map((p) => (
						<tr key={p.key}>
							<td>{p.label}</td>
							<td>{p.stat.count} 条</td>
							<td>{p.stat.chars.toLocaleString("en-US")} 字符</td>
							<td>
								{msgTotal === 0
									? "—"
									: `${((p.stat.chars / msgTotal) * 100).toFixed(1)}%`}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
