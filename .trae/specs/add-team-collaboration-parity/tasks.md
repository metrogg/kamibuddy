# add-team-collaboration-parity Tasks

> 七项按顺序逐批复刻（spec.md 的批次顺序）。每批自带验证；跑法见文末。

## 批次 ① · 共享任务列表

- [x] 1.1 `src/core/team-tasks.ts`：TeamTaskBoard 纯逻辑（三态以上 + owner + blockedBy，
      依赖只能指向已存在的任务 → 天然无环；上游完成自动解锁、上游取消级联取消）
- [x] 1.2 返回值一律**快照**（测试抓到的一类静默 bug：交出板内引用会被后续状态迁移隔空改写）
- [x] 1.3 `src/extensions/team-task-tools.ts`：team_task_create / team_task_update /
      team_task_list（含模型体验契约三段）
- [x] 1.4 daemon 接线（按领导 sessionId 取板）+ 解散时清板
- [x] 1.5 craft 白名单 + permission 只读声明（三档放行）
- [x] 1.6 单测：`core/team-tasks.test.ts`（17）+ `extensions/team-task-tools.test.ts`（8）
- [x] 1.7 依赖方向修正：任务板从 daemon/ 移到 core/（extensions 不许 import daemon，
      门禁实测抓到的违规）

## 批次 ② · 单成员优雅关闭

- [x] 2.1 `team-runtime.ts`：成员状态机加 `closing`（收尾中，仍是活动态）
- [x] 2.2 `closed` 成员在 `resolveMemberSessions` 里**响亮拒绝**（宿主已 dispose，再投消息会撞内部错）
- [x] 2.3 `team-tools.ts`：新增 `team_shutdown { to, reason?, force? }`（五件套 → 六件套）
- [x] 2.4 daemon：默认投收尾请求（交回报告后 onComplete 翻 closed + dispose 宿主）；
      `force` 走 abort 兜底；`@all` 拒绝并指向 team_delete
- [x] 2.5 投影映射：closing → running（UI 不该显示成已完成）
- [x] 2.6 单测：注册表 2 条（closed 拒绝 / closing 仍可收）+ 工具 3 条

## 批次 ③ · 委派模式

- [x] 3.1 `session-host.ts`：`delegateMode` 字段 + `setDelegateMode` + 工具面取交集
      （`DELEGATE_MODE_TOOLS` 白名单：协调/沟通/交付类，执行类全摘）
- [x] 3.2 `SessionState.delegateMode`（缺省不占字段）
- [x] 3.3 `team-tools.ts`：新增 `team_delegate_mode { enabled, reason? }`（六件套 → 七件套）
- [x] 3.4 daemon：延迟取宿主（工具在宿主构造期注册，不能固化 `bucket.hostPromise`）
- [x] 3.5 单测：session-host 4 条（收窄 / 恢复 / 与 extraTools 正交 / 状态字段）+ 工具 1 条

## 批次 ④ · 成员计划审批

- [x] 4.1 `team-runtime.ts`：TeamMember 加 `planStatus` / `planFeedback`；
      `TeamPlanDecision`（动作）与 `TeamPlanStatus`（结果）**分成两个类型**
      —— 合成一个会让 `("approved")` 这种"结果当命令"编译期合法（实测被类型检查抓到）
- [x] 4.2 `reviewPlan`：驳回必须给 feedback（没有反馈的驳回 = 让成员重猜）
- [x] 4.3 `team-tools.ts`：新增 `team_plan_review { member, decision, feedback? }`；
      `team_status` 展示计划状态
- [x] 4.4 daemon：裁决后**自动 team_send**（批准 → 开工；驳回 → 带反馈重交）
- [x] 4.5 单测：注册表 3 条 + 工具 2 条
- [x] 4.6 **设计修订**（写进 spec 文件头）：成员侧不建 `plan_submit` 工具 —— 我们的成员
      是 fire-and-forget，没有「阻塞等批」状态；它这一轮的产出天然就是提交物

## 批次 ⑤ · 团队与信箱落盘

- [x] 5.1 `src/core/team-store.ts`：`<configDir>/teams/<团队名>/config.json`
      （团队结构 + 任务板一份装），**团队名做路径安全校验**（防 `../` 穿越）
- [x] 5.2 `restoreTeam`（成员一律按 closed 恢复，附「需重建」说明）+ 任务板 `restore`
      （nextSeq 取历史最大号 +1，防 id 撞车静默改错对象）
- [x] 5.3 daemon：`persistTeam`（挂在 emitTeamProgress + 任务板写操作后；
      指纹比对「没变就不写」）、解散时删目录、`restoreTeamsFromDisk()` 挂 start()
- [x] 5.4 单测：`core/team-store.test.ts`（9：往返 / 多团队 / 覆盖 / 路径穿越 / 版本 / 坏 JSON）
      + 任务板恢复 3 条
- [x] 5.5 **否决信箱落盘**（写进 spec 与模块头）：成员宿主不可恢复，落盘的消息没有可达
      收件人；成员产出已作为消息进领导会话 JSONL，本来就落盘了

## 批次 ⑥ · 成员级模型选择

- [x] 6.1 `member-runner.ts`：模型解析链（成员显式 → agent.model → 领导模型），
      前两级不可用**响亮报错**（静默回落会把「便宜模型」的意图变成主模型费率）
- [x] 6.2 `MemberHandle.modelKey` 回传实际使用的模型；注册表 `recordMemberModel` 回填
- [x] 6.3 `team_create` 的 `members[].model` + `team_status` 显示模型
- [x] 6.4 单测：成员级 model 透传（缺省不带该键）+ team_status 显示

## 批次 ⑦ · 成员权限请求带归属标注

- [x] 7.1 `PermissionRequest` 加 `fromMember` / `fromTeam`（shared/ipc.ts）
- [x] 7.2 daemon 的 `requestApproval` 按 sessionId 反查团队注册表注入归属
      （主会话 / 子代理 / 定时任务不带字段，行为不变）
- [x] 7.3 `member-runner` 把成员自己的 sessionId 传给审批通道（宿主建成前为空串）
- [x] 7.4 `permission-dialog.tsx` 头部显示「来自成员「X」」，复用既有 muted 小字样式
      （零新视觉值，check:tokens 通过）

## 验证

- [x] v.1 `npm run typecheck` ✓
- [x] v.2 `check:deps` ✓（含一次真实违规被拦：任务板曾放在 daemon/ 被 extensions import）
- [x] v.3 `check:tokens` ✓（真违例 0）
- [x] v.4 `check:model-experience` ✓（22 模块，新增两条工具模块契约齐全）
- [x] v.5 `check:invariants` ✓
- [x] v.6 `check:expert-assets` ✓
- [x] v.7 全量 vitest：**2752 passed / 1 failed** —— 失败项仍是
      `src/sandbox/confinement.win.test.ts「超时杀掉整棵进程树」`（既有的并发压力 flaky，
      单独复跑 9 passed；本轮未触碰 `src/sandbox/*`）
- [ ] v.8 真机验证（待用户）：开开关 → 建团 → 走一遍任务板 / 收尾成员 / 委派模式 /
      计划审批 / 重启恢复 / 成员模型 / 成员审批标注
