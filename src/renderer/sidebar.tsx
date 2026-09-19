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

import { useEffect, useState } from "react";
import type { SessionSummary } from "@shared/ipc.ts";
import { formatMessageTime } from "@shared/message-time.ts";
import type { SessionGroups, SpaceGroup } from "./session-groups.ts";
import { resolveSessionOrigin, sessionRowTitle } from "./session-origin.ts";
import { BUDDY_LOGO } from "./buddy-logo.ts";
import {
	IconAssistant,
	IconAutomation,
	IconBranch,
	IconChart,
	IconChevronDown,
	IconFolder,
	IconLibrary,
	IconMore,
	IconPlus,
	IconProject,
	IconSettings,
	IconSkill,
	IconStats,
} from "./icons.tsx";
import { EmptyState, ErrorState, LoadingState, Skeleton, Spinner } from "./state-views.tsx";

/** daemon 连接状态，与 App 里的 Link 同构。侧栏底部常驻显示，试用时一眼定位「发不出消息是不是没连上」。 */
export type LinkState =
	| { readonly kind: "connecting" }
	| { readonly kind: "ready" }
	| { readonly kind: "down"; readonly reason: string };

interface SidebarProps {
	readonly link: LinkState;
	/**
	 * 两区分组结果（App 用 groupSessions 算好）。取代旧的平铺 taskList。
	 * undefined = 会话列表还没拉到（在途），与「拉到了但一个都没有」分开。
	 */
	readonly groups: SessionGroups | undefined;
	/** 会话列表拉取失败的原因（undefined = 没失败）。失败 ≠ 没有历史任务。 */
	readonly tasksError: string | undefined;
	/** 任务区错误态的「重试」：App 侧可重复调用的 listSessions 拉取函数。 */
	readonly onReloadTasks: () => void;
	/**
	 * 未读会话 id 集合（标题前绿点）。渲染进程内存态，重启清零 ——
	 * 持久化未读是规格书明确留后续的事，这里不兜底。
	 */
	readonly unreadIds: ReadonlySet<string>;
	/**
	 * 有阻塞式请求（权限审批或问卷）在等用户应答的会话 id 集合，
	 * badge 画在请求归属的会话行上 —— 可同时多行（多任务并发）。
	 * 由 App 用两条本地请求队列的 sessionId 合成（daemon 不推送
	 * pending 计数）；空串请求（子代理审批的全局闸）不属于任何行，
	 * 不进集合 —— 口径说明见 App 里 pendingConfirmIds 的注释。
	 */
	readonly pendingConfirmIds: ReadonlySet<string>;
	readonly onNewTask: () => void;
	readonly onResumeTask: (path: string) => void;
	readonly onRenameTask: (path: string, name: string) => void;
	readonly onDeleteTask: (path: string) => void;
	/** 归档（L28）：写 archive.json 索引，行从侧栏主列表消失（数据管理分组可恢复）。 */
	readonly onArchiveTask: (path: string) => void;
	/** 导出会话为单文件 HTML。历史会话的导出隐含「先恢复为当前会话」，由 App 侧处理，这里只透传 path。 */
	readonly onExportTask: (path: string) => void;
	/** 空间组「+」：把工作空间切到该 cwd 并新建任务（setWorkspace 的守卫在 App 侧复用）。 */
	readonly onNewTaskInSpace: (cwd: string) => void;
	/** 仅改显示名（workspaces.json 覆盖），真实目录不动。 */
	readonly onRenameWorkspace: (cwd: string, name: string) => void;
	/** 该 cwd 全部会话移入回收目录（可反悔），目录本身不动。 */
	readonly onRemoveWorkspace: (cwd: string) => void;
	/**
	 * 系统文件管理器打开该目录。空间组与任务行共用同一条通道（不自建第二个 IPC）：
	 * 任务未选工作空间时 cwd 是它的自动目录（时间戳），没有这个入口用户找不到产物。
	 * daemon 侧只接受已知目录（工作空间或会话 cwd），防任意路径。
	 */
	readonly onRevealWorkspace: (cwd: string) => void;
	readonly onOpenSettings: () => void;
	readonly onOpenDiagnostics: () => void;
	/** 统计页（跨会话使用统计）。与诊断页分开：那边是「本次运行」，这里是「这段时间」。 */
	readonly onOpenStats: () => void;
	/** 「专家·技能·连接器」是真实页面（技能页已可用），不走 onTodo。 */
	readonly onOpenSkills: () => void;
	/** 「自动化」是真实页面（定时任务管理页），不走 onTodo。 */
	readonly onOpenAutomations: () => void;
	readonly onTodo: (feature: string) => void;
}

const NAV_ITEMS = [
	{ icon: IconAssistant, label: "助理", ready: false },
	{ icon: IconProject, label: "项目", ready: false },
	{ icon: IconSkill, label: "专家·技能·连接器", ready: true },
	{ icon: IconAutomation, label: "自动化", ready: true },
	{ icon: IconLibrary, label: "资料库", ready: false },
	{ icon: IconMore, label: "更多", ready: false },
] as const;

/** 任务区默认露出的条数，其余收进「查看更多 (N)」。 */
const TASKS_COLLAPSED_COUNT = 5;

/**
 * 任务区骨架的标题条宽度（%，相对 `.task-item-title`）。宽窄错落才像真列表，等宽像表格。
 * 条数取 TASKS_COLLAPSED_COUNT：与真实列表默认露出的条数一致，列表到达时整区高度不变。
 */
const TASK_SKELETON_WIDTHS = ["72%", "54%", "84%", "46%", "63%"];

/**
 * 骨架行里标题位的排版。`.task-item-title` 平时装一行文字，换成骨架条后需要补两件事：
 *  1. `display:flex + align-items:center`：条要落在行盒中间。真行的文字在 20.8px 行盒里
 *     居中，条贴顶的话视觉上会整体偏高 4px；
 *  2. `min-height: 1lh`：把这一格撑到与真实行相同的行盒高度。`1lh` = 该元素自身的行高
 *     = 13px（`.task-item` 给的 `--text-list`）× 1.6（body 的 line-height）= 20.8px。
 *     用 `1lh` 而不是手抄 20.8px：行高将来改了，骨架跟着走，不会悄悄错位。
 * 于是骨架行高 = 20.8 + `.task-item-body` 的上下 padding（--space-1 × 2 = 8px）= 28.8px，
 * 与真实行逐像素相同（这正是骨架屏「同尺寸」的落点）。
 */
const TASK_SKELETON_TITLE_STYLE: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	minHeight: "1lh",
};

export function Sidebar({
	link,
	groups,
	tasksError,
	onReloadTasks,
	unreadIds,
	pendingConfirmIds,
	onNewTask,
	onResumeTask,
	onRenameTask,
	onDeleteTask,
	onArchiveTask,
	onExportTask,
	onNewTaskInSpace,
	onRenameWorkspace,
	onRemoveWorkspace,
	onRevealWorkspace,
	onOpenSettings,
	onOpenDiagnostics,
	onOpenStats,
	onOpenSkills,
	onOpenAutomations,
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
	/** 任务行的 ⋯ 菜单（同样记 path，同时至多一个开着）。 */
	const [menuPath, setMenuPath] = useState<string | undefined>(undefined);
	const [renamingCwd, setRenamingCwd] = useState<string | undefined>(undefined);
	const [removingCwd, setRemovingCwd] = useState<string | undefined>(undefined);
	/** 任务区/空间区组头折叠：会话内存态，重开侧栏恢复展开。WorkBuddy 同款交互。 */
	const [tasksCollapsed, setTasksCollapsed] = useState(false);
	const [spacesCollapsed, setSpacesCollapsed] = useState(false);

	// 行内 ⋯ 菜单（空间组头 / 任务行）的 Esc 关闭。这些菜单只有透明 backdrop（管指针）：
	// 纯键盘用户展开后既点不到 backdrop，也没有别的退出方式。同 model-menu /
	// permission-menu 的既有写法（effect 依赖两个菜单态，都没有弹层时不挂监听）。
	useEffect(() => {
		if (menuCwd === undefined && menuPath === undefined) return;
		const onKey = (event: KeyboardEvent): void => {
			if (event.key !== "Escape") return;
			setMenuCwd(undefined);
			setMenuPath(undefined);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [menuCwd, menuPath]);

	/**
	 * 分支来源解析用的可见会话全集。groups 是会话列表的完整划分
	 * （groupSessions 只按 isTempTask / cwd 分桶，不丢条目），两区并集即
	 * 「当前侧栏可见的会话」—— 归档会话已在 App 分组前滤掉，故母会话被归档
	 * 也自然落进「来源不在列表」。
	 * 渲染时算一份即可（不是每行各拼一遍数组）：侧栏行数少，线性查找够用，
	 * 不值得为此引入 path→标题 的索引。
	 */
	const allSessions: readonly SessionSummary[] =
		groups === undefined
			? []
			: [...groups.tasks, ...groups.spaces.flatMap((group) => group.sessions)];

	/**
	 * 会话行渲染：任务区与空间组内共用同一份（标题/meta/当前高亮/hover
	 * 三操作钮/行内编辑态/删除确认态 + 转圈/未读点），写成闭包而不是两份
	 * JSX —— 两处行结构一旦漂移，「同一任务在两区表现不同」就是 bug。
	 */
	const renderTaskRow = (task: SessionSummary): React.JSX.Element => {
		const meta = formatMessageTime(task.modifiedAt, Date.now());
		/** undefined = 非分支会话；有值则本行要画来源标记（title 可能解析不到）。 */
		const origin = resolveSessionOrigin(allSessions, task);
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
							/* 行内编辑框没有可见标签（标题位置被它顶替），补一个不可见的可访问名：
							   否则屏幕阅读器只读出「编辑框」，不知道在改什么。 */
							aria-label="重命名会话"
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
					// 分支行在标题下多一行来源会话标题（session-origin.ts 决定文案）；
					// 非分支行就是原标题，不额外加字。
					title={sessionRowTitle(task, origin)}
					onClick={() => {
						// 顺带收掉其他行可能开着的操作态，恢复后列表语义干净。
						setEditingPath(undefined);
						setConfirmingPath(undefined);
						onResumeTask(task.path);
					}}
				>
					<span className="task-item-title">
						{unreadIds.has(task.id) && <span className="task-unread-dot" />}
						{/* 运行中转圈以 SessionSummary.running 为准（daemon 权威，随
						taskListChanged 推送更新）：多任务并发后同时可有多行在跑，
						旧的「本地 streaming && 当前行」推导只看得见当前会话，已废。 */}
						{task.running && <Spinner size={11} />}
						{/*
							分支标记：parentSession 有值才出现（daemon 写死在会话文件 header）。
							图标本套已 aria-hidden（icons.tsx 统一），分支身份在可访问名里由
							标题后缀「· 分支」承担，故这里不再补隐藏文字。
							来源标题走上面的行 title：标记只有 12px，来源信息要能在整行 hover 读到。
							刻意不做「点标记跳到母会话」——母会话可能已删除，跳转入口必须按来源
							实际在不在列表决定，本任务（只做标记）不给这条交互。
						*/}
						{origin !== undefined && (
							<span className="task-branch-mark">
								<IconBranch size={12} />
							</span>
						)}
						{task.title}
					</span>
					{/* 「待确认」压在时间之前（flex:none，与 meta 同排常驻可见）；
				    标题侧的圆点/转圈那套 inline 指示放不下文字徽章。
				    按请求归属会话画行（可同时多行），不再只挂当前行。 */}
					{pendingConfirmIds.has(task.id) && (
						<span className="task-confirm-badge">待确认</span>
					)}
					{/* 标题+时间同排：标题左对齐省略，时间右对齐常驻（WorkBuddy 同款紧凑行）。 */}
					<span className="task-item-meta">{meta}</span>
				</button>
				{/*
					行内操作 = **一个「⋯」入口 + 菜单**，不是一排图标按钮。
					此前这里并排四个 20px 图标（打开文件夹 / 导出 / 重命名 / 删除，gap 2px）：
					窄栏里挤成一团、glyph 之间只隔 2px 看着像叠在一起，而且整簇
					压在右侧时间戳那一格上。WorkBuddy 的做法是行尾只留一个「⋯」，动作全收进菜单
					（其菜单：打开文件夹 / 重命名 / 分享任务 / 删除任务）。
					「保存到工作空间」对我们不适用（2026-09-17 起该功能已删）。
					菜单卡片与条目复用空间组头那一套（.pop-menu + .space-menu-item），
					只多一条 .task-op-menu 的锚点定位。
				*/}
				<span className="task-item-ops">
					<button
						type="button"
						className="task-op-btn"
						aria-label="更多操作"
						aria-expanded={menuPath === task.path}
						title="更多操作"
						onClick={() => {
							// 与行点击同口径：开菜单即收掉本行/其他行的编辑与删除确认态。
							setEditingPath(undefined);
							setConfirmingPath(undefined);
							setMenuPath((prev) => (prev === task.path ? undefined : task.path));
						}}
					>
						<IconMore size={15} />
					</button>
				</span>
				{menuPath === task.path && (
					<>
						{/* 透明 backdrop 管点外关闭（同空间组头的 ⋯）；Esc 另有全局监听。 */}
						<button
							type="button"
							className="ws-backdrop"
							aria-label="关闭"
							onClick={() => setMenuPath(undefined)}
						/>
						<div className="pop-menu space-menu task-op-menu">
							{/*
								打开该任务的工作目录。未选工作空间的任务 cwd 是它的自动目录
								（时间戳命名），用户只能靠这个入口在文件系统里找到产物。
								空 cwd 是历史 playground 会话（没有真实目录），此时不渲染 ——
								留个点了没反应的动作更差。复用空间组同一条 onRevealWorkspace 通道。
							*/}
							{task.cwd !== "" && (
								<button
									type="button"
									className="space-menu-item"
									onClick={() => {
										setMenuPath(undefined);
										setEditingPath(undefined);
										setConfirmingPath(undefined);
										onRevealWorkspace(task.cwd);
									}}
								>
									打开文件夹
								</button>
							)}
							{/*
								历史会话的导出会让 daemon 先恢复该会话（当前上下文被切走），
								这个语义必须在 tooltip 上可见，否则用户不知道点完对话就换了。
								编辑态/删除确认态下整行被替换，本项自然不响应（与行点击的互斥一致）。
							*/}
							<button
								type="button"
								className="space-menu-item"
								title={task.current ? "导出为 HTML" : "恢复此会话并导出 HTML"}
								onClick={() => {
									// 顺带收掉其他行开着的操作态：导出后列表会刷新，残留态语义脏。
									setMenuPath(undefined);
									setEditingPath(undefined);
									setConfirmingPath(undefined);
									onExportTask(task.path);
								}}
							>
								导出
							</button>
							<button
								type="button"
								className="space-menu-item"
								onClick={() => {
									setMenuPath(undefined);
									setConfirmingPath(undefined);
									setEditingPath(task.path);
								}}
							>
								重命名
							</button>
							{/*
								归档（L28）：会话文件与宿主都不动，只从侧栏主列表收起 ——
								与删除（危险红、行内确认）刻意拉开：这是整理动作不是销毁。
								恢复入口在设置页数据管理分组。
							*/}
							<button
								type="button"
								className="space-menu-item"
								onClick={() => {
									setMenuPath(undefined);
									setEditingPath(undefined);
									setConfirmingPath(undefined);
									onArchiveTask(task.path);
								}}
							>
								归档
							</button>
							<button
								type="button"
								className="space-menu-item space-menu-danger"
								onClick={() => {
									setMenuPath(undefined);
									setEditingPath(undefined);
									setConfirmingPath(task.path);
								}}
							>
								删除
							</button>
						</div>
					</>
				)}
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
							/* 同任务重命名：行内编辑取代了组名，补可访问名。 */
							aria-label="重命名空间"
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

	/**
	 * 任务区数据源 = 分组结果里有没有「任务」这一份数据。
	 *
	 * 口径（Task 1.3）：**「在途」只由数据本身表达**（groups === undefined，
	 * 即 App 侧会话列表还没落地），不再看 link。原来写的是
	 * `link.kind === "connecting" ? undefined : groups.tasks`，只在 daemon 尚未
	 * 就绪时算加载中 —— 而 App 是先置 ready 再拉列表，「ready 之后、列表回来
	 * 之前」这段窗口被判成空列表，于是闪/停在「暂无历史任务」（本期要修的残留）。
	 * 既然未就绪已由 undefined 表达，这个 link 判断就是多余的第二个真相源，
	 * 去掉可少一处两者可能漂移的地方。
	 *
	 * 断开（link=down）时列表若已有值仍然照常展示：数据没了才算没数据，
	 * 断开本身由底部状态行如实说明（不拿转圈把用户还能看的历史清掉）。
	 */
	const tasks = groups?.tasks;
	const spaces = groups?.spaces ?? [];
	/**
	 * 两个区共用的「数据来不了」判据（与「还在路上」区分）。
	 *
	 * `groups === undefined` 有两种成因，都会让任务区永远转圈：
	 *  1. `tasksError` —— 首拉失败，原因由 App 记录；
	 *  2. `link.kind === "down"` —— 连接已断且列表从未落地。daemon 启动即失败时，
	 *     App 的 `activate()` 挂在 `onDaemonReady` 上压根没跑，`listSessions()`
	 *     永远不会返回 —— 旧行为是永久「正在读取…」（与旧版永久「暂无历史任务」
	 *     同类的误导）。
	 *
	 * 两者都在任务区就地呈现一次（断开态与失败态同一个重试入口）；空间区是同一份
	 * groups 的派生，不重复第二张错误卡 —— 窄栏里叠两个重试按钮只是噪音。
	 */
	const groupsUnavailable = tasksError !== undefined || link.kind === "down";
	const visibleTasks = tasksExpanded
		? (tasks ?? [])
		: (tasks ?? []).slice(0, TASKS_COLLAPSED_COUNT);
	const hiddenTaskCount = tasks === undefined ? 0 : tasks.length - visibleTasks.length;

	return (
		<aside className="sidebar">
			<div className="sidebar-brand">
				<span className="brand-name">嘉立创Work</span>
				<span className="brand-version">V0.1.0</span>
			</div>

			<button type="button" className="new-task" onClick={onNewTask}>
				<IconPlus size={15} />
				新建任务
			</button>

			<nav className="sidebar-nav">
				{NAV_ITEMS.map(({ icon: Icon, label, ready }) => (
					<button
						key={label}
						type="button"
						// 未实现项降灰 + 提示：占位展示≠可用，视觉要诚实（点击仍走 onTodo toast）。
						className={ready ? "nav-item" : "nav-item nav-item-pending"}
						title={ready ? undefined : "随版本迭代开放"}
						onClick={() => {
							// ready 是点击分发的唯一事实源：点亮走真实入口，其余统一「待做」。
							if (!ready) onTodo(label);
							else if (label === "专家·技能·连接器") onOpenSkills();
							else if (label === "自动化") onOpenAutomations();
						}}
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
				{/* 统计页（跨会话使用统计，spec: add-usage-stats）。 */}
				<button type="button" className="nav-item" onClick={onOpenStats}>
					<IconStats size={16} />
					统计
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
						{/* 计数只在列表落地后显示：在途时 `(0)` 是「暂无历史任务」的同类误报，
						    只是藏进了标题（用户读成「一条都没有」）。 */}
						{tasks === undefined ? "任务" : `任务 (${tasks.length})`}
					</button>
					{/* 四态互斥（DESIGN.md §4）：失败 → 就地错误卡 + 重试（不再静默吞掉，
					    也不再落到「暂无历史任务」）；连接已断且列表从未落地 → 同一错误卡
					    （否则会永久停在「正在读取…」）；未就绪 → 加载态；拿到了且为空 → 空态。 */}
					{!tasksCollapsed && (tasksError !== undefined ? (
						<ErrorState message={tasksError} onRetry={onReloadTasks} />
					) : tasks === undefined && groupsUnavailable ? (
						/* 断开原因（含 daemon 退出码）已在底部状态行如实显示，这里只给短结论：
						    窄栏里再抄一遍长文本没有信息增量。重试会拿到 daemon 的真实报错
						    （连接没恢复时立即失败），也是恢复后唯一的重新拉取入口。 */
						<ErrorState message="连接已断开，未能读取历史任务" onRetry={onReloadTasks} />
					) : tasks === undefined ? (
						/* 结构已知的等待用骨架（DESIGN.md §4「加载」一列）。行结构与真行同一批
						   类名、同尺寸（见 TASK_SKELETON_*），所以列表到达时是「同一片区域被填上」，
						   而不是整块内容被换掉。role="status" 承担骨架条自身 aria-hidden 掉的
						   「在读取」语义（此前由 LoadingState 的「正在读取…」文字承担）。 */
						<div className="task-list" role="status" aria-label="正在读取历史任务">
							{TASK_SKELETON_WIDTHS.map((width) => (
								<div key={width} className="task-item">
									<div className="task-item-body">
										<span className="task-item-title" style={TASK_SKELETON_TITLE_STYLE}>
											<Skeleton width={width} />
										</span>
										<span className="task-item-meta">
											<Skeleton width={26} />
										</span>
									</div>
								</div>
							))}
						</div>
					) : tasks.length === 0 ? (
						<EmptyState title="暂无历史任务" />
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
						{/* 与任务区同口径：未就绪时 `(0)` 是误报（空间组还没算出来）。 */}
						{groups === undefined ? "空间" : `空间 (${spaces.length})`}
					</button>
					{/* 组由会话派生：没有会话的目录不形成组 —— 空集合并不等于「没有工作空间」
					    （用户可能已选过目录、只是还没在里面跑过任务），照写空态文案会给出
					    错误结论，故这里只补「在途」的行内加载位；失败/断开不在这里重复
					    第二张错误卡，见 groupsUnavailable 的注释。 */}
					{!spacesCollapsed &&
						(groups !== undefined ? (
							spaces.map(renderSpaceGroup)
						) : groupsUnavailable ? null : (
							<LoadingState text="正在读取空间…" />
						))}
				</div>
			</div>

			<div className="sidebar-footer">
				{/* 品牌徽标：纯装饰的视觉锚点（对标 WorkBuddy 侧栏底部的彩色标识），
				    不挂交互——点它没有对应动作，做成按钮反而骗点击。
				    2026-09-19 由内置的 SVG 徽标（原 IconBrand）换成应用 logo，
				    与回合头的 agent 头像同一张图（buddy-logo.ts）。 */}
				<img className="footer-brand" src={BUDDY_LOGO} width={22} height={22} alt="" />
				<span className={`link-dot link-dot-${link.kind}`} />
				<span className="footer-text">
					{link.kind === "connecting" && "正在启动…"}
					{/* 「引擎」是系统构造视角，不搬给用户。 */}
					{link.kind === "ready" && "已就绪"}
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
