/**
 * 运行时诊断：可复制报告 + 落盘日志。
 *
 * 报告要回答五个问题（spec Scenario: 环境损坏 / SubTask 1.2.2）：
 *   1. 你在用哪一版、哪个目录、走的哪条路径（托管根 / 覆盖口 / 复用旧路径）；
 *   2. 现在什么状态（四态：不存在 / 版本不符 / 缺依赖 / 就绪），缺的是哪一项；
 *   3. 盘上还有哪几版、哪些是上次中断留下的半成品；
 *   4. **最近一次失败原因**（来自落盘日志，不是现猜）；
 *   5. **可执行的下一步**（照着做就能修，包括「点重置」之外的手动兜底）。
 *
 * 日志落盘复用 core/event-log.ts（NDJSON + 按天分文件）—— 不另写一套日志格式
 * （AGENTS.md §4 防重复）：目录用 `<托管根>/<id>/`，一个运行时的日志与它的实例
 * 放在一起，用户按诊断报告里的路径就能直接翻。
 *
 * 与 registry 的关系：本文件只 import **类型**（`import type`，运行时擦除），
 * registry 才 import 本文件的写日志函数 —— 不是运行时循环依赖。
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { EventLog } from "../event-log.ts";
import { runtimeHome, listInstances, listStaging, readCurrent } from "../runtime-store.ts";
import type { SpawnFn } from "../../documents/docx-env.ts";
import type { RuntimeDescriptor, RuntimeInspectResult, RuntimeSource } from "./registry.ts";

/**
 * 落盘日志的一条记录。`outcome` 让「最近一次失败」能机械地挑出来。
 * 2026-09-18 加 `warning`：按需下载里有些实情不致命但必须留痕（如「官方校验文件没取到，
 * 本次仅按代码内固定 sha256 校验」）；把它记成 `failed` 会让一次成功的安装在界面上
 * 显示成「安装失败」——`readLastRuntimeFailure` 只认 `failed`，这条区分是刻意的。
 */
export interface RuntimeLogEvent {
	readonly kind: "runtime_install" | "runtime_reset" | "runtime_ensure" | "runtime_rollback";
	readonly outcome: "installed" | "started" | "published" | "warning" | "failed";
	readonly phase?: string;
	readonly error?: string;
	readonly source?: RuntimeSource;
	readonly version?: string;
}

/** 日志操作只需要 id 与托管根：不依赖注册表的其余部分。 */
export interface RuntimeLogTarget {
	readonly id: string;
	readonly options: { readonly root: string };
}

/** 运行时的日志目录（`<托管根>/<id>/`）。 */
export function runtimeLogDir(target: RuntimeLogTarget): string {
	return runtimeHome(target.options.root, target.id);
}

/** 追加一条运行时事件（同步写：崩溃前最后一条也在盘上，与 event-log 同一口径）。 */
export function appendRuntimeEvent(target: RuntimeLogTarget, event: RuntimeLogEvent): void {
	new EventLog(runtimeLogDir(target)).append({ ...event });
}

/**
 * 最近一次失败（跨全部日志文件从新到旧找）。
 * 只找 `outcome === "failed"` 的记录 —— 成功记录不参与，否则报告会说「最近一次失败：无」。
 */
export function readLastRuntimeFailure(target: RuntimeLogTarget): { phase: string; error: string } | undefined {
	const dir = runtimeLogDir(target);
	if (!existsSync(dir)) return undefined;
	const files = readdirSync(dir)
		.filter((name) => /^events-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name))
		.sort()
		.reverse();
	for (const name of files) {
		const lines = readFileSync(join(dir, name), "utf8").split("\n");
		for (let index = lines.length - 1; index >= 0; index -= 1) {
			const line = lines[index]?.trim() ?? "";
			if (line === "") continue;
			try {
				const parsed: unknown = JSON.parse(line);
				if (typeof parsed !== "object" || parsed === null) continue;
				const record = parsed as Record<string, unknown>;
				if (record["outcome"] !== "failed") continue;
				if (typeof record["kind"] !== "string" || !record["kind"].startsWith("runtime_")) continue;
				return {
					phase: typeof record["phase"] === "string" ? record["phase"] : "unknown",
					error: typeof record["error"] === "string" ? record["error"] : "（日志里没有记原因）",
				};
			} catch {
				// 断电可能截断最后一行：跳过坏行继续往上找，不因为一行读不出就丢掉整份日志。
				continue;
			}
		}
	}
	return undefined;
}

export interface RuntimeDiagnosticsReport {
	readonly id: string;
	readonly label: string;
	readonly version: string;
	readonly source: string;
	readonly status: RuntimeInspectResult;
	readonly resolutionSource: RuntimeSource;
	readonly resolutionDetail: string;
	readonly activeDir: string;
	readonly instanceDir: string;
	readonly currentVersion?: string;
	readonly instances: readonly { readonly version: string; readonly complete: boolean }[];
	/** 上次中断留下的半成品目录名（非空 ⇒ 报告要指名，重置会清掉）。 */
	readonly staging: readonly string[];
	readonly lastFailure?: { readonly phase: string; readonly error: string };
	readonly nextSteps: readonly string[];
	readonly logPath: string;
}

function describeStatus(report: Pick<RuntimeDiagnosticsReport, "status" | "version">): string {
	switch (report.status.kind) {
		case "missing":
			return "未就绪：可执行环境不存在（没装，或目录被删/被杀软隔离）";
		case "wrong-version":
			return `未就绪：版本不符（当前 ${report.status.version}，需要 ${report.version}）`;
		case "deps-missing":
			return `未就绪：缺依赖 ${report.status.module}`;
		case "ready":
			return "就绪";
	}
}

/**
 * 可执行的下一步。原则：**先给能一键修的（重置），再给手动兜底**，
 * 并且如实说明当前走的是哪条路径 —— 用户与我们都靠这一条判断改动的落点。
 */
function nextStepsFor(report: Omit<RuntimeDiagnosticsReport, "nextSteps">): readonly string[] {
	const steps: string[] = [];
	if (report.staging.length > 0) {
		steps.push(
			`盘上有上次中断留下的半成品目录（${report.staging.join("、")}）：点「重置并重新安装」会清掉重来。`,
		);
	}
	if (report.currentVersion === undefined && report.instances.some((instance) => instance.complete)) {
		steps.push(
			"托管根里有一份完整实例但没发布（current 缺席，通常是安装正好中断在最后一步）：" +
				"下次探测（转换前 / 打开设置页）会直接补上指针，不必重新下载。",
		);
	}
	if (report.currentVersion !== undefined && !report.instances.some((instance) => instance.complete)) {
		steps.push("current 指针指向的实例已不存在或不完整（指针已被忽略）：点「重置并重新安装」。");
	}
	switch (report.status.kind) {
		case "ready":
			steps.push("环境就绪，无需操作。");
			break;
		case "deps-missing":
			steps.push("点「重置并重新安装」重建这一份环境（需联网）——缺依赖不会自动补装。");
			break;
		case "wrong-version":
		case "missing":
			steps.push(
				"点「安装」（已装过则点「重置并重新安装」）重建环境：需联网下载，" +
					"体积见设置页「内置运行时」那一行的提示 —— 运行时不随包分发，也**不会**自动下载。",
			);
			break;
	}
	if (report.resolutionSource === "legacy") {
		steps.push(
			`当前复用托管根之外的既有目录（${report.activeDir}），它不会被删除也不会被自动迁入；` +
				"要迁进托管根（之后可回滚/可版本化）请点「重置并重新安装」。",
		);
	}
	if (report.resolutionSource === "override") {
		steps.push(
			`当前由环境变量 HTML_TO_DOCX_VENV 指定（${report.activeDir}），托管根被跳过：` +
				"要改回托管根，取消该环境变量。",
		);
	}
	if (report.lastFailure !== undefined) {
		steps.push(
			`最近一次失败发生在 ${report.lastFailure.phase} 相位；完整日志见 ${report.logPath}。` +
				"无外网/私有化环境：把 UV_INDEX_URL（PyPI 镜像）与 UV_PYTHON_INSTALL_MIRROR（Python 发行版镜像）" +
				"指向内网，或用 HTML_TO_DOCX_VENV 指定运维预置好的 venv。",
		);
	}
	return steps;
}

/** 采集当前事实（只读：不动磁盘、不改环境）。 */
export async function collectRuntimeDiagnostics(
	descriptor: RuntimeDescriptor,
	spawn: SpawnFn,
): Promise<RuntimeDiagnosticsReport> {
	const resolution = descriptor.resolve();
	const current = readCurrent(descriptor.options.root, descriptor.id);
	const lastFailure = readLastRuntimeFailure(descriptor);
	const base = {
		id: descriptor.id,
		label: descriptor.label,
		version: descriptor.version,
		source: descriptor.source,
		status: await descriptor.inspect(resolution.activeDir, spawn),
		resolutionSource: resolution.source,
		resolutionDetail: resolution.detail,
		activeDir: resolution.activeDir,
		instanceDir: resolution.instanceDir,
		...(current === undefined ? {} : { currentVersion: current }),
		instances: listInstances(descriptor.options.root, descriptor.id).map((instance) => ({
			version: instance.version,
			complete: instance.complete,
		})),
		staging: listStaging(descriptor.options.root, descriptor.id),
		...(lastFailure === undefined ? {} : { lastFailure }),
		logPath: runtimeLogDir(descriptor),
	};
	return { ...base, nextSteps: nextStepsFor(base) };
}

/** 渲染成可复制文本（面板上「复制诊断」按钮的内容就是它）。 */
export function renderRuntimeDiagnostics(report: RuntimeDiagnosticsReport): string {
	const lines: string[] = [
		`【${report.label}】诊断报告`,
		`- id / 期望版本：${report.id} / ${report.version}`,
		`- 来源：${report.source}`,
		`- 状态：${describeStatus(report)}`,
		`- 生效路径：${report.activeDir}`,
		`- 路径来源：${report.resolutionSource}（${report.resolutionDetail}）`,
		`- 托管实例目录：${report.instanceDir}`,
		`- current 指针：${report.currentVersion ?? "（未写：尚无已发布的实例）"}`,
	];
	const instances =
		report.instances.length === 0
			? "（无）"
			: report.instances
					.map((instance) => `${instance.version}${instance.complete ? "" : "（未完成）"}`)
					.join("、");
	lines.push(`- 盘上实例：${instances}`);
	lines.push(`- 半成品目录：${report.staging.length === 0 ? "（无）" : report.staging.join("、")}`);
	lines.push(
		`- 最近一次失败：${
			report.lastFailure === undefined ? "（日志里没有失败记录）" : `${report.lastFailure.error}（相位 ${report.lastFailure.phase}）`
		}`,
	);
	lines.push(`- 日志：${report.logPath}`);
	lines.push("- 可执行的下一步：");
	for (const step of report.nextSteps) lines.push(`  · ${step}`);
	return lines.join("\n");
}
