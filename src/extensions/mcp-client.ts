/**
 * MCP 连接器扩展：把 mcp.json 配置的 MCP server 桥接进 pi 的工具面。
 *
 * pi 刻意不内置 MCP（README 自述），但 ExtensionAPI.registerTool 就是为桥接
 * 准备的。本文件做四件事：读配置（core/mcp-config.ts）、连 server
 * （@modelcontextprotocol/sdk，stdio 子进程 / Streamable HTTP）、把每个 MCP
 * 工具注册成 pi 的 ToolDefinition（mcp__<server>__<tool> 前缀，对齐
 * WorkBuddy 的命名）、管连接生命周期（并行连接、断线重连、reload 热应用、
 * teardown 断开）。
 *
 * 分层与 web-tools.ts 同一套：SDK 的调用姿势全部收在 connectMcpServer 一处
 * （适配层），状态机与工具注册走注入的 connect 回调 —— 测试注入假连接，
 * 不碰真 server。
 *
 * createMcpClient 返回的不是裸工厂而是 handle：extension 给 pi 加载，
 * getServerStates / reload 给 daemon 的 IPC handler（设置页查状态、保存/
 * 启停后热应用）。reload 走 pi 的运行时 registerTool（loader.ts 的
 * refreshTools post-bind 是真实刷新），新 server 不必等下个会话。
 *
 * 参数 schema 直接用 MCP 的原生 JSON Schema，不做 JSON Schema → TypeBox
 * 转换：pi 的 validateToolArguments 对没有 TypeBox Kind 标记的 schema 走原生
 * JSON Schema 分支（pi-ai validation.ts 的 TYPEBOX_KIND 检查 +
 * coerceWithJsonSchema 回落），provider 侧也把 parameters 原样序列化进请求。
 * 写转换器只会引入失真（oneOf/$ref/嵌套），这条直通路径是 pi 留好的。
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";
import {
	readMcpConfig,
	type McpServerConfig,
	type McpServersConfig,
} from "../core/mcp-config.ts";
import type { McpServerInfo } from "../shared/ipc.ts";

/** MCP server 的一个工具（tools/list 条目，已拍平成本扩展需要的形状）。 */
export interface McpTool {
	readonly name: string;
	readonly title: string | undefined;
	readonly description: string | undefined;
	/** 原生 JSON Schema，注册时直接作为 pi ToolDefinition.parameters（见文件头注释）。 */
	readonly inputSchema: Record<string, unknown>;
}

/** 工具结果内容：与 pi 的 TextContent / ImageContent 结构对齐，非文本二进制成拍平成说明文字。 */
export type McpContent =
	| { readonly type: "text"; readonly text: string }
	| { readonly type: "image"; readonly data: string; readonly mimeType: string };

/** tools/call 的结果（已从 SDK 形状映射过来，isError 单独成字段）。 */
export interface McpToolCallResult {
	readonly content: readonly McpContent[];
	readonly isError: boolean;
}

/** 一条已建立的 server 连接：工具清单 + 调用 + 关闭。 */
export interface McpServerConnection {
	readonly tools: readonly McpTool[];
	callTool(toolName: string, args: Record<string, unknown>): Promise<McpToolCallResult>;
	close(): Promise<void>;
}

/**
 * 连接建立器（测试注入缝）。onClosed 在连接意外断开时触发
 * （SDK 的 client.onclose 在主动 close() 时也会触发，调用方自己过滤 teardown）。
 */
export type McpConnector = (
	serverName: string,
	config: McpServerConfig,
	onClosed: () => void,
) => Promise<McpServerConnection>;

export interface McpClientOptions {
	/** 会话工作目录（项目级 .mcp.json 从这儿读）。 */
	readonly cwd: string;
	/** 测试注入。缺省走 core/mcp-config.ts 的真实实现。 */
	readonly readConfig?: (cwd: string) => McpServersConfig;
	/** 测试注入。缺省走 MCP SDK 的真实连接。 */
	readonly connect?: McpConnector;
	/** 日志出口（连接成功/失败的 server 名与工具数）。缺省 console.log。 */
	readonly log?: (message: string) => void;
}

/** 单个 server 的运行时状态。 */
interface ServerState {
	readonly name: string;
	/** 当前生效的配置（reload 时换成新读的）。 */
	config: McpServerConfig;
	/** 活连接；未连接（连接失败 / 断开待重连 / 被禁用）时为 undefined。 */
	connection: McpServerConnection | undefined;
	/** 最近一次失败原因（UI 与「未连接」错误文案用）。 */
	error: string | undefined;
	/** 工具是否已注册进 pi：被禁用的 server 启用后首次连接要补注册。 */
	toolsRegistered: boolean;
	/** 已注册的工具数（状态快照用；撞名被跳过的不计）。 */
	toolCount: number;
	reconnectAttempts: number;
	reconnectTimer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * createMcpClient 的返回：pi 扩展工厂 + daemon 的查询/控制面。
 * daemon 在建会话时持有它，会话作废即丢弃（resetSession 清引用）。
 */
export interface McpClientHandle {
	/** pi ExtensionFactory，传 SessionHost 的 extensions 数组。 */
	readonly extension: (pi: ExtensionAPI) => Promise<void>;
	/**
	 * 各 server 的当前运行态（mcpConfigGet 的 servers 列表）。
	 * 扩展未加载（宿主懒建中）或已 teardown 时为空 —— daemon 按配置推导兜底。
	 */
	getServerStates(): readonly McpServerInfo[];
	/**
	 * 重新读配置并热应用：新增的连接并注册工具、消失的断开、变更的重连、
	 * 禁用的断开不再连。配置坏了抛 McpConfigError（现有连接不动）。
	 * 扩展未加载 / 已 teardown 时空操作（下个会话自然读到新配置）。
	 */
	reload(): Promise<void>;
}

/** initialize 握手超时：SDK 默认 60s 太长，挂起的 server 会拖住会话建立。 */
const CONNECT_TIMEOUT_MS = 30_000;
/** 断线重连：指数退避 1s/2s/4s/8s（上限 8s），最多 5 次。 */
const MAX_RECONNECT_ATTEMPTS = 5;
/** LLM provider 对工具名的硬性约束（Anthropic/OpenAI 同）：^[a-zA-Z0-9_-]+$，≤64。 */
const MAX_TOOL_NAME_LENGTH = 64;

/**
 * 创建 MCP 连接器扩展（返回 handle：extension 给 pi 加载，
 * getServerStates / reload 给 daemon 的 IPC handler）。
 */
export function createMcpClient(options: McpClientOptions): McpClientHandle {
	// 扩展加载后才有运行态；teardown 后失效。daemon 的 handler 通过 handle
	// 触达这里 —— 模块级没有单例状态，多会话各自持有自己的 handle。
	let runtime: { readonly getServerStates: () => McpServerInfo[]; readonly reload: () => Promise<void> } | undefined;

	return {
		extension: async (pi: ExtensionAPI): Promise<void> => {
			const log = options.log ?? ((message: string) => console.log(`[mcp] ${message}`));
			const readConfig = options.readConfig ?? readMcpConfig;
			const connect = options.connect ?? connectMcpServer;

			const servers = new Map<string, ServerState>();
			const usedToolNames = new Set<string>();
			let tearingDown = false;

			const scheduleReconnect = (state: ServerState): void => {
				if (tearingDown) return;
				if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
					log(`server「${state.name}」重连 ${MAX_RECONNECT_ATTEMPTS} 次均失败，放弃；重启会话后再试`);
					return;
				}
				const delayMs = Math.min(1000 * 2 ** state.reconnectAttempts, 8000);
				state.reconnectAttempts += 1;
				state.reconnectTimer = setTimeout(() => {
					state.reconnectTimer = undefined;
					void attemptReconnect(state);
				}, delayMs);
				// 不挡 daemon 退出（teardown 也会 clearTimeout，这里是双保险）。
				state.reconnectTimer.unref();
			};

			const attemptReconnect = async (state: ServerState): Promise<void> => {
				try {
					const connection = await connect(state.name, state.config, () => onConnectionLost(state));
					if (tearingDown) {
						await connection.close().catch(() => {});
						return;
					}
					state.connection = connection;
					state.error = undefined;
					state.reconnectAttempts = 0;
					// 工具不重复注册：execute 每次按 state.connection 现查活连接，
					// 重连换新连接后原注册自动恢复可用。（server 工具清单在重连后
					// 若有增删，要下个会话才反映 —— 第一期接受这个漂移。）
					log(`server「${state.name}」重连成功`);
				} catch (error) {
					state.error = errText(error);
					log(`server「${state.name}」重连失败：${state.error}`);
					scheduleReconnect(state);
				}
			};

			const onConnectionLost = (state: ServerState): void => {
				if (tearingDown) return;
				state.connection = undefined;
				state.error = "连接已断开";
				log(`server「${state.name}」连接断开，准备指数退避重连`);
				scheduleReconnect(state);
			};

			/** 首次连接 + 工具注册（初始加载与 reload 发现的新 server 共用）。 */
			const connectAndRegister = async (state: ServerState): Promise<void> => {
				try {
					const connection = await connect(state.name, state.config, () => onConnectionLost(state));
					if (tearingDown) {
						await connection.close().catch(() => {});
						return;
					}
					state.connection = connection;
					state.error = undefined;
					state.reconnectAttempts = 0;
					state.toolCount = registerServerTools(pi, state, connection.tools, usedToolNames, log);
					state.toolsRegistered = true;
					log(`server「${state.name}」已连接，注册 ${state.toolCount} 个工具`);
				} catch (error) {
					state.error = errText(error);
					log(`server「${state.name}」连接失败：${state.error}`);
				}
			};

			/**
			 * 断开并停掉重连定时器。state 本体保留：已注册工具的 execute 闭包
			 * 还引用着它（断开后再被调用会报「未连接」，而不是幽灵成功）。
			 */
			const detachConnection = (state: ServerState): void => {
				if (state.reconnectTimer !== undefined) {
					clearTimeout(state.reconnectTimer);
					state.reconnectTimer = undefined;
				}
				const connection = state.connection;
				state.connection = undefined;
				state.reconnectAttempts = 0;
				if (connection !== undefined) void connection.close().catch(() => {});
			};

			const reloadNow = async (): Promise<void> => {
				if (tearingDown) return;
				// 配置坏了响亮抛给调用方（handler → UI 报错），现有连接不动。
				const next = readConfig(options.cwd);
				// 配置里没了的 server：下线。已注册的工具撤不掉（pi 没有
				// unregisterTool），execute 闭包里的 state 还在，会报
				// 「未连接：已从配置移除」—— 模型拿到明确错误而不是幽灵工具。
				for (const [name, state] of [...servers]) {
					if (!(name in next.servers)) {
						detachConnection(state);
						state.error = "已从配置移除";
						servers.delete(name);
					}
				}
				// 并行应用：新增/变更的连接互不阻塞，与初始加载同策略。
				await Promise.all(
					Object.entries(next.servers).map(async ([name, serverConfig]) => {
						const existing = servers.get(name);
						// 完全一致：不动（连接保持，避免保存无变化配置引发闪断）。
						if (existing !== undefined && sameServerConfig(existing.config, serverConfig)) return;
						if (existing === undefined) {
							const state = newServerState(name, serverConfig);
							servers.set(name, state);
							// 禁用的只占位（快照里显示 disabled），不连不注册。
							if (serverConfig.disabled !== true) await connectAndRegister(state);
							return;
						}
						detachConnection(existing);
						existing.config = serverConfig;
						existing.error = undefined;
						if (serverConfig.disabled === true) return;
						// 已注册过工具的走重连路径（原注册经 state.connection 复活）；
						// 没注册过的（此前被禁用）连上后要补注册。
						if (existing.toolsRegistered) await attemptReconnect(existing);
						else await connectAndRegister(existing);
					}),
				);
			};

			// reload 串行化：设置页连点（保存/启停）不允许两轮 reload 交叠 ——
			// 交叠会对同一 server 连两次，先到的连接被覆盖泄漏。
			let reloadQueue: Promise<void> = Promise.resolve();
			const reload = (): Promise<void> => {
				const run = reloadQueue.then(() => reloadNow());
				reloadQueue = run.catch(() => {});
				return run;
			};

			// 运行态在扩展加载后即注册 —— 即使随后配置读取失败（servers 为空）
			// 也保持可查可 reload：用户在设置页修好配置保存，reload 就地生效，
			// 不必重启会话。
			runtime = {
				getServerStates: () => [...servers.values()].map(snapshotOf),
				reload,
			};

			pi.on("session_shutdown", () => {
				tearingDown = true;
				runtime = undefined;
				for (const state of servers.values()) {
					if (state.reconnectTimer !== undefined) clearTimeout(state.reconnectTimer);
					void state.connection?.close().catch(() => {});
				}
			});

			let config: McpServersConfig;
			try {
				config = readConfig(options.cwd);
			} catch (error) {
				// 配置坏了不阻塞会话：响亮记日志（错误文案里带文件路径与原因），
				// 本会话不加载 MCP 工具。修好后经设置页保存触发 reload 就地生效。
				log(`配置读取失败，本会话不加载 MCP 工具：${errText(error)}`);
				return;
			}

			// 并行连接：一个 server 挂起（30s 超时兜底）或失败不阻塞其他。
			await Promise.all(
				Object.entries(config.servers).map(async ([name, serverConfig]) => {
					const state = newServerState(name, serverConfig);
					servers.set(name, state);
					// 禁用的 server 只占位（状态快照里显示 disabled），不连不注册。
					if (serverConfig.disabled === true) return;
					await connectAndRegister(state);
				}),
			);
		},
		getServerStates: () => runtime?.getServerStates() ?? [],
		reload: async () => {
			await runtime?.reload();
		},
	};
}

function newServerState(name: string, config: McpServerConfig): ServerState {
	return {
		name,
		config,
		connection: undefined,
		error: undefined,
		toolsRegistered: false,
		toolCount: 0,
		reconnectAttempts: 0,
		reconnectTimer: undefined,
	};
}

/** 运行态 → 快照。状态推导收在这一处，UI 看到的与 execute 报错同源。 */
function snapshotOf(state: ServerState): McpServerInfo {
	let status: McpServerInfo["status"];
	if (state.config.disabled === true) status = "disabled";
	else if (state.connection !== undefined) status = "connected";
	// 重连定时器挂着 = 断线退避中，还没放弃。
	else if (state.reconnectTimer !== undefined) status = "connecting";
	else if (state.error !== undefined) status = "failed";
	// 无连接无错误：首次连接进行中。
	else status = "connecting";
	return {
		name: state.name,
		status,
		toolCount: state.toolCount,
		...(state.error !== undefined ? { error: state.error } : {}),
	};
}

/** reload 的差异判定：完全一致才跳过重连（含 disabled 位）。 */
function sameServerConfig(a: McpServerConfig, b: McpServerConfig): boolean {
	if (a.transport !== b.transport) return false;
	if ((a.disabled ?? false) !== (b.disabled ?? false)) return false;
	if (a.transport === "stdio" && b.transport === "stdio") {
		return (
			a.command === b.command &&
			a.args.length === b.args.length &&
			a.args.every((arg, index) => arg === b.args[index]) &&
			sameStringRecord(a.env, b.env)
		);
	}
	if (a.transport === "http" && b.transport === "http") return a.url === b.url;
	return false;
}

function sameStringRecord(
	a: Readonly<Record<string, string>>,
	b: Readonly<Record<string, string>>,
): boolean {
	const entries = Object.entries(a);
	if (entries.length !== Object.keys(b).length) return false;
	return entries.every(([key, value]) => b[key] === value);
}

/**
 * 把一个 server 的工具清单逐个注册成 pi 工具（mcp__<server>__<tool> 前缀）。
 * execute 闭包直接持有 state：state 对象从建到拆始终是同一个引用
 * （重连只换 state.connection），所以「未连接 → 重连成功」后原注册自动复活。
 * 返回实际注册成功的数量（撞名跳过的不计）。
 */
function registerServerTools(
	pi: ExtensionAPI,
	state: ServerState,
	tools: readonly McpTool[],
	usedToolNames: Set<string>,
	log: (message: string) => void,
): number {
	let registered = 0;
	for (const tool of tools) {
		const name = sanitizeToolName(state.name, tool.name);
		if (usedToolNames.has(name)) {
			// 清洗后撞名（如 server 里同时有 read-file 与 read.file）：
			// 跳过后来者并记日志，不静默覆盖 —— 模型调到的必须是确定的工具。
			log(`server「${state.name}」的工具「${tool.name}」清洗后与已有工具撞名（${name}），跳过`);
			continue;
		}
		usedToolNames.add(name);
		pi.registerTool({
			name,
			label: tool.title ?? tool.name,
			description: tool.description ?? `MCP server「${state.name}」的 ${tool.name} 工具`,
			parameters: tool.inputSchema as TSchema,
			async execute(_toolCallId, params) {
				if (state.connection === undefined) {
					throw new Error(
						`MCP server「${state.name}」未连接${state.error !== undefined ? `：${state.error}` : ""}。` +
							"请检查 mcp.json 配置，或等自动重连成功后重试。",
					);
				}
				const args = isRecord(params) ? params : {};
				const result = await state.connection.callTool(tool.name, args);
				// pi 的约定是 execute 抛错 → isError 标记回给模型（同 web 工具），
				// 模型据此自我纠正；MCP 的 isError 结果同路处理。
				if (result.isError) throw new Error(flattenErrorText(result.content));
				return {
					content:
						result.content.length > 0
							? [...result.content]
							: [{ type: "text", text: "（工具执行成功，无输出）" }],
					details: { server: state.name, tool: tool.name },
			};
		},
	});
		registered += 1;
	}
	return registered;
}

/**
 * server 名 / 工具名清洗成 provider 合法字符集。
 * MCP 工具名几乎任意（可含 .、-、空格），Anthropic/OpenAI 只收 [a-zA-Z0-9_-]。
 */
function sanitizeToolName(serverName: string, toolName: string): string {
	const clean = (s: string): string => s.replace(/[^a-zA-Z0-9_-]/g, "_");
	const full = `mcp__${clean(serverName)}__${clean(toolName)}`;
	return full.length > MAX_TOOL_NAME_LENGTH ? full.slice(0, MAX_TOOL_NAME_LENGTH) : full;
}

/** isError 结果 → 单行错误文案（抽不出文本时给兜底，不返空白错误）。 */
function flattenErrorText(content: readonly McpContent[]): string {
	const text = content
		.filter((item): item is Extract<McpContent, { type: "text" }> => item.type === "text")
		.map((item) => item.text)
		.join("\n")
		.trim();
	return text !== "" ? text : "MCP 工具执行失败（server 未返回错误说明）";
}

/**
 * 真实连接：MCP SDK Client + 传输层。
 *
 * stdio：StdioClientTransport 内部用 cross-spawn（Windows 的 npx.cmd 能直接跑），
 * 并在我们给的 env 之下再垫一层它自己的默认安全环境变量。
 * HTTP：StreamableHTTPClientTransport（Streamable HTTP 传输）。
 * client.connect() 内含 initialize 握手（协商 protocolVersion + capabilities），
 * timeout 作用于握手请求；失败时 SDK 自己 close 清理，错误向上抛。
 */
async function connectMcpServer(
	_serverName: string,
	config: McpServerConfig,
	onClosed: () => void,
): Promise<McpServerConnection> {
	// name/version 会经 initialize 握手报给 server（对齐 package.json 的版本号）。
	const client = new Client({ name: "kamibuddy", version: "0.1.0" });
	const transport =
		config.transport === "stdio"
			? new StdioClientTransport({
					command: config.command,
					args: [...config.args],
					// 任务要求：process.env + 配置的 env 合并（配置的优先）。
					env: mergedEnv(config.env),
				})
			: new StreamableHTTPClientTransport(new URL(config.url));
	client.onclose = onClosed;
	await client.connect(transport, { timeout: CONNECT_TIMEOUT_MS });

	// tools/list 拉全量清单（分页 server 逐页翻完）。
	const tools: McpTool[] = [];
	let cursor: string | undefined;
	do {
		const page = await client.listTools(cursor === undefined ? undefined : { cursor });
		for (const t of page.tools) {
			tools.push({
				name: t.name,
				title: t.title,
				description: t.description,
				inputSchema: t.inputSchema,
			});
		}
		cursor = page.nextCursor;
	} while (cursor !== undefined);

	return {
		tools,
		callTool: async (toolName, args) => mapCallResult(await client.callTool({ name: toolName, arguments: args })),
		close: () => client.close(),
	};
}

/** process.env + 配置的 env 合并（process.env 值可 undefined，滤掉）。 */
function mergedEnv(configEnv: Readonly<Record<string, string>>): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined) env[key] = value;
	}
	return { ...env, ...configEnv };
}

type CallToolResult = Awaited<ReturnType<Client["callTool"]>>;

/**
 * SDK 的 callTool 结果 → 本扩展的内容形状。
 * 文本与图片直通；音频 / 内嵌资源 / 资源链接拍平成说明文字
 * （模型拿不到二进制也比静默丢内容好）。
 */
function mapCallResult(result: CallToolResult): McpToolCallResult {
	if (!("content" in result) || !Array.isArray(result.content)) {
		// 兼容形状（{ toolResult }）：老协议的 server，原样序列化给模型看。
		return { content: [{ type: "text", text: JSON.stringify(result) }], isError: false };
	}
	const content: McpContent[] = [];
	for (const item of result.content) {
		switch (item.type) {
			case "text":
				content.push({ type: "text", text: item.text });
				break;
			case "image":
				content.push({ type: "image", data: item.data, mimeType: item.mimeType });
				break;
			case "audio":
				content.push({ type: "text", text: `[音频内容（${item.mimeType}），当前无法展示]` });
				break;
			case "resource":
				content.push({
					type: "text",
					text:
						"text" in item.resource && typeof item.resource.text === "string"
							? item.resource.text
							: `[二进制资源 ${item.resource.uri}（${item.resource.mimeType ?? "未知类型"}），当前无法展示]`,
				});
				break;
			case "resource_link":
				content.push({ type: "text", text: `[资源链接] ${item.name}: ${item.uri}` });
				break;
		}
	}
	return { content, isError: result.isError === true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
