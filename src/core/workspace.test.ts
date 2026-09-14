/**
 * 工作空间的路径守卫与目录操作。
 *
 * 背景：工作空间目录内的写操作会被权限门**直接放行**（permission-policy.ts），
 * 所以「把哪个目录设为工作空间」就是安全边界本身。这里必须挡住：
 *   - 配置目录（~/.kamibuddy 里有 auth.json 密钥）及其祖先/内部
 *   - 应用所在目录（生产是安装目录，开发是本项目仓库）及其祖先/内部
 *   - 文件系统根、相对路径
 */

import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { autoSessionDirName, isAutoSessionDirName } from "../shared/workspace.ts";
import { createSessionDir, createWorkspace, listWorkspaces, validateWorkspacePath } from "./workspace.ts";

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

describe("createSessionDir", () => {
	const tempRoots: string[] = [];
	const tempRoot = (): string => {
		const dir = mkdtempSync(join(tmpdir(), "kami-session-dir-"));
		tempRoots.push(dir);
		return dir;
	};
	// 用临时目录跑，跑完清理，绝不污染用户家目录或仓库根。
	afterEach(() => {
		for (const dir of tempRoots.splice(0)) rmSync(dir, { recursive: true, force: true });
	});

	it("正常创建：basename 是指定时间的本地格式，目录真实存在", () => {
		const root = tempRoot();
		const now = new Date(2026, 8, 14, 17, 30, 45); // 本地时间 2026-09-14 17:30:45
		const dir = createSessionDir(root, now);
		expect(basename(dir)).toBe("2026-09-14-17-30-45");
		expect(dir).toBe(join(root, "2026-09-14-17-30-45"));
		expect(existsSync(dir)).toBe(true);
	});

	it("同秒冲突：第二次落到 +1 秒，两个目录都在", () => {
		const root = tempRoot();
		const now = new Date(2026, 8, 14, 17, 30, 45);
		const first = createSessionDir(root, now);
		const second = createSessionDir(root, now);
		expect(basename(first)).toBe("2026-09-14-17-30-45");
		expect(basename(second)).toBe("2026-09-14-17-30-46");
		expect(existsSync(first)).toBe(true);
		expect(existsSync(second)).toBe(true);
	});

	it("跨分钟边界递增：按「基准 + 秒」换算，不被格式化截断搞错", () => {
		const root = tempRoot();
		const now = new Date(2026, 8, 14, 17, 30, 59);
		// 预建基准秒与下一秒，逼出第三个候选
		mkdirSync(join(root, "2026-09-14-17-30-59"));
		mkdirSync(join(root, "2026-09-14-17-31-00"));
		const third = createSessionDir(root, now);
		// 基准 + 2 秒 = 17:31:01；若实现对秒做字符串递增会错成 17:30:60 之类，这里锁住正确结果。
		expect(basename(third)).toBe("2026-09-14-17-31-01");
		expect(existsSync(third)).toBe(true);
	});

	it("root 不存在时递归补建（含中间层级）", () => {
		const root = join(tempRoot(), "deep", "nested", "root");
		expect(existsSync(root)).toBe(false);
		const dir = createSessionDir(root, new Date(2026, 8, 14, 17, 30, 45));
		expect(dir).toBe(join(root, "2026-09-14-17-30-45"));
		expect(existsSync(dir)).toBe(true);
	});

	it("第 100 次尝试命中「基准 +99 秒」", () => {
		const root = tempRoot();
		const now = new Date(2026, 8, 14, 17, 30, 45);
		// 预建 attempt 0..98 共 99 个连续秒目录，只剩最后一次尝试可用。
		for (let i = 0; i < 99; i += 1) {
			mkdirSync(join(root, autoSessionDirName(new Date(now.getTime() + i * 1000))));
		}
		const dir = createSessionDir(root, now);
		expect(basename(dir)).toBe("2026-09-14-17-32-24"); // 17:30:45 + 99s
	});

	it("100 个连续秒全被占用时响亮报错", () => {
		const root = tempRoot();
		const now = new Date(2026, 8, 14, 17, 30, 45);
		// 真实预建「上限」个目录来做等价断言，而不是导出内部常量：100 个空目录的创建成本极低，
		// 恰好填满上限即可触发耗尽分支（多建一个反而掩盖边界），用真实目录数锁行为比读常量更可靠。
		for (let i = 0; i < 100; i += 1) {
			mkdirSync(join(root, autoSessionDirName(new Date(now.getTime() + i * 1000))));
		}
		expect(() => createSessionDir(root, now)).toThrow(/时间戳会话目录/);
	});

	it("不传 now 时走真实时钟，basename 命中自动目录形态", () => {
		const root = tempRoot();
		const dir = createSessionDir(root);
		expect(isAutoSessionDirName(basename(dir))).toBe(true);
		expect(existsSync(dir)).toBe(true);
	});
});
