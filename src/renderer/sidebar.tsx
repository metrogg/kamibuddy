/**
 * 左侧导航栏，布局对标 WorkBuddy：
 * 品牌行 → 新建任务 → 功能导航 → 任务历史 → 空间 → 底部状态。
 *
 * 导航项的能力按纵切片计划排期（STATUS.md），未实现的点击统一走 onTodo，
 * 不在此处各写占位逻辑。
 */

import { useState } from "react";
import type { SessionSummary } from "@shared/ipc.ts";
import { formatMessageTime } from "@shared/message-time.ts";
import {
	IconAssistant,
	IconAutomation,
	IconChart,
	IconEdit,
	IconExport,
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
	/** 历史会话列表（title/isPlayground/current 由 daemon 组装好，这里只展示）。 */
	readonly taskList: readonly SessionSummary[];
	readonly onNewTask: () => void;
	readonly onResumeTask: (path: string) => void;
	readonly onRenameTask: (path: string, name: string) => void;
	readonly onDeleteTask: (path: string) => void;
	/** 导出会话为单文件 HTML。历史会话的导出隐含「先恢复为当前会话」，由 App 侧处理，这里只透传 path。 */
	readonly onExportTask: (path: string) => void;
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

/** 空间标识取 cwd 末段（Windows 反斜杠与 POSIX 斜杠都认）。与 workspace-picker 的 baseName 同款。 */
function cwdTail(cwd: string): string {
	const trimmed = cwd.replace(/[\\/]+$/, "");
	const at = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
	return at === -1 ? trimmed : trimmed.slice(at + 1);
}

export function Sidebar({
	link,
	taskList,
	onNewTask,
	onResumeTask,
	onRenameTask,
	onDeleteTask,
	onExportTask,
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

			<div className="sidebar-section">
				<div className="section-title">任务</div>
				{taskList.length === 0 ? (
					<p className="section-empty">暂无历史任务</p>
				) : (
					<div className="task-list">
						{taskList.map((task) => {
							const meta = `${formatMessageTime(task.modifiedAt, Date.now())} · ${
								task.isPlayground ? "不使用工作空间" : cwdTail(task.cwd)
							}`;
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
										<span className="task-item-title">{task.title}</span>
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
						})}
					</div>
				)}
			</div>

			<div className="sidebar-section">
				<button
					type="button"
					className="section-title section-title-btn"
					onClick={() => onTodo("空间")}
				>
					空间
				</button>
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
