# 侧栏「任务 × 空间」关系重构 Spec

## Why

当前侧栏把所有会话平铺在「任务」一栏，「空间」栏是 onTodo 死按钮——
任务与空间的归属关系没有表达出来。用户实测 WorkBuddy 后指出五点差距
（分组归属、折叠展开、空间下新建、空间菜单、任务状态指示），要求对齐。

**WorkBuddy 机制（已从 app.asar 内 locale 与 bundle 取证）**：
- 侧栏分区：`置顶任务 / 任务 / 空间`；任务栏默认显示前几条 +「查看更多(N)」；
  空间按工作空间分组、可折叠（含「折叠/展开所有工作空间」）、组级「新建任务/新建工作空间」
- 空间菜单：打开文件夹 / 重命名（**仅改显示名，不动真实目录**；校验：非空/非法字符/255/同级重名/保留名）/
  从列表移除（确认后**该空间任务一并删除**）
- 临时任务（未选空间）自动落默认存储路径（`workspaceStorage`），可「保存到工作空间」转正
- 任务执行中转圈、完成未查看显示未读点

## What Changes

- **侧栏重构为两区**：
  - **任务区**：playground 会话（`isPlayground=true`）。按修改时间倒序，默认显示前 5 条 +
    「查看更多 (N)」展开全部。
  - **空间区**：工作空间会话**按 cwd 分组**。组 = 空间（名称 + 任务计数 + 折叠箭头），
    组内任务按修改时间倒序；组可折叠/展开（折叠状态会话内存即可）。
- **组级操作**：
  - 「+」新建任务：切首页工作空间选择到该 cwd（复用 `setWorkspace`）并新建任务（复用 `newTask`）。
  - 「⋯」菜单：**打开文件夹**（新通道 `workspace:reveal`，main `shell.openPath`，
    daemon 校验目标是已知工作空间）、**重命名**（仅显示名覆盖，存 `workspaces.json`，
    校验同 WorkBuddy：非空/非法字符/255/同级重名/保留名——**不动真实目录**）、
    **从列表移除**（行内二次确认后，该 cwd 全部会话文件移入 `~/.kamibuddy/trash/`（复用现有
    trash 机制，可反悔），显示名覆盖一并清除；空间目录本身不动）。
- **任务状态指示**：当前会话流式中该行显示转圈（单 daemon 单会话，同时只有一个 run）；
  run 完成且用户未查看该任务 → 未读绿点（点击该任务后清除；内存态，重启清零）。
- **分组纯逻辑**（`renderer/session-groups.ts` + 测试）：playground/空间分桶、
  组名解析（显示名覆盖 ?? 目录 basename）、组内排序、组间排序（按组内最近任务）。

**与 WorkBuddy 的有意差异（写清理由）**：
- playground 语义**不变**（无文件工具是安全设计，不学它「临时任务自动落默认目录」）；
- 「从列表移除」不真删（它删除且无法恢复）——走我们已有的 trash 可反悔机制；
- playground 任务「保存到工作空间」流程（它的 `workspace.keep.*`）涉及文件迁移，仍留作未来项。

## Impact

- Affected specs: 会话管理（侧栏组织方式）、工作空间
- Affected code:
  - `src/shared/ipc.ts` + `bridge.ts` + `preload/index.ts`（workspace:groups / rename / remove / reveal 四通道 + WorkspaceGroupMeta 类型）
  - `src/core/workspace-registry.ts`（**新**：workspaces.json 读写 + 显示名校验纯函数 + 测试）
  - `src/daemon/index.ts`（四个 handler；remove 复用 trash 移动逻辑）
  - `src/main/index.ts`（reveal 的 shell.openPath，带 daemon 侧路径校验）
  - `src/renderer/session-groups.ts`（**新**）+ 测试、`src/renderer/sidebar.tsx`（两区重构）、
    `src/renderer/App.tsx`（unread 状态、空间操作回调）、`src/renderer/index.css`

## ADDED Requirements

### Requirement: 任务区（playground 会话）

系统 SHALL 在侧栏「任务」区仅显示 playground 会话，按修改时间倒序；
超过 5 条时默认显示前 5 条并提供「查看更多 (N)」入口展开全部（N = 剩余条数）。

#### Scenario: 分组归属正确
- **WHEN** 存在 3 个 playground 会话与 2 个工作空间会话
- **THEN** 任务区显示 3 条（playground），2 个工作空间会话不出现在任务区

### Requirement: 空间区（按工作空间分组）

系统 SHALL 把工作空间会话按 cwd 分组成空间组：组头显示空间名
（显示名覆盖 ?? 目录 basename）+ 任务计数 + 折叠箭头；组内任务按修改时间倒序；
组可折叠/展开；组间按「组内最近任务时间」倒序。
工作空间目录下没有会话时不形成组（磁盘真相：组由会话文件派生）。

#### Scenario: 同空间任务归组
- **WHEN** 两个会话的 cwd 都是 `D:\projects\online-store`
- **THEN** 它们归在同一个「online-store」组下，可折叠/展开

### Requirement: 空间下新建任务

系统 SHALL 在空间组头提供「+」入口：点击后把当前工作空间切到该组 cwd
（复用 setWorkspace 全部守卫）并新建任务，回到首页且首页「选择工作空间」显示该空间。

#### Scenario: 在空间下开新任务
- **WHEN** 用户点「online-store」组的「+」
- **THEN** 首页工作空间 chip 显示 online-store，且处于新任务状态

### Requirement: 空间菜单

系统 SHALL 在空间组头提供「⋯」菜单，含三项：
1. **打开文件夹**：`shell.openPath(cwd)`（daemon 校验该路径是当前已知工作空间 cwd 之一，防任意路径）；
2. **重命名**：仅设置显示名（写 `workspaces.json`），真实目录不变；
   校验：非空、不含 `\\/:*?"<>|`、≤255 字符、同级不重名、非保留名（CON/PRN/AUX/NUL/COM1-9/LPT1-9）；
3. **从列表移除**：行内二次确认后，该 cwd 的全部会话文件移入 `~/.kamibuddy/trash/`
   （时间戳前缀防同名），显示名覆盖清除；目录本身不删除。

#### Scenario: 重命名只改显示名
- **WHEN** 用户把 `D:\projects\online-store` 组重命名为「商城项目」
- **THEN** 组头显示「商城项目」，磁盘目录名不变；重启后显示名仍在

#### Scenario: 移除可反悔
- **WHEN** 用户移除某空间并确认
- **THEN** 该组从侧栏消失，其会话文件全部在 trash 中（可人工找回）

### Requirement: 任务状态指示

系统 SHALL 在任务行显示两种状态：
- **执行中**：该行为当前会话且 `isStreaming` → 行内转圈（spinner）；
- **未读**：某任务 run 结束时用户未在查看它（不在对话页、或不是当前会话）→ 绿点；
  点击该任务（恢复/查看）后清除。未读集合为渲染进程内存态（重启清零）。

#### Scenario: 完成后提醒
- **WHEN** 任务 A 在后台完成而用户停留在首页
- **THEN** A 所在行显示绿点；点击 A 后绿点消失

## MODIFIED Requirements

### Requirement: 侧栏「任务」区数据口径

原行为：全部会话平铺一栏（含工作空间会话）。
新行为：任务区仅 playground 会话；工作空间会话移入空间区分组（见上）。
**迁移**：纯展示层重组，无数据迁移；会话文件与恢复逻辑不变。

## REMOVED Requirements

### Requirement: 侧栏「空间」占位入口

**Reason**：空间区从 onTodo 占位升级为真实功能。
**Migration**：无。

## 明确不做（本变更范围外）

- **置顶任务**（WorkBuddy 的 conversation.section.pinned）：用户未提，分组稳定后再说。
- **任务搜索/筛选**（它的 conversation.search.*）：同理留后续。
- **「保存到工作空间」**（playground 任务转正，它的 workspace.keep.*）：涉及会话文件迁移
  （cwd 终身绑定是我们的会话模型，转正 = 移动会话文件目录归属 + 换 cwd 重建），单独开 spec。
- ** playground 语义变更**（自动落默认目录）：安全设计不变。
- **多任务并行执行**（它多 worker 各自转圈）：单 daemon 单会话架构，执行中指示只覆盖当前会话。
- 空间组的「折叠/展开所有」按钮与折叠状态持久化：组少时无意义，内存态折叠已够。
