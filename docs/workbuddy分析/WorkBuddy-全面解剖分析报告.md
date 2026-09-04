# WorkBuddy 全面解剖分析报告

> **分析对象**：腾讯 WorkBuddy 桌面版（内部名 `@genie/workbuddy-desktop`，版本 **5.4.7**；内核 CodeBuddy CLI，版本 **2.132.0**，内部代号 genie / Claw）
> **素材来源**：本机安装目录 `C:\Program Files\WorkBuddy\`，解包产物位于 `_analysis\extracted\`（app.asar 内 20,226 个文件）与 `resources\app.asar.unpacked\`（未打包资源）
> **分析日期**：2026-09-04 ｜ **分析方式**：静态逆向（asar 解包 + minified bundle 字符串/结构分析 + 随包官方文档 60+ 篇通读 + 全部 Prompt 模板原文提取）
> **配套材料**：6 份专题笔记位于 `_analysis\notes\01~06-*.md`，本报告是其汇总升华；所有 Prompt 模板**原文**已提取至 `_analysis\extracted\resources\templates\`，路径索引见附录 B。

---

## 0. 摘要：一页看懂 WorkBuddy

**WorkBuddy = Electron 桌面壳 + 内嵌 CodeBuddy CLI 内核 + 云端 product.json 配置驱动 + 腾讯文档/IM 生态深度集成**的办公 AI Agent。

| 层 | 技术选型 | 一句话说明 |
|---|---|---|
| 桌面壳 | Electron（main 1.4MB bundle） | 只管窗口/IPC/更新/安全存储，业务全部下放 |
| 业务进程 | Daemon（ELECTRON_RUN_AS_NODE fork） | CellJS DI 容器（~150 组件），会话/鉴权/SQLite/扩展宿主 |
| Agent 内核 | **@openai/agents 0.5.2**（OpenAI Agents JS SDK） | 主循环非自研；自研增量在权限链/沙箱/提示词/渠道 |
| 模型协议 | **OpenAI chat/completions 单一协议** | 40+ 内置模型（DeepSeek/GLM/Kimi/混元…），云端 product.json 下发 |
| 提示词 | nunjucks 模板，**118 个模板云端热更** | 两代架构并存：单体式（旧）→ 组合式 fragments（新） |
| 交互模式 | Craft / Ask / Plan / Expert 四模式 | 模式即插件：工具白名单与提示片段都由插件声明 |
| 扩展生态 | 插件市场（兼容 Claude Code 规范） | 33 个内置插件：技能/专家/MCP/交互模式/欢迎人格 |
| 安全 | 三层纵深 | 权限规则层 + OS 沙箱层（tsbx 自研）+ 内容防注入层 |
| 腾讯生态 | editor_sdk 本地化 + 14 路 IM 渠道 | 腾讯文档引擎嵌进桌面端，AI 直接读写 Office 文件 |

**进程拓扑一图流**：

```
Renderer(React SPA) ──IPC wb:invoke──> Electron Main ──NDJSON stdio RPC──> Daemon(业务)
                                              │                              │
                                        窗口/托盘/更新/safeStorage      Sidecar(会话保姆)
                                                                         │ spawn
                                              CLI进程群 <────────────────┘
                                              每会话一个 codebuddy --serve
                                              ACP over HTTP/SSE (127.0.0.1)
                                              + Prewarm 池: 冷启 3.7s→1ms
```

---

## 1. 背景、方法与合规说明

### 1.1 研究目的
为嘉立创自研办公 Agent 提供架构与产品设计参考。我们关注的是**设计思想与工程机制**（依据《计算机软件保护条例》，为学习研究软件内含的设计思想和原理而进行的分析），而非复制代码资产。

### 1.2 合规边界（建议写入立项材料）
- 本报告及解包素材**仅限内部学习研究**，不得对外分发；
- WorkBuddy 的源码、Prompt 模板原文属腾讯知识产权，自研产品**不可原样搬运**，须独立撰写；
- 腾讯软件许可协议大概率禁止反向工程，本分析基于学习研究目的，商业使用前建议法务复核；
- 下文的借鉴清单均已转化为"机制级"描述，自研时应自行实现。

### 1.3 解剖方法（可复现）
1. **解包**：app.asar（287MB）用自写 Node 脚本解析 Pickle 头（`wb-list.js` / `wb-unpack.js`，存于 `_analysis\`），提取 2,269 个关键文件（~460MB）；
2. **未打包资源**：模板、插件、CLI bundle、文档直接位于 `app.asar.unpacked\`，无需解密——**Electron 应用无代码保护，全部明文**；
3. **bundle 分析**：所有 JS 为 esbuild/rolldown 压缩产物，但保留 `//#region` 原始源码路径与大量中文事故复盘注释（含 issue 编号），可还原 monorepo 结构（`apps/workbuddy-desktop`、`packages/{agent-cli,workbuddy-core,workbuddy-server,agent-ui,runtime-admission-protocol}`）；
4. **文档交叉验证**：随包 60+ 篇官方中文文档（`extracted\cli\dist\web-ui\docs\cn\cli\`）与代码证据互证。

### 1.4 版本指纹
- 桌面端：`@genie/workbuddy-desktop@5.4.7`，author Tencent，homepage codebuddy.ai
- CLI：`@tencent-ai/codebuddy-code@2.132.0`，webpack 路径泄漏证实同 monorepo（`D:\git\workbuddy-desktop-1\genie\...`）
- 沙箱：`@tencent-ai/sandbox-cli@5.4.7`（与桌面端同版本号，统一发版）

---

## 2. 总体架构：单内核、多进程、多形态

### 2.1 五层进程拓扑（详见笔记 01）

```
┌ Electron Main (main/index.js) ─────────────────────────────┐
│ 只做 Electron 才能做的事：窗口/CSP/托盘/协议/auto-update/    │
│ safeStorage/系统代理；StartupPipeline 编排 27 个启动 step    │
│ ipcMain.handle('wb:invoke') 万能路由（双层鉴权）             │
└──────▲──────────────────────────────▲───────────────────────┘
  IPC  │ wb:* 通道                     │ stdin/stdout NDJSON 帧
┌──────┴───────┐                        │ {type: ready|rpc-request|
│ Renderer     │                        │  rpc-response|rpc-event}
│ (React SPA)  │               ┌────────┴─────────────────────┐
└──────────────┘               │ Daemon = app-server          │
                               │ ELECTRON_RUN_AS_NODE fork,   │
                               │ 4GB 堆；CellJS DI 容器        │
                               │ 业务全在这：会话/鉴权/SQLite  │
                               │ (WAL)/MCP host/腾讯文档/扩展  │
                               │ /IM 渠道；崩溃 respawn 治理   │
                               └──▲───────────────▲──────────┘
                  JSON-RPC 2.0    │ named pipe     │ ACP over HTTP
              ┌───┴────┐          │ spawn          │ SSE+POST /api/v1/acp
              │ Sidecar│──────────┘      ┌─────────┴──────────┐
              │ 保姆进程│  session.create  │ CLI 进程群          │
              └────────┘                  │ codebuddy --serve  │
                                          │ + --prewarm 待命池  │
                                          └────────────────────┘
```

**各进程职责**：
- **Main**：27 个声明式启动 step（统一超时/critical 失败 abort/阶段预算）；`evalMode`（daemon 跑 main 内）已在 v5.4.7 硬编码关闭，生产固定子进程 daemon。
- **Daemon**：入口 `assertDaemonProcessRole()` 断言 env，不对即 exit(1)——进程身份单一来源（SSoT）。承载全部业务；三条反向桥回 main（desktop-host/monitor/docs）；`DaemonRecoveryPolicy` 决定 respawn/give-up；SHUTDOWN→SIGTERM→SIGKILL 三级停止；退出前必做 SQLite WAL checkpoint。
- **Sidecar**：纯会话子进程保姆（注释明言"CLI 的 ACP HTTP server 才是真正 transport"）；Windows 用 spawn 管道、POSIX 用 node-pty（因 node-pty Windows 事故太多）；父进程死后 stderr 连续 3 次 EPIPE 即自杀防孤儿。
- **CLI**：每会话一个 `--serve` 进程，自持 `http://127.0.0.1:<port>/api/v1/acp`。
- **Prewarm 池**：`cbc --prewarm` 先跑完冷启动（bundle 加载→DI 容器→认证→产品配置→MCP 发现）挂 IPC 待命，activate 时 chdir+透传参数变身 `--serve`——**新会话拉起 3.7s → ~1ms**。

### 2.2 四条通信链路（协议选型务实，逐层降级）

| 链路 | 协议 | 要点 |
|---|---|---|
| Renderer ↔ Main | Electron IPC `wb:invoke` | channel-map 按域生成；**可信 subject 由 main 按 sender.id 反查**，不信任 renderer 上报；daemon 端 PermissionRegistry 二次鉴权 |
| Main ↔ Daemon | **自研 NDJSON stdio RPC** | 5 种帧（ready 握手/rpc-request/response/error/event）；channel 契约集中在 `main/contract*.js`（50+ 通道）；stderr 留 80 行 tail 做崩溃归因 |
| Daemon ↔ Sidecar | JSON-RPC 2.0 over named pipe | `session.create/ready/kill/list`；控制 socket 带 uuid 防误连；PID 文件+journal 收尸 |
| Daemon ↔ CLI | **ACP over streamable HTTP**（开放协议） | GET SSE（`Acp-Connection-Id` 绑定、`Last-Event-ID` 断点续传、指数退避）+ POST JSON-RPC（newSession/prompt/cancel/setSessionMode…，POST 超时 3 小时支持长任务）；Agent Teams 状态走 `_meta['codebuddy.ai/teamUpdate']` 扩展 |

**安全关键点**：CLI 的 HTTP 端口由 `gateway-secret` 保护——daemon 生成一次性 32B secret 经 env 注入 CLI，REST 调用须 `Authorization: Bearer`。这是 **CNVD-ZC-2026-6234**（同机任意进程未授权 RCE）的修复。secret 不落盘、loopback 豁免 ACP 主通道。

### 2.3 Prewarm 池的工程细节（桌面 Agent 宿主的"标准答案"）
- **命中策略"宁慢勿错"**：调用方 deltaEnv 与固化 baselineEnv 比对，任何未审计差异（不在 `PER_SESSION_ENV_KEYS` 白名单或 `_TOKEN/_API_KEY` 后缀）→ 回退冷启动；白名单登记要求 CLI 侧对该 env 必须运行时 live 读（注释详述"静默取旧值"陷阱）。
- **activate-safe 漂移键**（PATH/HTTP_PROXY 等 14 个）单独不一致时不回收整池，activate 时覆盖。
- **回收与补池**：idle TTL 15min 到期不补池；健康探活与 acquire 解耦（防误杀初始化中的进程，#75795 有完整复盘）；补池退避 10s×2 封顶 60s 防崩溃循环；**auth 变化 flush 整池**。

### 2.4 启动序列：六段并行打点
A(main 早期)→C(窗口)→B(bootstrap)→D(preload)→E(renderer)→F(daemon 内部) 六段并行打点到**同一 jsonl 泳道**（`<pid>-<time>.jsonl` 共享，瀑布展示）；daemon 与窗口并行启动，renderer 用 splash+skeleton 等待 daemon ready。启动类型四态维度（first_install/upgrade/cold/warm）。

---

## 3. Agent 内核解剖（详见笔记 04）

### 3.1 最重要的认知：内核是"套壳+编排"
Agent 主循环**不是自研**，直接 bundle 了 **OpenAI Agents JS SDK 0.5.2** 的 Runner（`RunState`、`processModelResponse→resolveTurnAfterModelResponse→applyTurnResult`、`maxTurns=500`）。腾讯的工程量在：
- **@celljs DI 层**（inversify 风格，~150 组件）
- 权限判定链、沙箱、提示词工程、腾讯生态渠道

### 3.2 启动链路
```
bin/codebuddy (162 行未压缩)
├─ V8 compile cache（冷启 ~400ms→~254ms）
├─ Fast path: --version 只读 package.json 退出（避开 150 组件 DI 初始化）
└─ isHeadless 路由：--print/-p/--acp/--bg/daemon 系 → codebuddy-headless.js
                     默认 → codebuddy.js（Ink/React TUI）
```
两个 bundle 共享同一 DI 容器与内核，**headless 不是裁剪版，只是换了 I/O 壳**。

### 3.3 主循环伪代码（从 bundle 证据还原）
```
session.run(userInput):
  agent = resolveCurrentAgent()          # 默认 "cli"，product.json 声明
  sysPrpt = nunjucks 渲染 product.json 模板 + 运行时上下文
  state = RunState(input, previousResponseId?, conversationId?)
  for turn in 1..500:                    # DEFAULT_MAX_TURNS
      interceptors.preModelCall()        # History/State/AgentSwitch/
                                         # ConditionalRules 等拦截器链
      stream = openai.chat.completions.create(stream:true)   # 单一协议
      for chunk in stream: emit UI events
      processed = processModelResponse(response)  # 拆 tool_calls
      if 无 tool_use → 终止
      for call in toolCalls:
          decision = permissionChain(call)     # 9 层判定，见 §3.5
          result = tool.execute(zod 校验入参)
          ToolCallLoopDetector.check(call)     # 死循环检测
      applyTurnResult(state, turnResult)
      if tokens ≥ 阈值 → 触发 compact      # 见 §3.6
  异常收口：MaxTurnsExceeded / FallbackModelErrorInterceptor
           （overloaded 先重试主模型→切 fallback；quota 尽立即切）
```

### 3.4 内置工具系统（47 个，描述云端热更）
工具的 **description 不硬编码在 bundle，而在 product.json 的 `tool-*-description`**——云端可热更。分域清单：

| 域 | 工具 |
|---|---|
| 文件 | Read（图片/PDF/notebook）、Write、Edit、MultiEdit、NotebookRead/Edit、Glob、Grep（内置 ripgrep.node）、LS |
| Shell | Bash、PowerShell（仅 Win，内置危险模式检查器 iex/Add-Type 拦截） |
| 网络 | WebFetch（URL+AI 分析）、WebSearch |
| 子代理/团队 | Agent（subagent_type/description/prompt/model/mode/detached）、TaskCreate/Get/List/Update、TaskOutput/TaskStop、TeamCreate/Delete、SendMessage、DelegateTool |
| 模式/计划 | EnterPlanMode/ExitPlanMode、EnterWorktree/LeaveWorktree |
| **延迟加载** | **ToolSearch + DeferExecuteTool**——工具默认不进上下文，模型先搜后激活（minisearch 索引），MCP 工具爆炸的通用解法 |
| 代码智能 | LSP（定义/引用/诊断，市场 11 种语言插件） |
| 多模态 | ImageGen/ImageEdit/VideoGen（hunyuan-image 系） |
| 发布 | Artifact（HTML/MD 发公网链接）、ArtifactControl |
| 任务/定时 | TodoWrite、CronCreate/List/Delete |
| 其他 | StructuredOutput（JSON Schema）、AskUserQuestion、Skill/SkillManage/SlashCommand、Workflow（现场编写 JS 编排脚本后台调度数十~数百子代理）、ListMcpResources/ReadMcpResource/WaitForMcpServers、PushNotification、ReportFindings、Monitor、REPL、SaveMemory、ComputerUse（macOS 桌面控制）、WeChatReply/WeComReply |

### 3.5 权限体系：10 种模式 × 9 层判定链（安全设计的精华）
**模式**：default / acceptEdits / **auto**（LLM 分类器 `autoModeClassifier` 二判剩余 ask，fail-closed，连续失败自动回退 default；过宽规则 `Bash(*)` 在 auto 下临时失效）/ **dontAsk**（不弹框直接拒，CI 白名单场景）/ plan / bypassPermissions / delegate（主代理只留协调工具）；程序化：fullAccess / work / ignore（子代理继承）。Shift+Tab 循环切换。

**9 层判定链**（顺序即一等公民）：
```
hooks 特例 → deny（永远最强）→ 可信 allow → 命令安全检查（交互态危险命令强制 ask）
→ ask → bypass 短路 → 不可信 allow → 模式基线 → 非交互兜底（auto/dontAsk 收口）
```
**亮点**：allow 分**可信/不可信**两层——未信任仓库提交的项目级 allow 规则不能越过危险命令检查，防"克隆恶意仓库即提权"的供应链投毒。规则语法 `Bash(npm:*)`、`Edit(src/**)`、`WebFetch(domain:)`、`mcp__server__tool`；Bash 前缀解析 `&&/||/;/|` 逐子命令判定。受保护文件（.git/shell rc/.mcp.json/settings.json）任何模式都特殊处理。

### 3.6 上下文与压缩
- 窗口预算按模型 `maxInputTokens`（default 200k，deepseek-v4-pro 1M）；auto-compact 默认 **200k 窗口、0.7 阈值**（warning 0.6/critical 0.7/emergency 0.9，云端 `tokenUsageThresholds` 可调）。
- **压缩是 Agent 化的**：不是截断，而是派专用 `compact` / `contextSummary` 子代理对历史做摘要；连续压缩上限 5；三种触发（手动 /compact、pre-message 预压缩、emergency 触顶）。
- **输出外部化**：Bash>30k 字符、其他>50KB、MCP>20k tokens 自动落盘 `tool-results/`，模型只收截断+路径指针。

### 3.7 子代理与 Agent Teams
- 定义 4 来源：内置（`general-purpose` 全工具 / `Explore` 只读 lite / `Plan`）+ 项目/用户 `.codebuddy/agents/*.md`（YAML frontmatter）+ 插件 agents + `--agents '<json>'` 动态注入。
- 内部隐藏生成器 agents：compact、contextSummary、contentAnalyzer、promptSuggestion、autoModeClassifier、memorySelector 等 12 个。
- 治理：嵌套深度 ≤5；每会话 spawn 预算 200；**子代理输出回传前"去毒"**（改写仿冒 `<system-reminder>` 与行首 Human:/Assistant:，防提示注入回灌）。
- **Agent Teams**：team-lead + 多 teammate（各自独立上下文）+ 共享任务列表（依赖解除阻塞）+ Mailbox 消息（message/broadcast/shutdown/plan_approval）+ delegate 模式（领导只协调不动手）+ `@成员` 直聊。

### 3.8 模型与端点
- **所有模型（含 Claude）走 OpenAI chat/completions 兼容网关**——无 Anthropic 原生 SSE 实现。
- 模型目录三层：内置 product.json（云下发）+ 用户/项目 `models.json`（热重载 1s 防抖）+ 内嵌第三方目录（openrouter/vercel gateway/bedrock… 供 BYOK）。
- 内置 40+ 模型：DeepSeek V4 Pro/Flash（1M）、GLM-5.2/4.7、Kimi-K3（1M）/K2 系、MiniMax M3、混元 Hy3/2.0-thinking、文生图 hunyuan-image 系、IDE 补全小模型 codewise-*。
- 场景变体 `relatedModels.{lite, reasoning}`：Explore/压缩/goal 评估走 lite 便宜模型。
- 端点：主 API `copilot.tencent.com`、国际 `codebuddy.ai`、SSO/远程控制 `tencent.sso.codebuddy.cn/v2`（centrifuge WS）、遥测 `galileotelemetry.tencent.com` + OTLP `sg.tgalileo.com`、插件市场 `download.codebuddy.cn/plugin-marketplace/`。
- 鉴权：浏览器 OAuth + **PKCE S256**；`Authorization: Bearer` + `X-User-Id`；env 优先级 `CODEBUDDY_AUTH_TOKEN > apiKeyHelper > CODEBUDDY_API_KEY`。

### 3.9 沙箱执行（腾讯最大差异化）
```
Bash/PowerShell 命令
├─ Linux   → @anthropic-ai/sandbox-runtime（bubblewrap）
├─ macOS   → 同上（Seatbelt + vendor toybox/zsh 受控用户态）
└─ Windows → 自研 tsbx 5.4.7（sandbox-cli.exe + tsbx.dll + betterleaks
             密钥泄漏扫描 + tsbx_rules.json 文件策略：默认 deny_write、
             删除进回收站、.ssh/.gnupg no_access）
```
叠加**语言 shim 三层拦截**（腾讯自研增量）：`NODE_OPTIONS --require` 注入 node 子进程（safe-delete 删除进回收站 + brokered-fs 写操作向宿主 broker 申请 file-token）；PATH 前置 30 个 toybox 命令替身（先过程序黑名单策略检查，退出码 126=forbidden）；`BASH_ENV`/`sitecustomize.py` 覆盖 bash/Python。网络按域白名单代理，新域触发询问。逃生舱 `dangerouslyDisableSandbox` 需审批。云端可选 E2B 沙箱。

---

## 4. Prompt 工程体系（详见笔记 02；原文已全部提取）

### 4.1 两代架构并存（重要的演化证据）

| 代际 | 位置 | 形态 |
|---|---|---|
| 旧·单体式 | `resources/templates/*.tpl`（10 份完整模板 + 7 风格 + reminder） | 每个"模式×场景"一份完整文件，差异靠维护多份 |
| 新·组合式 | `plugins/workbuddy-builtin/{welcomemode,interactionmode,prompt-common}` | 一份主模板 + nunjucks `{% include %}` 按 `workMode` 变量拼装 fragments |

加载链路：
```
marketplace.json（36 插件条目）
 └ welcomemode-code/work/design（category: welcomeMode）
    └ agents/code.md = frontmatter + {% include "welcomemode-code/prompt.tpl" %}
       └ prompt.tpl
          ├─ {% if workMode == "ask" %}{% include "interactionmode-ask/fragments/..." %}
          ├─ interactionmode-*/fragments/{interaction,current-mode,agent-loop,
          │    tool-use,task-management,mode-behavior,plugin-recommendation}.md
          └─ prompt-common/fragments/{workbuddy-memory-system,memory-context}.md
```
**精妙机制**：`interaction.md` 是"双面文件"——YAML frontmatter（`tools:` 白名单，含 `Defer(X)` 延迟加载标记）给插件加载器读；`{% include %}` 只取正文给模板引擎。**一份文件同时完成工具策略与提示组装**。

### 4.2 主提示结构（workbuddy-prompt.tpl，370 行，23 章）
排布逻辑：**身份/能力 → 安全边界 → 地域习惯 → 模式说明 → 执行循环 → 结果交付 → 专项规约 → 收尾注入**（安全前置、交付居中、注入槽占首尾，符合"首尾效应"）。章节目录：

1. `This conversation is powered by {{ modelName }}`——模型身份与产品身份分离（不写 "You are X"）
2. 能力清单（第二人称打气句式对抗自我设限；多模态按特性开关裁剪；专家入口做提示级 i18n）
3. 文档自助指引——产品知识外置到文档站，提示只放路由规则
4. 数据目录防误删声明（大写 NOT）
5. 四层记忆注入槽（`{{ WorkbuddyMemory_1 }}{{ WorkingMemoryContent }}{{ UserLocalMemoryContent }}{{ UserMemoryContent }}`）
6. `<content_policy>`——提示保密（连结构存在性都禁止暗示、拒绝时不解释理由）+ 合规底线 + 反绕过声明
7. `<personal_files_safety>`——**篇幅最大的安全章节，Trigger→Rules 结构**（先定义触发面并预堵规避话术"Even 'just scan, don't delete' triggers these rules"，再列 8 条事故驱动规则：禁区目录/扫描只读/模糊先问/警告确认/先备份/用回收站/单批≤10/Windows 禁写非 ASCII 路径脚本）
8. `<windows_command_safety>`（`{% if IsWindows %}` 平台条件注入；**失败后禁止换命令重试**）
9. `<regional_conventions>`——A 股红涨绿跌、¥ 符号（显式假设默认用户是中国人）
10. `<working_modes>`——三模式一句话口诀，Ask 模式主动建议切 Agent（模式互导）
11. `<agent_loop>`——8 步循环，第 7 步强制 present_files、第 8 步 final answer（加粗 IMPORTANT 收束行为）
12. `<result_presentation>`+`<sharing_files>`——交付纪律：present_files 唯一入口、多文件合并一次调用、"给用户直接访问文档，而不是你解说工作"
13. `<final_answer_instructions>`——**UI 感知写作指令**（"中间过程在 UI 被折叠，最终回复必须自足并复述关键结果，上限 50-70 行"）
14. `<automations>`——定时任务 self-contained 要求（"未来运行看不到当前对话，公司名/路径必须写进 prompt"）
15. `<tool_use>`——禁提工具名、时间戳禁止心算（"your arithmetic is unreliable"）
16. `<instructions_for_visualizer>`——可视化触发体系（Explicit→Proactive→Specification triggers；"The spec is the request"；never exposes machinery）+ 6 个 few-shot
17. `<task_management>`——施压句式"and that is unacceptable"
18. `<asking_questions>`——hooks 反馈视同用户输入
19. `<tool_usage_policy>`——专工具优于 shell、大范围探索派 Explore 子代理省 context
20. `<agent_skills>`——**find-skills 前置**（"说'我做不到'之前必须先调 find-skills"）+ 浏览器任务必载 agent-browser + 安装安全审计 P0/P1/P2 分级 + 技能积累-反思-纠错自维护循环（"Unmaintained skills are liabilities, not assets."）
21. `<expert_management>`——专家 CRUD 路由 + **负向触发说明**（"只是在和现有专家聊天"不触发）
22. `<mcp_configuration>`——配置手册（"NOT .mcp.json 带点前缀"踩坑记录）
23. `<response_language>`+`<binary_context>`——收尾注入槽

### 4.3 模板引擎与变量（nunjucks）
- 语法：`{{ var }}`（支持点路径）、`{% if/elif/else %}`、`{%- -%}` 空白控制、`{% include %}`、`{# 注释 #}`（注入点留白做成注释）、`'中文' in ResponseLanguage` 表达式；**无 `{% for %}`**——提示是静态分发，工具清单走 frontmatter 而非模板循环。
- 约 40 个变量分两类：**渲染期开关**（workMode/IsWindows/productFeatures.*/ExpertManagementEnabled/LocalSkillsMemoryEnabled）与**运行期内容槽**（PluginAgentPrompt/记忆三层/BinaryContext/ToneStyleContent）——"静态内容模板化，动态内容槽位化"，槽位一律裸变量不包标签，格式化责任留给注入方。

### 4.4 模式差异矩阵（四模式 = 工具白名单 + 提示片段的组合差异）

| 维度 | ask | craft（Agent） | plan | expert |
|---|---|---|---|---|
| 工具白名单 | 纯只读（Read/Glob/Grep/WebFetch/AskUserQuestion…） | 完整集（+Write/Edit/Bash/Task/present_files…） | craft + EnterPlanMode/ExitPlanMode | 同 plan |
| current-mode | 5 条硬规则（不改文件/不跑命令/**不得谎称已创建**/建议切 Agent） | 空（默认态） | 空 | `{# PluginAgentPrompt #}` 注释占位 |
| agent-loop | 无循环（单轮问答） | 标准 8 步 | 标准 8 步 | +`<agentic_mode_overview>`（**每个任务必须产出 overview.md artifact**） |
| 专属片段 | mode-behavior（讲完请用户切 Agent） | plugin-recommendation（推荐 Connector/Expert，"never invent names"） | — | **PluginAgentPrompt 人格注入槽**（专家提示 = 通用 OS + 人格 APP） |
| automations/记忆 | 不注入（`{% if workMode != "ask" %}` 裁剪，ask 得最小提示省 token） | 注入 | 注入 | 注入 |

场景差异（work/code/coding/design/expert）通过**增减条款而非重写**实现；expert 版另有**模型分档限复杂度**（"Claude/GPT 无上限；GLM/KIMI 中等封顶；Hunyuan/Minimax 最小封顶。These are ceilings, not targets"）——多模型产品的实用主义提示写法。

### 4.5 reminder 三层递进机制
1. **系统提示常驻条款**（基础约束）→ 2. **模式切换 reminder**（`ask-mode-reminder.tpl`："This supersedes any other instructions you have received" 显式覆盖声明防旧模式残留）→ 3. **工具结果夹带 `<system-reminder>`**（情境化即时纠偏，主提示预先告知模型该标签语义）。

### 4.6 身份与风格系统
- **四层身份分离**：模型身份（powered by X）/ 产品身份（You are productName）/ 子人格（设计师助手但共享产品身份，防品牌分裂）/ 用户人格（SOUL.md）。
- **身份文件体系**（user-context-identity.tpl）：SOUL.md（人格，模型可改但须报备）/ IDENTITY.md / USER.md（用户画像）/ BOOTSTRAP.md（出生证明，onboarding 后自焚——"Follow it, figure out who you are, update SOUL.md… then delete BOOTSTRAP.md"）。
- **7 种风格同构定义**（style-*.md）：Tone & Voice / Language Patterns（正反例）/ Behavioral Guidelines / Response Structure 四小节，**全文注入** `{{ ToneStyleContent }}` + 元规则隔离——"The style affects HOW information is delivered, not WHAT"（风格是渲染层，正确性是数据层；毒舌风格内嵌 HARD RULE 安全护栏与情绪熔断）。
- **优先级一句话栈**："style > 默认行为，安全 > 用户自定义"——用元规则解决多层指令冲突。

### 4.7 Prompt 原文获取
全部模板**原文**（未删节）已提取，路径见附录 B。建议重点精读：`workbuddy-prompt.tpl`（主提示）、`workbuddy-expert-prompt.tpl`、`workbuddy-craft-design-prompt.tpl`（设计场景几乎重写前半部：目标节点优先/截图自检/三段式强制回复格式+Forbidden 反例清单）、`welcomemode/code/prompt.tpl`（新架构组合式范本）。

---

## 5. 插件 / 技能 / MCP 生态（详见笔记 03）

### 5.1 插件框架：Claude Code 兼容超集
- 元数据目录优先级 `.codebuddy-plugin/` > `.workbuddy-plugin/` > `.claude-plugin/`（兼容）；环境变量双名互兼容（`${CODEBUDDY_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_ROOT}`）——**降低生态迁移成本的刻意设计**。
- `plugin.json` 仅 `name` 必填；组件目录固定约定（commands/agents/skills/hooks/.mcp.json/.lsp.json/bin/output-styles/settings.json），铁律：组件目录必须在插件根，不能放进元数据目录。
- 市场 = `marketplace.json` 目录文件，4 种来源（本地/GitHub/任意 Git/HTTP）；**安装即复制到版本化缓存**（`~/.codebuddy/plugins/cache/<市场>/<插件>/<版本>`，缓存键 version>commit SHA），插件禁引用自身目录外文件（路径遍历封禁）；持久数据走独立 DATA 目录随卸载清理。
- 作用域 user/project/local/managed 四级；`/reload-plugins` 热重载；依赖治理（自动安装标 `auto:true`，prune 清孤儿）。
- **内置 vs 市场信任差**：内置 Skill 的 frontmatter hooks 免闸门（admin-trusted），第三方默认拒绝；内置市场自动更新默认开，第三方默认关。

### 5.2 内置插件全景（33 个，分六类）
- **welcomeMode**（3）：welcomemode-code/work/design——会话入口根 agent（agent 定义与提示实体分离，agents/*.md 只是挂载点）
- **interaction**（4）：interactionmode-ask/craft/plan/expert——模式提示片段+工具策略
- **template**（1）：prompt-common——共享记忆片段
- **skill**（23）：ardot 设计系 6 个（设计系统/路由/转代码/UI/海报/幻灯片）、多模态生成、专家管理器、地图合规、云空间库总线（skill-library，8 子域）、技能脚手架、腾讯文档路由、本地 Office 编辑、**wb-finance-skill 金融全家桶**等
- **mcp-app**（1）：ardot-mcp-app（带 widget UI 的 MCP）
- **builtin-plugin**（4+）：**sheetagent**（电子表格智能体，内嵌 stdio MCP）、**tencent-docs-plugin**（腾讯文档双技能身份路由：个人版/企业 SaaS，4 个 MCP endpoint，`tencentdocs.py` 薄包装"先查 schema 再调用，严禁凭记忆拼参数"，doc_format 四步排版流水线）、**tencent-docx**（本地 .docx 专业创作：编排器守门+design-token+7 体裁 HTML 模板+html-review 6 维审查+Python html→docx 转换器 20+ 模块+国标规则文件化）、tencent-pptx、weixinpay；另有未登记的 **miora-mcp**（智能画布+文生图/文生视频 MCP，产物本地化后入画布）。

### 5.3 技能机制：渐进式披露范式
- SKILL.md = YAML frontmatter（name/description/**when_to_use**/allowed-tools/disable-model-invocation/user-invocable/context:fork/hooks）+ 正文即提示词；正文只放**红线+路由**，方法论拆 `references/*.md` 按需 Read——控制常驻 context。
- **教科书案例 wb-finance-skill**：frontmatter 穷举 a-f 六类口语触发场景（"我 X 套了 40% 怎么办"）自封"金融场景总入口"；红线一票否决（禁编造数据/固定免责声明）；工具委派纪律（"委派 query 必须是一句话检索意图，禁止拆维度清单"附正反例）；三步强制流程（场景标签→按对照表加载 references→输出自检）；46 篇 references + 16 个 Python 脚本（quant/price-action/ib 三组）；默认交付 HTML 研报（ECharts+`node --check` 自检）。

### 5.4 MCP 生态
- 三 transport（stdio/sse/http）+ JSONC 配置 + 三作用域（local>project>user）+ 项目级首连审批 + `${VAR:-default}` 环境变量扩展。
- **defer_loading + ToolSearch**：大工具量服务器的标准解法（与权限正交）。
- **MCP Apps**（`io.modelcontextprotocol/ui`）：工具结果渲染为对话内可交互 widget（异源 sandbox iframe + CSP + postMessage JSON-RPC）；**widget 反向调工具强制弹框授权，与模型主动调用的 allow 规则完全隔离**——值得照抄的安全设计；TUI 自动文本降级。
- 超大响应 >20k tokens 自动落盘。

### 5.5 Hooks / 记忆 / 权限
- **27+ hook 事件**（PreToolUse/PostToolUse/SessionStart/Stop/UserPromptSubmit/PermissionRequest/PreCompact/TaskCreated/TeammateIdle/FileChanged…）× 4 种类型（command/prompt 小模型判定/agent/http）；输出契约三态退出码 + stdout JSON（`permissionDecision`/`modifiedInput` 改入参/`updatedToolOutput` **替换**工具输出省 token/`additionalContext` 追加）；多来源合并而非覆盖；frontmatter hooks 受信任闸门管控（内置豁免）。
- **记忆四层**：云端只读画像（"任何本地写入会被覆盖"）/ 用户级 MEMORY.md（4000 字符上限，"precise, mandatory rules"）/ 工作区日志（append-only + 30 天蒸馏）/ Auto Memory（AI 自主保存，MEMORY.md 索引前 200 行入上下文）；CLI 侧另有 CODEBUDDY.md 层级加载（向上递归）+ rules 条件规则（alwaysApply/paths）。
- **/goal 自治循环**：每轮结束由 lite 小模型评估条件（达成/继续/不可达三态防死循环），未达成把 reason 注入 history 自动进入下一轮——把自治控制器交给便宜小模型。

---

## 6. 能力目录速查（详见笔记 05，60 篇官方文档通读）

**一个内核七种形态**：TUI / headless（`-p`，Unix 哲学管道）/ `--serve` Web UI（内置 React PWA+xterm 4 分屏+Swagger）/ `--acp` IDE 集成（Zed 系 ACP 协议 + VSCode/JetBrains 伴生进程）/ daemon（常驻+系统服务+每小时静默自更新）/ `--bg` 后台 Worker / SDK（TS+Python，**默认不加载任何文件系统配置，settingSources 显式开启**——被集成场景的默认隔离）。

关键机制补充：
- **Prewarm**：`cbc --prewarm` → IPC 待命 → `activate` 唤醒即服务（`ackMode:"ready"` 等 ACP 初始化完成再交付 endpoint），一进程一会话一次性绑定。
- **HTTP API**：`/api/v1/{runs,acp,sessions,workers,webhooks/:platform,files…}`，E2B envd 兼容（fs/process/pty），`X-CodeBuddy-Request` 头强制 CORS preflight 防 CSRF。
- **Remote Control**：`/gateway` 起本地 HTTP + Cloudflare Quick Tunnel，手机扫码远控；token 认证+登录限流；远程任务自动 bypassPermissions。
- **Channels**：MCP 上一层的薄协议——`claude/channel` capability 把外部事件以 `<channel>` 标签推进会话；双向 channel 暴露 reply 工具；**权限中继**（终端与远程同时弹审批先到先得）；发送者按 from.id 白名单防群注入；`channelsEnabled` 组织管控。
- **Scheduled Tasks**：`/loop`（自然语言转 cron，AI 自主决定下轮提前/延后/结束）；会话级不落盘、3 天过期、空闲才触发、jitter 防拥堵；HTTP API 可建 durable 任务。
- **Checkpointing**：每个用户提示自动快照被编辑文件，`/rewind`（Esc×2）三选一回退（仅对话/仅代码/两者），保留 30 天。
- **监控**：OTel 三级隐私 opt-in（默认只记长度）；`/cost` `/context`（token 分布瀑布）`/stats` `/insights`（AI 生成使用洞察 HTML 报告）。

---

## 7. 腾讯生态集成（详见笔记 06）

### 7.1 腾讯文档引擎本地化（最核心的生态发现）
不是跳网页，而是把**腾讯文档编辑器引擎（editor_sdk.exe 原生二进制）本地化**嵌进桌面端：
1. `editor_sdk --port N` 单端口 HTTP 服务，同时提供 `/mcp`（MCP 工具，AI 读写文档）与 `/static/{doc,sheet,slide,pdf}/pc.html`（编辑器预览，资源内嵌无需外网）；
2. daemon 侧引擎生命周期管理（懒启动/端口扫描/60s 就绪探测/孤儿清理/熔断降级）；
3. renderer 用 `<webview>` 嵌预览（本地引擎 or docs.qq.com 云端 sandbox 两种 pc.html，URL 守卫），preload 提供 **mqq 桥**（仿手 Q JSBridge）：`docx.onSelectionChange` 把用户选区上报为 AI 上下文（5 分钟 TTL）；
4. Prompt 注入 `<tencent_docs_editor_context>` 隐藏块，强制模型先走 `tencent-docs-routing` skill（决策）再调 `tencent-local-office-edit` skill（执行）；
5. Agent CLI spawn 时注入 `editor_sdk_port` env → `tencent-docs-mcp` stdio 桥注册为本地 MCP server → AI 直接读写本地 Office 文件（26 种扩展名），保存/关闭经原生 dialog 用户确认。

**配套**：腾讯网盘（drive-sdk，知识库/我的文件）、乐享知识社区、ima 知识库、腾讯位置服务 POI/地址簿。

### 7.2 数据上报四栈并行
| 栈 | SDK | 分工 |
|---|---|---|
| Aegis（RUM） | aegis-electron/web-sdk-v2 | 崩溃/PV/性能/网络 + 自定义事件（`wb_main_prompt_received/done/failed` 全链路） |
| 灯塔/大同 | beacon + universal-report | 业务全埋点（Teams/协作点击流） |
| 伽利略 Galileo | 自研 Exporter（OTel 格式） | Metrics/Traces/Logs 三支柱，启动 span 树 64 个 mark 点 |
| 设备安全 | qimei-node + **turing-sdk（天御 T-Sec）** | qimei36 设备指纹（所有上报维度）+ 天御设备 token（登录反欺诈） |

### 7.3 IM 机器人渠道（claw 插件体系，14 个插件）
运行时 `workbuddy-server/src/claw/`：PassiveGatewayAdapter 基类 + 插件三件套（ConfigAdapter/GatewayAdapter/OutboundAdapter）+ 连接状态机。渠道：**QQ（自研 WS 网关+扫码绑定）、企微×3（AI Bot SDK WS 长连接/新版/iOA 内网）、微信公众号、微信客服、个人微信（扫码）、腾讯元宝（自研 codec）、飞书（WSClient）、钉钉（stream）、Slack（Socket Mode）、Discord、Telegram、自定义 webhook**。8/14 是腾讯系；统一偏好**长连接**（适合桌面端 NAT 常驻）。企微体验细节：5s 内回"处理中"占位、完成后**原位替换**（满足企微回调超时）。

### 7.4 UI 功能地图
React SPA，导航"助理/项目/专家/自动化/更多 + 任务分组 + 空间分组"；四模式 Craft/Ask/Plan/Expert（与权限模式映射 bypassPermissions→craft 等）；默认模型 glm-4.7-ioa（iOA 内网网关）；专家市场/技能选择器/MCP 配置/腾讯文档预览系/网盘选择器/协作 Teams/自动化看板/创作发布（dream-maker/genie/artifact）等模块；monaco+shiki+mermaid+pdfjs 编辑器基建。CLI Web UI 是独立构建的轻量远程端（"CodeBuddy Code Remote Control" PWA），共享同一会话/模式模型。

---

## 8. 对嘉立创自研办公 Agent 的借鉴清单（按优先级）

### P0：架构骨架（直接决定体验上限）
1. **单内核多形态**：一个执行内核 + TUI/serve/daemon/ACP/SDK 多壳；业务通道用开放协议（ACP over HTTP/SSE），控制面自研轻协议（NDJSON stdio RPC 带 ready 握手），sidecar 只做保姆。
2. **Prewarm 进程池**：冷启动完成后挂 IPC 待命、activate 一次性绑定、env 白名单"宁慢勿错"回退冷启动——桌面 Agent 毫秒级拉起会话的标准答案（3.7s→1ms）。
3. **云端配置驱动**：模型目录/提示词模板/工具描述/阈值/特性开关全部云下发（product.json 模式），客户端少发版；本地 base→overlay→云控三层合并。
4. **启动即可观测**：跨进程分段打点到同一泳道 jsonl；每步统一超时/预算/降级决策。

### P1：Agent 核心机制
5. **组合式 Prompt 架构**：主模板骨架 + `{% include %}` 模式片段 + frontmatter 双面文件（同时声明工具白名单与提示内容）；动态内容裸变量槽位化；空内容条件槽零 token。
6. **模式 = 工具白名单 + 提示片段的组合**；Ask 模式裁剪最小提示省 token；模式切换 reminder 带覆盖声明；工具结果夹带 `<system-reminder>` 即时纠偏。
7. **权限 9 层判定链 + 可信/不可信 allow 双轨**（防恶意仓库投毒）+ auto LLM 分类器（fail-closed + 宽规则临时失效 + critique 自检）。
8. **工具延迟加载**（ToolSearch/Defer 模式）应对 MCP 工具爆炸；**工具描述与 Prompt 云端热更**。
9. **压缩 Agent 化**（专用 compact 子代理摘要而非截断）+ 输出外部化（大输出落盘留指针）+ lite/reasoning 场景模型路由控成本。
10. **子代理治理**：嵌套深度/ spawn 预算/输出去毒防注入；Agent Teams 四件套（领导-成员-共享任务列表-信箱）。

### P2：生态与安全
11. **插件兼容主流规范再扩展**（私有命名空间字段承载产品元数据）；市场=目录文件、安装即复制版本化缓存、路径遍历封禁。
12. **技能渐进式披露**：SKILL.md 只写红线+路由+when_to_use 口语触发穷举，方法论拆 references 按需加载；复杂流水线用"编排器守门+独立质检技能"闭环。
13. **安全三层纵深**：权限规则（想不想）× OS 沙箱（能不能：文件+网络双隔离）× 内容层（配置文件写保护/子代理去毒/Web 隔离上下文）；Windows 自研沙箱 + 语言 shim + PATH 替身可参考 tsbx 思路；**删除一律进回收站**。
14. **本地文档引擎 + MCP 桥**是办公 Agent 打通 Office 文件的关键路径（WorkBuddy 用 editor_sdk 本地化 + stdio MCP 桥 + webview 选区上下文）；嘉立创可评估：本地 Office 套件解析服务化 + MCP 暴露 + 选区/活动文档上下文注入。
15. **SDK 默认环境隔离**（settingSources 显式开启）——同时服务"人直接用"与"被集成"两场景时的信任基石。

### P3：运营与体验细节
16. IM 机器人统一长连接 + 渠道插件三件套（Config/Gateway/Outbound）；占位消息原位替换满足平台回调超时。
17. 定时任务 prompt 必须 self-contained（未来运行无当前会话上下文）。
18. 上报多栈分工：RUM（性能）+ 业务埋点 + OTel（链路）+ 设备指纹；prompt 全链路事件（received/forwarding/done/failed）。
19. **故障注释文化**：每个 hack 写明 issue 编号+根因+移除条件——逆向时这些注释是最高价值情报，正向开发时是最佳知识传承。

---

## 附录 A：专题笔记索引（细节证据都在这）

| 笔记 | 内容 | 路径 |
|---|---|---|
| 01 | 进程架构/通信协议/CLI 生命周期/鉴权/配置 | `_analysis\notes\01-architecture.md` |
| 02 | Prompt 体系全解剖（23 章逐条/40 变量/模式矩阵/技巧清单） | `_analysis\notes\02-prompts.md` |
| 03 | 插件/技能/MCP/hooks/记忆/权限 | `_analysis\notes\03-plugins-skills.md` |
| 04 | CLI 内核（主循环/47 工具/权限链/压缩/沙箱/端点） | `_analysis\notes\04-cli-core.md` |
| 05 | 60 篇官方文档能力目录（23 主题矩阵+10 亮点） | `_analysis\notes\05-capabilities.md` |
| 06 | 腾讯 SDK/腾讯文档集成/上报/UI/IM 渠道 | `_analysis\notes\06-tencent-integration.md` |

## 附录 B：Prompt 模板原文路径（已提取，可直接精读）

**核心系统提示**（`_analysis\extracted\resources\templates\`）：
- `workbuddy-prompt.tpl`（36.6KB，主提示/work 场景 craft 模式）
- `workbuddy-expert-prompt.tpl`（37.3KB）、`workbuddy-expert-code-prompt.tpl`、`workbuddy-expert-coding-prompt.tpl`
- `workbuddy-craft-code-prompt.tpl`（37.9KB）、`workbuddy-craft-coding-prompt.tpl`、`workbuddy-craft-design-prompt.tpl`（29.6KB，设计场景）
- `workbuddy-ask-prompt.tpl`（13.7KB）、`workbuddy-ask-code-prompt.tpl`、`workbuddy-ask-coding-prompt.tpl`
- `user-context-identity.tpl`、`user-context-expert-identity.tpl`（身份注入）
- `ask-mode-reminder.tpl`、`craft-mode-reminder.tpl`、`system-reminder.tpl`
- `style\style-{professional,friendly,efficient,creative,sarcastic,socratic,straightforward}.md`（7 风格）

**新架构组合模板**（`_analysis\extracted\resources\plugins\workbuddy-builtin\`）：
- `welcomemode\{code,work,design}\prompt.tpl` + `.workbuddy-plugin\plugin.json` + `agents\*.md`
- `interactionmode\{ask,craft,expert,plan}\fragments\*.md`（模式片段+工具白名单 frontmatter）
- `prompt-common\fragments\{workbuddy-memory-system,memory-context}.md`
- `.codebuddy-plugin\marketplace.json`（33 插件注册表）

**CLI 侧提示词与配置**：不在 bundle 硬编码，在 product.json（118 个 nunjucks 模板 + 工具描述 + agents + 模型目录 + 阈值），已全部提取：`_analysis\extracted\cli\product.json`（367KB，主配置）、`product.ioa.json`（60KB，iOA 内网）、`product.internal.json`、`product.cloudhosted.json`、`product.selfhosted.json`（私有化）。

## 附录 C：关键源码文件索引（bundle 内含原始路径 region 注释）

- 入口/启动：`main\index.js`（StartupPipeline 27 步）、`main\daemon-app-server-entry.js` / `daemon-app-server-main.js` / `daemon-bootstrap.js`
- RPC：`main\server.js`（stdio-framing、acp-client、SecurityCenter、claw 渠道运行时）、`main\contract*.js`（50+ 通道契约）
- CLI 生命周期：`main\cli-prewarm-pool.js`（含大量事故复盘注释）、`main\sidecar-entry.js`
- 安全：`main\gateway-secret.js`、`main\credential-protection.js`（at-rest 加密 WBEF1 格式）、`main\fs-protection.js`、`main\network-gate.js`、`main\tls-verification.js`
- CLI 内核：`_analysis\extracted\cli\dist\codebuddy.js`（21.5MB）/ `codebuddy-headless.js`（17.6MB）、`cli\bin\codebuddy`（162 行 launcher）
- 沙箱：`resources\app.asar.unpacked\cli\vendor\sandbox\5.4.7\`（tsbx）、`cli\vendor\shim\`（语言 shim/PATH 替身/broker IPC）
- 腾讯文档：`main\tencent-docs-prompt-selection.js`、`tencent-docs-main-integration.js`、`node_modules\@tencent\tencent-docs-ai-engine\`、`tencent-docs\webview-preload.js`

---

*报告完。所有证据文件均以 `_analysis\` 为根的相对路径给出，可直接打开验证。*
