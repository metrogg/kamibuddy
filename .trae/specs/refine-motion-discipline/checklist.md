# Checklist

> 检查时按 spec「明确不做」表：**列出的豁免项不应被改动**，改错了同样是缺陷。
> 本期为 `feat/ui-design-system` 分支第 2 期（承接 `apply-design-tokens-foundation`）。
>
> **校验日期 2026-09-14**：`npm run check`（typecheck + check:deps + check:tokens）通过、
> `npm test` 95 文件 / 1711 用例全绿、`check:tokens` 真违例 **0**。
> **唯一未勾选项为「GUI 观感走查」**——本沙箱 Electron 无显示环境、启动即退出，
> 已完成逐项静态核对（详见末节）。

## 折叠体过渡（只动一个布局属性）

- [x] `.tool-detail-box` 的过渡里**不再有** `max-height` / `padding-top` / `padding-bottom` /
      `margin-top` / `margin-bottom` / `border-width`
- [x] `.tool-source-list` 的过渡里**不再有** `max-height` / `margin-top` / `margin-bottom`
- [x] 两处改用 **`interpolate-size: allow-keywords` + `height: 0↔auto`**
      （而非 `grid-template-rows`——因这两处无内层包裹元素，加内层要改 3 处 DOM，风险大于收益；
      spec 与 tasks 已记录该技术选型及理由）
- [x] 两处仍保留 `opacity` / `transform` / `visibility` 过渡
- [x] `.tool-detail-box` 收起态**净占 0px，无残留空壳**（Electron 44 真实布局探针 A/B 实测）
- [x] `.tool-source-list` 展开后**仍限高 300px 且内部可滚动**（实测 30 条来源 → 300/1042）
- [x] 横向内边距（`padding: 0 var(--space-5)`）保留，内容未被挤压或裁切
- [x] 过渡属性总数从 **12 项降到 4 项**（布局属性只剩 `height`）

## 弹层入场与空间连续性

- [x] 实际盘点出 **22 处**（我列 12 处 + grep 补出 `.auto-form-card`、`.mcp-editor-card`、
      `.save-space-card`、`.ac-menu`、`.ex-modal-mask`）**全部有入场**
- [x] 入场只动 `transform` / `opacity`（`opacity` + `translateY(4px)` + `scale(.98)`）
- [x] 入场时长缓动取自 token（`--dur-base` + `--ease-out`）
- [x] 用 `animation` 而非 `transition`（条件挂载元素 transition 无起跳点——关键判断）
- [x] 每个弹层都配了 `transform-origin`（21 处），且**逐个在注释里写明定位依据**
- [x] 下方展开的 origin 在 `top`、上方展开的在 `bottom`、居中模态用 `center`
- [x] **修正了 spec 的一处方向错误**：`.mode-menu-sub` 实为 `right: calc(100%+4px)`
      → **向左飞出**，origin 应为 `right top`（spec 原写 `left center`，已按实测证据采纳纠正）
- [x] 22 处基类均**无定位 `transform`**，不存在 `.jump-to-bottom` 那类"动画期间跑偏"的坑

## 进出场不对称

- [x] 常驻 DOM 元素的**退出时长严格短于入场**：`.metafold-body` / `.tool-detail-box` /
      `.tool-source-list`（入 `--dur-slow` 280ms → 出 `--dur-base` 200ms）、
      `.stream-fade` / `.entry-toolbar`（入 `--dur-base` → 出 `--dur-fast`）
- [x] 未新增 token 档位（仍为 3 档时长）
- [x] Task 1 改的两处折叠体已一并纳入这套时长（复核通过，非只改弹层）
- [x] `--dur-fast` 档的 hover/caret 反馈保持原样（已是最快档）
- [x] 条件挂载的 22 处弹层**未编退场动画**（卸载即消失，不涉及对称性）

## 扫光（技术评估结论：保持现状，登记为受控例外）

- [x] 已复核现状：`background-clip: text` + `background-position` 动画，用在 **8 处行内 `<span>`**
- [x] 已评估 spec 原定方案（伪元素 + `translateX`）：**不可等价复刻**——① 伪元素拿不到文字内容；
      ② `content: attr(data-text)` 复制后仍需 `mask-position`（与 `background-position` 同类，非合成）；
      ③ 行内 `<span>` 不是块容器，改 `inline-block` 才能裁剪，影响排版与基线
- [x] 已评估收益：**不成立**（重绘面积仅限文字区域、Chromium 对 `background-position` 有合成优化、
      `prefers-reduced-motion` 下已有降级）
- [x] 决定**保持现状**，并在 `index.css` 该块注释（避免后人重复尝试）+ `DESIGN.md` §5 登记为受控例外
- [x] 扫光**视觉零变化**（周期仍 `2.2s linear infinite`；`--shimmer-color` 的两处局部覆盖仍生效）

## 拖拽期停过渡

- [x] `.preview-panel` 的 `width` 过渡**保留**（全屏切换需要它）
- [x] 拖拽期间有禁用机制：面板 `ref` + `data-dragging="true"` 属性 + CSS 属性选择器
- [x] 拖拽时面板宽度**即时跟手**（无 200ms 迟滞）——静态核对通过，观感待人工
- [x] 松手后全屏切换仍有过渡（`.fullscreen` 的既有 `transition: none` 未动）
- [x] **键盘调宽保持过渡未动**（离散 ±10px，带过渡更顺）
- [x] 清理路径：`removeAttribute` 与 `removeEventListener`/cursor 复位同函数，无遗漏窗口

## 豁免项未被误改

- [x] `.metafold-body` 的 `grid-template-rows` **折叠手法未改动**（仅按时长规则调了双档时长）
- [x] `.widget-frame` 的 `height` 过渡**未改动**（iframe 内容自适应必需，已有 100ms 防抖）
- [x] `.stream` 入场的 `cubic-bezier(0.34, 1.56, 0.64, 1)` 回弹缓动**未改动**
- [x] 存量局部 `prefers-reduced-motion` 块**未被删除**
- [x] 三方内容（widget iframe 内）的动效未被触碰

## 无回归与文档

- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过（扫描 256 文件）
- [x] `npm run check:tokens` 通过（真违例 **0**，未因本期上升，**未塞白名单**）
- [x] `npm test` 全绿（95 文件 / 1711 用例）
- [x] **未改动任何视觉值**（颜色/间距/圆角/阴影/字号零 diff；本期只动过渡与动画属性）
- [x] `DESIGN.md` §5 已补：**规则 8 进出场不对称**、**规则 9 空间连续性**（含方向口径）
- [x] `DESIGN.md` §5 已登记**三项受控例外**：折叠用 `grid-template-rows`/`interpolate-size`、
      扫光 `background-position`、`.preview-panel` 的 `width` 过渡
- [x] `DESIGN.md` 的规则 1/2/4/5/7 已同步微调（消除与受控例外的自相矛盾）；
      §10.2 已修正「动效属性改造仍待后续」的矛盾
- [x] `docs/design-tokens-migration.md` 新增 §7（本期成果 + 两项保持现状的例外 + 待决策项）；
      「未纳入本轮」里的动效属性改造已标注完成
- [ ] **GUI 观感走查（需人工）**：① 工具详情/来源列表开合顺畅、不被裁切、收起无空壳；
      ② 各弹层从触发点生长（`+` 菜单、模型菜单、`provider-select` 下拉、`.cu-popover`）；
      ③ 折叠体退出比进入快（观感上"收起更利落"）；④ 拖拽 sash 跟手且松手后全屏切换仍有过渡
  - **受阻未完成**：`npm run dev` 三段构建成功、dev server 起在 5174，但 Electron 在沙箱内
    无显示环境、启动即退出，四项观感**无法目视**。
  - 已做的替代核对：折叠体基类 `height: 0` + `overflow: hidden` → 静态净占 0px；展开态
    `height: auto` + `max-height: 300px` + `overflow: auto`；21 处 `transform-origin` 与各自
    CSS 定位值逐一比对；三组折叠体「基类 `--dur-base` < `.open` `--dur-slow`」确认；
    拖拽属性的 set/remove 与 CSS 选择器名一致。
  - **待人工确认的清单**（写在 `docs/design-tokens-migration.md` §7）：重点是弹层 origin 方向观感、
    折叠体退出节奏、以及 `.tool-detail-box` 展开首帧（垂直 padding/margin 瞬时切值，
    同期 `opacity: 0→1` 掩盖，静态判断无可见跳变——这一条只有真机目视能最终确认）
