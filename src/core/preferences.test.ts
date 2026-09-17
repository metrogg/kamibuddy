/**
 * preferences 持久化测试。
 *
 * 核心断言：新增字段（webSearch / defaultWorkspacePath）不影响旧字段
 * （activeModelKey），反之亦然 —— 这个文件是「读改写」语义的守卫
 * （daemon 的 setModel 就靠它）。
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTempTasksDir } from "./config-paths.ts";
import {
	getEffectiveWorkspaceRoot,
	readPreferences,
	writePreferences,
} from "./preferences.ts";

let dir: string;
let savedWorkspaceEnv: string | undefined;

beforeEach(() => {
	dir = join(tmpdir(), `kbp-test-${process.pid}-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	process.env["KAMIBUDDY_CONFIG_DIR"] = dir;
	// KAMIBUDDY_WORKSPACE_DIR 参与生效根分层，测试必须控制它：
	// 先保存原值再清掉，afterEach 还原，免得用例结果依赖跑测试的机器环境。
	savedWorkspaceEnv = process.env["KAMIBUDDY_WORKSPACE_DIR"];
	delete process.env["KAMIBUDDY_WORKSPACE_DIR"];
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	delete process.env["KAMIBUDDY_CONFIG_DIR"];
	if (savedWorkspaceEnv === undefined) {
		delete process.env["KAMIBUDDY_WORKSPACE_DIR"];
	} else {
		process.env["KAMIBUDDY_WORKSPACE_DIR"] = savedWorkspaceEnv;
	}
});

describe("preferences", () => {
	it("空态返回默认", () => {
		expect(readPreferences()).toEqual({ activeModelKey: undefined });
	});

	it("写入再读出（模型 + 联网搜索并存）", () => {
		writePreferences({
			activeModelKey: "deepseek/deepseek-v4",
			webSearch: { providerId: "tavily", apiKey: "tvly-xxxx" },
		});
		expect(readPreferences()).toEqual({
			activeModelKey: "deepseek/deepseek-v4",
			webSearch: { providerId: "tavily", apiKey: "tvly-xxxx" },
		});
	});

	it("只改模型不丢联网搜索（读改写语义）", () => {
		writePreferences({
			activeModelKey: "deepseek/deepseek-v4",
			webSearch: { providerId: "tavily", apiKey: "k1" },
		});
		writePreferences({
			...readPreferences(),
			activeModelKey: "smart/glm",
		});
		expect(readPreferences()).toEqual({
			activeModelKey: "smart/glm",
			webSearch: { providerId: "tavily", apiKey: "k1" },
		});
	});

	it("坏文件返回空（偏好可再生，不阻塞启动）", () => {
		writeFileSync(join(dir, "preferences.json"), "this is { not json", "utf8");
		expect(readPreferences()).toEqual({ activeModelKey: undefined });
	});

	it("默认存储路径读改写不丢其他键", () => {
		const wsRoot = join(dir, "我的空间");
		writePreferences({
			activeModelKey: "deepseek/deepseek-v4",
			webSearch: { providerId: "tavily", apiKey: "k1" },
		});
		writePreferences({ ...readPreferences(), defaultWorkspacePath: wsRoot });
		expect(readPreferences()).toEqual({
			activeModelKey: "deepseek/deepseek-v4",
			webSearch: { providerId: "tavily", apiKey: "k1" },
			defaultWorkspacePath: wsRoot,
		});
		// 反向：改模型不丢存储路径
		writePreferences({ ...readPreferences(), activeModelKey: "smart/glm" });
		expect(readPreferences().defaultWorkspacePath).toBe(wsRoot);
	});

	it("styleId 三态：未配置 = undefined（回落默认风格），空串 = 关闭不归一化", () => {
		// 未配置：读取方（daemon）回落 DEFAULT_STYLE_ID，偏好文件保持「没写」。
		expect(readPreferences().styleId).toBeUndefined();

		writePreferences({ activeModelKey: undefined, styleId: "socratic" });
		expect(readPreferences().styleId).toBe("socratic");

		// 空串是合法值（用户显式关闭风格注入）——若被「空串归一化为
		// undefined」的惯例吃掉，关闭会被静默还原成默认风格（spec: F8 可关闭）。
		writePreferences({ ...readPreferences(), styleId: "" });
		expect(readPreferences().styleId).toBe("");
	});

	it("styleId 读改写不丢其他键，改其他键也不丢 styleId", () => {
		writePreferences({ activeModelKey: "smart/glm", styleId: "creative" });
		writePreferences({ ...readPreferences(), styleId: "efficient" });
		expect(readPreferences()).toEqual({ activeModelKey: "smart/glm", styleId: "efficient" });

		writePreferences({ ...readPreferences(), activeModelKey: "deepseek/deepseek-v4" });
		expect(readPreferences().styleId).toBe("efficient");
	});

	it("styleId 非法类型按未配置处理（偏好可再生，不阻塞启动）", () => {
		writeFileSync(join(dir, "preferences.json"), JSON.stringify({ styleId: 42 }), "utf8");
		expect(readPreferences().styleId).toBeUndefined();
	});

	it("memoryEnabled 读写往返；非法类型按未配置处理", () => {
		expect(readPreferences().memoryEnabled).toBeUndefined();

		writePreferences({ activeModelKey: undefined, memoryEnabled: false });
		expect(readPreferences().memoryEnabled).toBe(false);

		writeFileSync(
			join(dir, "preferences.json"),
			JSON.stringify({ memoryEnabled: "yes" }),
			"utf8",
		);
		expect(readPreferences().memoryEnabled).toBeUndefined();
	});

	it("个性化六字段读写往返（spec: rework-settings-layout）", () => {
		// 旧偏好文件没有这些键：全部按未配置处理（旧文件兼容）。
		const fresh = readPreferences();
		expect(fresh.customInstructions).toBeUndefined();
		expect(fresh.userNickname).toBeUndefined();
		expect(fresh.assistantName).toBeUndefined();
		expect(fresh.personaDescription).toBeUndefined();
		expect(fresh.welcomeGreeting).toBeUndefined();
		expect(fresh.showChangeDetails).toBeUndefined();

		writePreferences({
			activeModelKey: undefined,
			customInstructions: "回答先给结论再展开",
			userNickname: "老周",
			assistantName: "小K",
			personaDescription: "犀利但靠谱的搭档",
			welcomeGreeting: false,
			showChangeDetails: false,
		});
		expect(readPreferences()).toEqual({
			activeModelKey: undefined,
			customInstructions: "回答先给结论再展开",
			userNickname: "老周",
			assistantName: "小K",
			personaDescription: "犀利但靠谱的搭档",
			welcomeGreeting: false,
			showChangeDetails: false,
		});
	});

	it("个性化字段：空串与非法类型按未配置处理；读改写不丢其他键", () => {
		// 字符串空串归一化为 undefined —— 与 styleId 的三态特例不同，
		// 这里没有「空串 = 关闭」语义，空就是没设（注入端零 token）。
		writeFileSync(
			join(dir, "preferences.json"),
			JSON.stringify({
				activeModelKey: "smart/glm",
				customInstructions: "",
				userNickname: 42,
				welcomeGreeting: "yes",
				showChangeDetails: true,
			}),
			"utf8",
		);
		const prefs = readPreferences();
		expect(prefs.customInstructions).toBeUndefined();
		expect(prefs.userNickname).toBeUndefined();
		expect(prefs.welcomeGreeting).toBeUndefined();
		expect(prefs.showChangeDetails).toBe(true);

		// 读改写：改个性化字段不丢既有键（daemon setPersonalization 的合并语义靠它）。
		writePreferences({ ...prefs, personaDescription: "严谨" });
		const next = readPreferences();
		expect(next.activeModelKey).toBe("smart/glm");
		expect(next.showChangeDetails).toBe(true);
		expect(next.personaDescription).toBe("严谨");
	});
});

describe("skillOverrides（技能启停，spec: add-skill-management）", () => {
	it("读写往返；读改写不丢其他键，改其他键也不丢它", () => {
		// 旧偏好文件没有这个键 → 未配置（调用方按「全部启用」处理）。
		expect(readPreferences().skillOverrides).toBeUndefined();

		writePreferences({ activeModelKey: "smart/glm", skillOverrides: { legacy: "off" } });
		expect(readPreferences().skillOverrides).toEqual({ legacy: "off" });

		writePreferences({ ...readPreferences(), webSearch: { providerId: "tavily", apiKey: "k1" } });
		expect(readPreferences()).toEqual({
			activeModelKey: "smart/glm",
			skillOverrides: { legacy: "off" },
			webSearch: { providerId: "tavily", apiKey: "k1" },
		});
	});

	it("非法值与非法键名逐条忽略并响亮记日志（一条坏的连累不到别的键）", () => {
		writeFileSync(
			join(dir, "preferences.json"),
			JSON.stringify({
				activeModelKey: "smart/glm",
				skillOverrides: { docx: "off", "Bad_Name": "off", "meeting-notes": "maybe", "": "off" },
			}),
			"utf8",
		);
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(readPreferences().skillOverrides).toEqual({ docx: "off" });
			// 三条坏条目各记一条日志：静默丢掉「用户显式关掉的技能」表现为「关了又自己开」。
			expect(spy).toHaveBeenCalledTimes(3);
		} finally {
			spy.mockRestore();
		}
	});

	it("非对象（数组 / 字符串 / null）整块忽略并记日志", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			for (const value of [[], "off", null, 42]) {
				writeFileSync(
					join(dir, "preferences.json"),
					JSON.stringify({ activeModelKey: "smart/glm", skillOverrides: value }),
					"utf8",
				);
				expect(readPreferences()).toEqual({ activeModelKey: "smart/glm" });
			}
			expect(spy).toHaveBeenCalledTimes(4);
		} finally {
			spy.mockRestore();
		}
	});

	it("空对象 / 全部非法 → 归一 undefined（与「没写过」同一表示，不写空对象）", () => {
		writeFileSync(
			join(dir, "preferences.json"),
			JSON.stringify({ activeModelKey: "smart/glm", skillOverrides: {} }),
			"utf8",
		);
		expect(readPreferences().skillOverrides).toBeUndefined();

		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			writePreferences({ ...readPreferences(), skillOverrides: { "UPPER": "off" } });
			expect(readPreferences().skillOverrides).toBeUndefined();
		} finally {
			spy.mockRestore();
		}
	});

	it("坏了不影响其它键（偏好可再生，读取不抛错）", () => {
		writeFileSync(
			join(dir, "preferences.json"),
			JSON.stringify({ activeModelKey: "smart/glm", skillOverrides: [1, 2] }),
			"utf8",
		);
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			expect(readPreferences().activeModelKey).toBe("smart/glm");
		} finally {
			spy.mockRestore();
		}
	});
});

describe("getEffectiveWorkspaceRoot 分层", () => {
	it("env 优先于设置项", () => {
		const envRoot = join(dir, "env-root");
		process.env["KAMIBUDDY_WORKSPACE_DIR"] = envRoot;
		writePreferences({
			activeModelKey: undefined,
			defaultWorkspacePath: join(dir, "pref-root"),
		});
		expect(getEffectiveWorkspaceRoot()).toBe(envRoot);
	});

	it("设置项优先于内置默认", () => {
		const prefRoot = join(dir, "pref-root");
		writePreferences({ activeModelKey: undefined, defaultWorkspacePath: prefRoot });
		expect(getEffectiveWorkspaceRoot()).toBe(prefRoot);
	});

	it("都无设置时回退内置默认 ~/KamiBuddy", () => {
		expect(getEffectiveWorkspaceRoot()).toBe(join(homedir(), "KamiBuddy"));
	});

	it("设置项为相对路径时忽略并回退内置默认", () => {
		writePreferences({ activeModelKey: undefined, defaultWorkspacePath: "relative/path" });
		expect(getEffectiveWorkspaceRoot()).toBe(join(homedir(), "KamiBuddy"));
	});

	it("设置项 trim 后为空时按未设置处理", () => {
		writePreferences({ activeModelKey: undefined, defaultWorkspacePath: "   " });
		expect(getEffectiveWorkspaceRoot()).toBe(join(homedir(), "KamiBuddy"));
	});

	it("env 与非法设置项同时存在时 env 生效", () => {
		const envRoot = join(dir, "env-root");
		process.env["KAMIBUDDY_WORKSPACE_DIR"] = envRoot;
		writePreferences({ activeModelKey: undefined, defaultWorkspacePath: "not/absolute" });
		expect(getEffectiveWorkspaceRoot()).toBe(envRoot);
	});
});

describe("getTempTasksDir", () => {
	it("拼接中文目录名「临时任务」", () => {
		const root = join(dir, "工作根");
		expect(getTempTasksDir(root)).toBe(join(root, "临时任务"));
	});
});
