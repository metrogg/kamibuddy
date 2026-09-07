/**
 * 左侧导航栏，布局对标 WorkBuddy：
 * 品牌行 → 新建任务 → 功能导航 → 任务历史 → 空间 → 底部状态。
 *
 * 导航项的能力按纵切片计划排期（STATUS.md），未实现的点击统一走 onTodo，
 * 不在此处各写占位逻辑。
 */

import {
	IconAssistant,
	IconAutomation,
	IconChart,
	IconLibrary,
	IconMore,
	IconPlus,
	IconProject,
	IconSettings,
	IconSkill,
} from "./icons.tsx";

/** daemon 连接状态，与 App 里的 Link 同构。侧栏底部常驻显示，试用时一眼定位「发不出消息是不是没连上」。 */
export type LinkState =
	| { readonly kind: "connecting" }
	| { readonly kind: "ready" }
	| { readonly kind: "down"; readonly reason: string };

interface SidebarProps {
	readonly link: LinkState;
	/** 当前会话的首条用户消息，作为任务历史里的唯一一条（历史持久化是后排期的能力）。 */
	readonly currentTaskTitle: string | undefined;
	readonly onNewTask: () => void;
	readonly onOpenTask: () => void;
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

export function Sidebar({
	link,
	currentTaskTitle,
	onNewTask,
	onOpenTask,
	onOpenSettings,
	onOpenDiagnostics,
	onOpenSkills,
	onTodo,
}: SidebarProps): React.JSX.Element {
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
				{currentTaskTitle === undefined ? (
					<p className="section-empty">暂无历史任务</p>
				) : (
					<button
						type="button"
						className="task-item"
						onClick={onOpenTask}
						title={currentTaskTitle}
					>
						{currentTaskTitle}
					</button>
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
