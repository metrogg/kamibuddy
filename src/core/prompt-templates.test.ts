/**
 * prompt-templates 的测试：镜像 pi 的模板发现规则（dist/core/prompt-templates.js），
 * 保证补全列表与 pi 运行时实际能展开的 /命令 一致。
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listPromptTemplates } from "./prompt-templates.ts";

let base: string;
let agentDir: string;
let cwd: string;

beforeEach(() => {
	base = mkdtempSync(join(tmpdir(), "kami-prompt-templates-"));
	agentDir = join(base, "agent");
	cwd = join(base, "work");
	mkdirSync(join(agentDir, "prompts"), { recursive: true });
	mkdirSync(join(cwd, ".pi", "prompts"), { recursive: true });
});

afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

describe("cwd 缺省 / 空串 = 无项目级（只列全局模板）", () => {
	beforeEach(() => {
		writeFileSync(join(agentDir, "prompts", "global.md"), "全局模板");
		writeFileSync(join(cwd, ".pi", "prompts", "project.md"), "项目模板");
	});

	it("cwd 缺省：只列全局模板，项目级不入结果", () => {
		expect(listPromptTemplates(undefined, agentDir).map((t) => t.name)).toEqual(["global"]);
	});

	it("cwd 为空串：与缺省同义，只列全局（不把空串当项目路径去扫）", () => {
		expect(listPromptTemplates("", agentDir).map((t) => t.name)).toEqual(["global"]);
	});

	it("给定真实 cwd：全局 + 项目合并", () => {
		const names = listPromptTemplates(cwd, agentDir)
			.map((t) => t.name)
			.sort();
		expect(names).toEqual(["global", "project"]);
	});
});

describe("listPromptTemplates", () => {
	it("发现 agentDir/prompts 与 cwd/.pi/prompts 下的 .md，名字取文件名", () => {
		writeFileSync(join(agentDir, "prompts", "weekly.md"), "写一份周报");
		writeFileSync(join(cwd, ".pi", "prompts", "review.md"), "评审这份代码");

		const r = listPromptTemplates(cwd, agentDir);
		expect(r.map((t) => t.name).sort()).toEqual(["review", "weekly"]);
	});

	it("description 优先取 frontmatter，缺省用正文首行（超 60 字符截断）", () => {
		writeFileSync(
			join(agentDir, "prompts", "a.md"),
			"---\ndescription: 带说明的模板\n---\n正文内容",
		);
		writeFileSync(join(agentDir, "prompts", "b.md"), `第一行${"很长".repeat(40)}\n第二行`);

		const r = listPromptTemplates(cwd, agentDir);
		expect(r.find((t) => t.name === "a")?.description).toBe("带说明的模板");
		const b = r.find((t) => t.name === "b")?.description;
		expect(b?.endsWith("...")).toBe(true);
		expect(b?.length).toBe(63); // 60 + "..."
	});

	it("非递归、忽略非 .md 文件", () => {
		mkdirSync(join(agentDir, "prompts", "nested"));
		writeFileSync(join(agentDir, "prompts", "nested", "deep.md"), "深层模板");
		writeFileSync(join(agentDir, "prompts", "note.txt"), "不是模板");

		expect(listPromptTemplates(cwd, agentDir)).toEqual([]);
	});

	it("目录不存在时返回空列表", () => {
		const missing = join(base, "nothing");
		expect(listPromptTemplates(missing, missing)).toEqual([]);
	});

	it("frontmatter 写坏的文件跳过，不拖垮整个列表", () => {
		writeFileSync(join(agentDir, "prompts", "broken.md"), "---\n: 无法解析\n---\n正文");
		writeFileSync(join(agentDir, "prompts", "ok.md"), "正常模板");

		const r = listPromptTemplates(cwd, agentDir);
		expect(r.map((t) => t.name)).toEqual(["ok"]);
	});
});
