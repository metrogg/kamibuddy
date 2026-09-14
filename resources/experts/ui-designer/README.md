# UI 设计师（ui-designer）—— 来源与搬用说明

## 来源

本专家**原样搬用**自 WorkBuddy 专家市场包 `ui-designer`：

- 原始路径：`plugins/marketplaces/experts/plugins/ui-designer/`
- 搬入日期：2026-09-14
- 人设：`agents/ui-designer.md` 的**正文原样**（源 frontmatter 中的 `color` / `emoji` /
  `vibe` 随 frontmatter 一并剥离；本目录 `expert.md` 的 frontmatter 为本项目按加载器契约新写）。
- frontmatter 取值：`displayName` / `profession` / `displayDescription` / `tags` / `quickPrompts`
  均取自源包 `plugin.json` 的 `zh` 字段（`tags`、`quickPrompts` 各取前 3 个）。

## 含哪个技能

- `impeccable` —— 高品质 UI/UX 设计工具集（视觉风格、布局排版、动效交互、质量保障、
  设计系统，含 30 个 `references/*.md` 深入参考），逐字节原样复制。

## 丢弃了哪些技能及原因

源包 `plugin.json` 声明 3 个技能，本轮只搬 `impeccable`：

| 丢弃技能 | 原因 |
|----------|------|
| `frontend-dev` | 体积 5.4 MB（98 个文件，绝大多数为 `canvas-fonts/` 字体文件）；且 `scripts/` 下 4 个脚本（`minimax_image.py` / `minimax_music.py` / `minimax_tts.py` / `minimax_video.py`）依赖 **MiniMax 图像/音乐/语音/视频 API** 与账号凭证，`references/` 亦以 MiniMax CLI 使用手册为主，不随包发布可用的运行时，不可移植。 |
| `browser-use` | 需要**浏览器自动化**能力（`references/cdp-python.md` / `multi-session.md`，基于 Chrome DevTools Protocol 驱动真实浏览器），本项目当前无对应运行时与权限面，不可移植。 |

## `impeccable` 可移植性判断依据

判定为**纯提示词技能，可原样搬**，依据：

- 目录内**只有** `SKILL.md` + `references/*.md`，**无 `scripts/`、无二进制、无模板**；
- 全目录检索无 `minimax` / `api_key` / `API_KEY` / `npx` / `curl` / `scripts/` 命中；
- 出现的 URL 全部是**文档引用链接**（GitHub 项目主页、impeccable.style、WebAIM 对比度检查器、
  Polypane、Fontaine、Wakamai Fondue），非运行时依赖；
- `SKILL.md` 的 `allowed-tools: Read,Write,Bash` 只是技能声明自身可用工具（本项目加载器只读
  其 `name` 字段），非外部依赖。

## 待定制项

- 人设正文「内置 Skill 使用场景」一节仍列有 `brand-guidelines` / `frontend-dev` /
  `canvas-design` 三个**本仓库未随包发布**的技能，与实际随包技能（仅 `impeccable`）不一致，
  待后续定制对齐。
- 正文为**英文**原文，待中文化。
- `quickPrompts` 第 1 条源自插件市场清单，其英文原文用**半角逗号**分隔中文短语；
  本项目的极简 frontmatter 解析器按逗号切分行内数组，会把一条拆成三条，故已将该条内的
  半角逗号规范为中文全角逗号（文案语义不变）。其余两条无逗号，原样。

## 合规说明

按 AGENTS.md §6（2026-09-10 用户决策）：内部使用阶段允许直接搬用 WorkBuddy 资产，
正式上线前由专人做风险置换。本目录人设与 `impeccable` 技能均属该阶段的直接搬用资产。
