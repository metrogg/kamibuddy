/**
 * 回归测试：回复输出完后 UI 卡在「正在思考…」（isStreaming 永远为 true）。
 *
 * 根因（pi 源码实证）：
 * - pi 的 `session.isStreaming` 返回 `_isAgentRunActive`，在 `_runAgentPrompt`
 *   开头置 true（agent-session.ts:1107），但置 false 发生在 finally 的
 *   `_emitAgentSettled()`（agent-session.ts:631/1113-1118）——
 *   那时 `agent_end` 早已分发给监听器。
 * - SessionHost 原先在 `state` 里直接透传这个值。`agent_end` 处理中的
 *   `emitState()` 于是把 `isStreaming:true` 的 session_state 推给 renderer，
 *   覆盖了 reducer 里 run_finished 刚置的 false，且之后没有任何事件再纠正。
 *
 * 本测试用「isStreaming 恒为 true 的假会话」模拟 pi 的滞后值：
 * 只要 SessionHost 还透传 pi 的 isStreaming，测试必红。
 */

import { describe, expect, it } from "vitest";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { SessionEvent } from "../shared/session-events.ts";
import type { ModelCatalog } from "./model-catalog.ts";
import { SessionHost, type SessionHostOptions } from "./session-host.ts";

type SessionStateEvent = Extract<SessionEvent, { type: "session_state" }>;

/** 最小假会话：只实现测试路径会碰到的成员。isStreaming 恒 true，模拟 pi 在 agent_end 时的滞后值。 */
function createFakeSession(): unknown {
	return {
		sessionId: "test-session",
		model: undefined,
		isStreaming: true,
		getContextUsage: () => undefined,
	};
}

/** 绕过私有构造器（TS private 只在编译期存在）；不碰 create() 里的真实 pi 装配。 */
function createHost(session: unknown, emit: (event: SessionEvent) => void): SessionHost {
	const options: SessionHostOptions = {
		catalog: {} as unknown as ModelCatalog,
		modelKey: undefined,
		cwd: "C:\\test",
		sceneId: "work",
		interactionId: "craft",
		emit,
	};
	const Ctor = SessionHost as unknown as new (
		session: unknown,
		options: SessionHostOptions,
		sceneId: string,
		interactionId: string,
	) => SessionHost;
	return new Ctor(session, options, "work", "craft");
}

/** translate 是私有的；测试经事件入口驱动，而不是戳内部状态。 */
function translate(host: SessionHost, event: AgentSessionEvent): void {
	(host as unknown as { translate(e: AgentSessionEvent): void }).translate(event);
}

describe("agent_end 后的流式状态", () => {
	it("agent_end 之后 isStreaming 必须为 false（pi 的 isStreaming 此刻仍是滞后的 true）", () => {
		const events: SessionEvent[] = [];
		const host = createHost(createFakeSession(), (e) => events.push(e));

		translate(host, { type: "agent_start" } as unknown as AgentSessionEvent);
		translate(host, { type: "agent_end", messages: [], willRetry: false } as unknown as AgentSessionEvent);

		// renderer 实际消费的是 session_state 事件里的值
		const pushed = events
			.filter((e): e is SessionStateEvent => e.type === "session_state")
			.map((e) => e.state.isStreaming);
		expect(pushed.at(-1)).toBe(false);
		expect(host.state.isStreaming).toBe(false);
	});
});
