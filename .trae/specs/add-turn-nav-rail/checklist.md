# Checklist

- [x] 每条 user 消息一个刻度，纵向位置与消息在滚动内容中的比例一致
- [x] 流式增高与窗口 resize 后刻度位置自动重算（useLayoutEffect(entries) + ResizeObserver）
- [x] 点击刻度平滑滚动到对应消息（块顶对齐）
- [x] 视口顶最近的用户消息刻度高亮，滚动时跟随（rAF 节流）
- [x] 用户消息少于 2 条时刻度轨不渲染；assistant/tool 条目不标
- [x] computeTicks / nearestActiveTick 有 vitest 用例（11 例：比例/钳位/scrollHeight=0/空列表/单刻度/边界/全在下方）
- [x] CSS 全部复用既有变量（--text-dim/--text/--ok），无新变量、无硬编码色值
- [x] `npm run check:deps && npm test` 全绿（791 用例）；typecheck 的 2 个错误全部落在
  另一边在途文件（App.tsx/session-groups.test.ts），本 spec 文件零错误（待另一边落地后复跑即可）
- [x] 未触碰 daemon/core/shared
- [x] `docs/STATUS.md` 已更新（专节 + 冒烟项第 14 项）
