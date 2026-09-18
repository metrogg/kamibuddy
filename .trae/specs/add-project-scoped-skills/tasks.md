# Tasks

- [x] Task 1: 权限判据收窄 —— 工作区内的技能根写入回归普通口径
  - [x] SubTask 1.1: `src/extensions/safe-commands.ts` 加**技能根例外**（相邻两段 `.pi`+`skills` /
        `.agents`+`skills`，任意层级），不是"字符串里出现就放行"
  - [x] SubTask 1.2: 移除 `CONFIG_AS_CODE_DIR_PAIRS` 里的 `[".agents","skills"]`（现仅剩 `["node_modules",".bin"]`），
        注释改写成事实
  - [x] SubTask 1.3: 补**判据**注释：高危名单 = 「会被执行 / 改变加载行为」；技能正文与 `AGENTS.md` 同类；
        如实写残留风险（项目级技能是本项目的提示注入持久落点 + 三条缓解 + 名单不完备）
  - [x] SubTask 1.4: 命令文本闸与写侧共用 `segmentsTouchConfigAsCode`，两侧同步（测试证明）
  - [x] SubTask 1.5: `src/extensions/permission-policy.ts` 配置即代码分支注释同步；阶段 1 禁区零改动
  - [x] SubTask 1.6: `src/extensions/safe-commands.test.ts` 补技能根例外组（放行 5 / 仍命中 7 / 精度 3）+
        命令文本闸两条
  - [x] SubTask 1.7: `src/extensions/permission-policy.test.ts` 移除 `.agents/skills` 那条高危期望，
        新增「技能根写入 write/edit 均放行」+ 反侧断言（`.pi/extensions`、`.pi/settings.json` 仍 high）

- [x] Task 2: 技能作用域 —— 数据与发现
  - [x] SubTask 2.1: 新增 `src/core/skill-scope.ts` 的 `skillScopeOf`（builtin → project → user，
        分隔符/大小写归一 + 分量边界，不做 realpath，`workspaceDir: undefined` 时不产生 project）
  - [x] SubTask 2.2: `src/shared/settings.ts` 的 `SkillInfo.origin` 扩为 `"builtin" | "project" | "user"`
  - [x] SubTask 2.3: `src/daemon/index.ts` 的 `listSkills` 改用 `skillScopeOf`，删掉内联前缀比较
  - [x] SubTask 2.4: 新增 `src/core/skill-scope.test.ts`（14 例，含真实入口集成用例：
        用 pi 的 `loadSkills({cwd, agentDir, skillPaths: [], includeDefaults: true})` 证明项目级技能被发现、
        换工作区后消失）
  - [x] SubTask 2.5: 三处消费点同源性核对（`/` 菜单 `daemon/index.ts` 的 `enabledSkills`、
        技能清单段、`use_skill`）—— 都经 `skillSets`/`sessionSkills` → 唯一出口 `listSkills`；
        另核 `core/skill-install.ts` 的 `origin: "user"` 与 `origin === "user"` 读 sidecar 两处语义仍正确

- [x] Task 3: 技能页标出作用域
  - [x] SubTask 3.1: `src/renderer/skills-view.tsx` 的 `sourceLabel` 四态
        （内置 / 本项目 / 导入 / 手工放置）+ 函数头注释同步
  - [x] SubTask 3.2: 未新增任何视觉值 / CSS 规则（`SkillCard` meta 行逐行核对，无两态假设）
  - [x] SubTask 3.3: `npm run check:tokens` 通过（真违例 0）

- [x] Task 4: skill-creator 讲清两层作用域
  - [x] SubTask 4.1: `resources/skills/skill-creator/SKILL.md` §七 改写成两层（默认项目级 / 跨工作区才升级）
  - [x] SubTask 4.2: §八 失败对照表按新口径补改（项目级无安装报错、zip 打包失败与安装失败分开）
  - [x] SubTask 4.3: `README.md` 补两层作用域段与两行代码对应关系（`src/core/skill-scope.ts`、
        技能根例外）；另清了 6 处旧口径残留（"必须先装到用户级"等）

- [x] Task 5: 决策记录
  - [x] SubTask 5.1: `docs/workbuddy分析/03-plugins-skills.md` 追加「决策 B」，含结论 4 条 + 证据链 5 条 + 残留风险
  - [x] SubTask 5.2: 同节 `## 否决方案（决策 B）` 四条（名单不动 / 降 medium / 学 codex 只读子路径 /
        自开技能根目录）
  - [x] SubTask 5.3: `docs/sandbox.md` 修正 4 处事实描述（决策 15 结论未改，另加「2026-09-18 收窄」段
        链接决策 B）；`docs/workbuddy对齐清单.md` E4 行同步；
        `scripts/probe-config-write-exec.ts` 的失真探测项换掉并加注释（实跑 16 行全 OK）
  - [x] SubTask 5.4（实施中补入）: 修掉决策 B 里**错误的证据路径**（初稿指向不存在的
        `src/core/trust-manager.ts`），改为可核的
        `node_modules/@earendil-works/pi-coding-agent/dist/core/{skills,package-manager,trust-manager}.js` 行号

- [x] Task 6: 独立核验（对 checklist.md 逐条裁决）
  - [x] SubTask 6.1: 核验 16 条，15 条通过、1 条无法验证（真实界面人工确认，待用户执行）
  - [x] SubTask 6.2: 核验发现一处**本次引入的回归** → 转成 Task 7（见下）
  - [x] SubTask 6.3: 核验另发现两条**已知边界**（发现 cwd 与会话 cwd 可能不同；决策 15 旧理由句被改写），
        已记入决策 B 的残留风险段

- [x] Task 7: 修核验发现的回归 —— 技能根例外不得被 `..` 逃逸
  - [x] SubTask 7.1: 回归确认：`commandTouchesConfigAsCode("Set-Content .pi\\skills\\..\\settings.json y")`
        改动后为 false（改动前 true）
  - [x] SubTask 7.2: `segmentsTouchConfigAsCode` 里「段序列出现 `..` ⇒ 技能根例外一律不生效」，
        注释写明「宁可假阳性」的取舍
  - [x] SubTask 7.3: 补 6 条断言（命中 4：`..` 逃逸路径 / `..` 逃逸命令 / `.agents\skills\..`；
        不命中 2：`.pi/skills/x/SKILL.md`、`.pi\skills\x\SKILL.md` 命令）+
        防过度豁免（`.pi/skills.md` → 命中）
  - [x] SubTask 7.4: 重跑 `npm run typecheck`（exit 0）与两个测试文件（184 passed）；
        护栏变红：把 `escapesSkillRoot` 置 false → 2 例变红 → 已回滚

- [x] Task 8: 全量校验
  - [x] SubTask 8.1: `npm run typecheck`（exit 0）+ `npm run check:deps`（扫描 378 个文件，通过）
  - [x] SubTask 8.2: `npm run check`（exit 0：typecheck / check:deps / check:tokens / check:model-experience
        21 个模块 / check:invariants 24 不变量 + 1 豁免）
  - [x] SubTask 8.3: `npm test` —— `Test Files 146 passed (146)` / `Tests 2643 passed | 1 skipped (2644)`
  - [x] SubTask 8.4: 护栏变红验证已做（Task 1 实施方一次、Task 2 实施方一次、独立核验者复现一次、
        Task 7 修复一次，四次均先红后绿并回滚）
  - [ ] SubTask 8.5: **真实界面人工确认（待用户执行）**：在工作区里造一个项目级技能 → 技能页出现且标
        「本项目」；新建另一个工作区 → 看不到它；再说「要跨项目用」→ 走一次安装询问后用户级可见

# Task Dependencies

- Task 2 / 3 / 4 / 5 的执行顺序见各自 SubTask 内的依赖说明；实际按 1+2+4 → 3 → 5 → 6（核验）→ 7（修复）→ 8 推进
- Task 6 依赖 Task 1–5；Task 7 依赖 Task 6 的发现；Task 8 依赖全部（8.5 需用户执行）

# 明确不做（本轮）

- **不做 `configDir/skills` 的写入放开**（模型直接改用户级技能）：与"已安装技能可被模型编辑"同一话题
  （WorkBuddy 用 `userModified: true` 防覆盖），需要单独的决策与通道设计，另开一轮。
- **不做"技能市场 / 第三方分发"**。
- **不改 `skill_install` / `skill_uninstall` 的权限档与授权边界**。
- **不给技能页加"另存为用户级 / 降级为项目级"的搬迁按钮**。
- **不动 `AGENTS.md` / `SYSTEM.md` 的既有处置**（前者本就放行，后者仍高危）。
- **不修「项目级技能的发现 cwd = 生效根 vs 会话 cwd」的差异**（核验发现的已知边界，见决策 B 残留风险；
  修它要一并定"技能页该展示哪个项目"的产品口径）。
