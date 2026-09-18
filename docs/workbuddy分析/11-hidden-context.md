# 11 · WorkBuddy hidden context（F5）完整机制逆向

> 2026-09-16。证据：`extracted/main/tar.js`（WorkbuddyUserPromptService + 17 sections + prompt-context-xml）、
> `extracted/main/server.js`（SessionManager / conversation-prompt-preparer 桥接）。
> 结论先行：**可以照抄整套**，注入点用 pi 的 `transformContext`（查证见同日日志），不卡 pi 能力。
>
> **落地状态（2026-09-16；投递方式 2026-09-18 被取代）**：第一批已实现 —— `shared/hidden-context.ts`（wrap/compose/
> `shouldAppendSnapshot` 纯函数）、`core/memory.ts memoryReminder`（短指针段）、`core/session-host.ts`
> `freezeHiddenContext`（按 run 冻结）、daemon `getExpertLabel` 回调。
> **2026-09-18**：投递方式由「`transformContext` 每请求现算、返回值**不落会话文件**」改为
> 「`before_agent_start` 返回的**持久快照消息**（落盘、落在本轮用户消息之后、按内容逐字节去重）」，
> `installHiddenContext` 已退役 —— 结论以 `.trae/specs/persist-context-snapshots/spec.md` 为准。
> **完整上下文组成预览落在任务诊断面板 ②**（两个可折叠成分块：占用与分类=现在·估算 /
> 最近一次入模拆分=当时·真实计数，`request_snapshot` 带了 `hiddenContextChars`）。
> 曾短暂把 hidden 预览加进设置页、同日按用户决定回退 —— 设置页只管系统提示词，
> 完整上下文按任务走面板（每个任务的上下文不一样，全局页面放不下这个概念）。
> 与 §6 施工图的一个有意差异见 §7「落地修正」。第二批（压缩剥离）未做。

## 1. 全链路（三条路汇到同一个编排器）

```
旧链：SessionManager.composePromptForBackend ─┐
新链：LocalConnection → cbc --acp 的 core hook ─┤→ WorkbuddyUserPromptService.composeUserPrompt()
      prepareConversationPrompt                ─┘   （userPromptComposer，daemon 进程内）
                                                     ↓ 组装后的 prompt
                                              cbc（CLI）transformContext 每轮重发
```

- 新架构曾长期漏注入（`<user_info>` 等从未进首轮），修复方式就是把 core hook 桥接回**同一个**
  `composeUserPrompt`——两套架构共用一套编排逻辑。这个教训对我们没用（我们只有一条链），
  但「编排器唯一」的架构值得照抄。
- **失败回落**：compose 抛错 → warn 日志 + 返回**原始 prompt**，绝不阻塞发送。
- `isClearSession === true`（清空会话）直接跳过注入。

## 2. 容器契约（压缩协议就在这个属性上）

```js
wrapHiddenContextXml(xml, role = "user-context")
// → <system-reminder data-role="user-context">\n…\n</system-reminder>
```

| data-role | 语义 | 压缩时 |
|---|---|---|
| `user-context` | 常态化内容（身份/规则/项目布局） | **整块保留** |
| `additional-data` | 本轮触发的一次性内容（current_time / 附件 / 引用建议） | **可整体剥离/摘要** |

- 契约就是 `data-role` 属性本身：CLI 压缩链路按它剥离（strip 侧 `stripPromptContextXml`
  能把全部隐藏块剥掉还原用户原文——遥测/搜索用它取「用户真正说了什么」）。
- 用户正文包 `<user_query>…</user_query>`（提取时保留内文）。
- Teams 项目会话再套一层 `<team-project-context>` 容器收编项目专属子块（我们无此场景，不做）。

## 3. 17 个 section 全表（顺序 = 注入顺序）

| # | Section | stage | container | 渲染标签 | 内容 |
|---|---|---|---|---|---|
| 1 | UserInfoSection | first_turn | user-context | `<user_info>` | 用户画像（记忆系统的公开侧） |
| 2 | IdentityContextSection | first_turn | user-context | `<ask_mode>`/`<craft_mode>` | 身份上下文（nunjucks 模板 user-context-identity.tpl，专家用 -expert 变体） |
| 3 | RulesSection | first_turn | user-context | `<rules>` | always-applied 用户/工作区规则 |
| 4 | ProjectContextSection | first_turn | user-context | `<project_context>`+`<project_layout>` | 工作目录与项目布局（cwd 非空才注入） |
| 5 | AdditionalDataSection | every_turn | **additional-data** | `<current_time>`+`<attached_folders>`/`<attached_files>` | 当前时间 + 本轮附件 |
| 6 | TencentDocsAdditionalSection | every_turn | additional-data | 文档路由 | （腾讯文档域，不做） |
| 7 | UserCommandSection | every_turn | user-context | `<user_command>` | 用户斜杠命令回显 |
| 8 | SpecialInstructionsSection | every_turn | user-context | `<user_special_instructions>` | 用户自定义特殊指令 |
| 9 | SystemReminderSection | every_turn | user-context | 系统提醒 | （自动化提醒等同类的宿主） |
| 10 | ModeTransitionReminderSection | every_turn | user-context | 模式切换提醒 | hasModeTransition 才注入 |
| 11 | CurrentExpertReminderSection | every_turn | user-context | `<current-expert>` | 当前专家钉子（每轮重申身份） |
| 12 | WorkingMemoryReminderSection | every_turn | user-context | `<memory_and_skills_reminder>` | 工作记忆 + 技能提醒 |
| 13 | AutomationSystemReminderSection | every_turn | user-context | 自动化提醒 | meta 有 automation reminder 才注入 |
| 14 | AttachedSkillsSection | every_turn | user-context | `<manually_attached_skills>` | 手动附着的技能 |
| 15–17 | Ardot{FileDirective,DesignStyle,ImageGen}Section | every_turn | user-context | `<ardot_*>` | 设计场景专属 |

## 4. 首轮判定与去重（两个坑）

- 首轮 = `!hasPriorUserMessages && !codebuddyMeta.alreadyInjectedUserContext`。
  `alreadyInjectedUserContext` 是 meta 上的**去重标记**，注入过一次就置位——resume / 重发不会重复注入。
- 已知坑 #86510：fresh 会话先发 `session/load` 再发 prompt，若把 load 也算「已发」，
  first_turn 块会被误跳过 → 「是否发过**真正的** prompt」要单独记账。
- IdentityContextSection 特例：即使非首轮，若**身份源指纹**（本机人设/个性化）变了也要重注入
  （`computeIdentitySourceFingerprint` + per-session `lastSentIdentitySource` 缓存）——
  「first_turn 但内容变了仍发」，避免用户改了人设后半个会话拿旧身份。

## 5. 组装细节（composeUserPrompt 方法体）

1. `structuredClone(prompt)` 再动手——绝不原地改用户输入。
2. 每个 section：`shouldApply(input)` → `render(input)` → 空串跳过。
3. 按 `container` 分两桶：`additional_data` 进 additionalDataParts，其余按顺序进 nonContainerParts；
   **additional_data 桶内 stage 混用会打 warn**（一次性容器不该有常态内容混入）。
4. legacy（非 Teams）路径：**一个** `user-context` 块包全部，`<additional_data>` 作为子块
   插在它原本的顺序位置（additionalDataInsertIndex 占位法）。
5. Teams 路径：user-context 块 + 独立 additional-data 块 + `<team-project-context>` 容器。
6. 返回 `[...hiddenBlocks, ...transformedPrompt]` —— 隐藏块**前置在用户消息之前**。
7. PromptRenderer（first_turn 身份块的内容源）= collector 数组 + nunjucks 模板：
   EnvCollector / IdentityCollector / PersonalizationCollector / MemoryCollector /
   UserMemoryCollector / CollaborationCollector / ExpertPromptSlotCollector /
   ExpertManagementCollector…，模板 `user-context(-expert)-identity.tpl`。

## 6. 我们的实现映射（F5 施工图）

| WorkBuddy | 我们 |
|---|---|
| composeUserPrompt（daemon 内） | `core/hidden-context.ts` 纯函数：sections → 单块 XML |
| 注入点（CLI transformContext 每轮重发） | `session-host` 的 `agent.transformContext` 包装链（快照旁再加一层注入；pi 返回值即入模、不持久化） |
| 17 sections 类 | 第一版 4 个：CurrentTimeSection（additional-data）、WorkspaceSection（cwd+场景+模式，first_turn+变更重发）、ExpertSection（current-expert，every_turn）、MemoryReminderSection（J 层记忆，every_turn） |
| data-role 压缩契约 | 同名两容器；我们压缩时按 `data-role="additional-data"` 剥离（第二批） |
| 首轮判定 + alreadyInjected 标记 | 我们按「run 序号」判定首轮；注入内容按 run 冻结（缓存纪律） |
| 失败回落 raw prompt | must-not-throw，沿用 request_snapshot 的台账上报 |

标记格式照抄：`<system-reminder data-role="user-context">`（`<user_query>` 包正文一层暂不需要——
我们的 UI 不做「从发送文本提取用户原话」的遥测，需要时再补）。

## 7. 落地修正（2026-09-16 实现时确定）

施工图里「workspace_context = first_turn + 变更重发」在实现时**简化为每 run 重注入**，
原因是我们与 WorkBuddy 的持久化语义不同：

- WorkBuddy 的 compose 发生在消息**进入会话文件之前**，注入块跟着首条 user 消息
  **持久化**，后续轮的上下文里天然还在 —— 所以只需 first_turn 注入一次 + 内容变更时重发。
- 我们的注入点在 `transformContext`（返回值不落会话文件，pi 每次调用都给原始上下文），
  first_turn 注入的内容到第二个 run 就消失了。不重注入 = 模型看不见。

因此 user-context 桶（workspace_context / memory 提醒）**每个 run 都注入**（内容按 run
冻结，成本 = 每轮几行文本），first_turn 判定与 alreadyInjected 去重标记在 v1 一并省去
—— 等「注入块跟随消息持久化」的需求出现（例如遥测要还原用户原话）再补。

> **状态：被取代（2026-09-18，spec: persist-context-snapshots）** —— 本节的前提
> 「我们的注入点在 `transformContext`、返回值不落会话文件 ⇒ first_turn 注入的内容到第二个
> run 就消失了」已作废：注入改为 `before_agent_start` 返回的**持久快照消息**（落盘，落在
> 本轮用户消息之后）。结论「user-context 桶每个 run 都注入」仍成立，但理由由「不落盘会消失」
> 改为「按内容逐字节去重后按需追加」——「注入跟随消息持久化」这个条件已经满足（去重由
> `shouldAppendSnapshot` 承担）。
