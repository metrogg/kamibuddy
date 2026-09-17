# skill-creator — 技能脚手架（自研）

## 来源与状态

**自研。** 机制参考 WorkBuddy 的 `skill-creator`（init / package / validate 三个脚手架脚本 +
一份 SKILL.md 编写规范），但**本轮未移植它的任何文件**：文字是照我们的代码约定重写的，
脚本一行未搬（用户决策：本轮不移植 WorkBuddy 文件，只做机制；见
`.trae/specs/add-skill-management/spec.md` 的 What Changes 末条）。

**状态：最小版，只有 `SKILL.md`。** 本轮不做 `init` / `package` / `validate` 脚本 ——
我们的**导入即校验**（`src/core/skill-install.ts` 的 `importSkill`：名字规则、description 必填、
同名拒绝），SKILL.md 里的「导入失败原样报出」一节就是把这件事告诉模型，不需要另一套校验脚本。
如要完整版（脚手架脚本 + 打包），走单独的移植 spec。

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
| 名字规则、description 必填、同名拒绝、错误原文 | `src/core/skill-install.ts` |
| frontmatter 的写法限制（子集） | `src/core/frontmatter.ts` |
| 两个可见性字段的语义 | `src/daemon/index.ts`（`/` 菜单与清单段）、`src/extensions/use-skill-tool.ts` |
| 技能页的导入入口 | `src/renderer/skills-view.tsx` |

导入时会在目标技能目录里写一份 `_installed.json`（名字 / 版本 / 来源路径 / 导入时刻），
它不是技能内容 —— pi 只读 `SKILL.md`，它也不进 `/` 菜单与技能清单段。
