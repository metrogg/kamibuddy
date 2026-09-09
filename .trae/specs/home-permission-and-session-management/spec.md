# 首页权限快捷切换 + 会话管理（列表/恢复/重命名/删除）Spec

## Why

两个日常高频功能当前是缺的或死的：

1. 首页输入卡下方的「默认权限 ▾」chip 是 `onTodo` 死按钮，真实功能埋在设置页里——
   权限档位是日常操作（对标 WorkBuddy：它与工作空间选择器并列在首屏），不该进设置页翻。
2. 会话管理只有「存储」一半：pi 的 `SessionManager.create(cwd, getSessionsDir())` 已把会话
   以 JSONL 树落盘到 `~/.kamibuddy/sessions/`，但「使用」一半全无——侧栏「任务」只显示
   当前一条，重启应用后历史对话找不回（「昨天那个报告在哪」是试用者必问的问题）。
   pi 自带的会话管理能力（list / open / 命名 / 树结构）没有接上。

## What Changes

- **权限 chip 可用化**：首页「默认权限 ▾」chip 改为真实弹层，列出三个预设
  （只读 / 默认权限 / 允许完全访问，旋钮组合不匹配时显示「自定义」），选中即调
  既有 `setPermissions` 通道生效（daemon 已是 getter 读取，下一次工具调用生效）。
  设置页的完整版（双旋钮 + 强制力说明）保留——分工同 ModelMenu：首页是切换器，设置页是管理页。
- **会话列表**：侧栏「任务」区从「仅当前一条 / 暂无历史任务」改为真实列表，
  数据源为 `SessionManager.listAll(getSessionsDir())`，按修改时间倒序，
  显示标题（命名 ?? 首条消息截断）、智能时间戳（复用 shared/message-time.ts）、
  工作空间标识（playground 显示「不使用工作空间」）、当前会话高亮。
- **会话恢复**：点击历史会话 → daemon 用 `SessionManager.open(path, dir)` 重建 SessionHost，
  从 `buildContextEntries()` 把 pi 存储的消息翻译回本应用的 ConversationEntry 视图，
  恢复工作空间选择与预览服务根，切到对话页可继续提问（上下文连续，由 pi 的
  树结构与 compaction 处理保证）。
- **重命名**：行内编辑，经 pi 的 `appendSessionInfo(name)` 落盘（当前会话用活实例，
  非当前会话临时 open 后写入，避免双写者）。
- **删除**：移入 `~/.kamibuddy/trash/`（可恢复，对齐 pi「避免永久删除」的取向），
  当前会话不可删。

## Impact

- Affected specs: 权限模型（入口前置，判定逻辑不变）、会话生命周期（新增恢复路径）
- Affected code:
  - `src/shared/ipc.ts`（4 个新通道 + SessionSummary 类型）
  - `src/core/session-host.ts`（SessionManager 注入点，复用现有组装）
  - `src/core/session-rebuild.ts`（**新**：pi SessionEntry[] → ConversationEntry[] 纯函数）
  - `src/daemon/index.ts`（session:list / resume / rename / delete 四个 handler + resume 编排）
  - `src/renderer/sidebar.tsx`（任务列表）、`src/renderer/App.tsx`（列表状态 + resume 流）
  - `src/renderer/permission-menu.tsx`（**新**）、`src/renderer/home-view.tsx`（chip 接入）
  - `src/preload/index.ts`（通道白名单）、`src/renderer/index.css`（弹层与任务行样式）

## ADDED Requirements

### Requirement: 首页权限预设快捷切换

系统 SHALL 在首页输入卡下方提供权限预设切换入口，点击展开弹层列出
`PERMISSION_PRESETS` 全部预设（label + description），当前生效项有选中标记；
旋钮组合不匹配任何预设时 chip 显示「自定义」且弹层无选中项。
选择预设后 SHALL 调 `setPermissions` 写入对应旋钮值（sandbox + approval + presetId），
chip 文案立即更新；失败 SHALL toast 错误且 chip 不变。
弹层 SHALL 提供「打开设置」入口跳转到设置页完整权限说明。

#### Scenario: 切换生效
- **WHEN** 用户在首页点「默认权限 ▾」→ 选「只读」
- **THEN** chip 显示「只读」，随后让 AI 写文件被权限门拒绝并提示切换预设

#### Scenario: 与设置页一致
- **WHEN** 用户在首页切到「只读」后打开设置页
- **THEN** 设置页权限区同样显示「只读」（同一数据源，无两处漂移）

### Requirement: 会话列表

系统 SHALL 在侧栏「任务」区列出 `~/.kamibuddy/sessions/` 下全部持久化会话，
按修改时间倒序。每项显示标题（`name ?? firstMessage` 截断）、智能时间戳、
空间标识（playground 会话显示「不使用工作空间」，否则显示工作目录末段）。
当前活动会话 SHALL 高亮且排他（至多一条）。
列表刷新时机：应用启动、新建任务完成、会话恢复完成、每次 run 结束
（标题/时间/消息数只在 run 结束才可能变）。

#### Scenario: 重启后找回历史
- **WHEN** 用户昨天聊过三轮，今天重启应用
- **THEN** 侧栏「任务」区列出昨天的会话（标题为首条消息截断 + 时间）

### Requirement: 会话恢复

系统 SHALL 支持点击历史会话恢复：daemon 校验目标文件在 sessions 目录内且为 `.jsonl`
（防任意路径打开），作废旧会话，用 `SessionManager.open` 打开目标文件重建 SessionHost，
恢复工作空间选择（会话 header 的 cwd；playground 占位目录恢复为 playground 语义）
与预览服务根，并从 `buildContextEntries()` 重建消息视图。
恢复 SHALL 不改变当前模型选择与权限设置（会话连续性由 pi 负责，应用层选择不随它漂）。
流式进行中 SHALL 拒绝恢复（与新建任务同一守卫）。
重建的视图 SHALL 翻译：user/assistant 消息（含 thinking）、toolCall 与 toolResult
配对为工具卡片（outcome 由 isError 判定）；compaction / model_change / label /
session_info / custom / bashExecution 条目不进入视图（它们属于上下文机制，不是展示内容）。
恢复后 renderer 经既有 resyncSnapshot 拉取该视图并切到对话页。

#### Scenario: 恢复并继续
- **WHEN** 用户点击昨天的会话
- **THEN** 对话页显示昨天的完整对话（消息、工具卡片、思考块），
  继续提问时模型记得之前的内容（pi 的会话树保证上下文连续）

#### Scenario: 路径越界拒绝
- **WHEN** resume 请求的路径不在 sessions 目录内（如 `../../auth.json`）
- **THEN** daemon 拒绝且当前会话不受影响

### Requirement: 会话重命名

系统 SHALL 支持行内重命名任意历史会话，经 pi 的 `appendSessionInfo(name)`
落盘（当前会话用活动的 SessionManager 实例；非当前会话临时 open 写入后关闭，
避免同一文件两个活写者）。列表标题立即更新。

#### Scenario: 重命名持久化
- **WHEN** 用户把某会话重命名为「九月周报」并重启应用
- **THEN** 列表仍显示「九月周报」

### Requirement: 会话删除

系统 SHALL 支持删除非当前会话：文件移入 `~/.kamibuddy/trash/`（同名加时间戳前缀），
列表中消失。当前活动会话 SHALL 拒绝删除（提示先新建任务）。
删除 SHALL 有行内二次确认（点击后该行变为确认态），不弹系统对话框。

#### Scenario: 删除可反悔
- **WHEN** 用户删除某会话后检查 `~/.kamibuddy/trash/`
- **THEN** 对应 .jsonl 在 trash 中（可人工找回）， sessions 列表中已消失

## MODIFIED Requirements

### Requirement: 侧栏「任务」区

原行为：只显示当前会话首条消息一条，或「暂无历史任务」占位。
新行为：显示真实会话列表（见上方「会话列表」Requirement）。
「新建任务」按钮行为不变（作废旧会话、保留工作空间），
新建后当前会话未发消息前不出现在列表（无内容不值得列）。

## REMOVED Requirements

### Requirement: 首页权限 chip 占位反馈

**Reason**：chip 从 `onTodo` 占位升级为真实功能，占位反馈失去存在意义。
**Migration**：无——同一位置的同一 chip，行为从 toast「待做」变为展开弹层。

## 明确不做（本变更范围外）

- 会话树分支（/tree、/fork、/clone）：pi 有能力但交互复杂，恢复线性对话已覆盖试用诉求。
- 会话自动命名（LLM 起标题）：`firstMessage` 截断已够用。
- trash 自动清理策略：v1 只移入不清空。
- chat 页 composer 区的权限入口：首页入口先站稳，chat 页按试用反馈再加。
- 恢复会话时的模型随会话切换：保持当前模型选择（决策已写明理由）。
