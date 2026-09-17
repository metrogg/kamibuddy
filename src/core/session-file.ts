/**
 * 会话文件（JSONL）的原始行读取、前缀切分与原子重写。
 *
 * 为什么需要这一层（实测结论见 scripts/probe-session-branch.ts 文件头）：
 * pi 0.85.1 的叶子位置**不落盘** —— `branch()` / `navigateTree()` 只改内存指针，
 * JSONL 里没有任何叶子指针条目，重新 open 时「叶子 = 文件最后一行」。要让
 * 「回退到某一轮之前」成为文件事实，唯一稳的做法是把母文件重写为
 * 「header + root→分叉点的前缀」：截断后最后一行就是分叉点，重开叶子天然正确，
 * 也不会把被放弃的旧尾部留成隐藏旁支。
 *
 * 为什么逐行搬运、不反序列化再序列化条目：条目类型是 pi 的演进面（每版都可能新增
 * type）。本模块只解析 id/parentId 用来算前缀，写回去的是**原始行文本** —— 将来 pi
 * 加新条目类型这里零改动，也不会因为丢了未知字段而改写历史。
 *
 * 只做文件层：不 import electron、不做业务判断（抽不抽枝、标题叫什么由 daemon 的
 * session-branch 决定）。pi 的运行时允许出现在 core（AGENTS.md §1）。
 */

import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SessionManager, type SessionHeader } from "@earendil-works/pi-coding-agent";
import { getSessionsDir } from "./config-paths.ts";
import { validateSessionFilePath } from "./session-rebuild.ts";

/**
 * 会话文件路径守卫。
 *
 * 本模块的写操作是**物理覆盖**：没有这道守卫，一个 `../..` 穿越或任意绝对路径
 * 就能改写会话目录以外的文件。规则复用 session-rebuild 的 validateSessionFilePath
 * （同一道防线，不重写第二份），目录取 getSessionsDir() —— 调用方无法指定别的目录。
 */
function assertInsideSessionsDir(path: string): void {
	const reason = validateSessionFilePath(path, getSessionsDir());
	if (reason !== undefined) throw new Error(reason);
}

/** 从原始行里索引出的一条可用条目：只关心 id 与 parentId，其余字段一概不碰。 */
interface IndexedEntry {
	/** 该行的原始文本（不含换行）。 */
	readonly line: string;
	readonly id: string;
	readonly parentId: string | null;
}

interface ParsedSessionFile {
	/** 全部原始行（split 末端那个空串已剔除，保证 join("\n")+"\n" 能逐字回写）。 */
	readonly lines: readonly string[];
	/** header 行在 lines 里的下标；无 header 为 -1。 */
	readonly headerIndex: number;
	readonly headerLine: string | undefined;
	readonly header: SessionHeader | undefined;
	readonly entries: readonly IndexedEntry[];
	readonly skippedLines: number;
}

/**
 * 逐行解析：坏行跳过并计数，可用行建成索引。
 *
 * 计数口径与 session-rebuild 的 countSkippedLines 对齐、略宽一点：那边只数 JSON
 * 解析失败的行，这里把「解析得出但不成条目/头部」的行（无字符串 id 的 JSON）也算上
 * —— 它们同样进不了 parentId 链，留在计数里才不会出现「文件里有行、前缀里没有、
 * 账上也不提」的静默丢失。
 */
function parseSessionFile(path: string): ParsedSessionFile {
	const lines = readFileSync(path, "utf8").split("\n");
	// 以 \n 结尾的文件 split 后多一个空串，它不是一行内容；留着会让逐字回写平白多一个空行。
	if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

	const entries: IndexedEntry[] = [];
	let headerIndex = -1;
	let headerLine: string | undefined;
	let header: SessionHeader | undefined;
	let skippedLines = 0;

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		if (line === undefined || line.trim() === "") continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			skippedLines += 1;
			continue;
		}
		if (typeof parsed !== "object" || parsed === null) {
			skippedLines += 1;
			continue;
		}
		const record = parsed as Record<string, unknown>;
		// 只认第一个 header：pi 的 _loadEntries 也是 find 第一个 type === "session"。
		if (record["type"] === "session") {
			if (headerIndex === -1) {
				headerIndex = index;
				headerLine = line;
				header = parsed as SessionHeader;
			}
			continue;
		}
		const id = record["id"];
		if (typeof id !== "string" || id === "") {
			skippedLines += 1;
			continue;
		}
		const parentId = record["parentId"];
		// parentId 缺席/非串 = 没有父节点（根）：与 pi 的 buildSessionPath 同口径
		//（`current.parentId ? index.get(...) : undefined`）。
		entries.push({ line, id, parentId: typeof parentId === "string" ? parentId : null });
	}

	return { lines, headerIndex, headerLine, header, entries, skippedLines };
}

/** 会话文件的原始行：header 行 + 条目行（顺序即文件顺序）。 */
export interface SessionFileLines {
	/** header 行原文；文件无 header 时为 undefined。 */
	readonly headerLine: string | undefined;
	/** 条目行原文（按文件顺序）。 */
	readonly entryLines: readonly string[];
	/** 跳过的不明行数（口径见 parseSessionFile）。 */
	readonly skippedLines: number;
}

/** 读取会话文件的原始行。坏行容忍（跳过并计数），文件读不到则照常抛错。 */
export function readSessionFileLines(path: string): SessionFileLines {
	assertInsideSessionsDir(path);
	const parsed = parseSessionFile(path);
	return {
		headerLine: parsed.headerLine,
		entryLines: parsed.entries.map((entry) => entry.line),
		skippedLines: parsed.skippedLines,
	};
}

/** 解析 header 行（形状 = pi 的 SessionHeader）。无 header / 头部行坏掉 → undefined。 */
export function readSessionHeader(path: string): SessionHeader | undefined {
	assertInsideSessionsDir(path);
	return parseSessionFile(path).header;
}

/** 「header 行 + root→某条目」的原始行序列。 */
export interface SessionPrefix {
	/** header 行原文（未改写）。 */
	readonly headerLine: string;
	/** root→目标条目的条目行原文，链序（root 在前、目标条目在末）。 */
	readonly entryLines: readonly string[];
	readonly skippedLines: number;
}

/**
 * 取「header 行 + root→entryId 的条目行」原文；文件里没有该 id → undefined。
 *
 * 条目 id 不存在是**调用方错误**（锚点算错），本模块不替它挑一个近似的条目、也不
 * 抛错：返回 undefined 让调用方报 no-such-entry，此刻一个字节都还没写。
 * 反过来「文件没有 header」是文件损坏（没有 header 就没有可用的会话文件），
 * 响亮抛错。
 *
 * 链断裂（parentId 指向文件里不存在的条目）即停：pi 的 buildSessionPath 同口径，
 * 这里不发明新语义（断裂行之后的条目自然进不了前缀）。
 */
export function sessionPrefixLines(path: string, entryId: string): SessionPrefix | undefined {
	assertInsideSessionsDir(path);
	const parsed = parseSessionFile(path);
	const { headerLine } = parsed;
	if (headerLine === undefined) throw new Error("会话文件缺少头部，无法取前缀");

	const byId = new Map(parsed.entries.map((entry) => [entry.id, entry]));
	const target = byId.get(entryId);
	if (target === undefined) return undefined;

	// 先回溯出 target→root，再反过来 —— 末行必须是分叉点，重开时叶子才对。
	const chain: IndexedEntry[] = [];
	let current: IndexedEntry | undefined = target;
	while (current !== undefined) {
		chain.push(current);
		current = current.parentId === null ? undefined : byId.get(current.parentId);
	}
	chain.reverse();
	return {
		headerLine,
		entryLines: chain.map((entry) => entry.line),
		skippedLines: parsed.skippedLines,
	};
}

/**
 * 原子写：先把内容写进 `<path>.tmp`，再 rename 覆盖目标。
 *
 * 为什么必须 tmp + rename：会话文件是这段对话的唯一副本，绝不能「先截断再写」——
 * 中途失败会留下半个文件，既打不开也修不回。rename 是原子的：失败时目标保持原样，
 * tmp 由我们清掉。
 *
 * Windows：libuv 的 rename 带 MOVEFILE_REPLACE_EXISTING，覆盖已存在的文件是常规
 * 行为（daemon 的 moveToTrash 注释、session-archive 的落盘同款，均有现网路径走过）。
 * 唯一会被拒的是「目标正被别的进程独占打开」—— 那是调用方的时序问题（同一文件的
 * 宿主必须先 dispose，见 daemon 的桶互斥约定），如实抛错，不重试、不静默。
 */
export function writeSessionFileLines(path: string, lines: readonly string[]): void {
	assertInsideSessionsDir(path);
	const tmp = `${path}.tmp`;
	mkdirSync(dirname(path), { recursive: true });
	try {
		writeFileSync(tmp, lines.length === 0 ? "" : `${lines.join("\n")}\n`, "utf8");
		renameSync(tmp, path);
	} catch (error) {
		// recursive：tmp 位置万一被占成目录也能清干净 —— 清理自身抛错会把真正的失败
		// 原因顶掉，那之后排查成本从这里开始变贵。
		rmSync(tmp, { force: true, recursive: true });
		throw error;
	}
}

/**
 * 把会话文件重写为「header + root→entryId 的前缀」——「重新开始」落盘的唯一手法。
 * 返回 false = 文件里没有该条目（调用方错误），此刻文件一个字节都没动。
 */
export function truncateSessionTo(path: string, entryId: string): boolean {
	const prefix = sessionPrefixLines(path, entryId);
	if (prefix === undefined) return false;
	writeSessionFileLines(path, [prefix.headerLine, ...prefix.entryLines]);
	return true;
}

/**
 * 把会话文件截断成**只有 header**（历史清空）—— 分叉点是首条用户消息时
 * 「重新开始」的形态（spec 的「回退首条用户消息」场景：会话文件与目录保留）。
 *
 * 为什么不复用 truncateSessionTo：它按条目 id 取前缀，需要「分叉点的父条目」
 * 存在；分叉点是首条消息时父条目就是空（null），没有任何 id 可传。也不走
 * writeSessionFileLines(path, []) —— 没有 header 的会话文件打不开（pi 的
 * _setSessionFile 会把空文件当新会话重建，等于换个 sessionId 丢掉身份）。
 */
export function truncateSessionToStart(path: string): void {
	assertInsideSessionsDir(path);
	const parsed = parseSessionFile(path);
	if (parsed.headerLine === undefined) throw new Error("会话文件缺少头部，无法清空历史");
	writeSessionFileLines(path, [parsed.headerLine]);
}

/**
 * pi 抽枝：把 sourcePath 的 root→leafId 全量条目抽成一条**新会话文件**（母文件
 * 不动），返回新文件路径。
 *
 * 为什么用一次性 manager 而不是活宿主的管理器（关键，别改回去）：pi 的
 * `SessionManager.createBranchedSession` 在持久化模式下会把**管理器自身**的
 * sessionId / sessionFile 换成抽出的新文件（dist/core/session-manager.js:1162-1165），
 * 在活宿主的管理器上调用等于把母会话的**后续落盘**全部劫持进分支文件。这里
 * `open` 一个用完即弃的实例：母文件与活宿主都不受影响（实测源文件字节不变，
 * 见 scripts/probe-session-branch.ts 1b）。open 只读不写（版本已是当前版，
 * migrate 不改写），因此与活宿主并存没有双写窗口。
 *
 * 返回 undefined 的两种情形都由调用方兜底：
 *   - 抽出内容**不含 assistant** 时 pi 只返回路径、文件还没落盘（探针 1d）——
 *     本函数如实返回那个路径，由调用方用 existsSync 判定后改走前缀写入器；
 *   - leafId 在文件里不存在时 pi 会抛错，这里不吞（那是调用方的锚点算错了）。
 */
export function createBranchedSessionFile(sourcePath: string, leafId: string): string | undefined {
	assertInsideSessionsDir(sourcePath);
	const temp = SessionManager.open(sourcePath, getSessionsDir());
	return temp.createBranchedSession(leafId);
}

/**
 * 只改 header 行的 parentSession，其余行逐字不变。
 *
 * 为什么自己改而不走 pi：pi 只在 createBranchedSession 时写 parentSession，对已存在
 * 的文件没有改写入口（实测），而「分支来源」是列表与侧栏标识的数据源。
 */
export function setSessionParentSession(path: string, parentSession: string): void {
	assertInsideSessionsDir(path);
	const parsed = parseSessionFile(path);
	const { header, headerLine, headerIndex } = parsed;
	if (header === undefined || headerLine === undefined) {
		throw new Error("会话文件缺少头部，无法写入来源会话");
	}
	const lines = [...parsed.lines];
	// 按解析出的下标替换，不假设 header 一定在第 0 行（第 0 行只是 pi 的写法惯例）。
	lines[headerIndex] = JSON.stringify({ ...header, parentSession: resolve(parentSession) });
	writeSessionFileLines(path, lines);
}

/**
 * 追加会话名（pi 的 session_info 条目）。
 *
 * 不手写这一行：id 生成规则属于 pi（generateId 要避开已有 id），自己造容易撞。
 * 目标名已是当前会话名时跳过 —— 重复追加只会让文件多一条完全相同的 session_info。
 */
export function setSessionName(path: string, name: string): void {
	assertInsideSessionsDir(path);
	const manager = SessionManager.open(path, getSessionsDir());
	if (manager.getSessionName() === name) return;
	manager.appendSessionInfo(name);
}

/** pi 生成 header 与文件路径，落盘由本模块负责（理由见 createEmptySessionFile）。 */
function newSessionHeader(cwd: string, parentSession: string): { path: string; header: SessionHeader } {
	const manager = SessionManager.create(cwd, getSessionsDir(), {
		parentSession: resolve(parentSession),
	});
	const header = manager.getHeader();
	const path = manager.getSessionFile();
	// 持久化模式（create 走的路径）必然有 header 与文件路径；拿不到就是 pi 语义变了。
	if (header === null || path === undefined) throw new Error("pi 未生成会话 header");
	return { path, header };
}

/**
 * 建一条只有 header 的空会话文件（分叉点在首条用户消息之前时的形态），返回新路径。
 *
 * 实测（探针 1f）：空历史不能用 `createBranchedSession(null)` —— 它静默回落到当前
 * 叶子、抽出全量历史。正确入口是 `SessionManager.create(cwd, dir, { parentSession })`，
 * 但它**不立刻落盘**（pi 的 flush 守卫：首个 assistant 到达才写文件，见 _persist 的
 * hasAssistant 分支），而侧栏列表读的是磁盘真相 —— 所以路径与 header 交给 pi 生成
 * （版本号 / uuidv7 id / 时间戳跟它自己的口径一致，不手写），落盘由本模块补上。
 */
export function createEmptySessionFile(cwd: string, parentSession: string): string {
	const created = newSessionHeader(cwd, parentSession);
	writeSessionFileLines(created.path, [JSON.stringify(created.header)]);
	return created.path;
}

/**
 * 把 sourcePath 的「root→entryId 前缀」写成一条新会话文件（母文件不动），新会话的
 * parentSession 指向 sourcePath；entryId 不存在 → undefined，不写任何文件。
 *
 * 用途：pi 抽枝「返回了路径但没落盘」的边角（抽出内容不含 assistant 时
 * createBranchedSession 只返回路径，见探针 1d）。为什么不给调用方自己拼 header：
 * header 形状（version / id 生成规则）属于 pi，多一份手写就会漂。
 */
export function createSessionFileFromPrefix(sourcePath: string, entryId: string): string | undefined {
	const prefix = sessionPrefixLines(sourcePath, entryId);
	if (prefix === undefined) return undefined;
	const sourceHeader = readSessionHeader(sourcePath);
	if (sourceHeader === undefined) throw new Error("会话文件缺少头部，无法派生新会话");
	const created = newSessionHeader(sourceHeader.cwd, sourcePath);
	writeSessionFileLines(created.path, [JSON.stringify(created.header), ...prefix.entryLines]);
	return created.path;
}
