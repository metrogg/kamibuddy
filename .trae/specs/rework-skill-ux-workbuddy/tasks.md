# Tasks

- [x] Task 1: 用户消息里的技能调用封装成胶囊（数据与解析）
  - [x] SubTask 1.1: 新增技能块解析纯函数：从用户消息文本里剥出**开头**的
        `<skill name="X" location="Y">…</skill>` 块（支持连续多块），返回
        `{ skillNames: readonly string[]; text: string }`；无块时 `skillNames` 为空、`text` 原样。
        只在文本**起始位置**匹配（正文中部出现的 `<skill` 一律不动）；`</skill>` 之后的分隔空行一并归一。
        文件头注释写清来源（pi `agent-session.js:983-1007` 的展开形状）与「为什么在这里剥」
        （落地位置见 SubTask 8.1：最终在 `src/shared/skill-block.ts`）
  - [x] SubTask 1.2: `src/shared/session-events.ts` 的 `UserMessage` 增可选字段
        `readonly skillNames?: readonly string[]`，注释说明「无技能即不带该字段（UI 按缺省渲染）」，
        与既有 `images` 的可选口径一致
  - [x] SubTask 1.3: `src/core/session-host.ts` 的 `message_start`（user 分支）改用
        解析结果：`text` 取剩余文本，有技能则带上 `skillNames`
  - [x] SubTask 1.4: `src/core/session-rebuild.ts` 的 `userView` 走**同一个**解析出口，
        保证活会话与历史重建同形；同步更新该函数头注释
  - [x] SubTask 1.5: 新增解析器单测：正常单块、多块、无块（逐字原样）、
        `<skill` 出现在中部不剥、`</skill>` 后无补充文本（text 为空）、location 含空格/中文路径、
        属性顺序无关、缺 name/未闭合不剥
  - [x] SubTask 1.6: 在 `src/core/session-host.test.ts` 与 `src/core/session-rebuild.test.ts`
        各补一例：`/skill:docx 写周报` 展开后的 pi 用户消息 → 事件里 `text === "写周报"`、
        `skillNames === ["docx"]`

- [x] Task 2: 用户气泡渲染技能胶囊（渲染层）
  - [x] SubTask 2.1: `src/renderer/chat-view.tsx` 的 `UserBubble` 增 `skillNames` 入参，
        在文本上方渲染胶囊行：`IconSkill`(16px) + 技能名，逐个技能一枚
  - [x] SubTask 2.2: 胶囊视觉**复用现有 `.context-chip` 类**（不新造 chip 类名与视觉值，DESIGN.md §6）；
        只在 `src/renderer/index.css` 里加纯布局容器类 `.user-bubble-skills`
        （照 `.user-bubble-images` 的先例），注释说明「这是布局容器，不是第二套 chip」
  - [x] SubTask 2.3: 空文本处理：`skillNames` 非空且 `text` 为空时只渲染胶囊行，不留空文本行/空气泡
        （`.user-bubble-skills:not(:last-child)` 只在下面还有内容时才留间隔）
  - [x] SubTask 2.4: 两处调用点都透传 `entry.skillNames` —— `renderEntry` 一条，
        以及 `turnViews` 循环里的 user 条目（后者才是真实渲染路径，只改前者界面看不到胶囊）
  - [x] SubTask 2.5（实施中补入，Task 2 暴露）: 收紧 2.4 引出的连锁 —— 见 Task 8

- [x] Task 3: 新增 `use_skill` 技能加载工具
  - [x] SubTask 3.1: 技能来源单一出口：`src/daemon/index.ts` 抽出 `sessionSkills(expertId)`
        （= `listSkills(绑定专家的 skillsDir)`），`composeSystemPrompt`、用户会话注册点、
        定时 run 会话注册点共用它；**不动** `SessionHost.skillDescriptors`
        （宿主自持的 `resourceLoader` 技能集与提示词用的不是同一份，用它等于制造第三个来源）
  - [x] SubTask 3.2: 新增 `src/extensions/use-skill-tool.ts`，形状照 `src/extensions/web-tools.ts`：
        `declareReadOnlyTools(["use_skill"])` + `pi.registerTool({ name: "use_skill", label: "加载技能",
        description / promptSnippet / promptGuidelines / parameters: Type.Object({ command: Type.String(...) }) })`。
        入参名用 `command`（WorkBuddy 的 `use_skill` schema 同形，且 `summarizeArgs` 的键优先级表里
        有 `command` —— 卡头摘要自动就是技能名，不必新开摘要通道；这条理由写进注释）
  - [x] SubTask 3.3: `execute` 语义：按名查当前会话技能 → 读 `SKILL.md` → `stripFrontmatter`（pi 公开导出）
        → 包成 `<skill name="…" location="…">\nReferences are relative to <baseDir>.\n\n<body>\n</skill>`
        （与 pi `/skill:` 展开同形）；查不到 → 抛错并列出**模型可见**的可用技能名；
        `disableModelInvocation` 为 true → 抛错说明「仅限手动 /skill:name 或其它技能按路径引用」
  - [x] SubTask 3.4: 技能来源经**回调注入**（extensions 不许 import daemon），
        签名 `createUseSkillTool({ resolveSkills: () => readonly UseSkillTarget[] })`
  - [x] SubTask 3.5: `src/daemon/index.ts` 主会话扩展数组注册该扩展，
        注入会话真实的技能集合（含绑定的专家私有技能）
  - [x] SubTask 3.6: `src/daemon/automation-runner.ts` 的 `buildRunExtensions()` 同样注册
        —— 定时会话走双轴 compose、技能清单段会被注入，不注册等于提示词里承诺一个不存在的工具；
        `src/daemon/subagent-runner.ts` 的 `buildSubagentExtensions()` **不注册**（子代理不注入技能段），
        在该函数注释里写明这条分界
  - [x] SubTask 3.7: `resources/modes/{ask,craft,plan}.md` 的 `tools:` 白名单各加 `use_skill`
        （只读工具，与 `read` 同档；plan/ask 的只读定位不受影响）
  - [x] SubTask 3.8: `src/core/session-host.ts` 的 `TOOL_RUNNING_LABELS` 加 `use_skill: "加载技能"`、
        `TOOL_DONE_LABELS` 加 `use_skill: "已加载"`（不进 `STREAM_CARD_TOOLS`：本地快操作，
        参数只有一个短技能名，生成期上屏只会闪一下，口径同 `read`）
  - [x] SubTask 3.9: 新增 `src/extensions/use-skill-tool.test.ts`（照 `web-tools.test.ts` 的 fake `ExtensionAPI` 范式）：
        命中返回同形块、未知技能抛错含可用清单、`disableModelInvocation` 技能被拒、参数 schema 形状

- [x] Task 4: 技能清单段与 `use_skill` 对齐
  - [x] SubTask 4.1: `src/core/prompt-composer.ts` 的 `skillsSectionForMode` 门控从
        `read | bash` 扩为 `read | bash | use_skill`；同步镜像 `src/daemon/prompt-preview.ts`
  - [x] SubTask 4.2: `formatSkillsSection` 在 pi 的 `formatSkillsForPrompt` 输出之后
        追加一句技能调用约定（优先 `use_skill`，无该工具时用 `read` + `<location>`）；
        注释写清「为什么保留委托 + 追加一句」而不是自己重写整套 XML；
        技能全被过滤掉时仍返回空串（零 token）
  - [x] SubTask 4.3: `src/daemon/index.ts` 的 `composeSystemPrompt` 构造 `SkillDescriptor` 时
        **保留 `disableModelInvocation`**（原被丢掉，pi 的过滤因此失效）；
        `SkillDescriptor` 补该可选字段；`formatSkillsSection` 里的 `as never[]` 类型规避改成
        按 pi 的 loader 造同形对象（`createSyntheticSourceInfo` + `dirname`），类型真实
  - [x] SubTask 4.4: 补测试：`src/core/prompt-composer.test.ts` 加「门控认 `use_skill`」
        「`disableModelInvocation` 的技能不进清单段」「清单段含调用约定一句」；
        `src/daemon/prompt-preview.test.ts` 的镜像口径同步

- [x] Task 5: `/` 菜单分组、可见性过滤、技能页图标
  - [x] SubTask 5.1: `src/daemon/index.ts` 的 `listSkills` 为每个技能补
        `userInvocable`：pi 的 `loadSkills` 不解析 `user-invocable`（丢弃未知键），
        因此用 `core/frontmatter.ts` 的解析器再读一次 SKILL.md 取该字段（缺省 true）；
        注释写清「为什么多读一次盘」「只补这一个字段、不接管 pi 的加载」
        与解析失败时「响亮记日志 + 逐文件降级为可见」的取舍
  - [x] SubTask 5.2: `src/shared/settings.ts` 的 `SkillInfo` 增 `readonly userInvocable: boolean`
  - [x] SubTask 5.3: `session:completions` 聚合技能时过滤 `userInvocable === false`
        （模板与内置命令的来源、顺序不变）
  - [x] SubTask 5.4: `src/renderer/autocomplete.tsx` 的菜单按 `source` 分组：
        技能组在前（`IconSkill` + `/skill:<name>` + 描述），指令组在后（模板 + 内置命令）；
        分组标题文案「技能」「指令」；上下键跨组连续（`active` 仍是横跨两组的单一扁平序号）
  - [x] SubTask 5.5: `src/renderer/skills-view.tsx` 的 `SkillCard` 在名称前加 `IconSkill`
  - [x] SubTask 5.6: `src/shared/autocomplete.ts` 的补全项类型补齐分组信息
        （`CompletionGroup` / `CompletionItem.group` / 纯函数 `sectionize`，可单测）；
        `src/shared/autocomplete.test.ts` 补 `sectionize` 用例
  - [x] SubTask 5.7: `src/shared/ipc.ts` 的 `CommandItem` 注释补一句分组口径（技能组靠 `source === "skill"`）
  - [x] SubTask 5.8（实施中补入）: `src/core/skill-install.ts` 的 `ParsedSkill` / `parseSource` /
        `importSkill` 如实回填 `userInvocable`（`SkillInfo` 新增必填字段的连带点；
        硬写 true 会把源码里标了 `false` 的技能导入成假信息）

- [x] Task 6: 清理 `src/shared/settings.ts` 里重复的 `SkillsSnapshot`（两份留一份，注释合并）

- [x] Task 8: 修复封装带来的重试/复制回归（Task 1 暴露，实施中补入）
  - [x] SubTask 8.1: 技能块模块增 `skillInvocationText(skillNames, text)`：把
        「技能名 + 补充文本」拼回用户实际打过的 `/skill:<name> <文本>`（分隔符必须是**空格**，
        pi 按第一个空格切名字与参数；用 `\n\n` 拼出来的串 pi 不认）；同时把该模块从 `core/`
        移到 `shared/`（拆与拼必须同一套语法，而渲染层只许 import `shared/`）
  - [x] SubTask 8.2: `src/renderer/chat-view.tsx` 的 `retryText` 改用拼回结果 ——
        原来直接拿 `text` 重发，技能消息重试会丢掉技能（只重发补充文本）
  - [x] SubTask 8.3: `UserBubble` 的复制按钮同样复制拼回结果 ——
        原来在「只调技能、没写正文」时复制出空串
  - [x] SubTask 8.4: `src/shared/skill-block.test.ts` 补 `skillInvocationText` 用例
        （无技能原样返回 / 单技能 + 文本 / 只有技能 / 拆分拼回互逆且拼出的串能被 pi 切出技能名）

- [x] Task 9: 输入框里选中的技能变成 chip（用户反馈：`/` 菜单选完框里还是一串纯文本）
  - [x] SubTask 9.1: `src/shared/skill-block.ts` 增 `SKILL_COMMAND_PREFIX` 常量与 `bareSkillName()`
        —— `skill:` 前缀有三个消费方（补全项构造 / chip 裸名 / 拼回发送文本），
        不允许各写一遍字面量（AGENTS.md §4）；daemon 的 completions 前缀同步改用该常量
  - [x] SubTask 9.2: `src/shared/autocomplete.ts` 的 `CompletionItem` 增 `skill?: string`（裸技能名），
        `src/renderer/autocomplete.tsx` 的 `buildItems` 从契约派生
  - [x] SubTask 9.3: `useAutocomplete` 增 `onPickSkill`：选中技能项不插文本，只把触发片段从草稿里摘掉 +
        还焦点（缺省不传时回退旧的插文本行为）
  - [x] SubTask 9.4: `src/renderer/composer.tsx` 增 `SkillStrip`（`IconSkill` + 裸名 + `IconClose` 移除钮，
        复用既有 chip 声明）；`/` 菜单选中即入列（**单选**：pi 只有一个前置 `/skill:`，
        再选即替换，避免第二个技能被当成第一个的参数），textarea 只留人写的正文
  - [x] SubTask 9.5: 提交路径：`skillInvocationText(skills, ...)` 拼回 `/skill:<name>` 前缀（空格分隔）；
        「只有技能没有正文」也可发送；发送后清空待选技能；历史记录记「技能 + 人写正文」（不含文档引用）
  - [x] SubTask 9.6: `src/renderer/index.css`：技能 chip 与文档引用 chip **共用同一组声明**
        （选择器列表扩展，不新造 chip 类名/视觉值，DESIGN.md §6）
  - [x] SubTask 9.7: 补测试：`bareSkillName` 两例；`npm run typecheck` / `check:deps` / `check:tokens`
        / `npm test`（2110 passed）全通过

- [x] Task 10: 技能胶囊视觉对齐 WorkBuddy（用户反馈：别复用 32px 的控件 chip，风格对齐 WB 即可）
  - [x] SubTask 10.1: 取证 WB `skillTag` 原值（`lib-chat-ui-Co_VI_pZ.css:12261-12298`）：
        height 23 / radius 100px / padding 1px 8 / font-size 13 / 字重 500 / 图标容器 14；
        底色两处取值 `--cr-internal-tag-skill-bg: #f2f2f2`（白底）与
        `--cb-tag-skill-file-background: rgba(0,0,0,.10)`（用户气泡内，注释写明「弱化、与气泡融合」）
  - [x] SubTask 10.2: `src/styles/tokens.css` 增表面色第 6 档 `--bg-chip`（亮 rgba(0,0,0,.06) /
        暗 rgba(255,255,255,.10)），注释写清取值推导（同时服务白底与 --bg-raised 灰底）与
        「不用 --bg-hover 顶替」的理由
  - [x] SubTask 10.3: `DESIGN.md`：§2.2 加 `--bg-chip` 行与新增理由、新增 §3.6「技能胶囊」组件规范、
        §10.3 登记 23px / padding 1px 为 WB 原值（非档位值）
  - [x] SubTask 10.4: `src/renderer/index.css`：`.skill-chip` 独立成 WB 胶囊（不再复用 `.context-chip`，
        也解除与 `.document-ref-chip` 的混用；仅条形容器与删除钮继续共用声明）；
        气泡里的胶囊改为**内联在正文流**（WB 同款 `[图标] 技能名  正文`），删掉整行容器 `.user-bubble-skills`
  - [x] SubTask 10.5: `src/renderer/chat-view.tsx` / `src/renderer/composer.tsx` 的图标改 14px、
        技能名统一走 `.skill-chip-name`（nowrap + 省略号 + `min-width: 0`，否则固定 23 高会被长名字顶破）
  - [x] SubTask 10.6: 校验：`typecheck` / `check:deps` / `check:tokens`（真违例 0）/ `npm test`（2110 passed）

- [x] Task 7: 全量校验
  - [x] SubTask 7.1: `npm run typecheck`（exit 0）+ `npm run check:deps`（exit 0）
  - [x] SubTask 7.2: `npm test` —— `Tests 2108 passed | 10 skipped`；
        唯一失败 `src/sandbox/confinement.win.test.ts` 是**与本改动无关**的环境问题
        （受限令牌探测进程启动失败 `0x80000005`，Trae 沙箱内无法拉起受限进程；未触碰 sandbox 代码）
  - [x] SubTask 7.3: `npm run check:tokens`（本仓脚本名；没有 `check:design-tokens`）
        —— `✓ 硬编码视觉值检查通过（仅剩白名单例外与内置豁免）`，真违例 0 处
  - [x] SubTask 7.4: `npm run smoke:session` —— `14/14 通过`，含「内置技能被发现」
  - [ ] SubTask 7.5: **真实界面**人工确认（待用户执行）：`/` 菜单两组且技能带图标；
        发 `/skill:docx 写一份周报` 后气泡是「胶囊 + 文本」；模型自动加载技能时出现
        「加载技能 xxx」卡片；技能页卡片有图标；`typeset` 等内部技能不在菜单里

# Task Dependencies

- Task 2 依赖 Task 1（需要 `UserMessage.skillNames`）
- Task 3 与 Task 1 / 4 / 5 无依赖，可并行（3.1 是 Task 3 自身的前置）
- Task 4 与 Task 3 并行；但 4.2 的文案要与 3.2 的工具名一致（同一改动内对齐）
- Task 5 与 Task 1 / 3 / 4 无依赖，可并行
- Task 6 独立，可随时做
- Task 8 依赖 Task 1、2（修正它们引入的重试/复制回归）
- Task 9 依赖 Task 5.4 / 5.6（分组与补全项类型就绪）与 Task 8（拼回函数）
- Task 10 依赖 Task 2 与 Task 9（胶囊在气泡与输入卡两处的落点）
- Task 7 依赖 Task 1–6、8、9、10 全部完成（7.5 需用户在真实界面执行）

# 明确不做（本轮）

- 技能自定义图标（frontmatter `icon:` / 技能目录图片 / 本地图标缓存协议）—— 用户决策统一用 `IconSkill`
- `skillOverrides` 四态（on / name-only / user-invocable-only / off）—— WorkBuddy 桌面端也只收敛成
  「自动触发 on/off」，本轮先做 frontmatter 两个字段
- 技能置顶 / 最近使用排序、技能来源标签（团队 / 个人）—— 我们还没有技能市场与团队技能来源
- 技能页对「仅内部调用」技能的标注 —— 需要新的标签视觉与设计决策，单独评审
