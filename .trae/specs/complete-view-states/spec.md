# 视图状态覆盖补齐 Spec

> **分支**：`feat/ui-design-system`（第 5 期，收尾）。第 1 期建了 `state-views.tsx` 并修了 5 处
> 「加载与空混淆」，但**只覆盖了当时发现的**。本轮逐页盘点 12 个主界面 × 7 态（空/加载/部分加载/
> 成功/失败/禁用/权限不足）后，仍有残留。

## Why

盘点结论：**共享组件与禁用态已成体系**（`state-views.tsx` 是唯一出口、`index.css:7805-7846`
系统补齐了 18 类禁用态、旧 13 套空态类名已全部移除），**但有 4 处 P1 级残留**——
用户会**看到错误信息**，或**失败后没有任何恢复路径**：

1. **侧栏永远误报「暂无历史任务」**（`App.tsx:135` + `:207-208` + `sidebar.tsx:487,550-551`）
   `taskList` 初值是 `[]`（不是 `undefined`），且 `App.tsx:199` 先置 `link = ready`、
   `:207` 才去 `listSessions()`，`:208` 又是 `.catch(() => { })` 静默吞。
   → ready 之后、列表返回之前这段窗口判 `length === 0` → **渲染空态**；失败则**永久**误报，
   无错误分支、无重试。第 1 期修的是 `connecting` 窗口（`sidebar.tsx:478-486` 注释自述），
   **ready 之后在途的窗口没覆盖**——同一缺陷的残留。
2. **定时任务页失败后零出口**（`automations-view.tsx:281-284`）
   `{error !== undefined && <ErrorState/>}` 与 `tasks === undefined ? <LoadingState/>` **并存**，
   且页面头部只有「返回 / 新建任务」、**没有刷新按钮** → 错误条 + 「正在读取…」永久同框，
   用户只能重启。与第 1 期修掉的 `skills-view` 完全同型。
3. **专家页失败即死**（`experts-view.tsx:128,234`）
   两处 `ErrorState` 都无 `onRetry`，且全仓 `listExperts` **只有 App.tsx:208 一处调用**、
   App 不暴露任何重拉入口 → 失败后只能重启应用。
4. **工作空间文件视图扫描失败被伪装成「空目录」**（`artifact-panel.tsx:697-704`）
   `.catch(() => { setTree(createLazyTreeState([])) })` —— 失败静默降级成空树，
   渲染出无任何条目的 `.file-tree`（连 `EmptyState` 都没有），无重试。

另有若干 P2：**预览服务失败时给了错误的指引文案**（`artifact-panel.tsx:1070-1072` 把
"未选工作空间"与"服务未就绪"混成一句）、**settings 8 处分区**错误条与 `LoadingState` 并存且无重试、
以及 4 处在途瞬态被当作空（首页页签空行、对话页回退显示裸 id `craft`、`+` 菜单专家子菜单、
空间区无加载表达）。

## What Changes

- **P1 四项**：侧栏与专家库的数据在途/失败区分（初值改 `undefined` + 错误态 + 重试）、
  定时任务页三态互斥 + 重试、文件视图扫描失败改走错误态。
- **P2 文案与三态**：预览失败的指引文案按原因分流；settings 8 处分区统一为
  `error ? ErrorState(onRetry) : data === undefined ? LoadingState : 内容`。
- **P2 瞬态**：四处"空数组当空"改为"未就绪走加载态"。
- **豁免登记**：把两处**有正当理由的偏离**写进 `DESIGN.md`，避免后人误判为违规（见下表）。

**明确不做（附理由）**：

| 事项 | 理由 |
|---|---|
| MCP `needs-auth` 态（`connectors-view.tsx:276-281` + `shared/ipc.ts:664`） | 结构上确实把"需授权"与"连接失败"混成 `failed`（用户对 401 与"配置写错"得到同一句话，处置动作完全不同）。但**要改 IPC 契约 + 产品需先定口径**，且是否命中取决于用户接入的 server 类型（stdio 本地 server 一般不触发）。**另立 spec** |
| `office-pptx.tsx:79-80` 自建加载/错误浮层 | **有正当理由**：echarts canvas 在 `display:none` 下会量到 0×0 画空白，必须用绝对定位浮层（源码 L75-76 注释）。→ 记入 `DESIGN.md` 豁免 |
| `diagnostics-view.tsx:697-706,740-755` 的 `.stat-hint`/`.stat-err` 行内状态 | 是**行内单行读数**，不适合块级 `LoadingState`。→ 记入 `DESIGN.md` 豁免（不给 `state-views` 加 inline 变体，避免为两处做抽象） |
| `App.tsx:183` 空间元数据静默 catch、`chat-view.tsx:1377` 个性化静默 catch | 源码注释明示为**设计意图**（前者回退 basename 后列表仍可用、后者是增强项不该拖垮等待行），不属缺陷 |
| 旧空态类名清理 | 已全部移除（`index.css:5832 / 6412` 注释佐证），无事可做 |
| 禁用态补齐 | 已系统完成（18 类），无事可做 |

## Impact

- Affected specs: 承接第 1 期（`apply-design-tokens-foundation`，含其顺带修的 5 处状态 bug）；
  与之配套的 `DESIGN.md` §4 状态矩阵从"缺口清单"更新为"已补齐 + 豁免登记"
- Affected code:
  - `src/renderer/App.tsx`（`taskList` 初值与错误态、`experts` 重拉入口）
  - `src/renderer/sidebar.tsx`（任务区判定 + 错误分支 + 空间区加载态）
  - `src/renderer/experts-view.tsx`（两处 `onRetry`）
  - `src/renderer/automations-view.tsx`（三态互斥 + 重试）
  - `src/renderer/artifact-panel.tsx`（文件树错误态、预览文案分流、文本预览重试）
  - `src/renderer/settings/*.tsx`（8 处分区三态互斥）
  - `src/renderer/home-view.tsx`、`chat-view.tsx`、`plus-menu.tsx`（瞬态加载态）
  - **不改** `shared/ipc.ts` 契约、daemon/core 逻辑、任何视觉值

## ADDED Requirements

### Requirement: 在途与空必须分开

数据源在**在途**状态 SHALL 用 `undefined` 表达（初值不得预置 `[]` / `{}`），
视图 SHALL 据此渲染加载态；**只有数据真正到达且为空**时才渲染空态。
SHALL NOT 用"长度为零"同时表达"还没到"与"确实没有"。

#### Scenario: 侧栏不再误报

- **WHEN** 应用启动、会话列表尚未返回
- **THEN** 侧栏显示加载态（而非「暂无历史任务」）
- **WHEN** 会话列表返回且确实为空
- **THEN** 才显示「暂无历史任务」

### Requirement: 失败必须就地可见且可重试

视图内的数据拉取失败 SHALL 渲染错误态并**提供重试入口**。
SHALL NOT：静默 `catch` 吞掉失败；把失败降级成空数据（空数组/空树）伪装成"没有内容"；
在错误态之外**并行**保留加载态导致两者永久同框。

#### Scenario: 定时任务页失败可恢复

- **WHEN** 初次 `listAutomations()` 失败
- **THEN** 显示错误态 + 重试按钮（不再是"错误条 + 正在读取…"永久并存）

#### Scenario: 文件视图失败不被伪装成空目录

- **WHEN** 工作空间文件扫描失败
- **THEN** 显示错误态 + 重试（而非一个没有任何条目的空树）

#### Scenario: 专家库失败可恢复

- **WHEN** 专家库拉取失败
- **THEN** 错误态带重试入口（不再需要重启应用）

### Requirement: 三态分支互斥

同一视图内 `error` / `loading` / `empty` / `content` 四个分支 SHALL 严格互斥
（参照已做对的 `skills-view.tsx:163-171` 与 `personalization-section.tsx:376-383`）。

#### Scenario: settings 分区不再"错误 + 加载"并排

- **WHEN** 某个设置分区初次拉取失败
- **THEN** 只渲染错误态（含重试），不叠加「正在读取…」

### Requirement: 失败态文案必须指向真实原因

预览/加载类失败 SHALL 区分**不同原因**并给出对应指引。
SHALL NOT 用一句话覆盖多个互斥原因。

#### Scenario: 预览失败的两种原因分开说

- **WHEN** 用户未选工作空间
- **THEN** 提示「选择工作空间后可预览文件」
- **WHEN** 工作空间已选但预览服务未就绪/失败
- **THEN** 提示「预览服务未就绪」并给重试（**不得**仍说"请选择工作空间"）

## MODIFIED Requirements

### Requirement: DESIGN.md 的状态矩阵

**原**：§4 的状态矩阵是**缺口清单**（12 个组件 × 7 态，标注缺哪个）。

**新**：更新为**已补齐 + 豁免登记**——P1/P2 项标记为已修；
把两处有正当理由的偏离（pptx 浮层、诊断页行内状态）登记为明确豁免，
并写明"新增视图必须遵守本文三条硬要求"。

## REMOVED Requirements

无。
