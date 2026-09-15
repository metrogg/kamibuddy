/**
 * 工作空间选择器。机制对标 WorkBuddy 的 WorkspacePicker：
 * 空间 = 目录；不使用工作空间 / 根下已有子目录 / 新建 / 打开本地文件夹。
 * **列表里没有「生效根本身」这一固定项**（2026-09-15 对齐）：WorkBuddy 的
 * options 只有一个构造点（ui-docs-viewer:289204），全部来自 `wb.workspaces.list()`，
 * 不存在指向根的固定项；我们此前多出来的那项已删。
 * 「不使用工作空间」= 回到未绑定目录的临时任务：cwd 待分配（空串），首次执行时才
 * 分配**每个任务自己的自动目录** `<生效根>/YYYY-MM-DD-HH-mm-ss`
 * （spec: align-per-task-dirs），语义上仍是「没选工作空间」：chip 在**待分配**
 * 态显示提示语「选择工作空间」，在**已分配自动目录**态显示「临时任务」
 *（见 pickerLabel 的三态口径）。
 *
 * 该入口照搬 WorkBuddy：其 picker 有 `chatInput.workspacePicker.noWorkspace`
 * 一项，点击即 `store.api.setCwd("")`（docs/WorkBuddy-reference/.../lib-chat-ui-*.js:60867）。
 * **只恢复这个入口**，不复辟旧的 playground 语义（那版是「限制工具集」）——
 * 临时任务的工具集与权限照常。
 *
 * 安全校验在 daemon（core/workspace.ts）：配置目录 / 应用目录会被拒，
 * 这里只负责把原因展示出来。
 *
 * 切换只改「后续新建任务的默认落点」：既有会话 cwd 终身绑定、原地不动
 *（daemon applyWorkspace 同模型）。切换成功后仍须经 onChanged 重拉一次快照——
 * 当前会话的 cwd 可能刚被改动（pristine 桶换绑）。
 * 「新建任务」会把选择**重置为未选**（daemon newTask 默认 targetCwd = ""，
 * 对齐 WorkBuddy 的 taskStarterCwd$("")）——所以 chip 会回到未选提示语，
 * 而不是保留上一个空间。
 */

import { useEffect, useState } from "react";
import type { WorkspaceSnapshot } from "@shared/ipc.ts";
import { isAutoSessionDirName } from "@shared/workspace.ts";
import { IconChevronDown, IconPlus, IconWorkspace } from "./icons.tsx";
import { ErrorState, LoadingState } from "./state-views.tsx";

interface WorkspacePickerProps {
	/** 当前生效目录（session_state.cwd）。undefined 仅是会话尚未建立的初始瞬态，按临时任务显示。 */
	readonly cwd: string | undefined;
	/** 切换成功后调用：当前 cwd 可能已变（pristine 桶换绑），UI 需要重拉快照。 */
	readonly onChanged: () => void;
}

/** 取路径末段作为显示名。Windows 与 POSIX 分隔符都认。 */
function baseName(path: string): string {
	const trimmed = path.replace(/[\\/]+$/, "");
	const at = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
	return at === -1 ? trimmed : trimmed.slice(at + 1);
}

/**
 * 未选工作空间时 chip 的提示语。取值口径直接照搬 WorkBuddy：
 *   - 文案：`chatInput.workspacePicker.label` = 「选择工作空间」
 *     （docs/WorkBuddy-reference/.../lib-chat-ui-*.js:45802）
 *   - 触发条件：:60754 的
 *     `selectedOption?.displayLabel || selectedOption?.label || t(...label)`，
 *     而 selectedValue 为空串时 selectedOption 必为 undefined（:60731-60732）
 *     —— 空串即落到这句提示语。
 * 所以「没选」是一句**提示**，不是某个空间的名字（旧版显示「临时任务」，
 * 用户会以为自己待在一个叫临时任务的空间里）。
 */
const UNBOUND_LABEL = "选择工作空间";

/**
 * 「已分配自动目录」态 chip 的显示名。
 *
 * **这是对 WorkBuddy 的有意偏离**（2026-09-15 决策）：WorkBuddy 在这一态显示的是
 * 目录 basename，即一串 `2026-09-15-14-30-45`。机制是它把当前 cwd 当成「显式添加的
 * 工作空间」塞回 options（ui-docs-viewer:289191 `if (selectedPath) addExplicitWorkspace(...)`），
 * label 取 extractFolderName（:289135-289137），于是 chip 直接显示时间戳 —— 用户看到
 * 的是「我好像选了个叫时间戳的空间」。我们给同一语义一个可读的名字：已分配自动目录
 * 仍然是「用户没选工作空间」的临时任务。
 */
const TEMP_TASK_LABEL = "临时任务";

/**
 * chip 显示的当前工作空间名（纯函数，可单测）。
 *
 * 三态口径（前两态在 WorkBuddy 里共用同一句提示语，我们拆开）：
 *   - 未选 / 待分配（undefined / 空串）：**「选择工作空间」提示语** —— 该状态可能
 *     是会话未建立，也可能是新任务尚未首次执行（还没分配目录），对齐 WorkBuddy；
 *   - basename 命中自动目录格式：已分配了每任务私有目录
 *     `<生效根>/YYYY-MM-DD-HH-mm-ss`（spec: align-per-task-dirs），语义上仍是临时任务，
 *     显示「临时任务」（偏离见 TEMP_TASK_LABEL）；
 *   - 历史共享目录 `<根>/临时任务`：baseName 天然就是「临时任务」，无需特判。
 */
export function pickerLabel(cwd: string | undefined): string {
	if (cwd === undefined || cwd === "") return UNBOUND_LABEL;
	return isAutoSessionDirName(baseName(cwd)) ? TEMP_TASK_LABEL : baseName(cwd);
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

	// 「已选态」：会话/草案已经绑定了目录（命名空间或该任务的自动目录）。
	// 只有在已选态才给「不使用工作空间」——未选时那一项点了也是 no-op，
	// 对齐 WorkBuddy 的 `selectedOption && (...)`（lib-chat-ui:60851）。
	const hasSelection = cwd !== undefined && cwd !== "";

	/**
	 * 统一切换入口。空串 = 临时任务（daemon 记为待分配，首次执行才分配目录）。
	 * 会话已建宿主时只改后续新建任务的落点，既有会话不动（daemon 语义）。
	 */
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
				title={hasSelection ? cwd : UNBOUND_LABEL}
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
			>
				<IconWorkspace size={14} />
				{/* 文案判定收在 pickerLabel（可单测）：未选是提示语「选择工作空间」，
				    已分配的自动目录显示「临时任务」。
				    title 在已选态仍给完整路径，用户要知道自己在哪个目录。 */}
				{pickerLabel(cwd)}
				<IconChevronDown size={12} />
			</button>

			{open && (
				<>
					{/* 透明 backdrop：点面板外任意处关闭。 */}
					<button type="button" className="ws-backdrop" aria-label="关闭" onClick={() => setOpen(false)} />
					<div className="ws-popover">
						<div className="ws-list">
							{snapshot === undefined && error === undefined && <LoadingState />}
							{snapshot !== undefined && (
								<>
									{/* 「不使用工作空间」= 已选过空间后怎么退回未选态的**唯一入口**
									    （模型里 cwd 空串 = 待分配，没有它用户就再也回不来）。
									    只在已选态渲染（对齐 WorkBuddy 的 `selectedOption && (...)`，
									    lib-chat-ui:60851）：未选时它点了也是 no-op，露出来只添噪音。
									    文案沿用 WorkBuddy 的 noWorkspace；副行点明与它的一处差异 ——
									    我们首次执行仍会给一个临时目录，不是「真的没有目录」。
									    副行复用 .ws-item-path（列表项副行样式：--text-meta + --text-secondary），
									    不为一行文字新造类名。 */}
									{hasSelection && (
										<button type="button" className="ws-item" disabled={busy} onClick={() => switchTo("")}>
											<span className="ws-item-name">不使用工作空间</span>
											<span className="ws-item-path">首次执行时自动分配临时目录</span>
											{/* 当前会话若就是任务私有目录（自动分配目录 / 历史共享临时目录），
											    这一项才是「当前」；在命名空间里它只是退路。 */}
											{pickerLabel(cwd) === TEMP_TASK_LABEL && <span className="ws-current">当前</span>}
										</button>
									)}
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

						{error !== undefined && <ErrorState message={error} />}
					</div>
				</>
			)}
		</div>
	);
}
