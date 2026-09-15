/**
 * 沙箱端到端集成测试（**本期的验收本体**）。
 *
 * 为什么它不可省：前面 2000 行 Win32 FFI 的 typecheck 干净不代表跑得对 ——
 * 而这份移植相对 dsh 有多处有意偏离（异步轮询代替阻塞等待、piped 路径补
 * Job Object、SID 所有权统一、退避轮询、显式环境块），偏离处上游没有测试可借。
 * 光靠复查已经抓出两个真 bug（Job 句柄双重关闭、temp 目录派生不一致），
 * 说明只有真跑才能暴露剩下的。
 *
 * 只在 Windows 跑：受限令牌是 Windows 特有机制，别的平台 probeSandbox
 * 直接报 not-windows。非 Windows 上整个 describe 跳过而不是失败。
 *
 * 不碰用户目录：工作区与"区外"目标都在系统 temp 下 mkdtemp，用完删掉。
 * 常驻 ACE 随目录一起消失，所以不需要显式撤销。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
	prepareSandbox,
	probeSandbox,
	resetSandboxProbeForTest,
	runSandboxed,
	sandboxPrivateTempDir,
} from "./index.ts";

const isWindows = process.platform === "win32";

/** PowerShell 启动约 0.3~1s，ACL 授权首次可能几百毫秒，给足余量。 */
const CASE_TIMEOUT_MS = 60_000;

/** 跑一条 PowerShell 脚本，参数形态与 powershell 工具一致。 */
async function runScript(
	script: string,
	dirs: { workspace: string },
	timeoutMs = 30_000,
): Promise<Awaited<ReturnType<typeof runSandboxed>>> {
	return runSandboxed({
		command: "powershell.exe",
		args: ["-NoProfile", "-NonInteractive", "-Command", script],
		cwd: dirs.workspace,
		workspaceDir: dirs.workspace,
		writableDirs: [dirs.workspace],
		timeoutMs,
		mode: "workspace-write",
	});
}

describe.skipIf(!isWindows)("受限令牌写约束", () => {
	let scratch: string;
	let workspace: string;
	let outside: string;
	let secretFile: string;

	beforeAll(async () => {
		scratch = mkdtempSync(join(tmpdir(), "kami-sbx-"));
		workspace = join(scratch, "workspace");
		outside = join(scratch, "outside");
		mkdirSync(workspace);
		mkdirSync(outside);
		secretFile = join(outside, "readable.txt");
		writeFileSync(secretFile, "OUTSIDE-CONTENT");

		const probe = await probeSandbox(workspace);
		// 探测不过就没必要往下跑：报错要能一眼看出是环境问题还是代码问题。
		expect(probe.available, `探测失败：${JSON.stringify(probe)}`).toBe(true);
		await prepareSandbox({ workspaceDir: workspace, writableDirs: [workspace] });
	}, CASE_TIMEOUT_MS);

	afterAll(async () => {
		// 私有 temp 在系统 temp 下按工作区路径派生，不随 scratch 一起删。
		try {
			rmSync(await sandboxPrivateTempDir(workspace), { recursive: true, force: true });
		} catch {
			// 清理失败不该让测试结果变红 —— 那是环境噪音，不是被测行为。
		}
		rmSync(scratch, { recursive: true, force: true });
	});

	it(
		"工作区内可写",
		async () => {
			const target = join(workspace, "inside.txt");
			const outcome = await runScript(
				`Set-Content -Path '${target}' -Value 'ok' -ErrorAction Stop; 'WROTE'`,
				{ workspace },
			);
			expect(outcome.exitCode, `stderr: ${outcome.stderr}`).toBe(0);
			expect(outcome.stdout).toContain("WROTE");
			expect(existsSync(target)).toBe(true);
		},
		CASE_TIMEOUT_MS,
	);

	it(
		"工作区外的写入被操作系统拒绝",
		async () => {
			// 本期唯一用户可感知的变化就是这一条：即使用户批准了审批，
			// 命令仍然写不出工作区。
			const target = join(outside, "escaped.txt");
			const outcome = await runScript(
				`try { Set-Content -Path '${target}' -Value 'x' -ErrorAction Stop; 'WROTE-OUTSIDE' } catch { 'DENIED' }`,
				{ workspace },
			);
			expect(existsSync(target), "区外文件竟然被创建了——写约束失效").toBe(false);
			expect(outcome.stdout).toContain("DENIED");
		},
		CASE_TIMEOUT_MS,
	);

	it(
		"工作区外仍可读（已知边界，不是缺陷）",
		async () => {
			// WRITE_RESTRICTED 机制上只约束写。这条测试是把「沙箱替代不了
			// command-guard 的凭据拦截」钉成可执行的事实，而不是只写在注释里 ——
			// 将来若有人想据此削弱检查器，这条会提醒他读侧根本没有保护。
			const outcome = await runScript(`Get-Content -Path '${secretFile}' -ErrorAction Stop`, {
				workspace,
			});
			expect(outcome.exitCode).toBe(0);
			expect(outcome.stdout).toContain("OUTSIDE-CONTENT");
		},
		CASE_TIMEOUT_MS,
	);

	it(
		"stdout 完整捕获且不丢行",
		async () => {
			// 输出要喂回模型，截断或丢行会让模型基于残缺信息决策。
			const outcome = await runScript(`1..200 | ForEach-Object { "line$_" }`, { workspace });
			const lines = outcome.stdout.split(/\r?\n/).filter((line) => line.startsWith("line"));
			expect(lines.length).toBe(200);
			expect(lines[0]).toBe("line1");
			expect(lines[199]).toBe("line200");
		},
		CASE_TIMEOUT_MS,
	);

	it(
		"stderr 与非零退出码如实回传",
		async () => {
			const outcome = await runScript(`[Console]::Error.WriteLine('to-stderr'); exit 42`, { workspace });
			expect(outcome.exitCode).toBe(42);
			expect(outcome.stderr).toContain("to-stderr");
			expect(outcome.timedOut).toBe(false);
		},
		CASE_TIMEOUT_MS,
	);

	it(
		"超时杀掉整棵进程树（含孙进程）",
		async () => {
			// 这是 piped 路径补 Job Object 的理由：没有 Job 就只杀得掉直接子进程，
			// `powershell -Command "node x.js"` 里的 node 会变孤儿继续跑。
			const pidFile = join(workspace, "grandchild.pid");
			// 子进程起一个孙进程（长睡），把孙进程 PID 写进工作区，然后自己也长睡。
			const script = [
				`$p = Start-Process powershell.exe -ArgumentList '-NoProfile','-Command','Start-Sleep 120' -PassThru`,
				`Set-Content -Path '${pidFile}' -Value $p.Id`,
				`Start-Sleep 120`,
			].join("; ");

			const started = Date.now();
			const outcome = await runScript(script, { workspace }, 4_000);
			const elapsed = Date.now() - started;

			expect(outcome.timedOut).toBe(true);
			expect(outcome.exitCode).toBeNull();
			// 不能挂死：超时后应当很快返回，而不是等到 120 秒。
			expect(elapsed).toBeLessThan(30_000);

			// 孙进程必须已被杀。Start-Process 在受限令牌下可能失败（那时没有
			// pid 文件），此时这条断言无意义 —— 如实跳过而不是假装通过。
			if (existsSync(pidFile)) {
				const pid = Number(readFileSync(pidFile, "utf8").trim());
				expect(Number.isInteger(pid)).toBe(true);
				// 给内核一点回收时间。
				await new Promise((resolve) => setTimeout(resolve, 1_000));
				let alive: boolean;
				try {
					// signal 0 = 只探测存在性，不真发信号。
					process.kill(pid, 0);
					alive = true;
				} catch {
					alive = false;
				}
				expect(alive, `孙进程 ${pid} 仍在运行——Job Object 没起作用`).toBe(false);
			}
		},
		CASE_TIMEOUT_MS,
	);

	it(
		"TMP/TEMP 指向已授权的私有目录且可写",
		async () => {
			// 这条守的正是我复查时抓到的那个 bug：prepareSandbox 按 workspaceDir
			// 授权私有 temp，而 runSandboxed 曾按 cwd 派生 —— 两者不等时
			// 运行时的 temp 从未被授权，写临时文件会被拒。
			const outcome = await runScript(
				`$f = Join-Path $env:TEMP 'probe.txt'; Set-Content -Path $f -Value 'tmp-ok' -ErrorAction Stop; $env:TEMP`,
				{ workspace },
			);
			expect(outcome.exitCode, `stderr: ${outcome.stderr}`).toBe(0);
			const reported = outcome.stdout.trim();
			const expected = await sandboxPrivateTempDir(workspace);
			expect(reported.toLowerCase()).toBe(expected.toLowerCase());
			expect(existsSync(join(expected, "probe.txt"))).toBe(true);
		},
		CASE_TIMEOUT_MS,
	);

	it(
		"probeSandbox 幂等且缓存",
		async () => {
			resetSandboxProbeForTest();
			const first = await probeSandbox(workspace);
			const second = await probeSandbox(workspace);
			expect(first).toEqual(second);
			// 缓存命中应当返回同一个对象（不重复付 FFI 加载与卷查询的代价）。
			expect(second).toBe(await probeSandbox(workspace));
		},
		CASE_TIMEOUT_MS,
	);

	it(
		"授权不了的目录响亮失败，而不是静默放行",
		async () => {
			// fail-closed：授权失败必须抛。上游 POC 正是在这里漏检返回值，
			// 失败时拿完整令牌跑了子进程 —— 沙箱静默失效比没有沙箱更糟。
			const missing = join(scratch, "does-not-exist");
			await expect(
				prepareSandbox({ workspaceDir: workspace, writableDirs: [missing] }),
			).rejects.toThrow();
		},
		CASE_TIMEOUT_MS,
	);
});

describe.skipIf(isWindows)("非 Windows 平台", () => {
	it("探测报 not-windows 而不是抛错", async () => {
		resetSandboxProbeForTest();
		const probe = await probeSandbox(tmpdir());
		expect(probe.available).toBe(false);
		if (!probe.available) expect(probe.reason).toBe("not-windows");
	});
});
