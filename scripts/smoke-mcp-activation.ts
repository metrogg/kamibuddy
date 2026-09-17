/**
 * MCP 工具激活的端到端冒烟：真实 pi 会话里，MCP 工具注册后**模型侧可见**。
 *
 * 为什么必须有这一层：mcp-client.test.ts 用假 ExtensionAPI、smoke:mcp 的假 pi
 * 也只验证注册 —— 它们都测不出「注册了但被 pi 的激活名单滤掉」这个问题
 *（2026-09-17 试用前自查发现：pi 把 createAgentSession 的 tools 当激活名单，
 * 运行期注册的扩展工具默认不可见，连接器页显示 N 个工具、模型一个都调不到）。
 *
 * 手法：SessionHost.create（与 daemon 同一条构造路径）+ 真实 mcp 扩展工厂 +
 * 本地 stdio echo server（scripts/mcp-echo-server.mjs，零网络 —— 不用官方
 * filesystem server + npx，内网慢网环境也能跑）。craft 模式白名单不含 mcp__*，
 * 正是出问题的形态；断言激活集同时含白名单成员与 MCP 工具。
 *
 * 用法：npm run smoke:mcp-activation
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export {};

// 必须在导入我们的模块之前设好：配置路径由 env 决定（同 smoke-session.ts）。
const workDir = mkdtempSync(join(tmpdir(), "kami-smoke-mcp-act-"));
process.env["KAMIBUDDY_CONFIG_DIR"] = join(workDir, "config");
process.env["KAMIBUDDY_WORKSPACE_DIR"] = join(workDir, "workspace");

const { ModelCatalog } = await import("../src/core/model-catalog.ts");
const { SessionHost } = await import("../src/core/session-host.ts");
const { loadResources } = await import("../src/core/resources.ts");
const { getResourcesDir, getWorkspaceDir } = await import("../src/core/config-paths.ts");
const { createMcpClient } = await import("../src/extensions/mcp-client.ts");
const { fileURLToPath } = await import("node:url");

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail: string): void {
	results.push({ name, ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

const cwd = join(getWorkspaceDir(), "space");
mkdirSync(cwd, { recursive: true });

// 项目级 .mcp.json：stdio 拉起本地 echo server（绝对路径，不依赖 PATH）。
const echoServer = fileURLToPath(new URL("./mcp-echo-server.mjs", import.meta.url));
writeFileSync(
	join(cwd, ".mcp.json"),
	JSON.stringify({
		mcpServers: { echo: { command: process.execPath, args: [echoServer] } },
	}),
);

const catalog = await ModelCatalog.create();
const PROVIDER = "smoke-mcp-act";
const MODEL_KEY = `${PROVIDER}/probe-model`;
await catalog.saveCustomProvider(
	{
		id: PROVIDER,
		name: "MCP 激活冒烟",
		baseUrl: "http://127.0.0.1:9/v1",
		api: "openai-completions",
		models: [
			{ id: "probe-model", name: "探针模型", contextWindow: 128000, maxTokens: 8192, reasoning: false, vision: false },
		],
	},
	"sk-smoke-not-a-real-key",
);

const mcp = createMcpClient({ cwd, log: (m) => console.log(`      [mcp] ${m}`) });

const host = await SessionHost.create({
	catalog,
	modelKey: MODEL_KEY,
	cwd,
	isTempTask: false,
	sceneId: "work",
	interactionId: "craft",
	emit: () => {},
	resources: loadResources(getResourcesDir()),
	extensions: [(pi) => mcp.extension(pi)],
	// 与 daemon 的 createHost 同款：初次激活靠会话构造后的补激活钩子。
	extraActiveTools: () => mcp.registeredToolNames(),
});

/* ── 等连接握手完成（spawn + initialize + tools/list，给足冷启动时间）── */

const waitUntil = async (predicate: () => boolean, timeoutMs: number, label: string): Promise<void> => {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (predicate()) return;
		await new Promise((done) => setTimeout(done, 100));
	}
	throw new Error(`等待超时：${label}`);
};

let connected = true;
try {
	await waitUntil(
		() => mcp.getServerStates().some((s) => s.name === "echo" && s.status === "connected"),
		30_000,
		"echo server 连接（status=connected）",
	);
} catch {
	connected = false;
}
const echoState = mcp.getServerStates().find((s) => s.name === "echo");
check(
	"前置：echo server 已连接（真实 stdio 子进程 + initialize 握手）",
	connected && echoState?.toolCount === 1,
	`status=${echoState?.status ?? "(缺失)"}，toolCount=${echoState?.toolCount ?? 0}，error=${echoState?.error ?? "无"}`,
);

const active = host.activeToolNames();
check(
	"MCP 工具在激活集里（模型可见）——修复的核心断言",
	active.includes("mcp__echo__echo"),
	`激活集 ${active.length} 个：${active.join(", ")}`,
);
check(
	"模式白名单成员不被挤掉（合并而非替换）",
	active.includes("read") && active.includes("edit") && active.includes("powershell"),
	`craft 白名单抽检：read/edit/powershell 是否都在 → ${active.includes("read")}/${active.includes("edit")}/${active.includes("powershell")}`,
);

// 收尾：dispose 宿主（mcp 扩展的 session_shutdown 会断开子进程）。
host.dispose();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length > 0) {
	console.log("失���项：");
	for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
}
rmSync(workDir, { recursive: true, force: true });
// 显式退出：stdio 子进程的管道即使 close 后也可能留有句柄，事件循环不自动清空。
process.exit(failed.length > 0 ? 1 : 0);
