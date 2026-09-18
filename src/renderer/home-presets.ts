/**
 * 首页预设的选取逻辑（纯函数，无 React/DOM）。
 *
 * 这一层是本次「照搬 WorkBuddy 首页」的行为契约：哪个胶囊显示哪些提示词、
 * 案例卡片按胶囊怎么过滤、翻页翻到哪几张。放组件里就得起 DOM 才能验，
 * 抽出来才能钉住（对齐 WorkBuddy 的胶囊 → 列表 → 提示词三级语义）。
 * 数据形状见 shared/welcome.ts，来源见 resources/welcome/README.md。
 */

import type { WelcomeCase, WelcomeChip } from "@shared/welcome.ts";

/** 胶囊下钻列表的一项。 */
export interface PresetItem {
	readonly key: string;
	/** playbook 胶囊用案例标题；scene 胶囊的提示词没有标题（WorkBuddy 同样只有原文）。 */
	readonly title: string | undefined;
	readonly prompt: string;
}

/** 当前场景下的胶囊（胶囊按场景轴归属，切场景即换一横条）。 */
export function chipsForScene(
	chips: readonly WelcomeChip[],
	sceneId: string,
): readonly WelcomeChip[] {
	return chips.filter((chip) => chip.scene === sceneId);
}

/**
 * 胶囊下钻列表的内容。
 *
 *   - playbook：该胶囊名下的案例（标题 + 提示词）——WorkBuddy 的云端胶囊就是这样，
 *     胶囊点开就是它那批案例；因此它和下方卡片共用同一份数据，不会漂移。
 *   - scene：内联提示词原文（WorkBuddy 的代码场景来自本地场景模板，没有标题）。
 */
export function itemsForChip(
	chip: WelcomeChip,
	cases: readonly WelcomeCase[],
): readonly PresetItem[] {
	if (chip.chipKind === "scene") {
		return (chip.prompts ?? []).map((prompt, index) => ({
			key: `${chip.id}:${index}`,
			title: undefined,
			prompt,
		}));
	}
	return cases
		.filter((item) => item.chipId === chip.id)
		.map((item) => ({ key: item.id, title: item.title, prompt: item.prompt }));
}

/** 卡片列表：选中胶囊时只留它的案例，未选中时是全部（= WorkBuddy 的默认案例组）。 */
export function casesForChip(
	cases: readonly WelcomeCase[],
	chipId: string | undefined,
): readonly WelcomeCase[] {
	return chipId === undefined ? cases : cases.filter((item) => item.chipId === chipId);
}

/**
 * 当前场景可见的案例：案例跟着它所属的胶囊走（胶囊归属场景），
 * 否则在代码场景下会看到日常办公的案例。
 */
export function casesForScene(
	cases: readonly WelcomeCase[],
	chips: readonly WelcomeChip[],
): readonly WelcomeCase[] {
	const ids = new Set(chips.map((chip) => chip.id));
	return cases.filter((item) => ids.has(item.chipId));
}

/**
 * 「换一批」：从 offset 起取 size 条，不足则整体环绕。
 *
 * 环绕而不是「取不满就少给」：卡片区高度固定，页数不足时最后一批会塌成半行。
 * 取模索引在 noUncheckedIndexedAccess 下返回 T|undefined，这里统一收窄。
 */
export function page<T>(items: readonly T[], offset: number, size: number): readonly T[] {
	if (items.length === 0) return [];
	return Array.from(
		{ length: Math.min(size, items.length) },
		(_, i) => items[(offset + i) % items.length],
	).filter((item): item is T => item !== undefined);
}
