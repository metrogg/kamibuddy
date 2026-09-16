/**
 * 子代理/成员投影契约（spec: add-team-foundations 批 4）。
 *
 * 任何产生「隔离子会话/团队成员」状态投影的工具共用这一层：
 *   - details 里带 {@link CHILD_AGENTS_DETAILS_KEY} 键的全量投影数组（整体替换
 *     语义，见 session-events.ts SubagentStatus 注释），session-host 桥接成
 *     `subagent_progress` 事件——**host 认键与形状、不认具体工具**，team 工具
 *     发同形状 details 即走同一通道，不需要新事件类型；
 *   - {@link ChildAgentsProjection} 是投影状态机（初始化骨架 → 状态迁移 →
 *     动作行时间线 → 快照拷贝），从 task 工具迁出，产出工具只管喂状态。
 *
 * 本模块在 shared/：类型 + 纯逻辑，零运行时依赖（AGENTS.md §1）。
 * 事件名沿用 `subagent_progress`（改名要迁移历史重放，没有消费者收益；
 * kind 已在投影数据里，需要区分时读得出来）。
 */

import type { SubagentStatus } from "./session-events.ts";

/** details 里携带投影数组的契约键。工具与 session-host 两侧都从本常量取。 */
export const CHILD_AGENTS_DETAILS_KEY = "subagents";

/**
 * 从工具结果的 details 里取投影数组。
 *
 * 运行时判空 + Array.isArray 防御 —— pi 的 details 是扩展自定义的 unknown，
 * 非 task 类工具（或旧格式会话）没有该键则返回 undefined，调用方走原逻辑。
 * 数组项不逐字段校验：投影的生产方就是本仓库的工具（同进程、同构建），
 * 不是外来数据；逐项窄化是给不可信输入的，用在这里是纯防御性兜底。
 */
export function childAgentsOf(details: unknown): readonly SubagentStatus[] | undefined {
	if (typeof details !== "object" || details === null) return undefined;
	const subagents = (details as Record<string, unknown>)[CHILD_AGENTS_DETAILS_KEY];
	return Array.isArray(subagents) ? (subagents as readonly SubagentStatus[]) : undefined;
}

/** 投影骨架的一行：初始化时的静态信息（model 缺席则不渲染模型徽标）。 */
export interface ChildAgentPlanEntry {
	readonly agent: string;
	readonly task: string;
	readonly model?: string;
}

/**
 * 时间线封顶：只保留最后 12 条**真实动作行**，溢出在最前面补「前 N 条已省略」
 * 标记——标记不占槽位，N 按累计丢弃数算（若标记也计入，下一轮追加会把
 * 标记当动作行再挤掉一条，计数永远差一）。
 * 封顶的理由：长任务的工具动作行可以几十上百条，投影每变一次都全量
 * 拷贝一遍，无封顶会让进度通道体积随任务时长线性膨胀。
 */
const TIMELINE_MAX = 12;

const OMITTED_MARKER = /^（前 (\d+) 条已省略）$/;

/** 追加一条动作行：同步更新 timeline（capped）与 activity（恒为末元素）。 */
function appendTimeline(entry: SubagentStatus, text: string): SubagentStatus {
	const previous = entry.timeline ?? [];
	const omittedBefore = OMITTED_MARKER.exec(previous[0] ?? "")?.[1];
	const real = omittedBefore === undefined ? previous : previous.slice(1);
	const total = Number(omittedBefore ?? 0) + real.length + 1;
	if (total <= TIMELINE_MAX) {
		return { ...entry, timeline: [...real, text], activity: text };
	}
	const dropped = total - TIMELINE_MAX;
	const keep = [...real, text].slice(-TIMELINE_MAX);
	return { ...entry, timeline: [`（前 ${dropped} 条已省略）`, ...keep], activity: text };
}

/**
 * 投影状态机：按下标定位（同名代理可同时出现多次，名字不能当键）。
 * 每次变化后由产出工具调 {@link snapshot} 发一份全量拷贝 —— 消费端整体替换，
 * 发可变本体引用会让 UI 与后续突变纠缠。
 */
export class ChildAgentsProjection {
	private readonly entries: SubagentStatus[];

	/**
	 * @param plan 骨架（初始化即全 queued：工具卡从执行开始就能摆出全部分组，
	 *        而不是等第一个子代理起跑才有内容）
	 * @param kind 子代理种类；缺省 undefined（= subagent，task 工具不写，
	 *        旧格式会话兼容），团队工具传 "team"
	 */
	constructor(plan: readonly ChildAgentPlanEntry[], kind?: "subagent" | "team") {
		this.entries = plan.map((entry) => ({
			agent: entry.agent,
			task: entry.task,
			...(kind === undefined ? {} : { kind }),
			status: "queued" as const,
			activity: "",
			turns: 0,
			...(entry.model === undefined ? {} : { model: entry.model }),
		}));
	}

	/** 全量快照（深拷贝本体引用，消费端可安全持有）。 */
	snapshot(): readonly SubagentStatus[] {
		return this.entries.map((entry) => ({ ...entry }));
	}

	/**
	 * 局部迁移（状态翻转 / 终态回填）。越界下标是 no-op 而不是抛错：
	 * 并行模式下计划与执行的错位不该炸掉整个委派。
	 */
	patch(index: number, partial: Partial<SubagentStatus>): void {
		const current = this.entries[index];
		if (current === undefined) return;
		this.entries[index] = { ...current, ...partial };
	}

	/**
	 * 追加一条动作行：activity 与 timeline 同步推进，卡片的「最新动作」与
	 * 可展开过程永远一致。空文本 no-op（无进展时执行器发的是空串）。
	 */
	pushActivity(index: number, text: string): void {
		const current = this.entries[index];
		if (current === undefined || text === "") return;
		this.entries[index] = appendTimeline(current, text);
	}
}
