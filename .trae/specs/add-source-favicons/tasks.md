# Tasks

- [x] Task 1: CSP 放行 + 搜索卡来源列表（单代理，main/renderer 小改动）
  - [x] 1.1 `src/main/index.ts` installCsp：dev/prod 两条 policy 的 img-src 加 `https:`，
    注释写明权衡与「这是 favicon 全部回退的根因」
  - [x] 1.2 chat-view.tsx ToolEntry：web_search 卡卡头 favicon 头像组（pickSiteFavicons
    抽取共用，与来源按钮同口径）+「N 个来源」（sources.length 与面板标题同口径）；
    展开区 .tool-source-list 行列表（SourceFavicon + 标题/host，点击 window.open
    与面板同通道）；expandable = hasDetail || 有 sources
  - [x] 1.3 index.css：来源行样式（16px favicon 圆角 3px 去描边、行 hover、
    reduced-motion 同步，全用既有变量）
  - [x] 1.4 验证：`npm run typecheck && npm run check:deps && npx vitest run src/renderer`

- [x] Task 2: 收尾
  - [x] 2.1 `npm run typecheck && npm run check:deps && npm test` 全绿（1340 用例）
  - [x] 2.2 `docs/workbuddy对齐清单.md` L26 行更新（CSP 根因与搜索卡来源列表）

# Task Dependencies

- Task 2 依赖 Task 1
