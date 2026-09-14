/**
 * 使用统计（跨会话）契约 —— 统计页与 daemon 聚合共用（spec: add-usage-stats）。
 *
 * 对标 WorkBuddy 的 `/stats`（`StatsResult` + `StatsServiceImpl.calculateStats`，
 * 逆向位置见 spec.md 的证据表）。字段名尽量与它对齐，便于日后比对：
 * `totalSessions` / `totalMessages` / `totalTokens` / `totalCost` / `streakDays` /
 * `heatmap` / `modelUsage` / `toolUsage` 都是它的公开契约原名。
 *
 * 与它公开契约的有意差异（都在 spec.md「与 WorkBuddy 的有意差异」里）：
 * - token 多带 cacheRead / cacheWrite（它们已经在盘上，藏起来没有理由）
 * - 工具多带 errors（不做耗时：会话 JSONL 没有工具执行起止时刻，那在台账里）
 * - 多带 WorkBuddy 只放在内部模型、但面板要用的字段（活跃天数 / 连续天数明细 /
 *   峰值时段 / 最长与平均会话 / 首末时刻 / 每日 token）
 *
 * 为什么网格函数也放这里：热力图的布局派生只能有一份实现，放 renderer 会与
 * daemon 的口径漂移；`shared` 两边都能 import（同 `cacheHitRate()` 的先例）。
 * 聚合本身仍然只在 daemon 发生（见 shared/observability.ts 文件头纪律）。
 */

/** 某一天的活动量（WorkBuddy 的 `heatmap` 元素：`{date, count}`）。 */
export interface UsageHeatmapDay {
	/** 本地日期 `YYYY-MM-DD`。 */
	readonly date: string;
	/** 当日消息条数（不含子代理会话）。 */
	readonly count: number;
}

/** 某一天的 token 合计（WorkBuddy 的 `aggregateDailyTokens` 输出）。 */
export interface UsageDailyTokens {
	readonly date: string;
	readonly tokens: number;
}

/** 单个模型的用量（WorkBuddy 公开契约是 `{model, count, tokens}`，这里多带 cost）。 */
export interface ModelUsageStat {
	readonly model: string;
	/** 该模型的 assistant 消息条数。 */
	readonly count: number;
	readonly tokens: number;
	/** 美元。 */
	readonly cost: number;
}

/**
 * 单个工具的用量。WorkBuddy 公开契约只有 `{tool, count}`；`errors` 是我们多出来的
 * 维度（诊断页的 `ToolStat` 已有失败数，跨会话聚合里补同一维度只多一次配对）。
 */
export interface ToolUsageStat {
	readonly tool: string;
	readonly count: number;
	readonly errors: number;
}

/** 跨会话使用统计（全历史，无时间范围参数 —— 与 WorkBuddy 的接口同口径）。 */
export interface UsageStats {
	/** 主会话数（子代理会话不算「用户开了一次会话」）。 */
	readonly totalSessions: number;
	/** 主会话的 user + assistant 消息条数。 */
	readonly totalMessages: number;
	/** 有过活动的自然日数。 */
	readonly activeDays: number;
	/** 首末活动之间的自然日跨度（含首末，至少 1；无活动为 0）。 */
	readonly totalDays: number;
	/**
	 * token 合计。**含子代理会话**（真实花费不能漏账），
	 * 而 `totalSessions` 等会话维度字段不含 —— 这个不对称是有意的，见 spec.md。
	 */
	readonly totalTokens: {
		readonly input: number;
		readonly output: number;
		readonly cacheRead: number;
		readonly cacheWrite: number;
		readonly total: number;
	};
	/** 美元合计。 */
	readonly totalCost: number;
	/** 当前连续活跃天数（从今天往回数；今天没活动就是 0）。 */
	readonly streakDays: number;
	readonly longestStreakDays: number;
	/** 活动最密集的小时（0-23）；无活动为 undefined。 */
	readonly peakHour: number | undefined;
	/** 最长一次主会话的时长（首末消息之差，毫秒）；无会话为 undefined。 */
	readonly longestSessionMs: number | undefined;
	/** 主会话平均时长（毫秒）；无会话为 0。 */
	readonly averageSessionMs: number;
	readonly firstSessionAt: number | undefined;
	readonly lastSessionAt: number | undefined;
	/** 每日活动（升序）。热力图的输入。 */
	readonly heatmap: readonly UsageHeatmapDay[];
	/** 每日 token 合计（升序）。趋势折线的输入。 */
	readonly dailyTokens: readonly UsageDailyTokens[];
	/** 模型明细，按 token 降序。 */
	readonly modelUsage: readonly ModelUsageStat[];
	/** 工具排行，按调用数降序。 */
	readonly toolUsage: readonly ToolUsageStat[];
}

/** 空统计（一次会话都没有，或目录还不存在）。 */
export function emptyUsageStats(): UsageStats {
	return {
		totalSessions: 0,
		totalMessages: 0,
		activeDays: 0,
		totalDays: 0,
		totalTokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		totalCost: 0,
		streakDays: 0,
		longestStreakDays: 0,
		peakHour: undefined,
		longestSessionMs: undefined,
		averageSessionMs: 0,
		firstSessionAt: undefined,
		lastSessionAt: undefined,
		heatmap: [],
		dailyTokens: [],
		modelUsage: [],
		toolUsage: [],
	};
}

/* ── 热力图网格 ────────────────────────────────────────────────────── */

/** 网格里一个格子的等级：0 = 无活动，1-4 由浅到深。 */
export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatmapMonthLabel {
	/** 0-11。 */
	readonly month: number;
	/** 落在第几列（0 起）。 */
	readonly week: number;
}

export interface HeatmapGrid {
	/** `[7][weeks]`，行 0 = 周日。 */
	readonly weeks: readonly (readonly HeatmapLevel[])[];
	/** 与 `weeks` 同形的日期矩阵（未来格为空串），悬停提示用。 */
	readonly dates: readonly (readonly string[])[];
	readonly totalWeeks: number;
	readonly monthLabels: readonly HeatmapMonthLabel[];
	/** 着色用的全局最大单日条数（等级是相对它的量）。 */
	readonly maxCount: number;
}

/** 默认容器宽度（WorkBuddy 的 `generateHeatmapData(activity, 56)`）。 */
export const HEATMAP_DEFAULT_WIDTH = 56;

/**
 * 等级：`0` 活动或最大值为 0 → 空；否则按 `count / max` 分四档。
 * 借 WorkBuddy `getActivityLevel` 的阈值（`.25 / .5 / .75`），含义是
 * 「相对自己最忙那一天」而不是绝对量 —— 用得少的人也该看到自己的深浅。
 */
export function heatmapLevel(count: number, maxCount: number): HeatmapLevel {
	if (count === 0 || maxCount === 0) return 0;
	const ratio = count / maxCount;
	if (ratio <= 0.25) return 1;
	if (ratio <= 0.5) return 2;
	if (ratio <= 0.75) return 3;
	return 4;
}

/** 本地日期 `YYYY-MM-DD`（不用 toISOString：那是 UTC，跨时区会错一天）。 */
export function localDateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export interface BuildHeatmapOptions {
	/** 容器宽度（字符数）。列数 = `clamp(width - 8, 10, 52)`，与 WorkBuddy 同式。 */
	readonly width?: number;
	/** 「今天」的注入点（测试用）。默认取系统当前时间。 */
	readonly today?: Date;
}

/**
 * 把每日活动铺成「周 × 日」网格。
 *
 * 布局与 WorkBuddy `generateHeatmapData` 一致：
 * - 7 行（周日在上），N 列（周）
 * - 首列 = 今天所在周的周日，往前推 `(weeks - 1)` 周
 * - 晚于今天的格子留空（等级 0）—— 未来没有活动，着色就是撒谎
 * - 月度标签只在「周日且月份与上个标签不同」的列上打
 */
export function buildHeatmapWeeks(
	daily: readonly UsageHeatmapDay[],
	options: BuildHeatmapOptions = {},
): HeatmapGrid {
	const width = options.width ?? HEATMAP_DEFAULT_WIDTH;
	const totalWeeks = Math.min(52, Math.max(10, width - 8));

	const byDate = new Map<string, number>();
	let maxCount = 0;
	for (const day of daily) {
		byDate.set(day.date, day.count);
		if (day.count > maxCount) maxCount = day.count;
	}

	const today = new Date(options.today ?? Date.now());
	today.setHours(0, 0, 0, 0);

	// 末列所在周的周日 → 首列 = 它往前 (totalWeeks - 1) 周。
	const lastColSunday = new Date(today);
	lastColSunday.setDate(today.getDate() - today.getDay());
	const start = new Date(lastColSunday);
	start.setDate(lastColSunday.getDate() - (totalWeeks - 1) * 7);

	/*
	 * 逐日铺行（行内周升序）：日期由 `start + 周*7 + 日` 直接算，不靠游标累加 ——
	 * 行优先枚举与时间推进顺序不同，靠游标会在换行时错位。
	 * 月度标签只在第 0 行（周日）判定，该行内周是升序的，标签天然有序。
	 */
	const weeks: HeatmapLevel[][] = [];
	const dates: string[][] = [];
	const monthLabels: HeatmapMonthLabel[] = [];
	let lastLabeledMonth = -1;

	for (let day = 0; day < 7; day++) {
		const weekRow: HeatmapLevel[] = [];
		const dateRow: string[] = [];
		for (let week = 0; week < totalWeeks; week++) {
			const cellDate = new Date(start);
			cellDate.setDate(start.getDate() + week * 7 + day);
			if (cellDate > today) {
				weekRow.push(0);
				dateRow.push("");
				continue;
			}
			if (day === 0) {
				const month = cellDate.getMonth();
				if (month !== lastLabeledMonth) {
					monthLabels.push({ month, week });
					lastLabeledMonth = month;
				}
			}
			const key = localDateKey(cellDate);
			weekRow.push(heatmapLevel(byDate.get(key) ?? 0, maxCount));
			dateRow.push(key);
		}
		weeks.push(weekRow);
		dates.push(dateRow);
	}

	return { weeks, dates, totalWeeks, monthLabels, maxCount };
}
