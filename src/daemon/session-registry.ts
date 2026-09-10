/**
 * 会话注册表（纯逻辑）：多任务并发的核心数据结构。
 *
 * 本模块刻意不 import pi / core —— 注册表键的选择、互斥链、回收策略都是
 * 纯数据逻辑，抽出来才能脱离 Electron 与 pi 单测（index.ts 只做接线）。
 *
 * 三个关键设计：
 *
 * 1. **注册表键 = sessionId（不是 sessionFilePath）。**
 *    pi 在 SessionManager 构造时即分配 sessionId：create → newSession() 里
 *    createSessionId()，open → 读 header.id（pi session-manager.ts），
 *    都在第一条消息之前。所以宿主建好的那一刻 sessionId 就有真值、且终身
 *    不变，不存在「resume 的会话发消息前 id 未定」的窗口。
 *    「同一 session 文件任意时刻最多一个活宿主」（pi 的 SessionManager
 *    各自缓存 entries，同文件两个活写者会互相覆盖）由两层守住：
 *    文件名内嵌 sessionId（`<时间戳>_<sessionId>.jsonl`），id 唯一即文件唯一；
 *    resume 入口先按文件路径查注册表，命中直接复用桶、不再 open 第二个宿主。
 *
 * 2. **同会话写操作走 per-session promise 链（enqueue），跨会话不互斥。**
 *    prompt 在链上是「整段 run」——handler await host.prompt() 到 agent 循环
 *    收尾，所以排在后面的 compact / saveToWorkspace 执行时上一个 run 必然
 *    已结束，不存在「旧 run 未停新 run 已起」。
 *    abort 不进链：它是信号不是写操作，排在 prompt 后面会让停止键失效
 *    （run 不停、abort 永远轮不到执行）。abort 直接调宿主 —— pi 的 abort
 *    本就设计为 run 进行中从外部调用。
 *
 * 3. **空闲宿主 LRU 回收。** 活宿主占内存（上下文、工具状态、订阅），
 *    不设上限会让「开过的任务」无限堆积。回收只动空闲桶：running /
 *    有待答审批 / 当前会话豁免；被回收的会话历史在 JSONL，resume 可完整
 *    重开，用户无感。
 */

import type { ConversationView } from "../shared/conversation.ts";

/**
 * 保留的空闲宿主上限。WorkBuddy D2 同值（其会话池默认保 5 个空闲）。
 * 只数空闲桶：running / 审批待答 / 当前会话不算在内、也不被回收。
 */
export const MAX_IDLE_HOSTS = 5;

/**
 * 一个会话的全部 daemon 侧状态。
 *
 * 泛型 THost 让本模块不依赖 core 的 SessionHost（测试里用桩宿主）。
 * 字段全部可变：桶是长期持有的状态容器，不可变更新只会制造无谓的替换样板。
 */
export interface SessionBucket<THost> {
	/**
	 * 宿主 promise。沿用旧 hostPromise 的缓存语义：同一会话只建一次，
	 * 并发取宿主拿到同一个 promise；创建失败清回 undefined 允许重试。
	 * undefined = 全新任务还没发过消息（ pristine 桶，不占任何 pi 资源）。
	 */
	hostPromise: Promise<THost> | undefined;
	/**
	 * 注册表键。宿主建好前为 ""（ pristine 桶不进注册表 Map，
	 * 只被 currentBucket 指针持有）；建好后立即赋真值并入表。
	 */
	sessionId: string;
	/**
	 * 宿主持有的会话文件绝对路径（host.sessionFilePath 的镜像）。
	 * resume 按它查表守「同文件单写者」；listSessions 按它标 current/running。
	 */
	sessionFilePath: string | undefined;
	/** 本会话折叠的 ConversationView（与 renderer 同一份 reducer，事件按桶折叠）。 */
	conversation: ConversationView;
	/** 会话工作目录。终身绑定（cwd 在建会话时一次性注入工具集），saveToWorkspace 换绑是唯一的写点。 */
	cwd: string;
	/** 是否有正在进行的 run（run_started / run_finished / 折叠后的 isStreaming 维护）。 */
	running: boolean;
	/** 该会话在途的权限审批数。>0 时豁免回收 —— 用户在答的框不能随宿主一起消失。 */
	pendingApprovals: number;
	/** 互斥链上的在途操作数。>0 时豁免回收（排队中的操作不能丢失）。 */
	pendingOps: number;
	/** 互斥链尾指针。只记「上一棒何时结束」，不带值不带错（见 enqueue）。 */
	tail: Promise<unknown>;
	/** 最近使用时间（epoch ms）。LRU 回收按它挑最旧的空闲桶。 */
	lastUsedAt: number;
	/** /plan 进出开关的模式记忆。每会话一份 —— A 会话的 /plan 不该切回 B 会话记下的模式。 */
	lastNonPlanInteraction: string;
	/** 最近一次组装的系统提示词 token 估算（compose 时更新），上下文成分统计用。 */
	systemPromptTokens: number;
	/** 最近一次组装的技能段 token 估算（compose 时更新），上下文用量明细拆分类用。 */
	skillsTokens: number;
}

export interface CreateBucketOptions {
	readonly cwd: string;
	readonly conversation: ConversationView;
}

/** 开一个新桶（ pristine：无宿主、sessionId 未定，首次 prompt 时才建宿主）。 */
export function createBucket<THost>(options: CreateBucketOptions): SessionBucket<THost> {
	return {
		hostPromise: undefined,
		sessionId: "",
		sessionFilePath: undefined,
		conversation: options.conversation,
		cwd: options.cwd,
		running: false,
		pendingApprovals: 0,
		pendingOps: 0,
		tail: Promise.resolve(),
		lastUsedAt: Date.now(),
		lastNonPlanInteraction: "craft",
		systemPromptTokens: 0,
		skillsTokens: 0,
	};
}

/**
 * 把操作排进桶的互斥链：同桶严格按到达顺序串行，不同桶互不阻塞。
 *
 * 上一棒失败不阻塞后续（tail 只记 settle 不记成败）——一个失败的操作
 * 不该让该会话后续所有操作永久卡住。
 * pendingOps 由这里维护：回收策略据此豁免「链上还有活」的桶。
 */
export function enqueue<THost, T>(
	bucket: SessionBucket<THost>,
	op: () => Promise<T>,
): Promise<T> {
	bucket.pendingOps += 1;
	const run = bucket.tail.then(op, op);
	bucket.tail = run.finally(() => {
		bucket.pendingOps -= 1;
	});
	return run;
}

/**
 * 挑出本轮应回收的桶（只挑不动手 —— dispose 涉及具体宿主类型，归接线方）。
 *
 * 豁免规则（缺一不可回收）：
 *   - running：后台 run 正在写会话文件，dispose 等于杀任务；
 *   - pendingApprovals > 0：审批框还悬在用户屏幕上，宿主没了答覆无人接收；
 *   - pendingOps > 0：互斥链上还有排队/在途操作；
 *   - 当前会话：用户正在看的会话不能凭空消失；
 *   - 无宿主（ pristine）：不占 pi 资源，没有可回收的东西。
 *
 * 在豁免之后的空闲桶里保 maxIdle 个最近使用的，其余按 lastUsedAt 最旧优先回收。
 */
export function pickEvictions<THost>(
	buckets: Iterable<SessionBucket<THost>>,
	current: SessionBucket<THost>,
	maxIdle: number = MAX_IDLE_HOSTS,
): SessionBucket<THost>[] {
	const idle: SessionBucket<THost>[] = [];
	for (const bucket of buckets) {
		if (bucket === current) continue;
		if (bucket.hostPromise === undefined) continue;
		if (bucket.running || bucket.pendingApprovals > 0 || bucket.pendingOps > 0) continue;
		idle.push(bucket);
	}
	if (idle.length <= maxIdle) return [];
	idle.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
	return idle.slice(0, idle.length - maxIdle);
}
