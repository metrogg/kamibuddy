/**
 * 会话指标条：贴在输入卡下方的常驻读数（对齐 dsh 的 StatsLine）。
 *
 * 与 chat-view 里那条**单轮**读数（RunMetricsBar）分工不同，两者并存：
 * 那条挂在助手消息的操作条上，答「这一轮用了多少 token / 命中多少」；
 * 这条常驻输入框下方，答「整个会话到现在跑了几轮几步、多快、烧了多少」。
 *
 * 口径来自 daemon 的 session_stats 事件（core/observability.ts 的台账 fold）：
 * 台账全历史，分页与上下文压缩都改不动它（同 dsh 的 sessionStats projection）。
 * 本组件只做展示与格式化，**不算任何口径**（AGENTS.md §1.3：renderer 不二次计算）。
 *
 * 分组逐项对齐 dsh（i18n 的 stats.* 键 + chat/StatsLine.tsx 的组装顺序）：
 *   1 轮 · 27 步 | LLM 1m8s · 工具调用 1m10s | 首 token 平均 1.1s · 241 tok/s
 *   | 缓存命中 95% | 输入 1.5M tok · 输出 8.9K tok
 * 组内用 " · "、组间用 " | "；**没有数据的组整组消失**（不是显示 0），
 * 一组都没有时整行返回 null —— 空读数条看起来像「这里本该有东西没加载出来」。
 *
 * 命名陷阱：SessionStatCard 的 `turns` 是模型调用次数（= dsh 的 steps），
 * `runs` 才是「用户发了几轮」（= dsh 的 turns）。别按字面读。
 *
 * 本组件只 import @shared（AGENTS.md §1.3）。
 */

import { Fragment, useLayoutEffect, useRef, useState } from "react";

import { formatTokenCount } from "@shared/context-usage.ts";
import {
	averageTtftMs,
	billedInputTokens,
	decodeTokensPerSecond,
	type SessionStatCard,
} from "@shared/observability.ts";
import { formatSpan, formatThroughput } from "./reading-format.ts";

/**
 * 组装分组的显示文本（空组不产出，调用方按组间 " | " 拼）。
 * 门控与 dsh 逐条对齐：计数与耗时组由「有过步」开闸，用量组由「有过计费」开闸 ——
 * 一次全部失败的会话应当看到轮/步数，而不是一排 0 token。
 */
export function sessionStatsGroups(stats: SessionStatCard): string[] {
	const groups: string[] = [];

	if (stats.turns > 0) {
		groups.push(`${stats.runs} 轮 · ${stats.turns} 步`);

		const durations: string[] = [];
		if (stats.llmMs > 0) durations.push(`LLM ${formatSpan(stats.llmMs)}`);
		if (stats.toolMs > 0) durations.push(`工具调用 ${formatSpan(stats.toolMs)}`);
		if (durations.length > 0) groups.push(durations.join(" · "));

		const speeds: string[] = [];
		const ttft = averageTtftMs(stats);
		if (ttft !== undefined) speeds.push(`首 token 平均 ${formatSpan(ttft)}`);
		const throughput = decodeTokensPerSecond(stats);
		if (throughput !== undefined) speeds.push(`${formatThroughput(throughput)} tok/s`);
		if (speeds.length > 0) groups.push(speeds.join(" · "));
	}

	const billed = billedInputTokens(stats.usage);
	if (billed > 0 || stats.usage.output > 0) {
		if (stats.cacheHitRate !== undefined) {
			// 一位小数（用户要求）：整数四舍五入会把 90.4% 与 91.2% 都显示成 91，
			// 长会话里缓存效率的细微变化（提示词缓存是否被打破）就读不出来了。
			groups.push(`缓存命中 ${(stats.cacheHitRate * 100).toFixed(1)}%`);
		}
		groups.push(
			`输入 ${formatTokenCount(billed)} tok · 输出 ${formatTokenCount(stats.usage.output)} tok`,
		);
	}
	return groups;
}

export function SessionStatsLine({
	stats,
}: {
	readonly stats: SessionStatCard | undefined;
}): React.JSX.Element | null {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const [truncated, setTruncated] = useState(false);
	const groups = stats === undefined ? [] : sessionStatsGroups(stats);
	const line = groups.join(" | ");

	/*
	 * 只在真的被裁掉时才挂原生 title（同 dsh 的 disabled={!truncated}）：
	 * 没裁时挂 title，鼠标划过会弹一条与眼前完全重复的浮层。
	 * 布局是 block + nowrap + ellipsis（**不是 flex**）—— text-overflow 只对
	 * block 的行内内容生效，flex 容器会变成从中间截掉半个字而不是以 … 收尾。
	 */
	useLayoutEffect(() => {
		const element = rootRef.current;
		if (element === null) return;
		const measure = (): void => setTruncated(element.scrollWidth > element.clientWidth);
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [line]);

	if (groups.length === 0) return null;
	return (
		<div ref={rootRef} className="session-stats" title={truncated ? line : undefined}>
			{groups.map((group, index) => (
				// key 用分组文本：分组是「按内容生成的」，文本本身即最稳的标识。
				<Fragment key={group}>
					{index > 0 && (
						<span className="session-stats-sep" aria-hidden="true">
							|
						</span>
					)}
					<span>{group}</span>
				</Fragment>
			))}
		</div>
	);
}
