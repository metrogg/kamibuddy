/**
 * spill 钩子的测试：把「工具结果 → 模型」这条公共路径的**取舍**钉住。
 *
 * 覆盖三类：
 *   - 阈值内不动结果（pi 侧连 content 重建都省了）；
 *   - 超限换成「头部 + 路径」，且那个文件真实存在（去读它，不看返回值自述）；
 *   - 两类刻意放行：read 的结果（否则 read → spill → read 循环）与
 *     含非文本块的结果（图片等块的归属不归本层）。
 */

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExtensionAPI, ToolResultEvent } from "@earendil-works/pi-coding-agent";
import { spillExtensionFactory, type SpillHookOptions } from "./spill-hook.ts";

/** 与 spill-hook.ts 的补丁形状一致（pi 的 ToolResultEventResult 未从包根导出）。 */
type SpillPatch = { readonly content: ToolResultEvent["content"] };

type Handler = (event: ToolResultEvent) => SpillPatch | undefined;

/** 装好扩展，返回注册到的 tool_result 处理器。 */
function mount(options: SpillHookOptions): Handler {
	let handler: Handler | undefined;
	const fakePi = {
		on: (_event: string, h: Handler) => {
			handler = h;
		},
	} as unknown as ExtensionAPI;
	spillExtensionFactory(options)(fakePi);
	if (handler === undefined) throw new Error("tool_result 钩子没有注册");
	return handler;
}

function event(toolName: string, content: unknown[]): ToolResultEvent {
	return {
		type: "tool_result",
		toolName,
		toolCallId: "t1",
		input: {},
		content,
		details: undefined,
		isError: false,
	} as unknown as ToolResultEvent;
}

describe("spill 钩子", () => {
	it("阈值内：不动结果（返回 undefined），也不落盘", () => {
		const dir = mkdtempSync(join(tmpdir(), "kamibuddy-spill-hook-"));
		const handler = mount({ dir, maxChars: 100 });

		expect(handler(event("powershell", [{ type: "text", text: "短输出" }]))).toBeUndefined();
	});

	it("超限：换成「头部 + 省略提示 + 路径」，落盘文件可被读回", () => {
		const dir = mkdtempSync(join(tmpdir(), "kamibuddy-spill-hook-"));
		const handler = mount({ dir, maxChars: 10 });
		const text = `${"A".repeat(10)}尾部`;

		const result = handler(event("web_fetch", [{ type: "text", text }]));
		const out = result?.content?.[0];
		expect(out?.type).toBe("text");
		const outText = out?.type === "text" ? out.text : "";

		expect(outText.startsWith("A".repeat(10))).toBe(true);
		expect(outText).toContain("已省略 2 个字符");
		// 提示里的路径就是落盘位置：从文本里取出路径再去读那个文件（验证世界）
		const match = /完整结果已存到 (.+?)，/.exec(outText);
		expect(match?.[1]).toBeDefined();
		expect(readFileSync(match?.[1] ?? "", "utf8")).toBe(text);
	});

	it("read 的结果不参与 spill（否则 read → spill → read 循环）", () => {
		const dir = mkdtempSync(join(tmpdir(), "kamibuddy-spill-hook-"));
		const handler = mount({ dir, maxChars: 10 });

		expect(handler(event("read", [{ type: "text", text: "R".repeat(100) }]))).toBeUndefined();
	});

	it("含非文本块的结果原样放行（块的定位与顺序不归本层）", () => {
		const dir = mkdtempSync(join(tmpdir(), "kamibuddy-spill-hook-"));
		const handler = mount({ dir, maxChars: 10 });
		const content = [
			{ type: "text", text: "T".repeat(100) },
			{ type: "image", data: "aGk=", mimeType: "image/png" },
		];

		expect(handler(event("mcp__x__y", content))).toBeUndefined();
	});
});
