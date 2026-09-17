/**
 * 技能的「用户级启用状态」——判定逻辑的单一出处。
 *
 * 为什么单独一个模块：启用过滤有三个消费方（提示词技能清单段、use_skill 的可加载集合、
 * `/` 菜单），它们必须**同源**（spec: 技能清单来源单一出口）——判定收成一个纯函数，
 * daemon 只在唯一出口调它，测试也能直接断言「同一份输入，三处得到同一集合」。
 *
 * **本文件必须保持零依赖（不 import pi / electron）**：core/preferences.ts 的读取层要
 * import 它做键名与取值校验，而 preferences 的契约是「纯 fs + JSON」——若这里拉进 pi，
 * 那条契约就被一次间接 import 悄悄破了。所以 token 相关的东西（要用 pi 的格式化器）
 * 放在 core/skills-cost.ts，不在这里。
 */

/**
 * `skillOverrides` 的取值。
 *
 * 键名与语义对齐 WorkBuddy 的 `skillOverrides`（四态），当前只实现 on / off 两态 ——
 * 「自动触发」这一个用户能理解、能预期后果的开关。将来加 `name-only` 等态是
 * **加成员**，键名与文件形状不变，零迁移（spec: 技能启用/停用）。
 *
 * `"on"` 与「键不存在」语义相同（都启用）：写入侧在开启时**删键**而不是写 `"on"`，
 * 让「缺省 = 启用」保持唯一表示，用户手改文件时也不会看到两套等价写法。
 */
export type SkillOverride = "on" | "off";

export type SkillOverrides = Readonly<Record<string, SkillOverride>>;

/**
 * 技能名规则。与 pi 的 `validateName`、core/skill-install.ts 的导入校验同一套
 * （小写字母 / 数字 / 连字符）——`skillOverrides` 的键是技能名，键名非法说明文件被手改过。
 */
export const SKILL_NAME_PATTERN = /^[a-z0-9-]+$/;

/** 该技能是否启用。缺省启用（`overrides` 里没有条目 = on）：老用户升级后行为不变。 */
export function isSkillEnabled(name: string, overrides: SkillOverrides | undefined): boolean {
	return overrides?.[name] !== "off";
}

/**
 * 启用过滤（三个消费方共用同一个判定）。只按名字过一层用户开关，
 * 不碰 frontmatter 的可见性字段 —— 那是作者声明，与用户开关各自生效、互不覆盖。
 */
export function filterEnabledSkills<T extends { readonly name: string }>(
	skills: readonly T[],
	overrides: SkillOverrides | undefined,
): T[] {
	return skills.filter((skill) => isSkillEnabled(skill.name, overrides));
}
