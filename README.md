# KamiBuddy

基于 [pi agent harness](https://pi.dev) 的办公 AI Agent 桌面端（Electron），对标腾讯 WorkBuddy。

> 内部试水项目：两周内交付一个能给部门同事直接试用的版本。
> 本 README 只负责「这是什么、怎么跑起来」。架构决策见
> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，开发约定见 [AGENTS.md](AGENTS.md)。

## 当前能力

| 能做       | 说明                                              |
| -------- | ----------------------------------------------- |
| 真实对话     | 流式输出、思考内容展示、中断生成                                |
| 配置模型     | 内置 40 家服务商 / 1354 个模型（DeepSeek、智谱、Kimi 等国内可直连），界面填 Key 即用 |
| 自定义服务商   | 自建网关 / 本地模型（Ollama 等），密钥存本机凭据文件（0600）           |
| 工具调用可视化  | 折叠卡片，状态点区分执行中 / 成功 / 失败，写文件实时显示增删行数             |
| 权限拦截     | 三档预设（只读 / 默认权限 / 允许完全访问），目录外弹窗确认，凭据目录一律拒读写      |
| 联网       | 搜索 + 抓取网页正文（需在设置里配一个搜索服务商）                      |
| 文档读取     | PDF / Word / Excel / PPT / ODF 拖进输入框即可读，长文档截断后可续读   |
| 会话管理     | 多任务并发、历史恢复、重命名、删除、导出 HTML                       |
| 产物交付与预览  | 显式交付产物 + 右侧面板多格式预览（HTML 活预览 / Office / PDF / 代码） |
| 定时任务     | 定时自动跑任务，管理页可查运行记录                               |
| 子代理      | 把独立的子任务派给子代理，隔离上下文执行后回传结果                       |
| 模式系统     | 场景（办公）× 交互（创作 / 问答 / 规划）两轴，工具白名单与提示词随模式切换       |
| MCP 连接器  | 手动配置 MCP server，其工具以 `mcp__server__tool` 注入对话   |

## 还没做的

| 项     | 说明                                |
| ----- | --------------------------------- |
| 文档生成  | docx / PDF / 报告的生成流水线尚未开工，这是下一步的主要工作 |
| 打包分发  | 还不能双击安装，目前只能按下面的方式跑源码             |
| 记忆    | 「以后周报都用这个格式」这类跨会话偏好还记不住           |

## 快速开始

环境要求：**Node ≥ 22.19**（建议 24）、Windows 10/11（开发即在 Windows 上，未验证 macOS/Linux）。

```bash
npm install
npm run dev      # 开发模式（含热更新）
```

第一次启动后：

1. 点左下角 **设置** 图标
2. 给任一服务商填 API Key（国内网络推荐 DeepSeek / 智谱，pi 内置、填 Key 即用）
3. 选一个模型，回首页发一句话

生成的文件落在 **`~/KamiBuddy`**（会话工作目录），配置与凭据在 **`~/.kamibuddy`**。
两者刻意分开：配置是程序的东西，产物是用户的东西，混放容易被误删。

## 常用命令

```bash
npm run dev            # 开发（含热更新）
npm start              # 构建产物预览
npm run check          # 类型检查 + 依赖方向校验
npm test               # 单元测试
npm run smoke:session  # 会话构造冒烟（不联网、不耗额度）
npm run smoke:sdk      # pi SDK 冒烟
```

> **必须用 `npm run dev` / `npm start`，不要直接 `npx electron .`。**
> Electron 系 IDE（Trae、VS Code、Cursor…）会给集成终端注入 `ELECTRON_RUN_AS_NODE=1`，
> 让 Electron 退化成普通 Node——没有 `app`、没有 `BrowserWindow`，报错极具误导性。
> 包装脚本会自动剔除该变量。

## 目录结构

```
src/
  shared/      类型 + IPC 契约。零依赖，谁都可以 import（含 daemon 与 renderer 共用的会话 reducer）
  core/        pi SDK 适配层 —— pi 的类型止步于此，不许流向 UI
  extensions/  pi 扩展：权限门等。新增工具必须在此登记权限策略
  daemon/      业务进程（Electron utilityProcess）：会话编排、设置、审批
  main/        Electron 主进程：窗口 / CSP / 进程托管，不解释业务 payload
  preload/     白名单桥，通道名不泄漏到 renderer
  renderer/    React 界面
resources/     场景 / 模式 / 子代理 / 技能 —— 能力是数据，不是代码，加一个目录就加一个能力
docs/          架构决策、MCP 说明、WorkBuddy 逆向调研笔记
scripts/       冒烟测试、依赖方向校验、启动包装器
```

依赖方向单向流动，`npm run check:deps` 机械校验。改架构前先读
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 的决策记录 —— 每条都写了为什么这么定、否掉了什么。

## 文档索引

| 文档                                           | 内容                                         |
| -------------------------------------------- | ------------------------------------------ |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架构与决策记录：每条都写了为什么这么定、否掉了什么                 |
| [docs/workbuddy对齐清单.md](docs/workbuddy对齐清单.md) | 对标 WorkBuddy 的能力对齐清单，189 条逐项可勾选            |
| [docs/mcp-connector.md](docs/mcp-connector.md) | MCP 连接器的使用与配置说明                           |
| [AGENTS.md](AGENTS.md)                       | 开发约定（人和 AI 共同遵守）                           |
| [docs/workbuddy分析/](docs/workbuddy分析/)       | WorkBuddy 逆向调研笔记（内部参考）                     |
