# Tasks

## 波一 · 问卷全链路（单代理：shared/daemon/extensions 连锁改动）

- [ ] Task 1: questionnaire 工具 + 通道 + 权限与白名单
  - [ ] 1.1 `src/shared/ipc.ts`：PUSH.questionnaireRequest（id + questions 数组，
    QuestionnaireQuestion={question, options[]}）与 INVOKE.questionnaireResponse
    （id + skipped + answers[{question, answer}]），类型集中；bridge.ts 同步
  - [ ] 1.2 `src/desktop/preload/index.ts`：按既有审批通道模式透传
  - [ ] 1.3 `src/extensions/questionnaire-tool.ts`（新）：注册 questionnaire 工具
    （1-4 问、每问 2-6 选项校验；execute 调注入的 requestAnswers 回调阻塞等答；
    跳过/作答的返回文案自创——跳过时明确「按现有信息继续，不要追问」）；
    工厂签名带 `unattended` 变体（无人值守直接返回不可用文案）
  - [ ] 1.4 `src/daemon/index.ts`：questionnaire pending Map + PUSH/INVOKE 接线
    （参照 PermissionRequest 的挂起/应答/关闭拒绝路径）；用户会话与 run 会话
    装配分别注入真实/无人值守回调
  - [ ] 1.5 `src/extensions/permission-policy.ts`：questionnaire 登记放行
    （不触文件系统，与 web_search 同档）；powershell 登记 read-only 拒 /
    balanced 高风险询问 / danger-full-access 放行；补测试
  - [ ] 1.6 `resources/modes/{craft,ask,plan}.md`：白名单加 questionnaire；
    craft 另加 powershell；工具卡标题映射（找到现映射处）加「向用户提问」
  - [ ] 1.7 验证：`npm run typecheck && npm run check:deps && npx vitest run src/extensions src/daemon src/shared`

## 波二 · 并行（契约已锁定；renderer 与 extensions 文件零交集）

- [x] Task 2: 问卷弹层 + 侧栏 badge（renderer）
  - [x] 2.1 新增 `src/renderer/questionnaire-dialog.tsx`：阻塞弹层（与 PermissionDialog
    同族样式档）；每问选项单选 + 固定「其他…」输入（选中其他时可填）；
    「跳过」整卡；「提交」在所有问题都有答案后可点；IME 守卫接入
  - [x] 2.2 `App.tsx`：问卷队列 state + PUSH 订阅 + 提交/跳过回调；
    与审批队列并存时一次显示一个（审批优先）
  - [x] 2.3 侧栏「待确认」：现状无审批 badge 驱动——App 层合成
    `pendingConfirm = approvals + questionnaires > 0`，当前会话行 amber chip
  - [x] 2.4 `index.css`：问卷卡样式（复用弹层/选项变量档位）
  - [x] 2.5 验证：`npm run typecheck && npm run check:deps && npx vitest run src/renderer`

- [x] Task 3: command-guard + powershell 工具（extensions）
  - [x] 3.1 新增 `src/extensions/command-guard.ts` 纯函数 + 54 用例：五类拦截
    （凭据访问/下载执行/动态执行/递归强删/系统破坏），凭据清单派生自
    permission-policy 的 defaultProtectedDirs（同源不另写）
  - [x] 3.2 新增 `src/extensions/powershell-tool.ts`：spawn -NoProfile -NonInteractive；
    24k 截断（沿用 web-fetch/doc-extract 同口径）；默认 120s 上限 600s；
    非 Windows 响亮报错；guard 命中结果形式返回；unattended 一律拒
  - [x] 3.3 run 会话装配注入 unattended 变体（automation-runner.ts）
  - [x] 3.4 验证：`npm run typecheck && npm run check:deps && npx vitest run src/extensions && npm run smoke:permission`

## 收尾

- [x] Task 4: 全量验证 + 文档
  - [x] 4.1 `npm run typecheck && npm run check:deps && npm test` 全绿（927 用例 + smoke 10/10）
  - [x] 4.2 `docs/STATUS.md`：专节（问卷 + powershell：机制、检查器边界、无人值守语义）
    +「等你验证」冒烟项（第 15 项）

# Task Dependencies

- Task 2 依赖 Task 1 的 IPC 契约（Task 1 完成后开始）
- Task 3 与 Task 1 共享 permission-policy.ts / craft.md / daemon 装配点：
  Task 3 在 Task 1 完成后开始（与 Task 2 并行，文件零交集）
- Task 4 依赖全部前置任务
