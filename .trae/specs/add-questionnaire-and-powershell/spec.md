# 问卷工具 + PowerShell 工具（含危险命令检查器）Spec

## Why

WorkBuddy 改简历场景揭示的两个核心缺口：① 模型动手前能发起**结构化问卷**确认关键信息
（选项+其他补充+跳过，侧栏亮「待确认」）——这是办公场景「改对方向」的关键交互，
pi 官方 plan-mode 示例同样把 questionnaire 列为标配；② 没有 shell 能力，
文档生成/环境类任务无从落地——AGENTS.md §2 已决策启用 powershell，
前置条件「危险命令检查器」必须先落地。

## What Changes

1. **questionnaire 工具（全链路，复用审批骨架）**：
   - `extensions/questionnaire-tool.ts`：注册 `questionnaire` 工具（阻塞等答）。
     入参 `questions: [{ question, options[2..6] }]`（1-4 问）；
     每问固定带「其他…」自由输入（WorkBuddy 同款，不需要开关）；整卡可「跳过」
   - 通道与权限审批同构：`PUSH.questionnaireRequest` ↔ `INVOKE.questionnaireResponse`
     （shared/ipc.ts 集中类型）；daemon 挂起 Map（多并发排队，与审批队列同语义）
   - renderer：`QuestionnaireDialog`（与 PermissionDialog 同族的阻塞弹层，一个个答）；
     侧栏「待确认」复用现有「等待审批」amber badge 机制（审批或问卷 pending 都亮）
   - 工具卡走标准工具调用翻译（标题「向用户提问」，等待中/已回答/已跳过三态）
   - 结果回传：作答 → JSON 问答对；跳过 → 明确文案「按现有信息继续，不要追问」
   - 三模式白名单都加（plan 模式尤其需要）；权限门登记为放行（不触文件系统）
   - 无人值守 run 会话：工具直接返回「无人值守不支持提问」文案，不阻塞调度器
2. **powershell 工具 + 危险命令检查器**：
   - `extensions/command-guard.ts` 纯函数：静态检查命令文本 → 拦截类别
     （AGENTS.md 点名）：动态执行（iex/Invoke-Expression/Add-Type/-EncodedCommand 族）、
     下载执行（DownloadString/DownloadFile/curl|iex 管道路径）、
     递归强制删除（Remove-Item -Recurse -Force 等，尤其根级/家目录/凭据目录路径）、
     凭据目录访问（.ssh/.aws/auth.json 等，与权限门凭据清单同源）、
     系统破坏（shutdown/format/reg delete/Set-ExecutionPolicy 等）；
     命中返回可读原因（给模型改法），非命中放行。**检查器是 best-effort 静态分析，
     不是沙箱**——注释写明边界
   - `extensions/powershell-tool.ts`：注册 `powershell` 工具（craft 模式白名单），
     spawn `powershell.exe -NoProfile -NonInteractive`，stdout/stderr 捕获 + 大输出截断
     （沿用项目截断约定）、超时（默认 120s 上限 600s）、非 Windows 响亮报错；
     命令先过 command-guard，命中即拒（工具结果形式返回原因）
   - 权限门登记：read-only 拒、balanced 询问（高风险档）、danger-full-access 放行；
     无人值守 run 会话中 powershell **一律不可用**（无论权限档，工具层直接拒）

**明确不做**：问卷分页（WorkBuddy 的 1/2 多问分页——平铺即可）、
问卷结果持久化到会话文件（工具结果自然进会话历史，已可溯源）、
bash/cmd 双 shell、命令白名单模式（从紧是黑+门，不做）。

## Impact

- Affected specs：补全改简历场景缺口；与 add-automation-scheduler 的 unattended 语义衔接
- Affected code：
  - 问卷：`src/extensions/questionnaire-tool.ts`（新）、`src/shared/ipc.ts`、
    `src/shared/bridge.ts`、`src/desktop/preload/index.ts`、`src/daemon/index.ts`、
    `src/renderer/questionnaire-dialog.tsx`（新）、`App.tsx`、`sidebar.tsx`（badge）、
    工具卡标题映射处（session-host 或 shared/tool-cards，子代理核实现状）、
    `resources/modes/{craft,ask,plan}.md`、`src/extensions/permission-policy.ts`、
    `index.css`
  - shell：`src/extensions/command-guard.ts`（新 + 测试）、
    `src/extensions/powershell-tool.ts`（新）、`permission-policy.ts`、`craft.md`

## ADDED Requirements

### Requirement: questionnaire 工具

系统 SHALL 提供 `questionnaire` 工具：模型可提交 1-4 个结构化问题（每问 2-6 个选项），
工具阻塞等待用户作答；renderer 弹问卷卡（每问选项单选 + 固定「其他…」自由输入 +
整卡「跳过」），作答或跳过经 IPC 回传后工具返回对应文本（跳过文案要求模型
按现有信息继续、不追问）。审批或问卷 pending 时侧栏会话亮「待确认」amber badge。
无人值守 run 会话中该工具 SHALL 直接返回不可用文案（不阻塞调度器）。
权限门 SHALL 放行该工具（不触文件系统，与 web_search 同档）。

#### Scenario: 动手前确认方向
- **WHEN** 模型（craft 模式）调用 questionnaire 问「简历投什么方向」+ 4 个选项
- **THEN** 用户看到问卷卡选择（或选「其他…」输入自由文本），答案作为工具结果
  回到模型；过程中侧栏亮「待确认」；消息流留下「向用户提问」工具卡

### Requirement: powershell 工具与危险命令检查器

系统 SHALL 提供 `powershell` 工具（craft 模式）：执行单条 PowerShell 命令并返回
stdout/stderr（截断超限输出），默认 120s 超时（可调、上限 600s），非 Windows 响亮报错。
所有命令 SHALL 先过 command-guard 静态检查：命中拦截类别时拒绝执行并把可读原因
作为工具结果返回（含改法指引）。权限门：read-only 拒、balanced 高风险询问、
danger-full-access 放行；无人值守 run 会话中一律不可用。

#### Scenario: 危险命令拦截
- **WHEN** 模型提交 `Invoke-Expression (Invoke-WebRequest "...").Content` 或
  `Remove-Item -Recurse -Force C:\` 
- **THEN** 命令不执行，工具结果说明拦截类别与原因

#### Scenario: 正常命令通过
- **WHEN** 模型提交 `Get-ChildItem src -Filter *.ts | Measure-Object`
- **THEN** 正常执行并返回输出；balanced 权限下先弹一次高风险询问（可记住）

## MODIFIED Requirements

### Requirement: 三模式工具白名单

**原**：craft/ask/plan 白名单如现状。**新**：三者均加 `questionnaire`；
craft 另加 `powershell`（ask/plan 只读模式不加 shell）。

## REMOVED Requirements

无。
