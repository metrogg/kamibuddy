# WorkBuddy v5.4.7 竞品逆向分析 06：腾讯生态集成 + 桌面 UI 层

> 分析对象：`@genie/workbuddy-desktop` v5.4.7（腾讯 WorkBuddy 桌面端，Electron）
> 素材根目录：`c:\Program Files\WorkBuddy\_analysis\extracted\`
> 结论均标注证据文件路径；`main/*.js`、`renderer/assets/*.js` 为构建产物（rolldown 打包），行内 `#region` 注释保留了原始源码路径（`packages/workbuddy-server/src/...`、`packages/agent-ui/src/...`），可据此还原 monorepo 结构。

---

## 1. 腾讯系自研 SDK 清单（`node_modules/@tencent/`，共 12 个包 + 1 个原生 SDK）

| 包名 | 版本 | 用途 | 上报目标 / 集成对象 |
|---|---|---|---|
| `@tencent/aegis-electron-sdk-v2` | 2.6.13 | RUM 前端性能监控 SDK（Electron 主进程版），依赖 node-machine-id 采集设备 ID | **Aegis（腾讯前端监控平台）**：Crash/PV/Performance/Network 自动采集 + 自定义 `reportEvent/reportTime/error`。主进程由 `AegisExporter` 封装（证据：`main/desktop-monitor-service.js` L6448-6721） |
| `@tencent/aegis-web-sdk-v2` | 2.6.13 | RUM Web 版（renderer 进程用），依赖 web-vitals/js-cookie | 同上（renderer 侧 Aegis 实例，sessionId 通过 IPC 同步给主进程，见 `desktop-monitor-service.js` L6520-6655；renderer 初始化见 `renderer/assets/index-BZXT-Qol.js` L31300 `initializeRendererAegis`） |
| `@tencent/beacon-main-core` | 2.1.7 | 灯塔上报核心（策略/存储/发送管道，TS 源码随包发布） | **灯塔（Beacon，腾讯移动/前端数据分析平台）**，内部仓库 `git.code.oa.com/beacon/beacon_sdk_js` |
| `@tencent/beacon-node-new-sdk` | 4.2.11 | 灯塔 Node 版（main 进程用） | 灯塔 |
| `@tencent/beacon-web-sdk` | 4.7.6 | 灯塔 Web 版（renderer/H5 用） | 灯塔；renderer 侧用于 Teams/协作全埋点（`renderer/assets/beacon-report-2Y-aDTcy.js`，源码路径 `packages/agent-ui/src/modules/collab/beacon-report.ts`，走 `/v2/report` 链路） |
| `@tencent/universal-report` | 4.7.4 | **大同统一上报 H5SDK**，是对 beacon-web/beacon-node 的上层封装（dependencies 直接引用两者），并提供 electron-main / electron-render / external-h5 / pixui 四种插件 | 大同（统一上报体系，底层仍落灯塔）；renderer 中经 `@tencent/ai-common-utils` 的 `universal-reporter` 引入（`renderer/assets/dist-C0RQhKFs.js` L67584）。CSS 注释证实"大同（灯塔）/伽利略两个全埋点 SDK 都只识别原生可点击元素"（`collab-2QdWWqa2.css` L3244） |
| `@tencent/qimei-node` | 1.2.2 | **Qimei 设备指纹**原生 SDK（win: `qimei.dll` + koffi FFI；mac: QimeiSDKMac.xcframework），产出 `qimei36` 设备标识 | 腾讯 Qimei（终端设备指纹体系）。桌面端由独立 helper 进程取数（`main/qimei-helper.js`），主进程 `QimeiDetector` 缓存到 `~/.workbuddy`（`main/log-acl-guard.js` 顶部 `qimei-detector.ts` region），仅作上报维度（`main/server.js` L42469/L42629：`qimei36 只影响上报维度`），并经 env `CODEBUDDY_QIMEI36` 透传给 agent CLI |
| `@tencent/drive-sdk` | 1.1.2 | **腾讯网盘 JSSDK**——"为第三方应用提供文件管理能力"（package.json 原文），含上传/下载/列表/目录/鉴权错误体系 | 腾讯网盘（微云/网盘开放平台）。WorkBuddy 用作"网盘知识库/我的文件"能力：server 端内嵌其 dist（`main/server.js` L54753 起），renderer 有 `netdrive-service-*.js`、`netdrive-selector-modal-*.js`、`use-tencent-netdrive-knowledge-feature-*.js`、`my-files-*.js` |
| `@tencent/tencent-docs-ai-engine` | **0.2.137-wb**（wb = WorkBuddy 定制后缀） | **腾讯文档 AI 引擎**：包装随包原生二进制 `editor_sdk`（bin/win32-x64/editor_sdk.exe），spawn 单端口 HTTP 服务（默认 :39099），同时提供 ① `/mcp` JSON-RPC MCP 端点（供 agent CLI 读写文档）② `/static/{doc,sheet,slide,pdf}/pc.html` 编辑器预览资源（内嵌 WASM/JS，无需外网）；另含本地文档场景层（routing-prompt / selection-prompt / scenario-detector / 端口文件协议）与 `tencent-docs-mcp` stdio 桥 | 腾讯文档编辑器 SDK（本地引擎）。证据：`node_modules/@tencent/tencent-docs-ai-engine/package.json`、`src/common/tencent-docs-service.ts` 头注释、`src/mcp/stdio-mcp-bridge.ts` |
| `@tencent/ovb-indexed-db` | 1.2.4 | TVF（腾讯前端通用模块）IndexedDB 本地存储封装 | 通用基建，被 beacon-web-sdk 依赖做离线缓存 |
| `@tencent/ovb-request` | 1.1.23 | TVF 轻量 HTTP 请求器（jsonp/fetch 封装） | 通用基建，被 beacon-web-sdk 依赖 |
| `@tencent/ovb-utils` | 1.1.7 | TVF 工具类（cookie/文本/日期/URL） | 通用基建 |
| `native/turing-sdk`（`workbuddy-turing-sdk` 0.1.0，private） | — | **腾讯天御 T-Sec TuringShield 桌面 SDK** 的 N-API 桥（`TuringShieldSDK.dll` + `turing_sdk.node`），接口：`configure(channelId, productName, productVersion)` + `fetchDeviceToken()` | 天御（腾讯安全反欺诈/设备风险识别）。主进程 `TuringSdkService` 加载（`main/index.js` L16937-17084），通过 host RPC `GET_TURING_DEVICE_TOKEN` 暴露给上层（`main/index.js` L15541、`main/daemon-app-server-main.js` L1218），应作为登录/API 请求的设备安全 token |

---

## 2. 腾讯文档集成链路（桌面端深度集成，本分析最核心的发现）

WorkBuddy 不是简单跳转到腾讯文档网页，而是把**腾讯文档编辑器引擎本地化**后嵌入桌面端，形成"本地 Office 文件 ↔ 腾讯文档引擎 ↔ AI Agent"的完整闭环。

### 2.1 架构组件

| 组件 | 角色 | 证据 |
|---|---|---|
| `editor_sdk.exe`（原生二进制） | 腾讯文档本地编辑器引擎，单端口 HTTP 服务：`/mcp`（MCP 工具）+ `/static/{doc,sheet,slide,pdf}/pc.html`（预览前端，资源内嵌二进制） | `@tencent/tencent-docs-ai-engine/bin/win32-x64/`；`src/common/tencent-docs-service.ts` L1-31 头注释 |
| `TencentDocsEngineSession` / documentService（main/workbuddy-server） | 引擎生命周期：懒启动、端口扫描（39099 起向上找空闲，防多实例冲突）、就绪探测（`/health` + `/localapi/editor/status`）、孤儿进程清理（pkill `editor_sdk --port`）、端口文件（port file）协议 | `main/tencent-docs-prompt-selection.js` L825-1300（stale 清理、熔断器、60s 冷启动超时） |
| `tencent-docs-main-integration.js` | main 进程装配层：注入 windowManager（弹窗前唤起主窗口）、原生 dialog 代理（showOpenDialog/showSaveDialog/showMessageBox）、引擎就绪/预览重载事件推送到 renderer | `main/tencent-docs-main-integration.js` 全文 |
| `tencent-docs-document-lifecycle-port.js` | Agent 会话侧对接：`createTencentDocsEngineProvider().resolveAgentEnv()`——引擎已启动时把 `buildTencentDocsLocalMcpEnv(port)` + `editor_sdk_port` 注入 agent CLI 的环境变量；未启动则后台预热（`ensureEngineStarted("agent-spawn")`） | `main/tencent-docs-document-lifecycle-port.js` 全文 |
| `tencent-docs-mcp`（stdio MCP bridge） | agent CLI 以 stdio MCP server 形式接入；桥从 env `TENCENT_DOCS_ENGINE_PORT_FILE` 读端口文件，代理 stdio JSON-RPC ↔ `http://127.0.0.1:<port>/mcp`（streamable-HTTP） | `tencent-docs-ai-engine/src/mcp/stdio-mcp-bridge.ts` |
| `<webview>` + `webview-preload.js` | renderer 用 Electron `<webview>` 嵌入两类页面：① 本地引擎预览 `http://127.0.0.1:<port>/static/<type>/pc.html` ② 腾讯文档在线页（云文档 sandbox pc.html，域名 docs.qq.com）；preload 提供 mqq 桥（仿手 Q JSBridge）：`docx.onSelectionChange`/`docx.onSelectionSend`/`workbuddy.reportTelemetry`/`workbuddy.accessProbe`、URL 守卫（只允许 127.0.0.1 本地预览与云端 sandbox 两种 pc.html）、下载通道、拖拽释放桥 | `extracted/tencent-docs/webview-preload.js`（mqq 协议 L752-990、URL guard L803/828）；preload 路径桥 `main/index.js` L30372-30397 |
| dev 灰度切换 | `tdoc-dev-env-cookies.js`：关闭 dev-env 时清除 docs.qq.com 域的 `env_name`/`env_id` 灰度路由 cookie | `main/tdoc-dev-env-cookies.js` |

### 2.2 完整流程推断（本地文档：打开 → 预览 → 选区 → AI 读写）

1. **打开文档**：三种入口——系统双击/右键/argv（`createSystemOpenLocalFileHandler`，`main/wb-source.js` L590-697）、应用内 dialog、会话内引用。系统入口会做多会话冲突预检（`checkLocalFileOpenConflict`，owned-by-other 则 Toast `localFileAlreadyActive`）和预览池容量闸门（默认 5，`previewPoolFull`），然后广播 `tencent-docs:openLocalFileInMainWindow` 给 renderer 编排。
2. **引擎启动**：`documentService.ensureEngineStarted()` → 清理上一实例残留的 `editor_sdk` 孤儿 → spawn `editor_sdk --port N --cors_origin=... --log_dir=~/.workbuddy/logs/editor_sdk` → 60s 内等 `/health` 200；连续失败触发熔断，预览降级到内置 JS 预览（`EmbeddedPreviewResult.engineUnavailable`）。
3. **注入 webview 预览**：renderer 调 `getPreviewUrl(filePath)` 拿到 `http://127.0.0.1:<port>/static/doc|sheet|slide|pdf/pc.html?...`（追加 `globalPadId`=路径 md5、主题、语言、`wb_source` 来源标记），挂到 `<webview>`（带 preload）。支持类型见 `document-types.ts`：Word/Excel/PPT/PDF 共 26 种扩展名。在线云文档则直接加载 docs.qq.com 的 sandbox pc.html，并监听登录 cookie（`online-doc-login-cookie` bridge，`main/index.js` L30451）。
4. **选区上报（AI"读"的上下文）**：webview 内编辑器通过 mqq 桥发 `docx.onSelectionChange` → preload 转 IPC `workbuddy:mqqBridge` → main 的 `DocumentEditContext`（`main/tencent-docs-prompt-selection.js` L22-88，5 分钟 TTL、覆盖式更新；预览 URL 的 `globalPadId` 会被识别并剔除，防止被当成 MCP `file_id` 误注入 prompt，L139-161/L714-720）。
5. **Prompt 注入**：host 侧渲染 `<tencent_docs_editor_context>` 隐藏块（routing-prompt），声明本轮涉及哪些本地/远程文档、活动文档、`type="local|remote"` 通道戳；本地通道强制要求模型先走 **`tencent-docs-routing` skill**（决策 skill），再调 **`tencent-local-office-edit` skill**（执行 skill），远程 `tdoc://` 文档走在线 MCP（`tencent-docs-ai-engine/src/common/routing-prompt.ts` 头注释）。
6. **AI 读写文档（MCP 工具）**：agent CLI spawn 时获得 `editor_sdk_port`/端口文件 env → `tencent-docs-mcp` stdio 桥注册为 `tencent-docs-local` MCP server → 模型调用其工具（open_file/get_pool_status/save/close 等，底层走 `/localapi/editor/*` 与 `/mcp`）直接读写本地文档；保存/关闭经 main 原生 dialog 与用户确认（`tencent-docs-main-integration.js` 的 dialogProvider），冲突时返回 `false` 阻断 webview 内部 tab 行为（L2565/L6196 注释）。
7. **退出保护**：app 退出前走 `RELEASE_PREVIEW_CONTEXTS_WITH_PROMPT`（有未保存文档先提示），引擎 SIGTERM→2s→SIGKILL（`main/index.js` L30487 quit-controller、`tencent-docs-service.ts`）。

### 2.3 其他腾讯文档面能力
- 在线文档 AI 编辑企业特性开关：`renderer/assets/use-tencent-docs-ai-edit-enterprise-feature-DU6Gjh-q.js`（index.html modulepreload 引用）。
- POI/地址服务：`main/poi-user-asset-service.js`（腾讯位置服务 `/v2/user-asset/map|address`，IP 定位、地理编码、收货地址簿——应为元宝/生活类 Agent 场景复用腾讯位置能力）。

---

## 3. 数据上报与观测体系（四套并行，分工明确）

| 体系 | SDK/实现 | 进程 | 上报内容 | 证据 |
|---|---|---|---|---|
| **Aegis（RUM）** | aegis-electron-sdk-v2 / aegis-web-sdk-v2 | main + renderer | 崩溃、PV、性能、网络自动采集 + 自定义事件/耗时；renderer sessionId 同步到 main 统一串联 | `main/desktop-monitor-service.js` AegisExporter（L6448-6721，含 pre-bootstrap 200 条缓冲、1s 上报超时、`main_process_start` 事件） |
| **灯塔 Beacon / 大同 universal-report** | beacon-web/node + universal-report（大同 H5SDK 封装 beacon） | renderer 为主 | 业务全埋点（Teams/协作点击流，`TEAMS_EVENT_META` 元数据驱动，`requireReady` 门控），走 `/v2/report` | `renderer/assets/beacon-report-2Y-aDTcy.js`（`packages/agent-ui/src/modules/collab/beacon-report.ts`）；universal-reporter 经 `@tencent/ai-common-utils` 引入（`dist-C0RQhKFs.js` L67584） |
| **伽利略 Galileo（内部 OTel 平台）** | 自研 `GalileoExporter`（OTel 格式，HTTP POST `/v1/traces` 等） | main | Metrics + Traces + Logs 三支柱；启动链路 span 树（root=整启动，64 个 mark 点挂 phase 下） | `main/desktop-monitor-service.js` L873-1223（GalileoExporter）；`main/startup-perf-exporters.js`（`workbuddy.startup.total/first_interactive/phase` metric → Aegis recordDuration，span 树 → Galileo exportTraces）；`main/hub-tracer-handoff.js` 内嵌 `@opentelemetry/exporter-trace-otlp-http`（L188-246），源码 region `workbuddy-server/src/telemetry/trace/hub-tracer-handoff.ts`（L1979） |
| **Qimei 设备指纹 + 天御设备 token** | qimei-node / turing-sdk | main（helper 子进程/原生） | qimei36 作为所有上报的设备维度（env `CODEBUDDY_QIMEI36` 透传 CLI）；TuringShield device token 供服务端反欺诈 | `main/qimei-helper.js`、`main/log-acl-guard.js` qimei-detector region、`main/index.js` L16937+ |

**典型自定义事件名（证据：Grep `wb_`/`agent.message.`）**
- 主进程 prompt 链路：`wb_main_prompt_received`（`server.js` L126360）→ `wb_main_prompt_forwarding` → `wb_main_prompt_done`/`wb_main_prompt_failed`（`main/prompt-trace-reporter.js`，带 prompt_request_id/conversation_id/traceId/duration_ms/outcome）
- 自动化：`wb_automation_run_outcome`（`server.js` L78947）
- 入口统计前缀：`wb_entry_`（`module.app-server.js` L13786）
- renderer 链路：`agent.message.renderer_request_start` / `renderer_first_token` / `renderer_model_streaming`（`index-BZXT-Qol.js` L13704/13720/19228）
- 旧 `renderer.send-prompt` span 已退休，由 agent-ui 全链路 OTel（`renderer.prompt.prepare`/`transport_sent`）取代（`prompt-trace-reporter.js` L49-57 注释）

**日志保护（重要纠偏）**：`log-acl-guard.js`（1.5MB 大头是 COS/AWS SDK 等依赖）中的 `log-acl-guard.ts` 不是日志脱敏，而是 **Windows NTFS deny-delete ACL 守护**：给 `~/.workbuddy/logs/` 最近 7 天日期目录下 `icacls (OI)(CI)(DE,DC)` 拒绝删除 ACE，6 小时周期刷新，防止"外网用户配置目录被遍历清空导致日志现场被毁"；过期目录解除保护交回 `LoggerStorageService.deleteOldLogs` 正常清理（`main/log-acl-guard.js` L48415-48513）。

---

## 4. UI 功能地图

### 4.1 桌面 renderer（`extracted/renderer/`，React + rolldown 构建，`index.html` → `assets/index-BZXT-Qol.js`）

骨架屏注释直接给出导航结构："导航项（助理/项目/专家/自动化/更多）+ 任务分组 + 空间分组"（`renderer/index.html` L296-311）。按 bundle 名与代码证据划分：

| 模块 | 关键 bundle | 说明 |
|---|---|---|
| 应用骨架 | `app-shell-*`、`app-providers-*`、`app-home-*`、`home-*`、`main-content-core` css | 侧边栏 + 主内容区 + 状态栏；首屏 account snapshot 内联注入避免白屏（index.html L9-27） |
| 聊天/任务 | `chat-*`（"主聊天页：迁移期承载 `/home` 与 `/task/:taskId`"）、`lib-chat-ui-*`、`agent-chat-pane-*`、`conversation-*`、`common-action-*`、`acp-message-accumulator-*` | ACP 协议流式渲染 |
| **模式切换** | 入口 `index-BZXT-Qol.js` L14677-14685 定义三模式 `craft` / `ask` / `plan`，另有 `expert` 专家模式（L19769）；与权限模式映射：`bypassPermissions→craft`、`default→ask`、`plan→plan`（L19759-19761） | 四模式：Craft（全权执行）/ Ask（问答）/ Plan（规划）/ Expert（专家 Agent） |
| **模型选择** | `index-BZXT-Qol.js` L11196-12038（modelPromotions/modelTiers/上下文长度记忆），默认模型 `glm-4.7-ioa`（L18161，ioa = 腾讯内部网关）；支持自定义本地模型前缀 | 模型列表由服务端下发，带活动/分级 |
| **专家体系** | `expert-picker-*`、`expert-selector-*`、`expert-install-intent-buffer-*`、`market-*`、`discover-*` | 专家市场/安装 |
| Skills | `skills-*`、`skill-selector-*`、`skill-picker-*`、`skill-scan-result-dialog-*` | 技能选择/扫描 |
| MCP | `mcp-token-config-host/bus-*` | MCP server token 配置 |
| 腾讯文档 | `tencent-docs-*`、`tencent-docs-panel-*`、`PreviewIframe-*`、`preview` 系（`pdf-preview-*`、`pptx-preview-*`、`docx-preview-*`、`xlsx-*`）、`ui-docs-viewer-*` | 见第 2 节 |
| 腾讯网盘 | `netdrive-service-*`、`netdrive-selector-modal-*`、`my-files-*`、`use-tencent-netdrive-knowledge-feature-*` | 网盘知识库/文件选择器 |
| 乐享（腾讯乐享知识社区） | `lexiang-*`、`use-lexiang-add-to-task-*`、`lexiang-content-picker-*` | 乐享内容接入任务 |
| ima（腾讯 ima 知识库） | `ima-*.js/svg` | 品牌资源 |
| 协作/团队 | `collab-*`、`colleagues-*`、`members-store-*`、`teams-chat-span-holder-*`、`wechat-chat-history-chip-store-*` | Teams 空间、微信聊天记录 chip |
| IM 渠道配置 | `claw-*.js/css/png` + 渠道图标（`QQ-*.png`、`dingtalk-*.png`、`lark-*.png`、`logo-qq-bot-*.png`） | 见第 5 节 |
| 自动化 | `automation-*`、`automation-panel-*`、`calendar-*`、`kanban-*`、`grid-list-*` | 定时任务/看板视图 |
| 登录/账户 | `loginRedirect-*`、`oauth-callback-*`、`auth-*`、`UserMenu-*`、`connector-device-code-modal-*`、`oneid-refresh-throttle-*` | OAuth 回调 + 设备码连接器 + oneid 续期 |
| 设置/反馈 | `SettingsModal-*`、`FeedbackModal-*`、`network-check-*`、`force-upgrade-*`、`quota-toast-*`、`storage-capacity-toast-*` | |
| 创作/灵感 | `dream-maker-*`、`inspiration-*`、`gallery-*`、`genie-*`、`genie-project-*`、`artifact-*`、`canvas-view-*`、`share-html-zip-*`、`publish-utils-*` | 生成物发布/分享 |
| 编辑器基建 | monaco（`editor.main-*`、`monaco-*`）、shiki 全语言包（数百个 `abap-*`…`zig-*`）、mermaid、`pdfjs`（`renderer/pdfjs/`） | |
| 上报 | `aegis.min-*`、`beacon-report-*`、`renderer-trace-service/api-*`、`telemetry-client-info-*` | 见第 3 节 |

### 4.2 CLI Web UI（`cli/dist/web-ui/`）——与桌面 UI **不同源构建，但共享会话/模式模型**

- 独立 PWA：`index.html` 标题 **"CodeBuddy Code Remote Control"**，强制 dark、对齐 VSCode Dark+ 配色（L6-11），仅 3 个 JS（`index-d7y5DUOa.js` + `markdown-*.js` + `vendor-*.js`）vs 桌面端数百个 chunk。
- 用途：`webbuddy`/CLI 的远程控制端（手机/浏览器接管终端 agent 会话），含 `sandbox_proxy.html`。
- 但 `index-d7y5DUOa.js` 内同样出现 `craft/ask/plan/expert` 模式串与 `workbuddy` 字样（Grep 命中），说明两者共享 agent 会话协议与模式枚举（同一 workbuddy-server/daemon 后端），UI 层是"全功能桌面端"与"轻量远程端"两个构建目标。

---

## 5. IM 机器人渠道架构（claw 插件体系）

### 5.1 架构
桌面端内嵌 `workbuddy-server`，其中 **`src/claw/` 是 IM 渠道运行时**（`main/server.js` L89758-90162）：

- **核心**：`claw/core/plugin-types.ts`（PassiveGatewayAdapter 基类、双模 readyTimeout：webhook=0 / websocket=30s）、`claw/core/plugin-host.ts`（`ClawPluginHost`：插件注册表 + 账户表 + inbound/outbound 分发 + 连接状态机 + 遥测）、`claw/core/runtime.ts`。
- **插件三件套**：每个渠道一个插件目录，含 `ConfigAdapter`（原始配置→账户/凭据）、`GatewayAdapter`（连接生命周期、收消息）、`OutboundAdapter`（发消息）；入站消息 → runtime → Agent 会话 → 回复经 outbound 发回 IM。
- 桌面 UI 通过 `registerClawChannel/unregisterClawChannel` RPC 管理渠道配置并启动插件（`server.js` L10891-10971，QQ 扫码 onSuccess 路径）；renderer 侧是 `claw-*.js` 配置界面 + 各 IM 图标资源。

### 5.2 渠道清单（`main/server.js` region 证据，共 14 个插件）

| 插件 | 源码路径（server.js region） | 接入方式 |
|---|---|---|
| QQ 机器人 | `claw/plugins/qq/`（L94127-95212） | **自研 WebSocket 网关客户端**（QQBotClient：Opcode 状态机、token 自动刷新、gateway 重取、消息去重 `40054005`），支持 websocket/webhook 双模；扫码绑定走 `@tencent-connect/qqbot-connector` 的 `startQrConnect`（L10411，QQBindService） |
| 企业微信 AI Bot | `claw/plugins/wecomaibot/`（L97316-98298） | `@wecom/aibot-node-sdk`（WS 长连接，L88 require） |
| 企业微信（新版/IOA 内网版） | `wecom-new/`（L97207）、`wecom-ioa/`（L97127） | 企微回调/内网网关 |
| 微信公众号 | `wechatmp/`（L96786） | 公众号回调（默认 channel="wechatmp"，L5409） |
| 微信客服 | `wechatkf/`（L96517） | 客服消息 API |
| 个人微信 | `weixin/`（L98698-99976，types/api/auth/media/client/plugin 六文件） | 扫码登录 + 媒体收发 |
| 飞书/Lark | `claw/plugins/feishu/`（L92521-94018，inbound-content/media/support/gateway/outbound/plugin） | `@larksuiteoapi/node-sdk` 的 **WSClient 长连接**（L86、L93508 注释） |
| 钉钉 | `claw/plugins/dingtalk/`（L90529-91819） | `dingtalk-stream` 的 `DWClient` + `TOPIC_ROBOT`（L91184） |
| Slack | `claw/plugins/slack/`（L95496） | `@slack/web-api` + `@slack/socket-mode`（Socket Mode，L95608/95623） |
| Discord | `claw/plugins/discord/`（L91860-92261） | 自研 gateway client |
| Telegram | `claw/plugins/telegram/`（L95915-96085） | Bot API + HTML 格式工具 |
| 腾讯元宝 | `claw/plugins/yuanbao/`（L105398-107086，codec/client/plugin，最大插件之一） | 元宝开放平台（自研 codec） |
| 自定义渠道 | `claw/plugins/custom/`（L90442） | 用户自定义 webhook |

渠道标识另有 `slackproxy→slack` 等 origin 归一化映射（`server.js` L87826-87843）。腾讯系渠道（QQ×2 路径、企微×3、公众号、客服、个微、元宝）占 14 个插件中的 8 个，是绝对主力；连接方式统一偏好**长连接（WebSocket/Socket Mode/stream）**而非公网 webhook，适合桌面端 NAT 环境常驻运行。

---

## 附：腾讯生态集成全景一句话

WorkBuddy 桌面端 = Electron 壳 + 内嵌 workbuddy-server，深度绑定腾讯生态：**腾讯文档引擎本地化**（editor_sdk + MCP + webview，AI 直接读写 Office 文件）、**腾讯网盘/乐享/ima 知识源**、**天御+Qimei 设备安全与指纹**、**Aegis+灯塔/大同+伽利略三栈观测**、以及**以 QQ/企微/微信/元宝为核心的 14 路 IM 机器人渠道**；UI 为 React 四模式（Craft/Ask/Plan/Expert）工作台，CLI 侧另有轻量 PWA 远程控制端共享同一会话模型。
