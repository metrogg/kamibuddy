/**
 * MetaFold 摘要词汇表：一段连续工具卡 → 一行意图标题（summarizeToolRun）
 * 与主导工具名（leadToolName），机制对标 WorkBuddy。
 *
 * 本文件原本还承载 v1 渲染块流（buildRenderBlocks：回合切分 + 段折叠 +
 * 回合头部/取消占位的块流定位）。轮折叠 + 终答锚点落地后（spec:
 * add-turn-fold-and-anchor），切轮/分段/豁免全部由 renderer/fold-view.ts
 * 的 fold plan 与 renderer/turn-fold.ts 的轮视图接管，v1 块流随之退役——
 * 分段规则只能有一套，两份并存必然漂移。这里保留的是两套折叠共用的
 * 词汇表（fold-view 的批次摘要同样调这两个函数，AGENTS.md §4）。
 */

import type { ToolCard } from "./session-events.ts";

/* ── 意图标题 ──────────────────────────────────────────────────── */

/**
 * 意图类别：先只做四类（读取 / 搜索 / 命令 / 写入），其余一律归入 other 降级。
 *
 * WorkBuddy 的工具注册表（TOOL_DESCRIPTORS）分了 10 个 group，我们只搬四类 ——
 * 组头是给人看的一行字，「研究/诊断/计划/协作/外部」这些组名在中文里区分度低，
 * 维护一张 40 工具的 canonical 大表不值当（spec: add-intent-grouped-tool-folds
 * 的「明确不做」）。类别细分不够时宁可就地说得通，也不要大表漂移。
 */
type IntentCategory = "read" | "search" | "command" | "write" | "other";

/** 工具名 → 单工具标题的动作词 + 所属类别。 */
interface ToolIntent {
	readonly category: IntentCategory;
	readonly action: string;
}

/**
 * 单工具标题的动作词，中文文案取自 WorkBuddy 的 metaFold.summary.action.*
 * （zh 词条），只有 read 例外：WB 作「读取」，这里取「查看」—— 组头表达的是
 * 意图（「查看 README.md」）而不是计数单位（「读取 1 个文件」），spec 的
 * Scenario 也按「查看」钉死。
 */
const INTENTS: Readonly<Record<string, ToolIntent>> = {
	read: { category: "read", action: "查看" },
	ls: { category: "read", action: "查看文件列表" },
	grep: { category: "search", action: "搜索代码" },
	find: { category: "search", action: "搜索文件" },
	bash: { category: "command", action: "运行命令" },
	powershell: { category: "command", action: "运行命令" },
	write: { category: "write", action: "写入" },
	edit: { category: "write", action: "修改" },
};

/**
 * 表外工具（MCP 工具、web_search/web_fetch、present_files…）的降级原子。
 * 单例复用：类别聚合按值判等，不照搬 WorkBuddy 的别名表 —— 我们只有 8 个
 * 内置工具名，模型只会原样喊出它们，别名映射没有用武之地。
 */
const OTHER_INTENT: ToolIntent = { category: "other", action: "执行操作" };

/**
 * 类别模板，原样搬 WorkBuddy 的 zh 词条：
 *   withTopic  同类别多工具整句，{topic} 为主题占位（metaFold.summary.group.*）
 *   noTopic    取不到主题时的整句（metaFold.summary.groupNoTopic.*）——
 *              「不留悬空冒号/分隔符」这条降级要求就靠它兑现
 *   verb       跨类别复合标题里的类别动词（metaFold.summary.groupVerb.*，
 *              即「定位代码、运行校验：x」里的两个词）
 *
 * 与 WB 的唯一差异是**主题两侧的空白**：WB 的原串有的带空格（「查看 {topic}」）
 * 有的不带（「定位{topic}相关代码」），中文夹 ASCII 时后者会粘成一坨
 * （「定位*.py相关代码」）。这里统一按「定位 {topic} 相关代码」补空格。
 */
interface CategoryTemplate {
	readonly withTopic: string;
	readonly noTopic: string;
	readonly verb: string;
}

const CATEGORY_TEMPLATES: Readonly<Record<IntentCategory, CategoryTemplate>> = {
	read: { withTopic: "查看 {topic}", noTopic: "查看相关文件", verb: "查看文件" },
	search: { withTopic: "定位 {topic} 相关代码", noTopic: "搜索相关代码", verb: "定位代码" },
	command: { withTopic: "运行 {topic}", noTopic: "运行命令", verb: "运行校验" },
	write: { withTopic: "修改 {topic}", noTopic: "修改文件", verb: "修改" },
	other: { withTopic: "处理 {topic}", noTopic: "处理多个步骤", verb: "处理" },
};

/** 主题截断阈值（WorkBuddy MAX_OBJECT_LEN_ZH / MAX_OBJECT_LEN_EN_WORDS 同值）。 */
const TOPIC_MAX_CJK = 16;
const TOPIC_MAX_WORDS = 6;

/**
 * 主题截断：含 CJK 按字数，纯 ASCII 按词数。
 * 组头是一行不换行的文案，超长的命令/查询会把主题挤出可视区。
 */
function truncateTopic(value: string): string {
	const text = value.trim();
	if (/[\u4e00-\u9fff\u3040-\u30ff]/.test(text)) {
		return text.length > TOPIC_MAX_CJK ? `${text.slice(0, TOPIC_MAX_CJK)}…` : text;
	}
	const words = text.split(/\s+/);
	return words.length > TOPIC_MAX_WORDS ? `${words.slice(0, TOPIC_MAX_WORDS).join(" ")}…` : text;
}

/** 路径摘要取 basename（正/反斜杠都兼容，先去掉尾分隔符——「src/」不该挤出空主题）。 */
function basename(summary: string): string {
	const cleaned = summary.replace(/[\\/]+$/, "");
	return cleaned.split(/[\\/]/).pop() ?? cleaned;
}

/**
 * 主题压缩（WorkBuddy compressObject 同口径）：URL 取域名、路径取 basename，
 * 最后统一截断。
 *
 * 「含分隔符**且**不含空白」才按路径处理：`ls -la src/` 这种带空白的命令行
 * 拆 basename 会把命令参数整段切掉，那是另一类主题，不该压缩。
 */
function compressTopic(summary: string): string | undefined {
	const value = summary.trim();
	if (value === "") return undefined;
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) {
		const host = value.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]+)/)?.[1];
		return truncateTopic(host ?? value);
	}
	if (/[\\/]/.test(value) && !/\s/.test(value)) return truncateTopic(basename(value));
	return truncateTopic(value);
}

/* ── 相邻正文 → 主题（三级降级链的中间一级） ────────────────────── */

/**
 * 句首填充词：模型过程叙述的「开场白」，剥掉后剩下的话题本身才有信息量。
 *
 * 词表依据（不是凭空编）：
 *   1. 基线是 WorkBuddy 的 `LEADING_FILLERS`
 *      （`docs/WorkBuddy-reference/extracted/renderer/assets/lib-chat-ui-*.js`
 *      的 assistant-fold/summary/merge 模块）—— 同一类中文模型真实输出的实证清单；
 *   2. 本仓库自己的提示词也系统性地用「先…再…」这套语序教模型
 *      （`resources/modes/plan.md`「动笔前先摸清现状」、
 *      `resources/scenes/code/prompt.md`「先看完整的报错信息与堆栈再定位」、
 *      `resources/prompts/fragments/tool-discipline.md`「先用 read 看清现状」），
 *      模型的过程叙述会沿用同一批词，故在 WB 表上补入裸「先」「我」
 *      （WB 只有「我先/我来/…」的合体形态）。
 *
 * 按长度降序排：前缀匹配必须让长词先命中（「我先」要胜过「我」、「已经」要胜过「已」），
 * 否则往表里加短词会悄悄改掉既有行为。排序在模块加载时一次完成。
 */
const LEADING_FILLERS: readonly string[] = [
	"现在",
	"接下来",
	"然后",
	"我先",
	"我来",
	"我会",
	"我将",
	"让我",
	"正在",
	"已经",
	"已",
	"好的",
	"首先",
	"稍等",
	"请稍等",
	"马上",
	"立即",
	"下面",
	"下一步",
	"我",
	"先",
].sort((a, b) => b.length - a.length);

/**
 * 反复剥句首填充词，并吃掉紧随其后的顿逗/冒号/空白。
 * 最多三轮：真实叙述的连缀（「好的，我先…」「现在，接下来…」）最多两三层，
 * 再多就是模型在写散文，剥下去也不会更像关键词（WorkBuddy 同为 3 轮）。
 */
function stripLeadingFillers(text: string): string {
	let cur = text;
	for (let i = 0; i < 3; i++) {
		const filler = LEADING_FILLERS.find((word) => cur.startsWith(word));
		if (filler === undefined) break;
		cur = cur.slice(filler.length).replace(/^[，,、:：\s]+/, "");
	}
	return cur;
}

/**
 * 相邻正文 → 关键词主题（WorkBuddy `topicFromAdjacentText` 的**克制版**）。
 *
 * 与 WorkBuddy 完整版的差异（都是刻意不做的抑制逻辑）：
 *   1. 不做话题黑名单（WB 的 `TOPIC_BLACKLIST`：`任务|工作|内容|流程|步骤|结果|信息|…`
 *      这类空词整个否决）—— 我们的降级目标本来就是「有词总比只有动词强」，先看真噪声再说；
 *   2. 不做「关键词与首句重叠比 ≥ 0.7 就否决」（WB 的 `TOPIC_BODY_OVERLAP_RATIO`），
 *      它的目的是避免组头与紧随其后的正文重复，代价是大量正常句被一并否掉；
 *   3. 不做句尾修饰词剥离（WB 的 `TRAILING_MODIFIERS`：`已完成` / `准备就绪`）——
 *      按顿逗切分后句尾很难落在这些词上，收益低；
 *   4. 截断复用本文件既有的中文 16 字 / 英文 6 词阈值，**不**另立 WB 相邻正文专用的
 *      10 字阈值 —— 主题的长相只有一套标准，免得多一条要同步的口径。
 *
 * 另外一处**有意**的偏离：WB 按 `[，,、:：\s]` 切分关键词，这里去掉 `\s`。
 * WB 的切法在「中文夹 ASCII」（「看看 src 目录」）时会把后半句切掉，
 * 而 `truncateTopic` 已经管住了长度。
 *
 * 克制版的代价：偶尔抽出来的词不算漂亮（整句被截断、词里带着动词）。
 * 但比「入参取不到主题时只剩动词」多一档信息；噪声真大到不可接受时再补抑制逻辑。
 */
function topicFromAdjacentText(adjacentText: string | undefined): string | undefined {
	// 先拆标记：正文可能以代码围栏或列表/标题开头，整块留下来会污染关键词。
	const cleaned = (adjacentText ?? "")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/[`*#>\-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (cleaned === "") return undefined;
	// 首句：句末标点或换行。取不到就宁可回退动词，也不拿整段正文当主题。
	const clause = (cleaned.split(/[。．.!！?？;；\n]/)[0] ?? "").trim();
	if (clause.length < 2) return undefined;
	const phrase = stripLeadingFillers(clause).split(/[，,、:：]/)[0]?.trim() ?? "";
	// 单字主题（「看」「好」）没有信息量，等同于取不到。
	if (phrase.length < 2) return undefined;
	return truncateTopic(phrase);
}

/** 类别桶：组序按首次出现（不按计数排序），count 只用于跨类别时挑前两个动词。 */
interface IntentBucket {
	readonly category: IntentCategory;
	count: number;
}

/**
 * 把一段连续工具卡归纳成一行**意图标题**（组头文案，模型不参与）。
 *
 * 规则：
 *   - 单个工具   → `{动作} {主题}`（「查看 README.md」）
 *   - 同类别多个 → 类别模板（「定位{topic}相关代码」）
 *   - 跨类别多个 → `{动词1}、{动词2}：{主题}`，动词取调用次数最多的两类
 *     （WorkBuddy multiStage 同口径只报前两类），平局保留先出现者
 *   - 取不到主题 → 只留动词（单工具）或模板的无主题形态（多工具），
 *     **不留悬空的冒号/分隔符**
 *   - 组内有未完成的卡（outcome 未回填）→ 整句加「正在」前缀，
 *     与 chat-view 的 pendingText 共用同一个「完成」判据
 *
 * 主题就是 `ToolCard.summary` —— 它已经是 session-rebuild 的 `summarizeArgs`
 * 按字段优先级（path / file_path / filePath / pattern / query / description /
 * command / dir）从工具入参里抽出来的值。metafold 拿不到原始 args，也不该再写
 * 第二份字段表：字段口径的唯一真源在 core/session-rebuild.ts
 *（spec 的「与 summarizeArgs 同源」），live 与历史重建两条路径共用它。
 *
 * 主题来源的**三级降级链**（spec: add-intent-grouped-tool-folds 的 Requirement
 * 「组头为意图标题」）：入参字段 → `adjacentText` 的关键词 → 无。
 * 第二级只在第一级取不到时才轮上，**绝不覆盖入参主题**（WorkBuddy `deriveTopic`
 * 同序）。`adjacentText` 不传或提不出词时，行为与扩展签名之前逐字一致。
 */
export function summarizeToolRun(cards: readonly ToolCard[], adjacentText?: string): string {
	const first = cards[0];
	if (first === undefined) return "";

	const buckets: IntentBucket[] = [];
	let topic: string | undefined;
	let running = false;
	for (const card of cards) {
		const category = (INTENTS[card.toolName] ?? OTHER_INTENT).category;
		let bucket = buckets.find((b) => b.category === category);
		if (bucket === undefined) {
			bucket = { category, count: 0 };
			buckets.push(bucket);
		}
		bucket.count += 1;
		if (topic === undefined) topic = compressTopic(card.summary);
		if (card.outcome === undefined) running = true;
	}
	if (topic === undefined) topic = topicFromAdjacentText(adjacentText);

	const only = buckets[0];
	let title: string;
	if (cards.length === 1) {
		const { action } = INTENTS[first.toolName] ?? OTHER_INTENT;
		title = topic === undefined ? action : `${action} ${topic}`;
	} else if (buckets.length === 1 && only !== undefined) {
		const template = CATEGORY_TEMPLATES[only.category];
		title = topic === undefined ? template.noTopic : template.withTopic.replace("{topic}", topic);
	} else {
		const verbs = [...buckets]
			.sort((a, b) => b.count - a.count)
			.slice(0, 2)
			.map((bucket) => CATEGORY_TEMPLATES[bucket.category].verb)
			.join("、");
		title = topic === undefined ? verbs : `${verbs}：${topic}`;
	}
	return running ? `正在${title}` : title;
}

/**
 * 段内调用次数最多的工具名，折叠行行首主导图标的依据（WorkBuddy
 * computeTopToolName 同思路）。返回值只是工具名 —— 图标映射是渲染侧的事。
 *
 * 平局保留先达到最高次数者（按段内出现序推进，结果稳定可测）。
 * bash/powershell 不像摘要那样合并计数：二者在渲染侧映射成同一个终端图标，
 * 这里拆开统计不影响最终视觉。
 */
export function leadToolName(cards: readonly ToolCard[]): string {
	const counts = new Map<string, number>();
	let lead = "";
	let max = 0;
	for (const card of cards) {
		const n = (counts.get(card.toolName) ?? 0) + 1;
		counts.set(card.toolName, n);
		if (n > max) {
			max = n;
			lead = card.toolName;
		}
	}
	return lead;
}
