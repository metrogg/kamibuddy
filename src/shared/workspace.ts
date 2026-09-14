/**
 * 每任务自动目录的命名与形态判定（纯函数契约）。
 *
 * 为什么放 shared 而不是 core：目录名由 daemon 在首次执行时生成（分配 cwd），
 * 而侧栏分组在 renderer 侧用它判定「任务/空间」归属。renderer 只许 import
 * shared/（AGENTS.md §1），所以生成与识别必须在这里放同一份，两端不各写一遍
 * 正则字面量。
 *
 * 格式来源（对齐 WorkBuddy）：`formatDefaultCwdTimestamp`，实测于
 * docs/WorkBuddy/_analysis/extracted/main/server.js:160801-160804
 * （同处 160808-160811 的 createDefaultCwd 用同一格式并在同秒冲突时按秒递增重试）。
 * 注意其 getMonth() 从 0 起算，必须 +1。本文件只对齐「格式」，不复刻其创建/重试
 * 逻辑（那部分在 core 层）。
 */

/** 自动目录名（本地时间）：YYYY-MM-DD-HH-mm-ss，各位补零。 */
export function autoSessionDirName(now: Date): string {
	const pad = (value: number): string => String(value).padStart(2, "0");
	return (
		`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-` +
		`${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
	);
}

/**
 * 形态匹配 `^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$`。
 *
 * 只判形态、不比对目录归属根 —— 这是有意的设计：任务区归属据此判定，
 * 用户改了「默认存储路径」后，旧任务目录（仍在新根之外的原根下）依旧命中，
 * 不会误漂到「空间」区。若改成与「当前生效根」比对，改根即漂移，是我们要修的 bug。
 *
 * 也不校验日期合法值（如 `2026-13-45` 同样命中）：这个判定只用来分区，不做日期
 * 语义校验；非法日期不可能由本程序生成，进一步校验只会徒增分支且无收益。
 */
export function isAutoSessionDirName(name: string): boolean {
	return /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(name);
}
