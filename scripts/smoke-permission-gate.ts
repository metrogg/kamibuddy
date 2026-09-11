/**
 * 权限门端到端构造验证：在**真实 pi 运行时**里触发 beforeToolCall 拦截链。
 *
 * 为什么有这个脚本（2026-09-09 事故调查的直接产物）：
 * permission-gate.ts 的单元测试用的是 fake ExtensionAPI，只能证明「若 pi 把
 * tool_call 事件送到，判定逻辑是对的」；而事故里两天事件日志中 permission:request
 * 为零 —— 「pi 真的会把事件送到我们的 handler」这一段链从未被证明过。
 * 本脚本补上这段：extension factory → DefaultResourceLoader → ExtensionRunner
 * → agent.beforeToolCall（agent-session.js 的 _installAgentToolHooks，真实模型
 * 调用工具时走的就是它）→ 权限门 handler → 判定策略 → requestApproval 回调。
 *
 * 触发方式：直接调 session.agent.beforeToolCall。pi 的 AgentSession 把工具拦截
 * 实现在 agent 的这个公开字段上（构造时安装，运行期读 _extensionRunner），
 * agent-loop 每次执行工具前调的正是它 —— 所以这条链与真实调用只差「参数是
 * 脚本给的而不是模型给的」。
 *
 * **本脚本不能证明的事**（必须写在头上，免得被当成全覆盖）：
 *   - 真实模型会不会发起工具调用 —— 由 npm run smoke:session 与真机验证覆盖；
 *   - daemon 的 IPC 审批弹窗 —— requestApproval 在这里是脚本桩；
 *   - OS 级沙箱 —— 我们没有（partial enforcement，见 shared/permissions.ts）。
 *
 * **不消耗模型额度、不产生网络请求**：假服务商指 127.0.0.1:9（保留端口，
 * 必然拒连），只建会话、不 prompt。所有路径都在临时目录下，结束即清理。
 *
 * 用法：npm run smoke:permission
 */

import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { PermissionRequest, PermissionResponse } from "../src/shared/ipc.ts";
import type { PermissionSettings } from "../src/shared/permissions.ts";

export {};

// 必须在导入我们的模块之前设好：配置路径由 env 决定，
// 用临时目录避免碰用户真实的 ~/.kamibuddy（同 smoke-session 的构造模式）。
const workDir = mkdtempSync(join(tmpdir(), "kami-perm-gate-"));
process.env["KAMIBUDDY_CONFIG_DIR"] = join(workDir, "config");
process.env["KAMIBUDDY_WORKSPACE_DIR"] = join(workDir, "workspace");

const { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } = await import(
	"@earendil-works/pi-coding-agent"
);
const { ModelCatalog } = await import("../src/core/model-catalog.ts");
const { getConfigDir, getSessionsDir, getWorkspaceDir } = await import("../src/core/config-paths.ts");
const { createPermissionGate } = await import("../src/extensions/permission-gate.ts");
const { defaultProtectedDirs } = await import("../src/extensions/permission-policy.ts");
const { DEFAULT_PERMISSIONS } = await import("../src/shared/permissions.ts");

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail: string): void {
	results.push({ name, ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

/* ── 路径三方：工作区 / 配置目录 / 模拟应用目录 ──────────────────── */

const configDir = getConfigDir();
const workspaceDir = getWorkspaceDir();
// 模拟的「KamiBuddy 自身目录」：dev 是项目根、打包后是安装目录（daemon 用
// process.cwd()），这里用一个独立的临时目录即可 —— 判定只看路径归属。
const appDir = join(workDir, "fake-app");
// 工作区外、又不是凭据/配置/应用目录的普通目录：区外询问的靶子。
const outsideDir = join(workDir, "outside");
mkdirSync(workspaceDir, { recursive: true });
mkdirSync(appDir, { recursive: true });
mkdirSync(outsideDir, { recursive: true });

const sshKeyPath = join(homedir(), ".ssh", "id_rsa");

/* ── 审批桩：记录每次请求，按当前应答器回复 ──────────────────────── */

type ApprovalRequest = Omit<PermissionRequest, "id" | "sessionId">;
const approvalLog: ApprovalRequest[] = [];
// 默认应答是拒绝 —— fail-closed：脚本里忘了设置应答器时，任何询问都表现为拒绝，
// 绝不会因为桩的默认值把一次该拦的调用放过去。
let respond: (request: ApprovalRequest) => PermissionResponse = () => ({ id: "stub", decision: "deny" });

// getSettings 用可变变量：验证「下一次工具调用就生效」的 getter 语义
// （permission-gate.ts 头注释），也覆盖档位切换场景。
let settings: PermissionSettings = DEFAULT_PERMISSIONS;

/* ── 假服务商：换一个真实 Model 对象，但不发任何请求 ─────────────── */

const catalog = await ModelCatalog.create();
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
const model = catalog.resolveModel(MODEL_KEY);
if (model === undefined) throw new Error(`假服务商模型解析失败：${MODEL_KEY}`);

/* ── 建真实会话（资源组装照抄 session-host.create 的做法）────────── */

const settingsManager = SettingsManager.create(workspaceDir, configDir);
const resourceLoader = new DefaultResourceLoader({
	cwd: workspaceDir,
	agentDir: configDir,
	settingsManager,
	extensionFactories: [
		createPermissionGate({
			paths: {
				workspaceDir,
				configDir,
				protectedDirs: defaultProtectedDirs(homedir()),
				appDir,
			},
			cwd: workspaceDir,
			getSettings: () => settings,
			requestApproval: async (request) => {
				approvalLog.push(request);
				return respond(request);
			},
		}),
	],
});
await resourceLoader.reload();

const { session } = await createAgentSession({
	cwd: workspaceDir,
	agentDir: configDir,
	modelRuntime: catalog.modelRuntime,
	model,
	sessionManager: SessionManager.create(workspaceDir, getSessionsDir()),
	settingsManager,
	resourceLoader,
	tools: ["read", "write", "edit", "find", "grep", "ls"],
});

/* ── 触发器：走 agent.beforeToolCall 这条真实入口 ────────────────── */

type BeforeToolCallHook = NonNullable<AgentSession["agent"]["beforeToolCall"]>;
type HookContext = Parameters<BeforeToolCallHook>[0];
type HookVerdict = Awaited<ReturnType<BeforeToolCallHook>>;

const beforeToolCall = session.agent.beforeToolCall;
check(
	"真实会话建立且 beforeToolCall 钩子已安装",
	beforeToolCall !== undefined,
	beforeToolCall !== undefined
		? "session.agent.beforeToolCall 存在（_installAgentToolHooks 已在构造时执行）"
		: "session.agent.beforeToolCall 为空 —— pi 的钩子安装时机变了，整条链失效",
);
if (beforeToolCall === undefined) {
	finish();
}
// 单独落一个非空别名：fire 是函数声明（提升），TS 不会把上面的窄化带进它的闭包。
const hook: BeforeToolCallHook = beforeToolCall;

let callSeq = 0;
async function fire(toolName: string, input: Record<string, unknown>): Promise<HookVerdict | undefined> {
	callSeq += 1;
	const toolCall: HookContext["toolCall"] = {
		type: "toolCall",
		id: `smoke-${callSeq}`,
		name: toolName,
		arguments: input,
	};
	/*
	 * 双重断言是有意收窄：pi 安装的钩子只解构 { toolCall, args }
	 * （agent-session.js 的 _installAgentToolHooks），context / assistantMessage
	 * 是给真实 agent-loop 用的，脚本伪造它们只会假装测了更多。
	 */
	return hook({ toolCall, args: input } as unknown as HookContext);
}

/** 断言一次触发的结果，返回判定值供进一步检查。 */
function evidence(verdict: HookVerdict | undefined): string {
	return verdict === undefined
		? "放行（beforeToolCall 返回 undefined）"
		: `拦截（block=${String(verdict.block)}，reason=${verdict.reason ?? "(无)"}）`;
}

/* ── 断言序列 ────────────────────────────────────────────────────── */

// 1. 区外 edit（默认档）：询问 medium → 拒绝 → 拦截
let before = approvalLog.length;
let verdict = await fire("edit", { path: join(outsideDir, "a.txt"), edits: [] });
let ask = approvalLog.at(-1);
check(
	"区外 edit（默认档）：询问 medium，拒绝后拦截",
	approvalLog.length === before + 1 && ask?.risk === "medium" && verdict?.block === true,
	`新增询问 ${approvalLog.length - before} 次，risk=${ask?.risk ?? "(无)"}；${evidence(verdict)}`,
);

// 2. 区内 edit：直接放行，不询问
before = approvalLog.length;
verdict = await fire("edit", { path: join(workspaceDir, "doc.md"), edits: [] });
check(
	"区内 edit：放行且未询问",
	approvalLog.length === before && verdict === undefined,
	`新增询问 ${approvalLog.length - before} 次；${evidence(verdict)}`,
);

// 3. 区外 read（默认档）：询问 low → 允许（记住）→ 放行
respond = () => ({ id: "stub", decision: "allow", remember: true });
before = approvalLog.length;
verdict = await fire("read", { path: join(outsideDir, "a.txt") });
ask = approvalLog.at(-1);
check(
	"区外 read（默认档）：询问 low，允许后放行",
	approvalLog.length === before + 1 && ask?.risk === "low" && verdict === undefined,
	`新增询问 ${approvalLog.length - before} 次，risk=${ask?.risk ?? "(无)"}；${evidence(verdict)}`,
);

// 4. 同目录再读（换一个文件名）：「记住」按目录生效，不再询问
before = approvalLog.length;
verdict = await fire("read", { path: join(outsideDir, "b.txt") });
check(
	"区外 read（同目录第二次）：记住生效，未再询问",
	approvalLog.length === before && verdict === undefined,
	`新增询问 ${approvalLog.length - before} 次；${evidence(verdict)}`,
);

// 5. 读 ~/.ssh/id_rsa：凭据目录不经审批直接拦（哪怕脚本应答器现在是 allow）
before = approvalLog.length;
verdict = await fire("read", { path: sshKeyPath });
check(
	"读 ~/.ssh/id_rsa：不经审批直接拦截",
	approvalLog.length === before && verdict?.block === true,
	`新增询问 ${approvalLog.length - before} 次；${evidence(verdict)}`,
);

// 6. appDir 内 edit：高风险询问；即使应答 remember:true 也不记住（双保险）
before = approvalLog.length;
verdict = await fire("edit", { path: join(appDir, "index.ts"), edits: [] });
ask = approvalLog.at(-1);
check(
	"应用目录内 edit：询问 high，允许后放行",
	approvalLog.length === before + 1 && ask?.risk === "high" && verdict === undefined,
	`新增询问 ${approvalLog.length - before} 次，risk=${ask?.risk ?? "(无)"}；${evidence(verdict)}`,
);

// 7. 紧接着第二次 appDir edit：证明 high 风险的 remember:true 被 gate 拒收
before = approvalLog.length;
verdict = await fire("edit", { path: join(appDir, "index.ts"), edits: [] });
ask = approvalLog.at(-1);
check(
	"应用目录内 edit（第二次）：高风险不记住，再次询问",
	approvalLog.length === before + 1 && ask?.risk === "high" && verdict === undefined,
	`新增询问 ${approvalLog.length - before} 次，risk=${ask?.risk ?? "(无)"}；${evidence(verdict)}`,
);

// 8. 切 danger-full-access：区外 edit 直接放行（getter 语义：下一次调用即生效）
settings = { sandbox: "danger-full-access", approval: "never", presetId: "full" };
respond = () => ({ id: "stub", decision: "deny" });
before = approvalLog.length;
verdict = await fire("edit", { path: join(outsideDir, "c.txt"), edits: [] });
check(
	"danger-full-access：区外 edit 放行且未询问",
	approvalLog.length === before && verdict === undefined,
	`新增询问 ${approvalLog.length - before} 次；${evidence(verdict)}`,
);

// 9. danger-full-access 下读 .ssh：受保护目录任何模式都不能越过
before = approvalLog.length;
verdict = await fire("read", { path: sshKeyPath });
check(
	"danger-full-access：读 ~/.ssh/id_rsa 仍直接拦截",
	approvalLog.length === before && verdict?.block === true,
	`新增询问 ${approvalLog.length - before} 次；${evidence(verdict)}`,
);

/* ── 汇总 ────────────────────────────────────────────────────────── */

finish();

function finish(): never {
	session.dispose();
	rmSync(workDir, { recursive: true, force: true });

	const failed = results.filter((r) => !r.ok);
	console.log(`\n${results.length - failed.length}/${results.length} 通过`);
	if (failed.length > 0) {
		console.log("失败项：");
		for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
		process.exitCode = 1;
	}
	process.exit(process.exitCode ?? 0);
}
