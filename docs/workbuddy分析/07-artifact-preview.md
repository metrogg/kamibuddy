# 07 · 产物预览机制（含变更跟踪与工作区文件可见性）

> 调研对象：WorkBuddy 安装目录解包（`_analysis/extracted/`）+ 三张实测截图（贪吃蛇任务）。
> 本文是 KamiBuddy T6 产物预览的规格书。机制可学，文字与代码必须自己写（AGENTS.md §6）。

## 截图里看到的三个子系统

### 1. 变更跟踪（`创建 <path> +276 -0`、`查看所有变更 (1)`）

- 聊天流里，写文件的工具行直接挂在消息流中，带**绝对路径**和**增删行数徽章**（`+276 -0`）。
- run 结束后消息底部有「查看所有变更 (1)」聚合入口。
- 行数的来源：WorkBuddy 的 CLI 内核在写文件工具返回里带 diff 统计
  （它有 checkpoint/fileChanges 机制，`colleague-chat-page` 里 `checkpoint.fileChanges.files`）。

### 2. 产物卡片与交付（`snake.html 7.3 KB`、`查看所有产物 (1)`）

- 助手消息底部出现产物卡片：文件名、大小、预览（眼睛）与打开图标。
- **显式交付协议**：产物不是「猜模型写了哪些文件」，而是 CLI 的 `present_files` 工具调用——
  模型完成任务后显式调用它把文件递交给 UI（`browser-*.js`：「sandbox 内的 media artifact
  都来自 agent-cli 的 present_files 工具调用」）。这是唯一的交付入口。
- 主提示词会教模型何时调用 present_files（任务完成、产出可用文件时）。

### 3. 右侧预览面板（DetailPanel）

- 布局：右半屏，顶部 tab（`snake.html ×` `+`），tab 左侧有「概览」下拉列出全部产物，
  右上角 pin（固定面板）、外部打开、关闭。
- **HTML 是活预览**：贪吃蛇游戏在面板里真实运行（Canvas 在跑、localStorage 可用）——
  不是静态源码展示。
- 格式渲染矩阵：Office / PDF / markdown / code / HTML 各有渲染器，HTML 走沙箱 webview。
- 沙箱四层（各自独立）：Electron webview 沙箱、本地静态服务（127.0.0.1）、
  云端 iframe、共享 web 版。本地 HTML 预览 = webview + 本地静态服务。

## 七层协作模型（机制总结）

```
1. 产物生成    写文件工具（write/edit）落地文件，CLI 记录 diff 统计
2. 产物索引    present_files / checkpoint.fileChanges 登记产物清单
3. 显式交付    present_files 是唯一交付入口，UI 不猜、不扫目录
4. 预览面板    右侧统一 tabbed DetailPanel，概览下拉做产物导航
5. 渲染矩阵    按扩展名分发渲染器；HTML 给运行时，文本给只读
6. 沙箱安全    webview 隔离 + 本地静态服务（loopback）+ 路径白名单
7. 导出下载    外部打开 / 另存为（我们已有 openArtifact / saveArtifactAs）
```

## KamiBuddy 的映射（与 WorkBuddy 的有意差异）

| 层 | WorkBuddy | KamiBuddy v1 | 差异理由 |
| -- | --------- | ------------ | -------- |
| 变更统计 | CLI 内核算 diff | session-host 从 write/edit 工具 args 算（content 行数、edits 的 oldText/newText 行数差） | pi 的工具事件带完整 args（`tool_execution_start.args`），自己算即可，零成本 |
| 交付 | present_files 显式递交 | **从工具卡片推导**（write 成功 = 产物） | pi 没有 present_files；让模型多调一个工具不如直接推导可靠。将来要显式交付时可加同名技能 |
| 面板 | 右侧 tab + 概览下拉 | 右侧面板：产物索引 + 工作区文件树 + 单文件预览 | v1 不做多 tab，单文件 + 列表导航已覆盖截图场景 |
| HTML 渲染 | webview + 本地静态服务 | **iframe + daemon 内静态服务**（127.0.0.1，根=工作区） | 同一思路；daemon 知道 workspaceDir，main 不用参与。sandbox 属性给脚本隔离 |
| 文本渲染 | 各自渲染器 | readArtifact IPC 读文本（限大小、拒二进制），`<pre>` 只读 | v1 只分两类：HTML 活预览 / 其余文本只读 / 不支持走外部打开 |
| 文件可见性 | 资料库等 | 面板「文件」页列出工作区全部文件（复用 file-index） | 截图之外用户明确要求「知道当前项目文件夹有什么」 |

### 安全红线（不可妥协）

- 静态服务只绑 `127.0.0.1`；根目录固定为当前工作区；URL 路径 resolve 后必须在根内（防 `../` 穿越）。
- iframe `sandbox="allow-scripts allow-same-origin"`：与 renderer 不同源（127.0.0.1:port），
  拿不到我们的 localStorage/IPC；不加 allow-top-navigation。
- CSP 的 frame-src 只放行 `http://127.0.0.1:*`。
- playground（无工作区）不起静态服务、文件树为空——没有目录就没有可预览的东西。
