/**
 * skill_uninstall：删掉一个**模型自己创建过**的技能。
 *
 * 为什么要有它（对标 WorkBuddy 的 `skill_manage(action="delete")`）：那条链路里
 * 「改/删自己建的技能」是同一个能力的两半 —— skill-creator 的 SKILL.md 只教怎么造，
 * 收回与修订由 `skill_manage` 按 `agent_created` 判定放行。我们这边「改」= 用
 * skill_install 覆盖重装（见 core/skill-install.ts），「删」需要单独一个动作。
 *
 * **只允许删模型自建的**（sidecar 的 `agentCreated` 标记，由 skill_install 写入）：
 * 内置 / 市场安装 / 用户手工放置的技能一律拒 —— 那是用户的东西，删不删由用户在技能页定。
 * 判定放在 core（removeAgentSkill），工具只负责把拒绝理由原样转出去。
 *
 * 为什么不复用「技能页删除」通道：界面目前只有导入与启停开关，删除一直是
 * 「打开技能目录自己删」；模型侧要的是「按名字删」，与界面无关（同 skill_install
 * 与技能页导入的关系：共用 core 的关卡，不共用入口）。
 *
 * 权限档登记为「改变应用自身数据」= 询问（permission-policy 的 APP_DATA_MUTATING）——
 * 弹窗就是 WorkBuddy 要求的「先跟用户确认」。
 *
 * ── 模型体验契约（scripts/check-model-experience.ts 机械校验；改行为必须同步改这里）──
 * What the model sees: skill_uninstall 的名称、description 与 name 入参的 schema；
 * 成功后返回一行文本（技能名 + 删掉的目录），失败时是 removeAgentSkill 的原始错误。
 * Token effect: 定义常驻；返回常量级短文本，与技能大小无关。
 * KV Cache effect: 定义字面量会话内恒定 ⇒ 前缀稳定；删掉技能会改变**此后**的清单段
 * （技能清单每轮现读），已在上下文里的历史不受影响。
 */

import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export interface SkillUninstallToolOptions {
	/**
	 * 删除入口（daemon 注入 `core/skill-install.ts` 的 removeAgentSkill）。
	 * extensions 不许 import daemon（AGENTS.md §1），依赖一律回调注入。
	 */
	readonly removeSkill: (name: string) => { readonly name: string; readonly dir: string };
}

export function createSkillUninstallTool(options: SkillUninstallToolOptions): ExtensionFactory {
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "skill_uninstall",
			label: "删除技能",
			description:
				"删除一个由模型自己创建的技能（此前用 skill_install 装上的）。只在用户明确要求删除某个技能时调用；内置、市场安装与用户手工放置的技能会被拒，那些要用户自己在技能页处理。",
			promptSnippet: "skill_uninstall: 用户要求删掉某个技能时用它（入参是技能名）",
			promptGuidelines: [
				"只在用户明确说要删掉某个技能时调用，不要为了「清理」自作主张删。",
				"入参是 frontmatter 里的 name（小写字母/数字/连字符），不是技能目录的路径。",
				"被拒时把原始错误原样转述：它要么说这个技能不是模型创建的（要用户自己去技能页处理），要么说这个名字不存在。",
			],
			parameters: Type.Object({
				name: Type.String({
					minLength: 1,
					description: "要删除的技能名（SKILL.md frontmatter 里的 name，如 weekly-report）。",
				}),
			}),
			async execute(_toolCallId, params) {
				const removed = options.removeSkill(params.name.trim());
				return {
					content: [
						{
							type: "text" as const,
							text: `技能「${removed.name}」已删除：${removed.dir}\n它已从技能页列表与 / 菜单里消失；下一轮对话的清单段不再包含它。`,
						},
					],
					details: { name: removed.name, dir: removed.dir },
				};
			},
		});
	};
}
