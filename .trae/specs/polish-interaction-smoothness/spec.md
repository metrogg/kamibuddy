# 交互顺滑度与质感打磨 Spec

> **分支**：`feat/ui-design-system`（第 6 期）。前 5 期做了 token 地基、动效纪律、流式性能、
> 桌面端硬伤、状态覆盖。本期针对**"用起来顺不顺"**做一轮收口——重点是那些
> **用户能反复感知、但前 5 期没覆盖**的跳动与硬切。

## Why

本轮做了一次针对性侦察（8 个方向，逐项机械验证）。结论有两类：

**一、一条"账目错误"级的问题**

**`MiSans` 字体从未接线**：字体文件在仓里（`src/renderer/fonts/MiSans-Regular.woff2` /
`MiSans-Semibold.woff2`），`resources/fonts/README.md:17-18` 写着「`index.css` 顶部声明
`@font-face`，body 字体栈中 `"MiSans"` 位于 `"PingFang SC"` 之后」，
`.trae/specs/polish-ui-a11y-and-aesthetics/tasks.md:83-84` 与 `checklist.md:35` 都把这两步打了 `[x]`
——**但全仓 `src/` 里 `@font-face` 与 `MiSans` 都是零命中**：
- `index.css:58-66` 的 body 仍是 `font: 14px/1.6 "PingFang SC", -apple-system, …`
- `styles/tokens.css:153` 的 `--font-body` 同样没有 MiSans（且该变量除 `--font-mono` 被
  `perf-overlay.tsx:148` 用过一次外**无人引用**）
- `electron.vite.config.ts:54-65` 的 renderer 构建没有 `publicDir`，未被 `url()` 引用的 woff2
  **不进产物** → 这两个文件目前是纯死文件

**后果**：Windows 上所有 `font-weight: 600`（`.brand-name`、`.settings-head h1`、`.stat-value`、
按钮文字等**数十处**）都落到微软雅黑**合成加粗**，笔画发虚。这正是那份 spec 开篇写的
「观感最大杠杆」，团队以为已解决，实际一点没生效。

**二、五处用户能反复感知的跳动/硬切**

| 问题 | 现状 | 用户感受 |
|---|---|---|
| **滚动条占位横移** | 全仓无 `scrollbar-gutter`；`.stream`(`index.css:1563-1566`)、`.home`(`:662-667`)、`.settings-body`/`.skills-body`(`:4231-4239`)、`.sidebar-scroll`(`:186-193`) 都是 `overflow-y: auto`，而滚动条有实际宽度（`*::-webkit-scrollbar{width:var(--space-2)}` `:7928`、`*{scrollbar-width:thin}` `:7919`） | 对话第一次超过一屏（或列表 5 条涨到 6 条）时，`.stream > *` 的 `max-width: 832px; margin-inline: auto`（`:1711-1719`）让**整列文字横向重排一次**——"打字打到一半，整片消息左右横移" |
| **4 个整页视图硬切** | `App.tsx:1212-1323` 条件渲染；`settings` 有入场（`.settings-card` 的 `pop-layer-in`），但 `stats`/`skills`/`diagnostics`/`automations` 用的 `.settings`/`.skills` **整页壳没有任何入场**（`index.css:4198-4205`） | 从首页点「统计」「技能」「定时任务」「诊断」时整页"啪"地替换；同一窗口里"设置页有动画、统计页没有"，不一致 |
| **全站零骨架屏** | grep `skeleton` 只命中 `.text-shimmer`（流式文字扫光）与 `.seg-skeleton`（语义无关）；唯一状态出口 `state-views.tsx:26-81` 只有 `Spinner/EmptyState/LoadingState/ErrorState` | 文档预览（真慢：python docx 引擎 / Monaco chunk / pdf.js）与侧栏列表（首屏必经）用居中转圈，到达后内容"突然铺开" |
| **侧栏 hover 让位抖动** | `index.css:370-372` `.task-item:hover .task-item-body{padding-right:72px}`、`:532-535` 空间组头 `48px`，配合 `box-sizing: border-box` 与标题的 `text-overflow: ellipsis` | 鼠标划过**任何一行**，标题可用宽度瞬少 64px → **省略号位置跳变、标题被截短一截再恢复**。这是列表"在抖"的最典型来源 |
| **中文 IME 补全抽搐** | `autocomplete.tsx:132-139` 的 `onChange` 无 `isComposing` 判断，每次 input 都 `recompute`（全量扫描 + `setOpen`）；而**同仓** `experts-view.tsx:68-79` 特意加了 `composingRef` 守卫并注释了理由 | 打 `@` 后用拼音检索时，菜单随候选串反复重建、条目跳来跳去 |

**另有两处需要判断的**：
- **流式贴底跟随用的是 `useEffect`**（`chat-view.tsx:1543-1561`）：被动效果对 IPC 推来的流式 delta
  可能在**绘制后**才冲刷，理论上有「内容已长高、scrollTop 未跟上」的一帧（合批窗口 16ms 会把它
  放大成规律抖动）。同仓 `turn-rail.tsx:45` 的测量用的是 `useLayoutEffect`，**口径不一致**。
- **`.stream` 的 `stream-reveal` 整列动画每次返回对话页都重跑**（`index.css:1572-1593`）：
  `opacity 0→1` + `translateY(10px→0)`、280ms 带回弹，且 `.stream` 随 `ChatView` 挂载/卸载。
  对一份上万像素高的历史消息列，这是可见的"整列上滑淡入" + 为整个子树建合成层——
  与第 3 期 `content-visibility` 的性能取向相反。它的注释只论证了"为什么不常驻 transform"，
  **没论证"为什么每次重挂载都要跑"**。

## What Changes

- **接线 MiSans**：`index.css` 顶部（`@import` 之后）补两条 `@font-face`（400/600，`font-display: swap`），
  字体栈插入 `"MiSans"`；把 body 与 `--font-body` **收敛成一处引用**，不再各写一份栈。
- **消除滚动条占位横移**：4 个主滚动容器加 `scrollbar-gutter: stable`。
- **整页视图补入场**：给 `.settings` / `.skills`（已被 5 个视图共用）加一条与 `.settings-card`
  同族的入场，**一条规则覆盖 4 个视图**；首页与对话页按同口径补齐整壳入场。不再逐视图各写一份。
- **新增骨架屏组件**：`state-views.tsx` 加 `Skeleton`（`width`/`height`/`radius` 走 props；
  **不加扫光动画**——避免与 `.text-shimmer` 的"进行中"语义混淆，且 reduced-motion 下零损失）；
  接在**收益最高的两处**：文档预览（docx/xlsx/pdf，形状完全可预知的白纸）与侧栏任务列表
  （行高与 `.task-item-body` 严格对齐，否则到达时必有跳动）。
- **消除 hover 让位抖动**：把让位宽度**常驻**，只让操作钮做 `opacity/visibility` 过渡
  （`index.css:407-422` 的 `.task-item-ops` 本来就是 `absolute`，常驻 padding 无视觉代价）。
- **补 IME 守卫**：`autocomplete.tsx` 的 `recompute` 加与 `experts-view.tsx:68-79` 同款的
  composition 守卫（**抄既有先例，不另造**）。
- **流式贴底改 `useLayoutEffect`**：与 `turn-rail` 口径统一；改完**实测确认**，若无可感差异则保留
  `useEffect` 并写明理由。
- **侧栏折叠加 `width` 过渡**（**用户已拍板**）：在 `DESIGN.md` §5.1 登记为**第二条 width 受控例外**
  并写明理由（第一条是 `.preview-panel` 的全屏切换）。
- **收敛 `.stream` 的 reveal**：限定为"从空到有内容"的首次揭示，返回对话页不再重跑整列动画。
- 低成本一致性：`::selection` 用中性色（消除 Chromium 默认蓝这个"外来色"）；
  `.settings-card` 阴影从 `--shadow-md` 提到 `--shadow-lg`（与同级的 `.permission-card` 一致）；
  **resize 期间停面板宽度过渡**（与既有 `[data-dragging]` 同款手法）。

**明确不做（附理由）**：

| 事项 | 理由 |
|---|---|
| 场景/模式/专家切换改乐观更新（5-1） | 已核实 daemon 侧是**纯内存同步**（`session-host.ts:787-795` 只是 `setActiveToolsByName + emitState`），本机几毫秒、用户无感；引入本地乐观态反而有漂移风险。**不改** |
| `overflow-anchor`（4-3） | 默认 `auto` 的浏览器滚动锚定与"内容只在下端增长"方向一致，折叠上方内容时正好补偿。**确认无需改动** |
| `-webkit-font-smoothing`（6-1 附带） | macOS-only 属性，Windows 目标下无实际影响 |
| 内容卡加阴影 / 阴影分级体系 | 内容卡纯描边无阴影是 WB 口径（有意）；三档阴影语义已站得住，加第四档会撞 `DESIGN.md` §2 的档位纪律 |
| tab 内容切换过渡（2-3）、toast 退场（2-4）、刻度轨 hover 过渡（7-2-a） | 均为打磨项，收益低；本期先不动，避免范围膨胀 |
| 右键菜单（7-2-b）、`-webkit-app-region`（8-1） | 前者属**新增交互**需先定需求；后者**确认不适用**（`BrowserWindow` 用的是 Windows 原生标题栏，没有 `frame: false`，当前实现正确） |
| `.capability-chip` 那条 2% 阴影（C-2） | 肉眼不可见，但**有 WB 原值依据**、不是违规；删它是零收益的洁癖 |

## Impact

- Affected specs: 承接 `apply-design-tokens-foundation`（token）、`refine-motion-discipline`（动效纪律）、
  `optimize-stream-rendering`（渲染成本）、`complete-view-states`（状态出口）；
  **修正 `polish-ui-a11y-and-aesthetics` 的一处账目错误**（字体接线声称完成但未落地）
- Affected code:
  - `src/renderer/index.css`（字体栈与 `@font-face`、`scrollbar-gutter`、让位常驻、视图入场、
    侧栏过渡、`::selection`、`.settings-card` 阴影、`.stream` reveal 收敛）
  - `src/styles/tokens.css`（`--font-body` 与 body 收敛到一处）
  - `src/renderer/state-views.tsx`（新增 `Skeleton`）
  - `src/renderer/office-docx.tsx` / `office-xlsx.tsx` / `pdf-preview.tsx` / `office-preview.tsx`、
    `sidebar.tsx`（骨架屏接线）
  - `src/renderer/autocomplete.tsx`（IME 守卫）
  - `src/renderer/chat-view.tsx`（贴底 `useLayoutEffect`、reveal 收敛）
  - `src/renderer/App.tsx`（侧栏过渡、resize 停过渡）
  - `DESIGN.md`（§5.1 第二条 width 例外 + 理由）
  - **不改** daemon / core / shared / IPC 契约 / 任何视觉档位值

## ADDED Requirements

### Requirement: 字体必须实际生效

`src/renderer/index.css` SHALL 声明 `@font-face` 引入仓库内的 MiSans（`woff2`，`font-display: swap`），
且正文与 UI 的字体栈 SHALL 包含 `"MiSans"` 并位于中文回退字体之前。
**字体栈 SHALL 只有一处定义**（`--font-body` 是唯一真源，body 引用它，不再各写一份）。

#### Scenario: Windows 上的 600 字重不再合成加粗

- **WHEN** 在 Windows 上查看任意 `font-weight: 600` 的文本（品牌名、统计数值、按钮）
- **THEN** 用的是 MiSans-Semibold 的真实字重，笔画不虚
- **AND** 构建产物里包含这两个 woff2（不再是死文件）

### Requirement: 滚动条不改变内容宽度

主滚动容器（`.stream` / `.home` / `.settings-body` / `.skills-body` / `.sidebar-scroll`）
SHALL 使用 `scrollbar-gutter: stable`，使滚动条出现/消失不改变内容可用宽度。
SHALL NOT 给宽度紧张的容器（`.thinking-body` / `.user-bubble` / `.pop-menu` 等）加该属性。

#### Scenario: 跨过一屏不再横移

- **WHEN** 对话内容首次超过一屏（滚动条从无到有）
- **THEN** 消息列**不发生横向重排**，文字不左右横移

### Requirement: 整页视图切换有入场

`stats` / `skills` / `diagnostics` / `automations` 这类整页视图 SHALL 有入场过渡，
且 SHALL 与 `settings` 的入场同族（同为 `transform` + `opacity`，不引入第二套语言）。
实现 SHALL 复用共享的整页壳选择器，**不得逐视图各写一份**。

#### Scenario: 从首页切到统计页不硬切

- **WHEN** 从首页点侧栏「统计」（或技能/诊断/定时任务）
- **THEN** 页面内容有与设置页一致的柔和的入场，而不是瞬间替换

### Requirement: 结构已知的等待用骨架屏

对**结构可预知**的等待场景（文档预览、侧栏任务列表），SHALL 使用 `Skeleton` 占位，
其尺寸 SHALL 与真实内容对齐（避免内容到达时跳动）。
`Skeleton` SHALL 是 `state-views.tsx` 的具名导出，SHALL NOT 在各处自建；
SHALL NOT 带扫光动画。

#### Scenario: 侧栏首屏不跳

- **WHEN** 应用启动、会话列表在途
- **THEN** 显示 3–5 条与 `.task-item-body` 行高对齐的骨架，列表到达时**不发生竖向跳动**

#### Scenario: 文档预览有"白纸感"

- **WHEN** 打开一个 docx/xlsx/pdf 产物
- **THEN** 在解析期间显示按纸张比例排布的骨架（而非居中转圈）

### Requirement: hover 不得改变布局

列表行的 hover 态 SHALL NOT 改变任何参与布局的尺寸（`padding` / `width` / `margin`）。
操作钮的显隐 SHALL 只用 `opacity` / `visibility` 表达，且 SHALL NOT 为此**预留常驻让位宽度**——
**订正（后续回归修复）**：常驻让位是本条最初的实现，算下来在 216px 侧栏里把标题可用宽压到
~20px，标题只剩一个字加省略号（`padding-right: 72px` 叠加常驻时间戳）。正解是
**同位置交叉淡化**：时间戳与操作钮落在同一格（`.task-item-ops` 绝对定位在时间戳的
`--space-3` 右内边距上），hover 时 meta 降到 `opacity: 0` 但**保留占位**，
于是标题可用宽在两种态下逐像素相同，且右侧不必为操作钮留任何空白。
空间组头同口径：右侧操作钮本就是普通 flex 子项（宽度天然常驻），SHALL NOT 再叠一层让位 padding。

#### Scenario: 划过侧栏行不跳字

- **WHEN** 鼠标划过侧栏任一任务行（或空间组头）
- **THEN** 标题的可用宽度不变、省略号位置**不跳变**

#### Scenario: 划过侧栏行不该缩短标题

- **WHEN** 鼠标划过侧栏任务行
- **THEN** 标题显示的字符数与未划过时相同（不因"让位"被多截掉几个字）

### Requirement: 输入法组合期间不重算补全

补全下拉 SHALL 在 IME 组合（`isComposing`）期间不重算候选，或推迟到 `compositionend` 一次性计算。
实现 SHALL 复用仓库既有先例（`experts-view.tsx` 的 `composingRef` 守卫），不另造机制。

#### Scenario: 中文检索不再抽搐

- **WHEN** 在输入框打 `@` 后用拼音输入（组合未上屏）
- **THEN** 补全菜单不随候选串逐键重建、条目不跳

### Requirement: 侧栏折叠有过渡（新增 width 受控例外）

侧栏折叠/展开 SHALL 有宽度过渡（`--dur-base` 量级），且在 `DESIGN.md` §5.1 登记为
**第二条 `width` 受控例外**并写明理由。SHALL NOT 因此改动侧栏的让位语义
（主区仍被挤压，不是浮层覆盖）。

#### Scenario: 折叠不再瞬跳

- **WHEN** 点左上角开关折叠/展开侧栏
- **THEN** 侧栏宽度平滑变化，主区内容随之平滑挤压/舒展（不是 216px 瞬间跳变）

### Requirement: 长历史列表不重复播放入场动画

`.stream` 的整列 reveal SHALL 只在「从空到有内容」（首次揭示）时播放，
SHALL NOT 在每次 `ChatView` 重挂载（从首页/设置/统计返回对话页）时重跑。

#### Scenario: 返回对话页不整列上滑

- **WHEN** 从设置页返回一个已有上万像素历史的对话
- **THEN** 消息列**不整列上滑淡入**，直接呈现

## MODIFIED Requirements

### Requirement: DESIGN.md §5.1 的 width 例外

**原**：只允许 `.preview-panel` 过渡 `width`（全屏切换）。

**新**：新增第二条受控例外——**侧栏折叠**（`.sidebar` 的 `flex-basis` / 宽度）。
理由：折叠是"让位"语义（主区必须跟着变宽），这个效果无法用 `transform` 表达；
过渡时长取 `--dur-base`；接受折叠期间约 12 帧布局重排的代价。
（对照：`.preview-panel` 的 width 例外是"全屏切换"所需，两者性质不同但同属受控例外。）

## REMOVED Requirements

无。
