# Checklist

- [x] todo_write 工具注册名/参数契约与 spec 一致（todos 全量替换，content/activeForm/status 三字段，status 三态）
- [x] 工具描述与守则覆盖 WorkBuddy 四条语义（<3 步不用、恰好一个 in_progress、完成立即标记、收尾 todos:[]）
- [x] craft 与 expert 白名单含 todo_write；plan 模式不含；worker 等子代理白名单不含
- [x] ToolCard.todos 在终态卡片与历史恢复重建两条路径都被填充
- [x] todo_write 参数生成期即上屏，生成期显示「接收中…」占位（不解析半截 JSON）
- [x] 聚合投影：多次 todo_write 调用只渲染一张卡，内容为最新全量，位置在首次出现处
- [x] 切换/恢复历史会话后清单卡仍正确渲染（无额外持久化）
- [x] 三态渲染对齐 WorkBuddy：completed 对勾+删除线+灰化、in_progress 绿 spinner+加粗+activeForm、pending 空心圆
- [x] 超过 5 条窗口化：以 in_progress 为锚居中；无 in_progress 以最后 completed 为锚
- [x] 卡片头「任务列表」+ 剪贴板图标 + 展开箭头；是最新内容时默认展开
- [x] 展开盒样式：max-height 300px、灰底圆角、内部细滚动条
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿
- [x] 对齐清单 L6 行更新为已对齐并写明 v1 缺口
