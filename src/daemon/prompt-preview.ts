/**
 * prompt:preview 的纯逻辑：按 {场景, 模式, 风格, 专家} 现场组装系统提示词，
 * 返回带来源标注的分段与总字数（设置页「提示词预览」的数据源）。
 *
 * 从 daemon/index.ts 抽出是为了可测（纯函数，不碰注册表与偏好文件）。
 * **组装本体不在这里**：它调 core/system-prompt-composer.ts 的 assembleSystemPrompt
 * —— 与真实会话（daemon 的 composeSystemPrompt = 同一函数的注入版）同一段序、
 * 同一技能段门控。曾经的「与真实组装逐字对齐的镜像门控」已删：镜像必然漂移，
 * 而漂移的表现是「用户对着一个不存在的差异排查」。
 *
 * 预览与真实组装**仍有**的差异点集中在这一处，有注释钉住：
 *
 *   1. **无活会话**：piContext 置空（没有 pi 加载好的上下文文件 / 工具提示
 *      可拼），预览里 pi-context 段恒不出现。
 *   2. **styleId 三态由请求显式表达**：空串 = 关闭；缺省 = 跟随当前偏好
 *      （走 resolveStyle 全链路，含配置漂移降级，与真实会话同一行为）；
 *      指定 id 时不做漂移容忍 —— 预览是调试工具，用户点名要看的风格不存在
 *      必须响亮报错，而不是静默换成默认风格让他对着错的段排查。
 *
 * **预览只覆盖系统提示词**：骨架、片段、模式、风格、人格、技能清单、记忆行为
 * 纪律段。三段不在系统提示词里的事实也都不在这里：逐轮会变的三层记忆内容与
 * 个性化由 prompt-switch 的 `context` 事件按请求注入；随 run 变的当前时间
 * （`current_time`）、会话级的工作目录（`workspace_context`）与**随机器变的托管
 * 解释器路径（`python_env`）**由会话侧 hidden context 每轮注入（spec:
 * stabilize-prompt-prefix）。
 * 于是预览不再需要 cwd / 记忆内容 / 个性化 / 解释器路径四个环境输入：留着它们
 * 会让预览假装这些内容还在系统提示词里，与真实组装静默漂移。
 *
 * 专家人格与真实组装同一条路径：request.expertId 有值时按 env.experts 走
 * requireExpertPersona 解析并注入（前部人格段 + 末尾 <current-expert> 钉子段、
 * 风格让位于人格，全由组装本体承担），专家不在库中同样响亮报错。
 * 这样预览能覆盖专家人格（曾经是预览与真实组装的差异面，现已消除）。
 */

import { requireExpertPersona, type SkillDescriptor } from "../core/prompt-composer.ts";
import { assembleSystemPrompt } from "../core/system-prompt-composer.ts";
import type { ExpertDefinition } from "../core/experts.ts";
import { resolveStyle, type LoadedResources, type StyleResource } from "../core/resources.ts";
import type { PromptPreviewRequest, PromptPreviewResult } from "../shared/ipc.ts";

/** 预览组装的环境输入（daemon 侧现取：真实技能清单 / 专家库 / 当前风格偏好）。 */
export interface PromptPreviewEnvironment {
	/** 真实已安装技能（daemon 的 listSkills 现读结果）。 */
	readonly skills: readonly SkillDescriptor[];
	/** 真实专家库（daemon 的 loadExpertsNow 现读结果）；request.expertId 有值时按它解析人格。 */
	readonly experts: readonly ExpertDefinition[];
	/** 偏好里的 styleId（undefined = 未配置）；request.styleId 缺省时跟随它。 */
	readonly preferredStyleId: string | undefined;
	/**
	 * 记忆**行为纪律**段（daemon 现读的 loadMemorySystemPrompt 结果）。它是系统
	 * 提示词的一个段，所以必须在预览里 —— 少了这段，用户看到的预览就与「此刻
	 * 发消息看到的提示词」静默漂移。undefined = 读取降级，对应段不出现。
	 */
	readonly memorySystemBody?: string;
	/**
	 * 输出语言规则段（daemon 现读的 loadLanguagePrompt 结果，ARCHITECTURE §4.15）。
	 * 同 memorySystemBody：它是系统提示词的一个段，预览少了它就会与「此刻发消息
	 * 看到的提示词」静默漂移 —— 而这段恰恰是用户最需要能在预览里核对的一段
	 * （它要排到 `## 回复风格` 之后，位序错了正是本次要修的 bug）。
	 */
	readonly languageBody?: string;
}

/**
 * 为什么是 async：组装本体的技能段要 pi（formatSkillsForPrompt），而 pi 是
 * 首用时才装配的（见 daemon/index.ts 顶部的惰性说明）——预览不在启动关键路径上。
 */
export async function buildPromptPreview(
	resources: LoadedResources,
	request: PromptPreviewRequest,
	env: PromptPreviewEnvironment,
): Promise<PromptPreviewResult> {
	const scene = resources.scenes.find((s) => s.id === request.sceneId);
	if (scene === undefined) throw new Error(`未知场景：${request.sceneId}`);
	const mode = resources.modes.find((m) => m.id === request.modeId);
	if (mode === undefined) throw new Error(`未知交互模式：${request.modeId}`);

	// 专家与交互模式正交：只按 expertId 是否指定决定是否解析人格。与真实组装
	// （composeSystemPrompt）同一个解析函数 —— 预览看到的人格段与会话里的一致。
	// 指定 id 不在库中 → requireExpertPersona 响亮抛错（预览是调试工具，不降级）。
	const expert =
		request.expertId === undefined ? undefined : requireExpertPersona(env.experts, request.expertId);

	let style: StyleResource | undefined;
	if (request.styleId === undefined) {
		// 跟随当前偏好：与真实会话完全同一条 resolveStyle 路径（含漂移降级）。
		style = resolveStyle(resources.styles, env.preferredStyleId).style;
	} else if (request.styleId !== "") {
		style = resources.styles.find((s) => s.id === request.styleId);
		if (style === undefined) throw new Error(`未知回复风格：${request.styleId}`);
	}
	// request.styleId === "" → style 保持 undefined = 关闭风格注入。

	const assembled = await assembleSystemPrompt({
		resources,
		scene,
		mode,
		// 技能段门控（read / bash / use_skill）在组装本体里，预览不再镜像一份：
		// 门控只有一处，预览与真实会话不可能各说各话。
		skills: env.skills,
		...(style === undefined ? {} : { style: { id: style.id, body: style.body } }),
		...(expert === undefined ? {} : { expert }),
		...(env.memorySystemBody === undefined ? {} : { memorySystemBody: env.memorySystemBody }),
		...(env.languageBody === undefined ? {} : { languageBody: env.languageBody }),
		// piContext 的差异点见文件头注释（差异 1）。
	});

	return {
		segments: assembled.segments.map((s) => ({
			source: s.source,
			text: s.text,
			chars: s.text.length,
		})),
		totalChars: assembled.text.length,
	};
}
