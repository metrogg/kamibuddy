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
import { join } from "node:path";

/** 配置根目录。可用 KAMIBUDDY_CONFIG_DIR 覆盖（多环境并存、自动化测试用）。 */
export function getConfigDir(): string {
	const override = process.env["KAMIBUDDY_CONFIG_DIR"];
	return override !== undefined && override !== "" ? override : join(homedir(), ".kamibuddy");
}

/**
 * pi 凭据库。由 pi 以 0600 权限创建（仅当前用户可读写）。
 *
 * 我们**从不自己读写这个文件**——一律经 ModelRuntime 的
 * setRuntimeApiKey / removeRuntimeApiKey 操作，避免格式漂移，
 * 也避免密钥经过我们的代码路径。
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

/**
 * 会话工作目录 —— AI 读写文件、生成文档产物的地方。
 *
 * 三个候选与取舍：
 *   process.cwd()      不行。daemon 的 cwd 是应用安装目录，
 *                      让 AI 往 Program Files 里写文件既会失败也很危险。
 *   ~/.kamibuddy/...   不行。隐藏目录，用户找不到自己的文档。
 *   ~/KamiBuddy        采用。家目录下可见、跨平台一致、路径可预测。
 *
 * 刻意不放进配置目录：配置是程序的东西（用户不该手动翻），
 * 产物是用户的东西（必须一眼能找到）。两者混在一起会让用户误删配置。
 */
export function getWorkspaceDir(): string {
	const override = process.env["KAMIBUDDY_WORKSPACE_DIR"];
	return override !== undefined && override !== "" ? override : join(homedir(), "KamiBuddy");
}
