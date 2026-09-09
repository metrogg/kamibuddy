# Checklist

## 左侧边栏
- [x] 启动进入首页：左侧边栏显示（任务列表、空间分组、用户区）（App.tsx:621 `sidebarOpen` 无视图条件 + :303 初始值 true）
- [x] 进入 chat 视图：左侧边栏保持显示（开合状态跨视图保留，state 在 App 层）
- [x] 左上角开关收起/展开左侧栏；收起时开关仍可见可点（App.tsx:725-734 在 Sidebar 条件块外）
- [x] sidebarOpen 初始值为 true（默认展开）

## 右侧预览面板
- [x] 首页：无右侧面板、无右上角开关，主内容区全宽（App.tsx:701/742 均 `view === "chat"`）
- [x] chat 视图：右侧面板存在（默认展开），右上角开关可开合（App.tsx:296 panelOpen=true 未动）
- [x] 面板全屏态右上角开关仍可点（z-index 40 > 全屏面板 30，index.css:806/821 vs :1899）
- [x] panelOpen 默认值未被改动（保持 true，App.tsx:296）

## 质量门
- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过（119 文件）
- [x] `npm test` 通过（42 文件 / 582 用例）
- [x] 纯 renderer 改动：未触碰 shared 契约 / core / daemon / documents
- [ ] 手测（用户执行）：首页左栏常驻无右面板 → 左上角开关 → chat 右侧面板 + 右上角开关原位 → 全屏态可退出
