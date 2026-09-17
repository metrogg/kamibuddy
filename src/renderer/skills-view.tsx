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
import { formatMessageTime } from "@shared/message-time.ts";
import { ConnectorsView } from "./connectors-view.tsx";
import { ExpertsView } from "./experts-view.tsx";
import { IconBack, IconFolder, IconPlus, IconSkill } from "./icons.tsx";
import { EmptyState, ErrorState, LoadingState } from "./state-views.tsx";

interface SkillsViewProps {
	readonly onClose: () => void;
	/** 初始页签（「+」菜单直达技能/连接器页签用）；缺省 experts。 */
	readonly initialTab?: TabId;
	readonly onTodo: (feature: string) => void;
	/** 导入成功 / 失败都走这个轻提示。 */
	readonly onToast: (text: string) => void;
	/**
	 * 专家库（App 启动时经 listExperts 拉取，含用户级覆盖与 source 标记）。
	 * undefined = 还没拉回来（加载中）—— 与「拉回来但库里是空的」（[]）分开。
	 */
	readonly experts: readonly ExpertListItem[] | undefined;
	/** 专家库拉取失败的原因（undefined = 没失败）。失败不能与「库为空」混为一谈。 */
	readonly expertsError: string | undefined;
	/** 专家库失败态的重试（App 侧可重复调用的 listExperts），原样透传给专家页。 */
	readonly onRetryExperts: () => void;
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

export function SkillsView({ onClose, onTodo, onToast, experts, expertsError, onRetryExperts, onUseExpert, onCreateExpert, initialTab }: SkillsViewProps): React.JSX.Element {
	// initialTab：「+」菜单的「技能/连接器」入口直达对应页签（2026-09-17 接线，
	// 此前这两个入口是「待做」占位）。缺省专家为首 tab。
	const [tab, setTab] = useState<TabId>(initialTab ?? "experts");
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

	/**
	 * 切开关。**直接用返回的新快照**，不调 load() 再拉一次：
	 * 写通道返回的就是「此刻的全量 + 成本数字」，再拉一次既多一个来回，
	 * 也可能与刚写下的状态错位（spec: 一次拉取渲染全页）。
	 */
	const setEnabled = useCallback((name: string, enabled: boolean): void => {
		void (async () => {
			setBusy(true);
			setError(undefined);
			try {
				setSnapshot(await window.kami.setSkillEnabled(name, enabled));
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				setBusy(false);
			}
		})();
	}, []);

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
				<nav className="skills-tabs">
					{TABS.map((t) => (
						<button
							key={t.id}
							type="button"
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
					<ExpertsView
						experts={experts}
						error={expertsError}
						onRetry={onRetryExperts}
						onUseExpert={onUseExpert}
						onCreateExpert={onCreateExpert}
					/>
				) : (
					/*
					 * 三态互斥：失败 → 就地错误卡 + 重试（调 load）；未就绪 → 加载态；
					 * 数据回来且为空 → 空态。原来 error 条与「正在读取…」并存 ——
					 * 拉取失败时 snapshot 永远停在 undefined，页面永久卡在「正在读取」，
					 * 且没有任何重试出口（DESIGN.md §4：失败就地呈现 + 重试动作）。
					 */
					error !== undefined ? (
						<ErrorState message={error} onRetry={() => void load()} />
					) : snapshot === undefined ? (
						<LoadingState />
					) : snapshot.skills.length === 0 ? (
						<EmptyState
							title="还没有安装任何技能。"
							description="点右上角「导入技能」选择一个包含 SKILL.md 的文件夹；或把技能文件夹直接放进技能目录。"
						/>
					) : (
						<>
							{/*
							 * 成本常显行 + 超阈值提示。数字全部来自同一次 skills:snapshot
							 * （开关动作返回的新快照），渲染层不重算 —— 重算就会与模型实际
							 * 收到的清单段分家（spec: 技能成本可见）。
							 */}
							<div className="skill-cost">
								<p className="stat-hint">
									已启用 {snapshot.enabledCount} / 共 {snapshot.skills.length} 个技能 ·
									技能清单约 {snapshot.skillsTokens} token
								</p>
								{snapshot.warning !== undefined && (
									<p className="stat-hint skill-cost-warn">{snapshot.warning}</p>
								)}
							</div>
							<div className="skill-grid">
								{snapshot.skills.map((skill) => (
									<SkillCard
										key={skill.filePath}
										skill={skill}
										busy={busy}
										onToggle={setEnabled}
									/>
								))}
							</div>
						</>
					)
				)}
			</div>
		</main>
	);
}

/**
 * 来源文案：内置 / 导入（有 `_installed.json`）/ 手工放置（自装但没有 sidecar）。
 * 三种都是**确定的信息**，没有「未知」这一态 —— 缺失项不显示伪造值（spec: 技能包元数据）。
 */
function sourceLabel(skill: SkillInfo): string {
	if (skill.origin === "builtin") return "内置";
	return skill.sourcePath === undefined ? "手工放置" : "导入";
}

/**
 * 来源路径在卡片上只留末两段（完整路径挂在 title 上），长路径不撑爆卡片。
 * 只取文件名（末一段）信息量太低 —— 那个通常就是技能名本身。
 */
function shortSourcePath(path: string): string {
	const parts = path.split(/[\\/]/).filter((part) => part !== "");
	return parts.length <= 2 ? path : `…/${parts.slice(-2).join("/")}`;
}

function SkillCard({
	skill,
	busy,
	onToggle,
}: {
	readonly skill: SkillInfo;
	readonly busy: boolean;
	readonly onToggle: (name: string, enabled: boolean) => void;
}): React.JSX.Element {
	const meta: string[] = [];
	// 缺失项直接不出现：留白好过「未知」这种占位噪声。
	if (skill.version !== undefined) meta.push(`v${skill.version}`);
	meta.push(sourceLabel(skill));
	if (skill.sourcePath !== undefined) meta.push(shortSourcePath(skill.sourcePath));
	if (skill.installedAt !== undefined) meta.push(formatMessageTime(skill.installedAt, Date.now()));

	return (
		<div className={`skill-card${skill.enabled ? "" : " skill-card-off"}`}>
			<div className="skill-card-head">
				{/* 与 `/` 菜单技能组同一个图标（用户决策：不引入技能自定义图标）。 */}
				<IconSkill size={15} className="skill-card-icon" />
				<span className="skill-card-name">{skill.name}</span>
				{/*
				 * 启停开关：结构与连接器页的既有开关一致（label 包住原生 checkbox，
				 * 轨道与滑块是展示层）—— 视觉声明复用同一组 CSS，见 index.css 的 .skill-switch。
				 * 停用的技能**留在列表里**（否则开关没有落点），只是卡片降一档灰度。
				 */}
				<label className="skill-switch" title={skill.enabled ? "点击停用" : "点击启用"}>
					<input
						type="checkbox"
						checked={skill.enabled}
						disabled={busy}
						aria-label={`${skill.enabled ? "停用" : "启用"}技能 ${skill.name}`}
						onChange={(e) => onToggle(skill.name, e.currentTarget.checked)}
					/>
					<span className="skill-switch-track">
						<span className="skill-switch-thumb" />
					</span>
				</label>
			</div>
			{/* 元数据行。来源路径被截短，故整行的 title 给完整路径（没有来源时不给 title）。 */}
			<p className="skill-card-meta" title={skill.sourcePath}>
				{meta.join(" · ")}
			</p>
			<p className="skill-card-desc">{skill.description}</p>
			<p className="skill-card-path" title={skill.filePath}>
				{skill.filePath}
			</p>
		</div>
	);
}
