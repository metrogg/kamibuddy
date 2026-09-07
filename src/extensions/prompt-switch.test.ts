/**
 * 提示词切换扩展的胶水测试（仿 permission-gate.test 的假 ExtensionAPI）。
 *
 * 策略本体在 prompt-composer / resources 里测过了，这里只钉接缝：
 * before_agent_start 被注册、每次触发都带「当时的两轴」去 compose、
 * compose 的返回值原样成为 systemPrompt。
 */

import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createPromptSwitch } from "./prompt-switch.ts";

type Handler = (event: unknown) => Promise<{ systemPrompt?: string } | undefined>;

function mount(options: {
	readonly axes: { sceneId: string; interactionId: string };
	readonly compose: (sceneId: string, interactionId: string) => Promise<string>;
}): Handler {
	let captured: Handler | undefined;
	const fakePi = {
		on: (event: string, handler: unknown) => {
			if (event === "before_agent_start") captured = handler as Handler;
		},
	} as unknown as ExtensionAPI;

	createPromptSwitch({
		getCurrent: () => options.axes,
		compose: options.compose,
	})(fakePi);

	if (captured === undefined) throw new Error("没有注册 before_agent_start 处理器");
	return captured;
}

describe("before_agent_start 接缝", () => {
	it("返回 compose 的产物作为 systemPrompt", async () => {
		const handler = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => "组装后的提示词",
		});
		const result = await handler({});
		expect(result?.systemPrompt).toBe("组装后的提示词");
	});

	it("每次触发都读当前两轴（模式切换后下一轮生效）", async () => {
		const axes = { sceneId: "work", interactionId: "craft" };
		const seen: string[] = [];
		const handler = mount({
			axes,
			compose: async (sceneId, interactionId) => {
				seen.push(`${sceneId}/${interactionId}`);
				return `${sceneId}/${interactionId}`;
			},
		});

		await handler({});
		axes.interactionId = "ask";
		const second = await handler({});

		expect(seen).toEqual(["work/craft", "work/ask"]);
		expect(second?.systemPrompt).toBe("work/ask");
	});

	it("compose 抛错时向上传播，不静默回落到 pi 默认提示词", async () => {
		// 回落到 coding assistant 等于产品身份错误且无声 —— 必须响亮。
		const handler = mount({
			axes: { sceneId: "work", interactionId: "craft" },
			compose: async () => {
				throw new Error("资源坏了");
			},
		});
		await expect(handler({})).rejects.toThrow("资源坏了");
	});
});
