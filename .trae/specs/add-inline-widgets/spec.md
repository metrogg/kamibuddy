# 内联可视化（read_me + show_widget）Spec

## Why

对齐清单 C6（第二梯队首位）：WorkBuddy 的图表/示意图是以 SVG/HTML 片段**内联渲染在
消息流里**的（`read_me` 拉设计指南 + `show_widget` 吐片段），这是「办公味」最快的
抓手，且直接增强报告类产出。我们当前模型只能输出文字/代码块/文件，无法内联出图。

## What Changes

- **两个新工具**（`extensions/visualizer-tools.ts`）：
  - `read_me`：入参 modules（v1 仅 `diagram` | `chart`），返回对应设计指南全文
    （指南是数据不是代码：`resources/visualizer/*.md`，AGENTS.md §3；**文案独立撰写，
    机制照 WorkBuddy、文字不抄**，合规红线 §6）。
  - `show_widget`：入参 title / widget_code / loading_messages（1-4 条），
    硬校验后返回结构化结果 `{ type: "visualizer_show_widget_result", success, title,
    widget_code, loading_messages, render_mode: "svg"|"html" }`（render_mode 由内容
    是否 `<svg` 开头推断，无类型枚举）。
- **硬校验**（失败返回 success:false + 中文错误文案，模型自纠）：禁
  `<!DOCTYPE/html/head/body`；禁 `localStorage|sessionStorage`；禁 `position:fixed`
  （高度靠文档流自适应）；禁 `<form>`；SVG 必须恰好一个 `<svg>` 且 viewBox 匹配
  `0 0 680 <H>`（680 是固定坐标管线，配合 width=100% 自适应）；title 规范化
  （Unicode 字母数字+下划线，兜底 widget）。
- **工具面**：craft / ask 两模式白名单各加 read_me、show_widget（零代码，改
  resources/modes frontmatter）；权限门登记只读工具（不触文件系统，questionnaire
  同口径）；用户会话与定时任务 run 会话都注册真实工具（无用户交互、无副作用，
  run 会话的 widget 随历史可见）；子代理会话不注册（输出只回传文本，widget 无处渲染）。
- **流式卡片**：show_widget 加入 session-host 的 STREAM_CARD_TOOLS（参数生成期即上屏，
  widget_code 在 args 里逐步累积）。
- **渲染**（renderer 新增 `widget-view.tsx`）：show_widget 的工具卡不走通用卡片，
  渲染为内联 widget 块——`sandbox="allow-scripts"` iframe + srcDoc
  （CSP：default-src 'none' + CDN 白名单 cdnjs/esm.sh/jsdelivr/unpkg）+ postMessage
  双向协议（update 流式期剥 script / finalize 完成期保留 / ready / resize 高度自适应
  上限 2000px / theme 注入明暗变量）；loading_messages 1.4s 轮播；校验失败与缺失
  内容有错误视图；取数 result 优先、args 兜底（流式期 result 未返回也能渲染）。
  主题注入至少实现 prefers-color-scheme 媒体查询一路。
- **标题栏**：title + 复制代码（剪贴板）+ 下载 `{title}.html`。
- **落盘**：不建独立存储——工具结果随会话 JSONL 持久化，历史视图（session-rebuild）
  走同一条转换管线重放。

**v1 明确不做**：mockup/interactive/art 三模块、ERD mermaid、D3 地图、截图另存 PNG、
local-file 图片改写、Markdown 围栏兜底通道、iframe 5s 超时 HTML fallback、
sendPrompt 沙箱内追问、heightCache、widget 展开到右侧面板（WorkBuddy 本来就没有）。

## Impact

- Affected specs: C6（对齐清单）；关联 upgrade-preview-panel-and-cards（消息流卡片体系）
- Affected code: `extensions/visualizer-tools.ts`（新）、`resources/visualizer/*.md`（新）、
  `resources/modes/craft.md`、`resources/modes/ask.md`、`extensions/permission-policy.ts`、
  `core/session-host.ts`、`daemon/index.ts`、`daemon/automation-runner.ts`、
  `renderer/widget-view.tsx`（新）、`renderer/chat-view.tsx`、`renderer/index.css`、
  `shared/session-events.ts`（widget 块契约如需）

## ADDED Requirements

### Requirement: show_widget 内联渲染

The system SHALL 将 show_widget 工具调用渲染为消息流中的内联可视化块：
SVG 片段与 HTML 片段都在沙箱 iframe（`sandbox="allow-scripts"` + CSP default-src 'none'
+ CDN 白名单）中渲染，高度随内容自适应（ResizeObserver 上报，上限 2000px），
主题（明/暗）变化时 iframe 内同步。chart 类 HTML 片段中的脚本（Chart.js CDN）
在完成后正常执行。

#### Scenario: 模型生成图表

- **WHEN** 模型调用 show_widget 提交一段 chart HTML（含 cdnjs Chart.js 脚本）
- **THEN** 消息流出现标题为 title 的卡片，iframe 内图表正常渲染且高度自适应；
  切换明暗主题后图表配色跟随

#### Scenario: 校验失败可自纠

- **WHEN** 模型提交的 widget_code 含 `<form>` 或 SVG viewBox 不是 `0 0 680 <H>`
- **THEN** 工具返回 success:false 与中文错误原因（作为工具错误回给模型），
  消息流显示错误视图而不是渲染失败内容

### Requirement: read_me 设计指南

The system SHALL 提供 read_me 工具：按模块返回设计指南全文（core+colors 恒含，
diagram 追加 SVG 管线规则，chart 追加 Chart.js 规则），指南内容来自
resources/visualizer/ 下的 md 文件；工具描述指引模型首次 show_widget 前调用、
且不要向用户叙述这次调用。

#### Scenario: 首次出图前加载指南

- **WHEN** 模型准备生成第一个 widget，调用 read_me(modules:["chart"])
- **THEN** 返回 core + colors + chart 三段指南拼装文本；后续 show_widget 的
  viewBox/配色/字号与该指南一致

### Requirement: 流式与历史一致体验

The system SHALL 在 show_widget 参数流式生成期间即上屏卡片（loading_messages 轮播 +
部分 widget_code 渐进渲染，流式期剥离 script）；会话历史恢复后 widget 块按同一
转换管线完整重放（内容来自落盘的工具记录，无独立存储）。

#### Scenario: 恢复历史会话

- **WHEN** 用户恢复一个含 show_widget 记录的历史会话
- **THEN** 该 widget 块在消息流原位完整渲染（script 可执行），与实时产出形态一致
