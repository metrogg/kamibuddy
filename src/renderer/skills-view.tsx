/**
 * 技能页（侧栏「专家·技能·连接器」）。布局对标 WorkBuddy 的技能页：
 * 顶部三个页签 + 右上操作区 + 内容区。
 *
 * 与它的差异（如实呈现，不画死按钮）：
 * - 没有市场/SkillHub —— 我们没有分发后端，技能页只管理「已安装」。
 *   后接市场时再补「精选技能」区。
 * - 专家页签是完整的专家市场页（experts-view.tsx，WorkBuddy ExpertCenterPage
 *   同构：搜索/分类/卡片/详情弹窗/我的专家），专家团为占位 tab（spec:
 *   rework-expert-center-and-chip）。
 * - 导入支持「含 SKILL.md 的文件夹」与「单个 .md」；zip 解包后排期。
 *
 * 导入成功后提示词在**下一轮对话**即生效（daemon 每轮现读技能清单），
 * 无需重启。连接器页签是独立面板（connectors-view.tsx），数据自管。
 */

import { useCallback, useEffect, useState } from "react";
import type { SkillsSnapshot, SkillInfo } from "@shared/settings.ts";
import type { ExpertListItem } from "@shared/ipc.ts";
import { ConnectorsView } from "./connectors-view.tsx";
import { ExpertsView } from "./experts-view.tsx";
import { IconBack, IconFolder, IconPlus } from "./icons.tsx";

interface SkillsViewProps {
	readonly onClose: () => void;
	readonly onTodo: (feature: string) => void;
	/** 导入成功 / 失败都走这个轻提示。 */
	readonly onToast: (text: string) => void;
	/** 专家库（App 启动时经 listExperts 拉取，含用户级覆盖与 source 标记）。 */
	readonly experts: readonly ExpertListItem[];
	/** 启用专家：选中 + 进新任务对话页（App 层组合 newTask/setExpert/路由/预填）。 */
	readonly onUseExpert: (expertId: string, prefill?: string) => void;
	/** 创建专家：跳回主页并把引导语填入输入框（App 层组合 prefill + 路由）。 */
	readonly onCreateExpert: () => void;
}

/** 顶部页签。专家为首 tab（WorkBuddy 专家/技能/连接器 同款顺序）。 */
const TABS = [
	{ id: "experts", label: "专家", ready: true },
	{ id: "skills", label: "技能", ready: true },
	{ id: "connectors", label: "连接器", ready: true },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SkillsView({ onClose, onTodo, onToast, experts, onUseExpert, onCreateExpert }: SkillsViewProps): React.JSX.Element {
	const [tab, setTab] = useState<TabId>("experts");
	const [snapshot, setSnapshot] = useState<SkillsSnapshot | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async (): Promise<void> => {
		try {
			setSnapshot(await window.kami.skillsSnapshot());
			setError(undefined);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

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

	const importFolder = useCallback((): void => {
		void run(async () => {
			const dir = await window.kami.pickSkillDirectory();
			// 用户取消选择不算错误，静默返回。
			if (dir === undefined) return;
			const skill = await window.kami.importSkill(dir);
			onToast(`已导入技能「${skill.name}」，下一轮对话即可使用`);
		});
	}, [run, onToast]);

	const openSkillsDir = useCallback((): void => {
		if (snapshot === undefined) return;
		// 打开用户技能目录：高级用户可以直接手工放文件夹（导入只是捷径）。
		window.kami.openArtifact(snapshot.userSkillsDir).catch((e: unknown) => {
			onToast(e instanceof Error ? e.message : String(e));
		});
	}, [snapshot, onToast]);

	return (
		<main className="skills">
			<header className="skills-head">
				<button type="button" className="bar-btn" aria-label="返回" onClick={onClose}>
					<IconBack size={17} />
				</button>
				<nav className="skills-tabs" role="tablist">
				{TABS.map((t) => (
					<button
						key={t.id}
						type="button"
						role="tab"
						aria-selected={tab === t.id}
						className={`skills-tab${tab === t.id ? " active" : ""}`}
							onClick={() => {
								if (!t.ready) {
									onTodo(`「${t.label}」`);
									return;
								}
								setTab(t.id);
							}}
						>
							{t.label}
							{!t.ready && <span className="skills-tab-tag">待做</span>}
						</button>
					))}
				</nav>
				<span className="bar-spacer" />
				{/* 头部操作区是技能页的（导入/开目录）；连接器的操作在面板自己的工具行里。 */}
				{tab === "skills" && (
					<>
						<button type="button" className="mini-btn" disabled={busy} onClick={openSkillsDir}>
							<IconFolder size={13} />
							打开技能目录
						</button>
						<button type="button" className="mini-btn" disabled={busy} onClick={importFolder}>
							<IconPlus size={13} />
							导入技能…
						</button>
					</>
				)}
			</header>

			<div className="skills-body">
				{tab === "connectors" ? (
					<ConnectorsView onToast={onToast} />
				) : tab === "experts" ? (
					<ExpertsView experts={experts} onUseExpert={onUseExpert} onCreateExpert={onCreateExpert} />
				) : (
					<>
						{error !== undefined && <div className="settings-error">{error}</div>}

						{snapshot === undefined ? (
							<p className="settings-empty">正在读取…</p>
						) : snapshot.skills.length === 0 ? (
							<div className="skills-empty">
								<p>还没有安装任何技能。</p>
								<p>
									点右上角「导入技能」选择一个包含 SKILL.md 的文件夹；
									或把技能文件夹直接放进技能目录。
								</p>
							</div>
						) : (
							<div className="skill-grid">
								{snapshot.skills.map((skill) => (
									<SkillCard key={skill.filePath} skill={skill} />
								))}
							</div>
						)}
					</>
				)}
			</div>
		</main>
	);
}

function SkillCard({ skill }: { readonly skill: SkillInfo }): React.JSX.Element {
	return (
		<div className="skill-card">
			<div className="skill-card-head">
				<span className="skill-card-name">{skill.name}</span>
				<span className="provider-tag">{skill.origin === "builtin" ? "内置" : "自装"}</span>
			</div>
			<p className="skill-card-desc">{skill.description}</p>
			<p className="skill-card-path" title={skill.filePath}>
				{skill.filePath}
			</p>
		</div>
	);
}
