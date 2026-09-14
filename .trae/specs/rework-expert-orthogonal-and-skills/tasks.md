# Tasks

- [x] Task 1: 专家资源目录化并支持私有技能
  - [x] SubTask 1.1: 迁移 9 个专家定义：`resources/experts/<name>.md` → `resources/experts/<name>/expert.md`（academic-paper / business-copy / general-writer / legal-contract / poetry-prose / science-writing / stock-research-report / tech-blog / work-report），frontmatter 内容不变，`name` 与目录名保持一致
  - [x] SubTask 1.2: 改 `src/core/experts.ts`：`loadExperts` 遍历 `resources/experts/` 下的**目录**，读 `<dir>/expert.md`；`frontmatter.name` 必须等于目录名（原为文件名）；目录下缺 `expert.md` 或存在游离 `.md` 一律响亮报错
  - [x] SubTask 1.3: 收集私有技能：目录含 `skills/` 时按子目录收集技能（每个子目录须有 `SKILL.md`），把技能目录绝对路径随 `ExpertDefinition` 暴露（如 `skillsDir?: string`）；`skills/` 存在但为空、或子目录缺 `SKILL.md` 时报错
  - [x] SubTask 1.4: 重名校验：专家私有技能名不得与 `resources/skills/` 下全局技能同名，也不得与其它专家私有技能同名；命中时抛错并指明两边文件路径
  - [x] SubTask 1.5: 更新 `src/core/experts.test.ts`（或等价测试）：目录加载、name 与目录名不一致报错、`skills/` 收集、重名报错

- [x] Task 2: 解除专家与交互模式的耦合（正交化）
  - [x] SubTask 2.1: 删除 `resources/modes/expert.md`
  - [x] SubTask 2.2: 改 `src/daemon/index.ts` 的 `applyInteraction`：删掉 `expertId` 第三参与「切到 craft/ask/plan 一律清空 expertId」逻辑，只切 `interactionId`；`/plan` 回程记忆去掉 expert 相关特殊处理（`lastNonPlanInteraction` 只记三模式）
  - [x] SubTask 2.3: 改 `[INVOKE.setExpert]` 处理：只读写 `expertId`（校验专家存在），不再改 `interactionId`；取消专家只清 `expertId`
  - [x] SubTask 2.4: 改 `composeSystemPrompt`：人格解析条件由 `interactionId === "expert"` 改为 `expertId !== undefined`
  - [x] SubTask 2.5: 历史会话兼容：resume 时若落盘 `interactionId === "expert"`，归一为 `craft` 并保留 `expertId`；`freshConversation` 相关注释同步（「仅 expert 模式有值」→「与交互模式正交」）
  - [x] SubTask 2.6: 更新 daemon 侧测试（`applyInteraction` / `setExpert` 状态转移、legacy 归一）；核对 `src/daemon/subagent-runner.ts` 与 `src/daemon/automation-runner.ts` 的 `compose` 签名与断言（子代理与定时会话不继承人格与私有技能，现状如此，仅需确认编译与测试通过）

- [x] Task 3: 会话技能清单接入专家私有技能
  - [x] SubTask 3.1: `src/daemon/index.ts` 的 `listSkills` 增加可选参数（专家技能目录），追加进 pi `loadSkills` 的 `skillPaths`；全局/用户/项目技能的现有加载行为不变
  - [x] SubTask 3.2: `composeSystemPrompt` 按当前绑定的 `expertId` 解析出专家技能目录，供技能清单与人格解析共用同一次专家查找（避免两次读盘漂移）
  - [x] SubTask 3.3: 核对 `skillsSnapshot` 通道与技能页展示口径：不把专家私有技能混进全局技能列表（技能页仍展示全局技能），仅在会话组装时追加
  - [x] SubTask 3.4: 补测试：绑定带技能专家时技能清单段含私有技能；未绑定不含；模式无 `read` 时不注入

- [x] Task 4: 搬入 3 个真实专家技能（原样拷贝 + 来源标注）
  - [x] SubTask 4.1: 从 `C:\Users\wzd\.workbuddy\plugins\marketplaces\experts\plugins\equity-research\skills\` 原样拷贝三个技能到 `resources/experts/stock-research-report/skills/`：`comps-valuation`（SKILL.md）、`dcf-model-builder`（SKILL.md）、`initiating-coverage`（SKILL.md + `assets/` + `references/`，共 8 个附带文件）
  - [x] SubTask 4.2: 写 `resources/experts/stock-research-report/README.md`：注明来源（WorkBuddy 内置专家包 `equity-research`）、搬入日期、含哪三个技能、以及已知差异（原文为英文、面向美股语境如 SEC EDGAR，待定制替换）
  - [x] SubTask 4.3: 冒烟：确认这三个技能能被 Task 1 的加载器识别且不触发重名校验

- [x] Task 5: 渲染层与提示词预览适配
  - [x] SubTask 5.1: `src/renderer/chat-view.tsx`：删除 `plainModes` 的 `expert` 过滤（`resources/modes/` 已无 expert）；确认模式切换器与专家 chip 可同时显示、互不清除
  - [x] SubTask 5.2: `src/renderer/App.tsx` 的 `useExpert`：保持「先 newTask 再 setExpert」，更新注释为「绑专家不改模式」；核对 `onSelectExpert` 取消路径只清专家
  - [x] SubTask 5.3: `src/daemon/prompt-preview.ts`：增加可选的专家选择（预览请求带 `expertId`），使预览能显示人格段；更新该文件头「expert 模式不注入人格段」的差异说明与相关测试
  - [x] SubTask 5.4: 更新 `src/shared/ipc.ts`、`src/shared/session-events.ts`、`src/shared/bridge.ts` 中「仅 expert 模式有值」「回落三模式」等语义注释

- [x] Task 7: 让 frontmatter 解析器支持 YAML 块标量（Task 4 暴露的阻塞点）
  - [x] SubTask 7.1: 复现：`resources/experts/stock-research-report/skills/comps-valuation/SKILL.md` 的 `description: |` 让 `src/core/frontmatter.ts` 抛错，进而 `loadExperts` 整体失败（专家菜单全挂），`npm test` 2 例红
  - [x] SubTask 7.2: `src/core/frontmatter.ts` 支持 `|` / `|-` / `>` / `>-` 四种块标量（按缩进收集、去缩进、`|` 保留换行、`>` 折叠换行；`+` 变体与其它未支持构造仍响亮报错）；更新文件头注释说明立场修订原因（WorkBuddy 来源资源会带块标量，且 pi 的 skill 加载器用真 yaml 包解析）
  - [x] SubTask 7.3: 补 `src/core/frontmatter.test.ts` 单测：`|` 与 `>` 两种块标量、`-` 修饰符、块标量后继续解析普通字段、未支持的嵌套/缩进列表仍抛错
  - [x] SubTask 7.4: 复跑 `npm test` 全绿（Task 4 的 2 例专家回归用例恢复通过）

- [ ] Task 6: 全量校验与清单更新
  - [x] SubTask 6.1: `npm run typecheck && npm run check:deps` 全绿
  - [x] SubTask 6.2: `npm test` 全绿
  - [x] SubTask 6.3a: 组合可达性的代码层验证：新增 `prompt-composer.test.ts` 的 6 例矩阵（craft/ask/plan × 绑/不绑专家），断言模式行为段按模式出现、人格段与 `<current-expert>` 钉子段仅在绑专家时出现
  - [ ] SubTask 6.3b: **真实界面**人工确认（待用户执行）：模式切换器只有三档且切模式后专家 chip 仍在、专家市场页「使用专家」落点为「新任务 + 绑专家」、绑定「证券研报」专家后技能清单段出现 3 个私有技能
  - [x] SubTask 6.4: 更新 `docs/workbuddy对齐清单.md` 的 E5 与 F3 状态列（体现正交化与技能预加载），并补 Task 4 搬用技能的证据行

# Task Dependencies

- Task 2 与 Task 1 无依赖，可并行
- Task 3 依赖 Task 1（需要 `ExpertDefinition.skillsDir`）
- Task 4 依赖 Task 1（需要目录化布局）
- Task 5.1 / 5.2 依赖 Task 2（需先删掉 expert 模式）
- Task 5.3 依赖 Task 2.4
- Task 7 由 Task 4 的冒烟验证暴露，独立于其余任务的实现
- Task 6 依赖 Task 1–5、7 全部完成
