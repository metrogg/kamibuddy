/**
 * 技能清单段的**常驻成本**口径：token 估算 + 超阈值告警。
 *
 * 为什么和 skill-status.ts 分开：那个文件必须零依赖（core/preferences.ts 要 import 它，
 * preferences 的契约是纯 fs + JSON）；而算 token 必须调 pi 的 formatSkillsSection，
 * 一 import 就把 pi 拉进依赖图。两件事的理由不同，故分开。
 *
 * 成本必须用**与真实注入同一份组装逻辑**（formatSkillsSection + estimateTokens）：
 * 渲染层另算一套的话，技能页显示的数字会和模型实际收到的清单段越走越远。
 *
 * 为什么是 async：formatSkillsSection 首用时才动态装配 pi（见 prompt-composer.ts），
 * 而本函数只在打开技能页 / 切开关时跑，不在 daemon 的启动关键路径上。
 */

import { estimateTokens } from "./observability.ts";
import { formatSkillsSection, type SkillDescriptor } from "./prompt-composer.ts";

/**
 * 技能清单段的常驻 token 警戒线。
 *
 * 取值理由：
 *   - **按 token 而不是按技能个数**。WorkBuddy 的告警是「80 个技能」，那是它内置技能
 *     多而杂（含大量云服务/站点类）时的经验值；我们的技能描述短、清单段体量小得多，
 *     用同一套个数阈值会永远不触发。清单段的真实成本是 token，就按 token 报警。
 *   - **4000 ≈ 200k 上下文窗口的 2%**。每轮对话都要付这笔常驻成本（不是一次性），
 *     2% 是「还没挤到主线，但已经值得看一眼」的位置；超过就提示用户停用不常用的。
 *
 * **实测**（本文件落地时，内置技能 5 个：docx / frontend-design / meeting-notes /
 * skill-creator / web-interface-guidelines，用户技能目录为空）：
 * 清单段 1946 字符 → **870 token**。距 4000 还有 4 倍余量 —— 这是刻意的：
 * 用户装到几十个技能才该被提醒，而不是装了 3 个就天天看见黄条。
 * 技能是用户可自由增加的，这个数字会随装机量变。
 */
export const SKILLS_TOKEN_WARNING_THRESHOLD = 4000;

/**
 * 超阈值提示文案。返回 undefined = 未超（技能页据此不渲染提示条）。
 * 阈值可注入：测试用小阈值触发，不必真造 4000 token 的技能。
 */
export function skillsCostWarning(
	tokens: number,
	threshold: number = SKILLS_TOKEN_WARNING_THRESHOLD,
): string | undefined {
	if (tokens <= threshold) return undefined;
	return (
		`技能清单已常驻约 ${tokens} token，超过 ${threshold} 的警戒线（超出 ${tokens - threshold}）` +
		"——每轮对话都要付这笔成本，建议在下面停用不常用的技能。"
	);
}

/** 技能清单段的成本快照（技能页顶部那行 + 超阈值提示的数据源）。 */
export interface SkillsCost {
	/** 已启用技能数（**开关口径**：含声明了 disable-model-invocation、不进清单段的技能）。 */
	readonly enabledCount: number;
	/**
	 * 技能清单段在系统提示词里的常驻 token 估算。口径 = 与真实注入**同一份组装逻辑**
	 * （formatSkillsSection + estimateTokens），故它只算真正进清单段的技能 ——
	 * disable-model-invocation 的技能被 pi 的格式化器剔掉，不计入。
	 * 不是整条提示词的 token（那是诊断页的 systemTokens）。
	 */
	readonly skillsTokens: number;
	readonly warning: string | undefined;
}

/**
 * 算一份成本快照。入参是**已启用**技能的描述符，与 daemon 注入模型的那批同形 ——
 * 过滤与估算分在两处做就会漂移，所以两者都收在这个模块的调用约定里。
 */
export async function computeSkillsCost(
	enabled: readonly SkillDescriptor[],
	threshold: number = SKILLS_TOKEN_WARNING_THRESHOLD,
): Promise<SkillsCost> {
	const skillsTokens = estimateTokens(await formatSkillsSection(enabled));
	return {
		enabledCount: enabled.length,
		skillsTokens,
		warning: skillsCostWarning(skillsTokens, threshold),
	};
}
