/**
 * 模型目录适配层：pi 的 ModelRuntime → 我们的领域类型。
 *
 * 这是 ARCHITECTURE.md §4.7 「pi SDK 边界」那道缝的实体之一。
 * **pi 的 Provider / Model / AuthStatus 类型止步于本文件**，
 * 出口只有 shared/settings.ts 里的形状。pi 改字段名只塌这里。
 *
 * 凭据处理原则：持久化由我们写 auth.json（core/api-keys.ts，pi 的文件格式），
 * `runtime.setRuntimeApiKey` 只负责同步本进程 —— 它是 non-persistent overlay，
 * 单独用它会在 daemon 重启后丢 key（用户实测踩到过）。文件权限 0600 由我们的
 * 写入侧保证，与 pi 的 AUTH_FILE_WRITE_OPTIONS 一致。
 */

import { mkdirSync } from "node:fs";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type {
	CredentialSource,
	CustomProviderInput,
	ModelInfo,
	ProviderInfo,
	SettingsSnapshot,
} from "../shared/settings.ts";
import { validateCustomProvider } from "../shared/settings.ts";
import { removeApiKey as removeApiKeyFromFile, writeApiKey } from "./api-keys.ts";
import { getAuthPath, getConfigDir, getModelsPath, getModelsStorePath } from "./config-paths.ts";
import { deleteCustomProvider, listOwnedProviderIds, readCustomProvider, upsertCustomProvider } from "./custom-providers.ts";

/** 模型的全局唯一标识，形如 `deepseek/deepseek-chat`。 */
export function toModelKey(providerId: string, modelId: string): string {
	return `${providerId}/${modelId}`;
}

/**
 * 拆分模型标识。
 *
 * 只在第一个斜杠处切：模型 id 本身可能含斜杠
 * （如 openrouter 的 `anthropic/claude-sonnet-4`）。
 */
export function parseModelKey(key: string): { providerId: string; modelId: string } | undefined {
	const at = key.indexOf("/");
	if (at <= 0 || at === key.length - 1) return undefined;
	return { providerId: key.slice(0, at), modelId: key.slice(at + 1) };
}

export class ModelCatalog {
	private constructor(
		private readonly runtime: ModelRuntime,
		private readonly modelsPath: string,
	) {}

	static async create(): Promise<ModelCatalog> {
		// pi 会往这些路径写文件，先确保目录存在（我们自选的路径，责任在我们）。
		mkdirSync(getConfigDir(), { recursive: true });

		const runtime = await ModelRuntime.create({
			authPath: getAuthPath(),
			modelsPath: getModelsPath(),
			modelsStorePath: getModelsStorePath(),
			// 启动不联网刷目录：内置目录已够用，联网会拖慢 daemon 启动、
			// 内网环境还可能卡到超时。用户在设置界面点「刷新」时再联网。
			allowModelNetwork: false,
		});

		return new ModelCatalog(runtime, getModelsPath());
	}

	/** 设置界面一次性拉取的全部内容。技能清单恒为空数组，由 daemon 展开覆盖（见 INVOKE.settingsSnapshot）。 */
	snapshot(activeModelKey: string | undefined): SettingsSnapshot {
		const owned = new Set(listOwnedProviderIds(this.modelsPath));
		const providers = this.runtime.getProviders().map((provider) => this.toProviderInfo(provider.id, provider.name, owned));

		// 已配置的排前面：pi 内置约 40 家，不排序的话用户要在一长串里翻找自己配过的。
		const sorted = [...providers].sort((a, b) => {
			if (a.configured !== b.configured) return a.configured ? -1 : 1;
			if (a.custom !== b.custom) return a.custom ? -1 : 1;
			return a.name.localeCompare(b.name, "zh-CN");
		});

		const configured = new Set(sorted.filter((p) => p.configured).map((p) => p.id));
		const models = this.runtime.getModels().map((model) => this.toModelInfo(model, configured));

		return {
			providers: sorted,
			models,
			activeModelId: activeModelKey,
			configDir: getConfigDir(),
			error: this.runtime.getError(),
		};
	}

	/**
	 * 存入某家服务商的 API Key。
	 *
	 * 先落盘（api-keys.ts，pi 的 auth.json 格式）再同步本进程 ——
	 * 只调 runtime.setRuntimeApiKey 是不够的：那是 non-persistent overlay
	 * （RuntimeCredentials 自述），daemon 一重启 key 就丢（用户实测踩到过）。
	 */
	async setApiKey(providerId: string, apiKey: string): Promise<void> {
		const trimmed = apiKey.trim();
		if (trimmed === "") throw new Error("API Key 不能为空");
		writeApiKey(getAuthPath(), providerId, trimmed);
		await this.runtime.setRuntimeApiKey(providerId, trimmed);
	}

	/**
	 * 删除某家服务商的 API Key。
	 * 只能删 auth.json 里的；环境变量来源的删不掉（设置页会如实说明）。
	 */
	async removeApiKey(providerId: string): Promise<void> {
		removeApiKeyFromFile(getAuthPath(), providerId);
		// 本来就没存过运行时覆盖是正常情况，不该让删除整体失败。
		await this.runtime.removeRuntimeApiKey(providerId).catch(() => {});
	}

	/**
	 * 新增或更新自定义服务商。
	 *
	 * apiKey 是可选的：不填表示复用已存的凭据（编辑场景常见 ——
	 * 用户只想改 baseUrl，不该被迫重新输入密钥）。
	 */
	async saveCustomProvider(input: CustomProviderInput, apiKey?: string): Promise<void> {
		// 渲染进程已经校验过一次；这里再校验是防绕过（同一份规则，见 shared/settings.ts）。
		const validation = validateCustomProvider(input);
		if (!validation.ok) {
			throw new Error(`配置有误：${Object.values(validation.errors).join("；")}`);
		}

		// 不许覆盖 pi 内置服务商：同名会让内置目录被自定义配置遮蔽，
		// 用户很难理解为什么内置的那家忽然不工作了。
		const builtinIds = new Set(this.runtime.getProviders().map((p) => p.id));
		const owned = new Set(listOwnedProviderIds(this.modelsPath));
		if (builtinIds.has(input.id) && !owned.has(input.id)) {
			throw new Error(`「${input.id}」与内置服务商同名，请换一个 id。`);
		}

		upsertCustomProvider(this.modelsPath, input);

		// 让 pi 重读 models.json，新 provider 才会出现在目录里。
		await this.runtime.refresh({ allowNetwork: false });

		if (apiKey !== undefined && apiKey.trim() !== "") {
			await this.runtime.setRuntimeApiKey(input.id, apiKey.trim());
		}
	}

	/** 删除自定义服务商。凭据一并清掉，避免残留在 auth.json 里。 */
	async deleteCustomProvider(providerId: string): Promise<void> {
		deleteCustomProvider(this.modelsPath, providerId);
		// 先删凭据再刷新：provider 消失后 removeRuntimeApiKey 可能因找不到目标而失败。
		await this.runtime.removeRuntimeApiKey(providerId).catch(() => {
			// 本来就没存过凭据是正常情况，不该让删除整体失败。
		});
		await this.runtime.refresh({ allowNetwork: false });
	}

	/** 读回自定义服务商配置，供编辑表单回填。 */
	readCustomProvider(providerId: string): CustomProviderInput | undefined {
		return readCustomProvider(this.modelsPath, providerId);
	}

	/** 联网刷新模型目录。用户主动点击时才调——启动时不联网。 */
	async refreshCatalog(): Promise<void> {
		const result = await this.runtime.refresh({ allowNetwork: true });
		if (result.errors.size > 0) {
			const detail = [...result.errors.entries()]
				.map(([id, error]) => `${id}: ${error instanceof Error ? error.message : String(error)}`)
				.join("；");
			throw new Error(`部分服务商刷新失败 —— ${detail}`);
		}
	}

	/** 校验某个模型标识当前是否真的可用，供切换模型前把关。 */
	isUsable(modelKey: string): boolean {
		const parsed = parseModelKey(modelKey);
		if (parsed === undefined) return false;
		if (this.runtime.getModel(parsed.providerId, parsed.modelId) === undefined) return false;
		return this.runtime.getProviderAuthStatus(parsed.providerId).configured;
	}

	/** 取 pi 的原生 Model 对象，供会话宿主使用。pi 类型只在 core/ 内部流转。 */
	resolveModel(modelKey: string): ReturnType<ModelRuntime["getModel"]> {
		const parsed = parseModelKey(modelKey);
		if (parsed === undefined) return undefined;
		return this.runtime.getModel(parsed.providerId, parsed.modelId);
	}

	/** 暴露 runtime 供会话宿主创建 AgentSession。仅限 core/ 内部使用。 */
	get modelRuntime(): ModelRuntime {
		return this.runtime;
	}

	private toProviderInfo(id: string, name: string, owned: ReadonlySet<string>): ProviderInfo {
		const status = this.runtime.getProviderAuthStatus(id);

		// OAuth 订阅（Claude Pro、ChatGPT Plus 等）在 UI 上要区别对待：
		// 不能用输入框改，得引导用户走登录流程。
		const source: CredentialSource | undefined = this.runtime.isUsingSubscription(id)
			? "subscription"
			: status.source;

		return {
			id,
			name,
			configured: status.configured,
			source,
			credentialLabel: status.label,
			custom: owned.has(id),
			modelCount: this.runtime.getModels(id).length,
		};
	}

	private toModelInfo(
		model: { id: string; name: string; provider: string; contextWindow: number; maxTokens: number; reasoning: boolean; input: readonly string[] },
		configuredProviders: ReadonlySet<string>,
	): ModelInfo {
		/*
		 * 推理强度档位不在此快照暴露（与 tasks.md 原文的有意偏离）：
		 * UI 只需要**当前会话所用模型**的可用档位，那一份经 SessionState
		 * （availableThinkingLevels，pi getAvailableThinkingLevels() 现读）下发，
		 * 档位裁剪逻辑单一权威在 pi —— 快照若再带一份全量模型的档位表，
		 * 就是第二份需要与 pi 对齐的数据。
		 *
		 * thinkingLevelMap 也无需在此转换：内置模型定义来自 pi-ai 自带数据
		 * （generate-models.ts 生成的注册表），map 天然在 pi 的 Model 对象上，
		 * 由各 provider 流消费（model.thinkingLevelMap?.[level]）；
		 * 自定义模型的 map 透传在 custom-providers.ts（models.json 白名单继承）。
		 */
		return {
			id: model.id,
			providerId: model.provider,
			name: model.name,
			contextWindow: model.contextWindow,
			maxTokens: model.maxTokens,
			reasoning: model.reasoning,
			vision: model.input.includes("image"),
			// 实测发现未配凭据的服务商其模型照样出现在目录里
			// （scripts/probe-custom-provider.ts 用例 B），所以必须显式标注可用性，
			// 否则用户会选到一个点了就报错的模型。
			available: configuredProviders.has(model.provider),
		};
	}
}
