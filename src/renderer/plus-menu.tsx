/**
 * 对话页 composer 的「+」菜单。
 *
 * 「+」原来直接弹系统图片选择框，功能单一；改成菜单后一处收纳
 * 添加文件 / 模式切换 / 专家选择 / 技能 / 连接器（后两项占位，走 onTodo）。
 * 模式与专家两个子菜单与头部 ModeSwitch 同一份数据源（availableModes /
 * App 下发的 experts）、同一套交互语义（ready=false 的模式列出不切换，
 * 点击给 toast）——两处呈现不同是合理的，共享的只有数据，不会出现两处
 * 数据不一致（同 model-menu 约定）。
 *
 * 弹层向上展开、左对齐：与 composer 区 PermissionMenu/ModelMenu 同一约定，
 * 贴右放会溢出窗口右缘被裁掉。
 */

import { useState } from "react";
import type { ExpertListItem } from "@shared/ipc.ts";
import type { ModeDescriptor } from "@shared/session-events.ts";
import { IconAssistant, IconCheck, IconDoc, IconPlus, IconSkill, IconWeb, IconWorkspace } from "./icons.tsx";

interface PlusMenuProps {
	readonly modes: readonly ModeDescriptor[];
	readonly currentId: string;
	readonly onInteractionChange: (id: string) => void;
	/** 专家列表与当前专家（专家子菜单数据源；expertId 命中项打 ✓）。 */
	readonly experts: readonly ExpertListItem[];
	readonly expertId: string | undefined;
	readonly onSelectExpert: (expertId: string) => void;
	readonly onPickFiles: () => void;
	readonly onTodo: (feature: string) => void;
}

export function PlusMenu({
	modes,
	currentId,
	onInteractionChange,
	experts,
	expertId,
	onSelectExpert,
	onPickFiles,
	onTodo,
}: PlusMenuProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	// 两个子菜单的开合各自独立持有：hover 或点击都可达（触屏没有 hover）。
	const [modesOpen, setModesOpen] = useState(false);
	const [expertsOpen, setExpertsOpen] = useState(false);

	const close = (): void => {
		setOpen(false);
		setModesOpen(false);
		setExpertsOpen(false);
	};

	// expert 不裸列在模式子菜单里（无专家的 expert 模式不可达，spec: add-expert-mode）
	// —— 三模式平铺，专家走下面的「专家 ▸」子菜单，选中具体专家即进 expert 模式。
	const plainModes = modes.filter((m) => m.id !== "expert");

	return (
		<div className="menu-zone">
			<button
				type="button"
				className="bar-btn"
				aria-label="更多操作"
				title="更多操作"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
			>
				<IconPlus size={17} />
			</button>
			{open && (
				<>
					{/* 透明 backdrop：点菜单外任意处关闭，与同区 PermissionMenu 一致。 */}
					<button type="button" className="ws-backdrop" aria-label="关闭" onClick={close} />
					<div className="pop-menu plus-menu">
						<button
							type="button"
							className="plus-menu-item"
							onClick={() => {
								close();
								onPickFiles();
							}}
						>
							<IconDoc size={15} />
							<span>添加文件</span>
						</button>
						<div
							className="plus-menu-sub-zone"
							onMouseEnter={() => setModesOpen(true)}
							onMouseLeave={() => setModesOpen(false)}
						>
							<button
								type="button"
								className="plus-menu-item"
								aria-expanded={modesOpen}
								onClick={() => setModesOpen((v) => !v)}
							>
								<IconWorkspace size={15} />
								<span>模式</span>
								<span className="plus-menu-caret" aria-hidden="true">
									▸
								</span>
							</button>
							{modesOpen && (
								<div className="plus-menu-sub">
									{plainModes.map((mode) => (
										<button
											key={mode.id}
											type="button"
											className={`plus-menu-mode-item${mode.id === currentId ? " active" : ""}`}
											onClick={() => {
												close();
												// 与头部 ModeSwitch 同语义：未实现的模式仍然列出，
												// 但点击给 toast 反馈，而不是发出去让 daemon 报错。
												if (mode.ready) onInteractionChange(mode.id);
												else onTodo(`「${mode.label}」模式`);
											}}
										>
											<span className="plus-menu-mode-label">
												{mode.label}
												{!mode.ready && <span className="plus-menu-mode-tag">待做</span>}
											</span>
											<span className="plus-menu-mode-desc">{mode.description}</span>
											{mode.id === currentId && <IconCheck size={14} className="plus-menu-mode-check" />}
										</button>
									))}
								</div>
							)}
						</div>
						<div
							className="plus-menu-sub-zone"
							onMouseEnter={() => setExpertsOpen(true)}
							onMouseLeave={() => setExpertsOpen(false)}
						>
							<button
								type="button"
								className="plus-menu-item"
								aria-expanded={expertsOpen}
								onClick={() => setExpertsOpen((v) => !v)}
							>
								<IconAssistant size={15} />
								<span>专家</span>
								<span className="plus-menu-caret" aria-hidden="true">
									▸
								</span>
							</button>
							{expertsOpen && (
								<div className="plus-menu-sub">
									{experts.map((expert) => (
										<button
											key={expert.name}
											type="button"
											className={`plus-menu-mode-item${expert.name === expertId ? " active" : ""}`}
											onClick={() => {
												close();
												onSelectExpert(expert.name);
											}}
										>
											<span className="plus-menu-mode-label">{expert.displayName}</span>
											<span className="plus-menu-mode-desc">{expert.profession}</span>
											{expert.name === expertId && <IconCheck size={14} className="plus-menu-mode-check" />}
										</button>
									))}
								</div>
							)}
						</div>
						<button
							type="button"
							className="plus-menu-item"
							onClick={() => {
								close();
								onTodo("技能");
							}}
						>
							<IconSkill size={15} />
							<span>技能</span>
						</button>
						<button
							type="button"
							className="plus-menu-item"
							onClick={() => {
								close();
								onTodo("连接器");
							}}
						>
							<IconWeb size={15} />
							<span>连接器</span>
						</button>
					</div>
				</>
			)}
		</div>
	);
}
