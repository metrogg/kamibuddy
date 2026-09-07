import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * vitest 不读 tsconfig 的 paths，别名要在这里再声明一次。
 * 与 electron.vite.config.ts 保持一致，否则测试和构建对同一个 import 的解析会不同。
 */
export default defineConfig({
	resolve: {
		alias: {
			"@shared": resolve("src/shared"),
			"@documents": resolve("src/documents"),
			"@core": resolve("src/core"),
			"@extensions": resolve("src/extensions"),
		},
	},
	test: {
		// 只跑 src 下的测试，避免扫进 开源项目/pi 那份参考源码。
		include: ["src/**/*.test.ts"],
	},
});
