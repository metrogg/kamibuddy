# Checklist

## 用户消息里的技能胶囊

- [x] `src/shared/skill-block.ts` 存在，导出解析函数与拼回函数，且都是纯函数（无 IO、无 Electron/pi 运行时依赖）
- [x] 解析只在文本**起始**匹配 `<skill …>` 块；正文中部出现 `<skill` 时原样保留（有单测覆盖）
- [x] 连续多个 `<skill>` 块都能剥出，`skillNames` 顺序与出现顺序一致
- [x] `src/shared/session-events.ts` 的 `UserMessage` 增了可选 `skillNames`，缺省不带字段
- [x] `src/core/session-host.ts` 与 `src/core/session-rebuild.ts` **共用**同一个解析出口（没有各写一份）
- [x] 活会话与历史重建对同一条 `/skill:docx 写周报` 产出的 `text` / `skillNames` 完全一致（两侧都有断言）
- [x] `src/renderer/chat-view.tsx` 的 `UserBubble` 在文本上方渲染 `[IconSkill] 技能名` 胶囊行
- [x] 只有技能、没有补充文本时，气泡不留空文本行/空气泡
- [x] 胶囊复用既有 `.context-chip` 视觉；`src/renderer/index.css` 新增的只是布局容器类（无硬编码视觉值）
- [x] 气泡里不再出现 `<skill name=…>` 标签、SKILL.md 正文与本机绝对路径

## `use_skill` 工具

- [x] `src/extensions/use-skill-tool.ts` 存在，注册名 `use_skill`、label「加载技能」、入参只有一个 `command`（字符串）
- [x] 工具在注册处 `declareReadOnlyTools(["use_skill"])`（未落进 `MUTATING` / `SHELL` 等档）
- [x] 返回文本与 pi `/skill:` 展开同形：`<skill name="…" location="…">`、含「相对路径基准」提示行、含去 frontmatter 的正文
- [x] 未知技能名 → 抛错且错误信息含当前可用技能名清单（不静默返回空正文）；可用清单只列模型可见的技能
- [x] `disable-model-invocation: true` 的技能 → 拒绝调用并说明原因
- [x] 技能集合经回调注入（`resolveSkills` 现取不缓存），`src/extensions/use-skill-tool.ts` 未 import `daemon/`
- [x] 主会话扩展数组与 `src/daemon/automation-runner.ts` 的 `buildRunExtensions()` 都注册了该工具
- [x] `src/daemon/subagent-runner.ts` 的 `buildSubagentExtensions()` **未**注册，且注释写明了这条分界
- [x] `resources/modes/{ask,craft,plan}.md` 的 `tools:` 都含 `use_skill`
- [x] `TOOL_RUNNING_LABELS` / `TOOL_DONE_LABELS` 有 `use_skill` 词条；`STREAM_CARD_TOOLS` 未加它
- [x] 卡片标题由「加载技能」+ `summarizeArgs` 的 `command` 键拼出「加载技能 docx」（无需新开摘要通道）
- [x] `src/extensions/use-skill-tool.test.ts` 覆盖命中 / 未知 / 禁用技能 / 现取 / schema 形状（8 例）

## 技能清单段

- [x] `skillsSectionForMode` 门控认 `read`、`bash`、`use_skill` 三者之一
- [x] `src/daemon/prompt-preview.ts` 的门控与 `skillsSectionForMode` 口径一致（预览不漂移）
- [x] 清单段保留 pi 的 `<available_skills>` XML 形状与 `<location>`，并追加了技能调用约定一句（测试断言了追加位置在清单之后）
- [x] `SkillDescriptor` 携带 `disableModelInvocation`，`composeSystemPrompt` 不再丢掉它
- [x] 声明 `disable-model-invocation: true` 的技能（如 `typeset` / `design-token` / `html-review`）不在清单段里
- [x] 相关的 `as never[]` 类型规避已收干净（改为按 pi 的 loader 造同形对象，类型真实）
- [x] `src/core/prompt-composer.test.ts` / `src/daemon/prompt-preview.test.ts` 覆盖门控与过滤

## `/` 菜单与技能页

- [x] 菜单出现「技能」「指令」两个分组标题，技能组在前
- [x] 技能项渲染 `IconSkill` + `/skill:<name>` + 描述；指令项渲染 `/name` + 描述
- [x] 选中技能项插入的仍是 `/skill:<name> `（分组只改呈现，不改 pi 语法）
- [x] 分组依据来自 `CommandItem.source`，渲染层没有按名字前缀猜类型
- [x] `SkillInfo` 增了 `userInvocable`，`listSkills` 如实解析（缺省 true）；`skill-install` 导入路径同样如实回填
- [x] `user-invocable: false` 的技能不出现在 `session:completions` 的技能项里；模板/内置命令不受影响
- [x] `src/renderer/skills-view.tsx` 的卡片名称前有 `IconSkill`
- [x] 上下键可在菜单内跨组连续移动（`active` 是横跨两组的单一扁平序号），插入行为无回归

## 封装引出的连锁

- [x] 重试不再丢技能：`retryText` 由 `skillInvocationText` 拼回 `/skill:<name> <文本>` 再发
- [x] 复制不再出现空串：「只调技能、没写正文」时复制出 `/skill:<name>`
- [x] `skillInvocationText` 的分隔符是空格（pi 按第一个空格切名字与参数），有互逆用例兜底

## 输入框里的技能 chip（Task 9）

- [x] `/` 菜单里选中技能后，textarea 里**不留** `/skill:<name>` 文本（触发片段一并清掉）
- [x] 输入卡上出现一枚 chip：`IconSkill` + 裸技能名 + 移除按钮（`IconClose`，无删除字符当图标）
- [x] 点移除按钮能撤掉该技能，正文不受影响
- [x] 已有 chip 时再选一个技能是**替换**而不是叠加（pi 只认一个前置 `/skill:`）
- [x] 发送时拼回 `/skill:<name>` 前缀，且前缀与正文用**空格**分隔（pi 按第一个空格切名字与参数）
- [x] 「只有技能、没有正文」时发送按钮可用，发出去的内容是 `/skill:<name>`
- [x] 发送后待选技能清空（与正文同去留），不会重复发一次
- [x] 技能 chip 与文档引用 chip 共用同一组 CSS 声明（没有第二套 chip 视觉值）
- [x] `skill:` 前缀只有一个字面量来源（`SKILL_COMMAND_PREFIX`），补全、chip、拼回三处共用
- [x] 用户手动敲 `/skill:docx 写周报` 发送仍照旧工作（菜单只是其中一条入口）
- [x] 普通消息的发送文本不变（没选技能时 `skillInvocationText` 原样返回正文）

## 技能胶囊的视觉（Task 10）

- [x] `.skill-chip` 有自己的 WB 胶囊声明（23 高 / `--radius-full` / padding 1px 8 / 13px / 图标 14），
      不再复用 `.context-chip`（32 高控件档），也不再借用 `.document-ref-chip` 的方块视觉
- [x] 底色走新档 `--bg-chip`（tokens.css 亮 + 暗），DESIGN.md §2.2 与 §3.6 已写明理由
- [x] 用户气泡里胶囊**内联在正文流**（`[图标] 技能名  正文` 同一行），不再占一整行
- [x] 只有技能、没有正文时气泡只含这一枚胶囊，没有多余空行
- [x] 胶囊在 `--bg-raised` 气泡底与白色输入卡底上都能辨出层次
- [x] 技能名走 `.skill-chip-name`（nowrap + 省略号 + `min-width: 0`），长名字不会顶破固定高度
- [x] 删除钮仍是独立按钮（有 aria-label、可 Tab 聚焦），未照搬 WB 的图标原位互换
- [x] 字重取常规 400（WB 的 500 超出本站两档字重语义，未引入第三档）
- [x] `npm run check:tokens` 真违例 0 处；23px / 1px 已登记为 WB 原值（DESIGN.md §10.3）

## 清理与校验

- [x] `src/shared/settings.ts` 里 `SkillsSnapshot` 只剩一份定义
- [x] `npm run typecheck` 通过（exit 0）
- [x] `npm run check:deps` 通过（未引入逆向依赖）
- [x] `npm test` 全绿（`2108 passed | 10 skipped`；唯一失败是无关的环境性 sandbox 探测用例）
- [x] `npm run check:tokens` 通过（本仓的硬编码视觉值检查）
- [x] `npm run smoke:session` 通过（14/14，扩展注入与技能发现未破坏）
- [x] 本 spec 未删除任何既有 spec 文档
- [ ] **真实界面**人工确认（待用户执行，见 tasks.md SubTask 7.5）
