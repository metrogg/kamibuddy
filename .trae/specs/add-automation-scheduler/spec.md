# 定时任务自动化（核心闭环）Spec

## Why

对齐 WorkBuddy 桌面层「自动化」（调研结论：持久任务 + rrule 调度 + 每次运行一条新会话 +
未读 inbox + 对话内 automation_update 工具）。KamiBuddy 目前没有任何定时任务能力——
办公场景（行政/产品/销售）的核心诉求之一正是「每天 9 点生成日报」这类无人值守任务。
用户已确认 v1 范围：**核心闭环 + 对话内 automation 工具**（AI 自主调整下轮不进 v1）。

## What Changes

1. **持久任务存储**：`~/.kamibuddy/automations.json`（原子写），任务含
   名称/prompt/调度/执行 cwd/状态/下次与上次运行时间/运行记录（封顶修剪）。
   调度类型 v1 四种：`once`（指定时刻）/ `interval`（每 N 分钟，最小 1）/
   `daily`（每日 HH:mm）/ `weekly`（每周 HH:mm + 星期集合）。
   **不引 rrule 库**：UI 与工具只暴露这四种，下次运行时间为 ~40 行可测纯函数；
   月度/复杂规则确有需要时再引 rrule.js（YAGNI）。
2. **daemon 调度器**：30s tick 扫到期任务 → **串行队列**执行（一次一个 run，
   同期到期的顺延 FIFO）；每次运行 = 一条**全新独立会话**（cwd=任务的工作空间，
   固定 work 场景 + craft 模式 + 当前生效模型），完成后写运行记录并推送 renderer。
   无人值守语义：run 中权限询问**一律自动拒绝**并把原因返回给模型（凭据目录
   禁读写不变）；run 超时 30 分钟 abort 记失败；应用关闭期间错过的任务**不补跑**
   （once 过期标 missed；周期任务重算下一次）。
3. **对话内 automation 工具**：`automation_create / automation_list / automation_delete`
   三个工具（craft 模式白名单），模型可在对话中建/查/删任务；提示词加
   **self-contained 约束**（对齐 WorkBuddy `<automations>` 段：任务 prompt 必须把
   时间/路径/对象写全，未来运行看不到当前对话）。
4. **管理界面（从简）**：侧栏加「定时任务」入口 → 管理页：任务列表
   （名称/调度摘要/下次运行/状态）+ 新建·编辑表单弹层（名称/prompt/调度/cwd）+
   启停/删除/手动运行；任务行展开最近运行记录（时间/成败/点击打开对应会话）。
   run 完成时 toast 通知 + 运行会话在侧栏带未读标记（复用现有未读机制）。
5. **运行可溯源**：run 会话文件写入 `automation_run` custom 条目（taskId），
   会话列表/导出链路天然可追。

**明确不做**（v1 之外）：AI 自主调整下轮间隔、jitter（单用户无防拥堵需求）、
rrule 月度/复杂规则、执行级独立配置（任务级模型/技能/权限档——v1 跟随当前生效值）、
系统托盘通知、企业微信推送、并发多 run。

## Impact

- Affected specs：无前置依赖；与现有「会话管理」「侧栏任务×空间」衔接（run 会话
  落入任务工作空间的分组）
- Affected code：
  - `src/shared/automation.ts`（新增：类型 + 下次运行计算纯函数）+ 测试
  - `src/shared/ipc.ts`（新通道：automationList/Save/Delete/Toggle/RunNow +
    PUSH automationEvent；类型集中此处——AGENTS.md §4）
  - `src/core/config-paths.ts`（automations.json 路径）
  - `src/core/automation-store.ts`（新增：JSON 读写 + 原子写 + 记录修剪）+ 测试
  - `src/daemon/automation-scheduler.ts`（新增：tick/串行队列/run 执行）
  - `src/daemon/index.ts`（IPC handlers、启动恢复调度、push）
  - `src/extensions/automation-tools.ts`（新增：三工具注册）
  - `resources/modes/craft.md`（白名单加三工具）、`resources/prompts/`（self-contained 段）
  - `src/renderer/automations-view.tsx`（新增管理页）、`sidebar.tsx`、`App.tsx`、
    `index.css`、`shared/session-events.ts`（如 push 事件类型需要）

## ADDED Requirements

### Requirement: 任务存储与调度模型

系统 SHALL 将定时任务持久化到 `~/.kamibuddy/automations.json`（原子写，损坏时响亮报错
不静默吞）。任务字段：id/name/prompt/schedule/status(active|paused|missed)/cwd/
nextRunAt/lastRunAt/runs(封顶 50 条修剪)/createdAt/updatedAt。
系统 SHALL 以纯函数 `nextRunAfter(schedule, from)` 计算下次运行时间
（本地时区；interval 自 validFrom/lastRun 起算；weekly 按星期集合找下一个 HH:mm）。

#### Scenario: 调度计算
- **WHEN** 任务为 `weekly { time: "09:00", weekdays: [1,2,3,4,5] }`，当前为周五 10:00
- **THEN** 下次运行时间为下周一 09:00（本地）

### Requirement: daemon 调度执行

系统 SHALL 在 daemon 内运行调度器：30s tick 检查到期 active 任务，串行执行
（一个 run 进行中时其余顺延）。每次运行 SHALL 创建独立新会话（cwd=任务 cwd，
work+craft、当前生效模型），以任务 prompt 发起；会话文件写 `automation_run` custom
条目（taskId）。run 结束写运行记录（sessionId/成败/时间）、更新 lastRunAt 与
nextRunAt，并 PUSH 通知 renderer。run 中权限询问 SHALL 自动拒绝并把拒绝原因作为
工具结果返回模型；run 超过 30 分钟 SHALL abort 并记失败。应用启动时 SHALL 恢复调度：
过期的 once 任务标 `missed`（不补跑），周期任务按当前时间重算 nextRunAt。

#### Scenario: 到期执行
- **WHEN** 一个 active 的 daily 任务到点
- **THEN** daemon 以任务 cwd 开新会话执行 prompt，完成后管理页可见运行记录，
  侧栏该工作空间下出现对应会话（未读），toast 提示完成

#### Scenario: 无人值守权限
- **WHEN** run 中模型请求一个需要审批的区外写操作
- **THEN** 该操作被自动拒绝，工具结果说明「无人值守运行，审批类操作不可用」，
  模型可绕行或在结果中如实报告

### Requirement: 对话内 automation 工具

系统 SHALL 在 craft 模式工具白名单中加入 `automation_create`（name/prompt/schedule/
可选 cwd）/`automation_list` / `automation_delete`（id 或名称匹配）。
craft 模式提示词 SHALL 新增 self-contained 约束段（自创文案）：创建任务时 prompt
必须写全时间、路径、对象——未来运行看不到当前对话。

#### Scenario: 对话建任务
- **WHEN** 用户说「每个工作日早上 9 点帮我汇总昨天的 git 提交」
- **THEN** 模型调用 automation_create（weekly，cwd 取当前工作空间，prompt 自包含），
  回复中说明实际生效的调度

### Requirement: 管理页

系统 SHALL 提供侧栏「定时任务」入口与管理页：列表显示名称/调度摘要/下次运行/状态；
新建与编辑共用表单弹层（名称、prompt 多行、调度类型及参数、cwd 默认当前工作空间）；
每行支持启停切换、删除（执行中的 run 不阻塞删除，但正在运行的任务拒绝删除并提示）、
手动运行（走同一串行队列）；任务行展开显示最近运行记录，点击记录打开对应会话。

#### Scenario: 手动运行
- **WHEN** 用户在管理页点某任务的「立即运行」
- **THEN** 该任务进入串行队列执行一次（不影响其既有 nextRunAt 的周期语义）

## MODIFIED Requirements

### Requirement: craft 模式工具白名单

**原**：`[read, read_document, write, edit, find, grep, ls, web_search, web_fetch, present_files]`。
**新**：追加 `automation_create, automation_list, automation_delete`（ask/plan 只读模式不加）。

## REMOVED Requirements

无。
