/**
 * 技能作用域判定：一个技能的 SKILL.md **落在哪一层**（内置 / 本项目 / 用户级）。
 *
 * 为什么单独成模块：判定原先内联在 daemon 的 `listSkills` 里（一段路径前缀比较），
 * 既没法单测，也容易在「按目录名猜」上出错。作用域是**按落点**判的展示用分类
 * （对齐 codex / dsh 的项目级 vs 用户级两层），不该跟 daemon 的装配细节绑在一起。
 *
 * ## 为什么不做真实路径归一化
 *
 * `core/path-containment.ts` 那套（realpath + junction 解析）是给**权限门**用的：
 * 判错会放行越权写入。这里的产物只是技能卡片上的一行文案（「内置」「本项目」「用户级」），
 * 判错最坏的后果是标签不准，不是安全边界失守。为它去 stat / realpath 既没必要，
 * 也会把「目标还不存在时怎么办」那类坑引进来。所以本模块只做词法层面的三件事：
 *
 *   1. **路径分隔符归一** —— Windows 的 `\` 与 `/` 混写都要能比（pi 返回的
 *      filePath 来自 `node:path`，在同一进程里分隔符一致，但调用方与我们自己的
 *      路径推导层可能给出另一种写法）；
 *   2. **Windows 大小写不敏感** —— 两侧都 `toLowerCase()` 后比较（NTFS 大小写不敏感，
 *      `d:\WS\.pi\...` 与 `D:\ws\.pi\...` 是同一个文件）；
 *   3. **路径分量边界** —— `D:\ws` 不许匹配 `D:\ws2\x`，「是不是在工作区内」是
 *      **目录分量**级别的关系，不是字符串前缀关系。**禁止裸 startsWith**。
 *
 * 大小写归一是**无条件**做的（不按 `process.platform` 分叉）：这样同一份判定在任何
 * 平台上结果一致、可预期；在大小写敏感的文件系统上，仅大小写不同的兄弟目录会被并到
 * 一层，那是展示层的可用性损失，不是正确性错误。
 *
 * ## 为什么 `~/.agents/skills`、`~/.pi/agent/skills` 这类位置兜底归 `user`
 *
 * 它们既不在随包目录（`opts.builtinDirs`）内，也不在**当前会话工作区**内。
 * 兜底成「用户级」而不是新造一个「全局」态：宁可归错到"用户级"，也不要因为
 * 路径在区外就误标成"本项目" —— 后者会让用户以为技能随项目走，退而求其次的
 * 归类至少方向不反。pi 自己的加载器也把这两处叫 global / user（docs/skills.md）。
 *
 * ## 与 `core/config-paths.ts` 的关系
 *
 * 内置目录的真源是 `getBuiltinSkillDirs()`（`resources/skills` + `resources/plugins`），
 * 但**由调用方传进来**而不是本模块自己去读：本模块要保持纯函数、不读环境变量、
 * 不依赖文件系统，才能脱离 Electron / pi 单独跑单测（AGENTS.md §1）。
 * daemon 传的就是那份真源（记着注释里的教训：技能有两个消费面，路径不许各写一遍）。
 */

/** 技能落在哪一层。用户可见语义只有「内置 / 本项目 / 用户级」三种，不含"谁装的"。 */
export type SkillScope = "builtin" | "project" | "user";

export interface SkillScopeOptions {
	/** 随包技能根（`getBuiltinSkillDirs()` 的两个目录）；顺序即优先级，命中即返回。 */
	readonly builtinDirs: readonly string[];
	/** 当前会话工作区根；`undefined` = 没有工作区（如 playground），此时不存在 project 分支。 */
	readonly workspaceDir: string | undefined;
}

/** 归一化：统一分隔符 + 去掉尾分隔符 + 转小写（理由见文件头）。 */
function normalize(path: string): string {
	return path.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase();
}

/**
 * `target` 是否在 `root` 之内（含 `root` 自身）—— 按**路径分量边界**判，不是裸前缀。
 * 两侧都先归一化。`root` 归一化后为空（如空串）时一律 false：没有「根」这种事。
 */
function isInside(root: string, target: string): boolean {
	const rootNorm = normalize(root);
	if (rootNorm === "") return false;
	const targetNorm = normalize(target);
	return targetNorm === rootNorm || targetNorm.startsWith(`${rootNorm}/`);
}

/**
 * 判定技能落点属于哪一层（顺序：内置 → 本项目 → 用户级）。
 *
 * 顺序本身就是一条规则：内置目录若恰好落在工作区内（例如 dev 下把工作区设成仓库根），
 * 它仍然是**内置**，不会被项目级抢走 —— 先判随包，保证了随包技能不会因为用户
 * 挑了个「正好包住它」的工作区就换标签。
 */
export function skillScopeOf(filePath: string, opts: SkillScopeOptions): SkillScope {
	for (const dir of opts.builtinDirs) {
		if (isInside(dir, filePath)) return "builtin";
	}
	if (opts.workspaceDir !== undefined && isInside(opts.workspaceDir, filePath)) return "project";
	return "user";
}
