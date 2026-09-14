# 权限规则引擎与批准写回（沙箱一期）Spec

## Why

shell 命令在默认档下每条都弹窗（高风险从不提供「记住」——UI 不给、gate 双保险拒），
且没有任何跨会话的递减机制。Codex/Claude Code 的答案是**三态前缀规则 +
批准写回**：用户批一次「git」开头的命令，规则持久落盘，此后同类免问；
`a && b` 逐段判定防「允许了 git status 却把 `git status && rm -rf` 放过去」。
这是完整沙箱施工图的第一期（纯 TS，不动 OS 层）。

## What Changes

- **规则引擎**（新增 `src/extensions/permission-rules.ts`，纯函数）：
  - 三态规则 `{ tool, prefix, action: "allow" | "deny" }`（ask 态不需要写规则——
    默认就是 ask）；匹配语义：命令段以 prefix 开头且 prefix 后紧跟空白或结尾
    （`git` 命中 `git status`，不命中 `gitx`）
  - **命令拆分**：按未加引号的 `&&`、`||`、`;` 切段（不切 `|`——PowerShell
    管道是单条数据流，切了会碎掉正常命令）；每段独立判定，
    **最严获胜**（任一段 deny → 整体 deny；全部段 allow → 整体 allow；否则 ask）
  - 规则文件解析：`~/.kamibuddy/permissions.rules.json`（version + rules 数组），
    坏文件/坏行降级忽略并记 daemon 日志（用户数据不阻断权限判定）
- **判定链接线**（`permission-policy.ts`）：powershell 在阶段 3（read-only 拒）之后、
  阶段 4 兜底询问之前插入规则阶段：全部段 allow → 放行（免弹窗）；任一段 deny →
  拒绝带原因；无命中 → 维持现状高风险询问。规则不越过：阶段 1 凭据禁区、
  read-only 档、danger-full-access 档原有行为；**危险命令检查器独立运行不受规则
  影响**（iex 类照样拦，规则放行 ≠ 检查器放行）
- **批准写回**：powershell 审批弹窗新增「以后都允许「{首词}」开头的命令」选项
  （单段命令才提供；首词为解释器/包装器——powershell/pwsh/cmd/iex/python/node/
  bash/sh/wsl 及其 -c/-e/EncodedCommand 形态——不提供）；选中后 daemon 把
  `{ tool: "powershell", prefix: 首词, action: "allow" }` 追加进规则文件并即刻生效
  （下次同类免问）。既有「本次会话记住」（低/中风险、工具+路径归属）行为不变
- **明确不做**：规则编辑 UI（v1 文件可手改）；path 工具的规则（已有路径归属记住）；
  ask 态规则；`|` 管道拆分；OS 沙箱（二期）

## Impact

- Affected specs: 对齐清单 H3（规则语法）
- Affected code:
  - 新增 `src/extensions/permission-rules.ts`（+ 测试）
  - 新增 `src/core/permission-rules-store.ts`（configDir JSON 读写，+ 测试）
  - `src/extensions/permission-policy.ts`（规则阶段）、`permission-gate.ts`（规则透传）
  - `src/daemon/index.ts`（store 装配 + 写回处理）、`src/shared/ipc.ts`（审批响应载荷）
  - `src/renderer/permission-dialog.tsx`（powershell 的写回选项）

## ADDED Requirements

### Requirement: 三态前缀规则判定

系统 SHALL 从 `~/.kamibuddy/permissions.rules.json` 加载规则（坏文件降级为空规则集，
不阻断判定）。powershell 命令按未加引号的 `&&`/`||`/`;` 切段后逐段做前缀匹配
（prefix 后须为空白或结尾）：任一段命中 deny → 整体拒绝并说明；全部段命中 allow →
整体放行；否则维持原判定。

#### Scenario: allow 前缀免弹窗

- **WHEN** 规则含 `{tool:"powershell", prefix:"git", action:"allow"}`，模型执行
  `git status --short`
- **THEN** 默认档下不弹窗直接执行

#### Scenario: 拆分后最严获胜

- **WHEN** 规则含 git allow，模型执行 `git status && rm -rf ./dist`
- **THEN** 第一段命中 allow，第二段无命中 → 整体按高风险询问（不被 git 规则放行）

#### Scenario: deny 直拒

- **WHEN** 规则含 `{tool:"powershell", prefix:"Remove-Item", action:"deny"}`，
  模型执行 `Remove-Item ./a`
- **THEN** 直接拒绝并把原因回给模型（不弹窗）

#### Scenario: 模式约束不被规则越过

- **WHEN** 存在 git allow 规则，当前为只读档
- **THEN** powershell 仍被拒（规则阶段在 read-only 拒绝之后）

### Requirement: 批准写回

powershell 审批弹窗对**单段**命令 SHALL 提供「以后都允许「{首词}」开头的命令」选项
（首词为解释器/包装器前缀时不提供）。选中并允许后，daemon SHALL 将 allow 规则
追加到规则文件且即刻生效。

#### Scenario: 写回生效

- **WHEN** 模型执行 `git log --oneline`，用户在弹窗选「以后都允许「git」开头的命令」
- **THEN** 本次执行放行；规则文件新增 git allow；后续 `git diff` 等 git 命令免弹窗

#### Scenario: 解释器前缀不写回

- **WHEN** 命令为 `python -c "..."` 或 `iex (...)`
- **THEN** 弹窗不提供写回选项（只有允许一次/拒绝）

## MODIFIED Requirements

### Requirement: shell 高风险永不记住

原「高风险操作不提供记住选项」细化为：不提供会话级记住，但 powershell 提供
持久前缀规则写回（本 spec 新增），二者作用域与持久性不同。

## REMOVED Requirements

无。
