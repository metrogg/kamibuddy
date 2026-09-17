# bin — pi 依赖的外部二进制（fd / rg）

## 来源与使用声明

这两个可执行文件**不是 KamiBuddy 的代码**，是 pi 那两个工具的"外壳依赖"：
pi 的 `find` 工具调 `fd`、`grep` 工具调 `rg`（`packages/coding-agent/src/core/tools/find.ts`
里 `ensureTool("fd")`）。

pi 自己的兜底是「本机找不到就从 GitHub 下」，但那条路在国内网络下经常不通，
而且**每次失败都要白等 10 秒**（它的版本解析超时 10s），失败原因还被那条调用路径吞掉 ——
2026-09-17 实测：`ensureTool("fd")` 耗时 10,024 ms → `undefined`，
用户面板上只看到一句 `fd is not available and could not be downloaded`，
而模型每次想找文件都要先等这 10 秒。

所以直接把二进制作为资产带进来，由应用启动时补到 **pi 自己的 bin 目录**
（`src/core/agent-tools.ts`，幂等、已就位不动）—— 与 docx 引擎同一套
「不要求用户预装、不依赖运行时联网」的思路。

**目标目录是 `~/.pi/agent/bin`，不是 `~/.kamibuddy/bin`**（2026-09-17 踩过）：
pi 的 `tools-manager.ts` 在模块加载时用 `getBinDir()`（= `getAgentDir()/bin`）把查找目录算死了，
与我们传给 `createAgentSession` 的 `agentDir`（`~/.kamibuddy`）无关。
所以 `agent-tools.ts` 用 pi 公开导出的 `getAgentDir()` 推导，不拼自己的配置目录。
（该目录可用环境变量 `PI_CODING_AGENT_DIR` 覆盖；两边同一函数取，不会漂。）

实测这台机器上 `~/.pi/agent/bin/rg.exe` **已经存在**（ripgrep 15.2.0，pi 自己下过），
所以「已就位不动」这条很关键 —— 不要用随包版本去覆盖用户已有的、可能更新的二进制。

| 文件 | 实际版本 | 来源 | 许可 |
| --- | --- | --- | --- |
| `fd.exe` | 10.5.0 | GitHub `sharkdp/fd` release `v10.5.0` 的 `fd-v10.5.0-x86_64-pc-windows-msvc.zip` | MIT 或 Apache-2.0（双许可，用户任选） |
| `rg.exe` | 15.0.0 | npmmirror 二进制镜像 `ripgrep-prebuilt/v15.0.1/` 的 `ripgrep-v15.0.1-x86_64-pc-windows-msvc.zip`（microsoft/ripgrep-prebuilt，即 ripgrep 官方预编译） | MIT 或 Unlicense（双许可，用户任选） |

sha256（**换版本时必须同步更新本表**，应用侧不做校验）：

```
fd.exe  d67d27a8e375ed7e9bca2b506a9dd5082bc24547aeba908b863f6f8b8ab0c3b9
rg.exe  f9dde63498b3193f098355dbec97af99dc4f6b8fa0df5ed04114a03012c042cb
```

- **使用范围**：公司内部使用阶段（同 AGENTS.md §6）；正式上线前由专人做风险置换/复核。
- **只放了 Windows x64**：非 Windows 上本目录不参与（`ensureAgentTools` 直接跳过），
  pi 那边会走系统 PATH 或它自己的下载。要支持别的平台时按同样格式补进来
  （`macos/arm64/fd` 之类，需先扩展 `agent-tools.ts` 的定位规则）。
- 校验方式（复核来源时用）：`Get-FileHash -Algorithm SHA256 resources\bin\fd.exe`。

## 升级步骤

1. 下新版压缩包（fd 走 GitHub release；rg 走 npmmirror 的 `ripgrep-prebuilt`，国内直连）；
2. 解出 `fd.exe` / `rg.exe` 覆盖本目录；
3. 更新上表的版本与 sha256；
4. **已经装到用户机器上的旧版本不会被自动覆盖** —— 这是有意的（不静默换掉正在用的二进制）。
   要推到用户机器：删掉 `~/.pi/agent/bin/` 下对应文件，重启应用即可重新补上。

## 打包注意

`getResourcesDir()` 现在定位到项目根的 `resources/`（见 config-paths.ts 的注释）；
打包分发时要把 `resources/`（含本目录）复制到产物同级位置，或设 `KAMIBUDDY_RESOURCES_DIR`，
否则应用找不到这里的二进制 —— 那时 find/grep 会退回 pi 的「联网下载 + 每次白等 10 秒」。
