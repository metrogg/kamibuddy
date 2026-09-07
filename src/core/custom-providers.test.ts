/**
 * 自定义服务商读写的行为测试。
 *
 * 重点钉住三类会造成**用户数据损失**的行为：
 *   1. 坏文件不静默重置（否则悄悄丢掉用户手写的配置）
 *   2. 保留我们不认识的键（用户按 pi 文档手工加的东西）
 *   3. 归属守卫（不许覆盖/删除用户手写的同 id 条目）
 *
 * 以及一条安全不变量：写出的文件里**永远没有 apiKey**。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CustomProviderInput } from "../shared/settings.ts";
import {
	deleteCustomProvider,
	listOwnedProviderIds,
	readCustomProvider,
	readModelsJson,
	upsertCustomProvider,
} from "./custom-providers.ts";

let dir: string;
let path: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "kami-cp-"));
	path = join(dir, "models.json");
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

function input(overrides: Partial<CustomProviderInput> = {}): CustomProviderInput {
	return {
		id: "my-gateway",
		name: "公司网关",
		baseUrl: "https://gateway.example.com/v1",
		api: "openai-completions",
		models: [
			{ id: "glm-4.7", name: "GLM 4.7", contextWindow: 128000, maxTokens: 8192, reasoning: false, vision: false },
		],
		...overrides,
	};
}

/** 读回落盘的原始 JSON，用于断言文件内容而非内存结构。 */
function readRaw(): Record<string, unknown> {
	return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("读取", () => {
	it("文件不存在时返回空结构，而不是抛错", () => {
		expect(readModelsJson(join(dir, "missing.json"))).toEqual({ providers: {} });
	});

	it("空文件按空结构处理", () => {
		writeFileSync(path, "   \n");
		expect(readModelsJson(path)).toEqual({ providers: {} });
	});

	it("坏 JSON 抛错，不静默重置", () => {
		// 静默重置会悄无声息地丢掉用户手写的配置，这里必须响亮失败。
		writeFileSync(path, "{ 这不是 JSON");
		expect(() => readModelsJson(path)).toThrow(/不是合法 JSON/);
	});

	it("providers 不是对象时抛错", () => {
		writeFileSync(path, JSON.stringify({ providers: [] }));
		expect(() => readModelsJson(path)).toThrow(/providers 字段应为对象/);
	});

	it("缺少 providers 字段时补空对象，并保留其他顶层键", () => {
		writeFileSync(path, JSON.stringify({ somethingElse: 1 }));
		expect(readModelsJson(path)).toEqual({ somethingElse: 1, providers: {} });
	});
});

describe("写入", () => {
	it("落盘内容不含 apiKey", () => {
		// 安全不变量：密钥只存 auth.json（pi 以 0600 创建），配置文件不留明文。
		upsertCustomProvider(path, input());
		expect(readFileSync(path, "utf8")).not.toContain("apiKey");
	});

	it("模型字段按 pi 的 schema 落盘", () => {
		upsertCustomProvider(path, {
			...input(),
			models: [
				{ id: "m1", name: "视觉模型", contextWindow: 200000, maxTokens: 16384, reasoning: true, vision: true },
			],
		});

		const providers = readRaw()["providers"] as Record<string, Record<string, unknown>>;
		const entry = providers["my-gateway"];
		expect(entry?.["baseUrl"]).toBe("https://gateway.example.com/v1");
		expect(entry?.["api"]).toBe("openai-completions");

		const models = entry?.["models"] as Record<string, unknown>[];
		expect(models[0]).toMatchObject({
			id: "m1",
			name: "视觉模型",
			reasoning: true,
			contextWindow: 200000,
			maxTokens: 16384,
			// vision 映射成 input 数组，这是 pi 的表达方式。
			input: ["text", "image"],
		});
		// 自建服务商价格未知，显式写 0 避免统计出 NaN。
		expect(models[0]?.["cost"]).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
	});

	it("非视觉模型只声明 text 输入", () => {
		upsertCustomProvider(path, input());
		const providers = readRaw()["providers"] as Record<string, Record<string, unknown>>;
		const models = providers["my-gateway"]?.["models"] as Record<string, unknown>[];
		expect(models[0]?.["input"]).toEqual(["text"]);
	});

	it("保留用户手写的其他服务商与顶层键", () => {
		writeFileSync(
			path,
			JSON.stringify({
				providers: { ollama: { baseUrl: "http://localhost:11434/v1", api: "openai-completions" } },
				userNote: "别删我",
			}),
		);

		upsertCustomProvider(path, input());

		const raw = readRaw();
		expect(raw["userNote"]).toBe("别删我");
		const providers = raw["providers"] as Record<string, unknown>;
		// 用户自己的 ollama 条目必须原样保留。
		expect(providers["ollama"]).toEqual({ baseUrl: "http://localhost:11434/v1", api: "openai-completions" });
		expect(providers["my-gateway"]).toBeDefined();
	});

	it("compat 仅对 openai-completions 落盘", () => {
		const compat = { supportsDeveloperRole: false, supportsReasoningEffort: false };

		upsertCustomProvider(path, { ...input(), compat });
		let providers = readRaw()["providers"] as Record<string, Record<string, unknown>>;
		expect(providers["my-gateway"]?.["compat"]).toEqual(compat);

		// anthropic-messages 的 compat 形状不同，写进去会被 pi 的 schema union 拒掉。
		upsertCustomProvider(path, { ...input(), id: "claude-proxy", api: "anthropic-messages", compat });
		providers = readRaw()["providers"] as Record<string, Record<string, unknown>>;
		expect(providers["claude-proxy"]?.["compat"]).toBeUndefined();
	});

	it("重复 upsert 覆盖自己的条目", () => {
		upsertCustomProvider(path, input());
		upsertCustomProvider(path, { ...input(), name: "改名了" });

		const providers = readRaw()["providers"] as Record<string, Record<string, unknown>>;
		expect(providers["my-gateway"]?.["name"]).toBe("改名了");
		expect(Object.keys(providers)).toHaveLength(1);
	});
});

describe("归属守卫", () => {
	/** 模拟用户按 pi 文档手工写的条目（没有我们的标记位）。 */
	function writeHandCrafted(): void {
		writeFileSync(
			path,
			JSON.stringify({ providers: { "my-gateway": { baseUrl: "http://hand.example/v1", api: "openai-completions" } } }),
		);
	}

	it("拒绝覆盖用户手写的同 id 条目", () => {
		writeHandCrafted();
		expect(() => upsertCustomProvider(path, input())).toThrow(/手工配置/);
		// 抛错后文件必须没被动过。
		const providers = readRaw()["providers"] as Record<string, Record<string, unknown>>;
		expect(providers["my-gateway"]?.["baseUrl"]).toBe("http://hand.example/v1");
	});

	it("拒绝删除用户手写的条目", () => {
		writeHandCrafted();
		expect(() => deleteCustomProvider(path, "my-gateway")).toThrow(/手工配置/);
	});

	it("只把带标记的条目列为可编辑", () => {
		writeFileSync(path, JSON.stringify({ providers: { ollama: { baseUrl: "http://localhost:11434/v1" } } }));
		upsertCustomProvider(path, input());

		expect(listOwnedProviderIds(path)).toEqual(["my-gateway"]);
	});

	it("readCustomProvider 不返回用户手写的条目", () => {
		writeHandCrafted();
		expect(readCustomProvider(path, "my-gateway")).toBeUndefined();
	});
});

describe("删除", () => {
	it("删掉自己的条目，保留其他", () => {
		upsertCustomProvider(path, input());
		upsertCustomProvider(path, { ...input(), id: "other" });

		deleteCustomProvider(path, "my-gateway");

		const providers = readRaw()["providers"] as Record<string, unknown>;
		expect(providers["my-gateway"]).toBeUndefined();
		expect(providers["other"]).toBeDefined();
	});

	it("删除不存在的条目是幂等的，不抛错", () => {
		upsertCustomProvider(path, input());
		expect(() => deleteCustomProvider(path, "never-existed")).not.toThrow();
	});
});

describe("回填表单", () => {
	it("upsert 后能还原成等价的输入", () => {
		const original = input({
			models: [
				{ id: "a", name: "A", contextWindow: 100, maxTokens: 10, reasoning: true, vision: true },
				{ id: "b", name: "B", contextWindow: 200, maxTokens: 20, reasoning: false, vision: false },
			],
			compat: { supportsDeveloperRole: false },
		});

		upsertCustomProvider(path, original);

		expect(readCustomProvider(path, "my-gateway")).toEqual(original);
	});

	it("未知协议回填成 openai-completions", () => {
		upsertCustomProvider(path, input());
		// 手工把 api 改成 pi 支持但我们界面不支持的值。
		const raw = readRaw();
		const providers = raw["providers"] as Record<string, Record<string, unknown>>;
		const entry = providers["my-gateway"];
		if (entry !== undefined) entry["api"] = "bedrock-converse-stream";
		writeFileSync(path, JSON.stringify(raw));

		expect(readCustomProvider(path, "my-gateway")?.api).toBe("openai-completions");
	});

	it("缺字段的条目用合理默认值回填", () => {
		writeFileSync(
			path,
			JSON.stringify({
				providers: { minimal: { "x-kamibuddy": true, models: [{ id: "only-id" }] } },
			}),
		);

		const restored = readCustomProvider(path, "minimal");
		expect(restored).toMatchObject({
			id: "minimal",
			name: "minimal",
			baseUrl: "",
			api: "openai-completions",
		});
		expect(restored?.models[0]).toEqual({
			id: "only-id",
			name: "only-id",
			contextWindow: 128000,
			maxTokens: 8192,
			reasoning: false,
			vision: false,
		});
	});
});
