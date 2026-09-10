/**
 * 子代理执行器：以 agent 定义开一条**进程内独立会话**执行任务，回报输出与轮数。
 *
 * 与 automation-runner 的关系是**仿写而非抽取共用**，差异全在装配语义里：
 *   - 权限门是**用户在场变体** —— 子代理跑在主会话的工具调用里，主代理等待期间
 *     用户仍在场，审批正常弹给用户；automation 是无人值守（审批自动拒绝），
 *     这是两者最关键的差异，共用装配会让这个开关埋进参数堆里；
 *   - 提示词来自 agent.body（composeSubagentPrompt），不走场景×模式双轴 compose
 *     （理由见 prompt-composer.ts 该函数注释）；
 *   - 工具白名单来自 agent 定义（SessionHost 的 toolsOverride），不是交互模式；
 *   - 返回通道不同：automation 把失败折进 outcome（调度器队列的韧性边界，
 *     Promise 不 reject），子代理失败必须 throw —— task 工具层要把诊断
 *     回给主代理，让模型知道这步败了、决定换路还是如实上报。
 * 相同的是骨架：收集型 emit（子会话事件**不转发**主会话的会话事件通道——
 * 否则 UI 会冒出别人会话的工具卡）+ 超时 abort + finally dispose。
 *
 * 完成信号的来源同 automation-runner（核查过 pi 源码）：session.prompt() 在
 * agent 循环收尾后才 resolve，run_error / run_finished 那时已收进收集器。
 */

import { mkdirSync } from "node:fs";
import type { InlineExtension } from "@earendil-works/pi-coding-agent";
import type { AgentDefinition } from "../core/agents.ts";
import { getConfigDir } from "../core/config-paths.ts";
import type { ModelCatalog } from "../core/model-catalog.ts";
import { composeSubagentPrompt } from "../core/prompt-composer.ts";
import type { LoadedResources } from "../core/resources.ts";
import { SessionHost } from "../core/session-host.ts";
import { sanitizeSubagentOutput } from "../core/subagent-sanitize.ts";
import type { WebSearchConfig } from "../core/web-search.ts";
import { createDocReadTool } from "../extensions/doc-read-tool.ts";
import { createPermissionGate } from "../extensions/permission-gate.ts";
import { powershellExtensionFactory } from "../extensions/powershell-tool.ts";
import { createPresentFiles } from "../extensions/present-files.ts";
import { createProjectTrust } from "../extensions/project-trust.ts";
import { createPromptSwitch } from "../extensions/prompt-switch.ts";
import { createWebTools } from "../extensions/web-tools.ts";
import type { PermissionRequest, PermissionResponse } from "../shared/ipc.ts";
import type { PermissionSettings } from "../shared/permissions.ts";
import type { SessionEvent, ThinkingLevel } from "../shared/session-events.ts";

/**
 * 单个子代理的执行上限：超过即 abort 记超时。
 *
 * 10 分钟的理由：子代理跑在主会话的工具调用里，主代理（和用户）在等它——
 * 必须显著短于 automation run 的 30 分钟无人值守上限；而调研类任务
 * （多轮搜索 + 精读）正常在几分钟内收尾，10 分钟只兜失控循环。
 */
const SUBAGENT_TIMEOUT_MS = 10 * 60_000;

/** 回传主代理的输出上限（与 web_fetch / 文档提取的 24k 口径一致）。 */
const OUTPUT_MAX_CHARS = 24_000;

/** 同时执行的子代理上限，超出排队（FIFO）。对齐 pi subagent 示例的并发口径。 */
const MAX_CONCURRENT = 4;

export interface SubagentRunInput {
	readonly agent: AgentDefinition;
	readonly task: string;
	/** 子会话工作目录 = 主会话工作空间（产物落在用户看得见的地方）。 */
	readonly cwd: string;
	/** 主会话中断信号（pi 把 run 的 AbortSignal 传给工具 execute，经此传播）。 */
	readonly signal?: AbortSignal;
	/** 阶段性进展一句话（task 工具层接到 tool_progress 更新工具卡）。 */
	readonly onProgress?: (text: string) => void;
}

export interface SubagentRunResult {
	/** 最后一条 assistant 文本，已 24k 截断 + 去毒。 */
	readonly output: string;
	/** 子会话的 agent 轮数（assistant 消息计数，与 pi subagent 示例同口径）。 */
	readonly turns: number;
}

export interface SubagentRunner {
	readonly run: (input: SubagentRunInput) => Promise<SubagentRunResult>;
	/** 杀掉全部进行中的子代理（主会话中断时调用）；各自的诊断走 cancelled 分支。 */
	readonly abortAll: () => void;
}

export interface SubagentRunnerDeps {
	/** 懒加载的模型目录（与用户会话同一个 getCatalog）。 */
	readonly getCatalog: () => Promise<ModelCatalog>;
	/** 当前生效模型：子代理缺省继承主会话模型（v1 不做子代理独立选模型）。 */
	readonly getModelKey: () => string | undefined;
	readonly resources: LoadedResources;
	readonly getPermissions: () => PermissionSettings;
	/**
	 * 全局默认推理强度（daemon 装配处注入，现读偏好）。子代理会话每次新建，
	 * 逐会话还原不适用；不做每子代理独立档位（spec 方案 C 明确不做）。
	 */
	readonly getThinkingLevel: () => ThinkingLevel | undefined;
	readonly protectedDirs: readonly string[];
	readonly isTempCwd: (cwd: string) => boolean;
	/** 自家目录判定（生效根 / 配置目录内直接信任，见 project-trust.ts）。 */
	readonly isOwnWorkspace: (dir: string) => boolean;
	readonly getWebSearchConfig: () => WebSearchConfig | undefined;
	/** 用户在场审批通道（与主会话同一个 requestApproval）。 */
	readonly requestApproval: (
		request: Omit<PermissionRequest, "id">,
	) => Promise<PermissionResponse>;
}

export function createSubagentRunner(deps: SubagentRunnerDeps): SubagentRunner {
	/*
	 * 并发闸：名额直接转让的 FIFO。release 时不减计数而是把名额转给队首，
	 * 被唤醒者不再自增 —— 这样新来的调用无法插队（先到先得的语义才成立）。
	 */
	let running = 0;
	const queue: Array<() => void> = [];
	const acquire = async (): Promise<void> => {
		if (running < MAX_CONCURRENT) {
			running += 1;
			return;
		}
		await new Promise<void>((resolve) => queue.push(resolve));
	};
	const release = (): void => {
		const next = queue.shift();
		if (next === undefined) running -= 1;
		else next();
	};

	/** 进行中的子会话，abortAll 的作用对象。 */
	const activeHosts = new Set<SessionHost>();

	async function runOne(input: SubagentRunInput): Promise<SubagentRunResult> {
		const { agent, task, cwd } = input;
		const catalog = await deps.getCatalog();
		const modelKey = deps.getModelKey();
		// 与用户会话同一套把关：不擅自挑模型 —— 费用与服务商都该是用户的显式选择。
		if (modelKey === undefined) {
			throw new Error("还没有选择模型，请先在设置里配置 API Key 并选择模型");
		}
		if (!catalog.isUsable(modelKey)) {
			throw new Error("选中的模型当前不可用，请到设置里检查 API Key 或重新选择模型");
		}

		mkdirSync(cwd, { recursive: true });

		let host: SessionHost | undefined;
		try {
			let runError: string | undefined;
			let cancelled = false;
			let turns = 0;
			let lastText = "";
			const emit = (event: SessionEvent): void => {
				if (event.type === "run_error" && runError === undefined) runError = event.message;
				if (event.type === "run_finished" && event.outcome === "cancelled") cancelled = true;
				if (event.type === "assistant_done") {
					turns += 1;
					lastText = event.message.text;
					input.onProgress?.(`${agent.name}：已完成 ${turns} 轮`);
				}
				if (event.type === "tool_started") {
					const { toolName, summary } = event.card;
					input.onProgress?.(
						summary === ""
							? `${agent.name}：正在 ${toolName}`
							: `${agent.name}：正在 ${toolName} ${summary}`,
					);
				}
			};

			host = await SessionHost.create({
				catalog,
				modelKey,
				cwd,
				isTempTask: deps.isTempCwd(cwd),
				// 两轴只是占位：子代理不切换场景/模式，提示词由 prompt-switch 的
				// compose 回调从 agent.body 组装，不读这两个值。
				sceneId: "work",
				interactionId: "craft",
				emit,
				resources: deps.resources,
				// 初始档 = 全局默认；未配置时为 undefined，SessionHost 只把非
				// undefined 传给 pi（pi 走自己的 medium 默认链）。
				thinkingLevel: deps.getThinkingLevel(),
				toolsOverride: agent.tools,
				extensions: buildSubagentExtensions(deps, agent, cwd, () => host),
			});
			// 溯源：会话文件写 subagent_run custom 条目（agent 名），
			// 否则子会话在会话列表里混入看不出来历的「普通会话」。
			host.markSubagentRun(agent.name);
			activeHosts.add(host);

			// 中断传播：主会话 abort → pi 断工具 execute 的 signal → 杀子会话。
			// abort 后 agent 循环照常收尾（agent_end cancelled），prompt 随之 resolve。
			const onAbort = (): void => {
				void host?.abort();
			};
			if (input.signal !== undefined) {
				// 已中止的信号不会再触发事件，必须现查 —— 否则这次执行会白跑满一轮。
				if (input.signal.aborted) onAbort();
				else input.signal.addEventListener("abort", onAbort, { once: true });
			}

			let timedOut = false;
			const timeout = setTimeout(() => {
				timedOut = true;
				void host?.abort();
			}, SUBAGENT_TIMEOUT_MS);
			timeout.unref?.();
			try {
				await host.prompt(task);
			} finally {
				clearTimeout(timeout);
				input.signal?.removeEventListener("abort", onAbort);
			}

			if (timedOut) throw new Error("timeout");
			if (runError !== undefined) throw new Error(runError);
			// 中断（主会话 abort / abortAll）：没跑完就是没跑完，诊断回给主代理。
			if (cancelled) throw new Error("运行被中断");
			return { output: finalizeOutput(lastText), turns };
		} finally {
			if (host !== undefined) activeHosts.delete(host);
			host?.dispose();
		}
	}

	return {
		async run(input) {
			if (running >= MAX_CONCURRENT) {
				input.onProgress?.(`${input.agent.name}：排队等待空位（并发上限 ${MAX_CONCURRENT}）`);
			}
			await acquire();
			try {
				return await runOne(input);
			} finally {
				release();
			}
		},
		abortAll() {
			for (const host of activeHosts) void host.abort();
		},
	};
}

/** 输出收尾：先截断（24k 项目统一口径）再去毒（回灌主对话前的防注入防线）。 */
function finalizeOutput(text: string): string {
	const truncated =
		text.length > OUTPUT_MAX_CHARS
			? `${text.slice(0, OUTPUT_MAX_CHARS)}\n\n（内容过长，已截断）`
			: text;
	return sanitizeSubagentOutput(truncated);
}

/**
 * 子代理会话的扩展集：与用户会话同族（同一批工厂），差异四处——
 *   1. 权限门是用户在场变体（不传 unattended）：审批正常弹给用户，
 *      主代理等待期间用户可答（与 automation 的关键差异，见文件头）；
 *   2. 提示词由 agent.body 组装（composeSubagentPrompt），不走双轴 compose；
 *   3. 不挂 questionnaire / automation_* / task / MCP —— 双保险：
 *      agent frontmatter 的白名单本就不含这些工具名，装配层也不注册
 *      （深度锁 1 层：子代理不许再委派；没有人在子会话里答问卷；
 *      定时任务归主会话统一管理）；
 *   4. present_files 只落盘不发事件（子会话没有人在看它的交付，
 *      产物归属由最终回传给主代理的文本说明）。
 */
function buildSubagentExtensions(
	deps: SubagentRunnerDeps,
	agent: AgentDefinition,
	cwd: string,
	getHost: () => SessionHost | undefined,
): InlineExtension[] {
	return [
		createPermissionGate({
			paths: {
				workspaceDir: cwd,
				configDir: getConfigDir(),
				protectedDirs: deps.protectedDirs,
				appDir: process.cwd(),
			},
			cwd,
			getSettings: deps.getPermissions,
			requestApproval: deps.requestApproval,
		}),
		createProjectTrust({ isOwnWorkspace: deps.isOwnWorkspace }),
		createPresentFiles({
			getWorkspaceDir: () => cwd,
			onPresent: ({ files, focusFile }) => {
				getHost()?.persistArtifacts(files, focusFile);
			},
		}),
		createPromptSwitch({
			getCurrent: () => ({ sceneId: "work", interactionId: "craft" }),
			compose: (_sceneId, _interactionId, piContext) =>
				Promise.resolve(composeSubagentPrompt({ agentBody: agent.body, cwd, piContext })),
		}),
		createWebTools({ getSearchConfig: deps.getWebSearchConfig }),
		// shell 的用户在场变体：危险命令检查器 + 权限门两道防线与主会话一致
		// （worker 的 frontmatter 含 powershell，必须注册同名工具）。
		powershellExtensionFactory(),
		createDocReadTool(),
	];
}
