# Checklist

- [x] 权限门对工作区内的技能根写入**放行**：`.pi/skills/**` 与 `.agents/skills/**` 下写文件不产生询问
- [x] 可执行 / 改加载行为的路径**仍然高危**：`.pi/extensions/**`、`.pi/settings.json`、`.pi/SYSTEM.md`、
      `.git/**`、`.github/**`、`.vscode/**`、`package.json`、`.npmrc`、`.envrc`、`makefile`、
      `node_modules/.bin/**` 一律照旧高风险询问（不可本会话记住）
- [x] 例外是**相邻段**匹配：`foo.pi/skills/a.md`、`.agents/notes/a.md` 不被特殊化；
      `.pi/skills.md` 仍命中（证明段名必须严格是 `skills`，不是前缀）
- [x] 命令文本闸与写侧同口径：`Set-Content .pi\skills\x\SKILL.md …` 不触发；`.pi\settings.json` 触发
- [x] **技能根例外不得被 `..` 逃逸**（核验发现并修复）：`.pi\skills\..\settings.json`（路径）与
      `Set-Content .pi\skills\..\extensions\evil.ts y`（命令）都**命中**配置即代码；
      段序列出现 `..` 时例外一律不生效
- [x] 凭据目录与 `<configDir>` 的读写禁区**未被波及**（`permission-policy.ts` 阶段 1 零改动，既有断言全绿）
- [x] `SkillInfo.origin` 有 `builtin` / `project` / `user` 三态，判定走 `src/core/skill-scope.ts` 纯函数
      （daemon 里不再内联路径前缀比较；全仓无第二处 origin 计算）
- [x] 作用域判定按**落点**：工作区内的技能 → `project`；`<configDir>/skills` → `user`；
      `~/.agents/skills` 等区外用户级位置兜底为 `user`（不会被误标成 project）
- [x] 项目级技能在**三处**都能用：`/` 菜单、系统提示词技能清单段、`use_skill` 加载（同一出口 `listSkills`）
- [x] 项目级技能**不出现在别的工作区**（`skill-scope.test.ts` 用 pi 真实入口 `loadSkills({cwd})` 证明：
      换 cwd 后该技能消失）
- [x] 技能页卡片标出「内置 / 本项目 / 导入 / 手工放置」，无「项目级被标成用户自装」的错位
- [x] skill-creator 的 SKILL.md 讲清两层与默认选择（默认项目级；跨工作区才走 skill_install 升级），
      README 的对应关系表已同步指向新代码
- [x] `npm run typecheck`（exit 0）/ `npm run check:deps`（378 文件通过）/ `npm run check`（exit 0）全过
- [x] `npm test` 全绿：`Test Files 146 passed (146)` / `Tests 2643 passed | 1 skipped (2644)`
- [x] 护栏变红验证已做（四次，均先红后绿并回滚）：去掉技能根例外 → Task 1 用例变红；
      改坏 `skillScopeOf` 的 project 分支 → Task 2 用例变红；独立核验者复现其中一次；
      去掉 `..` 判定 → Task 7 新用例变红
- [x] `docs/workbuddy分析/03-plugins-skills.md` 的决策 B 含证据链与 `## 否决方案（决策 B）`；
      证据路径逐个可核（含 pi 的 `dist/core/*.js` 行号与 codex 的 `permission.rs` 常量）；决策 15 结论未被改动，
      只修正事实描述并链接决策 B；`docs/workbuddy对齐清单.md` E4 行已同步
- [x] 核验发现的两条**已知边界**已如实记入决策 B 的残留风险段：① 命令文本闸防字面量、防不住变量拼接；
      ② 项目级技能的发现 cwd（生效根）与会话 cwd 可能不同（未修，需单独一轮定产品口径）
- [ ] 真实界面人工确认（**待用户执行**）：造项目级技能 → 技能页标「本项目」且立即可 `/skill:` 调用；
      换工作区不可见；要求跨项目时走一次安装询问后用户级可用
