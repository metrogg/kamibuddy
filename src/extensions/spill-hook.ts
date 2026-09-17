/**
 * 工具结果 spill 钩子：**所有**工具结果回给模型前的统一加工点。
 *
 * 为什么是一个钩子而不是让每个工具自己调 spill：pi 0.85 已经给了
 * `tool_result` 事件（agent-session.ts 的 afterToolCall：handler 返回的
 * content 就是最终回给模型与落会话的那份），所以「工具结果 → 模型」这条
 * 公共路径只需要一处（AGENTS.md §4：公共部分抽出来，不许各写一遍）。
 * 三个好处：
 *   - 21 个工具 + pi 内置工具（grep/ls/…）+ MCP 工具全部一次覆盖，
 *     包括今天完全没有上限的 MCP 结果（mcp-client 直接 JSON.stringify）；
 *   - 各工具不再自己 `slice(0, 24k)` 丢信息（powershell / web-fetch 的
 *     旧截断已删，口径只剩 core/spill.ts 一份）；
 *   - 将来加工具不必记得「要截断」这件事。
 *
 * 覆盖范围刻意收窄（dsh 的 spill-policy 同口径）：
 *   - **跳过 read**：read 是回读 spill 文件的手段，让它的结果再落盘就成了
 *     read → spill → read 循环（dsh 的 post-execute 也跳过 read）；
 *   - **只认「唯一的文本块」**：含图片等非文本块的结果一律不动 —— 那些块的
 *     定位与顺序归各自工具管，本层只处理「一个纯文本结果」这一种形态；
 *   - 阈值内不动结果（返回 undefined = 不重建 content，pi 侧连图片归一化都省了）。
 *
 * 错误/被拦截的结果**同样**受这条上界约束（不跳过）：跳过等于给失败路径留一条
 * 无上限的通道（失败输出往往比成功还长），而落盘 + 路径对模型一样可读。
 * dsh 放行的是「被拦下的决策」，那种结果本来就不长，与「长错误输出」不是一回事。
 *
 * 失败语义见 core/spill.ts：落盘失败不改变调用成败，但会把原因写进文本。
 *
 * ── 模型体验契约（scripts/check-model-experience.ts 的三段；本文件不注册工具，
 * 故**具名**列进那个脚本的 NAMED_MODULES —— 它改变每一个工具结果，跳过它等于给
 * 「改写全部工具结果」留一条门禁外的路）──
 * What the model sees: 单个纯文本工具结果超过 SPILL_MAX_CHARS 时，被换成
 * 「头部（前 24k 字符，与改动前逐字节一致）+ 省略字符数 + 落盘路径 + read/grep 取回提示」；
 * 阈值内的结果、read 的结果、含非文本块的结果一字不改。
 * Token effect: 单次工具结果上界从「各工具各自截断」收敛到同一处；超限部分不进上下文
 * （只在磁盘上），代价是每次超限多付一行提示（约 100 字符）。
 * KV Cache effect: 只改**追加在历史之后**的工具结果块，系统提示词与既有前缀不动；
 * 同一个结果在同一次会话里不会二次改写（本钩子对同一 tool_result 只跑一次）。
 */

import type { ExtensionAPI, ToolResultEvent } from "@earendil-works/pi-coding-agent";
import { spillOversizedText, type SpillReport } from "../core/spill.ts";

/**
 * 回给 pi 的结果补丁。只写 content —— pi 的 patch 语义是「省略的字段保持原值」，
 * 所以 details / isError / usage 原样不动（本层不改这些）。
 * 不 import pi 的 ToolResultEventResult 类型：它没从包根导出（0.85.1 实测），
 * 这里按事件形状自取，结构相同即赋得进去。
 */
type SpillPatch = { readonly content: ToolResultEvent["content"] };

export interface SpillHookOptions {
	/** 落盘目录（daemon 传 config-paths 的 getSpillsDir(cwd)）。 */
	readonly dir: string;
	/** 阈值覆盖（测试用）。生产留空 = SPILL_MAX_CHARS。 */
	readonly maxChars?: number;
	/** 落盘失败上报（daemon 接到 event-log）。 */
	readonly report?: SpillReport;
}

/** 不做 spill 的工具：read 是取回落盘结果的手段，见文件头「跳过 read」。 */
const SKIP_TOOLS = new Set(["read"]);

export function spillExtensionFactory(options: SpillHookOptions) {
	return (pi: ExtensionAPI): void => {
		pi.on("tool_result", (event): SpillPatch | undefined => {
			if (SKIP_TOOLS.has(event.toolName)) return undefined;
			const text = singleTextBlock(event.content);
			if (text === undefined) return undefined;
			const spilled = spillOversizedText(text, {
				dir: options.dir,
				name: event.toolName,
				maxChars: options.maxChars,
				report: options.report,
			});
			// 文本没变（阈值内）就什么都不返回：undefined = 保持原结果不变。
			if (spilled.text === text) return undefined;
			return { content: [{ type: "text", text: spilled.text }] };
		});
	};
}

/** 唯一的文本块内容；结果含非文本块或不止一块时返回 undefined（原样放行）。 */
function singleTextBlock(content: ToolResultEvent["content"]): string | undefined {
	if (content.length !== 1) return undefined;
	const block = content[0];
	return block !== undefined && block.type === "text" ? block.text : undefined;
}
