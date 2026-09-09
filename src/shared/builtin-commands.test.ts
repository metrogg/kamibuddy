import { describe, expect, it } from "vitest";
import { parseBuiltinCommand } from "./builtin-commands.ts";

describe("parseBuiltinCommand", () => {
	it("/new 精确匹配", () => {
		expect(parseBuiltinCommand("/new")).toEqual({ name: "new", args: "" });
	});

	it("/compact 无参数", () => {
		expect(parseBuiltinCommand("/compact")).toEqual({ name: "compact", args: "" });
	});

	it("/compact 带自定义指令（传给 pi 的 compact(customInstructions)）", () => {
		expect(parseBuiltinCommand("/compact 保留 API 相关的上下文")).toEqual({
			name: "compact",
			args: "保留 API 相关的上下文",
		});
	});

	it("/new 带参数不识别（新建任务没有参数语义，防误吞用户文本）", () => {
		expect(parseBuiltinCommand("/new 做个周报")).toBeUndefined();
	});

	it("/plan 精确匹配", () => {
		expect(parseBuiltinCommand("/plan")).toEqual({ name: "plan", args: "" });
	});

	it("/plan 带参数不识别（与 /new 同规则：防误吞用户文本）", () => {
		expect(parseBuiltinCommand("/plan 帮我规划")).toBeUndefined();
	});

	it("非内置命令不识别（技能 / 模板交给 pi 展开）", () => {
		expect(parseBuiltinCommand("/skill:docx")).toBeUndefined();
		expect(parseBuiltinCommand("/weekly 本周")).toBeUndefined();
	});

	it("非斜杠文本不识别", () => {
		expect(parseBuiltinCommand("帮我压缩一下上下文")).toBeUndefined();
		expect(parseBuiltinCommand("")).toBeUndefined();
	});
});
