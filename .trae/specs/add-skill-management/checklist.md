# Checklist

## 技能包元数据

- [x] `SkillInfo` 增 `version` / `installedAt` / `sourcePath` 三个可选字段，且各有来源注释
- [x] 内置技能的 `version` 来自 SKILL.md frontmatter，**没有新增第二次读盘**（`readSkillMeta` 一次读盘取两个字段）
- [x] `importSkill` 成功后技能目录里有 `_installed.json`（name / version? / source / sourcePath / installedAt）
- [x] sidecar 写失败会让导入整体失败（回滚已复制目录，不留半装状态）
- [x] `_installed.json` 不存在（手工放置）与内容损坏两种情况都有明确行为，且损坏时响亮记日志、不打挂技能列表
- [x] 技能卡片显示版本 / 来源 / 导入时间；缺失项不出现伪造值
- [x] `_installed.json` 不出现在 `/` 菜单、不进技能清单段（冒烟输出的技能清单未变）

## 技能启用 / 停用

- [x] `preferences.json` 里有 `skillOverrides`（`Record<string, "on" | "off">`），非法值/非法键名被归一忽略
- [x] 未在 `skillOverrides` 里的技能按**启用**处理（升级后行为不变）
- [x] 提示词技能段、`use_skill` 注入集合、`/` 菜单**三处走同一个过滤出口**（`skillSets` / `enabledSkills`，
      判定逻辑在 `core/skill-status.ts` 一处）
- [x] 停用的技能从 `/` 菜单消失（completions 走 `enabledSkills(undefined)`）
- [x] 停用的技能不在系统提示词的技能清单段里（`composeSystemPrompt` 走 `enabledSkills(expertId)`）
- [x] `use_skill` 加载停用技能时**响亮报错**，且文案与 `disable-model-invocation` 的拒绝文案可区分
      （三种拒绝：不存在 / 已停用 / 仅限手动）
- [x] `skills:set-enabled` 走「读改写」，不会清掉 preferences 里的其它键
- [x] 技能页开关是受控的、键盘可达（复用 `.mcp-switch` 的焦点环口径）、停用态卡片降一档灰；
      停用的技能仍留在列表里可再启用
- [x] 启停不修改 SKILL.md 与 `_installed.json`（只写 preferences）
- [x] `user-invocable: false` 的技能即使用户「打开」也不进 `/` 菜单（两个开关各自生效，互不覆盖）

## 技能成本可见

- [x] `SkillsSnapshot` 增 `enabledCount` / `skillsTokens` / `warning?`，且技能页只用这一份快照渲染
- [x] token 估算走与真实注入同一份组装逻辑（`formatSkillsSection` + `estimateTokens`，收在 `core/skills-cost.ts`），
      渲染层没有自己算
- [x] `skills:set-enabled` 的返回值里 `enabledCount` 与 `skillsTokens` 已是新值（同一个 `buildSkillsSnapshot`）
- [x] 技能页顶部常显「已启用 N / 共 M 个技能 · 技能清单约 X token」
- [x] 超阈值（4000 token）时出现提示，且不阻塞操作；阈值与文案集中一处定义并写了理由（含实测 870 token）
- [x] 停用若干技能后数字确实下降（有断言）

## 技能脚手架技能

- [x] `resources/skills/skill-creator/SKILL.md` 存在，frontmatter 含 name / description / version
- [x] frontmatter 未把 `user-invocable` 或 `disable-model-invocation` 设为 false（用户能手动调、模型能自动路由）
- [x] 正文覆盖：命名与必填字段规则、description 的写法、三级渐进披露、scripts/references/assets 分工、
      两个可见性字段的语义、不写死绝对路径、不把大文档塞正文
- [x] 正文给出「造完怎么用」的闭环（技能页导入）与「校验失败怎么报」的硬约束（原样转述错误 + 改哪一处）
- [x] 技能目录里没有搬用的 WorkBuddy 文件（文字为自研），且 README 注明了来源与状态
- [x] 该技能能被技能发现链路发现（`npm run smoke:session` 的技能清单里出现 skill-creator）

## 清理与校验

- [x] `npm run typecheck` 通过（exit 0）
- [x] `npm run check:deps` 通过（309 个文件，依赖方向校验通过）
- [x] `npm test` 全绿（`2143 passed | 10 skipped`；唯一失败是无关的环境性 sandbox 探测用例）
- [x] `npm run check:tokens` 通过（真违例 0 处）
- [x] `npm run smoke:session` 通过（14/14）
- [x] 本 spec 未删除任何既有 spec 文档
- [ ] **真实界面**人工确认（待用户执行，见 tasks.md SubTask 5.5）
