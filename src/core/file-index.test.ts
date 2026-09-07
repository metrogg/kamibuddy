import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { indexFiles } from "./file-index.ts";

function setup(): string {
	const root = mkdtempSync(join(tmpdir(), "kami-idx-"));
	mkdirSync(join(root, "src", "core"), { recursive: true });
	mkdirSync(join(root, "node_modules", "dep"), { recursive: true });
	mkdirSync(join(root, ".git"), { recursive: true });
	writeFileSync(join(root, "readme.md"), "");
	writeFileSync(join(root, "src", "main.ts"), "");
	writeFileSync(join(root, "src", "core", "a.ts"), "");
	writeFileSync(join(root, "node_modules", "dep", "x.js"), "");
	writeFileSync(join(root, ".git", "config"), "");
	return root;
}

describe("indexFiles", () => {
	it("返回 posix 相对路径，已排序", () => {
		const root = setup();
		const r = indexFiles(root);
		expect(r).toContain("readme.md");
		expect(r).toContain("src/main.ts");
		expect(r).toContain("src/core/a.ts");
		expect(r).toEqual([...r].sort());
	});

	it("跳过 node_modules 与 .git", () => {
		const root = setup();
		const r = indexFiles(root);
		expect(r.some((p) => p.startsWith("node_modules/"))).toBe(false);
		expect(r.some((p) => p.startsWith(".git/"))).toBe(false);
	});

	it("root 不存在时返回空列表", () => {
		expect(indexFiles(join(tmpdir(), "kami-idx-not-exist-xyz"))).toEqual([]);
	});

	it("maxEntries 截断", () => {
		const root = setup();
		expect(indexFiles(root, { maxEntries: 2 })).toHaveLength(2);
	});
});
