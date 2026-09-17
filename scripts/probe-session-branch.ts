/**
 * 探针：pi 0.85.1 的会话分支语义实测（spec: .trae/specs/add-session-branching Task 1）。
 *
 * 为什么必须实测：我们要做「从某条用户消息回退/派生」——抽枝靠
 * `SessionManager.createBranchedSession(leafId)`，回退靠 `branch()` /
 * `AgentSession.navigateTree()`。文档只说「移动到叶子指针」，但**叶子位置是否落盘**
 * 决定了整个实现方式：
 *   - 若落盘：回退只需 branch()/navigateTree()，文件保持原样，树结构天然成立；
 *   - 若不落盘：重新 open 时叶子=文件最后一行（dist/core/session-manager.js 的
 *     `_buildIndex`），必须把母文件**物理截断为分叉点之前的前缀**，或自己在分叉点
 *     之后追一条新条目。
 * 这条不能靠读文档推断，所以逐条断言。
 *
 * 手法：`mkdtempSync` 建临时目录当 sessionsDir，用 `SessionManager` 构造假会话
 * （u1,a1,u2,a2），全部断言走真实读写。**不联网、不调 LLM**：navigateTree 那节用
 * 指向 127.0.0.1:9（保留端口，必然拒连）的假服务商只构造 AgentSession、不 prompt。
 *
 * 用法：npx tsx scripts/probe-session-branch.ts
 *
 * ── 实测结论（2026-09-17，pi 0.85.1，Windows；26/26 通过）────────────────
 *
 * 1. createBranchedSession(leafId)（实例方法，入参 = 条目 id）
 *    1a 含 root→leafId **全量**条目，内容与顺序逐条一致（实测抽出 2 条 = [u1, a1]）。
 *    1b **源文件字节完全不变**（1434 → 1434）：抽枝是「另写一个新文件」，不动母文件。
 *    1c 新 header 写 `parentSession`，值 = 母会话文件**绝对路径**（persist 模式才写；
 *       内存模式下该键为 undefined）。
 *    1d 返回值 = 新会话文件路径（string）；**内存模式返回 undefined**，并把自身条目
 *       换成抽出的路径。**边角**：若抽出的路径不含 assistant 消息，仍返回路径但
 *       文件**尚未落盘**（pi 的 `_persist` 守卫：首个 assistant 到达才写出）——
 *       调用方不能假设「返回路径 == 文件已存在」。
 *    1e 任意历史条目（含非当前 leaf）都可用：传 u2 得 [u1,a1,u2]，传 a2（当前 leaf）
 *       得全量 [u1,a1,u2,a2]。
 *    1f 传 `null` **不会**得到空历史：`getBranch` 里 `fromId ?? this.leafId` 静默回落到
 *       当前 leaf，抽出全量（**已知限制**）。空历史的正确做法（两者实测均可行、条目数
 *       =0 且来源标记正确）：`SessionManager.create(cwd, dir, { parentSession })`
 *       或对已开管理器 `newSession({ parentSession })`。
 *    1g 抽枝范围是 **root→leafId（含前缀）**，不是「被放弃的后缀」——pi 没有抽后缀的 API。
 *
 * 2. 叶子持久化（最关键）
 *    2a **不持久化**。`branch(a1)` 后内存 leaf=a1，重开同一文件后 leaf=a2
 *       （=文件最后一行）。branch() 只改内存指针。
 *    2b 文件里**没有任何叶子指针条目**：逐行 type = `session → message × 4`；
 *       无 leafId/leaf/currentLeaf 字段（**已知限制**）。
 *    2c 重开后 `buildContextEntries()`/`getBranch()` 走「文件最后一行 → root」，与回退
 *       后的内存分支不一致（[u1,a1] vs [u1,a1,u2,a2]）。
 *       机制：`_buildIndex()` 把 leafId 设成**文件里最后出现的那条条目**。推论：
 *       - 回退后**不再追加**任何条目 → 重开退回旧尾部；
 *       - 回退后**追加**过条目（如回填后重发）→ 重开叶子=新条目，但旧尾部仍物理留在
 *         文件里、成为隐藏旁支（实测：文件 6 行，活动分支 [u1,a1,新条目]）。
 *       → 要把「回退」落成文件事实，唯一稳的做法是**把母文件物理重写为
 *         header + root→分叉点的前缀**（截断）；此时最后一行=分叉点，重开叶子天然
 *         正确，且不留隐藏旁支。
 *
 * 3. AgentSession.navigateTree(targetId, {...})
 *    **可达**：用指向 127.0.0.1:9 的假服务商 + 真实 SessionManager 能构造出
 *    AgentSession，全程零网络请求（非 summarize 模式下不需要 model）。
 *    - 传**用户消息** id：叶子移到该消息的 `parentId`（=「该消息之前」），返回
 *      `{ cancelled:false, editorText:<该消息原文> }` —— editorText 可直接进输入框。
 *    - **顺带重建上下文**：`agent.state.messages` 变为回退后的 [u1,a1]（实测 2 条，
 *      不含第二轮）——比我们自己重放一步到位。
 *    - **同样不持久化叶子**：重开后 leaf 仍是构造时的最后一行（与 2a 同一限制）。
 *    - **踩坑**：构造 AgentSession 本身会往会话文件**追加 `thinking_level_change`
 *      条目**（实测 4 条 message 之后多一行）。→ resume/回退后若要截断母文件，必须在
 *      宿主构造**之后**做，或把这类宿主机条目一并纳入「前缀」口径，否则「文件最后一行」
 *      与「分叉点」会错位。
 *
 * 4. `SessionManager.open(path).getHeader()`
 *    字段名就是 `parentSession`（camelCase），值 = 母会话文件绝对路径；普通会话该键
 *    缺席。形状：`{ type:"session", version:3, id, timestamp, cwd, parentSession? }`。
 *
 * 5. `getEntry(id)` 返回条目带 `parentId`（string|null），可直接算「分叉点之前」；
 *    `getEntries()` 只返条目、**不含 header**；未知 id 返回 undefined（不抛错）。
 *
 * 6. 锚点 id 口径（我们自己的代码）
 *    - 恢复路径**对齐**：`buildConversationEntries` 产出的 user 条目 id = 该 message
 *      条目的 `entry.id`（实测与 JSONL 条目 id 一一相等）。
 *    - 技能消息在条目里就是**普通 user message**、不额外拆条；技能名由
 *      `splitSkillBlocks` 从 content 剥出（实测 `skillNames=["docx"]`、`text="写周报"`）。
 *    - **在线路径不对齐（重要）**：`session-host.translate` 的 message_start 分支用
 *      `nextId("user")` → 渲染层 user id 形如 `user-3`，**不是**落盘条目 id
 *      （src/core/session-host.ts:1281）；而 pi 在 `message_end` 才 `appendMessage`
 *      （dist/core/agent-session.js:388-398），事件里也不带条目 id。→ 渲染层拿不到真
 *      锚点，Task 3/5 的 `anchorEntryId` 必须在 daemon 侧桥接。
 *      可用桥接：`AgentSession.getUserMessagesForForking()` 返回 `[{ entryId, text }]`
 *      （实测给出 [u1,u2] 的 entryId 与原文），或按序号/原文匹配。
 *
 * ── 对后续实现的建议 ──────────────────────────────────────────────────
 * A. 抽枝：`createBranchedSession(leafId)` **足以支撑「抽枝」**（复制全量、不动母文件、
 *    自带 parentSession）。Task 2 仍需自建 `session-file.ts`：createBranchedSession 只会
 *    「另存一条 root→leafId 的新会话」，**不能截断母文件**，而「重新开始」要的正是截断。
 *    两个已知边角要处理：(1) 分叉点在首条消息时传 null 无效，改用
 *    `SessionManager.create(cwd, sessionsDir, { parentSession })`；
 *    (2) 返回值可能是「尚未落盘」的路径（无 assistant），别假设文件已存在。
 * B. 回退的叶子持久化**必须靠「我们自己的母文件前缀重写」**（header + root→分叉点），
 *    不能指望 branch()/navigateTree() 落盘。截断后最后一行=分叉点，重开即正确；若走
 *    「不截断、回退后追加」的路子，旧尾部会留成隐藏旁支，且一旦用户没再发消息（spec 的
 *    「空输入框不发送」场景）重开就退回旧历史 —— 不可接受。
 * C. 落子时机：截断/重写必须在**宿主构造之后**（构造会追加 thinking_level_change），
 *    否则「文件最后一行」会落在宿主机条目上。
 * D. 分叉（不改母文件）优先用 `createBranchedSession`；`navigateTree` 的 editorText 与
 *    上下文重建可直接复用，但其叶子同样不落盘，回退仍按 B 的前缀口径收尾。
 * E. 需要 spec 注意的两点：(1) `anchorEntryId` 在**在线路径**拿不到（见 6），要么让
 *    daemon 用 `getUserMessagesForForking()`/序号解析，要么让 session-host 在
 *    message_end 后补一条带真实条目 id 的校正（spec 未覆盖，建议 Task 6 前定）；
 *    (2) 抽枝产出的是 root→oldLeaf 的**全量**历史（含前缀），不是「只留被放弃的后缀」
 *    —— 按「新会话 = 原会话抽到分叉点之后」的口径实现即可，pi 无「只抽后缀」的 API。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { SessionMessageEntry } from "@earendil-works/pi-coding-agent";
import type { ConversationEntry } from "../src/shared/session-events.ts";

export {};

// 必须在导入我们的模块之前设好：配置路径由 env 决定（同 smoke-session.ts）。
const workDir = mkdtempSync(join(tmpdir(), "kami-probe-branch-"));
process.env["KAMIBUDDY_CONFIG_DIR"] = join(workDir, "config");
process.env["KAMIBUDDY_WORKSPACE_DIR"] = join(workDir, "workspace");

const { SessionManager, ModelRuntime, createAgentSession } = await import(
	"@earendil-works/pi-coding-agent"
);
const { buildConversationEntries } = await import("../src/core/session-rebuild.ts");

const sessionsDir = join(workDir, "sessions");
const cwd = join(workDir, "workspace");
const configDir = join(workDir, "config");
mkdirSync(sessionsDir, { recursive: true });
mkdirSync(cwd, { recursive: true });
mkdirSync(configDir, { recursive: true });

const results: { readonly name: string; readonly ok: boolean; readonly detail: string }[] = [];
function check(name: string, ok: boolean, detail: string): void {
	results.push({ name, ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

/* ── 假消息与假会话 ─────────────────────────────────────────────────── */

type PiMessage = SessionMessageEntry["message"];
type PiUserMessage = Extract<PiMessage, { role: "user" }>;
type PiAssistantMessage = Extract<PiMessage, { role: "assistant" }>;

const T0 = Date.UTC(2026, 0, 1, 0, 0, 0);

function userMsg(text: string, at: number): PiUserMessage {
	return { role: "user", content: text, timestamp: at };
}

function assistantMsg(text: string, at: number): PiAssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "openai-completions",
		provider: "probe-branch",
		model: "probe-model",
		usage: {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: at,
	};
}

interface LinearSession {
	readonly file: string;
	readonly u1: string;
	readonly a1: string;
	readonly u2: string;
	readonly a2: string;
}

/**
 * 造一条线性会话文件：u1 → a1 → u2 → a2。
 *
 * 每条都带 assistant 消息，才能让 pi 真的把文件写下去 —— `_persist()` 里有个
 * 「没有 assistant 就不落盘」的守卫（首个 assistant 到达时才把整份 fileEntries 写出）。
 */
function buildLinearSession(): LinearSession {
	const manager = SessionManager.create(cwd, sessionsDir);
	const u1 = manager.appendMessage(userMsg("第一轮问题", T0));
	const a1 = manager.appendMessage(assistantMsg("第一轮回答", T0 + 1000));
	const u2 = manager.appendMessage(userMsg("第二轮问题", T0 + 2000));
	const a2 = manager.appendMessage(assistantMsg("第二轮回答", T0 + 3000));
	const file = manager.getSessionFile();
	if (file === undefined) throw new Error("会话未落盘：getSessionFile() 返回 undefined");
	return { file, u1, a1, u2, a2 };
}

/** 逐行解析 JSONL（跳过空行）。 */
function readLines(file: string): Record<string, unknown>[] {
	return readFileSync(file, "utf8")
		.split("\n")
		.filter((line) => line.trim() !== "")
		.map((line) => JSON.parse(line) as Record<string, unknown>);
}

function lineId(entry: Record<string, unknown>): string {
	return String(entry["id"] ?? "?");
}

/** 叶子指针类字段/条目探测：文件里到底有没有记录「当前叶子在哪」。 */
function looksLikeLeafPointer(entry: Record<string, unknown>): boolean {
	return (
		["leafId", "leaf", "currentLeaf", "currentLeafId", "activeLeafId"].some((k) => k in entry) ||
		entry["type"] === "leaf" ||
		entry["type"] === "leaf_pointer"
	);
}

/* ── 1. createBranchedSession(leafId) ───────────────────────────────── */

const s1 = buildLinearSession();
console.log(`临时目录：${workDir}`);
console.log(`源会话文件：${s1.file}\n`);

const expectedBranch = SessionManager.open(s1.file, sessionsDir).getBranch(s1.a1);
const bytesBefore = readFileSync(s1.file);
const branchOpener = SessionManager.open(s1.file, sessionsDir);
const branchedPath = branchOpener.createBranchedSession(s1.a1);
const bytesAfter = readFileSync(s1.file);

const branchedLines = branchedPath === undefined ? [] : readLines(branchedPath);

// 1a：抽出的新文件是否含 root→leafId 全量条目（逐条比对内容与顺序）
{
	const expected = expectedBranch.map((entry) => JSON.stringify(entry));
	const actual = branchedLines.slice(1).map((entry) => JSON.stringify(entry));
	check(
		"1a 抽出 root→leafId 全量条目（内容与顺序逐条一致）",
		branchedPath !== undefined &&
			expected.length === 2 &&
			JSON.stringify(actual) === JSON.stringify(expected),
		`抽出 ${actual.length} 条，id=[${branchedLines.slice(1).map(lineId).join(", ")}]，期望 [${s1.u1}, ${s1.a1}]（root=u1，leaf=a1）`,
	);
}

// 1b：是否改动源文件
check(
	"1b createBranchedSession 不改动源文件（字节一致）",
	bytesBefore.equals(bytesAfter),
	`抽枝前后源文件字节数：${bytesBefore.length} → ${bytesAfter.length}`,
);

// 1c：新文件 header 的 parentSession
{
	const header = branchedLines[0];
	check(
		"1c 新文件 header 写入 parentSession = 源会话文件绝对路径",
		header !== undefined && header["parentSession"] === resolve(s1.file),
		`header.parentSession = ${String(header?.["parentSession"])}`,
	);
}

// 1d：返回值语义
{
	const persisted = typeof branchedPath === "string" && existsSync(branchedPath);
	// 路径里没有 assistant 消息时（抽根用户消息之前/只抽到用户消息），pi 只返回路径、暂不落盘
	const noAssistantOpener = SessionManager.open(s1.file, sessionsDir);
	const noAssistantPath = noAssistantOpener.createBranchedSession(s1.u1);
	const mem = SessionManager.inMemory(cwd);
	const memU1 = mem.appendMessage(userMsg("内存问", T0));
	const memA1 = mem.appendMessage(assistantMsg("内存答", T0 + 1));
	const memBranched = mem.createBranchedSession(memA1);
	check(
		"1d 持久化模式返回新会话文件路径（string）；内存模式返回 undefined",
		persisted && memBranched === undefined && mem.getEntries().length === 2 && memU1 !== "",
		`持久化返回=${typeof branchedPath === "string" ? branchedPath : String(branchedPath)}；内存模式返回=${String(memBranched)}`,
	);
	check(
		"1d 已知限制：抽出的路径不含 assistant 时，返回了路径但文件尚未落盘（延迟到首次 append）",
		typeof noAssistantPath === "string" && !existsSync(noAssistantPath),
		`返回 ${String(noAssistantPath)}，existsSync(${String(noAssistantPath)}) = ${typeof noAssistantPath === "string" ? existsSync(noAssistantPath) : "n/a"}`,
	);
}

// 1e：leafId 传任意历史条目（非当前 leaf）
{
	const historyOpener = SessionManager.open(s1.file, sessionsDir);
	const historyPath = historyOpener.createBranchedSession(s1.u2);
	const historyIds = historyPath === undefined ? [] : readLines(historyPath).slice(1).map(lineId);
	const leafOpener = SessionManager.open(s1.file, sessionsDir);
	const leafPath = leafOpener.createBranchedSession(s1.a2);
	const leafIds = leafPath === undefined ? [] : readLines(leafPath).slice(1).map(lineId);
	check(
		"1e leafId 传任意历史条目（含非当前 leaf）均可用",
		JSON.stringify(historyIds) === JSON.stringify([s1.u1, s1.a1, s1.u2]) &&
			JSON.stringify(leafIds) === JSON.stringify([s1.u1, s1.a1, s1.u2, s1.a2]),
		`传 u2 → [${historyIds.join(", ")}]；传 a2(当前 leaf) → [${leafIds.join(", ")}]`,
	);
}

// 1f：想让新会话「空历史」怎么办
{
	// 传 null：签名要求 string，运行时 getBranch 里 `fromId ?? this.leafId` 会静默回落到当前 leaf
	const nullOpener = SessionManager.open(s1.file, sessionsDir);
	const nullPath = (
		nullOpener as unknown as { createBranchedSession(id: string | null): string | undefined }
	).createBranchedSession(null);
	const nullIds = nullPath === undefined ? [] : readLines(nullPath).slice(1).map(lineId);
	check(
		"1f leafId=null 不会得到空历史，而是静默按当前 leaf 抽全量（已知限制）",
		JSON.stringify(nullIds) === JSON.stringify([s1.u1, s1.a1, s1.u2, s1.a2]),
		`传 null 抽出 [${nullIds.join(", ")}]（4 条 = 当前 leaf 的全量路径）`,
	);

	// 正确做法一：SessionManager.create(cwd, dir, { parentSession })
	const fresh = SessionManager.create(cwd, sessionsDir, { parentSession: resolve(s1.file) });
	check(
		"1f 空历史正确做法 A：SessionManager.create(cwd, dir, { parentSession }) 可行",
		fresh.getEntries().length === 0 && fresh.getHeader()?.parentSession === resolve(s1.file),
		`条目数=${fresh.getEntries().length}，header.parentSession=${String(fresh.getHeader()?.parentSession)}，文件=${String(fresh.getSessionFile())}`,
	);

	// 正确做法二：对已开管理器 newSession({ parentSession })
	const reused = SessionManager.open(s1.file, sessionsDir);
	const reusedNewPath = reused.newSession({ parentSession: resolve(s1.file) });
	check(
		"1f 空历史正确做法 B：已开管理器 newSession({ parentSession }) 可行",
		reused.getEntries().length === 0 &&
			reused.getHeader()?.parentSession === resolve(s1.file) &&
			reusedNewPath !== resolve(s1.file),
		`条目数=${reused.getEntries().length}，header.parentSession=${String(reused.getHeader()?.parentSession)}，新文件=${String(reusedNewPath)}`,
	);
}

/* ── 2. 叶子持久化（最关键）───────────────────────────────────────── */

const s2 = buildLinearSession();
const branchManager = SessionManager.open(s2.file, sessionsDir);
branchManager.branch(s2.a1);
const leafInMemory = branchManager.getLeafId();
const branchInMemory = branchManager.getBranch().map((entry) => entry.id);

const reopened = SessionManager.open(s2.file, sessionsDir);
const leafReopened = reopened.getLeafId();
const branchReopened = reopened.getBranch().map((entry) => entry.id);

// 2a：branch() 之后重开，叶子是否仍是 targetId
check(
	"2a branch() 不持久化叶子：重开落在「文件最后一行」而非 targetId（已知限制）",
	leafInMemory === s2.a1 && leafReopened === s2.a2,
	`branch(a1) 后内存 leaf=${String(leafInMemory)}；重开 leaf=${String(leafReopened)}（=文件最后一行 a2=${s2.a2}）`,
);

// 2b：文件里有没有记录叶子位置的条目
{
	const lines = readLines(s2.file);
	const types = lines.map((entry) => String(entry["type"]));
	const withIds = lines
		.map((entry) =>
			entry["type"] === "session"
				? `session(id=${lineId(entry)})`
				: `${String(entry["type"])}(${lineId(entry)}←${String(entry["parentId"])})`,
		)
		.join(" | ");
	console.log(`INFO  会话 JSONL 逐行 type：${types.join(" → ")}`);
	console.log(`INFO  会话 JSONL 逐行 (type,id,parentId)：${withIds}`);
	check(
		"2b 文件里没有任何叶子指针条目（只有 header + message）",
		lines.length === 5 && !lines.some(looksLikeLeafPointer),
		`共 ${lines.length} 行，type=[${types.join(", ")}]，含叶子指针字段=${lines.some(looksLikeLeafPointer)}`,
	);
}

// 2c：重开后的活动分支是否与回退一致
check(
	"2c 重开后活动分支与回退不一致（回退未持久化）",
	JSON.stringify(branchInMemory) === JSON.stringify([s2.u1, s2.a1]) &&
		JSON.stringify(branchReopened) === JSON.stringify([s2.u1, s2.a1, s2.u2, s2.a2]),
	`回退后内存分支=[${branchInMemory.join(", ")}]；重开分支=[${branchReopened.join(", ")}]`,
);

// 2c 补：叶子的真实口径 = 文件最后一行 —— 在分叉点之后追过条目，重开就落在新分支上
{
	const s2b = buildLinearSession();
	const branched = SessionManager.open(s2b.file, sessionsDir);
	branched.branch(s2b.a1);
	const appended = branched.appendMessage(userMsg("第二轮改问法", T0 + 9000));
	const reopened2 = SessionManager.open(s2b.file, sessionsDir);
	const reopenedIds = reopened2.getBranch().map((entry) => entry.id);
	check(
		"2c 分叉后追加过条目 → 重开叶子落在新条目（叶子口径=文件最后一行）",
		reopened2.getLeafId() === appended &&
			JSON.stringify(reopenedIds) === JSON.stringify([s2b.u1, s2b.a1, appended]),
		`重开 leaf=${String(reopened2.getLeafId())}=新条目；活动分支=[${reopenedIds.join(", ")}]；被放弃的旧尾部仍物理留在文件里（${readLines(s2b.file).length} 行）`,
	);
}

/* ── 3. AgentSession.navigateTree(targetId, {...}) ──────────────────── */

/** 假服务商：127.0.0.1:9 是保留端口，任何意外请求都会立刻失败（同 smoke-session.ts）。 */
const authPath = join(configDir, "auth.json");
const modelsPath = join(configDir, "models.json");
const modelsStorePath = join(configDir, "models-store.json");
writeFileSync(
	modelsPath,
	JSON.stringify(
		{
			providers: {
				"probe-branch": {
					baseUrl: "http://127.0.0.1:9/v1",
					api: "openai-completions",
					apiKey: "placeholder-not-a-real-key",
					models: [{ id: "probe-model", name: "探针模型" }],
				},
			},
		},
		null,
		2,
	),
);
writeFileSync(authPath, "{}");
const runtime = await ModelRuntime.create({
	authPath,
	modelsPath,
	modelsStorePath,
	allowModelNetwork: false,
	refreshOnCreate: false,
});

const s3 = buildLinearSession();
let navSession: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
let navError: string | undefined;
try {
	const model = runtime.getModel("probe-branch", "probe-model");
	const created = await createAgentSession({
		cwd,
		agentDir: configDir,
		modelRuntime: runtime,
		...(model === undefined ? {} : { model }),
		sessionManager: SessionManager.open(s3.file, sessionsDir),
		noTools: "all",
	});
	navSession = created.session;
} catch (error) {
	navError = error instanceof Error ? error.message : String(error);
}

check(
	"3 AgentSession 可在不发请求的前提下构造（假服务商，只构造不 prompt）",
	navSession !== undefined,
	navError === undefined ? "构造成功，未发出任何网络请求" : `构造失败（已知限制）：${navError}`,
);

if (navSession !== undefined) {
	// 构造 AgentSession 本身可能往会话文件里追条目（pi 会落 thinking_level_change /
	// model_change）——先记下构造后的文件状态，下面据此判断 navigate 有没有落盘。
	const linesAfterConstruct = readLines(s3.file);
	console.log(
		`INFO  构造 AgentSession 后会话文件逐行 (type,id,parentId)：${linesAfterConstruct
			.map((entry) =>
				entry["type"] === "session"
					? `session`
					: `${String(entry["type"])}(${lineId(entry)}←${String(entry["parentId"])})`,
			)
			.join(" | ")}`,
	);
	const leafBeforeNav = navSession.sessionManager.getLeafId();
	const res = await navSession.navigateTree(s3.u2, {});
	const leafAfterNav = navSession.sessionManager.getLeafId();
	check(
		"3 navigateTree(用户消息 id) 把叶子移到该消息之前（= 该条目的 parentId）",
		res.cancelled === false && leafAfterNav === s3.a1,
		`leaf: ${String(leafBeforeNav)} → ${String(leafAfterNav)}（期望 a1=${s3.a1}）；cancelled=${String(res.cancelled)}`,
	);
	check(
		"3 navigateTree 回填该用户消息原文（editorText，可直接进输入框）",
		res.editorText === "第二轮问题",
		`editorText = ${JSON.stringify(res.editorText)}`,
	);

	const messages = navSession.agent.state.messages;
	const serialized = JSON.stringify(messages);
	check(
		"3 navigateTree 顺带重建上下文（agent.state.messages 与回退一致）",
		messages.length === 2 && !serialized.includes("第二轮问题"),
		`messages 共 ${messages.length} 条；含「第二轮」=${serialized.includes("第二轮问题")}`,
	);

	const afterNav = SessionManager.open(s3.file, sessionsDir);
	check(
		"3 navigateTree 不持久化叶子：重开仍停在构造后写入的最后一行（已知限制，同 2a）",
		afterNav.getLeafId() === leafBeforeNav && leafAfterNav !== leafBeforeNav,
		`navigate 期间内存 leaf=${String(leafAfterNav)}；重开 leaf=${String(afterNav.getLeafId())}（=构造时的最后一行 ${String(leafBeforeNav)}）`,
	);

	const forkable = navSession.getUserMessagesForForking();
	check(
		"6 补：getUserMessagesForForking() 给出「用户消息 → entryId」映射（可桥接锚点口径）",
		JSON.stringify(forkable.map((item) => item.entryId)) === JSON.stringify([s3.u1, s3.u2]),
		`映射 = ${JSON.stringify(forkable)}`,
	);

	navSession.dispose();
}

/* ── 4. getHeader().parentSession ───────────────────────────────────── */

{
	const s4 = buildLinearSession();
	const opener = SessionManager.open(s4.file, sessionsDir);
	const branchedFile = opener.createBranchedSession(s4.a1);
	const branchedHeader =
		branchedFile === undefined ? null : SessionManager.open(branchedFile, sessionsDir).getHeader();
	console.log(`INFO  分支会话 header = ${JSON.stringify(branchedHeader)}`);
	check(
		"4 getHeader() 读得到 parentSession（camelCase，值为源文件绝对路径）",
		branchedHeader?.type === "session" && branchedHeader.parentSession === resolve(s4.file),
		`parentSession = ${String(branchedHeader?.parentSession)}，type = ${String(branchedHeader?.type)}`,
	);
	const plainHeader = SessionManager.open(s4.file, sessionsDir).getHeader();
	check(
		"4 普通（非抽枝）会话的 header.parentSession 缺席",
		plainHeader !== null && plainHeader.parentSession === undefined,
		`普通会话 header = ${JSON.stringify(plainHeader)}`,
	);
}

/* ── 5. getEntry / getEntries ───────────────────────────────────────── */

{
	const s5 = buildLinearSession();
	const manager = SessionManager.open(s5.file, sessionsDir);
	const entry = manager.getEntry(s5.a1);
	check(
		"5 getEntry(id) 返回对象带 parentId（用于算「分叉点之前」）",
		entry !== undefined && entry.parentId === s5.u1,
		`getEntry(a1).parentId = ${String(entry?.parentId)}（期望 u1=${s5.u1}）`,
	);
	const entries = manager.getEntries();
	// getEntries() 的静态类型是 SessionEntry[]，其 type 联合里**本就不含 "session"**
	// （TypeScript 层面的证据）；这里再按原始字符串比一遍，落到运行时实证。
	const hasHeaderEntry = (entries as readonly { type: string }[]).some((item) => item.type === "session");
	check(
		"5 getEntries() 不含 header（只有条目；SessionEntry 类型联合里也无 session）",
		entries.length === 4 && !hasHeaderEntry,
		`条目数=${entries.length}，含 type=session 的条目=${hasHeaderEntry}`,
	);
	check(
		"5 getEntry(未知 id) 返回 undefined",
		manager.getEntry("no-such-entry") === undefined,
		`getEntry("no-such-entry") = ${String(manager.getEntry("no-such-entry"))}`,
	);
}

/* ── 6. 锚点 id 口径：渲染层 ConversationEntry(user).id vs JSONL 条目 id ─ */

const isUserEntry = (entry: ConversationEntry): entry is Extract<ConversationEntry, { role: "user" }> =>
	entry.role === "user";

{
	const s6 = buildLinearSession();
	const manager = SessionManager.open(s6.file, sessionsDir);
	// 技能消息：pi 把 `/skill:<name>` 展开成整篇 SKILL.md 当作 user 消息 content
	const skillId = manager.appendMessage(
		userMsg(
			'<skill name="docx" location="C:\\Users\\me\\.kamibuddy\\skills\\docx\\SKILL.md">\n' +
				"References are relative to C:\\Users\\me\\.kamibuddy\\skills\\docx.\n\n" +
				"# docx\n技能正文\n</skill>\n\n写周报",
			T0 + 4000,
		),
	);

	const conversation = buildConversationEntries(manager.buildContextEntries());
	const users = conversation.filter(isUserEntry);

	check(
		"6 恢复路径：ConversationEntry(user).id === 会话 JSONL 里 message 条目的 id（一一相等）",
		JSON.stringify(users.map((user) => user.id)) === JSON.stringify([s6.u1, s6.u2, skillId]),
		`渲染层 user id = [${users.map((user) => user.id).join(", ")}]；JSONL 条目 id = [${s6.u1}, ${s6.u2}, ${skillId}]`,
	);
	check(
		"6 技能消息在条目里只是普通 user 消息（不额外拆条），技能名由 splitSkillBlocks 剥出",
		users.length === 3 &&
			JSON.stringify(users[2]?.skillNames) === JSON.stringify(["docx"]) &&
			users[2]?.text === "写周报",
		`user 条目共 ${users.length} 条；第 3 条 skillNames=${JSON.stringify(users[2]?.skillNames)}，text=${JSON.stringify(users[2]?.text)}`,
	);
}

/* ── 汇总 ───────────────────────────────────────────────────────────── */

rmSync(workDir, { recursive: true, force: true });

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
if (failed.length > 0) {
	console.log("失败项：");
	for (const item of failed) console.log(`  - ${item.name}: ${item.detail}`);
	process.exitCode = 1;
}
