# Checklist

> 检查时按 spec「明确不做」表：**列出的豁免项不应被改动**，改错了同样是缺陷。
> 本期为 `feat/ui-design-system` 分支第 5 期（收尾，迁移文档里记作 spec #6）。
> **参照标杆**：`skills-view.tsx`（三态互斥 + 重试）、`personalization-section.tsx`（settings 分区模板）、
> `connectors-view.tsx:228-248`（四分支严格互斥）。
>
> **校验日期 2026-09-14**：`npm run check`（typecheck + check:deps + check:tokens）通过、
> `npm test` **95 文件 / 1717 用例全绿**、`check:tokens` 真违例 **0**（未新增白名单）。
> 与第 4 期基线完全一致（258 文件 / 0·77·107 / 95·1717）——本期只改 renderer 状态分支，未新增文件。

## 在途与空必须分开

- [x] `App.tsx` 的 `taskList` 初值是 `undefined`（不再是 `[]`），类型收窄，**消费点已逐个适配**
      （`?.find` / `?? []` / `?? false` 等 6 处）
- [x] 侧栏任务区：**在途 → 加载态**、**确实为空 → 空态**、**失败 → 错误态** 三者不再混用
- [x] 应用启动瞬间侧栏**不再闪**「暂无历史任务」
- [x] `home-view` 的模式页签：快照落地前给 `LoadingState`（原来整行空行）；
      "未就绪"判据用 `cwd !== undefined`（**代理判据，已如实标注**），没有用 `scenes.length === 0` 当在途
- [x] `chat-view` 的模式标签不再回退显示**裸 id**（改为行内 `Spinner`）
- [x] `plus-menu` 的专家子菜单能区分"在途"与"确实没有专家"（`experts` 类型改 `| undefined`，
      调用侧去掉 `?? []`，连带 `home-view`/`chat-view` 的 prop 同步）
- [x] 侧栏空间区有"在途"的行内加载位
- [x] 未把"长度为零"同时用于表达"还没到"与"确实没有"

## 失败必须就地可见且可重试

- [x] 侧栏 `listSessions` 失败不再静默（`.catch(() => { })` 已消除），有错误态 + 重试
- [x] **额外**：daemon 启动即 down 时侧栏显示「连接已断开」+ 重试（原来是**永久「正在读取…」**）
- [x] 定时任务页：`ErrorState` 与 `LoadingState` **不再并存**，且**有重试**（复用既有 `load`，
      `useCallback` 可重复调用）
- [x] 专家库：`experts-view` 两处 `ErrorState` 都有 `onRetry`，且**真的能重拉**（App 抽出 `reloadExperts`）
- [x] 产物面板文件树扫描失败**不再降级成空树**，改错误态 + 重试（`treeError` + `treeAttempt`，
      `disposed` 守卫保留）
- [x] 产物文本/代码/Markdown 预览失败三处都有 `onRetry`（`useArtifactText` 加 `attempt` 序号，**3/3 全做到**）
- [x] settings **10 处**分区失败后不再"错误条 + 正在读取…"永久同框（比原清单多 2 处：
      `WebSearchSection` 与 `models-section` 快照）
- [x] `models-section` 的快照错误有 `onRetry`
- [x] **没有任何一处是空壳 `onRetry`**：4 处原本"只在 `useEffect` 跑一次"的加载逻辑
      **已抽成 `load`/`refresh`**（`useCallback`），`useEffect` 改为 `void load()`
- [x] **附带修正**：抽取函数在成功路径补 `setError(undefined)` —— 否则重试成功后错误条不会消失
      （原来挂载时 error 必为 undefined，不需要清）

## 三态分支互斥

- [x] 所有改动点都遵循 `error ? ErrorState : data === undefined ? LoadingState : 内容/空态`
- [x] settings 各分区与 `personalization-section.tsx:376-383` 的模板形态一致（不是各写一套）
- [x] 产物面板的错误分支**排在加载分支之前**（失败时 `tree` 也是 `undefined`，代码里已注释钉死）
- [x] 未引入第二个"状态表达"出口（继续走 `state-views.tsx`）

## 失败态文案必须指向真实原因

- [x] 产物面板预览占位**区分两种原因**：未选工作空间 → 原引导文案；
      已选但服务未就绪 → 「预览服务未就绪，无法加载该文件」+ 重试
- [x] 后者带重试；且**不再**在已选工作空间时仍说"请选择工作空间"

## 豁免项未被误改

- [x] `office-pptx.tsx` 的绝对定位浮层**未被改成 `LoadingState`**（echarts 在 `display:none` 下量到 0×0）
- [x] `diagnostics-view.tsx` 的 `.stat-hint` / `.stat-err` 行内状态**未被强行块级化**
- [x] `App.tsx`（空间元数据）与 `chat-view.tsx`（个性化）的静默 catch **未被改动**（源码注释明示为设计意图）
- [x] **未改 `shared/ipc.ts` 的契约**（MCP `needs-auth` 另立 spec）
- [x] 未动旧空态类名（第 1 期已清理）
- [x] **未改任何视觉值**（本期只改状态分支与渲染条件；`.mode-tabs` 内的加载位复用既有容器尺寸以免跳动）

## 无回归与文档

- [x] `npm run typecheck` 通过
- [x] `npm run check:deps` 通过（扫描 258 文件）
- [x] `npm run check:tokens` 通过（真违例 **0** / 白名单 77 / 豁免 107，**未新增白名单**）
- [x] `npm test` 全绿（95 文件 / 1717 用例）
- [x] `DESIGN.md` **§4 状态矩阵**已更新：标题从「已知缺口清单（修复 backlog）」改为「**覆盖实况**」，
      本期补齐项逐行标注（侧栏任务列表/空间区、专家市场、定时任务页、产物面板、首页页签/模式标签/
      `+` 专家子菜单、设置各分区）；新增「**新增视图必须遵守的四条硬要求**」；
      新增「**豁免与刻意偏离登记**」三条（pptx 浮层 / 诊断页行内状态 / settings 写入失败不给 `onRetry`）；
      §10.2 的过时口径已订正
- [x] 成果文档已记（`docs/design-tokens-migration.md` **§10**，10.1–10.8）：
      4 处 P1 + P2 逐条处置、**必要支撑改动**（`reloadSessions`/`reloadExperts`、4 个区块抽 `load`/`refresh`、
      5 处补"成功路径清 error"）、**五条诚实标注**、未做项表、校验数字
- [x] **人工验收清单已列出**（迁移文档 §10.6，7 条可直接照做）
- [x] 已报告本期**未做**项与理由（MCP `needs-auth` / 两处登记豁免 / `ModeSwitch` 弹层空列表 /
      第 1 期遗留的两处设计意图静默 catch）

## ⏳ 待人工验收（沙箱无 GUI，无法自测）

- [ ] ① 启动瞬间侧栏显示加载态（不再闪「暂无历史任务」）
- [ ] ② 让 `listSessions` 失败后侧栏显示错误态 + 可重试；**重试成功后错误条要消失**（不赖着不走）
- [ ] ③ daemon 未连上时侧栏显示「连接已断开，未能读取历史任务」+ 重试（而非永久「正在读取…」）；
      空间区标题不显示 `空间 (0)`
- [ ] ④ 定时任务页首次失败**只**显示错误态 + 重试（不再「错误条 + 正在读取…」同框）
- [ ] ⑤ 专家库失败后两处都能**就地重试**（不必重启）
- [ ] ⑥ 未选工作空间 vs 预览服务未就绪，两种提示文案**不同**
- [ ] ⑦ 工作空间扫描失败显示错误态 + 重试（而非一个空目录）；只有扫描成功且确实无文件才是空态
