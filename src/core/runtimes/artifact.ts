/**
 * 下载型运行时的**取件环节**：下载发行物 → 校验 → 解包到暂存目录。
 *
 * 这是 2026-09-18 设计变更（运行时从「随包载荷」改为「纯按需联网下载」）的落点：
 * 旧实现是 `bundled-payload.ts`（把构建期随包的目录树复制进托管根），
 * 现在换成「按需下载 + 校验 + 解包」。**只在用户显式点「安装 / 重置」时被调用**
 * （调用链：daemon 的 runtimes:install → core/runtime-inventory.installManagedRuntime
 * → core/runtimes/registry.installRuntime → 本文件）——`ensureRuntime` 已退化成只探不装，
 * 任何自动路径都不会走到这里。
 *
 * ── 三道门（顺序不可换）──
 *   1. **官方校验文件交叉核对**（可选）：拿官方 `SHASUMS256.txt` 与代码内固定值比对。
 *      拿不到只记一条 warning（不能把「取不到元数据」当成「校验失败」——离线的用户
 *      仍要能装）；拿到了却不一致就**响亮失败**：那说明上游换了产物或我们钉错了版本，
 *      两种都该人来看一眼，绝不能顺手放行。
 *   2. **发行物 sha256**（download.ts）：唯一信任源。镜像/重定向只是传输通道。
 *   3. **解包后必备文件**（含许可文本）：缺一不许进位 —— 许可文本是合规义务的载体
 *      （见 resources/runtimes/README.md 的义务清单），缺了就是不合规的分发物。
 *
 * 「校验不过不许进位」在这里体现为：任何一步抛错都不写实例、不写 manifest、不写 current；
 * 暂存目录由 registry.installRuntime 在 catch 里清掉（见那里的注释）。
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { SpawnFn } from "../../documents/docx-env.ts";
import {
	DownloadCancelledError,
	DownloadError,
	downloadArtifact,
	fetchText,
	formatBytes,
	partFileFor,
	type HttpOpener,
} from "./download.ts";

/**
 * 安装进度（core 口径）：只说「正在做什么」+ 能估出来的百分数。
 * 终态（完成/失败/取消）由调用方决定，内核不替它下结论。
 * 跨进程的 payload（含 id 与终态）在 `shared/runtimes.ts` 的 `RuntimeInstallProgress`。
 */
export interface RuntimeInstallProgressUpdate {
	readonly message: string;
	/** 0-100。估不准就**缺席**（界面渲染不确定进度，不画假进度）。 */
	readonly percent?: number;
}

export type RuntimeProgressListener = (update: RuntimeInstallProgressUpdate) => void;

/** 官方校验文件的交叉核对（node 有：`SHASUMS256.txt`；gitbash 只有 release asset digest，故缺省）。 */
export interface ArtifactShasumsSpec {
	readonly url: string;
	/** 要在官方校验文件里逐条核对的名字 → 期望 sha256。 */
	readonly entries: readonly { readonly name: string; readonly sha256: string }[];
}

export interface ArtifactExtractContext {
	readonly spawn: SpawnFn;
	readonly signal?: AbortSignal;
}

/** 一个运行时的发行物描述（URL 候选、校验、解包、必备文件）。 */
export interface RuntimeArtifactSpec {
	readonly id: string;
	readonly label: string;
	readonly version: string;
	/** 发行物文件名（缓存与续传点都用它命名）。 */
	readonly artifactName: string;
	/** 候选 URL（按序尝试；环境变量覆盖口在前，其次官方源、最后镜像）。 */
	readonly urls: readonly string[];
	/** 钉死的发行物 sha256（唯一信任源；定稿见 docs/运行时来源与许可.md）。 */
	readonly sha256: string;
	/** 体积下限（挡「下到错误页」这类成功响应）。 */
	readonly minBytes: number;
	/** 体积提示（进度与错误文案都带上：用户点之前就该知道要下多少）。 */
	readonly sizeHint: string;
	readonly shasums?: ArtifactShasumsSpec;
	/** 解包后的必备文件（相对解包根）。**许可文本也在这一列**。 */
	readonly requiredFiles: readonly string[];
	extract(artifactPath: string, envDir: string, ctx: ArtifactExtractContext): Promise<void>;
}

export interface AcquireContext {
	readonly spawn: SpawnFn;
	/** 测试注入点：HTTP 打开器（生产用 stdlib 实现，见 download.ts）。 */
	readonly opener?: HttpOpener;
	/** 用户点「取消」的落点：下载层按它中断，`.part` 留作续传点。 */
	readonly signal?: AbortSignal;
	readonly onProgress?: RuntimeProgressListener;
}

export interface AcquiredArtifact {
	readonly artifactPath: string;
	readonly bytes: number;
	/** 发行物的 sha256（= 校验通过的那个值；写进 manifest 的 checksum）。 */
	readonly sha256: string;
	/** 没有重新下载的字节数（缓存命中 / 续传）。 */
	readonly reusedBytes: number;
	/** 不致命的实情（如「官方校验文件没取到」）——如实上报，不静默吞掉。 */
	readonly warnings: readonly string[];
}

/**
 * 官方校验文件交叉核对。拿不到只记 warning，拿到了不一致就响亮失败。
 * 取消要原样抛出（它不是「取件失败」，别被降级成一条警告）。
 */
async function crossCheckShasums(
	spec: RuntimeArtifactSpec,
	ctx: AcquireContext,
	warnings: string[],
): Promise<void> {
	const shasums = spec.shasums;
	if (shasums === undefined) return;
	let text: string;
	try {
		text = await fetchText(shasums.url, {
			...(ctx.opener === undefined ? {} : { opener: ctx.opener }),
			...(ctx.signal === undefined ? {} : { signal: ctx.signal }),
		});
	} catch (error) {
		if (error instanceof DownloadCancelledError) throw error;
		warnings.push(
			`未取到官方校验文件 ${shasums.url}（${error instanceof Error ? error.message : String(error)}）` +
				"—— 本次仅按代码内固定 sha256 校验发行物。",
		);
		return;
	}
	const rows = text.split("\n").map((row) => row.trim());
	for (const entry of shasums.entries) {
		const actual = rows.find((row) => row.endsWith(` ${entry.name}`))?.split(/\s+/)[0];
		if (actual !== entry.sha256) {
			throw new DownloadError(
				"sha256",
				`官方校验文件 ${shasums.url} 里的 ${entry.name} sha256 与代码内固定值不一致` +
					`（官方 ${actual ?? "缺这一条"} / 固定 ${entry.sha256}）—— ` +
					"要么上游换了产物、要么我们钉错了版本，两种都必须人来看一眼（已中止本次安装）。",
			);
		}
	}
}

/** 解包 + 必备文件断言。缺任一（含许可文本）即响亮失败 —— 不许进位。 */
async function extractAndCheck(
	spec: RuntimeArtifactSpec,
	artifactPath: string,
	envDir: string,
	ctx: AcquireContext,
	progress: RuntimeProgressListener,
): Promise<void> {
	progress({ message: `正在解包 ${spec.label}…` });
	await spec.extract(artifactPath, envDir, {
		spawn: ctx.spawn,
		...(ctx.signal === undefined ? {} : { signal: ctx.signal }),
	});
	const missing = spec.requiredFiles.find((file) => !existsSync(join(envDir, file)));
	if (missing !== undefined) {
		throw new DownloadError(
			"incomplete",
			`${spec.label} 解包后缺 ${missing}（落点 ${envDir}）—— 必备文件里含许可文本，缺了不许进位。` +
				"本次安装已中止，请重试；若反复出现，请把设置页的「诊断」报告发给我们。",
		);
	}
}

/**
 * 下载并解包到 `envDir`（调用方给的**暂存目录**：进位由 registry 负责）。
 *
 * 候选 URL 按序试，全失败才响亮报错 —— 错误文案必须**可执行**：带体积提示与
 * 「手工放置发行物」这条离线/内网的出路（照搬构建期脚本的四条出路口径）。
 */
export async function acquireArtifact(
	spec: RuntimeArtifactSpec,
	cacheDir: string,
	envDir: string,
	ctx: AcquireContext,
): Promise<AcquiredArtifact> {
	const progress = ctx.onProgress ?? ((): void => {});
	const warnings: string[] = [];
	mkdirSync(cacheDir, { recursive: true });
	await crossCheckShasums(spec, ctx, warnings);

	const artifactPath = join(cacheDir, spec.artifactName);
	let lastError: Error | undefined;
	for (const [index, url] of spec.urls.entries()) {
		progress({
			message:
				index === 0
					? `正在下载 ${spec.label} ${spec.version}（${spec.sizeHint}）…`
					: `主源不可用，正在从备用地址下载 ${spec.label}（${spec.sizeHint}）…`,
			percent: 0,
		});
		try {
			const result = await downloadArtifact({
				url,
				targetFile: artifactPath,
				sha256: spec.sha256,
				minBytes: spec.minBytes,
				...(ctx.opener === undefined ? {} : { opener: ctx.opener }),
				...(ctx.signal === undefined ? {} : { signal: ctx.signal }),
				onProgress: ({ receivedBytes, totalBytes }) => {
					progress({
						message: `正在下载 ${spec.label}：${formatBytes(receivedBytes)}${
							totalBytes === undefined ? "" : ` / ${formatBytes(totalBytes)}`
						}`,
						...(totalBytes === undefined || totalBytes === 0
							? {}
							: { percent: Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) }),
					});
				},
			});
			progress({ message: `SHA256 校验通过（${formatBytes(result.bytes)}）` });
			await extractAndCheck(spec, artifactPath, envDir, ctx, progress);
			return {
				artifactPath,
				bytes: result.bytes,
				sha256: result.sha256,
				reusedBytes: result.reusedBytes,
				warnings,
			};
		} catch (error) {
			if (error instanceof DownloadCancelledError) throw error;
			lastError = error instanceof Error ? error : new Error(String(error));
			/*
			 * 换源：上一次留下的 `.part` 是**另一个源**的半截字节，拼上去只会换来一次
			 * sha256 不符（下载层会兜住，但白下一遍），所以这里有下一个候选就清掉。
			 * **最后一个候选除外**：它失败后没有「下一个」了，把 `.part` 留着 ——
			 * 用户再点一次安装就能从同一个源接着下（网络抖动/断线是最常见的失败）。
			 */
			if (index < spec.urls.length - 1) rmSync(partFileFor(artifactPath), { force: true });
		}
	}
	throw new DownloadError(
		"http",
		`${spec.label} ${spec.version} 下载失败（已试 ${spec.urls.length} 个来源；最后一条：${
			lastError?.message ?? "未知原因"
		}）。` +
			`该运行时需联网下载 ${spec.sizeHint}；请换一个能到官方源（或内网镜像）的网络后重试，` +
			`或把发行物 ${spec.artifactName} 手工放到 ${artifactPath} 后重试` +
			`（sha256 必须等于 ${spec.sha256}）。`,
	);
}
