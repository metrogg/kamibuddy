# 临时任务工作空间模型对齐 WorkBuddy（playground 退役）Spec

## Why

我们的 playground（不绑定目录、无文件工具）是**我们自己的发明**，不是 WorkBuddy 的设计——
代码注释里「WorkBuddy cwd=\"\" 同语义」的背书经全面取证**查无实据**，必须修正。
WorkBuddy 的真实模型（asar 内 `main/server.js` 中文注释与 locale 取证）：

- 默认工作空间根：设置项 `defaultWorkspacePath`（UI 可改），兜底 `~/WorkBuddy`；
  「新建任务、工作空间时将自动存放在该路径下。修改后不影响已有数据」
- **临时任务 cwd = `<根>/Claw`**（固定单一共享临时目录，工具齐全、权限照常）
- 命名工作空间 = 根下其他子目录或外部目录；`isClawRuntimeCwd` 按路径相等判定临时会话
- 临时任务可「保存到工作空间」转正（命名 dialog）

用户决策：**全部对齐 WorkBuddy**（2026-09-09）。当初 playground 不给文件工具是因为
没有读取边界，现在区外读/写都要询问、凭据禁读写、应用目录写高风险——
默认根方案的安全水位已不低于 playground，前提成立。

## What Changes

- **playground 语义退役**（**BREAKING**，同仓库同构建同步改，不留兼容 shim）：
  「不使用工作空间」选项从 picker 移除；新建任务默认 = **临时任务**，
  cwd = `<默认根>/临时任务`（共享临时目录，对齐 `<root>/Claw`），完整工具集 + 权限门照常装。
  `PLAYGROUND_TOOLS` 与 configDir/playground 占位目录逻辑一并退役。
- **契约改名**：`SessionState.isPlayground` / `SessionSummary.isPlayground` → `isTempTask`
  （cwd = 临时任务目录或默认根本身即临时；旧 playground 会话恢复时归入临时任务）。
- **默认存储路径设置项**：`preferences.json` 加 `defaultWorkspacePath`；
  生效根 = `KAMIBUDDY_WORKSPACE_DIR` env > 设置项 > `~/KamiBuddy`（分层，WorkBuddy 同款）；
  设置页新增「默认存储路径」区块（显示当前值 / 修改（目录选择）/ 还原默认；
  修改只影响新任务与新空间，已有会话 cwd 不变——「不影响已有数据」同款语义）。
- **分组键**：侧栏任务区 = `isTempTask` 会话；空间区 = 命名工作空间会话（规则不变，
  仅分桶键从 isPlayground 换成 isTempTask）。
- **保存到工作空间**：临时任务的会话可转正——dialog 输入名称（复用工作空间名校验）→
  创建 `<根>/<名称>/` → 会话以新 cwd 重建（resume 同套守卫）→ 该会话归入新空间组。
  **历史文件留在临时目录不动**（共享临时目录里无法干净归属单个任务的文件——
  WorkBuddy 同为共享目录结构；之后的产物写入新目录）。
- **预览服务**：临时任务会话起服务（根 = 临时目录），不再是「不起服务」。

## Impact

- Affected specs: 会话模型（playground → 临时任务）、工作空间、侧栏分组、设置页
- Affected code:
  - `src/shared/session-events.ts`（isPlayground → isTempTask + 错误背书注释修正）、
    `src/shared/ipc.ts`（SessionSummary 字段改名 + saveToWorkspace/defaultWorkspacePath 通道）、
    `src/shared/conversation.ts`（initialConversation）
  - `src/core/config-paths.ts`（getTempTasksDir、内置默认与生效根分层）、
    `src/core/preferences.ts`（defaultWorkspacePath 字段）、`src/core/session-host.ts`
    （PLAYGROUND_TOOLS/占位目录退役）、`src/core/workspace.ts`（picker 选项语义）
  - `src/daemon/index.ts`（createHost 分支简化、applyWorkspace/resume/listSessions 判定、
    设置项读写 handler、saveToWorkspace handler）
  - `src/renderer/workspace-picker.tsx`（退役「不使用工作空间」，默认态=临时任务）、
    `src/renderer/sidebar.tsx` + `src/renderer/session-groups.ts`（分桶键改名）、
    `src/renderer/chat-view.tsx`（「保存到工作空间」入口）、`src/renderer/settings-view.tsx`
    （默认存储路径区块）、`src/renderer/home-view.tsx`（chip 默认态文案）
  - 测试：preferences / session-groups / workspace 相关用例同步

## ADDED Requirements

### Requirement: 临时任务默认落点

系统 SHALL 让未选择工作空间的新任务以 `<生效根>/临时任务` 为会话 cwd（递归创建），
加载完整工具集并装权限门（工作区=临时目录）。新建任务的默认状态即临时任务，
picker 不再有「不使用工作空间」选项。

#### Scenario: 默认任务落临时目录
- **WHEN** 用户不动工作空间选择直接发消息
- **THEN** 会话 cwd 为 `~/KamiBuddy/临时任务`，可读写该目录（权限门按工作区放行），
  生成物落在临时目录；侧栏该任务出现在任务区

### Requirement: 默认存储路径可设置

系统 SHALL 在设置页提供「默认存储路径」：显示当前生效根、修改（系统目录选择对话框）、
还原默认。生效根 = env `KAMIBUDDY_WORKSPACE_DIR` > 设置项 `defaultWorkspacePath` > `~/KamiBuddy`。
修改只影响之后新建的任务与工作空间；已有会话的 cwd 不变（对齐 WorkBuddy「不影响已有数据」）。
设置项为非法路径（不存在且无法创建）时回退内置默认并提示（WorkBuddy 同款回退策略）。

#### Scenario: 修改存储根
- **WHEN** 用户把默认存储路径改为 `D:\Work`
- **THEN** 之后的新任务落在 `D:\Work\临时任务`，已有会话仍在原 cwd 不受影响

### Requirement: 保存到工作空间（转正）

系统 SHALL 在当前会话为临时任务时提供「保存到工作空间」入口（对话页头部）：
dialog 输入空间名称（校验：非空/非法字符/255/同级重名/保留名——复用显示名校验的同族规则，
但这是对**真实目录**命名，目录创建于根下）→ 创建 `<根>/<名称>/` →
会话以新 cwd 重建（复用 resume 的全部守卫与失败原子性）→ 归入新空间组。
已生成文件留在临时目录；之后的产物写入新目录。

#### Scenario: 转正并归组
- **WHEN** 临时任务里做了一份周报，用户点「保存到工作空间」命名「九月周报」
- **THEN** 创建 `~/KamiBuddy/九月周报/`，会话以该 cwd 继续，侧栏空间区出现「九月周报」组，
  该任务归入其下；临时目录里已有的文件保持不动

### Requirement: 旧会话归类

- cwd = configDir/playground 的旧 playground 会话：恢复时按临时任务处理（cwd 映射到临时目录）；
- cwd = 默认根本身的会话：归任务区（与临时目录同等待遇——都是「非命名空间」）；
- cwd = configDir/playground 的会话在列表中同样显示为临时任务（任务区）。

#### Scenario: 旧 playground 会话恢复
- **WHEN** 用户恢复本次变更前的 playground 会话
- **THEN** 会话以临时任务身份恢复（cwd 为临时目录），历史完整可见，可继续对话

## MODIFIED Requirements

### Requirement: 侧栏分桶键

原行为：`isPlayground=true` 的会话进任务区。
新行为：`isTempTask=true`（cwd = 临时任务目录 / 默认根本身 / 旧 playground 占位目录）
的会话进任务区；其余进空间区。分组、排序、查看更多等规则不变。

## REMOVED Requirements

### Requirement: playground（不使用工作空间）模式

**Reason**：取证证明它是我们自己的发明且注释背书错误（「WorkBuddy cwd=\"\" 同语义」
查无实据）；WorkBuddy 的真实模型是临时任务落默认根共享目录、工具齐全。
用户决策全部对齐（2026-09-09）。权限加固（区外读/写询问 + 凭据禁读写 +
应用目录写高风险）落地后，默认根方案的安全水位已不低于 playground。
**Migration**：旧 playground 会话恢复时归入临时任务（cwd 映射）；picker 默认态改为临时任务；
`PLAYGROUND_TOOLS` 与 configDir/playground 占位逻辑随代码一并删除（不做兼容 shim）。

## 明确不做（本变更范围外）

- **转正时迁移历史文件**：共享临时目录无法干净归属单个任务的文件（WorkBuddy 同结构），
  只切 cwd 不搬文件；用户可手动整理。
- **每任务独立临时目录**：WorkBuddy 就是共享 Claw 目录，不对齐出额外结构。
- **修改默认根后对旧临时任务的追溯**：判定用当前生效根（WorkBuddy 的
  `isClawRuntimeCwd` 同款局限——改根后旧临时会话不再被识别为临时，归空间区），
  注释写明不另做历史映射。
- 空间区的「默认根」组特殊化：cwd=根本身的会话归任务区，不在空间区单列「默认根」组。

## 附：必须修正的错误背书

`src/shared/session-events.ts` 等处「WorkBuddy 的 cwd=\"\" 同语义」注释经全面取证
（`docs/workbuddy分析/` 笔记 + app.asar 的 main/server.js、locale）**查无实据**，
本次随字段改名一并删除，并在 STATUS.md 记录更正。
