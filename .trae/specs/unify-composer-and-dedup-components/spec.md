# 统一 Composer 组件 + 渲染层去重 Spec

## Why

上个 spec 给对话页「+」加了菜单，但首页（新建任务界面）的「+」仍是裸的图片选择按钮——
用户实测抓到。根因不是漏改，而是**首页与对话页的输入卡是两份手写重复代码**
（拖放卡、附件/文档 chip 条、VisionHint、textarea 八绑定、submit、keydown 链各约 150 行）：
改一处漏一处是必然事件。此外渲染层还有工具条 CSS、菜单容器 CSS 等重复。
重复不仅难维护，也让后续扩展（新菜单项、新输入能力）要改 N 处。

## What Changes

1. **抽取统一 `Composer` 组件**（`src/renderer/composer.tsx`），home-view 与 chat-view 共用：
   - 内置：draft 状态、useImageAttachments / useAutocomplete / useImeGuard 三 hook 接线、
     文档 chip 条 + 图片缩略图条 + VisionHint、拖放高亮、标准 keydown 链
     （ac 先行 → IME 守卫 → 可选 Alt 历史 → 流式 Esc 停止确认 → Enter 提交）、
     提交逻辑（trim、字数闸、foldDocumentRefsIntoText、成功清附件/记录历史/清草稿）、
     composer-bar 固定尾部（字数余量 + 发送/停止按钮，含停止二次确认状态机）
   - 差异走 props：placeholder、rows、cwd（补全刷新键）、modelId（VisionHint）、ready、
     onSubmit、onError、可选 draftKey（按 sessionId 存草稿，home 不传）、
     可选 enableHistory（Alt+↑↓ 输入历史，home 不开）、可选 streaming（停止按钮与 Esc）
   - composer-bar 左组用 children 注入（home 与 chat 的按钮组合不同）
2. **首页「+」修复**：home-view 接入 Composer 后，bar 左组的裸「添加附件」按钮换成
   与对话页同一个 `PlusMenu`（App 需向 HomeView 补传 availableModes / interactionId /
   onInteractionChange）。首页同时获得字数闸（10 万上限双闸，与对话页一致）。
3. **工具条 CSS 合并**：`.user-toolbar/.user-copy` 与 `.assistant-toolbar/.assistant-copy`
   规则近乎相同（常驻占位 opacity 切换、三级灰图标 hover 加深），合并为共享类 +
   位置修饰类；DOM 类名同步更新。
4. **菜单容器 CSS 去重**：核查 `.model-menu` / `.permission-menu` / `.plus-menu` /
   `.mode-menu` 的容器规则，相同部分抽公共类（差异保留各自类）。
5. **渲染层重复审计**：扫 settings-view / skills-view / diagnostics-view / sidebar /
   artifact-panel / permission-dialog 等，只合并「不言自明且稳定」的重复
   （判据：逻辑相同、无各自演进方向）；存疑项记录在 STATUS.md 专节，不动。

**明确不做**：菜单 open/backdrop 力学不抽 React 组件（四处各约 10 行且已共用
`ws-backdrop` 类，抽了是过度抽象）；home 不开输入历史与草稿持久（发送即跳对话页，
现状语义不变）；不改任何行为语义（除首页获得 PlusMenu 与字数闸这两个一致性改进）。

## Impact

- Affected specs：补齐 `add-plan-mode-and-plus-menu` 明确留下的「首页 + 本批不改」
- Affected code：
  - `src/renderer/composer.tsx`（新增统一组件）
  - `src/renderer/home-view.tsx`（瘦身为布局 + Composer 组装）
  - `src/renderer/chat-view.tsx`（composer 区块替换为 Composer）
  - `src/renderer/App.tsx`（HomeView 补传模式相关 props）
  - `src/renderer/index.css`（工具条合并、菜单容器公共类、Composer 相关类名梳理）
  - 审计可能触及：settings-view / skills-view / diagnostics-view / sidebar / artifact-panel
- 不改 daemon / core / shared / 契约。

## ADDED Requirements

### Requirement: 统一 Composer 组件

系统 SHALL 提供单一 `Composer` 组件承载首页与对话页的输入卡：两页的拖放、附件
（图片 + 文档 chip）、IME 守卫、autocomplete、提交、发送/停止按钮行为完全一致；
差异（placeholder、行数、草稿 key、输入历史开关、流式停止、bar 左组按钮）全部经
props/children 注入。此后新增输入区能力（如新的附件类型、新的快捷键）只改一个文件。

#### Scenario: 行为一致性
- **WHEN** 用户在首页或对话页的输入卡执行同一操作（粘贴图片、拖入文档、
  中文输入法选词按 Enter、@ 补全选择、超长粘贴触发字数闸）
- **THEN** 两页行为与反馈完全一致

### Requirement: 首页加号菜单

系统 SHALL 让首页「+」与对话页「+」渲染同一个 PlusMenu（添加文件 / 模式 ▸ /
专家 / 技能 / 连接器），模式切换经既有 setInteraction 链路生效（App 向 HomeView
补传模式数据源）。

#### Scenario: 首页选计划模式开任务
- **WHEN** 用户在首页点「+」→「模式」→「计划」，再发送首条消息
- **THEN** 新任务以 plan 模式起手（工具面只读），进入对话页后 ModeSwitch 显示「计划」

### Requirement: 工具条与菜单样式去重

系统 SHALL 将用户气泡工具条与助手操作条的相同 CSS 规则合并为共享类（位置差异用
修饰类表达）；菜单容器（model/permission/plus/mode 四个弹层）的相同容器规则
（底色/边框/圆角/阴影/层级）抽为公共类。合并后视觉 SHALL 与合并前一致
（逐项对照：占位高度、hover 反馈、弹层阴影圆角）。

#### Scenario: 视觉零回归
- **WHEN** 合并完成后 hover 用户气泡、hover 助手消息、打开任一弹层
- **THEN** 工具条浮现节奏、按钮反馈、弹层观感与合并前一致

## MODIFIED Requirements

### Requirement: 首页输入卡

**原**：首页输入卡为 home-view.tsx 内手写实现；「+」直接弹图片选择框；无字数限制。
**新**：首页输入卡由统一 Composer 渲染；「+」为 PlusMenu；10 万字符字数闸与对话页一致
（余量显示 + 超限禁发双闸）。首页仍不开启输入历史与草稿持久（语义不变）。

## REMOVED Requirements

### Requirement: 双份 composer 实现
**Reason**：两份手写重复是「改一处漏一处」bug 的直接根因（本次首页「+」即实例）。
**Migration**：home-view / chat-view 的 composer 区块删除，改为渲染统一 Composer；
被内化的局部状态（draft、停止确认、历史导航）迁移进 Composer。
