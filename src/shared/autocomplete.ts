/**
 * 输入框补全的触发与过滤逻辑。纯函数，无 React / Node 依赖，可单测。
 *
 * 为什么放 shared/：renderer 用它做下拉（@ 文件、/ 命令），
 * 测试与 UI 用同一份解析，避免「UI 触发时机」与「实际解析」漂移。
 *
 * 语义对标 pi-tui 的 autocomplete，但只取我们需要的子集：
 *   - `@` → 文件引用（当前工作空间内）。触发条件是「@ 在行首或前面是空白」，
 *     避免把邮箱、代码里的 @decorator 当成补全触发。
 *   - `/` → 命令。只在**整段文本的第一个字符**是 / 时触发（pi 的
 *     prompt 也只把「/ 开头的文本」当命令，中间出现的 / 是文件路径）。
 */

/** 一次补全请求：光标前的待匹配片段 + 它的起始下标（替换时用）。 */
export interface CompletionQuery {
	/** 触发类型。 */
	readonly kind: "file" | "command";
	/** 用户已输入的待匹配文本（不含触发字符）。 */
	readonly query: string;
	/** 触发字符在原文本中的下标，applyCompletion 用它定位替换范围。 */
	readonly start: number;
}

/**
 * 补全项分组：`/` 菜单的两节。
 *
 * 取值由 IPC 契约的 `CommandItem.source` 派生（`skill` → `skill`；`template` / `builtin` →
 * `command`）—— 技能项与模板项在 label 上都只是一个 `/` 开头的名字，渲染层无从分辨类型，
 * 所以分组必须是数据自带的，不许在 UI 里按名字前缀猜。
 */
export type CompletionGroup = "skill" | "command";

/** 一条补全项。label 用于显示，insert 用于替换进输入框。 */
export interface CompletionItem {
	readonly label: string;
	readonly insert: string;
	/** 副标题（命令的 description、文件的目录），可选。 */
	readonly hint?: string;
	/** 所属分组。@ 文件候选不带它（文件没有分组概念）。 */
	readonly group?: CompletionGroup;
	/**
	 * 技能项的**裸技能名**（`/skill:` 命名空间前缀已去掉），如 `docx`。
	 *
	 * 只有 `group === "skill"` 的项有值。选中技能时输入卡不插文本、而是把它变成一枚
	 * chip：chip 上要显示「选中的是什么」（裸名），发送时才拼回 pi 认的
	 * `/skill:<name>` 语法（shared/skill-block.ts 的 skillInvocationText）。
	 * 两个用途都需要裸名，所以随项带出来，不在渲染层反解 label。
	 */
	readonly skill?: string;
}

/** 一页补全的一节。空节不产出（菜单不为空组渲染标题）。 */
export interface CompletionSection {
	/** undefined = 无标题节，即未声明分组的项（@ 文件候选）。 */
	readonly group: CompletionGroup | undefined;
	readonly items: readonly CompletionItem[];
}

/** 组序：技能在前、指令在后（WorkBuddy 的 `/` 面板同序）。 */
const GROUP_ORDER: readonly CompletionGroup[] = ["skill", "command"];

/** 光标位置。textarea 是单值字符串，用 selectionStart 一个下标即可。 */
export interface Cursor {
	readonly text: string;
	readonly position: number;
}

/** 判断一个字符是不是「@ 前面允许出现的分隔」。 */
function isBoundary(ch: string | undefined): boolean {
	return ch === undefined || ch === " " || ch === "\t" || ch === "\n";
}

/**
 * 从光标前的文本解析出补全请求。返回 undefined 表示当前不该弹补全。
 *
 * 只看光标**之前**的文本（用户在中间打字时，光标后的内容不影响触发）。
 */
export function completionTrigger(cursor: Cursor): CompletionQuery | undefined {
	const before = cursor.text.slice(0, cursor.position);

	// `/` 命令：仅当整段文本第一个字符是 / 时。正则与 pi 的 expandPromptTemplate 对齐。
	if (before.startsWith("/")) {
		const body = before.slice(1);
		// 命令名里已含空格（开始输参数了）就不再补命令名。
		if (/[\s]/.test(body)) return undefined;
		return { kind: "command", query: body, start: 0 };
	}

	// `@` 文件：取光标前最后一个 @，要求它在行首或前面是空白，且 @ 后无空白。
	const at = before.lastIndexOf("@");
	if (at === -1) return undefined;
	if (!isBoundary(before[at - 1])) return undefined;
	const query = before.slice(at + 1);
	if (/[\s]/.test(query)) return undefined;
	return { kind: "file", query, start: at };
}

/**
 * 用补全项替换触发片段，返回新文本与新的光标位置。
 *
 * 统一在插入内容后补一个空格，让光标落在可继续输入的位置
 * （pi-tui 对文件也是这么做的）。
 */
export function applyCompletion(
	cursor: Cursor,
	query: CompletionQuery,
	item: CompletionItem,
): Cursor {
	const before = cursor.text.slice(0, query.start);
	const after = cursor.text.slice(cursor.position);
	const inserted = before + item.insert + " ";
	return { text: inserted + after, position: inserted.length };
}

/**
 * 子串过滤 + 简单打分排序。返回最靠前的一页。
 *
 * 不引模糊匹配库（AGENTS.md 不引无谓依赖）：办公场景的文件/命令量小，
 * 子串 + 「前缀命中优先、命中位置靠前优先」的排序已够用。
 */
export function filterItems(
	items: readonly CompletionItem[],
	query: string,
	limit = 8,
): readonly CompletionItem[] {
	const q = query.trim().toLowerCase();
	if (q === "") return items.slice(0, limit);

	const scored: Array<{ item: CompletionItem; score: number }> = [];
	for (const item of items) {
		const label = item.label.toLowerCase();
		const at = label.indexOf(q);
		if (at === -1) continue;
		// 前缀命中最优；其次命中位置越靠前越好；再按长度短的优先（更精确）。
		const score = (at === 0 ? 0 : 100) + at + label.length / 100;
		scored.push({ item, score });
	}
	return scored
		.sort((a, b) => a.score - b.score)
		.slice(0, limit)
		.map((s) => s.item);
}

/**
 * 把（过滤排序后的）补全项切成菜单要的分节，并按组序重排。
 *
 * 为什么重排必须在纯逻辑层：`filterItems` 的打分是**全表**排序 —— 一个命中更好的模板项
 * 完全可能排在技能项前面，组序（技能恒在前）就在那一刻丢了。所以「先过滤、再分节」是
 * 一条完整的流水线，分节必须与过滤同处一个可单测的纯函数里；渲染层只管画标题与图标。
 * 组内保持 `filterItems` 给的相对顺序（打分仍然决定组内次序）。
 */
export function sectionize(items: readonly CompletionItem[]): readonly CompletionSection[] {
	const sections: CompletionSection[] = [];
	for (const group of GROUP_ORDER) {
		const grouped = items.filter((item) => item.group === group);
		if (grouped.length > 0) sections.push({ group, items: grouped });
	}
	// 未分组的项（@ 文件候选）合成一节排在末尾。@ 与 / 不会同时出现（触发字符只有一个），
	// 这条只是让两种 kind 共用同一套渲染路径。
	const rest = items.filter((item) => item.group === undefined);
	if (rest.length > 0) sections.push({ group: undefined, items: rest });
	return sections;
}
