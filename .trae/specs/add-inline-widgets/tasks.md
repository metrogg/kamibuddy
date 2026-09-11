# Tasks

- [x] Task 1: 指南数据 + 双工具实现。撰写 `resources/visualizer/` 指南模块（core.md / colors.md / svg-setup.md / diagram.md / chart.md，**文案独立撰写**：机制对齐 WorkBuddy（680 管线、safe area、9 色系、字号三档、Chart.js UMD 模板），文字不抄 product 原文——合规红线）；实现 `extensions/visualizer-tools.ts`（read_me 按模块拼装指南返回；show_widget 硬校验 + title sanitize + render_mode 推断 + 结构化结果）；vitest 钉住：五类硬校验各自命中/放行、SVG viewBox 边界（680 错宽/多 svg/缺 viewBox）、title 规范化、loading_messages 三种入参形态、read_me 模块拼装与非法模块丢弃。（32 例全绿）
- [x] Task 2: 工具面接线。resources/modes/craft.md 与 ask.md 的 frontmatter 白名单加 read_me、show_widget（plan 不加，注释写明取舍）；permission-policy 登记两只读工具；daemon createHost 与 automation-runner 的扩展表注册 visualizer 扩展（子代理 runner 不注册，注释写明理由）。
- [x] Task 3: 流式与适配层。session-host：show_widget 加入 STREAM_CARD_TOOLS + 标签词汇 + restoredToolLabel；`ToolCard.streamArgs?` 与 `tool_stream_progress.rawArgs?` 两个可选契约字段（write 的行数口径不动）；session-rebuild 豁免 show_widget 的 4000 截断；metafold 豁免 show_widget 折叠。
- [x] Task 4: renderer widget 视图。新增 `widget-view.tsx`：sandbox iframe + srcDoc（CSP + CDN 白名单 + 预置设计 token CSS）+ postMessage 协议（ready/update 剥 script/finalize 保留并克隆执行/resize clamp [60,2000]/theme data-theme + 媒体查询兜底）；loading_messages 1.4s 轮播；错误视图（校验失败/内容缺失/中止半成品哑色）；取数 result 优先 args 兜底（手写部分 JSON 渐进提取）；标题栏（title + 复制代码 + 下载 .html）；chat-view 分流 show_widget 卡片；index.css 卡片样式（全用既有变量）。
- [x] Task 5: 验证与收尾。期间第四条并行工作线（implement-l23-ui-detail-switches）以陈旧基线整文件覆盖了 daemon/index.ts、App.tsx、sidebar.tsx、session-host.ts、session-host.test.ts、session-events.ts、bridge.ts、ipc.ts、preload、home-view.tsx（**当日第四次同类事故**）——已逐文件手术修复：纯陈旧文件回 HEAD + 重挂 visualizer 接线，session-host 系与契约层原位补回 thinking-level/子代理被删块，chat-view 属 L23 合法特性重构予以保留并补 ModelMenu 档位 props。终态：`npx tsc --noEmit` 0 错误、`npm run check:deps`（183 文件）、`npm test` 65 文件 1068 例全绿、smoke:session 14/14、smoke:permission 10/10；docs/workbuddy对齐清单.md C6 行更新为 ✅（注明 v1 范围）。

# Task Dependencies

- Task 2/3 依赖 Task 1（工具存在才能接线）；Task 4 依赖 Task 3（契约与数据通道）；Task 5 最后。
- Task 1 与 Task 4 的 iframe 协议设计可并行起步（约定 postMessage 消息名后即解耦）；Task 2 与 Task 3 可并行。
