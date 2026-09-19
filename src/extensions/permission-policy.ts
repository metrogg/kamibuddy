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
 * 【2026-09-19 同一个误伤第三次发作】上一条只修了 read 那一半：命令通道没有例外，
 * 而技能自带的 `scripts/` 只能靠 shell 跑（`${SKILL_DIR}` 展开后必然含 `.kamibuddy`，
 * 被 command-guard 的「整段目录名」规则拦下）——技能于是以另一种形态又死了。
 * 修法不是再补一处例外，而是把口径统一：配置目录里**可执行的扩展内容**
 * （skills / experts / agents / runtimes）可读，**凭据与程序配置**（auth.json、
 * mcp.json、permissions.rules.json、preferences.json、sessions/ …）仍禁读；
 * command-guard 同步从「`.kamibuddy` 整段」收窄为具体文件片段。见 §4.28。
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
	willAskUser,
	type PermissionSettings,
	type SandboxMode,
} from "../shared/permissions.ts";
import { evaluateCommand, evaluatePathRules, type PermissionRule } from "./permission-rules.ts";
import { commandTouchesConfigAsCode, isConfigAsCodePath } from "./safe-commands.ts";

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
	/**
	 * 改**应用自身数据**的工具所操作的对象，**仅供审批弹窗展示，不参与任何路径判定**：
	 * 这类工具没有「将被写的路径」（automation_* 落 configDir，技能类动的是技能目录），
	 * 但用户必须看见这次动的是哪个东西。混进 `path` 会让阶段 1/2 的路径判定误判 ——
	 * 技能类工具那个入参是「来源路径 / 技能名」，不是「目标路径」。
	 *
	 * 可选：只有需要展示对象的工具才填（permission-gate 的 extractFacts 按工具名列举），
	 * 其余（含旧调用点与探针脚本）不填也不影响任何判定。
	 */
	readonly appDataTarget?: string | undefined;
}

export interface PolicyPaths {
	/** 会话工作目录（~/KamiBuddy）。目录内的改动免打扰。 */
	readonly workspaceDir: string;
	/** 配置目录（~/.kamibuddy）。凭据与程序配置禁读禁写；可执行的扩展内容（见 CONFIG_EXECUTABLE_SUBDIRS）对只读工具放行。 */
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
 * 配置目录内**可读**的子目录：放的是「要被执行 / 按需加载的扩展内容」，不是凭据或程序配置。
 *
 *   - `skills/`   用户导入的技能（自带 `scripts/`，模型要用 shell 跑）；
 *   - `experts/`  用户级专家（私有 skills 同样要执行）；
 *   - `agents/`   用户级人格 / 子代理定义；
 *   - `runtimes/` 托管运行时本体（python / node / gitbash）—— 模型执行的就是这里面的解释器。
 *                 此前它只是靠 PATH 注入让命令文本里不出现 `.kamibuddy` 才「碰巧」能用，
 *                 一旦显式写路径就会被拦，属于同一处误伤的第三个面。
 *
 * 其余（`auth.json` / `mcp.json` / `permissions.rules.json` / `preferences.json` /
 * `sessions/` / `models*.json` / `automations.json` …）维持禁读，见阶段 1 与 §4.28。
 */
const CONFIG_EXECUTABLE_SUBDIRS = ["skills", "experts", "agents", "runtimes"] as const;

/**
 * 只读工具：不改变任何状态。两个登记来源（2026-09-16 起分层）：
 *
 * 1. **中心登记**（下方集合的字面量）：有本地路径语义的工具（read /
 *    read_document / find / grep / ls）——它们的判定逻辑带路径归属
 *    （工作区放行 / 区外询问，LOCAL_READ_TOOLS 家族），档位与路径规则
 *    互相纠缠，留在中心一处维护。
 *
 * 2. **自声明**（declareReadOnlyTools，扩展工厂在注册工具的同一处调用）：
 *    编排类、无本地路径、无副作用的扩展工具。**这是结构性的修法** ——
 *    此前新工具必须记得来这个中心文件登记，忘了就落 fail-safe 询问，
 *    「不询问」策略下直接拒绝：todo_write（2026-09-11）与 team 四件套
 *    （2026-09-16）踩的是同一个坑。把声明挪到工具定义处（WorkBuddy/
 *    CodeBuddy 的「注册即带权限元数据」同构），写工具的人在注册点顺手
 *    声明，不再有另一处要记得更新的清单。
 *
 * 自声明只开放只读档：MUTATING / SHELL / 带路径语义的档位判定逻辑复杂
 * （docx_convert 锚定产物路径、automation_* 改应用数据），错误自声明的
 * 代价是绕过询问 —— 那些必须走中心登记的显式修改，评审时看得见。
 *
 * 未登记的工具（MCP 工具、未来忘了声明的）→ fail-safe 询问，不静默放行。
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
]);

/**
 * 扩展工厂的只读自声明通道（见 READ_ONLY 注释的分层说明）。
 * 在工厂里、紧挨 registerTool 调用；幂等（Set.add），重复声明无害。
 * 声明的语义承诺：该工具不触文件系统、不改任何状态、没有路径参数 ——
 * 敏感操作若发生在工具派生的子会话里，由子会话自带的权限门逐次判定。
 */
export function declareReadOnlyTools(toolNames: readonly string[]): void {
	for (const name of toolNames) {
		READ_ONLY.add(name);
	}
}

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
 *
 * docx_extract 同档（spec Requirement: docx→HTML 版式提取）：它读 docxPath、
 * 写 outputPath（HTML）+ assetsDir（图片目录）。判定锚定 outputPath ——
 * 「照既有文档版式重排」的产物就该落工作区，写侧语义与 write / docx_convert 一致。
 * assetsDir 不单判：缺省时它就在 outputPath 旁边（同目录），显式给也只在产物目录附近；
 * 要锚两个路径会把判定链复杂化，收益却只是同一目录再问一次。
 */
const MUTATING = new Set(["write", "edit", "docx_convert", "docx_extract"]);

/** 会执行任意命令的工具。powershell 在 craft 白名单里；bash 默认工具集没有，但扩展或设置可能启用。 */
const SHELL = new Set(["bash", "powershell"]);

/** MCP 工具的命名前缀（mcp__<server>__<tool>，mcp-client.ts 的 sanitizeToolName 拼出）。 */
const MCP_TOOL_PREFIX = "mcp__";

/**
 * 改变 KamiBuddy 自身数据的工具（automation_*、skill_install / skill_uninstall）。
 *
 * - automation_*：经 AutomationStore 落 ~/.kamibuddy/automations.json，不经工具路径参数。
 * - skill_install / skill_uninstall：技能的安装与删除（对话里的「模型创建技能」链路，
 *   对齐 WorkBuddy 的 skill-creator + skill_manage）。它们改的是**提示词面**，
 *   所以同样显式登记为询问而不是依赖末尾的 fail-safe —— 静默装进去/删掉等于让一条指令越过用户。
 *   删的那条同样要问：它拿掉的是用户已经看得见的能力（与 automation_delete 对称）。
 *
 * 显式登记为询问，而不是依赖末尾「未知工具」的 fail-safe：两者今天的结果
 * 相同（medium 询问），但 fail-safe 的默认值将来若变动，不该静默改变
 * 这类工具的语义。定为询问而非放行：创建/删除定时任务改变应用自身数据，
 * 且任务会在后台无人值守地跑，默认从紧；用户可用审批弹窗的「记住」免除。
 *
 * 落盘文件在 configDir 内、阶段 1 本就禁写——那是 AutomationStore / skill-install
 * 的内部实现路径，不经过工具入参（skill_install 的入参是**工作区**里的来源路径），
 * 所以这里不需要、也不许为阶段 1 开口子：模型的 write/edit 依旧写不进技能目录，
 * 安装只能走这条受校验的通道。
 */
const APP_DATA_MUTATING = new Map<string, string>([
	["automation_create", "创建自动化任务"],
	["automation_delete", "删除自动化任务"],
	["skill_install", "安装技能（会改变模型可见的技能清单）"],
	["skill_uninstall", "删除技能（会改变模型可见的技能清单）"],
]);

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
): PermissionDecision {
	const decision = decideUnderMode(facts, paths, cwd, settings.sandbox, rules);

	// 审批策略只作用在「要问」的结果上 —— allow / deny 都已是终局。
	// 判据走 shared/permissions 的 willAskUser（生效策略的唯一判据：设置旋钮 ×
	// 无人值守合成在一处，这里只问「还问人吗」）。
	if (decision.kind !== "ask") return decision;
	if (willAskUser(settings)) return decision;

	/*
	 * never = **确定性拒绝**，不是静默放行（照 dsh 的语义）。
	 * 无人值守时「不问」必须等于「不做」，否则这个开关就成了完全敞开的后门。
	 *
	 * 文案必须带「接下来怎么办」（与 permission-gate 的 APPROVAL_REFUSAL 同一条规则，
	 * 见那里的注释）：只说「会被直接拒绝」会让模型换一个工具再试一次，而这一档下
	 * 每一次尝试都是必然失败的白跑。第二句明确否定这条路，第三句给两条真实出路。
	 */
	return {
		kind: "deny",
		reason:
			`当前审批策略为「不询问」，需要批准的操作会被直接拒绝（${decision.summary}）。` +
			"不要原样重试，也不要换个工具绕开 —— 这一档下「不问」等于「不做」，重试只会再被拒一次。" +
			"请改用不需要审批的做法；实在绕不开的，把这一步的意图与影响告诉用户，由用户调整权限设置后再继续。",
	};
}

/** 沙箱模式下的判定（不含审批策略）。拆开是为了让两个旋钮各自可测。 */
function decideUnderMode(
	facts: ToolCallFacts,
	paths: PolicyPaths,
	cwd: string,
	mode: SandboxMode,
	rules?: readonly PermissionRule[],
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
			 * 可执行的扩展内容对只读工具放行（2026-09-19 第三次收窄，见 §4.28）。
			 *
			 * 配置目录里混着两类东西：**凭据 / 程序配置**（auth.json、mcp.json、settings…）
			 * 与**要被执行的内容**（用户导入的技能、用户级专家与人格、托管运行时本体）。
			 * 早先一刀切「整目录禁读」把后者也切了 —— 技能装得进来、正文读得到，
			 * 自带的 `scripts/` 却永远跑不起来。
			 *
			 * WorkBuddy 的做法同构：它的保护清单点的是**具体路径**
			 * （fs-protection.js 的 getProtectedPathKeys），且注释点名 `skills/` 属合法路径。
			 * 我们此前只给 `skills/` 开过一处例外（2026-09-08），那是同一个误伤的第二次补丁；
			 * 这次把口径统一成「扩展内容可读、凭据与配置项仍禁读」。
			 *
			 * 只放开**读**：写仍拒 —— 技能正文即提示词，write/edit 篡改即提示注入；
			 * 安装与删除只走技能页 IPC 与 skill_install / skill_uninstall 两条受校验通道
			 * （它们不经这里的写判定，所以不必为写开口子）。
			 * 同名前缀的兄弟目录（skills-evil 之类）不受影响：isInside 按路径分量判。
			 */
			if (
				READ_ONLY.has(toolName) &&
				CONFIG_EXECUTABLE_SUBDIRS.some((name) => isInside(join(paths.configDir, name), target))
			) {
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
		 * powershell：**门不再审命令**（2026-09-16 对齐 dsh 的最终形态）。
		 *
		 * dsh 的结构：shell 命令没有事前审批，wrap 进沙箱直接跑，confine
		 * 失败抛 SANDBOX_UNAVAILABLE 拒绝——「能不能跑」由**执行层的沙箱**
		 * 决定，不由门预判。我们对齐：powershell 的命令一律放行到执行层，
		 * 执行层（daemon/sandbox-runner.ts）现场 confine，任何失败一律
		 * fail-closed 拒绝、绝不无约束重跑。readiness（预热结果）不再是
		 * 门侧判据——它是性能优化（提前传播 ACE）与设置页诊断，仅此而已。
		 *
		 * 唯一的例外是配置文本闸（与 WorkBuddy 的受保护文件层同级）：
		 * 沙箱只约束写，而 `.git/config`、`package.json`、`.pi/extensions/**`
		 * 都在工作区内（沙箱允许写），没有这道闸，一句
		 * `Set-Content .git\config ...` 就能重新打开 fsmonitor 链。
		 *
		 * bash 仍维持高风险询问：没有配危险命令检查器（见上方说明），
		 * 且我们无法给 bash 包沙箱执行器（runner 只跑 powershell.exe），
		 * 没有约束可依，保持 fail-closed。
		 */
		if (toolName === "powershell" && command !== undefined) {
			if (commandTouchesConfigAsCode(command)) {
				return {
					kind: "ask",
					risk: "high",
					summary: "命令涉及会被自动执行的配置文件",
					details: command,
				};
			}
			return { kind: "allow" };
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
		 * 【2026-09-18 名单已收窄】工作区内的**技能根**（`<任意层级>/.pi/skills/**`、
		 * `<任意层级>/.agents/skills/**`）不算配置即代码，不再进这条分支 ——
		 * 技能正文不执行，与工作区的 `AGENTS.md` 同等处置（理由与残留风险见
		 * safe-commands.ts 文件头）。`.pi` 的其余高危判定（`extensions/**`、
		 * `settings.json`、`SYSTEM.md`）保持不变。
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
			// docx_convert / docx_extract 与 write 同为「产出新文件」，edit 是改已有文件。
			summary: toolName === "edit" ? "修改工作目录之外的文件" : "写入工作目录之外的文件",
			details: target,
		};
	}

	/*
	 * 改变 KamiBuddy 自身数据的工具（automation_* / skill_install / skill_uninstall）：
	 * 显式询问档，理由见上方 APP_DATA_MUTATING 的登记注释。
	 * 放在 read-only 拒绝（阶段 3）之后：只读档下它们同样被拒，语义自洽。
	 *
	 * details 给「这次动的是哪个东西」：技能类工具有一个可展示的对象（来源路径 /
	 * 技能名，由 permission-gate 的 extractFacts 取进 appDataTarget），
	 * automation_* 没有 —— 它们照旧留空。**这句话是知情同意的下限**：
	 * 只写「安装技能（会改变模型可见的技能清单）」，用户点允许时并不知道装的是谁，
	 * 而装进去的正文下一轮就会作为提示词被模型读到（对齐 codex 审批事件带 reason /
	 * 可选决策、WorkBuddy 的 Edit 审批给 diff、dsh 要求 justification）。
	 */
	const appDataSummary = APP_DATA_MUTATING.get(toolName);
	if (appDataSummary !== undefined) {
		return {
			kind: "ask",
			risk: "medium",
			summary: appDataSummary,
			details: facts.appDataTarget ?? "",
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
