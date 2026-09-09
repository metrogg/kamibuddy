/**
 * 对话内 automation 工具（automation_create / automation_list / automation_delete）。
 *
 * 模型在 craft 模式对话里建/查/删定时任务；存储与调度计算分别在
 * core/automation-store.ts 与 shared/automation.ts，本文件只做三件事
 * （与 web-tools 相同的胶水定位）：注册工具、把入参窄化成 shared 的调度模型、
 * 把结果排成模型能读、能据以行动的文本。
 *
 * getCurrentCwd 的存在理由：automation_create 的 cwd 缺省值是「当前会话 cwd」，
 * 而工厂闭包拿不到会话状态，由 daemon 装配时注入（用户会话传当前工作空间
 * getter；本签名即接口契约，不要改）。
 *
 * 错误即 throw（pi 约定：execute 抛错 → isError 回给模型，模型据此改正重试，
 * 不打断 agent）。例外是 automation_delete 的「无命中 / 多名命中」：那不是
 * 执行失败而是需要澄清，返回正常结果模型才会转去与用户核对，isError 反而
 * 诱导它原样重试。
 */

import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { AutomationStore } from "../core/automation-store.ts";
import {
	nextRunAfter,
	scheduleSummary,
	validateSchedule,
	type AutomationTask,
	type Schedule,
} from "../shared/automation.ts";

/**
 * 调度入参：typebox 判别联合，与 shared 的 Schedule 四型一一对应。
 * 差别只在表示层 —— once.at 对模型暴露 ISO 8601 字符串（模型从系统提示词的
 * 当前时间推算字符串远比算毫秒戳可靠），进存储前才转成毫秒戳。
 *
 * 约束文案写在 description 里引导模型，但合法性的终审只在 validateSchedule
 * （唯一判定入口），不在这里复制第二套规则。
 */
const scheduleSchema = Type.Union([
	Type.Object({
		type: Type.Literal("once"),
		at: Type.String({
			description:
				"触发时刻，ISO 8601 格式（如 2026-09-10T09:00:00）。不带时区按本地时间解释；参照系统提示词里给出的当前时间推算，必须是将来的时刻。",
		}),
	}),
	Type.Object({
		type: Type.Literal("interval"),
		everyMinutes: Type.Integer({
			minimum: 1,
			description: "间隔分钟数，最小为 1（如 30 表示每 30 分钟一次）。",
		}),
	}),
	Type.Object({
		type: Type.Literal("daily"),
		time: Type.String({
			description: "每天的触发时刻，HH:mm（24 小时制、小时两位，如 09:00）。",
		}),
	}),
	Type.Object({
		type: Type.Literal("weekly"),
		time: Type.String({
			description: "触发时刻，HH:mm（24 小时制、小时两位，如 09:00）。",
		}),
		weekdays: Type.Array(Type.Integer({ minimum: 0, maximum: 6 }), {
			minItems: 1,
			description: "星期集合：0=周日、1=周一 … 6=周六，至少含一个（工作日填 [1,2,3,4,5]）。",
		}),
	}),
]);

type ScheduleInput = {
	readonly type: "once";
	readonly at: string;
} | {
	readonly type: "interval";
	readonly everyMinutes: number;
} | {
	readonly type: "daily";
	readonly time: string;
} | {
	readonly type: "weekly";
	readonly time: string;
	readonly weekdays: readonly number[];
};

/**
 * 入参 → shared 的 Schedule。只做表示层转换：once 的 ISO 字符串 → 毫秒戳、
 * weekdays 去重。合法性终审在 validateSchedule，这里唯一的额外检查是
 * weekdays 的值域 —— validateSchedule 只查非空，而越界星期会让
 * nextRunAfter 静默返回 undefined：任务「看起来正常却永远不运行」，
 * 比当场报错难查得多。
 */
function toSchedule(input: ScheduleInput): Schedule {
	switch (input.type) {
		case "once":
			return { type: "once", at: parseLocalDateTime(input.at) };
		case "interval":
			return { type: "interval", everyMinutes: input.everyMinutes };
		case "daily":
			return { type: "daily", time: input.time };
		case "weekly": {
			const invalid = input.weekdays.filter((d) => !Number.isInteger(d) || d < 0 || d > 6);
			if (invalid.length > 0) {
				throw new Error(
					`weekdays 里的星期必须是 0-6 的整数（0=周日 … 6=周六），收到非法值：${invalid.join("、")}。请改正后重试。`,
				);
			}
			return { type: "weekly", time: input.time, weekdays: [...new Set(input.weekdays)] };
		}
	}
}

/**
 * 解析触发时刻为毫秒戳。date-only（YYYY-MM-DD）先补 T00:00:00 再解析 ——
 * ECMAScript 规范里 date-only 形式按 UTC 解析、date-time 形式按本地时区，
 * 不补的话东八区用户定的「9 月 10 日」会落成当天上午 8 点。
 */
function parseLocalDateTime(at: string): number {
	const trimmed = at.trim();
	const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00` : trimmed;
	const ms = new Date(normalized).getTime();
	if (Number.isNaN(ms)) {
		throw new Error(
			`无法解析触发时刻「${at}」。请用 ISO 8601 格式（如 2026-09-10T09:00:00），不带时区时按本地时间解释。`,
		);
	}
	return ms;
}

/** 本地时刻的展示格式：与 shared/automation.ts 里一次性调度的摘要同形，界面与对话不漂移。 */
function formatLocal(ms: number): string {
	const d = new Date(ms);
	const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
	return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 任务的一行式简介：删除歧义时给模型挑候选用。 */
function briefLine(task: AutomationTask): string {
	return `- 「${task.name}」（id: ${task.id}，${scheduleSummary(task.schedule)}，状态：${task.status}）`;
}

export function automationExtensionFactory(
	store: AutomationStore,
	getCurrentCwd: () => string,
): ExtensionFactory {
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "automation_create",
			label: "创建定时任务",
			description:
				"创建一个定时任务：到点后系统会以任务的工作目录开启一场全新会话，自动执行 prompt 里的指令。" +
				"用户想让某件事「定时 / 每天 / 每周 / 每隔多久」自动完成时使用。" +
				"注意：未来的运行看不到本次对话，prompt 必须自包含 —— 时间、文件路径、" +
				"对象名称（项目名 / 目录 / 文件）都要写进指令本身，不能用「这个」「刚才那份」这类指代。",
			promptSnippet:
				"automation_create: 用户要「定时/每天/每周」自动做的事，创建定时任务（prompt 必须自包含，写全时间/路径/对象）",
			promptGuidelines: [
				"定时任务的 prompt 必须自包含：未来的运行是一场全新会话，看不到当前对话；时间、文件路径、对象名称都要写进指令本身。",
				"创建定时任务成功后，在回复中向用户复述实际生效的调度与下次运行时间。",
			],
			parameters: Type.Object({
				name: Type.String({ description: "任务名称，要可辨识（如「工作日早报」）。" }),
				prompt: Type.String({
					description:
						"到点自动执行的完整指令。必须自包含：写全时间、文件路径、对象名称，不依赖当前对话的上下文。",
				}),
				schedule: scheduleSchema,
				cwd: Type.Optional(
					Type.String({
						description: "任务运行的工作目录，缺省取当前会话的工作目录。任务要操作哪个项目就填那个项目的目录。",
					}),
				),
			}),
			async execute(_toolCallId, params) {
				const name = params.name.trim();
				if (name === "") {
					throw new Error("任务名称不能为空。请给任务起一个可辨识的名字（如「工作日早报」）。");
				}
				const prompt = params.prompt.trim();
				if (prompt === "") {
					throw new Error(
						"任务指令（prompt）不能为空。定时任务在未来以全新会话运行、看不到当前对话，请把要执行的内容完整写进 prompt。",
					);
				}
				const cwd = (params.cwd ?? getCurrentCwd()).trim();
				if (cwd === "") {
					throw new Error("未指定 cwd 且当前会话没有工作目录。请显式传入任务的运行目录（cwd）。");
				}
				const schedule = toSchedule(params.schedule);
				const invalid = validateSchedule(schedule);
				if (invalid !== undefined) {
					throw new Error(`调度参数不合法：${invalid}。请改正 schedule 后重新调用。`);
				}
				const nextRunAt = nextRunAfter(schedule, Date.now());
				if (nextRunAt === undefined) {
					/*
					 * 能走到这里只剩「once 的时刻已过」：weekly 空星期集合已被
					 * validateSchedule 拦下，interval / daily 恒有下一次。
					 * 过期不补跑是既定语义，所以当场报错让模型改时间，而不是
					 * 建一个永远不会跑的任务。
					 */
					throw new Error(
						"指定的触发时刻已经过去，一次性任务不会补跑。请把 schedule 的 at 改成一个将来的时刻再创建。",
					);
				}

				const now = Date.now();
				const task: AutomationTask = {
					id: randomUUID(),
					name,
					prompt,
					schedule,
					status: "active",
					cwd,
					nextRunAt,
					runs: [],
					createdAt: now,
					updatedAt: now,
				};
				store.upsert(task);

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({
								type: "automation_created",
								id: task.id,
								name: task.name,
								schedule: scheduleSummary(task.schedule),
								nextRunAt: formatLocal(nextRunAt),
								cwd: task.cwd,
								message: "定时任务已创建。请在回复中向用户说明实际生效的调度与下次运行时间。",
							}),
						},
					],
					details: { taskId: task.id },
				};
			},
		});

		pi.registerTool({
			name: "automation_list",
			label: "列出定时任务",
			description:
				"列出全部定时任务：id、名称、调度摘要、状态、下次与上次运行时间、运行次数。" +
				"用户问「我有哪些定时任务」、或删除前需要核对任务 id 时使用。不含任务指令全文。",
			promptSnippet: "automation_list: 列出全部定时任务（名称/调度/状态/下次运行时间）",
			parameters: Type.Object({}),
			async execute() {
				const tasks = store.list();
				if (tasks.length === 0) {
					return {
						content: [{ type: "text" as const, text: "当前没有任何定时任务。" }],
						details: { count: 0 },
					};
				}
				/*
				 * 不下发 prompt 全文：列举场景模型只需要「有什么任务、何时跑、状态如何」，
				 * prompt 可能很长，全塞进来是纯 token 浪费；用户要看全文可去管理页。
				 */
				const summary = tasks.map((t) => ({
					id: t.id,
					name: t.name,
					schedule: scheduleSummary(t.schedule),
					status: t.status,
					nextRunAt: t.nextRunAt === undefined ? null : formatLocal(t.nextRunAt),
					lastRunAt: t.lastRunAt === undefined ? null : formatLocal(t.lastRunAt),
					runs: t.runs.length,
				}));
				return {
					content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
					details: { count: tasks.length },
				};
			},
		});

		pi.registerTool({
			name: "automation_delete",
			label: "删除定时任务",
			description:
				"删除一个定时任务，按 id 或名称指定（同时给出时以 id 为准）。名称只在精确匹配且唯一命中时删除；" +
				"有同名任务或找不到时会返回候选列表，需与用户确认或改用 id。删除前如不确定有哪些任务，先调 automation_list。",
			promptSnippet: "automation_delete: 按 id 或名称删除定时任务（同名歧义时改用 id）",
			parameters: Type.Object({
				id: Type.Optional(
					Type.String({ description: "任务 id（automation_list 可查）。与 name 同时给出时以 id 为准。" }),
				),
				name: Type.Optional(
					Type.String({ description: "任务名称。精确匹配且唯一命中时才删除；有同名任务会返回候选列表。" }),
				),
			}),
			async execute(_toolCallId, params) {
				const id = params.id?.trim();
				const name = params.name?.trim();
				if ((id === undefined || id === "") && (name === undefined || name === "")) {
					throw new Error(
						"请提供要删除的任务 id 或名称（name）。不确定有哪些任务时，先调 automation_list 查看。",
					);
				}

				if (id !== undefined && id !== "") {
					const task = store.get(id);
					if (task === undefined) {
						throw new Error(
							`没有找到 id 为「${id}」的定时任务。请用 automation_list 获取现有任务的 id 后重试。`,
						);
					}
					store.remove(task.id);
					return removedResult(task);
				}

				// name 为必填语义走到这里（上面已排除两者皆空）。
				const matches = store.list().filter((t) => t.name === name);
				const [only] = matches;
				if (matches.length === 1 && only !== undefined) {
					store.remove(only.id);
					return removedResult(only);
				}

				/*
				 * 无命中 / 多名命中不是执行失败，是「需要澄清」——返回正常结果与候选，
				 * 模型拿去与用户核对或改用 id；throw（isError）会诱导它原样重试。
				 */
				if (matches.length === 0) {
					const all = store.list();
					const candidates =
						all.length === 0 ? "当前没有任何定时任务。" : `现有任务：\n${all.map(briefLine).join("\n")}`;
					return {
						content: [
							{
								type: "text" as const,
								text: `没有找到名为「${name ?? ""}」的定时任务，未删除任何任务。\n${candidates}\n请与用户核对名称，或改用 id 删除。`,
							},
						],
						details: {},
					};
				}
				return {
					content: [
						{
							type: "text" as const,
							text:
								`名为「${name ?? ""}」的定时任务有 ${matches.length} 个，无法确定删除哪一个，未删除任何任务：\n` +
								`${matches.map(briefLine).join("\n")}\n请与用户确认后，用 id 指定要删除的任务。`,
						},
					],
					details: {},
				};
			},
		});
	};
}

function removedResult(task: AutomationTask) {
	return {
		content: [
			{
				type: "text" as const,
				text: `已删除定时任务「${task.name}」（${scheduleSummary(task.schedule)}，id: ${task.id}）。`,
			},
		],
		details: { taskId: task.id },
	};
}
