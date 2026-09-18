/**
 * skill_install 工具扩展的胶水层测试。
 *
 * 钉的是接缝：注册名与入参 schema、成功返回必须给出「安装位置 + 触发方式」
 * （模型照它回报用户）、装完要打出可分发的 zip（WorkBuddy skill-creator 的标准收尾）、
 * 以及**失败原样抛出** —— importSkill 的错误文本就是模型该改哪一处的指引，
 * 吞成「好像失败了」它只能瞎试（skill-creator §八 的硬约束）。
 * 安装与打包入口都是注入的：测试不碰 daemon、不碰真实技能目录。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import type { SkillInfo } from "../shared/settings.ts";
import { createSkillInstallTool } from "./skill-install-tool.ts";

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

/** 造一个 importSkill 的返回值：只给断言用得到的字段。 */
function installed(name: string, filePath: string): SkillInfo {
	return {
		name,
		description: "描述",
		filePath,
		origin: "user",
		disableModelInvocation: false,
		userInvocable: true,
		enabled: true,
	};
}

interface MountOptions {
	readonly installSkill: (sourcePath: string) => SkillInfo;
	readonly packSkill?: (skillDir: string, outFile: string) => Promise<number>;
	/** 会话工作区；undefined = 没有工作区（如 playground）。 */
	readonly workspaceDir: string | undefined;
}

function mount(options: MountOptions): Map<string, FakeToolDef> {
	const tools = new Map<string, FakeToolDef>();
	const fakePi = { registerTool: (def: FakeToolDef) => tools.set(def.name, def) } as unknown as ExtensionAPI;
	createSkillInstallTool({
		installSkill: options.installSkill,
		packSkill: options.packSkill ?? (async () => 1024),
		getWorkspaceDir: () => options.workspaceDir,
	})(fakePi);
	return tools;
}

describe("skill_install", () => {
	it("注册名为 skill_install，入参只有 sourcePath（且必填）", () => {
		const tools = mount({ installSkill: () => installed("demo", "/cfg/skills/demo/SKILL.md"), workspaceDir: "/ws" });
		const tool = tools.get("skill_install");
		expect(tool).toBeDefined();
		expect(tool?.label).toBe("安装技能");
		// typebox 序列化成 JSON Schema：{ type, required, properties }
		const schema = tool?.parameters as { required?: string[]; properties?: Record<string, unknown> };
		expect(Object.keys(schema.properties ?? {})).toEqual(["sourcePath"]);
		expect(schema.required).toEqual(["sourcePath"]);
	});

	it("成功：回传安装位置与触发方式（模型据此回报用户，不用自己拼路径）", async () => {
		const seen: string[] = [];
		const tools = mount({
			installSkill: (sourcePath) => {
				seen.push(sourcePath);
				return installed("hu-yan-luan-yu", "/cfg/skills/hu-yan-luan-yu/SKILL.md");
			},
			workspaceDir: "/ws",
		});
		const result = await tools.get("skill_install")!.execute("t1", {
			sourcePath: "D:\\KamiBuddy\\hu-yan-luan-yu",
		});

		const text = result.content[0]?.text ?? "";
		expect(seen).toEqual(["D:\\KamiBuddy\\hu-yan-luan-yu"]);
		expect(text).toContain("hu-yan-luan-yu");
		expect(text).toContain("/cfg/skills/hu-yan-luan-yu/SKILL.md");
		expect(text).toContain("/skill:hu-yan-luan-yu");
	});

	it("成功：打包技能目录并在工作区给出 zip 路径（交付由 present_files 负责）", async () => {
		const packed: Array<{ dir: string; out: string }> = [];
		const tools = mount({
			installSkill: () => installed("weekly-report", "/cfg/skills/weekly-report/SKILL.md"),
			packSkill: async (dir, out) => {
				packed.push({ dir, out });
				return 2048;
			},
			workspaceDir: "D:\\ws",
		});
		const result = await tools.get("skill_install")!.execute("t1", { sourcePath: "D:\\ws\\weekly-report" });

		const text = result.content[0]?.text ?? "";
		// 打包对象是**技能目录**（filePath 的父目录），不是 SKILL.md 本身。
		expect(packed).toEqual([{ dir: "/cfg/skills/weekly-report", out: "D:\\ws\\weekly-report.zip" }]);
		expect(text).toContain("D:\\ws\\weekly-report.zip");
		expect(text).toContain("present_files");
		expect((result.details as { zipPath?: string }).zipPath).toBe("D:\\ws\\weekly-report.zip");
	});

	it("没有工作区：不打包，也不假装有 zip（如实说明）", async () => {
		let packCalled = false;
		const tools = mount({
			installSkill: () => installed("demo", "/cfg/skills/demo/SKILL.md"),
			packSkill: async () => {
				packCalled = true;
				return 1;
			},
			workspaceDir: undefined,
		});
		const result = await tools.get("skill_install")!.execute("t1", { sourcePath: "D:\\ws\\demo" });

		const text = result.content[0]?.text ?? "";
		expect(packCalled).toBe(false);
		expect(text).toContain("没有工作区");
		expect(text).not.toContain(".zip");
		expect((result.details as { zipPath?: string }).zipPath).toBeUndefined();
	});

	it("打包失败：技能已装好这件事不能被说成失败（如实报出原始原因）", async () => {
		const tools = mount({
			installSkill: () => installed("demo", "/cfg/skills/demo/SKILL.md"),
			packSkill: async () => {
				throw new Error("磁盘已满");
			},
			workspaceDir: "D:\\ws",
		});
		const result = await tools.get("skill_install")!.execute("t1", { sourcePath: "D:\\ws\\demo" });

		const text = result.content[0]?.text ?? "";
		expect(text).toContain("已安装");
		expect(text).toContain("打包 zip 失败：磁盘已满");
		expect((result.details as { zipPath?: string }).zipPath).toBeUndefined();
	});

	it("入参首尾空白被 trim（模型常把路径带空格粘进来）", async () => {
		const seen: string[] = [];
		const tools = mount({
			installSkill: (sourcePath) => {
				seen.push(sourcePath);
				return installed("demo", "/cfg/skills/demo/SKILL.md");
			},
			workspaceDir: "/ws",
		});
		await tools.get("skill_install")!.execute("t1", { sourcePath: "  D:\\ws\\demo  " });
		expect(seen).toEqual(["D:\\ws\\demo"]);
	});

	it("失败：把 importSkill 的原始错误原样抛出去（不包装、不吞）", async () => {
		const raw = "技能「demo」已存在。如需替换，请先到技能目录手动删除旧的（/cfg/skills/demo）";
		const tools = mount({
			installSkill: () => {
				throw new Error(raw);
			},
			workspaceDir: "/ws",
		});
		const execute = tools.get("skill_install")!.execute;
		await expect(execute("t1", { sourcePath: "D:\\ws\\demo" })).rejects.toThrow(raw);
	});
});
