/**
 * 提示词切换：pi 扩展，在每次 agent run 开始前注入组合好的 systemPrompt。
 *
 * 为什么用 before_agent_start：pi 官方的「每轮替换系统提示词」路径
 * （BeforeAgentStartEventResult.systemPrompt），run 结束自动清空 ——
 * 场景/模式切换不需要任何状态同步，权威状态始终在宿主侧。
 *
 * 关键代价（勿忘）：这个覆盖是**整体替换**，pi 默认会自动附加的
 * 技能清单、工作目录、上下文文件全部失效 —— compose 必须自己把这些拼全。
 *
 * 本文件是薄胶水：只 import core 的类型（PromptContextOptions，编译期擦除），
 * 运行时仍只依赖注入的回调，同 permission-gate 的做法，便于脱离宿主测试。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { PromptContextOptions } from "../core/prompt-composer.ts";

export interface PromptSwitchOptions {
	/**
	 * 当前两轴 + expert 绑定。权威状态在宿主（SessionHost / daemon 的
	 * conversation 折叠），经此读取。expertId 仅 expert 模式有值
	 * （选专家 = 切 expert 模式 + 绑定人格，spec: add-expert-mode）；
	 * 子代理 / run 会话不起专家，省略即可。
	 */
	readonly getCurrent: () => {
		readonly sceneId: string;
		readonly interactionId: string;
		readonly expertId?: string;
	};
	/** 组装最终提示词。抛错会沿 pi 的事件链向上传播，让这次 run 响亮失败。 */
	readonly compose: (
		sceneId: string,
		interactionId: string,
		expertId: string | undefined,
		piContext: PromptContextOptions,
	) => Promise<string>;
}

export function createPromptSwitch(options: PromptSwitchOptions) {
	return (pi: ExtensionAPI): void => {
		pi.on("before_agent_start", async (event) => {
			const { sceneId, interactionId, expertId } = options.getCurrent();
			// pi 在事件里已经给好它加载到的上下文文件与工具提示，这里透传，
			// 不再让宿主重复发现资源（BeforeAgentStartEvent.systemPromptOptions）。
			const piContext: PromptContextOptions = {
				contextFiles: event.systemPromptOptions.contextFiles,
				toolSnippets: event.systemPromptOptions.toolSnippets,
				promptGuidelines: event.systemPromptOptions.promptGuidelines,
			};
			return {
				systemPrompt: await options.compose(sceneId, interactionId, expertId, piContext),
			};
		});
	};
}
