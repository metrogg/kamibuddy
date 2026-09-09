# Checklist

## 文件树浏览
- [x] 概览下拉「工作区文件」显示目录树（文件夹可折叠/展开，文件按类型显示图标）（artifact-panel.tsx:586-636）
- [x] 隐藏 node_modules/.git/.next/.astro 等目录（workspace-file-tree.ts:34-46 HIDDEN_DIRS 11 项）
- [x] 懒加载：首屏 depth=2，展开时拉 depth=1，加载中显示转圈（initLoaded + loadingPaths + file-tree-spinner）
- [x] 单击文件 → 预览 tab（替换当前预览 tab，全局唯一）（App.tsx:319-329 openPreview 原位替换）
- [x] 双击文件 → 固定 tab（不再被新单击替换）（App.tsx:332-339 openFile 转正）
- [x] 文件类型图标：文件夹/代码/图片/PDF/Office/音视频/文本/未知 各有区分（file-type-icon.tsx 分族映射）

## 多格式渲染
- [x] 代码文件：Monaco Editor 只读模式，语法高亮按语言映射（code-preview.tsx:65-75 + code-languages.ts:10-42）
- [x] Markdown：渲染为富文本（react-markdown），图片相对路径 resolve 到工作区，链接外部打开（markdown.tsx:73-90 + artifact-panel.tsx:339-350）
- [x] PDF：react-pdf 渲染（分页/缩放/文本选择），preview-server 补 application/pdf MIME（pdf-preview.tsx:100-196 + preview-server.ts:35）
- [x] Office：.docx → docx-preview，.xlsx/.xls/.csv → fortune-sheet，.pptx → pptx-preview；.doc/.ppt 显示「暂不支持预览」（office-preview.tsx + artifact-panel.tsx:76-82）
- [x] 图/视/音：图片 `<img>`，视频 `<video>`（不可播提示），音频 `<audio>`（artifact-panel.tsx:823-875）
- [x] 不支持格式：占位「暂不支持预览」+ 外部打开/下载（artifact-panel.tsx:876-885）
- [x] 超大文件（≥10MB）：占位 + 打开所在文件夹/下载（只在 text/code/markdown 整读分支强制执行——useArtifactText:216；图/视/音/PDF 走流式加载不检查，注释说明理由）

## 质量门
- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过（136 文件）
- [x] `npm test` 通过（45 文件 / 634 用例，含 workspace-file-tree 22 用例）
- [x] 新增依赖已安装且构建通过（monaco-editor 0.56.0/react-pdf 10.5.0/pdfjs-dist 6.3.289/docx-preview 0.4.0/@fortune-sheet/react 1.0.4/pptx-preview 1.0.7）
- [x] 未触碰 shared 契约 / core 业务逻辑 / daemon handler（除 preview-server MIME + main/index.ts CSP connect-src）
- [ ] 手测：目录树交互、单击/双击 tab、各格式渲染、占位行为（需用户执行）
