# 图片输入（多模态）支持 Spec

## Why

KamiBuddy 目前全链路（UI → IPC → daemon → session-host → pi）只传纯文本，用户无法发送图片。对标产品 WorkBuddy 及 Claude Code / Codex CLI / Gemini CLI / Cursor 均已支持图片输入，且 pi harness 本身已**原生完整支持** `prompt(text, { images })`（SDK、消息存储、provider 序列化、非视觉模型自动降级全部就绪），KamiBuddy 只是没接上。接入成本主要在本项目自己的三层：renderer 输入 UI、`shared/` 契约、适配层透传。

### 调研结论摘要（2026-09-09，四路并行调研）

**1. KamiBuddy 现状：输入方向零链路，但地基已备**
- 输入框无 paste/drop 处理；附件按钮是 toast 占位（[chat-view.tsx](file:///d:/DongProject/kamibuddy/src/renderer/chat-view.tsx) 841-843 行）
- `PromptRequest` 只有 `text`（[ipc.ts](file:///d:/DongProject/kamibuddy/src/shared/ipc.ts) 191-199 行）
- `SessionHost.prompt` 不透传 options（[session-host.ts](file:///d:/DongProject/kamibuddy/src/core/session-host.ts) 386-398 行）
- 模型目录已有 `vision` 能力标识（model-catalog.ts:223、settings-view 可勾「看图」）
- 出方向（产物图片预览）反而完整
- **隐藏陷阱**：在线翻译的 `textOf`（session-host.ts:162-174）直接丢弃 image 块，而历史重建 `session-rebuild.ts` 显示 `[图片]` 占位——两端口径不一致

**2. pi 0.85.x：图片支持完整贯穿全栈，无需插件**
- `ImageContent = { type: "image", data: base64, mimeType }`（packages/ai/src/types.ts:354-358，无 URL 形式）
- `AgentSession.prompt(text, options?: PromptOptions)`，`PromptOptions.images?: ImageContent[]`；`steer(text, images?)` / `followUp(text, images?)` 同样支持
- 内置 `read` 工具原生返回图片（jpg/png/gif/webp/bmp，魔数检测）
- pi-ai 四大 provider API（Anthropic/OpenAI Completions/Responses/Google）图片序列化全覆盖
- **非视觉模型自动降级**：`downgradeUnsupportedImages` 把 image 块替换为占位文本，不会报错
- 图片预处理：归一化格式 + 自动缩放 2000×2000 / 4.5MB（CLI 路径；SDK prompt 路径是否缩放需实现时验证）
- 注意：pi 文档 docs/sdk.md:209 的 image 示例与实际类型不一致，以代码为准

**3. WorkBuddy（逆向调研素材，机制可学）**
- 图片走 **vision 直通**（Read 工具读图 + 模型 `supportsImages` 能力声明 + `imageHistoryRetainRounds` 保留轮次），OCR 不是通用路径
- 文档（PPT 等 26 种格式）走**本地编辑器引擎（editor_sdk.exe）+ MCP 工具按需读写**——重依赖路线（287MB 用户态），KamiBuddy 不照抄
- 调研素材中没有聊天输入框图片交互的 UI 证据，前端方案参考行业惯例即可

**4. 行业通用方案（各家收敛为同一结构）**
- 输入采集：粘贴 / 拖拽 / 上传按钮 / `@` 路径引用，`[Image #N]` 占位 chip 是通用 UX
- 编码红线：图片必须走 **image content block**，绝不许 base64 塞进 text
- 模型层：vision 主模型直通（主流）；text-only 主模型时「vision 子代理 + 路径占位 + 结论回流」（OpenCode 生态 / WorkBuddy Auto 路由 / vision-mcp-server 三方独立验证）
- 文档输入四条路径：短 PDF 直传 / 解析为 Markdown（规模化）/ 渲染为图再 vision（版式敏感）/ RAG 索引（知识库）
- 工程情报：`tool_result` 嵌套 image block 在第三方模型/网关下有大规模兼容事故（token 暴涨 250 倍）；**用户消息直传路径兼容性最好**——本 spec 走的正是这条

## What Changes

- `shared/`：`PromptRequest` 增加 `images?` 字段；`UserMessage` 事件增加 `images?` 字段；新增 `ImagePart` 类型（结构对齐 pi 的 `ImageContent`，但 shared 层自定义，不 import pi——依赖方向硬规则）
- `daemon/`：prompt 通道 handler 透传 images
- `core/`：`SessionHost.prompt()` 支持 images 并透传给 pi 的 `prompt/steer/followUp`；用户消息翻译时提取 image 块（修复 `textOf` 丢弃图片的陷阱）
- `core/`：`session-rebuild.ts` 历史重建时 image 块转为 `images` 字段（与在线口径统一）
- `renderer/`：chat-view 与 home-view 输入框支持**粘贴 / 拖拽 / 附件按钮（文件选择对话框）**三种入口；附件缩略图条（可删除）；用户消息气泡显示图片；非视觉模型附件提示
- 新增 IPC 通道：`pickImageFiles`（系统文件选择对话框，图片过滤器）

**明确不做（YAGNI，留待独立 spec）**：
- 文档输入（PPT/docx/pdf）——WorkBuddy 用本地编辑器引擎 + MCP 的重路线不适配我们的架构；正确路径是结合 `documents/` HTML 中间态做解析或导出器反向能力，需单独设计
- OCR、vision 子代理旁路（pi-ai 已有自动降级兜底，子代理模式等真实需求出现再做）
- 图片生成（出方向）
- 剪贴板图片的跨平台原生读取（Electron 渲染进程直接拿 clipboardData，无此问题）

## Impact

- Affected code:
  - [ipc.ts](file:///d:/DongProject/kamibuddy/src/shared/ipc.ts)（PromptRequest、新通道 pickImageFiles）
  - [session-events.ts](file:///d:/DongProject/kamibuddy/src/shared/session-events.ts)（UserMessage）
  - [daemon/index.ts](file:///d:/DongProject/kamibuddy/src/daemon/index.ts)（prompt handler、pickImageFiles handler）
  - [session-host.ts](file:///d:/DongProject/kamibuddy/src/core/session-host.ts)（prompt 透传、用户消息翻译）
  - [session-rebuild.ts](file:///d:/DongProject/kamibuddy/src/core/session-rebuild.ts)（image 块重建）
  - [chat-view.tsx](file:///d:/DongProject/kamibuddy/src/renderer/chat-view.tsx)、[home-view.tsx](file:///d:/DongProject/kamibuddy/src/renderer/home-view.tsx)（输入与展示）
  - main 侧文件选择对话框注册处（与 pickSkillDirectory 同层）
- 不触碰 `documents/`（无 HTML 流水线改动）
- 依赖方向不变：shared 依旧零 pi import；pi 类型只在 core 内出现（结构映射）

## ADDED Requirements

### Requirement: 图片附件输入

系统 SHALL 支持用户在聊天输入框通过粘贴（Ctrl+V）、拖拽、附件按钮（系统文件选择对话框）三种方式附加图片，随 prompt 一起发送给当前模型。

图片约束：
- 支持格式：png / jpeg / gif / webp
- 单张大小 ≤ 5MB（对齐行业惯例；超限 toast 报错并拒绝附加）
- 附加后输入框显示缩略图条，每张可单独删除；提交前不占用任何会话状态

#### Scenario: 粘贴截图
- **WHEN** 用户在输入框按 Ctrl+V 且剪贴板含图片数据
- **THEN** 输入框出现该图片缩略图；提交后消息以 `{ text, images }` 发送，模型收到 image content block

#### Scenario: 拖拽图片文件
- **WHEN** 用户拖拽一张 png 文件到输入框
- **THEN** 输入框显示拖拽悬停反馈，松手后图片进入缩略图条

#### Scenario: 附件按钮选择
- **WHEN** 用户点击附件按钮
- **THEN** 弹出系统文件选择对话框（过滤图片格式）；选中文件进入缩略图条

#### Scenario: 超限拒绝
- **WHEN** 附加的图片超过 5MB 或格式不在支持列表
- **THEN** toast 提示原因，图片不进入缩略图条

#### Scenario: 流式期间追加图片
- **WHEN** 会话流式进行中用户带图提交
- **THEN** 图片随 steer / followUp 语义透传（pi 的 steer/followUp 均接受 images）

### Requirement: 用户消息图片展示

系统 SHALL 在聊天历史（在线消息与重启后的会话重建）中以统一方式显示用户消息携带的图片（缩略图），两端口径一致。

#### Scenario: 在线发送
- **WHEN** 带图 prompt 提交
- **THEN** 用户消息气泡显示文本与图片缩略图

#### Scenario: 历史重建
- **WHEN** 重启后恢复含图片用户消息的会话
- **THEN** 该消息同样显示图片缩略图（不再只是 `[图片]` 文本占位）

### Requirement: 非视觉模型降级提示

系统 SHALL 在当前模型不具备 vision 能力且用户已附加图片时显示提示（「当前模型不支持看图，图片将以占位文本发送」）。实际降级由 pi-ai 的 `downgradeUnsupportedImages` 完成（image 块替换为占位文本），请求不会失败。

#### Scenario: 非视觉模型附加图片
- **WHEN** 当前模型 `vision` 标识为 false 且缩略图条非空
- **THEN** 输入框区域显示降级提示；提交不报错

## MODIFIED Requirements

### Requirement: PromptRequest IPC 契约
`PromptRequest` 扩展为：

```ts
export interface PromptRequest {
	readonly text: string;
	readonly whileStreaming?: "steer" | "followUp";
	readonly images?: readonly ImagePart[];
}
```

`ImagePart`（shared 层自有类型，结构对齐 pi 的 `ImageContent`，字段注释注明两者必须保持同步）：

```ts
export interface ImagePart {
	readonly type: "image";
	/** base64 编码（不含 data: 前缀） */
	readonly data: string;
	readonly mimeType: string;
}
```

### Requirement: UserMessage 事件
`UserMessage` 扩展 `images?: readonly ImagePart[]`（仅用于 UI 展示缩略图；文本仍走 `text` 字段）。

## REMOVED Requirements

（无——附件按钮原为 toast 占位，本次替换为真实功能）
