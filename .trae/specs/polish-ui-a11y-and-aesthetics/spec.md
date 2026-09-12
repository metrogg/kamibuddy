# 界面规范与审美全量修复 Spec

## Why

Vercel 规范审查（44 项：P0×11/P1×14/P2×19）+ frontend-design 审美诊断双报告在手，
用户拍板全部修复。核心痛点：`--accent` 未定义致 markdown 链接不可辨（真 bug）、
全局无焦点环、一批表单无 label、案例封面 pastel 渐变是 slop 特征、
圆角/琥珀色无 token 体系、Windows 中文字体（雅黑合成加粗）是观感最大杠杆。

## What Changes

1. **快修包**：定义 `--accent`（收编既有路径蓝 #1470b4）+ markdown 链接常态下划线；
   `.turn-duration`/`.task-item-meta`/`.cu-percent` 补 tabular-nums；
   全局 button 补 `:focus-visible` 焦点环（统一 token）；composer/问卷输入框
   `outline:none` 补焦点替代（focus-within 边框/环）
2. **P0 可访问性**：非 button 交互 3 处语义化（缩略图包 button、图片遮罩 Esc 关闭、
   嵌套 span role=button 改真 button）；表单 label 关联（chat-view 保存输入、
   settings 6 处、sidebar 重命名 2 处、composer textarea）；entry-toolbar 补
   `:focus-within` 可见
3. **P1 体验**：ModeSwitch/model-menu 菜单语义对齐 PlusMenu（aria-haspopup/expanded、
   backdrop、Esc、role=menu）；automations 弹层与 permission 弹窗补可访问名 +
   automations Esc；automations 任务行 hover 态 + 调度 toggle aria-pressed；
   artifact sash 键盘调宽（方向键）；toast-spinner 补 reduced-motion
4. **P2 打磨**：`.provider-select` 缺失样式补上；数字格式 Intl.NumberFormat ×2；
   baseUrl type="url"；id 输入 spellCheck/autocomplete；三处菜单 role=menu、
   skills 页签 tablist 语义、seg-head aria-expanded；状态行 aria-live；
   首页 placeholder 补 `…`；home-title text-wrap: balance；modal 滚动卡
   overscroll-behavior: contain；reduced-motion 全局兜底一行式（替代逐区块补丁）；
   模型大列表 content-visibility: auto
5. **token 体系**：圆角收敛 3 档（sm/md/lg 替换散落 14 种值中可归并的，
   逐字不同的保留——审计后决策）；`#d9822b` 提 `--warning`（3 处替换）；
   `rgba(0,0,0,0.75/0.82/0.9)` 提 primary 悬停档；字号阶梯 5 档 token
   （meta 12/list 13/body 14/emphasis 15/display 30，先立 token 替换高频处，
   不全量重写——防 churn 失控）
6. **审美修正**：案例封面去 pastel 渐变（体裁图标 + 单色底，颜色编码内容类型）+
   去 hover 上浮；侧栏 4 个死导航降灰（可点但弱化，注释原因）；「引擎启动中/已就绪」
   改用户视角文案（自创：「正在准备…/已就绪」）
7. **Windows 中文字体**：随包 MiSans（或 HarmonyOS Sans SC）子集 woff2
   （pyftsubset 常用汉字+ASCII，目标 ≤2MB）+ @font-face + 字体栈插入
   （雅黑降级为兜底）；字体许可证核实可商用

**明确不做**：虚拟化重写（用 content-visibility 轻量方案）、来源行改 `<a>`
（Electron 下 button+window.open 语义可接受，记档）、全站圆角逐值重写
（只收可归并的）、深色主题。

## Impact

- Affected specs：无功能变更，纯规范与审美修复
- Affected code：`src/renderer/index.css`（大头）、`chat-view.tsx`、`home-view.tsx`、
  `sidebar.tsx`、`composer.tsx`、`settings-view.tsx`、`automations-view.tsx`、
  `permission-dialog.tsx`、`model-menu.tsx`、`plus-menu.tsx`、`skills-view.tsx`、
  `artifact-panel.tsx`、`sources-panel.tsx`、`resources/fonts/`（新）

## ADDED Requirements

### Requirement: 可访问性基线

所有交互元素 SHALL 可键盘到达且有可见焦点（`:focus-visible` 焦点环）；
表单控件 SHALL 有程序化 label 关联；弹层菜单 SHALL 有统一关闭路径
（Esc + backdrop）与语义角色；图片/遮罩类交互 SHALL 有键盘等价。

#### Scenario: 键盘走查
- **WHEN** 用户只用 Tab/Enter/Esc 操作主界面
- **THEN** 焦点始终可见，所有按钮/输入/菜单可到达可操作，弹层可 Esc 关闭

### Requirement: token 体系收口

`--accent`/`--warning` SHALL 定义并替换全部散落引用；圆角与字号 SHALL 有
token 档位（新增组件只许选档）；markdown 链接常态可辨识。

#### Scenario: 链接可辨
- **WHEN** 模型回复含 markdown 链接
- **THEN** 链接以 --accent 色 + 常态下划线呈现，与正文明确区分

### Requirement: 审美修正

案例封面 SHALL 以体裁图标 + 单色底编码内容类型（无随机 pastel 渐变、无 hover
上浮）；计数字符 SHALL 使用 tabular-nums（宽度不抖动）；Windows 中文 SHALL
以随包字体渲染（雅黑仅兜底）。

#### Scenario: 计时稳定
- **WHEN** 回合计时「已处理 Ns」每秒刷新
- **THEN** 行宽不随数字变化抖动

## MODIFIED Requirements

无（均为缺陷修复与体系收口，不改变既有功能语义）。

## REMOVED Requirements

无。
