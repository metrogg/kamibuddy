/**
 * 内置「记忆整理」蒸馏任务（spec: add-memory-system）：daemon 启动时确保
 * 它在任务库里存在，并把启停状态对齐 preferences.memoryEnabled。
 *
 * 为什么放在 core 而不是 daemon/index.ts：daemon 入口文件顶层要
 * process.parentPort，脱离 Electron 无法加载，逻辑沉在这里才能单测。
 *
 * prompt 是常量而不是 resources/ 下的文件：它不是提示词组装链路的片段
 * （scenes/modes/fragments 那套由 loadResources 装载），而是任务的输入
 * 数据，随任务一起落进 automations.json；为它单开一类资源目录是 YAGNI。
 */

import { getConfigDir, getSessionsDir } from "./config-paths.ts";
import { profilePath } from "./memory.ts";
import type { AutomationStore } from "./automation-store.ts";
import { nextRunAfter } from "../shared/automation.ts";

/**
 * 固定 id：ensure 幂等的锚点。用户任务的 id 是 randomUUID，
 * 撞不上这个字面量。
 */
export const BUILTIN_MEMORY_TASK_ID = "builtin-memory-distill";

/** 深夜跑：蒸馏是后台家务，不该抢白天的会话（spec：daily 03:00）。 */
const SCHEDULE = { type: "daily", time: "03:00" } as const;

/**
 * 蒸馏指令。只讲三件事：原料在哪（近 3 天的会话 JSONL）、提炼什么
 * （两节画像的持久事实）、产物怎么维护（合并 / 保留 / 淘汰，无新不改写）。
 * 会话库的可读性与 PROFILE.md 的可写性由权限门的记忆白名单保障
 * （permission-policy 阶段 0/1），这里不需要叮嘱模型绕权限。
 */
function distillPrompt(sessionsDir: string, profile: string): string {
	return [
		"你是 KamiBuddy 的记忆整理任务，每晚在无人值守下自动运行。没有人与你对话：你的价值在落盘的文件里，不在回复本身。",
		"",
		"按以下步骤工作：",
		`1. 会话文件在 ${sessionsDir} 下（JSONL，一行一条消息）。用 ls 按修改时间找出最近 3 天内有改动的会话文件；一个都没有就到此为止，不改写任何文件。`,
		"2. 用 read 浏览这些会话，提取关于用户本人的持久信息，分两类：",
		"   - 工作背景：角色与职责、手头在做的项目、常用技术栈、工作环境（操作系统、工具链等）；",
		"   - 个人背景：沟通偏好（语言、语气）、输出偏好（格式、详略）、稳定的工作习惯。",
		"   只留跨会话稳定的事实；一次性的事务内容、临时状态不要提炼。",
		`3. 画像文件是 ${profile}（不存在就视为空白）。先 read 现状，再用 write/edit 更新它：保持「## 工作背景」「## 个人背景」两节结构，新信息合并进去，仍有价值的旧内容保留，已被新信息证伪或过时的条目删掉。没有新信息时不改写文件。`,
		"",
		"完成后只回一两句简短总结（如「已更新画像的工作背景一节」或「无新信息，未改动」）。",
	].join("\n");
}

/**
 * 确保内置任务存在且启停与 memoryEnabled 一致；返回是否有落盘变更
 * （调用方据此推 automationEvent changed）。
 *
 * - 不存在 → 创建（daily 03:00，cwd = 配置目录 —— 原料 sessions/ 与产物
 *   PROFILE.md 都在其下，权限门对工作区外路径的拦挡由记忆白名单与会话库
 *   只读放行专门开口，见 permission-policy）。
 * - 已存在 → **只对齐 status**：名称 / prompt / 调度是用户可能编辑过的
 *   字段，不覆盖（spec：已存在不覆盖）。toggle 是启停的唯一权威，
 *   管理页对内置任务的停用不持久 —— 下次启动会被拉回 toggle 值。
 *
 * 启停语义与 toggleAutomation 一致：停用保留 nextRunAt，启用按当前时间
 * 重算下一次（daily 调度必有下一次，nextRunAfter 不会返回 undefined）。
 */
export function ensureBuiltinMemoryTask(
	store: AutomationStore,
	memoryEnabled: boolean,
	now: number = Date.now(),
): boolean {
	const desiredStatus = memoryEnabled ? "active" : "paused";
	const existing = store.get(BUILTIN_MEMORY_TASK_ID);

	if (existing === undefined) {
		store.upsert({
			id: BUILTIN_MEMORY_TASK_ID,
			name: "记忆整理",
			prompt: distillPrompt(getSessionsDir(), profilePath()),
			schedule: SCHEDULE,
			status: desiredStatus,
			cwd: getConfigDir(),
			runs: [],
			createdAt: now,
			updatedAt: now,
			nextRunAt: nextRunAfter(SCHEDULE, now),
			builtin: true,
		});
		return true;
	}

	if (existing.status === desiredStatus) return false;
	const nextRunAt =
		desiredStatus === "active" ? nextRunAfter(existing.schedule, now) : existing.nextRunAt;
	store.upsert({ ...existing, status: desiredStatus, nextRunAt, updatedAt: now });
	return true;
}
