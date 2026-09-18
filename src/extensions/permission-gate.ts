/**
 * 权限门：pi 扩展，在工具执行前拦一道。
 *
 * pi 没有内置权限系统（README 自述），它给的是 `tool_call` 事件
 * ——「Fired before a tool executes. Can block.」返回 `{ block, reason }` 即可拦下。
 * 判定逻辑全在 permission-policy.ts（纯函数、可单测），本文件只做三件事：
 * 从 pi 的事件里取出事实、调用策略、把 ask 转成一次宿主询问。
 *
 * 不在这里碰 IPC：询问经构造时传入的 requestApproval 回调发出，
 * 于是本文件既不认识 parentPort 也不认识 Electron，可以脱离宿主测试。
 *
 * 审批往返的消费是 **fail-closed** 的（spec: adopt-dsh-disciplines Task 2.3）：
 * 结果先经 shared/permissions 的 normalizeApprovalOutcome 收敛成闭集，只有
 * allowed-once 放行 —— 应答缺失 / 抛错 / 不合规都归 unavailable 并拒绝。
 * 判定时也不自己写 `unattended === true`：生效策略的唯一判据是 willAskUser。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { PermissionRequest, PermissionResponse } from "../shared/ipc.ts";
import {
	DEFAULT_PERMISSIONS,
	isGranted,
	normalizeApprovalOutcome,
	willAskUser,
	type ApprovalOutcome,
	type PermissionSettings,
} from "../shared/permissions.ts";
import { decide, rememberKey, type PolicyPaths, type ToolCallFacts } from "./permission-policy.ts";
import type { PermissionRule } from "./permission-rules.ts";

/**
 * 审批结果 → 拒绝文案（面向模型的工具结果）。
 *
 * 穷尽的 Record：闭集加档时编译器在这里点名，不会漏一个默认分支 ——
 * 「漏判 = 放行」是这套词汇表要防的失败方式，所以这里连默认值都不给。
 * 每档都要给一句「接下来怎么办」：只说「被拒了」会诱导模型原样重试。
 */
const APPROVAL_REFUSAL: Readonly<Record<Exclude<ApprovalOutcome, "allowed-once">, string>> = {
	/*
	 * rejected / cancelled 原本只有前半句（「用户拒绝了这次操作。」），**不符合本
	 * Record 上面那条「每档都要给一句接下来怎么办」的规则** —— 模型拿到一句光秃秃的
	 * 拒绝，最自然的反应就是原样重试或换一个工具再试一次，而两条路都只会再撞一次。
	 * 补齐的三段照 WorkBuddy 的 PERMISSION_DENIED_GUIDANCE 与 codex 的
	 * on_request.md 同款结构：**别原样重试** → **要么换个更安全的做法** → **要么停下来
	 * 交给用户决定**。docs/试用前自查报告.md 的验收项「拒绝后模型收到原因且不重试
	 * 同一路径」此前正是靠这两句过的。
	 */
	rejected:
		"用户拒绝了这次操作。不要原样重试，也不要换一个工具去绕开同一个拒绝 —— " +
		"换工具只是把同一个请求换个说法再问一次，用户的意思不会因此改变。" +
		"要么改用确实更安全的替代做法，要么停下来把「你想做什么、为什么需要它」讲清楚，交给用户决定。",
	cancelled:
		"这次审批已被撤回，没有获得批准。不要原样重试；" +
		"把这一步的意图与影响告诉用户，等用户明确要求之后再继续。",
	unavailable:
		"审批不可用（没有人应答、应答不符合契约、或审批通道异常），按 fail-closed 拒绝执行。" +
		"请改用工作目录内的路径完成；实在绕不开的，在最终结果中如实说明这一步未能执行及原因。",
};

/**
 * 无人值守（定时任务 run 会话）的拒绝文案。
 *
 * 与上面的 unavailable 分开：那一档的原因在审批通道，这一档的原因是**根本没有
 * 人可问** —— 行动指引也不同（让模型知道这是无人值守的运行，不是审批坏了）。
 */
const UNATTENDED_REFUSAL =
	"当前是定时任务的无人值守运行，没有人在场审批，此类操作不可用。" +
	"请改用任务工作目录内的路径完成；实在绕不开的，在最终结果中如实说明这一步未能执行及原因。";

export interface PermissionGateOptions {
	readonly paths: PolicyPaths;
	/** 会话工作目录，用于把相对路径解析成绝对路径。 */
	readonly cwd: string;
	/**
	 * 取当前权限设置（沙箱模式 + 审批策略）。
	 *
	 * 用 getter 而不是构造时的快照：用户在设置页改了预设，**下一次工具调用就该生效**，
	 * 不该等到重开会话。同 prompt-switch 用 getCurrent() 读两轴的做法。
	 * 省略时用 DEFAULT_PERMISSIONS（= 引入模式之前的行为）。
	 */
	readonly getSettings?: () => PermissionSettings;
	/**
	 * 取当前持久前缀规则集（spec: add-permission-rules-engine）。
	 *
	 * 与 getSettings 同范式（getter 而非快照）：批准写回（Task 3）追加规则后，
	 * **下一次工具调用就该免问** —— 已建好的会话宿主不该拿旧规则集判。
	 * 省略 = 无规则，powershell 维持逐次高风险询问（引入规则前的行为）。
	 */
	readonly getRules?: () => readonly PermissionRule[];
	readonly requestApproval: (
		request: Omit<PermissionRequest, "id" | "sessionId">,
	) => Promise<PermissionResponse>;
	/**
	 * 无人值守模式（定时任务 run 会话）：审批类请求一律自动拒绝，
	 * 拒绝原因作为工具结果回给模型 —— 没有人在场点按钮，挂起等审批
	 * 等于把 run 卡死到超时。deny（凭据目录等硬规则）不受影响，
	 * 那条判定链在 policy 里、先于本开关生效。
	 *
	 * 它不是一个独立的开关，而是**生效审批策略的一个来源**：与设置里的旋钮
	 * 一起交给 willAskUser 合成（定时任务会话的装配见 daemon/automation-runner）。
	 */
	readonly unattended?: boolean;
}

/** 从 pi 的工具入参里取出判定需要的事实。 */
function extractFacts(toolName: string, input: Record<string, unknown>): ToolCallFacts {
	const pick = (key: string): string | undefined => {
		const value = input[key];
		return typeof value === "string" && value !== "" ? value : undefined;
	};

	/*
	 * 改应用数据类工具的**展示对象**（只进弹窗详情，不进任何路径判定）：
	 * skill_install 的入参是工作区里的来源路径、skill_uninstall 的是技能名 ——
	 * 它们不是「将被写的目标路径」，所以不能混进下面的 path（那会让阶段 1 的
	 * configDir 判定与阶段 2 的路径规则拿错对象：从已装技能目录再装一次时，
	 * 来源路径本来就在 configDir 里）。
	 *
	 * 按工具名白名单式列举，不做「有 sourcePath/name 就取」的通用兜底：
	 * team_create 之类的工具也有 name，取来展示只会让弹窗多一行噪声。
	 * automation_* 没有可展示对象，保持 undefined（details 留空）。
	 */
	const appDataTarget = toolName === "skill_install" ? pick("sourcePath") : toolName === "skill_uninstall" ? pick("name") : undefined;

	return {
		toolName,
		// pi 的内置工具用 `path`；自定义工具可能用 file_path 之类的别名。
		// docx_convert / docx_extract 的产物路径参数叫 outputPath —— 写侧判定锚定产物
		// （policy 的 MUTATING 注释）；两者共用这一条，不必按工具名分支。
		path: pick("path") ?? pick("file_path") ?? pick("filePath") ?? pick("outputPath"),
		command: pick("command"),
		appDataTarget,
	};
}

/**
 * 创建权限门扩展。
 *
 * 返回 pi 的 ExtensionFactory，交给 DefaultResourceLoader 的 extensionFactories。
 */
export function createPermissionGate(options: PermissionGateOptions) {
	/**
	 * 本次会话已批准的作用域（工具 + 目标目录）。
	 *
	 * 只在内存里、随会话结束消失，**不落盘**：
	 * 持久化的批准会让用户在几周后早已忘记自己批过什么，
	 * 却仍在生效 —— 那是比多点几次弹窗更糟的问题。
	 */
	const remembered = new Set<string>();

	return (pi: ExtensionAPI): void => {
		pi.on("tool_call", async (event) => {
			const facts = extractFacts(event.toolName, event.input);
			// 设置读一次、整条判定共用一份：getSettings 是 getter（用户改档下一次
			// 调用即生效），一次工具调用内读两遍理论上会读到两个档位。
			const settings = options.getSettings?.() ?? DEFAULT_PERMISSIONS;
			const decision = decide(facts, options.paths, options.cwd, settings, options.getRules?.());

			if (decision.kind === "allow") return undefined;

			if (decision.kind === "deny") {
				// reason 会作为工具结果回给模型，让它知道为什么失败、别再重试同一件事。
				return { block: true, reason: decision.reason };
			}

			/*
			 * 生效的审批策略为「不问人」时不弹窗 —— 判据走 shared/permissions 的
			 * willAskUser（设置旋钮 × 无人值守合成在一处，见它的注释），这里不
			 * 自己写 `unattended === true`：策略的判据散开就是「一处拒、一处放」的缝。
			 *
			 * 设置那一档（never）在 decide() 里已转成 deny，走到这里的是无人值守；
			 * 文案仍分开（那一档是「没有人可问」，不是「审批坏了」）。
			 */
			if (!willAskUser(settings, options.unattended === true)) {
				return { block: true, reason: UNATTENDED_REFUSAL };
			}

			/*
			 * 「本次会话记住」在 deny 之后才查 —— 顺序是有意的：
			 * 用户切到更严的预设（如只读）时，先前记住的批准必须失效，
			 * 否则「切成只读」会变成一句空话。
			 *
			 * 同理，审批策略切成 never 时 decide() 已把 ask 转成 deny，
			 * 先前记住的批准同样不再生效。这一点略反直觉（用户确实批准过），
			 * 但方向是 fail-closed：「不要再问我」在无人值守语境下等于「不要再做」。
			 */
			const key = rememberKey(facts, options.cwd);
			if (remembered.has(key)) return undefined;

			/*
			 * 审批往返 —— **调用方 fail-closed**（dsh 的 caller 纪律）：
			 * 只有 allowed-once 放行。应答者缺失（拿到 undefined）、应答不合契约
			 * （未知 decision）、通道抛错（下面 catch 住）三条口子统一降级为
			 * unavailable，与 rejected / cancelled 一起走同一条拒绝路径。
			 * 规范化只有一处（normalizeApprovalOutcome），所以这里不逐个判取值。
			 */
			let response: PermissionResponse | undefined;
			let outcome: ApprovalOutcome = "unavailable";
			let channelError: string | undefined;
			try {
				/*
				 * 请求不带 writeBackPath：该通道随区外读询问的撤除而停用
				 * （2026-09-16 对齐水位），它只挂在「read 家族区外读的 ask low」上，
				 * 而那个判定已改为放行。IPC 字段与 renderer 的展示逻辑保留
				 * （收不到字段 = 永不显示），待 renderer 死代码一并清理。
				 */
				response = await options.requestApproval({
					toolName: facts.toolName,
					summary: decision.summary,
					details: decision.details,
					risk: decision.risk,
				});
				outcome = normalizeApprovalOutcome(response);
			} catch (error) {
				// 通道自己坏了 = 没有拿到同意。异常原文进工具结果：坏了要看得见，
				// 不能只在日志里留一句（这里没有日志通道，模型是唯一的读者）。
				channelError = error instanceof Error ? error.message : String(error);
			}

			if (!isGranted(outcome)) {
				const reason = APPROVAL_REFUSAL[outcome];
				return {
					block: true,
					reason: channelError === undefined ? reason : `${reason}（审批通道异常：${channelError}）`,
				};
			}

			/*
			 * 双保险：UI 已不对高风险提供「本次会话记住」选项（permission-dialog.tsx），
			 * 但响应来自 IPC，不信任对端 —— 被篡改/写错的渲染进程发一个
			 * remember:true 不该就把 shell 或写应用目录变成会话内免检。
			 */
			if (response !== undefined && response.remember === true && decision.risk !== "high") {
				remembered.add(key);
			}
			return undefined;
		});
	};
}
