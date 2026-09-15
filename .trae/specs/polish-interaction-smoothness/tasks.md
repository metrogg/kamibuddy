# Tasks

> **并行度**：Task 1（`index.css` + `tokens.css`）与 Task 2（`state-views.tsx` + 预览组件 + `sidebar.tsx`）
> 文件不重叠，**可并行**；Task 3 与 Task 1 都碰 `index.css`、Task 4 与 Task 3 都碰
> `index.css` / `chat-view.tsx` / `App.tsx` → **Task 3、4 必须串行**；Task 5 收尾。
>
> **基线（本期开始前）**：`npm run check` 通过、`npm test` 95 文件 / 1717 用例全绿、
> `check:tokens` 真违例 0。
>
> **⚠️ 全局约束**：`AGENTS.md` §7 要求「任何界面改动前必须先读 `DESIGN.md`；不得引入新的硬编码视觉值」。
> 本期的所有新增样式值必须走 `tokens.css`（或复用既有档位）；`check:tokens` 真违例必须保持 0。

- [x] Task 1: 接线 MiSans 字体（**账目错误修复，最高优先级**）
  - [ ] SubTask 1.1: 先读 `resources/fonts/README.md`（它写了预期做法）与
    `src/renderer/fonts/` 下的实际文件，确认文件名与字重对应
  - [ ] SubTask 1.2: 在 `src/renderer/index.css` **顶部**（**注意：`@import` 必须在最前**，
    见该文件第 9 行；`@font-face` 放在 `@import` **之后**）声明两条 `@font-face`：
    `400`（MiSans-Regular）与 `600`（MiSans-Semibold），`font-display: swap`，
    `src: url("./fonts/MiSans-*.woff2") format("woff2")`。
    **路径要与 renderer 的构建方式核对**（`electron.vite.config.ts` 没有 `publicDir`，
    需要确认 `url()` 相对路径能被 vite 处理并进产物）
  - [ ] SubTask 1.3: **字体栈收敛到一处**：`src/styles/tokens.css:153` 的 `--font-body` 是唯一真源，
    把 `"MiSans"` 插到 `"PingFang SC"` **之后**、`"Segoe UI"` **之前**；
    `index.css:58-66` 的 body 改为引用 `var(--font-body)`（不再各写一份栈）
  - [ ] SubTask 1.4: **验证字体真的生效**（这一步不能省）：
    ① `npm run build` 后确认产物里**包含**这两个 woff2（在此之前它们是死文件）；
    ② 用 Electron 探针（可参考第 3/5 期用过的离屏窗口手法）确认
    `document.fonts.check('600 14px MiSans')` 或等价的 `getComputedStyle`/`document.fonts` 结果；
    ③ 若 vite 无法处理该 `url()` 路径，报告并给出方案（如移到 `publicDir` 或改用
    `new URL(..., import.meta.url)`），**不要留下"声明了但不生效"的状态**
  - [ ] SubTask 1.5: 验证：`npm run check`（含 `check:tokens`）+ `npm test`

- [x] Task 2: 骨架屏组件 + 两处接线（可并行）
  - [ ] SubTask 2.1: 在 `src/renderer/state-views.tsx` 新增具名导出 `Skeleton`
    （props：`width` / `height` / `radius`，均有合理默认；底色走 token，如 `--bg-raised`）。
    **不带扫光/脉冲动画**——理由写进注释（避免与 `.text-shimmer` 的"进行中"语义混淆，
    且 `prefers-reduced-motion` 下零损失）
  - [ ] SubTask 2.2: **侧栏任务列表**（`sidebar.tsx` 约 `:590` 的 `<LoadingState />`）：
    换成 3–5 条骨架，**行高必须与 `.task-item-body`（`index.css:361-368`）严格对齐**，
    否则列表到达时会有竖向跳动（这是"骨架屏要同尺寸"的核心）
  - [ ] SubTask 2.3: **文档预览**（4 处）：
    `office-docx.tsx:76`、`office-xlsx.tsx:153`、`pdf-preview.tsx:177`、
    `office-preview.tsx:62`（`Suspense fallback`）——这些是**形状完全可预知**的"白纸"，
    换成按纸张比例排布的骨架（灰块 + 几行文字条）。**先读这几处的容器结构**，
    骨架要放在同样的位置与宽度约束下
  - [ ] SubTask 2.4: 验证：`npm run check` + `npm test`；报告 2.2 的骨架行高与
    `.task-item-body` 的实测对齐依据

- [x] Task 3: 布局稳定 + 视图入场 + 侧栏过渡（依赖 Task 1）
  - [ ] SubTask 3.1: **`scrollbar-gutter: stable`** —— 给这 5 个主滚动容器加：
    `.stream`（`index.css:1563-1566`）、`.home`（`:662-667`）、`.settings-body` / `.skills-body`
    （`:4231-4239`）、`.sidebar-scroll`（`:186-193`）。
    **不要**加到 `.thinking-body` / `.user-bubble` / `.pop-menu` 这类宽度紧张的容器上
    （常驻 gutter 反而白占位）——把这条判断写进注释
  - [ ] SubTask 3.2: **消除 hover 让位抖动**：`index.css:370-372`
    （`.task-item:hover .task-item-body{padding-right:72px}`）与 `:532-535`
    （空间组头 `48px`）——把让位宽度**常驻**，只让操作钮做 `opacity/visibility` 过渡
    （`.task-item-ops` 本来就是 `absolute`，`index.css:409`，常驻 padding 无视觉代价）
  - [ ] SubTask 3.3: **整页视图入场**：`.settings` / `.skills`（`index.css:4198-4205`，
    被 `stats`/`skills`/`diagnostics`/`automations` 共用）加一条与 `.settings-card` **同族**的入场
    （`transform` + `opacity`，时长取 token）。**一条规则覆盖 4 个视图，不要逐视图各写一份**。
    首页（`.home`）与对话页按同口径补齐整壳入场
  - [ ] SubTask 3.4: **侧栏折叠过渡**（**用户已拍板**）：`App.tsx:1187-1211` 的
    `{sidebarOpen && <Sidebar/>}` + `.sidebar`（`index.css:112-122` 的 `flex: 0 0 216px`）。
    ⚠️ **这里有个坑要先想清楚**：现在是**条件挂载**，元素挂载即终态、**CSS transition 不会触发**
    （第 2 期在弹层上踩过同一个坑）。所以要么改为"常驻 DOM + 类切换"，
    要么用 `animation` 实现（但展开方向能动画、收起方向会随卸载消失）。
    **先读 App.tsx 的现有结构再决定**，把选择与理由写进注释。
    时长 `--dur-base` 量级；**不改让位语义**（主区仍被挤压，不做浮层覆盖）
  - [ ] SubTask 3.5: **同步 `DESIGN.md` §5.1**：登记**第二条 width 受控例外**——侧栏折叠
    （第一条是 `.preview-panel` 的全屏切换）。写明理由：折叠是"让位"语义，
    该效果无法用 `transform` 表达；接受折叠期间约 12 帧布局重排的代价
  - [ ] SubTask 3.6: 用户气泡图片占位比例（`chat-view.tsx:266` 写死 `width={160} height={200}`，
    CSS 在 `index.css:2007-2013`）：横图（16:9）解码后高度会从 200 掉到约 90 → 气泡收缩、
    下方内容上移。**二选一并说明理由**：读取真实 `naturalWidth/Height` 后按比例写 `aspect-ratio`，
    或统一给缩略图定高（纯裁切，永不位移）
  - [ ] SubTask 3.7: 验证：`npm run check` + `npm test`；
    报告 3.4 的条件挂载怎么解决的、3.6 选了哪个方案

- [x] Task 4: 交互细节（依赖 Task 3，因同样碰 `index.css` / `chat-view.tsx` / `App.tsx`）
  - [ ] SubTask 4.1: **IME 守卫**：`autocomplete.tsx:132-139` 的 `onChange` 加 composition 守卫。
    **抄 `experts-view.tsx:68-79` 的 `composingRef` 写法**（同仓既有先例，不另造机制）——
    组合期间不重算候选，或在 `compositionend` 一次性算
  - [ ] SubTask 4.2: **流式贴底改 `useLayoutEffect`**：`chat-view.tsx:1543-1561` 的
    `useEffect` 负责 `node.scrollTop = node.scrollHeight`（被动效果对 IPC 流式 delta 可能在
    **绘制后**才冲刷 → 理论上有"内容已长高、scrollTop 未跟上"的一帧）。
    改为 `useLayoutEffect` 与 `turn-rail.tsx:45` 的口径统一，**然后实测确认**：
    若无可感差异，报告并保留 `useEffect` 连同理由
  - [ ] SubTask 4.3: **收敛 `.stream` 的 reveal**（`index.css:1572-1593`）：
    现在每次从首页/设置/统计返回对话页都会重跑整列 `opacity 0→1` + `translateY(10px→0)`（280ms 回弹），
    对长历史是可见的整列上滑且为整个子树建合成层。**限定为"从空到有内容"的首次揭示**
    （如只在 entries 从 0 变非 0 时置一个 class），或降为 `opacity` 单属性 + `--dur-base`
  - [ ] SubTask 4.4: **resize 期间停面板宽度过渡**：`App.tsx:601-606` 的 resize 监听会调
    `setPanelWidth`，而 `.preview-panel` 带 `transition: width`（`index.css:3294`）→ 拖窗口边缘触到
    clamp 阈值时面板会"追"上去。**复用既有的 `[data-dragging="true"]{transition:none}` 手法**
    （`:3302-3304`）加一个 resize 期间的等价标记。**不要去掉了过渡**（全屏切换依赖它）
  - [ ] SubTask 4.5: `::selection` 用中性色（现在走 Chromium 默认蓝，是全站唯一"外来色"；
    建议 `color-mix(in srgb, var(--text) 14%, transparent)` 之类，**不新增档位**）。
    注意在深色底（`--bg-sidebar`）上的可读性
  - [ ] SubTask 4.6: `.settings-card` 阴影从 `--shadow-md`（`index.css:4254`）提到 `--shadow-lg`
    （与同级的 `.permission-card` `:5590` 一致——两个同为居中模态，抬升感应相同）
  - [ ] SubTask 4.7: 验证：`npm run check` + `npm test`；报告 4.2 的实测结论、
    4.3 选了什么收敛方式

- [ ] Task 5: 校验与文档
  - [ ] SubTask 5.1: `npm run typecheck && npm run check:deps && npm run check:tokens` 三项通过
    （`check:tokens` 真违例必须仍为 0）
  - [ ] SubTask 5.2: `npm test` 全绿（基线 95 文件 / 1717 用例）
  - [ ] SubTask 5.3: **`npm run build`** 并确认产物含 MiSans woff2（Task 1.4 的落地验证）
  - [ ] SubTask 5.4: 在 `DESIGN.md` 补/更新：§5.1 的 width 例外（Task 3.5 已写）；
    以及一条**字体约束**（界面字体唯一真源是 `--font-body`，新增字体必须走 `@font-face` + 该变量，
    不得就地写字体栈）
  - [ ] SubTask 5.5: 成果文档记本期（承接 `docs/design-tokens-migration.md` 的编号继续）：
    各项处置、**修正 `polish-ui-a11y-and-aesthetics` 的账目错误**（字体接线声称完成但未落地）、
    未做项与理由
  - [ ] SubTask 5.6: **人工验收清单**（沙箱无 GUI）：① Windows 上 600 字重是否不再发虚；
    ② 对话跨过一屏时是否还横向横移；③ 从首页切统计/技能/诊断/定时任务是否还有入场；
    ④ 侧栏首屏是否显示骨架且到达时不跳；⑤ 文档预览是否有"白纸感"；
    ⑥ 划过侧栏行标题省略号是否还跳；⑦ 中文打 `@` 检索菜单是否还抽搐；
    ⑧ 折叠侧栏是否平滑；⑨ 从设置返回长对话是否还整列上滑
  - [ ] SubTask 5.7: 报告本期**未做**项与理由（乐观更新不改、`overflow-anchor` 无需、
    阴影分级不做、tab 过渡/toast 退场/刻度轨过渡为打磨项、右键菜单属新增交互）

# Task Dependencies

- **第一轮（可并行）**：Task 1（`index.css` + `tokens.css`）、Task 2（`state-views.tsx` +
  4 个预览组件 + `sidebar.tsx`）—— 文件不重叠
- **第二轮**：Task 3（`index.css` + `chat-view.tsx` + `App.tsx` + `DESIGN.md`）—— 必须排在 Task 1 之后
- **第三轮**：Task 4（`index.css` + `chat-view.tsx` + `App.tsx` + `autocomplete.tsx`）
  —— 必须排在 Task 3 之后
- **第四轮**：Task 5 依赖 Task 1–4 全部完成
