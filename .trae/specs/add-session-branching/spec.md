# 会话分支（重新开始 / 分支出新会话）Spec

## Why

对齐清单 K4「会话分支」目前是 ❌ 空缺，而 pi 的会话文件本身就是**树**（每个条目带 `id`/`parentId`，`SessionManager` 提供 `branch()` / `createBranchedSession()` / `getTree()`，`AgentSession` 提供 `navigateTree()`）——也就是说底层能力现成，我们只是没用。

实际痛点有两个，都来自同一个缺失：

1. **改一下重发**没法做。用户想说「不对，换个问法」时只能新开任务，前面的上下文全丢。
2. **现有「重试」是假的**：它只是把最后一条用户消息**再发一遍**（[chat-view.tsx](file:///d:/DongProject/kamibuddy/src/renderer/chat-view.tsx#L1923-L1926)），历史里于是留下两条完全相同的用户消息，模型看到的是"用户又问了一遍"——语义错误且污染上下文。

目标：把「从某一轮分叉」做成一个**语义正确、不丢东西、看得见**的能力。

## What Changes

- 用户消息上加两个动作（沿用现有 hover 工具条，与「复制」同处）：
  - **重新开始**：回退到该消息之前，当前会话从此继续；被放弃的后续**自动抽成一条新会话**存进侧栏。
  - **分支出新会话**：从该消息之前派生一条新会话（母会话原样不动），自动切到新会话。
- **母会话文件保持线性**：回退后把母文件物理截断为「分叉点之前的前缀」（`header` + 前缀条目），不再留隐藏分支。
- **分支会话可见**：带 `parentSession` 来源标记、标题后缀「· 分支」、侧栏与母会话同空间同组，可继续/归档/删除。
- **「重试」改为走回退重发**：不再产生重复用户消息（行为变更，见 MODIFIED）。
- 分支会话**继承母会话的会话级状态**：场景-模式两轴、专家绑定、`lastNonPlanInteraction`（这三项不在会话文件里，现有 resume 是"沿用当前会话"，分支必须显式拷贝）。

**非目标（YAGNI）**：树视图分支切换器、LLM 分支摘要（pi 的 `summarize`/`branchWithSummary`）、分支合并/对比、跨 cwd 的 `forkFrom`、键盘快捷键（`Esc` 已被"停止"占用）。

## Impact

- Affected specs：K1 会话存储、K2 恢复续跑、K10 任务/空间分组、B3 流式事件与消息投影、产物面板（`artifacts_presented`）
- Affected code：
  - `src/shared/ipc.ts`（新通道 + `SessionSummary.parentSession`）、`src/shared/bridge.ts`
  - `src/daemon/index.ts`（两个 handler、桶注册与切换、事件补发时序）
  - 新增 `src/daemon/session-branch.ts`（纯逻辑：前缀切分、标题/来源写入决策）与 `src/core/session-file.ts`（JSONL 前缀读取与原子重写）
  - `src/renderer/chat-view.tsx`（用户消息动作条 + 回填输入框）、`src/renderer/App.tsx`（调用与提示）、`src/renderer/sidebar.tsx` / `session-groups.ts`（分支标识）
  - 新增 `scripts/probe-session-branch.ts`（pi 侧语义实测）
- 约束：界面改动必须先读 `DESIGN.md`；不得引入新的硬编码视觉值（token 唯一真源 `src/styles/tokens.css`）。

## 技术前提（必须在 apply 阶段先实测，结论写进探针注释）

pi 0.85.1 的以下语义不能靠读文档推断，`scripts/probe-session-branch.ts` 逐条断言：

1. `SessionManager.createBranchedSession(leafId)`：是否复制 **root→leafId 全量**、是否改动源文件、是否写入 `parentSession`、返回值语义；`leafId` 为任意历史条目（非当前 leaf）是否可用；`leafId` 为根条目之前（`null`）时的行为。
2. `branch(entryId)` / `navigateTree(targetId)` 是否**持久化叶子位置**：回退后 dispose 宿主、重新 `SessionManager.open` 同一文件，`getLeafId()` 是否仍在分叉点。
   - 若不持久化：走既定方案（母文件物理截断为前缀，叶子天然是末尾），不额外发明叶子指针条目。
   - 若 `navigateTree()` 能正确处理压缩上下文与持久化，**优先用它**，不自己重造。
3. `SessionManager.open(path).getHeader().parentSession` 可读，供 `SessionSummary` 使用。

任一前提不成立时的降级路径写在探针结论里，再据实调整 Task 2/3 的实现方式。

## 实测修订（Task 1 结论，2026-09-17；完整证据见 `scripts/probe-session-branch.ts` 文件头）

- `createBranchedSession(leafId)`：抽出的是 **root→leafId 全量条目（含前缀）**，不改动源文件，header 写入 `parentSession` = 母文件绝对路径，返回新文件路径。**`leafId` 传 `null` 无效**（静默回落到当前叶子）→ 空历史的分支改用 `SessionManager.create(cwd, sessionsDir, { parentSession })`。若抽出的内容里没有 assistant 条目，pi 的落盘守卫会让文件**尚未写出** → 需用我方写入器补齐。
- **叶子位置不落盘**：`branch()` 与 `navigateTree()` 都只在内存移动叶子，JSONL 里没有任何叶子指针条目；重新 `open` 同一文件时叶子 = 文件最后一行。→ 「回退后持久化」**必须**靠母文件前缀重写（本 spec 的既定方案得到证实，保留）。
- `navigateTree(targetId)` 传用户消息 id 时：叶子移到该消息的 `parentId`，返回 `editorText`（可直接进输入框），并重建上下文。仍不落盘，收尾同样要截断。
- 构造 `AgentSession` 会往会话文件追加 `thinking_level_change` 条目 —— 前缀按「分叉点的 parentId 链」计算而非「最后一行」即可免疫。
- `getHeader().parentSession` 字段名成立；`getEntry(id).parentId` 可读；`getEntries()` 不含 header；未知 id 返回 `undefined`（不抛错）。
- **锚点口径修正（原 spec 假设不成立）**：恢复路径下渲染层 user 条目 id **等于** JSONL 条目 id，但**在线路径不等**（`session-host` 用 `nextId("user")` 造 id，pi 在 `message_end` 才落盘且事件不带条目 id）。→ 通道入参改为**用户消息序号**（0 基），daemon 用 `AgentSession.getUserMessagesForForking()`（返回 `[{ entryId, text }]`）解析成真实条目 id；两者数量不一致时返回 `no-such-entry` 且不做任何写操作。
- 技能消息在会话条目里就是普通 user 消息，不额外拆条。

## ADDED Requirements

### Requirement: 从某一轮重新开始

系统 SHALL 允许用户对任意一条用户消息发起「重新开始」，把当前会话回退到该消息**之前**并继续，且不得丢失被放弃的内容。

入口 SHALL 只出现在用户消息上，且仅在该消息之后确有内容（存在后续条目）时可用。

#### Scenario: 回退到某轮之前

- **WHEN** 用户在非流式状态下对第 2 条用户消息点「重新开始」
- **THEN** 当前会话的可见历史只剩「第 1 轮完整内容」，第 2 条用户消息及其之后的全部内容不再出现在当前会话
- **AND** 该消息原文（含技能块，回拼为 `/skill:<name> …`）被填入输入框，但不自动发送
- **AND** 被放弃的那段内容已作为一条新会话出现在侧栏，可打开、可继续、可删除
- **AND** 界面给出一次提示，说明"后续内容已存为分支会话"，并把该分支会话标题写明

#### Scenario: 回退首条用户消息

- **WHEN** 用户对会话的第 1 条（也是唯一前缀起点的）用户消息点「重新开始」
- **THEN** 当前会话历史变为空（会话文件与目录保留，不删除）
- **AND** 原有全部内容存进分支会话
- **AND** 输入框填入该消息原文

#### Scenario: 空输入框不发送时不产生副作用

- **WHEN** 用户点「重新开始」后没有发送任何消息，直接切走
- **THEN** 会话保持回退后的状态，不自动补发、不留占位消息

### Requirement: 分支出新会话

系统 SHALL 允许用户对任意一条用户消息发起「分支出新会话」，在**不改动母会话**的前提下，从该消息之前派生一条新会话并自动切换过去。

#### Scenario: 分支出新会话

- **WHEN** 用户对某条用户消息点「分支出新会话」
- **THEN** 侧栏新增一条会话，其历史等于母会话在该消息之前的前缀
- **AND** 当前视图切到这条新会话，输入框填入该消息原文
- **AND** 母会话的历史、当前叶子、文件内容均不变
- **AND** 新会话与母会话使用同一工作目录（不分配新目录）

#### Scenario: 分叉点在首条用户消息

- **WHEN** 用户对母会话的第 1 条用户消息点「分支出新会话」
- **THEN** 新会话为空历史（仅有来源标记与继承的会话级状态）

#### Scenario: 回答操作条上���分支入口（2026-09-17 使用反馈修订）

- **WHEN** 某轮回答结束且会话具备分支条件（已落盘、非流式）
- **THEN** 该轮末条 assistant 消息的常驻操作条出现「分支」按钮（位序：复制 → 分支 → 重试，对齐 TRAE）
- **AND** 点击等价于对**本轮的用户消息**执行「分支出新会话」（母会话不动，切到新分支，原文回填输入框）
- **AND** 用户气泡 hover 工具条上的两个分支入口保留不变（「重新开始」仍是回退 + 抽枝存档）
- 初版分支入口只藏在用户气泡的 hover 工具条里，实测用户找不到 —— 分支是回答级动作，必须出现在常驻操作条上

### Requirement: 分支会话的来源标识与命名

系统 SHALL 让分支会话在数据与界面上都可追溯到母会话。

#### Scenario: 来源写入会话文件

- **WHEN** 任一批分支会话被创建
- **THEN** 其会话文件 header 的 `parentSession` 指向母会话文件绝对路径（pi 未写入时由我方补写）
- **AND** 会话名写入 `session_info`，取「母会话标题 · 分支」；重名时追加递增序号（如「· 分支 2」）

#### Scenario: 侧栏呈现来源

- **WHEN** 侧栏渲染一条有 `parentSession` 的会话
- **THEN** 该行有分支标记，hover 显示来源会话标题
- **AND** 它与母会话落在同一空间组（同 cwd），不新增分组规则
- **AND** 母会话已被删除时，标记仍显示但不提供跳转

### Requirement: 分支操作的前置条件与安全边界

系统 SHALL 在以下条件下拒绝分支操作，并给出可读原因，绝不静默失败或部分生效。

#### Scenario: 流式进行中

- **WHEN** 会话正在流式生成（`running`）时发起分支
- **THEN** 操作被拒绝，界面提示"正在生成，稍后再试"，会话状态不变

#### Scenario: 会话尚未落盘

- **WHEN** 目标会话还没有会话文件（未发送过任何消息）
- **THEN** 界面不出现分支入口

#### Scenario: 分叉点之后没有内容

- **WHEN** 目标消息之后已无任何条目（例如末轮刚答完但用户想"重新开始"）
- **THEN** 「重新开始」可执行但**不产生**分支会话（没有需要保存的未来），只有回退与回填
- **AND** 提示语相应改为只说明"已回到这一轮之前"，不提分支会话

#### Scenario: 与其它会话操作的互斥

- **WHEN** 分支操作与 resume / rename / delete / saveToWorkspace 并发
- **THEN** 同一会话的写操作经桶的互斥链串行，不出现两个宿主同时写同一文件

### Requirement: 分支时继承会话级状态

系统 SHALL 让分支会话继承母会话的会话级状态，使新分支的模型、模式与专家身份与母会话一致。

#### Scenario: 场景-模式-专家继承

- **WHEN** 母会话当前为「work 场景 / craft 模式 / 专家 X」时分支
- **THEN** 新会话以同样的 sceneId / interactionId / expertId 打开
- **AND** `lastNonPlanInteraction` 一并继承（`/plan` 进出记忆不丢）

#### Scenario: 推理强度沿用会话文件

- **WHEN** 母会话在分叉点之前有过推理强度变更
- **THEN** 新分支会话按会话文件还原到当时的值
- **AND** 分支路径**不得**传入 `options.thinkingLevel`（会覆盖逐会话还原，见 session-host 既有约束）

#### Scenario: 产物清单随前缀继承

- **WHEN** 母会话在分叉点之前调用过 `present_files`
- **THEN** 新分支会话的产物面板包含该清单
- **AND** 母会话被回退后，分叉点之后的产物条目不再出现在母会话（内容仍在磁盘与分支会话里）

## MODIFIED Requirements

### Requirement: 重试（原：纯重发）

原实现把最后一条用户消息作为新消息再发一次，历史里留下两条相同用户消息，模型上下文被污染。

**新行为（2026-09-17 使用反馈修订）**：重试 SHALL 等价于「对最后一条用户消息**就地回退**并立即重发」——先回退到该消息之前，再以该原文发送一次；**不抽枝、不产生分支会话**（旧回答就地丢弃）。重新生成与分支是两个功能，竞品（TRAE / ChatGPT）的重试都不产生新会话；初版把「旧内容存为分支」塞进重试是过度设计，想保留旧内容走「分支出新会话」。

#### Scenario: 重试不再产生重复消息

- **WHEN** 用户在非流式状态下点某轮末条回答的「重试」
- **THEN** 该轮的旧回答与过程不再出现在当前会话历史里
- **AND** 当前会话末尾是新一次生成的回答

#### Scenario: 重试不产生分支会话（2026-09-17 修订）

- **WHEN** 用户点「重试」且回退成功
- **THEN** 侧栏不新增任何会话（daemon 走 `saveBranch: false`，跳过抽枝）
- **AND** 成功路径无 toast（重新生成本身即可见反馈；失败仍就地提示）

#### Scenario: 流式期间重试不可用

- **WHEN** 会话正在生成
- **THEN** 「重试」按钮照旧不显示（现行为不变）

### Requirement: 会话摘要下发

`SessionSummary` SHALL 增加 `parentSession?: string` 字段（母会话文件路径），取自会话文件 header；列表组装与推送沿用现有全量推送通道。

#### Scenario: 列表推送带上来源

- **WHEN** 任一会话列表推送到达渲染层
- **THEN** 分支会话的 `parentSession` 有值，普通会话为 `undefined`
