---
name: brief-compose
description: |
  短篇文档创作（目标篇幅 <1000 字）：从零撰稿 → 生成 HTML → docx_convert 转 .docx → present_files 预览。
---

# brief-compose Skill

**何时走**：无已有文档 + 创作动词（写/起草/撰写/生成/重写）+ 模型判断目标篇幅 <1000 字。

> **⛔ 工作流锁定**：一旦判定任务属于本 skill，**无视**其他 skill 与子角色，**严格按本文从头到尾执行**；无需再读其他 skill。
>
> 📁 本文件中 `<docx_root>` = docx 技能根目录（`resources/skills/docx/`）。

---

## 篇幅判据

创作动词已命中、且非编辑意图时，满足任一即走本工作流：

- 用户给出 X 字且 X < 1000
- 「短篇 / 千字以内 / 简版」等表述
- 体裁为简介 / 通知 / 备忘录 / 工作小结等典型短篇

显式长篇（≥1000 字、万字、研报、论文等）→ 未命中本 skill，回到 `<docx_root>/orchestrator/SKILL.md` 走常规编排。
---

## 原则

1. **强制流程（速览）**（完整步骤见文末「强制流程」）：
   - ① 撰稿 + 生成 HTML
   - ② 调用 docx_convert 转换
   - ③ `present_files`
2. **中间产物不展示**：`.html` 不得 `present_files`、不得在回复里贴 HTML 正文；只有最终 `.docx` 可展示。
3. **失败如实报错**：HTML 无 `<body>` → 终止并提示；用户明确要求新建空白文档时允许转换；其他创作请求若 body 无可渲染正文，必须重新生成 HTML。**禁止**静默降级到常规 full_pipeline 编排。
4. **最终交付**：`.docx` 生成后**必须立即** `present_files` 打开预览，无例外。
5. **输出路径**：工作流开始时按下节约定确定 `output_docx_path`，用于 docx_convert 与 `present_files`。

---

## 输出路径（`output_docx_path`）

- 用户指令显式给出路径 → 用该路径（绝对路径）。
- 用户未指定 → `<工作区>/output/<主题>.docx`（文件名按主题决定；本工作流不走 pipeline 隔离目录）。

父目录用 write 工具创建（写入第一个文件时自动建立）。

## HTML 生成

按用户创作指令撰写正文，输出**完整 HTML 文件**（`<!DOCTYPE html>`、`<head>` 含 `charset`、内嵌 `<style>` 均可，UTF-8、无 BOM）。篇幅控制在用户给出的 X 字以内。

**最低要求**：必须有 `<body>` 且含实际正文；用户明确要求新建空白文档时例外。其他创作请求若生成后 body 无可渲染正文，必须重新生成 HTML，禁止转换或交付空 docx。

**其余版式**（标题层级、段落样式、是否用表格分栏等）由模型自行决定，无固定骨架。

### 字体与字号建议

字号请用 **`pt`（磅）**，**不要用 `px`**。转换器按 pt 写入 Word；常见误用 `13px` 在 Word 里约 **9.5pt**，正文偏小。

| 层级 | 建议字号 | 建议字体 |
|------|----------|----------|
| 正文 `p` / `li` / `td` | **12pt**（默认） | 宋体 / SimSun |
| 一级标题 `h1` | 18–22pt | 黑体 / SimHei |
| 二级标题 `h2` | 14–16pt | 黑体 / SimHei |
| 三级标题 `h3` | 12–14pt | 黑体 / SimHei |
| 辅助说明、落款 | 10–10.5pt | 宋体 / SimSun |

- 用户未指定字号时，正文**默认 12pt**，不要小于 **10.5pt**。
- 因转换器**块级 CSS 不继承**（见下节），`font-size` / `font-family` 须写在各 `p`、`h1`、`h2`、`li`、`td` 等块级元素上，不要只写在 `body` 上。

---

## HTML → docx 转换约束（仅引擎硬限制）

以下规则来自转换器能力边界；**违反会导致 docx 排版错乱或信息丢失**，其余 HTML/CSS 写法不受限。

### 1. 禁止 Grid / 定义列表

- **禁** `display:grid` / `grid-template-*` → 多列对齐改用 `<table>`
- **禁** `<dl>/<dt>/<dd>` → 键值对改用两列 `<table>`

### 2. 块级 CSS 不继承

转换器**不做**块级样式继承。父元素上的 `text-align` / `font-family` / `color` / `font-size` **不会**下发到子 `<p>` / `<h1>` 等；需要生效的样式请写在各块级元素自身上。

### 3. `<hr>` 装饰线

`<hr>` 在 docx 中只能变成**满版下边框**，无法保留居中短线/定宽装饰线；不要用 `<hr>` 做标题区装饰分隔。

### 4. 左边框段落

带 `border-left` 的块，文字开头加 `&nbsp;&nbsp;`（Word 左边框无可靠间距）。

### 5. 多段落底纹块

整块底纹 + 多段落富文本 → 用裸单列 `<table><tr><td>…</td></tr></table>`，不要用多个 `<div>` 拼底纹。

### 6. 分节 / 页眉页脚（仅需要时）

- 需要分页结构：顶层 `<section role="...">`（无 section 则单节）
- 需要页码/页眉：`<style>` 内 `@page` 子集（`counter(page)` / `counter(pages)` / `string-set` + `STYLEREF`）
- **不支持** `@page :first`、`@page { size }` 等扩展语法（忽略 + warning）
- 需要封面时用户须明确要求；配合 `@page cover { … content: none }` + `section[role="cover"] { page: cover; }`

### 7. 可选扩展标签（用了才需遵守其契约）

| 标签 / 属性 | 说明 |
|-------------|------|
| `<div data-component="callout\|divider\|section-marker\|data-card">` | 装饰组件 |
| `<span data-docx-field="..." data-placeholder="...">` | 转 docx 书签；同 HTML 内唯一，匹配 `^[A-Za-z][A-Za-z0-9_-]{0,63}$` |
| `<meta name="docx-page-size" content="A4">` | 声明页面尺寸（默认 A4） |

---

## docx_convert 转换

**唯一合法转换通道：`docx_convert` 工具**（daemon 托管 venv Python 跑引擎的受控通道；环境未就绪时它会自动准备）。**禁止用 `powershell` 跑 python/uv 做转换。**

```
docx_convert({
  htmlPath: "<html 绝对路径>",
  outputPath: "<output_docx_path>",
  pageSize: "A4",            // A4 / Letter / A3，默认 A4
  orientation: "portrait",   // portrait / landscape，默认 portrait
  margins: { top: 2.54, bottom: 2.54, left: 3.17, right: 3.17 }  // cm，可选
})
```

- 成功：`success: true` + `docx_path` + `warnings`
- 失败：`success: false` + `error` + 可选 `markdown_fallback`（含环境未就绪/无外网装不了依赖等情况，如实告知用户，不静默）

---

## 强制流程

```
① 确定 output_docx_path（按 §输出路径 约定）并预建父目录
② 撰稿 + 生成 HTML
   · 按用户创作指令撰写正文，自行排版
   · 遵守上文「字体与字号建议」与「HTML → docx 转换约束」
   · 写入与 docx 同目录的 <主题>.html（中间产物）

③ HTML → DOCX
   · 调 docx_convert，outputPath 指向 output_docx_path

④ 强制预览
   · 🔒 立即 present_files 打开 output_docx_path
```

```json
{ "files": ["<output_docx_path>"] }
```

未 `present_files` 即结束 = 工作流未完成。

---

## 异常处理

| 场景 | 处理 |
|------|------|
| HTML 无 `<body>` | 终止，提示用户 |
| 用户明确要求新建空白文档且 body 无可渲染正文 | 允许转换 |
| 其他创作请求且 body 无可渲染正文 | 重新生成 HTML，禁止交付空 docx |
| docx_convert 失败 | 返回源 HTML 路径 + `markdown_fallback`（若有），提示手动另存；环境类失败如实告知原因 |
| 用户事后要改内容/样式 | 属**下一轮请求**，直接在当前会话用 read/edit 就地处理 |
| 用户事后要全文重新美化 | 属**下一轮请求**（编辑就地处理：read_document 提内容 → 重排 → docx_convert） |
