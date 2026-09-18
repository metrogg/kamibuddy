/**
 * skill_uninstall 工具扩展的胶水层测试。
 *
 * 钉的是接缝：注册名与入参 schema（只有 name）、成功返回「删了谁 + 删的是哪个目录」、
 * 以及**失败原样抛出** —— removeAgentSkill 的拒绝理由（不是模型创建的 / 名字不存在）
 * 就是模型要转述给用户的话，包装一层就丢了关键信息。
 * 删除入口是注入的：测试不碰 daemon、不碰真实技能目录。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { createSkillUninstallTool } from "./skill-uninstall-tool.ts";

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

function mount(
	removeSkill: (name: string) => { readonly name: string; readonly dir: string },
): Map<string, FakeToolDef> {
	const tools = new Map<string, FakeToolDef>();
	const fakePi = { registerTool: (def: FakeToolDef) => tools.set(def.name, def) } as unknown as ExtensionAPI;
	createSkillUninstallTool({ removeSkill })(fakePi);
	return tools;
}

describe("skill_uninstall", () => {
	it("注册名为 skill_uninstall，入参只有 name（且必填）", () => {
		const tool = mount(() => ({ name: "demo", dir: "/cfg/skills/demo" })).get("skill_uninstall");
		expect(tool).toBeDefined();
		expect(tool?.label).toBe("删除技能");
		const schema = tool?.parameters as { required?: string[]; properties?: Record<string, unknown> };
		expect(Object.keys(schema.properties ?? {})).toEqual(["name"]);
		expect(schema.required).toEqual(["name"]);
	});

	it("成功：回传技能名与删掉的目录（模型据此回报用户）", async () => {
		const seen: string[] = [];
		const tools = mount((name) => {
			seen.push(name);
			return { name, dir: `/cfg/skills/${name}` };
		});
		const result = await tools.get("skill_uninstall")!.execute("t1", { name: "hu-yan-luan-yu" });

		const text = result.content[0]?.text ?? "";
		expect(seen).toEqual(["hu-yan-luan-yu"]);
		expect(text).toContain("hu-yan-luan-yu");
		expect(text).toContain("/cfg/skills/hu-yan-luan-yu");
	});

	it("入参首尾空白被 trim", async () => {
		const seen: string[] = [];
		const tools = mount((name) => {
			seen.push(name);
			return { name, dir: `/cfg/skills/${name}` };
		});
		await tools.get("skill_uninstall")!.execute("t1", { name: "  demo  " });
		expect(seen).toEqual(["demo"]);
	});

	it("失败：把拒绝理由原样抛出（「不是模型创建的」要能被转述）", async () => {
		const raw = "技能「docx」不是模型创建的，不能由模型删除 —— 内置、市场安装与用户手工放置的技能都要用户自己在技能页处理";
		const tools = mount(() => {
			throw new Error(raw);
		});
		await expect(tools.get("skill_uninstall")!.execute("t1", { name: "docx" })).rejects.toThrow(raw);
	});
});
