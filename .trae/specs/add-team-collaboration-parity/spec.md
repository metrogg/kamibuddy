# 团队协作能力对齐 WorkBuddy（add-team-collaboration-parity）Spec

> 与 `add-team-foundations`（地基：信箱/注册表/成员执行器/四件套）配套。这份补的是
> **协作语义**上的七项欠账，逐项对照 `docs/workbuddy分析/12-expert-teams.md`。
> 实施顺序即批次顺序，一批复一批，每批自带验证。

## Why

`add-team-foundations` 之后，团队能力在「建团 / 并行执行 / 回投 / 可见性」上已对齐；
剩下七项语义缺口（`spec.md` 旧差距清单的 P1/P2）会让团队在**长任务与多人并行**下露怯：

| # | 缺口 | 现在会怎样 |
|---|---|---|
| ① | 共享任务列表 | 协调全靠消息；主理人只能「一次把活分完」，中途发现要加活只能 team_send，没有可认领/可追溯的任务面 |
| ② | 单成员优雅关闭 | 只能整队 `team_delete`；想收掉一个跑偏的成员，代价是全队中止 |
| ③ | 委派模式 | 主理人自己下场干活，用户无法强制它只协调 |
| ④ | plan 审批 | 成员一上来就动手；跑偏的代价是一整轮产出 |
| ⑤ | 团队与信箱落盘 | 重启/崩溃后队伍与信箱全丢（WorkBuddy 落 `~/.codebuddy/teams/`） |
| ⑥ | 成员级模型选择 | 全员继承领导模型；「调研用便宜模型」做不到 |
| ⑦ | 成员权限请求带归属标注 | 成员的审批卡混进主对话，用户不知道是谁在请求 |

## What Changes（按批次，逐条对齐 WorkBuddy 语义）

### 批次 ①：共享任务列表

- 新增 `src/daemon/team-tasks.ts`（纯逻辑，可单测）：按领导 sessionId 挂一张任务板。
  任务字段：`id` / `title` / `detail` / `owner`（成员名，可空）/ `blockedBy`（依赖 id）/
  `status` / `result` / 时间戳。状态机：`pending`（待办）→ `ready`（依赖已满足）→
  `in_progress` → `completed` / `cancelled`。
- **自动解锁**：任一任务 complete 后，把 `blockedBy` 全部完成的 pending 任务翻成 ready
  （对齐 WorkBuddy「上游完成自动解锁下游」）。
- 建任务时校验：依赖 id 必须存在、不能自依赖、**不能成环**（拓扑校验，环即抛错）。
- 新增 `src/extensions/team-task-tools.ts`（工厂 + 注入 deps，同 team-tools 取向）：
  `team_task_create`（批量建，可带 owner 与 blockedBy）、`team_task_update`（改状态 /
  写结果 / 改 owner）、`team_task_list`（给模型看的状态快照，含依赖与 owner）。
- 不变量：任务板与 `todo_write` **完全无关**（后者是消息流投影，前者是团队协调状态）。
- 明确不做（本批）：成员侧认领工具（见否决方案）、任务面板 UI（消息里的
  `team_task_list` 输出已覆盖协调需求，UI 随批次 ⑦ 一起评估）。

### 批次 ②：单成员优雅关闭

- 对齐 WorkBuddy `shutdown_request` / `shutdown_response`：新增工具
  `team_shutdown { to, reason? }` —— 向指定成员投「请收尾」消息（不是 abort）：
  成员把当前工作收口成报告回投后自然结束，注册表状态翻 `closed`。
- 与 `team_delete` 的差异写进工具描述：`team_shutdown` 单成员、保留其余成员与团队；
  `team_delete` 整队中止。
- 兜底：成员若在 N 轮内未收尾，提供 `team_shutdown { force: true }` 走 abort 路径。
- 成员状态机加 `closing`（已发收尾请求、等回投）。

### 批次 ③：委派模式

- 会话级开关（工具 `team_delegate_mode { enabled }` 或偏好，二选一按实施时定）：
  开启后领导工具面收窄为协调类（`team_*`、`team_task_*`、`questionnaire`、只读查询），
  去掉 write / edit / powershell / task 等执行类——**领导只协调不干活**。
- 依赖现有的专家 extraTools / 工具面重应用链路（`session-host` 的 effectiveToolNames）。
- 关闭即恢复原工具面；成员不受影响。

### 批次 ④：成员 plan 审批

- 成员侧新增工具 `plan_submit { plan }`：成员接到任务后**先交计划**，等领导裁决。
- 领导侧新增工具 `team_plan_review { member, decision: approve|reject, feedback? }`：
  批准 → 成员按计划开工；驳回 → 成员按 feedback 改计划重交。
- 成员状态机加 `awaiting_plan` / `revising`；注册表记录计划摘要供 `team_status` 展示。
- 缺省行为不变：成员若不走 plan_submit 直接干活，仍按现状（不强制）。

### 批次 ⑤：团队与信箱落盘

- 落盘布局对齐 WorkBuddy：`<configDir>/teams/<team-name>/{config.json, inboxes/<member>.json}`
  （`getConfigDir()` 即 `~/.kamibuddy`）。
- 写入时机：建团 / 成员状态变化 / 任务板变化 / 信箱投递与消费；解散时清目录。
- 重启恢复：daemon 启动时扫描 `teams/`，把团队与任务板恢复进注册表；
  **成员会话本身不可恢复**（WorkBuddy 自认无恢复：`/resume` 不恢复成员），
  恢复后成员状态标 `closed` 并在 `team_status` 里注明「进程重启后成员需重建」。
- 信箱落盘：未消费消息重启后仍可投递（这是「重启存活」的实际价值）。

### 批次 ⑥：成员级模型选择

- `team_create` 的 `members[]` 加可选 `model`（`providerId/modelId`）：
  解析优先级 = 成员显式指定 → agent 定义的 `model` → 领导当前模型（现状）。
- 模型不可用时**响亮报错**（不静默回落，同 agents.ts 的既有立场）。
- `member-runner` 的 `spawnMember` 接受 modelKey 覆盖；`team_status` 显示成员模型。

### 批次 ⑦：成员权限请求带归属标注

- 成员触发的权限请求，在 UI 上标注「来自成员〈花名〉」（对齐 WorkBuddy 的
  `team-member-intercept-card`，三选 `allow_once` / `allow_session` / `deny`）。
- 数据侧：`PermissionRequest` 已有 `sessionId`；补成员归属（成员名 + 团队名），
  由 daemon 在转发审批时注入。
- UI 侧：审批卡显示成员标注；若当前不在该成员视图，提供「查看成员」入口。

**本 spec 明确不做**：嵌套团队、团队转让领导、成员钩子事件、常驻状态栏
（WorkBuddy 自认实验特性；这几项在 §8 之外且收益低）。

## 否决方案

- **成员侧任务认领工具（`team_task_claim`）**：否（批次 ① 内）。
  ①本运行的派活方式是「建团时明确分工 + team_send 追加」，成员看到的就是自包含任务，
  没有「在池子里找活」的需求面；②成员改团队状态需要把任务板注入成员的扩展装配，
  而成员的工具面是深度锁的既定决策（成员不许再委派/建团），扩口子要单独评估；
  ③成员误标「完成」的代价比主理人多点一次高。留作有真实需求时再开。
- **任务板 UI 面板（对齐 WorkBuddy Ctrl+T）**：否（批次 ①）。协调信息的主要消费者是
  **模型**（它要据此决定下一步派谁），对话里的 `team_task_list` 输出已满足；
  先做 UI 会把批次 ① 从「状态 + 工具」变成「状态 + 工具 + 前端 + 样式」四件套。
- **用现成的 `todo_write` 承载共享任务**：否。todo 是**消息流投影**（全量替换、
  不落独立存储、无 owner/依赖），改成团队任务会把主会话的待办语义污染掉
  （单会话私人清单 vs 团队共享契约），且历史回放口径会变。
- **批次 ② 用 abort 直接杀单个成员**：否。abort 会丢掉成员这一轮的产出——
  优雅关闭的全部价值就是「把它手上的东西交出来再走」。force 只作兜底。
- **批次 ③ 用偏好（设置页开关）而不是工具**：否（本批）。委派模式是**按任务**的策略
  （这个任务我想让它只协调），不是一次性配置；做进偏好要用户来回切设置页。
- **批次 ④ 强制所有成员先交计划**：否。小任务交计划纯属多一轮往返、多一份 token；
  作为**可选**工具由主理人在任务说明里要求。
- **批次 ⑤ 连成员会话一起恢复**：否。pi 的会话可以重建，但成员是「长会话 + 独立上下文」，
  重建后它与领导的协作契约（已分派的活、信箱里的话）无法完整复原，
  假装恢复比诚实报「成员需重建」更糟（WorkBuddy 也不恢复）。
- **批次 ⑥ 自动给角色配便宜模型**：否。模型可用性取决于用户配了哪些 Key，
  静默兜底会让「调研用便宜模型」悄悄变成主模型费率（agents.ts 已有同款立场）。

## Impact

- 新增：`src/daemon/team-tasks.ts`、`src/extensions/team-task-tools.ts`、
  `src/daemon/team-store.ts`（批次 ⑤）、`src/extensions/team-delegate.ts`（批次 ③，或并入 team-tools）
- 改动：`src/daemon/team-runtime.ts`（成员状态机加 closing/awaiting_plan/revising）、
  `src/daemon/member-runner.ts`（modelKey 覆盖、收尾语义）、
  `src/extensions/team-tools.ts`（新增 team_shutdown / team_plan_review / model 参数）、
  `src/daemon/index.ts`（接线）、`src/shared/ipc.ts`（权限归属字段）、
  `src/renderer/*`（审批卡标注，批次 ⑦）、`resources/modes/craft.md`（新工具白名单）
- 不改：信箱原语语义、child-agents 投影契约、todo 契约

## 验证

每批：`npm run typecheck` + `npm run check:deps` + `npm run check:tokens` +
`npm run check:model-experience` + `npm run check:invariants` + `npm run check:expert-assets` +
`npm test`；新增护栏（依赖环校验、落盘往返）先人为破坏确认变红。

## 实施修订（2026-09-18，七批全部落地时补记）

> 原则同上：**不改已冻结的结论**，只补实施中发现的事实与设计修订。

1. **批次 ④ 不建成员侧 `plan_submit` 工具**（原 What Changes 写有）。
   理由：WorkBuddy 的成员在会话内**阻塞等批**，所以需要一个「提交并等待」的消息类型；
   我们的成员是 fire-and-forget 长会话 —— 交完一轮就 idle，**不存在「阻塞等批」这个状态**。
   它这一轮的产出（自动回投）天然就是计划提交物，领导的批准/驳回经 `team_send` 唤醒即可。
   于是批次 ④ 的交付面 = 领导侧 `team_plan_review` + 注册表的裁决状态 + 自动通知，
   比原计划少一个工具、多一层「不假装有同步等待」的诚实。
2. **批次 ⑤ 不落盘信箱**（原 What Changes 写有）。
   理由见 `src/core/team-store.ts` 文件头：成员宿主不可恢复，重启后成员 sessionId 全变，
   落盘的消息**没有可达的收件人**；而成员产出已经作为消息进了领导会话的 JSONL，
   那份本来就落盘。信箱只是投递途中的暂存，再落一份是冗余且会过期。
   本批实际落盘的是**团队结构与任务板**，成员一律按「需重建」恢复。
3. **批次 ①②③④⑥ 的工具全部并入 `team-tools.ts`**，最终是**七件套**：
   team_create / team_send / team_status / team_shutdown / team_plan_review /
   team_delegate_mode / team_delete；任务板三件套独立在 `team-task-tools.ts`。
4. **新增模块的落点**：`core/team-tasks.ts`（任务板纯逻辑）、`core/team-store.ts`（落盘）。
   都放 core 而非 daemon —— extensions 的工具要 import 它们的类型，而
   「extensions 不许 import daemon」由 `check:deps` 机械校验（实施中真的拦下过一次）。
