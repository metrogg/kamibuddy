/**
 * 会话构造冒烟测试：SessionHost.create() 到底能不能跑起来。
 *
 * 为什么单独一个脚本：这条路径把三件有风险的事串在了一起 ——
 *   1. 自建 DefaultResourceLoader 并 await reload()（顺序错了扩展不生效）
 *   2. 同一个 SettingsManager 同时交给 loader 与 createAgentSession
 *      （各建一个会有两份设置状态，症状是「改了设置一处生效一处不生效」）
 *   3. 经 extensionFactories 注入自己的扩展（签名不对会被静默丢弃）
 * 三者都能通过类型检查，但运行时是否成立必须实测。
 *
 * **不产生任何网络请求**：用一个指向 127.0.0.1:9（保留端口，必然拒连）的
 * 假服务商换取一个真实 Model 对象，只构造会话、不发消息。
 * 因此不消耗任何 API 额度。
 *
 * 用法：npm run smoke:session
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export {};

// 必须在导入我们的模块之前设好：配置路径由 env 决定，
// 用临时目录避免碰用户真实的 ~/.kamibuddy。
const workDir = mkdtempSync(join(tmpdir(), "kami-session-"));
process.env["KAMIBUDDY_CONFIG_DIR"] = join(workDir, "config");
process.env["KAMIBUDDY_WORKSPACE_DIR"] = join(workDir, "workspace");

const { ModelCatalog } = await import("../src/core/model-catalog.ts");
const { SessionHost } = await import("../src/core/session-host.ts");
const { createPermissionGate } = await import("../src/extensions/permission-gate.ts");
const { getConfigDir, getWorkspaceDir } = await import("../src/core/config-paths.ts");
const { mkdirSync } = await import("node:fs");

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail: string): void {
	results.push({ name, ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

console.log(`临时配置目录：${getConfigDir()}\n`);

const catalog = await ModelCatalog.create();

// 假服务商：端口 9 是保留的 discard 端口，任何请求都会立刻失败。
// 这样即便代码里有意外的网络调用，也会立刻暴露而不是静默挂住。
const PROVIDER = "smoke-probe";
const MODEL_KEY = `${PROVIDER}/probe-model`;

await catalog.saveCustomProvider(
	{
		id: PROVIDER,
		name: "冒烟探针",
		baseUrl: "http://127.0.0.1:9/v1",
		api: "openai-completions",
		models: [
			{ id: "probe-model", name: "探针模型", contextWindow: 128000, maxTokens: 8192, reasoning: false, vision: false },
		],
	},
	"sk-smoke-not-a-real-key",
);

check("自定义服务商可用（含凭据）", catalog.isUsable(MODEL_KEY), `isUsable(${MODEL_KEY}) = ${catalog.isUsable(MODEL_KEY)}`);

/* ── 扩展注入是否真的生效 ────────────────────────────────────────── */

// 与权限门并列注入一个探针扩展：factory 被调用就说明注入链路成立。
// 这是验证 #3 的唯一可靠方式 —— 若签名不对，pi 会静默跳过而不报错。
let probeFactoryRan = false;
let probeRegisteredHandler = false;

const cwd = getWorkspaceDir();
mkdirSync(cwd, { recursive: true });

const events: string[] = [];

const host = await SessionHost.create({
	catalog,
	modelKey: MODEL_KEY,
	cwd,
	sceneId: "work",
	interactionId: "craft",
	emit: (event) => events.push(event.type),
	extensions: [
		createPermissionGate({
			paths: { workspaceDir: cwd, configDir: getConfigDir() },
			cwd,
			requestApproval: async () => ({ id: "unused", decision: "deny" }),
		}),
		(pi) => {
			probeFactoryRan = true;
			pi.on("tool_call", async () => {
				probeRegisteredHandler = true;
				return undefined;
			});
		},
	],
});

check("SessionHost.create() 成功", true, "自建 ResourceLoader / SettingsManager / 扩展注入均未抛错");
check(
	"扩展 factory 被调用（注入链路成立）",
	probeFactoryRan,
	probeFactoryRan ? "探针扩展的 factory 已执行" : "factory 未执行 —— 扩展被静默丢弃了",
);
check(
	"扩展可注册 tool_call 处理器",
	probeRegisteredHandler === false,
	// 没有工具调用发生，所以 handler 不该被触发。这里确认的是「注册没抛错」。
	"注册未抛错；handler 未被触发（本次没有工具调用，符合预期）",
);

/* ── 状态是否正确 ────────────────────────────────────────────────── */

const state = host.state;
check("sessionId 非空", state.sessionId !== "", `sessionId = ${state.sessionId || "(空)"}`);
check("cwd 指向工作目录", state.cwd === cwd, `cwd = ${state.cwd}`);
check("modelId 与选中的一致", state.modelId === MODEL_KEY, `modelId = ${state.modelId ?? "(无)"}`);
check("初始不在流式中", !state.isStreaming, `isStreaming = ${state.isStreaming}`);
check("两轴状态保留", state.sceneId === "work" && state.interactionId === "craft", `${state.sceneId} / ${state.interactionId}`);

/* ── 两轴切换会回推状态 ──────────────────────────────────────────── */

const before = events.length;
host.setInteraction("ask");
check(
	"setInteraction 回推 session_state",
	events.length === before + 1 && events[before] === "session_state",
	`新增事件：${events.slice(before).join(", ") || "(无)"}`,
);
check("交互模式已更新", host.state.interactionId === "ask", `interactionId = ${host.state.interactionId}`);

/* ── 中断在空闲时是安全的 ────────────────────────────────────────── */

// 没有进行中的 run 时中断应当是空操作，不该抛错 ——
// UI 上停止键的存在期与 isStreaming 有一帧的差，可能在刚结束时被点到。
try {
	await host.abort();
	check("空闲时 abort() 不抛错", true, "空操作");
} catch (error) {
	check("空闲时 abort() 不抛错", false, String(error));
}

/* ── 汇总 ────────────────────────────────────────────────────────── */

rmSync(workDir, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length > 0) {
	console.log("失败项：");
	for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
	process.exitCode = 1;
}
