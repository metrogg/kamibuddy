/**
 * 探针：自定义 provider 的密钥能不能存进 auth.json，而不是明文写进 models.json？
 *
 * 为什么必须实测：这决定设置界面的安全设计。
 *   - 若能：models.json 只存「连什么」（baseUrl / api / models），
 *     密钥走 setRuntimeApiKey() 落进 auth.json（pi 以 0600 创建，仅用户可读）。
 *   - 若不能：密钥只能明文写进 models.json，我们就得自己做加密存储，
 *     或退而用环境变量插值（"$MY_KEY"），体验差一档。
 *
 * 源码读出来的信号是矛盾的，所以不能靠猜：
 *   model-config.ts:199        apiKey 是 Type.Optional  → 像是可以省略
 *   provider-composer.ts:451   !apiKey && !oauth 就抛
 *                              "no authentication method configured" → 像是不能省略
 *
 * 用法：npx tsx scripts/probe-custom-provider.ts
 * 不产生网络请求，不需要真实 key。
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export {};

const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");

const workDir = mkdtempSync(join(tmpdir(), "kami-probe-"));
const authPath = join(workDir, "auth.json");
const modelsPath = join(workDir, "models.json");
const modelsStorePath = join(workDir, "models-store.json");

/** 用一个不存在的本地端口，确保任何意外的网络尝试都会立刻失败而不是挂住。 */
const BASE_URL = "http://127.0.0.1:9/v1";
const PROVIDER_ID = "kami-custom";
const MODEL_ID = "test-model";

function writeModelsJson(includeApiKey: boolean): void {
	writeFileSync(
		modelsPath,
		JSON.stringify(
			{
				providers: {
					[PROVIDER_ID]: {
						baseUrl: BASE_URL,
						api: "openai-completions",
						...(includeApiKey ? { apiKey: "placeholder-key" } : {}),
						models: [{ id: MODEL_ID, name: "探针模型" }],
					},
				},
			},
			null,
			2,
		),
	);
}

/**
 * 每个用例都新建 runtime：provider 组合发生在 create() 期间。
 *
 * 返回类型走 Awaited<ReturnType<...>> 而不是 InstanceType：
 * ModelRuntime 的构造函数是 private，InstanceType 拿不到它。
 */
async function createRuntime(): Promise<Awaited<ReturnType<typeof ModelRuntime.create>>> {
	return ModelRuntime.create({
		authPath,
		modelsPath,
		modelsStorePath,
		// 关掉网络，探针只关心「组合与凭据解析」，不关心目录刷新。
		allowModelNetwork: false,
		refreshOnCreate: false,
	});
}

interface Outcome {
	readonly label: string;
	readonly composed: boolean;
	readonly modelVisible: boolean;
	readonly detail: string;
}

const outcomes: Outcome[] = [];

async function probe(label: string, includeApiKey: boolean, storeKeyInAuthJson: boolean): Promise<void> {
	writeModelsJson(includeApiKey);
	// 每个用例都从干净的 auth.json 开始，避免上一个用例的凭据串味。
	writeFileSync(authPath, "{}");

	try {
		const runtime = await createRuntime();

		if (storeKeyInAuthJson) {
			// 这是关键动作：把密钥写进 pi 自己的凭据库（0600），而不是配置文件。
			await runtime.setRuntimeApiKey(PROVIDER_ID, "sk-probe-not-a-real-key");
		}

		const provider = runtime.getProvider(PROVIDER_ID);
		const composeError = runtime.getError();
		const model = runtime.getModel(PROVIDER_ID, MODEL_ID);
		const hasAuth = runtime.hasConfiguredAuth(PROVIDER_ID);
		const authStatus = runtime.getProviderAuthStatus(PROVIDER_ID);

		outcomes.push({
			label,
			composed: provider !== undefined,
			modelVisible: model !== undefined,
			detail:
				`provider=${provider !== undefined ? "有" : "无"} ` +
				`model=${model !== undefined ? "有" : "无"} ` +
				`hasConfiguredAuth=${hasAuth} ` +
				`authStatus=${JSON.stringify(authStatus)}` +
				(composeError !== undefined ? ` runtimeError=${composeError}` : ""),
		});
	} catch (error) {
		outcomes.push({
			label,
			composed: false,
			modelVisible: false,
			detail: `抛错：${error instanceof Error ? error.message : String(error)}`,
		});
	}
}

// 三个用例，覆盖设置界面可能采用的三种存法。
await probe("A. models.json 带 apiKey（明文，基线）", true, false);
await probe("B. models.json 不带 apiKey，也不存凭据", false, false);
await probe("C. models.json 不带 apiKey，密钥存 auth.json ← 我们想要的", false, true);

console.log(`临时目录：${workDir}\n`);
for (const o of outcomes) {
	console.log(`${o.label}`);
	console.log(`   ${o.detail}\n`);
}

const wanted = outcomes.find((o) => o.label.startsWith("C."));
console.log("结论：");
if (wanted?.modelVisible === true) {
	console.log("  自定义 provider 可以省略 models.json 的 apiKey，密钥走 auth.json。");
	console.log("  → 设置界面按此设计：配置文件不留明文密钥。");
} else {
	console.log("  自定义 provider 无法只靠 auth.json 的凭据工作。");
	console.log("  → 设置界面需改用环境变量插值（\"$VAR\"）或自建加密存储。");
}

rmSync(workDir, { recursive: true, force: true });
