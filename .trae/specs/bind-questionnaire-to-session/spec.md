# 问卷会话绑定 + WorkBuddy v3 浮层 Spec

## Why

用户实踩：任务 1 执行中发起问卷，切到任务 2 后——问卷弹层在任务 2 的视图上弹出
（问卷请求没有 sessionId，渲染层只能全局弹），侧栏「待确认」badge 也画在了
当前行（任务 2）而不是归属行（任务 1）。WorkBuddy 的问卷是**绑定会话**的
（浮层替换该会话的输入区；服务端有 SESSION_MISMATCH 错误码），且样式为
「分步答题 v3」内联浮层而非全局模态。

## What Changes

- **契约（BREAKING，同仓库同构建无版本负担）**：`QuestionnaireRequest` 与
  `PermissionRequest` 均增加 `sessionId` 字段；daemon 在接线闭包注入所属桶的
  sessionId（createHost 的 questionnaire / permission-gate 工厂闭包内可得 bucket）。
- **渲染路由**：App 的问卷/审批队列按 sessionId 分派——问卷只在「其 sessionId
  等于当前可见会话」时上屏；后台会话的问卷留队列（驱动 badge），不弹出打断。
  审批弹窗**维持全局模态**（安全闸有意全局阻塞：危险操作不该因切了视图就看不见；
  与 WorkBuddy 的取舍差异落注释），但 badge 同样按 sessionId 归属。
- **问卷 UI 重做：全局模态 → 会话内联浮层**，挂载位置与样式原样对齐 WorkBuddy
  QuestionFloating v3（证据：lib-chat-ui-ChIVprRk.js 242265+ 与
  lib-chat-ui-Co_VI_pZ.css 36658-37130）：
  - **替换输入区**：当前会话有待答问卷时，问卷浮层渲染在 composer 位置、
    composer 不渲染（WorkBuddy CBChat 的 hasQuestionFloating 语义）。
  - **卡片**：width 100%、radius 24px、1px 边框（light #e6e6e6）、
    阴影 `0 6px 16px rgba(0,0,0,.02), 0 1px 4px rgba(0,0,0,.03)`、
    max-height `min(60vh, 520px)`、0.2s ease-out 上滑 8px 淡入。
  - **header**：padding `20px 24px 8px`；标题 = 当前题文本（14px/500/行高 24px）；
    右侧分页器（24×24 按钮 radius 6px、`n/N` 14px min-width 32px 居中）+
    X 整卡跳过（24×24）。
  - **选项行**：高 40px、padding 8px、radius 12px、行间 1px 分隔线（左右各 inset
    12px，light #f2f2f2）；序号块 24×24 radius 8px 底 #f2f2f2，hover/选中行底
    #f2f2f2 且序号块反白 #fff；行尾右箭头 16px hover/选中淡入；文字 14px/22px
    单行省略。
  - **「其他补充…」行**：同结构，左 24×24 radius 7px 铅笔图标块 + 无边框透明
    input（placeholder 其他补充…）；输入与选项互斥，回车确认（IME 守卫）。
  - **footer**：padding `12px 20px 20px`、min-height 52px；「跳过」胶囊（32px 高、
    radius 24px、底 #f2f2f2、14px/500）；前进/发送 32×32 圆形按钮（激活底
    rgba(0,0,0,.85) 白图标，禁用底 #f2f2f2 淡色；末题发送图标与主输入框同款）。
  - **文本五档**（light）：primary rgba(0,0,0,.9) / secondary .7 / muted .5 /
    faint .3 / divider rgba(0,0,0,.08)。
  - **交互**：单选点选项 120ms 自动前进、末题点选即提交（防重复提交）；逐题跳过
    （末题=空答提交）；X 整卡跳过；分页器自由翻页改答。
- **Badge 按会话归属**：`pendingConfirm: boolean` → 按 sessionId 的集合；
  侧栏「待确认」badge 画在**请求归属的会话行**（可同时多行）。
- **切走不丢**：后台会话的问卷答案在 daemon 侧本来就是 id 键控（不变）；
  切回归属会话，浮层按队列原样呈现。

**明确不做**：审批弹窗内联化（维持全局模态，另议）；WorkBuddy 的多选题
（multiSelect——我方工具契约是单选）；「其他」行的多选 checkbox 形态；
sendPrompt 追问；问题已答摘要卡（QuestionAnswerDisplay，挂用户消息上方那张，
另开 spec 评估）。

## Impact

- Affected specs: C7（对齐清单 提问行）；关联 support-concurrent-tasks（多会话路由）
- Affected code: `shared/ipc.ts`（两 Request 契约）、`daemon/index.ts`（接线注入）、
  `renderer/App.tsx`（按会话分派 + badge 集合）、`renderer/chat-view.tsx`（内联浮层
  挂载替换 composer）、`renderer/questionnaire-dialog.tsx`（重写为内联浮层）、
  `renderer/sidebar.tsx`（badge 按行）、`renderer/index.css`（v3 样式真值）

## ADDED Requirements

### Requirement: 问卷按会话路由

The system SHALL 给每个问卷请求标注来源 sessionId（daemon 注入），渲染层只在
用户查看该会话时显示问卷浮层；查看其他会话时不弹出、不打断，请求保留在队列中。

#### Scenario: 后台会话的问卷不串台

- **WHEN** 任务 1 的 run 发起问卷，用户切到任务 2
- **THEN** 任务 2 的视图不弹出问卷；侧栏任务 1 行显示「待确认」badge（任务 2 无）；
  切回任务 1 时问卷浮层在其对话页内联呈现，可正常作答，作答后 run 继续

#### Scenario: 同会话多请求排队

- **WHEN** 同一会话连续发起两次问卷（或审批与问卷同时 pending）
- **THEN** 审批优先于问卷呈现（既有口径），同类型按到达顺序逐张处理

### Requirement: WorkBuddy v3 内联浮层

The system SHALL 把问卷 UI 从全局模态改为对话页输入区位置的内联浮层（有待答问卷时
替换 composer），视觉与交互逐项对齐 WorkBuddy QuestionFloating v3 的样式真值
（spec「What Changes」的数值清单）与交互（分页器、120ms 自动前进、末题即提交、
两级跳过、「其他补充…」自由输入）。

#### Scenario: 逐题作答

- **WHEN** 用户查看归属会话，问卷浮层显示第 1/N 题
- **THEN** 点选项 120ms 后自动进下一题；最后一题点选项立即提交；分页器可回翻改答；
  点「跳过」跳过本题（末题=以未答提交）；点 X 整卡跳过

#### Scenario: 浮层激活时输入区让位

- **WHEN** 当前会话有待答问卷
- **THEN** composer 不渲染，问卷浮层占据其位置；问卷答完/跳过后 composer 恢复
