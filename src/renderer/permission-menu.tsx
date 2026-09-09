/**
 * 首页的权限快捷切换菜单，与工作空间选择器并列在输入卡下方。
 *
 * 为什么不复用设置页的权限区块：设置页是「管理」（含两个独立旋钮、
 * 强制力说明、自定义组合），首页要的是「两秒内换一档预设」。对标
 * WorkBuddy 把权限选择器放在首屏 —— 权限是日常操作，不该藏进设置页。
 *
 * 展示档位的权威来源是旋钮反查（presetIdFor），不是 settings.presetId：
 * 旋钮是真相，presetId 只是意图记录（见 shared/permissions.ts）。
 * 用户在设置页单独动过旋钮时，这里如实显示「自定义」。
 *
 * 与 ModelMenu 的数据流不同：权限没有 session_state 推送，daemon 改动
 * 下一次工具调用即生效，所以选中后用 setPermissions 的返回值就地更新，
 * 不需要通知父组件重拉快照。
 */

import { useCallback, useEffect, useState } from "react";
import type { PermissionInfo, PermissionPreset } from "@shared/permissions.ts";
import { CUSTOM_PRESET, PERMISSION_PRESETS, findPreset, presetIdFor } from "@shared/permissions.ts";
import { IconCheck, IconChevronDown } from "./icons.tsx";

interface PermissionMenuProps {
	readonly onOpenSettings: () => void;
	readonly onError: (message: string) => void;
}

export function PermissionMenu({ onOpenSettings, onError }: PermissionMenuProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const [info, setInfo] = useState<PermissionInfo | undefined>(undefined);

	const reload = useCallback(() => {
		window.kami
			.getPermissions()
			.then(setInfo)
			.catch((error: unknown) => onError(error instanceof Error ? error.message : String(error)));
	}, [onError]);

	// 挂载即拉一次：chip 文案在展开之前就要显示当前档位。
	// 之后每次展开再重拉 —— 用户可能刚在设置页改过，缓存会显示旧档位。
	useEffect(() => {
		reload();
	}, [reload]);

	const toggle = useCallback(() => {
		setOpen((v) => {
			if (!v) reload();
			return !v;
		});
	}, [reload]);

	const pick = useCallback(
		(preset: PermissionPreset) => {
			// 旋钮是权威：是否「已是当前档」用反查结果判定，不看 presetId 意图记录。
			const current =
				info === undefined ? undefined : presetIdFor(info.settings.sandbox, info.settings.approval);
			if (preset.id === current) {
				setOpen(false);
				return;
			}
			window.kami
				.setPermissions({ sandbox: preset.sandbox, approval: preset.approval, presetId: preset.id })
				// 成功：用 daemon 规范化后的返回值就地更新并收起，省一次往返。
				.then((next) => {
					setInfo(next);
					setOpen(false);
				})
				// 失败：只 toast，不回写本地状态 —— chip 必须继续显示真实生效的档位。
				.catch((error: unknown) => onError(error instanceof Error ? error.message : String(error)));
		},
		[info, onError],
	);

	// 旋钮组合不匹配任何预设时为 custom：chip 显示「自定义」，列表无选中项。
	const effectiveId =
		info === undefined ? undefined : presetIdFor(info.settings.sandbox, info.settings.approval);
	const chipLabel =
		effectiveId === undefined
			? "权限"
			: effectiveId === CUSTOM_PRESET
				? "自定义"
				: (findPreset(effectiveId)?.label ?? "自定义");
	const chipTitle =
		effectiveId === undefined || effectiveId === CUSTOM_PRESET
			? (info?.enforcementNote ?? "权限策略")
			: (findPreset(effectiveId)?.description ?? "权限策略");

	return (
		<div className="permission-menu-zone">
			<button type="button" className="context-chip" title={chipTitle} onClick={toggle} aria-expanded={open}>
				{chipLabel}
				<IconChevronDown size={12} />
			</button>

			{open && (
				<>
					{/* 透明 backdrop：点面板外任意处关闭，与同区 WorkspacePicker 一致。 */}
					<button type="button" className="ws-backdrop" aria-label="关闭" onClick={() => setOpen(false)} />
					<div className="permission-menu">
						{info === undefined ? (
							<p className="permission-menu-empty">正在读取权限…</p>
						) : (
							<>
								{PERMISSION_PRESETS.map((preset) => {
									const active = effectiveId === preset.id;
									return (
										<button
											key={preset.id}
											type="button"
											className={`permission-menu-item${active ? " active" : ""}`}
											onClick={() => pick(preset)}
										>
											<span className="permission-menu-name">{preset.label}</span>
											<span className="permission-menu-desc">{preset.description}</span>
											{active && <IconCheck size={14} className="permission-menu-check" />}
										</button>
									);
								})}
								{/* 完整说明与两个独立旋钮在设置页，弹层只负责预设快切。 */}
								<button
									type="button"
									className="permission-menu-goto"
									onClick={() => {
										setOpen(false);
										onOpenSettings();
									}}
								>
									打开设置… →
								</button>
							</>
						)}
					</div>
				</>
			)}
		</div>
	);
}
