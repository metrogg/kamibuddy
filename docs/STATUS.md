# 当前进度

> 最后更新：2026-09-07（D3 完成，策略转向通用底座优先）
> 新接手请按顺序读：本文（现状 / 怎么跑 / 已知坑）→ [ROADMAP.md](ROADMAP.md)（要做什么）
> → [ARCHITECTURE.md](ARCHITECTURE.md)（决策记录）→ [../AGENTS.md](../AGENTS.md)（开发约定）

## 一句话现状

会话链路已全部接通并通过构造级实测；设置界面可真用（填 Key、选模型、加自建服务商）；
权限门与工具卡片已落地。

**但从未真正调用过一次模型** —— 我没有 API Key 也不该用你的。
所以「能不能真的对话」这件事，需要你填一个 Key 亲自验一次（见下方「等你验证」）。

## 项目背景

| 项     | 内容                                                                                        |
| ----- | ----------------------------------------------------------------------------------------- |
| 目标    | 基于 [pi agent harness](https://pi.dev) 做办公 AI Agent 桌面端，对标腾讯 WorkBuddy                     |
| 交付形式  | 直接给部门同事试用评价                                                                               |
| 期限    | 两周（约 2026-09-21）                                                                          |
| 范围策略  | **深度优先**：WorkBuddy 功能清单当规格书，深度优先只决定做的顺序，不缩小最终范围                                           |
| 首个纵切片 | 文档生成（职场文档 + 联网调研报告）                                                                       |
| 参考物   | WorkBuddy 安装目录 `C:\Program Files\WorkBuddy\`，逆向素材在 `_analysis\`；分析笔记在 `docs/workbuddy分析/` |

范围取舍见 ARCHITECTURE.md §1，合规红线见 AGENTS.md §6（**机制可学，文字必须自己写**）。

## 已完成

### D1 · pi 能力边界验证

结论汇总在 ARCHITECTURE.md §5。三个最高风险项全部通过：
`ctx.ui` 可路由到 Electron、原生模块 ABI 兼容（Node-API）、Windows shell 策略已定。

另确认：pi 原生支持 Agent Skills 标准；内置工具仅 8 个；
WebFetch / WebSearch / **权限系统** / MCP 均需自研。

### D2 · Electron 骨架 + IPC 全链路

真机验证通过，`← session:snapshot` 证明请求走完 renderer → preload → main → daemon 全程。

### 界面 · WorkBuddy 版布局

侧栏、首页（场景页签 / 能力入口 / 输入卡 / 案例卡 / 吉祥物）、对话页、设置页、toast。
未实现的入口统一 `onTodo` 给明确反馈，不做死按钮。

### 模式双轴修正

原先把模式压成一个 `modeId`，与 WorkBuddy 实际结构不符。已按其内置插件目录改正：

| 轴  | WorkBuddy 目录（`category`）          | 取值                          | 界面位置   |
| -- | --------------------------------- | --------------------------- | ------ |
| 场景 | `welcomemode/`（`welcomeMode`）     | work / code / design        | 首页页签   |
| 交互 | `interactionmode/`（`interaction`） | ask / craft / plan / expert | 对话页切换器 |

两轴正交，提示词是二者共同的函数。**必须在写提示词之前改**，否则 D4-5 返工。

### 设置界面

填 / 换 / 清除各家 API Key、选模型、增删改自建服务商、联网刷新目录。
实测 pi 内置 **40 家服务商、1354 个模型**（含 DeepSeek、智谱、Kimi、MiniMax、通义、小米等国内可直连的）。

三条设计结论由 `scripts/probe-custom-provider.ts` 实测得出，非推测：

1. 密钥存 pi 的 `auth.json`（0600）。注意 `setRuntimeApiKey()` 是 **non-persistent** 的
   （pi 的 RuntimeCredentials 自述 "overlay for non-persistent runtime API keys"），
   只同步本进程；持久化由我们按 pi 的文件格式写入（`core/api-keys.ts`，
   pi 包根未导出凭据写入 API）。曾只用 runtime 方法导致 key 重启即丢
   （用户实测踩到，已修，`scripts/probe-key-persistence.ts` 可复验）。
2. 自建服务商的 `models.json` **不留明文密钥**（`apiKey` 可省略，凭据同样走 `auth.json`）。
3. **未配凭据的服务商，其模型照样出现在目录里**，所以模型卡片必须显式禁用，
   否则用户会选到一个点了才报错的模型。

配置目录用 `~/.kamibuddy/` 而非 pi 默认的 `~/.pi/agent/`：后者可能已有用户自己的 pi CLI 配置。

### D3 · 会话接入 + 工具卡片 + 权限门

**会话适配层**（`core/session-host.ts`）持有 pi 的 `AgentSession`，把 pi 事件翻译成
`shared/session-events.ts` 的领域事件。用 pi 的真实 `AgentSessionEvent` 类型而非宽松 Record ——
这样 pi 改字段名会编译失败，而不是让工具卡片静默不渲染。

两处 pi 的实际约束决定了写法：

- **pi 的消息没有稳定 id**（只有 timestamp），而 UI 流式增量要靠 id 定位气泡，
  所以 id 由适配层生成。工具卡片例外：`toolCallId` 本身稳定。

- turn 级事件对 UI 无意义（用户看到的是消息与卡片，不是「轮」），一概吞掉。

**工具卡片**默认折叠，点击展开正文，状态点区分执行中 / 成功 / 失败。
WorkBuddy 主提示词里也明确写「中间过程在 UI 被折叠」，同一个考虑。

**流式期间发送键变停止键**。没有中断入口时，模型跑偏或长任务只能干等甚至杀进程。

**权限门**（`extensions/permission-policy.ts` + `permission-gate.ts`，39 个测试）：
判定主轴是路径归属而非工具种类，详见 ARCHITECTURE.md §4.57。
工作目录内放行、目录外询问、**配置目录直接拒且不给「允许」选项**（auth.json 存着密钥）。

审批队列而非单槽 —— pi 默认并行执行工具，同批可能来多条请求，覆盖会让工具永久挂住。

**会话历史的 reducer 移到** **`shared/`**：daemon 与 renderer 都需要它
（daemon 供 snapshot、renderer 折叠增量），各写一份必然漂移，
症状是「重开界面后内容变了」。

## 验证状态

```
typecheck        通过
check:deps       31 个文件，依赖方向合规
test             99 passed（5 个文件）
smoke:sdk        3/3
smoke:session    12/12  ← SessionHost.create() 全流程，含扩展注入实测
真机运行          daemon 正常启动，IPC 往返正常，无报错
```

`smoke:session` 是这轮最有价值的验证：它把三件「类型对但运行时可能炸」的事一次性证实了 ——
自建 `DefaultResourceLoader` 并 `await reload()`、同一个 `SettingsManager` 交给两处、
扩展经 `extensionFactories` 注入。其中扩展注入尤其需要实测：签名不对时 pi 会**静默跳过**。
脚本用指向 `127.0.0.1:9`（保留端口）的假服务商，不产生网络请求、不消耗额度。

## 等你验证

这几件事我做不到，需要你操作：

1. **真实对话** —— 打开应用 → 左下角设置 → 给任一服务商填 Key → 选模型 → 回首页发一句话。
   若你在用国内网络，推荐 DeepSeek / 智谱（pi 内置，填 Key 即用）。
2. **权限弹窗** —— 让它「在桌面建一个 txt 文件」，应当弹出审批框（工作目录外）。
   再让它「写一个文件到工作目录」，应当直接放行不打扰。
3. **工具卡片** —— 看折叠 / 展开、状态点、失败态是否正常。
4. **中断** —— 让它做个长任务，中途点停止键。

发现问题直接告诉我现象即可。

## 仓库地图

```
docs/
  STATUS.md            ← 本文
  ARCHITECTURE.md      架构 + 决策记录 + 十天计划
  workbuddy分析/        逆向调研笔记（仅参考，勿抄文字）
AGENTS.md              开发约定

src/shared/            零依赖，谁都可以 import
  session-events.ts    会话领域事件（含模式两轴）
  conversation.ts      事件流 → 视图（daemon 与 renderer 共用，11 个测试）
  ipc.ts               IPC 通道名 + payload 契约（唯一约定来源）
  daemon-protocol.ts   main↔daemon 帧协议
  bridge.ts            preload 暴露给 renderer 的接口
  settings.ts          设置页领域类型 + 自建服务商校验（两侧复用同一规则）

src/core/              pi SDK 适配层 —— pi 类型止步于此
  session-host.ts      持有 AgentSession，pi 事件 → 领域事件
  model-catalog.ts     pi ModelRuntime → 领域类型；凭据读写
  custom-providers.ts  维护 models.json（含归属守卫，20 个测试）
  config-paths.ts      ~/.kamibuddy 与 ~/KamiBuddy 各路径
  preferences.ts       选中的模型等偏好

src/extensions/        pi 扩展 —— 依赖方向 extensions → core
  permission-policy.ts 纯判定函数（23 个测试）
  permission-gate.ts   接进 pi 的 tool_call 拦截（16 个测试）

src/main/index.ts      窗口 / CSP / utilityProcess 托管 / 哑转发
src/preload/index.ts   白名单桥，通道名不泄漏到 renderer
src/daemon/index.ts    业务进程：会话编排、设置、审批中转
src/renderer/
  App.tsx              视图路由 + 审批队列
  sidebar.tsx  home-view.tsx  chat-view.tsx  settings-view.tsx
  permission-dialog.tsx  阻塞式审批弹窗
  icons.tsx  toast.tsx  index.css

scripts/
  smoke-session.ts           会话构造全流程（含扩展注入）
  smoke-pi-sdk.ts            pi SDK 冒烟
  probe-custom-provider.ts   自建服务商凭据路径实测（设置页设计依据）
  check-dependency-rules.ts  依赖方向机械校验
  run-electron.mjs           启动包装器（剔除 IDE 注入的环境变量）
```

## 怎么跑

```bash
npm install            # 首次；electron 二进制若缺失见下方「已知坑」
npm run dev            # 开发（含热更新）
npm start              # 构建产物预览
npm run check          # typecheck + 依赖方向
npm test               # 单元测试
npm run smoke:session  # 会话构造冒烟（不联网、不耗额度）
npm run smoke:sdk      # pi SDK 冒烟
```

**必须用** **`npm run dev`** **/** **`npm start`，不要直接** **`npx electron .`** —— 原因见下。

| 目录              | 内容                                                                                           |
| --------------- | -------------------------------------------------------------------------------------------- |
| `~/.kamibuddy/` | `auth.json`（密钥，0600）、`models.json`（自建服务商）、`models-store.json`、`preferences.json`、`sessions/` |
| `~/KamiBuddy/`  | **会话工作目录**，AI 生成的文档落在这里。刻意与配置分开，免得用户误删配置                                                     |

## 已知坑

### pi 没有权限系统，也没有任何路径约束

`utils/paths.ts:102` 的 `resolvePath` 对绝对路径直接放行，工具目录里搜不到越界检查。
即模型给出绝对路径就能写到硬盘任意位置，包括覆盖 `auth.json`。
pi README 自述 "does not include a built-in permission system"，它的思路是靠容器隔离整个进程。

我们的对策是 `src/extensions/` 那一层（ARCHITECTURE.md §4.57）。
**改动那两个文件时务必跑** **`npm test`** —— 那 39 个测试是这条安全边界的唯一护栏。

### IDE 注入 `ELECTRON_RUN_AS_NODE=1`

Electron 系 IDE（Trae CN、VS Code、Cursor…）本身是 Electron 应用，会给集成终端注入该变量，
使 Electron 二进制退化成普通 Node —— 没有 `app`、没有 `BrowserWindow`。

判据：`npx electron --version` 打印 Node 版本（`v24.20.0`）而非 Electron 版本（`v44.2.0`）。
已由 `scripts/run-electron.mjs` 处理。

### 构建产物必须是 `.mjs`

Electron 的 ESM 主进程按扩展名判断模块类型。electron-vite 只在单入口时自动加 `.mjs`，
本项目双入口（`index` + `daemon`）会退回 `.js`。已在配置里显式指定。

**上面两个坑的报错信息完全相同**，极易误判：

```
SyntaxError: The requested module 'electron' does not provide an export named 'BrowserWindow'
```

### 环境变量里的凭据会被 pi 自动采用

pi 会读约 40 个环境变量。实测本机 `ANTHROPIC_AUTH_TOKEN` 已设置（很可能由 IDE 注入），
于是 Anthropic 在设置页显示为「已配置（来自环境变量）」。

两个后果：这类凭据**界面删不掉**（源头是环境）；
且若该变量只存在于 IDE 终端，从开始菜单启动的正式应用里它不存在。
**这正是设置页必须存在的理由** —— 不能依赖环境变量。

### 不要把 pi 的内部包装成直接依赖

试过 `npm install @earendil-works/pi-ai` 以取用 `findEnvKeys`：该函数没从包根导出（拿不到），
且依赖树里多出**第二份 pi-ai 拷贝**（provider 注册表两份的风险）。已回退。
只依赖 `@earendil-works/pi-coding-agent` 一个包。

### electron 二进制可能缺失

若用了 `--ignore-scripts`，postinstall 不跑。补下载：

```bash
cd node_modules/electron && ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" node install.js
```

### 依赖版本锁定原因

`@vitejs/plugin-react` 必须停在 **5.2.0**：6.x 要求 `vite@^8`，
而 `vitest@3.2.4` 与 `electron-vite@5.0.0` 只支持到 `vite@^7`。

## 下一步

**策略已调整**：原先按天排的纵切片计划（D4-10）改为
**先做通用 Agent 底座，再以技能包形式一个个补专用能力**。

理由：pi 的技能机制（Agent Skills）本身就是「加专用能力」的正确入口，
WorkBuddy 那 33 个内置插件全是这么组织的。先把底座和技能机制做好，
后面每个垂类就是加一个技能包而非改代码；反过来先硬编码文档生成，
等技能机制上来还得重构一遍。

完整任务清单见 **[ROADMAP.md](ROADMAP.md)**，含：
接手者硬约束、已查清的 pi API 事实（省下重复调研）、P0-P3 分级任务、排期建议。

眼下第一件事是 ROADMAP 的 **T1 提示词两轴落地**：
`core/frontmatter.ts` 已完成（29 个测试），但 `resources/` 目录还不存在，
`SessionHost.setScene/setInteraction` 目前只改状态、不改提示词与工具集。

## 尚未做的事

- **模式切换目前只改状态，不改提示词与工具集** —— 两轴已存进 `SessionState` 并回推 UI，
  但 `SessionHost.setScene/setInteraction` 还没重组 systemPrompt。这是 D4-5 的正题。

- 未实现的场景 / 模式（code、design、ask、plan、expert）点击给 toast，不会静默切换。

- 附件引用、语音输入、侧栏各导航项仍是 `onTodo` 占位。

- 打包分发（electron-builder）未配置。

- git 有大量未提交改动（上次提交是「侧边栏导航与首页/对话页基础布局」）。

## 工作空间（2026-09-07 落地）

机制对标 WorkBuddy（空间 = 目录，会话 cwd 终身绑定，换空间 = 新任务）：

- 首页「选择工作空间」可选：**不使用工作空间（playground）** / 默认根（`~/KamiBuddy`）/ 根下已有子目录 / 新建（同名子目录，不可改名）/ 打开本地文件夹。

- **安全守卫**（`core/workspace.ts`，14 个测试）：配置目录（含密钥）、应用目录及其祖先一律拒绝设为工作空间——
  工作空间内写操作权限门直接放行，「设为哪个目录」就是安全边界本身。

- 切换即作废旧会话（cwd 在建会话时一次性注入 pi 工具集），daemon 清空历史、renderer 重拉快照。

## 会话隔离 + playground（2026-09-07 落地）

根治「任务干扰」：此前未选空间会用 `~/KamiBuddy` 兜底，且所有消息复用同一个 AgentSession，
导致不同任务共享上下文与文件目录。现对齐 WorkBuddy 模型：

- **工作空间 ≠ 会话**：工作空间决定「在哪工作（cwd + 权限边界）」，会话决定「对话上下文」。
  同一空间下多个任务的文件可共享，但聊天上下文相互隔离。

- **新建任务 = 真新建会话**：sidebar「新建任务」调 `session:new-task`，daemon 作废旧 SessionHost、
  清空本地历史（`resetSession`），工作空间选择保留。不再只是切页面。

- **playground（不使用工作空间）是新建任务的默认状态**：`SessionState.isPlayground=true`、`cwd=undefined`。

  - 安全边界是**工具集为空**（`PLAYGROUND_TOOLS=[]`），而非「没有目录」——
    pi 的内置工具支持绝对路径，只置空 cwd 挡不住，所以根本不注册文件工具。

  - pi 侧技术 cwd 用配置目录下的 `playground/` 占位（资源发现需要真实目录），该目录在配置目录内本就禁写。

  - playground 不装权限门扩展（无文件工具可拦）。

- 会话仍是懒建（首次 prompt 才建 SessionHost），新建任务只作废 + 清空，下次 prompt 自然建新会话。

待做（归 T4 多会话）：会话列表持久化与恢复（`SessionManager` 已写 JSONL，但 UI 还没有
历史任务列表/切换/重命名/删除）；「保存到工作空间」（playground 任务事后落为正式空间）。

## 输入框补全 @ / （2026-09-08 落地）

首页与对话页输入框支持 `@` 引用文件、`/` 调用命令的补全下拉。**选中后按纯文本插入**
（不做内容注入）：文件内容靠模型的 read 工具去读，`/skill:xxx` 由 pi 的 prompt 展开机制处理。

- **纯逻辑**（`shared/autocomplete.ts`，18 个测试）：`completionTrigger` 从光标前文本解析触发
  （`/` 仅在文本首字符触发，与 pi 的 expandPromptTemplate 对齐；`@` 要求在行首或空白后），
  `filterItems` 子序列打分过滤，`applyCompletion` 计算替换后的文本与光标位置。

- **数据源**（`INVOKE.completions`）：文件列表 = `core/file-index.ts` 扫当前工作空间
  （跳过 node\_modules/.git 等，上限 2000 条；playground 为空列表，`@` 下拉自然不出）；
  命令列表 = 技能（`/skill:name`）+ 自有命令（`/new`）。

- **UI**（`renderer/autocomplete.tsx` 的 `useAutocomplete`）：受控 textarea 接管光标追踪与
  键盘导航（↑↓ 选择、Enter/Tab 选中、Esc 关闭），鼠标 mousedown 选中（preventDefault 保焦点）。
  home-view 与 chat-view 同一接法。Enter 键分工：补全打开时 = 选中（已 preventDefault），
  未打开时 = 发送。

- 数据源组件挂载时拉一次；新建任务后组件随父级重挂载自然刷新。

## 生成阶段工具卡片（2026-09-08 落地）

对标 WorkBuddy 的「生成中 +N」：写文件时**模型流式吐参数的阶段卡片就上屏**，
行数实时增长，不再等执行才出现（执行是毫秒级，等它等于整段生成不可见）。

- **事件模型**：一次工具调用 = `tool_stream_started`（参数开始流式输出，卡片上屏、
  带 `generating` 标记）→ `tool_stream_progress`（write 专属：path 完整后原位更新
  路径与行数）→ `tool_started`（进入执行，同 id 原位翻转）→ `tool_finished`（终态）。
  全程一张卡，reducer 按 toolCallId upsert（`shared/conversation.ts`）。
- **适配层**（`core/session-host.ts` 的 `translateToolCallDelta`）：参数原文按
  contentIndex 自行累积（各 provider 的暂存字段名不统一，`toolcall_delta.delta` 才是
  公开契约）；卡片等 id/name 稳定才发出（openai 协议 start 时 id 是空串后补）。
- **行数口径**（`shared/artifacts.ts` 的 `writeStreamProgress`）：从半截 JSON 里抠
  path（闭合才认）与 content 片段，数字面 `\n` 得行数 —— 与终态 `changeFromWriteArgs`
  同字段两口径，UI 的 +N 徽章不用分开渲染。
- **兜底**：run 结束（正常/异常）时仍滞留的生成中卡片标记为 `aborted`，
  呼吸动画不会永远转下去；edit 不发行数进度（嵌套参数流式数行成本高收益低），
  生成中只有卡片本身。
- **状态行**：流式期间底部从「正在思考…」变为「正在写入文件 \<path\>…」（有生成中
  write 卡片时）。

