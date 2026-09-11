# KamiBuddy 架构设计

> 基于 pi agent harness 的办公 AI Agent 桌面端，对标腾讯 WorkBuddy。
> 本文是开发契约：改架构先改本文，理由写进 §4 决策记录。
> 开发约定见 [AGENTS.md](../AGENTS.md)。

## 1. 目标与范围

**交付目标**：两周内交出一个能直接给部门同事试用的桌面应用。
成功标准不是功能覆盖率，是"文档生成这件事真能用"。

**范围策略：深度优先**。WorkBuddy 的功能清单当规格书，深度优先只决定做的顺序，不缩小最终范围。

本期做：

- Electron 单窗口 + 流式对话 + 工具调用可视化 + 右侧产物预览面板
- 权限确认弹窗
- 三模式 Ask / Craft / Plan（工具白名单 + 提示片段组合）
- 文档生成纵切片：职场文档 + 联网调研报告
- 联网工具（WebFetch / WebSearch，pi 没有，自研）
- 技能机制（pi 原生 Agent Skills）+ 记忆 + 提示词模板
- <br />

## 2. 技术选型

| 层        | 选型                                                  | 理由                                      |
| -------- | --------------------------------------------------- | --------------------------------------- |
| Agent 内核 | `@earendil-works/pi-coding-agent` **0.85.1**，npm 依赖 | 不 fork。pi 迭代快，fork 即永久背 merge 债         |
| 桌面壳      | Electron + electron-vite + React + TypeScript       | 本地文件与本地 Office 是办公 Agent 的能力上限所在        |
| Agent 进程 | Electron `utilityProcess`，直接 import pi SDK          | 见 §4.1、§4.2                             |
| 文档中间态    | HTML                                                | 一份代码同时拿到预览 / PDF / 图表 / OOXML 导出，见 §4.3 |
| 模型       | 自备 API Key，走 `pi-ai` 现成 provider                    | 不自建抽象层，`pi-ai` 已是多 provider 统一层         |

WorkBuddy 的关键认知同样适用于我们：**Agent 主循环不自研**。
它 bundle 了 OpenAI Agents SDK，工程量全在外面那一圈（权限链、沙箱、提示词、生态）。
我们把 pi 放在同一个位置。

## 3. 分层架构

```
┌ Renderer (React) ─────────────────────────────────┐
│ 对话流 / 工具调用卡片 / 产物预览 / 权限弹窗          │
└──────────────────▲────────────────────────────────┘
        Electron IPC（契约集中在 src/shared/ipc.ts）
┌──────────────────┴────────────────────────────────┐
│ Main  只做窗口 / 生命周期 / safeStorage / 文件对话框 │
└──────────────────▲────────────────────────────────┘
        MessagePort（utilityProcess）
┌──────────────────┴────────────────────────────────┐
│ Daemon  会话编排 / 配置 / 审计                      │
│  core/       pi SDK 适配层（pi 类型止步于此）        │
│  extensions/ 自定义工具 / 权限门 / 模式 / UI 路由    │
└──────────────────▲────────────────────────────────┘
                   │
┌──────────────────┴────────────────────────────────┐
│ documents/  纯函数：内容+tokens+体裁 → HTML → bytes │
│             不认识 pi，不认识 Electron，可单测        │
└───────────────────────────────────────────────────┘
```

比 WorkBuddy 的五层（Renderer→Main→Daemon→Sidecar→CLI）少两层：
不需要 Sidecar 保姆进程（`utilityProcess` 由 Electron 托管），
不需要独立 CLI 进程（直接 import SDK，见 §4.2）。

### 目录结构

```
src/
  shared/      类型 + IPC 契约。零运行时依赖，谁都可以 import
  documents/   文档流水线（纯函数）
  core/        pi SDK 适配层
  extensions/  pi 扩展：工具 / 权限门 / 模式 / uiContext 路由
  daemon/      utilityProcess 入口
  main/        Electron 主进程
  preload/
  renderer/    React
resources/     modes / prompts / genres / tokens / skills（能力即数据）
scripts/       冒烟测试 / 依赖规则校验
开源项目/pi/    参考源码，不参与构建
```

依赖方向单向流动，`npm run check:deps` 机械校验。规则见 [AGENTS.md](../AGENTS.md) §1。

## 4. 决策记录

### 4.1 Daemon 用 utilityProcess，不用独立 Node sidecar

Electron 自带 Node 运行时，用户不需要装任何东西，与 §4.4 的零依赖原则一致。
崩溃不带走主进程。

**原生模块风险（已大幅降低）**。依赖树里有三个 `.node`：

| 模块                            | 加载时机                          | ABI                                          |
| ----------------------------- | ----------------------------- | -------------------------------------------- |
| `@mariozechner/clipboard`     | **import 期立即加载**（实测，非懒加载）     | napi-rs 构建（`package.json` 有 `napi` 字段）       |
| `pi-tui` `win32-console-mode` | 懒加载（`terminal.ts:375`）        | 用 `napi_register_module_v`，运行时解析 `napi_*` 符号 |
| `pi-tui` `darwin-modifiers`   | 懒加载（`native-modifiers.ts:29`） | 同上，走 dlfcn（仅 macOS）                          |

原先的假设"全部懒加载，纯 SDK 路径不触及"**被证伪**——clipboard 在 import 期就加载。
但实际风险更低：三者**全部基于 Node-API**，而 Node-API 的设计目的就是 ABI 稳定，
跨 Node 版本、跨 Electron 都不需要重编译。若是 V8 内部 API（如 nan）才需要 electron-rebuild。

**D2 已实测确认（风险关闭）**：daemon 在 Electron `utilityProcess` 内成功加载 pi SDK，
clipboard 原生模块正常加载，无 ABI 错误。

关键旁证：daemon 代码在 `process.parentPort` 不存在时会主动抛错
（`src/daemon/index.ts` 的 `requireParentPort()`）。它没抛而是正常打印启动日志，
证明确实跑在 utilityProcess 里，而非退化成普通 Node 进程。

因此 §4.1 的 Node sidecar 退路**不再需要**，进程模型定稿。

### 4.2 用 pi SDK，不 spawn `pi --mode rpc`

pi 两条路都提供。RPC 是 JSONL 子进程协议，隔离性好，但只能用协议暴露的那部分能力。
SDK 给完整 `AgentSession`：`subscribe()` 事件流、`setModel()`、`steer()`、扩展注册全在手上。
进程隔离由 `utilityProcess` 提供，不需要再靠协议边界换取。

### 4.3 HTML 是文档流水线的唯一中间态

WorkBuddy 自己就是这条路（`doc-typeset` → HTML → `html-to-docx` → OOXML）。
一份代码同时得到四样东西：

- **预览**：HTML 直接在 Electron 渲染，文档逐段长出来，演示效果最强且免费
- **PDF**：`webContents.printToPDF`，Electron 原生，零依赖
- **图表**：ECharts 在 HTML 里直接跑，不需要图片生成
- **docx / xlsx / pptx**：导出是末端一步，导出器签名统一 `(html, opts) => Promise<Buffer>`

反例：直接拼 docx 对象，则预览、PDF、图表三件事都要另做一遍。**此路封禁。**

抄 WorkBuddy 的流水线机制（一步不少）：

```
内容 + design tokens + 体裁
  → genres/<体裁>/{prompt.md, template.html}
  → HTML（样式只许引用 CSS 变量，禁裸值）
  → 六维审查（token 合规 / 结构 / 体裁契合 / 安全 / 排版 / 装饰）
  → 导出器
```

### 4.4 文档流水线按 WorkBuddy 跑 Python venv

文档生成的 S3「HTML→docx」照 WorkBuddy 的 `tencent-docx` 来：不要求用户机器
预装 Python / Git for Windows，而是自托管一套运行时（决策由用户拍板，替代 2026-09-08
的「不碰 shell / 不假设第三方命令」旧方案）。

环境准备抄 WorkBuddy 的 `setup-html-to-docx.sh` 机制：

- 幂等脚本，已就绪秒退；首次联网三步：装 `uv`（`astral.sh`）→
  `uv python install 3.12` 拉独立 Python 发行版（`python-build-standalone`）→
  建 `~/.venv-html-to-docx` → `--only-binary=:all:` 装 wheel。
- 强制 `--only-binary=:all:` 是刻意的：绕开 lxml 在无 libxml2/libxslt 时源码构建失败。
- 私有化 / 无外网：`UV_INDEX_URL` + `UV_PYTHON_INSTALL_MIRROR` 指向内网镜像，
  或运维预置 `uv` 与离线 wheel；未配置时首跑必然失败——这是明确交付前置条件，
  不是静默降级。
- SessionStart hook 后台异步预热（超时 5s 不阻塞），首次冷启动不卡会话。
- 转换失败降级 Markdown；单个组件/图片失败只跳过或占位，不整篇崩。

这套 venv 是文档流水线的进程内受控调用，**不等于把** **`bash`** **作为 agent 的自由
shell 工具暴露出去**——agent 的 shell 能力是另一个决策，见 §4.4a。

### 4.4a agent 的 shell 能力：用 powershell，不用 bash

决策日期 2026-09-08，四方调研见 `docs/workbuddy分析/09-sandbox-and-permissions.md`。

- **不用 bash**：pi 在 Windows 找不到 bash 会直接抛异常（`utils/shell.ts:100`），
  目标用户不装 Git for Windows；见 `docs/workbuddy分析/09-sandbox-and-permissions.md`。
- **用 powershell**：pi 内置该工具，Windows 原生、零额外依赖，绕开了上述问题；
- **前置条件（尚未满足）**：必须先有危险命令检查器 ——
  `iex` / `Invoke-Expression` / `Add-Type` / `-EncodedCommand` / 递归删除 / 下载执行…
  WorkBuddy 的 PowerShell 工具同样内置这类拦截。

**在检查器落地之前不要把它放进工具面。** 原因是能力边界的实话：
我们没有 OS 级沙箱（§4.4b），而一条命令就能绕开权限门的全部路径保护
（`type ~\.ssh\id_rsa` 读走密钥，权限门看不到这是一次凭据读取）。
所以当前 `permission-policy.ts` 对 shell 在**任何权限档位下都拦**，含"允许完全访问"。

### 4.4b OS 级沙箱：本轮搁置（成本，不是能力）

**"Windows 做不了沙箱"是错的判断**，必须写清楚，否则后人以为此路不通：

| 项目        | Windows 实现                                                           |
| --------- | -------------------------------------------------------------------- |
| codex     | `codex-rs/windows-sandbox-rs`（约 40 文件）：专用沙箱用户账号 + ACL + 独立桌面 + DPAPI |
| dsh       | `packages/shell/pwsh-sandbox`：自述 "ACL restricted-token runner chain" |
| WorkBuddy | 内核态 `tsbx.dll` + 287MB 用户态 + 语言 shim                                 |
| pi        | 不做，指向容器 / 微 VM（其 sandbox 扩展硬编码只支持 darwin/linux）                      |

两家独立收敛到同一机制（**受限令牌 + ACL**），这就是 Windows 上的正解。

搁置理由：① 需一次性**管理员安装 + 创建系统账号**，对"给同事试用"是显著摩擦；
② codex 那份是 Rust，无法复用，只能同机制重写；③「人人可写目录」这类绕过点
必须一并处理（codex 专门有个 `WindowsWorldWritableWarningNotification`），
否则又是一个假边界。

搁置期间的诚实声明：`SandboxEnforcement` 恒为 `partial`，界面如实说明
"这不是操作系统级隔离"。pi 的 security.md 警告过
*"a partial in-process sandbox would be easy to misunderstand as a security boundary"* ——
**做不到就说清楚，不假装有边界**。将来接上真沙箱只改 `buildPermissionInfo` 一处。

### 4.5 配置读取单一入口

所有配置走 `config.get(key)`，分层合并：内置默认 → 本地文件 → （预留）云端下发。
云端配置是将来少发版的命根子（WorkBuddy 的 product.json 模式：
模型目录 / 提示词 / 工具描述 / 阈值全云下发，客户端少发版）。

本期不做云端，但入口现在就统一——将来加一层远程 loader 只改一个模块。
反面是到处 `readFileSync('settings.json')`，将来全仓库大搜。

### 4.55 构建产物必须是 `.mjs`，且 dev/preview 走包装脚本

两个 Windows + Electron 的坑，都会导致「启动即崩」，且报错极具误导性。记在这里免得重踩。

**坑一：main 产物扩展名。** Electron 的 ESM 主进程按**扩展名**判断模块类型，
`.js` 会走 CJS 互操作路径，报：

```
SyntaxError: The requested module 'electron' does not provide an export named 'BrowserWindow'
```

electron-vite 只在单入口时自动加 `.mjs`，我们是双入口（`index` + `daemon`），
默认 `entryFileNames` 退回 `[name].js`。故在 `electron.vite.config.ts` 里显式指定
`entryFileNames: "[name].mjs"`，`package.json` 的 `main` 与 `utilityProcess.fork()`
的路径同步改为 `.mjs`。

**坑二：IDE 注入** **`ELECTRON_RUN_AS_NODE=1`。** Electron 系的 IDE（Trae CN、VS Code、Cursor…）
本身是 Electron 应用，会给集成终端注入该变量，使 Electron 二进制退化成普通 Node
——没有 `app`、没有 `BrowserWindow`，**报错与坑一完全相同**，极易误判为构建问题。

判据：`npx electron --version` 打印 Node 版本（`v24.20.0`）而非 Electron 版本（`v44.2.0`）。

因此所有真正拉起 Electron 的命令（`dev` / `start`）都经 `scripts/run-electron.mjs`
在子进程环境里剔除 `ELECTRON_RUN_AS_NODE`、`ELECTRON_FORCE_IS_PACKAGED`、
`VSCODE_RUN_IN_ELECTRON`、`NODE_OPTIONS`。`build` 不启动 Electron，无需包装。

### 4.56 daemon ready 用「推送 + 主动查询」双路

daemon 要 `await import` 整个 pi SDK，渲染进程要加载自己的 bundle，
**谁先完成取决于机器**。若 `daemonReady` 推送早于渲染进程注册监听器，
这条推送永久丢失，界面卡在「正在启动」且无法恢复——典型的「本机正常、别人机器白屏」。

解法：main 持有 `DaemonStatus`（只有它知道子进程真实状况），
渲染进程挂载后除订阅推送外**必须再主动查一次** `INVOKE.daemonStatus`。
两路都走 `activate()`，用 `activated` 标志保证快照只拉一次。

### 4.57 权限判定以「路径归属」为主轴，配置目录一律禁写

**pi 没有任何路径约束**。`utils/paths.ts:102` 的 `resolvePath` 对绝对路径直接放行，
工具目录里搜不到越界检查（`getCwdRelativePath` 只用于显示格式化）。
即：**模型给出绝对路径就能写到硬盘任意位置**，包括覆盖 `auth.json` 里的 API Key。
这与 pi README 自述一致 —— "does not include a built-in permission system"。

对办公产品不可接受：试用同事会让它「整理我的文档」，一次路径失误就可能覆盖别的文件。

判定主轴是路径归属而非工具种类（`src/extensions/permission-policy.ts`，60 个测试）。
判定链**有序**（借鉴 WorkBuddy 的 9 阶求值链）：靠后的阶段无法放行靠前阶段已拒的东西。

| 阶段 | 目标                                                                    | 判定                                         | 理由                                                                                             |
| -- | --------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1  | 凭据目录（`.ssh`/`.gnupg`/`.aws`/`.kube`/`.docker`/`.npmrc`/`~/.pi/agent`） | **禁读也禁写，任何权限档位都不能越过**                      | 泄露即账号级损失，不该由一次弹窗决定                                                                             |
| 1  | 配置目录内（`~/.kamibuddy`）                                                 | 同上（`skills/` 子目录对只读工具例外）                   | 存着 API Key；靠弹窗把关的话，提示注入可编造理由骗用户点允许。技能例外见 permission-policy.ts 头注释 2026-09-08 第二条               |
| 2  | 无本地路径的只读工具（web\_search / web\_fetch / present\_files）                 | 放行                                         | 不改变本地状态                                                                                        |
| 2  | 本地只读工具（read/grep/find/ls）：工作目录内                                       | 放行                                         | 工作目录本来就是给模型看的                                                                                  |
| 2  | 本地只读工具：工作目录外                                                          | **低风险询问**（`danger-full-access` 放行）         | 2026-09-09 事故：读侧漫游是写越界的必经入口；且有 web\_fetch 时「读任意文件 + 抓任意 URL」是数据外带路径。codex 不限读的前提是其沙箱默认禁网，我们不具备 |
| 3  | `read-only` 档位下的一切改动与命令                                               | 拒                                          | 这就是该档位的全部含义                                                                                    |
| 3  | shell 工具                                                              | **任何档位都拦**（含"允许完全访问"）                      | 没有危险命令分类器之前保持 fail-closed：一条命令就能绕开上面所有路径保护（`type ~\.ssh\id_rsa`）。见 §4.4a                       |
| 4  | write/edit：应用目录内（`appDir`）                                            | **高风险询问，不支持「记住」**（`danger-full-access` 放行） | 2026-09-09 事故的直接对象：模型试图修改 KamiBuddy 自身源码。先于工作区内放行判定——appDir 也可能就是工作区                           |
| 4  | write/edit：工作目录内（`~/KamiBuddy`）                                       | 放行                                         | 生成文档本就该在这儿，反复打扰会让人放弃使用                                                                         |
| 4  | write/edit：工作目录外                                                      | 询问（`danger-full-access` 放行）                | 用户可能真想改桌面上的某个文件                                                                                |
| 5  | 审批策略 `never`                                                          | 把「询问」转成**拒绝**                              | 无人值守时"不问"必须等于"不做"，不是"随便做"                                                                      |
| 5  | 高风险询问（shell、写应用目录）                                                    | **不支持「本次会话记住」**（UI 不渲染 + gate 忽略，双保险）      | 一次「永远允许」shell 等于把全部路径保护烧穿                                                                      |

**凭据从禁写改为禁读禁写**（2026-09-08）：原先放行读取的理由是
"读到也带不走（没有网络工具）"，**T3 落地** **`web_fetch`** **后该前提消失** ——
提示注入可诱导「读 auth.json → 抓取某 URL 带上内容」。
新增任何外发能力（上传、发邮件、调第三方 API）都要重走一遍这个推理。

权限档位（沙箱模式 × 审批策略）与预设见 `src/shared/permissions.ts`，
词汇直接采用 codex 与 dsh 已收敛的取值；默认档 = 引入模式之前的行为，向后兼容。

工具层之前还有一道闸：**项目信任**（`src/extensions/project-trust.ts`，9 个测试）。
`.pi/extensions` 是 TS 模块，**加载即以本进程权限执行任意代码**，权限门拦不到
（那不是工具调用）—— 打开陌生目录必须先问一句。
\| 未登记的工具 | 询问 | fail-safe：既不静默放行，也不静默阻断新能力 |

「本次会话记住」按**工具 + 目标目录**记，且只在内存里：
批准「写桌面」不该顺带批准「写 C:\Windows」；持久化的批准会在几周后仍生效而用户已忘记。

弹窗走自有 IPC 通道而非 `ctx.ui.confirm` —— 后者只能传纯文本，
承载不了工具入参、风险等级、「记住」选项这三样用户判断所需的信息。

### 4.6 能力是数据，不是代码

模式 / 提示词 / 体裁 / token 全部放 `resources/` 下的文件，代码只负责读取。
判据：**加一个体裁或模式，应该是加一个目录，零行代码改动。**

抄 WorkBuddy 的"双面文件"技巧：一份 `.md` 的 YAML frontmatter 给加载器读工具白名单，
正文给模板引擎读提示片段。一份文件同时定义策略和内容，两者不会漂移。

### 4.7 只在有第二实现的地方开缝

为"将来可能要换"造的抽象层，通常在真要换时并不合用。开缝的五处及其第二实现：

| 缝                                 | 第二实现（已知，非假想）                |
| --------------------------------- | --------------------------- |
| pi SDK 边界（`core/session-host.ts`） | pi 破坏性升级；将来换内核              |
| UI 传输（`ExtensionUIContext`）       | 已验证：TUI / RPC / Electron 三套 |
| 配置解析（`config.get`）                | 本地文件 → 云端下发                 |
| 导出器（`(html, opts) => Buffer`）     | PDF、docx 立刻就有两个             |
| agent shell 策略（`getShellConfig`）  | 无 agent shell → MinGit      |

明确不抽象：LLM provider（`pi-ai` 已是）、插件加载器（pi 有 packages + Skills）、
会话存储（`SessionManager` 已给 JSONL / 内存两种）、多租户、事件 schema 版本号。

### 4.8 专家 = 第四交互模式 + 人格注入（2026-09-11，spec add-expert-mode）

WorkBuddy 实证：expert 不是独立 agent 运行时，是**交互轴第四模式**——选专家 =
切 expert 模式 + 专家正文人格段注入系统提示（主提示 OS + 人格 APP）。
我们同构落地：`resources/experts/*.md`（frontmatter name/description/displayName/
profession，无 tools——工具面由模式统一分配）+ `applyInteraction` 单入口第三参
expertId + compose 的 expert 分支 + `<current-expert>` 钉住段。

关键子决策：
- **钉住段放系统提示词最末**而非 WorkBuddy 的 user-context 每轮注入——v1 没有
  user-context 机制，而系统提示每轮重组，末段离对话最近且文本稳定不炸前缀缓存。
- **expert 不入 /plan 记忆**——切走时 expertId 已清空，记住「expert」回程必炸，
  安全回落上一个三模式。
- **专家正文照搬 WorkBuddy 内置专家**（tencent-docx/experts，用户授权的临时方案），
  头注标注待定制替换；用户级 `~/.kamibuddy/experts/` 同名覆盖。
- 专家团（主理人/Teams/SendMessage）、市场、CRUD 技能明确不做（后续 spec）。

## 5. pi 能力边界（D1 验证结论）

| 项                     | 结论                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ctx.ui` 路由到 Electron | **通过**。`bindExtensions({uiContext, mode:"rpc"})` 注入自己的实现；`modes/rpc/rpc-mode.ts:136` 是现成范本                  |
| 可跨进程的 UI 方法           | `confirm` / `select` / `input` / `notify` / `setStatus` / `setTitle` / `setWidget`（仅字符串数组）。权限弹窗够用           |
| 不可跨进程                 | `custom()` / `setFooter` / `setHeader` / `setWorking*` / `onTerminalInput` / 编辑器系列——需要真 TUI 对象。复杂交互走自己的 IPC |
| `ExtensionMode`       | 仅 `"tui" \| "rpc" \| "json" \| "print"`，无自定义槽位。宿主声明 `"rpc"`（非 TUI 路径里能力最全）                                  |
| Skills                | 原生支持 Agent Skills 标准，可加载 `~/.pi/agent/skills/`、`.pi/skills/`、`.agents/skills/`。WorkBuddy 的渐进式披露架构可近乎原样搬     |
| 会话存储                  | `SessionManager.create()` 走 JSONL 文件、`inMemory()` 走内存。`node:sqlite` 在独立包里，不引入                               |
| 内置工具                  | 仅 8 个：bash / powershell / read / write / edit / find / grep / ls                                            |
| 缺口需自研                 | WebFetch / WebSearch / 权限判定链 / MCP                                                                          |
| 原生模块                  | 三个 `.node`，clipboard 在 import 期即加载（原"全懒加载"假设已证伪）；但全部基于 Node-API，ABI 稳定。基线 3/3 通过，待 Electron 内复核（§4.1）       |
| SDK 导出面               | 实测确认 `createAgentSession` / `SessionManager` / `ModelRuntime` / `AgentSession` 均从包根导出                       |

##

##
