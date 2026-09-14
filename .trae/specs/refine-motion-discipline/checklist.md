# Checklist

> 检查时按 spec「明确不做」表：**列出的豁免项不应被改动**，改错了同样是缺陷。
> 本期为 `feat/ui-design-system` 分支第 2 期（承接 `apply-design-tokens-foundation`）。

## 折叠体过渡（只动合成属性）

- [ ] `.tool-detail-box` 的过渡里**不再有** `max-height` / `padding-top` / `padding-bottom` /
      `margin-top` / `margin-bottom` / `border-width`
- [ ] `.tool-source-list` 的过渡里**不再有** `max-height` / `margin-top` / `margin-bottom`
- [ ] 两处均改为 `grid-template-rows: 0fr ↔ 1fr`（与 `.metafold-body` 同手法）
- [ ] 两处仍保留 `opacity` / `transform` / `visibility` 过渡（不能只剩 grid）
- [ ] `.tool-detail-box` 收起态**没有残留空壳高度**（原 `max-height:0` 时代会留约 38px）
- [ ] `.tool-source-list` 展开后**仍限高且内部可滚动**（来源十几条时不撑破消息流）
- [ ] 横向内边距（原 `padding: 0 var(--space-5)`）已妥善迁移，内容未被 padding 挤压或裁切

## 弹层入场与空间连续性

- [ ] 盘点出的约 12 处弹层/模态/子菜单**都有入场过渡**（不再是瞬间出现）
- [ ] 入场只动 `transform` / `opacity`（无布局属性）
- [ ] 入场时长缓动取自 token（`--dur-base` + `--ease-out`）
- [ ] 每个弹层都配了 `transform-origin`，且**逐个在注释里写明了方向判断依据**
- [ ] 下方展开的菜单 origin 在 `top`；上方展开的在 `bottom`；向右飞出的子菜单在 `left center`；
      居中模态用 `center`
- [ ] **已有定位 transform 的弹层**（如 `.jump-to-bottom` 的 `translateX(-50%)`）在动画期间
      没有跑偏（keyframes/过渡里带上了原变换）

## 进出场不对称

- [ ] 折叠类过渡的**退出时长严格短于入场**（`--dur-slow` 入 → `--dur-base` 出、
      `--dur-base` 入 → `--dur-fast` 出）
- [ ] 未新增 token 档位（仍为 3 档时长）
- [ ] Task 1 改的两处折叠体也已纳入这套时长（不是只改了弹层）
- [ ] `--dur-fast` 档的过渡保持原样（已是最快档，无需再降）

## 合成动画替代 paint 动画（扫光）

- [ ] `@keyframes text-shimmer-sweep` 已删除（无 `background-position` 动画残留）
- [ ] 新扫光只动 `transform`
- [ ] 扫光的**周期仍为 2.2s linear infinite**（循环动画例外，不并入 3 档）
- [ ] 观感与改造前一致：扫光宽度、方向、亮度无明显差异
- [ ] 行内使用场景（如 `.task-agent-action.text-shimmer`）未被裁切文字（下伸部/斜体完好）
- [ ] `--shimmer-color` 局部变量仍被正确引用（3 处局部覆盖）

## 拖拽期停过渡

- [ ] `.preview-panel` 的 `width` 过渡**保留**（全屏切换需要它）
- [ ] 拖拽期间有禁用过渡的机制（`.dragging` 类或 `data-dragging` 属性）
- [ ] 拖拽时面板宽度**即时跟手**（无 200ms 迟滞）
- [ ] 松手后全屏切换仍有过渡

## 豁免项未被误改

- [ ] `.metafold-body` 的 `grid-template-rows` 折叠**未改动**（它已是正确做法）
- [ ] `.widget-frame` 的 `height` 过渡**未改动**（iframe 内容自适应必需，已有 100ms 防抖）
- [ ] `.stream` 入场的 `cubic-bezier(0.34, 1.56, 0.64, 1)` 回弹缓动**未改动**
- [ ] 存量局部 `prefers-reduced-motion` 块**未被删除**（它们还做了把某动画整个 `animation: none` 的事）
- [ ] 三方内容（widget iframe 内）的动效未被触碰

## 无回归与文档

- [ ] `npm run typecheck` 通过
- [ ] `npm run check:deps` 通过
- [ ] `npm run check:tokens` 通过（真违例仍为 0，未因本期上升）
- [ ] `npm test` 全绿（基线 95 文件 / 1711 用例）
- [ ] **未改动任何视觉值**（颜色/间距/圆角/阴影/字号零 diff，本期只动过渡与动画）
- [ ] `DESIGN.md` §5 已补：进出场不对称、空间连续性两条规则
- [ ] `DESIGN.md` 已明确 `grid-template-rows` 折叠为**受控例外**（避免后续误判违规）
- [ ] `docs/design-tokens-migration.md` 的「未纳入本轮」已移除动效属性改造（已完成）
- [ ] **GUI 观感走查（需人工）**：① 工具详情/来源列表开合顺畅不被裁切；
      ② 各弹层从触发点生长（`+` 菜单、模型菜单、向右飞出的子菜单）；
      ③ 折叠体退出比进入快；④ 流式扫光与改造前观感一致
