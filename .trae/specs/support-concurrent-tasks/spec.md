# 多任务并发（会话注册表 + 后台保活 + 任务状态可见）Spec

## Why

当前 KamiBuddy 同一时间只能跑一个任务：新建/切换任务时若旧任务还在 streaming 直接拒绝
（"任务进行中，请先停止当前任务"）。调研证实（2026-09-09 两路调研）：
pi 对多 AgentSession 并发无实质障碍（automation-runner 已在生产跑双宿主）；
WorkBuddy 的成熟模型是「运行不设硬上限、空闲 LRU 回收、切走照跑、完成通知」。
单任务假设全在 KamiBuddy 侧（daemon 单宿主、事件无会话维度、视图单份、预览单根）。

## What Changes

**A. daemon 会话注册表（核心架构）**
- `hostPromise` 单例 → `Map<sessionId, SessionHost>` 注册表；
  同一 session 文件永远最多一个活宿主（同文件双写禁区）
- 模块级"当前会话"状态（conversation / cwd / activeModel 等）按语义拆分为
  **会话状态桶**（per-session：宿主、折叠历史、cwd、运行态）与
  **全局设置**（模型选择、权限档位——改动对后续所有会话的工具调用生效，现状语义保留）
- 扩展工厂闭包捕获的 getter（prompt-switch 的 getCurrent、present-files 的 workspaceDir、
  权限门 getSettings）改为读**所属会话**的状态桶
- 按会话互斥：同一会话的写操作（prompt/abort/resume/compact）per-session 串行链，
  不同会话互不阻塞

**B. 切换语义翻转：后台保活**
- newTask / resumeSession / applyWorkspace 的 "streaming 就拒绝" 守卫移除：
  旧宿主保留、其 run 后台继续；**applyWorkspace 语义明确为「新建任务的默认 cwd 来源」**
  （会话 cwd 终身绑定的既有模型不变，既有会话不受影响）
- 空闲宿主 LRU 回收（抄 WorkBuddy D2）：保最近 N 个空闲宿主（默认 5），
  **运行中/审批待答的宿主豁免回收**；回收 = dispose（历史在 JSONL，可再开）

**C. 事件与视图加会话维度**
- `PUSH.sessionEvent` 信封加 `sessionId`；daemon 每会话折叠一份 ConversationView
- renderer：`Map<sessionId, ConversationView>` 缓存 + 当前会话指针；
  后台会话的事件照样折叠进各自视图——**切回不丢流式现场**（不依赖整体重拉），
  snapshot 仍作为恢复/兜底路径

**D. 任务状态可见**
- `SessionSummary` 加 `running`（与可选 `lastRunOutcome`）；run 开始/结束推列表更新
  （现在只 run_finished 才刷）
- 侧栏任务行：运行中转圈（替代"单会话本地推导"的 streamingPath）；
  后台任务完成 → 未读标记（查看即清）+ 应用内 toast「任务 X 已完成」
- **BREAKING（契约）**：`PUSH.sessionEvent` 信封结构变化（加 sessionId 字段）——
  同仓库同构建，无版本兼容负担（AGENTS.md §9 不引事件 schema 版本号）

**E. PreviewServer 多根**
- 单根单例 → `Map<cwd, PreviewServer>`（每 cwd 一个端口，懒建）；
  renderer 的 previewBaseUrl 按当前会话 cwd 取
- observability 聚合口径声明为进程级（注释），不按会话分桶（YAGNI）

## Impact

- Affected specs：会话管理（home-permission-and-session-management）、
  会话隔离+playground（临时任务模型）、产物预览面板、observability（口径声明）
- Affected code：
  - `src/shared/ipc.ts`（SessionSummary.running、事件信封、任务状态推送通道）
  - `src/shared/session-events.ts` / `conversation.ts`（事件信封 sessionId；reducer 无侵入）
  - `src/daemon/index.ts`（注册表、状态桶、互斥、守卫翻转、事件路由、列表推送——主战场）
  - `src/core/session-host.ts`（构造入参调整为注入会话状态桶，本体改动小）
  - `src/core/preview-server.ts`（多根实例管理）
  - `src/renderer/App.tsx`（多视图 Map、侧栏状态、toast）、`src/renderer/sidebar.tsx`

## 范围外（明确不做）

- **消息排队 UI**（WorkBuddy D4 的 19 条可管理队列）：同会话流式中发消息沿用
  pi 内建 steer 插队（现状行为）；排队模型留待独立 spec
- **系统级通知**（Electron Notification 失焦才弹）：v1 只做应用内 toast + 侧栏未读
- 每会话一进程隔离（pi 进程内多会话已够用；崩溃隔离是另一个量级的改动）
- 同 cwd 文件冲突防护（WorkBuddy 也不防；pi file-mutation-queue 已串行化同文件写）
- prewarm 预热池（我们冷启动已快）
- 定时任务配额联动（automation 独立并发已工作，不与手动任务互挤——WorkBuddy D8 同语义）

## ADDED Requirements

### Requirement: 多任务并发运行

系统 SHALL 支持任意数量任务同时运行（不设硬上限）：新建/切换任务不中止
进行中的 run；同一会话文件任意时刻最多一个活宿主。

#### Scenario: A 在跑时新建任务 B
- **WHEN** 任务 A 正在 streaming，用户点击「新建任务」并发消息启动任务 B
- **THEN** A 不被中止（后台继续），B 正常启动；两个会话各自推进

#### Scenario: 切回运行中的任务
- **WHEN** 用户从运行中的任务 A 切到 B 再切回 A
- **THEN** A 的流式现场完整（期间产生的内容都在），run 仍在继续，可中断

#### Scenario: 空闲宿主回收
- **WHEN** 空闲宿主数超过上限（5），最久未用的空闲宿主被回收
- **THEN** 运行中/审批待答的宿主不被回收；被回收的会话可从列表重新打开（历史完整）

### Requirement: 事件会话维度

系统 SHALL 在所有会话事件信封上携带 sessionId；renderer 按 sessionId 折叠进
各自的 ConversationView 缓存，与当前查看的会话无关。

#### Scenario: 后台事件不错位
- **WHEN** 用户查看任务 B 时任务 A 的流式事件到达
- **THEN** 事件折叠进 A 的视图缓存，B 的视图不受污染；切回 A 时内容完整且最新

### Requirement: 任务状态可见

系统 SHALL 让侧栏任务行显示运行态（run 开始/结束即更新）；后台任务完成时
给未读标记与应用内 toast。

#### Scenario: 后台完成通知
- **WHEN** 用户正在任务 B 中操作，任务 A 的 run 结束
- **THEN** 侧栏 A 行出现未读标记并 toast「A 已完成」；点击 A 查看后标记清除

### Requirement: 按会话互斥

系统 SHALL 串行化同一会话的写操作（prompt/abort/resume/compact），
不同会话的操作互不阻塞。

#### Scenario: 快速连击不竞态
- **WHEN** 用户对同一会话快速连续触发 prompt 与 abort
- **THEN** 操作按到达顺序串行生效，不出现宿主状态错乱（旧 run 未停新 run 已起）

## MODIFIED Requirements

### Requirement: 工作空间切换语义

**原**：applyWorkspace 在 streaming 时拒绝；切换即作废旧会话（dispose）。
**新**：applyWorkspace 不再拒绝也不作废旧会话；它只决定**后续新建任务**的默认 cwd
（既有会话 cwd 终身绑定不变，WorkBuddy 同模型）。

### Requirement: 预览服务

**原**：PreviewServer 单例单根，setRoot 先关旧服务。
**新**：按 cwd 多实例（每 cwd 一个端口懒建）；不同 cwd 的会话预览互不影响。

## REMOVED Requirements

### Requirement: 单会话宿主

**Reason**：单任务假设是功能缺陷（用户实测不能多任务），pi 无此限制。
**Migration**：hostPromise 单例删除，会话注册表替代；同文件单写者不变式由
「注册表按 sessionId 键控 + resume 先查表」维持。
