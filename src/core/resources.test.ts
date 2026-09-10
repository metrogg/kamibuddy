/**
 * resources/ 加载器的测试。
 *
 * 加载器是「能力即数据」的入口；它若静默吞错，产品会以错误身份运行
 * （回落到 pi 的 coding assistant 提示词）。每条报错路径都有测试压着。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadResources, toDescriptors } from "./resources.ts";

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "kami-res-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

function writeScene(id: string, body = "骨架 {{interaction}}"): void {
	mkdirSync(join(dir, "scenes", id), { recursive: true });
	writeFileSync(
		join(dir, "scenes", id, "prompt.md"),
		`---\nid: ${id}\nlabel: 场景${id}\ndescription: 描述\nready: true\n---\n${body}`,
	);
}

function writeMode(id: string, tools = "[read]", body = "行为段"): void {
	mkdirSync(join(dir, "modes"), { recursive: true });
	writeFileSync(
		join(dir, "modes", `${id}.md`),
		`---\nid: ${id}\nlabel: 模式${id}\ndescription: 描述\nready: true\ntools: ${tools}\n---\n${body}`,
	);
}

describe("正常加载", () => {
	it("扫描场景与模式，ready 与工具白名单正确", () => {
		writeScene("work");
		writeMode("craft", "[read, write, edit]");
		writeMode("ask");

		const resources = loadResources(dir);
		expect(resources.scenes).toHaveLength(1);
		expect(resources.scenes[0]).toMatchObject({ id: "work", ready: true, body: "骨架 {{interaction}}" });
		expect(resources.modes.map((m) => m.id)).toEqual(["ask", "craft"]);
		expect(resources.modes.find((m) => m.id === "craft")?.tools).toEqual(["read", "write", "edit"]);
	});

	it("toDescriptors 只下发展示字段，工具白名单不下发", () => {
		writeScene("work");
		writeMode("craft", "[read]");
		const { scenes, modes } = toDescriptors(loadResources(dir));

		expect(scenes[0]).toEqual({ id: "work", label: "场景work", description: "描述", ready: true });
		const mode = modes[0];
		expect(mode).toEqual({ id: "craft", label: "模式craft", description: "描述", ready: true });
		// ModeDescriptor 上不应存在 tools —— UI 不需要也不该知道。
		expect(mode === undefined ? [] : Object.keys(mode)).not.toContain("tools");
	});

	it("ready 缺省为 false（漏写 = 不可选，安全侧默认）", () => {
		mkdirSync(join(dir, "scenes", "work"), { recursive: true });
		writeFileSync(
			join(dir, "scenes", "work", "prompt.md"),
			"---\nid: work\nlabel: L\ndescription: D\n---\n正文",
		);
		writeMode("craft");

		expect(loadResources(dir).scenes[0]?.ready).toBe(false);
	});
});

describe("报错路径", () => {
	it("目录缺失 → 抛错并提示 KAMIBUDDY_RESOURCES_DIR", () => {
		expect(() => loadResources(join(dir, "不存在"))).toThrow(/KAMIBUDDY_RESOURCES_DIR/);
	});

	it("场景目录缺 prompt.md → 抛错", () => {
		mkdirSync(join(dir, "scenes", "work"), { recursive: true });
		mkdirSync(join(dir, "modes"), { recursive: true });
		writeMode("craft");
		expect(() => loadResources(dir)).toThrow(/缺少 prompt\.md/);
	});

	it("frontmatter id 与目录名不一致 → 抛错", () => {
		mkdirSync(join(dir, "scenes", "work"), { recursive: true });
		writeFileSync(join(dir, "scenes", "work", "prompt.md"), "---\nid: 其他\nlabel: L\ndescription: D\n---\nx");
		mkdirSync(join(dir, "modes"), { recursive: true });
		writeMode("craft");
		// 报错里会带目录名（与目录名「work」不一致），所以断言两段而不是连续子串。
		expect(() => loadResources(dir)).toThrow(/id「其他」与目录名/);
	});

	it("模式缺 tools 字段 → 抛错（无白名单等于给全部工具，不可默认）", () => {
		writeScene("work");
		mkdirSync(join(dir, "modes"), { recursive: true });
		writeFileSync(join(dir, "modes", "craft.md"), "---\nid: craft\nlabel: L\ndescription: D\n---\nx");
		expect(() => loadResources(dir)).toThrow(/tools/);
	});

	it("空 scenes / 空 modes → 抛错", () => {
		mkdirSync(join(dir, "scenes"), { recursive: true });
		mkdirSync(join(dir, "modes"), { recursive: true });
		expect(() => loadResources(dir)).toThrow(/没有任何场景/);

		writeScene("work");
		expect(() => loadResources(dir)).toThrow(/没有任何交互模式/);
	});
});

describe("真实 resources/ 的回归约束", () => {
	it("craft 与 ask 的 tools 白名单必须含 present_files", () => {
		// 防未来重构时再次漏挂（2026-09-09 事故：注册进扩展但白名单没加，
		// 模型在真实会话里根本看不到 present_files，交付从来没发生过）。
		// 走 getResourcesDir() 读真实目录，不是 mkdtemp 的样例。
		const realDir = resolve(import.meta.dirname, "..", "..", "resources");
		const { modes } = loadResources(realDir);
		for (const id of ["craft", "ask"]) {
			const mode = modes.find((m) => m.id === id);
			expect(mode, `模式 ${id} 应存在`).toBeDefined();
			expect(mode?.tools, `模式 ${id} 的 tools 应含 present_files`).toContain("present_files");
		}
	});

	it("automation 三工具只在 craft 白名单，ask / plan 只读模式没有", () => {
		// 与 present_files 同款防护：扩展注册了但模式白名单漏加，模型就看不到工具。
		// ask / plan 是只读模式，不能建任务（spec：只读模式不加）。
		const realDir = resolve(import.meta.dirname, "..", "..", "resources");
		const { modes } = loadResources(realDir);
		const craft = modes.find((m) => m.id === "craft");
		expect(craft, "模式 craft 应存在").toBeDefined();
		for (const tool of ["automation_create", "automation_list", "automation_delete"]) {
			expect(craft?.tools, `craft 的 tools 应含 ${tool}`).toContain(tool);
		}
		for (const id of ["ask", "plan"]) {
			const mode = modes.find((m) => m.id === id);
			expect(mode?.tools, `${id} 不应有 automation_create`).not.toContain("automation_create");
		}
	});

	it("questionnaire 三模式白名单都有；powershell 只在 craft", () => {
		// 与 present_files 同款防护。questionnaire 三模式都加（plan 尤其需要：
		// 调研阶段就该把方向问清，spec: add-questionnaire-and-powershell）；
		// powershell 只给 craft（ask / plan 是只读模式，不给 shell）。
		const realDir = resolve(import.meta.dirname, "..", "..", "resources");
		const { modes } = loadResources(realDir);
		for (const id of ["craft", "ask", "plan"]) {
			const mode = modes.find((m) => m.id === id);
			expect(mode?.tools, `模式 ${id} 的 tools 应含 questionnaire`).toContain("questionnaire");
		}
		const craft = modes.find((m) => m.id === "craft");
		expect(craft?.tools, "craft 的 tools 应含 powershell").toContain("powershell");
		for (const id of ["ask", "plan"]) {
			const mode = modes.find((m) => m.id === id);
			expect(mode?.tools, `${id} 不应有 powershell`).not.toContain("powershell");
		}
	});
});
