# Checklist

- [x] daemon 会话注册表：`Map<sessionId, Promise<SessionHost>>`，同一 session 文件任意时刻最多一个活宿主（键=sessionId：文件名内嵌 id 唯一即文件唯一 + resume 先查表 + resumeChainByFile 串行锁；session-registry.test.ts 13 例）
- [x] A 在 streaming 时新建/切换任务不再被拒绝；旧宿主后台继续推进（newTask/resumeSession/applyWorkspace 三入口守卫已翻转）
- [x] applyWorkspace 语义为「新建任务默认 cwd 来源」（defaultWorkspaceDir），不作废旧会话
- [x] 所有会话事件信封带 sessionId；renderer 按 id 分桶折叠（viewCacheRef），后台事件折叠零重渲染、不污染当前视图
- [x] 切回运行中任务：流式现场完整（桶缓存 stash/restore），不依赖整体重拉；snapshot(sessionId) 兜底路径保留（桶缺失/目录字段缺时）
- [x] SessionSummary.running 由 daemon 推送更新（PUSH.taskListChanged 全量，run 边界 + 增删改/rename 都推）；侧栏运行中转圈（替代 streamingPath 本地推导）、后台完成未读标记（running true→false 翻转检测）查看即清、完成 toast（toast 体系无点击能力，只文案）
- [x] 空闲宿主 LRU 回收：保 5 个空闲（MAX_IDLE_HOSTS），豁免 running/审批待答/链上有活/当前/pristine；回收的会话可从列表重开且历史完整（有测试）
- [x] 扩展闭包 getter 读所属会话状态桶：prompt-switch/present-files/权限门建宿主时注入桶（模型与权限档仍全局），并发会话模式/cwd 不张冠李戴
- [x] PreviewServer 按 cwd 多实例：PreviewServers 池（Map<cwd, server>，并发 ensure 共享启动 promise），previewBaseUrl(cwd) 只查不启（池 4 例测试）
- [x] 按会话互斥：enqueue(bucket, op) 同桶串行、跨桶并行、失败不毒链（测试）；abort 不进链（信号非写操作）
- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（784 个测试，独立复跑确认）；`smoke:session` 14/14、`smoke:permission` 10/10 通过
- [ ] 冒烟（用户重启后）：双任务并发、切回现场、侧栏状态、完成通知、LRU 回收均正常
