# Checklist

> 判定来自一次**独立验证**（未参与实现的验证者逐条自查 + 4 组「改坏 → 变红 → 还原」抽验 + 只读回放台账）。
> 凡「表述与事实不符」的条目已按验证结论订正，订正处写明原因；未通过的条目标为 `[ ]` 并注明缺什么。

## 契约与形态
- [x] 两块注入的渲染字节与改动前**逐字节一致**（`wrapHiddenContextXml` / `composeHiddenContext` / `formatRunTime` / `HIDDEN_CONTEXT_MARKER` 零行改动；`hidden-context.test.ts` 的 diff 首个 hunk 在 L1、下一个在 L68，中间三组渲染断言未触碰）
- [x] `appendHiddenContext` 与其「尾部追加」单测已删除，`hidden-context.ts` 文件头的理由段已按新事实重写（并明确写旧论证「是错的」）
- [x] `shouldAppendSnapshot` 是零运行时依赖的纯函数（该文件现已无任何 import），且被真实调用点使用（`prompt-switch.ts:191`，不是测试旁路）
- [x] 两个通道**各自**去重、各自追加，没有被合并成一条消息（`prompt-switch.ts` 注册两个 `before_agent_start` handler；pi 的 `runner.js` 遍历同扩展全部 handler 并逐个 push）

## 持久化与去重
- [x] 快照通过 `before_agent_start` 返回的 `message` 投递（`role:"custom"` + 具名 `customType` + `display:false`），`prompt-switch` 里已无 `pi.on("context")`
- [x] `session-host` 的 `installHiddenContext`（`transformContext` 追加）已删除；`freezeHiddenContext` 与诊断展示口（`lastHiddenContext` / `peekHiddenContext`）保留
- [x] 去重基线取自 `sessionManager.buildContextEntries()`（compaction-aware 的活条目列表）里最后一条同 `customType` 快照，**没有**进程内缓存（每次现读）
- [x] 单测断言：同一 run 内 N 次模型调用只产生 **1** 条快照条目（用例带「真实发生 2 次调用」的前提守卫，不是空转）
- [x] 单测断言：跨 run 内容相同 ⇒ 不追加；内容不同 ⇒ **追加**（既有条目的**原始 JSON 行 + 行号逐字节不变**）
- [x] 单测断言：resume（`SessionManager.open` 重建）后同内容不重复追加，且**先证明基线读得到**再断言不追加
- [x] 三处 daemon 接线（用户会话 / run 会话 / 子代理-成员宿主）都已接上；`composeHiddenContext` 为**必填** ⇒ 漏接在**装配期（编译期）**响亮报错
- [x] （补记）运行期**不是**响亮失败，而是读侧降级：`automation-runner` / `subagent-runner` 的 `getHost()?.` 可选链缺 host 时静默得到 `undefined`（该 run 不注入）、`prompt-switch` 读会话失败时静默转「追加」。两处都是注释写明的降级，与上面的「装配期响亮」不矛盾 —— 不要把它读成「运行期也响亮」

## 可见面
- [x] 聊天界面不显示快照（用户可见条目数与改动前逐一相等；用**真实 pi 事件序 + 真实 `translate`** 断言「有/无快照事件流逐条相等」，且折叠后仅 user+assistant、`turnTimings` 键 / `lastUserEntryIndex` / `currentRunStartIndex` 不变）
- [x] conversation 折叠 / 轮切分忽略快照条目（快照不产生任何 `SessionEvent`，reducer 结构上收不到；上一格的用例已间接钉住三个派生量）
- [x] **导出 HTML 的聊天正文**不含快照：依据是 pi 模板对 `custom_message` 有 `&& entry.display` 门槛（`dist/core/export-html/template.js:1309`），快照恒为 `display:false`
- [x] 导出页头的 `N user` 计数不变（pi `computeStats` 只数 `entry.type==='message' && role==='user'`，`template.js:1333`）
- [x] （补记）同一统计行会**新增一项 `N custom`**（`template.js:1356-1357` 计数、`:1379` 打印）—— 本改动引入的可见面变化，已登记为「已知偏离②」
- [ ] **已知泄漏（不做，待用户裁决）**：导出文件的 ① 侧边树标签（`template.js:691-693` 无 `display` 门槛，印正文前 100 字符）、② 搜索索引（`:344-347` **全文不截断**）、③ 内嵌 base64 会话数据本体，都含快照正文。
      **为什么不修**：`exportToHtml(outputPath, {themeName})` 没有条目过滤参数；两条可行路都不干净 ——（a）解 pi 生成的 HTML 的 base64 再重写（依赖模板内部标记，pi 一改格式整条链路变脆）、（b）改走 `exportFromFile(filteredJsonl)`（丢掉扩展工具卡的自定义渲染 = 功能倒退）。按 `AGENTS.md`「不写防御性兜底、能借力不自研」都不做。
      原条目「导出 HTML 的正文不含 `HIDDEN_CONTEXT_MARKER`」的写法**不可证伪**（导出数据 base64 内嵌，明文 grep 恒为空 ⇒ 空断言），已按上两格改写。

## 台账与归因
- [x] `TRANSIENT_INJECTION_CUSTOM_TYPES`（及改名后的聚合常量）、`MessageRef.transient`、`dropTransient` 及旧台账降级分支全部删除；`src/` 下零残留引用（历史 spec / 已冻结旧记录里的出现是允许的，已区分）
- [x] 断点落在快照条目时，诊断面板如实指认（不再报「历史全命中」）：`cache-prefix.ts` 回到全量名册 diff，3 例反向钉子；复刻旧剔除 → 2 例变红，其中 1 例正是盲区（`hitCount 3→2`）
- [x] `request_snapshot` 的计数口径与 `snapshot-breakdown.tsx` 括注一致（两边都写「计入 `messages.other`（不是 user）」）。**附注**：`session-host.test.ts` 的 `toBe` 相等断言成立于「other 桶恰好只有快照」的夹具，是夹具依赖的断言，不是普遍等式

## 门禁自证（验证者**自己**改坏抽验，非引用他人记录）
- [x] 去掉去重判定 → 5.2/5.3 精确变红（`to have a length of 1 but got 2`）→ 还原后全绿
- [x] 把注入改回 `transformContext` / `context` 尾部追加 → 5.1/5.2/5.3 **全红**（`expected [] to have a length of 1 but got +0`，一条都没落盘）→ 还原后全绿
- [x] 破坏**末条**基线（`lastSnapshotContent` 改成从前往后取首条）→ **只** 5.2 变红（run 4 多追一条）→ 还原后全绿
- [x] **压缩路径夹具会变红**：把基线改成 `getBranch()` → 6.1 精确变红（`expected [ { index: 5, …(3) } ] to have a length of 2 but got 1`）；改成 `getEntries()` 同样红；5.1–5.3 仍全绿（证明新增覆盖）
- [x] （订正）原条目「破坏 resume 基线读取（**读非活分支**）→ 精确变红」**不可证伪**：实测把 `buildContextEntries()` 换成 `getBranch()` 或 `getEntries()` **都不变红**（三者只在发生压缩后才分叉，本套件原本不产生压缩）。改由上一格的压缩夹具覆盖；「从前往后取」测的是**末条 vs 首条**，与「活分支 vs 非活分支」是两件事。验证者已用 `git diff` + `tsc --noEmit` + 185 例复跑 + `git status` 逐行比对证明 4 组改坏全部精确还原
- [x] `npm run typecheck && npm run check:deps` 通过（实跑：`扫描 379 个文件。依赖方向校验通过。`）
- [x] `npm test` 全绿（实跑：`Test Files 147 passed (147)` / `Tests 2648 passed | 1 skipped (2649)`）
- [x] `npm run check` 全绿（tokens / model-experience 21 个模块 / module-invariants 25 个在范围模块）

## 文档
- [x] `docs/提示词前缀缓存契约.md` §7 与 §2 的旧结论已按 `AGENTS.md §8` 标 **[作废]** + 保留原文引用 + 反例（不落盘 ⇒ 每轮新尾巴 ⇒ 每轮 miss，58,094 token / 28.8%）+ 互链；「对照结论」表同步；文末新增「四、本次改动的权威结论（互链）」，头部同步
- [x] 两处文件头的同源错误推理已改掉（`hidden-context.ts`、`prompt-switch.ts`）；**额外**订正 4 处同源陈旧事实（`session-host.ts` ×2、`task-diagnostics-panel.tsx`、`check-module-invariants.ts` 的 `relationship`、`runtimes.ts` 的模型体验契约段）
- [x] `docs/可观测性清单.md`（CACHE8 行 + 新基线小节 + CACHE6 前提 + 纪律清单）与 `docs/workbuddy对齐清单.md` F5（偏离理由换代：缓存已不成立，改为**读序不同**）已同步；另同步 `docs/workbuddy分析/11-hidden-context.md` 的落地状态
- [x] spec.md 的 `## 已知偏离` 已订正 pi 的路径/行号（`dist/core/export-html/index.js:104`，非不存在的 `.ts` L160）并补登 `N custom` 一条

## 真实复跑（需真实凭据）
- [x] 同题跑出 **5 个 run / 24 次模型调用**，台账已落盘（会话 `01a0b325-7548-7588-b0d8-4e1eabb968b4`，成本 $0.0126）
- [x] 逐对校验 `prompt_{N-1} − cacheRead_N ≤ 128`：**23/23 通过**（run 内 19 对 max 56、跨 run 首调 4 对 max −403；无一个 > 128）。验证者用 `--replay` 只读回放新台账复核：`gap.min=-7414 gap.max=56 gap.over128=0`。基线同法回放：`n=23 min=2423 max=2615 gap.over128=23`
- [x] 会话级加权命中率 **97.43%**（基线 90.88%，目标 ≥95% 达成）；拆解恒等式自洽 `4,124 + 34,147 − 18,773 = 19,498 = 实测未命中`；读数与复算命令已附在 spec 的 `## 复跑实测` 段。**注意**：探针工具面小于真实 app 会话 ⇒ 命中率绝对值不可与基线直接相减（同口径对照见该段第 1 条）
- [ ] **人工确认一次模型阅读顺序变化未造成行为退化** —— 未达成，且**不可自动化**：
      现有自动证据只到**落位**层（会话文件行序 `user → runtime-snapshot → hidden-snapshot`、请求体里快照下标 >0 且跨调用逐位不变、不在末尾）；仓库里没有 eval / 同题产物对照 / 人工记录。
      需用户跑一道真实题、与基线台账的同题产物对照后确认。已登记为 `tasks.md` 的 **Task 10（人工项）**。
