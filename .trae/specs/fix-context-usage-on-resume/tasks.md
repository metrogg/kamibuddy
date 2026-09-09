# Tasks

- [x] Task 1: daemon resumeSession 派生 usageDetail
  - [x] 1.1 读 `src/daemon/index.ts` 的 `resumeSession`（约 787-853 行）与 `emitContextUsageDetail`（约 364-377 行），理解现有派生调用形态（estimateComposition 入参：conversation.entries + lastSystemPromptTokens）
  - [x] 1.2 在 :844 重建 entries 之后：不再 `usageDetail: undefined`（turn / cancelledTurns 保留清空），改为当 `host.state.contextUsage` 存在时用 `estimateComposition(rebuilt, lastSystemPromptTokens)` 派生 usageDetail 写入 conversation；contextUsage 缺失（pi tokens: null 空窗）时维持 undefined（圆环隐藏）
    - 落地：派生逻辑抽为纯函数 `deriveContextUsageDetail`（新文件 src/daemon/context-usage-detail.ts），正常路径与 resume 路径共用同一组装口径
  - [x] 1.3 补发一次 `context_usage` 事件（复用 emitContextUsageDetail 或等效逻辑），让 renderer 无需等 resyncSnapshot 即可更新；确认该派生使用的 entries 是 rebuilt（不是旧会话的），必要时把 createHost 早发的那次 session_state 触发的旧数据派生与新派生的先后顺序理清（后者必须覆盖前者）
    - 时序已核验：重建（同步赋值）→ 补发（读闭包 conversation，已是 rebuilt）→ reducer 后发者胜出 + resyncSnapshot 双保险
  - [x] 1.4 注释写清「为什么」：这里曾是清空（旧会话瞬态语义），usageDetail 属于当前上下文状态、resume 后应重新派生；以及必须在 entries 重建之后派生的时序原因
- [x] Task 2: 测试与验证
  - [x] 2.1 为 resumeSession 的 usageDetail 行为补测试（看 daemon/index.ts 现有测试怎么组织；若无直接测试文件，按项目现有 mock 手法在合适位置补）：恢复普通会话 → usageDetail 非空且成分来自重建 entries；恢复「压缩后无响应」会话（contextUsage 缺失）→ usageDetail 为 undefined；恢复后 turn/cancelledTurns 仍被清空
    - 落地：daemon/index.ts import 即触发 parentPort 校验等副作用、测不了编排层；护栏等价为纯函数 deriveContextUsageDetail 的 3 用例（src/daemon/context-usage-detail.test.ts），turn/cancelledTurns 清空为字面量行为靠代码审读确认
  - [x] 2.2 `npm run typecheck && npm run check:deps && npm test` 全绿（36 文件 / 519 用例）
  - [ ] 2.3 手测（用户执行）：新建任务对话产生圆环 → 切到历史会话 → 圆环立即显示且数值对应被恢复会话 → 在恢复会话中再发消息 → 圆环正常刷新

# Task Dependencies
- Task 2 依赖 Task 1
