# 消息导航刻度轨（Codex 风）Spec

## Why

Codex 在会话流左侧放一排小横条标记用户消息位置，点击即跳转——长会话里回找
「我之前说过的那句话」非常高效。KamiBuddy 的会话已有按 sessionId 累积变长的趋势，
缺少任何快速定位手段（只能硬滚）。

## What Changes

- 新增 `src/renderer/turn-rail.tsx`：会话流左缘的竖向刻度轨组件
  - 每条 user 消息一个刻度（小横条），纵向位置 = 该消息 DOM 顶端在
    scrollHeight 中的比例（测量经 `data-entry-id` 锚点）
  - 点击刻度 → 平滑滚动到对应消息（scrollIntoView）
  - 当前视口顶最近的用户消息刻度高亮（跟随滚动，rAF 节流）
  - 用户消息少于 2 条时不渲染（没有导航需求）
- chat-view：entry 根 div 加 `data-entry-id={entry.id}` 测量锚点；`.stream` 容器内挂
  `<TurnRail>`（scrollRef 与 entries 都是现成的，零新状态源）
- 位置重算时机：entries 变化（流式增高自然覆盖）+ 容器 ResizeObserver
- 纯函数 `computeTicks` / `nearestActiveTick`（turn-rail.ts）+ vitest
- index.css：刻度轨样式（复用 --text-dim/--text/--ok 既有变量，无新变量）

**明确不做**：assistant/工具条目不标（用户需求就是「用户说过话的地方」）；
刻度 hover 预览消息内容；右键菜单；最小化缩略图（minimap 全文渲染）。

## Impact

- Affected specs：无前置依赖；纯 renderer 增量
- Affected code：`src/renderer/turn-rail.tsx`（新）、`turn-rail.ts`（新，纯函数）+
  测试、`chat-view.tsx`（锚点属性 + 挂载一行）、`index.css`

## ADDED Requirements

### Requirement: 刻度轨渲染与定位

系统 SHALL 在会话流左缘渲染竖向刻度轨：每条 role==="user" 的 entry 对应一个刻度，
刻度纵向位置与该消息顶端在滚动内容中的比例一致（误差随内容增长自动重算：
entries 变化与容器尺寸变化时重新测量）。用户消息少于 2 条时刻度轨不渲染。

#### Scenario: 比例定位
- **WHEN** 会话有 5 条用户消息，第 3 条位于滚动内容约 55% 高度处
- **THEN** 第 3 个刻度位于刻度轨约 55% 高度处

### Requirement: 点击跳转与高亮

系统 SHALL 支持点击刻度平滑滚动到对应消息（块顶对齐）；视口滚动时，
位于视口顶附近（scrollTop 之上最近）的用户消息刻度 SHALL 高亮，
其余刻度保持弱化色；hover 刻度有视觉反馈。

#### Scenario: 点击回找
- **WHEN** 用户在长会话底部点击靠上的某刻度
- **THEN** 会话流平滑滚动到对应该刻度的用户消息，且该刻度变为高亮态

### Requirement: 纯函数可测

刻度比例计算与最近高亮判定 SHALL 是纯函数（输入测量值数组与滚动参数，
输出比例/命中 id），有 vitest 用例（比例换算、空列表、单一刻度、边界命中）。

## MODIFIED Requirements

无（entry 根 div 仅新增 data-entry-id 属性，无行为变化）。

## REMOVED Requirements

无。
