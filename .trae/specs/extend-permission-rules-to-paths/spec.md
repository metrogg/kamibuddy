# 权限规则扩展到路径工具 Spec

## Why

一期规则引擎只覆盖 powershell。文件工具（read/ls/find/grep）的区外读仍只能
「工作区内放行 / 区外低风险问一次」，没有「这个目录我信任、以后别问」的表达力——
用户读自己任务容器目录（如 `C:\Users\wzd\KamiBuddy\`，所有工作区的父级）
每个新会话第一次都要点一次允许。把同一个规则引擎扩到路径工具即可解决。

## What Changes

- **路径规则**（`permission-rules.ts` 扩）：规则 `{ tool: "read", prefix: 绝对路径,
  action }` 对本地只读工具家族（read / read_document / find / grep / ls）生效；
  匹配用语义化路径包含（isInside：prefix 目录下的所有子孙路径命中，Windows
  大小写不敏感，与 policy 现有 isInside 一致）；「read」匹配整个只读家族
  （不逐工具名区分——它们语义相同）
- **判定链接线**（`permission-policy.ts` 阶段 2 只读分支）：
  - deny 规则最先查（先于「工作区内放行」——最严获胜：用户明示禁读的目录，
    就算在工作区内也拒）
  - allow 规则在「区外低风险询问」之前查：命中 → 免问放行
  - 不越过阶段 1 凭据禁区（规则阶段仍在它之后，`.ssh` 等写 allow 也放不进）
- **弹窗写回**：区外读的低风险弹窗新增「以后都允许读取此路径（及子目录）」
  checkbox → 写回 `{tool:"read", prefix:目标路径, action:"allow"}`；
  目标在凭据目录/配置目录内时不显示（写了也是死规则）
- **明确不做**：write/edit 的路径规则（保留现有「工具+路径归属」会话记住）；
  web_fetch 域名规则；规则编辑 UI；「read」家族之外的工具别名

## Impact

- Affected specs: 对齐清单 H3（规则语法剩余部分）
- Affected code:
  - `src/extensions/permission-rules.ts`（`evaluatePathRules` 纯函数）+ 测试
  - `src/extensions/permission-policy.ts`（阶段 2 接线）+ 测试
  - `src/extensions/permission-gate.ts` / `src/daemon/index.ts`（写回复用既有
    rememberPrefix 通道，校验放宽为按工具分流：powershell 走首词校验、read 走路径校验）
  - `src/renderer/permission-dialog.tsx`（区外读弹窗的写回 checkbox）

## ADDED Requirements

### Requirement: 路径前缀规则判定

系统 SHALL 支持 `tool: "read"` 的路径前缀规则：prefix 为绝对路径，命中语义为
「目标路径等于 prefix 或位于 prefix 目录之下」（Windows 大小写不敏感）。
deny 规则先于工作区放行判定（最严获胜）；allow 规则在区外询问前判定（命中免问）。
规则不越过阶段 1 凭据禁区。

#### Scenario: 容器目录免问

- **WHEN** 规则含 `{tool:"read", prefix:"C:\\Users\\wzd\\KamiBuddy", action:"allow"}`，
  模型 ls `C:\Users\wzd\KamiBuddy`
- **THEN** 区外读不弹窗直接放行

#### Scenario: deny 最严获胜

- **WHEN** 规则含 `{tool:"read", prefix:"<workspace>\\secrets", action:"deny"}`，
  模型 read 工作区内 secrets 下文件
- **THEN** 直接拒绝（即使在工作区内）

#### Scenario: 凭据目录不可被规则放行

- **WHEN** 规则含 `{tool:"read", prefix:"C:\\Users\\wzd\\.ssh", action:"allow"}`，
  模型 read `.ssh` 下文件
- **THEN** 仍被阶段 1 拒绝（规则阶段在其后，无法越过）

### Requirement: 区外读弹窗写回

区外读的低风险弹窗 SHALL 提供「以后都允许读取此路径（及子目录）」选项
（目标位于凭据目录或应用配置目录内时不提供）；勾选并允许后 daemon 将
read allow 规则落盘且即刻生效。既有「本次会话内不再询问」选项不变。

#### Scenario: 写回生效

- **WHEN** 模型 ls 区外目录，用户勾选写回并允许
- **THEN** 本次放行；规则文件新增 read allow；后续读该目录树免弹窗

## MODIFIED Requirements

### Requirement: 规则引擎工具覆盖面

原「规则仅对 powershell 生效」扩为「powershell（命令前缀）+ read 家族（路径前缀）」。

## REMOVED Requirements

无。
