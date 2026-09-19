# 应用图标与包体积裁剪 Spec

> 决策记录，写完即冻结（`AGENTS.md §8`）。结论要变另写一份并与本文件互相链接。
>
> **本 spec 取代** `add-release-pipeline-and-update-check/spec.md` 的「发版链路（CI）」与
> 「更新检查」两节 —— 那两节已作废（原因见下「用户决策 ①」）；该文件的「图标」一节由本文件承接。

## Why

2026-09-19 决定把应用发给部门几位同事使用。此前安装包「能出但不可交付」：

1. **exe 没有身份信息**：`electron-builder.yml` 里 `signAndEditExecutable: false`，
   所以产品名/版本号/公司名全是 Electron 默认值，图标也是默认的。同事在属性页或任务管理器里
   认不出这是什么。
   这条 `false` 的由来是一份当时的实测：`electron-builder.yml` 原文记着
   「本机（企业 AV 实时扫描）拦「新建 exe 的资源改写」：rcedit 对刚落盘的 JLCWork.exe
   写资源必报 UNKNOWN，重试无效（2026-09-17 实测）」。
2. **包体过大**：实测 win-unpacked 1234.7 MB。
3. **本机打包链本身是坏的**：`electron-builder` 根本没装在 `node_modules` 里，
   `npm run dist` 跑不起来。

## 用户决策（2026-09-19）

| # | 决定点 | 选定 |
| --- | --- | --- |
| ① | 发版链路 / 自动更新 | **都不做**。只给部门几位同事用，手动打包（`npm run dist`）+ 手动把 exe 发出去即可 |
| ② | 应用图标 | 用用户提供的 logo（`buddy.png`，1024×1024） |
| ③ | 代码签名 | **不做**（没有证书） |
| ④ | 体积裁剪 | **只做两项低风险的**（esbuild 非 win32-x64、Electron locales）；monaco/pdfjs/echarts 等大依赖本轮不评估 |
| ⑤ | 安装目录名 | **接受 `kamibuddy`**（见「否决方案 ②」） |

## What Changes（均已落地）

1. **接入图标**：新增 `build/icon.png`（源图，1024×1024）；`electron-builder.yml` 加
   `win.icon: build/icon.png`。用 PNG 源图而非 `.ico`，是为了让图标只有一个真源
   （改图标只改这一张图，多尺寸 .ico 由 electron-builder 自行生成）。
2. **重开资源改写**：`win.signAndEditExecutable: true`，并改写了那段过期注释。
3. **体积裁剪 ①**：`files` 加否定模式，排除 `@esbuild` 的非 win32-x64 平台目录。
4. **体积裁剪 ②**：`electronLanguages: [zh-CN, en-US]`。
5. **修掉 `npm run dist` 冲掉受版本控制文件的问题**（见「顺带修掉的真问题」）。
6. **文档**：本 spec + `docs/同事安装说明.md`；`README.md`、`docs/试用前自查报告.md §三`
   的分发口径与安装路径跟随更新。

## 实测证据

`AGENTS.md §8`「证据要打真入口路径」——以下全部是实跑结果，不是推断。

### 1. 「AV 拦 rcedit」这条结论前提已消失（推翻，不是绕过）

根因不是 AV，是**工具换掉了**：`node_modules/app-builder-lib@26.15.3/package.json` 的
`dependencies` 里是纯 JS 的 **`resedit`**，**`app-builder-bin` 已不在依赖表中**
（`app-builder-bin` 承载的 `rcedit` 正是原来那个原生工具）。实跑 `npm run dist:dir`
未见任何 UNKNOWN 错误，日志里关键行是：

```
updating asar integrity executable resource  executablePath=release\win-unpacked\JLCWork.exe
```

### 2. 版本信息与图标确实写进了 exe

```
ProductName     : 嘉立创Work
CompanyName     : 嘉立创
FileDescription : 嘉立创Work
FileVersion     : 0.1.0
ProductVersion  : 0.1.0.0
```

图标对照（`Icon.ExtractAssociatedIcon` 各存 32×32 PNG 后比哈希，两者不同即写入生效）：

```
kami-icon.png             BCB839830B76EFC8043C8EE7F757B8731D79E216157FF8E3D5893CCBC0EB0174
electron-default-icon.png 74D479EEB7E2C326A37C286D85F4040944862962F9B10F18BDD6B520C98DB4F4
```

### 3. 体积裁剪实测

| 指标 | 裁剪前 | 裁剪后 |
| --- | --- | --- |
| 安装包 `JLC-Work-Setup-0.1.0.exe` | — | **211.3 MB** |
| win-unpacked 总计 | 1234.7 MB | **915.9 MB** |
| `resources/app.asar` | 466.6 MB | 426.7 MB |
| `resources/app.asar.unpacked` | 330.7 MB | 98.9 MB |
| `locales` | 48.3 MB（约 50 个 .pak） | 1.1 MB（仅 `en-US.pak` + `zh-CN.pak`） |

裁剪前 `app.asar` 那 466 MB 几乎全是 pi SDK 内嵌的全平台 esbuild
（`@earendil-works/pi-coding-agent/node_modules/@esbuild/{darwin,linux,android,freebsd,
netbsd,openbsd,sunos,aix,openharmony,…}` + 3 个 13 MB 的 `.wasm`）。

### 4. 安装实测（静默安装）

```
安装目录 : C:\Users\wzd\AppData\Local\Programs\kamibuddy
总大小   : 916.1 MB
ProductName : 嘉立创Work / CompanyName : 嘉立创 / FileVersion : 0.1.0
locales  : 2 个
koffi.node: True
uv.exe   : True
桌面快捷方式 / 开始菜单快捷方式 : 均创建
卸载器   : Uninstall JLCWork.exe
```

`koffi.node` 的实际路径是 `resources\app.asar.unpacked\node_modules\@koromix\
koffi-win32-x64\win32_x64\koffi.node` —— **koffi 3.3.0 把预编译二进制拆到了平台包
`@koromix/koffi-win32-x64`**，所以按老记录去 `app.asar.unpacked/node_modules/koffi`
里找 `.node` 会误判成「解包没生效」。smartUnpack 是正常的。

## 未验证 / 已知边界

- **「安装版能真跑起来」本轮未验到。** 启动后被单实例锁挡下：`src/main/index.ts` 的
  `app.requestSingleInstanceLock()`（注释：「多实例会争抢同一份会话文件」），而验收时
  本机有一个 dev 实例在跑，两者共用同一份 userData，安装版一启动即 `app.quit()`。
  这是**设计使然**，不是包的缺陷；但因此本 spec **不宣称「装上去能用」**。
  待办：关掉 dev 实例后双击快捷方式，跑一遍 `docs/试用前自查报告.md §四` 的手动清单。
- 图标源图是**白底圆角方块**（非透明底），在深色任务栏/深色桌面上会呈现为一块白色圆角瓦片。
  要透明底需重新导出源图。
- 首次运行仍会被 SmartScreen 拦（未签名），且**首次 docx 转换需联网**、
  **MCP 连接器需同事机器自备 Node** —— 与本次改动无关，但已写进同事安装说明。

## 已接受的风险

- **公开分发**：仓库是 public，安装包含 WorkBuddy 搬用资产，`AGENTS.md §6` 的
  「正式上线前由专人做风险置换」被提前暴露。风险置换仍待办。
- **手动分发**：没有版本清单、没有更新提示，推新版只能靠人在群里喊，且没有任何
  机制能知道同事装的是哪一版。
- **体积仍有 916 MB**（安装包 211 MB）：大头是 pi SDK 与 Electron 自身，本轮未再动。

## 明确不做（本轮）

- 代码签名（没有证书）
- CI 自动发版、自动更新/更新检查（用户决策 ①，详见被取代的 spec）
- 逐项评估 monaco / pdfjs / echarts / react-pdf 的裁剪（会牵涉功能取舍，另起一轮）
- 自定义 NSIS 脚本强推中文安装目录（见否决方案 ②）
- 改 `package.json` 的 `name`（见否决方案 ③）

## 否决方案

> 按 `AGENTS.md §8`：被否掉的路与理由必须留档，避免同一决定被反复推翻。

**① GitHub Actions 自动发版 + electron-updater/GitHub Releases 更新检查 —— 否（用户决策）。**
规模不匹配：受众是部门几位同事，一次发版的实际动作是「出个 exe、群里发一下」，
而 CI 那份 spec 要付的是 workflow 调试、Secrets、tag/版本一致性断言、更新清单托管、
失败路径验收这一整套成本。已写好的
`add-release-pipeline-and-update-check/spec.md` 标为「发版链路 + 更新检查两节作废」，
其中的取舍分析（为什么不用 GitHub API 的 60 次/小时出口 IP 限流、为什么不复用
electron-builder 的 publish provider）仍然有效留档，规模变大时可原地取回。

**② 自定义 NSIS 脚本把安装目录强改中文（`嘉立创Work`）—— 否，复杂度与风险都不划算。**
机制上确认过：NSIS 的 per-user 安装目录是 `$LocalAppData\Programs\${APP_FILENAME}`
（`app-builder-lib/templates/nsis/multiUser.nsh` 第 47 行），而 `APP_FILENAME` 来自
`appInfo.sanitizedName = sanitizeFileName(metadata.name)`
（`app-builder-lib/out/appInfo.js` 第 115-125 行 与 `get name()` 用 `metadata.name`）
—— 取的是 **npm 包名**，不是 `productName`，且 npm 包名只能是小写 ASCII。
要中文只能塞自定义 NSIS include 去改 `$INSTDIR`。收益是「一个同事基本不会打开的目录名」，
代价是中文安装路径这个已知的踩坑方向（本项目在中文路径上已经踩过一次），不值。

**③ 改 `package.json` 的 `name`（如 `jlcwork`）让目录名好看些 —— 否，连带面大于收益。**
它会一并改掉 Electron 的 userData 路径、单实例锁的归属目录与 `updaterCacheDirName`；
而这些路径目前是与 dev 实例共享的（本 spec 的「未验证」一节正是靠这一点才发现的）。
为观感去动运行期路径，风险与收益不成比例。

**④ 顺手把 monaco / pdfjs / echarts / react-pdf 也裁掉 —— 否（本轮）。**
这几项合计可能再省 150 MB 量级，但每一项都会牵涉功能取舍（代码高亮语言数、
PDF 预览能力、图表能力），需要单独一轮评估与用户拍板。混在「接图标」这一次改动里
会让改动关注点不单一（`AGENTS.md §8`）。

**⑤ 杀掉 dev 实例来验安装版 —— 否，绝不。**
那个 dev 会话里有 43 轮的进行中工作（EDA 设计稿）。验收可以等，工作丢了不行。

## 顺带修掉的真问题：`npm run dist` 会冲掉受版本控制的 README

`scripts/fetch-uv.mjs` 原先无条件把 uv 的来源说明写进 `resources/bin/README.md`，
而那个文件是**受版本控制的手写文件**，记录 `fd.exe` / `rg.exe` 的来源、版本、sha256
与许可 —— 正是 `AGENTS.md §6`「已搬用资产在目录 README 注明来源」的载体与许可义务凭据。
由于 `npm run dist` 的第一段就是 `fetch:uv`，**每次发版都会把那 58 行记录冲成一张 uv 便条**
（本轮实跑 `npm run dist` 时撞到）。

修法：改写到独立文件 `resources/bin/UV-NOTICE.md`，并在代码里写明为什么刻意不用
`README.md`。`README.md` 已恢复到 HEAD 字节（58 行，sha256
`D7C1B52662844442FED234CB692E04A1EEEDC11C3F2133CDDD52031B0A2E4A18`），并实跑
`node scripts/fetch-uv.mjs --force` 复验：跑完 `git status` 对该文件为空、哈希未变，
`UV-NOTICE.md` 已生成。

> 行数以 `git diff` 的 `@@ -1,58 +1,4 @@` 为准（58）。注意 `Measure-Object -Line`
> 会跳过空行、给出 44，别用那个数对账。

## 待办

1. **验收安装版**（关掉 dev 实例后）—— 本 spec 唯一缺的证据
2. **WorkBuddy 资产风险置换**（`AGENTS.md §6`）—— 公开分发让它优先级上升
3. `src/core/worktree.test.ts` 的 3 个既有失败（既有问题，见 `docs/试用前自查报告.md §一`）
4. 若要透明底图标，重新导出 `build/icon.png` 的源图
5. 需要更好看的安装目录名时，走「另起一轮评估改 `name`」（否决方案 ③ 有代价清单）
