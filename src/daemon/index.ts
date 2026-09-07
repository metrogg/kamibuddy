/**
 * Daemon：跑在 Electron utilityProcess 里的业务进程。
 *
 * 本文件只做两件事：帧循环（收 DaemonRequest → 派发 → 回 DaemonResponse）
 * 和进程级诊断。会话编排在 core/ 里，pi 的类型止步于那一层（AGENTS.md §1.2）。
 *
 * 为什么不 import electron：daemon 跑在 utilityProcess 里，用不到多数 Electron API，
 * 而与父进程通信只需要 process.parentPort 这个全局。保持零 electron 依赖后，
 * 这一层可以脱离 Electron 单独跑（比如将来做 CLI 形态或集成测试）。
 */

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadSkills } from "@earendil-works/pi-coding-agent";
import {
	getConfigDir,
	getResourcesDir,
	getWorkspaceDir,
} from "../core/config-paths.ts";
import { EventLog } from "../core/event-log.ts";
import { ModelCatalog } from "../core/model-catalog.ts";
import { estimateTokens, ObservabilityStore } from "../core/observability.ts";
import { readPreferences, writePreferences } from "../core/preferences.ts";
import {
	composePrompt,
	formatSkillsSection,
	type SkillDescriptor,
} from "../core/prompt-composer.ts";
import { loadResources, toDescriptors } from "../core/resources.ts";
import { SessionHost } from "../core/session-host.ts";
import {
	createWorkspace,
	listWorkspaces,
	validateWorkspacePath,
} from "../core/workspace.ts";
import { createPermissionGate } from "../extensions/permission-gate.ts";
import { createPromptSwitch } from "../extensions/prompt-switch.ts";
import {
	conversationReducer,
	type ConversationView,
} from "../shared/conversation.ts";
import type {
	DaemonOutbound,
	DaemonRequest,
} from "../shared/daemon-protocol.ts";
import { isDaemonRequest } from "../shared/daemon-protocol.ts";
import {
	INVOKE,
	PUSH,
	type PermissionRequest,
	type PermissionResponse,
	type PromptRequest,
} from "../shared/ipc.ts";
import type {
	ModeDescriptor,
	SessionEvent,
	SessionState,
} from "../shared/session-events.ts";
import type { CustomProviderInput, SkillInfo } from "../shared/settings.ts";

/* ── 与父进程的通道 ───────────────────────────────────────────────── */

/**
 * process.parentPort 是 Electron 注入的全局，类型来自 electron 包。
 * 这里手写最小结构以避免 import electron（见文件头注释）。
 */
interface ParentPort {
	on(event: "message", listener: (message: { data: unknown }) => void): void;
	postMessage(message: unknown): void;
}

/**
 * 取父进程端口。写成函数而不是「const + if 抛错」，是因为后者的类型窄化
 * 不会穿透到 post() 这类函数声明里（函数声明会提升，TS 保守处理）。
 * 这里直接返回非可选类型，调用方无需再窄化。
 */
function requireParentPort(): ParentPort {
	const port = (process as unknown as { parentPort?: ParentPort }).parentPort;
	if (port === undefined) {
		// 直接用 node 跑本文件会走到这里。不静默降级——这属于用错了入口。
		throw new Error(
			"daemon 必须在 Electron utilityProcess 中启动（process.parentPort 不存在）",
		);
	}
	return port;
}

const parentPort = requireParentPort();

function post(frame: DaemonOutbound): void {
	parentPort.postMessage(frame);
}

/* ── 会话状态 ─────────────────────────────────────────────────────── */

/**
 * 两轴资源：场景骨架 + 交互模式，全部来自 resources/（AGENTS.md §3 能力即数据）。
 *
 * **顶层加载、失败即崩**：这是 daemon 里唯一一个「起不来比起来好」的失败——
 * 资源缺失意味着提示词退回 pi 的「coding assistant」默认值，产品身份整个错了，
 * 静默运行比崩溃难排查得多。
 *
 * 加场景 / 加模式 = 在 resources/ 下加目录或文件，零行代码改动。
 */
const RESOURCES = loadResources(getResourcesDir());

const SCENES: readonly ModeDescriptor[] = toDescriptors(RESOURCES).scenes;
const INTERACTIONS: readonly ModeDescriptor[] = toDescriptors(RESOURCES).modes;

/* ── 模型目录 ─────────────────────────────────────────────────────── */

/**
 * 懒加载的模型目录。
 *
 * 不在 start() 里初始化：ModelCatalog 会读 models.json，
 * 用户手写坏了就该在打开设置页时报错，而不是让整个 daemon 起不来
 * （界面卡在「正在启动」是最难排查的失败方式）。
 *
 * **只缓存成功的结果**：失败的 promise 不缓存，用户修好文件后重试才有效。
 */
let catalogPromise: Promise<ModelCatalog> | undefined;

function getCatalog(): Promise<ModelCatalog> {
	if (catalogPromise === undefined) {
		const attempt = ModelCatalog.create();
		catalogPromise = attempt;
		attempt.catch(() => {
			if (catalogPromise === attempt) catalogPromise = undefined;
		});
	}
	return catalogPromise;
}

/**
 * 当前选中的模型，形如 `provider/model`。
 * 启动时从偏好文件恢复。
 */
let activeModelKey: string | undefined = readPreferences().activeModelKey;

/** 内置技能目录（resources/skills/，随应用分发）。 */
const BUILTIN_SKILLS_DIR = join(getResourcesDir(), "skills");

/**
 * 供设置页展示的技能清单。
 *
 * 独立于 SessionHost 的加载（宿主是懒建的，设置页要在第一次发消息前就能看）。
 * 加载失败不抛：设置页不能因为一个坏 SKILL.md 打不开，记日志、列表为空。
 */
function listSkillsForSettings(): SkillInfo[] {
	try {
		const { skills } = loadSkills({
			cwd: getWorkspaceDir(),
			agentDir: getConfigDir(),
			skillPaths: [BUILTIN_SKILLS_DIR],
			includeDefaults: true,
		});
		return skills.map((s) => ({
			name: s.name,
			description: s.description,
			filePath: s.filePath,
			origin: s.filePath.startsWith(BUILTIN_SKILLS_DIR) ? "builtin" : "user",
			disableModelInvocation: s.disableModelInvocation,
		}));
	} catch (error) {
		console.error("技能加载失败（设置页列表为空）：", error);
		return [];
	}
}

/* ── 会话 ─────────────────────────────────────────────────────────── */

/**
 * 当前工作空间。undefined = playground（WorkBuddy 的「不使用工作空间」）：
 * 不绑定任何本地目录、不注册文件工具。这是新建任务的默认状态——
 * 不选空间时不该默认写进某个公共目录。
 *
 * 会话与 cwd 终身绑定（cwd 在建会话时一次性注入 pi 的工具集），
 * 所以换空间 = 作废当前会话重开，见 applyWorkspace。
 */
let workspaceDir: string | undefined = undefined;

/**
 * 会话历史。用 shared 的 reducer 折叠，与渲染进程**同一份实现** ——
 * 各写一份会漂移，症状是「重开界面后内容变了」，极难排查（shared/conversation.ts 的注释）。
 *
 * daemon 持有它是为了让渲染进程重新挂载时能经 snapshot 拿回完整历史。
 */
let conversation: ConversationView = {
	state: {
		sessionId: "",
		cwd: undefined,
		isPlayground: true,
		sceneId: "work",
		interactionId: "craft",
		modelId: activeModelKey,
		isStreaming: false,
	},
	entries: [],
	availableScenes: SCENES,
	availableModes: INTERACTIONS,
};

/* ── 可观测性 ─────────────────────────────────────────────────────── */

/**
 * 结构化事件日志（JSONL 落盘）+ 诊断页统计聚合。
 *
 * daemon 没有界面，console 只打到终端，终端一关现场就没了——
 * 这两件是「出问题时唯一的现场证据」（WorkBuddy 把启动即可观测列为 P0）。
 * 聚合口径是进程内累计，不做历史持久化（core/observability.ts 的注释）。
 */
const eventLog = new EventLog(join(getConfigDir(), "logs"));
const observability = new ObservabilityStore();

/** 最近一次组装的系统提示词 token 估算（compose 时更新），供上下文成分统计。 */
let lastSystemPromptTokens = 0;

/** 事件出口：折叠进本地历史、推给渲染进程、喂给统计与日志。四件事都必须做。 */
function emitSessionEvent(event: SessionEvent): void {
	conversation = conversationReducer(conversation, { type: "event", event });
	observability.record(event);
	eventLog.append({ kind: "session_event", event: sanitizeForLog(event) });
	post({ kind: "push", channel: PUSH.sessionEvent, payload: event });
}

/**
 * 落盘前把流式增量替换成长度——逐字 delta 全记会把日志撑爆且没有信息量，
 * 真正要查的是事件序列与终态，不是每个字符。
 */
function sanitizeForLog(event: SessionEvent): unknown {
	if (
		event.type === "assistant_text_delta" ||
		event.type === "assistant_thinking_delta" ||
		event.type === "tool_progress"
	) {
		return { ...event, delta: `(${event.delta.length} chars)` };
	}
	return event;
}

/* ── 权限审批：daemon 发问 → 渲染进程作答 ─────────────────────────── */

/**
 * 在途的审批请求。
 *
 * 工具执行被 await 挂住，直到用户点了按钮。没有超时是有意的：
 * 用户可能正好离开座位，超时自动拒绝会让长任务莫名失败，
 * 比让它等着更糟。窗口关闭时 Electron 会 quit 并杀掉 daemon，
 * 所以不存在「永久悬挂」的实际后果。
 */
const pendingApprovals = new Map<
	string,
	(response: PermissionResponse) => void
>();

function requestApproval(
	request: Omit<PermissionRequest, "id">,
): Promise<PermissionResponse> {
	const id = randomUUID();
	return new Promise<PermissionResponse>((resolve) => {
		pendingApprovals.set(id, resolve);
		post({
			kind: "push",
			channel: PUSH.permissionRequest,
			payload: { id, ...request },
		});
	});
}

let hostPromise: Promise<SessionHost> | undefined;

/**
 * 懒建会话。第一次发消息时才创建 —— 建会话需要一个可用模型，
 * 而用户可能先打开应用、再去设置里填 Key。
 *
 * 失败的 promise 不缓存，否则用户配好模型后仍然一直失败。
 */
function getHost(): Promise<SessionHost> {
	if (hostPromise === undefined) {
		const attempt = createHost();
		hostPromise = attempt;
		attempt.catch(() => {
			if (hostPromise === attempt) hostPromise = undefined;
		});
	}
	return hostPromise;
}

async function createHost(): Promise<SessionHost> {
	const catalog = await getCatalog();

	// 没选模型时不擅自挑一个：用户不知道在用哪家、也不知道会产生谁的费用。
	// 明确指路比静默可用更好。
	if (activeModelKey === undefined) {
		throw new Error(
			"还没有选择模型。请点左下角设置，为任一服务商填写 API Key 并选择模型。",
		);
	}
	if (!catalog.isUsable(activeModelKey)) {
		throw new Error(
			"选中的模型当前不可用，请到设置里检查 API Key 或重新选择模型。",
		);
	}

	// playground 的 cwd 为 undefined；正式空间才需要在建会话前确保目录存在
	//（SessionHost.create 里也会 mkdir，但权限门要先拿到一个已确定存在的目录）。
	const cwd = workspaceDir;
	if (cwd !== undefined) mkdirSync(cwd, { recursive: true });

	const host = await SessionHost.create({
		catalog,
		modelKey: activeModelKey,
		cwd,
		isPlayground: cwd === undefined,
		sceneId: conversation.state.sceneId,
		interactionId: conversation.state.interactionId,
		emit: emitSessionEvent,
		resources: RESOURCES,
		// 扩展由 daemon 组装：core/ 不许 import extensions/
		// （依赖方向是 extensions → core，见 AGENTS.md §1）。
		// playground（workspaceDir 为 undefined）不装权限门 —— 文件工具根本没注册，
		// 没有可拦的调用；装了反而要用一个假 cwd 做路径解析，徒增歧义。
		extensions: [
			...(cwd === undefined
				? []
				: [
						createPermissionGate({
							paths: { workspaceDir: cwd, configDir: getConfigDir() },
							cwd,
							requestApproval,
						}),
					]),
			// 提示词切换：每轮按当前 场景×模式 组装 systemPrompt（见 extensions/prompt-switch.ts）。
			// 两轴的权威状态经 conversation 折叠镜像读取；技能段取自宿主的 loader 发现结果。
			createPromptSwitch({
				getCurrent: () => ({
					sceneId: conversation.state.sceneId,
					interactionId: conversation.state.interactionId,
				}),
				compose: async (sceneId, interactionId) => {
					const scene = RESOURCES.scenes.find((s) => s.id === sceneId);
					const mode = RESOURCES.modes.find((m) => m.id === interactionId);
					if (scene === undefined || mode === undefined) {
						throw new Error(
							`场景或交互模式不存在：${sceneId} / ${interactionId}`,
						);
					}
					let skills: SkillDescriptor[] = [];
					if (hostPromise !== undefined)
						skills = [...(await hostPromise).skillDescriptors];
					const prompt = composePrompt({
						sceneBody: scene.body,
						modeBody: mode.body,
						skillsSection: formatSkillsSection(skills),
						// playground 无工作目录，提示词里如实说明，免得模型去找一个不存在的路径。
						cwd: cwd ?? "（未选择工作空间，无本地文件目录）",
					});
					// 成分统计的 system 部分从这里取——只有这里见过组装完的真身。
					lastSystemPromptTokens = estimateTokens(prompt);
					return prompt;
				},
			}),
		],
	});

	// 会话建好后 sessionId / cwd 才有真值，推一次让 UI 同步。
	emitSessionEvent({ type: "session_state", state: host.state });
	return host;
}

/**
 * 作废当前会话并清空本地历史。换空间与新建任务共用这一步：
 * 会话与 cwd 终身绑定，不存在「换目录/换任务继续聊」。
 */
async function resetSession(): Promise<void> {
	if (hostPromise !== undefined) {
		(await hostPromise).dispose();
		hostPromise = undefined;
	}
	conversation = {
		...conversation,
		state: { ...conversation.state, sessionId: "", isStreaming: false },
		entries: [],
	};
}

/**
 * 切换工作空间。空串表示「不使用工作空间」（playground）。
 *
 * 安全前提：工作空间内的写操作会被权限门直接放行，所以「设为哪个目录」
 * 必须先过 validateWorkspacePath（配置目录 / 应用目录一律拒，见 core/workspace.ts）。
 *
 * 换空间 = 作废当前会话：cwd 在建会话时一次性注入 pi 的工具集，
 * 不存在「换目录继续聊」（WorkBuddy 同样如此，它的 cwd 在 session.create 时绑定）。
 * 旧会话的本地历史一并清掉——它属于上一个空间，留着会让 UI 显示别处的对话。
 */
async function applyWorkspace(dir: string): Promise<string | undefined> {
	// 空串 = playground，无需路径校验（本就不绑定任何目录）。
	const next = dir === "" ? undefined : dir;
	if (next !== undefined) {
		const error = validateWorkspacePath(next, {
			configDir: getConfigDir(),
			appDir: process.cwd(),
		});
		if (error !== undefined) throw new Error(error);
	}
	if (next === workspaceDir) return workspaceDir;
	if (conversation.state.isStreaming)
		throw new Error("任务进行中，请先停止当前任务再切换工作空间");

	if (next !== undefined) mkdirSync(next, { recursive: true });
	workspaceDir = next;

	await resetSession();
	updateStateLocally({ cwd: next, isPlayground: next === undefined });
	return next;
}

/* ── 请求派发 ─────────────────────────────────────────────────────── */

type Handler = (args: readonly unknown[]) => Promise<unknown>;

const handlers: Record<string, Handler> = {
	// 返回折叠后的真实历史。ConversationView 与 SessionSnapshot 结构一致。
	[INVOKE.snapshot]: async () => conversation,

	/* ── 设置：已可用 ─────────────────────────────────────────────── */

	[INVOKE.settingsSnapshot]: async () => {
		const snapshot = await (await getCatalog()).snapshot(activeModelKey);
		return { ...snapshot, skills: listSkillsForSettings() };
	},

	[INVOKE.setApiKey]: async ([providerId, apiKey]) => {
		await (
			await getCatalog()
		).setApiKey(providerId as string, apiKey as string);
	},

	[INVOKE.removeApiKey]: async ([providerId]) => {
		await (await getCatalog()).removeApiKey(providerId as string);
	},

	[INVOKE.saveCustomProvider]: async ([input, apiKey]) => {
		await (
			await getCatalog()
		).saveCustomProvider(
			input as CustomProviderInput,
			apiKey as string | undefined,
		);
	},

	[INVOKE.deleteCustomProvider]: async ([providerId]) => {
		await (await getCatalog()).deleteCustomProvider(providerId as string);
	},

	[INVOKE.readCustomProvider]: async ([providerId]) =>
		(await getCatalog()).readCustomProvider(providerId as string),

	[INVOKE.refreshCatalog]: async () => {
		await (await getCatalog()).refreshCatalog();
	},

	/* ── 诊断 ─────────────────────────────────────────────────────── */

	[INVOKE.statsSnapshot]: async () =>
		observability.snapshot({
			entries: conversation.entries,
			systemPromptTokens: lastSystemPromptTokens,
			contextUsage: conversation.state.contextUsage,
			logDir: eventLog.dir,
		}),

	/* ── 会话 ─────────────────────────────────────────────────────── */

	[INVOKE.prompt]: async ([request]) => {
		const { text, whileStreaming } = request as PromptRequest;
		const host = await getHost();
		await host.prompt(text, whileStreaming);
	},

	/**
	 * 中断。**不走 getHost()** —— 没有会话时中断本就是空操作，
	 * 为了中断而去创建一个会话是荒谬的（还会因为没配模型而报错）。
	 */
	[INVOKE.abort]: async () => {
		if (hostPromise === undefined) return;
		await (await hostPromise).abort();
	},

	/**
	 * 新建任务：作废旧会话、在当前工作空间语义下开一个全新会话。
	 *
	 * 关键点：工作空间选择**保留**（用户在哪个空间就在哪个空间开新任务），
	 * 但会话上下文清零——这是「任务干扰」的根治：两个任务不再共享 pi 的消息历史。
	 * 会话本体是懒建的（getHost），这里只需作废 + 清空，下次 prompt 自然建新的。
	 */
	[INVOKE.newTask]: async () => {
		if (conversation.state.isStreaming)
			throw new Error("任务进行中，请先停止当前任务");
		await resetSession();
		updateStateLocally({});
	},

	[INVOKE.setScene]: async ([sceneId]) => {
		const id = requireReady(SCENES, sceneId as string, "场景");
		if (hostPromise === undefined) {
			// 会话还没建：只记住选择。建会话时会把它带进去（见 createHost）。
			updateStateLocally({ sceneId: id });
			return;
		}
		(await hostPromise).setScene(id);
	},

	[INVOKE.setInteraction]: async ([interactionId]) => {
		const id = requireReady(INTERACTIONS, interactionId as string, "交互模式");
		if (hostPromise === undefined) {
			updateStateLocally({ interactionId: id });
			return;
		}
		(await hostPromise).setInteraction(id);
	},

	/**
	 * 切换模型。不依赖会话 —— 设置界面在会话建立前就要能用。
	 * 会话已存在时同步切过去，避免「设置里显示 A、实际还在用 B」。
	 */
	[INVOKE.setModel]: async ([modelKey]) => {
		const key = modelKey as string;
		const catalog = await getCatalog();
		// 未配凭据的服务商其模型照样在目录里（probe 用例 B），所以必须显式把关，
		// 否则用户选完要等到真正发消息时才报错。
		if (!catalog.isUsable(key)) {
			throw new Error("该模型不可用：请先为其服务商配置 API Key");
		}
		activeModelKey = key;
		writePreferences({ activeModelKey: key });

		if (hostPromise !== undefined) await (await hostPromise).setModel(key);
		else updateStateLocally({ modelId: key });
	},

	/* ── 工作空间 ───────────────────────────────────────────────────── */

	[INVOKE.workspaceSnapshot]: async () => ({
		current: workspaceDir,
		defaultRoot: getWorkspaceDir(),
		workspaces: listWorkspaces(getWorkspaceDir()),
	}),

	[INVOKE.createWorkspace]: async ([name]) =>
		applyWorkspace(createWorkspace(getWorkspaceDir(), name as string)),

	[INVOKE.setWorkspace]: async ([path]) => applyWorkspace(path as string),

	/* ── 权限审批回程 ─────────────────────────────────────────────── */

	[INVOKE.permissionResponse]: async ([response]) => {
		const answer = response as PermissionResponse;
		const resolve = pendingApprovals.get(answer.id);
		// 找不到通常是重复应答（用户连点两下）。静默忽略即可，不是错误。
		if (resolve === undefined) return;
		pendingApprovals.delete(answer.id);
		resolve(answer);
	},

	/* ── pi 的 ctx.ui 桥：随需要落地 ──────────────────────────────── */

	// 权限弹窗走上面的自有通道（要展示工具入参、风险等级、「记住」选项，
	// ctx.ui.confirm 的纯文本承载不了）。这条通道留给将来扩展里真正用到
	// ctx.ui.select / input 的场景。
	[INVOKE.uiResponse]: async () => {
		throw new Error("暂无扩展使用 ctx.ui 交互通道");
	},
};

/**
 * 校验两轴的取值。
 *
 * 未实现的项（ready:false）仍在列表里显示 —— 那是对齐 WorkBuddy 的能力面，
 * 但真被选中时必须拒绝：静默接受会让用户以为切过去了，
 * 而实际提示词与工具集没变（AGENTS.md §7）。
 */
function requireReady(
	options: readonly ModeDescriptor[],
	id: string,
	kind: string,
): string {
	const found = options.find((o) => o.id === id);
	if (found === undefined) throw new Error(`未知${kind}：${id}`);
	if (!found.ready) throw new Error(`「${found.label}」${kind}还未实现`);
	return id;
}

/** 会话尚未建立时更新状态并推给 UI。会话建立后一律由 SessionHost 发权威状态。 */
function updateStateLocally(changes: Partial<SessionState>): void {
	emitSessionEvent({
		type: "session_state",
		state: { ...conversation.state, ...changes },
	});
}

async function dispatch(request: DaemonRequest): Promise<void> {
	// 每个请求记一行（终端 + 落盘）。daemon 没有界面，出问题时这是唯一的现场证据
	// （WorkBuddy 把「启动即可观测」列为 P0，同一个考虑）。
	// 只记通道名不记参数：参数里可能有 API Key（shared/ipc.ts 的 setApiKey 约定）。
	console.log(`← ${request.channel}`);
	eventLog.append({ kind: "ipc", channel: request.channel });

	const handler = handlers[request.channel];
	if (handler === undefined) {
		post({
			kind: "response",
			id: request.id,
			ok: false,
			error: `未知通道：${request.channel}`,
		});
		return;
	}
	try {
		const value = await handler(request.args);
		post({ kind: "response", id: request.id, ok: true, value });
	} catch (error) {
		// 只回一句给用户看的话；stack 留在 daemon 侧日志里（shared/daemon-protocol.ts 的约定）。
		const stack = error instanceof Error ? error.stack : undefined;
		if (stack !== undefined) console.error(stack);
		eventLog.append({
			kind: "ipc_error",
			channel: request.channel,
			message: error instanceof Error ? error.message : String(error),
			stack,
		});
		post({
			kind: "response",
			id: request.id,
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

parentPort.on("message", (message) => {
	const frame = message.data;
	if (!isDaemonRequest(frame)) {
		console.error(`收到无法识别的帧：${JSON.stringify(frame)}`);
		return;
	}
	void dispatch(frame);
});

/* ── 进程级崩溃取证 ───────────────────────────────────────────────── */

/*
 * 崩溃前的最后一条日志往往正是最需要的那条，所以这里同步落盘再退出
 * （EventLog 用同步 appendFileSync 就是为这个场景选的）。
 * 不吞异常：记完照样退出，让 main 的 PUSH.daemonDown 把「已断开」显示给用户
 * （AGENTS.md §7：让它响亮地失败）。
 */
process.on("uncaughtException", (error) => {
	eventLog.append({
		kind: "fatal",
		why: "uncaughtException",
		message: error.message,
		stack: error.stack,
	});
	console.error(error.stack ?? error.message);
	process.exit(1);
});

process.on("unhandledRejection", (reason) => {
	eventLog.append({
		kind: "fatal",
		why: "unhandledRejection",
		message: reason instanceof Error ? reason.message : String(reason),
		stack: reason instanceof Error ? reason.stack : undefined,
	});
	console.error(reason);
});

/* ── 启动 ─────────────────────────────────────────────────────────── */

function start(): void {
	// pi SDK 在模块顶部经 core/model-catalog.ts 静态导入，走到这里时已经加载完成。
	// Electron 内的 Node-API 兼容性已在 D2 实测确认（ARCHITECTURE.md §4.1），
	// 原先那段 dlopen 计数探针已移除 —— 静态导入先于模块体执行，钩子挂不上，
	// 读数恒为 0，留着只会误导人。
	console.log(
		`daemon 启动：node ${process.version} on ${process.platform}-${process.arch}`,
	);
	console.log(`配置目录：${getConfigDir()}`);
	eventLog.append({
		kind: "process",
		event: "daemon_start",
		node: process.version,
		platform: `${process.platform}-${process.arch}`,
	});

	// 模型目录是懒加载的（见 getCatalog）：models.json 坏了应当在打开设置页时报错，
	// 而不是让 daemon 起不来、界面永久卡在「正在启动」。
	post({ kind: "ready" });
}

try {
	start();
} catch (error) {
	// 启动失败不能静默：父进程会一直等 ready，UI 停在 loading。
	console.error("daemon 启动失败");
	console.error(
		error instanceof Error ? (error.stack ?? error.message) : String(error),
	);
	eventLog.append({
		kind: "fatal",
		why: "startup",
		message: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
	});
	process.exit(1);
}
