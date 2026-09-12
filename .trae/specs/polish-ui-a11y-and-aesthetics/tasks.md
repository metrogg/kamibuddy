# Tasks

## 波一 · 并行（CSS 与 tsx 零交集）

- [ ] Task 1: 快修包（纯 CSS）
  - [ ] 1.1 `:root` 定义 `--accent`（收编 #1470b4，注释：链接需要可辨识色，
    修复引用未定义导致 markdown 链接与正文同色的 bug）+ `--warning`（#d9822b）
    + `--primary-hover`（rgba(0,0,0,0.82) 或审计后取值）；`.markdown a` 用 --accent +
    常态下划线；`.view-switcher-check` 同步；3 处 #d9822b 硬编码替换为 var(--warning)
  - [ ] 1.2 `.turn-duration`/`.task-item-meta`/`.cu-percent` 补
    `font-variant-numeric: tabular-nums`（注释：比例宽数字每秒刷新会抖行宽）
  - [ ] 1.3 全局 button :focus-visible 焦点环（统一规则： outline 2px var(--text-dim)
    offset 2px 或审计后选更贴设计的形态；覆盖 button/[role="button"]/select/input/
    textarea；注释：键盘用户唯一焦点指示）
  - [ ] 1.4 composer textarea 与 questionnaire-other-input 的 outline:none 补焦点替代
    （.composer-card:focus-within 边框/阴影变化；问卷输入框同款）
  - [ ] 1.5 验证：`npm run typecheck && npx vitest run src/renderer`

- [ ] Task 2: P0 可访问性（tsx）
  - [ ] 2.1 chat-view.tsx:189 缩略图包 `<button>`（img 补宽高）；:214 图片遮罩补
    Esc 关闭（useEffect keydown）；:1609 嵌套 span role=button 改真 button 或独立
  - [ ] 2.2 label 关联：chat-view.tsx:1094（aria-label）、settings-view.tsx:140/302/315/
    1141（label 或 aria-label 逐一）、sidebar.tsx:174/315、composer.tsx:260
  - [ ] 2.3 index.css entry-toolbar 补 `:focus-within` 可见（抄 sidebar task-item-ops
    的正确写法——CSS 归 Task 2 因为与 2.3 的语义绑定，与 Task 1 的 CSS 区块不同）
  - [ ] 2.4 验证：`npm run typecheck && npx vitest run src/renderer`

## 波二 · 并行（tsx 与 CSS token 零交集）

- [x] Task 3: P1 体验（tsx + 少量 CSS）
  - [x] 3.1 chat-view ModeSwitch 与 model-menu.tsx：触发钮 aria-haspopup/expanded、
    菜单 backdrop + Esc 关闭 + role="menu"/menuitem（对齐 plus-menu 的实现口径）
  - [x] 3.2 automations-view.tsx:504 弹层 aria-labelledby（关联 h2）+ Esc 关闭；
    permission-dialog.tsx:58 alertdialog 补 aria-labelledby
  - [x] 3.3 automations 任务行 hover 态 + 调度类型 toggle 组 aria-pressed；
    artifact-panel.tsx sash 键盘调宽（方向键 ±10px，role=separator 补 aria-orientation）
  - [x] 3.4 index.css toast-spinner 补 reduced-motion 变体
  - [x] 3.5 验证：`npm run typecheck && npx vitest run src/renderer`

- [ ] Task 4: token 体系（纯 CSS）
  - [ ] 4.1 圆角收敛：`--radius-sm:6px / --radius-md:10px / --radius-lg:16px` 三档
    （md/lg 已有），审计 14 种散落值：可归并的（6/7/8→sm 或 md 就近）替换，
    逐字不同且有语义（22/24 大容器）保留或升 lg——逐项决策注释
  - [ ] 4.2 黑阶收口：rgba(0,0,0,0.75/0.82/0.9) 提为 --primary-hover/--primary-active
    （与 Task 1 的 1.1 定义合并设计，若 Task 1 已建则直接用）
  - [ ] 4.3 字号阶梯：`--text-meta:12px / --text-list:13px / --text-body:14px /
    --text-emphasis:15px / --text-display:30px`，替换高频处（约前 30 处），
    注释各档职责；用户气泡 15 与助手 14 的差异在注释里定性（用户=emphasis、
    助手=body——有意区分发言者）
  - [ ] 4.4 验证：`npm run typecheck && npx vitest run src/renderer`

## 波三 · 并行

- [ ] Task 5: P2 打磨（tsx + CSS）
  - [ ] 5.1 `.provider-select` 缺失样式补上（与 .key-input select 同档位）；
    数字格式 Intl.NumberFormat ×2（settings-view:1287、model-menu:163）；
    baseUrl type="url"；id 输入 spellCheck=false + autoComplete="off"
  - [ ] 5.2 三处菜单 role="menu"（plus-menu 若有漏则补）、skills-view 页签
    role="tablist"/tab + aria-selected、settings seg-head aria-expanded、
    automations 调度 toggle aria-pressed（若 Task 3 未覆盖）
  - [ ] 5.3 chat-view:1576 状态行 aria-live="polite"；home-view:189 placeholder 补 `…`；
    index.css home-title text-wrap: balance；modal 内滚动卡 overscroll-behavior: contain；
    模型大列表 content-visibility: auto
  - [ ] 5.4 index.css reduced-motion 全局兜底一行式（`*` 通配 0.01ms，注释：
    一处收口替代逐区块补丁；既有逐区块规则保留不冲突）
  - [ ] 5.5 验证：`npm run typecheck && npx vitest run src/renderer`

- [x] Task 6: 审美修正（renderer + resources 无交集）
  - [x] 6.1 案例封面去 pastel：6 张封面改体裁图标（复用 docBadgeOf 或 icons 语义
    图标）+ 单色底（--bg-raised 或单一强调色淡底）；删 6 组渐变与 hover 上浮
  - [x] 6.2 侧栏 4 个死导航项（助理/项目/资料库/更多）降灰（opacity 弱化 +
    title 提示「随版本迭代开放」，注释：占位展示≠可用，视觉要诚实）
  - [x] 6.3 文案：「引擎启动中…」→「正在准备…」、「引擎已就绪」→「已就绪」
    （用户视角自创；找到所有出现处）
  - [x] 6.4 验证：`npm run typecheck && npx vitest run src/renderer`

## 波四 · 字体（独立，最后做）

- [x] Task 7: Windows 中文字体随包
  - [x] 7.1 调研可靠下载源（MiSans 官方/jsdelivr npm 镜像/HarmonyOS Sans 官方），
    核实许可证可商用；下载 woff2/ttf
  - [x] 7.2 pyftsubset 子集（GB2312 常用字 + ASCII + 常用标点，woff2，目标 ≤2MB），
    放 `resources/fonts/`；@font-face 声明（font-display: swap）
  - [x] 7.3 index.css 字体栈插入（MiSans 在 Segoe UI 之前、雅黑之前），
    font-weight 600 用真字重；renderer 构建资源包含 fonts 目录（核查 electron-vite
    静态资源路径——resources/ 现有打包机制沿用）
  - [x] 7.4 验证：`npm run typecheck && npm run check:deps && npm test`；
    下载/子集受阻则报告阻塞原因不硬闯

## 收尾

- [x] Task 8: 复跑审查验证清零 + 全量验证
  - [x] 8.1 用 web-interface-guidelines 复跑同口径审查：首轮发现一批修复被并行会话
    （align-expert-system-workbuddy）的旧快照覆盖 → 合并代理补回（A label 批/
    B 审美修正/C P2 残留/D 新发现 4 弹层 Esc）→ 终验 10/10 通过，P0/P1 清零
  - [x] 8.2 `npm run typecheck && npm run check:deps && npm test` 全绿（1348 用例）
  - [x] 8.3 P2 剩余记档：虚拟化（content-visibility 已轻量覆盖）、来源行 button+window.open
    （Electron 语义可接受）、widget iframe 内字体（独立注入，超出范围）

# Task Dependencies

- Task 1/2 并行；Task 3/4 并行（依赖 1/2 完成，tsx 与 CSS 错峰）；Task 5/6 并行；
- Task 7 独立（建议最后，避免 index.css 字体栈与其他 CSS 任务冲突）；
- Task 8 依赖全部前置任务
