# Tasks

## 批一 · 协议层 + 桥接层（核心能力）

- [x] Task 1: 引入 @modelcontextprotocol/sdk + MCP 客户端扩展骨架
  - [x] 1.1 package.json 加 `@modelcontextprotocol/sdk`（官方 TS SDK）
  - [x] 1.2 新建 `src/extensions/mcp-client.ts`：pi 扩展骨架（ExtensionAPI 的 setup/teardown 生命周期）
  - [x] 1.3 配置读取：读 `mcp.json`（用户级 `~/.kamibuddy/mcp.json` 或项目级 `<工作区>/.mcp.json`，JSONC 格式，支持 `${VAR}` 环境变量展开）——走 `config.get` 单一入口，不直接 readFileSync
- [x] Task 2: MCP Client 连接 + 工具注册
  - [x] 2.1 stdio 传输：StdioClientTransport（本地子进程，command + args + env）
  - [x] 2.2 HTTP 传输：StreamableHTTPClientTransport（远程 server，URL）
  - [x] 2.3 initialize 握手（协商 protocolVersion + capabilities）→ `tools/list` 拉工具清单
  - [x] 2.4 每个 MCP 工具注册成 ToolDefinition（`mcp__server__tool` 前缀，`execute` 里转发 `tools/call`，参数 schema 用 MCP 的 inputSchema）
  - [x] 2.5 连接生命周期：启动时连接、断开重连（指数退避）、失败降级（标记失败状态，不阻塞其他 server）
- [x] Task 3: 权限策略登记
  - [x] 3.1 permission-policy.ts：MCP 工具（`mcp__` 前缀）默认走人工审批（利用现有「未登记工具交给人判断」策略位）
  - [x] 3.2 审批弹窗显示服务器名、工具名、参数摘要（复用现有权限弹窗组件）

## 批二 · 配置层 + UI 层

- [x] Task 4: 配置读写 IPC 通道
  - [x] 4.1 shared/ipc.ts：MCP 配置读写的 IPC 通道（`mcpConfigGet` / `mcpConfigSet` / `mcpServerToggle`）
  - [x] 4.2 core/config.ts：`mcp.json` 的读写实现（JSONC 解析、`${VAR}` 展开、schema 校验）
  - [x] 4.3 daemon handler：MCP 配置读写的 handler（返回配置快照给 renderer）
- [x] Task 5: 连接器 UI 页面
  - [x] 5.1 skills-view.tsx 连接器页签从 onTodo 占位改为真实页面
  - [x] 5.2 服务器列表：名称、状态（连接中/已连接/失败）、工具数、启用/禁用开关
  - [x] 5.3 「添加服务器」表单：名称、传输方式（stdio/HTTP）、命令/URL、环境变量（key=value 行编辑）
  - [x] 5.4 「编辑配置」JSON 编辑器：textarea 显示 mcp.json 原文，保存时校验 schema（必须是 `{"mcpServers": {...}}` 结构）
  - [x] 5.5 失败状态显示：连接失败的 server 显示失败原因（红字）

## 批三 · 例子 + 验证

- [x] Task 6: MCP 例子 + 文档
  - [x] 6.1 留一个 MCP server 例子（filesystem server 或 fetch server，官方 SDK 的 examples 里有）——写到 docs/ 或 resources/ 下的示例配置
  - [x] 6.2 验证完整链路：配置 → 连接 → 工具出现在工具面 → 模型调用 → 结果返回
- [x] Task 7: 全量验证
  - [x] 7.1 `npm run typecheck && npm run check:deps && npm test && npm run smoke:mcp` 全绿（55 文件 / 849 用例；smoke 9/9）
  - [ ] 7.2 手测：配置 filesystem server → 连接成功 → 工具出现在工具面 → 模型调用 `mcp__filesystem__read_file` → 返回结果；添加/禁用/删除服务器；JSON 配置编辑（需用户执行）

# Task Dependencies
- Task 2 依赖 Task 1（扩展骨架先行）
- Task 3 依赖 Task 2（工具注册后登记权限）
- Task 4/5 依赖 Task 2（配置读写和 UI 需要连接能力）
- Task 6 依赖 Task 5（例子需要 UI 配置）
- Task 7 依赖全部
- 批一与批二可并行（Task 1/2/3 与 Task 4/5 文件交集小），但 Task 2 内部建议串行（连接生命周期复杂）
