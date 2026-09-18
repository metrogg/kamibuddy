# runtimes — 随包分发的三个托管运行时（来源与许可声明）

本目录声明 `add-managed-runtimes` spec 里三个**托管运行时**（`node` / `gitbash` / `python`）
的官方来源、校验方式与许可义务。照 `AGENTS.md §6`（已搬用资产在目录 README 注明来源）。

> **本目录里入库的只有文字**：本声明 + `gitbash/CORRESPONDING-SOURCE.md`（GPLv2 §3 的
> 对应源码获取方式，**必须随包**）。三个运行时的二进制**都不在仓库里**：
>   - `node` / `gitbash` 由构建期脚本拉取并（gitbash）解包，落在
>     `resources/runtimes/payload/<id>/<version>/`（`.gitignore` 已忽略，几百 MB），
>     随安装包分发；运行期安装 = 把它复制进托管根（见 §4）。
>   - `python` 仍由 uv 在运行期下载，落托管根 `<configDir>/runtimes/python/<version>/`。
> 决策记录见 [`docs/运行时来源与许可.md`](../../docs/运行时来源与许可.md)；
> 阶段 2 的落地形态、取舍与否决方案见本文 §4/§5。

证据快照日期：**2026-09-17**（版本号/体积均为当日从官方渠道实测所得）。

## 1. `node` — Node.js 官方发行版（Windows x64 zip）

- **来源**：<https://nodejs.org/dist/v22.23.2/node-v22.23.2-win-x64.zip>
  （目录页 `https://nodejs.org/dist/latest-v22.x/`，当日 latest-v22.x = **v22.23.2**）
- **获取方式（已落地）**：构建期脚本 **`scripts/fetch-node.mjs`**（`npm run fetch:node`，
  dist 链已含它）按「钉死版本 + 可选 `KAMIBUDDY_NODE_URL` 覆盖 + 官方 dist + npmmirror 镜像」
  拉取并解包到 `resources/runtimes/payload/node/22.23.2/`；已就绪则**幂等跳过**
  （运维手工放置解包好的目录即等价成功，整条链不必联网）。不依赖用户机器上的 Node。
- **校验（三处 sha256，已落地）**：脚本内固定整包值 + **解包后的 `node.exe`**
  （官方 `SHASUMS256.txt` 里 `win-x64/node.exe` 那一条，比只核整包更抗打包差异）；
  同时尽量取官方 `SHASUMS256.txt` 交叉核对（取到时两者必须一致，取不到则如实记一行日志）。
  实测（2026-09-17）：官方 `SHASUMS256.txt` 含
  `1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97  node-v22.23.2-win-x64.zip`
  与 `0d0f5e39f9f3d958…  win-x64/node.exe`；官方 zip 与 npmmirror 镜像**逐字节一致**
  （大小 35,683,585 B、sha256 相同）。
  `SHASUMS256.txt.asc` / `.sig`（GPG 签名的公钥与指纹来源：**未确认**）。
- **许可**：**MIT**（实测 `nodejs/node` 的 `LICENSE` 首段为
  "Node.js is licensed for use as follows: … Permission is hereby granted, free of charge…"；
  同文件后续是 V8 / ICU / OpenSSL 等第三方许可段，**未逐项核对**）。
  随包必须附该 `LICENSE` —— 它是载荷必备文件（缺了安装即失败），解包后位于载荷根。
- **体积量级**：zip **35,683,585 B（≈34 MiB）**；解包后实测 **2032 个文件 / 94.9 MB**
  （`node.exe` 单文件 82.97 MB）。随包 + 托管根副本各一份（见 §4 的体积账）。
- **Windows x64 布局（实测）**：zip 内单一顶层目录 `node-v22.23.2-win-x64/`，
  **构建期剥掉这一层**（与 uv 的 zip 不同），于是载荷根就是实例根：根层实测有
  `node.exe`、`npm` / `npm.cmd` / `npm.ps1`、`npx*`、`corepack*`、`node_modules/npm/`、
  `LICENSE`、`README.md`、`install_tools.bat`。
  **注意：这一版 zip 里没有 `node.lib`**（阶段 0 曾按 `win-x64/node.lib` 推断，已更正 ——
  别把它写进必备文件）。

## 2. `gitbash` — Git for Windows **PortableGit**（唯一含 bash 的可分发形态）

**结论先说：MinGit 不能用作 `gitbash` 运行时 —— 它不含 `bash.exe`。** 三种官方发行物实测对比：

| 发行物（v2.55.0.windows.5） | 体积（GitHub 官方 asset 实测） | 含 bash？ | 含哪些 unix 工具 |
|---|---|---|---|
| `MinGit-2.55.0.5-64-bit.zip` | 38,989,688 B（≈37 MiB） | **否** | 只有 `/bin/sh` + 部分 unix 工具（官方页明说无 `/usr/bin/bash`）；是"non-interactive"分发，明确排除 Git Bash、Perl、Tcl/Tk |
| `MinGit-2.55.0.5-busybox-64-bit.zip` | 34,484,406 B（≈33 MiB） | **否**（shell 是 busybox 的 `ash`） | busybox 单文件提供的 applet（官方标为 **experimental**，且不支持 Git Bash 式交互终端；第三方文档亦称 coreutils 大多缺失） |
| `PortableGit-2.55.0.5-64-bit.7z.exe` | 58,960,208 B（≈56 MiB） | **是**（完整 Git for Windows） | 完整 MSYS2 用户态 + coreutils 等 |
| （参考）`Git-2.55.0.5-64-bit.exe` / `.tar.bz2` | 65,343,712 B / 117,482,532 B | 是 | 同上，但形态是安装器 / tar.bz2 |

- **来源**：<https://github.com/git-for-windows/git/releases/tag/v2.55.0.windows.5>
  （`PortableGit-2.55.0.5-64-bit.7z.exe`；这是官方"自解压 7z"便携包）
- **获取方式（已落地）**：构建期脚本 **`scripts/fetch-gitbash.mjs`**（`npm run fetch:gitbash`，
  dist 链已含它）拉取发行物 → 核 sha256 → **构建期解包** → 断言（必备文件 + 文件数下限 +
  根层许可文本）→ 写 `resources/runtimes/payload/gitbash/2.55.0.5/`；已就绪则幂等跳过。
  解包器**只在构建机使用、不进产物**：优先 `KAMIBUDDY_7Z` / PATH 上的 7z 家族 CLI，
  退回**发行物自带的 SFX 解包器**（`<artifact> -y -o<dir>`，本机实测可用，9584 文件 / 33 s）。
  候选源：`KAMIBUDDY_GITBASH_URL` → GitHub Release → npmmirror 镜像（见「私有化」一节的实测）。
- **校验**：GitHub Release API 给出每个 asset 的 **sha256**（实测
  `PortableGit-2.55.0.5-64-bit.7z.exe` → `5aa8a20f6e9abb2c755f0e73c91c687701a46b309ad84a0ca6509380fa4ae290`，
  同页亦列 MinGit 两个变体的 sha256）。脚本内固定该值，并尽量与 API 的 `digest` 字段交叉核对。
- **许可与义务**：见下节（**这是本目录最要紧的一段**）。
- **Windows x64 布局（实测，2026-09-17 本机解包）**：解包后 **9584 个文件 / 389.1 MB**，根层是
  `bin/ cmd/ dev/ etc/ mingw64/ tmp/ usr/ git-bash.exe git-cmd.exe LICENSE.txt README.portable`；
  - bash 入口 = **`usr/bin/bash.exe`**（`bin/bash.exe` 也有一份，MSYS 的别名位）；
    `mingw64/bin/bash.exe` **不存在**（阶段 0 按既有安装布局猜过三种候选，实测收敛到 `usr/bin`）；
  - git = `cmd/git.exe`（包装器）与 `mingw64/bin/git.exe`（真身）；`usr/bin/git.exe` 不存在；
  - unix 工具实测在 `usr/bin`：`ls` / `cat` / `grep` / `sed` / `awk` / `tar` / `ssh` / `perl` / `find`
    （`curl.exe` 不在 `usr/bin`，在 `mingw64/bin`）；
  - **`bash.exe -c "git --version"` 实测输出 `git version 2.55.0.windows.5`**（版本串归一化见
    `src/core/runtimes/gitbash.ts` 的 `parseGitVersion`）；不加 PATH 注入时这条命令读到的是
    机器上另一个 git（本机实测 2.53.0.windows.2）—— 这是探针必须自带注入的原因。
  - 许可文本位置见下（**不得删**）。

### `gitbash` 的许可义务（随包分发必须履行）

上游原文（Git for Windows FAQ 的 "Licenses" 节，转载自其 release notes）：

> Git is an Open Source project covered by the **GNU General Public License version 2**（其中部分
> 组件为 GPLv2 兼容的其它许可）… This package contains software from a number of other projects
> including **Bash, zlib, curl, tcl/tk, perl, MSYS2** and a number of libraries and utilities from
> the GNU project, **licensed under the GNU General Public License**. Likewise, it contains Perl
> which is dual licensed under the GNU General Public License and the Artistic License.

即：**Git 本体 GPLv2，但随包各组件的许可并不相同**（GPLv2 / GPLv3+ 系 / 双许可 / 宽松许可混装）。
随包分发时我们要履行的义务：

1. **附许可文本与版权声明**：GPLv2 全文、Bash / MSYS2 / GNU utilities 的对应 GPL 文本、
   Perl 的双许可声明、curl / zlib / tcl-tk / OpenSSH / OpenSSL 等各自许可。
   PortableGit 解包后**自带**这些文件 —— **不得删除**，并要在产品的「关于 / 开源许可」页可读。
   **落地形态（实测位置）**：根 `LICENSE.txt`（上游分发说明 + GPL 全文）+ `mingw64/share/licenses/**`
   （MSYS2 的逐组件许可树；本版本实测 39 个 `LICENSE*` 文件，覆盖 curl / expat / libffi /
   libiconv / libssh2 / libtasn1 / gcc-libs … 等）。这两处都由「整树复制」原样带进托管根实例，
   构建期与安装期各有一条**机械断言**（缺根 `LICENSE.txt` 即失败）：见
   `scripts/fetch-gitbash.mjs` 与 `src/core/runtimes/gitbash.ts` 的 `GITBASH_REQUIRED_FILES`。
2. **提供对应源码的获取方式**（GPLv2 §3 / GPLv3 §6 二选一）：随附源码，或给出**有效期 ≥3 年**的
   书面要约，或给出版本钉死的上游源码点对点下载指引（`git-for-windows/git`、`build-extra`、
   MSYS2 包仓库、bash、busybox 等）。
   **落地形态**：[`gitbash/CORRESPONDING-SOURCE.md`](gitbash/CORRESPONDING-SOURCE.md) —— 版本钉死的
   上游源码指引 + **≥3 年的书面要约**（含索取方式）。构建期脚本把它拷进载荷根，安装时随整树
   复制进托管根，**义务因此始终与二进制在一起**（不靠产品界面记得展示）。
3. **不得附加额外限制**（GPLv2 §6 / GPLv3 §10）：不得对包内 GPL 程序加限制或额外许可门槛；
   不得对其做 DRM / Tivoization。
4. **不改文件就不必标注修改**，但不得移除或篡改其许可与版权信息（GPLv2 §1）。
5. **聚合不传染**：只把它当**独立进程**调用、不与 KamiBuddy 代码链接，则属 "mere aggregation"
   （GPLv2 §2 末段 / GPLv3 §5），KamiBuddy 本体可保持闭源。**前提是别把它链进来。**
6. **商标**：Git 的商标政策限制 "Git" 名称与 logo 的使用 —— 不要在 UI/宣传位用它当我们的品牌名，
   只在许可清单 / 致谢里出现（精确条款**未逐条核对**）。
   **落地形态**：运行时显示名取中性描述「Bash 与 unix 工具（随包托管）」
   （`src/core/runtimes/gitbash.ts` 的 `GITBASH_LABEL`，id 仍是 `gitbash`，与 spec/代码一致）。

**判定：能合规**（不是"无法合规"），所以 spec 无需因此回头改；但载体必须收敛为 **PortableGit**。

**阶段 2 已收口的事实**（阶段 0 的「未确认」逐条落地）：
- 解压后总体积：**9584 文件 / 389.1 MB**（实测）；
- bash 入口精确路径：`usr/bin/bash.exe`（实测存在；`bin/bash.exe` 亦有）；
- 逐组件许可清单：**未逐条核对**（上游无集中汇总）—— 但许可文本**在哪**已实测（见义务 1），
  且「不得删」已有构建期 + 安装期两道机械断言。**逐条核对仍是「正式上线前专人风险置换」里的一项**；
- 本机实测可用：能起 bash、能跑 `git --version`、能跑 coreutils 与 `uname`（PATH 注入后，见 §2 布局）；
- 「只取 bash 子集」是否可行：**未做**（上游不支持裁剪 MSYS2 用户态；裁剪也不改变许可义务），
  仍按整包分发。

## 3. `python` — 沿用 uv（`uv python install 3.12`）+ python-build-standalone

- **来源（两层）**：
  1. `uv.exe`（随包）：<https://github.com/astral-sh/uv/releases/download/0.12.15/uv-x86_64-pc-windows-msvc.zip>
     —— 已由仓内 **`scripts/fetch-uv.mjs`** 拉取到 `resources/bin/uv.exe`（该链路**不动**）。
  2. Python 本体：uv **不自己造发行版**，按内置元数据从
     `astral-sh/python-build-standalone` 的 GitHub Release 拉。实测 uv 的元数据
     `crates/uv-python/download-metadata.json`（3,156,430 B，5608 条）里
     `cpython-3.12.14-windows-x86_64-none` →
     `…/releases/download/20260901/cpython-3.12.14%2B20260901-x86_64-pc-windows-msvc-install_only_stripped.tar.gz`。
- **获取方式**：`uv python install 3.12`（托管径由 `UV_PYTHON_INSTALL_DIR` 指到托管根，
  阶段 1 落地；uv 的默认落盘位置需 `uv python dir` 实测 —— **未确认**），venv 仍由 uv 建。
  `HTML_TO_DOCX_VENV` 作为既有的显式覆盖口**保留**。
- **校验**：**sha256**。uv 元数据里逐条带 `sha256`（上条即实证）；GitHub API 亦给 asset `digest`，
  实测同 release：`install_only` 46,184,075 B / `e90c1b64…`，`install_only_stripped` 21,980,728 B /
  `7c45c9622400d578709a9b2cddbe8124cc21d382409d9f13406d706d28e31b14`（与元数据一致）。
- **许可**：CPython 本体 **PSF License Agreement**（实测 `python/cpython` 的 `LICENSE` 223 行，
  含 "This LICENSE AGREEMENT is between the Python Software Foundation…" 段）；随包还含
  OpenSSL 等第三方（**未逐项核对**）。`python-build-standalone` **仓库自身**的 `LICENSE` 实测为
  **MPL-2.0**（那是构建脚本仓库的许可，**不等于**解释器本体的许可，别混）。`uv` 自身：
  `LICENSE-MIT` 实测存在（"MIT License / Copyright (c) 2025 Astral Software Inc."）；
  是否同时 Apache-2.0 双许可：**未确认**。
- **体积量级**：Python ≈ **22 MB**（stripped `install_only`，实测 21,980,728 B；非 stripped 44 MB）
  + `uv.exe` ≈ **17 MB**（实测 `uv-x86_64-pc-windows-msvc.zip` 17,578,593 B）
  + wheel 依赖（python-docx / lxml / Pillow…，数十 MB，**未实测**）。
  解压后 ≈ 100 MB 量级（估算）。
- **Windows x64 布局**：`uv.exe` 解压在 zip 根；python-build-standalone 的 `install_only` 解包后
  含 `python/` 目录、`python.exe` 在其中（**未实测**）。

## 4. 阶段 2 的落地形态（`node` / `gitbash` 怎么随包、怎么装、怎么注入）

**载荷与实例（两处落点，别混）**：

| 落点 | 内容 | 谁写 | 入库？ |
|---|---|---|---|
| `resources/runtimes/payload/<id>/<version>/` | 构建期拉取/解包出的**随包载荷**（node 裸树 / PortableGit 解包树 + `payload.json` + `CORRESPONDING-SOURCE.md`） | `npm run fetch:node` / `fetch:gitbash`（或运维手工放置） | **否**（`.gitignore`） |
| `<configDir>/runtimes/<id>/<version>/` | 运行期**托管实例**（内核实现在 `src/core/runtimes/`）：`复制载荷 → 探针 → 进位 → 复验 → manifest → current` | 首次使用 / 「重置并重新安装」 | 否（用户目录） |

- 安装是**先探针**：已就位的实例第一步就结束（零复制、零 fs 检查），探针不过才复制
  （复制前才校验载荷）—— 于是「实例文件被删坏」会就地修复，而每次幂等 ensure 不会重拷几百 MB。
- 复制用 `%SystemRoot%\System32\Robocopy.exe`（绝对路径调起，不按 PATH 查找）；退出码是位掩码，
  `≤7` 即成功、`≥8` 才失败。gitbash 载荷 9584 个文件，PowerShell 递归复制在这个量级慢一个数量级。
- 探针（= 探测判据，四态 `missing` / `wrong-version` / `deps-missing` / `ready` 共用既有形状）：
  - `node`：`<实例>/node.exe --version` → `v22.23.2`（解析见 `src/core/runtimes/node.ts`）；
  - `gitbash`：`<实例>/usr/bin/bash.exe -c "git --version"` → `git version 2.55.0.windows.5`
    归一化成 `2.55.0.5`。**一句话验三件事**：bash 起得来、git 起得来、注入的 PATH 布局对。
    探针**自带 PATH 注入**（与注入层同一份布局）：不注入时会读到机器上另一个 git（实测）。
  - 两者都把许可文本写进必备文件（`node` 的 `LICENSE` / `gitbash` 的 `LICENSE.txt`）：
    缺了 = `deps-missing` 指名，且停不进位。
- **注入层**（`src/core/runtimes/injection.ts`，SubTask 2.1.3）：启用且就绪才注入，注入的是
  PATH 前置目录 + `KAMIBUDDY_RUNTIMES_DIR` / `KAMIBUDDY_NODE_HOME` / `KAMIBUDDY_GITBASH_HOME`；
  gitbash 的三个目录顺序是 `mingw64/bin` → `usr/bin` → `cmd`（顺序错会被机器上已有的 git 抢先）。
  禁用 ⇒ **不注入**且留一条 `disabled` 决定（模型侧的「被禁用」与「找不到」因此可区分）；
  总开关关闭 ⇒ 三个都不注入（这一条在注入层兜住，不靠调用方记得）。落点是**模型驱动的 shell
  的环境**，不是 daemon 自己的 `process.env`；刻意不设 `SHELL`（那是 pi 解析 bash 的入口，
  属于「是否把 bash 开放成模型的自由 shell 工具」这个**另行决策**，本层不替它做决定）。
- **接线点**（2026-09-17 补，此前只有纯函数、没有生产调用点）：判据由
  `src/core/runtime-inventory.ts` 的 `planRuntimeShellInjection` 组装（读设置页同一份开关 +
  各描述符的 `resolve()`），主会话（`src/daemon/index.ts` 的 `runtimeShellEnv`）与子代理
  （`src/daemon/subagent-runner.ts`）各把它交给 `createSandboxedRunner` 的 `runtimeEnv`；
  执行器在 spawn 那一刻应用 —— 进沙箱的命令走 `SandboxRunRequest.env`（`src/sandbox/index.ts`），
  降级直连 spawn 走 `runCommand` 的 env 参数（`src/extensions/powershell-tool.ts`，补丁**合并**在
  `process.env` 之上，不整体替换）。每次执行现算 ⇒ 设置页改开关后下一条命令即生效，无需重启。

**体积账（实测，用于判断安装包与磁盘预算）**：

| 项 | 随包（解包后） | 托管根副本 |
|---|---|---|
| `node` | 94.9 MB | 94.9 MB |
| `gitbash` | 389.1 MB | 389.1 MB |
| `python` | uv.exe 17 MB（zip 量级）+ 运行期下载 | ≈100 MB 量级（估算） |

即 `node` + `gitbash` 会在安装目录与用户配置目录各占一份（合计约 0.95 GB）。
想省掉托管根那份就得放弃「版本化实例 / 可回滚 / 可重置」这套内核契约，**当前不省**（见 §5）。

## 5. 阶段 2 的取舍与否决方案

**选定的方案**：`node` / `gitbash` 走「构建期拉取（+ 7z 构建期解包）→ 随包分发 → 运行期只复制」
（`scripts/fetch-node.mjs` / `scripts/fetch-gitbash.mjs` + `src/core/runtimes/bundled-payload.ts`）。

## 否决方案

1. **否决：运行期解包 `PortableGit-*.7z.exe`（往产物里塞 7z 解压器）。**
   理由：7-Zip 是 **LGPL + unRAR 限制**，随产物分发就把限制带进我们的分发物（unRAR 那条与
   我们完全无关却要一起背）。构建期解包把解包器留在构建机上，产物里只有普通文件树。
2. **否决：用 MinGit（zip，jszip 解得动）替代 PortableGit。**
   理由：**MinGit 不含 `bash.exe`**（官方明说 non-interactive 分发，shell 只有 `/bin/sh`；
   busybox 变体是 `ash` 且 experimental），拿它当 `gitbash` 运行时名不副实。
3. **否决：把 `.7z` 原样塞进安装包，让「首次使用」在用户机上解。**
   理由：与 1 同因（用户机上没有 7z），而且用户机上装 7-Zip 是个不该有的前置条件。
4. **否决（暂不采纳）：`node` 改走运行期下载，让安装包小 95 MB。**
   理由：① 与 `gitbash` 不同形，多一条只有 node 才有的下载链路要养；② 运行期下载要在用户机上
   依赖下载器与网络（本机实测 github.com 不可达、nodejs.org 慢到 115 s/36 MB），而随包是
   离线可用、首次使用不等下载；③ spec 的措辞是「随包分发三个运行时」。
   **若产品后来确实要压安装包体积，应另立一条决策**（会同时改变用户侧离线能力）。
5. **否决：运行期直接复用随包载荷（不复制到托管根），省掉 484 MB 副本。**
   理由：安装目录（`Program Files` 下的 resources）不是我们可写的落点，且这会架空内核契约 ——
   没有实例目录就没有「版本指针 / 回滚 / 重置 / 半成品可识别」这四件事，而它们正是 spec 的
   Requirement。体积是已知代价，记在 §4。
6. **否决：探针不带 PATH 注入（只跑 `bash.exe --version` 之类的绝对路径）。**
   理由：实测不注入时 `bash -c "git --version"` 读到的是**机器上另一个 git**（2.53.0.windows.2
   vs 载荷里的 2.55.0.windows.5）—— 那种探针验的是机器环境而不是随包载荷；而且它就摆在
   「注入到底能不能用」这条验收标准的旁边，验了等于没验。
7. **否决：给 node / gitbash 也开一个 `HTML_TO_DOCX_VENV` 式的环境变量覆盖口。**
   理由：那个口是为兼容既有用户与私有化预置而留的历史包袱；两个新运行时没有需要兼容的旧路径。
   运维预置走**构建期**（把载荷手工放进 `payload/<id>/<version>/`，fetch 脚本幂等跳过），
   与 `fetch:uv` 的「手工放置即等价成功」同款。

## 私有化 / 无外网（镜像由谁设本轮仍不拍板；以下为 2026-09-17 实测）

`UV_INDEX_URL` / `UV_PYTHON_INSTALL_MIRROR` 由谁设本轮不拍板（spec 已记）。

**已实测的一致性线索**（要用仍必须先核 sha256 —— 两个 fetch 脚本都把 sha256 钉在代码里，
镜像只是候选传输通道，对不上就换下一个候选）：

| 镜像 | 实测 | 结论 |
|---|---|---|
| `registry.npmmirror.com/-/binary/git-for-windows/<tag>/<asset>` | 目录列表可达；`PortableGit-2.55.0.5-64-bit.7z.exe` 58,960,208 B，sha256 与 GitHub asset digest **逐字节一致** | 可用（已在 fetch 脚本里作候选） |
| `registry.npmmirror.com/-/binary/node/v<ver>/<asset>` | `node-v22.23.2-win-x64.zip` 35,683,585 B，sha256 与官方 `SHASUMS256.txt` **逐字节一致** | 可用（已在 fetch 脚本里作候选） |
| `github.com` 直连（release 下载） | **本机实测不可达**（`curl` 连不上；`api.github.com` 可达）。**2026-09-17 复测：`github.com` 200、`/astral-sh/python-build-standalone/releases/latest` 302（asset 域 `release-assets.githubusercontent.com` 未单独复测）** —— 可达性随网络环境变化，别把任一次结论当恒定 | 内网可考虑只放行 API 与 npmmirror |
| `pypi.org` / `files.pythonhosted.org`（wheel 来源） | 2026-09-17 实测：`pypi.org/simple/` 200、`files.pythonhosted.org` 可达（根路径 404 属正常）；同次实测 `pypi.tuna.tsinghua.edu.cn` / `mirrors.aliyun.com` 亦 200 | 走内网镜像时配 `UV_INDEX_URL` 即可 |

其余第三方镜像（清华等）**未验证**：用了必须核 sha256 并回写本文件。
