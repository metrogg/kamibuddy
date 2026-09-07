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
 * 本文件是薄胶水：不 import core（依赖方向 extensions → core 允许，
 * 但为了可测性这里只依赖注入的回调，同 permission-gate 的做法）。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export interface PromptSwitchOptions {
	/** 当前两轴。权威状态在宿主（SessionHost / daemon 的 conversation 折叠），经此读取。 */
	readonly getCurrent: () => { readonly sceneId: string; readonly interactionId: string };
	/** 组装最终提示词。抛错会沿 pi 的事件链向上传播，让这次 run 响亮失败。 */
	readonly compose: (sceneId: string, interactionId: string) => Promise<string>;
}

export function createPromptSwitch(options: PromptSwitchOptions) {
	return (pi: ExtensionAPI): void => {
		pi.on("before_agent_start", async () => {
			const { sceneId, interactionId } = options.getCurrent();
			return { systemPrompt: await options.compose(sceneId, interactionId) };
		});
	};
}
