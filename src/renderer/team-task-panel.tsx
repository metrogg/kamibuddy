/**
 * 团队任务面板（spec: add-team-ux-parity 批次 ③，Ctrl+T）。
 *
 * 与「团队常驻状态栏」同位互斥（输入区上方）：看人在哪干活 vs 看活分到哪一步，
 * 同一时刻只关心一件。WorkBuddy 的 Ctrl+T 任务列表同语义。
 *
 * **只读**：任务板是模型的协调账本，用户在面板里手改状态会让模型基于过期认知
 * 继续调度（它不知道人类动了哪一格）。要看就打开看，要改就在对话里说一句
 * —— 由模型经 team_task_* 工具改（spec 否决方案）。
 *
 * 数据经 IPC 现拉（daemon 的 getTeamTasks），面板打开期间轻量轮询：本地 IPC
 * 一次往返的成本远低于「面板显示的还是三分钟前的状态」带来的困惑。
 */

import { useEffect, useState } from "react";
import type { TeamTaskView } from "@shared/ipc.ts";

/** 面板分组顺序（与 daemon 的任务清单渲染同序：能开工的排最前）。 */
const GROUP_ORDER: readonly { readonly status: string; readonly label: string }[] = [
	{ status: "ready", label: "可开工" },
	{ status: "in_progress", label: "进行中" },
	{ status: "pending", label: "等上游" },
	{ status: "completed", label: "已完成" },
	{ status: "cancelled", label: "已取消" },
];

export interface TeamTaskGroup {
	readonly status: string;
	readonly label: string;
	readonly tasks: readonly TeamTaskView[];
}

/**
 * 按状态分组（纯函数，可单测）。空 / 未知状态的组不出现 —— 未知状态多半是我们
 * 加了新状态但没改这里，静默丢掉比渲染一个英文枚举更能提醒人去补。
 */
export function groupTeamTasks(tasks: readonly TeamTaskView[]): readonly TeamTaskGroup[] {
	return GROUP_ORDER.map((entry) => ({
		...entry,
		tasks: tasks.filter((task) => task.status === entry.status),
	})).filter((group) => group.tasks.length > 0);
}

/** 依赖摘要（纯函数）：`依赖 t1 · t2`；无依赖为空串。 */
export function taskDependencyText(task: TeamTaskView): string {
	return task.blockedBy.length === 0 ? "" : `依赖 ${task.blockedBy.join(" · ")}`;
}

export interface TeamTaskPanelProps {
	readonly onClose: () => void;
}

export function TeamTaskPanel({ onClose }: TeamTaskPanelProps): React.JSX.Element {
	const [tasks, setTasks] = useState<readonly TeamTaskView[] | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		let alive = true;
		const load = (): void => {
			window.kami
				.getTeamTasks()
				.then((next) => {
					if (alive) setTasks(next);
				})
				.catch((reason: unknown) => {
					if (alive) setError(reason instanceof Error ? reason.message : String(reason));
				});
		};
		load();
		// 轮询：面板开着时状态才会变（模型在干活），关掉就停。
		const timer = window.setInterval(load, 2500);
		return () => {
			alive = false;
			window.clearInterval(timer);
		};
	}, []);

	const groups = tasks === undefined ? [] : groupTeamTasks(tasks);

	return (
		<div className="team-tasks" role="region" aria-label="团队任务板">
			<div className="team-tasks-head">
				<span className="team-tasks-title">任务板</span>
				<span className="team-tasks-hint">只读 · 让主理人改（Ctrl+T 关闭）</span>
				<button type="button" className="team-bar-close" onClick={onClose} aria-label="关闭任务板" title="关闭">
					×
				</button>
			</div>
			{error !== undefined ? (
				<p className="team-tasks-empty">读任务板失败：{error}</p>
			) : tasks === undefined ? (
				<p className="team-tasks-empty">正在读取…</p>
			) : tasks.length === 0 ? (
				<p className="team-tasks-empty">还没有任务。让主理人用 team_task_create 排活。</p>
			) : (
				<div className="team-tasks-body">
					{groups.map((group) => (
						<div key={group.status} className="team-tasks-group">
							<div className={`team-tasks-group-head st-${group.status}`}>
								{group.label}（{group.tasks.length}）
							</div>
							{group.tasks.map((task) => {
								const deps = taskDependencyText(task);
								return (
									<div key={task.id} className="team-tasks-row">
										<span className="team-tasks-id">[{task.id}]</span>
										<span className="team-tasks-name">{task.title}</span>
										{task.owner !== undefined && <span className="team-tasks-owner">@{task.owner}</span>}
										{deps !== "" && <span className="team-tasks-deps">{deps}</span>}
										{task.result !== "" && <span className="team-tasks-result">{task.result}</span>}
									</div>
								);
							})}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
