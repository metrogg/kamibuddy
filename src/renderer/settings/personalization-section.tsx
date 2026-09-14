/**
 * 设置「个性化」分组：回复风格（自原平铺页原样搬入）+ 自定义指令 /
 * 称呼与身份 / 对话体验开关（spec: rework-settings-layout Task 3）。
 *
 * 后三组控件共用一份 getPersonalization（一个 IPC 拿全 6 个键），
 * 编辑块的编辑模式复用画像口径（draft + 保存基线 + 内容变化才可点保存，
 * 见 memory-section），另加失焦提交 —— 编辑完点出输入框即存上。
 */

import { useEffect, useRef, useState } from "react";
import type { PersonalizationInfo, PersonalizationPatch } from "@shared/ipc.ts";
import type { StyleConfigInfo } from "@shared/settings.ts";
import { ErrorState, LoadingState } from "../state-views.tsx";
import { SelectField } from "./select-field.tsx";

/** 自定义指令上限（与 compose 注入的截断口径一致，输入侧就拦住）。 */
const CUSTOM_INSTRUCTIONS_MAX = 1500;

/** 保存成功确认的停留时长。 */
const SAVED_FLASH_MS = 1500;

/**
 * 保存成功的短暂确认（落在保存按钮的文字上）。
 *
 * 为什么必须有：编辑块的失焦会先一步提交 —— 点「保存」的 mousedown 就触发
 * blur，保存随即完成，按钮在鼠标松开前已因「内容没有变化」变灰，点击落到
 * 禁用按钮上被吞掉。实测现象就是「输入完点保存毫无反应」，而数据其实已经
 * 落盘（用户无法分辨）。有这个确认，失焦提交与点击提交两条路径都有反馈。
 */
function useSavedFlash(): { readonly saved: boolean; readonly flash: () => void } {
	const [saved, setSaved] = useState(false);
	const timerRef = useRef<number | undefined>(undefined);

	useEffect(
		() => () => {
			if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
		},
		[],
	);

	const flash = (): void => {
		setSaved(true);
		if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
		timerRef.current = window.setTimeout(() => setSaved(false), SAVED_FLASH_MS);
	};

	return { saved, flash };
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

			{error !== undefined && <ErrorState message={error} />}

			{config === undefined ? (
				<LoadingState text="正在读取回复风格设置…" />
			) : (
				<>
					<div className="provider-row">
						<div className="provider-main">
							<span className="provider-name">回复的表达方式</span>
						<span className="bar-spacer" />
						<SelectField
							ariaLabel="回复的表达方式"
							value={config.styleId}
							disabled={busy}
							options={[...config.styles.map((style) => ({ value: style.id, label: style.label })), { value: "", label: "关闭" }]}
							onChange={(value) => change(value)}
						/>
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

/* ── 自定义指令 ──────────────────────────────────────────────────── */

/**
 * 自定义指令（对齐 WB always_applied_user_rules 语义：用户设定、酌情遵循，
 * compose 注入为独立「用户规则」段）。编辑模式复用画像口径，另加失焦提交；
 * 清空（trim 后为空）= 删除该键回到未设置态（契约见 shared/ipc.ts）。
 */
function CustomInstructionsSection({
	busy,
	saved,
	onSubmit,
}: {
	readonly busy: boolean;
	/** 保存基线（已持久化的值）：「保存」只在内容变化后可点。 */
	readonly saved: string;
	readonly onSubmit: (patch: PersonalizationPatch) => Promise<void>;
}): React.JSX.Element {
	const [draft, setDraft] = useState(saved);
	const dirty = draft !== saved;
	const { saved: justSaved, flash } = useSavedFlash();

	const save = (): void => {
		// 失败由父级统一透出错误条；draft 保持脏态，可改可再点保存。
		void onSubmit({ customInstructions: draft }).then(flash).catch(() => { });
	};

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>自定义指令</h2>
				<button
					type="button"
					className={`mini-btn${justSaved ? " saved" : ""}`}
					disabled={busy || !dirty}
					title={dirty || justSaved ? undefined : "内容没有变化"}
					onClick={save}
				>
					{justSaved ? "已保存" : "保存"}
				</button>
			</header>
			<textarea
				className="profile-textarea"
				value={draft}
				disabled={busy}
				maxLength={CUSTOM_INSTRUCTIONS_MAX}
				placeholder="还没有自定义指令。写几条希望 AI 一直遵守的要求。"
				onChange={(e) => setDraft(e.currentTarget.value)}
				onBlur={() => {
					// 失焦即提交（与保存按钮同一条路径）：编辑完点走就存上。
					if (dirty) save();
				}}
			/>
			<div className="textarea-count">
				{draft.length} / {CUSTOM_INSTRUCTIONS_MAX}
			</div>
			<p className="settings-foot">
				写几条希望 AI 一直遵守的规则，对之后的每个任务都生效；清空即取消。
			</p>
		</section>
	);
}

/* ── 称呼与身份 ──────────────────────────────────────────────────── */

/**
 * 称呼与身份：对你的称呼 / AI 的名字 / 人设描述（WB SOUL.md 的轻量字段版）。
 * 三行一个保存单元：任一行变了「保存」才可点，一次补丁带走三个键
 * （setPersonalization 是部分更新，其余键不受影响）；失焦同样提交。
 */
function IdentitySection({
	busy,
	saved,
	onSubmit,
}: {
	readonly busy: boolean;
	readonly saved: PersonalizationInfo;
	readonly onSubmit: (patch: PersonalizationPatch) => Promise<void>;
}): React.JSX.Element {
	const [nickname, setNickname] = useState(saved.userNickname);
	const [assistantName, setAssistantName] = useState(saved.assistantName);
	const [persona, setPersona] = useState(saved.personaDescription);
	const dirty =
		nickname !== saved.userNickname ||
		assistantName !== saved.assistantName ||
		persona !== saved.personaDescription;
	const { saved: justSaved, flash } = useSavedFlash();

	const save = (): void => {
		void onSubmit({
			userNickname: nickname,
			assistantName,
			personaDescription: persona,
		}).then(flash).catch(() => { });
	};

	/** 失焦提交（与自定义指令同口径）：有改动才发补丁。 */
	const commitIfDirty = (): void => {
		if (dirty) save();
	};

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>称呼与身份</h2>
				<button
					type="button"
					className={`mini-btn${justSaved ? " saved" : ""}`}
					disabled={busy || !dirty}
					title={dirty || justSaved ? undefined : "内容没有变化"}
					onClick={save}
				>
					{justSaved ? "已保存" : "保存"}
				</button>
			</header>
			<div className="identity-fields">
				<label className="field">
					<span className="field-label">对你的称呼</span>
					<input
						type="text"
						value={nickname}
						disabled={busy}
						placeholder="未设置，点击填写"
						onChange={(e) => setNickname(e.currentTarget.value)}
						onBlur={commitIfDirty}
					/>
				</label>
				<label className="field">
					<span className="field-label">AI 的名字</span>
					<input
						type="text"
						value={assistantName}
						disabled={busy}
						placeholder="未设置时用默认名字"
						onChange={(e) => setAssistantName(e.currentTarget.value)}
						onBlur={commitIfDirty}
					/>
				</label>
				<label className="field">
					<span className="field-label">人设 / 人格描述</span>
					<textarea
						className="profile-textarea persona-textarea"
						value={persona}
						disabled={busy}
						placeholder="还没有人设描述。写几句希望 AI 呈现的性格与说话方式。"
						onChange={(e) => setPersona(e.currentTarget.value)}
						onBlur={commitIfDirty}
					/>
				</label>
			</div>
			<p className="settings-foot">
				这些会在每轮对话开始时告诉 AI，留空的项不提；保存后下一轮对话生效。
			</p>
		</section>
	);
}

/* ── 对话体验开关 ──────────────────────────────────────────────────── */

/**
 * 两个 UI 行为开关（不进提示词）。缺省值由 daemon 合并（都缺省 true），
 * setPersonalization 只在用户主动切换时写 —— 读取不落盘。
 * 开关复用连接器页的 mcp-switch 档位（同一个开关控件，不另造类）。
 */
function BehaviorSection({
	busy,
	info,
	onToggle,
}: {
	readonly busy: boolean;
	readonly info: PersonalizationInfo;
	readonly onToggle: (key: "welcomeGreeting" | "showChangeDetails", next: boolean) => void;
}): React.JSX.Element {
	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>对话体验</h2>
			</header>
			<div className="provider-row">
				<div className="provider-main">
					<span className="provider-name">加载欢迎语</span>
					<span className="provider-meta">会话加载较慢时，用一句问候陪你等待</span>
					<span className="bar-spacer" />
					<label className="mcp-switch" title={info.welcomeGreeting ? "点击停用" : "点击启用"}>
						<input
							type="checkbox"
							checked={info.welcomeGreeting}
							disabled={busy}
							aria-label="加载欢迎语"
							onChange={(e) => onToggle("welcomeGreeting", e.currentTarget.checked)}
						/>
						<span className="mcp-switch-track">
							<span className="mcp-switch-thumb" />
						</span>
					</label>
				</div>
			</div>
			<div className="provider-row">
				<div className="provider-main">
					<span className="provider-name">展示文件变更过程详情</span>
					<span className="provider-meta">在模型输出过程中展示文件变更的过程详情</span>
					<span className="bar-spacer" />
					<label className="mcp-switch" title={info.showChangeDetails ? "点击停用" : "点击启用"}>
						<input
							type="checkbox"
							checked={info.showChangeDetails}
							disabled={busy}
							aria-label="展示文件变更过程详情"
							onChange={(e) => onToggle("showChangeDetails", e.currentTarget.checked)}
						/>
						<span className="mcp-switch-track">
							<span className="mcp-switch-thumb" />
						</span>
					</label>
				</div>
			</div>
		</section>
	);
}

/* ── 分组出口 ────────────────────────────────────────────────────── */

export function PersonalizationSection({ busy }: { readonly busy: boolean }): React.JSX.Element {
	const [info, setInfo] = useState<PersonalizationInfo | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		window.kami
			.getPersonalization()
			.then((result) => setInfo(result))
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	}, []);

	/**
	 * 文本块保存的唯一出口：非乐观 —— 成功后基线（info）才前进，
	 * 失败时子组件的 draft 保持脏态可重试，错误在本分组顶部透出。
	 */
	const submit = (patch: PersonalizationPatch): Promise<void> =>
		window.kami.setPersonalization(patch).then(
			() => setInfo((cur) => (cur === undefined ? cur : { ...cur, ...patch })),
			(e: unknown) => {
				setError(e instanceof Error ? e.message : String(e));
				throw e;
			},
		);

	/** 开关的乐观切换：失败回滚显示值（开关是受控的，不回滚会让用户以为已存上）。 */
	const toggle = (key: "welcomeGreeting" | "showChangeDetails", next: boolean): void => {
		const prev = info;
		if (prev === undefined) return;
		const patch: PersonalizationPatch =
			key === "welcomeGreeting" ? { welcomeGreeting: next } : { showChangeDetails: next };
		setInfo({ ...prev, ...patch });
		void window.kami.setPersonalization(patch).catch((e: unknown) => {
			setInfo(prev);
			setError(e instanceof Error ? e.message : String(e));
		});
	};

	return (
		<>
			<StyleSection busy={busy} />
			{info === undefined ? (
				<section className="settings-section">
					{error !== undefined ? (
						<ErrorState message={error} />
					) : (
						<LoadingState text="正在读取个性化设置…" />
					)}
				</section>
			) : (
				<>
					{/* 保存/切换失败的统一透出位：挂在第一组新控件上方。 */}
					{error !== undefined && (
						<section className="settings-section">
							<ErrorState message={error} />
						</section>
					)}
					<CustomInstructionsSection busy={busy} saved={info.customInstructions} onSubmit={submit} />
					<IdentitySection busy={busy} saved={info} onSubmit={submit} />
					<BehaviorSection busy={busy} info={info} onToggle={toggle} />
				</>
			)}
		</>
	);
}
