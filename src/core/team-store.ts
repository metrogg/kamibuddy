/**
 * 团队落盘（spec: add-team-collaboration-parity 批次 ⑤）。
 *
 * 布局对齐 WorkBuddy（`~/.codebuddy/teams/<team>/{config.json,inboxes/<member>.json}`）：
 * 我们落 `<configDir>/teams/<团队名>/config.json`，一份文件装团队结构 + 任务板。
 *
 * **为什么不落信箱**（否决方案，2026-09-18）：成员宿主不可恢复 —— pi 的会话文件
 * 可以重建，但成员与领导之间的协作契约（已分派的活、信箱里没读完的话）复原不了，
 * 重启后成员 sessionId 全变，落盘的消息**没有可达的收件人**。更要紧的是成员产出
 * 已经作为消息进了领导会话的 JSONL，那份本来就落盘了；信箱只是投递途中的暂存，
 * 再落一份是冗余且会过期。所以本模块只解决「团队结构与任务板在重启后还在」，
 * 成员一律按「需重建」呈现（诚实优于假装恢复）。
 *
 * 安全：团队名来自用户输入（team_create 的 name），直接拼进路径就是路径穿越
 * （`../` 能跑到配置目录外写文件）。这里**只允许**字母数字与 `-_.`，其余抛错 ——
 * 团队名是展示名，没有容纳路径字符的需求。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TeamTask } from "./team-tasks.ts";

/** 落盘格式版本（将来改结构时用来做迁移判断）。 */
export const TEAM_STORE_VERSION = 1;

export interface StoredTeamMember {
	readonly name: string;
	readonly agentName: string;
	readonly task: string;
	readonly sessionId?: string;
	readonly status: string;
	readonly turns: number;
	readonly toolCalls: number;
	readonly tokens: number;
	readonly cost: number;
	readonly planStatus: string;
	readonly planFeedback: string;
}

export interface StoredTeam {
	readonly version: number;
	readonly name: string;
	readonly leaderSessionId: string;
	readonly updatedAt: number;
	readonly members: readonly StoredTeamMember[];
	/** 任务板快照（批次 ① 的结构，原样存取）。 */
	readonly tasks: readonly TeamTask[];
}

/** 团队名 → 目录名：只允许字母数字与 `-_.`（防路径穿越，见文件头）。 */
function safeDirName(teamName: string): string {
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(teamName)) {
		throw new Error(`团队名「${teamName}」不能用于落盘：只允许字母、数字、-、_、.（它也是目录名）`);
	}
	return teamName;
}

export function teamsRootDir(configDir: string): string {
	return join(configDir, "teams");
}

export function teamDir(configDir: string, teamName: string): string {
	return join(teamsRootDir(configDir), safeDirName(teamName));
}

/** 写一份团队快照（覆盖写；目录不存在则建）。 */
export function writeTeam(configDir: string, team: StoredTeam): void {
	const dir = teamDir(configDir, team.name);
	mkdirSync(dir, { recursive: true });
	const payload: StoredTeam = { ...team, version: TEAM_STORE_VERSION };
	writeFileSync(join(dir, "config.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

/** 删掉一个团队的落盘目录（解散时调）。不存在 → no-op。 */
export function removeTeam(configDir: string, teamName: string): void {
	rmSync(teamDir(configDir, teamName), { recursive: true, force: true });
}

/**
 * 读回全部团队快照（启动恢复用）。
 *
 * 解析失败**响亮抛错**：这些文件只由我们写（同 automations.json 的立场）；
 * daemon 侧捕获后记事件日志并继续启动（同 models.json 的容错口径 —— 一份坏文件
 * 不该让界面永久卡在「正在启动」）。
 */
export function readTeams(configDir: string): readonly StoredTeam[] {
	const root = teamsRootDir(configDir);
	if (!existsSync(root)) return [];
	const teams: StoredTeam[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
		const file = join(root, entry.name, "config.json");
		if (!existsSync(file)) continue;
		const parsed = JSON.parse(readFileSync(file, "utf8")) as StoredTeam;
		if (parsed.version !== TEAM_STORE_VERSION) {
			throw new Error(
				`团队文件版本不认识：${file}（版本 ${String(parsed.version)}，本程序是 ${TEAM_STORE_VERSION}）`,
			);
		}
		teams.push(parsed);
	}
	return teams;
}
