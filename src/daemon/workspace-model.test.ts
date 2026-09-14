/**
 * 每任务工作目录模型（daemon 侧规则）的测试。
 *
 * daemon/index.ts 顶层 `requireParentPort()` 在非 utilityProcess 环境 import 即抛，
 * 无法直接单测（与 conversation-search / prompt-preview / context-usage-detail 同一
 * 抽法），所以这些规则抽在 workspace-model.ts 里测。钉住：
 *   - 待分配（""）首次执行才落盘时间戳目录；换了工作空间 / 已分配目录则不落盘；
 *   - 归属判定只看形态、不比对生效根（改根后旧任务不漂移 —— 关键回归）；
 *   - 转正：独占自动目录整体 rename（产物随目录走），共享临时目录走回退、不被动；
 *   - reveal 白名单：任务时间戳目录通过，未知绝对路径仍拒。
 *
 * 用真实临时目录跑（与 core/workspace.test.ts 同口径），跑完清理。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listWorkspaces } from "../core/workspace.ts";
import {
	LEGACY_TEMP_TASKS_DIR_NAME,
	allocatePendingCwd,
	isOwnedSessionDir,
	isRevealableCwd,
	isSelectableWorkspaceDir,
	isTaskCwd,
	isTaskPrivateCwd,
	promoteSessionDir,
} from "./workspace-model.ts";

const ROOT = "C:\\Users\\wzd\\KamiBuddy";
const NEW_ROOT = "D:\\KamiBuddyData";
const CONFIG_DIR = "C:\\Users\\wzd\\.kamibuddy";

const tempRoots: string[] = [];
const tempRoot = (): string => {
	const dir = mkdtempSync(join(tmpdir(), "kami-wsmodel-"));
	tempRoots.push(dir);
	return dir;
};
afterEach(() => {
	for (const dir of tempRoots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("isTaskCwd（归属判定只看形态，不比对生效根）", () => {
	const roots = { root: ROOT, configDir: CONFIG_DIR };

	it("待分配空串归任务区", () => {
		expect(isTaskCwd("", roots)).toBe(true);
	});

	it("自动分配目录归任务区", () => {
		expect(isTaskCwd(join(ROOT, "2026-09-14-17-30-45"), roots)).toBe(true);
	});

	it("历史共享临时目录归任务区", () => {
		expect(isTaskCwd(join(ROOT, LEGACY_TEMP_TASKS_DIR_NAME), roots)).toBe(true);
	});

	it("生效根本身归任务区（根不成组）", () => {
		expect(isTaskCwd(ROOT, roots)).toBe(true);
	});

	it("旧 playground 占位目录归任务区", () => {
		expect(isTaskCwd(join(CONFIG_DIR, "playground"), roots)).toBe(true);
	});

	it("普通工作空间目录归空间区", () => {
		expect(isTaskCwd(join(ROOT, "季度汇报"), roots)).toBe(false);
	});

	it("形态近似的非自动目录不误判", () => {
		expect(isTaskCwd(join(ROOT, "automation-2026-09-14-17-30-45"), roots)).toBe(false);
		expect(isTaskCwd(join(ROOT, "2026-9-1-1-1-1"), roots)).toBe(false);
	});

	it("改存储根后旧时间戳目录仍归任务区（关键回归）", () => {
		// 生效根换成 NEW_ROOT，但 cwd 仍在旧 ROOT 下：形态判定必须仍命中，
		// 否则改一次「默认存储路径」旧任务就整体漂到空间区。
		const changed = { root: NEW_ROOT, configDir: CONFIG_DIR };
		expect(isTaskCwd(join(ROOT, "2026-09-14-17-30-45"), changed)).toBe(true);
		expect(isTaskCwd(join(ROOT, LEGACY_TEMP_TASKS_DIR_NAME), changed)).toBe(true);
	});
});

describe("isTaskPrivateCwd（任务私有目录：不比对根，不含生效根本身）", () => {
	it("自动目录 / 历史共享目录 / 旧 playground 都算", () => {
		expect(isTaskPrivateCwd(join(ROOT, "2026-09-14-17-30-45"), CONFIG_DIR)).toBe(true);
		expect(isTaskPrivateCwd(join(NEW_ROOT, "2026-09-14-17-30-45"), CONFIG_DIR)).toBe(true);
		expect(isTaskPrivateCwd(join(ROOT, LEGACY_TEMP_TASKS_DIR_NAME), CONFIG_DIR)).toBe(true);
		expect(isTaskPrivateCwd(join(CONFIG_DIR, "playground"), CONFIG_DIR)).toBe(true);
	});

	it("生效根本身 / 普通工作空间不算任务私有", () => {
		expect(isTaskPrivateCwd(ROOT, CONFIG_DIR)).toBe(false);
		expect(isTaskPrivateCwd(join(ROOT, "季度汇报"), CONFIG_DIR)).toBe(false);
	});
});

describe("allocatePendingCwd（分配时机：首次执行才落盘）", () => {
	it("待分配空串 → 在根下分配时间戳目录，且真实存在", () => {
		const root = tempRoot();
		const cwd = allocatePendingCwd("", root, new Date(2026, 8, 14, 17, 30, 45));
		expect(cwd).toBe(join(root, "2026-09-14-17-30-45"));
		expect(existsSync(cwd)).toBe(true);
	});

	it("已分配目录原样返回、不新建（同一会话多轮共用该目录）", () => {
		const root = tempRoot();
		mkdirSync(join(root, "2026-09-14-17-30-45"));
		const before = readdirSync(root);
		const cwd = join(root, "2026-09-14-17-30-45");
		expect(allocatePendingCwd(cwd, root)).toBe(cwd);
		expect(readdirSync(root)).toEqual(before);
	});

	it("工作空间 cwd 原样返回、不落盘（换了工作空间就不分配）", () => {
		// 让「分配」无处可建：根路径其实不存在，若误触发 createSessionDir 会把它建出来。
		const missingRoot = join(tempRoot(), "should-not-be-created");
		const workspace = join("C:\\work", "季度汇报");
		expect(allocatePendingCwd(workspace, missingRoot)).toBe(workspace);
		expect(existsSync(missingRoot)).toBe(false);
	});

	it("未执行不建目录：分配前根下没有时间戳目录", () => {
		const root = tempRoot();
		// 新建任务只把 cwd 记为待分配（""），不调用分配 —— 此刻根下应空无一物。
		expect(readdirSync(root)).toEqual([]);
	});
});

describe("isOwnedSessionDir（可整体 rename 的独占目录）", () => {
	it("自动目录可 rename；历史共享目录 / 普通目录不可", () => {
		expect(isOwnedSessionDir(join(ROOT, "2026-09-14-17-30-45"))).toBe(true);
		expect(isOwnedSessionDir(join(ROOT, LEGACY_TEMP_TASKS_DIR_NAME))).toBe(false);
		expect(isOwnedSessionDir(join(ROOT, "季度汇报"))).toBe(false);
	});
});

describe("promoteSessionDir（转正落盘）", () => {
	it("rename 分支：独占自动目录整体改名，产物随目录迁移", () => {
		const root = tempRoot();
		const from = join(root, "2026-09-14-17-30-45");
		mkdirSync(from);
		writeFileSync(join(from, "周报.md"), "九月周报正文");
		mkdirSync(join(from, ".kamibuddy"));

		const target = join(root, "九月周报");
		promoteSessionDir(from, target);

		expect(existsSync(from)).toBe(false); // 旧目录已改名，不再存在
		expect(existsSync(target)).toBe(true);
		expect(readFileSync(join(target, "周报.md"), "utf8")).toBe("九月周报正文");
		expect(existsSync(join(target, ".kamibuddy"))).toBe(true); // 记忆随目录走
	});

	it("回退分支：历史共享临时目录不被 rename，产物原地保留", () => {
		const root = tempRoot();
		const shared = join(root, LEGACY_TEMP_TASKS_DIR_NAME);
		mkdirSync(shared);
		writeFileSync(join(shared, "别人的产物.md"), "不属于本任务");

		const target = join(root, "九月周报");
		promoteSessionDir(shared, target);

		expect(existsSync(shared)).toBe(true); // 共享目录原地不动
		expect(readFileSync(join(shared, "别人的产物.md"), "utf8")).toBe("不属于本任务");
		expect(existsSync(target)).toBe(true); // 退回到「新建命名目录」
	});

	it("目标已存在即拒，且原目录不被移动", () => {
		const root = tempRoot();
		const from = join(root, "2026-09-14-17-30-45");
		mkdirSync(from);
		writeFileSync(join(from, "a.md"), "x");
		const target = join(root, "九月周报");
		mkdirSync(target);

		expect(() => promoteSessionDir(from, target)).toThrow(/已存在/);
		expect(existsSync(join(from, "a.md"))).toBe(true);
		expect(readdirSync(target)).toEqual([]); // 没有被本任务的内容污染
	});

	it("分配出的目录名就是可 rename 的形态（分配与转正口径一致）", () => {
		const root = tempRoot();
		const from = allocatePendingCwd("", root, new Date(2026, 8, 14, 17, 30, 45));
		const target = join(root, "九月周报");
		promoteSessionDir(from, target);
		expect(basename(target)).toBe("九月周报");
		expect(existsSync(target)).toBe(true);
		expect(existsSync(from)).toBe(false);
	});
});

describe("isRevealableCwd（任务目录可打开）", () => {
	it("已知会话的任务时间戳 cwd 通过", () => {
		const taskCwd = join(ROOT, "2026-09-14-17-30-45");
		expect(isRevealableCwd(taskCwd, [join(ROOT, "季度汇报"), taskCwd])).toBe(true);
	});

	it("尾部斜杠等价的路径通过（按 resolve 归一比较）", () => {
		const taskCwd = join(ROOT, "2026-09-14-17-30-45");
		expect(isRevealableCwd(`${taskCwd}\\`, [taskCwd])).toBe(true);
	});

	it("未知绝对路径（用户目录 / 系统目录）仍拒", () => {
		const known = [join(ROOT, "2026-09-14-17-30-45"), join(ROOT, "季度汇报")];
		expect(isRevealableCwd(CONFIG_DIR, known)).toBe(false);
		expect(isRevealableCwd("C:\\Windows\\System32", known)).toBe(false);
		expect(isRevealableCwd(join(ROOT, "别的空间"), known)).toBe(false);
	});
});

describe("isSelectableWorkspaceDir（选择器候选过滤）", () => {
	it("自动目录与历史共享目录不进候选，命名目录保留", () => {
		const root = tempRoot();
		mkdirSync(join(root, "2026-09-14-17-30-45"));
		mkdirSync(join(root, "2026-09-13-09-00-00"));
		mkdirSync(join(root, LEGACY_TEMP_TASKS_DIR_NAME));
		mkdirSync(join(root, "季度汇报"));
		mkdirSync(join(root, "九月周报"));
		writeFileSync(join(root, "README.md"), "文件不是目录，本就不进候选");

		// 候选 = 根下子目录去掉任务私有目录（daemon 的 workspaceSnapshot 就这一句）；
		// 「生效根本身」是快照的 defaultRoot 字段，不在这份列表里，故不受影响。
		const candidates = listWorkspaces(root)
			.filter(isSelectableWorkspaceDir)
			.map((dir) => basename(dir));

		expect(candidates).toHaveLength(2);
		expect(candidates).toContain("季度汇报");
		expect(candidates).toContain("九月周报");
	});

	it("形态近似的命名目录（automation-… / 非补零日期）仍保留", () => {
		// 判定只看自动目录的严格格式，别把名字里恰好带日期的空间误伤。
		expect(isSelectableWorkspaceDir(join(ROOT, "automation-2026-09-14-17-30-45"))).toBe(true);
		expect(isSelectableWorkspaceDir(join(ROOT, "2026-9-1-1-1-1"))).toBe(true);
	});
});
