# Checklist

> 核验日期 2026-09-17。可静态核验项已逐条通过（证据见 `tasks.md` 的 Task 1-9 实测结论段）。
> 标记 `⬜ 需真机` 的三项需要人在 Electron 界面点一遍（对应 `tasks.md` 的 Task 10），AI 无法代劳，故**不勾选**。
> 标记 `⬜ 过程性` 的一项是开发过程事实（「改界面前读过 DESIGN.md」），无法从产物反证。

## 前置实测

- [x] `scripts/probe-session-branch.ts` 覆盖 `createBranchedSession` / `branch` / `navigateTree` / `parentSession` 四项语义，跑通并留下结论注释
- [x] 会话叶子位置是否持久化有明确实测结论，且 Task 2/3 的实现与该结论一致（未持久化 → 采用母文件前缀重写）

## 数据正确性

- [x] 「重新开始」后母会话历史只剩分叉点之前的前缀，界面与 `buildContextEntries()` 一致
- [x] 母会话文件已物理截断为「header + 前缀」，文件里不再残留被放弃的条目（用文本方式核对 JSONL）
- [x] 截断为原子写（tmp + rename），中途失败不留半个文件；截断后 `SessionManager.open` 可正常打开
- [x] 被放弃的内容完整存在于分支会话（条目数与前缀之后的原条目一致，工具卡/思考/产物条目都在）
- [x] 分叉点之后无内容时**不产生**分支会话文件，仅回退
- [x] 对首条用户消息「重新开始」→ 会话历史为空但文件与目录保留（代码路径 + fork 侧空历史有冒烟覆盖；restart 侧空历史成功路径由 Task 10 真机点一遍更稳）
- [x] 「分支出新会话」不改动母会话文件（修改前后字节一致）与母会话叶子

## 状态继承

- [x] 分支会话继承 sceneId / interactionId / expertId / `lastNonPlanInteraction`
- [x] 分支会话的推理强度按分叉点之前的会话文件条目还原（未走 `options.thinkingLevel` 注入）
- [x] 分支会话 cwd 与母会话一致，任务区会话分支**不创建新目录**
- [ ] ⬜ 需真机：分叉点之前的产物清单在分支会话的产物面板可见（`artifacts_presented` 随前缀复制已由代码与条目搬运逻辑保证，但面板呈现需眼睛看）

## 来源标识

- [x] 分支会话文件 header 的 `parentSession` 指向母会话文件（pi 未写时由我方补写）
- [x] 分支会话标题为「母标题 · 分支」，重名时递增为「· 分支 2」
- [x] `SessionSummary.parentSession` 经列表推送到达渲染层，普通会话为 `undefined`
- [ ] ⬜ 需真机：侧栏显示分支标记；hover 显示来源会话标题；来源已删除时不提供跳转且不报错（逻辑与单测已通过，图标是否真的渲染出来需眼睛看）

## 边界与互斥

- [x] 流式中发起分支被拒绝，界面给出可读提示，会话状态不变
- [x] 无会话文件的会话不出现分支入口
- [x] 分支操作与 resume / rename / delete / saveToWorkspace 并发时经互斥链串行，无同文件双写、无孤儿宿主
- [x] 拒绝路径返回结构化 `reason`，界面文案按 reason 分派，无「静默无反应」

## 重试改造

- [ ] ⬜ 需真机：重试后当前会话历史中不再出现两条相同用户消息（构造上已保证：先截断再发；需真机确认界面表现）
- [x] 重试产生的被放弃内容可在分支会话找回
- [x] 错误卡上的「重试」与新入口共用同一实现（无第二份分支逻辑）
- [x] 流式期间重试按钮仍不显示

## 界面与规范

- [ ] ⬜ 过程性：界面改动前已读 `DESIGN.md`，动作条复用现有 hover 工具条与既有按钮档位（「复用既有档位」已由 `check:tokens` 与代码核验；「是否读过」无法反证）
- [x] 未引入新的硬编码视觉值；`npm run check:tokens` 通过
- [x] 用户消息动作条常驻占位、只切透明度（与现有工具条一致，不因 hover 才插入 DOM）
- [x] 提示文案给出分支会话标题，用户能找到被保存的内容

## 工程校验

- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过（`documents/` 约束与渲染层 import 边界未被破坏）
- [x] `npm test` 通过，含新增的 `session-file.test.ts` 与 `session-branch.test.ts`
      —— 全量结果 2182 passed / 10 skipped；唯一失败 `src/sandbox/confinement.win.test.ts` 为受限令牌探测（`0x80000005`），
      本环境命令层反复出现同一错误码，属 Trae 沙箱环境限制；该目录不在本 spec 改动清单内，与本功能零交集。
      新增四个测试文件（session-file 11 / session-branch 15 / branch-target 4 / session-origin 9）全绿。
- [x] 未修改任何与本 spec 无关的文件
      —— 本 spec 触碰：`src/core/session-file.ts(+test)`、`src/core/session-host.ts`、`src/daemon/session-branch.ts(+test)`、
      `src/daemon/index.ts`、`src/shared/{ipc,bridge}.ts`、`src/preload/index.ts`、
      `src/renderer/{branch-target,session-origin}.ts(+test)`、`src/renderer/{App,chat-view,sidebar,index.css}`、
      `scripts/{probe,smoke}-session-branch.ts`。工作区里另有并行 spec（skill-management / complete-docx-skill-set）的改动，未触碰。
