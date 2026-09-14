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
| 动效属性改造（`.tool-detail-box` 等 9 处布局属性过渡 → transform/grid；`.text-shimmer` 的 `background-position` 扫光） | spec #3 动效 |
| 长列表虚拟化、流式渲染合批、`widget-view` memo 化 | spec #4 性能 |
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

## 附：维护约定

- 新增「确实不归档」的值 -> 加白名单条目，**必须**写 `reason`；优先给 `snippet`（行文本片段），
  `line` 只作提示，避免行号漂移导致条目失效。
- 想加第 N 条例外前先想清楚：它是不是「与 token 等值的漏改」（那就直接换 `var()`）、
  是不是「设计尺度」（那就该归档）、还是「有独立语义的场景值」（那才进白名单）。
- 白名单输出里的「未命中告警」是给你复核用的：对应的违例被收敛了，就该删掉这条。
