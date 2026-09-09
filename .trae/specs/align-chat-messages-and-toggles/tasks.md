# Tasks

- [x] Task 1: assistant 消息去气泡（核心修复）
  - [x] 1.1 `src/renderer/index.css`：删掉 `.entry.assistant` 的气泡背景与圆角（1156-1159 的 background 与继承的 border-radius）；assistant 排版改为 padding 0、字号 14px、行高 20px
  - [x] 1.2 确认 turn-header 与 assistant 消息正文的左缘对齐（去气泡后 margin 保持 14px 或微调）

- [x] Task 2: 头部面板开关（产物面板 + 侧栏）
  - [x] 2.1 App.tsx：产物面板展开/收起状态（与 previewActive 解耦——收起是"隐藏面板但保留 tab 状态"，不是清空 tab）；侧栏展开/收起状态
  - [x] 2.2 chat-view.tsx：chat-header 右侧加两个常态图标按钮（产物面板开关、侧栏开关），点击回调 App 状态
  - [x] 2.3 App.tsx：产物面板收起时完全不渲染 ArtifactPanel；侧栏收起时不渲染 Sidebar
  - [x] 2.4 index.css：两个开关按钮样式（常态可见、激活态区分）

- [x] Task 3: 回归验证
  - [x] 3.1 `npm run typecheck && npm run check:deps && npm test` 通过
  - [ ] 3.2 冒烟：assistant 无气泡、用户气泡保持、产物面板开关、侧栏开关均正常（需人工 dev 验证）

# Task Dependencies

- Task 1 独立（只改 index.css assistant 区块）
- Task 2 的 2.2/2.3 依赖 2.1（状态先行）；与 Task 1 文件交集小（index.css assistant vs chat-view/App），可并行
- Task 3 依赖 Task 1-2 全部完成
