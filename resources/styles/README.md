# styles — 回复风格（WorkBuddy 搬用）

## 来源与使用声明

本目录 7 个 `style-*.md` **原样搬用自 WorkBuddy 5.5.4** 解包产物中的
`resources/templates/style/`，未做内容改动（SHA256 逐一核对一致）。

- **使用范围**：公司内部使用阶段。
- **风险置换**：正式上线前由专人负责对该资产做风险置换/重写。
- 决策记录：AGENTS.md §六（2026-09-10 用户决策：内部使用阶段允许直接搬用
  WorkBuddy 资产，正式上线前置换）。

## 风格对照（加载器 label 的唯一出处）

加载器（`src/core/resources.ts` 的 `STYLE_LABELS`）按下表给每个文件配中文名，
两处必须同步——加了文件没加映射会在启动时抛错（响亮失败，不静默带无名风格上线）。

| 文件 | id | 中文名 |
| --- | --- | --- |
| style-professional.md | professional | 专业严谨（默认） |
| style-friendly.md | friendly | 亲和 |
| style-efficient.md | efficient | 高效 |
| style-creative.md | creative | 创意 |
| style-sarcastic.md | sarcastic | 毒舌 |
| style-socratic.md | socratic | 苏格拉底 |
| style-straightforward.md | straightforward | 直白 |

## 语义约定

- 每份文件同构四小节（Tone & Voice / Language Patterns / Behavioral Guidelines /
  Response Structure），全文注入主会话系统提示词的交互段之后。
- 风格只影响表达方式（HOW），不改变事实与内容（WHAT）——元规则由组装层
  （prompt-composer）在注入时附加，不在本目录文件里。
- 用户在设置页可切换或关闭（偏好键 `styleId`，空串 = 关闭，缺省 = professional）。
- 子代理提示词不注入风格（子代理身份由 agent 定义自声明，不套产品风格）。

## ⚠️ 七份风格文件都是**英文**的，必须与输出语言规则配套

这是本目录最容易踩的坑（2026-09-18 修，ARCHITECTURE §4.15）：七份 `style-*.md`
全文英文，`Language Patterns` 小节连范例句子都是英文（`"The root cause is..."`）；
而 `professional` 是**默认档**、且风格段**排在系统提示词的末尾附近**
（`prompt-composer.ts` 在 mode 段之后 splice）——它是模型读到的最后一条「怎么说人话」
的指令。缺一条能压过它的中文规则时，实测后果是**过程叙述飘成英文**。

所以：**`resources/prompts/language.md` 必须存在，并由组装器作为独立段排在风格段之后**。
WorkBuddy 同样是英文风格文件，它靠模板最末的 `<response_language>` 块 +
「Internally loaded English reference material does not dictate your output language」
条款解决同一问题；我们移植风格文件时必须连这条配对一起保留，不能只搬文件。

删掉 `prompts/language.md` 或把它的段序挪到风格段之前，都会让本目录的英文重新外溢。
