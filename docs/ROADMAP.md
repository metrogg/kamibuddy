# 后续任务清单

> 建立于 2026-09-07，D3 完成时。
> 策略：**先做通用 Agent 底座，再以技能包形式一个个补专用能力。**
>
> 接手前必读顺序：[STATUS.md](STATUS.md)（现状 / 怎么跑 / 已知坑）→
> [ARCHITECTURE.md](ARCHITECTURE.md)（决策记录）→ [../AGENTS.md](../AGENTS.md)（开发约定）。
>
> 竞品参考材料在 [docs/workbuddy分析/](workbuddy分析/)，其中
> **[08-builtin-tools-reference.md](workbuddy分析/08-builtin-tools-reference.md)
> 是 WorkBuddy 桌面 16 个自研工具的逐实现对照手册**（入参/结果/推送契约/可抄要点），
> 做 T3/T6/T11 前先读它。

## 0. 给接手者的硬约束

违反这几条会造成返工或安全问题，先看完再动手。

| 约束 | 原因 |
|---|---|
| `npm run check && npm test` 必须绿才算完成 | `check:deps` 机械拦截依赖方向违规，靠自觉守不住 |
| **不要动 `src/extensions/` 的 39 个测试** | 那是唯一的安全边界护栏，见下方 §0.1 |
| 不 fork pi，只依赖 `@earendil-works/pi-coding-agent` 一个包 | 装 pi 内部包（如 pi-ai）会造出第二份拷贝，已踩过 |
| 查 pi 的 API 去读 `开源项目/pi/` 源码，不要凭记忆猜 | 那份 clone 就是留着当参考的；pi 0.85.x 迭代快 |
| 提示词 / 模板 / 技能正文一律自己写 | 合规红线（AGENTS.md §6）：机制可学，**文字不许从 WorkBuddy 原文复制** |
| 用 `npm run dev` / `npm start`，别直接 `npx electron .` | IDE 注入 `ELECTRON_RUN_AS_NODE=1` 会让 Electron 退化成 Node，报错极具误导性（STATUS.md 已知坑） |

### 0.1 为什么权限门不能松

**pi 完全没有路径约束**：`utils/paths.ts:102` 的 `resolvePath` 对绝对路径直接放行，
工具目录里搜不到任何越界检查。模型给出绝对路径就能写到硬盘任意位置，
包括覆盖 `~/.kamibuddy/auth.json` 里的 API Key。
pi README 自述 "does not include a built-in permission system" —— 它的方案是靠容器隔离整个进程，我们不能那样做。

新增任何**能写文件或执行命令**的工具时，必须同步在 `permission-policy.ts` 登记，
否则会落到「未登记工具 → 询问」的兜底分支，虽然安全但会让用户被弹窗淹没。

---

## 1. 已查清的 pi API 事实（省下重复调研）

这些是读源码 + 实测确认过的，直接用，不用再查。

### 系统提示词

- `buildSystemPrompt` 的 `customPrompt` 是**完全替换**默认提示词，不是追加。
- pi 默认提示词是 `"You are an expert coding assistant operating inside pi"`，
  还带一串 pi 自己的文档路径 —— 对办公 Agent 完全不对，**必须替换**。
- 每轮可替换：扩展监听 `before_agent_start`，返回 `{ systemPrompt }` 即覆盖本轮。
  `_systemPromptOverride` 在每次 run 的 `finally` 里被清掉（`agent-session.ts:1114`），
  所以两轴切换不需要维护状态同步 —— 每轮按当前场景+模式重算即可。
- **陷阱**：`buildSystemPrompt` 里技能注入的条件是
  `!selectedTools || selectedTools.includes("read")`。
  即**模式的工具白名单不含 `read` 时，技能会从提示词里静默消失**。
  ask 模式若写 `tools: []`，技能就全丢了。

### 工具集

- `session.setActiveToolsByName(names)` 切换工具集，"Changes take effect on the next agent turn"。
- 内置工具只有 8 个：`read` / `write` / `edit` / `find` / `grep` / `ls` / `bash` / `powershell`。
- 自定义工具经 `pi.registerTool()` 注册（扩展内），或 `createAgentSession({ customTools })`。
- **不给模型 `bash` / `powershell`**：pi 在 Windows 找不到 bash 会直接抛异常，
  而目标用户机器上不会装 Git for Windows（ARCHITECTURE.md §4.4）。

### 扩展

- 经 `DefaultResourceLoader({ extensionFactories })` 注入，**必须 `await loader.reload()`** 后才生效。
- 同一个 `SettingsManager` 要同时交给 loader 与 `createAgentSession`
  （照 pi 自己的 `sdk.ts:182-188`），各建一个会有两份设置状态。
- **扩展签名不对时 pi 会静默跳过、不报错** —— 所以 `npm run smoke:session` 里有一条专门验证
  factory 是否真被调用。新增扩展后跑一次。

### `ctx.ui` 的边界（D1 实测）

- 可跨进程：`confirm` / `select` / `input` / `notify` / `setStatus` / `setTitle` / `setWidget`（仅字符串数组）。
- 不可跨进程（需要真 TUI 对象，RPC 模式下 pi 自己也是空实现）：
  `custom()` / `setFooter` / `setHeader` / `setWorking*` / `onTerminalInput` / 编辑器系列。
- 复杂交互走自有 IPC 通道（权限弹窗就是这么做的）。

### 其他

- 技能：pi 原生支持 [Agent Skills 标准](https://agentskills.io/specification)，
  从 `~/.pi/agent/skills/`、`.pi/skills/`、`.agents/skills/` 加载。我们的 agentDir 是 `~/.kamibuddy`。
- 会话存储：`SessionManager.create(cwd, dir)` 走 JSONL 文件，`inMemory()` 走内存。
- 上下文用量：`session.getContextUsage()` → `{ tokens: number | null, contextWindow, percent }`。
  tokens 可能为 null（刚压缩完）。
- 压缩：pi 内置自动压缩，`compaction_start` / `compaction_end` 事件可监听。
- **pi 没有**：MCP、子代理、plan 模式、todo、后台 bash、WebFetch、WebSearch、权限系统。
  官方 `usage.md` 明说是有意不做，`examples/extensions/` 里有 80+ 个参考实现
  （`plan-mode/`、`subagent/`、`todo.ts`、`permission-gate.ts` 等），可照着改。

---

## 2. P0 · 通用 Agent 底座

没有这几项，"通用 agent" 不成立。**按顺序做**，有依赖关系。

### T1 · 提示词两轴落地（✅ 已完成 · 轻量版，2026-09-07）

已落地：`resources/scenes/work/prompt.md` + `modes/{craft,ask}.md`（轻量通用文案，
按用户要求**先不做重的**，等功能齐了再细调）、`core/resources.ts`、`core/prompt-composer.ts`、
`extensions/prompt-switch.ts`（before_agent_start 每轮整体替换）、
`setInteraction` 时 `setActiveToolsByName()`、daemon 两轴常量改为 resources 驱动。
配套 19 个测试（composer/resources/prompt-switch），smoke:session 12/12，
真机直跑验证 daemon 正常启动、snapshot 往返正常。

注意：整体替换后 pi 不再自动附加技能清单与 cwd —— 由 composer 的
`{{skills}}` / `{{cwd}}` 槽位负责（技能段当前为空，T2 接通）。
以下设计细节保留，供细调提示词时参考：

#### 设计定稿（2026-09-07，可照此直接实现）

**资源文件形态**（「双面文件」：frontmatter 给加载器，正文给提示词）：

```
resources/
  scenes/work/prompt.md      场景骨架。frontmatter: id/label/description/ready；
                             正文含 4 个槽位：{{interaction}} {{skills}} {{cwd}} {{model}}
  modes/craft.md             frontmatter: id/label/description/ready/tools: [read, write, edit, find, grep, ls]
  modes/ask.md               frontmatter: tools: [read, find, grep, ls]（只读）
```

- **不引模板引擎**（YAGNI）：槽位就是字面量替换，20 行搞定。composer 对**未识别的
  `{{token}}` 必须抛错**——带着空槽位上线的提示词是最难排查的故障。
- `prompts/fragments/` 推迟到第二个场景真正需要共享时再建（现在只有一个场景 ready）。

**提示词骨架**（正文自己写，合规红线 §0；结构参考 WorkBuddy 的机制，文字全部原创）：

1. 身份与产品 —— 你是 KamiBuddy，办公场景的智能助手。**绝不出现 pi / coding 痕迹**
2. 能力边界 —— 能读写工作目录、生成文档产物；不装软件、不改系统设置
3. 安全与路径 —— 工作目录概念（绝对路径或相对 cwd）、配置区不可碰、删除需确认
4. 交付纪律 —— 产物落盘到工作目录并告诉用户路径；「中间过程在界面被折叠，
   最终回复必须自足」；HTML 优先
5. 行为规范 —— 优先用专用工具、时间不心算、一次一事
6. 语言与地域 —— 中文回复、人民币、A股红涨绿跌
7. `{{interaction}}` ← 模式行为段注入点：
   - craft：完整能力的执行循环（理解→动手→验证→交付）
   - ask：**只读三禁**（不改文件 / 不执行命令 / **不得谎称已创建**）+ 建议切创作模式
8. `{{skills}}` ← 技能清单注入点（T2 前为空，空内容零 token）
9. 收尾：`{{cwd}}` + `{{model}}`

**机制选择（关键，别走弯路）**：

- 用 `before_agent_start` 扩展事件**每轮返回** `{ systemPrompt }` 覆盖。
  这是 pi 官方支持的替换路径（`BeforeAgentStartEventResult`），每次 run 结束自动清空，
  两轴切换零状态同步。**代价**：覆盖是整体替换，pi 默认会自动附加的技能清单、
  cwd、上下文文件**全部失效**——所以 composer 必须自己把这些拼进去（骨架第 8、9 节）。
- 工具集：`setScene/setInteraction` 时调 `session.setActiveToolsByName(mode.tools)`
  （白名单语义：未列出的工具被禁用，含扩展注册的自定义工具）。
- 场景/交互的**权威状态**仍在 SessionHost；扩展经一个可变引用回调取当前两轴
  （SessionHost 构造完成后再回填引用，pi 自己的 extensionRunnerRef 就是这个模式）。

**改动点清单**：

| 文件 | 动作 |
|---|---|
| `core/resources.ts`（新） | 扫描 `resources/`，parseFrontmatter → SceneResource / ModeResource / ModeDescriptor[]。坏文件抛错 |
| `core/prompt-composer.ts`（新） | 纯函数：scene 骨架 + 模式正文 + skills + cwd + model → string。槽位替换、未知槽位抛错 |
| `extensions/prompt-switch.ts`（新） | 薄胶水：监听 before_agent_start，取两轴 → composer → 返回 systemPrompt |
| `core/session-host.ts` | 保存 loader 引用（取 skills）；create() 里多注入一个扩展；setScene/setInteraction 加 setActiveToolsByName；DEFAULT_TOOLS 降级为「资源缺失时的兜底」 |
| `daemon/index.ts` | SCENES / INTERACTIONS 常量删除，改由 resources loader 在启动时加载（加载失败响亮崩溃——没有提示词的产品是错的） |

**测试**：composer 槽位替换/未知槽位抛错/空技能省略；loader 扫描与坏文件；
prompt-switch 胶水（仿 permission-gate.test 的假 ExtensionAPI）。

**验收**：
1. 加一个模式 = 加一个 `.md` 文件，零行代码；
2. 问「你是谁」→ 自称 KamiBuddy 办公助手，无 pi 痕迹；
3. ask 模式让它写文件 → 拒绝且说明只读，不得谎称已创建；
4. `npm run smoke:session` 仍全绿。

风险：`resources/` 在打包后要能被读到 —— electron-vite 默认不复制它。
建议现在就验证一次打包路径，别等 T14。

### T2 · 技能机制接通（✅ 已完成 · 2026-09-08）

已落地：pi 原生 Agent Skills 加载（内置 `resources/skills/` + 用户 `~/.kamibuddy/skills/`）、
侧栏独立页面「专家·技能·连接器」（`renderer/skills-view.tsx`，不放设置页）、
技能导入（`core/skill-install.ts`，含 frontmatter 校验与重名拒绝）、
提示词技能段由 `prompt-composer` 每轮现读（导入后下一轮即生效，无需重启）。

**注意**：pi 的 `buildSystemPrompt` 只在工具白名单含 `read` 时注入技能段——
模式 frontmatter 去掉 `read` 会让技能静默消失（见上方 §1 的陷阱条目）。

待补：单技能开关（pi 无原生 per-skill disable，需自己做持久化过滤，优先级低）。

写技能的方法论照抄 WorkBuddy 的**渐进式披露**：
`SKILL.md` 只写红线 + 路由 + `when_to_use`（穷举口语化触发场景），
方法论拆到 `references/*.md` 按需 Read —— 控制常驻上下文。
参考 `docs/workbuddy分析/03-plugins-skills.md` 的 `wb-finance-skill` 案例。

### T3 · 联网工具（WebFetch + WebSearch）（✅ 已完成 · 2026-09-08）

`web_search` / `web_fetch` 两个自定义工具已注册（`extensions/web-tools.ts`），
四个搜索服务商（Tavily/博查/Brave/Bing）做成注册表，设置页「联网搜索」区块选填 Key。
已落地细节见 [STATUS.md 联网工具（2026-09-08 落地）](STATUS.md)。

### T4 · 会话管理（多会话 / 历史 / 恢复）

现状：只有单会话，重启就没了。侧栏「任务」列表只显示当前这一条。
这是通用 agent 的基本盘 —— 用户会问「昨天那个报告在哪」。

要做：会话列表（读 `~/.kamibuddy/sessions/`）→ 侧栏渲染 → 点击切换 → 重命名 / 删除。
`SessionManager` 有现成能力，先读 `packages/coding-agent/docs/sessions.md`。

验收：关掉应用重开，能找回上次的对话并继续。

### T5 · 记忆

**先确认 pi 现状再动手**：pi 有 `AGENTS.md` 类的上下文文件加载，
但「AI 自主保存记忆」这类是否内置需要查（读 `packages/coding-agent/docs/` 下相关文档）。

WorkBuddy 是四层：云端画像 / 用户级 `MEMORY.md`（4000 字符上限）/ 工作区日志 / Auto Memory。
我们本期做两层够用：用户级偏好 + 项目级上下文。

验收：告诉它「以后周报都用这个格式」，下次新会话仍然记得。

---

## 3. P1 · 通用体验

### T6 · 产物预览面板（✅ 已完成 · 2026-09-08，由并行会话推进）

已落地：`present_files` 交付工具（`extensions/present-files.ts`，对齐 WorkBuddy
「产物交付唯一入口」协议）、右侧预览面板（`renderer/artifact-panel.tsx`：多 tab +
概览下拉 + 变更 diff 视图）、静态预览服务（`core/preview-server.ts`，根固定为当前
工作区、resolve 后必须在根内防 `../` 穿越，playground 不起服务）。

**遗留一处安全项**（不阻塞交付，但打包前应复核）：预览 iframe 目前是
`sandbox="allow-scripts allow-same-origin allow-forms"`。这两个值同时给会**削弱沙箱**
——模型生成的 HTML 拿到脚本执行 + 同源身份后，可访问预览服务同源下的其他工作区文件。
当前风险有限（服务根就是用户自己的工作区、内容由用户自己的模型产出、不含凭据），
但更稳的做法是让预览服务对每个产物发不同 origin，或去掉 `allow-same-origin`
（代价是页面内 fetch 相对路径会失效）。决定前先确认 T11 生成的 HTML 是否依赖同源请求。

### T7 · 文件引用（@ 与附件）

首页与对话页的 `+` 按钮现在是 `onTodo` 占位。
要做：文件选择 → 路径注入到提示词。图片走 pi 的 `ImageContent`（`prompt` 已支持 `images`）。

### T8 · 子代理 / 任务

pi 没有，`examples/extensions/subagent/` 有参考实现。
深度研究类任务的前提（主代理协调、子代理并行探索、结果汇总）。
WorkBuddy 的治理机制值得抄：嵌套深度上限、spawn 预算、**子代理输出去毒**（防提示注入回灌）。

### T9 · Plan 模式 + 待办清单

pi 没有，`examples/extensions/plan-mode/`、`todo.ts` 有参考实现。
两轴里的 `plan` 模式要靠它落地。长任务的进度可见性也依赖它。

### T10 · 上下文用量与压缩提示（✅ 已完成 · 2026-09-08，由并行会话推进）

已落地：输入条常驻用量圆环（`renderer/context-usage.tsx`，点击展开分类估算——
系统提示词 / 技能 / 对话 / 工具结果，成分口径在 `shared/context-usage.ts`）、
`/compact` 手动压缩（`shared/builtin-commands.ts` 拦截 + `SessionHost.compact`）、
压缩期间复用 run 记账维持流式态与停止键（`compaction_start` / `compaction_end`）。

**一处已修的坑**：压缩后 pi 的 `getContextUsage()` 有一段 `tokens=null` 空窗，
此时必须清掉明细，否则圆环停在压缩前的旧值（reducer 里有对应分支与测试）。

---

## 4. P2 · 专用能力（技能包形式）

**T2 完成后**，这些应当是「加一个技能包」，而不是改代码。若发现必须改代码，说明 T2 没做透。

### T11 · 文档生成（原定首个纵切片）

WorkBuddy 投入最大的内置插件不是腾讯生态，是**本地文档生成**（`tencent-docx`：
一个编排器 SKILL 守门 + 3 个 agent + 8 个技能 + 9 个文体专家 + 20 多模块转换器），
而且完全不依赖腾讯云。这是最值得抄的一块。

**架构已定：HTML 是唯一中间态**（ARCHITECTURE.md §4.3）。一份代码同时拿到：

| 产出 | 手段 |
|---|---|
| 预览 | HTML 直接在 Electron 渲染（T6 的面板） |
| PDF | `webContents.printToPDF`，Electron 原生零依赖 |
| 图表 | ECharts 在 HTML 里直接跑 |
| docx / xlsx / pptx | 导出器统一签名 `(html, opts) => Promise<Buffer>` |

**禁止**直接拼 docx 对象 —— 那样预览、PDF、图表三件事都要另做一遍。

流水线照抄 WorkBuddy 的机制（一步不少）：

```
内容 + design tokens + 体裁
  → genres/<体裁>/{prompt.md, template.html}
  → HTML（样式只许引用 CSS 变量，禁裸值）
  → 六维审查（token 合规 / 结构 / 体裁契合 / 安全 / 排版 / 装饰）
  → 导出器
```

放 `src/documents/`（目录还不存在）。**它不许 import pi、不许 import electron**
（AGENTS.md §1.1）—— 纯函数库，这样能脱离 LLM 单测，这是我们最重的模块，测试是唯一护栏。

先做职场文档（周报 / 方案 / 会议纪要），一个体裁做到位再铺第二个。

### T12 · 联网调研报告

依赖 T3。交付形态是带 ECharts 图表的 HTML 报告。
WorkBuddy 的 `wb-finance-skill` 是教科书案例（46 篇 references + 16 个脚本，默认交付 HTML 研报）。

### T13 · 表格 / 幻灯片

`exceljs` / `pptxgenjs`。优先级低于文档，等前面站稳再说。

---

## 5. P3 · 分发

### T14 · 打包（不要拖到最后）

理由：通用能力大多不可见，你需要**尽早有一个能双击运行的 exe** 拿给人看，
而打包总会暴露路径问题（`resources/` 是否被复制、`asar` 内能否读文件、原生模块是否正常）。

建议在 T1 完成后就先打一次包验证路径，别等全部做完。

`electron-builder`，注意：
- `resources/` 与 pi 的依赖要正确打进去（原生模块不能进 asar）
- 图标、应用名、版本号
- 首次启动引导：没配 Key 时要明确指向设置页（现在的报错文案已经这么写了）

### T15 · 收尾

崩溃处理、日志落盘（现在 daemon 日志只在终端）、演示脚本、交付文档。

---

## 6. 排期建议（2026-09-08 修订）

**P0 底座与 P1 主要体验已完成**：T1 提示词两轴、T2 技能机制、T3 联网工具、
T6 产物交付与预览面板、T10 用量与压缩。距 2026-09-21 约两周。

剩余按价值排序：

| 顺序 | 内容 | 理由 |
|---|---|---|
| 1 | **T14 先打一次包** | 拖到最后风险最高：`resources/` 是否被复制、asar 内能否读文件、原生模块——这些只有打包才暴露。现在打一次，问题还有时间修 |
| 2 | **T11 文档生成** | 产品价值主菜，也是「交给同事试用」时唯一能一眼看懂的能力。做一个体裁（周报）到位，胜过三个半成品 |
| 3 | T4 会话恢复 | 试用者必然会问「昨天那个报告呢」。JSONL 已落盘，主要是 UI |
| 4 | T5 记忆 | 「以后周报都用这个格式」——试用中很容易被夸的点 |
| 5 | 其余（T7/T8/T9/T12/T13） | 按试用反馈决定 |

**补测试债**：`extensions/present-files.ts` 目前**没有测试**（其余扩展都有：
policy 23 / gate 16 / prompt-switch 3 / web-tools 7）。它是交付协议的实现，
路径分类与工作区校验出错会直接影响产物可见性，动它之前先补上。

**每完成一项就更新 [STATUS.md](STATUS.md)** —— 它是进度的唯一权威来源，
写给非当事人也能读懂（用户明确要求过）。

---

## 7. 等用户亲自验证的事

**已通过**（用户实测）：真实对话（填 Key → 选模型 → 正常回复）、Markdown 与
思考块折叠、工具卡片、工作空间切换。

**待验证**——必须**重启应用**（Electron 不热更新 daemon/preload，改动只在新进程生效）：

1. **联网搜索** —— 设置 → 联网搜索 → 「测试连接」，15 秒内必有结果。
   服务商侧已实测可用（博查直连返回真实结果），验的是应用内链路。
2. **联网问答** —— **新建任务**问「今天嘉立创的股价」，应出现「联网搜索 → 已搜索」
   卡片且回答带来源。旧会话不生效：工具集在建会话时一次性注入。
3. **权限弹窗** —— 「在桌面建一个 txt」应弹审批框；写工作目录内应直接放行。
4. **中断** —— 长任务中途点停止键。
5. **产物交付** —— 让它生成一份文件，看产物卡片与右侧预览面板。

构造级实测见 `npm run smoke:session`（13/13），
但那只验证「会话能建起来」，不等于「端到端行为正确」。
