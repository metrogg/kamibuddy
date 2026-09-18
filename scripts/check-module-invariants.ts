/**
 * 模块不变量登记门禁 —— spec: adopt-dsh-disciplines Task 1.3（缩小版）。
 *
 * 形态（有意**不**照搬 Cordis 的 `./invariant` 伴随插件）：登记表是一张**集中表**
 * （下面的 INVARIANTS / EXEMPT），机械校验扫 `SCOPE` 圈定的模块 —— 每个模块都要回答
 * 同一个问题「有没有可**独立分叉观测**的关系」：
 *   - 有 → 写进 INVARIANTS：`relationship`（那条关系）+ `observation`（在哪儿能独立观测到分歧）；
 *   - 没有 → 写进 EXEMPT：**必须写理由**（无理由的豁免与没登记一样失败）。
 *
 * 首轮只覆盖**有明确不变量的**四个域（不追求覆盖 shared/core/daemon 全部）：
 *   会话事件折叠 / 提示词字节稳定 / 权限判定 / 台账口径。
 * 判据是「可独立观测」：同一份输入在两条独立路径上走，能不能分叉出不同结果 ——
 * 能，就值得钉；不能（如纯类型与常量模块），就写理由豁免。
 *
 * 【2026-09-17 修】SCOPE 原先只有 shared / core / extensions 三处，**没有 daemon 域**
 * —— 而 spec 要求首轮覆盖 `shared/`、`core/`、`daemon/`。于是 daemon 侧两个
 * 「结论要能追溯到另一条路径」的产出（统计聚合口径、提示词预览）不会被门禁要求登记，
 * 改动让它们与真实来源分叉时没有任何东西变红。补上这两个域 + 首轮登记。
 *
 * 【2026-09-17 扩】spec: add-managed-runtimes 阶段 1 落进 `src/core/runtime-store.ts`
 * 与 `src/core/runtimes/**`，于是新增第五个域「托管运行时」：这些模块之间确实有
 * 可独立分叉观测的关系（「读侧判就绪」 vs 「磁盘事实」两套判据一旦各写一遍就会分叉，
 * 症状是「current 写了但环境不可用」），所以它们进 INVARIANTS 而不是 EXEMPT。
 *
 * 【2026-09-17 扩二】同 spec 阶段 3 / 5 落进 `src/core/runtime-inventory.ts`（开关状态的
 * 唯一读点 + 清单判据）与 `src/shared/runtimes.ts`（模型可见清单一处的渲染）：这两处
 * 是「设置页那一行」与「模型 `python_env` 段」的**共同上游**，各判一遍的症状是
 * 「界面说已被禁用、模型那边说找不到」（或反过来：禁用了却仍把路径交给模型），
 * 所以同域登记。
 *
 * 【2026-09-17 再扩】spec: add-managed-runtimes 阶段 4 落进 `src/core/audit-log.ts`，
 * 新增第六个域「审计口径」：这条关系确实可独立分叉观测 —— 面板查一次、导出查一次
 * （或清空时先补留痕再删文件），三处的结论就会不一致，而症状只是「导出的和面板
 * 看到的不一样」，没有任何测试会变红。
 *
 * 【2026-09-18 扩三】设计变更「运行时从随包载荷改为**纯按需联网下载**」：新增
 * `src/core/runtimes/download.ts`（下载与校验的纪律）与 `artifact.ts`（取件三道门），
 * 旧的 `bundled-payload.ts`（随包载荷复制）删除、其探测部分收敛为 `payload-probe.ts`。
 * 这三处的共同关系是「校验不过不许进位 + 未安装时 ensure 不下载」，症状是
 * 「装好了但一跑就崩」或「用户没点安装却下了几百 MB」—— 都是只在真实用户机器上
 * 才暴露、单测不钉就没人拦得住的类型。
 *
 * 与 `scripts/check-model-experience.ts` 的分工：那个管「模型看到什么」，这个管
 * 「模块之间的哪个关系不许分叉」。两者都不替代测试 —— 表里 `observation` 指的就是
 * 那条关系现在由哪个测试钉着；改动让断言失效时，登记表也会在评审里被看见。
 *
 * 用法：npm run check:invariants（纳入 npm run check）
 */

import { existsSync, readdirSync } from "node:fs";

/** 首轮扫描范围。每个 pattern 是一个「域」：域内新增模块必须登记或写理由豁免。 */
const SCOPE: readonly { readonly dir: string; readonly file: RegExp; readonly why: string }[] = [
	{ dir: "src/shared", file: /^conversation\.ts$/, why: "会话事件折叠" },
	{ dir: "src/shared", file: /^observability\.ts$/, why: "台账 / 统计的口径与形状" },
	{ dir: "src/core", file: /^(system-)?prompt-composer\.ts$/, why: "提示词组装（字节稳定的产出侧）" },
	{ dir: "src/core", file: /^run-ledger\.ts$/, why: "运行台账（写入纪律与闭合）" },
	{ dir: "src/extensions", file: /^prompt-switch\.ts$/, why: "提示词与注入的装配点" },
	{ dir: "src/extensions", file: /^permission-[a-z-]+\.ts$/, why: "权限判定链与规则引擎" },
	{ dir: "src/daemon", file: /^usage-stats\.ts$/, why: "台账口径（跨会话统计的聚合产出侧）" },
	{ dir: "src/daemon", file: /^prompt-preview\.ts$/, why: "提示词字节稳定（预览与真实组装同源）" },
	{ dir: "src/core", file: /^runtime-store\.ts$/, why: "托管运行时（版本指针与实例完成标记）" },
	{ dir: "src/core/runtimes", file: /^machine\.ts$/, why: "托管运行时（相位推进与终止判定）" },
	{ dir: "src/core/runtimes", file: /^registry\.ts$/, why: "托管运行时（安装/发布的落点口径）" },
	{ dir: "src/core/runtimes", file: /^python\.ts$/, why: "托管运行时（python 落点解析的唯一真源）" },
	{ dir: "src/core/runtimes", file: /^diagnostics\.ts$/, why: "托管运行时（诊断报告的现场口径）" },
	{
		dir: "src/core/runtimes",
		file: /^(artifact|download|payload-probe|node|gitbash|injection)\.ts$/,
		why: "托管运行时（取件/下载/探测/注入：纯按需安装的形状与校验口径）",
	},
	{ dir: "src/core", file: /^audit-log\.ts$/, why: "审计记录（三类来源同构、查询截断与清空留痕）" },
	// 阶段 3 / 5：开关状态与模型可见清单各一处判据（设置页那一行与模型注入不许分叉）。
	{ dir: "src/core", file: /^runtime-inventory\.ts$/, why: "托管运行时（开关状态的唯一读点与清单判据）" },
	{ dir: "src/shared", file: /^runtimes\.ts$/, why: "托管运行时（模型可见清单的文案与渲染）" },
];

/** 首轮必须出现的四个域 + 托管运行时（阶段 1）+ 审计口径（阶段 4）。 */
const REQUIRED_CONCERNS = [
	"会话事件折叠",
	"提示词字节稳定",
	"权限判定",
	"台账口径",
	"托管运行时",
	"审计口径",
] as const;

interface InvariantEntry {
	/** 所属域（必须在 REQUIRED_CONCERNS 里）。 */
	readonly concern: string;
	/** 仓库相对路径。 */
	readonly module: string;
	/** 可独立分叉观测的关系：谁与谁必须一致 / 必须有序 / 必须闭合。 */
	readonly relationship: string;
	/** 这条关系现在由哪儿独立观测（测试文件或纯函数入口）。 */
	readonly observation: string;
}

/** 有明确不变量的模块 —— 首轮四个域。 */
const INVARIANTS: readonly InvariantEntry[] = [
	{
		concern: "会话事件折叠",
		module: "src/shared/conversation.ts",
		relationship:
			"同一事件流折叠出的视图，必须与「按同一顺序逐事件应用」的增量结果一致 —— daemon 与 renderer 共用这一个 reducer，两端各自折叠必然分叉（症状是「刷新后内容变了」）",
		observation: "src/shared/conversation.test.ts",
	},
	{
		concern: "提示词字节稳定",
		module: "src/core/prompt-composer.ts",
		relationship:
			"同一输入（骨架 / 片段 / 模式 / 风格 / 人格 / piContext）产出的 systemPrompt 逐字节相同；产物的任何差异都必须能追溯到输入的差异",
		observation:
			"src/core/prompt-composer.test.ts（段序与槽位）+ src/extensions/prompt-switch.test.ts（会话内字节稳定）",
	},
	{
		concern: "提示词字节稳定",
		module: "src/core/system-prompt-composer.ts",
		relationship:
			"会话内两次组装逐字节相等：逐轮事实（时间 / 记忆内容 / 个性化 / cwd）与随机器变的事实（托管 Python 解释器路径）绝不出现在产物里",
		observation: "src/extensions/prompt-switch.test.ts 的字节稳定用例（work × code × 三种模式）",
	},
	{
		concern: "提示词字节稳定",
		module: "src/extensions/prompt-switch.ts",
		relationship:
			"before_agent_start 必须返回整串 systemPrompt；两条上下文快照经持久 message 落进会话文件（落位在本轮用户消息之后），与活分支末条同类型快照逐字节相同时不追加 —— 既有条目一律不改写（append-only，逐条引用与字节都不变）",
		observation: "src/extensions/prompt-switch.test.ts",
	},
	{
		concern: "权限判定",
		module: "src/extensions/permission-policy.ts",
		relationship:
			"判定链有序：靠后的阶段不能放行靠前阶段已拒的动作；同输入同输出（纯函数，无隐藏状态）",
		observation: "src/extensions/permission-policy.test.ts",
	},
	{
		concern: "权限判定",
		module: "src/extensions/permission-rules.ts",
		relationship:
			"最严获胜：链式命令拆分后任一段 deny ⇒ 整体 deny；全部段 allow ⇒ allow；否则 unmatched（调用方维持高风险询问）",
		observation: "src/extensions/permission-rules.test.ts",
	},
	{
		concern: "权限判定",
		module: "src/extensions/permission-gate.ts",
		relationship:
			"门只翻译不决策：拦 / 不拦的结论必须与 permission-policy.decide 一致；unattended 下 ask 一律转拒（fail-closed）",
		observation: "src/extensions/permission-gate.test.ts",
	},
	{
		concern: "台账口径",
		module: "src/core/run-ledger.ts",
		relationship:
			"seq 单调无空洞（写盘成功才消耗序号）+ run 闭合（读到未闭合 run 必须补合成 run_end{interrupted}，不截断历史）",
		observation: "src/core/run-ledger.test.ts",
	},
	{
		concern: "台账口径",
		module: "src/daemon/usage-stats.ts",
		relationship:
			"同一批会话的三个视图必须同源同口径：总量四桶之和 = 模型明细 tokens 之和 = 每日 tokens 之和（都含缓存读写）；子代理的用量照计入 token 与费用，但不进会话维度（会话数 / 消息数 / 热力图 / 工具排行）—— 两侧口径各自独立累加，改一处不会连累另一处",
		observation:
			"src/daemon/usage-stats.test.ts（「模型明细含缓存读写，token 合计与总量一致」钉视图一致；「会话维度排除子代理，但 token 与费用照算」钉两个维度的进出）",
	},
	{
		concern: "提示词字节稳定",
		module: "src/daemon/prompt-preview.ts",
		relationship:
			"预览的分段与字数必须来自与真实会话**同一个** assembleSystemPrompt（同段序、同 read/bash/use_skill 技能段门控、同专家人格路径）；允许的差异只有文件头列出的两条（无活会话 ⇒ piContext 置空、styleId 三态），不得在 daemon 侧另写一份镜像组装",
		observation:
			"src/daemon/prompt-preview.test.ts（技能段门控与真实组装同一条规则 / 专家人格同一条路径），被删掉的镜像门控是这条关系的由来",
	},
	{
		concern: "托管运行时",
		module: "src/core/runtime-store.ts",
		relationship:
			"「读侧判就绪」必须等价于「current 指向的实例带 manifest」，且 current 是写入顺序的最后一步（改名进位 / 复验 / 写 manifest 都在它之前）—— 顺序一换，崩在中间就会留下「看起来就绪」的状态（转换时才炸在用户面前）",
		observation:
			"src/core/runtime-store.test.ts 的三个崩溃点用例（半成品 / 已进位未标记 / 已标记未发布）+ src/core/runtimes/python.test.ts 的崩溃续跑用例",
	},
	{
		concern: "托管运行时",
		module: "src/core/runtimes/machine.ts",
		relationship:
			"驱动器给出的结论必须就是状态机自身的结论：ready ⇔ machine.ready(state)，失败归因必须取自 machine.failure(state)；撞步数上界要响亮失败而不是默认成功",
		observation: "src/core/runtimes/machine.test.ts（收敛 / 失败归因 / 不收敛三例）",
	},
	{
		concern: "托管运行时",
		module: "src/core/runtimes/registry.ts",
		relationship:
			"**ensure 只探不装**（未安装 ⇒ not-installed，绝不下载/安装；唯一自愈是「已完整进位、只差 current」时补指针，纯文件操作），**install/reset 才联网**（覆盖口是唯一就地安装的例外；旧路径走「装进托管根」）；安装只写 `<root>/<id>/<version>` 这一处落点，且 current 只在进位 + 只读复验通过后写",
		observation:
			"src/core/runtimes/python.test.ts（全新安装 / 崩溃点 / 重置 / 覆盖口就地 / 未安装时 ensure 零 spawn 五组）+ node.test.ts 与 gitbash.test.ts 的「纯按需的门」各一组",
	},
	{
		concern: "托管运行时",
		module: "src/core/runtimes/python.ts",
		relationship:
			"venv 落点的优先级必须唯一：HTML_TO_DOCX_VENV > 托管根 current（且该实例完整）> 既有 ~/.venv-html-to-docx > 待安装；两条路径并存时以托管为准，坏指针被忽略并如实上报",
		observation: "src/core/runtimes/python.test.ts 的「落点优先级（唯一真源）」一组",
	},
	{
		concern: "托管运行时",
		module: "src/core/runtimes/diagnostics.ts",
		relationship:
			"报告里的状态、路径与缺失项必须来自现场采集（resolve + inspect + store 列举 + 落盘日志），不得自判一份或另写一套说法",
		observation: "src/core/runtimes/python.test.ts 的「诊断报告」一组（缺依赖指名 / 指针被忽略 / 最近失败来自日志）",
	},
	{
		concern: "托管运行时",
		module: "src/core/runtimes/download.ts",
		relationship:
			"字节先写 `<发行物>.part`、**校验通过才**改名成发行物：sha256 / 体积不符必须丢掉暂存并抛校验类错误（kind=sha256|size），目标文件不许出现；取消保留 `.part`（续传点）但绝不当成功；续传时已有字节**也要进 sha256**（否则续传就成了绕过整包校验的后门），且续传结果对不上时必须从零重下一次、重试照样全量校验",
		observation:
			"src/core/runtimes/download.test.ts（校验失败不许进位 / 体积下限 / 取消留续传点 / 中断可续 / 服务端忽略 Range / 续传 sha 不符重下 六组）",
	},
	{
		concern: "托管运行时",
		module: "src/core/runtimes/artifact.ts",
		relationship:
			"取件的三道门顺序不可换且都**不得静默放行**：① 官方校验文件交叉核对（取不到只记 warning，取到却不一致即中止且**不下载**）② 发行物 sha256（镜像只是传输通道）③ 解包后必备文件（含许可文本）。任一不过都不得进位 —— 由 registry 在 catch 里清掉暂存目录保住这一点",
		observation:
			"src/core/runtimes/node.test.ts（官方校验文件不一致 ⇒ 未下载即中止 / 体积异常 / sha256 不符三例）+ gitbash.test.ts（下载校验不过 ⇒ 不进位）",
	},
	{
		concern: "托管运行时",
		module: "src/core/runtimes/payload-probe.ts",
		relationship:
			"必备文件（含许可文本）判在 `initial()`（缺了既不 spawn 也不假装成功）、探针只跑一次；gitbash 的探针 PATH 注入必须与注入层 `RUNTIME_ENV_LAYOUT.gitbash` **同一份**（实测不注入时 `bash -c \"git --version\"` 读到的是机器上另一个 git，那样的探针验的不是我们装的那一份）",
		observation:
			"src/core/runtimes/node.test.ts 的「四态」一组 + gitbash.test.ts 的「探针自带注入」与「四态」两组",
	},
	{
		concern: "托管运行时",
		module: "src/core/runtimes/node.ts",
		relationship:
			"许可文本必须留在实例必备文件里（MIT 义务的机械化断言），且**三者同源**：描述符 version、发行物文件名、探针解析出的版本串（`vX.Y.Z`）—— 改版本只改一处而漏改另一处时，安装或复验必须变红而不是静默装错版本；三道 sha256 门（整包 / 官方校验文件 / 解包后的 node.exe）任一不过都不许进位",
		observation:
			"src/core/runtimes/node.test.ts 的「合规义务被钉住」「版本串解析」「解包后 node.exe 复验」「sha256 不符」四组",
	},
	{
		concern: "托管运行时",
		module: "src/core/runtimes/gitbash.ts",
		relationship:
			"运行期解包**只用发行物自带的 SFX 解包器**（不引入 7-Zip 依赖、解包发生在整包 sha256 通过之后），且解包后必须把 GPLv2 §3 的对应源码获取方式拷进实例根（义务随二进制走）；上游版本串 `2.55.0.windows.N` ↔ 我们钉的 `2.55.0.N` 的归一化只有这一处",
		observation:
			"src/core/runtimes/gitbash.test.ts 的「运行期解包」三组与「版本串归一化」一组",
	},
	{
		concern: "托管运行时",
		module: "src/core/runtimes/injection.ts",
		relationship:
			"注入判据只有三条且按序短路（总开关关闭 / 逐项禁用 / 尚无实例 ⇒ 都不注入），且每个运行时的「禁用/未就绪」必须在决定里被**指名**（模型侧据此区分「被禁用」与「找不到」）；PATH 拼法唯一（`prependPath`，与安装期探针共用），键名沿用基线的那个",
		observation: "src/core/runtimes/injection.test.ts（四个判据 + PATH 拼法一组）",
	},
	{
		concern: "审计口径",
		module: "src/core/audit-log.ts",
		relationship:
			"面板、清空回读与导出必须走**同一条查询**（readAuditRecords）：面板是它的截断档、导出是它的全量档；且清空必须**先删后补**——顺序一换，清空动作的留痕会被自己删掉，「谁在什么时候清空了记录」就永远答不出来（三类来源的记录形状也只在 writeAuditRecord 一处成立）",
		observation:
			"src/core/audit-log.test.ts（三类同构 / 过滤与上限 / 清空后只剩留痕且新增照常 / 导出含面板每一行）",
	},
	{
		concern: "托管运行时",
		module: "src/core/runtime-inventory.ts",
		relationship:
			"开关只有一个读点（readRuntimeSwitch：总开关 × 逐项），且**禁用 ⇒ 不给路径**（entryOf 在禁用时不出 activeDir / executable 两格）—— 设置页那一行与模型侧 `python_env` 段必须由这一份判据产出，任一处另判一遍就会出现「界面说禁用、模型那边说找不到」或「禁用了却仍把路径交给模型」",
		observation:
			"src/core/runtime-inventory.test.ts（总开关关 ⇒ 三项都 disabled 且无路径 / 逐项关只影响该项 / 显式标记落盘可区分「关过」与「没设过」）",
	},
	{
		concern: "托管运行时",
		module: "src/shared/runtimes.ts",
		relationship:
			"模型可见的运行时清单正文只由 renderRuntimeEnvSection 一处生成，且「被用户禁用」与「找不到（未就绪）」必须是两句不同的话（前者指向用户去设置页开启，后者指向等待 / 如实告知）—— 两句话合并成一句「不可用」，模型就只能猜自己该做什么",
		observation:
			"src/core/runtime-inventory.test.ts（禁用项文案含「已被用户禁用」且不含「尚未准备」；未就绪项反之）+ src/core/session-host.test.ts 的 python_env 条目级断言",
	},
];

/** 回答了「没有可独立分叉观测的关系」的模块 —— 理由必填。 */
const EXEMPT: readonly { readonly module: string; readonly reason: string }[] = [
	{
		module: "src/shared/observability.ts",
		reason:
			"只定义台账 / 统计的数据形状、常量与纯派生函数（三桶计费口径、内容指纹、tok/s）：自身没有状态、不写盘，没有可独立分叉的观测关系 —— 这些口径的一致性由消费方（run-ledger / cache-prefix / 会话统计）的测试观测。",
	},
];

interface Failure {
	readonly subject: string;
	readonly message: string;
}

const failures: Failure[] = [];

for (const concern of REQUIRED_CONCERNS) {
	if (!INVARIANTS.some((entry) => entry.concern === concern)) {
		failures.push({ subject: concern, message: "登记表里没有任何该域的不变量条目" });
	}
}

for (const entry of INVARIANTS) {
	const subject = entry.module;
	if (!REQUIRED_CONCERNS.includes(entry.concern as (typeof REQUIRED_CONCERNS)[number])) {
		failures.push({ subject, message: `concern「${entry.concern}」不在首轮四域里（${REQUIRED_CONCERNS.join(" / ")}）` });
	}
	if (!existsSync(entry.module)) {
		failures.push({ subject, message: "登记条目指向不存在的模块（陈旧条目）" });
	}
	for (const [field, value] of Object.entries({ relationship: entry.relationship, observation: entry.observation })) {
		if (value.trim() === "") failures.push({ subject, message: `${field} 为空 —— 空条目与没登记一样` });
	}
	if (EXEMPT.some((exempt) => exempt.module === entry.module)) {
		failures.push({ subject, message: "同一模块不能既登记不变量又声明豁免" });
	}
}

for (const entry of EXEMPT) {
	if (!existsSync(entry.module)) {
		failures.push({ subject: entry.module, message: "豁免条目指向不存在的模块（陈旧条目）" });
	}
	if (entry.reason.trim() === "") {
		failures.push({ subject: entry.module, message: "豁免必须写理由：说明为什么本模块没有可独立分叉观测的关系" });
	}
}

/** 扫描范围内应被覆盖的模块（去重排序）。 */
function inScope(): string[] {
	const files = new Set<string>();
	for (const pattern of SCOPE) {
		for (const entry of readdirSync(pattern.dir, { withFileTypes: true })) {
			if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
			if (pattern.file.test(entry.name)) files.add(`${pattern.dir}/${entry.name}`);
		}
	}
	return [...files].sort();
}

const scope = inScope();
for (const file of scope) {
	const registered = INVARIANTS.some((entry) => entry.module === file);
	const exempt = EXEMPT.some((entry) => entry.module === file);
	if (!registered && !exempt) {
		failures.push({
			subject: file,
			message: "缺登记且无理由：要么在 INVARIANTS 里写清那条可独立分叉观测的关系，要么在 EXEMPT 里写清为什么没有",
		});
	}
}

if (failures.length === 0) {
	console.log(
		`check-module-invariants: ${scope.length} 个在范围模块（不变量 ${INVARIANTS.length} / 豁免 ${EXEMPT.length}）全部有登记。`,
	);
	for (const entry of INVARIANTS) console.log(`  不变量  [${entry.concern}] ${entry.module} ← ${entry.observation}`);
	for (const entry of EXEMPT) console.log(`  豁免    ${entry.module}`);
	process.exit(0);
}

console.error("check-module-invariants 失败：");
for (const failure of failures) {
	console.error(`  ${failure.subject}: ${failure.message}`);
}
console.error("\n登记表形态：每个模块回答「有没有可独立分叉观测的关系」——");
console.error(`  有 → INVARIANTS（concern / module / relationship / observation），首轮四域：${REQUIRED_CONCERNS.join(" / ")}`);
console.error("  没有 → EXEMPT（module / reason），理由必填。");
process.exit(1);
