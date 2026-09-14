/**
 * 设置「关于」分组（新建，spec: rework-settings-layout Task 2）。
 *
 * 版本号走构建时注入（__KAMI_APP_VERSION__，见 electron.vite.config.ts）：
 * renderer 只认识 shared（AGENTS.md §1.3），没有可直读应用版本的 IPC 通道，
 * 为这一串数字单开一条契约不值得。
 */

interface AboutSectionProps {
	/** 凭据与自定义配置的落盘目录（原平铺页页脚信息，挪到关于页）；快照未读回时缺省不显示。 */
	readonly configDir: string | undefined;
	/** 诊断是独立 view，这里只给入口；跳转由 App 的 view 状态机处理。 */
	readonly onOpenDiagnostics: () => void;
}

export function AboutSection({ configDir, onOpenDiagnostics }: AboutSectionProps): React.JSX.Element {
	return (
		<section className="settings-section">
			<header className="settings-section-head">
				<h2>关于</h2>
			</header>

			<div className="provider-row">
				<div className="provider-main">
					<span className="provider-name">KamiBuddy</span>
					<span className="provider-meta">版本 {__KAMI_APP_VERSION__}</span>
				</div>
			</div>

			<div className="provider-row">
				<div className="provider-main">
					<span className="provider-name">诊断</span>
					<span className="provider-meta">用量、缓存命中率与各组件运行状态</span>
					<span className="bar-spacer" />
					<button type="button" className="mini-btn" onClick={onOpenDiagnostics}>
						打开诊断
					</button>
				</div>
			</div>

			{configDir !== undefined && <p className="settings-foot">配置目录：{configDir}</p>}
		</section>
	);
}
