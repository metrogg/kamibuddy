/**
 * skill_install：把模型产出在工作区的技能，装进用户技能目录，并打一份可分享的 zip。
 *
 * 为什么需要它（对标 WorkBuddy 的「创建技能」流程）：WorkBuddy 的 skill-creator
 * 直接把技能写进 `<configDir>/skills/`，写完即出现在技能管理面板并可立刻调用
 * （实测：回复「已创建并通过校验，已安装到用户级目录」+ 给出安装位置与触发方式，
 * 末尾附上打包好的 `<技能名>.zip`）。我们**不能照抄「直接写盘」**：权限门对
 * `<configDir>/skills` 只放开读、写一律拒（理由见 permission-policy.ts 阶段 1：
 * 技能正文即提示词，write/edit 篡改 = 提示注入面）。所以模型只能在**工作区**里
 * 产出技能目录，再经本工具落进用户技能目录 —— 这就把「模型创建」这条链路接到
 * 既有的受校验通道上了。
 *
 * 通道复用 `core/skill-install.ts` 的 importSkill：与技能页「导入技能」同一套关卡
 * （必须有 SKILL.md、name/description 齐全、名字合法、失败原子回滚），
 * 且带 `agentCreated` 标记 —— 只有模型自己装的技能，之后才允许被覆盖或删除
 * （对齐 WorkBuddy 的 `agent_created: true`）。
 * 不新开一条只有测试走得到的路（AGENTS.md §8）。
 *
 * 打包是标准收尾而不是附加功能：WorkBuddy 的 skill-creator Step 5 就是
 * `package_skill.py`，截图里那份 `hu-yan-luan-yu.zip` 也是这么来的。zip 落**工作区**
 * （唯一能经 present_files 交付的位置），交付仍由 present_files 负责 ——
 * 产物出口只有那一个（present-files.ts 文件头）。
 *
 * 错误即 throw（同 use_skill）：校验失败的原因（哪一行、哪一处）就是模型要改的东西，
 * 吞成「好像失败了」它只能瞎试。**打包失败例外**：技能此时已经装好了，
 * 报成一整次失败会让模型以为没装上 —— 如实说「装好了、打包失败 + 原始原因」。
 *
 * ── 模型体验契约（scripts/check-model-experience.ts 机械校验；改行为必须同步改这里）──
 * What the model sees: skill_install 的名称、description 与 sourcePath 入参的 schema；
 * 成功后返回三到四行文本（技能名 + 安装位置 + 触发方式 + zip 路径），失败时是 importSkill 的原始错误。
 * Token effect: 定义常驻；返回是常量级短文本（不像 use_skill 那样回正文），与技能大小无关。
 * KV Cache effect: 定义字面量会话内恒定 ⇒ 前缀稳定；装完技能会改变**此后**的清单段
 * （技能清单每轮现读），已在上下文里的历史不受影响。
 */

import { dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { SkillInfo } from "../shared/settings.ts";
import { Type } from "typebox";

export interface SkillInstallToolOptions {
	/**
	 * 安装入口（daemon 注入 `core/skill-install.ts` 的 importSkill，
	 * 并固定 `agentCreated: true`）。
	 * extensions 不许 import daemon（AGENTS.md §1），依赖一律回调注入。
	 */
	readonly installSkill: (sourcePath: string) => SkillInfo;
	/** 打包出口（`core/skill-pack.ts` 的 packSkillDir），返回 zip 字节数。 */
	readonly packSkill: (skillDir: string, outFile: string) => Promise<number>;
	/** 当前工作区；playground 等无工作区时为 undefined。 */
	readonly getWorkspaceDir: () => string | undefined;
}

export function createSkillInstallTool(options: SkillInstallToolOptions): ExtensionFactory {
	return (pi: ExtensionAPI): void => {
		pi.registerTool({
			name: "skill_install",
			label: "安装技能",
			description:
				"把工作区里做好的技能目录装进用户技能目录（跨工作区可用），装完即出现在技能页，并在工作区打出一份可分发的 zip。只在用户要求创建/更新技能、且技能文件已经写在工作区里之后调用。",
			promptSnippet:
				"skill_install: 技能在工作区里写好后用它安装（入参是那个技能目录的绝对路径或它的 SKILL.md），装完再用 present_files 交付它打好的 zip",
			promptGuidelines: [
				"入参是工作区里那个技能目录的路径（或它的 SKILL.md 文件路径），不要传还没写好的路径、也不要传技能名。",
				"装完把返回里的 zip 路径交给 present_files 交付给用户（分享/备份用），并把技能名、安装位置、触发方式一并转述。",
				"安装失败时把工具返回的原始错误按原样转述给用户，并指出要改 SKILL.md 的哪一处；不要只说「安装失败了」。",
				"同名技能：模型自己创建过的可直接覆盖（改技能就是重装一次）；不是模型创建的会被拒 —— 那时请用户到技能页「打开技能目录」处理。",
			],
			parameters: Type.Object({
				sourcePath: Type.String({
					minLength: 1,
					description: "工作区里含 SKILL.md 的技能目录绝对路径，或该 SKILL.md 的绝对路径。",
				}),
			}),
			async execute(_toolCallId, params) {
				// importSkill 内部 resolve()，相对路径也能用；这里不 trim 之外的宽容处理 ——
				// 校验失败的错误文本本身就是给模型看的修正指引。
				const skill = options.installSkill(params.sourcePath.trim());
				const lines = [
					`技能「${skill.name}」已安装到用户技能目录：${skill.filePath}`,
					`触发方式：对话里 /skill:${skill.name}，或让模型按描述自动加载（use_skill "${skill.name}"）。`,
					"它已出现在技能页的列表里，用户可在那里停用它；下一轮对话即生效。",
				];

				const workspaceDir = options.getWorkspaceDir();
				let zipPath: string | undefined;
				if (workspaceDir === undefined) {
					// 没有工作区就没地方放 zip（present_files 只认工作区内的路径）——
					// 如实说明，不让模型以为手上有份可交付的包。
					lines.push("本次会话没有工作区，未生成可分享的 zip；技能本身已装好。");
				} else {
					zipPath = join(workspaceDir, `${skill.name}.zip`);
					try {
						const bytes = await options.packSkill(dirname(skill.filePath), zipPath);
						lines.push(`可分发的打包已生成：${zipPath}（${bytes} 字节）—— 用 present_files 交付它。`);
					} catch (error) {
						const reason = error instanceof Error ? error.message : String(error);
						lines.push(`技能已装好，但打包 zip 失败：${reason}`);
						zipPath = undefined;
					}
				}

				return {
					content: [{ type: "text" as const, text: lines.join("\n") }],
					details: { name: skill.name, filePath: skill.filePath, ...(zipPath === undefined ? {} : { zipPath }) },
				};
			},
		});
	};
}
