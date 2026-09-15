/**
 * 沙箱冒烟的子进程：在 utilityProcess 里跑 **src/sandbox/ 的生产代码**。
 *
 * 由 scripts/smoke-sandbox.ts 打包并 fork（见那里的完整理由）。
 *
 * **不要在这里手写精简版的令牌/ACL 逻辑。** 诊断 2026-09-15 那次故障时我这么做过，
 * 漏掉了 setTokenDefaultDaclGrant，于是两组对照都失败，差点据此误判根因。
 * 这条冒烟的全部价值在于「跑真实路径 + 进程类型与生产一致」，
 * 一旦改成精简重写就两头都不占。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	prepareSandbox,
	probeSandbox,
	runSandboxed,
	sandboxPrivateTempDir,
} from "../src/sandbox/index.ts";

interface Result {
	readonly name: string;
	readonly ok: boolean;
	readonly detail: string;
}

const results: Result[] = [];
const TIMEOUT_MS = 30_000;

function post(): void {
	(process as unknown as { parentPort: { postMessage: (m: unknown) => void } }).parentPort.postMessage(
		{ results },
	);
}

/** 把执行结果写成一行可读诊断（保留退出码的十六进制——定位根因靠它）。 */
function describe(exitCode: number | null, stdout: string, stderr: string, timedOut: boolean): string {
	if (timedOut) return "命令超时未结束";
	if (exitCode === null) return "进程被终止，没有退出码";
	const hex = `0x${(exitCode >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
	const tail = [stdout.trim(), stderr.trim()].filter((s) => s !== "").join(" / ");
	return `退出码 ${exitCode}（${hex}）${tail === "" ? "" : `，输出：${tail.slice(0, 160)}`}`;
}

async function powershell(
	script: string,
	dirs: { readonly workspace: string; readonly writable: readonly string[] },
	mode: "read-only" | "workspace-write",
): Promise<{ exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }> {
	return runSandboxed({
		command: "powershell.exe",
		args: ["-NoProfile", "-NonInteractive", "-Command", script],
		cwd: dirs.workspace,
		workspaceDir: dirs.workspace,
		writableDirs: dirs.writable,
		timeoutMs: TIMEOUT_MS,
		mode,
	});
}

async function main(): Promise<void> {
	const given = process.argv[2];
	/*
	 * 只有自己建的目录才允许删。传入真实工作区时 owned 为 undefined ——
	 * 绝不能对用户的目录跑 rmSync（诊断脚本里踩过：空串 + recursive 是灾难形态）。
	 */
	const owned = given === undefined ? mkdtempSync(join(tmpdir(), "kami-smoke-ws-")) : undefined;
	const workspace = given ?? owned ?? "";
	// 越界目标始终用独立临时目录：拿工作区拼相对路径会落在区**内**，
	// 那条断言就会给出假结果（把「没拦住」报成「拦住了」）。
	const outside = mkdtempSync(join(tmpdir(), "kami-smoke-out-"));

	// 传入的路径可能还不存在（尚未建过任务的工作区）；建它是安全的 ——
	// 后面所有断言都要求目录已存在，而 ACL 授权本身也需要目标存在。
	if (workspace !== "") mkdirSync(workspace, { recursive: true });
	results.push({ name: "工作区", ok: existsSync(workspace), detail: workspace });

	try {
		const probe = await probeSandbox(workspace);
		results.push({
			name: "probeSandbox（含受限令牌启动自检）",
			ok: probe.available,
			detail: probe.available ? "可用" : `不可用：${probe.reason}\n${probe.detail}`,
		});
		// 探测不过就没有继续的意义：后面每条都会以同一个原因失败，只是噪音。
		if (!probe.available) return;

		// read-only 档：不需要 ACL 授权，先验「受限令牌下进程起不起来」。
		const ro = await powershell("Write-Output 'RO-OK'", { workspace, writable: [] }, "read-only");
		results.push({
			name: "read-only 档：命令能执行",
			ok: ro.exitCode === 0 && ro.stdout.includes("RO-OK"),
			detail: describe(ro.exitCode, ro.stdout, ro.stderr, ro.timedOut),
		});

		await prepareSandbox({ workspaceDir: workspace, writableDirs: [workspace] });

		// workspace-write 档：完整生产路径。
		const ww = await powershell(
			"Write-Output 'WW-OK'",
			{ workspace, writable: [workspace] },
			"workspace-write",
		);
		results.push({
			name: "workspace-write 档：命令能执行",
			ok: ww.exitCode === 0 && ww.stdout.includes("WW-OK"),
			detail: describe(ww.exitCode, ww.stdout, ww.stderr, ww.timedOut),
		});

		// 工作区内可写（沙箱不能把正常工作也挡掉）。
		const insideFile = join(workspace, `smoke-inside-${process.pid}.txt`);
		const inside = await powershell(
			`Set-Content -Path '${insideFile}' -Value 'ok' -ErrorAction Stop; 'WROTE'`,
			{ workspace, writable: [workspace] },
			"workspace-write",
		);
		results.push({
			name: "工作区内可写",
			ok: inside.exitCode === 0 && existsSync(insideFile),
			detail: describe(inside.exitCode, inside.stdout, inside.stderr, inside.timedOut),
		});
		if (existsSync(insideFile)) rmSync(insideFile, { force: true });

		// 核心断言：工作区外写入被操作系统拒绝。
		const escapeFile = join(outside, "escaped.txt");
		const escape = await powershell(
			`try { Set-Content -Path '${escapeFile}' -Value 'x' -ErrorAction Stop; 'WROTE-OUTSIDE' } catch { 'DENIED' }`,
			{ workspace, writable: [workspace] },
			"workspace-write",
		);
		results.push({
			name: "**工作区外写入被拒**",
			ok: !existsSync(escapeFile) && escape.stdout.includes("DENIED"),
			detail: `文件是否被创建=${existsSync(escapeFile)}；${describe(escape.exitCode, escape.stdout, escape.stderr, escape.timedOut)}`,
		});

		// 工作区外读取仍可行 —— 已知边界，写成断言防止后人据此削弱检查器。
		const secret = join(outside, "readable.txt");
		writeFileSync(secret, "OUTSIDE-CONTENT", "utf8");
		const read = await powershell(
			`Get-Content -Path '${secret}' -ErrorAction Stop`,
			{ workspace, writable: [workspace] },
			"workspace-write",
		);
		results.push({
			name: "工作区外读取仍可行（已知边界，非缺陷）",
			ok: read.stdout.includes("OUTSIDE-CONTENT"),
			detail: describe(read.exitCode, read.stdout, read.stderr, read.timedOut),
		});

		// TMP/TEMP 指向已授权的私有目录（守 prepare 与 run 锚定同一目录这条）。
		const tempProbe = await powershell(
			`$f = Join-Path $env:TEMP 'probe.txt'; Set-Content -Path $f -Value 'tmp-ok' -ErrorAction Stop; $env:TEMP`,
			{ workspace, writable: [workspace] },
			"workspace-write",
		);
		const expectedTemp = await sandboxPrivateTempDir(workspace);
		results.push({
			name: "TMP/TEMP 指向已授权的私有目录且可写",
			ok:
				tempProbe.exitCode === 0 &&
				tempProbe.stdout.trim().toLowerCase() === expectedTemp.toLowerCase() &&
				existsSync(join(expectedTemp, "probe.txt")),
			detail: `期望 ${expectedTemp}；${describe(tempProbe.exitCode, tempProbe.stdout, tempProbe.stderr, tempProbe.timedOut)}`,
		});
		const probeFile = join(expectedTemp, "probe.txt");
		if (existsSync(probeFile)) rmSync(probeFile, { force: true });

		// 超时能杀掉整棵树（Job Object）。
		const pidFile = join(workspace, `smoke-grandchild-${process.pid}.pid`);
		const started = Date.now();
		const killed = await runSandboxed({
			command: "powershell.exe",
			args: [
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				`$p = Start-Process powershell.exe -ArgumentList '-NoProfile','-Command','Start-Sleep 120' -PassThru; Set-Content -Path '${pidFile}' -Value $p.Id; Start-Sleep 120`,
			],
			cwd: workspace,
			workspaceDir: workspace,
			writableDirs: [workspace],
			timeoutMs: 4_000,
			mode: "workspace-write",
		});
		const elapsed = Date.now() - started;
		let grandchildAlive = false;
		if (existsSync(pidFile)) {
			const pid = Number(readFileSync(pidFile, "utf8").trim());
			await new Promise((r) => setTimeout(r, 1_000));
			try {
				process.kill(pid, 0);
				grandchildAlive = true;
			} catch {
				grandchildAlive = false;
			}
			rmSync(pidFile, { force: true });
		}
		results.push({
			name: "超时杀掉整棵进程树（含孙进程）",
			ok: killed.timedOut && !grandchildAlive && elapsed < 30_000,
			detail: `timedOut=${killed.timedOut} 耗时=${elapsed}ms 孙进程仍存活=${grandchildAlive}`,
		});
	} finally {
		if (owned !== undefined) rmSync(owned, { recursive: true, force: true });
		rmSync(outside, { recursive: true, force: true });
		// 自己建的工作区对应的私有 temp 也清掉；传入的真实工作区不动它的 temp
		// （那是下次会话还要复用的 reuse cache）。
		if (owned !== undefined) {
			try {
				rmSync(await sandboxPrivateTempDir(owned), { recursive: true, force: true });
			} catch {
				// 清理失败不该让冒烟结论变红 —— 那是环境噪音。
			}
		}
	}
}

main()
	.catch((error: unknown) => {
		results.push({
			name: "未预期异常",
			ok: false,
			detail: error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error),
		});
	})
	.finally(post);
