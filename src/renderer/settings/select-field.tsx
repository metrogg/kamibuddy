/**
 * 设置页通用下拉（替代原生 <select>）。
 *
 * 为什么不用原生：原生 select 的展开态是操作系统绘制的（蓝底高亮、粗滚动条、
 * 无圆角），闭合态我们能写 CSS、展开态一点都控制不了，和全站自定义菜单
 * （model-menu / ModeSwitch）两个画风。这里复用 provider-picker 的弹层视觉
 * （trigger + 面板 + hover 底 + 选中 ✓），选项少（≤10 项）不做搜索。
 *
 * 与 models-section 的供应商 picker 的分工：那是带搜索 + 双态元信息的专用
 * 大面板；这是通用小组件，只解决「从几个选项里选一个」。
 */

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronDown } from "../icons.tsx";

export interface SelectFieldOption {
	readonly value: string;
	readonly label: string;
}

interface SelectFieldProps {
	readonly value: string;
	readonly options: readonly SelectFieldOption[];
	readonly onChange: (value: string) => void;
	readonly disabled?: boolean;
	readonly ariaLabel: string;
	/** value 没有匹配选项时的占位文案（置灰显示）。 */
	readonly placeholder?: string;
}

export function SelectField({ value, options, onChange, disabled, ariaLabel, placeholder }: SelectFieldProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	// 点面板外收起（与供应商 picker / 各菜单同口径）。
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: MouseEvent) => {
			if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) setOpen(false);
		};
		window.addEventListener("mousedown", onPointerDown);
		return () => window.removeEventListener("mousedown", onPointerDown);
	}, [open]);

	const current = options.find((option) => option.value === value);

	return (
		<div
			className="select-field"
			ref={rootRef}
			onKeyDown={(event) => {
				// 面板开着时 Esc 只收面板：设置卡/添加模型弹层的 Esc 守卫对 button
				// 不放行，不拦下会连带把整卡关掉（选项按钮上按 Esc 也一样）。
				if (event.key === "Escape" && open) {
					event.stopPropagation();
					setOpen(false);
				}
			}}
		>
			<button
				type="button"
				className={`provider-select-trigger${current === undefined ? " placeholder" : ""}`}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-label={ariaLabel}
				disabled={disabled}
				onClick={() => setOpen((v) => !v)}
			>
				<span className="provider-select-label">{current?.label ?? placeholder ?? "请选择"}</span>
				<IconChevronDown size={13} />
			</button>

			{open && (
				<div className="provider-select-panel" role="listbox" aria-label={ariaLabel}>
					{options.map((option) => (
						<button
							key={option.value}
							type="button"
							role="option"
							aria-selected={option.value === value}
							className="provider-option"
							onClick={() => {
								onChange(option.value);
								setOpen(false);
							}}
						>
							<span className="provider-option-name">{option.label}</span>
							{option.value === value && <IconCheck size={13} className="select-field-check" />}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
