# Tasks

> **执行约束：Task 1–4 都改 `src/renderer/index.css`（单文件），必须串行执行**
> （并行会让两个 agent 互相覆盖——上一期 `chat-view.tsx` 吃过这个亏）。
> Task 4 额外改 `artifact-panel.tsx`。

- [ ] Task 1: 折叠体过渡改造（`index.css`）
  - [ ] SubTask 1.1: **先复核现状**——`.metafold-body`（约 1874–1892 行）已是正确手法
    （`grid-template-rows: 0fr↔1fr` + `opacity` + `transform` + `visibility`），本次**不动它**，
    把它当作改造 `.tool-detail-box` / `.tool-source-list` 的参照样式
  - [ ] SubTask 1.2: 改 `.tool-detail-box`（约 2527–2548 行）：删掉 `max-height` / `padding-top` /
    `padding-bottom` / `margin-top` / `margin-bottom` / `border-width` 六个属性的过渡，
    改为 `display: grid` + `grid-template-rows: 0fr`（基类=收起）+ `grid-template-rows: 1fr`（`.open`），
    保留 `opacity` / `transform` / `visibility` 过渡与 `translateY(-6px)`
    - **注意**：现在靠 `padding: 0 var(--space-5)` 表达横向内边距、收起时纵向全部归零；
      改 grid 后横向 padding 要挪到内层包裹元素上（否则 grid 子项宽度会被 padding 挤压），
      或改用 `.tool-detail-box > *` 承受 padding。**实现时确认收起态没有留下空壳高度**
      （原注释记录过 `max-height:0` 会留 ~38px 空壳的坑）
  - [ ] SubTask 1.3: 改 `.tool-source-list`（约 3125–3149 行）：同样改为 grid 折叠；
    **必须保留**展开后的 `max-height: 300px; overflow: auto`（来源可能十几条，需要内部滚动）
    ——建议把限高与滚动放在内层包裹元素上，外层只管折叠
  - [ ] SubTask 1.4: 验证：`npm run typecheck` + `npm test` + `npm run check:tokens`（违例不应上升）；
    确认工具详情/来源列表仍能正常展开收起、内容不被裁切（dev 或代码层复核）

- [ ] Task 2: 弹层入场 + 空间连续性 + 进出场不对称（`index.css`）
  - [ ] SubTask 2.1: **逐个盘点要接入场的弹层**（实现时先 grep 确认，不要漏）：`.pop-menu`
    （plus/model/permission/mode/space 五菜单共用）、`.ws-popover`、`.provider-select-panel`、
    `.permission-card`（模态）、`.ex-modal`、`.settings-card`、`.mcp-form-card`、`.add-model-card`、
    `.cu-popover`、`.preview-menu`、子菜单（`.mode-menu-sub` / `.plus-menu-sub` /
    `.model-menu-levels`）
  - [ ] SubTask 2.2: 给定一个统一入场：`opacity: 0 → 1` + `transform: translateY(4px) → 0` +
    `scale(.98) → 1`，时长 `var(--dur-base)`、缓动 `var(--ease-out)`。
    **只动 transform/opacity**。注意与既有 `transform` 的冲突：**若该弹层已有 `transform`
    用于定位**（如 `.jump-to-bottom` 的 `translateX(-50%)`），必须在 keyframes 里带上原变换，
    否则动画期间会跑偏（`.jump-to-bottom` 的注释就是这个坑的记录）
  - [ ] SubTask 2.3: 加 `transform-origin` 对齐触发位置（空间连续性）。逐个判断弹层相对其
    触发按钮的方向：
    - 在触发按钮**下方**展开 → `transform-origin: top` + 水平方向按按钮的左右（`top left` / `top center`）
    - 在触发按钮**上方**展开 → `bottom ...`
    - **向右飞出**的子菜单（`.plus-menu-sub` / `.mode-menu-sub`）→ `left center`
    - 模态/居中卡片（`.permission-card` / `.ex-modal` / `.settings-card`）→ `center`（不强行对齐触发点）
    把每个弹层的判断与依据写进 CSS 注释
  - [ ] SubTask 2.4: **进出场不对称**——梳理全站过渡，把「同一时长来回」改为「退出降一档」：
    基类（收起/退出态）写 `--dur-fast` 或 `--dur-base`，激活类（`.open` / `[data-visible="true"]`）
    写入场时长。
    映射：`--dur-slow`(280) 入场 → `--dur-base`(200) 退出；`--dur-base`(200) → `--dur-fast`(150)；
    `--dur-fast`(150) → 保持（已是最快档）。**不新增 token 档位**。
    注意 SubTask 1.2/1.3 刚改的两处折叠体也要一并纳入这套时长
  - [ ] SubTask 2.5: 确认 reduced-motion 兼容：上一期已加**全局兜底块**（把 `animation-duration` /
    `transition-duration` 压到 `.01ms`），新加入场不需额外局部块；但**若用 `animation` 而非
    `transition` 实现入场**，要确认全局块覆盖到了（它同时管 `animation-duration`）
  - [ ] SubTask 2.6: 验证：`npm run typecheck` + `npm test` + `npm run check:tokens`；
    逐个打开弹层确认入场方向正确（或代码层复核 `transform-origin` 与 `transform` 组合）

- [ ] Task 3: 扫光改伪元素 + translateX（`index.css`）
  - [ ] SubTask 3.1: 现状：`@keyframes text-shimmer-sweep`（约 1474 行）动画 `background-position`
    `200% → -200%`，配合 `.text-shimmer` 的 `background-clip: text` → **每帧重绘整段文字**。
    它在流式期间常驻（工具状态字、等待行、思考标题、`task-agent-action`）
  - [ ] SubTask 3.2: 改为「伪元素遮罩 + `transform: translateX` 扫过」：`.text-shimmer` 保持
    文字本身不变（或保留静态渐变底），用 `::after` 画一条扫光带并动画其 `translateX`。
    **视觉观感必须与改造前一致**（同样的扫光宽度、速度 `2.2s`、方向、亮度）。
    注意：`.text-shimmer` 被用在多处，且部分场景是**行内文字**（如 `.task-agent-action.text-shimmer`）
    —— 伪元素方案要确认 `position` 与 `overflow` 在这些上下文里成立（必要时给基类加
    `position: relative; overflow: hidden`，但要确认不会裁掉文字的下伸部/斜体）
  - [ ] SubTask 3.3: 删掉旧 `@keyframes text-shimmer-sweep`，新增扫光 keyframes（只动 transform）；
    更新相关注释（说明为什么不用 background-position）
  - [ ] SubTask 3.4: 验证：`npm run check:tokens`（不应引入新硬编码）；
    确认 `--shimmer-color` 局部变量仍被正确引用（它在 3 处局部覆盖）

- [ ] Task 4: 拖拽期停过渡（`index.css` + `artifact-panel.tsx`）
  - [ ] SubTask 4.1: `.preview-panel` 的 `transition: width var(--dur-base) ease`（约 3192 行）
    保留（全屏切换需要），但 sash 拖拽期间要禁用
  - [ ] SubTask 4.2: 在 `artifact-panel.tsx` 的拖拽起点与终点给面板容器加/去一个标记
    （如 `.dragging` 类或 `data-dragging` 属性）
  - [ ] SubTask 4.3: `index.css` 加 `.preview-panel.dragging { transition: none; }`（或属性选择器等价写法）
  - [ ] SubTask 4.4: 验证：`npm run typecheck` + `npm test`；
    确认拖拽跟手（无 200ms 迟滞）、松手后全屏切换仍有过渡

- [ ] Task 5: 校验与文档
  - [ ] SubTask 5.1: `npm run typecheck && npm run check:deps && npm run check:tokens` 三项通过
    （`check:tokens` 真违例必须仍为 0，不得因本期改动上升）
  - [ ] SubTask 5.2: `npm test` 全绿（基线 95 文件 / 1711 用例）
  - [ ] SubTask 5.3: 在 `DESIGN.md` §5 动效规范补两条：① 进出场不对称（退出 = 入场约 70%，
    用降一档表达，不新增档位）；② 空间连续性（弹层 `transform-origin` 对齐触发点）。
    并在 §5 的禁止清单里明确 `grid-template-rows` 折叠为**受控例外**
    （`height: auto` 的唯一可靠替代），避免后续误判为违规
  - [ ] SubTask 5.4: **GUI 观感走查（需人工）**：dev 起应用，逐个确认
    ① 工具详情/来源列表开合顺畅且不被裁切；② 各弹层从触发点生长（尤其 `+` 菜单、模型菜单、
    子菜单向右飞出）；③ 折叠体退出比进入快；④ 流式扫光观感与改造前一致
  - [ ] SubTask 5.5: 更新 `docs/design-tokens-migration.md` 的"未纳入本轮"一节，
    把动效属性改造从待办中移除（已由本期完成）

# Task Dependencies

- Task 1 / 2 / 3 / 4 **全部改 `src/renderer/index.css`，必须严格串行**
- Task 2 的 SubTask 2.4（进出场不对称）会改到 Task 1 刚改的两处折叠体时长 —— 顺序不能反
  （先改结构，再统一时长）
- Task 4 额外改 `artifact-panel.tsx`，与 Task 1–3 无文件冲突但仍在同一串行链上（保守起见）
- Task 5 依赖 Task 1–4 全部完成
