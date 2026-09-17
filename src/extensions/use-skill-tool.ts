/**
 * use_skill：技能加载工具（对标 WorkBuddy 的同名工具，机制证据见
 * docs/WorkBuddy-reference/.../ui-docs-viewer-*.js 的 `use_skill: object({ command })`
 * 与 lib-chat-ui 的 `tool.name.use_skill` = 「使用技能」、动作词「加载技能」）。
 *
 * 为什么要有它：pi 只有 `/skill:<name>` 一种技能展开路径
 * （dist/core/agent-session.js:983-1007 的 _expandSkillCommand），模型**自动**命中
 * 技能时没有任何工具可用 —— pi 的约定是让它用 read 去读 SKILL.md
 * （docs/skills.md:69）。那条路径在界面上只显示成一堆「读取文件」，用户看不出
 * 模型正在用哪个技能。本工具把这一步显式化：模型按技能名调用，卡片显示
 * 「加载技能 xxx」，上下文里拿到的则与手动 /skill: 展开完全同形。
 *
 * 三个设计点：
 *
 * 1. **同形**：返回文本与 pi 的 _expandSkillCommand 逐字同形（`<skill name location>`
 *    标签 + 「References are relative to <baseDir>」基准行 + 去 frontmatter 的正文）。
 *    同一份 SKILL.md 经手动与自动两条路径进上下文时形状必须一致，否则模型对
 *    技能内相对路径的解析基准会随路径漂移。
 *
 * 2. **入参叫 `command`**：WorkBuddy 的 use_skill schema 就是
 *    `{ command: "技能名称（不含参数）" }`，这里照用它的名字 —— 不只是为了同形，
 *    更因为 core/session-rebuild.ts 的 summarizeArgs 键优先级表里有 `command`：
 *    入参叫这个名字，卡片摘要自动就是技能名（「加载技能 docx」），不必为这张卡
 *    另开一条摘要通道。
 *
 * 3. **错误即 throw**：未知技能名、被用户停用的技能、模型不可见的技能一律抛错
 *    （pi 会标 isError 并把消息回给模型），错误文本里带当前可用的技能名清单供它自我纠正。
 *    不返回「好像失败了」的字符串 —— 那会让模型以为技能已加载，照着不存在的内容干活。
 *
 * 技能来源经**回调注入**（extensions 不许 import daemon，AGENTS.md §1）：daemon 把
 * 「当前会话可见的技能」传进来，与技能清单段同源（spec Requirement: 会话技能来源单一出口）。
 */

import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import {
	stripFrontmatter,
	type ExtensionAPI,
	type ExtensionFactory,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { declareReadOnlyTools } from "./permission-policy.ts";

/**
 * 会话可见的一个技能。extensions 只认这几个字段（daemon 的 SkillInfo 是超集，
 * 投影掉 origin / userInvocable）——工具不关心技能从哪来，只关心能不能加载。
 */
export interface UseSkillTarget {
	readonly name: string;
	readonly description: string;
	/** SKILL.md 的绝对路径。 */
	readonly filePath: string;
	/** frontmatter 的 disable-model-invocation：true = 模型不可自动加载。 */
	readonly disableModelInvocation: boolean;
	/**
	 * 用户级启停（`preferences.json` 的 `skillOverrides`，缺省启用）。
	 *
	 * 为什么注入的是**全量**（含停用的）而不是过滤后的集合：工具要能分辨三种拒绝理由 ——
	 * 「没这个技能」/「这个技能被用户在技能页停用了」/「作者声明仅限手动」。
	 * 只喂过滤后的集合，前两种会混成同一句「没有名为 X 的技能」，用户看到会以为技能丢了。
	 * 三处同源仍然成立：这里的 enabled 与清单段、`/` 菜单来自 daemon 的同一个过滤出口。
	 */
	readonly enabled: boolean;
}

export interface UseSkillToolOptions {
	/**
	 * 当前会话可见的**全量**技能集合（含被用户停用的，逐项带 `enabled`）。
	 * **每次调用现取**（不是注册时快照）：会话中途换绑专家后，工具看到的能力面要立刻
	 * 与提示词里的技能清单段一致。全量而非过滤后的理由见 `UseSkillTarget.enabled`。
	 */
	readonly resolveSkills: () => readonly UseSkillTarget[];
}

export function createUseSkillTool(options: UseSkillToolOptions): ExtensionFactory {
	// 权限档自声明（permission-policy 批注：编排类、无本地路径、无副作用）——
	// 入参只有一个技能名，没有任意路径；读的技能目录本就在资源目录的只读放行名单里。
	declareReadOnlyTools(["use_skill"]);
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "use_skill",
			label: "加载技能",
			description:
				"加载一个技能的完整说明（SKILL.md 正文）。任务命中技能清单（<available_skills>）里某个技能的描述时，先调用它拿到该技能的步骤、模板与规则，再动手 —— 清单里只有一行描述，照着那行做事会漏掉技能内的关键约定。",
			promptSnippet:
				"use_skill: 任务命中技能清单里某个技能时，用它加载该技能的完整说明（技能名取自 <available_skills> 的 <name>，不凭记忆拼）",
			promptGuidelines: [
				"技能名只能一字不差地取自技能清单 <available_skills> 里的 <name>；清单里没有的技能名不要调，也不要把用户的话当成技能名。",
				"命中技能的任务先 use_skill 加载，再按其步骤与模板执行；不要加载了却不用。",
				"用户手动 /skill:<name> 已经展开过正文的技能，不必再加载一次。",
			],
			parameters: Type.Object({
				command: Type.String({
					minLength: 1,
					description: "技能名（不含参数），取自技能清单里的 <name>，如 \"docx\"。",
				}),
			}),
			async execute(_toolCallId, params) {
				const skills = options.resolveSkills();
				// 只 trim 首尾空白：模型偶尔把名字带空格粘进来；大小写仍要求精确 ——
				// 宽容匹配（大小写/别名）会让模型以为名字可以随便写，清单也就白给了。
				const name = params.command.trim();
				const skill = skills.find((s) => s.name === name);
				if (skill === undefined) {
					/*
					 * 可用清单里**排除**两类：disable-model-invocation 的技能（清单段
					 * 本来就把它过滤掉了）与用户停用的技能。列一个加载不了的技能，
					 * 只会让模型照着再撞一次同样的错。
					 */
					const visible = skills
						.filter((s) => s.enabled && !s.disableModelInvocation)
						.map((s) => s.name);
					const available =
						visible.length === 0
							? "当前会话没有可自动加载的技能。"
							: `当前可用的技能：${visible.join("、")}。`;
					throw new Error(
						`没有名为「${name}」的技能。${available}技能名必须取自技能清单 <available_skills> 里的 <name>，不要凭记忆拼写。`,
					);
				}
				/*
				 * 停用与「作者声明仅限手动」是**两个原因**，文案必须分开 ——
				 * 用户看到的行动项完全不同：前者去技能页把开关打开，后者改 SKILL.md 也没用，
				 * 只能手动 /skill:name。混成一句会让用户走错方向。
				 * 先判停用：用户开关是他刚做的动作，也是唯一能在界面上解决的。
				 */
				if (!skill.enabled) {
					throw new Error(
						`技能「${name}」已在技能页被停用，不能自动加载 —— 到技能页把它重新打开即可（技能本身的 SKILL.md 没有被改过）。`,
					);
				}
				if (skill.disableModelInvocation) {
					throw new Error(
						`技能「${name}」声明了 disable-model-invocation: true，不能由模型自动加载 —— 它仅供用户手动 /skill:${name} 或其它技能按路径引用。`,
					);
				}
				// 读盘失败（技能文件被删/不可读）原样抛错：与未知技能同样是响亮失败，
				// 错误消息里的路径比任何降级文案都更有用。
				const body = stripFrontmatter(readFileSync(skill.filePath, "utf8")).trim();
				// 与 pi 的展开逐字同形；基准行取 dirname(filePath)，即 pi 的 Skill.baseDir。
				const baseDir = dirname(skill.filePath);
				return {
					content: [
						{
							type: "text" as const,
							text: `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${baseDir}.\n\n${body}\n</skill>`,
						},
					],
					details: { name: skill.name },
				};
			},
		});
	};
}
