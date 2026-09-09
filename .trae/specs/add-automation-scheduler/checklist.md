# Checklist

## 存储与调度模型

- [x] `~/.kamibuddy/automations.json` 原子写读写正常；损坏时响亮报错；runs 封顶 50 修剪
- [x] `nextRunAfter` 四类调度计算正确（once/interval/daily/weekly，本地时区），有 vitest 边界用例
- [x] interval 最小 1 分钟校验；weekly 至少一个星期校验

## 调度执行

- [x] 30s tick 到期触发；串行队列一次一个 run，同期顺延
- [x] 每次运行创建独立新会话（cwd=任务 cwd、work+craft、当前生效模型），
  run 事件不污染用户当前会话视图
- [x] run 会话文件含 `automation_run` custom 条目（taskId）
- [x] run 完成写记录 + 更新 lastRunAt/nextRunAt + PUSH renderer；30 分钟超时 abort 记失败
- [x] run 中权限询问自动拒绝，原因返回给模型；凭据目录禁读写不变
- [x] 启动恢复：once 过期标 missed 不补跑；周期任务重算 nextRunAt

## 对话内工具

- [x] craft 模式白名单含 automation_create/list/delete；ask/plan 不含
- [x] 对话中「每个工作日早上 9 点汇总昨天 git 提交」能建成 weekly 任务，
  prompt 自包含（模型回复说明生效调度）——静态证据链完整，运行表现见人工冒烟 13
- [x] craft 提示词含 self-contained 约束段（自创文案）
- [x] delete 歧义名称返回候选而非误删

## 管理页

- [x] 侧栏「定时任务」入口可打开管理页
- [x] 列表显示名称/调度摘要/下次运行/状态；新建·编辑表单可保存（cwd 默认当前工作空间）
- [x] 启停切换即时生效（paused 不触发）；运行中的任务拒绝删除并提示
- [x] 手动运行走串行队列；任务行展开运行记录，点击打开对应会话
- [x] run 完成有 toast；run 会话在侧栏带未读标记

## 工程验证

- [x] `npm run typecheck && npm run check:deps && npm test` 全绿（764 用例 + smoke 10/10）
- [x] IPC 通道名与类型集中在 shared/ipc.ts（无两侧字面量）
- [x] 未引 rrule 等新增依赖
- [x] `docs/STATUS.md` 已更新（专节 + 等你验证冒烟项）
