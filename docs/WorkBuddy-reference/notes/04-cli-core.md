# 04 · CodeBuddy CLI 内核解剖（Agent 内核逆向分析）

> 分析对象：`cli/dist/codebuddy.js`（21.5 MB minified，交互 TUI bundle）、`cli/dist/codebuddy-headless.js`（17.6 MB，headless/SDK bundle）、`cli/bin/codebuddy`（launcher）、`cli/vendor/`（沙箱与 shim，位于安装目录 `resources/app.asar.unpacked/cli/vendor/`）、随包官方文档 `dist/web-ui/docs/cn/cli/*.md` 与产品配置 `cli/product.json`（375 KB）。
> 版本：`@tencent-ai/codebuddy-code` **2.132.0**（bundle 内嵌 package.json 的 `publishConfig.customPackage.version`）。
> 一句话结论：**CodeBuddy CLI = Claude Code 产品形态 + OpenAI Agents JS SDK（@openai/agents 0.5.2）内核 + OpenAI chat/completions 单一协议 + 云端 product.json 驱动的提示词/模型/特性配置**。

---

## 0. 技术栈指纹（bundle 内嵌 package.json 依赖表）

证据：codebuddy.js 偏移 ~9770000 处内嵌完整 `package.json`（name=`@genie/agent-cli`，webpack 构建路径泄漏 `D:\git\workbuddy-desktop-1\genie\genie\packages\ag...`，证实与 WorkBuddy 桌面端同 monorepo，代号 genie）。

| 层 | 依赖 | 作用 |
|---|---|---|
| Agent 内核 | `@openai/agents@0.5.2` + `@openai/agents-core@0.5.2` | Agent 主循环（Runner/RunState/maxTurns/RunResult） |
| DI 容器 | `@celljs/core@3.7.8`（inversify 风格） | ~150 个组件，`@Component(Symbol)` + `@Autowired` |
| TUI | `ink@6.3.1` + `react@19` + `@xterm/headless` | 交互式终端 UI |
| 模型协议 | `openai@^6.20.0` | 唯一 wire 协议：OpenAI `/chat/completions` |
| MCP | `@modelcontextprotocol/sdk@1.29.0` | 外部工具接入 |
| ACP | `@agentclientprotocol/sdk@^0.25.0` | Zed 系 Agent Client Protocol（IDE 集成） |
| 沙箱 | `@anthropic-ai/sandbox-runtime@^0.0.17` + `@tencent-ai/sandbox-cli-{platform}@5.4.7` + `e2b@2.3.6` | Linux/macOS 用 Anthropic 方案，Windows 用腾讯自研 tsbx，云端可选 e2b |
| 遥测 | `@tencent/galileo-node-sdk@0.3.15` + `@opentelemetry/api` | 伽利略 + OTLP 上报 |
| 提示词 | `nunjucks@3.1.7` | 模板渲染（product.json 中 118 个模板） |
| 其他 | commander@11、zod-to-json-schema、ajv、undici、centrifuge（远程控制 WS）、@lydell/node-pty、jsonrepair、turndown、minisearch | — |

---

## 1. 启动链路

证据：`bin/codebuddy` 全文（162 行，未压缩）。

```
bin/codebuddy（#!/usr/bin/env node）
├─ 屏蔽 Node DEP0040 警告；记录 __CODEBUDDY_PROCESS_START_TIME__
├─ Node 版本门：>= 18.20.8，否则退出
├─ EventEmitter.defaultMaxListeners = 50
├─ V8 compile cache（module.enableCompileCache，Node>=22.8；
│   冷启 ~400ms→~254ms；CODEBUDDY_DISABLE_COMPILE_CACHE=1 关闭）
├─ Fast path：--version/-v 且无子命令 → 只读 package.json 打印版本号退出
│   （注释明确说明为避开"~150 个组件的 DI 容器初始化、网络请求、stdin 读取"）
├─ 注入 CLIENT_INFO_PRODUCT_VERSION 环境变量（供 ProductManager 缓存 key 版本隔离）
└─ 模式路由（isHeadless 判定）：
    isHeadless = --print | -p | --acp | --input-format* | --output-format*
               | --version | --help | help
               | 子命令 daemon / ps / logs / attach / kill
               | --bg | --background
    ├─ true  → require('../dist/codebuddy-headless')
    └─ false → require('../dist/codebuddy')          （Ink TUI）
    异常兜底：headless bundle 缺失(MODULE_NOT_FOUND)时回退完整 bundle
```

两个 bundle 共享同一 DI 容器与 agent 内核（headless bundle 也含 `processModelResponse`、ink 依赖用于进度渲染），差异只在 UI 壳与 I/O 协议层（见 §9）。CLI 子命令（commander）：`agents / auto-mode(defaults|config|critique) / clean / config / daemon(start|stop|status|restart) / doctor / mcp / plugin marketplace(install|list|uninstall|update|prune) / ps / sandbox / update`（证据：bundle 中 `.command("...")` 序列）。

---

## 2. Agent 主循环还原

### 2.1 内核归属

主循环**不是自研**，而是直接 bundle 了 **OpenAI Agents JS SDK 0.5.2** 的 Runner。决定性证据（codebuddy.js）：

- `getSystemPrompt(ctx){return "function"==typeof this.instructions? await this.instructions(ctx,this) : this.instructions}` + `getPrompt(ctx)` + `getMcpTools()`（SDK 的 Agent 类）
- 每轮：`processModelResponse(lastTurnResponse, currentAgent, tools, handoffs)` → `resolveTurnAfterModelResponse(...)` → `applyTurnResult({state, turnResult, agent, toolsUsed,...})`（SDK agents-core 内部函数名，bundle 中出现两份——TUI 与 ACP 侧各一份）
- `RunState`（223 处）、`toolUseTracker`、`previousResponseId`/`conversationId` 会话续接、`ModelBehaviorError`、`MaxTurnsExceededError`、`streamStepItemsToRunResult` 流式事件
- 运行时 env：`OPENAI_AGENTS_DISABLE_TRACING`、`OPENAI_AGENTS__DEBUG_SAVE_SESSION` 等 SDK 原生变量

### 2.2 推导出的完整循环（伪代码）

```
session.run(userInput):
  # —— 消息组装 ——
  agent   = resolveCurrentAgent()                    # 默认 "cli" agent（product.json, tags=[cli,default,model:craft]）
  model   = resolveModel(agent, scenario)            # 主模型 / lite / reasoning variant 解析链
  sysPrpt = await agent.getSystemPrompt(ctx)         # nunjucks 渲染 product.json「cli-agent-prompt」+ 运行时上下文
  input   = callModelInputFilter(history + userInput)  # 历史过滤/裁剪
  state   = RunState(originalInput, previousResponseId?, conversationId?)

  # —— Runner 主循环（@openai/agents）——
  for turn in 1..maxTurns:                           # DEFAULT_MAX_TURNS = 500
      |                                              #   env CODEBUDDY_CODE_MAX_TURNS 覆盖
      interceptors.preModelCall()                    # AgentRunInterceptor 链：
      |                                              #   History / State / ProviderData / AgentSwitch /
      |                                              #   ConditionalRules / HumanInputProvenance / ReferencePathProcessor
      stream = model.chat.completions.create(        # OpenAI 协议，stream:true
                 model, messages, tools, streamOptions)
      |                                              #   首 token 超时：DEFAULT_FIRST_TOKEN_TIMEOUT_MS
      for chunk in stream:                           #   delta / tool_calls / reasoning_content 累积
          emit UI stream events                      #   RunResult stream → Ink/ACP/stream-json
      |
      processed = processModelResponse(              # 拆分 function calls / computer / shell /
                    response, agent, tools, handoffs)#   apply_patch / hosted MCP tool
      |
      turnResult = resolveTurnAfterModelResponse(...):
          if 无 tool_use 且产出 finalOutput → 终止（isFinalOutput）
          else:
            for call in toolCalls:
                decision = permissionChain(tool, input)   # 见 §4，9 层判定
                if decision == ask:  ← 交互弹窗 / headless 按模式收口
                result = tool.execute(validatedInput)       # zod schema 校验
                detect = ToolCallLoopDetector.check(call)   # LOOP_DETECTION_MARKER 死循环检测
                state.generatedItems += function_call_output
      applyTurnResult(state, turnResult)
      usage 累计；若估算 tokens ≥ 压缩阈值 → 触发 compact（见 §5）

  # —— 异常收口 ——
  MaxTurnsExceededError → AgentTask 记录 "reached max turns limit" 并收尾
  ModelResponseInterceptor 链（错误拦截器）：
    FallbackModelErrorInterceptor：仅 --print 模式且配置 fallbackModel；
      模型 overloaded → 先重试主模型一次 → 再切 fallbackModel；
      quota exhausted → 立即切 fallback（证据：bundle ~11360588）
  product.json: requestMaxStepLimit = 100（服务端声明的单请求步数上限）
```

### 2.3 停止/重试/fallback 证据点

- 重试：HTTP 层 `maxRetries`(54)、`exponential`(48)、`Retry-After`(2)（openai SDK 内建指数退避）
- fallback：仅 headless(`session.options?.print`)生效的 `fallbackModel` CLI 选项
- 思考模式：`reasoning_content`（28 处）+ `EFFORT_LEVELS` + `reasoningEffort` 设置项 + `alwaysThinkingEnabled`——支持混元 2.0-thinking / kimi-k2-thinking 一类推理模型
- 打断/插队：`SteerInputBuffer`、`abortController`、`interruptions`（SDK interruption 机制）

---

## 3. 内置工具完整清单

证据链：① bundle 中工具枚举（`!function(eA){eA.READ="Read",...}`，偏移 ~12534260 起）；② 随包官方文档 `docs/cn/cli/tools-reference.md`（与枚举逐一对应）；③ 每个工具的 description 不在 bundle 里，而在 **product.json 的 `prompts`（`tool-*-description`，共 40+ 条）**——工具描述可云端热更新。

### 3.1 核心工具表

| 工具 | 用途 | 关键 schema/字段 | 需权限 |
|---|---|---|---|
| `Read` | 读文件（文本/图片/PDF/notebook） | `filePath`、`offset`、`limit`、`cell_id` | 否（信任目录内） |
| `Write` | 创建/覆盖文件 | `filePath`、`content` | 是 |
| `Edit` | 精确字符串替换 | `filePath`、`old_string`、`new_string`、`replace_all` | 是 |
| `MultiEdit` | 同文件多步原子编辑 | `edits[]` | 是 |
| `Bash` | 执行 shell 命令 | `command`、`run_in_background`、`dangerouslyDisableSandbox` | 是 |
| `PowerShell` | Windows 原生 PS 执行（仅 Win；无 Git Bash 时替代 Bash） | 内置安全检查器（iex/Add-Type 等拦截）；别名 `pwsh`/`ps` | 是 |
| `Grep` / `Glob` | 内容正则搜索 / 文件名匹配（内置 ripgrep.node、fast-glob） | `pattern`、`path`、`glob` | 否 |
| `LS` | 列目录 | — | 否 |
| `TodoWrite` | 写任务清单（另有 TaskCreate/Get/Update/List 全套任务系统） | `todos[]` | 否 |
| `WebFetch` | 抓 URL + AI 分析 | `url`、`prompt` | 是 |
| `WebSearch` | 联网搜索 | `query` | 是 |
| `Agent` | 派生子代理（见 §6） | `subagent_type`、`description`、`prompt`、`model`（lite/reasoning）、`mode`、`detached` | 否 |
| `TaskOutput` / `TaskStop` | 读后台任务/子代理输出；终止（别名 `BashOutput`/`KillShell`） | `task_id`、`block` | 否 |
| `EnterPlanMode` / `ExitPlanMode` | 进/出计划模式 | — | 否/是 |
| `AskUserQuestion` | 向用户提问（多选） | `questions[]` | 是 |
| `Skill` / `SkillManage` / `SlashCommand` | 执行技能/管理技能/斜杠命令 | `skill`、`args` | 否/是 |
| `StructuredOutput` | 按 JSON Schema 返回结构化输出 | `schema` | 否 |
| `ToolSearch` + `DeferExecuteTool` | **延迟加载工具发现与执行**（MCP 工具与少数内置工具默认不进工具列表，先搜索再激活；env `CODEBUDDY_DEFER_TOOL_LOADING`、`CODEBUDDY_SHOW_ALL_DEFERRED_TOOLS`、`CODEBUDDY_TOOL_SEARCH_MAX_OUTPUT_CHARS`） | `query`、`max_results` | 否 |
| `Workflow` | 启动 Dynamic Workflow 后台运行，`TaskOutput` 取结果 | 返回 `runId` | 是 |
| `NotebookRead` / `NotebookEdit` | Jupyter 单元格读写 | `notebook_path`、`cell_id` | 否/是 |
| `LSP` | 语言服务器代码智能（定义/引用/符号/调用层级；需代码智能插件） | `operation` | 否 |
| `ImageGen` / `ImageEdit` / `VideoGen` | 多模态生成（hunyuan-image 系列模型；env `CODEBUDDY_IMAGE_GEN_ENABLED` 等） | `prompt`、`image_size`、`path` | 是 |
| `Artifact` / `ArtifactControl` | 发布 HTML/MD 为公网链接 / 取消发布（旧名 ShareLink） | `existingShareLink` | 是 |
| `TeamCreate` / `TeamDelete` / `SendMessage` | Agent Teams 多代理协作（TeammateRunner、团队消息） | `team_name`、`message` | 否 |
| `DelegateTool` | delegate 模式下把实现类工具委托出去 | — | — |
| `EnterWorktree` / `LeaveWorktree` | git worktree 隔离会话（`.codebuddy/worktrees`） | — | 是 |
| `CronCreate` / `CronDelete` / `CronList` | 会话内定时任务（`CODEBUDDY_DISABLE_CRON`） | cron 表达式 | 否 |
| `ListMcpResources` / `ReadMcpResource` / `WaitForMcpServers` | MCP 资源枚举/读取；等服务端连接（≤5s） | `server`、`uri` | 否/是 |
| `PushNotification` / `ReportFindings` / `Monitor` / `REPL` / `SaveMemory` / `ComputerUse` / `WeChatReply` / `WeComReply` | 通知；结构化代码审查发现；监控；REPL；记忆写入；电脑操作（`CODEBUDDY_COMPUTER_USE_ENABLED`）；微信/企微渠道回复 | — | 视情况 |

### 3.2 工具注册结构

证据（bundle ~6646179 / ~9420712）：工具以 `{name, description, inputSchema, provider, category, requiresApproval}` 注册进 `DelegateToolManager.registerTool`；MCP 工具经 `createToolProxy` 包装，带 `_meta.serverName`；内置工具有 `TOOL_SHORT_DESCRIPTION_META_KEY` 摘要字段；延迟工具由 `ToolSearchService.replaceServerTools` 建索引（minisearch）。

---

## 4. 权限模式实现

### 4.1 模式清单（证据：官方 docs/cn/cli/permission-modes.md + bundle 字符串 `"acceptEdits"/"bypassPermissions"/"plan"/"dontAsk"`、`permissionMode`(211 处）)

| 类别 | 模式 | 基线语义 |
|---|---|---|
| 用户可切 | `default` | 信任目录内 Read 放行，其余询问 |
| | `acceptEdits` | + Edit/Write/MultiEdit/NotebookEdit 自动放行；Bash 仍询问 |
| | `auto` | 最终会 ask 的动作交给 **`autoModeClassifier` 子代理**二判（allow/deny，无中间态；失败 fail-closed，连续失败自动回退 default）；过宽的 allow 规则（`Bash(*)`、`Agent(*)` 等）在 auto 下被临时忽略 |
| | `dontAsk` | 未预批准动作**直接拒绝不弹框**（连 AskUserQuestion/ExitPlanMode 也拒）；CI 白名单场景 |
| | `plan` | 委托给进入前的模式，仅额外放行"本会话计划文件"写入；退出恢复原模式 |
| | `bypassPermissions` | 跳过绝大多数审批（`-y`/`--dangerously-skip-permissions`）；`permissions.disableBypassPermissionsMode:"disable"` 可管理员禁用 |
| | `delegate` | 主代理只留协调类工具（Agent/TaskCreate/SendMessage/团队管理），实现类工具屏蔽 |
| 程序化 | `fullAccess`（IDE，≈bypass）、`work`（IDE：Read 直接放行、Edit 询问、安全 Bash 放行）、`ignore`（子代理专用：沿用父会话模式） | — |

切换：会话内 `Shift+Tab`（Win 兼容 `Alt+M`）循环 `default→bypassPermissions→acceptEdits→auto→plan→delegate`；`--permission-mode` 启动指定 6 种；优先级 会话值 > CLI > `permissions.defaultMode` > default。

### 4.2 判定链（docs 明示的 9 层顺序，bundle 中有 `permissionDecision`(53)、`checkPermission`、`trustedDirectories`、`additionalDirectories` 对应实现）

```
hooks/交互型工具特殊处理 → deny 规则（永远最强）→ 可信 allow 规则
→ 命令安全检查（仅交互式）→ ask 规则 → bypassPermissions 短路
→ 不可信 allow 规则 → 当前 mode 基线 → 非交互兜底（auto/dontAsk 收口）
```

- 受保护文件（`.git`、shell rc、`.npmrc`、`.codebuddy`（除 worktrees）、`.mcp.json` 等）即使 acceptEdits/bypass 也特殊处理
- 子代理 mode 解析 7 级：调用入参 `mode` → frontmatter `permissionMode`（`ignore`=继承）→ `--subagent-permission-mode` → `CODEBUDDY_SUBAGENT_PERMISSION_MODE` → settings `permissions.subagentPermissionMode` → 继承映射（delegate→default）→ 继承主会话；父会话为 auto/dontAsk 时子代理被**钳制到同级**（ceiling）
- 规则语法：`Bash(npm test)`、`Edit(src/**)` 式 allow/ask/deny + `autoMode` 顶层配置（`environment/allow/soft_deny/hard_deny`），自检命令 `codebuddy auto-mode defaults|config|critique`

---

## 5. 上下文与压缩策略

证据：bundle 常量模块（`DEFAULT_TOKEN_THRESHOLD:()=>eE ... let eE=.7, eC=.5`）、压缩管理器代码、product.json `tokenUsageThresholds`。

- **窗口预算**：模型条目声明 `maxInputTokens`（如 default=200000、deepseek-v4-pro=1M）；会话预算 = `resolveSessionContextBudget(session, model)`，优先 `contextWindow.supportedLengths` 中的合法档位；auto-compact 窗口默认 **200k**（`CODEBUDDY_AUTO_COMPACT_WINDOW`，clamp 100k~1M）
- **阈值**（product.json `tokenUsageThresholds`）：
  - `inputTokens`: warning 0.6 / critical 0.7 / emergency 0.9 / preMessage 0.5（代码内 `DEFAULT_TOKEN_THRESHOLD=0.7`、`DEFAULT_WARNING_THRESHOLD=0.5`；env `CODEBUDDY_AUTOCOMPACT_PCT_OVERRIDE`、`CODEBUDDY_PRE_MESSAGE_COMPACT_PCT` 可覆盖）
  - `compact.emergency`: 0.4（deepseek 系 0.5）；`summary.emergency`: 0.15；`request.emergency`: 0.9
- **触发类型**（`CompactType` 枚举）：`user-command`（/compact 手动）、`pre-message-auto`（发消息前预压缩，`CODEBUDDY_PRE_MESSAGE_COMPACT`）、`emergency-auto`（触顶应急）
- **执行方式**：不是简单截断，而是派一个专用 **`compact` agent**（product.json agents[].name=compact，模板 `compact-agent-prompt`/`compact-prompt`）对历史做摘要；另有 `contextSummary` agent（`context-summary-prompt`、`context-summary-max-token-prompt`）；设置项 `autoCompactEnabled` 默认开；连续压缩上限 `DEFAULT_MAX_CONSECUTIVE_COMPACT=5`；压缩期间有 pending interruption 时推迟（`compactBlockedByPendingInterruption`）
- **其他**：`microcompact`（2 处）、`imageHistoryRetainRounds`（图片历史保留轮次）、`cleanupPeriodDays`（会话历史清理周期，`CODEBUDDY_DISABLE_SESSION_HISTORY_CLEANUP`）

---

## 6. 子代理机制

证据：`AgentTask.init(eA){... this.agentType=eA.subagent_type ...}`（bundle ~6745653）、`AgentNames` 枚举、docs/sub-agents.md、product.json agents 表。

- **调用面**：`Agent` 工具，参数 `subagent_type`（对齐 Claude Code 的 Task 工具）、`description`、`prompt`、`model`（可指定 `lite`/`reasoning` 场景变体或具体模型）、`mode`（权限模式）、`detached`（后台/分离）
- **定义来源**（4 类，tags 区分）：内置（built-in）/ 项目 `.codebuddy/agents/*.md` 与 用户 `~/.codebuddy/agents/*.md`（YAML frontmatter：description/prompt/tools/model/permissionMode）/ 插件 agents 目录 / `--agents '<json>'` CLI 动态注入（`CLI_OPTION_AGENT_TAG`）
- **内置 agent 名册**（AgentNames 枚举，bundle 证据）：
  - 用户可见：`general-purpose`、`Explore`（只读探索，默认用 lite 模型）
  - 内部生成器（`INTERNAL_GENERATOR_AGENTS`，UI 隐藏）：`compact`、`contextSummary`、`contentAnalyzer`、`terminalTitleGenerator`、`promptSuggestion`、`summaryGenerator`、`promptHookEvaluator`、`insightsAnalyzer`、`memorySelector`、`agentInstructions`、`autoModeClassifier`、`fork`（fork=会话分叉，`CODEBUDDY_DISABLE_FORK_SUBAGENT`）
- **运行体**：`AgentTask`（setupPhase → executePhaseWithRetry；捕获 `MaxTurnsExceededError` 收尾），子代理 maxTurns 下限 `MIN_SUBAGENT_MAX_TURNS=200`（env `CODEBUDDY_CODE_SUBAGENT_MAX_TURNS`）；`MAX_SUBAGENT_DEPTH` 限嵌套深度；`DEFAULT_MAX_SUBAGENTS_PER_SESSION` + env `ENV_MAX_SUBAGENTS_PER_SESSION` 限并发数
- **模型解析链**：`CODEBUDDY_CODE_SUBAGENT_MODEL` > 调用入参 > 项目/用户 `subagents.agents.<名>.model` > 内置声明（Explore→lite）> 继承主对话模型（docs/models.md 明示）
- **团队形态**：Agent Teams（`TeamCreate`/`SendMessage`/`TeammateRunner`，`teamContext.memberName`、`isFormalTeamMember`），主代理 `delegate` 模式只做拆派
- 每个子代理**独立上下文窗口**，结果以 tool_result 回填主会话；`TaskOutput` 拉取后台子代理输出

---

## 7. API 端点与模型清单

### 7.1 端点（证据：product.json `endpoint/officialEndpoints/authentication` + bundle 域名提取）

| 用途 | URL |
|---|---|
| 主 API（国内 SaaS） | `https://copilot.tencent.com`（staging：`staging-copilot.tencent.com`） |
| 国际站 | `https://www.codebuddy.ai`（staging：`staging-codebuddy.tencent.com`） |
| SSO / 远程控制通道 | `https://tencent.sso.codebuddy.cn/v2`（centrifuge WebSocket；iOA 域 `tencent.sso.copilot.tencent.com` 等） |
| 静态资源/插件市场 | `https://download.codebuddy.cn/model-icon/*.svg`、`/plugin-marketplace/` |
| 文档/仓库 | `code.codebuddy.ai/docs`、`https://cnb.cool/codebuddy/codebuddy-code`（腾讯 CNB 托管） |
| 遥测 | `https://galileotelemetry.tencent.com`（galileo，projectId `SDK-768de26ec97715a3bbab`，app=WorkBuddy/Desktop）+ OTLP `https://sg.tgalileo.com/v1/{logs,metrics,traces}`、`/ocp/api/v1/get_config`、`/api/v1/profile/write` |
| 企微/微信渠道 | `https://qyapi.weixin.qq.com/cgi-bin/*`（gettoken/message/send/kf 客服）、`https://ilinkai.weixin.qq.com` |
| 本地 HTTP API（daemon/web-ui 提供） | `/api/v1/{acp,auth/status,auth/login,channels,plugins,settings,storage,workers,scheduled-tasks,workspace-dirs,team/messages,permission-bridge/request,...}` |
| BYOK/第三方模型目录（内嵌，供自定义模型/网关） | openrouter.ai(269 次）、ai-gateway.vercel.sh(188)、bedrock-runtime(100+)、api.openai.com、router.huggingface.co、gateway.ai.cloudflare.com、api.mistral.ai、individual.githubcopilot.com、integrate.api.nvidia.com、generativelanguage.googleapis.com、api.fireworks.ai、api.together.ai、api.anthropic.com(仅 14)、api.moonshot.cn/ai、api.kimi.com、open.bigmodel.cn、api.z.ai、api.deepseek.com、api.groq.com、api.cerebras.ai、api.x.ai、api.minimaxi.com、api.xiaomimimo.com（小米 MiMo）、api.ant-ling.com 等 |

### 7.2 鉴权

- 登录：浏览器 OAuth + **PKCE**（bundle 内 `pkceChallenge/code_verifier/code_challenge` S256 实现）；`cli-external-link` 类型，`Authorization: Bearer <token>` + `X-User-Id`（URLEncode）头，`prefixPath:/plugin`；token 刷新 `/v2/auth/token/refresh`
- 环境变量：`CODEBUDDY_API_KEY`（可 `CODEBUDDY_API_KEY_DISABLED` 禁用）、`CODEBUDDY_AUTH_TOKEN`、`CODEBUDDY_BASE_URL`（自建网关覆盖）、`CODEBUDDY_CUSTOM_HEADERS`、`CODEBUDDY_INTERNET_ENVIRONMENT`（内外网环境路由）、`CODEBUDDY_API_KEY_HELPER_DISABLED`/`_TTL_MS`

### 7.3 模型清单（product.json `models`，节选；协议统一 OpenAI `/chat/completions`，见 docs/models.md "目前仅支持 OpenAI 接口格式"）

| id | 名称 | maxIn/maxOut |
|---|---|---|
| `default` | Default（产品默认，icon wb-primary） | 200k / 24k |
| `auto` | Auto | 168k / 32k |
| `deepseek-v4-pro` / `-v4-flash` | DeepSeek V4 Pro / Flash | 1M / 50k |
| `deepseek-v3-2-volc`、v3-1 系、r1-0528 | DeepSeek V3.2/V3.1/R1（火山/lkeap 渠道） | 96k / 32k |
| `glm-5.2/5.1/5.0(-turbo)/5v-turbo/4.7/4.6(v)` | 智谱 GLM 系列 | 128k–1M |
| `kimi-k3-1`（Kimi-K3，1M/32k）、`kimi-k2.7/k2.6/k2.5/k2-thinking`、`kimi-k2-instruct-taiji` | 月之暗面 | 31k–1M |
| `minimax-m2.5/m2.7/m3` | MiniMax（m3 512k/128k） | — |
| `hy3` / `hy3-preview` | 混元 Hy3（192k/64k） | — |
| `hunyuan-chat`（Turbos）、`hunyuan-2.0-thinking` | 腾讯混元 | 128k |
| `hunyuan-image-v3.0-art` 等 | 文生图专用 | — |
| `codewise-*`、`hunyuan-3b/7b-dense` | IDE 补全小模型（maxOut 256） | — |
| `default-1.1`（Claude-3.7-Sonnet） | 历史遗留 | 200k |

- 场景变体：`relatedModels.{lite,reasoning}`（仅这两个生效；env `CODEBUDDY_SMALL_FAST_MODEL`/`CODEBUDDY_BIG_SLOW_MODEL` 最高优先）
- 自定义：`~/.codebuddy/models.json` 与项目级（热重载 1s 防抖，`CODEBUDDY_DISABLE_BUILTIN_MODELS` 可关内置）
- 注意：bundle 未出现 Anthropic Messages SSE 自有实现（`content_block_delta` 仅 9 处，属 ACP 兼容层）——**即使选 Claude 模型也走 OpenAI 兼容网关**

---

## 8. 沙箱执行机制（vendor/sandbox + vendor/shim）

### 8.1 三分支架构（证据：bundle `BashSandboxManager.initialize` + docs/bash-sandboxing.md + vendor 目录）

```
Bash/PowerShell 命令
├─ Linux   → @anthropic-ai/sandbox-runtime（bubblewrap；缺 bwrap 依赖则告警禁用）
├─ macOS   → 同上（Seatbelt；vendor/toybox-macos + zsh-macos 提供受控用户态）
└─ Windows → 腾讯自研 sandbox-cli 5.4.7（vendor/sandbox/5.4.7/：
             sandbox-cli.exe / sandbox-cli-gc.exe / sandbox-center.exe /
             tsbx.dll / tsbx_sdk.dll / sandbox_ffi.dll / betterleaks.exe（密钥泄漏扫描）/
             tsbx_rules.json）
```

- **tsbx_rules.json**（Windows 文件策略）：`default_action: deny_write`、`recyclebin_backup: true`（删除进回收站可恢复）、`auto_grant: true`；规则保护 `%USERPROFILE%\.ssh\**`、`.gnupg\**`（no_access），放行 Temp、npm/pnpm/Yarn 缓存、`$RECYCLE.BIN` 等
- **IPC 协议**：bundle 内 `SandboxCLIClient`（命名管道/Unix socket，`createIpcRequest(id, payload, cmd)`，默认超时 120s），命令字至少含 `"execute"`（跑命令）与 `"broker"`（代理转发）；会话结束走 `SandboxCLISessionEndHook → sandboxLifecycle.stop()`
- **网络隔离**：沙箱外代理按域放行（新域触发权限询问）；`maliciousDomainProtectionEnabled`（威胁域名库，settings `sandbox.network.*`）
- **逃生舱**：模型可对失败命令加 `dangerouslyDisableSandbox` 重试（需用户审批；`allowUnsandboxedCommands:false` 关闭）；`excludedCommands`（如 docker）强制出沙箱；`acceptEdits` + `sandbox.autoAllowBashIfSandboxed` 时沙箱内命令自动批准
- 云端选项：`e2b@2.3.6`（`SandboxLauncherType.E2B`，`e2bApiUrl`），`--sandbox` 远程沙箱会话（teleport/uploadWorkingDir/keepAlive）

### 8.2 shim 层（vendor/shim/，对**沙箱内子进程**做语言级拦截）

| 文件 | 机制（头部注释原文证据） |
|---|---|
| `node-language-shim.cjs` | 唯一 `NODE_OPTIONS --require` 入口，组合 safe-delete + brokered-fs 两类 hook；需 `CODEBUDDY_SESSION_ID`（兼容 `CLAUDE_SESSION_ID`） |
| `node-safe-delete-shim.cjs` | "Installs only delete-protection hooks"——patch fs 删除 API，删除走回收站/保护清单（`CODEBUDDY_SAFE_DELETE_ENABLED`，报告路径 `CODEBUDDY_SAFE_DELETE_REPORT_PATH`） |
| `node-brokered-fs-shim.cjs` | "Installs brokered file-token and host-op hooks"——patch `fs.mkdirSync/renameSync/cpSync/chmodSync/linkSync...`，经 `broker-ipc-client.cjs` 向宿主 broker 申请 file-token/host-op；**broker 失败 fail-open 静默退化为原生 fs**（`CODEBUDDY_SANDBOX_BROKER_DEBUG=1` 可见） |
| `broker-program-policy-check.cjs` | 程序黑名单共享检查：`node broker-program-policy-check.cjs <program>`，退出码 0=放行 / **126=forbidden_program** / 13=策略不可用；经 IPC 询问宿主（`CODEBUDDY_SANDBOX_PROGRAM_POLICY_COMMAND`） |
| `safe-bin/{rm,rmdir,unlink}` + `safe-delete-common.sh` | PATH 前置的 rm 替身："no sandbox session → 直通真 rm"；有会话则走 safe-delete（进回收站） |
| `brokered-bin/*`（ls/cp/mv/rm/sed/grep/cat/find… 30 个） | toybox 多调用二进制 dispatch（`codebuddy-toybox-dispatch`）：先过 program-policy 检查（exit 126/13 即拒），再从 PATH 剔除 brokered-bin 防递归，转发 `CODEBUDDY_TOYBOX_BIN` |
| `shell-runtime-bash-env.sh` / `brokered-sandbox-bash-env.sh` | 经 `BASH_ENV` 注入 bash 子进程，组合上述两套环境 |
| `native/brokered_sandbox_native.c` + `*.node`（darwin） | broker 原生 addon（koffi FFI 配套） |
| `sitecustomize.py` | Python 侧同款拦截入口 |

**设计要点**：OS 级隔离（bwrap/Seatbelt/tsbx）之外，再用"语言 shim + PATH 替身 + broker IPC"把 Node/bash/Python 子进程里的删除、写文件、起程序三类危险操作收回宿主进程做策略判定——这是区别于原版 Claude Code 的腾讯自研增量。

---

## 9. headless 与交互模式差异

证据：bin 路由逻辑（§1）、docs/headless.md、headless bundle 特征计数。

| 维度 | 交互模式（codebuddy.js） | headless（codebuddy-headless.js） |
|---|---|---|
| 入口 | 默认（无特殊 flag） | `--print/-p`、`--acp`、`--input-format/--output-format`、daemon 系命令、`--bg` |
| UI | Ink/React 全屏 TUI（快捷键 Shift+Tab/Alt+M、状态栏、审批弹窗） | 无 REPL；stdout 输出（`text` / `stream-json`（41 处）/ JSON），ink 仅用于简易进度 |
| 权限收口 | 弹窗询问 | 不能弹窗：`default/acceptEdits/plan`→拒；`auto`→分类器（不可用 fail-closed、transcript 过长中止 run）；`dontAsk`→拒；`bypassPermissions`→放行（docs 明示） |
| fallbackModel | 不生效 | **仅 print 模式生效**（FallbackModelErrorInterceptor 判定 `session.options?.print`） |
| 协议面 | — | ACP（`--acp`，@agentclientprotocol/sdk 0.25.0，供 Zed 类 IDE）；SDK（sdk-typescript/python，`SDK_INITIALIZE_AGENT_TAG` 注入 agent 覆写）；daemon（`ps/logs/attach/kill` 后台会话，命名管道 `\\.\pipe\` 或 `/tmp/*.sock`，prewarm 预热 `cbc-prewarm`） |
| 兜底 | — | headless bundle 缺失时回退完整 bundle（MODULE_NOT_FOUND 分支） |

共同点：同一 DI 容器、同一 @openai/agents 内核、同一 product.json 配置链——**headless 不是裁剪版内核，只是换了 I/O 壳**。

---

## 10. 附：会话存储与遥测

- **本地存储**：根目录 `~/.codebuddy/`（`CODEBUDDY_CONFIG_DIR` 覆盖；`WORKBUDDY_CONFIG_DIR` 兼容）——`sessions/`（`getDefaultSessionsDir()`，bundle 证据）、`history.jsonl`（29 处 jsonl 引用）、`agents/`、`plans/`、`todos/`、`tasks/`、`checkpoints/`（fileCheckpointingEnabled）、`memory/`（CODEBUDDY_MEMORY_ENABLED / typed/team memory）、`settings.json`+`settings.local.json`、`models.json`、`keybindings.json`；`--resume`/`resumeSession` 恢复会话（23 处）；项目级 `.codebuddy/`（settings、agents、worktrees、`CB_PROJ_CB.md` 项目记忆）
- **凭据**：`@genie/at-rest-crypto` 静态加密；webpack external 的 `better-sqlite3` 供桌面端共享组件使用（CLI 主路径未见直用）
- **遥测**：galileo（见 §7.1；`processPerformanceIntervalMin:5`、`aggregatorFlushIntervalSec:15`）+ OTLP（traces/metrics/logs 三件套）+ 钩子 `GalileoToolResponseErrorReportHook`、`TraceCollectorStopHook`（工具错误与会话 trace 上报）；`telemetry.report.standard/model.enabled`、tracing 默认全开；`CODEBUDDY_MONITOR_ENABLED` 监控开关

---

## 关键结论速览

1. **内核是"套壳+编排"而非自研循环**：agent loop 直接用 OpenAI Agents JS SDK 0.5.2，腾讯的工程量在 DI 组件层（@celljs，~150 组件）、权限链、沙箱、提示词与渠道。
2. **单一 wire 协议**：所有模型（含 Claude）走 OpenAI chat/completions；模型目录=内置 product.json（云下发）+ models.json 覆盖 + 内嵌第三方目录（opencode/vercel-gateway 风格）。
3. **配置即代码**：118 个 nunjucks 提示词模板、工具描述、agents、阈值全部放在 product.json，云端可热更——bundle 里几乎没有硬编码系统提示（"You are" 仅 4 处，主提示 `cli-agent-prompt` 18KB 在 product.json，含内容合规 content_policy）。
4. **权限是 9 层链 + 10 种 mode**，亮点是 `auto` 模式的 LLM 分类器（autoModeClassifier agent）与 `dontAsk` 的 CI 白名单语义。
5. **压缩是 agent 化的**（compact/contextSummary 子代理做摘要），阈值 cloud-tunable，默认 200k 窗口 0.7 触发。
6. **沙箱是最大差异化**：Anthropic runtime（*nix）+ 自研 tsbx（Windows）+ 语言 shim/PATH 替身/broker IPC 三层叠加，外加 e2b 云沙箱与密钥泄漏扫描（betterleaks）。
