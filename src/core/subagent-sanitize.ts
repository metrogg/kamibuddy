/**
 * 子代理输出回传主代理前的去毒（防注入回灌，spec: add-subagent-task-tool）。
 *
 * 为什么需要：子代理输出会作为文本回灌进主代理的对话上下文。子代理读过的
 * 文档/网页里若埋了仿冒的 `Human:` / `Assistant:` 行首标记或 system-reminder
 * 标签，主代理侧的折叠/渲染逻辑可能把它误认为真实的对话角色或系统指令——
 * 恶意文档借此给主代理「下指令」。回传前必须破坏这两类标记的形态。
 *
 * 方案选择（两处都选「可读且稳定」的改写，内容不丢失）：
 *   - 行首角色标记：行首插入一个反引号。选反引号而非零宽字符——肉眼可见、
 *     diff 可见、不依赖字体渲染；行不再以 Human:/Assistant: 开头，形态即破。
 *   - system-reminder 行：尖括号换成形似的单角引号 ‹ ›。比 HTML 实体（&lt;）
 *     好在回灌后渲染干净，不会出现一坨实体文本。
 *
 * 边界决策：全文本统一处理，不跳过代码块。注入载荷最爱藏在代码块里，
 * 「代码块内不处理」等于给注入留白名单；误伤代价只是行首多一个反引号或
 * 尖括号变形，可读性几乎无损。其余文本（含普通提及 "system reminder" 的
 * 句子）一律不动，误伤率只压在两类目标上。
 */

/** 行首角色标记：允许前导空白。只认 ASCII 冒号——全角「：」不是折叠器识别的形态。 */
const ROLE_MARKER = /^\s*(?:Human|Assistant):/;

export function sanitizeSubagentOutput(text: string): string {
	return text
		.split("\n")
		.map((line) => {
			let out = line;
			// 含 system-reminder 的行：尖括号单角化，标签语法被破坏但文字仍可读。
			if (out.includes("system-reminder")) {
				out = out.replaceAll("<", "‹").replaceAll(">", "›");
			}
			// 行首 Human:/Assistant: 标记（可含前导空白）：插到行最开头，
			// 连「前导空白 + 标记」的形态一起破掉。
			if (ROLE_MARKER.test(out)) {
				out = `\`${out}`;
			}
			return out;
		})
		.join("\n");
}
