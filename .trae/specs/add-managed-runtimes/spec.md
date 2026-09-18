# 内置运行时（托管运行时）Spec

## Why

Codex 与 WorkBuddy 的「内置运行时」是**产品级资产**：捆绑 → 开关 → 诊断/重置 → 审计，四件齐备。我们只有一个隐式的 Python venv（`~/.venv-html-to-docx`），既看不见、也修不了、也没有审计面 —— 环境一出问题用户只能干等或找我们。

我们已有的能力其实不少（uv 幂等状态机、`inspectVenv` 四态、事件日志与台账），缺的是**把它变成用户能看见、能操作的资产**，以及**多运行时这个概念**。

## What Changes

- **新增统一的「托管运行时」内核**：`<configDir>/runtimes/<id>/<version>/` + `current` 指针（学 Codex 的版本化 + WorkBuddy 的 `binaries` 布局），支持多版本、可回滚、可重装。
- **接入三个运行时**：`python`（现有 docx 引擎迁入）、`node`、`gitbash`。
- **设置页新增一级分区「内置运行时」**：总开关 + 三个运行时子开关（总开关关 → 子项置灰）+ 每个运行时的状态/版本/诊断/重置。
- **新增「诊断」与「重置并重新安装」**（学 Codex）：诊断产出可复制报告 + 落盘日志；重置走「下载 → 校验 → 安装 → 重载工具」的幂等链路。
- **新增审计中心**：拦截/放行记录（命令安全 / 沙箱 / 运行时三类）+ 导出 + 清空（清空需二次确认）。
- **模型侧可见性**（补当前半缺）：把运行时清单与状态注入模型可见上下文；**被禁用 / 未就绪要响亮告知**，不许静默降级。
- **BREAKING（改变原有设计）**：`AGENTS.md §2` 的「bash 仍然不用」与「不要求用户预装 Python」两条前提需要重写 —— 我们改为**随包分发** Node/Python/Git Bash，用户什么都不用装，但也不再以「不用 bash」作为架构约束。**Git Bash 作为随包运行时提供，是否同时把 `bash` 开放成模型的自由 shell 工具，单独一轮决策**（本 spec 不含）。
- **BREAKING（改变原有设计）**：Python venv 不再是 `~/.venv-html-to-docx` 这个平级隐式路径，而是托管根下带版本的一个运行时实例。
- **明确延后**：私有化/无外网镜像（`UV_INDEX_URL` / `UV_PYTHON_INSTALL_MIRROR` 由谁设）本轮不做，但要在 spec 里留决策位。

## Impact

- Affected specs: `add-docx-generation` 与 `complete-docx-skill-set`（Python 运行时改由托管根提供，预热与错误文案要跟随）、`add-windows-acl-sandbox`（审计中心要消费沙箱事件）、`harden-permission-boundary`（审计记录来源与权限门重叠）、`rework-settings-layout`（新增一级分区）
- Affected code:
  - 新增：`src/core/runtimes/**`（注册表 + 状态机 + 安装/校验/回滚）、`src/core/runtime-store.ts`（manifest 与版本指针）、`src/core/audit-log.ts`
  - 改造：`src/documents/docx-env.ts`（迁入托管内核，保留 `HTML_TO_DOCX_VENV` 覆盖口）、`src/documents/docx-convert.ts`（错误分类跟随）
  - 进程侧：`src/daemon/index.ts`（启动预热、运行时状态 IPC、环境注入）、`src/daemon/automation-runner.ts`（无人值守变体的运行时注入）
  - 模型侧：`src/core/session-host.ts`（`python_env` 段扩成运行时清单）、`resources/prompts/fragments/python-env.md`
  - UI：`src/renderer/settings/**`（新分区、开关、诊断/重置）、`src/renderer/diagnostics-view.tsx`（`DocxEnvRow` 升级/搬迁）、新审计中心视图
  - IPC：`src/shared/ipc.ts`（新增通道与 payload 类型，两侧不各写一遍）
  - 随包资产：`scripts/fetch-*.mjs`（uv 的既有模式，扩成按运行时拉取）、`resources/bin/**`
  - 文档：`AGENTS.md §2`（改写 bash/运行时前提）、`docs/ARCHITECTURE.md`、`docs/sandbox.md`

## ADDED Requirements

### Requirement: 统一的托管运行时
系统 SHALL 提供统一的托管运行时内核，每个运行时以「id + 版本」寻址，可并存多版本、可切换当前版本、可回滚。

#### Scenario: 多个运行时并存
- **WHEN** 用户同时启用 python / node / gitbash
- **THEN** 三者在托管根下各自独立存放与寻址，互不影响；任一损坏不影响其余两个

#### Scenario: 版本回滚
- **WHEN** 某运行时新版本安装后不可用
- **THEN** 系统可切回上一版本，且切换不重新下载

### Requirement: 用户可见的运行时开关
系统 SHALL 在设置页提供「内置运行时」总开关与逐运行时开关；总开关关闭时子项 SHALL 置灰不可单独开启。

#### Scenario: 关闭某个运行时
- **WHEN** 用户关闭 `node`
- **THEN** 该运行时的路径与托管目录 SHALL NOT 注入；且系统 SHALL 记录一个显式的「已禁用」标记，模型侧看到的 SHALL 是「已被用户禁用」而非「找不到」

#### Scenario: 总开关关闭
- **WHEN** 用户关闭总开关
- **THEN** 三个子项全部置灰，且任何运行时都不注入

### Requirement: 运行时的诊断与重置
系统 SHALL 为每个运行时提供「诊断」与「重置并重新安装」。诊断 SHALL 产出可复制的报告并落盘；重置 SHALL 走「下载 → 校验 → 安装 → 重载工具」的幂等链路。

#### Scenario: 环境损坏
- **WHEN** 某运行时依赖缺失或版本不符
- **THEN** 诊断能指名到具体缺失项；重置能仅凭该操作修复，无需用户手动删目录

#### Scenario: 重置中断
- **WHEN** 重置过程中进程退出
- **THEN** 下次可继续（幂等），且 SHALL NOT 留下一个「看起来就绪」的半成品状态

### Requirement: 审计中心
系统 SHALL 提供用户可查的拦截/放行记录，至少覆盖「命令安全」「沙箱」「运行时」三类，并支持导出与清空（清空需二次确认）。

#### Scenario: 查看一次被拦掉的命令
- **WHEN** 命令安全检查拦下一条命令
- **THEN** 审计中心能查到该条记录（含时间、类别、结论），且可导出

#### Scenario: 清空记录
- **WHEN** 用户选择清空
- **THEN** 需二次确认后才清空，且清空动作本身也被记录

### Requirement: 模型侧的运行时可见性
系统 SHALL 把运行时清单与状态注入模型可见上下文，使模型知道「有哪些运行时、分别什么状态」，而 SHALL NOT 让模型去猜或自行安装。

#### Scenario: 运行时未就绪
- **WHEN** 模型需要某运行时但它尚未就绪
- **THEN** 模型收到的信息 SHALL 明确说明「未就绪 / 正在准备 / 已失败 / 被用户禁用」，并给出应走的下一步（等待或如实告知用户），SHALL NOT 静默降级

## MODIFIED Requirements

### Requirement: 环境准备前提（原 `AGENTS.md §2`）
原「不要求用户预装 Python / Git for Windows」的结论保留，但**实现方式改为随包托管三个运行时**（不是「只托管 Python」）；原「bash 仍然不用」的约束**作废** —— Git Bash 作为随包运行时提供。是否把 `bash` 开放为模型的自由 shell 工具，另行决策，不由本 spec 决定。

### Requirement: Python 运行时的位置与预热
Python 运行时 SHALL 由「托管根下带版本的一个实例」提供，`HTML_TO_DOCX_VENV` SHALL 保留为覆盖口（兼容既有用户的显式指定）。既有 `~/.venv-html-to-docx` 若存在，SHALL 被复用或显式迁移，SHALL NOT 静默丢弃。

## REMOVED Requirements

### Requirement: 隐式的单一 Python venv
**Reason**: 它既不可见也不可修，且没有版本维度，增删依赖会污染所有人的既有环境。
**Migration**: 迁入托管根；保留 `HTML_TO_DOCX_VENV` 覆盖口；启动时探测旧路径并复用/迁移，探测结果在诊断里如实呈现。

## 被改变的原有设计（含否决方案）

| 原有设计 | 新设计 | 理由 |
|---|---|---|
| 「bash 仍然不用」 | Git Bash 随包提供（是否开放 bash 工具面另议） | 用户的取舍是「跟着 Codex/WorkBuddy 学、必要时改原有设计」；且随包分发不再要求用户预装 Git for Windows，原约束的**前提已消失** |
| 「只托管 Python」 | 三运行时统一托管 | 模型写脚本时缺 Node 等运行时同样会卡；且多运行时的开关/诊断/审计是同一套机制，重复实现不如统一 |
| `~/.venv-html-to-docx` 平级隐式路径 | 托管根 + 版本指针 | 版本化才能回滚与重装；Codex 的 `<plugin>/<version>/` 与独立版本号是现成范例 |

**## 否决方案**

- **否决：只把现有诊断页加两个按钮（最小改动）**。理由：治标 —— 环境仍不可见、仍无版本、仍修不了 Node/Git Bash（因为压根没有）。用户明确要求补全缺口并允许改设计。
- **否决：照 WorkBuddy 自建 COS binaries 分发**。理由：我们有 uv 与官方源的既有拉取模式，自建分发渠道是额外运维负担。
- **否决：本轮做私有化/无外网镜像**（`UV_INDEX_URL` / `UV_PYTHON_INSTALL_MIRROR` 由谁设）。理由：用户明确「先不管」；但**保留决策位**，落地前必须拍板，否则「离线可用」只是纸面承诺。
- **否决：把 `bash` 直接开放成模型的自由 shell 工具**。理由：这是权限面变更，牵涉沙箱与检查器，必须单独决策；本 spec 只提供运行时。
