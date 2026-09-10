# MCP 连接器

KamiBuddy 通过 MCP（Model Context Protocol）接入外部工具。本文是连接器的
使用与配置说明；实现细节看源码注释（`src/extensions/mcp-client.ts`、
`src/core/mcp-config.ts`、`src/extensions/permission-policy.ts`）。

## 是什么

MCP 是 Anthropic 牵头的开放协议，把「模型 ↔ 外部工具/数据源」标准化：
server 暴露工具清单（`tools/list`）与调用入口（`tools/call`），client 连接后
转发调用。传输有两种：本地 stdio（server 作为子进程跑）与远程 HTTP
（Streamable HTTP）。

WorkBuddy 的「连接器」就是 MCP 的产品化形态——协议层走标准 MCP，上面叠了
市场分发、授权管理与 UI。KamiBuddy 第一期只做协议层：**通用 MCP 客户端 +
手动 JSON 配置**，UI 落在「技能 → 连接器」页签。

实现是一个 pi 扩展（pi 刻意不内置 MCP，但 `ExtensionAPI.registerTool` 就是为
桥接准备的）：建会话时读 `mcp.json`，并行连接所有 server，把每个 MCP 工具
注册成 pi 工具，名字带 `mcp__<server>__<tool>` 前缀（如
`mcp__filesystem__read_text_file`）。模型看到的、调用的就是这些普通工具，
协议细节对模型透明。

## 配置：mcp.json

两级配置文件，合并生效（同名 server 项目级覆盖用户级）：

| 层级   | 位置                       | 作用域       |
| ------ | -------------------------- | ------------ |
| 用户级 | `~/.kamibuddy/mcp.json`    | 所有工作区   |
| 项目级 | `<工作区根>/.mcp.json`     | 仅该工作区   |

格式是 **JSONC**（允许注释与尾逗号，与 VS Code 的 mcp.json 惯例一致，从那边
抄过来的配置可直接用）。基本结构：

```jsonc
{
	"mcpServers": {
		// stdio：本地子进程
		"filesystem": {
			"command": "npx",
			"args": ["-y", "@modelcontextprotocol/server-filesystem", "D:\\docs"],
			"env": { "SOME_VAR": "value" }   // 可选，追加给子进程的环境变量
		},
		// HTTP：远程 server（Streamable HTTP）
		"remote": {
			"url": "http://localhost:3000/mcp"
		},
		// 保留配置但暂停连接
		"paused": {
			"command": "npx",
			"args": ["-y", "some-mcp-server"],
			"disabled": true
		}
	}
}
```

规则：

- `command`（stdio）与 `url`（HTTP）二选一，同时给会报错。
- **环境变量展开**：任何字符串值里的 `${VAR}` 会展开为同名环境变量——凭据
  不落明文，只引用环境变量。引用了未设置的变量会在加载时**响亮报错**
  （而不是替换成空串让 server 死在更远的「认证失败」上）。
- 文件不存在 = 没配置（正常）；文件坏了（语法错、结构不符）= 会话日志报错，
  本会话不加载 MCP 工具，**不阻塞会话**。修好保存后热生效。

编辑途径：

1. **UI**：「技能 → 连接器」页——服务器列表（状态/工具数/启停开关）、
   「添加服务器」表单、「编辑配置」JSON 编辑器（保存时校验，坏配置拒写）。
   保存即热应用，不必重启会话。
2. **直接改文件**：改完到连接器页点一下保存/启停触发热应用，或重启会话。

连接行为：建会话时并行连接（一个 server 挂起或失败不阻塞其他）；握手超时
30 秒；断线后指数退避重连（1s → 8s，最多 5 次后放弃，重启会话可再试）。

## 例子：filesystem server

官方参考实现 `@modelcontextprotocol/server-filesystem`，把本机目录暴露成
一组文件工具。仓库里留了可直接复制的示例配置
[`resources/mcp-example.json`](../resources/mcp-example.json)：

```jsonc
{
	"mcpServers": {
		"filesystem": {
			"command": "npx",
			"args": ["-y", "@modelcontextprotocol/server-filesystem", "D:\\DongProject\\kamibuddy"]
		}
	}
}
```

最后的参数是允许 AI 访问的目录（可给多个），**改成你自己的目录**。
首次运行 npx 会联网下载 server 包（之后走本地缓存），第一次连接较慢属正常。

filesystem server（2026.8.31 版）注册的工具包括：
`read_text_file`（`read_file` 是其 deprecated 别名）、`read_media_file`、
`read_multiple_files`、`write_file`、`edit_file`、`create_directory`、
`list_directory`、`list_directory_with_sizes`、`directory_tree`、`move_file`、
`search_files`、`get_file_info`、`list_allowed_directories`。
在工具面里它们叫 `mcp__filesystem__read_text_file` 等。

### 验证完整链路

**自动验证**（配置 → 连接 → 工具出现在工具面 → 调用 → 返回结果）：

```
npm run smoke:mcp
```

脚本在临时目录里造一份 mcp.json（含 JSONC 注释与 `${VAR}` 展开）与一个
fixture 目录，真实连接 filesystem server，断言工具注册进工具面后模拟模型
调用读文件、校验返回内容；另配一个必失败的 server 验证「失败降级不阻塞
其他 server」。全程在临时目录下，结束即清理，不碰真实配置。

**手动验证**（含真实模型调用）：

1. 把示例配置复制到 `~/.kamibuddy/mcp.json`（目录改成自己的）。
2. 打开「技能 → 连接器」，应看到 `filesystem` 状态为「已连接」、工具数 > 0。
3. 新建任务，对模型说：「读一下 <允许目录> 里的某个文件」。
4. 模型调用 `mcp__filesystem__read_text_file` 时弹出审批（见下节），批准后
   工具卡片显示文件内容。

## 权限策略

MCP 工具（`mcp__` 前缀）**默认走人工审批**：弹窗显示服务器名、工具名与
参数摘要，批准后才执行。两个有意的保守选择：

- **任何权限模式下都询问**（含「允许完全访问」）：能力面由外部 server 定义，
  读/写/联网从工具名上无从区分，与 shell 一样保持 fail-closed。
- **「只读」模式下一律拒绝**：无法证明一个 MCP 工具不改状态。

凭据路径拦截先于 MCP 分支生效：filesystem 这类 server 的 `path` 参数指的
就是本机文件，`mcp__filesystem__read_text_file` 去读 `~/.ssh/id_rsa` 这类
受保护目录会在审批之前直接拒掉（任何模式都不放行）。

## 已知限制（第一期）

刻意不做（spec 的 YAGNI 清单，留待后续）：

- **市场分发**：WorkBuddy 的连接器市场是云端能力，第一期只做手动 JSON 配置。
- **授权 / token 注入**：设备码 OAuth、HTTP header 透传凭据——需要凭据的
  server 目前走 `env` + `${VAR}` 环境变量。
- **MCP Prompts**：server 提供的 prompts 注册为斜杠命令，第一期只做 tools。
- **大工具量优化**：`defer_loading` + ToolSearch 按需激活，第一期工具量小。

实现层面的既有取舍：

- server 的工具清单在**重连后**有增删时，要下个会话才反映（已注册的工具
  不会因重连而换清单）。
- 从配置里**删除**的 server：连接会断开，但已注册的工具撤不掉（pi 没有
  unregisterTool）——再被调用会报「未连接：已从配置移除」，下个会话消失。
- stdio server 经 npx 首次冷启动要下载包，可能超过 30 秒握手超时——第二次
  起走缓存即正常。
