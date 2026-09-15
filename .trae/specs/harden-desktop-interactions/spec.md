# 桌面端交互加固 Spec

> **分支**：`feat/ui-design-system`（第 4 期）。第 1 期 token 地基、第 2 期动效纪律、
> 第 3 期性能；本期收掉诊断报告「如果只做 5 件事」的第 5 项——**三条桌面端硬伤**，
> 外加一批键盘可达性的小缺口。

## Why

诊断报告把它们列为「会让人当场骂人、但不是打磨项」的一类。本期侦察后确认三条都真实存在：

1. **模态的 `aria-modal` 是"空声明"**：全仓 **9 处**模态/对话框都写了
   `role="dialog"` / `role="alertdialog"` + `aria-modal="true"`，但**没有任何焦点陷阱与焦点归还**：
   - `permission-dialog.tsx:37-43` 只在打开时把焦点移到「拒绝/允许」，**关闭后不归还**
     （焦点掉回 `<body>`，键盘用户丢失位置）
   - Tab 可以跑到模态**背后**的界面（`aria-modal="true"` 声明了"模态"，行为却不是）
   - 背景没有 `inert` / `aria-hidden` → 读屏软件仍把背景当可用内容
   
   **对我们最要紧的是权限审批弹窗**：它是**阻塞式安全闸**（`permission-dialog.tsx` 头注写明
   daemon 侧可能一直 await 着），语义与行为不符的代价最高。
   涉及的 9 处：`permission-dialog`、`questionnaire-dialog`、`chat-view`（save-space + 另一处）、
   `automations-view`（auto-form）、`connectors-view`（mcp-form / mcp-editor）、
   `experts-view`（ex-modal）、`settings-view`、`models-section`（add-model）。

2. **拖拽越界无防护**：全仓 grep **无** `document` 级 `drop` / `dragover` 监听
   （只有输入卡内部 `composer.tsx` / `image-attachments.tsx` 的局部处理）；
   主进程 `src/main/index.ts` **只有** `setWindowOpenHandler`（:199），**没有** `will-navigate`。
   → 把文件拖到输入卡之外的区域（消息流、首页空白），会走 Chromium 默认行为触发导航，
   而 `will-navigate` 缺席意味着**拦不住**。后果是整页被替换成那个文件/空白页（当前会话视觉上"消失"）。
   **诚实标注：此现象本轮未实测**（需要 GUI 交互），但两个前提（无 drop 拦截、无 will-navigate）
   是 grep 实证的，而补这两道防护是任何 Electron 应用的标准做法，且**无副作用**。

3. **最小宽度横向溢出**：`src/main/index.ts:182` 是 `minWidth: 900`，而布局最小需求是
   侧栏 `216`（`index.css:107`）+ 面板上限 `800`（`artifact-panel.tsx:829` 的 clamp）= **1017 > 900**；
   `.app`（`index.css:96-102`）只有 `position: relative; display: flex; height: 100vh`，
   **没有任何 overflow 控制** → 窗口拉到最小时横向溢出、内容被裁切且无法横向滚动。

## What Changes

- **模态焦点管理统一**：新增共享 hook（`src/renderer/use-modal-focus.ts`），提供三件事——
  ① 打开时把焦点移入模态（可指定首选元素）；② **Tab 焦点陷阱**（在模态内循环，不跑到背后）；
  ③ 关闭时**归还焦点**到打开前的元素。并给模态**背景**加 `inert`（同时解决"读屏当背景可用"）。
  接到全部 9 处模态上。
- **拖拽越界防护**：① renderer 在 `App` 层加 document 级 `dragover` / `drop` 的
  `preventDefault()`（仅对**非输入区**兜底，不干扰输入卡既有的投递逻辑）；
  ② main 加 `will-navigate` 守卫（拦截导航到非本应用 URL，走既有的外部打开通道）。
- **最小宽度不溢出**：`.app` 加 `overflow: hidden`；产物面板的宽度上限从硬编码 `800`
  改为**随窗口可用宽动态 clamp**（不会把内容挤到视口外），保留 `340` 下限与拖拽/键盘同一套 setter。
- **三处键盘可达性小修**（诊断报告的 P2 遗留）：
  ① `chat-view` 的 `.pending-tip` 有 `onFocus`/`onBlur` 但元素不可聚焦（死代码）——
  让它可聚焦或移除死处理；② `artifact-panel` 的 `ViewSwitcher` 菜单无 Esc/外部点击关闭；
  ③ `artifact-panel` 的"双击条目转正 tab"没有键盘等效入口。

**明确不做（附理由）**：

| 事项 | 理由 |
|---|---|
| 右键菜单 | 诊断确认全仓无 `onContextMenu`，但这是**产品需求缺失**而非缺陷；且 WorkBuddy 侧栏用的是「⋯」按钮 + 自绘弹层（我们已同构）。要加需先定需求，不在本期 |
| OS 沙箱 / 危险命令检查器 | 属权限模块（`docs/workbuddy分析/09-sandbox-and-permissions.md` 决策 A 的前置条件），另有 spec |
| 完整虚拟滚动 | 第 3 期已判：牵动吸顶/吸底/折叠/刻度轨四套机制，风险远超收益 |
| 模态的视觉重设计 | 本期只补行为语义，不动任何视觉值 |
| `diagnostics-view` 表格行的键盘可达 | 归第 2 期状态补齐的同类问题（诊断页整体），避免本期范围膨胀 |

## Impact

- Affected specs: 承接第 1 期（token；`:active`/禁用态/Esc 那批已做）、第 2 期（动效）、第 3 期（性能）
- Affected code:
  - `src/renderer/use-modal-focus.ts`（**新建**，共享 hook）
  - 9 处模态组件（接入 hook + 背景 `inert`）
  - `src/renderer/App.tsx`（document 级 drop/dragover 兜底）
  - `src/main/index.ts`（`will-navigate` 守卫）
  - `src/renderer/index.css`（`.app` overflow；`.pending-tip` 可聚焦）
  - `src/renderer/artifact-panel.tsx`（宽度 clamp 动态化；ViewSwitcher Esc；转正的键盘入口）
  - `src/renderer/chat-view.tsx`（`.pending-tip`）
  - **不改** shared / IPC 契约 / daemon-core 业务逻辑 / 任何视觉值

## ADDED Requirements

### Requirement: 模态焦点管理

凡声明 `aria-modal="true"`（或 `role="dialog"` / `role="alertdialog"`）的模态，
SHALL 具备完整的焦点管理：① 打开时焦点移入；② Tab / Shift+Tab 在模态**内部循环**
（SHALL NOT 落到背后界面）；③ 关闭时焦点**归还**给打开它的元素。
同时模态背后 SHALL 用 `inert` 标记，使背景既不可交互也不被读屏访问。

#### Scenario: 键盘不会跑到模态背后

- **WHEN** 权限审批弹窗打开，用户连续按 Tab
- **THEN** 焦点在弹窗内的可聚焦元素之间循环（拒绝 → 允许 → 详情 → 拒绝…），**不出现**背后界面的元素

#### Scenario: 关闭后焦点回到原处

- **WHEN** 用户从某按钮打开设置模态，又用 Esc 关闭
- **THEN** 焦点回到那个打开它的按钮（不是掉到 `<body>`）

#### Scenario: 高风险审批仍默认聚焦拒绝

- **WHEN** 一条 `risk: "high"` 的权限请求到达
- **THEN** 焦点落在「拒绝」（沿用既有安全默认），且上述陷阱/归还同样生效

### Requirement: 拖拽越界不会导航

把文件/链接拖到应用窗口的**非投递区**（消息流、首页空白等）SHALL NOT 触发页面导航或替换。
输入卡既有的投递行为 SHALL 保持不变。

#### Scenario: 拖到空白处无反应

- **WHEN** 把文件拖到消息流区域后松开
- **THEN** 页面不发生导航、不变成文件内容；（输入卡区域仍照旧接收并插入 `@路径`）

#### Scenario: 外部导航被拦住

- **WHEN** 页面试图导航到非本应用 URL
- **THEN** 主进程 `will-navigate` 拦截并改走外部浏览器打开

### Requirement: 最小宽度不溢出

窗口被拖到最小尺寸时，主界面 SHALL NOT 出现横向溢出/内容裁切且无法滚动的情况。
产物面板宽度上限 SHALL 随窗口可用宽动态约束（而非固定 `800`）。

#### Scenario: 拉到最小仍可用

- **WHEN** 把窗口宽度拖到 `minWidth`（900）
- **THEN** 侧栏 + 主区 + 面板都在视口内（面板被压缩而非把主区挤出屏幕）

### Requirement: 三处键盘可达性

① `.pending-tip` 的 `onFocus`/`onBlur` SHALL 与其可聚焦性一致（要么可聚焦、要么移除死处理）；
② `ViewSwitcher` 下拉 SHALL 支持 Esc 与点击外部关闭（与同区其它弹层一致）；
③ 产物条目的"转正为 tab"SHALL 有键盘可达的等效入口。

#### Scenario: 弹层行为一致

- **WHEN** 打开产物面板的视图切换下拉后按 Esc
- **THEN** 下拉关闭（与 `ModelMenu` / `PermissionMenu` 一致）

## MODIFIED Requirements

### Requirement: 权限弹窗的焦点行为

**原**：打开时把焦点移到「拒绝」（高风险）或「允许」，Esc 视为拒绝。

**新**：在保留上述行为的前提下，补充 Tab 焦点陷阱、关闭后焦点归还、背景 `inert`。

## REMOVED Requirements

无。
