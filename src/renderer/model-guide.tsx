/**
 * 首页「还不能开始对话」引导条（spec: 首页引导）。
 *
 * ## 为什么要它
 *
 * 产品经理反馈「首页面缺少引导，用户可能不知道要先配置模型」。核到的根因**不是
 * 没有引导**，而是引导**藏在收起的模型菜单里** —— `model-menu.tsx` 里本来就有
 * 一句 `EmptyState「还没有可用模型」+「去设置里填 API Key →」`，但用户得先点开
 * 那个写着「选择模型」的淡色 chip 才看得见，而他没理由去点。用户的实际体验是：
 * 打完字按发送，才吃到 daemon 的报错（`daemon/index.ts` 的 createHost：
 * 「还没有选择模型。请点左下角设置，为任一服务商填写 API Key 并选择模型。」）。
 *
 * `DESIGN.md` §6 的已知缺口表里也早就写着「**消息流**：空会话全白无引导」。
 * 本条补的就是它 —— 把已经写好的那句话从菜单里提到首屏。
 *
 * ## 判据与 daemon 的权威判定同源（重要）
 *
 * 不复用 `createHost` 那两行字面量、而是复现它的**两个分支**（`modelId` 未选 /
 * 选了但不可用），因为渲染层没有别的途径知道「能不能跑」。两处判据必须同结论，
 * 否则会出现「界面说没问题、一发就报错」。具体：
 *
 *   canRun = modelId 已选 && 该模型出现在 available 里
 *
 * `available` = `snapshot.models.filter(m => m.available)` —— 与 `model-menu.tsx`
 * 同一口径（只列配了凭据的模型），`available` 由 daemon 的 `catalog.isUsable`
 * 派生，所以这里判的就是 daemon 判的那件事。
 *
 * 两态文案分开，因为用户的下一步动作不同：
 *   - `available` 为空 → 一个能用的模型都没有 → 去**填 API Key**（落设置「模型」页）
 *   - `available` 非空但当前不可用 → 有得选，只是没选/选的失效了 → 去**选一个**
 *
 * ## 为什么不是模态弹窗
 *
 * 没有模型并不妨碍逛专家 / 技能 / 连接器 / 自动化 —— 首启甩一个模态框挡在门口，
 * 会把「先看看这是什么」的用户赶走。所以做成输入卡上方的常驻条：显眼、可点、
 * 不挡路；配好模型后自动消失（判据不成立即不渲染），不需要「不再提示」这类状态。
 *
 * ## 数据怎么刷新
 *
 * **没有 settings 推送通道**（`PUSH.*settings` 查无此项），所以不能靠订阅。
 * 但设置页与首页是互斥的 view（App 里 `view === "settings"` / `view === "home"`），
 * 首页在打开设置时**会卸载**、返回时**会重新挂载** —— 挂载时拉一次即可拿到
 * 最新的凭据状态，用户配完 Key 回来引导条就没了。这也是 `model-menu.tsx`
 * 「展开时重拉」的同一条思路（不信缓存）。
 */

import { useCallback, useEffect, useState } from "react";
import type { ModelInfo, SettingsSnapshot } from "@shared/settings.ts";
import { IconKey } from "./icons.tsx";

interface ModelGuideProps {
	/** 当前模型标识（`provider/model`，与 modelId 同一数据源）。 */
	readonly modelId: string | undefined;
	/** 「去配置」：带着深链目标打开设置（详见 SettingsView 的 initialPage）。 */
	readonly onOpenSettings: (page: "models") => void;
}

/** 判据的纯函数形态：能不能开跑，以及不能跑时属于哪一种。
 *  抽出来是为了可单测 —— 埋在组件里就只能靠人眼验收（同 session-groups /
 *  send-anchor 的惯例）。 */
export type ModelReadiness =
	| { readonly kind: "ready" }
	| { readonly kind: "no-model-at-all" }
	| { readonly kind: "model-not-usable" };

export function judgeModelReadiness(
	modelId: string | undefined,
	models: readonly ModelInfo[],
): ModelReadiness {
	const available = models.filter((model) => model.available);
	if (available.length === 0) return { kind: "no-model-at-all" };
	const usable = available.some((model) => `${model.providerId}/${model.id}` === modelId);
	return usable ? { kind: "ready" } : { kind: "model-not-usable" };
}

/** 两态文案。措辞与 model-menu 里那句保持一致（「还没有可用模型」/「去设置里填 API Key」）。 */
function guideText(readiness: ModelReadiness): { title: string; action: string } {
	if (readiness.kind === "no-model-at-all") {
		return { title: "还没有可用模型，现在还不能开始对话", action: "去设置里填 API Key" };
	}
	return { title: "还没有选定要用哪个模型", action: "去选一个模型" };
}

export function ModelGuide({ modelId, onOpenSettings }: ModelGuideProps): React.JSX.Element | null {
	const [snapshot, setSnapshot] = useState<SettingsSnapshot | undefined>(undefined);
	/** 拉取失败就地呈现（DESIGN.md §6：可重试的失败不用 toast）。undefined = 没失败。 */
	const [error, setError] = useState<string | undefined>(undefined);

	const load = useCallback((): void => {
		setError(undefined);
		window.kami
			.settingsSnapshot()
			.then(setSnapshot)
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	/*
	 * 快照没回来 / 拉失败时**一律不渲染**。
	 *
	 * 这是有意的取舍，且方向与 DESIGN.md §6「加载与空必须分开」不冲突：
	 * 那条规范管的是「已进入某个视图、不要用长度零冒充加载中」，而这里是首页的
	 * **旁挂提醒** —— 它没有「加载态」这种存在形式（总不能先显示一条
	 * 「正在检查模型…」的提醒条），漏报的代价只是「晚一帧出现」，而误报的代价是
	 * 对着一个已经配好模型的用户喊「去填 API Key」。
	 * 失败也不单独渲染：错误本身会在点开模型菜单时就地呈现（model-menu 的 error 态）。
	 */
	if (error !== undefined || snapshot === undefined) return null;

	const readiness = judgeModelReadiness(modelId ?? snapshot.activeModelId, snapshot.models);
	if (readiness.kind === "ready") return null;

	const text = guideText(readiness);
	return (
		<div className="home-guide" role="status">
			<span className="home-guide-icon" aria-hidden="true">
				<IconKey size={15} />
			</span>
			<span className="home-guide-text">{text.title}</span>
			<button
				type="button"
				className="mini-btn"
				onClick={() => onOpenSettings("models")}
			>
				{text.action} →
			</button>
		</div>
	);
}