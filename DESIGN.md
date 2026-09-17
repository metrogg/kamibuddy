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

**字体族（唯一真源）**：界面字体栈**只在** `tokens.css` 的 `--font-body` 定义一处，`body` 引用它。
新增字体**必须**走 `@font-face` + 该变量，**不得**就地写 `font-family` 字面值（组件里、`body` 里都不行）。
理由两条：① 此前 `body` 与 `--font-body` 各写了一份一模一样的栈，加字体/调顺序要改两处，于是出现
「`MiSans` 声称已接、实际两处都没接」的账目错误（见
[docs/design-tokens-migration.md](docs/design-tokens-migration.md) §11）；② 字体文件**只有被 CSS `url()`
引用**才会进 renderer 产物（无 `publicDir`），光放进仓里等于死文件 —— 声明与引用必须成对。

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

**覆盖实况**（打勾＝已具备；「说明」列写本期处置，或仍缺什么）。

> 本表第 1 期建成时是**缺口清单**。`complete-view-states`（第 5 期收尾）逐页盘点 12 个主界面后
> 补齐了 P1/P2 残留，本节据此更新为**实况**：**已补齐**的行注明处置，其余行保留原缺口描述
> （本期未纳入范围，不是遗漏）。逐项处置与证据见
> [docs/design-tokens-migration.md](docs/design-tokens-migration.md) §10。

| 组件 | 空 | 加载 | 部分 | 失败 | 禁用 | 权限不足 | 说明（本期处置 / 仍缺） |
|---|---|---|---|---|---|---|---|
| 侧栏任务列表 | ✓ | ✓ | — | ✓ | — | — | **本期补齐**：初值 `undefined` 分「在途」与「确实没有」；失败→错误态 + 重试；daemon 启动即 down→「连接已断开」同一出口（原先永久「正在读取…」） |
| 侧栏空间区 | ✓ | ✓ | — | — | — | — | **本期补齐**：行内「正在读取空间…」；标题计数不再误报 `(0)`。**故意不写**「确实没有空间」空态文案（空集合≠没有工作空间） |
| 专家市场页 | ✓ | ✓ | — | ✓ | — | — | **本期补齐**：两处 `ErrorState` 接 `onRetry`（不再需要重启应用）；`skills-view` 4 行透传 |
| 技能页 | ✓ | ✓ | ☐ | ✓ | ✓ | — | 第 1 期已修，本期作为**三态互斥 + 重试的标尺** |
| 定时任务页（自动化） | ✓ | ✓ | — | ✓ | ✓ | — | **本期补齐**：三态互斥 + 重试（原「错误条 + 正在读取…」永久同框）；头部不加刷新按钮，重试只在错误态里 |
| 产物面板 | ✓ | ✓ | ☐ | ✓ | ✓ | △ | **本期补齐**：文件树扫描失败→错误态 + 重试（**不再降级成空树**）、扫描成功但无文件→空态；预览失败按「未选工作空间」与「服务未就绪」分流，后者带重试 |
| 首页页签 / 对话页模式标签 / 「+」专家子菜单 | ✓ | ✓ | — | — | ✓ | — | **本期补齐**：三处「在途被当空」改走加载态；模式标签不再回退显示裸 id，专家子菜单区分「正在读取」与「还没有可用专家」 |
| 设置各分区（模型卡 / 通用 / 记忆 / 个性化 / 提示词） | ✓ | ✓ | ✓ | ✓ | ✓ | △ | **本期补齐**：**10 处**三态互斥 + 重试。仍缺：模型卡「未配 Key 当禁用呈现、无『去配置』动作」；内容分支里的**写入失败**错误条不给重试（见「豁免与刻意偏离登记」③） |
| 模型菜单 | ✓ | ✓ | — | ☐ | ☐ | — | 失败仍永久停「正在读取模型…」（本期未动） |
| 权限菜单 | — | ✓ | — | ☐ | ☐ | — | 同上，且 chip 加载态与正常态无法区分 |
| 消息流 | ☐ | ✓ | ✓ | ✓ | ✓ | △ | 空会话全白无引导；权限被拒与执行失败同图标 |
| 连接器页 | ✓ | ✓ | — | ✓ | ✓ | ☐ | 无「需授权」态（鉴权失败落入泛化 failed）——需改 IPC 契约 + 产品定口径，另立 spec |
| 诊断页 / 统计页 | ✓ | ✓ | ☐ | ✓ | — | — | 无局部刷新态（每次整拉）；`.stat-hint` / `.stat-err` 行内状态见「豁免与刻意偏离登记」② |
| 代码 / 文档预览 | — | ✓ | — | △ | ✓ | — | Monaco chunk 加载失败会冒泡到根 ErrorBoundary 打白屏 |
| 问卷浮层 | — | — | ✓ | ☐ | ✓ | — | 契约错位 throw 打白屏，应就地降级 |

**新增视图必须遵守的四条硬要求**（源自 `complete-view-states` 的 ADDED Requirements，违反即缺陷）：

1. **在途与空必须分开**：数据源在途用 `undefined` 表达（初值不得预置 `[]` / `{}`），视图据此渲染
   加载态；只有数据真正到达**且为空**才渲染空态。不得用「长度为零」同时表达「还没到」与「确实没有」。
2. **失败必须就地可见且可重试**：不得静默 `catch` 吞掉失败；不得把失败降级成空数据（空数组 / 空树）
   伪装成「没有内容」；不得在错误态之外并行保留加载态导致两者永久同框。
3. **四分支严格互斥**：同一视图内 `error` / `loading` / `empty` / `content` 只走一条
   （参照 `skills-view.tsx`、`personalization-section.tsx`）。
4. **失败文案必须指向真实原因**：不得用一句话覆盖多个互斥原因（反例：把「未选工作空间」与
   「预览服务未就绪」混成一句）。

**豁免与刻意偏离登记**（有正当理由，**不属于违规**；后续 spec 不再重复尝试改造）：

① **`office-pptx.tsx` 的加载 / 错误绝对定位浮层**（`.office-overlay`，源码 L75-76 注释）：pptx
   内嵌的 echarts canvas 在 `display:none` 下初始化会量到 0×0 画成空白，故幻灯片容器在加载 / 错误期
   必须**保持可见**、状态改用浮层覆盖（WorkBuddy 同机制）。**不适用**块级 `LoadingState` / `ErrorState`。
② **`diagnostics-view.tsx` 的 `.stat-hint` / `.stat-err` 行内状态**（如 L699-700、L740-741 的
   「查询中… / 状态查询失败」）：是**行内单行读数**，块级 `LoadingState` 放不下。**不为两处给
   `state-views` 加 inline 变体**（避免为两个调用点做抽象）。
③ **设置各分区内容分支里的写入失败错误条不给 `onRetry`**（如 `general-section` 的保存失败）：
   重拉会冲掉用户正在编辑的草稿；重试语义只属于「初次加载失败」那一支。

## 5. 动效规范

1. **只动 `transform` / `opacity` / `visibility`**。禁止过渡/动画这些属性：
   `width`、`height`、`max-height`、`min-height`、`padding`、`margin`、`border-width`、
   `font-weight`、`background-position`、`top`/`left`（非 transform 写法）、`grid-template-rows`。
   （四条**受控例外**见本节末，明确不属于违规。）
2. **折叠展开的合法写法**：「从 0 到内容高度」只有两条可靠路径 —— `grid-template-rows: 0fr ↔ 1fr`
   （配内层 `min-height: 0; overflow: hidden`，参考 `.metafold-body` 手法）或
   `interpolate-size: allow-keywords` + `height: 0 ↔ auto`（参考 `.tool-detail-box` 手法，
   原生 `height: auto` 不可过渡，此为该坑的唯一解）。两者都是受控例外（见本节末 ①）。
3. 时长/缓动只用 §2.8 的 3+2，散值（0.12s/0.16s/0.24s/0.32s 等）迁移时归档。
4. **扫光（shimmer）**：除 `.text-shimmer` 的既有例外（见本节末 ②）外，禁止动画
   `background-position`（每帧重绘文字）。
5. **拖拽期间停过渡**：面板拖拽等 mousemove 高频路径，拖拽中给容器加
   `transition: none` 态，结束恢复（`.preview-panel` 的既有例外见本节末 ③）。
6. **流式期间的常驻动画**（等待行、思考标题、工具状态字）必须是合成动画（transform/opacity），
   reduced-motion 不做适配（见 §7.5——应用内动效无条件呈现）。
7. 弹层入场只做一次；**条件挂载**的弹层（`{open && <div>}`）不做退场动画（卸载即消失）——
   除非该组件有明显「取消」语义需要回收感。常驻 DOM 的元素另见规则 8。
8. **进出场不对称**：退出时长比进入短一档（`--dur-slow` 入 → `--dur-base` 出、
   `--dur-base` 入 → `--dur-fast` 出），表达「用户已决定离开」——退出动画只是善后，
   不该和进入一样慢。**不新增 token 档位**（§2.8 的三档即表达手段）。
   手法：基类写退出参数，`.open` / `[data-visible="true"]` 等激活类写入场参数。
   注：条件挂载的弹层只有入场没有退场，不涉及本规则（见规则 7）。
9. **空间连续性**：弹层/浮层 SHALL 用 `transform-origin` 对齐其触发位置，使弹层呈现为
   「从触发点生长」而非凭空出现。方向口径：触发按钮**下方**展开 → `top`（水平按按钮位置
   取 `left` / `center` / `right`）；**上方**展开 → `bottom ...`；**向左/右飞出**的子菜单 →
   对应侧 `center`；**居中模态** → `center`。入场需配 `scale(.98 → 1)`，否则 origin 无观感作用。

**受控例外**（明确不属于上述违规，逐条登记；后续 spec 不再重复尝试改造）：

① **折叠展开的「从 0 到内容高度」**：`grid-template-rows: 0fr ↔ 1fr`（配内层
   `min-height: 0; overflow: hidden`）或 `interpolate-size: allow-keywords` + `height: 0 ↔ auto`。
   这是该效果的唯一可靠实现，属受控例外；但**同时过渡多个布局属性**
   （如 `max-height` + `padding` + `margin` + `border-width`）仍是禁止的。
② **`.text-shimmer` 的 `background-position` 扫光**：无法用合成属性等价复刻——伪元素拿不到
   文字内容，而「文字明暗流动」必须以文字形状（`background-clip: text`）为裁剪源；且重绘面积
   仅限文字区域（非整屏），改造收益不成立。
③ **`.preview-panel` 的 `width` 过渡**：全屏切换需要（WB 同参数）；拖拽期间由
   `[data-dragging="true"]` 置 `transition: none` 禁用（见规则 5）。
④ **`.sidebar` 的 `flex-basis` 过渡（侧栏折叠）**：折叠是「**让位**」语义——主区必须跟着
   变宽/收窄，这个效果 `transform` 表达不了（transform 不改变布局宽度，只能做浮层覆盖，
   而侧栏是推开内容的常驻栏，不是浮层）。属**第二条 `width` 类受控例外**，与 ③ 性质不同
   （③ 是同栏在全屏与常规之间切，本条是全局导航栏的收起/展开）。时长取 `--dur-base`，
   缓动 `--ease-out`；**代价**：折叠期间侧栏内容随宽度重排（约 12 帧布局），已知并接受。
   实现附则：折叠态把 `padding-inline` / `border-right-width` 直接归零（**不**参与过渡）——
   `border-box` 下 `flex-basis` 会被内边距与边框顶住（只归零 `flex-basis` 时**实测盒子宽 24.8px**
   ≈ `--space-4`×2 + 1px 边框，而不是 0），而
   `artifact-panel` 的 `maxPanelWidth()` 正是量这个盒子，归零才保住「收起时量到 0」的契约；
   `visibility` 参与过渡以承担收起后的 Tab 序/a11y 移出（见规则 7 的条件挂载口径）。

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
   凡声明 `aria-modal="true"`（或 `role="dialog"` / `role="alertdialog"`）的模态，
   **「焦点移入 + Tab 陷阱 + 焦点归还」三条缺一不可**；背景 `inert` 为加强项
   （`aria-modal` 只是声明，`inert` 才真把背景移出可访问性树；`.toast-stack` 除外，
   否则 `role="status"` 的实时播报会被一并掐掉）。**这三条只有唯一入口：
   `src/renderer/use-modal-focus.ts` 的 `useModalFocus`**——不许在每个模态里各写一遍
   （各写必漂移；且嵌套模态的 Tab 归属需要模块级的打开栈来仲裁）。
4. **Esc 层级**：同级多弹层时 Esc 只关最内层（最内层 `stopPropagation`）。
5. **reduced-motion**：**不做系统跟随，应用内动效无条件呈现**（2026-09-16 最终口径）。
   演进：全局 `*` 兜底 → 局部适配 → 全部移除。原因：目标用户群常在系统「客户区
   动画」关闭的机器上使用（云主机/远程办公默认关），`prefers-reduced-motion`
   跟随系统，任何形式的适配都会让这些机器动效缺失——实测转圈停住被误判卡死、
   两台机器体验不一致。若将来有无障碍诉求，做成**应用内开关**（跟随系统/开/关），
   不跟随系统设置。
6. **状态不只靠颜色**：危险/成功/警示同时给文字或图标（绿点 ✓ 也要可读文字态）。
7. **键盘可达清单**：重命名、删除、菜单每一项、tab 转正（双击动作的键盘等价入口）、
   时间线行选择，都必须可键盘完成。
8. **滚动链**：嵌套滚动容器（思考块、工具详情、浮层列表）加 `overscroll-behavior: contain`，
   除非产品明确要链动。
9. **对比度**：文字/背景对比 ≥ 4.5:1；`--text-faint` 只允许用于非关键信息。
10. **拦截拖放与外部导航**：页面的 `dragover` / `drop` 默认行为**必须**被拦截
    （renderer 在 `App` 层做 document 级兜底，只放行输入卡既有的文本投递；
    **关键是判 `dataTransfer.types.includes("Files")`**——只兜文件拖放），
    否则把文件拖到非投递区会走 Chromium 默认行为、整页被替换成那个文件。
    外部导航**必须**走主进程 `will-navigate` 守卫（非本应用 URL 一律 `preventDefault`、
    改走既有外部打开通道），否则 `file://` 之类的导航拦不住。

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
- [ ] 没碰 §11 的四条硬约束（delta 合批 / 收起态跳过渲染 / 完成条目 memo / 未折叠条目禁 `content-visibility: auto`）

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
- **动效属性改造（spec #3 已完成）**：折叠体过渡属性 12 → 4 项（布局属性只剩 `height`）、
  全站 22 处弹层入场 + `transform-origin` 对齐触发点、进出场时长拆分（退出降一档）、
  拖拽期停过渡；扫光与 `.metafold-body` 的 grid 手法经评估保持现状，见 §5 受控例外。
  详见 [docs/design-tokens-migration.md](docs/design-tokens-migration.md) §7。
- **性能硬约束（spec #4 已完成）**：流式 delta 16ms 合批（6 处 flush）、折叠体收起态
  `content-visibility: hidden`（配 `allow-discrete` 保住收起动画）、5 处热点 memo 化、
  开发期 FPS/longtask 观测浮层。约束条文见 §11，代码层证据见
  [docs/design-tokens-migration.md](docs/design-tokens-migration.md) §8
  （**含一个遗留问题**：生产构建仍打包 `perf-overlay`，见该节 §8.5）。

### 10.2 仍待后续

桌面端硬伤（焦点陷阱/归还、Esc 层级仲裁、拖拽越界、最小宽度溢出）已由 spec #5 落地
（§7 / 迁移文档 §9）；视图状态逐页补齐已由 `complete-view-states` 收尾（§4 已从缺口清单更新为实况，
剩余缺口与两处豁免均在 §4 就地表）。
性能类改动已由 spec #4 落地（§11 / 迁移文档 §8），但 §9 的「长列表虚拟化策略」**仍未做**——
完整虚拟滚动经评估与吸底/刻度轨机制冲突，理由见迁移文档 §8.4。

### 10.3 已知例外（不与规范冲突，但读者需知道）

- **分类色板只有 6 槽**：专家头像身份色板（8 色，hash 取色）、文件类型惯例色（PDF 红等）、
  品牌渐变不走 `--cat-1..6`——它们是「身份 / 惯例 / 品牌」而非「无差别分类」，非设计尺度。
- **WB 原值**：输入卡 24px / 首页槽 22px、输入卡阴影 `--shadow-input`、首页槽渐变、路径徽章底色、iframe `--kw-*`
  （跨上下文注入，值对齐宿主 token）——按 §2.7 与 spec §A 保留原值。
- **亚间距 2px**：图标贴合 / 角标等紧凑场景，归 4px 会破坏布局（§2.5 已声明）。
- **循环动画时长**：spin / pulse / shimmer 的周期（0.8/1.1/2/2.2s）是动画语义，不是交互动效时长。
- **ring 手法**：`0 0 0 1px` 类焦点环/描边不是阴影尺度，不入 §2.7。
- **档外场景阴影**：面板定向影、下拉 18%、纸张影、开关滑块影——非 sm/md/lg 等值，保留原值（未造第 4 档）。

## 11. 性能约束（硬约束）

> 来源：spec `.trae/specs/optimize-stream-rendering`（第 3 期）。与 §5 同性质——**这是工程约束，不是目标态愿景**：
> 每条都有代码层证据（见 [docs/design-tokens-migration.md](docs/design-tokens-migration.md) §8），触犯即缺陷而非风格分歧。
> **为何追加在文末而不插在 §5 之后**：§6 起依次是禁止清单 / 无障碍 / 术语 / CR 自查 / 落地范围，插队要整体顺延编号，
> 会打断 AGENTS.md、`.trae/specs/*` 与迁移文档里对 DESIGN.md §7 / §8 / §9 的既有引用（引用即验收依据，不能漂）。

1. **流式 delta 必须合批**。正文 / 思考 delta 不许「收到一条就发一条」——那等于每个 token 一次 IPC + 一次 renderer 全量重渲染。
   合批窗口取 **16ms（≈ 一帧）**，且只合并**连续同类型**的 delta。
   四个终止时机**必须 flush**（缺一即丢最后半句或与终态校正串序）：① 类型切换（含 messageId 变化）；
   ② `message_end`；③ turn 结束（`turn_end` / `agent_end`）；④ 中断（`abort()`）。
   `delta` 字段是拼接结果、事件类型与字段语义不变（下游 reducer / UI 零改动）；拼接结果必须与未合批时**逐字一致**。
   实现落点：`src/core/session-host.ts`（`DELTA_FLUSH_MS = 16` / `bufferDelta` / `flushDeltas`，共 6 处 flush 落点）。
   附则：不得改动 delta 的**到达时刻**语义——TTFT 的 `turnFirstDeltaAt` 记在缓冲之前（它量的是 pi 事件到达时刻）。

2. **收起态必须跳过渲染**。折叠体（`.metafold-body-inner` / `.tool-detail-box` / `.tool-source-list`）处于收起态时用
   `content-visibility: hidden`，让内容子树跳过 layout 与 paint。
   `content-visibility` 是**离散属性**：它若参与过渡（收起动画），**必须配 `transition-behavior: allow-discrete`，且只写在收起态那一条**——
   否则收起瞬间内容高度被算成 0，收起动画退化成「瞬间消失」（会把 §5 第 2 条与受控例外 ① 的成果一起摧毁）。
   该属性不得改变收起态占位（高度恒为 0，`scrollHeight` 不变），也不得改变展开态表现。

3. **完成条目必须 memo**。已完成消息 / 工具结果的昂贵转换（JSON 解析、Markdown 解析、集合派生）不得随父级重渲染而重算：
   - `widget-view` 的 `parseWidgetResult(card.detail)` → `useMemo([card.detail])`
   - `Markdown` 组件 → `React.memo`（text 不变即不重解析）
   - `App.tsx` 的 `collectSources` / `collectChanges` → `useMemo([conversation.entries])`
   - `chat-view` 的 `pendingText(entries)` / `entries.findLast(...)` → `useMemo([entries])`
   前提：传给 `React.memo` 组件的**函数型 prop 必须由调用方 `useCallback` 固定**（如 `App.tsx` 的 `openPath`），否则 memo 被逐渲染的新箭头击穿。
   诚实口径：`entries` 每个 delta 换引用，按 `entries` memo 的项**在流式期间收益为 0**，省的是「与消息流无关的重渲染」；
   `Markdown` 那层才是「流式期历史消息不重解析」的主要收益。

4. **未折叠条目禁用 `content-visibility: auto`**。屏幕外元素用**估值高度**会让 `scrollHeight` 漂移 → 滚动条跳动、
   贴底跟随（`scrollTop = scrollHeight`）抖动、刻度轨比例错乱。只对**收起态**（真实高度恒为 0）用 `hidden`；
   未折叠条目不得用 `auto`。完整虚拟滚动同样被这条挡住——它会同时牵动吸顶 / 吸底跟随 / 轮折叠 / 刻度轨
   四套依赖真实 DOM 与 `scrollHeight` 的机制。
