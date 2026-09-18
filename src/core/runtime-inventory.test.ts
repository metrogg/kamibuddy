/**
 * 托管运行时的开关与清单（core/runtime-inventory.ts）+ 模型可见文案
 * （shared/runtimes.ts）的回归钉子。spec: add-managed-runtimes 阶段 3 / 5。
 *
 * 钉住四条：
 *   1. **开关只有一个读点**，且缺省全开（不设开关时与既有「启用态」一致；开关只管是否注入，与装没装无关）；
 *   2. **禁用 ⇒ 不给路径**（清单这一层就不出 activeDir / executable 两格，
 *      渲染层再挡一道 —— 见下）；
 *   3. **「已被用户禁用」与「未就绪（找不到）」是两句不同的话**（spec 的验收点：
 *      模型看到的必须可区分，不许静默降级成一句「不可用」）；
 *   4. 「关过」与「没设置过」在偏好文件里可区分（显式标记）。
 *
 * 用临时配置目录 + 假家目录跑：真实家目录里若存在 `~/.venv-html-to-docx`，
 * 解析会变成「复用旧路径」而不是「尚无实例」，断言就不稳了。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	collectRuntimeInventory,
	planRuntimeShellInjection,
	readRuntimeSwitch,
	runtimeDescriptorOf,
	writeRuntimeEnabled,
	writeRuntimeMaster,
	type RuntimeInventoryOverrides,
} from "./runtime-inventory.ts";
import { instanceDir, writeCurrent, writeManifest } from "./runtime-store.ts";
import { MANAGED_ROOT_ENV, pathKeyOf } from "./runtimes/injection.ts";
import { NODE_RUNTIME_ID, NODE_RUNTIME_VERSION } from "./runtimes/node.ts";
import { renderRuntimeEnvSection, type RuntimeInventory } from "../shared/runtimes.ts";

let configDir = "";
let homeDir = "";
const originalConfigDir = process.env["KAMIBUDDY_CONFIG_DIR"];

beforeEach(() => {
	configDir = mkdtempSync(join(tmpdir(), "kami-runtime-inventory-"));
	homeDir = join(configDir, "home");
	mkdirSync(homeDir, { recursive: true });
	process.env["KAMIBUDDY_CONFIG_DIR"] = configDir;
});

afterEach(() => {
	if (originalConfigDir === undefined) delete process.env["KAMIBUDDY_CONFIG_DIR"];
	else process.env["KAMIBUDDY_CONFIG_DIR"] = originalConfigDir;
	rmSync(configDir, { recursive: true, force: true });
});

/** 隔离的装配参数：临时托管根 + 假家目录 + 固定平台（断言不看真机）。 */
function overrides(): RuntimeInventoryOverrides {
	return { root: join(configDir, "runtimes"), homeDir, platform: "win32" };
}

function pythonEntry(inventory: RuntimeInventory): RuntimeInventory["items"][number] {
	const entry = inventory.items.find((item) => item.id === "python");
	if (entry === undefined) throw new Error("注册表里应当有 python 运行时");
	return entry;
}

describe("开关状态的唯一读点", () => {
	it("缺省：总开关开、逐项开（不设开关时与既有「启用态」一致）", () => {
		const state = readRuntimeSwitch();
		expect(state.master).toBe(true);
		expect(state.items).toEqual({});
		const inventory = collectRuntimeInventory(overrides());
		expect(inventory.master).toBe(true);
		expect(inventory.items.every((item) => item.enabled)).toBe(true);
	});

	it("逐项关闭写显式标记（false 落在 preferences.runtimes.items 里，不是删键）", () => {
		writeRuntimeEnabled("python", false);
		const file = JSON.parse(readFileSync(join(configDir, "preferences.json"), "utf8")) as {
			runtimes?: { items?: Record<string, boolean> };
		};
		expect(file.runtimes?.items?.["python"]).toBe(false);
		expect(readRuntimeSwitch().items["python"]).toBe(false);

		// 再打开：写回 true（显式记录用户的选择），而不是把键删掉。
		writeRuntimeEnabled("python", true);
		const reopened = JSON.parse(readFileSync(join(configDir, "preferences.json"), "utf8")) as {
			runtimes?: { items?: Record<string, boolean> };
		};
		expect(reopened.runtimes?.items?.["python"]).toBe(true);
	});

	it("总开关关闭写 enabled:false，且三项都不再注入", () => {
		writeRuntimeMaster(false);
		const inventory = collectRuntimeInventory(overrides());
		expect(inventory.master).toBe(false);
		expect(inventory.items.length).toBeGreaterThan(0);
		for (const item of inventory.items) {
			expect(item.status.kind, `${item.id} 在总开关关闭时应当是被禁用`).toBe("disabled");
			expect("activeDir" in item, `${item.id} 被禁用时不该给目录`).toBe(false);
			expect("executable" in item, `${item.id} 被禁用时不该给可执行文件`).toBe(false);
		}
	});
});

describe("清单判据（磁盘事实，不 spawn）", () => {
	it("全新机器：python 未安装（不会自动下载），但仍是启用态（路径按既有契约照给）", () => {
		const entry = pythonEntry(collectRuntimeInventory(overrides()));
		expect(entry.status.kind).toBe("missing");
		expect(entry.version).toBe("3.12");
		expect(entry.purpose).not.toBe("");
		// 「未安装」也把体积量级摆出来（设置页「安装」按钮旁要用它，用户点之前就知道要下多少）。
		expect(entry.downloadSizeHint).not.toBe("");
		// 未安装 ≠ 禁用：落点仍给（片段 python-env.md 教的正是「先确认那个文件存在」）。
		expect(entry.activeDir).toBeDefined();
		expect(entry.executable).toBeDefined();
	});

	it("逐项关闭：只影响该项，且状态是被禁用（不是找不到）", () => {
		writeRuntimeEnabled("python", false);
		const inventory = collectRuntimeInventory(overrides());
		const entry = pythonEntry(inventory);
		expect(entry.status.kind).toBe("disabled");
		expect(entry.enabled).toBe(false);
		expect("executable" in entry).toBe(false);
	});
});

describe("运行时注入的生产判据（SubTask 2.1.3）", () => {
	/**
	 * 就绪判据的最小事实：写一份带 manifest 的实例 + `current` 指针。
	 * 用的是**真描述符的 resolve()**（不手搓 RuntimeResolution），于是这组断言
	 * 走的就是生产判据本身。
	 */
	function publishNode(): string {
		const root = join(configDir, "runtimes");
		const dir = instanceDir(root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);
		mkdirSync(dir, { recursive: true });
		writeManifest(dir, {
			id: NODE_RUNTIME_ID,
			version: NODE_RUNTIME_VERSION,
			source: "测试来源",
			installedAt: "2026-09-17T00:00:00.000Z",
			status: "installed",
		});
		writeCurrent(root, NODE_RUNTIME_ID, NODE_RUNTIME_VERSION);
		return dir;
	}

	/** 固定基线环境：断言不看真机 PATH，且注入目录必须**前置**在它之前。 */
	const BASE_ENV = { Path: "C:\\Windows\\System32" } as const;

	function plan() {
		return planRuntimeShellInjection({
			env: BASE_ENV,
			overrides: { ...overrides(), env: BASE_ENV },
		});
	}

	it("启用且就绪 ⇒ 环境里有该运行时的 PATH 前缀与专属变量（含托管根）", () => {
		const nodeDir = publishNode();
		const result = plan();
		expect(result.pathEntries).toEqual([nodeDir]);
		expect(result.env["KAMIBUDDY_NODE_HOME"]).toBe(nodeDir);
		expect(result.env[MANAGED_ROOT_ENV]).toBe(join(configDir, "runtimes"));
		expect(result.env[pathKeyOf(BASE_ENV)]).toBe(
			`${nodeDir}${delimiter}C:\\Windows\\System32`,
		);
	});

	it("逐项禁用 ⇒ 既不进 PATH 也不给变量，且被判据指名（不是「找不到」）", () => {
		publishNode();
		writeRuntimeEnabled(NODE_RUNTIME_ID, false);
		const result = plan();
		expect(result.env).toEqual({});
		expect(result.pathEntries).toEqual([]);
		expect(result.decisions.find((decision) => decision.id === NODE_RUNTIME_ID)?.kind).toBe(
			"disabled",
		);
	});

	it("总开关关闭 ⇒ 三个运行时都不注入（逐项仍是启用也照关）", () => {
		publishNode();
		writeRuntimeMaster(false);
		const result = plan();
		expect(result.env).toEqual({});
		expect(result.pathEntries).toEqual([]);
		expect(result.decisions.every((decision) => decision.kind === "disabled")).toBe(true);
	});

	it("一个都没就绪 ⇒ 不开任何环境变量（不写「托管根在哪」这种噪音）", () => {
		const result = plan();
		expect(result.env).toEqual({});
		expect(result.decisions.every((decision) => decision.kind === "not-ready")).toBe(true);
	});
});

describe("模型可见文案（shared/runtimes.ts）", () => {
	/** 手搓清单：一条就绪（带路径）、一条被禁用、一条未安装。 */
	function inventoryFixture(): RuntimeInventory {
		return {
			master: true,
			items: [
				{
					id: "python",
					label: "Python（docx 引擎）",
					purpose: "文档转换（docx 引擎的解释器）",
					version: "3.12",
					enabled: true,
					status: { kind: "ready" },
					downloadSizeHint: "下载约 40–100 MB，解压后约 100 MB",
					activeDir: "C:\\cfg\\runtimes\\python\\3.12\\venv",
					executable: "C:\\cfg\\runtimes\\python\\3.12\\venv\\Scripts\\python.exe",
					executableLabel: "Python 解释器",
				},
				{
					id: "node",
					label: "Node",
					purpose: "运行 JavaScript / Node 脚本",
					version: "22",
					enabled: false,
					status: { kind: "disabled" },
					downloadSizeHint: "下载约 34 MB，解压后约 95 MB",
					// 故意留一份路径：渲染层必须按 status 挡掉它（第二道防线）。
					activeDir: "C:\\cfg\\runtimes\\node\\22",
					executable: "C:\\cfg\\runtimes\\node\\22\\node.exe",
				},
				{
					id: "gitbash",
					label: "Git Bash",
					purpose: "提供 bash 与常用 unix 工具",
					version: "2.47",
					enabled: true,
					status: { kind: "missing" },
					downloadSizeHint: "下载约 56 MB，解压后约 389 MB",
				},
			],
		};
	}

	it("逐项给出 id / 版本 / 状态 / 用途；禁用与未安装是两句不同的话", () => {
		const text = renderRuntimeEnvSection(inventoryFixture());
		expect(text).toContain("python 3.12 · 就绪 · 文档转换（docx 引擎的解释器）");
		expect(text).toContain("node 22 · 已被用户禁用 · 运行 JavaScript / Node 脚本");
		expect(text).toContain("gitbash 2.47 · 未安装 · 提供 bash 与常用 unix 工具");
		expect(text).toContain("该运行时已被用户禁用：不要调用它");
		expect(text).toContain("该运行时尚未安装（不会自动下载）");
		// 两句指引互不串台：禁用项不说「尚未安装」，未安装项不说「已被禁用」。
		const disabledLine = text.split("\n").find((line) => line.includes("node 22"))!;
		const missingLine = text.split("\n").find((line) => line.includes("gitbash"))!;
		expect(disabledLine).not.toContain("尚未安装");
		expect(missingLine).not.toContain("已被用户禁用");
	});

	it("被禁用的项不出现任何路径（status 是唯一判据，不看有没有填路径）", () => {
		const text = renderRuntimeEnvSection(inventoryFixture());
		expect(text).not.toContain("node.exe");
		expect(text).not.toContain("C:\\cfg\\runtimes\\node");
		// 就绪项的路径照给（模型要靠它调用）。
		expect(text).toContain("Python 解释器：C:\\cfg\\runtimes\\python\\3.12\\venv\\Scripts\\python.exe");
	});

	it("清单为空 ⇒ 整段正文为空（调用方据此跳过注入，不留空壳）", () => {
		expect(renderRuntimeEnvSection({ master: true, items: [] })).toBe("");
	});

	it("抬头不把「我们注入哪一份」写成对模型的禁令，且明说系统里已装的照常可用（§4.16）", () => {
		/*
		 * 曾经这句是「不要用系统里同名的解释器 / 运行时」——它把一个**实现选择**
		 * （注入的那份由我们钉版本）写成了普遍禁令。后果是本机明明有可用 Node，
		 * 模型看到「我们这份未安装」就报能力不可用、放弃整条技术路线
		 * （用户原话：「本机有都不让我」）。
		 */
		const text = renderRuntimeEnvSection(inventoryFixture());
		expect(text).not.toContain("不要用系统里同名的");
		// 正面：必须说清「系统里有就能用」，以及「我们的状态不等于你的能力边界」。
		expect(text.split("\n")[0]).toContain("系统里已有同名的解释器 / 工具时照常可用");
		expect(text).toContain("不代表这件事做不到");
	});

	it("失败项的 status.detail（内部相位 + 下载 URL）不进模型可见文本", () => {
		/*
		 * detail 是给界面与诊断看的（失败相位、底层错误原文，含完整的 GitHub release
		 * URL）。模型要做的是把用户引到设置页的诊断，不是在提示词里读下载链接 ——
		 * 而那条 URL 每轮都要付 token。分工：细节归界面，人话归模型。
		 */
		const text = renderRuntimeEnvSection({
			master: true,
			items: [
				{
					id: "gitbash",
					label: "Git Bash",
					purpose: "提供 bash 与常用 unix 工具",
					version: "2.55.0.5",
					enabled: true,
					status: {
						kind: "failed",
						detail:
							"相位 cancelled：已取消下载：https://github.com/git-for-windows/git/releases/download/v2.55.0.windows.5/PortableGit.7z.exe",
					},
					downloadSizeHint: "下载约 56 MB，解压后约 389 MB",
				},
			],
		});

		expect(text).toContain("gitbash 2.55.0.5 · 安装失败 · 提供 bash 与常用 unix 工具");
		expect(text).not.toContain("https://");
		expect(text).not.toContain("相位");
	});
});

describe("诊断/重置入口的入参把关", () => {
	it("未知 id 响亮报错（UI 传来的 id 不该静默变成空操作）", () => {
		expect(() => runtimeDescriptorOf("nope", overrides())).toThrowError(/未知的托管运行时 id/);
	});

	it("偏好文件里 runtimes 形状坏掉时按未配置处理（不抛错）", () => {
		// 手写一个坏形状：读取层应当忽略它并回落到缺省（全开），而不是打挂启动路径。
		writeFileSync(join(configDir, "preferences.json"), JSON.stringify({ runtimes: 42 }), "utf8");
		const state = readRuntimeSwitch();
		expect(state.master).toBe(true);
		expect(state.items).toEqual({});
		expect(existsSync(join(configDir, "preferences.json"))).toBe(true);
	});
});
