/**
 * prompt:preview 的纯逻辑：按 {场景, 模式, 风格} 现场组装系统提示词，
 * 返回带来源标注的分段与总字数（设置页「提示词预览」的数据源）。
 *
 * 从 daemon/index.ts 抽出是为了可测（纯函数，不碰注册表与偏好文件）——
 * 与真实组装（composeSystemPrompt）的差异点全部集中在这一处，有注释钉住：
 *
 *   1. **无活会话**：piContext 置空（没有 pi 加载好的上下文文件 / 工具提示
 *      可拼），预览里 pi-context 段恒不出现；cwd 由调用方给（当前会话工作区）。
 *   2. **expert 模式不注入人格段**：预览与具体专家解耦（选专家是会话级状态，
 *      预览页只有三个选择器）。expert 模式下预览到的是「骨架 + expert 交互段」，
 *      真实会话还会多「当前专家人格段 + 末尾 <current-expert> 钉住段」——
 *      预览页的脚注如实说明这条差异，不让用户以为看到的就是专家完整提示词。
 *   3. **styleId 三态由请求显式表达**：空串 = 关闭；缺省 = 跟随当前偏好
 *      （走 resolveStyle 全链路，含配置漂移降级，与真实会话同一行为）；
 *      指定 id 时不做漂移容忍 —— 预览是调试工具，用户点名要看的风格不存在
 *      必须响亮报错，而不是静默换成默认风格让他对着错的段排查。
 *
 * 技能段与真实组装同一条门控：模式工具白名单里没有 read / bash 时不注入
 * （plan 模式没有这个工具，注入等于让模型去调一个不存在的工具）。
 */

import {
	composePromptWithMeta,
	formatSkillsSection,
	type SkillDescriptor,
} from "../core/prompt-composer.ts";
import { resolveStyle, type LoadedResources, type StyleResource } from "../core/resources.ts";
import type { PromptPreviewRequest, PromptPreviewResult } from "../shared/ipc.ts";

/** 预览组装的环境输入（daemon 侧现取：cwd / 真实技能清单 / 当前风格偏好）。 */
export interface PromptPreviewEnvironment {
	readonly cwd: string;
	/** 真实已安装技能（daemon 的 listSkills 现读结果）。 */
	readonly skills: readonly SkillDescriptor[];
	/** 偏好里的 styleId（undefined = 未配置）；request.styleId 缺省时跟随它。 */
	readonly preferredStyleId: string | undefined;
	/**
	 * 记忆段（daemon 现读的 loadMemorySystemPrompt / buildMemorySection 结果）。
	 * 与真实组装同源：预览少这两段就会与「此刻发消息看到的提示词」静默漂移。
	 * undefined = 读取降级 / 三层全空，对应段不出现（与真实组装同一行为）。
	 */
	readonly memorySystemBody?: string;
	readonly memoryContent?: string;
}

export function buildPromptPreview(
	resources: LoadedResources,
	request: PromptPreviewRequest,
	env: PromptPreviewEnvironment,
): PromptPreviewResult {
	const scene = resources.scenes.find((s) => s.id === request.sceneId);
	if (scene === undefined) throw new Error(`未知场景：${request.sceneId}`);
	const mode = resources.modes.find((m) => m.id === request.modeId);
	if (mode === undefined) throw new Error(`未知交互模式：${request.modeId}`);

	let style: StyleResource | undefined;
	if (request.styleId === undefined) {
		// 跟随当前偏好：与真实会话完全同一条 resolveStyle 路径（含漂移降级）。
		style = resolveStyle(resources.styles, env.preferredStyleId).style;
	} else if (request.styleId !== "") {
		style = resources.styles.find((s) => s.id === request.styleId);
		if (style === undefined) throw new Error(`未知回复风格：${request.styleId}`);
	}
	// request.styleId === "" → style 保持 undefined = 关闭风格注入。

	// 与 daemon composeSystemPrompt 同一条门控（理由见其注释）：plan 这类
	// 只读模式的工具白名单里没有 read / bash，技能段不注入。
	const hasSkillReader = mode.tools.some((t) => t === "read" || t === "bash");
	const skillsSection = hasSkillReader ? formatSkillsSection(env.skills) : "";

	const composed = composePromptWithMeta({
		sceneBody: scene.body,
		modeBody: mode.body,
		skillsSection,
		cwd: env.cwd,
		modeId: mode.id,
		resolveFragment: (name) => resources.fragments.get(name),
		...(style === undefined ? {} : { style: { id: style.id, body: style.body } }),
		...(env.memorySystemBody === undefined ? {} : { memorySystemBody: env.memorySystemBody }),
		...(env.memoryContent === undefined ? {} : { memoryContent: env.memoryContent }),
		// expert 人格段与 piContext 的差异点见文件头注释（差异 1 / 2）。
	});

	return {
		segments: composed.segments.map((s) => ({
			source: s.source,
			text: s.text,
			chars: s.text.length,
		})),
		totalChars: composed.text.length,
	};
}
