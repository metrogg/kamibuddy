/**
 * MCP 连接器端到端冒烟：真实 stdio 连接官方 filesystem server，跑通
 * 「配置 → 连接 → 工具出现在工具面 → （模拟）模型调用 → 结果返回」完整链路。
 *
 * 为什么单独一个脚本：mcp-client.test.ts 的接缝测试注入的是假连接，
 * 只能证明状态机与注册逻辑对；「@modelcontextprotocol/sdk 真能把 npx 子进程
 * 拉起来、initialize 握手、tools/list、tools/call」这一段从未被证明过 ——
 * 尤其是 Windows 上 npx.cmd 的 spawn 行为（cross-spawn）与 30s 握手超时。
 *
 * 验证点：
 *   1. mcp.json 真实写读（writeMcpConfig / readMcpConfig）：JSONC 注释与
 *      ${VAR} 环境变量展开都在生效路径上；
 *   2. 扩展加载后 filesystem server 状态 connected，工具以 mcp__filesystem__
 *      前缀注册进工具面；
 *   3. 模拟模型调用（直接调注册工具的 execute —— pi agent-loop 调工具走的
 *      正是这个入口）read_text_file / list_directory 返回真实内容；
 *   4. server 拒绝允许目录外的读取 → execute 抛错（isError 映射）；
 *   5. 必失败的 server（command 不存在）标记 failed，不阻塞 filesystem。
 *
 * **本脚本不能证明的事**：真实模型会不会选择调用 MCP 工具（由手测覆盖，
 * 见 docs/mcp-connector.md「手动验证」），以及权限审批弹窗（权限门链路
 * 由 npm run smoke:permission 覆盖）。
 *
 * 首次运行 npx 会联网下载 server 包（之后走本地缓存）。全程在临时目录下，
 * 结束即清理，不碰真实的 ~/.kamibuddy。
 *
 * 用法：npm run smoke:mcp
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export {};

// 必须在导入我们的模块之前设好：配置路径由 env 决定（同 smoke-session 的构造模式）。
const workDir = mkdtempSync(join(tmpdir(), "kami-mcp-"));
process.env["KAMIBUDDY_CONFIG_DIR"] = join(workDir, "config");

// filesystem server 的允许目录：经 ${KAMI_SMOKE_MCP_DIR} 引用写进 mcp.json，
// 顺带验证环境变量展开。
const fixtureDir = join(workDir, "fixture");
mkdirSync(fixtureDir, { recursive: true });
process.env["KAMI_SMOKE_MCP_DIR"] = fixtureDir;

const HELLO_CONTENT = "kami-mcp-smoke-hello-7f3d9a";
const helloPath = join(fixtureDir, "hello.txt");
writeFileSync(helloPath, HELLO_CONTENT, "utf8");
// 允许目录之外的文件：验证 server 侧拒绝 + isError 映射。
const outsidePath = join(workDir, "outside.txt");
writeFileSync(outsidePath, "kami-mcp-smoke-outside", "utf8");
// 会话工作目录：不放 .mcp.json，配置全部走用户级。
const workspaceDir = join(workDir, "workspace");
mkdirSync(workspaceDir, { recursive: true });

const { readMcpConfig, writeMcpConfig } = await import("../src/core/mcp-config.ts");
const { createMcpClient } = await import("../src/extensions/mcp-client.ts");

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail: string): void {
	results.push({ name, ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

/* ── 1. 配置写入与读取（JSONC + ${VAR} 展开在生效路径上）────────── */

writeMcpConfig(`{
	// JSONC：注释与尾逗号都是合法语法。filesystem 的允许目录引用环境变量。
	"mcpServers": {
		"filesystem": {
			"command": "npx",
			"args": ["-y", "@modelcontextprotocol/server-filesystem", "\${KAMI_SMOKE_MCP_DIR}"],
		},
		"broken": {
			"command": "kami-mcp-definitely-not-exists-9f8e7d",
			"args": [],
		},
	}
}`);

const loaded = readMcpConfig(workspaceDir);
const fsConfig = loaded.servers["filesystem"];
const fsArgs = fsConfig !== undefined && fsConfig.transport === "stdio" ? fsConfig.args : undefined;
check(
	"配置读取：JSONC 注释 + 两个 server 合并生效",
	fsConfig !== undefined && loaded.servers["broken"] !== undefined,
	`servers = ${Object.keys(loaded.servers).join(", ")}`,
);
check(
	"${VAR} 展开为环境变量值",
	fsArgs !== undefined && fsArgs[2] === fixtureDir,
	`filesystem.args[2] = ${fsArgs?.[2] ?? "(缺失)"}`,
);

/* ── 2. 扩展加载：真实连接 + 工具注册 ───────────────────────────── */

interface RegisteredTool {
	readonly name: string;
	readonly description: string;
	readonly execute: (
		toolCallId: string,
		params: unknown,
	) => Promise<{ content: Array<{ type: string; text?: string }> }>;
}

const tools = new Map<string, RegisteredTool>();
const shutdownHandlers: Array<() => unknown> = [];
const fakePi = {
	registerTool: (def: RegisteredTool) => tools.set(def.name, def),
	on: (event: string, handler: () => unknown) => {
		if (event === "session_shutdown") shutdownHandlers.push(handler);
	},
} as unknown as ExtensionAPI;

const handle = createMcpClient({
	cwd: workspaceDir,
	log: (m) => console.log(`      [mcp] ${m}`),
});
await handle.extension(fakePi);

const states = handle.getServerStates();
const fsState = states.find((s) => s.name === "filesystem");
const brokenState = states.find((s) => s.name === "broken");
check(
	"filesystem server 连接成功（真实 stdio 子进程 + initialize 握手 + tools/list）",
	fsState?.status === "connected" && fsState.toolCount > 0,
	`status = ${fsState?.status ?? "(缺失)"}，工具数 = ${fsState?.toolCount ?? 0}`,
);
// 失败降级：命令不存在的 server 连接失败，原因记录在 error 里；随后进入
// 指数退避重连（status=connecting，最多 5 次后放弃转 failed）——这是既有
// 设计（重连不区分永久/暂时错误），脚本不等退避跑完，只验证「失败已记录
// 且不阻塞 filesystem」。
check(
	"失败的 server 记录失败原因且不阻塞其他 server",
	brokenState !== undefined &&
		brokenState.error !== undefined &&
		brokenState.error !== "" &&
		(brokenState.status === "connecting" || brokenState.status === "failed") &&
		fsState?.status === "connected",
	`broken: status = ${brokenState?.status ?? "(缺失)"}，error = ${brokenState?.error ?? "(无)"}`,
);

/* ── 3. 工具面 ─────────────────────────────────────────────────── */

const mcpTools = [...tools.keys()];
check(
	"工具以 mcp__ 前缀注册进工具面",
	mcpTools.length > 0 && mcpTools.every((n) => n.startsWith("mcp__")),
	`已注册 ${mcpTools.length} 个：${mcpTools.slice(0, 5).join(", ")}${mcpTools.length > 5 ? " …" : ""}`,
);
const reader = tools.get("mcp__filesystem__read_text_file");
const lister = tools.get("mcp__filesystem__list_directory");
check(
	"mcp__filesystem__read_text_file / list_directory 在工具面",
	reader !== undefined && lister !== undefined,
	`read_text_file ${reader !== undefined ? "有" : "无"}，list_directory ${lister !== undefined ? "有" : "无"}`,
);

/* ── 4. 模拟模型调用（execute 即 pi agent-loop 的调用入口）───────── */

if (reader !== undefined) {
	const result = await reader.execute("call-1", { path: helloPath });
	const text = result.content.map((c) => c.text ?? "").join("\n");
	check(
		"调用 read_text_file → 返回文件真实内容",
		text.includes(HELLO_CONTENT),
		text.includes(HELLO_CONTENT)
			? `返回 ${text.length} 字符，含 fixture 标记`
			: `返回内容不含 fixture 标记：${text.slice(0, 120)}`,
	);

	// 允许目录之外：server 拒读 → isError → execute 抛错（模型据此自我纠正）。
	let denied = false;
	try {
		await reader.execute("call-2", { path: outsidePath });
	} catch {
		denied = true;
	}
	check(
		"允许目录外的读取被 server 拒绝（isError → execute 抛错）",
		denied,
		denied ? "execute 按预期抛错" : "读取目录外文件竟然成功 —— server 的目录边界失效了",
	);
}

if (lister !== undefined) {
	const result = await lister.execute("call-3", { path: fixtureDir });
	const text = result.content.map((c) => c.text ?? "").join("\n");
	check(
		"调用 list_directory → 列出 fixture 文件",
		text.includes("hello.txt"),
		`返回：${text.slice(0, 120)}`,
	);
}

/* ── teardown：关子进程、清临时目录 ─────────────────────────────── */

for (const h of shutdownHandlers) h();
// client.close() 先关 stdin 再杀子进程，给它一点时间退出，避免父进程被管道挂住。
await new Promise((resolve) => setTimeout(resolve, 1000));
rmSync(workDir, { recursive: true, force: true });

/* ── 汇总 ──────────────────────────────────────────────────────── */

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length > 0) {
	console.log("失败项：");
	for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
	process.exitCode = 1;
}
