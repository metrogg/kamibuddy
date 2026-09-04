# WorkBuddy Desktop 架构解剖 ①：桌面端进程架构与运行机制

> 对象：`@genie/workbuddy-desktop` v5.4.7（Electron + 内嵌 CodeBuddy CLI 的办公 AI Agent）
> 材料：`app.asar` 解包产物（`_analysis/extracted/`）。所有 bundle 均保留 esbuild `//#region` 模块标记与大量中文设计注释，本文结论均可回溯到具体文件/行号。
> 纯逆向研究，不含任何产品代码。

***

## 1. 进程拓扑

### 1.1 拓扑总览（ASCII）

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Electron Main 进程  (main/index.js, package.json main=main/index.js)      │
│  - StartupPipeline 编排 ~27 个启动 step（lifecycle/startup-pipeline.ts）   │
│  - 窗口/托盘/CSP/菜单/协议；ipcMain.handle('wb:invoke') 万能路由           │
│  - DaemonAppServerProcessManager：spawn/ready/崩溃恢复(SIGTERM→SIGKILL)    │
│  - LocalProbeServer 127.0.0.1:18488-90 /workbuddy/probe（网页探活）        │
│  - DesktopMonitorService（metrics/Aegis/OTel）、CrashWriter                │
└──────▲───────────────────────────────▲───────────────────────────────────┘
       │ Electron IPC (wb:invoke /      │ stdin/stdout NDJSON 帧
       │  wb:* 专用通道 + MessagePort)   │ {type: ready|rpc-request|rpc-response|
       │                                │  rpc-error|rpc-event, id, channel, args}
┌──────┴───────────────┐               │
│ Renderer (React SPA) │               │  ELECTRON_RUN_AS_NODE=1
│ preload/index.js 暴露 │               │  --max-old-space-size=4096
│ channel-map invoke() │               │
└──────────────────────┘   ┌───────────┴───────────────────────────────────┐
                           │ Daemon 进程 = app-server                       │
                           │ (main/daemon-app-server-entry.js --stdio)      │
                           │  - 角色断言 WORKBUDDY_FS_PROTECTION_ROLE=daemon│
                           │  - CellJS（@celljs，inversify 风格 DI）容器    │
                           │  - 全部业务域：session/auth/产品配置/SQLite    │
                           │    (better-sqlite3, WAL)/迁移/MCP/腾讯文档/    │
                           │    扩展宿主/安全中心/IM 机器人渠道             │
                           │  - 反向 RPC bridge → main（desktop-host /      │
                           │    monitor / docs / client-tool 四桥）         │
                           │  - SidecarManager + CliPrewarmPool             │
                           └───▲──────────────────────────▲────────────────┘
              JSON-RPC 2.0     │                          │ ACP over streamable HTTP
              NDJSON over      │ spawn                    │ GET SSE + POST JSON-RPC
              named pipe/      │ (sidecar-entry.js)       │ http://127.0.0.1:<port>/api/v1/acp
              unix socket      │                          │ Authorization: Bearer <gateway secret>
              (control socket) │                          │
        ┌──────┴───────────┐   │   ┌──────────────────────┴─────────────────┐
        │ Sidecar 进程      │   │   │ CLI 进程群（agent-cli / cbc）           │
        │ (session manager) │───┘   │  - 每会话一个 `codebuddy --serve`       │
        │ - session.create/ │spawn  │  - prewarm 待命进程 `--prewarm`         │
        │   kill/list/...   │PTY/   │  - 冷启动 ~3.7s；prewarm 命中 ~1ms      │
        │ - Win:spawn pipe  │pipe   │  - IPC: /tmp/codebuddy-prewarm-*.sock   │
        │ - POSIX:node-pty  │       │    或 \\.\pipe\codebuddy-prewarm-<id>   │
        └──────────────────┘       └────────────────────────────────────────┘
```

### 1.2 各进程职责与协同

**Electron Main（`main/index.js`，1.4MB）**

- 只做 Electron 才能做的事：窗口（`window/` 域，CSP、权限、拖拽、托盘）、`ipcMain`、auto-update、`safeStorage`、系统代理、本地探测 HTTP 服务。

- 通过 `StartupPipeline`（`src/main/lifecycle/startup-pipeline.ts`，index.js:809）驱动声明式 step：每步统一超时、critical 失败 abort、阶段预算护栏；step 清单见 `bootstrap/main-bootstrap.ts`（index.js:24063）共 27 个 step。

- 历史上有 evalMode（daemon 跑在 main 进程内，`startup-steps/bootstrap-daemon-in-main-process.ts`，index.js:14663），但 v5.4.7 中 `evalModeEnabled = false` 硬编码（index.js:24083），生产固定走子进程 daemon。

**Daemon（`main/daemon-app-server-entry.js`** **→** **`daemon-app-server-main.js`** **+** **`daemon-bootstrap.js`** **+** **`module.app-server.js`** **+** **`server.js`）**

- 由 main 用 `spawn(process.execPath, [entry, '--stdio'], { env: { ELECTRON_RUN_AS_NODE: '1' } })` 拉起（index.js:15227，`daemon/daemon-process-manager.ts`）。

- 入口顶部 `assertDaemonProcessRole()`（`main/process-role.js`）：env 不对立即 `exit(1)`，让父进程从 stderr tail 捕获原因——进程身份单一来源（SSoT）设计。

- 承载全部业务：CellJS DI 容器、SQLite（F2 `daemon_db_ready`，退出前必做 WAL checkpoint，见 daemon-app-server-main.js:1476 注释）、认证、产品配置、会话管理、历史迁移（`packages/history-migration` 全家桶）、MCP Apps host、腾讯文档集成、扩展宿主（`packages/workbuddy-extensions`）、企微/飞书/钉钉等 IM connector。

- 崩溃治理：`DaemonRecoveryPolicy` 决定 respawn/give-up（index.js:15319），`ReconnectingDaemonConnection` facade 对上层屏蔽重连；ready 超时 60s、stop 预算 5s（SHUTDOWN RPC → SIGTERM → SIGKILL 三级）；daemon 侧 uncaughtException 致命退出让 main 重启，但 **EPIPE/ECONNRESET 等传输错误例外只记日志**（daemon-app-server-entry.js:36-66，有详细事故复盘注释）。

- daemon 无法访问 Electron API，通过三条反向桥回 main：desktop-host 桥（通用回落）、monitor 桥（metric/event/prompt-trace）、docs 桥（utilityProcess.fork 缺失），装配点 `registerAppServerBridgeHandlers`（index.js:15853）。

**Sidecar（`main/sidecar-entry.js`）**

- 定位：**不是**业务通道，是"会话子进程保姆"。注释明确说："CLI 的 ACP HTTP server on 127.0.0.1 才是真正的 transport"（sidecar-entry.js:283-292）。

- Windows 用 `child_process.spawn` 管道，POSIX 用 `@lydell/node-pty`——因为 node-pty Windows 原生层事故太多（winpty-conout ENOENT、ConPTY 缺失等，Issue #37718），且桌面端不消费 TTY。

- 父进程（daemon）死后自愈：stderr 连续 3 次 EPIPE 即 `exit(0)` 主动退出防孤儿（sidecar-entry.js:1424-1446，"日志绝不能成为杀死进程的原因"）。

**CLI（`cli/bin/codebuddy`，bundle 在** **`cli/dist/codebuddy.js`）**

- 每会话一个 `--serve` 进程，自持 `http://127.0.0.1:<port>` HTTP 服务，主通道 `/api/v1/acp`。

- 也支撑 `--acp`（stdio ACP，供 Zed 等编辑器）、`--bg`、`daemon start` 等独立用法（见 `cli/dist/web-ui/docs/cn/cli/daemon.md`）。

**Prewarm pool（daemon 内** **`CliPrewarmPool`，`main/cli-prewarm-pool.js:2143`）**

- 消费 CLI 的 `--prewarm` 能力：先把冷启动跑完（bundle 加载→容器初始化→认证→产品配置→MCP 发现）挂在本地 IPC 待命，activate 时 `chdir` + 透传参数变身为 `--serve` 进程。**3.7s → \~1ms**（`docs/cn/cli/prewarm.md`）。

### 1.3 启动序列（打点驱动，证据：`main/package-and-show-log.js:47-380` STARTUP\_MARKS）

```
A 段 main 进程早期   A0 process_created → A2 imports_completed → A5 crash_writer_installed
                     → A7 electron_app_configured → A8 single_instance_locked → A9 app_ready
C 段 窗口            C1 window_manager_created → C2 splash_shown → C5 main_window_created → C6 load_url
B 段 bootstrap       B1 bootstrap_entered → B2 platform_created → B3 celljs_container_ready
                     → B4 database_initialized → B5 migration_context_ready
                     → B6 daemon 反向桥注册完 → B7 daemon env 就绪 → B8 daemon 子进程 ready
                     → B9-B12 connection/event bridge/desktop-host RPC → B13 wsrpc_ready → B15 bootstrap_complete
D 段 preload         D1 preload_start → D4 preload_rpc_connected → D5 exposed
E 段 renderer        E1 nav_start … E8 react_mounted … E13 skeleton_gone → E14 app_ready
F 段 daemon 内部     F1 daemon_started → F2 db_ready → F3 celljs_deps → F6 sidecar_manager_ready
                     → F7 rpc_ready → F9 daemon_ready → F15 auth_account_ready → F16 …
```

A/B/C/D/E/F 六段并行打点到同一 jsonl（main 与 daemon 共享 `<pid>-<time>.jsonl`，瀑布分泳道展示，daemon-app-server-main.js:1370-1385）。daemon 与窗口/渲染**并行**启动：main 在 B5-B8 spawn daemon 的同时走 C 段建窗，renderer 通过 splash + skeleton 等待 daemon ready。

***

## 2. 通信协议（四条链路，逐层降级）

### 2.1 Renderer ↔ Main：Electron IPC + `wb:invoke` 万能路由

- `ipcMain.handle('wb:invoke', …)`（index.js:4904 `renderer-wb-invoke-bridge.ts`）。

- channel 分两类：`wb:*` 前缀走 daemon 侧 WBBus hub（`wb:invoke` 内层路由），非 `wb:` 前缀直接 `daemonConnection.invoke(channel, …)`；`wb:windows:*`/`wb:shell:*` 由 main 本地 desktop-only service 拦截。

- **可信 subject 派生**：renderer 上报的 context 不可信，main 用 `WindowRegistry` 按 `event.sender.id` 反查真实 window/extension subject，daemon 端 `authorizer.assertAuthorized` 再按 PermissionRegistry 鉴权（index.js:4928-4974）——双层鉴权，main 不重复校验 registry。

- 错误序列化为 `__wbError` 结构，renderer 侧 `createGuestProxy` 还原成 WBError。

- preload（`preload/index.js`）按 domain 生成 channel-map：`{ type:'invoke', channel, timeout }`，如 `AUTH_CHANNEL_MAP`、`AGENT_IM_CHANNEL_MAP`；另有一个 in-process MessagePort local transport（`daemon/local-transport.ts`，index.js:7979）供 evalMode 复用同一套 envelope。

### 2.2 Main ↔ Daemon：NDJSON stdio RPC（自研帧格式）

证据：`main/server.js:9515-9654`（`server/stdio-framing.ts`、`stdio-server.ts`、`stdio-connection.ts`）。

- 传输：daemon 子进程 stdin/stdout，**一行一个 JSON**（NDJSON），stderr 独立做诊断（main 侧保留 80 行 tail 用于崩溃归因）。

- 帧类型（`isDaemonStdioFrame`，server.js:9564）：

  - `{type:"ready", pid}` —— daemon 引导完成握手（main 等它带 60s 超时）；

  - `{type:"rpc-request", id, channel, args[]}` —— main→daemon 调用；

  - `{type:"rpc-response"|"rpc-error", id, channel, result|error{code,message,bizCode?,httpStatus?,data?}}`；

  - `{type:"rpc-event", id, channel, result}` —— daemon→main 事件推送（server push）。

- channel 契约集中在 `main/contract*.js`：`AUTH_RPC_CHANNELS`（`auth:login`、`auth:refreshToken`…）、`SESSION_RPC_CHANNELS`（`session:create`、`session:sendMessage`、`session:resolvePermission`、消息队列一族…）等 50+ 通道。

- 反向调用：daemon 侧 `createStdioParentRpcClient({output: process.stdout})`（daemon-app-server-main.js:1417），复用同一管道反向 invoke main 注册的 handler（desktop-host/monitor/docs 桥）。

- 生命周期通道 `DAEMON_LIFECYCLE_RPC_CHANNELS`：SHUTDOWN（优雅退出带 4s 业务收尾预算 + WAL checkpoint）、FLUSH\_CLI\_PREWARM\_POOL、PING（返回 celljsReady/daemonReady 状态）。

- `createCompositeDaemonRpcConnection`（server.js:9476）：本地 handler 优先、未命中转发远端——允许 main 在不动 daemon 的情况下覆盖/新增通道。

### 2.3 Daemon ↔ Sidecar：JSON-RPC 2.0 over 本地管道

证据：`main/sidecar-entry.js:616-820`（`sidecar/server.ts`）、`main/cli-prewarm-pool.js:391-590`（`sidecar/client.ts`）。

- 传输：Windows named pipe / POSIX unix socket（`controlSocketPath(uuid)`），NDJSON，标准 JSON-RPC 2.0 `{jsonrpc:"2.0",id,method,params}`。

- 方法：`sidecar.ping`、`sidecar.credentialProtection.bootstrap`、`sidecar.shutdown`、`session.create{command,cwd,port}`、`session.ready`（子进程上报 pid+port）、`session.reconnect/resize/kill/list/capture`。

- sidecar 写 PID 文件 + session journal，启动时 reap 孤儿 journal；控制 socket 每实例带 uuid 后缀防误连。

### 2.4 Daemon ↔ CLI：ACP over streamable HTTP（SSE + POST）

证据：`main/server.js:37612`（`workbuddy-core/conversations/common/acp-http/streamable-http.ts`）、`server.js:128514`（`agent/acp-client.ts`）、`main/acp.js`（`@agentclientprotocol/sdk@0.25.0` zod schema）。

- 端点：`http://127.0.0.1:<port>/api/v1/acp`（CLI `--serve` 内核分配随机端口，`--port 0`）。

- 下行：`GET` + `Accept: text/event-stream` 建 SSE 长连接，响应头必须带 `Acp-Connection-Id`；支持 `Last-Event-ID` 断点续传、指数退避重连（1s→30s+jitter）、心跳超时检测、背压（high/low water mark）。

- 上行：`POST` JSON-RPC（ACP 方法：`newSession/loadSession/resumeSession/prompt/cancel/setSessionMode/unstable_setSessionModel/extMethod`，server.js:128541-128549），带 `Acp-Connection-Id` 头绑定到 SSE 连接；POST 响应可以是 JSON 也可以是 SSE 流。POST 超时高达 **3 小时**（10800s，server.js:128516）——长任务 prompt 与 SSE 复用同一 POST。

- 会话事件除标准 ACP `sessionUpdate` 外，经 `_meta['codebuddy.ai/teamUpdate']`/`memberEvent` 扩展推送 Agent Teams 多智能体状态（`docs/cn/cli/acp.md`）。

- 鉴权：`main/gateway-secret.js`——daemon 进程内生成一次性随机 32B secret，经 env `CODEBUDDY_GATEWAY_AUTH=password` + `CODEBUDDY_GATEWAY_PASSWORD` 注入 CLI，REST 调用方带 `Authorization: Bearer <secret>`；ACP 主通道走 loopback 豁免。这是 **CNVD-ZC-2026-6234** 修复：历史上 `CODEBUDDY_GATEWAY_AUTH=none` 导致同机任意进程未授权 RCE。secret 不落盘、不进 settings。

### 2.5 Prewarm IPC：单行 JSON over unix socket/named pipe

证据：`docs/cn/cli/prewarm.md`、`main/cli-prewarm-pool.js:2903-2929`。

- 地址：`/tmp/codebuddy-prewarm-<id>.sock`（0600）或 `\\.\pipe\codebuddy-prewarm-<id>`。

- 协议：写一行 `{cmd:"ping"|"status"|"activate", …}` 读一行响应。activate 支持 `ackMode:"ready"`——ACK 延迟到 HTTP listener + ACP 初始化完成，携带真实 pid/sessionId/非零端口 endpoint，调用方必须校验三者（`validateActivateReadyResponse`，cli-prewarm-pool.js:3120-3123，强制 127.0.0.1 + `/api/v1/acp` 路径）。activate 只允许成功一次。

***

## 3. CLI 生命周期

证据主体：`main/cli-prewarm-pool.js`、`main/cli-product-env.js`、`main/workbuddy-packaged-runtime.js`、`main/workbuddy-paths.js`。

**发现/定位**

- `resolveAgentCliExecutablePath`（cli-prewarm-pool.js:165）：bundledCliPaths（`resolveBundledAsset('cli','bin','codebuddy')`，`workbuddy-product-config.js:52` 的 7 级候选路径链，覆盖 asar.unpacked/dev 布局）→ monorepoCliPath → envCliPath。

- 运行时识别：`WORKBUDDY_IS_PACKAGED` env（`workbuddy-packaged-runtime.js`）；所有路径计算禁引 electron（`workbuddy-paths.js:9-31` 注释记录了 `ELECTRON_RUN_AS_NODE` 下 `require('electron')` 崩溃导致白屏 30s 的事故）。

**冷启动路径（sidecar）**

- daemon `SidecarManager` 确保 sidecar 存活（PID 文件 + ping + stale pipe 回收 2s），`session.create{command, cwd, port}` → sidecar spawn `codebuddy --serve` → CLI 自己监听 127.0.0.1 → `session.ready` 回报 pid+port → daemon 建 ACP 连接。

- CLI 参数由 `buildAgentCliRuntimeArgs`（server.js:128567）构造：`--permission-mode`（默认 bypassPermissions）、`--allowedTools`（present\_files/read\_me/show\_widget/WebFetch/Bash(mcporter:\*) 等）、`--model`、`--system-prompt-file`、`--settings{trustedDirectories,language,envRouteMode}`、`--mcp-config --strict-mcp-config`、`--prompt-vars-file`。

**热路径（prewarm pool）**

- `CliPrewarmPool`（cli-prewarm-pool.js:2388）：池只管 spawn/activate/kill/补池，不碰 sidecar 会话表；activate 后的进程按 pid 继续跟踪，killSession 时由池终止。

- **命中策略（宁慢勿错）**：`tryAcquire` 比较调用方 deltaEnv 与固化 baselineEnv——任意未审计差异（不在 `PER_SESSION_ENV_KEYS` 白名单 / `_TOKEN|_API_KEY|_ACCESS_TOKEN` 后缀）→ 返回 null 回退冷启动。白名单登记有严格契约：cbc 侧对该 env 必须运行时 live 读（注释 cli-prewarm-pool.js:2255-2306 详述"静默取旧值"陷阱）。

- **activate-safe 漂移键**（PATH/HTTP\_PROXY 等 14 个）单独不一致时不回收整池，activate 时覆盖即可（#97082）。

- **回收**：idle TTL 15min 到期回收且**不补池**（#92347）；健康探活与 acquire 解耦（首次 20s、稳态 8min、单次 2s），识别 SIGSTOP/死锁/休眠恢复类假死——旧实现"acquire 时同步 ping"曾把"刚 ready 仍在初始化"的健康进程误杀（#75795，注释里有完整复盘）。

- **补池退避**：10s 起步 ×2 封顶 60s，防"崩溃→即 spawn→又崩"死循环；容量不变量只计 idle/spawning。

- **auth 变化**（登录/登出/切用户）→ flush 整池（旧进程持有旧 auth 文件快照）。

- daemon 收到 FLUSH\_CLI\_PREWARM\_POOL RPC 时 `cliPrewarmPool.flush()`（daemon-app-server-main.js:1517）。

**孙进程崩溃观测**：daemon 对 spawn 的 cli/sidecar 挂 stderr tail（20 行 × 1KB）多播收集，意外退出写进 crash entry 上报（daemon-app-server-entry.js:86-120）。

***

## 4. 鉴权与安全

**登录流程**

- 类型：`AuthenticationType.CLI_EXTERNAL_LINK`——外链 OAuth：daemon `WorkbuddyExternalLinkAuthenticationProvider`（module.app-server.js:66-111）打开系统浏览器跳 SSO（codebuddy.cn / copilot.tencent.com，staging 有域名重写表），回调 deep link 完成换 token。

- RPC 面：`auth:login/logout/getToken/refreshToken/refreshSession/statusChanged/…`（`main/contract.js`）。

- `WorkbuddyAuthenticationManager` 在 session 变化后触发产品配置同步（`/v3/config` 拉取，去重在 desktop coordinator 层，module.app-server.js:155-177）。

- daemon 的 HTTP 客户端 `runtime-http.ts`（`main/runtime-http.js`）对每个请求做"session 落定等待"：`initialized` 后若 session 仍空，再等最多 1s 拿首个有 accessToken 的 session，修复"无 token 请求被网关打回 oidc\_introspection\_failed"的启动竞态（issue-91861）。

**Token 存储**

- `FileAuthenticationStorage`（`main/file-authentication-storage.js`）：session 存共享文件供 CLI 子进程读；fs watcher 监听外部变更（重试 250ms→30s、30s 稳定复位）、写入自持 300ms 防自触发、unlink 500ms 确认窗口；优先级 `Normal+1`，另有 `WorkbuddyBootstrapAuthenticationStorage`（priority High+2）从 `ACC_PRODUCT_CONFIG_V3/V2` 读 bootstrap 认证类型。

- **静态加密（at-rest）**：`main/credential-protection.js` + `main/dist.js`（`@genie/at-rest-crypto`，自定义格式 WBEF1/WBEV1/WBER1/WBES1，AAD 域 `WB-AAD\0`）。对称密钥由 Electron `safeStorage` 包裹；模式经 env `WORKBUDDY_AT_REST_ENCRYPTION` 传递，main 在 daemon ready 前通过 RPC 下发 bootstrap（`sendDaemonCredentialProtectionBootstrap`，index.js:15824），daemon 侧 `DaemonCredentialProtectionBootstrapGate` 等 1s 收敛。settings.json、models.json 走字段级 codec 加密 + 失败上报 + 后台迁移（`scheduleCredentialFileMigration`）。

- **Legacy 迁移**（`main/legacy-auth-session-migrator.js`）：从旧 WorkBuddy IDE 的 `state.vscdb`（VSCode globalStorage）读 `secret://{extensionId:tencent-cloud.coding-copilot,key:planning-genie.new.accessTokencn}`，用 `safeStorage.decryptString` 解密迁移。

**网络管控**

- `main/network-gate.js`：系统唤醒/启动后 `waitForNetworkOnline`——最小等待 1.5s + DNS 探测 `copilot.tencent.com`（500ms→5s 退避，上限 30s），修复休眠恢复撞 `ERR_NETWORK_CHANGED`。

- `main/runtime-http.js`：所有非流式请求默认 10s 超时 fail-fast（修复休眠后裸 fetch 卡 15 分钟的事故）+ DNS race guard 额外 5s（Windows libuv GetAddrInfoW 不可中断，nodejs/node#46549）。

- `main/tls-verification.js`：`ProductFeature.DisableTlsVerification` 云控开关 → 进程级 `NODE_TLS_REJECT_UNAUTHORIZED=0`（私有化自签名 CA 场景），幂等 + 抑制告警噪声。

- 代理：main 侧 `system/proxy.ts` + PAC RPC service（daemon 通过 socket 向 main 求 PAC 解析，`WORKBUDDY_PAC_RPC_SOCKET/TOKEN`）。

**文件系统保护**

- `main/fs-protection.js`：零依赖 CJS shim，side-effect 猴补丁 `fs.mkdirSync/statSync/appendFileSync/renameSync/rmSync` 等，保护 `~/.workbuddy/`（configDir、workbuddy.db、app、memory、logs）不被 CLI/插件侧路径误写；审计日志按进程角色分文件（`fs-protection.log` vs `fs-protection.daemon.log`）。这就是进程角色 env 名 `WORKBUDDY_FS_PROTECTION_ROLE` 的历史由来。

***

## 5. 沙箱与执行隔离

**本地执行**

- CLI 直接在用户机器执行（`--permission-mode bypassPermissions` + `trustedDirectories` 限定工作区），daemon 不另起沙箱；安全闸门在两层：CLI 自身 permission 体系 + daemon 侧 SecurityCenter（`security-center/audit-acp-adapter.ts`，server.js:130527，对 ACP 工具调用做审计/规则拦截；规则经 `getAllActiveEndpoints` 广播到所有会话）。

- 威胁情报：`threat-database-galileo.js`（沙箱威胁库更新检查/可用性上报）。

**云端沙箱**

- `main/e2b-filesystem.js`：打包了 `e2b@2.10.2` SDK（Sandbox/envd 全套）+ `packages/agent-provider` 的 `cloud-agent-provider/e2b-filesystem.ts`——把 E2B Sandbox 文件系统封装成 `FilesResource`（read/write/watch），供云 Agent 在远端沙箱执行。env：`E2B_API_KEY/E2B_DOMAIN/E2B_API_URL`。

- 腾讯文档预览沙箱：`tencent-docs/sandbox/*`（sandbox-doc-preview-registry、sandbox-bridge-rollout）+ `sandbox_proxy.html` iframe 隔离 + 专项 CSP（`window/csp/sandbox-editor-sdk-csp.ts`）。

***

## 6. 更新与运维

**应用更新**（在 index.js 内，非独立 dist 文件）

- `features/workflows/update/`：三平台实现（`update-service.darwin.ts` mac-bundle 整包替换 + install-channel marker；`update-service.win32.ts`；`update-service.linux.ts`）+ `force-upgrade-decision.ts` + `arch-mismatch-guide-service.ts`（x86/ARM 装错引导）+ 更新日志 `update-file-logger.ts`。

- CLI daemon 侧另有独立自更新链路（`docs/cn/cli/daemon.md`）：每小时检查→静默安装→空闲时 fork 新进程 graceful restart（exit 0 不触发系统服务重启）；系统服务三平台后端 launchd/systemd/Task Scheduler 均用户级。

**自检/诊断**

- `main/self-check.js`：生成 `diagnostics-<ts>.txt` 报告，内建脱敏管线（IP 保留前两段、用户名替换、代理 URL 收敛为协议名；服务端点例外保留明文域名）。

- `main/dist.js`/`dist2.js`：实为 at-rest-crypto 加密库及其 key 管理（非"分发"语义）。

**崩溃与监控**

- `main/crash-reporter.js`：CrashWriter **同步**落盘 `{logs}/Crash-Log/crash-report-{process}-{pid}.json`（crash 后进程随时死，异步 IO 会丢）；单次启动上限 50 条去重；main/daemon/sidecar 三进程各自安装；子进程崩溃补 stderr tail。

- `main/desktop-monitor-service.js`：metrics（Counter/Gauge/Histogram/UpDownCounter）+ exporter 模板方法 + Aegis 事件 + OTel logs；collectors：chat-perf（首响/展示）、cli-health、history-load；启动步耗时经 `stepDurationObserver` 全部上报 `startup.step.<phase>.<stepId>`。

- `main/persistent-log-writer.js`：LogSampler 指纹采样（窗口内限量 + 抑制计数）后落盘，防日志风暴。

- 启动类型遥测维度：`main/startup-type.js`——first\_install/upgrade/cold/warm 四态（`last-launch.json` 比对 version+build；dock/second-instance 激活标 warm），IO 全吞异常降级 cold。

- 内存诊断：daemon/sidecar 都有 heap 水位定时上报（≥1.5GB 写 `process.report`），daemon 堆上限临时提到 4GB（#90496，注释注明根治要走分页加载）。

***

## 7. 配置体系

**用户设置**：`main/settings-store.js`

- `<configDir>/settings.json`，VSCode 风格扁平 key；多模块共享同一份"加锁→读→改→原子写（唯一临时文件+fsync+rename）"管线（SecurityCenter 写 sandbox/file-safety，proxy-settings 写 http.proxy 等）；`read()` 区分"不存在={}"、"损坏=null"；敏感字段走 credential codec 加密 + 后台迁移。

**产品配置**：`main/workbuddy-product-config.js` + `module.app-server.js` + `main/common.js`

- 三层合成：内置 base product configuration → 本地 overlay → **云控**（CloudProductManager `/v3/config`，远端 sanitized payload 经 `mergeStrategy` 合并；models 按 id 智能合并，agents 有 `CloudAgentsSmartMerge` 开关）。

- 关键配置面：`endpoint`（支持 dev-env override）、`models`/`availableModels`（按登录身份过滤）、`authentication.type`、`networkEnvironment`（海外/中国 internal/iOA ioa）、`productFeatures` 功能开关枚举（`ProductFeature.DisableTlsVerification`、`SandboxFileVersionManagement`、`EnableAutoModelTiers`、Mac/WinSafeStorageStartupProbe 等数十个，common.js:2020-2655）。

- **向 CLI 传递**（`main/cli-product-env.js`）：`ACC_PRODUCT_CONFIG_V3`（内联 JSON）或 `ACC_PRODUCT_CONFIG_PATH`（文件路径，互斥组取一）+ `CODEBUDDY_INTERNET_ENVIRONMENT`；prewarm spawn 时以当前进程最新值覆盖固化 baseline（`applyCurrentProductConfigEnv`）。

***

## 8. 值得借鉴的设计点

1. **进程角色 SSoT + 入口断言**：一个 env 名曾经散落 5 个文件，收敛成 `process-role.ts` 单一来源 + daemon 入口运行时 assert（不对即 exit(1) 让父进程从 stderr 捕获）——把"命名同步"心智负担变成启动期硬失败。
2. **分层协议选型务实**：控制面 NDJSON stdio RPC（自研 5 种帧，带 ready 握手与 pending 慢调用诊断）；会话进程管理 JSON-RPC over named pipe；业务面直接复用开放协议 ACP over HTTP/SSE（`Acp-Connection-Id` + `Last-Event-ID` 续传）。不在业务通道上发明轮子，sidecar 退化为纯保姆。
3. **Prewarm 池的"宁慢勿错"**：env 白名单显式审计 + activate-safe 漂移键分级 + 未审计差异一律回退冷启动；白名单登记附带对下游消费方式（live 读 vs 冷启动缓存）的契约检查。探活与 acquire 解耦避免误杀初始化中的健康进程。
4. **崩溃治理成体系**：respawn 退避 + give-up 防死循环 + 三级停止（RPC→SIGTERM→SIGKILL）+ stderr tail 随 crash entry 上报 + "日志绝不能成为杀死进程的原因"（EPIPE 计数自愈退出）+ 传输错误与状态损坏严格区分。
5. **启动即可观测**：六段（A-F）跨进程打点共享同一 jsonl 泳道；StartupPipeline 给每个 step 统一超时/预算/降级决策；`startup_type` 四态维度（first\_install/upgrade/cold/warm）。
6. **安全修正规整**：gateway secret 修 CNVD 未授权 RCE（内存单例、不落盘、loopback 豁免 ACP）；at-rest 字段级加密带失败上报与后台迁移；诊断报告默认脱敏；渲染层 subject 由 main 反查而非信任上报。
7. **故障注释文化**：bundle 里保留大量 issue 编号 + 事故复盘（#90496 OOM、#75795 误杀、#97082、issue-91861 等），每个 hack 都写明根因与移除条件——逆向时这些注释是最高价值情报源。
8. **ELECTRON\_RUN\_AS\_NODE 依赖隔离**：路径/配置计算严格禁引 electron（`workbuddy-paths.js`），daemon 与 main 共享同一份 TS 源码但按角色裁剪——单一 codebase 双运行时形态。

***

### 关键证据文件索引

| 主题          | 文件                                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 进程角色        | `main/process-role.js`、`main/daemon-app-server-entry.js`                                                                                                                     |
| daemon 生命周期 | `main/index.js:15134`（process-manager）、`:15784`（start-daemon-child-process）                                                                                                  |
| stdio RPC 帧 | `main/server.js:9515-9654`；通道契约 `main/contract*.js`                                                                                                                          |
| sidecar     | `main/sidecar-entry.js`；client `main/cli-prewarm-pool.js:391-590`                                                                                                            |
| ACP/HTTP    | `main/server.js:37612`（streamable-http）、`:128514`（acp-client）、`main/acp.js`                                                                                                  |
| prewarm     | `main/cli-prewarm-pool.js:2143-2930`、`extracted/cli/dist/web-ui/docs/cn/cli/prewarm.md`                                                                                      |
| 鉴权          | `main/module.app-server.js:66-177`、`main/file-authentication-storage.js`、`main/credential-protection.js`、`main/legacy-auth-session-migrator.js`、`main/gateway-secret.js`     |
| 网络          | `main/network-gate.js`、`main/runtime-http.js`、`main/tls-verification.js`                                                                                                     |
| 沙箱          | `main/e2b-filesystem.js:18076+`、`main/fs-protection.js`                                                                                                                      |
| 运维          | `main/crash-reporter.js`、`main/self-check.js`、`main/desktop-monitor-service.js`、`main/persistent-log-writer.js`、`main/startup-type.js`、`main/package-and-show-log.js:47-380` |
| 配置          | `main/settings-store.js`、`main/workbuddy-product-config.js`、`main/cli-product-env.js`                                                                                        |
| 启动编排        | `main/index.js:809`（pipeline）、`:24063`（main-bootstrap step 清单）                                                                                                               |

