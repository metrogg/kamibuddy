# 设计 Token 迁移与例外登记

> 对应 spec：`.trae/specs/apply-design-tokens-foundation/spec.md`（设计标准落地·地基），分支 `feat/ui-design-system`。
> 标准见 `DESIGN.md` §2；token 唯一真源 `src/styles/tokens.css`；机械校验 `npm run check:tokens`
> （白名单 `scripts/design-tokens-allowlist.json`）。
>
> 本文件的两件事：**记清收敛了什么**（映射表 + 归档统计 + 实质修复），
> **以及为什么有些值没收敛**（例外登记表 + 已知遗留）。例外不登记不允许存在。

---

## 1. 接线映射表

`index.css` 顶部 `@import "../styles/tokens.css"`，原 `index.css` 的 `:root`（56–120 行）已删除：
同名不同值（如 `--text-secondary` 的 .7 与 .5）会让 `var()` 结果取决于 import 顺序，是难查的隐性 bug。

### 1.1 改名（值不变）

| 迁移前 | 迁移后 | 说明 |
|---|---|---|
| `--text-dim` | `--text-secondary` | 名字废弃。旧体系里 `--text-secondary`(.7) 与 `--text-dim`(.5) 是「两个名字各占一档」的重复命名；本轮按语义收敛为 3 级文字色，`.7` 档并入次文 |
| `--shadow-card` | `--shadow-md` | 值不变（`0 6px 24px rgb(0 0 0 / 6%)`） |
| `--shadow-questionnaire` | `--shadow-sm` | 值不变（`0 6px 16px 2% + 0 1px 4px 3%`） |
| `--shadow-input` | **保留原名，不并入 md** | 场景例外：WB 输入卡阴影原值，语义归 md 档（内容承载层），但比 md 轻得多；拆成独立变量是为了引用点保留原值、不必在接线时改数值 |

全站改名后 `--text-dim` / `--shadow-card` / `--shadow-questionnaire` 已零命中（grep 验证）。

### 1.2 家族收敛

| 迁移前 | 迁移后 | 说明 |
|---|---|---|
| `--seg`（6 色） | `--cat-1..6` | `--seg-*` 的 6 个类改为 `--seg: var(--cat-N)` 转发（保留类名、只换取值） |
| `comp-*`（5 色，上下文成分条） | `--cat-*` | 三处色板（提示词分段 / 成分条 / 用量浮层）收敛为**一套**分类板 |
| `cu-seg-*`（4 色，用量浮层） | `--cat-*` | 同上 |
| `--shimmer-color`（裸字面值家族） | 保留类内局部变量，值改用 `var(--text-secondary)` | 不再是硬编码家族；扫光结构改造排 #3 动效 |
| iframe `--kw-*`（26 色） | **不动**，值对齐宿主 token | 跨上下文注入是独立问题，见 §3 例外表 |

`#d9822b` 与 `--warning` 撞值（分类色借用状态色会读成「出问题了」），已换相到 `--cat-5`（橙红 `#e06c3a`）。

### 1.3 遮罩与状态色收编

- 遮罩 5 档 → 1 档：`.modal-backdrop`(32%) 与 `.ex-modal-mask`(40%) 收归 `--overlay`(40%)；
  控件 scrim（55%/78%）与全屏看图沉浸遮罩（72%）语义不同，保留原值并登记例外（§3）。
- 与 token 等值的硬编码直接换 `var()`（`#f2f2f2`→`--bg-sidebar`、`#f7f7f7`→`--bg-raised`、
  `#e6e6e6`→`--border`、`#1470b4`→`--accent`、`#d9822b`→`--warning`、`#f64041`→`--danger`、
  `#0cbf5b`→`--ok`）；被 `color-mix` 覆盖的 3 行死硬编码（`#d7e8f6`/`#a8cdea`/`#5b9fd4`）已删除。

---

## 2. 归档统计

**统计口径**：对 `src/renderer/index.css` 做正则计数，取「迁移前 = `git show HEAD:src/renderer/index.css`」
与「迁移后 = 当前工作区文件」。正则会连带命中注释与 `color-mix()` 内的取色，因此是**近似但可复现**的口径，
用于看趋势与量级，不用于精确对账。（spec 的归档表按「声明行」人工统计，基数与下方略有出入，属口径差异。）

| 类别 | 迁移前 | 迁移后 | spec 计划 | 说明 |
|---|---|---|---|---|
| 字号（`font-size` 含 px） | 195 | **0** | 等值 156 直接换 `var()` + 档外 11 归档 | 全部走 token，`index.css` 中无档外字号 |
| 间距（padding/margin/gap 含 px） | 483 | **75** | 见 spec 间距表（1/3→2、5→4、7→6、9/10→8、14→12、18/20→16、22~30→24、36~44→32） | 余下为内置豁免（2px 亚间距 / ≥48px 页面留白 / 负值）+ 3 条白名单让位偏移 |
| 圆角（`border-radius` 含 px） | 58 | **28** | 8→sm/md、12→md/full、7→sm、50%→full | 余下为 1–5px 微圆角与 22/24px WB 原值 |
| 圆角（含 %） | 24 | **0** | 50%→`--radius-full` | 圆形/胶囊全部走 `--radius-full` |
| 时长（裸 ms/s） | 80 | **14** | 0.12~0.18→fast、0.2/0.24→base、0.28~0.32→slow | 余下为循环动画（0.8/1.1/2/2.2s）与 reduced-motion 的 0.01ms |
| z-index（裸数字） | 27 | **0** | 1/10/20/21/30/31/40/90/100 → 5 档 | 含 `.toast-stack` 100→`--z-toast`(200) 修正 |
| 颜色（hex/rgb/rgba/hsl） | 104 | **38** | 等值项换 `var()`、4 级文字收 3 级、遮罩 5 收 1、分类板 3 套收 1 | 余下为已登记例外（§3）；另 `color-mix` 内取色不计入违例 |
| `var(--…)` 引用点 | 876 | **1825** | — | 接线引用点翻倍，说明 token 真正被用起来了 |

**`npm run check:tokens` 现状**（Task 6 收官时）：

```
扫描 src/renderer/index.css + 48 个 *.tsx 文件。
真违例 0 处 / 白名单命中 77 处 / 豁免 105 处。
  豁免计数：圆角 29 / 间距 71 / 时长 5
✓ 硬编码视觉值检查通过（仅剩白名单例外与内置豁免）。
```

- **内置豁免 105 处**：由脚本按 spec 显式例外跳过（几何值、亚间距 2px、≥48px 页面留白、负值、
  1–5px 微圆角、22/24px WB 圆角、0/0.01ms、循环动画时长）。
- **白名单 77 处**：确实不归档、逐条写明理由的例外，见 §3。

---

## 3. 例外登记表

与 `scripts/design-tokens-allowlist.json` 一一对应（**共 37 条，覆盖 77 处**）。
匹配以 `snippet`（该行文本片段）为主、`line` 仅作兜底——行号会因无关改动整体漂移，锚行号等于随时失效。
白名单一条没命中会输出「未命中告警」（写歪了 / 代码已变要能被发现），但不阻断构建。

### 3.1 身份色板 / 品牌色（11 处）

| 位置 | 处数 | 语义 | 为何不归档 |
|---|---|---|---|
| `expert-avatar.tsx`（8 色） | 8 | 专家首字符头像按名称 hash 取的**身份色板** | 需要 8 个互异色相保证同一专家恒同色；分类板 `--cat-1..6` 只有 6 槽且语义是「类别」不是「身份」，装不下 |
| `icons.tsx` IconBrand 渐变 + 星形白 | 3 | 品牌标记的渐变双色与固定白填充 | 品牌图形专用色（不跟主题），不在设计尺度 token 覆盖范围；`--brand` 是状态点/品牌位用色，与此不同轨 |

### 3.2 文件类型惯例色（9 处，`index.css`）

| 选择器 | 值 | 语义 |
|---|---|---|
| `.doc-file-pdf` | `#c94f4f` | PDF 红（用户既定预期） |
| `.doc-file-word` / `.file-icon-code` | `#4a7bc8` | Word 蓝 / 代码蓝（同值共用） |
| `.doc-file-excel` / `.file-icon-markdown` | `#4b9e6b` | Excel 绿 / Markdown 绿（同值共用） |
| `.doc-file-ppt` | `#d98a3d` | PPT 橙 |
| `.file-icon-config` | `#b7903d` | 配置 |
| `.file-icon-image` | `#8b6bc8` | 图片 |
| `.file-icon-media` | `#c85a8f` | 音视频 |

按文件族区分类型的**惯例配色**（一眼可扫），不是设计尺度；归 token 会丢掉这套辨识度。

### 3.3 WB 原值与特殊底色（5 处）

| 位置 | 值 | 为何不归档 |
|---|---|---|
| `.composer-slot` 渐变 | `linear-gradient(180deg,#ebebeb,#f5f5f5)` | WB 首页输入槽原值，灰由外层渐变透出；非 token 等值项 |
| `.markdown code.clickable-path` 常态底 | `#e9eef2` | WB 路径徽章原值（accent 的浅色底），与 `--bg-raised(#f7f7f7)` 非等值 |
| 同上 hover 底 | `#dde6ee` | 同一条的 hover 档 |
| `.preview-video` | `#000` | 视频信箱（letterbox）必须纯黑、不跟主题；不可引用 `--text`（暗色下 `--text` 是白的） |
| iframe 内 `--kw-*`（`widget-view.tsx`） | 32 处 | srcDoc 注入独立文档，`var()` 解析不到宿主 `:root`，只能复制字面值（spec §A 豁免）；`--kw-c1..c9` 是 ECharts 九色系，宿主无对应 token |

### 3.4 遮罩例外（3 处）

| 位置 | 值 | 为何不归档 |
|---|---|---|
| `.attachment-remove` 常态 scrim | `rgba(0,0,0,.55)` | 缩略图上的**控件小遮罩**，不是模态背板；归 `--overlay`(40%) 后白 × 在亮图上不够清 |
| 同上 hover | `rgba(0,0,0,.78)` | 需与常态拉开档差，归 40% 会与常态撞成同色 |
| `.image-preview-overlay` | `rgb(0 0 0 / 72%)` | 全屏看图**沉浸遮罩**，要压掉底图注意力；归 40% 削弱沉浸感 |

（Task 2b 已逐处判断并在 `index.css` 就地注释。）

### 3.5 阴影档外值（6 行 / 12 处，因每行同时含「颜色」与「阴影」两类）

| 位置 | 值 | 为何不归档 |
|---|---|---|
| `.capability-chip` | `0 12px 32px -8px 2%` | WB quick-actions 原值，与 sm/md/lg 均非等值 |
| `.preview-panel.fullscreen` | `-8px 0 24px 6%` | 面板从右侧盖过来的**定向**投影；`--shadow-md` 是 `0 6px 24px`（无 x 偏移），非等值 |
| `.preview-menu` | `0 8px 24px 18%` | 透明度借了 lg 的 18%，但几何是下拉浮层尺度而非 lg(12/40) 的模态尺度 |
| `.preview-pdf-body .react-pdf__Page` / `.office-docx section.docx` | `0 1px 4px 15%` | 「纸张」贴在阅读面上的极浅投影，三档之外的场景值（一条 snippet 覆盖 2 行） |
| `.mcp-switch-thumb` | `0 1px 3px 20%` | 14px 小滑块压在轨道上的细影，几何不是三档尺度 |

**统一处置**：非等值，未擅自造第 4 档，保留原值并登记（不为了表格整齐牺牲观感）。

### 3.6 焦点环 / ring 手法（2 处）

| 位置 | 值 | 为何不归档 |
|---|---|---|
| `.composer-card.drag-over` | `var(--shadow-input), 0 0 0 1px var(--primary)` | `0 0 0 1px` 是无模糊无色散的 **ring**，属描边语言不属阴影尺度 |
| `.questionnaire-other-row:focus-within` | `inset 0 0 0 1px var(--text-secondary)` | 同上；色与全局 focus-visible 环一致 |

### 3.7 实测偏差回退 · 让位偏移（3 处，`space`）

| 位置 | 值 | 语义 |
|---|---|---|
| `.sidebar-brand` 左内边距 | `36px` | = App 层侧栏开关 28px + 8px 间隙；归 `--space-7`(32) 会把间隙压到 4px |
| `.artifact-card` 右内边距 | `40px` | = 预览钮 right 10 + 22px 宽 + 8px 间隙；归 32 会让文件名贴到预览钮 |
| `.preview-head` 右内边距 | `44px` | = App 层面板开关 40px + 4px 间隙；归 32 会被开关盖住行尾动作 |

属「控件宽 + 间隙」而非间距档值（spec「实测偏差处理」）。三处代码均已带注释。

### 3.8 无法 token 化的配置项（1 处）

| 位置 | 值 | 为何不归档 |
|---|---|---|
| `code-preview.tsx` Monaco `fontSize` | `13`（number） | Monaco 的 `fontSize` 是**数字像素**配置项，写 `var(--text-list)` 会立刻挂 typecheck、运行时也算不出行高。值与 `--text-list` 手工对齐，改档需同步 |

---

## 4. 本轮已完成的实质修复

不只是换 token，本轮顺路修掉的真实缺陷：

| 修复 | 说明 |
|---|---|
| `.toast-stack` 层级修正 | `100` → `--z-toast`(200)：此前与 `.modal-backdrop` 同档，**toast 会被模态盖住**，错误看不见 |
| 文字色 4 级收 3 级 | `rgba(0,0,0,.7)` 全部引用点 → `--text-secondary`(.5)，层级更克制 |
| 遮罩 5 档收 1 档 | 32%/40% → `--overlay`；55%/72%/78% 是有语义的例外（§3.4） |
| 分类调色板 3 套收 1 套 | `--seg` + `comp-*` + `cu-seg-*` → `--cat-1..6`；`#d9822b` 换相避免与 `--warning` 撞值 |
| 5 套 spinner 合并 | `.task-spinner`/`.todo-spinner`/`.file-tree-spinner`/`.mcp-badge-spinner`/`.toast-spinner` → 共享 `Spinner` |
| 13 种空态类名收敛 | `settings-empty`/`auto-empty`/`skills-empty`/`ex-empty`/… → 共享 `EmptyState`（类名在 tsx 与 css 中均归零） |
| 5 处「加载与空混淆」 | 侧栏任务列表、技能页、模型菜单、权限菜单、专家市场页：改为 `undefined`→Loading、`[]`→Empty、error→ErrorState+重试（此前首屏闪空态 / 失败卡在「正在读取」/ 失败显示成搜索无结果） |
| 3 处漏配 Esc | `plus-menu.tsx`、`sidebar` 的 space-menu、`context-usage` 的 `.cu-popover` 补 Esc 关闭（只加 Esc，未借机抽共享 hook） |
| `:active` 覆盖 25 个类 | 主要交互类补按下反馈（`scale(.98)` 或底色加深），只动 transform/opacity，时长取 `--dur-fast` |
| reduced-motion 全局兜底 | 从 7 处局部补丁改为全局块，全站 transition/animation 降至 0.01ms |

另：`index.css:1318` 的 `font-weight` 过渡已移除（§5 动效规范明令禁止的过渡属性）。

---

## 5. 未纳入本轮的事项

按 spec 的「明确不做」拆到后续 spec，均在本分支 `feat/ui-design-system` 继续：

| 事项 | 去向 |
|---|---|
| 12 个主界面的 7 状态逐页补齐（空会话引导、MCP 授权态、模型卡「去配置」动作等） | spec #2 状态补齐 |
| ~~动效属性改造（`.tool-detail-box` 等布局属性过渡 → transform/grid；`.text-shimmer` 的 `background-position` 扫光）~~ | ✅ **已完成**（spec #3），见 §7；扫光经评估保持现状并登记例外 |
| 长列表虚拟化、流式渲染合批、`widget-view` memo 化 | ✅ **已完成**（spec #4），见 §8；其中完整虚拟滚动经评估**不做**，理由见 §8.4 |
| 焦点陷阱与焦点归还、Esc 层级仲裁、拖拽越界拦截、最小宽度溢出 | spec #5 桌面端硬伤 |
| iframe 的 `--kw-*` 跨上下文 token 注入机制 | 待决策（本轮只对齐取值，见 §3.3） |

---

## 6. 已知遗留问题

本轮**已知未解**、需要后续 spec 或单独决策的问题（诚实记录，避免被当成已完成）：

1. **侧栏加载信号不准**：仍以 `link.kind === "connecting"` 当加载中，而非「数据未返回（`undefined`）」；
   状态语义与 DESIGN.md §4 的「`undefined` = 加载」口径尚未统一。
2. **专家页失败态无重试**：失败时不再显示成「搜索无结果」，但只有错误文案、缺重试动作
   （违反 §4「失败就地呈现 + 重试动作」）。
3. **设置页各组与诊断页**：仍有「失败 + 正在读取」并存同型缺陷（同技能页修前的样子），
   本轮只修了清单点名的 5 处，其余待 #2 逐页补齐。
4. **`Spinner` 统一为中性灰**：合并 5 套 spinner 后失去原 todo/mcp 的绿 / 琥珀色调；
   DESIGN.md §7.6「状态不只靠颜色」允许中性化，但语义色调的取舍待 #2 定夺。
5. **`.panel-toggle-btn` 与面板同档**：`z-index` 与面板同档、靠 DOM 序分层；
   一旦 DOM 序变动就会露馅，属脆弱依赖（spec 的 z-index 表已注明「靠 DOM 序」）。
6. **`--overlay` 暗色值待定**：`[data-theme="dark"]` 的 `--overlay: rgba(0,0,0,.6)` 是合理初值，
   无暗色实测依据；暗色主题整体仍为「未接线预留」，首次启用时须对照 WB 暗色截图逐区校验。
7. **白名单未命中告警不阻断构建**：当前设计为告警（写歪了要能被发现，但通过与否只看真违例数）。
   若后续希望「白名单腐烂即失败」，需把告警升级为非零退出。

---

## 7. 动效属性改造（spec #3，本期成果）

> spec：`.trae/specs/refine-motion-discipline/spec.md`，分支 `feat/ui-design-system`。
> 目标：把「动效只动合成属性」从声明变成存量代码的实态，并补上场景规范（DESIGN.md §5）。
> 上一期（token 地基）只收拢了时长取值；本期处理**属性选择**。

### 7.1 本期做了什么

| 事项 | 结果 |
|---|---|
| 折叠体过渡属性收敛 | `.tool-detail-box` / `.tool-source-list` 改用 `interpolate-size: allow-keywords` + `height: 0↔auto`；过渡属性从 **12 项降到 4 项**（布局属性只剩 `height`），删掉为配合 `max-height: 0` 而设的 padding/margin/border-width 归零 hack；展开后 `max-height: 300px` + 内部滚动保留 |
| 弹层入场 + 空间连续性 | **22 处**弹层/模态/子菜单接入 `@keyframes pop-layer-in`（`opacity` + `translateY(4px)` + `scale(.98)`）+ 背板 `@keyframes backdrop-in`；21 处配 `transform-origin` 对齐触发点。全部用 `animation`：条件挂载元素（`{open && <div>}`）挂载即终态，`transition` 无起跳点 |
| 进出场时长拆分 | 常驻 DOM 元素由「同一时长来回」改为「退出降一档」：`.tool-detail-box` / `.tool-source-list` / `.metafold-body`（`--dur-slow` 入 → `--dur-base` 出）、`.stream-fade` / `.entry-toolbar`（`--dur-base` 入 → `--dur-fast` 出）。**未新增 token 档位** |
| 拖拽期停过渡 | `.preview-panel[data-dragging="true"] { transition: none; }`，由 sash 鼠标路径加/去标记（键盘调宽是离散操作，不禁用） |

### 7.2 两项经评估保持现状（登记为 DESIGN.md §5 受控例外）

| 事项 | 为何保持现状 |
|---|---|
| `.text-shimmer` 的 `background-position` 扫光 | 无法用合成属性等价复刻：① 伪元素拿不到文字内容，而「文字明暗流动」必须以文字形状（`background-clip: text`）为裁剪源；② 用 `content: attr(data-text)` 复制文字后仍需 `mask-position` 移动遮罩（与 `background-position` 同类，非合成属性）；③ 本类用在 8 处行内 `<span>`，改 `display: inline-block` 才能裁剪，会破坏行内排版与基线对齐。收益亦不成立：重绘面积仅限文字区域（非整屏），`prefers-reduced-motion` 下已有降级 |
| `.metafold-body` 的 `grid-template-rows: 0fr↔1fr` | 这已是「从 0 到内容高度」的推荐现代做法（绕开 `height: auto` 不可过渡的坑），本就不是问题；它与 `.tool-detail-box` 的 `interpolate-size` 方案同为受控例外（折叠展开只动**一个**布局属性） |

### 7.3 待决策 / 未处理（诚实记录）

- **`.mode-menu-sub` 是死 CSS**：经 grep 确认**无任何 TSX 引用**——模式子菜单已在「专家正交化」那期删除。
  本期按弹层清单给它补齐了动画并注释标明，**是否删除留待后续清理**（本分支 #2~#5 或单独清理）。
- **`.plus-menu-sub` 的 4px 级取整**：其垂直锚点实为父项底边（`bottom: -4px`），
  当前 `transform-origin: left center` 是取整近似（更精确应为 `left bottom`）；差异极小，本期未改。
- **`.mode-menu-sub` 的 origin 口径**：其实际定位是 `right: calc(100% + 4px)`（**向左飞出**），
  origin 取 `right top`；spec 原稿写的 `left center` 有误，实现时已按实测纠正。

---

## 8. 流式渲染开销优化（spec #4，本期成果）

> spec：`.trae/specs/optimize-stream-rendering/spec.md`，分支 `feat/ui-design-system`。
> 与前三期不同，本期处理的是**诊断报告里排第一、第二**的两个 P0——不是一次性整理，
> 而是「每次对话都在付」的成本（长会话几百轮会线性放大）。
> 硬约束已写入 DESIGN.md §11（工程红线）；本节记**做了什么**与**代码层证据**。

### 8.1 本期做了什么

| 事项 | 结果 |
|---|---|
| 流式 delta 合批（daemon 侧） | `session-host.ts` 引入 **16ms 时间窗缓冲**：连续同类型 delta 合并为一条 emit，6 处 flush 落点。事件类型与字段语义不变，`shared/` 与 reducer / UI **零改动** |
| 收起态跳过渲染 | `index.css` **5 条声明**：`.metafold-body-inner` / `.tool-detail-box` / `.tool-source-list` 收起时 `content-visibility: hidden`，展开恢复 `visible`；每条收起态配 `transition-behavior: allow-discrete` |
| 热点 memo 化 | **5 处**（`widget-view` 的 `parseWidgetResult`、`Markdown` 的 `React.memo`、`App.tsx` 两处 collect、`chat-view` 的 `pendingText` / `findLast`）+ 一处**必要支撑**（`App.tsx` 的 `openPath` 提 `useCallback`）+ `turn-rail` 测量降频（rAF 尾沿） |
| 开发期性能浮层 | 新建 `src/renderer/perf-overlay.tsx`（FPS + 主线程 longtask 采集），`main.tsx` 用动态 `import()` 挂载 |

### 8.2 代码层证据

**① 流式事件数：从「每 delta 一条」降到「每 16ms 最多一条」**

- `src/core/session-host.ts`：`DELTA_FLUSH_MS = 16`（L77）；状态用**单个对象**
  `pendingDeltas = { kind, messageId, text, timer }`（L421-428，避免四个字段互相漂移）；
  `bufferDelta()` 负责追加 / 切换（L865-881），`flushDeltas()` 负责 emit（L888-898）。
- **6 处 flush 落点**（比 spec 要求的 4 类更密）：定时器到期（L876）、类型切换（含 messageId 变化，L867-869）、
  `message_end`（L1230）、`turn_end`（L1117）、`agent_end`（L996，含用户 abort 的收尾）、`abort()`（L652）。
  额外存 `messageId` 是必需的：`agent_end` 路径会先清 `currentAssistantId`，flush 时不能现读。
- `dispose()`（L697-700）`clearTimeout` 并置 undefined，**故意不 flush**——会话已作废，补发只会把残句推到废弃会话。
- `turnFirstDeltaAt`（TTFT 基准）保持在**缓冲之前**记录：它量的是 pi 事件到达时刻，不是 flush 时刻（L1207-1211）。
- **单测对拍证据**：`session-host.test.ts` 的 `describe("流式 delta 合批（16ms 窗口）")`，6 例，该文件 **47 → 53 通过**。
  其中对拍一例喂入 `think, think, text, text, think, text, text`（**7 个 delta**），
  断言按类型拼接的结果与「逐个 delta 原样拼接」的参照实现 `toEqual` 一致，
  且 `deltaTrace(events)` 长度为 **4**（think/text/think/text 四次类型切换）——即 **7 个 delta → 4 次 emit**。

**② 折叠内容不再参与 layout / paint**

- `src/renderer/index.css` 5 条声明：`.metafold-body:not(.open) .metafold-body-inner`（L1950-1953）、
  `.tool-detail-box`（基类即收起态，L2612 + 过渡 L2621）、`.tool-detail-box.open { content-visibility: visible }`（L2640）、
  `.tool-source-list`（L3219 + L3226）、`.tool-source-list.open { … }`（L3238）。
  复用 `.tool-detail-box` 的 `.todo-list-box` / `.task-agent-box` **自动一并受益**。
- 选择器口径：轮折叠的激活类 `.open` 在**外层**、内层没有，只能用祖先表达收起态；展开态不显式声明
  （选择器不匹配即回落 `visible`）。两个工具盒与该文件既有的「基类 = 退出态」写法一致，所以写在基类 + `.open` 显式恢复。
- **探针 A/B 证据**（Electron 44 / Chromium 152，改前 vs 改后）：收起态 **`scrollHeight` 完全相等（2106 = 2106）**；
  三个目标元素自身盒高恒为 0；展开态 `content-visibility` 计算值为 `visible`、高度正常（300 / 300 / 895.63）。
  与既有 `visibility` / `opacity` 语义正交可共存；因折叠态本就 `visibility: hidden`，不引入可访问性回归。
- **顺路救回的一个坑**：`content-visibility` 是**离散属性**，直接加会让收起瞬间把内容高度算成 0 →
  收起动画从「真实高度 → 0」退化成「0 → 0」（瞬间消失，实测旧行为起点 895.6px、退化后起点被算成 0px）。
  **修复：每条都配 `transition-behavior: allow-discrete`**（时长取既有 token，零硬编码），
  且**只写在收起态那一条**——实测展开态也加会晚一帧翻转、轨迹偏离更大。
- 附注：`content-visibility: hidden` 下 `innerText` 返回空串（`textContent` 仍完整）；
  当前代码库无 `innerText` 调用（已 grep 确认），仅作提示。

**③ 5 处 memo 化清单（+1 处必要支撑 +1 处降频）**

| 位置 | 改动 | 改前每 delta 会重算什么 |
|---|---|---|
| `widget-view.tsx:438` | `parseWidgetResult(card.detail)` → `useMemo([card.detail])` | 同一份卡片 JSON 被反复 `JSON.parse`（同文件 L442 的 `partial` 本就 memo 了） |
| `markdown.tsx:159` | `Markdown` → `React.memo` | 长会话里成百条历史消息的 remark 解析随每个 delta 重跑 |
| `App.tsx:1044-1045` | `collectSources` / `collectChanges` → `useMemo([conversation.entries])` | 原是 JSX 内联调用：App 任何重渲染都重扫全部 entries（线性成本） |
| `chat-view.tsx:1418` | `entries.findLast(user)` → `useMemo([entries])` | 每次渲染反向扫到「最后一个 user」为止（长会话末尾常是一串工具卡） |
| `chat-view.tsx:1475` | `pendingText(entries)` → `useMemo([entries])` | 每次渲染重跑阶段判定 |
| `App.tsx:1056`（**必要支撑**） | 传给 `ChatView` 的 `openPath` 由 JSX 内联箭头提成 `useCallback`（依赖 `[conversation.state.cwd, openArtifact, openPreview]`，函数体逐行照搬） | 本身不是热点，但它是 `Markdown` memo 的**前提**：内联箭头每次渲染换引用，会把 memo 全部击穿（历史消息照样重解析） |
| `turn-rail.tsx:95` | 测量 `useLayoutEffect` 从「依赖 `[entries]` 就地同步测量」改为 **rAF 尾沿** | 每个 delta 强制一次同步布局（`getBoundingClientRect`）+ 一次 `setTicks` |

`turn-rail` 用 rAF 尾沿而**不是**「条数门控」：刻度 ratio = 刻度顶偏移 / `scrollHeight`，流式期 `scrollHeight`
持续增长而条数不变，门控会让整轮刻度停在旧比例上（准确性退化）。rAF 仍每帧按当帧 `scrollHeight` 重算，
最坏只晚一帧；**测量算法与 `RATIO_EPSILON` 容差未动**。同理未写自定义比较函数（默认浅比较已够；
放过函数型 prop 会引入「旧闭包 + 新 cwd」的隐式耦合）。

**④ 开发期性能浮层的开关与取证方式**

- **开关**：单一 key `localStorage.kbPerf`——**只有 `"1"` 才开**，未设置 / `"0"` 都不开（**DEV 下亦然**）。
  控制台执行 `localStorage.kbPerf = "1"; location.reload()` 即可。
  *（2026-09-15 订正：原口径为「`"1"` 强开、`"0"` 强关、未设置时 DEV 开 / 生产关」→ 改为不按构建区分默认值。
  **改因**：浮层是**主动取证**时才需要的工具（改渲染性能时才量一次），DEV 下默认常驻会遮挡右下角界面、
  打扰正常开发，不该默认开启。）*
- **取证**：右下角浮层显示当前 FPS、最近 10s 的 longtask 条数与最长时长；longtask 明细
  （`duration` / `name` / `startTime`）与低 FPS 告警（**带上同窗口的 longtask 明细**，只有一个数字定位不到元凶）
  打在 DevTools Console。FPS 按 1s 档统计；窗口切走造成的「空窗」按 `elapsed >= 2000ms` 丢弃以免误报；
  longtask 做能力检测 + try/catch，不支持则静默跳过。
- **为什么不进 App 树**：浮层是**独立 React root**（App 每轮重渲染不带它，也不必改 `App.tsx`），
  样式全内联 + CSS 变量，**零 CSS 文件改动**。

### 8.3 诚实标注：两处在流式期间收益为 0

`App.tsx` 的 `collectSources` / `collectChanges` 与 `chat-view` 的 `pendingText` / `findLast`，
依赖都是 `conversation.entries`，而 `entries` **每个 delta 都换引用**（`replaceEntry` 走 `map`）——
memo 在**流式期间仍会重算，收益为 0**。它们真正省下的是「**与消息流无关的重渲染**」
（折叠开合、面板交互、toast、审批弹窗），这些在一次会话里同样高频。
流式期「历史消息不重解析」的主要收益来自 `Markdown` 的 `React.memo` 与 `openPath` 的引用稳定。
（这三处代码注释已写明同一口径，避免被误读为「流式不再重算」。）

### 8.4 本期刻意未做（三项）

| 事项 | 理由 |
|---|---|
| 完整虚拟滚动（react-window 类） | 会同时牵动**吸顶 / 吸底跟随 / 轮折叠 / 刻度轨**四套机制（`send-anchor.ts`、`turn-fold.ts`、`turn-rail.tsx` 都依赖真实 DOM 与 `scrollHeight`），风险远超收益 |
| 未折叠的屏幕外条目用 `content-visibility: auto` | 屏幕外元素用**估值高度**会让 `scrollHeight` 漂移 → 滚动条跳动、贴底跟随抖动；我们依赖 `scrollTop = scrollHeight` 贴底，这条风险不可接受（已升级为 DESIGN.md §11 第 4 条硬约束） |
| Markdown 解析移入 Web Worker | remark 生态的序列化 / 通信开销可能抵消收益，且要改整条渲染链路；先用 `React.memo` 拿「已完成消息不重解析」这块主要收益 |

同批明确不做的另两项（spec 同期记录）：`extractPartialWidgetArgs` 的增量提取（已 `useMemo`，
O(n²) 只在大 widget 的流式期出现、频率低）；滚动跟随 / 刻度轨的既有算法（已有防抖与 `RATIO_EPSILON` 容差，不动）。

### 8.5 已知问题（Task 1 遗留，机制未成立）

**生产构建仍打包 `perf-overlay`**：

- 现象：`npm run build` 成功后产物里有 `out/renderer/assets/perf-overlay-<hash>.js`（**4.90 kB**），
  入口产物里也留有 `__vitePreload(() => import("./perf-overlay-…js"), …)`；
  `Select-String -Path out\renderer\assets\*.js -Pattern longtask` 能命中该 chunk。**「生产不打包」不成立。**
- 根因（产物实证）：守卫读的是**运行时** `localStorage`，不含任何编译期常量——rollup 判定不了该死分支，
  于是动态 import 与它引出的 chunk 都被保留。现行守卫（源码即产物形态）：
  ```js
  const perfFlag = localStorage.getItem("kbPerf");
  if (perfFlag === "1") { void __vitePreload(() => import("./perf-overlay-<hash>.js"), …) }
  ```
  *（2026-09-15 订正：本节原引守卫为 Task 1 写法 `perfFlag === "1" || (import.meta.env.DEV && perfFlag !== "0")`，
  生产下折成 `perfFlag === "1" || false`、残留同样取决于运行时 `localStorage`；该写法已简化为上引的
  `if (perfFlag === "1")`（见 §8.2 订正，DEV 不再默认开）。**两种写法都拿不掉这个 chunk**，
  故下方「默认不执行、但 4.9 kB chunk 与入口 import 存根仍在包里」的结论**不变**。）*
- 现状的实际行为：**默认不执行**（用户没设 `kbPerf` 时 `null === "1"` 为假），但代码**已在包里**
  （4.9 kB chunk + 入口里的 import 存根）。
- 修复方向（**本期未改代码**：`.tsx` 不在 Task 5 的改动面内）：让 `import.meta.env.DEV` 成为**唯一**的编译期闸门
  （如 `if (import.meta.env.DEV && perfFlag !== "0")`），生产下整句折叠为 `false`、分支与 chunk 一并消失；
  代价是放弃「生产用 `kbPerf=1` 强开」——这与既定的「生产关」设计一致。
- 相关注释（`main.tsx` 尾部、`perf-overlay.tsx` 文件头）当前断言「模块不进生产包」，与实测不符：
  修代码时**一并订正注释**，不要只改注释。
  *（2026-09-15 订正：该注释订正**已完成**（Task 5.8）——两处注释现已准确写明「生产默认不执行、
  但该 chunk 仍在包里」。故上句「当前断言…与实测不符」**已失效**，保留作历史记录。）*

### 8.6 实测性能对比：未完成（需人工）

本沙箱**可以**跑 Electron（已有本应用实例在运行，`~/.kamibuddy/auth.json` 亦已配 provider），
但 FPS / longtask 的**前后对比必须人工完成**：agent 无法向正在运行的窗口注入输入，也无法读取它的
DevTools Console，而「≥200 轮、含代码块的真实流式会话」需要真人驱动。
故本期以**代码层证据**代替（§8.2），并把清单留清楚：

1. `localStorage.kbPerf = "1"` 开启浮层，跑 **≥200 轮、含代码块与折叠体**的长会话。
2. 记录：稳态 FPS（是否持续 ≥55）、10s 窗口内 longtask 条数与最长时长、控制台里 longtask 的
   `startTime` 明细（能否对到合批 / flush 之外的可疑点）。
3. 对照项：① 滚动是否仍贴底、刻度轨比例是否随流式增长正确更新；② 折叠 / 展开动画是否与改造前一致
   （**重点确认不是「瞬间消失」**——这是 `allow-discrete` 那条修复的验收点）；
   ③ 历史消息的 Markdown 解析是否只出现在流式那条上（Performance 面板）。
4. 只有「改后」数据也可接受：至少确认**没有**新增 longtask 与掉帧（本期目标是「变便宜」，不是「换一种贵法」）。

### 8.7 本期校验结论（Task 5 收官）

```
npm run typecheck    → 通过（tsc --noEmit 无输出）
npm run check:deps   → 通过（扫描 257 个文件。依赖方向校验通过。）
npm run check:tokens → 真违例 0 处 / 白名单命中 77 处 / 豁免 107 处（圆角 29 / 间距 73 / 时长 5）
npm test             → 95 文件 / 1717 用例全绿（1711 基线 + Task 2 新增 6）
npm run check        → 通过（上面三项的串联）
npm run build        → 成功（main / preload / renderer 三目标均产出；遗留问题见 §8.5）
```

- 扫描的 tsx 由 48 增至 **49**（新增 `perf-overlay.tsx`）；豁免数由 105 增至 **107**（`间距 71 → 73`）——
  均为本期代码改动带来的口径变化，**真违例仍为 0**（没有新增白名单条目）。
- 上一轮并行执行时偶发的 `src/core/doc-extract.test.ts` 超时，本期**串行全量跑两次均通过**
  （95 文件 / 1717 用例；该文件 23/23，单跑 469ms）。并行负载下的偶发超时归因于环境负载，非该文件本身。

---

## 9. 桌面端交互加固（spec #5，本期成果）

> spec：`.trae/specs/harden-desktop-interactions/spec.md`，分支 `feat/ui-design-system`。
> 本期处理诊断报告「如果只做 5 件事」的第 5 项——**三条桌面端硬伤**：
> 模态的 `aria-modal` 是空声明 / 拖拽越界无防护 / 最小宽度横向溢出；外加一批键盘可达性的小缺口。
> 行为要求已写进 DESIGN.md §7（无障碍第 3 条与新增第 10 条）。

### 9.1 本期做了什么

| 事项 | 结果 |
|---|---|
| 模态焦点管理 | 新建 `src/renderer/use-modal-focus.ts`（约 190 行），**10 个接入点 / 8 个组件**（spec 记为 9 处，实际因 `chat-view` 有 2 处而为 10；问卷卡自身注释也写「与别的 9 处不同」） |
| 拖拽越界防护 | `App.tsx` document 级 `dragover`/`drop` 兜底 + `src/main/index.ts` 的 `will-navigate` 守卫（外链出口抽成 `openExternally`，与 `setWindowOpenHandler` 共用） |
| 最小宽度不溢出 | `index.css` 的 `.app` 加 `overflow: hidden`；面板宽度上限由硬编码 800 改为 `maxPanelWidth()` 动态 clamp；`App.tsx` 补窗口 resize 回落 |
| 三处键盘可达性 | `.pending-tip` 的 focus 处理移到可聚焦子元素；`ViewSwitcher` 补 Esc（capture 层，见 §9.5）+ 外部点击；产物条目「转正」补 `Shift+Enter` 键盘等效入口 |
| 问卷默认落点 | `firstOptionRef` + `initialFocus`：首个落点是**首选项**（此前容器内文档序首个可聚焦元素是头部的「全部跳过」，正是要绕开的） |
| `inert` 粒度 | 背景隔离排除 `.toast-stack`（见 §9.3） |

### 9.2 三条硬伤的处理

**① 模态焦点管理（`use-modal-focus.ts`）**

三条职责，一个入口：

- **移入**：`initialFocus()` 指定的元素优先，返回 `null` 或已脱离文档则退回容器内首个可聚焦元素。
- **Tab 陷阱**：`document` 上的 keydown 在容器内首尾回绕。监听挂 `document` 而非容器——
  焦点万一不在容器内（刚打开、或鼠标点到非可聚焦处），挂容器的监听根本收不到这次 keydown。
  不插哨兵元素（会往卡片里塞可聚焦空节点、污染选择器）。
- **归还**：节点挂上时记 `document.activeElement`（此刻还在触发按钮上），摘下时若
  `instanceof HTMLElement && isConnected` 才 `focus()`；顺序**先撤 `inert`、再还焦点**
  （要还给的按钮往往正是被标 `inert` 的那个）。

选型理由（都是被真实场景逼出来的）：

- **返回 callback ref 而不是 `useRef` 对象**：模态常常「先挂组件、后挂节点」——
  `chat-view` 的图片预览浮层跟消息气泡同生命周期，要等用户点开图片才有节点。
  `useRef` 只在组件挂载/卸载时可观察，这类节点会被整段漏掉；callback ref 恰好在节点挂上时跑。
- **模块级 `openModals` 栈**：嵌套是真实存在的（`AddModelDialog` 渲染在 `.settings-card` 内部），
  两个 hook 都听 `document` 时，外层容器的 `querySelectorAll` 会穿透进内层，
  Tab 只由**栈顶**处理，否则外层会把内层的陷阱拆掉。
- **可聚焦选取 5 道判定**（不写死选择器清单，清单一定会漏）：`tabIndex < 0`（一举覆盖显式 -1、
  默认不可聚焦、禁用控件）/ `:disabled` 伪类 / `closest("[inert]")` / **`getClientRects().length === 0`**
  （**不用 `offsetParent`**——它对 `position: fixed` 元素同样是 `null`，而固定定位恰是模态常态）/
  计算样式 `visibility`。
- **背景 `inert`**：给背板（`.modal-backdrop` / `.ex-modal-mask`）的**兄弟节点**标 `inert`
  （背板自身与卡片在模态链上，标了等于把模态也冻住）；本来就是 `inert` 的兄弟跳过且不记录
  （记了会在内层摘下时把外层背景隔离一并关掉）。

**② 拖拽越界防护**

- **关键判断是 `dataTransfer.types.includes("Files")`，不是只看 `defaultPrevented`**：
  读 `composer.tsx:250-252` 与 `image-attachments.tsx:250-259` 后发现，输入卡的 `onDrop` 在
  **含文件时** `preventDefault`，**不含文件时直接 return 且故意不 `preventDefault`**
  （放行 textarea 原生插入拖入的文本），且两个 handler 都**没有 `stopPropagation()`**。
  所以兜底必须**只兜文件拖放、放行文本拖放**——否则会吃掉 textarea 的原生文本投递。
- **顺序依据**：React 合成事件委托在 `#root`，它是 `document` 的后代 → `document` 级监听
  一定在输入卡处理**之后**；`dragover` 一律 `preventDefault`。
- **main 侧 `will-navigate`**：`isAppUrl` 判据 = dev 放行 dev server 同源、生产**只放行 `file://`
  且路径以 `/renderer/index.html` 结尾**（**不能只判 `file:`**，否则被拖入的任意文件同为 `file://`
  会被误放行，守卫就白设）；非本应用 URL 一律 `preventDefault` 并走 `openExternally(url)`。
  `will-navigate` 只对**主帧**触发，预览面板的 `http://127.0.0.1:*` iframe 不受影响。

**③ 最小宽度不溢出**

- `.app` 加 `overflow: hidden`（已核实 `.modal-backdrop` / `.toast-stack` 都是 `position: fixed`、
  `.app` 无 transform/filter → 不会裁掉全局模态与 toast）。
- 面板上限动态化（`artifact-panel.tsx` 约 770–812 行）：
  `maxPanelWidth = max(340, min(800, innerWidth − 侧栏宽 − MAIN_MIN_WIDTH))`，
  `MAIN_MIN_WIDTH = 320`（900 − 216 − 320 = 364，面板压到下限 340 后三者恰好铺满视口）。
  **侧栏宽从 DOM 量而非在 TS 里抄 216**（侧栏收起时整个不渲染，量到 0 恰好正确；抄常量会双写漂移）。
  下限 340 与「拖拽 / 键盘同一 setter」的既有设计不变。
- **额外补了一个 resize 回落**（`App.tsx` 约 548–553）：否则「宽窗口把面板拖到上限、再缩小窗口」
  这一刻没人调 setter，面板会一直超出视口 → spec 的「面板被压缩而非挤出主区」会落空。

### 9.3 必要支撑改动（两处，都不是顺手改）

| 位置 | 改动 | 为什么是**必要**的 |
|---|---|---|
| `chat-view.tsx` 的 `SaveToWorkspaceDialog` | 移除输入框的 `autoFocus`（由 hook 的默认落点承接） | `autoFocus` 会让 hook 在节点挂上时记下的「打开源」变成输入框自己 → 关闭时把焦点还给它自己，**焦点归还当场失效**。而「归还失效」恰是本期要修的现象，不删就自相矛盾 |
| `use-modal-focus.ts` 的 `isolateBackground` | 兄弟循环里跳过 `.toast-stack` | `role="status"` 是实时播报区，`inert` 会把它移出无障碍树、**连播报一起掐掉**；而后台任务失败这类提示恰恰可能在模态开着时出现。toast 高悬在模态之上（`--z-toast`），不属于「模态背后的界面」 |

### 9.4 诚实标注（四条，必须写）

1. **拖拽那条现象本轮未实测**（需 GUI 拖拽）。准确说法是「补了两道任何 Electron 应用都该有的
   标准防护」——两个前提（渲染层无全局 drop 拦截、main 无 `will-navigate`）是 grep 实证的，
   **不声称「已修复某现象」**。
2. **`use-modal-focus.ts` 没有自动化测试**：仓库无 DOM 测试基建——`vitest.config.ts` 是 node 环境、
   未装 jsdom/happy-dom 也无 testing-library、`include` 只收 `src/**/*.test.ts`。
   三条行为（移入 / 陷阱 / 归还）只能靠 GUI 人工验收。未为凑测试去加依赖或改配置（超范围）。
3. **诊断报告的一处误判已修正**：`.pending-tip` 的 `onFocus`/`onBlur` **不是死代码**——
   React 的 `onFocus` 走 `focusin`（**冒泡**），此前子元素「×」获焦时那个 `<span>` 的处理
   **确实会被触发**、`paused` 确实置位。故改法相应调整为「把处理移到可聚焦的子元素（× 按钮）上」，
   行为逐字不变；不加 `tabIndex={0}`（会造一个「聚焦后除暂停轮播无事可做」的空 tab stop，
   且要给非 button 补焦点环＝新增视觉值），也不删处理（会丢掉键盘用户的暂停行为）。
4. **`inert` 的粒度**：10 个接入点里只有 **8 个**能拿到背景 `inert`——问卷浮层（`.questionnaire-card`）
   与图片预览浮层（`.image-preview-overlay`）**不在** `.modal-backdrop` 里，`isolateBackground`
   找不到背板祖先、自然不生效。这两处仍完整生效「移入 / Tab 陷阱 / 归还」三条，
   但**背景读屏隔离缺位**（已在代码注释就地标明）。

### 9.5 `ViewSwitcher` 的 Esc 层级修复（Task 4 新发现的冲突）

**现象**：产物面板的 `ViewSwitcher` Esc 监听挂 `window`（照 `ModelMenu` 的既有约定）且未
`stopPropagation`，而 ArtifactPanel 的**全屏** Esc 监听挂 `document`。事件冒泡路径是
`target → … → document → window`，所以 **`document` 上的冒泡监听先于 `window` 上的执行**——
全屏时打开视图下拉再按 Esc，会「关下拉 + 退出全屏」一起发生，违反 DESIGN.md §7.4「Esc 只关最内层」。

**修法**：把 `ViewSwitcher` 的 Esc 改为 **`document` + capture 阶段**监听，命中 `Escape` 时
`event.stopPropagation()` 并关闭下拉。capture 在 `document` 上先于一切冒泡监听执行（含全屏那条），
此刻吃掉这次 Esc，全屏退出就收不到它。**只改了这一处 Esc**，没有重构 Esc 体系。

**回归确认**：「没下拉时全屏 Esc 仍生效」由 effect 的 `if (!open) return;` 保证——
下拉未打开时该 capture 监听**根本不注册**，这次 Esc 照旧冒泡到 `document` 的冒泡监听、正常退出全屏。
（无 GUI 无法实机按键，此条以事件模型与代码为据；GUI 复验见 §9.6 第 ④ 条。）

### 9.6 人工验收清单（沙箱无 GUI，需人工确认）

1. **权限弹窗 Tab 循环**：触发一次需要审批的工具调用 → 连续按 Tab，焦点应在弹窗内的
   拒绝 / 允许 / 详情之间循环，**不出现**弹窗背后的侧栏或消息流元素。
2. **关闭后焦点归还**：从某个按钮（如设置入口）打开设置模态 → 按 Esc 关闭 →
   焦点应回到那个按钮本身（**不是**掉到页面顶部/`<body>`）。
3. **窗口最小宽度**：把窗口宽度拖到最小（`minWidth` 900）→ 侧栏 + 主区 + 产物面板都在视口内，
   面板被压缩、主区不被挤出屏幕，**无横向溢出/无法滚动的裁切**。
4. **拖文件到消息流区域**（**本轮唯一无法自测的现象**）：把桌面文件拖到输入卡**之外**
   （消息流、首页空白）再松开 → 页面**不导航**、不变成文件内容；仍把文件拖到输入卡上，
   投递照旧（插入 `@路径`）。
5. **产物面板视图切换下拉**：打开下拉 → 按 Esc，下拉关闭；
   **全屏态**下打开下拉再按 Esc，应只关下拉、**不再一起退出全屏**；再按一次 Esc 才退出全屏。
6. **问卷弹窗默认落点**：问卷弹窗打开后，**首个落点应是首选项**（不是头部「全部跳过」）。
7. **（顺带）折叠动画**：收起/展开折叠体应仍是「从真实高度动画收起」而非「瞬间消失」
   （第 3 期 `allow-discrete` 的验收点）。

### 9.7 本期刻意未做（及理由）

| 事项 | 理由 |
|---|---|
| 右键菜单 | 诊断确认全仓无 `onContextMenu`，但这是**产品需求缺失**而非缺陷；WorkBuddy 侧栏用的是「⋯」按钮 + 自绘弹层（我们已同构）。要加需先定需求 |
| `connectors-view` 两个表单（mcp-form / mcp-editor）无 Esc 关闭 | 既有不一致（这两个弹层一直没有 Esc），补属**新增行为**、超出本期「补三处键盘可达性」的范围；留给后续统一（可与 §6 的「抽共享 popover 行为」一起做） |
| `diagnostics-view` 表格行的键盘可达 | 归第 2 期状态补齐的同类问题（诊断页整体），避免本期范围膨胀 |
| OS 沙箱 / 危险命令检查器 | 属权限模块（`docs/workbuddy分析/09-sandbox-and-permissions.md` 决策 A 的前置条件），另有 spec |

另：`use-modal-focus.ts` 的已知局限（如实记录）——正向 `tabindex`（1、2…）不特殊排序
（本项目 9 处模态都没用，属反模式）；零可聚焦元素的模态会让 Tab 被吞（焦点原地不动、不落到背景），
现有接入点都不触发。`iframe`/widget 上的拖放不会冒泡到父 `document`，drop 兜底管不到它
（其导航走 `will-frame-navigate`，未加，spec 也未要求）。

### 9.8 本期校验结论（Task 5 收官）

```
npm run typecheck    → 通过（tsc --noEmit 无输出）
npm run check:deps   → 通过（扫描 258 个文件。依赖方向校验通过。）
npm run check:tokens → 真违例 0 处 / 白名单命中 77 处 / 豁免 107 处（圆角 29 / 间距 73 / 时长 5）
npm test             → 95 文件 / 1717 用例全绿
npm run check        → 通过（上面三项的串联）
```

- 扫描文件数由第 4 期的 257 增至 **258**（新增 `src/renderer/use-modal-focus.ts`）；
  `check:tokens` 扫描的 tsx 仍为 49、真违例仍为 **0**、白名单仍为 77（**未新增白名单条目**）。
- 用例数与第 4 期基线一致（95 / 1717）：本期新增的 `use-modal-focus.ts` 与 `artifact-panel.tsx`
  改动**没有自动化测试覆盖**（DOM/焦点行为在本仓库无测试基建，见 §9.4 第 2 条）。

---

## 10. 视图状态覆盖补齐（spec #6，本期成果）

> spec：`.trae/specs/complete-view-states/spec.md`，分支 `feat/ui-design-system`（该分支系列第 5 期，收尾）。
> 第 1 期建了 `src/renderer/state-views.tsx`（`EmptyState` / `LoadingState` / `ErrorState` / `Spinner`）
> 并顺带修了 5 处「加载与空混淆」，但**只覆盖了当时发现的**。本期逐页盘点 12 个主界面 × 7 态，
> 补齐了 **4 处 P1 级残留**（用户会看到错误信息，或失败后没有任何恢复路径）与一批 P2。
> 行为要求已写进 DESIGN.md §4（新增视图四条硬要求 + 豁免与刻意偏离登记）。
>
> **参照标杆**：改法一律照 `skills-view.tsx`（三态互斥 + 重试）与 `personalization-section.tsx`
> （settings 分区的模板）。

### 10.1 本期做了什么

| 事项 | 结果 |
|---|---|
| **P1** 侧栏误报「暂无历史任务」 | `App.tsx` 的 `taskList` 初值 `[]` → `undefined`、新增 `taskListError`；侧栏任务区四态互斥（失败 / 断开 / 加载 / 空） |
| **P1** 定时任务页失败零出口 | `automations-view.tsx` 三态互斥 + `onRetry`（原「错误条 + 正在读取…」永久同框） |
| **P1** 专家页失败即死 | `App.tsx` 抽出 `reloadExperts`；`experts-view.tsx` 两处 `ErrorState` 接 `onRetry` |
| **P1** 文件树扫描失败伪装成空目录 | `artifact-panel.tsx` 失败改错误态 + 重试（**不再降级成空树**） |
| **P2** 预览失败文案分流 | 未选工作空间 / 服务未就绪分开说，后者带重试 |
| **P2** settings 各处三态 | **10 处**分区改 `error ? ErrorState(onRetry) : data === undefined ? LoadingState : 内容` |
| **P2** 四处「在途被当空」 | 首页页签、对话页模式标签、`+` 专家子菜单、侧栏空间区 |
| 顺带（前序报告发现的新增同型残留） | 侧栏 **daemon 启动即 down 的断开态**（原永久「正在读取…」）、空间计数不再误报 `(0)`、`artifact-panel` 空树补 `EmptyState`、`general-section` 的 `WebSearchSection` 三态 |

### 10.2 四处 P1 的处置

**① 侧栏误报「暂无历史任务」**（`App.tsx` / `sidebar.tsx`）

根因是三件事叠在一起：`taskList` 初值 `[]`（不是 `undefined`）+ `activate()` 里**先** `setLink({kind:"ready"})`
**再** `listSessions()` + `.catch(() => { })` 静默吞。于是 ready 之后、列表返回之前这段窗口判
`length === 0` → 渲染空态；失败则**永久**误报且无出口。（第 1 期修的是 `connecting` 窗口，
ready 之后在途的窗口没覆盖——同一缺陷的残留。）

处置：

- 初值改 `undefined`（与同文件 `experts` 同口径），失败写入 `taskListError`，成功**清空**它
  （否则重试成功后错误条赖着不走）。
- **Task 1.3 的口径**：既然「在途」已由 `taskList === undefined` 表达，侧栏原判断
  `link.kind === "connecting" ? undefined : groups.tasks` 里的 `link` 就是**多余的第二个真相源**——
  已去掉，任务区只认数据本身；顺序（先 ready 再拉列表）保留，因为 ready 是「引擎已就绪」的解闸信号
  （首页输入卡等它开门），首屏不该为一次列表往返延后。
- 断开（`link.kind === "down"`）时列表若**已有值**仍照常展示：数据没了才算没数据，断开本身由底部
  状态行如实说明，不拿转圈把用户还能看的历史清掉。

**② 定时任务页失败后零出口**（`automations-view.tsx`）

原结构 `{error !== undefined && <ErrorState/>}` 与 `{tasks === undefined ? <LoadingState/> : …}`
**并存**：拉取失败时 `tasks` 永远停在 `undefined`，页面永久停在加载态、没有任何恢复出口
（与第 1 期修掉的 `skills-view` 完全同型）。改为三态互斥 + `onRetry={() => void load()}`。
**头部不加刷新按钮**：三态互斥后错误态里已有重试，头部再加一个是语义重复的第二个入口。

**③ 专家页失败即死**（`App.tsx` / `experts-view.tsx` / `skills-view.tsx`）

全仓 `listExperts` **只在 `App` 的 `activate()` 里调一次**，`experts-view` 两处 `ErrorState` 都没有
`onRetry` → 失败后只能重启应用。处置：把拉取抽成 `reloadExperts()`（首拉与重试**同一条路径**，
不各写一份而漂移），与 `expertsError` 一起下发给专家页接 `onRetry`。
**多改了 `skills-view.tsx` 4 行**透传（专家市场入口渲染在 skills-view 内，同样两处错误态）。

**④ 工作空间文件视图扫描失败被伪装成「空目录」**（`artifact-panel.tsx`）

原写法 `.catch(() => setTree(createLazyTreeState([])))`：失败静默降级成空树，渲染出无任何条目的
`.file-tree`（连 `EmptyState` 都没有），且无重试。处置：

- 新增 `treeError` 状态 + `treeAttempt` 计数（cwd 没变时唯一的重拉路径，只作 effect 依赖触发重跑）。
- **`treeError` 与 `tree` 并列，不塞进 `LazyTreeState`**：那个状态机里的 `loadingPaths` 表达的是
  **单个文件夹**展开时的懒加载转圈，这里是**整个视图的数据源**没拉到，粒度不同；混进去会污染一个
  被单测覆盖的纯状态机（`workspace-file-tree.test.ts`），且它没有字段能承载错误文案。
- 错误分支**必须排在加载分支之前**：失败时 `tree` 也是 `undefined`，排后面会被「正在读取…」盖住。
- 保留原来的 `disposed` 守卫（组件已卸载时不 setState）。
- 扫描**成功但确实没有可索引文件**（空目录、或只有 `node_modules`/`.git` 这类被跳过的目录）→
  `EmptyState`（Task 4 补，原来与「还没扫完」在视觉上无从区分）。

### 10.3 P2：预览文案分流 / settings 10 处 / 四处瞬态

**预览失败文案按原因分流**（`artifact-panel.tsx`）：`servable = baseUrl !== undefined && cwd !== undefined`
是假的有两因，原先混成一句「请选择工作空间」——在工作空间**已选好**、只是预览服务挂了时给出错误指引。

| 条件 | 呈现 |
|---|---|
| `cwd === undefined` | `EmptyState`「选择工作空间后可预览文件」 |
| `cwd !== undefined && baseUrl === undefined` | `ErrorState`「预览服务未就绪，无法加载该文件」+ `onRetry` |

另有三处文本 / 代码 / Markdown 预览失败（`useArtifactText`）补 `onRetry`：bump `attempt` 序号重跑
effect（`path` 没变时唯一的重拉路径）。

**settings 10 处三态互斥**（原清单 8 处，实测多 2 处）：

| # | 分区 | 处 |
|---|---|---|
| 1-3 | `general-section.tsx` | 推理强度 / 默认存储路径 / 权限 |
| 4 | `general-section.tsx` | `WebSearchSection`（**新增的第 9 处**，Task 4 发现） |
| 5-6 | `memory-section.tsx` | 记忆开关 / 长期记忆 |
| 7 | `personalization-section.tsx` | 回复风格 |
| 8 | `prompt-section.tsx` | 提示词资源 |
| 9 | `settings-view.tsx` | 模型页配置 |
| 10 | `models-section.tsx` | 快照失败的 `ErrorState` 补 `onRetry`（**第 10 处**） |

统一形如 `error ? <ErrorState onRetry={…}/> : data === undefined ? <LoadingState/> : 内容`
（模板：`personalization-section.tsx`）。

**四处「在途被当空」改为走加载态**：

- `home-view.tsx` 模式页签：`scenes` 初值 `[]`（来自 `conversation.ts` 的 `availableScenes: []`）→
  快照落地前整行是**空行**。改判「快照落地」后三态互斥。
- `chat-view.tsx` 模式标签：`{current?.label ?? currentId}` 在 `availableModes` 未拉回时**回退显示裸 id
  `craft`**（内部标识暴露给用户，且它不是「当前模式」的名字）→ 未到位时给行内 `Spinner`。
- `plus-menu.tsx` 专家子菜单：调用侧原来传 `experts ?? []`，把「在途」与「库里确实为空」抹成同一态 →
  原样透传 `undefined`，子菜单区分「正在读取专家…」与「还没有可用专家」。
- `sidebar.tsx` 空间区：原「在途 / 失败 / 确实没有空间」三态都渲染**空**，现补「未就绪」的行内
  `LoadingState`；失败 / 断开**不在空间区重复第二张错误卡**（216px 窄栏里叠两个重试按钮只是噪音）。

### 10.4 必要支撑改动（都不是顺手改）

| 位置 | 改动 | 为什么是**必要**的 |
|---|---|---|
| `App.tsx` | 抽出 `reloadSessions()` / `reloadExperts()` | 错误态里的「重试」必须**真的能重拉**；原逻辑只写在 `activate()` 里跑一次。抽成函数后首拉与重试走同一条路径，不会各写一份而漂移——否则 `onRetry` 只能是空壳 |
| settings **4 个分区 / 区块**（共 5 个加载函数） | 抽出可重复调用的 `load` / `refresh`：`personalization-section`（`refresh`）、`prompt-section`（`load`）、`memory-section`（两处 `load`）、`general-section` 的 `WebSearchSection`（`refresh`） | 这几处原先**只在 `useEffect` 里跑一次**，没有可重复入口。Task 3.3 明确要求「不要写一个空壳 `onRetry`」。（`settings-view` 的 `load` 与 `general-section` 另三处 `refresh` 本来就有） |
| settings 上述 5 个加载函数 | 成功路径补 `setError(undefined)` | 失败写、**成功必须清**——否则「失败 → 重试成功 → 错误条赖着不走」，等于重试只修了一半 |

### 10.5 诚实标注（五条，必须写）

1. **4.1 的断开态只治「误导」，不治「自动恢复」**。`App` 的 `activate()` 挂在 `onDaemonReady` 上，
   daemon **启动即失败**时它压根没跑、`listSessions()` 永远不会返回 —— 旧行为是永久「正在读取…」
   （与旧版永久「暂无历史任务」同类的误导）。本期把它换成「连接已断开，未能读取历史任务」+ 重试
   （连接未恢复时重试会立即失败，但至少先给出**真原因**）。**真正恢复仍需重启应用**——
   `activate()` 不会重跑，本期没有造重连/重放机制。
2. **`home` 用 `cwd !== undefined` 当「快照已落地」是代理判据**，不是新契约：`scenes` / `cwd` 由
   同一次 snapshot dispatch 一起写入（`SessionState` 注释），不会漂移 —— 故它比
   `scenes.length === 0` 准确（后者把「还没到」与「确实没有」混为一谈）。**判据是既有契约的代理**。
3. **空间区故意不写「确实没有空间」的空态文案**。空间组由**会话派生**，没有会话的目录不形成组 ——
   空集合 **≠** 没有工作空间（用户可能已选过目录、只是还没在里面跑过任务），照写空态文案会给出
   **错误结论**。故只补「在途」的行内加载位，不补空态。
4. **settings 内容分支里的写入失败错误条故意不给 `onRetry`**：重拉会冲掉用户正在编辑的草稿；
   重试语义只属于「初次加载失败」那一支。（已登记进 DESIGN.md §4「豁免与刻意偏离」。）
5. **Task 2 的预览重试是面板侧兜底，且两份来源本身是技术债**。`App` 的 `refreshPreviewBaseUrl`
   只在 `cwd` 变化（effect）与 `artifacts_presented` 时触发 —— 「工作空间已选好、服务那一刻没起来」
   这一态 App 不会自动再试，所以面板必须自己给出口。重试结果连同取它的 `cwd` 一起记
   （`{cwd, url}` 打标），切了工作空间旧结果即失效，**绝不复用别的目录的端口**。
   但 `App` 的 `previewBaseUrl` 与面板的 `retriedBaseUrl` **是同一事实的两个真相源**——
   合成一处才干净，属本期未做的技术债。

### 10.6 人工验收清单（沙箱无 GUI，需人工确认）

1. **启动瞬间**：侧栏任务区应显示**加载态**，不再闪一下「暂无历史任务」。
2. **让 `listSessions` 失败**（断网 / 改 daemon 返回）：侧栏应显示**错误态 + 重试**，
   重试成功后错误条**消失**（不赖着不走）。
3. **daemon 未连上**（启动即失败）：侧栏应显示「连接已断开，未能读取历史任务」+ 重试，
   **不是**永久的「正在读取…」；空间区标题不应显示 `空间 (0)`。
4. **定时任务页首次失败**：应**只**显示错误态 + 重试（不再「错误条 + 正在读取…」同框）。
5. **专家库失败**：专家页两处错误态都应能**就地重试**（不必重启应用）；
   专家市场（技能页内）同样能重试。
6. **预览两种原因**：① 未选工作空间 → 「选择工作空间后可预览文件」；
   ② 工作空间已选、预览服务未就绪 → 「预览服务未就绪」+ 重试。**两者文案必须不同**。
7. **工作空间扫描失败**：文件视图应显示**错误态 + 重试**，而不是一个没有任何条目的空目录；
   扫描成功但目录确实没文件时才是空态。

### 10.7 本期刻意未做（及理由）

| 事项 | 理由 |
|---|---|
| MCP `needs-auth` 态（`connectors-view.tsx` + `shared/ipc.ts`） | 结构上确实把「需授权」与「连接失败」混成 `failed`（用户对 401 与「配置写错」得到同一句话，而处置动作完全不同）。但**要改 IPC 契约 + 产品需先定口径**，且是否命中取决于用户接入的 server 类型（stdio 本地 server 一般不触发）。**另立 spec** |
| `office-pptx.tsx` 的绝对定位浮层 / `diagnostics-view.tsx` 的 `.stat-hint`·`.stat-err` 行内状态 | **登记豁免**（理由见 DESIGN.md §4）：前者是 echarts canvas 在 `display:none` 下量到 0×0 画空白，必须用浮层；后者是行内单行读数，块级 `LoadingState` 放不下，也不为两处给 `state-views` 加 inline 变体 |
| `ModeSwitch` 弹层在 `availableModes` 未到位时的空列表 | 一次 IPC 往返的**瞬态**（快照落地前模式清单为空），未做一致化。头部标签那处已改（见 §10.3），弹层内的列表留作后续 |
| 第 1 期遗留的两处静默 catch | `App.tsx` 的空间元数据（回退 basename 后列表仍可用，弹 toast 反而打扰）、`chat-view.tsx` 的个性化（增强项不该拖垮等待行）——源码注释明示为**设计意图**，不属缺陷 |
| 模型菜单 / 权限菜单失败态 | DESIGN.md §4 表里仍标 ☐（本期未纳入范围） |
| 旧空态类名清理 / 禁用态补齐 | 已在第 1 期完成，无事可做 |

### 10.8 本期校验结论（Task 5 收官）

```
npm run typecheck    → 通过（tsc --noEmit 无输出）
npm run check:deps   → 通过（扫描 258 个文件。依赖方向校验通过。）
npm run check:tokens → 真违例 0 处 / 白名单命中 77 处 / 豁免 107 处（圆角 29 / 间距 73 / 时长 5）
npm test             → 95 文件 / 1717 用例全绿
npm run check        → 通过（上面三项的串联）
```

- 扫描文件数、`check:tokens` 的三项计数、用例数**与第 4 期基线完全一致**（258 / 0·77·107 / 95·1717）：
  本期只改 renderer 组件的状态分支，**未新增文件、未新增白名单条目**。
- 本期改动**没有新增自动化测试**：仓库无 DOM 测试基建（`vitest.config.ts` 是 node 环境、无 jsdom、
  `include` 只收 `src/**/*.test.ts`，见 §9.4 第 2 条），状态分支的可见行为只能靠 §10.6 人工验收。
  未为凑测试去加依赖或改配置（超范围）。

---

## 11. 交互顺滑度与质感打磨（spec #7，本期成果）

> spec：`.trae/specs/polish-interaction-smoothness/spec.md`，分支 `master`（该系列第 6 期）。
> 前 5 期把 token 地基、动效纪律、流式性能、桌面端硬伤、状态覆盖依次做完了；本期只收口
> **「用起来顺不顺」**——那些用户能反复感知、但前 5 期没覆盖的跳动与硬切。
> 另修正了 spec #2 的一处**账目错误**：MiSans 字体接线被打勾「已完成」，代码里从未落地（§11.4）。

### 11.1 本期做了什么

| 事项 | 结果 |
|---|---|
| **字体接线（账目修复）** | `index.css` 顶部两条 `@font-face`（400 / 600，`font-display: swap`）；`--font-body` 收敛为字体栈**唯一真源**（`"MiSans"` 插在 `"PingFang SC"` 之后），`body` 改为引用它。产物含两个 woff2（此前是死文件） |
| 滚动条占位横移 | 5 个主滚动容器加 `scrollbar-gutter: stable`：`.stream` / `.home` / `.settings-body`+`.skills-body`（共用一条选择器）/`.sidebar-scroll`。窄容器（`.thinking-body` / `.user-bubble` / `.pop-menu`）**不加**（判断依据写在文末「滚动条基线」块） |
| 4 个整页视图硬切 | `.settings` / `.skills` 共用一条 `page-in`（`transform` + `opacity`，`--dur-base` + `--ease-out`），**一条规则覆盖** `stats` / `skills` / `diagnostics` / `automations`；`.home` 复用同一条 keyframes（`settings` 自己的入场仍在 `.settings-card`，不重复） |
| 全站零骨架屏 | `state-views.tsx` 新增具名导出 `Skeleton`（**不带扫光**；底色 `color-mix(in srgb, var(--text) 8%, transparent)`——`--bg-raised` 铺在侧栏底上只差 5 个灰阶，等于没画）；接线两处收益最高的：侧栏任务区（5 条，行高与真行逐像素对齐）+ 文档预览 3 处（docx / pdf 的「白纸」、xlsx 的**满区滚动网格**——它刻意不是纸） |
| 侧栏 hover 让位抖动 | 让位宽度**常驻**（`.task-item-body` 72px / 空间组头 48px），操作钮只做 `opacity` 显隐；补 `.task-item-body:has(> .task-rename-input)` 处理重命名编辑态（否则输入框被压到 ~58px） |
| 侧栏折叠瞬跳 | 改「常驻 DOM + `data-sidebar` 类切换 + transition」（方案 A）——条件挂载的元素**挂载即终态**、`transition` 没有「起始态→终态」可跑，只能瞬跳；改用 `animation` 又只解决展开方向（收起方向随卸载消失）。`DESIGN.md` §5 登记**第二条 width 受控例外**（含实现附则） |
| 中文 IME 补全抽搐 | `autocomplete.tsx` 加 `composingRef` 守卫（先例：`experts-view.tsx`）：组合期间不 `recompute`，`compositionend` 用最终文本补算一次（Chromium 补的那个 `input` 事件不一定带 `isComposing=false`，不能指望 `onChange` 兜住最后一次） |
| 流式贴底丢帧 | 贴底调度 `useEffect` → `useLayoutEffect`（对照实测见 §11.2②） |
| 返回对话页整列上滑 | `.stream` 的 `stream-reveal` 收敛为「从空到有内容」首次揭示（挂在 `[data-reveal="true"]`，由 `chat-view` 在 render 期派生）；`.stream` 不再常驻动画声明 |
| resize 追手 | resize 手势期间停 `.preview-panel` 的 width 过渡（`[data-resizing="true"]`，160ms debounce 撤销；**未去掉**过渡本身，全屏切换依赖它） |
| `::selection` 外来蓝 | 改用 `color-mix(in srgb, var(--text) 14%, transparent)` 中性覆盖（不新增档位） |
| `.settings-card` 阴影偏轻 | `--shadow-md` → `--shadow-lg`（与同级 `.permission-card` 对齐） |

**必要支撑改动**（不是顺手改）：

- `composer.tsx`：IME 的 `onCompositionStart/End` 现在有**两套**守卫各管一件事（`ime-guard` 管 Enter 是否吞、
  `autocomplete` 管组合期间不重算候选），必须都接上——只接一套时另一套**静默失效**
  （`autocomplete` 的守卫恒为 `false`，本期的修复等于没做）。
- `artifact-panel.tsx` 只改注释：`maxPanelWidth()` 的契约从「侧栏收起时不渲染」换成「常驻但盒宽归零」，
  量到 0 的前提换了实现（见 §11.2③）。

### 11.2 三处关键实测证据

**① 字体是否真的生效**（这一步不能省——「声明了」不等于「生效了」）

产物（`npm run build`）：

```
out/renderer/assets/MiSans-Regular-EjI9NiHY.woff2    483904 B（483.90 kB）
out/renderer/assets/MiSans-Semibold-DclYHP1t.woff2   489152 B（489.15 kB）
```

哈希名出现在产物 CSS（`src: url("./MiSans-Regular-EjI9NiHY.woff2")`）→ vite 确实把 woff2 当资源打包了
（未接线时这两个文件不进产物，键就在于**只有被 `url()` 引用才会打包**）。

Electron 探针（离屏窗口）：`FontFace.status === "loaded"` —— 字体已下载并解析成功，不是 `unloaded` / `error`。

宽度度量（同一段文本、同一字号、600 字重）：

| 字体 | 实测宽度 |
|---|---|
| MiSans 600 | **195.18px** |
| 微软雅黑 600 | 196.32px |

两者不同 → 命中的是 MiSans 的**真实字形**，而不是回退到雅黑（若未命中，宽度会与雅黑逐像素一致）。

**② 贴底：`useEffect` vs `useLayoutEffect` 对照实验**

同样的流式场景，逐帧统计「底部是否有空隙」：

| 调度时机 | 有底部空隙的帧 | 最大空隙 |
|---|---|---|
| `useEffect` | 23 / 145 | 66px（≈3 行） |
| `useLayoutEffect` | **0 / 145** | — |

结论：不是理论担忧——`useEffect` 下约每 6 帧就有一次可见跳动，合批窗口（16ms）把它放大成规律抖动。
改 `useLayoutEffect` 后归零（顺带与 `turn-rail.tsx` 的测量口径统一了）。

**③ 侧栏折叠：`border-box` 下只归零 `flex-basis` 量不到 0**

| 折叠态做了什么 | 侧栏盒子实测宽 |
|---|---|
| 只写 `flex-basis: 0`（`box-sizing: border-box`） | **24.8px**（≈ `--space-4`×2 + 1px 边框） |
| 再归零 `padding-inline` + `border-right-width` | **0** |

为什么这 24.8px 是硬伤：`artifact-panel.maxPanelWidth()` 是**从 DOM 量侧栏盒宽**的（有意不抄常量，
避免与 CSS 双写漂移），量到 24.8px 会让面板上限凭空少 24.8px —— 归零才保住「收起 = 量到 0」的既有契约。

### 11.3 诚实标注（四条，必须写）

1. **Task 3 修正了 spec 的前提**：spec 说用户气泡缩略图会因横图解码从 200px 高掉到 ~90px（气泡收缩、
   下方内容上移）。实测（Electron 44）**改前并没有这个位移** —— TSX 上 `<img width height>` 的两个属性
   作为 presentational hint 本就生效，盒子一直稳定在 160×200。本期把 CSS 的 `max-height` 改成定高 `height`
   是**消除一条隐式依赖**（任何 `img { height: auto }` 口径的重置、或哪天去掉那两个属性，位移才会出现），
   **不是修一个现存的 bug**。口径按「预防」记，不按「修复」记。
2. **reveal 有一个已知边界**：判据是「`entries` 从 0 变非 0」。「切视图」与「首条回显」若落进**同一个 React 批**
   （同一 commit 内挂载 + 首条上屏），这一次就不播。方向是安全的：失手只会「少播一次揭示感」，
   不会把整列动画误播到长历史上。
3. **`::selection` 只写一条**：深色主题块（`tokens.css` 的暗色）尚未接线，当前唯一生效主题是亮色，故不另写。
   `--text` 在暗色下翻成白，覆盖色自动跟着翻、方向不变（暗底上仍是「比底色亮一点」），将来接线时不必补规则。
4. **侧栏常驻 DOM 的代价**：`Sidebar` 现在随 `App` 每次渲染一起 reconcile（亚毫秒级），换来的是折叠
   不再丢侧栏内部状态（滚动位置、展开的空间组、重命名编辑态）。若要消掉这点成本可给它上 `React.memo`，
   但**相对时间文案会因此只在 props 变化时刷新**（列表里的「3 分钟前」会停住）—— 本期选择如实暴露、不 memo。

### 11.4 修正一处账目错误：spec #2 的字体接线

`polish-ui-a11y-and-aesthetics` 把这四步都打了 `[x]`：

- `tasks.md:82`「@font-face 声明（`font-display: swap`）」
- `tasks.md:83-84`「index.css 字体栈插入（MiSans 在 Segoe UI 之前、雅黑之前），`font-weight: 600` 用真字重」
- `checklist.md:34-35`「Windows 中文：MiSans @font-face（400/600）+ 字体栈（雅黑兜底），子集 473/478KB ≤2MB」

**但代码里从未落地**：`resources/fonts/README.md:17-18` 描述的接线是**预期做法**，
`src/` 里 `@font-face` 与 `MiSans` 都是零命中，`body` 与 `--font-body` 各写一份**不含 MiSans** 的栈，
两个 woff2 是纯死文件（没被 `url()` 引用 ⇒ 不进产物）。后果是 Windows 上数十处 `font-weight: 600`
一直落在微软雅黑**合成加粗**上（笔画发虚、12-14px 小字号最明显），而团队以为这件事已经做完了。

本期真正接上（§11.1 第一行 + §11.2①），并把「字体栈唯一真源」写进 `DESIGN.md` §2.6 防复发。
`resources/fonts/README.md` 的描述现在与实现**一致**，无需改动（它当初写的就是对的做法）。

### 11.5 人工验收清单（沙箱无 GUI，需人工确认）

1. **600 字重不再发虚**（Windows）：品牌名、统计数值、按钮文字等 `font-weight: 600` 处笔画应实、不糊。
2. **对话首次跨过一屏**：不应再有整列文字横向重排（滚动条出现不再吃掉 6px 内容宽）。
3. **首页 → 统计 / 技能 / 诊断 / 定时任务**：应有柔和入场（不再硬切），且与设置页的入场同族。
4. **侧栏首屏**：应显示 5 条骨架（灰条错落），列表到达时**不竖向跳动**。
5. **打开 docx / pdf / xlsx 产物**：解析期应是「白纸」/「满区表格」骨架，不是居中转圈。
6. **鼠标划过侧栏任一行**：标题的省略号位置**不应跳变**（让位宽度已常驻）。
7. **中文打 `@` 后拼音检索**：补全菜单不应随候选串逐键重建、条目不应乱跳。
8. **折叠 / 展开侧栏**：宽度应平滑变化（不再是 216px 瞬跳），主区跟着平滑挤压 / 舒展。
9. **从设置返回一个长对话**：消息列**不应整列上滑淡入**（直接呈现）。
10. **拖窗口边缘**（【新增】）：右侧面板宽度**不应追着手走**；松手约 160ms 后过渡恢复。
11. **选中任意文本**（【新增】）：底色应是中性灰（不再是 Chromium 默认蓝）；深色按钮上的白字选不中属预期。

### 11.6 本期刻意未做（及理由）

| 事项 | 理由 |
|---|---|
| 场景 / 模式 / 专家切换改乐观更新 | 已核实 daemon 侧是**纯内存同步**（`session-host.ts` 只是 `setActiveToolsByName + emitState`），本机几毫秒、用户无感；引入本地乐观态反而多一个会漂移的真相源 |
| `.stream` 关掉 `overflow-anchor` | 默认 `auto` 的浏览器滚动锚定与「内容只在下端增长」方向一致，折叠上方内容时正好补偿。**确认无需改动** |
| `-webkit-font-smoothing` | macOS-only 属性，Windows 目标下无实际影响 |
| 内容卡加阴影 / 引入第四档阴影 | 内容卡纯描边无阴影是 WB 口径（有意）；三档阴影语义已站得住，加第四档会撞 `DESIGN.md` §2 的档位纪律 |
| tab 内容切换过渡 / toast 退场 / 刻度轨 hover 过渡 | 均为打磨项、收益低；本期不动，避免范围膨胀 |
| 右键菜单 | 属**新增交互**，需先定需求 |
| `-webkit-app-region` | **确认不适用**：`BrowserWindow` 用的是 Windows 原生标题栏（无 `frame: false`），当前实现正确 |
| `.capability-chip` 那条 2% 阴影 | 肉眼不可见，但**有 WB 原值依据**、不是违规；删它是零收益的洁癖 |
| `office-preview` 的 `Suspense fallback` 不接骨架 | 它等的是**渲染器 chunk**，而「纸多宽、格子多高」这些几何常量正属于被等的那个 chunk —— 在这一层画同形骨架要把 docx/xlsx 的尺寸各抄一份（两份几何必然漂移，反 AGENTS.md §4）；且 pptx 解析期本就是文字浮层（`DESIGN.md` §4 豁免①），三种 format 会出现三种等待语言。文案「加载渲染器…」与子组件的「解析文档中…」是两种可区分的等待 |

### 11.7 本期校验结论（Task 5 收官）

```
npm run typecheck    → 通过（tsc --noEmit 无输出）
npm run check:deps   → 通过（扫描 258 个文件。依赖方向校验通过。）
npm run check:tokens → 真违例 0 处 / 白名单命中 77 处 / 豁免 111 处（圆角 29 / 间距 77 / 时长 5）
npm test             → 95 文件 / 1717 用例全绿
npm run check        → 通过（上面三项的串联）
npm run build        → 成功（53.52s）；产物含 MiSans-Regular-EjI9NiHY.woff2 / MiSans-Semibold-DclYHP1t.woff2
```

- 扫描文件数仍 **258**、白名单仍 **77 条**（**未新增**）：本期只改既有文件的样式与接线，未新增源文件、
  未加任何例外。
- 豁免总数由 **107 增至 111**（差 4 全在「间距」类）：内置规则明文跳过的亚间距 / ≥48px 页面级留白
  （常驻让位的 48 / 72px、折叠态回调等）。**不是新造档位**，也不该收进白名单。
- 用例数与第 4 / 5 期基线一致（95 / 1717）：本期改的是 CSS、调度时机与守卫接线，
  仓库无 DOM 测试基建（`vitest.config.ts` 是 node 环境，见 §9.4 第 2 条），可见行为只能靠 §11.5 人工验收。
  未为凑测试去加依赖或改配置（超范围）。

---

## 12. 界面比例与质感收口（2026-09-19，用户直接提出，无 spec）

> 触发：用户拿 WorkBuddy 截图对照我们的首页，指出「界面比例差一点」，并要求一并审查
> 审美质感与顺滑度。与第 11 期的分工：**第 11 期管「动起来顺不顺」，本期管「静态比例
> 对不对、像不像 WB」**。证据一律取自本地解包参考物
> `docs/WorkBuddy-reference/extracted/`（逐值带 `file:line`）。

### 12.1 本期做了什么

| # | 改动 | 依据（本地参考物可核） |
|---|---|---|
| 1 | 侧栏展开宽 216 → **264px**（同步改了散落在 `index.css`/`sidebar.tsx`/`App.tsx`/`artifact-panel.tsx` 的「216px 窄栏」注释与算式） | WB `SIDEBAR_SIZE.EXPANDED_WIDTH = 264`（`ui-docs-viewer-C2jT2eXi.js:187382-187385`）；同值另见 `.claw-sidebar-drawer { flex: 0 0 264px }`（`ui-docs-viewer-D8SBBSEE.css:16955`）。旧值 216 无 WB 出处 |
| 2 | 首页输入槽渐变起点 `#ebebeb` → **`#f0f0f0`** | WB token `--wb-home-input-slot-bg`（`ui-docs-viewer-C2jT2eXi.js:93905-93911`）；`#ebebeb` 实为另一个 token `--wb-quick-action-sub-item-bg`（同文件:93913-93921）——**取错 token** |
| 3 | 输入卡描边 1px → **0.5px**（色仍取全站唯一 `--border`） | WB `.cr-input-container { border: 0.5px solid var(--cr-border-default,#ebebeb) }`（`lib-chat-ui-Co_VI_pZ.css:18403-18414`） |
| 4 | 输入卡底行控件统一 **32px**（只作用于 `.composer-bar` 内的 `.bar-btn` / `.bar-btn-text`） | WB `.cr-input-toolbar { min-height: 32px }`（`lib-chat-ui-Co_VI_pZ.css:12942-12952`）、`.cr-input-footer-item { height: 32px }`（同文件:19066-19079）。此前左组 `+` 是 28、右组 32 —— 正是本文件旧注释自认的遗留 |
| 5 | 能力胶囊水平内边距 12 → **8** | 参考物里所有 32px 高的 chip 都是 `padding: 0 8px`（`:19071`、`home-KqE7jadI.css:125`）；原注释引用的 `.quick-actions__item` 在参考物中**查无此选择器** |
| 6 | 侧栏滚动条 4 → **6px** | WB 侧栏/详情栏滚动条 6（`ui-docs-viewer-D8SBBSEE.css:31297`、`:47210`）；全站基线 `*::-webkit-scrollbar` 本就是 6 |
| 7 | 规范修复包 | 见 12.3 |

### 12.2 否决方案

- **侧栏保持 216px**：否决。216 是我们早期自定、**没有任何 WB 出处**；代价在本文件与
  `sidebar.tsx` 里被反复记录（「标题只剩几个字」「挤成一团」）。264 有两处独立出处且同值。
  **但保留一条未消解的不确定**（见 12.4 第 1 条）：若实机对照发现更窄，回退只改一个值。
- **折中 240px**：否决。两个 WB 版本都没有这个值，等于凭空造第三档；`DEFAULT_SIDEBAR_WIDTH = 240`
  是 **docs-viewer 的右侧详情面板**（另一个组件）的默认宽，不能拿来当左侧栏宽。
- **`.bar-btn` 全局改 32px**：否决。它还被产物面板 / PDF 翻页 / 窗口右上角面板开关组用着，
  其中 `.panel-toggle-btn` 的 `top` 是与 `chat-header` 的按钮中线对齐算出来的；全局改高会连带
  挪动那些行。本期只解决输入卡这一行（作用域收在 `.composer-bar`）。
- **删掉 `.widget-frame` 的 `height` 过渡**（审计把它记为未登记的布局属性过渡）：否决删除，
  改为**登记为 §5 受控例外 ⑤**。理由：挂件是跨文档 iframe，高度只能由宿主改盒子高；
  `transform: scale` 会缩放内容并让 iframe 内的点击/滚动坐标错位，而 RO 上报是防抖后的离散值，
  删了就是逐次跳变。**行为未变，只是把账记清楚**。
- **输入卡描边色也改成 WB 的 `#ebebeb`**：否决。会破「全站唯一 `--border`」这条收敛，
  只改描边**粗细**（0.5px）已能拿到 WB 的观感。
- **首页内容列 848 上探 1008**：否决。该「WB 原值」在本地参考物里**查不到出处**（见 12.4 第 2 条），
  凭一句旧注释改首页骨架风险大于收益。
- **顺手把 `.bar-btn` 与 `.mini-btn` 的字号/内边距一并按参考物重排**：否决。超出「比例与质感」范围，
  且参考物里的对应值取自比截图更新的版本，混用会引入无法验证的漂移。

### 12.3 规范修复包（用户点名的「我没说到的」部分）

| 类别 | 处置 | 处数 |
|---|---|---|
| 表单可访问名 | 只有 placeholder、无程序化标签的输入框补 `aria-label` | 11（设置各分区 + 侧栏两处行内重命名） |
| 键盘可达 | 诊断页「模型调用行」补 `role="button"` + `tabIndex` + Enter/Space；「最近任务」表在「开始」单元格放真 `<button>`（保留整行鼠标点击） | 2 |
| 禁止清单 | 诊断页原生 `<select className="ledger-select">` 换共享 `SelectField`；随之删除死 CSS `.ledger-select` | 1 |
| 字符当图标 | 文本 `×` 换 `icons.tsx` 的 `IconClose` | 8（清单内 6 + 审计范围外同规则 2） |
| 标点 | 空态短句末尾多余的 `。` 删除（相邻完整说明句保留句号） | 8 |
| 内容兜底 | markdown 渲染的 `<img>` 补 `loading="lazy"` / `decoding="async"`，并补 `.markdown img { max-width: 100%; height: auto }`（此前只有 `.preview-markdown img` 有这条，对话正文没有——大图会撑破消息列） | 2 |
| 四态缺口 | `.ex-card-use` 补 hover/active（并纳入共享 transition 名单） | 1 |
| 模态口径 | `context-usage` 的浮层声明了 `role="dialog"` 却无焦点管理 → 按 §7.3 反推为**非模态**，降级 `role="group"`（它本就外点即关、不阻断页面） | 1 |
| SVG 基线 | 3 处关闭按钮（`.cu-close` / `.pending-tip-close` / `.team-bar-close`）补 `inline-flex` 居中 —— 字符换 SVG 后不属于 flex 容器会按基线对齐、盒子高 2~4px | 3 |

### 12.4 诚实标注

1. **参考物版本比用户截图新**：参考物是带 `sidebar-next` / `claw` 新壳层的版本，用户截图那版
   （WorkBuddy 5.5.6）的侧栏按截图量算约 216px —— 与 264 冲突，**未消解**。本期取「有出处的值」，
   并在 DESIGN.md §3.7 留了回退点（改一个数即可）。
2. **首页几何的一批「WB 原值」在本地参考物中查不到**：`.wb-home-page` 的 max-width（848/1008/1681）、
   `.wb-home-header__title` 的 30/42、`.wb-scene-tabs` 的 36/2、`.quick-actions__item`、
   `.wb-related-playbooks__*`、案例槽 `bottom: 56px` —— grep 全部无命中（`not found in reference`）。
   能坐实的只有 `min-height: max(calc(432px + 220px), 100%)`（`home-KqE7jadI.css:41-43`，与我们等价）
   与 `--wb-font-body-size/-line-height = 14/22`。**没有出处的值一律不动**。
3. **沙箱无 GUI，所有视觉改动未经人眼验收**：证据只有「参考物逐值对照 + 静态检查 + 构建通过」，
   观感结论需人工按 12.5 的清单确认。
4. **仓库无 DOM 测试基建**（`vitest.config.ts` 是 node 环境）：本期 a11y 改动靠 `tsc` + 人工走查，
   没有自动回归；`tsc` 只能保证类型，**证明不了焦点环与读屏体验**。
5. **两处未纳入本期的同规则违例**：`chat-view.tsx` 的空会话消息流仍无空态引导（DESIGN.md §4 已登记为缺口）。
6. **一处已知范围外改名**：`.ledger-select` 删除后 `diagnostics-view` 的会话选择器视觉由
   `SelectField`（`provider-select-trigger` 一族）决定，与设置页下拉**同源**，与它原来的原生
   select 外观不同 —— 这是 DESIGN.md §6 要求的方向，但确实是一处用户可见的观感变化。

### 12.5 人工验收清单（建议按此顺序看）

1. 首页：侧栏变宽后，任务行标题是否更少被截断；输入卡那圈灰带是否更浅、描边是否更细。
2. 输入卡底行：`+`、模式/专家 chip、模型 chip、发送键是否**同高（32px）**、中线齐平（首页与对话页各看一次）。
3. 首页能力胶囊：内边距变窄后 4 个胶囊是否更紧凑、与输入卡左缘对齐。
4. 对话页：Tab 到输入框 → 焦点环可见；发一条含图片链接的回复看图片是否被限制在列宽内。
5. 诊断页：Tab 到「模型调用行」能否用 Enter 选中；「最近任务」的「开始」单元格能否 Tab + 回车选中；
   会话选择器换成了自绘下拉。
6. 键盘走查设置页各分区：Tab 进 API Key / 模型 ID / 画像 / 记忆 / 自定义指令，读屏应能读出名称。

### 12.6 本期校验结论

```
npm run typecheck    → 通过（tsc --noEmit 无输出）
npm run check:deps   → 通过（依赖方向校验通过）
npm run check:tokens → 通过（真违例 0；渐变那条白名单条目的 snippet 由 #ebebeb 改为 #f0f0f0，条数未增）
npm test             → 161 文件 / 2976 通过 + 1 skipped（基线用例全绿）
npm run build        → 成功（36.48s）
```

---

## 13. 交互动效补齐（2026-09-19，用户直接提出）

> 触发：用户「还有不少东西的交互动画呢，那些动效，虽然已经有一些有了不过还有不少是没有的」。
> 第 12 期解决**静态比例**，本期解决**状态变化的过程**：hover 变色、按下反馈、展开入场。
> 方法：机械枚举全文件的 `:hover`（146 处）、`transition:`（60 处）、`:active`（42 处）、
> `animation:`（25 处），与既有的三张名单（末尾共享过渡清单 / 三组按下态批量块 / 条件挂载入场）
> 逐类求差集，再按「这个类是不是真交互元素」筛一遍。

### 13.1 做了什么（三类，共 148 处）

| 类别 | 处置 | 规模 |
|---|---|---|
| A. hover/变色硬切 | 末尾共享过渡清单由 **13 个类扩到 84 个**：按钮/图标钮/chip/卡片 47 + 整行可点（导航行/列表行/菜单项/树行/表格行/时间线行）37 | +71 |
| B. 缺按下态 | 三组批量块各自扩容 + 两个特例：`.96` 图标钮 3→16、`.98` 文字按钮/chip/卡片 8→31、底色加深 16→33；`.jump-to-bottom` / `.artifact-preview-btn` 单独立两条（transform 兼定位） | +55 |
| C. 展开/出现硬切 | 新增共用 keyframes **`fold-in`**（-4px 上移 + 淡入），套在 7 处条件挂载的流内展开体；`.image-preview-overlay` 补背板淡入 + 图片 `pop-layer-in` | 9 处 |

另有三处零散修复：
- **`.ac-item` 补 hover 底**（`@`/`/` 补全下拉此前只有键盘选中态，鼠标划过完全没有反馈）；
- **`.space-group-actions` 补 opacity/visibility 过渡**（与 `.task-item-ops` 是同一个交互，
  那边渐变、这边硬闪；含进出场不对称，§5.8）；
- **`.mode-tab` / `.context-chip` / `.artifact-card` 的 transition 补 `transform`**、
  **`.turn-duration` 补 `color`**（它是父行 hover 时真正变色的元素，父级在共享名单里管不到它）。

### 13.2 刻意不补（连同理由登记，避免下一轮重复尝试）

| 项 | 为什么不补 |
|---|---|
| `.skill-card` / `.model-card` 的 hover `box-shadow` | §5.1 只许动 transform/opacity/visibility；box-shadow 过渡逐帧重绘，且 `.skill-card` 是纯展示卡 |
| `.expert-chip` 的「头像 ↔ ×」原位互换 | 用 `display: none ↔ inline-flex` 做显隐，`display` 不可过渡；改 opacity/visibility 要重排 DOM，收益不抵风险 |
| `.mcp-row` 连 hover 都没有 | 见 9010 行注释：容器行，本身不可点（点击目标是行内开关） |
| `.ac-item` 的 `:active` | 取词走 `onMouseDown`，按下的下一帧菜单就关了，按下态看不见 |
| 容器行（`.space-group-header` / `.auto-row` / `.preview-tab-item`）的 `:active` | 给容器加按下态 = 「按行内任一按钮时整行也变色」，与「整行是按钮」的错觉叠加（同 9009 行口径）；它们的 hover 渐变照给 |

#### 否决方案

- **维持「列表行 / 菜单项不加过渡」的旧决策**：**否决**。旧理由（「按下再叠 150ms 渐显会显得迟钝」）
  在「hover 5% → 按下 8%」这种 3% 底色差上不成立；DESIGN.md §3 本就写着「所有四态过渡走
  `--dur-fast`」，旧的实现与该条自相矛盾；WB 自己的侧栏行也是带过渡的
  （`.cb-sidebar-nav__item` 的 `transition: all .2s ease`，lib-chat-ui-Co_VI_pZ.css:45492-45505）。
  **按下反馈的力度一字未改**（仍是「加深一档底色」），变的只是过程。
- **用 `transition: all` 一次盖全**：否决。§5.1 禁止；且会把 `.jump-to-bottom` 这类
  「transform 兼定位」的元素一起拖进来，按下即跳位。
- **给 `.jump-to-bottom` / `.artifact-preview-btn` 直接用通用的 `scale(.96)`**：否决。
  两者的 transform 兼着居中定位（`translateX(-50%)` / `translateY(-50%)`），通用值会把定位丢掉；
  改为合成写法 `translateX(-50%) scale(0.96)`，并单独立规则（通用名单的特异性更高，不能混在一起）。
- **把 `:active` 补在各组件定义处**：否决。末尾三条批量块与各定义处同为 (0,1,0) 且排在最后，
  定义处会被整条顶掉（本文件已在两处注释里踩过这个坑）。
- **流内展开体沿用弹层的 `pop-layer-in`**：否决。它含 `scale(.98)`，套在全宽块上会让整块文字跟着缩，
  读作「抖一下」；新立 `fold-in`（只做 -4px 上移 + 淡入），把「浮层从触发点长出来」与
  「流内块从头部展开下来」两种语义分开。
- **`.widget-frame` 的 `height` 过渡**：第 12 期已否决删除（登记为 §5 受控例外 ⑤），本期不动。

### 13.3 诚实标注

1. **沙箱无 GUI，本期观感一律未经人眼验收**：证据只到「属性层面逐类对齐 + 静态检查 + 构建通过」，
   **按下去的力度对不对、150ms 是不是偏慢，只有人眼能判**。
2. **影响面很宽**：末尾那张共享清单现在是全站交互手感的唯一入口，一条写错会波及几十处控件。
   风险已用「不引入布局属性过渡」这条硬线兜住（§5.1 复核过），但**手感属于主观项**。
3. **一处结构性隐患已记在注释里**：`.jump-to-bottom` / `.artifact-preview-btn` 的 transform 兼定位，
   将来给同类元素补 `:active` 时必须先确认它有没有 transform，否则一按就跳位。
4. **`.case-card` 的一条空转声明被激活**：它 1996 行原本就写了 `transition: transform`，
   但一直没有按下态，等于死声明；本期补了 `:active` 才真正生效。
5. **没有引入新的时长/缓动档**：全部取 §2.8 的 `--dur-fast` / `--dur-base` / `--ease-out` /
   `--ease-standard`；`fold-in` 是一支 animation（动画语义），不占时长档位。

### 13.4 人工验收清单（按出现频率排序）

1. **侧栏**：悬停导航项/分组标题/任务行是否平滑渐变（此前硬切）；按下是否加深一档；
   悬停任务行时「⋯」浮现是否渐变（此前硬闪，`.space-group-actions` 同）。
2. **对话页**：`+` / 模型 chip 按下是否缩放；点思考块标题时正文是否淡入上移；
   `@` 补全下拉用鼠标划过候选是否有底（此前完全没有）；点缩略图全屏看图是否淡入。
3. **首页**：能力胶囊与模式页签按下；案例卡按下整体缩一下。
4. **产物面板**：文件树行、tab 关闭钮、工具栏按钮的悬停与按下。
5. **诊断页**：模型调用行、最近任务行的悬停/按下（这两行是上一轮刚补的键盘可达行）。
6. **团队栏**：开跑时状态栏淡入、Ctrl+T 任务板淡入、展开成员列表淡入。
7. **全局回看**：整体是否出现「动效过多/过慢」的观感（这是本次扩面的主要风险）。

### 13.5 本期校验结论

```
npm run typecheck    → 通过（tsc --noEmit 无输出）
npm run check:deps   → 通过（扫描 408 个文件）
npm run check:tokens → 通过（真违例 0）
npm test             → 161 文件 / 2976 通过 + 1 skipped
npm run build        → 成功（33.62s）
```

---

## 14. 右侧面板开合动效（2026-09-19，用户直接提出）

> 触发：用户「右侧边栏没有动画」。指的是右侧**面板位**（产物预览 / 引用来源 / 任务诊断）
> 的打开与关闭 —— 左侧栏折叠早有 `flex-basis` 过渡（DESIGN.md §5 受控例外 ④），
> 右侧一直没有，观感不对称。

### 14.1 症状与根因

面板三个占用者都是**条件挂载**（`{view === "chat" && (taskDiagOpen || panelOpen) && …}`），
挂载即终态 —— `transition` 没有起点可跑。而它推开的是消息列（占布局宽度），
于是每次开合的观感是**两件事同时硬切**：面板凭空出现/消失 + 消息列宽度瞬跳。

### 14.2 做了什么

1. **加一层常驻容器 `.panel-slot`**（App.tsx + index.css）：宽度在 `0 ↔ panelWidth`
   之间过渡，面板本体仍是条件挂载的内容，靠容器的 `overflow: hidden` 裁掉溢出 ——
   于是「面板带着内容一起滑走」，而不是「空壳滑走 + 内容先消失」。
2. **关闭时内容延迟 `PANEL_EXIT_MS`(200 = `--dur-base`) 再卸载**：立刻卸载的话，
   收窄的第一帧内容就没了，滑走的是空壳，观感上仍是凭空消失。卸载那一刻容器已收到 0 宽，
   内容早被裁掉，因此这一步看不见。顺带记下「正在显示谁」（`panelContent`）——
   否则关闭时 `taskDiagOpen/sourcesOpen` 已置 false，三元会落到 ArtifactPanel，
   滑走的过程里内容会「换脸」成另一个面板。
3. **三处附则照抄左侧栏折叠的坑**：`display: flex`（面板靠交叉轴拉伸拿到 100% 高，
   退化成 block 会让面板内部滚动区撑不满）、`visibility` 参与过渡（收成 0 后才移出
   Tab 序 / a11y 树，滑动期间保持可见）、`overflow: hidden` 常驻。
4. **全屏态停过渡**（`[data-fullscreen="true"]`）并让容器宽度归零（全屏面板是 abspos，
   不占 flex 宽，照旧盖满主区）。
5. **`.preview-sash` 热区由 `left: -2px` 改为 `left: 0`**：容器裁掉了跨到外面的 2px，
   不改就只有 2px 命中区（4px 完整保留，hover 显色位置几乎不变）。

#### 否决方案

- **只做入场 animation（按 §5.7「条件挂载不做退场」）**：否决。关闭那半仍是瞬跳，
  而「关闭 + 消息列变宽」恰恰是用户更常触发的一次；且会继续与左侧栏不对称 ——
  用户报的就是这个不对称。
- **让面板本体常驻、关闭只收宽度（内容一直挂着）**：否决。pptx/office 预览的 canvas
  在 0 宽下测量会画成空白（DESIGN.md §4 豁免① 同源问题），Monaco/PDF 也白占内存与后台工作。
- **用 `transform: translateX` 滑入**：否决。面板是**让位栏**，transform 不改变布局宽度，
  消息列仍会瞬跳 —— 与 §5 例外 ④ 拒绝 transform 的理由同源。
- **全屏切换也一起动画**：否决。全屏时面板已 absolute 盖满主区，「滑」的那一刻被它自己遮住，
  只换来一串逐帧重排。
- **把面板位提升成 `.app` 的直接子元素再动画**：否决。三个面板组件各自渲染
  `<aside class="preview-panel">`，改结构要同时动三个组件；套一层容器是同效果的更小改动。

### 14.3 诚实标注

1. **代价与左侧栏折叠同款**：滑动期间消息列逐帧重排（ChatView 的 ResizeObserver 会跟着
   更新内容列宽，约 12 帧布局）。已知并接受，与 §5 例外 ④ 的记载一致。
2. **`PANEL_EXIT_MS = 200` 是手抄的第二份 `--dur-base`**（TSX 读不到 CSS 变量），
   改 tokens.css 要同步改它；已在代码注释里写明。
3. **沙箱无 GUI，观感未经人眼验收**：本节的证据只到「结构 + 属性层面」。
4. **侧内换面板（诊断↔来源↔产物）仍是即时替换**，没有交叉淡化 —— 同一容器里的内容替换，
   不在本次范围内（若要动效需另做，属新需求）。

### 14.4 人工验收清单

1. 对话页点右上角面板开关/产物卡：面板应**滑出来**且消息列同步变窄（此前是瞬跳）。
2. 关闭面板：面板**带着内容滑走**，内容不应在滑动开始时先消失。
3. 打开面板后切「任务诊断 / 引用来源 / 产物预览」：内容即时替换（本条不要求动画）。
4. 面板全屏切换：瞬时（按设计），全屏时消息列不应被容器压窄。
5. 拖拽面板左缘调宽：跟手（`[data-dragging]` 停过渡的既有行为不该被破坏），
   且 4px 热区仍好抓。

### 14.5 本期校验结论

```
npm run typecheck    → 通过（tsc --noEmit 无输出）
npm run check:tokens → 通过（真违例 0）
npm test             → 161 文件 / 2976 通过 + 1 skipped
npm run build        → 成功（41.23s）
```

---

## 附：维护约定

- 新增「确实不归档」的值 -> 加白名单条目，**必须**写 `reason`；优先给 `snippet`（行文本片段），
  `line` 只作提示，避免行号漂移导致条目失效。
- 想加第 N 条例外前先想清楚：它是不是「与 token 等值的漏改」（那就直接换 `var()`）、
  是不是「设计尺度」（那就该归档）、还是「有独立语义的场景值」（那才进白名单）。
- 白名单输出里的「未命中告警」是给你复核用的：对应的违例被收敛了，就该删掉这条。
