# 技能双层作用域 + 工作区内技能根写入回归普通口径 Spec

## Why

用户反馈两条，指向同一个问题：**我们比 codex/dsh 更严，严在了很平常的事情上，直接影响体验**。

1. **技能只有一层落点**。今天所有技能都落 `<configDir>/skills`（用户级、跨工作区），模型要造一个
   技能必须走 `skill_install`（每次 medium 询问）。想让"只给这个项目用"的技能就地生效，没有落点。
   对照证据：
   - dsh 两层：项目级 `<projectRoot>/.dsh/skills`、`.agents/skills`（**区内自由写**）；
     用户级 `<dshHome>/skills`（区外直拒，越权要 `sandbox_permissions` + justification 申请）。
   - codex 两层：项目级 `<project>/.codex/skills`、`.agents/skills`；用户级 `$CODEX_HOME/skills`、
     `~/.agents/skills`。
   - WorkBuddy 桌面端：`~/.workbuddy/skills/` 直接写进沙箱 `filesystem.allowWrite` 白名单。
2. **工作区里的技能根被当成可执行配置拦**。pi 原生发现 `<工作区>/.pi/skills` 与 `.agents/skills`
   （`docs/skills.md`），但我们的「配置即代码」名单把 `.pi` 判成**整目录**命中、
   把 `[".agents","skills"]` 判成相邻两段命中（`src/extensions/safe-commands.ts`），
   于是**写一个 SKILL.md = 高风险询问**（每次都问、不能本会话记住）。
   这跟同一类东西的处置**自相矛盾**：pi 会把工作区的 `AGENTS.md` 当项目指令加载
   （pi `docs/extensions.md` 的 `contextFiles`），而写工作区里的 `AGENTS.md` 是**放行**的。
   判据本该是「这个文件**会被执行**或**改变加载行为**」，不是「它在某个目录名下」。

## What Changes

- **技能作用域分两层**（对齐 codex/dsh）：项目级 = 落在**当前工作区**内的技能根
  （`.pi/skills/<name>/`、`.agents/skills/<name>/`），随工作区生效、只在该项目可见；
  用户级 = `<configDir>/skills/<name>/`，跨工作区可用（现状不变）。
- **权限判据收窄**：工作区内的技能根写入回到「普通工作区文件」口径（放行）。
  `.pi` 的其余高危判定（`extensions/**` 加载即执行、`settings.json` 改加载行为、
  `SYSTEM.md` 系统提示词落点）**保持不变**；`.agents/skills` 从名单里移出（连同命令文本闸共用同一份判定）。
- **skill-creator 学会两层**：默认造**项目级**技能（工作区里写完即生效、不弹窗）；
  用户要"跨工作区可用"时才用 `skill_install` 升级到用户级（那一次仍然询问）。
- **技能页标出作用域**（内置 / 本项目 / 用户级），不再把项目级技能混标成「用户自装」。
- **BREAKING**：无。`SkillInfo.origin` 只**新增**一个取值 `"project"`，渲染层同步处理；
  权限名单是收窄不是放宽到无名单（可执行/改加载行为的路径照旧高危）。

## Impact

- Affected specs：`add-skill-management`（技能元数据 / 快照）、
  `rework-skill-ux-workbuddy`（技能可见性与菜单）、`harden-permission-boundary`（权限门阶段 2 的
  「配置即代码」分支）、`add-windows-acl-sandbox`（同一份名单被命令文本闸复用）
- Affected code：
  - `src/extensions/safe-commands.ts`（技能根例外 + 移除 `.agents/skills` 相邻对 + 注释）
  - `src/extensions/permission-policy.ts`（阶段 2「配置即代码」分支的注释与接线；禁区判定不变）
  - `src/shared/settings.ts`（`SkillInfo.origin` 增 `"project"`）
  - 新增 `src/core/skill-scope.ts`（纯函数：按路径判内置 / 本项目 / 用户级，可单测）
  - `src/daemon/index.ts`（`listSkills` 用该纯函数判定 origin）
  - `src/renderer/skills-view.tsx`（卡片作用域文案）
  - `resources/skills/skill-creator/SKILL.md` + 同目录 `README.md`（两层作用域与默认落点）
  - `docs/workbuddy分析/03-plugins-skills.md`（追加决策记录，含 `## 否决方案`）

## ADDED Requirements

### Requirement: 技能双层作用域

系统 SHALL 支持两种技能作用域，并按**技能落点**判定，SHALL NOT 按目录名猜测：

- **项目级**：落在当前会话工作区内的技能根（`.pi/skills/<name>/`、`.agents/skills/<name>/`），
  随该工作区生效、只在该项目可见；
- **用户级**：落在 `<configDir>/skills/<name>/`，跨工作区可用；
- 随包技能（`resources/skills`、`resources/plugins`）仍是**内置**，不属于以上两层的用户可见语义。

技能快照 SHALL 如实标出每个技能的作用域，三者互不混淆。

#### Scenario: 造一个项目级技能

- **WHEN** 模型或用户在工作区里创建 `.pi/skills/weekly-report/SKILL.md`
- **THEN** 该技能出现在技能页并标为「本项目」，在**当前工作区**的会话里可 `/skill:weekly-report`
  调用，且不消耗一次安装审批

#### Scenario: 别的项目看不到

- **WHEN** 用户切到另一个工作区
- **THEN** 上面那个项目级技能不出现在技能列表与该会话的技能清单段里

#### Scenario: 升级为用户级

- **WHEN** 用户说「这个技能我别的项目也要用」
- **THEN** 模型走 `skill_install` 把它装进用户级（一次询问，带来源路径），此后跨工作区可用

#### Scenario: 落点判定不靠目录名

- **WHEN** 一个技能的 SKILL.md 落在工作区内的 `.pi/skills/` 下
- **THEN** 它的作用域是「本项目」；落在 `<configDir>/skills/` 下才是「用户级」

### Requirement: 工作区内技能根写入按普通工作区文件处置

「配置即代码」的判据 SHALL 是「该文件**会被执行**或**改变加载行为**」，SHALL NOT 是「它在某个目录名下」。

- `<任意层级>/.pi/skills/**` 与 `<任意层级>/.agents/skills/**` 的写入 SHALL 与工作区内其它文件同等
  （放行，不弹窗）；同一份判定被**命令文本闸**复用，故 `Set-Content .pi\skills\x\SKILL.md` 同样放行。
- `.pi/extensions/**`（加载即执行）、`.pi/settings.json`（改加载行为）、`.pi/SYSTEM.md`（系统提示词落点）、
  `.git/**`、`.github/**`、`.vscode/**`、`package.json`、`.npmrc`、`.envrc`、`makefile`、
  `node_modules/.bin/**` 等既有高危判定 SHALL 保持不变。
- 凭据目录与 `<configDir>` 的读写禁区 SHALL 保持不变（技能根例外 SHALL NOT 波及它们）。

#### Scenario: 写技能正文不再弹高危

- **WHEN** 模型写 `<工作区>/.pi/skills/x/SKILL.md`（或 `.agents/skills/x/SKILL.md`）
- **THEN** 权限门放行，不产生任何询问

#### Scenario: 可执行配置仍然高危

- **WHEN** 模型写 `<工作区>/.pi/extensions/a.ts`、`<工作区>/.pi/settings.json`
  或 `<工作区>/.pi/SYSTEM.md`
- **THEN** 仍然是高风险询问（不可本会话记住）

#### Scenario: 不误伤同名近似目录

- **WHEN** 目标路径是 `<工作区>/foo.pi/skills/a.md` 或 `<工作区>/.agents/notes/a.md`
- **THEN** 判定与「技能根例外」无关，按原有名单处置（不因为字符串里出现 `.pi` / `skills` 就被特殊化）

#### Scenario: 命令文本闸与写侧同一口径

- **WHEN** 模型通过 powershell 执行 `Set-Content .pi\skills\x\SKILL.md -Value y`
- **THEN** 不触发「配置即代码」文本闸（与写侧一致）；而 `Set-Content .pi\settings.json y` 仍触发

### Requirement: skill-creator 引导两层作用域

`skill-creator` SHALL 说明两种落点与默认选择：

- **默认项目级**：产出到 `<工作区>/.pi/skills/<name>/`，写完即被发现、无需安装；
- **要跨工作区**：再用 `skill_install` 升级到用户级（入参仍是工作区里那个技能目录），
  并说明那一步会弹一次询问、装完立即可用、同时打一份 zip 供分享。

#### Scenario: 用户只说「帮我做个技能」

- **WHEN** 用户说「帮我做一个周报技能」
- **THEN** 模型默认产出项目级技能并告知「只在这个项目里可用；要别的项目也用，我再装到用户级」

#### Scenario: 用户要求跨项目

- **WHEN** 用户明确说「所有项目都要用」
- **THEN** 模型产出技能后走 `skill_install` 装到用户级，并把结果（技能名 / 安装位置 / 触发方式 / zip）回报

## MODIFIED Requirements

### Requirement: 技能来源分类（`SkillInfo.origin`）

原「只分随包（`builtin`）与用户自装（`user`）两类」改为「分 `builtin` / `project` / `user` 三类」：
`builtin` = 随包技能根（`resources/skills`、`resources/plugins`）；`project` = 落在**当前会话工作区**内；
其余（含 `<configDir>/skills`、`~/.agents/skills` 等用户级位置）归 `user`。
判定 SHALL 走一个可单测的纯函数，SHALL NOT 在 daemon 里内联一段路径前缀比较。

#### Scenario: 技能页显示三种来源

- **WHEN** 技能页同时存在随包技能、工作区里的项目级技能、用户级技能
- **THEN** 卡片分别标为「内置」「本项目」「导入 / 手工放置」，不出现把项目级标成「用户自装」的错位

### Requirement: 权限判据的精度（「配置即代码」名单）

原名单把 `.pi` 判成**整目录**命中、把 `.agents/skills` 判成相邻两段命中（理由写的是「技能正文 = 提示词，
被改写即提示注入的持久落点」）。该理由 SHALL 收窄为：**只保留「会被执行 / 改变加载行为」的路径**；
技能正文与工作区里其它会被读进上下文的文本（如 `AGENTS.md`）同等处置。
名单 SHALL 仍然精确（不因为`.pi`/`skills` 出现在任意位置字符串里就命中）。

#### Scenario: 名单精度不回退

- **WHEN** 判定 `<工作区>/packages/sub/package.json`、`<工作区>/.git/config`
- **THEN** 仍判高危（与本次改动前完全一致）

## REMOVED Requirements

### Requirement: `.agents/skills` 视为可执行配置

**Reason**：pi 只把 `.agents/skills` 当**技能根**（纯文本，加载时不执行任何东西；其中的脚本要跑必须
另过 powershell / 受控运行时这条已有的闸）。把它与 `.pi/extensions`（加载即执行）同等对待，
代价是"很平常的写技能被当高危拦"，收益与代价不匹配 —— 与 dsh 的项目技能根可写、WorkBuddy 桌面端
allowWrite 白名单一致。
**Migration**：无迁移动作；已按旧口径被拦过一次的场景自动变为放行。可在项目内直接写技能文件。
