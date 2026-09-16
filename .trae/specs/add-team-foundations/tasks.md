# add-team-foundations Tasks

> 批 1（列表过滤 + extraTools）与批 2（配置落点 + 防线参数化）为第一实施批；
> 批 3-6 各自动工前追加任务条目。

## 批 1

- [x] 1.1 listSessions 过滤 subagent_run 会话（daemon/index.ts），确认过滤点在读取层
- [x] 1.2 experts.ts：ExpertDefinition 加 extraTools 可选解析 + 单测（缺省 undefined / 声明解析 / 非法形状报错）
- [x] 1.3 daemon createHost：解析当前专家 extraTools，与 mode.tools 合并传 toolsOverride
- [x] 1.4 session-host：注入 extraTools 解析回调；setExpert 重新应用合并工具集 + 单测
- [x] 1.5 内置专家回归：未声明 extraTools 时工具集逐字节不变

## 批 2

- [x] 2.1 preferences 加 agentTeamsEnabled（默认 false）+ 读函数
- [x] 2.2 spawn 预算改注入（session-registry / daemon 装配），缺省 20
- [x] 2.3 子代理超时改注入（subagent-runner），缺省 600000ms
- [x] 2.4 相关单测：缺省口径不变

## 批 3（Mailbox 通信原语）

- [x] 3.1 `src/daemon/mailbox.ts`：SessionMailbox（deliver/broadcast/drain/clear/pendingCount，时钟与 id 可注入，空参数响亮抛错）
- [x] 3.2 mailbox.test.ts：投递/隔离/顺序/broadcast/clear/校验全路径
- [x] 3.3 daemon 接线 deliverSessionMessage（投递 → enqueue → drain 合成 → followUp prompt；目标不可达报错；sessionDelete 清信箱）

## 批 4（通用 child-agents 投影层）

- [x] 4.1 `src/shared/child-agents.ts`：契约键常量 + childAgentsOf 识别守卫（迁自 session-host）+ ChildAgentsProjection 累加器（迁自 task-tool）
- [x] 4.2 SubagentStatus 加可选 kind（缺省 subagent，task 工具不写）
- [x] 4.3 task-tool / session-host 改为消费共享模块，行为不变
- [x] 4.4 child-agents.test.ts：守卫 + 累加器全路径（含 timeline 封顶/省略标记/快照拷贝）

## 批 5（团队 v1 垂直切片）

- [x] 5.1 `src/daemon/team-runtime.ts`：TeamRegistry 状态机（单团队/重名/1-8/双向查/解散）+ 单测
- [x] 5.2 session-host 加 markTeamMemberRun；listSessions 过滤扩展 team_member 标记
- [x] 5.3 `src/daemon/member-runner.ts`：成员长会话执行器（复用子代理扩展装配，无超时，fire-and-forget，完成回投回调）
- [x] 5.4 `src/extensions/team-tools.ts`：team_create/send/status/delete 四工具 + 单测（stub 注入）
- [x] 5.5 daemon 接线：agentTeamsEnabled gate、craft.md 白名单、领导桶逐出/删除时解散团队
- [x] 5.6 resources.test.ts craft 白名单回归更新

- [x] 5.7 设置页通用分组加「智能体团队（实验）」开关（get/setAgentTeamsEnabled 全链路：ipc/bridge/preload/daemon/general-section，记忆开关模式复刻）

## 验证

- [x] v.1 `tsc --noEmit` ✓
- [x] v.2 `check:deps` ✓
- [x] v.3 `check:tokens` ✓（本批无 UI 改动，跑以防意外）
- [x] v.4 全量 vitest ✓
