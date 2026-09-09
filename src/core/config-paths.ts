/**
 * KamiBuddy 自己的配置目录。
 *
 * 为什么不用 pi 的默认路径（~/.pi/agent/）：
 * 那里可能已经有用户自己的 pi CLI 配置。我们往里写凭据和自定义服务商，
 * 会与用户的独立 pi 安装互相覆盖。WorkBuddy 踩过同一个坑，它的解法是
 * CODEBUDDY_CONFIG_DIR 让宿主应用与独立 CLI 配置隔离共存——我们照这个做。
 *
 * 为什么不用 Electron 的 app.getPath("userData")：
 * daemon 不许 import electron（AGENTS.md §1，保证这层能脱离 Electron 单测）。
 * 自己从 homedir 推导，路径可预测、可在文档里写明、也便于用户排障。
 */

import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** 配置根目录。可用 KAMIBUDDY_CONFIG_DIR 覆盖（多环境并存、自动化测试用）。 */
export function getConfigDir(): string {
	const override = process.env["KAMIBUDDY_CONFIG_DIR"];
	return override !== undefined && override !== "" ? override : join(homedir(), ".kamibuddy");
}

/**
 * pi 凭据库，0600 权限（仅当前用户可读写）。
 *
 * 文件格式与读写策略见 core/api-keys.ts —— 注意 `ModelRuntime.setRuntimeApiKey()`
 * 是 **non-persistent** 的（pi 的 RuntimeCredentials 自述），持久化必须走写文件，
 * runtime 方法只用来同步本进程状态。
 */
export function getAuthPath(): string {
	return join(getConfigDir(), "auth.json");
}

/**
 * 自定义服务商配置（pi 的 models.json 格式）。
 *
 * 这个文件由我们管理，但**不存密钥**：apiKey 字段留空，
 * 密钥走 auth.json。已由 scripts/probe-custom-provider.ts 实测确认可行
 * （用例 C：省略 apiKey + setRuntimeApiKey，模型正常可用）。
 */
export function getModelsPath(): string {
	return join(getConfigDir(), "models.json");
}

/** pi 的模型目录缓存，供离线使用。由 pi 自己维护。 */
export function getModelsStorePath(): string {
	return join(getConfigDir(), "models-store.json");
}

/** 会话历史（JSONL）。 */
export function getSessionsDir(): string {
	return join(getConfigDir(), "sessions");
}

/** 定时任务库。读写与原子落盘策略见 core/automation-store.ts。 */
export function getAutomationsFile(): string {
	return join(getConfigDir(), "automations.json");
}

/**
 * 提示词与模式资源目录（仓库根的 resources/）。
 *
 * 定位用 import.meta 相对路径而不是 process.cwd()：
 * 本文件既被 tsx 直接跑（src/core/），也被打包进 out/main/daemon.mjs，
 * 两种情况下「上两级」都正好是项目根。打包分发（T14）需要把 resources/
 * 复制进产物同级位置，或用 KAMIBUDDY_RESOURCES_DIR 覆盖。
 */
export function getResourcesDir(): string {
	const override = process.env["KAMIBUDDY_RESOURCES_DIR"];
	return override !== undefined && override !== "" ? override : resolve(import.meta.dirname, "..", "..", "resources");
}

/**
 * 内置默认工作空间根（~/KamiBuddy）—— AI 读写文件、生成文档产物的地方。
 *
 * 三个候选与取舍：
 *   process.cwd()      不行。daemon 的 cwd 是应用安装目录，
 *                      让 AI 往 Program Files 里写文件既会失败也很危险。
 *   ~/.kamibuddy/...   不行。隐藏目录，用户找不到自己的文档。
 *   ~/KamiBuddy        采用。家目录下可见、跨平台一致、路径可预测。
 *
 * 刻意不放进配置目录：配置是程序的东西（用户不该手动翻），
 * 产物是用户的东西（必须一眼能找到）。两者混在一起会让用户误删配置。
 *
 * 注意：本函数给出的只是**内置默认根**（带 KAMIBUDDY_WORKSPACE_DIR env 覆盖），
 * 不是「生效根」的完整答案。生效根 = env > 设置项 defaultWorkspacePath > 内置默认，
 * 分层合成在 preferences.ts 的 getEffectiveWorkspaceRoot() —— 放在那边是因为
 * 本文件被 preferences.ts import（getConfigDir），反向 import 即成循环依赖。
 * 对齐 WorkBuddy：其 resolveDefaultWorkspaceRoot()（main/server.js）同样是
 * 设置项优先、兜底 ~/{appName}。
 */
export function getWorkspaceDir(): string {
	const override = process.env["KAMIBUDDY_WORKSPACE_DIR"];
	return override !== undefined && override !== "" ? override : join(homedir(), "KamiBuddy");
}

/**
 * 临时任务共享目录：`<工作空间根>/临时任务`。
 *
 * 对齐 WorkBuddy 的临时任务模型（main/server.js：临时任务 cwd = <根>/Claw，
 * 所有临时任务共享单一目录、工具齐全），目录名用我们自己的词。
 * 中文目录名在 Node/Windows 无障碍（现有测试里就有中文路径）。
 *
 * 只拼路径不建目录：本文件是纯路径推导层，创建时机在会话建立处（递归 mkdir）。
 */
export function getTempTasksDir(root: string): string {
	return join(root, "临时任务");
}
