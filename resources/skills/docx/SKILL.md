---
name: docx
description: "专业 Word 文档（.docx）创作与交付助手。用于生成周报、研报、论文、公文、合同、商务报告等专业 Word 文档并自动排版，或对已有文档内容重新排版导出 .docx。当用户提到写文档、生成 Word、写周报/月报/年终总结、排版美化、导出 docx 时使用。"
---

# KamiBuddy Docx —— 专业 Word / Docx 文档创作与交付

> 端到端 **Word / Docx 文档（.docx）** 能力：从**专业创作 → 专业排版 → 转换交付**全流程编排。
> 必须依赖 [orchestrator SKILL](./orchestrator/SKILL.md)（`<docx_root>` = 本文件所在目录）。

---

## ⛔ 强制执行规则（MUST — 不可跳过、不可简化、不可"觉得简单就直接做"）

**本 Skill 被加载后，你的下一步动作必须是：read `./orchestrator/SKILL.md` 并严格按其 Stage 0 流程执行。**

（空白文档请求也不例外——同样进 orchestrator 判断，短篇/空白由 brief-compose 通道承接。）

### 禁止行为（违反即视为 Bug）

1. **禁止跳过 orchestrator 直接动手** — 无论任务多简单（哪怕只是"写个 200 字通知"），都必须先走 orchestrator 的 Stage 0 入口判断。
2. **禁止在 thinking 中自行判断"这个任务简单，不需要走流程"** — 简单/复杂由 orchestrator 内部的入口判别决定，不是你决定。
3. **禁止用 powershell 跑 python 做 HTML→DOCX 转换** — 转换只许调 `docx_convert` 工具（daemon 托管 venv 的受控通道，环境自动准备）。
4. **禁止"先调一下工具看看再说"** — 任何试探性调用都违反流程。

### 正确的执行顺序（唯一合法路径）

```
1. read ./orchestrator/SKILL.md              ← 你现在必须做这一步
2. 按 orchestrator Stage 0 判断入口类型
3. 按 Stage 链路由到对应角色/通道
4. 由下游（doc-writer / doc-formatter / doc-converter / brief-compose）决定具体工具调用
```

## 能力覆盖 —— 专业 Word / Docx 文档全流程

1. **生成专业 Word 文档**：从头创作研报 / 年报 / 论文 / 公文 / 合同 / 商务报告 / 会议纪要 / 周报月报等垂类专业 .docx，自动生成封面、目录、专业排版。
2. **排版与交付**：内容经 design-token 查表 + 模板排版产出 HTML，再经 `docx_convert` 转出本地专业级 .docx，并 `present_files` 强制打开预览。
3. **已有文档的改动**：编辑/润色/重排不进流水线，由 orchestrator Stage 0 识别后**直接在当前会话用 read/edit 完成**（要回 .docx 时重排后经 `docx_convert` 转换）。

## 目录地图（本技能内的全部资产）

```
<docx_root>/
├── orchestrator/      # 编排入口（Stage 0 路由 + pipeline-state 协议）
├── agents/            # doc-writer / doc-formatter / doc-converter 三个子角色
├── brief-compose/     # 短篇（<1000 字）快速通道
├── experts/           # 9 个文体专家（S1 创作路由）
├── engines/           # critic-generator / deep-research 两个共享引擎
├── design-token/      # 样式决策查表（skill 说明 + 预编译脚本）
├── tokens/            # 预编译 design tokens（compiled/ 运行时直读）
├── typeset/           # 8 模板骨架 + 4 装饰组件 + 8 排版 prompt
└── html-review/       # HTML 静态门禁（纯 stdlib 脚本 + 规则 references）
```

---

**现在立即执行：read `./orchestrator/SKILL.md`**
