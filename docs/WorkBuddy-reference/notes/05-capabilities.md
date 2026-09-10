# 05 · CodeBuddy CLI 能力目录（竞品逆向分析）

> 素材：`dist/web-ui/docs/cn/cli/` 下约 60 篇官方中文文档（不含 release-notes）。
> 分析日期：2026-09-04。分析对象：腾讯云 CodeBuddy Code（`@tencent-ai/codebuddy-code`，命令 `codebuddy` / `cbc`），即 WorkBuddy 打包的 CLI 引擎。

---

## 一、产品定位与形态

**一句话定位**：腾讯云的 "Claude Code 平替/增强版"——终端原生的 AI 编程 Agent，以同一个 CLI 二进制为核心，向外派生出 7 种使用形态。文档中大量机制（权限模式、hooks、subagents、skills、checkpointing、OTel 字段）明确对齐 Claude Code，并声明兼容其配置（`CLAUDE_CODE_ENABLE_TELEMETRY`、`${CLAUDE_PLUGIN_ROOT}` 等别名、迁移指南见 troubleshooting.md）。

**一个内核，七种形态**：

| 形态 | 入口 | 说明 | 来源 |
|---|---|---|---|
| 终端交互 REPL（TUI） | `codebuddy` | 默认形态。完整快捷键体系、Vim 模式、后台任务面板、团队状态栏、权限弹窗 | interactive-mode.md |
| Headless / 单次执行 | `codebuddy -p "..."` | Unix 哲学：管道输入输出、`--output-format text/json/stream-json`、`--json-schema` 结构化输出、多轮 `--resume/--continue`。是 CI/CD、脚本编排的基础 | headless.md |
| Web UI | `codebuddy --serve --port N` | 内置 React 18 Web 应用：对话、xterm.js 终端（4 分屏）、Workers、日志、监控、插件、文档、Swagger API 浏览器；支持 PWA/移动端；通信走 ACP over HTTP/SSE | web-ui.md |
| IDE 集成 | `codebuddy --acp` / `--ide` | 双轨：(1) ACP 协议作为通用 Agent Server 接入 Zed 等编辑器，支持客户端代理 fs/terminal 工具、推送 slash 命令、Team 状态扩展字段；(2) VS Code/JetBrains 插件伴生进程模式（MCP over SSE/WS，openFile/openDiff/getDiagnostics） | acp.md, ide-integrations.md |
| Daemon 常驻服务 | `codebuddy daemon start` | detached 常驻 HTTP 服务（等价 `--serve` 但脱离终端），幂等启动，可注册为 launchd/systemd/计划任务用户级服务实现登录自启+崩溃自愈+每小时静默自动更新；默认 delegate 权限模式 | daemon.md |
| 后台会话 / Worker | `codebuddy --bg --name x "任务"` | `--print -y` 无头后台跑，日志落盘；`ps/logs/attach/kill` 管理；所有进程通过 `~/.codebuddy/sessions/*.json` PID 注册表被统一发现（interactive/bg/daemon 三类 Worker） | daemon.md |
| SDK（TS/Python） | `@tencent-ai/agent-sdk` / `codebuddy-agent-sdk` | 把 CLI 作为子进程拉起，以编程方式使用全部能力；**默认不加载任何文件系统配置**（settings/CODEBUDDY.md/MCP/agents/skills），靠 `settingSources` 显式开启，保证宿主行为可预测 | sdk.md |

**形态间关系**：CLI 是唯一执行内核；`--serve`/daemon 在其上暴露 REST + ACP/SSE + Web UI；Web UI、IDE（ACP）、远程控制（Gateway）、企微/钉钉机器人（Webhook）、SDK（stdio stream-json）都是这个内核的不同"客户端"。Prewarm 机制（见能力矩阵）则让宿主（如 WorkBuddy）能预热进程池、毫秒级唤醒新会话。

---

## 二、能力矩阵

> 每格 1–3 句概括"是什么 + 怎么用"，标注来源文档。

### 1. 交互模式（TUI）

| 能力 | 概括 | 来源 |
|---|---|---|
| 快捷键体系 | 全套 Emacs 风格编辑键、Ctrl+R 历史搜索、Ctrl+O 思考详情/详细输出、Ctrl+Y 复制回复、Esc×2 触发 /rewind 回退；可用 `~/.codebuddy/keybindings.json` 按 context 自定义（16 个上下文、弦序列、解绑），Web UI 有可视化编辑器+REST API | interactive-mode.md, keybindings.md |
| Vim 模式 | `/vim` 启用，支持 NORMAL/INSERT 切换、hjkl 导航、词级编辑、`.` 重复 | interactive-mode.md |
| 快捷前缀 | `#` 写入记忆、`/` 斜杠命令、`!` Bash 模式（输出进上下文）、`@` 文件路径补全 | interactive-mode.md |
| 排队消息编辑 | Agent 响应期间输入的消息进入队列，按 ↑ 可拉回编辑；系统注入项（频道/队友消息）不打断 | interactive-mode.md |
| 后台 Bash | Ctrl+B 把命令转后台，TaskOutput 取输出；退出自动清理；后台任务事件（task_started/progress/updated/notification）也暴露在 stream-json | interactive-mode.md, headless.md |
| 状态行 | `/statusline` 或 settings 配置脚本，stdin 收 JSON（模型/目录/cost），300ms 刷新，ANSI 着色 | statusline.md |
| 主题/终端适配 | `/theme`、多主题；`/terminal-setup` 自动配 Shift+Enter 换行（覆盖 iTerm2/VS Code/JetBrains/Ghostty 等 20+ 终端） | terminal-config.md |

### 2. 内置工具（tools-reference.md 完整清单）

共 47 个内置工具（含延迟加载）。按域归类：

| 域 | 工具 | 备注 | 来源 |
|---|---|---|---|
| 文件 | `Read`（支持图片/PDF/notebook）、`Write`、`Edit`、`MultiEdit`、`NotebookRead`、`NotebookEdit`、`Glob`、`Grep` | Edit 族需权限；Read 在信任目录免审批 | tools-reference.md |
| Shell | `Bash`、`PowerShell`（仅 Windows，自动适配 5.1/7+，内置危险模式检查器） | 支持 run_in_background、沙箱、输出超阈值自动落盘 | tools-reference.md, env-vars.md |
| 搜索/网络 | `WebFetch`（支持 domain: 权限规则）、`WebSearch` | 默认需审批 | 同上 |
| 子代理/团队 | `Agent`、`TaskCreate/Get/List/Update/Output/Stop`、`TeamCreate`、`TeamDelete`、`SendMessage` | 任务系统+团队系统是 Agent Teams 的地基 | 同上 |
| 计划/模式 | `EnterPlanMode`、`ExitPlanMode`、`EnterWorktree`、`LeaveWorktree` | 计划文件写入是 plan 模式唯一额外放行项 | 同上 |
| 定时任务 | `CronCreate`、`CronList`、`CronDelete` | 会话级，退出失效 | scheduled-tasks.md |
| MCP 配套 | `ListMcpResources`、`ReadMcpResource`、`WaitForMcpServers`（最长 5s） | 资源读取需权限 | tools-reference.md |
| 延迟加载 | `ToolSearch`、`DeferExecuteTool` | 模型先用 ToolSearch 发现工具、再经 DeferExecuteTool 调用；出现任一 Defer(X) 时自动附加这两个工具 | mcp.md, tool-defer-overlay.md |
| 代码智能 | `LSP`（跳转定义/查引用/类型信息/自动诊断，需 LSP 插件+语言服务器二进制） | 官方市场提供 11 种语言 LSP 插件 | tools-reference.md, plugin-marketplaces.md |
| 媒体生成 | `ImageGen`（文生图/图生图）、`VideoGen` | 模型 ID 单独配置 | tools-reference.md, cli-reference.md |
| 发布/分享 | `Artifact`（HTML/MD 发为公网链接，可原地更新）、`ArtifactControl`（取消发布） | 国际 endpoint 恒关闭 | env-vars.md, tools-reference.md |
| 结构化/交互 | `StructuredOutput`（JSON Schema 输出）、`AskUserQuestion`（多选提问）、`PushNotification`、`ReportFindings`（结构化审查发现）、`SlashCommand`、`Skill`、`Workflow` | PushNotification/ReportFindings 走延迟加载 | tools-reference.md |

### 3. 模型支持

| 能力 | 概括 | 来源 |
|---|---|---|
| 内置模型族 | 国内站+国际站双 endpoint，登录方式分 Chinese/International/Enterprise/iOA 四种；文档示例出现 gpt-5、gpt-5.1-codex(-mini)、gemini-3.x、glm-4.7、deepseek-v3.1/v4、claude-sonnet-4 等；`--model` / `/model` 切换 | quickstart.md, models.md |
| 自定义模型（models.json） | 用户级+项目级 `models.json`，**仅支持 OpenAI chat/completions 接口格式**（url 必须完整路径），字段含 maxInputTokens/supportsToolCall/supportsImages 等；apiKey/url 支持 `${ENV_VAR}` 引用；热重载（1s 防抖）；`availableModels` 控制下拉白名单；可接 OpenRouter/Ollama/DeepSeek 官方 API | models.md |
| 场景变体（lite/reasoning） | 会话内按场景自动切换模型：`lite`（快/省，Explore 子代理、goal 评估器、压缩等）与 `reasoning`（深度推理）。解析链：env（`CODEBUDDY_SMALL_FAST_MODEL`/`CODEBUDDY_BIG_SLOW_MODEL`）> 项目 variantModels > 用户 variantModels > 主模型 relatedModels > 内置默认 > 主模型 | models.md, costs.md |
| 按子代理配模型 | `/agents` 面板可为每个内置/自定义子代理单独指定模型或 lite/reasoning 变体，存 `subagents.agents.<名>.model`；`CODEBUDDY_CODE_SUBAGENT_MODEL` 可一刀切覆盖 | sub-agents.md |
| 推理强度 | `effort` 字段（minimal…max，子代理/命令/CLI 均可设）；`reasoningEffort`（low/medium/high/xhigh）；`MAX_THINKING_TOKENS` 扩展思考预算 | cli-reference.md, settings.md |
| 图像模型 | `--text-to-image-model` / `--image-to-image-model` 独立配置文生图/图生图模型 | cli-reference.md, slash-commands.md |

### 4. MCP

| 能力 | 概括 | 来源 |
|---|---|---|
| 三种传输 | stdio / SSE / HTTP；配置文件 JSONC（注释+尾逗号），user/project/local 三作用域（local 存于 `~/.codebuddy.json#/projects/<path>`），优先级 local>project>user | mcp.md |
| 环境变量扩展 | 配置内 `${VAR}` / `${VAR:-default}`（仅大写变量名），缺失保留占位符并告警；敏感信息不入库 | mcp.md |
| 安全审批 | 项目级 MCP server 首次连接需用户批准；headless 用 `--settings '{"enabledMcpjsonServers":[...]}'` 预批 | mcp.md |
| 工具权限 | `mcp__server` / `mcp__server__tool` 两级规则（不支持通配），deny>ask>allow；MCP 工具默认"无规则即弹窗"，AcceptEdits 不覆盖 MCP | mcp.md, mcp-apps.md |
| 延迟加载 | server 级/工具级 `defer_loading`，模型经 ToolSearch 发现后激活；`--tools "Defer(mcp__github__*)"` 会话级覆盖，NoDefer>Defer | mcp.md, tool-defer-overlay.md |
| MCP Prompts→命令 | MCP server 提供的 prompts 自动注册为 `/server:prompt` 斜杠命令，支持交互式参数收集 | mcp.md |
| 超大响应落盘 | >20k tokens（`MAX_MCP_OUTPUT_TOKENS`）自动写入 `tool-results/*.txt`，模型收路径指针按需分段读 | mcp.md, env-vars.md |
| MCP Apps（UI widget） | 实现 `io.modelcontextprotocol/ui` 扩展：工具声明 `_meta.ui.resourceUri` → Web UI 在异源沙箱 iframe 渲染 HTML widget（CSP 注入、JSON-RPC over postMessage）；widget 可反向调工具（**强制弹框授权**，仅 -y/Bypass 或 session 级"始终允许"短路）、读资源（免授权）、回写消息（send/fill 两模式）、注入 model context、切 inline/fullscreen/pip；主题双层适配；TUI/print 自动文本降级 | mcp-apps.md |
| Channels（特殊 MCP） | 声明 `claude/channel` capability 的 MCP server 可把外部事件以 `<channel source=…>` 标签推进会话；双向 channel 暴露 reply 工具；可选 `claude/channel/permission` 把权限审批中继到远程（先到先得）；`--channels` 启用、`channelsEnabled` 组织管控 | channels.md, channels-reference.md |

### 5. Hooks

| 能力 | 概括 | 来源 |
|---|---|---|
| 事件家族 | 27+ 事件：`PreToolUse`/`PostToolUse`/`PostToolUseFailure`（matcher 正则按工具名过滤）、`SessionStart`(startup/resume/clear/compact)/`SessionEnd`、`Stop`/`SubagentStop`/`StopFailure`、`UserPromptSubmit`、`Notification`、`PermissionRequest`/`PermissionDenied`、`Elicitation(Result)`、`PreCompact`/`PostCompact`、`InstructionsLoaded`、`ConfigChange`、`TaskCreated`/`TaskCompleted`、`TeammateIdle`、`FileChanged`、`CwdChanged`、`WorktreeCreate/Remove`、`Setup` | hooks.md, plugins-reference.md |
| 四种执行类型 | `command`（shell，Windows 强制 Git Bash）、`prompt`（小模型/lite 槽语义判定，仅 Stop/UserPromptSubmit/PreToolUse）、`agent`（起 subagent 判定）、`http`（POST 事件 payload 到 URL） | hooks.md, skills.md |
| 输出契约 | 退出码 0/2/其他 三态 + stdout JSON：`continue/stopReason/systemMessage`、PreToolUse 的 `permissionDecision: allow/deny/ask` 与 `modifiedInput`（可改工具入参）、PostToolUse 的 `additionalContext`（追加）与 `updatedToolOutput`（**替换**工具结果，可压缩超长输出省 token）、UserPromptSubmit 注入上下文 | hooks.md |
| prompt hook 三态 | `{ok, reason, impossible}`；Stop hook `continueOnBlock:true` 时 reason 以 isMeta user message 注入 history 驱动模型继续循环——`/goal` 就是它的官方封装 | hooks.md, goal.md |
| 配置与安全 | settings 四级作用域合并（不覆盖、并行执行、去重、60s 超时）；外部改动需 `/hooks` 面板审核后生效；插件 `hooks/hooks.json` 自动合并且不受 frontmatter 闸门约束 | hooks.md, plugins.md |
| Frontmatter hooks | Agent/SKILL.md 里声明 hooks，scope 绑定 subagent 生命周期（Stop 自动重写为 SubagentStop）；非内置来源默认不注册，需 `allowUntrustedFrontmatterHooks: true`（防恶意 md 静默起 shell） | hooks.md, skills.md |
| SDK hooks | TS/Python 均支持回调式 hook（PreToolUse/PostToolUse/PostToolUseFailure/UserPromptSubmit/SessionStart/End/WorktreeCreate/Remove + 实验性 unstable_Checkpoint） | sdk.md, sdk-hooks.md |

### 6. Skills

| 能力 | 概括 | 来源 |
|---|---|---|
| 定义与加载 | `SKILL.md`（YAML frontmatter + 指令），项目级 `.codebuddy/skills/` 优先于用户级 `~/.codebuddy/skills/`；AI 按 description 自动识别调用，也可 `/skill-name` 手动触发 | skills.md |
| frontmatter | `name/description/allowed-tools/disable-model-invocation/user-invocable/context: fork/agent/model/hooks`；`context: fork` 让 skill 在隔离 subagent 中执行（可指定 Explore/Plan/自定义 agent） | skills.md |
| 占位符与内联 shell | `${CODEBUDDY_SKILL_DIR}`、`${ENV:-default}`、session id（兼容 CLAUDE_* 别名）；`!\`cmd\`` 内联执行 shell 注入结果；`$ARGUMENTS`、`@file` 引用 | skills.md |
| 可见性四态 | `skillOverrides`（on/name-only/user-invocable-only/off）从 settings 控制单个 skill 对模型/菜单的可见性，`/skills` 面板可视化编辑，优先级 project-local>project>user | skills.md |
| 与命令的区别 | Skills = AI 自动调用的专业能力（带工具白名单）；Slash Commands = 用户手动触发的工作流模板 | skills.md |

### 7. Plugins / 市场

| 能力 | 概括 | 来源 |
|---|---|---|
| 插件结构 | `.codebuddy-plugin/plugin.json` 清单 + 根级 `commands/agents/skills/hooks/.mcp.json/.lsp.json/bin/settings.json`；一个插件可同时交付命令、子代理、技能、hooks、MCP server、LSP server、PATH 可执行文件、默认 agent | plugins.md |
| 命名空间 | 插件命令/技能以 `/plugin:name` 形式命名空间化防冲突；`--plugin-dir` 本地调试（同名覆盖市场版）、`/reload-plugins` 热重载 | plugins.md |
| 市场 | `/plugin marketplace add` 支持 GitHub 简写/Git URL/本地路径/HTTP URL 四类源；官方市场内置（含 11 种 LSP、github/gitlab/atlassian/figma/slack/sentry 等外部集成、commit-commands/pr-review-toolkit、输出样式）；安装分 user/project/local/managed 四作用域；自动更新（内置默认开，第三方默认关） | plugin-marketplaces.md |
| 团队分发 | 项目 settings 的 `extraKnownMarketplaces` + `enabledPlugins` 随 git 共享，团队成员信任仓库后提示安装 | plugin-marketplaces.md, codebuddy-dir.md |
| 企业管控 | managed settings 可强制启用插件、限制可添加的市场源；插件 hooks 类型可用 env 收敛为仅 command | plugin-marketplaces.md, env-vars.md |
| LSP 插件 | `.lsp.json` 声明语言服务器，带来自动诊断（编辑后即时报错）+ 代码导航 | plugins.md, plugin-marketplaces.md |

### 8. Sub-agents（子代理）

| 能力 | 概括 | 来源 |
|---|---|---|
| 定义方式 | Markdown+frontmatter 存 `.codebuddy/agents/`（项目，最高优先）与 `~/.codebuddy/agents/`（用户）；`/agents` 面板引导式创建（可 AI 生成）；`--agents '{json}'` CLI 动态定义；插件也可提供 | sub-agents.md |
| 配置面 | `description`（委派路由关键）、`prompt`、`tools/disallowedTools`、`model`（含 lite/reasoning/inherit）、`permissionMode`、`skills`、`mcpServers`（子代理私有 inline MCP，项目级需 `enabledMcpjsonServers` 批准）、`effort`、`maxTurns`、`background`、`initialPrompt`、`memory`（user/project/local 持久记忆目录） | sub-agents.md, cli-reference.md |
| 内置三员 | `general-purpose`（可读写全工具）、`Explore`（严格只读，lite 模型，quick/medium/very-thorough 三档彻底度）、`Plan`（计划模式专用研究员） | sub-agents.md |
| 运行约束 | 嵌套深度上限 5 层；每会话 spawn 预算默认 200（env 可调）；子代理输出回传前做"去毒"（改写仿冒 system-reminder/Human:/Assistant: 标记，防提示注入回灌主对话） | sub-agents.md |
| 后台与恢复 | `run_in_background: true` 后台跑、TaskOutput 取结果（权限自动处理不阻塞）；每个子代理分配 agentId，对话存 `subagents/agent-*.jsonl`，可 `resume` 续跑 | sub-agents.md |

### 9. Agent Teams（多智能体协作）

| 能力 | 概括 | 来源 |
|---|---|---|
| 架构 | 一个 team-lead 主会话 + 多个进程内 teammate（各自独立上下文窗口）+ 共享任务列表（含依赖解除阻塞）+ Mailbox 消息系统（message/broadcast/shutdown/plan_approval）；数据落 `~/.codebuddy/teams/` | agent-teams.md |
| 交互 | `@成员名` 直聊（模糊补全）、`@all` 广播、↓ 进入成员焦点导航（看成员历史/token）、Ctrl+T 任务列表、状态栏实时渲染成员状态与 token/工具数 | agent-teams.md |
| 委派模式 | Shift+Tab 切 delegate：领导只留协调工具（Agent/TaskStop/SendMessage/AskUserQuestion/StructuredOutput），不动手改代码；子代理不受此限（默认 default 权限） | agent-teams.md, permission-modes.md |
| 治理 | 可要求成员先交计划经领导审批；成员完成可被消息自动唤醒重启；每会话一个团队、不支持嵌套、lead 不可转让；无会话恢复（实验阶段） | agent-teams.md |
| ACP 扩展 | 通过 `session_info_update` 的 `_meta['codebuddy.ai/teamUpdate']` 推成员状态、`_meta['codebuddy.ai/memberEvent']` 标记成员流式消息，客户端可渲染多泳道 | acp.md |

### 10. Memory（记忆）

| 能力 | 概括 | 来源 |
|---|---|---|
| 分层记忆 | 用户 `~/.codebuddy/CODEBUDDY.md` + 用户 rules → 项目 `CODEBUDDY.md`（cwd 向上递归）+ 项目 `.codebuddy/rules/*.md`（仅 cwd）→ `CODEBUDDY.local.md`（自动 gitignore）→ 子目录记忆（操作文件时动态加载）；兼容 AGENTS.md（CODEBUDDY.md 优先） | memory.md, codebuddy-dir.md |
| 导入 | `@path` 语法导入其他文件，递归上限 5 层；`/memory` 查看已加载 | memory.md |
| 规则系统 | rules/*.md 递归加载，frontmatter `enabled/alwaysApply/paths`（glob+matchBase）：ALWAYS 常驻 vs MANUAL 条件触发（文件操作时注入）；支持符号链接跨项目共享 | memory.md |
| Auto Memory | AI 自主决定保存内容，存 `~/.codebuddy/memories/{project-id|global}/`，MEMORY.md 索引前 200 行自动入上下文；Typed Memory（默认开）分 user/feedback/project/reference 四类带 frontmatter；可 `/config`、settings、env 关闭 | memory.md |
| 子代理记忆 | agent frontmatter `memory: user/project/local`，spawn 时注入该 agent 的 MEMORY.md（截断 200 行/25KB） | sub-agents.md |

### 11. Checkpointing / Goal / 会话管理

| 能力 | 概括 | 来源 |
|---|---|---|
| 检查点 | 每个用户提示自动快照被编辑文件，`/rewind`（或 Esc×2）三选一回退：仅对话/仅代码/两者；跨会话持久 30 天；不跟踪 Bash 改动，定位是"本地撤销"非 git 替代 | checkpointing.md |
| Goal | `/goal <condition>` 会话级 prompt Stop hook 封装：每轮结束由 lite 小模型评估 condition（三态 达成/继续/不可达），未达成则把 reason 注入 history 自动进入下一轮，直到满足才交还控制权；condition≤4000 字符；支持 headless、resume 恢复；与 /loop（时间触发）、Stop hook（自定义）互补 | goal.md |
| 会话管理 | `--continue/--resume`、`/resume` 面板、`/clear`、`/branch`(/fork) 对话分叉、`/rename`、`/compact`（可带自定义指令）、自动异步压缩（近上下文上限时后台摘要，"无限上下文"体感）；`/export` 导出 | slash-commands.md, costs.md, common-workflows.md |
| Worktree | `--worktree` 在独立 git worktree 中跑（可配 tmux）；子代理 `isolation: worktree` 文件级隔离；Hook-based worktree 可接入 SVN/P4 等非 git VCS | worktree.md |

### 12. 权限体系

| 能力 | 概括 | 来源 |
|---|---|---|
| 九阶求值链 | hooks → deny → 可信 allow → 命令安全检查（交互态危险命令强制 ask）→ ask → bypass 短路 → 不可信 allow → 模式基线 → 非交互兜底/dontAsk/auto 收口；deny 恒优先，项目级 allow 在目录未信任前降级为"不可信"（防恶意仓库自带 settings 提权） | permissions.md |
| 七种模式 | `default`/`acceptEdits`/`auto`（分类器判定剩余 ask，fail-closed，过宽 allow 规则会被临时忽略）/`dontAsk`（不弹框直接拒，配 allow 做固定白名单代理）/`plan`（继承进入前模式+放行计划文件）/`bypassPermissions`/`delegate`；另有 IDE 专用的 work/fullAccess、子代理专用 ignore | permission-modes.md |
| auto 分类器 | 顶层 `autoMode` settings 配 environment/allow/soft_deny/hard_deny；`codebuddy auto-mode defaults/config/critique` 三命令查看与 AI 校验自定义规则 | permission-modes.md, cli-reference.md |
| 规则语法 | `Tool` 或 `Tool(spec)`：Bash 前缀 `:*`（解析 &&/||/;/| 逐子命令判定，allow 需全命中）、Read/Edit 四层路径归一（//绝对、~/家、/项目、./cwd）、`WebFetch(domain:)`、`mcp__server__tool`、`Agent(名)`、`Skill(名)`（精确） | permissions.md, iam.md |
| 子代理继承 | Agent 入参 mode > frontmatter > CLI `--subagent-permission-mode` > env > settings > 继承主会话；主会话 auto/dontAsk 时钳制子代理同模式（权限上限） | permission-modes.md |
| 受保护文件 | `.git`、shell rc、包管理 rc、`.codebuddy`、`.mcp.json` 等在任何模式都特殊处理；`disableBypassPermissionsMode` 可管理员级封死 bypass | permission-modes.md |

### 13. Slash Commands

内置约 45 个（slash-commands.md 全表），重点：`/init`（建 CODEBUDDY.md+知识图谱，官方称省 30-50% 上下文 token）、`/agents` `/model` `/mcp` `/memory` `/permissions` `/hooks` `/skills` `/plugin` `/config`、`/cost` `/context` `/stats` `/insights`（AI 生成使用洞察 HTML 报告）、`/compact` `/clear` `/resume` `/rewind` `/branch`、`/goal` `/loop`、`/gateway` `/remote-control` `/ide` `/sandbox`、`/btw`（不打断 Agent 的快速提问）、`/security-review` `/code-review`（--fix/--comment）`/simplify`（4 个并行 Agent 四角度清理）`/verify`、`/debug`、`/copy`、`/terminal-setup`、`/statusline` `/theme`。
自定义命令：`.codebuddy/commands/*.md`（子目录映射为 `/group:cmd`），frontmatter `description/argument-hint/allowed-tools/model`，支持 `$1/$ARGUMENTS`、`!\`shell\``、`@file`。（slash-commands.md）

### 14. Scheduled Tasks（定时任务）

`/loop [间隔] <指令>`（自然语言转 cron，默认 10m；每轮执行后 AI 自主决定下轮提前/延后/结束）、自然语言一次性提醒；底层 `CronCreate/List/Delete` 工具，headless/SDK 可用；会话级不落盘、循环 3 天过期、每会话上限 50、空闲才触发、jitter 防拥堵；HTTP API 可建 durable 持久任务；`CODEBUDDY_DISABLE_CRON=1` 关闭。（scheduled-tasks.md, http-api.md）

### 15. Remote Control / Channels / 机器人接入

| 能力 | 概括 | 来源 |
|---|---|---|
| Gateway | `/gateway` 在会话内起本地 HTTP+Cloudflare Quick Tunnel（或局域网回退），扫码/链接从手机浏览器远控本会话；token 认证（2 次/分+12 次/时登录限流）、远程任务自动 bypassPermissions、每会话一个 Gateway；固定 `--port` 可复用 tunnel 域名 | remote-control.md |
| Web UI 远程版 | 对话+终端+实例管理（`~/.codebuddy/instances.json` 注册表，多实例切换，支持手动加远程实例） | remote-control.md, web-ui.md |
| 企业 IM Webhook | Gateway 暴露 `/gateway/webhook/:platform`：企业微信(wecom)、钉钉(dingtalk)、飞书(feishu)、generic；HTTP API 另有 wecom/wechat-kf 平台 | remote-control.md, http-api.md |
| 企微 AI Bot | 内置 `wecom-bot` 客户端：**WebSocket 长连接主动外连**（无需公网 IP），env 配 BOT_ID/SECRET，`/remote-control` 面板连接；收消息 5s 内回"处理中"流式占位、完成后原位替换（满足企微回调超时与单条消息体验）；5 分钟安全超时回退异步推送；指数退避重连 | wecom-bot-setup.md |
| 微信 ClawBot | 内置 channel：微信插件扫码绑定，文本/图片（自动下载解密/加密上传 CDN）/文件双向收发，`WechatReply` 工具回复，凭证 600 权限本地保存 | channels.md |
| Telegram/Discord/fakechat | 官方插件市场 channel：BotFather 拿 token → 插件配置 → `--channels plugin:...` 启动 → 配对码白名单；fakechat 为 localhost 演示 | channels.md |
| 安全模型 | 发送者白名单（按 from.id 非 chat.id 校验防群注入）、`channelsEnabled` 组织默认禁用需管理员开启、自定义 channel 需 `--dangerously-load-development-channels` 或进官方市场允许列表 | channels.md, channels-reference.md |

### 16. Prewarm（预热）

`cbc --prewarm --prewarm-id x` 先跑完冷启动（bundle→容器→认证→产品配置→MCP 发现）后挂起在 unix socket/named pipe（0600 权限）待命；`cbc-prewarm activate <id> --cwd <dir> -- --serve` 唤醒即服务，**启动等待 3.7s → ~1ms**；一进程一会话一次性绑定，唤醒时 chdir+配置缓存失效重扫；NDJSON IPC 协议（ping/status/activate，`ackMode:"ready"` 等 ACP 初始化完成再应答并返回 endpoint），明确为 WorkBuddy 这类宿主预拉起会话池设计。（prewarm.md）

### 17. HTTP API（--serve / daemon）

| 域 | 端点 | 来源 |
|---|---|---|
| Agent 执行 | `POST /api/v1/runs`（Gateway Protocol 入站消息格式：id/type/payload.text/source/callback/timeoutMs）+ `GET …/stream`(SSE) + cancel | http-api.md |
| 系统 | health/info/metrics（系统+进程级内存/运行时长）/envs（对齐 E2B envd） | 同上 |
| 会话 | sessions 列表（cwd 过滤）/rename/delete | 同上 |
| PTY | 创建/列表/SSE 输出/输入/resize/ws（对齐 E2B Process） | 同上 |
| 文件/进程 | E2B 兼容：files download/upload/compose、fs stat/list/mkdir/remove/move/watch、process start/connect/signal（gRPC→REST 映射）；增强 fs/search（ripgrep 模糊搜） | 同上 |
| ACP | `/api/v1/acp` connect + SSE 通知 + JSON-RPC（newSession/prompt/cancelRun） | 同上 |
| Workers/Daemon | workers CRUD+日志（telemetry/process/debug/transcript 四型）、daemon start/stop/restart/status | 同上, daemon.md |
| Webhooks | `/api/v1/webhooks/:platform`（generic/wecom/wechat-kf，平台签名校验） | 同上 |
| 其余 | channels 客户端管理、插件与市场管理、settings、workspace-dirs、tasks/templates、stats、traces（OTel 查询）、scheduled-tasks、内部 file-changes（checkpoint diff/revert） | 同上 |
| 安全 | `X-CodeBuddy-Request: 1` 自定义头强制 CORS preflight 防 CSRF、Origin 白名单（0.0.0.0 绑定时默认全开）、password/none 两档认证、Swagger UI + OpenAPI 3.1 导出 | http-api.md, security.md |

### 18. ACP 协议

`codebuddy --acp` 作为 Agent Server 接入 Zed 等：authenticate 响应 `_meta` 带用户信息；客户端可代理 fs.readTextFile/writeTextFile 与 terminal 工具（性能+安全）；新会话自动推送 slash 命令清单（过滤本地命令）；扩展 `_meta` 推 Agent Teams 状态与成员流式消息；loadSession 后自动重放团队状态。HTTP 模式下 ACP 跑在 `/api/v1/acp`（JSON-RPC over SSE 而非 WebSocket）。（acp.md, web-ui.md, http-api.md）

### 19. SDK 能力面

| 能力 | TS (`@tencent-ai/agent-sdk`) | Python (`codebuddy-agent-sdk`) | 来源 |
|---|---|---|---|
| 单发 | `query()` async iterator，`q.interrupt()` | `query()` async iterator | sdk-typescript.md, sdk-python.md |
| 多轮 | `unstable_v2_createSession/resumeSession/prompt`（send/stream/close） | `CodeBuddySDKClient`（query/receive_response/interrupt/set_permission_mode/set_model） | sdk.md, sdk-sessions.md |
| 认证 | 复用 CLI 登录态 / CODEBUDDY_API_KEY / AUTH_TOKEN / 两阶段 `unstable_v2_authenticate`（取 URL→等完成） | 同左 + `authenticate()/AuthFlow/logout()` | sdk.md |
| 权限 | `canUseTool` 回调（allow/deny+updatedInput+interrupt）、permissionMode、tools/allowedTools/disallowedTools 白黑名单、AskUserQuestion 程序化应答 | 同左 | sdk-permissions.md |
| Hooks | 回调式 hook 全事件 + unstable_Checkpoint | 同左 | sdk-hooks.md |
| 自定义工具 | 进程内 MCP server：TS `tool()`+zod schema 注册，Python 装饰器；与远程 MCP 混用 | 同左 | sdk-custom-tools.md, sdk-mcp.md |
| 其余 | 自定义 agents、mcpServers、settingSources 环境隔离、结构化消息类型（system/assistant/result/task_*）、usage/cost 统计 | 同左 | sdk.md, sdk-typescript.md, sdk-python.md |
| 示例 | quick-start、multi-turn、research-assistant、chat-demo（流式 Web）、mail-assistant（MCP）、spreadsheet-assistant（Electron） | — | sdk-demos.md |

### 20. IAM / 企业管控

登录四通道（国内站/国际站/Enterprise Domain/iOA）；认证优先级 `CODEBUDDY_AUTH_TOKEN > apiKeyHelper > CODEBUDDY_API_KEY`，apiKeyHelper 脚本动态取 token（30s 超时、默认缓存 5 分钟，可接 Vault/OAuth Client Credentials）；`CODEBUDDY_INTERNET_ENVIRONMENT`（空/internal/ioa）决定 endpoint；凭据存系统钥匙串（Keychain/GNOME Keyring/凭据管理器）；企业 OAuth 需旗舰版；组织级可通过 managed settings 管控插件市场、channelsEnabled、disableBypassPermissionsMode、沙箱策略；settings 优先级 CLI > project-local > project > user > 内置。（iam.md, quickstart.md, settings.md）

### 21. 监控与成本

| 能力 | 概括 | 来源 |
|---|---|---|
| OpenTelemetry | `CODEBUDDY_CODE_ENABLE_TELEMETRY=1` + OTLP endpoint 上报 traces（仅 http/protobuf）到自建 Collector；span 树 `codebuddy_code.interaction → tool/子agent`；隐私三级 opt-in（USER_PROMPTS/TOOL_DETAILS/TOOL_CONTENT，默认只记长度） | monitoring.md |
| GenAI 语义约定 | `OTEL_SEMCONV=agentlens` 追加 `gen_ai.*` 字段（只增不删）对接腾讯智研 LLM 监控；model_request span 去重防 token 重复统计 | monitoring.md |
| 本地可观测 | `/cost`（分模型 input/output/cache read/write）、`/context`（上下文 token 分布瀑布图：system/tools/memory/messages/autocompact buffer）、`/stats`（热力图/模型工具排行）、HTTP `/api/v1/stats|traces|metrics`、logs 四类型 | costs.md, http-api.md, daemon.md |
| 成本优化机制 | Prompt 缓存、自动异步压缩、多场景模型（lite/reasoning 路由）、子代理隔离高消耗输出、`/compact` 自定义指令；后台功能（对话摘要、prompt 预测）也会耗 token 并明示 | costs.md |
| 使用洞察 | `/insights` AI 分析使用模式/交互风格/摩擦点，生成浏览器 HTML 报告 | slash-commands.md |

### 22. 安全

| 能力 | 概括 | 来源 |
|---|---|---|
| Bash 沙箱 | `/sandbox` 启用：OS 级隔离（Linux bubblewrap / macOS Seatbelt，Windows 计划中），文件系统（cwd 可写、其余只读）+网络（域白名单代理）双隔离，子进程继承边界；`excludedCommands` 例外、`dangerouslyDisableSandbox` 逃生舱（可 `allowUnsandboxedCommands:false` 关闭）；acceptEdits 下 `autoAllowBashIfSandboxed` 自动批准沙箱内命令；bypass 模式下仅 HIGH/CRITICAL 危险命令保留审批（SAFE/LOW/MEDIUM 自动放行） | bash-sandboxing.md |
| 配置文件写保护 | 沙箱默认禁写 `settings.json/settings.local.json`（用户+项目），防止提示注入写入恶意 SessionStart hook 实现沙箱逃逸；Bash 与 Edit/Write 统一生效 | bash-sandboxing.md |
| 提示注入防线 | 权限系统+输入清理+默认拦 curl/wget+Web 获取用隔离上下文窗口+新仓库/新 MCP 信任验证+命令注入检测（白名单内可疑命令仍要批）+子代理输出去毒+channel 发送者白名单 | security.md, sub-agents.md |
| Gateway 安全 | X-CodeBuddy-Request 头+CORS 白名单防 CSRF、token 认证+登录限流、远程执行自动 bypass（提示只分享给信任者） | security.md, remote-control.md |
| 沙箱运行时开源 | 复用 Anthropic `@anthropic-ai/sandbox-runtime`（可 npx 独立沙箱任意命令/MCP server） | bash-sandboxing.md |
| devcontainer | 官方 devcontainer Feature + 完整 iptables/ipset 防火墙脚本（默认 DROP、白名单 npm/GitHub/copilot.tencent.com），容器内可安全 `-y` 无人值守 | devcontainer.md |
| 平台沙箱(E2B) | `--sandbox [url]` 支持本地 Docker/Podman 容器或 E2B 云沙箱，`--sandbox-upload-dir`、`--sandbox-id` 复用、`--teleport` 连远程沙箱 | cli-reference.md |

### 23. 其他值得记录的机制

- **Dynamic Workflows**：CodeBuddy 现场编写 JavaScript 编排脚本，后台调度数十~数百子代理；脚本即计划（可读/可改/可重跑/可存为命令），中间结果存脚本变量而非上下文；内置 `/deep-research` 多源交叉印证；`/workflows` 进度视图（暂停/中止/重启代理/保存）；确定性沙箱执行。（workflows.md, workflow-stdio-protocol.md）
- **GitLab CI/CD**：`.gitlab-ci.yml` 集成，Issue/MR 中 @codebuddy 触发，可自动把 Issue 转 MR；另有 GitHub Actions。（gitlab-ci-cd.md）
- **工具输出外部化**：大输出（Bash>30k 字符、其他>50KB）自动落盘 `tool-results/`，模型收截断+路径指针；MCP>20k tokens 同理。（env-vars.md, mcp.md）
- **计算机控制**：`CODEBUDDY_COMPUTER_USE_ENABLED=1` 启用 macOS 桌面控制（截图/鼠标/键盘），实验性。（env-vars.md, codebuddy-dir.md）
- **产品配置共存**：`CODEBUDDY_CONFIG_DIR` 自定义配置目录，让 WorkBuddy 等宿主与独立 CLI 配置隔离共存。（installation.md）

---

## 三、亮点提炼：对自研办公 Agent 最有借鉴价值的 10 个设计点

1. **单内核多形态的进程拓扑（CLI → serve/daemon/worker/prewarm）**
   所有形态共享一个执行内核，Web/IDE/IM/远程都只是 ACP 客户端。特别是 **Prewarm 进程池**（冷启动 3.7s→1ms、一次性 cwd 绑定、NDJSON IPC、`ackMode:"ready"` 等 ACP 就绪再交付 endpoint）直接回答了"宿主应用如何毫秒级拉起 Agent 会话"——这正是 WorkBuddy 已采用的方案，对任何桌面 Agent 宿主都是标准答案。（prewarm.md, daemon.md）

2. **分层权限求值链 + "可信/不可信 allow" 双轨**
   九阶判定链把 hooks、deny/ask/allow 规则、命令安全检查、模式基线、非交互收口串成一条可推理的管线；最有价值的是**未信任仓库的项目级 allow 规则自动降级**，防"克隆恶意仓库即提权"——这是所有读用户仓库的 Agent 都会踩的坑，且文档把评估顺序而非配置优先级作为一等公民来讲。（permissions.md, permission-modes.md）

3. **auto 权限模式的"分类器 + fail-closed + 宽规则临时失效"设计**
   在 default（太烦）与 bypass（太险）之间插入 LLM 分类器只裁决"剩余 ask"；分类器故障即拒绝、连续失败自动降级回 default、过宽 allow 规则（如 `Bash(*)`、`Agent(*)`）在 auto 下被临时忽略防绕过，并配 `auto-mode critique` 用模型审查用户自定义规则。把"自动审批"做成了可治理的系统而非开关。（permission-modes.md, cli-reference.md）

4. **工具延迟加载（ToolSearch/DeferExecuteTool）作为上下文经济的核心基建**
   工具不进初始上下文、模型先搜后用，覆盖 MCP server/工具级静态配置与 `Defer()/NoDefer()` 会话级修饰符（NoDefer 恒胜、自动附加搜索/执行工具、Defer(*) 不卷走自身）。在 MCP 工具爆炸的时代，这是比"裁剪 MCP"更通用的解题思路，且与权限规则正交。（mcp.md, tool-defer-overlay.md）

5. **Channels：把"外部事件入会话"做成 MCP 上的一层薄协议**
   一个 capability + 一个 notification 就把聊天桥/Webhook/告警统一了；双向 channel 用 reply 工具闭环，**权限中继**（终端与远程同时弹审批、先到先得）解决了"远程驱动本地 Agent 时的审批真空"；发送者按 from.id 白名单防群注入，`channelsEnabled` 给组织留管控闸。微信（ClawBot 扫码）和企微（WS 长连接免公网 IP）两个内置实现证明该协议足以承载国内 IM 生态。（channels-reference.md, wecom-bot-setup.md）

6. **/goal = prompt-based Stop hook 的官方封装**
   "让 Agent 持续工作直到条件满足"被拆解为：每轮结束由 lite 小模型评估 condition（三态含 impossible 防死循环）→ 未达成则 reason 以 isMeta 消息注入 history 纠偏 → 评估窗口以 createdAt 过滤防"刚设完即达成"。把自治循环的控制器从主模型手里拿出来交给便宜的小模型，是会话级 autonomy 的可复用范式；文档还明确与 /loop、Stop hook 的选型边界。（goal.md, hooks.md）

7. **Agent Teams 的完整协作社会学**
   共享任务列表（依赖解除阻塞）+ Mailbox（message/broadcast/shutdown/plan_approval 五型）+ 委派模式（领导只协调不动手）+ 成员可唤醒重启 + `@成员` 直聊绕过领导；更难能的是文档坦承适用边界（并行探索才有价值、token 消耗高、无会话恢复）与"竞争性假设调试"这类克服锚定偏差的玩法。多 Agent 协作产品化时，这套"领导-成员-任务-信箱"四件套用最小概念覆盖了大多数场景。（agent-teams.md）

8. **安全纵深是"规则层 + OS 沙箱层 + 内容层"三层的乘积**
   权限规则管"想不想"，bubblewrap/Seatbelt 沙箱管"能不能"（网络+文件双隔离、子进程继承），内容上再做：配置文件写保护（防注入 hook 逃逸）、子代理输出去毒（防伪造 system 标记回灌）、Web 抓取隔离上下文。特别指出任一单点都不够——没有网络隔离的沙箱会泄 SSH key，没有文件隔离会后门系统。这是把提示注入威胁模型落到工程细节的范本。（bash-sandboxing.md, security.md）

9. **工具输出外部化 + 异步压缩的"无限上下文"工程**
   大输出超阈值自动落盘、模型只收截断+路径指针（Bash/其他工具/MCP 三套阈值独立）；上下文逼近上限时后台异步压缩，保留代码变更/决策/偏好；`/context` 把 token 分布（含 autocompact buffer）可视化。对长任务办公 Agent，这套"输出不落上下文、历史可压缩、占用可观测"的组合拳是控制成本与延迟的基本功。（env-vars.md, costs.md）

10. **SDK 默认环境隔离（settingSources）**
    SDK 默认不读 settings/CODEBUDDY.md/MCP/agents/skills，一切由代码显式声明，需要时按 user/project/local 粒度开启。这与 CLI"全量加载"形成互补，从根上保证宿主应用行为可预测、可复现、可审计——自研 Agent 平台同时服务"人直接用"与"被集成"两种场景时，这个默认值的取舍直接决定集成方的信任成本。（sdk.md）

> 候补亮点：MCP Apps 沙箱 iframe widget（工具结果可视化+反向调用强制授权，mcp-apps.md）；Dynamic Workflows"计划即代码"（workflows.md）；企微流式消息原位替换满足 5s 回调超时（wecom-bot-setup.md）；daemon 系统服务+自动更新的零干预运维链路（daemon.md）。
