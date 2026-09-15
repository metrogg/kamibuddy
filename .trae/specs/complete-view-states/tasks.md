# Tasks

> **并行度**：Task 1 / 2 / 3 改的文件**互不重叠**，可并行；
> Task 4 与 Task 1 **都碰 `sidebar.tsx` + `App.tsx`**，必须串行在 Task 1 之后；Task 5 收尾。
>
> **基线（本期开始前）**：`npm run check` 通过、`npm test` 95 文件 / 1717 用例全绿、
> `check:tokens` 真违例 0。
>
> **参照标杆（改法照它们来）**：`skills-view.tsx:163-171`（三态互斥 + 重试的标尺）、
> `personalization-section.tsx:376-383`（settings 分区的模板）、
> `experts-view.tsx:112-116`（注释钉死三态顺序）、`connectors-view.tsx:228-248`（四分支严格互斥）。

- [x] Task 1: P1 数据层——侧栏误报 + 专家库死路（`App.tsx` / `sidebar.tsx` / `experts-view.tsx`）
  - [ ] SubTask 1.1: `App.tsx:135` 的 `useState<readonly SessionSummary[]>([])` 改为
    **`undefined` 初值**（与同文件 `experts` 同口径），类型相应调整为 `readonly SessionSummary[] | undefined`；
    检查所有消费点（`sidebar.tsx` 的 `groups`/`groups.tasks`、App 的其它引用）的类型收窄
  - [ ] SubTask 1.2: `App.tsx:207-208` 的 `listSessions().then(setTaskList).catch(() => { })`：
    失败**不再静默**，写入一个与 `expertsError` 同形的 `taskListError` 状态；成功时清空它
  - [ ] SubTask 1.3: `App.tsx:199` 的时序（先 `setLink({ kind: "ready" })` 再拉列表）：
    **核对该顺序是否仍需要**——`sidebar.tsx:487` 现在用 `link.kind === "connecting" ? undefined : groups.tasks`。
    若把"在途"完全交给 `taskList === undefined` 表达，这里的 `link` 判断可以简化；
    **说明你选的口径并保持注释与之一致**
  - [ ] SubTask 1.4: `sidebar.tsx:550-551` 的任务区：改为
    `error ? <ErrorState onRetry> : tasks === undefined ? <LoadingState/> : tasks.length === 0 ? <EmptyState title="暂无历史任务"/> : 列表`。
    重试回调由 App 提供（透传一个 `reloadSessions` 之类的函数）
  - [ ] SubTask 1.5: **专家库重拉入口**（`experts-view.tsx:128` 与 `:234` 两处 `ErrorState` 都无 `onRetry`，
    且全仓 `listExperts` 只在 `App.tsx:208` 调用一次）：
    在 App 侧抽出可重复调用的拉取函数（参照 `App.tsx:210-214` 的 `expertsError` 写法），
    并把重试函数下发给专家页，接上两处 `onRetry`
  - [ ] SubTask 1.6: 验证：`npm run check`（含 `check:tokens`）+ `npm test`；
    报告 1.3 的时序结论、以及类型收窄改动了哪些消费点

- [x] Task 2: P1 页面态——定时任务页 + 产物面板（`automations-view.tsx` / `artifact-panel.tsx`）
  - [ ] SubTask 2.1: `automations-view.tsx:281-284`：把
    `{error !== undefined && <ErrorState/>}` 与 `{tasks === undefined ? <LoadingState/> : ...}` 的
    **并存结构**改为**三态互斥**（照 `skills-view.tsx:163-171`），`ErrorState` 接
    `onRetry={() => void load()}`。
    **并核对页面头部（L266-278）是否需要刷新入口**——若三态互斥后已有重试，头部可不加
  - [ ] SubTask 2.2: `artifact-panel.tsx:697-704` 的文件树扫描：
    `.catch(() => setTree(createLazyTreeState([])))` 改为**记录失败**并渲染错误态 + 重试，
    **不要把失败降级成空树**。注意该处有 `disposed` 守卫（组件已卸载时不 setState），保留它
  - [ ] SubTask 2.3: `artifact-panel.tsx:1070-1072` 的预览占位文案分流：
    `servable`（L895）为假有两因 —— `cwd === undefined`（未选工作空间）与
    `previewBaseUrl === undefined`（服务未就绪/失败）。**按原因给不同文案**，后者带重试
  - [ ] SubTask 2.4: `artifact-panel.tsx:312 / 340 / 397` 三处 `ErrorState`（文本/代码/Markdown 预览失败）
    补 `onRetry`（重跑 `useArtifactText` 的 effect，可用 key/序号 bump）
  - [ ] SubTask 2.5: 验证：`npm run check` + `npm test`；报告 2.2 的失败态怎么表达（state 形状）

- [x] Task 3: settings 8 处分区的三态互斥（`src/renderer/settings/*.tsx`）
  - [ ] SubTask 3.1: 逐处改为 `error ? <ErrorState onRetry/> : data === undefined ? <LoadingState/> : 内容`
    （**模板**：`personalization-section.tsx:376-383`）：
    1. `general-section.tsx:68` + `:70-71`（推理强度）
    2. `general-section.tsx:320` + `:322-323`（默认存储路径）
    3. `general-section.tsx:387` + `:389-390`（权限）
    4. `personalization-section.tsx:87` + `:89-90`（回复风格）
    5. `memory-section.tsx:124` + `:126-127`（记忆开关）
    6. `memory-section.tsx:262` + `:264-265`（长期记忆）
    7. `prompt-section.tsx:141` + `:143-144`（提示词资源）
    8. `settings-view.tsx:135` + `:140-145`（模型页配置）
  - [ ] SubTask 3.2: `models-section.tsx:929` 的 `ErrorState` 补 `onRetry`
    （接 `run(async () => {})` 触发重拉快照）
  - [ ] SubTask 3.3: **重试要真的能重拉**：这些分区各自的加载函数叫什么、怎么调用，逐个确认；
    若某分区**没有可重复调用的加载函数**（只在 `useEffect` 里跑一次），
    报告出来并给出你的处理（抽函数 / 用 state 触发重跑），**不要写一个空壳 onRetry**
  - [ ] SubTask 3.4: 验证：`npm run check` + `npm test`；逐个列出改前/改后

- [x] Task 4: 四处"在途被当空"（**依赖 Task 1**，因同样碰 `sidebar.tsx` + `App.tsx`）
  （**实际范围扩大**：另含两处前序报告发现的新增同型残留 —— `artifact-panel` 空树补 `EmptyState`、
   `general-section` 的 `WebSearchSection` 在途被当作"未配置"；以及 Task 1 报告的两处
   `sidebar` 问题 —— daemon 启动即 down 时的永久「正在读取…」与计数误报 `(0)`）
  - [ ] SubTask 4.1: `sidebar.tsx:576-579` 空间区：现在"在途 / 失败 / 确实没有空间"三态都渲染**空**
    （任务区有 `LoadingState`，空间区没有）。至少补 `connecting` 时的行内加载位；
    失败是否给错误态由你判断（**说明理由**，别为对称而过度设计）
  - [ ] SubTask 4.2: `home-view.tsx:179-193`：`scenes` 初值是 `[]`（`conversation.ts:95-96`
    的 `availableScenes: []`）→ 快照落地前模式页签整行是**空行**。
    改为未就绪时给 `LoadingState` 或骨架，**只在快照落地后判空**
  - [ ] SubTask 4.3: `chat-view.tsx:1164`：`{current?.label ?? currentId}` —— `availableModes`
    未拉回时**回退显示裸 id `craft`**（内部标识暴露给用户）。改为加载占位或等 modes 到位
  - [ ] SubTask 4.4: `plus-menu.tsx:167-186`：专家子菜单拿到的是 `experts={experts ?? []}`
    （调用侧 `App.tsx:1166 / 1190`）→ 在途与"确实没有专家"渲染一致。
    把 `undefined` 语义传下去（或传一个加载标志），子菜单区分两态
  - [ ] SubTask 4.5: 验证：`npm run check` + `npm test`；报告每处的改法与 4.1 的理由

- [ ] Task 5: 校验与文档
  - [ ] SubTask 5.1: `npm run typecheck && npm run check:deps && npm run check:tokens` 三项通过
    （`check:tokens` 真违例必须仍为 0）
  - [ ] SubTask 5.2: `npm test` 全绿（基线 95 文件 / 1717 用例）
  - [ ] SubTask 5.3: 更新 `DESIGN.md` 的状态矩阵（§4）：把本期修掉的 P1/P2 标记为已补齐；
    **登记两处明确豁免**（`office-pptx` 的绝对定位浮层——理由 echarts 在 `display:none` 下量到 0×0；
    `diagnostics-view` 的 `.stat-hint`/`.stat-err` 行内状态——单行读数不适用块级组件）；
    并写明**新增视图必须遵守**本期 spec 的四条硬要求（在途与空分开 / 失败可见可重试 /
    三态互斥 / 失败文案指向真实原因）
  - [ ] SubTask 5.4: 成果文档记本期（承接 `docs/design-tokens-migration.md` 的编号继续）：
    4 处 P1 + 各处 P2 的处置、**未做项与理由**（MCP `needs-auth` 需改契约+产品定口径；
    pptx 浮层与诊断页行内状态为登记豁免；`App.tsx:183` 与 `chat-view.tsx:1377` 的静默 catch
    是源码注释明示的设计意图）
  - [ ] SubTask 5.5: **人工验收清单**（沙箱无 GUI）：① 断网/让 `listSessions` 失败后侧栏是否显示错误态 + 可重试
    （而非「暂无历史任务」）；② 启动瞬间侧栏是否显示加载态（不再闪「暂无历史任务」）；
    ③ 定时任务页首次失败是否只显示错误态 + 重试；④ 专家库失败后能否就地重试（不必重启）；
    ⑤ 未选工作空间 vs 预览服务未就绪，两种提示是否不同
  - [ ] SubTask 5.6: 报告本期**未做**的项与理由，避免被当作遗漏

# Task Dependencies

- **第一轮（可并行）**：Task 1（`App.tsx` + `sidebar.tsx` + `experts-view.tsx`）、
  Task 2（`automations-view.tsx` + `artifact-panel.tsx`）、Task 3（`settings/*.tsx`）
- **第二轮**：Task 4（`sidebar.tsx` + `App.tsx` + `home-view.tsx` + `chat-view.tsx` + `plus-menu.tsx`）
  —— **必须排在 Task 1 之后**（两者都碰 `sidebar.tsx` 与 `App.tsx`）
- **第三轮**：Task 5 依赖 Task 1–4 全部完成
