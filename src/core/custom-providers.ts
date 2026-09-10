/**
 * 自定义服务商的读写：维护 pi 格式的 models.json。
 *
 * 本文件**不 import pi**，纯 fs + JSON。这样它可以单测，
 * 而 models.json 的字段形状由 pi 的 schema 决定（见下方 §字段依据）。
 *
 * 两条硬规则：
 *
 * 1. **不写 apiKey**。密钥走 auth.json（pi 以 0600 创建），
 *    已由 scripts/probe-custom-provider.ts 用例 C 实测确认：
 *    省略 apiKey + setRuntimeApiKey() 后模型正常可用、authStatus.source === "runtime"。
 *    配置文件里留明文密钥是我们主动避免的。
 *
 * 2. **保留用户手改的内容**。读改写而不是整体覆盖 ——
 *    用户可能自己往 models.json 里加过东西（pi 的文档就教这么做），
 *    我们只动自己那几个 provider 键。
 *
 * §字段依据（pi 0.85.1 的 model-config.ts schema）：
 *   ProviderConfigSchema: name? baseUrl? apiKey? api? oauth? headers? compat? models? modelOverrides?
 *   ModelDefinitionSchema: id name? api? baseUrl? reasoning? thinkingLevelMap? input? cost? contextWindow? maxTokens? compat?
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { CustomModelInput, CustomProviderInput } from "../shared/settings.ts";
import type { ThinkingLevel } from "../shared/session-events.ts";

/** models.json 里一个 provider 条目的形状（只含我们会写的字段）。 */
interface ModelsJsonProvider {
	name?: string;
	baseUrl?: string;
	api?: string;
	compat?: Record<string, boolean>;
	models?: ModelsJsonModel[];
	/** 我们从不写这个键，但读回来要原样保留（用户可能手工加过）。 */
	apiKey?: string;
	[extra: string]: unknown;
}

interface ModelsJsonModel {
	id: string;
	name?: string;
	reasoning?: boolean;
	/**
	 * 档位名 → 提供商侧取值 的映射（pi-ai 的形状：Partial<Record<ThinkingLevel, string|null>>，
	 * null 表示该档显式关闭）。我们从不经表单写它 —— 设置表单没有对应字段，
	 * 它只会来自用户手编 models.json（pi 文档教的用法）；白名单里显式声明它，
	 * 是为了 upsert 重建 models 数组时能按 id 继承（见 toModelsJsonModel），
	 * 否则自定义推理模型的档位会被 pi 裁成只剩 off。
	 */
	thinkingLevelMap?: Partial<Record<ThinkingLevel, string | null>>;
	input?: ("text" | "image")[];
	contextWindow?: number;
	maxTokens?: number;
	cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
	[extra: string]: unknown;
}

interface ModelsJson {
	providers: Record<string, ModelsJsonProvider>;
	[extra: string]: unknown;
}

/**
 * 标记位：写进 provider 条目，用于区分「我们建的」与「用户手写的」。
 *
 * 必须有这个标记：设置界面只允许编辑/删除自己建的条目。
 * 若靠「是否在 models.json 里」判断，就会把用户手写的配置也显示成可删，
 * 一旦误删且没有备份，用户的配置就没了。
 *
 * pi 的 schema 不是 additionalProperties:false（已核对），额外键会被忽略而非报错。
 */
const OWNER_KEY = "x-kamibuddy";

function isOwned(entry: ModelsJsonProvider): boolean {
	return entry[OWNER_KEY] === true;
}

/**
 * 读取 models.json。
 *
 * 文件不存在返回空结构；**内容坏了则抛错**，不静默重置 ——
 * 静默重置会悄悄丢掉用户手写的配置（AGENTS.md §7：让它响亮地失败）。
 */
export function readModelsJson(path: string): ModelsJson {
	let raw: string;
	try {
		raw = readFileSync(path, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { providers: {} };
		throw error;
	}

	if (raw.trim() === "") return { providers: {} };

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		throw new Error(
			`${path} 不是合法 JSON，已停止操作以免覆盖你的配置。` +
				`请修好或删除该文件后重试。原始错误：${error instanceof Error ? error.message : String(error)}`,
		);
	}

	if (typeof parsed !== "object" || parsed === null) {
		throw new Error(`${path} 的顶层应为对象，实际是 ${parsed === null ? "null" : typeof parsed}`);
	}

	const providers = (parsed as { providers?: unknown }).providers;
	if (providers === undefined) return { ...(parsed as object), providers: {} };
	if (typeof providers !== "object" || providers === null || Array.isArray(providers)) {
		throw new Error(`${path} 的 providers 字段应为对象`);
	}

	return { ...(parsed as object), providers: providers as Record<string, ModelsJsonProvider> };
}

function toModelsJsonModel(model: CustomModelInput, existing: ModelsJsonModel | undefined): ModelsJsonModel {
	return {
		id: model.id,
		name: model.name,
		reasoning: model.reasoning,
		/*
		 * thinkingLevelMap 不在表单模型里（CustomModelInput 没有该字段），
		 * 只能来自用户手编 models.json。upsert 是白名单重建，不继承就会把
		 * 手编的映射抹掉 —— 用户刚声明完自定义推理模型的档位，回设置页
		 * 改个 baseUrl 保存，map 就没了，档位恒被 pi 裁成 off 且无处可查。
		 * 按模型 id 从旧条目原样继承（形状即 pi 的形状，不做转换）。
		 */
		...(existing?.thinkingLevelMap !== undefined
			? { thinkingLevelMap: existing.thinkingLevelMap }
			: {}),
		input: model.vision ? ["text", "image"] : ["text"],
		contextWindow: model.contextWindow,
		maxTokens: model.maxTokens,
		// 自建服务商多为内网/本地部署，无从得知真实价格。
		// 明确写 0 而不是省略，避免 /cost 之类的统计显示成 NaN。
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	};
}

/**
 * 写入或更新一个自定义服务商，返回更新后的完整结构（便于调用方落盘后校验）。
 *
 * 覆盖同名条目前会检查归属：不允许覆盖用户手写的同 id 条目。
 */
export function upsertCustomProvider(path: string, input: CustomProviderInput): ModelsJson {
	const config = readModelsJson(path);
	const existing = config.providers[input.id];

	if (existing !== undefined && !isOwned(existing)) {
		throw new Error(`models.json 里已有手工配置的服务商「${input.id}」，请换一个 id 以免覆盖它。`);
	}

	const entry: ModelsJsonProvider = {
		[OWNER_KEY]: true,
		name: input.name,
		baseUrl: input.baseUrl,
		api: input.api,
		models: input.models.map((model) =>
			toModelsJsonModel(model, existing?.models?.find((m) => m.id === model.id)),
		),
	};

	// compat 只对 OpenAI 兼容接口有意义；其他协议写了会被 schema 的 union 拒掉。
	if (input.api === "openai-completions" && input.compat !== undefined) {
		const compat: Record<string, boolean> = {};
		if (input.compat.supportsDeveloperRole !== undefined) {
			compat["supportsDeveloperRole"] = input.compat.supportsDeveloperRole;
		}
		if (input.compat.supportsReasoningEffort !== undefined) {
			compat["supportsReasoningEffort"] = input.compat.supportsReasoningEffort;
		}
		if (Object.keys(compat).length > 0) entry.compat = compat;
	}

	const next: ModelsJson = {
		...config,
		providers: { ...config.providers, [input.id]: entry },
	};
	writeModelsJson(path, next);
	return next;
}

/** 删除一个自定义服务商。用户手写的条目拒绝删除。 */
export function deleteCustomProvider(path: string, providerId: string): ModelsJson {
	const config = readModelsJson(path);
	const existing = config.providers[providerId];
	if (existing === undefined) return config;
	if (!isOwned(existing)) {
		throw new Error(`服务商「${providerId}」是手工配置的，请直接编辑 ${path}。`);
	}

	const providers = { ...config.providers };
	delete providers[providerId];
	const next: ModelsJson = { ...config, providers };
	writeModelsJson(path, next);
	return next;
}

/** 列出由我们管理的 provider id，供设置界面判断哪些可编辑。 */
export function listOwnedProviderIds(path: string): readonly string[] {
	const config = readModelsJson(path);
	return Object.entries(config.providers)
		.filter(([, entry]) => isOwned(entry))
		.map(([id]) => id);
}

/** 还原成 CustomProviderInput，供「编辑」时回填表单。 */
export function readCustomProvider(path: string, providerId: string): CustomProviderInput | undefined {
	const entry = readModelsJson(path).providers[providerId];
	if (entry === undefined || !isOwned(entry)) return undefined;

	const api = entry.api;
	return {
		id: providerId,
		name: entry.name ?? providerId,
		baseUrl: entry.baseUrl ?? "",
		// 落盘的 api 是自由字符串，回填时收窄到界面支持的三种，未知一律当 OpenAI 兼容。
		api:
			api === "anthropic-messages" || api === "google-generative-ai" || api === "openai-completions"
				? api
				: "openai-completions",
		models: (entry.models ?? []).map((m) => ({
			id: m.id,
			name: m.name ?? m.id,
			contextWindow: m.contextWindow ?? 128000,
			maxTokens: m.maxTokens ?? 8192,
			reasoning: m.reasoning ?? false,
			vision: m.input?.includes("image") ?? false,
		})),
		...(entry.compat !== undefined
			? {
					compat: {
						...(entry.compat["supportsDeveloperRole"] !== undefined
							? { supportsDeveloperRole: entry.compat["supportsDeveloperRole"] }
							: {}),
						...(entry.compat["supportsReasoningEffort"] !== undefined
							? { supportsReasoningEffort: entry.compat["supportsReasoningEffort"] }
							: {}),
					},
				}
			: {}),
	};
}

function writeModelsJson(path: string, config: ModelsJson): void {
	mkdirSync(dirname(path), { recursive: true });
	// 缩进 2 空格：用户可能手工编辑这个文件，可读性优先于体积。
	writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
