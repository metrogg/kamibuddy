/**
 * 设置「通用」分组：默认推理强度、联网搜索、默认存储路径、权限。
 *
 * 四个分区自原 settings-view.tsx 平铺页原样搬入（spec: rework-settings-layout），
 * 各自的数据源与注释前提不变：
 *   1. 密钥存 pi 的 auth.json（0600），本页只负责收集、不落盘、不回显。
 *   2. **未配凭据的服务商，其模型照样在目录里**，所以必须显式区分可用性，
 *      否则用户会选到一个点了才报错的模型。
 *   3. 自定义服务商的密钥同样走 auth.json，models.json 不留明文。
 *
 * 本页只 import @shared（AGENTS.md §1.3），一个 pi 概念都不认识。
 */

import { useCallback, useEffect, useState } from "react";
import type {
	WebSearchConfigInfo,
	WebSearchProviderId,
	WebSearchTestResult,
} from "@shared/settings.ts";
import { WEB_SEARCH_PROVIDERS } from "@shared/settings.ts";
import type { ThinkingLevel } from "@shared/session-events.ts";
import { THINKING_LEVEL_LABELS } from "@shared/session-events.ts";
import type { PermissionInfo } from "@shared/permissions.ts";
import { SelectField } from "./select-field.tsx";
import { CUSTOM_PRESET, PERMISSION_PRESETS } from "@shared/permissions.ts";

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
						<SelectField
							ariaLabel="新建会话的初始档位"
							value={level}
							disabled={busy}
							options={options.map((option) => ({ value: option, label: THINKING_LEVEL_LABELS[option] }))}
							onChange={(value) => change(value as ThinkingLevel)}
						/>
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
					<SelectField
						ariaLabel="搜索服务商"
						value={providerId}
						disabled={busy}
						placeholder="选择搜索服务商"
						options={WEB_SEARCH_PROVIDERS.map((p) => ({ value: p.id, label: `${p.name} — ${p.description}` }))}
						onChange={(value) => setProviderId(value as WebSearchProviderId)}
					/>
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

/* ── 分组出口 ────────────────────────────────────────────────────── */

/** 「通用」分组：分区顺序即原平铺页的相对顺序。 */
export function GeneralSection({ busy }: { readonly busy: boolean }): React.JSX.Element {
	return (
		<>
			<ThinkingLevelSection busy={busy} />
			<WebSearchSection busy={busy} />
			<DefaultWorkspaceSection busy={busy} />
			<PermissionSection busy={busy} />
		</>
	);
}
