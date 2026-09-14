# DESIGN.md — KamiBuddy 设计标准

> 任何界面改动前必须先读本文件。Token 实现在 [src/styles/tokens.css](src/styles/tokens.css)。
> 本标准是**验收依据**：与本文冲突的实现以本文为准；本文没写到的细节以对齐 WorkBuddy 为准。
> 档位纪律：**间距 7 档 / 字号 5 档 / 文字色 3 级 / 圆角 4 档 / 阴影 3 级 / 时长 3 档**——不够用先改本文并写理由，不许在组件里加新档。

## 1. 视觉定位

**冷静的工具感：纯白主背景托灰阶层次，黑色主按钮是唯一重信号，品牌绿只做状态点缀。**

展开为三句话（决策分歧时按此裁决）：
1. 层次靠**灰**（#f2f2f2 侧栏 / #f7f7f7 抬升面 / #e6e6e6 边框），不靠彩色。
2. 用户注意力靠**黑**（90% 黑的主按钮）和**动**，不靠加大字号和加粗。
3. 信息密度服从桌面生产力工具，不做营销页的「大气留白」。

## 2. 设计 Token 表

实现在 [src/styles/tokens.css](src/styles/tokens.css)（亮/暗两套主题；暗色为预留未接线）。
下表是语义词典，**每个值的适用场景以 tokens.css 内的注释为准**。

### 2.1 文字色（3 级）

| Token | 亮色值 | 用途 |
|---|---|---|
| `--text` | #000 | 主文：正文、标题、按钮主文字 |
| `--text-secondary` | rgba(0,0,0,.5) | 次文：辅助信息、次要按钮、meta 行 |
| `--text-faint` | rgba(0,0,0,.3) | 弱文：禁用态、占位符、最弱图标 |

> 收敛说明：旧体系还有 rgba(0,0,0,.7)（WB black-70，首页 pills/案例标题在用）。
> 本标准将其并入 `--text-secondary`，迁移时统一替换，不再保留第四档。

### 2.2 表面与边框

| Token | 亮色值 | 用途 |
|---|---|---|
| `--bg` | #ffffff | 主背景：对话区、卡片、弹层 |
| `--bg-sidebar` | #f2f2f2 | 侧栏背景 |
| `--bg-raised` | #f7f7f7 | 抬升面：次级卡片、选中底、代码块底 |
| `--bg-hover` | rgba(0,0,0,.05) | **唯一** hover 底色 |
| `--border` | #e6e6e6 | **唯一**常规边框 |

### 2.3 主色（黑按钮体系）

`--primary`（90% 黑）/ `--primary-hover`（82%）/ `--primary-active`（75%）/ `--primary-text`（白）。
档位方向：hover 往浅走（82%）、选中/按下再浅（75%）——选中态要柔于主操作，这是有意的。

### 2.4 状态色（4 个，封顶）

| Token | 值 | 用途 |
|---|---|---|
| `--danger` | #f64041 | 删除、拒绝、错误 |
| `--ok` | #0cbf5b | 完成态、已连接 |
| `--warning` | #d9822b | 连接中、待确认、非阻断提醒 |
| `--accent` | #1470b4 | 可点标识：链接、路径徽章、勾选 |
| `--brand` | #00c29a | 品牌绿：**仅**状态点/品牌位，不进常规组件 |

遮罩只有一档：`--overlay` = rgba(0,0,0,.4)（模态背板；现状 32%~78% 五档待收编）。

### 2.5 间距（7 档）

| Token | 值 | 用途 |
|---|---|---|
| `--space-1` | 4px | 图标↔文字间隙、chip 内部 |
| `--space-2` | 6px | 紧凑控件内边距（图标按钮、菜单项 gap） |
| `--space-3` | 8px | 控件组间隙、列表行内 gap、表单项间距 |
| `--space-4` | 12px | 卡片/浮层内边距、区块内元素间距 |
| `--space-5` | 16px | 区块间距、卡片外边距、面板内边距 |
| `--space-6` | 24px | 大区块分隔、输入卡内边距 |
| `--space-7` | 32px | 模态内边距、页面级留白 |

### 2.6 字号（5 档）

| Token | 值 | 用途 |
|---|---|---|
| `--text-meta` | 12px | 辅助信息：时间戳、等宽小字、次级按钮文字 |
| `--text-list` | 13px | 列表正文：任务行、菜单项、toast、主按钮文字 |
| `--text-body` | 14px | 正文基准（= body 基准） |
| `--text-emphasis` | 15px | 强调正文：用户气泡（与助手 14 的一档差是有意区分发言者） |
| `--text-display` | 30px | 仅首页 hero |

档外值的归档规则：10px（最低档外值）并入 meta；16/18/20px 并入 display 或就近降级。
字重只有两档语义：**常规 400 / 强调 600**，无 token（直写）；500 并入 600。
行高基准：正文 1.6、列表 1.5、展示标题随容器；无 token。

### 2.7 圆角（4 档）+ 阴影（3 级）

| Token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 6px | 按钮、菜单项、chip、列表行、小输入框 |
| `--radius-md` | 10px | 卡片、弹层、toast、代码块 |
| `--radius-lg` | 16px | 模态、问卷卡、案例封面 |
| `--radius-full` | 999px | 胶囊、tab、头像、状态点 |

**例外（WB 原值，不入档，新增组件不得引用）**：输入卡 24px / 首页槽 22px；
1–5px 微圆角（favicon、进度 thumb、badge 标记）允许直写但须注释语义。

| Token | 值 | 用途 |
|---|---|---|
| `--shadow-sm` | 6px/16px 2% + 1px/4px 3% | 轻浮层：问卷卡（不该有弹层压迫感） |
| `--shadow-md` | 6px/24px 6% | 卡片与弹层（WB 卡片阴影原值） |
| `--shadow-lg` | 12px/40px 18% | 模态与阻断弹层：审批、确认框 |

输入卡阴影（`0 16px 32px -8px 3%, 0 2px 4px -4px 6%`）是 WB 原值的场景例外，语义归 md 档。

### 2.8 时长（3 档）与缓动（2 个）

| Token | 值 | 用途 |
|---|---|---|
| `--dur-fast` | 150ms | 微交互：hover 变色、焦点环、图标替换 |
| `--dur-base` | 200ms | 弹层入场、开合、位移 |
| `--dur-slow` | 280ms | 大容器：折叠展开、面板宽度、模态入场 |
| `--ease-out` | cubic-bezier(0.33,1,0.68,1) | 入场/常规（WB 同款） |
| `--ease-standard` | ease-out | 纯视觉变色反馈 |

### 2.9 层级（5 档）

`--z-base 1`（sticky/刻度轨）→ `--z-panel 30`（面板内浮层）→ `--z-overlay 90`（全局菜单）→ `--z-modal 100`（模态/审批）→ `--z-toast 200`（toast 恒最顶）。

## 3. 组件默认规范

「四态」= default / hover / active / disabled，外加 focus-visible 焦点环（见 §7）。
所有四态过渡走 `--dur-fast`，变色类用 `--ease-standard`。

### 3.1 按钮

| 级别 | 规格 | 四态 |
|---|---|---|
| 主按钮（`.primary-btn`） | padding 7×18px（→ `--space-2`×`--space-5`），字 `--text-list`，圆角 sm，底 `--primary` 字 `--primary-text` | hover `--primary-hover`；active `--primary-active`；disabled 底 `--border` 字 `--text-secondary`，cursor default |
| 次级按钮（`.mini-btn`） | padding 5×10px（→ `--space-1`×`--space-3`），字 `--text-meta`，1px `--border`，底 `--bg`，圆角 sm | hover 底 `--bg-hover`；active 再叠 `scale(.98)`；disabled opacity .5 + cursor default |
| 图标按钮（`.bar-btn` 类） | 6px 内边距（`--space-2`），图标 16px，字色 `--text-secondary`（图标）→ 无底无边 | hover 底 `--bg-hover` 字 `--text`；active 叠 `scale(.96)`；disabled opacity .4 + cursor default |
| 危险按钮 | 结构同次级按钮，文字/边框走 `--danger` | hover 底 `color-mix(in srgb, var(--danger) 8%, transparent)`；disabled 同次级 |

新增按钮类前先看上表有没有能用的级别；没有就是新级别，须先补进本表。

### 3.2 输入框 / 输入卡

- 行内小输入框（重命名、表单）：高 28px 左右，1px `--border`，圆角 sm，padding `--space-2`×`--space-3`；focus 边框改 `--accent` 或依赖全局焦点环，二者取一不叠加。
- 输入卡（`.composer-card`）：圆角 24px（WB 例外值）、padding 12/16px、阴影走输入卡例外（见 2.7）；focus-within 时边框加深一档。
- 文本域：不可横向拉伸（`resize: none` 或 vertical）；占位文字 `--text-faint`；禁用态底 `--bg-raised` 字 `--text-faint`。

### 3.3 卡片

- 底 `--bg`、1px `--border`、圆角 `--radius-md`、内边距 `--space-4`~`--space-5`。
- 可点卡片：hover 底 `--bg-raised` 或阴影升到 `--shadow-md`，二选一不叠加；active `scale(.98)`。
- 卡片内标题 `--text-body` + 600；meta 行 `--text-meta` + `--text-secondary`。
- 卡片**不得**再嵌套带阴影的卡片（层次用底色差，不用影叠影）。

### 3.4 列表项

- 高：紧凑行 28~32px（侧栏任务行）、常规行 40~48px（设置页行）。
- 圆角 `--radius-sm`；hover 底 `--bg-hover`；选中底 `--bg-raised` + 主文字 600。
- 主文字 `--text-list`；副行 `--text-meta` + `--text-secondary`。
- 行内 icon 按钮默认 `--text-secondary`，行 hover 时显现或加深。
- 禁用行：opacity .5，不置灰背景（背景灰与选中态撞色）。

### 3.5 弹层（菜单 / 浮层 / 模态）

| 类型 | 规格 | 动效 |
|---|---|---|
| 菜单（pop-menu 族） | 底 `--bg`、1px `--border`、圆角 `--radius-md`、阴影 `--shadow-md`、内边距 `--space-1` | 入场 `--dur-base` + `--ease-out`：opacity 0→1 + translateY(4px→0)；退场可省 |
| 浮层卡片（问卷、上下文详情） | 圆角 `--radius-lg`、阴影 `--shadow-sm` | 入场同上，translateY 8px→0 |
| 模态（审批、确认） | 背板 `--overlay`、卡圆角 `--radius-lg`、阴影 `--shadow-lg`、内边距 `--space-6`~`--space-7` | 背板淡入 + 卡片 scale(.97→1) + opacity，`--dur-base` |

弹层三件套**缺一不可**：Esc 关闭、外部点击关闭、焦点管理（见 §7.3）。

## 4. 状态矩阵（组件 × 7 状态）

七种状态：空 / 加载 / 部分加载 / 成功 / 失败 / 禁用 / 权限不足。

**总规范**：
- 任何数据驱动的视图必须定义全部七种状态；「成功」是唯一可以省略定义的（正常渲染即是）。
- **加载与空必须分开**：加载中渲染加载态，只有数据回来且为空才渲染空态（`undefined` ≠ `[]`）。
- 失败就地呈现 + 重试动作；toast 只承载「无需重试」的瞬态反馈。
- 权限不足与禁用分开：禁用是「现在不能点」，权限不足要给出路（去配置 / 去授权）。

**共享组件**：`EmptyState`（图标+标题+副文案+可选动作槽）/ `LoadingState` / `ErrorState`（文案+重试）/
`Spinner`——**已建成**（`src/renderer/state-views.tsx`），一律复用，禁止新造类名。
具体收敛记录见 [docs/design-tokens-migration.md](docs/design-tokens-migration.md) §4。

**已知缺口清单**（修复 backlog，打勾表示已补；引用诊断报告条目）：

| 组件 | 空 | 加载 | 部分 | 失败 | 禁用 | 权限不足 | 缺口 |
|---|---|---|---|---|---|---|---|
| 侧栏任务列表 | ✓ | ☐ | — | ☐ | — | — | 加载与空未分（首屏闪「暂无历史任务」）；失败静默 |
| 专家市场页 | △ | ☐ | — | ☐ | — | — | 空库/失败显示成「搜索无结果」 |
| 技能页 | ✓ | △ | ☐ | △ | ✓ | — | 失败时错误条与「正在读取」并存，无重试 |
| 模型菜单 | ✓ | ✓ | — | ☐ | ☐ | — | 失败永久停「正在读取模型…」 |
| 权限菜单 | — | ✓ | — | ☐ | ☐ | — | 同上，且 chip 加载态与正常态无法区分 |
| 消息流 | ☐ | ✓ | ✓ | ✓ | ✓ | △ | 空会话全白无引导；权限被拒与执行失败同图标 |
| 产物面板 | ✓ | ✓ | ☐ | ✓ | ✓ | △ | 无 stale-while-revalidate（切文件全屏闪加载）；预览失败无重试 |
| 连接器页 | ✓ | ✓ | — | ✓ | ✓ | ☐ | 无「需授权」态（鉴权失败落入泛化 failed） |
| 设置-模型卡 | ✓ | ✓ | ✓ | ✓ | ✓ | △ | 未配 Key 当禁用呈现，无「去配置」动作 |
| 诊断页/统计页 | ✓ | ✓ | ☐ | ✓ | — | — | 无局部刷新态（每次整拉） |
| 代码/文档预览 | — | ✓ | — | △ | ✓ | — | Monaco chunk 加载失败会冒泡到根 ErrorBoundary 打白屏 |
| 问卷浮层 | — | — | ✓ | ☐ | ✓ | — | 契约错位 throw 打白屏，应就地降级 |

## 5. 动效规范

1. **只动 `transform` / `opacity` / `visibility`**。禁止过渡/动画这些属性：
   `width`、`height`、`max-height`、`min-height`、`padding`、`margin`、`border-width`、
   `font-weight`、`background-position`、`top`/`left`（非 transform 写法）、`grid-template-rows`。
2. **折叠展开的合法写法**：`grid-template-rows: 0fr ↔ 1fr`（参考 `.metafold-body` 手法，
   但该值本身不参与 transition），或固定容器 + 内部 `transform`。
3. 时长/缓动只用 §2.8 的 3+2，散值（0.12s/0.16s/0.24s/0.32s 等）迁移时归档。
4. **扫光（shimmer）**：禁止动画 `background-position`（每帧重绘文字）。改用伪元素 +
   `transform: translateX` 扫过。
5. **拖拽期间停过渡**：面板拖拽等 mousemove 高频路径，拖拽中给容器加
   `transition: none` 态，结束恢复。
6. **流式期间的常驻动画**（等待行、思考标题、工具状态字）必须是合成动画（transform/opacity），
   且进入 `prefers-reduced-motion` 全局兜底（见 §7.5）。
7. 弹层入场只做一次；不做退场动画（消失瞬时）——除非该组件有明显「取消」语义需要回收感。

## 6. 禁止清单

| 禁止 | 替代 |
|---|---|
| 新增硬编码视觉值（颜色/间距/圆角/阴影/时长） | 用 tokens.css；不够用先改本文件 |
| 原生 `<select>` | `select-field.tsx`（SelectField） |
| `backdrop-filter` / `filter: blur` / `mix-blend-mode` | 半透明底色；确需磨砂须单独评审 |
| 过渡/动画布局属性（清单见 §5.1） | transform/opacity/visibility |
| emoji 或字符（× ✓ ▸）当图标 | `icons.tsx` 线性 SVG 套（24 视窗 / stroke 1.8 / currentColor） |
| 图标写在 `icons.tsx` 之外（内联 SVG） | 收进 icons.tsx，遵守同源约定 |
| `<div onClick>` 无 `role="button"`/`tabIndex`/键盘事件 | 用 `<button>`；确需 div 则三件套补齐（参考 experts-view 的正面样例） |
| 弹层缺 Esc / 外部点击关闭 / 焦点管理任一 | 共享 popover 行为（`usePopoverClose`，待抽） |
| 渲染进程 `throw` 把局部错误冒泡到根 ErrorBoundary | 就地错误卡 + 重试/跳过出口 |
| 用 toast 承载「需要重试」的失败 | 就地 ErrorState + 重试按钮 |
| 新造 spinner / 空态 / 错误态 / chip / 列表行类名 | 共享组件（Spinner、EmptyState、Chip、ListRow，待抽） |
| iframe/子上下文里另起一套平行 token（如 widget `--kw-*`） | 由宿主注入共享 token |
| 加载态与空态用同一条件判断（`length===0` 同时当加载中与真为空） | 数据 `undefined`=加载中，`[]`=空 |
| 禁用态只改 cursor 不改视觉 | opacity 或底色变化，二者至少其一 |
| 流式 delta 不经合批直接驱动渲染（工程红线） | 时间窗合批 / rAF 节流 |
| 全局命名漂移：会话↔任务、工作区↔工作空间、服务商↔供应商 | 见 §8 词表 |

## 7. 无障碍要求

1. **焦点环**：全局 `button/[role=button]/select/input/textarea:focus-visible` 已有
   （2px `--text-secondary` + 2px offset）。新增可交互元素必须被这条覆盖或自证等价；
   不许 `outline: none` 除非容器级有替代（`:focus-within` 边框/描边）。
2. **图标按钮必须有名字**：`aria-label` 或可见文字，二选一。
3. **弹层焦点管理**：打开时焦点移入首个可交互元素（危险弹窗默认落「安全」按钮），
   Tab 在弹层内循环，关闭后焦点归还触发元素。审批弹窗是安全闸，这条是硬要求。
4. **Esc 层级**：同级多弹层时 Esc 只关最内层（最内层 `stopPropagation`）。
5. **reduced-motion**：全局兜底块
   `@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms !important; transition-duration:.01ms !important } }`，
   现状只有 7 处局部覆盖，需补全局块。
6. **状态不只靠颜色**：危险/成功/警示同时给文字或图标（绿点 ✓ 也要可读文字态）。
7. **键盘可达清单**：重命名、删除、菜单每一项、tab 转正（双击动作的键盘等价入口）、
   时间线行选择，都必须可键盘完成。
8. **滚动链**：嵌套滚动容器（思考块、工具详情、浮层列表）加 `overscroll-behavior: contain`，
   除非产品明确要链动。
9. **对比度**：文字/背景对比 ≥ 4.5:1；`--text-faint` 只允许用于非关键信息。

## 8. 术语词表（写作与代码命名共同遵守）

| 统一用 | 不用 | 说明 |
|---|---|---|
| 会话 | 任务（指对话实体时）、对话 | UI 层用「会话」；类型层保持 `session`；诊断页「最近任务/会话时间线」混用待收 |
| 工作空间 | 工作区、空间（面板文案中） | 侧栏分组名可保留「空间」简称 |
| 服务商 | 供应商 | Provider 一律译「服务商」 |
| 深度思考（块标题）/ 推理强度（设置档）/ 思考（能力标记） | 三词混用 | 按位置各就各位 |
| 新建 | 创建（按钮动词混用时） | 同一流程只用一个动词 |
| 产物 | 交付（UI 文案中） | 「交付」只留在代码注释与机制描述 |

标点：空态/按钮短句不带句号；完整说明句带句号。跳转箭头统一 `›`（子菜单）与 `→`（跳转动作）分工。

## 9. CR 自查清单

界面改动提测前逐项过一遍（写代码的人自查，review 的人抽查）：

**Token 与样式**
- [ ] 没有新增硬编码颜色 / 间距 / 圆角 / 阴影 / 时长（grep 本次 diff 的 `#[0-9a-f]`、裸 px、裸 s/ms）
- [ ] 引用的 token 都在 tokens.css 里存在；没有新造「第 8 档」
- [ ] 没有过渡/动画布局属性；没有 `backdrop-filter` / `filter: blur`
- [ ] 弹层有入场动效（opacity+transform，`--dur-base`），且三件套齐全（Esc/外点/焦点）

**状态**
- [ ] 数据驱动的视图：加载与空是两个条件（`undefined` vs `[]`）
- [ ] 失败就地呈现且有重试；没有让 toast 扛可重试失败
- [ ] 禁用态有视觉变化；权限不足给了出路（去配置/去授权）
- [ ] 流式期间控件禁用/可用的判断是**有意**的（对照输入框的 steer 语义先例）

**交互与可访问性**
- [ ] 四态齐全（default/hover/active/disabled）+ 焦点环可见
- [ ] 图标按钮有 `aria-label`；`<div onClick>` 补齐 role/tabIndex/键盘
- [ ] 动画在 reduced-motion 下有兜底
- [ ] 嵌套滚动容器有 `overscroll-behavior` 决策（contain 或有意链动）

**一致性**
- [ ] 用词过了 §8 词表；按钮动词统一；标点规则符合
- [ ] 图标来自 `icons.tsx`；没有新 spinner/空态/chip/列表行类名
- [ ] 组件级别（按钮/卡片/列表项）先查 §3 有没有现成级别可复用

**性能**
- [ ] 流式路径上的新渲染成本有意识（memo / 合批 / 虚拟化三选一说明）
- [ ] 长列表有上限或虚拟化策略

## 10. 本轮落地范围与已知例外

> 本文件是**目标态标准**，不等于已 100% 落地。本节声明当前生效边界，避免读者误以为全部规范已执行。
> 逐条迁移记录、例外语义、遗留问题见 [docs/design-tokens-migration.md](docs/design-tokens-migration.md)。

### 10.1 本轮已生效（可作 CR 依据）

- **Token 接线**：`index.css` 已 `@import` `tokens.css`，`index.css` 不再自建 `:root`；
  改名 `--text-dim`→`--text-secondary`、`--shadow-card`→`--shadow-md`、`--shadow-questionnaire`→`--shadow-sm` 全站一致。
- **按档收敛**：字号 / 间距 / 圆角 / 颜色 / 时长 / z-index 已按 §2 档位收敛；
  `npm run check:tokens` 为 0 真违例（例外全部登记白名单）。
- **状态组件**：`EmptyState` / `LoadingState` / `ErrorState` / `Spinner` 已建成并被复用，
  旧的 13 种空态类名与 5 套 spinner 已归零。
- **四态与基础面**：主要交互类补齐 `:active`（只动 transform/opacity）、缺失的 `disabled` 视觉、
  reduced-motion 全局兜底、嵌套滚动 `overscroll-behavior`、全局滚动条基线。
- **动效纪律（新增部分）**：本轮新增动效只动 transform/opacity、时长缓动取自 §2.8；
  §5.1 里 `font-weight` 过渡已移除。

### 10.2 仍待后续

动效属性改造（§5.1 存量布局属性过渡、§5.4 扫光）、状态逐页补齐（§4 缺口清单）、
性能（§9 性能项）、桌面端硬伤（焦点陷阱/归还、Esc 层级仲裁、拖拽越界、最小宽度溢出）。
均在本分支以 spec #2~#5 续作。

### 10.3 已知例外（不与规范冲突，但读者需知道）

- **分类色板只有 6 槽**：专家头像身份色板（8 色，hash 取色）、文件类型惯例色（PDF 红等）、
  品牌渐变不走 `--cat-1..6`——它们是「身份 / 惯例 / 品牌」而非「无差别分类」，非设计尺度。
- **WB 原值**：输入卡 24px / 首页槽 22px、输入卡阴影 `--shadow-input`、首页槽渐变、路径徽章底色、iframe `--kw-*`
  （跨上下文注入，值对齐宿主 token）——按 §2.7 与 spec §A 保留原值。
- **亚间距 2px**：图标贴合 / 角标等紧凑场景，归 4px 会破坏布局（§2.5 已声明）。
- **循环动画时长**：spin / pulse / shimmer 的周期（0.8/1.1/2/2.2s）是动画语义，不是交互动效时长。
- **ring 手法**：`0 0 0 1px` 类焦点环/描边不是阴影尺度，不入 §2.7。
- **档外场景阴影**：面板定向影、下拉 18%、纸张影、开关滑块影——非 sm/md/lg 等值，保留原值（未造第 4 档）。
