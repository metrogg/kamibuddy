# Tasks

## 波一 · 并行（core 侧与 renderer 侧文件零交集）

- [x] Task 1: plan 模式资源 + /plan 内置命令（core/shared/daemon）
  - [x] 1.1 新增 `resources/modes/plan.md`：frontmatter（id/label/description/ready: true/
    tools 只读白名单：read, read_document, find, grep, ls, web_search, web_fetch）+
    正文自创计划行为提示词（只读调研 → 「计划：」编号列表 → 不实施 → 引导切回创作执行）；
    文案自创，禁止复制 pi 示例或 WorkBuddy 原文（机制可学、文字自写）
  - [x] 1.2 `shared/builtin-commands.ts`：`BuiltinCommand.name` 增加 `"plan"`；
    parseBuiltinCommand 仅精确匹配（无参数），带参数返回 undefined；补/改 vitest 用例
  - [x] 1.3 `daemon/index.ts`：prompt 拦截链增加 plan 分支——调既有 setInteraction 内部路径
    切换模式；记录最近一次非 plan 模式（内存变量，缺省 craft），plan 中再收 /plan 则还原；
    completions 通道 commands 列表加 `{ name: "plan", description: 自创, source: "builtin" }`
  - [x] 1.4 验证：`npm run typecheck && npm run check:deps && npx vitest run src/shared`

- [x] Task 2: 加号菜单 + 执行计划按钮（renderer）
  - [x] 2.1 新增 `src/renderer/plus-menu.tsx`（与 model-menu/permission-menu 同文件约定）：
    「+」展开菜单——添加文件 / 模式 ▸（子菜单单选，数据源 availableModes + currentId +
    onChange，ready=false 的走 onTodo，与 ModeSwitch 同语义）/ 专家 / 技能 / 连接器
    （占位 onTodo）；向上展开、左对齐；点击外部或选择后关闭
  - [x] 2.2 `chat-view.tsx`：composer 的「添加附件」裸按钮替换为 PlusMenu；
    「添加文件」项接既有 `img.pickFromDialog()`；模式项接 `conversation.availableModes` /
    `conversation.state.interactionId` / `onInteractionChange`；占位项接 `onTodo`
  - [x] 2.3 `chat-view.tsx`：AssistantActions 追加「执行计划」按钮——条件
    `interactionId === "plan" && !streaming && entry.id === lastEntry?.id`；
    点击先 `await window.kami.setInteraction("craft")`（等切换落地，避免执行撞上只读工具面），
    再 `onSubmit(自创执行引导语)`；文案自创
  - [x] 2.4 `index.css`：plus-menu 菜单/子菜单样式（复用既有弹层变量与 .model-menu 系档位）；
    「执行计划」按钮样式（与 assistant-copy 同族、文字按钮）
  - [x] 2.5 验证：`npm run typecheck && npm run check:deps && npx vitest run src/renderer`

## 收尾

- [x] Task 3: 全量验证 + 文档
  - [x] 3.1 `npm run typecheck && npm run check:deps && npm test` 全绿
  - [x] 3.2 `docs/STATUS.md`：新增专节（plan 模式 + 加号菜单 + /plan）与「等你验证」冒烟项

# Task Dependencies

- Task 1 与 Task 2 文件零交集（resources/shared/daemon vs renderer），可并行
- Task 2 的 2.3 依赖「模式切换已可用」的语义（Task 1 的 setInteraction 链路早已存在，
  不阻塞并行；联调在 Task 3 的全量验证体现）
- Task 3 依赖 Task 1、2 完成
