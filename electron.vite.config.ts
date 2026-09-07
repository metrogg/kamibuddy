import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

/**
 * 三个构建目标各自独立：main / preload / renderer。
 *
 * 路径别名与 AGENTS.md §1 的分层同名，check-dependency-rules.ts 认得 `@shared/` 形式，
 * 因此别名和裸相对路径都会被同一套依赖方向规则约束。
 */
const alias = {
	"@shared": resolve("src/shared"),
	"@documents": resolve("src/documents"),
	"@core": resolve("src/core"),
	"@extensions": resolve("src/extensions"),
};

export default defineConfig({
	main: {
		// pi 及其原生模块必须留在 node_modules 里按 CJS/ESM 原样加载，
		// 打进 bundle 会破坏 createRequire 对 .node 的相对路径解析。
		plugins: [externalizeDepsPlugin()],
		resolve: { alias },
		build: {
			rollupOptions: {
				input: {
					index: resolve("src/main/index.ts"),
					// daemon 跑在 utilityProcess 里，是独立入口而非 main 的一部分。
					daemon: resolve("src/daemon/index.ts"),
				},
				// 必须显式指定 .mjs：Electron 的 ESM 主进程按**扩展名**判断模块类型，
				// `.js` 会走到 CJS 互操作路径，导致 `import { BrowserWindow } from "electron"`
				// 报 "does not provide an export named"。
				// electron-vite 只在单入口时自动加 .mjs，我们是双入口（index + daemon），
				// 默认 entryFileNames 退回 [name].js，所以这里要自己写。
				output: {
					entryFileNames: "[name].mjs",
					chunkFileNames: "chunks/[name]-[hash].mjs",
				},
			},
		},
	},
	preload: {
		plugins: [externalizeDepsPlugin()],
		resolve: { alias },
		build: {
			rollupOptions: {
				input: { index: resolve("src/preload/index.ts") },
				output: { entryFileNames: "[name].mjs" },
			},
		},
	},
	renderer: {
		root: resolve("src/renderer"),
		// renderer 只许 import shared（AGENTS.md §1.3），别名里也就只给这一个。
		resolve: { alias: { "@shared": alias["@shared"] } },
		plugins: [react()],
		build: {
			rollupOptions: { input: { index: resolve("src/renderer/index.html") } },
		},
	},
});
