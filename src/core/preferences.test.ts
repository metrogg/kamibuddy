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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
