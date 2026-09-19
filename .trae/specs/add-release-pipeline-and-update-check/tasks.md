# Tasks

- [ ] Task 1: 契约与纯函数（shared）
  - [ ] SubTask 1.1: `src/shared/update.ts`（新增）：`RELEASE_PAGE_URL`、
        `UPDATE_MANIFEST_URL`（`https://github.com/metrogg/kamibuddy/releases/latest/download/version.json`）、
        `compareVersions(a, b)`（三段数字逐段比较，缺失段补 0；不引 semver 依赖）、
        `UpdateCheckResult` 联合类型（`upToDate` / `available{latest}` / `failed{reason}`）。
        注释写清：为什么清单走 release asset 而不是 GitHub API（出口 IP 限流）
  - [ ] SubTask 1.2: `src/shared/update.test.ts`：边界用例 —— `0.1.0` vs `0.1.0`、
        `0.1.9` vs `0.1.10`、`0.2` vs `0.10`、段数不等（`0.1` vs `0.1.0`、`1` vs `1.0.1`）
  - [ ] SubTask 1.3: `src/shared/ipc.ts`：`INVOKE.updateCheck = "update:check"` +
        调用签名表一行（`{ args: []; result: UpdateCheckResult }`）
  - [ ] SubTask 1.4: `src/shared/bridge.ts`：`KamiBridge` 加
        `readonly checkUpdate: () => Promise<UpdateCheckResult>`
        （注释写明：手动触发、main 本地应答、不缓存不推送）
- [ ] Task 2: main 侧实现
  - [ ] SubTask 2.1: `src/main/update-check.ts`（新增）：`fetch` 清单（超时 5s）
        → 解析 JSON 取 `version` → 与 `app.getVersion()` 比对。
        必须把「网络失败/超时/404/JSON 非法」与「已是最新」区分开，
        分别落到 `failed{reason}` 与 `upToDate`；失败原因要能读懂（含 HTTP 状态码），
        不许吞成一句「检查失败」
  - [ ] SubTask 2.2: `src/main/index.ts`：注册 `ipcMain.handle(INVOKE.updateCheck, …)`
        （与 `globalShortcutStatus` 同层的「main 本地应答」通道）
  - [ ] SubTask 2.3: `src/preload/index.ts`：暴露 `checkUpdate`
        （薄转发，不加工；与既有 invoke 转发同形）
  - [ ] SubTask 2.4: 确认**没有**引入 `app.isPackaged` 分支（纯手动形态下不需要；
        `electron-builder.yml` 第 5 行记着「全仓库没有 app.isPackaged 分支」）
- [ ] Task 3: 关于页（renderer）
  - [ ] SubTask 3.1: `src/renderer/settings/about-section.tsx`：新增一行「更新」——
        版本号下方，复用 `.provider-row` / `.provider-main` / `.provider-name` /
        `.provider-meta` / `.bar-spacer` / `.mini-btn`，**不加新 CSS 类**
  - [ ] SubTask 3.2: 本地状态机 `idle → checking → (upToDate | available | failed)`；
        `checking` 期间按钮禁用并显示「检查中」；`available` 时按钮换「去下载」
        （`window.open(RELEASE_PAGE_URL)` 复用 `setWindowOpenHandler` → `shell.openExternal`）
  - [ ] SubTask 3.3: 失败就地呈现原因 + 「重试」入口；**不得**改用 toast
        （`DESIGN.md §6` 第 346 行：用 toast 承载需要重试的失败是禁止项）
  - [ ] SubTask 3.4: `src/renderer/App.tsx`：把 `checkUpdate` 传给 `AboutSection`
  - [ ] SubTask 3.5: 视觉自查：改完跑一遍 `DESIGN.md §9` 的 CR 自查清单
        （本轮不应出现任何新增硬编码视觉值）
- [ ] Task 4: 打包外观（图标 + rcedit）
  - [ ] SubTask 4.1: 新建 `build/` 目录并放入 `icon.ico`（**需用户提供**，256×256 多尺寸）
  - [ ] SubTask 4.2: 删掉 `electron-builder.yml` 第 14 行「目录暂不存在：无 build/icon.ico
        时用默认图标并告警（已定：图标后补）」的过期注释
  - [ ] SubTask 4.3: `scripts/pack.mjs`：加 env 开关（如 `KAMIBUDDY_RCEDIT=1`）
        控制是否追加 `-c.win.signAndEditExecutable=true`；开关处注释写明
        「本机被企业 AV 拦是唯一原因，别在无 AV 干扰的机器上关它」
  - [ ] SubTask 4.4: 本机实跑 `npm run dist:dir`，确认 rcedit 关闭时链路仍通
        （本机 AV 阻拦是既有事实，本机验证不了图标；只验证不回归）
- [ ] Task 5: 发版链路（CI）
  - [ ] SubTask 5.1: `scripts/gen-version-json.mjs`（新增）：写
        `release/version.json`（`{"version":"<package.json version>"}`，单行）；
        本地与 CI 共用同一份，避免两处口径
  - [ ] SubTask 5.2: `.github/workflows/release.yml`（新增）：触发 `push tag v*`，
        `windows-latest`，`permissions: contents: write`；
        步骤 = checkout → setup-node 22（cache npm）→ `npm ci` →
        `npm run check`（门禁）→ tag/version 一致性断言 →
        设两个官方镜像 env（`ELECTRON_MIRROR` / `ELECTRON_BUILDER_BINARIES_MIRROR`）
        + `KAMIBUDDY_RCEDIT=1` → `npm run dist`（走 pack.mjs，含 fetch:uv 与 EPERM 重试）
        → `node scripts/gen-version-json.mjs` →
        `gh release create "v$VER" release/JLC-Work-Setup-$VER.exe release/version.json --generate-notes`
  - [ ] SubTask 5.3: 断言失败路径真会失败 —— 先故意用一个不匹配的 tag 跑一次，
        确认 workflow 变红（`AGENTS.md §8`：不会变红的护栏只是装饰），再删掉这次 run
  - [ ] SubTask 5.4: **需用户执行**：在 `package.json` 为 `0.1.0` 的状态下 push tag `v0.1.0`
        （仓库当前零 tag，这是首个），确认 Release 里同时有
        `JLC-Work-Setup-0.1.0.exe` 与 `version.json`
  - [ ] SubTask 5.5: 下载 CI 产物实装一次，确认：exe 属性页产品名/版本/公司名正确、
        图标正确、`app.asar.unpacked` 里 koffi 等 `.node` 仍在、daemon 能连上
        （`docs/试用前自查报告.md §三` 记录过 koffi 解包失败会报「不是有效的 Win32 应用」）
- [ ] Task 6: 更新检查端到端验收
  - [ ] SubTask 6.1: 装 `0.1.0` → 造一个更高版本的 release（可用临时 tag）→
        点「检查更新」→ 显示「新版本 vX.Y.Z 可用」→ 点「去下载」打开正确页面
  - [ ] SubTask 6.2: 反向断言（最容易写反的两条）：release 版本不高于当前时
        必须显示「已是最新」；断网时必须显示失败原因，**不得**显示「已是最新」
  - [ ] SubTask 6.3: 启动不联网断言：启动应用后不做任何点击，确认**零**请求
        （无启动检查、无轮询）
  - [ ] SubTask 6.4: `npm run typecheck && npm run check:deps` + `npm test`，附实跑输出
- [ ] Task 7: 文档与交付说明
  - [ ] SubTask 7.1: `README.md` 第 32 行「打包分发」行更新为现状
        （Releases 地址 + 打 tag 发版 + 关于页检查更新；签名仍未做）
  - [ ] SubTask 7.2: 新增给同事看的安装说明（放 `docs/`）：下载地址、
        SmartScreen「更多信息 → 仍要运行」、国产杀软可能误报、
        **docx 首次转换需联网**、**MCP 连接器需自备 Node**、
        数据位置（`~/.kamibuddy` 配置与会话 / `~/KamiBuddy` 产物）、卸载保留数据、
        升级需先退出应用
  - [ ] SubTask 7.3: `docs/试用前自查报告.md §三` 的分发口径从「人工发 exe」
        更新为「GitHub Releases + 关于页手动检查更新」，并标注本 spec 路径
