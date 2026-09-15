# Tasks

> **实施状态（2026-09-15，含当日事故修复）**：批一至批四完成并验证后，真实应用内
> 首测暴露严重回归——受限令牌下的 PowerShell 在部分启动上下文里每条命令死于
> DLL 初始化（0xC0000142）。经十轮判别矩阵二分定位根因：**默认 DACL 的 ACE
> 受托者不能是外来 SID**（三条授权路径中唯一有毒的一条），修复 = 默认 DACL
> 恒用登录 SID，文件授权保留 per-workspace capability SID（隔离边界不变）。
> 完整过程与结论见 `docs/ARCHITECTURE.md` §4.4b「2026-09-15 事故与根因」。
> 新增基建：`npm run smoke:sandbox`（真实 utilityProcess 冒烟，9 项）与
> `--diagnose` 判别矩阵（可在任意环境复跑二分）。
>
> 两处与本清单不符，按实际情况为准：
> - **Task 9.1 有意偏离**：原计划给 `PermissionInfo` 加 `sandboxActive` /
>   `sandboxReason` 两个结构化字段，实际**去掉了** —— 设置页只整段渲染
>   `enforcementNote`，加字段就是没有读取方的死代码；机器可读的诊断落在
>   事件日志 `sandbox_status`（含原因枚举与细节）。
> - **Task 11.3 无效**：`docs/STATUS.md` 已在 5a0c524 被有意删除，不重建。
>   这条是照 `harden-permission-boundary` 的旧先例抄来的。
>
> **尚未做的一项**：修复后的真实应用内手工端到端验证（checklist「工作区写约束」
> 与「诚实上报」两节）。自动化与冒烟已验机制与策略，"用户在界面上批准之后
> 仍然写不进去"这条完整链路待修复版应用内复测。
>
> 阶段 0（spike 闸门）：S1/S2/S3 全通过。脚本是一次性的，价值已转化为
> `src/sandbox/` 与 `src/sandbox/confinement.win.test.ts`，验证完即删除 ——
> 不留第二份会腐烂的实现。依赖 `koffi@3.3.0` 已装（精确版本）。

## 批一 · 沙箱层移植（`src/sandbox/`）

- [ ] Task 1: 新增第 9 层与依赖规则
  - [ ] 1.1 `scripts/check-dependency-rules.ts` 三处改动：`LAYERS` 加 `"sandbox"`；`ALLOWED_INTERNAL` 加 `sandbox: ["shared"]`（只取 `SandboxMode` 类型）；`extensions` 与 `daemon` 的允许目标各加 `"sandbox"`
  - [ ] 1.2 确认 `sandbox/` 不出现在 `ALLOW_PI` 与 `ALLOW_ELECTRON` 里——它是纯 Win32 适配层，与 `documents/` 同一取向（可脱离 pi 与 electron 单测）
  - [ ] 1.3 `npm run check:deps` 通过

- [ ] Task 2: FFI 与 ABI 基座（`ffi.ts` `win32-abi.ts`）
  - [ ] 2.1 移植绑定表与常量，剥掉 `@deepseek-ai/cordis` 与 `dsh-invariants` 依赖（两个 `invariant.ts` 不搬）
  - [ ] 2.2 保留 ABI 尺寸断言（`STARTUPINFOW` 104、`PROCESS_INFORMATION` 24）：koffi 算错即 throw，不静默跑错布局
  - [ ] 2.3 **有意偏离**：`win32-abi.ts` 增加 `CREATE_UNICODE_ENVIRONMENT = 0x400`（上游没有这个常量，理由见 spec 附录）
  - [ ] 2.4 按 AGENTS.md 注释纪律重写文件头：每个 Win32 调用讲清 **why**，不是 what；上游踩坑注释里的**事实**必须保留（那些是花钱买来的）

- [ ] Task 3: 受限令牌（`token.ts`）
  - [ ] 3.1 `openCurrentProcessToken` / `findLogonSid` / `makeWellKnownSid` / `createRestrictedToken`
  - [ ] 3.2 `setTokenDefaultDaclGrant`：**不能省**。受限令牌原样继承用户默认 DACL，而那里不含任何受限 SID，于是子进程新建匿名管道时过不了第二次（写）检查，piped stdio 全部失败
  - [ ] 3.3 受限 SID 列表按档位：`read-only` = `[logon SID, EVERYONE]`；`workspace-write` = 再加 workspace SID 与 temp SID。**两档都必须留 logon SID + EVERYONE**，否则 DLL 早期初始化死在 `0xC0000142`、CNG 让 pwsh 崩 `0xE0434352`
  - [ ] 3.4 每个 Win32 返回值都检；任何失败 throw，**绝不以完整令牌 spawn**

- [ ] Task 4: ACL 授权（`acl.ts` `grant.ts` `workspace-sid.ts` `path-boundary.ts`）
  - [ ] 4.1 `grantWrite` / `revokeWrite` / `withPathLock`（per-path `LockFileEx`，防并发互相覆盖 ACE）
  - [ ] 4.2 `hasExactGrant` 幂等：先读 DACL 逐 ACE 比对，命中就跳过 `SetNamedSecurityInfoW`。这是 ACL 传播开销的唯一解药（实测 5000 文件首次 3134ms、幂等 1ms）
  - [ ] 4.3 `GRANT_MASK` 必须排除 `WRITE_DAC`/`WRITE_OWNER`——否则子进程能改 DACL 或夺取所有权逃逸
  - [ ] 4.4 `workspaceWriteSid` 确定性派生（SHA-256(工作区路径) → `S-1-4-x-y`）

- [ ] Task 5: spawn（`process.ts` `spawn.ts`）
  - [ ] 5.1 `quoteArg` / `buildCommandLine` 按 `CommandLineToArgvW` 真实规则（不是朴素加引号）
  - [ ] 5.2 `spawnPipedProcess` + `drainPipe` + `waitForProcessExit`：我们要**捕获** stdout 喂回模型，用不了 runner 那条 `stdio: "inherit"`
  - [ ] 5.3 **有意偏离**：`lpEnvironment` 从写死 `null` 放宽为可接受 Buffer（TS 接口里也要放宽），置 `CREATE_UNICODE_ENVIRONMENT`，环境块**继承 `process.env` 后覆盖** TMP/TEMP——不整体替换（整体替换会缺 `SystemRoot` 之类导致起不来）
  - [ ] 5.4 **上游缺口**：`spawnPipedProcess` 在 dsh 里**没有 Job Object**（只有 `spawnInheritedJobProcess` 有）。我们的工具有超时杀进程的要求，必须给 piped 路径补 kill-on-close Job（`CREATE_SUSPENDED` → `AssignProcessToJobObject` → `ResumeThread`），否则超时只杀得掉直接子进程，孙进程变孤儿

- [ ] Task 6: 对外窄口（`index.ts`）
  - [ ] 6.1 只导出 `probeSandbox()`（幂等、缓存）与 `runSandboxed(req)`，其余全部内部
  - [ ] 6.2 `SandboxRunOutcome` **与 `powershell-tool.ts:66-72` 的 `CommandOutcome` 同形**（`stdout`/`stderr`/`exitCode`/`timedOut`），这样 `formatOutcome` 一行不改
  - [ ] 6.3 `runner.ts` 不搬：那层 argv 包装（`--workspace … -- <argv>`）与 exit-127 协议是为包任意 CLI 设计的，我们在 daemon 内直接 spawn 用不上

## 批二 · 接入 powershell（依赖批一）

- [ ] Task 7: `runCommand` 改注入式
  - [ ] 7.1 照 `src/documents/docx-env.ts:20-24` 已有约定（纯函数 + 注入 spawn，所以整条路径能用假 spawn 单测）：`PowershellToolOptions` 加可选 runner，缺省走真实实现
  - [ ] 7.2 三个调用点签名不变：`daemon/index.ts:1434`、`subagent-runner.ts:299`、`automation-runner.ts:221`
  - [ ] 7.3 `unattended` 与 `checkCommand` 两道闸**顺序不变**，沙箱是第三道，在它们之后

- [ ] Task 8: 模式映射与 daemon 装配
  - [ ] 8.1 档位映射：`read-only` 不进沙箱（权限门阶段 3 已把 shell 全拒，走不到）；`workspace-write` **进**（本期主战场）；`danger-full-access` **不进**（预设文案写的是「不限制文件范围」，加了沙箱就是文案说谎）
  - [ ] 8.2 工具需要知道当前档位与工作区路径（daemon 装配时注入）
  - [ ] 8.3 **会话建立时**探测 + 首次授权，不懒加载到首次调用（实测外推几万文件即几十秒，用户第一条命令会挂住且毫无解释）；超过约 1s 给可见反馈

## 批三 · 诚实上报（依赖批二定型的探测接口）

- [ ] Task 9: `SandboxUnavailableReason` + `buildPermissionInfo`
  - [ ] 9.1 `src/shared/permissions.ts` 加原因枚举（六个取值，见 spec）；`PermissionInfo` 带上它
  - [ ] 9.2 `buildPermissionInfo` 按探测结果生成 `enforcementNote`（§4.4b 当年承诺「只改这一处」，本期兑现）
  - [ ] 9.3 `enforcement` **保持 `partial`**，不许改 `full`
  - [ ] 9.4 探测失败 → 降级到今日行为（不沙箱直接 spawn），但工具返回文本与审批弹窗**都要说明沙箱未生效**，原因上报设置页
  - [ ] 9.5 FAT/exFAT 卷探测 → `unsupported-filesystem`（无 ACL，沙箱会静默无效）

## 批四 · 验证与收尾

- [ ] Task 10: 测试
  - [ ] 10.1 纯函数单测（不需特权，进 `npm run check`）：`workspaceWriteSid` 确定性（同路径同 SID、不同路径不同）、`buildCommandLine` 对 `CommandLineToArgvW` 的往返（含内嵌引号与反斜杠）、模式 → 受限 SID 列表映射、`SandboxUnavailableReason` → `enforcementNote` 映射
  - [ ] 10.2 集成测试（Windows only，非 Windows 跳过）——**这是本期验收本体**，没有它就是交付了 2000 行未验证的 FFI：① 区内写成功 / **区外写被拒** / 区外读仍可行；② stdout/stderr 完整捕获 + 非零退出码回传；③ 超时真杀掉进程树（Job Object，含孙进程）；④ `probeSandbox()` 幂等不重复付 ACL 代价；⑤ **令牌派生失败时绝不以完整令牌 spawn**（注入失败模拟）
  - [ ] 10.3 回归：`npm run check`（typecheck + check:deps + check:tokens）、`npm test` 全绿（**23 个权限测试一个不动**）、`npm run smoke:permission` 全过

- [ ] Task 11: 文档与清理
  - [ ] 11.1 `docs/ARCHITECTURE.md` §4.4b 从「本轮搁置」改为「零安装档已落地」+ 已知边界七条 + 提权档仍搁置的新理由
  - [ ] 11.2 三层分工写进架构文档与代码注释：**权限门管问不问、检查器管能不能跑、沙箱管跑起来能碰到什么**；明确「不得因有沙箱而削弱 command-guard」
  - [ ] 11.3 `docs/STATUS.md` 加一节（含「等你验证」项）
  - [x] 11.4 删除 `spike-sandbox/`（S1/S2/S3 的价值已转化为 `src/sandbox/` 与集成测试）

# Task Dependencies

- Task 2 → 3 → 4/5 → 6（FFI 基座是其余全部的前提）
- 批二依赖批一（Task 6 的窄口定型）
- 批三依赖批二（探测接口稳定）
- Task 10.2 依赖批一 + 批二；10.3 可随时跑
- Task 11 依赖全部

# 实现注意事项（写代码前必读）

**不要试图跑 dsh 自带的测试。** `开源项目/` 那份 vendor 副本的 `node_modules` 是残缺的
pnpm 链接农场（`koffi/index.js`、`@deepseek-ai/*` 全部解析不开，`.bin/vitest` 指向不存在
的 `vitest.mjs`），它的测试与 `src` 都加载不了。参考只能读源码；可运行的参照物是
`src/sandbox/confinement.win.test.ts`（端到端 9/9，含区外写被拒与超时杀进程树）。

**已实测的 ABI 事实**（koffi 3.3.0，Win11 x64，别再猜）：`STARTUPINFOW` = 104 字节、
`EXPLICIT_ACCESS_W` = 48、`SID_AND_ATTRIBUTES` = 16、`TOKEN_GROUPS_OFFSET` = 8、
`SECURITY_MAX_SID_SIZE` = 68。

**三个容易写错就崩的地方**（上游注释里有，务必带过来）：

1. **描述符/ACL 分配契约**：`GetNamedSecurityInfoW` 返回的 DACL 指针位于安全描述符
   分配块**内部**。只能 `LocalFree` 描述符，且必须在 `SetEntriesInAclW` 消费完之后。
   free 那个 ACL 指针会破坏堆。
2. **ACE 里的 SID 是内联的**（掩码之后直接跟着），不是指针。当成指针读会得到垃圾地址
   并让 `EqualSid` 崩掉——要按偏移逐字段比较（`sameSidAt`）。
3. **`SE_GROUP_LOGON_ID` 的第 31 位是 1**，而 JS 位运算是有符号 32 位 → 必须 `>>> 0`。

**私有桌面本期不需要**（实测两个 shell 在 `lpDesktop` 未设时都正常）。推测原因：codex 用
**专用账号** + `CreateProcessWithLogonW`，跨登录会话拿不到 WinSta0；我们只复制自己的
令牌且登录 SID 在受限列表里，桌面本来就可达。**若将来做提权那一档会撞上它**，
`CreateDesktopW` 要重新纳入考虑。

**别让沙箱变成削弱检查器的理由。** `WRITE_RESTRICTED` 只约束写——S2 已实测受限子进程
仍能读工作区外文件。`type ~\.ssh\id_rsa` 这条路只有 `command-guard` 的
`credential-access` 拦得住。

**降级方向的纪律。** 本期探测失败 → 降级到今日行为（可接受：今天本来就无沙箱，
沙箱是新增的纵深防御）。**下一期放松审批时判据必须翻转为 fail-closed**——放松的依据
就是沙箱存在。不要把本期的降级写法当成将来的模板（这正是 WorkBuddy
`node-brokered-fs-shim.cjs:41-42` fail-open 的教训方向）。
