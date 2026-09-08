/**
 * preferences 持久化测试。
 *
 * 核心断言：新增字段（webSearch）不影响旧字段（activeModelKey），
 * 反之亦然 —— 这个文件是「读改写」语义的守卫（daemon 的 setModel 就靠它）。
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readPreferences, writePreferences } from "./preferences.ts";

let dir: string;

beforeEach(() => {
	dir = join(tmpdir(), `kbp-test-${process.pid}-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	process.env["KAMIBUDDY_CONFIG_DIR"] = dir;
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	delete process.env["KAMIBUDDY_CONFIG_DIR"];
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
});
