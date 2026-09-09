# Tasks

## 波一 · 并行（不同文件，零冲突）

- [x] Task 1: 代码块卡片化（markdown.tsx + index.css，独立文件）
  - [x] 1.1 react-markdown 自定义 `pre` 组件：圆角卡片容器 + 头部（语言名取自 code 节点
    `language-xxx` className，缺省显示「text」；右侧复制按钮）+ body 60vh 限高内部滚动
  - [x] 1.2 复制节奏复用 chat-view 的 useCopyWithTick（若该 hook 位置不便复用，上移到
    独立文件供两处 import）；复制内容为代码纯文本，成功对勾 2s
  - [x] 1.3 语言名提取抽纯函数（className → 显示名），补 vitest 用例
  - [x] 1.4 index.css：卡片样式（容器圆角、头部与 body 的分层底色、滚动条）；行内 code 不动

- [x] Task 2: 助手回答底部操作条——仅复制（chat-view.tsx assistant 区块 + index.css）
  - [x] 2.1 assistant entry 的 `<Markdown>` 下方加操作条：常驻 DOM 占位、hover 切透明度
    （与 UserBubble 工具条同一模式与理由）；只含复制按钮，复制 entry.text（Markdown 源文）
  - [x] 2.2 复用 useCopyWithTick 的对勾 2s 节奏；aria-label/title 文案自创
  - [x] 2.3 index.css：操作条样式（左对齐贴消息正文、三级灰图标、hover 加深）

## 波二 · composer 串行批（同一子代理顺序完成，避免 chat-view composer 区冲突）

- [x] Task 3: 对话页输入区模型快捷切换
  - [x] 3.1 composer-bar 左侧（PermissionMenu 旁）渲染既有 `ModelMenu`：
    props 用 `conversation.state.modelId` / `onOpenSettings` / `onError`（三者 ChatView 已有）
  - [x] 3.2 弹层方向核对：向上展开、左对齐（与 PermissionMenu 同理由）；index.css 如需微调
    composer 区内 ModelMenu 的呈现（`.model-menu-zone` 在 composer-bar 里的对齐）

- [x] Task 4: 停止二次确认接入（stop-confirm.ts 接线 + 补测试）
  - [x] 4.1 chat-view：停止按钮 onClick 与 composer keydown 的 Esc 统一走 `triggerStop`；
    `pending` 态按钮内容变 Esc 徽章 + tooltip 提示，3s 超时用 `stopConfirmExpired` 复原；
    `confirmed` 时才调 `onAbort`。Esc 只在流式期间生效，且在 ac.bind.onKeyDown 之后
    （defaultPrevented 不插手）
  - [x] 4.2 stop-confirm.ts 补 vitest：idle→pending、pending 内确认、超时复原、
    非流式不武装等用例

- [x] Task 5: 输入历史 Alt+↑/↓ + 按 sessionId 存草稿
  - [x] 5.1 新增 `src/renderer/input-history.ts` 纯函数：记录已发送文本、上翻/下翻导航、
    首次上翻暂存草稿、到底再下翻恢复草稿的状态机；模块级存储（视图切换不丢）
  - [x] 5.2 chat-view 接线：发送成功时记录；keydown 在 ac 之后处理 Alt+↑/↓
    （defaultPrevented 不插手；IME composition 期间不翻）
  - [x] 5.3 草稿按 sessionId 持久：模块级 Map<sessionId, draft>，onChange 写入，
    ChatView 挂载时按 `conversation.state.sessionId` 还原
  - [x] 5.4 input-history.ts 补 vitest：导航边界、草稿暂存/恢复、空历史

- [x] Task 6: 字数限制与余量
  - [x] 6.1 纯函数：余量计算与显示判定（上限 10 万、<1000 显示、超限红）；补 vitest
  - [x] 6.2 chat-view：composer-bar 右侧渲染余量（等宽数字）；发送按钮 disabled +
    `submit()` 内双闸拦截超限

## 收尾

- [x] Task 7: 全量验证 + 文档与旧 spec 同步
  - [x] 7.1 `npm run typecheck && npm run check:deps && npm test` 全绿
  - [x] 7.2 更新 `docs/STATUS.md`（6 项细节落地 + 等你验证清单追加人工冒烟项）
  - [x] 7.3 同步勾选 `align-chat-ui-workbuddy/tasks.md` 的 Task 10/11/12/14
    （与本批同源：停止确认/历史草稿/字数/代码块；Task 13 模式 chip 等其余项不做、不勾）

# Task Dependencies

- Task 1 与 Task 2 文件零交集（markdown.tsx vs chat-view assistant 区块），可并行
- Task 3/4/5/6 全部触碰 chat-view.tsx 的 composer 区块与 keydown 处理，**必须同一子代理串行**；
  且依赖 Task 2 完成后动 chat-view.tsx（避免同文件并行）
- Task 1 的 1.2 若上移 useCopyWithTick，Task 2 的 2.2 直接从新位置 import（波一内同代理顺序自理）
- Task 7 依赖全部前置任务
