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

import type { CommandOutcome } from "../extensions/powershell-tool.ts";
import type { PermissionSettings, SandboxMode } from "../shared/permissions.ts";
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
	return { stdout, stderr: "", exitCode: 0, timedOut: false };
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
		const outcome = await run("echo hi", 120);
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
		const outcome = await run("echo hi", 120);
		expect(h.recorded.fallbackCalls).toEqual(["echo hi"]);
		expect(h.recorded.sandboxCalls).toEqual([]);
		expect(outcome.note).toBeUndefined();
		// 不该白跑一次探测
		expect(h.recorded.probeCalls).toEqual([]);
	});

	it("read-only 不进沙箱（门已全拒，不假装受限）", async () => {
		const h = harness();
		const run = createSandboxedRunner({
			getSettings: () => settings("read-only"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		await run("echo hi", 120);
		expect(h.recorded.fallbackCalls).toEqual(["echo hi"]);
		expect(h.recorded.sandboxCalls).toEqual([]);
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
});

describe("降级纪律", () => {
	it("探测报不可用 → 降级并带说明", async () => {
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
		const outcome = await run("echo hi", 120);
		// 命令仍然执行（不倒退），但必须说明沙箱未生效
		expect(h.recorded.fallbackCalls).toEqual(["echo hi"]);
		expect(outcome.note).toContain("未受操作系统级写入约束");
		expect(h.recorded.diagnostics[0]).toMatchObject({ available: false, reason: "not-windows" });
	});

	it("探测抛错 → 归为 ffi-load-failed 并降级", async () => {
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
		const outcome = await run("echo hi", 120);
		expect(outcome.note).toContain("未受操作系统级写入约束");
		expect(h.recorded.diagnostics[0]).toMatchObject({ available: false, reason: "ffi-load-failed" });
	});

	it("授权失败 → 降级，而不是拿未授权的沙箱去跑", async () => {
		// 未授权的沙箱会把工作区内的正常写入也拒掉，比不进沙箱更糟
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
		const outcome = await run("echo hi", 120);
		expect(h.recorded.sandboxCalls).toEqual([]);
		expect(h.recorded.fallbackCalls).toEqual(["echo hi"]);
		expect(outcome.note).toContain("未受操作系统级写入约束");
		expect(h.recorded.diagnostics[0]).toMatchObject({ reason: "acl-grant-failed" });
	});

	it("沙箱装配失败（令牌/spawn）→ 降级", async () => {
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
		const outcome = await run("echo hi", 120);
		expect(h.recorded.fallbackCalls).toEqual(["echo hi"]);
		expect(outcome.note).toContain("未受操作系统级写入约束");
		expect(h.recorded.diagnostics[0]).toMatchObject({ reason: "token-creation-failed" });
	});

	it("**命令自身失败不降级**——那是真实结果，不是沙箱故障", async () => {
		/*
		 * 这是本层最关键的一条区分。命令被操作系统拒绝写入时会以「非零退出码」
		 * 的形式正常返回；若把它当成沙箱故障去降级重跑，就等于
		 * 「区外写被拒 → 不受约束地再写一次」—— 写约束直接失效。
		 */
		const h = harness({
			run: async () => ({
				stdout: "",
				stderr: "拒绝访问。",
				exitCode: 1,
				timedOut: false,
			}),
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
			onDiagnostics: h.onDiagnostics,
		});
		const outcome = await run("Set-Content C:\\Windows\\x.txt", 120);
		// 绝不能出现 fallback 重跑
		expect(h.recorded.fallbackCalls).toEqual([]);
		expect(outcome.exitCode).toBe(1);
		expect(outcome.stderr).toContain("拒绝访问");
		expect(outcome.note).toBeUndefined();
		// 沙箱是好的，诊断应报可用
		expect(h.recorded.diagnostics.at(-1)).toMatchObject({ available: true });
	});

	it("超时也不降级（真实结果）", async () => {
		const h = harness({
			run: async () => ({ stdout: "", stderr: "", exitCode: null, timedOut: true }),
		});
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		const outcome = await run("Start-Sleep 999", 1);
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

	it("授权失败被记住，不每条命令重试一遍", async () => {
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
		await run("a", 120);
		await run("b", 120);
		expect(calls).toBe(1);
		expect(h.recorded.fallbackCalls).toEqual(["a", "b"]);
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
		const outcome = await run("echo hi", 120, (text) => notices.push(text));
		await vi.advanceTimersByTimeAsync(5_000);

		expect(notices).toEqual([]);
		expect(outcome.note).toContain("未受操作系统级写入约束");
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
		const outcome = await pending;

		expect(vi.getTimerCount()).toBe(0);
		expect(outcome.note).toContain("未受操作系统级写入约束");
	});

	it("不传 onProgress 时正常工作（连定时器都不建）", async () => {
		const h = harness();
		const run = createSandboxedRunner({
			getSettings: () => settings("workspace-write"),
			workspaceDir: WORKSPACE,
			fallback: h.fallback,
			sandbox: h.facade,
		});
		const outcome = await run("echo hi", 120);
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
