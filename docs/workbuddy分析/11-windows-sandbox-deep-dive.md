# 真沙箱调研：三方实现深挖 + Node/Electron 技术选型（2026-09-14）

> 关联：延续并深化 `09-sandbox-and-permissions.md`（2026-09-08，当时是「搁置」结论）——
> 该文档指出「Windows 沙箱有两份独立实现，codex 与 dsh 各一份，机制都是受限令牌 + ACL」，
> 本轮把三家**实现细节**挖到底，并补上「**Node/Electron 侧能不能做、怎么做**」的选型调研。
> 旧笔记里的「WorkBuddy = 内核态过滤驱动 tsbx.dll」与「dsh 的 Windows 沙箱不可借鉴」
> 两处结论在本轮被**修正**（见 §4 与 §6）。

证据等级标注：**【一手】** = 本轮亲自读源码/二进制取证，附文件路径与行号；
**【官方文档】** = 微软 / Node / Electron 官方文档或 release notes；
**【项目源码】** = 第三方开源仓库（npm/GitHub）自述与代码；
**【推断】** = 由多处实证推导，无单点直证；**「未找到证据」** = 明确检索过而无结果。

---

## 0. 一句话结论

**三家在 Windows 上收敛到同一个原语：受限令牌（restricted token，WRITE_RESTRICTED 标志）+ 基于 SID 的 ACL；分水岭只有两条 ——「是不是用专用沙箱账号」「网络/读隔离做不做」。**
OpenAI 与 Anthropic 都选择「提权安装 + 专用账号 + WFP 防火墙」换**读隔离 + 断网**；
DeepSeek（dsh）选择「复制调用者自己的令牌、零安装、不提权」换**易集成**，代价是**只限写、无网络隔离**。
而**最利于我们**的是：dsh 的实现是**纯 TypeScript + koffi**，不依赖 Rust，且是 MIT 开源（AGENTS.md §6 已授权内部使用）——**这不是"思路可借鉴"，而是"可以整包搬进来"的量级差异。**

---

## 1. 机制内核：受限令牌 + ACL（三家收敛处）

### 1.1 受限令牌是什么、为什么强

受限令牌对每次访问做**两次访问检查**：正常访问检查（用户的 SID、组的 SID）一次，
**restricting SID 列表**又一次 —— **两次都通过，访问才被授予**。
配合 `WRITE_RESTRICTED` 标志时，restricting SID 的交集只作用于**写**访问（这正是
dsh 的 `sandbox-windows-acl` 能「只限写」、却又承认自己读不到凭据的原因）。

微软官方同时确认：**“受限版自己主令牌”调用 `CreateProcessAsUser` 不需要
`SE_ASSIGNPRIMARYTOKEN` 特权** —— 这是「零安装做写隔离」的理论基础
【官方文档：Restricted Tokens】。

### 1.2 三家各自怎么用这个原语

| | codex | dsh | WorkBuddy |
|---|---|---|---|
| **令牌来源** | 专用沙箱账号（Online/Offline）的令牌，再 `CreateRestrictedToken` 派生；`CreateProcessWithLogonW` 登录账号 | **只复制调用者自己的进程令牌**，再 `CreateRestrictedToken` 派生 | 无受限令牌（零命中）；自研 Rust 栈 |
| **create 标志** | `DISABLE_MAX_PRIVILEGE \| LUA_TOKEN \| WRITE_RESTRICTED`【一手：`codex-rs/windows-sandbox-rs/src/token.rs:42-47,480`】 | 同上【一手：`deepseek-harness/packages/sandbox/sandbox-windows-acl/src/token.ts:195-222`】 | — |
| **restricting SID** | capability SIDs（按 cwd/write-root 分桶的随机 SID）+ logon SID + Everyone【一手：`token.rs:461-477`】 | logon SID + Everyone + workspace 写 SID + 私有 temp SID【一手：`token.ts:203-207`】 | — |
| **默认 DACL** | `SetTokenInformation(TokenDefaultDacl)` 设宽松 DACL（否则 PowerShell 建管道 ACCESS_DENIED）【一手：`token.rs:54-107`】 | 同款（dsh 有命名 temp/workspace SID）【一手：`token.ts:112-145,297`】 | — |
| **特权调整** | `AdjustTokenPrivileges` 打开 `SeChangeNotifyPrivilege`【一手：`token.ts:319-348,504`】 | 同款 | — |
| **启动 API** | elevated：`CreateProcessWithLogonW` 起 runner【一手：`elevated/runner_client.rs:354`】；legacy：`CreateProcessAsUserW`【一手：`process.rs:152`】 | `CreateProcessAsUserW`【一手：`spawn.ts:269-357`】 | spawn `sandbox-cli.exe` 的 IPC |
| **进程树管理** | Job Object（kill-on-close）【一手：`process.rs:105`】 | Job Object（先 CREATE_SUSPENDED 挂 Job 再 ResumeThread 收孤儿）【一手：`spawn.ts:269-357`】 | 未找到显式进程树证据（env 变量继承） |

### 1.3 写权限怎么实现：「能力 SID + 显式 ACE」

- **SID 怎么来**：dsh 是 `S-1-4-x-y`，由 **workspace 路径确定性哈希**（SHA-256）派生，
  每台机器每个工作区一个身份【一手：`sandbox-windows-acl/src/workspace-sid.ts:35-40`】。
  codex 是**随机 SID**、按 cwd/write-root 分桶，持久化到 `CODEX_HOME/cap_sid`
  【一手：`cap.rs:39-46`】。
- **ACE 打在哪些对象上**：工作区目录 + 会话私有 temp 目录（codex 还有
  `\\.\NUL` 设备授权，用于 stdout/stderr 重定向【一手：`acl.rs:759-820`】）。
- **一个必须抄的规则**：codex **刻意不对父目录授 `FILE_DELETE_CHILD`**，改为对**子项**逐个
  授 `DELETE` —— 否则父目录的 `DELETE_CHILD` 会绕过子项上的 deny【一手：`acl.rs:356-360`】。
- **幂等判定**：两家都实现「先 `GetNamedSecurityInfoW` 读 DACL，命中精确 ACE 则跳过
  `SetNamedSecurityInfoW`」——大工作区全量传播要几十秒【一手：
  dsh `acl.ts:196-213 hasExactGrant`；codex `acl.rs:71-230`】。

---

## 2. codex（OpenAI）· 深挖 `windows-sandbox-rs`

> 本仓库 `开源项目/codex/codex-rs/windows-sandbox-rs/`，约 **67 个源文件 / ~21,277 行**。

### 2.1 架构与角色

| 文件 / 二进制 | 职责 | 证据 |
|---|---|---|
| `codex-windows-sandbox-setup` | 一次性**提权安装**（UAC） | `bin/setup_main/main.rs:5-7` |
| `codex-command-runner` | **仅 elevated 路径**：连 IPC 命名管道、以沙箱账号派生受限令牌、`CreateProcessWithLogonW` 起命令、ConPTY/管道回传 | `bin/command_runner/win.rs:1-8` |
| `codex.exe --run-as-windows-sandbox` | 直连 spawn 的调用方用 | `wrapper.rs:20,132` |

两个 windows 绑定 crate 并用：`windows 0.58` 仅用于防火墙 COM，其余 26 个 feature 全走
`windows-sys 0.52`；**未用 winapi**【一手：`Cargo.toml:42-93`】。

**重要细节**：setup 的 manifest 是 `asInvoker`，**不是 requireAdministrator**——
提权由调用方用 `ShellExecuteExW(verb="runas")` 主动触发 UAC【一手：
`codex-windows-sandbox-setup.manifest:6`、`build.rs:19-34`、`setup.rs:974-985`】。

### 2.2 一次性 setup 做了什么

由 `run_setup_full`【一手：`bin/setup_main/win.rs:756`】编排：

1. 建本地组 `CodexSandboxUsers`（`NetLocalGroupAdd`，容忍 `ERROR_ALIAS_EXISTS`）；
2. 建两个专用本地用户 `CodexSandboxOffline` / `CodexSandboxOnline`
   （`NetUserAdd`，`USER_PRIV_USER`、`UF_SCRIPT|UF_DONT_EXPIRE_PASSWD`；失败则 `NetUserSetInfo` 重置密码 = 幂等）
   【一手：`sandbox_users.rs:54-215`】；
3. 密码 = **24 字符随机**，DPAPI 机器级加密（`CryptProtectData` + `CRYPTPROTECT_LOCAL_MACHINE`）
   落盘 `CODEX_HOME/.sandbox-secrets/sandbox_users.json`【一手：`sandbox_users.rs:366,405-462`；
   `dpapi.rs:20,54`】；
4. 隐藏账号（写 `Winlogon\SpecialAccounts\UserList` 注册表 + profile 目录设 Hidden/System）
   【一手：`hide_users.rs:23-24,76-105,133-157`】；
5. 配置**离线网络**（防火墙 COM + WFP，见 §2.5）；
6. 同步施加 **deny-read ACE**（见 §2.3）；
7. 后台 helper 施加 **read 根授权**（命名互斥量 `Local\CodexSandboxReadAcl` 去重）【一手：`spawn_read_acl_helper`，`read_acl_mutex.rs:14,45`】；
8. 对每个 write 根**授予 capability SID 写权限**（多线程并发）【一手：`win.rs:851-951`】；
9. 对 deny-write carveout（`.git`/`.codex`/`.agents` 等）施加 deny-write ACE，缺失路径**先物化成目录再打 deny**（防沙箱稍后自建该路径绕过）【一手：`win.rs:953-1004`】；
10. `lock_sandbox_bin_dir` / `lock_persistent_sandbox_dirs`【一手：`win.rs:663-726`】。

**幂等性**：`prepare_setup_marker` 先删旧文件再以受保护 ACL 建**空** marker（空文件会让
readiness 失败），全部成功才 `commit_setup_marker` 写内容；`SETUP_VERSION = 5`，
版本不符触发重装【一手：`sandbox_users.rs:464-584`】。

**卸载逻辑**：**未找到** —— 全 crate 无删除用户/组/防火墙规则/WFP filter 的 uninstall 函数。
旧格式 `sandbox_users.json` 会被删除，登录失败时删文件以便重建【一手：`win.rs:700-703`；
`identity.rs:100-111,289`】。

### 2.3 读禁区的递归处理（deny-read 是独立的一整套）

- **词法 + canonical 双路径**：`plan_deny_read_acl_paths` 同时规划词法路径和已存在时的
  canonical 目标，防 reparse point 从另一处读到同一对象【一手：`deny_read_acl.rs:11-28,18`】；
- **缺失路径先物化再 deny**：对不存在的路径先 `mkdir` 再打 deny（防沙箱稍后自建绕过）；
  失败时**回滚本次已加的 deny**【一手：`deny_read_acl.rs:51-72`】；
- **跨运行持久化**：每个 SID 已施 ACE 的路径持久化到 `deny_read_acl_state.json`，
  先应用新集合再撤销陈旧路径【一手：`deny_read_state.rs:15,32-56`】；
- **glob 展开**：先用 **ripgrep**（`rg --files --hidden --no-ignore --glob ... --null`）枚举，
  rg 缺失或返回码 2 退回自实现遍历；扫描根取「首个通配符前的字面目录前缀」
  【一手：`deny_read_resolver.rs:31,73-95,100-165,211-246`】；
- **性能**：walker 受 `max_depth` 限制、不可访问分支跳过、普通目录不逐个 stat/canonicalize、
  缓存 canonical 父目录防环、reparse point 显式解析目标【一手：`deny_read_walker.rs:40-147`】。

### 2.4 私有桌面（desktop.rs）

- 名字前缀 `CodexSandboxDesktop-`，`CreateDesktopW` 创建并缓存复用
  【一手：`desktop.rs:66,254,308,352`】；
- 根因：**受限令牌下某些进程（如 PowerShell）若不设 `lpDesktop` 会
  `STATUS_DLL_INIT_FAILED`**【一手：`process.rs:121-124`】；
- 共享桌面给调用者真实用户 SID 全权 + 沙箱 SID participant
  （`CreateProcessWithLogonW` 会共享调用者 logon SID）【一手：`desktop.rs:280-296`】。

### 2.5 网络隔离（三层，且只对 elevated/离线身份生效）

1. **Windows 防火墙 COM 规则**，按用户 SID 定向：`SetLocalUserAuthorizedList` 限定账号，
   阻断该账号所有非环回出站；只放行配置的代理端口；**回读校验** SID 写入成功；
   本地策略被 GPO 覆盖则判 `HelperFirewallPolicyIneffective`【一手：
   `bin/setup_main/win/firewall.rs:55-156,237-270,363-389`】；
2. **WFP 持久过滤器**：按账号 SID 阻断 **ICMP v4/v6、DNS 53、DoT 853、SMB 445/139**
   【一手：`src/wfp.rs:79`；`src/wfp/filter_specs.rs:25-123`】；
3. **离线身份选择**：`proxy_enforced || 网络未启用` → 用 `CodexSandboxOffline` 账号
   【一手：`setup.rs:712-721`】。

**legacy（unelevated）后端**：只有环境变量投毒（`HTTP_PROXY=http://127.0.0.1:9`、
`GIT_SSH_COMMAND=cmd /c exit 1`、PATH 前置 `ssh/scp` 假 stub）——**不是安全边界，
可被显式取消环境变量或直连 IP 绕过**【一手：`src/env.rs:126-177`】。
**Windows 上的「读受限」只有 elevated 后端支持，legacy 受限令牌做不到**【一手：
`lib.rs:546-554`、`unified_exec/backends/legacy.rs:341-348`】。

### 2.6 「人人可写目录」警告

`WindowsWorldWritableWarningNotification { sample_paths, extra_count, failed_scan }`
【一手：`app-server-protocol/src/protocol/v2/windows_sandbox.rs:10-14`】；
扫描器 `audit_everyone_writable` 扫 CWD 直属子目录 + 候选根（TEMP/USERPROFILE/PUBLIC/PATH/
`C:\`/`C:\Windows`）及其下一层；发现即**直接施加 capability deny-write ACE** 并上报
【一手：`src/audit.rs:96,221,250-295`】；
已知局限：只扫一层、限时 2s、上限 5 万项、不可读 ACL 一律当作不可写【一手：`audit.rs:29-31,105-119`】。

### 2.7 三档沙箱模式在 Windows 的映射

| 模式 | 动作 | 证据 |
|---|---|---|
| `read-only` | 令牌只带 readonly capability SID + logon/Everyone restricting；read 根授读/执行；**write 根为空 → 不授任何写 ACE**；仅 **elevated** 后端支持 | `resolved_permissions.rs:39-79,140-181`；`bin/setup_main/win.rs:560-563` |
| `workspace-write` | write 根（cwd + 额外 writable_roots + TEMP/TMP）授该根 capability SID 的 `READ\|WRITE\|EXECUTE\|DELETE`；read 根授读；对只读 carveout 与 `.git`/`.codex`/`.agents` 施加 deny-write ACE | 同上；`spawn_prep.rs:301-305` |
| `danger-full-access` | **不走 Windows 沙箱**（不设 ACL、不加令牌、直接执行） | `resolved_permissions.rs:39-60`；`core/src/exec.rs:490` |

### 2.8 失败与降级（fail-closed，绝不静默降级为无沙箱）

- readiness：`Disabled → NotConfigured`；`RestrictedToken → Ready`（legacy 不要求 setup 产物）；
  `Elevated → marker+users 存在且版本 == SETUP_VERSION` 则 `Ready`，否则 `UpdateRequired`
  【一手：`windows_sandbox_processor.rs:129-158`；`identity.rs:42-48`】；
- 运行时：需要 setup 时**同步**调 UAC setup（可弹窗），仍拿不到身份则**返回 Err 拒绝执行**，
  **没有「失败则无沙箱重试」的代码路径**【一手：`identity.rs:146-257`；`core/src/exec.rs:694-705`】；
- setup 失败写 `setup_error.json`，编排侧回读为结构化 `SetupFailure`【一手：
  `setup_error.rs:159-180`；`setup.rs:865-882`】。

### 2.9 已知绕过点与已知限制

- **Everyone 必须留在 restricting 里**（否则早期 DLL 初始化 `0xC0000142`、pwsh `0xE0434352`），
  意味着 Everyone 有写位的外部目录在两种模式下仍可写【一手：dsh `token.ts:164-190`；
  dsh README:73-83】；
- **NTFS 硬链接是文件对象别名**：工作区 ACE 经硬链接波及外部文件【一手：dsh README:77；
  dsh 测试 `runner.spec.ts:414-435`】；
- **FAT 卷无 ACL**，仍可写【一手：dsh README:103】；
- **对管理员用户几乎无约束**（这是设计边界，不是漏洞）：提权后的 setup 对真实管理员
  「几乎没有约束」【一手：`setup.rs:373` 注释】；
- **symlink 竞态自标 best-effort**【一手：`sandbox_smoketests.py:558`】；
- **微软官方提醒**：受限进程应跑在**非默认桌面**上，防 `SendMessage/PostMessage` 攻击
  桌面上的非受限进程【官方文档：Restricted Tokens】。

### 2.10 复杂度评估与「若只保留最小集」

Top 3 最复杂文件【推断，按跨模块耦合 + 分支密度】：
`src/setup.rs`（2346 行，编排 + UAC + payload + singleflight + 根路径过滤）、
`src/bin/setup_main/win.rs`（1328 行，供应编排）、
`src/deny_read_resolver.rs` + `deny_read_walker.rs` + `src/acl.rs` 组合（glob 展开 +
canonical/词法双路径 + 持久化状态 + ACE 掩码判定）。

**若只保留「工作区可写 + 读受限」最小集**【推断，但依据明确】：
- **可砍**：`wfp.rs`/`wfp_setup.rs`/防火墙 COM（网络）、`desktop.rs`/`conpty`（GUI/PTY）、
  `audit.rs`（world-writable 扫描）、`hide_users.rs`、helper 分发与命名管道 IPC（若不分发独立 runner）、
  `deny_read_resolver`/`deny_read_walker`（若不支持 glob deny）；
- **必须保留**：`token.rs`、`cap.rs`、`acl.rs`、`allow.rs`、`spawn_prep.rs`、`process.rs`、
  `workspace_acl.rs`、`path_normalization.rs`、`winutil.rs`；
- **关键依赖**：**legacy 受限令牌无法做 deny-read**（`lib.rs:546-554`）——**若最小集要求
  「读受限」，必须保留 elevated 账号路径**（`identity.rs` + `dpapi.rs` + `sandbox_users.rs` +
  setup helper）。

### 2.11 若用 Node 重写 codex 这套机制，必须自己实现的步骤清单

> 仅列事实性步骤（对应 Rust 实现位置），不含工期评估。

1. 绑定所需 Win32 导出（见 §2.12），自行管理 `LocalFree`/句柄释放与结构体布局
   （ACE 解析处 Rust 手动计算 SID 偏移，`acl.rs:174-177`，Node 同样要按 ACE 结构体偏移取 SID）；
2. 生成并持久化随机 capability SID，按 cwd / write-root 分桶，存到配置目录（`cap.rs`）；
3. `CreateRestrictedToken` 从当前令牌派生受限令牌，加入 capability SID + 额外 restricting SID
   （token user SID 视后端决定）+ logon SID + Everyone（`token.rs:448-506`）；
4. `SetTokenInformation(TokenDefaultDacl)` 设宽松默认 DACL；`AdjustTokenPrivileges` 打开
   `SeChangeNotifyPrivilege`（`token.rs:56-107,319-348`）；
5. `GetNamedSecurityInfoW` + `SetEntriesInAclW` + `SetNamedSecurityInfoW` 实现 allow-write /
   allow-read / deny-write / deny-read ACE 的读取-判定-收敛（`acl.rs:379-515,587-697`），
   并复刻「不对父目录授 FILE_DELETE_CHILD、改对子项授 DELETE」的规则；
6. `CreateFileW`（`READ_CONTROL` + `FILE_FLAG_BACKUP_SEMANTICS`）读 DACL 并按掩码判定是否已满足（`acl.rs:71-230`）；
7. `CreateProcessAsUserW` 以受限令牌启动子进程，配 `CreatePipe` + `SetHandleInformation` 做 stdio，
   配 `InitializeProcThreadAttributeList` 把进程放入 Job Object（`process.rs:92-187`、`proc_thread_attr.rs`）；
8. 计算 allow/deny 路径集合：write 根、read 根、write 根内的只读 carveout、`.git`/`.codex`/`.agents`（`allow.rs`、`spawn_prep.rs:268-346`）；
9. 对写入根授予该根 capability SID 的 `READ|WRITE|EXECUTE|DELETE`（`acl.rs:507-515`）；
10. 若需「读受限」：额外实现提权 setup —— 随机密码、`NetUserAdd`/`NetUserSetInfo` 建
    `CodexSandboxOnline/Offline`、`NetLocalGroupAdd` 建组并加成员（`sandbox_users.rs:70-215`）；
11. DPAPI（`CryptProtectData`，机器级）加密密码落盘（`dpapi.rs`）；
12. 受保护 ACL 的 setup 标记文件（先空文件、后提交内容）（`sandbox_users.rs:468-584`）；
13. `ShellExecuteExW(runas)` 触发 UAC 启动提权 helper，并传 base64 JSON payload（`setup.rs:895-1019`）；
14. `CreateProcessWithLogonW` 以沙箱账号启动 runner，runner 内再做第 2-7 步（`elevated/runner_client.rs:312-447`）；
15. 命名管道 IPC（`CreateNamedPipeW` + DACL 只允许沙箱账号 + `GetNamedPipeClientProcessId` 校验 PID）
    与长度前缀 JSON 帧协议（`elevated/runner_pipe.rs`、`elevated/ipc_framed.rs`）；
16. deny-read 路径规划：词法 + canonical 双路径、缺失路径先物化、失败回滚、跨运行持久化并撤销陈旧 ACL（`deny_read_acl.rs`、`deny_read_state.rs`）；
17. （若支持 glob deny）「字面前缀取扫描根 + rg 优先 + matcher 兜底遍历 + max_depth + reparse/环处理」（`deny_read_resolver.rs`、`deny_read_walker.rs`）；
18. `CreateDesktopW` 私有桌面并缓存复用，把 `Winsta0\<name>` 作为 `lpDesktop`（`desktop.rs`）；
19. `NtCreateFile`（`OBJ_DONT_REPARSE`）打开 ACL 目标目录句柄，再在其上做安全变更（`no_reparse_dir.rs`）；
20. 隐藏账号（注册表 + profile 目录属性）（`hide_users.rs`）；
21. 防火墙 COM（`INetFwPolicy2`/`INetFwRule3`，`LocalUserAuthorizedList` 按 SID）+ WFP（`Fwpm*`）
    实现账号级出站阻断与代理白名单，并做 `SetLocalUserAuthorizedList` 回读校验（`firewall.rs`、`wfp.rs`）；
22. 就绪检查/失败关闭语义：marker + users 版本一致才算 ready，否则同步触发 setup，仍失败则报错拒绝执行（`identity.rs:42-257`）；
23. world-writable 目录扫描与告警/deny（`audit.rs`），并把结果下发给前端；
24. 环境处理：`.sandbox`/`.sandbox-bin`/`.sandbox-secrets` 的 ACL 锁定、helper 二进制拷贝、
    `git safe.directory` 注入、NUL 设备授权（`bin/setup_main/win.rs:663-726`、`helper_materialization.rs`、`acl.rs:759-820`）。

### 2.12 codex 用到的 Win32 API 全清单

按用途分组（`windows-sys` 除非另注）：

- **令牌 / 身份**：`CreateRestrictedToken`、`GetTokenInformation(TokenUser/Groups/LinkedToken)`、
  `SetTokenInformation(TokenDefaultDacl)`、`AdjustTokenPrivileges` + `LookupPrivilegeValueW`、
  `CreateWellKnownSid`、`CopySid`/`GetLengthSid`/`EqualSid`、`OpenProcessToken`(advapi32)、
  `ConvertStringSidToSidW`/`ConvertSidToStringSidW`、`LookupAccountNameW`/`LookupAccountSidW`、
  `AllocateAndInitializeSid` + `FreeSid` + `CheckTokenMembership`、`MapGenericMask`；
- **ACL / SD**：`GetNamedSecurityInfoW`/`GetSecurityInfo`、`SetNamedSecurityInfoW`/`SetSecurityInfo`、
  `SetEntriesInAclW`、`ConvertStringSecurityDescriptorToSecurityDescriptorW`、`BuildExplicitAccessWithNameW`、
  `BuildSecurityDescriptorW`、`GetAce`/`GetAclInformation`、`CreateFileW`（含 `\\.\NUL`、路径 DACL、管道）、`LocalFree`；
- **进程 / 句柄**：`CreateProcessAsUserW`、`CreateProcessWithLogonW`、`CreatePipe`/`SetHandleInformation`、
  `ReadFile`/`WriteFile`、`GetExitCodeProcess`/`WaitForSingleObject`/`TerminateProcess`/`GetProcessId`、
  `DuplicateHandle`/`CancelSynchronousIo`、`SetErrorMode`、`OpenMutexW`/`CreateMutexW`/`ReleaseMutex`、
  `GetStdHandle`、`InitializeProcThreadAttributeList`/`UpdateProcThreadAttribute`；
- **命名管道**：`CreateNamedPipeW`/`ConnectNamedPipe`/`GetNamedPipeClientProcessId`/`PeekNamedPipe`；
- **桌面 / 窗口站**：`CreateDesktopW`/`OpenDesktopW`/`CloseDesktop`、`SetSecurityInfo(SE_WINDOW_OBJECT)`；
- **用户 / 组**：`NetUserAdd`/`NetUserSetInfo`（NetManagement）、`NetLocalGroupAdd`/`NetLocalGroupAddMembers`；
- **DPAPI**：`CryptProtectData`/`CryptUnprotectData`（`CRYPTPROTECT_LOCAL_MACHINE|UI_FORBIDDEN`）；
- **注册表**：`RegCreateKeyExW`/`RegSetValueExW`/`RegCloseKey`；
- **防火墙 COM**（`windows 0.58`）：`CoInitializeEx`/`CoUninitialize`/`CoCreateInstance`、
  `INetFwPolicy2`/`INetFwRules`/`INetFwRule3`/`NetFwRule`、`LocalPolicyModifyState`；
- **WFP**：`FwpmEngineOpen0`/`Close0`/`TransactionBegin0`/`Commit0`/`Abort0`/`ProviderAdd0`/`SubLayerAdd0`/`FilterAdd0`/`FilterDeleteByKey0`；
- **Shell / 提权**：`ShellExecuteExW` + `SEE_MASK_NOCLOSEPROCESS|NOASYNC` + `lpVerb="runas"`；
- **文件属性 / 错误**：`GetFileAttributesW`/`SetFileAttributesW`、`FormatMessageW`；
- **ntdll**：`NtCreateFile`/`RtlNtStatusToDosError`（`OBJ_DONT_REPARSE`）；
- **ConPTY**：`RawConPty`/`ResizePseudoConsole`（经 `codex-utils-pty`）；
- **Job Object**：进程树终止/保活。

---

## 3. deepseek-harness（dsh）· 深挖 `sandbox-windows-acl` ★ 与我们最相关

> 本仓库 `开源项目/deepseek-harness/packages/sandbox/sandbox-windows-acl/`。
> **核心结论：它是纯 TypeScript + koffi，无 Rust、无外部二进制、无需管理员、fail-closed，
> 且 MIT 开源（AGENTS.md §6 已授权内部使用）。**

### 3.1 文件地图与角色

| 文件 | 职责 |
|---|---|
| `src/token.ts` | 打开调用者进程令牌、`CreateRestrictedToken`、设默认 DACL |
| `src/acl.ts` | `SetEntriesInAclW` + `SetNamedSecurityInfoW` 增删 DACL；`hasExactGrant` 幂等 |
| `src/runner.ts` | 独立 Node 入口：解析 argv → `AclSandbox.init()` → 改 TMP/TEMP → spawn → 镜像退出码 |
| `src/spawn.ts` | `CreateProcessAsUserW` + Job Object（CREATE_SUSPENDED → AssignProcessToJobObject → ResumeThread） |
| `src/ffi.ts` | koffi 绑定表（懒加载 `kernel32.dll`/`advapi32.dll`，`__stdcall`） |
| `src/win32-abi.ts` | 常量与结构体布局（附 MinGW 头文件行号） |
| `src/workspace-sid.ts` | SID 派生（SHA-256 → `S-1-4-x-y`） |
| `src/grant.ts` | 服务端授权生命周期 |
| `src/index.ts` | `AclSandbox` 类 |

链路集成在 `packages/sandbox/sandbox-local/src/index.ts`（`PLATFORM_CHAINS = { win32: ['windows-acl'] }`，
唯一候选、不做探测）与 `packages/shell/pwsh-sandbox/src/index.ts`（消费沙箱的 pwsh 执行器）。

### 3.2 是否调用系统工具？—— 否

`icacls`/`runas`/`schtasks` 在实现代码中**零出现**；`icacls` 仅出现在测试里做运维视角验证
【一手：`tests/grant.spec.ts:22`、`tests/runner.spec.ts:60`】。
全部走 koffi 加载 `kernel32.dll`/`advapi32.dll`【一手：`ffi.ts:373-432`】。
唯一的 C++ 文件 `verify/abi-probe.cpp` 是**开发期** ABI 核对探针，不随包分发【一手：`README.md:65-71`】。

### 3.3 是否需要管理员 / 创建系统账号？—— 都不需要

- **不建账号**：`token.ts:23-42` 只用调用者自己的进程令牌；全包无 `NetUserAdd`/`LogonUser`/`CreateProcessWithLogon`；
- **不需要管理员**：授权前提是「被授权目录归调用者所有」，属主有隐式 `WRITE_DAC`，可在不提权的情况下改 DACL
  【一手：`README.md:80`】；
- **无安装脚本 / 无 UAC 触发代码**；
- **幂等性是设计核心**：确定性 per-workspace SID + `hasExactGrant` 精确 ACE 跳过 + 每路径 `LockFileEx`
  独占锁防并发 clobber【一手：`acl.ts:75-109,196-213`】。

### 3.4 三档模式在 Windows 的映射（restricting SID 列表即模式定义）

| 模式 | restricting SID 列表 | 授权 | 运行路径 |
|---|---|---|---|
| `read-only` | `[logon SID, Everyone]`（**无** write SID） | 零授权 | 走 runner |
| `workspace-write` | `[logon SID, Everyone, workspace SID, temp SID]` | 工作区 ACE 常驻 + 私有 temp ACE 可撤销；TMP/TEMP 重写 | 走 runner |
| `danger-full-access` | — | 无 | **不走沙箱**，直接本地执行 |

要点：保活组 `logon SID + Everyone` 两模式都带（否则早期 DLL 初始化 `0xC0000142`、CNG 让 pwsh 崩
`0xE0434352`）【一手：`token.ts:164-190`】。
`read-only` 故意把 write SID 排除在列表外，这样此前 `workspace-write` 留下的 STANDING ACE 在
`read-only` 下**失效**（降级不泄漏、升级免重传播）【一手：`README.md:57`；
`tests/runner.spec.ts:329-372`】。

### 3.5 网络隔离 —— 明确无

「Writes are restricted; reads, network, and process visibility are not… a confined child can
read any caller-readable file and **open sockets**」「Read-side confinement and network policy are
out of scope」【一手：`README.md:77,101`】。
机制根因：`WRITE_RESTRICTED` 只对写访问做交集，不碰套接字【一手：`win32-abi.ts:87-88`】。

### 3.6 失败与降级（fail-closed 由构造保证）

- 「This port fails closed by construction」【一手：`README.md:41`】；
- 每个 Win32 调用都检查返回值；**原 POC（`huoyaoyuan/windows-acl-restrict-poc`）忽略返回码导致
  失败时用完整令牌跑子进程（fail-open），本移植明确修掉**【一手：`token.ts:4-7`、`index.ts:20-21`】；
- `init()` 失败回滚：撤销可撤销的临时授权、释放 SID 分配、聚合失败【一手：`index.ts:301-338`】；
- runner 侧任何失败 → stderr 打 `windows-acl-run: <detail>` 并退出 **127**，绝不无限制 spawn
  【一手：`runner.ts:43,54-63,215-225`】；
- runner 失败 vs 普通拒绝的区分：`RUNNER_FAILURE_RULES`（退出码 127 + stderr 致命签名）→
  `SandboxUnavailableError`【一手：`sandbox-local/src/index.ts:231-240`；
  `pwsh-sandbox/src/helpers.ts:84-119`】。

### 3.7 能力边界（它自己承认的能与不能）

「Verified boundaries」【一手：`README.md:73-83`】：Everyone 授权仍是环境写权限；
**硬链接是文件对象别名**，工作区 ACE 经硬链接波及外部文件；**只限写**（读/网络/进程可见性不受限）；
无控制台隔离（`CREATE_NO_WINDOW` 子进程 `0xC0000142` 死）；ACL 授权是常驻目录变更；
被授权目录必须归调用者所有；私有临时目录按「活跃会话/工作区对」隔离；
`whoami` 等口令检查类命令在受限令牌下报错（噪音，非操作失败）。

「Known Limitations」【一手：`README.md:93-103`】：每工作区一个写白名单；清理尽力而为；
常驻 ACE 是隐性残留；NULL-DACL 目录不保身份；**命名管道默认 SD 模板导致受限孙进程无法被管道捕获输出**；
FAT 卷仍可写；PowerShell 语言模式随模式不同（`read-only` → ConstrainedLanguage）。

**「人人可写目录」警告机制：没有实现**（明确 deferred）【一手：`README.md:102`】——
这是与 codex 的一个已知缺口（dsh 没有 world-writable 目录告警）。

### 3.8 与 codex 的对比表（机制内核几乎同源）

| 维度 | dsh `sandbox-windows-acl` | codex `windows-sandbox-rs` |
|---|---|---|
| 身份来源 | **只复制调用者令牌**，无新账号 | 默认走两个专用本地账号 + 组 |
| 提权安装 | **不需要** | 需要（`ShellExecuteExW(runas)` + UAC） |
| 网络 | 无 | WFP 按账号装过滤器 + 代理端口白名单 |
| 读隔离 | 无（只限写） | deny-read ACL 层 + 读白名单根 |
| 临时区/默认 DACL | 默认 DACL 命名 temp/workspace SID | 默认 DACL 命名 logon+Every+capabilities，故意排除身份标记 SID |
| 实现语言 | **TypeScript + koffi** | **Rust + windows_sys** |
| 安装落盘 | 无 | setup_marker.json、DPAPI 加密的 sandbox_users.json |
| 幂等/并发 | 确定性 SID + 精确 ACE 跳过 + 每路径锁 | 版本化 setup marker + singleflight |

### 3.9 可复用性评估（对我们的直接判断）

**可直接借鉴（代码级，不是思路级）**：
- 整包 `sandbox-windows-acl` 是自包含 Node/TS 模块，`package.json` 仅依赖 koffi，
  无 Electron 依赖，runner 是独立 Node 入口（`tsdown.config.ts:7-16`）；
- **最小内核 = `AclSandbox` 类**：`init()`（建受限令牌并授权）→ `spawn({command,args,cwd,stdio})`
  （受限身份起进程并收集输出）→ `dispose()`（撤销临时授权、释放 SID）；
- 可独立抽出的零件（纯函数/纯 Win32）：`workspace-sid.ts`、`spawn.ts:26-56`（`CommandLineToArgvW` 规则的
  quoteArg/buildCommandLine）、`spawn.ts:269-357`（含 kill-on-close Job 与孤儿兜底的
  `spawnSandboxedInherited`）、`acl.ts:196-213`（`hasExactGrant`）、`win32-abi.ts`（全部常量与结构体布局）、
  `ffi.ts:373-432`（koffi 绑定表与踩坑注释）、失败语义设计（fail-closed + 退出码 127 + stderr 签名）。

**平台/架构绑定（需重做或谨慎处理）**：
- koffi 依赖各平台预编译二进制（无需编译器）【一手：`pnpm-lock.yaml:10067-10077`】；
  但**结构体布局要在目标架构上用 `verify/abi-probe.cpp` 复核**（x64/ARM64）【一手：`README.md:65-71`】；
- dsh 的 cordis seam 架构（`ctx.sandbox`/`ctx.approval`）要改写成我们自己的接口。

**不可原样照搬 / 需注意的代价**：只限写、部分强制；无网络隔离；无控制台隔离 + 命名管道孙进程
无法捕获输出；常驻工作区 ACE 是隐性残留；`read-only` 下 pwsh 退化为 ConstrainedLanguage；
无 world-writable 目录告警。

---

## 4. WorkBuddy · 深挖（修正两处旧结论）

> 素材：`docs/WorkBuddy/`（完整解包，~1.2GB）+ `docs/WorkBuddy-reference/`（精选子集）。
> 我们既有笔记 `docs/workbuddy分析/09-sandbox-and-permissions.md` 与 `_research-workbuddy-sandbox.md`
> 已覆盖「四层纵深 / tsbx_rules.json / 语言 shim / fail-open」——本轮只补它们没写透的细节，
> 并**修正两处被误读或需更正的结论**（§4.9）。

### 4.1 tsbx 沙箱的真实形态（一手）

`docs/WorkBuddy/resources/app.asar.unpacked/cli/vendor/sandbox/5.4.7/` 只有 **exe/dll/json**，
**无任何 `.sys`**。依赖声明：`@anthropic-ai/sandbox-runtime`、`@tencent-ai/sandbox-cli-{darwin,linux,win32}-*`、
`e2b`【一手：`cli/package.json:16-122`】。

**「主进程怎么调 tsbx.dll」在 JS 侧没有可引用的调用点** —— 桌面 main 里搜 `sandbox-cli|tsbx|
sandbox-center|sandbox_ffi` 命中的全是注释与一条清理逻辑；真正调用是 **CLI 子进程经
`sandbox-cli.exe` 的命名管道/Unix socket IPC**（`createIpcRequest(id, payload, cmd)`，默认超时 120s，
命令字至少含 `"execute"` 与 `"broker"`）【一手：`docs/WorkBuddy/_analysis/extracted/cli/dist/codebuddy.js`
行号 205/249/513/554/566/816/999/1054/2778；`docs/workbuddy分析/04-cli-core.md:287`】。

各二进制角色【一手：`cli/package.json` 与字符串级证据；其中 DLL 字符串级属**二手**（未反编译）】：
- `sandbox-cli.exe`：会话编排/快照（`snapfile_dir`、`permission_file`）；
- `sandbox-center.exe`：独立 rule center IPC server；
- `tsbx.dll`：解析 `tsbx_rules.json`；**`registry_rules` / `network_rules` 解析但不强制**（字面 TODO）；
- `tsbx_sdk.dll`：共享内存下发规则 + 环境变量展开；
- `sandbox_ffi.dll`：FFI 门面（`getRules`/`addFileRule`/`addMachRule`）；
- `betterleaks.exe`：密钥泄漏扫描。

### 4.2 `tsbx_rules.json` 完整字段（一手）

文件：`docs/WorkBuddy/resources/app.asar.unpacked/cli/vendor/sandbox/5.4.7/tsbx_rules.json`（96 行）。
出厂默认规则，用户可配仅 `file_rules_user` / `network_rules_user` / `network_policy`。

| 字段 | 值 | 语义 |
|---|---|---|
| `version` | `1` | schema 版本 |
| `default_action` | `"deny_write"` | **默认禁写、不禁读** |
| `recyclebin_backup` | `true` | 写/删走回收站备份，可恢复 |
| `auto_grant` | `true` | 低风险访问自动授予 |
| `file_rules[]` | `{path, type, _comment}` | 内置表；`type` 只出现 `no_access` / `inherit_user` |
| — | `no_access` | `%USERPROFILE%\.ssh\**`、`.gnupg\**` |
| — | `inherit_user` | Temp/`$RECYCLE.BIN`/.cache/.local/node/python/rust/go/java/dotnet/docker 缓存/`%APPDATA%\Code`/`%APPDATA%\Trae`/PS 历史 等约 50 条 |
| `file_rules_user[]` | 示例 | **用户自定义** |
| `registry_rules` / `process_rules` / `network_rules` | `[]` | **解析不强制**（字面 TODO） |
| `white_process[]` | 浏览器白名单 | msedge/chrome/firefox/brave/opera/360se/QQBrowser/SogouExplorer |
| `_comment_network_policy` | 见原文 | 「双引擎:tsbx 仅做 DNS hook 域名拦截(default 恒 allow,不拦 TCP);TCP 决策由 Rust LocalProxy 承担」 |
| `network_policy` | `{enabled:true, default:"allow", deny_ips:[], deny_domains:[]}` | 网络策略 |

**注意区分另一套「用户可配」通道**（security-center 的 `sandbox.*`，**不要与 tsbx_rules.json 混淆**）：
`sandbox.extraAllowWrite`（写进 settings.json 再由 CLI `BashSandboxManager.loadConfig()` 追加到
`filesystem.allowWrite`）、`sandbox.networkPolicyEnabled`/`networkPolicy`、`sandbox.programBlacklist`、
`sandbox.systemToolPolicy`、`sandbox.safeDelete*`/`versionControl`/`deleteProtection`、
以及 `~/.workbuddy/settings.json` / 项目 `.codebuddy/settings.json` 的 `permissions.deny`【一手：
`server.js:129644-129713,129759-129805,130166-130193,130475-130480`】。

### 4.3 沙箱能力范围

| 维度 | 结论 |
|---|---|
| **文件** | 强制（`default_action: deny_write` + `no_access`/`inherit_user`） |
| **网络** | 分两层：tsbx 只做 DNS hook 黑名单，TCP 由 Rust LocalProxy；`network_rules` 解析不强制 |
| **进程** | 走「禁程序名单」而非进程树：`broker-program-policy-check.cjs`（退出码 126=forbidden_program / 13=unavailable），默认 Windows 黑名单 `wsl.exe, wslconfig.exe, wmic.exe, sc.exe, reg.exe, schtasks.exe` |
| **UI / 桌面隔离** | 未找到证据（无 `.sys`、无 AppContainer/JobObject/受限令牌字符串） |
| **进程树 / 子进程继承** | 未找到显式处理；真正的「继承」发生在 env 变量层（`NODE_OPTIONS`/`PYTHONPATH`/`BASH_ENV`/`PATH`/`CODEBUDDY_SANDBOX_*`） |

### 4.4 broker shim 的 fail-open（原文）

`cli/vendor/shim/node-brokered-fs-shim.cjs:41-47`【一手】：

```js
// broker 连接失败会静默退化为原生 fs 调用（fail-open）。默认不打印，避免污染被
// hook 的任意子进程的 stdout/stderr；排查问题时可设 CODEBUDDY_SANDBOX_BROKER_DEBUG=1 开启。
```

触发条件与退化结果：「未启用」（门控 `PLATFORM === 'darwin'` + 开关 + 会话变量）直接放行；
「缺原生 addon」放行；「broker 挂了/超时 5s」catch 后 `return false`；加载期静默
（`node-language-shim.cjs:29-34`）。⇒ **文件读写完全回到无约束的原生 fs，且默认无任何日志**。

**反向对照（同仓库内的 fail-closed）**：`broker-program-policy-check.cjs` 缺件 → 拒绝（13）；
`safe-delete-common.sh` 有 `SAFE_DELETE_FAIL_CLOSED`（broker-denied / trash-failed）；
但 `:505` 也存在「broker unavailable, falling back to local trash」——属「可用性降级但仍在保护域内」。
**两类降级方向要分开写进我们的设计约定**。

### 4.5 语言 shim 的具体机制

- `NODE_OPTIONS --require` 注入落点：`codebuddy.js` 内的 `injectLanguageShimEnv`（webpack 模块 7957，
  行 1569 块内）【一手，行内截取】；
- patch 的 fs API：`node-brokered-fs-shim.cjs:50-90` 保存原始引用（`mkdir*/Rename*/Copy*/Cp*/Chmod*/
  Link*/Symlink*/Exists*` + `open/readFile/writeFile/appendFile/create*Stream` + promises）；
  host-op 类（非删除的文件变更 → 申请 host-op）、file-token 类（读写 → 申请 token 后继续原生 fs）；
  写完成后发 `FileWriteCompleted`；
- **一个踩坑注释**（517-523）：「Node 的 `appendFileSync/appendFile` 内部会委托到 `writeFileSync/writeFile`
  （同一批被 patch 的导出属性），naive 包装会双重触发 broker token/write-completed」，因此用
  `suppressWriteInstrumentationDepth` 深度计数器去重；
- **safe-bin / brokered-bin 与 PATH 前置**：`safe-bin/rm/rmdir/unlink`（bash 替身，无 session 直通）、
  `BASH_ENV` 注入（export 函数）、`brokered-sandbox-bash-env.sh`（unalias/unset 防递归 +
  `export PATH="${CODEBUDDY_BROKERED_BIN_DIR}:$PATH"`）；`brokered-bin/` 共 24 个
  （cat/chmod/cp/dd/find/grep/head/ln/ls/mkdir/mv/readlink/realpath/rm/rmdir/sed/tail/tee/touch/truncate/
  unlink/wc + `codebuddy-toybox-dispatch`）；
- `sitecustomize.py`：经 `PYTHONPATH` 自动加载，拦截 `os.remove/rmdir/shutil.rmtree/pathlib` 删除 API，
  把文件移入回收站；**保留用户原有 sitecustomize**（先摘自己、`__import__("sitecustomize")` 加载原版、
  再恢复自己）；Windows 用 `ctypes` → `shell32.SHFileOperationW`；broker 门控同样 **darwin-only**；
- broker IPC 协议：JSON-line over unix socket，超时 5s，同步版优先原生 addon，否则 spawn 自身
  （`NODE_OPTIONS:''` 防递归注入）【一手：`broker-ipc-client.cjs`】；
- 原生 addon：`cli/vendor/shim/native/` 只有 darwin 预编译产物（`binding.gyp` + `brokered_sandbox_native.c` +
  `darwin-*/brokered-sandbox-native.node`），要求导出 `consumeSandboxExtension` 与 `requestBrokerSync`。

### 4.6 实际是否启用（一手）

桌面端启动 CLI 的完整参数（`server.js:128594-128615 buildAgentCliRuntimeArgs`）：

- **`--permission-mode` 的真实默认值 = `bypassPermissions`**（`normalizeBackendPermissionMode`：
  未知/缺省一律落到 `bypassPermissions`）；
- `WORKBUDDY_AGENT_ALLOWED_TOOLS` = `present_files, read_me, show_widget, connect_cloud_service,
  connect_open_platform, WebFetch, Bash(mcporter:*)`；
- **没有 `--sandbox` 参数** —— 沙箱开关是**运行期 ACP 会话配置项**：
  `session/set_config_option(configId:"sandbox", value:"true"|"false")`，关闭原因经
  `_meta["codebuddy.ai/sandboxDisabledReason"]` 传给 CLI【一手：`server.js:131679-131704`】；
- 沙箱**默认开启**（`sandboxSafetyEnabled` 缺省 true，桌面主进程镜像与 renderer 同）【一手：
  `tar.js:29987-29997`、`server.js:130049-130057`、`ui-docs-viewer-C2jT2eXi.js:177632-177637`】。

**降级分支（4 类，一手）**：
1. 后台自动化**强制关沙箱**（`fullAccess` + `useSandboxCLI=false`，原因
   `background-automation-no-approval-ui`）；
2. 用户关闭「沙箱安全」（原因 `security-center-setting-disabled`）；
3. 原生侧 fail-open（「sandbox-cli 可能已经拿到该路径…Rust 侧打开/查询失败按既有策略 fail-open」）；
4. ACP 投递失败 → 重试 → 再失败进 `handleSessionConfigOptionFailure`（有回收与缓存，不会静默变「以为开着」）。

### 4.7 产品层如何表达沙箱状态（一手）

**只有二元开关（已开启/已关闭），没有「沙箱保护中/部分保护」这类分级能力上报**：
- 权限 chip/tooltip：`input.sandboxMode`「沙盒模式」+ `input.sandboxMode.tooltip`「沙盒模式启用后，
  所有文件修改限制在工作空间内…如果有指令需要操作工作空间之外的目录，必须用户授权之后，该指令单独在沙盒外执行。」；
- 安全中心开关：`settings.securityCenter.section.sandboxSecurity`「沙箱安全」+ `sandboxEnabled.tooltipOn/Off`；
- 关闭确认弹窗文案（含「默认权限下，仍然会保留对**部分**高危指令的确认、删除文件的确认等基础安全机制」）；
- 越权确认（intercept）文案：`sandbox.interceptTitle`「越权确认」+ `sandbox.interceptDesc`「CodeBuddy 想在沙箱外执行命令，需要你确认」+ 原因码（`file-external`/`file-blocklist`/`sensitive-command`/`bulk-delete-threshold`）；
- **搜 `部分保护 / 保护中 / sandbox unavailable / partially / isolation` 在 renderer 中零命中**。
⇒ WorkBuddy 的对外表达是**二元 + 关闭原因代码**，而非 `SandboxEnforcement: full|partial` 分级上报。
（这点可作为我们 `SandboxEnforcement` 设计时「二元 + reason 枚举」的参考。）

### 4.8 语言 shim 在 Windows 上几乎不存在（一手）

`node-brokered-fs-shim` 的门控是 `PLATFORM === 'darwin'`，`sitecustomize.py` 的 broker 同样
darwin-only【一手：`node-brokered-fs-shim.cjs:149-156`、`sitecustomize.py:327-341`】。
⇒ Windows 上真正生效的只有**回收站删除保护**；broker fs 拦截与 program-policy 是 macOS 的活。

### 4.9 对我们可借鉴 / 明确不抄（并修正两处旧结论）

**修正 1**：「WorkBuddy 用内核态过滤驱动 tsbx.dll」——**已证伪**。`vendor/sandbox/` 无任何 `.sys`，
全仓库 `AppContainer|JobObject|CreateRestrictedToken` 零命中。结论应定为**「用户态 Rust 栈」**
（sandbox-cli.exe 会话编排 + tsbx*.dll 规则/下发 + sandbox-center rule center + 共享内存/命名管道 IPC）。
（本轮已同步更正 `_research-workbuddy-sandbox.md:650`。）

**修正 2**：「临时任务 = 共享 `<根>/Claw`」——已在 `align-per-task-dirs` 修正为「每任务独立时间戳目录」。

**可借鉴（思路，零平台依赖）**：
- 「策略在 JSON、加规则=改数据」的规则文件模型（`tsbx_rules.json` 的 `file_rules`/`file_rules_user`
  双层 + `type: no_access|inherit_user` 三态）；**但别学它 `registry_rules`/`network_rules`
  「解析但不强制」——要么不做，要么做真**；
- 沙箱配置 → 权限 deny 规则的提升（`listWorkspaceEscapeDenyRules`：把「不可写路径」提升为
  规则层 deny，先于 `bypassPermissions`）；
- 删除 = 进回收站 + 删后校验 + 失败 fail-closed（`safe-delete-common.sh`；Windows 用
  `SHFileOperationW`/`Microsoft.VisualBasic.FileIO`）；批量删除阈值 + turn 级批准；
- 「broker 只做传输/策略应答、语义留调用方」的边界划分，以及「无 session 零开销直通」；
- 凭据目录清单 + level(high/low) + 决策词汇（`DEFAULT_SAFETY_FILTER_RULES`）；
- **降级方向区分**：「安全收益降级（fail-open，禁止）」与「可用性降级但仍在保护域内」分开写；
- **诚实上报要「二元 + 原因」而非「假装有」**（`sandboxSafetyEnabled` + `sandboxDisabledReason`）。

**可搬用（代码/资产）**：`safe-bin/*` + `safe-delete-common.sh`；`sitecustomize.py` 的
「保留用户原 sitecustomize」技巧；`node-brokered-fs-shim.cjs` 的 URL/跨-realm `toAbsPath` 防御与
appendFile 双重触发去重；`broker-program-policy-check.cjs` 的退出码契约（0=allow / 126=forbidden_program /
13=unavailable）；回收站三平台实现；`tsbx_rules.json` 的字段名与注释。

**明确不抄**：Windows tsbx 原生栈（多平台 Rust 工程量 + `network_rules`/`registry_rules` 半成品）；
fail-OPEN 的 fs 拦截（直接违反我们「响亮失败」约定）；强制 shell 替身 + PATH 前置 +
`NODE_OPTIONS` 全局 `--require`（对「用户自己的工具链」侵入性强，我们有 pi `tool_call` 事件等
更干净的挂载点）；桌面默认 `bypassPermissions`（那是「有 OS 沙箱兜底 + 集中审计」才敢做的姿态，
我们默认 workspace-write + ask）；`apply-experimental-features.ps1` 那类系统级提权安装。

---

## 5. Node/Electron 侧技术选型（能不能做、怎么做）

> 核心问题：我们没有 Rust 原生模块，Node 里能不能调 Win32 做到同等机制？
> 答案：**能**，用 **koffi**（通用动态 FFI）。且 dsh 已经把这个机制完整移植成 Node 了（§3）。

### 5.1 FFI 库选型

| 方案 | 维护状态 | Node 22/24 兼容 | 需构建工具链 | Electron 打包 | 结论 |
|---|---|---|---|---|---|
| **koffi** | 活跃，最新 3.2.1（2026-09），周下载 ~470 万【npm】 | 支持 Node ≥16，官方测试矩阵含 Windows x64/arm64【koffi.dev】 | **否**（官方预编译二进制，含 Win/arm64）【官方文档】 | 官方给了 electron-builder / Forge / esbuild / yao-pkg 范例【koffi.dev/packaging】 | **首选** |
| node-ffi-napi / ffi-napi | **事实停止维护** | 与 Electron ≥20 冲突 | 需 node-gyp + MSVC + Python | **不可用**：Electron 20 起 V8 memory cage 禁止 external buffer，ffi-napi 报 `External buffers are not allowed`【Electron 官方博客 + issue #35801】 | 排除 |
| ffi-rs | 活跃（Rust+N-API，1.3.x） | 支持 | 预编译二进制 | 可用；社区资料少【npm】 | 备选 |
| napi-rs（写自己的 `.node`） | 活跃 | 支持 | **需要 Rust 工具链**（构建期） | 需 per-platform 预编译 + CI 矩阵 | 与「没有 Rust 原生模块」约束冲突，不推荐 |
| node-addon-api（C++） | 官方维护 | 支持 | **需 node-gyp + MSVC + Windows SDK**，且按 Electron ABI 重编（electron-rebuild）【Electron 官方 C++ Win32 教程】 | 复杂，CI 要 per-Electron-version 矩阵 | 只在 koffi 覆盖不了时才考虑 |
| **Node 内建 `node:ffi`** | 实验性，v26.1.0 新增，需 `--experimental-ffi`【Node 官方 release notes】 | 不支持 Node 22/24 | 不需要 | 当前 Electron 未查到支持该 flag 的证据 | 暂不可用，但值得写入长期抽象位 |

**关键发现**：`@deepseek-ai/dsh-sandbox-windows-acl` 与 `@deepseek-ai/dsh-win32-process` 就是
「纯 Node + koffi」的现成正例【项目源码：npm README + GitHub 路径】。

### 5.2 「以另一个用户身份运行命令」的方式对比

| 方式 | 无人值守 | 需 UAC/管理员 | 能回传 stdout/stderr + exit code | 关键限制 |
|---|---|---|---|---|
| `runas` | **否** | 否 | 一般不能（新开控制台） | 交互式，必须手输密码；`/savecred` 凭据缓存安全差【官方文档】 |
| **`CreateProcessWithLogonW`** | **是** | 否（但用明文密码） | **能**（管道/句柄即可） | 调用方无需 `LogonUser`，但要明文密码、依赖 **Secondary Logon 服务**（可能被策略禁用）【官方文档】 |
| `CreateProcessAsUser` + `LogonUser` | 是 | **有特权壁垒** | **能** | 跨用户时需要 `SE_ASSIGNPRIMARYTOKEN`/`SE_INCREASE_QUOTA`；OpenAI 明确这条流程「因特权壁垒跑不通」，才被迫做提权 helper【OpenAI 官方博客】 |
| 计划任务 `schtasks /RU` | 半能 | 创建跨用户任务需管理员 | **差**：默认不回传 stdout/stderr；exit code 不直接给 | 触发/路径/权限坑多【官方文档】 |
| psexec 风格（SMB + 服务/RPC） | 是 | 需要管理员 | 能（重定向） | 典型 RCE/横向工具，产品化不合适 |

**结论**：**「跨用户 + 无人值守 + 可回传」的关键 API 是 `CreateProcessWithLogonW`**（srt 正是用它做
「两跳启动」：broker 用 `CreateProcessWithLogonW` 起 runner 作为 `srt-sandbox`，runner 再用受限令牌 +
Job Object 起真实命令）【项目源码：srt README】。
而「同用户 + 受限令牌」这条路（不换用户）**不需要任何特权**，是无管理员方案的基石。

### 5.3 受限令牌在 Node 侧的实现路径

需要的 API（按调用顺序）：
`OpenProcessToken` → `CreateRestrictedToken`（`WRITE_RESTRICTED` + restricting SID list）→
（若要换用户）`LogonUserW` → `CreateProcessAsUserW`；ACL 侧 `SetEntriesInAclW`/`SetNamedSecurityInfoW`/
`GetNamedSecurityInfoW`；网络侧 WFP（`FwpmFilterAdd0` 等）或防火墙规则。

**现成的 Node 封装**【项目源码】：
- `@deepseek-ai/dsh-sandbox-windows-acl`（**正是**「dsh 的 ACL restricted-token runner chain」，
  Node + koffi，0.0.1-rc，自报 partial enforcement）；
- `@deepseek-ai/dsh-win32-process`（低层 Win32 进程库：懒加载 `kernel32.dll`+`advapi32.dll`，
  `CreateProcessAsUserW`、匿名管道 stdio、kill-on-close Job）；
- 上游 POC `huoyaoyuan/windows-acl-restrict-poc`（**原版 fail-open**，dsh 已修正）；
- 镜像/fork：`@agentbrain-harness/sandbox-windows-acl`、`@truly-private/omdsh-sandbox-windows-acl`、
  `@prettier-ai/dsh-win32-process` 等（说明该模式在 Node 社区已被多次独立复现）。

**典型实现模式（两种）**：
1. **纯 FFI（Node 内直接做）**：koffi 绑定表 + `CreateProcessAsUserW`，**没有 helper exe**，
   用 Job Object 收子进程树、匿名管道回传 stdout/stderr/exit code —— dsh 走这条，对我们最友好；
2. **小 helper 二进制（Node 外壳 + 原生 runner）**：`@anthropic-ai/sandbox-runtime` 的 `srt-win.exe`
   就是 **Rust** 二进制（两跳 `CreateProcessWithLogonW`）；跨用户 spawn 的特权壁垒逼出这条路。

### 5.4 替代沙箱机制

- **AppContainer（`CreateAppContainerProfile`）**：能做文件/网络隔离，但**形状不对**——
  需要 capability 声明、**不能读「任意路径」**（dsh 设计笔记直言）、网络默认禁用、
  Win32 App Isolation 需 **MSIX 打包 + VS + Win11 24H2 preview**；OpenAI 明确否决（agent 要驱动
  开放的开发者工作流）【官方文档 + OpenAI 博客】。未查到成熟 Node 封装。**不推荐**。
- **Job Object（`AssignProcessToJobObject`）**：**不能限制文件访问**，只限资源与生命周期
  （活跃进程数/内存/CPU/UI/kill-on-close）。**正确定位是配套组件，不是沙箱本体**【官方文档：JOBOBJECT_BASIC_LIMIT_INFORMATION】。
- **WDAC / AppLocker**：管「哪些代码能运行」，不是文件/网络沙箱，企业级需管理员/GPO【官方文档】。
- **Windows Sandbox（Hyper-V 容器）**：隔离最强，但**仅 Pro/Enterprise/Education，Home 版不支持**；
  需要宿主机/guest 桥接；无法直接操作宿主机的工作目录；同一时刻只能一个实例；
  OpenAI 因「Home 不支持 + 需操作真实 checkout」而否决【官方文档 + OpenAI 博客】。
- **MSIX 容器**：打包态应用的文件/注册表虚拟化；需打包+签名+身份；对任意子进程树不适用【官方文档】。
- **用户态文件系统过滤驱动 / minifilter**：能力上能做真隔离（`bindflt.sys` 就是 Windows Sandbox 在用），
  但要签名内核驱动、管理员安装、处理兼容性——**成本高，排除**【官方文档 + Bitdefender 研究】。
- **MDAG（Defender Application Guard）**：**已弃用**【第三方汇总】。

### 5.5 Electron 特有约束（务必区分）

**`sandbox: true`（renderer 沙箱）≠ OS 沙箱**：两者完全不是一回事。Electron 的沙箱是 Chromium 的
进程沙箱（限制 renderer 只用 CPU+内存，其余靠 IPC 委托主进程），保护的是「渲染进程里的不可信 web
内容」，**不是**「agent 运行的任意命令」【官方文档：Electron Process Sandboxing】。
（Chromium 自己的 Windows 沙箱内部也正是用 restricted token，但它是私有实现、不对外暴露。）

**utilityProcess（daemon 就跑在这里）没有「降权运行」的 option**：`fork()` 的 options 里只有
env/execArgv/cwd/session/stdio 等，**没有任何 token/user/integrity 相关项**【官方文档：Electron utilityProcess】。

**结论**：Electron **本身不提供**「把某个进程降权到受限令牌/另一用户」的能力。要 OS 沙箱，
**必须自己 spawn 一个外部命令**（用 koffi/helper 构造受限令牌后 `CreateProcessAsUserW`/
`CreateProcessWithLogonW`），utilityProcess 只当**策略编排者**，不能当沙箱执行体。

### 5.6 非 Windows 平台的对应方案（对比，暂不做但要留好抽象位）

| 平台 | 机制 | Node 里怎么用 | 依赖外部二进制 |
|---|---|---|---|
| Linux | `bubblewrap`（user/mount/net namespace）+ **Landlock LSM**（文件）+ **seccomp-BPF**（syscall） | spawn 外部命令（`bwrap`），Node 侧只做策略与代理；`socat` 做 socket 桥接 | **是**（bwrap/socat/ripgrep） |
| macOS | `sandbox-exec` + **Seatbelt** profile（动态生成 `.sbpl`） | spawn `sandbox-exec` | 否（系统自带）；`sandbox-exec` 被标 deprecated 但仍在用 |

**统一的跨平台抽象形状**：srt 的 `SandboxManager.initialize(config)` + `wrapWithSandbox(command)`——
上层只描述**策略**（`filesystem.denyRead/allowWrite/denyWrite`、`network.allowedDomains`、Unix socket 规则），
下层按平台映射（macOS→seatbelt profile，Linux→bwrap+seccomp，Windows→WFP+ACE）【项目源码：srt README】。
这正是我们 AGENTS.md「策略与落地分离」的现成参考；**可借它的接口形状，不一定要借它的实现**。

### 5.7 无「一次性管理员安装」的退路（按隔离强度从高到低）

1. **同用户 + 受限令牌 + 写 SID + ACL（dsh 路线）** ⭐ **不需要管理员**。
   文件写入限制强；但**网络只能「尽力」**——受限令牌拦不住出站连接，Firewall 规则又要管理员
   【OpenAI 博客】。dsh 明确标成 `enforcement: 'partial'`。
2. **同用户受限令牌 + 轻度网络抑制（codex「未提权原型」）**：
   网络靠**环境变量投毒**（`HTTPS_PROXY=http://127.0.0.1:9`、`GIT_SSH_COMMAND=cmd /c exit 1`）+
   PATH 前置 denybin。**不抗对抗性代码**【OpenAI 博客】。
3. **只对临时目录/工作目录限权**：最小侵入，拿到**写范围收窄**，**读基本不受限**。
4. **AppContainer**：无管理员但要 MSIX/capability 清单，且不能任意路径读（§5.4）。
5. **MIC 完整性标签**：「低完整性跑 + 给可写根打低完整性标签」，理论无需管理员；
   OpenAI **否决**——把真实 workspace 标成低完整性 = **所有低完整性进程**都能写它，语义污染太广
   【OpenAI 博客】。

**强隔离（能真拦网络）的代价 = 必须提权一次**：要按 SID 精确做防火墙/WFP 规则，就得创建独立沙箱
账号或装 WFP filter，这需要管理员（codex/srt 都是「一次性 UAC + 幂等安装」，之后日常不再提权）
【OpenAI 博客 + srt README】。

### 5.8 可复用的开源实现（2025–2026）

- **`@deepseek-ai/dsh-sandbox-windows-acl` + `@deepseek-ai/dsh-win32-process`** ⭐ **最相关**：
  纯 Node + koffi，无需 Rust；实现 restricted-token + ACL + Job Object + 管道 stdio，fail-closed；
  MIT 开源包（AGENTS.md §6 已授权可搬用内部资产）；`0.0.1-rc`，**partial enforcement**（自报）。
- **`@anthropic-ai/sandbox-runtime`（srt）** ⭐ **跨平台抽象的样板**：Claude Code `/sandbox` 的开源核心。
  Windows alpha：`srt-win.exe`（**Rust** helper，两跳 `CreateProcessWithLogonW`）+ `srt-sandbox` 本地账号 +
  **WFP egress fence**（按 SID 阻断，只放行 loopback 代理端口）+ NTFS 加可继承显式 ACE（只加不改、reset 时移除）。
  限制：Windows alpha、需一次 UAC 提权安装；schannel 吊销检查会被 WFP 拦；per-user 安装的工具链
  （nvm/scoop/pip --user）沙箱账号打不开【项目源码：GitHub README + npm】。
- **第三方生态**：`opencode-sandbox-win`（把 srt 包成 OpenCode 插件）、`zagens-windows-sandbox`（Rust 版同机制）、
  以及 dsh 的多个 fork——说明该模式在 2026 年已被多次独立复现。
- 上游资料：`openai/codex` 的 `codex-rs/windows-sandbox-rs` + `codex-command-runner.exe`/`codex-sandbox-setup.exe`
  四层架构（Rust，非 Node，但机制可照学）。

**未查到**：把 codex 的 `windows-sandbox-rs` **直接**移植成 Node 的项目；但 dsh 的 koffi 端口等价覆盖了
同一机制。

---

## 6. 两档方案能力矩阵（分水岭：是否需要提权安装）

> 上一版 `09-sandbox-and-permissions.md` 的结论是「搁置」；本轮把它具体化为「两档可选 + 各自边界可诚实描述」。

| 维度 | **零安装档**（dsh 同机制） | **提权档**（codex 同机制） |
|---|---|---|
| **机制** | 复制**当前用户自己的**令牌 → `WRITE_RESTRICTED` + restricting SID（logon SID + Everyone + workspace 写 SID + 私有 temp SID）；工作区/私有 temp 打写 ACE | 一次 UAC → 建专用本地账号（Offline/Online）+ 组 + DPAPI 存密码；`CreateProcessWithLogonW` 起 runner，runner 内再派生受限令牌；外加 WFP/防火墙按 SID 阻断 + deny-read ACL |
| **写隔离**（工作区外不可写） | ✅ 强（双次访问检查，写 ACE 只落工作区） | ✅ 强（同源机制） |
| **读隔离**（凭据读不到） | ❌ **无**（`WRITE_RESTRICTED` 只在写访问做交集） | ✅ deny-read ACL（codex 有 `deny_read_*` 一整套）。**注**：Windows 上「读受限」只有 elevated 后端支持，legacy 受限令牌做不到 |
| **网络隔离** | ❌ **无**（可自由开 socket） | ✅ WFP 持久过滤器（ICMP/DNS/DoT/SMB）+ 防火墙阻断非环回出站 + 代理端口白名单 |
| **进程可见性** | ❌ 无隔离 | ❌ 无隔离（两家都没做） |
| **控制台/UI 隔离** | ❌ 无（且 `CREATE_NO_WINDOW` 会让子进程 `0xC0000142` 崩，只能共享控制台） | ✅ 独立私有桌面（`CreateDesktopW`）——受限令牌下 PowerShell 不设 `lpDesktop` 会 `STATUS_DLL_INIT_FAILED` |
| **覆盖威胁 A**（跑不可信代码） | 🟡 **部分**：改不坏工作区外，但**读得走、传得出** —— 风险从「破坏系统」降级为「读取+外带」 | ✅ **接近**：写受限 + 读受限 + 断网，三面合围 |
| **覆盖威胁 B**（模型误操作文件） | ✅ 覆盖（最直接的价值） | ✅ 覆盖 |
| **覆盖威胁 D**（凭据泄露） | 🟡 **只防写坏，不防读走**（而我们本来就有 `web_fetch` 外发通道） | ✅ 读写都封（deny-read 清单：`.ssh`/`.gnupg`/`.aws`/`.kube`/浏览器凭据…） |
| **已知绕过点**（实证自述） | Everyone 有写位的外部目录仍可写；**NTFS 硬链接是文件对象别名**；FAT 卷无 ACL 照写；无 world-writable 目录告警 | 同样有 Everyone/硬链接问题，**但**专门扫「人人可写目录」并警告 + 尽力 deny；symlink 竞态自标 best-effort；**对管理员用户几乎无约束** |
| **用户首次代价** | **零**：随包分发、无 UAC、无安装、无账号 | **一次 UAC 提权 + 系统多 2 个账号 1 个组**（登录界面可隐藏，`net user` 仍可见）；企业策略可能直接挡（Secondary Logon 被禁、禁建本地账号、防火墙策略被 GPO 覆盖 → codex 有 `HelperFirewallPolicyIneffective` 错误码） |
| **日常代价** | 无 | 无（装完之后不再提权） |
| **卸载/残留** | 工作区留该 SID 常驻 ACE（隐性残留；用户 `icacls /remove` 会 `ERROR_NONE_MAPPED` 失败） | 同左，**且** codex 全 crate **没有任何 uninstall 逻辑**——账号/组/WFP 规则得自己写清理 |
| **杀软/EDR 敏感度** | 中（FFI + 令牌操作） | **高**（创建账号 + 改 ACL + 改防火墙，是最典型的恶意行为特征） |
| **开发量** | **中低**：dsh 是纯 TS + koffi，`token/acl/spawn/ffi/workspace-sid/runner` 可直接搬；核心就是 `AclSandbox` 类 | **高**：codex 是 67 个 Rust 文件 ~21k 行；Node 重写即便砍掉网络/桌面也需提权编排 + 账号组管理 + DPAPI + deny-read glob 遍历 + runner 命名管道 IPC + 就绪版本校验与失败关闭 |
| **打包/依赖** | koffi（各平台预编译二进制，无需编译器）；**需实测 ASAR 内加载**（官方只给了 electron-builder/Forge 范例） | 同左 + helper 二进制的分发与版本管理（codex 用 `helper_materialization` 拷贝到 `.sandbox-bin` 并锁 ACL） |
| **失败模式** | 失败即抛错、不裸跑（**fail-closed**，dsh 构造保证；runner 用退出码 127 + stderr 签名标记） | 同样 fail-closed（codex：marker 版本不符就报错拒绝执行，**不静默降级为无沙箱**）。但失败面大得多——每一步都可能因企业策略失败，用户会直接「用不了」 |
| **诚实上报** | dsh 自报 `enforcement: 'partial'`（原因写死：Everyone 必须留在 restricting 列表 + 硬链接别名） | 也是 partial（world-writable 扫描限时限额、symlink best-effort） |

### 从矩阵读出的三条判断

1. **两档的差别其实只有两项：读隔离 + 网络隔离**；写隔离同源同强。而后两项恰好是
   **威胁 A 与 D 的读侧**的封堵手段。
2. **我们当前最痛的威胁不是 A**：现在没有 bash、powershell 有危险命令检查器——威胁 A 的入口
   被堵着；真正天天发生的是 B（误操作）与 D（读到凭据后有 `web_fetch` 外发通道）。
   **零安装档正好覆盖 B，并把 D 的「写坏」侧堵上**。
3. **提权档的开发量与失败面，与项目既有理念有张力**：AGENTS.md 明确写过「不要求用户机器上
   预装 Python / Git for Windows」——这个取舍的偏好很清楚。提权档要求首次使用过 UAC、系统里
   常驻两个账号、还要自己写卸载；企业环境下 GPO 一挡就是「功能不可用」。

---

## 7. 对我们的关键启示（汇总）

1. **选型落点**：Node 侧**用 koffi**（不要 ffi-napi，不要为了这事引 Rust）。架构上**照 dsh 那套来**——
   `WRITE_RESTRICTED` 令牌 + 派生写 SID + workspace/temp ACE + Job Object + koffi 绑定的
   `CreateProcessAsUserW`，**纯 Node、无 helper exe、fail-closed**。`@deepseek-ai/dsh-sandbox-windows-acl` /
   `dsh-win32-process` 是可直接学习甚至搬用（AGENTS.md §6 已授权）的**同机制 Node 实现**，
   比从 codex 的 Rust 重写省一个数量级工作量。
2. **想清楚「网络隔离」的档**：**不掏管理员**只能做文件写限制 + advisory 网络抑制（codex 都认为不够，
   才转提权）；**要真拦网络**就得一次性提权 + 独立沙箱账号 + WFP/防火墙规则（srt 的 Windows 模型
   可直接抄：WFP 按 SID 阻断、只放行 loopback 代理端口）。**建议先落「同用户受限令牌」这档，
   把提权档做成可插拔的第二级**（对应 AGENTS.md 的「抽象位」）。
3. **跨平台抽象照抄接口形状**：用 `SandboxManager.initialize(policy)` + `wrapWithSandbox(command)` 这种
   「策略描述上层 / 平台实现下层」的形状（srt 已验证），Windows 先接「受限令牌」后端，
   Linux/macOS 预留 bwrap/seatbelt 后端。**Electron 侧记牢：utilityProcess 只能当编排者，
   不能当沙箱执行体；`sandbox:true` 是 Chromium 沙箱，与 OS 沙箱无关**。
4. **诚实上报**（沿用并强化 09 笔记已定口径）：`SandboxEnforcement = 'full' | 'partial'` + **reason 枚举**
   （参考 WorkBuddy 的 `sandboxSafetyEnabled` + `sandboxDisabledReason`「二元 + 原因」，
   而不是假装有沙箱）。这正是 pi 文档警告的「错误的安全感」的解药。
5. **必须处理的边界（否则又是「假边界」）**：
   - Everyone 的 ambient write ACE + NTFS 硬链接 → 承认它是 partial，不要宣称 full；
   - 无 world-writable 目录告警（dsh 明确 deferred；codex 专门扫）→ 我们至少要做「扫描 + 提示」；
   - symlink 竞态 best-effort（codex 自标）→ 在 deny-read/写 ACE 时考虑 `OBJ_DONT_REPARSE`；
   - 对管理员用户几乎无约束 → 这是 Windows 安全模型的固有边界，**要在文档里写清**，不是漏洞。

---

## 附 A · 分歧与更正（本轮修正的旧结论）

| 旧结论（来源） | 更正为（证据） |
|---|---|
| WorkBuddy = 「内核态过滤驱动 tsbx.dll」 | **用户态 Rust 栈**：无 `.sys`、无 AppContainer/JobObject/受限令牌命中；对外接口是 `sandbox-cli.exe` 的 IPC（§4.1、§4.9） |
| dsh 的 Windows 沙箱「不可借鉴 / 成本高」 | **可直接移植**：`sandbox-windows-acl` 是纯 TS + koffi、零安装、fail-closed、MIT（§3） |
| 「Windows 做不了沙箱」 | **错**：codex 与 dsh 各有一份独立实现，机制都是受限令牌 + ACL；正确说法是「成本高、可按档选」 |
| 受限令牌做「读受限」 | 只有 **elevated 后端**支持（`WRITE_RESTRICTED` 只对写做交集；deny-read 需专用账号 + ACL）——legacy 受限令牌做不到（§2.3、§2.5） |

## 附 B · 未查清 / 存疑项（如实标注）

- `@deepseek-ai/dsh-win32-process` / `dsh-sandbox-windows-acl` 的**完整源码细节**（本轮依据 npm README
  与仓库路径引用，未逐行通读源码）；其为 `0.0.1-rc` 且自报 partial enforcement。
- Node **26.1 内建 `node:ffi`** 是否/何时能在 Electron 中使用：**未查到明确证据**。
- koffi 在 **ASAR + utilityProcess** 组合下的具体打包行为：官方只给了 electron-builder/Forge 范例，
  **未查到**关于 ASAR 内加载的明确说明——**建议实测**。
- `tsbx_rules.json` 的运行时生效副本落盘路径（推测 `%LOCALAPPDATA%\WorkBuddy\`，无代码证据）。
- 各 DLL 的字符串级作用（§4.1 表格 DLL 部分）—— 二手（未反编译）。
- WorkBuddy 桌面端 `permissionMode` 的**会话默认值来自哪**（确认了「归一化未知→bypass」，
  但没追到 UI/DB 给每个会话写入的具体默认值；背景自动化明确是 fullAccess）。
- codex 的「人人可写目录」扫描是否覆盖 NTFS junction/挂载点：实证只覆盖「一层 + 候选根」，未深查。
