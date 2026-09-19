/**
 * 团队产出钩子的测试：把「任意工具结果末尾追加产出块」这条路径的**取舍**钉住。
 *
 * 覆盖三类（spec: unify-team-output-delivery 的 ADDED Requirements）：
 *   - 没有待送达产出 ⇒ 返回 undefined（零改动，pi 侧连 content 都不重建）；
 *   - 有产出块 ⇒ 补丁**只有 content**，原条目逐条原样，末尾多一个 text block；
 *   - 不就地改写宿主事件对象（原数组长度不变），且不设工具白名单
 *     （read / write / powershell / team_* 一律挂）。
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ExtensionAPI, ToolResultEvent } from "@earendil-works/pi-coding-agent";
import { createTeamOutputHook, type TeamOutputHookOptions } from "./team-output-hook.ts";

/** 与 team-output-hook.ts 的补丁形状一致（pi 的 ToolResultEventResult 未从包根导出）。 */
type TeamOutputPatch = { readonly content: ToolResultEvent["content"] };

type Handler = (event: ToolResultEvent) => TeamOutputPatch | undefined;

/** 装好扩展，返回注册到的 tool_result 处理器。 */
function mount(options: TeamOutputHookOptions): Handler {
	let handler: Handler | undefined;
	const fakePi = {
		on: (_event: string, h: Handler) => {
			handler = h;
		},
	} as unknown as ExtensionAPI;
	createTeamOutputHook(options)(fakePi);
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

describe("团队产出钩子", () => {
	it("composePending 返回 undefined：返回 undefined（工具结果逐字节不变）", () => {
		const handler = mount({ composePending: () => undefined });

		expect(handler(event("powershell", [{ type: "text", text: "原输出" }]))).toBeUndefined();
	});

	it("composePending 返回空串 / 纯空白：同样返回 undefined", () => {
		expect(mount({ composePending: () => "" })(event("read", []))).toBeUndefined();
		expect(mount({ composePending: () => "   " })(event("read", []))).toBeUndefined();
	});

	it("有块：补丁只有 content，原条目逐条原样 + 末尾多一条 text block", () => {
		const handler = mount({ composePending: () => " 团队成员 A 的产出 [fp abc]" });
		const original = { type: "text", text: "原输出" };
		const content = [original];

		const result = handler(event("powershell", content));

		expect(result).toBeDefined();
		// 只返回 content：details / isError / usage 不出现在补丁里（pi 侧保持原值）
		expect(Object.keys(result as object)).toEqual(["content"]);
		const out = (result as TeamOutputPatch).content;
		expect(out).toHaveLength(2);
		expect(out[0]).toBe(original);
		expect(out[1]).toEqual({ type: "text", text: " 团队成员 A 的产出 [fp abc]" });
	});

	it("event.content 为空数组时也能追加", () => {
		const handler = mount({ composePending: () => "产出块" });

		const result = handler(event("write", []));

		expect((result as TeamOutputPatch).content).toEqual([{ type: "text", text: "产出块" }]);
	});

	it("不就地修改传入的 event（原数组长度不变）", () => {
		const handler = mount({ composePending: () => "产出块" });
		const content = [{ type: "text", text: "原输出" }];
		const ev = event("powershell", content);

		const result = handler(ev);

		expect(content).toHaveLength(1);
		expect((ev as unknown as { content: unknown[] }).content).toHaveLength(1);
		// 必须是**新数组**，不是把原数组交回去
		expect((result as TeamOutputPatch).content).not.toBe(content);
	});

	it("不设工具白名单：read / write / powershell / team_* 一律追加", () => {
		const handler = mount({ composePending: () => "产出块" });

		for (const toolName of ["read", "write", "powershell", "team_status", "mcp__x__y"]) {
			const result = handler(event(toolName, [{ type: "text", text: toolName }]));
			expect((result as TeamOutputPatch).content).toHaveLength(2);
		}
	});
});

/**
 * 装配顺序护栏（spec: unify-team-output-delivery Task 4.1）。
 *
 * 为什么这条顺序是硬约束：pi 的 `tool_result` handler 是**逐扩展链式**的
 * （runner.js emitToolResult 把每个 handler 的返回值写回同一个 currentEvent、再交给
 * 下一个），而 spill-hook 用 `singleTextBlock` 判「唯一的文本块」。我们的块若先追加，
 * 结果就成了两块 ⇒ spill 直接跳过 ⇒ **带产出块的长输出不再落盘截断、绕过 spill 上界**。
 *
 * daemon 的 extensions 数组不可 import（`src/daemon/index.ts` 顶层 requireParentPort，
 * 脱离父进程即抛），所以这条钉在**源码调用序**上：两处装配调用的文本先后即注册先后
 * （`spillExtensionFactory({` / `createTeamOutputHook({` 这两个串只在调用点出现，import
 * 语句里不带 `(`）。把两段对调即变红。
 */
describe("装配顺序：team-output 钩子排在 spill 之后", () => {
	it("daemon 装配数组里 spillExtensionFactory 的调用在 createTeamOutputHook 之前", () => {
		const source = readFileSync(
			fileURLToPath(new URL("../../src/daemon/index.ts", import.meta.url)),
			"utf8",
		);
		const spillAt = source.indexOf("spillExtensionFactory({");
		const oursAt = source.indexOf("createTeamOutputHook({");
		expect(spillAt, "找不到 spill-hook 的装配调用（改名了？）").toBeGreaterThan(-1);
		expect(oursAt, "找不到 team-output 钩子的装配调用（改名了？）").toBeGreaterThan(-1);
		expect(spillAt).toBeLessThan(oursAt);
	});
});
