# 设计标准落地（地基）Spec

> **分支**：`feat/ui-design-system` —— 本分支专门做界面优化，本 spec 是它的第一个交付（地基）。
> 后续 #2 状态补齐、#3 动效、#4 性能、#5 桌面端硬伤均在本分支继续。

## Why

`DESIGN.md` 与 `src/styles/tokens.css` 已建立标准，但标准目前是**悬空**的：
`tokens.css` 未被任何组件 import，`index.css` 里仍是 7604 行散落硬编码
（字号 156 处、间距声明 412 处、时长 57 处、圆角 17 处、z-index 10 处、颜色约 19 处），
且缺失可复用的空/加载/错误态组件（13 种空态类名、10+ 种加载文案各写一遍）、
`:active` 全站仅 2 处、reduced-motion 只有 7 处局部覆盖。

**标准不落地等于没有标准**：新写的代码会继续复制第 14 种空态、第 6 套 spinner、
第 58 个散落时长。本 spec 打通地基，使后续任何界面改动都有可依的 token 与可复用的状态组件。

## What Changes

- **token 接线**：`index.css` 顶部 `@import` tokens.css；删除 `index.css` 的 `:root` 块
  （56–120 行）与 3 个局部变量家族；按变量名映射表完成改名（**BREAKING**：`--text-dim`
  → `--text-secondary`、`--shadow-card` → `--shadow-md`、`--shadow-questionnaire` → `--shadow-sm`）。
- **全站按档收敛**：硬编码视觉值按 DESIGN.md 的档位**归档**（规则见下节「档位归档规则」）——
  允许观感变化，但**必须是向好**：更统一、更规整、层级更清晰、桌面密度更合理。
- **抽取 4 个共享组件**：`EmptyState` / `LoadingState` / `ErrorState` / `Spinner`，
  替换现有散落实现（列明清单），此后禁止新造同类类名。
- **全局基础面**：补齐 `:active` 四态、加 reduced-motion 全局兜底、嵌套滚动容器
  `overscroll-behavior`、滚动条基线样式。
- **新增 `check:tokens` 机械校验**（`scripts/check-design-tokens.ts`）：扫 `index.css` 与
  `*.tsx`，报出未走 token 的视觉值，支持白名单；接入 `npm run check`。
- **例外项登记**：不归档的值（亚间距 2px、微圆角 1–3px、WB 原值、页面级大留白、循环动画时长、
  三方内容）进白名单，并在 `docs/design-tokens-migration.md` 逐条写明语义。

## 档位归档规则（本轮核心执行依据）

收敛原则：**就近归档；距离相同时向下取（保持桌面生产力工具的密度）**。
每个档位都配了处数（实测自 `index.css`），实现时按此表逐类处理。

### 间距（档位 4 / 6 / 8 / 12 / 16 / 24 / 32）

| 现值 | 归档 | 处数 | 说明 |
|---|---|---|---|
| 1px、3px | 2px | 16 | 亚间距统一到 2px 网格 |
| 2px | **保留**（亚间距例外） | 48 | 图标贴合/角标等紧凑场景；归 4 会破坏布局 |
| 5px | `--space-1` (4) | 17 | 就近向下 |
| 7px | `--space-2` (6) | 20 | 就近向下 |
| 9px、10px | `--space-3` (8) | 78 | 就近向下；桌面密度取向 |
| 14px | `--space-4` (12) | 18 | 就近向下 |
| 18px、20px | `--space-5` (16) | 21 | 就近向下 |
| 22、26、28、30px | `--space-6` (24) | 8 | 就近 |
| 36、40、44px | `--space-7` (32) | 4 | 就近 |
| 48px 及以上（48/50/52/64/72/220） | **保留**（页面级留白例外） | 9 | 非组件尺度（hero 留白、固定高度） |
| 负值（-4px、-5px） | **保留** | 2 | 负 margin 是布局手段，归档无意义 |

**实测偏差处理**：若某处归档后明显过挤或过松（典型是「固定高度容器内的 padding」），
按**就近向上**处理并在该行注释原因，同时登记白名单——不为了表格整齐牺牲可用性。

### 字号（档位 12 / 13 / 14 / 15 / 30）

| 现值 | 归档 | 处数 | 说明 |
|---|---|---|---|
| 10px | `--text-meta` (12) | 4 | 极小 tag/头像字，升档提升可读性 |
| 16px | `--text-emphasis` (15) | 3 | 几乎无感 |
| 18px | `--text-emphasis` (15) | 3 | 归后若层级不足，用 `font-weight: 600` 补（字重只此一档） |
| 20px | `--text-display` (30) | 1 | `.stat-value` 统计数值——大数值展示，放大更醒目（dashboard 惯例） |

### 圆角（档位 6 / 10 / 16 / 999）

| 现值 | 归档 | 处数 | 说明 |
|---|---|---|---|
| 8px | `--radius-sm` (6) 或 `--radius-md` (10) | 5 | 按语义：搜索框/按钮 → sm；弹窗内提示块 → md |
| 7px | `--radius-sm` (6) | 实现时统计 | 就近 |
| 4px、5px | **保留**（低于 sm 的微圆角例外） | — | badge / 小按钮 / 进度 thumb；归 6px 会显得过圆 |
| 12px | `--radius-md` (10) 或 `--radius-lg` (16) | 6 | 浮层大卡/消息条目 → md；`.cases-action`（24 高之半的胶囊）→ `--radius-full` |
| 1/2/3px | **保留**（微标记例外） | — | favicon、进度 thumb、badge |
| 22/24px | **保留**（WB 原值例外） | 2 | 输入卡/首页槽，须带注释 |
| 50% | `--radius-full` | — | 圆形 |

### 时长（档位 150 / 200 / 280ms）

| 现值 | 归档 |
|---|---|
| 0.12s、0.15s、0.16s、0.18s | `--dur-fast` (150ms) |
| 0.2s、0.24s | `--dur-base` (200ms) |
| 0.28s、0.3s、0.32s | `--dur-slow` (280ms) |
| 0.8s、1.1s、2s、2.2s | **保留**（循环动画例外：spin / pulse / shimmer 的周期是动画语义，非交互动效时长） |
| `cubic-bezier(0.33, 1, 0.68, 1)` | `--ease-out` |

### z-index（档位 1 / 30 / 90 / 100 / 200）

| 现值 | 代表选择器 | 归档 |
|---|---|---|
| 1 | `.turn-rail`、`.preview-sash`、`.office-overlay`、`.settings-card-close`、`.provider-select-panel`、`.jump-to-bottom` | `--z-base` |
| 10、20、21 | `.ws-backdrop`、`.ws-popover`、`.space-menu`、`.entry-toolbar`、`.mode-menu`、`.mode-menu-sub`、`.permission-menu` | `--z-panel`（backdrop 与子菜单同档，靠 DOM 序分层） |
| 30、31、40 | `.ac-menu`、`.cu-popover`、`.preview-menu`、`.preview-panel.fullscreen`、`.model-menu`、`.plus-menu`、`.plus-menu-sub`、`.panel-toggle-btn`、`.sidebar-toggle-btn` | `--z-overlay` |
| 90 | `.image-preview-overlay`、`.ex-modal-mask` | `--z-overlay` |
| 100 | `.modal-backdrop` | `--z-modal` |
| 100 | `.toast-stack` | **`--z-toast` (200)** ← 修正项：toast 须盖住模态 |

### 颜色

| 项 | 处理 | 说明 |
|---|---|---|
| 文字四级 → 三级 | `rgba(0,0,0,.7)` 的引用点 → `--text-secondary` (.5) | 层级更克制；见 REMOVED 说明 |
| 遮罩 5 档 → 1 档 | 32%/40%/55%/72%/78% → `--overlay` (40%) | 模态背板统一强度；光效预览等特殊场景若确需更暗，登记例外 |
| 分类调色板 3 套 → 1 套 | `--seg`(6 色) + `comp-*`(5 色) + `cu-seg-*`(4 色) → 新建全局 `--cat-1..6`，三处共用 | 取 `--seg` 六色为基准；`#d9822b` 与 `--warning` 撞值，换色相 |
| 与 token 等值的硬编码 | 直接换 `var()`（`#f2f2f2`→`--bg-sidebar`、`#1470b4`→`--accent` 等 19 处） | — |
| 死代码 | 删除被 `color-mix` 覆盖的 3 行硬编码 | — |
| `--kw-*`（iframe 平行 token） | 值 SHALL 与宿主 token 对齐 | 注入机制另议，见差异清单 |

**明确不做（另开 spec 或待决策）**：

| 事项 | 去向 |
|---|---|
| 12 个主界面的 7 状态逐页补齐（空会话引导、MCP 授权态、模型卡「去配置」动作等） | 另开 spec（#2 状态补齐） |
| 动效属性改造（`.tool-detail-box` 等 9 处布局属性过渡 → transform/grid） | 另开 spec（#3 动效） |
| 长列表虚拟化、流式渲染合批、`widget-view` memo 化等性能改造 | 另开 spec（#4 性能） |
| 焦点陷阱与焦点归还、Esc 层级仲裁、拖拽越界拦截、最小宽度溢出 | 另开 spec（#5 桌面端硬伤） |

## 适用性边界（哪些场景豁免 —— 本 spec 的重要前提）

通用要求（走 token / 四态 / 八种状态 / 只动 transform）**不按一刀切执行**。本项目的实际构成是
Electron 桌面端 + 沙箱 iframe + 三方预览组件（Monaco / pdf.js / Office），且已声明若干 WB 原值
例外；按下表分级。

### A. 视觉值必须走 token

| 场景 | 要求 |
|---|---|
| 本项目自有样式（`index.css` 全部规则、自有 `.tsx`） | **必须**走 token（按「档位归档规则」收敛） |
| 几何值：`0`、`1px` 边框、`50%`、`100%`、`100vh`、`translate(-50%)`、`inset: 0` | 豁免（不是"视觉值"） |
| WB 原值例外：输入卡 24px / 首页槽 22px / 1–5px 微圆角 | 豁免（DESIGN.md §2.7 已声明，**须带注释**） |
| 三方组件注入的内联样式（pdf.js 画布、Monaco、Office 预览） | 豁免（不是我们的样式） |
| iframe 内用户内容（`widget-view` 的 `--kw-*`） | 本轮不动，列差异清单（跨上下文注入是独立问题） |

### B. 状态覆盖按组件类型分级

| 组件类型 | 空 | 加载 | 部分 | 失败 | 禁用 | 四态 | 焦点管理 |
|---|---|---|---|---|---|---|---|
| 数据驱动视图（列表 / 页面 / 面板） | 必须 | 必须 | 视场景 | 必须 | — | — | — |
| 交互控件（按钮 / 输入 / 菜单项） | — | — | — | — | 必须 | **必须** | 焦点环 |
| 异步控件（模型菜单 / 权限菜单 / 连接器行） | 若可空 | **必须** | — | **必须 + 重试** | 必须 | 必须 | 焦点环 |
| 纯展示组件（刻度轨 / 用量圆环 / 图标） | — | — | — | — | — | — | — |
| 浮层（菜单 / 弹窗 / 问卷） | — | — | — | — | 必须 | 必须 | Esc + 外点 + 焦点 |
| 三方内容容器（widget / pdf / office / code 预览） | 必须（**外层**） | 必须（**外层**） | — | 必须（**外层**） | — | — | 内层不要求 |

- 「部分加载」**只在增量/流式场景适用**（消息流、产物面板切文件），静态列表不适用。
- **无异步的控件不需要"加载中/空/失败"** —— 那是给数据视图的，套到按钮上是过度设计。
- 三方内容容器只对我们的**外层容器**提要求（加载指示、失败兜底），iframe 内/画布内不管。

### C. 动效只动 transform / opacity

| 场景 | 要求 |
|---|---|
| 本轮**新增**的动效 | **必须**只动 transform/opacity，时长缓动取自 token |
| 本轮顺路能修的高频问题：`font-weight` 过渡（`index.css:1318`，改动小、收益直接） | 修 |
| 扫光 `.text-shimmer` 的 `background-position` 动画 | **本轮不改**（需改 HTML 结构加伪元素，用在多处，视觉风险中等），排入 #3 |
| 存量布局属性过渡（`.tool-detail-box` 9 属性等约 9 处） | **本轮不改**，排入 #3 动效 spec |
| `prefers-reduced-motion` 的 `0.01ms` | 豁免（它本身就是"关动效"） |
| SVG `stroke-dashoffset`（圆环进度） | 豁免（SVG 惯用法，改造收益远小于成本） |
| `scrollbar-color` 过渡 | 豁免（影响面极小） |
| iframe 内 | 不管 |

### D. 键盘与焦点

| 场景 | 要求 |
|---|---|
| 本项目自有交互元素 | 可 Tab 到达 + 焦点环可见（全局已有 `:focus-visible`） |
| 「Tab 顺序合理」 | 只要求**不倒序、不跳脱**；不为此重排 DOM（风险大于收益） |
| Esc 关闭浮层 | 新增/改造的浮层**必须**；存量漏配（plus-menu / space-menu / cu-popover）**本轮顺手补** |
| 焦点陷阱 / 焦点归还 | 本轮**不做全站改造**；新增浮层按 DESIGN.md §7.3 执行，存量补齐排入 #5 |
| 三方内容（Monaco 等） | 豁免（其自身已实现） |

## Impact

- Affected specs: 无功能语义变更；与已完成 spec `polish-ui-a11y-and-aesthetics`
  （token 体系首版）是**续作关系**——那次只立了圆角/字号/琥珀色三组，本次接线并扩到全量。
- Affected code:
  - `src/renderer/index.css`（主体，约 670+ 处替换 + `:root` 删除 + 基础面补充）
  - `src/styles/tokens.css`（微调：补 `--z-*` 缺项若有、确认映射表）
  - `src/renderer/state-views.tsx`（新建：4 个共享状态组件）
  - 替换散落状态实现的组件：`sidebar.tsx`、`skills-view.tsx`、`connectors-view.tsx`、
    `automations-view.tsx`、`diagnostics-view.tsx`、`stats-view.tsx`、`experts-view.tsx`、
    `artifact-panel.tsx`、`model-menu.tsx`、`permission-menu.tsx`、`toast.tsx`、
    `task-agent-card.tsx`、`chat-view.tsx`、`settings/*.tsx`
  - `scripts/check-design-tokens.ts`（新建）+ `package.json`（加 `check:tokens`，纳入 `check`）
  - **不改** daemon / core / shared / 契约 / 任何业务逻辑

## ADDED Requirements

### Requirement: token 单一真源接线

`index.css` SHALL NOT 自行定义视觉 token；所有 token 定义 SHALL 只存在于
`src/styles/tokens.css`。`index.css` SHALL 通过 `@import` 引入后者。
接线后按映射表改名的变量 SHALL 全站一致，不允许新旧名并存。

#### Scenario: 单一真源

- **WHEN** grep `index.css` 中的 `:root` 与 `--text-dim`、`--shadow-card`、`--shadow-questionnaire`
- **THEN** 前者不存在，后者零命中（已全部改名）

#### Scenario: 取值来源可追溯

- **WHEN** 检查 `index.css` 中任一视觉属性
- **THEN** 其值为 `var(--…)`，或落在「档位归档规则」的例外清单内且带注释说明语义

### Requirement: 硬编码按档收敛

`index.css` 与自有 `*.tsx` 中的硬编码视觉值 SHALL 按「档位归档规则」收敛到 DESIGN.md 的档位；
不归档的例外 SHALL 进白名单并在注释与 `docs/design-tokens-migration.md` 写明语义。
收敛 SHALL 经视觉走查确认无退化——**允许向好变化，不允许变差**。

#### Scenario: 收敛完成

- **WHEN** 运行 `npm run check:tokens`
- **THEN** 输出「违例」为 0，仅剩白名单例外（每条带原因）

#### Scenario: 向好变化被接受

- **WHEN** 对比收敛前后的界面（间距更规整、文字层级更克制、浮层圆角统一、toast 盖住模态）
- **THEN** 变化属实且方向正确；若某处变差（按钮过挤、标题层级塌陷），按「实测偏差处理」回退该处

### Requirement: 共享状态组件

系统 SHALL 提供 `EmptyState` / `LoadingState` / `ErrorState` / `Spinner` 四个共享组件
（`src/renderer/state-views.tsx`），并 SHALL 将现有散落实现替换为其调用。
`EmptyState` SHALL 提供可选的动作槽位（引导下一步）。

组件的**使用范围按 §B 分级**：只套给数据驱动视图与异步控件；无异步的交互控件与纯展示
组件不套（那是过度设计）。

#### Scenario: 状态组件被复用

- **WHEN** grep 现有散落类名（`settings-empty`、`auto-empty`、`skills-empty`、`ex-empty`、
  `section-empty`、`preview-group-empty`、`model-menu-empty`、`permission-menu-empty`、
  五套 spinner 等）
- **THEN** JSX 中不再出现，全部经共享组件渲染

#### Scenario: 加载与空分离

- **WHEN** 数据尚未返回（`undefined`）
- **THEN** 渲染 `LoadingState`；仅当数据为 `[]`/空集才渲染 `EmptyState`

### Requirement: 全局交互基础面

全站 SHALL 具备：主要可交互类的 `:active` 按下态；`prefers-reduced-motion` 全局兜底块；
嵌套滚动容器 `overscroll-behavior` 取值明确；滚动条样式有全局基线（非常态可见）。

豁免与分级按 §C（动效）与 §D（键盘）执行——三方内容、既有惯用法（SVG 进度环、
`scrollbar-color`）不在要求内；焦点陷阱与焦点归还本轮不做全站改造（排 #5）。

#### Scenario: reduced-motion 全局生效

- **WHEN** 系统开启「减少动态效果」
- **THEN** 所有 transition/animation 降至 0.01ms（不只现有 7 处局部）

#### Scenario: 按下有反馈

- **WHEN** 按下任一主要按钮/菜单项/卡片
- **THEN** 有可见反馈（`scale(.98)` 或底色加深），且只动 transform/opacity

### Requirement: 机械校验 check:tokens

`npm run check:tokens` SHALL 扫描 `src/renderer/index.css` 与 `src/renderer/**/*.tsx`，
报出未走 token 的硬编码颜色/间距/字号/圆角/阴影/时长/z-index，附文件:行号，
并 SHALL 支持白名单（差异清单项）。该脚本 SHALL 纳入 `npm run check`。

#### Scenario: 新增硬编码被拦截

- **WHEN** 有人在组件里写 `color: #ff0000`
- **THEN** `npm run check:tokens` 报出该处并返回非零退出码

## MODIFIED Requirements

### Requirement: 视觉 token 定义位置

**原**：`index.css` 的 `:root`（56–120 行）定义 27 个变量，另有 3 个局部变量家族
（`--shimmer-color`、`--seg`、`iframe` 内 `--kw-*`）。

**新**：全部收归 `src/styles/tokens.css`。其中：
- 等值变量按映射表改名后继续使用；
- `--seg`（6 个分类色）与 `--kw-*`（iframe 平行 token）**本轮不动**，列入差异清单
  （`--kw-*` 属跨上下文注入问题，不是简单改名）。

### Requirement: 字号硬编码

**原**：`font-size` 硬编码 195 行（含与 token 等值的 156 处）。

**新**：全部按「档位归档规则」收敛——等值 156 处直接换 `var()`；档外 11 处归档
（10→meta、16/18→emphasis、20→display）。

## REMOVED Requirements

### Requirement: index.css 的 :root 变量定义

**Reason**: 违反「token 单一真源」，且与 `tokens.css` 同名不同值会让 `var()` 解析结果
取决于 import 顺序——这是难以排查的隐性 bug。

**Migration**: 删除 `index.css` 的 `:root` 块；写新代码一律引用 `tokens.css`。
**收敛处理**：现有 4 级文字色 SHALL 收敛为 3 级——`rgba(0,0,0,.7)` 的引用点改用
`--text-secondary` (.5)，层级更克制、更符合 DESIGN.md §2.1。`tokens.css` 的
`--text-secondary` 本轮起即为唯一生效值（不再保留 .7 档）。
