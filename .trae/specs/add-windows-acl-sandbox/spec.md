# OS 级沙箱一期：Windows 受限令牌写约束（powershell 收敛）Spec

## Why

**要解决的实际缺口**（`src/extensions/permission-policy.ts:441-459` 写在注释里）：
**一条命令就能绕开权限门的全部路径保护**。权限门看得见 `write`/`edit` 的目标路径，
看不见 `powershell` 命令内部要写哪儿；`command-guard.ts` 自己的文件头也承认它是
best-effort ——「base64 重编码、变量拼接、写个脚本文件」三种都能绕过。今天唯一的
实际防线是「shell 在任何权限档都逐次问用户」，而用户面对一长串 PowerShell
通常看不出它要写哪里。

**为什么现在能做了**：`docs/ARCHITECTURE.md` §4.4b 当年搁置 OS 沙箱，两条理由
**现已全部不成立**：

1. 「需管理员安装 + 创建系统账号」——`docs/workbuddy分析/11-windows-sandbox-deep-dive.md`
   查明 dsh 的做法**只复制调用方自己的令牌**，不建账号、不需 UAC：授权目标是调用方
   **自己拥有**的目录，而所有者天然持有 `WRITE_DAC`。
2. 「codex 那份是 Rust，无法复用」——dsh 那份是**纯 TypeScript + koffi、MIT 许可**，
   已完整躺在 `开源项目/deepseek-harness/packages/sandbox/sandbox-windows-acl/`，
   可以逐文件搬而非同机制重写。

**阶段 0 spike 已闸门通过**（三项。脚本是一次性的，价值已转化为 `src/sandbox/`
与 `src/sandbox/confinement.win.test.ts`，验证完即删除，不留第二份会腐烂的实现）：

- **S1**：koffi 在 Electron 44 的 `utilityProcess` 里 7/7 全绿（`createRequire` 与 ESM
  `import` 两条路径、真实 FFI 调用、`koffi.alloc` out 参数、`OpenProcessToken` 指针往返、
  `STARTUPINFOW` 布局 104 字节与 Win32 x64 ABI 相符）。V8 memory cage 对 koffi 无影响
  ——它是 N-API 模块，与结构性失效的 `ffi-napi` 不同。
  附带结论：koffi 3.3.0 用 per-platform optionalDependencies 分发预编译产物
  （`@koromix/koffi-win32-x64/win32_x64/koffi.node`），**打包不需要 cnoke/MSVC 工具链**。
- **S2**：受限令牌 + ACL 授权 + piped spawn 端到端 10/10，`powershell.exe` 与 `pwsh` 各 5 项。
- **S3**：显式环境块可用（详见下方「已推翻的上游结论」）。

## What Changes

- **新增 `src/sandbox/` 层**（第 9 层）：从 dsh 移植受限令牌 + ACL + piped spawn，
  约 2000 行 Win32 FFI。对外只暴露 `probeSandbox()` 与 `runSandboxed()` 两个窄口。
- **powershell 工具经沙箱执行**：`workspace-write` 档下命令在受限令牌里跑，
  「写不出工作区」成为**操作系统保证的事实**，而不是命令文本匹配的猜测。
- **诚实上报**：`SandboxEnforcement` 仍为 `partial`（读与网络都不受约束），
  新增 `SandboxUnavailableReason` 原因枚举，设置页如实显示是否生效及为何不生效。
- **审批判定链一行不改**：本期纯纵深防御，`permission-policy.ts` 与现有 23 个权限
  测试全部不动。审批放松另开一期（理由见「明确不做」）。

## Impact

- Affected specs: 权限模型（**新增执行层，判定层不变**）、`harden-permission-boundary`
  的「明确不做」条目（那条搁置声明被本变更取代）
- Affected code:
  - `src/sandbox/**`（**新**，约 2000 行；含 `index.ts` `token.ts` `acl.ts` `ffi.ts`
    `win32-abi.ts` `workspace-sid.ts` `grant.ts` `path-boundary.ts` `spawn.ts` `process.ts`）
  - `scripts/check-dependency-rules.ts`（`LAYERS` 与 `ALLOWED_INTERNAL` 是硬编码表，三处改动）
  - `src/extensions/powershell-tool.ts`（`runCommand` 改注入式，照 `src/documents/docx-env.ts:20-24` 已有约定）
  - `src/shared/permissions.ts`（加 `SandboxUnavailableReason`、`PermissionInfo` 带原因）
  - `src/daemon/index.ts`（会话建立时探测 + 首次授权；`buildPermissionInfo` 按探测结果生成文案）
  - `package.json`（新增依赖 `koffi` 3.3.0，精确版本）
  - `docs/ARCHITECTURE.md` §4.4b（搁置决策改为已落地 + 已知边界）、`docs/STATUS.md`

## ADDED Requirements

### Requirement: 工作区写约束由操作系统强制

`workspace-write` 档下 `powershell` 工具 SHALL 在 `WRITE_RESTRICTED` 受限令牌中执行，
工作区与私有 temp 目录经 capability SID 授写，其余位置的写入由操作系统拒绝。
每个 Win32 调用 MUST 检查返回值；任何失败 MUST NOT 以完整令牌 spawn 子进程
（上游 POC `huoyaoyuan/windows-acl-restrict-poc` 正是漏检导致失败时拿完整令牌运行）。

#### Scenario: 批准之后仍然写不出去
- **WHEN** 默认权限档，模型执行 `powershell` 往桌面写文件，用户**批准**了该次审批
- **THEN** 命令仍被操作系统拒绝写入，文件未创建（这是与今天行为的关键差异：今天批准即写成）

#### Scenario: 工作区内不受影响
- **WHEN** 模型在工作区内用 `powershell` 生成文件
- **THEN** 写入成功，行为与今天一致

### Requirement: 沙箱不替代危险命令检查器

`WRITE_RESTRICTED` 机制上**只约束写**，读与网络完全不受约束（S2 已实测：
受限子进程仍能读取工作区外的文件）。因此 `command-guard` 的 `credential-access`
等五类拦截 MUST 保持原样，MUST NOT 因「已有沙箱」而削弱。

三层分工 SHALL 明确记录在代码注释与架构文档中：
**权限门管问不问、检查器管能不能跑、沙箱管跑起来能碰到什么。**

#### Scenario: 读密钥仍只有检查器拦得住
- **WHEN** 受限令牌下执行 `type ~\.ssh\id_rsa`
- **THEN** 沙箱不拦（机制使然），由检查器的 `credential-access` 拒绝

### Requirement: 首次授权在会话建立时完成

ACL 授权开销随文件数**略超线性**增长（实测 100 文件 40ms、1000 文件 477ms、
5000 文件 3134ms，约 0.6ms/文件；外推几万文件即几十秒，codex 的「几十秒」说法可信）。
因此首次授权 MUST 在会话建立时进行，MUST NOT 懒加载到首次 `powershell` 调用
——否则用户的第一条命令会挂几十秒且毫无解释。
超过约 1 秒时 SHALL 给用户可见反馈。

幂等路径（`hasExactGrant` 命中）实测恒为 1ms 且与树大小无关（只读目录自身 DACL，
不遍历树），所以每次 spawn 调用 `grantWrite` 是安全的；又因 ACE 是**常驻**的，
只有「KamiBuddy 在该工作区上的第一次运行」付钱，之后每个会话都是 1ms。

#### Scenario: 大工作区不卡在第一条命令
- **WHEN** 工作区有上万个文件，用户新建会话后立刻让模型跑 `powershell`
- **THEN** 授权开销发生在会话建立阶段并有反馈，命令本身不额外等待

### Requirement: 可用性诚实上报

`SandboxEnforcement` MUST 保持 `partial`，MUST NOT 改为 `full` —— 三个洞真实存在：
读不受约束、Everyone 环境写 ACE、NTFS 硬链接是文件对象别名（工作区 ACE 会渗到外部文件）。

新增原因枚举（照 WorkBuddy 的「二值 + reason code」而非假装分级）：
`not-windows` / `ffi-load-failed` / `token-creation-failed` / `acl-grant-failed` /
`unsupported-filesystem` / `disabled-by-setting`。
`buildPermissionInfo` SHALL 按探测结果生成 `enforcementNote`
（§4.4b 当年承诺「将来接上真沙箱只改 `buildPermissionInfo` 一处」，本期兑现）。

#### Scenario: FAT 卷上不假装有沙箱
- **WHEN** 工作区落在 FAT/exFAT 卷上（无 ACL）
- **THEN** 探测报 `unsupported-filesystem`，设置页如实说明沙箱未生效

### Requirement: 探测失败时降级到今日行为并如实说明

探测失败（koffi 加载不了、令牌派生失败）时，powershell SHALL 降级为不经沙箱直接 spawn，
并在工具返回文本与审批弹窗中**说明沙箱未生效**，原因一路上报到设置页。

这**不是** WorkBuddy `node-brokered-fs-shim.cjs:41-42` 那种 fail-open：今天的行为本来
就是无沙箱，且权限门对 shell 逐次询问 —— 沙箱是**新增**的纵深防御，降级等于
「没有改善」，不等于「打开了一个洞」。

**但下一期放松审批时，判据 MUST 翻转为 fail-closed**：放松的依据就是沙箱存在，
所以探测不可用时不得放松、继续逐次询问。

#### Scenario: 降级不静默
- **WHEN** koffi 在某台机器上加载失败
- **THEN** powershell 仍可用（不倒退），但工具结果与设置页都明确写出沙箱未生效及原因

### Requirement: 已知边界必须写入文档

以下边界 MUST 在架构文档中如实记录，否则又是一个假边界
（§4.4b 与 pi 的 security.md 都警告过「半个沙箱是错误的安全感」）：

- 读完全不受约束；网络完全不受约束
- Everyone 可写的外部目录仍可写（dsh 缺「人人可写目录扫描告警」，codex 专门做了
  `WindowsWorldWritableWarningNotification`）—— 本期至少留下 TODO 与检测思路
- NTFS 硬链接：工作区 ACE 会渗到工作区外的同一文件对象
- FAT 卷无 ACL → 必须探测并报 `unsupported-filesystem`
- 常驻 ACE 残留：工作区上留下用户无法干净移除的 ACE（`icacls /remove` 报
  `ERROR_NONE_MAPPED`）。工作区是我们自己建的 `~/KamiBuddy`，可接受，但要写明；
  且它同时是性能设计的一部分（dsh 称之为 reuse cache）
- 管理员用户基本不受约束 —— 这是 Windows 安全模型的边界，不是我们的 bug
- `read-only` 会把 PowerShell 降到 ConstrainedLanguage（本期该档不进沙箱，暂无影响，
  但换档逻辑要记着）

#### Scenario: 后人不会误以为这是完整隔离
- **WHEN** 开发者阅读 §4.4b
- **THEN** 能看到沙箱已落地、强制力为 `partial`、以及上述每条洞的成因

## MODIFIED Requirements

### Requirement: OS 级沙箱的搁置决策

原决策（`ARCHITECTURE.md` §4.4b、`harden-permission-boundary` 的「明确不做」）：
搁置 OS 级沙箱，理由是需管理员安装 + 创建系统账号、codex 那份是 Rust 无法复用。

新决策：**零安装那一档落地**（受限令牌 + ACL，不建账号、不需 UAC、纯 TypeScript）。
**理由**：上述两条成本前提经调研与 spike 双重证伪（见 Why）。
**保留不变**：`SandboxEnforcement` 继续如实报 `partial`；提权那一档
（专用账号 + 禁读 + 禁网）仍然搁置，理由改为成本与收益不匹配（见「明确不做」）。

## REMOVED Requirements

无。不删除任何既有能力；powershell 的可用性、审批行为、检查器拦截全部保持。

## 明确不做（本变更范围外）

- **禁网**。`WRITE_RESTRICTED` 机制上碰不到 socket；codex 的禁网要防火墙 COM 规则 +
  WFP filter + 专用账号 SID，属于提权那一档。
- **放松审批**。本期判定链一行不改，现有 23 个权限测试全绿。分两期的理由：
  同期既换执行后端又改判定链，出问题时分不清是哪边；且放松的**判据本身**要从
  本期的「降级到今日行为」翻转成 fail-closed，那是一次语义反转，值得单独审。
  代价要说白：本期用户可感知的变化只有一处 —— 批准之后仍写不出去。
- **收敛 `docx_convert` / MCP stdio**。前者命令与参数在我们代码里写死（受控 spawn），
  后者的写根要变成可配置的（MCP server 常要写自己的缓存/配置目录），都留到后面。
- **提权那一档**（专用账号 + 禁读 + 禁网）。它只多出「读隔离 + 网络隔离」，
  写隔离与本期完全等强；代价是 UAC、常驻两个账号与一个组、**EDR/AV 高敏感**
  （建账号 + 改 ACL + 改防火墙是教科书级恶意软件特征）、可被企业 GPO 直接封死，
  且 codex 连卸载路径都没写。
- **人人可写目录扫描告警**。留 TODO（codex 有，dsh 明确缺）。
- **符号链接/reparse point 竞态的深度防御**（`OBJ_DONT_REPARSE`）。记录在案，本期不做。

## 附：已推翻的上游结论（移植时必须有意偏离）

dsh 在 `win32-process/src/process.ts:144-146` 与 `sandbox-windows-acl/src/runner.ts:33-38`
两处注明「显式传环境块会 `ERROR_INVALID_PARAMETER`，已实测」，因此放弃显式环境块，
改用 `SetEnvironmentVariableW` 改**自己进程**的 TMP/TEMP 让子进程继承。
**我们不能照抄** —— 那会污染整个 daemon 的环境，影响所有会话与其他 spawn。

S3 两次对照实验（同一段 `CreateProcessW` 调用，只差创建标志）证明那条归因是错的：

| creationFlags | 结果 |
|---|---|
| 不置标志 | spawn 失败，Win32 87 `ERROR_INVALID_PARAMETER` ← 复现其现象 |
| `CREATE_UNICODE_ENVIRONMENT` (0x400) | spawn 成功，子进程正确收到变量 |

根因是漏了该标志：`lpEnvironment` 默认按 ANSI 解释，传 UTF-16 块必然被判非法参数。
他们的 `abi.ts` 里确实没有这个常量（只有 `CREATE_SUSPENDED = 0x4`）。

因此移植时三处有意偏离：`abi.ts` 加 `CREATE_UNICODE_ENVIRONMENT`；
`createProcessAsUserW` 绑定的 `lpEnvironment` 从写死 `null` 放宽为可接受 Buffer；
环境块**继承 `process.env` 后覆盖** TMP/TEMP，而非整体替换
（spike 里整体替换必须手动补 `SystemRoot` 才起得来，这本身就是教训）。

此修法可回馈给 dsh（MIT），不阻塞本期。
