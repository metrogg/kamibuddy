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
import { mkdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { loadSkills, SessionManager, type SessionInfo } from "@earendil-works/pi-coding-agent";
import {
	getConfigDir,
	getResourcesDir,
	getSessionsDir,
	getWorkspaceDir,
} from "../core/config-paths.ts";
import { EventLog } from "../core/event-log.ts";
import { ModelCatalog } from "../core/model-catalog.ts";
import { estimateComposition, estimateTokens, ObservabilityStore } from "../core/observability.ts";
import { readPreferences, writePreferences } from "../core/preferences.ts";
import { PreviewServer } from "../core/preview-server.ts";
import {
	composePrompt,
	formatSkillsSection,
	type SkillDescriptor,
} from "../core/prompt-composer.ts";
import { loadResources, toDescriptors } from "../core/resources.ts";
import { importSkill, userSkillsDir } from "../core/skill-install.ts";
import { buildExportPath } from "../core/session-export.ts";
import { restoredToolLabel, SessionHost } from "../core/session-host.ts";
import { buildConversationEntries, validateSessionFilePath } from "../core/session-rebuild.ts";
import { createWorkspace, listWorkspaces, validateWorkspacePath } from "../core/workspace.ts";
import { indexFiles } from "../core/file-index.ts";
import { listPromptTemplates } from "../core/prompt-templates.ts";
import { createPermissionGate } from "../extensions/permission-gate.ts";
import { defaultProtectedDirs, isPathInside } from "../extensions/permission-policy.ts";
import { createProjectTrust } from "../extensions/project-trust.ts";
import {
	DEFAULT_PERMISSIONS,
	isApprovalPolicy,
	isSandboxMode,
	presetIdFor,
	type PermissionInfo,
	type PermissionSettings,
} from "../shared/permissions.ts";
import { createPresentFiles } from "../extensions/present-files.ts";
import { createPromptSwitch } from "../extensions/prompt-switch.ts";
import { createWebTools } from "../extensions/web-tools.ts";
import type { WebSearchConfig } from "../core/web-search.ts";
import { buildContextUsage } from "../shared/context-usage.ts";
import { parseBuiltinCommand } from "../shared/builtin-commands.ts";
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
	type ArtifactContent,
	type PromptRequest,
	type SessionSummary,
} from "../shared/ipc.ts";
import {
	isWebSearchProviderId,
	type WebSearchConfigInfo,
	type WebSearchConfigInput,
	type WebSearchTestResult,
} from "../shared/settings.ts";
import { searchWeb } from "../core/web-search.ts";
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

/**
 * 当前权限设置（沙箱模式 + 审批策略）。启动时从偏好恢复，缺省 = 引入模式前的行为。
 *
 * 与 activeModelKey 同样用模块级变量而非每次读盘：权限门在**每次工具调用**时都要读它，
 * 读盘会把 IO 放进热路径。改动经 setPermissions 通道走，写盘与内存同步更新。
 */
let activePermissions: PermissionSettings = readPreferences().permissions ?? DEFAULT_PERMISSIONS;

/**
 * 受保护的凭据目录，进程启动时算一次。
 *
 * 家目录在进程生命周期内不会变，没必要每次判定都调 homedir()。
 * 这批目录**读写都拒且任何权限模式都不能越过**（见 permission-policy.ts 阶段 1）。
 */
const PROTECTED_DIRS = defaultProtectedDirs(homedir());

/** 内置技能目录（resources/skills/，随应用分发）。 */
const BUILTIN_SKILLS_DIR = join(getResourcesDir(), "skills");

/**
 * 技能清单。技能页展示与提示词组装共用这一个来源，且**每次现读** ——
 * 导入新技能后下一轮对话即生效，无需重启应用。
 *
 * 独立于 SessionHost 的加载（宿主懒建，技能页要在第一次发消息前就能看）。
 * 加载失败不抛：页面不能因为一个坏 SKILL.md 打不开，记日志、列表为空。
 */
function listSkills(): SkillInfo[] {
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
	cancelledTurns: [],
	artifacts: [],
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

/**
 * 产物预览静态服务（根 = 当前工作区，core/preview-server.ts 的注释是安全契约）。
 * playground 不起服务；换工作空间时随 applyWorkspace 换根。
 */
const previewServer = new PreviewServer();

/** 预览文本的上限：超过按二进制处理（面板只读展示，不做大文件）。 */
const ARTIFACT_TEXT_MAX = 512 * 1024;

/**
 * 读产物文件内容（readArtifact 通道）。路径限当前工作区内：
 * 相对路径对工作区 resolve；绝对路径必须落在工作区里——
 * 预览面板能看的文件与权限门放行的写范围必须同界（配置目录里的密钥
 * 绝不能经这条通道被读出来）。
 */
function readArtifactContent(path: string): ArtifactContent {
	if (workspaceDir === undefined) {
		throw new Error("playground 没有工作区，无可读取的产物");
	}
	const abs = resolve(workspaceDir, path);
	if (abs !== workspaceDir && !abs.startsWith(workspaceDir + sep)) {
		throw new Error("路径超出当前工作区");
	}
	const stat = statSync(abs); // 不存在让 ENOENT 直接抛给调用方（响亮失败）
	const size = stat.size;
	if (size > ARTIFACT_TEXT_MAX) return { size, text: undefined };
	const buf = readFileSync(abs);
	if (buf.includes(0)) return { size, text: undefined }; // NUL = 二进制
	return { size, text: buf.toString("utf8") };
}

/** 最近一次组装的系统提示词 token 估算（compose 时更新），供上下文成分统计。 */
let lastSystemPromptTokens = 0;

/** 最近一次组装的技能段 token 估算（compose 时更新），供上下文用量明细拆分类。 */
let lastSkillsTokens = 0;

/** 事件出口：折叠进本地历史、推给渲染进程、喂给统计与日志。四件事都必须做。 */
/**
 * 并发竞速一个硬超时。
 *
 * 与 fetch 侧的 AbortSignal.timeout 不同，这是**结果层面**的最后防线：
 * Windows DNS 解析不可中断（nodejs/node#46549），信号超时拦不住它，
 * 只有从这里兜住「永不返回」。timer 不清理：超时后搜索仍会自然结束，
 * 无非多等十几秒，不值得为此引入清理逻辑。
 */
function withHardTimeout<T>(promise: Promise<T>, ms: number, message = "请求超时"): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_resolve, reject) => {
			setTimeout(() => reject(new Error(message)), ms).unref?.();
		}),
	]);
}

/**
 * 组装权限状态，**含强制力的诚实声明**。
 *
 * enforcement 恒为 `partial`，因为我们没有 OS 级沙箱：
 * `read-only` 靠权限门拦住已知的写工具（write/edit/bash/powershell），
 * 但拦不住"某个自定义工具或子进程绕过工具层去写文件"这类间接路径。
 *
 * 为什么必须说出来：pi 的 security.md 明确警告
 * "a partial in-process sandbox would be easy to misunderstand as a security boundary"。
 * 界面上写清楚，用户才不会拿它当隔离用。将来真接上 OS 沙箱时只改这一处。
 * 分析见 docs/workbuddy分析/09-sandbox-and-permissions.md。
 */
function buildPermissionInfo(settings: PermissionSettings): PermissionInfo {
	return {
		settings,
		enforcement: "partial",
		enforcementNote:
			"权限由 KamiBuddy 在工具调用前判定，不是操作系统级隔离：" +
			"它能拦住助手主动的读写与命令，但不能约束已运行程序的行为。" +
			"凭据目录（.ssh/.gnupg/.aws 等）在任何档位下都禁止读写。",
	};
}

function emitSessionEvent(event: SessionEvent): void {
	conversation = conversationReducer(conversation, { type: "event", event });
	observability.record(event);
	eventLog.append({ kind: "session_event", event: sanitizeForLog(event) });
	post({ kind: "push", channel: PUSH.sessionEvent, payload: event });

	// 带用量的 session_state 到达后补发明细：used/total 是 pi 的精确值（刚折叠进
	// conversation.state），分类所需的系统提示词/技能段 token 只有这里知道。
	// context_usage 自身不会再触发本分支，无递归。
	if (event.type === "session_state" && event.state.contextUsage !== undefined) {
		emitContextUsageDetail(event.state.contextUsage);
	}
}

/** 组装并发出上下文用量明细（分类是估算值，UI 必须标注，见 shared/context-usage.ts）。 */
function emitContextUsageDetail(contextUsage: { usedTokens: number; maxTokens: number }): void {
	const composition = estimateComposition(conversation.entries, lastSystemPromptTokens);
	if (composition === undefined) return;
	emitSessionEvent({
		type: "context_usage",
		usage: buildContextUsage({
			used: contextUsage.usedTokens,
			total: contextUsage.maxTokens,
			systemPromptTokens: lastSystemPromptTokens,
			skillsTokens: lastSkillsTokens,
			composition,
		}),
	});
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
	/*
	 * 审批请求落审计日志：出了事要能还原「当时问过什么、用户批了什么」。
	 * 不记 details 全文 —— 路径/命令已随工具卡的 session_event 日志落盘，
	 * 这里再抄一遍只会让审计日志体积翻倍；id 足够把两边对上。
	 */
	eventLog.append({
		kind: "permission_request",
		id,
		toolName: request.toolName,
		risk: request.risk,
		summary: request.summary,
	});
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

/**
 * 组装会话宿主的唯一入口。恢复历史会话时传入 open 出来的 SessionManager，
 * 其余（扩展、两轴、权限门、预览、当前模型选择）与新会话完全一致 ——
 * 恢复会话不改模型选择与权限设置（spec 决策）。
 */
async function createHost(sessionManager?: SessionManager): Promise<SessionHost> {
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
		...(sessionManager === undefined ? {} : { sessionManager }),
		// 扩展由 daemon 组装：core/ 不许 import extensions/
		// （依赖方向是 extensions → core，见 AGENTS.md §1）。
		// playground（workspaceDir 为 undefined）不装权限门 —— 文件工具根本没注册，
		// 没有可拦的调用；装了反而要用一个假 cwd 做路径解析，徒增歧义。
		extensions: [
			...(cwd === undefined
				? []
				: [
						createPermissionGate({
							paths: {
								workspaceDir: cwd,
								configDir: getConfigDir(),
								protectedDirs: PROTECTED_DIRS,
								// 写 KamiBuddy 自身目录永远高风险询问（policy 判定链里先于工作区放行）。
								// dev 是项目根，打包后是安装目录 —— 都以 daemon 进程的 cwd 为准。
								appDir: process.cwd(),
							},
							cwd,
							// getter 而非快照：用户改了预设，下一次工具调用即生效。
							getSettings: () => activePermissions,
							requestApproval,
						}),
					]),
			/*
			 * 项目信任：**所有会话都装**（与权限门不同）。
			 *
			 * 理由：项目级资源的加载发生在工具层之前 —— `.pi/extensions` 是
			 * TypeScript 模块，以本进程权限执行任意代码，权限门根本拦不到它
			 * （那不是工具调用）。所以哪怕 playground 也要把这道闸挂上。
			 *
			 * 自家目录（~/KamiBuddy 与配置目录下的 playground 占位）直接信任：
			 * 内容都由本机产出，没有"别人塞进来的扩展"这个来源；
			 * 每次新建任务都弹框会让用户条件反射点同意，那这道防线就废了。
			 */
			createProjectTrust({
				isOwnWorkspace: (dir) =>
					isPathInside(getWorkspaceDir(), dir) || isPathInside(getConfigDir(), dir),
			}),
			// 产物交付：present_files 是产物的唯一入口（WorkBuddy 同构）。
			// 只读工具，playground 也注册 —— 模型在 playground 没有写工具，
			// 但交付动作本身无害（区外路径不 stat，见 extensions/present-files.ts）。
			createPresentFiles({
				getWorkspaceDir: () => workspaceDir,
				onPresent: ({ files, focusFile }) =>
					emitSessionEvent({ type: "artifacts_presented", files, focusFile }),
			}),
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
					// 每轮现读技能清单：导入新技能后下一轮对话即生效，无需重启。
					const skills: SkillDescriptor[] = listSkills().map((s) => ({
						name: s.name,
						description: s.description,
						filePath: s.filePath,
					}));
					const skillsSection = formatSkillsSection(skills);
					const prompt = composePrompt({
						sceneBody: scene.body,
						modeBody: mode.body,
						skillsSection,
						// playground 无工作目录，提示词里如实说明，免得模型去找一个不存在的路径。
						cwd: cwd ?? "（未选择工作空间，无本地文件目录）",
					});
					// 成分统计的 system 部分从这里取——只有这里见过组装完的真身。
					// 技能段单独记一份：上下文用量明细要把「技能」从系统提示词里拆出来单列。
					lastSystemPromptTokens = estimateTokens(prompt);
					lastSkillsTokens = estimateTokens(skillsSection);
					return prompt;
				},
			}),
			// 联网工具：所有会话都装（playground 无文件工具，也正是问答主场景）。
			// 配置读偏好文件；权限门里 web_search/web_fetch 已登记放行，不再弹窗。
			createWebTools({
				getSearchConfig: () => {
					const webSearch = readPreferences().webSearch;
					// 偏好文件可能被手工编辑出非法值：按「未配置」处理，
					// 工具会引导用户去设置页 —— 不静默用错服务商打 API。
					if (
						webSearch === undefined ||
						!isWebSearchProviderId(webSearch.providerId)
					) {
						return undefined;
					}
					const config: WebSearchConfig = {
						providerId: webSearch.providerId,
						apiKey: webSearch.apiKey,
					};
					return config;
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
	/*
	 * 走事件而不是直接改 conversation：reducer 两端共用（shared/conversation.ts），
	 * daemon 本地折叠与 renderer 折叠的是同一个 history_reset，历史同步清零。
	 * 此前只清本地再发 session_state —— reducer 对 session_state 不动 entries，
	 * renderer 一直显示旧历史（/new 命令的幽灵历史就是这么来的）。
	 */
	emitSessionEvent({ type: "history_reset" });
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

	// 预览服务随工作区换根（playground 时停掉）。先于 resetSession：
	// 服务换根失败（如端口异常）时工作区切换应该响亮失败，而不是带病继续。
	await previewServer.setRoot(next);

	await resetSession();
	updateStateLocally({ cwd: next, isPlayground: next === undefined });
	return next;
}

/* ── 历史会话管理（list / resume / rename / delete） ────────────── */

/**
 * 列表标题的截断上限。renderer 的 taskTitle 另有 24 字符的展示截断，
 * 这里截的是数据上限：firstMessage 原文可能整段上千字，不能原样进列表契约。
 */
const SESSION_TITLE_MAX = 40;

/** 列表标题：命名优先，否则首条消息压单行截断。空会话给占位，不留空白行。 */
function sessionTitle(name: string | undefined, firstMessage: string): string {
	if (name !== undefined && name !== "") return name;
	const oneLine = firstMessage.replace(/\s+/g, " ").trim();
	if (oneLine === "") return "（空会话）";
	return oneLine.length > SESSION_TITLE_MAX
		? `${oneLine.slice(0, SESSION_TITLE_MAX)}…`
		: oneLine;
}

/** 只容忍「目录不存在」：首次使用还没有 sessions 目录是正常情况，列表为空。 */
function isEnoent(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { code?: unknown }).code === "ENOENT"
	);
}

/** 当前活动宿主持有的会话文件。host 未建（还没发过消息）为 undefined。 */
async function currentSessionFile(): Promise<string | undefined> {
	if (hostPromise === undefined) return undefined;
	return (await hostPromise).sessionFilePath;
}

async function listSessions(): Promise<SessionSummary[]> {
	let infos: SessionInfo[];
	try {
		infos = await SessionManager.listAll(getSessionsDir());
	} catch (error) {
		// 只容忍 ENOENT（见 isEnoent）。其余错误必须抛 —— 静默返回空列表
		// 会让用户以为历史丢了，那比报错更难排查（AGENTS.md §7）。
		if (isEnoent(error)) return [];
		throw error;
	}
	const currentFile = await currentSessionFile();
	const playgroundDir = join(getConfigDir(), "playground");
	return infos
		.map((info): SessionSummary => {
			return {
				id: info.id,
				path: info.path,
				title: sessionTitle(info.name, info.firstMessage),
				name: info.name,
				cwd: info.cwd,
				isPlayground: info.cwd === playgroundDir,
				createdAt: info.created.getTime(),
				modifiedAt: info.modified.getTime(),
				messageCount: info.messageCount,
				current:
					currentFile !== undefined &&
					resolve(currentFile) === resolve(info.path),
			};
		})
		.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

/**
 * 恢复历史会话为当前活动会话。编排与 applyWorkspace 同构：
 * 守卫 → 作废旧宿主 → 恢复工作空间语义 → 重建宿主 → 重建本地历史。
 *
 * 失败原子性：先验证，后切换。open / header 校验 / 工作目录校验全部在
 * dispose 旧宿主之前完成 —— 这些步骤都可能失败（文件损坏、缺头部、目录
 * 不合法），失败时旧会话必须原样保留（宿主、本地历史、工作目录、预览服务
 * 都不动），错误经 IPC 抛回 renderer toast 即可。若先 dispose 再验证，
 * 用户看到错误 toast 之后会发现当前会话已被静默清空（验收确证过的坑）。
 *
 * dispose 之后仍留一段非原子窗口：setRoot 换根、createHost 组装（如模型
 * 不可用）失败时，旧宿主已销毁、新宿主未建。这与 applyWorkspace 的失败
 * 语义一致（那里同样先 setRoot 再 resetSession，见该函数注释）——setRoot
 * 是「先 close 旧服务再 listen 新根」，前移它救不了 createHost，反而把
 * 预览服务也拖进中间态；要彻底关闭窗口需要「先建好后切换」的两阶段宿主
 * 交换，超出本次修复范围。
 *
 * 与 resetSession 的关键差别：**不发 history_reset**。renderer 在 resume
 * 返回后 resyncSnapshot 整体替换视图；若先发 history_reset，界面会先闪
 * 一下空屏再出内容。本地 conversation 也由重建结果整体赋值，不经事件。
 */
async function resumeSession(path: string): Promise<void> {
	if (conversation.state.isStreaming)
		throw new Error("任务进行中，请先停止当前任务");
	const sessionsDir = getSessionsDir();
	const pathError = validateSessionFilePath(path, sessionsDir);
	if (pathError !== undefined) throw new Error(pathError);

	/* ── 切换前：做完所有可能失败的验证，此刻旧会话毫发无损 ── */

	// open 是同步的（dist 类型：static open(...) : SessionManager），
	// 不依赖旧宿主销毁；文件损坏/不可读在此抛出。
	const manager = SessionManager.open(path, sessionsDir);
	const header = manager.getHeader();
	if (header === null) throw new Error("会话文件缺少头部，无法恢复");

	// 从 header.cwd 推导目标工作空间，只算值不赋值：playground 占位目录
	// → playground；否则按工作空间校验同一套规则把关（会话本身没问题但
	// 目录不合法时拒，如指向配置目录的旧会话）。目录可能已被用户删掉，
	// 补建与新建会话同口径 —— mkdir 幂等且不碰任何会话状态，可安全提前。
	const playgroundDir = join(getConfigDir(), "playground");
	let nextWorkspaceDir: string | undefined;
	if (header.cwd === playgroundDir) {
		nextWorkspaceDir = undefined;
	} else {
		const wsError = validateWorkspacePath(header.cwd, {
			configDir: getConfigDir(),
			appDir: process.cwd(),
		});
		if (wsError !== undefined) throw new Error(`会话的工作目录不可用：${wsError}`);
		mkdirSync(header.cwd, { recursive: true });
		nextWorkspaceDir = header.cwd;
	}

	/* ── 切换点：此后失败即进入上文的非原子窗口 ── */

	if (hostPromise !== undefined) {
		(await hostPromise).dispose();
		hostPromise = undefined;
	}

	workspaceDir = nextWorkspaceDir;

	// 预览服务随工作区换根（playground 时停掉），与 applyWorkspace 同口径。
	await previewServer.setRoot(workspaceDir);

	// 复用 createHost 的全部组装（扩展、两轴、权限门、当前模型选择），
	// 只换 sessionManager。createHost 末尾会发 session_state，
	// cwd / isPlayground / sessionId 随之同步给 UI。
	const host = await createHost(manager);
	hostPromise = Promise.resolve(host);

	// 本地历史整体重建：entries 来自落盘条目（buildContextEntries 已完成
	// 压缩裁剪，恢复视图与模型实际看到的上下文一致）。usageDetail / turn /
	// cancelledTurns / artifacts 属于旧会话，清空；state 保留现值 ——
	// 它刚被 createHost 的 session_state 换成新会话的权威值。
	conversation = {
		...conversation,
		entries: buildConversationEntries(manager.buildContextEntries(), restoredToolLabel),
		usageDetail: undefined,
		turn: undefined,
		cancelledTurns: [],
		artifacts: [],
	};
}

/* ── 请求派发 ─────────────────────────────────────────────────────── */

type Handler = (args: readonly unknown[]) => Promise<unknown>;

/** 新建任务：作废旧会话。INVOKE.newTask 与内置命令 /new 共用。 */
async function newTask(): Promise<void> {
	if (conversation.state.isStreaming)
		throw new Error("任务进行中，请先停止当前任务");
	await resetSession();
	updateStateLocally({});
}

const handlers: Record<string, Handler> = {
	// 返回折叠后的真实历史。ConversationView 与 SessionSnapshot 结构一致。
	[INVOKE.snapshot]: async () => conversation,

	/* ── 设置：已可用 ─────────────────────────────────────────────── */

	[INVOKE.settingsSnapshot]: async () => (await getCatalog()).snapshot(activeModelKey),

	/* ── 技能 ─────────────────────────────────────────────────────── */

	[INVOKE.skillsSnapshot]: async () => ({ skills: listSkills(), userSkillsDir: userSkillsDir() }),

	[INVOKE.importSkill]: async ([sourcePath]) => importSkill(sourcePath as string),

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
		const { text, whileStreaming, images } = request as PromptRequest;

		// 内置命令（/new、/compact）是操作不是消息：发给模型没有意义，
		// 在进会话之前拦下来执行（解析规则见 shared/builtin-commands.ts）。
		const command = parseBuiltinCommand(text.trim());
		if (command !== undefined) {
			if (command.name === "new") {
				await newTask();
				return;
			}
			// compact：pi 会先中断当前操作且不续跑，流式期间明确拒绝比被中断好。
			if (conversation.state.isStreaming)
				throw new Error("任务进行中，请先停止当前任务再压缩上下文");
			if (hostPromise === undefined)
				throw new Error("还没有会话，没有可压缩的上下文");
			await (await hostPromise).compact(command.args === "" ? undefined : command.args);
			return;
		}

		const host = await getHost();
		await host.prompt(text, whileStreaming, images);
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
	[INVOKE.newTask]: async () => newTask(),

	/* ── 历史会话 ─────────────────────────────────────────────────── */

	[INVOKE.sessionList]: async () => listSessions(),

	[INVOKE.sessionResume]: async ([path]) => resumeSession(path as string),

	[INVOKE.sessionRename]: async ([path, name]) => {
		const target = path as string;
		const trimmed = (name as string).trim();
		if (trimmed === "") throw new Error("名称不能为空");

		// 当前活动会话必须走活实例：pi 的 SessionManager 各自缓存 entries，
		// 同一文件出现两个活写者会互相覆盖。
		const host = hostPromise === undefined ? undefined : await hostPromise;
		const currentFile = host?.sessionFilePath;
		if (host !== undefined && currentFile !== undefined && resolve(currentFile) === resolve(target)) {
			host.renameSession(trimmed);
			return;
		}

		const pathError = validateSessionFilePath(target, getSessionsDir());
		if (pathError !== undefined) throw new Error(pathError);

		// 非当前会话：临时 open 写完即弃。实例不持有、不注册到任何地方 ——
		// 它若日后成为活会话，会经 resume 重新 open，不存在双写者窗口。
		SessionManager.open(target, getSessionsDir()).appendSessionInfo(trimmed);
	},

	[INVOKE.sessionDelete]: async ([path]) => {
		const target = path as string;

		// 当前活动会话拒删：宿主还持有这个文件的活写者，删掉后续写会失败，
		// 且用户正在看的对话会变成一个打不开的历史项。
		const host = hostPromise === undefined ? undefined : await hostPromise;
		const currentFile = host?.sessionFilePath;
		if (currentFile !== undefined && resolve(currentFile) === resolve(target)) {
			throw new Error("这是当前任务，请先新建任务再删除");
		}

		const pathError = validateSessionFilePath(target, getSessionsDir());
		if (pathError !== undefined) throw new Error(pathError);

		// 移入 trash 而不是真删：可人工找回，对齐 pi 避免永久删除的取向。
		// 时间戳前缀防同名覆盖（同一会话删两次、不同会话同文件名）。
		const trashDir = join(getConfigDir(), "trash");
		mkdirSync(trashDir, { recursive: true });
		renameSync(target, join(trashDir, `${Date.now()}-${basename(target)}`));
	},

	[INVOKE.sessionExport]: async ([path]) => {
		const target = path as string;

		// 与 resume / rename / delete 同一道防线：path 来自 renderer，不可信。
		const pathError = validateSessionFilePath(target, getSessionsDir());
		if (pathError !== undefined) throw new Error(pathError);

		/*
		 * 目标是历史会话时「先恢复再导出」：pi 的导出能力只挂在活会话上
		 * （AgentSession.exportToHtml），独立入口 exportFromFile 没有从包根
		 * 导出（深引内部路径实测 ERR_PACKAGE_PATH_NOT_EXPORTED），包根导出
		 * 面下这是唯一正路。直接复用 resumeSession 而不复制它的逻辑 ——
		 * 流式守卫、open+header 校验、失败原子性（验证全在 dispose 旧宿主
		 * 之前）都随之生效；resume 失败则导出中止，错误原样上抛。
		 */
		const currentFile = await currentSessionFile();
		if (currentFile === undefined || resolve(currentFile) !== resolve(target)) {
			await resumeSession(target);
		}

		// 此处目标必为当前会话：原本就是，或 resume 刚切过去（成功必设
		// hostPromise）。这个分支现实中不可达，但 hostPromise 的类型需要
		// 窄化；真走到就说明 resume 的语义变了 —— 响亮失败，不静默兜底。
		if (hostPromise === undefined) {
			throw new Error("还没有会话，没有可导出的内容");
		}
		const host = await hostPromise;

		/*
		 * 输出固定落默认根的 exports/（getWorkspaceDir()，不是当前工作区）：
		 * playground 会话没有工作区，落在工作区下这部分会话就没有导出落点；
		 * 用户也总能在一个固定地方找到自己的导出物，不用记「当时用的哪个
		 * 工作区」（core/session-export.ts 文件头是同一决策）。
		 */
		const exportsDir = join(getWorkspaceDir(), "exports");
		mkdirSync(exportsDir, { recursive: true });

		// 文件名标题与会话列表同口径（命名 ?? 首条消息截断）。列表里查不到
		// 时回退会话 id —— 刚恢复的会话列表理应含它，回退只为不留裸时间戳。
		const resolvedTarget = resolve(target);
		const summary = (await listSessions()).find((s) => resolve(s.path) === resolvedTarget);
		const title = summary?.title ?? conversation.state.sessionId;

		const outputPath = buildExportPath(exportsDir, title, new Date());
		// 空会话的「该会话还没有内容可导出」由 exportHtml 抛出，自然上抛给 UI。
		await host.exportHtml(outputPath);
		return { outputPath };
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
		// 读改写：偏好文件里还有别的键（如联网搜索），整存覆盖会清掉它们。
		writePreferences({ ...readPreferences(), activeModelKey: key });

		if (hostPromise !== undefined) await (await hostPromise).setModel(key);
		else updateStateLocally({ modelId: key });
	},

	/* ── 联网搜索配置 ───────────────────────────────────────────────── */

	[INVOKE.getWebSearchConfig]: async (): Promise<WebSearchConfigInfo> => {
		const webSearch = readPreferences().webSearch;
		if (webSearch === undefined) return { providerId: undefined, hasKey: false };
		const providerId = isWebSearchProviderId(webSearch.providerId)
			? webSearch.providerId
			: undefined;
		return { providerId, hasKey: webSearch.apiKey !== "" };
	},

	[INVOKE.setWebSearchConfig]: async ([input]) => {
		const config = input as WebSearchConfigInput;
		// 与自定义服务商同样的双端校验：设置页即时校验 + 这里防绕过。
		if (!isWebSearchProviderId(config.providerId)) {
			throw new Error(`未知的搜索服务商：${config.providerId}`);
		}
		if (config.apiKey.trim() === "") {
			throw new Error("API Key 不能为空");
		}
		writePreferences({
			...readPreferences(),
			webSearch: { providerId: config.providerId, apiKey: config.apiKey.trim() },
		});
	},

	[INVOKE.clearWebSearchConfig]: async () => {
		const { webSearch: _dropped, ...rest } = readPreferences();
		writePreferences(rest);
	},

	[INVOKE.testWebSearch]: async (): Promise<WebSearchTestResult> => {
		const webSearch = readPreferences().webSearch;
		if (
			webSearch === undefined ||
			!isWebSearchProviderId(webSearch.providerId) ||
			webSearch.apiKey.trim() === ""
		) {
			return { ok: false, message: "尚未配置搜索服务商与 API Key，请先保存配置" };
		}
		// 真实搜索一次：返回码/额度/网络问题在这里全部现形，
		// 用户不用猜测「key 存上了没、服务商通没通」。
		// 外层再叠一层硬超时：Windows 的 DNS 解析不可中断（libuv GetAddrInfoW，
		// nodejs/node#46549），AbortSignal.timeout 在 DNS 卡死时停了它，
		// fetch 会无限挂起 —— 测试按钮必须**永远**有返回，不能一直转圈。
		try {
			const results = await withHardTimeout(
				searchWeb(
					{ providerId: webSearch.providerId, apiKey: webSearch.apiKey },
					"KamiBuddy 联网测试",
					{ limit: 2 },
				),
				15_000,
			);
			return {
				ok: true,
				message: `连接成功，返回 ${results.length} 条结果`,
				count: results.length,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			// 超时大概率是「服务商在国内网络不可达」，把选项告诉用户而不是让他猜。
			const hint = message.includes("超时")
				? "（Tavily 等海外服务在国内网络下常无法连接，建议换「博查」）"
				: "";
			return { ok: false, message: `${message}${hint}` };
		}
	},

	/* ── 权限设置 ───────────────────────────────────────────────────── */

	[INVOKE.getPermissions]: async (): Promise<PermissionInfo> =>
		buildPermissionInfo(activePermissions),

	[INVOKE.setPermissions]: async ([input]): Promise<PermissionInfo> => {
		const candidate = input as PermissionSettings;
		// 双端校验（同自定义服务商 / 联网搜索的做法）：设置页即时校验 + 这里防绕过。
		if (!isSandboxMode(candidate.sandbox)) {
			throw new Error(`未知的权限范围：${String(candidate.sandbox)}`);
		}
		if (!isApprovalPolicy(candidate.approval)) {
			throw new Error(`未知的审批策略：${String(candidate.approval)}`);
		}
		/*
		 * presetId 由旋钮反算，**不信任前端传来的值** ——
		 * 旋钮是真相（dsh 的 permission-presets 同一分工），
		 * 若前端传了个对不上的 id，界面就会显示成另一档，等于骗用户。
		 */
		const settings: PermissionSettings = {
			sandbox: candidate.sandbox,
			approval: candidate.approval,
			presetId: presetIdFor(candidate.sandbox, candidate.approval),
		};
		activePermissions = settings;
		// 读改写：偏好文件里还有模型选择与联网搜索配置，整存会清掉它们。
		writePreferences({ ...readPreferences(), permissions: settings });
		return buildPermissionInfo(settings);
	},

	/* ── 输入框补全数据源（@ 文件 + / 命令） ────────────────────────── */

	[INVOKE.completions]: async () => ({
		// playground（workspaceDir 为 undefined）没有可引用的目录，文件列表为空。
		files: workspaceDir === undefined ? [] : indexFiles(workspaceDir),
		commands: [
			// 技能：/skill:name 由 pi 的 prompt 自动展开（_expandSkillCommand），
			// renderer 只需把名字补全出来，原样传给 session.prompt 即可。
			...listSkills().map((s) => ({
				name: `skill:${s.name}`,
				description: s.description,
				source: "skill" as const,
			})),
			// 提示词模板：/模板名 由 pi 的 expandPromptTemplate 展开。
			// 发现目录必须与会话实际生效的一致 —— cwd 镜像 SessionHost 的取值
			//（playground 时用配置目录下的 playground/ 占位，见 session-host.ts）。
			...listPromptTemplates(
				workspaceDir ?? join(getConfigDir(), "playground"),
				getConfigDir(),
			).map((t) => ({
				name: t.name,
				description: t.description,
				source: "template" as const,
			})),
			// 自有命令：daemon 在 INVOKE.prompt 里拦截执行（不经 pi），
			// 解析规则见 shared/builtin-commands.ts —— 两边必须一致。
			{ name: "new", description: "新建任务", source: "builtin" as const },
			{ name: "compact", description: "压缩上下文：总结历史，释放窗口", source: "builtin" as const },
		],
	}),

	/* ── 工作空间 ───────────────────────────────────────────────────── */

	[INVOKE.workspaceSnapshot]: async () => ({
		current: workspaceDir,
		defaultRoot: getWorkspaceDir(),
		workspaces: listWorkspaces(getWorkspaceDir()),
		previewBaseUrl: previewServer.baseUrl,
	}),

	[INVOKE.createWorkspace]: async ([name]) =>
		applyWorkspace(createWorkspace(getWorkspaceDir(), name as string)),

	[INVOKE.setWorkspace]: async ([path]) => applyWorkspace(path as string),

	/* ── 产物 ─────────────────────────────────────────────────────── */

	// 预览面板的文本读取。HTML 预览不走这里（走静态服务），这里管文本类。
	[INVOKE.readArtifact]: async ([path]) => readArtifactContent(path as string),

	/* ── 权限审批回程 ─────────────────────────────────────────────── */

	[INVOKE.permissionResponse]: async ([response]) => {
		const answer = response as PermissionResponse;
		const resolve = pendingApprovals.get(answer.id);
		// 找不到通常是重复应答（用户连点两下）。静默忽略即可，不是错误 ——
		// 也不落审计日志：那不是一次真实的选择，记上只会污染事后还原。
		if (resolve === undefined) return;
		pendingApprovals.delete(answer.id);
		// 以用户实际作出选择的位置为准落日志（而非 resolve 包装）：
		// 审计要的是「用户批了什么」，重复应答与悬空 id 都不算选择。
		eventLog.append({
			kind: "permission_response",
			id: answer.id,
			decision: answer.decision,
			remember: answer.remember === true,
		});
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
