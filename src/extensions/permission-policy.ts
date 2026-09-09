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
 *   1. 受保护凭据路径（读或写都拒）—— 任何模式都不能越过
 *   2. 只读工具：无本地路径的一律放行；有路径的在工作区内放行，
 *      区外低风险询问（danger-full-access 不受限）
 *   3. 沙箱模式的范围约束（read-only 拒一切写与命令）
 *   4. 工具种类（shell 任何档都问；写工具按 应用目录内高风险询问 →
 *      工作区内放行 → 区外询问 的顺序判；未知工具询问）
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

import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
	DEFAULT_PERMISSIONS,
	resolveAsk,
	type PermissionSettings,
	type SandboxMode,
} from "../shared/permissions.ts";

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
 * 其中 web_search / web_fetch / present_files 没有本地路径概念，维持一律放行：
 * 不写本地、不改任何状态，且数据不是密钥。不可信内容的风险由工具层
 * （web-tools.ts）的标记 + 本门对「后续写操作」的拦截共同兜住。
 * present_files 同理：stat 文件大小（限工作区）+ 发交付事件，不写盘。
 *
 * read / read_document / find / grep / ls 有本地路径概念，**出工作区要询问**
 * （LOCAL_READ，见文件头【2026-09-09 事故条目】）——「只读」不再等于「随便读」。
 * read_document 与 read 完全同语义（工作区内放行、区外低风险询问、凭据目录禁读）：
 * 它只是换了种解析方式，读的还是本地文件，边界不该因文件格式不同而不同。
 */
const READ_ONLY = new Set(["read", "read_document", "find", "grep", "ls", "web_search", "web_fetch", "present_files"]);

/** 只读工具里有本地路径概念的子集：要走路径归属判定。 */
const LOCAL_READ = new Set(["read", "read_document", "find", "grep", "ls"]);

/** 会改文件的内置工具。 */
const MUTATING = new Set(["write", "edit"]);

/** 会执行任意命令的工具。默认工具集里没有它们，但扩展或设置可能启用。 */
const SHELL = new Set(["bash", "powershell"]);

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

function isInside(base: string, target: string): boolean {
	const rel = relative(resolve(base), resolve(target));
	// 空串表示就是 base 自身；".." 开头或绝对路径都说明跑到外面去了。
	return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

/**
 * 判定一次工具调用。
 *
 * `settings` 省略时用 DEFAULT_PERMISSIONS（= workspace-write + ask），
 * **恰好等于引入沙箱模式之前的行为** —— 所以加这个参数不改变任何既有调用点。
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
): PermissionDecision {
	const decision = decideUnderMode(facts, paths, cwd, settings.sandbox);

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
): PermissionDecision {
	const { toolName, path: rawPath, command } = facts;

	// 相对路径按会话 cwd 解析，与 pi 的 resolveToCwd 行为一致。
	const target =
		rawPath === undefined || rawPath === ""
			? undefined
			: isAbsolute(rawPath)
				? resolve(rawPath)
				: resolve(cwd, rawPath);

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
	 * 无本地路径概念的（web_search / web_fetch / present_files）一律放行。
	 * 有路径概念的（read / read_document / find / grep / ls）按归属判：
	 *   工作区内（或无路径参数，如 ls 列 cwd）→ 放行；
	 *   工作区外 → 低风险询问；danger-full-access 不受限，与写侧语义一致。
	 * read-only 档同样询问 —— 读的边界就是那个模式的全部语义。
	 * 为什么区外读也要问：见文件头【2026-09-09 事故条目】。
	 */
	if (READ_ONLY.has(toolName)) {
		if (!LOCAL_READ.has(toolName)) return { kind: "allow" };
		if (target === undefined) return { kind: "allow" };
		if (isInside(paths.workspaceDir, target)) return { kind: "allow" };
		if (mode === "danger-full-access") return { kind: "allow" };
		return {
			kind: "ask",
			risk: "low",
			summary: "读取工作目录之外的文件或目录",
			details: target,
		};
	}

	// 阶段 3：只读模式下，一切改动与命令执行都拒 —— 这是模式的全部含义。
	if (mode === "read-only") {
		return {
			kind: "deny",
			reason: "当前权限为「只读」，不能修改文件或执行命令。需要动手请切换权限预设。",
		};
	}

	if (SHELL.has(toolName)) {
		/*
		 * shell 无法靠路径判断影响范围，**任何模式下都询问**，并把完整命令给用户看。
		 *
		 * 为什么 danger-full-access 也不放行：我们还没有危险命令分类器
		 * （`iex` / `-EncodedCommand` / 递归删除 …），而没有 OS 沙箱时
		 * 一条命令就能绕过上面所有路径保护（`type ~\.ssh\id_rsa`）。
		 * 在有分类器之前，这里保持 fail-closed —— 我们既然批评了 WorkBuddy
		 * broker shim 的 fail-open，自己就不能在同一处松手。
		 *
		 * 配合审批策略：approval=never 时这会变成 deny（而非放行），
		 * 所以「允许完全访问」预设的文案明确写了「系统命令仍会被拦下」。
		 */
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
			summary: toolName === "write" ? "写入工作目录之外的文件" : "修改工作目录之外的文件",
			details: target,
		};
	}

	// 未登记的工具（如将来的 MCP 工具）：交给人判断。
	return {
		kind: "ask",
		risk: "medium",
		summary: `使用工具「${toolName}」`,
		details: rawPath ?? command ?? "",
	};
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
	const target = isAbsolute(facts.path) ? resolve(facts.path) : resolve(cwd, facts.path);
	// 取父目录：resolve 后用 sep 切掉最后一段。
	const at = target.lastIndexOf(sep);
	const dir = at <= 0 ? target : target.slice(0, at);
	return `${facts.toolName}:${dir}`;
}
