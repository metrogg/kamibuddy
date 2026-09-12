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

import { useCallback, useEffect, useRef, useState } from "react";
import type {
	CustomProviderInput,
	ModelInfo,
	ProviderInfo,
	SettingsSnapshot,
	StyleConfigInfo,
	WebSearchConfigInfo,
	WebSearchProviderId,
	WebSearchTestResult,
} from "@shared/settings.ts";
import { WEB_SEARCH_PROVIDERS, validateCustomProvider } from "@shared/settings.ts";
import type { ModeDescriptor, ThinkingLevel } from "@shared/session-events.ts";
import { THINKING_LEVEL_LABELS } from "@shared/session-events.ts";
import type { PromptPreviewResult } from "@shared/ipc.ts";
import type { PermissionInfo } from "@shared/permissions.ts";
import { CUSTOM_PRESET, PERMISSION_PRESETS } from "@shared/permissions.ts";
import { IconBack, IconCheck, IconChevronRight, IconClose, IconEdit, IconKey, IconPlus, IconRefresh, IconTrash } from "./icons.tsx";

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
						aria-label={`${provider.name} API Key`}
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
							aria-label="搜索服务商"
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
							aria-label="联网搜索 API Key"
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

/* ── 默认推理强度 ──────────────────────────────────────────────── */

/**
 * 全局默认推理强度（对标 WorkBuddy 设置页的全局兜底档）。
 *
 * 只影响之后新建的会话：既有会话以各自会话内选择为准，不被回溯 ——
 * 会话内切换在模型菜单（ModelMenu 的「推理强度」行），两处数据源不同：
 * 这里走偏好文件（get/setThinkingLevelDefault），会话内走 session_state。
 */
function ThinkingLevelSection({ busy }: { readonly busy: boolean }): React.JSX.Element {
	const [level, setLevel] = useState<ThinkingLevel | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		window.kami
			.getThinkingLevelDefault()
			.then((result) => setLevel(result.level))
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	}, []);

	const change = (next: ThinkingLevel): void => {
		const prev = level;
		setLevel(next);
		void window.kami.setThinkingLevelDefault(next).catch((e: unknown) => {
			// 失败回滚显示值：select 是受控的，不回滚会让用户以为已经存上。
			setLevel(prev);
			setError(e instanceof Error ? e.message : String(e));
		});
	};

	// 全局默认不做模型裁剪（保存时还不知道会配哪个模型），列全量七档；
	// 建会话时 pi 按所选模型能力 clamp。档位顺序取 LABELS 声明序（off→max）。
	const options = Object.keys(THINKING_LEVEL_LABELS) as ThinkingLevel[];

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>默认推理强度</h2>
			</header>

			{error !== undefined && <div className="settings-error">{error}</div>}

			{level === undefined ? (
				<p className="settings-empty">正在读取推理强度设置…</p>
			) : (
				<>
					<div className="provider-row">
						<div className="provider-main">
							<span className="provider-name">新建会话的初始档位</span>
							<span className="bar-spacer" />
							<select
								className="provider-select"
								value={level}
								disabled={busy}
								aria-label="新建会话的初始推理档位"
								onChange={(e) => change(e.target.value as ThinkingLevel)}
							>
								{options.map((option) => (
									<option key={option} value={option}>
										{THINKING_LEVEL_LABELS[option]}
									</option>
								))}
							</select>
						</div>
					</div>
					<p className="settings-foot">
						影响之后新建的会话，不改动已存在的会话；模型不支持的档位会在建会话时自动裁剪。
					</p>
				</>
			)}
		</section>
	);
}

/* ── 回复风格 ──────────────────────────────────────────────────── */

/**
 * 回复风格选择器（F8 风格系统，spec: systematize-prompt-architecture）。
 *
 * 交互同款 ThinkingLevelSection：受控 select + 乐观更新 + 失败回滚。
 * 三态语义：某风格 id = 注入该风格；「关闭」（空串）= 不注入风格段。
 * 只影响之后的新 run（系统提示词在 run 开始时组装），进行中的 run 不追回。
 */
function StyleSection({ busy }: { readonly busy: boolean }): React.JSX.Element {
	const [config, setConfig] = useState<StyleConfigInfo | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		window.kami
			.getStyle()
			.then((result) => setConfig(result))
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	}, []);

	const change = (next: string): void => {
		const prev = config;
		if (prev === undefined) return;
		setConfig({ ...prev, styleId: next });
		void window.kami.setStyle(next).catch((e: unknown) => {
			// 失败回滚显示值：select 是受控的，不回滚会让用户以为已经存上。
			setConfig(prev);
			setError(e instanceof Error ? e.message : String(e));
		});
	};

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>回复风格</h2>
			</header>

			{error !== undefined && <div className="settings-error">{error}</div>}

			{config === undefined ? (
				<p className="settings-empty">正在读取回复风格设置…</p>
			) : (
				<>
					<div className="provider-row">
						<div className="provider-main">
							<span className="provider-name">回复的表达方式</span>
							<span className="bar-spacer" />
							<select
								className="provider-select"
								value={config.styleId}
								disabled={busy}
								aria-label="回复风格"
								onChange={(e) => change(e.target.value)}
							>
								{config.styles.map((style) => (
									<option key={style.id} value={style.id}>
										{style.label}
									</option>
								))}
								<option value="">关闭</option>
							</select>
						</div>
					</div>
					<p className="settings-foot">
						风格只改变表达方式，不改变事实与内容；对之后的新回复生效。
					</p>
				</>
			)}
		</section>
	);
}

/* ── 记忆 ──────────────────────────────────────────────────── */

/**
 * 记忆分区（spec: add-memory-system）。
 *
 * 两块数据源都自己管理、不借 settingsSnapshot（快照里没有这些键，
 * 与 WebSearchSection 不借快照的理由相同）：
 * - 「生成对话记忆」toggle = preferences.memoryEnabled，内置「记忆整理」
 *   任务的启停权威（daemon 侧写偏好时同步对齐任务状态）。
 * - 用户画像块直编 PROFILE.md：画像每晚由内置任务从对话整理，
 *   用户可在这里查看与修正（保存/重置/导入）。
 */
function MemorySection({ busy }: { readonly busy: boolean }): React.JSX.Element {
	const [enabled, setEnabled] = useState<boolean | undefined>(undefined);
	/** textarea 当前值与保存基线：「保存」只在内容变化后可点。 */
	const [profile, setProfile] = useState("");
	const [savedProfile, setSavedProfile] = useState("");
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState<string | undefined>(undefined);
	/** 「重置」的窗内确认态：第一次点击进入确认，第二次才执行 —— 清空不可逆，防误点。 */
	const [confirmReset, setConfirmReset] = useState(false);

	useEffect(() => {
		Promise.all([window.kami.getMemoryEnabled(), window.kami.getProfile()])
			.then(([memory, result]) => {
				setEnabled(memory.enabled);
				setProfile(result.content);
				setSavedProfile(result.content);
				setLoaded(true);
			})
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	}, []);

	const toggle = (next: boolean): void => {
		const prev = enabled;
		setEnabled(next);
		void window.kami.setMemoryEnabled(next).catch((e: unknown) => {
			// 失败回滚显示值：开关是受控的，不回滚会让用户以为已经存上。
			setEnabled(prev);
			setError(e instanceof Error ? e.message : String(e));
		});
	};

	const save = (): void => {
		void window.kami
			.setProfile(profile)
			.then(() => setSavedProfile(profile))
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	};

	const reset = (): void => {
		if (!confirmReset) {
			setConfirmReset(true);
			return;
		}
		setConfirmReset(false);
		void window.kami
			.resetProfile()
			.then(() => {
				setProfile("");
				setSavedProfile("");
			})
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	};

	/** 导入两段组合：main 选文件读内容 → daemon 的 setProfile 写入。取消静默收回。 */
	const importMd = (): void => {
		void window.kami
			.importProfile()
			.then(async (picked) => {
				if (picked === undefined) return;
				await window.kami.setProfile(picked.content);
				setProfile(picked.content);
				setSavedProfile(picked.content);
			})
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	};

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>记忆</h2>
			</header>

			{error !== undefined && <div className="settings-error">{error}</div>}

			{enabled === undefined || !loaded ? (
				<p className="settings-empty">正在读取记忆设置…</p>
			) : (
				<>
					<div className="provider-row">
						<div className="provider-main">
							<span className="provider-name">生成对话记忆</span>
							<span className="provider-meta">每晚自动整理对话要点</span>
							<span className="bar-spacer" />
							{/* 开关复用连接器页的 mcp-switch 档位（同一个开关控件，不另造类）。 */}
							<label className="mcp-switch" title={enabled ? "点击停用" : "点击启用"}>
								<input
									type="checkbox"
									checked={enabled}
									disabled={busy}
									aria-label="生成对话记忆"
									onChange={(e) => toggle(e.currentTarget.checked)}
								/>
								<span className="mcp-switch-track">
									<span className="mcp-switch-thumb" />
								</span>
							</label>
						</div>
					</div>
					<p className="settings-foot">
						开启后，内置任务「记忆整理」每晚从你的对话中整理背景信息写入下面的画像；停用即暂停该任务。
					</p>

					<div className="profile-block">
						<div className="profile-block-head">
							<span className="field-label">用户画像</span>
							<span className="bar-spacer" />
							<button
								type="button"
								className="mini-btn"
								disabled={busy || profile === savedProfile}
								title={profile === savedProfile ? "内容没有变化" : undefined}
								onClick={save}
							>
								保存
							</button>
							<button
								type="button"
								className={`mini-btn${confirmReset ? " danger" : ""}`}
								disabled={busy}
								onClick={reset}
							>
								{confirmReset ? "确认清空" : "重置"}
							</button>
							<button type="button" className="mini-btn" disabled={busy} onClick={importMd}>
								导入…
							</button>
						</div>
						<textarea
							className="profile-textarea"
							value={profile}
							disabled={busy}
							placeholder="还没有画像。开启「生成对话记忆」后会自动整理，也可以直接在这里填写。"
							onChange={(e) => {
								setProfile(e.currentTarget.value);
								// 编辑动作说明注意力在画像内容本身，挂着的清空确认就此作废。
								setConfirmReset(false);
							}}
						/>
						<p className="settings-foot">
							画像随每轮对话提供给助手，用来记住你的背景与偏好；可直接修改，保存后下一轮对话生效。
						</p>
					</div>
				</>
			)}
		</section>
	);
}

/* ── 提示词预览 ──────────────────────────────────────────────── */

/**
 * 风格选择器里「跟随当前设置」的哨兵值 —— 不能复用空串（空串已被「关闭」占用），
 * 也不能是任何真实风格 id（与文件名同字符集，下划线开头撞不上）。
 */
const FOLLOW_CURRENT_STYLE = "__follow__";

/**
 * 分段来源标签的着色类别：source 形如 fragment:delivery-rules / mode:craft，
 * 取「:」前的类别名，对应 index.css 的 seg-<类别> 色块类。
 */
function sourceCategory(source: string): string {
	return source.split(":", 1)[0] ?? source;
}

/**
 * 提示词预览（spec: systematize-prompt-architecture Task 5）。
 *
 * 三路数据源：场景/模式清单借会话快照的 availableScenes/availableModes
 * （资源清单是全局的，快照是既有透出通道，不为预览单开一条清单契约）；
 * 风格清单与当前值走 getStyle；组装结果走 prompt:preview（daemon 现场组装，
 * 不需要活会话）。选择器任一变化自动重新请求；竞态用序号守门，
 * 慢响应落地时不覆盖更新的选择。
 *
 * 预览与真实会话的差异（pi 上下文段、专家人格段不出现）在页脚如实说明，
 * 不让用户对着预览排查「为什么真实提示词多了一段」。
 */
function PromptPreviewSection(): React.JSX.Element {
	const [axes, setAxes] = useState<{
		readonly scenes: readonly ModeDescriptor[];
		readonly modes: readonly ModeDescriptor[];
	}>();
	const [styleConfig, setStyleConfig] = useState<StyleConfigInfo | undefined>(undefined);
	const [sceneId, setSceneId] = useState("");
	const [modeId, setModeId] = useState("");
	const [styleSel, setStyleSel] = useState(FOLLOW_CURRENT_STYLE);
	const [result, setResult] = useState<PromptPreviewResult | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);
	const [fullView, setFullView] = useState(false);
	const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
	/** 重新生成按钮的触发器：自增即让组装 effect 重跑（时间环境块随之刷新）。 */
	const [nonce, setNonce] = useState(0);
	const requestSeq = useRef(0);

	useEffect(() => {
		Promise.all([window.kami.snapshot(), window.kami.getStyle()])
			.then(([snapshot, style]) => {
				const scenes = snapshot.availableScenes.filter((s) => s.ready);
				const modes = snapshot.availableModes.filter((m) => m.ready);
				setAxes({ scenes, modes });
				setStyleConfig(style);
				// 初值跟随当前会话的两轴（预览「此刻的提示词」）；
				// 会话值不在可选清单里时（如 design 占位）回落到第一项。
				setSceneId(scenes.some((s) => s.id === snapshot.state.sceneId) ? snapshot.state.sceneId : (scenes[0]?.id ?? ""));
				setModeId(modes.some((m) => m.id === snapshot.state.interactionId) ? snapshot.state.interactionId : (modes[0]?.id ?? ""));
			})
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	}, []);

	useEffect(() => {
		if (sceneId === "" || modeId === "") return;
		const seq = ++requestSeq.current;
		// 哨兵值 → 缺省（跟随当前偏好）；「关闭」→ 空串，原样传给 daemon。
		const styleId = styleSel === FOLLOW_CURRENT_STYLE ? undefined : styleSel;
		window.kami
			.promptPreview({ sceneId, modeId, ...(styleId === undefined ? {} : { styleId }) })
			.then((preview) => {
				if (requestSeq.current !== seq) return;
				setResult(preview);
				setError(undefined);
				// 分段集合随三轴变化，旧展开下标可能指向另一段，折叠重来。
				setExpanded(new Set());
			})
			.catch((e: unknown) => {
				if (requestSeq.current !== seq) return;
				setResult(undefined);
				setError(e instanceof Error ? e.message : String(e));
			});
	}, [sceneId, modeId, styleSel, nonce]);

	const toggleSegment = (index: number): void => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	};

	const currentStyleLabel =
		styleConfig === undefined
			? ""
			: styleConfig.styleId === ""
				? "关闭"
				: (styleConfig.styles.find((s) => s.id === styleConfig.styleId)?.label ?? styleConfig.styleId);

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>提示词预览</h2>
				{result !== undefined && <span className="provider-meta">共 {result.totalChars} 字</span>}
				<button
					type="button"
					className="mini-btn"
					disabled={sceneId === "" || modeId === ""}
					title="按当前选择重新组装（时间环境块随生成时刻刷新）"
					onClick={() => setNonce((n) => n + 1)}
				>
					<IconRefresh size={13} />
					重新生成
				</button>
			</header>

			{error !== undefined && <div className="settings-error">{error}</div>}

			{axes === undefined || styleConfig === undefined ? (
				<p className="settings-empty">正在读取提示词资源…</p>
			) : (
				<>
					<div className="preview-controls">
						<label className="preview-field">
							<span className="preview-field-label">场景</span>
							<select value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
								{axes.scenes.map((scene) => (
									<option key={scene.id} value={scene.id}>
										{scene.label}
									</option>
								))}
							</select>
						</label>
						<label className="preview-field">
							<span className="preview-field-label">模式</span>
							<select value={modeId} onChange={(e) => setModeId(e.target.value)}>
								{axes.modes.map((mode) => (
									<option key={mode.id} value={mode.id}>
										{mode.label}
									</option>
								))}
							</select>
						</label>
						<label className="preview-field">
							<span className="preview-field-label">风格</span>
							<select value={styleSel} onChange={(e) => setStyleSel(e.target.value)}>
								<option value={FOLLOW_CURRENT_STYLE}>跟随当前设置（{currentStyleLabel}）</option>
								{styleConfig.styles.map((style) => (
									<option key={style.id} value={style.id}>
										{style.label}
									</option>
								))}
								<option value="">关闭</option>
							</select>
						</label>
						<span className="bar-spacer" />
						<button
							type="button"
							className={`mini-btn${fullView ? "" : " active"}`}
							onClick={() => setFullView(false)}
						>
							分段视图
						</button>
						<button
							type="button"
							className={`mini-btn${fullView ? " active" : ""}`}
							onClick={() => setFullView(true)}
						>
							完整文本
						</button>
					</div>

					{result === undefined ? (
						error === undefined && <p className="settings-empty">正在组装提示词…</p>
					) : fullView ? (
						<pre className="preview-full">{result.segments.map((s) => s.text).join("")}</pre>
					) : (
						<div className="preview-segments">
							{result.segments.map((seg, index) => (
								<div key={index} className="seg-card">
									<button
										type="button"
										className="seg-head"
										aria-expanded={expanded.has(index)}
										onClick={() => toggleSegment(index)}
									>
										<span className={`seg-tag seg-${sourceCategory(seg.source)}`}>{seg.source}</span>
										<span className="seg-chars">{seg.chars} 字</span>
										<span className={`seg-chevron${expanded.has(index) ? " open" : ""}`}>
											<IconChevronRight size={12} />
										</span>
									</button>
									{expanded.has(index) && <pre className="seg-body">{seg.text}</pre>}
								</div>
							))}
						</div>
					)}

					<p className="settings-foot">
						预览按所选三轴现场组装，与真实会话同一条组装路径；pi 上下文段（项目指令、工具提示）与
						expert 模式的专家人格段不在预览中出现，真实会话会额外携带。
					</p>
				</>
			)}
		</section>
	);
}

/* ── 权限 ──────────────────────────────────────────────────────── */

/**
 * 权限预设选择器（对标 WorkBuddy 设置里的「默认权限 / 允许完全访问」）。
 *
 * 展示的是**预设**（三档人话），底下真正生效的是两个旋钮
 * （沙箱模式 × 审批策略）—— 旋钮是权威，预设只是捆绑包。
 * 手工编辑过偏好文件、旋钮组合对不上任何预设时显示「自定义」。
 */
function PermissionSection({ busy }: { readonly busy: boolean }): React.JSX.Element {
	const [info, setInfo] = useState<PermissionInfo | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	const refresh = useCallback(async (): Promise<void> => {
		try {
			setInfo(await window.kami.getPermissions());
			setError(undefined);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const pick = (presetId: string): void => {
		const preset = PERMISSION_PRESETS.find((p) => p.id === presetId);
		if (preset === undefined) return;
		void window.kami
			.setPermissions({ sandbox: preset.sandbox, approval: preset.approval })
			// 用返回值直接更新，省一次往返；daemon 已把 presetId 规范化。
			.then((next) => setInfo(next))
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	};

	const current = info?.settings.presetId;

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>权限</h2>
				{current === CUSTOM_PRESET && <span className="provider-tag">自定义</span>}
			</header>

			{error !== undefined && <div className="settings-error">{error}</div>}

			{info === undefined ? (
				<p className="settings-empty">正在读取权限设置…</p>
			) : (
				<>
					<div className="preset-list">
						{PERMISSION_PRESETS.map((preset) => (
							<button
								key={preset.id}
								type="button"
								className={`preset-item${current === preset.id ? " active" : ""}`}
								disabled={busy}
								onClick={() => pick(preset.id)}
							>
								<span className={`preset-dot${current === preset.id ? " on" : ""}`} />
								<span className="preset-text">
									<span className="preset-label">{preset.label}</span>
									<span className="preset-desc">{preset.description}</span>
								</span>
							</button>
						))}
					</div>
					{/*
						强制力声明：我们没有操作系统级沙箱，必须如实说明，
						否则用户会把它当隔离用（文案由 daemon 给，见 buildPermissionInfo）。
					*/}
					<p className="settings-foot">{info.enforcementNote}</p>
				</>
			)}
		</section>
	);
}

/* ── 默认存储路径 ──────────────────────────────────────────────── */

/**
 * 返回形状从 bridge 契约推导，不在此重复声明 —— 两处声明同一形状必然漂移
 * （AGENTS.md §4：类型集中在 shared）。
 */
type DefaultWorkspaceInfo = Awaited<ReturnType<typeof window.kami.getDefaultWorkspacePath>>;

/**
 * 默认存储路径（对标 WorkBuddy 设置里的 workspaceStorage）。
 *
 * 生效根的分层（env KAMIBUDDY_WORKSPACE_DIR > 设置项 > 内置默认）与非法回退
 * 都在 daemon 侧判定，这里只展示结果 —— renderer 若各写一份优先级逻辑，
 * 改规则时两边必然漂移。
 */
function DefaultWorkspaceSection({ busy }: { readonly busy: boolean }): React.JSX.Element {
	const [info, setInfo] = useState<DefaultWorkspaceInfo | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	const refresh = useCallback(async (): Promise<void> => {
		try {
			setInfo(await window.kami.getDefaultWorkspacePath());
			setError(undefined);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	/** 修改：系统目录选择框 → 写入设置项 → 刷新。取消不算错误，静默收回。 */
	const change = (): void => {
		void window.kami
			.pickWorkspaceDirectory()
			.then((path) => {
				if (path === undefined) return;
				return window.kami.setDefaultWorkspacePath(path).then(() => refresh());
			})
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	};

	/** 还原默认：空串 = 清除设置项（契约约定），daemon 回退内置默认。 */
	const reset = (): void => {
		void window.kami
			.setDefaultWorkspacePath("")
			.then(() => refresh())
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	};

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>默认存储路径</h2>
				<button type="button" className="mini-btn" disabled={busy} onClick={change}>
					修改
				</button>
				{/* 已是默认时「还原」无意义，藏起来比禁用更能说明当前状态。 */}
				{info !== undefined && !info.isDefault && (
					<button type="button" className="mini-btn danger" disabled={busy} onClick={reset}>
						还原默认
					</button>
				)}
			</header>

			{error !== undefined && <div className="settings-error">{error}</div>}

			{info === undefined ? (
				<p className="settings-empty">正在读取存储路径…</p>
			) : (
				<>
					<div className="provider-row">
						<div className="provider-main">
							{/* 路径可能很长，悬停给全量（同 sidebar 空间组头的做法）。 */}
							<span className="provider-name" title={info.effective}>
								{info.effective}
							</span>
							{info.isDefault && <span className="provider-tag">默认</span>}
						</div>
					</div>
					<p className="settings-foot">新建的任务与工作空间会存放在该目录下；修改不影响已有任务的存放位置。</p>
				</>
			)}
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
					spellCheck={false}
					autoComplete="off"
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
					type="url"
					value={form.baseUrl}
					placeholder="https://api.example.com/v1"
					autoComplete="off"
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
							aria-label="模型 ID"
							placeholder="模型 ID，如 glm-4.7"
							onChange={(e) => patchModel(index, { id: e.target.value })}
						/>
						<input
							className="model-name"
							value={model.name}
							aria-label="模型显示名"
							placeholder="显示名（可留空）"
							onChange={(e) => patchModel(index, { name: e.target.value })}
						/>
						<input
							className="model-num"
							type="number"
							value={model.contextWindow}
							aria-label="上下文窗口"
							title="上下文窗口"
							onChange={(e) => patchModel(index, { contextWindow: Number(e.target.value) })}
						/>
						<input
							className="model-num"
							type="number"
							value={model.maxTokens}
							aria-label="单次最大输出"
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
									{new Intl.NumberFormat("zh-CN").format(Math.round(model.contextWindow / 1000))}K
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

						<ThinkingLevelSection busy={busy} />

						<StyleSection busy={busy} />

						<PromptPreviewSection />

						<PermissionSection busy={busy} />

						<DefaultWorkspaceSection busy={busy} />

						<MemorySection busy={busy} />

						<p className="settings-foot">配置目录：{snapshot.configDir}</p>
					</>
				)}
			</div>
		</main>
	);
}
