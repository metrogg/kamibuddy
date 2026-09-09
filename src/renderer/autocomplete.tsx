/**
 * 输入框补全下拉（@ 文件 + / 命令）。
 *
 * 触发/过滤的纯逻辑在 shared/autocomplete.ts（可单测），本组件只做：
 * 把纯逻辑接到受控 textarea 上（光标位置、键盘导航、点击选中），并渲染下拉。
 *
 * 数据源经 window.kami.completions() 拉取（daemon 聚合：文件=当前工作空间、
 * 命令=技能+自有）。临时任务的共享目录通常没有文件，@ 下拉自然不出。
 *
 * 选中后 `@` / `/` 以纯文本插入（按需求，不做内容注入）——
 * 文件内容靠模型的 read 工具去读，命令由 pi 的 prompt 自动展开。
 *
 * 用法：
 *   const ac = useAutocomplete();
 *   <textarea {...ac.textareaProps} value={draft} onChange={...合并...} />
 *   {ac.menu}
 * 或直接看 home-view / chat-view 的接法。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CompletionData } from "@shared/ipc.ts";
import {
	applyCompletion,
	completionTrigger,
	filterItems,
	type CompletionItem,
} from "@shared/autocomplete.ts";

export interface UseAutocompleteResult {
	/**
	 * 接到 textarea 上。`value` / `onChange` 由调用方自己控制（受控组件），
	 * 这里只接管光标追踪与按键导航。
	 */
	readonly bind: {
		readonly onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
		readonly onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
		readonly onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
		readonly onBlur: () => void;
	};
	/** 下拉元素（未打开时为 null）。 */
	readonly menu: React.JSX.Element | null;
	/** 当前是否打开（调用方可据此决定 Enter 是发送还是选中）。 */
	readonly isOpen: boolean;
}

interface OpenState {
	readonly query: NonNullable<ReturnType<typeof completionTrigger>>;
	readonly items: readonly CompletionItem[];
	readonly active: number;
	/** 触发时的光标位置（替换文本要用）。 */
	readonly cursorPos: number;
}

function buildItems(data: CompletionData | undefined, kind: "file" | "command"): CompletionItem[] {
	if (data === undefined) return [];
	if (kind === "file") return data.files.map((p) => ({ label: p, insert: `@${p}` }));
	return data.commands.map((c) => ({ label: `/${c.name}`, insert: `/${c.name}`, hint: c.description }));
}

export function useAutocomplete(
	value: string,
	setValue: (v: string) => void,
	textareaRef: React.RefObject<HTMLTextAreaElement | null>,
	/**
	 * 数据源刷新键：工作空间（cwd）切换后文件列表必须重拉，
	 * 否则 @ 永远停留在挂载时那份旧空间的列表。
	 * 调用方传当前 cwd 即可；新建任务后组件随父级重挂载，也会自然刷新。
	 */
	refreshKey?: unknown,
): UseAutocompleteResult {
	const [data, setData] = useState<CompletionData | undefined>(undefined);
	const [open, setOpen] = useState<OpenState | undefined>(undefined);
	const openRef = useRef<OpenState | undefined>(undefined);
	openRef.current = open;

	useEffect(() => {
		let disposed = false;
		window.kami
			.completions()
			.then((d) => {
				if (!disposed) setData(d);
			})
			.catch(() => {
				// 拉取失败静默降级为无补全（补全只是增强，不该影响输入）。
			});
		return () => {
			disposed = true;
		};
	}, [refreshKey]);

	const close = useCallback(() => setOpen(undefined), []);

	/** 依据当前 textarea 的值与光标重算补全。 */
	const recompute = useCallback(
		(text: string, pos: number) => {
			const query = completionTrigger({ text, position: pos });
			if (query === undefined) {
				close();
				return;
			}
			const items = filterItems(buildItems(data, query.kind), query.query);
			if (items.length === 0) {
				close();
				return;
			}
			setOpen({ query, items, active: 0, cursorPos: pos });
		},
		[data, close],
	);

	/** 选中一项：替换触发片段为新文本，光标落在插入内容后。 */
	const pick = useCallback(
		(item: CompletionItem) => {
			const s = openRef.current;
			if (s === undefined) return;
			const next = applyCompletion({ text: value, position: s.cursorPos }, s.query, item);
			setValue(next.text);
			close();
			// 等 React 把新值写回 DOM 后再放光标。
			requestAnimationFrame(() => {
				const el = textareaRef.current;
				if (el !== null) {
					el.focus();
					el.setSelectionRange(next.position, next.position);
				}
			});
		},
		[value, setValue, close, textareaRef],
	);
	const pickRef = useRef(pick);
	pickRef.current = pick;

	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			const el = e.target;
			setValue(el.value);
			recompute(el.value, el.selectionStart ?? el.value.length);
		},
		[setValue, recompute],
	);

	const onSelect = useCallback(
		(e: React.SyntheticEvent<HTMLTextAreaElement>) => {
			const el = e.currentTarget;
			recompute(el.value, el.selectionStart ?? el.value.length);
		},
		[recompute],
	);

	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			const s = openRef.current;
			if (s === undefined) return; // 未打开时不拦截任何键（含 Enter 发送）

			if (e.key === "ArrowDown") {
				e.preventDefault();
				setOpen({ ...s, active: (s.active + 1) % s.items.length });
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setOpen({ ...s, active: (s.active - 1 + s.items.length) % s.items.length });
			} else if (e.key === "Escape") {
				e.preventDefault();
				close();
			} else if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault();
				const item = s.items[s.active];
				if (item !== undefined) pickRef.current(item);
			}
			// 其余键（字母、退格…）放行，由 onChange 驱动 recompute
		},
		[close],
	);

	const onBlur = useCallback(() => {
		// mousedown 选中项前先失焦：延迟关闭，让点击事件先落地。
		window.setTimeout(close, 120);
	}, [close]);

	const menu =
		open === undefined ? null : (
			<div className="ac-menu" role="listbox">
				{open.items.map((item, i) => (
					<button
						key={item.label}
						type="button"
						role="option"
						aria-selected={i === open.active}
						className={`ac-item${i === open.active ? " active" : ""}`}
						onMouseDown={(e) => {
							e.preventDefault(); // 保住 textarea 焦点，让 pick 里的 requestAnimationFrame 能正确放光标
							pickRef.current(item);
						}}
					>
						<span className="ac-label">{item.label}</span>
						{item.hint !== undefined && <span className="ac-hint">{item.hint}</span>}
					</button>
				))}
			</div>
		);

	return { bind: { onChange, onKeyDown, onSelect, onBlur }, menu, isOpen: open !== undefined };
}
