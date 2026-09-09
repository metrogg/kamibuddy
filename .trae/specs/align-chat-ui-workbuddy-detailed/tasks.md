# Tasks

## 批一 · P0 bug 修复 + P1 大矩形框

- [x] Task 1: 工具调用「挤没」bug 修复 + 消息流布局重构
  - [x] 1.1 index.css：`.entry.tool` 加 `flex-shrink: 0`（或 `.stream > *` 统一加）——止血
  - [x] 1.2 index.css：`.stream` 从 `display: flex; flex-direction: column; gap: 12px` 改为普通块流容器（`display: block`，间距改用 margin）——根除此类挤压
  - [x] 1.3 index.css：按块类型给不同外间距（user 前后 32px、turn 内紧凑、工具行小间距）；去掉 turn-header 的 `-4px` 反吃 hack
  - [x] 1.4 验证：工具调用执行中始终可见（不被挤没）
- [x] Task 2: 工具调用卡片形态对齐 WorkBuddy
  - [x] 2.1 chat-view.tsx ToolEntry：去掉通栏背景/左边框/圆角，改单行文本行（14px/1.75 三级灰 + 工具图标 + 状态字扫光 + 摘要省略 + chevron hover 浮现）
  - [x] 2.2 index.css：`.entry.tool` 样式重写（无背景、无边框、无圆角卡片；chevron 平时 opacity 0）
  - [x] 2.3 展开内容区：独立小圆角盒（radius 16px、max-height 300px、上下小 margin）——替换现直角 tool-detail
  - [x] 2.4 去掉整卡 2px outline 脉冲（border-ping），执行中指示简化为扫光文字 + 6px 状态点呼吸
- [x] Task 3: MetaFold 折叠行形态对齐
  - [x] 3.1 chat-view.tsx MetaFoldBlock：去背景/边框/width:100%，改 fit-content 纯文字行（主导工具图标 + 摘要 520px 省略 + 箭头 hover 浮现）
  - [x] 3.2 index.css：`.metafold-row` 样式重写（15px/1.75、三级灰、无背景、箭头 hover 浮现）
  - [x] 3.3 段首主导工具图标：metafold.ts 的 fold 块加 `leadIcon` 字段（按段内调用次数最多的工具名定图标——复用 WorkBuddy 的 computeTopToolName 思路）
- [x] Task 4: 用户气泡紧凑排版
  - [x] 4.1 index.css：`.user-bubble` padding `32px 16px` → `8px 12px`；把 32px 呼吸感挪到 `.entry.user` 的外间距（margin 上下 32px）
  - [x] 4.2 确认气泡 max-width/max-height 不变（70% / 310px）

## 批二 · P2 间距节奏 + P3 动效

- [x] Task 5: 折叠展开动画
  - [x] 5.1 index.css：工具详情/折叠单元的高度+opacity+translateY(-6px) 组合过渡（0.28s cubic-bezier(0.33,1,0.68,1)）——工具详情用 max-height 过渡，MetaFold 折叠体用 grid 0fr↔1fr（无上限等高效果）
  - [x] 5.2 reduced-motion 覆盖：tool-pulse/border-ping/task-spin 纳入 `prefers-reduced-motion`
- [x] Task 6: 消息进入动画 + 底部渐隐
  - [x] 6.1 index.css：消息流整列 hydration reveal（opacity 0 → 1 + transform 0.32s 带回弹 cubic-bezier(0.34,1.56,0.64,1)）
  - [x] 6.2 index.css：消息流底部渐隐 mask（linear-gradient mask）——改为 WorkBuddy 同款叠加层机制（absolute 钉底部 + data-visible 切 opacity），绕开滚动条被 mask 裁掉的问题

## 批三 · P4 图标体系 + P5 生成期上屏

- [x] Task 7: 工具类型图标映射
  - [x] 7.1 icons.tsx 新增工具类型图标：EyeIcon（Read）、PencilIcon（Write/Edit）、TerminalIcon（Bash）、SearchIcon（Glob/Grep）、GlobeIcon（WebFetch/WebSearch）、TrashIcon（DeleteFiles）、SparkleIcon（Skill）、CheckIcon（completion）、ClipboardIcon（plan）、SendIcon（Agent）、ImageIcon（图像生成）、GridIcon（ShowWidget）、DatabaseIcon（Supabase）、CloudIcon（CloudStudio）、DebugIcon（Debug）、LocationIcon（poi_query）
  - [x] 7.2 新建 `src/renderer/tool-icon-registry.ts`：工具名归一化（小写+去 `_-`）→ 精确表 → 前缀表 → 兜底 WrenchIcon；ReactElement 缓存
  - [x] 7.3 chat-view.tsx ToolEntry 接工具图标（14px）；执行中隐藏图标（状态靠扫光文字）；失败显示 FailedIcon
- [x] Task 8: 生成期卡片上屏
  - [x] 8.1 session-host.ts：tool_stream_started 的过滤条件从 `write/edit` 扩到 `web_search/web_fetch`（长耗时工具）

## 批四 · 验证

- [x] Task 9: 全量验证
  - [x] 9.1 `npm run typecheck && npm run check:deps && npm test` 全绿（45 文件 / 642 用例；验证子代理逐项通过）
  - [ ] 9.2 手测：工具调用执行中始终可见（不被挤没）、单行文本行形态、展开小圆角盒、折叠行 fit-content、用户气泡紧凑、折叠展开动画、消息进入动画、工具图标、生成期上屏（需用户执行）

# Task Dependencies
- Task 1 是 P0 必须先做（bug 修复 + 布局重构是后续样式的基础）
- Task 2/3/4 依赖 Task 1（布局稳定后改形态），可并行（不同元素）
- Task 5/6 依赖 Task 2/3（折叠展开动画需要新形态的元素）
- Task 7 依赖 Task 2（工具图标需要新形态的工具行）
- Task 8 独立（session-host 事件翻译）
- Task 9 依赖全部
