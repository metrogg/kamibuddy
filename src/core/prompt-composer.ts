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

import {
	formatSkillsForPrompt,
	type BuildSystemPromptOptions,
} from "@earendil-works/pi-coding-agent";

/** 从 pi 的结构化选项里取出上下文组装还需要的那几块。 */
export type PromptContextOptions = Pick<
	BuildSystemPromptOptions,
	"contextFiles" | "toolSnippets" | "promptGuidelines"
>;

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
	/** pi 已经加载好的上下文文件 / 工具提示，拼回最终提示词。 */
	readonly piContext?: PromptContextOptions;
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
	const composed = filled.replace(/\n{3,}/g, "\n\n").trim();
	return appendPiContext(composed, input);
}

/**
 * 把 pi 已经算好的上下文文件与工具提示段拼回最终提示词。
 *
 * before_agent_start 的整体替换会让 pi 不再自动附加这些（system-prompt.ts
 * 的 customPrompt 分支也只处理 contextFiles / skills / cwd），而工具
 * snippet 与 guidelines 是我们自己的工具注册时提供的（extensions/*.ts），
 * 不拼回来模型就看不到「该在什么时候用哪个工具」。格式与 pi 的
 * buildSystemPrompt 对齐，避免同一份数据两处漂移。
 */
function appendPiContext(composed: string, input: ComposePromptInput): string {
	const sections: string[] = [];

	const contextFiles = input.piContext?.contextFiles ?? [];
	if (contextFiles.length > 0) {
		const blocks = contextFiles
			.map(
				({ path, content }) =>
					`<project_instructions path="${path}">\n${content}\n</project_instructions>`,
			)
			.join("\n\n");
		sections.push(
			`<project_context>\n\nProject-specific instructions and guidelines:\n\n${blocks}\n</project_context>`,
		);
	}

	const toolSnippets = input.piContext?.toolSnippets ?? {};
	const snippetEntries = Object.entries(toolSnippets).filter(
		([name, snippet]) => name !== "" && snippet !== "",
	);
	if (snippetEntries.length > 0) {
		sections.push(
			`Available tools:\n${snippetEntries
				.map(([name, snippet]) => `- ${name}: ${snippet}`)
				.join("\n")}`,
		);
	}

	const guidelines = (input.piContext?.promptGuidelines ?? []).filter((g) => g.trim() !== "");
	if (guidelines.length > 0) {
		sections.push(`Guidelines:\n${guidelines.map((g) => `- ${g}`).join("\n")}`);
	}

	return sections.length === 0 ? composed : `${composed}\n\n${sections.join("\n\n")}`;
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
