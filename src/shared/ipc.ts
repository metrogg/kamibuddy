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
import type { AuditCategory, AuditExportResult, AuditQueryResult } from "./audit.ts";
import type { ImagePart } from "./image.ts";
import type { ObservabilitySnapshot, RunLedgerEntry } from "./observability.ts";
import type { PermissionInfo, PermissionSettings } from "./permissions.ts";
import type { RuntimeDiagnosticsText, RuntimeInventory } from "./runtimes.ts";
import type { SessionEventEnvelope, SessionSnapshot, ThinkingLevel, QueuedMessages } from "./session-events.ts";
import type { UsageStats } from "./usage-stats.ts";
import type {
	CustomModelInput,
	CustomProviderInput,
	ModelProbeResult,
	SettingsSnapshot,
	SkillsSnapshot,
	SkillInfo,
	StyleConfigInfo,
	WebSearchConfigInfo,
	WebSearchConfigInput,
	WebSearchTestResult,
} from "./settings.ts";

/* ────────────────────────────────────────────────────────────────
 * 通道名
 * ──────────────────────────────────────────────────────────────── */

/**
 * 个性化六键的读取形态（daemon 合并缺省后下发——renderer 不各自兜底）：
 * 字符串四键空串 = 未设置；两个 boolean 缺省 true（`?? true` 在 daemon 一处合并）。
 */
export interface PersonalizationInfo {
	readonly customInstructions: string;
	readonly userNickname: string;
	readonly assistantName: string;
	readonly personaDescription: string;
	readonly welcomeGreeting: boolean;
	readonly showChangeDetails: boolean;
}

/**
 * 个性化的部分更新：只更新传入的键（读改写不丢其他键）；
 * 字符串 trim 后为空 = 删除该键；非字符串响亮抛错。
 */
export interface PersonalizationPatch {
	readonly customInstructions?: string;
	readonly userNickname?: string;
	readonly assistantName?: string;
	readonly personaDescription?: string;
	readonly welcomeGreeting?: boolean;
	readonly showChangeDetails?: boolean;
}

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
	/**
	 * 当前会话最近一次注入的 hidden context 全文（任务诊断面板的展示口）。
	 * 还没跑过任何一轮为 undefined —— 注入块按 run 冻结，这里是展示语义
	 * （agent_end 不清，run 结束后仍可看）。
	 */
	hiddenContext: "session:hidden-context",
	/**
	 * 重排 steer / followUp 等待队列（排队 chips 的删除/编辑底层动作）。
	 * 传入的就是**重排后**的完整队列 —— daemon 清空后按序重入队。
	 */
	queueRewrite: "session:queue-rewrite",
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
	/** 切换交互模式（ask / craft / plan）。对应 interactionmode 轴。 */
	setInteraction: "session:set-interaction",
	/**
	 * 选择专家（绑定人格）或清除专家（undefined）。
	 *
	 * 专家是与交互模式**正交**的会话绑定（spec: rework-expert-orthogonal-and-skills）：
	 * 本通道只读写 expertId，不改交互模式；setInteraction 也不清 expertId。
	 */
	setExpert: "session:set-expert",
	/**
	 * 专家列表（模式菜单「专家 ▸」子菜单、对话头部与起手 chips 的展示数据源）。
	 * 只带展示字段 —— 人格正文不经 IPC，compose 时 daemon 从专家库自取。
	 */
	listExperts: "session:list-experts",
	/** 切换模型。 */
	setModel: "session:set-model",
	/**
	 * 切换当前会话的推理强度。pi 恒 clamp 到模型可用档位（不抛错），
	 * 生效档位随下一条 session_state 下发（renderer 不本地乐观改）。
	 * 逐会话持久化与 resume 还原由 pi 负责（thinking_level_change 条目）。
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
	/** 归档 / 取消归档会话（archive.json 索引，会话文件不动；详见 InvokeMap）。 */
	sessionArchive: "session:archive",
	/** 重命名会话（写入 pi 的 session_info 条目）。path 定位，name 为新名。 */
	sessionRename: "session:rename",
	/**
	 * 「重新开始」：把会话回退到锚点消息**之前**并继续，被放弃的后续
	 * （若确有内容）抽成一条新会话留在侧栏，不丢东西。
	 * 锚点用**用户消息序号（0 基）**而非条目 id：在线路径下渲染层的 user 消息
	 * id 是 session-host 自己造的，与落盘条目 id 不一致，daemon 侧按序号
	 * 用 `getUserMessagesForForking()` 解析真实条目 id（spec「实测修订」）。
	 */
	sessionRestart: "session:restart",
	/**
	 * 「分支出新会话」：从锚点消息（同样是用户消息序号）之前派生一条新会话，
	 * 母会话原样不动（对比 sessionRestart 的「就地回退 + 抽枝」）。
	 */
	sessionBranch: "session:branch",
	/** 删除会话文件。当前活动会话由 daemon 拒删（需先新建任务）。 */
	sessionDelete: "session:delete",
	/**
	 * 把当前会话导出为单文件 HTML（pi 的 AgentSession.exportToHtml）。
	 * path 来自 SessionSummary.path 定位会话；产物落在默认根 exports/ 下，
	 * 返回导出文件的绝对路径。
	 */
	sessionExport: "session:export",
	/**
	 * 把当前临时任务会话「保存到工作空间」转正：把该任务目录在生效根下重命名为
	 * name（自动目录整体 rename，产物与记忆随目录迁移；历史共享临时目录等非自动
	 * 目录回退为新建目录），会话以新 cwd 重建并归入新空间组。
	 * name 经 daemon 校验（工作空间命名规则）；当前会话非临时任务时由 daemon 拒绝。
	 */
	saveToWorkspace: "session:save-to-workspace",
	/** 拉取当前工作空间与可选列表（默认根 + 已有子目录）。 */
	workspaceSnapshot: "workspace:snapshot",
	/** 在默认根下新建工作空间并切换过去。返回生效的目录路径。 */
	createWorkspace: "workspace:create",
	/**
	 * 切换到指定目录。目录经 daemon 校验（配置目录/应用目录会拒）。返回生效的目录路径。
	 * 传空字符串表示临时任务待分配（不选命名空间，不建目录，首次执行才分配独立时间戳目录）。
	 */
	setWorkspace: "workspace:set",
	/**
	 * 弹出系统目录选择框。由 main 本地应答（要用 Electron dialog）。
	 * 用户取消返回 undefined。
	 */
	pickWorkspaceDirectory: "workspace:pick-directory",
	/**
	 * 列某个目录的本地分支（含是否 git 仓库的一次性判定）。
	 * 代码场景的 worktree 芯片用它填基准分支下拉；非 git 仓库时
	 * isGitRepo=false 而**不是**报错 —— 用户选个普通文件夹是正常情形。
	 */
	worktreeBranches: "worktree:branches",
	/**
	 * 设置「下一次新建任务在哪个基准分支上建 worktree 副本」；undefined = 关闭。
	 *
	 * 与 workspace:set 同语义：只改**后续新建任务**的落点，既有会话原地不动
	 *（副本一经创建就与会话终身绑定，换分支不是「改偏好」而是「换工作副本」，
	 * 那需要重建会话，属另一件事）。新建任务时该意图被重置（对齐
	 * newTask 重置工作空间选择的口径）。
	 */
	setWorktreeBranch: "worktree:set-branch",
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
	 * 路径存在性探测（对话正文行内 code 的路径徽章用）。
	 * 只报存在性与文件/目录类型，不报内容，故不受 readArtifact 的工作区边界限制。
	 */
	statPath: "artifact:stat",
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
	/**
	 * 往预置（内置）服务商追加/替换单个模型（「添加模型」弹层选预置的路径，
	 * spec: rework-settings-layout）：落 models.json 但不写 baseUrl/api、不打
	 * 归属标记（core/custom-providers.ts upsertProviderModel 的三点硬差异）。
	 */
	addProviderModel: "settings:add-provider-model",
	/** 联网刷新模型目录。启动时不联网，只在用户主动点击时调。 */
	refreshCatalog: "settings:refresh-catalog",
	/**
	 * 测试某个模型的连通性（设置-模型页卡片上的「测试」按钮）：
	 * 发一个最小非流式请求，回答网络通不通 / Key 认不认 / 模型在不在。
	 */
	testModel: "settings:test-model",
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

	/* ── 推理强度（全局默认） ─────────────────────────────────────────── */

	/** 读全局默认推理强度。未配置时 daemon 回 "medium"（与 pi 内置默认一致）。 */
	getThinkingLevelDefault: "settings:get-thinking-level-default",
	/** 写全局默认推理强度。只影响之后新建的会话，既有会话不回溯。 */
	setThinkingLevelDefault: "settings:set-thinking-level-default",

	/* ── 回复风格 ─────────────────────────────────────────────────── */

	/** 读回复风格配置（全部可选项 + 当前值）。未配置时 daemon 回默认风格 professional。 */
	getStyle: "settings:get-style",
	/** 写回复风格。传空串 = 关闭风格注入；只影响之后的新 run，不回溯既有会话。 */
	setStyle: "settings:set-style",

	/* ── 记忆（spec: add-memory-system） ─────────────────────────── */

	/** 读记忆系统开关。未配置时 daemon 回 true（缺省开启）。 */
	getMemoryEnabled: "settings:get-memory-enabled",
	/** 写记忆系统开关；daemon 同时把内置「记忆整理」任务的启停对齐过来。 */
	setMemoryEnabled: "settings:set-memory-enabled",

	/* ── 团队协作开关（spec: add-team-foundations 批 5） ───────────── */

	/** 读团队协作开关。未配置时 daemon 回 false（缺省关闭，实验特性）。 */
	getAgentTeamsEnabled: "settings:get-agent-teams-enabled",
	/** 写团队协作开关。只影响之后新建的会话（工具注册发生在会话建立时）。 */
	setAgentTeamsEnabled: "settings:set-agent-teams-enabled",

	/* ── 团队成员会话操作（spec: add-team-foundations 批 8） ───────── */

	/** 向成员会话投一条消息（followUp 语义：idle 唤醒 / running 排队）。 */
	memberPrompt: "team:member-prompt",
	/** 中止成员当前轮（聚焦成员视图的停止键）。 */
	memberAbort: "team:member-abort",

	/** 读用户画像全文（PROFILE.md）。文件不存在回空串 —— 新用户本来就没有画像，不是错误。 */
	getProfile: "settings:get-profile",
	/** 覆盖写用户画像全文。下一轮对话生效（画像在 compose 时现读）。 */
	setProfile: "settings:set-profile",
	/** 清空用户画像（文件内容置空）。内置「记忆整理」任务下一轮蒸馏会重新生成。 */
	resetProfile: "settings:reset-profile",
	/**
	 * 画像导入的「选文件 + 读内容」：弹系统文件框选 .md，返回其内容；
	 * 取消返回 undefined。由 main 本地应答 —— 系统对话框与任意路径的文件字节
	 * 只在 main 可得（同 pickInputFiles 的理由），daemon 不 import electron。
	 * 注意不写 PROFILE.md：画像文件的唯一写点是 daemon 的 setProfile，
	 * renderer 拿到内容后再调 setProfile 完成导入（两段组合，见设置页）。
	 */
	importProfile: "settings:import-profile",

	/* ── 个性化（spec: rework-settings-layout） ──────────────────── */

	/** 读个性化六键（daemon 合并缺省：字符串回空串、两个 boolean `?? true`）。 */
	getPersonalization: "settings:get-personalization",
	/** 部分更新个性化（只动传入的键；字符串 trim 后为空 = 删该键）。 */
	setPersonalization: "settings:set-personalization",
	/** 读长期记忆全文（~/.kamibuddy/MEMORY.md）。不存在回空串，与 getProfile 同口径。 */
	getMemory: "settings:get-memory",
	/** 覆盖写长期记忆全文。下一轮对话生效（compose 时现读）。 */
	setMemory: "settings:set-memory",

	/* ── 提示词预览 ─────────────────────────────────────────────── */

	/**
	 * 现场组装系统提示词供设置页预览：按 {场景, 模式, 风格, 专家} 走
	 * composePromptWithMeta 同一条组装路径（不需要活会话），
	 * 返回带来源标注的分段与总字数。scene/mode/style/expert 非法即 reject。
	 */
	promptPreview: "prompt:preview",

	/* ── 权限 ─────────────────────────────────────────────────────── */

	/** 读回当前权限设置（沙箱模式 + 审批策略 + 强制力）。 */
	getPermissions: "settings:get-permissions",
	/**
	 * 保存权限设置。旋钮是权威值，presetId 由 daemon 按旋钮反算，
	 * 不信任前端传来的 —— 两者不一致时界面会显示成错误的档位。
	 */
	setPermissions: "settings:set-permissions",

	/* ── 技能 ─────────────────────────────────────────────────────── */

	/** 已安装技能清单 + 启停状态 + 清单段成本（独立页面用，不再借道设置快照）。 */
	skillsSnapshot: "skills:snapshot",
	/**
	 * 启用 / 停用一个技能（技能页卡片上的开关）。停用是**用户级覆盖**，不改 SKILL.md。
	 * 返回**新的完整快照**：列表、已启用数与 token 数字一次到位，页面不必再拉一次。
	 */
	setSkillEnabled: "skills:set-enabled",
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
	/**
	 * 拉取跨会话使用统计（spec: add-usage-stats）：全历史会话数/消息数/用量/
	 * 连续活跃天数/每日活动与 token/模型与工具排行。统计页的数据源。
	 *
	 * 与 statsSnapshot 的分工：statsSnapshot 是「本进程 + 台账全历史」的运行侧
	 * 聚合（轮次、缓存、时间线），这里读的是**会话文件全历史**的使用侧聚合
	 * （含早于台账存在的旧会话）。无参数、无时间范围 —— 与 WorkBuddy 的
	 * `/api/v1/stats` 同口径。
	 */
	usageStats: "stats:usage",
	/**
	 * 拉取运行台账（run ledger）条目级数据：诊断页「会话时间线」的数据源。
	 *
	 * 与 statsSnapshot 的分工：快照是进程级聚合（算好的结果），这里是每会话
	 * append-only 的原始台账（诊断页自己 fold 成泳道——fold 是渲染的一部分，
	 * 口径钉在 renderer/run-timeline.ts）。sessionId 缺省 = 当前活动会话
	 * （无活动会话时 daemon 退最新台账文件）；返回同时带全部台账会话 id
	 * 列表，会话选择器不用再开一条通道。
	 */
	runLedger: "stats:run-ledger",
	/**
	 * 查询全局唤起热键的注册状态。由 main 本地应答，不转发 daemon：
	 * globalShortcut 是 main 进程的独有状态，daemon 不知道也不该知道
	 * （与 daemonStatus 同一条透出路径的理由）。
	 */
	globalShortcutStatus: "app:global-shortcut-status",
	/**
	 * 查询 docx 引擎 venv 的四态状态（诊断页状态行）。
	 * 只探测不安装 —— 诊断页不该有环境副作用；安装是 docx_convert 首次调用
	 * 与 daemon 预热的事（core/runtimes/python.ts 的 ensurePythonRuntime，
	 * 探测/安装/发布都走托管运行时内核）。
	 */
	docxEnvStatus: "diagnostics:docx-env-status",

	/* ── 审计中心（spec: add-managed-runtimes 阶段 4） ─────────────── */

	/**
	 * 拉取审计记录（拦截/放行留痕：命令安全 / 沙箱 / 运行时三类 + 审计管理动作）。
	 *
	 * 类别过滤与展示上限都在 daemon 侧的同一条查询里做（core/audit-log.ts 的
	 * readAuditRecords），renderer 不再过滤一遍 —— 两处各筛一次就会出现
	 * 「面板显示 3 条、导出 5 条」这类对不上。返回同时带过滤后的总数，
	 * 面板据此如实说明「只显示了最近 N 条」。
	 */
	auditList: "audit:list",
	/**
	 * 清空全部审计记录（需面板侧二次确认后再调）。daemon 先删后补，
	 * **清空动作本身**会成为清空后唯一的一条记录（spec Scenario: 清空记录）。
	 * 返回清空后的新状态（含那条留痕），面板不必再拉一次。
	 */
	auditClear: "audit:clear",
	/**
	 * 导出全部审计记录到文本文件，返回文件绝对路径与条数（由 daemon 写盘，
	 * 与面板同一条查询 + 同一份渲染；面板只负责把路径摆给用户）。
	 */
	auditExport: "audit:export",
	/**
	 * 托管运行时的开关与清单（设置页「内置运行时」一级分区，spec:
	 * add-managed-runtimes 阶段 3）。只读磁盘事实、**不 spawn**：状态口径与模型侧
	 * `python_env` 段是同一份（core/runtime-inventory.ts）——
	 * 深度四态探测在 runtimeDiagnostics。
	 */
	runtimesSnapshot: "runtimes:snapshot",
	/** 总开关（「内置运行时」那一级）。返回更新后的完整清单（开关立即生效，无需重启）。 */
	setRuntimeMaster: "runtimes:set-master",
	/** 逐运行时开关（false = 显式的「已禁用」标记）。返回更新后的完整清单。 */
	setRuntimeEnabled: "runtimes:set-enabled",
	/** 单个运行时的可复制诊断报告 + 落盘日志路径（按需 spawn 的深度探测）。 */
	runtimeDiagnostics: "runtimes:diagnostics",
	/** 重置并重新安装（内核的幂等链路，需联网、可能几分钟）。返回更新后的完整清单。 */
	runtimeReset: "runtimes:reset",

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
	 * 流式期间发来的消息如何处理（对应 pi 的 steer / followUp 语义）。
	 * steer：本轮工具执行完后插进当前这轮；followUp：等当前任务完全停下再发。
	 * **缺省 = followUp（排队）** —— 补一句的常规意图是「等它跑完再接着做」；
	 * 立刻插入必须由用户显式插队才会发生（队列条上点 ↑，重排成 steering 队列）。
	 * 缺省值由 daemon 在会话互斥链的旁路分支落定（唯一处），这里不重复定义。
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

/**
 * 全局唤起热键的默认 accelerator。
 *
 * 契约放 shared 而不是 main：main 注册时用它，renderer 诊断页显示同一串，
 * 两处读同一常量才不会「注册的是 A、显示的是 B」。
 * 机制对齐 WorkBuddy 5.5.4 GlobalToggleShortcutController（L23 spec）。
 */
export const DEFAULT_GLOBAL_SHORTCUT = "Shift+Alt+W";

/**
 * 全局唤起热键的注册状态。由 main 维护——globalShortcut.register 的返回值
 * 只有 main 知道。failed 绝大多数是热键被别的程序占用，不视为启动错误。
 * undefined（尚未注册过）不出现在类型里：InvokeMap 的 result 用联合表达。
 */
export type GlobalShortcutStatus =
	| { readonly kind: "registered"; readonly accelerator: string }
	| { readonly kind: "failed"; readonly accelerator: string };

/**
 * docx 引擎 venv（~/.venv-html-to-docx）的四态探测结果。
 *
 * 类型放 shared 是因为它是诊断页 IPC 的 payload（renderer 只许 import shared）；
 * 探测机制与四态定义见 documents/docx-env.ts 的 inspectVenv（只读探测，绝不安装）。
 */
export type DocxEnvStatus =
	/** venv 不存在或解释器起不来。 */
	| { readonly kind: "missing" }
	/** venv 在但不是 Python 3.12（下次 ensure 会 --clear 重建）。 */
	| { readonly kind: "wrong-version"; readonly version: string }
	/** 解释器正常但依赖冒烟缺模块（下次 ensure 会补装）。 */
	| { readonly kind: "deps-missing"; readonly module: string }
	| { readonly kind: "ready" };

/** 工作空间快照。机制对标 WorkBuddy：空间 = 目录，默认根下建同名子目录。 */
export interface WorkspaceSnapshot {
	/** 当前生效的工作目录（新建任务的默认 cwd 来源）。临时任务未选命名空间时为空串（待分配，首次执行才分配独立时间戳目录）；undefined 仅出现在会话尚未建立的瞬态。 */
	readonly current: string | undefined;
	/** 默认根目录（「新建工作空间」都建在它下面）。 */
	readonly defaultRoot: string;
	/** 默认根下已有的工作空间目录列表。 */
	readonly workspaces: readonly string[];
	/**
	 * 产物预览静态服务的 baseUrl（http://127.0.0.1:端口，根=当前工作区）。
	 * 临时任务会话同样起服务（根=该任务的自动目录；待分配空串无目录，不给 baseUrl）；
	 * undefined 仅出现在尚无工作目录的瞬态。
	 */
	readonly previewBaseUrl: string | undefined;
	/**
	 * 「下一个新任务在哪个基准分支上建 worktree 副本」；undefined = 不建副本。
	 *
	 * 与 current 同属「下一次新建任务怎么起」的权威值，所以放在同一个快照里：
	 * 芯片平时要显示自己是不是已启用，而它只是 renderer 的局部状态的话，
	 * 切页面/重建组件后就会与 daemon 的真实意图脱节 —— 界面说「没启用」、
	 * 新任务却建了副本，是最难排查的那类不一致。
	 */
	readonly worktreeBranch: string | undefined;
}

/** readArtifact 的返回：文件大小 + 文本内容（二进制或超大时不给）。 */
export interface ArtifactContent {
	readonly size: number;
	/** UTF-8 文本。二进制（含 NUL）或超过 512KB 时为 undefined。 */
	readonly text: string | undefined;
}

/** statPath 的返回：路径存在性与类型。missing 是探测结果不是错误（徽章据此保持普通 code 渲染）。 */
export interface PathStat {
	readonly kind: "file" | "directory" | "missing";
}

/** stats:run-ledger 的返回：会话选择器列表 + 选中会话的台账条目。 */
export interface RunLedgerResult {
	/** 有台账文件的会话 id（按文件修改时间新的在前——最近活动的会话排上面）。 */
	readonly sessions: readonly string[];
	/**
	 * 实际读取的会话（请求缺省 = 当前活动会话；活动会话还没建宿主/无台账时
	 * 退最新台账文件）。一个台账都没有时为 undefined，entries 随之是空。
	 */
	readonly sessionId: string | undefined;
	/** 选中会话的台账条目（时间序，旧→新；超出 daemon 上限截尾保留最新）。 */
	readonly entries: readonly RunLedgerEntry[];
}

/** 一条 `/` 命令的展示信息（技能 / 提示词模板 / 内置命令）。 */
export interface CommandItem {
	/** 命令名（不含 /）。技能形如 `skill:docx`，模板形如 `weekly`。 */
	readonly name: string;
	readonly description: string;
	/**
	 * 来源，供 renderer 分组显示：`skill` → `/` 菜单的「技能」组（带图标、置顶），
	 * `template` / `builtin` → 「指令」组。
	 *
	 * 分组**只认这个字段**，不在渲染层按名字前缀推断 —— 技能与模板在菜单里
	 * 都只是一个 `/` 开头的名字，看不出类型。
	 */
	readonly source: "skill" | "template" | "builtin";
}

/** 输入框补全数据源。 */
export interface CompletionData {
	/** `@` 可选文件：当前工作目录内的相对路径（posix 分隔）。临时任务时列该任务自动目录内容；待分配（空串）时为空。 */
	readonly files: readonly string[];
	/** `/` 可选命令。 */
	readonly commands: readonly CommandItem[];
}

/** 一位专家的列表项（session:list-experts 的结果元素）：菜单、对话头部与起手 chips 的展示数据源。 */
export interface ExpertListItem {
	/** 专家 id（= 文件名，setExpert 的入参）。 */
	readonly name: string;
	readonly displayName: string;
	readonly profession: string;
	/** 一句话描述（专家卡片用；菜单只用 displayName/profession）。 */
	readonly description: string;
	/** 菜单副行的一句话能力描述。 */
	readonly displayDescription: string;
	/** 恰好 3 个起手问题（对话页输入区上方的可点 chips）。 */
	readonly quickPrompts: readonly string[];
	/** 恰好 3 个领域关键词（专家卡片 tag chips 与分类行聚合用）。 */
	readonly tags: readonly string[];
	/** 来源（专家市场页「我的专家」子页的判定依据：同名用户级覆盖内置后即为 user）。 */
	readonly source: "builtin" | "user";
}

/**
 * 会话分支（session:restart / session:branch）的失败原因。
 * 走「返回结果」而不是 reject：这些是**可预期的业务拒绝**（流式中、锚点不存在…），
 * 界面要按 reason 给不同文案，异常通道承载不了这种区分。
 */
export type SessionBranchFailReason =
	/** 会话正在生成中（run 未结束，不允许换历史）。 */
	| "busy"
	/** 该会话还没有会话文件（未发送过消息）。 */
	| "no-file"
	/** 锚点条目不在该会话里（renderer 传的 id 已失效/不属于此会话）。 */
	| "no-such-entry"
	/** 落盘失败（分支文件写入 / 母文件截断失败）。 */
	| "write-failed";

/**
 * session:restart / session:branch 的统一返回。
 *
 * branchPath / branchTitle 仅在**确实抽枝产生了分支会话**时有值：
 * 「重新开始」在分叉点之后没有内容时不产生分支会话（没有需要保存的未来），
 * 此时二者缺席，调用方据此只提示「已回到这一轮之前」。
 */
export type SessionBranchResult =
	| { readonly ok: true; readonly branchPath?: string; readonly branchTitle?: string }
	| { readonly ok: false; readonly reason: SessionBranchFailReason; readonly message: string };

/**
 * 一条历史会话的列表项（session:list 的结果元素）。
 * parentSession 有值即分支会话（来源标记）；path 仍是定位键。
 */
export interface SessionSummary {
	readonly id: string;
	/** 会话文件绝对路径（resume/rename/delete 的定位键）。 */
	readonly path: string;
	/** 列表标题：命名 ?? 首条消息截断（daemon 组装好，UI 不再推导）。 */
	readonly title: string;
	/** 用户命名（appendSessionInfo）；未命名为 undefined，不要用空串。 */
	readonly name?: string;
	/** 会话启动时的工作目录（pi header.cwd）。临时任务会话为该任务的自动目录（历史会话可能是共享临时目录）。 */
	readonly cwd: string;
	/** 是否临时任务会话（daemon 按 cwd 目录名形态判定好：自动时间戳目录 / 历史「临时任务」目录 / 旧 playground 占位；生效根本身归空间区，2026-09-15。UI 不推导）。 */
	readonly isTempTask: boolean;
	/**
	 * 母会话文件绝对路径（分支会话的来源标记，取自会话文件 header 的
	 * parentSession，pi 未写入时由我方补写）；普通会话为 undefined，
	 * 不要用空串。母会话已被删除时该值照旧保留 —— 标记不提供跳转即可。
	 */
	readonly parentSession?: string;
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
	/**
	 * 是否已归档（archive.json 索引，daemon 标注好）。已归档的会话不进
	 * 侧栏主列表，在设置页数据管理分组查看 / 恢复 —— 归档 ≠ 删除，
	 * 会话文件原地不动，resume / delete 照常可用。
	 */
	readonly archived: boolean;
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
		/**
		 * 内置任务标记（spec: add-memory-system）：renderer 据此抑制 toast 与未读
		 * （内置任务是静默后台家务）。可选 —— daemon 只在内置任务时带上 true。
		 */
		readonly builtin?: boolean;
	};

/**
 * prompt:preview 的入参：预览四个选择器的取值。
 * styleId 三态：某风格 id = 指定风格；空串 = 关闭；缺省 = 跟随当前偏好设置。
 * expertId 缺省 = 不选专家（专家与交互模式正交，预览可自由与任一模式组合）；
 * 指定 id 但专家库中不存在时 daemon 响亮报错（预览是调试工具，不静默降级）。
 */
export interface PromptPreviewRequest {
	readonly sceneId: string;
	readonly modeId: string;
	readonly styleId?: string;
	readonly expertId?: string;
}

/**
 * 一个提示词分段（prompt:preview 的结果元素）。
 * source 是 core PromptSegmentSource 的 IPC 镜像 —— shared 不许 import core，
 * 这里按值传递字符串；取值集合：skeleton / fragment:<名> / mode:<id> /
 * style:<id> / skills / pi-context / memory-system / expert，renderer 按「:」前缀归类着色。
 * （逐轮可变事实的 time / memory / personalization 不在集合里：它们不进系统提示词
 * —— memory / personalization 走 prompt-switch 的消息注入（core/prompt-composer.ts
 * 的 formatRuntimeContext），time 走会话侧 hidden context 的 current_time。）
 */
export interface PromptPreviewSegment {
	readonly source: string;
	readonly text: string;
	/** 段字数（UTF-16 code unit 数，与 text.length 一致）。 */
	readonly chars: number;
}

/** prompt:preview 的返回：分段列表 + 总字数（顺序拼接 = 完整提示词）。 */
export interface PromptPreviewResult {
	readonly segments: readonly PromptPreviewSegment[];
	readonly totalChars: number;
}

/** invoke 通道的入参与返回值映射。preload 和 renderer 共用，保证类型对齐。 */
export interface InvokeMap {
	[INVOKE.daemonStatus]: { args: []; result: DaemonStatus };
	[INVOKE.snapshot]: { args: [sessionId?: string]; result: SessionSnapshot };
	[INVOKE.prompt]: { args: [PromptRequest]; result: void };
	[INVOKE.abort]: { args: []; result: void };
	[INVOKE.hiddenContext]: { args: []; result: string | undefined };
	[INVOKE.queueRewrite]: { args: [QueuedMessages]; result: void };
	/**
	 * 新建任务。cwd 缺省 = 空串 = 未选工作空间（待分配，首次执行才分配自动目录）——
	 * 侧栏「新建任务」走这条，选择被重置（对齐 WorkBuddy 的 taskStarterCwd$("")）。
	 * 显式传 cwd 只用于空间组「+」（就在这个空间里开新活，对应 WorkBuddy 传 groupKey）。
	 */
	[INVOKE.newTask]: { args: [cwd?: string]; result: void };
	[INVOKE.completions]: { args: []; result: CompletionData };
	[INVOKE.pickInputFiles]: { args: []; result: PickedInputFiles | undefined };
	[INVOKE.setScene]: { args: [sceneId: string]; result: void };
	[INVOKE.setInteraction]: { args: [interactionId: string]; result: void };
	/** expertId 为 undefined 表示清除专家；专家与交互模式正交，只改专家绑定。 */
	[INVOKE.setExpert]: { args: [expertId: string | undefined]; result: void };
	[INVOKE.listExperts]: { args: []; result: readonly ExpertListItem[] };
	[INVOKE.setModel]: { args: [modelId: string]; result: void };
	[INVOKE.setThinkingLevel]: { args: [level: ThinkingLevel]; result: void };
	[INVOKE.sessionList]: { args: []; result: SessionSummary[] };
	[INVOKE.sessionResume]: { args: [path: string]; result: void };
	/**
	 * 归档 / 取消归档一个会话（archive.json 索引，会话文件不动）。
	 * 归档后的会话从侧栏主列表消失，在设置页数据管理分组恢复。
	 */
	[INVOKE.sessionArchive]: { args: [path: string, archived: boolean]; result: void };
	[INVOKE.sessionRename]: { args: [path: string, name: string]; result: void };
	/**
	 * 「重新开始」：回退到该锚点消息之前并继续（被放弃的后续抽成新会话）。
	 * userIndex 是**用户消息序号（0 基）**，与 renderer 的用户消息列表同序；
	 * 不是条目 id（在线路径两侧 id 不一致，见 INVOKE.sessionRestart 的说明）。
	 * 返回而非 reject —— 拒绝原因（busy/no-file/no-such-entry/write-failed）
	 * 是界面文案的分支依据，且失败时保证会话状态不变。
	 *
	 * options.saveBranch = false 时不抽枝（旧内容就地丢弃，不产生分支会话）——
	 * 这是「重试（重新生成）」的路径：竞品语义里 regenerate 与分支是两个功能，
	 * 重试不该往侧栏塞一条「旧回答」会话（2026-09-17 用户实测反馈）。
	 */
	[INVOKE.sessionRestart]: {
		args: [path: string, userIndex: number, options?: { saveBranch?: boolean }];
		result: SessionBranchResult;
	};
	/**
	 * 「分支出新会话」：派生新会话并切过去（母会话不动），返回同上。
	 * options.includeTurn = true 时**带上锚点那一轮**（复制到该轮末尾的回答为止，
	 * TRAE 式的「从这里接着聊」，输入框不填）；缺省 false = 只带该消息之前的前缀
	 *（原文由渲染层回填输入框，供改问法重发）。
	 */
	[INVOKE.sessionBranch]: {
		args: [path: string, userIndex: number, options?: { includeTurn?: boolean }];
		result: SessionBranchResult;
	};
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
	[INVOKE.statPath]: { args: [path: string]; result: PathStat };
	[INVOKE.previewBaseUrl]: { args: [cwd: string]; result: string | undefined };

	[INVOKE.settingsSnapshot]: { args: []; result: SettingsSnapshot };
	[INVOKE.setApiKey]: { args: [providerId: string, apiKey: string]; result: void };
	[INVOKE.removeApiKey]: { args: [providerId: string]; result: void };
	/** apiKey 可省略：编辑场景下用户可能只想改 baseUrl，不该被迫重输密钥。 */
	[INVOKE.saveCustomProvider]: { args: [input: CustomProviderInput, apiKey?: string]; result: void };
	[INVOKE.deleteCustomProvider]: { args: [providerId: string]; result: void };
	[INVOKE.readCustomProvider]: { args: [providerId: string]; result: CustomProviderInput | undefined };
	[INVOKE.addProviderModel]: { args: [providerId: string, model: CustomModelInput]; result: void };
	[INVOKE.refreshCatalog]: { args: []; result: void };
	[INVOKE.testModel]: { args: [modelKey: string]; result: ModelProbeResult };
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
	[INVOKE.getStyle]: { args: []; result: StyleConfigInfo };
	[INVOKE.setStyle]: { args: [styleId: string]; result: void };
	[INVOKE.getMemoryEnabled]: { args: []; result: { enabled: boolean } };
	[INVOKE.setMemoryEnabled]: { args: [enabled: boolean]; result: void };
	[INVOKE.getAgentTeamsEnabled]: { args: []; result: { enabled: boolean } };
	[INVOKE.setAgentTeamsEnabled]: { args: [enabled: boolean]; result: void };
	[INVOKE.memberPrompt]: { args: [memberSessionId: string, text: string]; result: void };
	[INVOKE.memberAbort]: { args: [memberSessionId: string]; result: void };
	[INVOKE.getProfile]: { args: []; result: { content: string } };
	[INVOKE.setProfile]: { args: [content: string]; result: void };
	[INVOKE.resetProfile]: { args: []; result: void };
	[INVOKE.importProfile]: { args: []; result: { content: string } | undefined };
	[INVOKE.getPersonalization]: { args: []; result: PersonalizationInfo };
	[INVOKE.setPersonalization]: { args: [patch: PersonalizationPatch]; result: void };
	[INVOKE.getMemory]: { args: []; result: { content: string } };
	[INVOKE.setMemory]: { args: [content: string]; result: void };
	[INVOKE.promptPreview]: { args: [PromptPreviewRequest]; result: PromptPreviewResult };
	[INVOKE.getPermissions]: { args: []; result: PermissionInfo };
	[INVOKE.setPermissions]: { args: [settings: PermissionSettings]; result: PermissionInfo };

	[INVOKE.skillsSnapshot]: { args: []; result: SkillsSnapshot };
	/** enabled=true 时 daemon 删掉该技能在 skillOverrides 里的键（缺省即启用，只有一种表示）。 */
	[INVOKE.setSkillEnabled]: { args: [name: string, enabled: boolean]; result: SkillsSnapshot };
	[INVOKE.importSkill]: { args: [sourcePath: string]; result: SkillInfo };
	[INVOKE.pickSkillDirectory]: { args: []; result: string | undefined };

	[INVOKE.mcpConfigGet]: { args: []; result: McpConfigSnapshot };
	[INVOKE.mcpConfigSet]: { args: [configJson: string]; result: void };
	[INVOKE.mcpServerToggle]: { args: [serverName: string, enabled: boolean]; result: void };

	[INVOKE.statsSnapshot]: { args: []; result: ObservabilitySnapshot };
	[INVOKE.usageStats]: { args: []; result: UsageStats };
	[INVOKE.runLedger]: { args: [sessionId?: string]; result: RunLedgerResult };
	/** 尚未注册过（查询早于 whenReady 流程）时为 undefined。 */
	[INVOKE.globalShortcutStatus]: { args: []; result: GlobalShortcutStatus | undefined };
	[INVOKE.docxEnvStatus]: { args: []; result: DocxEnvStatus };

	[INVOKE.runtimesSnapshot]: { args: []; result: RuntimeInventory };
	/** 总开关：改完立即生效（下一次模型调用的注入与设置页状态同一个读点）。 */
	[INVOKE.setRuntimeMaster]: { args: [enabled: boolean]; result: RuntimeInventory };
	/** 逐运行时开关；`enabled=false` 即写入显式的「已禁用」标记。 */
	[INVOKE.setRuntimeEnabled]: { args: [id: string, enabled: boolean]; result: RuntimeInventory };
	[INVOKE.runtimeDiagnostics]: { args: [id: string]; result: RuntimeDiagnosticsText };
	/** 失败时 reject（原因带相位与底层错误）—— 用户主动点的修复不许静默失败。 */
	[INVOKE.runtimeReset]: { args: [id: string]; result: RuntimeInventory };

	/** 审计记录（category 缺省 = 全部；过滤与上限都在 daemon 的同一查询里做）。 */
	[INVOKE.auditList]: { args: [category?: AuditCategory]; result: AuditQueryResult };
	[INVOKE.auditClear]: { args: []; result: AuditQueryResult };
	[INVOKE.auditExport]: { args: []; result: AuditExportResult };

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
	/**
	 * 发起审批的会话 id。渲染层按它做会话路由与「待确认」badge 归属；
	 * 唯一注入点是 daemon 的接线闭包（renderer 不推导）。
	 * 空串 = 全局（子代理审批暂无桶上下文，见 daemon/index.ts subagentRunner 装配处注释）。
	 */
	readonly sessionId: string;
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
	/**
	 * 区外读弹窗的路径写回资格（spec: extend-permission-rules-to-paths Task 2）。
	 *
	 * 只有 daemon 侧（权限门）判定「目标是绝对路径、且不在凭据/配置目录内」
	 * 时才带这个字段 —— 「该不该显示写回选项」需要禁区路径知识，renderer
	 * 拿不到，所以资格判定全在 daemon，renderer 只做展示：看到字段就显示
	 * 「以后都允许读取此路径（及子目录）」，勾选允许后把原值回填进
	 * PermissionResponse.rememberPrefix。daemon 回程仍会经
	 * rememberRuleFromApproval 全套复核（不信任 IPC 的第二道闸）。
	 */
	readonly writeBackPath?: string;
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
	/**
	 * 批准写回（spec: add-permission-rules-engine / extend-permission-rules-to-paths）：
	 * 审批弹窗的「以后都允许…」被勾选并允许时，由 renderer 回填候选前缀 ——
	 * powershell 审批回填命令首词；区外读（read 家族）审批原样回填
	 * PermissionRequest.writeBackPath。
	 *
	 * 与 remember 的区别：remember 是会话级、不落盘；本字段触发 daemon 把
	 * 一条 allow 规则追加进规则文件，跨会话生效。
	 * daemon 侧必须经 rememberRuleFromApproval 全套校验后才写盘 ——
	 * 本字段来自渲染进程，只是候选，不是命令。
	 */
	readonly rememberPrefix?: string;
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
	/**
	 * 发起问卷的会话 id。渲染层按它做会话路由与「待确认」badge 归属；
	 * 唯一注入点是 daemon 的接线闭包（renderer 不推导）。
	 */
	readonly sessionId: string;
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
