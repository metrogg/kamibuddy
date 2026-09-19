# Tasks

> 交付顺序：先纯函数与通道（可单测）→ 再接线 → 再门禁 → 最后真机取证。
> 本 change 的最终交付物是**证据**（领导是否自然看见产出、代价多大），不是新功能。

- [ ] Task 1: 新增第四条快照通道 `kamibuddy-team-output`（含「不写取代声明」）
  - [x] SubTask 1.1: `src/shared/observability.ts` 新增 `TEAM_OUTPUT_CUSTOM_TYPE = "kamibuddy-team-output"`，紧邻既有三条并注明消费点（会话导出过滤 / 翻译过滤 / request_snapshot）
  - [x] SubTask 1.2: ~~`snapshotMessage` 支持「是否带取代声明」开关~~ **已作废**：读码后确认取代声明由各通道 composer 写进正文，`snapshotMessage` 从不接触它 —— 加开关是无用代码。本通道「不写声明」由 Task 2 的 composer 保证
  - [x] SubTask 1.3: 该文件新增第四条 handler，接 `composeTeamOutput(previous)` 回调，注册顺序固定在既有三条之后（基线由 handler 读出后作入参传入）
  - [x] SubTask 1.4: 同步该文件的「模型体验契约」三段（五个 handler / 四条快照 / 新通道的付法与落点）
  - [x] 验证: `check-model-experience` 通过（22 个模块）；`prompt-switch.test.ts` 27 例全绿（既有三条通道期望值一字未改）
- [x] Task 2: 快照拼装纯函数层 `src/daemon/team-output-snapshot.ts`
  - [x] SubTask 2.1: `outputFingerprint(output)` —— `normalizeMemberOutput` 后取 sha256 前 8 位十六进制
  - [x] SubTask 2.2: `composeTeamOutputSnapshot(input)` —— 状态行（名字 / 角色 / 状态 / 已完成轮数，与 `team_status` 同口径）+ 只含「指纹未出现在 `previous` 里」的成员产出块；每块按 `TEAM_OUTPUT_MAX_CHARS`（缺省 4,000）截断并标注「（已截断，全文用 `team_read`）」；无团队或没有任何新信息 → `undefined`
    - [x] **修正（实施中发现的设计缺陷，必须做）**：原判据「指纹未出现在 previous 里」会**A/B 两态交替**——注入过产出后下一次 run 只剩状态行（无指纹）⇒ 再下一次 run 产出块又被拼回，于是**每个 run 都追加一条**，去重彻底失效（正是本 change 要避免的缓存杀手）。修法：**状态行末尾带上该成员产出的指纹 `[fp xxxxxxxx]`**（每个成员只保留"最近一次已注入产出"的指纹，长度与团队规模同阶、不随轮数增长）。判据改为：`该成员当前产出的指纹 ≠ previous 状态行里记的指纹 ⇒ 拼产出块`。这样"无新信息 ⇒ 候选与 previous 逐字节相同 ⇒ 不追加"，稳定不交替。**实测已钉**：run1 带产出块 → run2 纯状态行 → run3 返回 `undefined`
  - [x] SubTask 2.3: 单测 —— 指纹稳定 / 幂等 / 截断与标注 / 状态行口径 / 空团队与无信息返回 `undefined`（24 例全绿）
    - [x] 追加：**三连跑稳定性用例**（run1 注入产出 → run2 只剩状态行 → run3 与 run2 逐字节相同 ⇒ `undefined`），把"不交替"这条钉死
  - [x] 依赖: 无（纯函数，可与其他任务并行）
  - 顺带修掉：旧判据 `previous.includes(fp)` 是全串搜索，两名成员产出相同时会互相误杀；新判据按 `成员名 → 指纹` 键控
- [x] Task 3: 接线（只挂用户会话，其余装配点显式传 no-op）
  - [x] SubTask 3.1: `src/daemon/index.ts` 的 `createPromptSwitch` 装配处传 `composeTeamOutput`：门控 `isAgentTeamsEnabled()` + `teamRegistry.getTeam(leaderId)`；成员产出取 `readMemberTranscriptView(member.sessionId).output`；`previous` 用回调入参
  - [x] SubTask 3.2: 桶尚未 adopt（`bucket.sessionId` 为空）或成员无 sessionId 时返回 `undefined`，**不抛错**（读侧降级口径，同既有 compose 回调）—— 刻意不用 `adoptedSessionId`（它是响亮断言，用在这里会让读侧通道把 run 打炸）
  - [x] SubTask 3.3: **其余 4 个装配点显式传 no-op `() => undefined`**（`src/daemon/subagent-runner.ts`、`src/daemon/automation-runner.ts`、`src/extensions/prompt-switch-session.test.ts`、`scripts/probe-context-snapshot.ts`）—— 该 option 必填是为了"漏接会编译报错"，不是让它们默认关掉；spec 的 Impact 段漏列了这四处，实施时补齐
  - [x] SubTask 3.4: 断言「无团队 / 开关关闭时不读成员会话文件」—— 由 `collectTeamOutputMembers` 的注入式接缝覆盖（`team === undefined` ⇒ `readOutput` 调用次数 0；无 `sessionId` 的成员不调）。daemon 闭包层的两道门控无法单测，且**不搭测试专用旁路**（AGENTS.md §8）
  - [x] 依赖: Task 1, Task 2
  - 实测：`tsc --noEmit` 0 错误；`check:deps` 通过；三个相关测试文件 59 例全绿
- [x] Task 4: 决策记录与门禁
  - [x] SubTask 4.1: `docs/ARCHITECTURE.md` 新增 §4.22 决策段（含 `## 否决方案` 6 条），写清「照抄语义、不照抄载体」这个取舍，并点名第一版判据的两态交替是被单测抓住的
  - [x] SubTask 4.2: 门禁实跑全绿 —— `typecheck` 0 错误 / `check:deps` 通过 / `check:tokens` 通过 / `check:model-experience` 22 个模块全部符合 / `check:module-invariants` 25 个模块全部有登记 / `check:expert-assets` 4 个团队专家对得上 / 全量 `vitest` **159 文件 2930 例通过（1 skipped）**
  - [x] 依赖: Task 3
  - 另按纪律做了「护栏会变红」验证：把 `team-output-snapshot.ts` 的判据 `===` 改成 `!==` ⇒ 该文件 **24 例里 8 例失败**（含三连跑稳定性），已改回
- [ ] Task 5: 真机取证（**用户执行**；步骤与判读口径见下，检查命令已在本机验证可用）
  - [x] SubTask 5.1（**已真机执行，结论：未通过**）：2026-09-19 13:50 那次团队运行（`research-llm-2027`，领导会话 `01a0b837-c018-…`）里，领导会话**一条 `kamibuddy-team-output` 都没有**。已排除三个可能的误判：①构建不是旧的（`out/main/daemon.mjs` 13:50:42 构建，含 `composeTeamOutput` 6 处）；②拼装层没问题（用真机落盘的团队快照 + 真实成员会话文件跑 `collectTeamOutputMembers`/`composeTeamOutputSnapshot`，6 名成员、**1,596 字符**、产出全部读到）；③开关是开的（`agentTeamsEnabled: true`，且 `team_create` 确实调成功）。**真正原因：`before_agent_start` 只在 run 开始时触发一次**，而领导那一个 run 从 13:50:56 开始、团队 13:51:32 才建 —— 那一次求值时**还没有团队**；此后领导一直在同一个 run 里循环（直到 13:56:16），再没有第二次机会 ⇒ 通路的触发点跟实际形态错位。
  - [x] SubTask 5.2（**同一批真实数据**）：注入条数 0、字符总量 0；领导侧 `team_read` 调用 1 次（返回 `Tool team_read not found`，见 Task 6），改用「让成员落盘 → 自己 read」完成 Phase 1。缓存命中 95.5%、缓存浪费 0 tok（底部指标条）—— 即**没有任何劣化，因为压根没注入**。
  - [x] 依赖: Task 4
  - 说明：本机检查流水线已用既有三条通道验证过（对 `kamibuddy-hidden-context` / `kamibuddy-run-time` 能正确报出条数与字符量）。**不得以任何旁路代替真机**（AGENTS.md §8）。
- [ ] Task 6: 修「团队工具漏登记白名单」+ 决定注入的触发点（**真机暴露的两个问题**）
  - [x] SubTask 6.1（**已完成**）：`team_read` 在 spec: add-team-pull-model 批次③ 落地时只加了工厂注册、**忘了加进 `resources/modes/craft.md` 的模式白名单** —— pi 只激活白名单里的名字，于是领导调它得到 `Tool team_read not found`，并据此判断"工具面里没有产出回传通道"。已补进白名单（`team_status` 之后），并加护栏：`team-tools.test.ts` 新增「craft 白名单覆盖」用例（八个团队工具名逐一断言在白名单里），按纪律验证过会变红（把 `team_read` 从白名单去掉 ⇒ 1 例失败，报错文案直接给出该事故的形状）。机械核对过：`src/extensions/**` 注册的名字里，白名单**只漏过 `team_read` 这一个**（`kamibuddy` 是 MCP 客户端名的误报）。
  - [x] SubTask 6.2（**已定案：选 (b)，并已实施**）：注入触发点与领导实际形态错位（`before_agent_start` 是 per-run，领导一个 run 有 **42 次模型调用**）⇒ 主要触发点改为「把尚未送达的成员产出一块附在**任一 `team_*` 工具的结果**上」，run 起点那条快照通道保留作窄场景兜底。两条触发点**共用同一条判据**（扫领导会话正文里的 `[fp …]`，交付事实藏在会话内容里、不引入任何账本）。三条候选的裁决与理由写进 `docs/ARCHITECTURE.md` §4.22 的「否决方案（触发点）」第 7~9 条：
    - (a) 只靠 run 开始 —— **被真机否掉**（那次求值时团队还没建）
    - (b) 挂到 team 工具结果 —— **采纳**（工具结果 append-only 持久记录，付一次进缓存）
    - (c) per-request 注入 —— **否决**（瞬态 ⇒ 「不重新注入」与「模型每轮看得见」不可兼得；按 42 次/run 计 ≈4.2 万 tokens/run，上限时 ≈84 万）
  - [x] 依赖: Task 5
- [x] Task 7: 纯函数层（(b) 的判据与块）—— `collectFingerprintsIn` + `composePendingTeamOutput`
  - [x] 复用既有渲染（`assembleSnapshot`/`renderStatusLine`/`renderMemberBlock`），两块**逐字节同形**（单测里加了强断言）；`members` 空或**无待送达** ⇒ `undefined`（零成本路径）
  - [x] 单测 41 例全绿（含闭环用例：把第一次返回文本喂回 `collectFingerprintsIn` ⇒ 第二次返回 `undefined`）；护栏验红过（把 `delivered.has` 短路 ⇒ 红 3 例）
  - [x] 依赖: Task 2
- [x] Task 8: 接线（工具结果 + 单点包装 + 两条触发点共用一条判据）
  - [x] `team-tools.ts`：`TeamToolDeps` 新增 `readPendingOutputs`；工厂内单点包装 `register()` 包住八个注册点（只追加 `content`、**`details` 原样**）；契约三段同步
  - [x] `index.ts`：新增局部 `pendingTeamOutput()`（门控 → 注册表 → `collectTeamOutputMembers` → `collectFingerprintsIn(领导会话正文)` → `composePendingTeamOutput`），两条触发点共用（`composeTeamOutput` 与 `readPendingOutputs`）
  - [x] `prompt-switch.ts`：`composeTeamOutput` 收敛为**零参**（`previous` 已无消费者；判据统一到调用方），handler 去掉手动读基线
  - [x] 单测：`team-tools.test.ts` 覆盖「有块/无块/两个不同工具都生效/details 不变」；护栏验红过（包装短路 ⇒ 红 2 例）
  - [x] 依赖: Task 7
- [ ] Task 9: 真机复验（**用户执行**）：重跑一次团队任务，确认领导**没调 `team_read`** 也在 `team_status`/`team_send` 的结果里看到成员产出；并量出这次真实代价（注入块数 / 字符量 / |输入 token 与缓存命中变化）
  - [ ] 依赖: Task 8

# Task Dependencies

- Task 3 depends on Task 1, Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 4
- Task 2 可与 Task 1 并行（无依赖）
