# add-team-pull-model Spec

> **起因**：2026-09-19 用户拍板 —— 团队成员的**产出获取**改为对齐 WorkBuddy 的
> **拉模式**（领导主动读成员会话），不再由 daemon 主动推送（回投）。
>
> 前情：`add-team-interrupt-diagnostics` 三次复现「团队没人接了」，三次根因全在
> **回投（推）这一步**：① `void` 掉 → ② 进程死在窗口 → ③ `await` 了「入队即返回」
> 的 `followUp()`。三次修完仍属「给推模式打补丁」。
>
> 本 spec 是**架构层调整**：把「推」换成 WorkBuddy 的「拉 + 派生」。
>
> ~~⚠️ **本文档是方案，未动代码。用户确认后再实施。**~~
> ✅ **2026-09-19 已实施完毕**（用户取舍 = **4-A 完全删除回投**）。
> 架构决策记录见 `docs/ARCHITECTURE.md` §4.19。

## 实施状态（2026-09-19 收尾）

| 批次 | 内容 | 状态 |
|---|---|---|
| ① | `src/daemon/member-transcript.ts`（+ 30 条单测） | ✅ |
| ② | `restoreTeam` 派生优先 + `settleRunningMembers`（+ 13 条单测） | ✅ |
| ③ | `team_read` 工具 + `team_status` 的 `outputAvailable`（+ 8 条单测） | ✅ |
| ④ | **4-A**：删回投全套（`pendingDelivery` / 待确认清单 / `queue_changed` 销账 / `onComplete` 回投 / `onFailed` 通知） | ✅ |
| ⑤ | `ARCHITECTURE.md` §4.19 + `add-team-interrupt-diagnostics` 交叉引用 + 全量测试与门禁 | ✅ |

**落点与方案的两处偏差（都记在这里，别当遗漏）**：

1. `team_read` 只留 `to` 一个入参，**没做方案里的可选 `turns`（取最近 N 轮）**。
   理由：产出语义是「最近一轮交出的完整内容」，多轮取回没有真实需求，
   先不做 —— 将来要取历史轮次再加，比现在臆造一个用不上的参数好。
2. **没做 `readChildPrefix` 的 256 KB 前缀截断**：我们的成员产出上限是 24k 字符
   （`MEMBER_OUTPUT_MAX_CHARS`），远小于 WorkBuddy 面对的量级，整文件读的行数
   在单轮规模下可控。真出现超大会话再做尾部优先 —— 现在加截断是为不存在的问题付成本。

---

## 一、WorkBuddy 那套是什么（逆向实证）

证据文件：`docs/WorkBuddy-reference/extracted/main/server.js`（6.8 MB，带源码注释与
`packages/workbuddy-core/src/...` 路径标注）。检索结论：

### 1.1 没有 followUp / 没有回投

| 检索词 | 命中文件数 |
|---|---|
| `followUp` | **0** |
| `steering` | **0** |
| `deliverSessionMessage` | **0** |
| `team_send` | **0** |

它的会话协议是一张 ACP 方法表：

```js
var ConversationAcpMethod = {
	Prompt: "session/prompt",
	Steer: "session/steer",
	Cancel: "session/cancel",
	SetMode: "session/set_mode",
	SetModel: "session/set_model",
	Rollback: "_codebuddy.ai/session/rollback",
	DelegateTool: "_codebuddy.ai/delegateTool",
	DelegateToolsChanged: "_codebuddy.ai/delegateToolsChanged"
};
```

**只有 `prompt` / `steer`，没有 followUp。** 「往流式中的领导会话塞一条回投消息」
这件事在 WorkBuddy 里**根本不存在**。

### 1.2 成员状态是「派生」的，不是「上报」的

核心类 `ChildAgentProjection`（`packages/workbuddy-core/src/conversations/...`），
类头 doc 是一份**完整的状态机文档**（含流转图、父终态收敛规则、三个触发路径、
核心不变量、CHANGELOG）。

状态派生链：

```js
// 从子会话记录派生终态，明确「spawn result 不算完成」
function derivePersistedTranscriptStatus(items) {
	let terminal;
	for (const item of items)
		if (isCancellation(item)) terminal = "killed";
		else if (isFailure(item)) terminal = "failed";
		else if (isTranscriptProgress(item)) terminal = void 0;   // 工具调用等中间态：清掉
		else if (item.type === "message" && item.role === "assistant"
		         && extractText(item.content).trim())
			terminal = "completed";                                // 见到有正文的 assistant 消息 = 完成
	return terminal;
}

function deriveChildState(transcript, result, missingTranscriptIsError,
                          resultCompletesInvocation = true) {
	const transcriptStatus = derivePersistedTranscriptStatus(transcript);
	if (transcriptStatus === "killed") return "cancelled";
	if (transcriptStatus === "failed") return "error";
	if (result && isCancelledRecord(result)) return "cancelled";
	if (result && isFailedRecord(result)) return "error";
	if (resultCompletesInvocation && result
	    && normalizeStatus$1(result.status) === "completed") return "completed";
	if (transcriptStatus === "completed") return "completed";
	if (transcript.length > 0) return "error";
	return missingTranscriptIsError ? "error" : "running";
}
```

**关键**：`resultCompletesInvocation` 默认参数在实例化处**显式传 `false`** ——
注释明写：

> `Agent tool_call` 是 **fire-and-forget**：父 CLI 8-9ms 就写 `result=completed`，
> **不代表子完成**。

### 1.3 状态帧会丢，且 WorkBuddy 明确接受这件事

类 doc 原文：

> 子若还是 running 一定是虚的（**终态事件走 ACP 实时通道、进程重启就丢**）

它的解法不是「保证帧不丢」，而是**冷启动 hydrate 后回读文件重算**：

```
路径 A · 正常状态机        路径 B · 冷启动 hydrate       路径 C · error 崩溃
User cancel                 进程重启 / sweep              daemon 崩溃 / auth 失败
   │                            │                            │
setState('terminated')      构造器 hydrate              直接赋值 state='error'
   │                            │                            │
setState 回调               onDirectPageLoaded          显式调用
   └──────────────┬─────────────┴────────────────────────────┘
                  ▼
          settleAllRunning(state)
```

核心不变量（原文摘）：

1. 子已是终态 → **保留权威值**（子有自己的 `SendMessage` / cancel 证据）
2. 父进入 `{terminated, error, failed}` → 强制把 running 子转成对应终态
3. 父 `idle` **只在冷启动 hydrate 完成后**触发 settle；运行时 idle **不触发**
   （保护「父暂停等子」窗口）
4. `settleAllRunning` **只动 `state === 'running'`**：已终态的子不能被父状态覆盖

### 1.4 领导怎么「拿到」成员产出

靠**读文件**，不靠收消息：

```js
function readTranscript(childFiles, id, label) {
	assertSafePathSegment(id, label);
	const fileName = `${id}.jsonl`;
	const raw = childFiles.get(fileName);
	return raw === void 0 ? []
	     : ConversationReplayHistory.resolveReplayHistory(parseJsonl$1(raw, fileName));
}
```

成员重新激活靠 `SendMessage` 工具（`attributeTeamReactivation`）：

> 已完成成员可由 `SendMessage` 在后续父 Request 中**重新激活**。它不是新的 Agent
> spawn，但 UI 仍需为本轮建立独立的 request-scoped 投影；旧轮投影必须保留。

成员归属靠**读子文件前缀**反查（`extractInitialAssignmentMember`）：扫子会话前
256 KB 内前 2 个换行，找 `summary="Initial task assignment for <memberId>"` 标记。

### 1.5 「已完成的产出」永不重投 —— 用内容比对去重

```js
function hasEquivalentAssistant(records, output) {
	return records.some((record) =>
		record.type === "message" && record.role === "assistant"
		&& equivalentText(extractText$1(record.content), output));
}
function normalizeAgentOutput(value) {
	return value.replace(/^\s*\[Agent ID:[^\]]+\]\s*/i, "")
	            .replace(/\s*\[Agent ID:[^\]]+\]\s*$/i, "").trim();
}
```

**用「正文内容」判断这条产出是不是已经在子会话里了** —— 天然幂等，不需要
「送没送到」的状态机。

---

## 二、我们现在的形状

### 2.1 推模式链路

```
成员跑完
  └→ hooks.onComplete（member-runner.ts）
       └→ team-runtime.markStatus(idle)                        同步·落盘
       └→ markPendingDelivery()                                 同步·落盘
       └→ emitTeamProgress()                                    同步·落盘
       └→ await deliverSessionMessage(memberSid, leaderSid, out) 异步·推进领导上下文
            └→ target.running ? host.prompt(composed,"followUp")
            : enqueue(target, ...)
                 └→ host.prompt(composed, "followUp")
                      └→ session.followUp() ← 入队即返回
                           └→ pi 消费时刻 = message_start + role==="user"
                                └→ splice + emit queue_update → queue_changed
                                     └→ confirmDelivery() 两拍销账
```

**整条链的复杂度都来自「推」**：入队 ≠ 送达、消费信号确认、两拍判据、
`pendingDelivery` 标记、`deliveryAwaiting` 清单、`clearQueue()` 丢失路径……

### 2.2 现状盘点

| 关注点 | 我们 | WorkBuddy |
|---|---|---|
| 成员产出存放 | 成员会话 JSONL（`~/.kamibuddy/sessions/*.jsonl`） | 子会话 JSONL（`<taskId>.jsonl`） |
| 领导获取产出 | **daemon 主动回投进领导上下文** | **领导需要时读子会话** |
| 成员状态真源 | 注册表 + 事件帧 | **子会话记录派生** |
| 事件帧丢了 | 已部分学（批次① `restoreTeam`） | 回读文件重算 |
| 交付确认 | `pendingDelivery` + `deliveryAwaiting` + 两拍 | **不需要**（读文件即事实） |
| 幂等 | 需要销账判据 | `hasEquivalentAssistant` 内容比对 |
| 相关工具 | `team_create/send/status/shutdown/plan_review/delegate_mode/delete` | `Agent` spawn + `SendMessage` 读/唤醒 |

---

## 三、改造方案

### 3.1 设计原则（照 WorkBuddy）

1. **子会话 JSONL 是唯一真源。** 成员跑到哪一步、有没有产出，**一律从文件读**；
   注册表只做缓存/索引，可随时重算。
2. **删掉「送达」这个概念。** 产出写进成员会话即视为交付 —— 不需要回投、
   不需要确认、不需要 `pendingDelivery`。
3. **领导要产出就自己读。** 提供读取通道（工具），而不是被动等消息。
4. **状态帧只做加速。** 帧到了即时更新；帧丢了不影响正确性（回读可复原）。

### 3.2 批次划分

#### 批次 ① · 新建成员会话读取层（对应 `readTranscript` / `derivePersistedTranscriptStatus`）

- 1.1 新增 `src/daemon/member-transcript.ts`：
  - `readMemberTranscript(sessionId): Promise<TranscriptItem[]>` —— 读
    `~/.kamibuddy/sessions/<id>.jsonl`，容错（文件不存在 → `[]`）
  - `deriveMemberStatus(items): "completed" | "cancelled" | "failed" | undefined`
    —— **逐字对齐** `derivePersistedTranscriptStatus`：
    `cancelled/killed/499` → killed；`failed/error/incomplete` → failed；
    中间态（工具调用/reasoning）→ 清掉；**有正文的 assistant 消息** → completed
  - `extractMemberOutput(items): string | undefined` —— 取最后一条有正文的
    assistant 消息文本
- 1.2 单测（新建 `member-transcript.test.ts`）：四种终态判定、中间态不误判、
  空文件、文件不存在、正文提取取最后一条

> **对应关系**：`derivePersistedTranscriptStatus` → `deriveMemberStatus`；
> `readTranscript` → `readMemberTranscript`；`isCancellation`/`isFailure`/
> `isTranscriptProgress` → 同构私有判定函数。

#### 批次 ② · 成员状态改为派生（对应 `deriveChildState` + `settleAllRunning`）

- 2.1 `team-runtime` 的 `restoreTeam`：成员状态**不再只信落盘的 `status` 字面量**，
  而是 `deriveMemberStatus(await readMemberTranscript(member.sessionId))` 优先：
  - 派生得到 `completed` → 恢复为 `closed`（正常完成）
  - 派生得到 `cancelled` → `interrupted`（原语义）
  - 派生得到 `failed` → `failed`
  - 派生不出（无正文）→ 回落到落盘 `status` 判据（现有 `isInterruptCandidate`）
- 2.2 **实现 `settleAllRunning` 等价物**：新增
  `settleRunningMembers(leaderId, reason)`，**只动 `status === "running"`** 的成员
  （核心不变量 4）；父终态 `{terminated, error, failed}` → 对应终态；
  **冷启动 hydrate 完成后的 idle 才触发**（不变量 3），运行时 idle 不触发
- 2.3 单测：已终态不被覆盖、running 被 settle、运行时 idle 不触发、
  hydrate idle 才触发

> **对应关系**：`deriveChildState` → 2.1 的分流；`settleAllRunning` → 2.2。

#### 批次 ③ · 领导读取产出（对应「读文件」+ `hasEquivalentAssistant`）

- 3.1 **新增 `team_read` 工具**：领导按成员名读取其最近一轮产出
  - 入参：`to`（成员名）、可选 `turns`（取最近 N 轮，默认 1）
  - 行为：读该成员会话 JSONL → 取 assistant 正文 → 返回
  - 这是**拉模式的核心落点**：领导拿产出不再被动等回投，而是主动读
- 3.2 `team_status` 每个成员行**附产出可读性**：`outputAvailable: boolean`
  （从文件派生，而非注册表标记）—— 领导据此决定要不要 `team_read`
- 3.3 **幂等去重**：`hasEquivalentMemberOutput(memberSessionId, output)`，
  逐字对齐 `hasEquivalentAssistant`（含 `normalizeAgentOutput` 的
  `[Agent ID: ...]` 前缀/后缀剥离）

> **对应关系**：`readTranscript` 的消费方式 → `team_read`；
> `hasEquivalentAssistant` → 3.3。

#### 批次 ④ · 回投降级为「通知」而非「交付」（可选，取决于用户取舍）

两条路：

- **4-A 完全删除回投**（最贴合 WorkBuddy）：
  删 `deliverSessionMessage` 的成员产出投递、`pendingDelivery`、
  `deliveryAwaiting`、`confirmDelivery`、`markDeliveryPending`、
  `getFollowUpQueue`、`queue_changed` 销账钩子。
  领导靠 `team_status` 发现「有产出了」→ `team_read` 取。
  **代价**：领导不再自动「被打断」，需要模型主动查（WorkBuddy 就是这样，
  靠 `SendMessage` 唤醒）。
- **4-B 保留一条极简通知**（推荐，折中）：
  成员完成后**只投一句「产出已就绪，用 team_read 取」**（不含正文），
  正文永远靠拉。这样既保留了「领导会被叫醒」的产品体验，
  又消除了「正文可能丢」的风险 —— **丢的只是一句可重发的提醒**。
  `pendingDelivery` 语义从「产出待捞」简化为「通知未送达」。

#### 批次 ⑤ · 文档与测试

- 5.1 更新 `docs/ARCHITECTURE.md` 的团队章节（推 → 拉）
- 5.2 `add-team-interrupt-diagnostics` spec 加「本 spec 的批次③被本 spec 取代」
  的交叉引用（保留历史，不删）
- 5.3 全量测试 + 五项门禁

---

## 四、必须一起回答的问题

1. **`clearQueue()` 那条丢失路径**：4-A 下彻底消失（不再有队列）；
   4-B 下仍存在，但损失的只是一句可重发提醒。
2. **领导怎么知道「成员跑完了」**：4-A 靠模型主动 `team_status` 轮询
   （WorkBuddy 模式）；4-B 靠那条极简通知。
3. **`interrupted` 与派生的关系**：派生出 `killed` → `interrupted`；
   派生不出且落盘是 running → `interrupted`（保守）。
4. **性能**：读文件有 IO 成本。WorkBuddy 的做法是只读**尾部摘要**
   （`loadTailSummary`）+ **前缀 256 KB**（`readChildPrefix`）—— 我们也照做，
   不整文件读。

## 五、明确不做

- **不引入 ACP 协议**：WorkBuddy 的 `ConversationAcpMethod` 是它的 IPC 层，
  我们已有自己的 IPC，照抄会牵动全局。
- **不做 `SendMessage` 的重激活语义**：WorkBuddy 的 `SendMessage` 兼「读」与
  「唤醒」两职（会为新一轮建独立投影）；我们已有 `team_send` 负责唤醒，
  `team_read` 只负责读，职责更干净。
- **不删 `add-team-interrupt-diagnostics` 的历史记录**：那是三次复现的证据链。

## 六、验证

- [ ] v.1 `tsc --noEmit` 干净
- [ ] v.2 新增单测：`member-transcript.test.ts`（批次①）、
      `team-runtime.test.ts` 的派生恢复用例（批次②）、
      `team-tools.test.ts` 的 `team_read` 用例（批次③）
- [ ] v.3 五项门禁：`check:deps` / `check:tokens` / `check:model-experience` /
      `check:invariants` / `check:expert-assets`
- [ ] v.4 全量 vitest
- [ ] v.5 真机：成员跑完后领导调 `team_read` 能拿到完整产出
- [ ] v.6 真机：杀掉进程重启，成员状态由派生正确复原（不再靠注册表标记）
- [ ] v.7 真机：**领导流式输出与成员完成重叠**时不再有任何丢失
      （这个场景在 4-A/4-B 下都应天然无害）
