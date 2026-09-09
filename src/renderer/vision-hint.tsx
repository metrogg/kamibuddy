/**
 * 非视觉模型的附件提示（chat-view 与 home-view 输入区共用）。
 *
 * vision 数据源是已有的 settingsSnapshot IPC：模型目录自带 vision 标志
 * （shared/settings.ts ModelInfo），modelId 形如 `provider/model`，直接 join
 * 即得，不需要为此新增通道。判断结果三值：
 *   true    当前模型支持图片输入
 *   false   不支持 —— 附件非空时显示提示
 *   undefined 未知（未选模型、快照拉取失败、目录里没有该 id）——不提示，
 *             宁缺毋滥，不把未知当不支持误报
 */

import { useEffect, useState } from "react";

/** 当前模型是否支持图片输入。undefined = 未知（不提示）。 */
export function useModelSupportsVision(modelId: string | undefined): boolean | undefined {
	const [vision, setVision] = useState<boolean | undefined>(undefined);

	useEffect(() => {
		if (modelId === undefined) {
			setVision(undefined);
			return;
		}
		// StrictMode 下 effect 跑两遍，卸载后的异步回调必须能被丢弃。
		let disposed = false;
		window.kami
			.settingsSnapshot()
			.then((snapshot) => {
				if (disposed) return;
				// join 口径与 ModelMenu 一致：`${providerId}/${id}` 对 modelId。
				setVision(snapshot.models.find((m) => `${m.providerId}/${m.id}` === modelId)?.vision);
			})
			.catch(() => {
				// 拉不到目录不等于模型看不见图，静默按未知处理（不提示不误报）。
				if (!disposed) setVision(undefined);
			});
		return () => {
			disposed = true;
		};
	}, [modelId]);

	return vision;
}

/** 输入区的非视觉模型提示：模型看不了图、图片将以占位文本发送时的一行说明。 */
export function VisionHint({ visible }: { readonly visible: boolean }): React.JSX.Element | null {
	if (!visible) return null;
	return <div className="vision-hint">当前模型不支持看图，图片将以占位文本发送</div>;
}
