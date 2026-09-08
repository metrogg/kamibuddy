/**
 * 项目信任：打开陌生目录时先问一句，再决定是否加载其项目级资源。
 *
 * **为什么这是必需的**：pi 会从工作目录加载项目级资源 ——
 * `.pi/settings.json`、`.pi/extensions`、`.pi/skills`、`.pi/SYSTEM.md`、`.agents/skills`。
 * 其中**扩展是 TypeScript 模块，以 pi 进程的权限执行任意代码**
 * （pi security.md：“Extensions are TypeScript modules that run with the same permissions”）。
 *
 * 也就是说：同事发来一个文件夹、里面藏着 `.pi/extensions/evil.ts`，
 * 用户一旦把它设为工作空间，那段代码就跑起来了 —— 权限门拦不住它，
 * 因为它不是工具调用，是加载期就执行的代码。这是**唯一在工具层之前的攻击面**。
 *
 * pi 把决定权交给扩展（`project_trust` 事件，首个返回 yes/no 的扩展拥有决定权），
 * 并按目录把决定记在 `<agentDir>/trust.json`。我们要做的就是把这个问题
 * 用人话问出来，而不是让 pi 的默认值静默生效。
 *
 * 注意信任 ≠ 沙箱：pi security.md 明确写了它只是“输入加载守卫”
 * （防仓库偷改设置/注入扩展），不约束模型此后能让工具做什么 ——
 * 那部分是权限门的职责（permission-policy.ts）。
 */

import type {
	ExtensionAPI,
	ProjectTrustEventResult,
} from "@earendil-works/pi-coding-agent";

export interface ProjectTrustOptions {
	/**
	 * 该目录是否属于我们自己创建的工作空间根（`~/KamiBuddy` 及其子目录）。
	 *
	 * 这些目录由应用自己建、内容也由本机产出，没有“别人塞进来的扩展”这个来源，
	 * 直接信任、不打扰用户 —— 每次新建任务都弹一次框，用户会条件反射点同意，
	 * 那样这道防线就等于没有。判定交给调用方，本文件不认识目录布局。
	 */
	readonly isOwnWorkspace: (cwd: string) => boolean;
}

export function createProjectTrust(options: ProjectTrustOptions) {
	return (pi: ExtensionAPI): void => {
		pi.on("project_trust", async (event, ctx): Promise<ProjectTrustEventResult> => {
			if (options.isOwnWorkspace(event.cwd)) return { trusted: "yes" };

			/*
			 * 问不了就不信任。
			 *
			 * 返回 undecided 而不是 no：这把决定交回 pi 的 `defaultProjectTrust`，
			 * 其默认值 `ask` 在无 UI 时的行为是**跳过这些资源**（security.md），
			 * 即 fail-closed。用 undecided 而非硬编码 no，是为了让用户将来
			 * 真想改这个默认（比如设 always 跑自动化）时我们不挡路。
			 */
			if (!ctx.hasUI) return { trusted: "undecided" };

			const trusted = await ctx.ui.confirm(
				"信任这个文件夹？",
				[
					`这个文件夹里带有项目级配置：${event.cwd}`,
					"",
					"其中的扩展与技能会以 KamiBuddy 的权限直接运行代码。",
					"如果它不是你自己创建的（比如别人发来的文件夹），建议选择“不信任”。",
					"",
					"不信任时：这些配置会被忽略，读写文件等正常功能不受影响。",
				].join("\n"),
			);

			/*
			 * 记住“信任”，不记住“不信任”。
			 *
			 * 记住 yes：工作空间会被反复打开，每次都问 → 用户会条件反射点同意。
			 * 不记住 no：我们还没有“信任管理”界面，一旦把 no 写进 trust.json，
			 * 用户就没有地方改回来了；而不记住的代价只是下次再问一次 ——
			 * 方向上也更安全（不落盘的信任 = 不存在的信任）。
			 */
			return trusted ? { trusted: "yes", remember: true } : { trusted: "no" };
		});
	};
}
