# 发版链路与更新检查 Spec

> 决策记录，写完即冻结（`AGENTS.md §8`）。结论要变另写一份并与本文件互相链接。

## 状态：部分作废（2026-09-19）

- **作废**：§一「发版链路（CI）」、§三「更新检查」。用户 2026-09-19 决定不做——
  受众是部门几位同事，手动打包 + 手动发 exe 足够。
- **有效但已迁出**：§二「exe 身份信息（图标 + rcedit）」。该节由
  [`add-app-icon-and-package-slimming/spec.md`](../add-app-icon-and-package-slimming/spec.md)
  承接并已落地（其中「本机 AV 拦 rcedit」的结论**已被实测推翻**：electron-builder 26
  的资源改写已换成纯 JS 的 `resedit`）。
- **仍然有效**：本文件的「否决方案」① ② ③ ④ ⑥ 与「已接受的风险」——那是对
  「如果将来要上自动更新该怎么做」的取舍分析，规模变大时可原地取回，不做删改。
- 其余各节（Requirement/Scenario、Impact）随上述两节作废，仅作留档。

## Why

安装包本身已经能用了（2026-09-17 起 `npm run dist` 出 NSIS，用户级免管理员安装），但现在要**真的发给部门同事用**，还缺三件：

1. **发版完全靠人工**：在你本机 `npm run dist`，再把 exe 手工发给同事。产物不可重现，也没人知道「同事装的那份」是哪个提交打的。
2. **exe 没有身份信息**：本机 rcedit 被企业 AV 拦（`electron-builder.yml` 第 49-52 行记录过实测），所以 `signAndEditExecutable: false`，exe 的属性里产品名/版本号/公司名全是 Electron 默认值，图标也是默认的。同事在任务管理器或属性页里认不出这是「嘉立创Work 0.1.0」。
3. **同事不知道有没有新版本**：发新版只能靠群里喊，装没装、装的哪版全靠问。

## 用户决策（2026-09-19）

| # | 决定点 | 选定 |
| --- | --- | --- |
| 1 | 更新源与分发 | **GitHub Releases**（仓库 `metrogg/kamibuddy`，public）；已确认**接受安装包公开下载** |
| 2 | 更新形态 | **只提示，手动下载安装** —— 不自动下载、不自动安装 |
| 3 | 发版链路 | **GitHub Actions**：push tag → 自动构建 → 自动建 Release |
| 4 | 图标 / 签名 | **有图标**（用户提供）、**无代码签名证书** → 不签名 |
| 5 | 提示位置 | **只在「设置 → 关于」**（不做提示条、不做弹窗、不做侧栏入口） |
| 6 | 检查时机 | **纯手动**：不启动检查、不定时轮询；只有用户点「检查更新」才联网 |

## What Changes

### 一、发版链路（新增 `.github/workflows/release.yml`）

触发 `push tag v*`，跑在 `windows-latest`（必须 Windows：NSIS 目标 + koffi 等 Windows 原生模块，本仓库无法交叉编译）：

1. `actions/checkout` → `actions/setup-node@v4`（node 22，`package.json` 的 `engines` 要求 `>=22.19.0`，开 npm 缓存）→ `npm ci`
2. **门禁**：`npm run check`（typecheck + check:deps + check:tokens + check:model-experience + check:invariants + check:expert-assets）
3. **断言 tag 与 `package.json` 的 version 一致**（`v0.1.0` ↔ `0.1.0`），不一致立即失败
4. `npm run dist` —— 打包**仍然走 `pack.mjs`**（本项目唯一的打包编排入口），理由有二：
   - 它是自带 win-unpacked 终态 rename 的 EPERM 重试（`scripts/pack.mjs` 第 78-83 行）；绕开它自己拼 `electron-vite build` + `electron-builder` 等于把重试逻辑丢在本地；
   - `npm run dist` 的第一段就是 `fetch:uv`，而 `resources/bin/` 在 `.gitignore` 第 56 行里、CI 必须现拉（来源是 uv 官方 GitHub release，带 sha256 校验），用 `dist` 顺带把这步做掉，不必在 workflow 里再写一遍。
5. 生成 `release/version.json`
6. `gh release create "v$VER" <exe> release/version.json --generate-notes`，用内置 `GITHUB_TOKEN`（workflow 显式声明 `permissions: contents: write`），**不需要新增任何 Secret**

**不复用 electron-builder 的 publish provider**：它只会上传 exe 与其 `latest.yml`，`version.json` 还得二次补传；而 `gh release create` 一条命令把「建 Release + 上传全部产物 + 标记为 latest」做完。因此 `electron-builder.yml` **不加 `publish` 段**，本地与 CI 行为完全一致（都是 `--publish never`）。

**镜像 env**：runner 在境外，不需要 npmmirror。`pack.mjs` 只在 env 为空时才注入镜像（`scripts/pack.mjs` 第 33-40 行），所以 CI 里把两个 env 显式设成官方默认地址即可绕过，**零代码改动**：

```
ELECTRON_MIRROR=https://github.com/electron/electron/releases/download/
ELECTRON_BUILDER_BINARIES_MIRROR=https://github.com/electron-userland/electron-builder-binaries/releases/download/
```

### 二、exe 身份信息（图标 + rcedit）

- 用户提供 `build/icon.ico`（建议 256×256、含 16/32/48/128/256 多尺寸）。`build/` 目录当前不存在，需新建。electron-builder 默认即从 `build/` 取图标，**文件就位即生效，不必改 yml**；同时删掉 `electron-builder.yml` 第 14 行「目录暂不存在」那句过期注释。
- `signAndEditExecutable`：本机 rcedit 被企业 AV 拦，CI 上没有这个干扰。做法是给 `scripts/pack.mjs` 加一个 env 开关，**只在 CI 追加 `-c.win.signAndEditExecutable=true`**，本机保持 yml 里的 `false` 不变 —— 你不必为「本机打包报 UNKNOWN」付代价。开关处注释必须写明「本机被 AV 拦是唯一原因，别在无 AV 的机器上关它」。
- **仍然不做代码签名**：同事首次运行会有 SmartScreen，需「更多信息 → 仍要运行」。

### 三、更新检查（纯手动）

**清单来源**：Release 里挂一个 `version.json`（内容 `{"version":"0.1.2"}`），客户端读
`https://github.com/metrogg/kamibuddy/releases/latest/download/version.json`

**谁查**：main 进程（renderer 不碰外部网络）。新增 `src/shared/update.ts`（纯函数 + 常量 + 类型，零运行时依赖，可单测）：

- `RELEASE_PAGE_URL = "https://github.com/metrogg/kamibuddy/releases/latest"` 与 `UPDATE_MANIFEST_URL = "https://github.com/metrogg/kamibuddy/releases/latest/download/version.json"` 常量
- `compareVersions(a, b)`：三段数字比较；**不引 semver 依赖**
- `UpdateCheckResult` 联合类型：`{ kind: "upToDate" }` / `{ kind: "available"; latest: string }` / `{ kind: "failed"; reason: string }`
- 新增 `src/main/update-check.ts`：fetch（超时 5s）→ 解析 → 比对 `app.getVersion()`

**契约**（`AGENTS.md §4`：通道名与 payload 集中在 `shared/ipc.ts`）：

- `shared/ipc.ts` 新增 `INVOKE.updateCheck = "update:check"` + 调用签名表一行
- `preload/index.ts` + `shared/bridge.ts` 暴露 `checkUpdate(): Promise<UpdateCheckResult>`
- **只加这一条 invoke 通道**。纯手动形态下不需要 push 通道——「检查中」是渲染层自己的本地状态，main 不维护缓存、不发推送。打开下载页也不需要新通道：渲染层 `window.open()` 已被 `src/main/index.ts` 的 `setWindowOpenHandler` 统一转给系统浏览器（第 271-274 行），复用即可。

**不引入 `app.isPackaged` 分支**。这是纯手动形态带来的额外收益：dev 下主动点一次「检查更新」，看到的是真实版本信息，不是噪音。因此 `electron-builder.yml` 第 5 行「全仓库没有 app.isPackaged 分支」那条记录得以保持。

**UI（只在「设置 → 关于」）**：复用 `about-section.tsx` 现有的 `.provider-row` / `.provider-meta` / `.mini-btn`，**不新增视觉规范，不改 DESIGN.md**。一行「更新」+ 状态文案（尚未检查 / 检查中 / 已是最新 / 新版本 vX.Y.Z 可用 / 检查失败原因）+ 按钮（「检查更新」，有新版本时换成「去下载」）。

失败**就地呈现 + 重试入口**，不用 toast —— `DESIGN.md §6` 明令「用 toast 承载需要重试的失败」是禁止项（第 346 行）。

## Impact

- Affected specs：**无**（新增能力，不改既有 spec 的任何结论）。与 `add-managed-runtimes` 的「安装包不含任何运行时载荷」口径**无冲突**：本 spec 不向安装包新增任何载荷，只改「包怎么出、出完放哪、同事怎么知道有新包」。
- Affected code / files：
  - 新增：`.github/workflows/release.yml`、`src/shared/update.ts`（+ `update.test.ts`）、`src/main/update-check.ts`、`scripts/gen-version-json.mjs`、`build/icon.ico`（用户提供）
  - 改造：`src/shared/ipc.ts`、`src/shared/bridge.ts`、`src/preload/index.ts`、`src/main/index.ts`、`src/renderer/settings/about-section.tsx`、`src/renderer/App.tsx`、`scripts/pack.mjs`、`electron-builder.yml`
  - 文档：`README.md`（打包分发那一行的现状描述）、`docs/试用前自查报告.md §三`（分发口径从「人工发 exe」改为「GitHub Releases + 关于页检查更新」）、新增一份给同事看的安装说明
- 不涉及：`src/core/**`、`src/daemon/**`、`src/documents/**`（本 spec 不碰 daemon 与文档流水线）、`resources/**` 的内容

## ADDED Requirements

### Requirement: 可重现的发版链路

系统 SHALL 通过 GitHub Actions 在 push `v*` tag 时构建 Windows 安装包并创建 GitHub Release，产物 SHALL 可通过仓库的 Releases 页面公开获取。

#### Scenario: 打 tag 自动出包

- **WHEN** 维护者把 `package.json` 的 version 改为 `0.1.1` 并 push tag `v0.1.1`
- **THEN** workflow 在 `windows-latest` 上完成构建，Release `v0.1.1` 中 SHALL 同时含 `JLC-Work-Setup-0.1.1.exe` 与 `version.json`

#### Scenario: tag 与版本号不一致时拒绝发版

- **WHEN** `package.json` 是 `0.1.1` 但 push 的 tag 是 `v0.1.2`
- **THEN** workflow SHALL 在构建前失败并报出两个版本号，SHALL NOT 产出任何 Release

#### Scenario: 门禁不过不发版

- **WHEN** `npm run check` 失败
- **THEN** workflow SHALL 失败，SHALL NOT 产出任何 Release

### Requirement: exe 身份信息正确

CI 产出的安装包 SHALL 带有应用图标与正确的产品名、版本号、公司名（exe 属性页可见）。

#### Scenario: CI 上启用 rcedit

- **WHEN** workflow 调用 electron-builder
- **THEN** SHALL 传入 `-c.win.signAndEditExecutable=true`；本机打包 SHALL 保持 `false`（本机 AV 拦截 rcedit）

### Requirement: 手动检查更新

系统 SHALL 在「设置 → 关于」提供「检查更新」入口，读取 `version.json` 与当前版本比对后如实呈现结果；系统 SHALL NOT 自动下载或自动安装任何更新。

#### Scenario: 有新版本

- **WHEN** release 里的 `version.json` 为 `0.1.2`、当前运行版本为 `0.1.1`，用户点「检查更新」
- **THEN** 关于页 SHALL 显示新版本号与「去下载」入口，点击 SHALL 用系统浏览器打开 Release 页面

#### Scenario: 已是最新

- **WHEN** `version.json` 的版本不高于当前版本，用户点「检查更新」
- **THEN** 关于页 SHALL 显示「已是最新」

#### Scenario: 检查失败

- **WHEN** 请求超时、离线、或 `/releases/latest` 返回 404（典型诱因：该 release 被标记为 prerelease）
- **THEN** 关于页 SHALL 就地显示失败原因与重试入口，SHALL NOT 显示「已是最新」，SHALL NOT 用 toast 承载

#### Scenario: 版本号比较的边界

- **WHEN** 比较 `0.1.9` 与 `0.1.10`、或 `0.2` 与 `0.10`
- **THEN** SHALL 按数字段逐段比较（`0.1.10 > 0.1.9`、`0.10 > 0.2`），SHALL NOT 按字符串比较

#### Scenario: 不自动检查

- **WHEN** 应用启动、或长时间运行
- **THEN** 系统 SHALL NOT 发起任何更新检查请求；只有用户点击「检查更新」才联网

## 已接受的风险

- **公开分发**：安装包对全世界可下载，而包内含 WorkBuddy 搬用资产（docx-engine、HTML 模板、design tokens、专家/编排文案）。`AGENTS.md §6` 的「正式上线前由专人做风险置换」因此**被提前暴露**。用户已知情接受。缓解：资产集中在 `resources/` 下且目录 README 已注明来源，届时替换文件即可，不动代码。
- **国内下载速度**：GitHub Releases 的 asset 下载在国内可能很慢甚至失败。手动下载形态下同事能自己重试，但推新版时一定会有同事下不动。
- **未签名 + 从互联网下载**：SmartScreen 拦截概率比从内网分发更高；国产杀软对 NSIS 也可能误报。
- **首次运行仍需联网**：docx 首次转换要 uv 装 Python 3.12 + PyPI 依赖；MCP 连接器要同事机器自备 Node。与本次改动无关，但必须在给同事的说明里写清楚。
- **纯手动 = 实际没人会点**：同事不去「设置 → 关于」就永远看不到新版本，推新版的最后一公里仍然靠你在群里喊。这是选定形态的固有代价，不是缺陷。

## 明确不做（本轮）

- 代码签名（没有证书）
- 自动下载 / 自动安装 / 静默升级（用户选了「只提示」）
- 灰度发布（prerelease 链路）、增量更新（blockmap）、更新失败回滚
- 国内镜像副本 / 加速下载
- 定时轮询与启动检查（用户选了「纯手动」）
- 把 `npm test` 作为发版门禁：`src/core/worktree.test.ts` 有 3 个既有失败（副本清理时序，见 `docs/试用前自查报告.md §一`），修完再加（见待办）

## 否决方案

> 按 `AGENTS.md §8`：被否掉的路与理由必须留档，避免同一决定被反复推翻。

**① electron-updater（自动下载 + 重启安装）—— 否，收益为 0。**
它能覆盖的真实场景只有「用户希望更新无感」，而用户明确选了「只提示、手动下载安装」。引入它要一并背起：`app-update.yml` 的生成与随包、blockmap 增量产物、`quitAndInstall` 与在途会话/定时任务的冲突处理、签名校验在未签名包上的行为差异，以及一次「下载到一半应用退出」的恢复路径。这些复杂度换不来任何用户想要的东西。

**② GitHub API 查最新版本（`/repos/.../releases/latest`）—— 否，有出口 IP 限流。**
无鉴权 API 是 60 次/小时/出口 IP；部门同事很可能同处一个出口 IP，按钮点得勤就会互相挤掉。`/releases/latest/download/<asset>` 是 CDN 重定向，**完全不占这个额度**，而 `version.json` 的生成成本只有一个几十字节的文件。纯手动模式下触发频率确实很低、很难真撞上限，但既然成本几乎为零，就没必要留这个约束。

**③ 用 electron-builder 的 `publish` provider 建 Release —— 否，要二次补传。**
它管不到 `version.json`，得再用第二个工具往同一个 Release 补文件，两个工具操作同一份远端状态容易出现「exe 上了、清单没上」的中间态，而那个中间态恰好会让同事的更新检查 404。`gh release create` 一条命令原子地做完，且本地/CI 都能跑同一条。

**④ 一次性把 `npm test` 也设为发版门禁 —— 否，当下会直接把发版链锁死。**
`src/core/worktree.test.ts` 有 3 个既有失败（非本 spec 引入）。先修再挂，顺序不能反；否则第一个 tag 就打不出包。

**⑤ 启动时自动检查 + 提示条 / 弹窗 —— 否，用户已定「只放关于页」。**
另外它也绕不开额外成本：提示条要新增一种全局视觉规范（现有 DESIGN.md 没有），模态会打断正在跑的任务，而 `DESIGN.md §6` 明确禁止用 toast 承载需要重试的失败——更新检查失败恰好是可重试的。

**⑥ 标记 release 为 prerelease 做灰度 —— 否（本轮）。**
`/releases/latest` 会跳过 prerelease，用它当灰度开关可行，但首批用户就是部门同事、规模够小，分组灰度的复杂度换不来收益。真要灰度时把 `gh release create` 加一个 `--prerelease` 即可，路径留着。

## 待办（本 spec 之外）

1. **WorkBuddy 资产风险置换**（`AGENTS.md §6`）—— 本 spec 让它从「上线前」变成「已经在公开分发」，优先级上升
2. 修 `src/core/worktree.test.ts` 的 3 个既有失败 → 修完后把 `npm test` 挂进发版门禁
3. 3 个 runner 层文件（`automation-runner.ts` / `subagent-runner.ts` / `member-runner.ts`）的直测缺口（既有，见 `docs/试用前自查报告.md §三`）
