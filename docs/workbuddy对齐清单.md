# KamiBuddy × WorkBuddy 能力对齐清单

> 目标：WorkBuddy 是完整模仿对象。本清单把它的能力拆到「可以一条一条攻破」的粒度，
> 既包含用户看得见的功能，也包含看不见的内部机制 —— 只对着界面看必然漏掉后者。
>
> 建立于 2026-09-10。对象 WorkBuddy v5.4.7 / CodeBuddy CLI 2.132.0。
> 证据在 `docs/WorkBuddy-reference/extracted/`（5.4.7 解包；5.5.4 增量调研用
> `%TEMP%\wb-asar-554` 即取即用），细节见 `docs/WorkBuddy-reference/notes/` 与 `docs/workbuddy分析/`。
>
> 状态图例：✅ 已对齐 ／ 🟡 部分对齐（缺口写在我们列）／ ❌ 未做 ／ ⛔ 明确不做（附理由）
>
> 当前 192 条：**✅ 37 ／ 🟡 42 ／ ❌ 88 ／ ⛔ 25**（L23 拆为 a–d 四个子项）

## 怎么用这份清单

1. 每行都能独立开一个 spec，编号即 spec 名（如「C6 内联可视化」）。
2. 「WorkBuddy 机制」列写的是内部实现，不是界面描述 —— 复刻时按这一列做，不要按印象做。
3. 状态列只反映代码里实际有的东西，不反映文档里写过的计划。勾选前先看一眼证据。
4. 优先级建议在文末。

清单来源（不靠对着界面看）：随包官方能力文档 64 篇 +
`main/common.js` 的 **244 个 ProductFeature 特性开关枚举** + CLI bundle 的工具名枚举 +
内置插件与技能目录 + `docs/workbuddy分析/` 十篇逆向笔记。
特性开关那一项尤其重要 —— 它暴露了大量界面上看不出来的功能（比如语音的 ASR/TTS
是两个独立开关、删除文件工具存在但可被关闭）。

---

## A. 壳层与进程架构

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| A1 | 主进程职责收窄 | main 只做窗口/生命周期/safeStorage/托盘/更新/本地探测服务，不解释业务 payload | `src/main/index.ts` 同思路：窗口 + utilityProcess 托管 + 文件对话框 | ✅ |
| A2 | 业务进程独立 | daemon 由 main spawn 的独立子进程，入口带 `assertDaemonProcessRole()` 身份断言，env 不对立即 exit(1) | `utilityProcess.fork` 起 daemon，独立构建入口 | 🟡 无进程角色断言 |
| A3 | 主↔业务 RPC | 自研 NDJSON stdio 帧协议 5 种帧（ready/rpc-request/rpc-response/rpc-error/rpc-event），ready 握手 60s 超时，pending 慢调用诊断，50+ 通道契约集中在 `main/contract*.js` | `shared/daemon-protocol.ts` + `shared/ipc.ts` 集中契约；ready 推送 + 主动查询双路 | ✅ |
| A4 | 业务面协议 | 会话业务走 ACP over streamable HTTP（SSE 下行 + POST 上行，`Acp-Connection-Id` 绑定、`Last-Event-ID` 断点续传、指数退避重连、背压水位） | 进程内直接调 pi SDK，无 HTTP/ACP 层 | ⛔ 单机桌面不需要，接 IDE 时再议 |
| A5 | 会话保姆进程 | Sidecar 只做子进程 spawn/pipe/reap；Windows 用管道不用 node-pty（历史事故）；父死自愈（连续 3 次 EPIPE 主动退出） | 无独立保姆，pi 会话跑在 daemon 进程内 | ⛔ 我们不 spawn CLI 子进程 |
| A6 | Prewarm 进程池 | 冷启动跑完挂本地 IPC 待命，activate 时 chdir 变身 `--serve`，3.7s → ~1ms；env 白名单「宁慢勿错」、activate-safe 漂移键、idle TTL 15min、健康探活与 acquire 解耦 | 无 | ❌ |
| A7 | 启动打点 | A–F 六段跨进程打点到同一 jsonl 泳道（main 与 daemon 共享），StartupPipeline 27 个 step 各带超时/预算 | 无 | ❌ |
| A8 | 崩溃治理 | respawn 退避 + give-up 防死循环 + 三级停止（RPC→SIGTERM→SIGKILL）+ stderr tail 随 crash entry 上报 + 传输错误与状态损坏区分处理 | daemon 崩溃时 main reject 全部 pending，有状态上报 | 🟡 无退避/三级停止/tail |
| A9 | 单实例锁 | `app.requestSingleInstanceLock` | 无 | ❌ |
| A10 | 托盘 / 多窗口 | 托盘菜单 + 窗口管理域 | 单窗口、无托盘 | ❌ |
| A11 | 自动更新 | 三平台 update-service（mac 整包替换 + install-channel marker）、force-upgrade、架构不匹配引导 | 无 | ❌ |

## B. Agent 内核

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| B1 | Agent 主循环 | 不自研，bundle `@openai/agents@0.5.2` 的 Runner；每轮 processModelResponse → resolveTurnAfterModelResponse → applyTurnResult | 不自研，用 pi 的 AgentSession | ✅ |
| B2 | 最大轮次 | `DEFAULT_MAX_TURNS=500`，`CODEBUDDY_CODE_MAX_TURNS` 可覆盖，超限记「reached max turns limit」后收尾 | pi 自身控制 | 🟡 未暴露为配置 |
| B3 | 流式事件 | delta / tool_calls / reasoning_content 三类累积，多路复用给 TUI / ACP / stream-json | pi 事件流 → `shared/session-events.ts` → renderer | ✅ |
| B4 | 中断与插队 | `SteerInputBuffer` + abortController + SDK interruption；排队消息可 ↑ 拉回编辑 | 有 abort（含 Esc 二次确认）；无排队消息编辑 | 🟡 |
| B5 | fallback 模型 | `FallbackModelErrorInterceptor`：overloaded 先重试主模型再切 fallback，quota 耗尽立即切；仅 headless 生效 | 无 | ❌ |
| B6 | 推理强度 | `reasoning_content` + `EFFORT_LEVELS` + `reasoningEffort` 设置 + `alwaysThinkingEnabled` | pi 透传，界面无开关 | 🟡 |
| B7 | 场景模型变体 | `relatedModels.{lite,reasoning}` 两档；解析链 env(`SMALL_FAST`/`BIG_SLOW`) > 项目 > 用户 > 主模型 relatedModels > 内置 > 主模型；lite 用于 Explore 子代理、压缩、goal 评估 | 无 | ❌ 省钱关键项 |
| B8 | 模型目录 | 内置 `product.json`（云下发）+ 用户/项目 `models.json`（热重载 1s 防抖）+ 内嵌第三方目录；`availableModels` 白名单 | `core/model-catalog.ts`：pi 内置 40 家 1354 模型 + 自建服务商 + 未配凭据的模型显式禁用 | ✅ |
| B9 | 结构化输出 | `StructuredOutput` 工具，按 JSON Schema 返回 | 无 | ❌ |
| B10 | 死循环检测 | `ToolCallLoopDetector`：同参重复 N 次发 `LOOP_DETECTION_MARKER` 喝止消息 | 无 | ❌ 便宜且有效 |
| B11 | 重试策略 | HTTP 层 maxRetries + 指数退避 + 尊重 Retry-After | pi 自带 | ✅ |

## C. 工具面

我们当前 craft 白名单 16 个：read / read_document / write / edit / find / grep / ls /
web_search / web_fetch / present_files / questionnaire / powershell /
automation_create / automation_list / automation_delete / task。

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| C1 | 文件读写编辑 | Read（文本/图片/PDF/notebook）/ Write / Edit / MultiEdit（同文件多步原子编辑） | pi 的 read/write/edit；无 MultiEdit | 🟡 |
| C2 | 搜索与列举 | Grep / Glob / LS（内置 ripgrep.node + fast-glob） | pi 的 find/grep/ls | ✅ |
| C3 | Shell | Bash（`run_in_background`、`dangerouslyDisableSandbox`）+ PowerShell（Windows 原生，内置检查器，自动适配 5.1/7+） | powershell + `command-guard.ts` 拦 iex / Invoke-Expression / Add-Type / -EncodedCommand / 递归删除 / 下载执行；无后台执行 | 🟡 |
| C4 | 联网 | WebFetch（支持 `WebFetch(domain:)` 权限规则）+ WebSearch | `web-tools.ts`：web_search + web_fetch，含 SSRF 拦截 | ✅ |
| C5 | 产物交付 | present_files：绝对路径/URL 分类，HTML 双路（卡 + 预览），localhost HEAD 探测 2s，非绝对路径整单报错 | `present-files.ts` 同协议 | ✅ |
| C6 | 内联可视化 | `read_me`（拉设计指南模块 diagram/chart/mockup/interactive/art）+ `show_widget`（吐 SVG/HTML 片段内联渲染）；硬校验：禁 DOCTYPE/html/head/body、禁 localStorage、禁 position:fixed、禁 form、SVG viewBox 必须 `0 0 680 H` | `read_me`（diagram/chart 两模块，指南在 `resources/visualizer/`）+ `show_widget`（同款硬校验 + title 规范化）；sandbox iframe + postMessage（流式剥 script/完成保留、高度自适应 ≤2000px、主题跟随）；spec：`.trae/specs/add-inline-widgets/` | ✅ v1：mockup/interactive/art、mermaid、截图 PNG、sendPrompt 未做 |
| C7 | 提问 | AskUserQuestion（多选 + 分页） | `questionnaire-tool.ts`（单选 + 其他 + 跳过，平铺不分页） | ✅ |
| C8 | 计划模式 | EnterPlanMode / ExitPlanMode（计划文件写入是 plan 下唯一额外放行项） | `resources/modes/plan.md` + `/plan` 命令 + 「执行计划」按钮；无显式进出工具 | 🟡 |
| C9 | 任务清单 | TodoWrite + TaskCreate/Get/List/Update/Output/Stop 全套；依赖关系解除阻塞 | 无 | ❌ |
| C10 | 子代理 | Agent 工具：`subagent_type`/`description`/`prompt`/`model`/`mode`/`detached`；4 类定义来源；独立上下文；maxTurns 下限 200 | `task-tool.ts`：单发/并行(≤8, 并发 4)/链式({previous})、深度 1、预算 20、输出去毒 | 🟡 无 detached、无独立模型 |
| C11 | 多代理团队 | TeamCreate/TeamDelete/SendMessage + TeammateRunner + mailbox + delegate 模式 | 无 | ❌ |
| C12 | 技能工具 | Skill / SkillManage / SlashCommand | 技能经 pi 原生 `/skill:name` 加载；无管理工具 | 🟡 |
| C13 | 定时任务 | CronCreate/List/Delete（会话级、3 天过期、每会话 50、退出失效） | `automation-tools.ts` + 调度器 + 落盘库 + 管理页（once/interval/daily/weekly），比 WorkBuddy 更持久 | ✅ 我方领先 |
| C14 | 跨会话检索 | conversation_search（自包含 query 契约，对当前会话零访问权） | 无 | ❌ |
| C15 | MCP 资源 | ListMcpResources / ReadMcpResource / WaitForMcpServers(≤5s) | `mcp-client.ts` 连 server 并注册 `mcp__server__tool`；无资源枚举 | 🟡 |
| C16 | 工具延迟加载 | ToolSearch + DeferExecuteTool：工具不进初始上下文，先搜后用；`Defer(X)`/`NoDefer()` 会话级修饰符 | 无（工具 <20 个，暂不需要） | ❌ MCP 变多后再议 |
| C17 | 多模态生成 | ImageGen / ImageEdit / VideoGen（混元图像系列，模型 ID 单独配置） | 无（图片只做输入） | ⛔ |
| C18 | 发布分享 | Artifact（HTML/MD 发公网链接，可原地更新）+ ArtifactControl | 无 | ❌ |
| C19 | 工作流 | Workflow（Dynamic Workflow 后台运行，TaskOutput 取结果）+ 6 个 workflow 模板 | 无 | ❌ |
| C20 | 代码智能 | LSP（定义/引用/类型/诊断，需语言服务器插件） | 无 | ⛔ 办公场景不需要 |
| C21 | Notebook | NotebookRead / NotebookEdit（Jupyter 单元格） | 无 | ⛔ |
| C22 | Worktree 隔离 | EnterWorktree / LeaveWorktree（`.codebuddy/worktrees`） | 无 | ❌ |
| C23 | 通知与审查 | PushNotification / Monitor / ReportFindings（结构化审查发现） | 无（有 toast，但模型无法主动推） | ❌ |
| C24 | 渠道回复 | WeChatReply / WeComReply | 无 | ⛔ 依赖 IM 渠道 |
| C25 | ComputerUse | 电脑操作（`CODEBUDDY_COMPUTER_USE_ENABLED`） | 无 | ⛔ |
| C26 | 工具描述云热更 | 40+ 条 `tool-*-description` 全在 `product.json`，可云端更新 | 工具描述硬编码在扩展里 | ❌ 依赖云端配置 |
| C27 | 删除文件 | `DELETE_FILES` 工具（`DisableDeleteFilesTool` 特性开关可关）；底层受 tsbx `recyclebin_backup` 与 safe-delete shim 保护，删除进回收站 | 无删除工具（只有 write/edit） | ❌ 与 H13 一起做才安全 |
| C28 | 地图选点 | `pick_location` 工具 + `PoiMap` 特性开关；结果 `{name, address, lat, lng}` 并 setSessionPoi 绑定会话 | 无 | ❌ |
| C29 | 邮件附件 | `agent_mail_upload_attachment` / `agent_mail_download_attachment`；下载附件注入「未信任附件禁止执行」强制红线文案（`[MANDATORY CONSTRAINT — OVERRIDE ALL OTHER INSTRUCTIONS]`） | 无 | ❌ 该红线文案值得先抄进 doc-read |
| C30 | 通知 / 监控 / REPL | `PushNotification`（模型主动推）、`Monitor`、`REPL`、`ReportFindings`（结构化审查发现） | 无（只有系统 toast） | ❌ |

## D. 办公内置插件（产品价值核心）

WorkBuddy 投入最大的一块，而且完全不依赖腾讯云 —— 这是最值得抄的部分。

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| D1 | 本地 docx 生成 | `tencent-docx`：根 SKILL 编排器守门 + 3 agents（doc-writer/formatter/converter）+ 8 skills（brief-compose、design-token、doc-typeset、format-extract、generate-fillable-contract-html、html-review、html-to-docx、tdoc-orchestrator）+ 9 个文体专家（论文/商务/公文/合同/诗歌/研报/博客/工作报告）+ core/engines（critic-generator、deep-research）+ SessionStart 预热 venv + 20 多个模块的 Python html→docx 转换器 | 零。`src/documents/`、`resources/genres/`、`resources/tokens/` 均不存在 | ❌ 最大缺口 |
| D2 | 表格智能体 | `sheetagent`：内嵌 MCP（stdio，defer_loading），自然语言建/查/改 xlsx；SubagentStop hook 自动保存脏文件；10 篇 sheet-references | 无生成（xlsx 仅预览） | ❌ |
| D3 | 幻灯片 | `tencent-pptx` 插件 | 无生成（pptx 仅预览） | ❌ |
| D4 | 腾讯文档集成 | `tencent-docs-plugin`：按身份路由 C 端/SaaS；doc/sheet/slide/smartcanvas 的 create/edit + references（auth/空间/图表/OCR/aipage）+ Python 与 JS 脚本 | 无 | ⛔ 依赖腾讯生态 |
| D5 | 支付插件 | `weixinpay` | 无 | ⛔ |
| D6 | 本地 Office 编辑 | `tencent-local-office-edit` 技能 + editor_sdk 本地引擎（spawn 单端口 HTTP，提供 `/mcp` JSON-RPC 与编辑器预览资源） | 无 | ⛔ 一个团队的量级 |

## E. 技能与专家生态

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| E1 | 技能机制 | SKILL.md 渐进式披露：只写红线 + 路由 + `when_to_use` 口语触发穷举，方法论拆 references 按需读 | pi 原生 Agent Skills + `skills-view` + `resources/skills/`（1 个：meeting-notes） | 🟡 机制对齐、内容只有 1 个 |
| E2 | 内置技能包 | 19 个：ardot 设计 6 个、wb-finance（46 篇 references + 16 脚本）、library（云盘总线）、sites、expert-manager、skill-creator、路由类 3 个等 | 1 个 | ❌ |
| E3 | 技能自维护 | 提示词强制循环：积累（8+ 工具调用必沉淀）→ 反思（用过必评估改进）→ 纠错（发现错别字当场修，「NEVER ask, NEVER defer」） | 无 | ❌ |
| E4 | 技能安装 | `marketplace-skill-installer` + `skill-creator`（init/package/validate 三个脚本） | `core/skill-install.ts` 本地目录导入（同名拒绝不覆盖） | 🟡 无市场、无脚手架 |
| E5 | 专家体系 | expert 模式 + `expert-manager`（创建/打包/注册/校验，含 agent-md/avatar/plugin-json/team 四份 spec）+ 专家团队 | 只有 `resources/agents/*.md` 定义，无管理模式、无 UI | ❌ |
| E6 | 推荐引擎 | `recommend-connectors` / `recommend-experts` + `search_plugins` + `suggest_plugin_install`（每次响应至多一次，1–3 张候选卡） | 「专家/技能/连接器」在加号菜单里是占位 | ❌ |
| E7 | 插件框架 | plugin.json + marketplace.json 两级；注册表 33 条（welcomeMode 3 + interaction 4 + template 1 + skill 19 + mcp-app 1 + builtin-plugin 5）；安装即复制 + 版本化缓存 + 路径遍历封禁；hooks 三条信任通道 | 无插件加载器（用 pi packages + Skills 替代） | ⛔ 见优先级 |
| E8 | 技能安全扫描 | `SkillSecurityScan` 特性开关 + 安装前审计分级（P0 强烈警告劝退 / P1 警告需确认 / P2 放行），且声明「只审安装、不审使用」控制成本 | 无 | ❌ |
| E9 | 意图召回 | `IntentRecommend`：embedding 召回 skill / plugin suite / connector，用于按意图推荐 | 无 | ❌ |

## F. 提示词体系

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| F1 | 组合式模板 | 主骨架 + `{% include %}` 片段；`workMode` 变量分发；条件槽空内容零 token | `core/prompt-composer.ts` 槽位替换（`{{interaction}}{{skills}}{{cwd}}`） | 🟡 有骨架、无 fragments 体系 |
| F2 | 双面文件 | 一份 `.md` 的 frontmatter 给加载器读工具白名单，正文给模板引擎读提示片段 | modes/*.md 与 agents/*.md 都是双面文件 | ✅ |
| F3 | 场景 × 模式矩阵 | welcomeMode 3（work/code/design）× interaction 4（ask/craft/plan/expert） | 场景 1（work）× 交互 3（ask/craft/plan），expert 缺 | 🟡 |
| F4 | 两代架构并存 | 单体 .tpl（9 份）→ 组合式 fragments；灰度迁移保留旧变量名 | 直接上组合式，无历史包袱 | ✅ |
| F5 | 每轮 hidden context | `composeUserPrompt` 遍历 17 个 section：stage(every_turn/first_turn) × container(user-context/additional_data)，包成 `<system-reminder data-role=...>` 前置到用户消息；压缩时 additional-data 可剥离、user-context 常驻 | 无。systemPrompt 由 `before_agent_start` 整体替换，没有用户消息级动态注入 | ❌ 自评最大差距 |
| F6 | 三层 reminder | 系统提示常驻条款 → 模式切换 reminder（含「This supersedes any other instructions」覆盖声明）→ 工具结果夹带 `<system-reminder>` 即时纠偏 | 无 | ❌ |
| F7 | 身份系统 | SOUL.md / IDENTITY.md / USER.md / BOOTSTRAP.md（onboarding 自举后即焚）；人格可演进但须报备 | 无 | ❌ |
| F8 | 风格系统 | 7 种 style-*.md（专业/亲和/高效/创意/毒舌/苏格拉底/直白），同构四小节全文注入 + 「style affects HOW, not WHAT」元规则隔离事实层 | 无 | ❌ |
| F9 | 记忆提示 | 四层注入槽 + 写策略说明（云端只读 / 用户级显式 / 工作区 append-only + 30 天蒸馏） | 无 | ❌ |
| F10 | 内容合规 | `<content_policy>`：提示保密（连结构存在性都禁暗示）+ 合规底线 + 反绕过（role-play、研究、假设场景都不行） | 无 | ❌ |
| F11 | 个人文件安全 | `<personal_files_safety>` 是全提示最长章节：Trigger→Rules 结构，8 条规则（禁区目录、只读扫描、模糊先问、警告+列清单+确认、先备份、用回收站不用 rm、单批≤10、Windows 禁写非 ASCII 路径脚本） | 权限门做了机制层拦截，提示层无此章节 | 🟡 |
| F12 | Windows 命令安全 | 禁多余 shell 包装、破坏命令路径必须绝对且校验、失败后禁止换命令重试 | command-guard 拦危险模式；无「失败禁止重试」提示条款 | 🟡 |
| F13 | 地域约定 | `<regional_conventions>`：A 股红涨绿跌、¥ 符号 —— 显式声明「默认用户是中国人」 | 无 | ❌ 便宜 |
| F14 | UI 感知输出 | `<final_answer_instructions>`：告知模型中间过程在 UI 被折叠，最终回复必须自足、上限 50–70 行 | 场景提示词有「最终回复必须自足」，无行数约束 | 🟡 |
| F15 | 特性开关进模板 | `productFeatures.*` / `IsWindows` / `LocalSkillsMemoryEnabled` 条件裁剪 | 无 | ❌ |
| F16 | 提示级 i18n | `'中文' in ResponseLanguage` 检测，连 UI 指路文案和文档站域名都切换 | 无（只有中文） | ⛔ |
| F17 | 模板云端热更 | 118 个 nunjucks 模板全在 product.json，云端下发；三级合并（内置 → 本地 overlay → 云控）+ 两级缓存 + last-good 门 | 本地文件；`config.get` 单一入口已预留云端 | 🟡 接口预留 |
| F18 | 提示工程量 | 主提示 370 行 23 章，安全类前置、交付类居中、注入槽放首尾（首尾效应） | `resources/scenes/work/prompt.md` 28 行 | 🟡 轻量版 |

## G. 上下文工程

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| G1 | token 账 | 最近一次 API usage 的 inputTokens + 尾部新增工具结果本地估算 | `core/observability.ts` 估算（CJK 1 token/字，其余 4 字符/token），界面标注「估算」 | ✅ |
| G2 | 阈值体系 | warning 0.6 / critical 0.7 / emergency 0.9 / preMessage 0.5；`compact.emergency` 0.4；可云端调 | 有用量圆环 + 分类明细；阈值未做 | 🟡 |
| G3 | 压缩 agent 化 | 不截断，派专用 `compact` agent 做摘要；另有 `contextSummary` agent；连续压缩上限 5；有 pending interruption 时推迟 | pi 自带自动压缩 + `/compact` 手动（customInstructions 透传）；无专用压缩子代理 | 🟡 |
| G4 | microcompact | 细分压缩策略 | 无 | ❌ |
| G5 | 大输出外置 | 超阈值自动落盘，模型只收截断 + 路径指针；Bash / 其他工具 / MCP 三套阈值独立 | `read_document` 24k 截断+续读、子代理输出 24k；通用工具输出不外置 | 🟡 |
| G6 | 图片历史轮次 | `imageHistoryRetainRounds` 控制历史里保留几轮图片 | 无（图片附件随消息进 ImageContent） | ❌ |
| G7 | 历史清理周期 | `cleanupPeriodDays` + `CODEBUDDY_DISABLE_SESSION_HISTORY_CLEANUP` | 无（会话文件一直留着） | ❌ |
| G8 | 引用编码 | prompt-codec 15 种 badge：`file://`、`selection://`、`longtext://`、`comment://`、`skill://`、`tdoc://`、`netdrive://`、`ima://`、`article://` 等 | `@路径` 一种 + 图片/文档 chip | 🟡 |
| G9 | 引用不内联纪律 | `<user_references>` 明文：「Only paths are provided. Use read tool to fetch contents when you need them.」 | 同思路（chip + @路径，read_document 自取） | ✅ |
| G10 | 图片双通道 | base64（Anthropic 形态）+ 紧跟一条 `<image_local_path>` 文本，让模型可按路径重读原图；blob 仅限白名单目录且 realpath 双重校验 | 图片走 pi 的 ImageContent；无路径回读通道 | 🟡 |
| G11 | 附件类型 | 长文本粘贴→chip 全文内联；选区→`<selection_quote>`；评论→llmText；文件/网页/云文档各有 badge 与 hint | 图片 + 文档两类 | 🟡 |

## H. 权限与安全

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| H1 | 权限模式 | 用户可切 7 种（default/acceptEdits/auto/dontAsk/plan/bypassPermissions/delegate）+ 程序化 3 种（fullAccess/work/ignore）；Shift+Tab 循环 | 双旋钮（sandbox: read-only/workspace-write/danger-full-access × approval: ask/never）+ 三档预设 | 🟡 词汇对齐了，模式数少 |
| H2 | 9 阶判定链 | hooks → deny（永远最强）→ 可信 allow → 命令安全检查 → ask → bypass 短路 → 不可信 allow → 模式基线 → 非交互兜底 | `permission-policy.ts` 有序 5 阶段（凭据目录 → 无路径只读 → 本地只读 → 写与命令 → 审批策略） | 🟡 同思路，层数少 |
| H3 | 规则语法 | `Tool(spec)`：`Bash(npm:*)`、`Edit(src/**)`、`WebFetch(domain:)`、`mcp__server__tool`；Bash 前缀会解析 `&&`/`\|\|`/`;`/`\|` 逐子命令判定 | 无规则语法，只有档位 + 路径归属判定 | ❌ |
| H4 | 可信/不可信 allow | allow 分两层：未信任目录的项目级规则不能越过命令检查（防克隆恶意仓库即提权） | 有 `project-trust.ts`（记住信任、不记住不信任）；无 allow 规则层，故此攻击面本不存在 | 🟡 |
| H5 | auto 分类器 | LLM 子代理只裁决剩余 ask（allow/deny，无中间态）；fail-closed、连续失败自动降级 default、过宽规则（`Bash(*)`）临时失效、`auto-mode critique` 自检 | 无 | ❌ |
| H6 | dontAsk | 未预批准直接拒绝不弹框，连 AskUserQuestion/ExitPlanMode 也拒（CI 白名单场景） | `approval: never` 语义相同（确定性拒绝，不静默放行） | ✅ |
| H7 | delegate 模式 | 主代理只留协调类工具，实现类工具屏蔽 | 无 | ❌ |
| H8 | 子代理权限继承 | 7 级解析链 + 父会话为 auto/dontAsk 时把子代理钳制到同级（ceiling） | 子代理会话装同一道权限门，各自过门判定 | ✅ |
| H9 | 受保护文件 | `.git`、shell rc、包管理 rc、`.codebuddy`、`.mcp.json` 在任何模式下都特殊处理 | 凭据路径（.ssh/.gnupg/.aws/.kube/.docker/.npmrc/.git-credentials/~/.pi/agent）禁读也禁写 + 配置目录 + appDir | ✅ 覆盖面可再补 |
| H10 | OS 沙箱 | Linux/macOS 用 Anthropic sandbox-runtime（bubblewrap/Seatbelt）；Windows 自研 tsbx（内核态 dll + 287MB 用户态 + 语言 shim） | 无，`SandboxEnforcement` 恒为 `partial` 并如实上报 | ⛔ 见 ARCHITECTURE §4.4b（成本，非能力） |
| H11 | 语言层拦截 | shim 三件套：Node safe-delete / brokered-fs（patch fs 删除与写 API）、PATH 替身（`safe-bin/rm` + 30 个 brokered-bin 经 toybox dispatch，命中黑名单 exit 126）、Python sitecustomize | 无 | ❌ |
| H12 | 网络隔离 | 沙箱外代理按域放行（新域触发询问）+ 恶意域名库 | 无（web-fetch 有 SSRF 拦截，属工具内校验） | ❌ |
| H13 | 删除进回收站 | `tsbx_rules.json` 的 `recyclebin_backup: true`；safe-delete shim 覆盖 rm/rmdir/unlink | 会话删除进 `~/.kamibuddy/trash/`；文件删除无工具，故无此问题 | 🟡 |
| H14 | 危险命令检查 | 交互式命令安全检查（9 阶链第 4 层）+ PowerShell 内置检查器 | `command-guard.ts` 已落地，这也是开 powershell 的前置条件 | ✅ |
| H15 | 凭据静态加密 | at-rest 加密（WBEF1/WBEV1/WBER1/WBES1，AAD 域 `WB-AAD\0`），对称密钥由 `safeStorage` 包裹；字段级 codec + 失败上报 + 后台迁移 | 明文 0600 `auth.json`（按 pi 的文件格式写） | ❌ |
| H16 | 配置目录写保护 | `fs-protection.js`：猴补丁 mkdirSync/statSync/appendFileSync/renameSync/rmSync，按进程角色分审计日志 | 权限门阶段 1 在应用层禁写配置目录，无 OS/shim 层 | 🟡 |
| H17 | 网关 secret | 进程内一次性随机 32B secret 经 env 注入 CLI，REST 带 Bearer；修 CNVD 未授权 RCE（历史 `AUTH=none`） | 无 HTTP 面，故此面不存在 | ⛔ 不适用 |
| H18 | 诊断脱敏 | self-check 生成报告时 IP 保留前两段、用户名替换、代理 URL 收敛 | 无（诊断页只在本机展示） | ❌ |
| H19 | 安全中心 | `security-center/audit-acp-adapter.ts` 对工具调用做审计与规则拦截，规则广播到所有会话 | 无（有 `event-log.ts` 本地事件日志） | 🟡 |
| H20 | 内容层防线 | 配置文件写保护（防 hook 逃逸）+ 子代理输出去毒（防伪造 system 标记回灌）+ Web 抓取隔离上下文 | 子代理去毒 `subagent-sanitize.ts` 已做；其余两条无 | 🟡 |
| H21 | 密钥泄漏扫描 | `betterleaks.exe` 随沙箱分发 | 无 | ❌ |
| H22 | 仓库敏感度检测 | `RepositorySensitivityDetection`：识别仓库敏感度，用于调整下发与策略 | 无 | ❌ |

## I. MCP

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| I1 | 传输 | stdio / SSE / HTTP 三种 | `mcp-client.ts`：stdio / sse / http | ✅ |
| I2 | 作用域 | user / project / local 三作用域，优先级 local>project>user；JSONC 允许注释 | user + project 两级（`~/.kamibuddy/mcp.json` + 项目级），同名覆盖；有 JSON 编辑器 | ✅ 缺 local 级 |
| I3 | 环境变量扩展 | 配置内 `${VAR}` / `${VAR:-default}`（仅大写变量名），缺失保留占位符并告警 | 无 | ❌ |
| I4 | 安全审批 | 项目级 server 首次连接需用户批准；headless 可预批 | 无（配置即生效） | ❌ |
| I5 | MCP Apps | widget 沙箱 iframe 渲染工具结果，反向调用与模型调用授权通道完全隔离；终端场景自动降级为文本 | 无 | ❌ |
| I6 | 连接器代理 | `mcp__connector-proxy__*` 转发到连接器 | 无 | ❌ |
| I7 | 内置 MCP | agently-cli / ardot-mcp-app / miora-mcp | 无（`resources/mcp-example.json` 只是示例） | ❌ |
| I8 | MCP roots / sampling | `DisableMcpRoots` / `DisableMcpSampling` 两个独立开关，对应 MCP 的 roots 与 sampling 能力 | 无 | ❌ |
| I9 | MCP elicitation | 协议内 `Elicitation`（服务端向用户发起询问） | 无 | ❌ |

## J. 记忆

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| J1 | 云端画像 | `<memory>` 包裹的云端用户画像，本地写会被覆盖（只读语义） | 无 | ❌ |
| J2 | 用户级记忆 | `MEMORY.md`，4000 字符上限；UserMemoryCollector 注入 | 无 | ❌ |
| J3 | 工作区日志 | append-only + 30 天蒸馏维护；WorkingMemoryReminder 每轮提醒沉淀 | 无 | ❌ |
| J4 | Auto Memory | `/memory` 面板管理，MEMORY.md 索引 | 无 | ❌ |
| J5 | 子代理记忆 | agent-memory 目录，spawn 时注入并截断 200 行 / 25KB | 无 | ❌ |
| J6 | 跨会话检索 | conversation_search + memorySelector 内部 agent | 无 | ❌ |

## K. 会话与存储

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| K1 | 会话存储 | JSONL + SQLite（daemon 侧，WAL，退出前 checkpoint） | pi 的 `SessionManager` JSONL | ✅ |
| K2 | 恢复续跑 | `--resume` / resumeSession | `core/session-rebuild.ts` + 侧栏恢复 | ✅ |
| K3 | 变更追踪 | checkpoint/fileChanges：写文件工具返回带 diff 统计，且可回滚 | `shared/artifacts.ts` 从工具 args 自行算 diff（+N −M）；无回滚 | 🟡 |
| K4 | 会话分支 | fork 子代理 / branch / rewind（Esc×2） | 无 | ❌ |
| K5 | 会话自动命名 | LLM 生成标题（标题生成器是内部 agent） | 无（用首条消息截断） | ❌ |
| K6 | 历史迁移 | `packages/history-migration` 全家桶 | 无（无历史包袱） | ⛔ |
| K7 | 会话导出 | 无对应（WorkBuddy 走分享与发布） | `session-export.ts` 导出 HTML | ✅ 我方领先 |
| K8 | 检查点操作 | `checkpoint_create` / `checkpoint_restore` / `checkpoint_revert` 三个动作 + `ShowFileDiffOnClick` 点击看 diff | 无回滚能力 | ❌ |
| K9 | 会话无响应超时 | `session_no_response_timeout`：会话长时间无响应时的处理 | 无 | ❌ |

## L. 界面与交互

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| L1 | 首页 | 场景页签 + 能力入口 + 输入卡 + 案例卡 + 吉祥物 | `home-view.tsx` 同构（hero / 页签 / 能力 chip / 案例卡） | ✅ |
| L2 | 对话页 | 流式、思考折叠、工具卡、中断、扫光、复制、代码块、输入历史、字数闸、IME 守卫 | `chat-view.tsx` 全套（已对齐两批） | ✅ |
| L3 | 右侧预览面板 | tab + 概览下拉 + pin + 外部打开；HTML 活预览（webview + 本地静态服务） | `artifact-panel.tsx`：多 tab + 概览 + 多格式渲染（HTML / Office / PDF / 代码），iframe + 127.0.0.1 静态服务 | ✅ |
| L4 | 变更跟踪 UI | 工具行带绝对路径 + `+N −M` 徽章 + 「查看所有变更」 | 已对齐（真实 diff + 状态标签） | ✅ |
| L5 | 产物卡片 | 文件名 + 大小 + 预览/打开图标 | 产物卡已对齐 | ✅ |
| L6 | 任务清单面板 | 待办进度可见 | 无 | ❌ |
| L7 | 侧栏任务区 | 任务/空间分组、未读点、hover 工具条 | `sidebar.tsx` 已对齐（含重命名/删除/导出） | ✅ |
| L8 | 模式切换器 | 头部 switcher + Shift+Tab | 头部切换器 + 加号菜单 + `/plan` | ✅ |
| L9 | 快捷键体系 | 全套 Emacs 风格键 + `keybindings.json` 自定义（16 个上下文）+ Web UI 可视化编辑 | 少量（Esc、Alt+↑↓） | 🟡 |
| L10 | 主题 | `/theme` 多主题 | 无 | ❌ |
| L11 | 语音输入与朗读 | ASR：输入框麦克风按钮 + `Cmd+D` / `Ctrl+D` 快捷键；TTS：AI 消息气泡下方朗读按钮；两者是独立特性开关（`DisableVoiceInput` / `DisableVoiceOutput`，专享版与私有化默认关） | 首页与对话页有麦克风图标占位（点击提示待做），无功能 | ❌ |
| L12 | 设置页 | settings.json + 图形化 | `settings-view.tsx`（Key / 模型 / 自建服务商 / 权限 / 联网搜索） | ✅ |
| L13 | 技能与专家页 | 插件市场 + 专家管理 | `skills-view.tsx`（本地导入）；专家无 | 🟡 |
| L14 | 连接器页 | MCP 配置 + 市场 + 授权 | `connectors-view.tsx`（JSON 编辑 + 表单） | ✅ |
| L15 | 记忆面板 | `/memory` | 无 | ❌ |
| L16 | 用量与成本 | `/cost` `/context` `/stats` `/insights`（AI 生成使用洞察 HTML 报告） | 用量圆环 + 分类估算 + 诊断页（工具时间线）；无成本 | 🟡 |
| L17 | 诊断自检 | `doctor` 子命令 + self-check 报告 | `diagnostics-view.tsx`（用量 / 缓存命中率 / 工具时间线） | 🟡 |
| L18 | 问卷弹层 | 多选分页 | 平铺单选 + 其他 + 跳过 | ✅ |
| L19 | 消息刻度轨 | 无对应 | `turn-rail.tsx` | ✅ 我方领先 |
| L20 | 追问建议 | `ChatFollowup`：回答后给出可点的后续问题 | 无 | ❌ |
| L21 | 首页运营位 | `Inspiration`（灵感入口）/ `HomePlaybooks`（剧本）/ `HomePracticeCases`（练习案例）/ `discover`；`DisableInspirationEntry`、`DisableHomePlaybookShuffle`、`DisableHomeQuickEntries` 可分别关 | 有案例卡；无灵感/剧本/发现入口 | 🟡 |
| L22 | 外观与个性化 | `EnableAppearance`（外观设置）、`EnableProjectPin`（项目置顶）、`NicknameEditEnabled`、`AllowIdentityNameEdit` | 无 | ❌ |
| L23a | 浮动快捷键开关 | `FloatShortcut` 是 IDE 插件遗产：桌面端声明 `true` 但 main/renderer 零消费的死开关（5.5.4 实证）。其旁独立存在**全局唤起热键**（`GlobalToggleShortcutController`，默认 Shift+Alt+W，切窗口显隐，设置页可编辑） | `main/global-shortcut.ts`：Shift+Alt+W 全局唤起/最小化（无托盘故用最小化），注册失败降级 + 诊断页可见；不可编辑 | 🟡 热键已做，编辑能力归 L9 |
| L23b | 用户消息顶对齐 | `EnableUserMessageTopAlignment` 在 5.5.4 已**去开关化**，固化为 cb-chat-ui 默认行为（`useFirstMessageAlign` + 组 min-height 锚定空间）：发送瞬间用户消息吸顶，streaming 吸底跟随，无设置项 | `renderer/send-anchor.ts`：`decideScrollAction` + 待吸顶登记 + `.anchor-space` 组 min-height 两件套复刻；切会话/恢复历史不触发 | ✅ |
| L23c | 运营位开关 | `DisableSlotSystem`：服务端运营平台下发 HTML 模板进 5 个 Shadow DOM 槽位（home/home_growth/avatar_top/menu_signin/menu_growth），桌面默认开 | 无运营平台后端 | ⛔ 无此前提；借鉴点（门控在 provider 层、缺 key=启用）已记录 spec |
| L23d | 排队横幅 | `QueueBanner`：云端模型容量排队（6020-6022 错误码 + queueGetStatus 轮询 + 取消/切 Auto 重发/升级），banner 优先级 queue>error>credit>quota | 无云端容量协议；pi 自动重试已覆盖常见 429/overload | ⛔ 无此前提；五态状态机已留档 spec 备将来复刻 |
| L24 | 反馈与统计 | 消息点赞点踩（`vote_like_dislike`）、`ReportAfterCancel`（取消后上报）、`DisableResponseStatistics`；对话埋点事件族（`chat_message_send` / `chat_tool_action` / `agent_task_created` 等） | 无 | ❌ |

## M. 渠道与远程

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| M1 | 远程控制 | `/gateway` 起本地 HTTP + Cloudflare Quick Tunnel，扫码从手机接管本会话；token 认证 + 登录限流 | 无 | ⛔ |
| M2 | Web UI | CLI 内置 React PWA「CodeBuddy Code Remote Control」，dark 主题，含 xterm 四分屏 / Workers / 日志 / 监控 | 无 | ⛔ |
| M3 | IM 机器人 | 14 个渠道插件（QQ×2、企微×3、公众号、客服、个微、飞书、钉钉、Slack、Discord、Telegram、元宝、自定义），三件套 Config+Gateway+Outbound，统一偏好长连接 | 无 | ⛔ |
| M4 | Webhook | `/gateway/webhook/:platform`（wecom/dingtalk/feishu/generic）+ 平台签名校验 | 无 | ⛔ |
| M5 | 权限中继 | 终端与远程同时弹审批，先到先得 | 无 | ⛔ |
| M6 | 发送者白名单 | 按 from.id（非 chat.id）校验防群注入；`channelsEnabled` 组织闸 | 无 | ⛔ |

## N. 观测与运维

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| N1 | OTel | traces / metrics / logs 三件套上报 OTLP（仅 http/protobuf） | 无 | ❌ |
| N2 | RUM | Aegis electron-sdk + web-sdk（Crash/PV/Performance/Network 自动采集） | 无 | ❌ |
| N3 | 业务埋点 | 灯塔 / 大同（beacon + universal-report） | 无 | ❌ |
| N4 | 链路追踪 | 伽利略 SDK + prompt 全链路事件（received/forwarding/done/failed） | 无 | ❌ |
| N5 | 设备指纹 | Qimei（独立 helper 进程取数，仅作上报维度） | 无 | ⛔ |
| N6 | 崩溃报告 | CrashWriter 同步落盘（异步会丢），单次启动上限 50 条去重，三进程各自安装 | 无 | ❌ |
| N7 | 日志落盘 | LogSampler 指纹采样防日志风暴后落盘 | daemon 日志只在终端 | ❌ |
| N8 | 启动类型遥测 | first_install / upgrade / cold / warm 四态 | 无 | ❌ |
| N9 | 内存诊断 | heap ≥1.5GB 时写 `process.report` | 无 | ❌ |
| N10 | 自检报告 | `diagnostics-<ts>.txt` + 脱敏管线 | 诊断页（仅内存态，不落盘） | 🟡 |

## O. 分发与企业化

| 编号 | 能力 | WorkBuddy 机制（内部实现） | 我们 | 状态 |
|---|---|---|---|---|
| O1 | 打包 | Electron 三平台 + asar + 原生模块外置 | `electron-builder` 未配置，只能跑源码 | ❌ 不要拖到最后 |
| O2 | 登录鉴权 | 外链 OAuth + PKCE(S256) + token 刷新；凭据存系统钥匙串 | BYOK（用户自填 Key，写 pi 的 auth.json） | ✅ 形态不同 |
| O3 | 企业管控 | managed settings 管控插件市场 / channelsEnabled / disableBypassPermissionsMode / 沙箱策略 | 无 | ⛔ |
| O4 | IAM | `apiKeyHelper` 脚本动态取 token（30s 超时、默认缓存 5 分钟，可接 Vault / OAuth Client Credentials） | 无 | ❌ 私有化时有用 |
| O5 | 云端配置 | `/v3/config` + CloudProductManager + 两级缓存 + last-good 门 + 按 git 仓库感知下发 | `config.get` 入口已统一，云端未做 | 🟡 |
| O6 | 私有化 | product.internal / ioa / selfhosted 三份配置 + iOA 内网 + 自签名 CA 开关 | 无 | ❌ |
| O7 | 许可合规 | LICENSES.chromium.html + 组件许可聚合 | 无 | ❌ 打包时必做 |

---

## 优先级建议

排的是「交付价值 ÷ 成本」，不是重要性排序。

**第一梯队 · 不做完不算做出 WorkBuddy**

1. **D1 本地 docx 生成** —— 全清单里唯一被我们自己写作「产品价值主菜」的项，也是自评的成功标准。
   建议先做通一个体裁（周报）再铺开，同时把 `src/documents/` 的纯函数分层与测试护栏一起建起来。
2. **O1 打包** —— 一天的事，但 `resources/` 是否被复制、asar 内能否读文件、原生模块 ABI
   三个坑只有打包才暴露。
3. **A6 Prewarm** —— 冷启动 3.7s 是「点开等三秒」的体感差距，做完是毫秒级。

**第二梯队 · 试用时会被直接感知**

4. **C6 内联可视化**（只做 chart + diagram 两个模块）—— 办公味最快的抓手，且直接增强 D1 的产出。
5. **J1–J4 记忆**（只做用户级 + 工作区两层）—— 「以后周报都用这个格式」是试用时最容易建立好感的点。
6. **C9 任务清单** —— 长任务的进度可见性，也是 plan 模式真正落地的最后一块。
7. **B10 死循环检测** —— 成本极低，收益明显。
8. **L11 语音输入与朗读** —— 试用时最容易被拿来对比的一项，且是纯前端 + ASR 接口。
9. **C27 删除文件 + K8 回滚 + H13 回收站** —— 三件必须一起做：单独的删除工具在没有
   回收站兜底时是净风险。

**第三梯队 · 底座补齐**

10. **F5 每轮 hidden context** —— 自评最大差距。但卡在 pi 的能力上：先查证 pi 有没有
   用户消息级的 transform 扩展点，再决定怎么做。
11. **H3 权限规则语法 + H5 auto 分类器** —— 从「三档预设」升级到「可表达的策略」。
12. **B7 场景模型变体（lite/reasoning）** —— 成本与延迟的基本功。
13. **G5 大输出外置** —— 长任务上下文不爆的前提。
14. **C29 附件安全红线** —— 一条提示词约束，成本近乎为零，先把文案补进 `read_document`。

**第四梯队 · 生态与体验**

15. **E2/E5 技能包与专家体系**、**I5 MCP Apps**、**C14 跨会话检索**、**L16 成本统计**。

**建议搁置（要么不做，要么等 OS 沙箱一起做）**

A4 ACP/HTTP、A5 sidecar、C20 LSP、C21 Notebook、C25 ComputerUse、D4–D6 腾讯生态、
H10 OS 沙箱、H11 语言 shim、H12 网络隔离、M1–M6 渠道与远程、N5 设备指纹、O3/O4 企业管控。

理由集中在三条：① 依赖腾讯内部能力，我们无法复刻；② 需要一次性管理员安装或创建系统账号，
对「给同事试用」是显著摩擦；③ 与单机桌面办公场景无关。

---

## 附：WorkBuddy 证据索引

| 主题 | 证据路径 |
|---|---|
| 进程架构 / RPC / prewarm | `_analysis/extracted/main/{index,server,sidecar-entry,cli-prewarm-pool}.js` |
| Agent 内核 / 工具清单 | `_analysis/extracted/cli/dist/codebuddy.js` |
| 官方能力文档（64 篇） | `_analysis/extracted/cli/dist/web-ui/docs/cn/cli/*.md` |
| 产品配置（118 模板 + 模型 + 阈值） | `_analysis/extracted/cli/product.json` |
| 提示词模板 | `_analysis/extracted/resources/templates/*.tpl` 与 `plugins/workbuddy-builtin/{welcomemode,interactionmode,prompt-common}/` |
| 内置插件 | `_analysis/extracted/resources/plugins/workbuddy-builtin/builtin-plugins/` |
| 内置技能（19 个） | `_analysis/extracted/resources/plugins/workbuddy-builtin/skills/` |
| 插件注册表 | `_analysis/extracted/resources/plugins/workbuddy-builtin/.codebuddy-plugin/marketplace.json` |
| 沙箱与 shim | `开源项目/WorkBuddy/resources/app.asar.unpacked/cli/vendor/{sandbox,shim}/` |
| 逐层调研笔记 | `docs/workbuddy分析/01`–`10` 与 `WorkBuddy-全面解剖分析报告.md` |
