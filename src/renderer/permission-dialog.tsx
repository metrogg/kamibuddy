/**
 * 权限审批弹窗。
 *
 * 为什么不用 pi 的 ctx.ui.confirm：那只能传标题与一段文本，
 * 而这里必须展示工具入参、风险等级、「本次会话记住」三样东西
 * —— 用户要靠它们判断该不该批。所以走自有 IPC 通道（shared/ipc.ts）。
 *
 * 这是**阻塞式**的：daemon 侧的工具执行正 await 在这条链路上，
 * 不作答工具就一直挂着。因此弹窗必须始终可作答，不能被其他 UI 盖住。
 */

import { useEffect, useRef, useState } from "react";
import type { PermissionRequest } from "@shared/ipc.ts";
import { firstTokenPrefix } from "@shared/permissions.ts";
import { IconChevronDown } from "./icons.tsx";

interface PermissionDialogProps {
	readonly request: PermissionRequest;
	readonly onDecide: (decision: "allow" | "deny", remember: boolean, rememberPrefix?: string) => void;
}

const RISK_TEXT: Readonly<Record<PermissionRequest["risk"], string>> = {
	low: "低风险",
	medium: "需要确认",
	high: "高风险",
};

export function PermissionDialog({ request, onDecide }: PermissionDialogProps): React.JSX.Element {
	const [remember, setRemember] = useState(false);
	const [rememberRule, setRememberRule] = useState(false);
	const [open, setOpen] = useState(false);
	const denyRef = useRef<HTMLButtonElement>(null);
	const allowRef = useRef<HTMLButtonElement>(null);

	// 高风险时默认焦点给「拒绝」：用户习惯性回车不应该批准一次危险操作。
	// 请求换了就重新聚焦（同一次会话里可能连续来几条）。
	useEffect(() => {
		const target = request.risk === "high" ? denyRef.current : allowRef.current;
		target?.focus();
		setRemember(false);
		setRememberRule(false);
		setOpen(false);
	}, [request.id, request.risk]);

	// Esc 视为拒绝 —— 安全侧默认。不提供「点遮罩关闭」，避免误触批准或悬空。
	useEffect(() => {
		const onKey = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				event.preventDefault();
				onDecide("deny", false);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onDecide]);

	const hasDetails = request.details !== "";

	/*
	 * 批准写回（spec: add-permission-rules-engine）：powershell 的**单段**命令
	 * 才提供「以后都允许「{首词}」开头的命令」。details 就是完整命令
	 * （permission-policy 的 SHELL 分支）；多段命令或解释器/内联脚本前缀
	 * （firstTokenPrefix 返回 undefined）不提供 —— 那种前缀代表不了命令行为，
	 * 写回等于把门钥匙交出去。daemon 侧还会用同一套校验复核回填值，
	 * 这里的判断只决定选项**显不显示**。
	 */
	const writeBackPrefix =
		request.toolName === "powershell" ? firstTokenPrefix(request.details) : undefined;

	/*
	 * 区外读的路径写回（spec: extend-permission-rules-to-paths Task 2）：
	 * 「目标在凭据/配置目录内不显示」需要禁区路径知识，renderer 拿不到 ——
	 * 由 daemon 侧（权限门）判定资格后才带上 writeBackPath，这里只做展示。
	 * 勾选允许后把原值回填进 rememberPrefix，daemon 回程会再复核一遍。
	 * 与上面 powershell 的首词写回天然互斥：同一请求的工具名只会命中一边。
	 */
	const writeBackPath = request.writeBackPath;

	return (
		<div className="modal-backdrop">
			<div
				className={`permission-card risk-${request.risk}`}
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="permission-summary"
			>
				<div className="permission-head">
					<span className={`permission-badge risk-${request.risk}`}>{RISK_TEXT[request.risk]}</span>
					<span className="permission-tool">{request.toolName}</span>
				</div>

				{/* summary 同时当可访问名：它是用户判断批不批的那句话，alertdialog 的名字理应就是它。 */}
				<p className="permission-summary" id="permission-summary">
					{request.summary}
				</p>

				{hasDetails && (
					<>
						<button type="button" className="permission-toggle" onClick={() => setOpen((v) => !v)}>
							<IconChevronDown size={12} className={open ? "tool-caret open" : "tool-caret"} />
							{open ? "收起详情" : "查看详情"}
						</button>
						{open && <pre className="permission-details">{request.details}</pre>}
						{/* 折叠态也给一行预览：多数情况一个路径就够判断了，不该逼用户多点一次。 */}
						{!open && <p className="permission-preview">{request.details}</p>}
					</>
				)}

				{/*
			 * 高风险不提供「本次会话记住」：shell 与写应用目录这类操作每次都问 ——
			 * 一次「永远允许」shell，等于把上面所有路径保护一次性烧穿
			 * （没有危险命令分类器时，一条命令就能 `type ~\.ssh\id_rsa`）。
			 * medium/low 保持可记住，否则连续写同目录文件会逐个弹窗，逼人放弃使用。
			 */}
			{request.risk !== "high" && (
			<label className="check permission-remember">
				<input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
				本次会话内不再询问同类操作
			</label>
		)}

			{/*
			 * 「以后都允许」与上面「本次会话记住」不冲突：powershell 询问一律高风险，
			 * 会话级记住本就不提供（上面的双保险）；这里是跨会话的持久前缀规则，
			 * 作用域与持久性都不同（spec 的 MODIFIED Requirement 写明了这个细化）。
			 */}
		{writeBackPrefix !== undefined && (
			<label className="check permission-remember">
				<input type="checkbox" checked={rememberRule} onChange={(e) => setRememberRule(e.target.checked)} />
				以后都允许「{writeBackPrefix}」开头的命令
			</label>
		)}

			{writeBackPath !== undefined && (
				<label className="check permission-remember">
					<input type="checkbox" checked={rememberRule} onChange={(e) => setRememberRule(e.target.checked)} />
					以后都允许读取此路径（及子目录）
				</label>
			)}

			<div className="permission-actions">
				<button ref={denyRef} type="button" className="mini-btn danger" onClick={() => onDecide("deny", false)}>
					拒绝
				</button>
				<button
					ref={allowRef}
					type="button"
					className="primary-btn"
					onClick={() =>
						// 两种写回天然互斥（见上方 writeBackPath 注释）：哪个存在就回填哪个。
						onDecide("allow", remember, rememberRule ? (writeBackPrefix ?? writeBackPath) : undefined)
					}
				>
					允许
				</button>
			</div>
			</div>
		</div>
	);
}
