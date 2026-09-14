/**
 * 会话读侧对「待分配 cwd（空串）」的收口。
 *
 * 为什么要有这个文件（spec: align-per-task-dirs 引入的回归）：
 * 未选工作空间的新任务，cwd 从共享临时目录（真实路径）改成了空串 `""`（待分配，
 * 首次发消息时才分配真实目录）。空串**不是相对路径**，但 path.join / path.resolve
 * 都把它当「空段」丢掉，于是这些路径被 Node 按 **daemon 进程的 cwd**（应用目录）
 * 解析 —— 「没有工作目录」被误读成「应用目录下的工作目录」：
 *   - readMcpConfig("") / listPromptTemplates("", …) 读到应用目录的项目级配置 / 模板
 *   - buildMemorySection("") 读到应用目录的 .kamibuddy/memory
 *   - resolve("", path) 把相对路径落到应用目录（statPath 因此可能探测到无关文件）
 * 注意「空串」只表示**没有项目级**，不表示「什么都没有」：用户级 / 全局来源（全局
 * 连接器、全局模板）与工作空间无关，待分配会话照样要看到。于是这些读入口统一把空串
 * 归一成「没有工作目录」：MCP / 模板下沉成 core 的可选入参（undefined = 无项目级），
 * 只跳过项目级、保留用户级 / 全局；记忆与产物路径没有「用户级」可言，空串直接返回空
 * 语义或明确报错，既不按相对路径解析，也不静默兜底成别的东西。
 *
 * 为什么记忆 / 产物路径的守卫不下沉进 core：core 是纯函数库，签名语义就是「真实目录」，
 * 空串在那里同样是非法输入；口径收在 daemon 调用点，改动面最小（本改动的边界约束）。
 *
 * 抽成独立文件的直接理由：daemon/index.ts 顶层 `requireParentPort()` 在非 utilityProcess
 * 环境 import 即抛，无法直接单测（同 workspace-model.ts / prompt-preview.ts / conversation-search.ts
 * 的抽法），所以读侧规则放这里测。
 */

import { readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import { buildMemorySection } from "../core/memory.ts";
import { readMcpConfig, type McpServersConfig } from "../core/mcp-config.ts";
import { listPromptTemplates, type PromptTemplateItem } from "../core/prompt-templates.ts";
import type { ArtifactContent, PathStat } from "../shared/ipc.ts";

/** 产物文本上限：超过按二进制处理（面板只读展示，不做大文件）。 */
const ARTIFACT_TEXT_MAX = 512 * 1024;

/**
 * 会话当前生效的 MCP 配置。空串 = 待分配（还没有工作目录）→ **只跳过项目级**，
 * 用户级配置仍要生效（没有工作空间不代表没有全局连接器，连接器页不该因此一片空白）。
 *
 * 不能把空串当路径传下去：readMcpConfig 内部 join("", ".mcp.json") 得到相对路径
 * ".mcp.json"，会被 Node 按 daemon 进程 cwd 解析，凭空读到应用目录的项目级配置。
 * core 侧现已把「无项目级」表达为可选入参（undefined / "" 同义），这里把空串显式
 * 归一成 undefined，意图留在调用点，不必让读者回看 core 的实现。
 */
export function readSessionMcpConfig(cwd: string): McpServersConfig {
	return readMcpConfig(cwd === "" ? undefined : cwd);
}

/**
 * 会话当前可见的提示词模板。空串 = 待分配 → **只跳过项目级**，全局模板照列
 * （`/` 补全不能因为没选工作空间就不列全局模板）。
 *
 * 空串同样不能当路径传下去：scanDir(join("", ".pi", "prompts")) 会扫到 daemon
 * 进程 cwd 下的 .pi/prompts，列出并不属于本会话的模板。
 */
export function listSessionPromptTemplates(cwd: string, agentDir: string): PromptTemplateItem[] {
	return listPromptTemplates(cwd === "" ? undefined : cwd, agentDir);
}

/**
 * 会话当前注入的三层记忆段。空串 = 待分配 → 无工作区记忆（undefined，调用方零 token 跳过）。
 *
 * 不能直接 buildMemorySection("")：workspaceMemoryDir("") 得到相对路径
 * ".kamibuddy/memory"，会被 Node 按 daemon 进程 cwd 解析，把应用目录的记忆当成本项目的。
 */
export function buildSessionMemorySection(cwd: string): string | undefined {
	if (cwd === "") return undefined;
	return buildMemorySection(cwd);
}

/**
 * 读产物文件内容（readArtifact 通道）。路径限**传入会话**的工作区内：
 * 相对路径对该 cwd resolve；绝对路径必须落在其内 —— 预览面板能看的文件与权限门
 * 放行的写范围必须同界（配置目录里的密钥绝不能经这条通道被读出来）。
 *
 * 空串 = 待分配（还没有工作目录）：这是**应该报错**的场景 —— 调用方要的是一份
 * 产物内容，没有工作区就没有可读区间，静默返回空会把「无目录」伪装成「空文件」。
 * （同样不能按相对路径 resolve，否则会落到 daemon 进程 cwd。）
 */
export function readSessionArtifact(cwd: string, path: string): ArtifactContent {
	if (cwd === "") throw new Error("当前任务还没有工作目录，无法读取产物");
	const abs = resolve(cwd, path);
	if (abs !== cwd && !abs.startsWith(cwd + sep)) {
		throw new Error("路径超出当前工作区");
	}
	const stat = statSync(abs); // 不存在让 ENOENT 直接抛给调用方（响亮失败）
	const size = stat.size;
	if (size > ARTIFACT_TEXT_MAX) return { size, text: undefined };
	const buf = readFileSync(abs);
	if (buf.includes(0)) return { size, text: undefined }; // NUL = 二进制
	return { size, text: buf.toString("utf8") };
}

/**
 * 路径存在性探测（statPath 通道）：对话正文行内 code 路径徽章的高亮依据。
 * 与 readArtifact 不同界 —— 只报存在性与类型、不报内容，所以要服务工作区外的
 * 绝对路径（如 Downloads 里的附件）。
 *
 * 空串 = 待分配 → **相对路径没有基准**，按不存在处理（绝不能落到 daemon 进程 cwd
 * 去探测无关文件）；绝对路径不受影响，照常探测。
 */
export function statSessionArtifact(cwd: string, path: string): PathStat {
	const abs = cwd === "" && !isAbsolute(path) ? undefined : resolve(cwd, path);
	if (abs === undefined) return { kind: "missing" };
	try {
		return { kind: statSync(abs).isDirectory() ? "directory" : "file" };
	} catch {
		// 探测的意义就是回答「在不在」——不存在/不可达都是 missing，不是错误。
		return { kind: "missing" };
	}
}
