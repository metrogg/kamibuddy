/**
 * 输入框补全下拉（@ 文件 + / 命令）。
 *
 * 触发/过滤的纯逻辑在 shared/autocomplete.ts（可单测），本组件只做：
 * 把纯逻辑接到受控 textarea 上（光标位置、键盘导航、点击选中），并渲染下拉。
 *
 * 数据源经 window.kami.completions() 拉取（daemon 聚合：文件=当前工作空间、
 * 命令=技能+自有）。临时任务的工作目录（待分配态为空）通常没有文件，@ 下拉自然不出。
 *
 * 选中后 `@` 文件与「指令」类 `/` 项以纯文本插入（文件内容靠模型的 read 工具去读，
 * 命令由 pi 的 prompt 自动展开）；**技能项不插文本**，转成输入卡上的 chip
 * （见 useAutocomplete 的 onPickSkill）。
 *
 * 用法：
 *   const ac = useAutocomplete(value, setValue, textareaRef, cwd);
 *   <textarea value={draft} onChange={ac.bind.onChange} {...ac.bind} />
 *   {ac.menu}
 * 或直接看 composer.tsx（home-view / chat-view 共用）的接法——注意
 * `bind.onCompositionStart/End` 必须接上（理由见 useAutocomplete 里的 composingRef）。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CompletionData } from "@shared/ipc.ts";
import {
	applyCompletion,
	completionTrigger,
	filterItems,
	sectionize,
	type CompletionGroup,
	type CompletionItem,
} from "@shared/autocomplete.ts";
import { bareSkillName } from "@shared/skill-block.ts";
import { IconSkill } from "./icons.tsx";

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
		/** IME 组合起止：组合期间不重算候选（必须与 onChange 一起接上，否则守卫恒为 false）。 */
		readonly onCompositionStart: () => void;
		readonly onCompositionEnd: (e: React.CompositionEvent<HTMLTextAreaElement>) => void;
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

/** `/` 菜单的组标题。组序（技能在前、指令在后）由 shared/autocomplete.ts 的 sectionize 定。 */
const GROUP_TITLES: Readonly<Record<CompletionGroup, string>> = {
	skill: "技能",
	command: "指令",
};

function buildItems(data: CompletionData | undefined, kind: "file" | "command"): CompletionItem[] {
	if (data === undefined) return [];
	if (kind === "file") return data.files.map((p) => ({ label: p, insert: `@${p}` }));
	return data.commands.map((c) => {
		// 分组信息来自契约的 source，渲染层不按名字前缀猜类型。
		const group: CompletionGroup = c.source === "skill" ? "skill" : "command";
		return {
			label: `/${c.name}`,
			// 插入文本原样带上 daemon 给的前缀（技能是 `skill:<name>`）—— pi 只认 `/skill:` 前缀，
			// 分组只改呈现、不改语法。
			insert: `/${c.name}`,
			hint: c.description,
			group,
			// 技能项另带裸名：选中后它变成 chip（显示裸名），`/skill:` 前缀由发送时拼回。
			...(group === "skill" ? { skill: bareSkillName(c.name) } : {}),
		};
	});
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
	/**
	 * 团队成员候选（spec: add-team-foundations 批 8）：并入 @ 候选
	 * （与文件项同一过滤排序，成员项在前缀命中时自然靠前）。
	 * 由调用方从最近一张 team 卡派生；空数组/缺省 = 无团队，行为不变。
	 */
	memberItems: readonly CompletionItem[] = [],
	/**
	 * 选中技能项时的回调（技能**不进 textarea**，变成输入卡上的 chip）。
	 *
	 * 为什么技能与其它项走两条路：`/skill:docx` 是给 pi 看的命令语法，不是用户想看到的东西
	 * —— 插成文本，框里就是一串 `/skill:frontend-design` 纯文本（用户原话：「选择了为什么
	 * 还是纯文本」）。WorkBuddy 同口径：选中即一个 phrase/chip 块。技能名交给调用方存起来，
	 * 发送那一刻再拼回 `/skill:<name>`（shared/skill-block.ts 的 skillInvocationText）。
	 * 缺省（不传）时回退到旧的插文本行为。
	 */
	onPickSkill?: (name: string) => void,
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
			const items = filterItems(
				query.kind === "file"
					? [...memberItems, ...buildItems(data, "file")]
					: buildItems(data, "command"),
				query.query,
			);
			if (items.length === 0) {
				close();
				return;
			}
			setOpen({ query, items, active: 0, cursorPos: pos });
		},
		[data, memberItems, close],
	);

	/**
	 * 选中一项：替换触发片段为新文本，光标落在插入内容后。
	 *
	 * 技能项例外（见 onPickSkill）：不插文本，只把触发片段（用户敲的那半截 `/fron`）
	 * 从草稿里摘掉，技能名交给调用方存成 chip。
	 */
	const pick = useCallback(
		(item: CompletionItem) => {
			const s = openRef.current;
			if (s === undefined) return;
			if (item.skill !== undefined && onPickSkill !== undefined) {
				onPickSkill(item.skill);
				// 摘掉触发片段：`/` 命令的触发点固定在文本起始（completionTrigger 只认
				// 首字符是 `/`），所以留下的只有触发点之后、光标之后的那截尾巴。
				// 不走 applyCompletion：它固定补一个尾空格，而这里框里本来就该是空的。
				setValue(value.slice(0, s.query.start) + value.slice(s.cursorPos));
				close();
				// 与插文本那条路同样还焦点：选完技能接着写正文，不该再多点一下输入框。
				requestAnimationFrame(() => {
					const el = textareaRef.current;
					if (el === null) return;
					el.focus();
					const at = s.query.start;
					el.setSelectionRange(at, at);
				});
				return;
			}
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
		[value, setValue, close, textareaRef, onPickSkill],
	);
	const pickRef = useRef(pick);
	pickRef.current = pick;

	/**
	 * IME composition 守卫（抄 experts-view.tsx 的同款语义）：拼音候选期间不重算候选
	 * —— 候选串不是最终文本，边拼边过滤会让菜单随击键重建、条目不跳。
	 * 走 ref 不走 state：它在事件处理里同步读，不需要参与渲染。
	 */
	const composingRef = useRef(false);

	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			const el = e.target;
			setValue(el.value);
			// IME 守卫（与 experts-view.tsx 的 composingRef 同一先例、同一语义）：
			// 拼音候选串不是最终文本，组合期间每击键都 recompute 会让候选菜单反复重建、
			// 条目乱跳。组合结束（上屏）时用最终文本算一次（见 onCompositionEnd）。
			if (composingRef.current) return;
			recompute(el.value, el.selectionStart ?? el.value.length);
		},
		[setValue, recompute],
	);

	const onCompositionStart = useCallback(() => {
		composingRef.current = true;
	}, []);

	const onCompositionEnd = useCallback(
		(e: React.CompositionEvent<HTMLTextAreaElement>) => {
			composingRef.current = false;
			// 这里必算一次：Chromium 在 compositionend 之后补的那个 input 事件
			// 不一定带 isComposing=false，不能指望 onChange 兜住最后一次。
			const el = e.currentTarget;
			recompute(el.value, el.selectionStart ?? el.value.length);
		},
		[recompute],
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

	/**
	 * 渲染下拉：按组分节（空组不出标题），技能组带 IconSkill。
	 *
	 * `active` 仍是**横跨两组的单一扁平序号** —— 分节只是呈现，上下键因此天然跨组连续；
	 * 所以这里的 index 一路续着数，不能每组从 0 重开。
	 */
	const renderMenu = (state: OpenState): React.JSX.Element => {
		let index = -1;
		return (
			<div className="ac-menu" role="listbox">
				{sectionize(state.items).map((section) => (
					<div
						key={section.group ?? "plain"}
						className="ac-group"
						role="group"
						aria-label={section.group === undefined ? undefined : GROUP_TITLES[section.group]}
					>
						{section.group !== undefined && (
							// 组名已由容器的 aria-label 给出，标题行只做视觉，不重复播报。
							<div className="ac-group-title" aria-hidden="true">
								{GROUP_TITLES[section.group]}
							</div>
						)}
						{section.items.map((item) => {
							index += 1;
							const active = index === state.active;
							return (
								<button
									key={item.label}
									type="button"
									role="option"
									aria-selected={active}
									className={`ac-item${active ? " active" : ""}`}
									onMouseDown={(e) => {
										e.preventDefault(); // 保住 textarea 焦点，让 pick 里的 requestAnimationFrame 能正确放光标
										pickRef.current(item);
									}}
								>
									{item.group === "skill" && <IconSkill size={15} className="ac-icon" />}
									<span className="ac-label">{item.label}</span>
									{item.hint !== undefined && <span className="ac-hint">{item.hint}</span>}
								</button>
							);
						})}
					</div>
				))}
			</div>
		);
	};

	const menu = open === undefined ? null : renderMenu(open);

	return {
		bind: { onChange, onKeyDown, onSelect, onBlur, onCompositionStart, onCompositionEnd },
		menu,
		isOpen: open !== undefined,
	};
}
