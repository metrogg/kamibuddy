# 流式渲染开销优化 Spec

> **分支**：`feat/ui-design-system`（第 3 期）。第 1 期做 token 地基、第 2 期做动效纪律，
> 本期处理**诊断报告里排第一、第二的性能问题**（每次对话都在付的成本）。

## Why

界面诊断把流式渲染列为最高风险（P0×2），实测确认三处：

1. **每个 delta 一次 IPC + 一次全量重渲染**：`src/core/session-host.ts:1128-1140` 的
   `text_delta` / `thinking_delta` 分支**直接 `emit`，无任何合批**。一个 delta 要走
   daemon → main → renderer 整条链路，并让 renderer 重跑一遍渲染。
2. **消息流无窗口化**：`src/renderer/chat-view.tsx:1940` 的 `{turnViews.map(...)}` 全量渲染，
   长会话可上千条 entry，每条 DOM 都常驻。
3. **若干"每 delta 重算"的热点**：
   - `src/renderer/widget-view.tsx:436` 的 `parseWidgetResult(card.detail)` **每次渲染都 JSON.parse**
     （未 memo；同文件 437 行的 `partial` 反而 memo 了）
   - `src/renderer/markdown.tsx` 的 `Markdown` 组件**未 `memo`** → 已完成消息也被父级重渲染带着重解析
   - `src/renderer/App.tsx:1186/1193` 的 `collectSources` / `collectChanges` 是 **JSX 内联调用**（未 memo）
   - `src/renderer/turn-rail.tsx` 的测量 `useLayoutEffect` 依赖 `[entries]` → **每个 delta 强制同步布局**

**为什么这期做**：前两期是一次性的整理（token 化、动效属性），而这三处是**每次对话都在付**的成本，
且长会话（几百轮）会线性放大。**现在动它时机最好**——动效刚整理完，渲染链路没有其它并行改动。

## What Changes

- **流式 delta 合批**（daemon 侧）：`session-host.ts` 的 delta emit 改为**时间窗缓冲**
  （约 16ms ≈ 一帧），**只合并连续同类型的 delta**；遇到类型切换、`message_end`、
  turn 结束**必须立即 flush**（不能丢最后一批）。
- **收起态跳过渲染**：给折叠体的内层加 `content-visibility: hidden`——已折叠的内容
  （轮折叠体、工具详情、来源列表）**跳过 layout 与 paint**，而它们在外层已是 0 高度，
  不影响 `scrollHeight`（因而不干扰吸底跟随与刻度轨）。
- **热点 memo 化**（5 处）：`widget-view` 的 `parseWidgetResult`、`markdown` 的 `Markdown`
  组件（`React.memo`）、`App.tsx` 的两处内联 collect、`chat-view` 的 `pendingText` /
  `findLast`、`turn-rail` 的测量降频。
- **性能观测工具**：新增开发期 FPS + longtask（>50ms）采集浮层，使「卡不卡」可量化而非靠感觉。

**明确不做（附理由）**：

| 事项 | 理由 |
|---|---|
| 完整虚拟滚动（react-window 类） | 会同时牵动**吸顶 / 吸底跟随 / 轮折叠 / 刻度轨**四套机制（`send-anchor.ts`、`turn-fold.ts`、`turn-rail.tsx` 都依赖真实 DOM 与 `scrollHeight`），风险远超收益 |
| `content-visibility: auto`（对未折叠的屏幕外条目） | 屏幕外元素用**估值高度**会让 `scrollHeight` 漂移 → 滚动条跳动、吸底跟随抖动。我们依赖 `scrollTop = scrollHeight` 贴底，这条风险不可接受 |
| Markdown 解析移入 Web Worker | remark 生态的序列化/通信开销可能抵消收益，且要改整条渲染链路；先用 `React.memo` 拿「已完成消息不重解析」这块主要收益 |
| `extractPartialWidgetArgs` 的增量提取 | 第 437 行已 `useMemo`，O(n²) 只在大 widget 的流式期出现，频率低 |
| 滚动跟随 / 刻度轨的既有算法 | 已有防抖与 `RATIO_EPSILON` 容差处理，不动 |
| 三方内容（widget iframe 内） | 跨上下文，不在范围 |

## Impact

- Affected specs: 承接 `apply-design-tokens-foundation`（第 1 期）与 `refine-motion-discipline`（第 2 期）；
  与诊断报告「如果只做 5 件事」的第 1、2 项对应
- Affected code:
  - `src/core/session-host.ts`（delta 合批——**核心改动**）
  - `src/renderer/index.css`（折叠内层的 `content-visibility`）
  - `src/renderer/widget-view.tsx`、`markdown.tsx`、`App.tsx`、`chat-view.tsx`、`turn-rail.tsx`（热点 memo）
  - `src/renderer/perf-overlay.tsx`（新建，开发期采集）
  - **不改** shared / IPC 契约 / 会话持久化格式 / 任何视觉值

## ADDED Requirements

### Requirement: 流式 delta 合批

daemon SHALL 对流式正文/思考 delta 做时间窗合批（窗口约 16ms），使 renderer 收到的
事件数从「每 token 一次」降为「每帧最多一次」。合批 SHALL 只合并**连续同类型**的 delta；
SHALL 在以下时刻**立即 flush**：类型切换、`message_end`、turn 结束/中断。
SHALL NOT 因合批丢失任何 delta 或改变 delta 的**拼接结果**。

#### Scenario: 合批不改变最终文本

- **WHEN** 模型输出一段正文后结束该 turn
- **THEN** renderer 侧拼接出的正文与未合批时**逐字一致**（最后一批必须已 flush）

#### Scenario: 思考与正文不串序

- **WHEN** 同一 turn 内先有 thinking delta、后有 text delta
- **THEN** 两者的到达顺序与内容边界不变（类型切换即 flush）

#### Scenario: 中断时不丢内容

- **WHEN** 用户在流式过程中点停止
- **THEN** 已收到但未 flush 的 delta 在终止前送达（不出现"最后半句消失"）

### Requirement: 收起态跳过渲染

折叠体（轮折叠体 `.metafold-body`、工具详情 `.tool-detail-box`、来源列表 `.tool-source-list`）
处于收起态时，其内层 SHALL 使用 `content-visibility: hidden` 跳过 layout 与 paint；
SHALL NOT 改变收起态占位（保持 0 高度）与展开态表现。

#### Scenario: 折叠轮不消耗渲染

- **WHEN** 一个长会话里有数十个已折叠的轮
- **THEN** 这些轮的内容不参与 layout/paint（DevTools 的 Rendering 面板中不再有对应绘制）

#### Scenario: 滚动与折叠行为不变

- **WHEN** 展开/收起折叠体、贴底跟随、拖刻度轨
- **THEN** 行为与改造前一致（`scrollHeight` 不因该属性漂移）

### Requirement: 完成的条目不被重算

对**已完成**的消息与工具结果，其昂贵转换 SHALL 被 memo 化，使其不随父级重渲染而重算：
- `widget-view` 的 `parseWidgetResult(card.detail)`
- `Markdown` 组件（`React.memo`，text 不变即不重新解析）
- `App.tsx` 的 `collectSources` / `collectChanges`
- `chat-view` 的 `pendingText(entries)` / `entries.findLast(...)`

#### Scenario: 历史消息不重解析

- **WHEN** 长会话中正在流式输出新消息
- **THEN** 上方已完成消息的 Markdown **不重新解析**（不随每个 delta 重跑）

### Requirement: 可量化的性能观测

系统 SHALL 提供开发期性能采集：FPS 采样（低于阈值告警）与主线程 longtask（>50ms）记录，
并 SHALL 默认**不影响生产**（开发构建或显式开关才启用）。

> **〔2026-09-15 订正〕** 实现口径已收紧为**只认显式开关**（`localStorage.kbPerf === "1"`），
> **DEV 下也不再默认启用**——浮层是**主动取证**才需要的工具（改渲染性能时才量一次），
> 默认常驻会遮挡界面、打扰正常开发。括注中原「开发构建…才启用」即 DEV 默认开的写法作废；
> 「默认不影响生产」这一要求本身不变，且被更严格地满足。

#### Scenario: 抓到卡顿现场

- **WHEN** 开发期打开该采集并跑一次长会话（含流式与折叠）
- **THEN** 控制台/浮层能给出 FPS 曲线与 longtask 列表（含时长），可据此定位元凶

## MODIFIED Requirements

### Requirement: 流式事件推送粒度

**原**：`session-host.ts` 每收到一个 pi 的 `text_delta` / `thinking_delta` 就 `emit` 一条
`assistant_text_delta` / `assistant_thinking_delta`。

**新**：改为经时间窗缓冲后批量 `emit`（同一窗口内连续同类型的 delta 合并为一条，
`delta` 字段为拼接结果）。事件类型与字段语义不变，**下游（reducer / UI）无需改动**。

## REMOVED Requirements

无。
