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

---

## 实施后修正（2026-09-19，真机复现驱动；本文档其余部分为冻结记录）

> 本层上线后用户仍复现「第一个人能做好、第二个没有动静」。排查结论：**拉模式在最底层
> 静默失效**，且专家团资产仍在教已被删除的推模式。两条都修了。

### 修正 ① · 成员会话路径算错了（P0，真正的病根）

`member-transcript.ts` 原来按 `<sessionsDir>/<sessionId>.jsonl` 拼路径，而 pi 写的是
**`<文件时间戳>_<sessionId>.jsonl`**（`开源项目/pi/packages/coding-agent/src/core/session-manager.ts:953`）。
后果（真机实测，2026-09-19 12:27 会话，成员 谭溯源 的文件 978 KB）：

- `readMemberTranscriptView` 一律返回空 → `team_status` **从不**出现「有产出可读」；
- `team_read` 永远回「暂无产出」；
- `restoreTeam` 的派生永远回落，状态一律按落盘字面量算。

领导据此判定「团队通道坏了」，改用子代理重做（现场原话：「落盘没有生效，我改用直接
回传的方式要这份初调成果」）。**跨 4 次会话（09-18 14:22 / 18:02 / 18:35、09-19 12:27）
的事故形状完全一致**：第一个成员每次都跑出 336 KB~1 MB 的完整产出，领导一次都没看到，
**其余成员因此从未被派活**（它们的会话文件全部停在 3 KB 的到岗确认）—— 这就是「第一个人
能做好，第二个没动静」的真身。

单测没拦住，是因为它**拿本函数自己算出的路径造文件、再用同一个函数读回来**（自洽循环），
与 pi 的真实命名无关。修法：`memberSessionPath` 先试直命名、再按目录索引反查
`<任意前缀>_<id>.jsonl`（索引带 TTL 缓存）；新增「按真实命名造文件」的回归用例，并按
纪律验证过它会变红（把实现改回直接拼接 → 6 例失败）。

### 修正 ② · 读文件加上界（512 KB 尾部）

§四.4 原本就要求「只读尾部摘要」，实施时以「成员产出上限 24k 字符、单轮规模可控」为由
推迟 —— 那个前提是错的（累积文件已到 1 MB）。`emitTeamProgress` 在**成员每次工具调用**
后都要算 `outputAvailable`，于是「每个事件 × 每个成员 × 整个文件」全量解析。修正 ① 让这条
路径**第一次真正开始读文件**，不加界就会把 daemon 主线程拖住。现在只读最后 512 KB 并丢掉
首行半行；真机实测 1 MB 会话读取 4 ms、产出完整取回（10,737 字符）。

### 修正 ③ · 恢复时保留 sessionId

拉模式读产出只需要**会话文件**，不需要宿主。原来恢复时把 sessionId 清成 `undefined`
（理由是「只会指向一个死宿主」—— 那只对 team_send 成立），于是重启后 `team_read` 读不到
东西，而 `team_send` 的拒绝文案仍在承诺「产出可用 team_read 取回」—— 承诺当场落空。
发消息侧不受影响：`resolveMemberSessions` 对 closed / interrupted 一律响亮拒绝。

### 修正 ④ · 专家团资产仍在教推模式（同样致命）

`resources/experts/{gpt-researcher-team,mvp-dev-expert-team,openspec-doc-team,stock-partner-team}/`
的 `expert.md` 与 `agents/*.md` 里写着「成员完成一轮后会**自动把最终产出回投到本会话**，
**你不需要轮询**」，stock-partner 甚至写「**禁止**去读成员文件——回投正文才是权威内容」。
这些话直接进主理人的提示词：**即使代码修好，主理人也会照着干等**。已全量改为拉模式措辞
（29 个文件 / 74 处，只动文案，frontmatter 与工具面一字未改；`check:expert-assets` 复跑通过）。
`team_create` 的旧回执（「本会话将在它们完成时收到回投消息」）同批改掉，并在
`team-tools.ts` 的模型体验契约里立下「回执不许出现推模式措辞」这条规矩。

## 否决方案

- **否决「让 pi 的会话文件名改成裸 sessionId」**（改 pi 或包一层 SessionManager）：
  动的是上游行为，且对存量文件名无效；在解析层兜住更小、更稳。
- **否决「不加上界，改成长会话截断产出」**：那会改变产出语义 —— 用户要的是完整正文。
- **否决「给成员产出加一条极简通知（4-B）」**：本 spec 已选 4-A；重开它等于把
  「投递可能失败」请回来（三次事故的共同形状）。领导侧的唤醒改由资产文案 + `team_status`
  的「有产出可读」提示驱动。
- **否决「在 emitTeamProgress 里换轻量判据（只看 mtime / 只信注册表标记）」**：
  `outputAvailable` 必须由文件内容派生（拉模式的唯一真源纪律），尾部读取已把它压到 O(窗口)。

---

## 实施后修正 ②（2026-09-19 真机复查：唤醒成员时状态没翻，且计划裁决那条路是坏的）

用户实测报「专家在干活却显示**已完成**」。真机取证（15:05 那次 `research-ai-eda-pcb`）：

- 该会话 6 次 `team_status` 里，**07:09→07:35 的 5 次 `running` 恒为 0**；同一时段成员会话文件
  一直在写、`team_read` 能取回 7–13 KB 报告。注册表状态是 UI 与 `team_status` 的唯一来源。

**根因**：成员首轮跑完是 `idle`（投影折成「已完成」），而 `team_send` 唤醒它时**没有任何东西把
状态翻回 `running`** —— 投递与状态不成对，被唤醒的成员在「✓ 已完成」的招牌下工作几十分钟。

**修法**：新增 `wakeMember(leaderSessionId, memberName, memberSessionId, text)`，把「投递」与
「翻状态」绑成一次调用（先翻状态再投递；投递抛错则标 `failed` 并如实上报，不留假 running）。
三处消费：`team_send`（含 `@all`）、`team_plan_review` 的 approve/reject。`team_shutdown` 不走它
（它要的是 `closing` 这个独立态）。

**同批发现的第二个 bug**：`team_plan_review` 的 approve/reject 走的是 `deliverSessionMessage`，
而那条路按 `bucketsById` 找目标会话，**成员会话根本不在 `bucketsById` 里**（只在
`memberHandlesBySession`）→ 每次都抛「目标会话不存在：<成员会话 id>」。也就是说**计划裁决一直是死的**。
改用 `wakeMember` 后这条路才真正通。顺带把 `team_shutdown` 收尾语里「这条输出会自动回投给主理人」
（推模式残留措辞）改成拉模式说法。

**待清理（本批没做，避免混关注点）**：`deliverSessionMessage` 与 `teamMailbox`（`daemon/mailbox.ts`）
在本次改动后**已无任何调用方**（只剩 `teamMessaging` 导出与注释），是推模式时代的遗留。删除它要连
`mailbox.ts` 与其单测一起动，属独立改动。

**没有单测护栏**（如实说明）：三处消费点都在 daemon 闭包内、依赖真实宿主，现有测试基建
（`team-runtime.test.ts` 只覆盖纯注册表）够不到这条接线；本批靠真机复验（见下），
要机械化只能先有 daemon 层集成测试基建。

### 否决方案

1. **否决「在 `recordProgress` 里翻 running」**：那条路是**成员事件**（正在跑时才来事件），
   而 bug 的窗口是「消息已投、成员还没起跑」——事件还没来，翻不了。
2. **否决「靠 UI 用文件 mtime 反推 running」**：注册表状态是 `team_status` 与投影的同一份来源，
   UI 单独反推会让两处说的不一样（模型和用户看到不同的状态）。
3. **否决「`sendToMembers` 保持 fire-and-forget（`void …catch(()=>{})`）只补 markStatus」**：
   投递失败会被吞掉，而状态已经翻成 running → 留下一个假的「运行中」。改成 await + 失败标 `failed`，
   让「成员会话丢了」这件事响亮地回到领导眼前。
4. **否决「让 `deliverSessionMessage` 兼容成员会话（给成员也建 bucket）」**：那等于把成员会话
   拉回用户会话的互斥链与记忆机制里，与「成员是独立长会话、由 `memberHandlesBySession` 管」
   的现有结构冲突；正确做法是让调用方走对的那条路。

