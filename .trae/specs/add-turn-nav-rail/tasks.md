# Tasks

- [x] Task 1: 刻度轨组件 + chat-view 接入（单代理，纯 renderer）
  - [x] 1.1 新增 `src/renderer/turn-rail.ts` 纯函数：
    `computeTicks(measurements, scrollHeight)`（ratio 钳 [0,1]）；`nearestActiveTick(ticks, scrollRatio)`
    （scrollTop 之上最近的刻度 id，全在下方时取第一个）；补 vitest（11 例）
  - [x] 1.2 新增 `src/renderer/turn-rail.tsx`：props = entries + scrollRef；
    user 条目 ≥2 才渲染；测量经 getBoundingClientRect 差值 + scrollTop（与定位上下文无关，
    不踩 offsetParent 坑）；重算 = useLayoutEffect(entries) + ResizeObserver；
    点击 scrollIntoView 平滑块顶；自挂 scroll 监听（rAF 节流）算 activeId 高亮
  - [x] 1.3 chat-view.tsx：UserBubble 根 div 加 `data-entry-id`（user 消息锚点）；
    挂点修正为 `.stream-wrap`（.stream 是滚动容器，内部 absolute 会随内容滚走且
    挂载动画 transform 期间成包含块——stream-wrap 是代码库自文档化的视口锚）
  - [x] 1.4 index.css：.turn-rail/.turn-rail-tick（全用 --text-dim/--text/--ok，
    刻度落在 .stream 24px 左 padding 区内，不动既有布局）
  - [x] 1.5 验证：`npm run check:deps && npx vitest run src/renderer`（120 例全绿；
    typecheck 的 2 个错误在另一边在途文件 App.tsx/session-groups.test.ts，与本改动无关，
    stash 对照已证实本改动文件零错误）

- [x] Task 2: 收尾
  - [x] 2.1 `npm run check:deps && npm test` 全绿（791 用例）；typecheck 待另一边
    在途文件（App.tsx/session-groups.test.ts）落地后复跑——本 spec 文件零错误
  - [x] 2.2 `docs/STATUS.md`：专节（刻度轨）+「等你验证」冒烟项（第 14 项）

# Task Dependencies

- Task 2 依赖 Task 1
