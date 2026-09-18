/**
 * 托管运行时的**模型可见清单与状态文案**（spec: add-managed-runtimes 阶段 3 / 5）。
 *
 * 本文件只做两件事：定义「一个运行时在设置页与模型眼里长什么样」的数据形状，
 * 以及把清单渲染成 hidden context `python_env` 段的正文。**零运行时依赖**——
 * 磁盘事实（开关偏好、托管根解析、失败日志）由 core/runtime-inventory.ts 采集，
 * 本文件只管形状与文字。好处是可单测（不 spawn、不碰 fs），且**界面与模型读同一份
 * 文案**：不会出现「设置页写『已被用户禁用』、模型那边写『找不到』」的分叉。
 *
 * ── 为什么状态是「四态 + 禁用」而不是直接复用内核 inspect 的四态 ──
 * 内核的 inspect 要 spawn 进程（解释器版本 + 依赖冒烟），而本清单在**每次 run 开始**
 * 都要组装一次（hidden context 每 run 重注入）—— 把几百毫秒的探测放进这条热路径
 * 不可接受。于是清单的状态取自**磁盘事实 + 落盘失败日志**（同一份判据也供设置页
 * 那一行显示），深度四态探测留给按需触发的「诊断」报告。
 * 两处判据的分工与理由写在 core/runtime-inventory.ts 的文件头。
 *
 * 「被用户禁用」必须与「找不到」可区分（spec Scenario: 关闭某个运行时）：
 *   - disabled：用户显式关掉了它 ⇒ **路径不注入**，且模型被告知「已被用户禁用」；
 *   - missing：没关，但还没有可用实例 ⇒ 模型被告知「未就绪、首次使用会自动准备」。
 * 两者对模型的动作指引完全不同（一个是「请用户去开启」，一个是「等待/如实告知」），
 * 合并成一个「不可用」就等于把责任推给模型去猜。
 *
 * ── 模型体验契约（scripts/check-model-experience.ts 的三段；改行为必须同步改这里）──
 * What the model sees: 每次模型调用前，hidden context 的 `<python_env>` 段里出现
 * 「托管运行时清单」（逐项：id / 版本 / 状态 / 用途，就绪时附目录与解释器绝对路径；
 * 禁用项附「已被用户禁用，请用户去设置页开启」，未就绪项附「首次使用会自动准备」）。
 * Token effect: 每次模型调用都付这一段（常量级：条目数固定、每项正文两三行，
 * 约 120~200 tokens），它不从历史里累积 —— 上一轮的注入副本不出现在下一轮请求里。
 * KV Cache effect: 落点在**所有已落盘历史之后**（shared/hidden-context.ts 的尾部独立消息），
 * 且不改写任何既有消息；开关或路径变化只影响这一段自身，前缀不受影响。
 */

/** 模型与界面看到的状态。`disabled` 是用户显式关闭，`missing` 是「没关但还没有可用实例」。 */
export type RuntimeStatusKind = "ready" | "missing" | "failed" | "disabled";

export interface RuntimeStatus {
	readonly kind: RuntimeStatusKind;
	/**
	 * 人话补充（失败原因 / 尚无实例的落点）。界面与模型共用这一句，
	 * 不在渲染时各拼一套说法。
	 */
	readonly detail?: string;
}

/** 清单里的一项运行时的**展示事实**（不含任何可执行动作）。 */
export interface RuntimeInventoryEntry {
	/** 运行时 id（内核注册表的键，python / node / gitbash）。 */
	readonly id: string;
	/** 描述符给的显示名（如「Python（docx 引擎）」）。 */
	readonly label: string;
	/** 一句话用途（模型据此判断该用哪个；文案由 core/runtime-inventory.ts 给）。 */
	readonly purpose: string;
	/** 期望版本（描述符固化，诊断里的「版本不符」也是对照它）。 */
	readonly version: string;
	/** 用户逐项开关的**原值**：总开关关闭时仍保留，重新打开后能恢复用户的选择。 */
	readonly enabled: boolean;
	readonly status: RuntimeStatus;
	/** 生效落点。**禁用时整格缺席**（spec：禁用 ⇒ 路径不注入）。 */
	readonly activeDir?: string;
	/** 该跑哪个可执行文件。未登记取值口的运行时不给这一格 —— 不猜文件名。 */
	readonly executable?: string;
	/** 可执行文件那一行的名字（如「Python 解释器」，与片段 python-env.md 的指代对齐）。 */
	readonly executableLabel?: string;
}

/** 一次采样的完整清单：总开关 + 逐项。设置页与模型注入读的是同一个形状。 */
export interface RuntimeInventory {
	/** 总开关。false ⇒ 所有项的 status 都是 disabled。 */
	readonly master: boolean;
	readonly items: readonly RuntimeInventoryEntry[];
}

/**
 * 「诊断」按钮的内容：可复制的报告文本 + 落盘日志路径。
 * 报告由 core/runtimes/diagnostics.ts 现场采集渲染（深度四态，按需 spawn），
 * 这里只是它跨进程的形状。
 */
export interface RuntimeDiagnosticsText {
	readonly id: string;
	readonly label: string;
	readonly text: string;
	readonly logPath: string;
}

/** 状态短标签（界面那一行与模型清单共用）。 */
export const RUNTIME_STATUS_LABELS: Readonly<Record<RuntimeStatusKind, string>> = {
	ready: "就绪",
	missing: "未就绪（尚未准备）",
	failed: "准备失败",
	disabled: "已被用户禁用",
};

/**
 * 状态的动作指引（模型可执行的那一句；就绪为空串）。
 *
 * 三种非就绪状态各给**唯一一条**该走的路：禁用 → 请用户去开启；未准备 → 等待 /
 * 如实告知用户正在准备；失败 → 如实说出原因并请用户看诊断或点重置。
 * 三种都不许「自己装」—— 那条纪律的由来见片段 python-env.md（pip 在写入沙箱里必失败）。
 */
export function runtimeStatusHint(status: RuntimeStatus): string {
	switch (status.kind) {
		case "ready":
			return "";
		case "disabled":
			return "该运行时已被用户禁用：不要调用它、不要尝试安装；确实需要时如实告诉用户「这个运行时已被你在设置里关掉」，并请他到「设置 → 内置运行时」重新打开。";
		case "missing":
			return "该运行时尚未准备好：首次使用会自动准备（需联网，约 1-3 分钟）。先等待或如实告诉用户环境正在准备，不要自己安装。";
		case "failed":
			return "该运行时上次准备失败：如实告诉用户失败原因，并请他在「设置 → 内置运行时」点「诊断」看完整报告、或点「重置并重新安装」；不要自己安装。";
	}
}

/** 界面那一行的状态文本：`就绪` / `未就绪（尚未准备）` / `准备失败（…）`。 */
export function runtimeStatusText(status: RuntimeStatus): string {
	const label = RUNTIME_STATUS_LABELS[status.kind];
	return status.detail === undefined ? label : `${label}（${status.detail}）`;
}

/**
 * 渲染 `python_env` 段的正文（**模型可见文本只由这一处生成**；见门禁
 * scripts/check-module-invariants.ts 的登记）。
 *
 * 文案口径：
 *   - 抬头交代「这些是系统内置运行时、不要用系统里的同名工具、也不要自己安装」；
 *   - 每个运行时一行「id 版本 · 状态 · 用途」，就绪时补齐目录与可执行文件那一行；
 *   - 非就绪项的下一行是它**唯一**该走的路（runtimeStatusHint）。
 * 条目顺序即清单顺序（注册表顺序，稳定 ⇒ 同一台机器上逐字节可复现）。
 */
export function renderRuntimeEnvSection(inventory: RuntimeInventory): string {
	if (inventory.items.length === 0) return "";
	const lines: string[] = [
		"托管运行时（随应用内置并自动准备；不要用系统里同名的解释器 / 运行时，也不要自己安装）：",
	];
	for (const item of inventory.items) {
		lines.push(`- ${item.id} ${item.version} · ${runtimeStatusText(item.status)} · ${item.purpose}`);
		if (item.status.kind !== "disabled") {
			if (item.activeDir !== undefined) lines.push(`  目录：${item.activeDir}`);
			if (item.executable !== undefined) {
				lines.push(`  ${item.executableLabel ?? "可执行文件"}：${item.executable}`);
			}
		}
		const hint = runtimeStatusHint(item.status);
		if (hint !== "") lines.push(`  ${hint}`);
	}
	return lines.join("\n");
}
