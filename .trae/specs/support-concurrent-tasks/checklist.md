# Checklist

- [ ] daemon 会话注册表：`Map<sessionId, SessionHost>`，同一 session 文件任意时刻最多一个活宿主（resume 先查表，有测试）
- [ ] A 在 streaming 时新建/切换任务不再被拒绝；旧宿主后台继续推进（newTask/resumeSession/applyWorkspace 三入口守卫已翻转）
- [ ] applyWorkspace 语义为「新建任务默认 cwd 来源」，不作废旧会话（注释与测试）
- [ ] 所有会话事件信封带 sessionId；renderer 按 id 分桶折叠，后台事件不污染当前视图（有测试或联调证据）
- [ ] 切回运行中任务：流式现场完整（Map 缓存），不必整体重拉；snapshot 兜底路径仍可用
- [ ] SessionSummary.running 由 daemon 推送更新（run 开始/结束）；侧栏运行中转圈、后台完成未读标记查看即清、完成 toast
- [ ] 空闲宿主 LRU 回收：保 5 个空闲，运行中/审批待答豁免；回收的会话可从列表重开且历史完整（有测试）
- [ ] 扩展闭包 getter 读所属会话状态桶：两个并发会话各自的模式/权限/cwd 不张冠李戴（有测试或双宿主联调证据）
- [ ] PreviewServer 按 cwd 多实例：两个不同 cwd 会话的产物预览同时可开（有测试）
- [ ] 按会话互斥：同会话 prompt/abort 连打串行生效（有测试）
- [ ] `npm run typecheck && npm run check:deps && npm test` 全绿；`smoke:session`、`smoke:permission` 通过
- [ ] 冒烟（用户重启后）：双任务并发、切回现场、侧栏状态、完成通知、LRU 回收均正常
