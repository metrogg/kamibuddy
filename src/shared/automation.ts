/**
 * 定时任务的调度模型：类型 + 纯函数。
 *
 * 为什么不引 rrule 库：v1 只暴露 once / interval / daily / weekly 四种调度，
 * 下次运行时间是几十行可测纯函数；月度等复杂规则确有需要时再引 rrule.js
 * （YAGNI，决策见 .trae/specs/add-automation-scheduler/spec.md）。
 *
 * 时区一律取本地时区 —— 办公场景「每天 9 点」指的是墙上时钟的 9 点，
 * 不是 UTC 偏移意义上的 9 点。落 shared 是因为管理页（renderer）与
 * daemon 调度器都要用同一套计算与摘要文案。
 */

/** 调度定义。 */
export type Schedule =
	| { type: "once"; at: number }
	| { type: "interval"; everyMinutes: number }
	| { type: "daily"; time: string /* "HH:mm" */ }
	| {
			type: "weekly";
			time: string;
			/** 0=周日 .. 6=周六（与 Date.getDay() 一致）。 */
			weekdays: readonly number[];
	  };

/**
 * 一次运行的记录。
 * readAt 是用户读过该记录的时间（管理页未读标记用），未读则缺省。
 */
export interface AutomationRun {
	sessionId: string;
	startedAt: number;
	finishedAt: number;
	success: boolean;
	error?: string;
	readAt?: number;
}

export interface AutomationTask {
	id: string;
	name: string;
	prompt: string;
	schedule: Schedule;
	/** missed：应用关闭期间错过的一次性任务（不补跑，只标记）。 */
	status: "active" | "paused" | "missed";
	/** 运行时的工作目录（任务工作空间）。 */
	cwd: string;
	nextRunAt?: number;
	lastRunAt?: number;
	runs: readonly AutomationRun[];
	createdAt: number;
	updatedAt: number;
}

const MINUTE_MS = 60_000;

/** HH:mm（24 小时制，小时必须两位 —— 「9:00」不算，避免与摘要展示格式漂移）。 */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * 解析 HH:mm。调度合法性的判定入口是 validateSchedule（建/改任务时调用）；
 * 读取侧函数假定输入已过校验，违例直接抛 —— 响亮失败，不静默吞
 * （AGENTS.md §7）。静默返回 undefined 会让一个 active 任务「看起来正常
 * 却永远不运行」，比报错难查得多。
 */
function parseTime(time: string): { hours: number; minutes: number } {
	const match = TIME_PATTERN.exec(time);
	if (match === null || match[1] === undefined || match[2] === undefined) {
		throw new Error(`非法时间格式「${time}」，应为 HH:mm（如 09:00）`);
	}
	return { hours: Number(match[1]), minutes: Number(match[2]) };
}

/**
 * 严格晚于 from 的下一次触发时刻（本地时区毫秒戳）；不再有触发时刻返回 undefined
 * （once 已过期 / weekly 星期集合为空）。
 *
 * interval 的锚语义：序列 0 点 = epoch 0，按 everyMinutes 均匀分布，
 * 取第一个 >from 的点。选 epoch 锚而不是「任务创建/上次运行时刻」锚：
 * 落点只由调度本身决定，与任务状态无关 —— 重启、补算、多任务共存的结果
 * 都一致，也没有「锚忘了存」的状态要维护。代价是跨夏令时落点的墙上时钟
 * 会漂（国内无夏令时，可忽略）。
 */
export function nextRunAfter(schedule: Schedule, from: number): number | undefined {
	switch (schedule.type) {
		case "once":
			// 严格大于：恰好等于 from 视为已错过。过期不补跑（标 missed 是调用方的事）。
			return schedule.at > from ? schedule.at : undefined;
		case "interval": {
			if (!Number.isInteger(schedule.everyMinutes) || schedule.everyMinutes < 1) {
				throw new Error(`非法间隔「${schedule.everyMinutes}」，应为正整数分钟`);
			}
			const intervalMs = schedule.everyMinutes * MINUTE_MS;
			// floor(from / intervalMs) 是 from 所在序列点的下标；+1 即第一个 >from 的点
			// （from 恰在序列点上时 floor 命中自身，+1 保证严格晚于）。
			return (Math.floor(from / intervalMs) + 1) * intervalMs;
		}
		case "daily": {
			const { hours, minutes } = parseTime(schedule.time);
			const fromDate = new Date(from);
			const today = new Date(
				fromDate.getFullYear(),
				fromDate.getMonth(),
				fromDate.getDate(),
				hours,
				minutes,
			);
			if (today.getTime() > from) return today.getTime();
			// 今天已过则明天。Date 构造器自动归一跨月/跨年（1 月 31 日的「明天」是 2 月 1 日）。
			return new Date(
				fromDate.getFullYear(),
				fromDate.getMonth(),
				fromDate.getDate() + 1,
				hours,
				minutes,
			).getTime();
		}
		case "weekly": {
			const { hours, minutes } = parseTime(schedule.time);
			const days = new Set(schedule.weekdays);
			if (days.size === 0) return undefined;
			const fromDate = new Date(from);
			/*
			 * 从今天起最多看 7 天。集合非空时循环必然返回：第 7 天与今天同星期，
			 * 其 HH:mm 距 from 至少 6 天多，必然 >from —— 它就是「今天已过时刻」
			 * 这一支的兜底落点。
			 */
			for (let offset = 0; offset <= 7; offset++) {
				const candidate = new Date(
					fromDate.getFullYear(),
					fromDate.getMonth(),
					fromDate.getDate() + offset,
					hours,
					minutes,
				);
				if (!days.has(candidate.getDay())) continue;
				if (candidate.getTime() > from) return candidate.getTime();
			}
			return undefined;
		}
	}
}

/**
 * 校验调度参数，返回给用户看的错误文案；合法返回 undefined。
 * 这是调度合法性的唯一判定入口，建/改任务的路径（daemon、对话内工具）先过这里。
 */
export function validateSchedule(schedule: Schedule): string | undefined {
	switch (schedule.type) {
		case "once":
			// 过去的 at 不算非法：建完即标 missed 是既定语义（应用关闭期间错过同理）。
			return undefined;
		case "interval":
			return Number.isInteger(schedule.everyMinutes) && schedule.everyMinutes >= 1
				? undefined
				: "间隔分钟数必须是正整数";
		case "daily":
			return TIME_PATTERN.test(schedule.time) ? undefined : "时间格式应为 HH:mm（如 09:00）";
		case "weekly":
			if (!TIME_PATTERN.test(schedule.time)) return "时间格式应为 HH:mm（如 09:00）";
			return schedule.weekdays.length === 0 ? "请至少选择一个星期" : undefined;
	}
}

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"] as const;

/** 展示按周一开头排序（中文语境的惯例周序），周日排最后。 */
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

function pad2(n: number): string {
	return n < 10 ? `0${n}` : `${n}`;
}

/**
 * 调度的中文摘要（管理页列表与对话内工具的回复共用，
 * 保证「界面显示的」和「AI 声称的」是同一句话）。
 */
export function scheduleSummary(schedule: Schedule): string {
	switch (schedule.type) {
		case "once": {
			const at = new Date(schedule.at);
			return (
				`一次性 · ${at.getFullYear()}/${at.getMonth() + 1}/${at.getDate()} ` +
				`${pad2(at.getHours())}:${pad2(at.getMinutes())}`
			);
		}
		case "interval":
			return `每 ${schedule.everyMinutes} 分钟`;
		case "daily":
			return `每天 ${schedule.time}`;
		case "weekly": {
			const days = new Set(schedule.weekdays);
			const names = WEEKDAY_DISPLAY_ORDER.filter((d) => days.has(d)).map(
				(d) => WEEKDAY_NAMES[d],
			);
			return `每周${names.join("、")} ${schedule.time}`;
		}
	}
}
