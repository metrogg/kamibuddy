# WorkBuddy 竞品逆向分析 03：插件 / 技能 / MCP 生态解剖

> 分析对象：腾讯 WorkBuddy（办公 AI Agent 桌面应用，内核 CodeBuddy CLI）
> 素材：`_analysis/extracted/resources/plugins/workbuddy-builtin/`（内置插件解包）+ `_analysis/extracted/cli/dist/web-ui/docs/cn/cli/`（官方中文文档）
> 结论均标注证据文件路径（下文相对路径基于 `_analysis/`）。

---

## 一、插件框架设计

### 1.1 总体架构：Claude Code 兼容的超集

CodeBuddy 的插件系统在设计上**兼容 Claude Code 插件规范**，但做了自己的扩展：
- 元数据目录优先级：`.codebuddy-plugin/`（优先）> `.workbuddy-plugin/` > `.claude-plugin/`（兼容）
- 环境变量双名：`${CODEBUDDY_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_ROOT}`、`${CODEBUDDY_PLUGIN_DATA}` / `${CLAUDE_PLUGIN_DATA}`、`${CODEBUDDY_PROJECT_DIR}` / `${CLAUDE_PROJECT_DIR}` 均互相兼容
- 插件子进程额外收到 `CLAUDE_PLUGIN_OPTION_<KEY>` / `CODEBUDDY_PLUGIN_OPTION_<KEY>` / `PLUGIN_OPT_<KEY>` 三套选项环境变量

证据：`extracted/cli/dist/web-ui/docs/cn/cli/plugins-reference.md`（第九节"与 Claude Code 的兼容性"、环境变量节）

**观察**：WorkBuddy 内置插件实际混用两种目录——`builtin-plugins/` 与 `skills/` 下用 `.codebuddy-plugin/`，而 `interactionmode/`、`welcomemode/`、`prompt-common/` 用 `.workbuddy-plugin/`（WorkBuddy 产品层的自有命名空间）。
证据：`extracted/resources/plugins/workbuddy-builtin/interactionmode/ask/.workbuddy-plugin/plugin.json`、`.../welcomemode/code/.workbuddy-plugin/plugin.json`

### 1.2 plugin.json 清单字段

位置：插件根目录 `.codebuddy-plugin/plugin.json`。**清单本身可选**——省略时从目录名派生插件名并自动发现默认位置的组件；`name` 是唯一必需字段。

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string（必需） | 唯一标识（kebab-case），同时是组件命名空间前缀（`/plugin:skill`、`plugin:agent`） |
| `version` / `description` / `author` / `homepage` / `repository` / `license` / `keywords` | 元数据 | 语义化版本；与 marketplace 条目重复时 plugin.json 优先 |
| `defaultEnabled` | boolean | 首次安装是否默认启用（默认 true）；`enabledPlugins` 显式设置优先 |
| `dependencies` | array | 插件依赖（字符串或 `{name, version, marketplace}`），semver 范围，经 Git tag `{plugin}--v{version}` 解析；跨 marketplace 依赖需根市场 `allowCrossMarketplaceDependenciesOn` 白名单 |
| `commands` / `agents` / `skills` / `outputStyles` | string\|array | 自定义组件路径（**替换**默认目录，数组可含默认目录保留之） |
| `hooks` / `mcpServers` / `lspServers` | string\|array\|object | 路径或内联配置（语义是"合并多来源"而非替换） |
| `userConfig` | object | 启用插件时提示用户输入的配置；`sensitive: true` 存系统密钥链，非敏感存 `settings.json` 的 `pluginConfigs` |
| `channels` | array | 声明消息注入频道，绑定插件内 MCP server（如 Telegram bot） |
| `experimental.themes` / `experimental.monitors` | — | Claude 兼容字段，CodeBuddy 仅识别不加载 |

证据：`docs/cn/cli/plugins-reference.md`（第三节清单架构）

**WorkBuddy 自有扩展**：内置技能/资源类插件的 plugin.json 带 `workbuddy` 私有字段，声明资源种类与安装包内路径，例如：
```json
"workbuddy": { "kind": "builtin-skill", "legacyResourceName": "wb-finance-skill",
  "bundleSegments": ["plugins","workbuddy-builtin","skills","wb-finance-skill"] }
```
ardot-mcp-app 还有 `runtimeSupportSegments`（指向 `_workbuddy-runtime/mcp-app-bootstrap.cjs` 运行时引导）与 `loadsCapabilities: false`。
证据：`resources/plugins/workbuddy-builtin/skills/wb-finance-skill/.codebuddy-plugin/plugin.json`、`.../mcps/ardot-mcp-app/.codebuddy-plugin/plugin.json`

welcomemode 插件另有 `workbuddy.dependencies: [{type:"mcp", name:"netdrive"}]`——声明对宿主 MCP 能力的依赖。
证据：`.../welcomemode/code/.workbuddy-plugin/plugin.json`

### 1.3 插件目录结构约定

```
my-plugin/
├── .codebuddy-plugin/plugin.json   # 唯一允许放进该目录的文件
├── commands/        # 斜杠命令（.md，旧式技能形态）
├── agents/          # 子代理（.md + YAML frontmatter）
├── skills/          # 技能（<name>/SKILL.md，可含 scripts/、references/ 等辅助文件）
├── hooks/hooks.json # 事件钩子
├── output-styles/   # 输出样式
├── bin/             # 可执行文件，启用时加入 Bash 工具 PATH
├── .mcp.json        # MCP 服务器
├── .lsp.json        # LSP 服务器（代码智能）
└── settings.json    # 默认设置（目前运行时仅应用 agent 键）
```
铁律：除 plugin.json 外所有组件目录必须在**插件根目录**，不能放进 `.codebuddy-plugin/`。
证据：`docs/cn/cli/plugins.md`（插件结构概述）、`plugins-reference.md`（第五节）

### 1.4 发现 / 加载 / 隔离机制

- **发现**：两条路径——① `codebuddy --plugin-dir ./x`（会话级，开发调试，同名时覆盖市场版）；② marketplace 安装（持久）。
- **市场模型**：市场 = `.codebuddy-plugin/marketplace.json` 目录文件，支持 4 种来源（本地目录 / GitHub / 任意 Git / HTTP URL），由 `MarketplaceFactory` 按源类型实例化 Directory/Github/Http marketplace。插件条目有 `strict` 字段（默认 true：必须有 plugin.json；false 时市场条目本身可当完整清单）。
- **安装即复制（隔离）**：市场插件被复制到**版本化缓存** `~/.codebuddy/plugins/cache/<marketplace>/<plugin>/<version>`，不原地使用；缓存键优先级 plugin.json version > 市场条目 version > git commit SHA。插件不能引用自身目录之外的文件（路径遍历限制）；同市场共享文件用符号链接，缓存时按规则解引用或跳过。
- **持久数据**：`${CODEBUDDY_PLUGIN_DATA}` → `~/.codebuddy/plugins/data/{id}/`，跨版本保留（放 node_modules、venv 等），卸载最后一个作用域时自动删除。
- **作用域**：`user`（~/.codebuddy/settings.json）/ `project`（提交进 git）/ `local`（gitignore）/ `managed`（只读托管）。
- **热重载**：`/reload-plugins` 无需重启重载插件、技能、代理、hooks、插件 MCP/LSP。
- **依赖治理**：自动安装的依赖标记 `auto: true`，`plugin prune` 清理孤儿依赖；禁用/卸载仍被依赖的插件会被阻止。

证据：`docs/cn/cli/plugins-reference.md`（二、四、六、八节）、`docs/cn/cli/plugin-marketplaces.md`（实现原理节）

### 1.5 内置插件 vs 市场插件

| 维度 | 内置（builtin） | 市场（marketplace） |
|---|---|---|
| 分发 | 随安装包捆绑（WorkBuddy 放在 `resources/plugins/workbuddy-builtin/`，本身是一个 **marketplace.json 聚合的本地市场**） | 用户 `/plugin install` 或团队 `extraKnownMarketplaces` |
| 信任 | admin-trusted：内置 Skill 的 frontmatter hooks **不受** `allowUntrustedFrontmatterHooks` 闸门约束，自动放行 | 非可信来源：frontmatter hooks 默认拒绝，需用户显式开启 |
| 覆盖 | `--plugin-dir` 可覆盖市场同名插件，但**托管设置强制启用的市场插件不可覆盖** | — |
| 自动更新 | 内置市场默认开启 | 第三方默认关闭（env/产品配置/UI 可开） |

证据：`docs/cn/cli/skills.md`（安全闸门节）、`docs/cn/cli/plugin-marketplaces.md`（自动更新节）、`docs/cn/cli/plugins.md`（本地测试节）、`resources/plugins/workbuddy-builtin/.codebuddy-plugin/marketplace.json`

---

## 二、内置插件逐个清点

根市场清单：`resources/plugins/workbuddy-builtin/.codebuddy-plugin/marketplace.json`（name: `workbuddy-builtin`，共登记 33 个插件条目，按 `category` 分为 welcomeMode / interaction / template / skill / mcp-app / builtin-plugin 六类）。

| 插件 | 类别 | 用途 | 组成（skills / agents / mcp / hooks / 其他） |
|---|---|---|---|
| welcomemode-code / -work / -design | welcomeMode | 三种欢迎模式的**根代理**（编程/办公/设计），决定新会话的初始人格 | 各含 `agents/*.md`（根 agent 定义）+ `prompt.tpl` + `settings.json`（`{"agent":"code"}`，启用即把该 agent 激活为主线程）；code 模式声明依赖 `netdrive` MCP |
| interactionmode-craft / -ask / -plan / -expert | interaction | 四种交互模式的**提示词片段与工具策略**（craft=创作、ask=问答、plan=规划、expert=专家） | 每个含 6-8 个 `fragments/*.md`（agent-loop / current-mode / interaction / tool-use / result-presentation / task-management / plugin-recommendation）——系统提示词的模块化拼装件 |
| prompt-common | template | welcomeMode 模板共享片段 | `fragments/memory-context.md`、`workbuddy-memory-system.md`（记忆系统提示词） |
| sheetagent | builtin-plugin | 腾讯文档电子表格智能体：自然语言创建/查询/编辑 xlsx | agents/sheet-agent.md；commands/excel.md、generation.md；**内嵌 MCP 服务器**（`mcp/start.mjs`，stdio，`defer_loading: true`，env 指向腾讯文档 sheet-mcp 远端）；hooks（SubagentStop 时自动保存脏文件）；skills/excel-generation、excel-handler；prompt/sheet-references 10 篇参考文档 |
| tencent-docs-plugin | builtin-plugin | 腾讯文档官方集成：按用户身份路由 C 端（docs.qq.com）或 SaaS 端 | 2 个技能：`tencent-docs`（个人版）与 `tencent-saas-docs`（企业版），各含 doc/sheet/slide/smartcanvas 的 create/edit.md、references/（auth、空间、图表、OCR、aipage）、Python/JS 脚本（tencentdocs.py、import_file.py、ocr.js、aipage_pack.js）；`shared/smartcanvas/template/` 6 个 MDX 模板 |
| tencent-docx | builtin-plugin | 本地 .docx 专业创作与美化（研报/论文/公文/合同等垂类） | 根 SKILL.md（编排入口）+ 3 agents（doc-writer/doc-formatter/doc-converter）+ 8 skills（brief-compose、design-token、doc-typeset、format-extract、generate-fillable-contract-html、html-review、html-to-docx、tdoc-orchestrator）+ experts/（9 个文体专家技能：学术论文/商务文案/公文/合同/诗歌散文/研报/科技博客/工作报告等）+ core/engines（critic-generator、deep-research）+ hooks（SessionStart 后台预热 html-to-docx venv）+ 完整 Python html→docx 转换器（20+ 模块 + 测试 fixtures） |
| tencent-pptx | builtin-plugin | 演示文稿插件（marketplace.json 登记 v20260825，解包中未见目录） | — |
| weixinpay | builtin-plugin | 微信支付插件（marketplace.json 登记 v1.6.108，解包中未见目录） | — |
| skill-ardot-design-core | skill | Ardot 设计系统核心：设计变量/共享样式/组件实例规则 + schema | SKILL.md + func-rule/ 3 个子技能 + rules/ + tool-usage/ + workflows/ + scenes.json（场景路由表） |
| skill-ardot-design-router | skill | 设计任务路由器 | 单 SKILL.md |
| skill-ardot-design-to-code | skill | 设计稿转代码（含 Tailwind 指南） | SKILL.md + references/ + workflows/ |
| skill-ardot-ui-design / -poster / -slides | skill | UI 设计 / 海报 / 幻灯片生成规范 | 各含 SKILL.md + references/guidelines-*.md + workflows/ |
| skill-buddy-multimodal-generation | skill | 多模态生成（云侧脚本 buddy-cloud.py） | SKILL.md + scripts/ |
| skill-expert-manager | skill | "专家"（自定义 agent/团队）的创建、打包、注册、校验 | SKILL.md + references/4 份 spec（agent-md/avatar/plugin-json/team）+ scripts/ 6 个 Python |
| skill-geo-map-compliance-guard | skill | 地图合规守卫 | 单 SKILL.md |
| skill-library | skill | WorkBuddy 云空间"库"操作总线：文档/页面/多维表格/云盘/附件 | 大型技能：manifest.yaml + api-manifest.json + doc/page/database/drive/manage/smh/link/attachment 8 个子域，每个子域含 entry.md + 多个 Python 脚本；有 lint/validator 等工程化保障 |
| skill-livestream-poster | skill | 直播海报生成 | SKILL.md + references/ + workflows/ |
| skill-marketplace-skill-installer | skill | 从市场安装技能的引导 | 单 SKILL.md |
| skill-recommend-connectors / -experts | skill | 按当前任务推荐未连接的 Connector 插件 / 可用专家与专家团队 | 单 SKILL.md |
| skill-sites | skill | 网站类任务技能 | 单 SKILL.md |
| skill-skill-creator | skill | 技能脚手架：init/package/validate | SKILL.md + scripts/3 个 Python |
| skill-tencent-docs-routing | skill | 腾讯文档相关技能的路由分发 | 单 SKILL.md |
| skill-tencent-local-office-edit | skill | 本地 Office 文件编辑（edsdk.py + doc/sheet/slide.md） | SKILL.md + 子文档 + Python SDK |
| skill-wb-finance-skill | skill | **金融投资分析全家桶**（详见第三节案例） | SKILL.md + 46 篇 references/*.md + scripts/（quant/ 6 个、price-action/ 7 个、ib/ 2 个 Python + run_signal.py） |
| mcp-ardot-mcp-app | mcp-app | Ardot 的 MCP App（带 widget UI 的 MCP），运行时经 `_workbuddy-runtime/mcp-app-bootstrap.cjs` 引导 | 仅 plugin.json + bootstrap 脚本（`loadsCapabilities: false`） |
| miora-mcp | （未在 marketplace.json 登记，位于 mcps/ 下） | **画布 + 多模态生成 MCP 服务器**：工具含 `miora_open_canvas`、`miora_write_canvas`、`miora_query_task`、`miora_text_to_image`、`miora_edit_image`、`miora_text_to_video`、`miora_frame_to_video`、`miora_reference_to_video`；产物（图片/视频）先本地化再交给 `present_files` 展示或写进画布；含 canvas-session 会话与 dispatch-lanes（画布工具串行队列） | `dist/cli.cjs`（打包后单文件，含 src/canvas-session.ts、media/artifact-localizer.ts 等模块注释）+ `dist/templates/`（`empty-canvas.miora`、`ai.kiwi` 画布模板） |
| agently-cli | （未登记，mcps/ 下） | 预编译二进制 `bin/agently-cli.exe`（推测为 agent 相关 CLI 工具） | 单 exe |

证据：上表各行对应 `resources/plugins/workbuddy-builtin/` 下目录树、`marketplace.json`、各 plugin.json；miora 工具名证据 `mcps/miora-mcp/dist/cli.cjs` 内 `name: "miora_*"` 定义（约 19646-21265 行）。

### 重点剖析 1：tencent-docs-plugin（腾讯文档集成）

- **双技能身份路由**：`tencent-docs`（个人版）与 `tencent-saas-docs`（企业 SaaS）两个平行技能，SKILL.md frontmatter 的 description 写明"企业版账号请改用 tencent-saas-docs，本 skill 会直接返回 ERROR:identity_mismatch"。plugin.json 的 skills/commands/agents 字段留空——依赖默认目录约定自动发现。
- **多 endpoint 架构**：能力分散在 4 个 MCP endpoint——主服务 `tencent-docs`（文件管理/创建/搜索/OCR/剪藏/smartcanvas/smartsheet）+ `doc-mcp` / `sheet-mcp` / `slide-mcp`（各品类精细编辑）。技能文档明确"别用主服务的转发工具，一律走对应 engine endpoint"。
- **调用方式**：不直接让模型调 MCP，而是包一层 `tencentdocs.py`（纯标准库 Python）：`tdoc_init`（环境检查）→ `tdoc_list`（工具清单）→ `tdoc_schema`（查参数定义，"严禁凭记忆拼参数"）→ `tdoc_call`（执行）。鉴权票据由宿主（WorkBuddy 连接器）注入，经 HTTP header 透传不落盘。
- **doc_format 模板机制**（`skills/tencent-docs/doc/doc_format/`）：纯文本→结构化 XML→样式美化的四步流水线：①场景识别（scenario_recognition_prompt.txt → 输出 `{scenario, title}`）②可选样式自定义（style_customization_prompt.txt）③按场景模板（templates/{general,paper,contract,essay,government}.json）把文本转 XML ④调 MCP 工具 `doc.ai_format_pure_text` 生成在线文档。是"提示词模板 + JSON 结构模板 + MCP 工具"三段式的典型范例。
  证据：`builtin-plugins/tencent-docs-plugin/skills/tencent-docs/SKILL.md`、`doc/doc_format/README.md`、`references/auth.md`

### 重点剖析 2：tencent-docx（doc-typeset HTML 模板机制）

- **编排式技能链**：根 SKILL.md 是"守门员"——强制先读 `skills/tdoc-orchestrator/SKILL.md` 走 Stage 0 入口判断，禁止跳过编排器直接调工具；下游由 doc-typeset / html-to-docx 等技能接力。设计哲学：用层层"禁止行为"条款防止模型走捷径。
- **doc-typeset 的模板机制**（`skills/doc-typeset/`）：
  - 输入契约：原始内容 + 上游 `design-token` 技能产出的 design tokens（JSON，含 6 套编译产物 themes/compiled/*.json）+ genre。
  - 模板选择：genre 命中 7 个垂类（legal-contract / academic-paper / government-doc / business-report / meeting-minutes / stock-research / annual-report）→ 加载 `prompts/{genre}.md`（排版提示词）+ `templates/{genre}.html`（HTML 骨架）；未命中走 base。**渐进加载**，不预读全部。
  - 装饰组件：callout / divider / section-marker / data-card 四个 HTML 组件，按内容关键词触发插入。
  - 样式纪律：所有样式经 CSS 变量引用 Token，**禁止裸值**；有独立 `html-review` 技能做 6 维审查（design-token 合规、结构完整性、体裁契合、安全、排版质量、装饰使用）。
  - 分页模型：语义 `<section role>` + CSS `@page` 子集表达封面/分节/横向页/页眉页脚页码，由 `html-to-docx`（20+ 模块的 Python 转换器）映射为 OOXML。
  - 合规沉淀：design-token 技能内嵌国标规则（gb-t-7713 学术论文、gb-t-7714 引文、gb-t-9704 公文）。
  证据：`builtin-plugins/tencent-docx/SKILL.md`、`skills/doc-typeset/SKILL.md`、`skills/design-token/`、`skills/html-review/references/`、`skills/html-to-docx/scripts/html_to_docx/`

### 重点剖析 3：miora-mcp（画布 MCP）

这是 WorkBuddy 的**智能画布（canvas/白板）+ 多模态生成** MCP 服务器：既能生成图片/视频（text-to-image、edit-image、text-to-video、frame-to-video、reference-to-video，异步任务经 `miora_query_task` 轮询），也能把产物写入画布（`miora_open_canvas` / `miora_write_canvas`）。工程细节：生成产物走 `artifact-localizer` 先下载到本地（`miora-media` 目录），因为 `signedUrl` 会过期、且画布需要本地路径；画布类工具经 dispatch-lanes 串行化防并发冲突。dist 里有两个画布模板：`empty-canvas.miora`、`ai.kiwi`（.miora/.kiwi 为画布文档格式）。
证据：`mcps/miora-mcp/dist/cli.cjs`（工具注册与 `media/artifact-localizer.ts`、`dispatch-lanes.ts` 模块）、`mcps/miora-mcp/dist/templates/`

---

## 三、技能（Skills）机制

### 3.1 SKILL.md 格式与触发

- 技能 = 含 `SKILL.md` 的目录，可带任意辅助文件（references/、scripts/、templates/）。
- 位置：项目级 `.codebuddy/skills/`、用户级 `~/.codebuddy/skills/`、插件 `skills/`。项目级优先于用户级；插件技能带命名空间（`/plugin:skill`）。
- frontmatter 字段：`name`、`description`（AI 路由的主要依据）、`allowed-tools`（工具白名单，支持 `Bash(git:*)`、`Edit(src/**/*.ts)` 模式匹配）、`disable-model-invocation`（仅手动触发）、`user-invocable: false`（对模型可见但不出现在 / 菜单，做背景知识）、`context: fork` + `agent` + `model`（在独立 subagent 上下文执行）、`hooks`（fork 生命周期 hooks，受 admin-trusted 闸门约束）。
- 与提示词的关系：**SKILL.md 正文就是注入给模型的提示词**，AI 依据 description 与任务匹配度自动调用（也可 `/skill-name` 手动）。支持 `$ARGUMENTS`、`` !`cmd` `` 内联执行 shell、`@file` 引用、`${CODEBUDDY_SKILL_DIR}` 等占位符，处理顺序：`$ARGUMENTS` → shell → `@file`。
- 可见性治理：`skillOverrides` 四态（on / name-only / user-invocable-only / off）可在不改 SKILL.md 的情况下省 context 或禁用；插件技能不受其影响（锁定由 /plugin 管理）。
- **渐进式披露（Progressive Disclosure）**是核心范式：SKILL.md 只放红线与路由，具体方法论拆到 references/*.md，"按需 Read"。
证据：`docs/cn/cli/skills.md`

### 3.2 案例：wb-finance-skill（股票/金融分析技能包）

位置：`resources/plugins/workbuddy-builtin/skills/wb-finance-skill/`

**组织方式**（一个教科书级的完整技能）：

```
wb-finance-skill/
├── .codebuddy-plugin/plugin.json     # name: skill-wb-finance-skill，category: skill
├── SKILL.md                          # 红线 + 检索策略 + 路由表（~100 行 frontmatter 带 when_to_use）
├── references/                       # 46 篇方法论 markdown，按需加载
│   ├── stock-deep-research.md        # 个股深度研究
│   ├── quant-factor-research.md      # 量化因子研究
│   ├── price-action-tools.md         # 技术分析工具
│   ├── portfolio-optimization.md     # 组合优化
│   ├── tdx-mcp-quick-reference.md    # 通达信 MCP 速查
│   ├── html-report-style.md          # HTML 研报风格规范
│   └── …（market-state / valuation-pricing / ib-models / options-strategies 等）
└── scripts/
    ├── run_signal.py                 # 信号运行入口
    ├── quant/                        # factor_fundamental / factor_multi / minute_data /
    │                                 # pair_trading / seasonality / volatility（6 个）
    ├── price-action/                 # basic_indicators / candlestick_patterns / chan_theory(缠论) /
    │                                 # elliott_wave / harmonic_patterns / ichimoku / smart_money（7 个）
    └── ib/                           # extract_ib_numbers / validate_dcf（投行建模）
```

**SKILL.md 的设计手法**：
1. **触发面最大化**：frontmatter 除 description 外还有 `when_to_use`，穷举 a-f 六类命中场景（含口语化表达"我 X 套了 40% 怎么办"、各市场代码格式），并自封"金融场景总入口，优先级高于其他金融skill"。
2. **红线一票否决**：禁编造数据、禁概念混淆、禁自相矛盾、固定文案免责声明（禁止改写）。
3. **工具委派纪律**：检索统一走 `agentic_search` 工具，且规定"委派 query 必须是一句话检索意图，禁止拆维度清单"（附正/反例），因为工具自身有多步规划能力——这是对"主 agent 与子工具职责边界"的精细工程。
4. **三步强制流程**：问题拆成场景标签 → 按"核心必选/条件追加"对照表加载 references（如"个股全面分析 = stock-deep-research + valuation-pricing"）→ 输出前自检清单。
5. **数据底线**：来源分级（一手 vs 非一手"需核实原文"）、每个关键数字带"来源+时点"、时效周期校验。
6. **交付形态**：默认产出 HTML 研报（ECharts 图表 + node --check 语法自检），简短问答用 Markdown。

证据：`skills/wb-finance-skill/SKILL.md`、目录树（references/ 46 篇、scripts/ 16 个 py）

---

## 四、MCP 生态

### 4.1 传输与配置

- **三种 transport**：`stdio`（本地进程）、`sse`、`http`（流式）；`type` 可省略自动推断（有 command→stdio，有 url→http）。
- **配置作用域**：user / project / local，同名服务器 `local > project > user`；项目作用域服务器首次连接需用户审批（非交互模式用 `--settings enableAllProjectMcpServers / enabledMcpjsonServers` 预批准）。
- **配置文件**：JSONC（支持注释/尾逗号）；user 优先级 `~/.codebuddy/.mcp.json` > `mcp.json`（废弃）> `~/.codebuddy.json`；project 为 `<root>/.mcp.json`。环境变量扩展 `${VAR}` / `${VAR:-default}`，缺失保留占位符 + WARNING。
- **defer_loading**：工具数量大时延迟加载，模型经 `ToolSearch` 按需激活；服务器级与工具级可互相覆盖；还可用 `Defer()/NoDefer()` 修饰符在 `--tools` 或 agent frontmatter 临时覆盖。
- **MCP Prompts**：服务器提供的 prompts 自动注册为 `/服务器名:prompt名` 斜杠命令。
- **超大响应**：>20000 tokens 自动落盘到会话 tool-results 目录，返回读取指引；含图片等场景降级截断。
证据：`docs/cn/cli/mcp.md`

### 4.2 MCP Apps（widget UI）

CodeBuddy 接入了 MCP 官方 `io.modelcontextprotocol/ui` 扩展（ext-apps，spec 2026-01-26）：工具定义带 `_meta.ui.resourceUri` + 资源 MIME `text/html;profile=mcp-app` 即可让工具结果渲染为对话内**可交互 widget**（异源 sandbox iframe + CSP 注入 + JSON-RPC over postMessage）。安全模型：widget 反向调工具一律弹框授权（仅 `-y`/BypassPermissions 或会话级"始终允许"可短路，且与模型主动调用的 allow 规则**完全隔离**）；反向读资源免授权；open-link 仅放行 http(s)。Web UI 与 IDE 嵌入页生效，终端 TUI 自动文本降级。
证据：`docs/cn/cli/mcp-apps.md`

### 4.3 内置 MCP 服务器

| 服务器 | 形态 | 说明 |
|---|---|---|
| sheetagent | 插件内嵌 stdio（`mcp/start.mjs`） | 电子表格编辑，defer_loading；env 指远端 `https://docs.qq.com/api/v6/sheet/mcp`，本地/远端双模 |
| 腾讯文档系（tencent-docs / doc-mcp / sheet-mcp / slide-mcp） | 远端 HTTP endpoint | 经 `tencentdocs.py` 包装调用，宿主注入票据 |
| miora-mcp | 内置打包（dist/cli.cjs） | 画布 + 图片/视频生成（见 2.3） |
| mcp-ardot-mcp-app | builtin-mcp-app | 带运行时引导（mcp-app-bootstrap.cjs）的 MCP App |
| 通达信 MCP（tdx） | 外部可选 | wb-finance-skill 的 `tdx-mcp-quick-reference.md` 引用，行情数据源 |
| agentic_search | 宿主工具 | 金融技能统一检索入口 |
| 官方市场外部集成 | 市场插件捆绑 | github/gitlab/atlassian/asana/linear/notion/figma/vercel/firebase/supabase/slack/sentry |
| LSP 插件 | 市场插件 | 11 种语言（pyright/typescript/rust-analyzer/clangd/gopls/jdtls 等），提供诊断与代码导航 |

证据：`builtin-plugins/sheetagent/.codebuddy-plugin/plugin.json`、`skills/tencent-docs/SKILL.md`、`mcps/miora-mcp/`、`docs/cn/cli/plugin-marketplaces.md`（官方市场内容节）、`skills/wb-finance-skill/references/tdx-mcp-quick-reference.md`

---

## 五、子代理 / Hooks / 记忆 / 权限要点

### 5.1 子代理（Sub-agents）

- 定义：`agents/*.md` + YAML frontmatter。字段：`name`/`description`（必需）+ `tools`（省略继承全部，支持 Defer/NoDefer 修饰）、`disallowedTools`、`model`（ID/别名/`lite`/`reasoning` 场景变体/inherit）、`permissionMode`、`skills`（启动自动加载）、`mcpServers`（引用全局或 inline 私有，插件 agent 被忽略此字段）、`effort`、`maxTurns`、`background`、`initialPrompt`、`memory`（user/project/local 持久记忆作用域）。
- 优先级：项目 > CLI `--agents` > 用户；插件 agent 与自定义并列显示于 `/agents`。
- 系统内置：`general-purpose`（全工具）、`Explore`（只读 lite）、`Plan`（计划模式）。
- 治理机制：嵌套深度封顶 5 层；每会话 spawn 预算默认 200；子代理输出回传前做"去毒"（改写仿冒 `<system-reminder>` 与行首 Human:/Assistant:，防提示注入）。
- 模型解析链：env 一刀切 > 单次调用入参 > 项目级 > 用户级 > 内置声明（product.json）> 继承主对话。
- 可恢复（resume by agentId，对话存 `agent-{id}.jsonl`）与后台代理（run_in_background + TaskOutput 轮询）。
- **Agent Teams**：多实例协作（team-lead + teammates），成员间可直接通信、共享任务列表（含依赖解除阻塞）、计划审批、`@成员`/`@all` 消息、delegate 模式限制领导只用协调工具。与子代理的分工：聚焦独立子任务用子代理，需要讨论协调用团队。
证据：`docs/cn/cli/sub-agents.md`、`docs/cn/cli/agent-teams.md`；实例 `builtin-plugins/sheetagent/agents/sheet-agent.md`（tools 白名单逐个列 `mcp__sheetagent__*` + 安全红线 + 按需 Read 的 reference 表）

### 5.2 Hooks

- **27+ 事件**：覆盖工具生命周期（PreToolUse/PostToolUse/PostToolUseFailure）、会话与子代理（SessionStart/SessionEnd/Stop/StopFailure/SubagentStart/SubagentStop）、交互（UserPromptSubmit/Notification/PermissionRequest/PermissionDenied/Elicitation/ElicitationResult）、上下文（PreCompact/PostCompact/InstructionsLoaded/ConfigChange）、任务团队（TaskCreated/TaskCompleted/TeammateIdle）、文件环境（FileChanged/CwdChanged/WorktreeCreate/WorktreeRemove）、Setup。
- **四种类型**：`command`（shell，Windows 强制 Git Bash，60s 超时）、`prompt`（小模型语义判定，仅 Stop/UserPromptSubmit/PreToolUse）、`agent`（subagent 验证器）、`http`（POST/PUT/PATCH）。
- 配置位置：settings.json 各级作用域 + 插件 `hooks/hooks.json` + Agent/SKILL.md frontmatter（仅 fork 生效，Stop 自动重写为 SubagentStop，受 `allowUntrustedFrontmatterHooks` 闸门，内置技能豁免）。多来源**合并**而非覆盖。
- 用途实例：sheetagent 用 SubagentStop 自动保存脏文件；tencent-docx 用 SessionStart 后台幂等预热 Python venv（5s 超时不阻塞）。
证据：`docs/cn/cli/hooks.md`、`plugins-reference.md` 事件表、`builtin-plugins/sheetagent/hooks/hooks.json`、`builtin-plugins/tencent-docx/hooks/hooks.json`

### 5.3 记忆（Memory）

- 四层位置：用户记忆 `~/.codebuddy/CODEBUDDY.md`、用户规则 `~/.codebuddy/rules/*.md`、项目记忆 `./CODEBUDDY.md`（或 `.codebuddy/` 内）、项目本地 `CODEBUDDY.local.md`（自动 gitignore）。
- 加载顺序：用户级 → 项目级主文件（**向上递归**到根）→ 当前目录 rules → 子目录记忆（动态按需）→ local。
- `@path` 导入语法（递归 5 层，代码块内不解析）；rules 支持 frontmatter 三字段（enabled / alwaysApply / paths）实现"始终注入"与"条件触发"两类规则。
- Auto Memory：`/memory` 面板管理，有 MEMORY.md 索引；子代理还有独立的 `memory` 字段（agent-memory 目录，spawn 时注入截断 200 行/25KB）。
- WorkBuddy 产品层把记忆系统提示词做成了内置插件片段（`prompt-common/fragments/workbuddy-memory-system.md`）。
证据：`docs/cn/cli/memory.md`、`resources/plugins/workbuddy-builtin/prompt-common/fragments/`

### 5.4 权限（Permissions / Permission Modes）

- **分层求值链**（规则层先于模式层）：hooks 特例 → deny（永远优先）→ 可信 allow → 交互式危险命令检查 → ask → bypass 短路 → 不可信 allow → 模式基线 → 非交互兜底（ask 转 deny）→ dontAsk/auto 收口。
- 关键设计：allow 分**可信/不可信**两层——未信任项目目录提交的 settings allow 规则不能越过危险命令检查（防恶意仓库投毒）。
- 规则语法：`Tool` 或 `Tool(specifier)`，如 `Bash(npm:*)`、`Edit(/src/**/*.ts)`、`WebFetch(domain:example.com)`；MCP 工具用 `mcp__server` / `mcp__server__tool`，不支持通配符，deny 可精准拉黑单个工具。
- 模式：`default` / `acceptEdits` / `auto`（分类器判定）/ `dontAsk`（不弹框直接拒绝）/ `plan` / `bypassPermissions` / `delegate`（仅协调工具），另有程序化模式 `fullAccess` / `work` / `ignore`（子代理继承主会话）。Shift+Tab 循环切换。
证据：`docs/cn/cli/permissions.md`、`docs/cn/cli/permission-modes.md`

---

## 六、对自研产品的借鉴清单

1. **插件清单 + 市场分离的两级模型**：plugin.json 管元数据与组件路径，marketplace.json 管分发（支持 strict:false 让市场条目直接当清单）。自研可直接复用此 JSON Schema 思路，并把"本地目录市场"作为内置插件的统一注册表（WorkBuddy 的 workbuddy-builtin 就是范例）。
2. **兼容主流规范再扩展**：CodeBuddy 兼容 Claude Code 的目录与变量名，降低迁移成本；自研应兼容 MCP 主协议与 Claude 插件习惯，再以私有命名空间（如 `workbuddy` 字段）承载产品特有元数据。
3. **安装即复制 + 版本化缓存 + 路径遍历封禁**：插件不原地运行，缓存键含 version/commit SHA，持久数据走独立 DATA 目录并随卸载清理——这是安全隔离与升级一致性的标准做法。
4. **技能的"渐进式披露"组织法**：SKILL.md 只写红线+路由（控制常驻 context），方法论拆 references 按需 Read；正/反例写进提示词（wb-finance-skill 的委派 query 规范）比抽象原则有效得多。frontmatter 的 `when_to_use` 穷举口语场景可显著提升自动触发率。
5. **编排器 + 守门员模式**：复杂流水线（tencent-docx）用根 SKILL 强制"先读 orchestrator、禁止走捷径"，配合 html-review 这类独立质检技能形成"生成→审查"闭环。
6. **设计 Token + 模板 + 组件的内容工程**：doc-typeset 的"genre→prompt+HTML 骨架"映射、CSS 变量禁裸值、国标规则文件化，适合一切"AI 生成格式化文档"场景。
7. **工具委派的分层包装**：对多 endpoint 服务（腾讯文档 4 个 MCP）用一个薄脚本统一入口（tdoc_schema 先查参数再调用，"严禁凭记忆拼参数"），比让模型直接面对几十个工具更稳；大工具量用 defer_loading + ToolSearch。
8. **hooks 的三条信任通道**：settings（全会话）/ 插件 hooks.json（启用即生效）/ frontmatter hooks（闸门管控，内置豁免）——既给生态扩展点又守住安全底线；SessionStart 预热、SubagentStop 自动保存是即学即用的实用 hook。
9. **权限的分层求值链**：deny 绝对优先 + allow 分可信层（未信任仓库的规则不能越过危险命令检查）+ auto 分类器只接管"最后仍 ask 的动作"——防供应链投毒与防打断体验兼顾。
10. **子代理输出去毒与预算治理**：嵌套深度上限、spawn 预算、回传内容改写仿冒 system 标签，是多代理系统必须有的防注入与成本控制。
11. **MCP Apps 的前瞻布局**：widget 反向调用与模型调用的授权通道完全隔离，是值得照抄的安全设计；终端场景自动文本降级保证协议一套、多端可用。
12. **模式即插件**：WorkBuddy 把交互模式（interactionmode）、欢迎人格（welcomemode）、共享提示词片段（prompt-common）都做成了插件，提示词工程资产因此获得版本化、可热重载、与市场同构的分发能力——自研产品可借鉴"一切皆插件"的资产化思路。

---

*证据路径前缀：`extracted/` = `c:\Program Files\WorkBuddy\_analysis\extracted\`。文档类证据均在 `extracted/cli/dist/web-ui/docs/cn/cli/`；插件实物证据均在 `extracted/resources/plugins/workbuddy-builtin/`。*
