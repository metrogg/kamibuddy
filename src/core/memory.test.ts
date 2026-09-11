/**
 * 三层记忆文件层的测试。
 *
 * 重点钉住：全空 → undefined（零 token 不注入）、单份读取失败降级为空
 * （记忆是增强不是门槛，一份坏了不该拖垮整个注入段）、
 * 日志清单按日期倒序只取最近 3 个且只列文件名。
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildMemorySection,
	loadMemorySystemPrompt,
	profilePath,
	userMemoryPath,
	workspaceMemoryDir,
} from "./memory.ts";

let configDir: string;
let cwd: string;

beforeEach(() => {
	const stamp = `kbmem-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	configDir = join(tmpdir(), stamp, "config");
	cwd = join(tmpdir(), stamp, "ws");
	mkdirSync(configDir, { recursive: true });
	mkdirSync(cwd, { recursive: true });
	process.env["KAMIBUDDY_CONFIG_DIR"] = configDir;
});

afterEach(() => {
	delete process.env["KAMIBUDDY_CONFIG_DIR"];
	rmSync(join(configDir, ".."), { recursive: true, force: true });
});

describe("路径推导", () => {
	it("用户级记忆与画像在配置目录下，工作区记忆目录随 cwd 走", () => {
		expect(userMemoryPath()).toBe(join(configDir, "MEMORY.md"));
		expect(profilePath()).toBe(join(configDir, "PROFILE.md"));
		expect(workspaceMemoryDir(cwd)).toBe(join(cwd, ".kamibuddy", "memory"));
	});
});

describe("buildMemorySection", () => {
	it("三层全空 → undefined（零 token，不注入内容段）", () => {
		expect(buildMemorySection(cwd)).toBeUndefined();
	});

	it("只有用户级记忆 → 只含用户级段", () => {
		writeFileSync(userMemoryPath(), "报告一律用表格呈现数据。", "utf8");
		const section = buildMemorySection(cwd);
		expect(section).toContain("## 长期记忆（用户级）");
		expect(section).toContain("报告一律用表格呈现数据。");
		expect(section).not.toContain("## 用户画像");
		expect(section).not.toContain("## 本项目记忆");
	});

	it("画像与项目记忆各自成段", () => {
		writeFileSync(profilePath(), "制造业财务背景。", "utf8");
		const wsDir = workspaceMemoryDir(cwd);
		mkdirSync(wsDir, { recursive: true });
		writeFileSync(join(wsDir, "MEMORY.md"), "本项目交付物统一走 docx。", "utf8");
		const section = buildMemorySection(cwd);
		expect(section).toContain("## 用户画像\n\n制造业财务背景。");
		expect(section).toContain("## 本项目记忆\n\n本项目交付物统一走 docx。");
	});

	it("日志清单按文件名日期倒序、只取最近 3 个、只列文件名不读正文", () => {
		const wsDir = workspaceMemoryDir(cwd);
		mkdirSync(wsDir, { recursive: true });
		for (const day of ["2026-09-07", "2026-09-08", "2026-09-10", "2026-09-11", "2026-09-09"]) {
			writeFileSync(join(wsDir, `${day}.md`), `${day} 的正文不应出现`, "utf8");
		}
		// 非日志命名（含项目笔记自身）不进清单。
		writeFileSync(join(wsDir, "MEMORY.md"), "项目笔记", "utf8");
		writeFileSync(join(wsDir, "draft.md"), "草稿", "utf8");

		const section = buildMemorySection(cwd);
		expect(section).toContain("### 近期日志（按需读取）");
		expect(section).toContain("- 2026-09-11.md\n- 2026-09-10.md\n- 2026-09-09.md");
		expect(section).not.toContain("2026-09-08.md");
		expect(section).not.toContain("2026-09-07.md");
		expect(section).not.toContain("正文不应出现");
	});

	it("单份文件读取失败降级为空，不拖垮其它层（记忆是增强不是门槛）", () => {
		// 用「目录占用文件路径」制造读错：readFileSync 对目录会抛 EISDIR/EPERM。
		mkdirSync(userMemoryPath(), { recursive: true });
		writeFileSync(profilePath(), "画像仍在。", "utf8");
		const section = buildMemorySection(cwd);
		expect(section).not.toContain("## 长期记忆（用户级）");
		expect(section).toContain("## 用户画像\n\n画像仍在。");
	});

	it("全部内容只有空白字符 → 视为空（undefined）", () => {
		writeFileSync(userMemoryPath(), "  \n\n  ", "utf8");
		expect(buildMemorySection(cwd)).toBeUndefined();
	});
});

describe("loadMemorySystemPrompt", () => {
	it("随应用分发的 memory-system.md 存在且非空（资源缺失在这里拦，不靠运行时降级兜底）", () => {
		const realDir = resolve(import.meta.dirname, "..", "..", "resources");
		const body = loadMemorySystemPrompt(realDir);
		expect(body).toBeDefined();
		expect(body).toContain("记忆");
	});

	it("目录下没有该文件 → undefined（compose 注入路径不炸）", () => {
		expect(loadMemorySystemPrompt(configDir)).toBeUndefined();
	});
});
