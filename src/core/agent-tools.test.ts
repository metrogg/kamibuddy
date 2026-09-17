/**
 * pi 外部二进制就位逻辑的行为测试（用临时目录，不碰真实配置目录）。
 *
 * 钉三件事：**幂等**（已就位不动、不覆盖用户的版本）、**缺就照实报**、
 * **非 Windows 明确跳过**（随包资产只有 Windows x64，不假装成功）。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensureAgentTools } from "./agent-tools.ts";

let root = "";
let sourceDir = "";
let targetDir = "";

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "kami-agent-tools-"));
	sourceDir = join(root, "resources-bin");
	targetDir = join(root, "config-bin");
	mkdirSync(sourceDir, { recursive: true });
	writeFileSync(join(sourceDir, "fd.exe"), "FD-BINARY");
	writeFileSync(join(sourceDir, "rg.exe"), "RG-BINARY");
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

function ensure(): ReturnType<typeof ensureAgentTools> {
	return ensureAgentTools({ sourceDir, targetDir, platform: "win32" });
}

describe("ensureAgentTools", () => {
	it("首次：把随包资产补到目标目录，并如实报告", () => {
		const result = ensure();
		expect(result).toMatchObject({
			targetDir,
			installed: ["fd", "rg"],
			present: ["fd", "rg"],
			missing: [],
		});
		expect(readFileSync(join(targetDir, "fd.exe"), "utf8")).toBe("FD-BINARY");
	});

	it("第二次：已就位就不动（幂等，installed 为空）", () => {
		ensure();
		const second = ensure();
		expect(second).toMatchObject({ installed: [], present: ["fd", "rg"], missing: [] });
	});

	it("**不覆盖**已有文件：用户/环境里放的版本优先", () => {
		mkdirSync(targetDir, { recursive: true });
		writeFileSync(join(targetDir, "fd.exe"), "USER-VERSION");
		const result = ensure();
		expect(result.installed).toEqual(["rg"]);
		expect(readFileSync(join(targetDir, "fd.exe"), "utf8")).toBe("USER-VERSION");
	});

	it("随包资产缺某个二进制：算 missing，不编造也不阻断另一个", () => {
		rmSync(join(sourceDir, "fd.exe"));
		const result = ensure();
		expect(result).toMatchObject({ installed: ["rg"], present: ["rg"], missing: ["fd"] });
		expect(existsSync(join(targetDir, "fd.exe"))).toBe(false);
	});

	it("非 Windows：明确跳过并给出原因（不会去拷 .exe）", () => {
		const result = ensureAgentTools({ sourceDir, targetDir, platform: "darwin" });
		expect(result.skipped).toContain("Windows");
		expect(result.installed).toEqual([]);
		expect(existsSync(targetDir)).toBe(false);
	});

	it("什么都没得装时也不建空目录", () => {
		rmSync(join(sourceDir, "fd.exe"));
		rmSync(join(sourceDir, "rg.exe"));
		const result = ensure();
		expect(result).toMatchObject({ installed: [], present: [], missing: ["fd", "rg"] });
		expect(existsSync(targetDir)).toBe(false);
	});

	it("默认落点是 pi 自己的 bin 目录（`getAgentDir()/bin`，不是我们的配置目录）", () => {
		/*
		 * 这条钉住 2026-09-17 踩过的坑：pi 的 tools-manager 在模块加载时用
		 * `getBinDir()`（= getAgentDir()/bin，默认 ~/.pi/agent/bin）算死了它的
		 * 查找目录，与我们传给 createAgentSession 的 agentDir（~/.kamibuddy）无关。
		 * 推导必须走 pi 的公开函数，否则放错目录 = pi 永远找不到 = 又回到联网下载。
		 */
		const result = ensureAgentTools({ sourceDir, binaries: [] });
		expect(result.targetDir).toBe(join(getAgentDir(), "bin"));
	});
});
