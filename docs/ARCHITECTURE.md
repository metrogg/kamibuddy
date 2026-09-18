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
