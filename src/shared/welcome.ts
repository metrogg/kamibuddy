/**
 * 首页预设（能力胶囊 + 最佳实践案例）的契约。
 *
 * 数据在 `resources/welcome/{chips,cases}.json`，由 daemon 读盘后随会话快照下发 ——
 * 加一个胶囊或一条案例只改数据，UI 与 daemon 零改动（AGENTS.md §3）。
 * 类型放 shared 是因为两端都要用：daemon 只负责搬运，renderer 负责渲染。
 *
 * 素材来源与置换说明见 `resources/welcome/README.md`（AGENTS.md §6）。
 */

/**
 * 一个能力胶囊（对标 WorkBuddy 首页输入框上方那一横条）。
 *
 * 两种来源（`chipKind`），区别只在「提示词从哪来」：
 *   - `playbook`：提示词列表 = 它名下的案例（cases.json 里 chipId 指向自己），
 *     WorkBuddy 的云端胶囊就是这样（胶囊 → 案例标题 → 案例提示词）；
 *   - `scene`：内联 `prompts`，WorkBuddy 的代码场景没有云端胶囊，
 *     提示词直接来自它的本地场景模板。
 */
export interface WelcomeChip {
	readonly id: string;
	/** 归属场景轴（`resources/scenes/<id>/`），只在该场景的首页出现。 */
	readonly scene: string;
	readonly label: string;
	readonly description: string;
	/** 图标键（`doc` / `chart` / …）：数据里不放组件，renderer 侧映射到具体图标。 */
	readonly icon: string;
	readonly chipKind: "playbook" | "scene";
	/** 仅 `chipKind === "scene"` 使用。 */
	readonly prompts?: readonly string[];
}

/** 一条最佳实践案例：卡片 + 胶囊下钻列表共用同一条数据。 */
export interface WelcomeCase {
	readonly id: string;
	/** 所属胶囊（`WelcomeChip.id`）。 */
	readonly chipId: string;
	readonly title: string;
	readonly subtitle: string;
	/** 点击卡片填进输入框的提示词（原文照搬，不改写）。 */
	readonly prompt: string;
	/** 封面图 URL（WorkBuddy 公开 CDN）；加载失败时 UI 回落图标底。 */
	readonly cover: string;
}

export interface WelcomePresets {
	readonly chips: readonly WelcomeChip[];
	readonly cases: readonly WelcomeCase[];
}
