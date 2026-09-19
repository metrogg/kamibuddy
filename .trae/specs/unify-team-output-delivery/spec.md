# 统一团队产出送达：挂到每一个工具结果 Spec

## Why

用户实测反馈：成员做完后，主理人**通常要等自己的 `Start-Sleep` 跑完才拿到产出**。

现状的送达时机是「领导下一次 `team_*` 工具调用」——真机里领导的循环是
`team_status → powershell(Start-Sleep) → team_status → team_read → team_send …`，
所以它总要等 sleep 结束、且**只有再调一次 team 工具**才拿到。若它 sleep 完去调
`read`/`write`，则继续等。

**原计划（对齐 WorkBuddy）作废**：本来的方案是改用 pi 的 `context` 事件做每请求
尾部注入，即 WorkBuddy 的 `sliceInvocationWindow` 形态（`on("context")` 返回
`{ messages }` 可整体替换，钩子确实存在，见 pi `types.ts:670/1065/1220`）。
但核对本项目代码时发现**这条路我们 2026-09-18 已经试过并实测失败**：

- 证据：`src/extensions/prompt-switch.ts` 头注释 (b) 段与
  `src/shared/hidden-context.ts` 文件头 ——「早先的形态是 `context` 事件每请求现算的
  尾部注入、返回值不落会话文件…… **实测 24 次调用注入 24 次、白付 58,094 token，
  占会话未命中 28.8%**」。
- 根因：`context` 的返回值**不落会话文件**，于是它每轮都是一条新的尾部消息、
  位置每轮后移 —— 前缀缓存里它每轮都失配、每轮重付。这不是参数没调好，是机制本身
  与「append-only 落盘 + 固定位置」这条纪律相冲。
- WorkBuddy 能这么做，是因为它的子窗口插在**调用发生的历史位置**（不是每轮重算的新
  尾巴），那份位置在父会话里是固定的；而 pi 的 `context` 返回值没有这个位置。

所以本 change 换一条**同样能提前送达、且不破坏前缀缓存**的路：把送达挂载点从
「`team_*` 工具结果」扩到「**任意工具结果**」。工具结果是 append-only 的会话条目、
位置固定 ⇒ 缓存不受影响；而领导的 `Start-Sleep` 一结束，它的下一个工具结果（哪怕是
`read`）就会带上产出。

## What Changes

- **新增单点挂载**：领导会话注册一个 `tool_result` handler（与 `spill-hook` 同事件），
  在**任意**工具结果末尾追加「待送达成员产出」块；没有待送达产出时**一个字节都不改**。
- **删除 `team_*` 的包装层**：`team-tools.ts` 里对八个注册点的包装收敛掉 ——
  `team_*` 本身就是工具，新挂载点是它的超集。两处并存会让同一份产出被两条路各判一次。
- **「已送达」判据改为内存账本 + 文件种子**：挂载点从 ~6 次/run 扩到 ~40 次/run，
  再按现在那样「每次注入前扫一遍领导会话正文（≤512KB）」不可接受。改为：账本首用时
  从会话文件种子化（重启安全），此后在注入点增量更新。
- **保留** run 起点的 `kamibuddy-team-output` 快照通道：窄场景兜底（领导长时间不调任何
  工具时，下一轮 run 仍能看到）。
- **决策记录**：新建记录并标注取代 `ARCHITECTURE.md §4.22` 的「触发点」部分与
  `inject-team-output-snapshot` 的实施后修正（§4.22 里"否决 per-request 注入"的结论
  **不变**，只是否决理由补上 2026-09-18 的实测数字）。

## Impact

- Affected specs：`inject-team-output-snapshot`（挂载点被取代）、`add-team-pull-model`
  （送达口径修订）
- Affected code：
  - 新增 `src/extensions/team-output-hook.ts`（`tool_result` 挂载点）
  - `src/extensions/team-tools.ts`（删除包装层）
  - `src/daemon/team-output-snapshot.ts`（纯函数：账本入参化）
  - `src/daemon/index.ts`（内存账本 + 送达函数 + run 起点通道接线）
  - 会话装配处（注册新扩展）
  - `scripts/check-model-experience.ts`（多一个"改写工具结果"的扩展，契约要同步）

## ADDED Requirements

### Requirement: 产出送达挂到任意工具结果

系统 SHALL 在**领导会话**的任意工具结果上挂载「待送达成员产出」块；成员会话、子代理、
定时任务会话 MUST NOT 挂载（它们没有团队）。

#### Scenario: 成员交回产出后领导的任意一次工具调用

- **WHEN** 团队成员完成一轮、产出写进它自己的会话（唯一真源）
- **AND** 领导随后调用**任意**工具（`read` / `write` / `powershell` / `team_*` 均可）
- **THEN** 该工具结果的 `content` 末尾追加该成员的产出块（含内容指纹 `[fp …]`）
- **AND** `details` / `isError` 原样不动（只追加 `content`）

#### Scenario: 同一份产出只送达一次

- **WHEN** 某成员的产出已随某个工具结果送达
- **THEN** 后续任何工具结果都 MUST NOT 再包含它
- **AND** 判据来自内存账本（含运行期内核种子化的历史）

#### Scenario: 没有待送达产出时零改动

- **WHEN** 没有未送达的成员产出（含"领导还没建团"「成员都没产出」两种情形）
- **THEN** handler 返回 `undefined`，工具结果**逐字节不变**

#### Scenario: 缓存前缀不被破坏

- **WHEN** 一个已注入产出块的工具结果已经写进会话
- **THEN** 它此后**逐字节不再变化**（append-only、位置固定）—— 块不得"随新产出改写旧结果"

## MODIFIED Requirements

### Requirement: 「已送达」判据

从「每次注入前扫领导会话正文的 `[fp …]`」改为「**内存账本 + 文件种子**」。

- 账本 MUST 在首次需要时从领导会话文件种子化（读尾部窗口即可），重启后因此仍然正确。
- 账本在进程内只增不改；注入点把本次写入的指纹登记进去。
- 账本 MUST NOT 成为第二份真源：成员产出的**内容**始终来自成员会话文件
  （`member-transcript.ts`）；账本只记"哪些指纹已送达"。

### Requirement: run 起点快照通道

`kamibuddy-team-output` 通道保留，但**待送达判据改读同一本账本**（不再扫会话正文），
与工具结果挂载点共用同一个注入函数 —— 两个触发点必须给出**一致**的"待送达"集合。

## REMOVED Requirements

### Requirement: `team_*` 工具结果挂载

**Reason**：被「任意工具结果」覆盖（`team_*` 也是工具）；两处并存 = 同一份产出两条路各判
一次，且包装层（`register()` 包八个注册点）多一处维护。

**Migration**：无（行为是超集：原来能送达的位置全都还在）。
