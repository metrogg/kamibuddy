/**
 * 团队产出快照 —— 领导上下文的第四条隐藏通道（spec: inject-team-output-snapshot）。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  为什么要有这一层
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 拉模式（`team_read`）把成员产出留在成员会话文件里，领导必须**主动调**工具才
 * 看得见。2026-09-19 真机现场里领导不调，于是判定「团队通道坏了」、降级改用子
 * 代理（其余成员因此从未被派活）。WorkBuddy 只有四件套团队工具却能工作，是因为
 * 它把子会话窗口拼进了父的请求上下文 —— 领导天然看得见产出、不需要读工具。
 *
 * 本模块补的就是这条通路，但载体**不走 WorkBuddy 的「每请求现算尾巴注入」**：
 * 那条路已被实测证伪（同一份内容在一个 run 内逐字节相同却注入了 24 次，23 轮
 * 白付 58,094 token，占会话未命中 28.8%，详见 `shared/hidden-context.ts` 文件头）。
 * 我们保留它的语义（自动送达），把载体换成「追加一条持久快照 + 内容变了才追加」。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  为什么是纯函数层
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 本模块**不碰文件系统、不 import pi / electron**：读成员会话、门控、落盘都在
 * 调用方（`extensions/prompt-switch.ts` 的 handler）里做。分离的收益是判据可以
 * 脱离会话单独喂数组测试 —— 这条链最容易错的就是「同一份产出被反复注入」，
 * 而它出错的代价正是每个 run 白付一段输入 token。
 *
 * 幂等判据刻意**不引入第二真源**（否决「在 daemon 里维护已注入清单」）：进程重启
 * / resume / 上下文被压缩遮蔽之后，进程内 Map 都会与文件不一致。这里比的是文本 ——
 * 判据完全取自会话内容，可从文件重放。
 */

import { createHash } from "node:crypto";
import { normalizeMemberOutput } from "./member-transcript.ts";

/**
 * 单个成员产出块的正文上限（字符）。
 *
 * 为什么要有上界（spec 否决「注入全文」）：7 名成员 × 24k 字符会一次灌进 40k+
 * tokens，把自动送达的代价推到不可接受。截断 + 指向 `team_read` 既保住「要全文」
 * 的能力，又把每轮成本限制在可测范围内。
 */
export const TEAM_OUTPUT_MAX_CHARS = 4_000;

/**
 * 快照首行的说明句。
 *
 * 为什么必须是**逐字节稳定的常量**：它与状态行、产出块一起参与「候选 == previous
 * ⇒ 返回 undefined」的整串比较。只要这句话里掺进任何逐 run 会变的东西（时间戳、
 * 轮数），候选就永远不可能与 previous 逐字节相同 —— 去重直接失效。所以它是常量，
 * 不拼接任何运行期信息。它同时向模型交代 `[fp …]` 是内部去重标记、可以忽略。
 */
const SNAPSHOT_NOTE =
	"以下是你还没见过的成员产出增量；状态行末尾的 [fp xxxxxxxx] 只用于跨轮去重，你可以忽略它。";

/**
 * 产出正文的稳定指纹 —— sha256 前 8 位十六进制小写。
 *
 * 为什么要**先归一化再取指纹**：同一份产出可能带/不带 `[Agent ID: …]` 注入装饰
 * （不同注入路径留下的），不归一化会把同一份产出判成两份、于是重复注入
 * （`hasEquivalentMemberOutput` 的注释里记着这条教训）。归一化逻辑复用
 * `normalizeMemberOutput`，不在这里重写第二份。
 *
 * 8 位（32 bit）够用的理由：它只用来在「上一条同通道快照」这一段文本里做相等
 * 判断，域是单个团队的成员数（个位数），碰撞概率可忽略；短指纹也让快照体积可控。
 */
export function outputFingerprint(output: string): string {
	return createHash("sha256").update(normalizeMemberOutput(output)).digest("hex").slice(0, 8);
}

/**
 * 领导会话正文里出现过的产出指纹（`[fp xxxxxxxx]`）。
 *
 * 为什么要从正文扫而不是另记账：工具结果本身就是持久记录，交付事实已经在会话里了；
 * 另起一份清单就是第二真源（resume / 新进程后与文件不一致）。
 *
 * 为什么**不能**只认行首/行尾：这些块会随工具结果被拼进一段很长的正文（前后还有
 * 别的消息内容），状态行不一定独立成行、指纹也可能不在行尾，所以整串扫描。
 *
 * 说明句里的常量示例 `[fp xxxxxxxx]` 不会被误收 —— `x` 不是十六进制字符，正则只认
 * 8 位 `[0-9a-f]`；这正是那句示例能安全写进正文的前提。
 */
export function collectFingerprintsIn(historyText: string): ReadonlySet<string> {
	const found = new Set<string>();
	// 全局扫描（`matchAll` 需 `g`）：一处命中不够，同一段正文里可能有多份产出。
	for (const match of historyText.matchAll(/\[fp ([0-9a-f]{8})\]/g)) {
		const fingerprint = match[1];
		if (fingerprint !== undefined) found.add(fingerprint);
	}
	return found;
}

/** 参与快照拼装的一个成员 —— 只收「快照需要的事实」，不把注册表类型漏进纯函数层。 */
export interface TeamOutputMemberInput {
	/** 成员名（@寻址键）。 */
	readonly name: string;
	/** 人格定义名（agent 库里的名字）。 */
	readonly agentName: string;
	/** 注册表的成员状态（spawning/running/idle/failed/closing/closed/interrupted）。 */
	readonly status: string;
	/** 已完成轮数。 */
	readonly turns: number;
	/** 该成员最近一轮产出正文（读不到就没有）。 */
	readonly output?: string;
}

/**
 * 把团队注册表的成员折成拼装层的输入；产出由注入的读取器取。
 *
 * 为什么要有它：接线层（daemon 的装配闭包）里「无团队 / 开关关闭就该一次文件都不读」
 * 是本次的硬要求之一，但闭包本身不可单测 —— 把这个取数步骤抽出来，判据就能被钉住。
 * 只对**有 sessionId 的成员**调 `readOutput`（没会话的成员读不到东西，白读一次文件）。
 */
export function collectTeamOutputMembers(
	team:
		| {
				readonly members: ReadonlyMap<
					string,
					{
						readonly name: string;
						readonly agentName: string;
						readonly status: string;
						readonly turns: number;
						readonly sessionId: string | undefined;
					}
				>;
		  }
		| undefined,
	readOutput: (sessionId: string) => string | undefined,
): readonly TeamOutputMemberInput[] | undefined {
	if (team === undefined) return undefined;

	const members: TeamOutputMemberInput[] = [];
	for (const member of team.members.values()) {
		const facts = {
			name: member.name,
			agentName: member.agentName,
			status: member.status,
			turns: member.turns,
		};
		// 没会话的成员不读：读也读不到东西，只会白付一次文件 IO。
		if (member.sessionId === undefined) {
			members.push(facts);
			continue;
		}
		const output = readOutput(member.sessionId);
		// 读不到的产出归入「没产出」（而不是塞一个空串）：空串进快照只会制造
		// 「有块但没内容」的噪声，也会让同一份空产出每次都被判成新信息。
		if (output === undefined || output.trim() === "") {
			members.push(facts);
			continue;
		}
		members.push({ ...facts, output });
	}
	return members;
}

/**
 * 拼装团队产出快照；没有任何新信息时返回 `undefined`（调用方据此零成本）：
 *
 * ```
 * <team_output team="研究队">
 * 以下是你还没见过的成员产出增量；状态行末尾的 [fp xxxxxxxx] 只用于跨轮去重，你可以忽略它。
 *
 * - 谭溯源（topic-researcher）：idle，已完成 53 轮 [fp a1b2c3d4]
 * - 程文成（report-writer）：running，已完成 2 轮
 *
 * <member_output member="谭溯源">
 * …产出正文（截断后）…
 * </member_output>
 * </team_output>
 * ```
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  去重判据：把「已注入的指纹」写进状态行，而不是去 previous 里搜指纹
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **为什么指纹要写进状态行**：原判据是「成员产出的指纹有没有出现在 `previous` 里」，
 * 它会 A/B 两态交替 —— run1 注入「状态行 + 产出块」（含指纹）；run2 因指纹命中而
 * 跳过产出块、只剩纯状态行（**不含指纹**）；run3 的 previous 就是这条纯状态行，
 * 判据又成立、产出块被拼回 ⇒ 每个 run 都来回追加一条，去重彻底失效（正是本 change
 * 要避免的缓存杀手）。把「该成员最近一次已注入产出」的指纹留在状态行末尾，它便
 * 跨快照一直可见，于是 run3 拼出的候选与 run2 **逐字节相同** ⇒ 返回 `undefined`。
 *
 * **判据**：`该成员当前产出的指纹 !== previous 状态行里记录的该成员指纹 ⇒ 拼产出块`。
 * `previous` 缺该成员的记录（旧版本快照 / 首次 / 被压缩遮蔽）⇒ 视为「没记录」⇒
 * 拼产出块（压缩后模型确实看不到了，重注一次是正确行为）。
 *
 * **为什么每个成员只记一个指纹**：标记长度因此与团队规模同阶（≤8 人），**不随轮数
 * 增长**；若改成「累积全部已注入指纹」，状态行会随会话越跑越长，等于把去重省下的
 * 成本又还回去。只记最近一个也恰好满足语义：只有「最新产出的指纹」才需要被比。
 *
 * 「没有新信息」的最终判据仍是**候选文本与 `previous` 逐字节相同**（先拼状态行 +
 * 新产出块，再与 `previous` 比）。
 *
 * 本通道**不写取代声明**（`SNAPSHOT_SUPERSEDE_NOTE`）：语义是增量，旧产出不被新快照
 * 取代 —— 它们是不同内容，且旧产出仍然有效。因此在文件里也刻意不 import
 * `shared/hidden-context.ts`。
 */
export function composeTeamOutputSnapshot(input: {
	readonly teamName: string;
	readonly members: readonly TeamOutputMemberInput[];
	readonly previous: string | undefined;
	readonly maxChars?: number;
}): string | undefined {
	const { teamName, members, previous } = input;
	const maxChars = input.maxChars ?? TEAM_OUTPUT_MAX_CHARS;

	if (members.length === 0) return undefined;

	// previous 里每个成员记录过的指纹（旧形态快照没有记录 ⇒ 查不到 ⇒ 视为没注入）。
	const recorded = parseRecordedFingerprints(previous);

	const statusLines: string[] = [];
	const blocks: string[] = [];
	for (const member of members) {
		const body = normalizeMemberOutput(member.output ?? "");
		// 空白正文视同没有产出（`normalizeMemberOutput` 已 trim）：它进快照只会制造
		// 「有块但没内容」的噪声，也会让「同一份空产出」每次都被判成新信息。没有产出就
		// 不在状态行留指纹（留了会假装「注入过一份不存在的产出」）。
		if (body === "") {
			statusLines.push(renderStatusLine(member));
			continue;
		}

		const fingerprint = outputFingerprint(body);
		// 状态行**始终**带上当前产出的指纹，这正是跨轮去重的载体：下一轮即使不出产出块，
		// 这个指纹也还在，判据不会误判成「没注入过」。
		statusLines.push(renderStatusLine(member, fingerprint));

		// 指纹与记录相同 ⇒ 这份产出已经进过领导的上下文 ⇒ 跳过它，但状态行照旧保留。
		if (recorded.get(member.name) === fingerprint) continue;
		blocks.push(renderMemberBlock(member.name, body, maxChars));
	}

	const candidate = assembleSnapshot(teamName, statusLines, blocks);
	return candidate === previous ? undefined : candidate;
}

/**
 * 「待送达产出」块 —— 挂在 `team_*` 工具结果上的那一份。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  为什么换落点（旧快照在长 run 形态下不生效）
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `composeTeamOutputSnapshot` 只在**领导每次 run 开始**时挂一条隐藏快照。真机现场
 * 里领导一个 run 有 42 次模型调用 —— 快照只在 run 开头求值那一次，而那次求值时团队
 * 可能还没建起来，于是整条通路在长 run 里等于不存在。
 *
 * 新落点：把「尚未送达给领导的成员产出」附在 `team_*` 工具的**结果**里。工具结果是
 * append-only 的持久记录，付一次即进缓存；而领导本来就会调 `team_status` /
 * `team_send` / `team_read`。交付事实仍然藏在会话内容本身里（指纹 `[fp xxxxxxxx]`
 * 写进块正文），**不引入任何进程内账本**。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  与 composeTeamOutputSnapshot 的差别只有判据
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   旧：这份产出的指纹是否出现在**上一条同通道快照**里（`previous` 状态行）；
 *   新：这份产出的指纹是否已出现在**领导会话正文**里（`delivered`，
 *       由 `collectFingerprintsIn` 从正文扫出）。
 *
 * 渲染形状、状态行口径、截断口径、不写取代声明 —— **全部与旧函数一致**，且直接复用
 * 同一批渲染/截断/指纹工具函数。为什么必须逐字节同形：两块共享 `[fp …]` 的解析口径
 * （`collectFingerprintsIn` 与 `parseRecordedFingerprints` 都在读它），复制第二份渲染
 * 逻辑等于让两个解析口径各自漂移。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  已知边界（刻意不修）
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 同一批里并行调用两个 `team_*` 工具时，两次调用看到的是同一份「未送达」集合，于是
 * 可能各带一份相同增量。代价有界（多付一次块）、语义无害（领导看到重复信息）；而为此
 * 引入进程内账本会破坏「单一真源」，得不偿失 —— 所以接受它。
 *
 * 没有任何待送达产出 ⇒ 返回 `undefined`（调用方零成本直接用工具原文）。这条与旧函数的
 * 「候选 == previous 才 undefined」不同：这里没有 previous 可比，判据就是「有没有块要发」；
 * 只剩状态行、没有产出块时不发，免得每调一次 `team_*` 都白付一段纯状态行。
 */
export function composePendingTeamOutput(input: {
	readonly teamName: string;
	readonly members: readonly TeamOutputMemberInput[];
	readonly delivered: ReadonlySet<string>;
	readonly maxChars?: number;
}): string | undefined {
	const { teamName, members, delivered } = input;
	const maxChars = input.maxChars ?? TEAM_OUTPUT_MAX_CHARS;

	if (members.length === 0) return undefined;

	const statusLines: string[] = [];
	const blocks: string[] = [];
	for (const member of members) {
		const body = normalizeMemberOutput(member.output ?? "");
		// 空白正文视同没有产出（与旧函数同口径）：进块只会制造「有块但没内容」的噪声。
		if (body === "") {
			statusLines.push(renderStatusLine(member));
			continue;
		}

		const fingerprint = outputFingerprint(body);
		// 状态行照旧始终带当前产出的指纹：它既是「已送达」标记的载体，也是领导判断谁在跑
		// 的依据；下一轮从正文扫指纹时，靠的就是这里留下的那一份。
		statusLines.push(renderStatusLine(member, fingerprint));

		// 指纹已在领导正文里出现过 ⇒ 交付过 ⇒ 跳过产出块（状态行照旧保留）。
		if (delivered.has(fingerprint)) continue;
		blocks.push(renderMemberBlock(member.name, body, maxChars));
	}

	// 没有任何待送达产出 ⇒ undefined（零成本）。这是本函数与旧函数唯一的语义差异点。
	if (blocks.length === 0) return undefined;

	return assembleSnapshot(teamName, statusLines, blocks);
}

/**
 * 从 `previous` 的状态行里解析出「成员名 → 已记录指纹」。
 *
 * 只认本模块自己写的形状（`… [fp xxxxxxxx]` 结尾），其余行一律忽略 —— 于是旧形态
 * 快照（没有指纹）自然解析为空，判据退化成「全部重注一次」，符合预期。
 */
function parseRecordedFingerprints(previous: string | undefined): ReadonlyMap<string, string> {
	const recorded = new Map<string, string>();
	if (previous === undefined) return recorded;
	for (const line of previous.split("\n")) {
		const match = /^- (.+?)（[^）]*）：.* \[fp ([0-9a-f]{8})\]$/.exec(line);
		const name = match?.[1];
		const fingerprint = match?.[2];
		if (name === undefined || fingerprint === undefined) continue;
		recorded.set(name, fingerprint);
	}
	return recorded;
}

/** 渲染一条状态行；有产出时在末尾附上去重标记 ` [fp xxxxxxxx]`。 */
function renderStatusLine(member: TeamOutputMemberInput, fingerprint?: string): string {
	// 状态行口径与 team_status 一致（`extensions/team-tools.ts` 的拼法）：领导两处看到
	// 的同一事实必须是同一句话，否则它会以为是两件事。
	const base = `- ${member.name}（${member.agentName}）：${member.status}，已完成 ${member.turns} 轮`;
	return fingerprint === undefined ? base : `${base} [fp ${fingerprint}]`;
}

/** 拼装整条快照：说明句、状态行在前，产出块在后（空行分隔）。 */
function assembleSnapshot(
	teamName: string,
	statusLines: readonly string[],
	blocks: readonly string[],
): string {
	let text = `<team_output team="${teamName}">\n${SNAPSHOT_NOTE}\n\n${statusLines.join("\n")}`;
	if (blocks.length > 0) text += `\n\n${blocks.join("\n\n")}`;
	return `${text}\n</team_output>`;
}

/**
 * 渲染一个产出块；超长则截断并标注。
 *
 * 截断按**字符**（`slice`）而非字节：产出主体是中文，按字节切会把一个汉字劈成
 * 非法序列，模型读到的就是乱码。
 *
 * 块上不再带 `fingerprint` 属性：指纹已移到状态行的 `[fp …]`，块内副本只是重复
 * （去重判据读的是状态行），去掉可少一份会漂移的冗余。
 */
function renderMemberBlock(member: string, body: string, maxChars: number): string {
	const open = `<member_output member="${member}">`;
	if (body.length <= maxChars) return `${open}\n${body}\n</member_output>`;
	return `${open}\n${body.slice(0, maxChars)}\n（已截断，全文用 team_read 取回）\n</member_output>`;
}
