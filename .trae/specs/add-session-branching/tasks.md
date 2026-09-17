# Tasks

- [x] Task 1: 实测 pi 的分支语义（**前置，阻塞 Task 2/3 的实现方式**）
  - [x] SubTask 1.1: 新建 `scripts/probe-session-branch.ts`：用临时目录 + `SessionManager` 直接构造一棵会话树（假数据，不调 LLM，不联网），逐条断言：
    - [x] SubTask 1.1.1: `createBranchedSession(leafId)` 抽出的文件是否含 root→leafId 全量条目、是否改动源文件、是否写 `parentSession`、返回什么；`leafId` 传历史条目与传「首条之前」分别是什么结果
    - [x] SubTask 1.1.2: `branch(entryId)` / `navigateTree(targetId)` 是否持久化叶子位置（回退 → dispose → 重新 `open` → 读 `getLeafId()`）
    - [x] SubTask 1.1.3: `SessionManager.open(path).getHeader().parentSession` 是否可读、字段名与形状
  - [x] SubTask 1.2: 把实测结论（含与预期不符之处、降级路径）写进探针文件头注释，作为后续实现的依据
  - [x] SubTask 1.3: 若 `navigateTree()` 能正确处理叶子持久化与压缩上下文 → 结论写明"Task 3 优先用它"；否则写明改用「母文件前缀重写」方案

  实测结论（`npx tsx scripts/probe-session-branch.ts` → 26/26 通过；完整版见文件头注释）：
  - `createBranchedSession(leafId)` = root→leafId **全量**抽出到新文件，源文件字节不变，新 header 写 `parentSession`（母文件绝对路径），返回新文件路径；`leafId` 传 `null` **无效**（静默回落当前叶子）→ 空历史分支改用 `SessionManager.create(cwd, sessionsDir, { parentSession })`；抽出内容不含 assistant 时文件**尚未落盘**
  - **叶子不落盘**：`branch()` 与 `navigateTree()` 都只改内存叶子，JSONL 无叶子指针条目，重开时叶子 = 文件最后一行 → 回退的持久化只能靠母文件前缀重写（既定方案成立）
  - `navigateTree(userEntryId)`：叶子移到该消息 `parentId`，返回 `editorText` 可直接进输入框，并重建上下文；仍不落盘
  - 构造 `AgentSession` 会追加一条 `thinking_level_change` 条目（前缀按 parentId 链取，天然免疫）
  - `getHeader().parentSession` 成立；`getEntry(id).parentId` 可读；`getEntries()` 不含 header；未知 id 返回 `undefined`
  - **锚点口径**：恢复路径渲染层 user 条目 id === JSONL 条目 id；**在线路径不等**（`nextId("user")` 造 id）→ 通道入参改为**用户消息序号**，daemon 用 `getUserMessagesForForking()` 解析真实 entryId
  - 技能消息在条目里就是普通 user 消息，不额外拆条

- [x] Task 2: `core` 层：会话文件的前缀读取与原子重写（依赖 Task 1 结论）
  - 修订（Task 1 结论）：前缀的读与写**按原始行逐行搬运**（不要在内存里反序列化再序列化），这样天然兼容 pi 未来新增的条目类型；只有 header 那一行需要解析并改写（`parentSession`）
  - 新增：空历史的分支文件由本模块直接写出（只有 header + `parentSession` + `session_info`），不依赖 `createBranchedSession(null)`（实测无效）
  - [x] SubTask 2.1: 新建 `src/core/session-file.ts`：读 header、按条目 id 取「root→某条目」的**原始行**前缀、把「header + 前缀」原子写回（tmp + rename，手法参考 daemon 的 `rewriteSessionHeaderCwd`）；写入必须发生在宿主 dispose 之后、重建宿主之前
  - [x] SubTask 2.2: 同文件：为会话文件补写 `parentSession`（只改 header 行）、追加 `session_info` 会话名（若已是目标名则不重复追加）
  - [x] SubTask 2.3: 单测 `src/core/session-file.test.ts`：坏行容忍、前缀切分正确（含条目 id 不存在时）、原子写后文件可被 `SessionManager.open` 正常打开且 `getLeafId()` 等于前缀末条、`parentSession` 写入位置正确、仅 header 的空会话文件可被打开

  实测结论（Task 2 完成，11 用例全绿）：导出 `readSessionFileLines` / `readSessionHeader` / `sessionPrefixLines` / `writeSessionFileLines` / `truncateSessionTo` / `setSessionParentSession` / `setSessionName` / `createEmptySessionFile` / `createSessionFileFromPrefix`；**`SessionManager.create` 不立即落盘**（实测），故空会话文件由本模块落盘（header 仍由 pi 生成，抗格式漂移）；给 Task 5 的三条硬提醒：① 不要 `SessionManager.open()` 一个 pi 没写过的抽枝路径（会静默变成全新空会话、`parentSession` 丢失）② pi 的 `create` 系 manager 留着会有 `wx` EEXIST 风险，一律改用 `open()` 重建 ③ 写入前必须已 dispose 宿主

- [x] Task 3: daemon 纯逻辑：分支决策与结果形状（依赖 Task 1、Task 2）
  - 修订（Task 1 结论 + Task 4 已落地）：结果类型直接用 `src/shared/ipc.ts` 里已导出的 `SessionBranchResult` / `SessionBranchFailReason`（reason 只有 `busy` / `no-file` / `no-such-entry` / `write-failed`；**不要**新增 `not-persisted`——叶子持久化由我们自己做）；锚点入参是**用户消息序号**，由 daemon 侧用 `getUserMessagesForForking()` 解析成 entryId，解析不出（序号越界 / 列表数量不一致）返回 `no-such-entry`
  - [x] SubTask 3.1: 新建 `src/daemon/session-branch.ts`：定义操作入参（`{ path, userIndex, mode: "restart" | "fork" }`）与纯函数：序号→entryId 解析与一致性守卫、判定「分叉点之后是否确有内容」、生成分支标题
  - [x] SubTask 3.2: 分支标题规则：`母标题 · 分支`，与现有会话标题重名时追加递增序号（`· 分支 2`、`· 分支 3`…）
  - [x] SubTask 3.3: 单测 `src/daemon/session-branch.test.ts`：标题重名递增、无未来时不抽枝、序号越界与数量不一致的边界

  实测结论（Task 3 完成，15 用例全绿）：导出 `SessionBranchRequest` / `ForkAnchor` / `BranchEntry` / `resolveAnchorForIndex` / `decideExtract` / `buildBranchTitle` / `branchOk` / `branchFail`；`branchFail` 已内置四类中文文案（busy →「正在生成，稍后再试」等）；顺带把 `InvokeMap` 与 bridge 的第二参改名为 `userIndex: number`（`src/shared/ipc.ts:906-913`、`src/shared/bridge.ts:123-137`；`src/preload/index.ts` 透传无需改）

- [x] Task 4: IPC 契约与 bridge（可与 Task 2/3 并行）
  - [x] SubTask 4.1: `src/shared/ipc.ts`：新增 `INVOKE.sessionRestart = "session:restart"`、`INVOKE.sessionBranch = "session:branch"` 与对应 `InvokeMap` 条目；`SessionSummary` 增 `parentSession?: string`
  - [x] SubTask 4.2: `src/shared/bridge.ts`：暴露 `restartSessionFrom` / `branchSessionFrom` 两个方法与入参类型（另需在 `src/preload/index.ts` 的 `KamiBridge` 实现里补转发，否则类型检查不过）
  - [x] SubTask 4.3: 类型自检：`npm run typecheck`、`npm run check:deps` 通过

- [x] Task 5: daemon 接线（依赖 Task 1-4）
  - [x] SubTask 5.1: 两个 handler 接进 `src/daemon/index.ts` 的 handlers 表（替换 Task 4 的占位），实现体走 `enqueue(bucket)` 互斥链；running / 无文件 / 序号解析失败一律返回 `ok:false` 且不改状态
  - [x] SubTask 5.2: 「重新开始」流程（**顺序敏感**）：① 先把被放弃的未来抽成分支文件（若有内容）② 再截断母文件为「header + root→分叉点前缀」③ 重建宿主与历史 ④ 按现有 resume 的时序补发（先条目、后 `context_usage` 覆盖，见 `resumeSessionOnce` 的踩坑注释）
  - [x] SubTask 5.3: 「分支出新会话」流程：抽枝到分叉点之前（优先 `createBranchedSession(anchorParentId)`；文件未落盘或分叉点是首条消息时用 Task 2 的写入器/`SessionManager.create(cwd, sessionsDir, { parentSession })`）→ 补 `session_info` 标题 → 用现有 resume 路径注册成桶（**显式拷贝**母桶的 sceneId / interactionId / expertId / `lastNonPlanInteraction`）→ 切当前桶 → 推列表
  - [x] SubTask 5.4: `resumeSessionOnce` 抽出可复用的「按文件建桶 + 建宿主 + adopt + 重建历史」函数，两条路径共用，避免复制第二份时序逻辑
  - [x] SubTask 5.5: 列表组装补 `parentSession`（读 header），并确认子代理会话过滤、任务区/空间区分流规则不受影响
  - [x] SubTask 5.6: 手工冒烟：临时目录里跑通两条路径（可用 `scripts/` 下的现有冒烟脚本模式），确认无同文件双写、无孤儿宿主
  - [x] SubTask 5.7: 锚点解析与一致性守卫：渲染层序号 ↔ `getUserMessagesForForking()` 列表；不一致时返回 `no-such-entry`，且**任何写操作都不得发生**

  实测结论（Task 5 完成，`npx tsx scripts/smoke-session-branch.ts` → 28/28 通过；完整版见脚本文件头注释）：
  - 两个 handler 在 `src/daemon/index.ts`：`restartSession` / `forkSession`；共用 `resolveBranchAnchor`（链内解析序号→entryId→父条目）、`materializeBranch`（抽枝/空历史 → 命名 → 补 parentSession）、`extractBranchFile`、`branchTitleFor`。`resumeSessionOnce` 拆出 `mountSessionFile` / `remountHostInBucket` / `buildConversationForBucket` / `applyRebuiltConversation`（Task 5.4）
  - **抽枝必须用一次性 manager**：pi 的 `SessionManager.createBranchedSession` 会把**管理器自身**的 sessionId/sessionFile 换成新文件（dist session-manager.js:1162-1165），在活宿主的管理器上调用 = 母会话后续落盘全写进分支文件。故导出 `core/session-file.ts` 的 `createBranchedSessionFile(sourcePath, leafId)`（open 一个用完即弃的实例），**没有**在 `SessionHost` 上开这个口子（那是劫持版）
  - `SessionHost` 新增三个窄方法：`listForkableUserMessages()` / `listEntryRefs()` / `currentLeafId()`（pi 类型止步于 core）
  - 截断：`truncateSessionTo(path, 父条目)`；父条目为 null（分叉点是首条消息）时新增 `truncateSessionToStart(path)`（只留 header）
  - **history_reset 的时序**：`emitSessionEvent(history_reset)` 之后必须**同步**填回重建结果（renderer 收到该事件就去重拉 snapshot，中间任何 await 都会让它拉到空视图）；`applyRebuiltConversation` 同时用 `host.state` 覆盖 state（否则 sessionId 被 reducer 复位成空串、renderer 指针失位）
  - `listSessions` 的 `parentSession` 直接取 pi 的 `SessionInfo.parentSessionPath`（listAll 已从 header 读好），**零额外 IO**，不需要读首行的窄函数
  - 冒烟里的两个环境结论：① 夹具的根上要预置 `thinking_level_change`（否则 pi 构造 AgentSession 时会补一条，母文件行数断言会漂）② `session:prompt` 的响应在 run 结束前不回来（假服务商不应答），验证 running 拒绝必须改成 fire-and-forget + 轮询列表 running；C5 用例从反面兜住（中断后同通道不再 busy）

- [x] Task 6: renderer：用户消息分支入口（依赖 Task 4；可先用假 handler 联调）
  - [x] SubTask 6.1: 先读 `DESIGN.md`，复用现有 hover 工具条与既有按钮档位，不新增硬编码视觉值
  - [x] SubTask 6.2: 用户消息气泡动作条新增「重新开始」「分支出新会话」两项（与时间戳/复制同处），流式中或会话无文件时不可用
  - [x] SubTask 6.3: 点击后调用新通道；成功后「重新开始」把该轮原文（`skillInvocationText` 回拼）填入输入框；「分支出新会话」等待切换完成后填入
  - [x] SubTask 6.4: 结果提示：有抽枝时说明"后续内容已存为分支会话《标题》"；无未来时只说明已回到这一轮之前；失败时按 `reason` 给可读文案（不静默）

  实测结论：`src/renderer/branch-target.ts`（纯函数 `branchTargetsOf`，只数 user 条目、技能回拼走 `shared/skill-block.ts`）+ 单测；`chat-view.tsx` 用户气泡工具条加两个 `.entry-icon-btn` 档位按钮（`IconRefresh`/`IconBranch`，13px，零新增视觉值）；回填走 Composer 既有 prefill 通道（`fillText`），跟随切换走 `resyncSnapshot`（其返回类型由 void 改为 Promise<void>，内部恒 resolve）；文案「后续内容已存为分支会话《X》」/「已回到这一轮之前」/ 失败直接用 daemon 的 `message`

- [x] Task 7: renderer：「重试」改为回退重发（依赖 Task 5）
  - [x] SubTask 7.1: 重试按钮改调 `session:restart` 并携带末条用户消息的序号，成功后再自动发送原文
  - [x] SubTask 7.2: 错误卡上的「重试」保持同一语义（同一实现，不写两条分支）
  - [x] SubTask 7.3: 自检：重试后历史中不再出现两条相同用户消息

  实测结论：操作条（`chat-view.tsx:2193`）与错误卡两处（`:2149-2153`、`:2397-2400`）共用同一个 `retrySubmit`；回退在构造上保证不再产生重复用户消息（先截断再发），真机验收见 Task 10

- [x] Task 8: renderer：侧栏分支标识（依赖 Task 5）
  - [x] SubTask 8.1: `SessionSummary.parentSession` 到达后有分支标记（图标 + title），hover 显示来源会话标题；来源已删除时只显示标记
  - [x] SubTask 8.2: 确认分组规则不变（分支与母会话同 cwd → 同空间组同序）
  - [x] SubTask 8.3: 样式走 token；`npm run check:tokens` 通过

  实测结论：新增 `src/renderer/session-origin.ts`（纯函数 `resolveSessionOrigin` / `sessionRowTitle`，按 path 全等解析来源、母会话不在列表时文案「来源会话已不在列表」，无 undefined 字面量）+ 9 用例；`sidebar.tsx` 行内 `IconBranch`（复用现有图标，size 12）+ 行 title；`index.css` 仅新增 `.task-branch-mark` 一条（只用 `var(--space-1)`/`var(--text-secondary)`，下沉量沿用既有 `-0.18em` 手法）；`session-groups.ts` 零改动

- [x] Task 9: 全量校验与验收
  - [x] SubTask 9.1: `npm run typecheck && npm run check:deps && npm run check:tokens && npm test`
  - [x] SubTask 9.2: 按 `checklist.md` 逐条人工验收（两条路径、首条消息边界、流式中拒绝、任务区会话不产生新目录、状态继承、产物清单继承）

  实测结论（2026-09-17）：
  - `npm run typecheck` ✅ ｜ `npm run check:deps` ✅（扫描 317 文件）｜ `npm run check:tokens` ✅（仅剩白名单例外）
  - `scripts/probe-session-branch.ts` ✅ 26/26 ｜ `scripts/smoke-session-branch.ts` ✅ 28/28 ｜ 新增单测 ✅（session-file 11 + session-branch 15 + branch-target 4 + session-origin 9）
  - 全量 `npx vitest run`：**2182 passed / 10 skipped，唯一失败为 `src/sandbox/confinement.win.test.ts`**（受限令牌探测 `0x80000005`，与本 spec 零交集；同错误码在本环境的命令层反复出现，属 Trae 沙箱环境限制，非代码问题）
  - checklist 逐条核验：可静态核验项全部通过；3 项需真机 GUI 确认（输入框回填、侧栏标记真机渲染、重试后历史只用一条），另 1 项为过程性事实（「已读 DESIGN.md」）—— 见 Task 10

- [ ] Task 10: 真机人工验收（**需要用户在 Electron 界面点一遍，无法由 AI 完成**）
  - [ ] SubTask 10.1: 点用户消息「重新开始」→ 输入框回填原文且不自动发送；toast 说明后续内容去哪了
  - [ ] SubTask 10.2: 点「分支出新会话」→ 视图切到新会话、输入框回填；母会话内容不变
  - [ ] SubTask 10.3: 侧栏分支行显示分支图标，hover 显示「来源会话：<母标题>」；删除母会话后显示「来源会话已不在列表」且不报错
  - [ ] SubTask 10.4: 重试（操作条 + 错误卡）后历史里只有一条该用户消息，旧内容可在分支会话找回
  - [ ] SubTask 10.5: 分叉点之前用 `present_files` 交付过的产物，在分支会话的产物面板可见
  - [ ] SubTask 10.6: 流式中两个入口的 busy 提示；未落盘的新会话看不到入口

# Task Dependencies

- Task 2 依赖 Task 1（抽枝/叶子持久化的实现方式由实测结论决定）
- Task 3 依赖 Task 1、Task 2
- Task 5 依赖 Task 1-4
- Task 4 可与 Task 2/3 并行
- Task 6 依赖 Task 4（mock 可先联调），Task 7/8 依赖 Task 5
- Task 9 依赖全部
