/**
 * mcp.json 配置读取测试。
 *
 * 核心断言：
 *   - 双级合并（项目级覆盖用户级同名 server）
 *   - JSONC 宽容（注释 + 尾逗号）与 schema 严格（结构坏了响亮抛 McpConfigError）
 *   - ${VAR} 展开（含「变量未设置 = 抛错」的响亮策略）
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	McpConfigError,
	readMcpConfig,
	readMcpConfigSource,
	toggleMcpServer,
	writeMcpConfig,
} from "./mcp-config.ts";

let configDir: string;
let workspace: string;

beforeEach(() => {
	const base = join(tmpdir(), `kbm-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	configDir = join(base, "config");
	workspace = join(base, "ws");
	mkdirSync(configDir, { recursive: true });
	mkdirSync(workspace, { recursive: true });
	process.env["KAMIBUDDY_CONFIG_DIR"] = configDir;
});

afterEach(() => {
	rmSync(join(configDir, ".."), { recursive: true, force: true });
	delete process.env["KAMIBUDDY_CONFIG_DIR"];
	delete process.env["KBM_TEST_TOKEN"];
});

function writeUserConfig(text: string): void {
	writeFileSync(join(configDir, "mcp.json"), text, "utf8");
}

function writeProjectConfig(text: string): void {
	writeFileSync(join(workspace, ".mcp.json"), text, "utf8");
}

describe("读取与合并", () => {
	it("两级文件都不存在 → 空配置（不是错误）", () => {
		expect(readMcpConfig(workspace)).toEqual({ servers: {} });
	});

	it("用户级 stdio 配置：command/args/env 全读出", () => {
		writeUserConfig(
			JSON.stringify({
				mcpServers: {
					filesystem: {
						command: "npx",
						args: ["-y", "@modelcontextprotocol/server-filesystem", "/data"],
						env: { TOKEN: "abc" },
					},
				},
			}),
		);
		expect(readMcpConfig(workspace).servers["filesystem"]).toEqual({
			transport: "stdio",
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-filesystem", "/data"],
			env: { TOKEN: "abc" },
		});
	});

	it("项目级 HTTP 配置：url 即 HTTP 传输", () => {
		writeProjectConfig(JSON.stringify({ mcpServers: { remote: { url: "http://localhost:3000/mcp" } } }));
		expect(readMcpConfig(workspace).servers["remote"]).toEqual({
			transport: "http",
			url: "http://localhost:3000/mcp",
		});
	});

	it("同名 server 项目级覆盖用户级；不同名并存", () => {
		writeUserConfig(
			JSON.stringify({
				mcpServers: {
					shared: { command: "user-cmd" },
					"user-only": { url: "http://user.example/mcp" },
				},
			}),
		);
		writeProjectConfig(JSON.stringify({ mcpServers: { shared: { command: "project-cmd" } } }));
		const { servers } = readMcpConfig(workspace);
		expect(servers["shared"]).toEqual({
			transport: "stdio",
			command: "project-cmd",
			args: [],
			env: {},
		});
		expect(servers["user-only"]).toEqual({ transport: "http", url: "http://user.example/mcp" });
	});

	it("args/env 缺省回填为空数组/空对象", () => {
		writeUserConfig(JSON.stringify({ mcpServers: { s: { command: "cmd" } } }));
		expect(readMcpConfig(workspace).servers["s"]).toEqual({
			transport: "stdio",
			command: "cmd",
			args: [],
			env: {},
		});
	});
});

describe("JSONC 与 ${VAR} 展开", () => {
	it("注释与尾逗号都能读", () => {
		writeUserConfig(`{
			// 本地文件系统 server
			"mcpServers": {
				"fs": { "command": "npx", }, /* 尾逗号 */
			},
		}`);
		expect(readMcpConfig(workspace).servers["fs"]?.transport).toBe("stdio");
	});

	it("${VAR} 在字符串值里递归展开（env 值 / args / url 都行）", () => {
		process.env["KBM_TEST_TOKEN"] = "secret-1";
		writeUserConfig(
			JSON.stringify({
				mcpServers: {
					s: { command: "cmd", args: ["--token", "${KBM_TEST_TOKEN}"], env: { T: "${KBM_TEST_TOKEN}" } },
					r: { url: "http://localhost/${KBM_TEST_TOKEN}/mcp" },
				},
			}),
		);
		const { servers } = readMcpConfig(workspace);
		expect(servers["s"]).toMatchObject({ args: ["--token", "secret-1"], env: { T: "secret-1" } });
		expect(servers["r"]).toEqual({ transport: "http", url: "http://localhost/secret-1/mcp" });
	});

	it("引用未设置的环境变量 → 响亮抛错（不静默替空串）", () => {
		writeUserConfig(JSON.stringify({ mcpServers: { s: { command: "cmd", env: { T: "${KBM_TEST_TOKEN}" } } } }));
		expect(() => readMcpConfig(workspace)).toThrow(McpConfigError);
		expect(() => readMcpConfig(workspace)).toThrow("KBM_TEST_TOKEN 未设置");
	});
});

describe("schema 校验（坏了响亮抛错）", () => {
	it("JSONC 语法错误", () => {
		writeUserConfig("{ not json !!!");
		expect(() => readMcpConfig(workspace)).toThrow(McpConfigError);
	});

	it("顶层不是对象", () => {
		writeUserConfig("[1,2]");
		expect(() => readMcpConfig(workspace)).toThrow("mcpServers");
	});

	it("mcpServers 不是对象", () => {
		writeUserConfig(JSON.stringify({ mcpServers: "nope" }));
		expect(() => readMcpConfig(workspace)).toThrow("mcpServers 必须是对象");
	});

	it("server 条目既无 command 也无 url", () => {
		writeUserConfig(JSON.stringify({ mcpServers: { s: { args: [] } } }));
		expect(() => readMcpConfig(workspace)).toThrow("必须配置 command");
	});

	it("command 与 url 并存（互斥）", () => {
		writeUserConfig(JSON.stringify({ mcpServers: { s: { command: "c", url: "http://x" } } }));
		expect(() => readMcpConfig(workspace)).toThrow("只能留一个");
	});

	it("args 不是字符串数组", () => {
		writeUserConfig(JSON.stringify({ mcpServers: { s: { command: "c", args: [1] } } }));
		expect(() => readMcpConfig(workspace)).toThrow("args 必须是字符串数组");
	});

	it("env 值不是字符串", () => {
		writeUserConfig(JSON.stringify({ mcpServers: { s: { command: "c", env: { T: 1 } } } }));
		expect(() => readMcpConfig(workspace)).toThrow("env 必须是");
	});

	it("项目级坏了同样抛（不因为是项目级就宽容）", () => {
		writeProjectConfig(JSON.stringify({ mcpServers: { s: {} } }));
		expect(() => readMcpConfig(workspace)).toThrow(McpConfigError);
	});
});

describe("disabled 字段", () => {
	it("disabled: true 读出；缺省不带该字段", () => {
		writeUserConfig(
			JSON.stringify({
				mcpServers: { s: { command: "cmd", disabled: true }, t: { command: "cmd" } },
			}),
		);
		const { servers } = readMcpConfig(workspace);
		expect(servers["s"]?.disabled).toBe(true);
		expect(servers["t"]?.disabled).toBeUndefined();
	});

	it("disabled 不是布尔 → 响亮抛错", () => {
		writeUserConfig(JSON.stringify({ mcpServers: { s: { command: "cmd", disabled: "yes" } } }));
		expect(() => readMcpConfig(workspace)).toThrow("disabled 必须是布尔值");
	});
});

describe("writeMcpConfig", () => {
	it("cwd 给定写项目级并可读回", () => {
		writeMcpConfig(JSON.stringify({ mcpServers: { s: { command: "cmd" } } }), workspace);
		expect(readMcpConfig(workspace).servers["s"]?.transport).toBe("stdio");
	});

	it("cwd 缺省写用户级", () => {
		writeMcpConfig(JSON.stringify({ mcpServers: { s: { url: "http://x/mcp" } } }));
		expect(readMcpConfig(workspace).servers["s"]?.transport).toBe("http");
	});

	it("原文照写（注释与排版保留，不过格式化器）", () => {
		const text = `{\n\t// 本地 server\n\t"mcpServers": {}\n}`;
		writeMcpConfig(text, workspace);
		expect(readFileSync(join(workspace, ".mcp.json"), "utf8")).toBe(text);
	});

	it("非法配置拒写（JSONC 语法 / schema / 未设置的环境变量），不落盘", () => {
		expect(() => writeMcpConfig("{ not json", workspace)).toThrow(McpConfigError);
		expect(() => writeMcpConfig(JSON.stringify({ mcpServers: "nope" }), workspace)).toThrow(
			"mcpServers 必须是对象",
		);
		expect(() =>
			writeMcpConfig(
				JSON.stringify({ mcpServers: { s: { command: "c", env: { T: "${KBM_TEST_TOKEN}" } } } }),
				workspace,
			),
		).toThrow("KBM_TEST_TOKEN 未设置");
		expect(readMcpConfig(workspace).servers).toEqual({});
	});
});

describe("readMcpConfigSource", () => {
	it("项目级存在读项目级原文，否则用户级，都没有空串", () => {
		expect(readMcpConfigSource(workspace)).toBe("");
		writeUserConfig(`{ "mcpServers": {} }`);
		expect(readMcpConfigSource(workspace)).toBe(`{ "mcpServers": {} }`);
		writeProjectConfig(`{ // 项目级\n"mcpServers": {} }`);
		expect(readMcpConfigSource(workspace)).toBe(`{ // 项目级\n"mcpServers": {} }`);
	});

	it("cwd 缺省只读用户级", () => {
		writeUserConfig(`{ "mcpServers": {} }`);
		writeProjectConfig(`{ "mcpServers": { "p": { "command": "c" } } }`);
		expect(readMcpConfigSource()).toBe(`{ "mcpServers": {} }`);
	});
});

describe("toggleMcpServer", () => {
	it("定义在用户级就改用户级：加 disabled 字段，再启用改回 false", () => {
		writeUserConfig(JSON.stringify({ mcpServers: { s: { command: "cmd" } } }));
		toggleMcpServer("s", false, workspace);
		expect(readMcpConfig(workspace).servers["s"]?.disabled).toBe(true);
		toggleMcpServer("s", true, workspace);
		expect(readMcpConfig(workspace).servers["s"]?.disabled).toBe(false);
	});

	it("同名 server 项目级优先：改项目级文件，用户级不动", () => {
		writeUserConfig(JSON.stringify({ mcpServers: { s: { command: "user-cmd" } } }));
		writeProjectConfig(JSON.stringify({ mcpServers: { s: { command: "project-cmd" } } }));
		toggleMcpServer("s", false, workspace);
		expect(readMcpConfig(workspace).servers["s"]?.disabled).toBe(true);
		const user: unknown = JSON.parse(readFileSync(join(configDir, "mcp.json"), "utf8"));
		expect(user).toEqual({ mcpServers: { s: { command: "user-cmd" } } });
	});

	it("最小编辑：注释与格式保留", () => {
		writeUserConfig(`{
	// 本地 server
	"mcpServers": {
		"s": { "command": "cmd" },
	},
}`);
		toggleMcpServer("s", false, workspace);
		const text = readFileSync(join(configDir, "mcp.json"), "utf8");
		expect(text).toContain("// 本地 server");
		expect(readMcpConfig(workspace).servers["s"]?.disabled).toBe(true);
	});

	it("server 不存在 → 响亮抛错", () => {
		expect(() => toggleMcpServer("nope", false, workspace)).toThrow("找不到名为「nope」");
	});

	it("文件坏了拒改（先在编辑器里修，不在坏文件上做文本编辑）", () => {
		writeUserConfig("{ not json");
		expect(() => toggleMcpServer("s", false, workspace)).toThrow(McpConfigError);
	});
});
