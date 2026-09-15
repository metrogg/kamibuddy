/**
 * 设置「模型」分组：当前模型 + 服务商管理 + 「添加模型」弹层
 *（spec: rework-settings-layout Task 5）。
 *
 * 设计前提（都由 scripts/probe-custom-provider.ts 实测确认）：
 *   1. 密钥存 pi 的 auth.json（0600），本页只负责收集、不落盘、不回显。
 *   2. **未配凭据的服务商，其模型照样在目录里**，所以必须显式区分可用性，
 *      否则用户会选到一个点了才报错的模型。
 *   3. 自定义服务商的密钥同样走 auth.json，models.json 不留明文。
 *
 * 服务商不再平铺（平铺口径见 spec 的 REMOVED「服务商平铺」）：
 * 只列已配置/自建的服务商管理行；未配置的只出现在「添加模型」弹层的
 * 供应商下拉里。弹层两条路径：选预置 →（未配 Key 先填 Key）+ 模型字段，
 * 经 addProviderModel 落进 models.json 与内置目录合并；选「自定义」→
 * 复用 CustomForm 全套（baseUrl + Key + 模型字段），走 saveCustomProvider。
 */

import { useEffect, useRef, useState } from "react";
import type {
	CustomModelInput,
	CustomProviderInput,
	ModelInfo,
	ModelProbeResult,
	ProviderInfo,
	SettingsSnapshot,
} from "@shared/settings.ts";
import { validateCustomModel, validateCustomProvider } from "@shared/settings.ts";
import { IconCheck, IconChevronDown, IconClose, IconEdit, IconKey, IconPlus, IconRefresh, IconTrash } from "../icons.tsx";
import { EmptyState, ErrorState } from "../state-views.tsx";
import { useModalFocus } from "../use-modal-focus.ts";

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

/** 连通性测试的卡片本地状态：结果留在卡片上，不走页面级 banner（出错现场响亮）。 */
type ProbeState = { kind: "idle" } | { kind: "running" } | { kind: "done"; result: ModelProbeResult };

interface ModelCardProps {
	readonly model: ModelInfo;
	readonly providerName: string;
	readonly active: boolean;
	readonly busy: boolean;
	readonly onPick: () => void;
}

/**
 * 单个模型卡片：点击 = 选为当前模型；「测试」= 连通性探测（daemon 发最小请求）。
 * 卡片用 div+role=button 而不是 button：HTML 不允许 button 套 button（测试按钮）。
 */
function ModelCard({ model, providerName, active, busy, onPick }: ModelCardProps): React.JSX.Element {
	const [probe, setProbe] = useState<ProbeState>({ kind: "idle" });
	const pickable = model.available && !busy;

	const test = async (): Promise<void> => {
		setProbe({ kind: "running" });
		try {
			const result = await window.kami.testModel(`${model.providerId}/${model.id}`);
			setProbe({ kind: "done", result });
		} catch (e) {
			// daemon 用返回值表达业务失败；走到 catch 说明 IPC 层本身断了。
			setProbe({ kind: "done", result: { ok: false, error: e instanceof Error ? e.message : String(e) } });
		}
	};

	return (
		<div
			className={`model-card${active ? " active" : ""}${model.available ? "" : " unavailable"}`}
			role="button"
			tabIndex={pickable ? 0 : -1}
			aria-disabled={!pickable}
			// 未配凭据的模型点了必然报错，直接禁用并说明原因。
			title={model.available ? undefined : "该服务商尚未配置 API Key"}
			onClick={() => {
				if (pickable) onPick();
			}}
			onKeyDown={(e) => {
				if (e.key !== "Enter" && e.key !== " ") return;
				e.preventDefault();
				if (pickable) onPick();
			}}
		>
			<span className="model-card-head">
				<span className="model-card-name">{model.name}</span>
				{active && <IconCheck size={14} />}
				{model.available && (
					<button
						type="button"
						className="mini-btn model-card-test"
						disabled={probe.kind === "running"}
						title="发一个最小请求，测试网络 / Key / 模型是否可用"
						onClick={(e) => {
							e.stopPropagation();
							void test();
						}}
					>
						{probe.kind === "running" ? "测试中…" : "测试"}
					</button>
				)}
			</span>
			<span className="model-card-meta">
				{providerName}
				{" · "}
				{Math.round(model.contextWindow / 1000)}K
				{model.reasoning && " · 思考"}
				{model.vision && " · 看图"}
			</span>
			{probe.kind === "done" && (
				<span className={`model-card-probe ${probe.result.ok ? "ok" : "err"}`}>
					{probe.result.ok
						? `✓ 连通正常${probe.result.latencyMs !== undefined ? ` · ${probe.result.latencyMs}ms` : ""}${
								probe.result.error !== undefined ? `（${probe.result.error}）` : ""
							}`
						: `✗ ${probe.result.error ?? "测试失败"}`}
				</span>
			)}
		</div>
	);
}

interface ModelPickerProps {
	readonly models: readonly ModelInfo[];
	readonly providers: readonly ProviderInfo[];
	readonly activeModelId: string | undefined;
	readonly busy: boolean;
	readonly onPick: (modelKey: string) => void;
	/** 「刷新模型目录」从原整页头部挪进本分区 —— 它刷新的就是这里列的目录。 */
	readonly onRefreshCatalog: () => void;
}

function ModelPicker({ models, providers, activeModelId, busy, onPick, onRefreshCatalog }: ModelPickerProps): React.JSX.Element {
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
				<button
					type="button"
					className="mini-btn"
					disabled={busy}
					title="从各服务商拉取最新的模型清单"
					onClick={onRefreshCatalog}
				>
					<IconRefresh size={13} />
					刷新模型目录
				</button>
			</header>

			{visible.length === 0 ? (
				<EmptyState title="还没有可用模型。点下方「添加模型」，选个服务商填好 Key 就能用。" />
			) : (
				<div className="model-grid">
					{visible.map((model) => {
						const key = `${model.providerId}/${model.id}`;
						return (
							<ModelCard
								key={key}
								model={model}
								providerName={nameOf.get(model.providerId) ?? model.providerId}
								active={key === activeModelId}
								busy={busy}
								onPick={() => onPick(key)}
							/>
						);
					})}
				</div>
			)}
		</section>
	);
}

/* ── 添加模型弹层 ────────────────────────────────────────────────── */

/** 弹层里的选择：某个预置服务商，或「自定义（OpenAI 兼容）」。 */
type AddTarget = { kind: "preset"; provider: ProviderInfo } | { kind: "custom" };

const CUSTOM_LABEL = "自定义（OpenAI 兼容）";

interface ProviderSelectProps {
	readonly providers: readonly ProviderInfo[];
	readonly target: AddTarget | undefined;
	readonly onPick: (target: AddTarget) => void;
}

/**
 * 供应商下拉：可搜索过滤 + 预置清单 + 末位「自定义」。
 *
 * 没有品牌图标体系（ProviderRow 也只有状态点），所以图标沿用同一颗
 * provider-dot（亮 = 已配置），「自定义」用 IconPlus 作通用占位。
 */
function ProviderSelect({ providers, target, onPick }: ProviderSelectProps): React.JSX.Element {
	const [open, setOpen] = useState(false);
	const [filter, setFilter] = useState("");
	const rootRef = useRef<HTMLDivElement>(null);

	/* 点面板外收起。面板是绝对定位的浮层、不占布局，不能指望弹层背板的点击判定。 */
	useEffect(() => {
		if (!open) return;
		const onDown = (event: MouseEvent): void => {
			if (event.target instanceof Node && rootRef.current?.contains(event.target) === false) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, [open]);

	const query = filter.trim().toLowerCase();
	const filtered =
		query === ""
			? providers
			: providers.filter((p) => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query));

	const pick = (next: AddTarget): void => {
		onPick(next);
		setOpen(false);
		setFilter("");
	};

	const label = target === undefined ? "选择供应商" : target.kind === "custom" ? CUSTOM_LABEL : target.provider.name;

	return (
		<div className="provider-select" ref={rootRef}>
			<button
				type="button"
				className={`provider-select-trigger${target === undefined ? " placeholder" : ""}`}
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
			>
				<span className="provider-select-label">{label}</span>
				<IconChevronDown size={13} />
			</button>

			{open && (
				<div className="provider-select-panel">
					<div className="provider-select-search">
						<input
							// 面板展开的唯一目的就是先过滤，焦点直接进搜索框（项目无 eslint，无需 a11y 豁免注释）。
							autoFocus
							value={filter}
							placeholder="搜索供应商"
							onChange={(e) => setFilter(e.target.value)}
							onKeyDown={(e) => {
								// 输入框里的 Esc 会穿过弹层与设置卡的守卫（两者都放行给控件），
								// 在这里接住：只收起面板，谁也不关。
								if (e.key === "Escape") setOpen(false);
							}}
						/>
					</div>
					<div className="provider-select-list" role="listbox" aria-label="供应商">
						{filtered.map((provider) => (
							<button
								key={provider.id}
								type="button"
								role="option"
								aria-selected={target?.kind === "preset" && target.provider.id === provider.id}
								className="provider-option"
								onClick={() => pick({ kind: "preset", provider })}
							>
								<span className={`provider-dot${provider.configured ? " on" : ""}`} />
								<span className="provider-option-name">{provider.name}</span>
								<span className="provider-meta">{provider.configured ? "已配置" : "未配置 Key"}</span>
							</button>
						))}
						{filtered.length === 0 && <EmptyState title="没有匹配的供应商" />}
						{/* 「自定义」是动作不是数据，恒钉在末位、不参与过滤。 */}
						<button
							type="button"
							role="option"
							aria-selected={target?.kind === "custom"}
							className="provider-option custom"
							onClick={() => pick({ kind: "custom" })}
						>
							<IconPlus size={13} />
							<span className="provider-option-name">{CUSTOM_LABEL}</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

const EMPTY_MODEL: CustomModelInput = {
	id: "",
	name: "",
	contextWindow: 128000,
	maxTokens: 8192,
	reasoning: false,
	vision: false,
};

interface AddModelDialogProps {
	/** 预置服务商清单（自建的已在管理行里，不重复进下拉）。 */
	readonly providers: readonly ProviderInfo[];
	readonly onClose: () => void;
	/** 保存成功后调用：关弹层 + 重拉快照（新模型随即出现在清单里）。 */
	readonly onSaved: () => void;
}

function AddModelDialog({ providers, onClose, onSaved }: AddModelDialogProps): React.JSX.Element {
	const [target, setTarget] = useState<AddTarget | undefined>(undefined);
	const [apiKey, setApiKey] = useState("");
	const [model, setModel] = useState<CustomModelInput>(EMPTY_MODEL);
	const [saving, setSaving] = useState(false);
	/**
	 * 保存错误留在弹层里显示，不走容器的 run()：run 会把错误吞进页面级 banner，
	 * 而弹层盖在它上面，用户什么都看不到 —— 错误必须在出错现场响亮。
	 */
	const [saveError, setSaveError] = useState<string | undefined>(undefined);

	/*
	 * 焦点陷阱 / 归还 / 背景 inert 交给共享 hook（落点用默认值：卡片内首个可聚焦元素
	 * 是右上「关闭」钮）。
	 *
	 * 本弹层是**内层模态**：它渲染在 .settings-card 内部，而设置卡自己也挂了一份 hook。
	 * 两份 hook 的 keydown 都挂在 document 上，但 Tab 只由 openModals 栈顶（最后挂上的
	 * 本弹层）处理，故外层不会按「设置卡全境」的可聚焦元素把焦点从本弹层挪走。
	 */
	const cardRef = useModalFocus();

	/*
	 * Esc 关闭（capture 阶段拦下并 stopPropagation）：设置卡自己的 Esc 监听在
	 * window 的 bubble 阶段，不拦的话关弹层会连带把整个设置卡带走。
	 * 焦点在表单控件里时放行给控件（与 settings-view 的同款守卫对齐：
	 * 正在填 Key 按 Esc 不该丢输入）。
	 */
	useEffect(() => {
		const onKey = (event: KeyboardEvent): void => {
			if (event.key !== "Escape") return;
			if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select") !== null) {
				return;
			}
			event.stopPropagation();
			onClose();
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	}, [onClose]);

	const needKey = target?.kind === "preset" && !target.provider.configured;
	const modelErrors = target?.kind === "preset" ? validateCustomModel(model) : [];
	/** 禁保存时给的第一条原因（禁用态 + 提示文案）。 */
	const blockReason =
		target === undefined
			? "先选择供应商"
			: target.kind === "preset"
				? needKey && apiKey.trim() === ""
					? `「${target.provider.name}」还没配置 Key，请先填写`
					: modelErrors[0]
				: undefined;

	const submitPreset = async (): Promise<void> => {
		if (target?.kind !== "preset" || blockReason !== undefined) return;
		setSaving(true);
		setSaveError(undefined);
		try {
			const key = apiKey.trim();
			// Key 先于模型落盘：模型先进目录、Key 再失败的话，目录里会多一个
			// 点了就报错的模型（快照的 available 判定救不了刚写完还没重拉的空档）。
			if (needKey) await window.kami.setApiKey(target.provider.id, key);
			const id = model.id.trim();
			// 显示名留空用模型 ID 兜底，与 CustomForm 的归一化口径一致。
			await window.kami.addProviderModel(target.provider.id, {
				...model,
				id,
				name: model.name.trim() === "" ? id : model.name.trim(),
			});
			onSaved();
		} catch (e) {
			setSaveError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	};

	const submitCustom = async (input: CustomProviderInput, key: string | undefined): Promise<void> => {
		setSaving(true);
		setSaveError(undefined);
		try {
			await window.kami.saveCustomProvider(input, key);
			onSaved();
		} catch (e) {
			setSaveError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	};

	return (
		// 背板点击关闭用 mousedown 而不是 click（拖选文本滑出松开不误判），同 settings-view。
		<div
			className="modal-backdrop"
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="add-model-card" role="dialog" aria-modal="true" aria-labelledby="add-model-title" ref={cardRef}>
				<div className="add-model-head">
					<h2 id="add-model-title">添加模型</h2>
					<button type="button" className="bar-btn" aria-label="关闭" onClick={onClose}>
						<IconClose size={15} />
					</button>
				</div>

				<div className="field">
					<span className="field-label">供应商</span>
					<ProviderSelect
						providers={providers}
						target={target}
						onPick={(next) => {
							setTarget(next);
							setSaveError(undefined);
						}}
					/>
				</div>

				{saveError !== undefined && <ErrorState message={saveError} />}

				{target?.kind === "custom" && (
					<CustomForm
						initial={undefined}
						busy={saving}
						onCancel={onClose}
						onSave={(input, key) => void submitCustom(input, key)}
					/>
				)}

				{target?.kind === "preset" && (
					<>
						{needKey && (
							<label className="field">
								<span className="field-label">API Key</span>
								<input
									type="password"
									value={apiKey}
									autoComplete="off"
									placeholder={`粘贴 ${target.provider.name} 的 API Key`}
									onChange={(e) => setApiKey(e.target.value)}
								/>
								<span className="field-hint">保存到本机凭据文件，仅当前用户可读</span>
							</label>
						)}

						<div className="field">
							<span className="field-label">模型</span>
							{/* 字段组与 CustomForm 的模型行同款（id/显示名/上下文/输出上限/思考/看图）。 */}
							<div className="model-row">
								<input
									className="model-id"
									value={model.id}
									placeholder="模型 ID，如 glm-4.7"
									onChange={(e) => setModel((m) => ({ ...m, id: e.target.value }))}
								/>
								<input
									className="model-name"
									value={model.name}
									placeholder="显示名（可留空）"
									onChange={(e) => setModel((m) => ({ ...m, name: e.target.value }))}
								/>
								<input
									className="model-num"
									type="number"
									value={model.contextWindow}
									title="上下文窗口"
									onChange={(e) => setModel((m) => ({ ...m, contextWindow: Number(e.target.value) }))}
								/>
								<input
									className="model-num"
									type="number"
									value={model.maxTokens}
									title="单次最大输出"
									onChange={(e) => setModel((m) => ({ ...m, maxTokens: Number(e.target.value) }))}
								/>
								<label className="check compact" title="支持思考档位">
									<input
										type="checkbox"
										checked={model.reasoning}
										onChange={(e) => setModel((m) => ({ ...m, reasoning: e.target.checked }))}
									/>
									思考
								</label>
								<label className="check compact" title="支持图片输入">
									<input
										type="checkbox"
										checked={model.vision}
										onChange={(e) => setModel((m) => ({ ...m, vision: e.target.checked }))}
									/>
									看图
								</label>
							</div>
							<span className="field-hint">模型 ID 以服务商文档为准；同 ID 已存在时会覆盖原定义</span>
						</div>

						<div className="form-actions">
							{blockReason !== undefined && <span className="field-hint add-model-block">{blockReason}</span>}
							<button type="button" className="mini-btn" onClick={onClose}>
								取消
							</button>
							<button
								type="button"
								className="primary-btn"
								disabled={saving || blockReason !== undefined}
								onClick={() => void submitPreset()}
							>
								{saving ? "保存中…" : "保存"}
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

/* ── 分组出口 ────────────────────────────────────────────────────── */

/** 编辑表单状态：关闭 / 编辑某个自建服务商。新建自建服务商已挪进「添加模型」弹层。 */
type FormState = { kind: "closed" } | { kind: "edit"; input: CustomProviderInput };

/**
 * run 由容器提供（置忙 → 执行 → 重拉快照）。
 * 每个动作都重拉是有意的：凭据变化会影响模型可用性，局部更新容易漏。
 */
interface ModelsSectionProps {
	readonly snapshot: SettingsSnapshot;
	readonly busy: boolean;
	readonly run: (action: () => Promise<void>) => Promise<void>;
}

export function ModelsSection({ snapshot, busy, run }: ModelsSectionProps): React.JSX.Element {
	const [form, setForm] = useState<FormState>({ kind: "closed" });
	const [addOpen, setAddOpen] = useState(false);

	const openEdit = (providerId: string): void => {
		void run(async () => {
			const input = await window.kami.readCustomProvider(providerId);
			if (input === undefined) throw new Error("读不到该服务商的配置");
			setForm({ kind: "edit", input });
		});
	};

	/*
	 * 平铺移除后的管理行口径：已配置的保留（编辑/删 Key），自建的恒保留
	 * （未配 Key 的自建服务 —— 如本地 vLLM —— 也得留入口，否则建了就没法编辑/删除）。
	 * 未配置的预置服务商只出现在「添加模型」弹层的供应商下拉里。
	 */
	const managed = snapshot.providers.filter((p) => p.configured || p.custom);

	return (
		<>
			{/*
				snapshot.error 是「快照里的目录/凭据读取失败」，恢复方式是重拉快照；
				空 action + run 就是重拉（同下方「添加模型」弹层保存后的用法）——
				只读操作也走 run 是为了复用它的置忙与错误透出，不另开一条通路。
			*/}
			{snapshot.error !== undefined && (
				<ErrorState message={snapshot.error} onRetry={() => void run(async () => {})} />
			)}

			<ModelPicker
				models={snapshot.models}
				providers={snapshot.providers}
				activeModelId={snapshot.activeModelId}
				busy={busy}
				onPick={(key) => void run(() => window.kami.setModel(key))}
				onRefreshCatalog={() => void run(() => window.kami.refreshCatalog())}
			/>

			<section className="settings-section">
				<header className="settings-section-head">
					<h2>服务商</h2>
					<button type="button" className="mini-btn" onClick={() => setAddOpen(true)}>
						<IconPlus size={13} />
						添加模型
					</button>
				</header>

				{form.kind === "edit" && (
					<CustomForm
						initial={form.input}
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

				{managed.length === 0 ? (
					<EmptyState title="还没有配置服务商，点右上角「添加模型」开始。" />
				) : (
					<div className="provider-list">
						{managed.map((provider) => (
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
				)}
			</section>

			{addOpen && (
				<AddModelDialog
					providers={snapshot.providers.filter((p) => !p.custom)}
					onClose={() => setAddOpen(false)}
					onSaved={() => {
						setAddOpen(false);
						// 弹层自己完成了写入，这里只借 run 重拉快照（新模型入清单、可用性重算）。
						void run(async () => {});
					}}
				/>
			)}
		</>
	);
}
