# skill-creator — 技能脚手架（自研）

## 来源与状态

**自研。** 机制参考 WorkBuddy 的 `skill-creator`（init / package / validate 三个脚手架脚本 +
一份 SKILL.md 编写规范），但**本轮未移植它的任何文件**：文字是照我们的代码约定重写的，
脚本一行未搬（用户决策：本轮不移植 WorkBuddy 文件，只做机制；见
`.trae/specs/add-skill-management/spec.md` 的 What Changes 末条）。

**状态：最小版，只有 `SKILL.md`。** 本轮不做 `init` / `validate` 脚本 ——
我们的**导入即校验**（`src/core/skill-install.ts` 的 `importSkill`：名字规则、description 必填、
同名拒绝 / 模型自建的覆盖），SKILL.md 里的「失败原样报出」一节就是把这件事告诉模型，
不需要另一套校验脚本。

**打包已做，但不是脚本**（2026-09-18）：`skill_install` 装完会顺手调
`src/core/skill-pack.ts` 把技能目录打成 `<工作区>/<技能名>.zip`（布局照 WorkBuddy 的
`package_skill.py`：zip 内带技能目录名作根），交付由 `present_files` 负责；
删技能走 `skill_uninstall`（`src/extensions/skill-uninstall-tool.ts`）。
决策与偏离见 `docs/workbuddy分析/03-plugins-skills.md` 的「决策 A」。

**两层作用域（2026-09-18 起）**：技能分**项目级**（`<工作区>/.pi/skills/`、`.agents/skills/`，
只在该工作区可见、写完即被发现、不弹审批）与**用户级**（`<configDir>/skills/`，跨工作区，
写入走 `skill_install` 弹一次询问）。SKILL.md 的 §七 写的就是这套口径：**默认造项目级**，
用户明确说「所有项目都要用」时才升级到用户级。

## 目录布局

```
resources/skills/skill-creator/
  SKILL.md             # 本技能的全部内容（约定 + 闭环 + 失败对照表）
  README.md            # 本文件：来源声明（AGENTS.md §6）
```

没有 `references/` / `scripts/` / `assets/`：正文本身就在描述「怎么建这三个目录」，
自己再建一套空目录只会误导读者。

## 与代码的对应关系（改 SKILL.md 时同步）

| SKILL.md 里写的约定 | 代码里的真源 |
|---|---|
| 名字规则、description 必填、同名拒绝 / 覆盖、删除授权、错误原文 | `src/core/skill-install.ts` |
| 打包布局（zip 内以技能目录名为根、排除 sidecar） | `src/core/skill-pack.ts` |
| 两层作用域的判定（内置 / 本项目 / 用户级） | `src/core/skill-scope.ts` |
| 工作区技能根写入按普通工作区文件放行（技能根例外） | `src/extensions/safe-commands.ts`（`.pi/extensions/**`、`.pi/settings.json`、`.pi/SYSTEM.md` 仍高危，这一区分不在 SKILL.md 正文里） |
| 两个工具的名字 / 入参 / 返回文案 | `src/extensions/skill-install-tool.ts`、`src/extensions/skill-uninstall-tool.ts` |
| 权限档（装 / 删都询问）与 craft 白名单 | `src/extensions/permission-policy.ts`、`resources/modes/craft.md` |
| frontmatter 的写法限制（子集） | `src/core/frontmatter.ts` |
| 两个可见性字段的语义 | `src/daemon/index.ts`（`/` 菜单与清单段）、`src/extensions/use-skill-tool.ts` |
| 技能页的导入入口 | `src/renderer/skills-view.tsx` |

导入时会在目标技能目录里写一份 `_installed.json`（名字 / 版本 / 来源路径 / 导入时刻 /
是否模型创建 `agentCreated`），它不是技能内容 —— pi 只读 `SKILL.md`，它也不进 `/` 菜单
与技能清单段，打包时也不会进 zip。
