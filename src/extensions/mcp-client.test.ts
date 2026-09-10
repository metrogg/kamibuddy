/**
 * MCP 连接器扩展的接缝测试。
 *
 * connectMcpServer（SDK 适配层）不在这里测 —— 那层要真 server。
 * 这里测状态机与注册逻辑（注入假连接）：
 *   - 工具注册的命名/直通 schema/缺省回填
 *   - execute 的参数转发、结果映射、isError 与「未连接」错误
 *   - 失败降级（一个 server 失败不阻塞其他）
 *   - 断线重连（指数退避、上限放弃、重连后原注册复活）
 *   - session_shutdown 断开全部连接并不再重连（handle 随之失效）
 *   - 状态快照（connected/failed/disabled/connecting 四态 + toolCount）
 *   - reload 热应用（增/删/改/启停、配置坏了拒载、启动零加载后的就地修复）
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { McpServersConfig } from "../core/mcp-config.ts";
import {
	createMcpClient,
	type McpClientHandle,
	type McpConnector,
	type McpServerConnection,
	type McpTool,
} from "./mcp-client.ts";

interface FakeToolDef {
	readonly name: string;
	readonly label: string;
	readonly description: string;
	readonly parameters: unknown;
	readonly execute: (
		toolCallId: string,
		params: unknown,
	) => Promise<{ content: Array<{ type: string; text?: string }>; details: unknown }>;
}

const STDIO = { transport: "stdio", command: "npx", args: ["-y", "srv"], env: {} } as const;
const HTTP = { transport: "http", url: "http://localhost:3000/mcp" } as const;

function tool(name: string, extra: Partial<McpTool> = {}): McpTool {
	return { name, title: undefined, description: undefined, inputSchema: { type: "object" }, ...extra };
}

function fakeConnection(
	tools: readonly McpTool[],
	callTool?: McpServerConnection["callTool"],
): McpServerConnection & { readonly closeCalls: number } {
	const state = { closeCalls: 0 };
	return {
		tools,
		callTool: callTool ?? (async () => ({ content: [{ type: "text", text: "ok" }], isError: false })),
		close: async () => {
			state.closeCalls += 1;
		},
		get closeCalls() {
			return state.closeCalls;
		},
	};
}

/** run 的返回：handle 给快照/reload 断言，setConfig 换「磁盘上的配置」再触发 reload。 */
interface MountedRun {
	readonly handle: McpClientHandle;
	readonly setConfig: (next: McpServersConfig | Error) => void;
}

interface Mounted {
	readonly tools: Map<string, FakeToolDef>;
	readonly logs: string[];
	readonly shutdown: () => void;
	readonly run: (connect: McpConnector, config?: McpServersConfig | Error) => Promise<MountedRun>;
}

function mount(): Mounted {
	const tools = new Map<string, FakeToolDef>();
	const logs: string[] = [];
	const shutdownHandlers: Array<() => unknown> = [];
	const fakePi = {
		registerTool: (def: FakeToolDef) => {
			tools.set(def.name, def);
		},
		on: (event: string, handler: () => unknown) => {
			if (event === "session_shutdown") shutdownHandlers.push(handler);
		},
	} as unknown as ExtensionAPI;
	return {
		tools,
		logs,
		shutdown: () => {
			for (const h of shutdownHandlers) h();
		},
		run: async (connect, config = { servers: {} }) => {
			let current = config;
			const readConfig = (): McpServersConfig => {
				if (current instanceof Error) throw current;
				return current;
			};
			const handle = createMcpClient({ cwd: "/ws", readConfig, connect, log: (m) => logs.push(m) });
			await handle.extension(fakePi);
			return {
				handle,
				setConfig: (next) => {
					current = next;
				},
			};
		},
	};
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe("启动", () => {
	it("未配置 → 不连接、不注册（零开销秒退）", async () => {
		const m = mount();
		let connectCalls = 0;
		await m.run(async () => {
			connectCalls += 1;
			return fakeConnection([]);
		});
		expect(connectCalls).toBe(0);
		expect(m.tools.size).toBe(0);
	});

	it("配置坏了 → 记日志、不注册、不抛出（不阻塞会话）", async () => {
		const m = mount();
		await m.run(async () => fakeConnection([]), new Error("mcp.json 不是合法的 JSONC"));
		expect(m.tools.size).toBe(0);
		expect(m.logs.some((l) => l.includes("配置读取失败") && l.includes("JSONC"))).toBe(true);
	});

	it("一个 server 失败不阻塞另一个；失败原因进日志", async () => {
		const m = mount();
		await m.run(
			async (name) => {
				if (name === "bad") throw new Error("spawn npx ENOENT");
				return fakeConnection([tool("read_file")]);
			},
			{ servers: { good: STDIO, bad: HTTP } },
		);
		expect(m.tools.has("mcp__good__read_file")).toBe(true);
		expect(m.tools.size).toBe(1);
		expect(m.logs.some((l) => l.includes("「good」已连接") && l.includes("1 个工具"))).toBe(true);
		expect(m.logs.some((l) => l.includes("「bad」连接失败") && l.includes("ENOENT"))).toBe(true);
	});
});

describe("工具注册", () => {
	it("名称加 mcp__server__tool 前缀；label/description/schema 直通与缺省回填", async () => {
		const m = mount();
		await m.run(async () =>
			fakeConnection([
				tool("read_file", {
					title: "读文件",
					description: "读取一个文件",
					inputSchema: { type: "object", properties: { path: { type: "string" } } },
				}),
				tool("write_file"),
			]),
			{ servers: { fs: STDIO } },
		);
		const read = m.tools.get("mcp__fs__read_file");
		expect(read?.label).toBe("读文件");
		expect(read?.description).toBe("读取一个文件");
		// 原生 JSON Schema 直通（不做 TypeBox 转换）
		expect(read?.parameters).toEqual({ type: "object", properties: { path: { type: "string" } } });
		const write = m.tools.get("mcp__fs__write_file");
		expect(write?.label).toBe("write_file");
		expect(write?.description).toContain("「fs」");
	});

	it("非法字符清洗成下划线（read.file → read_file；连字符本就合法，保留）", async () => {
		const m = mount();
		await m.run(async () => fakeConnection([tool("read.file")]), {
			servers: { "my-server": STDIO },
		});
		expect(m.tools.has("mcp__my-server__read_file")).toBe(true);
	});

	it("清洗后撞名的工具跳过并记日志，不静默覆盖", async () => {
		const m = mount();
		await m.run(async () => fakeConnection([tool("read.file"), tool("read/file")]), {
			servers: { fs: STDIO },
		});
		expect(m.tools.size).toBe(1);
		expect(m.logs.some((l) => l.includes("撞名"))).toBe(true);
	});
});

describe("execute", () => {
	it("转发 tools/call 的参数与结果（text + image），details 带 server/tool", async () => {
		const m = mount();
		const seen: Array<{ name: string; args: Record<string, unknown> }> = [];
		await m.run(
			async () =>
				fakeConnection([tool("get")], async (name, args) => {
					seen.push({ name, args });
					return {
						content: [
							{ type: "text", text: "你好" },
							{ type: "image", data: "aW1n", mimeType: "image/png" },
						],
						isError: false,
					};
				}),
			{ servers: { fs: STDIO } },
		);
		const result = await m.tools.get("mcp__fs__get")?.execute("t1", { path: "/a.txt" });
		expect(seen).toEqual([{ name: "get", args: { path: "/a.txt" } }]);
		expect(result?.content).toEqual([
			{ type: "text", text: "你好" },
			{ type: "image", data: "aW1n", mimeType: "image/png" },
		]);
		expect(result?.details).toEqual({ server: "fs", tool: "get" });
	});

	it("MCP isError 结果 → 抛错（pi 标记工具失败回给模型），文本带上", async () => {
		const m = mount();
		await m.run(
			async () =>
				fakeConnection([tool("get")], async () => ({
					content: [{ type: "text", text: "文件不存在" }],
					isError: true,
				})),
			{ servers: { fs: STDIO } },
		);
		await expect(m.tools.get("mcp__fs__get")?.execute("t1", {})).rejects.toThrow("文件不存在");
	});

	it("server 未连接时调用 → 抛「未连接」错误（带原因）", async () => {
		const m = mount();
		let onClosed: (() => void) | undefined;
		await m.run(
			async (_name, _config, closed) => {
				onClosed = closed;
				return fakeConnection([tool("get")]);
			},
			{ servers: { fs: STDIO } },
		);
		onClosed?.();
		await expect(m.tools.get("mcp__fs__get")?.execute("t1", {})).rejects.toThrow("未连接");
		m.shutdown(); // 清掉挂起的重连定时器
	});
});

describe("断线重连", () => {
	it("断开后指数退避重连，成功则原注册复活（不重复注册）", async () => {
		const m = mount();
		const closedCallbacks: Array<() => void> = [];
		let connectCalls = 0;
		await m.run(
			async (_name, _config, closed) => {
				connectCalls += 1;
				closedCallbacks.push(closed);
				return fakeConnection([tool("get")]);
			},
			{ servers: { fs: STDIO } },
		);
		expect(connectCalls).toBe(1);

		// 断开 → 1s 后第一次重连成功
		closedCallbacks[0]?.();
		expect(m.tools.get("mcp__fs__get")).toBeDefined();
		await vi.advanceTimersByTimeAsync(1000);
		expect(connectCalls).toBe(2);
		expect(m.logs.some((l) => l.includes("「fs」重连成功"))).toBe(true);
		// 工具仍只注册一份，且execute 走新连接
		expect(m.tools.size).toBe(1);
		const result = await m.tools.get("mcp__fs__get")?.execute("t1", {});
		expect(result?.content[0]?.text).toBe("ok");
		m.shutdown();
	});

	it("重连 5 次均失败 → 放弃并记日志（退避 1s/2s/4s/8s/8s）", async () => {
		const m = mount();
		const closedCallbacks: Array<() => void> = [];
		let failures = 0;
		await m.run(
			async (_name, _config, closed) => {
				closedCallbacks.push(closed);
				failures += 1;
				if (failures > 1) throw new Error("connection refused");
				return fakeConnection([tool("get")]);
			},
			{ servers: { fs: STDIO } },
		);
		closedCallbacks[0]?.();
		for (const delay of [1000, 2000, 4000, 8000, 8000]) {
			await vi.advanceTimersByTimeAsync(delay);
		}
		// 首次连接 + 5 次重连 = 6 次尝试
		expect(failures).toBe(6);
		expect(m.logs.some((l) => l.includes("重连 5 次均失败"))).toBe(true);
		// 放弃后不再安排定时器：再推进也不该有新的连接尝试
		await vi.advanceTimersByTimeAsync(60_000);
		expect(failures).toBe(6);
		m.shutdown();
	});
});

describe("teardown", () => {
	it("session_shutdown 断开所有连接；断开后的 onClose 不再触发重连", async () => {
		const m = mount();
		const connections: Array<ReturnType<typeof fakeConnection>> = [];
		const closedCallbacks: Array<() => void> = [];
		let connectCalls = 0;
		await m.run(
			async (_name, _config, closed) => {
				connectCalls += 1;
				closedCallbacks.push(closed);
				const conn = fakeConnection([tool("t")]);
				connections.push(conn);
				return conn;
			},
			{ servers: { a: STDIO, b: HTTP } },
		);
		m.shutdown();
		expect(connections.map((c) => c.closeCalls)).toEqual([1, 1]);
		// teardown 后的 onclose（SDK 在主动 close() 时也会触发）不得引发重连
		closedCallbacks.forEach((cb) => cb());
		await vi.advanceTimersByTimeAsync(60_000);
		expect(connectCalls).toBe(2);
	});

	it("teardown 后快照为空、reload 空操作", async () => {
		const m = mount();
		const { handle, setConfig } = await m.run(async () => fakeConnection([tool("t")]), {
			servers: { a: STDIO },
		});
		m.shutdown();
		expect(handle.getServerStates()).toEqual([]);
		setConfig({ servers: { b: HTTP } });
		await handle.reload(); // 不抛、不连
		expect(m.tools.has("mcp__b__t")).toBe(false);
	});
});

describe("状态快照", () => {
	it("connected / failed / disabled 三态与 toolCount；disabled 不连不注册", async () => {
		const m = mount();
		const { handle } = await m.run(
			async (name) => {
				if (name === "bad") throw new Error("spawn ENOENT");
				return fakeConnection([tool("a"), tool("b")]);
			},
			{ servers: { good: STDIO, bad: HTTP, off: { ...STDIO, disabled: true } } },
		);
		const states = new Map(handle.getServerStates().map((s) => [s.name, s]));
		expect(states.get("good")).toMatchObject({ status: "connected", toolCount: 2 });
		expect(states.get("bad")).toMatchObject({ status: "failed", toolCount: 0, error: "spawn ENOENT" });
		expect(states.get("off")).toMatchObject({ status: "disabled", toolCount: 0 });
		// disabled 的不连不注册；bad 的失败不阻塞 good
		expect(m.tools.size).toBe(2);
	});

	it("断线退避中标 connecting（还没放弃），放弃后标 failed", async () => {
		const m = mount();
		let onClosed: (() => void) | undefined;
		let failures = 0;
		const { handle } = await m.run(
			async (_name, _config, closed) => {
				onClosed = closed;
				failures += 1;
				if (failures > 1) throw new Error("connection refused");
				return fakeConnection([tool("t")]);
			},
			{ servers: { a: STDIO } },
		);
		onClosed?.();
		expect(handle.getServerStates()[0]).toMatchObject({ status: "connecting" });
		for (const delay of [1000, 2000, 4000, 8000, 8000]) {
			await vi.advanceTimersByTimeAsync(delay);
		}
		expect(handle.getServerStates()[0]).toMatchObject({ status: "failed" });
		m.shutdown();
	});
});

describe("reload", () => {
	it("新增 server：连接并注册工具；无变化的 server 不重连", async () => {
		const m = mount();
		const connected: string[] = [];
		const { handle, setConfig } = await m.run(
			async (name) => {
				connected.push(name);
				return fakeConnection([tool("t")]);
			},
			{ servers: { a: STDIO } },
		);
		setConfig({ servers: { a: STDIO, b: HTTP } });
		await handle.reload();
		expect(connected).toEqual(["a", "b"]); // a 配置没变，未重连
		expect(m.tools.has("mcp__b__t")).toBe(true);
		expect(handle.getServerStates().map((s) => s.name)).toEqual(["a", "b"]);
		m.shutdown();
	});

	it("删除 server：断开、快照消失；残留注册的工具报「已从配置移除」", async () => {
		const m = mount();
		const conn = fakeConnection([tool("t")]);
		const { handle, setConfig } = await m.run(async () => conn, { servers: { a: STDIO } });
		setConfig({ servers: {} });
		await handle.reload();
		expect(conn.closeCalls).toBe(1);
		expect(handle.getServerStates()).toEqual([]);
		// pi 没有 unregisterTool：注册留着，但 execute 给明确错误而不是幽灵成功
		await expect(m.tools.get("mcp__a__t")?.execute("t1", {})).rejects.toThrow("已从配置移除");
	});

	it("禁用：断开且状态 disabled；再启用：重连复活且不重复注册工具", async () => {
		const m = mount();
		let connectCalls = 0;
		const { handle, setConfig } = await m.run(
			async () => {
				connectCalls += 1;
				return fakeConnection([tool("t")]);
			},
			{ servers: { a: STDIO } },
		);
		setConfig({ servers: { a: { ...STDIO, disabled: true } } });
		await handle.reload();
		expect(handle.getServerStates()[0]).toMatchObject({ status: "disabled" });

		setConfig({ servers: { a: STDIO } });
		await handle.reload();
		expect(connectCalls).toBe(2);
		expect(handle.getServerStates()[0]).toMatchObject({ status: "connected" });
		// 走重连复活路径：工具仍只注册一份，execute 走新连接
		expect(m.tools.size).toBe(1);
		const result = await m.tools.get("mcp__a__t")?.execute("t1", {});
		expect(result?.content[0]?.text).toBe("ok");
		m.shutdown();
	});

	it("初始禁用的 server 启用后：连接并补注册工具", async () => {
		const m = mount();
		const { handle, setConfig } = await m.run(async () => fakeConnection([tool("t")]), {
			servers: { a: { ...STDIO, disabled: true } },
		});
		expect(m.tools.size).toBe(0);
		setConfig({ servers: { a: STDIO } });
		await handle.reload();
		expect(m.tools.has("mcp__a__t")).toBe(true);
		expect(handle.getServerStates()[0]).toMatchObject({ status: "connected", toolCount: 1 });
		m.shutdown();
	});

	it("配置变更（command 变了）：旧连接断开重连，工具不重复注册", async () => {
		const m = mount();
		const conns: Array<ReturnType<typeof fakeConnection>> = [];
		const { handle, setConfig } = await m.run(
			async () => {
				const c = fakeConnection([tool("t")]);
				conns.push(c);
				return c;
			},
			{ servers: { a: STDIO } },
		);
		setConfig({ servers: { a: { ...STDIO, command: "other-cmd" } } });
		await handle.reload();
		expect(conns.length).toBe(2);
		expect(conns[0]?.closeCalls).toBe(1);
		expect(m.tools.size).toBe(1);
		expect(handle.getServerStates()[0]).toMatchObject({ status: "connected" });
		m.shutdown();
	});

	it("配置坏了：reload 抛错且现有连接不动", async () => {
		const m = mount();
		const conn = fakeConnection([tool("t")]);
		const { handle, setConfig } = await m.run(async () => conn, { servers: { a: STDIO } });
		setConfig(new Error("mcp.json 不是合法的 JSONC"));
		await expect(handle.reload()).rejects.toThrow("JSONC");
		expect(conn.closeCalls).toBe(0);
		expect(handle.getServerStates()[0]).toMatchObject({ status: "connected" });
		m.shutdown();
	});

	it("启动时配置坏了（零加载）：修复后 reload 就地生效，不必重启会话", async () => {
		const m = mount();
		const { handle, setConfig } = await m.run(
			async () => fakeConnection([tool("t")]),
			new Error("mcp.json 不是合法的 JSONC"),
		);
		expect(handle.getServerStates()).toEqual([]);
		setConfig({ servers: { a: STDIO } });
		await handle.reload();
		expect(m.tools.has("mcp__a__t")).toBe(true);
		expect(handle.getServerStates()[0]).toMatchObject({ status: "connected" });
		m.shutdown();
	});
});
