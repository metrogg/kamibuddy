# 记忆系统（三层记忆 + 本地画像 + 会话检索）Spec

## Why

WorkBuddy 记忆体系实证：三层记忆（云端画像 / 用户级 MEMORY.md / 工作区日志+笔记）
+ 写入纪律提示词 + 注入槽 + 设置页管理。云端部分按用户拍板换本地等价：
**画像蒸馏用我们自己的 automation 调度器**（每晚无人值守 run），
**conversation_search 换本地会话检索**（会话本来就是本地 JSONL）。
KamiBuddy 缺记忆 = 跨会话不积累偏好与背景，办公场景每次从零开始。

## What Changes

1. **三层记忆文件**（模型用既有 Edit 工具维护，无新写入工具）：
   - L2 用户级 `~/.kamibuddy/MEMORY.md`：用户明说「记住」的跨项目精确规则
   - L3 工作区 `<cwd>/.kamibuddy/memory/`：`YYYY-MM-DD.md`（append-only 日志）
     + `MEMORY.md`（项目长期笔记）
   - L1a 本地画像 `~/.kamibuddy/PROFILE.md`：工作背景/个人背景两节（对齐 WorkBuddy
     画像结构），由内置蒸馏任务每晚更新
   - **权限门加记忆文件白名单**：上述三类路径放行写（纯数据非可执行配置，
     防自毁针对 preferences/auth/models——注释写明）；凭据硬 deny 不变
2. **提示词与注入**：
   - `resources/prompts/memory-system.md`（自创）：三层结构说明 + 写入纪律
     （完成实质工作立即记当日 log；不记瞬时信息；30 天日志蒸馏进 MEMORY.md 的家务）
     + 检索策略（本项目→读本地日志；跨项目→conversation_search；无依赖→不读）
   - compose 注入（在通用骨架后、人格段前）：记忆系统说明段 + L2 全文 +
     L1a 画像全文 + L3 的 MEMORY.md 全文与最近 3 天日志文件清单（不注日志正文——
     控制 token，模型按需 read）；全部为空则零 token
3. **conversation_search 工具**（本地等价，全模式白名单——只读）：
   grep 会话 JSONL 目录，返回匹配片段（会话标题/日期/命中前后文），
   按修改时间倒序、上限 20 条；权限门放行（读自己的会话库，同 automation_list）
4. **内置画像蒸馏任务**：
   - automation store 的 task 加 `builtin?: true`；daemon 启动时确保存在内置任务
     「记忆整理」（固定 id、daily 03:00、prompt 自创蒸馏指令：读近 3 天会话 →
     更新 PROFILE.md 两节、保留仍有价值的旧内容）
   - builtin 任务：run 完成**不 toast、run 会话不标未读**（静默后台家务）；
     管理页可见（标「内置」）不可删
   - preferences 加 `memoryEnabled`（默认 true）：toggle 控制内置任务启停
5. **设置页「记忆」分区**（settings-view 加 section）：
   - 「生成对话记忆」toggle（= memoryEnabled，控制内置任务）
   - 画像查看/编辑（textarea 直编 PROFILE.md）/ 重置（清空）/ 导入（选 .md 覆盖）
   - IPC：getProfile / setProfile / resetProfile / importProfile + get/setMemoryEnabled

**明确不做**：身份层（SOUL/IDENTITY/BOOTSTRAP——与专家人格有交互，单独 spec）、
写入配额（WorkBuddy 的 4k/3k per-session cap——提示词纪律即可）、
30 天蒸馏的代码化（提示词家务，模型自己做）、云端同步、向量检索。

## Impact

- Affected specs：与 add-automation-scheduler（内置任务承载于其调度器）、
  add-expert-mode（expert 模式也注入记忆——WorkBuddy expert 变体保留 USER.md
  同理我们全模式注入，人格与记忆分层不冲突）
- Affected code：
  - `resources/prompts/memory-system.md`（新）、`src/core/memory.ts`（新：三层读取 +
    注入段组装 + 测试）、`src/core/prompt-composer.ts`（记忆注入段）
  - `src/extensions/permission-policy.ts`（记忆文件白名单 + conversation_search 放行）
  - `src/extensions/conversation-search-tool.ts`（新 + 测试）
  - `src/core/automation-store.ts`（builtin 字段）、`src/daemon/index.ts`
    （内置任务 ensure + 静默 + preferences memoryEnabled + 画像 IPC）
  - `src/shared/ipc.ts`（四画像通道 + toggle）、`src/renderer/settings-view.tsx`
  - `resources/modes/{craft,ask,plan,expert}.md`（conversation_search 白名单）

## ADDED Requirements

### Requirement: 三层记忆与写入纪律

系统 SHALL 提供三层记忆文件（用户级 MEMORY.md / 工作区 memory/ 日志与笔记 /
本地画像 PROFILE.md），系统提示词注入记忆系统说明段（写入纪律：完成实质工作
立即记当日日志、不记瞬时信息、30 天蒸馏家务）与记忆内容（L2 全文、画像全文、
L3 笔记全文 + 近 3 天日志清单）；内容为空不注入。记忆文件 SHALL 可经文件工具
写入（权限门白名单），应用目录其余文件维持禁写。

#### Scenario: 记住偏好
- **WHEN** 用户说「记住：报告都用表格呈现」
- **THEN** 模型用 Edit 把该规则追加到 ~/.kamibuddy/MEMORY.md，下一轮对话生效

#### Scenario: 工作日志
- **WHEN** 模型完成一份报告生成
- **THEN** 它把要点追加到 `<cwd>/.kamibuddy/memory/YYYY-MM-DD.md`（append-only）

### Requirement: 本地画像蒸馏

系统 SHALL 在内置自动化任务「记忆整理」（daily、builtin 静默）中蒸馏近 3 天会话
更新 PROFILE.md 的工作背景/个人背景两节；preferences 的 memoryEnabled 控制该任务
启停；内置任务 run 完成不 toast、会话不标未读；管理页可见不可删。

#### Scenario: 每晚整理
- **WHEN** 内置任务到期运行（用户当天有过实质对话）
- **THEN** PROFILE.md 两节被更新（保留仍有价值的旧内容），用户无感知

### Requirement: 画像管理界面

设置页「记忆」分区 SHALL 提供：生成对话记忆 toggle、画像查看/编辑/重置/导入。

#### Scenario: 手动修正画像
- **WHEN** 用户在设置页编辑画像文本保存
- **THEN** PROFILE.md 更新，下一轮对话生效

### Requirement: 本地会话检索

系统 SHALL 提供 `conversation_search` 工具（全模式）：按关键词检索历史会话
JSONL，返回标题/日期/匹配片段（修改时间倒序、上限 20）；权限门放行。

#### Scenario: 回忆历史
- **WHEN** 用户问「我们之前讨论 XX 的方案是什么」
- **THEN** 模型调 conversation_search 找到相关会话片段后回答

## MODIFIED Requirements

### Requirement: 权限门应用目录禁写

**原**：应用目录（~/.kamibuddy）一律禁写。**新**：记忆文件白名单
（MEMORY.md / PROFILE.md / `<cwd>/.kamibuddy/memory/**`）放行写，其余维持禁写；
凭据目录硬 deny 不变。

### Requirement: 四模式工具白名单

**原**：各模式白名单如现状。**新**：四模式均加 `conversation_search`（只读）。

## REMOVED Requirements

无。
