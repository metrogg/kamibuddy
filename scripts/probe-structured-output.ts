/**
 * 探针：pi 的工具调用面能不能承载 WorkBuddy 的 StructuredOutput（B9）？
 *
 * 读源码只能得到「看起来可以」，这里以**真实 HTTP 请求体**为准，回答四个问题：
 *   1. registerTool 接受**运行时构造**的 schema 吗？
 *      B9 的 schema 是数据不是代码，所以动态构造能力是前提。
 *      两种形态各测一次：Type.Object 动态键、Type.Unsafe 包原始 JSON Schema。
 *   2. constrainedSampling:{type:"json_schema",strict:"prefer"} 在**我们自定义服务商**
 *      这条链上真的会发出 strict:true 吗？（决定结果形状的保证来自约束采样还是事后校验）
 *   3. terminate:true 能不能让本轮在工具调用后结束（省一轮 LLM —— B9 的交付语义）？
 *   4. 入参不合 schema 时，是不是变成工具错误回灌让模型重试？
 *
 * 手法：本地起一个冒充 OpenAI 兼容服务商的 HTTP 服务器，逐轮脚本化回复，
 * 记录每次请求体与请求次数。不联网、不需要真实 key。
 *
 * 用法：npx tsx scripts/probe-structured-output.ts
 */

import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { TSchema } from "typebox";

export {};

// 必须在导入我们的模块之前设好：配置路径由 env 决定。
const workDir = mkdtempSync(join(tmpdir(), "kami-probe-so-"));
process.env["KAMIBUDDY_CONFIG_DIR"] = join(workDir, "config");
process.env["KAMIBUDDY_WORKSPACE_DIR"] = join(workDir, "workspace");

const { ModelCatalog } = await import("../src/core/model-catalog.ts");
const { SessionHost } = await import("../src/core/session-host.ts");
const { loadResources } = await import("../src/core/resources.ts");
const { getResourcesDir } = await import("../src/core/config-paths.ts");

const results: { readonly name: string; readonly ok: boolean; readonly detail: string }[] = [];
function check(name: string, ok: boolean, detail: string): void {
	results.push({ name, ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

/* ── 假服务商：记录请求体，按脚本逐轮回复 ────────────────────────────── */

interface CapturedRequest {
	readonly body: Record<string, unknown>;
}

const captured: CapturedRequest[] = [];
/** 按请求序号取回复；缺省回复一句结束文本，避免探针自己挂住。 */
let replyFor: (index: number) => string = () => sseText("（本轮未准备脚本）");

function sseChunk(delta: Record<string, unknown>, finishReason: string | null): string {
	return `data: ${JSON.stringify({
		id: "chatcmpl-probe",
		object: "chat.completion.chunk",
		created: 0,
		model: "probe-model",
		choices: [{ index: 0, delta, finish_reason: finishReason }],
		// 末块的 usage 不可省：pi 用它算上下文用量，缺了会被当成异常。
		...(finishReason === null
			? {}
			: {
					usage: {
						prompt_tokens: 10,
						completion_tokens: 5,
						prompt_tokens_details: { cached_tokens: 0 },
						completion_tokens_details: { reasoning_tokens: 0 },
					},
				}),
	})}\n\n`;
}

function sseToolCall(name: string, args: unknown): string {
	return (
		sseChunk(
			{
				role: "assistant",
				tool_calls: [{ index: 0, id: "call_probe", type: "function", function: { name, arguments: JSON.stringify(args) } }],
			},
			null,
		) +
		sseChunk({}, "tool_calls") +
		"data: [DONE]\n\n"
	);
}

function sseText(text: string): string {
	return sseChunk({ role: "assistant", content: text }, null) + sseChunk({}, "stop") + "data: [DONE]\n\n";
}

const server = createServer((req, res) => {
	let raw = "";
	req.on("data", (chunk) => {
		raw += String(chunk);
	});
	req.on("end", () => {
		const index = captured.length;
		let body: Record<string, unknown> = {};
		try {
			body = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			// 解析不了也照常记一条，断言会因此失败并暴露。
		}
		captured.push({ body });
		res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
		res.end(replyFor(index));
	});
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as AddressInfo).port;

/* ── 会话：自定义服务商 + 运行时构造 schema 的扩展工具 ───────────────── */

const catalog = await ModelCatalog.create();
const PROVIDER = "probe-so";
const MODEL_KEY = `${PROVIDER}/probe-model`;

await catalog.saveCustomProvider(
	{
		id: PROVIDER,
		name: "结构化输出探针",
		baseUrl: `http://127.0.0.1:${port}/v1`,
		api: "openai-completions",
		models: [
			{ id: "probe-model", name: "探针模型", contextWindow: 128000, maxTokens: 8192, reasoning: false, vision: false },
		],
	},
	"sk-probe-not-a-real-key",
);

/** 模拟「运行时才知道的字段清单」：schema 由数据构造，不写死在代码里。 */
const RUNTIME_FIELDS = [
	{ key: "title", kind: "string" },
	{ key: "tags", kind: "array" },
] as const;

function buildDynamicSchema(): TSchema {
	const properties: Record<string, TSchema> = {};
	for (const field of RUNTIME_FIELDS) {
		properties[field.key] =
			field.kind === "array"
				? Type.Array(Type.String(), { description: `${field.key} 列表` })
				: Type.String({ description: `${field.key} 文本` });
	}
	return Type.Object(properties, { description: "运行时构造的字段表" });
}

/** 原始 JSON Schema（非 TypeBox 构造）——B9 真正要接的形态。 */
const RAW_JSON_SCHEMA = {
	type: "object",
	properties: {
		verdict: { type: "string", description: "结论" },
		score: { type: "number", description: "分数" },
	},
	required: ["verdict", "score"],
	additionalProperties: false,
};

const executed: { readonly name: string; readonly params: unknown }[] = [];

/**
 * 场景 4 用：模型现场给了 schema（B9 的原始形态）时，我们能不能**中途**注册一个
 * 带该 schema 的工具并让它进请求？—— 注册表收不收，与白名单放不放，是两件事。
 */
let lateRegistered = false;

const probeExtension = (pi: ExtensionAPI): void => {
	pi.registerTool({
		name: "dynamic_record",
		label: "动态记录",
		description: "按运行时构造的 schema 返回一条结构化记录。",
		parameters: buildDynamicSchema(),
		constrainedSampling: { type: "json_schema", strict: "prefer" },
		async execute(_toolCallId, params) {
			executed.push({ name: "dynamic_record", params });
			// 中途注册（模拟「模型给了 schema，我们照着建工具」）：只注册，不激活 ——
			// 白名单是更外面的一道门，会话中途没有把它改宽的入口。
			if (!lateRegistered) {
				lateRegistered = true;
				pi.registerTool({
					name: "late_record",
					label: "中途记录",
					description: "会话中途注册的工具。",
					parameters: Type.Object({ late: Type.String() }),
					constrainedSampling: { type: "json_schema", strict: "prefer" },
					async execute() {
						executed.push({ name: "late_record", params: undefined });
						return { content: [{ type: "text" as const, text: "已记录" }], details: { ok: true }, terminate: true };
					},
				});
			}
			return { content: [{ type: "text" as const, text: "已记录" }], details: { ok: true }, terminate: true };
		},
	});
	pi.registerTool({
		name: "unsafe_record",
		label: "原始 schema 记录",
		description: "按原始 JSON Schema 返回结构化结果。",
		parameters: Type.Unsafe<{ verdict: string; score: number }>(RAW_JSON_SCHEMA as unknown as TSchema),
		constrainedSampling: { type: "json_schema", strict: "prefer" },
		async execute(_toolCallId, params) {
			executed.push({ name: "unsafe_record", params });
			return { content: [{ type: "text" as const, text: "已记录" }], details: { ok: true }, terminate: true };
		},
	});
	// 故意注册但**不列入白名单**：用来验证「白名单外的工具不进请求」。
	pi.registerTool({
		name: "never_whitelisted",
		label: "不该出现",
		description: "注册了但没进 toolsOverride，不该出现在请求里。",
		parameters: Type.Object({ x: Type.String() }),
		async execute() {
			executed.push({ name: "never_whitelisted", params: undefined });
			return { content: [{ type: "text" as const, text: "不该跑到这里" }], details: { ok: false } };
		},
	});
};

const cwd = join(workDir, "workspace", "probe-space");

const host = await SessionHost.create({
	catalog,
	modelKey: MODEL_KEY,
	cwd,
	isTempTask: false,
	sceneId: "work",
	interactionId: "craft",
	emit: () => {},
	resources: loadResources(getResourcesDir()),
	toolsOverride: ["dynamic_record", "unsafe_record"],
	extensions: [probeExtension],
});

async function runPrompt(text: string): Promise<void> {
	const timer = AbortSignal.timeout(30_000);
	await Promise.race([
		host.prompt(text),
		new Promise((_resolve, reject) => {
			timer.addEventListener("abort", () => reject(new Error(`prompt 超时：${text}`)), { once: true });
		}),
	]);
}

/** 请求体里某工具的线上定义。 */
function wireTool(index: number, name: string): { parameters?: unknown; strict?: unknown } | undefined {
	const tools = captured[index]?.body["tools"];
	if (!Array.isArray(tools)) return undefined;
	for (const tool of tools as { function?: { name?: string; parameters?: unknown; strict?: unknown } }[]) {
		if (tool.function?.name === name) return tool.function;
	}
	return undefined;
}

function wireToolNames(index: number): string[] {
	const tools = captured[index]?.body["tools"];
	if (!Array.isArray(tools)) return [];
	return (tools as { function?: { name?: string } }[]).map((t) => t.function?.name ?? "?").sort();
}

/* ── 场景 1：合法入参 + terminate ────────────────────────────────────── */

replyFor = (index) => (index === 0 ? sseToolCall("dynamic_record", { title: "季度总结", tags: ["a", "b"] }) : sseText("不该有第二轮"));
await runPrompt("写一条动态记录");

const s1Tools = wireToolNames(0);
check(
	"运行时构造的 schema 能注册并进请求（Type.Object 动态键 + Type.Unsafe 原始 schema）",
	s1Tools.join(",") === "dynamic_record,unsafe_record",
	`线上工具集 = [${s1Tools.join(", ")}]`,
);
check(
	"白名单外的工具不进请求（never_whitelisted 已注册但缺席）",
	!s1Tools.includes("never_whitelisted"),
	`注册了 3 个工具，线上只出现 ${s1Tools.length} 个`,
);

const dynamicWire = wireTool(0, "dynamic_record");
const dynamicParams = dynamicWire?.parameters as
	| { type?: string; required?: unknown; additionalProperties?: unknown; properties?: Record<string, { type?: string }> }
	| undefined;
check(
	"运行时构造的字段真的发给了模型",
	dynamicParams?.properties?.["title"]?.type === "string" && dynamicParams?.properties?.["tags"]?.type === "array",
	`线上 parameters.properties = ${JSON.stringify(dynamicParams?.properties)}`,
);
check(
	"strict 化生效（required 补全 + additionalProperties:false）",
	Array.isArray(dynamicParams?.required) &&
		(dynamicParams?.required as string[]).includes("title") &&
		dynamicParams?.additionalProperties === false,
	`required = ${JSON.stringify(dynamicParams?.required)}，additionalProperties = ${String(dynamicParams?.additionalProperties)}`,
);

const unsafeWire = wireTool(0, "unsafe_record");
check(
	"原始 JSON Schema 原样透传（Type.Unsafe）",
	JSON.stringify(unsafeWire?.parameters) === JSON.stringify(RAW_JSON_SCHEMA),
	`线上 = ${JSON.stringify(unsafeWire?.parameters)}`,
);

check(
	"自定义服务商这条链上真的发出 strict:true",
	dynamicWire?.strict === true && unsafeWire?.strict === true,
	`dynamic_record.strict = ${String(dynamicWire?.strict)}，unsafe_record.strict = ${String(unsafeWire?.strict)}`,
);

check(
	"terminate:true 让本轮在工具调用后结束（省一轮 LLM）",
	captured.length === 1 && executed.length === 1,
	`本轮共 ${captured.length} 次请求、工具执行 ${executed.length} 次`,
);
check(
	"工具拿到的是已解析的结构化参数",
	JSON.stringify(executed[0]?.params) === JSON.stringify({ title: "季度总结", tags: ["a", "b"] }),
	`execute 收到 ${JSON.stringify(executed[0]?.params)}`,
);

console.log(`INFO  场景 4：中途注册调用已执行=${String(lateRegistered)}\n`);

/* ── 场景 2：非法入参 → 工具错误回灌 ─────────────────────────────────── */

const before = captured.length;
replyFor = (index) => (index === before ? sseToolCall("dynamic_record", { tags: ["a"] }) : sseText("收到，已修正。"));
await runPrompt("再来一条（故意缺 title）");

const after = captured.length;
const followUp = JSON.stringify(captured[after - 1]?.body["messages"] ?? []);
check(
	"入参不合 schema → 不执行，回灌工具错误让模型重试",
	after === before + 2 && executed.length === 1 && followUp.includes("title"),
	`本轮 ${after - before} 次请求、工具执行仍为 ${executed.length} 次；回灌内容含 title 错误`,
);

/* ── 场景 4：中途注册的名字，白名单放不放行 ─────────────────────────── */

const lateOnWire = [before, after - 1].filter((i) => wireToolNames(i).includes("late_record"));
check(
	"中途注册的新名字进不了请求（创建时的白名单锁定）",
	lateRegistered && lateOnWire.length === 0,
	`中途注册调用已执行=${lateRegistered}；后续请求工具集 = ${[before, after - 1]
		.map((i) => `[${wireToolNames(i).join(", ")}]`)
		.join(" ")}`,
);

/* ── 场景 3：原始 JSON Schema 的合法调用 ─────────────────────────────── */

const before3 = captured.length;
replyFor = (index) => (index === before3 ? sseToolCall("unsafe_record", { verdict: "ok", score: 1 }) : sseText("不该有第二轮"));
await runPrompt("用原始 JSON Schema 交付");

check(
	"Type.Unsafe 工具可执行且效果同前（1 次请求、结构化参数）",
	captured.length === before3 + 1 &&
		executed.length === 2 &&
		JSON.stringify(executed[1]?.params) === JSON.stringify({ verdict: "ok", score: 1 }),
	`本轮 ${captured.length - before3} 次请求，execute 收到 ${JSON.stringify(executed[1]?.params)}`,
);

/* ── 场景 5：挑剔网关想关掉 strict，我们这条配置链允许吗 ─────────────── */

const { readModelsJson, upsertCustomProvider } = await import("../src/core/custom-providers.ts");
const modelsJsonPath = join(workDir, "models-json-probe.json");
const PICKY_INPUT = {
	id: "picky",
	name: "挑剔网关",
	baseUrl: "https://picky.example.com/v1",
	api: "openai-completions" as const,
	models: [{ id: "m1", name: "M1", contextWindow: 128000, maxTokens: 8192, reasoning: false, vision: false }],
};

// 用户手编：这个网关不吃 strict:true，关掉它。
writeFileSync(
	modelsJsonPath,
	JSON.stringify(
		{
			providers: {
				picky: {
					"x-kamibuddy": true,
					name: "挑剔网关",
					baseUrl: PICKY_INPUT.baseUrl,
					api: PICKY_INPUT.api,
					compat: { supportsStrictMode: false },
					models: [{ id: "m1", name: "M1" }],
				},
			},
		},
		null,
		2,
	),
);
// 模拟「用户回设置页改了 baseUrl 再保存」（upsert 是白名单重建）。
upsertCustomProvider(modelsJsonPath, { ...PICKY_INPUT, name: "挑剔网关（改名）" });
const pickyCompat = readModelsJson(modelsJsonPath).providers["picky"]?.compat;
check(
	"（已知缺口）手编的 compat.supportsStrictMode 会被设置页保存抹掉",
	pickyCompat?.["supportsStrictMode"] === undefined,
	`保存后该 provider 的 compat = ${JSON.stringify(pickyCompat)}（custom-providers 只白名单透传 supportsDeveloperRole / supportsReasoningEffort）`,
);

/* ── 汇总 ────────────────────────────────────────────────────────────── */

host.dispose();
server.close();
rmSync(workDir, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length > 0) {
	console.log("失败项：");
	for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
	process.exitCode = 1;
}

console.log(`
结论（B9 结构化输出的可行边界）：
  1. 运行时构造的 schema 可用：Type.Object 动态键与 Type.Unsafe 包原始 JSON Schema
     都能注册、进请求、按 schema 校验入参。
  2. 约束采样在自定义服务商这条链上真的生效：线上 function.strict = true，
     且 schema 被补全成严格形态（required 全列 + additionalProperties:false）。
     注意 detectCompat 对 moonshot/together/nvidia/Cloudflare 网关判为不支持 strict。
  3. 交付语义可用：execute 返回 terminate:true 后本轮结束，省一轮 LLM。
  4. 入参不合 schema 不执行工具，错误回灌让模型重试（pi 原有机制）。
  5. 白名单在会话创建时锁定（agent-session 的 _allowedToolNames 只在构造期赋值，
     无 setter），中途 registerTool 的新名字进不了请求 —— 意味着「模型现场给 schema、
     我们照着建一个受约束工具」这条路走不通；要 Schema 级保证，schema 必须在
     会话创建前定下来，否则只能退化为「工具收 schema + 数据，事后自行校验」。
`);
