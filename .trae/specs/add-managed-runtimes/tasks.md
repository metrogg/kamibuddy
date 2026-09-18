# Tasks

## 阶段 0：先把「运行时从哪来」定死（**必须先做，其余都依赖它**）

- [x] Task 0.1: 三个运行时的**来源与许可**核实与定稿（只写决策，不实现）
  - [x] SubTask 0.1.1: `node`：确认从官方发行版拉取（nodejs.org 或其镜像）、校验方式（SHA256）、Windows x64 zip 布局（`node.exe` 在根）
  - [x] SubTask 0.1.2: `gitbash`：**这是最不确定的一项**。核实可选形态与许可：PortableGit / MinGit（Git for Windows 官方发行物，GPLv2 —— **分发与署名义务必须写清**）、或其它可分发方案。给出体积与「是否含 bash.exe + 常用 unix 工具」的结论
  - [x] SubTask 0.1.3: `python`：确认沿用 uv（`uv python install 3.12` 的 standalone 发行版）还是直取 CPython 官方产物；说明与现有 `scripts/fetch-uv.mjs`（`resources/bin/uv.exe`）的关系
  - [x] SubTask 0.1.4: 三者的**许可与署名**结论写进 `resources/<runtime dir>/README`（照 `AGENTS.md §6` 的「已搬用资产注明来源」）
  - [x] SubTask 0.1.5: 结论回写 `docs/dsh-对照记录.md` 相邻的记录位或新建一节「运行时来源与许可」，并含 `## 否决方案`（例如为何不用系统已装 Git、为何不从 Electron 复用 Node）
  - **验证**：三个运行时各有一份「来源 URL + 校验方式 + 许可 + 体积」的书面结论；`gitbash` 若最终无合规可分发方案，**必须回头改 spec**（不许硬上）
  - 核实证据：`resources/runtimes/README.md` §1（node：nodejs.org v22.23.2 + 三处 sha256 + MIT + 34MiB/94.9MB）、§2（gitbash：PortableGit 2.55.0.5 + Release API sha256 + GPLv2 义务 6 条 + 389.1MB/9584 文件 + MinGit 对比表）、§3（python：uv 0.12.15 + python-build-standalone 3.12.14 + PSF/MPL 区分）；`resources/runtimes/gitbash/CORRESPONDING-SOURCE.md`（GPLv2 §3 对应源码 + 3 年书面要约）；`docs/运行时来源与许可.md` 含 `## 否决方案`（§否决方案 1/2 正是「复用系统已装 Git」与「复用 Electron 内置 Node」）。

## 阶段 1：托管运行时内核

- [x] Task 1.1: 托管根与版本化布局
  - [x] SubTask 1.1.1: 在 `config-paths.ts` 增加托管根 `<configDir>/runtimes/`，布局 `<id>/<version>/` + `current` 指针文件
  - [x] SubTask 1.1.2: 定义 manifest（id、version、来源、校验和、安装时间、状态），单一真源、可被诊断读取
  - [x] SubTask 1.1.3: 原子性：安装到临时目录 → 校验 → 改名进位 → **最后**写 `current`（崩溃只会留下可识别的半成品，不会出现「看起来就绪」）
  - [x] SubTask 1.1.4: 多版本并存与回滚（切 `current`，不重新下载）
  - **验证**：单测覆盖「崩溃在写 `current` 之前」；回滚后 `current` 指向与磁盘事实一致
  - 核实证据：`src/core/config-paths.ts:170` getRuntimesDir；`src/core/runtime-store.ts`（布局/manifest/原子写 current）；`runtime-store.test.ts` 三个崩溃点用例（:146/:156/:169）+ `python.test.ts:242/:262/:275` + 回滚 `:306`/拒绝切指针 `:199`。
- [x] Task 1.2: 统一状态机与诊断
  - [x] SubTask 1.2.1: 把 `docx-env.ts` 的九相位与 `inspectVenv` 四态抽象成**按运行时可复用**的状态机与探测（保留既有语义，不改行为）
  - [x] SubTask 1.2.2: 诊断产出可复制报告（版本、路径、缺失项、最近一次失败原因、可执行的下一步）+ 落盘日志
  - [x] SubTask 1.2.3: 「重置并重新安装」= 下载 → 校验 → 安装 → 重载工具，幂等、可续跑
  - **验证**：人为破坏（删依赖 / 改坏 `current` / 半成品目录）→ 诊断能指名；重置能修好；中断后重跑能续
  - 核实证据：`src/core/runtimes/machine.ts` + `machine.test.ts`（收敛/归因/不收敛）；`diagnostics.ts:221-230` 报告含版本/实例/半成品/日志/下一步；`python.test.ts:457` 诊断组（缺依赖指名、最近失败来自日志）、`:408` 重置组、`:275` 零成本续跑。
- [x] Task 1.3: Python 运行时迁入（**BREAKING**）
  - [x] SubTask 1.3.1: docx 引擎的 Python 改为托管根下的一个运行时实例；`HTML_TO_DOCX_VENV` 保留为覆盖口
  - [x] SubTask 1.3.2: 启动时探测既有 `~/.venv-html-to-docx`：存在则复用或显式迁移，**不静默丢弃**；结论在诊断里如实呈现
  - [x] SubTask 1.3.3: 迁移期两条路径并存时的**唯一真源**要明确（谁优先、如何判定），并用测试钉住
  - **验证**：① 全新机器：能建起、能转换；② 有旧 venv 的机器：复用/迁移后能转换，且诊断说明了走了哪条
  - 核实证据：`python.ts` resolve 优先级（override > managed current > legacy > pending）；`python.test.ts:333`「落点优先级（唯一真源）」四条、`:366` 覆盖口压过托管根、`:390` 垃圾 current 被忽略、`:428` 显式迁入且旧目录保留。②实测：`npm run smoke:docx` 3/3 通过，解释器 `C:\Users\www19\.venv-html-to-docx\Scripts\python.exe`（legacy 复用生效）。

## 阶段 2：接入 node 与 gitbash

- [x] Task 2.1: `node` 与 `gitbash` 的拉取/安装/校验/探测接入同一内核
  - [x] SubTask 2.1.1: 拉取脚本（照 `scripts/fetch-*.mjs` 既有模式），校验 SHA256，落托管根
  - [x] SubTask 2.1.2: 各自的探测判据（版本、可执行性、关键文件存在）
  - [x] SubTask 2.1.3: 注入与**不注入**：启用时注入运行时路径与托管目录环境变量；禁用时明确不注入
  - **验证**：三个运行时都能装、能探测、能诊断、能重置；任一个损坏不影响另两个
  - 核实证据：`RUNTIME_REGISTRY` 三项齐（`registry.ts:115-119`）；`scripts/fetch-node.mjs` / `fetch-gitbash.mjs`；`node.test.ts`（安装/幂等/就位即修复/复验不过不发布/崩溃续跑/重置/诊断/互不影响 :300）、`gitbash.test.ts`（同形 + 探针自带注入 + 许可文本必备）。
  - **2.1.3 已接线（2026-09-17 修复轮）**：独立验证发现 `planRuntimeInjection`（`src/core/runtimes/injection.ts:160`）判据完整、`injection.test.ts` 全过，却**全仓无生产调用点**（只被测试 import）—— 即「启用时把运行时路径与托管目录环境变量注入模型 shell 环境」从未真的发生。接法与理由（三层）：
    ① **判据组装**：`src/core/runtime-inventory.ts` 新增 `planRuntimeShellInjection`。接在这里是因为注入层要的两样输入（开关是否生效 / 各运行时落点）正是本模块已有的两处唯一读点（`readRuntimeSwitch()` + 描述符 `resolve()`）—— 换别处装就得把判据再写一遍，「界面说禁用、注入层还在注入」就会成为可能。
    ② **装配点**：主会话 `src/daemon/index.ts` 的 `runtimeShellEnv` 与子代理 `src/daemon/subagent-runner.ts` 各把它交给 `createSandboxedRunner` 的 `runtimeEnv`（**getter 而非快照** ⇒ 设置页改开关后下一条命令即生效，无需重启）。
    ③ **应用点**：`src/daemon/sandbox-runner.ts` 在 spawn 那一刻现算补丁并喂给**两条**路径 —— 进沙箱的走 `SandboxRunRequest.env`（`src/sandbox/index.ts` 新增可选字段，`runSandboxed` 把它合进环境块、私有 TEMP 压过补丁），降级直连（danger-full-access）走 `runCommand` 的第 6 参（`src/extensions/powershell-tool.ts` 新增 `shellChildEnv`：**合并**进 `process.env` 而非整体替换）。边界照 spec：只在子进程环境、不回写 daemon `process.env`、不设 `SHELL`、工具面白名单不动。
  - 证据：`runtime-inventory.test.ts`「运行时注入的生产判据」4 条（启用且就绪 ⇒ PATH 前缀 + `KAMIBUDDY_NODE_HOME` + `KAMIBUDDY_RUNTIMES_DIR`；逐项禁用 ⇒ `env` 为 `{}`；总开关关 ⇒ 三个都 disabled 且 `env` 为 `{}`；都不就绪 ⇒ 不写托管根变量）；`sandbox-runner.test.ts` 新增 5 条（三条 spawn 路径都带补丁、无 provider 时连 `env` 键都不出现、getter 现算）；`powershell-tool.test.ts` 2 条（合并而非替换、不回写 `process.env`）。改坏实证：`sandbox-runner.ts` 的 `options.runtimeEnv?.()` → `undefined` ⇒ 4 条红；`planRuntimeShellInjection` 的 `master` 写死 `true` ⇒ 1 条红；两处已还原。文档同步：`AGENTS.md §2`（补接线点，结论未改）、`resources/runtimes/README.md §4` 新增「接线点」小节。

## 阶段 3：设置页「内置运行时」

- [x] Task 3.1: 新一级分区（含总开关与三个子开关）
  - [x] SubTask 3.1.1: 总开关 → 子项置灰（交互照 WorkBuddy）
  - [x] SubTask 3.1.2: 每项显示状态/版本 + 「诊断」「重置并重新安装」入口
  - [x] SubTask 3.1.3: 禁用时写显式「已禁用」标记（供模型侧与注入层读同一处状态，不各判一遍）
  - [x] SubTask 3.1.4: 视觉一律走 design token（先读 `DESIGN.md`，不引入新硬编码值；`check:tokens` 必须过）
  - **验证**：开关切换后立即生效（无需重启）；总开关关闭时子项确实置灰；`check:tokens` 通过
  - 核实证据：`src/renderer/settings/runtimes-section.tsx`（总开关 `rowOff` 同时禁用子开关与按钮 :160/:199/:208/:223；状态/版本/诊断/重置齐全）；`settings-view.tsx:32/166` 一级分区接线；`src/core/preferences.ts:119` `runtimes?: RuntimePrefs` 显式布尔落盘；`runtime-inventory.test.ts:69/:85/:109`；daemon 写开关后**重采集**返回（`index.ts:3858-3888`）⇒ 无需重启；`check:tokens` 通过。

## 阶段 4：审计中心

- [x] Task 4.1: 记录来源统一与结构化
  - [x] SubTask 4.1.1: 三类记录（命令安全 / 沙箱 / 运行时）落到同一处结构（时间、类别、结论、详情），**不各写各的格式**
  - [x] SubTask 4.1.2: 清空动作本身也记录
  - **验证**：制造一条被拦命令、一次沙箱拒绝、一次运行时失败，审计里三类都能查到
  - 核实证据：`src/shared/audit.ts`（唯一结构 + 唯一渲染）、`src/core/audit-log.ts`（唯一写/读/导出出口）；三处写入点齐全：命令 `src/extensions/powershell-tool.ts:414`、沙箱 `src/daemon/sandbox-runner.ts:474/:512/:524`、运行时 `src/daemon/index.ts:3868/:3881/:3904`（开关禁用 + 重置失败）；**实测**（临时脚本走生产装配 + `KAMIBUDDY_CONFIG_DIR` 临时目录）：三类记录实际产出 `["command/blocked","sandbox/blocked","runtime/failed"]`，读回 total=3。
- [x] Task 4.2: 面板（列表 + 导出 + 清空二次确认）
  - **验证**：导出内容与面板一致；清空需二次确认；清空后新增记录仍正常
  - 核实证据：`src/renderer/settings/audit-section.tsx`（清空只进 `confirming` 态 :138/:144-157）；导出与面板共用 `readAuditRecords` + `auditLine`；**实测**导出件逐行包含面板每一行（count=3、all-in=true），清空后只剩 `audit/cleared` 一条留痕且新增照常（total 1→2）。

## 阶段 5：模型侧可见性

- [x] Task 5.1: 运行时清单注入（`python_env` 段扩成「运行时清单 + 状态」）
  - [x] SubTask 5.1.1: 逐运行时给「id / 版本 / 状态 / 用途 / 被禁用时明确说被禁用」
  - [x] SubTask 5.1.2: 更新 `resources/prompts/fragments/python-env.md`：从「只讲托管 Python」扩到三运行时，并保留「不要 pip install、缺能力就问用户」的纪律
  - [x] SubTask 5.1.3: 未就绪/失败的文案要**响亮且可执行**（等待 / 告知用户 / 走哪个运行时），不许静默降级
  - **验证**：`check-model-experience` 通过（该片段/模块的三段契约要写）；注入内容有条目级断言；「被禁用」与「找不到」在模型看到的信息里可区分
  - 核实证据：`src/core/session-host.ts:2033-2038` 注入 `python_env`；`src/shared/runtimes.ts:86-111` 状态标签与四类动作指引；`session-host.test.ts:2160` 条目级断言，**两句原文不同**：`node 22 · 已被用户禁用` + `已被用户禁用：不要调用它…` vs `gitbash 2.47 · 未就绪（尚未准备）` + `该运行时尚未准备好：首次使用会自动准备…`；禁用项断言不含路径。`check:model-experience` 19/19 通过（运行时模块不在该脚本扫描范围内：它的范围是 extensions/ 下注册工具的模块 + 4 个具名模块）。

## 阶段 6：文档订正

- [x] Task 6.1: 改写 `AGENTS.md §2`（bash 约束作废、三运行时随包托管）与 `docs/ARCHITECTURE.md`、`docs/sandbox.md` 的相关表述
  - **验证**：文档所述与代码事实一致；「是否开放 bash 工具面」明确标注为另行决策
  - 核实证据：`AGENTS.md §2`（「`bash` 仍然不用」标为作废、三运行时托管根布局、`resources/runtimes/README.md` 与 `docs/运行时来源与许可.md` 指引、「是否把 `bash` 开放成模型的自由 shell 工具」明确写为另行决策且未做）；`docs/ARCHITECTURE.md:142/149/194/434`、`docs/sandbox.md:69-71/260` 同步。**注意**：`AGENTS.md §2` 中「随包提供运行时只让它在**路径上找得到**（注入层）」这句与代码事实不符（见 Task 7.1），已单独记入修复任务，不改文档（本轮不授权改 `AGENTS.md`）。

## Task Dependencies

- **阶段 0 阻断全部**：`gitbash` 若无合规可分发方案，必须先改 spec
- 阶段 1 阻断阶段 2/3/5（内核是它们的地基）
- 阶段 4 与 1/2/3 独立，可并行
- 阶段 6 在最后（要等事实定型）
- 与既有在途工作流（`src/renderer/widget-view.tsx`、`resources/visualizer/*`、`scripts/design-tokens-allowlist.json`）文件不得冲突；不回滚任何人的改动

## 本批不做（记录以免反复提）

私有化/无外网镜像（`UV_INDEX_URL` / `UV_PYTHON_INSTALL_MIRROR` 由谁设）；**是否把 `bash` 开放成模型自由 shell 工具**（权限面变更，单独一轮）；运行时的自动更新策略（只做手动重置/重装）。

## 验证轮追加的修复任务（2026-09-17 独立验证）

### Task 7.1: 把注入层接进生产（补 SubTask 2.1.3）

- **要改什么**：`src/core/runtimes/injection.ts` 的 `planRuntimeInjection` 目前只有测试调用。需要在一个真实落点上调用它，把算出的 env 补丁合并进**模型驱动的 shell 子进程环境**（`src/daemon/index.ts` 装配 powershell 执行器的那一处，或 `powershell-tool.ts` 的 runner 装配点），输入取自 `readRuntimeSwitch()` + 各描述符 `resolve()`。
- **边界（不许越界）**：只作用于子进程环境，**不回写 daemon 的 `process.env`**；**不设 `SHELL`**；不改工具面（`resources/modes/*.md` 白名单仍只含 `powershell`）。理由见 `injection.ts` 文件头。
- **怎么验证**：① 新增断言——启用+就绪时子进程 env 含注入的 PATH 前缀与 `KAMIBUDDY_RUNTIMES_DIR`/`KAMIBUDDY_NODE_HOME`/`KAMIBUDDY_GITBASH_HOME`；逐项禁用时不含；总开关关时三个都不含。②「改坏 → 看红 → 还原」实证一次。③ 同步订正 `AGENTS.md §2` 里「只让它在路径上找得到（注入层）」这句（或按事实改写），使文档与代码一致。
- **状态：已完成（2026-09-17）**。接缝与理由见 SubTask 2.1.3 的三层说明（判据组装 `runtime-inventory.ts` 的 `planRuntimeShellInjection` → 装配 `createSandboxedRunner` 的 `runtimeEnv`（主会话/子代理各一处）→ 应用 `SandboxRunRequest.env` 与 `runCommand` 第 6 参）。①三态断言落在 `runtime-inventory.test.ts`「运行时注入的生产判据」4 条 + `sandbox-runner.test.ts` 5 条执行路径断言；②改坏实证：`runtimeEnv?.()` → `undefined` 红 4 条、`master` 写死 `true` 红 1 条，均已还原；③文档订正：`AGENTS.md §2` 那句补上接线点（**只改事实与路径，结论一字未动**，照 `AGENTS.md §8` 的冻结规矩）、`resources/runtimes/README.md §4` 新增「接线点」；`npm run check` 退出码 0、`npm test` `2542 passed | 1 skipped`。

### Task 7.2: 补「全新机器」真实转换的验证证据

- **要改什么**：不需要改代码。在干净情形（临时 `homeDir` + 无 `~/.venv-html-to-docx` + 临时 `KAMIBUDDY_CONFIG_DIR`）跑一次真转换，确认 `pending → 安装进托管根 → 转换成功`。
- **状态：本机已真跑成功（2026-09-17），原「本机不可验证」的两个前提被实测推翻**：本机 `uv` **在 PATH**（`C:\Users\www19\.local\bin\uv.exe`，0.11.16），`github.com` HTTP **200**、`pypi.org/simple/` **200**、`files.pythonhosted.org` 可达 —— 所以既不需要 `npm run fetch:uv`（`resources/bin/uv.exe` 确实不在，但状态机的 uv 候选第一个就是 PATH 上的 `uv`），也不受「无外网」限制。
- **怎么验证（实跑）**：临时 `KAMIBUDDY_CONFIG_DIR` + 临时 `USERPROFILE`（`os.homedir()` 随之指向临时家目录 ⇒ 无 `~/.venv-html-to-docx`）跑 `npm run smoke:docx`（生产入口 `ensurePythonRuntime` + `convertHtmlToDocx` + 真 spawn）：
  - 输出 `3/3 通过`；解释器 = `<临时配置目录>\runtimes\python\3.12\venv\Scripts\python.exe`（**断言点命中：落在托管根下**）；产物 38,291 B；python-docx 读回 `FIRST=产研团队每周工作周报`；
  - 托管根另有 `current`（内容 `3.12`）、`manifest.json`（`status: installed`，`installedAt` 为本次）、`events-2026-09-17.jsonl`（`{"kind":"runtime_install","outcome":"installed","version":"3.12"}`）；
  - 第二次另加 `UV_NO_CACHE=1` 与独立 `UV_PYTHON_INSTALL_DIR` 再跑一遍，同样 `3/3 通过`（wheel 侧在无缓存下装进全新 venv 成功）。
- **仍未证到的子环节（如实记，不拿「有测试覆盖」顶替）**：CPython 不是本次联网下载的 —— `uv python find 3.12` 命中本机既有的 uv 托管目录 `%APPDATA%\uv\python\cpython-3.12-windows-x86_64-none`（3.12.13；venv 的 `pyvenv.cfg` `home` 指向它），所以状态机的 `install-python`（拉 python-build-standalone）这一支没走到。要证它需要一台无该目录的机器（或清掉本机 `%APPDATA%\uv\python`，那会连带废掉既有 `~/.venv-html-to-docx` 的解释器，未做）。
- 清理：临时配置/家目录已删（`$env:TEMP` 下 `kami-t72*` 计数 0），终端里注入的 `KAMIBUDDY_CONFIG_DIR`/`USERPROFILE`/`UV_*` 已清除，本机真实 `~/.kamibuddy/runtimes` 仍不存在（未被污染）。
