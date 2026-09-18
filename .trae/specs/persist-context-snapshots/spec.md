# 上下文快照持久化（对齐 dsh 的 PromptContext）Spec

## Why

上一轮 `stabilize-prompt-prefix` 把「逐轮会变的事实」从系统提示词挪到了**每请求现算、不落盘的尾部注入块**，方向对、但只修了一半：它论证的是「注入块**自身变化**不破坏前缀」，漏掉了「注入块**被反复重付**」。

实测（2026-09-18，`~/.kamibuddy/logs/runs/01a0b2b3-….jsonl`，24 次模型调用）：两块注入在**每个 run 内逐字节完全相同**（run 1 的 10 次调用 fp 全是 `387369592 / 2083004603`，run 2 的 14 次全是 `1423942445 / 4249268619`），却被注入了 24 次。后果两条：

1. **每轮全价重付一块常量**：`cacheRead_N` 恒等于 `prompt_{N-1} − 2,423…2,615`，23 轮合计 **58,094 token** —— 占全会话未命中（201,908）的 **28.8%**。
2. **丢掉「上一轮模型输出可被续写命中」的红利**：注入块钉在续写点（上一轮请求的最后一个 token 位置）上，provider 的前缀缓存只能覆盖到它之前。dsh 在同一个任务上拿到 19,915 token 的续写命中，我们全程 0。

对照（同一道题、同一模型族）：

| | KamiBuddy | dsh |
| --- | --- | --- |
| 模型调用 | 24 | 39 |
| prompt 总量 | 2,214,324 | 1,652,858 |
| 未命中 | 201,908 | 34,554 |
| 加权命中率 | **90.9%** | **97.91%** |

未命中拆解（逐轮复算，合计 202,004 ≈ 实测值）：冷启动 17,152 + 真实新增 126,662 + **尾部块重付 58,094**。dsh 那一侧的对应拆解是「冷启动 8,119 + 新增 46,350 − 续写命中 19,915」，**可避免浪费 ≈ 0**。

根因不是估算、不是 provider、也不是系统提示词（24 轮的 `systemSegments` 逐段指纹零变化，字节稳定纪律是生效的），而是**投递方式**：dsh 的快照是**落进会话日志的一条持久消息**（`session.append('user/message', …, {surfaceOp:'append'})`），位置固定 ⇒ 成为缓存前缀的一部分，且 `RuntimeContextProjection.project()` **只在内容真变时才追加**（其 README：`cache-safe counterpart`）。我们是每请求现算的瞬态尾巴，位置每轮后移 ⇒ 每轮失配。

顺带纠正两处我们自己写错的结论（用户已授权改）：`docs/提示词前缀缓存契约.md` §7 的「不落盘 ⇒ 不每次付」、以及 §2 把「不落盘」当成优点的表述 —— 事实相反：**正因为不落盘，它每轮都是一条新的尾部消息，每轮都是 miss**。

## What Changes

- **注入通道换投递方式**：两个「上下文快照」通道（`kamibuddy-runtime-context` = 记忆内容 + 个性化；`kamibuddy-hidden-context` = workspace_context / python_env / memory_and_skills_reminder / current_time）从「`transformContext`/`context` 每步追加的瞬态尾巴」改为「`before_agent_start` 返回的**持久 `message`**（`display:false`）」——pi 会把它写进会话文件（`appendCustomMessageEntry`），落位在**本轮用户消息之后**，一次 run 只发一次（不是每 step）。
- **每个通道各自去重**：渲染结果与会话**活条目列表**上最后一条同 `customType` 的快照逐字节相同时**不追加**。基线从 `ctx.sessionManager.buildContextEntries()` 读（跨 resume / 跨压缩均正确），不在进程内缓存，也不依赖「上游有没有变」的信号。**必须是它、而不是 `getBranch()`**：两者都从 `leafId` 回溯，但 `getBranch()` 会连**被压缩遮蔽的旧条目**一起返回（`buildContextEntries()` 按 `compaction.firstKeptEntryId` 丢掉被摘要掉的前段，`getBranch()` 只是纯父链遍历）—— 用 `getBranch()` 会把「已被遮蔽的旧快照」当成有效基线 ⇒ 「快照被压缩遮蔽后应重新追加」的场景会**漏追加**，模型那一轮就丢掉环境事实。
- **注入字节不变**：两块的渲染文本、容器形态（`<system-reminder data-role="…">`）与既有测试断言保持逐字节一致；变的只是**投递位置与持久性**。
- **两通道分开追加而非合并**：`runtime-context` 变化罕见（记忆被写才变），`hidden-context` 因 `current_time` 每 run 必变；合并会让 73% 的稳定内容跟着每 run 重发。
- **退役「瞬态注入项」概念**：`TRANSIENT_INJECTION_CUSTOM_TYPES`、`MessageRef.transient`、`cache-prefix.ts` 的 `dropTransient` 全部移除。它们的存在就是为了抹掉「每轮尾部一条新消息」这个差异 —— 而那正是我们要修的缺陷；快照落盘后 id 稳定，不再产生假差异，继续剔除只会把真实断点重新藏起来。
- **界面 / 导出 / 折叠不得显示快照**：快照现在会走 pi 的 `message_start` / `message_end` 事件（以前不会），`display:false` 必须在 `session-host.translate`、会话导出、conversation 折叠三处都生效。
- **文档订正**：`docs/提示词前缀缓存契约.md` §2/§7 的错误结论标记作废并写明新结论；`src/shared/hidden-context.ts`、`src/extensions/prompt-switch.ts` 两处文件头里同源的错误推理一并改掉；`docs/可观测性清单.md` 的 CACHE 条补新基线与复跑口径。

**BREAKING（行为层，非接口）**：注入块在**同一 run 内**的阅读位置从「整段历史的最后」（第 5 步就是 user → 助手 → 工具结果 ×N → 环境块）变成「本轮用户消息之后」（user → 环境块 → 助手 → 工具结果 ×N）。模型阅读顺序变了，需要一次人工确认（见 checklist）。
**BREAKING（数据层）**：会话 JSONL 从此包含 `custom_message` 条目（`display:false`）。旧会话文件无此条目，无需迁移；旧台账的缓存断点归因会从「历史全命中」变为如实报「断在尾部」。

## Impact

- 受影响能力：上下文注入（两个通道）、缓存前缀稳定性、会话文件内容、诊断面板的缓存断点归因、会话导出 / 重建、上下文压缩的可见面。
- 受影响代码：
  - `src/extensions/prompt-switch.ts`（`before_agent_start` 返回 `message`、删 `context` 通道、新增 `composeHiddenContext` 入参）
  - `src/core/session-host.ts`（删 `installHiddenContext`；`freezeHiddenContext` 保留；暴露快照读口给 daemon）
  - `src/shared/hidden-context.ts`（`appendHiddenContext` 退役；文件头重写）
  - `src/shared/observability.ts`（`TRANSIENT_INJECTION_CUSTOM_TYPES` / `MessageRef.transient` 退役）
  - `src/shared/cache-prefix.ts`（`dropTransient` 退役 + 文件头重写）
  - `src/daemon/index.ts`、`src/daemon/automation-runner.ts`（prompt-switch 接线）
  - `src/core/session-export.ts`、`src/core/session-rebuild.ts`、`src/renderer/*`（快照不显示）
- 参考实现：`开源项目/deepseek-harness`（`packages/core/agent-loop/src/runtime-context.ts` 的 `project()`、`packages/core/system-prompt/src/index.ts` 的 `PromptContext`、`docs/subsystems/system-prompt.md` 的 "cache-safe counterpart"）
- 依赖的 pi 接口（发布版 `@earendil-works/pi-coding-agent@0.85.1` 实测存在）：
  `BeforeAgentStartEventResult.message`（`dist/core/extensions/types.d.ts`）→ `agent-session.js` push `role:"custom"` → `sessionManager.appendCustomMessageEntry(customType, content, display, details)`；`ExtensionAPI.sessionManager`（只读，含 `buildContextEntries()`）。

## ADDED Requirements

### Requirement: 上下文快照以持久消息投递

两个上下文注入通道（`kamibuddy-runtime-context`、`kamibuddy-hidden-context`）SHALL 通过 pi 的持久消息入口（`before_agent_start` 返回的 `message`，`role:"custom"` + 具名 `customType` + `display:false`）投递给模型，SHALL NOT 再通过 `transformContext` / `context` 事件的返回值投递。注入正文的渲染字节 SHALL 与改动前逐字节一致。

#### Scenario: 同一 run 内不重复追加
- **WHEN** 一个 run 内模型被调用 N 次（N ≥ 2）且快照内容未变
- **THEN** 会话里该 `customType` 只新增 **1** 条条目，且第 2…N 次调用的消息数组里都能读到它（它是历史的一部分，不是尾巴）

#### Scenario: 内容未变则不追加
- **WHEN** 连续两个 run 渲染出的快照逐字节相同
- **THEN** 第 2 个 run 不产生新的快照条目（会话文件不增长）

#### Scenario: 内容变化时追加而不是替换
- **WHEN** 快照内容变了（记忆被写、个性化被改、`current_time` 跨分钟）
- **THEN** 在会话末尾**追加一条新的**快照消息，既有那条的字节与位置不变（append-only），模型按「最新一条为准」理解

#### Scenario: resume 后不重复追加
- **WHEN** 会话被 resume（新进程、会话文件已有快照条目），首个 run 渲染结果与文件里最后一条同 `customType` 条目相同
- **THEN** 不追加新条目（去重基线取自会话活分支，不依赖进程内状态）

### Requirement: 相邻两次调用的前缀不得被固定偏移截断

对同一会话内任意相邻两次模型调用（跨 step 或跨 run），命中量 SHALL NOT 相对上一次 prompt 总量出现「块级常量偏移」：`cacheRead_N ≥ prompt_{N-1} − 128`（128 为 provider 的块粒度裕度）。基线（改动前实测）为 `cacheRead_N = prompt_{N-1} − 2,423…2,615`。

#### Scenario: run 内相邻 step
- **WHEN** 一个 run 内连续两次模型调用
- **THEN** `prompt_{N-1} − cacheRead_N ≤ 128`（上一轮 prompt 全部命中；新增内容照常计入未命中）

#### Scenario: 跨 run 的第一次调用
- **WHEN** 新一轮 run 的第一次模型调用（本轮可能追加了一条新快照）
- **THEN** 同样满足 `prompt_{N-1} − cacheRead_N ≤ 128`

### Requirement: 快照对用户不可见但持久

快照消息 SHALL 落进会话文件（持久），SHALL NOT 出现在聊天界面、会话导出、conversation 折叠的任何用户可见面上。

#### Scenario: 界面不显示
- **WHEN** 一个 run 追加了快照
- **THEN** 聊天流里不出现该条目（与改动前观感一致），会话导出 HTML 里也不出现

#### Scenario: 导出/重建不丢历史
- **WHEN** 导出或重建一个含快照条目的会话
- **THEN** 用户消息、助手消息、工具结果的数量与内容不受影响，快照条目被跳过而不是被当成用户消息

### Requirement: 缓存断点归因不得再掩盖尾部失配

`request_snapshot.messageList` SHALL NOT 再给快照条目打「瞬态」标记，`src/shared/cache-prefix.ts` SHALL NOT 再剔除任何条目。快照是真实历史，其差异就是真实断点。

#### Scenario: 归因如实指认
- **WHEN** 诊断面板反推某轮的缓存断点
- **THEN** 若断点落在快照条目上，面板如实说出（而不是报「历史全命中」）

## MODIFIED Requirements

### Requirement: 逐轮可变事实的投递（原 `stabilize-prompt-prefix`）

逐轮可变的**内容**（记忆 / 个性化 / cwd / 运行时清单 / 时间）SHALL 仍然不进系统提示词（该纪律不变）；但它们的**投递形态**从「每请求现算、不落盘的尾部注入块」改为「落盘、按需追加的会话级快照消息」。原设计中「不落盘」这一条按新实测**作废** —— 它是每轮重付的直接原因。

粒度从「每 step」放宽到「每 run」：run 内不再重算注入内容（记忆在本项目里不会在 run 中途被改；`current_time` 仍按 run 冻结，语义不变 —— 它本来取的就是 run 开始时刻）。

### Requirement: 上下文压缩的可见面

快照条目是普通会话条目，SHALL 参与 pi 的压缩（与用户消息同等待遇）。去重基线取自 `ctx.sessionManager.buildContextEntries()` 的**活条目列表**（compaction-aware）：若某条快照被压缩遮蔽，下一次 run 会按需重新追加一条 —— 这是期望行为，不需要额外的「被遮蔽后清理」逻辑。

**为什么是 `buildContextEntries()` 而不是 `getBranch()`**：二者都从 `leafId` 回溯，但 `getBranch()` 会把压缩遮蔽的旧条目一并返回（`dist/core/session-manager.js`：`buildContextEntries` 按 `compaction.firstKeptEntryId` 丢掉被摘要掉的前段，`getBranch` 是纯父链遍历，不做这一步）。若用 `getBranch()`，被遮蔽的旧快照仍会被当成「最后一条同 `customType` 快照」，于是**该重追加时不追加** —— 模型这一轮读到的是已被压缩掉的旧环境事实（或干脆缺了本轮事实）。

## REMOVED Requirements

### Requirement: 瞬态注入项标记（`TRANSIENT_INJECTION_CUSTOM_TYPES` / `MessageRef.transient` / `dropTransient`）

**Reason**：它的唯一作用是让缓存断点归因忽略「每轮尾部那条新消息」。快照落盘后 id 稳定、位置固定，不再产生假差异；而保留剔除会让**真实断点**（正是本次要修的缺陷）在面板上不可见 —— 上一轮实测中面板「历史全命中」而 provider 实收 58,094 token 未命中，就是这个剔除造成的盲区。

**Migration**：常量、字段与函数一并删除，不再写入 `transient`。旧台账（已写入 `transient:true` 的历史 run）的归因会如实报「断在尾部那条」—— 对这些 run 而言这是**正确**的（它当时确实就是断点）；`cache-prefix.ts` 不再需要旧台账降级分支。

## 否决方案

> 按 `AGENTS.md §8`：被否掉的路与理由必须留档，避免同一决定被反复推翻。

**① 只做「内容没变就不注入」，仍不落盘（最小改动）—— 否，机制上无效。**
看起来能省掉重付，实际省不掉：
```
请求 N-1 = [ R_{N-1}, T ]        （T 变了 → 注入）
请求 N   = [ R_N ] = [ R_{N-1}, Δ ] （T 没变 → 不注入）
公共前缀：R_{N-1} 之后，N-1 位置是 T[0]、N 位置是 Δ[0]，**在 |R_{N-1}| 处断掉**
⇒ cacheRead_N = |R_{N-1}| = prompt_{N-1} − |T|，gap 依旧是 |T|
```
只有当「上一轮恰好也没注入」时 gap 才为 0，于是行为变成锯齿状、且每轮都在赌。**必须落盘**，T 才会成为历史里位置固定的一员。

**② 把注入块并进系统提示词的新增末段 —— 否，代价最大。**
系统提示词是请求的 message 0：它内部任何字节变化都会让**其后的一切（含整段历史与工具定义）**在缓存里失配，而 `current_time` 每 run 必变 ⇒ 每 run 全废。既有实测：提示词改一处 → 首步 `cacheRead` 掉到 0（0.0%）。

**③ 把注入块放到消息数组最前（紧跟系统提示词之前/之后）—— 否。**
断点从「上一轮历史末尾」提前到「历史之前」，等于每轮把整段历史重付，比现状更差。

**④ 合并两个通道为一条快照消息 —— 否。**
`hidden-context` 因 `current_time` 每 run 必变，合并后 73%（3,463 / 4,593 字符）的稳定内容会跟着每 run 重发。分通道独立去重才能各自免费。

**⑤ 用 `AgentSession.sendCustomMessage()` 在 `prompt()` 之前追加（快照落在用户消息**之前**）—— 未采纳，非正确性否决。**
它同样能满足「持久 + append-only + 缓存等价」，落位还更接近 WorkBuddy 的阅读顺序（环境说明在读用户正文之前）。选择 `before_agent_start` 的理由：它是 pi 官方文档标注的持久消息注入路径（*"Inject a persistent message (stored in session, sent to LLM)"*），落位由 pi 保证，我们不必自己保证顺序、`triggerTurn` 语义与流式竞态。代价承认：注入落在用户消息**之后**，与 WorkBuddy 的读序不同（与上一轮 spec 的有意偏离一致）。

**⑥ 不落盘、只在 UI 上把口径说清 —— 否。**
接受 58,094 token/会话的固定浪费 + 永久放弃续写命中，且命中率会随 `PROFILE.md` 增长单调恶化。

**⑦ 升级 pi 走 dsh 的 in-history system prompt 路线 —— 否（维持旧结论）。**
发布版 `pi-coding-agent@0.85.1` 无 `sections` / `in-history` 能力位；且旧探针实测表明 dsh 记录的「latest system = 完整系统提示词」这条模型契约在本端点未复现。本次改动不依赖升级 pi。

## 已知偏离

> 按 `AGENTS.md §8`：如实登记，不掩盖。**两条：① 留用户裁决；② 为如实登记的可接受差异。**

**① pi 导出 HTML 的侧边会话树没有 `display` 门槛，会把快照正文开头印成树标签（不做）。**

- **现象**：pi 的 `export-html/template.js` 里，「聊天正文」与「侧边会话树的树标签」是两条分支：
  - 正文分支有 `display` 门槛 —— `if (entry.type === 'custom_message' && entry.display)`（该文件 L1309），所以 `display:false` 的快照**不进会话正文**；
  - 树标签分支（`getTreeNodeDisplayHtml` 的 `case 'custom_message'`，同文件 L691-693）**没有 `display` 门槛**，直接印 `truncate(normalize(content))`；`truncate` 的默认 `maxLen = 100`（同文件 L631）—— 于是树标签显示快照正文的**前 100 字符**（形如 `[kamibuddy-hidden-context]: <system-reminder …`）。
- **影响面**：仅**导出 HTML 的侧边会话树**。用户可见的**聊天流正文不受影响**，已用测试钉住（Task 3：`session-host.translate` 的事件流「有/无快照逐条相等」断言 + `session-rebuild` 的 `custom_message` 跳过断言）。
- **为什么不修**：导出文件把 session 数据以 **base64 内嵌**（`node_modules/@earendil-works/pi-coding-agent/dist/core/export-html/index.js:104` 的 `Buffer.from(JSON.stringify(sessionData)).toString("base64")`；pi 发布包只带编译后的 `dist/`，仓库里没有 `export-html/index.ts` 源），树标签由**内嵌在 HTML 里的 template.js** 在客户端渲染 —— 要修只能对 pi 生成的 HTML 做 **base64 解包 + 条目剔除/脚本重写**，依赖 pi 模板内部标记，pi 一改格式整条导出链路就变脆（违反本项目「不写防御性兜底」与「能借力不自研，AGENTS.md 选型顺序」）⇒ **不做**。
- **裁决点（留用户）**：① 接受（导出树的快照标签多一行，正文干净）；② 接受脆弱性、去改 pi 导出的 HTML；③ 改用别的导出实现。

**② pi 导出 HTML 的页头统计行会多出一项 `N custom`（可接受，如实登记）。**

- **现象**：pi 的 `computeStats` 对 `custom_message` 单独计数（`dist/core/export-html/template.js:1356-1357` 的 `customMessages++`），`renderHeader` 把它印进页头统计行（同文件 `:1379` 的 `msgParts.push(\`${globalStats.customMessages} custom\`)`）。改动前会话文件里没有 `custom_message` 条目 ⇒ 该行不出现这一项；改动后每个含快照的会话导出都会多一项，条数 = 该会话落盘的快照条数（与 spec 的 `## 复跑实测` 里会话文件的 4 条一致）。
- **影响面**：仅**导出 HTML 的页头统计文案**（多一个 `N custom` 计数），不改变正文、侧边树（差异见 ①）与用户可见聊天流。
- **为什么不修 / 结论**：与 ① 同源 —— 它是 pi 模板内部行为，修它同样要动 pi 生成物。改动本身正确（统计如实反映会话多了持久快照条目），属**可接受**的可见面变化，登记以免用户对照旧导出件时误判为异常。

## 复跑实测（Task 7，2026-09-18）

> 探针：`scripts/probe-context-snapshot.ts`（`npm run probe:context-snapshot`）。
> 复跑：`npx tsx scripts/probe-context-snapshot.ts`；对照组 `… --replay=<台账.jsonl>`（只跑 fold，不发请求）。
>
> **走的是生产装配入口**：`SessionHost.create()` + 真实 `createPromptSwitch`
> （`composeRuntimeContext` = 真实记忆 + 个性化读取，`composeHiddenContext` = 宿主真实
> `peekHiddenContext()`）、真实 `resources/`、真实凭据与真实 provider
> （`deepseek/deepseek-v4-flash-vision-exp`，`https://api.deepseek.com`）、真实台账
> `~/.kamibuddy/logs/runs/<sessionId>.jsonl`。读数由**台账 fold** 得出（与 `--replay` 同一份实现）。
>
> 会话 `01a0b325-7548-7588-b0d8-4e1eabb968b4`：**5 个 run / 24 次模型调用**（临时 cwd，题目与基线同：
> 人工智能发展历程 HTML 幻灯片；本次会话成本 **$0.0126**，低于基线那次约 $0.06）。
> 证据：台账 `~/.kamibuddy/logs/runs/01a0b325-….jsonl`、会话文件
> `~/.kamibuddy/sessions/2026-09-18T06-12-51-657Z_01a0b325-….jsonl`。
>
> 口径：`prompt` = provider 的 `prompt_tokens`（= pi 的 `input + cacheRead + cacheWrite`；
> 已核 pi 的 `parseChunkUsage`：`input = prompt_tokens − cached_tokens − cache_write_tokens`，
> 三桶互不相交）。`gap_N = prompt_{N-1} − cacheRead_N`。

### 读数（与基线对照）

| | 基线（改动前，`01a0b2b3-….jsonl`） | 本次（改动后，`01a0b325-….jsonl`） |
| --- | --- | --- |
| 模型调用 / run | 24 / 2 | 24 / 5 |
| 相邻对 gap 最小…最大 | **2,423…2,615** | **−7,414…56** |
| gap > 128 的相邻对 | 23 / 23 | **0 / 23** |
| Σprompt / ΣcacheRead | 2,214,324 / 2,012,416 | 758,826 / 739,328 |
| 加权命中率（ΣcacheRead / Σprompt） | 90.88% | **97.43%** |

**逐对校验（spec 的两条 Scenario 都覆盖到）**：

- **run 内相邻 step**（n=19）：min −7,414，max **56**；
- **跨 run 的第一次调用**（n=4）：min −497，max **−403**；其中 2 次**本轮追加了新快照**（#7 → run 2 首调、#13 → run 3 首调），2 次没有（#15、#20）——两种子形态都 ≤ 128。
- **残差**：21 对 ≤ 0，2 对落在 `(0, 128]`（26 / 56）⇒ 残差就是 provider 的块粒度，**不存在块级常量偏移**（基线 23 对全部落在 2,423…2,615）。

**未命中拆解（恒等式，三项之和必然等于实测未命中）**：

- **冷启动 4,124 + 本轮新增 34,147 − 续写命中 18,773 = 19,498**（= 实测未命中）。
- 基线同一拆解：17,152 + 126,662 + **58,094** = 201,908 —— 那 58,094 就是本次修掉的「尾部块重付」；本次这一项为 **0**（负号那 18,773 是**减项**，见下）。
- **负数 gap 的来源（逐对核过）**：`cacheRead_N > prompt_{N-1}` 的超出量**恒 ≤ 上一次调用的 output**（#3 超 7,414，上次 output 9,020；#8 超 3,642，上次 3,742）——即 provider 的盘上缓存把**上一轮模型自己生成的 token** 留在了前缀里，续写那一段免费。这正是 Why 第 2 条从 dsh 侧预期、而我们此前全程为 0 的那块红利，本次会话拿到 **18,773**（与 dsh 侧该任务的 19,915 同量级）。

### 对照组：基线台账用同一套 fold 复算（缺了它上面的对比不成立）

```
npx tsx scripts/probe-context-snapshot.ts --replay=C:/Users/wzd/.kamibuddy/logs/runs/01a0b2b3-2c58-73d3-86d8-fa46a81ca9d2.jsonl
```

复现结果与 Why 段逐数字一致：24 次调用 / 2 run、gap **2,423…2,615**（23/23 对 > 128）、
Σprompt 2,214,324、ΣcacheRead 2,012,416、加权命中率 **90.88%**、
拆解 17,152 + 126,662 + 58,094 = 201,908；且旧形态的快照在逐条清单里的下标是
`1,2 → 5,6 → 9,10 → … → 59,60`（**每轮后移且始终在末尾**），与「瞬态尾巴」的定性吻合。

### 快照的持久 / 去重 / 落位（会话文件实测）

会话文件 56 行，其中 `custom_message` **4 条**（会话共 5 个 run）：

- `kamibuddy-runtime-context` **×1**（3335 字符）：记忆与个性化全会话未变 ⇒ 只追加一次；
- `kamibuddy-hidden-context` **×3**（各 1066 字符）：`formatRunTime` 是**分钟**粒度，run 1（06:12:51）、run 2（06:13:46）、run 3（06:14:15）各追加一条，而 run 4（06:14:21）与 run 5（06:14:57）渲染出的字节与 run 3 **逐字节相同** ⇒ 按判据 `shouldAppendSnapshot` 不追加。这是期望行为（内容没变就不追加），也说明「每 run 必追加一条」并不成立 —— 追加频率取决于 `current_time` 的分钟边界。
- **落位**：首条快照处的条目序实测 `message:user → custom_message:kamibuddy-runtime-context → custom_message:kamibuddy-hidden-context → message:assistant`；
  台账里 `role=other` 的下标从 run 1 起恒为 `[1,2]`，run 2 追加后恒为 `[1,2,16]`，run 3 追加后恒为 `[1,2,16,29]` —— **消息列表从 3 条涨到 52 条，快照的下标一个都没动**（该轮追加的新快照落在新用户消息之后，因此它只作为「本轮新增内容」付费一次，而不是把整段前缀顶掉）。
- 会话内系统提示词分段形态 **1 种**（逐字节稳定）——排除「提示词字节变化」这条会污染 gap 的旁因。

### 未达成 / 需注意（如实登记）

1. **加权命中率的绝对值不能与基线直接相减**：探针只装 prompt-switch 一个扩展，工具面 = pi 内置工具 ∩ craft 白名单（read/write/edit/find/grep/ls），而真实 app 用户会话另有扩展注册的工具（web_search / powershell / present_files / docx_* / questionnaire / conversation_search / use_skill…）。工具 schema 是请求里的**常量前缀**，不参与 gap 判据，但会改变命中率绝对值（基线冷启动 17,152 vs 本次 4,124 的差主要来自这里，与会话内容量）。
   同口径的可比数字：基线若去掉那 58,094 的固定偏移，其命中率上限为 **93.51%**；本次实测 **97.43%**，其中 18,773 来自续写命中，扣掉续写命中后为 **94.96%** —— 两个口径都落在预期方向上。
2. **单次会话读数，不是统计样本**：同一任务、同一模型族的一次实跑（成本与基线同量级），命中率对「本轮新增内容占比」敏感（本次每轮新增多为工具结果，量小）。复跑命令见上，`--replay` 可随时复算基线。
3. **探针与真实 app 会话的其它差异**：无权限门 / 无沙箱 / 无 present_files；不绑专家（expertId 恒 undefined）；两轴恒 work/craft。差异清单写在探针文件头。
4. **压缩路径：单测层已覆盖，真实 app 会话层未覆盖** —— `src/extensions/prompt-switch-session.test.ts` 的 6.1 用例走**真实 `AgentSession.compact()`**（摘要 LLM 打桩为本地 SSE 桩），夹具内置前提守卫显式断言 `buildContextEntries()` 与 `getBranch()` **确实分叉**（`activeHidden` 长度 0 而 `branchHidden` ≥ 1），并已被反向自证（把基线改成 `getBranch()` / `getEntries()` → 该例精确变红）。**仍未做**：真实 app 会话（daemon / SessionHost 路径）里触发一次压缩的端到端读数 —— 探针 `scripts/probe-context-snapshot.ts` 不触发压缩。

> 按 `AGENTS.md §8`：以上读数全部来自实际运行与实际台账文件，未改口径、未估算；
> 与预期不符处（若有）已如实列出并另列新任务，不改已有结论。

