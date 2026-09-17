# Tasks

## 第 0 批：先把事实对齐（无依赖、可并行）

- [x] Task 0.1: 订正 `AGENTS.md §2` 关于 powershell 的过时表述
  - [x] SubTask 0.1.1: 核实 powershell 工具是否**已正式放开**（`src/extensions/powershell-tool.ts` + `command-guard.ts` 存在、`src/core/agents.test.ts:174` 断言工具面含 `powershell`、`src/daemon/automation-runner.ts:243-249` 无人值守变体注册它）—— 向用户确认「是否已决定启用」
  - [x] SubTask 0.1.2: 按核实结果把 `§2` 的「尚未实现，工具面里也还没有 powershell」改成事实（若已启用，写明危险命令检查器已落地的判据；若只是代码在但开关未开，写明开关在哪）
  - [x] SubTask 0.1.3: 全文搜一遍其它提到 powershell 状态的文档（`docs/sandbox.md`、`docs/workbuddy分析/09-sandbox-and-permissions.md`）同步订正

- [x] Task 0.2: 写 dsh 调研结论落档（**只落结论，不落全文**）
  - [x] SubTask 0.2.1: 在 `docs/` 下建一份对照记录：dsh 子系统 × 我们的对应物 × 差距类型（机制/纪律/文档），标明来源路径与本 spec 的采纳清单
  - [x] SubTask 0.2.2: 标注**未确认项**（包总数下界、`docs/subsystems/` 约 30 页未逐页读、pi 是否有第二套 `SessionManager` 实现未证实）

## 第 1 批：纪律类（成本低、收益立竿见影）

- [x] Task 1.1: 新增「模型体验契约」门禁
  - [x] SubTask 1.1.1: 定义契约形态（`What the model sees` / `Token effect` / `KV Cache effect` 三段），落点复用现有模块头注释或 README
  - [x] SubTask 1.1.2: 写 `scripts/check-model-experience.ts`：扫描「可能改变模型所见」的模块（21 个工具模块 + `src/core/system-prompt-composer.ts` + `src/shared/hidden-context.ts` + `src/extensions/prompt-switch.ts`），缺段即失败
  - [x] SubTask 1.1.3: 豁免机制：允许豁免但**必须写理由**（照 dsh 的判据：豁免也要写为什么），并给现有模块补齐段落
  - [x] SubTask 1.1.4: 挂进 `npm run check`；**人为改坏一次**验证会红

- [x] Task 1.2: 决策记录加「否决方案」强制段
  - [x] SubTask 1.2.1: 在 spec 模板/流程里加 `## 否决方案`（`Alternatives considered`）段要求，并写明「决策记录写完即冻结、只能改状态不能改结论」
  - [x] SubTask 1.2.2: 回填本 spec 与 `stabilize-prompt-prefix` 的否决方案（后者已有「探针结论③」，指过去即可）
  - [x] SubTask 1.2.3: 加一条 checklist 校验（可为人工检查项，先不写脚本）

- [x] Task 1.3: 模块不变量登记（缩小版，不照搬 Cordis 形态）
  - [x] SubTask 1.3.1: 定义登记表形态（每个模块回答「有没有可**独立分叉观测**的关系」，没有就写理由）
  - [x] SubTask 1.3.2: 为 `shared/`、`core/`、`daemon/` 现有模块做首轮登记（不追求覆盖全部，先覆盖有明确不变量的：会话事件折叠、提示词字节稳定、权限判定、台账口径）
  - [x] SubTask 1.3.3: 写机械校验：登记缺失且无理由即失败

- [x] Task 1.4: 证据纪律写进 `AGENTS.md`
  - [x] SubTask 1.4.1: 新增三条：真入口路径测试、断言「未被触碰的文件逐字节不变」、改坏→看红→回滚
  - [x] SubTask 1.4.2: 与现有 `§8 AI 协作` 的「声称完成前跑 check」合并，避免重复表述

## 第 2 批：机制类（收益大、要动代码）

- [x] Task 2.1: 落地 `spill`（超限工具结果落盘 + 模型可见取回提示）
  - [x] SubTask 2.1.1: 先按 `AGENTS.md §4` 把「工具结果写回模型」的公共路径抽进 toolkit（现有 24k 截断散在 `powershell-tool.ts`、`web-fetch.ts`、`doc-read-tool.ts` 等多处）
  - [x] SubTask 2.1.2: 定义落盘位置与保留策略（与 `run-ledger`/`event-log` 的目录口径一致），定好阈值（现为 24k 字符）
  - [x] SubTask 2.1.3: 实现「省略 N + 完整结果在 <路径> + 用 read offset/limit 或 grep 取回」的提示文案（**响亮告知，不是静默降级**）
  - [x] SubTask 2.1.4: 断言阈值内行为与现在**完全一致**（回归）；超限用例断言落盘文件真实存在且可被 read 取回
  - [x] SubTask 2.1.5: 明确不做：不引入 branded locator（我们是本地单机，直接渲染路径即可）——把该取舍写进注释

- [x] Task 2.2: 压缩的可审计性与崩溃可检测
  - [x] SubTask 2.2.1: 给压缩加「锁」语义（`turn:numeric|null` 之类），并**最后释放**，使异常中断留下可检测痕迹
  - [x] SubTask 2.2.2: 记录被遮蔽范围与 token 量（`shadowedRange` / `shadowedSeqs` / `shadowedTokenCount` 的最小等价物），进台账/事件
  - [x] SubTask 2.2.3: 覆盖既有事实：实测压缩期间 pi 只发 `compaction_start/end`、**不发 assistant 事件**（见 `stabilize-prompt-prefix` 第五轮记录），所以这条完全在我们这侧实现，不必等 pi
  - [x] SubTask 2.2.4: 门禁：正常压缩可查到遮蔽范围；模拟中途中断能被识别

- [x] Task 2.3: 审批 fail-closed 闭集 + 审计对
  - [x] SubTask 2.3.1: 把审批结果收敛为常量闭集（`allowed-once` / `rejected` / `cancelled` / `unavailable`）
  - [x] SubTask 2.3.2: 显式化「应答者缺失/抛错/不合规 ⇒ unavailable ⇒ 调用方必须拒绝」，并把策略写路径收敛成一处
  - [x] SubTask 2.3.3: 加 `asked`/`decided` 审计对（可落在现有事件日志/台账）
  - [x] SubTask 2.3.4: 回归：现有 `permission-policy.test.ts` 等 4 个测试文件全绿 + 新增「应答者异常 ⇒ 拒绝」用例

- [x] Task 2.4: 补沙箱失败路径测试矩阵（**只加测试，不改实现**）
  - [x] SubTask 2.4.1: 对照 dsh `packages/sandbox/sandbox-windows-acl/tests/`（单包 17 个 spec：acl / grant / token-failure-paths / path-boundary / ffi / probe…）列出我们的差距维度
  - [x] SubTask 2.4.2: 按差距补测试（现有 4 个测试文件 → 目标覆盖令牌创建失败、ACL 授予失败、路径边界、probe 判别分支等）
  - [x] SubTask 2.4.3: 每条新测试都要能真拦住回归（**改坏→看红→还原**）

## Task Dependencies

- Task 1.1 与 Task 2.1 有共享上下文（都关心「模型所见/前缀」），但**文件不重叠**，可并行
- Task 2.1 依赖 Task 1.1（先有「模型体验契约」，spill 的 KV-cache 影响才有落点）——**软依赖**，可并行开工、交付时补齐
- Task 1.3 依赖 Task 0.2（先有对照结论，登记才有判据）
- Task 2.4 与 Task 2.1/2.2/2.3 相互独立，可任意并行
- 所有任务都不得触碰并行工作流的在途文件（`src/renderer/widget-view.tsx`、`resources/visualizer/*`、`scripts/design-tokens-allowlist.json` 等）

## 本批不做（记录以免反复提）

`session-projection`（daemon 侧单一 fold）、`goal`/`jobs` 持久化域、`session-query` 的 FTS 索引、`spill` 的远端 locator 形态 —— 留待下一批；届时先补「pi 是否有第二套 `SessionManager` 实现」的核实（工作区 `AGENTS.md §9` 的说法**未能证实**）。

## 修复 task（独立验证 2026-09-17 追加，来源：checklist 未勾条目的核实结论）

- [x] Fix 1（对应 checklist「模块不变量登记表…覆盖 `shared/`、`core/`、`daemon/`」）: 把 `src/daemon/` 纳入不变量登记的扫描域
  - 要改什么：`scripts/check-module-invariants.ts` 的 `SCOPE` 目前只有 `src/shared` ×2 / `src/core` ×2 / `src/extensions` ×2，**没有任何 daemon 域**（实跑输出「9 个在范围模块」可证），于是 daemon 侧新增模块不会被门禁要求登记。补一个 daemon 域 pattern（如 `src/daemon/session-projection.ts`、`/^(session|team|member)-[a-z-]+\.ts$/`），并按事实二选一：确有「可独立分叉观测的关系」就写进 `INVARIANTS`（带 `observation`），首轮确无就在 `EXEMPT` 里写清理由。
  - 怎么验证：`npm run check:invariants` 的输出里出现 daemon 侧模块（登记或豁免）且注明 `observation`/`reason`；人为删掉该条 → 门禁报「缺登记且无理由」→ 还原后全绿。
  - **实做（2026-09-17）**：`scripts/check-module-invariants.ts` 的 `SCOPE` 补两个 daemon 域（`/^usage-stats\.ts$/`、`/^prompt-preview\.ts$/`），`INVARIANTS` 补两条：
    `[台账口径] src/daemon/usage-stats.ts`（四桶之和 = 模型明细 tokens 之和 = 每日 tokens 之和；子代理进 token、不进会话维度）、
    `[提示词字节稳定] src/daemon/prompt-preview.ts`（预览与真实会话同一 `assembleSystemPrompt`，不得另写镜像）。文件头注明本次修补与理由。
  - **实跑**：`npm run check:invariants` → exit 0，「**11 个在范围模块**（不变量 10 / 豁免 1）」（原 9 个），输出里 daemon 两条都在且各带 `←` 指向的 observation。
  - **自证**：删掉 `usage-stats` 那条登记（保留它在 SCOPE 里）→ exit 1，报 `src/daemon/usage-stats.ts: 缺登记且无理由：要么在 INVARIANTS 里写清那条可独立分叉观测的关系，要么在 EXEMPT 里写清为什么没有`；还原 → exit 0。
  - **有意不凑数（如实）**：daemon 其余模块（`session-registry`（enqueue/LRU）、`automation-*`（持久化）、`conversation-search`、`sandbox-*`、`team-runtime` / `member-runner` / `session-branch` / `mailbox` / `context-usage-detail`）与首轮四域（会话事件折叠 / 提示词字节稳定 / 权限判定 / 台账口径）没有可独立分叉观测的关系；登记它们就得同时扩 `REQUIRED_CONCERNS` 的域清单（门禁现在只认这四个域），属下一轮的事 —— 本轮**没有**为凑数编不变量、也没有把它们挂到不相干的域上。

- [x] Fix 2（对应 checklist「新增测试覆盖：…路径边界…」）: 补沙箱的「路径边界」维度的等价测试
  - 要改什么：`src/sandbox/` 已新增 `token-failure.test.ts`（令牌创建失败）、`acl-failure.test.ts`（ACL 授予失败）、`probe.test.ts`（probe 判别分支）三份，但对照物 dsh `packages/sandbox/sandbox-windows-acl/tests/path-boundary.spec.ts`（4 例：temp root 不得等于/低于 workspace、私有 temp 必须两个方向都不相交）**没有对应的新用例**；现有 `workspace-sid.test.ts` 只断言 temp SID ≠ workspace SID（域分离），未断言路径不相交。按我们的事实补等价测试：`confinement.win.test.ts` 里「私有 temp 在系统 temp 下按工作区路径派生」这条 + `tempWriteSid`/`workspaceWriteSid` 的路径不相交判据。
  - 怎么验证：先改坏实现（把私有 temp 的派生根改到工作区内 / 让两个 SID 的盐相同）→ 新增用例必须变红 → 还原；`npm test` 全绿，且新增用例的断言点写在测试里（不是只看注释）。
  - **实做（2026-09-17，只加测试、未改实现）**：新增 `src/sandbox/path-boundary.test.ts`（6 例，ffi 打桩 → 不碰真 Win32，任何平台可跑）。A 组派生位置：私有 temp 落在 `%TEMP%\kamibuddy-sandbox\<16 位摘要>` 下、与工作区**两向不相交**（工作区在系统 temp 内 / 外两种）、同一工作区恒定（含大小写不同拼法）、不同工作区互不共享；B 组 capability 边界：派生对的两个 SID 必定不同、**路径恰好相同时两套盐也必须不同**（= dsh `assertPrivateTempDisjoint` 在我们这侧的等价判据）。
  - **实跑**：`npx vitest run src/sandbox/path-boundary.test.ts` → **6 passed**。
  - **自证①**：`src/sandbox/index.ts:425` 的派生根 `getTempPath(api)` 改成 `workspaceDir` → **3 failed | 3 passed**（`私有 temp 落在了工作区内部` 方向被断言到、`工作区落在私有 temp 内部`、大小写归一一起失效）→ 还原全绿。
  - **自证②**：`src/sandbox/workspace-sid.ts:52-53` 的 `tempWriteSid` 盐改成 `"workspace"` / `"workspace-low"` → 新用例 **1 failed**（`expected 'S-1-4-25591914-519' not to be 'S-1-4-25591914-519'`），既有 `workspace-sid.test.ts:69` 同时 1 failed → 还原全绿。
  - **未覆盖的残余（如实登记，按约束不改实现）**：dsh 的 `assertTempRootOutsideWorkspace`（temp 根不得等于/低于工作区）**在我们这侧没有对应实现** —— `index.ts` 的 `privateTempDir` 只按 `sha256(工作区小写路径)` 派生，不校验工作区本身是否位于系统 temp（或其 `kamibuddy-sandbox` 子树）里。若有人把工作区设成 `%TEMP%` 或 `%TEMP%\kamibuddy-sandbox`，派生出的私有 temp 会落在工作区**内部**，两块 capability 在 ACE 继承上合并（撤销工作区授权会顺带影响 temp）。测试不能凭空断言一条不存在的守卫，故**未改实现**；**归属后续任务**（建议：在 `prepareSandbox` 里对 `writableDirs × privateTempDir` 做 dsh 式两向 `containsDirectory` 校验并 fail-closed，补进 spec 的下一批）。checklist 第 38 条已同步括注。

- [x] Fix 3（对应 checklist「每条新测试都做过「改坏→看红→还原」」）: 把沙箱新测试的改坏实证留档
  - 要改什么：`stabilize-prompt-prefix/tasks.md` 的写法是本仓库既有惯例（逐条记「改坏哪一处 → 几例红 → 还原全绿」），本 spec 的 `tasks.md` 里**没有任何一条**这样的记录，checklist 该条无法被复核。按组为 `token-failure.test.ts` / `acl-failure.test.ts` / `probe.test.ts` 各记一行（改坏的具体行号 + 红了几例 + 还原后的结果）。
  - 怎么验证：复核时按记录逐条改坏 → 应观察到记录所述的红 → 还原后 `npx vitest run src/sandbox` 全绿。已做过两次独立抽样的先例可作格式参照：① `token.ts:63` 的 `token === null` 抛错改成空语句 → `token-failure.test.ts` 1 failed | 30 passed；② `acl.ts:192` 的 `applied !== ERROR_SUCCESS` 判定改成 `false` → `acl-failure.test.ts` 1 failed | 25 passed；两处还原后均全绿。
  - **实测记录（2026-09-17 本轮复跑，逐条改坏 → 看红 → 还原）**：
    - ① `src/sandbox/token.ts:63`：`if (token === null) throwWin32(api, "OpenProcessToken", …)` 改成空语句 → `token-failure.test.ts` **1 failed | 30 passed**（红的正是 `openCurrentProcessToken > OpenProcessToken 报成功却写回空句柄时也算失败（不当成有效令牌）`：`OpenProcessToken 的失败没有被抛出来（fail-closed 要求它必须抛）`）→ 还原后 **31 例全绿**。
    - ② `src/sandbox/acl.ts:192`：`if (applied !== abi.ERROR_SUCCESS) throwWin32(…, "SetNamedSecurityInfoW", …)` 判定改成 `false` → `acl-failure.test.ts` **1 failed | 25 passed**（红的正是 `grantWrite > SetNamedSecurityInfoW 写回失败时抛，且合并出来的 ACL 已被释放`）→ 还原后 **26 例全绿**。
    - ③ `src/sandbox/index.ts:169`：探测缓存键 `workspaceDir.toLowerCase()` 改成 `workspaceDir`（去掉小写归一）→ `probe.test.ts` **1 failed | 22 passed**（红的正是 `同一路径的不同大小写拼法共用缓存（Windows 路径大小写不敏感）`：`expected 2 to be 1` 次卷查询）→ 还原后 **23 例全绿**。
    - ④ 本轮新增的 `path-boundary.test.ts` 两份实证记在 Fix 2 条目里（派生根 → 3 failed；两套盐合一 → 1 failed），还原后全绿。
  - **还原后总跑**：`npx vitest run src/sandbox` → 8 文件 **129 passed | 1 skipped**（唯一 skip 是 `confinement.win.test.ts` 的孙进程断点：实现按条件跳过，不是失败）。四份沙箱实现的改动**逐字节还原**（`git diff -- src/sandbox/{acl,index,token,workspace-sid}.ts` 无输出）。

## 三处修复后的复验结论（2026-09-17）

- 逐条复验的 checklist 三条：模块不变量登记（第 13 条）**PASS**；沙箱新增测试覆盖（第 38 条）**PASS（路径边界维度有一处如实收窄，见 Fix 2）**；新测试「改坏→看红→还原」（第 39 条）**PASS**。三条的 `- [ ]` 均已改 `- [x]`，各自带一行证据括注。
- 未勾的条目：无（本 spec 的 checklist 现已全部为 `[x]`；沙箱路径边界残余与 daemon 其余模块的登记范围按上文如实留档，不构成未勾项）。
- `npm run check` → **exit 0**（typecheck + check:deps + check:tokens + check:model-experience〔19 模块全符合〕+ **check:invariants〔11 个在范围模块，不变量 10 / 豁免 1〕**）。
- `npm test` → **132 文件全绿 / 2444 passed | 1 skipped**（唯一 skip 是 `confinement.win.test.ts` 的孙进程断点；本轮该文件整体通过，未出现环境性红）。
