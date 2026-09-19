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
  - [ ] SubTask 5.1: 建队 → 等成员产出 → 领导**不调** `team_read`；检查领导会话 JSONL 是否出现 `kamibuddy-team-output` 条目，以及领导下一轮是否引用成员产出内容
  - [ ] SubTask 5.2: 量代价 —— 注入条数 / 字符总量 / 该会话输入 token 与缓存命中率变化（**这是决定工具面能否收敛到四件套的依据**）
  - [ ] 依赖: Task 4
  - 说明：本机检查流水线已用**既有**三条通道验证过（对 `kamibuddy-hidden-context` / `kamibuddy-run-time` 能正确报出条数与字符量；对 `kamibuddy-team-output` 当前 0 命中 —— 因为改动落地后还没有团队会话跑过）。这一步需要用户真跑一次团队会话，**不得以任何旁路代替**（AGENTS.md §8）。

# Task Dependencies

- Task 3 depends on Task 1, Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 4
- Task 2 可与 Task 1 并行（无依赖）
