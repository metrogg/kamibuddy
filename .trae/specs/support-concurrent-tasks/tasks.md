# Tasks

- [ ] Task 1: 契约先行（shared 层）
  - [ ] 1.1 `shared/ipc.ts`：`SessionSummary` 加 `running: boolean`（+ 可选 `lastRunOutcome`）；`PUSH.sessionEvent` 信封加 `sessionId`；新增任务列表变更推送通道（或复用现有刷新语义改推送式——读现状选对 IPC 影响最小的）；`INVOKE.snapshot` 支持按 sessionId 拉取
  - [ ] 1.2 `shared/session-events.ts` / `conversation.ts`：事件信封类型加 sessionId（reducer 本体不感知会话，由持有方按 id 分桶）；`SessionSnapshot` 确认带 sessionId
  - [ ] 1.3 shared 层测试更新（如有契约相关用例）

- [ ] Task 2: daemon 会话注册表（主战场，Task 1 完成后启动）
  - [ ] 2.1 `hostPromise` 单例 → `Map<sessionId, SessionHost>` 注册表 + 每会话状态桶（宿主、折叠 conversation、cwd、running）；模块级"当前"状态按 spec A 拆分为会话桶与全局设置
  - [ ] 2.2 按会话互斥链（同会话写操作串行、跨会话并行）；resume 先查注册表（同文件双写禁区不变式）
  - [ ] 2.3 切换语义翻转：newTask/resumeSession/applyWorkspace 移除 streaming 拒绝守卫，旧宿主后台保活；applyWorkspace = 新任务默认 cwd 来源
  - [ ] 2.4 事件打 sessionId + 每会话折叠 ConversationView（snapshot 按 id 返回）；run 开始/结束推任务列表更新（SessionSummary.running）
  - [ ] 2.5 空闲宿主 LRU 回收（默认保 5 个空闲；运行中/审批待答豁免；回收=dispose，JSONL 历史不丢）
  - [ ] 2.6 扩展工厂闭包 getter 改读所属会话状态桶（prompt-switch/present-files/权限门）
  - [ ] 2.7 `PreviewServer` 按 cwd 多实例（懒建端口映射）；observability 注释声明进程级口径
  - [ ] 2.8 daemon 侧测试：注册表/互斥/回收/同文件单写者（自动化双宿主路径 automation-runner 回归不破）

- [ ] Task 3: renderer 多视图与任务状态（Task 1 完成后可与 Task 2 并行）
  - [ ] 3.1 App.tsx：`Map<sessionId, ConversationView>` 缓存 + 当前指针；事件按 sessionId 路由折叠；切会话换指针不丢现场（snapshot 兜底路径保留）
  - [ ] 3.2 侧栏：运行中转圈（SessionSummary.running 替代本地推导）、后台完成未读标记（查看即清）
  - [ ] 3.3 后台任务完成 toast（「<标题> 已完成」，点击可跳——若 toast 体系不支持点击则只文案）
  - [ ] 3.4 previewBaseUrl 按当前会话 cwd 取（对接 2.7 的端口查询契约）

- [ ] Task 4: 回归验证
  - [ ] 4.1 `npm run typecheck && npm run check:deps && npm test` 全绿；`npm run smoke:session` 与 `npm run smoke:permission` 通过
  - [ ] 4.2 冒烟（用户重启后）：A 跑长任务时新建 B 并对话；切回 A 现场完整；侧栏 A/B 状态正确；A 完成后未读+toast；空闲超 5 个宿主后最旧空闲宿主被回收且可重开

# Task Dependencies

- Task 2、Task 3 依赖 Task 1（契约先行）；Task 2 与 Task 3 契约冻结后可并行（daemon vs renderer 文件不交叉；3.4 依赖 2.7 的契约形状，Task 1 里先钉）
- Task 4 依赖 Task 1-3 全部完成
