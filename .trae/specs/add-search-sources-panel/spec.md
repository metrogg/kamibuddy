# 引用来源面板（搜索来源按钮 + 右侧来源列表）Spec

## Why

WorkBuddy 在任务完成后的操作行提供「来源」入口：点击后右侧栏弹出「引用来源 (N)」
面板，列出本轮调研用到的网页来源（favicon + 站点 + 标题 + 摘要），点击外部打开。
这是调研类任务可信度的关键 UI——用户能逐条核实模型的信息来源。我们目前
web_search 的结果只以文本形式进了工具卡 detail，没有任何来源聚合与展示。

## What Changes

- `web_search` 工具返回的 `details` 从 `{ count }` 扩充为 `{ count, results }`
  （结构化结果数组：title/url/description/publishedAt?），文本 content 不变。
- `ToolCard` 新增可选 `sources` 字段（`shared/session-events.ts` 导出 `SourceRef`
  类型：title/url/snippet?/site?）；session-host 在 web_search 的 tool_execution_end
  从 result.details 提取并做 URL 安全校验后填入；历史恢复（session-rebuild）
  从落盘的 tool result details 同路径重建。
- renderer 新增 `collect-sources.ts` 纯函数：扫描会话 entries 里的 web_search 卡，
  按 URL 去重（保留首次出现顺序）聚合来源清单。
- 对话页底部操作行（「查看所有产物/变更」同一行）新增「来源」按钮：
  favicon 头像组（最多 3 个、按站点去重、加载失败回退 Globe 图标）+ 「来源」文案
  （tooltip 含计数）；无来源时不渲染。
- 新增 SourcesPanel：复用右侧面板容器位（与 ArtifactPanel 互斥，App 层二选一渲染），
  头部「引用来源 (N)」+ 关闭按钮；列表项 = favicon + 站点名（12px 截断）+
  标题（14px/600 单行截断）+ 摘要（12px 两行截断）；点击项经主进程外部打开
  （与 Markdown 链接同一通道）；切换会话时自动关闭。
- **不做**（对齐 WorkBuddy 或明确取舍）：web_fetch 不计入来源（WorkBuddy 同口径）；
  favicon 不做本地缓存/不用 Google favicon 服务（用 `${origin}/favicon.ico` 回退 +
  Globe 兜底，WorkBuddy 内联卡同款回退）；面板开关状态不持久化（WorkBuddy 同）；
  按单条 assistant 消息分组的 per-message footer——v1 按会话聚合一行
  （与我们的产物/变更行粒度一致，WorkBuddy 是按 requestId 每轮一个 footer）。

## Impact

- Affected specs: 对齐清单 C4（联网）附近能力；新增 L26 行
- Affected code:
  - `src/extensions/web-tools.ts`（details 扩充）
  - `src/shared/session-events.ts`（SourceRef + ToolCard.sources）
  - `src/core/session-host.ts`、`src/core/session-rebuild.ts`（sources 填充两路径）
  - 新增 `src/renderer/collect-sources.ts`（+ 测试）
  - `src/renderer/chat-view.tsx`（来源按钮）、`src/renderer/App.tsx`（互斥渲染 + 外部打开）
  - 新增 `src/renderer/sources-panel.tsx`、`src/renderer/index.css`

## ADDED Requirements

### Requirement: web_search 结构化结果

`web_search` 工具 SHALL 在 `details` 中返回结构化结果数组
`{ count, results: [{ title, url, description, publishedAt? }] }`，
与文本 content 同源（一次搜索两种形态，不许两次请求）。

#### Scenario: 搜索返回结构化 details

- **WHEN** 模型调用 web_search 且服务商返回 5 条结果
- **THEN** details.results 含同样 5 条（title/url/description），文本 content 不变

### Requirement: ToolCard.sources 与安全校验

session-host SHALL 在 web_search 工具完成时从 result.details.results 提取来源填入
ToolCard.sources；每条 URL 必须通过安全校验：仅公网 http/https，
拒绝带凭据的 URL、localhost、内网 IP 段（WorkBuddy isSafeWebSearchSourceUrl 同口径）；
单项字段缺失（title/url 为空）时该项剔除。site 缺省时由 URL host（去 www. 前缀）推导。
历史恢复重建 SHALL 走同一提取逻辑（来源随会话回放还原，零新增持久化）。

#### Scenario: 正常提取

- **WHEN** web_search 完成且 details.results 含 5 条合法结果
- **THEN** 工具卡 sources 为 5 条，site 按 host 推导

#### Scenario: 脏数据防御

- **WHEN** results 中混入内网 IP URL 或缺 title 的项
- **THEN** 脏项剔除，其余正常填入，不抛错

#### Scenario: 历史恢复

- **WHEN** 切换到含 web_search 调用的历史会话
- **THEN** 重建的工具卡带 sources，「来源」按钮可用

### Requirement: 会话来源聚合

渲染层 SHALL 用纯函数从会话 entries 聚合来源：只取 web_search 卡的 sources，
按 URL 去重（key=url，保留首次出现顺序）。

#### Scenario: 多轮搜索去重

- **WHEN** 会话有 3 次 web_search（5+5+5 条，含 4 条重复 URL）
- **THEN** 聚合结果为 11 条，顺序为首次出现顺序

### Requirement: 「来源」按钮

对话页底部操作行（查看所有产物/变更所在行）SHALL 在有来源时显示「来源」按钮：
favicon 头像组（最多 3 个，按站点去重后取前 3，favicon 用 `${origin}/favicon.ico`，
加载失败回退 Globe 图标）+ 「来源」文案；tooltip/aria-label 含来源计数。
无来源时按钮不渲染。

#### Scenario: 有来源

- **WHEN** 会话聚合出 11 条来源（8 个不同站点）
- **THEN** 按钮显示 3 个头像 + 「来源」，tooltip 显示 11

### Requirement: 引用来源面板

点击「来源」SHALL 在右侧面板容器位打开引用来源面板（与 ArtifactPanel 互斥，
面板未展开时先展开）：头部「引用来源 (N)」+ 关闭按钮；列表每项 =
favicon（16px 圆形）+ 站点名 + 标题（单行截断）+ 摘要（两行截断，有才渲染）；
点击列表项经主进程白名单通道外部打开（window.open → openExternal）；
关闭按钮或切换会话时面板关闭。

#### Scenario: 打开面板

- **WHEN** 用户点击「来源」按钮
- **THEN** 右侧出现「引用来源 (11)」面板，列表项按聚合顺序排列

#### Scenario: 点击来源项

- **WHEN** 用户点击某来源项
- **THEN** 系统浏览器打开该 URL（应用内不导航）

#### Scenario: 切换会话

- **WHEN** 来源面板打开时切换到其他会话
- **THEN** 面板自动关闭（打开状态为会话内内存态）

## MODIFIED Requirements

无（纯新增能力；产物/变更所在操作行的出现条件扩展为「产物/变更/来源任一非空」。）

## REMOVED Requirements

无。
