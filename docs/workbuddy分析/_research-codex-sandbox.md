# 原始证据摘要：OpenAI Codex 的沙箱机制与权限隔离

> 用途：给主 agent 合成用的技术素材（不是终端用户报告）。
> 证据来源：本机只读 clone `开源项目/codex/codex-rs/`（Rust workspace），
> 以及同目录 `docs/workbuddy分析/09-sandbox-and-permissions.md` §四（二手笔记，本文对其纠错）。
> 证据等级：【源码】=读过实现/类型定义；【文档】=README/注释原文；【推测】=未直接读到。
> 行号为本次核对时的实际行号。不要凭记忆采信本文——改动后请回源码核对。

---

## 0. 结论速览（给主 agent 的一句话）

codex 的权限模型 = **两个正交轴**（`SandboxMode` 沙箱档位 × `AskForApproval` 审批策略）
+ **一个运行时规范化模型**（`PermissionProfile`，把文件系统与网络拆成独立策略）
+ **一套规则引擎**（`execpolicy`，Starlark 风格的 prefix rule）驱动决策，
且**平台实现各自独立**（Seatbelt / bubblewrap+seccomp+Landlock / 受限令牌+ACL+WFP+独立桌面+专用本地账号），
拒绝路径上**普遍 fail-closed + 响亮报错**，并对模型/用户诚实上报违规（`SandboxEnforcement`/violation 事件）。
另有一个被现有笔记完全漏掉的层面：**本地网络策略代理**（HTTP 3128 / SOCKS5 8081、MITM、凭据 broker、SSRF 拦截）。

---

## 1. 两个正交轴：沙箱模式 与 审批策略

### 结论
沙箱模式 `SandboxMode`（3 值，默认 `read-only`）决定"命令在什么隔离级别下跑"；
审批策略 `AskForApproval`（4 值，默认 `on-request`，但实际解析受项目信任状态影响）决定"什么时候/是否弹给人"。
两者独立配置：`sandbox_mode` + `approval_policy`。

### 证据

**沙箱模式**【源码】`protocol/src/config_types.rs:99-114`：

```rust
#[serde(rename_all = "kebab-case")]
pub enum SandboxMode {
    #[serde(rename = "read-only")]
    #[default]
    ReadOnly,
    #[serde(rename = "workspace-write")]
    WorkspaceWrite,
    #[serde(rename = "danger-full-access")]
    DangerFullAccess,
}
```

配置键 `sandbox_mode`【源码】`config/src/config_toml.rs:204-205`（`pub sandbox_mode: Option<SandboxMode>`），
另有 `sandbox_workspace_write` 子配置（:207-208）承载 `writable_roots/network_access/exclude_tmpdir_env_var/exclude_slash_tmp`。

**默认值解析不是简单的 `#[default]`**【源码】`config/src/config_toml.rs:744-813`：

- 若没显式配 `sandbox_mode`，但该目录**有信任决策**（trusted 或 untrusted 都算）→ 默认 `WorkspaceWrite`；
- **例外**：在 Windows 且 `windows_sandbox_level == Disabled`（无沙箱后端）时降级为 `ReadOnly`（:756-763，:766-774）；
- 完全没有信任决策 → `SandboxMode::default()` = `read-only`（:765）。

**审批策略**【源码】`protocol/src/protocol.rs:980-1003`：

```rust
#[serde(rename_all = "kebab-case")]
pub enum AskForApproval {
    /// Internal policy for projects marked untrusted.
    #[serde(rename = "untrusted")]
    UnlessTrusted,
    #[serde(alias = "on-failure")]
    #[default]
    OnRequest,
    #[strum(serialize = "granular")]
    Granular(GranularApprovalConfig),
    Never,
}
```

**Granular 字段**【源码】`protocol/src/protocol.rs:1005-1020`：

```rust
pub struct GranularApprovalConfig {
    pub sandbox_approval: bool,     // shell 命令审批，含 with_additional_permissions / require_escalated
    pub rules: bool,                // execpolicy prompt 规则触发
    #[serde(default)] pub skill_approval: bool,
    #[serde(default)] pub request_permissions: bool,
    pub mcp_elicitations: bool,
}
```

字段为 `false` ⇒ **该类请求自动拒绝，而不是弹给用户**（见 §4 的 rejection reason 常量）。

配置键 `approval_policy`【源码】`config/src/config_toml.rs:174-176`。

**关键坑（纠正旧笔记）**：
- config-schema 里**故意没有 `untrusted`**【源码】`config/src/schema.rs:25-39`（`ConfigAskForApproval` 只有 OnRequest/Granular/Never）；
- 在 config.toml 里写 `approval_policy = "untrusted"` 是**硬错误**【源码】`core/src/config/mod.rs:205`（`UnsupportedUntrustedApprovalPolicyError`）+ :3623-3628；
- 审批默认值是**信任相关**的，不是常量【源码】`core/src/config/mod.rs:3629-3641`：trusted → `OnRequest`；untrusted → `UnlessTrusted`；否则 `AskForApproval::default()`。

**第三个"轴"：审批复核人**【源码】`protocol/src/config_types.rs:175-201`：

```rust
pub enum ApprovalsReviewer {
    User,                                                        // "user"（默认）
    #[serde(rename = "auto_review", alias = "guardian_subagent")] // 别名 guardian_subagent
    AutoReview,
}
```

即 `approvals_reviewer = "auto_review"` 会把提权请求路由给一个专门提示过的 subagent 做风险评估（`guardian-context/` crate 提供上下文）。
App-server v2 镜像（camelCase）：`app-server-protocol/src/protocol/v2/shared.rs:176-233`（AskForApproval）、:244-297（ApprovalsReviewer）；
app-server 的 `SandboxMode` 镜像（kebab-case）：`app-server-protocol/src/protocol/v2/shared.rs:302-309`。

### 对我们的启示
- 我们 AGENTS.md 已定"两个正交轴"，方向正确；但**别把它简化成只有枚举**：codex 真正承压的是运行时的 `PermissionProfile`（§2）。
- `GranularApprovalConfig` 的"按来源类别直接拒绝、不打扰用户"正是我们需要的表达力；第一版可只做 ask/never，但**类型要留扩展位**。
- 注意 codex 的诚实做法：**配置里的值（untrusted）可以是"内部语义"却从公开 schema 里剔除**，避免用户以为能配。我们若要区分"项目未信任"应走信任决策，不要暴露成 approval_policy 值。

---

## 2. SandboxPolicy 的数据结构（含 policy_transforms 变换）

### 结论
存在**两套模型并存**：legacy `SandboxPolicy`（单枚举，`type` 标签）与新的 `PermissionProfile`（把**文件系统**与**网络**拆成两条独立策略 + `SandboxEnforcement`）。
新模型是运行时的"规范"形态；legacy 会被投影到新模型。文件系统策略是**路径规则表 + 访问模式**，默认全盘可读、写受限于 workspace+tmp，网络默认禁。

### 证据

**Legacy `SandboxPolicy`**【源码】`protocol/src/protocol.rs:1062-1114`：

```rust
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum SandboxPolicy {
    #[serde(rename = "danger-full-access")] DangerFullAccess,
    #[serde(rename = "read-only")] ReadOnly {
        #[serde(default, skip_serializing_if = "std::ops::Not::not")] network_access: bool,
    },
    #[serde(rename = "external-sandbox")] ExternalSandbox {
        #[serde(default)] network_access: NetworkAccess,
    },
    #[serde(rename = "workspace-write")] WorkspaceWrite {
        #[serde(default, skip_serializing_if = "Vec::is_empty")] writable_roots: Vec<AbsolutePathBuf>,
        #[serde(default)] network_access: bool,
        #[serde(default)] exclude_tmpdir_env_var: bool,
        #[serde(default)] exclude_slash_tmp: bool,
    },
}
```

`NetworkAccess`【源码】`protocol/src/protocol.rs:1044-1054`：`Restricted`（`#[default]`）/ `Enabled`，kebab-case。
`WritableRoot { root, read_only_subpaths, protected_metadata_names }`【源码】`protocol/src/protocol.rs:1116-1132`；
`is_path_writable` 会拒绝 `.git/.codex` 等元数据顶层组件（:1134-1167）。

**运行时规范模型 `PermissionProfile`**【源码】`protocol/src/models.rs:410-428`：

```rust
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PermissionProfile {
    Managed { file_system: ManagedFileSystemPermissions, network: NetworkSandboxPolicy },
    Disabled,
    External { network: NetworkSandboxPolicy },
}
```

- `ManagedFileSystemPermissions`【源码】`models.rs:288-306`：`Restricted { entries, glob_scan_max_depth }` | `Unrestricted`。
- `SandboxEnforcement`【源码】`models.rs:264-286`：`Managed`(默认) | `Disabled` | `External`；有 `from_legacy_sandbox_policy`。
- 内置 profile 名【源码】`models.rs:401-408`：`:read-only` / `:workspace` / `:danger-full-access`。
- `SandboxPermissions`（**每命令覆写**）【源码】`models.rs:49-82`：`UseDefault`(默认) | `RequireEscalated` | `WithAdditionalPermissions`。
- `AdditionalPermissionProfile { network, file_system }`【源码】`models.rs:250-262`（每命令/已批准的叠加层）。

**文件系统策略**【源码】`protocol/src/permissions.rs`：

- `FileSystemSandboxKind { Restricted(默认), Unrestricted, ExternalSandbox }`（:213-223）
- `FileSystemSandboxPolicy { kind, glob_scan_max_depth, entries }`（:225-230）
- `FileSystemAccessMode { Read, Write, Deny(alias "none") }`（:105-121）；**冲突优先级 deny > write > read**（注释 :83-87）
- `FileSystemSpecialPath { Root, Minimal, ProjectRoots, Tmpdir, SlashTmp, Unknown }`（:126-151）；
  注释明确 **`:special_path` token 属于配置兼容面，未知值必须 warn-and-ignore，不能 fail**（:137-144，提及 0.112.0 曾错误拒收）
- `PROTECTED_METADATA_PATH_NAMES = [".git", ".agents", ".codex"]`（:32-36）；`forbidden_agent_metadata_write`（:47-64）
- `NetworkSandboxPolicy { Restricted(默认), Enabled }`（:66-81）
- `has_full_disk_read_access` = Root 可读 且 无 deny 条目（:872-892）；`include_platform_defaults`（:894-905）
- **`workspace_write()` 构造器**（:780-834）：`:root=read` + `:project_roots=write` + `:slash_tmp`/`:tmpdir`=write（除非 exclude）+ 额外 writable_roots，
  再追加 `.git/.agents/.codex` 只读例外；`from_legacy_sandbox_policy_for_cwd`（:836-870）负责 legacy 投影。

**`policy_transforms.rs` 做了什么**【源码】`sandboxing/src/policy_transforms.rs`：

- `normalize_additional_permissions`（:21-55）：去重、丢弃空 network；**glob 只允许 deny-read**，否则报错（:32-38）。
- `merge_permission_profiles`（:107）、`intersect_permission_profiles`（:161）：叠加/求交。
- `effective_file_system_sandbox_policy`（:651-670）：把每命令 additional 权限并进基础 FS 策略。
- `effective_network_sandbox_policy`（:684-697）：**网络是 OR 语义**（任一允许即 Enabled）。
- `effective_permission_profile`（:699-713）：把上面的合并结果重新组装成 `PermissionProfile`。
- **`should_require_platform_sandbox`（:715-735）**——是否需要真的起沙箱：
  - 有受管网络要求 → true；
  - 网络关闭 → 只要 FS 不是 `ExternalSandbox` 就需要沙箱；
  - 网络开启 → 仅当 FS 是 Restricted 且写入不自由时才需要。

### 对我们的启示
- "文档写 `SandboxPolicy` 就够了"是过时判断。**运行时应当以"文件系统策略 + 网络策略 + 执行方式"三元组为准**，legacy 枚举只作配置入口。
- codex 用 `kind` 区分 Managed/Unrestricted/External 很值：我们可以直接借这套三态，避免"外部容器已隔离"与"我们自己隔离"混为一谈。
- **`:special_path` 前向兼容注释是重要教训**：配置里的新 token 不能让老 runtime 直接崩（warn-and-ignore）。我们做 tokens/体裁配置化时同理。
- `should_require_platform_sandbox` 这种"是否需要起沙箱"的谓词值得抄——避免在"其实没限制"的场合白起一层沙箱或错误地拒绝。

---

## 3. 各平台实现机制

### 结论
三平台**完全独立实现**：macOS 用 `sandbox-exec` + SBPL profile（closed-by-default）；Linux 默认 **bubblewrap**（Landlock 降为 legacy 显式回退），bwrap 内再叠加 `no_new_privs` + seccomp 网络过滤；Windows 用**受限令牌 + 能力 SID + ACL + WFP/防火墙 网络过滤 + 独立桌面 + 专用本地账号 + DPAPI 凭据**。

### 证据

**调度**【源码】`sandboxing/src/manager.rs:36-76`：
`SandboxType { None, MacosSeatbelt, LinuxSeccomp, WindowsRestrictedToken }`；
`get_platform_sandbox(windows_sandbox_enabled)` 按编译目标返回，Windows 只有启用时才返回受限令牌。
`SandboxablePreference { Auto, Require, Forbid }`（:55-60）；`should_sandbox`（:314-333）用 §2 的谓词。
`transform`（:335+）按平台把命令包一层（seatbelt → `sandbox-exec`；linux → `codex-linux-sandbox` helper，携带 `--permission-profile <json>`；windows → 包装器或 None）。

**macOS — Seatbelt**【源码】`sandboxing/src/seatbelt.rs` + `.sbpl` 文件：

- 基础 profile `seatbelt_base_policy.sbpl`（全文 117 行）：**开头就是 `(deny default)`**（closed-by-default），
  再按需 allow：`process-exec/fork`、`signal(target same-sandbox)`、`process-info*`、
  **一份白名单化的 `sysctl-read`**（hw.*/kern.*/vm.loadavg 等）、`iokit-open RootDomainUserClient`、
  `mach-lookup com.apple.system.opendirectoryd.libinfo`、`ipc-posix-sem`、`pseudo-tty`、PTY 规则。
- 网络 profile `seatbelt_network_policy.sbpl`：仅 `AF_SYSTEM socket-protocol 2`、少量 mach-lookups（SecurityServer/networkd/ocspd/trustd/configd）、`net.routetable` sysctl。
- 仅当"全盘可读"时才加 `seatbelt_preferences_policy.sbpl`；`:minimal` 时加 `seatbelt_read_only_platform_defaults.sbpl`（190 行系统路径白名单）。
- 进程态额外允许 `/Applications` 只读、`/tmp /private/tmp /var/tmp` 写（`MACOS_PROCESS_PLATFORM_DEFAULTS`，:28-34）；
  文件系统 helper 态不含这些 scratch（:26-27 注释）。
- **把 `sandbox-exec` 硬编码在 `/usr/bin/sandbox-exec`** 以对抗 PATH 注入【源码】`seatbelt.rs:59-63`。
- 策略生成 `build_seatbelt_access_policy`（:483-583）：产出 `(allow file-read*|file-write* ...)`，
  用 `(require-all (subpath (param "KEY")) (require-not ...))` 实现"允许根 + 排除子路径 + 排除 `.git/.codex` 正则"；
  写根额外追加 `(deny file-write-unlink (require-all (literal (param "KEY")) (vnode-type DIRECTORY)))`（:511-517）防止替换权威边界。
- 组装 `create_seatbelt_command_args_with_profile`（:851-1039）：段序 = base → file-read → file-write → network →（可选 preferences/platform defaults）→ deny-read → **protected ancestor unlink denies 放最后**（:992-1017，注释解释 rename 绕过）；
  参数形如 `-p <policy> -DKEY=VALUE ... -- <cmd>`（:1029-1037）。
- **网络动态策略 `dynamic_network_policy_for_network`（:307-369）**：有代理配置但推不出 loopback 端口 ⇒ **fail closed 返回空策略**（:345-355）；
  网络开且无代理 ⇒ `(allow network-outbound)(allow network-inbound)`（:357-365）；代理模式只放行 loopback 端口 + DNS 53。
- unix socket 白名单 `unix_socket_policy`（:258-292）。

**Linux — bubblewrap 默认，Landlock legacy**【文档】`linux-sandbox/README.md`（原文要点）：

- "**Bubblewrap is the default filesystem sandbox.**"；`bwrap` 优先取 PATH 上（不在 cwd 内）的系统版本，缺失则用 bundled `codex-resources/bwrap`；
  系统 bwrap 太老不支持 `--argv0` 时走 no-`--argv0` 兼容路径；**bwrap 缺失 / 无法创建 user namespace 会在启动时告警**。
- **WSL1 不支持**（无法创建 user namespace）→ codex 在进入 bwrap 前就拒绝沙箱化命令；WSL2 走正常路径。
- "Legacy Landlock + mount protections remain available as an explicit legacy fallback path."，
  用 `features.use_legacy_landlock = true`（或 `-c use_legacy_landlock=true`）强制。
- 激活 bwrap 时：`PR_SET_NO_NEW_PRIVS` + in-process seccomp 网络过滤；`--ro-bind / /` 默认只读；`--bind <root> <root>` 开放可写根；
  受保护子路径（`.git`、resolved `gitdir:`、`.codex`）再 `--ro-bind` 回只读；`--unshare-user --unshare-pid`；网络隔离时 `--unshare-net`；
  受管代理模式用 `--unshare-net` + 内部 TCP→UDS→TCP 桥，桥就绪后 seccomp 封掉新的 AF_UNIX/socketpair；`--proc /proc`。
- glob deny 的展开：优先 `rg --files --hidden --no-ignore --glob <pattern> -- <search-root>`，退化到内置 globset，**其它 rg 失败直接中止装沙箱**。

【源码】`linux-sandbox/src/bwrap.rs:268-295/308-353`：argv 含 `--new-session --die-with-parent --ro-bind/--tmpfs --dev /dev --bind --unshare-user --unshare-pid --unshare-ipc [--unshare-net] --proc --cap-drop ALL`；设计注释在 :365-381。

【源码】`linux-sandbox/src/landlock.rs`：
`set_no_new_privs` = `PR_SET_NO_NEW_PRIVS`（:119-126）；
`install_filesystem_landlock_rules_on_current_thread` 用 `ABI::V5` + `CompatLevel::BestEffort`，全盘只读 + 可写根（:128-163），**注释说明"当前未使用，因为 FS 沙箱由 bubblewrap 做，仅供回退参考"**；
网络 seccomp 模式 `Restricted | ProxyRouted`（:90-117），`should_install_network_seccomp` 对受管网络**即使 DangerFullAccess 也 fail-closed**（:100-103）；拒 `connect/accept/bind/listen/sendto/socket(非 AF_UNIX)`，以 `SIGSYS` 暴露（:169+）。
`linux-sandbox/src/linux_run_main.rs`：`run_main`（:159+）内层阶段装 seccomp/no_new_privs，外层跑 bwrap 后 re-exec 内层；legacy Landlock 路径（:320-330）。
`sandboxing/src/landlock.rs` 只负责把 profile 序列化成 JSON + arg0 = `codex-linux-sandbox`（:6, :23-32）。

**Windows — 受限令牌 + ACL + WFP + 独立桌面 + 专用账号**【源码】`windows-sandbox-rs/`：

- 想跑却**无法强制执行时直接报错拒绝，绝不无沙箱运行**：`sandboxing/src/windows.rs:96-102,113-118,124-129,147-152,163-167,178-183`，
  文案统一 "…refusing to run unsandboxed"。
- Setup（:49-55）：`SETUP_VERSION = 5`、`OFFLINE_USERNAME="CodexSandboxOffline"`、`ONLINE_USERNAME="CodexSandboxOnline"`、
  提权 helper `codex-windows-sandbox-setup.exe`；单飞 `SetupFlight`（:105）。
- 建账号【源码】`bin/setup_main/win/sandbox_users.rs:54-130`：`NetUserAdd(USER_INFO_1)`，`UF_SCRIPT|UF_DONT_EXPIRE_PASSWD`，随机口令；组 `CodexSandboxUsers`；口令用 DPAPI 保护（:422-431）。
- 令牌【源码】`token.rs:448-506`：`CreateRestrictedToken(flags = DISABLE_MAX_PRIVILEGE|LUA_TOKEN|WRITE_RESTRICTED)`；
  restricting SID 顺序 = **Capabilities…, ExtraRestricting…, Logon, Everyone**（:461-477）；
  默认 DACL 刻意**排除只作身份标记的 extra SID**（:496-502）；只启用 `SeChangeNotifyPrivilege`（:504）。
- 能力 SID【源码】`cap.rs:35-136`：为 workspace/cwd/每个 writable root 生成随机 `S-1-5-21-...` 能力 SID，持久化在 `$CODEX_HOME/cap_sid`。
- 独立桌面【源码】`desktop.rs:248-400`：`CreateDesktopW` 建私有桌面 `CodexSandboxDesktop-<rng>`，
  SDDL `D:P(A;;0x..;;;<owner>)(A;;0x..;;;<sandbox_sid>)`，按 (账号, 策略) 复用。
- 禁读【源码】`deny_read_acl.rs` + `deny_read_walker.rs` + `deny_read_resolver.rs`：对词法路径与规范化路径都加 deny-read ACE。
- 隐藏账号【源码】`hide_users.rs:24-30`：写 `Winlogon\SpecialAccounts\UserList` 注册表，让沙箱账号不出现在登录界面。
- 网络过滤 WFP【源码】`wfp/filter_specs.rs`：按 `FWPM_CONDITION_ALE_USER_ID` 作用域，持久化过滤器封 ICMP v4/v6（ALE_AUTH_CONNECT + ALE_RESOURCE_ASSIGNMENT）、
  DNS 53、DoT 853、SMB 445/139（`FWP_ACTION_BLOCK` / `FWPM_FILTER_FLAG_PERSISTENT`）。
- 防火墙【源码】`bin/setup_main/win/firewall.rs:32-193`：`INetFwPolicy2` 规则
  `codex_sandbox_offline_block_outbound` / `..._block_loopback_tcp|udp` / `..._allow_loopback_proxy`，区分 loopback 与非 loopback 远端地址范围。
- 凭据【源码】`dpapi.rs:27-39`：`CryptProtectData` + `CRYPTPROTECT_LOCAL_MACHINE|UI_FORBIDDEN`。
- 档位【源码】`protocol/src/config_types.rs:292-302`：`WindowsSandboxLevel { Disabled(默认), RestrictedToken, Elevated }`；
  `WindowsSandboxProxySettingsMode { Reconcile(默认), Preserve }`（:304-312）。
  配置入口 `core/src/windows_sandbox.rs:19-59`（`elevated`→Elevated，`unelevated`→RestrictedToken；`sandbox_private_desktop` 默认 true）。
  app-server：`WindowsSandboxSetupMode { Elevated, Unelevated }`、`WindowsSandboxReadiness { Ready, NotConfigured, UpdateRequired }`
  （`app-server-protocol/src/protocol/v2/windows_sandbox.rs:19-31`）。
- **旧的 feature flag 已废弃**：`experimental_windows_sandbox`、`elevated_windows_sandbox` 均为 `Stage::Removed`（`features/src/lib.rs:1159-1170`）。

### 对我们的启示
- 我们主战场是 Windows。codex 的 Windows 方案**成本很高但机制可拆**：
  最值得抄的是 **(1) 受限令牌 + 能力 SID（每 workspace/可写根一个随机 SID）** 和 **(2) 无法强制执行时"refusing to run unsandboxed"**。
  专用本地账号 + 独立桌面 + WFP 属"重资产"，我们本轮大概率不做（见 §8）。
- macOS Seatbelt 的 **closed-by-default + 白名单 sysctl + 硬编码工具绝对路径** 是通用思路；
  我们的 PowerShell 检查器同理应"默认拒、白名单放行、工具用绝对路径"。
- Linux 的 **bubblewrap 优先 + 启动期探测告警**（而不是等运行时失败）值得学：我们做托管 venv 预热时同款思路（已决定 SessionStart 预热）。

---

## 4. 审批与提权流程

### 结论
决策链 = **execpolicy 规则引擎**（prefix rule，allow/prompt/forbidden，最严者胜）→ **危险命令检查** → **审批策略**（§1）；
未匹配命令由 `render_decision_for_unmatched_command` 兜底。第一次沙箱内执行被拒后，orchestrator 可发起**提权审批**再"无沙箱重试"（gated by 多种条件，且 deny-read 策略**永不允许逃逸沙箱**）。
存在"按来源类别自动拒绝、不打扰用户"的机制（Granular）。

### 证据

**execpolicy 规则引擎**【文档+源码】`execpolicy/README.md`：Starlark 风格
`prefix_rule(pattern=[...], decision=allow|prompt|forbidden, justification=..., match=..., not_match=...)` + `host_executable(name, paths)`；
**有效决策 = 所有匹配中最严**（`forbidden > prompt > allow`）。
`execpolicy/src/decision.rs:9-23`：`Decision { Allow, Prompt, Forbidden }`。
示例文件 `execpolicy/examples/example.codexpolicy`。

**未匹配命令的兜底决策**【源码】`core/src/exec_policy.rs:735-819`（`render_decision_for_unmatched_command`）：
1. 若命令被判**危险**，或 "Windows 无后端却有受管 FS 限制" ⇒ `Never`→**Forbidden**，其它→**Prompt**（:763-771）；
2. `Never` ⇒ Allow（靠沙箱兜底，:774-778）；
3. `UnlessTrusted` ⇒ Prompt（:779-783）；
4. `OnRequest`/`Granular`：FS 不受限⇒Allow；Restricted 且**未请求沙箱覆写**⇒Allow（靠沙箱，不打扰用户），请求覆写⇒Prompt（:784-817）。

**Granular 的"直接拒绝"**【源码】`core/src/exec_policy.rs:216-238`（`prompt_is_rejected_by_policy`）+
原因常量 :47-52：`rules=false` ⇒ 规则类 prompt 直接 Forbidden；`sandbox_approval=false` ⇒ 沙箱类 prompt 直接 Forbidden；`Never` ⇒ 一律 Forbidden。

**规则文件加载**【源码】`core/src/exec_policy.rs`：`<config_folder>/rules/*.rules`（`RULES_DIR_NAME`/`RULE_EXTENSION`，:53-54）+ requirements 覆盖层（:645-699）；
默认路径 `$CODEX_HOME/rules/default.rules`（:831-833）；
运行时修正（amendment）：追加 allow prefix 规则（:447-495）与网络规则（:497-541）；一次性迁移清理旧的 banned 规则（`execpolicy/src/sandbox_migration.rs`）。

**防"包装器绕过"**【源码】`core/src/exec_policy.rs:56-125+`（`BANNED_PREFIX_SUGGESTIONS`）：
`bash/sh/zsh -c|-lc`、`env`、`node -e`、`python -c`、`cmd /c|/k`、`powershell/pwsh -Command|-EncodedCommand|-File|-c|-e`、
`git`、`npm run`、`osascript`、`perl -e`、`php -r` … **永远不能作为可建议保存的前缀规则**——这堵住了"用 shell 包一层绕过检查"。

**每命令权限与提权语义**【源码】`protocol/src/models.rs:49-82`：
`SandboxPermissions { UseDefault, RequireEscalated, WithAdditionalPermissions }`；
`default_exec_approval_requirement`【源码】`core/src/tools/sandboxing.rs:194-230`：
`Never`⇒Skip；`OnRequest`/`Granular` 且 FS=Restricted⇒需审批；`UnlessTrusted`⇒总是需审批；Granular 且 `sandbox_approval=false`⇒**Forbidden**。
`sandbox_override_for_first_attempt`（:238-267）；**`unsandboxed_execution_allowed`（:275-279）= 无 deny-read 限制**——
有 deny-read 时**禁止逃逸沙箱**（:272-274 注释：否则会静默放开被禁读取）；`sandbox_permissions_preserving_denied_reads`（:281-295）会把 `RequireEscalated` 降回 `UseDefault`；
`Approvable::wants_no_sandbox_approval`（:330-337）：Granular⇒看 `sandbox_approval`。

**沙箱被拒后的提权重试**【源码】`core/src/tools/orchestrator.rs:305-460`：
首次沙箱尝试 → 命中 `SandboxErr::Denied` → 若 `escalate_on_failure`、且策略允许（`wants_no_sandbox_approval`）、且 `unsandboxed_allowed`/网络上下文允许
→ 发起审批（`request_approval`，带 `retry_reason = build_denial_reason_from_output(...)` 或网络阻断文案，:397-437）
→ 第二次**无沙箱**尝试（:440-460）。`should_bypass_approval`：已批准过 或 `Never`（:315-321）。

**失败/拒绝如何回给模型**：审批是工具调用的一等返回（`ApprovalAction`/拒绝会让工具返回 Rejected），
沙箱拒绝则包成 `CodexErr::Sandbox(SandboxErr::Denied{output,..})` 回给模型（见 §5），模型可据此改用 `require_escalated` 重试。

**模型侧提示词**（逐字可引用）【源码】`prompts/templates/permissions/approval_policy/{never,on_request,on_request_rule_request_permission,unless_trusted}.md`
与 `prompts/templates/permissions/sandbox_mode/{read_only,workspace_write,danger_full_access}.md`；
组装器 `prompts/src/permissions_instructions.rs`（生成 `<permissions instructions>`）。
`on_request.md` 明确告诉模型：分段按 shell 控制符切分、每条独立评估；`require_escalated` + `justification`；banned prefix 规则示例。

**shell 级别的提权拦截（zsh）**【文档】`shell-escalation/README.md`：
补丁版 zsh 通过 `EXEC_WRAPPER` 拦截 `execve`，走 `CODEX_ESCALATE_SOCKET` 协议，服务端回 `Run` / `Escalate`（转发 FD 到沙箱外跑，回传退出码）/ `Deny`（stderr 报错 + exit 1）；
补丁在 `patches/zsh-exec-wrapper.patch`。实现 `shell-escalation/src/unix/{escalate_protocol,escalation_policy}.rs`。

### 对我们的启示
- **决策优先级链直接可借**：规则引擎（数据）→ 危险命令（启发式）→ 审批策略（用户意图）→ 沙箱（兜底）。我们 AGENTS.md 的"能力是数据"正对应 codex 的 `rules/*.rules`——**加规则=加文件，零代码**。
- **`BANNED_PREFIX_SUGGESTIONS` 必须抄**：我们要开放 powershell 时，"允许保存 `pwsh -Command` 前缀"等于自毁权限门。
- **"deny-read 时禁止逃逸沙箱"**（`unsandboxed_execution_allowed`）是非常关键的诚实性设计：提权不能悄悄解除 deny 规则。我们的 PowerShell 提权必须遵守同一条。
- codex 的"第二次无沙箱重试"属高风险设计；我们第一版**宁可不做自动重试**，只做"拒绝→告诉模型→模型显式申请提权"。

---

## 5. 降级与诚实性

### 结论
整体**fail-closed**：无法强制执行时宁可报错/拒绝，也不静默降权。检测沙箱拒绝用**退出码 + 关键词启发式**（非确定性，源码注释承认）；
违规记录成结构化事件（含后端、原因、路径、输出片段）；用户可见错误会展示原始命令输出。
bwrap 缺失/Landlock 不可用/WSL1 等**启动期告警 + 运行时拒绝**，不静默降级。

### 证据

**沙箱拒绝检测**【源码】`sandboxing/src/denial.rs:13-72`：
`is_likely_sandbox_denied`：先看 executor-managed 关键词；`QUICK_REJECT_EXIT_CODES=[2,126,127]` 视为**非沙箱**失败（:25-28）；
LinuxSeccomp 专属 `exit==128+SIGSYS`⇒true（:30-39）。
关键词表 :50-58：`operation not permitted`/`permission denied`/`read-only file system`/`seccomp`/`sandbox`/`landlock`/`failed to write file`。
源码注释坦承"**没有完全确定性的办法**"。**启示：这套只能当启发式，不能当安全边界。**

**违规事件**【源码】`sandboxing/src/violation.rs`：
`SandboxViolationEvent { FileSystem, Network }`（:41-44）；
`SandboxViolationBackend { LinuxSandbox, ManagedNetworkProxy, Seatbelt, WindowsSandbox }`（:48-64）；
`FileSystemSandboxViolation { backend, reason, path, output_snippet }`（:68-73）；
`FileSystemSandboxViolationReason { OperationNotPermitted, PermissionDenied, ReadOnlyFileSystem, PolicyDenied, FailedToWriteFile, SignalSyscall }`（:77-97）；
`NetworkSandboxViolation`（:101-131，来自 `BlockedRequest`）；`OUTPUT_SNIPPET_MAX_CHARS = 512`（:9）；记录走 `warn!`。

**错误类型**【源码】`protocol/src/error.rs:37-68`：
`SandboxErr { Denied { output, network_policy_decision }, SeccompInstall, SeccompBackend, Timeout, Signal, LandlockRestrict }`；
`get_error_message_ui`（:831-865）把命令输出呈现给用户。

**平台不可用时的 fail-closed 实例**：
- Windows：无后端却要受限 ⇒ 报错拒绝（§3，`sandboxing/src/windows.rs` 多处 "refusing to run unsandboxed"）。
- Linux：WSL1 明确拒绝；bwrap 缺失/无 user namespace **启动告警**（`sandboxing/src/bwrap.rs:16-27` 的 `MISSING_BWRAP_WARNING`/`USER_NAMESPACE_WARNING`/`WSL1_BWRAP_WARNING`）。
- macOS：代理配置存在但推不出端口 ⇒ 空网络策略（§3）。
- `SandboxEnforcement`（`protocol/src/models.rs:264-286`）让"是我们隔离 / 不隔离 / 外部隔离"对上层**显式可见**；
  SessionConfiguredEvent 携带 `approval_policy / approvals_reviewer / permission_profile / active_permission_profile / network_proxy`（`protocol/src/protocol.rs:3842-3968`）。

**进程加固**【源码】`process-hardening/src/lib.rs`：
`pre_main_hardening()`（:12）→ Linux `PR_SET_DUMPABLE 0`（:44-60）+ 清 `LD_*`；macOS `PT_DENY_ATTACH`（:82-99）+ 清 `DYLD_*`；`RLIMIT_CORE=0`（:109-115）；
**Windows 分支是 TODO 空实现**（:120-121）。

**分析埋点**：`analytics/src/events.rs:626 SandboxDenied`；`core/src/exec.rs:745-804` 把检测结果映射成 `CodexErr::Sandbox(Denied)`。

### 对我们的启示
- **"诚实上报"应成为我们的硬要求**：拒绝检测只是启发式，所以必须让模型看到原始输出（我们会话里的 PowerShell 报错同款做法），
  并把 `SandboxEnforcement` 这类"到底有没有隔离"的标志放进会话事件。
- codex 的 **"命令找不到要响亮失败"**（对我们 AGENTS.md §7）与它的"无后端拒绝运行"同源：**绝不用静默降级掩盖能力缺失**。
- 值得抄的最小集：违规事件类型（后端/原因/路径/片段）+ 512 字符裁剪。

---

## 6. 危险命令检查（对照 WorkBuddy 的 iex/Add-Type 拦截）

### 结论
**有**，且不止一处：`shell-command/src/command_safety/` 同时做 POSIX 与 Windows 的"危险命令"启发式，
并对 PowerShell 做**tree-sitter 降级解析且 fail-closed**；但 codex **没有**硬编码 `Invoke-Expression`/`Add-Type` 黑名单——
它靠"启发式 + 未匹配默认 Prompt + banned prefix 规则"三件套，而不是关键词表。

### 证据

**通用危险命令**【源码】`shell-command/src/command_safety/is_dangerous_command.rs`：
`DangerousCommandMatch { ForcedRm, Other }`（:9-14）；`MAX_DANGEROUS_COMMAND_WRAPPER_DEPTH = 8`（:16）防嵌套包装；
`dangerous_command_match`（:19）处理 `rm -f`、`sudo`、`env`、`trap`、嵌套 shell `-c` 的字面量抽取；
`dangerous_powershell_words_match`（:56）。

**Windows 专用**【源码】`shell-command/src/command_safety/windows_dangerous_commands.rs:8-200`：
覆盖"带 URL 的 ShellExecute 路径"（`Start-Process`、`Invoke-Item`、`Shell.Application/ShellExecute`、`rundll32 url.dll,FileProtocolHandler`、
`mshta`、浏览器可执行文件、`explorer`+URL）、`cmd /c start <url>`、
强制删除（`del /f`、`Remove-Item -Force`、`rd /s /q`）、CMD 操作符拆分（`&`/`&&`/`||`，含无空格粘连）。
测试用例从 :415 起，覆盖大小写、分号、括号块、别名 `ri/rm` 等。

**PowerShell 解析两条路**【源码】`shell-command/src/command_safety/`：
- `powershell_tree_sitter.rs`（生产路径）：注释"**fail closed for everything else**"——
  "Unknown syntax, parse recovery, and dynamic expressions fail closed instead of being guessed"（:8-11）。
  它是**字面量子集降级器**，看不清 `Invoke-Expression` 里的动态内容（源码注释亦如此定位）。
- `powershell_parser.rs` + `powershell_parser.ps1`（真 PowerShell AST 子进程）：**只作 test oracle，不进生产**【源码】`command_safety/mod.rs:1-5`。

**是否硬编码 iex/Add-Type？** 【源码】全仓 rg `Invoke-Expression|Add-Type|IEX` → **零命中**；
只有 `-EncodedCommand`/`-Command`/`-File` 出现在 `BANNED_PREFIX_SUGGESTIONS`（§4）。
⇒ **未验证**存在针对 `iex`/`Add-Type` 的显式拦截；**结论是 codex 用"默认 Prompt + 禁前缀"间接压制，而非黑名单**。

### 对我们的启示
- 这正是我们 AGENTS.md 里"**启用 powershell 的前置条件：先有危险命令检查器**"的现成参照实现——
  `command_safety/` 三个文件（危险命令启发式 + Windows 变体 + tree-sitter fail-closed 降级）几乎可直接移植为我们的第一版检查器。
- **别只做关键词黑名单**：codex 的经验是"**不确定就 fail-closed（默认 Prompt）+ 禁掉可包装的 shell 前缀**"。WorkBuddy 的 `iex`/`Add-Type` 关键词拦截易被编码/拼接绕过，codex 的思路更稳。
- 但也要注意 codex 检查器的**已知盲区**：它看不清 `Invoke-Expression` 的动态字符串——所以我们自己的检查器必须写明能力边界，不能声称"完全拦截"。

---

## 7. 网络隔离细节（旧笔记完全没覆盖）

### 结论
默认**禁网**（`NetworkSandboxPolicy::Restricted` / `network_access=false`），要开需显式。
开关之上还有一层**本地网络策略代理**（HTTP 3128 / SOCKS5 8081，默认启用），提供 allowlist-first、deny-wins、limited 只读模式、MITM、凭据 broker、**SSRF/内网拦截**。
各平台用不同手段强制"只能走代理"：Linux `--unshare-net` + seccomp，macOS loopback 端口白名单，Windows 防火墙 + WFP。

### 证据

【文档】`network-proxy/README.md`（大量逐字可引用）：

- 跑 **HTTP 代理 `127.0.0.1:3128`** 与 **SOCKS5 `127.0.0.1:8081`（默认启用）**；Windows 偏好 3128-3159 / 8081-8112，端口占用则退化 ephemeral loopback。
- **allowlist-first**："If no domain entries are marked `allow`, the proxy blocks requests until an allowlist is configured."；
  域名模式 `*.example.com`（仅子域）/`**.example.com`（apex+子域）；**全局 `*` 被拒**。
- **deny wins**："`domains` entries marked `deny` always override the allowlist."
- **mode = "full" | "limited"**（limited = 只 GET/HEAD/OPTIONS；HTTPS CONNECT 与 SOCKS5 `:443` 需 MITM 才能强制方法策略，否则阻断；SOCKS5 UDP 一律阻断）。
- **MITM**：CA 私钥只在代理内存；启用 MITM 时子进程拿到 `$CODEX_HOME/proxy/` 下的公共 CA bundle；`mitm.hooks` 配 host+methods+path_prefixes → 命名 `actions`（如 `strip_auth`）；HTTPS 用 rustls（rama-tls-rustls）。
- **SSRF/内网拦截**：`allow_local_binding = false` 时"blocks loopback and common private/link-local ranges"；
  "**Hostnames that resolve to local/private IPs are still blocked even if allowlisted (best-effort DNS lookup)**"；
  明确承认局限："**DNS rebinding is hard to fully prevent**"，建议在更低层（防火墙/VPC）再兜一层。
- **监听安全**：非 loopback 绑定默认被夹回 loopback（`dangerously_allow_non_loopback_proxy=false`）；启用 unix socket 代理时所有监听强制 loopback。
- 阻断响应：`403` + `x-proxy-error` ∈ `blocked-by-allowlist|denylist|method-policy|policy`。
- **凭据 broker**：`[permissions.*.network] enabled` + 环境变量虚拟化。
- OTEL 审计：`target=codex_otel.network_proxy`，事件 `codex.network_proxy.policy_decision`（含 decision/source/reason、协议、host/port；**故意不记录完整 URL/path/query**）。

【源码】`network-proxy/src/policy.rs:33-97`：`is_loopback_host` / `is_non_public_ip`——
覆盖 loopback、私网、link-local、CGNAT `100.64/10`、`192.0.0/24`、TEST-NET、`198.18/15`、`240/4`、IPv6 ULA/LL/loopback。
【源码】`network-proxy/src/connect_policy.rs:62-124`：`TargetCheckedStreamConnector` 在**TCP connect 时**校验，
非公网 IP 且未 allowlist ⇒ 拒绝（"network target rejected by policy"）；**解析后是私网的域名不匹配 allowlist 主机名**。
【源码】`network-proxy/src/credential_broker.rs`：子进程只见 **dummy** 值（`virtualize_child_env` :139-191），
真值只在匹配 host 的出站请求头注入（`inject_request_headers`），工具输出再还原/脱敏（`restore_child_env` :193-250）。
【源码】`secrets/src/sanitizer.rs`：`redact_secrets` 正则族（`sk-…`、`AKIA…`、Bearer、`api_key/token/secret/password=`）。

**特性门控**：`network_proxy` 是 `Stage::Experimental { default_enabled: false }`（`features/src/lib.rs:1191-1197`）；
仅当网络策略启用时才真正开（`core/src/config/mod.rs:3612-3622`）。

### 对我们的启示
- 我们的 **web-fetch 内网拦截方向一致**，但 codex 更系统：**代理层 + 传输层双重校验**，且诚实标注 DNS rebinding 局限。
- 若我们将来要让 agent 用 `Invoke-WebRequest`/`curl`，**"默认禁网 + allowlist-first + deny-wins + limited 只读"** 是可直接照搬的策略词汇。
- **凭据 broker 的"环境变量虚拟化 + 出站注入"** 是很值得抄的点：让子进程永远拿不到真密钥，只在受控出口注入。这对我们做办公 Agent 处理用户凭据尤其重要。
- 审计事件"**故意不记录完整 URL**"是隐私与安全的好折中。

---

## 8. 值得抄的机制 vs 明显不能抄/成本过高的部分

### 值得抄（按性价比排序）

1. **两个正交轴 + `GranularApprovalConfig` 的"按来源直接拒绝"**【源码 §1】——类型设计成本低、表达力强。
   理由：这是我们 AGENTS.md 已选定的方向，codex 给了成熟字段切分。
2. **能力是数据：`rules/*.rules` 规则文件**【源码 §4】——"加规则=加文件"。
   理由：与 AGENTS.md §三"能力是数据不是代码"完全同构，可直接落 `resources/`。
3. **危险命令检查器 `command_safety/`**【源码 §6】——我们启用 powershell 的前置件。
   理由：AGENTS.md 明确要求"先有危险命令检查器才能开 powershell"，codex 是现成参照。
4. **`BANNED_PREFIX_SUGGESTIONS` 反包装列表**【源码 §4】——防"shell 包一层"绕过。
   理由：成本极低、收益极高，是权限门的底座。
5. **"无法强制执行就拒绝运行" + 结构化违规事件 + `SandboxEnforcement` 显式上报**【源码 §5】。
   理由：与我们"不写防御性兜底掩盖上游问题、让它响亮失败"的约定一致。
6. **网络代理策略词汇**（默认禁网 / allowlist-first / deny-wins / limited 只读 / SSRF 内网拦截 / 凭据虚拟化）【源码/文档 §7】。
   理由：词表可直接用于我们的 web-fetch/命令网络策略。
7. **`sandbox-exec` 用绝对路径、closed-by-default + 白名单** 等"默认最小权限"套路【源码 §3】。
   理由：平台无关的安全默认。

### 不能抄 / 成本过高

1. **Linux bubblewrap + Landlock + seccomp 整套**：我们主战场是 Windows；即便做 Linux 也属"用现成库/容器"，不自研。
2. **Windows 专用本地账号 + 独立桌面 + WFP 持久过滤器 + 防火墙 COM 编排**（`windows-sandbox-rs` 所谓"重资产"）：
   setup 需**提权**、要建系统账号、改注册表隐藏账号、装持久 WFP——对办公 Agent 属"安装即改变系统配置"，风险与维护成本都高。
   **可抄其"受限令牌 + 能力 SID"内核，不抄账号/桌面/防火墙套件。**
3. **zsh 打补丁拦截 `execve`**（`shell-escalation`）：需自带补丁版 zsh、跨平台分发成本极高；且我们不用 bash/zsh。
4. **自动"第二次无沙箱重试"**：风险高，第一版不做（见 §4 启示）。
5. **MITM 代理 + 凭据 broker 全量实现**：设计值得抄，但完整实现（rustls/rama、hooks、SOCKS5 UDP、Windows 端口协调）成本高；
   我们可在需要时先做"默认禁网 + 简单 allowlist 代理"。

### 旧笔记（`09-sandbox-and-permissions.md` §四）需更正的点

- **(a) 不止 `SandboxMode`**：运行时真正承压的是 `PermissionProfile`（文件系统/网络拆分）+ `SandboxEnforcement`；`SandboxMode` 只是配置入口。
- **(b) 审批默认值**：`AskForApproval` 类型默认是 `on-request`，但**配置解析是信任相关的**（trusted→on-request，untrusted→untrusted）且 **`untrusted` 现在是 config 硬错误、已从 schema 移除**。
- **(c) Windows 沙箱不再是实验 feature**：旧的 `experimental_windows_sandbox`/`elevated_windows_sandbox` 已 `Stage::Removed`；
  新入口是 `[windows] sandbox = elevated|unelevated` + `WindowsSandboxLevel` + 独立提权 helper exe + 专用本地账号。
- **(d) 完全漏掉网络代理**：3128/8081、MITM、凭据 broker、SSRF/内网拦截。
- **(e) 漏掉 shell 提权协议（zsh EXEC_WRAPPER）与 `BANNED_PREFIX_SUGGESTIONS` 反包装列表。**

---

## 附：证据缺口（未验证）

- `windows-sandbox-rs/src/acl.rs`（28KB）与 `allow.rs`/`spawn_prep.rs`/`wrapper.rs` 的**具体 ACL 授权/拒绝流程**未逐行读；本文只标注其存在与角色。
- `core/src/tools/network_approval.rs`（约 45KB）**网络阻断审批流**未细读。
- `guardian-context/`（`approvals_reviewer=auto_review` 的 subagent 上下文）只读了存在性与用途。
- `exec-server/`（92 文件）只确认其**复用同一 `PermissionProfile` + `SandboxManager`**（`fs_sandbox.rs:134`、`process_sandbox.rs:187` 用 `SandboxablePreference::Require`），未展开。
- `windows-sandbox-rs` 中除 token/cap/desktop/hide_users/dpapi/wfp/firewall 外的文件未逐个核对。
- 关于"是否存在针对 `iex`/`Add-Type` 的显式拦截"：**全仓 rg 零命中**，判为"无显式黑名单"，但**不能 100% 排除**在未读文件中的间接处理。
