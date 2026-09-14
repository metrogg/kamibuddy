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
import { GeneralSection } from "./general-section.tsx";
import { PersonalizationSection } from "./personalization-section.tsx";
import { MemoryEvolutionSection } from "./memory-section.tsx";
import { ModelsSection } from "./models-section.tsx";
import { PromptPreviewSection } from "./prompt-section.tsx";
import { AboutSection } from "./about-section.tsx";

/* nav 项少，不设 WB 那样的分组标题行（「功能」「数据与安全」），直接平列。 */
const NAV_ITEMS = [
	{ id: "general", label: "通用" },
	{ id: "personalization", label: "个性化" },
	{ id: "memory", label: "记忆与进化" },
	{ id: "models", label: "模型" },
	{ id: "prompt", label: "提示词预览" },
	{ id: "about", label: "关于" },
] as const;

type SettingsPage = (typeof NAV_ITEMS)[number]["id"];

interface SettingsViewProps {
	readonly onClose: () => void;
	/** 「关于」页的诊断入口：诊断是独立 view，跳转让 App 的 view 状态机做。 */
	readonly onOpenDiagnostics: () => void;
}

export function SettingsView({ onClose, onOpenDiagnostics }: SettingsViewProps): React.JSX.Element {
	const [page, setPage] = useState<SettingsPage>("general");
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

	return (
		// 背板点击关闭用 mousedown 而不是 click：在卡片里拖选文本、指针滑出
		// 到背板上松开时 click 会误判为「点背板」，mousedown 的目标判定不会。
		<div
			className="modal-backdrop"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="settings-card" role="dialog" aria-modal="true" aria-label="设置">
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
					{error !== undefined && <div className="settings-error">{error}</div>}

					{page === "general" && <GeneralSection busy={busy} />}
					{page === "personalization" && <PersonalizationSection busy={busy} />}
					{page === "memory" && <MemoryEvolutionSection busy={busy} />}
					{page === "models" &&
						(snapshot === undefined ? (
							<p className="settings-empty">正在读取配置…</p>
						) : (
							<ModelsSection snapshot={snapshot} busy={busy} run={run} />
						))}
					{page === "prompt" && <PromptPreviewSection />}
					{page === "about" && (
						<AboutSection configDir={snapshot?.configDir} onOpenDiagnostics={onOpenDiagnostics} />
					)}
				</div>
			</div>
		</div>
	);
}
