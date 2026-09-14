/**
 * 设置「提示词预览」分组（自原平铺页原样搬入）。
 */

import { useEffect, useRef, useState } from "react";
import type { StyleConfigInfo } from "@shared/settings.ts";
import type { ModeDescriptor } from "@shared/session-events.ts";
import type { PromptPreviewResult } from "@shared/ipc.ts";
import { IconChevronRight, IconRefresh } from "../icons.tsx";
import { SelectField } from "./select-field.tsx";

/**
 * 风格选择器里「跟随当前设置」的哨兵值 —— 不能复用空串（空串已被「关闭」占用），
 * 也不能是任何真实风格 id（与文件名同字符集，下划线开头撞不上）。
 */
const FOLLOW_CURRENT_STYLE = "__follow__";

/**
 * 分段来源标签的着色类别：source 形如 fragment:delivery-rules / mode:craft，
 * 取「:」前的类别名，对应 index.css 的 seg-<类别> 色块类。
 */
function sourceCategory(source: string): string {
	return source.split(":", 1)[0] ?? source;
}

/**
 * 提示词预览（spec: systematize-prompt-architecture Task 5）。
 *
 * 三路数据源：场景/模式清单借会话快照的 availableScenes/availableModes
 * （资源清单是全局的，快照是既有透出通道，不为预览单开一条清单契约）；
 * 风格清单与当前值走 getStyle；组装结果走 prompt:preview（daemon 现场组装，
 * 不需要活会话）。选择器任一变化自动重新请求；竞态用序号守门，
 * 慢响应落地时不覆盖更新的选择。
 *
 * 预览与真实会话的差异（pi 上下文段、专家人格段不出现）在页脚如实说明，
 * 不让用户对着预览排查「为什么真实提示词多了一段」。
 */
export function PromptPreviewSection(): React.JSX.Element {
	const [axes, setAxes] = useState<{
		readonly scenes: readonly ModeDescriptor[];
		readonly modes: readonly ModeDescriptor[];
	}>();
	const [styleConfig, setStyleConfig] = useState<StyleConfigInfo | undefined>(undefined);
	const [sceneId, setSceneId] = useState("");
	const [modeId, setModeId] = useState("");
	const [styleSel, setStyleSel] = useState(FOLLOW_CURRENT_STYLE);
	const [result, setResult] = useState<PromptPreviewResult | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);
	const [fullView, setFullView] = useState(false);
	const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
	/** 重新生成按钮的触发器：自增即让组装 effect 重跑（时间环境块随之刷新）。 */
	const [nonce, setNonce] = useState(0);
	const requestSeq = useRef(0);

	useEffect(() => {
		Promise.all([window.kami.snapshot(), window.kami.getStyle()])
			.then(([snapshot, style]) => {
				const scenes = snapshot.availableScenes.filter((s) => s.ready);
				const modes = snapshot.availableModes.filter((m) => m.ready);
				setAxes({ scenes, modes });
				setStyleConfig(style);
				// 初值跟随当前会话的两轴（预览「此刻的提示词」）；
				// 会话值不在可选清单里时（如 design 占位）回落到第一项。
				setSceneId(scenes.some((s) => s.id === snapshot.state.sceneId) ? snapshot.state.sceneId : (scenes[0]?.id ?? ""));
				setModeId(modes.some((m) => m.id === snapshot.state.interactionId) ? snapshot.state.interactionId : (modes[0]?.id ?? ""));
			})
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	}, []);

	useEffect(() => {
		if (sceneId === "" || modeId === "") return;
		const seq = ++requestSeq.current;
		// 哨兵值 → 缺省（跟随当前偏好）；「关闭」→ 空串，原样传给 daemon。
		const styleId = styleSel === FOLLOW_CURRENT_STYLE ? undefined : styleSel;
		window.kami
			.promptPreview({ sceneId, modeId, ...(styleId === undefined ? {} : { styleId }) })
			.then((preview) => {
				if (requestSeq.current !== seq) return;
				setResult(preview);
				setError(undefined);
				// 分段集合随三轴变化，旧展开下标可能指向另一段，折叠重来。
				setExpanded(new Set());
			})
			.catch((e: unknown) => {
				if (requestSeq.current !== seq) return;
				setResult(undefined);
				setError(e instanceof Error ? e.message : String(e));
			});
	}, [sceneId, modeId, styleSel, nonce]);

	const toggleSegment = (index: number): void => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(index)) next.delete(index);
			else next.add(index);
			return next;
		});
	};

	const currentStyleLabel =
		styleConfig === undefined
			? ""
			: styleConfig.styleId === ""
				? "关闭"
				: (styleConfig.styles.find((s) => s.id === styleConfig.styleId)?.label ?? styleConfig.styleId);

	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>提示词预览</h2>
				{result !== undefined && <span className="provider-meta">共 {result.totalChars} 字</span>}
				<button
					type="button"
					className="mini-btn"
					disabled={sceneId === "" || modeId === ""}
					title="按当前选择重新组装（时间环境块随生成时刻刷新）"
					onClick={() => setNonce((n) => n + 1)}
				>
					<IconRefresh size={13} />
					重新生成
				</button>
			</header>

			{error !== undefined && <div className="settings-error">{error}</div>}

			{axes === undefined || styleConfig === undefined ? (
				<p className="settings-empty">正在读取提示词资源…</p>
			) : (
				<>
					<div className="preview-controls">
					<div className="preview-field">
						<span className="preview-field-label">场景</span>
						<SelectField
							ariaLabel="预览场景"
							value={sceneId}
							options={axes.scenes.map((scene) => ({ value: scene.id, label: scene.label }))}
							onChange={(value) => setSceneId(value)}
						/>
					</div>
					<div className="preview-field">
						<span className="preview-field-label">模式</span>
						<SelectField
							ariaLabel="预览模式"
							value={modeId}
							options={axes.modes.map((mode) => ({ value: mode.id, label: mode.label }))}
							onChange={(value) => setModeId(value)}
						/>
					</div>
					<div className="preview-field">
						<span className="preview-field-label">风格</span>
						<SelectField
							ariaLabel="预览风格"
							value={styleSel}
							options={[
								{ value: FOLLOW_CURRENT_STYLE, label: `跟随当前设置（${currentStyleLabel}）` },
								...styleConfig.styles.map((style) => ({ value: style.id, label: style.label })),
								{ value: "", label: "关闭" },
							]}
							onChange={(value) => setStyleSel(value)}
						/>
					</div>
						<span className="bar-spacer" />
						<button
							type="button"
							className={`mini-btn${fullView ? "" : " active"}`}
							onClick={() => setFullView(false)}
						>
							分段视图
						</button>
						<button
							type="button"
							className={`mini-btn${fullView ? " active" : ""}`}
							onClick={() => setFullView(true)}
						>
							完整文本
						</button>
					</div>

					{result === undefined ? (
						error === undefined && <p className="settings-empty">正在组装提示词…</p>
					) : fullView ? (
						<pre className="preview-full">{result.segments.map((s) => s.text).join("")}</pre>
					) : (
						<div className="preview-segments">
							{result.segments.map((seg, index) => (
								<div key={index} className="seg-card">
									<button type="button" className="seg-head" onClick={() => toggleSegment(index)}>
										<span className={`seg-tag seg-${sourceCategory(seg.source)}`}>{seg.source}</span>
										<span className="seg-chars">{seg.chars} 字</span>
										<span className={`seg-chevron${expanded.has(index) ? " open" : ""}`}>
											<IconChevronRight size={12} />
										</span>
									</button>
									{expanded.has(index) && <pre className="seg-body">{seg.text}</pre>}
								</div>
							))}
						</div>
					)}

					<p className="settings-foot">
						预览按所选三轴现场组装，与真实会话同一条组装路径；pi 上下文段（项目指令、工具提示）与
						expert 模式的专家人格段不在预览中出现，真实会话会额外携带。
					</p>
				</>
			)}
		</section>
	);
}
