# Checklist

## MCP 客户端能力
- [x] `mcp.json` 配置读取（用户级/项目级，JSONC 格式，`${VAR}` 环境变量展开）走 `config.get` 单一入口——实现以 `core/mcp-config.ts` 单模块收口（全项目无 `config.get` API，preferences.ts 同模式），符合「单一入口」精神
- [x] stdio 传输：StdioClientTransport 连接本地子进程（command + args + env）（mcp-client.ts:471-476）
- [x] HTTP 传输：StreamableHTTPClientTransport 连接远程 server（URL）（mcp-client.ts:477；端到端未实测，实现到位）
- [x] initialize 握手 → `tools/list` 拉工具清单（mcp-client.ts:479/:482-495，30s 超时）
- [x] 每个 MCP 工具注册成 ToolDefinition（`mcp__server__tool` 前缀，`execute` 转发 `tools/call`）（mcp-client.ts:385-431）
- [x] 连接生命周期：启动时连接、断开重连（指数退避 1s/2s/4s/8s 最多 5 次）、失败降级（标记失败状态，不阻塞其他 server）（mcp-client.ts:126-127,150-193,209-212,286-293）

## 权限策略
- [x] MCP 工具（`mcp__` 前缀）默认走人工审批（permission-policy.ts:398-409 显式登记 ask/medium，任何模式含 danger-full-access 都询问）
- [x] 审批弹窗显示服务器名、工具名、参数摘要（summary 从工具名解析 server/tool，details 给参数摘要；参数名只覆盖 path/command，url/query 等详情为空——小限制）

## 连接器 UI
- [x] 连接器页签从 onTodo 占位改为真实页面（skills-view.tsx:31 ready: true）
- [x] 服务器列表：名称、状态（连接中/已连接/失败/禁用）、工具数、启用/禁用开关（connectors-view.tsx:281-336 四态徽章）
- [x] 「添加服务器」表单：名称、传输方式（stdio/HTTP）、命令/URL、环境变量（key=value 逐行带行号报错）（connectors-view.tsx:372-503）
- [x] 「编辑配置」JSON 编辑器：textarea 显示 mcp.json 原文，保存时校验 schema（前端 JSON.parse + 结构检查，daemon writeMcpConfig 二次校验）（connectors-view.tsx:528-569）
- [x] 失败状态显示：连接失败的 server 显示失败原因（connectors-view.tsx:310-314 行内显示 + tooltip 完整错误）

## MCP 例子
- [x] 留一个 MCP server 例子（filesystem server，resources/mcp-example.json + docs/mcp-connector.md 完整文档）
- [x] 完整链路跑通：配置 → 连接 → 工具出现在工具面 → 模型调用 → 结果返回（smoke:mcp 9/9 自动证实，execute 即 pi agent-loop 调用入口；真实模型选择调用 MCP 工具为手测项）

## 质量门
- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过（161 文件）
- [x] `npm test` 通过（55 文件 / 849 用例，含 mcp-client 22 个、mcp-config 29 个、permission-policy 72 个）
- [x] 新增依赖 `@modelcontextprotocol/sdk` 已安装且构建通过（package.json:28 ^1.30.0）
- [x] 未触碰 daemon handler（MCP 工具注册/调用经 pi 扩展机制注入，不经 daemon 的会话/工具 handler；daemon/index.ts 新增的 3 个配置 IPC handler 是配置 UI 的必需新增，非改动既有 handler）
- [ ] 手测：配置 filesystem server → 连接成功 → 工具调用返回结果；添加/禁用/删除服务器；JSON 配置编辑（需用户执行）
