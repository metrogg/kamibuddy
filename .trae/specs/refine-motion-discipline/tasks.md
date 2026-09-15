# Tasks

> **执行约束：Task 1–4 都改 `src/renderer/index.css`（单文件），必须串行执行**
> （并行会让两个 agent 互相覆盖——上一期 `chat-view.tsx` 吃过这个亏）。
> Task 4 额外改 `artifact-panel.tsx`。

- [x] Task 1: 折叠体过渡改造（`index.css`）
  - [x] SubTask 1.1: **先复核现状**——`.metafold-body`（约 1874–1892 行）已是正确手法
    （`grid-template-rows: 0fr↔1fr` + `opacity` + `transform` + `visibility`），本次**不动它**，
    把它当作改造 `.tool-detail-box` / `.tool-source-list` 的参照样式
  - [x] SubTask 1.2: 改 `.tool-detail-box`（约 2527–2548 行）：**采用 `interpolate-size: allow-keywords`
    + `height: 0 → auto`**（理由见 SubTask 1.5），删掉 `max-height` / `padding-top` /
    `padding-bottom` / `margin-top` / `margin-bottom` / `border-width` 六项过渡
    （它们是为配合 `max-height: 0` 而设的「垂直全部归零」hack，改用 `height` 后不再需要），
    保留 `opacity` / `transform` / `visibility` 与 `translateY(-6px)`。
    展开态 = `height: auto`，并与既有 `max-height: 300px` + `overflow: auto` 共存（内容超高时滚动）
  - [x] SubTask 1.3: 改 `.tool-source-list`（约 3125–3149 行）：同上方案；
    **必须保留**展开后的 `max-height: 300px; overflow: auto`（来源可能十几条，需内部滚动）
  - [x] SubTask 1.5: **方案说明（为什么不用 `grid-template-rows`）**：`.metafold-body` 能用 grid
    的前提是它有内层包裹元素 `.metafold-body-inner`（`min-height: 0; overflow: hidden`）——
    grid 直接子项默认 `min-height: auto`，不设就折不下去。而 `.tool-detail-box` 是**单个 `<pre>`**、
    `.tool-source-list` 也没有内层，加内层要改 `chat-view.tsx` 三处 DOM（`.tool-detail-box`
    还被 `.todo-list-box` 复用，见 chat-view.tsx:639），风险大于收益。
    且 `.metafold-body` 的注释本身就写着「WorkBuddy 用 interpolate-size（Chromium 129+），
    0fr↔1fr 是同等效果的宽兼容写法」——本项目固定 Electron 44（内核远高于 129），不必迁就旧内核。
    两者都达到本期核心目标：**把 6 个布局属性过渡压到 1 个**
  - [x] SubTask 1.4: 验证：`npm run typecheck` + `npm test` + `npm run check:tokens`（违例不应上升）；
    确认工具详情/来源列表仍能正常展开收起、内容不被裁切（dev 或代码层复核）
  - **实测结果**：两处改用 `interpolate-size: allow-keywords` + `height: 0↔auto`；过渡属性从
    **12 项降到 4 项**（布局属性只剩 `height` 一项）；入场 `--dur-slow`(280ms) / 退出 `--dur-base`(200ms)。
    用 Electron 44 真实布局探针做 A/B 实测：收起态净占 **0px**（无空壳）、展开态 `max-height: 300px`
    + 内部滚动保留、`getComputedStyle().interpolateSize` 确认生效、展开时确实创建了 `height` 的
    CSSTransition（证明 `height: 0↔auto` 可插值）。`check:tokens` 真违例 **0**、`npm test` 95/1711 全绿。
  - **补充发现**：`.tool-detail-box` 实为 **3 处**复用（`chat-view.tsx:558` `<pre>`、`:639`
    `.todo-list-box`、`task-agent-card.tsx:167` `.task-agent-box`），选择器级规则三处通用；
    旧注释里「~38px 空壳」在 HEAD 上不可复现（基类早已把垂直 padding/margin/border 归零），
    已把注释改为机制描述而非复述该数字

- [x] Task 2: 弹层入场 + 空间连续性 + 进出场不对称（`index.css`）
  - [x] SubTask 2.1: **逐个盘点要接入场的弹层**（实现时先 grep 确认，不要漏）：`.pop-menu`
    （plus/model/permission/mode/space 五菜单共用）、`.ws-popover`、`.provider-select-panel`、
    `.permission-card`（模态）、`.ex-modal`、`.settings-card`、`.mcp-form-card`、`.add-model-card`、
    `.cu-popover`、`.preview-menu`、子菜单（`.mode-menu-sub` / `.plus-menu-sub` /
    `.model-menu-levels`）
  - [x] SubTask 2.2: 给定一个统一入场：`opacity: 0 → 1` + `transform: translateY(4px) → 0` +
    `scale(.98) → 1`，时长 `var(--dur-base)`、缓动 `var(--ease-out)`。
    **只动 transform/opacity**。注意与既有 `transform` 的冲突：**若该弹层已有 `transform`
    用于定位**（如 `.jump-to-bottom` 的 `translateX(-50%)`），必须在 keyframes 里带上原变换，
    否则动画期间会跑偏（`.jump-to-bottom` 的注释就是这个坑的记录）
  - [x] SubTask 2.3: 加 `transform-origin` 对齐触发位置（空间连续性）。逐个判断弹层相对其
    触发按钮的方向：
    - 在触发按钮**下方**展开 → `transform-origin: top` + 水平方向按按钮的左右（`top left` / `top center`）
    - 在触发按钮**上方**展开 → `bottom ...`
    - **向右飞出**的子菜单（`.plus-menu-sub` / `.mode-menu-sub`）→ `left center`
    - 模态/居中卡片（`.permission-card` / `.ex-modal` / `.settings-card`）→ `center`（不强行对齐触发点）
    把每个弹层的判断与依据写进 CSS 注释
  - [x] SubTask 2.4: **进出场不对称**——梳理全站过渡，把「同一时长来回」改为「退出降一档」：
    基类（收起/退出态）写 `--dur-fast` 或 `--dur-base`，激活类（`.open` / `[data-visible="true"]`）
    写入场时长。
    映射：`--dur-slow`(280) 入场 → `--dur-base`(200) 退出；`--dur-base`(200) → `--dur-fast`(150)；
    `--dur-fast`(150) → 保持（已是最快档）。**不新增 token 档位**。
    注意 SubTask 1.2/1.3 刚改的两处折叠体也要一并纳入这套时长
  - [x] SubTask 2.5: 确认 reduced-motion 兼容：上一期已加**全局兜底块**（把 `animation-duration` /
    `transition-duration` 压到 `.01ms`），新加入场不需额外局部块；但**若用 `animation` 而非
    `transition` 实现入场**，要确认全局块覆盖到了（它同时管 `animation-duration`）
  - [x] SubTask 2.6: 验证：`npm run typecheck` + `npm test` + `npm run check:tokens`；
    逐个打开弹层确认入场方向正确（或代码层复核 `transform-origin` 与 `transform` 组合）
  - **实测结果**：实际盘点出 **22 处**（我列 12 处 + 实现方 grep 补出 `.auto-form-card`、
    `.mcp-editor-card`、`.save-space-card`、`.ac-menu`、`.ex-modal-mask`）。
    统一 `@keyframes pop-layer-in`（opacity + translateY(4px) + `scale(.98)`）+ 背板
    `@keyframes backdrop-in`（只 opacity），**全部用 `animation`**（条件挂载元素 transition 无起跳点，
    这是关键判断）。逐处配 `transform-origin` 并把定位依据写进注释（21 处）。
    22 处基类均无定位 `transform`，不存在 `.jump-to-bottom` 那类跑偏坑。
    时长拆分：`.metafold-body`（双向 `--dur-slow` → 退出 `--dur-base`/入场 `--dur-slow`）、
    `.stream-fade`、`.entry-toolbar` 三处。`check:tokens` 真违例 **0**、`npm test` 95/1711 全绿。
  - **实现方纠正了我 spec 的一处错误**：`.mode-menu-sub` 实际是 `right: calc(100% + 4px)`
    → **向左飞出**，origin 应为 `right top` 而非我写的 `left center`（块内原注释也写着
    "向右飞会溢出窗口被裁掉，只能向左飞"）。**已采纳其判断。**
  - **待决策（未在本期处理）**：`.mode-menu-sub` 经 grep 确认**无任何 TSX 引用**（模式子菜单
    在专家正交化那期已删除），属**死 CSS**；本轮按清单补齐了动画并注释标明，**是否删除留待后续清理**。
  - **待确认（4px 级取整）**：`.plus-menu-sub` 的垂直锚点实为父项底边（`bottom: -4px`），
    `left center` 是取整近似，更精确应为 `left bottom`；差异极小，未再改。

- [x] Task 3: 扫光改造 —— **经技术评估后决定保持现状**（结论见下，无代码改动）
  - [x] SubTask 3.1: 复核现状：`@keyframes text-shimmer-sweep`（现 1487–1495 行）动画
    `background-position: 200% → -200%`，配合 `.text-shimmer` 的 `background-clip: text`，
    视觉效果是「亮带扫过**文字本身**（文字明暗流动）」。用法在 **8 处行内 `<span>`**
    （`chat-view.tsx` ×6、`task-agent-card.tsx` ×2），且有 2 处覆盖 `--shimmer-color`
  - [x] SubTask 3.2（评估）：**spec 原定的「伪元素遮罩 + `translateX` 等价复刻」不可行**——
    三条硬约束：① 伪元素拿不到文字内容，而"文字明暗流动"必须以**文字形状**为裁剪源
    （`background-clip: text`）；② 若给伪元素加 `content: attr(data-text)` 复制文字，
    仍需用 `mask-position` 移动遮罩——它与 `background-position` 同类，都**不是合成属性**；
    ③ 任何"在文字上盖扫光层"的方案都要求容器可裁剪（`overflow: hidden`），而行内 `<span>`
    不是块容器，改 `display: inline-block` 会影响行内排版与基线对齐，风险大于收益
  - [x] SubTask 3.3（收益复核）：**预期收益不成立**——① 重绘面积仅限该文字区域（一行或几个字，
    非整屏）；② Chromium 对 `background-position` 在符合条件的元素上有合成优化，现状可能
    已非纯 paint；③ `prefers-reduced-motion` 下已退化为静态文字（既有局部块在管）
  - [x] SubTask 3.4: **决定：保持现状**。把上述结论写进 `index.css` 该块注释（避免后人重复尝试），
    并在 `DESIGN.md` §5 把「`:text-shimmer` 的 `background-position` 扫光」登记为**受控例外**（附理由）
  - 结论：本任务**除注释外无代码改动**；`check:tokens` 真违例 0、`npm test` 95/1711 不受影响。
    这是**如实上报「做不到视觉等价 + 合成属性」**，而非静默跳过

- [x] Task 4: 拖拽期停过渡（`index.css` + `artifact-panel.tsx`）
  - [x] SubTask 4.1: `.preview-panel` 的 `transition: width var(--dur-base) ease`（约 3192 行）
    保留（全屏切换需要），但 sash 拖拽期间要禁用
  - [x] SubTask 4.2: 在 `artifact-panel.tsx` 的拖拽起点与终点给面板容器加/去一个标记
    （如 `.dragging` 类或 `data-dragging` 属性）
  - [x] SubTask 4.3: `index.css` 加 `.preview-panel.dragging { transition: none; }`（或属性选择器等价写法）
  - [x] SubTask 4.4: 验证：`npm run typecheck` + `npm test`；
    确认拖拽跟手（无 200ms 迟滞）、松手后全屏切换仍有过渡
  - **实测结果**：采用**方案 B**（面板容器 `ref` + `data-dragging` 属性，而非 body 全局属性）。
    `artifact-panel.tsx` 加 4 行（`panelRef` + 拖拽起止 set/removeAttribute + `<aside ref>`），
    `index.css` 加 `.preview-panel[data-dragging="true"] { transition: none; }`。
    **键盘调宽（`handleSashKeyDown`）保持过渡未动**（离散 ±10px，带过渡更顺）。
    清理路径：`removeAttribute` 与 `removeEventListener`/cursor 复位同函数，无窗口；
    面板卸载时属性随 DOM 节点消失，无残留。`check:tokens` 真违例 0、`npm test` 95/1711 全绿。

- [x] Task 5: 校验与文档
  - [x] SubTask 5.1: `npm run typecheck && npm run check:deps && npm run check:tokens` 三项通过
    （`check:tokens` 真违例必须仍为 0，不得因本期改动上升）
  - [x] SubTask 5.2: `npm test` 全绿（基线 95 文件 / 1711 用例）
  - [x] SubTask 5.3: 在 `DESIGN.md` §5 动效规范补两条：① 进出场不对称（退出 = 入场约 70%，
    用降一档表达，不新增档位）；② 空间连续性（弹层 `transform-origin` 对齐触发点）。
    并在 §5 的禁止清单里明确 `grid-template-rows` 折叠为**受控例外**
    （`height: auto` 的唯一可靠替代），避免后续误判为违规
  - [x] SubTask 5.4: **GUI 观感走查（需人工）**：dev 起应用，逐个确认
    ① 工具详情/来源列表开合顺畅且不被裁切；② 各弹层从触发点生长（尤其 `+` 菜单、模型菜单、
    子菜单向右飞出）；③ 折叠体退出比进入快；④ 流式扫光观感与改造前一致
  - [x] SubTask 5.5: 更新 `docs/design-tokens-migration.md` 的"未纳入本轮"一节，
    把动效属性改造从待办中移除（已由本期完成）
  - **实测结果**：五项命令全绿（`check` 三段串联通过）；`check:tokens` 真违例 **0**（未塞白名单）。
    `DESIGN.md` §5 新增**规则 8 进出场不对称**、**规则 9 空间连续性**，并登记**三项受控例外**
    （折叠用 `grid-template-rows`/`interpolate-size`、扫光 `background-position`、
    `.preview-panel` 的 `width` 过渡）；同步微调规则 1/2/4/5/7 消除自相矛盾；
    修正 §10.2「动效属性改造仍待后续」与本期已完成的矛盾。
    `docs/design-tokens-migration.md` 新增 §7（本期成果 + 两项保持现状的例外 + 待决策项）。
    `index.css` 的 `.text-shimmer` 块补了「为什么保持 `background-position`」注释（Task 3.4 落地）。
  - **GUI 走查受阻**：`npm run dev` 三段构建成功（dev server 起在 5174），但 Electron 在本沙箱
    无显示环境、启动即退出，**四项观感无法目视**。已做逐项静态核对（折叠体 `height:0` 净占 0px +
    展开态限高内滚；21 处 `transform-origin` 与定位方向逐一比对；三组折叠体退出 `--dur-base` <
    入场 `--dur-slow`；拖拽属性 set/remove 与 CSS 规则名一致）——**真实观感仍需人工确认**
  - **未决（留后续）**：`.mode-menu-sub` 死 CSS 是否删除；`.plus-menu-sub` 的 `left center`
    为 4px 级取整近似（更精确应 `left bottom`）

# Task Dependencies

- Task 1 / 2 / 3 / 4 **全部改 `src/renderer/index.css`，必须严格串行**
- Task 2 的 SubTask 2.4（进出场不对称）会改到 Task 1 刚改的两处折叠体时长 —— 顺序不能反
  （先改结构，再统一时长）
- Task 4 额外改 `artifact-panel.tsx`，与 Task 1–3 无文件冲突但仍在同一串行链上（保守起见）
- Task 5 依赖 Task 1–4 全部完成
