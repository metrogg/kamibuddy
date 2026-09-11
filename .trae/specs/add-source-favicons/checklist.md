# Checklist

- [x] CSP 的 img-src 含 `https:`（dev 与 prod 两条 policy 一致，main/index.ts:155/159），
  注释写明根因与权衡；script-src/connect-src 未放开
- [x] 来源按钮头像组与 SourcesPanel 行显示真实站点图标（站点有 favicon 时），
  失败仍回退 Globe（SourceFavicon 回退逻辑未动，sources-panel.tsx:31-47）
- [x] web_search 工具卡卡头显示 favicon 头像组（pickSiteFavicons 与来源按钮共用，
  站点去重前 3）+「N 个来源」（chat-view.tsx:410-452）
- [x] 搜索卡展开区有来源行列表（.tool-source-list 在 detail 之前，行点击
  window.open 与面板同通道），点击打开链接（chat-view.tsx:467-490）
- [x] CSS 全用既有变量，无新变量、无硬编码色值（index.css:2894-2967，
  reduced-motion 已同步）
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（1340 用例）
- [x] `docs/workbuddy对齐清单.md` 已更新（L26 行含 CSP 根因说明）
