# Tasks

## 波一 · 基础层（单代理串行，类型→存储有依赖）

- [x] Task 1: 调度模型 + 任务存储（shared/core）
  - [x] 1.1 新增 `src/shared/automation.ts`：AutomationTask/AutomationRun/Schedule 类型 +
    `nextRunAfter(schedule, from): number | undefined` 纯函数（once/interval/daily/weekly，
    本地时区）+ `scheduleSummary(schedule): string`（管理页与工具共用的中文摘要）；
    补 vitest（四类调度的边界：跨日/跨周/月底/过去时刻）
  - [x] 1.2 `src/core/config-paths.ts` 加 `getAutomationsFile()`
  - [x] 1.3 新增 `src/core/automation-store.ts`：读写 automations.json（原子写：
    临时文件+rename）、CRUD、runs 封顶 50 修剪、启动加载；文件不存在=空库，
    JSON 损坏响亮抛错（§7）；补 vitest
  - [x] 1.4 验证：`npm run typecheck && npx vitest run src/shared/automation* src/core/automation*`

## 波二 · daemon 层（依赖 Task 1）

- [x] Task 2: 调度器 + IPC + run 执行
  - [x] 2.1 `src/shared/ipc.ts`：INVOKE 加 automationList/automationSave/automationDelete/
    automationToggle/automationRunNow（payload 类型集中在 InvokeMap）；
    PUSH 加 automationEvent（任务/运行变更通知）
  - [x] 2.2 新增 `src/daemon/automation-scheduler.ts`：30s tick、到期扫描、串行队列
    （FIFO 顺延）、启动恢复（once 过期→missed、周期重算）、手动运行入队；
    队列与到期判定抽纯逻辑便于单测
  - [x] 2.3 run 执行器：以任务 cwd 创建独立会话（复用 SessionHost.create 的装配路径，
    work+craft、当前生效模型；emit 不转发 renderer 会话事件——run 事件只进 run 日志，
    不污染用户当前会话视图）；写 `automation_run` custom 条目（appendCustomEntry）；
    结束写运行记录+更新 nextRunAt/lastRunAt+PUSH；30 分钟超时 abort 记失败
  - [x] 2.4 无人值守权限：run 会话的权限审批自动拒绝（permission-gate 加 unattended
    变体；凭据目录禁读写不变）
  - [x] 2.5 `daemon/index.ts`：五个 IPC handler + 启动时初始化调度器 +
    automationExtensionFactory(store, getCurrentCwd) 注册进会话装配（签名已锁定，
    extensions/automation-tools.ts 当前为最小桩，Task 3 填实）
  - [x] 2.6 验证：`npm run typecheck && npm run check:deps && npx vitest run src/daemon src/core src/shared`

## 波三 · 工具与界面（都依赖波二契约，互不冲突可并行）

- [x] Task 3: automation 三工具 + 提示词
  - [x] 3.1 新增 `src/extensions/automation-tools.ts`：`automationExtensionFactory(store, getCurrentCwd)`
    按波二接口约定导出；注册 automation_create（name/prompt/schedule/可选 cwd 缺省当前
    会话 cwd）/automation_list/automation_delete（id 或名称唯一匹配，歧义返回候选）；
    输入校验（prompt 非空、interval≥1、weekly 至少一个星期）；错误文案给模型可行动信息
  - [x] 3.2 `resources/modes/craft.md`：tools 追加三工具
  - [x] 3.3 `resources/prompts/` 合适位置加 self-contained 段：创建定时任务时 prompt
    必须写全时间/路径/对象（落点：craft.md 正文交付段后 + 工具 promptGuidelines 双处）
  - [x] 3.4 验证：`npm run typecheck && npm run check:deps && npm test`

- [x] Task 4: 管理页 + 侧栏入口 + 通知接线（renderer）
  - [x] 4.1 新增 `src/renderer/automations-view.tsx`：列表（名称/scheduleSummary/下次运行/
    状态徽标）+ 新建·编辑表单弹层（名称/prompt 多行/调度类型与参数/cwd 默认当前）+
    启停/删除（运行中拒删提示）/手动运行 + 行展开运行记录（点击打开会话走既有 resume）
  - [x] 4.2 `sidebar.tsx`：既有「自动化」导航项接入真实入口；`App.tsx` 加视图路由 +
    automationEvent PUSH 接线（刷新列表 + toast）+ run 会话未读（automationEvent 里
    按同口径补标，清除复用既有逻辑）
  - [x] 4.3 `index.css`：管理页与表单样式（复用既有卡片/弹层/徽标变量档位）
  - [x] 4.4 验证：`npm run typecheck && npm run check:deps && npx vitest run src/renderer`

- [x] Task 4.5（追加）: 权限门登记 automation 工具——list 只读放行；create/delete 显式
  medium 询问（不依赖 fail-safe 默认值），permission-policy 补 5 用例 + smoke 10/10

## 收尾

- [x] Task 5: 全量验证 + 文档
  - [x] 5.1 `npm run typecheck && npm run check:deps && npm test` 全绿（764 用例 + smoke 10/10）
  - [x] 5.2 `docs/STATUS.md`：新增专节（自动化核心闭环：存储/调度/工具/管理页/无人值守语义）
    与「等你验证」冒烟项（第 13 项）

# Task Dependencies

- Task 2 依赖 Task 1（类型与存储）；Task 3 依赖 Task 1（store 接口）与波二的工厂签名约定
- Task 2 与 Task 3 可并行：Task 3 只写 extensions/automation-tools.ts + resources，
  不碰 daemon/index.ts（注册由 Task 2 按约定签名接线）
- Task 4 依赖 Task 2 的 IPC 契约（可与 Task 3 并行）
- Task 5 依赖全部前置任务
