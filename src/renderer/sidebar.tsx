/**
 * 左侧导航栏，布局对标 WorkBuddy：
 * 品牌行 → 新建任务 → 功能导航 → 任务（临时任务会话）→ 空间（按 cwd 分组）→ 底部状态。
 *
 * 导航项的能力按纵切片计划排期（STATUS.md），未实现的点击统一走 onTodo，
 * 不在此处各写占位逻辑。
 *
 * 两区的分组（临时任务分桶、cwd 归组、组名与排序）全部由 groupSessions
 * 算好传入 —— 组由会话文件派生（磁盘真相），这里只渲染，不重新推导
 * （推导规则集中才能跑纯函数测试，见 session-groups.ts 头注释）。
 */

import { useState } from "react";
import type { SessionSummary } from "@shared/ipc.ts";
import { formatMessageTime } from "@shared/message-time.ts";
import type { SessionGroups, SpaceGroup } from "./session-groups.ts";
import {
	IconAssistant,
	IconAutomation,
	IconChart,
	IconChevronDown,
	IconEdit,
	IconExport,
	IconFolder,
	IconLibrary,
	IconMore,
	IconPlus,
	IconProject,
	IconSettings,
	IconSkill,
	IconTrash,
} from "./icons.tsx";

/** daemon 连接状态，与 App 里的 Link 同构。侧栏底部常驻显示，试用时一眼定位「发不出消息是不是没连上」。 */
export type LinkState =
	| { readonly kind: "connecting" }
	| { readonly kind: "ready" }
	| { readonly kind: "down"; readonly reason: string };

interface SidebarProps {
	readonly link: LinkState;
	/** 两区分组结果（App 用 groupSessions 算好）。取代旧的平铺 taskList。 */
	readonly groups: SessionGroups;
	/**
	 * 正在流式的会话 path（该行显示转圈）。单 daemon 单会话架构下同
	 * 一时刻至多一个 run，所以至多命中一行 —— 不需要集合。
	 */
	readonly streamingPath: string | undefined;
	/**
	 * 未读会话 path 集合（标题前绿点）。渲染进程内存态，重启清零 ——
	 * 持久化未读是规格书明确留后续的事，这里不兜底。
	 */
	readonly unreadPaths: ReadonlySet<string>;
	readonly onNewTask: () => void;
	readonly onResumeTask: (path: string) => void;
	readonly onRenameTask: (path: string, name: string) => void;
	readonly onDeleteTask: (path: string) => void;
	/** 导出会话为单文件 HTML。历史会话的导出隐含「先恢复为当前会话」，由 App 侧处理，这里只透传 path。 */
	readonly onExportTask: (path: string) => void;
	/** 空间组「+」：把工作空间切到该 cwd 并新建任务（setWorkspace 的守卫在 App 侧复用）。 */
	readonly onNewTaskInSpace: (cwd: string) => void;
	/** 仅改显示名（workspaces.json 覆盖），真实目录不动。 */
	readonly onRenameWorkspace: (cwd: string, name: string) => void;
	/** 该 cwd 全部会话移入回收目录（可反悔），目录本身不动。 */
	readonly onRemoveWorkspace: (cwd: string) => void;
	/** 系统文件管理器打开该目录（daemon 侧校验是已知工作空间，防任意路径）。 */
	readonly onRevealWorkspace: (cwd: string) => void;
	readonly onOpenSettings: () => void;
	readonly onOpenDiagnostics: () => void;
	/** 「专家·技能·连接器」是真实页面（技能页已可用），不走 onTodo。 */
	readonly onOpenSkills: () => void;
	readonly onTodo: (feature: string) => void;
}

const NAV_ITEMS = [
	{ icon: IconAssistant, label: "助理" },
	{ icon: IconProject, label: "项目" },
	{ icon: IconSkill, label: "专家·技能·连接器" },
	{ icon: IconAutomation, label: "自动化" },
	{ icon: IconLibrary, label: "资料库" },
	{ icon: IconMore, label: "更多" },
] as const;

/** 任务区默认露出的条数，其余收进「查看更多 (N)」。 */
const TASKS_COLLAPSED_COUNT = 5;

export function Sidebar({
	link,
	groups,
	streamingPath,
	unreadPaths,
	onNewTask,
	onResumeTask,
	onRenameTask,
	onDeleteTask,
	onExportTask,
	onNewTaskInSpace,
	onRenameWorkspace,
	onRemoveWorkspace,
	onRevealWorkspace,
	onOpenSettings,
	onOpenDiagnostics,
	onOpenSkills,
	onTodo,
}: SidebarProps): React.JSX.Element {
	/**
	 * 行内操作态记 path 而不是布尔：同一时刻至多一行处于编辑/确认态，
	 * 开始任一操作即挤掉另一个（单条互斥），也不会出现两行同时开编辑。
	 */
	const [editingPath, setEditingPath] = useState<string | undefined>(undefined);
	const [confirmingPath, setConfirmingPath] = useState<string | undefined>(undefined);
	/** 任务区「查看更多」展开态：会话内存即可，重开侧栏不必记住。 */
	const [tasksExpanded, setTasksExpanded] = useState(false);
	/** 收起的空间组 cwd 集合（默认全展开）。规格书：折叠不做持久化，组少时无意义。 */
	const [collapsedCwds, setCollapsedCwds] = useState<ReadonlySet<string>>(new Set());
	/** 空间组头的三种行内态：⋯ 菜单 / 重命名 / 移除确认。与任务行同款的单条互斥。 */
	const [menuCwd, setMenuCwd] = useState<string | undefined>(undefined);
	const [renamingCwd, setRenamingCwd] = useState<string | undefined>(undefined);
	const [removingCwd, setRemovingCwd] = useState<string | undefined>(undefined);
	/** 任务区/空间区组头折叠：会话内存态，重开侧栏恢复展开。WorkBuddy 同款交互。 */
	const [tasksCollapsed, setTasksCollapsed] = useState(false);
	const [spacesCollapsed, setSpacesCollapsed] = useState(false);

	/**
	 * 会话行渲染：任务区与空间组内共用同一份（标题/meta/当前高亮/hover
	 * 三操作钮/行内编辑态/删除确认态 + 转圈/未读点），写成闭包而不是两份
	 * JSX —— 两处行结构一旦漂移，「同一任务在两区表现不同」就是 bug。
	 */
	const renderTaskRow = (task: SessionSummary): React.JSX.Element => {
		const meta = formatMessageTime(task.modifiedAt, Date.now());
		const rowClass = task.current
			? "task-item task-item-current"
			: "task-item";

		// 删除确认态：不弹系统对话框，行内二次确认（文件实为移入回收目录，可恢复）。
		if (confirmingPath === task.path) {
			return (
				<div key={task.path} className="task-item task-item-confirm">
					<span className="task-confirm-text">确认删除？</span>
					<span className="task-confirm-actions">
						<button
							type="button"
							className="task-confirm-btn task-confirm-yes"
							onClick={() => {
								setConfirmingPath(undefined);
								onDeleteTask(task.path);
							}}
						>
							删除
						</button>
						<button
							type="button"
							className="task-confirm-btn"
							onClick={() => setConfirmingPath(undefined)}
						>
							取消
						</button>
					</span>
				</div>
			);
		}

		// 重命名编辑态：input 顶替标题位置，行点击在编辑态整体失效。
		if (editingPath === task.path) {
			return (
				<div key={task.path} className={rowClass}>
					<div className="task-item-body">
						<input
							className="task-rename-input"
							defaultValue={task.name ?? task.title}
							// 弹出的唯一输入框，自动聚焦即预期（同 workspace-picker）。
							autoFocus
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									const name = e.currentTarget.value.trim();
									setEditingPath(undefined);
									// 空白名视为取消，不发请求。
									if (name !== "") onRenameTask(task.path, name);
								} else if (e.key === "Escape") {
									setEditingPath(undefined);
								}
							}}
						/>
						<span className="task-item-meta">{meta}</span>
					</div>
				</div>
			);
		}

		return (
			<div key={task.path} className={rowClass}>
				<button
					type="button"
					className="task-item-body"
					title={task.title}
					onClick={() => {
						// 顺带收掉其他行可能开着的操作态，恢复后列表语义干净。
						setEditingPath(undefined);
						setConfirmingPath(undefined);
						onResumeTask(task.path);
					}}
				>
					<span className="task-item-title">
						{unreadPaths.has(task.path) && <span className="task-unread-dot" />}
						{/* 转圈只可能出现在当前会话行（单 run 架构事实），但这里不判
							current —— streamingPath 由 App 算好，命中即画。 */}
						{streamingPath === task.path && <span className="task-spinner" />}
						{task.title}
					</span>
					{/* 标题+时间同排：标题左对齐省略，时间右对齐常驻（WorkBuddy 同款紧凑行）。 */}
					<span className="task-item-meta">{meta}</span>
				</button>
				<span className="task-item-ops">
					{/*
						历史会话的导出会让 daemon 先恢复该会话（当前上下文被切走），
						这个语义必须在 tooltip 上可见，否则用户不知道点完对话就换了。
						编辑态/删除确认态下整行被替换，本钮自然不响应（与行点击的互斥一致）。
					*/}
					<button
						type="button"
						className="task-op-btn"
						aria-label="导出"
						title={task.current ? "导出为 HTML" : "恢复此会话并导出 HTML"}
						onClick={() => {
							// 顺带收掉其他行开着的操作态：导出后列表会刷新，残留态语义脏。
							setEditingPath(undefined);
							setConfirmingPath(undefined);
							onExportTask(task.path);
						}}
					>
						<IconExport size={13} />
					</button>
					<button
						type="button"
						className="task-op-btn"
						aria-label="重命名"
						title="重命名"
						onClick={() => {
							setConfirmingPath(undefined);
							setEditingPath(task.path);
						}}
					>
						<IconEdit size={13} />
					</button>
					<button
						type="button"
						className="task-op-btn"
						aria-label="删除"
						title="删除"
						onClick={() => {
							setEditingPath(undefined);
							setConfirmingPath(task.path);
						}}
					>
						<IconTrash size={13} />
					</button>
				</span>
			</div>
		);
	};

	/** 空间组渲染：组头（折叠/名称/计数/+/⋯）+ 组内任务行（复用 renderTaskRow）。 */
	const renderSpaceGroup = (group: SpaceGroup): React.JSX.Element => {
		const collapsed = collapsedCwds.has(group.cwd);

		// 移除确认态：整组（组头+组体）换成行内确认，与任务删除同款 ——
		// 会话文件实为移入回收目录可恢复，弹系统对话框反而显得不可逆。
		if (removingCwd === group.cwd) {
			return (
				<div key={group.cwd} className="space-group">
					<div className="task-item-confirm space-group-confirm">
						<span className="task-confirm-text">移除后该空间任务将移入回收站</span>
						<span className="task-confirm-actions">
							<button
								type="button"
								className="task-confirm-btn task-confirm-yes"
								onClick={() => {
									setRemovingCwd(undefined);
									onRemoveWorkspace(group.cwd);
								}}
							>
								移除
							</button>
							<button
								type="button"
								className="task-confirm-btn"
								onClick={() => setRemovingCwd(undefined)}
							>
								取消
							</button>
						</span>
					</div>
				</div>
			);
		}

		// 重命名编辑态：input 顶替组头（仅显示名覆盖，不动真实目录）。复用任务重命名的样式与按键约定。
		if (renamingCwd === group.cwd) {
			return (
				<div key={group.cwd} className="space-group">
					<div className="space-group-header space-group-editing">
						<input
							className="task-rename-input"
							defaultValue={group.name}
							autoFocus
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									const name = e.currentTarget.value.trim();
									setRenamingCwd(undefined);
									// 空白名视为取消，不发请求（与任务重命名一致）。
									if (name !== "") onRenameWorkspace(group.cwd, name);
								} else if (e.key === "Escape") {
									setRenamingCwd(undefined);
								}
							}}
						/>
					</div>
				</div>
			);
		}

		return (
			<div
				key={group.cwd}
				className={collapsed ? "space-group space-group-collapsed" : "space-group"}
			>
				<div className="space-group-header">
					{/* 组名可能被显示名覆盖，悬停给出真实 cwd 以便辨认是哪个目录。 */}
					<button
						type="button"
						className="space-group-header-main"
						title={group.cwd}
						aria-expanded={!collapsed}
						onClick={() => {
							setCollapsedCwds((prev) => {
								const next = new Set(prev);
								if (next.has(group.cwd)) next.delete(group.cwd);
								else next.add(group.cwd);
								return next;
							});
						}}
					>
						<IconFolder size={12} className="space-group-icon" />
					<IconChevronDown size={12} className="space-group-chevron" />
					<span className="space-group-name">{group.name}</span>
				</button>
					<span className="space-group-actions">
						<button
							type="button"
							className="task-op-btn"
							aria-label="在该空间新建任务"
							title="在该空间新建任务"
							onClick={() => onNewTaskInSpace(group.cwd)}
						>
							<IconPlus size={13} />
						</button>
						<button
							type="button"
							className="task-op-btn"
							aria-label="更多"
							title="更多"
							onClick={() =>
								setMenuCwd((prev) => (prev === group.cwd ? undefined : group.cwd))
							}
						>
							<IconMore size={13} />
						</button>
					</span>
					{/* ⋯ 弹层：permission-menu 同款模式（透明 backdrop 点外关闭 + 绝对定位卡片）。 */}
					{menuCwd === group.cwd && (
						<>
							<button
								type="button"
								className="ws-backdrop"
								aria-label="关闭"
								onClick={() => setMenuCwd(undefined)}
							/>
							<div className="pop-menu space-menu">
								<button
									type="button"
									className="space-menu-item"
									onClick={() => {
										setMenuCwd(undefined);
										onRevealWorkspace(group.cwd);
									}}
								>
									打开文件夹
								</button>
								<button
									type="button"
									className="space-menu-item"
									onClick={() => {
										setMenuCwd(undefined);
										setRemovingCwd(undefined);
										setRenamingCwd(group.cwd);
									}}
								>
									重命名
								</button>
								<button
									type="button"
									className="space-menu-item space-menu-danger"
									onClick={() => {
										setMenuCwd(undefined);
										setRenamingCwd(undefined);
										setRemovingCwd(group.cwd);
									}}
								>
									从列表移除
								</button>
							</div>
						</>
					)}
				</div>
				{!collapsed && group.sessions.map(renderTaskRow)}
			</div>
		);
	};

	const visibleTasks = tasksExpanded
		? groups.tasks
		: groups.tasks.slice(0, TASKS_COLLAPSED_COUNT);
	const hiddenTaskCount = groups.tasks.length - visibleTasks.length;

	return (
		<aside className="sidebar">
			<div className="sidebar-brand">
				<span className="brand-name">KamiBuddy</span>
				<span className="brand-version">V0.1.0</span>
			</div>

			<button type="button" className="new-task" onClick={onNewTask}>
				<IconPlus size={15} />
				新建任务
			</button>

			<nav className="sidebar-nav">
				{NAV_ITEMS.map(({ icon: Icon, label }) => (
					<button
						key={label}
						type="button"
						className="nav-item"
						onClick={() => (label === "专家·技能·连接器" ? onOpenSkills() : onTodo(label))}
					>
						<Icon size={16} />
						{label}
					</button>
				))}
				{/* 诊断是真能用的入口（用量、缓存命中率、工具时间线），不走 onTodo。 */}
				<button type="button" className="nav-item" onClick={onOpenDiagnostics}>
					<IconChart size={16} />
					诊断
				</button>
			</nav>

			{/* 任务+空间滚动区：导航项固定不动，只有这个容器滚动（WorkBuddy 同款）。 */}
			<div className="sidebar-scroll">
				<div className="sidebar-section">
					<button
						type="button"
						className="section-title section-title-btn"
						aria-expanded={!tasksCollapsed}
						onClick={() => setTasksCollapsed((prev) => !prev)}
					>
						<IconChevronDown size={12} className={tasksCollapsed ? "section-chevron section-chevron-collapsed" : "section-chevron"} />
						任务 ({groups.tasks.length})
					</button>
					{!tasksCollapsed && (groups.tasks.length === 0 ? (
						<p className="section-empty">暂无历史任务</p>
					) : (
						<div className="task-list">
							{visibleTasks.map(renderTaskRow)}
							{hiddenTaskCount > 0 && (
								<button
									type="button"
									className="task-list-more"
									onClick={() => setTasksExpanded(true)}
								>
									查看更多 ({hiddenTaskCount})
								</button>
							)}
						</div>
					))}
				</div>

				<div className="sidebar-section">
					<button
						type="button"
						className="section-title section-title-btn"
						aria-expanded={!spacesCollapsed}
						onClick={() => setSpacesCollapsed((prev) => !prev)}
					>
						<IconChevronDown size={12} className={spacesCollapsed ? "section-chevron section-chevron-collapsed" : "section-chevron"} />
						空间 ({groups.spaces.length})
					</button>
					{/* 组由会话派生：没有会话的目录不形成组，所以这里不需要空态文案。 */}
					{!spacesCollapsed && groups.spaces.map(renderSpaceGroup)}
				</div>
			</div>

			<div className="sidebar-footer">
				<span className={`link-dot link-dot-${link.kind}`} />
				<span className="footer-text">
					{link.kind === "connecting" && "正在启动…"}
					{link.kind === "ready" && "引擎已就绪"}
					{link.kind === "down" && `已断开：${link.reason}`}
				</span>
				{/* 设置是真能用的入口，不走 onTodo。放在底部与 WorkBuddy 的位置一致。 */}
				<button
					type="button"
					className="footer-btn"
					aria-label="设置"
					title="设置"
					onClick={onOpenSettings}
				>
					<IconSettings size={15} />
				</button>
			</div>
		</aside>
	);
}
