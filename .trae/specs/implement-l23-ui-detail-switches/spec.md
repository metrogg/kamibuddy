# L23 界面细节开关跟进 Spec

## Why

对齐清单 L23「界面细节开关」列了 WorkBuddy 的 4 个开关。逐项调研 5.5.4 解包源码后
（证据：`%TEMP%\wb-asar-554\`，app.asar 5.5.4 解包）结论是拆开的：

| 开关 | 调研结论 | 决策 |
|---|---|---|
| FloatShortcut | IDE 插件遗产，桌面端 main/renderer **零消费的死开关**（`main/common.js:1247` 枚举注释「悬浮快捷键和菜单功能」，全树无 `useProductFeature(ProductFeature.FloatShortcut)` 消费点）。但它旁边有一套独立的真功能：全局唤起热键 | 开关不抄；**全局热键做** |
| EnableUserMessageTopAlignment | 5.5.4 已**去开关化**，固化为 cb-chat-ui 默认行为（`lib-chat-ui:191214` `?? true`）：发送瞬间把用户消息组 `scrollToIndex align:"start"`（问题吸顶，答案在下方展开），streaming 吸底跟随（`useStreamingStick` + `followOutput`），无设置项 | **复刻为默认行为** |
| DisableSlotSystem | 服务端运营位框架（`POST /operation-platform/slots/active-batch` 下发 HTML 模板进 5 个 Shadow DOM 槽位）。我们没有运营平台 | ⛔ 不移植 |
| QueueBanner | 云端模型容量排队协议（6020/6021/6022 错误码 + `queueGetStatus` 轮询 + 取消/切 Auto 重发/升级三动作，`useQueueBannerCore` 状态机）。我们无云端容量后端 | ⛔ 不移植（状态机设计已留档本 spec） |

两个要做的项互不依赖，但同属「L23 跟进」一个变更。

## What Changes

- **全局唤起热键**：main 进程注册 `Shift+Alt+W`，按下时——窗口可见且聚焦 → 最小化；
  否则 → 还原并聚焦（WorkBuddy `GlobalToggleShortcutController`，
  `main/index.js:24812/24848-24931` 的同款机制；我们无托盘，「最小化」比「隐藏」安全——
  隐藏后无托盘入口找回）。注册失败（热键被别的程序占用）不炸启动，记事件日志 +
  诊断页可见。`will-quit` 时 `globalShortcut.unregisterAll()`。
- **发送时消息吸顶**：用户在对话页发出消息后，消息列表滚动到「这条用户消息」位于
  视口顶部（Claude.ai / ChatGPT / WorkBuddy 同款「问题吸顶」）；streaming 期间维持
  现有吸底跟随；用户主动上翻阅读时不强制拉回（既有跟随解除语义不变）。
  固定默认行为，不做设置项（与 5.5.4 一致）。
- **对齐清单 L23 行更新**：四个子项分别标注（做/不做的理由落进清单）。

## Impact

- Affected code：`src/main/index.ts`（热键注册）、`src/main/` 可能新增
  `global-shortcut.ts` 控制器、`src/renderer/chat-view.tsx` 滚动锚定、
  `src/renderer/diagnostics-view.tsx`（热键注册状态行）、`docs/workbuddy对齐清单.md` L23 行
- Affected specs：无既有 spec 冲突（L9 快捷键体系仍是独立后续项，本 spec 不含可编辑快捷键）

## ADDED Requirements

### Requirement: 全局唤起热键
The system SHALL register a global shortcut (default `Shift+Alt+W`) in the main process
that toggles window visibility: minimize when focused/visible, restore+focus otherwise.

#### Scenario: 唤起与隐藏
- **WHEN** 用户在任何应用内按下 `Shift+Alt+W` 且 KamiBuddy 窗口未聚焦
- **THEN** 窗口还原（若被最小化）并聚焦到前台
- **WHEN** 窗口已聚焦时再按一次
- **THEN** 窗口最小化

#### Scenario: 注册失败降级
- **WHEN** 热键被其他程序占用导致 `globalShortcut.register` 返回 false
- **THEN** 应用正常启动，事件日志记录失败，诊断页显示「全局唤起热键：注册失败（被占用）」

### Requirement: 发送时消息吸顶
The system SHALL, after the user sends a message in chat view, scroll the message list
so that the just-sent user message anchors to the top of the viewport, with the
assistant's reply unfolding below it.

#### Scenario: 问题吸顶
- **WHEN** 用户在对话页发送一条消息
- **THEN** 列表滚动使该用户消息位于视口顶部，回复在其下方生成

#### Scenario: 吸底跟随不被破坏
- **WHEN** 回复 streaming 中
- **THEN** 视口保持吸底跟随（既有行为）；用户主动上翻则解除跟随（既有语义不变）

## REMOVED Requirements（清单层面标注，非代码移除）

### Requirement: DisableSlotSystem 运营位框架
**Reason**: 依赖服务端运营平台（slots/active-batch 下发 HTML 模板），单机产品无此后端。
**Migration**: 无需迁移；借鉴点已记录（门控放数据 provider 层、缺 key=启用语义、
账号切换重置缓存）。将来若做运营位再开独立 spec。

### Requirement: QueueBanner 容量排队横幅
**Reason**: 依赖云端容量排队协议（6020-6022 错误码 + queueGetStatus 轮询 + Auto 模型
路由 + 套餐升档），BYOK 单机无此前提。
**Migration**: 状态机设计留档（waiting/full/user_limit/timeout/expired 五态 +
取消/切模型重发/关闭三动作 + banner 优先级 queue>error>credit>quota）；
pi 已有自动重试覆盖常见 429/overload，将来接云端容量调度时可按留档复刻。
