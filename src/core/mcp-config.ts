/**
 * mcp.json 配置读写（MCP 连接器）。
 *
 * 双级配置（对齐 WorkBuddy 的 ~/.codebuddy/.mcp.json + 项目级 .mcp.json）：
 *   用户级  ~/.kamibuddy/mcp.json（config-paths.getMcpConfigPath）
 *   项目级  <工作区>/.mcp.json
 * 合并策略：项目级覆盖用户级（同名 server 项目级优先）。
 *
 * 读：readMcpConfig（合并生效）/ readMcpConfigSource（编辑器用的单文件原文）。
 * 写：writeMcpConfig（整体替换，写前校验）/ toggleMcpServer（单 server 启停，
 * 最小编辑）。写入层级与编辑器的读取层级同一条解析路径。
 *
 * 格式是 JSONC（注释 + 尾逗号）——VS Code 系的 mcp.json 惯例，用户多半
 * 从那里抄配置过来，不该因为一行注释就拒读。字符串值里的 ${VAR} 在解析后
 * 递归展开（env 里的凭据不落明文也不行——只能引用环境变量）。
 *
 * 错误策略：文件不存在 = 没配置（正常）；文件坏了（JSONC 语法错、结构不符、
 * 引用了未设置的环境变量）= 抛 McpConfigError。这里是用户手写的配置，
 * 「坏了当空」会让用户对着「连接器一片空白」摸不着头脑 —— 响亮报错，
 * 由调用方（扩展层）决定降级（本会话不加载 MCP，不阻塞会话）。
 *
 * 不 import pi，纯 fs + jsonc-parser，可单测。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	applyEdits,
	modify,
	parse as parseJsonc,
	printParseErrorCode,
	type ParseError,
} from "jsonc-parser";
import { getMcpConfigPath } from "./config-paths.ts";

/** stdio 传输：本地子进程。 */
export interface McpStdioServerConfig {
	readonly transport: "stdio";
	readonly command: string;
	readonly args: readonly string[];
	readonly env: Readonly<Record<string, string>>;
	/** true = 配置保留但不连接（UI 开关落的就是这个字段）。缺省视为启用。 */
	readonly disabled?: boolean;
}

/** HTTP 传输：远程 server（Streamable HTTP）。 */
export interface McpHttpServerConfig {
	readonly transport: "http";
	readonly url: string;
	/** true = 配置保留但不连接（UI 开关落的就是这个字段）。缺省视为启用。 */
	readonly disabled?: boolean;
}

export type McpServerConfig = McpStdioServerConfig | McpHttpServerConfig;

export interface McpServersConfig {
	/** server 名 → 配置（项目级已覆盖用户级同名）。 */
	readonly servers: Readonly<Record<string, McpServerConfig>>;
}

export class McpConfigError extends Error {}

/** 项目级配置文件名（工作区根下）。 */
const PROJECT_CONFIG_FILE = ".mcp.json";

/**
 * 读取生效的 MCP 配置 = 用户级 + 项目级合并。
 *
 * @param cwd 会话工作目录（项目级 .mcp.json 的位置）。
 * @throws McpConfigError 任一配置文件存在但坏了（语法 / 结构 / 环境变量未设置）。
 */
export function readMcpConfig(cwd: string): McpServersConfig {
	const user = readFileIfExists(getMcpConfigPath());
	const project = readFileIfExists(join(cwd, PROJECT_CONFIG_FILE));
	// 同名 server 项目级优先：展开即覆盖。
	return { servers: { ...user, ...project } };
}

/** 文件不存在 = 空配置；存在但读不了（权限等）或坏了 = 响亮抛错。 */
function readFileIfExists(path: string): Record<string, McpServerConfig> {
	const text = readTextIfExists(path);
	if (text === undefined) return {};
	return parseMcpJsonc(text, path);
}

/** 读文件原文。ENOENT = undefined（没配置是正常态）；其他读取失败 = 响亮抛错。 */
function readTextIfExists(path: string): string | undefined {
	try {
		return readFileSync(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw new McpConfigError(`无法读取 ${path}：${(error as Error).message}`);
	}
}

/** JSONC 解析 + ${VAR} 展开 + schema 校验，一份文件的全流程。 */
function parseMcpJsonc(text: string, source: string): Record<string, McpServerConfig> {
	const errors: ParseError[] = [];
	const parsed: unknown = parseJsonc(text, errors, {
		allowTrailingComma: true,
		disallowComments: false,
	});
	if (errors.length > 0) {
		const first = errors[0];
		if (first !== undefined) {
			throw new McpConfigError(
				`${source} 不是合法的 JSONC：${printParseErrorCode(first.error)}（偏移 ${first.offset}）`,
			);
		}
	}
	if (!isRecord(parsed)) {
		throw new McpConfigError(`${source} 必须是 {"mcpServers": {...}} 结构`);
	}
	const mcpServers = parsed["mcpServers"];
	if (mcpServers === undefined) return {};
	if (!isRecord(mcpServers)) {
		throw new McpConfigError(`${source} 的 mcpServers 必须是对象（server 名 → 配置）`);
	}
	// 先展开后校验：展开只动字符串值，结构不变，校验看到的就是最终值。
	const expanded = expandEnvVars(mcpServers, source);
	const out: Record<string, McpServerConfig> = {};
	for (const [name, raw] of Object.entries(expanded)) {
		out[name] = parseServer(name, raw, source);
	}
	return out;
}

/**
 * 单个 server 条目的 schema 校验：
 *   {"command": "...", "args": [...], "env": {...}}  → stdio
 *   {"url": "..."}                                    → HTTP
 * command 与 url 互斥（都给了说明用户自己也没想清楚该走哪条传输）。
 */
function parseServer(name: string, raw: unknown, source: string): McpServerConfig {
	if (!isRecord(raw)) {
		throw new McpConfigError(`${source}：server「${name}」的配置必须是对象`);
	}
	const hasCommand = "command" in raw;
	const hasUrl = "url" in raw;
	if (hasCommand && hasUrl) {
		throw new McpConfigError(
			`${source}：server「${name}」同时配置了 command 和 url，二者只能留一个（stdio 或 HTTP）`,
		);
	}
	const disabled = parseDisabled(name, raw["disabled"], source);
	if (hasCommand) {
		const command = raw["command"];
		if (typeof command !== "string" || command.trim() === "") {
			throw new McpConfigError(`${source}：server「${name}」的 command 必须是非空字符串`);
		}
		const args = raw["args"];
		if (args !== undefined && (!Array.isArray(args) || args.some((a) => typeof a !== "string"))) {
			throw new McpConfigError(`${source}：server「${name}」的 args 必须是字符串数组`);
		}
		const env = raw["env"];
		if (env !== undefined && !isStringRecord(env)) {
			throw new McpConfigError(`${source}：server「${name}」的 env 必须是 字符串→字符串 的对象`);
		}
		return {
			transport: "stdio",
			command,
			args: (args as string[] | undefined) ?? [],
			env: (env as Record<string, string> | undefined) ?? {},
			...(disabled === undefined ? {} : { disabled }),
		};
	}
	if (hasUrl) {
		const url = raw["url"];
		if (typeof url !== "string" || url.trim() === "") {
			throw new McpConfigError(`${source}：server「${name}」的 url 必须是非空字符串`);
		}
		return { transport: "http", url, ...(disabled === undefined ? {} : { disabled }) };
	}
	throw new McpConfigError(
		`${source}：server「${name}」必须配置 command（stdio 子进程）或 url（HTTP）`,
	);
}

/** disabled 是可选布尔：给了就必须是 true/false，其他类型说明用户写错了。 */
function parseDisabled(name: string, raw: unknown, source: string): boolean | undefined {
	if (raw === undefined) return undefined;
	if (typeof raw !== "boolean") {
		throw new McpConfigError(`${source}：server「${name}」的 disabled 必须是布尔值`);
	}
	return raw;
}

/**
 * 递归展开字符串值里的 ${VAR}。
 *
 * 变量未设置时抛错而不是替空串：env 里的凭据被静默换成空串，
 * server 会以「认证失败」死在更远的地方，根因（变量没设）反而被埋掉。
 */
function expandEnvVars(value: Record<string, unknown>, source: string): Record<string, unknown> {
	const expand = (v: unknown): unknown => {
		if (typeof v === "string") {
			return v.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => {
				const envValue = process.env[name];
				if (envValue === undefined) {
					throw new McpConfigError(`${source} 引用的环境变量 ${name} 未设置`);
				}
				return envValue;
			});
		}
		if (Array.isArray(v)) return v.map(expand);
		if (isRecord(v)) {
			const out: Record<string, unknown> = {};
			for (const [k, item] of Object.entries(v)) out[k] = expand(item);
			return out;
		}
		return v;
	};
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value)) out[k] = expand(v);
	return out;
}

/**
 * 编辑器读的 mcp.json 原文：项目级（cwd 给定时）存在读项目级，否则用户级，
 * 两级都没有返回空串（编辑器从空白开始）。
 *
 * 与 writeMcpConfig 的写入目标同一条层级解析路径 —— 用户看到的就是保存会改的文件。
 * 注意读的是原文不解析：文件坏了（JSONC 语法错）编辑器照样要打得开，否则用户没法修。
 */
export function readMcpConfigSource(cwd?: string): string {
	if (cwd !== undefined) {
		const project = readTextIfExists(join(cwd, PROJECT_CONFIG_FILE));
		if (project !== undefined) return project;
	}
	return readTextIfExists(getMcpConfigPath()) ?? "";
}

/**
 * 整体写入 mcp.json（JSON 编辑器的保存）。
 *
 * 写入目标：cwd 给定 = 项目级 <cwd>/.mcp.json，缺省 = 用户级 ~/.kamibuddy/mcp.json
 * （daemon 在临时任务会话下传缺省 —— 共享临时目录不该落配置文件）。
 *
 * 写入前过完整校验（JSONC 语法 + schema + ${VAR} 引用的变量已设置），
 * 坏了拒写抛 McpConfigError —— 写一份读不回的配置等于丢用户数据。
 * 原文照写（不进格式化器）：用户的注释与排版是配置的一部分。
 */
export function writeMcpConfig(configJson: string, cwd?: string): void {
	const target = cwd !== undefined ? join(cwd, PROJECT_CONFIG_FILE) : getMcpConfigPath();
	parseMcpJsonc(configJson, target);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, configJson, "utf8");
}

/**
 * 切换单个 server 的启用状态：给该 server 写 disabled 字段。
 *
 * server 定义在哪级就改哪级（项目级优先 —— 同名时是它生效）；
 * 用 jsonc-parser 的 modify 做最小编辑，注释与其他内容原样保留。
 * 文件坏了拒改（在坏文件上做文本编辑可能越改越烂，让用户先在编辑器里修）；
 * 两级文件都没有这个 server = 响亮抛错（UI 列表来自生效配置，不该出现）。
 */
export function toggleMcpServer(serverName: string, enabled: boolean, cwd?: string): void {
	const candidates: string[] = [];
	if (cwd !== undefined) candidates.push(join(cwd, PROJECT_CONFIG_FILE));
	candidates.push(getMcpConfigPath());
	for (const path of candidates) {
		const text = readTextIfExists(path);
		if (text === undefined) continue;
		const servers = parseMcpJsonc(text, path);
		if (!(serverName in servers)) continue;
		const edits = modify(text, ["mcpServers", serverName, "disabled"], !enabled, {});
		writeFileSync(path, applyEdits(text, edits), "utf8");
		return;
	}
	throw new McpConfigError(`找不到名为「${serverName}」的 MCP server 配置`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): boolean {
	return isRecord(value) && Object.values(value).every((v) => typeof v === "string");
}
