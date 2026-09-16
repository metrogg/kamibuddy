/**
 * 探针：**受限令牌**拒写时，stderr 上到底是什么文本？
 *
 * 为什么需要它：dsh 的 windows-acl 拒绝方言（`sandbox-local/src/index.ts:211`）
 * 是**纯英文**的 —— `access is denied` / `access to the path` / `permission denied`。
 * 而我们的目标用户是中文 Windows：照搬那份列表会**永远不命中**，于是「沙箱拒了
 * 这条命令」这件事对模型永远不可见。签名表必须基于实测，不能照抄。
 *
 * 【第一版写错了，教训值得留着】最初我去写 `C:\Windows\System32`，
 * 假设「非提权用户必被拒」。结果 Node 的 writeFileSync **写成功了** ——
 * 那个会话是提权运行的，前提不成立，三条探测全部无效（还在系统目录留了文件）。
 * 教训：要取的是「**受限令牌**拒写」的文本，就必须真的走沙箱。受限令牌移除了
 * 写能力，提权与否都会被拒 —— 这才是与前提无关的可靠布景。
 * （顺带印证了 docs/sandbox.md 已知边界第 7 条：管理员基本不受约束。）
 *
 * 另一件必须同时验的事：**编码**。runSandboxed 把 stderr 按 UTF-8 解码，
 * 而 PowerShell 默认按控制台代码页（中文机器是 936/GBK）输出 —— 若两者不一致，
 * 拿到的是乱码，那么**任何**签名都不可能命中。所以下面对照跑「设 UTF-8 输出」
 * 与「不设」两种，把这件事一次性钉清楚。
 *
 * 用法：npx tsx scripts/probe-denial-text.ts
 */

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareSandbox, probeSandbox, runSandboxed, sandboxPrivateTempDir } from "../src/sandbox/index.ts";

export {};

if (process.platform !== "win32") {
	console.log("SKIP  受限令牌是 Windows 机制。");
	process.exit(0);
}

const scratch = mkdtempSync(join(tmpdir(), "kami-denial-"));
const workspace = join(scratch, "workspace");
const outside = join(scratch, "outside");
mkdirSync(workspace);
mkdirSync(outside);

/** 沙箱内要写的区外目标：授权只给了 workspace，这里必被受限令牌拒。 */
const target = join(outside, "denied.txt");

function show(label: string, exitCode: number | null, stdout: string, stderr: string): void {
	const clean = (s: string): string => s.replace(/\r/g, "").trim();
	console.log(`\n── ${label} ──`);
	console.log(`exitCode = ${exitCode ?? "null"}`);
	console.log(`stdout   = ${clean(stdout) === "" ? "(空)" : clean(stdout)}`);
	console.log(`stderr   = ${clean(stderr) === "" ? "(空)" : clean(stderr)}`);
}

try {
	const probe = await probeSandbox(workspace);
	if (!probe.available) {
		console.log(`SKIP  沙箱不可用，取不到真实文本：${JSON.stringify(probe)}`);
		process.exit(0);
	}
	await prepareSandbox({ workspaceDir: workspace, writableDirs: [workspace] });

	const run = (args: readonly string[], command = "powershell.exe") =>
		runSandboxed({
			command,
			args,
			cwd: workspace,
			workspaceDir: workspace,
			writableDirs: [workspace],
			timeoutMs: 30_000,
			mode: "workspace-write",
		});

	/*
	 * 1) PowerShell，**不设**输出编码 —— 这正是 sandbox-runner 今天的真实形态
	 *    （它传的就是 -NoProfile -NonInteractive -Command <命令>）。
	 *    所以这一条的输出就是「模型实际会看到的东西」。
	 */
	const bare = await run([
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		`Set-Content -Path '${target}' -Value 'x'`,
	]);
	show("PowerShell（不设编码 = 今天的真实形态）", bare.exitCode, bare.stdout, bare.stderr);

	// 2) PowerShell，显式 UTF-8 输出：用来判断上一条是不是编码问题。
	const utf8 = await run([
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		`[Console]::OutputEncoding=[Text.Encoding]::UTF8; Set-Content -Path '${target}' -Value 'x'`,
	]);
	show("PowerShell（显式 UTF-8 输出）", utf8.exitCode, utf8.stdout, utf8.stderr);

	// 3) cmd.exe 重定向：错误文本来自 cmd 内建，与 .NET 异常不同源。
	const cmd = await run(["/c", `echo x > "${target}"`], "cmd.exe");
	show("cmd.exe（重定向）", cmd.exitCode, cmd.stdout, cmd.stderr);

	console.log(
		"\n结论怎么用：把上面**实际出现**的小写子串填进 sandbox-runner 的签名表；" +
			"英文签名（dsh 那三条）也一并留下 —— 用户可能装英文版 Windows。" +
			"\n若 stderr 是乱码，说明签名匹配在中文机器上根本不可行，" +
			"必须改用与 stderr 文本无关的判据（那是另一个设计，不要硬凑签名）。",
	);
} finally {
	try {
		rmSync(await sandboxPrivateTempDir(workspace), { recursive: true, force: true });
	} catch {
		// 清理失败不该盖掉探针结论。
	}
	rmSync(scratch, { recursive: true, force: true });
}
