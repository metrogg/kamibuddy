# MCP 连接器支持 Spec

## Why

KamiBuddy 目前无 MCP（Model Context Protocol）支持，「连接器」是 onTodo 占位。WorkBuddy 的「连接器」是 MCP 的产品化形态（MCP server 的市场分发 + 授权管理 + 启用开关 + UI），协议层走标准 MCP。pi 刻意不内置 MCP，但 `ExtensionAPI.registerTool` 就是为桥接准备的——用 `@modelcontextprotocol/sdk` + pi 的扩展机制自己桥一个 MCP 客户端扩展，UI 落在技能页的连接器页签。

## What Changes

### 阶段一（本 spec）：MCP 客户端能力打通 + 一个例子

- **协议层**：引入 `@modelcontextprotocol/sdk`（官方 TS SDK，覆盖 stdio + HTTP 双传输、initialize/tools/list/tools/call 全流程）
- **桥接层**：新建 `src/extensions/mcp-client.ts`（pi 扩展）：
  - 读 `mcp.json` 配置（用户级 `~/.kamibuddy/mcp.json` 或项目级 `<工作区>/.mcp.json`，JSONC 格式支持 `${VAR}` 环境变量展开——对齐 WorkBuddy 的配置机制）
  - 建 Client 连接（stdio 本地子进程 / HTTP 远程 server）
  - `tools/list` 拉工具清单 → 每个 MCP 工具注册成 `ToolDefinition`（名字带 `mcp__server__tool` 前缀，`execute` 里转发 `tools/call`）
  - 连接生命周期管理（启动时连接、断开重连、失败降级）
- **配置层**：`mcp.json` 的读写走 `config.get` 单一入口（AGENTS.md 第五节），不许直接 `readFileSync`——配置合并：内置默认 → 本地文件 → （预留）云端下发
- **UI 层**：`skills-view.tsx` 的连接器页签（现在是 onTodo 占位）改为真实页面：
  - MCP 服务器列表（名称、状态、工具数）
  - 启用/禁用开关
  - JSON 配置编辑器（textarea，保存时校验 schema）
  - 「添加服务器」按钮（表单：名称、传输方式 stdio/HTTP、命令/URL、环境变量）
- **权限层**：MCP 工具落地后在权限策略里登记（`permission-policy.ts:377` 已预留「未登记工具交给人判断」策略位——MCP 工具默认走人工审批，安全）
- **例子**：留一个 MCP server 当例子（比如 `filesystem` server 或 `fetch` server，官方 SDK 的 examples 里有）——用户能跑通「配置 → 连接 → 工具出现在工具面 → 模型调用 → 结果返回」的完整链路

### 明确不做（YAGNI，留后续）

- **市场分发**（WorkBuddy 的连接器市场）：腾讯云端能力，第一期不做
- **授权/token 注入**（设备码 OAuth、HTTP header 透传）：腾讯文档系的重依赖，第一期只做「本地 stdio + 远程 HTTP 的通用 MCP 客户端 + 手动 JSON 配置」
- **MCP Prompts**（服务器提供的 prompts 注册为斜杠命令）：WorkBuddy 有，KamiBuddy 第一期只做 tools
- **大工具量优化**（`defer_loading: true` + ToolSearch 按需激活）：WorkBuddy 有，KamiBuddy 第一期工具量小，不做

## Impact

- Affected code:
  - [package.json](file:///d:/DongProject/kamibuddy/package.json)（新增 `@modelcontextprotocol/sdk`）
  - [src/extensions/mcp-client.ts](file:///d:/DongProject/kamibuddy/src/extensions/mcp-client.ts)（新建，MCP 客户端扩展）
  - [src/extensions/permission-policy.ts](file:///d:/DongProject/kamibuddy/src/extensions/permission-policy.ts)（MCP 工具权限策略登记）
  - [src/renderer/skills-view.tsx](file:///d:/DongProject/kamibuddy/src/renderer/skills-view.tsx)（连接器页签真实页面）
  - [src/shared/ipc.ts](file:///d:/DongProject/kamibuddy/src/shared/ipc.ts)（MCP 配置读写的 IPC 通道）
  - [src/core/config.ts](file:///d:/DongProject/kamibuddy/src/core/config.ts)（mcp.json 配置读写，走 config.get 单一入口）
  - [src/core/session-host.ts](file:///d:/DongProject/kamibuddy/src/core/session-host.ts)（加载 MCP 扩展）
- 不触碰 daemon handler（MCP 客户端在 core/extensions 层，pi 扩展机制直接注册工具）

## ADDED Requirements

### Requirement: MCP 客户端连接

系统 SHALL 支持通过 `mcp.json` 配置连接 MCP server（stdio 本地子进程 / HTTP 远程 server），并将 MCP 工具暴露给模型。

#### Scenario: stdio 连接
- **WHEN** 用户在 `mcp.json` 配置 `{"mcpServers": {"filesystem": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]}}}`
- **THEN** 启动时连接该 server，`tools/list` 拉取工具清单，每个工具注册为 `mcp__filesystem__<tool>`，模型可调用

#### Scenario: HTTP 连接
- **WHEN** 用户在 `mcp.json` 配置 `{"mcpServers": {"remote": {"url": "http://localhost:3000/mcp"}}}`
- **THEN** 启动时连接该 server（Streamable HTTP 传输），工具注册同 stdio

#### Scenario: 连接失败
- **WHEN** MCP server 连接失败（命令不存在 / URL 不可达）
- **THEN** 标记该 server 为「失败」状态，不阻塞其他 server；UI 显示失败原因；模型调用该 server 的工具时返回错误信息

### Requirement: MCP 工具权限

系统 SHALL 将 MCP 工具纳入权限门管理，默认走人工审批。

#### Scenario: MCP 工具调用审批
- **WHEN** 模型调用 `mcp__<server>__<tool>` 工具
- **THEN** 权限门弹出审批（显示服务器名、工具名、参数摘要），用户批准后才执行

### Requirement: 连接器 UI

系统 SHALL 在技能页的连接器页签提供 MCP 服务器管理界面。

#### Scenario: 服务器列表
- **WHEN** 用户打开连接器页签
- **THEN** 显示已配置的 MCP 服务器列表（名称、状态、工具数、启用/禁用开关）

#### Scenario: 添加服务器
- **WHEN** 用户点击「添加服务器」
- **THEN** 显示表单（名称、传输方式 stdio/HTTP、命令/URL、环境变量），保存后写入 `mcp.json` 并连接

#### Scenario: JSON 配置编辑
- **WHEN** 用户点击「编辑配置」
- **THEN** 显示 `mcp.json` 的 JSON 编辑器（textarea），保存时校验 schema（必须是 `{"mcpServers": {...}}` 结构）

### Requirement: MCP 例子

系统 SHALL 提供一个可跑通的 MCP server 例子（如 filesystem server），用户能验证完整链路。

#### Scenario: 例子跑通
- **WHEN** 用户按文档配置 filesystem server
- **THEN** 工具出现在工具面（`mcp__filesystem__read_file` 等），模型可调用并返回结果

## MODIFIED Requirements

### Requirement: 连接器页签
原实现：`skills-view.tsx` 的连接器页签是 onTodo 占位（ready: false）。
修改为：真实页面（MCP 服务器列表 + 启用/禁用 + JSON 配置编辑 + 添加服务器）。

## REMOVED Requirements

（无）
