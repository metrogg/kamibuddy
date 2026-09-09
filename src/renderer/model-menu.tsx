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

import { useCallback, useState } from "react";
import type { ModelInfo, SettingsSnapshot } from "@shared/settings.ts";
import { IconCheck, IconChevronDown } from "./icons.tsx";

interface ModelMenuProps {
	readonly modelId: string | undefined;
	readonly onOpenSettings: () => void;
	readonly onError: (message: string) => void;
}

/** 完整标识形如 `deepseek/deepseek-chat`，按钮上只显示模型名，完整值放 title。 */
export function shortModelName(modelId: string | undefined): string {
	if (modelId === undefined) return "选择模型";
	const at = modelId.indexOf("/");
	return at === -1 ? modelId : modelId.slice(at + 1);
}

export function ModelMenu({ modelId, onOpenSettings, onError }: ModelMenuProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const [snapshot, setSnapshot] = useState<SettingsSnapshot | undefined>(undefined);

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

	const providerName = new Map((snapshot?.providers ?? []).map((p) => [p.id, p.name]));
	// 只列可用的：主页是切换器不是管理页；未配置的模型点了必然报错。
	const available: readonly ModelInfo[] = (snapshot?.models ?? []).filter((m) => m.available);

	return (
		<div className="menu-zone">
			<button type="button" className="bar-btn bar-btn-text" title={modelId ?? "尚未选择模型"} onClick={toggle}>
				{shortModelName(modelId)}
				<IconChevronDown size={13} />
			</button>

			{open && (
				<div className="pop-menu model-menu">
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
							{available.map((model) => {
								const key = `${model.providerId}/${model.id}`;
								const active = key === modelId;
								return (
									<button
										key={key}
										type="button"
										className={`model-menu-item${active ? " active" : ""}`}
										onClick={() => pick(key)}
									>
										<span className="model-menu-name">{model.name}</span>
										<span className="model-menu-meta">
											{providerName.get(model.providerId) ?? model.providerId} ·{" "}
											{Math.round(model.contextWindow / 1000)}K
										</span>
										{active && <IconCheck size={14} className="model-menu-check" />}
									</button>
								);
							})}
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
			)}
		</div>
	);
}
