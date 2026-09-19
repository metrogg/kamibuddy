/**
 * 设置：模态卡容器 + 左 nav 路由（spec: rework-settings-layout Task 2）。
 *
 * WorkBuddy 口径：居中 ~880px 模态卡（背板点击 / Esc / 右上 X 关闭），
 * 左 nav 分组，右内容面板独立滚动。分区实现全部在同级 per-section 文件里，
 * 本文件只管 nav 状态、关闭交互和快照装载。
 *
 * 本页只 import @shared（AGENTS.md §1.3），一个 pi 概念都不认识。
 */

import { useCallback, useEffect, useState } from "react";
import type { SettingsSnapshot } from "@shared/settings.ts";
import { IconClose } from "../icons.tsx";
import { ErrorState, LoadingState } from "../state-views.tsx";
import { useModalFocus } from "../use-modal-focus.ts";
import { GeneralSection } from "./general-section.tsx";
import { PersonalizationSection } from "./personalization-section.tsx";
import { MemoryEvolutionSection } from "./memory-section.tsx";
import { ModelsSection } from "./models-section.tsx";
import { RuntimesSection } from "./runtimes-section.tsx";
import { DataManagementSection } from "./data-management-section.tsx";
import { AuditSection } from "./audit-section.tsx";
import { PromptPreviewSection } from "./prompt-section.tsx";
import { AboutSection } from "./about-section.tsx";

/* nav 项少，不设 WB 那样的分组标题行（「功能」「数据与安全」），直接平列。 */
const NAV_ITEMS = [
	{ id: "general", label: "通用" },
	{ id: "personalization", label: "个性化" },
	{ id: "memory", label: "记忆与进化" },
	{ id: "models", label: "模型" },
	{ id: "runtimes", label: "内置运行时" },
	{ id: "data", label: "数据管理" },
	{ id: "audit", label: "审计中心" },
	{ id: "prompt", label: "提示词预览" },
	{ id: "about", label: "关于" },
] as const;

type SettingsPage = (typeof NAV_ITEMS)[number]["id"];

/** 供深链使用（首页引导条的「去配置模型」要指名 "models"）。 */
export type { SettingsPage };

/**
 * 页 id 白名单判定。给**外部入口**兜底（App 的 `openSettings`）。
 *
 * 存在的理由是一次真实事故（2026-09-19 用户报「打开设置是空白的」）：
 * `openSettings` 的形参是可选的 `page`，而 `(page?: SettingsPage) => void` 在 TS 里
 * **可以赋值给** `() => void` —— 类型系统放行，于是它被当作 `onClick` 直接传给了
 * 侧栏底部的设置齿轮。React 调 onClick 时会把事件当第一个实参送进来，`page` 就此
 * 被写成一个 **MouseEvent**：下面 9 个 `page === "xxx"` 分支全不匹配 → 面板整片空白、
 * 左导航连高亮都没有（不报错、不 loading，纯静默，极难从界面反推）。
 *
 * 类型拦不住这类传参，所以入口按白名单收口：非白名单值一律当「没指定」（落「通用」）。
 * 加页时要连这张表一起改 —— 它和上面的 NAV_ITEMS 是同一份真相。
 *
 * 分工：**真正的修复在调用点**（App 给侧栏/对话页传零参闭包，同 975 行 `newTask` 的
 * 既有处理）；这道闸是不让同类传参再退化成「静默空白」——它不掩盖上游问题，
 * 因为合法的深链值（"models" 等）照样逐字通过。
 */
export function isSettingsPage(value: unknown): value is SettingsPage {
	return typeof value === "string" && NAV_ITEMS.some((item) => item.id === value);
}

interface SettingsViewProps {
	readonly onClose: () => void;
	/** 「关于」页的诊断入口：诊断是独立 view，跳转让 App 的 view 状态机做。 */
	readonly onOpenDiagnostics: () => void;
	/**
	 * 深链：打开时落在哪一页，缺省「通用」。
	 *
	 * 存在的理由：首页引导条说「还没有可用模型」时，把用户丢到设置首页等于让他
	 * 自己找「模型」那一栏 —— 而那时他连「模型」是什么都还不知道。同 skills-view
	 * 的 `initialTab`（当初修「+」菜单死入口时加的同一个东西）。
	 * 只是**初值**，之后翻页由本组件的 page 状态自管（不再受 prop 变化牵动，
	 * 否则用户手动翻页后父组件一重渲就会被拽回去）。
	 */
	readonly initialPage?: SettingsPage;
}

export function SettingsView({ onClose, onOpenDiagnostics, initialPage }: SettingsViewProps): React.JSX.Element {
	const [page, setPage] = useState<SettingsPage>(initialPage ?? "general");
	const [snapshot, setSnapshot] = useState<SettingsSnapshot | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async (): Promise<void> => {
		try {
			setSnapshot(await window.kami.settingsSnapshot());
			setError(undefined);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	/**
	 * 统一的写操作包装：置忙 → 执行 → 重新拉快照。
	 * 每个动作都重拉是有意的：凭据变化会影响模型可用性，局部更新容易漏。
	 */
	const run = useCallback(
		async (action: () => Promise<void>): Promise<void> => {
			setBusy(true);
			setError(undefined);
			try {
				await action();
				await load();
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				setBusy(false);
			}
		},
		[load],
	);

	/*
	 * 焦点陷阱 / 归还 / 背景 inert 交给共享 hook（落点用默认值：卡片内首个可聚焦元素
	 * 是右上「关闭设置」钮）。
	 *
	 * 本卡是**外层模态**：models-section 的「添加模型」弹层渲染在它内部，两层各自持有
	 * 一份 hook —— hook 内部按挂载先后维护 openModals 栈，Tab 只由最上层处理，
	 * 所以内层打开时焦点不会被外层按「设置卡全境」的可聚焦元素抢回去。
	 */
	const cardRef = useModalFocus();

	/*
	 * Esc 关闭。焦点在表单控件里时放行给控件自己的语义（清空/收起，如 Key 输入框）——
	 * 否则正在填 Key 按 Esc 会把整个设置卡带走，输入内容全丢。
	 */
	useEffect(() => {
		const onKey = (event: KeyboardEvent): void => {
			if (event.key !== "Escape") return;
			if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select") !== null) {
				return;
			}
			onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	/*
	 * 模型页的配置块是快照驱动的：快照未就绪时由它自己渲染「错误态 / 加载态」二选一。
	 * 此前容器层无条件透出的错误条会与它并存 —— 首拉失败后快照永远停在 undefined，
	 * 「正在读取配置…」与错误条永久同框且没有重试出口。
	 * 其余分组不依赖快照（各自拉自己的数据），快照失败不该把它们一并挡掉，
	 * 所以错误条只在「非模型页」或「快照已就绪（此时是写操作失败）」时透出。
	 */
	const modelsAwaitingSnapshot = page === "models" && snapshot === undefined;

	return (
		// 背板点击关闭用 mousedown 而不是 click：在卡片里拖选文本、指针滑出
		// 到背板上松开时 click 会误判为「点背板」，mousedown 的目标判定不会。
		<div
			className="modal-backdrop"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="settings-card" role="dialog" aria-modal="true" aria-label="设置" ref={cardRef}>
				<button type="button" className="bar-btn settings-card-close" aria-label="关闭设置" onClick={onClose}>
					<IconClose size={16} />
				</button>

				<nav className="settings-nav" aria-label="设置分组">
					{NAV_ITEMS.map((item) => (
						<button
							key={item.id}
							type="button"
							className={`settings-nav-item${page === item.id ? " active" : ""}`}
							aria-current={page === item.id ? "page" : undefined}
							onClick={() => setPage(item.id)}
						>
							{item.label}
						</button>
					))}
				</nav>

				<div className="settings-panel">
					{!modelsAwaitingSnapshot && error !== undefined && <ErrorState message={error} />}

					{page === "general" && <GeneralSection busy={busy} />}
					{page === "personalization" && <PersonalizationSection busy={busy} />}
					{page === "memory" && <MemoryEvolutionSection busy={busy} />}
					{/* 三态互斥：快照未就绪时「失败」只渲染错误态 + 重拉，不叠加加载态。 */}
					{page === "models" &&
						(snapshot === undefined ? (
							error !== undefined ? (
								<ErrorState message={error} onRetry={() => void load()} />
							) : (
								<LoadingState text="正在读取配置…" />
							)
						) : (
							<ModelsSection snapshot={snapshot} busy={busy} run={run} />
						))}
					{page === "runtimes" && <RuntimesSection busy={busy} />}
					{page === "data" && <DataManagementSection />}
				{page === "audit" && <AuditSection />}
				{page === "prompt" && <PromptPreviewSection />}
					{page === "about" && (
						<AboutSection configDir={snapshot?.configDir} onOpenDiagnostics={onOpenDiagnostics} />
					)}
				</div>
			</div>
		</div>
	);
}
