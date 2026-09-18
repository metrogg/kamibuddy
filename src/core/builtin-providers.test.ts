/**
 * builtin-providers：预装服务商的单测。
 *
 * 最要紧的一条是**不碰已有条目**：预装跑在每次 daemon 启动，一旦它「顺手」
 * 覆盖同名条目，用户手编的 baseUrl / 已配好的模型会在某次重启后无声消失 ——
 * 而这正是 `upsertCustomProvider` 对无标记条目抛错想防的事，预装层必须接住它。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BUILTIN_PROVIDERS, ensureBuiltinProviders } from "./builtin-providers.ts";
import { readCustomProvider } from "./custom-providers.ts";

const roots: string[] = [];
afterEach(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function modelsPath(): string {
	const dir = mkdtempSync(join(tmpdir(), "kami-builtin-"));
	roots.push(dir);
	return join(dir, "models.json");
}

const PRESET = BUILTIN_PROVIDERS[0];
if (PRESET === undefined) throw new Error("BUILTIN_PROVIDERS 不应为空");

describe("ensureBuiltinProviders", () => {
	it("文件不存在（全新机器）→ 写出预装条目，返回 true", () => {
		const path = modelsPath();
		expect(ensureBuiltinProviders(path)).toBe(true);

		const entry = readCustomProvider(path, PRESET.id);
		expect(entry).toBeDefined();
		expect(entry?.name).toBe(PRESET.displayName);
		expect(entry?.baseUrl).toBe(PRESET.baseUrl);
		expect(entry?.api).toBe(PRESET.api);
		expect(entry?.authHeader).toBe(true);
		// 模型留空：由用户自己填（这条钉住「预装不预置模型」的决策）。
		expect(entry?.models).toEqual([]);
	});

	it("幂等：第二次调用不产生变更（返回 false）", () => {
		const path = modelsPath();
		expect(ensureBuiltinProviders(path)).toBe(true);
		expect(ensureBuiltinProviders(path)).toBe(false);
	});

	it("**不写 apiKey** —— 预装不含任何凭据", () => {
		const path = modelsPath();
		ensureBuiltinProviders(path);
		const raw = readFileSync(path, "utf8");
		expect(raw).not.toContain("apiKey");
		// 预装只写 provider 条目，auth.json 不归它管。
		expect(raw).not.toContain("auth.json");
	});

	it("**已存在同名条目 → 一字不动**，哪怕它没有我们的归属标记", () => {
		const path = modelsPath();
		// 模拟实测本机那种「用户手编」的条目：无 x-kamibuddy 标记、带尾斜杠的 baseUrl、
		// 已配好 2 个模型、显示名与预装不同。
		writeFileSync(
			path,
			JSON.stringify(
				{
					providers: {
						[PRESET.id]: {
							name: "jlc",
							baseUrl: "https://claude.jlcops.com/api/",
							api: "anthropic-messages",
							authHeader: true,
							models: [
								{ id: "keep-me", contextWindow: 200000, maxTokens: 8192 },
								{ id: "keep-me-too", contextWindow: 200000, maxTokens: 8192 },
							],
						},
					},
				},
				null,
				2,
			),
			"utf8",
		);

		expect(ensureBuiltinProviders(path)).toBe(false);

		const raw = JSON.parse(readFileSync(path, "utf8")) as {
			providers: Record<string, { name: string; baseUrl: string; models: unknown[] }>;
		};
		const kept = raw.providers[PRESET.id];
		expect(kept?.name).toBe("jlc");
		expect(kept?.baseUrl).toBe("https://claude.jlcops.com/api/");
		expect(kept?.models).toHaveLength(2);
		// 我们也没给它补归属标记 —— 补了就等于认领了用户手写的配置。
		expect(kept).not.toHaveProperty("x-kamibuddy");
	});

	it("同目录还有其他手写服务商时，只补自己那条、不动别人", () => {
		const path = modelsPath();
		writeFileSync(
			path,
			JSON.stringify({ providers: { "my-ollama": { baseUrl: "http://localhost:11434", models: [] } } }, null, 2),
			"utf8",
		);
		expect(ensureBuiltinProviders(path)).toBe(true);

		const raw = JSON.parse(readFileSync(path, "utf8")) as { providers: Record<string, unknown> };
		expect(Object.keys(raw.providers).sort()).toEqual(["jlc-glm", "my-ollama"].sort());
		expect(raw.providers["my-ollama"]).toEqual({ baseUrl: "http://localhost:11434", models: [] });
	});

	it("预置表本身自洽：id 是 kebab-case（pi 的 auth.json 键与模型前缀都要求它）", () => {
		for (const preset of BUILTIN_PROVIDERS) {
			expect(preset.id).toMatch(/^[a-z][a-z0-9-]*$/);
			expect(preset.baseUrl.startsWith("http")).toBe(true);
		}
	});
});
