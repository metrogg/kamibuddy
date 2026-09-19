# Tasks

> 本 spec 的工作在写文档前已随实测一起完成，故全部勾选并附实跑结果。
> 唯一未完成项是「验收安装版」，见末尾。

- [x] Task 1: 修好本机打包链
  - [x] SubTask 1.1: 补装缺失依赖 —— `npm install` 补了 220 个包
        （`electron-builder` 此前根本不在 `node_modules` 里，`npm run dist` 跑不起来）
  - [x] SubTask 1.2: 确认 `package-lock.json` 的变化是校正而非破坏：
        `jszip` 在 `package.json` 里已在 `dependencies`，锁文件仍是旧的 `devDependencies`
        位置，`npm install` 把它同步了；其余是 `peer` 标记归位
- [x] Task 2: 接入图标与资源改写
  - [x] SubTask 2.1: 新建 `build/icon.png`（源图 1024×1024，来自用户提供的 `buddy.png`）
  - [x] SubTask 2.2: `electron-builder.yml` 加 `win.icon: build/icon.png`
  - [x] SubTask 2.3: `signAndEditExecutable` 改回 `true`，并改写那段「本机 AV 拦 rcedit」
        的过期注释（实测已推翻：`app-builder-lib@26.15.3` 用纯 JS 的 `resedit`，
        `app-builder-bin` 已不在依赖表）
  - [x] SubTask 2.4: 实跑 `npm run dist:dir`，确认 `updating asar integrity executable
        resource` 出现且无 UNKNOWN 错误
- [x] Task 3: 体积裁剪
  - [x] SubTask 3.1: `files` 加否定模式排除 `@esbuild` 的非 win32-x64 平台目录
        （pi SDK 在自己嵌套的 `node_modules/@esbuild/` 里带了全平台二进制）
  - [x] SubTask 3.2: `electronLanguages: [zh-CN, en-US]`
  - [x] SubTask 3.3: 实测：win-unpacked 1234.7 → 915.9 MB；locales 48.3 → 1.1 MB；
        app.asar.unpacked 330.7 → 98.9 MB
- [x] Task 4: 出 NSIS 安装包并实装
  - [x] SubTask 4.1: `npm run dist` 出 `release/JLC-Work-Setup-0.1.0.exe`（211.3 MB），
        日志以 `[pack] 打包完成` 结束
  - [x] SubTask 4.2: 静默安装，验安装目录、总大小、`ProductName`/`CompanyName`/`FileVersion`、
        `locales` 数量、`koffi.node`、`uv.exe`、桌面与开始菜单快捷方式、卸载器
  - [x] SubTask 4.3: 从 `JLCWork.exe` 提取图标存 32×32 PNG，与 Electron 默认图标比哈希，
        确认两者不同（图标确实写入）
- [x] Task 5: 修掉 `npm run dist` 冲掉受版本控制 README 的问题
  - [x] SubTask 5.1: `scripts/fetch-uv.mjs` 改写到 `resources/bin/UV-NOTICE.md`，
        并写明为什么刻意不用 `README.md`
  - [x] SubTask 5.2: `resources/bin/README.md` 恢复到 HEAD 字节
        （58 行，sha256 `D7C1B52662844442FED234CB692E04A1EEEDC11C3F2133CDDD52031B0A2E4A18`）
  - [x] SubTask 5.3: **实跑 `node scripts/fetch-uv.mjs --force` 证明修复**：
        跑完 `git status` 对 `README.md` 为空（哈希不变），`UV-NOTICE.md` 已生成
- [x] Task 6: 文档
  - [x] SubTask 6.1: 本 spec（`add-app-icon-and-package-slimming/spec.md`）
  - [x] SubTask 6.2: `add-release-pipeline-and-update-check/spec.md` 顶部加「部分作废」状态块
  - [x] SubTask 6.3: `docs/同事安装说明.md`
  - [x] SubTask 6.4: `README.md` 的「打包分发」行、`docs/试用前自查报告.md §三`
        （含安装目录路径纠错：`%LOCALAPPDATA%\Programs\kamibuddy`，不是 `嘉立创Work`）
- [ ] Task 7: 验收安装版（**待用户执行**）
  - [ ] SubTask 7.1: 关掉本机 dev 实例（否则被 `app.requestSingleInstanceLock()` 挡下），
        双击桌面「嘉立创Work」或开始菜单入口
  - [ ] SubTask 7.2: 过一遍 `docs/试用前自查报告.md §四` 的手动测试清单
  - [ ] SubTask 7.3: 确认无问题后，把 `release/JLC-Work-Setup-0.1.0.exe` 发给同事，
        附 `docs/同事安装说明.md`
