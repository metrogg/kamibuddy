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
 *   2. 槽位替换：{{interaction}} / {{skills}} / {{cwd}} / {{model}}。
 *
 * 三条安全护栏（同一哲学：不静默上线带空洞的提示词——带着 {{xxx}} 空洞上线的
 * 提示词是最难排查的故障，模型会原样看到花括号）：
 *   1. 骨架里出现**未支持的槽位** → 抛错；
 *   2. 组装完成后仍有残留 {{...}}（模式/片段正文里的笔误、{{> 的残次写法）→ 抛错；
 *   3. 片段缺失 / 成环 / 超深 / 无 resolveFragment → 抛错。
 *
 * composePromptWithMeta 额外产出 segments（provenance，设置页「提示词预览」的
 * 数据源）。硬约束：**segments 顺序拼接与 text 字节一致**。为让这条可证，空行
 * 压平（\n{3,}→\n\n）从「拼完再整体压」改为「按段压」——具体等价性论证见
 * finalizeCore 的注释。
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
	 * expert 模式绑定的人格。提供时注入前部槽位人格段（骨架之后、模式行为段
	 * 之前，带 Role Override 声明）+ 末尾 <current-expert> 钉子段（只钉名字，
	 * 不含人格本体），并抑制风格段（风格让位于人格，见 composePromptWithMeta
	 * 内注释）。非 expert 模式缺省；expert 模式下由 requireExpertPersona 保证必有值。
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
	 * 三层记忆内容段（core/memory.ts buildMemorySection(cwd) 的产物）。
	 * undefined = 三层全空，零 token 不注入。
	 */
	readonly memoryContent?: string;
	/**
	 * 片段解析回调：name → 片段内容；返回 undefined 表示片段缺失（组装抛错）。
	 * composer 保持纯函数不读盘，resources/prompts/fragments/ → 本回调的映射
	 * 是 loader 层的事。骨架含 {{> }} 而未提供本回调 → 抛错（不静默留洞）。
	 */
	readonly resolveFragment?: (name: string) => string | undefined;
	/**
	 * 环境块取数的时刻，缺省 `new Date()`。可注入是为了纯函数可测：
	 * 固定 now 才能断言环境块的完整文本。
	 */
	readonly now?: Date;
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
 * mode:<id> = 交互模式行为段；skills / pi-context / time / expert 同名段落；
 * style:<id> = 回复风格段（注入点在交互段之后，见 composePromptWithMeta）；
 * memory-system = 记忆行为纪律段，memory = 三层记忆内容段（注入点见
 * composePromptWithMeta 内注释）。
 */
export type PromptSegmentSource =
	| "skeleton"
	| "skills"
	| "pi-context"
	| "time"
	| "expert"
	| "memory-system"
	| "memory"
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
	 * 落在核心段末尾 —— 此时它仍在 pi-context / time 之前，位序语义不变。
	 * expert 模式不注入：选定专家后用户自定义风格让位于人格（WorkBuddy
	 * user-context-expert-identity 的精简语义 —— 表达层的唯一权威是人格，
	 * 风格与人格并存只会冲突）；craft/ask 等模式没有 expert 字段，不受影响。
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
	 * 记忆段：核心段（骨架 + 人格 + 模式）之后、pi 上下文之前。人格上前部
	 * 槽位后（spec: align-expert-system-workbuddy）记忆排在人格之后 —— 与
	 * WorkBuddy 选专家后精简用户自定义身份的让位方向一致（人格优先于用户侧
	 * 设定）。两段都推在残留检查**之后**：记忆内容是用户数据，用户往
	 * MEMORY.md 里写了「{{示例}}」不该让会话组装抛错（残留检查管的是
	 * 骨架/模式/片段的笔误，不管用户数据）。段文本只经 trim 不再压平：按段
	 * 压平服务于 finalizeCore 的等价性论证，这里的段自带 \n\n 前缀、join
	 * 后接缝天然是两个换行。
	 */
	if (input.memorySystemBody !== undefined && input.memorySystemBody.trim() !== "") {
		all.push({
			source: "memory-system",
			text: `\n\n## 记忆系统\n\n${input.memorySystemBody.trim()}`,
		});
	}
	if (input.memoryContent !== undefined && input.memoryContent.trim() !== "") {
		all.push({ source: "memory", text: `\n\n${input.memoryContent.trim()}` });
	}
	const piBlock = formatPiContextBlock(input);
	if (piBlock !== "") {
		all.push({ source: "pi-context", text: `\n\n${piBlock}` });
	}
	// 环境块放整个提示词的**末尾**：系统提示词前缀稳定利于 provider 前缀缓存
	// （前面各段同分钟内字节一致，变化的只有最后一小段）。
	all.push({ source: "time", text: `\n\n${formatRuntimeTime(input.now ?? new Date())}` });
	/*
	 * <current-expert> 钉子段放最末（WorkBuddy CurrentExpertReminderSection 的
	 * 同款防漂移：多轮对话后模型会忘记自己的专家身份，它每轮 user-context 钉一次）。
	 * 只是钉子：专家名 + 一句「遵循其角色与工作流」，人格本体只在前部槽位
	 * 出现一次 —— 重复人格既浪费 token，两处文本还有漂移风险。
	 * v1 没有用户消息级注入机制（WorkBuddy 的 composeUserPrompt），钉子段随每轮
	 * 重组的系统提示词落在离对话历史最近的位置 —— 同一会话内它是稳定文本，
	 * 不破坏上面的前缀缓存口径。
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
 * （provenance 标注 mode:<id> / skills）；cwd / model 是行内标量，
 * 并入所在段——预览分段是段落级的，路径与模型名不成段。
 */
function fillSlots(piece: DraftSegment, input: ComposePromptInput, out: DraftSegment[]): void {
	const slots: Record<string, string> = {
		interaction: input.modeBody,
		skills: input.skillsSection,
		cwd: input.cwd,
		model: input.model ?? "",
	};

	let last = 0;
	for (const m of piece.text.matchAll(SLOT)) {
		const idx = m.index;
		const name = m[1];
		if (idx === undefined || name === undefined) continue;
		const raw = m[0];
		const value = slots[name];
		if (value === undefined) {
			throw new Error(
				`提示词骨架包含未支持的槽位「${raw}」。支持的槽位：${Object.keys(slots).join(" / ")}`,
			);
		}
		if (idx > last) out.push({ source: piece.source, text: piece.text.slice(last, idx) });
		if (name === "interaction" || name === "skills") {
			// 值段剥首尾换行（同片段内容的处理）：段落的边界空行归骨架作者控制，
			// 值自身不带 —— 按段压平与旧的整体压平等价就靠这条（finalizeCore）。
			out.push({
				source: name === "interaction" ? `mode:${input.modeId ?? "unknown"}` : "skills",
				text: value.replace(/^\n+/, "").replace(/\n+$/, ""),
			});
		} else {
			out.push({ source: piece.source, text: value });
		}
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
