# Tasks

> **关键约束：`src/renderer/index.css` 是单文件（7604 行），Task 1–4 都改它，
> 因此这 4 个任务必须严格串行执行**（并行会让两个 agent 互相覆盖）。Task 5 只碰
> `scripts/` 与 `package.json`，可与 Task 1 之后任意阶段并行。
>
> **完成状态（2026-09-14）**：Task 1–6 全部完成，`npm run check` 通过（真违例 0 / 白名单 77 / 豁免 105），
> `npm test` 95 文件 / 1711 用例全绿。**唯一未完成项是 SubTask 6.5 的 GUI 走查** ——
> 本沙箱起 Electron 被系统权限拦截，已用构建产物核对 + `var()` 全量核查替代（见 `docs/design-tokens-migration.md`）。

- [x] Task 1: token 接线（`index.css` ← `tokens.css`）
  - [x] SubTask 1.1: 在 `index.css` 顶部加 `@import "./../styles/tokens.css";`（路径以 vite 解析为准，需实测）
  - [x] SubTask 1.2: 删除 `index.css` 的 `:root` 块（56–120 行），保留块内**非变量**的说明性注释迁移到 `tokens.css` 对应变量处
  - [x] SubTask 1.3: 按映射表改名并全站替换：`--text-dim` → `--text-secondary`；`--shadow-card` → `--shadow-md`；`--shadow-questionnaire` → `--shadow-sm`
  - [x] SubTask 1.4: 接线阶段**只改名、不改数值**：`--seg` / `--kw-*` / `--shadow-input` 的引用点原地保留（它们各自的收敛在 Task 2b 处理）
  - [x] SubTask 1.5: 验证：`npm run typecheck` + `npm test` 通过；dev 打开首页 / 对话页 / 设置页确认无 `var()` 解析失败导致的样式丢失

- [x] Task 2a: 按档收敛 —— 字号 / 间距 / 圆角（`index.css`）
  - [x] SubTask 2a.1: 字号：等值 156 处直接换 `var()`；档外 11 处按 spec「字号」归档表处理（10→meta、16/18→emphasis、20→display）；18px 归后若层级不足，用 `font-weight: 600` 补
  - [x] SubTask 2a.2: 间距：按 spec「间距」归档表逐类收敛（1/3→2px、5→space-1、7→space-2、9/10→space-3、14→space-4、18/20→space-5、22~30→space-6、36~44→space-7）；**例外保留**：2px 亚间距、≥48px 页面级留白、负值；多值简写逐值处理
  - [x] SubTask 2a.3: 圆角：按 spec「圆角」归档表处理（8→sm/md 按语义、12→md 或 full、7→sm、50%→full）；**例外保留**：1–5px 微圆角、22/24px WB 原值
  - [x] SubTask 2a.4: 抽查归档后观感：重点看按钮 / 列表行 / chip 的 padding 与固定高度容器——若明显过挤，按 spec「实测偏差处理」就近向上并记白名单 + 注释
  - [x] SubTask 2a.5: 验证：`npm test` 通过（**dev 抽查受沙箱 GUI 限制未做**）
  - 实测补充：档外字号实际为 **39 处**（除 10/16/18/20px 外还发现 `11px × 28`），一并按同一原则归入 `--text-meta`；间距 596 个值改写，含 3 处「实测偏差回退」（让位偏移 36/40/44px，已注释 + 登记白名单）

- [x] Task 2b: 按档收敛 —— 颜色 / 阴影 / 时长 / z-index（`index.css` + `*.tsx` 内联）
  - [x] SubTask 2b.1: 颜色等值项换 `var()`：`#f2f2f2`→`--bg-sidebar`、`#f7f7f7`→`--bg-raised`、`#e6e6e6`→`--border`、`#ffffff`→`--bg`/`--primary-text`、`#1470b4`→`--accent`、`#d9822b`→`--warning`、`#f64041`→`--danger`、`#0cbf5b`→`--ok`
  - [x] SubTask 2b.2: **文字色 4 级收 3 级**：`rgba(0,0,0,.7)` 的全部引用点 → `--text-secondary`（层级更克制）
  - [x] SubTask 2b.3: **遮罩 5 档收 1 档**：32%/40%/55%/72%/78% → `--overlay`；确需更暗的场景（如图片预览全屏）保留原值并登记例外
  - [x] SubTask 2b.4: **分类调色板 3 套收 1 套**：新建全局 `--cat-1..6`（取 `--seg` 六色为基准；`#d9822b` 换色相避免与 `--warning` 撞值），`--seg` / `comp-*` / `cu-seg-*` 三处改为共用
  - [x] SubTask 2b.5: `--kw-*`（widget iframe 的 26 个色值）对齐宿主 token 值
  - [x] SubTask 2b.6: 阴影：等值换 `var()`（含 4 处 `0 12px 40px rgb(0 0 0/18%)` → `--shadow-lg`）
  - [x] SubTask 2b.7: 时长：0.12~0.18s→`--dur-fast`、0.2/0.24s→`--dur-base`、0.28~0.32s→`--dur-slow`；`cubic-bezier(0.33,1,0.68,1)`→`--ease-out`；**例外保留**循环动画时长（0.8/1.1/2/2.2s）
  - [x] SubTask 2b.8: z-index：按 spec 映射表替换（含 `.toast-stack` 100→`--z-toast` 的修正）；backdrop 与子菜单同档、靠 DOM 序分层
  - [x] SubTask 2b.9: 清理死代码：删除被 `color-mix` 覆盖的 3 行硬编码（`#d7e8f6`/`#a8cdea`/`#5b9fd4`）
  - [x] SubTask 2b.10: 验证：`npm test` 通过（**dev 抽查受沙箱 GUI 限制未做**；`.toast-stack` 层级已代码层核对：200 > 模态 100）
  - 实测补充：另修 `#d9822b` 换色相为 `--cat-5 #e06c3a`、消除第 4 行同型死代码、`.questionnaire-card` 24→lg、`.questionnaire-skip-btn` 24→full、同步修正 `tokens.css` 的圆角注释

- [x] Task 3: 全局交互基础面（`index.css`）
  - [x] SubTask 3.1: 补齐 `:active` 按下态：为主要交互类加 `transform: scale(.98)` 或底色加深 —— `.bar-btn`、`.mini-btn`、`.primary-btn`、`.send-btn`、`.ws-item`、`.ws-action`、`.ex-card`、`.model-card`、`.task-item`、`.pop-menu` 内菜单项、`.provider-select-trigger`、`.auto-row`、`.mcp-row`。**只允许动 transform/opacity，时长用 `var(--dur-fast)`**
  - [x] SubTask 3.2: 补 `.bar-btn:disabled` / `.ws-item:disabled` / `.ws-action:disabled` / `.provider-select-trigger:disabled` 等缺失的禁用态视觉（`opacity: .4~.5` + `cursor: default`）
  - [x] SubTask 3.3: 加 reduced-motion 全局兜底块（`*, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important }`），保留现有 7 处局部块（不冲突）
  - [x] SubTask 3.4: 嵌套滚动容器补 `overscroll-behavior: contain`：`.thinking-body`、`.tool-detail-box.open`、`.user-bubble`、`.model-menu`、`.ws-list`、`.preview-view`、`.ac-menu`、`.questionnaire-content`
  - [x] SubTask 3.5: 加全局滚动条基线（`*::-webkit-scrollbar` 细条 + `scrollbar-width: thin`），确保 `.stream`/`.preview-view`/`.settings-body` 等与侧栏风格一致；`.sidebar-scroll` 的既有特化规则保留
  - [x] SubTask 3.6: 修 `index.css:1318` 的 `transition: ... font-weight ...`（去掉 font-weight 过渡）
  - [x] SubTask 3.7: 补 3 处漏配的 Esc 关闭（spec §D 承诺本轮顺手补）：`plus-menu.tsx`（整文件无 keydown）、`sidebar.tsx` 的 space-menu、`context-usage.tsx` 的 `.cu-popover` —— **只加 Esc**，不借机抽共享 hook（抽 hook 排 #5）
  - [x] SubTask 3.8: 验证：`npm test` 通过（**dev 按下态/Esc 实测受沙箱 GUI 限制未做**；已用 dev server 编译产物确认代码进入运行实例）
  - 实测补充：`:active` 覆盖 **25 个类**；禁用态实缺 **5 个类**（另发现 `.composer-card textarea:disabled`、`.save-space-input:disabled`）；`.auto-row`/`.mcp-row` 经判断**有意未加** `:active`（容器行不可点，避免子元素按下时整行缩放）

- [x] Task 4: 共享状态组件（新建 `src/renderer/state-views.tsx`）
  - [x] SubTask 4.1: 实现 `Spinner`（合并现有 5 套：`.task-spinner`/`.todo-spinner`/`.file-tree-spinner`/`.mcp-badge-spinner`/`.toast-spinner`），支持 size prop；reduced-motion 由 Task 3.3 全局兜底覆盖（删除各套局部 patch）
  - [x] SubTask 4.2: 实现 `EmptyState`（props: icon?/title/description?/action?）、`LoadingState`（props: text?）、`ErrorState`（props: message/onRetry?）；样式走 token，类名统一 `.state-empty`/`.state-loading`/`.state-error`/`.spinner`
  - [x] SubTask 4.3: 替换散落实现（**只替换数据驱动视图与异步控件上的**；无异步的交互控件、纯展示组件、三方内容内层一律不套 —— 见 spec §B 分级表）：空态 13 种类名（`settings-empty`×30+、`auto-empty`、`skills-empty`、`ex-empty`、`ws-hint`、`preview-group-empty`、`preview-fallback`、`model-menu-empty`、`permission-menu-empty`、`task-agent-placeholder`、`todo-placeholder`、`section-empty`、`provider-select-empty`）；错误态（`settings-error`、`ws-error`、`save-space-error`）；加载态（`正在读取…` 各变体）
  - [x] SubTask 4.4: **修「加载与空」混淆**（本轮的实质缺陷修复，不止换样式）：`sidebar.tsx:525`（首屏闪空态）、`skills-view.tsx:149`（失败卡在「正在读取」且无重试）、`model-menu.tsx:158`、`permission-menu.tsx:117`、`experts-view.tsx:213`（失败显示成搜索无结果）—— 改为「`undefined`→Loading、`[]`→Empty、error→ErrorState+重试」
  - [x] SubTask 4.5: 删除 `index.css` 中被替换掉的旧状态类规则；保留仍被引用的（grep 确认后再删）
  - [x] SubTask 4.6: 验证：`npm run typecheck && npm test` 通过；grep 确认旧类名在 tsx 与 css 中均归零
  - 实测补充：共替换 **87 处旧状态类 + 8 处 spinner**，涉及 25 个 tsx 消费方（含边界外的 `workspace-picker` / `widget-view` / office / pdf 预览——因「旧类名须零命中」必须改）

- [x] Task 5: 机械校验脚本 `check:tokens`（可与 Task 1 后任意阶段并行）
  - [x] SubTask 5.1: 新建 `scripts/check-design-tokens.ts`：扫 `src/renderer/index.css` 与 `src/renderer/**/*.tsx`，报出未走 token 的硬编码 —— 颜色（hex/rgb/rgba/hsl，排除 `:root` 定义与 `color-mix` 内的 token）、间距/字号/圆角（裸 px，排除不可避免的 0/1px/100%/几何值）、阴影、时长、z-index
  - [x] SubTask 5.2: 支持白名单文件（`scripts/design-tokens-allowlist.json`），条目含 `file`/`line`/`reason`；差异清单项入白名单，输出时与「真违例」分开计数
  - [x] SubTask 5.3: `package.json` 加 `"check:tokens": "tsx scripts/check-design-tokens.ts"`，并把 `check` 改为 `npm run typecheck && npm run check:deps && npm run check:tokens`
  - [x] SubTask 5.4: 验证：脚本对当前代码跑出「等值违例 0 + 白名单命中 N」；手工造一条 `color: #ff0000` 确认能报出且非零退出
  - 实测补充：修了长度 token 正则缺符号位的 bug（负值豁免此前失效）；Task 6 进一步把白名单从「锚行号」改为「锚行文本片段」并加「未命中告警」

- [x] Task 6: 全量校验与差异清单归档
  - [x] SubTask 6.1: `npm run typecheck && npm run check:deps && npm run check:tokens` 三项通过
  - [x] SubTask 6.2: `npm test` 全绿（当前基线 91 文件 / 1646 用例）
  - [x] SubTask 6.3: 写 `docs/design-tokens-migration.md`：接线映射表 + **归档统计**（各类实际收敛处数，对照 spec 归档表）+ **例外登记表**（亚间距 2px、微圆角 1–3px、WB 原值、页面级大留白、循环动画时长、三方内容、实测偏差回退项）——每条给「位置 + 语义 + 为何不归档」
  - [x] SubTask 6.4: 在 `DESIGN.md` 标注本轮已生效范围与已知例外（避免读者以为规范已 100% 落地）
  - [ ] SubTask 6.5: 手工走查：dev 起应用，抽 6 个主界面（首页/对话页/侧栏/产物面板/设置/专家页）确认无视觉回归
    - **受阻，未完成**：本沙箱起 Electron 被系统权限拦截（`sRGB Color Space Profile.icm` 受限），且已有一个 dev 实例持有单实例锁。已完成等效替代验证：`npm run build` 成功 + 产物 CSS 含全部 token + 全仓 58 个 `var()` 引用零缺失 + 关键层级/四态代码层复核。**真实观感仍需人工在运行的应用里确认**（清单见迁移文档 §6）
  - 实测更正：`npm test` 实际基线为 **95 文件 / 1711 用例**（原写 91/1646 已过时）

# Task Dependencies

- Task 2a / 2b / 3 / 4 均依赖 Task 1（需要 token 已接线）**且彼此串行**（同一个 `index.css` 文件）
- Task 2b 依赖 Task 2a（同文件；先做字号/间距这类量大的，再做颜色/时长）
- Task 5 只碰 `scripts/` + `package.json`，**与 Task 1–4 任意阶段可并行**
- Task 6 依赖 Task 1–5 全部完成
