import { describe, expect, it } from "vitest";
import {
	buildBranchId,
	buildTaskBranch,
	generateWorktreeUid,
	isAbsolutePath,
	isTaskBranch,
	repoDirName,
	requireBranchName,
	requireRepoCwd,
	slugifyBranch,
	TASK_BRANCH_PREFIX,
} from "./worktree.ts";

describe("slugifyBranch", () => {
	it("普通分支名原样小写", () => {
		expect(slugifyBranch("main")).toBe("main");
	});

	it("斜杠转横线（origin/main 形态）", () => {
		expect(slugifyBranch("origin/main")).toBe("origin-main");
		expect(slugifyBranch("feature/add-logon")).toBe("feature-add-logon");
	});

	it("大写折叠为小写", () => {
		expect(slugifyBranch("Release/2.0")).toBe("release-2-0");
	});

	it("连续非字母数字折叠成一个横线", () => {
		expect(slugifyBranch("a___b")).toBe("a-b");
		expect(slugifyBranch("a///b")).toBe("a-b");
	});

	it("首尾横线去掉", () => {
		expect(slugifyBranch("-abc-")).toBe("abc");
	});

	it("点号也转横线（v1.2.3 形态）", () => {
		expect(slugifyBranch("v1.2.3")).toBe("v1-2-3");
	});

	it("纯中文回落 worktree（否则会拼出以 - 开头的退化名）", () => {
		expect(slugifyBranch("修复登录")).toBe("worktree");
	});

	it("空串回落 worktree", () => {
		expect(slugifyBranch("")).toBe("worktree");
	});
});

describe("generateWorktreeUid", () => {
	it("固定随机源给出确定值，长度恒 8", () => {
		expect(generateWorktreeUid(() => 0)).toBe("00000000");
		expect(generateWorktreeUid(() => 0.5)).toBe("80000000");
		expect(generateWorktreeUid(() => 0.9999999)).toHaveLength(8);
	});

	it("输出恒为十六进制", () => {
		for (let i = 0; i < 20; i++) {
			expect(generateWorktreeUid()).toMatch(/^[0-9a-f]{8}$/);
		}
	});
});

describe("buildBranchId / buildTaskBranch", () => {
	it("分支 id = slug-uid，同时是副本目录名", () => {
		expect(buildBranchId("origin/main", "a1b2c3d4")).toBe("origin-main-a1b2c3d4");
	});

	it("任务分支带 workbuddy/ 前缀", () => {
		expect(buildTaskBranch("main", "a1b2c3d4")).toBe("workbuddy/main-a1b2c3d4");
	});

	it("前缀是清理逻辑的唯一判据", () => {
		expect(TASK_BRANCH_PREFIX).toBe("workbuddy/");
	});
});

describe("isTaskBranch", () => {
	it("命中我们建的分支", () => {
		expect(isTaskBranch("workbuddy/main-a1b2c3d4")).toBe(true);
	});

	it("不命中用户自己的分支", () => {
		expect(isTaskBranch("main")).toBe(false);
		expect(isTaskBranch("feature/workbuddy-x")).toBe(false);
	});
});

describe("repoDirName", () => {
	it("Windows 路径取末段", () => {
		expect(repoDirName("D:\\DongProject\\kamibuddy")).toBe("kamibuddy");
	});

	it("POSIX 路径取末段", () => {
		expect(repoDirName("/home/u/proj")).toBe("proj");
	});

	it("尾部斜杠先剥掉再取末段", () => {
		expect(repoDirName("/home/u/proj/")).toBe("proj");
		expect(repoDirName("D:\\a\\proj\\")).toBe("proj");
	});

	it("清掉文件系统非法字符", () => {
		expect(repoDirName("D:\\a\\my:proj")).toBe("my_proj");
		expect(repoDirName("D:\\a\\re<po>")).toBe("re_po_");
	});

	it("盘符根路径也清成安全名", () => {
		expect(repoDirName("C:\\")).toBe("C_");
	});

	it("空串回落 workspace", () => {
		expect(repoDirName("")).toBe("workspace");
	});
});

describe("requireRepoCwd", () => {
	it("接受绝对路径", () => {
		expect(requireRepoCwd("D:\\proj")).toBe("D:\\proj");
		expect(requireRepoCwd("/home/u/proj")).toBe("/home/u/proj");
	});

	it("拒相对路径（副本目录会随进程 cwd 漂移）", () => {
		expect(() => requireRepoCwd("proj")).toThrow(/绝对路径/);
		expect(() => requireRepoCwd("./proj")).toThrow(/绝对路径/);
	});

	it("拒空串与非字符串", () => {
		expect(() => requireRepoCwd("")).toThrow(/非空字符串/);
		expect(() => requireRepoCwd(undefined)).toThrow(/非空字符串/);
		expect(() => requireRepoCwd(42)).toThrow(/非空字符串/);
	});
});

describe("requireBranchName", () => {
	it("接受常规分支名", () => {
		expect(requireBranchName("main")).toBe("main");
		expect(requireBranchName("feature/x")).toBe("feature/x");
		expect(requireBranchName("  release  ")).toBe("release");
	});

	it("拒含空白的名字（拦住把 shell 片段塞进分支名）", () => {
		expect(() => requireBranchName("main; rm -rf /")).toThrow(/非法字符|空白/);
		expect(() => requireBranchName("a b")).toThrow(/非法字符/);
	});

	it("拒以 - 开头", () => {
		expect(() => requireBranchName("-x")).toThrow(/不能以 - 开头/);
	});

	it("拒 `..` 与 `.lock` 结尾", () => {
		expect(() => requireBranchName("a..b")).toThrow(/形态非法/);
		expect(() => requireBranchName("main.lock")).toThrow(/形态非法/);
		expect(() => requireBranchName("a/")).toThrow(/形态非法/);
	});

	it("拒 git 保留字符", () => {
		for (const bad of ["a~b", "a^b", "a:b", "a?b", "a*b", "a[b", "a\\b"]) {
			expect(() => requireBranchName(bad)).toThrow(/非法字符/);
		}
	});

	it("拒空串与非字符串", () => {
		expect(() => requireBranchName("")).toThrow(/非空字符串/);
		expect(() => requireBranchName(null)).toThrow(/非空字符串/);
	});
});

describe("isAbsolutePath", () => {
	it("认盘符路径（两种分隔符都认）", () => {
		expect(isAbsolutePath("C:\\proj")).toBe(true);
		expect(isAbsolutePath("D:/proj")).toBe(true);
	});

	it("认 POSIX 绝对路径", () => {
		expect(isAbsolutePath("/home/u")).toBe(true);
	});

	it("不认相对路径", () => {
		expect(isAbsolutePath("proj")).toBe(false);
		expect(isAbsolutePath("./proj")).toBe(false);
	});

	it("不认 UNC 网络路径（副本建在网络盘上既慢又难清理）", () => {
		expect(isAbsolutePath("\\\\server\\share")).toBe(false);
	});
});
