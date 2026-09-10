//#region src/main/system/process-role.ts
/**
* WorkBuddy 进程角色识别 —— 单一来源（Single Source of Truth）。
*
* 目前 WorkBuddy Desktop 由两个 Node 进程构成：
*   - main 进程：Electron main，持有 Renderer IPC / Host 能力 / Daemon 生命周期
*   - daemon 进程：`ELECTRON_RUN_AS_NODE=1` 拉起的 app-server（stdio RPC over stdin/stdout）
*
* 二者共享同一份 TS 源码（apps/workbuddy-desktop/src/main/**），运行期通过
* `WORKBUDDY_FS_PROTECTION_ROLE` 环境变量区分。历史上这个 env 名被 5 个文件
* 分别以字面量写死（`fs-protection` domain 的语义外溢到了通用身份判定），
* 只要有人改名就有一处会失守，静默重现"daemon 日志被路由到 main.log"这类
* 历史 bug。本模块把 env 名、取值和 helper 收敛到一处，其他文件必须引这里。
*
* ⚠️ CJS shim（`wb-fs-protection.cjs`）是 side-effect 加载的 zero-dependency
* 模块，不能 import 本文件；它内部保留了同名字面量，并在注释里指向本文件
* 作为 SSoT。改名时**两处必须一起改**——把命名同步的心智负担留在注释里。
*
* ⚠️ 本文件必须**零副作用**：所有 helper 都是纯函数式对 `process.env` 的读取，
* 允许被 daemon / main 双方从任意深度 import 而不产生任何 file transport /
* 全局注入等意外行为。
*/
/**
* 定义 daemon 进程身份识别所用的环境变量名。
*
* 历史沿革：这个 env 名的字面量 `WORKBUDDY_FS_PROTECTION_ROLE` 最早来自
* fs-protection shim 里区分 main/daemon 审计日志文件（`fs-protection.log` vs
* `fs-protection.daemon.log`）。后来 logger.ts 顶层守卫也复用了它作为
* "我是不是 daemon"的通用信号——语义已经跨出 fs-protection 域。
*
* 当前保留原名以避免破坏 spawn 时序契约（重命名需要主进程和 daemon 二进制
* 同时升级）；若未来重命名，把这里改一处即可让所有 TS 侧使用点跟随。CJS
* shim（wb-fs-protection.cjs）保留同名字面量，改名时**必须**同步。
*/
var WORKBUDDY_PROCESS_ROLE_ENV = "WORKBUDDY_FS_PROTECTION_ROLE";
/**
* daemon 角色的取值。spawn 时由主进程 `start-daemon-child-process.ts` 写入。
* main 进程不写此 env（缺失 = main 进程）。
*/
var WORKBUDDY_DAEMON_ROLE_VALUE = "daemon";
/**
* 判定当前进程是否 daemon。
*
* 纯读 env，无副作用；可被任意深度 import。
*/
function isDaemonProcess() {
	return process.env[WORKBUDDY_PROCESS_ROLE_ENV] === WORKBUDDY_DAEMON_ROLE_VALUE;
}
/**
* daemon 入口点顶部使用的运行时契约 assert。
*
* 场景：`start-daemon-child-process.ts` 是唯一注入 `WORKBUDDY_FS_PROTECTION_ROLE=daemon`
* 的 spawn 路径。若未来有人绕开它手写另一条 spawn（dev 脚本 / e2e / 内嵌宿主等）
* 且忘了注入 env，daemon 顶层 file transport 会先绕开 daemon 守卫、把日志路由指到
* `main.log`；`configureDaemonFileTransport` 后手才能纠正，但这个时间窗里可能
* 已经发生 `errorHandler.startCatching` 挂钩 / renderer.log 懒开文件描述符 /
* `Object.assign(console, log.functions)` 覆盖 stderr guard 等副作用。
*
* 与其等到问题出现时排查日志错位，不如在 daemon 入口顶部**运行时**明确约定：
* 缺失或值不对 → 立刻 stderr 打印并 `process.exit(1)`，让父进程 (main) 的
* daemon-process-manager 从 stderr tail 里立刻捕获到失败原因。
*
* 只在 daemon 入口调用（`daemon-app-server-entry.ts`）；main 进程不该调用本函数。
*/
function assertDaemonProcessRole() {
	if (isDaemonProcess()) return;
	const actual = process.env[WORKBUDDY_PROCESS_ROLE_ENV];
	process.stderr.write(`[DaemonAppServer] Fatal: ${WORKBUDDY_PROCESS_ROLE_ENV} must be "${WORKBUDDY_DAEMON_ROLE_VALUE}" for daemon entry, got ${JSON.stringify(actual)}. Refuse to boot to avoid log routing / stdio guard drift.
`);
	process.exit(1);
}
//#endregion
Object.defineProperty(exports, "WORKBUDDY_DAEMON_ROLE_VALUE", {
	enumerable: true,
	get: function() {
		return WORKBUDDY_DAEMON_ROLE_VALUE;
	}
});
Object.defineProperty(exports, "WORKBUDDY_PROCESS_ROLE_ENV", {
	enumerable: true,
	get: function() {
		return WORKBUDDY_PROCESS_ROLE_ENV;
	}
});
Object.defineProperty(exports, "assertDaemonProcessRole", {
	enumerable: true,
	get: function() {
		return assertDaemonProcessRole;
	}
});
Object.defineProperty(exports, "isDaemonProcess", {
	enumerable: true,
	get: function() {
		return isDaemonProcess;
	}
});
