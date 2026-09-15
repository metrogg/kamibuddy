/**
 * 首响延迟复现：用**真实模型配置与凭据**跑一次完整会话，测「第一条消息 → 首个 token」。
 *
 * 为什么需要它：应用内实测「进程启动后第一条消息稳定慢 ~10.7s，伴随两次
 * Request timed out. 重试」，而沙箱前没有。本地对沙箱自身做的量测（spawn 同步段
 * 17-27ms、warm-up 10-121ms、事件循环最大滞后 138ms）都排除了「沙箱阻塞」，
 * 所以必须在**真实请求路径**上复现，才能继续二分。
 *
 * 对照开关（两次进程分别跑，避免缓存串味）：
 *   --warm   先执行生产 warmUpSandbox（探测 + 授权 + 受限自检），复刻应用的行为
 *   不带    不做任何沙箱动作（= 沙箱前的行为）
 *
 * 用真实配置目录（~/.kamibuddy）以便加载真实凭据；cwd 用临时目录，不碰用户任务目录。
 * **会发起一次真实模型请求**（一句短提示），消耗极小额度。
 *
 * 用法：npx tsx scripts/probe-first-response.mts [--warm]
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WARM = process.argv.includes("--warm");
const MODEL_KEY = "deepseek/deepseek-v4-flash-vision-exp";
const PROMPT = "回复两个字：收到";

const { ModelCatalog } = await import("../src/core/model-catalog.ts");
const { SessionHost } = await import("../src/core/session-host.ts");
const { loadResources } = await import("../src/core/resources.ts");
const { getResourcesDir } = await import("../src/core/config-paths.ts");
const { warmUpSandbox } = await import("../src/daemon/sandbox-runner.ts");

const cwd = mkdtempSync(join(tmpdir(), "kami-probe-ws-"));
console.log(`模式：${WARM ? "① 先 warmUpSandbox（复刻应用）" : "② 沙箱完全不介入（= 沙箱前）"}`);
console.log(`工作目录：${cwd}\n`);

/** 时间线：所有事件类型 + 相对 t0 的毫秒偏移。 */
const timeline: Array<{ type: string; at: number; detail?: string }> = [];
let t0 = 0;

if (WARM) {
	const warm0 = Date.now();
	await warmUpSandbox({ workspaceDir: cwd, mode: "workspace-write" });
	console.log(`warmUpSandbox 完成：${Date.now() - warm0} ms\n`);
}

const catalog = await ModelCatalog.create();

// 打印真实端点（脱敏：只留协议+主机+端口），便于随后对同一主机做 DNS/TLS 分层计时。
const resolved = catalog.resolveModel(MODEL_KEY) as
	| { baseUrl?: string; api?: string; id?: string }
	| undefined;
const baseUrl = resolved?.baseUrl ?? "(未知)";
const redacted = baseUrl.replace(/(https?:\/\/[^/?#]+).*/, "$1");
console.log(`端点：${redacted}（api=${resolved?.api ?? "?"}）\n`);
const host = await SessionHost.create({
	catalog,
	modelKey: MODEL_KEY,
	cwd,
	isTempTask: false,
	sceneId: "work",
	interactionId: "craft",
	emit: (event) => {
		const type = (event as { type?: string }).type ?? "(unknown)";
		if (
			/^(run_started|run_finished|run_retry|run_error|assistant_started|assistant_done|turn_start|turn_end)$/.test(
				type,
			)
		) {
			const withDetail = event as { errorMessage?: string; attempt?: number; message?: { text?: string } };
			const detail =
				withDetail.errorMessage ??
				(withDetail.attempt !== undefined ? `attempt=${withDetail.attempt}` : undefined) ??
				(type === "assistant_done" ? `text=${JSON.stringify((withDetail.message?.text ?? "").slice(0, 20))}` : undefined);
			timeline.push({ type, at: Date.now() - t0, detail });
		}
	},
	resources: loadResources(getResourcesDir()),
	// 不注入扩展：最小化变量（提示词更短、无工具），只测「请求→首 token」这一段。
	extensions: [],
});

/** 发一条并等到终态；返回 { 首 token 偏移, 重试次数 }。 */
async function ask(label: string): Promise<{ firstToken: number | undefined; retries: number }> {
	const mark = timeline.length;
	t0 = Date.now();
	console.log(`\n── ${label}：发送「${PROMPT}」`);
	await host.prompt(PROMPT);
	// 等终态；同一进程第二次发问时，上一轮的旧事件不参与判定。
	const deadline = Date.now() + 120_000;
	for (;;) {
		const fresh = timeline.slice(mark);
		const finished = fresh.some((e) => e.type === "run_finished" || e.type === "run_error");
		const answered = fresh.some(
			(e) => e.type === "assistant_done" && e.detail !== undefined && !e.detail.includes('""'),
		);
		if (finished || answered) break;
		if (Date.now() > deadline) break;
		await new Promise((r) => setTimeout(r, 100));
	}
	await new Promise((r) => setTimeout(r, 500));
	const fresh = timeline.slice(mark);
	const first = fresh.find(
		(e) => e.type === "assistant_done" && e.detail?.includes("text=") && !e.detail.includes('""'),
	);
	const retries = fresh.filter((e) => e.type === "run_retry").length;
	console.log(`   首 token：${first?.at ?? "(无)"} ms；重试：${retries} 次`);
	return { firstToken: first?.at, retries };
}

const first = await ask("第 1 条（复刻应用首次发问）");
const second = await ask("第 2 条（同进程，看是否已预热）");

console.log("\n===== 事件时间线 =====");
for (const e of timeline) {
	console.log(`  +${String(e.at).padStart(6)} ms  ${e.type}${e.detail === undefined ? "" : `  ${e.detail}`}`);
}

console.log("\n===== 结论 =====");
console.log(`  第 1 条首 token：${first.firstToken ?? "(无)"} ms（重试 ${first.retries} 次）`);
console.log(`  第 2 条首 token：${second.firstToken ?? "(无)"} ms（重试 ${second.retries} 次）`);
console.log(
	first.firstToken !== undefined && second.firstToken !== undefined && second.firstToken < 3000
		? "  → 首次慢、次次快：**每进程首次请求**的预热问题"
		: "  → 两次都慢：不是按进程预热，另有原因",
);

rmSync(cwd, { recursive: true, force: true });
process.exit(0);
