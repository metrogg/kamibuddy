# prompts/fragments — 共享提示词片段（WorkBuddy 搬用 + 适配）

## 来源与使用声明

本目录片段搬用自 **WorkBuddy 5.5.4** 解包产物的主提示词体系
（`resources/templates/workbuddy-prompt.tpl` 与
`plugins/workbuddy-builtin/interactionmode/*/fragments/`），按本仓库工具面、
产品名「嘉立创Work」与中文提示词风格做了适配改写（非逐字照搬）。

- **使用范围**：公司内部使用阶段。
- **风险置换**：正式上线前由专人负责对该资产做风险置换/重写。
- 决策记录：AGENTS.md §六（2026-09-10 用户决策：内部使用阶段允许直接搬用
  WorkBuddy 资产，正式上线前置换）。

## 片段清单与适配要点

| 文件 | 来源（WorkBuddy 侧） | 适配 |
| --- | --- | --- |
| delivery-rules.md | `<result_presentation>` / `<sharing_files>` / `<final_answer_instructions>` + 本仓库原「交付」段 | 保留本仓库自写的交付段原文（2026-09-09 present_files 漏挂事故后的护栏），合入 WorkBuddy 最终回复纪律；删 Bash 起服务、腾讯文档链接格式；URL 交付口径按本仓库实现写实（URL 只进清单不自动打开） |
| tool-discipline.md | `<tool_use>` / `<tool_usage_policy>` / `<asking_questions>` / `<personal_files_safety>` | 工具名映射到本仓库白名单（read / write / edit / find / grep / ls / web_search / web_fetch / powershell / questionnaire / present_files）；删 Bash、TodoWrite、Agent/Explore 子代理、MCP 连接器、hooks 等我们没有的能力引用；powershell 受控按本仓库危险命令检查器（command-guard）的五类拦截写实 |
| narration.md | **本仓库自写**（机制依据见下） | 「一批工具前一句、做完后一句」的过程叙述条款 + 失败要说人话。依据是三处机制：① 界面把工具与思考折叠起来，用户能读到的过程只有正文（`src/renderer/fold-view.ts`，对标 WorkBuddy MetaFold）；② WorkBuddy 把「里程碑处写进展」写成正面条款（`cli/product.json` 的 `tool-todowrite-description`：Mid-Session Checkpoints「每 3-5 项小结一次 / 说明还剩几项」是 CRITICAL 级硬条款）；③ CLI `# Tone and style` 里明确承认「工具调用前那句话」的存在（"text like \"Let me read the file:\" followed by a read tool call"）。中文句式示例为本仓库自写 |
| windows-notes.md | `<windows_command_safety>` + `<personal_files_safety>` 第 8 条 + `<tool_use>` 时间戳条 | 只留 Windows 差异：绝对路径、破坏性命令的目标校验与失败不重试、.ps1/.bat 非 ASCII 编码坑、时间戳用 PowerShell 现取；删 cmd /c 套壳条（我们没有第二种 shell） |
| regional-conventions.md | `<regional_conventions>` | 近乎原样（中文化）：默认中国用户、A 股红涨绿跌、¥ 默认 |
| python-env.md | **本仓库自写**（机制照 WorkBuddy 的 `client-info-env.js`：把托管运行时路径随提示词注入） | 只有一个槽位 `{{pythonPath}}`，真实路径由 daemon 现取（`docx-env.ts` 的 `venvPython`）。**为什么必须写**：模型缺库的第一反应是 `pip install`，而它在沙箱里必失败（`docs/ARCHITECTURE.md` 已知边界第 8 条），所以要把 Python 的落点引导到托管 venv。两条不许改：① 不得写成「去跑 pip」（那里只有解释器可用）；② 必须留着「不要用 tempfile」那条 |

身份与边界**不单独成片段**：`resources/scenes/work/prompt.md` 的
「你是嘉立创Work…」与「能力与边界」段是本仓库自写版，比 WorkBuddy 对应段
更贴合本产品（无腾讯生态引用），按 Task 2 约定保留自写、不硬搬。

## 机制约定

- 片段由 `src/core/prompt-composer.ts` 的 `{{> name}}` 指令展开：递归展开、
  环检测、超深（8 层）与缺失一律抛错；片段内可继续 include 与使用槽位
  （{{interaction}} 等）。展开发生在槽位替换之前。
- 文件名必须匹配 `^[a-zA-Z][a-zA-Z0-9_-]*$` 且内容非空，否则加载时抛错
  （响亮失败，不静默带死文件/空洞上线）。
- 本 README 也会被加载成名为 `README` 的片段：不被引用即零 token 成本，
  但**不要**从任何骨架里 include 它。
