# 修复历史会话恢复后上下文占用显示消失 Spec

## Why

对话输入框的上下文组成/占用圆环（`ContextUsageRing`）只在当前最新任务中显示；点击侧栏恢复历史会话后圆环连同图标一起消失，直到用户在该会话里再发一条消息才重现。对标 WorkBuddy 在历史会话中正常显示。

**根因**（调研已实证）：daemon 的 `resumeSession` 重建会话时显式清空了 `conversation.usageDetail`（[daemon/index.ts:848](file:///d:/DongProject/kamibuddy/src/daemon/index.ts)，当时注释称其为「旧会话遗留」）。但 `usageDetail` 描述的是**当前上下文**的状态——resume 后 pi 从落盘 messages 重建了完整上下文，`getContextUsage()` 依然有效，数据本就在手，不该清掉。渲染条件 `conversation.usageDetail !== undefined`（[chat-view.tsx:1009](file:///d:/DongProject/kamibuddy/src/renderer/chat-view.tsx)）随即把圆环藏掉。

**叠加时序缺陷**：resume 路径上 `createHost` 末尾发的 `session_state`（daemon/index.ts:607）早于 entries 重建（:844），彼时触发的 `context_usage` 派生用的是**旧会话**的 entries 和 `lastSystemPromptTokens`——就算当时不清空，算出来的也是错数据。这解释了为什么当时用「清空」收尾；正确修法是在 entries 重建**之后**再派生。

## What Changes

- `src/daemon/index.ts` `resumeSession`：重建 entries 后不再清空 `usageDetail`，改为用恢复会话自身的 `host.state.contextUsage` + `estimateComposition(rebuilt, ...)` 重新派生并写入 conversation，同时补发一次 `context_usage` 事件（renderer 无需等 resyncSnapshot 即可更新）。
- 边界：pi 的 `getContextUsage()` 在「最近一次压缩后没有过 assistant 响应」的会话上返回 `tokens: null`（此时 KamiBuddy 有意不下发 contextUsage，见 [session-host.ts:602-610](file:///d:/DongProject/kamibuddy/src/core/session-host.ts) 的空窗注释）——这种情况维持圆环隐藏，不造假数据。
- 修复时序：确保派生发生在 entries 重建之后（此刻成分估算的输入才是被恢复会话的）。

不改 renderer（reducer 的 snapshot / context_usage 折叠逻辑已正确）、不改 shared 契约（`context_usage` 事件与 `SessionSnapshot.usageDetail` 已存在）、不改 session-host。

## Impact

- Affected code: [daemon/index.ts](file:///d:/DongProject/kamibuddy/src/daemon/index.ts)（resumeSession、emitContextUsageDetail 复用）、可能新增/更新 daemon 侧测试。
- 不触碰 `documents/`、`renderer/`、`shared/`（除非测试需要）。

## ADDED Requirements

### Requirement: 历史会话恢复后上下文占用立即显示

系统 SHALL 在恢复历史会话完成时，基于被恢复会话自身的上下文状态派生 `usageDetail` 并下发，使上下文圆环无需等待新的模型响应即可显示。

#### Scenario: 恢复历史会话
- **WHEN** 用户点击侧栏历史会话，resume 流程完成
- **THEN** 输入框上下文圆环立即显示，占用值与成分分类反映**被恢复会话**的当前上下文（而非恢复前的旧会话）

#### Scenario: 压缩后无响应的会话
- **WHEN** 恢复一个最近一次压缩后没有任何 assistant 响应的会话（pi `getContextUsage()` 返回 tokens: null）
- **THEN** 圆环保持隐藏（现状语义不变），不显示伪造数据

#### Scenario: 恢复后继续对话
- **WHEN** 在已恢复的会话中发送新消息并获得响应
- **THEN** 圆环照常经 `session_state → context_usage` 正常路径刷新（本修复不改变该路径）

## MODIFIED Requirements

### Requirement: resumeSession 的会话状态重建
原实现：`conversation.usageDetail = undefined`（连同 turn / cancelledTurns 一起清空旧会话瞬态）。
修改为：`turn` / `cancelledTurns` 仍清空（它们确实是旧 run 的瞬态），`usageDetail` 改为在 entries 重建完成后由恢复会话的 `contextUsage` + 重建 entries 重新派生。

## REMOVED Requirements

（无）
