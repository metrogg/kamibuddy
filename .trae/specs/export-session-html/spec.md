# 会话导出 HTML（溯源证据闭环）Spec

## Why

溯源三层证据链（会话 JSONL / 事件日志 / 诊断页）都已落盘，但**人读不了**：
会话 JSONL 是机器格式，排查 agent 问题时无法直接查看、更没法发给同事一起分析。
pi 自带 `AgentSession.exportToHtml()`（自含主题与工具渲染的单文件 HTML），
接上它即完成「出问题 → 导出证据」的闭环，且顺带消解「事件日志 delta 只记长度」
的阅读缺口（导出的就是全文）。

## What Changes

- **会话导出为 HTML**：侧栏任务行新增「导出」操作——当前会话直接调
  `session.exportToHtml()`；历史会话先恢复（复用已有 resume 流程，含全部守卫）
  再导出。输出落 `~/KamiBuddy/exports/<标题>-<时间戳>.html`，成功后 toast 告知路径
  并自动用系统默认浏览器打开。
- **pi 边界约束（已实测，决定实现形状）**：`exportFromFile` / `exportSessionToHtml`
  **未从 pi 包根导出**（其 package.json exports 只暴露 `.` / `./rpc-entry` / `./client` /
  `./experimental/plugin`，深路径 import 实测 `ERR_PACKAGE_PATH_NOT_EXPORTED`）。
  所以导出必须经 `AgentSession.exportToHtml()` 实例方法——历史会话「先恢复再导出」
  不是 UX 妥协，是包根导出面下的唯一正路（深路径 import 违反「只依赖包根」纪律，
  spawn `pi --export` 违反 §4.2 SDK 决策）。

## Impact

- Affected specs: 会话管理（新增导出能力）、溯源证据链
- Affected code:
  - `src/shared/ipc.ts` + `src/shared/bridge.ts` + `src/preload/index.ts`（session:export 通道）
  - `src/core/session-host.ts`（exportHtml 包装，pi 类型止步于此）
  - `src/core/session-export.ts`（**新**：导出路径构造纯函数 + 测试）
  - `src/daemon/index.ts`（sessionExport handler：current 直导 / 非 current 先 resume 再导 / 空会话友好错误）
  - `src/renderer/sidebar.tsx`（任务行导出按钮）、`src/renderer/App.tsx`（exportTask 流）

## ADDED Requirements

### Requirement: 当前会话导出

系统 SHALL 支持一键导出当前会话为单文件 HTML：
daemon 经 SessionHost 暴露的 `exportHtml(outputPath)` 调用 pi 的 `session.exportToHtml()`。
输出目录固定为 `getWorkspaceDir()/exports/`（`~/KamiBuddy/exports/`，递归创建；
固定默认根而非当前工作区——playground 会话没有工作区，用户也总能在一个地方找到导出物）。
文件名 = 清洗后的会话标题（非法字符替换、压单行、超长截断）+ `-yyyyMMdd-HHmmss.html`。

#### Scenario: 导出并打开
- **WHEN** 用户在侧栏当前会话行点「导出」
- **THEN** `~/KamiBuddy/exports/` 生成 HTML 文件，toast 显示路径，系统默认浏览器自动打开，
  内容含完整对话（思考、工具调用与结果）

#### Scenario: 空会话友好报错
- **WHEN** 当前会话还没有任何消息（pi 尚未落盘）
- **THEN** 导出被拒并提示「该会话还没有内容可导出」（pi 的 "Nothing to export yet" 翻译为用户语言），
  不崩溃、不生成空文件

### Requirement: 历史会话导出 = 先恢复再导出

侧栏历史会话行的「导出」SHALL 复用已有 resume 流程恢复该会话（含全部守卫：
流式中拒绝、路径校验、失败原子性），恢复成功后立即导出。
**该操作有上下文切换语义**：当前工作上下文会切到被导出的会话——
按钮 title 必须写明「恢复此会话并导出 HTML」，不做无提示的隐式切换。

#### Scenario: 导出昨天的会话
- **WHEN** 用户对昨天的会话点「导出」
- **THEN** 该会话被恢复（对话页显示其内容）并完成导出；若恢复失败（流式中/路径非法），
  不导出且当前会话不受影响

### Requirement: 导出后可见

导出成功后系统 SHALL toast 告知输出路径，并经既有 `openArtifact` 通道用系统默认程序打开
（路径由 daemon 构造，非 renderer 传入——已知 openArtifact 无路径边界的问题不受影响：
本条链路不接受用户输入路径）。

#### Scenario: 找到导出物
- **WHEN** 导出完成
- **THEN** toast 显示完整路径且浏览器已打开该文件；`~/KamiBuddy/exports/` 目录累积历史导出

## MODIFIED Requirements

无（纯新增能力，不改变既有行为）。

## REMOVED Requirements

无。

## 明确不做（本变更范围外）

- **历史会话「不恢复直接导出」**：`exportFromFile` 未从 pi 包根导出（已实测），
  深路径 import 与 spawn CLI 都违反既有决策。若 pi 将来把它提为包根导出，可去掉
  「先恢复」这一步，届时只改 daemon 一处。
- **导出自定义**（主题选择、导出目录可选、导出 JSONL）：pi 的 exportToHtml 支持
  themeName 但本期不需要；`exportToJsonl` 无场景（JSONL 本体就在 sessions 目录）。
- **delta 全文双写**：随导出消解——事件日志维持只记长度（防撑爆），全文在导出的 HTML 里。
- **对话页头部导出按钮**：侧栏任务行是唯一入口，避免两处入口漂移。
