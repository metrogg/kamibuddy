/**
 * auth.json 读写的测试。重点与 custom-providers.test.ts 相同：
 * 这里存的是凭据，任何静默丢失都比报错严重得多。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readStoredCredential } from "@earendil-works/pi-coding-agent";
import { removeApiKey, writeApiKey } from "./api-keys.ts";

let dir: string;
let path: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "kami-keys-"));
	path = join(dir, "auth.json");
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("写入", () => {
	it("落盘格式与 pi 的 AuthStorageData 契约一致，pi 自己能读回来", () => {
		// 用 pi 导出的 readStoredCredential 验证格式互认 —— 这是最权威的判据。
		writeApiKey(path, "deepseek", "sk-test-123");

		const credential = readStoredCredential("deepseek", path);
		expect(credential).toEqual({ type: "api_key", key: "sk-test-123" });
	});

	it("保留我们不认识的条目（oauth 登录态等）", () => {
		writeFileSync(
			path,
			JSON.stringify({
				anthropic: { type: "oauth", accessToken: "at", refreshToken: "rt", expires: 123 },
			}),
		);

		writeApiKey(path, "deepseek", "sk-x");

		const data = JSON.parse(readFileSync(path, "utf8")) as Record<string, { type: string }>;
		// oauth 条目必须原样保留 —— 丢了用户的登录态就得重新登录。
		expect(data["anthropic"]).toEqual({ type: "oauth", accessToken: "at", refreshToken: "rt", expires: 123 });
		expect(data["deepseek"]).toEqual({ type: "api_key", key: "sk-x" });
	});

	it("同名 provider 覆盖旧 key（更换 Key 的路径）", () => {
		writeApiKey(path, "deepseek", "sk-old");
		writeApiKey(path, "deepseek", "sk-new");

		expect(readStoredCredential("deepseek", path)).toEqual({ type: "api_key", key: "sk-new" });
	});

	it("文件不存在时创建", () => {
		writeApiKey(path, "openai", "sk-1");
		expect(readStoredCredential("openai", path)).toEqual({ type: "api_key", key: "sk-1" });
	});
});

describe("删除", () => {
	it("删掉目标条目，保留其他", () => {
		writeApiKey(path, "a", "sk-a");
		writeApiKey(path, "b", "sk-b");

		removeApiKey(path, "a");

		expect(readStoredCredential("a", path)).toBeUndefined();
		expect(readStoredCredential("b", path)).toEqual({ type: "api_key", key: "sk-b" });
	});

	it("删除不存在的条目是幂等的", () => {
		writeApiKey(path, "a", "sk-a");
		expect(() => removeApiKey(path, "ghost")).not.toThrow();
		expect(readStoredCredential("a", path)).toEqual({ type: "api_key", key: "sk-a" });
	});
});

describe("坏文件", () => {
	it("坏 JSON 抛错，不静默重置", () => {
		writeFileSync(path, "{ oauth 抢救我");
		expect(() => writeApiKey(path, "deepseek", "sk-x")).toThrow(/不是合法 JSON/);
		// 抛错后原文件原封不动。
		expect(readFileSync(path, "utf8")).toBe("{ oauth 抢救我");
	});

	it("顶层不是对象时抛错", () => {
		writeFileSync(path, "[1,2]");
		expect(() => writeApiKey(path, "deepseek", "sk-x")).toThrow(/顶层应为对象/);
	});

	it("空文件按空处理", () => {
		writeFileSync(path, "  \n");
		expect(() => writeApiKey(path, "deepseek", "sk-x")).not.toThrow();
		expect(readStoredCredential("deepseek", path)).toEqual({ type: "api_key", key: "sk-x" });
	});

	it("处理 BOM", () => {
		writeFileSync(path, "﻿{\"deepseek\":{\"type\":\"api_key\",\"key\":\"sk-old\"}}");
		writeApiKey(path, "deepseek", "sk-new");
		expect(readStoredCredential("deepseek", path)).toEqual({ type: "api_key", key: "sk-new" });
	});
});
