/**
 * 设置页：模型与服务商配置。
 *
 * 设计前提（都由 scripts/probe-custom-provider.ts 实测确认）：
 *   1. 密钥存 pi 的 auth.json（0600），本页只负责收集、不落盘、不回显。
 *   2. **未配凭据的服务商，其模型照样在目录里**，所以必须显式区分可用性，
 *      否则用户会选到一个点了才报错的模型。
 *   3. 自定义服务商的密钥同样走 auth.json，models.json 不留明文。
 *
 * 本页只 import @shared（AGENTS.md §1.3），一个 pi 概念都不认识。
 */

import { useCallback, useEffect, useState } from "react";
import type {
	CustomProviderInput,
	ModelInfo,
	ProviderInfo,
	SettingsSnapshot,
	WebSearchConfigInfo,
	WebSearchProviderId,
	WebSearchTestResult,
} from "@shared/settings.ts";
import { WEB_SEARCH_PROVIDERS, validateCustomProvider } from "@shared/settings.ts";
import { IconBack, IconCheck, IconClose, IconEdit, IconKey, IconPlus, IconRefresh, IconTrash } from "./icons.tsx";

/** 凭据来源 → 用户能看懂的说明。 */
function sourceLabel(provider: ProviderInfo): string {
	switch (provider.source) {
		case "subscription":
			return "已用订阅账号登录";
		case "environment":
			// credentialLabel 此时是环境变量名，告诉用户「界面删不掉」的原因。
			return `来自环境变量${provider.credentialLabel === undefined ? "" : `（${provider.credentialLabel}）`}`;
		case "models_json_key":
		case "models_json_command":
			return "写在 models.json 里";
		case "stored":
		case "runtime":
			return "已保存 API Key";
		case "fallback":
			return "使用默认凭据";
		default:
			return "未配置";
	}
}

/** 只有存在 auth.json 里的凭据能在界面删除。 */
function canRemoveKey(provider: ProviderInfo): boolean {
	return provider.source === "stored" || provider.source === "runtime";
}

/* ── 服务商行 ────────────────────────────────────────────────────── */

interface ProviderRowProps {
	readonly provider: ProviderInfo;
	readonly busy: boolean;
	readonly onSaveKey: (providerId: string, key: string) => void;
	readonly onRemoveKey: (providerId: string) => void;
	readonly onEditCustom: (providerId: string) => void;
	readonly onDeleteCustom: (providerId: string) => void;
}

function ProviderRow({
	provider,
	busy,
	onSaveKey,
	onRemoveKey,
	onEditCustom,
	onDeleteCustom,
}: ProviderRowProps): React.JSX.Element {
	const [draft, setDraft] = useState("");
	const [open, setOpen] = useState(false);

	const submit = (): void => {
		const key = draft.trim();
		if (key === "") return;
		// 立刻清空：密钥不在 UI 里留存，避免切页后仍显示在输入框
		setDraft("");
		setOpen(false);
		onSaveKey(provider.id, key);
	};

	return (
		<div className="provider-row">
			<div className="provider-main">
				<span className={`provider-dot${provider.configured ? " on" : ""}`} />
				<span className="provider-name">{provider.name}</span>
				{provider.custom && <span className="provider-tag">自建</span>}
				<span className="provider-meta">
					{sourceLabel(provider)} · {provider.modelCount} 个模型
				</span>
				<span className="bar-spacer" />

				{provider.source === "subscription" ? (
					// 订阅登录（Claude Pro / ChatGPT Plus 等）走 OAuth，不能用输入框改。
					<span className="provider-hint">订阅账号，无需填写</span>
				) : (
					<button type="button" className="mini-btn" disabled={busy} onClick={() => setOpen((v) => !v)}>
						<IconKey size={13} />
						{provider.configured ? "更换" : "填写"} Key
					</button>
				)}

				{canRemoveKey(provider) && (
					<button
						type="button"
						className="mini-btn danger"
						disabled={busy}
						onClick={() => onRemoveKey(provider.id)}
					>
						清除
					</button>
				)}
				{provider.custom && (
					<>
						<button type="button" className="mini-btn" disabled={busy} onClick={() => onEditCustom(provider.id)}>
							<IconEdit size={13} />
							编辑
						</button>
						<button
							type="button"
							className="mini-btn danger"
							disabled={busy}
							onClick={() => onDeleteCustom(provider.id)}
						>
							<IconTrash size={13} />
						</button>
					</>
				)}
			</div>

			{open && (
				<div className="key-input">
					<input
						type="password"
						value={draft}
						autoComplete="off"
						placeholder="粘贴 API Key，回车保存"
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") submit();
							if (e.key === "Escape") {
								setDraft("");
								setOpen(false);
							}
						}}
					/>
					<button type="button" className="mini-btn" disabled={draft.trim() === ""} onClick={submit}>
						保存
					</button>
					<span className="key-note">保存到本机凭据文件，仅当前用户可读</span>
				</div>
			)}
		</div>
	);
}

/* ── 自定义服务商表单 ────────────────────────────────────────────── */

const EMPTY_CUSTOM: CustomProviderInput = {
	id: "",
	name: "",
	baseUrl: "",
	api: "openai-completions",
	models: [{ id: "", name: "", contextWindow: 128000, maxTokens: 8192, reasoning: false, vision: false }],
};

const API_OPTIONS = [
	{ value: "openai-completions", label: "OpenAI 兼容", hint: "多数国产网关、Ollama、vLLM" },
	{ value: "anthropic-messages", label: "Anthropic Messages", hint: "Claude 官方或代理" },
	{ value: "google-generative-ai", label: "Google Generative AI", hint: "Gemini / AI Studio" },
] as const;

interface CustomFormProps {
	/** 编辑时的初值；新增传 undefined。 */
	readonly initial: CustomProviderInput | undefined;
	readonly busy: boolean;
	readonly onCancel: () => void;
	readonly onSave: (input: CustomProviderInput, apiKey: string | undefined) => void;
}

/* ── 联网搜索 ──────────────────────────────────────────────────── */

interface WebSearchSectionProps {
	readonly busy: boolean;
}

function WebSearchSection({ busy }: WebSearchSectionProps): React.JSX.Element {
	// config 由自己管理（读回 provider + 是否已存 Key；key 本身不回显，与模型凭据同策略）。
	// 注意不能用 SettingsView 的 snapshot：settingsSnapshot 不含 webSearch，
	// 保存成功后必须自己重新拉 —— 否则界面停在「未配置」（用户踩过的 bug）。
	const [config, setConfig] = useState<WebSearchConfigInfo | undefined>(undefined);
	const [providerId, setProviderId] = useState<WebSearchProviderId | "">("");
	const [apiKey, setApiKey] = useState("");
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<WebSearchTestResult | undefined>(undefined);

	const refresh = useCallback(async (): Promise<void> => {
		try {
			const info = await window.kami.getWebSearchConfig();
			setConfig(info);
			setProviderId(info.providerId ?? "");
			setError(undefined);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const save = (): void => {
		if (providerId === "" || apiKey.trim() === "") return;
		setApiKey("");
		setOpen(false);
		void window.kami
			.setWebSearchConfig({ providerId, apiKey: apiKey.trim() })
			.then(() => void refresh())
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	};

	const test = (): void => {
		if (testing) return;
		setTesting(true);
		setTestResult(undefined);
		// UI 侧再兜一层：daemon 的返回可能延迟或丢失（网络层有不可中断的
		// Windows DNS 解析，见 daemon 的 withHardTimeout），按钮不能永远转圈。
		const request = window.kami.testWebSearch();
		const waiter = new Promise<WebSearchTestResult>((resolve) => {
			setTimeout(() => resolve({ ok: false, message: "测试超时：请检查网络后重试" }), 20_000);
		});
		void Promise.race([request, waiter])
			.then((result) => setTestResult(result))
			.catch((e: unknown) => setTestResult({ ok: false, message: e instanceof Error ? e.message : String(e) }))
			.finally(() => setTesting(false));
	};

	const hasKey = config?.hasKey === true;

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>联网搜索</h2>
				{hasKey && (
					<>
						<button
							type="button"
							className="mini-btn"
							disabled={busy || testing}
							onClick={test}
						>
							{testing ? "测试中…" : "测试连接"}
						</button>
						<button
							type="button"
							className="mini-btn danger"
							disabled={busy}
							onClick={() =>
								void window.kami
									.clearWebSearchConfig()
									.then(() => void refresh())
									.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
							}
						>
							清除配置
						</button>
					</>
				)}
			</header>

			{error !== undefined && <div className="settings-error">{error}</div>}
			{testResult !== undefined && (
				<div className={`test-result${testResult.ok ? " ok" : ""}`}>{testResult.message}</div>
			)}

			<div className="provider-row">
				<div className="provider-main">
					<span className={`provider-dot${hasKey ? " on" : ""}`} />
					<span className="provider-name">
						{WEB_SEARCH_PROVIDERS.find((p) => p.id === config?.providerId)?.name ?? "未配置"}
					</span>
					<span className="provider-meta">
						{hasKey ? "已保存 API Key · 对话中的「联网搜索」可直接使用" : "未配置 · 工具会提醒你配置"}
					</span>
					<span className="bar-spacer" />
					<button type="button" className="mini-btn" disabled={busy} onClick={() => setOpen((v) => !v)}>
						{hasKey ? "更换" : "配置"}
					</button>
				</div>

				{open && (
					<div className="key-input">
						<select
							className="provider-select"
							value={providerId}
							disabled={busy}
							onChange={(e) => setProviderId(e.target.value as WebSearchProviderId)}
						>
							<option value="">选择搜索服务商</option>
							{WEB_SEARCH_PROVIDERS.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name} — {p.description}
								</option>
							))}
						</select>
						<input
							type="password"
							value={apiKey}
							autoComplete="off"
							placeholder="粘贴 API Key，回车保存"
							onChange={(e) => setApiKey(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") save();
								if (e.key === "Escape") {
									setApiKey("");
									setOpen(false);
								}
							}}
						/>
						<button
							type="button"
							className="mini-btn"
							disabled={providerId === "" || apiKey.trim() === ""}
							title={
								providerId === ""
									? "请先选择搜索服务商"
									: apiKey.trim() === ""
										? "请填写 API Key"
										: undefined
							}
							onClick={save}
						>
							保存
						</button>
					</div>
				)}
			</div>
		</section>
	);
}

function CustomForm({ initial, busy, onCancel, onSave }: CustomFormProps): React.JSX.Element {
	const isEdit = initial !== undefined;
	const [form, setForm] = useState<CustomProviderInput>(initial ?? EMPTY_CUSTOM);
	const [apiKey, setApiKey] = useState("");
	/** 提交过一次后才显示校验错误，避免刚打开就满屏红字。 */
	const [submitted, setSubmitted] = useState(false);

	const validation = validateCustomProvider(form);
	const errorOf = (field: string): string | undefined => (submitted ? validation.errors[field] : undefined);

	const patch = (changes: Partial<CustomProviderInput>): void => setForm((f) => ({ ...f, ...changes }));

	const patchModel = (index: number, changes: Partial<CustomProviderInput["models"][number]>): void => {
		setForm((f) => ({
			...f,
			models: f.models.map((m, i) => (i === index ? { ...m, ...changes } : m)),
		}));
	};

	const submit = (): void => {
		setSubmitted(true);
		if (!validation.ok) return;
		// 名称留空时用 id 兜底，省得用户为内部网关想两个名字。
		const normalized: CustomProviderInput = {
			...form,
			name: form.name.trim() === "" ? form.id : form.name.trim(),
			models: form.models.map((m) => ({ ...m, id: m.id.trim(), name: m.name.trim() === "" ? m.id.trim() : m.name })),
		};
		onSave(normalized, apiKey.trim() === "" ? undefined : apiKey.trim());
	};

	return (
		<div className="custom-form">
			<div className="form-head">
				<span>{isEdit ? `编辑「${form.id}」` : "新增自定义服务商"}</span>
				<button type="button" className="bar-btn" aria-label="取消" onClick={onCancel}>
					<IconClose size={15} />
				</button>
			</div>

			<label className="field">
				<span className="field-label">标识 ID</span>
				<input
					value={form.id}
					disabled={isEdit}
					placeholder="company-gateway"
					onChange={(e) => patch({ id: e.target.value })}
				/>
				{/* id 是 auth.json 的键，改了等于换一个服务商，所以编辑时锁定。 */}
				<span className="field-hint">{isEdit ? "标识不可修改" : "小写字母、数字、连字符"}</span>
				{errorOf("id") !== undefined && <span className="field-error">{errorOf("id")}</span>}
			</label>

			<label className="field">
				<span className="field-label">显示名称</span>
				<input value={form.name} placeholder="公司网关" onChange={(e) => patch({ name: e.target.value })} />
			</label>

			<label className="field">
				<span className="field-label">接口地址</span>
				<input
					value={form.baseUrl}
					placeholder="https://api.example.com/v1"
					onChange={(e) => patch({ baseUrl: e.target.value })}
				/>
				<span className="field-hint">填到版本号那一层，多数服务是 /v1</span>
				{errorOf("baseUrl") !== undefined && <span className="field-error">{errorOf("baseUrl")}</span>}
			</label>

			<div className="field">
				<span className="field-label">接口协议</span>
				<div className="api-options">
					{API_OPTIONS.map((option) => (
						<button
							key={option.value}
							type="button"
							className={`api-option${form.api === option.value ? " active" : ""}`}
							onClick={() => patch({ api: option.value })}
						>
							<span>{option.label}</span>
							<span className="field-hint">{option.hint}</span>
						</button>
					))}
				</div>
			</div>

			{form.api === "openai-completions" && (
				<div className="field">
					<span className="field-label">兼容性</span>
					{/* 本地与自建服务常不认这两个参数，不关掉会直接 400。 */}
					<label className="check">
						<input
							type="checkbox"
							checked={form.compat?.supportsDeveloperRole === false}
							onChange={(e) =>
								patch({ compat: { ...form.compat, supportsDeveloperRole: e.target.checked ? false : undefined } })
							}
						/>
						不支持 developer 角色（Ollama、vLLM 等常需勾选）
					</label>
					<label className="check">
						<input
							type="checkbox"
							checked={form.compat?.supportsReasoningEffort === false}
							onChange={(e) =>
								patch({ compat: { ...form.compat, supportsReasoningEffort: e.target.checked ? false : undefined } })
							}
						/>
						不支持 reasoning_effort 参数
					</label>
				</div>
			)}

			<div className="field">
				<span className="field-label">模型</span>
				{form.models.map((model, index) => (
					// 用索引作 key：模型 id 在编辑过程中会变（用户正在打字），用 id 会导致输入框失焦。
					<div key={index} className="model-row">
						<input
							className="model-id"
							value={model.id}
							placeholder="模型 ID，如 glm-4.7"
							onChange={(e) => patchModel(index, { id: e.target.value })}
						/>
						<input
							className="model-name"
							value={model.name}
							placeholder="显示名（可留空）"
							onChange={(e) => patchModel(index, { name: e.target.value })}
						/>
						<input
							className="model-num"
							type="number"
							value={model.contextWindow}
							title="上下文窗口"
							onChange={(e) => patchModel(index, { contextWindow: Number(e.target.value) })}
						/>
						<input
							className="model-num"
							type="number"
							value={model.maxTokens}
							title="单次最大输出"
							onChange={(e) => patchModel(index, { maxTokens: Number(e.target.value) })}
						/>
						<label className="check compact" title="支持思考档位">
							<input
								type="checkbox"
								checked={model.reasoning}
								onChange={(e) => patchModel(index, { reasoning: e.target.checked })}
							/>
							思考
						</label>
						<label className="check compact" title="支持图片输入">
							<input
								type="checkbox"
								checked={model.vision}
								onChange={(e) => patchModel(index, { vision: e.target.checked })}
							/>
							看图
						</label>
						{form.models.length > 1 && (
							<button
								type="button"
								className="bar-btn"
								aria-label="删除该模型"
								onClick={() => patch({ models: form.models.filter((_, i) => i !== index) })}
							>
								<IconClose size={14} />
							</button>
						)}
					</div>
				))}
				<button
					type="button"
					className="mini-btn"
					onClick={() =>
						patch({
							models: [
								...form.models,
								{ id: "", name: "", contextWindow: 128000, maxTokens: 8192, reasoning: false, vision: false },
							],
						})
					}
				>
					<IconPlus size={13} />
					添加模型
				</button>
				{errorOf("models") !== undefined && <span className="field-error">{errorOf("models")}</span>}
			</div>

			<label className="field">
				<span className="field-label">API Key</span>
				<input
					type="password"
					value={apiKey}
					autoComplete="off"
					placeholder={isEdit ? "留空表示不修改已保存的 Key" : "本地服务可留空"}
					onChange={(e) => setApiKey(e.target.value)}
				/>
				<span className="field-hint">保存到本机凭据文件，不写进配置文件</span>
			</label>

			<div className="form-actions">
				<button type="button" className="mini-btn" onClick={onCancel}>
					取消
				</button>
				<button type="button" className="primary-btn" disabled={busy} onClick={submit}>
					{busy ? "保存中…" : "保存"}
				</button>
			</div>
		</div>
	);
}

/* ── 模型选择 ────────────────────────────────────────────────────── */

interface ModelPickerProps {
	readonly models: readonly ModelInfo[];
	readonly providers: readonly ProviderInfo[];
	readonly activeModelId: string | undefined;
	readonly busy: boolean;
	readonly onPick: (modelKey: string) => void;
}

function ModelPicker({ models, providers, activeModelId, busy, onPick }: ModelPickerProps): React.JSX.Element {
	const [showAll, setShowAll] = useState(false);
	const nameOf = new Map(providers.map((p) => [p.id, p.name]));

	// 默认只显示可用的：pi 内置约 40 家、几百个模型，全列出来找不到自己配的那个。
	const visible = showAll ? models : models.filter((m) => m.available);

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>当前模型</h2>
				<button type="button" className="mini-btn" onClick={() => setShowAll((v) => !v)}>
					{showAll ? "只看可用" : `显示全部（${models.length}）`}
				</button>
			</header>

			{visible.length === 0 ? (
				<p className="settings-empty">还没有可用模型。先在下面为任意服务商填一个 API Key。</p>
			) : (
				<div className="model-grid">
					{visible.map((model) => {
						const key = `${model.providerId}/${model.id}`;
						const active = key === activeModelId;
						return (
							<button
								key={key}
								type="button"
								className={`model-card${active ? " active" : ""}${model.available ? "" : " unavailable"}`}
								// 未配凭据的模型点了必然报错，直接禁用并说明原因。
								disabled={busy || !model.available}
								title={model.available ? undefined : "该服务商尚未配置 API Key"}
								onClick={() => onPick(key)}
							>
								<span className="model-card-head">
									<span className="model-card-name">{model.name}</span>
									{active && <IconCheck size={14} />}
								</span>
								<span className="model-card-meta">
									{nameOf.get(model.providerId) ?? model.providerId}
									{" · "}
									{Math.round(model.contextWindow / 1000)}K
									{model.reasoning && " · 思考"}
									{model.vision && " · 看图"}
								</span>
							</button>
						);
					})}
				</div>
			)}
		</section>
	);
}

/* ── 主体 ────────────────────────────────────────────────────────── */

/** 表单状态：关闭 / 新增 / 编辑某个已有服务商。 */
type FormState = { kind: "closed" } | { kind: "new" } | { kind: "edit"; input: CustomProviderInput };

export function SettingsView({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
	const [snapshot, setSnapshot] = useState<SettingsSnapshot | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);
	const [busy, setBusy] = useState(false);
	const [form, setForm] = useState<FormState>({ kind: "closed" });

	const load = useCallback(async (): Promise<void> => {
		try {
			setSnapshot(await window.kami.settingsSnapshot());
			setError(undefined);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	/**
	 * 统一的写操作包装：置忙 → 执行 → 重新拉快照。
	 * 每个动作都重拉是有意的：凭据变化会影响模型可用性，局部更新容易漏。
	 */
	const run = useCallback(
		async (action: () => Promise<void>): Promise<void> => {
			setBusy(true);
			setError(undefined);
			try {
				await action();
				await load();
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			} finally {
				setBusy(false);
			}
		},
		[load],
	);

	const openEdit = (providerId: string): void => {
		void run(async () => {
			const input = await window.kami.readCustomProvider(providerId);
			if (input === undefined) throw new Error("读不到该服务商的配置");
			setForm({ kind: "edit", input });
		});
	};

	return (
		<main className="settings">
			<header className="settings-head">
				<button type="button" className="bar-btn" aria-label="返回" onClick={onClose}>
					<IconBack size={17} />
				</button>
				<h1>设置</h1>
				<span className="bar-spacer" />
				<button
					type="button"
					className="mini-btn"
					disabled={busy}
					title="从各服务商拉取最新的模型清单"
					onClick={() => void run(() => window.kami.refreshCatalog())}
				>
					<IconRefresh size={13} />
					刷新模型目录
				</button>
			</header>

			<div className="settings-body">
				{error !== undefined && <div className="settings-error">{error}</div>}

				{snapshot === undefined ? (
					<p className="settings-empty">正在读取配置…</p>
				) : (
					<>
						{snapshot.error !== undefined && <div className="settings-error">{snapshot.error}</div>}

						<ModelPicker
							models={snapshot.models}
							providers={snapshot.providers}
							activeModelId={snapshot.activeModelId}
							busy={busy}
							onPick={(key) => void run(() => window.kami.setModel(key))}
						/>

						<section className="settings-section">
							<header className="settings-section-head">
								<h2>服务商</h2>
								<button
									type="button"
									className="mini-btn"
									disabled={busy || form.kind !== "closed"}
									onClick={() => setForm({ kind: "new" })}
								>
									<IconPlus size={13} />
									自定义服务商
								</button>
							</header>

							{form.kind !== "closed" && (
								<CustomForm
									initial={form.kind === "edit" ? form.input : undefined}
									busy={busy}
									onCancel={() => setForm({ kind: "closed" })}
									onSave={(input, apiKey) =>
										void run(async () => {
											await window.kami.saveCustomProvider(input, apiKey);
											setForm({ kind: "closed" });
										})
									}
								/>
							)}

							<div className="provider-list">
								{snapshot.providers.map((provider) => (
									<ProviderRow
										key={provider.id}
										provider={provider}
										busy={busy}
										onSaveKey={(id, key) => void run(() => window.kami.setApiKey(id, key))}
										onRemoveKey={(id) => void run(() => window.kami.removeApiKey(id))}
										onEditCustom={openEdit}
										onDeleteCustom={(id) => void run(() => window.kami.deleteCustomProvider(id))}
									/>
								))}
							</div>
						</section>

						<WebSearchSection busy={busy} />

						<p className="settings-foot">配置目录：{snapshot.configDir}</p>
					</>
				)}
			</div>
		</main>
	);
}
