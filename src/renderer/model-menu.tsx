/**
 * 主页的模型快捷切换菜单。
 *
 * 为什么不复用设置页的 ModelPicker：设置页是「管理」（含未配置服务商、
 * Key 输入、增删自建），主页要的是「两秒内换个模型」。呈现不同是合理的；
 * 共享的是同一份数据源（settingsSnapshot IPC），不会出现两处数据不一致。
 *
 * 选中后的状态更新不需要回调：daemon 的 setModel 会推 session_state，
 * conversation 状态随之更新，这里的 modelId prop 自然刷新 —— 单一数据流。
 */

import { useCallback, useEffect, useState } from "react";
import type { ModelInfo, SettingsSnapshot } from "@shared/settings.ts";
import type { ThinkingLevel } from "@shared/session-events.ts";
import { THINKING_LEVEL_LABELS } from "@shared/session-events.ts";
import { IconCheck, IconChevronDown } from "./icons.tsx";

interface ModelMenuProps {
	readonly modelId: string | undefined;
	/**
	 * 当前推理档位（conversation.state 直传，session_state 推送自动刷新）。
	 * undefined = 宿主未建/未知，pill 不显示档位后缀（与非推理模型同口径）。
	 */
	readonly thinkingLevel?: ThinkingLevel;
	/**
	 * 当前模型的可用档位。undefined = pristine（宿主未建、能力未解析），
	 * 此时子菜单列全量七档；恰为 ["off"] 表示非推理模型，不渲染「推理强度」行。
	 */
	readonly availableThinkingLevels?: readonly ThinkingLevel[];
	readonly onOpenSettings: () => void;
	readonly onError: (message: string) => void;
}

/** 完整标识形如 `deepseek/deepseek-chat`，按钮上只显示模型名，完整值放 title。 */
export function shortModelName(modelId: string | undefined): string {
	if (modelId === undefined) return "选择模型";
	const at = modelId.indexOf("/");
	return at === -1 ? modelId : modelId.slice(at + 1);
}

export function ModelMenu({
	modelId,
	thinkingLevel,
	availableThinkingLevels,
	onOpenSettings,
	onError,
}: ModelMenuProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const [snapshot, setSnapshot] = useState<SettingsSnapshot | undefined>(undefined);
	// 档位子菜单的开合独立持有：hover 或点击都可达（触屏没有 hover，同 PlusMenu 约定）。
	const [levelsOpen, setLevelsOpen] = useState(false);

	// Esc 关闭弹层（连同档位子菜单）：菜单没有键盘焦点管理，Esc 是键盘用户唯一的
	// 关闭路径；与 backdrop 互补（一个管键盘，一个管指针）。
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				setOpen(false);
				setLevelsOpen(false);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	const toggle = useCallback(() => {
		setOpen((v) => {
			const next = !v;
			// 每次展开都重拉：用户可能刚在设置页配了新 Key，缓存会显示旧的可用集。
			if (next) {
				window.kami
					.settingsSnapshot()
					.then(setSnapshot)
					.catch((error: unknown) => onError(error instanceof Error ? error.message : String(error)));
			}
			return next;
		});
		// 主菜单开合都复位子菜单：下次重开从「推理强度」行开始，而不是残留展开态。
		setLevelsOpen(false);
	}, [onError]);

	const pick = useCallback(
		(key: string) => {
			setOpen(false);
			window.kami.setModel(key).catch((error: unknown) => {
				onError(error instanceof Error ? error.message : String(error));
			});
		},
		[onError],
	);

	const pickThinkingLevel = useCallback(
		(level: ThinkingLevel) => {
			setOpen(false);
			setLevelsOpen(false);
			// 无本地回写：daemon 推 session_state，pill 与勾选随之刷新（同 pick 模型）。
			window.kami.setThinkingLevel(level).catch((error: unknown) => {
				onError(error instanceof Error ? error.message : String(error));
			});
		},
		[onError],
	);

	const providerName = new Map((snapshot?.providers ?? []).map((p) => [p.id, p.name]));
	// 只列可用的：主页是切换器不是管理页；未配置的模型点了必然报错。
	const available: readonly ModelInfo[] = (snapshot?.models ?? []).filter((m) => m.available);

	// pill 档位后缀：档位未知不显示；可用档位只有一档（含非推理模型的 ["off"]）
	// 时后缀没有信息量，也不显示。
	const levelSuffix =
		thinkingLevel !== undefined && (availableThinkingLevels === undefined || availableThinkingLevels.length > 1)
			? THINKING_LEVEL_LABELS[thinkingLevel]
			: undefined;

	// 「推理强度」行只在非推理模型（可用档位恰为 ["off"]）时隐藏；pristine
	// （undefined，能力未解析）照常显示 —— 此时用户正需要在建宿主前选档。
	const thinkingRowVisible = !(
		availableThinkingLevels !== undefined &&
		availableThinkingLevels.length === 1 &&
		availableThinkingLevels[0] === "off"
	);

	// pristine 时列表未按模型裁剪（能力未解析），先给全量七档；pi 建宿主时会
	// clamp 到模型实际可用档位，UI 不自建模型能力表（SessionState 注释同口径）。
	// 档位顺序取 THINKING_LEVEL_LABELS 的声明序（off→max），键序即档位序。
	const thinkingOptions: readonly ThinkingLevel[] =
		availableThinkingLevels ?? (Object.keys(THINKING_LEVEL_LABELS) as ThinkingLevel[]);

	return (
		<div className="menu-zone">
			<button
				type="button"
				className="bar-btn bar-btn-text"
				title={modelId ?? "尚未选择模型"}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={toggle}
			>
				{shortModelName(modelId)}
				{levelSuffix !== undefined && <span className="model-menu-level">{levelSuffix}</span>}
				<IconChevronDown size={13} />
			</button>

			{open && (
				<>
					{/* 透明 backdrop：点菜单外任意处关闭，与 PlusMenu/PermissionMenu 一致。 */}
					<button
						type="button"
						className="ws-backdrop"
						aria-label="关闭"
						onClick={() => {
							setOpen(false);
							setLevelsOpen(false);
						}}
					/>
					<div className="pop-menu model-menu" role="menu">
						{snapshot === undefined ? (
							<p className="model-menu-empty">正在读取模型…</p>
						) : available.length === 0 ? (
							<>
								<p className="model-menu-empty">还没有可用模型</p>
								<button
									type="button"
									className="model-menu-goto"
									onClick={() => {
										setOpen(false);
										onOpenSettings();
									}}
								>
									去设置里填 API Key →
								</button>
							</>
						) : (
							<>
								{/*
								滚动只包模型列表：弹层若整体 overflow-y:auto，向左飞出的
								档位子菜单会被滚动容器裁掉（overflow 一轴非 visible，
								另一轴也按非 visible 处理）。列表滚动、底部功能区固定。
							*/}
								<div className="model-menu-list">
									{available.map((model) => {
										const key = `${model.providerId}/${model.id}`;
										const active = key === modelId;
										return (
											<button
												key={key}
												type="button"
												className={`model-menu-item${active ? " active" : ""}`}
												role="menuitem"
												onClick={() => pick(key)}
											>
												<span className="model-menu-name">{model.name}</span>
												<span className="model-menu-meta">
												{providerName.get(model.providerId) ?? model.providerId} ·{" "}
												{/* K 缩写语义保留，数字走 Intl 分组（1280K → 1,280K）。 */}
												{new Intl.NumberFormat("zh-CN").format(Math.round(model.contextWindow / 1000))}K
											</span>
												{active && <IconCheck size={14} className="model-menu-check" />}
											</button>
										);
									})}
								</div>
								{/*
								推理强度行（WorkBuddy 的「高 >」）：右侧是当前档位 label，
								点击/hover 展开档位子菜单。非推理模型整行不渲染（见上）。
							*/}
								{thinkingRowVisible && (
									<div
										className="model-menu-thinking-zone"
										onMouseEnter={() => setLevelsOpen(true)}
										onMouseLeave={() => setLevelsOpen(false)}
									>
										<button
											type="button"
											className="model-menu-thinking"
											aria-expanded={levelsOpen}
											onClick={() => setLevelsOpen((v) => !v)}
										>
											<span>推理强度</span>
											<span className="model-menu-thinking-current">
												{thinkingLevel !== undefined && THINKING_LEVEL_LABELS[thinkingLevel]}
												<span className="model-menu-thinking-caret" aria-hidden="true">
													›
												</span>
											</span>
										</button>
										{levelsOpen && (
											<div className="pop-menu model-menu-levels" role="menu">
												{thinkingOptions.map((level) => (
													<button
														key={level}
														type="button"
														className={`model-menu-level-item${level === thinkingLevel ? " active" : ""}`}
														role="menuitem"
														onClick={() => pickThinkingLevel(level)}
													>
														{THINKING_LEVEL_LABELS[level]}
														{level === thinkingLevel && <IconCheck size={14} className="model-menu-check" />}
													</button>
												))}
											</div>
										)}
									</div>
								)}
								<button
									type="button"
									className="model-menu-goto"
									onClick={() => {
										setOpen(false);
										onOpenSettings();
									}}
								>
									全部模型与服务商… →
								</button>
							</>
						)}
					</div>
				</>
			)}
		</div>
	);
}
