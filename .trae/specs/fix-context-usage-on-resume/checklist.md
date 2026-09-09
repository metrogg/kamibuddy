# Checklist

## 根因修复
- [x] resumeSession 重建 entries 后 usageDetail 被重新派生（而非清空），成分估算输入是重建后的 entries（daemon/index.ts:892-899，派生逻辑在 context-usage-detail.ts 纯函数）
- [x] turn / cancelledTurns 仍按旧会话瞬态清空（行为不变，daemon/index.ts:904-905）
- [x] contextUsage 缺失（pi tokens: null 空窗）时圆环维持隐藏，无伪造数据（context-usage-detail.ts:32 + 测试覆盖）
- [x] 补发的 context_usage 事件在 renderer 正确折叠（旧数据若先到必须被新派生覆盖）——重建后补发、reducer 后发者胜出、resyncSnapshot 双保险，事件链已逐行核验

## 功能验证
- [x] 恢复普通历史会话 → 圆环立即显示，数值/成分对应被恢复会话（代码层核验通过；界面表现待用户手测）
- [x] 恢复「压缩后无响应」会话 → 圆环隐藏（现状语义，代码层核验通过）
- [x] 恢复后继续对话 → 圆环经正常路径（session_state → context_usage）刷新（代码层核验通过，本修复未改该路径）

## 质量门
- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过
- [x] `npm test` 通过（含新增 deriveContextUsageDetail 3 用例；resumeSession 编排层因 daemon/index.ts import 副作用不可测，护栏等价见 tasks.md 2.1 落地说明）
- [x] 未触碰 renderer / shared 契约 / documents；注释写「为什么」（本修复仅 daemon/index.ts 三处 + 两个新文件；工作区其余 diff 为并行会话 isTempTask 重构，与本修复无关）
- [ ] 手测（用户执行）：切历史会话圆环立即出现；压缩后无响应会话圆环隐藏；恢复后继续对话圆环正常刷新
