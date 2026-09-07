/**
 * 提示词组装：场景骨架 + 模式行为段 + 技能清单 → 最终 systemPrompt。
 *
 * 纯函数，可单测。槽位是字面量替换，**不引模板引擎**（AGENTS.md §9）——
 * 需要循环/条件的那天再换，现在 20 行够用。
 *
 * 两条安全护栏：
 *   1. 骨架里出现**未支持的槽位** → 抛错。带着 {{xxx}} 空洞上线的提示词
 *      是最难排查的故障（模型会原样看到花括号）。
 *   2. 组装完成后若仍有残留槽位（比如模式正文里误写了 {{cwd}}）→ 抛错。
 *      正文是我们自己的资源文件，出现槽位就是笔误。
 */

import { formatSkillsForPrompt } from "@earendil-works/pi-coding-agent";

export interface SkillDescriptor {
	readonly name: string;
	readonly description: string;
	/** SKILL.md 的绝对路径 —— 模型用 read 工具按需加载全文就靠它。 */
	readonly filePath: string;
}

export interface ComposePromptInput {
	/** 场景骨架正文（含槽位）。 */
	readonly sceneBody: string;
	/** 交互模式行为段，填入 {{interaction}}。 */
	readonly modeBody: string;
	/** 技能清单段，填入 {{skills}}。空串表示无技能，对应行会被压平。 */
	readonly skillsSection: string;
	readonly cwd: string;
	/** 模型显示名。骨架未使用 {{model}} 时可省。 */
	readonly model?: string;
}

const SLOT = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;
/**
 * 残留检查用更宽的模式：任何 `{{...}}` 都不许活过组装。
 * 严格标识符之外的写法（`{{中文}}`、`{{a b}}`）不参与替换，但同样是笔误。
 */
const ANY_SLOT = /\{\{[^{}]*\}\}/g;

export function composePrompt(input: ComposePromptInput): string {
	const slots: Record<string, string> = {
		interaction: input.modeBody,
		skills: input.skillsSection,
		cwd: input.cwd,
		model: input.model ?? "",
	};

	const filled = input.sceneBody.replace(SLOT, (raw, name: string) => {
		const value = slots[name];
		if (value === undefined) {
			throw new Error(
				`提示词骨架包含未支持的槽位「${raw}」。支持的槽位：${Object.keys(slots).join(" / ")}`,
			);
		}
		return value;
	});

	const leftover = filled.match(ANY_SLOT);
	if (leftover !== null) {
		throw new Error(`组装后的提示词仍有残留槽位（${leftover.join("、")}）——骨架与模式正文里都不应出现 {{...}}`);
	}

	// 空槽位（如无技能）会留下连续空行，压平；trim 掉首尾。
	return filled.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * 技能清单段。无技能返回空串——骨架里 {{skills}} 所在行会被压平，零 token。
 *
 * 格式直接委托 pi 的 formatSkillsForPrompt（agentskills.io 规范的 XML 形态）：
 * 我们的 before_agent_start 整体替换让 pi 不再自动附加这段，但「模型如何理解
 * 技能清单」的格式决定权仍应归 pi——它升级格式（比如改调用约定）时我们零改动。
 */
export function formatSkillsSection(skills: readonly SkillDescriptor[]): string {
	if (skills.length === 0) return "";
	return formatSkillsForPrompt(skills as never[]).trim();
}
