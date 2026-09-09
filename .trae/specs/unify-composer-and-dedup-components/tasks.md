# Tasks

## 主体 · 串行（同一文件的连锁改动）

- [x] Task 1: 抽取统一 Composer 组件 + chat-view 接入
  - [x] 1.1 新增 `src/renderer/composer.tsx`：内置 draft 状态、useImageAttachments /
    useAutocomplete / useImeGuard 接线、DocumentRefStrip + AttachmentStrip + VisionHint、
    拖放高亮、标准 keydown 链（ac → IME → 可选 Alt 历史 → 流式 Esc 停止确认 → Enter）、
    提交逻辑（trim、字数闸双闸、foldDocumentRefsIntoText、成功清附件 + recordSent +
    清草稿）、bar 固定尾部（字数余量 + send/stop，内置 stop-confirm 状态机）；
    props：ready / placeholder / rows / cwd / modelId / onSubmit / onError /
    draftKey? / enableHistory? / streaming?；bar 左组 children 注入
    （实现补充：导出 ComposerHandle ref 暴露 pickFiles，供 PlusMenu.onPickFiles 触发内部附件选择）
  - [x] 1.2 chat-view.tsx：composer 区块（含 submit、handleComposerKeyDown、停止确认
    state/effect、历史/草稿接线）替换为 `<Composer>`；chat 专有行为全部经 props 传入
    （draftKey=sessionId、enableHistory、streaming、左组=PlusMenu+PermissionMenu+
    ModelMenu+Mic+ContextUsageRing）；删除被内化的死代码与不再使用的 import
  - [x] 1.3 验证：`npm run typecheck && npm run check:deps && npx vitest run src/renderer`
    （chat 相关测试不回归）

- [ ] Task 2: home-view 接入 Composer + 首页「+」修复
  - [ ] 2.1 App.tsx：HomeView 补传 availableModes / interactionId / onInteractionChange
    （与传 ChatView 的同源）
  - [ ] 2.2 home-view.tsx：手写 composer 区块替换为 `<Composer>`（不开 draftKey/
    enableHistory/streaming；左组=PlusMenu+ModelMenu+Mic）；PlusMenu 复用
    `src/renderer/plus-menu.tsx`；删除被内化的死代码（submit/keydown/hook 接线/
    不再使用的 import）
  - [ ] 2.3 验证：`npm run typecheck && npm run check:deps && npx vitest run src/renderer`

## 去重 · 可与 Task 1/2 并行（只动 index.css 与各自小组件，需避开 composer 区块类名）

- [x] Task 3: 工具条 CSS 合并 + 菜单容器公共类
  - [x] 3.1 `.user-toolbar/.user-copy` 与 `.assistant-toolbar/.assistant-copy` 相同规则
    合并为共享类（.entry-toolbar + 左右修饰类 + .entry-icon-btn）；
    chat-view.tsx 中对应类名同步（机械改名，未碰 composer 区块）
  - [x] 3.2 核查 `.model-menu` / `.permission-menu` / `.plus-menu` / `.mode-menu` 容器规则，
    相同部分抽公共类 .pop-menu；逐项对照视觉不变（底色/边框/圆角/阴影/层级）
  - [x] 3.3 验证：`npm run typecheck && npm run check:deps`

## 收尾

- [ ] Task 4: 渲染层重复审计 + 全量验证 + 文档
  - [ ] 4.1 审 settings-view / skills-view / diagnostics-view / sidebar / artifact-panel /
    permission-dialog / toast：列重复清单；只合并「逻辑相同、无各自演进方向」的项
    （如完全相同的空态/节标题/加载态结构）；存疑项不合并
  - [ ] 4.2 `npm run typecheck && npm run check:deps && npm test` 全绿
  - [ ] 4.3 `docs/STATUS.md`：新增专节（Composer 统一 + 去重 + 审计结论含「已知重复、
    暂不合并」清单）与「等你验证」冒烟项

# Task Dependencies

- Task 2 依赖 Task 1（Composer 组件先存在并通过 chat 验证）
- Task 3 与 Task 1/2 可并行：3.1 只许动 chat-view 的工具条类名（assistant/user 区块），
  与 Task 1 的 composer 区块不重叠；index.css 两方追加/修改不同样式块
- Task 4 依赖 Task 1-3 完成（审计以最新代码为准）
