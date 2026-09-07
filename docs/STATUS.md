# 当前进度

> 最后更新：2026-09-07（D2 完成）
> 新接手请按顺序读：本文 → [ARCHITECTURE.md](ARCHITECTURE.md) → [../AGENTS.md](../AGENTS.md)

## 一句话现状

骨架已跑通并通过全部验证；**尚未接入真实会话**，界面能开、能发消息，但发出去会得到明确报错「会话尚未接入（D3）」。
三个架构风险已全部验证关闭，技术路径无拦路虎。

## 项目背景

| 项 | 内容 |
|---|---|
| 目标 | 基于 [pi agent harness](https://pi.dev) 做办公 AI Agent 桌面端，对标腾讯 WorkBuddy |
| 交付形式 | 直接给部门同事试用评价 |
| 期限 | 两周（约 2026-09-21） |
| 范围策略 | **深度优先**：WorkBuddy 功能清单当规格书，深度优先只决定做的顺序，不缩小最终范围 |
| 首个纵切片 | 文档生成（职场文档 + 联网调研报告） |
| 参考物 | WorkBuddy 安装目录 `C:\Program Files\WorkBuddy\`，逆向素材在 `_analysis\`；分析笔记在 `docs/workbuddy分析/` |

范围取舍与理由见 ARCHITECTURE.md §1，合规红线见 AGENTS.md §6（**机制可学，文字必须自己写**）。

## 已完成

### D1 · pi 能力边界验证

结论汇总在 ARCHITECTURE.md §5。三个最高风险项的结果：

- **`ctx.ui` 能否路由到 Electron**（架构命门）→ **通过**。
  `AgentSession.bindExtensions({uiContext, mode:"rpc"})` 可注入自建实现。
  边界：`confirm`/`select`/`input`/`notify` 可跨进程；`custom()`/`setFooter()` 等需要真 TUI 对象，
  复杂交互（带工具入参的权限面板）走自有 IPC 通道。
- **原生模块 ABI** → **通过**。三个 `.node` 全部基于 Node-API（ABI 稳定），Electron 内实测无错误。
  原「全部懒加载」假设已证伪：clipboard 在 import 期即加载。Node sidecar 退路不再需要。
- **Windows shell** → pi 找不到 bash 会**直接抛异常**（非降级）。已定策略：文档流水线全 Node 实现，
  `shellPath` 留配置位（ARCHITECTURE.md §4.4）。

另确认：pi 原生支持 Agent Skills 标准（WorkBuddy 的渐进式披露架构可近乎原样搬）；
内置工具仅 8 个；WebFetch / WebSearch / 权限判定链 / MCP 均需自研。

### D2 · Electron 骨架 + IPC 全链路

真机验证通过，日志中 `← session:snapshot` 证明请求走完
`renderer → preload → main → daemon` 全程。

```
typecheck   通过
check:deps  11 个文件，依赖方向合规
test        11 passed
smoke:sdk   3/3
真机运行     daemon 在 utilityProcess 内加载 pi SDK 成功
```

## 仓库地图

```
docs/
  STATUS.md            ← 本文，当前进度
  ARCHITECTURE.md      架构 + 8 条决策记录 + 十天计划
  workbuddy分析/        逆向调研笔记（仅参考，勿抄文字）
AGENTS.md              开发约定（依赖方向、禁 shell、能力即数据…）

src/shared/            零依赖，谁都可以 import
  session-events.ts    会话领域事件 —— renderer 唯一认识的事件类型
  ipc.ts               IPC 通道名 + payload 契约（唯一约定来源）
  daemon-protocol.ts   main↔daemon 的帧协议
  bridge.ts            preload 暴露给 renderer 的接口

src/main/index.ts      Electron 主进程：窗口 / CSP / utilityProcess 托管 / 哑转发
src/preload/index.ts   白名单桥，通道名不泄漏到 renderer
src/daemon/index.ts    业务进程（utilityProcess），会话编排将落在这里
src/renderer/
  App.tsx              对话界面
  conversation.ts      事件流 → 可渲染视图（纯函数，可单测）
  conversation.test.ts 11 个用例

scripts/
  smoke-pi-sdk.ts            pi SDK 冒烟（原生模块观测）
  check-dependency-rules.ts  依赖方向机械校验
  run-electron.mjs           启动包装器（剔除 IDE 注入的环境变量）
```

## 怎么跑

```bash
npm install          # 首次；electron 二进制若缺失见下方「已知坑」
npm run dev          # 开发（含热更新）
npm start            # 构建产物预览
npm run check        # typecheck + 依赖方向
npm test             # 单元测试
npm run smoke:sdk    # pi SDK 冒烟
```

**必须用 `npm run dev` / `npm start`，不要直接 `npx electron .`** —— 原因见下。

## 已知坑

### IDE 注入 `ELECTRON_RUN_AS_NODE=1`

Electron 系 IDE（Trae CN、VS Code、Cursor…）本身是 Electron 应用，会给集成终端注入该变量，
使 Electron 二进制退化成普通 Node —— 没有 `app`、没有 `BrowserWindow`。

判据：`npx electron --version` 打印 Node 版本（`v24.20.0`）而非 Electron 版本（`v44.2.0`）。

已由 `scripts/run-electron.mjs` 处理，`npm run dev` / `npm start` 自动剔除。

### 构建产物必须是 `.mjs`

Electron 的 ESM 主进程按扩展名判断模块类型。electron-vite 只在单入口时自动加 `.mjs`，
本项目双入口（`index` + `daemon`）会退回 `.js`。已在配置里显式指定。

**上面两个坑的报错信息完全相同**，极易误判：

```
SyntaxError: The requested module 'electron' does not provide an export named 'BrowserWindow'
```

### electron 二进制可能缺失

若用了 `--ignore-scripts`，postinstall 不跑，`node_modules/electron/dist/electron.exe` 不存在。补下载：

```bash
cd node_modules/electron && ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" node install.js
```

### 依赖版本锁定原因

`@vitejs/plugin-react` 必须停在 **5.2.0**：6.x 要求 `vite@^8`，
而 `vitest@3.2.4` 与 `electron-vite@5.0.0` 只支持到 `vite@^7`。装最新版会 ERESOLVE 冲突。

## 下一步

| 天 | 内容 |
|---|---|
| **D3** | 工具调用卡片渲染 + 权限确认弹窗（`uiContext` 路由落地）+ 接入真实会话 |
| D4-5 | 三模式（工具白名单 + 提示片段组合）+ 提示词模板 + 技能加载 |
| D6-8 | 文档纵切片：HTML 流水线、体裁模板、design token、ECharts、导出、预览面板 |
| D9 | 联网工具（WebFetch / WebSearch）+ 记忆 |
| D10 | 打包、修 bug、演示脚本与交付文档 |

D3 起 `src/core/`（pi SDK 适配层）与 `src/extensions/`（自定义工具 / 权限门 / 模式）落地。
这两层目前是空的 —— pi 类型只允许出现在这里，不许流到 renderer（AGENTS.md §1.2，`check:deps` 会拦）。

## 尚未做的事

- git 未提交（当前 10 个未跟踪文件）
- 未配置模型 API Key —— 接入会话时需要
- 打包分发（electron-builder）未配置
