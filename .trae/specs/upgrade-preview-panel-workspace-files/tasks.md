# Tasks

## 批一 · 文件树浏览（核心交互）

- [x] Task 1: 目录树数据结构 + 懒加载（renderer 侧纯逻辑）
  - [x] 1.1 新建 `src/renderer/workspace-file-tree.ts`：平铺路径 → 树结构（按 `/` 切分，文件夹优先排序，文件按名称排序）；`flattenTree` 转一维列表（带 depth，缩进 = depth * 12px）
  - [x] 1.2 懒加载状态机：loadedPaths / collapsedFolders / treeData 可受控；首屏 depth=2，展开时拉 depth=1（复用 completions 通道的 files 列表，renderer 侧按前缀过滤子层）
  - [x] 1.3 隐藏规则：node_modules/.git/.next/.astro 默认屏蔽（与 file-index skip 规则一致）
  - [x] 1.4 单元测试：树构建、flatten、懒加载状态机、隐藏规则（22/22 通过）
- [x] Task 2: 目录树 UI + tab 语义
  - [x] 2.1 artifact-panel.tsx 概览下拉「工作区文件」组从平铺列表改为目录树（文件夹 chevron + 文件类型图标，缩进对齐）
  - [x] 2.2 单击文件 → `openPreview`（替换当前预览 tab，全局唯一）；双击 → `openFile`（固定 tab）——改 App.tsx 的 previewTabs/previewActive 状态模型（加 `isPreview` 标志）
  - [x] 2.3 文件类型图标映射：复用 icons.tsx，新增缺失图标（文件夹/代码文件/图片/PDF/Office/音视频/文本/未知）
  - [x] 2.4 index.css：目录树样式（hover、选中、缩进、图标对齐）

## 批二 · 多格式渲染（依赖批一的 tab 模型）

- [x] Task 3: 代码高亮（Monaco Editor）
  - [x] 3.1 package.json 加 monaco-editor 0.56.0；vite 原生 `?worker` 打进本地 chunk（离线可用）
  - [x] 3.2 新建 `src/renderer/code-preview.tsx`：Monaco 只读组件（readOnly/minimap:false/wordWrap:on/fontSize:13），语言映射表（code-languages.ts）
  - [x] 3.3 artifact-panel.tsx 代码文件分支接 code-preview（React.lazy 拆 async chunk，首开代码文件才加载）
- [x] Task 4: Markdown 渲染
  - [x] 4.1 artifact-panel.tsx .md 分支从裸 `<pre>` 改为复用 `markdown.tsx` 的 `Markdown` 组件；图片相对路径 resolve 到工作区（preview-server URL，react-markdown components.img 拦截）
  - [x] 4.2 链接点击走外部打开（复用 markdown.tsx 的链接拦截）
- [x] Task 5: PDF 渲染
  - [x] 5.1 package.json 加 react-pdf 10.5.0（钉死 pdfjs-dist@5.4.296，与根 6.3.289 嵌套共存）；preview-server.ts MIME 表补 `application/pdf`；main/index.ts CSP connect-src 补 `http://127.0.0.1:*`（pdf.js fetch 需要）
  - [x] 5.2 新建 `src/renderer/pdf-preview.tsx`：react-pdf 组件（分页/缩放/文本选择，worker 从嵌套 react-pdf/node_modules/pdfjs-dist 导入打进 chunk——版本严格校验不能混用根 6.x）
  - [x] 5.3 artifact-panel.tsx .pdf 分支接 pdf-preview
- [x] Task 6: Office 渲染
  - [x] 6.1 package.json 加 docx-preview 0.4.0、@fortune-sheet/react 1.0.4、pptx-preview 1.0.7（另补 @corbe30/fortune-excel 做 xlsx→fortune 数据转换、xlsx 做 csv/xls 换皮——fortune-sheet 只认自己的数据模型，不解析文件）
  - [x] 6.2 新建 `src/renderer/office-preview.tsx`：三格式统一入口（docx → docx-preview renderAsync；xlsx/xls/csv → fortune-sheet；pptx → pptx-preview init/preview/destroy）；React.lazy 按格式拆 chunk（office-docx/office-xlsx/office-pptx 各自独立成文件）
  - [x] 6.3 artifact-panel.tsx Office 分支接 office-preview；旧格式 .doc/.ppt 显示「暂不支持预览」占位
- [x] Task 7: 图/视/音 + 不支持/超大占位
  - [x] 7.1 视频/音频：`<video>`/`<audio>` 标签 + Chromium 可播性检查（canPlayType 同步探测，不可播提示「下载后用本地播放器」+ 下载按钮）
  - [x] 7.2 不支持格式：占位文案「暂不支持预览」+ 外部打开/下载（PreviewPlaceholder 共用布局）
  - [x] 7.3 超大文件（≥10MB）：占位 + 打开所在文件夹/下载（只在 text/markdown 分支经 readArtifact size 检查，图/视/音/PDF 走流式加载不检查）

## 批三 · 验证

- [x] Task 8: 全量验证
  - [x] 8.1 `npm run typecheck && npm run check:deps && npm test` 全绿（45 文件 / 634 用例；build 成功，office-docx/office-xlsx/office-pptx/code-preview 各自独立 chunk）
  - [ ] 8.2 手测：目录树折叠/展开/懒加载、单击预览/双击固定、代码高亮、markdown 渲染、PDF 分页、Office 三格式、图/视/音、不支持格式占位、超大文件占位（需用户执行）

# Task Dependencies
- Task 2 依赖 Task 1（树数据结构先行）
- Task 3-7 依赖 Task 2（tab 语义统一后接渲染器）
- Task 8 依赖全部
- 批一与批二可并行（Task 1/2 与 Task 3-7 文件交集小），但 Task 3-7 内部建议串行（都改 artifact-panel.tsx 渲染分发）
