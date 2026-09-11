# Tasks

- [x] Task 1: 契约与 daemon 注入。`shared/ipc.ts` 的 `QuestionnaireRequest` 与 `PermissionRequest` 增加 `sessionId: string`（注释写明：渲染层按它路由与归属 badge，daemon 是唯一注入点）；daemon/index.ts 的 questionnaire 与 permission-gate 接线闭包注入所属桶 sessionId（新增 adoptedSessionId 帮手，空 id 响亮抛错）；子代理审批传空串=全局（注释写明已知近似）；questionnaireResponse/permissionResponse 回程不变（id 键控）。扩展与 smoke 脚本契约同步，319 测试全绿。
- [x] Task 2: renderer 路由与 badge。App.tsx：问卷按 `sessionId === conversation.state.sessionId` 取可见会话最旧一张经 chat-view 新 props 下发（空串精确匹配、注释写明），其余留队列；全局问卷模态删除；answerQuestionnaire 接 chat-view 两回调；`pendingConfirm` 改为 `pendingConfirmIds: ReadonlySet<string>`（两队列 sessionId 合成、过滤空串）；sidebar.tsx badge 改 `pendingConfirmIds.has(task.id)`（可多行）；审批 PermissionDialog 维持全局模态（注释写明安全闸有意全局 + 模态天然盖住浮层无需门控）。
- [x] Task 3: 内联浮层重写（样式原样对齐 WorkBuddy v3）。questionnaire-dialog.tsx 重写为无遮罩内联浮层：header=当前题文本 + 分页器 + X；选项行 40px + 序号块 24×24（hover/选中反白）+ 行尾箭头淡入 + 1px 分隔线；「其他补充…」恒定输入行（铅笔块 + 透明 input + 双向互斥）；footer 跳过胶囊 + 32×32 圆形前进/发送按钮（仅可用态激活）；卡片 24px radius + v3 阴影 + max-height min(60vh,520px) + 上滑淡入；chat-view 挂载点（pendingQuestionnaire 有值时替换 composer）；index.css 按 v3 真值（新增 --text-faint/--shadow-questionnaire 两变量，其余全复用既有变量）。
- [x] Task 4: 验证与收尾。`npx tsc --noEmit` 0 错误、`npm run check:deps`（183 文件）、`npm test` 65 文件 1068 例全绿、smoke:session 14/14、smoke:permission 10/10；docs/workbuddy对齐清单.md C7 行更新（会话绑定 + v3 内联浮层，注明取舍：无多选题、审批仍全局模态）。人工冒烟：任务 1 发起问卷切任务 2 不弹 + badge 归属 + 切回答答后 run 继续。

# Task Dependencies

- Task 2 依赖 Task 1（契约先行）；Task 3 依赖 Task 2（数据经 App 按会话下发进 chat-view）；Task 4 最后。
- Task 1 与 Task 3 的样式部分可并行（样式不依赖契约）。
