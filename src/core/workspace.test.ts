/**
 * 工作空间的路径守卫与目录操作。
 *
 * 背景：工作空间目录内的写操作会被权限门**直接放行**（permission-policy.ts），
 * 所以「把哪个目录设为工作空间」就是安全边界本身。这里必须挡住：
 *   - 配置目录（~/.kamibuddy 里有 auth.json 密钥）及其祖先/内部
 *   - 应用所在目录（生产是安装目录，开发是本项目仓库）及其祖先/内部
 *   - 文件系统根、相对路径
 */

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createWorkspace, listWorkspaces, validateWorkspacePath } from "./workspace.ts";

const GUARDS = {
	configDir: "C:\\Users\\test\\.kamibuddy",
	appDir: "E:\\project\\kamibuddy",
} as const;

describe("validateWorkspacePath", () => {
	it("拒绝相对路径", () => {
		expect(validateWorkspacePath("docs/reports", GUARDS)).toMatch(/绝对路径/);
	});

	it("拒绝文件系统根", () => {
		expect(validateWorkspacePath("C:\\", GUARDS)).toMatch(/根目录/);
	});

	it("拒绝配置目录本身、其祖先与其内部", () => {
		expect(validateWorkspacePath("C:\\Users\\test\\.kamibuddy", GUARDS)).toMatch(/配置目录/);
		// 祖先：设为这里等于整个用户目录都放行
		expect(validateWorkspacePath("C:\\Users\\test", GUARDS)).toMatch(/配置目录/);
		// 内部子目录同样不行
		expect(validateWorkspacePath("C:\\Users\\test\\.kamibuddy\\sub", GUARDS)).toMatch(/配置目录/);
	});

	it("拒绝应用所在目录及其祖先", () => {
		expect(validateWorkspacePath("E:\\project\\kamibuddy", GUARDS)).toMatch(/应用目录/);
		expect(validateWorkspacePath("E:\\project", GUARDS)).toMatch(/应用目录/);
		expect(validateWorkspacePath("E:\\project\\kamibuddy\\src", GUARDS)).toMatch(/应用目录/);
	});

	it("Windows 下大小写不敏感", () => {
		expect(validateWorkspacePath("c:\\users\\test\\.kamibuddy", GUARDS)).toMatch(/配置目录/);
		expect(validateWorkspacePath("e:\\PROJECT\\kamibuddy", GUARDS)).toMatch(/应用目录/);
	});

	it("接受普通目录", () => {
		expect(validateWorkspacePath("D:\\work\\reports", GUARDS)).toBeUndefined();
		expect(validateWorkspacePath("C:\\Users\\test\\KamiBuddy", GUARDS)).toBeUndefined();
	});
});

describe("createWorkspace", () => {
	function tempRoot(): string {
		return mkdtempSync(join(tmpdir(), "kami-ws-test-"));
	}

	it("在根目录下创建同名目录并返回路径", () => {
		const root = tempRoot();
		const created = createWorkspace(root, "季度汇报");
		expect(created).toBe(join(root, "季度汇报"));
		expect(mkdirSync(created, { recursive: true })).toBeUndefined(); // 已存在时应返回 undefined
	});

	it("根目录不存在时先补建", () => {
		const root = join(tempRoot(), "not-exist-yet");
		expect(createWorkspace(root, "a")).toBe(join(root, "a"));
	});

	it("拒绝空名与纯空白", () => {
		const root = tempRoot();
		expect(() => createWorkspace(root, "")).toThrow(/名称/);
		expect(() => createWorkspace(root, "   ")).toThrow(/名称/);
	});

	it("拒绝非法字符与父目录逃逸", () => {
		const root = tempRoot();
		expect(() => createWorkspace(root, "a/b")).toThrow(/非法字符/);
		expect(() => createWorkspace(root, "a\\b")).toThrow(/非法字符/);
		expect(() => createWorkspace(root, "a:b")).toThrow(/非法字符/);
		expect(() => createWorkspace(root, "..")).toThrow(/非法字符|名称/);
		expect(() => createWorkspace(root, ".")).toThrow(/非法字符|名称/);
	});

	it("拒绝超长名称", () => {
		const root = tempRoot();
		expect(() => createWorkspace(root, "x".repeat(65))).toThrow(/过长/);
	});

	it("拒绝重名", () => {
		const root = tempRoot();
		createWorkspace(root, "dup");
		expect(() => createWorkspace(root, "dup")).toThrow(/已存在/);
	});
});

describe("listWorkspaces", () => {
	it("只返回子目录（不含文件），按名称排序", () => {
		const root = mkdtempSync(join(tmpdir(), "kami-ws-list-"));
		mkdirSync(join(root, "beta"));
		mkdirSync(join(root, "alpha"));
		writeFileSync(join(root, "notes.txt"), "not a workspace");

		expect(listWorkspaces(root)).toEqual([join(root, "alpha"), join(root, "beta")]);
	});

	it("根目录不存在时返回空列表", () => {
		expect(listWorkspaces(join(tmpdir(), "kami-ws-definitely-not-exist"))).toEqual([]);
	});
});
