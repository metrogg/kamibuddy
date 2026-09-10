/**
 * questionnaire 工具的测试。
 *
 * 通道接线（daemon 的挂起 Map）与问卷弹层（renderer）各有归属，这里钉工具本体：
 *   - schema 边界（1-4 题、每题 2-6 个非空选项）—— pi 执行前按 schema 校验入参
 *     （pi-ai 的 validateToolArguments），所以边界全在 schema 层、直接测 schema；
 *   - 跳过 / 作答两种回程的工具结果形态（文案要指挥得动模型）；
 *   - unattended（无人值守 run 会话）直接返回不可用文案，不调 requestAnswers；
 *   - requestAnswers 收到的问题与模型入参一致（id 由工具生成）。
 */

import { describe, expect, it } from "vitest";
import { Compile } from "typebox/compile";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { QuestionnaireRequest, QuestionnaireResponse } from "../shared/ipc.ts";
import { questionnaireExtensionFactory } from "./questionnaire-tool.ts";

interface FakeToolResult {
	readonly content: ReadonlyArray<{ type: "text"; text: string }>;
	readonly details: { readonly skipped?: boolean } | undefined;
}

interface FakeToolDef {
	readonly name: string;
	readonly label: string;
	readonly parameters: unknown;
	readonly execute: (
		toolCallId: string,
		params: Record<string, unknown>,
	) => Promise<FakeToolResult>;
}

/** 装好扩展，返回注册到的 questionnaire 工具定义与 requestAnswers 调用记录。 */
function mount(options: {
	readonly answer?: (request: QuestionnaireRequest) => QuestionnaireResponse;
	readonly unattended?: boolean;
}): {
	readonly tool: FakeToolDef;
	readonly asked: QuestionnaireRequest[];
} {
	const asked: QuestionnaireRequest[] = [];
	let tool: FakeToolDef | undefined;
	const fakePi = {
		registerTool: (def: FakeToolDef) => {
			tool = def;
		},
	} as unknown as ExtensionAPI;

	questionnaireExtensionFactory({
		unattended: options.unattended,
		requestAnswers: async (request) => {
			asked.push(request);
			return (
				options.answer?.(request) ?? {
					id: request.id,
					skipped: false,
					answers: request.questions.map((q) => ({
						question: q.question,
						answer: q.options[0] ?? "",
					})),
				}
			);
		},
	})(fakePi);

	if (tool === undefined) throw new Error("questionnaire 工具没有注册");
	return { tool, asked };
}

/** 一题合法入参的便捷构造。 */
function oneQuestion(): Record<string, unknown> {
	return {
		questions: [{ question: "成果面向谁？", options: ["管理层", "项目组", "客户"] }],
	};
}

describe("schema 边界（pi 执行前校验，工具不再重复校验）", () => {
	const { tool } = mount({});
	// parameters 是 typebox 的 TSchema 对象，Compile 后即 JSON Schema 校验器。
	const check = Compile(tool.parameters as Parameters<typeof Compile>[0]);

	it("合法入参通过：1 题、每题 2 个选项起", () => {
		expect(check.Check(oneQuestion())).toBe(true);
	});

	it("0 题或 5 题都拒（1-4 题）", () => {
		expect(check.Check({ questions: [] })).toBe(false);
		const five = Array.from({ length: 5 }, (_, i) => ({
			question: `问题 ${i + 1}`,
			options: ["甲", "乙"],
		}));
		expect(check.Check({ questions: five })).toBe(false);
	});

	it("空问题、选项少于 2 个、多于 6 个、含空串选项都拒", () => {
		expect(check.Check({ questions: [{ question: "", options: ["甲", "乙"] }] })).toBe(false);
		expect(check.Check({ questions: [{ question: "选哪个？", options: ["甲"] }] })).toBe(false);
		expect(
			check.Check({
				questions: [{ question: "选哪个？", options: ["一", "二", "三", "四", "五", "六", "七"] }],
			}),
		).toBe(false);
		expect(check.Check({ questions: [{ question: "选哪个？", options: ["甲", ""] }] })).toBe(false);
	});
});

describe("注册形态", () => {
	it("工具名与面向用户的标题", () => {
		const { tool } = mount({});
		expect(tool.name).toBe("questionnaire");
		expect(tool.label).toBe("向用户提问");
	});
});

describe("作答回程", () => {
	it("requestAnswers 收到的问题与模型入参一致，id 由工具生成", async () => {
		const { tool, asked } = mount({});
		const params = {
			questions: [
				{ question: "按哪个方向改？", options: ["求职", "晋升"] },
				{ question: "要什么风格？", options: ["克制", "活泼"] },
			],
		};
		await tool.execute("t1", params);

		expect(asked).toHaveLength(1);
		expect(asked[0]?.id).not.toBe("");
		expect(asked[0]?.questions).toEqual(params.questions);
	});

	it("作答 → JSON 问答对，details 标记未跳过", async () => {
		const { tool } = mount({
			answer: (request) => ({
				id: request.id,
				skipped: false,
				answers: [
					{ question: "按哪个方向改？", answer: "求职" },
					{ question: "目标公司类型？", answer: "（其他）国企" },
				],
			}),
		});
		const result = await tool.execute("t1", oneQuestion());

		const parsed: unknown = JSON.parse(result.content[0]?.text ?? "");
		expect(parsed).toEqual([
			{ question: "按哪个方向改？", answer: "求职" },
			{ question: "目标公司类型？", answer: "（其他）国企" },
		]);
		expect(result.details?.skipped).toBe(false);
	});

	it("跳过 → 明确文案（按现有信息继续、不再追问），details 标记已跳过", async () => {
		const { tool } = mount({
			answer: (request) => ({ id: request.id, skipped: true, answers: [] }),
		});
		const result = await tool.execute("t1", oneQuestion());

		expect(result.content[0]?.text).toContain("跳过");
		expect(result.content[0]?.text).toContain("按现有信息继续");
		expect(result.content[0]?.text).toContain("追问");
		expect(result.details?.skipped).toBe(true);
	});
});

describe("unattended（无人值守 run 会话）", () => {
	it("直接返回不可用文案，不发起提问（不阻塞调度器）", async () => {
		const { tool, asked } = mount({ unattended: true });
		const result = await tool.execute("t1", oneQuestion());

		expect(asked).toHaveLength(0);
		expect(result.content[0]?.text).toContain("无人值守");
		expect(result.content[0]?.text).toContain("按现有信息继续");
		expect(result.details?.skipped).toBe(false);
	});
});
