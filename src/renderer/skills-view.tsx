/**
 * 技能页（侧栏「专家·技能·连接器」）。布局对标 WorkBuddy 的技能页：
 * 顶部三个页签 + 右上操作区 + 技能卡片网格。
 *
 * 与它的差异（如实呈现，不画死按钮）：
 * - 没有市场/SkillHub —— 我们没有分发后端，本页只管理「已安装」。
 *   后接市场时（ROADMAP T2 之后）再补「精选技能」区。
 * - 专家 / 连接器两个页签还没做，点击给「待做」反馈。
 * - 导入支持「含 SKILL.md 的文件夹」与「单个 .md」；zip 解包后排期。
 *
 * 导入成功后提示词在**下一轮对话**即生效（daemon 每轮现读技能清单），
 * 无需重启。
 */

import { useCallback, useEffect, useState } from "react";
import type { SkillsSnapshot, SkillInfo } from "@shared/settings.ts";
import { IconBack, IconFolder, IconPlus } from "./icons.tsx";

interface SkillsViewProps {
	readonly onClose: () => void;
	readonly onTodo: (feature: string) => void;
	/** 导入成功 / 失败都走这个轻提示。 */
	readonly onToast: (text: string) => void;
}

/** 顶部页签。专家 / 连接器未实现，仍列出（对齐 WorkBuddy 的信息架构）。 */
const TABS = [
	{ id: "expert", label: "专家", ready: false },
	{ id: "skills", label: "技能", ready: true },
	{ id: "connectors", label: "连接器", ready: false },
] as const;

export function SkillsView({ onClose, onTodo, onToast }: SkillsViewProps): React.JSX.Element {
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
				<nav className="skills-tabs">
					{TABS.map((tab) => (
						<button
							key={tab.id}
							type="button"
							className={`skills-tab${tab.ready ? " active" : ""}`}
							onClick={() => {
								if (tab.ready) return;
								onTodo(`「${tab.label}」`);
							}}
						>
							{tab.label}
							{!tab.ready && <span className="skills-tab-tag">待做</span>}
						</button>
					))}
				</nav>
				<span className="bar-spacer" />
				<button type="button" className="mini-btn" disabled={busy} onClick={openSkillsDir}>
					<IconFolder size={13} />
					打开技能目录
				</button>
				<button type="button" className="mini-btn" disabled={busy} onClick={importFolder}>
					<IconPlus size={13} />
					导入技能…
				</button>
			</header>

			<div className="skills-body">
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
