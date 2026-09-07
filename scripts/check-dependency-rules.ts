/**
 * 依赖方向校验 —— AGENTS.md §1 的机械执行。
 *
 * 三条硬规则：
 *   1. documents/ 不许 import pi，不许 import electron（保证可脱离二者单测）
 *   2. pi 类型只许出现在 core/ extensions/ daemon/（pi 升级只塌一个模块）
 *   3. renderer/ 只许 import shared/（不许碰 core/daemon/documents 内部）
 *
 * 用法：npm run check:deps
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const SRC = resolve("src");

const LAYERS = [
	"shared",
	"documents",
	"core",
	"extensions",
	"daemon",
	"main",
	"preload",
	"renderer",
] as const;
type Layer = (typeof LAYERS)[number];

/** 每层允许 import 的内部层。未列出即禁止。 */
const ALLOWED_INTERNAL: Record<Layer, readonly Layer[]> = {
	shared: [], // 零内部依赖，谁都可以 import 它
	documents: ["shared"],
	core: ["shared", "documents"],
	extensions: ["shared", "documents", "core"],
	daemon: ["shared", "documents", "core", "extensions"],
	main: ["shared"],
	preload: ["shared"],
	renderer: ["shared"],
};

/** 允许 import pi 的层。pi 类型止步于此，不许流到 renderer。 */
const ALLOW_PI: readonly Layer[] = ["core", "extensions", "daemon"];

/** 允许 import electron 的层。daemon 跑在 utilityProcess 里，用不了多数 electron API。 */
const ALLOW_ELECTRON: readonly Layer[] = ["main", "preload"];

const PI_PKG = /^@earendil-works\//;
const ELECTRON_PKG = /^electron(?:\/|$)/;

const SPEC_PATTERNS = [
	/\bfrom\s*["']([^"']+)["']/g,
	/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
	/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
	/\bimport\s+["']([^"']+)["']/g,
];

/** 粗略剥注释：只去掉块注释和整行注释，不碰行内内容（避免误伤 URL 里的 //）。 */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.split("\n")
		.filter((line) => {
			const t = line.trimStart();
			return !t.startsWith("//") && !t.startsWith("*");
		})
		.join("\n");
}

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === "node_modules" || entry.startsWith(".")) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(ts|tsx|mts|cts)$/.test(entry)) out.push(full);
	}
	return out;
}

function layerOfPath(absPath: string): Layer | undefined {
	const rel = relative(SRC, absPath);
	if (rel.startsWith("..")) return undefined;
	const first = rel.split(/[\\/]/)[0];
	return first !== undefined && (LAYERS as readonly string[]).includes(first)
		? (first as Layer)
		: undefined;
}

/** 解析 import 目标落在哪个内部层；返回 undefined 表示不是内部引用。 */
function targetLayer(spec: string, fromFile: string): Layer | undefined {
	// 支持 @shared/... 形式的路径别名（electron-vite 常用）
	const alias = /^@([a-z]+)\//.exec(spec);
	if (alias?.[1] !== undefined && (LAYERS as readonly string[]).includes(alias[1])) {
		return alias[1] as Layer;
	}
	if (!spec.startsWith(".")) return undefined;
	return layerOfPath(resolve(dirname(fromFile), spec));
}

if (!existsSync(SRC)) {
	console.log("src/ 尚未创建，跳过依赖校验。");
	process.exit(0);
}

interface Violation {
	file: string;
	spec: string;
	reason: string;
}

const violations: Violation[] = [];
const files = walk(SRC);

for (const file of files) {
	const from = layerOfPath(file);
	if (from === undefined) continue;

	const source = stripComments(readFileSync(file, "utf8"));
	const specs = new Set<string>();
	for (const pattern of SPEC_PATTERNS) {
		for (const match of source.matchAll(pattern)) {
			if (match[1] !== undefined) specs.add(match[1]);
		}
	}

	for (const spec of specs) {
		if (PI_PKG.test(spec) && !ALLOW_PI.includes(from)) {
			violations.push({
				file,
				spec,
				reason: `${from}/ 不许 import pi。pi 类型只许出现在 ${ALLOW_PI.join(" / ")} 里（AGENTS.md §1.2）`,
			});
			continue;
		}
		if (ELECTRON_PKG.test(spec) && !ALLOW_ELECTRON.includes(from)) {
			violations.push({
				file,
				spec,
				reason: `${from}/ 不许 import electron，只有 ${ALLOW_ELECTRON.join(" / ")} 可以`,
			});
			continue;
		}
		const to = targetLayer(spec, file);
		if (to !== undefined && to !== from && !ALLOWED_INTERNAL[from].includes(to)) {
			violations.push({
				file,
				spec,
				reason: `${from}/ 不许 import ${to}/。允许的目标：${ALLOWED_INTERNAL[from].join(" / ") || "（无）"}`,
			});
		}
	}
}

console.log(`扫描 ${files.length} 个文件。`);
if (violations.length === 0) {
	console.log("依赖方向校验通过。");
	process.exit(0);
}

console.log(`\n发现 ${violations.length} 处违规：\n`);
for (const v of violations) {
	console.log(`  ${relative(process.cwd(), v.file)}`);
	console.log(`    import "${v.spec}"`);
	console.log(`    ${v.reason}\n`);
}
process.exit(1);
