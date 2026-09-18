# gitbash 运行时的对应源码与许可义务（GPLv2 §3 / GPLv3 §6）

本文件随 `gitbash` 运行时载荷一起分发（构建期由 `scripts/fetch-gitbash.mjs` 拷进载荷根，
安装时整树复制进托管根 `<configDir>/runtimes/gitbash/<version>/`，所以它**始终与二进制在一起**）。
它是我们履行「提供 Corresponding Source 获取方式」这条义务的载体，**不随版本更新删改**，
只在事实变化（换版本、换组件）时更新。

## 我们分发的是什么

- 上游发行物：**Git for Windows PortableGit 2.55.0.5（64-bit）**
  —— `PortableGit-2.55.0.5-64-bit.7z.exe`，sha256
  `5aa8a20f6e9abb2c755f0e73c91c687701a46b309ad84a0ca6509380fa4ae290`
- 来源：<https://github.com/git-for-windows/git/releases/tag/v2.55.0.windows.5>
- **我们未修改其中任何文件**：载荷是官方发行物在构建期解包的结果（仅解包与整树复制，
  不改内容、不改源码）。因此不产生「标注修改」的义务，但许可文本与版权声明**原样保留**。
- 解包工具（7-Zip 家族 CLI 或发行物自带的 SFX 解包器）**只在构建机使用、不进分发物**，
  所以 7-Zip 自身的许可（LGPL + unRAR 限制）不落到本分发物上。

## 许可文本在哪（**不得删**）

解包结果里自带、我们原样保留：

- 根 `LICENSE.txt` —— 上游的分发说明与 GNU GPL 全文；
- `mingw64/share/licenses/**` —— MSYS2 分发的逐组件许可文本（本版本实测 39 个 `LICENSE*`
  文件，覆盖 curl / expat / libffi / libiconv / libssh2 / libtasn1 … 等）；
- `usr/share/licenses/**` 或各组件的 `COPYING*`（若有）。

构建期断言：`usr/bin/bash.exe` 与根 `LICENSE.txt` 必须存在，否则载荷被丢弃、构建失败
（见 `scripts/fetch-gitbash.mjs`）；安装期同样把这两项作为必备文件断言
（`src/core/runtimes/gitbash.ts` 的 `GITBASH_REQUIRED_FILES`）——「不得删」因此是机械的。

## Corresponding Source 的获取方式（GPLv2 §3）

我们按「版本钉死的上游获取指引」提供对应源码：

| 组件 | 对应源码 |
|---|---|
| Git for Windows 发行版（含打包脚本与构建配置） | <https://github.com/git-for-windows/git/tree/v2.55.0.windows.5> ；打包侧 <https://github.com/git-for-windows/build-extra> |
| MSYS2 用户态与各 `mingw64` / `usr` 组件（bash、coreutils、zlib、curl、OpenSSL、libssh2…） | <https://github.com/msys2/MSYS2-packages>、<https://github.com/msys2/MINGW-packages>（按 `mingw64/share/licenses/**` 里各组件版本取对应 tag） |
| GNU Bash | <https://ftp.gnu.org/gnu/bash/> （版本见载荷内 `usr/bin/bash.exe --version`） |
| Perl（GPL / Artistic 双许可） | <https://www.cpan.org/src/> |

**书面要约**：自本版本发布起 **3 年内**，任何收到本分发物的人都可以向 KamiBuddy 项目维护者
索取上述组件的对应源码（内部试用阶段：直接联系项目对接人）。我们会以与二进制相同的
可获得性提供，或在必要时提供上游点对点获取指引的副本。
（本项目的构建脚本 `scripts/fetch-gitbash.mjs` 亦在仓库内，可一并索取。）

## 聚合与非传染

`gitbash` 只以**独立进程**被调用（不静态/动态链接进 KamiBuddy），属 GPLv2 §2 末段 /
GPLv3 §5 的 mere aggregation；KamiBuddy 本体不受 GPL 传染。**前提是别把它链进来。**

## 商标

「Git」名称与 logo 属上游商标，我们**不用它作我们的品牌名、不在宣传位使用**：界面里的
运行时显示名取中性描述（「Bash 与 unix 工具（随包托管）」，见 `src/core/runtimes/gitbash.ts`
的 `GITBASH_LABEL`），该名称只出现在许可清单与致谢里。
（上游商标政策的精确条款未逐条核对，属「正式上线前由专人做风险置换」的范围，见 `AGENTS.md §6`。）
