/**
 * 沙箱执行策略的测试：档位映射、降级纪律、诊断去重、按目录记忆。
 *
 * 为什么必须测这一层：它决定「什么时候在**没有**操作系统写入约束的情况下
 * 执行命令」—— 本期最该被守住的判断。真实探测在 Windows 上会成功，
 * 所以降级分支在开发机上永远走不到；沙箱门面做成可注入就是为了这个
 * （与 documents/docx-env.ts 的注入 spawn 同一范式）。
 *
 * 全部注入假门面，不碰真 FFI，所以任何平台都能跑。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
	CommandBlocked,
	CommandOutcome,
	CommandRunResult,
} from "../extensions/powershell-tool.ts";
import type { PermissionSettings, SandboxMode } from "../shared/permissions.ts";
import { SandboxPrepareFailure, type SandboxRunRequest } from "../sandbox/index.ts";
import {
	createSandboxedRunner,
	resetSandboxRunnerForTest,
	warmUpSandbox,
	type SandboxDiagnostics,
	type SandboxFacade,
} from "./sandbox-runner.ts";

const WORKSPACE = "C:\\Users\\foo\\KamiBuddy";

function settings(sandbox: SandboxMode): PermissionSettings {
	return { sandbox, approval: "ask" };
}

/** 成功的执行结果（形状与真实 CommandOutcome 一致）。 */
function ok(stdout: string): CommandOutcome {
	return { stdout, stderr: "", exitCode: 0, timedOut: false, aborted: false };
}

/**
 * 断言这次调用**真的执行了命令**，并把联合类型收窄成执行结果。
 *
 * 执行器的返回是「跑过了」与「被拦下」的联合（提权被拒时命令一行都不跑）。
 * 用这个辅助而不是类型断言：它顺带把「本用例预期命令确实跑了」这个前提
 * 变成一句会失败的断言 —— 若将来某条路径意外变成「拦下」，
 * 报错会指出被拦的原因，而不是在某个属性上得到 undefined。
 */
function ran(result: CommandRunResult): CommandOutcome & { readonly note?: string } {
	if ("blocked" in result) {
		throw new Error(`预期命令被执行，实际被拦下（${result.category}）：${result.reason}`);
	}
	return result;
}

/** 反过来：断言这次调用**被拦下**（命令未执行）。 */
function wasBlocked(result: CommandRunResult): CommandBlocked {
	if (!("blocked" in result)) {
		throw new Error(`预期命令被拦下，实际执行了：exitCode=${String(result.exitCode)}`);
	}
	return result;
}

interface Recorded {
	readonly fallbackCalls: string[];
	readonly sandboxCalls: string[];
	readonly prepareCalls: string[];
	readonly probeCalls: string[];
	readonly diagnostics: SandboxDiagnostics[];
}

/** 装一套可观测的假件。默认一切正常、沙箱可用。 */
function harness(
	overrides: {
		readonly probe?: SandboxFacade["probe"];
		readonly prepare?: SandboxFacade["prepare"];
		readonly run?: SandboxFacade["run"];
	} = {},
): {
	readonly recorded: Recorded;
	readonly facade: SandboxFacade;
	readonly fallback: (command: string, timeoutSeconds: number) => Promise<CommandOutcome>;
	readonly onDiagnostics: (d: SandboxDiagnostics) => void;
} {
	const recorded: Recorded = {
		fallbackCalls: [],
		sandboxCalls: [],
		prepareCalls: [],
		probeCalls: [],
		diagnostics: [],
	};
	const facade: SandboxFacade = {
		probe:
			overrides.probe ??
			(async (dir: string) => {
				recorded.probeCalls.push(dir);
				return { available: true } as const;
			}),
		prepare:
			overrides.prepare ??
			(async (request: { readonly workspaceDir: string }) => {
				recorded.prepareCalls.push(request.workspaceDir);
				return { fastPath: false, elapsedMs: 1 };
			}),
		run:
			overrides.run ??
			(async (request: { readonly args: readonly string[] }) => {
				const command = request.args[request.args.length - 1] ?? "";
				recorded.sandboxCalls.push(command);
				return { ...ok("sandboxed"), exitCode: 0 };
			}),
	};
	return {
		recorded,
		facade,
		fallback: async (command) => {
			recorded.fallbackCalls.push(command);
			return ok("fallback");
		},
		onDiagnostics: (d) => recorded.diagnostics.push(d),
	};
}

beforeEach(() => {
	// 按目录的授权记忆是模块级的（进程级事实），用例之间必须清掉。
	resetSandboxRunnerForTest();
});

describe("档位映射", () => {
	it("workspace-write 进沙箱", async () => {
		const h = harness();
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		const outcome = ran(await run("echo hi", 120));
		expect(h.recorded.sandboxCalls).toEqual(["echo hi"]);
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(outcome.stdout).toBe("sandboxed");
		// 沙箱生效时不该有任何「未生效」的说明
		expect(outcome.note).toBeUndefined();
	});

	it("danger-full-access 不进沙箱，且**不加**降级说明", async () => {
		// 该预设的文案是「不限制文件范围」。加沙箱是文案说谎；
		// 加「沙箱未生效」的警告则是把用户自己的选择说成故障。
		const h = harness();
		const run = createSandboxedRunner({
			getSettings: () => settings("danger-full-access"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		const outcome = ran(await run("echo hi", 120));
		expect(h.recorded.fallbackCalls).toEqual(["echo hi"]);
		expect(h.recorded.sandboxCalls).toEqual([]);
		expect(outcome.note).toBeUndefined();
		// 不该白跑一次探测
		expect(h.recorded.probeCalls).toEqual([]);
	});

	it("read-only 进**只读沙箱**跑（四期翻转；旧代码对它是无沙箱全权限跑）", async () => {
		/*
		 * 旧分支 `mode !== workspace-write → fallback` 对 read-only 意味着
		 * 无沙箱全权限执行 —— 此前靠权限门在阶段 3 全拒 shell 掩盖着。
		 * 门放行只读沙箱执行后，这里必须进沙箱（mode: "read-only"，
		 * 受限列表无任何写能力），且**不 prepare**（只读不需要 ACE）。
		 */
		const h = harness();
		const run = createSandboxedRunner({
			getSettings: () => settings("read-only"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		await run("echo hi", 120);
		expect(h.recorded.sandboxCalls).toEqual(["echo hi"]);
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(h.recorded.prepareCalls).toEqual([]); // 只读不需要授权
	});

	it("档位是每次调用读的，改档后立即生效", async () => {
		const h = harness();
		let mode: SandboxMode = "workspace-write";
		const run = createSandboxedRunner({
			getSettings: () => settings(mode),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		await run("first", 120);
		mode = "danger-full-access";
		await run("second", 120);
		expect(h.recorded.sandboxCalls).toEqual(["first"]);
		expect(h.recorded.fallbackCalls).toEqual(["second"]);
	});

	/*
	 * 下面两条钉的是**中断信号在这两档各自的去处**。
	 *
	 * 2026-09-17 pip 现场：用户按了三次停止都停不下来，python 继续烧 CPU、
	 * 卡片永远停在「执行中」。工具层把 signal 收下了，但这一层没往执行器传 ——
	 * 而 signal 只有执行器能兑现（沙箱里是关 Job 句柄，直连是 taskkill /T）。
	 */
	it("**workspace-write：中断信号透传到沙箱执行器**，且中断不算沙箱故障", async () => {
		const seen: Array<AbortSignal | undefined> = [];
		const h = harness({
			run: async (request: { readonly signal?: AbortSignal }) => {
				seen.push(request.signal);
				return { stdout: "", stderr: "", exitCode: null, timedOut: false, aborted: true };
			},
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		const controller = new AbortController();
		const outcome = ran(await run("Start-Sleep 999", 120, undefined, undefined, controller.signal));

		expect(seen).toEqual([controller.signal]);
		// 中断照实回传：既不当成沙箱故障去拒绝，也不降级重跑
		//（那会把用户的「停止」变成「再跑一遍」）。
		expect(outcome.aborted).toBe(true);
		expect(h.recorded.fallbackCalls).toEqual([]);
	});

	it("danger-full-access：中断信号同样传给直连执行器", async () => {
		// 这条路没有沙箱，但 powershell 一样会挂 —— 不传信号就是同一个 bug。
		const seen: Array<AbortSignal | undefined> = [];
		const h = harness();
		const run = createSandboxedRunner({
			getSettings: () => settings("danger-full-access"),
			workspaceDir: WORKSPACE,
			fallback: async (command, _timeoutSeconds, _onProgress, _escalation, signal) => {
				seen.push(signal);
				return ok(command);
			},
			sandbox: h.facade,
		});
		const controller = new AbortController();
		await run("echo hi", 120, undefined, undefined, controller.signal);

		expect(seen).toEqual([controller.signal]);
	});
});

/*
 * 运行时注入补丁**接进执行路径**（spec: add-managed-runtimes 的 SubTask 2.1.3）。
 *
 * 这一段钉的是「注入层被真的用上了」：补丁从 `runtimeEnv` getter 现算，喂给
 * 两条 spawn 路径（沙箱 / 降级直连），且**只**进子进程 —— 不回写 daemon 自己
 * 的 `process.env`。改坏这里（例如只喂沙箱、或忘传 fallback 的第 6 参）
 * 就等于「设了开关，模型 shell 里照样找不到随包 node」，而那是没有任何症状的坏。
 */
describe("运行时注入补丁进执行路径（SubTask 2.1.3）", () => {
	/** 一份典型的补丁：PATH 前缀 + 两个 KAMIBUDDY 变量。 */
	const PATCH: Readonly<Record<string, string>> = {
		Path: "C:\\cfg\\runtimes\\node\\22;C:\\Windows\\System32",
		KAMIBUDDY_NODE_HOME: "C:\\cfg\\runtimes\\node\\22",
		KAMIBUDDY_RUNTIMES_DIR: "C:\\cfg\\runtimes",
	};

	it("workspace-write：补丁进沙箱子进程的环境请求，且**不回写** daemon 的 process.env", async () => {
		const seen: Array<Readonly<Record<string, string>> | undefined> = [];
		const h = harness({
			run: async (request: SandboxRunRequest) => {
				seen.push(request.env);
				return ok("sandboxed");
			},
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			runtimeEnv: () => PATCH,
		});
		ran(await run("node --version", 120));

		expect(seen).toEqual([PATCH]);
		// 补丁只跟着子进程走：本进程环境一个键都不许多（回写会连带改掉
		// 我们自己的受控转换链路，见 core/runtimes/injection.ts 文件头）。
		expect(process.env["KAMIBUDDY_NODE_HOME"]).toBeUndefined();
		expect(process.env["KAMIBUDDY_RUNTIMES_DIR"]).toBeUndefined();
	});

	it("read-only：补丁同样进只读沙箱（注入不该只在写档生效）", async () => {
		const seen: Array<Readonly<Record<string, string>> | undefined> = [];
		const h = harness({
			run: async (request: SandboxRunRequest) => {
				seen.push(request.env);
				return ok("sandboxed");
			},
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("read-only"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			runtimeEnv: () => PATCH,
		});
		ran(await run("node --version", 120));

		expect(seen).toEqual([PATCH]);
	});

	it("danger-full-access：补丁经降级直连 spawn 的第 6 参传下去", async () => {
		const seen: Array<Readonly<Record<string, string>> | undefined> = [];
		const h = harness();
		const run = createSandboxedRunner({
			getSettings: () => settings("danger-full-access"),
			workspaceDir: WORKSPACE,
			fallback: async (command, _timeoutSeconds, _onProgress, _escalation, _signal, env) => {
				seen.push(env);
				return ok(command);
			},
			sandbox: h.facade,
			runtimeEnv: () => PATCH,
		});
		ran(await run("node --version", 120));

		expect(seen).toEqual([PATCH]);
		// 这条路根本不探测沙箱（与档位映射那组一致），但环境补丁一样要给。
		expect(h.recorded.probeCalls).toEqual([]);
	});

	it("每次执行现算：getter 返回新补丁时下一次命令即生效（改开关无需重启）", async () => {
		let patch: Readonly<Record<string, string>> = PATCH;
		const seen: Array<Readonly<Record<string, string>> | undefined> = [];
		const h = harness({
			run: async (request: SandboxRunRequest) => {
				seen.push(request.env);
				return ok("sandboxed");
			},
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			runtimeEnv: () => patch,
		});
		ran(await run("first", 120));
		patch = {};
		ran(await run("second", 120));

		expect(seen).toEqual([PATCH, {}]);
	});

	it("没有 provider（未接线）⇒ 两条路径都不带 env（行为与接线前逐字节相同）", async () => {
		const sandboxRequests: SandboxRunRequest[] = [];
		const h = harness({
			run: async (request: SandboxRunRequest) => {
				sandboxRequests.push(request);
				return ok("sandboxed");
			},
		});
		const fallbackEnvs: Array<Readonly<Record<string, string>> | undefined> = [];
		const run = createSandboxedRunner({
			getSettings: () => settings("danger-full-access"),
			workspaceDir: WORKSPACE,
			fallback: async (command, _timeoutSeconds, _onProgress, _escalation, _signal, env) => {
				fallbackEnvs.push(env);
				return ok(command);
			},
			sandbox: h.facade,
		});
		ran(await run("echo hi", 120));

		expect(fallbackEnvs).toEqual([undefined]);
		// 沙箱那一侧的请求形状不变：连 env 这个键都不出现（于是环境块逐字节相同）。
		const writeRun = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		ran(await writeRun("echo hi", 120));
		expect(sandboxRequests).toHaveLength(1);
		expect(sandboxRequests[0] !== undefined && "env" in sandboxRequests[0]).toBe(false);
	});
});

describe("沙箱不可用 → fail-closed 拒绝（对齐 dsh SANDBOX_UNAVAILABLE）", () => {
	/*
	 * 四期对齐后不存在「降级到无约束跑」：read-only / workspace-write 档下
	 * 探测、授权、令牌、spawn 任何一环失败都拒绝执行，把原因回给模型。
	 * 官方出路与 dsh 相同：切 danger-full-access。
	 */
	it("探测报不可用 → **拒绝执行**，绝不 fallback", async () => {
		const h = harness({
			probe: async () => ({ available: false, reason: "not-windows", detail: "linux" }) as const,
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			onDiagnostics: h.onDiagnostics,
		});
		const result = wasBlocked(await run("echo hi", 120));
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(result.category).toBe("sandbox-unavailable");
		expect(result.reason).toContain("拒绝本次执行");
		// 出路与 dsh 官方文案一致：切完全访问档
		expect(result.reason).toContain("允许完全访问");
		expect(h.recorded.diagnostics[0]).toMatchObject({ available: false, reason: "not-windows" });
	});

	it("探测抛错 → 拒绝执行", async () => {
		const h = harness({
			probe: async () => {
				throw new Error("koffi 没装");
			},
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			onDiagnostics: h.onDiagnostics,
		});
		wasBlocked(await run("echo hi", 120));
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(h.recorded.diagnostics[0]).toMatchObject({ available: false, reason: "ffi-load-failed" });
	});

	it("授权失败 → 拒绝执行（未授权的沙箱会把区内写入也拒掉，无约束跑则写约束消失）", async () => {
		const h = harness({
			prepare: async () => {
				throw new Error("SetNamedSecurityInfoW 失败（Win32 5）");
			},
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			onDiagnostics: h.onDiagnostics,
		});
		wasBlocked(await run("echo hi", 120));
		expect(h.recorded.sandboxCalls).toEqual([]);
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(h.recorded.diagnostics[0]).toMatchObject({ reason: "acl-grant-failed" });
	});

	it("沙箱装配失败（令牌/spawn）→ 拒绝执行", async () => {
		const h = harness({
			run: async () => {
				throw new Error("CreateRestrictedToken 失败（Win32 1314）");
			},
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			onDiagnostics: h.onDiagnostics,
		});
		wasBlocked(await run("echo hi", 120));
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(h.recorded.diagnostics[0]).toMatchObject({ reason: "token-creation-failed" });
	});

	it("授权在 worker 里失败：原因原样上报，不被兜底值吞掉", async () => {
		/*
		 * 授权搬进 worker_thread 之后，失败原因只能在 worker 侧分类
		 * （异常跨不了线程），主线程用 SandboxPrepareFailure 把它还原回来。
		 * 这条测试钉住那个还原：reason 必须原样出去，且拒绝文案要说「授权组件」，
		 * 不能让用户看到「受限令牌创建失败」这种指错方向的兜底文案。
		 */
		const h = harness({
			prepare: async () => {
				throw new SandboxPrepareFailure(
					"prepare-worker-failed",
					"授权 worker 未给出结果就退出（exit 1）",
				);
			},
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			onDiagnostics: h.onDiagnostics,
		});
		const outcome = await run("echo hi", 120);
		const blocked = wasBlocked(outcome);
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(h.recorded.diagnostics[0]).toMatchObject({ reason: "prepare-worker-failed" });
		expect(blocked.reason).toContain("授权组件未能启动");
	});

	it("read-only 档下沙箱不可用同样拒绝（不假装只读）", async () => {
		const h = harness({
			run: async () => {
				throw new Error("spawn 失败");
			},
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("read-only"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		wasBlocked(await run("echo hi", 120));
		expect(h.recorded.fallbackCalls).toEqual([]);
	});

	it("**命令自身失败不拒绝**——那是真实结果，不是沙箱故障", async () => {
		/*
		 * 这是本层最关键的一条区分。命令被操作系统拒绝写入时会以「非零退出码」
		 * 的形式正常返回；拒绝它就等于把真实结果吞掉。
		 */
		const h = harness({
			run: async () => ({
				stdout: "",
				stderr: "拒绝访问。",
				exitCode: 1,
				timedOut: false,
				aborted: false,
			}),
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			onDiagnostics: h.onDiagnostics,
		});
		const outcome = ran(await run("Set-Content C:\\Windows\\x.txt", 120));
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(outcome.exitCode).toBe(1);
		expect(outcome.stderr).toContain("拒绝访问");
		expect(h.recorded.diagnostics.at(-1)).toMatchObject({ available: true });
	});

	it("超时也不拒绝（真实结果）", async () => {
		const h = harness({
			run: async () => ({
				stdout: "",
				stderr: "",
				exitCode: null,
				timedOut: true,
				aborted: false,
			}),
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		const outcome = ran(await run("Start-Sleep 999", 1));
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(outcome.timedOut).toBe(true);
		expect(outcome.exitCode).toBeNull();
	});
});

describe("诊断去重", () => {
	it("同一结论只报一次", async () => {
		const h = harness();
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			onDiagnostics: h.onDiagnostics,
		});
		await run("a", 120);
		await run("b", 120);
		await run("c", 120);
		expect(h.recorded.diagnostics).toHaveLength(1);
		expect(h.recorded.diagnostics[0]).toMatchObject({ available: true });
	});

	it("结论变化时重新上报", async () => {
		let available = true;
		const h = harness({
			probe: async () =>
				available
					? ({ available: true } as const)
					: ({ available: false, reason: "acl-grant-failed", detail: "x" } as const),
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			onDiagnostics: h.onDiagnostics,
		});
		await run("a", 120);
		available = false;
		await run("b", 120);
		expect(h.recorded.diagnostics).toHaveLength(2);
		expect(h.recorded.diagnostics[1]).toMatchObject({ available: false });
	});
});

describe("按目录记忆授权", () => {
	it("同一目录只授权一次（ACE 常驻，幂等只要 1ms）", async () => {
		const h = harness();
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		await run("a", 120);
		await run("b", 120);
		expect(h.recorded.prepareCalls).toEqual([WORKSPACE]);
	});

	it("并发首批调用共用同一次在途授权", async () => {
		let resolvePrepare: (() => void) | undefined;
		const h = harness({
			prepare: async (request: { readonly workspaceDir: string }) => {
				await new Promise<void>((resolve) => {
					resolvePrepare = resolve;
				});
				return { fastPath: false, elapsedMs: 1 };
			},
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		const both = Promise.all([run("a", 120), run("b", 120)]);
		// 等两个调用都进到 await prepare
		await new Promise((resolve) => setTimeout(resolve, 5));
		resolvePrepare?.();
		await both;
		expect(h.recorded.sandboxCalls).toHaveLength(2);
	});

	it("授权失败被记住，不每条命令重试一遍（失败仍是拒绝，只是不重复授权）", async () => {
		let calls = 0;
		const h = harness({
			prepare: async () => {
				calls += 1;
				throw new Error("SetEntriesInAclW 失败");
			},
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		wasBlocked(await run("a", 120));
		wasBlocked(await run("b", 120));
		expect(calls).toBe(1);
		expect(h.recorded.fallbackCalls).toEqual([]);
	});
});

describe("等待提示（授权慢才出声）", () => {
	// 门槛是 1 秒，用假时钟推进而不是真等 —— 否则每条用例都要拖一秒。
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("授权很快时**不**发提示（幂等命中是常态，不该有噪音）", async () => {
		const h = harness(); // 缺省 prepare 立刻 resolve
		const notices: string[] = [];
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		await run("echo hi", 120, (text) => notices.push(text));
		// 推过门槛，确认定时器确实被 clearTimeout 掉了（否则这里会补发一条）
		await vi.advanceTimersByTimeAsync(5_000);
		expect(notices).toEqual([]);
	});

	it("授权超过门槛时发一次提示，且只发一次", async () => {
		let resolvePrepare: (() => void) | undefined;
		const h = harness({
			prepare: async () => {
				await new Promise<void>((resolve) => {
					resolvePrepare = resolve;
				});
				return { fastPath: false, elapsedMs: 2_000 };
			},
		});
		const notices: string[] = [];
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		const pending = run("echo hi", 120, (text) => notices.push(text));

		await vi.advanceTimersByTimeAsync(1_200);
		expect(notices).toHaveLength(1);
		// 文案要说清「在做什么 + 为什么慢 + 会不会一直这样」，只说「请稍候」等于没说
		expect(notices[0]).toContain("写入约束");
		expect(notices[0]).toContain("首次较慢");

		resolvePrepare?.();
		await pending;
		// 再推也不该补发第二条
		await vi.advanceTimersByTimeAsync(5_000);
		expect(notices).toHaveLength(1);
	});

	it("授权很快失败时不发提示（用户没在等）", async () => {
		const h = harness({
			prepare: async () => {
				throw new Error("SetEntriesInAclW 失败");
			},
		});
		const notices: string[] = [];
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		wasBlocked(await run("echo hi", 120, (text) => notices.push(text)));
		await vi.advanceTimersByTimeAsync(5_000);

		// 失败很快发生：用户没在等，不出声；命令被拒绝（不再无约束跑）
		expect(notices).toEqual([]);
	});

	it("授权慢且失败时：提示已发，但不留悬挂定时器", async () => {
		/*
		 * 直接断言 vi.getTimerCount() —— 这正是 awaitWithNotice 的 finally
		 * 所声称的不变式（成功与失败两条路都不留定时器）。
		 * 比「观察有没有补发第二条提示」更贴近实现契约。
		 *
		 * 注意 reject 必须放在 advanceTimersByTimeAsync 之后：run() 内部先
		 * await probe 才会调 prepare，同步调用 rejectPrepare 时它还没赋值，
		 * 可选调用会静默失败并让 await 永久挂起（写这条时踩过）。
		 */
		let rejectPrepare: ((error: Error) => void) | undefined;
		const h = harness({
			prepare: () =>
				new Promise<never>((_resolve, reject) => {
					rejectPrepare = reject;
				}),
		});
		const notices: string[] = [];
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		const pending = run("echo hi", 120, (text) => notices.push(text));

		// 推过门槛：这同时也让 prepare 真正被调用（微任务被刷）
		await vi.advanceTimersByTimeAsync(1_200);
		expect(notices).toHaveLength(1);

		rejectPrepare?.(new Error("SetEntriesInAclW 失败"));
		wasBlocked(await pending);

		// 提示已发过（用户等了），失败后不留悬挂定时器；命令被拒绝
		expect(vi.getTimerCount()).toBe(0);
	});

	it("不传 onProgress 时正常工作（连定时器都不建）", async () => {
		const h = harness();
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		const outcome = ran(await run("echo hi", 120));
		expect(outcome.stdout).toBe("sandboxed");
	});

	it("已授权过的目录不再提示（第二条命令直接跑）", async () => {
		const h = harness();
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		await run("first", 120);
		const notices: string[] = [];
		await run("second", 120, (text) => notices.push(text));
		await vi.advanceTimersByTimeAsync(5_000);
		expect(notices).toEqual([]);
	});
});

describe("提权申请", () => {
	/** 装一个记录调用的审批器。 */
	function approver(answer: boolean): {
		readonly ask: NonNullable<Parameters<typeof createSandboxedRunner>[0]["requestEscalation"]>;
		readonly asked: { toMode: string; justification: string; command: string }[];
	} {
		const asked: { toMode: string; justification: string; command: string }[] = [];
		return {
			asked,
			ask: async (request) => {
				asked.push({ ...request });
				return answer;
			},
		};
	}

	it("用户批准 → 这一次不进沙箱，且如实说明只此一次", async () => {
		const h = harness();
		const a = approver(true);
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			requestEscalation: a.ask,
		});
		const outcome = ran(
			await run("Set-Content D:\\out\\x.txt", 120, undefined, {
				toMode: "danger-full-access",
				justification: "用户要求把报告导出到 D 盘交付目录",
			}),
		);
		expect(h.recorded.sandboxCalls).toEqual([]);
		expect(h.recorded.fallbackCalls).toEqual(["Set-Content D:\\out\\x.txt"]);
		expect(outcome.note).toContain("已批准本次提权");
		expect(outcome.note).toContain("只对本次调用有效");
		// 审批弹窗必须拿到命令原文与理由 —— 用户得看见自己在给什么放行。
		expect(a.asked).toEqual([
			{
				toMode: "danger-full-access",
				justification: "用户要求把报告导出到 D 盘交付目录",
				command: "Set-Content D:\\out\\x.txt",
			},
		]);
	});

	it("用户拒绝 → 命令**一行都不跑**", async () => {
		const h = harness();
		const a = approver(false);
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			requestEscalation: a.ask,
		});
		const result = wasBlocked(
			await run("Set-Content D:\\x.txt", 120, undefined, {
				toMode: "danger-full-access",
				justification: "需要写 D 盘",
			}),
		);
		/*
		 * 关键：既不能进沙箱，也不能走 fallback。若这里合成一个「退出码 1」
		 * 返回，模型会去调试自己的命令 —— 而真正的原因是用户没批准。
		 */
		expect(h.recorded.sandboxCalls).toEqual([]);
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(result.category).toBe("escalation-denied");
		expect(result.reason).toContain("用户拒绝");
	});

	it("不严格变宽的申请直接拒，**不惊动用户**", async () => {
		/*
		 * 为什么「不弹窗」本身是要求：否则模型可以靠刷不合法的申请来骚扰用户，
		 * 直到对方随手点了允许。合法性检查必须在弹窗之前。
		 */
		const h = harness();
		const a = approver(true);
		const run = createSandboxedRunner({
			getSettings: () => settings("danger-full-access"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			requestEscalation: a.ask,
		});
		const result = wasBlocked(
			await run("whatever", 120, undefined, {
				toMode: "workspace-write",
				justification: "想要更窄的档位",
			}),
		);
		expect(a.asked).toEqual([]);
		expect(result.reason).toContain("严格变宽");
		expect(h.recorded.fallbackCalls).toEqual([]);
	});

	it("没有审批通道 → 拒（没人能批准时「批准」不能凭空发生）", async () => {
		const h = harness();
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			// 不传 requestEscalation —— 子代理今天就是这个形态
		});
		const result = wasBlocked(
			await run("Set-Content D:\\x.txt", 120, undefined, {
				toMode: "danger-full-access",
				justification: "需要写 D 盘",
			}),
		);
		expect(result.reason).toContain("没有可用的审批通道");
		expect(h.recorded.fallbackCalls).toEqual([]);
	});

	it("审批策略为「不询问」→ 拒，且不弹窗（无人值守下「不问」= 「不做」）", async () => {
		const h = harness();
		const a = approver(true);
		const run = createSandboxedRunner({
			getSettings: () => ({ sandbox: "workspace-write", approval: "never" }),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			requestEscalation: a.ask,
		});
		const result = wasBlocked(
			await run("Set-Content D:\\x.txt", 120, undefined, {
				toMode: "danger-full-access",
				justification: "需要写 D 盘",
			}),
		);
		expect(a.asked).toEqual([]);
		expect(result.reason).toContain("不询问");
		expect(h.recorded.fallbackCalls).toEqual([]);
	});

	it("批准到 workspace-write 时**仍然进沙箱**（不能借提权变成无约束）", async () => {
		/*
		 * 这条守的是一个很容易写错的地方：若按「有没有提权」决定走不走 fallback，
		 * 那么「批准提权到工作区可写」就会变成「完全放开」—— 比用户批准的更宽。
		 * 判据必须看提权**后的档位**。
		 *
		 * read-only → workspace-write 这条阶梯今天走不到（权限门在 read-only 档
		 * 把 shell 全拒了），但判据得写对，不能依赖上游恰好挡住。
		 */
		const h = harness();
		const a = approver(true);
		const run = createSandboxedRunner({
			getSettings: () => settings("read-only"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			requestEscalation: a.ask,
		});
		const outcome = ran(
			await run("npm run build", 120, undefined, {
				toMode: "workspace-write",
				justification: "构建需要写 dist 目录",
			}),
		);
		expect(h.recorded.sandboxCalls).toEqual(["npm run build"]);
		expect(h.recorded.fallbackCalls).toEqual([]);
		// 沙箱仍然生效，所以不该说「未受约束」
		expect(outcome.note).toBeUndefined();
	});

	it("不带提权申请时行为完全不变（回归）", async () => {
		const h = harness();
		const a = approver(true);
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			requestEscalation: a.ask,
		});
		const outcome = ran(await run("echo hi", 120));
		expect(a.asked).toEqual([]);
		expect(h.recorded.sandboxCalls).toEqual(["echo hi"]);
		expect(outcome.note).toBeUndefined();
	});
});

describe("拒写识别", () => {
	/** 造一个「被写约束拒了」的执行结果。文本取自真实探针输出。 */
	function deniedRun(stderr: string): SandboxFacade["run"] {
		return async () => ({ stdout: "", stderr, exitCode: 1, timedOut: false, aborted: false });
	}

	/*
	 * 这两段都是 scripts/probe-denial-text.ts 在中文 Windows 11 上取到的**真实**
	 * stderr。第一段是乱码：PowerShell 按 GBK 输出，runSandboxed 按 UTF-8 解码 ——
	 * 这正是模型今天实际看到的形态，所以签名必须能在它上面命中。
	 */
	const GARBLED =
		"Set-Content : ��·����C:\\outside\\denied.txt���ķ��ʱ��ܾ���\n" +
		"    + CategoryInfo          : PermissionDenied: (C:\\outside\\denied.txt:String) [Set-Content], Unauthorized \n" +
		"   AccessException";
	const ENGLISH =
		"Set-Content : Access to the path 'C:\\outside\\denied.txt' is denied.\n" +
		"    + CategoryInfo          : PermissionDenied: [Set-Content], UnauthorizedAccessException";

	function runnerWith(
		stderr: string,
		extra: Partial<Parameters<typeof createSandboxedRunner>[0]> = {},
	): {
		readonly run: ReturnType<typeof createSandboxedRunner>;
		readonly recorded: Recorded;
	} {
		const h = harness({ run: deniedRun(stderr) });
		return {
			recorded: h.recorded,
			run: createSandboxedRunner({
				getSettings: () => settings("workspace-write"),
				workspaceDir: WORKSPACE,
				fallback: h.fallback,
				sandbox: h.facade,
				requestEscalation: async () => false,
				...extra,
			}),
		};
	}

	it("中文 Windows 的**乱码** stderr 也能识别（ASCII 签名穿过编码错乱）", async () => {
		/*
		 * 这条是整个签名表存在的理由。照搬 dsh 的英文方言在这段文本上永不命中，
		 * 改匹配中文文案也不行（到我们手里已经是乱码）——
		 * 只有 .NET 异常类型名与 PowerShell 错误类别是 ASCII，活得下来。
		 */
		const r = runnerWith(GARBLED);
		const outcome = ran(await r.run("Set-Content C:\\outside\\denied.txt x", 120));
		expect(outcome.note).toContain("沙箱写约束");
		// 沙箱本身是好的：绝不能降级重跑
		expect(r.recorded.fallbackCalls).toEqual([]);
		expect(outcome.exitCode).toBe(1);
	});

	it("英文 Windows 的 stderr 同样识别", async () => {
		const r = runnerWith(ENGLISH);
		const outcome = ran(await r.run("Set-Content C:\\outside\\denied.txt x", 120));
		expect(outcome.note).toContain("沙箱写约束");
	});

	it("拒写说明必须点出「区内、但目录权限不含沙箱授权」这种成因（§4.31）", async () => {
		/*
		 * 现场：ppt-master 的 finalize_svg.py 用 tempfile.mkdtemp() 在**项目内**建目录
		 * （mode 派生、不继承父目录的 DACL），沙箱的 ACE 不在里面 → Errno 13。
		 * 旧文案只认「目标在工作目录之外」，结尾还写着「若目标本应在工作目录内，
		 * 请检查路径」—— 模型据此怀疑自己路径写错，绕了半圈才推断出真相。
		 * 这条钉住文案不再漏掉这种成因，且提权的适用条件覆盖它。
		 */
		const r = runnerWith(ENGLISH);
		const note = ran(await r.run("python finalize_svg.py", 120)).note;
		expect(note).toContain("mkdtemp");
		expect(note).toContain("区内目录不归沙箱授权");
	});

	it("能提权时附上出路，不能提权时**不提**（不指向走不通的路）", async () => {
		const withChannel = runnerWith(ENGLISH);
		expect(ran(await withChannel.run("x", 120)).note).toContain("sandbox_permissions");

		// 没有审批通道：申请必然被拒，提了就是骗模型白烧一轮
		const noChannel = runnerWith(ENGLISH, { requestEscalation: undefined });
		const note = ran(await noChannel.run("x", 120)).note;
		expect(note).toContain("沙箱写约束");
		expect(note).not.toContain("sandbox_permissions");

		// 审批策略「不询问」：同理
		const neverAsk = runnerWith(ENGLISH, {
			getSettings: () => ({ sandbox: "workspace-write", approval: "never" }),
		});
		expect(ran(await neverAsk.run("x", 120)).note).not.toContain("sandbox_permissions");
	});

	it("普通失败不加拒写说明（不把每个报错都说成权限问题）", async () => {
		const r = runnerWith("npm ERR! missing script: buidl");
		expect(ran(await r.run("npm run buidl", 120)).note).toBeUndefined();
	});

	it("**伪造的 stderr 不会导致任何自动放宽**（安全支点）", async () => {
		/*
		 * stderr 由子进程控制，模型可以随便打印这段文本。这里安全的唯一原因是
		 * 命中签名只**追加一段文字** —— 伪造的全部收益就是拿到一句本来也会给的
		 * 提示。绝不能出现：降级重跑、走 fallback、或档位被改。
		 *
		 * 这正是一期修掉的那个逃逸的形状（见 sandbox/index.ts 决策 9）：
		 * 「写被拒 → 伪造信号 → 判定沙箱坏了 → 不受约束地重跑同一条命令」。
		 */
		/*
		 * 自己数执行次数，不用 harness 的 sandboxCalls：那是**默认** run 实现在
		 * 记账，这里覆盖了 run，记录自然是空的（第一版就照抄了那个断言，
		 * 于是「空数组」被误读成「沙箱没被调用」）。要断言的是执行次数，
		 * 就得由实际执行的那个假件来数。
		 */
		let executions = 0;
		const h = harness({
			run: async () => {
				executions += 1;
				return {
					stdout: "",
					// 命令自己打印了拒绝文本，但退出码是 0（它其实成功了）
					stderr: "UnauthorizedAccessException: 我编的",
					exitCode: 0,
					timedOut: false,
					aborted: false,
				};
			},
		});
		const asked: unknown[] = [];
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			requestEscalation: async (request) => {
				asked.push(request);
				return true;
			},
		});
		const outcome = ran(await run("Write-Error '伪造'; exit 0", 120));
		// 没有第二次执行、没有降级、没有弹窗
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(executions).toBe(1);
		expect(asked).toEqual([]);
		// 只多了一句提示而已
		expect(outcome.exitCode).toBe(0);
	});
});

describe("失败一律拒绝（readiness 已不是判据，对齐 dsh）", () => {
	/*
	 * 对齐 dsh 后 runner 不再接收 isSandboxReady：任何失败一律拒绝。
	 * 门也不审命令——能不能跑由执行层的沙箱决定（dsh 的 confine 同构）。
	 */
	it("装配失败 → 拒绝（无论预热状态如何）", async () => {
		const h = harness({
			run: async () => {
				throw new Error("CreateRestrictedToken 失败（Win32 1314）");
			},
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		const result = wasBlocked(await run("Get-ChildItem C:\\", 120));
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(result.category).toBe("sandbox-unavailable");
	});

	it("read-only 沙箱内命令被拒时用**只读版**文案（不是「工作区内可写」）", async () => {
		const h = harness({
			run: async () => ({
				stdout: "",
				stderr: "UnauthorizedAccessException",
				exitCode: 1,
				timedOut: false,
				aborted: false,
			}),
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("read-only"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		const outcome = ran(await run("Set-Content .\\x.txt", 120));
		expect(outcome.note).toContain("只读沙箱");
		// read-only 连工作区内都写不了，workspace-write 版文案会误导模型
		expect(outcome.note).not.toContain("只允许写工作目录内");
	});
});

describe("审计留痕（spec: add-managed-runtimes 阶段 4）", () => {
	/** 审计写入的观测点：三类来源的记录形状由 core/audit-log 的测试钉，这里钉「写入点在不在这里」。 */
	function sink(): { readonly records: Array<{ category: string; outcome: string; detail: string }> } {
		return { records: [] };
	}

	/** 极简审批器（这里只关心「批 / 不批」，请求内容由「提权申请」那组钉）。 */
	function approve(answer: boolean): (request: {
		readonly toMode: SandboxMode;
		readonly justification: string;
		readonly command: string;
	}) => Promise<boolean> {
		return () => Promise.resolve(answer);
	}

	it("沙箱不可用拒了命令 → 记一条 sandbox/blocked（原因与给模型的同一句）", async () => {
		const h = harness({
			probe: async () => ({ available: false, reason: "ffi-load-failed", detail: "koffi 没装" }) as const,
		});
		const audit = sink();
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			onAudit: (record) => audit.records.push(record),
		});
		await run("Get-ChildItem", 120);
		expect(audit.records).toHaveLength(1);
		expect(audit.records[0]?.category).toBe("sandbox");
		expect(audit.records[0]?.outcome).toBe("blocked");
		expect(audit.records[0]?.detail).toContain("系统调用组件加载失败");
	});

	it("用户批准提权 → 记一条 sandbox/allowed（放宽约束是审计要管的放行）", async () => {
		const h = harness();
		const audit = sink();
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			requestEscalation: approve(true),
			onAudit: (record) => audit.records.push(record),
		});
		await run("Set-Content D:\\out\\x.txt", 120, undefined, {
			toMode: "danger-full-access",
			justification: "导出到交付目录",
		});
		expect(audit.records).toHaveLength(1);
		expect(audit.records[0]).toMatchObject({ category: "sandbox", outcome: "allowed" });
		expect(audit.records[0]?.detail).toContain("danger-full-access");
	});

	it("用户拒绝提权 → 记一条 sandbox/blocked，且命令一行都没跑", async () => {
		const h = harness();
		const audit = sink();
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			requestEscalation: approve(false),
			onAudit: (record) => audit.records.push(record),
		});
		await run("Set-Content D:\\x.txt", 120, undefined, { toMode: "danger-full-access", justification: "写 D 盘" });
		expect(h.recorded.sandboxCalls).toEqual([]);
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(audit.records).toHaveLength(1);
		expect(audit.records[0]).toMatchObject({ category: "sandbox", outcome: "blocked" });
	});
});

describe("warmUpSandbox", () => {
	it("workspace-write 档会预热并上报可用", async () => {
		const h = harness();
		await warmUpSandbox({
			workspaceDir: WORKSPACE,
			mode: "workspace-write",
			onDiagnostics: h.onDiagnostics,
			sandbox: h.facade,
		});
		expect(h.recorded.prepareCalls).toEqual([WORKSPACE]);
		expect(h.recorded.diagnostics[0]).toMatchObject({ available: true });
	});

	it("其他档位不预热（授权是纯浪费，还会留下 ACE）", async () => {
		const h = harness();
		await warmUpSandbox({
			workspaceDir: WORKSPACE,
			mode: "danger-full-access",
			onDiagnostics: h.onDiagnostics,
			sandbox: h.facade,
		});
		expect(h.recorded.probeCalls).toEqual([]);
		expect(h.recorded.prepareCalls).toEqual([]);
		expect(h.recorded.diagnostics).toEqual([]);
	});

	it("预热失败只上报，不抛出（不该打断会话创建）", async () => {
		const h = harness({
			probe: async () => {
				throw new Error("加载失败");
			},
		});
		await expect(
			warmUpSandbox({
				workspaceDir: WORKSPACE,
				mode: "workspace-write",
				onDiagnostics: h.onDiagnostics,
				sandbox: h.facade,
			}),
		).resolves.toBeUndefined();
		expect(h.recorded.diagnostics[0]).toMatchObject({ available: false, reason: "ffi-load-failed" });
	});

	it("预热后的首次调用不再重复授权", async () => {
		const h = harness();
		await warmUpSandbox({ workspaceDir: WORKSPACE, mode: "workspace-write", sandbox: h.facade });
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		await run("a", 120);
		expect(h.recorded.prepareCalls).toEqual([WORKSPACE]);
	});
});
