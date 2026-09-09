# 右侧预览面板升级：工作空间文件目录 + 多格式渲染 Spec

## Why

KamiBuddy 右侧预览面板目前只有「产物/变更/工作区文件」三个下拉组，工作区文件是平铺列表（无目录树、无层级、无懒加载），且渲染矩阵只有 HTML/图片/裸文本三类。WorkBuddy 的 DetailPanel 有完整的文件树浏览（懒加载、VSCode 式单击预览/双击固定 tab）、多格式渲染（Office/PDF/markdown/代码高亮/图/视/音）、web 页面预览（内嵌浏览器）。本次升级对齐 WorkBuddy 的核心能力。

## What Changes

### 阶段一（本 spec）：文件树浏览 + 核心格式渲染

- **工作空间文件目录树**：
  - 概览下拉第三组「工作区文件」从平铺列表升级为**目录树**（文件夹可折叠/展开）
  - 懒加载：首屏 depth=2，展开时拉 depth=1（对齐 WorkBuddy 的 `useFileTreeLoader`）
  - 数据源复用 `file-index.ts`（平铺相对路径），renderer 侧按 `/` 重建层级树——不改 daemon，不扩 file-index（2000 条上限内可行）
  - 文件夹图标 + 文件类型图标（复用 WorkBuddy 的 `ArtifactFileTypeIconV2` 思路，用 icons.tsx 现有图标映射）
  - 隐藏规则：`node_modules/.git/.next/.astro` 默认屏蔽（与 file-index 的 skip 规则一致）
  - 单击文件 → 打开预览 tab（替换当前预览 tab，全局唯一）；双击 → 固定 tab（VSCode 语义）

- **多格式渲染**（按扩展名分发）：
  - **代码文件**：引入语法高亮——Monaco Editor 只读模式（`readOnly: true, minimap: false, wordWrap: on`），语言映射表按 WorkBuddy 的 `getLanguageFromFileName` 抄
  - **Markdown**：复用 `markdown.tsx` 的 `Markdown` 组件（react-markdown + remark-gfm），图片相对路径 resolve 到工作区后走 preview-server
  - **PDF**：引入 `react-pdf` + `pdfjs-dist`（依赖已在仓库，worker 打进 chunk）——预览面板新增 PDF 渲染器，preview-server 补 `application/pdf` MIME
  - **Office**：
    - docx → 引入 `docx-preview`（纯 JS，无外部命令）
    - xlsx/xls/csv → 引入 `@fortune-sheet/react`（Luckysheet 系）
    - pptx → 引入 `pptx-preview`（zrender 渲染）
    - 旧格式 doc/ppt → 「暂不支持预览」占位 + 外部打开
  - **图/视/音**：图片已有 `<img>`；视频/音频新增 `<video>`/`<audio>` 标签（Chromium 可播性检查）
  - **不支持的格式**：占位文案「暂不支持预览」+ 外部打开/下载
  - **超大文件**：≥10MB 显示占位 + 打开所在文件夹/下载

### 明确不做（YAGNI，留后续）

- **web 页面预览**（内嵌浏览器）：需动 CSP frame-src、setWindowOpenHandler、独立 session partition——安全决策，单独 spec
- **文件变更跟踪**（diff 视图、checkpoint 级 Keep/Discard）：需扩 session-host 的 diff 计算与 checkpoint 模型，单独 spec
- **文件操作**（重命名/删除/右键菜单）：WorkBuddy 工作区树刻意不做文件管理，对齐
- **在线 Office SDK**（腾讯文档编辑保存）：重依赖，本地解析库兜底已覆盖核心需求

## Impact

- Affected code:
  - [artifact-panel.tsx](file:///d:/DongProject/kamibuddy/src/renderer/artifact-panel.tsx)（文件树、tab 语义、渲染分发）
  - [preview-server.ts](file:///d:/DongProject/kamibuddy/src/core/preview-server.ts)（PDF MIME）
  - [file-index.ts](file:///d:/DongProject/kamibuddy/src/core/file-index.ts)（不改，但确认其 skip 规则与树一致）
  - [markdown.tsx](file:///d:/DongProject/kamibuddy/src/renderer/markdown.tsx)（复用 Markdown 组件）
  - [package.json](file:///d:/DongProject/kamibuddy/package.json)（新增依赖：monaco-editor、react-pdf、pdfjs-dist、docx-preview、@fortune-sheet/react、pptx-preview）
  - [index.css](file:///d:/DongProject/kamibuddy/src/renderer/index.css)（文件树样式、预览占位样式）
- 不触碰 shared 契约、core 业务逻辑、daemon handler（除非 preview-server MIME 需要改）

## ADDED Requirements

### Requirement: 工作空间文件目录树

系统 SHALL 在预览面板的概览下拉中提供工作空间文件的目录树视图，支持文件夹折叠/展开、懒加载、单击预览/双击固定 tab。

#### Scenario: 目录树渲染
- **WHEN** 用户打开概览下拉并点击「工作区文件」
- **THEN** 显示目录树：文件夹可折叠/展开，文件按类型显示图标，隐藏 node_modules/.git 等目录

#### Scenario: 懒加载
- **WHEN** 目录树首次渲染
- **THEN** 只加载 depth=2 的层级；展开文件夹时按需拉取 depth=1 的子层，加载中显示转圈

#### Scenario: 单击预览
- **WHEN** 用户单击文件
- **THEN** 打开预览 tab（若已有预览 tab 则替换；同一文件则激活刷新）

#### Scenario: 双击固定
- **WHEN** 用户双击文件
- **THEN** 预览 tab 转为固定 tab（不再被新单击替换）

### Requirement: 多格式文件渲染

系统 SHALL 按扩展名分发渲染器，支持代码高亮、markdown 渲染、PDF、Office、图/视/音。

#### Scenario: 代码文件
- **WHEN** 用户打开 .js/.ts/.py 等代码文件
- **THEN** Monaco Editor 只读模式渲染，语法高亮按语言映射

#### Scenario: Markdown
- **WHEN** 用户打开 .md 文件
- **THEN** 渲染为富文本（react-markdown），图片相对路径 resolve 到工作区后走 preview-server

#### Scenario: PDF
- **WHEN** 用户打开 .pdf 文件
- **THEN** react-pdf 渲染（分页/缩放/文本选择），preview-server 补 application/pdf MIME

#### Scenario: Office
- **WHEN** 用户打开 .docx/.xlsx/.pptx 文件
- **THEN** docx-preview/fortune-sheet/pptx-preview 渲染；旧格式 .doc/.ppt 显示「暂不支持预览」

#### Scenario: 图/视/音
- **WHEN** 用户打开图片/视频/音频文件
- **THEN** 图片 `<img>`、视频 `<video>`、音频 `<audio>`；视频不可播时提示「下载后用本地播放器」

#### Scenario: 不支持格式
- **WHEN** 用户打开 .zip/.exe 等不支持格式
- **THEN** 显示「暂不支持预览」占位 + 外部打开/下载

#### Scenario: 超大文件
- **WHEN** 文件 ≥10MB
- **THEN** 显示占位 + 打开所在文件夹/下载（不尝试渲染）

## MODIFIED Requirements

### Requirement: 概览下拉「工作区文件」
原实现：平铺相对路径列表（复用 @ 补全的 file-index 数据源）。
修改为：目录树视图（renderer 侧按 `/` 重建层级，懒加载，单击/双击 tab 语义）。

### Requirement: 渲染分发扩展名映射
原实现：HTML/图片/文本三类 + unsupported fallback。
修改为：代码/文本/markdown/PDF/Office/图/视/音/不支持/超大 九类分发。

## REMOVED Requirements

（无）
