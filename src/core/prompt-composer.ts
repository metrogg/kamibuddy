/**
 * 提示词组装：场景骨架 + 片段 + 专家人格（前部槽位）+ 模式行为段 + 回复风格
 * + 技能清单 → 最终 systemPrompt。
 *
 * 纯函数，可单测。**不引模板引擎**（AGENTS.md §9）——include 与槽位都是字面量
 * 替换；include 机制对应 WorkBuddy nunjucks 的 {% include %}，但只实现我们用到的
 * 子集（递归展开 / 环检测 / 深度上限），需要循环/条件的那天再换引擎。
 *
 * 组装分两个阶段，顺序不可颠倒（片段里也可以写槽位）：
 *   1. 片段展开：`{{> name}}` 由 input.resolveFragment 注入内容（composer 不读盘，
 *      loader 层负责把 resources/prompts/fragments/ 映射成这个回调）。递归展开；
 *      片段缺失 / 成环 / 超过 8 层 / 骨架含 {{> }} 却没给 resolveFragment → 一律抛错。
 *   2. 槽位替换：{{interaction}} / {{skills}}。
 *
 * 三条安全护栏（同一哲学：不静默上线带空洞的提示词——带着 {{xxx}} 空洞上线的
 * 提示词是最难排查的故障，模型会原样看到花括号）：
 *   1. 骨架里出现**未支持的槽位** → 抛错；
 *   2. 组装完成后仍有残留 {{...}}（模式/片段正文里的笔误、{{> 的残次写法）→ 抛错；
 *   3. 片段缺失 / 成环 / 超深 / 无 resolveFragment → 抛错。
 *
 * **哪些内容禁止进系统提示词**（本文件最重要的一条纪律，spec: stabilize-prompt-prefix）：
 * provider 的前缀缓存比的是最长公共前缀，而系统提示词每轮重组、又位于整段对话历史
 * 之前 —— 里面任何一处逐轮会变的字节都会让它**之后的一切（含整段历史）**失配。
 * 于是「会话内字节稳定」是系统提示词的硬要求：逐轮/逐 run 可能变化的事实一律走
 * append-only 的消息注入（落在对话历史之后），一律不进这里。
 *
 * 为什么路线是「字节稳定」而不是 pi 的分段 patch：发布依赖
 * @earendil-works/pi-coding-agent@0.85.1 的 BuildSystemPromptOptions **没有**
 * sections / forceSystemPrompt，emitBeforeAgentStart 只认 handler 返回的
 * systemPrompt 字符串（整串替换）—— 没有 diff 可走（spec.md 末尾
 * 「探针结论（实测）」①）。将来升级到带 sections 的版本再评估声明式分段。
 *
 * 注入的两条路径按机制分工，同一类事实只有一个来源：
 *   - 三层记忆内容（core/memory.ts buildMemorySection，模型自己会写，留在提示词里
 *     等于每轮自伤）+ 个性化（用户改一次设置就变）→ 本文件的 formatRuntimeContext，
 *     经 extensions/prompt-switch.ts 的 `context` 事件每请求注入（不落盘）；
 *   - 运行时间 → session-host.ts 的 hidden context `current_time`（formatRunTime，
 *     run 开始时冻结、data-role=additional-data 可整体剥离，见
 *     shared/hidden-context.ts）。**时间只有这一处**：注入块里不再带时间，
 *     两个来源并存时值会不一致（一个 run 冻结、一个每请求刷新）。
 *
 * 同理**随机器变的事实不进系统提示词**：托管 Python 解释器的绝对路径（它随
 * homedir / 安装位置 / `HTML_TO_DOCX_VENV` 变，见 documents/docx-env.ts）曾以
 * `{{pythonPath}}` 槽位拼在骨架里，位于提示词前缀内部 —— venv 一旦重建、换机器
 * 或私有化部署换个安装位置，**该处之后的整段提示词与整段历史一起失配**。
 * 现在它由 session-host.ts 的 hidden context `python_env` 段每轮注入（尾部独立
 * 消息，落在历史之后）；片段 python-env.md 只留**恒定**的纪律文字（不要去猜系统
 * Python、不要 pip install、产物放工作目录），并指向那一段。
 *
 * 同理工作目录不进骨架：pi 内置的 `cwd` 行由 before_agent_start 的整串替换换掉，
 * 用户会话里工作目录的唯一来源是 hidden context 的 workspace_context（session-host.ts
 * 的 composeRunHiddenContext），骨架里手写一行既是重复又在对话历史之前
 * （spec: stabilize-prompt-prefix 的 REMOVED Requirements）。
 * 子代理路径是例外：子代理不接场景骨架，cwd 由 composeSubagentPrompt 写进它自己的
 * 提示词（与 hidden context 的 workspace_context 同源同值，会话内定值，不破坏字节稳定）。
 *
 * **唯一仍留在系统提示词里的「工作区文件内容」**是 pi 的 contextFiles（AGENTS.md 类项目
 * 指令文件，formatPiContextBlock 拼回 pi-context 段）：forced 整串替换让 pi 不再自动附加
 * 它，只能自己拼。它在 pi 侧于会话建立时装载（_baseSystemPromptOptions）、会话内不随文件
 * 改动重读，属准静态内容 —— 是上面那条禁令的受限例外，不是遗漏。
 *
 * composePromptWithMeta 额外产出 segments（provenance，设置页「提示词预览」的
 * 数据源）。硬约束：**segments 顺序拼接与 text 字节一致**。为让这条可证，空行
 * 压平（\n{3,}→\n\n）从「拼完再整体压」改为「按段压」——具体等价性论证见
 * finalizeCore 的注释。
 */

import { dirname } from "node:path";
/*
 * pi 的值为什么走首用时动态 import（勿改回静态）：pi 整包实测热态 1809ms
 * （冷态 4.7s）。这里只用到两个纯函数（formatSkillsForPrompt /
 * createSyntheticSourceInfo），而它们的调用点 formatSkillsSection 在
 * daemon 的启动关键路径（post ready 之前）根本不会跑 —— 启动只做
 * loadResources / 偏好 / 权限规则这类 ms 级读。静态 import 会在 daemon 的
 * 模块体之前求值，等于每次启动先白付整包 pi 的钱。类型引用（BuildSystemPromptOptions /
 * Skill / PiSdk）都是编译期擦除的。
 */
import type { BuildSystemPromptOptions, Skill } from "@earendil-works/pi-coding-agent";
import type { ExpertDefinition } from "./experts.ts";
// 取代声明从 shared 的**单点常量**取（三条快照通道共用）：本文件不再另写一份字面量，
// 措辞与容器块的声明不会漂移（AGENTS.md §4）。
import { SNAPSHOT_SUPERSEDE_NOTE } from "../shared/hidden-context.ts";

type PiSdk = typeof import("@earendil-works/pi-coding-agent");

/** 从 pi 的结构化选项里取出上下文组装还需要的那几块。 */
export type PromptContextOptions = Pick<
	BuildSystemPromptOptions,
	"contextFiles" | "toolSnippets" | "promptGuidelines"
>;

export interface SkillDescriptor {
	readonly name: string;
	readonly description: string;
	/** SKILL.md 的绝对路径 —— 模型用 read / use_skill 按需加载全文就靠它。 */
	readonly filePath: string;
	/**
	 * frontmatter 的 `disable-model-invocation`。**必须一路带到清单段**：pi 的
	 * formatSkillsForPrompt 靠它把这类技能过滤掉（它们只能被 /skill:name 手动触发）。
	 * 缺省 false（pi 的 loader 就是 `=== true`）。
	 */
	readonly disableModelInvocation?: boolean;
}

/**
 * 会话绑定专家的人格（resources/experts/<name>/expert.md 的展示字段 + 正文全文）。
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
	/**
	 * 会话绑定专家的人格。专家与交互模式正交：只按 expertId 是否绑定决定有没有值，
	 * 与模式无关（见 daemon 的 composeSystemPrompt / resolveSessionExpert）。
	 * 提供时注入前部槽位人格段（骨架之后、模式行为段之前，带 Role Override 声明）
	 * + 末尾 <current-expert> 钉子段（只钉名字，不含人格本体），并抑制风格段
	 * （风格让位于人格，见 composePromptWithMeta 内注释）。未绑定专家时缺省。
	 */
	readonly expert?: ExpertPersona;
	/** pi 已经加载好的上下文文件 / 工具提示，拼回最终提示词。 */
	readonly piContext?: PromptContextOptions;
	/**
	 * 模式 id，仅用于 provenance 标注（mode:<id>）。缺省标 mode:unknown。
	 */
	readonly modeId?: string;
	/**
	 * 回复风格（resources/styles/ 的 id + 正文全文）。提供时在交互段之后
	 * 注入风格段（provenance 标 style:<id>，含「HOW 不影响 WHAT」元规则，
	 * 见 formatStyleSection）；缺省 = 不注入（偏好里 styleId 为空串的
	 * 「关闭」态由调用方不传本字段表达）。子代理路径没有本字段可言。
	 * expert 字段有值时本字段被忽略 —— 选定专家后风格让位于人格。
	 */
	readonly style?: { readonly id: string; readonly body: string };
	/**
	 * 记忆系统行为纪律段（resources/prompts/memory-system.md 正文，
	 * spec: add-memory-system）。**固定注入**：它定义三层记忆与写入纪律，
	 * 是行为约定不是数据。读取失败时调用方不传本字段（记忆是增强不是
	 * 门槛，compose 注入路径不能炸——见 core/memory.ts 文件头）。
	 */
	readonly memorySystemBody?: string;
	/**
	 * 输出语言规则段（resources/prompts/language.md 正文，见 ARCHITECTURE §4.15）。
	 *
	 * **位置是本字段存在的唯一理由：它必须排在风格段之后。** 风格文件是搬用
	 * WorkBuddy 的英文材料（7 份全英文、正文带英文范例句），是对「怎么说人话」
	 * 的最后一条指令；语言规则排在它前面就要靠位置去赢一个 2,182 字符的英文段，
	 * 赢不了 —— 实测后果是过程叙述飘成英文。WorkBuddy 同向：`<response_language>`
	 * 在模板最末。所以它**不进 filled 的片段序**，而是在风格段 splice 之后
	 * 直接 push，成为 core 的最后一段（风格段缺席时它就是 core 末尾，位序语义不变）。
	 *
	 * 与 style 不同，它**不受 expert 抑制**：绑定专家时风格段不注入，但语言规则
	 * 仍要注入 —— 专家人格同样得用中文说话。
	 */
	readonly languageBody?: string;
	/**
	 * 片段解析回调：name → 片段内容；返回 undefined 表示片段缺失（组装抛错）。
	 * composer 保持纯函数不读盘，resources/prompts/fragments/ → 本回调的映射
	 * 是 loader 层的事。骨架含 {{> }} 而未提供本回调 → 抛错（不静默留洞）。
	 */
	readonly resolveFragment?: (name: string) => string | undefined;
}

/**
 * 个性化注入段（preferences 四键的注入块投影，见 formatRuntimeContext）。
 * 全空 = 零 token 不注入；customInstructions 超 1500 字硬截断
 * （防用户粘贴长文挤爆上下文，输入侧 textarea 同上限）。
 */
export interface PersonalizationSection {
	/** 自定义指令 → 独立「用户规则」段（超 1500 字截断）。 */
	readonly customInstructions?: string;
	/** 对用户的称呼 → 「用户希望被称为「X」」一行。 */
	readonly userNickname?: string;
	/** AI 的名字 → 「你的名字是 X」一行。 */
	readonly assistantName?: string;
	/** 人设/人格描述 → 「你的人设：X」一行。 */
	readonly personaDescription?: string;
}

/** 自定义指令注入上限（与设置页 textarea 的 maxLength 同口径）。 */
const CUSTOM_INSTRUCTIONS_MAX = 1500;

/**
 * 个性化段文本。四项全空返回 ""（零 token 不注入）。
 * 用户规则独立成段（对齐 WorkBuddy always_applied_user_rules 语义：
 * 用户为自己设定的规则，在合适的场景下遵循），称呼/名字/人设各成一行。
 */
function formatPersonalizationSection(p: PersonalizationSection): string {
	const blocks: string[] = [];
	if (p.customInstructions !== undefined && p.customInstructions.trim() !== "") {
		const instructions = p.customInstructions.trim().slice(0, CUSTOM_INSTRUCTIONS_MAX);
		blocks.push(`## 用户规则\n\n以下是用户为自己设定的规则，请在合适的场景下遵循。\n\n${instructions}`);
	}
	const identityLines: string[] = [];
	if (p.userNickname !== undefined && p.userNickname.trim() !== "") {
		identityLines.push(`用户希望被称为「${p.userNickname.trim()}」。`);
	}
	if (p.assistantName !== undefined && p.assistantName.trim() !== "") {
		identityLines.push(`你的名字是 ${p.assistantName.trim()}。`);
	}
	if (p.personaDescription !== undefined && p.personaDescription.trim() !== "") {
		identityLines.push(`你的人设：${p.personaDescription.trim()}`);
	}
	if (identityLines.length > 0) blocks.push(identityLines.join("\n"));
	return blocks.join("\n\n");
}

/**
 * 逐轮可变事实的注入块输入。两段都是「会话内会变」的，所以一律不进系统提示词
 * （文件头纪律），改由 prompt-switch 的 `context` 事件每请求注入。
 *
 * 时间**不在**这里：它唯一的来源是 session-host 的 hidden context `current_time`
 * （run 冻结，见 formatRuntimeContext 的注释）。
 */
export interface RuntimeContextInput {
	/**
	 * 三层记忆内容（core/memory.ts buildMemorySection(cwd) 的产物）。
	 * undefined / 全空白 = 零 token 不注入（既有口径不变）。
	 */
	readonly memoryContent?: string;
	/**
	 * 个性化（spec: rework-settings-layout）：只含 4 个注入字段——
	 * welcomeGreeting / showChangeDetails 两个 boolean 是 UI 开关不进提示词，
	 * 钉在这里免得后人把开关塞进模型可见文本。
	 */
	readonly personalization?: PersonalizationSection;
}

/**
 * 运行时上下文注入块：三层记忆内容 + 个性化，按此序用空行拼接。
 *
 * 为什么这两段在这里而不是系统提示词里（spec: stabilize-prompt-prefix）：
 * 系统提示词每轮重组且位于整段对话历史之前，里面任何逐轮会变的字节都会让
 * 它之后的一切（含整段历史）在 provider 前缀缓存里失配。注入块作为一条
 * **append-only 的消息落在对话历史之后**（extensions/prompt-switch.ts 的
 * `context` 事件），因此它的任何变化都不可能让前缀失配。
 *
 * 时间为什么**不**在这里（曾经在这里）：会话内的时间只留一个来源 ——
 * session-host.ts 的 hidden context `current_time`（formatRunTime，run 开始时
 * 冻结）。两个来源并存时值可能不一致（一个 run 冻结、一个每请求刷新），
 * 且 hidden context 是既有机制、注入位同样在对话历史之后，其
 * data-role=additional-data 还被压缩链路按「一次性可剥离」语义处理
 * （shared/hidden-context.ts 与 docs/workbuddy分析/11-hidden-context.md）——
 * 动那套语义的风险高于删掉这里新加的一份；而 run 级冻结的精度对「本轮现在是
 * 几点」够用（这是本改动前的既有行为，不降低水位）。
 *
 * 与 composer 的残留检查无关：本函数不经过 composePromptWithMeta，记忆正文与
 * 自定义指令里的 `{{...}}` 是用户数据不是模板笔误，不该让会话组装抛错
 * （残留检查的口径见文件头护栏 2）。
 *
 * 另：注入不改系统提示词、也不落会话文件（`context` 事件的返回值只在本次
 * provider 请求生效），因此不存在会话日志无界增长。
 *
 * **取代声明在正文第一行**（spec: add-supersede-note-and-time-split 的 A）：画像/
 * 个性化是 append-only 的 —— 内容一变就追加一条新的，旧的原样留档（画像里写着
 * 「最后更新：…」这类会过期的事实），而模型此前没有任何依据判断以哪条为准。声明是
 * 常量、从 shared 的 `SNAPSHOT_SUPERSEDE_NOTE` 取，不引入逐轮差异（不破坏去重）。
 * 无内容时仍返回空串：零 token 不注入，空段不白发一句声明出去。
 */
export function formatRuntimeContext(input: RuntimeContextInput = {}): string {
	const blocks: string[] = [];
	if (input.memoryContent !== undefined && input.memoryContent.trim() !== "") {
		blocks.push(input.memoryContent.trim());
	}
	if (input.personalization !== undefined) {
		const personalization = formatPersonalizationSection(input.personalization);
		if (personalization !== "") blocks.push(personalization);
	}
	if (blocks.length === 0) return "";
	return `${SNAPSHOT_SUPERSEDE_NOTE}\n\n${blocks.join("\n\n")}`;
}

const SLOT = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;
/**
 * 残留检查用更宽的模式：任何 `{{...}}` 都不许活过组装。
 * 严格标识符之外的写法（`{{中文}}`、`{{a b}}`、`{{> }}`）不参与替换，但同样是笔误。
 */
const ANY_SLOT = /\{\{[^{}]*\}\}/g;
/**
 * include 指令：`{{> fragment-name}}`。与槽位靠「>」前缀区分；
 * 片段名允许连字符（delivery-rules 这类命名），槽位名不允许。
 */
const INCLUDE = /\{\{>\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\}\}/g;
/**
 * 片段嵌套深度上限。环检测拦 a→b→a，这条拦不成环的长链 ——
 * 真写出 9 层片段嵌套几乎一定是配置事故，响亮抛错好过组装出怪物。
 */
const MAX_FRAGMENT_DEPTH = 8;

/**
 * 分段来源（provenance）。skeleton = 骨架的非片段部分；fragment:<名> = 片段内容；
 * mode:<id> = 交互模式行为段；skills / pi-context / expert 同名段落；
 * style:<id> = 回复风格段（注入点在交互段之后，见 composePromptWithMeta）；
 * memory-system = 记忆行为纪律段；language = 输出语言规则段
 * （**排在 style 之后**，理由见 ComposePromptInput.languageBody）。
 *
 * **time / memory / personalization 不在这里**：它们是逐轮会变的事实，不进系统
 * 提示词 —— memory / personalization 由 formatRuntimeContext 组装成注入消息，
 * time 由 hidden context 的 current_time 送达（文件头纪律）。
 * **python-env 也不在这里**：它曾作为 `{{pythonPath}}` 的取值段存在，随机器变的
 * 绝对路径进提示词就是「换机 / 重建 venv 即断前缀」，现改由 hidden context 的
 * `python_env` 段送达（片段只留恒定纪律文字，provenance 用 `fragment:python-env`）。
 */
export type PromptSegmentSource =
	| "skeleton"
	| "skills"
	| "pi-context"
	| "expert"
	| "memory-system"
	| "language"
	| `fragment:${string}`
	| `mode:${string}`
	| `style:${string}`;

export interface PromptSegment {
	readonly source: PromptSegmentSource;
	readonly text: string;
}

export interface ComposedPrompt {
	readonly text: string;
	/** 顺序拼接与 text 字节一致（finalizeCore 的注释论证了为什么严格成立）。 */
	readonly segments: readonly PromptSegment[];
}

/** 组装中间态的分段（可写，收尾后作为 readonly PromptSegment 抛出）。 */
interface DraftSegment {
	source: PromptSegmentSource;
	text: string;
}

/**
 * 薄封装：provenance 版是唯一实现，既有调用点（daemon 等）零改动。
 */
export function composePrompt(input: ComposePromptInput): string {
	return composePromptWithMeta(input).text;
}

export function composePromptWithMeta(input: ComposePromptInput): ComposedPrompt {
	// 阶段 1：片段展开（先于槽位替换与残留检查 —— 片段里也可以写槽位与 include）。
	const pieces: DraftSegment[] = [];
	expandIncludes(input.sceneBody, "skeleton", input, [], pieces);

	// 阶段 2：槽位替换。骨架/片段段被槽位切开，值段各自标注来源。
	const filled: DraftSegment[] = [];
	for (const piece of pieces) fillSlots(piece, input, filled);

	/*
	 * 专家人格前部槽位：模式行为段之前注入（WorkBuddy PluginAgentPrompt 顶部
	 * 槽位的等价物 —— 人格带 Role Override 声明压过骨架里的通用身份；末尾
	 * <current-expert> 只是不含人格的钉子，见本函数尾部）。v1 曾把人格放在
	 * 核心段之后，通用身份（办公助手）在前稀释人格 —— spec:
	 * align-expert-system-workbuddy 把它上移到这里。
	 * 插在 finalizeCore 之前：人格段与骨架/模式段走同一套按段压平与空段丢弃，
	 * 「segments 拼接 == text」的等价性论证不需要为人格段单开分支。前段尾部
	 * 换行剥掉、空行分隔改由人格段自己携带 —— 跨段边界凑不出 \n{3,}，不破坏
	 * finalizeCore 注释里「段边界最多两个换行」的论证前提。骨架没有
	 * {{interaction}} 槽位时落在核心段末尾（finalizeCore 的整体 trim 会裁掉
	 * 人格段的尾部换行，post-core 各段的 \n\n 前缀照常分隔）。
	 * 人格段在残留检查之前入列：专家正文是定义文件不是用户数据，里面写出
	 * {{...}} 就是笔误，与模式正文同一条响亮抛错口径。
	 */
	if (input.expert !== undefined) {
		const personaSeg: DraftSegment = {
			source: "expert",
			text: `\n\n${formatExpertPersona(input.expert)}\n\n`,
		};
		const modeIdx = filled.findIndex((s) => s.source.startsWith("mode:"));
		if (modeIdx === -1) filled.push(personaSeg);
		else {
			const prev = filled[modeIdx - 1];
			if (prev !== undefined) prev.text = prev.text.replace(/\n+$/, "");
			filled.splice(modeIdx, 0, personaSeg);
		}
	}

	/*
	 * F8 风格段：交互段之后注入（WorkBuddy 同款位序 —— 先「怎么交互」再「怎么说话」）。
	 * 插在 finalizeCore 之前：风格段与骨架/模式段走同一套按段压平与空段丢弃，
	 * 「segments 拼接 == text」的等价性论证不需要为风格段单开分支。
	 * 骨架没有 {{interaction}} 槽位时（用多少槽位是场景作者的自由）没有交互段可锚，
	 * 落在核心段末尾 —— 此时它仍在 pi-context 之前，位序语义不变。
	 * 绑定专家时不注入：选定专家后用户自定义风格让位于人格（WorkBuddy
	 * user-context-expert-identity 的精简语义 —— 表达层的唯一权威是人格，
	 * 风格与人格并存只会冲突）；未绑定专家的会话没有 expert 字段，不受影响。
	 */
	if (input.style !== undefined && input.expert === undefined) {
		const styleSeg: DraftSegment = {
			source: `style:${input.style.id}`,
			text: `\n\n${formatStyleSection(input.style.body)}`,
		};
		const modeIdx = filled.findIndex((s) => s.source.startsWith("mode:"));
		if (modeIdx === -1) filled.push(styleSeg);
		else filled.splice(modeIdx + 1, 0, styleSeg);
	}

	/*
	 * 输出语言段：**必须在风格段之后**（本函数里它是 core 的最后一段）。
	 *
	 * 为什么在这里而不是场景骨架的一个 {{> }} 槽位：骨架里的片段位置都在
	 * 「{{interaction}} → 风格段」之前，而这条规则的作用对象恰恰是风格段 ——
	 * 英文风格材料是对「怎么说话」的最后一条指令，语言规则只能排在它之后
	 * 才有压过它的位置（WorkBuddy 的 `<response_language>` 同样在模板最末）。
	 *
	 * 不受 expert 抑制：风格段在绑定专家时不注入，语言规则不是风格的一部分，
	 * 人格同样要用中文说话。走 filled 而不是 all，是为了与骨架/模式/风格段
	 * 共享 finalizeCore 的按段压平 —— 「segments 拼接 == text」的等价性论证
	 * 不必为它单开分支。
	 */
	if (input.languageBody !== undefined && input.languageBody.trim() !== "") {
		filled.push({ source: "language", text: `\n\n${input.languageBody.trim()}` });
	}

	// 残留检查：任何 {{...}} 都不许活过组装（含片段/模式/风格正文里的笔误、{{> 残次写法）。
	for (const seg of filled) {
		const leftover = seg.text.match(ANY_SLOT);
		if (leftover !== null) {
			throw new Error(
				`组装后的提示词仍有残留槽位（${leftover.join("、")}，来源段 ${seg.source}）——骨架、片段与模式正文里都不应出现 {{...}}`,
			);
		}
	}

	const core = finalizeCore(filled);

	const all: DraftSegment[] = [...core];
	/*
	 * 记忆行为纪律段：核心段（骨架 + 人格 + 模式）之后、pi 上下文之前。人格上前部
	 * 槽位后（spec: align-expert-system-workbuddy）记忆段排在人格之后 —— 与
	 * WorkBuddy 选专家后精简用户自定义身份的让位方向一致（人格优先于用户侧设定）。
	 * 注意这里是**行为约定**（怎么写记忆），不是记忆内容 —— 记忆内容逐轮会变，
	 * 走 formatRuntimeContext 的注入路径，不进提示词。
	 * 段文本只经 trim 不再压平：按段压平服务于 finalizeCore 的等价性论证，
	 * 这里的段自带 \n\n 前缀、join 后接缝天然是两个换行。
	 */
	if (input.memorySystemBody !== undefined && input.memorySystemBody.trim() !== "") {
		all.push({
			source: "memory-system",
			text: `\n\n## 记忆系统\n\n${input.memorySystemBody.trim()}`,
		});
	}
	const piBlock = formatPiContextBlock(input);
	if (piBlock !== "") {
		all.push({ source: "pi-context", text: `\n\n${piBlock}` });
	}
	/*
	 * <current-expert> 钉子段放最末（WorkBuddy CurrentExpertReminderSection 的
	 * 同款防漂移：多轮对话后模型会忘记自己的专家身份，它每轮 user-context 钉一次）。
	 * 只是钉子：专家名 + 一句「遵循其角色与工作流」，人格本体只在前部槽位
	 * 出现一次 —— 重复人格既浪费 token，两处文本还有漂移风险。
	 * 同一会话内它是稳定文本（专家绑定不改就不变），不破坏系统提示词的前缀缓存口径。
	 */
	if (input.expert !== undefined) {
		all.push({
			source: "expert",
			text: `\n\n<current-expert>${input.expert.displayName}</current-expert>\n请始终以该专家的角色与工作流推进本会话。`,
		});
	}

	return { text: all.map((s) => s.text).join(""), segments: all };
}

/**
 * 递归展开 include 指令：text 被 {{> name}} 切成若干段，字面部分保持当前
 * source，片段内容递归展开（片段内可继续 include）。chain 是展开路径，
 * 既做环检测也当深度计。
 */
function expandIncludes(
	text: string,
	source: PromptSegmentSource,
	input: ComposePromptInput,
	chain: readonly string[],
	out: DraftSegment[],
): void {
	let last = 0;
	for (const m of text.matchAll(INCLUDE)) {
		const idx = m.index;
		const name = m[1];
		if (idx === undefined || name === undefined) continue;
		if (idx > last) out.push({ source, text: text.slice(last, idx) });

		if (input.resolveFragment === undefined) {
			throw new Error(
				`提示词骨架包含片段引用「{{> ${name}}」，但输入未提供 resolveFragment —— composer 不读盘，片段由 loader 层注入`,
			);
		}
		const content = input.resolveFragment(name);
		if (content === undefined) {
			throw new Error(
				`提示词片段「${name}」缺失（resolveFragment 返回 undefined）——不静默上线带空洞的提示词`,
			);
		}
		if (chain.includes(name)) {
			throw new Error(`提示词片段成环：${[...chain, name].join(" → ")}`);
		}
		if (chain.length >= MAX_FRAGMENT_DEPTH) {
			throw new Error(
				`提示词片段嵌套超过 ${MAX_FRAGMENT_DEPTH} 层：${chain.join(" → ")}（不成环的长链几乎一定是配置事故）`,
			);
		}
		// 片段内容首尾换行先剥掉：文件末尾换行是磁盘格式不是内容；且这让
		// 「空行压平」可按段进行（finalizeCore 的等价性论证依赖这条）。
		expandIncludes(
			content.replace(/^\n+/, "").replace(/\n+$/, ""),
			`fragment:${name}`,
			input,
			[...chain, name],
			out,
		);
		last = idx + m[0].length;
	}
	if (last < text.length) out.push({ source, text: text.slice(last) });
}

/**
 * 单段内的槽位替换：段被槽位切开，interaction / skills 的值独立成段
 * （provenance 标注 mode:<id> / skills）。
 *
 * 槽位集合就是这两个：`{{cwd}}` 已删（工作目录由 hidden context 的
 * `workspace_context` 提供，手写一行既重复又落在对话历史之前），`{{model}}` 已删
 * （全库无使用者），`{{pythonPath}}` 已删（解释器绝对路径随机器变，改由 hidden
 * context 的 `python_env` 段注入 —— 见文件头；它进提示词就是「换机即断前缀」）。
 * 分支不放松：骨架/片段里出现这三个以外的任何 `{{xxx}}` 都在这里响亮抛错。
 */
function fillSlots(piece: DraftSegment, input: ComposePromptInput, out: DraftSegment[]): void {
	/*
	 * 槽位取值表。两个槽位在类型上都是必需值（modeBody / skillsSection 都是 string，
	 * 空串是合法值：技能段为空就是零 token），所以这里没有「组装方没给值」这种分支
	 * —— 曾经那条分支只服务于 `{{pythonPath}}`（空路径进提示词比组装期报错难查得
	 * 多），随该槽位一起删掉了。表用数组而不是 Record：查不到即未支持的槽位，
	 * 一次查找同时给出「有没有」与「值是什么」，不留类型上的第二分支。
	 */
	const slots: readonly {
		readonly name: string;
		readonly source: PromptSegmentSource;
		readonly text: string;
	}[] = [
		{ name: "interaction", source: `mode:${input.modeId ?? "unknown"}`, text: input.modeBody },
		{ name: "skills", source: "skills", text: input.skillsSection },
	];

	let last = 0;
	for (const m of piece.text.matchAll(SLOT)) {
		const idx = m.index;
		const name = m[1];
		if (idx === undefined || name === undefined) continue;
		const raw = m[0];
		const slot = slots.find((s) => s.name === name);
		if (slot === undefined) {
			throw new Error(
				`提示词骨架包含未支持的槽位「${raw}」。支持的槽位：${slots.map((s) => s.name).join(" / ")}`,
			);
		}
		if (idx > last) out.push({ source: piece.source, text: piece.text.slice(last, idx) });
		// 值段剥首尾换行（同片段内容的处理）：段落的边界空行归骨架作者控制，
		// 值自身不带 —— 按段压平与旧的整体压平等价就靠这条（finalizeCore）。
		out.push({ source: slot.source, text: slot.text.replace(/^\n+/, "").replace(/\n+$/, "") });
		last = idx + raw.length;
	}
	if (last < piece.text.length) out.push({ source: piece.source, text: piece.text.slice(last) });
}

/**
 * 核心段收尾：按段压平 \n{3,} → \n\n、丢弃空段并合并相邻同源段、整体 trim。
 *
 * 为什么「按段压平再拼」与旧的「拼完整体压平」结果一致 —— \n{3,} 只有三条来路：
 *   1. 单个段内部（骨架/正文自带）→ 按段压平直接处理；
 *   2. 段边界拼接：值段（模式/技能/片段）入段前已剥首尾换行，边界最多
 *      「骨架残段的 ≤2 个 \n」+「值的非换行首字符」，凑不出第三个 \n；
 *   3. 空值段（如无技能）两侧的骨架残段：空段丢弃后两侧同源合并，合并文本重压平。
 * 三条路都堵死后 join(segments) 本身就不含 \n{3,}，「segments 拼接 == text」严格成立。
 * trim 同理：裁量落回首尾各段，而不是拼完再裁（否则首尾段带着已裁掉的空白）。
 */
function finalizeCore(segments: readonly DraftSegment[]): DraftSegment[] {
	const merged: DraftSegment[] = [];
	for (const seg of segments) {
		const text = seg.text.replace(/\n{3,}/g, "\n\n");
		if (text === "") continue;
		const prev = merged[merged.length - 1];
		if (prev !== undefined && prev.source === seg.source) {
			// 相邻同源只可能是「空段被丢弃」后的骨架/片段残段，合并后重压平接缝。
			prev.text = `${prev.text}${text}`.replace(/\n{3,}/g, "\n\n");
		} else {
			merged.push({ source: seg.source, text });
		}
	}

	const joined = merged.map((s) => s.text).join("");
	let dropLead = joined.length - joined.trimStart().length;
	let dropTrail = joined.length - joined.trimEnd().length;
	for (const seg of merged) {
		if (dropLead === 0) break;
		const cut = Math.min(dropLead, seg.text.length);
		seg.text = seg.text.slice(cut);
		dropLead -= cut;
	}
	for (let i = merged.length - 1; i >= 0 && dropTrail > 0; i--) {
		const seg = merged[i];
		if (seg === undefined) break;
		const cut = Math.min(dropTrail, seg.text.length);
		seg.text = seg.text.slice(0, seg.text.length - cut);
		dropTrail -= cut;
	}
	return merged.filter((s) => s.text !== "");
}

/**
 * 「当前专家」人格段：标题 + 身份一行 + Role Override 声明 + 正文全文（人格本体）。
 *
 * override 声明压的是骨架里的通用身份（「办公助手」类描述）：骨架不按模式
 * 裁剪（场景×模式双轴解耦，裁剪会让每个场景骨架背上模式分支），人格只能靠
 * 这段声明取得冲突时的权威 —— 对齐 WorkBuddy 人格槽位的 Role Override 前缀
 * 语义，措辞自创（合规红线：不抄原文）。声明紧贴人格正文之前，中间不隔别的
 * 段落，「以本段为准」的指代才不含糊。
 */
function formatExpertPersona(expert: ExpertPersona): string {
	return `## 当前专家\n\n你当前的专家身份：${expert.displayName}（${expert.profession}）。\n\n身份覆盖：以下是你在本会话中的专家身份定义。它与此前任何通用身份描述冲突时，以本段为准——这是本会话中你的权威角色。\n\n${expert.body.trim()}`;
}

/**
 * 回复风格段：标题 + 风格正文全文 + 元规则一句。
 *
 * 元规则「风格只影响表达方式（HOW），不改变事实与内容（WHAT）」由组装层附加、
 * 不在风格文件里（resources/styles/README.md 的语义约定）——它是给模型的
 * 护栏：风格正文全是「怎么说话」，没有这一句，模型可能把「毒舌/创意」理解成
 * 可以改动事实与结论。措辞与 README 对照表保持一字不差，两处是同一约定的
 * 代码镜像与文档镜像。
 * 正文剥首尾换行（同片段/槽位值的处理）：边界空行归骨架与注入点控制。
 */
function formatStyleSection(body: string): string {
	return `## 回复风格\n\n${body.trim()}\n\n风格只影响表达方式（HOW），不改变事实与内容（WHAT）。`;
}

/**
 * 会话绑定的专家解析：按 expertId 从专家库取出**完整定义**。
 *
 * 一轮 compose 里人格注入与私有技能预加载都要用它，只查一次共用，避免两处各自
 * 查找后漂移（spec: 专家私有技能预加载）。返回 undefined = 本会话未绑定专家。
 *
 * expertId 有值但不在库中 → 响亮抛错（不可达防御）：选择时（setExpert）已校验过
 * 存在，但用户级专家文件可能被手删，恢复会话后 state 与专家库漂移只能在这一刻发现。
 */
export function resolveSessionExpert(
	experts: readonly ExpertDefinition[],
	expertId: string | undefined,
): ExpertDefinition | undefined {
	if (expertId === undefined) return undefined;
	const found = experts.find((e) => e.name === expertId);
	if (found === undefined) {
		throw new Error(`专家「${expertId}」不在专家库中（可能已被删除或改名）`);
	}
	return found;
}

/**
 * 专家定义 → 注入所需的人格三件套。人格与私有技能目录同源于一次专家查找：
 * daemon 用 resolveSessionExpert 的结果，人格走本函数、技能目录走其 skillsDir。
 */
export function toExpertPersona(expert: ExpertDefinition): ExpertPersona {
	return { displayName: expert.displayName, profession: expert.profession, body: expert.body };
}

/**
 * 必有专家的解析：选择期校验（daemon 的 setExpert）沿用本函数 —— 专家不存在响亮抛错；
 * expertId 缺失同样是调用方错误（需要「可能未绑定」的语义时用 resolveSessionExpert）。
 * 没有人格的专家会话是「自称专家却没有人格」的错误身份 —— 响亮失败好过静默上线。
 */
export function requireExpertPersona(
	experts: readonly ExpertDefinition[],
	expertId: string | undefined,
): ExpertPersona {
	const found = resolveSessionExpert(experts, expertId);
	if (found === undefined) {
		throw new Error("会话绑定专家时缺少 expertId（人格解析需要具体专家）");
	}
	return toExpertPersona(found);
}

/**
 * 把 pi 已经算好的上下文文件与工具提示段拼成一块文本（无内容返回空串）。
 *
 * before_agent_start 的整体替换会让 pi 不再自动附加这些（system-prompt.ts
 * 的 customPrompt 分支也只处理 contextFiles / skills / cwd），而工具
 * snippet 与 guidelines 是我们自己的工具注册时提供的（extensions/*.ts），
 * 不拼回来模型就看不到「该在什么时候用哪个工具」。格式与 pi 的
 * buildSystemPrompt 对齐，避免同一份数据两处漂移。
 */
function formatPiContextBlock(input: { readonly piContext?: PromptContextOptions }): string {
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

	return sections.join("\n\n");
}

/** 子代理路径用的拼接封装（主会话走 composePromptWithMeta 的分段路径）。 */
function appendPiContext(composed: string, input: { readonly piContext?: PromptContextOptions }): string {
	const block = formatPiContextBlock(input);
	return block === "" ? composed : `${composed}\n\n${block}`;
}

export interface ComposeSubagentPromptInput {
	/** 子代理定义正文（resources/agents/<name>.md 的 body）——提示词主体。 */
	readonly agentBody: string;
	readonly cwd: string;
	/** pi 已经加载好的上下文文件 / 工具提示，拼回最终提示词。 */
	readonly piContext?: PromptContextOptions;
	/**
	 * 输出语言规则段（`resources/prompts/language.md` 正文，见 §4.15）。
	 *
	 * 子代理同样要注入：它写的中间报告与最终结论会**回到主会话的上下文里**，
	 * 用英文写就等于往主会话灌英文材料 —— 正是主会话飘成英文的那个诱因
	 * （`language.md` 里那条「英文材料不决定输出语言」要挡的东西）。
	 * 位置与主会话一致：agent 正文 + 工作目录之后、pi 上下文（AGENTS.md 类，
	 * 可能是英文）之前。
	 */
	readonly languageBody?: string;
}

/**
 * 子代理会话的提示词组装：agent.body 为主体 + 工作目录 + pi 上下文。
 *
 * 为什么不走 composePrompt 的场景×模式双轴：双轴回答的是「KamiBuddy 这个产品
 * 在什么场景下以什么交互方式工作」，而子代理的身份由 agent 定义自己完整声明
 * （scout 是侦察员、reviewer 是评审员，都不是「办公助手」）——套场景骨架会把
 * 产品身份灌进子代理，身份冲突且浪费 token。技能段同理不注入：子代理的
 * 能力面由自己的 tools 白名单界定，与主会话安装的技能无关。
 * 但工作目录与 pi 的上下文（工具 snippet / guidelines / 项目指令文件）仍是必需品
 * ——没有它们模型不知道自己在哪个目录工作、工具该怎么用。工作目录因此由**本函数**
 * 写在提示词里（子代理不接场景骨架，也不接 pi 内置的那行 `cwd`——它被
 * before_agent_start 的整串替换换掉了）；会话内它是定值，不破坏字节稳定。
 *
 * 时间块不在这里：成员/子代理会话同样是「多轮同一会话」，时间进提示词就是
 * 逐轮断前缀（文件头纪律）—— 时间由子代理/成员会话自己那个 SessionHost 的
 * hidden context `current_time` 送达（与用户会话同一条路径）。
 */
export function composeSubagentPrompt(input: ComposeSubagentPromptInput): string {
	const head = `${input.agentBody.trim()}\n\n当前工作目录：${input.cwd}`;
	/*
	 * 输出语言段接在 head 之后、pi 上下文之前（不是整篇最后）：pi 上下文是
	 * AGENTS.md 类项目指令文件，内容随用户项目而变、可能是英文，由
	 * appendPiContext 追加在末位。位序与主会话一致 —— 语言规则排在「怎么说人话」
	 * 的指令之后、项目内容之前（§4.15；主会话那边同序，见 languageBody 注释）。
	 */
	const body =
		input.languageBody === undefined || input.languageBody.trim() === ""
			? head
			: `${head}\n\n${input.languageBody.trim()}`;
	return appendPiContext(body, input);
}

/**
 * 技能清单段。无技能返回空串——骨架里 {{skills}} 所在行会被压平，零 token。
 *
 * 格式与过滤仍全权委托 pi 的 formatSkillsForPrompt（agentskills.io 规范的 XML 形态，
 * disable-model-invocation 的技能由它剔掉）：我们的 before_agent_start 整体替换让 pi
 * 不再自动附加这段，但「模型如何理解技能清单」的格式决定权仍应归 pi——它升级格式
 * （比如改调用约定）时我们零改动。**只追加一句**本会话的调用约定，而不是自己重写
 * 那套 XML：重写就等于把 pi 的格式抄一份过来，从此两份都要维护。
 */
export async function formatSkillsSection(skills: readonly SkillDescriptor[]): Promise<string> {
	if (skills.length === 0) return "";
	const { createSyntheticSourceInfo, formatSkillsForPrompt } = await import(
		"@earendil-works/pi-coding-agent"
	);
	const section = formatSkillsForPrompt(
		skills.map((skill) => toPiSkill(skill, createSyntheticSourceInfo)),
		"read",
	).trim();
	// 技能全被 disable-model-invocation 过滤掉时 pi 返回空串：保持零 token 口径，
	// 不留一句孤零零的调用约定（没有清单可指，那句只会让模型去找不存在的技能）。
	if (section === "") return "";
	return `${section}\n\n${SKILL_INVOCATION_NOTE}`;
}

/**
 * 本会话的技能调用约定（追加在 pi 的清单段之后）。
 *
 * pi 的清单段只写了「用 read 工具加载技能文件」——那是 pi 没有自动调用工具时的
 * 通用约定（docs/skills.md）。本会话更常用的是 use_skill（extensions/use-skill-tool.ts），
 * 一句指引把模型引到对的工具上；read 作为兜底路径保留（模式白名单不一定有 use_skill）。
 * 「技能名不许凭记忆编」这条约束在约定句里明写：它同时管两条路径 ——
 * 编出来的技能名在 use_skill 会撞错、在 read 会撞一个不存在的路径。
 *
 * 末句是**第三方技能的路径占位符**约定（2026-09-19 加，见 §4.26）。生态里的 SKILL.md
 * 普遍写 `${SKILL_DIR}/scripts/x.py` / `${CLAUDE_SKILL_DIR}`，并假定宿主会告知那是哪个
 * 目录（ppt-master 正文原话：「Retain the host-provided absolute directory containing
 * this file as SKILL_DIR」）。我们**不能**靠环境变量满足它：一个会话里可以同时装多个
 * 技能，各指各的目录，而 SKILL_DIR 只能有一个值；更糟的是 `${SKILL_DIR}` 在
 * PowerShell 与 bash 里都会被 shell 展开，**没注入时不是报错，而是静默变成
 * `/scripts/x.py` 接着跑**。所以只给展开规则、让模型按每条的 <location> 现算。
 */
const SKILL_INVOCATION_NOTE =
	"要加载上面某个技能时：优先调用 use_skill（command 填该技能 <name> 里的技能名）；" +
	"当前会话没有 use_skill 工具时，用 read 读取它的 <location>。" +
	"技能名与路径都必须来自上面的清单，不要凭记忆拼写。" +
	"技能正文里出现 ${SKILL_DIR} 或 ${CLAUDE_SKILL_DIR} 时，一律展开成该技能 <location> 所在的目录" +
	"—— 每个技能各有一个值，不要套用别的技能的路径，也不要当成环境变量去查。";

/**
 * SkillDescriptor → pi 的 Skill。
 *
 * 为什么需要这一层：pi 的格式化器入参类型是完整的 `Skill`（含 baseDir / sourceInfo），
 * 而它实现里只读 name / description / filePath / disableModelInvocation 四项
 * （pi dist/core/skills.js 的 formatSkillsForPrompt，0.85.x）。此前这里写的是
 * `skills as never[]` —— 把入参类型检查整体关掉，pi 改了字段名或签名我们不会有任何
 * 编译期信号。改成按 pi 自己的 loader 造出同形对象（baseDir = dirname(filePath)，
 * sourceInfo 走 pi 公开的 createSyntheticSourceInfo，与它给 path 来源技能造的那份一致；
 * scope/origin 取该函数的缺省值，格式化器不读它），换来的是真实类型。
 */
function toPiSkill(
	skill: SkillDescriptor,
	createSyntheticSourceInfo: PiSdk["createSyntheticSourceInfo"],
): Skill {
	const baseDir = dirname(skill.filePath);
	return {
		name: skill.name,
		description: skill.description,
		filePath: skill.filePath,
		baseDir,
		sourceInfo: createSyntheticSourceInfo(skill.filePath, { source: "local", baseDir }),
		// pi 的 loader 口径是 `frontmatter["disable-model-invocation"] === true`，
		// 缺省即 false：这里归一到同一语义，避免 undefined 在过滤处变成「真值」。
		disableModelInvocation: skill.disableModelInvocation === true,
	};
}

/**
 * 会话技能加载路径：随包预装的技能根在前（`resources/skills/` 我们自己写的、
 * `resources/plugins/` 照搬的市场插件），绑定的专家私有技能目录在后（未绑定不追加）。
 * 只决定「喂给 pi loadSkills 哪些根目录」，不读盘 —— 与 daemon 的实际加载分离，
 * 便于单测（spec: 专家私有技能预加载）。专家的专业技能因此只在该专家被绑定时可见。
 *
 * 顺序即优先级：pi loadSkills 对同名技能「先注册者胜出」，全局技能因此天然压过
 * 专家私有技能（重名本已在 core/experts.ts 加载期响亮拦下，此序只作兜底）。
 */
export function sessionSkillPaths(
	builtinSkillsDirs: readonly string[],
	expertSkillsDir?: string,
): string[] {
	return expertSkillsDir === undefined ? [...builtinSkillsDirs] : [...builtinSkillsDirs, expertSkillsDir];
}

/**
 * 会话技能清单段：模式工具白名单里有 read / bash / use_skill 才注入，否则空串（零 token）。
 * 三个都是「能加载技能」的工具：read（按 <location> 读文件）、bash（cat 技能文件）、
 * use_skill（本项目的技能加载工具）。一个都能没有还注入技能段，等于让模型去调一个
 * 并不存在的工具（plan 模式曾是这个坑）。
 * 门控只有这一处：真实组装（core/system-prompt-composer.ts 的 assembleSystemPrompt）
 * 与设置页预览都调它 —— 曾经 prompt-preview.ts 有一份「必须两处同改」的镜像，已删。
 */
export function skillsSectionForMode(
	modeTools: readonly string[],
	skills: readonly SkillDescriptor[],
): Promise<string> {
	const hasSkillLoader = modeTools.some(
		(t) => t === "read" || t === "bash" || t === "use_skill",
	);
	return hasSkillLoader ? formatSkillsSection(skills) : Promise.resolve("");
}
