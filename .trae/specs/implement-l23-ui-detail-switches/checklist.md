# Checklist

- [x] `Shift+Alt+W` 全局热键：窗口未聚焦时唤起并聚焦，已聚焦时最小化（与 WorkBuddy
      `GlobalToggleShortcutController` 同机制；无托盘故用最小化而非隐藏）
      —— `main/global-shortcut.ts:40-42` 三态纯函数 + `main/index.ts:412` 接线
- [x] 热键注册失败（被占用）不炸启动，事件日志有记录，诊断页可见注册状态
      —— 控制器 :83-95 降级 + `main/index.ts:247-252` 落日志 + `diagnostics-view.tsx:188`
- [x] `will-quit` 时 `globalShortcut.unregisterAll()`，不泄漏 —— `main/index.ts:430-432`
- [x] 对话页发送消息后，该用户消息吸到视口顶部，回复在下方展开（WorkBuddy 5.5.4
      去开关化后的默认行为，我们不设开关）
      —— `send-anchor.ts:87-96` 决策表 + 三入口登记 + `.anchor-space` 组 min-height（index.css:1585）
- [x] streaming 吸底跟随与用户上翻解除跟随的既有行为不被破坏
      —— 无待吸顶时回落 `isFollowing ? stick-bottom : none`，测试钉住
- [x] 切换会话 / 恢复历史不触发吸顶 —— pending 带 sessionId 跨会话作废，测试钉住
- [x] 对齐清单 L23 行四个子项状态与理由更新准确，表头统计同步
      —— L23a🟡/b✅/c⛔/d⛔，192 条统计逐行复核一致
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（新增测试覆盖
      toggle 判定与锚定决策）—— 1068 全过（另修复并行会话遗留的 session-host
      假会话 mock 缺 `getAvailableThinkingLevels` 导致的 6 个失败，非本变更引入）
