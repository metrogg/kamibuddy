/**
 * 设置界面的领域类型。
 *
 * 这些类型**不含任何 pi 概念**（AGENTS.md §1.2）——pi 的 Provider / Model / AuthStatus
 * 在 core/model-catalog.ts 里被翻译成这里的形状，之后 UI 只认识这一套。
 * pi 升级改了字段名，只塌那一个适配文件。
 */

/**
 * 凭据来源。决定设置界面怎么向用户解释「这个 key 从哪来的」，
 * 也决定能不能在界面里删除它。
 *
 * 取值对齐 pi 的 AuthStatus.source，但语义由我们定义：
 *   stored / runtime  —— 存在 auth.json，界面可删
 *   environment       —— 来自环境变量，界面只能提示、不能删
 *   models_json_*     —— 写在 models.json 里，界面引导用户改存 auth.json
 *   subscription      —— OAuth 订阅登录（Claude Pro、ChatGPT Plus 等）
 */
export type CredentialSource =
	| "stored"
	| "runtime"
	| "environment"
	| "fallback"
	| "models_json_key"
	| "models_json_command"
	| "subscription";

/** 服务商在设置界面的一行。 */
export interface ProviderInfo {
	readonly id: string;
	readonly name: string;
	/**
	 * 是否已配好认证。
	 *
	 * 必须显式区分：实测发现**未配置凭据的服务商，其模型照样出现在模型列表里**
	 * （probe-custom-provider.ts 用例 B）。若不区分，用户会选到一个点了就报错的模型。
	 */
	readonly configured: boolean;
	readonly source: CredentialSource | undefined;
	/**
	 * 凭据来源的补充说明。当 source 是 environment 时，这里是环境变量名
	 * （如 `DEEPSEEK_API_KEY`），界面据此告诉用户「这个 key 是环境带进来的、界面删不掉」。
	 *
	 * 语义**不是**「该填哪个环境变量」：pi 的环境变量映射表（env-api-keys.ts）
	 * 没有从包根导出，拿不到；而设置界面本来就有输入框，用户不需要知道变量名。
	 */
	readonly credentialLabel: string | undefined;
	/** 是否为用户自建（写在我们托管的 models.json 里）。自建的才能编辑与删除。 */
	readonly custom: boolean;
	readonly modelCount: number;
}

/** 模型在选择器里的一项。 */
export interface ModelInfo {
	readonly id: string;
	readonly providerId: string;
	readonly name: string;
	readonly contextWindow: number;
	readonly maxTokens: number;
	/** 支持思考/推理档位。 */
	readonly reasoning: boolean;
	/** 支持图片输入。 */
	readonly vision: boolean;
	/**
	 * 该模型所属服务商是否已配置认证。
	 * 冗余存一份是为了让 UI 不必自己做 join —— 列表渲染时直接置灰。
	 */
	readonly available: boolean;
}

/** 技能页一次性拉取的内容。 */
export interface SkillsSnapshot {
	/**
	 * 全量技能（含被用户停用的，逐项带 `enabled`）—— 技能页必须看到全量，
	 * 否则开关没有落点，「停用还能再启用」这条就无从操作。
	 */
	readonly skills: readonly SkillInfo[];
	/**
	 * 用户自装技能的落盘目录（导入的默认目标）。「打开技能目录」直接 openArtifact 它 ——
	 * 高级用户可以绕过导入，把技能文件夹手工放进去。
	 */
	readonly userSkillsDir: string;
	/** 已启用技能数（`skills` 里 `enabled` 为真的条数）。开关口径，见 core/skills-cost.ts。 */
	readonly enabledCount: number;
	/**
	 * 技能清单段（系统提示词里常驻的那一段）的 token 估算。
	 * **不是整条提示词的 token** —— 口径与算法见 core/skills-cost.ts；由 daemon 用与真实
	 * 注入同一份组装逻辑算出，渲染层只显示、不重算。
	 */
	readonly skillsTokens: number;
	/** 超过警戒线时的提示文案（未超则不带该字段）。阈值与文案见 core/skills-cost.ts。 */
	readonly warning?: string;
}

/** 技能在技能页面的一行。 */
export interface SkillInfo {
	readonly name: string;
	readonly description: string;
	/** SKILL.md 绝对路径。模型按需加载全文的入口，展示给用户便于排查。 */
	readonly filePath: string;
	/** 随应用内置（resources/skills/）还是用户自装（~/.kamibuddy/skills/ 等）。 */
	readonly origin: "builtin" | "user";
	/** frontmatter 声明仅限手动 /skill:name 触发，不出现在模型提示词里。 */
	readonly disableModelInvocation: boolean;
	/**
	 * frontmatter 的 `user-invocable`（缺省 true）。false = 不出现在 `/` 菜单，
	 * 但仍可被模型或其它技能按路径引用。
	 *
	 * 与 `disableModelInvocation` 是**两个独立**的可见性开关（一个收用户入口、
	 * 一个收模型入口），两者都命中才是纯内部技能。
	 */
	readonly userInvocable: boolean;
	/**
	 * 技能声明的版本。内置技能取自其 SKILL.md frontmatter 的 `version`；
	 * 自装技能同样以 SKILL.md 为准（它是技能自身的真源，用户可能手改过），
	 * 安装时写下的 `_installed.json` 只在 SKILL.md 没声明时兜底。
	 *
	 * 没声明就**不带这个字段**（不填默认值）——卡片上留白，不写「未知」那种占位噪声。
	 */
	readonly version?: string;
	/**
	 * 导入时刻（epoch ms）。**只对「经技能页导入」的技能有值**：它来自导入时写进技能目录的
	 * `_installed.json`；用户手工把文件夹放进技能目录的技能没有这份记录，不带该字段。
	 */
	readonly installedAt?: number;
	/**
	 * 导入时的来源路径（文件夹来源是那个文件夹，单文件来源是那个 .md）。
	 * 同样只对经导入安装的技能有值 —— 手工放置的技能无从得知来源。
	 */
	readonly sourcePath?: string;
	/**
	 * 是否启用（用户级开关，`preferences.json` 的 `skillOverrides`，缺省启用）。
	 *
	 * 快照里的**全量**列表逐项带它：被停用的技能仍留在列表里（否则开关没有落点），
	 * 靠这个标记置灰。列表来源是 daemon 的启用过滤单一出口（spec: 技能清单来源单一出口）。
	 */
	readonly enabled: boolean;
}

/** 设置界面一次性拉取的全部内容。 */
export interface SettingsSnapshot {
	readonly providers: readonly ProviderInfo[];
	readonly models: readonly ModelInfo[];
	/** 当前选中的模型，形如 `provider/model`。未选则为 undefined。 */
	readonly activeModelId: string | undefined;
	/** 凭据与自定义配置的落盘目录，显示给用户便于排障。 */
	readonly configDir: string;
	/** 模型目录加载错误（如 models.json 格式错）。undefined 表示正常。 */
	readonly error: string | undefined;
}

/* ── 自定义服务商 ────────────────────────────────────────────────── */

/**
 * 自定义服务商支持的 API 协议。
 *
 * 这三个是 pi 实际支持的（models.md 记载）。不做成开放字符串：
 * 填错协议的报错发生在真正请求时，很难排查，不如在界面上就限死。
 */
export type CustomApi = "openai-completions" | "anthropic-messages" | "google-generative-ai";

/** 用户自建的服务商配置。密钥不在这里——它走 auth.json。 */
export interface CustomProviderInput {
	/** 唯一 id，kebab-case。既是 auth.json 的键，也是模型的 provider 前缀。 */
	readonly id: string;
	readonly name: string;
	/** 完整基址，如 https://api.deepseek.com/v1。 */
	readonly baseUrl: string;
	readonly api: CustomApi;
	/**
	 * 认证头形态（对齐 Claude Code 的 ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN 之分）。
	 *
	 * 省略 = `x-api-key`（Anthropic 官方默认）。`bearer` = `Authorization: Bearer <key>`
	 * —— Claude Code 中转/代理网关按这个头校验。pi 的 provider 配置原生支持
	 * （`authHeader: true`，见 model-config schema）：key 照旧走 auth.json 运行时
	 * 解析，pi 自己组装 Bearer，密钥不落第二份盘。
	 * 仅对 anthropic-messages 有意义；openai-completions 天然 Bearer，无需此项。
	 */
	readonly authHeader?: boolean;
	readonly models: readonly CustomModelInput[];
	/**
	 * OpenAI 兼容服务的兼容性开关。
	 *
	 * 很多自建/本地服务（Ollama、vLLM、SGLang、部分国产网关）不认 `developer` 角色
	 * 或 `reasoning_effort` 参数，此时必须关掉，否则请求直接 400。
	 * 仅对 openai-completions 有意义。
	 */
	readonly compat?: {
		readonly supportsDeveloperRole?: boolean;
		readonly supportsReasoningEffort?: boolean;
	};
}

export interface CustomModelInput {
	readonly id: string;
	readonly name: string;
	readonly contextWindow: number;
	readonly maxTokens: number;
	readonly reasoning: boolean;
	readonly vision: boolean;
}

/** 校验结果。界面据此决定能不能保存，并把原因显示在字段旁。 */
export interface ValidationResult {
	readonly ok: boolean;
	/** 字段名 → 错误原因。字段名与 CustomProviderInput 的键对应。 */
	readonly errors: Readonly<Record<string, string>>;
}

/**
 * 校验自定义服务商配置。
 *
 * 放在 shared/ 是有意的：渲染进程即时校验（用户打字就给反馈），
 * daemon 落盘前再校验一次（防绕过）。同一份规则，两处复用，不会漂移。
 */
export function validateCustomProvider(input: CustomProviderInput): ValidationResult {
	const errors: Record<string, string> = {};

	if (!/^[a-z][a-z0-9-]*$/.test(input.id)) {
		errors["id"] = "只能用小写字母、数字和连字符，且以字母开头";
	}
	if (input.name.trim() === "") {
		errors["name"] = "请填写显示名称";
	}

	// 必须是 http(s) 绝对地址。相对地址或缺协议头会在请求时才炸，很难排查。
	let parsed: URL | undefined;
	try {
		parsed = new URL(input.baseUrl);
	} catch {
		parsed = undefined;
	}
	if (parsed === undefined) {
		errors["baseUrl"] = "请填写完整地址，如 https://api.example.com/v1";
	} else if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		errors["baseUrl"] = "只支持 http 或 https";
	}

	if (input.models.length === 0) {
		errors["models"] = "至少填一个模型";
	} else if (input.models.some((m) => m.id.trim() === "")) {
		errors["models"] = "模型 ID 不能为空";
	} else {
		const ids = input.models.map((m) => m.id.trim());
		if (new Set(ids).size !== ids.length) errors["models"] = "模型 ID 不能重复";
	}

	return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * 校验「往已有服务商追加一个模型」的输入（添加模型弹层的预置路径）。
 *
 * 返回错误文案列表而不是 ValidationResult：这里没有字段级回显位置
 * （单条模型行），列表直接拼进禁用提示。放在 shared/ 与
 * validateCustomProvider 同一考虑 —— 渲染进程即时校验，daemon 落盘前再验防绕过。
 *
 * 数值用 `!(x > 0)` 而不是 `x <= 0`：输入框清空时 Number("") 是 0、
 * 非法输入是 NaN，两者都必须拦下 —— pi 在 compose 时对 ≤0 直接抛错
 * （provider-composer.modelFromJson），到那时再炸很难定位是哪个字段。
 */
export function validateCustomModel(model: CustomModelInput): readonly string[] {
	const errors: string[] = [];
	if (model.id.trim() === "") errors.push("请填写模型 ID");
	if (!(model.contextWindow > 0)) errors.push("上下文窗口需大于 0");
	if (!(model.maxTokens > 0)) errors.push("单次最大输出需大于 0");
	return errors;
}

/* ── 联网搜索 ────────────────────────────────────────────────────── */

/**
 * 联网搜索支持的服务商。
 *
 * 这张表放 shared/ 是有意的：core 的 HTTP 实现、daemon 的落盘校验、
 * 设置页的下拉渲染用同一份数据，不会出现「设置页能选、工具说未知」。
 * 注意：这是**纯数据表**，行为在 core/web-search.ts 里（provider → HTTP 契约），
 * 新增服务商 = 两处各加一条（表 + 实现）。
 */
export interface WebSearchProviderInfo {
	readonly id: string;
	readonly name: string;
	readonly description: string;
}

export const WEB_SEARCH_PROVIDERS: readonly WebSearchProviderInfo[] = [
	{ id: "bocha", name: "博查", description: "国内直连，中文搜索质量好（推荐）" },
	{ id: "tavily", name: "Tavily", description: "海外服务，免费额度，但国内网络常连不上" },
	{ id: "brave", name: "Brave", description: "海外搜索引擎，默认隐私优先" },
	{ id: "bing", name: "Bing", description: "微软搜索 API，需要 Azure 订阅" },
] as const;

export type WebSearchProviderId = (typeof WEB_SEARCH_PROVIDERS)[number]["id"];

/** 设置页读回的联网搜索配置状态。**不含 key 本身**（与模型凭据同策略：不回显）。 */
export interface WebSearchConfigInfo {
	readonly providerId: WebSearchProviderId | undefined;
	readonly hasKey: boolean;
}

/** 保存联网搜索配置的入参。 */
export interface WebSearchConfigInput {
	readonly providerId: WebSearchProviderId;
	readonly apiKey: string;
}

/** 校验 provider id 是否是注册表中的合法值（设置页与 daemon 共用）。 */
export function isWebSearchProviderId(value: string): value is WebSearchProviderId {
	return WEB_SEARCH_PROVIDERS.some((p) => p.id === value);
}

/** 「测试连接」的结果。ok=false 时 message 是中文原因，直接展示给用户。 */
export interface WebSearchTestResult {
	readonly ok: boolean;
	readonly message: string;
	/** 成功时的返回条数（证明服务商真实应答）。 */
	readonly count?: number;
}

/**
 * 模型连通性测试的结果（设置-模型页卡片上的「测试」按钮）。
 * ok=false 时 error 是面向用户的单行文案（不含 stack、不含 key），直接展示。
 * 实现侧在 core/model-probe.ts；类型放这里是因为 renderer 只能 import shared。
 */
export interface ModelProbeResult {
	readonly ok: boolean;
	/** 请求往返耗时（仅成功时有意义）。 */
	readonly latencyMs?: number;
	readonly error?: string;
}

/* ── 回复风格 ──────────────────────────────────────────────────── */

/** 回复风格选项（设置页「回复风格」选择器的一项）。正文不经 IPC，组装时 daemon 自取。 */
export interface StyleOption {
	readonly id: string;
	/** 中文名（如「专业严谨」）。 */
	readonly label: string;
}

/** 设置页读回的回复风格配置：全部可选项 + 当前值（空串 = 关闭）。 */
export interface StyleConfigInfo {
	readonly styles: readonly StyleOption[];
	/** 当前风格 id；空串 = 关闭风格注入。未配置时 daemon 回默认风格（professional）。 */
	readonly styleId: string;
}
