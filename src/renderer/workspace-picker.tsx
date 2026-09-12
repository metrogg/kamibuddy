/**
 * 工作空间选择器。机制对标 WorkBuddy 的 WorkspacePicker：
 * 空间 = 目录；默认根 / 根下已有子目录 / 新建 / 打开本地文件夹。
 * 未显式选择时即临时任务（cwd = <生效根>/临时任务 共享目录），
 * 不再有「不使用工作空间」——playground 语义已退役（经取证是我们自己的发明）。
 *
 * 安全校验在 daemon（core/workspace.ts）：配置目录 / 应用目录会被拒，
 * 这里只负责把原因展示出来。
 *
 * 会话与目录终身绑定，切换即新任务（daemon 作废旧会话），
 * 所以切换成功后必须经 onChanged 触发一次 snapshot 重同步。
 */

import { useEffect, useState } from "react";
import type { WorkspaceSnapshot } from "@shared/ipc.ts";
import { IconChevronDown, IconPlus, IconWorkspace } from "./icons.tsx";

interface WorkspacePickerProps {
	/** 当前生效目录（session_state.cwd）。undefined 仅是会话尚未建立的初始瞬态，按临时任务显示。 */
	readonly cwd: string | undefined;
	/** 切换成功后调用：daemon 已重置会话，UI 需要重拉快照。 */
	readonly onChanged: () => void;
}

/** 取路径末段作为显示名。Windows 与 POSIX 分隔符都认。 */
function baseName(path: string): string {
	const trimmed = path.replace(/[\\/]+$/, "");
	const at = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
	return at === -1 ? trimmed : trimmed.slice(at + 1);
}

export function WorkspacePicker({ cwd, onChanged }: WorkspacePickerProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | undefined>(undefined);
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");
	const [error, setError] = useState<string | undefined>(undefined);
	const [busy, setBusy] = useState(false);

	// 每次打开都重拉列表：别的窗口/上一轮操作可能新建过空间。
	useEffect(() => {
		if (!open) return;
		setError(undefined);
		setCreating(false);
		setName("");
		window.kami.workspaceSnapshot().then(setSnapshot).catch((e: unknown) => {
			setError(e instanceof Error ? e.message : String(e));
		});
	}, [open]);

	// Esc 关闭弹层：弹层没有键盘焦点管理，Esc 是键盘用户唯一的关闭路径；
	// 与 backdrop 互补（一个管键盘，一个管指针）。同 model-menu 约定。
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	const fail = (e: unknown): void => {
		setError(e instanceof Error ? e.message : String(e));
		setBusy(false);
	};

	/** 统一切换入口。空串 = 临时任务（daemon 映射到共享临时目录），本组件已不提供该入口。 */
	const switchTo = (path: string): void => {
		// 规范化当前值与目标值：初始瞬态 cwd 为 undefined，与空串同按「未选择」处理，
		// 避免 ""/undefined 不相等误判。
		const current = cwd ?? "";
		if (path === current) {
			setOpen(false);
			return;
		}
		setBusy(true);
		setError(undefined);
		window.kami
			.setWorkspace(path)
			.then(() => {
				setBusy(false);
				setOpen(false);
				onChanged();
			})
			.catch(fail);
	};

	const create = (): void => {
		const trimmed = name.trim();
		if (trimmed === "") return;
		setBusy(true);
		setError(undefined);
		window.kami
			.createWorkspace(trimmed)
			.then(() => {
				setBusy(false);
				setOpen(false);
				onChanged();
			})
			.catch(fail);
	};

	/** 系统目录选择框取消时不算错误，静默收回即可。 */
	const pickFolder = (): void => {
		setBusy(true);
		setError(undefined);
		window.kami
			.pickWorkspaceDirectory()
			.then((path) => {
				if (path === undefined) {
					setBusy(false);
					return;
				}
				switchTo(path);
			})
			.catch(fail);
	};

	return (
		<div className="ws-picker">
			<button
				type="button"
				className="context-chip"
				title={cwd ?? "临时任务"}
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
			>
				<IconWorkspace size={14} />
				{/* 临时任务的 cwd 是 <根>/临时任务，baseName 天然显示「临时任务」；
				    undefined/空串是尚未显式选择的默认态，同样显示「临时任务」。 */}
				{cwd === undefined || cwd === "" ? "临时任务" : baseName(cwd)}
				<IconChevronDown size={12} />
			</button>

			{open && (
				<>
					{/* 透明 backdrop：点面板外任意处关闭。 */}
					<button type="button" className="ws-backdrop" aria-label="关闭" onClick={() => setOpen(false)} />
					<div className="ws-popover">
						<div className="ws-list">
							{snapshot === undefined && error === undefined && <div className="ws-hint">加载中…</div>}
							{snapshot !== undefined && (
								<>
									<button type="button" className="ws-item" disabled={busy} onClick={() => switchTo(snapshot.defaultRoot)}>
										<span className="ws-item-name">默认工作空间</span>
										<span className="ws-item-path">{snapshot.defaultRoot}</span>
										{cwd === snapshot.defaultRoot && <span className="ws-current">当前</span>}
									</button>
									{snapshot.workspaces.map((w) => (
										<button key={w} type="button" className="ws-item" disabled={busy} onClick={() => switchTo(w)}>
											<span className="ws-item-name">{baseName(w)}</span>
											<span className="ws-item-path">{w}</span>
											{cwd === w && <span className="ws-current">当前</span>}
										</button>
									))}
								</>
							)}
						</div>

						<div className="ws-actions">
							{creating ? (
								<div className="ws-create">
									<input
										value={name}
										aria-label="新工作空间名称"
										onChange={(e) => setName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") create();
											if (e.key === "Escape") {
												// 拦住冒泡：输入框的 Esc 只退出创建态，
												// 不连带触发弹层级的 Esc 关闭。
												e.stopPropagation();
												setCreating(false);
											}
										}}
										placeholder="空间名称，如：季度汇报"
										disabled={busy}
										// 弹出面板里唯一的输入框，自动聚焦即预期
										autoFocus
									/>
									<button type="button" onClick={create} disabled={busy || name.trim() === ""}>
										创建
									</button>
									<button type="button" onClick={() => setCreating(false)} disabled={busy}>
										取消
									</button>
								</div>
							) : (
								<>
									<button type="button" className="ws-action" onClick={() => setCreating(true)} disabled={busy}>
										<IconPlus size={14} />
										新建工作空间
									</button>
									<button type="button" className="ws-action" onClick={pickFolder} disabled={busy}>
										打开本地文件夹…
									</button>
								</>
							)}
						</div>

						{error !== undefined && <div className="ws-error">{error}</div>}
					</div>
				</>
			)}
		</div>
	);
}
