/**
 * 三层记忆的文件层：路径推导 + 注入段组装（spec: add-memory-system）。
 *
 *   L2  用户级  ~/.kamibuddy/MEMORY.md            跨项目的精确规则（用户明说「记住」才写）
 *   L3  工作区  <cwd>/.kamibuddy/memory/          YYYY-MM-DD.md 日志（只增不改）+ MEMORY.md 项目笔记
 *   L1a 画像    ~/.kamibuddy/PROFILE.md           内置蒸馏任务每晚维护
 *
 * 写入用模型既有的 write/edit 工具（权限门对这三类路径有白名单，见
 * extensions/permission-policy.ts），本模块只负责**读侧**：compose 时把
 * 记忆内容组装成系统提示词的一个段。
 *
 * 降级口径（AGENTS.md：compose 注入路径不能炸——记忆是增强不是门槛）：
 * 单份文件读不出（不存在 / 编码坏 / 权限错）就当它没有，绝不抛错打断
 * 会话组装；全部为空则整个段不注入（零 token）。这与资源 loader 的
 * 「坏文件抛错」相反，是有意的：scenes/modes 是产品本体，缺了等于身份
 * 残缺必须响亮失败；记忆是用户数据，新用户本来就一条都没有。
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "./config-paths.ts";

/** L2 用户级记忆（跨项目精确规则）。 */
export function userMemoryPath(): string {
	return join(getConfigDir(), "MEMORY.md");
}

/** L1a 本地画像（内置蒸馏任务维护，模型不手改）。 */
export function profilePath(): string {
	return join(getConfigDir(), "PROFILE.md");
}

/** L3 工作区记忆目录：日志与项目长期笔记都放这里。 */
export function workspaceMemoryDir(cwd: string): string {
	return join(cwd, ".kamibuddy", "memory");
}

/**
 * 记忆系统行为纪律的提示词文件（resources/prompts/memory-system.md）。
 * 读不出返回 undefined（调用方跳过该段）——理由见文件头的降级口径。
 */
export function loadMemorySystemPrompt(resourcesDir: string): string | undefined {
	return readTextOrUndefined(join(resourcesDir, "prompts", "memory-system.md"));
}

/** 日志文件名形如 2026-09-11.md；日期串按字典序排序即按时间排序。 */
const LOG_FILE = /^\d{4}-\d{2}-\d{2}\.md$/;

/** 注入的近期日志清单条数上限：只列文件名不读正文，模型按需 read（控 token）。 */
const RECENT_LOG_LIMIT = 3;

/**
 * 组装 compose 注入用的记忆内容段：L2 全文 + 画像全文 + L3 项目笔记全文
 * + 最近 3 天的日志文件名清单。三层全空返回 undefined（调用方零 token 跳过）。
 */
export function buildMemorySection(cwd: string): string | undefined {
	const sections: string[] = [];

	const userMemory = readTextOrUndefined(userMemoryPath());
	if (userMemory !== undefined) {
		sections.push(`## 长期记忆（用户级）\n\n${userMemory}`);
	}

	const profile = readTextOrUndefined(profilePath());
	if (profile !== undefined) {
		sections.push(`## 用户画像\n\n${profile}`);
	}

	const wsDir = workspaceMemoryDir(cwd);
	const projectMemory = readTextOrUndefined(join(wsDir, "MEMORY.md"));
	if (projectMemory !== undefined) {
		sections.push(`## 本项目记忆\n\n${projectMemory}`);
	}

	const recentLogs = listRecentLogs(wsDir);
	if (recentLogs.length > 0) {
		sections.push(
			`### 近期日志（按需读取）\n\n以下是本项目最近的工作日志（位于 ${wsDir}），需要细节时用 read 查看：\n${recentLogs.map((name) => `- ${name}`).join("\n")}`,
		);
	}

	return sections.length === 0 ? undefined : sections.join("\n\n");
}

/** 读文本文件；不存在 / 读错 / 全空白都归一为 undefined（降级口径见文件头）。 */
function readTextOrUndefined(path: string): string | undefined {
	try {
		const text = readFileSync(path, "utf8").trim();
		return text === "" ? undefined : text;
	} catch {
		return undefined;
	}
}

/** 最近 N 个日志文件名（按文件名日期倒序）。目录读不出 = 没有日志。 */
function listRecentLogs(wsDir: string): string[] {
	try {
		return readdirSync(wsDir)
			.filter((name) => LOG_FILE.test(name))
			.sort()
			.reverse()
			.slice(0, RECENT_LOG_LIMIT);
	} catch {
		return [];
	}
}
