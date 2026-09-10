/**
 * 连接器页（技能页「连接器」页签）：MCP server 管理。
 *
 * 数据流：daemon 是状态的唯一组装方（McpServerInfo 的 status / toolCount /
 * error 都在快照里给全，本页不推导）。挂载拉一次快照，操作
 * （启停 / 添加 / 编辑原文）成功后重拉；没有状态推送通道——
 * 连接状态只在 daemon 写配置触发重连后变化，变化的发起方就是本页自己。
 *
 * 添加服务器走「读原文 → 结构化插入 → 写回」。mcp.json 允许 JSONC
 * （注释 / 尾逗号，core/mcp-config.ts），JSON.parse 接不住时表单如实报错、
 * 指引改用「编辑配置」手工添加——不为表单化硬吞用户手写的注释。
 *
 * 本页只 import @shared（AGENTS.md §1.3）。
 */

import { useCallback, useEffect, useState } from "react";
import type { McpConfigSnapshot, McpServerInfo } from "@shared/ipc.ts";
import { IconEdit, IconPlus, IconRefresh } from "./icons.tsx";

interface ConnectorsViewProps {
	readonly onToast: (text: string) => void;
}

function errorText(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function ConnectorsView({ onToast }: ConnectorsViewProps): React.JSX.Element {
	const [snapshot, setSnapshot] = useState<McpConfigSnapshot | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);
	/** 行操作（启停）在途：禁用行内控件，避免连点发出重复请求。 */
	const [busy, setBusy] = useState(false);
	/** 添加服务器表单草稿；undefined = 关闭。 */
	const [draft, setDraft] = useState<AddFormDraft | undefined>(undefined);
	const [formError, setFormError] = useState<string | undefined>(undefined);
	/** JSON 编辑器文本；undefined = 关闭。 */
	const [editorText, setEditorText] = useState<string | undefined>(undefined);
	const [editorError, setEditorError] = useState<string | undefined>(undefined);
	const [saving, setSaving] = useState(false);

	const load = useCallback(async (): Promise<void> => {
		try {
			setSnapshot(await window.kami.mcpConfigGet());
			setError(undefined);
		} catch (e) {
			setError(errorText(e));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const toggleServer = useCallback(
		(server: McpServerInfo, enabled: boolean): void => {
			setBusy(true);
			window.kami
				.mcpServerToggle(server.name, enabled)
				.then(() => {
					onToast(`已${enabled ? "启用" : "禁用"}「${server.name}」`);
					void load();
				})
				.catch((e: unknown) => setError(errorText(e)))
				.finally(() => setBusy(false));
		},
		[load, onToast],
	);

	const openAdd = useCallback((): void => {
		setFormError(undefined);
		setDraft(emptyDraft());
	}, []);

	const openEditor = useCallback((): void => {
		if (snapshot === undefined) return;
		setEditorError(undefined);
		// 两级文件都没有时 daemon 给空串（契约语义）：编辑器从骨架起步，
		// 不让用户面对一片空白猜结构。
		setEditorText(
			snapshot.configJson.trim() === ""
				? '{\n\t"mcpServers": {}\n}'
				: snapshot.configJson,
		);
	}, [snapshot]);

	const saveAdd = useCallback((): void => {
		if (draft === undefined || snapshot === undefined || saving) return;
		const name = draft.name.trim();
		if (name === "") {
			setFormError("请填写服务器名称");
			return;
		}
		if (snapshot.servers.some((s) => s.name === name)) {
			setFormError(`服务器「${name}」已存在`);
			return;
		}
		let serverConfig: Record<string, unknown>;
		if (draft.transport === "stdio") {
			const command = draft.command.trim();
			if (command === "") {
				setFormError("请填写命令");
				return;
			}
			const args = draft.args.split(/\s+/).filter((a) => a !== "");
			const parsed = parseEnvLines(draft.env);
			if ("error" in parsed) {
				setFormError(parsed.error);
				return;
			}
			serverConfig = { command };
			if (args.length > 0) serverConfig["args"] = args;
			if (Object.keys(parsed.env).length > 0) serverConfig["env"] = parsed.env;
		} else {
			const url = draft.url.trim();
			if (url === "") {
				setFormError("请填写 URL");
				return;
			}
			if (!/^https?:\/\//.test(url)) {
				setFormError("URL 需以 http:// 或 https:// 开头");
				return;
			}
			serverConfig = { url };
		}
		// 读原文 → 插入 → 写回。空串是契约明示的「无配置文件」语义，按空对象起步；
		// 非空但 JSON.parse 接不住（JSONC 注释 / 尾逗号）时如实报错，指引走「编辑配置」。
		let config: Record<string, unknown> = {};
		if (snapshot.configJson.trim() !== "") {
			let parsed: unknown;
			try {
				parsed = JSON.parse(snapshot.configJson);
			} catch {
				setFormError("当前配置不是严格 JSON（可能含注释），请改用「编辑配置」手工添加");
				return;
			}
			if (!isRecord(parsed)) {
				setFormError("当前配置结构异常，请改用「编辑配置」修复后再添加");
				return;
			}
			config = parsed;
		}
		const existing = config["mcpServers"];
		if (existing !== undefined && !isRecord(existing)) {
			setFormError("当前配置的 mcpServers 不是对象，请改用「编辑配置」修复后再添加");
			return;
		}
		const next = JSON.stringify(
			{ ...config, mcpServers: { ...(existing ?? {}), [name]: serverConfig } },
			null,
			"\t",
		);
		setSaving(true);
		setFormError(undefined);
		window.kami
			.mcpConfigSet(next)
			.then(() => {
				setDraft(undefined);
				onToast(`已添加服务器「${name}」`);
				void load();
			})
			// daemon 的校验是第二道闸：错误在表单内原位显示，改完直接重试。
			.catch((e: unknown) => setFormError(errorText(e)))
			.finally(() => setSaving(false));
	}, [draft, snapshot, saving, load, onToast]);

	const saveEditor = useCallback((): void => {
		if (editorText === undefined || saving) return;
		const invalid = validateConfigJson(editorText);
		if (invalid !== undefined) {
			setEditorError(invalid);
			return;
		}
		setSaving(true);
		setEditorError(undefined);
		window.kami
			.mcpConfigSet(editorText)
			.then(() => {
				setEditorText(undefined);
				onToast("已保存 MCP 配置");
				void load();
			})
			.catch((e: unknown) => setEditorError(errorText(e)))
			.finally(() => setSaving(false));
	}, [editorText, saving, load, onToast]);

	return (
		<div className="mcp-panel">
			<div className="mcp-toolbar">
				<span className="mcp-toolbar-hint">
					MCP 服务器为对话提供外部工具；配置改动由 daemon 落盘并重新连接
				</span>
				<span className="bar-spacer" />
				<button
					type="button"
					className="mini-btn"
					title="重新拉取连接状态"
					onClick={() => void load()}
				>
					<IconRefresh size={13} />
					刷新
				</button>
				<button
					type="button"
					className="mini-btn"
					disabled={snapshot === undefined}
					onClick={openEditor}
				>
					<IconEdit size={13} />
					编辑配置
				</button>
				<button
					type="button"
					className="mini-btn"
					disabled={snapshot === undefined}
					onClick={openAdd}
				>
					<IconPlus size={13} />
					添加服务器
				</button>
			</div>

			{error !== undefined && <div className="settings-error">{error}</div>}

			{snapshot === undefined ? (
				error === undefined && <p className="settings-empty">正在读取…</p>
			) : snapshot.servers.length === 0 ? (
				<div className="skills-empty">
					<p>还没有配置 MCP 服务器。</p>
					<p>点「添加服务器」接入一个 MCP server；或点「编辑配置」直接编辑 mcp.json。</p>
				</div>
			) : (
				<div className="mcp-list">
					{snapshot.servers.map((server) => (
						<ServerRow
							key={server.name}
							server={server}
							busy={busy}
							onToggle={toggleServer}
						/>
					))}
				</div>
			)}

			{draft !== undefined && (
				<AddServerForm
					draft={draft}
					error={formError}
					saving={saving}
					onChange={setDraft}
					onSave={saveAdd}
					onCancel={() => setDraft(undefined)}
				/>
			)}
			{editorText !== undefined && (
				<JsonEditor
					text={editorText}
					error={editorError}
					saving={saving}
					onChange={setEditorText}
					onSave={saveEditor}
					onCancel={() => setEditorText(undefined)}
				/>
			)}
		</div>
	);
}

/* ── 服务器行 ────────────────────────────────────────────────── */

const STATE_LABEL: Record<McpServerInfo["status"], string> = {
	connecting: "连接中",
	connected: "已连接",
	failed: "连接失败",
	disabled: "已禁用",
};

function ServerRow({
	server,
	busy,
	onToggle,
}: {
	readonly server: McpServerInfo;
	readonly busy: boolean;
	readonly onToggle: (server: McpServerInfo, enabled: boolean) => void;
}): React.JSX.Element {
	const enabled = server.status !== "disabled";
	return (
		<div className="mcp-row">
			<div className="mcp-row-main">
				<div className="mcp-row-text">
					<div className="mcp-row-title">
						<span className="mcp-row-name">{server.name}</span>
						<span
							className={`mcp-badge${server.status !== "disabled" ? ` mcp-badge-${server.status}` : ""}`}
							title={server.status === "failed" ? server.error : undefined}
						>
							{server.status === "connecting" && (
								<span className="mcp-badge-spinner" />
							)}
							{STATE_LABEL[server.status]}
						</span>
						{server.status === "connected" && (
							<span className="mcp-row-tools">{server.toolCount} 个工具</span>
						)}
					</div>
					{server.status === "failed" && server.error !== undefined && (
						<div className="mcp-row-error" title={server.error}>
							{server.error}
						</div>
					)}
				</div>
				<div className="mcp-row-ops">
					<label
						className="mcp-switch"
						title={enabled ? "点击禁用" : "点击启用"}
					>
						<input
							type="checkbox"
							checked={enabled}
							disabled={busy}
							aria-label={`${enabled ? "禁用" : "启用"} ${server.name}`}
							onChange={(e) => onToggle(server, e.currentTarget.checked)}
						/>
						<span className="mcp-switch-track">
							<span className="mcp-switch-thumb" />
						</span>
					</label>
				</div>
			</div>
		</div>
	);
}

/* ── 添加服务器表单 ──────────────────────────────────────────── */

/** 表单草稿：两种传输的参数位并存，切换传输不丢已填的值（同 AutomationsView 的考虑）。 */
interface AddFormDraft {
	name: string;
	transport: "stdio" | "http";
	command: string;
	/** 空格分隔的一行参数（含引号的复杂参数指引走「编辑配置」）。 */
	args: string;
	/** key=value 每行一个。 */
	env: string;
	url: string;
}

function emptyDraft(): AddFormDraft {
	return { name: "", transport: "stdio", command: "", args: "", env: "", url: "" };
}

/** env 文本 → 对象；空行跳过，无 = 的行报错（带行号，用户好定位）。 */
function parseEnvLines(text: string): { env: Record<string, string> } | { error: string } {
	const env: Record<string, string> = {};
	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const trimmed = line.trim();
		if (trimmed === "") continue;
		const eq = trimmed.indexOf("=");
		if (eq <= 0) return { error: `环境变量第 ${i + 1} 行应为 key=value 形式` };
		env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1);
	}
	return { env };
}

function AddServerForm({
	draft,
	error,
	saving,
	onChange,
	onSave,
	onCancel,
}: {
	readonly draft: AddFormDraft;
	readonly error: string | undefined;
	readonly saving: boolean;
	readonly onChange: (draft: AddFormDraft) => void;
	readonly onSave: () => void;
	readonly onCancel: () => void;
}): React.JSX.Element {
	const patch = (part: Partial<AddFormDraft>): void => onChange({ ...draft, ...part });

	return (
		// 遮罩不响应点击关闭：表单内容多，误触一次全丢，只能从按钮退出
		// （与权限弹窗「不许悬空」的考虑一致）。
		<div className="modal-backdrop">
			<div className="mcp-form-card" role="dialog" aria-modal="true">
				<h2 className="save-space-title">添加 MCP 服务器</h2>

				<div className="field">
					<label className="field-label" htmlFor="mcp-name">
						名称
					</label>
					<input
						id="mcp-name"
						type="text"
						value={draft.name}
						placeholder="例如：filesystem"
						onChange={(e) => patch({ name: e.currentTarget.value })}
					/>
				</div>

				<div className="field">
					<span className="field-label">传输方式</span>
					<div className="mcp-radio-row">
						<label>
							<input
								type="radio"
								name="mcp-transport"
								checked={draft.transport === "stdio"}
								onChange={() => patch({ transport: "stdio" })}
							/>
							stdio（本地命令）
						</label>
						<label>
							<input
								type="radio"
								name="mcp-transport"
								checked={draft.transport === "http"}
								onChange={() => patch({ transport: "http" })}
							/>
							HTTP（远程服务）
						</label>
					</div>
				</div>

				{draft.transport === "stdio" ? (
					<>
						<div className="field">
							<label className="field-label" htmlFor="mcp-command">
								命令
							</label>
							<input
								id="mcp-command"
								type="text"
								value={draft.command}
								placeholder="例如：npx"
								onChange={(e) => patch({ command: e.currentTarget.value })}
							/>
						</div>
						<div className="field">
							<label className="field-label" htmlFor="mcp-args">
								参数
							</label>
							<input
								id="mcp-args"
								type="text"
								value={draft.args}
								placeholder="-y @modelcontextprotocol/server-filesystem /path/to/dir"
								onChange={(e) => patch({ args: e.currentTarget.value })}
							/>
							<span className="field-hint">
								以空格分隔；含空格或引号的复杂参数请保存后用「编辑配置」调整。
							</span>
						</div>
						<div className="field">
							<label className="field-label" htmlFor="mcp-env">
								环境变量
							</label>
							<textarea
								id="mcp-env"
								value={draft.env}
								placeholder={"API_KEY=xxx\nOTHER=value"}
								onChange={(e) => patch({ env: e.currentTarget.value })}
							/>
							<span className="field-hint">key=value 每行一个，可留空。</span>
						</div>
					</>
				) : (
					<div className="field">
						<label className="field-label" htmlFor="mcp-url">
							URL
						</label>
						<input
							id="mcp-url"
							type="text"
							value={draft.url}
							placeholder="http://localhost:3000/mcp"
							onChange={(e) => patch({ url: e.currentTarget.value })}
						/>
					</div>
				)}

				{error !== undefined && <p className="save-space-error">{error}</p>}

				<div className="save-space-actions">
					<button type="button" className="mini-btn" disabled={saving} onClick={onCancel}>
						取消
					</button>
					<button type="button" className="primary-btn" disabled={saving} onClick={onSave}>
						{saving ? "保存中…" : "保存"}
					</button>
				</div>
			</div>
		</div>
	);
}

/* ── JSON 编辑器 ─────────────────────────────────────────────── */

/**
 * 编辑器保存的前端校验（daemon 侧 IPC 还有第二道闸）：
 * 严格 JSON + {"mcpServers": {...}} 结构。返回给用户看的错误，合法为 undefined。
 */
function validateConfigJson(text: string): string | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (e) {
		return `不是合法 JSON：${errorText(e)}`;
	}
	if (!isRecord(parsed)) {
		return '配置必须是 {"mcpServers": {...}} 结构';
	}
	const servers = parsed["mcpServers"];
	if (servers !== undefined && !isRecord(servers)) {
		return "mcpServers 必须是对象（server 名 → 配置）";
	}
	return undefined;
}

function JsonEditor({
	text,
	error,
	saving,
	onChange,
	onSave,
	onCancel,
}: {
	readonly text: string;
	readonly error: string | undefined;
	readonly saving: boolean;
	readonly onChange: (text: string) => void;
	readonly onSave: () => void;
	readonly onCancel: () => void;
}): React.JSX.Element {
	return (
		// 遮罩不响应点击关闭（同添加表单：编辑中的文本误触即丢）。
		<div className="modal-backdrop">
			<div className="mcp-editor-card" role="dialog" aria-modal="true">
				<h2 className="save-space-title">编辑 MCP 配置</h2>
				<textarea
					className="mcp-json-editor"
					value={text}
					spellCheck={false}
					aria-label="mcp.json 原文"
					onChange={(e) => onChange(e.currentTarget.value)}
				/>
				<span className="field-hint">
					直接编辑 mcp.json 原文，需保持 mcpServers 对象结构；保存时前后端各校验一次。
				</span>
				{error !== undefined && <p className="save-space-error">{error}</p>}
				<div className="save-space-actions">
					<button type="button" className="mini-btn" disabled={saving} onClick={onCancel}>
						取消
					</button>
					<button type="button" className="primary-btn" disabled={saving} onClick={onSave}>
						{saving ? "保存中…" : "保存"}
					</button>
				</div>
			</div>
		</div>
	);
}
