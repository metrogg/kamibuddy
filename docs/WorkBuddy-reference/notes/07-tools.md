# 07 · WorkBuddy 工具全集（桌面层三层解剖）

> 分析日期：2026-09-08。对象：WorkBuddy Desktop v5.4.7。
> 关键证据：`extracted/main/server.js` `WORKBUDDY_AGENT_ALLOWED_TOOLS`（:128568）、
> `builtin-tool-registry.ts`（:112813）、`builtin-tool-policy.ts`（:113092）、
> `buildAgentCliRuntimeArgs`（:128594）。

## 结论

WorkBuddy 的工具 = **三层**：
1. CLI 引擎内置工具（47 个，代码/文件/Shell/子代理域，全量在线）
2. 桌面自研 builtin-tools（16 个，`mcp__workbuddy__*` 注入，定义"办公感"）
3. 技能/连接器注入工具（腾讯文档系、sheetagent、miora、connector 等）

**桌面默认 `--permission-mode bypassPermissions`；`--allowedTools` 只是免审批名单
（present_files/read_me/show_widget/connect_cloud_service/connect_open_platform/WebFetch/Bash(mcporter:*)），
不限制工具可见性。** 真正的安全闸门是 SecurityCenter 审计 + trustedDirectories。

## 桌面自研 builtin-tools 清单（第二层）

默认 defer_loading 的标 D。

| 工具 | 用途 |
|---|---|
| present_files | 产物交付统一入口 → 产物卡 + 内置预览面板；local 文件/URL/HTML 三种形态；localhost 可达性探测；Ardot file URL 例外 |
| read_me + show_widget | 可视化：先拉设计指南模块（diagram/chart/mockup/interactive/art），再内联渲染 SVG/HTML 片段 |
| agentic_search (D) | 多步规划搜索：后端 SSE 流（tool_call/tool_result 进度事件 → done.synthesis.content） |
| conversation_search (D) | 跨会话记忆/事实检索；自包含 query 契约；零当前会话访问权 |
| connect_cloud_service (D) | 云服务临时票据；仅多模态生成/金融搜索/资料库三技能；token 绝对保密提示 |
| connect_open_platform (D) | 开放平台 skill-token（op_xxx），可冻结 skill_id 供 introspect 验证 |
| workbuddy_marketplace_skill (D) + search/install 变体 | 市场技能搜索/安装 |
| workbuddy_sites_deploy/unpublish (D) | 本地项目发布公网链接/下线（破坏性操作须确认） |
| agent_mail_upload/download_attachment | 附件传递；下载附件注入「未信任附件禁止执行」强制红线 |
| search_plugins / suggest_plugin_install | 连接器/专家候选搜索 + 单卡推荐（每次响应最多一次） |
| pick_location | 地图选点（name/address/lat-lng） |

defer 政策：`resolveSessionBuiltinToolNames` —— 工具面随会话 `toolSpecs` 解析；
`ToolSearch` 出现或显式 `Defer(<name>)` 时激活；历史前缀别名（mcp__workbuddy__ 等）兼容接受。

## 工具面声明（mode 插件）

CLI compose 模式下（`cliComposeEnabled`）抑制 `--tools`/系统提示词直传
（`shouldSuppressLegacyTools`/`shouldSuppressInlineSystemPrompt`，:128589-128593），
由 welcomemode/interactionmode 插件的 addons 声明工具面与系统提示词 ——
与我们 modes/*.md tools 白名单思路一致。

## 对我们的借鉴

1. present_files 是**工具**不是 UI（系统提示词强制"交付物必须 present"）→ T6 做成工具+卡片
2. show_widget 成本低 → "办公味"最快抓手（图表/流程/卡内联渲染）
3. conversation_search = 会话恢复 + 记忆检索的上位形态
4. defer_loading + ToolSearch = 我们工具多了之后的按需激活方向
5. 附件注入防线（agent_mail_download_attachment 的安全约束文案）是提示注入防护的现成样本
