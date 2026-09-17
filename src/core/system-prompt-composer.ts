/**
 * 系统提示词组装的**生产唯一入口**（依赖注入形态）。
 *
 * 为什么组装本体在这个文件而不是 daemon/index.ts 里（spec: stabilize-prompt-prefix
 * 的遗留项）：组装曾是 daemon 的私有函数，而 daemon 顶层要拿 process.parentPort
 * （起不了就没法 import），门禁测试只能「用同款输入自己镜像一遍」——于是有人往
 * daemon 那份里单独拼一个逐轮可变事实（比如 `formatRunTime(new Date())`）时，
 * 门禁**不会红**，而系统提示词位于整段对话历史之前，它内部任何一个字节逐轮变化
 * 都会让它之后的一切（含整段历史）在 provider 前缀缓存里整体失配（实测：字节
 * 未变 93% vs 变更一处 62%，见 docs/可观测性清单.md 的 CACHE8）。搬到这里后
 * daemon、设置页预览与门禁测试走的是**同一个函数**，镜像不再存在。
 *
 * 依赖用注入而不是直接 import：本体的副作用面收在调用方（专家库从紧加载、
 * 技能现读用户配置、风格漂移写事件日志、读偏好），注入后本体是纯的 ——
 * 测试能拿真资源跑而不读用户数据，探针也能拿真凭据跑同一个组装。
 *
 * 两段信息必须分清楚（本文件唯一的纪律）：
 *   - **会话内字节稳定**的内容（骨架 / 片段 / 模式 / 风格 / 人格 / 技能清单 /
 *     记忆行为纪律段 / pi-context）才进系统提示词；
 *   - 逐轮可能变的事实（运行时间、三层记忆内容、个性化、cwd）与**随机器变的事实**
 *     （托管 Python 解释器的绝对路径：venv 重建 / 换机器 / 换安装位置都会变）一律走
 *     append-only 的消息注入，**不进这里**（见 core/prompt-composer.ts 文件头）。
 *
 * 纪律的完整来历与对照：docs/提示词前缀缓存契约.md（dsh 的 PromptContext /
 * in-history 契约、计量纪律与门禁做法的消化稿，含我们仍未对齐的差距）。
 *
 * ── 模型体验契约（scripts/check-model-experience.ts 机械校验；改行为必须同步改这里）──
 * What the model sees: 产出的 `prompt` 字符串就是请求的 message 0（pi 的 forced 整串替换）；
 * `segments`（source + 字符数）与 `systemTokens` 只进台账与预览，不进请求。
 * Token effect: `systemTokens` 是字符估算（estimateTokens：CJK 约 1 token/字、其余约 4 字符/token，
 * **不是真 tokenizer**）；技能清单段另以 `skillsTokens` 单列供用量明细拆项。
 * KV Cache effect: 本模块是**前缀缓存的头部生产者** —— 同一会话两次组装必须逐字节相同；逐轮/逐 run
 * 会变的事实（时间、记忆内容、个性化、cwd）与随机器变的事实（托管 Python 路径）一律不得出现在产物里
 * （违反的代价是其后整段历史每轮全价重计费，见 docs/可观测性清单.md CACHE8）。段序、片段或护栏的
 * 产出字节一旦变化，改动点之后的整段前缀失配。
 */

import { contentFingerprint, type SystemSegmentStat } from "../shared/observability.ts";
import type { ExpertDefinition } from "./experts.ts";
import { loadMemorySystemPrompt } from "./memory.ts";
import { estimateTokens } from "./observability.ts";
import { readPreferences, type Preferences } from "./preferences.ts";
import {
	composePromptWithMeta,
	resolveSessionExpert,
	skillsSectionForMode,
	toExpertPersona,
	type ExpertPersona,
	type PromptContextOptions,
	type PromptSegment,
	type SkillDescriptor,
} from "./prompt-composer.ts";
import {
	DEFAULT_STYLE_ID,
	loadResources,
	resolveStyle,
	type LoadedResources,
	type ModeResource,
	type SceneResource,
} from "./resources.ts";

/** 组装出的系统提示词 + 派生的 token / 分段口径。 */
export interface ComposedSystemPrompt {
	readonly prompt: string;
	/** systemTokens：整篇（上下文成分统计用）。 */
	readonly systemTokens: number;
	/** 技能清单段单独算一份：用量明细要把「技能」从系统提示词里拆出来单列。 */
	readonly skillsTokens: number;
	/** 分段 provenance（source + 字符数）：台账 request_snapshot 的 system 部分。 */
	readonly segments: readonly SystemSegmentStat[];
}

export interface ComposeSystemPromptInput {
	readonly sceneId: string;
	readonly interactionId: string;
	readonly expertId: string | undefined;
	/**
	 * pi 在 before_agent_start 事件里给的上下文（contextFiles / toolSnippets /
	 * promptGuidelines）。resume 的估算补算与 prompt:preview 拿不到（要等
	 * before_agent_start），置空 —— 组装器对缺省的容忍见 core/prompt-composer.ts。
	 */
	readonly piContext?: PromptContextOptions;
}

/** 生产组装函数（创建一次、复用；无状态）。async：技能段要 pi（首用时才装配，见 prompt-composer.ts）。 */
export type SystemPromptComposer = (
	input: ComposeSystemPromptInput,
) => Promise<ComposedSystemPrompt>;

/**
 * 组装本体的输入：全部**已解析**（场景/模式已查到、技能已过滤、风格已解析、
 * 人格已构造）。解析层的分歧（预览的风格三态、专家的漂移容忍）留在各自的
 * 解析侧，本体只负责「按固定的段序与护栏拼出字节」这一件事。
 */
export interface AssembleSystemPromptInput {
	readonly resources: LoadedResources;
	readonly scene: SceneResource;
	readonly mode: ModeResource;
	/** 已启用技能（含专家私有技能，由调用方的单一出口给出）。 */
	readonly skills: readonly SkillDescriptor[];
	/** 已解析的回复风格；undefined = 不注入（偏好里显式关闭的态）。 */
	readonly style?: { readonly id: string; readonly body: string };
	/** 已解析的会话绑定专家人格；undefined = 未绑定（风格不被抑制）。 */
	readonly expert?: ExpertPersona;
	/** 记忆**行为纪律**段（不是记忆内容 —— 内容走注入路径）。 */
	readonly memorySystemBody?: string;
	readonly piContext?: PromptContextOptions;
}

export interface AssembledSystemPrompt {
	/** 最终提示词（= segments 顺序拼接，composer 保证字节一致）。 */
	readonly text: string;
	readonly segments: readonly PromptSegment[];
	/** 门控之后的技能清单段：skillsTokens 口径的下游（预览不关心）。 */
	readonly skillsSection: string;
}

/**
 * 组装本体：已解析输入 → 分段提示词。**这里就是系统提示词的字节来源**，
 * 任何往系统提示词里加东西的改动都落在这个函数（或其输入）上。
 *
 * 技能段门控收在这里（skillsSectionForMode）：模式工具白名单里 read / bash /
 * use_skill 一个都没有时不注入 —— 之前 daemon 与 prompt-preview 各写一份镜像，
 * 改一处漏一处会让预览与真实组装静默分家，现在只有这一处。
 */
export async function assembleSystemPrompt(
	input: AssembleSystemPromptInput,
): Promise<AssembledSystemPrompt> {
	const skillsSection = await skillsSectionForMode(input.mode.tools, input.skills);
	const composed = composePromptWithMeta({
		sceneBody: input.scene.body,
		modeBody: input.mode.body,
		skillsSection,
		modeId: input.mode.id,
		// 片段库查表：找不到返回 undefined → composer 抛错（不静默留洞上线）。
		resolveFragment: (name) => input.resources.fragments.get(name),
		...(input.style === undefined ? {} : { style: input.style }),
		...(input.memorySystemBody === undefined ? {} : { memorySystemBody: input.memorySystemBody }),
		...(input.expert === undefined ? {} : { expert: input.expert }),
		piContext: input.piContext,
	});
	return { text: composed.text, segments: composed.segments, skillsSection };
}

/** 风格配置漂移（偏好里的 id 不在资源库）。降级可以，但必须留痕。 */
export interface StyleDrift {
	readonly requested: string;
	readonly fallback: string;
}

/**
 * 组装本体的依赖。每一项都是「谁读盘 / 谁记录」的显式声明，本体自身不读盘、
 * 不写日志 —— 这条让本体可以在测试与探针里用真资源跑而不碰用户数据。
 */
export interface SystemPromptComposerDeps {
	/** 已加载资源（daemon 顶层 loadResources 的产物）。 */
	readonly resources: LoadedResources;
	/**
	 * 专家库现载（daemon 的 loadExpertsNow）。仅 expertId 有值时调用 ——
	 * 未绑定专家不走这条读路径（专家库加载从紧，坏专家文件不该拖垮三模式会话）。
	 */
	readonly loadExperts: () => readonly ExpertDefinition[];
	/**
	 * 已启用技能 → 提示词描述符（daemon 的 enabledSkills → toSkillDescriptors）。
	 * 现读不缓存：导入新技能后下一轮对话即生效。async：技能清单要 pi 的 loadSkills，
	 * 而 pi 是首用时才装配的（见 daemon/index.ts 顶部的惰性说明）。
	 */
	readonly enabledSkills: (
		expertId: string | undefined,
	) => Promise<readonly SkillDescriptor[]>;
	/** 偏好现读（风格三态：未配置 / 空串关闭 / 指定 id）。 */
	readonly readPreferences: () => Preferences;
	/** 记忆行为纪律段现读（loadMemorySystemPrompt(resourcesDir) 的产物）。 */
	readonly loadMemorySystemBody: () => string | undefined;
	/** 风格漂移的落点（daemon 写事件日志；探针打印）。 */
	readonly onStyleDrift: (drift: StyleDrift) => void;
	/** token 估算（core/observability.ts 的 estimateTokens）。 */
	readonly estimateTokens: (text: string) => number;
}

/**
 * 用注入的依赖造一个组装函数。
 *
 * 顺序刻意与旧实现一致：场景/模式先校验（不存在即抛），再解析专家、技能、风格
 * —— 场景 id 写错时不该先读到专家库。
 */
export function createSystemPromptComposer(deps: SystemPromptComposerDeps): SystemPromptComposer {
	return async (input) => {
		const scene = deps.resources.scenes.find((s) => s.id === input.sceneId);
		const mode = deps.resources.modes.find((m) => m.id === input.interactionId);
		if (scene === undefined || mode === undefined) {
			throw new Error(`场景或交互模式不存在：${input.sceneId} / ${input.interactionId}`);
		}
		// 专家与交互模式正交：只按 expertId 是否绑定决定是否解析专家，与模式无关
		//（选专家不改模式，切模式不清专家）。expertId 有值但不在库中在这里响亮抛错。
		const expert =
			input.expertId === undefined ? undefined : resolveSessionExpert(deps.loadExperts(), input.expertId);
		/*
		 * 回复风格每轮现读偏好（同技能清单的「现读」口径：设置页改完下一轮即生效）。
		 * 指定 id 不在资源库 = 配置漂移（风格被改名/删除）—— resolveStyle 降级默认
		 * 风格，这里把漂移交给调用方留痕：降级可以是体验取舍，但不能无痕。
		 */
		const { style, driftedFrom } = resolveStyle(deps.resources.styles, deps.readPreferences().styleId);
		if (driftedFrom !== undefined) {
			deps.onStyleDrift({ requested: driftedFrom, fallback: style?.id ?? DEFAULT_STYLE_ID });
		}
		// 记忆行为纪律段每轮现读（同技能清单口径）。读取失败单份降级为空、不抛错
		// —— 记忆是增强不是门槛（core/memory.ts 文件头）。
		const memorySystemBody = deps.loadMemorySystemBody();
		const assembled = await assembleSystemPrompt({
			resources: deps.resources,
			scene,
			mode,
			skills: await deps.enabledSkills(input.expertId),
			...(style === undefined ? {} : { style: { id: style.id, body: style.body } }),
			...(expert === undefined ? {} : { expert: toExpertPersona(expert) }),
			...(memorySystemBody === undefined ? {} : { memorySystemBody }),
			piContext: input.piContext,
		});
		return {
			prompt: assembled.text,
			systemTokens: deps.estimateTokens(assembled.text),
			skillsTokens: deps.estimateTokens(assembled.skillsSection),
			// 分段内容指纹（与消息指纹同一算法，见 shared/observability.ts 的
			// contentFingerprint）：相邻两轮的分段清单 diff 出「哪一段变了」靠它，
			// 缓存断点落在消息列表之前时（CACHE6 的 before_messages）才有话可说。
			// 仍不落正文：指纹不可逆。
			segments: assembled.segments.map((s) => ({
				source: s.source,
				chars: s.text.length,
				fp: contentFingerprint(s.text),
			})),
		};
	};
}

/** 生产构造入口的选项：只暴露「随部署/机器而变的来源」，其余走内置默认。 */
export interface SystemPromptComposerDefaults {
	/** resources/ 根目录：场景/模式/风格/片段与记忆纪律段的共同来源。 */
	readonly resourcesDir: string;
	/** 专家库现载（daemon 的 loadExpertsNow）。 */
	readonly loadExperts: () => readonly ExpertDefinition[];
	/** 已启用技能 → 提示词描述符（daemon 的 enabledSkills → toSkillDescriptors）。 */
	readonly enabledSkills: (
		expertId: string | undefined,
	) => Promise<readonly SkillDescriptor[]>;
	/** 风格漂移落点（daemon 写事件日志）。 */
	readonly onStyleDrift: (drift: StyleDrift) => void;
	/**
	 * 偏好读取。缺省 = 真实 preferences.json；**测试与探针可注入固定值**（偏好是
	 * 用户数据，读进来会让提示词随机器变，那样钉不住字节稳定这条不变量）。
	 */
	readonly readPreferences?: () => Preferences;
}

/**
 * 生产入口：按真实默认（读盘 + 真实 token 估算）造组装函数。
 *
 * 为什么 daemon 必须用它而不是自己 new 一份 deps：门禁测试调的就是这个函数 ——
 * 「往生产组装里塞一个逐轮可变事实」的改动会在测试里变红（spec:
 * stabilize-prompt-prefix 遗留项 1 要堵的洞）。
 */
export function createSystemPromptComposerFromDefaults(
	options: SystemPromptComposerDefaults,
): SystemPromptComposer {
	return createSystemPromptComposer({
		resources: loadResources(options.resourcesDir),
		loadExperts: options.loadExperts,
		enabledSkills: options.enabledSkills,
		onStyleDrift: options.onStyleDrift,
		loadMemorySystemBody: () => loadMemorySystemPrompt(options.resourcesDir),
		estimateTokens,
		readPreferences: options.readPreferences ?? readPreferences,
	});
}
