# 10 · 上下文系统全景（提示词组装 / 每轮注入 / 窗口治理）

> 调研对象：WorkBuddy 安装目录解包（`_analysis/extracted/`，5.5.4）。
> 本文是 KamiBuddy 上下文工程的规格书。机制可学，文字与代码必须自己写（AGENTS.md §6）。
> 全部结论带证据（文件:行号）；未证实的点集中见 §9「证据空白声明」。
>
> 路径前缀约定：`cli/` = `_analysis/extracted/cli/`，`main/` = `_analysis/extracted/main/`，
> `resources/` = `_analysis/extracted/resources/`。codebuddy.js 为 minified 超长行，
> 行内证据以「模块号」辅助定位（webpack 模块号 + 行号）。

## 0. 总图：两层提示词 + 一条消息加工链

```
【L1 CLI 基座提示词】cli/product.json 118 个 nunjucks 模板（云端热更）
       +
【L2 产品层提示词】daemon 渲染 resources/templates/*.tpl（9 个 Collector 供变量）
       → --system-prompt-file 传给 CLI
       +
【L3 每轮 hidden context】17 个 section 注入用户消息前（composeUserPrompt）
       +
【L4 附件/引用编码】prompt-codec 15 种 badge
       ↓
【L5 请求链】ACP promptToUserMessage → 18 条兼容规则 → gzip → 模型
【L6 后台治理】token 账 → 阈值 → 压缩 / microcompact / 大输出外置
```

两层提示词的分工：CLI 基座层管「你是谁 / 怎么用工具 / 安全底线」，
产品层管「办公人格 / 模式规约 / 记忆 / 用户画像 / 本轮上下文」。

---

## 1. L1 · 系统提示词体系（基座）

### 1.1 product.json 的 prompts 全景

位置：`cli/product.json` L988-1461，`prompts` 数组共 **118 条**，每条 `{name, template}`（nunjucks）。11 类：

| 类别 | 条目（行号） | 角色 |
|---|---|---|
| 主系统提示词 | `cli-agent-prompt`（L990，约 18KB） | 被 agents[0] 以 `instructions:"cli-agent-prompt"` 引用（L1502-1503） |
| 会话生命周期 | `init-prompt`、`compact-agent-prompt`、`compact-prompt`、`context-summary-{agent-prompt,prompt,max-token-prompt}`（L994-1017） | /init 建 CODEBUDDY.md；压缩与上下文摘要子代理 |
| 斜杠命令提示 | `command-{security-review,commit,commit-push-pr,insights,statusline}-prompt`（L1018-1033, L1278） | 内置命令任务提示 |
| 内部生成器 agent | `base-agent-instructions`、`terminal-title-generator-instructions`、`memory-selector-instructions`、`summary-generator-instructions`、`auto-mode-classifier-instructions`、`agent-plan-instructions` 等（L1034-1113, L1274-1289） | UI 隐藏的内部子代理（标题/压缩/auto 分类/hook 评估），对应 agents[] L1601-1829 |
| insights 分面 | `insights-facet-*`（8 条）+ `insights-session-facet`（L1038-1073） | /insights 使用报告 |
| system-reminder 片段 | `system-reminder-{md,todo-list,planmode,delegate}`（L1114-1125, L1346） | 运行时提醒可复用片段 |
| 工具描述 | `tool-*-description` 40+ 条（L1126-1442） | **全部工具 description 云可热更**；含工具结果模板（L1194-1249） |
| Agent Teams | `team-sys-prompt`、`team-lead-prompt`（L1338-1345） | 多代理协作 |
| 输出风格 | `output-style-{explanatory,learning}`、`cli-output-style-description`（L1350-1361） | outputStyle 槽内容 |
| 工作流/深研 | `skill-loop-prompt`、`workflow-*`（6）、`deep-research-*`（3）、`{simplify,code-review,verify}-trigger-reminder`（L1394-1449） | Dynamic Workflow 与深研 |
| 其他 agent | `pulse-agent-prompt`、`handoff-summary-agent-prompt`、`enhance-prompt-system-prompt`（L1450-1461） | pulse/交接摘要/提示增强 |

**主提示词 `cli-agent-prompt` 结构**（L991，20 段，按序）：身份 → `<content_policy>` 6 条合规底线 →
安全测试授权 + 禁猜 URL → 帮助/反馈路由 → 产品自文档路由（`{% if cliDocsDir %}`）→
`# Tone and style` → `# Task Management`（含 few-shot）→ `# Asking questions` → `# Doing tasks` →
`# Executing actions with care` → `<system-reminder>` 标签约定 → `# Tool usage policy` →
`# Output efficiency` → **`<env>` 环境块** → 平台路径规则（WSL/win32 条件）→
`<codebuddy_background_info>`（modelName/modelId）→ `# Language` 强制段（`{% if language %}`，
工具参数也要用目标语言）→ `{% if modelSupportsImages === false %}` 禁读图声明 →
`# Code References`（file:line 引用格式）→ `{% if outputStyle %}` 收尾槽。

`<env>` 块全文（L991 内）：

```
Working directory: {{workDir}}
Is directory a git repo: {% if isGitRepo %}Yes{% else %}No{% endif %}
Platform: {{platform}}
{% if isWsl %}Is WSL: Yes{% endif %}
OS Version: {{version}}
Default shell: {{defaultShell}}
Today's date: {{date}}
{%- if additionalDirs %} ... {% for dir in additionalDirs %}- {{dir}}{% endfor %} ... {% endif %}
```

**变体文件**：`product.ioa.json` 无 `prompts` 节（grep 无命中）——它只是 endpoint/agents/models
覆盖层（模型 ID 带 `-ioa` 后缀，多 GPT-5.x/Claude-Opus-4.x 系与 Echo agent），提示词不变。
相邻结构：`variables`（L1462-1499，UI @ 引用变量类型）；`agents`（L1500-1832，19 个 agent 定义）；
`tools`（L2112-2354，工具注册表）；尾部 `commit/date/genieVersion`（L2415-2417）。

### 1.2 模板渲染机制：双端各渲一份

- **daemon 渲染产品层**：`PromptRendererImpl`（main/tar.js L69550-69617）持
  `new nunjucks.Environment(null, { autoescape: false })`；模板由 `createTemplateLoader`
  从 `resources/templates/*.tpl` 读盘（L69780-69830）。
- **CLI 渲染基座层**：CLI bundle 内 nunjucks@3.1.7 渲染 product.json 模板
  （04-cli-core.md §0/§2.2；bundle 单行超 128KB 无法逐字取证，以笔记既有证据为准）。

**nunjucks 变量来源：9 个 Collector 按序写入 vars**（调用顺序注释 tar.js L69478-69487；注册 L69601-69617）：

| # | Collector（行号） | 提供的变量 |
|---|---|---|
| 1 | EnvCollector（L68323-68378） | modelId/modelName、productName、workDir、platform、version、date、defaultShell、isGitRepo（`git rev-parse` 异步探测，L68387-68404）、isWsl、ResponseLanguage（locale→长文案，L68315-68322） |
| 2 | IdentityCollector（L68682-68816） | WorkspaceIdentityMode、SoulPath/SoulContent、BootstrapPath/BootstrapContent、IdentityPath/IdentityContent、UserPath/UserContent（~/.workbuddy/ 四身份文件，截断上限） |
| 3 | PersonalizationCollector（L69050-69111） | ToneStyleContent（style-*.md 全文）、UserCustomPrompt |
| 4 | MemoryCollector（L68827+） | WorkbuddyMemoryDir、WorkbuddyDataFolderName、WorkingMemoryContent |
| 5 | UserMemoryCollector（L69280-69457） | UserMemoryContent = `<memory>` 包裹的云端画像（见 §6.2） |
| 6 | CollaborationCollector（L68250-68258） | ToolResultPresentationPrompt |
| 7 | ExpertPromptSlotCollector（L68452+） | 专家会话 PluginAgentPrompt / Role Override |
| 8 | ExpertManagementCollector（L68415+） | ExpertManagementEnabled |
| 9 | BinaryCollector（L68220+） | BinaryContext |

**渲染产物下发 CLI**：daemon 写临时文件 `%TMP%/workbuddy-prompts/{sessionId}.prompt.txt` 与
`%TMP%/workbuddy-prompt-vars/{sessionId}.prompt-vars.json`，以 `--system-prompt-file` /
`--prompt-vars-file` 传给 sidecar（main/server.js L128594-128651 `buildAgentCliRuntimeArgs`，
L131182-131197 调用点；prompt-vars 每次 ACP prompt 前健康检查可重建，L128657-128698）。
`ResponseLanguage` 另经 `--settings.language` 下发，保证 CLI 内部 generator agents 与主会话同语言
（tar.js L69928-69943 注释）。

### 1.3 云下发与落盘

- **拉取**：`CloudProductProvider`（main/common.js L27412-27468）GET `{endpoint}/v3/config`
  （L27410），**带 `?repos[]=...` 参数（git 仓库感知下发**，L27666-27675），超时 5s；
  远端剔除 endpoint/deploymentType 字段；models 按 id 合并、agents SmartMerge（L27448-27514）。
- **两级缓存**：L1 内存 480s（按 userId 分片）；L2 LocalStorage `cloud_product_config_cache`
  （LRU 20 用户分片，L27539-27541）。空/精简响应触发 last-good 门：不覆盖缓存（L27691-27708）。
  失败按 1/2/4/8/16s 指数重试 5 次（L27613-27622）。
- **整体快照**：合并后配置 gzip 存 LocalStorage，key = `CodeBuddy-Product-Cache[:<版本>]`
  （版本隔离，L26905-26927）；启动 `init()→loadFromCache()+sync()`（L26934-26936）。
- **桌面→CLI**：环境变量 `ACC_PRODUCT_CONFIG_V3`（内联 JSON）/ `ACC_PRODUCT_CONFIG_PATH`（文件）
  注入 CLI 子进程；`networkEnvironment` → `CODEBUDDY_INTERNET_ENVIRONMENT`
  （main/cli-product-env.js L6-112；common.js L26997-27015 注释）。
- **合并后过滤**：`applyProductFeatureFilters` 按 productFeatures 删变量/追加多模态禁用说明/
  过滤禁用技能（common.js L27340-27369）。

---

## 2. L2 · 每轮 hidden context 框架（17 个 section）

### 2.1 框架主体

`WorkbuddyUserPromptService.composeUserPrompt(request)`（main/tar.js L73156 类定义，L73215 方法；
源码路径注释 `packages/workbuddy-server/src/prompts/user-prompt-service.ts`）。
**每条用户消息发送前**遍历 17 个 section → 各产 XML 片段 → 按 container 分组 →
包成 hidden context block **prepend 到用户消息 blocks 之前**。

Section 契约：`stage` + `container` + `shouldApply(input)` + `render(input)`（空串跳过）。
`input` 含 sessionId/cwd/prompt/codebuddyMeta/desiredConfig/hasPriorUserMessages/connectorStatus/
netdriveRoot/isTeamsProject/skillCatalog 等（L73220-73243）；meta key = `_meta['codebuddy.ai']`
（`getCodebuddyMeta`，L69955-69958）。

### 2.2 全部 17 个 section（注册点 L73387-73408）

| # | Section（行号） | stage | container | 注入内容 |
|---|---|---|---|---|
| 1 | UserInfoSection（L72965） | first_turn | user-context | `<user_info>`：OS/Shell/IDE Theme/Workspace Folder |
| 2 | IdentityContextSection（L72027） | first_turn* | user-context | 身份上下文（SOUL/IDENTITY/USER/BOOTSTRAP + 产品身份 + 风格 + 自定义指令）；*身份指纹变化时再注入（L73255-73269） |
| 3 | RulesSection（L72197） | first_turn | user-context | `<rules>` 场景规则（meta.scenarioRules） |
| 4 | ProjectContextSection（L72113） | first_turn | user-context | `<project_context>`：CODEBUDDY.md/AGENTS.md 摘要 + 工作区目录树快照 |
| 5 | AdditionalDataSection（L71598） | every_turn | **additional_data** | `<current_time>` + 专家提醒 + connector 状态 + `<netdrive_root>`/`<attached_folders>`/`<attached_files>` + ima/乐享/AgentMail/微信附件 |
| 6 | TencentDocsAdditionalSection（L70743） | every_turn | **additional_data** | 腾讯文档路由/选区上下文 + 本地文档通道兜底（L70700-70729） |
| 7 | UserCommandSection（L72944） | every_turn | user-context | slash 命令解析；未解析产 `<user_command status="unresolved">` |
| 8 | SpecialInstructionsSection（L72224） | every_turn | user-context | `<user_special_instructions>`（command_prompt/integration_prompt，CDATA） |
| 9 | SystemReminderSection（L72246） | every_turn | user-context | plan 模式每轮注入 system-reminder.tpl |
| 10 | ModeTransitionReminderSection（L72081） | every_turn | user-context | ask↔craft 切换后首轮注入模式覆盖声明（模板 L72046-72061） |
| 11 | CurrentExpertReminderSection（L72001） | every_turn | user-context | `<current-expert>` 钉住当前专家，禁再推荐 |
| 12 | WorkingMemoryReminderSection（L73005） | every_turn | user-context | `<memory_and_skills_reminder>` 记忆/技能沉淀提醒（可关） |
| 13 | AutomationSystemReminderSection（L71964） | every_turn | user-context | 定时任务提醒（meta.automationSystemReminder） |
| 14 | AttachedSkillsSection（L71889） | every_turn | user-context | `<manually_attached_skills>` 手动挂载技能清单 |
| 15 | ArdotFileDirectiveSection（L71789） | every_turn | user-context | `<ardot_file_directive>`（仅 craft，幂等指令） |
| 16 | ArdotDesignStyleSection（L71694） | every_turn | user-context | `<ardot_design_style>` 选定设计模板 |
| 17 | ArdotImageGenSection（L71854） | every_turn | user-context | `<ardot_image_gen mode="ai\|placeholder" />` |

**枚举值**：stage 只有 `every_turn`（13）/ `first_turn`（4）；container 只有
`additional_data`（#5/#6）/ 缺省归 user-context（其余 15）。
first_turn 在 `hasPriorUserMessages || alreadyInjectedUserContext` 时跳过（L73258-73262）。

### 2.3 注入位置、包裹格式与压缩语义

- 每组 XML 经 `wrapHiddenContextXml` 包成 **`<system-reminder data-role="user-context|additional-data">`**
  hidden text block（L6023-6027；角色常量 L5930/L5938），**插在当前用户消息最前面**
  （Teams 路径 L73309-73323；legacy 路径 L73325-73345）。
- **压缩语义差异（关键设计）**：`user-context` 常态化、压缩时整块保留；
  `additional-data` 是本轮一次性内容（current_time/附件等），压缩链路可整体剥离/摘要
  （L5931-5938 注释）。
- Teams（企业项目）独立分支：额外 `<team-project-context>` 容器（项目身份/工具路由/
  项目规则/work-summary/tdrive 附件），user-context 与 additional-data 分两个 hidden block
  （L73283-73323，常量 L5946-6041）。
- 两个调用点（新旧架构并存）：旧 `SessionManager.composePromptForBackend`
  （main/server.js L120377-120399，先 `enrichPromptMeta` 回填 projectId/专家选择）；
  新 conversation-engine `createConversationPromptPreparer`（server.js L135040-135153，
  注释明确"新架构曾漏注入后补齐"），失败降级为原始 prompt。

### 2.4 设计要点：系统提示词定基调，hidden section 管每轮动态

系统提示词本体每 session/模式渲染一次（tar.js L69561），不每轮变；
模式切换（ask↔craft）不重新渲染，由 ModeTransitionReminderSection 注一条覆盖声明；
plan 由 SystemReminderSection 每轮提醒；expert 由 CurrentExpertReminderSection 钉住。
CLI 侧 system 尾部唯一动态：`VenusCacheControlPlugin` 给最后一条 system message 加
`cache_control: ephemeral`（venus.oa.com 主机，codebuddy.js L548）。

---

## 3. L3 · 附件与引用编码（prompt-codec）

### 3.1 编码器与前缀形态

编码器：`encodeAcpResourceLinkToInputText`（main/tar.js L6196-6368）；
可编码白名单 `isInlineEncodableResourceLink`（L6370-6377）。

| 前缀 | 编码形态 | 证据（tar.js） |
|---|---|---|
| `command://` | `/name` + providerData | L6189-6192, L6218-6224 |
| `file://` | `@<relativePath‖name‖路径>` | L6356 |
| `scene://` | `@scene#<id>:"<name>"` 否则 `@scene:<name>` | L6225-6229 |
| `skill://` | `@skill:<name>` | L6230 |
| `tdoc://` | `@tdoc#<fileId>:"<title>"` + hint | L6231-6243 |
| `netdrive://` | `@netdrive:<title>` | L6325-6334 |
| `selection://` | `@selection:<name> <selection_quote source title htmlSelection>选中文本</selection_quote> <system-reminder>llmText</system-reminder>` | L6244-6261 |
| `longtext://` | `@long-text:<name> <long_text_quote>全文</long_text_quote>` | L6262-6273 |
| `comment://` | `@comment:<name> <system-reminder>llmText</system-reminder>` | L6274-6289 |
| `tdoc-selection://` | `@tdoc-selection#<timestamp>:"<label>"`（badge 仅锚点，payload 走 hidden `<tencent_docs_selection>`，按 timestamp 绑定） | L6290-6299, L6422-6429 |
| `article://` | `@article:<url>` | L6346-6355 |
| `http(s)://` | `@share-html#<name>:<url>` + connector hint | L6357-6367 |
| `ima://`/`lexiang://`/`expert://`/`agentmail://` | `@ima:`/`@lexiang:`/`@expert:`/`@agentmail:` + 各自 hint | L6199-6209, L6302-6345 |
| meta.mentionType=`inline-prompt` | 直接展开为 `@<promptText>` | L6210, L7059-7062 |
| meta provider=`space-doc` | 直出 url 文本 | L6211-6217 |

**longtext（长文本粘贴）**：renderer 把超长粘贴做成 chip
（`uri: longtext://<displayText>-<length>`，全文放 `meta.fullText`，
renderer/assets/lib-chat-ui-ChIVprRk.js L43955, L61860）；daemon 编码时
`<long_text_quote>全文</long_text_quote>` **整体内联**进 user_query。

**selection（选区）**：选中正文以 `<selection_quote>` 内联、llmText 以 `<system-reminder>`
跟随（L6244-6261）；腾讯文档选区是另一套（badge 仅锚点，payload 经
TencentDocsAdditionalSection 渲染进 `<tencent_docs_selection>`，L70793-70794, L70861）。

### 3.2 核心纪律：引用不内联

- `<user_references>` 明文："Only paths are provided. Use read tool to fetch contents
  when you need them."（tar.js L73347-73355）
- `<todo-reference>`/`<message-reference>`："MUST call `todo_show` / `project_message_show`
  with the id to fetch full details"（tar.js L6068, L6091）
- `<context ref="uri">` 只在两种情形内联（codebuddy.js L2470-2475）：inspiration 卡片
  （meta.detail 本体已在手）；ACP `resource` 类型 block（client 主动内嵌 EmbeddedResource，
  正文放链接文本、内容追加消息尾部）。其余 resource_link 一律只给 badge。

### 3.3 图片双通道

- **本地图片**：daemon `resolveOutboundPromptImages`（server.js L36848-36925）：blob 仅限
  `~/.workbuddy/blobs` 白名单（realpath 双重校验）读 base64；裸绝对路径 `data` **丢弃不外发**（L36894）。
- **CLI 转换**（promptToUserMessage，codebuddy.js L2475）：Anthropic 形态
  `{type:"image", source:{type:"base64", data, media_type}, original_filename}` +
  **紧跟一条 `<image_local_path>路径</image_local_path>` 文本**（路径选取：`_meta.path` →
  `block.uri` → `persistClipboardImage` 落盘 `clipboard-images/` 后用落盘路径）。
  设计动机（推断）：base64 不可寻址，路径文本让模型可用工具按路径重读原图；
  UI 侧反向用它过滤纯图片消息（server.js L8168, L122357）。
- **url 图片**：`source:{type:"url", url}`（同 L2475）。
- **工具结果图片**：通用路径 `normalizeToolMessageContent` 把工具消息里的 image JSON
  改写为 `image_url`（补 data:URI、探测 mime；`image_blob_ref` 经 ImageBlobService rehydrate，
  失败换占位文本）；自定义模型专用 `CustomModelToolMediaHoistPlugin`：连续 tool 消息段里的
  图片 part 抽出，**在该段后插入新 user 消息** `[{text:"Attached image(s) from tool result:"},
  …image_url parts]`；`supportsImages===false` 时占位 `[image omitted: model does not
  support image input]`（codebuddy.js L543/L548）。

---

## 4. L4 · 窗口治理（token 账与压缩）

### 4.1 token 账

- **基准**：最近一次 API 响应 usage 的 `inputTokens` + 尾部新增工具结果本地估算
  （`UsageUtils.getLatestUsage` + `TokenUtils.estimateTrailingToolResultTokens`；
  无 usage 回退 `estimateHistoryTokens`，codebuddy.js:353 模块 49080；
  codebuddy.js:115 `PreMessageCompactInterceptor` 的 `"api-usage"`/`"local-estimate"` 分支）。
- **估算器**：`TikTokenCalculatorService`（tiktoken 真 tokenizer）+ `ModelBasedTokenCalculator`，
  `ContextTokenCalculateService` 统筹（模块 49080 导出名）；兜底粗算 `estimateTokensRough`。
- **UI 用量**：`/context` 输出分类瀑布（System prompt / System tools / Memory files /
  Messages / Free space / **Autocompact buffer**，costs.md 示例 38.1k/200k）；
  算量走独立 meta 通道 `__token_calculation_request__`，不污染历史（codebuddy.js:1053 模块 88530；
  HistoryInterceptor 跳过 addHistory，codebuddy.js:115）。

### 4.2 阈值链（云控）

product.json L967-986 全量：`inputTokens: warning 0.6 / critical 0.7 / emergency 0.9 /
preMessage 0.5`；`compact.emergency 0.4`（deepseek 系 0.5）；`summary.emergency 0.15`；
`request.emergency 0.9`；`requestMaxStepLimit: 100`（L987）。

会话预算 `resolveSessionContextBudget`：contextWindow.supportedLengths 合法档
（≤maxInputTokens）取 session override > defaultLength > 首档 > maxInputTokens；
无模型预算时固定窗口 `getAutoCompactWindow()` = **200k**（env `CODEBUDDY_AUTO_COMPACT_WINDOW`，
clamp 100k~1M）。触发点 = 预算 × 阈值（`CODEBUDDY_AUTOCOMPACT_PCT_OVERRIDE` ?? emergency(0.9)
?? 代码常量 0.7，codebuddy.js:353 模块 84534）。

### 4.3 三种压缩（CompactType 枚举，模块 84534）

| 类型 | 触发 | 要点 |
|---|---|---|
| `user-command` | /compact 手动 | force=true 跳过阈值检查 |
| `pre-message-auto` | 发消息前预压缩 | 阈值 session meta ?? env ?? product.json preMessage(0.5) ?? 代码兜底 **0.8**；30s 内刚压过/压缩中/子代理/Teams/无实质新历史（issue #34798）则跳过（codebuddy.js:115 `PreMessageCompactInterceptor`，优先级 1650） |
| `emergency-auto` | 触顶应急 | 连续上限 `DEFAULT_MAX_CONSECUTIVE_COMPACT=5`，超限经 ACP meta `codebuddy.ai/compact-limit-reached` 上报 |

开关：`autoCompactEnabled`（settings 默认 true，codebuddy.js:1054 模块 51470）；
pre-message 开关链：env 强制 > productFeatures.enablePreMessageCompact > ContextSummaryAgent 开关。
注：env-vars.md 称 `CODEBUDDY_PRE_MESSAGE_COMPACT_PCT` "默认 10%"，与 product.json 0.5、
代码兜底 0.8 均矛盾——**以代码为准**。

### 4.4 压缩 prompt 与压缩后形态

- `compact-agent-prompt`（product.json L998-999）：system 角色，仅语言约定。
- `compact-prompt`（L1002-1003）：输出 `<conversation_history_summary><analysis>≤300 词</analysis>
  <summary>…</summary></conversation_history_summary>`，summary 六节（Primary Request and Intent /
  Key Technical Concepts / Files and Code Sections / Errors and fixes / Problem Solving /
  All user messages），**总长 ≤1000 词（≈2600 tokens）**，明示"DO NOT re-run"，
  乱码/Base64/大日志用 `…[content truncated]…` 占位。
- `context-summary-max-token-prompt`（L1014-1015）：超上下文恢复专用，九节（多 Pending Tasks /
  Current Work / Optional Next Step，逐字引用断点）。
- **压缩后上下文** = 摘要 reminder + 压缩点后消息：`replaceCompactWithSummary` 提取
  `<summary>` 经 `wrapSummaryWithContext(summary, sessionFilePath)` 包成 role=user 的
  `<system-reminder data-role="compact-summary">`；`getCompactHistory` 滤掉压缩边界前原文
  ——**原文仍留会话 JSONL**（路径传入供引用）（codebuddy.js:2555 模块 71536 HistoryUtils）。
- 执行走策略链：`PreMessageCompactStrategy` / `MaxTokenCompactStrategy` /
  `BlockingCompactStrategy`（兜底），`runCompactStrategies` 按 canHandle 路由（模块 49080）。
- 喂给摘要器的历史先经 microcompact + `stripImagesForCompaction` +
  `createFilteredCopyForCompaction`（剥 `<user_query>` 外 reminder）。
- 会话 ID 带压缩代数后缀 `withCompactGeneration`（`id-c{N}`）；
  pending interruption 时压缩推迟（`compactBlockedByPendingInterruption`）。

### 4.5 microcompact（分级设计）

`MessageUtils.performMicrocompact`（codebuddy.js:2560 模块 60643）：
- 目标：Read/Bash/Grep/Glob/WebFetch/WebSearch/Edit/MultiEdit/Write 的 function_call_result。
- 规则：**保留最近 N 条**（调用方传 keepRecent），更早的整体替换占位符
  `"[Old tool result content cleared by microcompact]"`；保留的也截到
  `maxCharsPerResult ?? 1500` 字符。
- **唯一调用点**：compact agent 运行时 `performMicrocompact(input, {keepRecent: 5})`
  （codebuddy.js:115）——不是常驻 GC，是**压缩前对摘要器输入的预处理**，
  防"为了压缩先把摘要请求撑爆"。
- 更底层还有确定性"工程压缩" `HistoryEngineeringCompactor`（模块 49080）：
  跳过 function_call_result/reasoning 等条目生成 `<cb_summary>`，不调 LLM，
   sufficiency 阈值 env `CODEBUDDY_ENGINEERING_COMPACT_SUFFICIENCY_PCT` 默认 0.15（部分证实）。

### 4.6 大输出外置与图片轮次

- **Bash**：`BASH_MAX_OUTPUT_LENGTH` 默认 30000 字符（上限 150000），内存留 head 20%+tail 80%，
  **OutputSpiller 完整输出流式落盘**，模型只收 ~2KB placeholder（路径+预览）
  （env-vars.md:57-63；类实现 codebuddy.js:1054）。
- **非 Bash 工具（含 MCP）**：`CODEBUDDY_TOOL_RESULT_THRESHOLD_KB` 默认 50KB，
  落 `~/.codebuddy/projects/{dir}/{sessionId}/tool-results/{callId}.txt`；
  MCP 另受 `MAX_MCP_OUTPUT_TOKENS` 默认 20000；
  `CODEBUDDY_DISABLE_MCP_LARGE_OUTPUT_FILES=1` 时不落盘只截断（env-vars.md:399-446）。
- **图片**：`image_blob_ref` 外置 blobs/（内容哈希），回放时 ImageRehydrationInterceptor
  只对最近 `imageHistoryRetainRounds`（默认 2）轮 rehydrate，更早变 `[Image from ...]` 占位
  （codebuddy.js:115）。

---

## 5. L5 · 工具面按需加载（ToolSearch + DeferExecuteTool）

### 5.1 defer 清单与优先级

- **MCP 工具**：全局默认延迟加载（env `CODEBUDDY_DEFER_TOOL_LOADING`，env-vars.md:84）；
  单 server/单工具可静态 `defer_loading`（mcp.md:458-517）。
- **内置**：`PushNotification`、`ReportFindings`（tools-reference.md:116）。
- **WorkBuddy 自研内置 7 个默认 defer**：`connect_cloud_service / connect_open_platform /
  conversation_search / workbuddy_marketplace_skill / workbuddy_sites_deploy /
  workbuddy_sites_unpublish / agentic_search`（main/server.js L113100-113108
  `DEFERRED_BUILTIN_TOOL_NAMES`）。
- 优先级链（tool-defer-overlay.md §4）：NoDefer > Defer > 工具级 > 服务器级 > env >
  settings > 内置默认；**NoDefer 恒胜**；出现任一 Defer(...) 自动附加 ToolSearch +
  DeferExecuteTool，且 `Defer(*)` 时给这两个工具加 NoDefer 防自我封死。
- 反向证据：工具列表里没有 ToolSearch 时 defer 被强制抹掉
  （codebuddy.js:104 AgentManagerImpl.buildTools）。

### 5.2 搜索索引与工具（bundle 实证）

- **MiniSearch**（bundle 内嵌源码）：`fields:["name","description"]`，
  `SEARCH_OPTIONS={prefix:true, combineWith:"OR", boost:{name:2}}`，`DEFAULT_TOP_K=5`
  （codebuddy.js:1958 模块 92312 ToolSearchServiceImpl）。
- 仅索引 `defer_loading=true` 工具；`replaceServerTools` 重建索引并 `indexEpoch++`，
  AgentManager 监听 epoch 不一致就重建工具面（"first run carries late-indexed MCP tools"，
  codebuddy.js:104）。
- ToolSearch schema：`queries`（建议中英双语关键词）/ `tool_names`（精确全限定名）/
  `top_k`（默认 3 上限 20）；结果截断 env `CODEBUDDY_TOOL_SEARCH_MAX_OUTPUT_CHARS`
  **默认 30000**（仅代码可见，codebuddy.js:1966）；延迟工具清单篇幅受
  `CODEBUDDY_DEFERRED_TOOLS_CHAR_BUDGET` 控制，超预算折叠为 "[other N MCP servers with M
  tools can be found in ~/.workbuddy/mcp.json. Use ToolSearch to discover...]"
  （codebuddy.js:353 模块 58272）。
- **激活语义：会话级永久**（tools-reference.md:116 原话："一旦激活，工具在会话剩余
  时间内保持可用"）。
- 设计意图：mcp.md:460「减少上下文消耗并提高模型工具选择的准确性」；
  参照系（Anthropic "Code execution with MCP"）：全量 15 万 token → 按需 2 千（省 98.7%）。

---

## 6. L6 · 记忆与画像

### 6.1 五层 CODEBUDDY.md（memory.md / codebuddy-dir.md）

- 位置：`~/.codebuddy/CODEBUDDY.md`（用户）、`~/.codebuddy/rules/*.md`（用户规则）、
  `./CODEBUDDY.md` 或 `./.codebuddy/CODEBUDDY.md`（项目）、`./.codebuddy/rules/*.md`
  （项目规则，仅 cwd 不上溯）、`./CODEBUDDY.local.md`（本地，自动进 .gitignore）。
- 发现：从 cwd **向上递归到根（不含根）**；子树文件操作到该目录时动态加载；
  `@path` 导入递归 ≤5 层，代码块内不解析。
- **AGENTS.md 兼容**：项目有 CODEBUDDY.md 用之，否则回退 AGENTS.md（memory.md FAQ）。
- **条件规则**：frontmatter `enabled/alwaysApply/paths`（glob，matchBase）；
  `alwaysApply:false + paths` = 文件操作触发，作为 system-reminder 注入、不重复
  （ConditionalRulesInterceptor 优先级 1740，codebuddy.js:104/:115）。
- Auto Memory：`~/.codebuddy/memories/{project-id}/MEMORY.md` 索引**前 200 行**入上下文。

### 6.2 用户画像双通道（「振东」从哪来）

1. **USER.md（本地身份文件，主通道）**：onboarding 的 `~/.workbuddy/BOOTSTRAP.md`
   明确要求模型问"用户的名字/怎么称呼"并写入 `USER.md`（模板含 Name / What to call them，
   tar.js L68599-68622 的 DEFAULT_USER_CONTENT、L68623-68681 BOOTSTRAP 全文，
   L68651-68655 即 "5. Their name - What should you call them?"）。
   注入链：IdentityCollector 首轮读 USER.md → `UserContent` → user-context-identity.tpl
   的 `<identity_context>` 段（resources/templates/user-context-identity.tpl L32-34，
   **无任何 nickname 变量**）→ IdentityContextSection（first_turn）。
2. **云端画像 `<memory>`（UserMemoryCollector）**：`GET {endpoint}/api/memory/profile` →
   `data.foryou_prompt` → 本机路径消毒（memory-block-sanitizer，L69113-69124）→
   包 `<memory>` 注入，10,000 字符上限（tar.js L69280-69327, L69409-69447）。
   本地归档优先（配置目录 `memory/` 存在就不打远程，L69354-69362；兼容错拼 `memery/`）；
   `generateMemoryEnabled===false` 或 `DisableMemoryPersonalization` 整体关闭。

**nickname 实际去向（均非提示词）**：遥测字段（server.js L112611）、账号展示
（tar.js L30307-30907）、产物署名 `updatedBy`（server.js L162667）。
企业版组织信息（enterpriseId/enterpriseName）只进 HTTP 头（tar.js L15275-15278），
**无注入提示词的路径**（负面结论，全仓 grep）。

### 6.3 每轮记忆提醒

WorkingMemoryReminderSection 每轮注入 `<memory_and_skills_reminder>`——
提醒模型把值得记的东西沉淀进记忆/技能（tar.js L73005-73038，可用 app-config 关）。

---

## 7. L7 · 失控防护

### 7.1 ToolCallLoopDetector（codebuddy.js:203 模块 16532，bundle 首次还原）

常量：通用阈值 **4**；Read 同文件 **40**；非黑名单工具 **40**。
黑名单 = `Read/Grep/Glob/Write/WebFetch/WebSearch/Edit/Skill/Bash`。

判定（对输入历史尾部扫描，遇非 function_call/function_call_result/reasoning 条目即止）：

1. **通用循环**：黑名单工具同一工具**完全相同参数连续 ≥4 次** → `generic_loop`
2. **读文件循环**：尾部 `Read` 同一 file_path 连续 ≥40 次 → `read_file_loop`
3. **非黑名单循环**（MCP 等）：同名同参连续 ≥40 次
4. 已有 `LOOP_DETECTION_MARKER` 不再触发（一次性）

动作：**不硬停**——追加一条合成 user 消息：
`[Loop detected: the tool "X" has been called N consecutive times with identical arguments.
/ STOP calling tools immediately. Do NOT make any more tool calls.
/ Instead, tell the user what happened and suggest they switch models or modify their prompt
to retry.] + LOOP_DETECTION_MARKER`。检测失败静默放行。

### 7.2 轮次与其他

- 客户端轮次上限 `DEFAULT_MAX_TURNS=500`（`CODEBUDDY_CODE_MAX_TURNS`/--max-turns 覆盖；
  子代理下限 200），超限抛 `MaxTurnsExceededError`。
  product.json `requestMaxStepLimit: 100`（L987）**客户端无消费代码**，仅云声明。
- `/goal` 自治循环：lite 模型评估三态（达成/继续/不可达），impossible 立即终止（goal.md:127）。
- auto 权限分类器熔断：连续失败回退 default；拒绝计数超限退出 auto（codebuddy.js:1958）。
- 压缩等待超时强制 idle：`FORCE_IDLE_REASON_COMPACT_ABORT_WAIT_TIMEOUT`（codebuddy.js:1053 模块 89414）。
- 子代理：每会话 spawn 预算 200、嵌套深度上限 MAX_SUBAGENT_DEPTH。

---

## 8. 用户消息加工全链路（顺序与各跳职责）

```
renderer (blocks + _meta['codebuddy.ai'])
  → ACP session/prompt
  → [daemon] composeUserPrompt            （17 section → hidden reminder  prepend，§2）
  → [daemon] materializeConversationRuntimePrompt（blocks → wire 文本：
       hidden reminder 在前 + 可见文本包 <user_query> 在后，
       server.js L21102-21172；tar.js L7011-7049 extractRuntimePromptText）
  → [daemon] resolveOutboundPromptImages  （blob/路径 → base64，server.js L36848-36925）
  → ACP → CLI
  → [CLI] AcpUtils.promptToUserMessage    （blocks → image block / <context ref> / badge，
       codebuddy.js L2469-2475）
  → [CLI] ModelRequestProcessor           （清洗坏 tool_calls、normalizeToolMessageContent、
       sanitizeEmptyContent、剥尾部无 tool_calls 的 assistant，codebuddy.js L543）
  → [CLI] MessageQueueRequestProcessor    （排队消息合成 <system-reminder data-role=
       "message-queue"> 追加新 user message，codebuddy.js L543-548）
  → [CLI] CompatibilityRequestProcessor   （18 条规则按模型 caps 改写：sdk-field-cleanup、
       max-tokens-field、reasoning 系列、gemini/moonshot 插件、venus-cache-control、
       custom-model-tool-media-hoist 等；命中腾讯内部 LLM host 整体跳过，codebuddy.js L548）
  → [CLI] GzipRequestProcessor            （POST body gzip，priority 9999）
  → HTTP 发给模型
```

renderer 侧细节：用户可见原文另存 `_meta['codebuddy.ai'].extra.sourceContentBlocks` 供气泡显示
（server.js L21078-21095）；tdoc-selection chip 必须保留结构化 block 直达 daemon，
否则 `_meta.selectionPayload` 丢失（server.js L21066-21072 注释）。

---

## 9. 证据空白声明（未证实/推断项）

1. CLI bundle 内 nunjucks 渲染调用点与 cli-agent-prompt 变量装配：
   codebuddy.js 单行超 128KB 无法逐字取证，以 04-cli-core.md §0/§2.2 既有证据为准。
2. `PreMessage/MaxToken/BlockingCompactStrategy` 三策略类内部 diff 未逐行还原
   （路由与兜底顺序已证实）；`compact.emergency:0.4`/`summary.emergency:0.15`/
   `request.emergency:0.9` 精确语义为推断（值与名称证实）。
3. `requestMaxStepLimit:100` 无客户端消费代码，语义仅笔记佐证（04-cli-core.md §2.2）。
4. `TikTokenCalculatorService` 的模型→encoding 映射未展开（服务存在性已证实）。
5. Skill 工具 description 里 `<available_skills>` 的拼装函数未逐字定位
   （codebuddy.js L77 超长行内）；其存在与消费侧证据确凿
   （usage 统计器用 `/<available_skills>[\s\S]*?<\/available_skills>/gi` 抽取 token 桶，
   codebuddy.js L76779；system prompt `<agent_skills>` 段约定 "Only use skills listed
   in the `<available_skills>` section"，resources/templates/workbuddy-prompt.tpl L279-338）。
6. `<image_local_path>` 设计动机源码无注释，「供模型按路径重读原图」为机制推断。
7. renderer 输入框组块细节（`agent-ui/.../resolve-and-send-prompt.ts`）不在 extracted 产物，
   引用自 tar.js L73106 跨端同构注释。

---

## 10. 对 KamiBuddy 的映射（差距清单）

| WorkBuddy 机制 | KamiBuddy 现状（2026-09-09） | 行动 |
|---|---|---|
| `<env>` 时间注入 | ✅ 已做（inject-current-time：composer 末尾环境块，分钟级） | — |
| 附件 badge + 引用不内联 | ✅ 同思路（chip + `@路径`，read_document 自取） | 选区/长粘贴形态未做 |
| 提示词资源化 + 云端下发预留 | ✅ 结构已对齐（resources/ 双面文件 + config 单一入口预留云端） | 云端未做（预留） |
| **17 section 每轮注入框架**（stage×container、压缩语义分层） | ❌ 只有静态 composer（before_agent_start 整体替换 systemPrompt） | **最大差距**：需"用户消息级动态注入"——先查证 pi 有无对应 hook（before_agent_start 之外的 message transform） |
| 压缩（阈值/摘要策略链/microcompact/大输出外置/图片轮次） | ⚠️ pi 自带压缩（机制未调研）；大输出不外置；工具卡 detail 4000 字符截断 | 大输出落盘（30k 阈值 + placeholder）值得单开 spec；pi 压缩机制待调研 |
| ToolSearch 工具按需 | ❌ 工具全量（<15 个） | 暂不需要；MCP 接入后再议 |
| 记忆/画像（USER.md 双通道 + 每轮沉淀提醒） | ❌（T5 未做） | T5 spec 直接蓝本：BOOTSTRAP 问名写 USER.md + `<memory>` 云画像 + WorkingMemoryReminder |
| 循环检测（同参 4 次喝止消息） | ❌ | 便宜好用，值得单开 spec |
| 云控阈值（product.json tokenUsageThresholds） | ❌ 阈值写死 | config 云端下发落地后可对齐 |
