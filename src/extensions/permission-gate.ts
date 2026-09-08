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
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { PermissionRequest, PermissionResponse } from "../shared/ipc.ts";
import type { PermissionSettings } from "../shared/permissions.ts";
import { decide, rememberKey, type PolicyPaths, type ToolCallFacts } from "./permission-policy.ts";

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
	/** 向宿主发起审批。resolve 表示用户已作出选择。 */
	readonly requestApproval: (request: Omit<PermissionRequest, "id">) => Promise<PermissionResponse>;
}

/** 从 pi 的工具入参里取出判定需要的事实。 */
function extractFacts(toolName: string, input: Record<string, unknown>): ToolCallFacts {
	const pick = (key: string): string | undefined => {
		const value = input[key];
		return typeof value === "string" && value !== "" ? value : undefined;
	};

	return {
		toolName,
		// pi 的内置工具用 `path`；自定义工具可能用 file_path 之类的别名。
		path: pick("path") ?? pick("file_path") ?? pick("filePath"),
		command: pick("command"),
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
			const decision = decide(facts, options.paths, options.cwd, options.getSettings?.());

			if (decision.kind === "allow") return undefined;

			if (decision.kind === "deny") {
				// reason 会作为工具结果回给模型，让它知道为什么失败、别再重试同一件事。
				return { block: true, reason: decision.reason };
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

			const response = await options.requestApproval({
				toolName: facts.toolName,
				summary: decision.summary,
				details: decision.details,
				risk: decision.risk,
			});

			if (response.decision === "allow") {
				if (response.remember === true) remembered.add(key);
				return undefined;
			}

			return { block: true, reason: "用户拒绝了这次操作" };
		});
	};
}
