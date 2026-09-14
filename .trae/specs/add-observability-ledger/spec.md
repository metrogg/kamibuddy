# 运行台账与可观测体系 Spec

## Why

调研实证（三份源码级报告）：pi 的事件/用量能力我们只用了约一半——`auto_retry`
（每次失败的原因与退避间隔）、`queue_update`（排队消息）、usage 的 cost 分项与
reasoning/cacheWrite1h 细分、turn 边界（单次模型调用耗时/TTFT）全在翻译层被吞；
聚合统计活守进程内存（重启清零、上限 50 条）；上下文组成全靠字符数估算。
dsh（deepseek-harness）的答案是「append-only 事件日志为唯一事实源 + 一切皆投影」，
codex 的答案是「span 属性后回填 + 隐私分级 + 集中维度」。pi 的会话 JSONL 已经是
消息账本（含 usage 全字段），我们缺的只是：pi 不记的东西（重试过程/调用计时/
请求快照/队列）+ 持久化投影 + 可视化。

## What Changes

- **运行台账（run ledger，记录层）**：每会话一份 NDJSON（`~/.kamibuddy/logs/runs/
  <sessionId>.jsonl`），只记 pi 会话 JSONL 不记的东西，避免双写漂移：
  - llm_call：单次模型调用边界（映射被吞的 turn_start/end）+ startedAt/endedAt/
    TTFT（首个 text/thinking delta 到达时刻）+ usage 全字段（input/output/
    cacheRead/cacheWrite/reasoning/cacheWrite1h + cost 四项分项）+ stopReason
  - retry：auto_retry_start/end 全量转发（attempt/maxAttempts/delayMs/errorMessage）
  - tool_call：name/参数摘要/startedAt/endedAt/outcome（统一口径：都按执行期，
    现状流式卡含参数生成期的口径差异在注释标明）
  - compaction：reason/tokensBefore（pi 事件携带）
  - queue：steer/followUp 排队与出队（queue_update 转发）
  - request_snapshot：每轮实际入模组成（挂 pi transformContext 钩子——官方观察口；
    记 system 分段 provenance 复用 prompt-composer 的 segments + 消息分类条数与
    字符数；正文不重复落盘——会话 JSONL 已有，记引用与计数）
  - 写入纪律（dsh 轻量版）：seq 单调 + at（epoch ms）+ kind + 数据写入点 JSON
    校验；daemon 崩溃后下次启动对未闭合 run 补合成结束标记（不截断）
- **投影持久化**：ObservabilityStore 从「进程内存 50 条」改为「台账 fold 投影 +
  启动时回放重建」（dsh 注册制纯 fold 的简化版）；会话级累计对齐 pi
  getSessionStats（含被压缩历史与摘要开销）；聚合重启不清零
- **诊断页升级为「运行观测」**：
  - 会话时间线：llm 调用/工具/重试/压缩嵌套泳道，每步耗时 + token 五字段 +
    cost + 缓存命中量（codex span 后回填的等价物——台账一行全齐）
  - 上下文组成真实拆分（request_snapshot 的分类计数）替换现有的纯估算条
    （估算保留为无快照会话的降级）
  - 缓存命中：run 级命中率 + 浪费归因（空闲超时 vs 换模——借鉴 pi cache-stats 算法）
  - 会话级统计卡片（pi getSessionStats 口径）
- **运行中可见性**（顺手点亮，事件转发级难度）：
  - 重试状态行：「模型响应失败，N 秒后第 X/Y 次重试…」（auto_retry 事件 +
    renderer 状态行，替换现在的「卡住」体感）
  - 排队指示：steer/followUp 排队中徽标（queue_update）
- **出错恢复补齐**：会话 JSONL 损坏时 resume 降级打开（pi 的 parseSessionEntries
  本就跳过坏行——我们的 resume 从「抛错给用户」改为「降级打开 + 提示跳过 N 行」）
- **不做**：OTel 导出后端（记录模型留好映射接口，默认关闭不上传——AGENTS.md
  YAGNI）；会话树/分支（navigateTree 接入是独立 spec 的事）；双通道脱敏上传
  （无上传需求）

## Impact

- Affected specs：增强 add-run-observability（诊断页 v1 → 观测体系）
- Affected code：`src/core/session-host.ts`（翻译层）、`src/core/run-ledger.ts`（新）、
  `src/core/observability.ts`（投影化）、`src/shared/session-events.ts`（新事件）、
  `src/shared/observability.ts`（快照模型）、`src/daemon/index.ts`（台账接线 +
  resume 降级）、`src/renderer/diagnostics-view.tsx`（观测页）、
  `src/renderer/chat-view.tsx`（重试/排队状态行）

## ADDED Requirements

### Requirement: 运行台账

每会话 SHALL 有一份 append-only NDJSON 台账，记录 llm 调用（边界/TTFT/usage 全字段/
stopReason）、重试过程、工具调用（统一口径计时）、压缩、队列与请求快照；seq 单调，
daemon 重启后对未闭合 run 合成闭合。

#### Scenario: 重试全程可查
- **WHEN** 一次 run 中模型连续失败两次后成功
- **THEN** 台账含两条 retry 记录（各自 errorMessage/delayMs）+ llm_call 三次尝试的
  边界与最终 usage，诊断页时间线可见全过程

### Requirement: 持久化投影

用量/耗时/工具统计 SHALL 从台账 fold 重建，daemon 重启不清零；会话级累计与 pi
getSessionStats 同口径。

#### Scenario: 重启后历史仍在
- **WHEN** daemon 重启后打开诊断页
- **THEN** 本次启动前的 run 历史与累计用量依然可见

### Requirement: 上下文真实组成

每轮请求 SHALL 有 request_snapshot（分段 provenance + 分类计数），诊断页上下文组成
优先用真实快照而非字符数估算。

#### Scenario: 上下文为什么满了
- **WHEN** 用户在诊断页查看某轮的上下文组成
- **THEN** 看到系统各分段（场景/模式/风格/记忆/个性化…）与消息/工具结果的真实
  计数与占比，而非估算比例尺

### Requirement: 重试与排队运行中可见

模型自动重试期间 renderer SHALL 显示重试状态行（第几次/倒计时/原因）；
steer/followUp 排队时有排队指示。

#### Scenario: 重试不再是卡住
- **WHEN** 模型请求失败进入 3 秒退避
- **THEN** 等待区显示「响应失败，3 秒后第 2/3 次重试」，倒计时递减

## MODIFIED Requirements

### Requirement: 会话恢复容错

resume 遇到损坏的会话 JSONL 时从「抛错拒绝打开」改为「pi 跳过坏行降级打开 +
renderer 提示跳过 N 行」（pi parseSessionEntries 本就容错，是我们把异常上抛了）。
