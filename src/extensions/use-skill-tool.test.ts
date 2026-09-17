/**
 * use_skill 工具扩展的胶水层测试。
 *
 * 这里钉的是**接缝**：注册时的 schema 与名称、返回块与 pi 的 /skill: 展开是否
 * 同形、未知技能 / 已停用技能 / 模型不可见技能是否各自响亮报错（错误文本里必须带
 * 可用清单与可区分的理由，模型与用户靠它自我纠正）。技能来源是注入的，
 * 测试不碰 daemon、不碰真实技能目录（除临时文件外）。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUseSkillTool, type UseSkillTarget } from "./use-skill-tool.ts";

interface FakeToolDef {
	readonly name: string;
	readonly label: string;
	readonly description: string;
	readonly promptSnippet?: string;
	readonly promptGuidelines?: readonly string[];
	readonly parameters: unknown;
	readonly execute: (
		toolCallId: string,
		params: Record<string, unknown>,
	) => Promise<{ content: Array<{ type: "text"; text: string }>; details: unknown }>;
}

/** 装好扩展，返回按名称索引的工具定义表。 */
function mount(resolveSkills: () => readonly UseSkillTarget[]): { tools: Map<string, FakeToolDef> } {
	const tools = new Map<string, FakeToolDef>();
	const fakePi = {
		registerTool: (def: FakeToolDef) => {
			tools.set(def.name, def);
		},
	} as unknown as ExtensionAPI;
	createUseSkillTool({ resolveSkills })(fakePi);
	return { tools };
}

/** 造一个注入目标：缺省「启用 + 模型可见」，只给需要偏离的字段。 */
function target(name: string, filePath: string, patch: Partial<UseSkillTarget> = {}): UseSkillTarget {
	return { name, description: "", filePath, disableModelInvocation: false, enabled: true, ...patch };
}

let root: string;
/** 落一份真 SKILL.md，返回它的绝对路径（工具要真读盘）。 */
function writeSkillFile(name: string, body: string): string {
	const dir = join(root, name);
	mkdirSync(dir, { recursive: true });
	const filePath = join(dir, "SKILL.md");
	writeFileSync(filePath, body);
	return filePath;
}

const FRONTMATTER_BODY = "---\nname: docx\ndescription: 生成 Word 文档\n---\n\n# docx\n\n用 python-docx 生成。\n";

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "kami-use-skill-"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("注册", () => {
	it("注册名 use_skill、label「加载技能」，参数只有一个必填的字符串 command", () => {
		const { tools } = mount(() => []);
		const tool = tools.get("use_skill");
		expect(tool).toBeDefined();
		expect(tool?.label).toBe("加载技能");
		// schema 是 typebox 的 TSchema 对象：属性与 required 都在字面量里。
		const schema = tool?.parameters as {
			properties?: Record<string, { type?: string }>;
			required?: readonly string[];
		};
		expect(Object.keys(schema.properties ?? {})).toEqual(["command"]);
		expect(schema.properties?.command?.type).toBe("string");
		expect(schema.required).toEqual(["command"]);
		// 模型侧的指引（snippet + guidelines）必须点到「技能名取自清单、不凭记忆拼」。
		const modelFacingText = [tool?.promptSnippet, ...(tool?.promptGuidelines ?? [])].join("\n");
		expect(modelFacingText).toContain("<available_skills>");
		expect(modelFacingText).toContain("不凭记忆拼");
	});
});

describe("execute", () => {
	it("命中：返回与 pi /skill: 展开同形的块（首行、location 与相对路径基准行）", async () => {
		const filePath = writeSkillFile("docx", FRONTMATTER_BODY);
		const { tools } = mount(() => [target("docx", filePath, { description: "生成 Word 文档" })]);
		const result = await tools.get("use_skill")!.execute("t1", { command: "docx" });
		expect(result.content[0]?.text).toBe(
			`<skill name="docx" location="${filePath}">\nReferences are relative to ${dirname(filePath)}.\n\n# docx\n\n用 python-docx 生成。\n</skill>`,
		);
		// frontmatter 不带进上下文。
		expect(result.content[0]?.text).not.toContain("description: 生成 Word 文档");
		expect(result.details).toEqual({ name: "docx" });
	});

	it("技能名首尾空白被容忍，仍按精确名匹配", async () => {
		const filePath = writeSkillFile("docx", FRONTMATTER_BODY);
		const { tools } = mount(() => [target("docx", filePath)]);
		const result = await tools.get("use_skill")!.execute("t1", { command: " docx " });
		expect(result.content[0]?.text).toContain('<skill name="docx"');
	});

	it("未知技能：抛错并列出当前可用技能名", async () => {
		const filePath = writeSkillFile("docx", FRONTMATTER_BODY);
		const { tools } = mount(() => [target("docx", filePath), target("xlsx", filePath)]);
		const execute = tools.get("use_skill")!.execute;
		await expect(execute("t1", { command: "pptx" })).rejects.toThrow(/没有名为「pptx」的技能/);
		await expect(execute("t1", { command: "pptx" })).rejects.toThrow(/docx、xlsx/);
	});

	it("未知技能且会话无可用技能：错误文案不空转", async () => {
		const { tools } = mount(() => []);
		await expect(tools.get("use_skill")!.execute("t1", { command: "docx" })).rejects.toThrow(
			/当前会话没有可自动加载的技能/,
		);
	});

	it("disable-model-invocation 的技能被拒，并说明它只能手动 /skill: 或按路径引用", async () => {
		const filePath = writeSkillFile("typeset", FRONTMATTER_BODY);
		const { tools } = mount(() => [target("typeset", filePath, { disableModelInvocation: true })]);
		await expect(tools.get("use_skill")!.execute("t1", { command: "typeset" })).rejects.toThrow(
			/仅供用户手动 \/skill:typeset 或其它技能按路径引用/,
		);
	});

	it("已停用的技能被拒：文案说明已在技能页停用、可再启用（与「仅限手动」可区分）", async () => {
		const filePath = writeSkillFile("docx", FRONTMATTER_BODY);
		const { tools } = mount(() => [target("docx", filePath, { enabled: false })]);
		const error = await tools
			.get("use_skill")!
			.execute("t1", { command: "docx" })
			.catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
		// 两个拒绝理由不能混成一句：一个去技能页开开关，一个（作者声明）开关没用。
		expect(error).toContain("已在技能页被停用");
		expect(error).toContain("重新打开");
		expect(error).not.toContain("disable-model-invocation");
	});

	it("既停用又声明仅限手动时，报的是「已停用」（用户能在界面上解决的那一条）", async () => {
		const filePath = writeSkillFile("typeset", FRONTMATTER_BODY);
		const { tools } = mount(() => [
			target("typeset", filePath, { enabled: false, disableModelInvocation: true }),
		]);
		await expect(tools.get("use_skill")!.execute("t1", { command: "typeset" })).rejects.toThrow(
			/已在技能页被停用/,
		);
	});

	it("可用清单不列模型不可见或已停用的技能（列了等于让它再撞一次同样的错）", async () => {
		const visiblePath = writeSkillFile("docx", FRONTMATTER_BODY);
		const hiddenPath = writeSkillFile("typeset", FRONTMATTER_BODY);
		const offPath = writeSkillFile("legacy", FRONTMATTER_BODY);
		const { tools } = mount(() => [
			target("docx", visiblePath),
			target("typeset", hiddenPath, { disableModelInvocation: true }),
			target("legacy", offPath, { enabled: false }),
		]);
		const error = await tools
			.get("use_skill")!
			.execute("t1", { command: "ghost" })
			.catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
		expect(error).toContain("docx");
		expect(error).not.toContain("typeset");
		// 停用的技能也在清单外：提示里列它，模型会照着重试一次必然失败的加载。
		expect(error).not.toContain("legacy");
	});

	it("技能集合现取：换绑专家后同一次注册即可见新技能", async () => {
		let skills: readonly UseSkillTarget[] = [];
		const { tools } = mount(() => skills);
		const filePath = writeSkillFile("dcf-model-builder", FRONTMATTER_BODY);
		skills = [target("dcf-model-builder", filePath)];
		const result = await tools.get("use_skill")!.execute("t1", { command: "dcf-model-builder" });
		expect(result.content[0]?.text).toContain(`location="${filePath}"`);
	});
});
