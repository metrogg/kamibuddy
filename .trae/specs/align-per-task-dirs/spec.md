# 每任务独立工作目录（对齐 WorkBuddy）Spec

## Why

现状：所有「未选工作空间」的任务共用 `<生效根>/临时任务/` 一个目录 —— 多个任务的
产物混放、同名文件互相覆盖，记忆也堆在一起；用户无法按任务在文件系统里找到东西。
（`align-temp-task-workspace-model` 当初的取证只看到 Claw 一处，得出「临时任务 =
共享单一目录」的结论，此处修正。）

WorkBuddy 实证（`docs/WorkBuddy/_analysis/extracted/main/server.js`）：

- 未指定 cwd 的新任务 → `createDefaultCwd()` 在默认根下 `mkdir` 一个
  `YYYY-MM-DD-HH-mm-ss` 目录（`formatDefaultCwdTimestamp`，本地时间；
  同秒冲突按秒递增重试最多 100 次）并作为该会话的 cwd（`server.js:160801-160836`）。
- 这类会话仍标 `isPlayground`（≈ 我们的 `isTempTask`）：左栏「任务」区独立卡片、
  **不按 cwd 成组**；只有转正（`moveSession` 置 `isPlayground=false`）后才在「空间」区
  按 cwd 成组（`ui-docs-viewer-*.js:205329-205353`）。
- `<root>/Claw` 是**本地助理窗口专用**的固定目录（`ensureClawCwd` / `findReusableClawConversationId`），
  不是普通新任务的落点 —— 旧 spec 的结论在此更正。
- 用户机器 `C:\Users\wzd\WorkBuddy\` 即是该结构的产物：几十个时间戳目录，各自带
  `.workbuddy/memory/YYYY-MM-DD.md`（我们的 `.kamibuddy/memory/` 同构）与产出物；
  空目录 = 目录已预建但任务未产出。
- 目录名与会话的绑定在 DB 的 `sessions.cwd` 列（目录名不含 sessionId），重命名会话/工作空间
  **不改目录名**（显示名另存 `workspace-display-names.json`）。

我们的 `tasks/spaces` 分区模型与它的 `playground/workspace` 分区**结构上已一致**
（isTempTask → 任务区；其余按 cwd → 空间区，见 `renderer/session-groups.ts:47-59`），
缺的只是「每个任务一个独立目录」这一步。

## What Changes

- **每任务自动目录**：未选工作空间的新任务，在**首次执行**（真正建会话宿主）时分配
  `<生效根>/<YYYY-MM-DD-HH-mm-ss>`（本地时间，秒级冲突递增重试），`mkdir` 后作为会话 cwd。
  延迟到首次执行是为了不产生「点了新建任务却没发消息」的空目录（WorkBuddy 在创建时即建，
  会产生空目录 —— 这点我们做得更干净，用户可感知差异仅在文件系统里少几个空目录）。
- **任务区判定去根依赖**：归属改由 cwd 形态判定（basename 匹配自动目录格式 / 等于历史共享
  临时目录 / 等于生效根本身 / 旧 playground 占位目录 → 任务区；被显示名覆盖过的走空间区）。
  现在用「当前生效根」比对，改根后旧任务会漂到空间区 —— 顺带修掉。
- **共享 `<根>/临时任务` 退役**：不再作为新任务落点；历史会话仍归任务区，目录与文件原地保留
  （不迁移、不删除）。
- **转正 = 重命名目录**：「保存到工作空间」从「另建命名目录 + 切 cwd」改为**把该任务的
  自动目录重命名为用户输入的空间名**（同根下 rename，产物与记忆随目录走），成功后以新 cwd
  重建会话。这是对 WorkBuddy 的一处改良（它只加显示名、目录仍叫时间戳，时间戳目录会永久堆积）。
- **任务目录可打开**：任务行菜单加「打开文件夹」（reveal 校验从「已知工作空间」放宽到
  「已知工作空间或任一已知会话的 cwd」），否则用户找不到自己的产物目录。
- **同族口径修正**（顺带，2 行）：导出目录与技能资源加载现用内置默认根 `getWorkspaceDir()`，
  与「生效根」双口径；改用生效根（`session-export.ts`、`daemon/index.ts` 相关调用点）。

## Impact

- Affected specs：`align-temp-task-workspace-model`（临时任务落点结论修正）、
  侧栏分组（`session-groups`）、工作空间转正流程
- Affected code：
  - `src/core/workspace.ts`（新增自动目录名生成与创建）+ 测试
  - `src/core/config-paths.ts` / `src/core/preferences.ts`（判定谓词所需的路径口径）
  - `src/daemon/index.ts`（`newTask` 待分配语义、`createHost` 分配时机、`isTempCwd` 判定、
    `saveToWorkspace` 改 rename、`workspaceReveal` 校验放宽、导出根改生效根）
  - `src/shared/ipc.ts`（如需新字段；`SessionSummary.cwd` 语义不变）
  - `src/renderer/sidebar.tsx`（任务行「打开文件夹」）
  - `src/renderer/chat-view.tsx`（「保存到工作空间」文案/提示适配目录重命名）
  - `src/renderer/session-groups.ts`（若判定下沉到 renderer）+ 测试

## ADDED Requirements

### Requirement: 每任务自动目录

系统 SHALL 让未选择工作空间的会话在首次执行时获得
`<生效根>/<YYYY-MM-DD-HH-mm-ss>`（本地时间）作为工作目录：目录不存在则创建；
同一秒内命名冲突按秒递增重试（上限 100 次）。同一会话的多轮对话共用该目录。

新建任务本身不建目录 —— 用户可能点了「新建任务」就切走，不该留下空目录。

#### Scenario: 新建任务自动落独立目录

- **WHEN** 用户在未选工作空间的情况下新建任务并发出第一条消息
- **THEN** 生效根下出现 `2026-09-14-17-30-45/` 形式的目录，会话 cwd 指向它，
  产物与 `.kamibuddy/memory/` 写在该目录内；侧栏该任务出现在「任务」区

#### Scenario: 点了新建但没发消息

- **WHEN** 用户新建任务后未发送任何消息直接切回其他会话
- **THEN** 不生成绩外目录，不残留空目录

#### Scenario: 两个任务互不干扰

- **WHEN** 先后建两个未选工作空间的任务，各自生成同名文件（如 `报告.md`）
- **THEN** 两个文件分别落在各自目录，互不覆盖

### Requirement: 任务区归属判定

「任务」区归属 SHALL 只由 cwd 形态决定，不依赖当前生效根：cwd 的 basename 匹配
自动目录格式（`^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$`）、或等于历史共享临时目录、
或等于生效根本身、或旧 playground 占位目录 → 任务区；被工作空间显示名覆盖过的
cwd 一律走空间区。

#### Scenario: 改存储根后旧任务不漂移

- **WHEN** 用户改了默认存储路径，旧任务（cwd 在原根的时间戳目录）仍在列表中
- **THEN** 它仍归「任务」区，不因根变了就跳到「空间」区

#### Scenario: 转正后的目录进空间区

- **WHEN** 某任务已转正（目录已被重命名为空间名）
- **THEN** 它归「空间」区，与同名目录的其他任务同组

### Requirement: 转正为工作空间（目录重命名）

「保存到工作空间」SHALL 把当前任务的自动目录**重命名**为用户输入的空间名（同根下），
产物与记忆随目录迁移；rename 成功后才以新 cwd 重建会话。目标名冲突或目录被占用时
响亮报错并不改动任何状态。

#### Scenario: 转正后目录即空间名

- **WHEN** 临时任务里产出了一份周报，用户点「保存到工作空间」命名「九月周报」
- **THEN** 原 `<根>/2026-09-14-17-30-45/` 变为 `<根>/九月周报/`（周报与记忆都在里面），
  侧栏「空间」区出现「九月周报」组，该任务归入其下

#### Scenario: 目录被占用

- **WHEN** 该任务目录里的文件正被其他程序打开，导致 rename 失败
- **THEN** 提示用户关闭占用程序后重试，会话 cwd 与目录保持原样

### Requirement: 任务目录可打开

任务行的操作菜单 SHALL 提供「打开文件夹」，打开该会话的工作目录。
daemon 侧校验 SHALL 接受「已知工作空间」或「任一已知会话的 cwd」（现状只接受前者）。

#### Scenario: 找到某个任务的产物

- **WHEN** 用户在任务行菜单点「打开文件夹」
- **THEN** 系统文件管理器打开该任务的时间戳目录

## MODIFIED Requirements

### Requirement: 临时任务落点

原行为：新任务 cwd = `<生效根>/临时任务`（所有未选工作空间的任务共享一个目录）。

新行为：新任务 cwd = 自动分配的独立目录（见上）；`<生效根>/临时任务` 退役为
「历史共享目录」—— 既有会话仍归任务区、目录与文件原地保留，不再有新会话落入。

### Requirement: 导出与技能资源的根口径

原行为：导出目录与技能资源加载用内置默认根（`getWorkspaceDir()`，`~/KamiBuddy`）。

新行为：统一用生效根（`getEffectiveWorkspaceRoot()`），与「默认存储路径」设置项一致。

## REMOVED Requirements

无（`<根>/临时任务` 目录本身保留，仅停止作为新任务落点）。

## 明确不做

- **`<根>/Claw`**：WorkBuddy 用它承载「本地助理」窗口的复用会话，我们没有对应入口
  （侧栏「助理」尚未实现），不造这个空壳。
- **自动化任务目录改为 `<根>/automation-<时间戳>`**：我们的定时任务由用户显式选 cwd
  （产物落在指定工作空间，语义自洽），不照搬。
- **历史共享临时目录里的文件迁移**：多任务的产物混在一个目录里，无法干净归属；
  原地保留，用户自行整理。
- **目录名带任务标题**：WorkBuddy 是纯时间戳，标题是会话属性、不进目录名。
- **`<cwd>/.workbuddy/overview.md`**：用途未查明，不加。
- **改根后对旧目录的追溯迁移**：判定改成形态匹配后旧任务已能正确归类，不再需要迁移。
