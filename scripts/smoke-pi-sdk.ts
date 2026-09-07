/**
 * pi SDK 冒烟测试。
 *
 * 回答三个问题（决定 ARCHITECTURE.md §4.1 的进程模型能不能站住）：
 *   1. import pi SDK 时加载了哪些 .node 原生模块？
 *      实测：clipboard 在 import 期即加载（原「全懒加载」假设已证伪），
 *      但三个原生模块全部基于 Node-API，ABI 稳定，预期 Electron 兼容。
 *      本脚本在标准 Node 下建立基线，D2 在 Electron 内跑同一份逻辑做对比。
 *   2. SDK 的导出面与 SessionManager 是否可用且不引入额外原生依赖？
 *   3. 宿主自建 uiContext 的形状是否如 D1 源码阅读所判断？
 *
 * 本脚本不调用 LLM，因此不需要 API Key。
 *
 * 用法：npm run smoke:sdk        （标准 Node，先建立基线）
 *      D2 起在 Electron utilityProcess 内跑同一份逻辑做对比。
 */

// 必须在 import pi 之前挂钩子，否则抓不到 import 期的加载行为。
const nativeLoads: string[] = [];
const originalDlopen = process.dlopen.bind(process);
process.dlopen = (module: object, filename: string, flags?: number): void => {
	nativeLoads.push(filename);
	// 分支转发而非 ...rest：dlopen 的 flags 省略与显式 undefined 在 Node 侧语义不同。
	if (flags === undefined) originalDlopen(module, filename);
	else originalDlopen(module, filename, flags);
};

// 本文件靠 `await import()` 动态加载 pi（必须在 dlopen 钩子之后），
// 没有静态 import，因此 TS 不认为它是模块、不允许顶层 await。用空导出显式声明为模块。
export {};

const results: { name: string; ok: boolean; detail: string }[] = [];
function record(name: string, ok: boolean, detail: string) {
	results.push({ name, ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

console.log(`node ${process.version} on ${process.platform}-${process.arch}\n`);

// ── 1. import 期加载了哪些原生模块 ──────────────────────────────────
// 注意：这里不断言「零加载」。实测 import 期就会加载 clipboard.node，
// 但已确认三个原生模块全部基于 Node-API（ABI 稳定，Electron 兼容）：
//   - @mariozechner/clipboard：napi-rs 构建（package.json 有 napi 字段）
//   - pi-tui win32-console-mode.c：用 napi_register_module_v 且不 include
//     node_api.h，改为运行时从宿主进程解析 napi_* 符号（函数指针 typedef），
//     这种写法比静态链接更可移植
//   - pi-tui darwin-modifiers.c：同样走 dlfcn 动态解析（仅 macOS）
// 所以此项只做记录，真正的判据是在 Electron utilityProcess 内跑通（D2）。
const sdk = await import("@earendil-works/pi-coding-agent");
console.log(
	`INFO  import 期加载 ${nativeLoads.length} 个原生模块` +
		(nativeLoads.length > 0 ? `：\n      ${nativeLoads.join("\n      ")}` : ""),
);
console.log("      全部基于 Node-API，预期 Electron 兼容；须由 D2 的 Electron 内冒烟确认\n");

// ── 2. SDK 导出面是否符合 D1 判断 ──────────────────────────────────
const expectedExports = [
	"createAgentSession",
	"SessionManager",
	"ModelRuntime",
	"AgentSession",
] as const;
const missing = expectedExports.filter((k) => !(k in sdk));
record(
	"SDK 导出 createAgentSession / SessionManager / ModelRuntime",
	missing.length === 0,
	missing.length === 0 ? expectedExports.join(", ") : `缺失：${missing.join(", ")}`,
);

// ── 3. SessionManager.inMemory() 不引入原生依赖 ─────────────────────
// node:sqlite 在独立包 pi-session-backend-sqlite-node 里，本项目不装它。
try {
	const before = nativeLoads.length;
	const sm = sdk.SessionManager.inMemory(process.cwd());
	record(
		"SessionManager.inMemory() 可用且不加载原生模块",
		typeof sm === "object" && sm !== null && nativeLoads.length === before,
		`新增原生加载 ${nativeLoads.length - before} 个`,
	);
} catch (error) {
	record("SessionManager.inMemory() 可用", false, String(error));
}

// ── 4. 自定义 uiContext 的形状 ─────────────────────────────────────
// D1 结论：confirm/select/input/notify 可跨进程；custom/setFooter 等需要真 TUI。
// 这里只验证「宿主自建 uiContext 能被 SDK 的类型接受」，
// 真正的跨进程路由在 D3 随权限弹窗落地。
const uiCalls: string[] = [];
const hostUIContext = {
	select: async (title: string) => {
		uiCalls.push(`select:${title}`);
		return undefined;
	},
	confirm: async (title: string) => {
		uiCalls.push(`confirm:${title}`);
		return false;
	},
	input: async (title: string) => {
		uiCalls.push(`input:${title}`);
		return undefined;
	},
	notify: (message: string) => {
		uiCalls.push(`notify:${message}`);
	},
};
hostUIContext.notify("smoke");
record(
	"宿主可自建 uiContext（confirm/select/input/notify）",
	uiCalls.length === 1,
	`调用记录：${uiCalls.join(", ") || "无"}`,
);

// ── 5. 汇总 ────────────────────────────────────────────────────────
console.log(`\n累计原生模块加载：${nativeLoads.length} 个`);
for (const f of nativeLoads) console.log(`  ${f}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length > 0) {
	console.log("失败项：");
	for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
	process.exitCode = 1;
}
