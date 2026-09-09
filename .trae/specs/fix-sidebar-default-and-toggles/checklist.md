# Checklist

## 左侧边栏行为
- [x] 启动进入首页：左侧边栏不显示（全宽引导页，App.tsx:292 sidebarOpen=false + :610 view 条件）
- [x] 新建任务回到首页：侧边栏消失（App.tsx:388-392 setView("home") 随行隐藏）
- [x] 进入 chat 视图：侧边栏默认关闭，左上角开关可展开（chat-view.tsx:890-898）
- [x] skills / settings / diagnostics 视图行为不受影响（App.tsx:606-688，各视图独立渲染无 Sidebar）

## 开关图标
- [x] 左栏开关在 chat 顶栏首位（返回按钮之前，窗口左上角，chat-view.tsx:884-901），侧边栏关闭时仍可见可点（不在 Sidebar 组件内部）
- [x] 右面板开关常驻窗口右上角：面板开合/拖拽不推移按钮（App.tsx:716-725 absolute + index.css:799-804）
- [x] 面板全屏覆盖态右上角开关仍可见可点（z-index 40 > 全屏面板 30，index.css:799-804 vs :1868-1874）
- [x] 面板关闭时按钮可打开面板（按钮在 App 层、ArtifactPanel 卸载域之外）
- [x] panelOpen 默认值未被改动（保持 true，App.tsx:286）

## 质量门
- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过
- [x] `npm test` 通过（39 文件 / 557 用例）
- [x] 纯 renderer 改动：未触碰 shared 契约 / core / daemon / documents（git diff --stat 确认仅 App.tsx / chat-view.tsx / index.css）
- [ ] 手测（用户执行）：首页无侧栏 → chat 默认关 → 左上角开侧栏 → 右上角开关原位 → 全屏态可退出
