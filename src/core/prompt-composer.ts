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
import type { ExpertDefinition } from "./experts.ts";

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

/**
 * expert 模式绑定的人格（resources/experts/<name>.md 的展示字段 + 正文全文）。
 * 与 ExpertDefinition 分开定义：compose 只需要注入所需的三块，
 * 不关心 name/description 这些加载层字段。
 */
export interface ExpertPersona {
	readonly displayName: string;
	readonly profession: string;
	readonly body: string;
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
	/**
	 * expert 模式绑定的人格。提供时注入「当前专家」人格段 +
	 * 末尾 <current-expert> 钉住段（见 composePrompt 内的注释）。
	 * 非 expert 模式缺省；expert 模式下由 requireExpertPersona 保证必有值。
	 */
	readonly expert?: ExpertPersona;
	/** pi 已经加载好的上下文文件 / 工具提示，拼回最终提示词。 */
	readonly piContext?: PromptContextOptions;
	/**
	 * 环境块取数的时刻，缺省 `new Date()`。可注入是为了纯函数可测：
	 * 固定 now 才能断言环境块的完整文本。
	 */
	readonly now?: Date;
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
	/*
	 * expert 人格段：接在骨架之后（WorkBuddy PluginAgentPrompt 槽的等价物 ——
	 * 主提示是通用 OS，专家 = OS + 人格 APP）。场景骨架照常使用：
	 * 专家与场景轴的联动 v1 不做（spec: add-expert-mode 声明），骨架即通用骨架。
	 */
	const withPersona =
		input.expert === undefined ? composed : `${composed}\n\n${formatExpertPersona(input.expert)}`;
	// 环境块放整个提示词的**末尾**：系统提示词前缀稳定利于 provider 前缀缓存
	// （前面各段同分钟内字节一致，变化的只有最后一小段）。
	const base = `${appendPiContext(withPersona, input)}\n\n${formatRuntimeTime(input.now ?? new Date())}`;
	/*
	 * <current-expert> 钉住段放最末（WorkBuddy CurrentExpertReminderSection 的
	 * 同款防漂移：多轮对话后模型会忘记自己的专家身份，它每轮 user-context 钉一次）。
	 * v1 没有用户消息级注入机制（WorkBuddy 的 composeUserPrompt），钉住段随每轮
	 * 重组的系统提示词落在离对话历史最近的位置 —— 同一会话内它是稳定文本，
	 * 不破坏上面的前缀缓存口径。
	 */
	return input.expert === undefined
		? base
		: `${base}\n\n<current-expert>${input.expert.displayName}</current-expert>`;
}

/** 「当前专家」人格段：身份一行 + 正文全文（人格本体）。 */
function formatExpertPersona(expert: ExpertPersona): string {
	return `## 当前专家\n\n你当前的专家身份：${expert.displayName}（${expert.profession}）。\n\n${expert.body.trim()}`;
}

/**
 * expert 模式的人格解析：按 expertId 从专家库取出注入所需的人格段。
 *
 * 两个抛错都是「不可达防御」：
 *   - expertId 缺失 —— 模式切换单入口（daemon 的 applyInteraction）已保证
 *     进 expert 模式必带专家，这里炸说明出现了绕过单入口的调用路径；
 *   - 专家不在库中 —— 选择时（setExpert）已校验过存在，但用户级专家文件
 *     可能被手删，恢复会话后 state 与专家库漂移只能在这一刻发现。
 * 没有人格的 expert 提示词是「自称专家却没有人格」的错误身份 —— 响亮失败好过静默上线。
 */
export function requireExpertPersona(
	experts: readonly ExpertDefinition[],
	expertId: string | undefined,
): ExpertPersona {
	if (expertId === undefined) {
		throw new Error("expert 模式必须绑定专家（expertId 缺失）");
	}
	const found = experts.find((e) => e.name === expertId);
	if (found === undefined) {
		throw new Error(`专家「${expertId}」不在专家库中（可能已被删除或改名）`);
	}
	return { displayName: found.displayName, profession: found.profession, body: found.body };
}

/**
 * 运行时环境块：本地日期 + 分钟级时刻 + 星期 + IANA 时区名 + GMT 偏移。
 *
 * pi 不注入任何日期时间，模型对「现在」零感知 —— 这一行是它唯一的时间来源。
 *
 * 为什么只到分钟级：秒级会让每轮重组的 systemPrompt 都不同，炸 provider 的
 * 提示词缓存；分钟级下同一 run 内连续模型调用通常落在同一分钟、字节一致，
 * 缓存照常命中，而时间显示对「现在几点」这类问题分钟精度已够用。
 *
 * 格式自创（合规红线：不抄 WorkBuddy 的 <env> 措辞）。
 */
export function formatRuntimeTime(now: Date): string {
	// en-US 只为拿到英文星期名与数字；日期顺序自己从 parts 重组为 YYYY-MM-DD。
	// hourCycle h23：避免某些引擎 hour12:false 下午夜给出 "24"。
	const parts = new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
		weekday: "long",
	}).formatToParts(now);
	const get = (type: Intl.DateTimeFormatPartTypes): string =>
		parts.find((p) => p.type === type)?.value ?? "";
	const date = `${get("year")}-${get("month")}-${get("day")}`;
	const time = `${get("hour")}:${get("minute")}`;

	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	// getTimezoneOffset 与直觉相反：东八区返回 -480，取负即「相对 UTC 快多少分钟」。
	const offsetMin = -now.getTimezoneOffset();
	const sign = offsetMin >= 0 ? "+" : "-";
	const absMin = Math.abs(offsetMin);
	const offsetHours = Math.floor(absMin / 60);
	const offsetRestMin = absMin % 60;
	// 半小时时区（如印度 GMT+5:30）分钟部分必须保留，整时区则不赘述 :00。
	const gmt =
		offsetRestMin === 0
			? `GMT${sign}${offsetHours}`
			: `GMT${sign}${offsetHours}:${String(offsetRestMin).padStart(2, "0")}`;

	return `Current time: ${date} ${time} (${get("weekday")}, ${gmt}, ${timeZone})`;
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
function appendPiContext(composed: string, input: { readonly piContext?: PromptContextOptions }): string {
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

export interface ComposeSubagentPromptInput {
	/** 子代理定义正文（resources/agents/<name>.md 的 body）——提示词主体。 */
	readonly agentBody: string;
	readonly cwd: string;
	/** pi 已经加载好的上下文文件 / 工具提示，拼回最终提示词。 */
	readonly piContext?: PromptContextOptions;
	/** 环境块取数时刻，可注入是为了纯函数可测（同 composePrompt）。 */
	readonly now?: Date;
}

/**
 * 子代理会话的提示词组装：agent.body 为主体 + 工作目录 + pi 上下文 + 时间块。
 *
 * 为什么不走 composePrompt 的场景×模式双轴：双轴回答的是「KamiBuddy 这个产品
 * 在什么场景下以什么交互方式工作」，而子代理的身份由 agent 定义自己完整声明
 * （scout 是侦察员、reviewer 是评审员，都不是「办公助手」）——套场景骨架会把
 * 产品身份灌进子代理，身份冲突且浪费 token。技能段同理不注入：子代理的
 * 能力面由自己的 tools 白名单界定，与主会话安装的技能无关。
 * 但工作目录、pi 的上下文（工具 snippet / guidelines / 项目指令文件）与
 * 时间块仍是必需品——没有它们模型不知道自己在哪个目录工作、工具该怎么用。
 */
export function composeSubagentPrompt(input: ComposeSubagentPromptInput): string {
	const composed = `${input.agentBody.trim()}\n\n当前工作目录：${input.cwd}`;
	return `${appendPiContext(composed, input)}\n\n${formatRuntimeTime(input.now ?? new Date())}`;
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
