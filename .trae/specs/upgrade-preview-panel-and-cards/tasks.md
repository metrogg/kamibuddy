# Tasks

- [x] Task 1: 预览面板可拖拽调宽 + 全屏（核心）
  - [x] 1.1 App.tsx：面板宽度状态（默认 440px）+ 全屏状态；面板从固定 42% 改为 px 宽度
  - [x] 1.2 App.tsx / artifact-panel.tsx：sash 拖拽手柄（左缘 4px，mousedown/mousemove/mouseup，clamp [340, 800]px，拖拽时 body cursor/user-select）
  - [x] 1.3 artifact-panel.tsx：头部加全屏/退出全屏按钮；全屏时 absolute 覆盖主内容区；Esc 退出；240ms ease 过渡（prefers-reduced-motion 禁用）
  - [x] 1.4 index.css：面板宽度/拖拽手柄/全屏覆盖/过渡样式

- [x] Task 2: 产物卡两列网格 + 聚合入口
  - [x] 2.1 chat-view.tsx：产物卡区改两列网格（单产物独占一行）；HTML 卡右上 🌐 预览按钮（开面板不触发整卡点击）
  - [x] 2.2 chat-view.tsx：卡区下方「查看所有产物 (N)」「查看所有变更 (N)」文字按钮 → 打开面板并展开概览菜单对应分组（App.tsx 联动）
  - [x] 2.3 index.css：产物卡网格/聚合入口/🌐按钮样式（圆角 8px、hover、13px 字号）

- [x] Task 3: 消息流细节对齐
  - [x] 3.1 index.css：用户气泡 padding 8px 12px、字号 13px、行高 19px（max-width 保持 calc(100% - 32px)）
  - [x] 3.2 确认 assistant 消息无气泡（现状确认，不改动）
  - [x] 3.3 用户气泡 hover 工具条位置微调（气泡下方 4px）

- [x] Task 4: 回归验证
  - [x] 4.1 `npm run typecheck && npm run check:deps && npm test` 通过
  - [ ] 4.2 冒烟：产物卡两列网格、🌐 按钮开面板、聚合入口、面板拖拽调宽、全屏切换、Esc 退出（需人工 dev 验证）

# Task Dependencies

- Task 1 的 1.2/1.3 依赖 1.1（状态先行）
- Task 2 的 2.2 依赖 2.1（同一卡区）；与 Task 1 文件交集小（chat-view vs App/artifact-panel），可并行
- Task 3 独立（只改 index.css 用户气泡区块），可并行
- Task 4 依赖 Task 1-3 全部完成
