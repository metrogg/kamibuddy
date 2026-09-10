/**
 * IPC 契约 —— 主进程与渲染进程之间的唯一约定来源。
 *
 * AGENTS.md §4：通道名和 payload 类型集中在这里，两侧都从这里 import。
 * 不许在任何一侧写通道名字符串字面量——那样改名必漏。
 * （WorkBuddy 同样把 50+ 通道契约集中在 main/contract*.js，是同一个考虑。）
 *
 * 数据流向：
 *
 *   renderer ──invoke──► main ──MessagePort──► daemon      请求/响应
 *   renderer ◄──send──── main ◄──MessagePort── daemon      事件推送
 *
 * main 只做转发，不解释 payload。业务判断全在 daemon。
 */

import type { AutomationTask, Schedule } from "./automation.ts";
import type { ImagePart } from "./image.ts";
import type { ObservabilitySnapshot } from "./observability.ts";
import type { PermissionInfo, PermissionSettings } from "./permissions.ts";
import type { SessionEventEnvelope, SessionSnapshot, ThinkingLevel } from "./session-events.ts";
import type {
	CustomProviderInput,
	SettingsSnapshot,
	SkillsSnapshot,
	SkillInfo,
	WebSearchConfigInfo,
	WebSearchConfigInput,
	WebSearchTestResult,
} from "./settings.ts";

/* ────────────────────────────────────────────────────────────────
 * 通道名
 * ──────────────────────────────────────────────────────────────── */

/** renderer → daemon，请求/响应式（ipcRenderer.invoke）。 */
export const INVOKE = {
	/**
	 * 查询 daemon 当前是否就绪。由 main 本地应答，不转发。
	 *
	 * 存在的必要性：daemon 的 ready 推送与渲染进程注册监听器之间存在竞态
	 * （daemon 要 await import 整个 pi SDK，渲染进程要加载自己的 bundle，
	 * 谁先完成取决于机器）。若推送早于监听器注册就会永久丢失，
	 * 界面卡在"正在启动"且无法恢复。渲染进程挂载后主动查一次即可消除竞态。
	 */
	daemonStatus: "daemon:status",
	/**
	 * 拉取完整会话状态。渲染进程挂载、或 HMR 之后调用。
	 * sessionId 缺省 = 当前活动会话（保持既有调用方语义）；
	 * 指定 id 时拉取对应会话的快照——多任务并发后 renderer 按 id 缓存
	 * 各会话视图，后台会话的现场恢复/兜底重拉走这里。
	 */
	snapshot: "session:snapshot",
	/** 发送一条用户消息。 */
	prompt: "session:prompt",
	/** 中断当前 run。 */
	abort: "session:abort",
	/** 新建任务：作废旧会话、开全新会话。 */
	newTask: "session:new-task",
	/**
	 * 拉取输入框补全数据源：`@` 的文件列表（当前工作空间内）与 `/` 的命令列表。
	 * 返回相对路径/命令名，renderer 自己做过滤与下拉。
	 */
	completions: "session:completions",
	/**
	 * 弹出系统文件选择框（图片 + 文档多选，filters 分「所有支持的文件/图片/文档」三组），
	 * 返回 PickedInputFiles：图片读出内容编码成 ImagePart，文档只回路径不读内容
	 * （内容读取是 read_document 工具的职责，模型按需读、有截断与续读；
	 * 在这里预读会把整份大文档一次性挤进首条消息）。
	 * 由 main 本地应答（dialog 与文件读取都要 Electron/Node 能力），
	 * 用户取消返回 undefined。main 读图片的理由：渲染进程是沙箱 web 环境，
	 * 拿不到任意路径的字节；与其开两条通道不如在 dialog 应答里一并完成。
	 */
	pickInputFiles: "session:pick-input-files",
	/** 切换场景（work / code / design）。对应 WorkBuddy 的 welcomemode 轴。 */
	setScene: "session:set-scene",
	/** 切换交互模式（ask / craft / plan / expert）。对应 interactionmode 轴。 */
	setInteraction: "session:set-interaction",
	/** 切换模型。 */
	setModel: "session:set-model",
	/**
	 * 切换当前会话的推理强度档位。作用于当前会话桶的宿主；
	 * pi 恒 clamp 到模型能力内并逐会话持久化（resume 自动还原），
	 * 生效值随下一条 session_state 下发。
	 */
	setThinkingLevel: "session:set-thinking-level",
	/**
	 * 历史会话列表（全部工作目录，含临时任务）。
	 * title / isTempTask 等展示字段由 daemon 组装好，UI 不再推导。
	 */
	sessionList: "session:list",
	/**
	 * 恢复指定历史会话为当前活动会话。path 来自 SessionSummary.path，
	 * daemon 侧有路径守卫（限会话目录内的 .jsonl，防 ../ 穿越）。
	 */
	sessionResume: "session:resume",
	/** 重命名会话（写入 pi 的 session_info 条目）。path 定位，name 为新名。 */
	sessionRename: "session:rename",
	/** 删除会话文件。当前活动会话由 daemon 拒删（需先新建任务）。 */
	sessionDelete: "session:delete",
	/**
	 * 把当前会话导出为单文件 HTML（pi 的 AgentSession.exportToHtml）。
	 * path 来自 SessionSummary.path 定位会话；产物落在默认根 exports/ 下，
	 * 返回导出文件的绝对路径。
	 */
	sessionExport: "session:export",
	/**
	 * 把当前临时任务会话「保存到工作空间」转正：以 name 在默认根下创建目录、
	 * 会话以新 cwd 重建并归入新空间组；已生成文件留在临时目录不动
	 * （共享临时目录无法干净归属单个任务的文件，WorkBuddy 同结构）。
	 * name 经 daemon 校验（工作空间命名规则）；当前会话非临时任务时由 daemon 拒绝。
	 */
	saveToWorkspace: "session:save-to-workspace",
	/** 拉取当前工作空间与可选列表（默认根 + 已有子目录）。 */
	workspaceSnapshot: "workspace:snapshot",
	/** 在默认根下新建工作空间并切换过去。返回生效的目录路径。 */
	createWorkspace: "workspace:create",
	/**
	 * 切换到指定目录。目录经 daemon 校验（配置目录/应用目录会拒）。返回生效的目录路径。
	 * 传空字符串表示临时任务（不选命名空间，cwd 落共享临时目录）。
	 */
	setWorkspace: "workspace:set",
	/**
	 * 弹出系统目录选择框。由 main 本地应答（要用 Electron dialog）。
	 * 用户取消返回 undefined。
	 */
	pickWorkspaceDirectory: "workspace:pick-directory",
	/**
	 * 空间分组元数据列表：侧栏「空间」区的组头信息。
	 * 组集合由 daemon 从会话文件的 cwd 去重派生，这里只额外携带显示名覆盖。
	 */
	workspaceGroups: "workspace:groups",
	/**
	 * 重命名空间组。只写显示名覆盖（workspaces.json），不动真实目录——
	 * 真实目录可能有会话/进程占用，改名会引发路径失效；显示名覆盖零风险。
	 * 名称经 daemon 校验（validateDisplayName），非法时 reject 原因。
	 */
	workspaceRename: "workspace:rename",
	/**
	 * 从列表移除空间组：该 cwd 下全部会话文件移入回收目录（trash），
	 * 同时清掉显示名覆盖。不删真实目录本身。
	 */
	workspaceRemove: "workspace:remove",
	/**
	 * 在系统文件管理器中打开空间目录（main 侧 shell.openPath）。
	 *
	 * 路径必须在 daemon 侧校验「是已知工作空间」后才能放行：
	 * renderer 是半可信环境，若不校验，任意网页/XSS 都能让 main 对
	 * 任意路径调 shell.openPath（弹 ~\.ssh、系统目录等）。校验放 daemon
	 * 而不是 main，是因为「已知工作空间」的知识只在 daemon（会话文件集合）。
	 */
	workspaceReveal: "workspace:reveal",
	/** 应答 daemon 发来的 UI 请求（确认框/选择框/输入框）。 */
	uiResponse: "ui:response",
	/** 应答权限审批。 */
	permissionResponse: "permission:response",
	/** 应答结构化提问（questionnaire 工具的问卷卡）。 */
	questionnaireResponse: "questionnaire:response",
	/** 在系统默认程序里打开产物文件。 */
	openArtifact: "artifact:open",
	/** 另存为。返回用户选择的路径，取消则返回 undefined。 */
	saveArtifactAs: "artifact:save-as",
	/**
	 * 读产物文件内容（预览面板用）。路径限当前工作区内，
	 * 返回大小与文本（二进制/超大不给文本）。
	 */
	readArtifact: "artifact:read",
	/**
	 * 查询指定 cwd 的产物预览服务 base URL（http://127.0.0.1:端口，根=该目录）。
	 *
	 * PreviewServer 按 cwd 多实例（每 cwd 一个端口，懒建），renderer 按
	 * 当前会话的 cwd 查询——不同 cwd 的会话预览互不影响。
	 * 该 cwd 的服务未启动时返回 undefined：面板显示引导文案即可，不视为错误。
	 * 形状在此钉死，daemon 多根实现（Task 2.7）与 renderer 取用（Task 3.4）并行不漂移。
	 */
	previewBaseUrl: "preview:base-url",

	/* ── 设置 ─────────────────────────────────────────────────────── */

	/** 拉取服务商与模型列表。打开设置页时调用。 */
	settingsSnapshot: "settings:snapshot",
	/**
	 * 存入某家服务商的 API Key。
	 *
	 * 密钥经 renderer → main → daemon 传递，最终由 pi 写进 auth.json（0600）。
	 * main 是哑转发器、daemon 的请求日志只记通道名不记参数 —— 密钥不会落到任何日志里。
	 */
	setApiKey: "settings:set-api-key",
	/** 删除某家服务商的 API Key（仅能删 auth.json 里的，环境变量删不掉）。 */
	removeApiKey: "settings:remove-api-key",
	/** 新增或更新自定义服务商。 */
	saveCustomProvider: "settings:save-custom-provider",
	/** 删除自定义服务商，连带清掉其凭据。 */
	deleteCustomProvider: "settings:delete-custom-provider",
	/** 读回自定义服务商配置，供编辑表单回填。 */
	readCustomProvider: "settings:read-custom-provider",
	/** 联网刷新模型目录。启动时不联网，只在用户主动点击时调。 */
	refreshCatalog: "settings:refresh-catalog",
	/** 读回联网搜索配置（不含 key，只给 provider + 是否已配）。 */
	getWebSearchConfig: "settings:get-web-search-config",
	/** 保存联网搜索配置（服务商 + API Key，Key 落偏好文件）。 */
	setWebSearchConfig: "settings:set-web-search-config",
	/** 清除联网搜索配置。 */
	clearWebSearchConfig: "settings:clear-web-search-config",
	/** 测试联网搜索：用已存的配置真实搜索一次，返回可展示的结果。 */
	testWebSearch: "settings:test-web-search",
	/**
	 * 读默认存储路径。effective 为生效根（env KAMIBUDDY_WORKSPACE_DIR > 设置项 > 内置默认
	 * ~/KamiBuddy，分层对标 WorkBuddy 的 resolveDefaultWorkspaceRoot）；custom 为用户设置项
	 * （未设置时为 undefined）；isDefault 标记 effective 是否就是内置默认。
	 */
	getDefaultWorkspacePath: "settings:get-default-workspace-path",
	/**
	 * 设置默认存储路径。传空字符串 = 还原内置默认（清除设置项）。
	 * 只影响之后新建的任务与工作空间，已有会话 cwd 不变
	 * （对齐 WorkBuddy「修改后不影响已有数据」）。
	 */
	setDefaultWorkspacePath: "settings:set-default-workspace-path",
	/**
	 * 读全局默认推理强度（之后新建会话的初始档位）。
	 * 未配置时 daemon 回 medium 兜底 —— pi 的内置默认就是 medium
	 * （sdk.ts 的 DEFAULT_THINKING_LEVEL），两处默认值不漂移。
	 */
	getThinkingLevelDefault: "settings:get-thinking-level-default",
	/**
	 * 写全局默认推理强度。只影响之后新建的会话；
	 * 既有会话以各自会话内选择为准，不被全局改动回溯（spec 方案 B）。
	 */
	setThinkingLevelDefault: "settings:set-thinking-level-default",

	/* ── 权限 ─────────────────────────────────────────────────────── */

	/** 读回当前权限设置（沙箱模式 + 审批策略 + 强制力）。 */
	getPermissions: "settings:get-permissions",
	/**
	 * 保存权限设置。旋钮是权威值，presetId 由 daemon 按旋钮反算，
	 * 不信任前端传来的 —— 两者不一致时界面会显示成错误的档位。
	 */
	setPermissions: "settings:set-permissions",

	/* ── 技能 ─────────────────────────────────────────────────────── */

	/** 已安装技能清单（独立页面用，不再借道设置快照）。 */
	skillsSnapshot: "skills:snapshot",
	/**
	 * 导入技能：把含 SKILL.md 的文件夹（或单个 .md）复制进用户技能目录。
	 * 返回安装后的技能信息；同名已存在、缺 SKILL.md、frontmatter 不全都会报错。
	 */
	importSkill: "skills:import",
	/**
	 * 弹出系统目录选择框，供导入流程选技能文件夹。由 main 本地应答
	 * （要用 Electron dialog），用户取消返回 undefined。
	 */
	pickSkillDirectory: "skills:pick-directory",

	/* ── MCP 连接器 ─────────────────────────────────────────────── */

	/**
	 * MCP 配置快照：各 server 的运行态（连接状态 + 工具数）+ 生效层级 mcp.json
	 * 的原文（JSONC，供 JSON 编辑器显示）。连接器设置页打开时调用。
	 */
	mcpConfigGet: "mcp:config-get",
	/**
	 * 整体写入 mcp.json（JSON 编辑器的保存）。daemon 写入前做 schema 校验，
	 * 坏了拒写（reject 原因带回），写成功后触发扩展重连。
	 * 写入层级：当前会话有工作区写项目级 <工作区>/.mcp.json，临时任务写用户级。
	 */
	mcpConfigSet: "mcp:config-set",
	/**
	 * 切换单个 server 的启用状态：在定义它的那级 mcp.json 里写 disabled 字段
	 * （jsonc-parser 最小编辑，注释与格式保留），写成功后触发扩展重连。
	 */
	mcpServerToggle: "mcp:server-toggle",

	/* ── 诊断 ─────────────────────────────────────────────────────── */

	/**
	 * 拉取可观测性快照（累计用量、缓存命中率、run 记录、工具统计、上下文成分）。
	 * 诊断页打开时调一次，之后随会话事件刷新，不配专用推送通道——
	 * 会话事件本身就是「该刷新了」的信号，多开一条通道只是重复投递。
	 */
	statsSnapshot: "stats:snapshot",

	/* ── 定时任务 ─────────────────────────────────────────────────── */

	/** 全部定时任务（管理页列表）。 */
	automationList: "automation:list",
	/**
	 * 新建或编辑定时任务（AutomationSaveInput：新建不带 id，编辑带 id）。
	 * 返回落盘后的完整任务（status / nextRunAt / 时间戳由 daemon 算好）。
	 */
	automationSave: "automation:save",
	/** 删除定时任务。正在运行（含排队中）的任务由 daemon 拒删。 */
	automationDelete: "automation:delete",
	/** 启停切换（active ↔ paused；missed 重新启用走这里）。返回切换后的任务。 */
	automationToggle: "automation:toggle",
	/** 立即运行一次（进同一串行队列，不影响既有 nextRunAt 的周期语义）。 */
	automationRunNow: "automation:run-now",
} as const;

/** daemon → renderer，单向推送（webContents.send）。 */
export const PUSH = {
	/** 会话事件流。payload 为 SessionEventEnvelope（sessionId 路由键 + 事件本体）。 */
	sessionEvent: "session:event",
	/**
	 * 任务列表有变更（run 开始/结束、会话增删改），payload 为**完整最新列表**
	 * （与 INVOKE.sessionList 同元素类型），renderer 收到直接替换本地 state。
	 *
	 * 为什么新推一条而不是沿用旧机制：现状是 renderer 在 run_finished 事件里
	 * 重新 invoke sessionList 拉取（拉式），run 开始/结束都要刷新 running 标记后，
	 * 拉式得在两类事件里各挂一次重拉、每个 run 边界多一次往返，且刷新时机
	 * 依赖 renderer 记得订阅；daemon 是列表真相的持有者，变了就推是单向数据流。
	 * 为什么全量而非增量：列表条数小（几十到几百条小对象），增量协议要为
	 * 增/删/改/排序各写一套；daemon 已把 title/current/running 组装好，
	 * 全量替换与重拉等价但少一次往返。首屏仍走 invoke 主动拉一次。
	 */
	taskListChanged: "session:list-changed",
	/** daemon 请求 UI 交互，需要 renderer 用 INVOKE.uiResponse 应答。 */
	uiRequest: "ui:request",
	/** 权限审批请求，需要用 INVOKE.permissionResponse 应答。 */
	permissionRequest: "permission:request",
	/** 结构化提问请求（questionnaire 工具），需要用 INVOKE.questionnaireResponse 应答。 */
	questionnaireRequest: "questionnaire:request",
	/** daemon 就绪。renderer 收到后才拉 snapshot。 */
	daemonReady: "daemon:ready",
	/**
	 * daemon 挂了。UI 应进入不可用态并提示重启。
	 * 不做自动重连——试用阶段静默重连会掩盖真问题（AGENTS.md §7：让它响亮地失败）。
	 */
	daemonDown: "daemon:down",
	/** 定时任务事件（数据变更 / 一次运行结束），payload 为 AutomationEvent。 */
	automationEvent: "automation:event",
} as const;

/* ────────────────────────────────────────────────────────────────
 * 请求 / 响应 payload
 * ──────────────────────────────────────────────────────────────── */

export interface PromptRequest {
	readonly text: string;
	/** 本条消息携带的图片附件（pickInputFiles 选出）。无图时缺省。 */
	readonly images?: readonly ImagePart[];
	/**
	 * 流式期间发来的消息如何处理。
	 * steer：本轮工具执行完后插入；followUp：等 agent 完全停下再发。
	 * 对应 pi 的 steer/followUp 语义，在 adapter 层映射。
	 */
	readonly whileStreaming?: "steer" | "followUp";
}

/**
 * 一份被引用的文档附件：只有路径与文件名，不携带内容。
 * 模型随后经 read_document 按路径自取（区外文件权限门会问，符合预期）。
 */
export interface DocumentReference {
	readonly path: string;
	readonly name: string;
}

/** pickInputFiles 的结果：图片已读成 ImagePart，文档只带路径。 */
export interface PickedInputFiles {
	readonly images: readonly ImagePart[];
	readonly documents: readonly DocumentReference[];
}

export interface SaveArtifactRequest {
	/** 产物在会话工作目录下的相对路径。 */
	readonly path: string;
	/** 另存对话框的默认文件名。 */
	readonly suggestedName: string;
}

/** daemon 的存活状态。由 main 维护——只有它知道子进程的真实状况。 */
export type DaemonStatus =
	| { readonly kind: "starting" }
	| { readonly kind: "ready" }
	| { readonly kind: "down"; readonly reason: string };

/** 工作空间快照。机制对标 WorkBuddy：空间 = 目录，默认根下建同名子目录。 */
export interface WorkspaceSnapshot {
	/** 当前生效的工作空间目录。临时任务时为共享临时目录路径；undefined 仅出现在会话尚未建立的瞬态。 */
	readonly current: string | undefined;
	/** 默认根目录（「新建工作空间」都建在它下面）。 */
	readonly defaultRoot: string;
	/** 默认根下已有的工作空间目录列表。 */
	readonly workspaces: readonly string[];
	/**
	 * 产物预览静态服务的 baseUrl（http://127.0.0.1:端口，根=当前工作区）。
	 * 临时任务会话同样起服务（根=共享临时目录）；undefined 仅出现在尚无工作目录的瞬态。
	 */
	readonly previewBaseUrl: string | undefined;
}

/** readArtifact 的返回：文件大小 + 文本内容（二进制或超大时不给）。 */
export interface ArtifactContent {
	readonly size: number;
	/** UTF-8 文本。二进制（含 NUL）或超过 512KB 时为 undefined。 */
	readonly text: string | undefined;
}

/** 一条 `/` 命令的展示信息（技能 / 自有命令）。 */
export interface CommandItem {
	/** 命令名（不含 /）。技能形如 `skill:docx`，模板形如 `weekly`。 */
	readonly name: string;
	readonly description: string;
	/** 来源，供 renderer 分组显示。 */
	readonly source: "skill" | "template" | "builtin";
}

/** 输入框补全数据源。 */
export interface CompletionData {
	/** `@` 可选文件：当前工作空间内的相对路径（posix 分隔）。临时任务时列共享临时目录内容。 */
	readonly files: readonly string[];
	/** `/` 可选命令。 */
	readonly commands: readonly CommandItem[];
}

/** 一条历史会话的列表项（session:list 的结果元素）。 */
export interface SessionSummary {
	readonly id: string;
	/** 会话文件绝对路径（resume/rename/delete 的定位键）。 */
	readonly path: string;
	/** 列表标题：命名 ?? 首条消息截断（daemon 组装好，UI 不再推导）。 */
	readonly title: string;
	/** 用户命名（appendSessionInfo）；未命名为 undefined，不要用空串。 */
	readonly name?: string;
	/** 会话启动时的工作目录（pi header.cwd）。临时任务会话为共享临时目录（或默认根本身）。 */
	readonly cwd: string;
	/** 是否临时任务会话（daemon 按 cwd===临时任务目录/默认根本身 判定好，UI 不推导）。 */
	readonly isTempTask: boolean;
	/** epoch ms。 */
	readonly createdAt: number;
	readonly modifiedAt: number;
	readonly messageCount: number;
	/** 是否为当前活动会话（至多一条 true）。 */
	readonly current: boolean;
	/**
	 * 是否有正在进行的 run。daemon 权威值（会话注册表的运行态），
	 * renderer 不再用本地 streaming 标记推导列表行状态——
	 * 多任务并发后后台会话也在跑，本地推导只看得见当前会话。
	 */
	readonly running: boolean;
}

/** 「空间」分组的元数据：一个工作目录一条。组本身由会话文件派生（磁盘真相），这里只承载名称覆盖。 */
export interface WorkspaceGroupMeta {
	/** 工作空间目录。与 SessionSummary.cwd 同源（同一 SessionManager resolve 后的绝对路径）。 */
	readonly cwd: string;
	/** 用户给该空间起的显示名；未命名为 undefined，不要用空串。UI 回退到目录 basename。 */
	readonly displayName?: string;
}

/** 一个 MCP server 的运行时状态（连接器设置页的列表行）。 */
export interface McpServerInfo {
	readonly name: string;
	/**
	 * connecting：首次连接进行中 / 断线重连排队中（尚未放弃）；
	 * connected：已连接；failed：连接失败（含重连 5 次放弃），error 带原因；
	 * disabled：配置里 disabled: true，未连接是预期行为不是故障。
	 */
	readonly status: "connecting" | "connected" | "failed" | "disabled";
	/** 该 server 注册进工具面的工具数（mcp__<server>__<tool>）。 */
	readonly toolCount: number;
	/** 最近一次失败原因（failed / 断线待重连时有值）。 */
	readonly error?: string;
}

/** mcpConfigGet 的返回：运行态列表 + 配置文件原文。 */
export interface McpConfigSnapshot {
	readonly servers: readonly McpServerInfo[];
	/**
	 * 生效层级 mcp.json 的原文（JSONC，注释保留），供 JSON 编辑器显示。
	 * 与 mcpConfigSet 的写入目标同一条层级解析路径，不会出现「看的 A 文件、存的 B 文件」。
	 * 两级文件都没有时为空串（编辑器从空白开始）。
	 */
	readonly configJson: string;
}

/**
 * automationSave 的入参：新建不带 id，编辑带 id。
 * status / runs / nextRunAt / 时间戳由 daemon 维护，不接受前端指定 ——
 * daemon 是单一业务判断点，前端传了也不能信。
 */
export interface AutomationSaveInput {
	readonly id?: string;
	readonly name: string;
	readonly prompt: string;
	readonly schedule: Schedule;
	/** 运行时的工作目录（任务工作空间）。 */
	readonly cwd: string;
}

/**
 * 定时任务推送（PUSH.automationEvent 的 payload）。
 * changed：任务数据有变更（增删改 / 启停 / 启动恢复 / 运行记录追加），renderer 重拉列表；
 * runFinished：一次运行结束（手动或到期），renderer 据此 toast 并标记运行会话未读。
 */
export type AutomationEvent =
	| { readonly kind: "changed" }
	| {
		readonly kind: "runFinished";
		readonly taskId: string;
		readonly taskName: string;
		/** 运行会话 id（管理页点击运行记录 / toast 跳转定位用）。装配失败时为空串（无会话可跳）。 */
		readonly sessionId: string;
		readonly success: boolean;
	};

/** invoke 通道的入参与返回值映射。preload 和 renderer 共用，保证类型对齐。 */
export interface InvokeMap {
	[INVOKE.daemonStatus]: { args: []; result: DaemonStatus };
	[INVOKE.snapshot]: { args: [sessionId?: string]; result: SessionSnapshot };
	[INVOKE.prompt]: { args: [PromptRequest]; result: void };
	[INVOKE.abort]: { args: []; result: void };
	[INVOKE.newTask]: { args: []; result: void };
	[INVOKE.completions]: { args: []; result: CompletionData };
	[INVOKE.pickInputFiles]: { args: []; result: PickedInputFiles | undefined };
	[INVOKE.setScene]: { args: [sceneId: string]; result: void };
	[INVOKE.setInteraction]: { args: [interactionId: string]; result: void };
	[INVOKE.setModel]: { args: [modelId: string]; result: void };
	[INVOKE.setThinkingLevel]: { args: [level: ThinkingLevel]; result: void };
	[INVOKE.sessionList]: { args: []; result: SessionSummary[] };
	[INVOKE.sessionResume]: { args: [path: string]; result: void };
	[INVOKE.sessionRename]: { args: [path: string, name: string]; result: void };
	[INVOKE.sessionDelete]: { args: [path: string]; result: void };
	[INVOKE.sessionExport]: { args: [path: string]; result: { outputPath: string } };
	[INVOKE.saveToWorkspace]: { args: [name: string]; result: void };
	[INVOKE.workspaceSnapshot]: { args: []; result: WorkspaceSnapshot };
	[INVOKE.createWorkspace]: { args: [name: string]; result: string };
	[INVOKE.setWorkspace]: { args: [path: string]; result: string | undefined };
	[INVOKE.pickWorkspaceDirectory]: { args: []; result: string | undefined };
	[INVOKE.workspaceGroups]: { args: []; result: WorkspaceGroupMeta[] };
	[INVOKE.workspaceRename]: { args: [cwd: string, name: string]; result: void };
	[INVOKE.workspaceRemove]: { args: [cwd: string]; result: void };
	[INVOKE.workspaceReveal]: { args: [cwd: string]; result: void };
	[INVOKE.uiResponse]: { args: [UiResponse]; result: void };
	[INVOKE.permissionResponse]: { args: [PermissionResponse]; result: void };
	[INVOKE.questionnaireResponse]: { args: [QuestionnaireResponse]; result: void };
	[INVOKE.openArtifact]: { args: [path: string]; result: void };
	[INVOKE.saveArtifactAs]: { args: [SaveArtifactRequest]; result: string | undefined };
	[INVOKE.readArtifact]: { args: [path: string]; result: ArtifactContent };
	[INVOKE.previewBaseUrl]: { args: [cwd: string]; result: string | undefined };

	[INVOKE.settingsSnapshot]: { args: []; result: SettingsSnapshot };
	[INVOKE.setApiKey]: { args: [providerId: string, apiKey: string]; result: void };
	[INVOKE.removeApiKey]: { args: [providerId: string]; result: void };
	/** apiKey 可省略：编辑场景下用户可能只想改 baseUrl，不该被迫重输密钥。 */
	[INVOKE.saveCustomProvider]: { args: [input: CustomProviderInput, apiKey?: string]; result: void };
	[INVOKE.deleteCustomProvider]: { args: [providerId: string]; result: void };
	[INVOKE.readCustomProvider]: { args: [providerId: string]; result: CustomProviderInput | undefined };
	[INVOKE.refreshCatalog]: { args: []; result: void };
	[INVOKE.getWebSearchConfig]: { args: []; result: WebSearchConfigInfo };
	[INVOKE.setWebSearchConfig]: { args: [input: WebSearchConfigInput]; result: void };
	[INVOKE.clearWebSearchConfig]: { args: []; result: void };
	[INVOKE.testWebSearch]: { args: []; result: WebSearchTestResult };
	[INVOKE.getDefaultWorkspacePath]: {
		args: [];
		result: { effective: string; custom: string | undefined; isDefault: boolean };
	};
	[INVOKE.setDefaultWorkspacePath]: { args: [path: string]; result: { effective: string } };
	[INVOKE.getThinkingLevelDefault]: { args: []; result: { level: ThinkingLevel } };
	[INVOKE.setThinkingLevelDefault]: { args: [level: ThinkingLevel]; result: void };
	[INVOKE.getPermissions]: { args: []; result: PermissionInfo };
	[INVOKE.setPermissions]: { args: [settings: PermissionSettings]; result: PermissionInfo };

	[INVOKE.skillsSnapshot]: { args: []; result: SkillsSnapshot };
	[INVOKE.importSkill]: { args: [sourcePath: string]; result: SkillInfo };
	[INVOKE.pickSkillDirectory]: { args: []; result: string | undefined };

	[INVOKE.mcpConfigGet]: { args: []; result: McpConfigSnapshot };
	[INVOKE.mcpConfigSet]: { args: [configJson: string]; result: void };
	[INVOKE.mcpServerToggle]: { args: [serverName: string, enabled: boolean]; result: void };

	[INVOKE.statsSnapshot]: { args: []; result: ObservabilitySnapshot };

	[INVOKE.automationList]: { args: []; result: AutomationTask[] };
	[INVOKE.automationSave]: { args: [input: AutomationSaveInput]; result: AutomationTask };
	[INVOKE.automationDelete]: { args: [id: string]; result: void };
	[INVOKE.automationToggle]: { args: [id: string]; result: AutomationTask };
	[INVOKE.automationRunNow]: { args: [id: string]; result: void };
}

/** push 通道的 payload 映射。 */
export interface PushMap {
	[PUSH.sessionEvent]: SessionEventEnvelope;
	[PUSH.taskListChanged]: readonly SessionSummary[];
	[PUSH.uiRequest]: UiRequest;
	[PUSH.permissionRequest]: PermissionRequest;
	[PUSH.questionnaireRequest]: QuestionnaireRequest;
	[PUSH.daemonReady]: void;
	[PUSH.daemonDown]: { readonly reason: string };
	[PUSH.automationEvent]: AutomationEvent;
}

/* ────────────────────────────────────────────────────────────────
 * UI 请求：pi 的 ExtensionUIContext 跨进程桥
 * ──────────────────────────────────────────────────────────────── */

/**
 * D1 验证结论（ARCHITECTURE.md §5）：pi 的 ExtensionUIContext 是纯接口，
 * 可以由宿主自建实现并通过 bindExtensions({uiContext, mode:"rpc"}) 注入。
 * 其中只有下面这几个方法能跨进程——custom()/setFooter()/setHeader()/
 * setWorking*() 需要真实 TUI 对象，RPC 模式里 pi 自己也是空实现。
 *
 * 所以：简单交互走这条桥，复杂交互（如带工具参数详情的权限面板）
 * 走下面的 PermissionRequest 自有通道，不硬套 ctx.ui。
 */
export type UiRequest = {
	/** 关联 id。daemon 侧以此 resolve 对应的 Promise。 */
	readonly id: string;
} & (
		| { readonly method: "confirm"; readonly title: string; readonly message: string }
		| { readonly method: "select"; readonly title: string; readonly options: readonly string[] }
		| { readonly method: "input"; readonly title: string; readonly placeholder?: string }
		/** 通知是 fire-and-forget，不需要应答，但仍带 id 便于日志关联。 */
		| { readonly method: "notify"; readonly message: string; readonly level: "info" | "warning" | "error" }
	);

export type UiResponse = {
	readonly id: string;
} & (
		| { readonly kind: "confirmed"; readonly value: boolean }
		/** 选择框与输入框取消时 value 为 undefined，对应 pi 接口的 Promise<string | undefined>。 */
		| { readonly kind: "value"; readonly value: string | undefined }
	);

/* ────────────────────────────────────────────────────────────────
 * 权限审批：自有通道
 * ──────────────────────────────────────────────────────────────── */

/**
 * pi 没有内置权限系统（README 明示），本期在扩展层用 tool_call 拦截实现。
 * 比 ctx.ui.confirm 多出来的信息——工具入参、风险等级、"总是允许"——
 * 是产品同事第一天就会用到的，所以单开一条通道而不是塞进 confirm 的文本里。
 */
export interface PermissionRequest {
	readonly id: string;
	readonly toolName: string;
	/** 面向用户的动作描述，如「删除 3 个文件」。 */
	readonly summary: string;
	/** 工具入参，UI 折叠展示。已在 daemon 侧脱敏与截断。 */
	readonly details: string;
	/**
	 * 风险等级，决定弹窗强调程度与默认焦点按钮。
	 * high 时默认焦点在「拒绝」，避免用户回车误批。
	 */
	readonly risk: "low" | "medium" | "high";
}

export interface PermissionResponse {
	readonly id: string;
	readonly decision: "allow" | "deny";
	/**
	 * 本次会话内记住该决定。
	 * 只作用于当前会话、不落盘——试用阶段不引入持久规则文件，
	 * 避免用户误批一次后长期失效却不自知。
	 */
	readonly remember?: boolean;
}

/* ────────────────────────────────────────────────────────────────
 * 结构化提问（questionnaire 工具）：自有通道
 * ──────────────────────────────────────────────────────────────── */

/**
 * questionnaire 工具让模型在动手前就关键选择向用户提问（机制对齐 pi 官方
 * plan-mode 示例的标配工具）。与权限审批同构：daemon 挂起等答，
 * renderer 弹问卷卡逐题作答或整卡跳过，经 INVOKE.questionnaireResponse 回程。
 * 单开一条通道而不是塞进 ctx.ui.select：一次可以问多题、每题带选项、
 * 整卡可跳过，confirm/select 的纯文本承载不了。
 */
export interface QuestionnaireQuestion {
	/** 问题正文。 */
	readonly question: string;
	/** 候选选项（2-6 个）。选项之外的自由补充由 renderer 的「其他」入口负责，不在此列。 */
	readonly options: readonly string[];
}

export interface QuestionnaireRequest {
	readonly id: string;
	readonly questions: readonly QuestionnaireQuestion[];
}

/** 一条作答：问题原文 + 用户选中的选项文本（或「其他」自由输入的内容）。 */
export interface QuestionnaireAnswer {
	readonly question: string;
	readonly answer: string;
}

export interface QuestionnaireResponse {
	readonly id: string;
	/** 用户整卡跳过。跳过时 answers 为空，工具结果会要求模型按现有信息继续、不追问。 */
	readonly skipped: boolean;
	readonly answers: readonly QuestionnaireAnswer[];
}
