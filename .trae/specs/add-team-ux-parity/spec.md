# 团队体验与生态对齐 WorkBuddy（add-team-ux-parity）Spec

> 承接 `add-team-collaboration-parity`（七项协作能力已落地）。这份补的是**操作面与生态**：
> P1 四项 + P2 五项。P0（工具面按 expertType 联动）**明确不做** —— 用户 2026-09-18 决定
> 保留「全局开关 + 手动开」的现状，理由是团队工具的能力外溢在当前使用场景下不构成问题。

## Why

七项协作语义补齐后，团队「能不能干活」已经解决；剩下的是**好不好用**：

- 成员在后台跑，用户**看不见整体进度**：成员卡在消息流里滚走，没有常驻状态；
- 想看某个成员要**用鼠标点卡片**，键盘用户没有路径（WorkBuddy：空输入框 ↓ 切成员、Ctrl+O 回领导）；
- 刚做的**任务板没有 UI**，只有模型在对话里念一遍（WorkBuddy：Ctrl+T 任务列表）；
- 多个成员**同时要权限**时，全局 modal 队列先到先服务，用户分不清谁在请求
  （WorkBuddy：按成员分组的 intercept 卡）；
- 专家包只能**手工搬目录**，产品里没有装包入口（WorkBuddy：expert-manager + 市场安装）。

生态上还差 P2 系列的细节（四值 expertType、成员轮次上限、防幽灵成员、头像等）。

## What Changes（按批次，逐条对齐 WorkBuddy）

### 批次 ①：成员焦点导航与键盘路径

- **Ctrl+O**：从成员视图回到领导视图（WorkBuddy 同款）。
- **空输入框按 ↓**：进入/切换到下一个成员（按团队内 spawn 顺序轮转）；
  输入框非空时不拦截（↓ 仍是光标移动），避免抢走正常编辑行为。
- **Esc**：成员视图下回到领导（现有 Esc 语义若有冲突，以「先关弹层、再退视图」为序）。
- 快捷键注册点：App 层统一 keydown（与现有快捷键同一处），只在**团队存在**且
  **焦点在输入框或对话区**时生效；成员视图状态沿用现有 `memberFocus`。

### 批次 ②：常驻成员状态栏

- 位置：**输入区上方**（WorkBuddy 的 status bar 同位），团队存在时出现、解散后消失。
- 内容：每个成员一行/一枚 chip —— 花名 + 状态符（`●` 运行中 / `✓` 完成 / `✗` 失败 /
  `—` 已取消 / `…` 收尾中）+ 实时轮数与工具调用数（复用 `team_member_progress` 投影，
  已有数据，不新增事件）。
- 交互：点击 = 聚焦该成员（与成员卡同一入口）；`×` = 关闭状态栏（本会话内隐藏）。
- 与成员卡的分工：卡片是**消息流里的一次性记录**，状态栏是**常驻的实时汇总**。

### 批次 ③：任务面板（Ctrl+T）

- **Ctrl+T** 开关一个浮层（输入区上方，与状态栏互斥同位）：列出团队任务板
  （状态分组、owner、依赖、结果摘要）。
- 数据源：`team_task_list` 已有等价数据 —— 需要一条**读通道**把任务板投影给 renderer
  （新增 IPC：`getTeamTasks`，只读；不引入写通道，改任务仍由模型经工具完成）。
- 空态：没有任务时给「让主理人建任务」的提示，而不是空面板。
- 只读理由（否决方案）：任务板是模型协调账本，用户手改会与模型认知脱节。

### 批次 ④：成员权限卡按成员分组

- 成员发起的审批从全局 modal 队列里**分出来**，走独立卡片位（输入区上方，与
  sandbox 拦截卡互斥同位），**按成员分卡**：谁的请求、哪个工具、什么风险。
- 三选按钮对齐 WorkBuddy：`仅本次允许`（allow_once）/ `本会话内允许`（allow_session）/
  `拒绝`（deny）——我们现有弹窗已有「允许 / 拒绝 + 本次会话内不再询问」，本批把它
  在成员卡上显式化成三选（用户不必先勾记忆再点允许）。
- 并发多成员同时请求：卡片**纵向堆叠**（不互相覆盖），先到先服务但都能看见。
- 主会话 / 子代理 / 定时任务的审批**保持现状**（全局 modal），只有团队成员走新卡位。

### 批次 ⑤：专家包安装链路

- 入口：专家市场页「导入专家包」——选本地目录（含 `expert.md` 或 WorkBuddy 形状的
  `plugin.json + agents/`）→ **校验**（沿用 `loadExperts` 的同一套规则，不另立一套）
  → 落到用户级 `<configDir>/experts/<name>/`。
- WorkBuddy 形状的包（`plugin.json`）**自动转换**：manifest → 我们的 frontmatter、
  `agents/*.md` 补 `tools`、工具名本地化（`TeamCreate`→`team_create` 等）、
  成员 `name` 取 `displayName.zh` 花名。转换产物必须过 `check:expert-assets`。
- 明确不做「从网络市场一键下载」：本机包目录导入已覆盖真实用例（用户的专家包都在
  本地 `~/.workbuddy/plugins/marketplaces/`），网络下载要签名与信任链，另开议题。

### 批次 ⑥：`expertType` 四值（P2）

- `skill | agent | plugin | team`（对齐 `EXPERT_TYPE_VALUES`，缺省 `agent`）。
- 我们现有的 `expert` 语义 = WorkBuddy 的 `agent`：**保留 `expert` 作为别名**读入
  （存量 16 个包不迁移），新值（skill/plugin）只作声明与筛选，暂不联动行为
  （联动 = P0，本轮明确不做）。

### 批次 ⑦：成员轮次上限（P2）

- member 定义支持 `maxTurns`（agent frontmatter 已有 `model`/`tools`，再加一个数值键）；
  `team_create` 的 `members[]` 可覆盖。
- 触顶行为：**不做硬杀** —— 成员跑到上限时主理人收到一条系统提示（「成员 X 已达轮次上限，
  建议 team_shutdown 收尾或追加指示」），由模型决定。硬杀会丢上下文且与「优雅收尾」
  的既有立场冲突。

### 批次 ⑧：防幽灵成员（P2）

- 场景：`startTeam` 建会话中途失败 / spawn 部分成员成功。
- 现状：整团失败会 abortAll + disband；**部分成功**时的成员状态与句柄一致性未专门处理。
- 本批：spawn 逐个记账 —— 失败的成员记 `failed` + 明确原因（不是静默）；领导收到
  汇总（「3 名成员启动失败：X（原因）、Y（原因）」），可选择重建。
- 暂不做 WorkBuddy 的 provisional runtime/rekey：我们的成员表以 name 为键（同名天然唯一），
  没有「跨团队同名产生第三个幽灵」的问题面。

### 批次 ⑨：成员头像与状态栏视觉（P2）

- 搬入源包的 `avatars/`（stock-partner-team 与 mvp-dev-expert-team 各有 7-8 张 +
  team.png），专家卡与成员 chip 优先用真实头像，缺失时回落现有首字符色板。
- 专家卡用 `avatar`（WorkBuddy plugin.json 里有该字段，搬包时未搬）。

### 批次 ⑩：truly-idle 收敛（P2，只记录不实现）

- WorkBuddy 的 `team_busy/team_idle` + `hasActiveChildAgents` + pending 落库，解决的是
  「主 turn 结束但成员还在跑时，状态别急着标完成」。我们的成员产出进会话消息、
  团队状态走实时投影，没有那个 DB 状态机 —— **当前不需要**。将来做自动化下的后台
  委派（定时任务里建团）才需要，届时按本批记录开工。

## 否决方案

- **P0 工具面按 expertType 联动**：否（用户 2026-09-18 决定）。保留全局开关，
  选了团队专家要手动开；团队工具在非团队会话也可见。记录在案，不再提。
- **任务面板做成可写**（用户在面板里改状态/加任务）：否。任务板是**模型的协调账本**，
  用户手改会让模型基于过期认知继续调度（它不知道人类动了哪一格）；要看就只读，
  要改就让模型改（对话里说一句）。
- **任务面板做成整页/独立路由**：否。它是**伴随性**信息（干活时瞄一眼），
  整页会把用户从对话里赶出去；浮层与状态栏同位（WorkBuddy 同款）才对。
- **成员审批卡另起一套审批通道**：否。复用现有 `pendingApprovals`（并发排队、超时降级、
  审计落盘都在那里），本批只改**呈现与分组**，渠道不动。
- **快捷键用全局捕获**：否。只在「有团队 + 焦点在输入/对话区」时生效，且输入框非空
  不拦 ↓（不抢光标移动）；否则会与编辑器/IME 打架。
- **成员轮次上限做成硬杀**：否（理由见批次 ⑦）。
- **做网络一键安装专家包**：否（理由见批次 ⑤）。
- **给成员做 provisional runtime / rekey**：否（理由见批次 ⑧：问题面不存在）。

## Impact

- 新增：`src/renderer/team-status-bar.tsx`（批次 ②）、`src/renderer/team-task-panel.tsx`（批次 ③）、
  `src/renderer/team-member-approval.tsx`（批次 ④）、
  `src/core/expert-package-import.ts`（批次 ⑤，纯逻辑 + 单测）、
  `src/daemon/team-tasks` 的只读 IPC 通道（批次 ③）
- 改动：`src/renderer/App.tsx`（快捷键与视图状态）、`src/renderer/chat-view.tsx`（卡位）、
  `src/shared/ipc.ts`（任务板投影、审批分组字段）、`src/core/experts.ts`（四值 expertType）、
  `src/core/agents.ts`（maxTurns）、`src/daemon/member-runner.ts`（轮次上限提示）、
  `src/daemon/index.ts`（startTeam 逐个记账）、`resources/experts/*/avatars/`
- 不改：团队七件套的语义、任务板纯逻辑、落盘格式（新增字段向后兼容）

## 验证

每批：`typecheck` + `check:deps` + `check:tokens` + `check:model-experience` +
`check:invariants` + `check:expert-assets` + `npm test`；
UI 批次（①②③④⑨）另需**真机截图核对**（用户验收：状态栏位置、快捷键手感、
成员审批卡分组）。依赖护栏（批次 ⑤ 的导入校验）先人为破坏确认变红。
