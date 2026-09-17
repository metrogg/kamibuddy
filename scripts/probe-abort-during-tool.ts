/**
 * 探针：中断一个正在跑的 run，看 pi 的收尾事件到底是什么形状。
 *
 * 背景（2026-09-17 用户实测）：点停止键后界面弹「This operation was aborted」
 * 错误卡，而 WorkBuddy 同场景显示「用户已取消 / 已取消 37s」——我们的
 * 「已取消」渲染（chat-view 的 user-cancelled 行）根本没被触发。
 *
 * session-host 的取消判定是「agent_end 的 messages 里有 assistant 且
 * stopReason === "aborted"」（session-host.ts:1205），本探针把这个前提拿到
 * 真 pi 会话里验一遍：模型端点是「永不应答」的本地服务器，run 挂住后 abort，
 * 把 message_end 的 stopReason/errorMessage 与终态事件原样打出来。
 *
 * 不联网：全部指向 127.0.0.1。
 *
 * 用法：npx tsx scripts/probe-abort-during-tool.ts
 *
 * ── 实测结论（2026-09-17，Windows）──────────────────────────────────
 *
 * 1. 模型端点「永不应答」时 abort：pi 收尾带 stopReason "aborted"（干净路径），
 *    session-host 的旧判定已能识别 → run_finished cancelled。
 * 2. 模型端点「吐一半后挂住」时 abort：同样落 cancelled。
 * 3. 用户实测的错误卡（"This operation was aborted"）来自 pi 的另一条收尾路径：
 *    被中断的 fetch 抛 DOMException，经 createErrorMessage
 *    （bundle：`stopReason:"error", errorMessage: error.message`）落成 assistant 消息
 *    —— **没有** stopReason "aborted" 那条。旧判定因此把它当错误弹卡。
 *    判定改为「abortRequested（我们自己记的账）|| pi 的 aborted 信号」后修复
 *    （回归测试：session-host.test.ts「用户按过停止 → 即便 pi 报 stopReason error…」）。
 *
 * 本探针保留作证据：改判定式前后都可复跑，输出里看终态那一行即可。
 */

import { createServer } from "node:http";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export {};

const workDir = mkdtempSync(join(tmpdir(), "kami-probe-abort-"));
process.env["KAMIBUDDY_CONFIG_DIR"] = join(workDir, "config");
process.env["KAMIBUDDY_WORKSPACE_DIR"] = join(workDir, "workspace");

const { ModelCatalog } = await import("../src/core/model-catalog.ts");
const { SessionHost } = await import("../src/core/session-host.ts");
const { loadResources } = await import("../src/core/resources.ts");
const { getResourcesDir, getWorkspaceDir } = await import("../src/core/config-paths.ts");

/* ── 模型端点：先吐两段正文，然后**保持连接不再吐**（模拟生成中途）──── */

const hangServer = createServer((req, res) => {
	req.resume();
	req.on("end", () => {
		res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
		const emit = (delta: Record<string, unknown>): void => {
			res.write(
				`data: ${JSON.stringify({ id: "c1", object: "chat.completion.chunk", created: 0, model: "probe-model", choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`,
			);
		};
		emit({ role: "assistant", content: "前半句" });
		// 之后就挂着不吐了：等我们 abort
	});
});
await new Promise<void>((done) => hangServer.listen(0, "127.0.0.1", done));
const hangPort = (hangServer.address() as { port: number }).port;

const catalog = await ModelCatalog.create();
const PROVIDER = "probe-abort";
await catalog.saveCustomProvider(
	{
		id: PROVIDER,
		name: "中断探针",
		baseUrl: `http://127.0.0.1:${hangPort}/v1`,
		api: "openai-completions",
		models: [
			{ id: "probe-model", name: "探针模型", contextWindow: 128000, maxTokens: 8192, reasoning: false, vision: false },
		],
	},
	"sk-probe-not-a-real-key",
);

const cwd = join(getWorkspaceDir(), "space");
mkdirSync(cwd, { recursive: true });

const keep = new Set([
	"message_start",
	"message_end",
	"tool_execution_start",
	"tool_execution_end",
	"run_finished",
	"run_error",
	"session_state",
]);
const events: Array<Record<string, unknown>> = [];
const host = await SessionHost.create({
	catalog,
	modelKey: `${PROVIDER}/probe-model`,
	cwd,
	isTempTask: false,
	sceneId: "work",
	interactionId: "craft",
	emit: (event) => {
		const e = event as unknown as Record<string, unknown>;
		if (keep.has(String(e["type"]))) events.push(e);
	},
	resources: loadResources(getResourcesDir()),
});

const waitUntil = async (predicate: () => boolean, timeoutMs: number, label: string): Promise<boolean> => {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (predicate()) return true;
		await new Promise((done) => setTimeout(done, 100));
	}
	console.log(`（等待超时：${label}）`);
	return false;
};

console.log("── 发一条消息（模型永不应答，run 会挂住）──");
host.prompt("你好").catch((error: unknown) => {
	console.log("prompt 抛出：", error instanceof Error ? error.message : String(error));
});
await waitUntil(() => host.state.isStreaming, 20_000, "进入流式");
console.log(`进入流式：${String(host.state.isStreaming)}`);

await new Promise((done) => setTimeout(done, 1500)); // 让请求真的发出去

console.log("── 按「停止」──");
await host.abort();
console.log("abort() 已返回");

const settled = await waitUntil(
	() => events.some((e) => e["type"] === "run_finished" || e["type"] === "run_error"),
	30_000,
	"run 收尾",
);

console.log("\n══ 事件时间线 ══");
for (const e of events) {
	const type = String(e["type"]);
	if (type === "message_end") {
		const message = e["message"] as Record<string, unknown> | undefined;
		console.log(
			`message_end: role=${String(message?.["role"])} stopReason=${String(message?.["stopReason"])} errorMessage=${String(message?.["errorMessage"] ?? "(无)")}`,
		);
		continue;
	}
	if (type === "session_state") {
		const state = e["state"] as Record<string, unknown> | undefined;
		console.log(`session_state: isStreaming=${String(state?.["isStreaming"])}`);
		continue;
	}
	if (type === "run_error") {
		console.log(`run_error: message=${JSON.stringify(String(e["message"]))}`);
		continue;
	}
	if (type === "run_finished") {
		console.log(`run_finished: outcome=${String(e["outcome"])}`);
		continue;
	}
	console.log(type);
}

console.log(`\nrun 收尾：${String(settled)}`);
await new Promise((done) => setTimeout(done, 2000));
console.log(`收尾后 isStreaming=${String(host.state.isStreaming)}`);
console.log(`\n结论：${events.some((e) => e["type"] === "run_error") ? "本 run 以 run_error 收尾（错误卡）" : events.some((e) => e["type"] === "run_finished" && e["outcome"] === "cancelled") ? "本 run 以 run_finished(cancelled) 收尾（用户已取消）" : "本 run 以 run_finished(completed) 收尾"}`);

host.dispose();
hangServer.close();
process.exit(0);
