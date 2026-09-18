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
（别与 §4.4 的 `node` **托管运行时**混为一谈：那是给模型/脚本用的、按需下载的 node.exe，
Electron 内置的这一个只跑我们自己的代码 —— 为什么不复用它见 `docs/运行时来源与许可.md` 的否决方案 2。）

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

### 4.4 文档流水线按 WorkBuddy 跑 Python venv（2026-09-17 扩成三个托管运行时）

文档生成的 S3「HTML→docx」照 WorkBuddy 的 `tencent-docx` 来：不要求用户机器
预装 Python / Git for Windows，而是自托管一套运行时（决策由用户拍板，替代 2026-09-08
的「不碰 shell / 不假设第三方命令」旧方案）。

**2026-09-17（spec: add-managed-runtimes）**：托管范围从一个隐式 venv 扩成**三个运行时**，
统一落在托管根 `<configDir>/runtimes/<id>/<version>/` + `current` 指针（内核 `src/core/runtimes/`）。
**2026-09-18 口径修订（用户决定）**：三个运行时**全部纯按需联网下载** —— **安装包不含任何
运行时载荷**，用户机器上三个都不用预装，但都要到「设置 → 内置运行时」点「安装」才联网下载；
**任何静默自动下载/自动安装都不允许**（含启动预热与首次使用的隐式安装）。**首次使用需联网**，
离线/内网因此默认不可用（须靠覆盖口配内网镜像，见下）：

| 运行时 | 来源 | 形态 |
| --- | --- | --- |
| `python` | `uv` 运行期装（`python-build-standalone` 的独立 CPython 3.12）+ PyPI wheel | 托管根下的 venv |
| `node` | nodejs.org 官方 `node-v22.23.2-win-x64.zip` | **按需下载**（运行期下载 → sha256 校验 → jszip 解包） |
| `gitbash` | Git for Windows **PortableGit** 2.55.0.5 | **按需下载**（运行期下载 → sha256 校验 → 调发行物自带 SFX 解包；7-Zip 不进产物） |

来源 URL、sha256、许可义务、体积实测（node 94.9 MB / gitbash 389.1 MB，现为用户侧下载后占用）
与**否决方案**（为何不用 MinGit、为何不随包 484 MB 载荷、为何不复用系统已装）见
`docs/运行时来源与许可.md` 与 `resources/runtimes/README.md`。

环境准备抄 WorkBuddy 的 `setup-html-to-docx.sh` 机制：

- 幂等，已就绪秒退；用户点「安装」后联网三步：装 `uv`（`astral.sh`）→
  `uv python install 3.12` 拉独立 Python 发行版（`python-build-standalone`）→
  **在托管根下建 venv** → `--only-binary=:all:` 装 wheel。
  历史路径 `~/.venv-html-to-docx` 若存在则**复用**并如实上报（不静默丢弃）；
  `HTML_TO_DOCX_VENV` 作为显式覆盖口保留。
- 强制 `--only-binary=:all:` 是刻意的：绕开 lxml 在无 libxml2/libxslt 时源码构建失败。
- 私有化 / 无外网：`UV_INDEX_URL` + `UV_PYTHON_INSTALL_MIRROR` 指向内网镜像，
  或由 `KAMIBUDDY_NODE_URL` / `KAMIBUDDY_GITBASH_URL` 指向内网镜像；**不预置镜像/离线产物
  就装不上任何运行时**（安装包不含载荷）——这是明确交付前置条件，不是静默降级。
- **不做会话启动预热、不做首次使用的隐式安装**（2026-09-18 起，原 SessionStart 式预热已删）：
  那类动作发生在用户没点任何按钮的时刻，等于静默自动下载，已被明确否掉。未安装时如实返回
  `not-installed` 并指向设置页（`ensureRuntime` 只探不装）。
- 转换失败降级 Markdown；单个组件/图片失败只跳过或占位，不整篇崩。

这套 venv 是文档流水线的进程内受控调用，**不等于把** **`bash`** **作为 agent 的自由
shell 工具暴露出去** —— 按需安装 `gitbash` 运行时只让它「路径上找得到」，工具面仍只有
`powershell`；**是否开放 `bash` 工具面是另行决策，至今未做**，见 §4.4a。

### 4.4a agent 的 shell 能力：用 powershell；`bash` 工具面开不开是另行决策

决策日期 2026-09-08，四方调研见 `docs/workbuddy分析/09-sandbox-and-permissions.md`。
**2026-09-17 状态修订**：原「不用 bash」的那条约束**作废**（理由见下），但**不等于**已经
把 `bash` 放进工具面 —— 那件事**至今没做**，属另行决策。

- **`bash` 工具面：未开放**（这是当前事实）。工具面由模式白名单决定
  （`resources/modes/*.md` 只含 `powershell`），`permission-policy.ts` 对 `bash` 仍维持
  高风险询问（fail-closed）。**机制事实仍然成立**：pi 在 Windows 找不到 bash 会直接抛异常
  （`utils/shell.ts` 的 `getShellConfig`：自定义 → `%ProgramFiles%\Git\bin\bash.exe` →
  PATH 上的 `bash`），而它一旦被塞进 PATH 就会被解析到 —— 所以注入层**刻意不设 `SHELL`**
  （`src/core/runtimes/injection.ts`），免得替这个决策先做了决定。
- **原约束为什么作废**：它写的是「目标用户不装 Git for Windows ⇒ 找不到 bash」。
  现在 Git Bash **按需安装**作为 `gitbash` 托管运行时提供（`docs/运行时来源与许可.md`），
  **前提已消失**；留着的只是「还没决定要不要开」。
- **用 powershell**：pi 内置该工具，Windows 原生、零额外依赖，绕开了上述问题；
- **前置条件（已满足）**：必须先有危险命令检查器 ——
  `iex` / `Invoke-Expression` / `Add-Type` / `-EncodedCommand` / 递归删除 / 下载执行…
  WorkBuddy 的 PowerShell 工具同样内置这类拦截。
  实现在 `src/extensions/command-guard.ts`（五类：动态执行 / 下载执行 / 凭据读取 /
  递归强删 / 破坏系统），powershell 工具在执行前无条件过它。

**检查器是把 powershell 放进工具面的前置条件，它先落地、工具后启用。**
理由是能力边界的实话：一条命令就能绕开权限门的全部路径保护
（`type ~\.ssh\id_rsa` 读走密钥，权限门看不到这是一次凭据读取）。
**2026-09-15 起加了第三层**：`workspace-write` 档下命令进受限令牌执行，
"写不出工作区"成为操作系统保证的事实（§4.4b）。但**读侧仍然没有任何 OS 约束**，
所以上面那条 `type` 读密钥的路径依旧只有检查器拦得住 —— 三层分工见 §4.4b。

`permission-policy.ts` 当前对 shell 的判定：`bash` 任何档位都维持高风险询问
（没有检查器、无法包沙箱，fail-closed）；`powershell` 在 `danger-full-access` 档
直接放行，其余档位过持久前缀规则后**放行到执行层**（门侧唯一的询问是「配置即代码」
文本闸），`read-only` 档进只读沙箱、沙箱不可用时退回拒 ——
即「这条命令能不能跑」由执行层沙箱决定，门不预判（对齐 dsh，2026-09-16 四期）。

### 4.4b OS 级沙箱：零安装档已落地（2026-09-15）

**"Windows 做不了沙箱"是错的判断**，必须写清楚，否则后人以为此路不通：

| 项目        | Windows 实现                                                           |
| --------- | -------------------------------------------------------------------- |
| codex     | `codex-rs/windows-sandbox-rs`（约 67 文件）：专用沙箱用户账号 + ACL + 独立桌面 + DPAPI |
| dsh       | `packages/sandbox/sandbox-windows-acl`：纯 TypeScript + koffi，MIT      |
| WorkBuddy | 用户态 Rust 栈（`tsbx.dll` + `sandbox-cli.exe`；**非**内核驱动，早期判断已更正）        |
| pi        | 不做，指向容器 / 微 VM（其 sandbox 扩展硬编码只支持 darwin/linux）                      |

三家独立收敛到同一机制（**受限令牌 + ACL**），这就是 Windows 上的正解。

**原搁置理由已被证伪**（原文两条：需管理员建账号、codex 是 Rust 无法复用）：
dsh 那套**只复制调用方自己的令牌**，不建账号、不需 UAC —— 授权目标是调用方
自己拥有的目录，所有者天然持有 `WRITE_DAC`；而它是纯 TypeScript + koffi、MIT，
可以逐文件搬。所以本期做掉，实现在 `src/sandbox/`（第 9 层，不许 import pi 与 electron）。

落地范围：`powershell` 工具在 `workspace-write` 档下进受限令牌执行。
`read-only` 不进（权限门阶段 3 已把 shell 全拒）；`danger-full-access` 不进
（该预设文案写的是"不限制文件范围"，加沙箱就是文案说谎）。
装配在 `daemon/sandbox-runner.ts`（档位映射与降级策略）。

**三层分工**（沙箱**不替代**任何一层）：
权限门管**要不要问人** → 检查器管**这条命令能不能跑** → 沙箱管**跑起来能碰到什么**。

**`SandboxEnforcement` 仍然恒为 `partial`，不因沙箱生效而改成 `full`。**
`WRITE_RESTRICTED` 机制上**只约束写**，读与网络完全不受约束（已实测：受限子进程
仍能读工作区外文件）。所以 `type ~\.ssh\id_rsa` 读走密钥这条路仍然只有
`command-guard` 的 `credential-access` 拦得住 —— 不得因"有沙箱了"而削弱检查器。

已知边界（不写清就又是一个假边界）：

1. **读与网络完全不受约束**（机制使然，见上）。
2. **Everyone 可写的外部目录仍可写**。dsh 缺"人人可写目录扫描告警"，codex 专门做了
   `WindowsWorldWritableWarningNotification` —— 我们也还没做，留 TODO。
3. **NTFS 硬链接是文件对象别名**：工作区 ACE 会渗到工作区外的同一文件对象。
4. **FAT/exFAT 无 ACL**：授权会"成功"但毫无效果，所以探测阶段直接报
   `unsupported-filesystem`，界面不假装生效。
5. **常驻 ACE 残留**：工作区上留下用户无法干净移除的 ACE（`icacls /remove` 报
   `ERROR_NONE_MAPPED`）。工作区是我们自己建的 `~/KamiBuddy`，可接受；
   而且它同时是**性能设计的一部分**（见下）。
6. **管理员用户基本不受约束** —— Windows 安全模型的边界，不是我们的 bug。
7. **`read-only` 会把 PowerShell 降到 ConstrainedLanguage**（该档不进沙箱，暂无影响，
   但将来改档位映射时要记着）。
8. **程序自建的「受保护 DACL」目录在沙箱内不可写**（2026-09-17 实测）。
   Python 3.13+ 的 `os.mkdir(path, 0o700)`（`tempfile.mkdtemp` 用的就是它）建出的
   目录带 `D:P(A;OICI;FA;;;OW)(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)` —— 显式的 `D:P`
   意味着**切断继承**，我们的 capability SID 不在那份 DACL 里，
   `WRITE_RESTRICTED` 的第二次检查就必然不过。同一个私有 temp 下的三组对照：
   PowerShell 建的子目录可写、Python `os.mkdir` 默认 mode 建的可写、
   **只有 `mode=0o700` 建的写不进**（`Errno 13: Permission denied`）。
   后果：**沙箱内 `pip` 必失败**（pip 的 `TempDirectory` 恒用 `mkdtemp`，
   与落点无关，所以「把 temp 换到哪」都救不了），`uv` / node 不受影响
   （它们建目录时不设 DACL）。
   试过把 `S-1-3-4`（OWNER RIGHTS）加进受限 SID 列表 —— **无效**：
   `OW` 是拿**对象所有者**解析的，不做字面 SID 比对；这一步也反证了
   失败发生在第二次（写）检查，不是第一次。

   **三家同题的答案**（2026-09-17 查源码，结论按「能不能照抄」排序）：

   | 实现 | 做法 | 对我们是 |
   | --- | --- | --- |
   | codex | **同一个坑，但它有解**：`elevated` 后端建专用账号 `CodexSandboxOffline/Online`（属 `CodexSandboxUsers` 组），用 `CreateProcessWithLogonW` 以该账号跑 runner，派生受限令牌时**把 token user SID 也放进受限列表**（`windows-sandbox-rs/src/token.rs:450-461`）。受限身份即对象所有者 → `OW` 在第二次检查里命中。代价：一次性管理员建号（`setup.rs:1019-1045` 走 `runas` 提权）。它的 `legacy` 后端（= 我们这条路）**同样失败**，且它主动拒绝需要更强保证的配置（`unified_exec/backends/legacy.rs:346-353`） | 机制唯一正解，但要放弃「零安装、不需要 UAC」 |
   | dsh | **同源同模型（我们的移植源），同坑，且零记录**：`OWNER RIGHTS`/`D:P`/`pip`/`mkdtemp` 权限在全仓库 grep 零命中，已知限制清单（`sandbox-windows-acl/README.md` Known Limitations）里也没有这条。它的 denial 签名会把 pip 的 `Permission denied` 误判成「正常的策略拒绝」，然后推模型去 `danger-full-access` | 不是解，是**盲区**；但它那套「误判成拒绝 + 给出路」恰好是有用的兜底行为 |
   | WorkBuddy | **不撞**：它的写限制是用户态规则栈（`tsbx_rules.json`，非内核驱动、非受限令牌），**根本不覆盖 TEMP/TMP**，而是把 `%LOCALAPPDATA%\Temp\**` 与各语言包管理器缓存（pip/uv/conda/npm…）列成 `inherit_user` 放行；Python 走**托管 venv**（`~/.workbuddy/binaries/python/envs/default`），提示词明禁全局 pip；越界时走「越权确认 → 该命令**单独在沙盒外执行**」（`sandbox.interceptTitle` / `interceptDesc` 文案） | 它的 temp 白名单**照抄不过来**（我们的继承洞在程序自建目录里，换 temp 落点无效）；**能抄的是后两条**：托管 venv 兜住 Python 依赖、越界走批准后单次放行 |

   结论：我们这套「零安装 capability SID」模型对这个洞是**结构性**的 ——
   要么接受并用「托管 venv + 批准后单次提权」把它绕开，
   要么付 codex 那份管理员建号的代价。


性能事实（实测，决定了授权时机）：首次 ACL 授权随文件数**略超线性**增长 ——
100 文件 40ms、1000 文件 477ms、5000 文件 3134ms（约 0.6ms/文件），外推几万文件
即几十秒，codex 说的"几十秒"可信。所以**首次授权在会话建立时预热，不懒加载到
首次命令**，否则用户第一条命令会莫名挂住。幂等命中恒为 1ms 且与树大小无关
（`hasExactGrant` 只读目录自身 DACL），加上 ACE 常驻，只有"该工作区第一次运行"付钱。

**2026-09-15 事故与根因**（判别矩阵 `npm run smoke:sandbox -- --diagnose` 可复跑）：
上线当天发现受限令牌下的 PowerShell 在部分启动上下文里**每条命令**都死在 DLL
初始化（0xC0000142），命令一行未执行。十轮二分定位根因：**令牌默认 DACL 的
ACE 受托者不能是外来 SID**（S-1-4-* 的 capability SID）——三条路径中只有这条
有毒：受限列表含外来 SID 无辜、文件 ACE 用外来受托者无辜、唯独默认 DACL 用
外来受托者必死；身份内受托者（登录 SID / Everyone / 令牌用户 SID）全部安全。
内核级机制未完全查明（同一台机器上随启动链路不同而确定性地不同），但经验规则
完整：**默认 DACL 授权恒用登录 SID**（它在两档受限列表里恒在），文件授权保留
per-workspace capability SID（隔离边界不变）。dsh 官方探针的原班机制在本机
复现同症状——这不是移植引入的偏差，是该机制对启动上下文的隐藏依赖
（dsh 的测试与生产都在有控制台的 CLI 上下文，从未踩到）；codex 不用这套
机制（专用账号 + 私有桌面），结构上免疫。教训有二：终端测试环境 ≠
utilityProcess 生产环境，沙箱行为必须在真实进程形态里冒烟（`smoke:sandbox`
因此而生）；启动自检（探测期用自选命令真跑一次）是第二道保险——它不依赖
已知根因即可把这类故障从"静默废掉所有命令"变成"降级可用 + 日志留根因线索"。

降级纪律：探测/授权失败 → 退回直接 spawn，但在工具结果与设置页**明确说明未生效**
（原因枚举 `SandboxUnavailableReason`，结构化诊断落事件日志 `sandbox_status`）。
这不是 WorkBuddy `node-brokered-fs-shim.cjs:41-42` 那种 fail-open —— 今天本来就没有
沙箱，降级等于"没有改善"，不等于"打开了一个洞"。
**但下一期放松审批时，这条判据必须翻转成 fail-closed**：放松的依据就是沙箱存在。

仍然搁置：**提权那一档**（专用账号 + 禁读 + 禁网）。它只多出读隔离与网络隔离，
写隔离与本期完全等强；代价是 UAC、常驻两个账号与一个组、**EDR/AV 高敏感**
（建账号 + 改 ACL + 改防火墙是教科书级恶意软件特征）、可被企业 GPO 直接封死，
且 codex 连卸载路径都没写。

pi 的 security.md 警告过
*"a partial in-process sandbox would be easy to misunderstand as a security boundary"* ——
**做不到就说清楚，不假装有边界**。诚实上报的落点仍是 `buildPermissionInfo` 一处。

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
| agent shell 策略（`getShellConfig`）  | 无 agent shell → 按需安装 Git Bash（`gitbash` 托管运行时，§4.4） |

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

### 4.9 记忆三层 + 画像本地蒸馏（2026-09-11，spec add-memory-system）

WorkBuddy 记忆实证：三层（云端画像 / 用户级 MEMORY.md / 工作区日志+笔记），
更新靠**提示词纪律**（模型完成实质工作后自己追加日志、30 天蒸馏是模型家务），
不是后台代码。云端部分换本地等价：**画像蒸馏用自家 automation 调度器**
（内置任务「记忆整理」daily 03:00 无人值守跑，builtin 静默不 toast/不可删），
conversation_search 换本地 grep 会话 JSONL。

关键子决策：
- **记忆文件白名单是权限门「应用目录禁写」的唯一开口**：MEMORY.md/PROFILE.md/
  工作区 memory/ 是纯数据（非可执行配置），模型维护记忆是功能本体；
  防自毁针对 preferences/auth/models。白名单只限文件工具，shell 不借道。
- **蒸馏输出走 run 会话直接写 PROFILE.md**（白名单放行），不需要 daemon 特殊通道。
- **画像设置页**：toggle（memoryEnabled 控制内置任务）+ 查看/编辑/重置/导入；
  importProfile 由 main 本地应答（daemon 不 import electron 弹不了对话框，
  业务写仍走 daemon——main「不解释 payload」边界不破）。
- 注入控 token：日志只注近 3 天文件名清单（模型按需 read），其余三层全注，
  全空零 token。
- 身份层（SOUL/BOOTSTRAP）明确不做——与专家人格有交互，单独 spec。

### 4.10 子代理活动走结构化投影，不走文本进度（2026-09-14，spec add-subagent-live-activity）

子代理执行的可视化曾只有「一句话进度 → `tool_progress` 文本 delta → 追加到
工具卡 detail」一条路，两个结构性缺陷：卡片默认折叠进度不可见；并行多代理的
进度行交错混在同一段文本里，无法归因。改为 **task 工具在部分结果 details 携带
`subagents` 全量投影**（每代理：状态/最新动作/轮数/终态输出），session-host 桥接
成 `subagent_progress` 事件，渲染层 TaskAgentCard 按代理分组实时渲染。

关键子决策：
- **整体替换语义，不做增量合并**：并行代理各自推进，增量合并会逼出键控 diff
  （同名 agent 并行时名字不能当键）；全量投影幂等，重放与实时同一条 reducer 路径。
- **隔离设计不破**：子会话事件仍不直接转发主会话事件流（subagent-runner 收集型
  emit 不变）；活动信息只经 task 工具的 details 投影，主消息流不冒子会话工具卡。
- **模型通道与 UI 通道分离**：投影期部分结果 content 文本恒空（模型终态才拿
  formatReport 汇总）；session-host 的 subagents 判定必须先于「空串早退」，
  否则投影被静默吞掉。
- **卡片默认展开规则**：运行中展开（用户正要看）、终态折叠（结论优先），
  用户手动开合优先——与 TodoListCard 同一语义族。

### 4.11 参照物并列择优：WorkBuddy 管「做什么」，机制与纪律在同类实现里择优（2026-09-18）

**本条是把既有做法写进规则，不是新立方向。** `AGENTS.md` 的「选型与实现顺序」原写作
「**先复刻 WorkBuddy**」，并把别家实现放在**第 3 步、门槛是「WorkBuddy 的实现走不通」**
—— 那是**降级位置**，不是并列位置。但代码与决策记录**早就在并列择优**，规则与实践漂移：

| 已发生的择优（以 src/ 与决策记录实况为准） | 落点 |
| --- | --- |
| Windows 沙箱**选 dsh 机制、否决 WorkBuddy 做法**（其 temp 白名单照抄不过来） | §4.4b 的 codex/dsh/WorkBuddy/pi 四家并列表 |
| 权限判定「**对齐 dsh**，2026-09-16 四期」；词汇「直接采用 **codex 与 dsh** 已收敛的取值」 | §4.4a、§4.57 |
| 工程纪律（Model Experience 契约 / `## 否决方案` / 模块不变量登记 / 证据纪律）**整批采纳 dsh** | `.trae/specs/adopt-dsh-disciplines/`、`docs/dsh-对照记录.md` |
| 子代理「逐 agent 独立模型」按**五家共识**判定为「唯独我们没有」，**WorkBuddy 根本不在参照物内** | `docs/多agent参考实现横向对照.md` §2.1 |

于是规则定为**两根正交轴**：WorkBuddy 管「做什么」（产品规格书：功能清单、交互形态、
办公场景边界），codex / dsh / opencode / Trae / pi 管「怎么做更好」（底层机制、工程纪律、
门禁与证据体系）；横向对照**至少三家**，结论要写出处（文件 + 行号）与**为什么不选另外几家**。

**判据是「谁在本项目前提下更优」，不是「谁新抄谁」。** 多数派只用来**发现缺口**
（横评里「五家全有、唯独我们没有」这种句式是缺口探测器），不作裁决依据；
每条都要按本项目的前提（零安装、单机桌面、BYOK、Windows 优先、pi 内核）重判一次。
`docs/dsh-对照记录.md` §1 的差距三分法（机制 / 纪律 / 文档）与 §2.3「明确不抄」表
就是这套判据的执行样例 —— **采纳与不抄是同一件事的两面**。

#### 否决方案

1. **否决：维持「先复刻 WorkBuddy，别家兜底」的旧规则。**
   理由：① **与实践不符**——上表四行择优全部已发生，规则却把 codex / dsh 写成降级选项，
   属文档漂移，会误导后来者（含 AI）按「WorkBuddy 走不通才看别家」行事；
   ② **门槛语义有缺陷**：「WorkBuddy 的实现走不通」只在**复刻失败**时触发，
   而真实场景更多是「WorkBuddy 能走通、但别家明显更好」——旧规则下这种改进**无处安放**，
   只能靠人临时想起来；③ WorkBuddy 的不少判断依赖**腾讯内部能力与云端**
   （§4.4b 四家表、D4–D6、M1–M6 都是），以它为第一优先会把决策浪费在「先撞一次墙」上。
2. **否决：把 WorkBuddy 降为与别家等权，不再当规格书。**
   理由：① 交付目标是**做出一个 WorkBuddy**，功能范围与交互形态需要一个确定真源，
   否则「对齐」失去判据（`docs/workbuddy对齐清单.md` 212 条的账就无从记起）；
   ② 别家的产品形态面向的是编码 Agent 与 CLI，**办公场景的边界只有 WorkBuddy 给了答案**；
   ③ 「对齐清单」这个工件本身就是在 WorkBuddy 上建立的坐标系。
3. **否决：为「横向对照」建脚本门禁**（机械要求 ≥3 家 + 出处路径）。
   理由：① 判据是「谁更优」，那是**判断**不是**格式**，脚本只能查格式齐全、
   查不出「其实没比就写了三家名字」；② 与本文件 §8 既有口径一致 ——
   决策记录自查**先做人工项、脚本化以后再说**；③ 已有 `check:model-experience`
   与 `check:invariants` 两个**真判据**门禁，再加一个纯格式门禁是维护负担。
   （可脚本化的是**相邻**一件事：清单里的条数与 README 引用是否一致，属文档同步，非本条。）

### 4.12 内置任务与用户自动化分离：「记忆整理」的运行会话不进侧栏（2026-09-18）

**触发**：产品经理反馈「三类会话入口（自动化运行、会话创建、历史会话恢复）的目录校验口径
不一致：自动化运行会把 `.kamibuddy`（配置目录）作为工作目录建会话，而历史会话恢复时会被
校验拦下，导致该会话创建得了、却打不开」。**实机核验后确认，真实病因不是校验口径，
而是信息架构：把一个内置后台家务实现成了用户可见的定时任务。**

**症状三面同源**（一处根因，三处显形）：

| 症状 | 机制 | 出处 |
| --- | --- | --- |
| 「记忆整理」出现在「自动化」页（带「内置」徽章、编辑/删除禁用） | 列表 `tasks.map()` 不过滤 `builtin` | `automations-view.tsx` |
| 侧栏**空间区**凭空长出一个叫 `.kamibuddy` 的工作空间组，每晚多一条 | 其 cwd = 配置目录（`builtin-memory-task.ts:76` 的 `cwd: getConfigDir()`），而配置目录**不命中任何任务私有形态**（`isTaskPrivateCwd` 认的是自动目录 / 历史临时目录 / 旧 playground / worktree）→ `isTempTask` 为假 → `listWorkspaceGroups` 把它当用户经营的空间 | `workspace-model.ts:36-49` + `daemon/index.ts:2878` |
| 那条会话永远打不开 | resume 对 `header.cwd` 无条件过 `validateWorkspacePath`，配置目录禁令命中 | `daemon/index.ts:2972` |

**实机证据**（非推断）：本机 92 个会话文件中 **2 个 cwd = 配置目录**，两者都带
`automation_run` 溯源条目、`taskId: builtin-memory-distill`、首条消息为蒸馏提示词，
时间戳分别为 09-17 03:05 与 09-18 03:01 —— 正是 `SCHEDULE = daily 03:00` 的两晚。
侧栏 `.kamibuddy` 组下那两条即此二者。

**横向对照（WorkBuddy）——本条的结论主要来自它**：

| 项 | WorkBuddy 实况 | 出处 |
| --- | --- | --- |
| 有没有这个任务 | **没有**。画像由服务端生成、客户端 10 分钟轮询拉取；「蒸馏」只是一行提示词 | `main/server.js:18170`、`:18424-18431`、`:18299`；`main/tar.js:68984` |
| 记忆入口在哪 | 只在设置（`settings.nav.memory` 面板 + 个性化的「本地长期记忆」） | `renderer/.../ui-docs-viewer-*.js:182323`、`:177557` |
| 靠什么区分内置任务 | **没有这个字段**。可见性只按 owner 过滤；「预置」是**模板**（点了才落库成真任务） | `main/server.js:75110-75114`、`:77959-77986`、`:72624` |
| 自动化运行会话进不进侧栏 | **进**（`isBackgroundAutomation` 不参与侧栏过滤），但它的 cwd **永不为配置目录**：为空时自动建 `<默认工作空间根>/automation-<时间戳>`，侧栏再显示成友好名「自动化任务-{时间段}」 | `renderer/.../ui-docs-viewer-*.js:205329`、`main/server.js:74697-74707`、`renderer/...:113902`、`:114010` |

即：**WorkBuddy 侧栏也会为自动化运行成组，但它永远不会成出 `.kamibuddy` 这种组** ——
丑态来自「拿配置目录当自动化归属」，不来自「自动化运行会成组」。

**本条落地（读取侧过滤，不动运行链路、不改数据）**：

- 判定抽进 `src/daemon/session-visibility.ts`：头部扫描取`automation_run` 条目的 `taskId`，
  与自动化库的 `builtin` 集合求交 → 内部会话（与既有的子代理/成员会话同一机制）。
  **存量会话自动被收拾**，不需要迁移；`builtin` 集合现读，用户停用/删除内置任务后判定随之变。
- `listSessions` 两个入口（磁盘扫描 + 未落盘的桶）共用该谓词；`listWorkspaceGroups`
  派生自它，故空间组一并消失。
- 「自动化」页在**加载处**过滤内置任务（渲染处过滤会让「只剩内置任务」时跳过空态、
  显示一片空白）；库与 IPC 通道保留全量，`automation_list` 工具与启停对账不受影响。
- 设置页补一行运行结果（时间 + 成败 + 失败原因），替代被移走的那条
  「可到「自动化」页查看运行记录」文案 —— 内置任务有意不 toast（`App.tsx` 的
  `event.builtin === true` 静默分支），移走列表后不补这行，失败会彻底无声。

#### 否决方案

1. **否决：只修 cwd 校验口径（把 resume 放宽到「存活判定」），不动 IA。**
   【**状态：本条理由已被 §4.13 部分取代（2026-09-18 同日）** —— 结论「只放宽不动 IA」
   仍成立（IA 分离确实必须做），但其中「resume 的路径归属校验是唯一守门人、不该撤掉」
   这半句经横向对照后**判为错误**：那三项黑名单不是边界而是没写完的清单，真正保护密钥的
   是 permission-policy 阶段 1（按路径、与 cwd 无关）。§4.13 已撤掉黑名单。
   原文保留不改，供后人看清当时的推理错在哪。】
   理由：① 那是**症状**不是病因 —— 会话是能打开了，但它仍挂在 `.kamibuddy` 假空间组里、
   仍占据「自动化」页一行，两条脏症状一条不减；② **放宽 resume 有安全代价**：
   `permission-policy.ts:639` 的 `isInside(workspaceDir, target) → allow`
   意味着 `header.cwd` 是权限门的**写放行边界**。配置目录本身在阶段 1 就被拒（先于阶段 4），
   所以 cwd=配置目录不构成写洞；但若某条会话的 `header.cwd` 是 `C:\Windows\System32`
   这类**未被其他阶段覆盖**的目录，放宽后它就成了「无需询问即可写」的边界。
   resume 的路径归属校验是这条路上唯一的守门人，不该为了让一条会话可打开而撤掉。
   （真正的缺口在**写入侧**：`automation-runner.ts` 建会话时对 `task.cwd` **零校验**，
   见下方「仍待决」。）
2. **否决：给内置任务在「自动化」页保留展示，只把徽章做得更明显。**
   理由：那是「借壳」的合理化而不是分离 —— 用户看到的仍是一个**他不能编辑、不能删除**
   的任务混在自己的任务里，而它的真实开关在设置页；两处都能管、两处都说半句话，
   正是 PM 报的「口径不一致」的同一种病。WorkBuddy 的记忆压根不在任务列表里出现。
3. **否决：为内置任务加一个 `internal: true` 新字段来实现隐藏。**
   理由：已有 `builtin` 字段表达同一件事（且写入侧 `store.remove` 已在用它拒删），
   再加一个近义字段就是两处判据必然漂移的开端。过滤谓词只读既有字段。
4. **否决：把内置任务从「自动化」数据模型里拆出去、另建一套调度。**
   理由：① 现在只有**一个**内置任务，拆表的收益要等第二个出现才兑现（YAGNI）；
   ② 它的启停已经与 `preferences.memoryEnabled` 对账、运行记录已复用 `runs[]`，
   拆出去要重做这两条；③ **WorkBuddy 的方向其实是「不做这个任务」**（服务端画像 +
   提示词蒸馏），那是一条独立的、更大的产品决策，应另立 spec，不该以「拆数据模型」
   的形式顺手混进本条。

#### 仍待决（本条**没有**动，留给下一轮）

【**状态：三项已由 §4.13 一并结清（2026-09-18 同日）** —— 走的是「撤销目录黑名单」
而非本节原先设想的「给内置任务换 cwd / 开具名例外」。原文保留不改，供后人看清当时的取舍。】

三件事是一个决定，不能只做其中一件：

1. `automation-runner.ts:135` 对 `task.cwd` **零校验**（三类会话入口里唯一没有校验的），
   即任何人把一个非法 cwd 写进 `automations.json`，就会造出一条「建得了、打不开」的会话 ——
   PM 报的结构性缺口在这里。
2. 内置记忆任务的 `cwd = getConfigDir()` 是**有意**的（`builtin-memory-task.ts:51-53`），
   且 `permission-policy.ts:397-410` 专门为它开了会话库只读口。若给运行路径补上
   写侧校验，这条意图会被判非法、蒸馏任务当场失败。
3. 由 1+2 反推：要么给内置任务换一个**合法** cwd（其 prompt 里本就带着 `sessionsDir`
   与 `profilePath` 的绝对路径，cwd 对它近乎无关，只作权限门边界），要么在运行路径上
   为内置任务开一个**具名**例外。**前者更干净**（不需要例外，`workbuddy对齐清单` 的
   「自动化任务必须有一个真 cwd」也是同向），但它改的是数据落点，须一并给存量两个会话
   做迁移，故单独一轮做。

### 4.13 撤销工作空间的目录黑名单：只查「绝对路径 + 可用」（2026-09-18）

**决策**：`validateWorkspacePath` 从「绝对路径 + 拒绝配置目录 / 应用目录 / 文件系统根」
改为「**绝对路径 + 存在时必须是可访问的目录**」，**不做任何目录黑名单**。
`WorkspaceGuards` 一并删除；三个入口（选工作空间 `applyWorkspace`、保存定时任务
`saveAutomation`、恢复历史会话 `openSessionFile`）与**新增的第四个**
（自动化运行 `automation-runner`，见下）统一走这一条判定。
`permission-policy` 阶段 1（凭据目录 / 配置目录禁读禁写）**一个字未动**。

**触发**：用户质询「用户想用那个路径就用哪个路径凭什么不行，codex dsh 会这样吗」。
查证结果支持该质询 —— **三家参照物都不限制 cwd**：

| 实现 | cwd 校验 | 目录黑名单 |
| --- | --- | --- |
| dsh | 「validated **absolute** cwd」（`docs/subsystems/persistence.md:98`）；成员资格只查 invalid cwd / 必须解析到**存在的目录**（`workspace.md:56,74`）；cwd 无效的历史会话「stay **Ungrouped**」——不成组，**不拒绝**（`:122`） | **无** |
| codex | 「cwd root must be an **absolute** path」（`protocol/src/permissions.rs:2051`）；app-server 只拒**相对** cwd；`doctor` 把「cwd does not exist」列为**诊断项非阻断**（`cli/src/doctor.rs:1604`） | **无** |
| WorkBuddy | `assertSessionCwdUsable` = `stat` / `isDirectory` / `R_OK\|X_OK`（`main/server.js:117508`） | **无** |

**原黑名单为什么站不住**（这是本条的核心论证，也是 §4.12 否决方案 1 被取代的理由）：

1. **它不是边界，是一张没写完的清单。** 拦 `C:\`、配置目录、应用目录，**却放行
   `C:\Windows\System32`** —— 同样是「模型无提示即可写」的目录，一个拦一个放。
   拦的不是风险，是随手想到的三个例子。
2. **真正保护密钥的那一层不在这里。** `permission-policy.ts` 阶段 1 对配置目录与凭据目录
   **禁读禁写、任何档位都不放行**，且**按路径判定、先于阶段 4 的工作区放行、与 cwd 无关**。
   所以「工作空间指向配置目录」根本不会让 read/write/edit 碰到 `auth.json`。
3. **代价是实打实的**：历史 cwd 被用「能不能被选作工作空间」去审，会把合法会话判成
   永久打不开（`builtin-memory-task.ts:76` 的 `cwd: getConfigDir()` 正是这样打死
   「记忆整理」的每一条运行会话）。

**知情接受的代价**：cwd 同时是沙箱的写边界（`daemon/sandbox-runner.ts` 的
`writableDirs: [workspaceDir]`），所以 cwd = 配置目录时，沙箱会在 OS 层给它写权限，
而 shell 命令触碰哪些路径是权限门看不见的。这与 dsh 的「**A session cwd is its
workspace-write boundary**」（`docs/subsystems/sandbox.md:201-203`）是同一个模型，
不是我们独有的缺陷。**要收紧就收紧沙箱的授权范围**（那是完整规则），
不是给用户的选择加三项禁令。

**顺带结清 PM 报的结构性缺口**：`automation-runner` 建会话前**新增了校验**
（三类入口里原先唯一没有校验的一处）。不校验时，非法 cwd 会被 `mkdirSync` 当成
「相对 daemon cwd 的路径」静默建出来，或建出一条**恢复时打不开**的会话 ——
正是 PM 报的「建得了、却打不开」。现在失败即 run 失败、错误落进运行记录、**一条会话都不产生**。
原先不能加这道校验（会把 cwd=配置目录的内置任务当场打死），撤销黑名单后这个前提消失了。

#### 否决方案

1. **否决：保留三项黑名单，只放宽 resume（历史 cwd 走存活判定、新选择仍走黑名单）。**
   理由：① **两套口径就是 PM 报的那个病本身** —— 同一个路径，「新建时拒、恢复时放」，
   用户永远说不清为什么；② 黑名单挡不住的东西（`System32` 等）在新的选择路径上
   照样敞着，所以它**并没有**为「新选择」换来安全，只换来不一致；③ 代码里要多一条
   「历史值豁免」分支，而它服务的是一个本就不成立的边界。
2. **否决：给内置记忆任务换个 cwd（§4.12 原设想的第 3 项），黑名单其余部分保留。**
   理由：① 换 cwd 只解决**这一个**任务的症状，`C:\Windows\System32` 那种
   「拦一个放一个」的不一致原封不动；② 改的是数据落点，要给存量两条会话做迁移，
   而撤销黑名单**一行数据都不用动**（存量会话自然可打开）；③ 内置任务的 prompt 里
   本就带着 `sessionsDir` 与 `profilePath` 的绝对路径，cwd 对它近乎无关 ——
   为它专门迁移数据是拿成本换一个假边界。
3. **否决：为「工作空间能不能是敏感目录」新增一道**提示确认**（弹窗「该目录含密钥，
   确定吗」）。**
   理由：① 与 §4.57 既有口径冲突 —— 那里明写配置目录的保护「不该由一次弹窗决定」
   （提示注入可编造理由骗用户点允许）；靠弹窗就把这条降级成可被说服的；② 三家参照物
   都没有这道拦截，加了它我们比 WorkBuddy 更烦人却并不更安全；③ 真要拦就在沙箱层拦
   （不把敏感目录写进授权范围），那是机器判定，不依赖用户判断。
4. **否决：连 `isAbsolute` 也不查，完全交给 `mkdirSync` 报错。**
   理由：相对路径会被 `mkdirSync` 按 **daemon 进程的 cwd** 解析并静默建出来 ——
   用户拿到一条 cwd 指向意外位置的会话，且不报错。`isAbsolute` 是三家参照物**共同**
   保留的唯一硬要求，也是唯一一条不含判断、纯事实的校验，保留成本为零。

### 4.14 权限边界必须告诉模型，且不得写死在系统提示词里（2026-09-18）

**触发**（PM 反馈，原话）：

> AI 在权限为只读时并不知道自身的权限边界，导致持续反复试错。如何让模型感知当前权限
> 边界（以及失败时如何给出更明确的解释），是个值得探索的方向。权限和模式的概念有些
> 模糊：模式入口随时可以切换，权限入口只在会话开始后出现在顶部栏，而且模型并不知道
> 当前的权限边界。可考虑的思路包括将提示词、工具、权限整合进同一个能力入口（模仿
> Cursor），或将两者彻底分离并各自明确展示——两种方向各有取舍，待讨论。

**根因不是「模型缺信息」，是系统提示词在主动骗它。** 三层提示词都把权限事实写死了：

| 位置（改动前原文） | 只读档下 | 完全访问档下 |
| --- | --- | --- |
| `resources/modes/craft.md:8`「你可以**直接读写文件**、整理与生成内容。」 | **假** | 真 |
| `resources/scenes/work/prompt.md:11`、`code/prompt.md:23`「你可以在当前工作目录内**读写文件**（运行命令）…」 | **假** | 真 |
| `resources/scenes/work/prompt.md:16`、`code/prompt.md:29`「工作目录之外的操作会被系统拦截**并向用户确认**」 | 假（是**直接拒**） | **假**（`never` 档根本不再问） |
| `resources/agents/worker.md:11`「你可以读写文件、执行命令」 | **假**（子代理继承主会话权限档） | 真 |

叠加**第二层根因**：权限档位从来没进过模型的上下文。`compose(sceneId, interactionId,
expertId, piContext)`（`extensions/prompt-switch.ts:207`）签名里没有权限；
`buildPermissionInfo`（`daemon/index.ts:1317`）只喂设置页与 chip 的 hover 提示。
所以模型的处境是「提示词说你能写 → 每次写都被拒 → 换个工具再试」。

**为什么这个试错只发生在权限轴、不在模式轴**（两条轴的机制根本不同，这是本条的判据）：

| 轴 | 实现 | 模型体验到什么 |
| --- | --- | --- |
| **交互模式** | 白名单经 `session.setActiveToolsByName(...)`（`core/session-host.ts:1080`） | ask/plan 档下 `write`/`edit` **不在工具表里** → 想试也没有那个工具，只能直接说明 |
| **权限档位** | `permission-policy` 阶段 3（`extensions/permission-policy.ts:493-498`） | 工具**都在**，每次调用被拒 → **试错循环** |

所以「反复试错」精确地只出现在「`craft` 模式 + 只读**预设**」这个组合上（PM 说的
「权限为只读」指的是预设，不是问答/计划模式）。

**顺带纠正 PM 的一个前提**：权限入口**不是**「会话开始后才出现在顶部栏」——
`PermissionMenu` 首页就有，位置是 composer 下方 `.context-row`，与工作空间选择器并排
（`renderer/home-view.tsx:441-452`），且权限是**全局**的（`daemon/index.ts:374` 的模块级
`activePermissions`），不是会话级。真正的不对称是：模式（会话级）模型知道，
权限（全局）**模型完全不知道**。

**三家对照**（按 AGENTS.md §选型顺序第 2 条，机制三家都比）：

| | 告诉模型吗 | 投递位置 | 切档时 |
| --- | --- | --- | --- |
| **dsh** | ✅ 报两个**旋钮值**；**预设名刻意不报**（`permission/preset` 是 log-only，`packages/interaction/permission-presets/src/index.ts:47-54`） | **追加在保留历史之后的 runtime-context 快照**（`packages/core/agent-loop/src/runtime-context.ts:64-75`，字节相同则不追加）；文本由 `renderPolicyContext` 生成（`packages/sandbox/sandbox-policy/src/index.ts:41-55`），审批档另有 `NEVER_SENTENCE`/`ASK_SENTENCE`（`packages/interaction/user-approval/src/index.ts:65-67`） | 沙箱档只追加事件；审批档**额外注入**「The approval policy changed from "X" to "Y" (changed by the user).」（`:195-201`） |
| **codex** | ✅ `PermissionsInstructions` = 沙箱档 + 审批策略 + 可写根 + 禁读路径 | `developer` 角色的 `ContextualUserFragment`，标记 `<permissions instructions>`（`codex-rs/prompts/src/permissions_instructions.rs:176-196`）；**不在系统提示词里** | 走 `world_state.render_diff(previous)` —— 状态没变返回 `None`（`codex-rs/core/src/context/world_state/permissions.rs:88-124`），变了才追加 |
| **WorkBuddy** | ❌ **完全不报** | `permissionMode` 是**进程参数**（`docs/WorkBuddy-reference/extracted/main/server.js:128599` 的 `args.push("--permission-mode", ...)`），不进任何提示词串——`promptOptions` 只含 mode/expertId/locale/modelId/cwd/conversationId/welcomeMode，**没有 permissionMode**（`tar.js:69647-69656`，它在 `:69663` 被单独算进 `result`）；桌面端还直接写死 `bypassPermissions` | 无 |

**dsh 已经修过这个一模一样的 bug**，它的记录把现象写成了本条的 PM 原话
（`开源项目/deepseek-harness/.agents/notes/implemented/feature/2026-07-30-current-sandbox-policy-context.md:9`）：

> …**In a Web session under `read-only`, write and edit schemas remained visible, so the
> model claimed it could write and learned otherwise only after a denied call.**

**决策**（用户 2026-09-18 拍板「分离 + 补上告诉模型那一半」）：

- **A. 两根轴保持分离，不合并成 Cursor 式单一能力入口。** 模式管工具可见性、权限管
  强制力，两者是正交的两个状态机（且作用域不同：会话级 vs 全局）。合并会把它们压成
  一个，并连带变形 `resources/modes/*.md` 那套「能力是数据」的白名单（顶 AGENTS.md §3）。
  三家参照物**没有一家合并**：codex 的 `CollaborationModeState` 与 `PermissionsState`
  是两个独立 world_state 段，dsh 的模式与 `permission-presets` 分离，WB 的模式与
  `permissionMode` 也分离。**合并解决不了本问题** —— 本问题是「模型不知道边界」，
  合并方案同样要解决它，合并只是顺带换了 UI。**状态：已定，不实施结构改动。**

- **B. 系统提示词里不许出现权限事实**（场景 / 模式 / 子代理正文只讲**工具可见性**）。
  已落地：`modes/craft.md:8`、`scenes/work/prompt.md:11,16`、`scenes/code/prompt.md:23,29`、
  `agents/worker.md:11` 五处改写为可见性陈述或档位无关的事实，并在各文件 frontmatter
  留了一行规则出处。**状态：已落地。**

- **C. 权限边界进 hidden context 的新段 `permission_context`。** 落点是
  `core/session-host.ts:2002` 的 `composeRunHiddenContext`，与 `python_env` 段完全同构
  （`getRuntimeInventory` 的注释已经把理由写好：`session-host.ts:445-464`「随机器变的
  事实，进提示词就是该处之后的整段提示词与整段历史一起在 provider 前缀缓存里失配」——
  **权限是逐次可变的事实，同一论证**）。取值走新增的 `getPermissions?: () => PermissionSettings`
  注入口（与 `getExpertLabel` / `getRuntimeInventory` 同款 getter 口径）。白送的好处：
  该段每 run 现读、`shouldAppendSnapshot` 按字节去重，所以**用户中途切档，下一轮自动
  追加一条新快照告诉模型新边界** —— 正是 dsh 的「快照在保留历史之后、字节相同不追加」
  同构形态。**状态：方向已定，尚未落地。**

- **D. 拒绝文案每档都要给「接下来怎么办」。** 已落地：`extensions/permission-gate.ts`
  的 `APPROVAL_REFUSAL` 里 `rejected` / `cancelled` 原本只有「用户拒绝了这次操作。」
  这类光秃秃一句，**不符合该 Record 上方注释自己写的规则**（「每档都要给一句『接下来
  怎么办』：只说『被拒了』会诱导模型原样重试」）。现补齐为三段结构
  「**别原样重试** → **要么换个更安全的做法** → **要么停下来交给用户决定**」，
  该结构照 WorkBuddy 的 `PERMISSION_DENIED_GUIDANCE`（`开源项目/WorkBuddy/_analysis/
  extracted/cli/dist/codebuddy.js:2408`）与 codex 的 `on_request.md:32,42` 同款。
  这也补上了 `docs/试用前自查报告.md:76` 的验收项「拒绝后模型收到原因且不重试同一路径」。
  **状态：已落地。**

**知情接受的代价**：B 之后，模型在系统提示词里**不再被承诺任何写入能力** —— 只读档下
它要到「C 落地」或撞到第一次拒绝才知道边界。这是**有意的方向**：宁可不承诺，
也不承诺假的。C 落地前，D 是唯一兜底。

#### 否决方案

1. **否决：把权限档位嵌进系统提示词（模板变量参数化，或每档一份模式正文）。**
   理由：① **dsh 已用实测数据否决过这条路** ——「Put current policy in a dynamic system
   section. Rejected after real provider evidence showed that a first-time permission
   switch **reduced cache reads to 256 tokens while roughly 14.7k input tokens missed**」
   （`…/2026-07-30-current-sandbox-policy-context.md:43`）；② 系统提示词位于整段对话历史
   **之前**，它一个字节变化让**其后的一切（含整段历史）**在 provider 前缀缓存里失配，
   而权限是**用户可以随时切**的旋钮（切档一次就付一次全价）；③ 我们自己的实测同向
   （`docs/可观测性清单.md` CACHE8：字节不变 93.2% / 变更一行 62.0%）。
2. **否决：合并成一个 Cursor 式「能力入口」（PM 给的方向 a）。**
   理由：① 见决策 A —— 两根轴正交且作用域不同，合并会把两个状态机压成一个；
   ② 它会连带改掉 `resources/modes/*.md` 的 frontmatter 白名单契约（顶 AGENTS.md §3
   「加一个模式应该是加一个文件，零行代码改动」）；③ **它不解决本问题**：边界仍要
   以某种方式告诉模型，而投递机制的取舍（否决方案 1）一个字都不变，所以合并是
   一个**额外的 UI 重构**，不是本问题的解；④ 三家参照物没有一家合并，而 PM 引的
   Cursor 恰好也是「模式（Agent/Ask/Manual）」与「权限（allow/deny 规则）」分开的。
3. **否决：照 WorkBuddy 的做法 —— 权限完全不告诉模型，只靠拒绝文案兜。**
   理由：① WB 正是**有本 bug 的那一家**（三家对照表第三行：`permissionMode` 只是进程
   参数，17 个 hidden-context 段里没有任何权限段 —— 已在我们自己树里逐个点名核对：
   `docs/WorkBuddy-reference/extracted/main/tar.js:73388-73406`）；② 它的兜底依赖
   「用户拒绝」这条消息，而只读档的拒绝是**系统拒**、不是用户拒，模型拿到的是
   `SANDBOX PERMISSION DENIED` 之后才知道边界 —— 就是 PM 报的试错循环；
   ③ WB 之所以看起来没事，是因为它在**模式层**给了 read-only 声明
   （`workbuddy-ask-prompt.tpl` 的 `<current_mode>`），而那是**模式轴**、不是权限轴 ——
   我们两根轴都有，所以这个巧合在我们这里不成立。
4. **否决：给模型一个「申请提权」的工具参数（照 codex 的 `sandbox_permissions` +
   `justification` / WB 的 `dangerouslyDisableSandbox` / dsh 的 `ESCALATION_TARGETS`）。**
   这条**不是否决机制本身** —— dsh 的提权阶梯我们已经落了（`shared/permissions.ts` 的
   `WIDER_MODES` / `canEscalate` / `validateEscalationArgs`，只挂在 `powershell` 上）。
   **否决的是在本条里顺手把它扩到 write/edit**：那是「让模型能主动要权限」这个**另一个
   决策**，要单独评估审批疲劳与提示注入面（注入可编造 justification 骗用户点允许，
   而 §4.57 阶段 1 的凭据禁区正是靠「不给这个选项」守住的）。本条的射程是
   「模型**知道**边界」，不是「模型能**改**边界」——两件事分开决策，别混成一件。

### 4.15 输出语言规则：升格为顶层段，排在英文风格段之后（2026-09-18）

**触发**（用户报的现象）：「你排查一下这个对话为什么有时候有一大段的英文输出」。
截图里飘出来的是**过程叙述**——「Now dispatch 3 workers to fix the 6 overflowing pages…」
「Let me write a script that: 1. Creates KWPP.Application COM object…」「Wait, actually
more likely…」——出现在代码/COM API/路径（`KWPP.Application`、`dist-slides`、
`Remove-Item Env:python`）周围，而同一条会话里**思考块（`◇ 深思考虑`）是中文**。

**先排除**：不是思考内容错接成正文。delta 路由是干净的（`text_delta` → 正文、
`thinking_delta` → 思考，`core/session-host.ts:1591-1595`），且截图里思考块本身是中文。
所以飘出来的确实是 assistant 正文。

**根因**（三条证据，全部取自真入口路径）：

1. **默认生效了一份全英文的文体指令。** `resources/styles/style-professional.md`
   整篇英文，其中 `### Language Patterns` 小节给的**范例句子全是英文**
   （`"The root cause is..."`、`"There are three key factors:"`、`"This is a notably
   effective approach."`）。该台机器的 `preferences.json` **没有 `styleId` 键**，而
   `resolveStyle` 对 `undefined` 的处理是**回落默认风格**（`core/resources.ts:372-376`），
   不是不注入。
2. **它排在最后，且体量压过中文侧。** 风格段被 `splice` 到 **mode 段之后**
   （`core/prompt-composer.ts:378`），其后只剩 skills / memory-system / pi-context
   ——**再没有任何「怎么说人话」的指令**。台账 `logs/runs/01a0b3c7-….jsonl` 的
   `request_snapshot` 实测该会话系统提示词 22,809 字符，其中
   **`style:professional` = 2,182 字符（9.6%）**，是 `fragment:narration`（559）的 4 倍。
3. **唯一的语言规则读起来只管「最终回复」。** `- 用中文回复。` 是
   `prompts/fragments/delivery-rules.md` 的 `## 最终回复` 小节**最后一条**
   （`scenes/code/prompt.md` 那份在 `# 交付` 下，前一句正是「最终回复必须自足」）。
   而 `narration.md` 明确要求产出**过程叙述**（「每批工具前后各给一句」）、
   `tool-discipline.md:20` 还专门提到「面向用户的回复与**状态描述**」——
   **这两类输出一个字都没有语言约束**。

**间歇性**因此可解释：短对话由中文用户消息 + 中文场景正文锚住；长 agentic 循环里
紧邻上下文全是英文（工具输出、代码、报错、路径），英文风格指令就赢了。

**旁证（本条的定性依据）**：WorkBuddy 发的是**同一批英文风格文件**（我们是 SHA256
核对后原样搬的，`resources/styles/README.md`），但它配套了两样我们没搬的东西：

- 主提示词模板**最末**的 `<response_language>` 块（`workbuddy-prompt.tpl:363-365`），
  注入 `当前处于中文环境，使用简体中文回答 (Speak in Chinese).`（`tar.js:68316`）；
- 一条硬条款（`workbuddy-craft-design-prompt.tpl:102-104`）：
  「**Working language (mandatory)** … **Internally loaded English reference material
  does not dictate your output language** … code identifiers may stay in English,
  but **the surrounding sentence must be in the working language**」。

它的英文分支甚至把这个现象直接写成了规则（`tar.js:68320`）：「Base your language
decision solely on the natural language of the user's message, **not on technical
content like code, paths, or logs**」。

**决策**：

- **A. 语言规则升格为顶层资源 `resources/prompts/language.md`，由组装器作为独立段
  `language` 注入，位置排在 `style:<id>` 之后**（`ComposePromptInput.languageBody`；
  先例是同样由组装器单独成段的 `prompts/memory-system.md`）。不接受把它留在场景/片段里：
  骨架里的片段位置**都在**「`{{interaction}}` → 风格段」之前，规则会排在它要压制的
  那个英文段**前面**，只能靠位置去赢一个 2,182 字符的英文段，赢不了。
- **B. 删掉两处重复的 `- 用中文回复。`**（`delivery-rules.md`、`scenes/code/prompt.md`）。
  同一件事不能有两个说法，而其中弱的那一个（挂在「最终回复」下）正是 bug 的来源。
  规则唯一出处是 `prompts/language.md`。
- **C. 子代理同注入**（`ComposeSubagentPromptInput.languageBody`，位序：agent 正文 →
  工作目录 → 输出语言 → pi 上下文）。理由：子代理的中间报告与最终结论会**回到主会话
  上下文**，用英文写就是往主会话灌英文材料 —— 正是 A 那条规则要挡的东西。
- **D. 设置页提示词预览同步现读**（`PromptPreviewEnv`。`languageBody`）。预览少了这一段，
  用户就看不到它排没排到「回复风格」之后——**位序正是本条要修的东西**，而预览是用户
  唯一能自查位序的地方（`daemon/prompt-preview.ts` 既有注释：「预览不静默漂移」）。
- **E. 资源缺失即启动抛错**（`loadResources` 校验 `prompts/language.md` 存在且非空，
  不沿用 fragments 的「缺目录即空库」宽容）：少了它产品会静默改用英文说话，
  不能让它以「资源缺失」的形式静默复发。

**已知边界（如实记录）**：本条是**诊断驱动**的修复，**尚未做因果验证**——没有做
「关掉风格前后对比」的 A/B。可证伪的验证路径已留给用户：设置里把回复风格关掉
（`styleId` 置空串 → 不注入风格段）后跑一段同类的长任务，若英文照旧出现，则本条
的根因判断不完整，需回头查该次请求的完整消息序列。

**英文风格文件本体不动**：它们是 WorkBuddy 资产、README 记着 SHA256 一致，改了会破坏
那条来源声明；WB 自己的解法也是「保留英文素材 + 加一条压过它的语言规则」，符合
AGENTS.md §六。

#### 否决方案

1. **否决：把 7 份风格文件翻译成中文。**
   理由：① 破坏 `resources/styles/README.md` 记的来源事实（「原样搬用自 WorkBuddy
   5.5.4、未做内容改动、SHA256 逐一核对一致」），改完那句就成假的；② 资产置换是
   AGENTS.md §六 明确的**上线前专人负责**的另一件事，不该顺手做；③ 翻译改变不了
   结构问题——风格段**仍然排在语言规则该在的位置**，只是换了语言，而 WB 用英文风格
   文件也没出这个 bug，说明问题在缺那条配对规则，不在风格文件的语种。
2. **否决：把语言规则留在场景正文/片段里（只改措辞、不动组装器）。**
   理由：骨架里 `{{> }}` 的位置**全在风格段之前**（风格段是 composer 在 mode 段之后
   splice 进去的，见 `prompt-composer.ts:371-379`），所以规则在位置上**必然输给**
   它要压制的那个英文段；要靠一句中文去赢 2,182 字符的英文风格指令，是拿位置换运气。
   实测的失败形态就是本条 bug 本身。
3. **否决：按当前权限档位/语言之类逐轮可变事实去参数化风格段或语言段。**
   理由同 §4.14 否决方案 1：系统提示词位于整段历史之前，一个字节变化让其后**一切**
   在 provider 前缀缓存里失配。语言规则是**会话内恒定**的，所以进系统提示词是安全的
   ——这一条与「逐轮事实走注入」的纪律不冲突，不要混为一谈。
4. **否决：只在「最终回复」那条上加强措辞（不新增段）。**
   理由：① 这正是现状——`- 用中文回复。` 已经在那里了，而它**已经**没管住过程叙述；
   ② 病根是「范围」而不是「语气」：模型把它读成只管最终回复，是因为它**确实**挂在
   「最终回复」小节下，加强措辞不改变归属；③ 过程叙述的量级还不小（长任务里它是
   用户读到的主要文本），值得一段独立的、明确覆盖「全部自然语言输出」的规则。
5. **否决：给语言规则加一条「检测到英文就重写」的机械门禁（扫模型输出）。**
   理由：① 语言判定是**语义**问题（代码块、路径、专有名词、引用原文都合法地是英文），
   正则误判率不可接受，而误判的代价是**改写用户可见的正确输出**；② 我们的门禁传统是
   钉「组装产物的结构」（段序、字节稳定、资源存在性），不是钉模型的自由文本；
   ③ 真正该机械钉住的位序问题已经钉住了（`core/prompt-composer.test.ts` 的
   「输出语言段必须排在风格段之后」+ `resources.test.ts` 的真实入口回归）。

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
