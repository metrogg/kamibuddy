/**
 * 定时任务 run 执行器：以任务 cwd 开一条**独立新会话**执行 prompt，回报成败。
 *
 * 与用户会话的差异全在装配里：
 *   - emit 是收集型的 —— run 事件**不转发** renderer 的会话事件通道，
 *     后台 run 不能把用户正在看的会话视图冲乱；
 *   - 权限门是 unattended 变体 —— 审批类操作自动拒绝并把原因回给模型
 *     （凭据目录等硬 deny 不变，见 permission-gate.ts）；
 *   - 两轴固定 work + craft（spec），提示词组装与用户会话同一套 compose；
 *   - 不注册 automation 工具 —— run 里再建/改任务属于「AI 自主调下轮」，
 *     明确不进 v1（craft 白名单里的未注册工具名 pi 会静默忽略，不会炸）；
 *     task（子代理委派）同样不注册 —— 无人值守下的递归委派明确不做，
 *     白名单未注册名静默忽略的机制同样兜住它。
 *
 * 返回的 Promise 不 reject：装配失败 / 模型错误 / 超时都折进
 * AutomationRunOutcome —— 这是调度器队列的韧性边界（一个任务失败不能
 * 杀掉队列），每种失败都有明确的记录语义，不是防御性兜底。
 *
 * 完成信号的来源（核查过 pi 源码）：pi 的 session.prompt() 在 agent 循环
 * 收尾后才 resolve，agent_end 由循环同步分发（agent-session.js
 * _runAgentPrompt → _emitAgentSettled）—— await prompt 返回时
 * run_error / run_finished 都已收进收集器，无需另等事件。
 */

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { InlineExtension } from "@earendil-works/pi-coding-agent";
import { getConfigDir, getResourcesDir } from "../core/config-paths.ts";
import type { ModelCatalog } from "../core/model-catalog.ts";
import type { PromptContextOptions } from "../core/prompt-composer.ts";
import type { LoadedResources } from "../core/resources.ts";
import { SessionHost } from "../core/session-host.ts";
import type { WebSearchConfig } from "../core/web-search.ts";
import { createDocReadTool } from "../extensions/doc-read-tool.ts";
import { createDocxConvertTool } from "../extensions/docx-convert-tool.ts";
import { createPermissionGate } from "../extensions/permission-gate.ts";
import { createPresentFiles } from "../extensions/present-files.ts";
import { createProjectTrust } from "../extensions/project-trust.ts";
import { createPromptSwitch } from "../extensions/prompt-switch.ts";
import { questionnaireExtensionFactory } from "../extensions/questionnaire-tool.ts";
import { powershellExtensionFactory } from "../extensions/powershell-tool.ts";
import { todoExtensionFactory } from "../extensions/todo-tool.ts";
import { visualizerExtensionFactory } from "../extensions/visualizer-tools.ts";
import { createWebTools } from "../extensions/web-tools.ts";
import type { AutomationTask } from "../shared/automation.ts";
import type { PermissionSettings } from "../shared/permissions.ts";
import type { SessionEvent, ThinkingLevel } from "../shared/session-events.ts";
import type { AutomationRunExecutor, AutomationRunOutcome } from "./automation-scheduler.ts";

/** run 超时上限：超过即 abort 记失败（spec：30 分钟）。 */
const RUN_TIMEOUT_MS = 30 * 60_000;

export interface AutomationRunExecutorDeps {
	/** 懒加载的模型目录（与用户会话同一个 getCatalog）。 */
	readonly getCatalog: () => Promise<ModelCatalog>;
	/** 当前生效模型（v1 跟随用户选择，任务级模型配置明确不做）。 */
	readonly getModelKey: () => string | undefined;
	readonly resources: LoadedResources;
	/** 系统提示词组装（daemon 的 composeSystemPrompt：两轴 + 技能段 + pi 上下文）。 */
	readonly compose: (
		cwd: string,
		sceneId: string,
		interactionId: string,
		piContext: PromptContextOptions,
	) => Promise<string>;
	readonly getPermissions: () => PermissionSettings;
	/**
	 * 全局默认推理强度（daemon 装配处注入，现读偏好）。run 会话每次新建，
	 * 逐会话还原不适用；无人值守会话没有会话内切换入口，全局默认即口径。
	 */
	readonly getThinkingLevel: () => ThinkingLevel | undefined;
	readonly protectedDirs: readonly string[];
	readonly isTempCwd: (cwd: string) => boolean;
	/** 自家目录判定（生效根 / 配置目录内直接信任，见 project-trust.ts）。 */
	readonly isOwnWorkspace: (dir: string) => boolean;
	readonly getWebSearchConfig: () => WebSearchConfig | undefined;
}

export function createAutomationRunExecutor(
	deps: AutomationRunExecutorDeps,
): AutomationRunExecutor {
	return async (task: AutomationTask): Promise<AutomationRunOutcome> => {
		let host: SessionHost | undefined;
		// 装配失败时没有会话可言，保持空串（IPC 契约：空串 = 无会话可跳）。
		let sessionId = "";
		try {
			const catalog = await deps.getCatalog();
			const modelKey = deps.getModelKey();
			// 与用户会话同一套把关：不擅自挑模型 —— 费用与服务商都该是用户的显式选择。
			if (modelKey === undefined) {
				throw new Error("还没有选择模型，请先在设置里配置 API Key 并选择模型");
			}
			if (!catalog.isUsable(modelKey)) {
				throw new Error("选中的模型当前不可用，请到设置里检查 API Key 或重新选择模型");
			}

			const cwd = task.cwd;
			mkdirSync(cwd, { recursive: true });

			let runError: string | undefined;
			let cancelled = false;
			const emit = (event: SessionEvent): void => {
				if (event.type === "run_error" && runError === undefined) runError = event.message;
				if (event.type === "run_finished" && event.outcome === "cancelled") cancelled = true;
			};

			host = await SessionHost.create({
				catalog,
				modelKey,
				cwd,
				isTempTask: deps.isTempCwd(cwd),
				sceneId: "work",
				interactionId: "craft",
				emit,
				resources: deps.resources,
				// 初始档 = 全局默认；未配置时为 undefined，SessionHost 只把非
				// undefined 传给 pi（pi 走自己的 medium 默认链）。
				thinkingLevel: deps.getThinkingLevel(),
				extensions: buildRunExtensions(deps, cwd, () => host),
			});
			// 溯源：会话文件写 automation_run custom 条目（taskId），
			// 会话列表/导出链路天然可追（spec 要求）。
			host.markAutomationRun(task.id);
			sessionId = host.state.sessionId;

			let timedOut = false;
			const timeout = setTimeout(() => {
				timedOut = true;
				// abort 后 agent 循环照常收尾（agent_end cancelled），prompt 随之 resolve。
				void host?.abort();
			}, RUN_TIMEOUT_MS);
			timeout.unref?.();
			try {
				await host.prompt(task.prompt);
			} finally {
				clearTimeout(timeout);
			}

			if (timedOut) return { sessionId, success: false, error: "timeout" };
			if (runError !== undefined) return { sessionId, success: false, error: runError };
			// 非超时的中断现实中不该出现（run 会话没有用户停止键）；
			// 真被取消也不能记成功 —— run 没跑完就是没跑完。
			if (cancelled) return { sessionId, success: false, error: "运行被中断" };
			return { sessionId, success: true };
		} catch (error) {
			// 装配失败 / prompt 预检失败（模型或凭据在运行间隙失效）。
			return {
				sessionId,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		} finally {
			host?.dispose();
		}
	};
}

/**
 * run 会话的扩展集：与用户会话同族（同一批工厂），差异在 unattended 权限门、
 * 固定两轴的 prompt-switch、以及 present_files 只落盘不发事件。
 */
function buildRunExtensions(
	deps: AutomationRunExecutorDeps,
	cwd: string,
	getHost: () => SessionHost | undefined,
): InlineExtension[] {
	return [
		createPermissionGate({
			paths: {
				workspaceDir: cwd,
				configDir: getConfigDir(),
				protectedDirs: deps.protectedDirs,
				// 写 KamiBuddy 自身目录永远高风险 —— unattended 下即「永远自动拒绝」。
				appDir: process.cwd(),
				// 内置资源只读放行（技能渐进加载全靠 read 这里）。
				resourcesDir: getResourcesDir(),
			},
			cwd,
			getSettings: deps.getPermissions,
			unattended: true,
			// 不可达：unattended 在 ask 分支前就拦截了。真被调到说明
			// permission-gate 的语义变了 —— 让它响，别静默放行。
			requestApproval: () => {
				throw new Error("无人值守会话不应发起审批");
			},
		}),
		createProjectTrust({ isOwnWorkspace: deps.isOwnWorkspace }),
		createPresentFiles({
			getWorkspaceDir: () => cwd,
			// 没有人在看：交付只落盘（恢复该会话时产物卡可重建），不发事件。
			onPresent: ({ files, focusFile }) => {
				getHost()?.persistArtifacts(files, focusFile);
			},
		}),
		createPromptSwitch({
			// 两轴固定 work + craft（spec）—— run 会话没有切换器，也不起专家。
			getCurrent: () => ({ sceneId: "work", interactionId: "craft" }),
			compose: (sceneId, interactionId, _expertId, piContext) =>
				deps.compose(cwd, sceneId, interactionId, piContext),
		}),
		createWebTools({ getSearchConfig: deps.getWebSearchConfig }),
		/*
		 * 结构化提问的无人值守变体：craft 白名单含 questionnaire，run 会话
		 * 必须注册同名工具（否则模型对着白名单调一个不存在的能力）；
		 * 但 run 没有人在场，工具层直接返回不可用文案，不阻塞调度器。
		 * requestAnswers 不可达（unattended 分支先短路）—— 真被调到说明
		 * questionnaire-tool 的语义变了，让它响，别静默放行。
		 */
		questionnaireExtensionFactory({
			unattended: true,
			requestAnswers: () => {
				throw new Error("无人值守会话不应发起提问");
			},
		}),
		/*
		 * shell 的无人值守变体：craft 白名单含 powershell，run 会话必须注册
		 * 同名工具（否则模型对着白名单调一个不存在的能力）；但定时任务后台
		 * 跑 shell 等于无人审批的执行权，无论权限档一律在工具层直接拒。
		 */
		powershellExtensionFactory({ unattended: true }),
		createDocReadTool(),
		/*
		 * docx 生成：craft 白名单含 docx_convert，run 会话注册同名真实工具
		 * （否则模型对着白名单调一个不存在的能力）。无需 unattended 变体 ——
		 * 它不像 shell 需要人批：写侧判定锚定产物路径，工作区内 outputPath
		 * 在权限门直接放行，无人值守下语义自洽（定时产出周报 docx 是正当场景）。
		 */
		createDocxConvertTool({
			engineDir: join(getResourcesDir(), "docx-engine"),
			homeDir: homedir(),
		}),
		/*
			 * 内联可视化：craft 白名单含 read_me / show_widget，run 会话注册同名
			 * 真实工具（否则模型对着白名单调一个不存在的能力）。无需 unattended
			 * 变体 —— 它不像问卷需要人答：无副作用、无用户交互，run 产出的
			 * widget 随会话历史可见（spec: add-inline-widgets）。
			 */
		visualizerExtensionFactory(),
		/*
		 * 待办清单：craft 白名单含 todo_write，run 会话注册同名真实工具
		 * （否则模型对着白名单调一个不存在的能力）。无需 unattended 变体 ——
		 * 它不像问卷需要人答：无副作用、无用户交互，清单只是消息流里的
		 * 卡片数据，run 产出的清单卡随会话历史可见（同 visualizer 的取舍）。
		 */
		todoExtensionFactory(),
	];
}
