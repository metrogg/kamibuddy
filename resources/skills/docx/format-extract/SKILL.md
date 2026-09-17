---
name: format-extract
description: "把一份既有 .docx 提取成语义化 HTML + 图片目录，供「照这份文档的版式写新内容」的场景复用版式。由调用方（orchestrator / doc-formatter）在确认需要复用既有 .docx 的版式时调用；本技能自身不做触发判断，也不由模型自动唤起。"
version: "1.0.0"
user-invocable: false
disable-model-invocation: true
---

# format-extract —— .docx 版式提取

> 唯一职责：**一份 .docx → 一份语义化 HTML + 一个图片目录**。
> 提取出来的 HTML 是**版式参考**，不是最终交付物；重排与交付由调用方继续走
> design-token / typeset / `docx_convert`。

## 职责边界（三条不许越）

1. **不自行判断该不该触发。** 什么时候需要原文档的版式，由 orchestrator 的
   「编辑就地处理 → 整篇美化/重排」子路径决定；用户关于「排版 / 套模板 / 参考这份文档」
   的诉求统一由 orchestrator 编排，**不许旁路直调本技能**。
2. **不猜产物落点。** `outputPath` 必须由调用方显式给出（流水线里是调用方约定的
   `<工作空间>/output/<任务名>/…`），本技能既不提供默认落点，也不改调用方给的路径。
3. **不做 HTML 质量评估、不做重排、不做格式转换。** 质量门禁是 `html-review` 的职责，
   重排是 `doc-formatter` 的职责，转换只许调 `docx_convert` 工具。

## 调用契约

| 项 | 值 |
|---|---|
| 工具 | `docx_extract`（唯一合法通道；不许用 powershell 跑 python 代替） |
| `docxPath` | 必填，输入 .docx 的绝对路径 |
| `outputPath` | 必填，产出 HTML 的绝对路径（**落点由调用方定**） |
| `assetsDir` | 可选，图片目录；缺省 `<HTML 所在目录>/<HTML 名去扩展名>_assets` |

- 产物落调用方指定的目录；**相对路径基准 = `outputPath` 所在目录** ——
  HTML 里的图片引用已按这个基准写成相对路径（缺省布局下形如 `doc_assets/images/image1.png`），
  把 HTML 的目录当 base_dir 就能找到图；`docx_convert` 也按同一约定解析相对路径。
- 首次调用会先准备托管 Python 环境（幂等；已就绪秒退，冷启动约 1-3 分钟），
  要把这段等待如实告知用户。
- 结果里的 `warnings` 与 `not_restorable` **都要如实转述**，不许吞掉其中任何一条。

## 产物形状

- 完整 HTML5 文档（`<!DOCTYPE html>` + `<head>` + `<body>`），正文的根内容元素是
  `<article class="docx-content">`（与 typeset 对接的同一约定）。
- 样式一律 **inline style**（不外链 CSS、不引 design token）：它是「原文档长什么样」的快照，
  不是可交付的排版结果。
- 保结构的部分：标题层级 `h1..h6`；段落（文本 + 缩进 + 对齐 + 字号 + 字体 + 加粗/斜体/颜色）；
  有序与无序列表（含层级）；表格（`thead`/`th` + `tbody`/`td` + 基础边框）；
  图片（`<img>`，尺寸取自原文）；空段落保留为 `<p>&nbsp;</p>`。
- 图片落在 `assetsDir/images/` 下，HTML 里用相对路径引用。

## 已知不可复原项（与工具返回的 `not_restorable` 一致）

固定词表（**原文确实有才报** —— 别把这份清单当成「每次都丢这些」）：

页码 / 页眉页脚 / 分节 / 浮动对象（文本框、形状）/ 域代码 / 图表 / 脚注-尾注 / 批注 / 修订痕迹

一定会发生的降级（工具会以 `warnings` 形式说明）：

| 项 | 降级后的样子 |
|---|---|
| 合并单元格（gridSpan / vMerge） | 不还原合并，按展开的矩形输出，文本可能重复 |
| 单元格内的嵌套表格 | 不提取，只保留单元格文本 |
| 超链接 | 只保留文字，**链接地址丢失** |
| 浮动图片（w:anchor） | 按行内图片提取，原始位置与环绕方式未复原 |

调用方**不许承诺 1:1 还原**：用户问「能不能完全还原我这份文档的版式」时，按上表如实回答可复原项与不可复原项。

## 失败处理

- **环境类**（`env-not-ready`）：按错误里的引导告知用户原因，不要反复重试（每次都会重跑安装）；
  需要继续原任务时可改用 `read_document` 读文本内容。
- **输入类**（`input-invalid`：路径不存在 / 不是 .docx / 不是 zip 容器 / 主文档缺失）：
  如实说出文件名与原因 —— 这类失败**重试无用**，只支持 .docx（旧版 .doc 请先另存为 .docx）。
- **提取类**（`extract-failed`）：原文档有引擎未覆盖的结构，如实转述原因；
  可改用 `read_document` 读文本继续任务的其余部分，不要重复调用。
- 任何一类都**不许为了「跑通」而改产物落点、伪造 HTML，或退回用 powershell 跑 python**。
