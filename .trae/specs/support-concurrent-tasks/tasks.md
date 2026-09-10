# Tasks

- [x] Task 1: 契约先行（shared 层）
  - [x] 1.1 `shared/ipc.ts`：`SessionSummary` 加 `running: boolean`（lastRunOutcome 无消费方，YAGNI 略去）；`PUSH.sessionEvent` 信封加 `sessionId`；新增 `PUSH.taskListChanged` 全量推送通道；`INVOKE.snapshot` 支持按 sessionId 拉取
  - [x] 1.2 `shared/session-events.ts` / `conversation.ts`：`SessionEventEnvelope { sessionId, event }`（reducer 无侵入）；`SessionSnapshot` 以 state.sessionId 为准不加重复字段
  - [x] 1.3 shared 层测试更新（session-groups.test.ts 工厂补 running 默认值）

- [x] Task 2: daemon 会话注册表（主战场，Task 1 完成后启动）
  - [x] 2.1 `hostPromise` 单例 → `Map<sessionId, Promise<SessionHost>>` 注册表（键选 sessionId：建宿主即有真值；同文件单写者 = 文件名内嵌 id + resume 先查表 + resumeChainByFile 串行锁）+ 每会话状态桶
  - [x] 2.2 按会话互斥链（`enqueue(bucket, op)` 同桶串行、跨桶并行、失败不毒链；abort 不进链——信号不是写操作）
  - [x] 2.3 切换语义翻转：newTask/resumeSession/applyWorkspace 移除 streaming 拒绝守卫，旧宿主后台保活；applyWorkspace = defaultWorkspaceDir（新任务默认 cwd 来源）；compact/saveToWorkspace 走互斥链排队
  - [x] 2.4 事件按桶打 sessionId + 每会话折叠 ConversationView（snapshot(sessionId) 按桶返回，未注册响亮报错）；run 边界推 `PUSH.taskListChanged`
  - [x] 2.5 空闲宿主 LRU 回收（`MAX_IDLE_HOSTS=5`；豁免 running/审批待答/链上有活/当前/pristine；回收=dispose）
  - [x] 2.6 扩展工厂闭包 getter 改读所属会话状态桶（prompt-switch/present-files/权限门；模型与权限档仍全局）
  - [x] 2.7 `PreviewServers` 多根池（Map<cwd, server>，并发 ensure 共享启动 promise；previewBaseUrl 只查不启）；observability 注释声明进程级口径
  - [x] 2.8 daemon 侧测试：session-registry.ts 纯模块 13 例（互斥/回收/池）+ automation-runner 零改动回归（smoke:session 14/14）

- [x] Task 3: renderer 多视图与任务状态（Task 1 完成后可与 Task 2 并行）
  - [x] 3.1 App.tsx：`viewCacheRef: Map<sessionId, ConversationView>`（后台事件折叠进桶零重渲染，仅当前指针进 useReducer）；切走 stash/切回 restore（不依赖整体重拉，snapshot 兜底）；history_reset/删除清桶
  - [x] 3.2 侧栏：SessionSummary.running 替代本地推导；未读 = 推送里 running true→false 翻转检测（task-status.ts 纯函数 7 例），resumeTask 统一入口清除
  - [x] 3.3 后台任务完成 toast（toast 体系无点击能力 → 只文案；成功/失败分取自事件流，注释写明与未读的分工）
  - [x] 3.4 previewBaseUrl 按当前会话 cwd 取（refreshPreviewBaseUrl 挂 cwd effect，序号 ref 防乱序）

- [x] Task 4: 回归验证
  - [x] 4.1 `npm run typecheck && npm run check:deps && npm test` 全绿（784 个测试，独立复跑确认）；`npm run smoke:session` 14/14 与 `npm run smoke:permission` 10/10 通过
  - [ ] 4.2 冒烟（用户重启后）：A 跑长任务时新建 B 并对话；切回 A 现场完整；侧栏 A/B 状态正确；A 完成后未读+toast；空闲超 5 个宿主后最旧空闲宿主被回收且可重开

# Task Dependencies

- Task 2、Task 3 依赖 Task 1（契约先行）；Task 2 与 Task 3 契约冻结后可并行（daemon vs renderer 文件不交叉；3.4 依赖 2.7 的契约形状，Task 1 里先钉）
- Task 4 依赖 Task 1-3 全部完成
