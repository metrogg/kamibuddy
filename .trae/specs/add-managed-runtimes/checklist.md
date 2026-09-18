# Checklist

> 2026-09-17 独立验证。每条下方一行是**核实证据**（文件:行 / 实跑命令输出 / 测试断言）。
> `- [x]` = PASS（已核实）；`- [ ]` 且标注 FAIL/存疑 = 未勾（原因见条目）。
> 同日**修复轮复验**（Task 7.1 注入接线 / Task 7.2 全新机器真转换）：两条原「存疑」已转为 PASS，证据就地补在条目下（带「2026-09-17 复验/修复轮」字样）。
> **2026-09-18：口径改为「纯按需下载」（阶段 7）**。凡涉及「**随包**」「实测可用**载荷**」「首次使用**自动准备**」的旧 checkpoint **一律保留历史勾选不删**，就地加一句「已由阶段 7 取代」；新增的复核清单见文末「## 阶段 7：改为纯按需下载（2026-09-18）」。**旧条的核实证据是当时的事实快照，不是当前验收依据**。

## 阶段 0：来源与许可（阻断项）

- [x] `node` / `python` / `gitbash` 三个运行时各有书面结论：来源 URL、校验方式、许可、体积
  - `resources/runtimes/README.md` §1（nodejs.org v22.23.2；三处 sha256；MIT；zip 35,683,585 B / 解包 94.9 MB）、§2（PortableGit 2.55.0.5；Release API sha256 `5aa8a20f…`；GPLv2；389.1 MB / 9584 文件）、§3（uv 0.12.15 + python-build-standalone 3.12.14；sha256 在 uv 元数据里；PSF 许可，与 `python-build-standalone` 仓库的 MPL-2.0 分开说明）
- [x] `gitbash` 的分发方案合规（含 GPLv2 的署名/分发义务）且**实测可用**；若无合规方案，已回头改 spec 而不是硬上
  - **已由阶段 7 取代「随包分发」这一形态**：三个运行时改为运行期按需下载，`resources/runtimes/payload/**` 的随包载荷与构建期 7z 解包撤下。**许可/来源/sha256 的结论仍有效**（运行期下载照样要核校验和、照样要把许可文本随载荷落到托管根）。
  - `resources/runtimes/README.md` §2「判定：能合规」+ 义务 6 条（许可文本不得删、对应源码、不额外限制、聚合不传染、商标中性显示名）；载体收敛为 PortableGit（MinGit 无 `bash.exe`，README 有实测对比表）；`resources/runtimes/gitbash/CORRESPONDING-SOURCE.md` 落实 GPLv2 §3 + 3 年书面要约。实测可用性由 README §2 记录的 `bash.exe -c "git --version"` → `2.55.0.windows.5` 与 `gitbash.ts` 的必备文件断言（`usr/bin/bash.exe` + 根 `LICENSE.txt`）+ `gitbash.test.ts:225` 钉住（本轮未重跑 `fetch:gitbash`，见报告「没能确认」）
- [x] 来源与许可结论已按 `AGENTS.md §6` 注明在对应目录 README
  - `resources/runtimes/README.md` 抬头即声明「照 AGENTS.md §6」，三个运行时逐条注明来源与许可；`resources/runtimes/gitbash/CORRESPONDING-SOURCE.md` 随载荷分发
- [x] 决策记录含 `## 否决方案`（至少否掉「复用系统已装 Git」与「复用 Electron 内置 Node」两条并写明理由）
  - `docs/运行时来源与许可.md` 有 `## 否决方案`：第 1 条「复用用户机器上已装的 Git / Python / Node」，第 2 条「复用 Electron 内置的 Node」，各带理由

## 托管内核

- [x] 托管根布局为 `<id>/<version>/` + `current` 指针，可并存多版本
  - `src/core/config-paths.ts:170`（`<configDir>/runtimes`）+ `runtime-store.ts:72-94`；`runtime-store.test.ts:95`「列表把已进位与半成品分开」、`:184` 两版并存
- [x] 安装是「临时目录 → 校验 → 改名进位 → **最后**写 `current`」，且**有测试证明**崩溃不会留下「看起来就绪」的状态
  - `runtime-store.test.ts:146/:156/:169` 三个崩溃点各断言「未就绪」；`python.test.ts:242/:262/:275` 与 `node.test.ts:222` 在真临时目录上跑完整链路；`registry.ts:222` 的 `writeCurrent` 是最后一步。**改坏→看红实证**：把 `registry.ts:212` 的复验判定改成恒假，`node.test.ts`/`python.test.ts` 立刻 2 条红（`expected 'ready' to be 'failed'`），还原后 81 条全绿
- [x] 回滚只切 `current`、不重新下载；回滚后状态与磁盘事实一致
  - `registry.ts:277` `rollbackRuntime` 只调 `publishCurrent`；`python.test.ts:306` 断言两版切指针往返且实例内容一个字节不动；`runtime-store.test.ts:199` 拒绝把指针切到不完整/不存在的版本
- [x] 一个运行时损坏不影响另外两个
  - `node.test.ts:300`「gitbash 载荷缺席时 node 照样装好（各写各的 manifest 与 current）」；各运行时目录独立（`runtimeHome(root, id)`）
- [x] 诊断报告含版本/路径/缺失项/最近失败原因/可执行下一步，可复制且落盘
  - `src/core/runtimes/diagnostics.ts:221-230`（实例/半成品/日志/下一步逐行 push）；`python.test.ts:457` 断言「缺依赖指名到具体模块」「最近失败来自落盘日志」「给出可执行下一步」；UI 侧可复制（`runtimes-section.tsx:30-43` ReportCopyButton）
- [x] 「重置并重新安装」能仅凭该操作修好环境（无需用户手删目录），且中断后可续跑
  - `registry.ts:264` `resetRuntime`（清残留 → 原子安装）；`python.test.ts:409`「环境损坏时仅凭重置修好」、`node.test.ts:262` 同形、`python.test.ts:275`「写入 current 之前崩 → 下次 ensure 零成本续跑」；UI 重置带二次确认与进度文案（`runtimes-section.tsx:106-120/:171-190`）

## Python 迁入（BREAKING）

- [x] docx 引擎的 Python 来自托管根下的运行时实例
  - `python.ts` resolve 优先级 managed(current) > legacy > pending；`python.test.ts:169` 断言装到 `<root>/python/<version>/` 并写 current/manifest；daemon 与工具层统一走 `defaultPythonRuntimeOptions()`（`python.ts:79`）
- [x] `HTML_TO_DOCX_VENV` 覆盖口仍生效（有测试）
  - `python.test.ts:366`「覆盖口压过托管根」+ `:378`「覆盖口生效时托管根完全不参与」
- [x] 既有 `~/.venv-html-to-docx` 被复用或显式迁移，**未被静默丢弃**；诊断如实说明走了哪条路径
  - `python.test.ts:334`「只有旧路径 → 复用 legacy（不迁入、不删、不写 current）」、`:428`「显式迁入：旧目录保留」；`registry.ts:256-262` 注释与实现一致。**实跑**：`npm run smoke:docx` → 3/3 通过，解释器 `C:\Users\www19\.venv-html-to-docx\Scripts\python.exe`（本机 `~/.kamibuddy/runtimes` 不存在 ⇒ 确实走 legacy 复用）
- [x] 两条路径并存时的唯一真源明确且有测试钉住
  - `python.test.ts:353`「旧路径与托管实例并存 → 以托管根 current 为准」+ `:390`「current 指向不存在的版本 → 指针被忽略」
- [x] 全新机器与「有旧 venv 的机器」两种情形都能完成一次真实转换（真入口路径，不走测试旁路）
  - 「有旧 venv」实跑（见上条，`smoke:docx` 经生产入口 `ensurePythonRuntime` + `convertHtmlToDocx` + 真 spawn，产物 38,291 B + python-docx 读回 13 段）。
  - **「全新机器」2026-09-17 复验已复现（原「存疑」是被错误的两个前提挡住：本机 `uv` 其实在 PATH、`github.com` 其实可达）**：临时 `KAMIBUDDY_CONFIG_DIR` + 临时 `USERPROFILE`（`os.homedir()` 随之指向临时家目录 ⇒ 无 `~/.venv-html-to-docx`）跑 `npm run smoke:docx` → `3/3 通过`，解释器落在 `<临时配置目录>\runtimes\python\3.12\venv\Scripts\python.exe`，产物 38,291 B，python-docx 读回 `FIRST=产研团队每周工作周报`；托管根同时有 `current`（`3.12`）+ manifest（`status: installed`）+ `events-2026-09-17.jsonl`（`runtime_install/installed`）。第二次另加 `UV_NO_CACHE=1` 与独立 `UV_PYTHON_INSTALL_DIR` 亦 `3/3 通过`。临时目录与注入的环境变量已清理，本机真实 `~/.kamibuddy/runtimes` 仍不存在。
  - **未证到的子环节（如实记，不用「有测试覆盖」顶替）**：CPython 不是本次联网下载的 —— `uv python find 3.12` 命中本机既有的 `%APPDATA%\uv\python\cpython-3.12-windows-x86_64-none`（3.12.13，venv 的 `pyvenv.cfg` `home` 指向它），状态机的 `install-python`（拉 python-build-standalone）这一支**没走到**；要证它需要一台无该目录的机器（清本机 `%APPDATA%\uv\python` 会连带废掉既有 `~/.venv-html-to-docx` 的解释器，未做）。

## 设置页

- [x] 新增「内置运行时」一级分区，含总开关 + 三个子开关
  - `src/renderer/settings/settings-view.tsx:32/166`；`runtimes-section.tsx` 总开关（:131）+ 逐项开关（:220）
- [x] 总开关关闭时三个子项置灰且都无法单独开启
  - `runtimes-section.tsx:160` `rowOff = !inventory.master`，子开关 `disabled={disabled || rowOff}`（:223）且 `checked={inventory.master && item.enabled}`；诊断/重置按钮同样 `disabled || rowOff`（:199/:208）；`runtime-inventory.test.ts:85`「总开关关闭 ⇒ 三项都不再注入」
- [x] 每项显示状态与版本，并有「诊断」「重置并重新安装」入口
  - `runtimes-section.tsx:167`（版本 tag）、:235（`runtimeStatusText`）、:196-213（两个按钮 + 诊断报告折叠区 :242-265）
  - **已由阶段 7 取代**：入口随状态而变 —— 未安装 → 「安装」、安装失败 → 「重试安装」、就绪 → 「重置并重新安装」；「诊断」常驻。见文末阶段 7 清单。
- [x] 开关切换**立即生效、无需重启**
  - daemon 每个写开关的 IPC 都**重采集后返回**（`index.ts:3858/:3874/:3887`）；模型侧取的是**函数**而非快照（`index.ts:807` `runtimeInventoryForSession`，注释 `session-host.ts:445-448` 说明理由）
- [x] 禁用时写入显式「已禁用」标记，且注入层与模型侧读的是**同一处**状态
  - 「显式标记」PASS：`preferences.ts:119` `runtimes?: RuntimePrefs`，`runtime-inventory.ts:78` 逐项写布尔（`runtime-inventory.test.ts:69` 断言写的是 `false` 而非删键）；「同一处状态」PASS：模型侧 `collectRuntimeInventory` 与设置页都读 `readRuntimeSwitch()`（`runtime-inventory.ts:57`）。
  - **注入层这一半 2026-09-17 修复后成立**（原缺口：`planRuntimeInjection`（`injection.ts:160`）全仓无生产调用点）。现在三层同源：判据组装 `runtime-inventory.ts` 的 `planRuntimeShellInjection`（读的就是 `readRuntimeSwitch()` + 各描述符 `resolve()`）→ daemon 主会话 `index.ts` 的 `runtimeShellEnv` 与子代理 `subagent-runner.ts` 交给 `createSandboxedRunner` 的 `runtimeEnv` → `sandbox-runner.ts` 把补丁喂给两条 spawn（沙箱走 `SandboxRunRequest.env`、降级直连走 `runCommand` 第 6 参）。修好后 grep `runtimes/injection` 的生产命中为新模块 `src/core/runtime-inventory.ts`（不再是「只有测试」）。
  - 三态断言（Task 7.1 新增）：`runtime-inventory.test.ts` 的「运行时注入的生产判据」4 条（**启用且就绪 ⇒ env 里有 PATH 前缀 + `KAMIBUDDY_NODE_HOME` + `KAMIBUDDY_RUNTIMES_DIR`；逐项禁用 ⇒ env 为 `{}`；总开关关 ⇒ 全 `disabled`、env 为 `{}`；都不就绪 ⇒ 不写托管根变量**）；`sandbox-runner.test.ts` 新增 5 条（workspace-write / read-only / danger-full-access 三条路都带补丁；无 provider 时连 `env` 键都不出现；getter 每次执行现算）+ `powershell-tool.test.ts` 2 条（补丁合并不替换、不回写 `process.env`）。
  - 「改坏 → 看红 → 还原」：把 `sandbox-runner.ts` 的 `options.runtimeEnv?.()` 改成 `undefined`（假装没人接线）→ 4 条红；把 `planRuntimeShellInjection` 的 `master` 写死 `true`（无视总开关）→ 1 条红；两处均已还原、重跑全绿。
- [x] 无新增硬编码视觉值；`check:tokens` 通过
  - `npm run check` 输出：`✓ 硬编码视觉值检查通过（仅剩白名单例外与内置豁免）`；新增分区复用既有 `provider-row` / `mini-btn` / `mcp-switch` / `stat-hint` 类，无新硬编码值

## 审计中心

- [x] 三类记录（命令安全 / 沙箱 / 运行时）落在同一处结构，未各写各的格式
  - `src/shared/audit.ts:37` 唯一 `AuditRecord`（ts/category/outcome/detail）+ 唯一渲染 `auditLine`；`src/core/audit-log.ts:48` 唯一写入出口 `writeAuditRecord`；三处写入点齐全：`powershell-tool.ts:414`、`sandbox-runner.ts:474/:512/:524`、`daemon/index.ts:3868/:3881/:3904`（本批重点核的「三处留痕」都在，未被覆盖）
- [x] 制造一条被拦命令、一次沙箱拒绝、一次运行时失败 —— 三类都能在面板查到
  - **实跑**（临时脚本走生产装配 + `KAMIBUDDY_CONFIG_DIR` 指向临时目录，跑完已删）：① `iex 'Get-Date'` → `{"blocked":true,"category":"dynamic-execution"}`；② 假沙箱 `probe → ffi-load-failed` → `{"blocked":true,"category":"sandbox-unavailable"}`；③ `docx_convert` 的 `ensure` 失败 → 抛 env-not-ready。`readAuditRecords()` 读回 `{"total":3,"categories":["command/blocked","sandbox/blocked","runtime/failed"]}`
- [x] 导出内容与面板一致
  - 面板与导出共用 `readAuditRecords`（差别只在 `limit`）+ `renderAuditRecords` 逐行用 `auditLine`（`audit-log.ts:181`、`audit.ts:158-170`）；实跑断言「面板每一行的 `auditLine` 都逐字出现在导出件里」= true（count=3）
- [x] 清空需二次确认；清空动作本身也被记录；清空后新增记录正常
  - UI：`audit-section.tsx:138` 只进 `confirming`，`:150` 才真清（二次确认文案含不可撤销说明）；`audit-log.ts:150` 先删后补（注释说明顺序不可换）；实跑：`clearAuditRecords()` 清掉 3 条后读回只剩 `["audit/cleared"]`（total=1），再写一条 → total=2

## 模型侧

- [x] 运行时清单（id / 版本 / 状态 / 用途）注入模型可见上下文，且有条目级断言
  - `session-host.ts:2033-2038` 注入 `python_env` 段（缺省整段缺席）；`session-host.test.ts:2160` 逐条断言 `python 3.12 · 就绪 · 文档转换（docx 引擎的解释器）`、`Python 解释器：<路径>`、`gitbash 2.47 · 未就绪（尚未准备）`
- [x] 「被用户禁用」与「找不到」在模型看到的信息里**可区分**
  - **已由阶段 7 取代**（措辞与断言都变）：标签由 `missing: "未就绪（尚未准备）"` 改为 `missing: "未安装"`、`failed: "准备失败"` 改为 `"安装失败"`；动作指引由「等待自动准备」改为「请用户到设置页点安装」。新的断言见文末阶段 7 清单。
  - 两句原文不同：`RUNTIME_STATUS_LABELS`（`shared/runtimes.ts:86-91`）里 `missing: "未就绪（尚未准备）"` vs `disabled: "已被用户禁用"`；动作指引也不同（`:104-109`）；`runtime-inventory.test.ts:119/:159` 断言禁用项文案含「已被用户禁用」且**不含**「尚未准备」，未就绪项反之；`session-host.test.ts:2219/:2223` 同断言 + 禁用项不含路径
- [x] 未就绪/失败的提示响亮且给出可执行下一步，无静默降级
  - **已由阶段 7 取代**：不再有「等待自动准备」这条路（没有任何自动下载），改成「请用户到「设置 → 内置运行时」点安装」。见文末阶段 7 清单。
  - `runtimeStatusHint`（`shared/runtimes.ts:100-111`）三种非就绪各给**唯一一条**路（等待 / 告知用户 / 看诊断或重置），且都写明「不要自己安装」；`python-env.md` 保留「不要 pip install / npm install、缺能力就问用户」
- [x] `resources/prompts/fragments/python-env.md` 已从「只管 Python」扩到三运行时，且保留「不要 pip install」纪律
  - **文件位置与纪律仍成立；状态分支已由阶段 7 订正**（「未就绪 / 自动准备」→「未安装 / 请用户点安装」）。见文末阶段 7 清单。
  - 片段抬头「内置运行时（Python / Node / Git Bash）」，逐项含状态分支（就绪/未就绪/失败/禁用），`:21-24` 保留 pip/npm 纪律
- [x] `check:model-experience` 通过（新增/改动模块的三段契约齐全）
  - `npm run check` 输出：`check-model-experience: 19 个模块（契约 19 / 豁免 0）全部符合`；`shared/runtimes.ts` 与 `injection.ts` 也各自带了三段契约头（它们不在该脚本扫描范围内，脚本范围是 extensions/ 下注册工具的模块 + 4 个具名模块）

## 文档与全局

- [x] `AGENTS.md §2` 已改写（bash 约束作废、三运行时托管），并与代码事实一致
  - **已由阶段 7 取代**：「三运行时随包托管」改为「按需下载」。
  - **2026-09-18 收口轮**：`AGENTS.md §2` 已按按需口径改写完毕 —— 「安装包不含任何运行时载荷 / 三个运行时都由用户在「设置 → 内置运行时」按需安装 / 不会静默自动下载 / 首次使用需联网 / 离线·内网默认不可用（须配覆盖口镜像）」；并撤掉原「会话启动后台预热（SessionStart hook）」句（该预热已随按需口径删除，`src/daemon/index.ts:5124`）。原「本轮不授权改 `AGENTS.md`」的限制在本轮解除。
  - 「`bash` 仍然不用」已明确标为**作废**（`AGENTS.md:88-93`）且与代码一致：`resources/modes/*.md` 无 `bash`（grep 无命中）、`permission-policy.ts:212/:483/:534` 对 `bash` 维持高风险询问、「是否开放 bash 工具面」写明**另行决策**。原「唯一不符」的那句「随包提供运行时只让它在**路径上找得到**（注入层）」**已于 2026-09-17 随 Task 7.1 补齐并订正**：`AGENTS.md:93-96` 现在点名接线点（`planRuntimeShellInjection` → `createSandboxedRunner` 的 `runtimeEnv` → 沙箱与降级两条 spawn），与本段其余结论未动；`resources/runtimes/README.md §4` 同步新增「接线点」小节。
- [x] `docs/ARCHITECTURE.md`、`docs/sandbox.md` 中相关过时表述已同步；「是否开放 bash 工具面」明确标为另行决策
  - `docs/ARCHITECTURE.md:142`「文档流水线按 WorkBuddy 跑 Python venv（2026-09-17 扩成三个托管运行时）」、`:149` 托管根布局、`:194` Git Bash 随包、`:434` 对照表；`docs/sandbox.md:69-71`「bash 维持高风险询问…Git Bash 现已作为 `gitbash` 托管运行时随包提供，但工具面里没有 bash —— 是否开放它是另行决策」、`:260` 有意排除清单
  - **2026-09-18 收口轮**：上述「随包」表述已全部改为「按需安装 / 按需联网下载」——`docs/ARCHITECTURE.md §4.4`（表格形态列、体积与否决方案指引、环境准备与无外网段、删掉 SessionStart 预热句）、`§4.1`「按需下载的 node.exe」、`§4.4a`、`§4.4` 对照表；`docs/sandbox.md:70`「按需安装提供」。`resources/runtimes/README.md` 与 `docs/运行时来源与许可.md` 的过时事实（payload 路径、整树复制、构造期断言、GITBASH_LABEL）一并订正，均在原记录上标注「状态更新（2026-09-18）」而不改结论。
- [x] `npm run check` 全绿（typecheck / check:deps / check:tokens / check:model-experience / check:invariants）
  - **2026-09-18（阶段 7）实跑**：`check:deps` 通过（366 文件）、`check:tokens` ✓、`check:model-experience` 19/19 — 这三项与我改动相关且全绿；**`typecheck` 与 `check:invariants` 红，原因在并行实现轮的在途文件**（`src/core/runtimes/{download,payload-probe,node,gitbash,registry}.ts` 的 `bundled-payload` 引用未收口、`bundled-payload.ts` 已删但登记表仍在）——见文末阶段 7 清单的「归因」。
  - **2026-09-18 收口轮复验（取代上一条的时点快照）**：`npm run check` 退出码 **0**。typecheck 无输出（0 error，上面那 6 条已随实现轮收口消失）；`check:deps` 通过；`check:tokens` = 硬编码视觉值检查通过；`check:model-experience` 19/19；`check:invariants` **25 个在范围模块全部有登记**（含新增 `artifact` / `download` / `payload-probe`，`bundled-payload` 条目已随模块删除一并移除）。
  - **实跑**：`npm run check` 退出码 **0**。`tsc --noEmit` 无输出（无 error）；`check:deps` 通过；`check:tokens` = 硬编码视觉值检查通过；`check:model-experience` 19/19；`check:invariants` 23 个模块全部有登记（含 `runtime-store` / `machine` / `registry` / `python` / `node` / `gitbash` / `injection` / `diagnostics` / `bundled-payload` / `audit-log` / `runtime-inventory` / `shared/runtimes`）。**遗留的 `bundled-payload.ts:125` typecheck 报错已不存在**（另跑 `npm run typecheck` 亦退出 0），无需修复。**2026-09-17 修复轮（Task 7.1）后复跑同样退出码 0**（注入接线未新增模块，故 `check:invariants` 仍是 23 个在范围模块）。
- [x] `npm test` 全绿（已知环境性例外：`src/sandbox/confinement.win.test.ts` 随 IDE 沙箱状态浮动，若红须归因）
  - **2026-09-18（阶段 7）实跑**：`Test Files 3 failed | 137 passed`、`Tests 24 failed | 2514 passed | 1 skipped` —— **24 条红全部落在 `src/core/runtimes/{gitbash,node,python}.test.ts`**（并行实现轮在途）；**与本改动直接相关的 6 个测试文件 133 条全绿**：`npx vitest run src/core/runtime-inventory.test.ts src/core/session-host.test.ts src/extensions/docx-convert-tool.test.ts src/extensions/docx-extract-tool.test.ts src/documents/docx-extract.test.ts src/documents/docx-convert.test.ts` → `Test Files 6 passed / Tests 133 passed`。
  - **2026-09-18 收口轮复验（取代上一条的时点快照）**：`npx vitest run src/core/runtimes` → **8 文件 106 条全绿**（上面的 24 条红已随实现轮收口消失）。整仓 `npm test` → `Test Files 2 failed | 139 passed (141)`、`Tests 2 failed | 2553 passed | 1 skipped (2556)`；两条红是 `src/core/doc-extract.test.ts` 的 `cn.docx` 用例与 `src/core/web-fetch.test.ts` 的 readability 用例**各自 5000ms 超时**，单独重跑同一组 8 文件（含这两文件）**全绿**（`Tests 106 passed`），属整仓高并发下的**负载性浮动**，归因：非本改动引入，与沙箱无关。
  - **实跑**：`vitest run` → `Test Files 140 passed (140)`、`Tests 2531 passed | 1 skipped (2532)`，退出码 0（本轮无沙箱相关红）。托管运行时 8 个测试文件 81 条单跑亦全绿。
  - **2026-09-17 修复轮复跑**：`vitest run` → `Test Files 140 passed (140)`、`Tests 2542 passed | 1 skipped (2543)`，退出码 0（+11 = Task 7.1 新增的 4 + 5 + 2 条）。
- [x] 关键门禁做过「改坏 → 看红 → 还原」实证（至少：安装原子性、开关不注入、审计三类来源）
  - ①**安装原子性**：把 `registry.ts:212` 复验判定改恒假 → `node.test.ts`/`python.test.ts` 2 条红（`expected 'ready' to be 'failed'`）→ 还原后全绿；②**开关不注入**：把 `injection.ts:173` `if (!input.enabled)` 改恒假 → `injection.test.ts` 1 条红（禁用项被注入了 PATH 与变量）→ 还原后 81 条全绿；③**审计三类来源**：已用实跑脚本证伪「只有测试断言、无写入点」的反面（三类真写进真文件、可读可导出）；④**注入接线**（2026-09-17 修复轮）：`sandbox-runner.ts` 的 `options.runtimeEnv?.()` 改 `undefined` → 新增 4 条红（补丁没进沙箱/没进直连）→ 还原；`planRuntimeShellInjection` 的 `master` 写死 `true` → 「总开关关 ⇒ 都不注入」1 条红 → 还原。
- [x] 未触碰并行在途文件；未回滚任何人的改动；无残留临时文件/进程
  - `git status --short` 里**没有** `src/renderer/widget-view.tsx`、`resources/visualizer/*`、`scripts/design-tokens-allowlist.json`（本轮 `git status` 复核：三者均不在改动/新增列表里）；本轮验证只临时改了 `injection.ts` 与 `registry.ts`（已逐字节还原）并创建一个临时脚本（已删除，`git status` 无残留）。
  - **2026-09-17 修复轮**：临时改动仅两处（`sandbox-runner.ts` 的 `runtimeEnv?.()`、`runtime-inventory.ts` 的 `master`），均已还原；Task 7.2 用的临时配置/家目录已删（`$env:TEMP` 下 `kami-t72*` 计数 0），终端注入的 `KAMIBUDDY_CONFIG_DIR` / `USERPROFILE` / `UV_*` 已清除；本机真实 `~/.kamibuddy/runtimes` 仍不存在。**已知副作用（未处理，理由如下）**：跑 `smoke:docx` 会重写被 git 跟踪的 `resources/docx-engine/**/__pycache__/*.pyc`（`git status` 里为 `M`）—— 那是真跑引擎 `import` 的必然产物，删除等于删跟踪文件，故只作记录、不做删除/还原。

## 阶段 7：改为纯按需下载（2026-09-18）

> 口径：三个运行时（python / node / gitbash）**默认都不下载、不安装**；只有用户在
> 「设置 → 内置运行时」点「安装」才联网；**任何静默自动下载都不允许**。
> 上文的旧 checkpoint 凡涉及「随包 / 自动准备」的已就地标注「已由阶段 7 取代」，本节是**新的验收依据**。

**UI 侧（本轮已落地）**

- [x] 每项默认态是「未安装」，且未安装时提供「安装」按钮
  - `src/renderer/settings/runtimes-section.tsx:287-296`（`item.status.kind === "missing"` → 「安装」）；状态文案来自 `shared/runtimes.ts` 的 `RUNTIME_STATUS_LABELS.missing = "未安装"`（`:97-102`）
- [x] 「安装」按钮在点之前就摆出**体积量级 + 需联网**
  - 按钮 `title` 与 meta 行都用 `item.downloadSizeHint`（`:292` / `:340`）；数值由 `src/core/runtime-inventory.ts` 的 `RUNTIME_PRESENTATION` 给（python / node / gitbash 各一条，`:110/:116/:120`），来源是 `resources/runtimes/README.md` 的实测体积
- [x] 安装过程有进度、可取消
  - 进度：`PUSH.runtimeInstallProgress`（`shared/ipc.ts`）→ `runtimes-section.tsx:99-108` 订阅；行内渲染 `Spinner` + 进度文案 + 「取消」（`:235-248`）
  - 取消：`INVOKE.runtimeCancelInstall` → daemon 的 `runtimeInstalls` 里那个 `AbortController.abort()`（`daemon/index.ts`），`installManagedRuntime` 在**每次推进前**检查 `signal.aborted`（`core/runtime-inventory.ts`）。**已知边界**：正在跑的那条子进程不会被中途 kill
- [x] 失败可重试、失败给可执行原因
  - 「重试安装」在 `failed` 态出现（`runtimes-section.tsx:297-306`）；原因有两个来源且都是可执行的：清单 `status.detail`（内核落盘的失败相位 + 底层错误）与安装 reject 的错误条（`daemon/index.ts` 的 handler 把相位 + 原因拼进 message）
- [x] 「诊断」「重置并重新安装」保留
  - 「诊断」常驻（`:278-286`）；「重置并重新安装」在 `ready` 态保留（`:307-317`，带二次确认）
- [x] 视觉未引入新的硬编码值；`check:tokens` 通过
  - 复用既有类（`provider-row` / `mini-btn` / `mcp-switch` / `stat-hint` / `spinner` / `runtime-meta`），无新增 CSS；**实跑** `npm run check:tokens` → `✓ 硬编码视觉值检查通过（仅剩白名单例外与内置豁免）`

**IPC / daemon（本轮已落地）**

- [x] 通道名集中在 `src/shared/ipc.ts`（renderer / preload 不出现字符串字面量）
  - `INVOKE.runtimeInstall`（`"runtimes:install"`）、`INVOKE.runtimeCancelInstall`（`"runtimes:cancel-install"`）、`PUSH.runtimeInstallProgress`（`"runtimes:install-progress"`）+ `InvokeMap` / `PushMap` 条目 + `RuntimeInstallProgress` payload（`shared/runtimes.ts`）
- [x] 两侧接线齐全
  - `shared/bridge.ts`（`runtimeInstall` / `runtimeCancelInstall` / `onRuntimeInstallProgress`）、`preload/index.ts:167-169/:186-188`、`daemon/index.ts` 两个 handler（失败写 `runtime/failed` 审计；取消**不**写审计）
- [x] 仅在「尚未安装」时真的走安装链路；覆盖口 / 已就位实例不动手
  - `installManagedRuntime` 先看 `descriptor.resolve().source !== "pending"` 就直接回清单（保护运维预置的 `HTML_TO_DOCX_VENV` 等）

**模型可见文案（本轮已落地）**

- [x] 「首次使用会自动准备（需联网，约 1-3 分钟）」已从全部模型可见文案中消失，改为「未安装 —— 需用户到设置页点安装」
  - `grep "自动准备" src resources` 的命中只剩历史 spec 记录（`.trae/specs/**`）与将随实现轮更新的内核注释；改动落在 `src/shared/runtimes.ts`、`resources/prompts/fragments/python-env.md`、`src/extensions/docx-{convert,extract}-tool.ts`、`src/documents/docx-extract.ts`、`resources/skills/docx/{SKILL.md,format-extract/SKILL.md,brief-compose/SKILL.md}`
- [x] 「被禁用 / 未安装 / 安装失败」三者在模型看到的信息里可区分，且各给唯一一条可执行的下一步
  - `runtimeStatusHint`（`shared/runtimes.ts:128-140`）：disabled →「请用户去设置页开启」；missing →「尚未安装（不会自动下载）…请用户点安装」；failed →「上次安装失败…看诊断或重试安装」
- [x] 保留「不要 pip install（沙箱里必定失败）/ 缺能力就问用户」纪律原文
  - `python-env.md:19-24` 未动
- [x] `check:model-experience` 通过
  - **实跑**：`check-model-experience: 19 个模块（契约 19 / 豁免 0）全部符合`（改动的 `docx-convert-tool.ts` / `docx-extract-tool.ts` 的三段契约同步更新，未见字段缺失）
- [x] 条目级断言已同步更新（旧断言不再成立，**更新而非删除**）
  - `src/core/runtime-inventory.test.ts`（`gitbash 2.47 · 未安装`、`该运行时尚未安装（不会自动下载）`、禁用项不含「尚未安装」、`downloadSizeHint` 非空）与 `src/core/session-host.test.ts:2223-2224` 同形；**实跑**：这两个文件 + 4 个 docx 工具/文档测试文件 6 文件 133 条全绿

**归因（红的部分不是本改动引入）**

- [x] `npm run typecheck` / `npm run check:invariants` 红 —— **归因：并行实现轮的在途文件**（收口轮复验时已随实现轮落地消失）
  - 原 `tsc --noEmit` 的 6 条报错（`download.ts(235)` `Hash.reset` / `gitbash.ts(55)`+`node.ts(43)` 找不到 `./bundled-payload.ts` / `gitbash.ts(155)` 隐式 any / `payload-probe.ts(73)` 未用 `ProbeContext` / `registry.ts(177)` `AcquiredArtifact.sha256`）与 `check:invariants` 的 `bundled-payload.ts` 悬空登记，**2026-09-18 收口轮复验时均不存在**：`npm run check` 退出码 0，`check:invariants` 25 个模块全有登记。
  - `npm test` 的 24 条红（`src/core/runtimes/{gitbash,node,python}.test.ts`）同属该在途重构，**收口轮单跑 `src/core/runtimes` 8 文件 106 条全绿**。
- [x] 未触碰禁改文件；未回滚任何人的改动
  - 未改 `src/core/runtimes/**`、`scripts/fetch-*.mjs`、electron-builder 配置、`docs/**`、`AGENTS.md`、`resources/runtimes/README.md`、`resources/docx-engine/**`、`src/renderer/widget-view.tsx`、`resources/visualizer/*`、`scripts/design-tokens-allowlist.json`
  - **2026-09-18 收口轮**：改写的是 `AGENTS.md` / `docs/**` / `resources/runtimes/README.md` / `resources/prompts/fragments/python-env.md`（核实，无需改）/ 本 spec 的 `tasks.md`+`checklist.md`（**未碰 `spec.md`**）；`src/**` 只做两次「改坏 → 看红 → 还原」的临时改动（`registry.ts` 的 pending 闸、`download.ts` 的 sha256 闸），均已逐字节还原。禁改文件（`widget-view.tsx`、`resources/visualizer/*`、`design-tokens-allowlist.json`、`resources/docx-engine/**`）未动。

**未确认（如实记）**

- [x] 内核侧「运行期下载 node / gitbash」（Task 7.6）**已落地**（2026-09-18 收口轮复验）—— 取件链 `artifact.ts`+`download.ts`、两描述符的 `acquire`、`ensureRuntime` 只探不装、electron-builder 排除载荷与缓存，均已就位；`npm run check` 0、`src/core/runtimes` 8 文件 106 条全绿。
- [ ] **未跑端到端真机验证**：未打真实安装包（无随包载荷）也未做真实联网下载，「点安装 → 联网下载 → 校验收位 → 就位」这条链在真机上仍未实测（与 tasks.md Task 7.6 的「仍未证」一致）。这是当前唯一挡在「阶段 7 完全收口」前的缺口。
- [ ] 「取消」只保证在**推进之间**生效；正在跑的子进程不会被 kill（需内核提供可取消的 spawn 原语）
- [ ] 进度是「开始 / 终态 + 文案」级别（`percent` 字段已留，当前恒缺席）—— 字节级进度需内核插桩
- [ ] 切走设置页再切回来**能**看到「正在安装」（推送驱动），但**重新挂载后若错过 running 那一条**，界面只会回落到清单状态（清单目前不含「安装中」这一态）；彻底解决需 daemon 把在途安装并入快照
- [x] `AGENTS.md §2` 与 `docs/**` 仍写「随包托管」—— **2026-09-18 收口轮已改写**为按需口径（见「文档与全局」段与「阶段 7」段），不再是未确认项。
- [x] **护栏实证（收口轮补做）**：①「未安装时 ensure 不得触发下载」——把 `registry.ts` 的 pending 闸改恒假 → `node`/`gitbash` 的「纯按需的门」共 4 条红 → 还原后全绿；②「校验不过不得进位」——把 `download.ts` 的 sha256 闸改恒假 → `download.test.ts` 2 条红（`校验失败不许进位` / `续传 sha 不符重下`）→ 还原后 12 条全绿。**两处均已逐字节还原**（`git diff` 复核仅剩实现轮原有改动）。
