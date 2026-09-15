/**
 * worktree 副本开关（对齐清单 C22 / L27）。
 *
 * 机制对标 WorkBuddy 的 `WbWorktreeChip`：代码场景下选定一个基准分支，
 * 之后新建的任务会跑在一份独立的 git worktree 副本里 ——
 * **agent 改的是副本，不是用户的主仓库**。这正是让它在真实工程目录里
 * 放手改文件的前提。
 *
 * 【可见性策略：与 WorkBuddy 逐条一致】三条同时满足才渲染，任一不满足
 * **整块不渲染**：
 *   1. 场景 = code（调用方判定，对齐 `sceneMode === "code"`）；
 *   2. 已选工作目录（cwd 非空）—— 没有目录就谈不上副本的基准；
 *   3. cwd 是 git 仓库（本组件自己查，对齐其芯片内部的 isGit 判定）。
 *
 * 历史（2026-09-15）：曾一度改成「始终渲染 + 不可用时在弹层里说明原因」，
 * 动机是可发现性 —— 我们新建任务的默认落点是临时任务的自动目录（不是 git
 * 仓库），命中第 3 条不满足是常态，整块隐藏会让用户切到代码场景后零变化、
 * 根本发现不了这个功能（实测踩到）。**用户明确要求回到与 WorkBuddy 一致的
 * 隐藏策略**，故回退。要再改之前先问一次。
 *
 * 样式复用 `.ws-*` 弹层类：它们在 index.css 里就是多个 chip 共用的通用层
 *（原注释列了 workspace-picker / model-menu / permission-menu / plus-menu 四个
 * 调用点），不为本组件另造一套视觉值（DESIGN.md §9 的 CR 自查项）。
 */

import { useEffect, useState } from "react";
import type { WorktreeBranchList } from "@shared/worktree.ts";
import { IconBranch, IconChevronDown } from "./icons.tsx";
import { ErrorState } from "./state-views.tsx";

interface WorktreeChipProps {
	/**
	 * 当前生效工作目录（session_state.cwd）—— 与 WorkspacePicker 同一个 prop 口径。
	 * 未建宿主的会话切空间时它会被换绑，所以「选了空间再勾副本」这条流程是通的。
	 */
	readonly cwd: string | undefined;
}

/** 非 git 仓库时的缺省值：查失败也按它处理（芯片隐藏，不弹错）。 */
const NOT_A_REPO: WorktreeBranchList = {
	isGitRepo: false,
	branches: [],
	currentBranch: undefined,
};

export function WorktreeChip({ cwd }: WorktreeChipProps): React.JSX.Element | null {
	/** undefined = 还没查完（不渲染，避免先闪一个 chip 再消失）。 */
	const [repo, setRepo] = useState<WorktreeBranchList | undefined>(undefined);
	/** 已启用的基准分支。undefined = 不建副本。权威值在 daemon，见 WorkspaceSnapshot。 */
	const [enabled, setEnabled] = useState<string | undefined>(undefined);
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);

	// 挂载与 cwd 变化时查一次仓库形态。cancelled 守卫是必需的：
	// 用户快速切空间时会有两个 in-flight 查询，晚到的那个不能覆盖新结果。
	useEffect(() => {
		if (cwd === undefined || cwd === "") {
			setRepo(NOT_A_REPO);
			return;
		}
		let cancelled = false;
		// 换目录先回到「查询中」：不复位的话会短暂显示上一个目录的分支列表，
		// 用户按着旧列表选中一个并不存在于新目录的分支。
		setRepo(undefined);
		window.kami
			.worktreeBranches(cwd)
			.then((list) => {
				if (!cancelled) setRepo(list);
			})
			.catch(() => {
				if (!cancelled) setRepo(NOT_A_REPO);
			});
		return () => {
			cancelled = true;
		};
	}, [cwd]);

	/*
	 * 已启用的基准分支从快照读，不靠本地状态：本组件在切页面/重建时会重新挂载，
	 * 而 daemon 的意图是持久的 —— 只信本地状态的话，界面会显示「未启用」
	 * 而新任务照样建副本，这是最难排查的那类不一致。
	 */
	useEffect(() => {
		window.kami
			.workspaceSnapshot()
			.then((snapshot) => setEnabled(snapshot.worktreeBranch))
			.catch(() => undefined);
	}, []);

	// Esc 关闭弹层：与 workspace-picker 同一约定（弹层没有键盘焦点管理，
	// Esc 是键盘用户唯一的关闭路径，与 backdrop 互补）。
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	const choose = (branch: string | undefined): void => {
		setBusy(true);
		setError(undefined);
		window.kami
			.setWorktreeBranch(branch)
			.then(() => {
				setBusy(false);
				setEnabled(branch);
				setOpen(false);
			})
			.catch((e: unknown) => {
				setError(e instanceof Error ? e.message : String(e));
				setBusy(false);
			});
	};

	// 还没查完 / 不是 git 仓库：整块不渲染（对齐 WorkBuddy —— 对普通文件夹
	// 摆一个不可用的副本开关只是噪音）。
	if (repo === undefined || !repo.isGitRepo) return null;

	return (
		<div className="ws-picker">
			<button
				type="button"
				className="context-chip"
				title={
					enabled === undefined
						? "在独立的 git 副本里干活，不直接改主仓库"
						: `副本基准分支：${enabled}`
				}
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
			>
				<IconBranch size={14} />
				{enabled === undefined ? "Worktree" : enabled}
				<IconChevronDown size={12} />
			</button>

			{open && (
				<>
					<button type="button" className="ws-backdrop" aria-label="关闭" onClick={() => setOpen(false)} />
					<div className="ws-popover">
						<div className="ws-list">
							<button type="button" className="ws-item" disabled={busy} onClick={() => choose(undefined)}>
								<span className="ws-item-name">不使用副本</span>
								<span className="ws-item-path">直接在所选目录里工作</span>
								{enabled === undefined && <span className="ws-current">当前</span>}
							</button>
							{repo.branches.map((branch) => (
								<button
									key={branch}
									type="button"
									className="ws-item"
									disabled={busy}
									onClick={() => choose(branch)}
								>
									<span className="ws-item-name">{branch}</span>
									{branch === repo.currentBranch && (
										<span className="ws-item-path">当前检出分支</span>
									)}
									{enabled === branch && <span className="ws-current">当前</span>}
								</button>
							))}
						</div>
						{error !== undefined && <ErrorState message={error} />}
					</div>
				</>
			)}
		</div>
	);
}
