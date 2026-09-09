/**
 * 侧栏「任务 / 空间」两区的会话分组（纯展示逻辑）。
 *
 * 为什么放 renderer 侧纯函数：分组只依赖 SessionSummary 的现有字段，
 * daemon 不需要为此新增任何通道；纯函数可直接跑 vitest（同 ime-guard /
 * thinking-fold 的惯例），UI 组件只负责渲染结果。
 *
 * cwd 相等判定用字符串全等，不做大小写/分隔符归一：SessionSummary.cwd 与
 * WorkspaceGroupMeta.cwd 来自同一个 SessionManager，都是 resolve 后的绝对
 * 路径，同源同形；在这里归一化反而会和 resume/rename 依赖的精确路径键错位。
 */

import type { SessionSummary, WorkspaceGroupMeta } from "@shared/ipc.ts";

/** 「空间」区的一组：同一工作目录下的会话。 */
export interface SpaceGroup {
	readonly cwd: string;
	/** 组名：displayName 覆盖 ?? 目录 basename。 */
	readonly name: string;
	/** 组内会话，modifiedAt 倒序。 */
	readonly sessions: readonly SessionSummary[];
	/** 组内最近任务时间（组间排序键）。 */
	readonly latestAt: number;
}

export interface SessionGroups {
	/** 「任务」区：playground 会话，modifiedAt 倒序。 */
	readonly tasks: readonly SessionSummary[];
	/** 「空间」区：按 cwd 分组，latestAt 倒序。 */
	readonly spaces: readonly SpaceGroup[];
}

export function groupSessions(
	summaries: readonly SessionSummary[],
	metas: readonly WorkspaceGroupMeta[],
): SessionGroups {
	// displayName 只收 trim 后非空的：用户把空间名改成空白不该让组名变空串，
	// 回退 basename 至少还能看出是哪个目录。
	const displayNames = new Map<string, string>();
	for (const meta of metas) {
		const name = meta.displayName?.trim();
		if (name) displayNames.set(meta.cwd, name);
	}

	const tasks: SessionSummary[] = [];
	const buckets = new Map<string, { sessions: SessionSummary[]; latestAt: number }>();
	for (const session of summaries) {
		if (session.isPlayground) {
			tasks.push(session);
			continue;
		}
		const bucket = buckets.get(session.cwd);
		if (bucket) {
			bucket.sessions.push(session);
			if (session.modifiedAt > bucket.latestAt) bucket.latestAt = session.modifiedAt;
		} else {
			buckets.set(session.cwd, { sessions: [session], latestAt: session.modifiedAt });
		}
	}

	tasks.sort(byModifiedDesc);

	const spaces: SpaceGroup[] = [];
	for (const [cwd, bucket] of buckets) {
		bucket.sessions.sort(byModifiedDesc);
		spaces.push({
			cwd,
			name: displayNames.get(cwd) ?? basename(cwd),
			sessions: bucket.sessions,
			latestAt: bucket.latestAt,
		});
	}
	spaces.sort((a, b) => b.latestAt - a.latestAt);

	return { tasks, spaces };
}

function byModifiedDesc(a: SessionSummary, b: SessionSummary): number {
	return b.modifiedAt - a.modifiedAt;
}

/**
 * 目录 basename，同时处理 `/` 与 `\`（Windows 上 daemon 给反斜杠路径，
 * posix 环境与测试会带正斜杠，两边都要对）。
 */
function basename(cwd: string): string {
	if (cwd === "") return cwd;
	const trimmed = cwd.replace(/[/\\]+$/, "");
	// 整串都是分隔符（"/"）、或盘符根（"D:\"）：没有可取的 basename，
	// 原样返回总比显示空串或裸盘符 "D:" 强。
	if (trimmed === "" || /^[A-Za-z]:$/.test(trimmed)) return cwd;
	const sep = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	return sep < 0 ? trimmed : trimmed.slice(sep + 1);
}
