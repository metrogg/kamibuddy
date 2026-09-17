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

/** 会话归档索引（archive.json，path → 归档时刻）。 */
export function getArchiveFile(): string {
	return join(getConfigDir(), "archive.json");
}

/**
 * MCP 连接器配置（mcp.json，用户级）。
 *
 * 对齐 WorkBuddy 的 ~/.codebuddy/.mcp.json：用户级放配置目录，
 * 项目级是 <工作区>/.mcp.json（不在本文件 —— 它随 cwd 走，不是配置目录的事）。
 * 读取、JSONC 解析、双级合并见 core/mcp-config.ts。
 */
export function getMcpConfigPath(): string {
	return join(getConfigDir(), "mcp.json");
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
 * 应用自身目录（工作空间守卫要拒的那个「应用目录」）。
 *
 * **不能用 process.cwd()**：daemon 是 utilityProcess，cwd 继承 Electron 主进程的
 * 启动目录 —— dev 下碰巧是项目根，换种启动方式（快捷方式、从别的目录起 electron）
 * 或打包后就会变成任意目录（System32 都可能）。而这个值是安全边界的输入：
 * workspace 守卫拿它拒「把应用目录设为工作空间」，值漂了要么误伤一片无关目录、
 * 要么保护不到真正的安装目录 —— 后者等于边界失效，比误伤更糟。
 * （同一条教训已写在 getWorkspaceDir 的注释里，resources 定位也因此弃用了 cwd。）
 *
 * 所以权威值由主进程在 fork daemon 时用 app.getAppPath() 显式传入
 * （dev = 项目根，打包 = app.asar）；env 缺席时（tsx 直接跑脚本/测试）
 * 回落到与 resources 同基准的 import.meta 定位 —— dev 下同样落在项目根。
 */
export function getAppDir(): string {
	const override = process.env["KAMIBUDDY_APP_DIR"];
	return override !== undefined && override !== "" ? override : resolve(import.meta.dirname, "..", "..");
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
 * 工具结果 spill 目录：`<会话 cwd>/.kamibuddy/spills`。
 *
 * **为什么不跟 event-log / run-ledger 一起放配置目录**（其他路径都在那儿）：
 * 配置目录对文件工具是**禁读**的（permission-policy 阶段 1，凭据禁读任何档
 * 都不可越过），而 spill 提示的任务就是让模型用 read/grep 把落盘结果读回去
 * ——落在配置目录里等于落进一个模型够不着的地方，等于没落。
 *
 * `<cwd>/.kamibuddy/` 是既有约定（记忆系统的 memory/ 就住在这儿，权限策略也
 * 为它开了白名单），而 cwd 就是工作区 ⇒ read/grep 直接放行。代价是用户能在
 * 工作区里看到这些文件：可接受，它们是工具输出的完整副本，删掉只影响模型
 * 按路径回读（会话历史里那份预览不受影响）。
 *
 * 只拼路径不建目录：本文件是纯路径推导层（目录由 spill 落盘时按需建）。
 *
 * 注意取回手段只有**文件工具**（read/grep）：目录名带 `.kamibuddy` 会被
 * command-guard 的凭据段规则拦下（那条规则挡的是
 * `Get-Content ...\.kamibuddy\auth.json`）。所以 spill 提示里只教 read/grep，
 * 不教用 powershell 去 `Get-Content`。这与 cwd 下的记忆目录同一命运
 * （`<cwd>/.kamibuddy/memory/**` 的 shell 访问同样被拦），不是新引入的怪癖。
 *
 * 另一处**已知怪癖**（与记忆同源，不新增）：若用户把工作空间设成家目录，
 * `<cwd>/.kamibuddy` 就与配置目录重合 ⇒ 文件工具对它的读会被阶段 1 禁读拦下
 * （权限层靠路径判定，改名才能区分）。这时 spill 提示里的路径读不回来 ——
 * 现象是明确的拒绝，不是静默失败；要根治得让权限层认这个子目录，属权限侧的事。
 */
export function getSpillsDir(cwd: string): string {
	return join(cwd, ".kamibuddy", "spills");
}

/**
 * 历史共享临时目录：`<工作空间根>/临时任务`。
 *
 * 退役为历史目录：新任务已改为每任务独立时间戳目录（见 spec: align-per-task-dirs），
 * 不再有新会话落入这里；本函数仅供旧会话归类到任务区/迁移用，目录与文件原地保留。
 * 中文目录名在 Node/Windows 无障碍（现有测试里就有中文路径）。
 *
 * 只拼路径不建目录：本文件是纯路径推导层。
 */
export function getTempTasksDir(root: string): string {
	return join(root, "临时任务");
}
