# 动效改造（属性纪律 + 空间连续性）Spec

> **分支**：`feat/ui-design-system`（本分支第 2 期）。上一期 `apply-design-tokens-foundation` 已把
> token 底座与视觉值收敛做完，本期处理**动效的属性选择与场景规范**。

## Why

上一期把"时长/缓动的取值"收进了 token，但**动效的属性选择与场景规范**仍是散落的：

1. **2 处折叠体过渡同时动 4–6 个布局属性**：`.tool-detail-box` 过渡 `max-height` +
   `padding-top` + `padding-bottom` + `margin-top` + `margin-bottom` + `border-width`（6 个），
   `.tool-source-list` 过渡 `max-height` + `margin-top` + `margin-bottom`。每次展开/收起都逐帧
   触发全量重排（layout + paint），是长会话里最可见的掉帧点。
2. **扫光动 `background-position`**：`@keyframes text-shimmer-sweep` 让 `background-position`
   从 `200% → -200%`，配合 `background-clip: text` 意味着**每帧重绘整段文字**。它在流式期间
   常驻（工具状态字、等待行、思考标题）。
3. **弹层全部"瞬间出现"**：`.pop-menu`（plus/model/permission/mode/space 五菜单共用）、
   `.ws-popover`、`.provider-select-panel`、`.permission-card`、`.ex-modal`、`.settings-card`、
   `.cu-popover`、各子菜单等约 12 处**没有任何入场过渡**。只有 `.toast` 与
   `.questionnaire-card` 有入场动画。
4. **进出场对称**：所有过渡用同一时长来回（如 `.tool-detail-box` 双向都是 `--dur-slow`）。
   用户已经决定离开时，动画只是善后，不该和进入一样慢。
5. **弹层没有空间连续性**：没有 `transform-origin` 对齐触发按钮，弹层看起来"凭空出现在某处"
   而不是"从按钮里生长出来"。

**已有 3 个 @keyframes 是正确的**（`stream-reveal` / `jump-to-bottom-in` / `tool-pulse` /
`toast-in` / `questionnaire-slide-up` 都只动 transform+opacity），**`.metafold-body` 也已是
正确做法**（`grid-template-rows: 0fr↔1fr`，不是问题）——本期不重复造轮子。

## What Changes

- **折叠体过渡改造**：`.tool-detail-box` 与 `.tool-source-list` 从「`max-height` + padding +
  margin + border-width 多属性过渡」改为「`grid-template-rows: 0fr↔1fr`」（沿用
  `.metafold-body` 的既有手法），保留 `opacity` / `transform` / `visibility`。
  注意 `.tool-source-list` 展开后**限高 300px 且 `overflow: auto`**（来源可能十几条），
  改造后仍需保留这个内部滚动。
- **弹层入场统一**：给约 12 个弹层/模态/子菜单加入场（`--dur-base` + `--ease-out`，
  `opacity 0→1` + `translateY(4px→0)` + `scale(.98→1)`），并加 `transform-origin` 对齐
  其触发位置（空间连续性）。
- **进出场不对称**：退出时长降一档（`--dur-slow`→`--dur-base`→`--dur-fast`，正好落在
  「退出 ≈ 入场 70%」附近，**不新增 token 档位**）。CSS 手法：基类写退出参数、
  `.open` / `[data-visible]` 等激活类写入场参数。
- **扫光改造**：`.text-shimmer` 的 `background-position` 动画改为「伪元素遮罩 +
  `transform: translateX` 扫过」，保持视觉不变但改为合成动画。
- **拖拽期停过渡**：`.preview-panel` 的 `width` 过渡（全屏切换需要，保留）在 sash 拖拽期间
  置 `transition: none`，避免每次 `mousemove` 都带过渡重排。
- **DESIGN.md 补两条规则**：进出场不对称（退出 = 入场约 70%，用降一档表达）、
  空间连续性（弹层从触发点生长，`transform-origin` 对齐）。

**明确不做（附理由）**：

| 事项 | 理由 |
|---|---|
| `.metafold-body` 的 `grid-template-rows` 过渡 | **这已是推荐的现代做法**（替代 `height: auto` 不可过渡的坑），不是问题 |
| `.widget-frame` 的 `height` 过渡 | iframe 高度由内容自适应驱动，必须过渡；已知有 100ms 尾沿防抖，频率可控 |
| `.stream` 入场的 `cubic-bezier(0.34, 1.56, 0.64, 1)` | 带回弹的第三档缓动，抹平会变成普通淡入；上一期已登记为 token 例外 |
| `.preview-panel` 的 `width` 过渡本身 | 全屏切换需要它（WB 240ms 同参数）；只增加拖拽期暂停 |
| 循环动画（`spin` / `tool-pulse` / `text-shimmer` 周期） | 周期是动画语义，不属交互动效时长（上一期已有例外） |
| 三方内容（widget iframe 内）的动效 | 跨上下文，不在我们的样式范围 |
| 存量局部 `prefers-reduced-motion` 块 | 它们还做了别的事（如把某个动画整个 `animation: none`），保留 |

## Impact

- Affected specs: 承接 `apply-design-tokens-foundation`（上期）；后续 #4 性能 spec 会继续处理
  流式渲染与虚拟化
- Affected code:
  - `src/renderer/index.css`（主体：2 处折叠体改造、约 12 处弹层入场、全站退出时长拆分、
    扫光 keyframes、`.preview-panel` 拖拽态）
  - `src/renderer/artifact-panel.tsx`（拖拽起点加 `.dragging` 类，或等价机制）
  - `src/renderer/index.css` 或 `icons.tsx` 无涉（不动图标）
  - `DESIGN.md`（补两条规则）
  - **不改** daemon / core / shared / 业务逻辑；不改任何视觉值（颜色/间距/圆角/阴影不变）

## ADDED Requirements

### Requirement: 动效只动合成属性（折叠体）

折叠/展开类过渡 SHALL 只动 `transform` / `opacity` / `visibility`，以及
`grid-template-rows`（受控例外——它是 `height: auto` 的唯一可靠替代）。
SHALL NOT 过渡 `max-height` / `padding` / `margin` / `border-width` / `height` / `width`
（除 `.preview-panel` 的既有宽度过渡）。

#### Scenario: 工具详情开合不掉帧

- **WHEN** 在长会话里反复展开/收起工具详情（`.tool-detail-box`）
- **THEN** 展开过程只触发合成与 `grid-template-rows` 插值，不再逐帧重排 padding/margin/border

#### Scenario: 来源列表保留内部滚动

- **WHEN** 一次搜索返回十几条来源并展开 `.tool-source-list`
- **THEN** 列表仍限高并内部滚动（改造不得丢掉 `max-height: 300px; overflow: auto` 的效果）

### Requirement: 弹层入场与空间连续性

弹层/模态/子菜单 SHALL 有入场过渡（`opacity` + `transform`，时长 `--dur-base`、
缓动 `--ease-out`），并 SHALL 通过 `transform-origin` 与其触发位置对齐，使弹层呈现为
「从触发点生长」而非凭空出现。

#### Scenario: 菜单从按钮生长

- **WHEN** 点击输入框左侧「+」打开菜单
- **THEN** 菜单从该按钮所在角落展开（`transform-origin` 对齐），而非从中心缩放

#### Scenario: 子菜单方向正确

- **WHEN** 打开向右飞出的子菜单（如「模式 ▸」）
- **THEN** 其 `transform-origin` 在左侧（贴着父菜单），从父菜单边缘生长

### Requirement: 进出场不对称

过渡 SHALL 区分进入与退出时长：退出时长 SHALL 比进入短一档
（`--dur-slow`→`--dur-base`、`--dur-base`→`--dur-fast`），以表达「用户已决定离开」。
SHALL NOT 为此新增 token 档位（现有时长三档即是表达手段）。

#### Scenario: 折叠体退出更快

- **WHEN** 收起已展开的工具详情
- **THEN** 收起过渡时长（`--dur-base`）短于展开（`--dur-slow`）

### Requirement: 合成动画替代 paint 动画

`.text-shimmer` 的扫光 SHALL 用 `transform` 表达，SHALL NOT 动画 `background-position`
（后者每帧重绘文字区域）。视觉观感 SHALL 与改造前一致。

#### Scenario: 流式扫光不再重绘文字

- **WHEN** 流式期间观察工具状态字/等待行的扫光
- **THEN** 扫光动的是伪元素的 `transform`，`background-position` 动画已移除

### Requirement: 拖拽期停过渡

`.preview-panel` 在 sash 拖拽期间 SHALL 禁用 `width` 过渡（拖拽结束恢复），
避免每个 `mousemove` 都带 200ms 过渡产生"拖不动"的黏滞感与逐帧重排。

#### Scenario: 拖拽跟手

- **WHEN** 拖动产物面板左侧 sash 调整宽度
- **THEN** 面板宽度即时跟随鼠标（无过渡迟滞），松手后恢复过渡以便全屏切换使用

## MODIFIED Requirements

### Requirement: 动效规范（DESIGN.md §5）

**原**：只规定「只动 transform/opacity」与「时长缓动取自 token」。

**新**：补充两条——① 进出场不对称（退出 = 入场约 70%，用降一档表达）；
② 空间连续性（弹层 `transform-origin` 对齐触发点）。
另明确 `grid-template-rows` 折叠为受控例外（`height: auto` 的唯一可靠替代）。

## REMOVED Requirements

无。
