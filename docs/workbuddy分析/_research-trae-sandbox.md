# 调研 · Trae 的沙箱机制与权限隔离

> 日期：2026-09-14 ｜ 调研人：Codex（主 agent）
> 证据等级：【实测】本机文件实测 ｜【二进制】从 exe/dll 抽取的字符串 ｜【文档】官方页面 ｜【未验证】未证实
> 素材：本机安装的 **Trae CN**（ByteDance）——`D:\Program Files (x86)\Trae CN\`，
> 版本号取 `resources/app/package.json`；运行中的数据目录 `%APPDATA%\Trae\ModularData\`。

---

## 一、一句话结论

Trae 在 Windows 上走的是和 WorkBuddy **同一条路线**：**自研原生沙箱**（`trae-sandbox.exe` CLI
→ `sbox_sdk.dll` SDK → 受限令牌 + NT 层文件/网络 ACL），把 agent 的命令执行放进一个
**内核态受限进程**里；权限模型是一份 JSON 规则（文件三类权限 + 目录类型 + 网络 allow/deny），
**可在设置里自定义，也可由企业云端下发强制覆盖**。

和 codex / deepseek-harness 的「OS 原生能力（Landlock/Seatbelt/受限令牌）+ 审批策略」相比，
Trae 把**隔离层做进了产品二进制**，代价是 200MB+ 的原生代码 + 需要内核就绪/提权初始化。

---

## 二、沙箱的三层落地（全部【实测】）

安装目录里的真实产物：

```
resources/app/modules/sandbox/
  trae-sandbox.exe        1.2 MB   Rust CLI（"A lightweight terminal sandbox executor"）
  sbox_sdk.dll            2.0 MB   沙箱 SDK（Host 侧，含 IPC / 规则解析 / 行为上报）
  x64/aiep_sbox.dll       728 KB   实际执行约束的宿主侧库
  x64/aiep_ipc.dll        579 KB   ALPC 共享内存 IPC
  x64/run_helper.exe      509 KB   辅助进程（x86 一套同名文件）
resources/app/modules/ai-agent/
  ai_agent.dll            277 MB   agent 内核（Rust、原生）
  bin/agent-tool-host.exe 88 MB    工具宿主
  bin/ctx-cli.exe         3.2 MB   上下文 CLI
```

执行链【二进制】：

```
ai-agent  ──►  trae-sandbox exec --shell-path … --command-line … [--dry-run] [--sandbox-impl …]
                    │ dlopen /
                    ▼
              sbox_sdk.dll : SBoxSDK_Init / IsSBoxSupported / CreateSandbox
                    │
                    ▼
              受限令牌进程 + 文件 ACL + 网络 ACL（aiep_sbox.dll / run_helper.exe）
```

从 `trae-sandbox.exe` 抽出的源码路径可直接确认作者与分层：
`apps\icube_server_rs\modules\trae-sandbox\src\main.rs`、
`crates\sandbox\src\ffi_sandbox.rs`、`crates\sandbox\src\ffi\mod.rs`。

---

## 三、权限模型（【二进制】精确字段）

### 3.1 文件权限：三类 + 目录类型

```
PermissionObject ::= { file_no_access | file_read_only | file_inherit_user, dir_type }
dir_type        ::= workspace | work | tmp | cache | lang_deps | other
```

- `file_inherit_user`：继承宿主用户权限（普通可读写）；
- `file_read_only`：沙箱内只读，写被拦；
- `file_no_access`：完全禁止访问；
- **目录类型（dir_type）是关键设计**：用户只需声明「这个目录属于工作区 / 临时 / 缓存 /
  语言依赖」，沙箱按类型套用默认策略，而不是逐条写绝对路径。

### 3.2 网络权限

```
{ network_allow: [...], network_deny: [...] }
```

SDK 打印格式（`[Net ACL …]`）表明规则**同时支持 IP/CIDR 与域名 + 端口**：
`IP:[{}/{}({})] Domain:{} Port:{}`。协议维度分 `tcp` / `udp`。

### 3.3 删除保护（回收站）

```
directly_delete_paths   // 永久删除、绕过回收站的路径白名单
```
另有独立校验：`empty delete directly whitelist directory, skip it`。
**默认删除进回收站**——和 WorkBuddy 的 `recyclebin_backup` 同一思路。

### 3.4 可观测性（沙箱内建的审计指标）

```
audit_file            sandbox_block_info        block_file_counts
file_delete_to_recycle_counts                    block_sandbox_drop_count
trash_sandbox_drop_count                         sandbox_used_info / file_counts
sandbox_init_info / sandbox_sdk_crash            parse_acl_time_ms / parse_net_time_ms
```

即：**每次被拦的文件/网络操作、每次进回收站的删除、每次"越狱"尝试都被计数上报**。
这一点比 codex 的 `denial.rs` 更进一步（有回收站维度与 drop 计数）。

---

## 四、拦截与提权（对被拦命令的实际反馈，【二进制】原文）

命中限制时，CLI 打印：

```
TRAE Sandbox Error: hit restricted
  Not allow operate files: <paths>
  Not allow tcp network access: <hosts>
  Not allow udp network access: <hosts>
  Hint: You can configure sandbox rules via Settings -> Conversation -> Custom Sandbox Configuration.
  Hint: If the tool supports running outside the sandbox, you should try requesting to run this command outside the sandbox.
```

三个要点：

1. **错误里带具体被拦路径/host**，模型能据此自我修正；
2. **给模型一条出路**：「若工具支持，尝试申请在沙箱外运行」——即存在**提权申请**通道，
   与 codex 的 `shell-escalation` 同类；
3. **人机双通道**：既告诉模型调整，也告诉用户去设置里改规则。

---

## 五、可用性门禁（fail-closed 的诚实上报，【二进制】）

`trae-sandbox environment-check` 返回一组状态位：

```
supported | kernel_ready | dependencies_installed
needs_privilege_for_deps | needs_privilege_for_config | configured | unsupported_reason
```

不支持原因枚举：

```
SupportedOSFailed | FileMissX64Ipc | FileMissX64Biz | FileMissX86Ipc | FileMissX86Biz
SignatureFailed | FileVersionMismatch | WineNotSupported | ArchUnsupported
ShmUnavailable | UdsUnavailable | LibcVersionUnsupported
FileMissX64Helper | FileMissX86Helper | PermissionDenied | UnknownError
```

即沙箱**不是静默降级**：不支持就明确报 `Sandbox not supported on this system`，
并在需要时走 `install-dependency`（提权安装内核依赖）/ `check-and-recovery-env`（环境修复）。
配套 CLI 还有 `upsert-config`（生成/更新配置并编译沙箱）与 `--dry-run`（只打印将要执行的规则）。

---

## 六、企业侧：远端下发的沙箱策略（【实测】workbench bundle）

`out/vs/workbench/workbench.desktop.main.js` 里有 `EnterpriseRepos` 服务（10 分钟轮询）：

- `updateEnterpriseSandboxConfig(config_json)` —— **企业沙箱规则以 JSON 从云端下发**，
  变更时弹通知；
- `updateEnterpriseBlacklistCommands` —— 命令黑名单；
- `updateMcpWhitelistConfig` —— MCP 白名单；
- 三者随 `onDidSaaSEntitlementInfoChange` 联动刷新。

另有主进程↔沙箱的通道常量：
`vscode:frontier::sandbox-remote-agent`、`vscode:frontier::sandbox-config-update`。

**含义**：Trae 把「沙箱规则」当作**企业可管控的策略资产**（本地可改、云端可覆盖/下发），
这与 Kamibuddy 规划的「内置默认 → 本地文件 → 预留云端下发」的分层配置**完全同构**。

---

## 七、跨平台（【实测】，结论有边界）

本机是 Windows 发行版，`modules/` 下**只有 Windows 版沙箱**。但二进制里同时存在
macOS/Linux 语境串（`libc version`、`Uds`、`/bin/bash`、`sandbox_impl.json` 选择实现），
说明同一套 CLI/SDK 有其它平台的实现分支，**本机无法验证其具体机制【未验证】**。

---

## 八、对 KamiBuddy 的启示

**可直接抄（零平台依赖）**

1. **目录类型化（dir_type）**：权限规则按 workspace/tmp/cache/lang_deps 分类，而非逐路径。
   我们的 `PolicyPaths` 可以加一层「目录类型 → 默认策略」映射，配置量和误配率都会下降。
2. **三值文件权限**：`inherit_user / read_only / no_access` 比 boolean 更有表达力，
   且天然覆盖我们现有的「区外读询问（≈read_only 询问）」「凭据目录禁读（no_access）」。
3. **删除进回收站 + `directly_delete_paths` 例外**：与我们阶段 1 计划一致，值得照做。
4. **拦截错误自带被拦路径 + 修复指引 + 「申请在沙箱外运行」出口**：这是 agent 可自愈的关键；
   我们的权限门 block reason 应带上「为什么 + 怎么办 + 提权入口」。
5. **可用性状态位枚举（kernel_ready / needs_privilege_… / unsupported_reason）**：
   与我们 `SandboxEnforcement = 'full' | 'partial'` 同源，但粒度更细，且**从不假装支持**。
6. **企业规则云端下发**：印证我们 `config.get` 分层入口「预留云端下发」的决策正确。

**不能抄 / 成本过高**

- 整条原生链（`ai_agent.dll` 277MB + `sbox_sdk.dll` + `aiep_*.dll` + helper 进程 +
  `CreateProcessWithTokenW` + NT 文件 API 拦截）是多人年工程，且要**提权安装内核依赖**；
  这与我们「两周内交付」的排期不符（与 `docs/workbuddy分析/09-…` 决策 B 的结论一致）。
- 它的模型是**分发**（需要管理员安装内核组件）而非像 codex 那样复用 OS 已有能力；
  对「给同事试用」的场景摩擦更大。

**关键对比**

| 维度 | Trae | WorkBuddy | codex |
|---|---|---|---|
| Windows 隔离 | 自研 `sbox_sdk` + 受限令牌 + NT 拦截 | 自研 `tsbx.dll`（内核态更深） | `windows-sandbox-rs`（受限令牌 + ACL） |
| 权限模型 | 文件三值 + dir_type + 网络 allow/deny | 9 阶规则链 + tsbx_rules | SandboxMode × AskForApproval |
| 删除保护 | 回收站 + 直接删除白名单 | 回收站 | 无（由 git/checkpoint 承担） |
| 企业下发 | ✅ 沙箱 JSON / 命令黑名单 / MCP 白名单 | ✅ SecurityCenter | 云端 config（未验证细节） |
| 初始化成本 | 需提权装内核依赖 | 需自研驱动 | 需一次性管理员 setup 建沙箱账号 |

---

## 九、待验证 / 没查清

- 会话内「Custom Sandbox Configuration」的 UI 与默认规则表（由 Rust agent 服务渲染 webview，
  未在前端 bundle 中，本机未打开该面板故无实测截图/配置落盘）。
- `--sandbox-impl` 可选实现的清单（`sandbox_impl.json` 未随 Windows 发行包提供）。
- 网络 ACL 的域名匹配语义（通配？后缀？）与 IPv6 支持细节。
- 提权「在沙箱外运行」这一路径的审批 UX 与审计落盘位置。
- macOS / Linux 实现【未验证】。

---
*本文件为调研稿，供合成对比报告使用；不修改任何被调研产物。*
