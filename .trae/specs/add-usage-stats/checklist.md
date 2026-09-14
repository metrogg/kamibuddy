# Checklist

- [x] `UsageStats` 契约与 WorkBuddy `StatsResult` 公开字段一一对应（totalSessions / totalMessages / totalTokens / totalCost / streakDays / heatmap / modelUsage / toolUsage），差异处有注释
- [x] 子代理会话（含 `subagent_run` custom 条目）不计入会话数/消息数/热力图/工具统计/连续天数
- [x] 子代理会话的 token 用量与费用照常计入模型明细与总量（真实花费不漏账）
- [x] 无可识别模型的 legacy 会话整体跳过，不污染模型明细
- [x] 坏行 / 非 JSONL / 不可读文件跳过，其余会话照常出数，且有 event-log 留痕
- [x] 连续活跃天数：当前连续从今天往回数（今天无活动 = 0），最长连续按相邻 1 天判定
- [x] 热力图网格：`weeks = clamp(width-8, 10, 52)`、7 行周日起、首列对齐到周、未来格不着色
- [x] 等级 4 档边界正确（0 / ≤.25 / ≤.5 / ≤.75 / else），等级是相对全局最大值的量
- [x] 模型明细的 token 合计与总 token 对得上（逐条 usage 相加，无重复计数）
- [x] 工具调用的失败数按 toolCallId 配对 toolResult 的 isError 判定
- [x] 统计页：概览 / 热力图（含「少 → 多」图例）/ 每日 token / 模型明细 / 工具排行五块齐全
- [x] 零历史显示空态文案，不渲染空白网格
- [x] 刷新跟随会话事件（delta 类事件不触发重拉）
- [x] 页面只 import `@shared`；`npm run check:deps` 通过（248 文件扫描通过）
- [x] 数据源只读：不写会话文件、不动台账
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿；`electron-vite build` 通过
- [x] 对齐清单 L16 行 + 可观测性清单 VIEW9 行更新
