/**
 * 定时任务内置模板库（对齐清单 L36，WorkBuddy automation-panel 的
 * 「模板添加自动化」同构）。
 *
 * 设计约束：
 *   - **提示词必须自包含**：每次运行都是全新会话（automation-runner 注释），
 *     看不到任何对话上下文 —— 时间、对象、产出位置必须写全。模板里出现
 *     「当前目录」是安全的（run 会话有真实 cwd），出现「当前对话」不合法。
 *   - **调度预设全部过 validateSchedule**（下方测试钉住），选用后用户仍可改。
 *   - 工具假设保守：run 会话有联网 / powershell / 文件 / present_files
 *     （automation-runner 的扩展清单），没有图像生成 —— 不出「生成图片」类模板。
 *
 * 放 shared：renderer 的选择浮层与将来的对话内 automation_create 工具共用，
 * 不漂移。
 */

import type { Schedule } from "./automation.ts";

export interface AutomationTemplate {
	readonly id: string;
	readonly name: string;
	/** 一句话说明（选择浮层的卡片副行）。 */
	readonly description: string;
	readonly prompt: string;
	readonly schedule: Schedule;
}

export const AUTOMATION_TEMPLATES: readonly AutomationTemplate[] = [
	{
		id: "daily-tech-brief",
		name: "每日科技简报",
		description: "联网搜索当天科技要闻，写成简报存到工作目录",
		prompt:
			"搜索今天的科技行业新闻，挑出 5 条最重要的，写成一份简短简报（每条 2-3 句话，附来源链接），" +
			"保存到当前目录的 news/ 文件夹下，文件名用今天的日期（如 2026-09-16.md）。目录不存在就先创建。",
		schedule: { type: "daily", time: "09:30" },
	},
	{
		id: "family-call-reminder",
		name: "家人问候提醒",
		description: "每周日上午提醒给家人打电话或发消息",
		prompt: "提醒我：该给家人打电话或发消息了，简单问候一下近况。",
		schedule: { type: "weekly", time: "10:00", weekdays: [0] },
	},
	{
		id: "repo-daily-report",
		name: "仓库变更日报",
		description: "统计当前仓库当天的提交，写一份变更日报（需工作目录是 git 仓库）",
		prompt:
			"在当前目录查看今天的 git 提交记录（git log --since 今天零点），" +
			"按「新增功能 / 问题修复 / 其他」归类，写一份简短的变更日报，保存为当前目录下 daily-report-<今天日期>.md。" +
			"如果今天没有提交，简单说明即可。",
		schedule: { type: "daily", time: "18:00" },
	},
	{
		id: "weekly-review",
		name: "每周工作回顾",
		description: "每周五下午检查本周工作目录里的变更与记录，输出一份回顾",
		prompt:
			"回顾本周：查看当前工作目录下最近 7 天内修改过的文件（排除 node_modules 等依赖目录），" +
			"写一份简短的本周工作回顾（做了什么 / 有什么产出 / 下周建议关注什么），保存为当前目录下 weekly-review-<今天日期>.md。",
		schedule: { type: "weekly", time: "17:00", weekdays: [5] },
	},
	{
		id: "standup-reminder",
		name: "起身活动提醒",
		description: "每隔 90 分钟提醒起身活动几分钟",
		prompt: "提醒我：已经坐了 90 分钟，起身活动 5 分钟，看看远处放松眼睛。",
		schedule: { type: "interval", everyMinutes: 90 },
	},
	{
		id: "inbox-triage",
		name: "工作目录巡检",
		description: "每天早上检查工作目录里新增的文件，按类型整理成清单",
		prompt:
			"检查当前目录下最近 24 小时内新增或修改的文件（跳过依赖与隐藏目录），" +
			"按类型（文档 / 代码 / 数据 / 其他）整理成一份清单，直接在回复里给出，不做任何修改。",
		schedule: { type: "daily", time: "08:45" },
	},
];
