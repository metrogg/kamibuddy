# Tasks

- [x] Task 1: 技能包元数据（version / installedAt / sourcePath）
  - [x] SubTask 1.1: `src/shared/settings.ts` 的 `SkillInfo` 增可选字段
        `version?: string`、`installedAt?: number`、`sourcePath?: string`，注释写清各自来源
        （内置技能的 version 来自 SKILL.md frontmatter；后两者只对经导入安装的技能有值）
  - [x] SubTask 1.2: `src/daemon/index.ts` 的 `readUserInvocable` → `readSkillMeta`：一次读盘同时取
        `user-invocable` 与 `version`（**没有新增第二次读盘**）；`version` 缺失即不带字段；
        解析失败仍是「响亮记日志 + 逐文件降级」
  - [x] SubTask 1.3: `src/core/skill-install.ts` 导入成功后写 `<destDir>/_installed.json`
        （`{ name, version?, source: "local-import", sourcePath, installedAt }`）；来源自带的同名文件
        被本次值覆盖；**写失败回滚已复制目录并让导入失败**（不留半装）
  - [x] SubTask 1.4: `readInstalledMeta(skillDir)` 读 sidecar（提到 core 便于单测）：
        文件不存在 = 手工放置（不记日志）；读不动 / JSON 坏 / 根不是对象 → 响亮记日志 + 降级；
        逐字段校验类型（present-but-invalid 当缺失）
  - [x] SubTask 1.5: `SkillCard` 加元数据行（版本 / 来源 / 导入时间）；来源三态
        （内置 / 导入 + 来源路径 / 手工放置）；缺失项留白不造占位；
        `index.css` 只新增 `.skill-card-meta`（沿用既有 token）
  - [x] SubTask 1.6: `src/core/skill-install.test.ts` 扩到 18 例：sidecar 形状、version 缺失不带键、
        自带 sidecar 被覆盖、坏 JSON 降级、返回对象带新字段
  - [x] SubTask 1.7（实施中补入）: `importSkill` 返回的 `disableModelInvocation` 原为**硬编码 false**
        —— 与上一轮修过的 `userInvocable` 同一类问题（导完那一刻说 false、下一轮现读又变 true）。
        已照 `userInvocable` 的口径改为如实读 frontmatter，并补测试

- [x] Task 2: 技能启用 / 停用
  - [x] SubTask 2.1: `Preferences` 增 `skillOverrides?: Readonly<Record<string, "on" | "off">>`；
        读取层 `readSkillOverrides` 逐条形状校验（坏键 / 坏值记日志后忽略）；
        注释写明「键名与语义对齐 WorkBuddy 的 skillOverrides，当前两态，将来加态零迁移」
  - [x] SubTask 2.2: daemon 加 `skillSets(expertId)`（一次读盘 + 一份 overrides 同时产出
        `all`（带 enabled）与 `enabled`）与 `enabledSkills(expertId)`；三处消费点改走它：
        技能清单段、两处 `use_skill` 注入（传全量 + enabled 标记）、`/` 菜单；
        提示词预览也过了同一个 `filterEnabledSkills`（预览不漂移）
  - [x] SubTask 2.3: `use-skill-tool.ts` 的 `UseSkillTarget` 增 `enabled`；拒绝路径分成三种
        （不存在 / 已在技能页停用 / 作者声明仅限手动），未知技能的可用清单只列已启用且模型可见的
  - [x] SubTask 2.4: `skills:set-enabled` 通道（args `[name, enabled]`，返回**新快照**）+
        preload/bridge 接线；写入走「读改写」，开启时**删键**、无覆盖时整个键删掉
        （「缺省 = 启用」唯一表示）
  - [x] SubTask 2.5: `SkillCard` 加开关（结构与 `connectors-view.tsx` 的既有开关一致、
        受控 checkbox + track + thumb + `aria-label`）；停用态卡片整体降一档（`.skill-card-off`）；
        停用技能仍留在列表里可再启用
  - [x] SubTask 2.6: `index.css` 把 `.mcp-switch*` 的选择器列表扩到 `.skill-switch*`
        （同一组声明，不复制视觉值），注释写明「第二个消费方；抽共享 Switch 是 DESIGN.md §6 待办」
  - [x] SubTask 2.7: 新增 `src/core/skill-status.ts`（零依赖纯逻辑：`isSkillEnabled` /
        `filterEnabledSkills` / `SKILL_NAME_PATTERN`）+ `skill-status.test.ts`；
        `preferences.test.ts` 覆盖 `skillOverrides` 读写与容错

- [x] Task 3: 技能成本可见
  - [x] SubTask 3.1: `SkillsSnapshot` 增 `enabledCount` / `skillsTokens` / `warning?`；
        `SkillInfo` 增 `enabled: boolean`（全量列表逐项标注）
  - [x] SubTask 3.2: daemon 的 `buildSkillsSnapshot()` 成为**唯一组装点**（snapshot 与 set-enabled 共用）；
        成本走新模块 `src/core/skills-cost.ts` 的 `computeSkillsCost`（= 与真实注入同一份
        `formatSkillsSection` + `estimateTokens`）
  - [x] SubTask 3.3: `SKILLS_TOKEN_WARNING_THRESHOLD = 4000`，注释写清「按 token 而非个数」的理由，
        并记下**实测值**：内置 5 个技能 → 清单段 1946 字符 → **870 token**（距阈值 4 倍余量，刻意）
  - [x] SubTask 3.4: 技能页列表上方常显「已启用 N / 共 M 个技能 · 技能清单约 X token」；
        超阈值时加提示条（复用既有 hint 样式）；开关后用返回的新快照更新（数字即时变）
  - [x] SubTask 3.5: `skill-status.test.ts` / `skills-cost` 相关断言覆盖「停用后数字下降」与
        「超阈值产出 warning、未超不带该字段」（阈值可注入，测试用小阈值）

- [x] Task 4: 技能脚手架技能（自研最小版，不搬 WB 文件）
  - [x] SubTask 4.1: 新增 `resources/skills/skill-creator/SKILL.md`：frontmatter
        `name: skill-creator` / 触发导向的 `description` / `version: "1.0.0"`；
        两个可见性字段都未设 false（用户可手动调、模型可自动路由）
  - [x] SubTask 4.2: 正文写清本项目约定（自研文字，未复制 WB 段落）：SKILL.md 骨架与字段表
        （注明只有 name / description / disable-model-invocation 是 pi 认的）、命名规则与
        `importSkill` 逐条对齐、frontmatter 子集限制（支持 `|`/`>`，缩进列表会报错）、
        description 的触发写法（正反例）、三级渐进披露、scripts/references/assets 的分工与判据、
        两个可见性字段的语义与何时写、六条纪律（相对路径 / 不塞大段文档 / 一个技能一类事…）
  - [x] SubTask 4.3: 正文给出闭环（技能页「导入技能…」、下一轮生效、`/` 与 `/skill:<名>` 自检三步）
        与硬约束（原始错误原样转述 + 改哪一处的对照表，错误文案取自代码真实文案；重名要手动删旧的如实写）
  - [x] SubTask 4.4: `resources/skills/skill-creator/README.md` 注明自研来源与状态
        （机制参考 WB skill-creator，文字与脚本均未搬用；本轮不做 init/package/validate）
  - [x] SubTask 4.5: `npm run smoke:session` 14/14 通过，技能发现已含 `skill-creator`

- [x] Task 5: 全量校验
  - [x] SubTask 5.1: `npm run typecheck`（exit 0）+ `npm run check:deps`（exit 0，309 文件）
  - [x] SubTask 5.2: `npm test` —— `Tests 2143 passed | 10 skipped`；唯一失败
        `src/sandbox/confinement.win.test.ts` 是**与本改动无关**的环境问题
        （受限令牌探测进程启动失败 `0x80000005`；未触碰 sandbox 代码）
  - [x] SubTask 5.3: `npm run check:tokens` —— 真违例 0 处，无「白名单条目未命中」告警
  - [x] SubTask 5.4: `npm run smoke:session` —— 14/14 通过
  - [ ] SubTask 5.5: **真实界面**人工确认（待用户执行）：技能页卡片显示版本/来源；
        开关能停用并让 `/` 菜单里消失、`use_skill` 拒绝；顶部成本数字随开关变化；
        `/skill:skill-creator` 能展开

# Task Dependencies

- Task 2 依赖 Task 1（`SkillInfo` 扩字段与卡片结构是同一处）
- Task 3 依赖 Task 2（`enabledCount` 来自启停集合；快照形状在 Task 2 里改）
- Task 4 与 Task 1–3 无依赖（只新增 `resources/skills/skill-creator/`），实际并行完成
- Task 5 依赖 Task 1–4 全部完成（5.5 需用户在真实界面执行）

# 实施中发现、留给后续的两件事（本轮不改）

- **技能发现边界：pi 是「递归下探，但目录自带 SKILL.md 即停止」（root 优先于 nested）**：
  pi `loadSkills` 会递归进入子目录，**但某目录一旦自带 SKILL.md 就不再下探**（root 优先于
  nested），所以 `resources/skills/docx/{orchestrator,brief-compose,design-token,html-review,
  typeset,experts/*}` 这 **14 个** SKILL.md（docx 根下 5 个 + `experts/` 下 9 个）**从来不是
  独立技能**，它们只被 `docx` 按相对路径读取。这也解释了为什么技能页只有 5 个技能。
  另外三家规则同向：codex 是「插件 `skills/` 只取一层、**嵌套显式排除**」；opencode 是
  「固定一层 `<config>/skills/<name>/SKILL.md`，且 `name` 必须等于目录名」；WorkBuddy 是
  「`plugin.json` 显式声明 `"skills": "./skills"`，未声明的子树不算技能」。
  四家结论一致：**`docx/SKILL.md` 是「技能边界」，边界内的 `typeset` / `experts/*` 是按需加载
  资源，不是技能** —— 这是共同设计，不是缺陷。只有当某个子能力需要被用户/模型**直接选中**
  时才需要动结构。
  证据路径：
  - pi：`开源项目/pi/packages/coding-agent/test/skills.test.ts:97-118`（两个用例名
    `should load nested skills recursively`（97-106）/
    `should prefer a directory's root SKILL.md over nested SKILL.md files`（108-118））
  - codex：`开源项目/codex/codex-rs/app-server/tests/suite/v2/plugin_read.rs:1364-1423`
    （测试名 `plugin_read_agent_plugin_excludes_nested_skills`）
  - opencode：`开源项目/opencode/packages/web/src/content/docs/zh-cn/skills.mdx`（「了解发现机制」节）
  - WorkBuddy：`builtin-plugins/tencent-docx/.codebuddy-plugin/plugin.json` 的 `"skills": "./skills"`

  上一轮 `rework-skill-ux-workbuddy` 的 checklist 里「这三个内部技能不在清单段里」实际是
  **真空成立（pass for the wrong reason）**：那条 checkpoint 覆盖的 `typeset` / `design-token` /
  `html-review` **本就不被加载**（被 `docx/SKILL.md` 这道技能边界挡住），所以那句断言不是被
  实现出来的，而是恰好成立 —— 别把它当成已验证的护栏。
- **`category` / `tags` 全仓没有消费方**：`resources/skills/**` 里写了但没人读（本轮只接通了
  `version` 与 `user-invocable`）。要么接成「技能页分类/筛选」，要么在搬用资源里注明「仅溯源用」。

# 明确不做（本轮）

- **移植 WorkBuddy 的内置技能**（用户决策：本轮不移植，只做机制）。已核清的候选与不可搬原因留档在
  spec 的 Why 与 `docs/workbuddy分析/03-plugins-skills.md`：`miora-*` / `ardot-*` / `library` /
  `cloud-service` / `tencent-*` 依赖腾讯云或内部服务；`sites` 依赖 `workbuddy_sites_deploy` 工具、
  `recommend-experts` / `recommend-connectors` 依赖 `search_plugins` + 卡片通道 —— 直接搬过来是死技能。
- **本地目录市场 / marketplace.json**（我提的第 5 点）—— 需要先有「包」的元数据落地（本轮做完才有基础）。
- **技能删除 / 覆盖更新** —— `importSkill` 仍是「同名拒绝、要删先手动」，本轮不动。
- **`skillOverrides` 的另外两态**（`name-only` / `user-invocable-only`）—— 键名与形状已对齐 WB，
  将来加态零迁移。
- **技能自定义图标**（沿用上一轮的用户决策：统一 `IconSkill`）。
