/**
 * 权限判定策略：纯函数，不碰 pi、不碰 IPC，可单测。
 *
 * 为什么必须有这一层：pi **没有内置权限系统**（README 自述），
 * 而且 `utils/paths.ts:102` 的 resolvePath 对绝对路径直接放行 ——
 * 工具目录里搜不到任何越界检查，`getCwdRelativePath` 只用于显示格式化。
 * 结论：模型只要给出绝对路径，write/edit 就能写到硬盘任何位置。
 *
 * 对办公产品这是不能接受的：试用同事会让它「整理我的文档」，
 * 一次路径失误就可能覆盖掉别的文件。
 *
 * 判定的主轴是**路径归属**而非工具种类：
 *   工作目录内   → 放行（生成文档本来就该在这儿，不该反复打扰）
 *   工作目录外   → 询问（用户可能真想改桌面上的某个文件）
 *   配置目录内   → 直接拒（auth.json 存着 API Key，
 *                  提示注入可能骗用户点「允许」，所以不给这个选项）
 *
 * 判定链的顺序（借鉴 WorkBuddy 的 9 阶求值链，简化但同样**有序**）：
 *   0. 记忆文件白名单（MEMORY.md / PROFILE.md / cwd 的 .kamibuddy/memory/**）
 *      —— 纯数据，文件工具一律放行，任何档位不拦
 *   1. 受保护凭据路径（读或写都拒）—— 任何模式都不能越过
 *   2. 只读工具：无本地路径的一律放行；有路径的按
 *      路径规则 deny → 工作区内放行 → resourcesDir 放行 →
 *      danger-full-access 放行 → 路径规则 allow → 区外低风险询问
 *      的顺序判（spec: extend-permission-rules-to-paths）
 *   3. 沙箱模式的范围约束（read-only 拒一切写与命令）
 *   4. 工具种类（shell 任何档都问 —— 但 powershell 先过持久前缀规则：
 *      全段 allow → 放行、任一段 deny → 直拒、无命中维持高风险询问，
 *      spec: add-permission-rules-engine；写工具按 应用目录内高风险询问 →
 *      工作区内放行 → 区外询问 的顺序判；改应用自身数据的
 *      automation_create/delete 询问；MCP 工具询问；未知工具询问）
 *   5. 审批策略（ask → 弹窗；never → 确定性拒绝）
 * 顺序本身就是语义：靠后的阶段无法放行靠前阶段已经拒掉的东西。
 *
 * 【2026-09-08 修一个回归】此前「读配置目录放行」的理由写的是
 * "真正的防线是不让模型把内容发出去（无网络工具）"。
 * **T3 加了 web_search / web_fetch 之后这个前提就不成立了** ——
 * 外发通道已经存在，读到密钥就能被带走（哪怕只是提示注入诱导的）。
 * 所以现在凭据文件**禁读**，而不只是禁写。
 *
 * 【2026-09-08 修第二个回归】上面的禁读一刀切误伤了 configDir/skills/：
 * 渐进式披露靠模型用 read 工具加载 SKILL.md 全文（系统提示词里只放索引），
 * 全禁读让已安装技能变成「列表里有但永不可用」的死技能。
 * 所以技能子目录对**只读工具**例外放行；写仍拒（见阶段 1 注释）。
 *
 * 【2026-09-09 事故条目】默认工作区（空目录）+ 默认权限档下，模型经提示词里的
 * 技能路径发现项目目录，自由读取项目源码与合规敏感素材后，对工作区外文件发起 edit。
 * 教训一：**读侧漫游是写越界的必经入口** —— 所以 read/find/grep/ls 出工作区
 * 改为低风险询问（阶段 2），不再一律放行。codex 的 workspace-write 同样不限读，
 * 但它的沙箱**默认禁网**；我们有 web_fetch 外发通道（读任意文件 + 抓任意 URL
 * = 数据外带），前提不同结论不同 —— 与上面 2026-09-08 凭据禁读是同一条推理链。
 * 教训二：事故里模型要改的正是 KamiBuddy 自身目录 —— 所以写应用目录升为
 * 高风险询问，且先于「工作区内放行」判定（appDir 也可能就是工作目录）。
 */

import { isAbsolute, join, resolve, sep } from "node:path";
import { canonicalizePath, isPathContained } from "../core/path-containment.ts";
import {
	DEFAULT_PERMISSIONS,
	LOCAL_READ_TOOLS,
	resolveAsk,
	type PermissionSettings,
	type SandboxMode,
} from "../shared/permissions.ts";
import { evaluateCommand, evaluatePathRules, type PermissionRule } from "./permission-rules.ts";
import { classifySafeCommand, commandTouchesConfigAsCode, isConfigAsCodePath } from "./safe-commands.ts";

/** 判定结果。ask 时需要弹窗，deny 时直接拒绝并把 reason 回给模型。 */
export type PermissionDecision =
	| { readonly kind: "allow" }
	| { readonly kind: "deny"; readonly reason: string }
	| {
		readonly kind: "ask";
		readonly risk: "low" | "medium" | "high";
		/** 面向用户的一句话，如「写入工作目录之外的文件」。 */
		readonly summary: string;
		/** 折叠展示的细节（路径、命令等）。 */
		readonly details: string;
	};

/** 判定所需的输入。与 pi 的事件类型解耦，便于单测。 */
export interface ToolCallFacts {
	readonly toolName: string;
	/** 工具入参里的目标路径，没有则 undefined。 */
	readonly path: string | undefined;
	/** shell 命令（bash / powershell 专用）。 */
	readonly command: string | undefined;
}

export interface PolicyPaths {
	/** 会话工作目录（~/KamiBuddy）。目录内的改动免打扰。 */
	readonly workspaceDir: string;
	/** 配置目录（~/.kamibuddy）。存着 API Key，禁读禁写；skills/ 子目录对只读工具例外。 */
	readonly configDir: string;
	/**
	 * 额外的受保护目录（凭据类）。**读与写都拒，且任何沙箱模式都不能越过。**
	 *
	 * 省略时只保护 configDir —— 这是保守兜底，但调用方应当传全
	 * （daemon 用 defaultProtectedDirs(homedir()) 组装）。
	 * 之所以不在本文件里读 os.homedir()：这一层要保持纯函数、可单测。
	 */
	readonly protectedDirs?: readonly string[];
	/**
	 * 应用目录（dev 为项目根，打包后为安装目录）。
	 *
	 * 写自身目录永远高风险询问（哪怕它恰好就是工作目录）；读不特殊化，
	 * 走通用区外读询问。可选：不传则这条规则不生效（向后兼容）；daemon 必传。
	 */
	readonly appDir?: string;
	/**
	 * 应用内置资源目录（resources/：技能/模板/tokens/docx 引擎）。
	 * **只读工具一律放行**：渐进式披露的技能加载（docx 技能的编排文件、模板、
	 * tokens、专家定义）全靠模型用 read 按路径自取 —— 这些是随应用分发的产品
	 * 内容，不是用户文件，问「读取工作目录之外」是误伤（2026-09-11 用户实测：
	 * 读自带 SKILL.md 被弹窗）。
	 * 写侧不因此放开：resources/ 在 appDir 之下，MUTATING 仍走高风险询问。
	 * 可选：不传则这条规则不生效；daemon 必传。
	 */
	readonly resourcesDir?: string;
}

/**
 * 判定时的运行期事实（与路径布局无关，所以不并进 PolicyPaths）。
 *
 * 独立成参而不是塞进 `PolicyPaths`：那个类型是**目录布局**（静态配置），
 * 而这里是**运行期状态**（会随探测与授权结果变化）。混在一起会让调用方
 * 以为它也是启动时定死的，从而缓存一份陈旧的值 —— 那正是 fail-closed 判据
 * 最不能出的错。
 */
export interface PolicyContext {
	/**
	 * 本次调用的工作区里，沙箱写约束**是否确实在生效**。
	 *
	 * `undefined` / `false` 都按「不生效」处理（fail-closed）。
	 * 它必须蕴含「ACL 授权已成功」，不能只是「探测通过」——
	 * 理由见 daemon/index.ts 的 isSandboxReadyFor。
	 */
	readonly sandboxReady?: boolean;
}

/**
 * 默认受保护的凭据目录（相对家目录）。
 *
 * 选取标准：**泄露即造成账号级损失**的东西。抄 WorkBuddy 的 tsbx_rules.json
 * （`no_access: %USERPROFILE%\.ssh\**, .gnupg\**`）与 pi sandbox 扩展的
 * 默认 denyRead（`~/.ssh`, `~/.aws`）。
 *
 * 不含浏览器 Cookie 库：那些路径按浏览器/版本变化大，误伤正常操作的概率高，
 * 且真要防得靠 OS 沙箱。这里只收敛"路径稳定 + 后果严重"的那批。
 */
export function defaultProtectedDirs(homeDir: string): readonly string[] {
	return [
		resolve(homeDir, ".ssh"), // SSH 私钥
		resolve(homeDir, ".gnupg"), // GPG 私钥
		resolve(homeDir, ".aws"), // 云凭据
		resolve(homeDir, ".kube"), // 集群凭据
		resolve(homeDir, ".docker"), // registry 凭据
		resolve(homeDir, ".npmrc"), // npm token（文件，isInside 同样成立）
		resolve(homeDir, ".git-credentials"),
		resolve(homeDir, ".pi", "agent"), // pi 自己的 auth.json
	];
}

/**
 * 只读工具：不改变任何状态。
 *
 * 其中 web_search / web_fetch / present_files / automation_list / questionnaire
 * 没有本地路径概念，维持一律放行：不写本地、不改任何状态，且数据不是密钥。
 * 不可信内容的风险由工具层（web-tools.ts）的标记 + 本门对「后续写操作」的
 * 拦截共同兜住。
 * present_files 同理：stat 文件大小（限工作区）+ 发交付事件，不写盘。
 * automation_list 同理：读的是 KamiBuddy 自己的任务库（automations.json），
 * 与 web_search 同类——不涉及用户文件系统，也没有路径参数可判。
 * questionnaire 同理：它只是把问题递给 UI 等用户作答，输入全部来自用户本人，
 * 不触文件系统、不改任何状态 —— read-only 档下也同样放行（问用户一个问题
 * 不构成「修改文件或执行命令」）。
 * read_me / show_widget 同理（内联可视化，spec: add-inline-widgets）：
 * read_me 返回 resources/visualizer/ 下随应用分发的设计指南文本（读的是
 * 应用自带数据，不是用户文件）；show_widget 把 SVG/HTML 片段交给 UI 内联
 * 渲染，不触文件系统、不改任何状态 —— 与 questionnaire 同口径放行。
 * conversation_search 同理（spec: add-memory-system）：读的是 KamiBuddy 自己的
 * 会话库（sessions/*.jsonl，daemon 内部读盘不经工具入参），与 automation_list
 * 同档 —— 不涉及用户文件系统，也没有路径参数可判。
 * todo_write 同理（任务清单，spec: add-todo-task-list-panel）：只更新会话内
 * 待办清单的展示状态，不触文件系统、不改应用数据 —— 与 questionnaire 同口径。
 * task 同理（子代理委派）：它本身只做编排，真正的敏感操作发生在子代理内部，
 * 由 subagent-runner 自带的权限门（同一套 PermissionSettings，含 read-only
 * 档拒绝写）逐次判定 —— 主会话对「发起委派」再弹一次窗是纯打扰
 * （2026-09-11 用户实测：todo_write 未登记落 fail-safe 被弹窗，
 * WorkBuddy 对这类无本地副作用的工具不询问）。
 *
 * read / read_document / find / grep / ls 有本地路径概念，**出工作区要询问**
 * （LOCAL_READ_TOOLS，见文件头【2026-09-09 事故条目】）——「只读」不再等于「随便读」。
 * read_document 与 read 完全同语义（工作区内放行、区外低风险询问、凭据目录禁读）：
 * 它只是换了种解析方式，读的还是本地文件，边界不该因文件格式不同而不同。
 */
const READ_ONLY = new Set([
	"read",
	"read_document",
	"find",
	"grep",
	"ls",
	"web_search",
	"web_fetch",
	"present_files",
	"automation_list",
	"questionnaire",
	"read_me",
	"show_widget",
	"conversation_search",
	"todo_write",
	"task",
]);

/**
 * 会改文件的内置工具。
 *
 * docx_convert 同属此档（「写工作区产物文件」，spec Requirement: 转换调用受控）：
 * 它读 htmlPath、写 outputPath —— 判定锚定产物路径 outputPath
 * （permission-gate 的 extractFacts 把它映射进 facts.path），语义与 write 一致：
 * 工作区内放行、区外询问、read-only 拒、appDir 高风险。
 * htmlPath 读侧不单判：它通常是模型刚在工作区写好的排版中间态。
 * venv（~/.venv-html-to-docx）与引擎目录的写入是工具内部 spawn 的副作用，
 * 不经工具入参 —— 与 AutomationStore 落 configDir 同例，不需要也不许为阶段 1 开口子。
 */
const MUTATING = new Set(["write", "edit", "docx_convert"]);

/** 会执行任意命令的工具。powershell 在 craft 白名单里；bash 默认工具集没有，但扩展或设置可能启用。 */
const SHELL = new Set(["bash", "powershell"]);

/** MCP 工具的命名前缀（mcp__<server>__<tool>，mcp-client.ts 的 sanitizeToolName 拼出）。 */
const MCP_TOOL_PREFIX = "mcp__";

/**
 * 改变 KamiBuddy 自身数据的工具（目前只有 automation_*，经 AutomationStore
 * 落 ~/.kamibuddy/automations.json，不经工具路径参数）。
 *
 * 显式登记为询问，而不是依赖末尾「未知工具」的 fail-safe：两者今天的结果
 * 相同（medium 询问），但 fail-safe 的默认值将来若变动，不该静默改变
 * 这类工具的语义。定为询问而非放行：创建/删除定时任务改变应用自身数据，
 * 且任务会在后台无人值守地跑，默认从紧；用户可用审批弹窗的「记住」免除。
 *
 * 落盘文件在 configDir 内、阶段 1 本就禁写——那是 AutomationStore 的内部
 * 实现路径，不经过工具入参，所以这里不需要、也不许为阶段 1 开口子。
 */
const APP_DATA_MUTATING = new Set(["automation_create", "automation_delete"]);

/**
 * 判断 target 是否在 base 之内（含 base 本身）。
 *
 * 导出供 daemon 复用（项目信任要问同一个问题：这目录是不是我们自己的工作空间）。
 * 不各写一遍是因为 `..` 前缀那几个边界条件很容易写错，而这里有测试覆盖
 * （含「同名前缀兄弟目录不算目录内」这条）。
 */
export function isPathInside(base: string, target: string): boolean {
	return isInside(base, target);
}

/**
 * 目录归属判定。实现在 `core/path-containment.ts`（**会解析 junction/symlink**）。
 *
 * 2026-09-16 之前这里是纯词法判定（只 `resolve()`），可被 NTFS junction 绕过 ——
 * `scripts/probe-junction-containment.ts` 在真实文件系统上实测：工作区内建一个
 * 指向区外的 junction，写它判定 `allow`（文件落到区外且不弹窗）；指向凭据目录时
 * 读它也判定 `allow`（本该「任何模式都不放行」的禁区被绕过）。junction
 * **不需要管理员权限**就能建，所以这是模型真走得通的路径。
 *
 * 保持这个包装函数而不是各处直接调 core：判定链里有十几个调用点，
 * 留一层薄包装让「本层的归属语义」只有一处定义。
 */
function isInside(base: string, target: string): boolean {
	return isPathContained(base, target);
}

/**
 * 记忆文件白名单（spec: add-memory-system）：三层记忆路径 ——
 *   配置目录下的 MEMORY.md / PROFILE.md（精确文件名），
 *   会话 cwd 下的 .kamibuddy/memory/ 目录及其下所有文件。
 *
 * 为什么放行：这三个路径是**纯数据**（Markdown 笔记），不含可执行配置。
 * 配置目录禁写防的是「自毁」—— preferences/auth/models 被改等于应用行为
 * 被劫持；而记忆文件恰恰是模型用 edit 自己维护的，维护记忆就是记忆系统
 * 的功能本体，拦它等于功能自残（写 MEMORY.md 每轮撞墙，记忆永远建不起来）。
 *
 * 为什么连 read-only 档也放行（先于阶段 3）：写入纪律是系统提示词的固定
 * 注入段，要求完成实质工作即记当日日志；只读档拦写会让模型每轮会话都
 * 撞墙报错。read-only 的语义是「不动用户的文件」，记忆文件是 KamiBuddy
 * 自己的数据，与 automation_* 落 configDir 同类 —— 只是它经工具路径入参，
 * 所以必须在门这里显式开口子。
 *
 * 用 isInside 做判定：文件 base 时等价于精确相等（rel === ""），且 Windows
 * 上 path.relative 大小写不敏感 —— memory.md 与 MEMORY.md 是同一个文件，
 * 不留给「换个大小写就判定漂移」的缝。
 */
function isMemoryPath(target: string, configDir: string, cwd: string): boolean {
	if (isInside(join(configDir, "MEMORY.md"), target)) return true;
	if (isInside(join(configDir, "PROFILE.md"), target)) return true;
	return isInside(join(cwd, ".kamibuddy", "memory"), target);
}

/*
 * 「配置即代码」名单与判定（isConfigAsCodePath）住在 safe-commands.ts ——
 * 四期加「命令文本侧」闸门（commandTouchesConfigAsCode）时两边必须共享
 * 同一份名单，而本模块已 import 那边，所以名单跟着逻辑走。
 * isConfigAsCodePath 的调用点在下方 MUTATING 分支。
 */

/**
 * 判定一次工具调用。
 *
 * `settings` 省略时用 DEFAULT_PERMISSIONS（= workspace-write + ask），
 * **恰好等于引入沙箱模式之前的行为** —— 所以加这个参数不改变任何既有调用点。
 *
 * `rules` 是持久前缀规则集（spec: add-permission-rules-engine），可选：
 * 省略 = 无规则，powershell 维持逐次高风险询问。作为参数注入而不是在
 * 本模块里读盘 —— 这一层保持纯函数、可单测，IO 归 daemon 装配侧。
 *
 * 不写「未知工具一律放行」也不写「一律拒绝」：
 * 未知工具按 ask 处理，让人来决定 —— 这是 fail-safe 的默认，
 * 且不会悄悄阻断新能力。
 */
export function decide(
	facts: ToolCallFacts,
	paths: PolicyPaths,
	cwd: string,
	settings: PermissionSettings = DEFAULT_PERMISSIONS,
	rules?: readonly PermissionRule[],
	context?: PolicyContext,
): PermissionDecision {
	const decision = decideUnderMode(facts, paths, cwd, settings.sandbox, rules, context);

	// 审批策略只作用在「要问」的结果上 —— allow / deny 都已是终局。
	if (decision.kind !== "ask") return decision;
	if (resolveAsk(settings.approval) === "ask") return decision;

	// never = **确定性拒绝**，不是静默放行（照 dsh 的语义）。
	// 无人值守时「不问」必须等于「不做」，否则这个开关就成了完全敞开的后门。
	return {
		kind: "deny",
		reason: `当前审批策略为「不询问」，需要批准的操作会被直接拒绝：${decision.summary}`,
	};
}

/** 沙箱模式下的判定（不含审批策略）。拆开是为了让两个旋钮各自可测。 */
function decideUnderMode(
	facts: ToolCallFacts,
	paths: PolicyPaths,
	cwd: string,
	mode: SandboxMode,
	rules?: readonly PermissionRule[],
	context?: PolicyContext,
): PermissionDecision {
	const { toolName, path: rawPath, command } = facts;

	/*
	 * 相对路径按会话 cwd 解析，与 pi 的 resolveToCwd 行为一致；
	 * 随后**归一化到真实位置**（解析 junction/symlink，见 core/path-containment.ts）。
	 *
	 * 为什么连 `details` 也用归一化后的值（它就是 target）：details 是审批弹窗
	 * 给用户看的路径。若只归一化判定而把链接原样展示，弹窗就会**隐瞒文件的真实
	 * 去处** —— 用户以为在批准「写工作区里的某个文件」，实际批准的是写区外。
	 * 那比不归一化更糟：它把一次知情同意变成了误导。
	 *
	 * 连带的两处一致性（都靠这里的同一个值保证）：
	 *   `writeBackPath` —— 写回的路径规则记的是真实目录，而不是某个链接名；
	 *   `rememberKey`  —— 同一目标两次调用必须得到同一个会话记忆键
	 *                     （所以那边也做同样的归一化）。
	 */
	const target =
		rawPath === undefined || rawPath === ""
			? undefined
			: canonicalizePath(isAbsolute(rawPath) ? rawPath : resolve(cwd, rawPath));

	/*
	 * 阶段 0：记忆文件白名单 —— 文件工具（读 / 写）对三层记忆路径一律放行，
	 * 先于阶段 1 的配置目录禁写与阶段 3 的只读拒绝（理由见 isMemoryPath 注释）。
	 * 只限文件工具：shell 的 path 入参没有语义（命令才是本体），
	 * 不能拿「路径恰好在记忆目录」给一条命令放行。
	 */
	if (
		target !== undefined &&
		(READ_ONLY.has(toolName) || MUTATING.has(toolName)) &&
		isMemoryPath(target, paths.configDir, cwd)
	) {
		return { kind: "allow" };
	}

	/*
	 * 阶段 1：受保护的凭据路径 —— **读与写都拒，任何模式都不能越过**。
	 *
	 * 借鉴 WorkBuddy 把配置写保护做成独立一层（即使 bypassPermissions 也拦）。
	 * 不给「允许」选项是有意的：提示注入可以编一个理由骗用户点允许，
	 * 而这类文件一旦泄露就是账号级损失，不该由一次弹窗决定。
	 *
	 * Windows 上 path.relative 大小写不敏感（已实测：`c:\users\foo\.ssh` 与
	 * `C:\Users\Foo\.SSH` 都能正确判定为同一目录），不必额外做大小写归一。
	 */
	if (target !== undefined) {
		if (isInside(paths.configDir, target)) {
			/*
			 * 技能子目录对只读工具例外：渐进式披露的加载路径就在这里 ——
			 * 系统提示词只放技能索引（name + description + filePath），
			 * 全文靠模型用 read 工具按需加载（skill-install.ts 的 filePath
			 * 与 session-host 的提示词组装都指向这个目录）。
			 * 一刀切禁读会让用户安装的技能全部变成「列表里有但永不可用」的死技能。
			 *
			 * 只放开读：写仍拒。技能正文 = 提示词，write/edit 篡改即提示注入；
			 * 安装走 daemon 的 skill-install 校验通道（frontmatter 校验 + 同名拒绝），
			 * 不经工具层，所以这里不需要为写开任何口子。
			 */
			if (READ_ONLY.has(toolName) && isInside(join(paths.configDir, "skills"), target)) {
				return { kind: "allow" };
			}
			/*
			 * 会话库（sessions/）对只读工具例外：内置「记忆整理」蒸馏任务的
			 * run 会话 cwd 就是配置目录，它要用 read/grep/ls 翻近 3 天的会话
			 * JSONL 来蒸馏画像 —— 读自己的会话库与 automation_list 同属
			 * 「读 KamiBuddy 自己的数据」，不该撞配置目录的禁读墙
			 * （spec: add-memory-system；conversation_search 的 daemon 侧实现
			 * 不经工具层，不依赖这条口子）。
			 *
			 * 只放开读：写仍拒。会话文件的唯一写者是 SessionManager，
			 * 工具层写等于篡改历史记录 —— 与 skills/ 的「只放开读」同一取向。
			 */
			if (READ_ONLY.has(toolName) && isInside(join(paths.configDir, "sessions"), target)) {
				return { kind: "allow" };
			}
			return { kind: "deny", reason: "禁止读写 KamiBuddy 的配置与凭据文件" };
		}
		for (const dir of paths.protectedDirs ?? []) {
			if (isInside(dir, target)) {
				return {
					kind: "deny",
					reason: `禁止访问凭据目录 ${dir} —— 这类文件泄露会造成账号级损失，任何权限模式都不放行`,
				};
			}
		}
	}

	/*
	 * 阶段 2：只读工具（不改变任何状态）。
	 *
	 * 无本地路径概念的（web_search / web_fetch / present_files / automation_list /
	 * questionnaire / read_me / show_widget）一律放行。
	 * 有路径概念的（read / read_document / find / grep / ls）：凭据/配置 deny
	 *   （阶段 1）与用户 deny 规则照旧，其余**一律放行** —— 含工作区外。
	 *
	 * 【2026-09-16 二次翻转（对齐水位）】区外读曾因【2026-09-09 事故条目】
	 * 从放行改成低风险询问（教训：读侧漫游是写越界的必经入口）。四期把它
	 * 翻回放行，两个前提变了：
	 *   1. **询问已不构成边界**：先跑后问放行了 shell，`Get-Content <区外路径>`
	 *      不弹窗 —— 同一份文件用 read 工具问、用 powershell 不问，只剩不一致
	 *      而没有更严（用户实测撞上的就是它）；
	 *   2. **三家读侧全部自由**（codex/dsh/WorkBuddy，见四期对比），用户明确
	 *      「不用比他们严格，齐平就行」。我们仍保留凭据目录 deny + 用户
	 *      deny 规则（WorkBuddy 的 no_access 同级）。
	 * 事故教训本身仍然成立，但它的对位防线变了：写越界现在由 OS 沙箱兜
	 * （当时没有），外发由检查器+（将来的）网络隔离兜。
	 */
	if (READ_ONLY.has(toolName)) {
		if (!LOCAL_READ_TOOLS.has(toolName)) return { kind: "allow" };
		if (target === undefined) return { kind: "allow" };
		/*
		 * 路径前缀规则（spec: extend-permission-rules-to-paths）：deny 先于
		 * 放行 —— 用户明示禁读的目录比档位更强（与 powershell 规则阶段同
		 * 口径）。凭据禁区仍在阶段 1，规则无法越过。allow 规则在放行世界
		 * 里已冗余（不问就是放），保留判定只为 deny 单侧。
		 */
		const verdict = rules === undefined ? undefined : evaluatePathRules(target, rules);
		if (verdict !== undefined && verdict.kind === "deny") {
			return { kind: "deny", reason: verdict.reason };
		}
		return { kind: "allow" };
	}

	/*
	 * 阶段 3：只读模式下，一切改动都拒 —— 这是模式的全部含义。
	 *
	 * 【四期起 shell 不再在此一刀切】read-only 的命令交给下方 SHELL 分支：
	 * 沙箱就绪时进**只读沙箱**执行（受限列表 [登录 SID, Everyone]，无任何写
	 * 能力 —— 写不进任何位置，连 .git/config 都不行，fsmonitor 链在 OS 层
	 * 就断了）。这与 dsh 的 read-only 同语义：命令能跑，文件动不了。
	 * 沙箱未就绪时 SHELL 分支兜底回到「拒」（见下方尾部）。
	 * 其余工具（写 / automation / MCP / 未知）照旧拒 —— 它们没有 OS 约束可依。
	 */
	if (mode === "read-only" && !SHELL.has(toolName)) {
		return {
			kind: "deny",
			reason: "当前权限为「只读」，不能修改文件。需要动手请切换权限预设。",
		};
	}

	if (SHELL.has(toolName)) {
		/*
		 * powershell 在 danger-full-access 档放行：该档的语义就是完全访问、
		 * 不再逐次询问；凭据目录已在阶段 1 拦掉，命令级的危险操作
		 * （iex / 下载执行 / 递归删除 …）由工具层的危险命令检查器拦截 ——
		 * 分工是「门管要不要问人，检查器管这条命令能不能跑」。
		 *
		 * bash 任何档都维持高风险询问：没有为它配工具与检查器
		 * （Windows 目标用户没有 Git for Windows，默认工具集不含 bash），
		 * 没有 OS 沙箱时一条命令就能绕开上面所有路径保护
		 * （`type ~\.ssh\id_rsa`），这里保持 fail-closed —— 我们既然批评了
		 * WorkBuddy broker shim 的 fail-open，自己就不能在同一处松手。
		 *
		 * 询问一律把完整命令给用户看。配合审批策略：approval=never 时
		 * ask 会变成 deny（而非放行），无人值守下「不问」等于「不做」。
		 */
		if (toolName === "powershell" && mode === "danger-full-access") {
			return { kind: "allow" };
		}
		/*
		 * 规则阶段（spec: add-permission-rules-engine）：powershell 的持久前缀规则。
		 *
		 * 位置是有意的，三个「不越过」：
		 *   - 在阶段 1（凭据禁区）与阶段 3（read-only 拒）之后 —— 凭据目录与
		 *     只读档永远比规则强，用户写过 git allow 也不能在只读档跑 git；
		 *   - 在 danger-full-access 放行之后 —— 该档语义是「不再逐次询问」，
		 *     规则（含 deny）不参与，完全访问就是完全访问；
		 *   - 在兜底高风险询问之前 —— 无命中（unmatched）维持现状逐次询问。
		 *
		 * bash 不走规则（上面注释的 fail-closed 理由不变）：它没有危险命令
		 * 检查器，规则面先不覆盖 —— evaluateCommand 也只匹配 rule.tool ===
		 * 调用工具的规则，powershell 的规则到不了 bash。
		 *
		 * 规则放行 ≠ 检查器放行：危险命令检查器（command-guard）在工具层独立
		 * 运行，allow 规则放行的命令照样过检查器（iex 类照样拦）——
		 * 「门管要不要问人，检查器管这条命令能不能跑」的分工不变。
		 */
		if (toolName === "powershell" && rules !== undefined && command !== undefined) {
			const verdict = evaluateCommand(command, toolName, rules);
			if (verdict.kind === "allow") return { kind: "allow" };
			if (verdict.kind === "deny") return { kind: "deny", reason: verdict.reason };
		}

		/*
		 * 内置安全名单（spec: 沙箱三期 · 审批放松）。**位置是语义的一部分**：
		 *
		 *   在用户规则**之后** —— 用户写的 `deny: npm` 必须能盖掉内置的 `npm run`
		 *     （最严获胜；用户的明示意图强于我们的默认名单）；
		 *   在 danger-full-access 放行之后、read-only 拒绝（阶段 3）之后 ——
		 *     两个档位的语义都不该由本期悄悄改；
		 *   在兜底高风险询问**之前** —— 这就是它起作用的地方。
		 *
		 * 只对 powershell 生效，bash 不参与：bash 没有配危险命令检查器
		 * （见上方 SHELL 分支的 fail-closed 说明），不该在它身上放松。
		 *
		 * 两层判据（详见 safe-commands.ts）：
		 *   always    只读自省类，无条件免审批（沙箱在不在都一样安全）；
		 *   sandboxed 构建类 = 任意代码执行，**只在沙箱确实生效时**免审批。
		 *
		 * `sandboxReady` 缺省 false（**fail-closed，方向不能反**）：这与一期
		 * 「探测失败就降级执行」是**相反**的判据 —— 那时降级只是「没有改善」，
		 * 而这里放松的**依据本身**就是沙箱存在，所以不确定时必须继续询问。
		 * 判据来源见 daemon/index.ts 的 isSandboxReadyFor：它蕴含「ACL 授权已成功」，
		 * 不只是「探测通过」（否则会出现「免审批放行 → 授权失败 → 执行层降级成
		 * 无约束执行，而没人批准过」）。
		 *
		 * **名单成立的前提是「配置即代码」文件的写入需要审批**（见下方 MUTATING
		 * 分支的 isConfigAsCodePath）：否则模型可以静默改写 .git/config 或
		 * package.json，让一条「名单内的安全命令」执行任意代码。两者是一套东西。
		 */
		if (toolName === "powershell" && command !== undefined) {
			const tier = classifySafeCommand(command);
			// 名单先于文本闸：名单内都是只读命令，`git log .git/config` 这类
			// 「读到配置路径」无害，不该被文本闸拦成弹窗。
			if (tier === "always") return { kind: "allow" };
			if (tier === "sandboxed" && context?.sandboxReady === true) return { kind: "allow" };

			/*
			 * 配置文本闸（spec: 沙箱四期）：先跑后问模式下名单外命令不再逐次
			 * 弹窗，而沙箱**只约束写** —— `.git/config`、`package.json`、
			 * `.pi/extensions/**` 都在工作区内（沙箱允许写）。没有这道闸，
			 * 一句 `Set-Content .git\config ...` 就把三期的 fsmonitor 链
			 * 重新打开。命中 → 高风险弹窗（与 write/edit 的配置即代码判定
			 * 同一份名单，见 safe-commands.ts）。
			 *
			 * **防字面量不防变量拼接**（`$p = Join-Path ".git" "config"` 穿得过
			 * 文本闸）—— 与 dsh（连字面量都不看）相比是净增强；语义级解析
			 * （tree-sitter）是下一期方向。read-only 档不需要这道闸：只读沙箱
			 * 连工作区都写不进（见下方的直接放行分支）。
			 */
			if (commandTouchesConfigAsCode(command)) {
				return {
					kind: "ask",
					risk: "high",
					summary: "命令涉及会被自动执行的配置文件",
					details: command,
				};
			}

			/*
			 * 先跑后问（spec: 沙箱四期，对齐 dsh / codex 的默认方向）：
			 * 沙箱就绪时，名单外的命令**直接进沙箱跑**，不再逐次弹窗 ——
			 * 写范围由 OS 兜住（区外写被拒），被拒时模型会看到 denial 提示
			 * 并可申请一次性提权（daemon/sandbox-runner.ts）。
			 *
			 * **结构（管道/链式/子表达式/注入旗标）在这里不拦**（对齐水位）：
			 * 结构闸门只作用于上面的名单层（管「未就绪时谁免问」）。就绪后
			 * 所有形态与单段同水位 —— codex 对 `git -c core.fsmonitor=evil
			 * status` 都是直接放行（unmatched 非危险 → Allow），dsh 连判定都
			 * 没有；用户实测管道弹窗后明确「不用比他们严格，齐平就行」。
			 * 已知的同水位代价：`-c core.fsmonitor=evil` 这类注入旗标免审批
			 * 跑，任意代码可在沙箱内读密钥+外发（读/网无 OS 约束）——
			 * codex/dsh 同样如此。凭据文本模式（.ssh 等）仍由检查器在
			 * 工具层拦（那条防线先于门，不受此影响）。
			 *
			 * read-only 档在这里放行是安全的：只读沙箱无任何写能力；
			 * workspace-write 档的安全闭环（门放行 ⟹ 执行必受约束）见
			 * daemon/sandbox-runner.ts —— 装配失败按 readiness 分流，
			 * 就绪会话 fail-closed 拒绝而不是降级无约束跑。
			 *
			 * readiness 未知/false 时**不得**走到这里（弹窗兜底）—— 放松的
			 * 依据就是沙箱存在，方向不能反（三期的同一条纪律）。
			 */
			if (context?.sandboxReady === true) return { kind: "allow" };
			// 未就绪：落到下方兜底（read-only 档拒、其余询问）—— 没有 OS 约束
			// 可依时人工终审，名单层已放过它认为安全的形态。
		}

		// 走到这里 = 没有 OS 约束可依（bash 全档；readiness 未知的 powershell）。
		// read-only 档回到「拒」—— 没有只读沙箱时执行命令就是完全无约束，
		// 旧语义保持（阶段 3 注释）。
		if (mode === "read-only") {
			return {
				kind: "deny",
				reason:
					"当前权限为「只读」，且命令执行环境（只读沙箱）当前不可用，不能执行命令。" +
					"需要动手请切换权限预设。",
			};
		}

		return {
			kind: "ask",
			risk: "high",
			summary: "执行系统命令",
			details: command ?? "(命令为空)",
		};
	}

	if (MUTATING.has(toolName)) {
		if (target === undefined) {
			return { kind: "deny", reason: "工具调用缺少目标路径" };
		}

		// 完全访问模式：不再做范围约束（凭据目录已在阶段 1 拦掉）。
		if (mode === "danger-full-access") return { kind: "allow" };

		/*
		 * 「配置即代码」文件：**高风险询问，先于工作区放行判定**
		 * （spec: add-windows-acl-sandbox 三期前置）。
		 *
		 * 【2026-09-16 实测的缺口，scripts/probe-config-write-exec.ts】
		 * 工作区内的写入本来免审批（下面那行 allow），于是模型可以**静默**写下
		 * 这批文件，而它们的内容会变成被执行的代码：
		 *
		 *   .pi/extensions/*.ts  → pi 从工作目录加载项目级扩展，**以本进程权限
		 *                          执行任意代码**、且在**会话建立时加载即执行** ——
		 *                          权限门在它之后，根本拦不到（project-trust.ts
		 *                          的文件头称之为「唯一在工具层之前的攻击面」，
		 *                          而项目信任对我们自己的工作区是自动信任的）；
		 *   .git/config          → core.fsmonitor / alias 让 `git status`、
		 *                          `git diff` 执行任意命令（git 2.55 实测）；
		 *   .git/hooks/*         → **用户自己**下次提交时执行（逃出我们进程的持久化）；
		 *   package.json         → scripts 让 `npm run` / `npm test` 执行任意命令；
		 *   .github/workflows/*  → 逃到 CI runner 上执行。
		 *
		 * **判据（新增条目请照它判，不要凭感觉堆）**：这个文件的内容会变成被执行
		 * 的行为，而**没有任何命令点名它**。所以 `evil.ps1` **不在**名单里 ——
		 * `powershell ./evil.ps1` 点了它的名，那条路仍由 shell 的逐次审批把关；
		 * 而 `git status` 不点 `.git/config` 的名，用户看不出风险在哪。
		 *
		 * 为什么是 ask-high 而不是 deny：让模型给 package.json 加一条 script
		 * 是完全正常的请求，deny 会让正常工作撞墙。high 同时带来两个必要性质 ——
		 * 弹窗默认焦点在「拒绝」，且**不提供「本次会话记住」**
		 * （permission-dialog.tsx 对高风险不给该选项），否则用户一次勾选就把
		 * 整个目录变成免检。
		 *
		 * 为什么排在 danger-full-access 之后：那个档位的语义是用户明示的
		 * 「不再逐次询问」，与 appDir 判定同一位置、同一理由。
		 *
		 * **这不是完备的**：「配置即代码」是开放集合（还有 Makefile 的变体、
		 * 各种 *.config.js、编辑器与 CI 的其他约定）。这里覆盖已知的高价值项，
		 * 不声称穷尽 —— 所以它是纵深防御的一层，不是可以依赖的边界。
		 */
		if (isConfigAsCodePath(target)) {
			return {
				kind: "ask",
				risk: "high",
				summary: "修改会被自动执行的配置文件",
				details: target,
			};
		}

		/*
		 * 应用目录：写 KamiBuddy 自身永远高风险询问，**先于工作区放行判定** ——
		 * appDir 也可能就是工作目录（开发时常态），而改自己的源码/合规素材
		 * 不该享受「目录内免打扰」（2026-09-09 事故里模型要改的正是这里）。
		 * read-only 档的拒绝在阶段 3 已生效，走不到这里，不必重复。
		 */
		if (paths.appDir !== undefined && isInside(paths.appDir, target)) {
			return {
				kind: "ask",
				risk: "high",
				summary: "修改 KamiBuddy 自身目录下的文件",
				details: target,
			};
		}

		if (isInside(paths.workspaceDir, target)) return { kind: "allow" };

		return {
			kind: "ask",
			risk: "medium",
			// docx_convert 与 write 同为「产出新文件」，edit 是改已有文件。
			summary: toolName === "edit" ? "修改工作目录之外的文件" : "写入工作目录之外的文件",
			details: target,
		};
	}

	/*
	 * 改变 KamiBuddy 自身数据的工具（automation_create / automation_delete）：
	 * 显式询问档，理由见上方 APP_DATA_MUTATING 的登记注释。
	 * 放在 read-only 拒绝（阶段 3）之后：只读档下它们同样被拒，语义自洽。
	 * 无路径入参，details 没有可展示的目标，留空。
	 */
	if (APP_DATA_MUTATING.has(toolName)) {
		return {
			kind: "ask",
			risk: "medium",
			summary: toolName === "automation_create" ? "创建自动化任务" : "删除自动化任务",
			details: "",
		};
	}

	/*
	 * MCP 工具（mcp__<server>__<tool>，mcp-client.ts 注册）：默认人工审批。
	 *
	 * 显式登记为询问，而不是依赖末尾「未知工具」的 fail-safe —— 理由同
	 * APP_DATA_MUTATING：fail-safe 的默认值将来若变动，不该静默改变 MCP 的语义。
	 *
	 * 两个有意的保守选择：
	 *  - 任何模式都询问（含 danger-full-access）：能力面由外部 server 定义，
	 *    读/写/联网从名字上无从区分，与 shell 一样无法分类，保持 fail-closed。
	 *    凭据路径拦截（阶段 1）先于本分支生效 —— filesystem 这类 server 的
	 *    path 参数指的就是本机文件，`mcp__filesystem__read_file ~/.ssh/id_rsa`
	 *    在阶段 1 就已拒掉。
	 *  - read-only 档的拒绝在阶段 3 已生效，走不到这里：无法证明一个 MCP
	 *    工具不改状态，只读档下一律拒，与 fall-through 的旧位置语义一致。
	 *
	 * 摘要里把 server 与工具名拆开给用户看（从工具名解析）；
	 * 参数摘要沿用 fall-through 的 path/command 节选，在弹窗的折叠详情里展示。
	 */
	if (toolName.startsWith(MCP_TOOL_PREFIX)) {
		const parsed = parseMcpToolName(toolName);
		return {
			kind: "ask",
			risk: "medium",
			summary:
				parsed !== undefined
					? `使用 MCP 服务器「${parsed.server}」的工具「${parsed.tool}」`
					: `使用 MCP 工具「${toolName}」`,
			details: rawPath ?? command ?? "",
		};
	}

	// 未登记的工具：交给人判断（fail-safe，不静默放行也不静默阻断）。
	return {
		kind: "ask",
		risk: "medium",
		summary: `使用工具「${toolName}」`,
		details: rawPath ?? command ?? "",
	};
}

/**
 * mcp__<server>__<tool> → { server, tool }；解析失败（畸形名）返回 undefined。
 * 只服务审批文案，判定本身只靠前缀 —— 名字拼不出来不影响「要问」这件事。
 */
function parseMcpToolName(toolName: string): { readonly server: string; readonly tool: string } | undefined {
	const rest = toolName.slice(MCP_TOOL_PREFIX.length);
	const sepAt = rest.indexOf("__");
	if (sepAt <= 0 || sepAt + 2 >= rest.length) return undefined;
	return { server: rest.slice(0, sepAt), tool: rest.slice(sepAt + 2) };
}

/**
 * 「本次会话记住」的作用域键。
 *
 * 按工具 + 目标目录记，而不是只按工具名：
 * 用户批准了「写桌面的某个文件」，不该顺带批准「写 C:\Windows」。
 * 目录粒度而非文件粒度，是因为一个任务通常连续写同目录下多个文件，
 * 逐个弹窗会让人放弃使用。
 */
export function rememberKey(facts: ToolCallFacts, cwd: string): string {
	if (facts.path === undefined || facts.path === "") return facts.toolName;
	/*
	 * 与 decideUnderMode 的 target **同一口径**（含真实路径归一化）：
	 * 键若按链接路径记，用户批准过的目录换个链接名进来就又被问一遍；
	 * 反过来，两个不同链接指向同一目录时也该共用一次批准。
	 * 两处的归一化必须一起改 —— 不一致的后果是会话记忆静默失效（很难查）。
	 */
	const target = canonicalizePath(isAbsolute(facts.path) ? facts.path : resolve(cwd, facts.path));
	// 取父目录：归一化后用 sep 切掉最后一段。
	const at = target.lastIndexOf(sep);
	const dir = at <= 0 ? target : target.slice(0, at);
	return `${facts.toolName}:${dir}`;
}
