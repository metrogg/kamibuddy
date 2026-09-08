# 09 · 沙箱与权限：四方对比与我们的路线

> 分析日期：2026-09-08。目的：为 KamiBuddy 的沙箱/权限模块定路线。
> 证据等级标注：**【实测】**=本机验证过；**【源码】**=读过实现；**【文档】**=官方文档原文；
> **【记忆】**=模型知识，未在本次会话验证（用前需复核）。

---

## 一、三个决定性事实（先看这个，会改变方案选择）

### 1. pi **故意不做沙箱**，且明说"部分沙箱比没有更危险"【文档】

`docs/security.md` 原文（§No Built-in Sandbox）：

> Pi does not include a built-in sandbox. … This is intentional. **A partial in-process
> sandbox would be easy to misunderstand as a security boundary** while still depending on
> the host shell, filesystem, package managers, credentials, and extension code.
> **Real isolation needs to come from the operating system or a virtualization/container boundary.**

扩展与 pi 同权限运行。这句话直接否掉了"我们在 daemon 里写一个进程内沙箱"的方案——
不是做不出来，是做出来会给人错误的安全感。

### 2. **pi 自己**的沙箱扩展不支持 Windows，但这不代表"没有方案"【源码】

`examples/extensions/sandbox/index.ts:251-254`：

```ts
const platform = process.platform;
if (platform !== "darwin" && platform !== "linux") {
    ctx.ui.notify(`Sandbox not supported on ${platform}`, "warning");
```

它依赖 `@anthropic-ai/sandbox-runtime`（macOS Seatbelt / Linux bubblewrap）。
另一条路 Gondolin 微 VM 需要 **QEMU + Node ≥ 23.6**（我们锁 Node 22.19，
且目标用户是行政/产品/销售，不会装 QEMU）。

> ⚠️ **初版结论已更正**（2026-09-08）：初版写「我们的目标平台恰好是所有现成方案都不
> 支持的那个」——**凭记忆下的判断，错了**。读完 `开源项目/` 下 codex 与 deepseek-harness
> 的源码后确认：**Windows 沙箱真实存在，且有两份独立实现**。见事实 4。

### 3. WorkBuddy 在 Windows 上是**自研内核级沙箱**——我们复制不了【源码】

它的三分支架构：

| 平台 | 方案 |
|---|---|
| Linux | `@anthropic-ai/sandbox-runtime`（bubblewrap） |
| macOS | 同上（Seatbelt）+ 自带 toybox/zsh 受控用户态 |
| **Windows** | **腾讯自研 `sandbox-cli` 5.4.7**：`tsbx.dll` / `tsbx_sdk.dll` / `sandbox_ffi.dll` / `sandbox-center.exe` / `betterleaks.exe`（密钥泄漏扫描） |

外加 287MB 用户态 + 一整套语言 shim。这是多人年的工程量，我们两周内做不到，
硬做只会做出事实 1 说的那种"看起来安全"的东西。

### 4. ★ Windows 沙箱**真实存在**，且 codex 与 dsh 各有一份独立实现【源码】

这条推翻了初版的判断。证据来自仓库内 `开源项目/`：

**codex：`codex-rs/windows-sandbox-rs`**（约 40 个源文件）——不是 WSL 转发，是原生实现：

| 源文件 | 作用 |
|---|---|
| `identity.rs` | 创建**专用沙箱用户账号**（username/password，经 `dpapi.rs` 保护） |
| `acl.rs` / `deny_read_acl.rs` | 按 ACL 授予/收回文件访问；`deny_read_walker.rs` 递归处理禁读树 |
| `cap.rs` | 能力（capability）限制 |
| `desktop.rs` | 独立桌面隔离（防 UI 层面的越界，如模拟输入） |
| `hide_users.rs` | 隐藏沙箱账号，不污染登录界面 |
| `elevated/` + `bin/setup_main` | **一次性管理员安装**（`codex-windows-sandbox-setup`） |
| `bin/command_runner` | 受限身份下的命令执行器（`codex-command-runner`） |
| `audit.rs` | 审计 |

协议层（`app-server-protocol/src/protocol/v2/windows_sandbox.rs`）：

```rust
enum WindowsSandboxSetupMode  { Elevated, Unelevated }
enum WindowsSandboxReadiness  { Ready, NotConfigured, UpdateRequired }
struct WindowsWorldWritableWarningNotification { sample_paths, extra_count, failed_scan }
```

最后一个类型很有意思：它会**扫描"人人可写"的目录并警告**——因为沙箱用户若能写这些
目录，隔离就被绕过了。这是自研沙箱容易漏的一环。

**dsh：`packages/shell/pwsh-sandbox`** 自述（文件头原文）：

> It wraps the exact local pwsh argv through `ctx.sandbox` (which on Windows resolves to
> the **ACL restricted-token runner chain**), inherits local process mechanics, and reports
> the selected mode, enforcement, and denial facts.

两家独立收敛到**同一机制：受限令牌（restricted token）+ ACL**。这就是 Windows 上的正解，
WorkBuddy 的 tsbx.dll 只是同一思路的更深实现（内核态过滤驱动）。

**但成本仍然很高，因此本轮搁置**：
- 需要**一次性管理员权限安装**并创建系统账号——对"给同事试用"是显著摩擦；
- codex 那份是 Rust 40 文件，我们无法复用，只能同机制重写（Node 侧要么写原生模块、
  要么脚本化 `icacls`/`runas`，两条都不轻）；
- 「人人可写目录」这类绕过点必须一并处理，否则又是一个"假边界"。

**结论**：Windows 沙箱不是"做不到"，是"这两周不值得"。搁置是排期决策，不是能力判断——
这个区别要写清楚，否则后人会以为此路不通。

---

## 二、WorkBuddy 的完整设计（值得抄的与不该抄的）

### 2.1 四层纵深

```
① 权限规则层（9 阶求值链）          管"想不想做"
② OS 沙箱层（bwrap/Seatbelt/tsbx）  管"能不能做"
③ 语言 shim 层（自研增量）           管"绕过 ① ② 的子进程"
④ 内容层（去毒/隔离上下文/写保护）    管"提示注入"
```

明确指出任一单层都不够：没有网络隔离的沙箱会泄 SSH key，没有文件隔离会后门系统。

### 2.2 权限 9 阶求值链（★ 最值得抄，且零平台依赖）

```
hooks → deny 规则 → 可信 allow → 命令安全检查（仅交互态）→ ask 规则
→ bypass 短路 → 不可信 allow → 模式基线 → 非交互兜底（auto/dontAsk 收口）
```

三个精髓：

- **deny 恒定优先**，任何模式都拦不住它；
- **allow 分「可信/不可信」两层**：未信任目录里的项目级 allow 规则**自动降级**，
  不能越过危险命令检查——防"打开一个别人给的文件夹就等于提权"；
- **受保护文件在所有模式下特殊处理**：`.git`、shell rc、`.npmrc`、配置目录、`.mcp.json`，
  即使 bypassPermissions 也拦。

### 2.3 Windows 文件策略（tsbx_rules.json）★ 思路可抄

```
default_action: deny_write        默认禁写，白名单放行
recyclebin_backup: true           删除进回收站，可恢复
auto_grant: true
no_access: %USERPROFILE%\.ssh\**, .gnupg\**
放行: Temp, npm/pnpm/Yarn 缓存, $RECYCLE.BIN
```

**`recyclebin_backup` 是办公场景最实际的一条**——不需要任何沙箱也能实现。

### 2.4 语言 shim 层（自研增量，思路可借，实现别抄）

`NODE_OPTIONS --require` 注入 → patch `fs` 删除/写入 API → 经 broker IPC 向宿主申请
file-token；PATH 前置 `safe-bin/{rm,rmdir,unlink}` 替身；30 个 brokered-bin toybox 转发；
`sitecustomize.py` 管 Python 侧。

⚠️ **一个必须记住的教训**：`node-brokered-fs-shim.cjs` 的头部注释自述
**broker 失败时 fail-OPEN，静默退化为原生 fs**。也就是说这层在 broker 挂掉时
完全失效且无声——**这正是事实 1 警告的"看似是边界，其实不是"**。
若我们做类似的东西，必须 fail-closed。

### 2.5 桌面层的实际姿态（反直觉，重要）

WorkBuddy 桌面端跑 CLI 时用的是 **`--permission-mode bypassPermissions`**
+ `trustedDirectories` 限定工作区（`server.js:128594` 的 `buildAgentCliRuntimeArgs`）。

即：**它在产品里把 CLI 的交互式审批关掉了**，安全闸门换成：
① CLI 侧 trustedDirectories 路径约束 + ② daemon 侧 SecurityCenter 对 ACP 工具调用做
审计与规则拦截（`security-center/audit-acp-adapter.ts`）+ ③ OS 沙箱。

**启示**：产品级 agent 不能靠"每次弹窗问用户"——那会让人放弃使用。
要靠"路径归属默认放行 + 危险动作集中拦截 + 全程审计"。我们的权限门方向是对的。

---

## 三、pi 能直接拿来用的东西

| 机制 | 用途 | 我们的状态 |
|---|---|---|
| `tool_call` 事件（可 block） | 权限门的挂载点 | ✅ 已用（permission-gate.ts） |
| **`project_trust` 事件**【文档】 | 首个扩展返回 yes/no 即决定是否加载项目级资源 | ❌ **未用，建议接**：打开别人给的文件夹时该问一句 |
| `defaultProjectTrust` 设置 + `trust.json` | ask/always/never，按目录记住决定 | ❌ 未用 |
| `examples/extensions/sandbox/` | OS 沙箱参考实现 | ⚠️ **Windows 不可用**，但**配置模型可抄**（见下） |
| `examples/extensions/dirty-repo-guard.ts` | 脏仓库守卫（动手前先查状态） | 可参考 |
| `examples/extensions/bash-spawn-hook.ts` | 拦截 bash 子进程 | 若开 shell 则参考 |
| `createBashTool` + `BashOperations`（包根导出） | **可替换 bash 的底层执行**（沙箱扩展就靠它） | 若开 shell 则是关键钩子 |
| 内置 `powershell` 工具 | Windows 原生，**不依赖 Git Bash** | 若开 shell，走这条 |

pi sandbox 扩展的**配置模型**值得照抄（平台无关的部分）：

```json
{
  "network":    { "allowedDomains": ["..."], "deniedDomains": [] },
  "filesystem": { "denyRead": ["~/.ssh", "~/.aws"], "allowWrite": [".", "/tmp"], "denyWrite": [".env"] }
}
```

---

## 四、codex / dsh 的权限策略

### Codex CLI【源码】

两个正交轴（分法很干净，建议直接采用）。

**沙箱模式**（`protocol/src/config_types.rs:104`，serde 名即配置值）：

```rust
enum SandboxMode {
    #[default] ReadOnly,      // "read-only"
    WorkspaceWrite,           // "workspace-write"
    DangerFullAccess,         // "danger-full-access"
}
```

注意 **默认是 `read-only`**——最小权限起步，要写就得显式选。

**审批策略**（`protocol/src/protocol.rs:980`）：

```rust
enum AskForApproval {
    UnlessTrusted,                    // "untrusted"：除白名单规则外都要批
    #[default] OnRequest,             // "on-request"（别名 "on-failure"）：模型自行决定何时问
    Granular(GranularApprovalConfig), // 逐流程细粒度开关
    Never,                            // 从不问，失败直接回给模型
}
```

> ⚠️ **初版错处已更正**：初版把 `on-failure` 与 `on-request` 列为两个独立值，
> 实际上 **`on-failure` 只是 `on-request` 的 serde 别名**（同一个值）；
> 且初版**漏了 `Granular`**。

`Granular` 是这套设计里最精细的一层——把"要不要问"按**审批来源**拆开：

```rust
struct GranularApprovalConfig {
    sandbox_approval: bool,     // shell 命令提权请求
    rules: bool,                // execpolicy 的 prompt 规则触发
    skill_approval: bool,       // 技能脚本执行
    request_permissions: bool,  // request_permissions 工具
    mcp_elicitations: bool,     // MCP elicitation
}
```

字段为 `false` 时**该类请求自动拒绝而不是弹给用户**——即"这类事永不打扰我，直接拒"。
这比一个全局 ask/never 开关表达力强得多，值得作为我们后续的演进方向
（第一版可以先只做 ask/never，但**类型上留好扩展位**）。

- 实现：macOS Seatbelt、Linux Landlock+seccomp、**Windows 原生 ACL 受限令牌**（见事实 4）。

### dsh（DeepSeek Harness）【源码】

- 一切皆插件（Cordis），沙箱/权限也是插件位，没有特权内核；
- **沙箱模式词汇与 codex 逐字相同**（`packages/sandbox/sandbox/src/index.ts`）：
  `'read-only' | 'workspace-write' | 'danger-full-access'`；
- **审批策略更简**（`packages/interaction/user-approval/src/index.ts:59`）：
  `type ApprovalPolicy = 'ask' | 'never'`，且 `never` 的语义是
  **确定性拒绝**（"every ask resolves 'rejected' deterministically"）而非静默放行；
- 权限预设 = 双旋钮的捆绑包（`packages/interaction/permission-presets`，见 §5）；
- `web_fetch` 在部分 provider 下**因 SSRF 保护被禁用**——把 SSRF 当默认威胁
  （我们的 web-fetch 已做内网拦截，方向一致）。

**共同结论（已更正）**：Windows 沙箱**有两份独立实现**（codex 的 windows-sandbox-rs、
dsh 的 pwsh-sandbox），机制都是 **ACL + 受限令牌**；pi 自己不做、指向容器/VM；
WorkBuddy 用内核态 tsbx.dll 走得更深。
**"Windows 做不了沙箱"是错的判断，正确的说法是"成本高，本轮不做"。**

---

## 五、给我们的路线（按"两周内能交付的安全价值"排序）

### 前提：我们的威胁模型 = 编码 agent 的威胁模型 **∪** 办公场景特有的

> ⚠️ **本节初版结论已更正**（2026-09-08，用户指出）：初版把产品定位写成「办公 agent」，
> 据此推出「OS 沙箱作用有限」。**定位错了**：KamiBuddy 的前提是**通用 agent**（编码能力
> 必须具备），办公只是在通用底座上叠加**场景适配与能力模板**。
> 这与既有架构一致——场景轴本来就是 work / code / design（对齐 WorkBuddy 的 welcomemode），
> code 一直在能力面里，只是尚未 ready。是初版忽略了场景轴的存在。

| | 威胁 | 谁能防 |
|---|---|---|
| **A. 跑不可信代码** | 恶意 npm 包、仓库里的构建脚本、模型下载执行的东西 | **只有 OS 沙箱**。回收站/checkpoint 完全无效 |
| **B. 模型误操作真实文件** | 「帮我整理文档」覆盖了季度报告 | 权限门 + 回收站 + checkpoint。**沙箱无效**（文件本来就该可写） |
| **C. 提示注入** | 网页/仓库文件里的伪造指令 | 内容层（不可信标记、输出去毒）+ 权限门拦后续动作。**沙箱无效**（pi security.md 明说） |
| **D. 凭据泄露** | `.ssh`、浏览器密码库、auth.json | 受保护路径禁读禁写（**当前只禁写配置目录，是缺口**） |

**四类威胁需要四种不同的防线，没有任何一种能覆盖其他三种。**
初版的错误在于只认了 B、C 而忽略 A——一旦编码能力在射程内，A 就是真实威胁，
而它**只能靠 OS 沙箱**。

**这也解释了为什么"搁置沙箱"必须附带一个诚实声明**：搁置期间 A 类威胁**没有防线**，
只能靠"不让模型执行不可信代码"这个约定（工具面不给 shell / 只给受检查的 PowerShell）。
这不是安全边界，是使用约束——必须在文档与界面上说清楚，不能让人误以为有沙箱。

下面的顺序按**当前排期下的实际风险削减量**排：B、C、D 立刻可做且成本低，A 需要沙箱。

### 阶段 1 · 误操作防护（★ 最高性价比，1-2 天，零平台依赖）

1. **删除/覆盖进回收站**（抄 WorkBuddy 的 `recyclebin_backup`）：
   写文件前若目标已存在 → 先备份；删除 → 走回收站而非 unlink。
   Windows 上用 `SHFileOperation`/PowerShell 或自建 `~/.kamibuddy/trash/` 快照。
   **这一条能挡住 90% 的"我的文件没了"事故。**
2. **受保护路径清单**（抄 tsbx_rules.json 的 no_access）：
   `.ssh` / `.gnupg` / 浏览器凭据库 / 密码管理器目录 → **禁读也禁写**
   （注意：我们现在只禁写配置目录，`.ssh` 是可读的）。
3. **审计日志**：所有写/删操作落 JSONL（`core/event-log.ts` 已有底座），
   出事能回答"什么时候改了哪个文件"。
4. **checkpoint / 回滚**：每轮对话前对将被修改的文件做快照，
   支持"撤销这一轮"（WorkBuddy 与 Claude Code 都有，跨会话保留 30 天）。

### 阶段 2 · 权限模型升级（2-3 天，零平台依赖）

1. **借鉴 9 阶求值链**，把现在的三分支（allow/ask/deny）扩成有序链：
   deny → 可信 allow → 危险动作检查 → ask → 模式基线 → 兜底；
2. **allow 分可信/不可信**：用户「打开本地文件夹」选进来的目录属于不可信来源，
   其内的规则不能越过危险检查（防"别人给的文件夹"）；
3. **接 pi 的 `project_trust` 事件**：打开陌生目录时问一次，决定存 `trust.json`；
4. **模式化**：借 Codex 的两轴分法——
   `工作范围`（只读 / 工作区可写 / 完全访问）×`审批策略`（每次问 / 失败才问 / 不问），
   映射到我们已有的 ask/craft 交互轴上，别再造第三个概念。

### 阶段 3 · PowerShell（决策 A 已定）与 OS 沙箱（决策 B：本轮搁置）

见 §6 已定的决策。PowerShell 需配危险命令检查器；OS 沙箱搁置期间
`SandboxEnforcement` 一律 `partial` 并在界面如实说明。

---

## 六、已定的决策（2026-09-08，用户拍板）

### 决策 A：只开 PowerShell ✅

AGENTS.md §2 原本写"**一行 shell 都不许碰**"，理由是 pi 在 Windows 找不到 bash
会直接抛异常（`utils/shell.ts:100`），而目标用户不装 Git for Windows。

**该理由只否掉 bash，不否掉 PowerShell**——pi 内置 `powershell` 工具是 Windows 原生的，
不依赖 Git Bash。所以原约定的**事实依据仍然成立，结论需要收窄**：
从"不许碰 shell"改为"**不用 bash；PowerShell 经危险命令检查后可用**"。

配套必须有：危险模式检查器（`iex` / `Invoke-Expression` / `Add-Type` /
`-EncodedCommand` / 递归删除 / 下载执行等），参考 WorkBuddy 的 PowerShell 工具
（其自述内置 `iex`/`Add-Type` 拦截）。

**AGENTS.md §2 与 ARCHITECTURE.md 需同步改，并写明改动理由**（否则后人会以为约定被随意破坏）。

### 决策 B：OS 沙箱本轮搁置 ✅

**搁置理由是成本与排期，不是"做不到"**（见事实 4：codex 与 dsh 各有一份 Windows 实现）：

- 需一次性**管理员权限安装 + 创建系统账号** → 对"给同事试用"是显著摩擦；
- codex 那份是 Rust 40 文件，无法复用，只能同机制重写（Node 侧要写原生模块或
  脚本化 `icacls`/`runas`）；
- 「人人可写目录」这类绕过点必须一并处理，否则又是一个"假边界"。

**搁置期间必须诚实声明**：A 类威胁（跑不可信代码）**没有技术防线**，
只靠"工具面不给 bash、PowerShell 经检查"这个使用约束兜住。
`SandboxEnforcement` 一律上报 `partial`，界面如实说明——
绝不能让用户以为有沙箱（这正是 pi security.md 警告的"错误的安全感"）。

### 决策 C：权限模型先做 ✅

顺序：**权限预设 → 受保护路径/项目信任 → （PowerShell）→ T11**。

**关于"会不会与现有设计冲突"（用户提问）**：不冲突，但有一处必须现在处理好。

现有三个相关概念：

| 概念 | 现状 | 管什么 |
|---|---|---|
| 交互轴（ask/craft） | ✅ 已有 | **工具白名单** + 提示词片段 |
| `permission-policy` | ✅ 已有 | 路径归属 → allow/ask/deny |
| 权限预设 | ❌ 要加 | 沙箱模式 × 审批策略 |

**好消息**：现有 `permission-policy` 的行为（工作区内放行、区外询问、配置目录拒）
**精确等于 `workspace-write` + `ask`**。所以加预设不是重写，是把硬编码的模式**变成参数**：
`decide(facts, paths, cwd)` → `decide(facts, paths, cwd, mode)`，默认值 = 今天的行为，
**向后兼容，23 个既有测试全部保留**。

**唯一真冲突点**：交互轴与沙箱模式**语义重叠**。ask 模式的工具白名单本来就没有 write，
再选 `read-only` 是重复；反过来 craft（有 write 工具）配 `read-only` 会出现
**工具在清单里、每次写都失败**的困惑状态。

解法（三家都是让两者正交并存，我们同样正交，但补一条）：
**交互轴提供预设默认值，用户可覆盖，两者背离时界面显式提示"自定义"**。

- ask → 默认 `read-only` + `ask`
- craft → 默认 `workspace-write` + `ask`
- 用户想在 craft 里临时只读 → 允许，界面显示「当前：自定义」

预设表放 `resources/`（AGENTS.md §3 能力即数据，避免 `if (mode === 'ask')`）。

---

## 七、结论速览（2026-09-08 更正版）

1. pi 明确不做沙箱，且警告"部分沙箱是错误的安全感"——**真隔离必须来自 OS/VM**；
   但它把**策略层钩子给全了**（`tool_call` 可 block、`project_trust`、工具同名覆盖、
   `createBashTool` 替换底层执行）；
2. ~~所有现成方案在 Windows 上都不可用~~ → **错，已更正**：
   **Windows 沙箱有两份独立实现**（codex `windows-sandbox-rs`、dsh `pwsh-sandbox`），
   机制都是 **ACL + 受限令牌**。正确说法是"**成本高，本轮不做**"；
3. **业界已收敛出同一套权限模型，直接采用不要自创方言**：
   沙箱模式 `read-only` / `workspace-write` / `danger-full-access`（codex 与 dsh 逐字相同，
   默认 `read-only`）× 审批策略（dsh 极简 `ask`/`never`；codex 多一个
   `Granular` 按审批来源分别开关，是好的演进方向）；
4. **预设 = 双旋钮的捆绑包**（dsh `permission-presets`）：旋钮是真相，预设是 UI 糖；
   预设记录用户意图为 durable event，执行只读旋钮；不匹配任何预设时显示 `custom`；
5. 提权只能**严格变宽**（dsh `WIDER_MODES`），审批 **fail-closed 且先于执行**；
   检查在执行期而非 schema 期（schema 是注册期全局的，有效模式是每次调用的真相）；
6. **诚实上报能力**：`SandboxEnforcement = 'full' | 'partial'`，
   `partial` 意味着"不能保证所有承诺的文件效果"，调用方**不得当作绝对边界**；
7. 最该抄的（全部零平台依赖）：**9 阶求值链**、**allow 可信/不可信分层**、
   **删除进回收站**、**双旋钮+预设**；
8. 最该记住的反面教材：WorkBuddy 的 broker shim **fail-open**（broker 挂了静默退化为
   原生 fs）——我们若做类似拦截**必须 fail-closed**；
9. ~~我们的威胁模型是"模型对真实文件干错事"~~ → **已更正**：
   我们是**通用 agent**，威胁模型是 A(跑不可信代码) ∪ B(误操作文件) ∪ C(提示注入) ∪
   D(凭据泄露)，**四类需要四种防线，无一能覆盖其他三种**。
   本轮做 B/C/D，A 随沙箱一起搁置并诚实声明。
