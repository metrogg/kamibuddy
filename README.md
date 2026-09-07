# KamiBuddy

基于 [pi agent harness](https://pi.dev) 的办公 AI Agent 桌面端（Electron），对标腾讯 WorkBuddy。

> 内部试水项目：两周内交付一个能给部门同事直接试用的版本。
> 进度与任务清单一律看 [docs/](docs/)，本 README 只负责「这是什么、怎么跑起来」。

## 当前能力

| 能做 | 说明 |
|---|---|
| 真实对话 | 流式输出、思考内容展示、中断生成 |
| 配置模型 | 内置 40 家服务商 / 1354 个模型（DeepSeek、智谱、Kimi 等国内可直连），界面填 Key 即用 |
| 自定义服务商 | 自建网关 / 本地模型（Ollama 等），密钥存本机凭据文件（0600） |
| 工具调用可视化 | 折叠卡片，状态点区分执行中 / 成功 / 失败 |
| 权限拦截 | 工作目录内放行、目录外弹窗确认、配置目录一律拒写 |
| 模式系统 | 场景（办公/代码/设计）× 交互（创作/问答/规划/专家）两轴，界面已就位 |

| 还不能 | 计划 |
|---|---|
| 模式切换不改变提示词与工具集 | [ROADMAP](docs/ROADMAP.md) T1（进行中） |
| 联网（搜索 / 抓网页） | T3 |
| 多会话 / 历史恢复 | T4 |
| 文档生成（docx / PDF / 报告） | T11（价值主菜） |

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
> Electron 系 IDE 会给终端注入 `ELECTRON_RUN_AS_NODE=1`，让 Electron 退化成普通 Node，
> 报错极具误导性。包装脚本会自动剔除，详见 [docs/STATUS.md](docs/STATUS.md) 的「已知坑」。

## 目录结构

```
src/
  shared/      类型 + IPC 契约。零依赖，谁都可以 import（含 daemon 与 renderer 共用的会话 reducer）
  core/        pi SDK 适配层 —— pi 的类型止步于此，���流向 UI
  extensions/  pi 扩展：权限门等。新增工具必须在此登记权限策略
  daemon/      业务进程（Electron utilityProcess）：会话编排、设置、审批
  main/        Electron 主进程：窗口 / CSP / 进程托管，不解释业务 payload
  preload/     白名单桥，通道名不泄漏到 renderer
  renderer/    React 界面
resources/     （T1 建设中）模式 / 提示词 / 体裁 —— 能力是数据，不是代码
docs/          进度、任务清单、架构决策、逆向调研笔记
scripts/       冒烟测试、依赖方向校验、启动包装器
```

依赖方向单向流动，`npm run check:deps` 机械校验。改架构前先读
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 的决策记录 —— 每条都写了为什么这么定、否掉了什么。

## 文档索引

| 文档 | 内容 |
|---|---|
| [docs/STATUS.md](docs/STATUS.md) | **当前进度**（唯一权威来源）、怎么跑、已知坑、待验证事项 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | **任务清单**：接手者硬约束、已查清的 pi API 事实、P0-P3 分级与排期 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架构与决策记录 |
| [AGENTS.md](AGENTS.md) | 开发约定（人和 AI 共同遵守） |
| [docs/workbuddy分析/](docs/workbuddy分析/) | WorkBuddy 逆向调研笔记（仅参考，见下方合规） |

## 合规说明

`docs/workbuddy分析/` 与 `C:\Program Files\WorkBuddy\_analysis\` 是经批准的逆向调研素材，
**仅限内部学习研究**。机制可以学，**文字必须自己写** —— 提示词、模板、技能正文一律独立撰写，
不得从 WorkBuddy 原文复制（详见 [AGENTS.md](AGENTS.md) §6）。
