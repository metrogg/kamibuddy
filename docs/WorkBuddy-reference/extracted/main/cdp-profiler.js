const require_chunk = require("./chunk.js");
const require_workbuddy_paths = require("./workbuddy-paths.js");
const require_app_instance = require("./app-instance.js");
const require_logger = require("./logger2.js");
const require_perf_profiler_handlers = require("./perf-profiler-handlers.js");
let electron = require("electron");
let fs = require("fs");
fs = require_chunk.__toESM(fs);
let os = require("os");
os = require_chunk.__toESM(os);
let path = require("path");
path = require_chunk.__toESM(path);
//#region src/main/features/performance/analysis-prompt-builder.ts
/**
* 性能分析 Prompt 构建器
*
* 负责收集日志、读取采集数据、构建发送给 Agent 的分析 prompt。
*/
require_app_instance.init_app_instance();
/** 读取文件最后 N 行 */
function readLastLines(filePath, maxLines) {
	try {
		if (!fs.existsSync(filePath)) return "";
		return fs.readFileSync(filePath, "utf-8").split("\n").slice(-maxLines).join("\n");
	} catch {
		return "";
	}
}
/**
* 从日志内容中过滤出 startTime 之后的行。
* 支持常见的日志时间戳格式：
* - ISO 8601: 2026-06-16T12:30:00.000Z
* - 方括号格式: [2026-06-16T12:30:00.000Z]
* - 带时区格式: 2026-06-16T12:30:00.000+08:00
*/
function filterLogsByTime(logContent, startTime) {
	const startMs = startTime.getTime();
	const lines = logContent.split("\n");
	const filteredLines = [];
	let foundFirstMatch = false;
	const tsPattern = /\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[\d.]*(?:Z|[+-]\d{2}:?\d{2})?)\]?/;
	for (const line of lines) {
		const match = tsPattern.exec(line);
		if (match) {
			const lineTime = new Date(match[1]).getTime();
			if (!isNaN(lineTime) && lineTime >= startMs) foundFirstMatch = true;
			else if (!isNaN(lineTime) && lineTime < startMs) continue;
		}
		if (foundFirstMatch) filteredLines.push(line);
	}
	return filteredLines.join("\n");
}
/**
* 收集录制期间的 WorkBuddy 日志。
*
* 主日志（优先分析，覆盖启动 → 主进程 → daemon 主线程完整链路）：
* 1. ~/.workbuddy/logs/AppStartup.log                        应用启动日志
* 2. ~/.workbuddy/logs/startup/<日期>/<pid>-<时间>.log        主进程超早期诊断日志
* 3. ~/.workbuddy/logs/main.log                                 electron-log 主进程日志（结构最规整）
* 4. ~/.workbuddy/logs/<日期>/workbuddyMainThread__*.log     daemon 主线程日志
*
* 备选日志（主日志找不到线索时才看）：
* - ~/.workbuddy/logs/ 目录下其他 .log 文件（例如 file-service.log / vendor-extract.log /
*   connector-oauth-debug.log 等）。自动跳过已经作为主日志读过的文件与目录。
*
* @param startTime 录制开始时间，只返回该时间之后的日志
*/
function getRecentLogs(startTime) {
	const logsDir = require_workbuddy_paths.getWorkbuddyLogsDir();
	const primary = [];
	const fallback = [];
	/** 已经被主日志覆盖过的文件绝对路径，备选阶段跳过 */
	const consumedFiles = /* @__PURE__ */ new Set();
	const readAndFilter = (filePath, maxLines) => {
		const raw = readLastLines(filePath, maxLines);
		if (!raw || !startTime) return raw;
		return filterLogsByTime(raw, startTime);
	};
	try {
		const p = path.join(logsDir, "AppStartup.log");
		const content = readAndFilter(p, 500);
		if (content) primary.push({
			name: "[主] AppStartup.log",
			content
		});
		consumedFiles.add(p);
	} catch {}
	try {
		const startupDir = path.join(logsDir, "startup");
		if (fs.existsSync(startupDir)) {
			const candidates = [];
			const collectFile = (filePath, name) => {
				if (!/\.log$/i.test(name)) return;
				try {
					const stat = fs.statSync(filePath);
					if (stat.isFile()) candidates.push({
						filePath,
						name,
						mtimeMs: stat.mtimeMs
					});
				} catch {}
			};
			for (const entry of fs.readdirSync(startupDir, { withFileTypes: true })) {
				const entryPath = path.join(startupDir, entry.name);
				if (entry.isFile()) collectFile(entryPath, entry.name);
				else if (entry.isDirectory()) for (const child of fs.readdirSync(entryPath, { withFileTypes: true })) collectFile(path.join(entryPath, child.name), `${entry.name}/${child.name}`);
			}
			const latest = candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
			if (latest) {
				const content = readAndFilter(latest.filePath, 200);
				if (content) primary.push({
					name: `[主] startup/${latest.name}`,
					content
				});
				consumedFiles.add(latest.filePath);
			}
		}
	} catch {}
	try {
		const mainLogPath = path.join(logsDir, "main.log");
		const content = readAndFilter(mainLogPath, 500);
		if (content) {
			primary.push({
				name: "[主] main.log",
				content
			});
			consumedFiles.add(mainLogPath);
		}
	} catch {}
	try {
		const dateDirs = fs.readdirSync(logsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name)).map((d) => d.name).sort().reverse();
		if (dateDirs[0]) {
			const dateDir = path.join(logsDir, dateDirs[0]);
			const mainThreadLogs = fs.readdirSync(dateDir).filter((f) => f.startsWith("workbuddyMainThread"));
			if (mainThreadLogs[0]) {
				const p = path.join(dateDir, mainThreadLogs[0]);
				const content = readAndFilter(p, 300);
				if (content) primary.push({
					name: `[主] ${dateDirs[0]}/${mainThreadLogs[0]}`,
					content
				});
				consumedFiles.add(p);
			}
		}
	} catch {}
	try {
		const MAX_FALLBACK_FILES = 5;
		for (const entry of fs.readdirSync(logsDir, { withFileTypes: true })) {
			if (!entry.isFile() || !/\.log$/i.test(entry.name)) continue;
			const filePath = path.join(logsDir, entry.name);
			if (consumedFiles.has(filePath)) continue;
			const content = readAndFilter(filePath, 120);
			if (content) {
				fallback.push({
					name: `[备选] ${entry.name}`,
					content
				});
				if (fallback.length >= MAX_FALLBACK_FILES) break;
			}
		}
	} catch {}
	const all = [...primary, ...fallback];
	if (all.length === 0) return "(未找到日志文件)";
	return all.map((f) => `### ${f.name}\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n");
}
var BUILD_COMMIT = "b148bd1d";
/** genie monorepo 的常见目录名（判断关联目录是不是我们仓库） */
var GENIE_REPO_HINTS = ["genie"];
/** 判断用户关联的项目目录是否是 genie monorepo */
function looksLikeGenieRepo(dir) {
	if (!dir) return false;
	const base = path.basename(dir).toLowerCase();
	return GENIE_REPO_HINTS.includes(base);
}
/**
* 构建用于 Agent 性能分析的 prompt
* @param outputDir 采集数据输出目录
* @param recordingStartTime 录制开始时间，用于限定日志范围
* @param associatedProjectDir 用户关联的代码目录
* @param gitBranch 关联目录的当前 Git 分支
* @param appVersion 应用版本号（app.getVersion() 结果）
*/
function buildAnalysisPrompt(outputDir, recordingStartTime, associatedProjectDir, gitBranch, appVersion) {
	let probeReportSummary = "";
	try {
		const probeFile = path.join(outputDir, "probe-report.json");
		if (fs.existsSync(probeFile)) {
			const report = JSON.parse(fs.readFileSync(probeFile, "utf-8"));
			probeReportSummary = JSON.stringify(report, null, 2);
		}
	} catch {}
	let summaryContent = "";
	let daemonProfileCaptured = false;
	let mainProfileCaptured = false;
	let rendererProfileCaptured = false;
	try {
		const summaryFile = path.join(outputDir, "summary.json");
		if (fs.existsSync(summaryFile)) {
			summaryContent = fs.readFileSync(summaryFile, "utf-8");
			const parsed = JSON.parse(summaryContent);
			daemonProfileCaptured = !!parsed.files?.daemonCpuProfile;
			mainProfileCaptured = !!parsed.files?.mainProcessCpuProfile;
			rendererProfileCaptured = !!parsed.files?.cpuProfile;
		}
	} catch {}
	const recentLogs = getRecentLogs(recordingStartTime);
	const isGenieRepo = looksLikeGenieRepo(associatedProjectDir);
	return `# WorkBuddy 性能分析任务

## 背景
用户通过 WorkBuddy 帮助菜单里的性能采集工具录制了一段 trace，希望你帮他分析性能瓶颈。

## 🎬 用户已在发起消息中回答的 2 个问题（先提取，再分析）

触发本次分析的原始消息里，会包含用户对以下 2 个问题的回答（如果用户没填就是空）：

1. **卡顿的具体场景是什么？**
2. **最近有没有升级 WorkBuddy 或改过什么设置？**

在读任何数据文件之前，**先把这 2 项从原始消息里提取出来记住**，写进最终报告的「📝 问题现场摘要」段：

- 用户填了 → 原样引用，作为主战场判定、疑似 commit 归因的重要上下文
- 用户没填 / 只填了一项 → 在报告里如实标注"未提供"，**不要**再向用户追问，直接基于采集数据分析；但在报告结尾提醒一句"下次录制时若能补充卡顿场景，可给出 commit 归因结论"

**注意**：本 prompt 是通过 \`analysis-prompt.md\` 文件被 Agent 读取的，2 个问题的**答案**在触发消息本身里，不在这个文件里。

## 采集数据位置
所有采集文件位于：\`${outputDir}\`

### 应用架构（数据流）
WorkBuddy 是四进程架构，性能瓶颈可能出现在**任何一段**跨进程链路上，分析时务必区分：

\`\`\`
main（Electron 主进程，窗口/菜单/系统集成/IPC 路由）
  ↕ IPC / webContents.debugger
renderer（Chromium 渲染进程，React/Slate UI，Agent 会话消费方）
  ↕ 通过 main 中转的 stdio RPC
daemon（daemon-app-server-entry.js，纯 Node 常驻业务进程，
        SessionManager / MCP apps host / 后台服务 / SQLite / 迁移 / connector 桥接）
  ↕ ACP / stdio
cli（agent-cli 子进程，实际跑 LLM 请求、工具执行、code intelligence）
\`\`\`

一次卡顿可能是 renderer 主线程阻塞、也可能是 main 处理 IPC 慢、也可能是 daemon 卡在 SQLite / MCP 上游、
甚至是 cli 长任务导致 daemon → renderer 的推流被压。**优先看哪个 cpu-profile 的 busy_pct 最高**，
再顺着日志和 trace 找到对应的跨进程调用点。

### 文件说明
- **trace.json** — 渲染进程 DevTools Performance trace（Chromium Tracing 格式：JS 执行、渲染、布局、Paint 等）
- **cpu-profile.cpuprofile** — **渲染进程** V8 CPU Profile（函数级别调用栈采样）
- **main-process-cpu-profile.cpuprofile** — **主进程** V8 CPU Profile
- **daemon-cpu-profile.cpuprofile** — **daemon 进程** V8 CPU Profile（本次新增，能反映后台业务进程的热点）
- ***-parsed.json** — 上面各 profile 的 Top 30 热点函数 + 文件聚合排名（Agent 直接读这个更省 token）
- **probe-report.json** — 应用层探针报告（DOM 查询频率、布局抖动、Observer 创建、Long Tasks）
- **perf-metrics-diff.json** — 录制前后 Performance.getMetrics 增量对比
- **summary.json** — 会话摘要元信息（含各进程 profile 是否成功采集的索引）

### 采集健康检查（先看这里，确认数据完整性）
- 渲染进程 CPU Profile 采集：${rendererProfileCaptured ? "✅ 成功" : "❌ 缺失（trace 仍然可看，但函数级采样数据缺失）"}
- 主进程 CPU Profile 采集：${mainProfileCaptured ? "✅ 成功" : "❌ 缺失（无法定位主进程热点）"}
- **daemon 进程 CPU Profile 采集**：${daemonProfileCaptured ? "✅ 成功（可以分析后台业务进程的热点）" : [
		"❌ **缺失** — 产物里没有 daemon-cpu-profile.cpuprofile。",
		"可能原因：daemon 未启动、stdio RPC 断连、handler 注册失败。",
		"请在下面「录制期间的 WorkBuddy 日志」里搜 `[PerfProfiler] daemon start failed`",
		"或 `[PerfProfiler] daemon stop failed`，把定位结论作为分析报告的一部分反馈给用户。",
		"缺失时**不要臆测 daemon 的性能问题**，只能基于渲染/主进程数据分析。"
	].join("")}


## 采集会话摘要
\`\`\`json
${summaryContent}
\`\`\`

## 探针报告（应用层指标）
\`\`\`json
${probeReportSummary}
\`\`\`

## 录制期间的 WorkBuddy 日志
> 注意：以下日志仅包含录制开始时间（${recordingStartTime?.toISOString() ?? "未知"}）之后的内容，录制之前的日志已被排除。

${recentLogs}

## 关联代码目录 · 版本对齐

**本次采集的 WorkBuddy 构建信息**：
- 应用版本：\`${appVersion ?? "未知"}\`
- 构建 commit：\`${BUILD_COMMIT}\`（对应"关于我们"里的构建号，即编译该 dmg 时的 git commit id）

${associatedProjectDir ? `**用户关联的项目代码目录**：\`${associatedProjectDir}\`${gitBranch ? `\n当前工作树 Git 分支：\`${gitBranch}\`` : ""}

### 版本对齐指引（重要）

在开始定位代码之前，请你先做以下自检并把结论告诉用户，**不要擅自切换用户的分支或 checkout commit**（那会覆盖用户当前的工作）：

1. 在项目目录里跑 \`git rev-parse HEAD\`，拿到当前工作树的 commit
2. 用 \`git log --oneline -1 ${BUILD_COMMIT} 2>/dev/null\` 判断构建 commit 是否存在于本地
3. 用 \`git merge-base --is-ancestor ${BUILD_COMMIT} HEAD\` 判断构建 commit 是否已合入当前分支
4. 根据结果给用户明确提示：
   - **完全一致**（HEAD == ${BUILD_COMMIT}）→ 可以直接开始基于当前工作树分析
   - **HEAD 是构建 commit 的后代**（本地更新）→ 提醒用户"当前代码新于本次采集的构建，函数名/行号可能已偏移；如需精确定位建议 \`git stash && git checkout ${BUILD_COMMIT}\`（由用户决定）"
   - **本地缺少这个 commit** → 提示用户 \`git fetch\` 或直接告诉他"本次分析将基于当前分支 ${gitBranch ?? "未知"}，可能与实际运行代码有偏差"
   - **完全不同分支** → 明确告知偏差，让用户决定是否切分支

**⚠️ 禁止行为**：不要自动跑 \`git checkout\`、\`git reset\`、\`git stash\` 等会改变工作树状态的命令。
诊断类命令（\`git log\` / \`git rev-parse\` / \`git status\` / \`git diff\` / \`git blame\` / \`git show\`）可以直接跑。

### 分析要求
- 结合该目录下的源码进行深度分析，通过 trace 中的函数名/文件名定位到源码
- 给出具体文件、行号的优化方案
- 引用代码时明确标注"基于 commit XXX 的代码"，避免用户误以为是最新代码
${isGenieRepo ? `
### 🔍 疑似引入问题的 commit / PR 定位（关联到 genie 仓库时启用）

仅在用户在"🎬 开始分析前必须先问用户"回答了 **卡顿场景** 或 **最近改动线索** 时才执行本节，否则跳过并在报告里明确说明"因缺少场景描述未做 commit 归因"。

定位步骤：

1. 从 trace / cpu-profile-parsed.json 里挑出 **Top 3 热点函数**，用 \`git log -L :<函数名>:<文件路径> ${BUILD_COMMIT}\` 或 \`git log --follow ${BUILD_COMMIT} -- <文件路径>\` 查这些代码最近 20 条 commit
2. 结合用户描述的**卡顿场景**用 \`git log --all --grep="<关键词>" --since="<最近 N 周>"\` 搜相关 commit（关键词从用户回答中提取，例如"切会话""设置面板""滚动"）
3. 对每一条候选 commit：
   - 跑 \`git show --stat <commit>\` 看改动范围
   - 跑 \`git show <commit>\` 看具体 diff
   - 判断这条改动**是否可能引入本次观察到的性能问题**（有明确因果链才算，别只是"改到了同一个文件"就下结论）
4. 从 commit message 里提取 PR 号（形如 \`#<数字>\` / \`(#<数字>)\` / \`!<数字>\`），如果有就在报告里给出 PR 链接
   - genie 主仓 PR 链接格式：\`https://cnb.cool/genie/genie/-/pulls/<PR号>\`（若与实际不符按仓库实际前缀改）
5. **候选 commit 要按可疑度排序**（High/Med/Low）并给出各自的判据；没有强证据就写 Low 并注明"仅时间/文件相邻，因果不明"

## 判据示例

- **High**：改动了热点函数本身，且改动方向符合性能退化（如加了一层同步 loop、拆开了 batching、去掉了 memo）
- **Med**：改动了热点函数所在文件的相邻函数或其调用者，diff 中出现了同步 IO / 大数组处理 / 新增 useEffect 等
- **Low**：只是改动时间上贴近用户描述的"最近升级/改配置"时间点，无直接代码因果` : ""}` : `用户未关联代码目录。请仅基于采集数据进行分析，无法定位到具体源码文件。

如果分析中定位到了明确的函数名（来自 trace 或 cpu-profile-parsed.json），可以建议用户"下次录制时关联 \`genie\` 仓库目录，我就能基于 commit \`${BUILD_COMMIT}\` 精确定位到源码"。`}

## 分析要求

### 第一步：数据概览

1. **优先读 *-parsed.json**（cpu-profile-parsed.json / main-process-cpu-profile-parsed.json / daemon-cpu-profile-parsed.json）— 已排序的 Top 函数 + 文件聚合，Token 高效
2. **读取 trace.json** — 提取所有 Long Tasks（>50ms），按耗时降序列出 Top 10；trace 只覆盖渲染进程，主/daemon 进程的热点必须靠 cpu-profile 定位
3. **读取 probe-report.json** — 汇总 DOM 查询频率、布局抖动、Observer 数量

### 第一步之后（关键，禁止跳过）：**严格判定卡顿属于哪个进程**

这是本次分析最重要的一步。**不允许**给出"可能是 renderer 也可能是 daemon"这种模糊结论，也**不允许**跳过这一步直接讨论优化建议。判据必须来自采集数据本身，按以下顺序对比：

| 判据 | 数据来源 | 判定规则 |
|---|---|---|
| 各进程 CPU busy_pct | \`{cpu-profile,main-process-cpu-profile,daemon-cpu-profile}-parsed.json\` 的 \`summary.busy_pct\` | busy_pct 明显高于其他两个进程（差值 ≥ 20 个百分点）的即为主战场 |
| 各进程 Top 函数 self_ms 绝对值 | 同上 \`topSelf[0].self_ms\` | 最大者所在进程即嫌疑最大；若量级接近，需继续走下一条 |
| Long Task 是否出现在 renderer trace 里 | trace-events-extract.json / trace.json | 有 Long Task > 100ms → renderer 阻塞疑似确认；无 → 卡顿大概率来自 main/daemon 阻塞 IPC 反馈 |
| main / daemon 日志异常 | 录制期间日志段 | 出现明确 error/warn/timeout → 该进程加分 |

**产出必须包含一个明确的"主战场进程"结论**，格式如下：

> **主战场进程：<renderer / main / daemon>**
> **判定依据**（引用数据）：
> - renderer busy_pct: <x>%，Top 函数 <name>@<file>: <y>ms
> - main busy_pct: <x>%，Top 函数 <name>@<file>: <y>ms
> - daemon busy_pct: <x>%，Top 函数 <name>@<file>: <y>ms
> - 是否有 Long Task > 100ms：<有 X 条 / 无>
> - 跨进程日志异常：<有具体描述 / 无>
> **置信度**：High / Med / Low（三个进程 busy_pct 接近时降到 Med；缺一份 profile 时降到 Low 并说明）

**特殊情况**：
- 如果三个进程 busy_pct 都很低（例如都 < 30%），主战场结论要标为"数据未观察到明显 CPU 瓶颈，卡顿可能来自 I/O 等待 / IPC 阻塞 / 网络等待"，然后从日志找证据
- 如果 daemon-cpu-profile 缺失，明确写"daemon 数据缺失，无法判定 daemon 是否为主战场"，不许假设它没事

### 第二步：判断有没有 P0（唯一目标）

**P0 定义**（同时满足才算，否则一律"未发现"）：
- 单个 Long Task > 500ms 或 多个 Long Task 累计 > 1000ms **或** 某进程 busy_pct > 70%
- 且能锁定到具体函数/文件（trace 或 cpu-profile-parsed 的 topSelf 里能明确指出来）
- 且用户描述的卡顿场景与该现象**吻合**（例如用户说"切会话卡"→ 数据里也确实在切会话时段出现热点；用户没说场景则只看数据本身是否显著异常）

**P1 / P2 / "小优化建议" 一律不要输出**。凡是"倒是可以顺手改改""也许有帮助"的东西全部忽略。

### 第三步：日志时间线分析

分两种触发场景，行为不同：

#### 场景 A：**有 P0** —— 日志只用来"补强证据"
- 搜 \`[PerfProfiler] daemon start failed\` / \`daemon stop failed\` → 采集本身有问题，先在报告里说明
- 搜 \`daemon-app-server\` / \`sidecar\` / \`ACP\` 相关 error/warn → 补强 P0 结论中的跨进程判断
- **不要**把日志翻译成独立结论，只作为 P0 证据的辅助

#### 场景 B（重点）：**没有明显的 P0，但三进程都不忙（busy_pct 都 < 40%）且用户明确给出了卡顿场景** —— 必须做详细日志时间线分析

这种情况是典型的"CPU 空闲但用户感知卡顿"——**几乎一定是 I/O 等待 / IPC 阻塞 / 网络等待 / 锁等待 / 主线程被外部信号阻塞**。CPU profile 看不出来，只能靠日志时间线。

**必须做的动作**：

1. **确定关注时间窗**：录制开始时间 = \`recordingStartTime\`（在 summary.json 里）；如果用户描述里提到"开始时/结束时/某个动作时"，据此把窗口进一步收窄到几秒范围。
2. **交叉对齐多份日志**：把日志段里所有能拿到的日志（AppStartup / startup / main.log / workbuddyMainThread / 备选日志）按**时间戳排序**，做成一条统一时间线。
3. **找可疑事件**（按可疑度从高到低）：
   - **两条日志之间的时间空洞**（超过 500ms 没任何日志输出）→ 极有可能就是卡顿窗口，重点看空洞前最后一条日志说的动作是什么
   - **同一个动作跨进程的耗时**：例如 renderer "requesting X" 与 daemon "handled X" 之间 gap > 300ms
   - **重试/超时/reconnect** 关键字：\`timeout\` / \`retry\` / \`reconnect\` / \`ECONN\` / \`ETIMEDOUT\` / \`took XXms\`
   - **锁/IO 阻塞**：\`waiting\` / \`blocked\` / \`sqlite\` / \`fs.write\` / \`SIGSTOP\`
   - **网络慢**：日志里带 URL 且 duration > 1s 的请求
4. **形成因果链**：把用户描述的卡顿动作 → 触发的 IPC/网络/IO 调用 → 日志时间线上对应的耗时段 → 定位到具体调用方或被调用方，串成一条链
5. **落地位置**：如果关联了 genie 目录，尝试用文件路径 / 关键日志 TAG（例如 \`[XxxDomain]\`）去源码里 grep 到发出这条日志的代码位置

**如果这种场景下依然找不到时间线上的可疑事件**：明确说"三进程 CPU 空闲、日志时间线上未发现明显阻塞事件；建议用户下次录制时提供更精确的卡顿触发时机（例如'点击某按钮的瞬间'），并检查是否是外部因素（macOS App Nap / 网络抖动 / 显示器切换 / 系统 IO 繁忙）"。**不要**凭空猜"可能是 XX 慢"。

---

## 输出格式（简短、直接、无冗余）

**只输出下面这几段，其他一律不写**。没有 P0 就明确说"没有明显的 P0"，不要凑内容。

### 📝 问题现场
- 卡顿场景：<引用用户在触发消息里的回答；用户没填就写"未提供">
- 最近改动线索：<同上>

### 🎯 主战场进程
一句话：**主战场进程：renderer / main / daemon**（置信度 High / Med / Low）

一行数据支撑：\`renderer busy_pct=x%, main=x%, daemon=x%; Long Task>100ms 共 x 条\`

不要展开成表格、不要 bullet list、不要再解释"为什么这么判"，就一行数据。

### 🔴 P0 问题

分三种情况输出（**只选一种**，不要混着写）：

#### 情况 1：发现 P0
按下面格式给一条**最严重**的：

> **P0：<一句话描述>**
> - 证据：<引用数据，比如"cpu-profile-parsed.json topSelf[0]: xxx@yyy self_ms=1230, busy_pct=78%">
> - 定位到的代码：<文件路径:行号 或 函数名>（未关联项目目录时写"未关联代码目录，无法定位到源码"）
> - 建议修复方向：<一两句话，不要展开写具体 diff>

#### 情况 2：CPU 侧没有明显的 P0，但**三进程 CPU 空闲（都 < 40%）且用户明确给出了卡顿场景**
先一句：**⚠️ CPU 侧没有明显的 P0，但用户描述的卡顿场景在数据中真实存在（三进程 busy_pct 均 < 40%）**

然后**必须**输出一段"日志时间线归因"（按"第三步 · 场景 B"的方法做）：

> **日志时间线归因（卡顿场景：<引用用户描述>）**
> - 关注时间窗：<起-止时间戳>
> - 可疑事件（按时间顺序）：
>   1. \`<时间戳>\` <日志内容摘要> —— <为什么可疑，如"这条之后 800ms 内无任何日志">
>   2. \`<时间戳>\` <日志内容摘要> —— <为什么可疑>
> - **因果链**：<用户动作> → <触发的调用> → <日志上耗时最长的段> → <最终阻塞点>
> - **疑似阻塞点**：<文件路径:函数 或 日志 TAG>（未关联代码目录时只给日志 TAG）
> - **建议**：<下一步排查方向，例如"检查 XxxService 里的同步 IO"或"复现时打开 --inspect 抓一次微观 profile">

如果时间线上确实找不到可疑事件，**不要凑**——写一句 "**日志时间线未观察到明显阻塞事件，建议下次录制时精确到卡顿触发的秒级时刻，并排查外部因素（App Nap / 网络抖动 / 系统 IO）**" 结束。

#### 情况 3：其他情况（CPU 空闲且用户没提供场景 / 或场景与数据不吻合）
直接一句 "**✅ 没有明显的 P0**"，然后一句话说明观察结果（例："三进程 busy_pct 均 < 40%，最大 Long Task 240ms，未构成 P0；用户未提供卡顿场景，无法进一步做时间线归因"）。

**三种情况都不允许**输出 P1 / P2 / "顺手优化" 之类的内容。
${isGenieRepo ? `
### 🔍 疑似 commit / PR（仅当有 P0 且能锁定代码时输出）

**触发条件**（同时满足才输出）：① 有 P0；② 用户提供了卡顿场景或最近改动线索；③ P0 定位到的代码在 genie 仓库里；④ 通过 git log/blame 找到**因果链清晰**的候选 commit。

不满足就整节替换为一句 "**未做 commit 归因（<原因：无 P0 / 用户未提供场景 / 未找到强证据>）**"。

满足时按下面格式给**最多 2 条**候选：

| 可疑度 | Commit | PR | 判据 |
|--------|--------|-----|------|
| High / Med | \`<短 hash>\` | #<PR号>（\`https://cnb.cool/genie/genie/-/merge_requests/<PR号>\`） | <一句话说清"改了什么 → 为什么会导致这个 P0"> |

**Low 可疑度不要输出**，宁可空表也不凑数。` : ""}

---

**总原则**：
- 无 P0 且无场景 → 3-5 行结束
- 有 P0 → 不超过 20 行
- 无 P0 但要做时间线归因（情况 2）→ 不超过 40 行，重点在因果链，不列无关日志
- 不要客套、不要"以上分析仅供参考"这类结尾`;
}
//#endregion
//#region src/main/features/performance/daemon-profiler-bridge.ts
var _daemonConnection;
/**
* 触发 daemon 端开始采集 V8 CPU Profile。
* @returns 成功启动返回 true；未注入 connection 或 handler 报错返回 false（不抛）。
*/
async function startDaemonProfiling() {
	if (!_daemonConnection) return false;
	try {
		const res = await _daemonConnection.invoke(require_perf_profiler_handlers.PERF_PROFILER_START_CHANNEL);
		if (!res?.ok) {
			require_logger.mainLog.warn("[PerfProfiler] daemon start failed:", res?.error ?? "unknown");
			return false;
		}
		return true;
	} catch (err) {
		require_logger.mainLog.warn("[PerfProfiler] daemon start invoke threw:", String(err));
		return false;
	}
}
/**
* 触发 daemon 端停止采集并回传 profile JSON。
* @returns 成功返回 profile 对象；失败/未启用返回 null（不抛）。
*/
async function stopDaemonProfiling() {
	if (!_daemonConnection) return null;
	try {
		const res = await _daemonConnection.invoke(require_perf_profiler_handlers.PERF_PROFILER_STOP_CHANNEL);
		if (!res?.ok) {
			require_logger.mainLog.warn("[PerfProfiler] daemon stop failed:", res?.error ?? "unknown");
			return null;
		}
		return res.profile ?? null;
	} catch (err) {
		require_logger.mainLog.warn("[PerfProfiler] daemon stop invoke threw:", String(err));
		return null;
	}
}
//#endregion
//#region src/main/features/performance/perf-enable-check.ts
/**
* 性能采集菜单启用判定
*
* 判定顺序（任一命中即启用）：
* 1. 环境变量 `WORKBUDDY_PERF_PROFILING=1`（开发/临时诊断兜底，不改文件）
* 2. `~/.workbuddy/settings.json` 的 `perfProfiling === true`（面向白名单用户长期开启）
*
* 判定结果在启动早期计算一次并缓存，供菜单构建器读取。
* 关闭方式：把 settings.json 的 `perfProfiling` 改成 false（或删掉），并 unset 环境变量后重启。
*/
require_app_instance.init_app_instance();
var PERF_ENV_KEY = "WORKBUDDY_PERF_PROFILING";
var SETTINGS_KEY = "perfProfiling";
var _enabled = false;
var _detected = false;
var _source = "none";
/** 读 settings.json 中的 perfProfiling 布尔位；任何异常返回 undefined（走 fallback） */
function readSettingsFlag() {
	try {
		const settingsPath = path.join(require_workbuddy_paths.getWorkbuddyConfigDir(), "settings.json");
		if (!fs.existsSync(settingsPath)) return;
		const raw = fs.readFileSync(settingsPath, "utf-8");
		const json = JSON.parse(raw);
		if (!json || typeof json !== "object" || Array.isArray(json)) return;
		const v = json[SETTINGS_KEY];
		return typeof v === "boolean" ? v : void 0;
	} catch (err) {
		require_logger.mainLog.warn("[PerfProfiler] Failed to read settings.json for perfProfiling flag:", String(err));
		return;
	}
}
/**
* 计算并缓存启用状态。启动早期调用一次；后续 `isPerfProfilingEnabled()` 直接读缓存。
* 返回是否启用。
*/
function detectPerfProfilingEnabled() {
	const envVal = process.env[PERF_ENV_KEY];
	if (envVal === "1" || envVal?.toLowerCase() === "true") {
		_enabled = true;
		_source = "env";
	} else if (readSettingsFlag() === true) {
		_enabled = true;
		_source = "settings";
	} else {
		_enabled = false;
		_source = "none";
	}
	_detected = true;
	if (_enabled) require_logger.mainLog.info(`[PerfProfiler] performance profiling enabled via ${_source}`);
	return _enabled;
}
/** 是否启用性能采集菜单 */
function isPerfProfilingEnabled() {
	if (!_detected) return detectPerfProfilingEnabled();
	return _enabled;
}
//#endregion
//#region src/main/features/performance/perf-menu-state-sync.ts
/**
* 将性能采集菜单状态同步给渲染进程 localStorage，供 Windows/Linux 自定义标题栏读取。
*
* macOS 走原生菜单：`buildAndSetApplicationMenu()` 直接读 {@link isPerfProfilingEnabled}
* 和 `getProfilingState()`，不依赖本文件。
*
* Windows/Linux 走渲染层菜单（`packages/workbuddy-app/src/components/menubar`），
* 只能通过 renderer 侧 storage 读取，因此这里把两个状态位（enabled、recordingState）
* 序列化到 `__perf_state__`，并派发 `perf-state-changed` 事件通知 renderer rebuild。
*
* 与 `ioa-im-actions.ts::syncIOAImStateToAllWindows` 同款注入模式，
* 差别只在两点：
*   1. 状态由 profiler 自己触发，而非用户点击 toggle
*   2. 事件名不同（`perf-state-changed`）
*/
function buildInjectionScript(state) {
	return `${state.enabled ? `localStorage.setItem('__perf_state__', ${JSON.stringify(JSON.stringify(state))})` : "localStorage.removeItem('__perf_state__')"}; ${`window.dispatchEvent(new CustomEvent('perf-state-changed', { detail: ${JSON.stringify(state)} }))`}`;
}
/**
* 广播当前性能采集状态到所有窗口 renderer。
* 由 cdp-profiler 在状态变化时（start/stop/timeout）调用。
*/
function syncPerfMenuStateToAllWindows() {
	const js = buildInjectionScript({
		enabled: isPerfProfilingEnabled(),
		recordingState: getProfilingState()
	});
	for (const win of electron.BrowserWindow.getAllWindows()) {
		if (win.isDestroyed()) continue;
		win.webContents.executeJavaScript(js).catch(() => {});
	}
}
//#endregion
//#region src/main/features/performance/perf-probe-script.ts
/**
* 渲染进程性能探针脚本
*
* 在「开始录制」时通过 executeJavaScript 注入到渲染进程中，
* 录制期间持续收集 DOM 查询、布局抖动、Observer 创建、Long Tasks 等数据。
* 「停止录制」时调用 window.__wbProbeCollect() 收集结果并返回 JSON。
*/
/** 注入到渲染进程的探针启动脚本 */
var PERF_PROBE_INJECT_SCRIPT = `
(function() {
  if (window.__wbProbeArmed) {
    console.warn('[perf-probe] 探针已在运行中');
    return;
  }
  window.__wbProbeArmed = true;

  const stats = {
    qsDoc: 0, qsEl: 0, qsAllDoc: 0, qsAllEl: 0,
    getBCR: 0, getCS: 0,
    moCreated: 0, roCreated: 0, ioCreated: 0,
    raf: 0, longTasks: [],
  };
  const qsByCallsite = new Map();
  const slowQs = [];
  const start = performance.now();

  // ── Hook querySelector / querySelectorAll ──
  const origQsDoc = Document.prototype.querySelector;
  const origQsEl  = Element.prototype.querySelector;
  const origQsaDoc = Document.prototype.querySelectorAll;
  const origQsaEl  = Element.prototype.querySelectorAll;

  function recordCallsite(selector) {
    const stack = (new Error()).stack || '';
    const lines = stack.split('\\n');
    const callsite = (lines[3] || lines[2] || 'unknown')
      .trim()
      .replace(/^at\\s+/, '')
      .slice(0, 120);
    const key = selector + '  @  ' + callsite;
    qsByCallsite.set(key, (qsByCallsite.get(key) || 0) + 1);
  }

  Document.prototype.querySelector = function(sel) {
    stats.qsDoc++;
    const t0 = performance.now();
    const r = origQsDoc.apply(this, arguments);
    const dt = performance.now() - t0;
    if (dt > 5) slowQs.push({ sel, ms: +dt.toFixed(1), where: 'doc' });
    recordCallsite(sel);
    return r;
  };
  Element.prototype.querySelector = function(sel) {
    stats.qsEl++;
    const t0 = performance.now();
    const r = origQsEl.apply(this, arguments);
    const dt = performance.now() - t0;
    if (dt > 5) slowQs.push({ sel, ms: +dt.toFixed(1), where: 'el' });
    recordCallsite(sel);
    return r;
  };
  Document.prototype.querySelectorAll = function(sel) {
    stats.qsAllDoc++;
    return origQsaDoc.apply(this, arguments);
  };
  Element.prototype.querySelectorAll = function(sel) {
    stats.qsAllEl++;
    return origQsaEl.apply(this, arguments);
  };

  // ── Hook getBoundingClientRect / getComputedStyle ──
  const origGBCR = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function() {
    stats.getBCR++;
    return origGBCR.apply(this, arguments);
  };
  const origGCS = window.getComputedStyle;
  window.getComputedStyle = function() {
    stats.getCS++;
    return origGCS.apply(this, arguments);
  };

  // ── Hook MutationObserver / ResizeObserver / IntersectionObserver ──
  const OrigMO = window.MutationObserver;
  window.MutationObserver = class extends OrigMO {
    constructor(cb) { super(cb); stats.moCreated++; }
  };
  var OrigRO = window.ResizeObserver || null;
  if (OrigRO) {
    window.ResizeObserver = class extends OrigRO {
      constructor(cb) { super(cb); stats.roCreated++; }
    };
  }
  var OrigIO = window.IntersectionObserver || null;
  if (OrigIO) {
    window.IntersectionObserver = class extends OrigIO {
      constructor(cb, opt) { super(cb, opt); stats.ioCreated++; }
    };
  }

  // ── Hook requestAnimationFrame ──
  const origRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function(cb) {
    stats.raf++;
    return origRAF.apply(this, arguments);
  };

  // ── Long Task Observer ──
  let lto;
  try {
    lto = new PerformanceObserver(function(list) {
      list.getEntries().forEach(function(e) {
        if (e.duration > 50) {
          stats.longTasks.push({ start: +e.startTime.toFixed(0), dur: +e.duration.toFixed(0) });
        }
      });
    });
    lto.observe({ entryTypes: ['longtask'] });
  } catch(e) { /* not supported */ }

  // ── 初始浮层快照 ──
  const floatingSelector = '[data-floating-ui-portal],[data-floating-ui-focusable],[role="tooltip"],[data-radix-popper-content-wrapper],.floating-ui,.tippy-box';
  const floatingNow = document.querySelectorAll(floatingSelector).length;

  // ── 收集函数（停止录制时由主进程调用） ──
  window.__wbProbeCollect = function() {
    // 还原所有 hook（包括 ResizeObserver / IntersectionObserver）
    Document.prototype.querySelector = origQsDoc;
    Element.prototype.querySelector = origQsEl;
    Document.prototype.querySelectorAll = origQsaDoc;
    Element.prototype.querySelectorAll = origQsaEl;
    Element.prototype.getBoundingClientRect = origGBCR;
    window.getComputedStyle = origGCS;
    window.MutationObserver = OrigMO;
    if (window.ResizeObserver && OrigRO) window.ResizeObserver = OrigRO;
    if (window.IntersectionObserver && OrigIO) window.IntersectionObserver = OrigIO;
    window.requestAnimationFrame = origRAF;
    if (lto) lto.disconnect();

    const elapsedSec = +((performance.now() - start) / 1000).toFixed(1);
    const floatingAfter = document.querySelectorAll(floatingSelector).length;

    const topCallsites = [...qsByCallsite.entries()]
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, 20)
      .map(function(entry) { return { count: entry[1], where: entry[0] }; });

    const report = {
      elapsedSec: elapsedSec,
      domQuery: {
        qsDoc: stats.qsDoc,
        qsEl: stats.qsEl,
        qsAllDoc: stats.qsAllDoc,
        qsAllEl: stats.qsAllEl,
        total: stats.qsDoc + stats.qsEl + stats.qsAllDoc + stats.qsAllEl,
      },
      layoutThrashing: {
        getBoundingClientRect: stats.getBCR,
        getComputedStyle: stats.getCS,
      },
      observers: {
        MutationObserver: stats.moCreated,
        ResizeObserver: stats.roCreated,
        IntersectionObserver: stats.ioCreated,
      },
      rAF: stats.raf,
      floating: {
        initial: floatingNow,
        final: floatingAfter,
      },
      longTasks: stats.longTasks,
      slowQueries: slowQs.slice(0, 50),
      topCallsites: topCallsites,
    };

    delete window.__wbProbeArmed;
    delete window.__wbProbeCollect;
    return JSON.stringify(report);
  };

  console.log('[perf-probe] 探针已注入，正在采集性能数据...');
})();
`;
/** 从渲染进程收集探针数据的脚本 */
var PERF_PROBE_COLLECT_SCRIPT = `
(function() {
  if (typeof window.__wbProbeCollect === 'function') {
    return window.__wbProbeCollect();
  }
  return null;
})();
`;
//#endregion
//#region src/main/features/performance/trace-parser.ts
/**
* Trace 数据解析器
*
* 从 trace.json 中提取结构化性能事件和时间分布统计。
* 参考 perf-mcp 的解析逻辑，适配 WorkBuddy 的性能分析链路。
*/
var SCRIPTING_NAMES = new Set([
	"EvaluateScript",
	"FunctionCall",
	"v8.compile",
	"v8.evaluateModule",
	"v8.run",
	"MinorGC",
	"MajorGC",
	"GCEvent",
	"RunMicrotasks",
	"RunTask"
]);
var SCRIPTING_KEYWORDS = [
	"v8.",
	"Script",
	"Compile",
	"RunMicro",
	"EvaluateModule"
];
var RENDERING_NAMES = new Set([
	"Layout",
	"UpdateLayoutTree",
	"RecalculateStyles",
	"ParseHTML",
	"ParseAuthorStyleSheet"
]);
var PAINTING_NAMES = new Set([
	"Paint",
	"PrePaint",
	"RasterTask",
	"CompositeLayers",
	"Draw",
	"DrawFrame"
]);
var GC_KEYWORDS = [
	"GC",
	"MajorGC",
	"MinorGC"
];
function classify(ev) {
	const n = ev.name || "";
	if (n === "(idle)" || n === "Idle") return "idle";
	if (GC_KEYWORDS.some((k) => n.includes(k))) return "gc";
	if (SCRIPTING_NAMES.has(n) || SCRIPTING_KEYWORDS.some((k) => n.includes(k))) return "scripting";
	if (RENDERING_NAMES.has(n)) return "rendering";
	if (PAINTING_NAMES.has(n)) return "painting";
	return "other";
}
/**
* 从 trace 数据中提取结构化事件：Long Tasks / GC / Layout / Paint
*/
function extractTraceEvents(trace) {
	const events = trace.traceEvents || [];
	const longTasks = [];
	const gcPauses = [];
	const layoutEvents = [];
	const paintEvents = [];
	for (const ev of events) {
		if (ev.ph !== "X" || typeof ev.dur !== "number") continue;
		const dur_us = ev.dur;
		const name = ev.name || "";
		if (name === "RunTask" && dur_us >= 5e4) longTasks.push({
			ts_us: ev.ts,
			dur_ms: +(dur_us / 1e3).toFixed(2),
			tid: ev.tid
		});
		if (GC_KEYWORDS.some((k) => name.includes(k))) gcPauses.push({
			name,
			ts_us: ev.ts,
			dur_ms: +(dur_us / 1e3).toFixed(2)
		});
		if (RENDERING_NAMES.has(name)) layoutEvents.push({
			name,
			ts_us: ev.ts,
			dur_ms: +(dur_us / 1e3).toFixed(2)
		});
		if (PAINTING_NAMES.has(name)) paintEvents.push({
			name,
			ts_us: ev.ts,
			dur_ms: +(dur_us / 1e3).toFixed(2)
		});
	}
	longTasks.sort((a, b) => b.dur_ms - a.dur_ms);
	gcPauses.sort((a, b) => b.dur_ms - a.dur_ms);
	return {
		counts: {
			longTasks: longTasks.length,
			gcPauses: gcPauses.length,
			layoutEvents: layoutEvents.length,
			paintEvents: paintEvents.length,
			totalEvents: events.length
		},
		totals: {
			longTaskMs: +longTasks.reduce((s, x) => s + x.dur_ms, 0).toFixed(1),
			gcMs: +gcPauses.reduce((s, x) => s + x.dur_ms, 0).toFixed(1),
			maxLongTaskMs: longTasks[0]?.dur_ms || 0
		},
		longTasksTop: longTasks.slice(0, 20),
		gcPausesTop: gcPauses.slice(0, 20),
		layoutTop: layoutEvents.sort((a, b) => b.dur_ms - a.dur_ms).slice(0, 10),
		paintTop: paintEvents.sort((a, b) => b.dur_ms - a.dur_ms).slice(0, 10)
	};
}
/**
* 计算 trace 的时间分布：scripting / rendering / painting / gc / idle / other
*/
function computeTimeBreakdown(trace) {
	const events = trace.traceEvents || [];
	const buckets = {
		scripting: 0,
		rendering: 0,
		painting: 0,
		gc: 0,
		idle: 0,
		other: 0
	};
	let minTs = Infinity;
	let maxTs = -Infinity;
	for (const ev of events) if (ev.ph === "X" && typeof ev.dur === "number") {
		const cls = classify(ev);
		buckets[cls] += ev.dur;
		if (ev.ts < minTs) minTs = ev.ts;
		if (ev.ts + ev.dur > maxTs) maxTs = ev.ts + ev.dur;
	}
	const wallUs = maxTs > minTs ? maxTs - minTs : 0;
	const pct = (us) => wallUs > 0 ? +(us / wallUs * 100).toFixed(2) : 0;
	return {
		totalMs: +(wallUs / 1e3).toFixed(1),
		scriptingMs: +(buckets.scripting / 1e3).toFixed(1),
		scriptingPct: pct(buckets.scripting),
		renderingMs: +(buckets.rendering / 1e3).toFixed(1),
		renderingPct: pct(buckets.rendering),
		paintingMs: +(buckets.painting / 1e3).toFixed(1),
		paintingPct: pct(buckets.painting),
		gcMs: +(buckets.gc / 1e3).toFixed(1),
		gcPct: pct(buckets.gc),
		idleMs: +(buckets.idle / 1e3).toFixed(1),
		idlePct: pct(buckets.idle),
		otherMs: +(buckets.other / 1e3).toFixed(1),
		otherPct: pct(buckets.other)
	};
}
/**
* 解析 V8 CPU Profile，返回 Top 热点函数和文件聚合
*/
function parseCpuProfile(profile) {
	const { nodes, samples, timeDeltas, startTime, endTime } = profile;
	const totalUs = endTime - startTime;
	const selfTime = /* @__PURE__ */ new Map();
	for (let i = 0; i < samples.length; i++) {
		const id = samples[i];
		const dt = timeDeltas[i] || 0;
		selfTime.set(id, (selfTime.get(id) || 0) + dt);
	}
	const parentOf = /* @__PURE__ */ new Map();
	for (const n of nodes) {
		if (!n.children) continue;
		for (const c of n.children) parentOf.set(c, n.id);
	}
	const totalTime = /* @__PURE__ */ new Map();
	for (let i = 0; i < samples.length; i++) {
		const dt = timeDeltas[i] || 0;
		let cur = samples[i];
		while (cur !== void 0) {
			totalTime.set(cur, (totalTime.get(cur) || 0) + dt);
			cur = parentOf.get(cur);
		}
	}
	const byUrl = /* @__PURE__ */ new Map();
	const ranked = nodes.map((n) => {
		const cf = n.callFrame || {};
		return {
			func: cf.functionName || "(anonymous)",
			url: cf.url || "",
			line: cf.lineNumber,
			self_us: selfTime.get(n.id) || 0,
			total_us: totalTime.get(n.id) || 0
		};
	});
	for (const r of ranked) {
		const u = r.url || "(internal)";
		byUrl.set(u, (byUrl.get(u) || 0) + r.self_us);
	}
	const topSelf = [...ranked].sort((a, b) => b.self_us - a.self_us).slice(0, 30).map((r) => ({
		func: r.func,
		url: r.url,
		line: r.line,
		self_ms: +(r.self_us / 1e3).toFixed(2),
		self_pct: +(r.self_us / totalUs * 100).toFixed(2),
		total_ms: +(r.total_us / 1e3).toFixed(2)
	}));
	const topTotal = [...ranked].sort((a, b) => b.total_us - a.total_us).slice(0, 30).map((r) => ({
		func: r.func,
		url: r.url,
		line: r.line,
		total_ms: +(r.total_us / 1e3).toFixed(2),
		total_pct: +(r.total_us / totalUs * 100).toFixed(2),
		self_ms: +(r.self_us / 1e3).toFixed(2)
	}));
	const urlRank = [...byUrl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([url, us]) => ({
		url,
		self_ms: +(us / 1e3).toFixed(1),
		pct: +(us / totalUs * 100).toFixed(2)
	}));
	const idle_us = ranked.find((r) => r.func === "(idle)")?.self_us || 0;
	const gc_us = ranked.find((r) => r.func === "(garbage collector)")?.self_us || 0;
	return {
		summary: {
			durationMs: +(totalUs / 1e3).toFixed(0),
			sampleCount: samples.length,
			idle_ms: +(idle_us / 1e3).toFixed(2),
			gc_ms: +(gc_us / 1e3).toFixed(2),
			busy_pct: +((totalUs - idle_us) / totalUs * 100).toFixed(1)
		},
		topSelf,
		topTotal,
		urlRank
	};
}
//#endregion
//#region src/main/features/performance/cdp-profiler.ts
/**
* Performance Profiler
*
* 通过 Electron 内置的 `webContents.debugger`（进程内 CDP，无需 --remote-debugging-port）
* 采集 DevTools Performance 级别的数据。
* 是否启用由 {@link ./perf-enable-check.ts} 判定（settings.json.perfProfiling 或 WORKBUDDY_PERF_PROFILING）。
*
* 录制期间同时启动：
* 1. CDP Tracing domain — 等同 DevTools Performance 面板录制（含 JS Profiling、渲染、布局、Paint）
* 2. CDP Profiler domain — V8 CPU Profile（精确到函数级别的调用栈采样）
* 3. 主进程 node:inspector Profiler — 主进程 V8 CPU Profile
* 4. 渲染进程探针 — DOM 查询频率、布局抖动、Observer 创建、Long Tasks 等应用层指标
*/
/**
* 刷新采集菜单状态。
* - macOS：rebuild 原生菜单（走 `buildAndSetApplicationMenu`）。
* - Windows/Linux：写 `__perf_state__` 到 renderer localStorage 并派发 CustomEvent，
*   自定义标题栏收到后 rebuild 菜单，避免"开始录制"/"完成录制"按钮态与实际状态脱节。
*
* 动态 import 避免与 menu-builder.ts 相互引用（menu-builder 里已 import 本文件的
* `getProfilingState` / `isPerfProfilingEnabled`）。
*/
function refreshMenu() {
	Promise.resolve().then(() => require("./menu-builder2.js")).then(({ buildAndSetApplicationMenu }) => {
		buildAndSetApplicationMenu();
	}).catch(() => {});
	syncPerfMenuStateToAllWindows();
}
/** 录制最大时长（5 分钟），超时自动停止 */
var RECORDING_TIMEOUT_MS = 300 * 1e3;
/** 单例状态 */
var _profilingState = "idle";
/** 录制开始时间戳（用于限定日志时间范围） */
var _recordingStartTime = null;
/** 录制超时定时器 */
var _recordingTimer = null;
/** 用户关联的代码目录（Agent 分析时的工作目录） */
var _associatedProjectDir = null;
/** 关联目录的 Git 分支 */
var _associatedGitInfo = null;
/** Trace 事件数量上限（约 200 万事件 ≈ 500MB，防止长录制 OOM） */
var MAX_TRACE_EVENTS = 2e6;
/** CDP Tracing 事件缓冲 */
var _traceEvents = [];
/** Trace 事件是否已溢出 */
var _traceEventsOverflow = false;
/** dataCollected 监听器引用（用于录制结束后显式移除，防止泄漏） */
var _traceDataHandler = null;
/** V8 CPU Profile 数据（渲染进程） */
var _cpuProfile = null;
/** Performance.getMetrics 录制前基线 */
var _perfMetricsStart = null;
/** 主进程 inspector session（用于主进程 CPU Profile） */
var _mainProcessSession = null;
/** 主进程 CPU Profile 数据 */
var _mainProcessCpuProfile = null;
/** daemon 进程 CPU Profile 数据（通过 stdio RPC 从 daemon 回传） */
var _daemonCpuProfile = null;
/** perf-analysis 输出目录 */
function getPerfAnalysisDir() {
	return path.join(os.homedir(), ".workbuddy", "perf-analysis");
}
/** 保留天数 */
var RETENTION_DAYS = 3;
/**
* 清理超过 RETENTION_DAYS（3 天）的 session 采集数据。
* 走 fs.promises，异步 fire-and-forget，不阻塞任何主流程。
* 每次成功停止录制后触发一次即可（见 stopProfiling 结尾）。
*/
async function cleanupExpiredSessions() {
	const dir = getPerfAnalysisDir();
	const now = Date.now();
	const maxAge = RETENTION_DAYS * 24 * 60 * 60 * 1e3;
	try {
		const entries = await fs.promises.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (!entry.isDirectory() || !entry.name.startsWith("session-")) continue;
			const tsStr = entry.name.replace("session-", "").replace(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, "$1T$2:$3:$4.$5Z");
			const sessionTime = new Date(tsStr).getTime();
			if (isNaN(sessionTime) || now - sessionTime > maxAge) {
				const sessionPath = path.join(dir, entry.name);
				await fs.promises.rm(sessionPath, {
					recursive: true,
					force: true
				});
				require_logger.mainLog.info(`[PerfProfiler] Cleaned expired session: ${entry.name}`);
			}
		}
	} catch (err) {
		if (err?.code !== "ENOENT") require_logger.mainLog.warn("[PerfProfiler] Failed to cleanup expired sessions:", String(err));
	}
}
/** 获取当前采集状态 */
function getProfilingState() {
	return _profilingState;
}
/**
* 开始性能录制
* - 通过 CDP Tracing domain 启动 DevTools Performance 级别的 trace 采集
* - 通过 CDP Profiler domain 启动 V8 CPU Profiling
* - 注入渲染进程探针脚本
*/
async function startProfiling() {
	if (_profilingState === "recording") {
		require_logger.mainLog.warn("[PerfProfiler] Already recording, ignoring duplicate start request");
		return;
	}
	const win = electron.BrowserWindow.getFocusedWindow() || electron.BrowserWindow.getAllWindows()[0];
	if (!win || win.isDestroyed()) {
		require_logger.mainLog.error("[PerfProfiler] No active window found, cannot start profiling");
		return;
	}
	const { app: electronApp } = await import("electron");
	if (!electronApp.isPackaged) {
		_associatedProjectDir = process.cwd();
		require_logger.mainLog.info(`[PerfProfiler] Dev mode detected, auto-associated project dir: ${_associatedProjectDir}`);
	} else {
		const { canceled, filePaths } = await electron.dialog.showOpenDialog(win, {
			title: "选择关联的代码目录（可选）",
			message: "选择要分析的项目代码目录，Agent 将结合代码进行深度分析。\n请确保已切换到对应的 Git 分支。\n如不需要可直接取消。",
			buttonLabel: "关联此目录",
			properties: ["openDirectory"]
		});
		_associatedProjectDir = !canceled && filePaths[0] ? filePaths[0] : null;
	}
	let _associatedGitBranch = null;
	if (_associatedProjectDir) try {
		const { execSync } = await import("child_process");
		_associatedGitBranch = execSync("git rev-parse --abbrev-ref HEAD", {
			cwd: _associatedProjectDir,
			encoding: "utf-8",
			timeout: 5e3
		}).trim();
		require_logger.mainLog.info(`[PerfProfiler] Associated project: ${_associatedProjectDir} (branch: ${_associatedGitBranch})`);
	} catch {
		require_logger.mainLog.info(`[PerfProfiler] Associated project: ${_associatedProjectDir} (git branch detection failed)`);
	}
	_associatedGitInfo = _associatedGitBranch;
	_profilingState = "recording";
	_traceEvents = [];
	_cpuProfile = null;
	_recordingStartTime = /* @__PURE__ */ new Date();
	refreshMenu();
	require_logger.mainLog.info("[PerfProfiler] Starting CDP performance trace recording...");
	const debugger_ = win.webContents.debugger;
	try {
		if (!debugger_.isAttached()) debugger_.attach("1.3");
		_traceDataHandler = (_event, method, params) => {
			if (method === "Tracing.dataCollected") {
				if (params?.value && Array.isArray(params.value)) {
					if (_traceEvents.length < MAX_TRACE_EVENTS) _traceEvents.push(...params.value);
					else if (!_traceEventsOverflow) {
						_traceEventsOverflow = true;
						require_logger.mainLog.warn(`[PerfProfiler] Trace events exceeded limit (${MAX_TRACE_EVENTS}), dropping new events`);
					}
				}
			}
		};
		debugger_.on("message", _traceDataHandler);
		await debugger_.sendCommand("Tracing.start", {
			transferMode: "ReportEvents",
			traceConfig: {
				includedCategories: [
					"-*",
					"devtools.timeline",
					"v8.execute",
					"disabled-by-default-devtools.timeline",
					"disabled-by-default-devtools.timeline.frame",
					"toplevel",
					"blink.console",
					"blink.user_timing",
					"latencyInfo",
					"disabled-by-default-devtools.timeline.stack",
					"disabled-by-default-v8.cpu_profiler",
					"disabled-by-default-v8.cpu_profiler.hires"
				],
				excludedCategories: ["*"]
			}
		});
		require_logger.mainLog.info("[PerfProfiler] CDP Tracing.start OK");
		await debugger_.sendCommand("Profiler.enable", {});
		await debugger_.sendCommand("Profiler.start", {});
		require_logger.mainLog.info("[PerfProfiler] CDP Profiler.start OK");
		await debugger_.sendCommand("Performance.enable", {});
		_perfMetricsStart = (await debugger_.sendCommand("Performance.getMetrics", {}))?.metrics ?? null;
		require_logger.mainLog.info("[PerfProfiler] Performance baseline metrics captured");
	} catch (err) {
		require_logger.mainLog.error("[PerfProfiler] Failed to start CDP tracing:", String(err));
		_profilingState = "idle";
		if (debugger_.isAttached()) debugger_.detach();
		return;
	}
	try {
		_mainProcessSession = new (await (import("node:inspector"))).Session();
		_mainProcessSession.connect();
		await new Promise((resolve, reject) => {
			_mainProcessSession.post("Profiler.enable", (err) => err ? reject(err) : resolve());
		});
		await new Promise((resolve, reject) => {
			_mainProcessSession.post("Profiler.start", (err) => err ? reject(err) : resolve());
		});
		require_logger.mainLog.info("[PerfProfiler] Main process CPU Profiler started");
	} catch (err) {
		require_logger.mainLog.warn("[PerfProfiler] Failed to start main process profiling:", String(err));
		_mainProcessSession = null;
	}
	if (await startDaemonProfiling()) require_logger.mainLog.info("[PerfProfiler] Daemon CPU Profiler started");
	try {
		await win.webContents.executeJavaScript(PERF_PROBE_INJECT_SCRIPT);
		require_logger.mainLog.info("[PerfProfiler] Renderer probe injected");
	} catch (err) {
		require_logger.mainLog.warn("[PerfProfiler] Failed to inject renderer probe:", String(err));
	}
	win.webContents.send("perf:recording-state-changed", "recording");
	require_logger.mainLog.info("[PerfProfiler] Performance recording started");
	_recordingTimer = setTimeout(async () => {
		if (_profilingState !== "recording") return;
		require_logger.mainLog.warn(`[PerfProfiler] Recording timed out after ${RECORDING_TIMEOUT_MS / 1e3}s, auto-stopping`);
		const outputDir = await stopProfiling();
		if (outputDir) {
			const { shell } = await import("electron");
			shell.openPath(outputDir).catch(() => {});
			electron.dialog.showMessageBox({
				type: "info",
				message: "性能录制已自动停止",
				detail: `录制已达到最大时长（${RECORDING_TIMEOUT_MS / 6e4} 分钟），已自动停止并保存数据。\n\n数据目录：\n${outputDir}`,
				buttons: ["好的"]
			}).catch(() => {});
		}
	}, RECORDING_TIMEOUT_MS);
}
/**
* 停止性能录制，收集所有 CDP 数据并保存到 perf-analysis 目录
* @returns 输出目录路径
*/
async function stopProfiling() {
	if (_profilingState !== "recording") {
		require_logger.mainLog.warn("[PerfProfiler] Not currently recording, ignoring stop request");
		return;
	}
	_profilingState = "stopping";
	if (_recordingTimer) {
		clearTimeout(_recordingTimer);
		_recordingTimer = null;
	}
	refreshMenu();
	require_logger.mainLog.info("[PerfProfiler] Stopping CDP performance trace recording...");
	const win = electron.BrowserWindow.getFocusedWindow() || electron.BrowserWindow.getAllWindows()[0];
	if (!win || win.isDestroyed()) {
		require_logger.mainLog.error("[PerfProfiler] No active window, cannot stop profiling");
		_profilingState = "idle";
		return;
	}
	const debugger_ = win.webContents.debugger;
	const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
	const outputDir = path.join(getPerfAnalysisDir(), `session-${timestamp}`);
	fs.mkdirSync(outputDir, { recursive: true });
	let perfMetricsEnd = null;
	try {
		_cpuProfile = (await debugger_.sendCommand("Profiler.stop", {}))?.profile ?? null;
		await debugger_.sendCommand("Profiler.disable", {});
		require_logger.mainLog.info("[PerfProfiler] CDP Profiler.stop OK");
		perfMetricsEnd = (await debugger_.sendCommand("Performance.getMetrics", {}))?.metrics ?? null;
		await debugger_.sendCommand("Performance.disable", {}).catch(() => {});
		if (_mainProcessSession) try {
			_mainProcessCpuProfile = await new Promise((resolve, reject) => {
				_mainProcessSession.post("Profiler.stop", (err, result) => {
					if (err) reject(err);
					else resolve(result?.profile ?? null);
				});
			});
			_mainProcessSession.post("Profiler.disable", () => {});
			_mainProcessSession.disconnect();
			_mainProcessSession = null;
			require_logger.mainLog.info("[PerfProfiler] Main process CPU Profiler stopped");
		} catch (err) {
			require_logger.mainLog.warn("[PerfProfiler] Failed to stop main process profiler:", String(err));
		}
		_daemonCpuProfile = await stopDaemonProfiling();
		if (_daemonCpuProfile) require_logger.mainLog.info("[PerfProfiler] Daemon CPU Profiler stopped");
		const TRACING_END_TIMEOUT_MS = 6e4;
		await new Promise((resolve) => {
			let done = false;
			const finish = () => {
				if (!done) {
					done = true;
					resolve();
				}
			};
			const onMessage = (_event, method) => {
				if (method === "Tracing.tracingComplete") {
					clearTimeout(timer);
					debugger_.removeListener("message", onMessage);
					finish();
				}
			};
			const timer = setTimeout(() => {
				debugger_.removeListener("message", onMessage);
				require_logger.mainLog.warn(`[PerfProfiler] Tracing.tracingComplete timed out after ${TRACING_END_TIMEOUT_MS}ms, proceeding with collected data`);
				finish();
			}, TRACING_END_TIMEOUT_MS);
			debugger_.on("message", onMessage);
			debugger_.sendCommand("Tracing.end", {}).catch(() => {
				clearTimeout(timer);
				debugger_.removeListener("message", onMessage);
				finish();
			});
		});
		if (_traceDataHandler) {
			debugger_.removeListener("message", _traceDataHandler);
			_traceDataHandler = null;
		}
		require_logger.mainLog.info(`[PerfProfiler] CDP Tracing.end OK, collected ${_traceEvents.length} events${_traceEventsOverflow ? " (truncated)" : ""}`);
	} catch (err) {
		require_logger.mainLog.error("[PerfProfiler] Error stopping CDP tracing:", String(err));
	} finally {
		if (debugger_.isAttached()) debugger_.detach();
	}
	const traceFile = path.join(outputDir, "trace.json");
	const traceData = JSON.stringify({
		traceEvents: _traceEvents,
		metadata: { "trace-capture": "workbuddy-perf-profiler" }
	});
	fs.writeFileSync(traceFile, traceData, "utf-8");
	const traceSizeMB = (Buffer.byteLength(traceData) / (1024 * 1024)).toFixed(2);
	require_logger.mainLog.info(`[PerfProfiler] trace.json saved (${traceSizeMB} MB, ${_traceEvents.length} events)`);
	if (_cpuProfile) {
		const cpuProfileFile = path.join(outputDir, "cpu-profile.cpuprofile");
		fs.writeFileSync(cpuProfileFile, JSON.stringify(_cpuProfile, null, 2), "utf-8");
		require_logger.mainLog.info("[PerfProfiler] cpu-profile.cpuprofile saved (renderer)");
	}
	if (_mainProcessCpuProfile) {
		const mainCpuFile = path.join(outputDir, "main-process-cpu-profile.cpuprofile");
		fs.writeFileSync(mainCpuFile, JSON.stringify(_mainProcessCpuProfile, null, 2), "utf-8");
		require_logger.mainLog.info("[PerfProfiler] main-process-cpu-profile.cpuprofile saved");
		try {
			const mainCpuParsed = parseCpuProfile(_mainProcessCpuProfile);
			fs.writeFileSync(path.join(outputDir, "main-process-cpu-profile-parsed.json"), JSON.stringify(mainCpuParsed, null, 2), "utf-8");
			require_logger.mainLog.info("[PerfProfiler] main-process-cpu-profile-parsed.json saved");
		} catch (err) {
			require_logger.mainLog.warn("[PerfProfiler] Failed to parse main process CPU profile:", String(err));
		}
	}
	if (_daemonCpuProfile) {
		const daemonCpuFile = path.join(outputDir, "daemon-cpu-profile.cpuprofile");
		fs.writeFileSync(daemonCpuFile, JSON.stringify(_daemonCpuProfile, null, 2), "utf-8");
		require_logger.mainLog.info("[PerfProfiler] daemon-cpu-profile.cpuprofile saved");
		try {
			const daemonCpuParsed = parseCpuProfile(_daemonCpuProfile);
			fs.writeFileSync(path.join(outputDir, "daemon-cpu-profile-parsed.json"), JSON.stringify(daemonCpuParsed, null, 2), "utf-8");
			require_logger.mainLog.info("[PerfProfiler] daemon-cpu-profile-parsed.json saved");
		} catch (err) {
			require_logger.mainLog.warn("[PerfProfiler] Failed to parse daemon CPU profile:", String(err));
		}
	}
	try {
		const traceObj = { traceEvents: _traceEvents };
		const traceEventsExtract = extractTraceEvents(traceObj);
		const timeBreakdown = computeTimeBreakdown(traceObj);
		fs.writeFileSync(path.join(outputDir, "trace-events-extract.json"), JSON.stringify(traceEventsExtract, null, 2), "utf-8");
		fs.writeFileSync(path.join(outputDir, "time-breakdown.json"), JSON.stringify(timeBreakdown, null, 2), "utf-8");
		require_logger.mainLog.info("[PerfProfiler] trace-events-extract.json + time-breakdown.json saved");
	} catch (err) {
		require_logger.mainLog.warn("[PerfProfiler] Failed to parse trace:", String(err));
	}
	if (_cpuProfile) try {
		const cpuParsed = parseCpuProfile(_cpuProfile);
		fs.writeFileSync(path.join(outputDir, "cpu-profile-parsed.json"), JSON.stringify(cpuParsed, null, 2), "utf-8");
		require_logger.mainLog.info(`[PerfProfiler] cpu-profile-parsed.json saved (top ${cpuParsed.topSelf.length} functions)`);
	} catch (err) {
		require_logger.mainLog.warn("[PerfProfiler] Failed to parse CPU profile:", String(err));
	}
	if (_perfMetricsStart && perfMetricsEnd) try {
		const toMap = (metrics) => Object.fromEntries(metrics.map((m) => [m.name, m.value]));
		const startMap = toMap(_perfMetricsStart);
		const endMap = toMap(perfMetricsEnd);
		const diff = {};
		for (const key of Object.keys(endMap)) diff[key] = {
			start: startMap[key] ?? 0,
			end: endMap[key],
			delta: endMap[key] - (startMap[key] ?? 0)
		};
		fs.writeFileSync(path.join(outputDir, "perf-metrics-diff.json"), JSON.stringify({
			start: startMap,
			end: endMap,
			diff
		}, null, 2), "utf-8");
		require_logger.mainLog.info("[PerfProfiler] perf-metrics-diff.json saved");
	} catch (err) {
		require_logger.mainLog.warn("[PerfProfiler] Failed to save perf metrics diff:", String(err));
	}
	let probeReport = null;
	try {
		const rawResult = await win.webContents.executeJavaScript(PERF_PROBE_COLLECT_SCRIPT);
		if (rawResult) {
			probeReport = JSON.parse(rawResult);
			require_logger.mainLog.info("[PerfProfiler] Renderer probe data collected");
		}
	} catch (err) {
		require_logger.mainLog.warn("[PerfProfiler] Failed to collect renderer probe data:", String(err));
	}
	win.webContents.send("perf:recording-state-changed", "idle");
	if (probeReport) {
		const probeFile = path.join(outputDir, "probe-report.json");
		fs.writeFileSync(probeFile, JSON.stringify(probeReport, null, 2), "utf-8");
		require_logger.mainLog.info("[PerfProfiler] Probe report saved");
	}
	const summary = {
		sessionId: `session-${timestamp}`,
		associatedProjectDir: _associatedProjectDir,
		associatedGitBranch: _associatedGitInfo,
		recordingStartTime: _recordingStartTime?.toISOString() ?? null,
		recordingEndTime: (/* @__PURE__ */ new Date()).toISOString(),
		timestamp: (/* @__PURE__ */ new Date()).toISOString(),
		files: {
			trace: "trace.json",
			traceEventsExtract: "trace-events-extract.json",
			timeBreakdown: "time-breakdown.json",
			cpuProfile: _cpuProfile ? "cpu-profile.cpuprofile" : null,
			cpuProfileParsed: _cpuProfile ? "cpu-profile-parsed.json" : null,
			mainProcessCpuProfile: _mainProcessCpuProfile ? "main-process-cpu-profile.cpuprofile" : null,
			mainProcessCpuProfileParsed: _mainProcessCpuProfile ? "main-process-cpu-profile-parsed.json" : null,
			daemonCpuProfile: _daemonCpuProfile ? "daemon-cpu-profile.cpuprofile" : null,
			daemonCpuProfileParsed: _daemonCpuProfile ? "daemon-cpu-profile-parsed.json" : null,
			perfMetricsDiff: _perfMetricsStart && perfMetricsEnd ? "perf-metrics-diff.json" : null,
			probeReport: probeReport ? "probe-report.json" : null
		},
		stats: {
			traceEvents: _traceEvents.length,
			traceSizeMB: parseFloat(traceSizeMB)
		},
		appVersion: process.env.npm_package_version || "unknown",
		platform: process.platform,
		arch: process.arch,
		electronVersion: process.versions.electron || "unknown"
	};
	fs.writeFileSync(path.join(outputDir, "summary.json"), JSON.stringify(summary, null, 2), "utf-8");
	_traceEvents = [];
	_traceEventsOverflow = false;
	_traceDataHandler = null;
	_cpuProfile = null;
	_mainProcessCpuProfile = null;
	_daemonCpuProfile = null;
	_perfMetricsStart = null;
	_profilingState = "idle";
	refreshMenu();
	setImmediate(() => {
		cleanupExpiredSessions().catch(() => {});
	});
	return outputDir;
}
/**
* 仅停止录制并保存数据（不启动 Agent 分析）
* 适用于测试人员：采集数据后手动提 Bug 单附件
*/
async function stopProfilingOnly() {
	const outputDir = await stopProfiling();
	if (!outputDir) {
		electron.dialog.showMessageBox({
			type: "warning",
			message: "未检测到正在进行的性能录制",
			detail: "请先点击「开始录制性能采集」开始录制。",
			buttons: ["确定"]
		}).catch(() => {});
		return;
	}
	const { shell } = await import("electron");
	shell.openPath(outputDir).catch(() => {});
	electron.dialog.showMessageBox({
		type: "info",
		message: "性能采集已完成",
		detail: `采集数据已保存到：\n${outputDir}\n\n已为你打开该目录。\n可将整个文件夹压缩后附到 Bug 单中。`,
		buttons: ["好的"]
	}).catch(() => {});
	require_logger.mainLog.info(`[PerfProfiler] Recording stopped (no analysis). Data saved to: ${outputDir}`);
}
/**
* 停止录制并启动 Agent 会话进行性能分析
*/
async function stopProfilingAndAnalyze() {
	const outputDir = await stopProfiling();
	if (!outputDir) {
		electron.dialog.showMessageBox({
			type: "warning",
			message: "未检测到正在进行的性能录制",
			detail: "请先点击「开始录制性能采集」开始录制。",
			buttons: ["确定"]
		}).catch(() => {});
		return;
	}
	require_logger.mainLog.info(`[PerfProfiler] Data saved to ${outputDir}, launching Agent analysis session...`);
	const { app: electronApp } = await import("electron");
	const prompt = buildAnalysisPrompt(outputDir, _recordingStartTime ?? void 0, _associatedProjectDir ?? void 0, _associatedGitInfo ?? void 0, electronApp.getVersion());
	const promptFile = path.join(outputDir, "analysis-prompt.md");
	fs.writeFileSync(promptFile, prompt, "utf-8");
	const win = electron.BrowserWindow.getFocusedWindow() || electron.BrowserWindow.getAllWindows()[0];
	if (!win || win.isDestroyed()) {
		require_logger.mainLog.warn("[PerfProfiler] No window available for creating analysis session");
		return;
	}
	const quickPrompt = `分析要求见：${promptFile}，请读取这个文件按其中要求分析，并在引用下面 2 项的回答。

1. 卡顿的具体场景是什么？
2. 最近有没有升级 WorkBuddy 或改过什么设置？`;
	const injectScript = `
    (async function() {
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const waitFor = async (predicate, timeoutMs, intervalMs) => {
            const deadline = Date.now() + timeoutMs;
            while (Date.now() < deadline) {
                const result = predicate();
                if (result) return result;
                await sleep(intervalMs);
            }
            return null;
        };

        // Step 1: 触发新建对话。按钮找不到也不 return —— 用户可能已经在新建任务页。
        const newTaskBtn = document.querySelector('[data-track-id="agent_new_task_button_clicked"]');
        if (newTaskBtn) newTaskBtn.click();

        // Step 2: 等 deeplink 模块的预填 subject 挂到 globalThis 上。
        // 正常场景已存在；首次冷启动 / HMR 后可能要短暂等 agent-ui bundle 执行完 import 副作用。
        const subject = await waitFor(
            () => {
                const s = globalThis.__taskDeeplinkPrefillIntent$;
                return (s && typeof s.next === 'function') ? s : null;
            },
            8000,
            100,
        );
        if (!subject) return 'prefill_channel_not_found';

        // Step 3: emit 预填意图。消费方（main-content-core / use-task-deeplink-prefill）
        // 自己处理草稿保护 modal、setInputValue 受控写入、skipInputDraftNextSave，
        // 不会再被 useInputDraft 的 draftKey 切换 effect 清空。
        // token 用 Date.now() 保证单调递增，避免与已消费过的旧 token 撞车。
        try {
            subject.next({ prompt: ${JSON.stringify(quickPrompt)}, token: Date.now() });
            return 'prompt_filled';
        } catch (e) {
            console.warn('[PerfProfiler] taskPrefillIntent$.next failed:', e);
            return 'prefill_emit_failed';
        }
    })();
    `;
	try {
		const result = await win.webContents.executeJavaScript(injectScript);
		require_logger.mainLog.info(`[PerfProfiler] Analysis prompt fill result: ${result}`);
		const resultStr = String(result);
		if (!(resultStr === "prompt_filled")) {
			const { clipboard } = await import("electron");
			clipboard.writeText(quickPrompt);
			electron.dialog.showMessageBox({
				type: "info",
				message: "性能采集已完成",
				detail: `采集数据已保存到：\n${outputDir}\n\n未能自动填入输入框（reason=${resultStr}），📋 分析指令已复制到剪贴板。\n请手动新建对话并粘贴。`,
				buttons: ["好的"]
			}).catch(() => {});
		}
	} catch (err) {
		require_logger.mainLog.warn("[PerfProfiler] executeJavaScript failed:", String(err));
		const { clipboard } = await import("electron");
		clipboard.writeText(quickPrompt);
		electron.dialog.showMessageBox({
			type: "info",
			message: "性能采集已完成",
			detail: `采集数据已保存到：\n${outputDir}\n\n📋 分析指令已复制到剪贴板。\n请手动新建对话并粘贴。`,
			buttons: ["好的"]
		}).catch(() => {});
	}
}
//#endregion
Object.defineProperty(exports, "getProfilingState", {
	enumerable: true,
	get: function() {
		return getProfilingState;
	}
});
Object.defineProperty(exports, "isPerfProfilingEnabled", {
	enumerable: true,
	get: function() {
		return isPerfProfilingEnabled;
	}
});
Object.defineProperty(exports, "startProfiling", {
	enumerable: true,
	get: function() {
		return startProfiling;
	}
});
Object.defineProperty(exports, "stopProfiling", {
	enumerable: true,
	get: function() {
		return stopProfiling;
	}
});
Object.defineProperty(exports, "stopProfilingAndAnalyze", {
	enumerable: true,
	get: function() {
		return stopProfilingAndAnalyze;
	}
});
Object.defineProperty(exports, "stopProfilingOnly", {
	enumerable: true,
	get: function() {
		return stopProfilingOnly;
	}
});
