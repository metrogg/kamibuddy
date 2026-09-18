/**
 * model-guide：首页引导条判据的单测。
 *
 * 这条判据必须与 daemon 的权威判定同结论（`daemon/index.ts` 的 createHost：
 * 未选模型 / 选中但不可用 两个分支），否则会出现「界面说没问题、一发就报错」。
 * 所以三态都要钉住，尤其是**第三态**（available 非空但当前模型不可用）——
 * 它是只看 `modelId === undefined` 时会漏掉的那一态。
 */

import { describe, expect, it } from "vitest";
import type { ModelInfo } from "@shared/settings.ts";
import { judgeModelReadiness } from "./model-guide.tsx";

/** 只填判据用得到的字段，其余给稳定缺省（同 session-groups.test 的 summary 惯例）。 */
function model(providerId: string, id: string, available: boolean): ModelInfo {
	return {
		providerId,
		id,
		name: id,
		contextWindow: 128_000,
		maxTokens: 32_768,
		reasoning: false,
		vision: false,
		available,
	};
}

const CONFIGURED = [model("jlc-glm", "glm-5.3", true), model("jlc-glm", "kimi-k2.7-code", true)];
const NO_CREDENTIAL = [model("jlc-glm", "glm-5.3", false), model("deepseek", "deepseek-v4-pro", false)];

describe("judgeModelReadiness", () => {
	it("一个配了凭据的服务商都没有 → no-model-at-all（去填 API Key）", () => {
		expect(judgeModelReadiness(undefined, NO_CREDENTIAL)).toEqual({ kind: "no-model-at-all" });
		// 目录里连模型都没有（全新机器）也是同一态。
		expect(judgeModelReadiness(undefined, [])).toEqual({ kind: "no-model-at-all" });
	});

	it("有可用模型但没选 → model-not-usable（去选一个）", () => {
		expect(judgeModelReadiness(undefined, CONFIGURED)).toEqual({ kind: "model-not-usable" });
		expect(judgeModelReadiness("", CONFIGURED)).toEqual({ kind: "model-not-usable" });
	});

	it("选了可用模型 → ready（引导条不渲染）", () => {
		expect(judgeModelReadiness("jlc-glm/glm-5.3", CONFIGURED)).toEqual({ kind: "ready" });
	});

	it("**选了但该模型不可用** → model-not-usable（只看 modelId===undefined 会漏掉这一态）", () => {
		// 场景：用户选了 glm-5.3，之后在设置里删掉了 jlc-glm 的 Key。
		// modelId 仍在（activeModelId 不会因删 Key 而清空），但它已不在 available 里。
		const afterKeyRemoved = [model("jlc-glm", "glm-5.3", false), model("deepseek", "deepseek-v4-pro", true)];
		expect(judgeModelReadiness("jlc-glm/glm-5.3", afterKeyRemoved)).toEqual({
			kind: "model-not-usable",
		});
	});

	it("选了目录里根本不存在的模型 → model-not-usable", () => {
		expect(judgeModelReadiness("jlc-glm/从未存在过", CONFIGURED)).toEqual({
			kind: "model-not-usable",
		});
	});

	it("provider 前缀必须整体匹配（不把同名模型在别家的条目算作已选）", () => {
		// 同名 id 在别家可用，但用户选的是 jlc-glm 那家 —— 不能因「id 相同」判 ready。
		const sameNameElsewhere = [model("openrouter", "glm-5.3", true)];
		expect(judgeModelReadiness("jlc-glm/glm-5.3", sameNameElsewhere)).toEqual({
			kind: "model-not-usable",
		});
	});
});