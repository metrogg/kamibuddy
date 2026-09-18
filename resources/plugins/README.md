# 预装插件（照搬 WorkBuddy 市场）

首页胶囊点下去要用的能力。WorkBuddy 在发送时会按场景模板的 `plugins` 字段**自动安装**
（`ppt-implement@cb_teams_marketplace` 这种），我们没有那条市场链路，所以改成
**随包预装**：插件原样落在这里，daemon 建会话时把它们纳入技能搜索路径
（`src/core/session-host.ts` 的 `additionalSkillPaths` 加了 `resources/plugins`，
pi 会递归发现所有 `SKILL.md`）。

## 来源

市场：`cb_teams_marketplace`（WorkBuddy 内置市场，zip 型）
市场清单：`https://download.codebuddy.cn/plugin-marketplace/cb_teams_marketplace-56208cc0-5078-4f4d-a6a1-3f92e5306249.zip`
抓取时间：2026-09（与首页数据同一批，见 `resources/welcome/README.md`）

| 插件 | 版本 | 作者 / 许可（plugin.json 原值） | 技能数 | 大小 |
|---|---|---|---|---|
| `document-skills` | 1.0.0 | CodeBuddy Teams / 未声明 | 2（pdf、pdfkit-py） | 538KB |
| `data` | 1.0.0 | CodeBuddy Teams / 未声明 | 8（data-analysis-workflows、data-context-extractor、data-exploration、data-validation、data-visualization、interactive-dashboard-builder、sql-queries、statistical-analysis） | 123KB |
| `deep-research` | 1.0.0 | CodeBuddy Teams / MIT | 1（wechat-article-search） | 62KB |
| `ppt-implement` | 1.0.13 | rackeyyang（腾讯邮箱）/ 未声明 | 1（ppt-implement） | 2.6MB |
| `modern-webapp` | 1.0.0 | CodeBuddy / **Proprietary** | 3（modern-web-app、ui-ux-pro-max、lucide-icons） | 1.0MB |

> `modern-webapp` 声明 Proprietary、`ppt-implement` 未声明许可 —— **上线前风险置换时
> 这两条要点名处理**（AGENTS.md §6：内部使用阶段可搬，上线前专人置换）。

## 与首页胶囊的对应（WorkBuddy 场景模板的 `plugins` 字段原文）

| 我们的胶囊 | WorkBuddy 依赖的插件 | 本目录 |
|---|---|---|
| 文档处理 | `document-skills` | ✅ |
| 数据分析及可视化 | `data-analysis`（市场里实际叫 `data`，API 名是旧的） | ✅ 用 `data` |
| 深度研究 | `deep-research` | ✅ |
| 幻灯片 | `ppt-implement` | ✅ |
| 网站开发 | `modern-webapp` | ✅（除 agent-browser，见下） |
| 日常开发 / CI/CD / 文档 | 无 | — |

## 目录约定

```
resources/plugins/<marketplace>/<plugin>/<version>/
├── .codebuddy-plugin/plugin.json   # 原清单（来源与版本的凭据，本仓库不解析它）
├── skills/<skill>/SKILL.md         # ← 只有这部分被 pi 加载
├── agents/  hooks/  rules/  .genie/  # 原样保留，但我们的运行时目前不消费
```

保持插件原始结构（而不是把技能摊平进 `resources/skills/`）是为了可追溯：
哪个技能来自哪个插件的哪个版本一眼可见。

## 未搬 / 待适配（对比测试时按这张表看）

| 项 | 状态 | 原因 |
|---|---|---|
| `modern-webapp` 的 `agent-browser` 技能 | **未搬** | 它的 `allowed-tools: Bash(agent-browser:*)` 依赖 `agent-browser` CLI（playwright 系），我们既没有那个 CLI 也没有 Bash 工具（只有 powershell）。搬进来就是点开必失败的假入口 |
| `ppt-implement` 的 `${CODEBUDDY_PLUGIN_ROOT}` / `${CODEBUDDY_PROJECT_DIR}` | **未适配** | 它的 SKILL.md 与 5 个脚本用 WorkBuddy 的占位符，pi 的技能机制不展开这些变量（pi 的约定是「SKILL.md 里写相对技能目录的路径」）。这是唯一一个带占位符的插件 |
| `ppt-implement` 的 `hooks/hooks.json` | **未接线** | 它靠 SessionStart / PreToolUse(Skill) / PostToolUse(Edit\|Write) / Stop 四组 hook 跑 `setup-project.js`、`post-slide.js`、`export-ppt.js`。我们没有插件 hook 运行器（AGENTS.md §9 明确不自造插件加载器），所以这四个脚本目前不会被自动触发 |
| `deep-research` 的 `agents/research-subagent.md`、`rules/deep_research.md` | **未接线** | 前者是 WorkBuddy 格式的子代理定义（我们的子代理在 `resources/agents/`，格式不同），后者是插件级规则（我们无消费方） |
| 各插件的 `allowed-tools` 含 `Bash(...)` | **未适配** | `pdfkit-py`、`lucide-icons` 的技能白名单里有 Bash；我们会话里没有 Bash 工具，模型会改用 powershell（工具描述对得上，但技能里写的命令要按 Windows 路径核对） |
