/**
 * 本地 stdio MCP server（冒烟夹具）：一个 `echo` 工具，回显输入文本。
 *
 * 为什么不用官方 filesystem server + npx：npx 首次拉包要联网（内网实测
 * registry PING 50s+，smoke:mcp 就这样握手超时）。本脚本用仓库自带的
 * @modelcontextprotocol/sdk（低层 Server 类，不依赖 zod 的 registerTool
 * 便捷层），stdio 传输、零网络，让「MCP 工具激活」的端到端冒烟在任何
 * 网络环境都能跑。
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "echo", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: [
		{
			name: "echo",
			description: "原样返回输入文本（冒烟夹具）",
			inputSchema: {
				type: "object",
				properties: { text: { type: "string", description: "要回显的文本" } },
				required: ["text"],
			},
		},
	],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const text = String(request.params.arguments?.text ?? "");
	return { content: [{ type: "text", text: `echo:${text}` }] };
});

await server.connect(new StdioServerTransport());
